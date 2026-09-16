// Boss "segnaposto" procedurali: figure stilizzate costruite con primitive e
// animate con keyframe sui nodi (idle, walk, attack1, attack2, hit, death).
// Servono a far funzionare l'app subito; i modelli HD veri vanno in public/models.
import * as THREE from 'three';

const REST = {
  Hips: { pos: [0, 0.95, 0], rot: [0, 0, 0] },
  Spine: { pos: [0, 0.08, 0], rot: [0, 0, 0] },
  Head: { pos: [0, 0.78, 0], rot: [0, 0, 0] },
  ArmL: { pos: [0.30, 0.66, 0], rot: [0, 0, 0.22] },
  ArmR: { pos: [-0.30, 0.66, 0], rot: [0, 0, -0.22] },
  ForearmL: { pos: [0, -0.34, 0], rot: [-0.25, 0, 0] },
  ForearmR: { pos: [0, -0.34, 0], rot: [-0.25, 0, 0] },
  LegL: { pos: [0.14, 0, 0], rot: [0, 0, 0] },
  LegR: { pos: [-0.14, 0, 0], rot: [0, 0, 0] },
  ShinL: { pos: [0, -0.46, 0], rot: [0, 0, 0] },
  ShinR: { pos: [0, -0.46, 0], rot: [0, 0, 0] },
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.3,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

function part(parent, geometry, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale, name } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (scale) m.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function node(parent, name) {
  const g = new THREE.Group();
  g.name = name;
  const r = REST[name];
  if (r) { g.position.set(...r.pos); g.rotation.set(...r.rot); }
  parent.add(g);
  return g;
}

function buildWeapon(kind, hand, mats) {
  const w = new THREE.Group();
  w.name = 'Weapon';
  w.position.set(0, -0.36, 0.04);
  w.rotation.x = 0.35; // la lama pende leggermente in avanti
  hand.add(w);
  const steel = mats.weapon, gold = mats.accent;
  switch (kind) {
    case 'katana': {
      part(w, new THREE.BoxGeometry(0.035, 1.15, 0.008), steel, { pos: [0, -0.5, 0], rot: [0, 0, 0.02] });
      part(w, new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10), gold, { pos: [0, 0.14, 0] });
      part(w, new THREE.TorusGeometry(0.05, 0.012, 8, 20), gold, { pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0] });
      break;
    }
    case 'greatsword': {
      part(w, new THREE.BoxGeometry(0.13, 1.35, 0.035), steel, { pos: [0, -0.62, 0] });
      part(w, new THREE.BoxGeometry(0.32, 0.06, 0.07), gold, { pos: [0, 0.05, 0] });
      part(w, new THREE.CylinderGeometry(0.025, 0.03, 0.3, 10), mats.cloth, { pos: [0, 0.22, 0] });
      part(w, new THREE.SphereGeometry(0.045, 12, 12), gold, { pos: [0, 0.4, 0] });
      break;
    }
    case 'hammer': {
      part(w, new THREE.CylinderGeometry(0.03, 0.035, 1.4, 12), mats.cloth, { pos: [0, -0.5, 0] });
      part(w, new THREE.BoxGeometry(0.38, 0.24, 0.24), steel, { pos: [0, -1.15, 0] });
      part(w, new THREE.TorusGeometry(0.12, 0.02, 8, 18), gold, { pos: [0, -1.15, 0], rot: [0, 0, Math.PI / 2] });
      break;
    }
    case 'axe': {
      part(w, new THREE.CylinderGeometry(0.03, 0.035, 1.5, 12), mats.cloth, { pos: [0, -0.55, 0] });
      part(w, new THREE.CylinderGeometry(0.28, 0.28, 0.035, 20, 1, false, 0, Math.PI), steel, { pos: [0.1, -1.05, 0], rot: [Math.PI / 2, 0, Math.PI / 2] });
      part(w, new THREE.BoxGeometry(0.1, 0.16, 0.08), gold, { pos: [0, -1.05, 0] });
      break;
    }
    case 'staff': {
      w.rotation.x = 0.1;
      part(w, new THREE.CylinderGeometry(0.025, 0.03, 1.9, 12), mats.weapon, { pos: [0, 0.2, 0] });
      part(w, new THREE.TorusGeometry(0.1, 0.02, 8, 20), gold, { pos: [0, 1.15, 0] });
      part(w, new THREE.SphereGeometry(0.075, 16, 16), mat(mats.accent.color, { emissive: mats.accent.color, emissiveIntensity: 1.2, roughness: 0.2 }), { pos: [0, 1.15, 0] });
      break;
    }
    case 'spear':
    case 'trident': {
      w.rotation.x = 0.55;
      part(w, new THREE.CylinderGeometry(0.02, 0.025, 2.0, 10), gold, { pos: [0, -0.5, 0] });
      part(w, new THREE.ConeGeometry(0.05, 0.35, 10), steel, { pos: [0, -1.65, 0], rot: [Math.PI, 0, 0] });
      if (kind === 'trident') {
        part(w, new THREE.ConeGeometry(0.035, 0.25, 8), steel, { pos: [0.11, -1.55, 0], rot: [Math.PI, 0, 0] });
        part(w, new THREE.ConeGeometry(0.035, 0.25, 8), steel, { pos: [-0.11, -1.55, 0], rot: [Math.PI, 0, 0] });
        part(w, new THREE.BoxGeometry(0.26, 0.04, 0.04), steel, { pos: [0, -1.42, 0] });
      }
      break;
    }
    default:
      break;
  }
  return w;
}

function buildHelmet(kind, head, mats, bulk) {
  const gold = mats.accent, armor = mats.armor;
  switch (kind) {
    case 'horns':
      part(head, new THREE.ConeGeometry(0.05, 0.42, 10), mats.skin, { pos: [0.12, 0.2, -0.02], rot: [0.1, 0, -0.9] });
      part(head, new THREE.ConeGeometry(0.05, 0.42, 10), mats.skin, { pos: [-0.12, 0.2, -0.02], rot: [0.1, 0, 0.9] });
      break;
    case 'crown':
      part(head, new THREE.TorusGeometry(0.16, 0.025, 8, 24), gold, { pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        part(head, new THREE.ConeGeometry(0.03, 0.14, 6), gold, { pos: [Math.cos(a) * 0.16, 0.22, Math.sin(a) * 0.16] });
      }
      break;
    case 'hood':
      part(head, new THREE.ConeGeometry(0.26, 0.5, 14, 1, true), mats.cloth, { pos: [0, 0.16, -0.03], rot: [0.15, 0, 0] });
      break;
    case 'wolf':
      part(head, new THREE.BoxGeometry(0.16, 0.14, 0.26), armor, { pos: [0, -0.02, 0.22] });
      part(head, new THREE.ConeGeometry(0.06, 0.16, 8), armor, { pos: [0.11, 0.22, 0], rot: [0, 0, -0.2] });
      part(head, new THREE.ConeGeometry(0.06, 0.16, 8), armor, { pos: [-0.11, 0.22, 0], rot: [0, 0, 0.2] });
      break;
    case 'winged':
      part(head, new THREE.BoxGeometry(0.02, 0.32, 0.22), gold, { pos: [0.22, 0.12, -0.02], rot: [0.2, 0, 0.35] });
      part(head, new THREE.BoxGeometry(0.02, 0.32, 0.22), gold, { pos: [-0.22, 0.12, -0.02], rot: [0.2, 0, -0.35] });
      part(head, new THREE.SphereGeometry(0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), gold, { pos: [0, 0.02, 0] });
      break;
    case 'lionmane':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        part(head, new THREE.ConeGeometry(0.06, 0.28, 7), mats.cloth, {
          pos: [Math.cos(a) * 0.22, 0.02 + Math.sin(a) * 0.22, -0.08],
          rot: [-0.3, 0, -a + Math.PI / 2],
        });
      }
      break;
    default:
      break;
  }
}

function buildArm(parent, side, mats, bulk, opts = {}) {
  const s = side === 'L' ? 1 : -1;
  const arm = node(parent, `Arm${side}`);
  const armMat = opts.prosthetic && side === 'R' ? mats.accent : mats.armor;
  part(arm, new THREE.SphereGeometry(0.11 * bulk, 14, 12), mats.armor, { pos: [s * 0.02, 0.02, 0] }); // spallaccio
  part(arm, new THREE.CapsuleGeometry(0.065 * bulk, 0.26, 6, 10), armMat, { pos: [0, -0.16, 0] });
  const fore = node(arm, `Forearm${side}`);
  part(fore, new THREE.CapsuleGeometry(0.055 * bulk, 0.26, 6, 10), opts.prosthetic && side === 'R' ? mats.accent : mats.skin, { pos: [0, -0.16, 0] });
  part(fore, new THREE.SphereGeometry(0.07 * bulk, 12, 10), mats.skin, { pos: [0, -0.34, 0] }); // mano
  return { arm, fore };
}

/**
 * @param {object} cfg  { weapon, helmet, cape, bulk, colors, extraArms, prosthetic, serpent, dualWield }
 * @returns {{ object: THREE.Group, clips: THREE.AnimationClip[], hitTimes: Record<string, number> }}
 */
export function buildProceduralBoss(cfg = {}) {
  const bulk = cfg.bulk ?? 1;
  const c = { armor: '#6b6b6b', cloth: '#333', skin: '#c9b08a', accent: '#e6c56b', weapon: '#9a9a9a', ...(cfg.colors || {}) };
  const mats = {
    armor: mat(c.armor, { metalness: 0.55, roughness: 0.45 }),
    cloth: mat(c.cloth, { metalness: 0.0, roughness: 0.9 }),
    skin: mat(c.skin, { metalness: 0.0, roughness: 0.75 }),
    accent: mat(c.accent, { metalness: 0.8, roughness: 0.3, emissive: c.accent, emissiveIntensity: 0.15 }),
    weapon: mat(c.weapon, { metalness: 0.85, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'Root';
  const hips = node(root, 'Hips');

  // Gambe (o coda di serpente)
  if (cfg.serpent) {
    part(hips, new THREE.ConeGeometry(0.34 * bulk, 1.3, 16), mats.skin, { pos: [0, -0.55, -0.15], rot: [-0.35, 0, 0] });
    part(hips, new THREE.ConeGeometry(0.22 * bulk, 1.2, 14), mats.skin, { pos: [0, -0.7, -0.75], rot: [-1.2, 0, 0] });
  } else {
    for (const side of ['L', 'R']) {
      const leg = node(hips, `Leg${side}`);
      part(leg, new THREE.CapsuleGeometry(0.095 * bulk, 0.3, 6, 12), mats.cloth, { pos: [0, -0.22, 0] });
      const shin = node(leg, `Shin${side}`);
      part(shin, new THREE.CapsuleGeometry(0.075 * bulk, 0.3, 6, 12), mats.armor, { pos: [0, -0.22, 0] });
      part(shin, new THREE.BoxGeometry(0.15 * bulk, 0.09, 0.28), mats.armor, { pos: [0, -0.45, 0.06] }); // piede
    }
    part(hips, new THREE.CylinderGeometry(0.24 * bulk, 0.28 * bulk, 0.22, 16), mats.cloth, { pos: [0, -0.02, 0] }); // gonnellino
  }

  // Torso
  const spine = node(hips, 'Spine');
  part(spine, new THREE.CapsuleGeometry(0.26 * bulk, 0.42, 8, 16), mats.armor, { pos: [0, 0.32, 0] });
  part(spine, new THREE.BoxGeometry(0.34 * bulk, 0.22, 0.12), mats.accent, { pos: [0, 0.4, 0.2 * bulk] }); // pettorale
  if (cfg.cape) {
    part(spine, new THREE.BoxGeometry(0.48 * bulk, 1.12, 0.025), mats.cloth, { pos: [0, -0.02, -0.25 * bulk], rot: [0.14, 0, 0] });
  }

  // Braccia
  buildArm(spine, 'L', mats, bulk, cfg);
  const { fore: foreR } = buildArm(spine, 'R', mats, bulk, cfg);
  if (cfg.extraArms) {
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      const extra = node(spine, `ArmX${side}`);
      extra.position.set(s * 0.3 * bulk, 0.34, 0.05);
      extra.rotation.set(-0.8, 0, s * 0.5);
      part(extra, new THREE.CapsuleGeometry(0.05, 0.28, 5, 8), mats.skin, { pos: [0, -0.16, 0] });
      part(extra, new THREE.SphereGeometry(0.06, 10, 8), mats.skin, { pos: [0, -0.34, 0] });
    }
  }
  buildWeapon(cfg.weapon || 'greatsword', foreR, mats);
  if (cfg.dualWield) {
    const foreL = root.getObjectByName('ForearmL');
    const w2 = buildWeapon(cfg.weapon || 'greatsword', foreL, mats);
    w2.name = 'Weapon2';
  }

  // Testa
  const head = node(spine, 'Head');
  part(head, new THREE.SphereGeometry(0.17 * Math.sqrt(bulk), 20, 16), mats.skin, { pos: [0, 0.02, 0] });
  part(head, new THREE.BoxGeometry(0.26, 0.06, 0.14), mats.armor, { pos: [0, 0.06, 0.1] }); // visiera
  part(head, new THREE.BoxGeometry(0.05, 0.02, 0.02), mat('#ffb347', { emissive: '#ffb347', emissiveIntensity: 2 }), { pos: [0.06, 0.02, 0.17] });
  part(head, new THREE.BoxGeometry(0.05, 0.02, 0.02), mat('#ffb347', { emissive: '#ffb347', emissiveIntensity: 2 }), { pos: [-0.06, 0.02, 0.17] });
  buildHelmet(cfg.helmet || 'none', head, mats, bulk);

  const clips = buildClips(cfg);
  return { object: root, clips, hitTimes: { Attack1: 0.47, Attack2: 0.52 } };
}

// ---------------------------------------------------------------------------
// Animazioni
// ---------------------------------------------------------------------------
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qr = new THREE.Quaternion();

/** Traccia quaternion: rotazione di riposo del nodo composta con delta (Euler) per keyframe. */
function qTrack(name, keys) {
  const rest = REST[name]?.rot || [0, 0, 0];
  _qr.setFromEuler(_e.set(rest[0], rest[1], rest[2]));
  const times = [], values = [];
  for (const [t, dx, dy, dz] of keys) {
    _q.setFromEuler(_e.set(dx, dy, dz));
    _q.premultiply(_qr);
    times.push(t);
    values.push(_q.x, _q.y, _q.z, _q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}

/** Traccia posizione: offset rispetto alla posizione di riposo. */
function pTrack(name, keys) {
  const rest = REST[name]?.pos || [0, 0, 0];
  const times = [], values = [];
  for (const [t, dx, dy, dz] of keys) {
    times.push(t);
    values.push(rest[0] + dx, rest[1] + dy, rest[2] + dz);
  }
  return new THREE.VectorKeyframeTrack(`${name}.position`, times, values);
}

function buildClips(cfg) {
  const legs = !cfg.serpent;
  const clips = [];

  // Idle: respiro, leggera oscillazione delle braccia
  clips.push(new THREE.AnimationClip('Idle', 2.4, [
    pTrack('Hips', [[0, 0, 0, 0], [1.2, 0, -0.015, 0], [2.4, 0, 0, 0]]),
    qTrack('Spine', [[0, 0, 0, 0], [1.2, 0.03, 0.02, 0], [2.4, 0, 0, 0]]),
    qTrack('ArmL', [[0, 0, 0, 0], [1.2, 0.05, 0, 0.04], [2.4, 0, 0, 0]]),
    qTrack('ArmR', [[0, 0, 0, 0], [1.2, 0.05, 0, -0.04], [2.4, 0, 0, 0]]),
    qTrack('Head', [[0, 0, 0, 0], [0.8, 0, 0.12, 0], [1.9, 0, -0.1, 0], [2.4, 0, 0, 0]]),
  ]));

  // Walk
  const walk = [
    pTrack('Hips', [[0, 0, 0, 0], [0.25, 0, -0.03, 0], [0.5, 0, 0, 0], [0.75, 0, -0.03, 0], [1.0, 0, 0, 0]]),
    qTrack('Spine', [[0, 0, 0.08, 0], [0.5, 0, -0.08, 0], [1.0, 0, 0.08, 0]]),
    qTrack('ArmL', [[0, -0.35, 0, 0], [0.5, 0.35, 0, 0], [1.0, -0.35, 0, 0]]),
    qTrack('ArmR', [[0, 0.35, 0, 0], [0.5, -0.35, 0, 0], [1.0, 0.35, 0, 0]]),
  ];
  if (legs) {
    walk.push(
      qTrack('LegL', [[0, 0.55, 0, 0], [0.5, -0.55, 0, 0], [1.0, 0.55, 0, 0]]),
      qTrack('LegR', [[0, -0.55, 0, 0], [0.5, 0.55, 0, 0], [1.0, -0.55, 0, 0]]),
      qTrack('ShinL', [[0, 0.1, 0, 0], [0.25, 0.7, 0, 0], [0.5, 0.15, 0, 0], [0.75, 0.05, 0, 0], [1.0, 0.1, 0, 0]]),
      qTrack('ShinR', [[0, 0.15, 0, 0], [0.25, 0.05, 0, 0], [0.5, 0.1, 0, 0], [0.75, 0.7, 0, 0], [1.0, 0.15, 0, 0]]),
    );
  } else {
    walk.push(qTrack('Hips', [[0, 0, 0.1, 0.05], [0.5, 0, -0.1, -0.05], [1.0, 0, 0.1, 0.05]]));
  }
  clips.push(new THREE.AnimationClip('Walk', 1.0, walk));

  // Attack1: colpo dall'alto (hit al 47%)
  clips.push(new THREE.AnimationClip('Attack1', 1.1, [
    qTrack('ArmR', [[0, 0, 0, 0], [0.35, -2.7, 0, 0.35], [0.45, -2.6, 0, 0.3], [0.55, -0.7, 0, -0.1], [0.75, -0.9, 0, 0], [1.1, 0, 0, 0]]),
    qTrack('ForearmR', [[0, 0, 0, 0], [0.35, -0.6, 0, 0], [0.55, 0.15, 0, 0], [1.1, 0, 0, 0]]),
    qTrack('Spine', [[0, 0, 0, 0], [0.35, -0.2, 0.25, 0], [0.55, 0.32, -0.15, 0], [0.8, 0.2, -0.05, 0], [1.1, 0, 0, 0]]),
    qTrack('ArmL', [[0, 0, 0, 0], [0.35, -0.6, 0, 0.5], [0.55, 0.3, 0, 0.2], [1.1, 0, 0, 0]]),
    pTrack('Hips', [[0, 0, 0, 0], [0.35, 0, 0.02, -0.06], [0.55, 0, -0.06, 0.12], [1.1, 0, 0, 0]]),
    qTrack('Head', [[0, 0, 0, 0], [0.35, -0.2, 0, 0], [0.55, 0.25, 0, 0], [1.1, 0, 0, 0]]),
  ]));

  // Attack2: spazzata orizzontale (hit al 52%)
  clips.push(new THREE.AnimationClip('Attack2', 1.3, [
    qTrack('ArmR', [[0, 0, 0, 0], [0.4, -1.6, 0, -1.1], [0.55, -1.55, 0, -1.0], [0.7, -1.5, 0, 0.9], [0.9, -1.2, 0, 0.7], [1.3, 0, 0, 0]]),
    qTrack('ForearmR', [[0, 0, 0, 0], [0.4, -0.3, 0, 0], [0.7, 0.1, 0, 0], [1.3, 0, 0, 0]]),
    qTrack('Spine', [[0, 0, 0, 0], [0.4, 0.05, -0.75, 0], [0.7, 0.1, 0.8, 0], [1.0, 0.05, 0.3, 0], [1.3, 0, 0, 0]]),
    qTrack('ArmL', [[0, 0, 0, 0], [0.4, -0.3, 0, 0.6], [0.7, -0.5, 0, 0.2], [1.3, 0, 0, 0]]),
    pTrack('Hips', [[0, 0, 0, 0], [0.4, 0, -0.03, -0.05], [0.7, 0, -0.05, 0.1], [1.3, 0, 0, 0]]),
  ]));

  // Hit: contraccolpo
  clips.push(new THREE.AnimationClip('Hit', 0.5, [
    qTrack('Spine', [[0, 0, 0, 0], [0.12, -0.38, 0.1, 0], [0.5, 0, 0, 0]]),
    qTrack('Head', [[0, 0, 0, 0], [0.12, -0.35, 0, 0], [0.5, 0, 0, 0]]),
    pTrack('Hips', [[0, 0, 0, 0], [0.12, 0, 0.01, -0.08], [0.5, 0, 0, 0]]),
    qTrack('ArmL', [[0, 0, 0, 0], [0.12, -0.5, 0, 0.3], [0.5, 0, 0, 0]]),
    qTrack('ArmR', [[0, 0, 0, 0], [0.12, -0.5, 0, -0.3], [0.5, 0, 0, 0]]),
  ]));

  // Death: cade all'indietro e resta a terra
  const death = [
    qTrack('Hips', [[0, 0, 0, 0], [0.3, -0.15, 0, 0.05], [1.0, -1.5, 0, 0.1], [1.8, -1.5, 0, 0.1]]),
    pTrack('Hips', [[0, 0, 0, 0], [0.3, 0, -0.05, -0.05], [1.0, 0, -0.7, -0.35], [1.8, 0, -0.7, -0.35]]),
    qTrack('Spine', [[0, 0, 0, 0], [0.3, -0.2, 0, 0], [1.0, 0.1, 0, 0], [1.8, 0.1, 0, 0]]),
    qTrack('ArmL', [[0, 0, 0, 0], [0.5, -1.4, 0, 0.9], [1.0, -0.4, 0, 1.2], [1.8, -0.4, 0, 1.2]]),
    qTrack('ArmR', [[0, 0, 0, 0], [0.5, -1.4, 0, -0.9], [1.0, -0.4, 0, -1.2], [1.8, -0.4, 0, -1.2]]),
    qTrack('Head', [[0, 0, 0, 0], [0.5, -0.5, 0, 0], [1.0, 0.3, 0.3, 0], [1.8, 0.3, 0.3, 0]]),
  ];
  if (legs) {
    death.push(
      qTrack('LegL', [[0, 0, 0, 0], [1.0, 0.5, 0, 0.1], [1.8, 0.5, 0, 0.1]]),
      qTrack('LegR', [[0, 0, 0, 0], [1.0, 0.35, 0, -0.1], [1.8, 0.35, 0, -0.1]]),
      qTrack('ShinL', [[0, 0, 0, 0], [1.0, 0.6, 0, 0], [1.8, 0.6, 0, 0]]),
      qTrack('ShinR', [[0, 0, 0, 0], [1.0, 0.2, 0, 0], [1.8, 0.2, 0, 0]]),
    );
  }
  clips.push(new THREE.AnimationClip('Death', 1.8, death));

  // Victory: alza l'arma
  clips.push(new THREE.AnimationClip('Victory', 2.0, [
    qTrack('ArmR', [[0, 0, 0, 0], [0.5, -2.9, 0, 0.2], [1.5, -2.9, 0, 0.3], [2.0, 0, 0, 0]]),
    qTrack('Spine', [[0, 0, 0, 0], [0.5, -0.12, 0, 0], [1.5, -0.12, 0, 0], [2.0, 0, 0, 0]]),
    qTrack('Head', [[0, 0, 0, 0], [0.5, -0.3, 0, 0], [1.5, -0.3, 0, 0], [2.0, 0, 0, 0]]),
  ]));

  return clips;
}
