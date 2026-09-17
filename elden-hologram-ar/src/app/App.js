// Cuore dell'applicazione: renderer, scena, luci/ombre, boss evocati, gesti, combattimento, effetti.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Emitter } from '../util/events.js';
import { loadSettings, saveSettings } from '../util/settings.js';
import { clamp, dampAngle } from '../util/math.js';
import { BossLoader, loadManifest } from '../bosses/BossLoader.js';
import { Boss } from '../bosses/Boss.js';
import { FightSystem } from '../fight/FightSystem.js';
import { Particles } from '../fx/Particles.js';
import { CombatFx } from '../fx/CombatFx.js';
import { Sfx } from '../fx/Sfx.js';
import { STYLE_ORDER, STYLES } from '../fx/HologramMaterial.js';
import { tuneCameraMatch } from '../fx/CameraMatch.js';
import { Gestures } from '../input/Gestures.js';
import { PreviewMode, GyroCameraMode, WebXRMode } from './Modes.js';

const BASE = import.meta.env.BASE_URL || './';

// Come si vede un colpo, per famiglia. `spark` è il colore delle scintille,
// `flash` il lampo nel punto di contatto, `debris` quello che schizza via
// (sangue, polvere di pietra, spore). Un colpo di bastone non può fare le
// stesse scintille di una stoccata.
const IMPACT_LOOK = {
  slash: { spark: 0xffd98a, flash: 0xfff6d8, debris: 0xff3b2e, sparks: 26, speed: 0.75, cone: 0.68, mark: true },
  thrust: { spark: 0xfff0b8, flash: 0xffffff, debris: 0xff3b2e, sparks: 18, speed: 1.15, cone: 0.88, mark: false },
  blunt: { spark: 0xffc07a, flash: 0xffd9a0, debris: 0xb8a284, sparks: 20, speed: 0.55, cone: 0.45, mark: false },
  magic: { spark: 0xffe08a, flash: 0xfff2c8, debris: 0xd8a2ff, sparks: 30, speed: 0.85, cone: 0.5, mark: true },
  rot: { spark: 0xff7a5c, flash: 0xffb08a, debris: 0xc0392b, sparks: 28, speed: 0.7, cone: 0.55, mark: true },
};
const _ray = new THREE.Ray();
const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _v3d = new THREE.Vector3();
const _wa = new THREE.Vector3();
const _wb = new THREE.Vector3();
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
    // L'arena è il tavolo virtuale: boss, ombre e luce direzionale stanno qui dentro,
    // così in AR basta agganciare questo gruppo a un punto reale per tenere fermo tutto.
    this.arena = new THREE.Group();
    this.arena.name = 'Arena';
    this.scene.add(this.arena);
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
    this.scene.add(this.hemi);
    this.arena.add(this.sun, this.sun.target);

    // Piano che "cattura" solo l'ombra: fa sembrare il boss appoggiato al tavolo vero
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.42, transparent: true, depthWrite: false }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.visible = false;
    this.ground.name = 'ShadowCatcher';
    this.arena.add(this.ground);

    // Particelle ed effetti vivono nell'arena, non nella scena: se l'ancora AR
    // corregge la posizione del tavolo, scintille e onde d'urto si spostano con lui.
    this.particles = new Particles(this.arena);
    this.combatFx = new CombatFx(this.arena, this.particles);
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
    // Regia dello scontro: fermo-immagine sui colpi pesanti, rallentatore sul
    // colpo finale, scossa del tavolo sugli impatti. Rende gli scontri epici
    // senza toccare la camera, che in AR deve restare quella del telefono.
    this.arenaOrigin = new THREE.Vector3();
    this.shake = { amp: 0, decay: 7, dx: 0, dz: 0 };
    this.hitStop = 0;
    this.slowmo = { time: 0, scale: 1 };
    // intensità dell'ombra di contatto: la abbassa la luce letta dalla stanza
    this.shadowStrength = 1;

    this.fight = new FightSystem({
      onMoveStart: (a, t, m) => this._onMoveStart(a, t, m),
      onTelegraph: (a, t, m, k) => this._onTelegraph(a, t, m, k),
      onActive: (a, t, m) => this._onActive(a, t, m),
      onTrail: (a, m) => { if (m.vfx === 'rotTrail') this.combatFx.rotTrail(a); else this.combatFx.dust(a.root.position, a.height, 3); },
      onHit: (a, t, dmg, crit, m) => this._onHit(a, t, dmg, crit, m),
      onGuard: (v, a) => { this._audioAt(v); this.sfx.guard(); this.combatFx.guard(v.chestPosition(_v3), v.height); },
      onEvade: (a) => { this._audioAt(a); this.sfx.step(); },
      onEvadeSuccess: (v) => this.particles.burst({ position: v.chestPosition(_v3), color: 0xbfe9ff, count: 10, speed: 0.4 * v.height, life: 0.35, size: 0.016 * v.height, gravity: 0.2 * v.height, up: 0.4 }),
      onStagger: (v) => { this._audioAt(v); this.sfx.stagger(); },
      onKnockdown: (v, a, m) => this._onKnockdown(v, a, m),
      onFeint: (a, t, m) => this._onFeint(a, t, m),
      onProjectile: (a, t, m) => this._onProjectile(a, t, m),
      onPull: (a, t, m) => { if (Math.random() < 0.12) this.combatFx.gravity(a.chestPosition(_v3).clone(), t.chestPosition(_v3b).clone(), t.height, { life: 0.35 }); },
      onLifesteal: (a, t) => this.combatFx.lifesteal(t.chestPosition(_v3).clone(), a.chestPosition(_v3b).clone(), a.height),
      onRot: (v) => this.particles.burst({ position: v.chestPosition(_v3), color: 0xc0392b, count: 18, speed: 0.5 * v.height, life: 1.0, size: 0.022 * v.height, gravity: -0.1 * v.height, up: 0.6 }),
      onPhase2: (a, name) => this._onPhase2(a, name),
      onDeath: (t, killer) => this._onDeath(t, killer),
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
    this.resetArena();
    document.body.classList.remove(`mode-${mode.name}`);
    try { await mode.stop(); } catch (e) { console.warn(e); }
    this.emit('mode', null);
  }

  /** Riporta l'arena all'origine (fuori dall'AR non serve ancoraggio). */
  resetArena() {
    this.arenaOrigin.set(0, 0, 0);
    this.arena.position.set(0, 0, 0);
    this.arena.updateMatrixWorld(true);
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

  /**
   * Applica la luce letta dalla stanza: colore ambientale, esposizione,
   * direzione del sole e riflessi. Con `null` torna ai valori di default.
   */
  applyRoomLight(light) {
    if (!light) {
      this.hemi.color.set(0xfff3e0);
      this.hemi.intensity = 0.6;
      this.sun.intensity = 2.4;
      this.shadowStrength = 1;
      this.renderer.toneMappingExposure = 1;
      for (const b of this.bosses) tuneCameraMatch(b.matchUniforms, 0.7);
      this.setEnvironment(null);
      return;
    }
    for (const b of this.bosses) tuneCameraMatch(b.matchUniforms, light.luminance);
    this.hemi.color.copy(light.ambient);
    this.hemi.intensity = 0.28 + light.luminance * 0.7;
    this.sun.color.copy(light.ambient);
    this.sun.intensity = 1.1 + light.luminance * 2.2;
    // tavolo buio → ombra più tenue; luce piena → ombra netta
    this.shadowStrength = 0.45 + light.luminance * 0.75;
    const target = light.exposure;
    this.renderer.toneMappingExposure += (target - this.renderer.toneMappingExposure) * 0.12;
    this.setSunDirection(light.sunDir);
    if (light.environment) this.setEnvironment(light.environment);
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

    let sdt = dt * this.timeScale;
    if (this.hitStop > 0) { this.hitStop -= dt; sdt = 0; }
    if (this.slowmo.time > 0) { this.slowmo.time -= dt; sdt *= this.slowmo.scale; }
    if (this.shake.amp > 0.00005) {
      this.shake.amp *= Math.exp(-this.shake.decay * dt);
      // la scossa parte nella direzione del colpo, non a caso: si legge da dove
      // è arrivata la mazzata anche guardando solo il tavolo
      const a = this.shake.amp;
      const wob = Math.sin(this.time * 90) * 0.55 + (Math.random() - 0.5) * 0.45;
      this.arena.position.set(
        this.arenaOrigin.x + (this.shake.dx * wob + (Math.random() - 0.5) * 0.5) * a,
        this.arenaOrigin.y + (Math.random() - 0.5) * a * 0.6,
        this.arenaOrigin.z + (this.shake.dz * wob + (Math.random() - 0.5) * 0.5) * a,
      );
    } else if (this.shake.amp) {
      this.shake.amp = 0;
      this.arena.position.copy(this.arenaOrigin);
    }
    this.time += sdt;
    for (const b of this.bosses) {
      b.update(sdt, this.time);
      if (b.animator.footfall && b.root.visible) this._footstep(b);
      this._skidDust(b, sdt);
    }
    if (!this.fight.active) this._idleBehaviour(sdt);
    this.fight.update(sdt);
    this.particles.update(sdt, this.renderer);
    this.combatFx.update(sdt);
    this._updateStage();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Fuori dal combattimento i boss non restano immobili: si girano lentamente
   * verso l'avversario più vicino, o verso chi guarda se sono soli.
   */
  _idleBehaviour(dt) {
    const alive = this.bosses.filter((b) => b.root.visible && b.alive);
    if (!alive.length) return;
    const cam = this.activeCamera();
    _v3.setFromMatrixPosition(cam.matrixWorld);
    this.toArena(_v3);
    for (const b of alive) {
      if (b.fight.state !== 'idle' && b.fight.state !== 'approach') continue;
      let target = null, best = Infinity;
      for (const o of alive) {
        if (o === b) continue;
        const d = b.root.position.distanceToSquared(o.root.position);
        if (d < best) { best = d; target = o; }
      }
      const p = target ? target.root.position : _v3;
      const yaw = Math.atan2(p.x - b.root.position.x, p.z - b.root.position.z);
      b.root.rotation.y = dampAngle(b.root.rotation.y, yaw, 1.1, dt);
      b.lookAt(p);
    }
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
    this.ground.material.opacity = 0.42 * this.shadowStrength;
    this.ground.position.set(_v3.x, minY - 0.0015, _v3.z);
    this.ground.scale.set(extent * 2, extent * 2, 1);
    // in una stanza buia l'ombra di contatto va alleggerita, altrimenti diventa
    // una macchia nera sopra un tavolo già scuro
    for (const b of visible) b.shadowStrength = this.shadowStrength;

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
      const world = position.clone();
      const local = this.toArena(position.clone());
      boss.root.position.copy(local);
      boss.yaw = yaw ?? this.yawTowardsCamera(world);
      boss.setStyle(this.settings.style);
      this.arena.add(boss.root);
      this.arena.add(boss.trail.mesh);   // la scia resta nell'arena, non nel corpo
      this.bosses.push(boss);
      if (summon) {
        boss.summon();
        this.sfx.summon();
        this.particles.burst({ position: _v3.copy(local).add(_v3b.set(0, boss.height * 0.05, 0)), color: 0xffd166, count: 50, speed: 0.6 * boss.height, life: 1.1, size: 0.03 * boss.height, gravity: -0.35 * boss.height, up: 1.2 });
      }
      // In AR il primo boss definisce il punto di ancoraggio dell'arena.
      if (this.mode && this.mode.requestAnchor && this.bosses.length === 1) {
        this.mode.requestAnchor(world);
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
    this.toArena(_v3);
    const p = this.toArena(_v3b.copy(position));
    return Math.atan2(_v3.x - p.x, _v3.z - p.z);
  }

  /** Da coordinate mondo a coordinate arena (l'arena trasla soltanto). */
  toArena(v) { return this.arena.worldToLocal(v); }
  /** Da coordinate arena a coordinate mondo. */
  toWorld(v) { return this.arena.localToWorld(v); }

  /** Aggancia l'arena a un punto del mondo reale, mantenendo i boss dove sono. */
  setArenaOrigin(worldPosition) {
    const delta = _v3.copy(worldPosition).sub(this.arenaOrigin);
    if (delta.lengthSq() < 1e-10) return;
    this.arenaOrigin.copy(worldPosition);
    this.arena.position.copy(this.arenaOrigin);
    for (const b of this.bosses) b.root.position.sub(delta);
    this.arena.updateMatrixWorld(true);
  }

  /**
   * Scossa del tavolo: ampiezza in altezze del boss che l'ha provocata.
   * @param {{x:number,z:number}} [dir] direzione del colpo, per una scossa orientata
   */
  addShake(amount, height, dir) {
    this.shake.amp = Math.min(0.04, this.shake.amp + amount * height);
    if (dir) {
      const d = Math.hypot(dir.x, dir.z) || 1;
      this.shake.dx = dir.x / d;
      this.shake.dz = dir.z / d;
    } else {
      const a = Math.random() * Math.PI * 2;
      this.shake.dx = Math.cos(a);
      this.shake.dz = Math.sin(a);
    }
  }

  /**
   * Fermo-immagine: il colpo pesa. La durata si accorcia quando lo scontro è
   * accelerato, altrimenti in avanti veloce le pause si sommano e bloccano tutto.
   */
  freeze(seconds) {
    const scaled = seconds / Math.max(1, this.timeScale);
    this.hitStop = Math.min(0.14, Math.max(this.hitStop, scaled));
  }

  /** Rallentatore, per il colpo che chiude lo scontro. */
  slowMotion(scale, seconds) { this.slowmo.scale = scale; this.slowmo.time = seconds; }

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
    this.combatFx.clear();
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
    this.combatFx.clear();
    this.fight.winner = null;
    for (const b of this.bosses) b.resetFight();
    this.emit('fight', false);
    this.emit('bosses', this.bosses);
  }

  _onHit(a, t, dmg, crit, move) {
    const p = this._impactPoint(a, t, _v3);
    const weight = (move && move.poise) || 1;
    const heavy = weight >= 1.8;
    const kind = (move && move.impact) || 'slash';
    const look = IMPACT_LOOK[kind] || IMPACT_LOOK.slash;
    this._audioAt(t);
    // le scintille schizzano via nella direzione del colpo, non a palla
    const dir = _v3b.set(t.root.position.x - a.root.position.x, 0.45, t.root.position.z - a.root.position.z).normalize();
    const n = Math.round(look.sparks * (crit ? 1.7 : 1) * (heavy ? 1.25 : 1));
    this.particles.burst({ position: p, color: crit ? 0xffffff : look.spark, count: n, speed: look.speed * (crit ? 1.45 : 1) * t.height, life: 0.55, size: 0.022 * t.height, gravity: 1.6 * t.height, up: 0.5, dir, cone: look.cone });
    this.particles.burst({ position: p, color: look.debris, count: Math.round(n * 0.45), speed: look.speed * 0.7 * t.height, life: 0.75, size: 0.018 * t.height, gravity: 2.0 * t.height, up: 0.3, dir, cone: Math.min(0.9, look.cone + 0.12) });
    // il lampo dove la lama tocca, e il segno del taglio orientato come il colpo
    this.combatFx.impactFlash(p.clone(), t.height, { color: look.flash, scale: (crit ? 1.5 : 1) * (heavy ? 1.3 : 1) });
    if (look.mark && !(move && move.hits > 1)) {
      this.combatFx.slashMark(p.clone(), t.height, a.yaw + (Math.random() < 0.5 ? -0.5 : 0.5), { color: look.flash, scale: crit ? 1.3 : 1 });
    }
    if (kind === 'blunt' || heavy) this.combatFx.dust(t.root.position.clone(), t.height, heavy ? 8 : 5);
    if (heavy) this.sfx.impactHeavy(kind); else this.sfx.hit(crit ? 1.45 : this._r(0.85, 1.12), kind);
    // le raffiche (Danza dei Trampolieri) non si fermano a ogni colpo: sarebbe una melma
    if (!move || !move.hits || move.hits <= 1) this.freeze(crit ? 0.09 : Math.min(0.06, 0.02 * weight));
    this.addShake(crit ? 0.05 : 0.02 * weight, t.height, { x: dir.x, z: dir.z });
    this.emit('hit', { attacker: a, target: t, damage: dmg, crit, move });
  }

  _r(a, b) { return a + Math.random() * (b - a); }

  /**
   * Prepara il prossimo suono come proveniente da questo boss: pan stereo e
   * volume secondo dove si trova rispetto a chi guarda.
   */
  _audioAt(boss) {
    _v3c.copy(boss.root.position).add(_v3d.set(0, 0.6 * boss.height, 0));
    this.toWorld(_v3c);
    this.sfx.at(_v3c, this.activeCamera(), boss.height);
  }

  /**
   * Dove la lama tocca davvero: punto del segmento impugnatura→punta più vicino
   * al petto della vittima, riportato dentro la sagoma del corpo. Le scintille
   * partono da lì e non dal centro del torace.
   */
  _impactPoint(a, t, out) {
    const chest = t.chestPosition(_v3d);
    if (!a.sampleWeapon(_wa, _wb)) return out.copy(chest);
    const ax = _wb.x - _wa.x, ay = _wb.y - _wa.y, az = _wb.z - _wa.z;
    const len2 = ax * ax + ay * ay + az * az;
    let k = len2 > 1e-9 ? ((chest.x - _wa.x) * ax + (chest.y - _wa.y) * ay + (chest.z - _wa.z) * az) / len2 : 0;
    k = clamp(k, 0, 1);
    out.set(_wa.x + ax * k, _wa.y + ay * k, _wa.z + az * k);
    const r = Math.max(0.05, t.bodyRadius * t.height * 1.2);
    const d = out.distanceTo(chest);
    if (d > r) out.lerp(chest, (d - r) / d);
    // mai sotto i piedi né sopra la testa
    out.y = clamp(out.y, t.root.position.y + 0.1 * t.height, t.root.position.y + 0.95 * t.height);
    return out;
  }

  /** Finta: il colpo parte e si spegne. Resta il fruscio a vuoto e un piede che raspa. */
  _onFeint(a, t, move) {
    this._audioAt(a);
    this.sfx.swing('light', 1.7);
    this.combatFx.dust(a.root.position.clone(), a.height, 3);
    this.emit('feint', { boss: a, move });
  }

  /** Atterramento: il corpo colpisce il tavolo, polvere e tonfo. */
  _onKnockdown(victim, attacker, move) {
    const h = victim.height;
    this._audioAt(victim);
    this.sfx.bodyFall();
    this.freeze(0.1);
    this.addShake(0.07, h);
    this.combatFx.dust(victim.root.position.clone(), h, 16);
    this.combatFx.shockwave(victim.root.position.clone(), h, { color: 0xbba07a, radius: 0.9, life: 0.45 });
    this.emit('knockdown', { victim, attacker, move });
  }

  /**
   * Chi viene spinto indietro non scivola in silenzio: i piedi raspano e
   * alzano polvere finché la spinta non si esaurisce.
   */
  _skidDust(boss, dt) {
    const v = Math.hypot(boss.vel.x, boss.vel.z);
    if (!boss.root.visible || v < 0.2 * boss.height) { boss._skid = 0; return; }
    boss._skid = (boss._skid || 0) + v * dt;
    if (boss._skid < 0.05 * boss.height) return;
    boss._skid = 0;
    this.combatFx.dust(boss.root.position.clone(), boss.height, 4);
  }

  /**
   * Passo: la polvere che si alza sotto il piede e il rumore sordo. È un
   * dettaglio piccolo, ma è quello che àncora un corpo al pavimento.
   */
  _footstep(boss) {
    const h = boss.height;
    _v3.copy(boss.root.position).add(_v3b.set(
      Math.cos(boss.yaw) * boss.animator.footfall * 0.12 * h,
      0.01 * h,
      -Math.sin(boss.yaw) * boss.animator.footfall * 0.12 * h,
    ));
    this.particles.burst({ position: _v3, color: 0xb8a284, count: 5, speed: 0.16 * h, life: 0.5, size: 0.018 * h, gravity: 0.25 * h, up: 0.65, spread: 1.2 });
    this._audioAt(boss);
    this.sfx.footstep(Math.min(2, 0.6 + h));
  }

  /** Inizio mossa: telegrafo a terra e aura per le speciali. */
  _onMoveStart(a, t, move) {
    if (move.kind === 'evade') { this.sfx.step(); return; }
    const h = a.height;
    // la scia prende il colore della mossa: rosso marcio per Malenia, viola
    // gravitazionale per Radahn, oro per il resto
    if (move.impact === 'rot') a.trail.setColor(0xff6a55, 0x8e2b2b);
    else if (move.impact === 'magic') a.trail.setColor(0xd8a2ff, 0x6c3ea8);
    else a.trail.setColor(a.def.trailColor || 0xfff3d2, a.def.trailEdge || 0xffb347);
    const timing = a.fight.timing;
    const windup = (timing && timing.windup) || move.windup;
    if (move.telegraph === 'rise' || move.kind === 'special') {
      this.combatFx.chargeAura(a, { color: move.rot ? 0xc0392b : 0xffd166, life: Math.max(0.4, windup) });
      this._audioAt(a);
      this.sfx.telegraph();
    } else if (timing && timing.hold) {
      // colpo trattenuto: l'aura dice che sta per arrivare, ma non quando
      this.combatFx.chargeAura(a, { color: 0xffe0a0, life: windup * 0.95 });
      this._audioAt(a);
      this.sfx.telegraph();
    }
    if (move.aoe && move.aoe > 1.2) {
      const center = move.kind === 'special' && move.id === 'meteor' ? t.root.position : a.root.position;
      this.combatFx.telegraph(center.clone(), h, { radius: move.aoe, life: windup, color: move.rot ? 0xc0392b : 0xff5a3c });
    }
    this.emit('move', { boss: a, move });
  }

  _onTelegraph() { /* il telegrafo è già mostrato all'inizio della mossa */ }

  /**
   * Come va disegnato l'arco della lama per il movimento di questa esecuzione:
   * una risalita non lascia lo stesso segno di un diagonale, e un colpo
   * specchiato corre nel verso opposto.
   */
  _arcFor(a, extra = {}) {
    const BY_MOTION = {
      slashRise: { tilt: -0.5, rise: -0.06 },
      slashDiag: { tilt: 0.85, yawOffset: -0.5 },
      uppercut: { tilt: -1.0, rise: -0.1, thin: true },
      doubleCleave: { tilt: 0.3 },
      stomp: { tilt: 1.1, rise: -0.3, wide: true },
      kick: { tilt: 0.7, rise: -0.18, thin: true },
      reverseSpin: { flip: -1, wide: true },
    };
    const base = BY_MOTION[a.fight.motion] || {};
    // `extra.flip` è un moltiplicatore: -1 chiede il verso opposto
    const flip = (base.flip || 1) * (extra.flip || 1) * (a.fight.mirror ? -1 : 1);
    return { ...base, ...extra, flip };
  }

  /** La mossa entra nella finestra attiva: effetto e suono. */
  _onActive(a, t, move) {
    const h = a.height;
    switch (move.vfx) {
      case 'arc': this.combatFx.slashArc(a, this._arcFor(a)); break;
      case 'arcWide': this.combatFx.slashArc(a, this._arcFor(a, { wide: true })); break;
      case 'arcThin': this.combatFx.slashArc(a, this._arcFor(a, { thin: true, color: 0xfff6d8 })); break;
      case 'thrust': this.combatFx.thrustBeam(a, {}); break;
      case 'shockwave':
        this.combatFx.shockwave(a.root.position.clone(), h, { radius: move.aoe || 1.6 });
        this.addShake(0.05, h);
        break;
      case 'flurry': this._flurryTimer = 0; break;
      case 'aeonia':
        this.combatFx.aeonia(a.root.position.clone(), h);
        this.addShake(0.11, h);
        this.freeze(0.12);
        break;
      case 'gravity': this.combatFx.gravity(a.chestPosition(_v3).clone(), t.chestPosition(_v3b).clone(), t.height); break;
      case 'meteor':
        this.combatFx.meteor(t.root.position.clone(), h, { onImpact: () => { this.addShake(0.16, h); this.freeze(0.14); } });
        break;
      case 'lightHammer':
        this.combatFx.lightHammer(t.root.position.clone(), h, {});
        this.addShake(0.07, h);
        break;
      case 'dustTrail': this.combatFx.dust(a.root.position.clone(), h, 10); break;
      default: break;
    }
    this._audioAt(a);
    if (typeof move.sfx === 'string' && move.sfx.startsWith('swing')) {
      // il fruscio segue la velocità vera di questa esecuzione, non quella scritta
      const dur = (a.fight.timing && a.fight.timing.active) || move.active || 0.2;
      this.sfx.swing(move.swing || 'light', Math.max(0.55, Math.min(1.9, 0.22 / dur)));
    } else {
      const sound = this.sfx[move.sfx];
      if (typeof sound === 'function') sound.call(this.sfx, move.impact);
    }
    // il doppio taglio lascia due segni, uno per ogni verso
    if (a.fight.motion === 'doubleCleave' && move.vfx && move.vfx.startsWith('arc')) {
      const active = (a.fight.timing && a.fight.timing.active) || move.active || 0.16;
      setTimeout(() => {
        if (!a.alive) return;
        this.combatFx.slashArc(a, this._arcFor(a, { thin: true, flip: -1, color: 0xfff6d8 }));
        this._audioAt(a);
        this.sfx.swing('light', 1.5);
      }, (active * 520) / Math.max(0.05, this.timeScale));
    }
    if (move.vfx === 'flurry') {
      // la raffica emette scie ripetute per tutta la durata attiva
      const n = move.hits || 8;
      const active = (a.fight.timing && a.fight.timing.active) || move.active;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (!a.alive) return;
          this.combatFx.flurry(a, {});
          // ogni colpo della raffica ha il suo fruscio: un rumore solo non basta
          if (i % 2 === 0) { this._audioAt(a); this.sfx.swing('light', this._r(1.3, 1.8)); }
        }, (i * active * 1000) / n / Math.max(0.05, this.timeScale));
      }
    }
  }

  _onProjectile(a, t, move) {
    const from = a.chestPosition(_v3).clone();
    const to = t.chestPosition(_v3b).clone();
    const speed = move.projectileSpeed || 5;
    this.combatFx.projectile(from, to, a.height, { color: 0xffd166, speed });
    return from.distanceTo(to) / (speed * a.height);
  }

  /** Morte di un boss: rune dorate che salgono, rallentatore e colpo al tavolo. */
  _onDeath(victim, killer) {
    const h = victim.height;
    const p = victim.chestPosition(_v3).clone();
    this._audioAt(victim);
    this.sfx.death();
    this.freeze(0.12);
    this.addShake(0.06, h);
    const lastOne = this.bosses.filter((b) => b.alive).length <= 1;
    this.slowMotion(lastOne ? 0.3 : 0.55, lastOne ? 1.6 : 0.7);
    // le rune: scie dorate che salgono lente, come quando un nemico cade nel gioco
    this.particles.burst({ position: p, color: 0xffd166, count: 70, speed: 0.35 * h, life: 2.2, size: 0.03 * h, gravity: -0.55 * h, up: 1.0, spread: 0.8 });
    this.particles.burst({ position: p, color: 0xfff3d0, count: 30, speed: 0.6 * h, life: 1.6, size: 0.022 * h, gravity: -0.35 * h, up: 1.2 });
    this.particles.burst({ position: p, color: STYLES.spirit.tint.getHex(), count: 40, speed: 0.9 * h, life: 1.2, size: 0.03 * h, gravity: -0.2 * h, up: 0.8 });
    this.combatFx.shockwave(victim.root.position.clone(), h, { color: 0xffd166, radius: 1.4, life: 0.9 });
    this.emit('kill', { victim, killer });
  }

  _onPhase2(boss, name) {
    this.combatFx.phaseBurst(boss);
    this._audioAt(boss);
    this.sfx.roar();
    this.freeze(0.16);
    this.addShake(0.09, boss.height);
    this.slowMotion(0.5, 0.9);
    this.emit('phase2', { boss, name });
  }

  _onVictory(winner) {
    this.emit('fight', false);
    this.emit('victory', winner);
    if (!winner) return;
    this._audioAt(winner);
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
        const worldY = this.toWorld(_v3.copy(this.dragging.root.position)).y;
        const p = this.mode.groundPointFromScreen(x, y, worldY);
        if (p) {
          this.toArena(p);
          this.dragging.root.position.x = p.x;
          this.dragging.root.position.z = p.z;
        }
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
