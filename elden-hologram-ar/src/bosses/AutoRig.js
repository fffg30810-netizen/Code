// Rigging automatico, gratuito e tutto nel browser.
//
// I modelli generati da immagine sono mesh statiche: nessuno scheletro, quindi
// niente braccia che si muovono. Qui lo scheletro viene dedotto dalla forma del
// corpo (profilo di larghezza per fasce di altezza), i pesi vengono calcolati
// per vertice in base alla distanza dalle ossa, e la mesh diventa una SkinnedMesh.
// Da quel momento si anima come un personaggio riggato, senza costi né servizi.
import * as THREE from 'three';

const NAMES = [
  'Hips', 'Spine', 'Chest', 'Head',
  'ArmL', 'ForearmL', 'HandL',
  'ArmR', 'ForearmR', 'HandR',
  'ThighL', 'ShinL', 'FootL',
  'ThighR', 'ShinR', 'FootR',
];

/** Distanza al quadrato fra un punto e un segmento. */
function distSqToSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const denom = abx * abx + aby * aby + abz * abz;
  let t = denom > 1e-9 ? (apx * abx + apy * aby + apz * abz) / denom : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}

/** Misura il corpo: altezza, larghezza delle spalle, larghezza del bacino. */
function measure(meshes) {
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min.clone();
  const H = Math.max(size.y, 1e-4);
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;

  const BANDS = 20;
  const widths = new Float32Array(BANDS);
  const radii = new Float32Array(BANDS);
  const counts = new Uint32Array(BANDS);
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const k = Math.min(BANDS - 1, Math.max(0, Math.floor(((v.y - min.y) / H) * BANDS)));
      const w = Math.abs(v.x - centerX);
      if (w > widths[k]) widths[k] = w;
      const r = Math.hypot(v.x - centerX, v.z - centerZ);
      if (r > radii[k]) radii[k] = r;
      counts[k]++;
    }
  }
  const bandMax = (from, to) => {
    let w = 0;
    for (let k = Math.floor(from * BANDS); k < Math.ceil(to * BANDS) && k < BANDS; k++) w = Math.max(w, widths[k]);
    return w;
  };
  // profilo continuo: larghezza massima a ogni altezza (0 = piedi, 1 = testa)
  const profile = (f) => {
    const x = Math.min(BANDS - 1.001, Math.max(0, f * BANDS - 0.5));
    const i = Math.floor(x), frac = x - i;
    const a = widths[i] || 1e-4, b = widths[Math.min(BANDS - 1, i + 1)] || a;
    return Math.max(1e-4, a + (b - a) * frac);
  };
  const radius = (f) => {
    const x = Math.min(BANDS - 1.001, Math.max(0, f * BANDS - 0.5));
    const i = Math.floor(x), frac = x - i;
    const a = radii[i] || 1e-4, b = radii[Math.min(BANDS - 1, i + 1)] || a;
    return Math.max(1e-4, a + (b - a) * frac);
  };
  return {
    H, min, centerX, centerZ, profile, radius,
    shoulderHalf: Math.max(0.05 * H, bandMax(0.72, 0.9) * 0.68),
    hipHalf: Math.max(0.04 * H, bandMax(0.42, 0.56) * 0.42),
    armHalf: Math.max(0.06 * H, bandMax(0.55, 0.9) * 0.78),
  };
}

/** Posizioni delle ossa (spazio locale dell'oggetto). */
function layout(mm) {
  const { H, min, centerX, centerZ, shoulderHalf, hipHalf, armHalf } = mm;
  const y = (f) => min.y + H * f;
  const P = (x, f, z = 0) => new THREE.Vector3(centerX + x, y(f), centerZ + z);
  return {
    Hips: P(0, 0.50),
    Spine: P(0, 0.60),
    Chest: P(0, 0.72),
    Head: P(0, 0.84),
    HeadTop: P(0, 1.0),

    ArmL: P(shoulderHalf, 0.80),
    ForearmL: P(armHalf * 0.85, 0.68),
    HandL: P(armHalf * 0.95, 0.55),
    HandLEnd: P(armHalf, 0.48),

    ArmR: P(-shoulderHalf, 0.80),
    ForearmR: P(-armHalf * 0.85, 0.68),
    HandR: P(-armHalf * 0.95, 0.55),
    HandREnd: P(-armHalf, 0.48),

    ThighL: P(hipHalf, 0.49),
    ShinL: P(hipHalf, 0.27),
    FootL: P(hipHalf, 0.05),
    FootLEnd: P(hipHalf, 0.0, 0.05 * H),

    ThighR: P(-hipHalf, 0.49),
    ShinR: P(-hipHalf, 0.27),
    FootR: P(-hipHalf, 0.05),
    FootREnd: P(-hipHalf, 0.0, 0.05 * H),
  };
}

/** Segmenti usati per i pesi: osso → tratto di corpo che deve seguirlo. */
function segments(L) {
  return [
    { name: 'Hips', a: L.Hips, b: L.Spine, sigma: 1.25, side: 0 },
    { name: 'Spine', a: L.Spine, b: L.Chest, sigma: 1.1, side: 0 },
    { name: 'Chest', a: L.Chest, b: L.Head, sigma: 1.15, side: 0 },
    { name: 'Head', a: L.Head, b: L.HeadTop, sigma: 1.0, side: 0 },
    { name: 'ArmL', a: L.ArmL, b: L.ForearmL, sigma: 0.7, side: 1 },
    { name: 'ForearmL', a: L.ForearmL, b: L.HandL, sigma: 0.62, side: 1 },
    { name: 'HandL', a: L.HandL, b: L.HandLEnd, sigma: 0.55, side: 1 },
    { name: 'ArmR', a: L.ArmR, b: L.ForearmR, sigma: 0.7, side: -1 },
    { name: 'ForearmR', a: L.ForearmR, b: L.HandR, sigma: 0.62, side: -1 },
    { name: 'HandR', a: L.HandR, b: L.HandREnd, sigma: 0.55, side: -1 },
    { name: 'ThighL', a: L.ThighL, b: L.ShinL, sigma: 0.8, side: 1 },
    { name: 'ShinL', a: L.ShinL, b: L.FootL, sigma: 0.72, side: 1 },
    { name: 'FootL', a: L.FootL, b: L.FootLEnd, sigma: 0.6, side: 1 },
    { name: 'ThighR', a: L.ThighR, b: L.ShinR, sigma: 0.8, side: -1 },
    { name: 'ShinR', a: L.ShinR, b: L.FootR, sigma: 0.72, side: -1 },
    { name: 'FootR', a: L.FootR, b: L.FootREnd, sigma: 0.6, side: -1 },
  ];
}

function buildBones(L) {
  const bone = (name, pos, parentPos) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(pos).sub(parentPos || new THREE.Vector3());
    return b;
  };
  const hips = bone('Hips', L.Hips);
  const spine = bone('Spine', L.Spine, L.Hips); hips.add(spine);
  const chest = bone('Chest', L.Chest, L.Spine); spine.add(chest);
  const head = bone('Head', L.Head, L.Chest); chest.add(head);

  const armL = bone('ArmL', L.ArmL, L.Chest); chest.add(armL);
  const foreL = bone('ForearmL', L.ForearmL, L.ArmL); armL.add(foreL);
  const handL = bone('HandL', L.HandL, L.ForearmL); foreL.add(handL);

  const armR = bone('ArmR', L.ArmR, L.Chest); chest.add(armR);
  const foreR = bone('ForearmR', L.ForearmR, L.ArmR); armR.add(foreR);
  const handR = bone('HandR', L.HandR, L.ForearmR); foreR.add(handR);

  const thighL = bone('ThighL', L.ThighL, L.Hips); hips.add(thighL);
  const shinL = bone('ShinL', L.ShinL, L.ThighL); thighL.add(shinL);
  const footL = bone('FootL', L.FootL, L.ShinL); shinL.add(footL);

  const thighR = bone('ThighR', L.ThighR, L.Hips); hips.add(thighR);
  const shinR = bone('ShinR', L.ShinR, L.ThighR); thighR.add(shinR);
  const footR = bone('FootR', L.FootR, L.ShinR); shinR.add(footR);

  const ordered = [hips, spine, chest, head, armL, foreL, handL, armR, foreR, handR, thighL, shinL, footL, thighR, shinR, footR];
  return { root: hips, bones: ordered };
}

/**
 * Trasforma le mesh statiche di `object` in SkinnedMesh con uno scheletro dedotto.
 * @returns {{skeleton: THREE.Skeleton, bones: Record<string, THREE.Bone>, root: THREE.Bone}|null}
 */
export function autoRig(object) {
  const meshes = [];
  object.updateMatrixWorld(true);
  object.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  if (!meshes.length) return null;

  const mm = measure(meshes);
  if (!(mm.H > 0)) return null;
  const L = layout(mm);
  const segs = segments(L);
  const { root, bones } = buildBones(L);
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  // Le ossa devono stare nella scena PRIMA di creare lo Skeleton: le matrici
  // inverse di bind si calcolano dalle matrici mondo, e senza questo passaggio
  // il modello si deforma già da fermo.
  object.add(root);
  object.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const sideBand = mm.H * 0.02;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();

  // Catene di ossa: a ogni vertice si assegna la catena giusta (busto, braccio,
  // gamba) e poi si distribuisce il peso fra le ossa della catena in base
  // all'altezza. Sui modelli stretti questo separa gli arti molto meglio della
  // sola distanza, che finirebbe per incollare le braccia al busto.
  const idxOf = (n) => boneIndex.get(n);
  // Le braccia stanno nel guscio esterno del corpo: si riconoscono dalla distanza
  // dall'asse verticale nel piano orizzontale, così vengono prese anche quando sono
  // portate in avanti sull'elsa invece che lungo i fianchi.
  const shellAt = (f) => mm.radius(f);
  const torsoCore = (f) => shellAt(f) * 0.42;
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-6)));
    return t * t * (3 - 2 * t);
  };
  // altezze di riferimento in frazione dell'altezza totale
  const F = { hip: 0.50, spine: 0.60, chest: 0.72, head: 0.84, shoulder: 0.80, elbow: 0.68, hand: 0.55, knee: 0.27, ankle: 0.05 };

  /** Distribuisce 1 di peso su una catena in base a una coordinata normalizzata. */
  function chain(out, stops) {
    // stops: [[nomeOsso, valore]...] ordinati; si mischiano i due più vicini
    for (let i = 0; i < stops.length - 1; i++) {
      const [n0, v0] = stops[i], [n1, v1] = stops[i + 1];
      if (out.f >= Math.min(v0, v1) && out.f <= Math.max(v0, v1)) {
        const k = (out.f - v0) / ((v1 - v0) || 1e-6);
        out.push(n0, 1 - k); out.push(n1, k);
        return;
      }
    }
    const [nFirst, vFirst] = stops[0];
    const [nLast, vLast] = stops[stops.length - 1];
    out.push(Math.abs(out.f - vFirst) < Math.abs(out.f - vLast) ? nFirst : nLast, 1);
  }

  for (const mesh of meshes) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const n = pos.count;
    const idx = new Uint16Array(n * 4);
    const wts = new Float32Array(n * 4);
    mesh.updateMatrixWorld(true);
    const toLocal = inv.copy(object.matrixWorld).invert().multiply(mesh.matrixWorld);

    const acc = new Map();
    const out = {
      f: 0,
      push(name, w) { if (w > 0.0005) acc.set(name, (acc.get(name) || 0) + w); },
    };

    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toLocal);
      const f = (v.y - mm.min.y) / mm.H;              // altezza normalizzata
      const xRel = v.x - mm.centerX;
      const side = xRel >= 0 ? 'L' : 'R';
      const u = Math.abs(xRel) / mm.profile(f);       // quanto è laterale (0 centro, 1 bordo)
      acc.clear();

      if (f >= F.hip - 0.04) {
        // Il braccio si riconosce dalla distanza dal suo asse, non dalla larghezza:
        // altrimenti solo il bordo esterno si muove e il braccio resta incollato al busto.
        const armBand = smooth(F.hip - 0.04, F.hip + 0.08, f) * (1 - smooth(F.shoulder + 0.03, F.shoulder + 0.16, f));
        const radial = Math.hypot(xRel, v.z - mm.centerZ);
        const armness = smooth(torsoCore(f), shellAt(f) * 0.88, radial) * armBand;
        if (armness > 0.02) {
          const a = { f: Math.min(F.shoulder, Math.max(F.hand, f)), push: (nm, w) => out.push(nm, w * armness) };
          chain(a, [[`Arm${side}`, F.shoulder], [`Forearm${side}`, F.elbow], [`Hand${side}`, F.hand]]);
        }
        const torso = 1 - armness;
        if (torso > 0.02) {
          const t = { f, push: (nm, w) => out.push(nm, w * torso) };
          chain(t, [['Hips', F.hip], ['Spine', F.spine], ['Chest', F.chest], ['Head', F.head], ['Head', 1.0]]);
        }
      } else {
        // Parte bassa: gonne, vesti e mantelli devono restare interi e seguire il
        // bacino. Solo ciò che è davvero gamba (stretto, laterale, sotto il ginocchio)
        // segue le ossa delle gambe, altrimenti l'animazione strappa il modello in due.
        const vertical = 1 - smooth(F.knee, F.hip, f);      // 0 all'anca, 1 dal ginocchio in giù
        const lateral = smooth(0.22, 0.62, u);              // il centro è veste, non gamba
        const legness = Math.min(1, vertical * lateral * 1.15);
        if (legness > 0.02) {
          const l = { f, push: (nm, w) => out.push(nm, w * legness) };
          chain(l, [[`Thigh${side}`, F.hip], [`Shin${side}`, F.knee], [`Foot${side}`, F.ankle]]);
        }
        const rest = 1 - legness;
        if (rest > 0.02) {
          // il resto si divide fra bacino e, appena sotto l'anca, un filo di busto
          out.push('Hips', rest * 0.85);
          out.push('Spine', rest * 0.15);
        }
      }

      // lato opposto: niente influenza incrociata sugli arti
      if (Math.abs(xRel) > Math.max(sideBand, 0.3 * mm.profile(f))) {
        const wrong = side === 'L' ? 'R' : 'L';
        for (const name of [`Arm${wrong}`, `Forearm${wrong}`, `Hand${wrong}`, `Thigh${wrong}`, `Shin${wrong}`, `Foot${wrong}`]) acc.delete(name);
      }
      if (!acc.size) acc.set('Hips', 1);

      const entries = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      let sum = 0;
      for (const e of entries) sum += e[1];
      const o = i * 4;
      for (let k = 0; k < 4; k++) {
        if (k < entries.length) { idx[o + k] = idxOf(entries[k][0]); wts[o + k] = entries[k][1] / sum; }
        else { idx[o + k] = 0; wts[o + k] = 0; }
      }
    }

    geom.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geom.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4));

    const skinned = new THREE.SkinnedMesh(geom, mesh.material);
    skinned.name = `${mesh.name || 'mesh'}_rigged`;
    skinned.castShadow = mesh.castShadow;
    skinned.receiveShadow = mesh.receiveShadow;
    skinned.frustumCulled = false;
    skinned.position.copy(mesh.position);
    skinned.quaternion.copy(mesh.quaternion);
    skinned.scale.copy(mesh.scale);
    const parent = mesh.parent || object;
    parent.add(skinned);
    parent.remove(mesh);
    skinned.updateMatrixWorld(true);
    skinned.bind(skeleton, skinned.matrixWorld);
  }

  object.updateMatrixWorld(true);

  const byName = {};
  for (const b of bones) byName[b.name] = b;
  return { skeleton, bones: byName, root, measures: mm, names: NAMES };
}
