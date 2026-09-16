// Entità boss: modello normalizzato (altezza 1 = 1 unità, poi root.scale = altezza in metri),
// animazioni, statistiche, barra vita, stile (realistico / ologramma) ed effetti di evocazione.
import * as THREE from 'three';
import { HPBar } from '../fx/HPBar.js';
import { ClipAnimator, RigidAnimator } from './Animator.js';
import { createHologramUniforms, makeHologramMaterial, STYLES } from '../fx/HologramMaterial.js';
import { clamp } from '../util/math.js';

let nextUid = 1;

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function findClip(clips, names, regex) {
  for (const n of names) {
    const c = clips.find((c) => c.name === n || c.name.toLowerCase() === String(n).toLowerCase());
    if (c) return c;
  }
  if (regex) return clips.find((c) => regex.test(c.name)) || null;
  return null;
}

export function resolveClips(def, defaults, clips) {
  const names = { ...(defaults?.clips || {}), ...(def.clips || {}) };
  const idle = findClip(clips, toArray(names.idle), /idle|breath|stand/i) || clips[0] || null;
  const walk = findClip(clips, toArray(names.walk), /walk|run|move|locomot/i) || idle;
  let attack = toArray(names.attack).map((n) => findClip(clips, [n])).filter(Boolean);
  if (!attack.length) attack = clips.filter((c) => /attack|slash|swing|punch|strike|smash|stab|cast/i.test(c.name));
  if (!attack.length && idle) attack = [idle];
  const hit = findClip(clips, toArray(names.hit), /hit|react|impact|damage|hurt|stagger/i);
  const death = findClip(clips, toArray(names.death), /death|die|dying|dead|defeat/i);
  const victory = findClip(clips, toArray(names.victory || ['Victory']), /victory|cheer|taunt|roar/i);
  return { idle, walk, attack, hit, death, victory };
}

export class Boss {
  /**
   * @param {object} p
   * @param {object} p.def          voce del manifest
   * @param {object} p.defaults     sezione `defaults` del manifest
   * @param {THREE.Object3D} p.object modello (già clonato/istanziato)
   * @param {THREE.AnimationClip[]} p.clips
   * @param {Record<string,number>} [p.hitTimes]  frazione della clip in cui il colpo "connette"
   * @param {boolean} [p.procedural]
   */
  constructor({ def, defaults = {}, object, clips = [], hitTimes = {}, procedural = false }) {
    this.uid = nextUid++;
    this.def = def;
    this.defaults = defaults;
    this.name = def.short || def.name;
    this.procedural = procedural;
    this.hitTimes = hitTimes;

    this.root = new THREE.Group();
    this.root.name = `Boss:${def.id}`;
    this.root.userData.boss = this;
    this.inner = new THREE.Group();
    this.inner.name = 'Normalized';
    this.model = object;
    this.inner.add(object);
    this.root.add(this.inner);
    this._normalize();

    // Materiali: originali + ologramma (creati pigramente, uniform condivise per boss)
    this.meshes = [];
    this.originalMaterials = new Map();
    this.holoMaterials = new Map();
    this.holoUniforms = createHologramUniforms();
    object.traverse((o) => {
      if (o.isMesh) {
        this.meshes.push(o);
        this.originalMaterials.set(o, o.material);
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });

    // Animazioni: se il GLB ha le sue clip usiamo il mixer, altrimenti (mesh statica
    // generata da immagine) animiamo il corpo rigido con pose sintetiche.
    this.clips = clips;
    const resolved = resolveClips(def, defaults, clips);
    const hasUsableClips = !!(resolved.idle && (resolved.attack.length || resolved.walk));
    this.animator = hasUsableClips ? new ClipAnimator(object, resolved) : new RigidAnimator(this.inner);
    this.rigid = !hasUsableClips;

    // Statistiche
    this.stats = { hp: 100, attack: 10, speed: 0.5, range: 0.5, cooldown: 1.5, ...(def.stats || {}) };
    this.maxHp = this.stats.hp;
    this.hp = this.maxHp;
    this.alive = true;
    this.fight = this._freshFightState();

    // Barra vita e anello di selezione (in unità normalizzate: seguono la scala del boss)
    this.hpBar = new HPBar(this.name, def.color || '#d9b654');
    this.hpBar.sprite.raycast = () => {}; // non intercettare i tocchi
    this.root.add(this.hpBar.sprite);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.33, 0.39, 48),
      new THREE.MeshBasicMaterial({ color: 0xd9b654, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.004;
    this.ring.visible = false;
    this.ring.name = 'SelectionRing';
    this.ring.raycast = () => {};
    this.root.add(this.ring);

    this.style = 'realistic';
    this.reveal = 1;
    this.revealTarget = 1;
    this.usingHolo = false;
    this.play('idle', { fade: 0 });
  }

  _freshFightState() {
    return { state: 'idle', target: null, cooldown: 0, attackTimer: 0, attackDuration: 1, hitTime: 0.45, hitApplied: false, staggerTimer: 0, deathTimer: 0 };
  }

  _normalize() {
    // Correzione per-boss dal manifest: `fix: { yaw, pitch, roll }` in gradi.
    // I modelli generati da immagine spesso guardano verso -Z o sono leggermente inclinati.
    const fix = this.def.fix;
    if (fix) {
      this.model.rotation.set(
        THREE.MathUtils.degToRad(fix.pitch || 0),
        THREE.MathUtils.degToRad(fix.yaw || 0),
        THREE.MathUtils.degToRad(fix.roll || 0),
        'YXZ',
      );
    }
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) { this.bodyRadius = 0.22; return; }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const h = Math.max(size.y, 1e-3);
    this.inner.scale.setScalar(1 / h);
    this.inner.position.set(-center.x / h, -box.min.y / h, -center.z / h);
    // raggio del corpo in "altezze" (per portata e separazione)
    this.bodyRadius = clamp((Math.max(size.x, size.z) / h) * 0.32, 0.12, 0.45);
  }

  // ----- dimensioni / trasformazioni -----
  get height() { return this.root.scale.x; }
  setHeight(m) { this.root.scale.setScalar(clamp(m, 0.02, 50)); }
  get position() { return this.root.position; }
  get yaw() { return this.root.rotation.y; }
  set yaw(v) { this.root.rotation.y = v; }

  chestPosition(out = new THREE.Vector3()) {
    return out.set(0, 0.62, 0).applyMatrix4(this.root.matrixWorld);
  }

  hitTimeFor(clipName) {
    if (this.rigid) return RigidAnimator.hitTimeFor(clipName);
    const ht = this.def.hitTime;
    if (typeof ht === 'number') return ht;
    if (ht && typeof ht === 'object' && ht[clipName] != null) return ht[clipName];
    if (this.hitTimes[clipName] != null) return this.hitTimes[clipName];
    return this.defaults.hitTime ?? 0.45;
  }

  /** @returns {boolean} true se esiste un'animazione con questo nome. */
  hasAnimation(name) { return this.animator.has(name); }

  // ----- animazioni -----
  /** @returns {{name: string, duration: number}|null} clip avviata */
  play(name, opts = {}) { return this.animator.play(name, opts); }

  // ----- stile / ologramma -----
  setStyle(style) {
    if (!STYLES[style]) style = 'realistic';
    this.style = style;
    if (style !== 'realistic') this.holoUniforms.uTint.value.copy(STYLES[style].tint);
    this._applyMaterials(style !== 'realistic' || this.reveal < 1);
  }

  _applyMaterials(useHolo) {
    for (const mesh of this.meshes) {
      if (useHolo) {
        let hm = this.holoMaterials.get(mesh);
        if (!hm) {
          const src = this.originalMaterials.get(mesh);
          hm = makeHologramMaterial(Array.isArray(src) ? src[0] : src, this.holoUniforms);
          this.holoMaterials.set(mesh, hm);
        }
        mesh.material = hm;
      } else {
        mesh.material = this.originalMaterials.get(mesh);
      }
    }
    this.usingHolo = useHolo;
  }

  /** Effetto evocazione: il boss si materializza dal basso verso l'alto. */
  summon() {
    this.root.visible = true;
    this.reveal = 0;
    this.revealTarget = 1;
    const tint = this.style === 'realistic' ? STYLES.gold.tint : STYLES[this.style].tint;
    this.holoUniforms.uTint.value.copy(tint);
    this._applyMaterials(true);
  }

  /** Dissolvenza dall'alto verso il basso (dopo la morte o alla rimozione). */
  dissolve() {
    if (this.revealTarget === 0) return;
    this.reveal = Math.min(this.reveal, 1);
    this.revealTarget = 0;
    const tint = this.style === 'realistic' ? STYLES.spirit.tint : STYLES[this.style].tint;
    this.holoUniforms.uTint.value.copy(tint);
    this._applyMaterials(true);
  }

  // ----- combattimento -----
  takeDamage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.hp, amount);
    this.hp -= dealt;
    this.hpBar.set(this.hp / this.maxHp);
    if (this.hp <= 0) this.die();
    return dealt;
  }

  die() {
    this.alive = false;
    this.fight.state = 'dead';
    this.fight.deathTimer = 0;
    this.hpBar.sprite.visible = false;
    if (this.hasAnimation('death')) this.play('death', { loop: false, fade: 0.15 });
    else this.play('idle');
  }

  resetFight() {
    this.hp = this.maxHp;
    this.alive = true;
    this.fight = this._freshFightState();
    this.root.visible = true;
    this.reveal = 1;
    this.revealTarget = 1;
    this._applyMaterials(this.style !== 'realistic');
    this.hpBar.set(1);
    this.hpBar.sprite.visible = false;
    this.play('idle', { fade: 0.1 });
  }

  setSelected(v) { this.ring.visible = v; }

  // ----- aggiornamento per frame -----
  update(dt, time) {
    this.animator.update(dt);
    const u = this.holoUniforms;
    u.uTime.value = time;

    if (!this.alive && this.fight.state === 'dead') {
      this.fight.deathTimer += dt;
      if (this.fight.deathTimer > 2.4) this.dissolve();
    }

    if (this.reveal !== this.revealTarget) {
      const dir = Math.sign(this.revealTarget - this.reveal);
      this.reveal = clamp(this.reveal + (dir * dt) / (dir > 0 ? 1.1 : 1.3), 0, 1);
      if (this.reveal >= 1 && this.style === 'realistic') this._applyMaterials(false);
      if (this.reveal <= 0) this.root.visible = false;
    }

    const h = this.height;
    u.uBaseY.value = this.root.position.y;
    u.uHeight.value = h;
    u.uRevealY.value = this.reveal >= 1 ? 1e6 : this.root.position.y + this.reveal * h * 1.04 - 0.002;
    u.uOpacity.value = this.style === 'spirit' ? 0.9 : 1;
  }

  dispose() {
    this.animator.stop();
    this.hpBar.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    for (const m of this.holoMaterials.values()) m.dispose();
    if (this.procedural) {
      for (const mesh of this.meshes) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m && m.dispose && m.dispose());
        const orig = this.originalMaterials.get(mesh);
        (Array.isArray(orig) ? orig : [orig]).forEach((m) => m && m.dispose && m.dispose());
      }
    }
    this.root.removeFromParent();
  }
}
