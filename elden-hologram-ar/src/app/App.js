// Cuore dell'applicazione: renderer, scena, luci/ombre, boss evocati, gesti, combattimento, effetti.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Emitter } from '../util/events.js';
import { loadSettings, saveSettings } from '../util/settings.js';
import { clamp } from '../util/math.js';
import { BossLoader, loadManifest } from '../bosses/BossLoader.js';
import { Boss } from '../bosses/Boss.js';
import { FightSystem } from '../fight/FightSystem.js';
import { Particles } from '../fx/Particles.js';
import { Sfx } from '../fx/Sfx.js';
import { STYLE_ORDER, STYLES } from '../fx/HologramMaterial.js';
import { Gestures } from '../input/Gestures.js';
import { PreviewMode, GyroCameraMode, WebXRMode } from './Modes.js';

const BASE = import.meta.env.BASE_URL || './';
const _ray = new THREE.Ray();
const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export class App extends Emitter {
  constructor({ canvas }) {
    super();
    this.canvas = canvas;
    this.settings = loadSettings();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.hd ? 2 : 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = this.settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.defaultEnv = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.setEnvironment(null);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 200);
    this.camera.position.set(0, 0.5, 1);

    // Luci: emisferica morbida + sole direzionale con ombre (ancorato alla "scena" dei boss)
    this.hemi = new THREE.HemisphereLight(0xfff3e0, 0x3a2e1e, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.01;
    this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.015;
    this.sunDir = new THREE.Vector3(0.55, 1.4, 0.7).normalize();
    this.scene.add(this.hemi, this.sun, this.sun.target);

    // Piano che "cattura" solo l'ombra: fa sembrare il boss appoggiato al tavolo vero
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.42, transparent: true, depthWrite: false }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.visible = false;
    this.ground.name = 'ShadowCatcher';
    this.scene.add(this.ground);

    this.particles = new Particles(this.scene);
    this.sfx = new Sfx();
    this.sfx.setEnabled(this.settings.sound);
    this.loader = new BossLoader(renderer, { basePath: BASE });

    this.bosses = [];
    this.selected = null;
    this.selectedDef = null;
    this.manifest = null;
    this.timeScale = 1;
    this.time = 0;
    this.clock = new THREE.Clock();
    this.dragging = null;
    this.pendingSpawn = false;

    this.fight = new FightSystem({
      onSwing: (a) => this.sfx.swing(),
      onHit: (a, t, dmg, crit) => this._onHit(a, t, dmg, crit),
      onDeath: (t) => { this.sfx.death(); this.particles.burst({ position: t.chestPosition(_v3), color: STYLES.spirit.tint.getHex(), count: 60, speed: 0.9 * t.height, life: 1.2, size: 0.035 * t.height, gravity: -0.2 * t.height, up: 0.8 }); },
      onVictory: (w) => this._onVictory(w),
    });

    this.modes = { preview: new PreviewMode(this), gyro: new GyroCameraMode(this), webxr: new WebXRMode(this) };
    this.mode = null;

    this.gestures = new Gestures();
    this._bindGestures();
    window.addEventListener('resize', () => this.onResize());
    renderer.setAnimationLoop((t, frame) => this._frame(t, frame));
  }

  async init() {
    this.manifest = await loadManifest(`${BASE}bosses.json`);
    this.selectedDef = this.manifest.bosses[0] || null;
    this.emit('manifest', this.manifest);
    return this.manifest;
  }

  // ------------------------------------------------------------------ modalità
  async startMode(name) {
    if (this.mode) await this.stopMode();
    const mode = this.modes[name];
    if (!mode) throw new Error(`Modalità sconosciuta: ${name}`);
    this.sfx.unlock();
    await mode.start();
    this.mode = mode;
    this.clock.getDelta();
    document.body.classList.add(`mode-${name}`);
    this.emit('mode', name);
  }

  async stopMode() {
    const mode = this.mode;
    if (!mode) return;
    this.mode = null;
    this.clearBosses();
    document.body.classList.remove(`mode-${mode.name}`);
    try { await mode.stop(); } catch (e) { console.warn(e); }
    this.emit('mode', null);
  }

  /** Chiamato quando la sessione WebXR termina dall'esterno (tasto indietro di sistema). */
  onExternalSessionEnd(mode) {
    if (this.mode === mode) this.stopMode();
  }

  activeCamera() { return (this.mode && this.mode.camera) || this.camera; }

  setEnvironment(tex) {
    this.scene.environment = tex || this.defaultEnv;
    if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = tex ? 1.0 : 0.75;
  }

  setSunDirection(v) {
    if (v && v.lengthSq() > 1e-6) this.sunDir.copy(v).normalize();
    if (this.sunDir.y < 0.15) this.sunDir.y = 0.15;
    this.sunDir.normalize();
  }

  // ------------------------------------------------------------------ loop
  _frame(t, frame) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.mode) this.mode.update(dt, frame);
    const sdt = dt * this.timeScale;
    this.time += sdt;
    for (const b of this.bosses) b.update(sdt, this.time);
    this.fight.update(sdt);
    this.particles.update(sdt, this.renderer);
    this._updateStage();
    this.renderer.render(this.scene, this.camera);
  }

  _updateStage() {
    const visible = this.bosses.filter((b) => b.root.visible);
    if (!visible.length) { this.ground.visible = false; return; }
    let minY = Infinity, maxH = 0;
    _v3.set(0, 0, 0);
    for (const b of visible) { minY = Math.min(minY, b.root.position.y); maxH = Math.max(maxH, b.height); _v3.add(b.root.position); }
    _v3.multiplyScalar(1 / visible.length);
    let spread = 0;
    for (const b of visible) spread = Math.max(spread, _v3b.copy(b.root.position).setY(_v3.y).distanceTo(_v3.clone().setY(_v3.y)));
    const extent = Math.max(0.6, spread * 2.2 + maxH * 2.5);

    this.ground.visible = this.settings.shadows;
    this.ground.position.set(_v3.x, minY - 0.0015, _v3.z);
    this.ground.scale.set(extent * 2, extent * 2, 1);

    this.sun.target.position.copy(_v3);
    this.sun.position.copy(_v3).addScaledVector(this.sunDir, extent * 1.6);
    const cam = this.sun.shadow.camera;
    const half = extent;
    if (cam.right !== half) {
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.far = extent * 4;
      cam.updateProjectionMatrix();
    }
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ raggi / picking
  screenRay(x, y) {
    const cam = this.activeCamera();
    cam.updateMatrixWorld();
    const nx = (x / window.innerWidth) * 2 - 1;
    const ny = -(y / window.innerHeight) * 2 + 1;
    _m4.copy(cam.projectionMatrix).invert();
    _ray.origin.setFromMatrixPosition(cam.matrixWorld);
    _v3.set(nx, ny, 0.5).applyMatrix4(_m4).applyMatrix4(cam.matrixWorld);
    _ray.direction.copy(_v3).sub(_ray.origin).normalize();
    return _ray;
  }

  pickBoss(x, y) {
    const ray = this.screenRay(x, y);
    _raycaster.camera = this.activeCamera();
    _raycaster.ray.copy(ray);
    _raycaster.near = 0.001;
    _raycaster.far = 100;
    const roots = this.bosses.filter((b) => b.root.visible).map((b) => b.root);
    if (!roots.length) return null;
    const hits = _raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.boss) o = o.parent;
      if (o && o.userData.boss && o.userData.boss.alive !== undefined) return o.userData.boss;
    }
    return null;
  }

  // ------------------------------------------------------------------ boss
  async spawn(def, position, { height, yaw, summon = true } = {}) {
    if (!def) return null;
    this.pendingSpawn = true;
    const slow = setTimeout(() => this.toast(`Caricamento di ${def.short || def.name} in corso…`), 900);
    try {
      const inst = await this.loader.instantiate(def);
      const boss = new Boss({ def, defaults: this.manifest ? this.manifest.defaults : {}, ...inst });
      boss.setHeight(height ?? this.settings.defaultHeight);
      boss.root.position.copy(position);
      boss.yaw = yaw ?? this.yawTowardsCamera(position);
      boss.setStyle(this.settings.style);
      this.scene.add(boss.root);
      this.bosses.push(boss);
      if (summon) {
        boss.summon();
        this.sfx.summon();
        this.particles.burst({ position: _v3.copy(position).add(_v3b.set(0, boss.height * 0.05, 0)), color: 0xffd166, count: 50, speed: 0.6 * boss.height, life: 1.1, size: 0.03 * boss.height, gravity: -0.35 * boss.height, up: 1.2 });
      }
      this.select(boss);
      this.emit('bosses', this.bosses);
      return boss;
    } finally {
      clearTimeout(slow);
      this.pendingSpawn = false;
    }
  }

  yawTowardsCamera(position) {
    const cam = this.activeCamera();
    _v3.setFromMatrixPosition(cam.matrixWorld);
    return Math.atan2(_v3.x - position.x, _v3.z - position.z);
  }

  remove(boss) {
    if (!boss) return;
    const i = this.bosses.indexOf(boss);
    if (i >= 0) this.bosses.splice(i, 1);
    if (this.fight.active) this.stopFight();
    boss.dispose();
    if (this.selected === boss) this.select(this.bosses[this.bosses.length - 1] || null);
    this.emit('bosses', this.bosses);
  }

  clearBosses() {
    this.fight.stop();
    this.fight.winner = null;
    for (const b of this.bosses) b.dispose();
    this.bosses = [];
    this.select(null);
    this.emit('fight', false);
    this.emit('bosses', this.bosses);
  }

  select(boss) {
    for (const b of this.bosses) b.setSelected(b === boss);
    this.selected = boss;
    this.emit('select', boss);
  }

  setSelectedDef(def) {
    this.selectedDef = def;
    this.emit('selectedDef', def);
    // scalda la cache: il modello arriva prima del tap
    if (def) this.loader.loadAsset(def).catch(() => {});
  }

  setHeight(m, { persist = true } = {}) {
    m = clamp(m, 0.02, 50);
    if (this.selected) this.selected.setHeight(m);
    if (persist) { this.settings.defaultHeight = m; saveSettings(this.settings); }
    this.emit('height', m);
  }

  setStyle(style) {
    if (!STYLES[style]) return;
    this.settings.style = style;
    saveSettings(this.settings);
    for (const b of this.bosses) b.setStyle(style);
    this.emit('style', style);
  }
  cycleStyle() {
    const i = STYLE_ORDER.indexOf(this.settings.style);
    this.setStyle(STYLE_ORDER[(i + 1) % STYLE_ORDER.length]);
  }

  setTimeScale(v) { this.timeScale = clamp(v, 0.05, 8); this.emit('timescale', this.timeScale); }

  setSound(v) { this.settings.sound = !!v; saveSettings(this.settings); this.sfx.setEnabled(!!v); if (v) this.sfx.unlock(); this.emit('settings', this.settings); }

  setHD(v) {
    this.settings.hd = !!v;
    saveSettings(this.settings);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, v ? 2 : 1.5));
    this.renderer.xr.setFramebufferScaleFactor(v ? 1.4 : 1.0);
    this.onResize();
    this.emit('settings', this.settings);
  }

  setShadows(v) {
    this.settings.shadows = !!v;
    saveSettings(this.settings);
    this.renderer.shadowMap.enabled = !!v;
    this.scene.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    this.emit('settings', this.settings);
  }

  updateSetting(key, value) { this.settings[key] = value; saveSettings(this.settings); this.emit('settings', this.settings); }

  // ------------------------------------------------------------------ combattimento
  startFight(seed) {
    const ok = this.fight.start(this.bosses, seed);
    if (!ok) { this.toast('Evoca almeno due boss per farli combattere'); return false; }
    this.select(null);
    this.emit('fight', true);
    return true;
  }
  stopFight() { this.fight.stop(); this.emit('fight', false); }
  resetFight() {
    this.fight.stop();
    this.fight.winner = null;
    for (const b of this.bosses) b.resetFight();
    this.emit('fight', false);
    this.emit('bosses', this.bosses);
  }

  _onHit(a, t, dmg, crit) {
    const p = t.chestPosition(_v3);
    this.particles.burst({ position: p, color: crit ? 0xffffff : 0xffc24a, count: crit ? 46 : 26, speed: (crit ? 1.1 : 0.7) * t.height, life: 0.55, size: 0.022 * t.height, gravity: 1.6 * t.height, up: 0.5 });
    this.particles.burst({ position: p, color: 0xff3b2e, count: 12, speed: 0.5 * t.height, life: 0.7, size: 0.018 * t.height, gravity: 2.0 * t.height, up: 0.3 });
    this.sfx.hit(crit ? 1.4 : 1);
    this.emit('hit', { attacker: a, target: t, damage: dmg, crit });
  }

  _onVictory(winner) {
    this.emit('fight', false);
    this.emit('victory', winner);
    if (!winner) return;
    this.sfx.victory();
    const p = winner.chestPosition(_v3);
    this.particles.burst({ position: p, color: 0xffd166, count: 120, speed: 0.9 * winner.height, life: 1.6, size: 0.03 * winner.height, gravity: 0.6 * winner.height, up: 1.4, spread: 1.2 });
  }

  // ------------------------------------------------------------------ gesti
  _bindGestures() {
    const g = this.gestures;
    g.on('tap', async (x, y) => {
      if (!this.mode) return;
      this.sfx.unlock();
      const hit = this.pickBoss(x, y);
      if (hit) { this.select(hit); return; }
      if (this.fight.active || this.pendingSpawn) return;
      const p = this.mode.placeFromScreen(x, y);
      if (!p || !this.selectedDef) return;
      try { await this.spawn(this.selectedDef, p); }
      catch (e) { console.error(e); this.toast(`Impossibile evocare: ${e.message || e}`); }
    });
    g.on('dragstart', (x, y) => {
      if (!this.mode) return;
      const hit = this.pickBoss(x, y);
      this.dragging = hit && !this.fight.active ? hit : null;
      if (hit) this.select(hit);
    });
    g.on('drag', (x, y, dx, dy) => {
      if (!this.mode) return;
      if (this.dragging) {
        const p = this.mode.groundPointFromScreen(x, y, this.dragging.root.position.y);
        if (p) { this.dragging.root.position.x = p.x; this.dragging.root.position.z = p.z; }
      } else if (this.mode.onDragEmpty) {
        this.mode.onDragEmpty(dx, dy);
      }
    });
    g.on('dragend', () => { this.dragging = null; });
    g.on('pinch', (factor) => {
      if (!this.selected) return;
      this.setHeight(this.selected.height * factor);
    });
    g.on('rotate', (da) => { if (this.selected) this.selected.yaw -= da; });
  }

  toast(msg) { this.emit('toast', msg); }
}
