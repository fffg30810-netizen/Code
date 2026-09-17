// Entità boss: modello normalizzato (altezza 1 = 1 unità, poi root.scale = altezza in metri),
// animazioni, statistiche, barra vita, stile (realistico / ologramma) ed effetti di evocazione.
import * as THREE from 'three';
import { HPBar } from '../fx/HPBar.js';
import { ClipAnimator, RigidAnimator } from './Animator.js';
import { SkeletalAnimator } from './SkeletalAnimator.js';
import { autoRig } from './AutoRig.js';
import { createHologramUniforms, makeHologramMaterial, STYLES } from '../fx/HologramMaterial.js';
import { ContactShadow } from '../fx/ContactShadow.js';
import { applyCameraMatch, createMatchUniforms } from '../fx/CameraMatch.js';
import { WeaponTrail } from '../fx/WeaponTrail.js';
import { clamp } from '../util/math.js';

let nextUid = 1;
const _w1 = new THREE.Vector3();
const _w2 = new THREE.Vector3();
const _w3 = new THREE.Vector3();
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _s3 = new THREE.Vector3();

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

    // I modelli generati da immagine sono mesh statiche: qui vengono riggati al volo
    // (scheletro dedotto dalla forma, pesi per vertice) così muovono braccia, gambe
    // e testa invece di scivolare rigidi.
    this.rig = null;
    let alreadySkinned = false;
    object.traverse((o) => { if (o.isSkinnedMesh) alreadySkinned = true; });
    if (alreadySkinned) {
      // già riggato dal caricatore (o dal file glTF): raccogli le ossa per nome
      const bones = {};
      object.traverse((o) => { if (o.isBone && o.name) bones[o.name] = o; });
      if (bones.Hips && bones.Chest && (bones.ArmR || bones.ArmL)) this.rig = { bones };
    } else if (!clips.length && def.autoRig !== false) {
      try {
        this.rig = autoRig(object);
      } catch (e) {
        console.warn(`[Boss] rigging automatico non riuscito per ${def.id}:`, e && e.message);
        this.rig = null;
      }
    }
    this._normalize();

    // Materiali: originali + ologramma (creati pigramente, uniform condivise per boss)
    this.meshes = [];
    this.originalMaterials = new Map();
    this.holoMaterials = new Map();
    this.holoUniforms = createHologramUniforms();
    this.matchUniforms = createMatchUniforms();
    object.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        this.meshes.push(o);
        this.originalMaterials.set(o, o.material);
        o.castShadow = true;
        // e ricevono: in uno scontro l'ombra di un boss cade sull'altro
        o.receiveShadow = true;
        o.frustumCulled = false;
        // I modelli generati da immagine hanno spesso normali sottili o facce singole:
        // renderizzarli a doppia faccia evita buchi visibili da dietro.
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          if (m.side === THREE.FrontSide && !m.transparent) m.side = THREE.DoubleSide;
          applyCameraMatch(m, this.matchUniforms);
        }
      }
    });

    // Animazioni: se il GLB ha le sue clip usiamo il mixer, altrimenti (mesh statica
    // generata da immagine) animiamo il corpo rigido con pose sintetiche.
    this.clips = clips;
    const resolved = resolveClips(def, defaults, clips);
    const hasUsableClips = !!(resolved.idle && (resolved.attack.length || resolved.walk));
    if (hasUsableClips) this.animator = new ClipAnimator(object, resolved);
    else if (this.rig) this.animator = new SkeletalAnimator(this.inner, this.rig.bones);
    else this.animator = new RigidAnimator(this.inner);
    this.rigid = !hasUsableClips;
    this.skeletal = !!this.animator.skeletal;

    // Statistiche (baseStats serve a ripristinarle dopo il potenziamento di fase 2)
    this.baseStats = { hp: 100, attack: 10, speed: 0.5, range: 0.5, cooldown: 1.5, ...(def.stats || {}) };
    this.stats = { ...this.baseStats };
    this.moveset = null;
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

    // Ombra di contatto: la macchia morbida sotto i piedi. È quella che convince
    // l'occhio che il boss poggia sul tavolo e non galleggia sopra l'immagine.
    this.contact = new ContactShadow(clamp(this.bodyRadius * 1.55, 0.26, 0.6));
    this.root.add(this.contact.mesh);

    // Scia dell'arma: vive nell'arena (non nel boss), così resta dove la lama è
    // passata mentre il corpo prosegue il movimento.
    this.trail = new WeaponTrail({ color: def.trailColor || 0xfff3d2, edgeColor: def.trailEdge || 0xffb347 });
    this.weaponLength = def.weaponLength != null ? def.weaponLength : 0.62;
    this.handBone = (this.rig && (this.rig.bones.HandR || this.rig.bones.ForearmR)) || null;
    this.elbowBone = (this.rig && (this.rig.bones.ForearmR || this.rig.bones.ArmR)) || null;
    if (this.handBone === this.elbowBone) this.elbowBone = (this.rig && this.rig.bones.ArmR) || null;
    this._socket = this._makeSocket();

    // Spinta: il contraccolpo dei colpi pesanti, smorzato dall'attrito
    this.vel = new THREE.Vector3();
    this._skid = 0;        // strada percorsa scivolando, per dosare la polvere
    this.shadowStrength = 1;

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

  /**
   * Punti (impugnatura, punta) dell'arma quando non c'è scheletro: si esprimono
   * in unità normalizzate e si riportano nello spazio del modello, così seguono
   * il movimento d'insieme che l'animatore applica a `inner`.
   */
  _makeSocket() {
    const base = this.animator && this.animator.base;
    if (!base) return null;
    const s = base.scale.x || 1;
    const toModel = (x, y, z) => new THREE.Vector3(x, y, z).sub(base.position).divideScalar(s);
    return { hilt: toModel(0.19, 0.6, 0.24), tip: toModel(0.24, 0.62, 0.24 + this.weaponLength) };
  }

  /**
   * Posizione di impugnatura e punta dell'arma, in coordinate dell'arena.
   * Con lo scheletro segue davvero la mano; senza, segue il corpo.
   * @returns {boolean} true se i punti sono validi
   */
  sampleWeapon(outHilt, outTip) {
    const parent = this.root.parent;
    if (!parent) return false;
    if (this.handBone && this.elbowBone) {
      // scratch dedicati: outHilt/outTip possono essere gli stessi _w1.._w3 del chiamante
      this.root.updateMatrixWorld(true);
      _s1.setFromMatrixPosition(this.handBone.matrixWorld);
      _s2.setFromMatrixPosition(this.elbowBone.matrixWorld);
      _s3.subVectors(_s1, _s2);
      if (_s3.lengthSq() < 1e-10) _s3.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      _s3.normalize().multiplyScalar(this.weaponLength * this.height);
      outHilt.copy(_s1);
      outTip.copy(_s1).add(_s3);
    } else if (this._socket) {
      this.inner.updateMatrixWorld(true);
      outHilt.copy(this._socket.hilt).applyMatrix4(this.inner.matrixWorld);
      outTip.copy(this._socket.tip).applyMatrix4(this.inner.matrixWorld);
    } else {
      this.root.updateMatrixWorld(true);
      outHilt.set(0.19, 0.6, 0.24).applyMatrix4(this.root.matrixWorld);
      outTip.set(0.24, 0.62, 0.24 + this.weaponLength).applyMatrix4(this.root.matrixWorld);
    }
    parent.worldToLocal(outHilt);
    parent.worldToLocal(outTip);
    return true;
  }

  // ----- dimensioni / trasformazioni -----
  get height() { return this.root.scale.x; }
  setHeight(m) { this.root.scale.setScalar(clamp(m, 0.02, 50)); }
  get position() { return this.root.position; }
  get yaw() { return this.root.rotation.y; }
  set yaw(v) { this.root.rotation.y = v; }

  /**
   * Altezza del petto, in coordinate dell'arena (come `root.position`): effetti e
   * particelle vivono nell'arena, così restano incollati al tavolo anche in AR.
   */
  chestPosition(out = new THREE.Vector3()) {
    return out.copy(this.root.position).add(_w1.set(0, 0.62 * this.height, 0));
  }

  /** Spinta orizzontale (contraccolpo): direzione in coordinate arena, forza in metri/s. */
  applyImpulse(dx, dz, strength) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-6 || !(strength > 0)) return;
    this.vel.x += (dx / d) * strength;
    this.vel.z += (dz / d) * strength;
    const max = 3.2 * this.height;
    const v = Math.hypot(this.vel.x, this.vel.z);
    if (v > max) { this.vel.x *= max / v; this.vel.z *= max / v; }
  }

  /**
   * Reazione al colpo, orientata: calcola da dove arriva il fendente rispetto
   * al corpo e passa la direzione all'animatore.
   */
  hitFrom(attackerPosition, anim = 'hit') {
    const dx = this.root.position.x - attackerPosition.x;
    const dz = this.root.position.z - attackerPosition.z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;                     // verso in cui spinge il colpo
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    if (this.animator.setHitDir) this.animator.setHitDir(ux * sy + uz * cy, ux * cy - uz * sy);
    if (anim) this.play(anim, { loop: false, fade: 0.05 });
    return { x: ux, z: uz };
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

  /** Esegue una mossa con i tempi decisi dal combattimento. */
  playMove(motion, timing) { return this.animator.playMove(motion, timing); }

  /** Fase corrente dell'animazione di mossa: 'windup' | 'active' | 'recovery' | null */
  get movePhase() { return this.animator.movePhase; }

  /** Fa girare la testa verso un punto (coordinate arena). */
  lookAt(point) {
    if (!this.animator.setLook) return;
    const dx = point.x - this.root.position.x;
    const dz = point.z - this.root.position.z;
    if (dx * dx + dz * dz < 1e-8) { this.animator.setLook(0); return; }
    let delta = Math.atan2(dx, dz) - this.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.animator.setLook(delta);
  }

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
    this.stats = { ...this.baseStats };
    this.vel.set(0, 0, 0);
    this._skid = 0;
    this.trail.clear();
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
    this.matchUniforms.uTime.value = time;

    // contraccolpo: scivolata smorzata, mai una scivolata infinita
    if (this.vel.x || this.vel.z) {
      this.root.position.x += this.vel.x * dt;
      this.root.position.z += this.vel.z * dt;
      const damp = Math.exp(-8.5 * dt);
      this.vel.x *= damp; this.vel.z *= damp;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.z) < 1e-4 * this.height) this.vel.set(0, 0, 0);
    }

    // ombra di contatto: si allarga e schiarisce quando il corpo si stacca da terra
    this.contact.mesh.visible = this.root.visible && this.reveal > 0.15;
    if (this.contact.mesh.visible) {
      // l'ombra sta sotto il corpo, non sotto il punto d'appoggio: se il boss
      // affonda in avanti o cade all'indietro, la macchia lo segue
      const off = this.animator.bodyOffset;
      if (off) this.contact.mesh.position.set(off.x, 0.0015, off.z);
      this.contact.update(this.animator.lift || 0, this.shadowStrength || 1);
    }

    // scia dell'arma
    if (this.trail.emitting) {
      if (this.sampleWeapon(_w2, _w3)) this.trail.push(_w2, _w3);
    }
    this.trail.update(dt);

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
    this.contact.dispose();
    this.trail.dispose();
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
