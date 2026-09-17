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
    this.hitDir = { f: -1, r: 0 };
    this.footfall = 0;
  }

  setHitDir(f, r) { const n = Math.hypot(f, r) || 1; this.hitDir.f = f / n; this.hitDir.r = r / n; }
  get lift() { return 0; }
  get bodyOffset() { return null; }

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

  /** I GLB riggati usano le loro clip: la mossa sceglie una clip d'attacco. */
  playMove(key, { windup = 0.4, active = 0.15, recovery = 0.4, fade = 0.1 } = {}) {
    const total = windup + active + recovery;
    const r = this.play('attack', { loop: false, fade });
    this._move = { key, time: 0, windup, active, recovery, total };
    return r ? { name: r.name, duration: r.duration } : { name: key, duration: total };
  }

  get movePhase() {
    const m = this._move;
    if (!m) return null;
    if (m.time < m.windup) return 'windup';
    if (m.time < m.windup + m.active) return 'active';
    if (m.time < m.total) return 'recovery';
    return null;
  }

  update(dt) {
    this.mixer.update(dt);
    if (this._move) {
      this._move.time += dt;
      if (this._move.time >= this._move.total) this._move = null;
    }
  }
  stop() { this.mixer.stopAllAction(); this._move = null; }
}

// ---------------------------------------------------------------------------
// Pose sintetiche per mesh statiche. Valori in unità normalizzate (altezza = 1).
// Una posa è { y, z, x, pitch, roll, yaw, squash }: y verticale, z avanti,
// x laterale, pitch inclinazione avanti/indietro, roll di lato, yaw rotazione.
const P = (o = {}) => ({ y: 0, z: 0, x: 0, pitch: 0, roll: 0, yaw: 0, squash: 1, ...o });
const mix = (a, b, k) => ({
  y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, x: a.x + (b.x - a.x) * k,
  pitch: a.pitch + (b.pitch - a.pitch) * k, roll: a.roll + (b.roll - a.roll) * k,
  yaw: a.yaw + (b.yaw - a.yaw) * k, squash: a.squash + (b.squash - a.squash) * k,
});
const ease = (k) => k * k * (3 - 2 * k);          // dolce in entrata e uscita
const snap = (k) => 1 - Math.pow(1 - k, 3);       // scatto: veloce poi frena
const arc = (k) => Math.sin(k * Math.PI);         // campana: 0 → 1 → 0
// Direzione di provenienza del colpo, nel sistema della vittima:
// f = -1 frontale, +1 alle spalle; r = -1 da sinistra, +1 da destra.
const FRONT_HIT = { f: -1, r: 0 };

// Cicli continui
const LOOPS = {
  idle: {
    duration: 3.0,
    pose: (t) => {
      const a = Math.sin(t * Math.PI * 2), b = Math.sin(t * Math.PI * 4);
      return P({ y: a * 0.006, x: a * 0.004, pitch: a * 0.012, roll: b * 0.006, yaw: a * 0.02, squash: 1 - a * 0.006 });
    },
  },
  walk: {
    duration: 0.9,
    pose: (t) => {
      const step = Math.sin(t * Math.PI * 4), sway = Math.sin(t * Math.PI * 2);
      return P({ y: Math.abs(step) * 0.022, x: sway * 0.02, pitch: 0.07 + Math.abs(step) * 0.02, roll: -sway * 0.06, yaw: sway * 0.05, squash: 1 - Math.abs(step) * 0.015 });
    },
  },
  strafe: {
    duration: 0.8,
    pose: (t) => {
      const step = Math.sin(t * Math.PI * 4), sway = Math.sin(t * Math.PI * 2);
      return P({ y: Math.abs(step) * 0.016, x: sway * 0.03, pitch: 0.03, roll: -sway * 0.1, yaw: sway * 0.03 });
    },
  },
};

// Mosse: una funzione per fase, ognuna riceve k da 0 a 1.
const MOVES = {
  slash: {
    windup: (k) => mix(P(), P({ pitch: -0.26, roll: 0.3, yaw: -0.5, z: -0.05, y: 0.02 }), ease(k)),
    active: (k) => mix(P({ pitch: -0.26, roll: 0.3, yaw: -0.5, z: -0.05, y: 0.02 }), P({ pitch: 0.4, roll: -0.35, yaw: 0.55, z: 0.12, y: -0.03 }), snap(k)),
    recovery: (k) => mix(P({ pitch: 0.4, roll: -0.35, yaw: 0.55, z: 0.12, y: -0.03 }), P(), ease(k)),
  },
  thrust: {
    windup: (k) => mix(P(), P({ z: -0.14, pitch: -0.12, roll: 0.14 }), ease(k)),
    active: (k) => mix(P({ z: -0.14, pitch: -0.12, roll: 0.14 }), P({ z: 0.22, pitch: 0.24, roll: 0 }), snap(k)),
    recovery: (k) => mix(P({ z: 0.22, pitch: 0.24 }), P(), ease(k)),
  },
  spin: {
    windup: (k) => mix(P(), P({ yaw: -0.8, squash: 0.94, y: -0.03, pitch: 0.1 }), ease(k)),
    active: (k) => P({ yaw: -0.8 + (Math.PI * 2 + 0.8) * snap(k), roll: arc(k) * 0.22, y: arc(k) * 0.03, pitch: 0.12 }),
    recovery: (k) => mix(P({ yaw: Math.PI * 2, pitch: 0.12 }), P({ yaw: Math.PI * 2 }), ease(k)),
  },
  doubleSpin: {
    windup: (k) => mix(P(), P({ yaw: -1.0, squash: 0.93, y: -0.04, pitch: 0.12 }), ease(k)),
    active: (k) => P({ yaw: -1.0 + (Math.PI * 4 + 1.0) * snap(k), roll: arc(k) * 0.28, y: arc(k) * 0.05, pitch: 0.14 }),
    recovery: (k) => mix(P({ yaw: Math.PI * 4, pitch: 0.14, roll: 0.1 }), P({ yaw: Math.PI * 4 }), ease(k)),
  },
  overhead: {
    windup: (k) => mix(P(), P({ y: 0.06, pitch: -0.42, squash: 1.05, z: -0.04 }), ease(k)),
    active: (k) => mix(P({ y: 0.06, pitch: -0.42, squash: 1.05, z: -0.04 }), P({ y: -0.06, pitch: 0.5, squash: 0.92, z: 0.1 }), snap(k)),
    recovery: (k) => mix(P({ y: -0.06, pitch: 0.5, squash: 0.92, z: 0.1 }), P(), ease(k)),
  },
  leapSlam: {
    windup: (k) => mix(P(), P({ y: -0.08, squash: 0.88, pitch: 0.16 }), ease(k)),
    active: (k) => P({ y: arc(Math.min(1, k * 1.2)) * 0.38 - 0.02, z: snap(k) * 0.16, pitch: -0.3 + k * 0.85, squash: 1 + arc(k) * 0.06 }),
    recovery: (k) => mix(P({ y: -0.05, pitch: 0.55, squash: 0.9 }), P(), ease(k)),
  },
  // Danza dei Trampolieri: tre raffiche di scatti con rotazioni rapide
  flurry: {
    windup: (k) => mix(P(), P({ y: 0.12, pitch: -0.3, squash: 1.06 }), ease(k)),
    active: (k) => {
      const burst = Math.min(2, Math.floor(k * 3));
      const local = (k * 3) % 1;
      return P({
        y: 0.12 * (1 - k) + arc(local) * 0.05,
        z: snap(local) * 0.2,
        x: Math.sin(local * Math.PI * 2 + burst * 2.1) * 0.06,
        yaw: burst * 1.6 + local * Math.PI * 2,
        roll: Math.sin(local * Math.PI * 4) * 0.2,
        pitch: 0.18,
      });
    },
    recovery: (k) => mix(P({ pitch: 0.18, yaw: Math.PI * 2 * 3 }), P({ yaw: Math.PI * 2 * 3 }), ease(k)),
  },
  backstep: {
    windup: (k) => mix(P(), P({ pitch: 0.1 }), k),
    active: (k) => P({ z: -snap(k) * 0.12, y: arc(k) * 0.06, pitch: -0.2 * arc(k) }),
    recovery: (k) => mix(P({ z: -0.12, pitch: -0.1 }), P(), ease(k)),
  },
  sidestep: {
    windup: (k) => mix(P(), P({ roll: 0.1 }), k),
    active: (k) => P({ x: snap(k) * 0.12, roll: -0.28 * arc(k), y: arc(k) * 0.04 }),
    recovery: (k) => mix(P({ x: 0.12, roll: -0.1 }), P(), ease(k)),
  },
  roll: {
    windup: (k) => mix(P(), P({ squash: 0.9, y: -0.04 }), k),
    active: (k) => P({ z: -snap(k) * 0.16, pitch: -Math.PI * 2 * snap(k), y: arc(k) * 0.04, squash: 0.9 }),
    recovery: (k) => mix(P({ z: -0.16, pitch: -Math.PI * 2, squash: 0.9 }), P({ pitch: -Math.PI * 2 }), ease(k)),
  },
  cast: {
    windup: (k) => mix(P(), P({ y: 0.05, pitch: -0.3, squash: 1.04 }), ease(k)),
    active: (k) => mix(P({ y: 0.05, pitch: -0.3, squash: 1.04 }), P({ y: 0.02, pitch: 0.2, z: 0.05 }), snap(k)),
    recovery: (k) => mix(P({ y: 0.02, pitch: 0.2, z: 0.05 }), P(), ease(k)),
  },
  charge: {
    windup: (k) => mix(P(), P({ pitch: 0.3, squash: 0.94, z: -0.06 }), ease(k)),
    active: (k) => P({ pitch: 0.34, z: 0.06, y: Math.abs(Math.sin(k * Math.PI * 6)) * 0.03, roll: Math.sin(k * Math.PI * 6) * 0.08 }),
    recovery: (k) => mix(P({ pitch: 0.34, z: 0.06 }), P(), ease(k)),
  },
  skyLeap: {
    windup: (k) => mix(P(), P({ y: -0.1, squash: 0.85, pitch: 0.1 }), ease(k)),
    active: (k) => P({ y: k < 0.55 ? snap(k / 0.55) * 1.1 : 1.1 * (1 - snap((k - 0.55) / 0.45)) - 0.06, pitch: k < 0.55 ? -0.4 : 0.6, squash: k < 0.55 ? 1.08 : 0.9, yaw: k * 1.2 }),
    recovery: (k) => mix(P({ y: -0.06, pitch: 0.6, squash: 0.9, yaw: 1.2 }), P({ yaw: 1.2 }), ease(k)),
  },
  bloom: {
    windup: (k) => P({ y: ease(k) * 0.5, pitch: -0.25 * ease(k), yaw: k * 3.2, squash: 1 + ease(k) * 0.05 }),
    active: (k) => P({ y: 0.5 * (1 - snap(k)) - 0.04 * snap(k), pitch: -0.25 + 0.7 * snap(k), yaw: 3.2, squash: 1 - snap(k) * 0.12 }),
    recovery: (k) => mix(P({ y: -0.04, pitch: 0.45, yaw: 3.2, squash: 0.88 }), P({ yaw: 3.2 }), ease(k)),
  },
  swoop: {
    windup: (k) => mix(P(), P({ y: 0.14, pitch: -0.2, squash: 1.05 }), ease(k)),
    active: (k) => P({ y: 0.14 + arc(k) * 0.12 - k * 0.14, z: snap(k) * 0.18, pitch: 0.25, roll: Math.sin(k * Math.PI * 2) * 0.2 }),
    recovery: (k) => mix(P({ pitch: 0.25 }), P(), ease(k)),
  },
  throw: {
    windup: (k) => mix(P(), P({ roll: 0.35, pitch: -0.15, yaw: -0.3 }), ease(k)),
    active: (k) => mix(P({ roll: 0.35, pitch: -0.15, yaw: -0.3 }), P({ roll: -0.2, pitch: 0.2, yaw: 0.25, z: 0.05 }), snap(k)),
    recovery: (k) => mix(P({ roll: -0.2, pitch: 0.2, yaw: 0.25, z: 0.05 }), P(), ease(k)),
  },
  // Varianti del fendente: lo stesso colpo non arriva mai due volte dallo stesso
  // angolo. Cambia l'arco che la lama descrive, non solo i tempi.
  slashRise: {
    windup: (k) => mix(P(), P({ pitch: 0.26, roll: -0.32, yaw: 0.46, y: -0.05, z: -0.03 }), ease(k)),
    active: (k) => mix(P({ pitch: 0.26, roll: -0.32, yaw: 0.46, y: -0.05, z: -0.03 }), P({ pitch: -0.38, roll: 0.3, yaw: -0.5, y: 0.09, z: 0.08 }), snap(k)),
    recovery: (k) => mix(P({ pitch: -0.38, roll: 0.3, yaw: -0.5, y: 0.09, z: 0.08 }), P(), ease(k)),
  },
  slashDiag: {
    windup: (k) => mix(P(), P({ pitch: -0.32, roll: 0.38, yaw: -0.56, y: 0.05 }), ease(k)),
    active: (k) => mix(P({ pitch: -0.32, roll: 0.38, yaw: -0.56, y: 0.05 }), P({ pitch: 0.48, roll: -0.44, yaw: 0.52, y: -0.06, z: 0.13 }), snap(k)),
    recovery: (k) => mix(P({ pitch: 0.48, roll: -0.44, yaw: 0.52, y: -0.06, z: 0.13 }), P(), ease(k)),
  },
  // Due tagli in un solo gesto: andata e ritorno, senza fermarsi in mezzo.
  doubleCleave: {
    windup: (k) => mix(P(), P({ pitch: -0.24, roll: 0.34, yaw: -0.52 }), ease(k)),
    active: (k) => {
      const A = P({ pitch: -0.24, roll: 0.34, yaw: -0.52 });
      const B = P({ pitch: 0.36, roll: -0.38, yaw: 0.52, z: 0.1 });
      const C = P({ pitch: -0.12, roll: 0.3, yaw: -0.44, z: 0.06 });
      return k < 0.5 ? mix(A, B, snap(k * 2)) : mix(B, C, snap((k - 0.5) * 2));
    },
    recovery: (k) => mix(P({ pitch: -0.12, roll: 0.3, yaw: -0.44, z: 0.06 }), P(), ease(k)),
  },
  // Colpo che risale: il corpo si carica in basso e si stende verso l'alto.
  uppercut: {
    windup: (k) => mix(P(), P({ y: -0.07, pitch: 0.22, squash: 0.92, z: -0.03 }), ease(k)),
    active: (k) => mix(P({ y: -0.07, pitch: 0.22, squash: 0.92, z: -0.03 }), P({ y: 0.11, pitch: -0.36, squash: 1.07, z: 0.07 }), snap(k)),
    recovery: (k) => mix(P({ y: 0.11, pitch: -0.36, squash: 1.07, z: 0.07 }), P(), ease(k)),
  },
  // Pestone: tutto il peso che scende in un punto.
  stomp: {
    windup: (k) => mix(P(), P({ y: 0.08, pitch: -0.16, roll: 0.08, squash: 1.05 }), ease(k)),
    active: (k) => mix(P({ y: 0.08, pitch: -0.16, roll: 0.08, squash: 1.05 }), P({ y: -0.08, pitch: 0.12, squash: 0.88 }), snap(k)),
    recovery: (k) => mix(P({ y: -0.08, pitch: 0.12, squash: 0.88 }), P(), ease(k)),
  },
  // Calcio o spallata: corto, in avanti, per aprire la guardia.
  kick: {
    windup: (k) => mix(P(), P({ z: -0.07, pitch: -0.1, roll: -0.14 }), ease(k)),
    active: (k) => mix(P({ z: -0.07, pitch: -0.1, roll: -0.14 }), P({ z: 0.17, pitch: 0.2, roll: 0.12 }), snap(k)),
    recovery: (k) => mix(P({ z: 0.17, pitch: 0.2, roll: 0.12 }), P(), ease(k)),
  },
  // Spazzata al contrario: chiude dal lato opposto a `spin`.
  reverseSpin: {
    windup: (k) => mix(P(), P({ yaw: 0.85, squash: 0.94, y: -0.03, pitch: 0.1 }), ease(k)),
    active: (k) => P({ yaw: 0.85 - (Math.PI * 2 + 0.85) * snap(k), roll: -arc(k) * 0.22, y: arc(k) * 0.03, pitch: 0.12 }),
    recovery: (k) => mix(P({ yaw: -Math.PI * 2, pitch: 0.12 }), P({ yaw: -Math.PI * 2 }), ease(k)),
  },
  roar: {
    windup: (k) => mix(P(), P({ y: 0.05, pitch: -0.35, squash: 1.08 }), ease(k)),
    active: (k) => P({ y: 0.05, pitch: -0.35 + Math.sin(k * Math.PI * 12) * 0.05, squash: 1.08, roll: Math.sin(k * Math.PI * 16) * 0.03 }),
    recovery: (k) => mix(P({ y: 0.05, pitch: -0.35, squash: 1.08 }), P(), ease(k)),
  },
};

// Reazioni una tantum
const ONESHOT = {
  // La reazione al colpo dipende da dove arriva: chi viene colpito di fronte
  // incassa all'indietro, chi viene preso di lato ruota sul fianco.
  hit: {
    duration: 0.45,
    pose: (t, self) => {
      const d = (self && self.hitDir) || FRONT_HIT;
      const k = Math.exp(-t * 7) * Math.cos(t * 26);
      return P({
        z: 0.09 * d.f * k, x: 0.05 * d.r * k,
        pitch: 0.28 * d.f * k, roll: -0.14 * d.r * k, yaw: -0.1 * d.r * k,
        squash: 1 - 0.03 * k,
      });
    },
  },
  // Rottura della posa pesante: il corpo va giù, resta a terra, poi si rialza.
  knockdown: {
    duration: 2.1,
    pose: (t, self) => {
      const d = (self && self.hitDir) || FRONT_HIT;
      const dir = d.f < 0 ? -1 : 1;        // colpito di fronte → cade all'indietro
      const FALL = 0.42, LIE = 1.25;
      const down = P({ y: -0.06, z: dir * 0.24, pitch: dir * (Math.PI / 2), roll: d.r * 0.3, yaw: d.r * 0.2, squash: 0.94 });
      if (t < FALL) {
        const k = snap(t / FALL);
        return mix(P({ pitch: dir * 0.2, y: 0.03 }), down, k);
      }
      if (t < LIE) {
        const b = Math.exp(-(t - FALL) * 7) * Math.sin((t - FALL) * 28);
        return P({ ...down, y: down.y + b * 0.035, pitch: down.pitch + b * 0.12, roll: down.roll + b * 0.06 });
      }
      // rialzata: si punta sulle braccia, il busto risale
      const k = ease(Math.min(1, (t - LIE) / (2.1 - LIE)));
      return mix(down, P({ squash: 1 }), k);
    },
  },
  guard: {
    duration: 0.4,
    pose: (t) => {
      const k = Math.exp(-t * 9) * Math.cos(t * 30);
      return P({ z: -0.04 * k, pitch: -0.1 * k, squash: 1 - 0.02 * k });
    },
  },
  death: {
    duration: 1.7,
    pose: (t) => {
      const k = Math.min(1, t / 0.8), e = ease(k);
      const bounce = t > 0.8 ? Math.exp(-(t - 0.8) * 9) * Math.sin((t - 0.8) * 30) * 0.05 : 0;
      return P({ y: -0.09 * e, z: -0.33 * e, x: 0.03 * e, pitch: -(Math.PI / 2) * e + bounce, roll: 0.1 * e, yaw: 0.12 * e });
    },
  },
  victory: {
    duration: 2.2,
    pose: (t) => {
      const rise = Math.sin(Math.min(1, t / 0.45) * Math.PI * 0.5);
      const hold = t > 0.45 && t < 0.8 ? 1 : t <= 0.45 ? rise : Math.max(0, 1 - (t - 0.8) / 0.4);
      return P({ y: 0.05 * hold, pitch: -0.12 * hold, roll: Math.sin(t * Math.PI * 5) * 0.02 * hold, squash: 1 + 0.02 * hold });
    },
  },
  phase2: {
    duration: 1.6,
    pose: (t) => {
      const k = Math.min(1, t / 0.5);
      const hold = t < 1.2 ? 1 : Math.max(0, 1 - (t - 1.2) / 0.4);
      return P({ y: 0.08 * ease(k) * hold, pitch: -0.4 * ease(k) * hold, squash: (1 + 0.1 * ease(k)) * (hold ? 1 : 1), roll: Math.sin(t * Math.PI * 14) * 0.04 * hold });
    },
  },
};

export class RigidAnimator {
  /** @param {THREE.Object3D} target nodo da animare (unità normalizzate, altezza 1) */
  constructor(target) {
    this.target = target;
    this.rigid = true;
    this.base = { position: target.position.clone(), quaternion: target.quaternion.clone(), scale: target.scale.clone() };
    this.loop = null;        // { key, anim, time }
    this.oneshot = null;     // { key, anim, time }
    this.move = null;        // { key, phases, time, total }
    this.blend = { from: null, t: 0, dur: 0 };
    this._pose = P();
    this.hitDir = { f: -1, r: 0 };
    this.footfall = 0;   // 1 / -1 nel frame in cui un piede tocca terra
  }

  /** Da dove arriva il colpo (coordinate della vittima), per la reazione giusta. */
  setHitDir(f, r) {
    const n = Math.hypot(f, r) || 1;
    this.hitDir.f = f / n;
    this.hitDir.r = r / n;
  }

  /** Quanto il corpo è sollevato da terra, in altezze (per l'ombra di contatto). */
  get lift() { return this._pose ? this._pose.y : 0; }

  /** Scostamento orizzontale del corpo rispetto ai piedi, in altezze. */
  get bodyOffset() { return this._pose; }

  has(name) {
    return !!(LOOPS[name] || ONESHOT[name] || MOVES[name] || name === 'attack');
  }

  /** Compatibilità con l'interfaccia a clip: 'idle', 'walk', 'hit', 'death', 'victory'… */
  play(name, { fade = 0.2, loop = true, timeScale = 1 } = {}) {
    if (name === 'attack') return this.playMove('slash', { windup: 0.42, active: 0.16, recovery: 0.5 });
    if (LOOPS[name]) {
      if (this.loop && this.loop.key === name && !this.oneshot && !this.move) {
        return { name, duration: LOOPS[name].duration / (timeScale || 1) };
      }
      this._startBlend(fade);
      this.loop = { key: name, anim: LOOPS[name], time: 0 };
      this.oneshot = null; this.move = null;
      return { name, duration: LOOPS[name].duration / (timeScale || 1) };
    }
    const one = ONESHOT[name];
    if (!one) return null;
    this._startBlend(fade);
    this.oneshot = { key: name, anim: one, time: 0 };
    this.move = null;
    return { name, duration: one.duration / (timeScale || 1) };
  }

  /**
   * Esegue una mossa con tempi espliciti, così l'animazione combacia con
   * preparazione, finestra di danno e scopertura decise dal combattimento.
   * @param {string} key nome della primitiva (slash, overhead, flurry…)
   */
  playMove(key, { windup = 0.4, active = 0.15, recovery = 0.4, fade = 0.08, mirror = false, hold = false } = {}) {
    const phases = MOVES[key] || MOVES.slash;
    this._startBlend(fade);
    this.move = { key, phases, time: 0, windup, active, recovery, mirror: !!mirror, hold: !!hold, total: windup + active + recovery };
    this.oneshot = null;
    return { name: key, duration: windup + active + recovery };
  }

  /** Specchia una posa: lo stesso colpo eseguito dall'altro lato. */
  static mirrorPose(p) {
    p.x = -p.x; p.roll = -p.roll; p.yaw = -p.yaw;
    return p;
  }

  /** Posa corrente della mossa: 'windup' | 'active' | 'recovery' | null */
  get movePhase() {
    const m = this.move;
    if (!m) return null;
    if (m.time < m.windup) return 'windup';
    if (m.time < m.windup + m.active) return 'active';
    return 'recovery';
  }

  _startBlend(fade) {
    if (fade > 0) { this.blend.from = { ...this._pose }; this.blend.t = 0; this.blend.dur = fade; }
    else this.blend.from = null;
  }

  _rawPose(dt) {
    this.footfall = 0;
    const m = this.move;
    if (m) {
      m.time += dt;
      const { windup, active, recovery, phases } = m;
      let p = null;
      // Colpo trattenuto: il corpo arriva presto alla posa di carica e ci resta,
      // come i boss che aspettano che tu schivi prima di calare il colpo.
      if (m.time < windup) {
        const raw = windup > 0 ? m.time / windup : 1;
        p = phases.windup(m.hold ? Math.min(1, raw / 0.6) : raw);
      }
      else if (m.time < windup + active) p = phases.active(active > 0 ? (m.time - windup) / active : 1);
      else if (m.time < m.total) p = phases.recovery(recovery > 0 ? (m.time - windup - active) / recovery : 1);
      else { this.move = null; return P(); }
      return m.mirror ? RigidAnimator.mirrorPose(p) : p;
    }
    const o = this.oneshot;
    if (o) {
      o.time += dt;
      if (o.time >= o.anim.duration) {
        const last = o.anim.pose(o.anim.duration, this);
        if (o.key === 'death') return last;     // resta a terra
        this.oneshot = null;
        return this.loop ? this.loop.anim.pose(0, this) : P();
      }
      return o.anim.pose(o.time, this);
    }
    const l = this.loop;
    if (!l) return P();
    const before = l.time;
    l.time += dt;
    // il passo cade a metà e a fine ciclo: segnalarlo permette polvere e rumore
    if (l.key === 'walk' || l.key === 'strafe') {
      const half = l.anim.duration / 2;
      const b = Math.floor(before / half), a = Math.floor(l.time / half);
      if (a !== b) this.footfall = a % 2 ? 1 : -1;
    }
    l.time %= l.anim.duration;
    return l.anim.pose(l.time / l.anim.duration, this);
  }

  update(dt) {
    let p = this._rawPose(dt);
    if (this.blend.from && this.blend.dur > 0) {
      this.blend.t += dt;
      const k = Math.min(1, this.blend.t / this.blend.dur);
      p = mix(this.blend.from, p, k);
      if (k >= 1) this.blend.from = null;
    }
    this._pose = p;
    const { base, target } = this;
    target.position.set(base.position.x + p.x, base.position.y + p.y, base.position.z + p.z);
    target.quaternion.copy(base.quaternion).multiply(_q.setFromEuler(_e.set(p.pitch, p.yaw, p.roll, 'YXZ')));
    target.scale.set(base.scale.x * (2 - p.squash), base.scale.y * p.squash, base.scale.z * (2 - p.squash));
  }

  stop() {
    this.loop = this.oneshot = this.move = null;
    this.blend.from = null;
    this.target.position.copy(this.base.position);
    this.target.quaternion.copy(this.base.quaternion);
    this.target.scale.copy(this.base.scale);
  }

  static hitTimeFor() { return 0.45; }
}

const _q = new THREE.Quaternion();
