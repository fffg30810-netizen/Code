// Animazione delle articolazioni per i modelli riggati automaticamente.
//
// Estende l'animatore a corpo rigido: quello muove il corpo intero (scatti,
// salti, rotazioni), questo aggiunge braccia, gambe, busto e testa. Le pose
// sono scritte a mano come angoli per osso, interpolati fra chiave e chiave.
import * as THREE from 'three';
import { RigidAnimator } from './Animator.js';

const _q2 = new THREE.Quaternion();
const _e2 = new THREE.Euler();

// Una posa: nome osso → [rotX, rotY, rotZ] in radianti. Quello che manca resta a zero.
const pose = (o) => o;
const EMPTY = {};

function blendPose(a, b, k, out) {
  for (const name in out) delete out[name];
  for (const name in a) {
    const va = a[name], vb = b[name] || [0, 0, 0];
    out[name] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k, va[2] + (vb[2] - va[2]) * k];
  }
  for (const name in b) {
    if (out[name]) continue;
    const vb = b[name], va = a[name] || [0, 0, 0];
    out[name] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k, va[2] + (vb[2] - va[2]) * k];
  }
  return out;
}

// Le ossa del busto portano quasi tutta la mesh: se ruotano tanto il modello si
// piega come gomma. Gli arti invece possono muoversi molto. Da qui guadagno e
// limite per osso, calibrati sui modelli generati.
const GAIN = {
  Hips: 0.55, Spine: 0.34, Chest: 0.42, Head: 0.75,
  ArmL: 0.95, ArmR: 0.95, ForearmL: 0.85, ForearmR: 0.85, HandL: 0.7, HandR: 0.7,
  ThighL: 0.5, ThighR: 0.5, ShinL: 0.5, ShinR: 0.5, FootL: 0.4, FootR: 0.4,
};
const LIMIT = {
  Hips: 0.28, Spine: 0.26, Chest: 0.38, Head: 0.6,
  ArmL: 2.9, ArmR: 2.9, ForearmL: 1.8, ForearmR: 1.8, HandL: 1.0, HandR: 1.0,
  ThighL: 0.8, ThighR: 0.8, ShinL: 1.0, ShinR: 1.0, FootL: 0.6, FootR: 0.6,
};
const clampAngle = (v, lim) => (v > lim ? lim : v < -lim ? -lim : v);

const ease = (k) => k * k * (3 - 2 * k);
const snap = (k) => 1 - Math.pow(1 - k, 3);
const arc = (k) => Math.sin(k * Math.PI);

// ---------------------------------------------------------------- cicli
const LOOPS = {
  idle: (t) => {
    const b = Math.sin(t * Math.PI * 2);           // respiro
    const s = Math.sin(t * Math.PI);               // spostamento del peso
    const look = Math.sin(t * Math.PI * 0.66);     // sguardo che gira
    return pose({
      Chest: [b * 0.035, s * 0.05, 0],
      Spine: [b * 0.02, s * 0.03, -s * 0.02],
      Head: [-b * 0.03, look * 0.35, s * 0.03],
      ArmL: [b * 0.06, 0, 0.06 + s * 0.03],
      ArmR: [b * 0.06, 0, -0.06 - s * 0.03],
      ForearmL: [-0.18 - b * 0.05, 0, 0],
      ForearmR: [-0.18 - b * 0.05, 0, 0],
      ThighL: [s * 0.03, 0, 0],
      ThighR: [-s * 0.03, 0, 0],
    });
  },
  walk: (t) => {
    const p = t * Math.PI * 2;
    const sw = Math.sin(p);
    const kneeL = Math.max(0, -Math.sin(p + 0.6));
    const kneeR = Math.max(0, -Math.sin(p + Math.PI + 0.6));
    return pose({
      Hips: [0.04, sw * 0.06, 0],
      Spine: [0.05, -sw * 0.05, 0],
      Chest: [0.03, sw * 0.08, 0],
      Head: [-0.04, -sw * 0.06, 0],
      ThighL: [sw * 0.34, 0, 0.02],
      ShinL: [-kneeL * 0.6, 0, 0],
      FootL: [kneeL * 0.3 + 0.06, 0, 0],
      ThighR: [-sw * 0.34, 0, -0.02],
      ShinR: [-kneeR * 0.6, 0, 0],
      FootR: [kneeR * 0.3 + 0.06, 0, 0],
      ArmL: [-sw * 0.45, 0, 0.1],
      ArmR: [sw * 0.45, 0, -0.1],
      ForearmL: [-0.3 - Math.max(0, -sw) * 0.3, 0, 0],
      ForearmR: [-0.3 - Math.max(0, sw) * 0.3, 0, 0],
    });
  },
  strafe: (t) => {
    const p = t * Math.PI * 2;
    const sw = Math.sin(p);
    return pose({
      Hips: [0.02, 0, sw * 0.05],
      Chest: [0.02, sw * 0.12, 0],
      Head: [0, -sw * 0.2, 0],
      ThighL: [Math.max(0, sw) * 0.35, 0, Math.max(0, sw) * 0.25],
      ThighR: [Math.max(0, -sw) * 0.35, 0, -Math.max(0, -sw) * 0.25],
      ShinL: [-Math.max(0, sw) * 0.5, 0, 0],
      ShinR: [-Math.max(0, -sw) * 0.5, 0, 0],
      ArmL: [0, 0, 0.22],
      ArmR: [0, 0, -0.22],
      ForearmL: [-0.5, 0, 0],
      ForearmR: [-0.5, 0, 0],
    });
  },
};

// ------------------------------------------------------------- reazioni
const ONESHOT = {
  hit: (t, d) => {
    const k = Math.exp(-t * 8) * Math.cos(t * 24);
    return pose({
      Spine: [-0.3 * k, 0, 0.08 * k],
      Chest: [-0.2 * k, 0.1 * k, 0],
      Head: [-0.35 * k, 0.12 * k, 0],
      ArmL: [-0.5 * k, 0, 0.3 * k],
      ArmR: [-0.5 * k, 0, -0.3 * k],
      ThighL: [0.2 * k, 0, 0],
      ThighR: [0.15 * k, 0, 0],
    });
  },
  guard: (t) => {
    const k = Math.exp(-t * 9);
    return pose({
      ArmR: [-1.1 * k, 0, -0.5 * k], ForearmR: [-1.5 * k, 0, 0],
      ArmL: [-0.9 * k, 0, 0.4 * k], ForearmL: [-1.2 * k, 0, 0],
      Chest: [0.12 * k, 0, 0],
    });
  },
  death: (t, d) => {
    const k = Math.min(1, t / 0.8), e = ease(k);
    return pose({
      Spine: [0.35 * e, 0, 0.1 * e],
      Chest: [0.3 * e, 0.15 * e, 0],
      Head: [0.4 * e, 0.2 * e, 0],
      ArmL: [-0.5 * e, 0, 0.9 * e], ForearmL: [-0.4 * e, 0, 0],
      ArmR: [-0.5 * e, 0, -0.9 * e], ForearmR: [-0.4 * e, 0, 0],
      ThighL: [0.7 * e, 0, 0.15 * e], ShinL: [-0.8 * e, 0, 0],
      ThighR: [0.5 * e, 0, -0.1 * e], ShinR: [-0.6 * e, 0, 0],
    });
  },
  victory: (t) => {
    const rise = Math.sin(Math.min(1, t / 0.45) * Math.PI * 0.5);
    const hold = t > 0.45 && t < 1.5 ? 1 : t <= 0.45 ? rise : Math.max(0, 1 - (t - 1.5) / 0.5);
    return pose({
      ArmR: [-2.6 * hold, 0, -0.3 * hold], ForearmR: [-0.3 * hold, 0, 0],
      ArmL: [-0.6 * hold, 0, 0.5 * hold],
      Chest: [-0.15 * hold, 0, 0],
      Head: [-0.3 * hold, 0, 0],
    });
  },
  phase2: (t) => {
    const k = Math.min(1, t / 0.5);
    const hold = t < 1.2 ? 1 : Math.max(0, 1 - (t - 1.2) / 0.4);
    const shake = Math.sin(t * Math.PI * 16) * 0.05;
    return pose({
      Chest: [(-0.35 + shake) * ease(k) * hold, 0, 0],
      Head: [(-0.5 + shake) * ease(k) * hold, 0, 0],
      ArmL: [(-0.8 + shake) * ease(k) * hold, 0, (0.9) * ease(k) * hold],
      ArmR: [(-0.8 + shake) * ease(k) * hold, 0, (-0.9) * ease(k) * hold],
      ForearmL: [-0.6 * ease(k) * hold, 0, 0],
      ForearmR: [-0.6 * ease(k) * hold, 0, 0],
      ThighL: [0.25 * ease(k) * hold, 0, 0.1],
      ThighR: [0.25 * ease(k) * hold, 0, -0.1],
    });
  },
};

// ------------------------------------------------------------- mosse
// Ogni mossa ha tre pose chiave: pronta → carica → colpo. Il recupero torna a zero.
const READY = pose({ ArmL: [0, 0, 0.08], ArmR: [0, 0, -0.08], ForearmL: [-0.2, 0, 0], ForearmR: [-0.2, 0, 0] });

const MOVES = {
  slash: {
    charge: pose({
      ArmR: [-2.35, 0.3, -0.45], ForearmR: [-0.75, 0, 0], HandR: [-0.2, 0, 0],
      ArmL: [-0.5, 0, 0.55], ForearmL: [-0.9, 0, 0],
      Chest: [-0.2, -0.5, 0], Spine: [-0.1, -0.25, 0], Head: [-0.15, -0.3, 0],
      ThighR: [-0.25, 0, 0], ThighL: [0.2, 0, 0],
    }),
    strike: pose({
      ArmR: [0.75, -0.2, 0.15], ForearmR: [-0.15, 0, 0], HandR: [0.2, 0, 0],
      ArmL: [0.3, 0, 0.25], ForearmL: [-0.5, 0, 0],
      Chest: [0.32, 0.55, 0], Spine: [0.2, 0.28, 0], Head: [0.2, 0.35, 0],
      ThighR: [0.35, 0, 0], ShinR: [-0.3, 0, 0], ThighL: [-0.25, 0, 0],
    }),
  },
  thrust: {
    charge: pose({
      ArmR: [-0.6, 0, -0.35], ForearmR: [-1.5, 0, 0],
      Chest: [0, -0.35, 0], Spine: [0, -0.2, 0],
      ThighR: [-0.3, 0, 0], ThighL: [0.25, 0, 0],
    }),
    strike: pose({
      ArmR: [-1.35, 0, -0.1], ForearmR: [-0.1, 0, 0],
      ArmL: [0.4, 0, 0.3],
      Chest: [0.2, 0.25, 0], Spine: [0.15, 0.1, 0],
      ThighR: [0.5, 0, 0], ShinR: [-0.4, 0, 0], ThighL: [-0.4, 0, 0], ShinL: [-0.2, 0, 0],
    }),
  },
  spin: {
    charge: pose({
      ArmR: [-0.4, 0, -1.25], ForearmR: [-0.2, 0, 0],
      ArmL: [-0.4, 0, 1.25], ForearmL: [-0.2, 0, 0],
      Chest: [0.1, -0.5, 0], ThighL: [0.15, 0, 0.1], ThighR: [0.15, 0, -0.1],
    }),
    strike: pose({
      ArmR: [-0.2, 0, -1.55], ForearmR: [0, 0, 0],
      ArmL: [-0.2, 0, 1.55], ForearmL: [0, 0, 0],
      Chest: [0.14, 0.3, 0], ThighL: [0.1, 0, 0.14], ThighR: [0.1, 0, -0.14],
    }),
  },
  overhead: {
    charge: pose({
      ArmR: [-2.75, 0, -0.2], ForearmR: [-0.5, 0, 0],
      ArmL: [-2.6, 0, 0.25], ForearmL: [-0.5, 0, 0],
      Chest: [-0.4, 0, 0], Spine: [-0.2, 0, 0], Head: [-0.3, 0, 0],
      ThighL: [-0.15, 0, 0], ThighR: [-0.15, 0, 0],
    }),
    strike: pose({
      ArmR: [0.95, 0, 0.1], ForearmR: [-0.1, 0, 0],
      ArmL: [0.9, 0, -0.1], ForearmL: [-0.1, 0, 0],
      Chest: [0.5, 0, 0], Spine: [0.3, 0, 0], Head: [0.35, 0, 0],
      ThighL: [0.45, 0, 0.1], ShinL: [-0.5, 0, 0], ThighR: [0.45, 0, -0.1], ShinR: [-0.5, 0, 0],
    }),
  },
  leapSlam: {
    charge: pose({
      ThighL: [0.85, 0, 0.12], ShinL: [-1.35, 0, 0], FootL: [0.5, 0, 0],
      ThighR: [0.85, 0, -0.12], ShinR: [-1.35, 0, 0], FootR: [0.5, 0, 0],
      ArmR: [-2.5, 0, -0.3], ForearmR: [-0.6, 0, 0], ArmL: [-2.3, 0, 0.35],
      Chest: [-0.25, 0, 0],
    }),
    strike: pose({
      ThighL: [0.35, 0, 0.14], ShinL: [-0.45, 0, 0],
      ThighR: [0.35, 0, -0.14], ShinR: [-0.45, 0, 0],
      ArmR: [1.0, 0, 0.15], ForearmR: [-0.15, 0, 0], ArmL: [0.9, 0, -0.15],
      Chest: [0.55, 0, 0], Head: [0.3, 0, 0],
    }),
  },
  flurry: {
    charge: pose({
      ArmR: [-2.6, 0, -0.5], ForearmR: [-0.8, 0, 0],
      ArmL: [-1.2, 0, 0.8], ForearmL: [-1.0, 0, 0],
      Chest: [-0.3, -0.3, 0], Head: [-0.25, 0, 0],
      ThighL: [-0.2, 0, 0], ThighR: [-0.2, 0, 0],
    }),
    strike: null,   // raffica: pose calcolate al volo
    beat: (k) => {
      const p = k * Math.PI * 6;        // tre raffiche da due colpi
      const a = Math.sin(p), b = Math.cos(p * 1.5);
      return pose({
        ArmR: [-1.2 + a * 1.1, 0, -0.4 - b * 0.3], ForearmR: [-0.5 + a * 0.45, 0, 0],
        ArmL: [-1.0 - a * 0.9, 0, 0.4 + b * 0.3], ForearmL: [-0.5 - a * 0.45, 0, 0],
        Chest: [0.04, a * 0.45, 0], Spine: [0.02, -a * 0.15, 0], Head: [0.03, a * 0.3, 0],
        ThighL: [a * 0.35, 0, 0.06], ShinL: [-Math.max(0, a) * 0.45, 0, 0],
        ThighR: [-a * 0.35, 0, -0.06], ShinR: [-Math.max(0, -a) * 0.45, 0, 0],
      });
    },
  },
  cast: {
    charge: pose({
      ArmR: [-2.2, 0, -0.55], ForearmR: [-0.9, 0, 0],
      ArmL: [-2.0, 0, 0.6], ForearmL: [-0.9, 0, 0],
      Chest: [-0.3, 0, 0], Head: [-0.35, 0, 0],
    }),
    strike: pose({
      ArmR: [-1.5, 0, -0.35], ForearmR: [-0.25, 0, 0],
      ArmL: [-1.45, 0, 0.35], ForearmL: [-0.25, 0, 0],
      Chest: [0.18, 0, 0], Head: [0.1, 0, 0],
      ThighL: [0.15, 0, 0], ThighR: [0.15, 0, 0],
    }),
  },
  charge: {
    charge: pose({
      Chest: [0.3, 0, 0], Spine: [0.2, 0, 0], Head: [-0.15, 0, 0],
      ArmL: [0.6, 0, 0.2], ArmR: [0.6, 0, -0.2],
      ThighL: [0.5, 0, 0], ShinL: [-0.7, 0, 0], ThighR: [-0.3, 0, 0],
    }),
    strike: pose({
      Chest: [0.34, 0, 0], Spine: [0.22, 0, 0],
      ArmL: [-0.5, 0, 0.25], ArmR: [-0.5, 0, -0.25],
      ThighL: [-0.4, 0, 0], ThighR: [0.6, 0, 0], ShinR: [-0.8, 0, 0],
    }),
  },
  skyLeap: {
    charge: pose({
      ThighL: [1.0, 0, 0.15], ShinL: [-1.5, 0, 0], ThighR: [1.0, 0, -0.15], ShinR: [-1.5, 0, 0],
      ArmR: [-2.9, 0, -0.2], ArmL: [-2.8, 0, 0.25], Chest: [-0.2, 0, 0],
    }),
    strike: pose({
      ThighL: [0.55, 0, 0.16], ShinL: [-0.7, 0, 0], ThighR: [0.55, 0, -0.16], ShinR: [-0.7, 0, 0],
      ArmR: [1.1, 0, 0.2], ArmL: [1.05, 0, -0.2], Chest: [0.6, 0, 0], Head: [0.35, 0, 0],
    }),
  },
  bloom: {
    charge: pose({
      ArmR: [-2.9, 0, -0.9], ForearmR: [-0.3, 0, 0],
      ArmL: [-2.9, 0, 0.9], ForearmL: [-0.3, 0, 0],
      Chest: [-0.4, 0, 0], Head: [-0.5, 0, 0],
      ThighL: [-0.1, 0, 0.1], ThighR: [-0.1, 0, -0.1],
    }),
    strike: pose({
      ArmR: [0.6, 0, -1.2], ArmL: [0.6, 0, 1.2],
      Chest: [0.45, 0, 0], Head: [0.3, 0, 0],
      ThighL: [0.5, 0, 0.14], ShinL: [-0.6, 0, 0], ThighR: [0.5, 0, -0.14], ShinR: [-0.6, 0, 0],
    }),
  },
  swoop: {
    charge: pose({
      ArmR: [-2.2, 0, -0.9], ArmL: [-2.2, 0, 0.9], Chest: [-0.25, 0, 0],
      ThighL: [0.4, 0, 0], ShinL: [-0.6, 0, 0], ThighR: [0.4, 0, 0], ShinR: [-0.6, 0, 0],
    }),
    strike: pose({
      ArmR: [-0.4, 0, -1.3], ArmL: [-0.4, 0, 1.3], Chest: [0.3, 0, 0],
      ThighL: [-0.3, 0, 0], ThighR: [0.5, 0, 0], ShinR: [-0.5, 0, 0],
    }),
  },
  throw: {
    charge: pose({
      ArmR: [-2.4, 0, -0.8], ForearmR: [-1.6, 0, 0],
      Chest: [-0.15, -0.45, 0], Head: [-0.1, -0.2, 0], ArmL: [-0.8, 0, 0.7],
    }),
    strike: pose({
      ArmR: [-0.9, 0, 0.2], ForearmR: [-0.1, 0, 0],
      Chest: [0.1, 0.4, 0], Head: [0.05, 0.25, 0], ArmL: [0.3, 0, 0.3],
      ThighR: [0.3, 0, 0], ThighL: [-0.2, 0, 0],
    }),
  },
  roar: {
    charge: pose({
      ArmR: [-1.0, 0, -1.0], ForearmR: [-0.6, 0, 0],
      ArmL: [-1.0, 0, 1.0], ForearmL: [-0.6, 0, 0],
      Chest: [-0.35, 0, 0], Head: [-0.55, 0, 0], Spine: [-0.15, 0, 0],
    }),
    strike: pose({
      ArmR: [-1.2, 0, -1.2], ArmL: [-1.2, 0, 1.2],
      Chest: [-0.4, 0, 0], Head: [-0.6, 0, 0],
    }),
  },
  backstep: { charge: pose({ ThighL: [0.3, 0, 0], ThighR: [0.3, 0, 0], Chest: [-0.1, 0, 0] }),
    strike: pose({ ThighL: [-0.5, 0, 0], ShinL: [-0.5, 0, 0], ThighR: [-0.45, 0, 0], ShinR: [-0.45, 0, 0], Chest: [-0.2, 0, 0], ArmL: [-0.4, 0, 0.4], ArmR: [-0.4, 0, -0.4] }) },
  sidestep: { charge: pose({ ThighL: [0.2, 0, 0.2], ThighR: [0.1, 0, -0.1] }),
    strike: pose({ ThighL: [0.1, 0, 0.5], ThighR: [0.3, 0, -0.2], Chest: [0, 0, 0.2], ArmL: [0, 0, 0.5] }) },
  roll: { charge: pose({ ThighL: [1.1, 0, 0], ShinL: [-1.6, 0, 0], ThighR: [1.1, 0, 0], ShinR: [-1.6, 0, 0], Chest: [0.5, 0, 0], Head: [0.4, 0, 0], ArmL: [-1.4, 0, 0.6], ArmR: [-1.4, 0, -0.6] }),
    strike: pose({ ThighL: [1.3, 0, 0], ShinL: [-1.8, 0, 0], ThighR: [1.3, 0, 0], ShinR: [-1.8, 0, 0], Chest: [0.6, 0, 0], ArmL: [-1.6, 0, 0.5], ArmR: [-1.6, 0, -0.5] }) },
};
MOVES.doubleSpin = MOVES.spin;

export class SkeletalAnimator extends RigidAnimator {
  /**
   * @param {THREE.Object3D} target nodo del corpo (per il movimento d'insieme)
   * @param {Record<string, THREE.Bone>} bones ossa dello scheletro automatico
   */
  constructor(target, bones) {
    super(target);
    this.bones = bones;
    this.rigid = false;
    this.skeletal = true;
    this._pose = {};
    this._current = {};
    this._smoothed = {};
    this._e = new THREE.Euler();
    // guarda dove punta il corpo: la testa segue il bersaglio
    this.lookYaw = 0;
    this.lookTarget = 0;
  }

  /** Angolo (radianti) verso cui la testa deve girarsi, relativo al corpo. */
  setLook(yawOffset) { this.lookTarget = THREE.MathUtils.clamp(yawOffset, -1.1, 1.1); }

  _statePose() {
    const m = this.move;
    if (m) {
      const def = MOVES[m.key] || MOVES.slash;
      const t = m.time;
      if (t < m.windup) {
        return blendPose(READY, def.charge, ease(m.windup > 0 ? t / m.windup : 1), this._current);
      }
      if (t < m.windup + m.active) {
        const k = m.active > 0 ? (t - m.windup) / m.active : 1;
        if (def.beat) return def.beat(k);
        return blendPose(def.charge, def.strike, snap(k), this._current);
      }
      const k = m.recovery > 0 ? (t - m.windup - m.active) / m.recovery : 1;
      const from = def.beat ? def.beat(1) : def.strike;
      return blendPose(from, READY, ease(Math.min(1, k)), this._current);
    }
    const o = this.oneshot;
    if (o) {
      const fn = ONESHOT[o.key];
      if (fn) return fn(o.time, o.anim.duration);
    }
    const l = this.loop;
    if (l) {
      const fn = LOOPS[l.key];
      if (fn) return fn(l.time / l.anim.duration);
    }
    return EMPTY;
  }

  update(dt) {
    super.update(dt);
    // Con lo scheletro il movimento d'insieme va dosato: le articolazioni fanno
    // già gran parte del lavoro, e sommarci l'inclinazione del corpo piega troppo.
    const p = this._pose;
    if (p) {
      this.target.quaternion.copy(this.base.quaternion).multiply(
        _q2.setFromEuler(_e2.set(p.pitch * 0.45, p.yaw, p.roll * 0.5, 'YXZ')),
      );
    }
    const target = this._statePose();

    // smorzamento: le pose cambiano di colpo, le articolazioni no
    const lambda = this.move ? 26 : 12;
    const k = 1 - Math.exp(-lambda * Math.max(0.0001, dt));
    const sm = this._smoothed;
    for (const name in target) {
      const t = target[name];
      const c = sm[name] || (sm[name] = [0, 0, 0]);
      c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k;
    }
    for (const name in sm) {
      if (target[name]) continue;
      const c = sm[name];
      c[0] += (0 - c[0]) * k; c[1] += (0 - c[1]) * k; c[2] += (0 - c[2]) * k;
    }

    this.lookYaw += (this.lookTarget - this.lookYaw) * (1 - Math.exp(-4 * dt));

    for (const name in this.bones) {
      const bone = this.bones[name];
      if (!bone) continue;
      const c = sm[name];
      const g = GAIN[name] != null ? GAIN[name] : 0.6;
      const lim = LIMIT[name] != null ? LIMIT[name] : 1.2;
      let rx = (c ? c[0] : 0) * g, ry = (c ? c[1] : 0) * g, rz = (c ? c[2] : 0) * g;
      if (name === 'Head') ry += this.lookYaw * 0.55;
      if (name === 'Chest') ry += this.lookYaw * 0.18;
      bone.rotation.set(clampAngle(rx, lim), clampAngle(ry, lim), clampAngle(rz, lim));
    }
  }

  stop() {
    super.stop();
    for (const name in this.bones) this.bones[name].rotation.set(0, 0, 0);
    for (const n in this._smoothed) delete this._smoothed[n];
  }
}
