// Due modi di animare un boss:
//
//  - ClipAnimator: il GLB ha già le sue clip (o sono quelle del segnaposto procedurale) →
//    normale AnimationMixer di three.js.
//  - RigidAnimator: il modello è una mesh statica senza scheletro (è il caso dei GLB generati
//    da immagine con image-to-3D). Anima l'intero corpo come un corpo rigido: respiro, passo
//    ondeggiante, affondo, spazzata rotante, contraccolpo, caduta. A 20 cm sul tavolo l'effetto
//    è convincente e non richiede alcun rig.
//
// Entrambi espongono la stessa interfaccia:
//    has(name) -> bool
//    play(name, { loop, fade, timeScale }) -> { name, duration } | null
//    update(dt)
//    stop()
import * as THREE from 'three';

const _e = new THREE.Euler();

// ---------------------------------------------------------------------------
export class ClipAnimator {
  constructor(object, resolved) {
    this.mixer = new THREE.AnimationMixer(object);
    const mk = (clip) => (clip ? this.mixer.clipAction(clip) : null);
    this.actions = {
      idle: mk(resolved.idle),
      walk: mk(resolved.walk),
      attack: resolved.attack.map(mk).filter(Boolean),
      hit: mk(resolved.hit),
      death: mk(resolved.death),
      victory: mk(resolved.victory),
    };
    this.current = null;
    this.rigid = false;
  }

  has(name) {
    const a = this.actions[name];
    return name === 'attack' ? this.actions.attack.length > 0 : !!a;
  }

  play(name, { fade = 0.2, loop = true, timeScale = 1 } = {}) {
    let action = null;
    if (name === 'attack') {
      const list = this.actions.attack;
      action = list.length ? list[Math.floor(Math.random() * list.length)] : null;
    } else {
      action = this.actions[name] || null;
    }
    if (!action) return null;
    const clip = action.getClip();
    if (this.current === action && loop && action.isRunning()) return { name: clip.name, duration: clip.duration };

    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.play();
    if (this.current && this.current !== action && fade > 0) this.current.crossFadeTo(action, fade, false);
    else if (fade > 0) action.fadeIn(fade);
    this.current = action;
    return { name: clip.name, duration: clip.duration / (timeScale || 1) };
  }

  update(dt) { this.mixer.update(dt); }
  stop() { this.mixer.stopAllAction(); }
}

// ---------------------------------------------------------------------------
// Pose sintetiche per mesh statiche. Tutti i valori sono in unità normalizzate
// (altezza del modello = 1) e vengono applicati al nodo `target`.
// Ogni animazione è una funzione t (0..1 del ciclo) -> { y, z, x, pitch, roll, yaw, squash }
const ANIMS = {
  idle: {
    duration: 3.0, loop: true,
    pose: (t) => {
      const a = Math.sin(t * Math.PI * 2);
      const b = Math.sin(t * Math.PI * 4);
      return { y: a * 0.006, z: 0, x: a * 0.004, pitch: a * 0.012, roll: b * 0.006, yaw: a * 0.02, squash: 1 - a * 0.006 };
    },
  },
  walk: {
    duration: 0.9, loop: true,
    pose: (t) => {
      const step = Math.sin(t * Math.PI * 4);     // due passi per ciclo
      const sway = Math.sin(t * Math.PI * 2);
      return { y: Math.abs(step) * 0.022, z: 0, x: sway * 0.02, pitch: 0.07 + Math.abs(step) * 0.02, roll: -sway * 0.06, yaw: sway * 0.05, squash: 1 - Math.abs(step) * 0.015 };
    },
  },
  // Affondo dall'alto: carica indietro, scatta avanti, ritorna. Impatto a t≈0.45.
  attack1: {
    duration: 1.0, loop: false, hitTime: 0.45,
    pose: (t) => {
      let z = 0, pitch = 0, y = 0;
      if (t < 0.32) { const k = t / 0.32; z = -0.13 * k; pitch = -0.30 * k; y = 0.02 * k; }
      else if (t < 0.5) { const k = (t - 0.32) / 0.18; z = -0.13 + 0.42 * k; pitch = -0.30 + 0.78 * k; y = 0.02 - 0.05 * k; }
      else { const k = (t - 0.5) / 0.5; const e = 1 - Math.pow(1 - k, 2); z = 0.29 * (1 - e); pitch = 0.48 * (1 - e); y = -0.03 * (1 - e); }
      return { y, z, x: 0, pitch, roll: 0, yaw: 0, squash: 1 + pitch * 0.05 };
    },
  },
  // Spazzata rotante: giro completo su sé stesso con passo avanti. Impatto a t≈0.5.
  attack2: {
    duration: 1.2, loop: false, hitTime: 0.5,
    pose: (t) => {
      const spin = t < 0.15 ? -0.5 * (t / 0.15) : t < 0.8 ? -0.5 + (Math.PI * 2 + 0.5) * ((t - 0.15) / 0.65) : Math.PI * 2;
      const lean = Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.16;
      const z = Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.18;
      return { y: lean * 0.06, z, x: 0, pitch: lean * 0.4, roll: lean * 0.5, yaw: spin, squash: 1 };
    },
  },
  hit: {
    duration: 0.45, loop: false,
    pose: (t) => {
      const k = Math.exp(-t * 7) * Math.cos(t * 26);
      return { y: 0, z: -0.09 * k, x: 0.02 * k, pitch: -0.28 * k, roll: 0.1 * k, yaw: 0, squash: 1 - 0.03 * k };
    },
  },
  // Caduta all'indietro: ruota di 90° attorno a X e si appoggia a terra.
  death: {
    duration: 1.7, loop: false,
    pose: (t) => {
      const k = Math.min(1, t / 0.8);
      const e = k * k * (3 - 2 * k);                        // smoothstep
      const bounce = t > 0.8 ? Math.exp(-(t - 0.8) * 9) * Math.sin((t - 0.8) * 30) * 0.05 : 0;
      return { y: -0.5 * e, z: -0.33 * e, x: 0.03 * e, pitch: -(Math.PI / 2) * e + bounce, roll: 0.1 * e, yaw: 0.12 * e, squash: 1 };
    },
  },
  victory: {
    duration: 2.2, loop: false,
    pose: (t) => {
      const rise = Math.sin(Math.min(1, t / 0.45) * Math.PI * 0.5);
      const hold = t > 0.45 && t < 0.8 ? 1 : t <= 0.45 ? rise : Math.max(0, 1 - (t - 0.8) / 0.4);
      const wob = Math.sin(t * Math.PI * 5) * 0.02;
      return { y: 0.05 * hold, z: 0, x: 0, pitch: -0.12 * hold, roll: wob * hold, yaw: 0, squash: 1 + 0.02 * hold };
    },
  },
};

export class RigidAnimator {
  /** @param {THREE.Object3D} target nodo da animare (unità normalizzate, altezza 1) */
  constructor(target) {
    this.target = target;
    this.rigid = true;
    this.base = { position: target.position.clone(), quaternion: target.quaternion.clone(), scale: target.scale.clone() };
    this.state = null;       // { key, anim, time, loop, timeScale }
    this.blend = { from: null, t: 0, dur: 0 };
    this.attackIndex = 0;
    this._pose = { y: 0, z: 0, x: 0, pitch: 0, roll: 0, yaw: 0, squash: 1 };
  }

  has() { return true; } // sa animare tutto: le pose sono sintetiche

  _key(name) {
    if (name !== 'attack') return name;
    this.attackIndex = (this.attackIndex + 1) % 2;
    return this.attackIndex === 0 ? 'attack1' : 'attack2';
  }

  play(name, { fade = 0.2, loop = true, timeScale = 1 } = {}) {
    const key = this._key(name);
    const anim = ANIMS[key] || ANIMS.idle;
    if (this.state && this.state.key === key && anim.loop && loop) {
      return { name: key, duration: anim.duration / (timeScale || 1) };
    }
    if (this.state && fade > 0) {
      this.blend.from = { ...this._pose };
      this.blend.t = 0;
      this.blend.dur = fade;
    } else {
      this.blend.from = null;
    }
    this.state = { key, anim, time: 0, loop: loop && anim.loop !== false, timeScale: timeScale || 1 };
    return { name: key, duration: anim.duration / (timeScale || 1) };
  }

  update(dt) {
    const s = this.state;
    if (!s) return;
    s.time += dt * s.timeScale;
    const d = s.anim.duration;
    let t = s.time / d;
    if (t >= 1) {
      if (s.loop || s.anim.loop) { s.time %= d; t = s.time / d; }
      else t = 1;
    }
    let p = s.anim.pose(t);
    if (this.blend.from && this.blend.dur > 0) {
      this.blend.t += dt;
      const k = Math.min(1, this.blend.t / this.blend.dur);
      const f = this.blend.from;
      p = {
        y: f.y + (p.y - f.y) * k, z: f.z + (p.z - f.z) * k, x: f.x + (p.x - f.x) * k,
        pitch: f.pitch + (p.pitch - f.pitch) * k, roll: f.roll + (p.roll - f.roll) * k,
        yaw: f.yaw + (p.yaw - f.yaw) * k, squash: f.squash + (p.squash - f.squash) * k,
      };
      if (k >= 1) this.blend.from = null;
    }
    this._pose = p;
    const { base, target } = this;
    target.position.set(base.position.x + p.x, base.position.y + p.y, base.position.z + p.z);
    target.quaternion.copy(base.quaternion).multiply(_q.setFromEuler(_e.set(p.pitch, p.yaw, p.roll, 'YXZ')));
    target.scale.set(base.scale.x * (2 - p.squash), base.scale.y * p.squash, base.scale.z * (2 - p.squash));
  }

  stop() {
    this.state = null;
    this.blend.from = null;
    this.target.position.copy(this.base.position);
    this.target.quaternion.copy(this.base.quaternion);
    this.target.scale.copy(this.base.scale);
  }

  /** Frazione della clip in cui il colpo connette (usata dal sistema di combattimento). */
  static hitTimeFor(key) { return (ANIMS[key] && ANIMS[key].hitTime) || 0.45; }
}
const _q = new THREE.Quaternion();
