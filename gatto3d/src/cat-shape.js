// Anatomia di Artù (Persiano rosso tabby) come campo di distanza, più lunghezza del pelo,
// colore del manto per vertice e curve dei baffi. Unità: centimetri, origine a terra sotto il gatto,
// +Y verso l'alto, +Z davanti (direzione del muso), +X = lato sinistro del gatto.
import { sdSphere, sdEllipsoid, sdCapsule, sdTorusAxis, smin, smax, clamp, mix, smoothstep, len3, dist3, norm3 } from './sdf.js';
import { fbm3 } from './noise.js';

export const HEAD = { x: 0, y: 21.6, z: 3.0 };
export const EYE_R = 1.4;
export const EYES = [-1, 1].map((s) => {
  const g = norm3(s * 0.06, 0.0, 1);
  // base ortonormale dell'occhio: f = sguardo, r = destra, u = alto
  const r = norm3(g.z, 0, -g.x);
  const u = { x: r.y * g.z - r.z * g.y, y: r.z * g.x - r.x * g.z, z: r.x * g.y - r.y * g.x };
  return { s, x: s * 2.35, y: 0.55, z: 3.75, gx: g.x, gy: g.y, gz: g.z, r, u };
});
// Apertura palpebrale (nel riferimento dell'occhio): semiassi e spostamento verso il basso,
// così la palpebra superiore copre la parte alta dell'iride.
export const LID = { rx: 1.2, ry: 0.95, dy: -0.1, depth: 1.0, rz: 1.4 };
export const NOSE = { x: 0, y: -0.55, z: 5.25 };
export const MUZZLE = { x: 0, y: -1.75, z: 4.5 };
export const CHIN = { x: 0, y: -3.4, z: 3.7 };
export const EARS = [-1, 1].map((s) => ({ s, bx: s * 4.3, by: 2.8, bz: -0.6, tx: s * 5.7, ty: 5.9, tz: -0.3 }));
export const TAIL = [[0, 3.4, -11], [4.6, 2.6, -12.8], [9.3, 2.2, -10.2], [11.7, 2.0, -4.5], [11.4, 2.0, 2.6], [9.0, 2.1, 7.8]];
export const TAIL_R = [2.3, 2.3, 2.15, 2.0, 1.85, 1.7];

// Dominio della testa (maglia fine) e del corpo (maglia più grossa)
export const HEAD_BOX = { min: { x: -9.2, y: 15.8, z: -6.8 }, max: { x: 9.2, y: 30.4, z: 10.4 } };
export const BODY_BOX = { min: { x: -17, y: -0.13, z: -17 }, max: { x: 17, y: 18.2, z: 13 } };

// ---------------------------------------------------------------- Testa
function sdEar(qx, qy, qz, e) {
  // capsula conica appiattita lungo z (spessore ridotto al 55%)
  const mz = (e.bz + e.tz) * 0.5;
  const qz2 = mz + (qz - mz) / 0.55;
  return sdCapsule(qx, qy, qz2, e.bx, e.by, e.bz, e.tx, e.ty, e.tz, 2.1, 0.75) * 0.55;
}

export function headSDF(qx, qy, qz) {
  let d = sdEllipsoid(qx, qy, qz, 0, 0, 0, 5.9, 5.4, 5.0);                 // cranio
  d = smin(d, sdSphere(qx, qy, qz, 0, 1.6, 2.2, 3.5), 1.5);                // fronte bombata
  d = smin(d, sdEllipsoid(qx, qy, qz, 0, -2.9, 1.4, 4.6, 2.4, 3.6), 1.5);  // massa della mascella
  for (const s of [-1, 1]) d = smin(d, sdSphere(qx, qy, qz, s * 3.5, -1.7, 2.3, 3.3), 1.2); // guance piene
  d = smin(d, sdEllipsoid(qx, qy, qz, MUZZLE.x, MUZZLE.y, MUZZLE.z, 2.6, 1.55, 1.35), 0.7); // cuscinetti dei baffi
  d = smin(d, sdSphere(qx, qy, qz, CHIN.x, CHIN.y, CHIN.z, 1.55), 0.8);   // mento
  for (const e of EARS) {
    d = smin(d, sdEar(qx, qy, qz, e), 0.8);
    const mx = (e.bx + e.tx) * 0.5 + e.s * 0.25, my = (e.by + e.ty) * 0.5 + 0.5, mz = (e.bz + e.tz) * 0.5;
    d = smax(d, -sdEllipsoid(qx, qy, qz, mx, my, mz + 1.25, 1.2, 2.0, 0.9), 0.3); // conca del padiglione
  }
  for (const e of EYES) {
    d = smin(d, sdSphere(qx, qy, qz, e.x, e.y, e.z, EYE_R + 0.15), 0.45);   // palpebre: guscio attorno al bulbo
    const px = qx - e.x, py = qy - e.y, pz = qz - e.z;
    const lx = px * e.r.x + py * e.r.y + pz * e.r.z;
    const ly = px * e.u.x + py * e.u.y + pz * e.u.z;
    const lz = px * e.gx + py * e.gy + pz * e.gz;
    d = smax(d, -sdEllipsoid(lx, ly, lz, 0, LID.dy, LID.depth, LID.rx, LID.ry, LID.rz), 0.15); // apertura palpebrale
    d = smax(d, -sdSphere(qx, qy, qz, e.x, e.y, e.z, EYE_R + 0.05), 0.1);  // cavità per il bulbo
  }
  d = smin(d, sdEllipsoid(qx, qy, qz, NOSE.x, NOSE.y, NOSE.z, 0.88, 0.62, 0.5), 0.3); // tartufo
  return d;
}

// ---------------------------------------------------------------- Corpo (seduto)
export function bodySDF(px, py, pz) {
  let d = sdEllipsoid(px, py, pz, 0, 6.8, -4.5, 7.6, 6.6, 8.2);             // posteriore
  d = smin(d, sdCapsule(px, py, pz, 0, 7, -3, 0, 14.5, 1.2, 6.4), 3.0);     // tronco
  d = smin(d, sdSphere(px, py, pz, 0, 12.5, 4.2, 4.8), 2.5);                // petto
  d = smin(d, sdCapsule(px, py, pz, 0, 14, 1.5, 0, 19.5, 2.8, 4.6), 2.5);   // collo
  for (const s of [-1, 1]) {
    d = smin(d, sdEllipsoid(px, py, pz, s * 6.4, 6.2, -3.5, 3.5, 5.0, 6.0), 2.5);    // cosce
    d = smin(d, sdCapsule(px, py, pz, s * 3.6, 1.4, 5.6, s * 3.9, 12.5, 3.6, 2.3), 1.6); // zampe anteriori
    d = smin(d, sdEllipsoid(px, py, pz, s * 3.7, 1.7, 7.3, 2.5, 1.7, 3.3), 1.0);     // zampe anteriori (piede)
    d = smin(d, sdEllipsoid(px, py, pz, s * 6.4, 1.5, 2.6, 2.2, 1.5, 3.0), 1.2);     // piedi posteriori
  }
  let t = 1e9;
  for (let i = 0; i < TAIL.length - 1; i++) {
    const a = TAIL[i], b = TAIL[i + 1];
    t = Math.min(t, sdCapsule(px, py, pz, a[0], a[1], a[2], b[0], b[1], b[2], TAIL_R[i], TAIL_R[i + 1]));
  }
  d = smin(d, t, 2.2);                                                       // coda
  return d;
}

export function catSDF(px, py, pz) {
  const h = headSDF(px - HEAD.x, py - HEAD.y, pz - HEAD.z);
  const d = py < 23 ? smin(bodySDF(px, py, pz), h, 2.0) : h;
  return Math.max(d, -py); // appoggio piatto a terra
}

// Distanza (positiva dentro) dal bordo di una scatola
function boxInset(p, box) {
  return Math.min(p.x - box.min.x, box.max.x - p.x, p.y - box.min.y, box.max.y - p.y, p.z - box.min.z, box.max.z - p.z);
}
// Per la maglia del corpo: dentro il dominio della testa la superficie viene ritirata di 1,5 mm
// così resta nascosta sotto la maglia fine della testa, senza z-fighting.
export function bodyMeshSDF(px, py, pz) {
  const d = catSDF(px, py, pz);
  const inset = boxInset({ x: px, y: py, z: pz }, HEAD_BOX);
  return d + 0.15 * smoothstep(0, 1.5, inset);
}
export const headMeshSDF = catSDF;

// ---------------------------------------------------------------- Coda: parametro lungo la curva
const TAIL_SEG = [];
let TAIL_LEN = 0;
for (let i = 0; i < TAIL.length - 1; i++) {
  const a = TAIL[i], b = TAIL[i + 1];
  const L = dist3(a[0], a[1], a[2], b[0], b[1], b[2]);
  TAIL_SEG.push({ a, b, L, start: TAIL_LEN });
  TAIL_LEN += L;
}
export function tailParam(px, py, pz) {
  let bt = 0, bd = 1e9;
  for (const s of TAIL_SEG) {
    const bax = s.b[0] - s.a[0], bay = s.b[1] - s.a[1], baz = s.b[2] - s.a[2];
    const h = clamp(((px - s.a[0]) * bax + (py - s.a[1]) * bay + (pz - s.a[2]) * baz) / (s.L * s.L), 0, 1);
    const d = dist3(px, py, pz, s.a[0] + bax * h, s.a[1] + bay * h, s.a[2] + baz * h);
    if (d < bd) { bd = d; bt = (s.start + h * s.L) / TAIL_LEN; }
  }
  return { t: bt, d: bd };
}

function segDist(px, py, pz, ax, ay, az, bx, by, bz) {
  return sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, 0);
}

// Maschera morbida della testa (ellissoide che comprende anche le orecchie)
export function headMask(qx, qy, qz) {
  const hd = Math.sqrt((qx * qx) / (8.5 * 8.5) + ((qy - 1.5) * (qy - 1.5)) / (8.5 * 8.5) + (qz * qz) / (8.0 * 8.0));
  return 1 - smoothstep(0.9, 1.2, hd);
}

// ---------------------------------------------------------------- Lunghezza del pelo (cm)
export function furLength(px, py, pz) {
  const qx = px - HEAD.x, qy = py - HEAD.y, qz = pz - HEAD.z;
  let L = 3.2;
  L = mix(L, 4.6, 1 - smoothstep(4.5, 9.5, dist3(px, py, pz, 0, 16.5, 4.5)));   // collare (ruff)
  L = mix(L, 2.6, 1 - smoothstep(3.5, 8, py));                                  // parte bassa
  for (const s of [-1, 1]) {
    L = mix(L, 2.0, 1 - smoothstep(2.6, 4.5, segDist(px, py, pz, s * 3.6, 1.4, 5.6, s * 3.9, 12.5, 3.6)));
    L = mix(L, 1.1, 1 - smoothstep(2.8, 4.5, dist3(px, py, pz, s * 3.7, 1.6, 7.6)));
    L = mix(L, 1.6, 1 - smoothstep(2.6, 4.2, dist3(px, py, pz, s * 6.4, 1.5, 2.8)));
  }
  const tp = tailParam(px, py, pz);
  if (tp.d < 6) L = mix(L, mix(3.9, 2.4, tp.t), 1 - smoothstep(3.0, 6.0, tp.d));

  // testa
  const hm = headMask(qx, qy, qz);
  if (hm > 0) {
    let H = 2.2;
    const cheek = smoothstep(2.4, 4.0, Math.abs(qx)) * (1 - smoothstep(0.8, 2.2, qy)) * smoothstep(-0.5, 1.5, qz);
    H = mix(H, 3.0, cheek);
    H = mix(H, 3.6, 1 - smoothstep(-5.0, -3.0, qy));                            // sotto il mento → collare
    const fore = smoothstep(0.5, 1.5, qy) * smoothstep(1.5, 3.0, qz) * (1 - smoothstep(3.0, 4.5, Math.abs(qx)));
    H = mix(H, 1.0, fore);
    for (const e of EARS) {
      const upper = smoothstep(e.by + 1.2, e.by + 2.4, qy);
      H = mix(H, mix(1.6, 0.6, upper), 1 - smoothstep(1.7, 2.9, segDist(qx, qy, qz, e.bx, e.by, e.bz, e.tx, e.ty, e.tz)));
    }
    let ed = 1e9;
    for (const e of EYES) ed = Math.min(ed, dist3(qx, qy, qz, e.x, e.y, e.z));
    H = mix(H, 0.15, 1 - smoothstep(1.55, 2.6, ed));
    H = mix(H, 0.4, 1 - smoothstep(2.4, 3.4, dist3(qx, qy, qz, MUZZLE.x, MUZZLE.y, MUZZLE.z)));
    H = mix(H, 0.05, 1 - smoothstep(0.85, 1.4, dist3(qx, qy, qz, NOSE.x, NOSE.y, NOSE.z)));
    H = mix(H, 0.7, 1 - smoothstep(1.4, 2.4, dist3(qx, qy, qz, CHIN.x, CHIN.y, CHIN.z)));
    H = mix(H, 0.25, 1 - smoothstep(0.35, 0.8, segDist(qx, qy, qz, -1.3, NOSE.y - 1.35, 5.6, 1.3, NOSE.y - 1.35, 5.6))); // linea della bocca
    L = mix(L, H, hm);
  }
  return L;
}

// ---------------------------------------------------------------- Colore del manto (sRGB 0..1)
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const COL = {
  base: hex(0xe2a96c),   // pesca-albicocca
  cream: hex(0xf2dfbd),  // crema pesca (collare, mento, petto)
  mark: hex(0xb8672a),   // marcature tabby rosse
  deep: hex(0x8a4618),   // marcature scure (fronte)
  back: hex(0xd1863c),   // dorso più caldo
  earBack: hex(0xc4783a),
  nose: hex(0xc8837a),
  tear: hex(0x6b3a24),
  liner: hex(0x4a2a1a),
};
function mixInto(c, target, t) {
  t = clamp(t, 0, 1);
  c[0] += (target[0] - c[0]) * t; c[1] += (target[1] - c[1]) * t; c[2] += (target[2] - c[2]) * t;
}

export function catColor(px, py, pz, nx, ny, nz) {
  const qx = px - HEAD.x, qy = py - HEAD.y, qz = pz - HEAD.z;
  const wn = fbm3(px * 0.18, py * 0.18, pz * 0.18, 3) - 0.5;      // deformazione ampia
  const grain = fbm3(px * 0.9 + 3, py * 0.9, pz * 0.9, 2) - 0.5;  // grana fine
  const c = COL.base.slice();
  const hm = headMask(qx, qy, qz);

  // ---- corpo
  const up = smoothstep(-0.1, 0.8, ny);
  const dorsal = up * smoothstep(5, 13, py);
  mixInto(c, COL.back, 0.45 * dorsal);
  const s = Math.sin(pz * 0.95 + wn * 7.0 + py * 0.15);
  const bands = smoothstep(0.25, 0.75, s + grain * 0.9);
  const side = smoothstep(0.15, 0.85, Math.abs(nx)) * smoothstep(4, 9, py);
  const blotch = smoothstep(0.56, 0.68, fbm3(px * 0.25 + 11, py * 0.25, pz * 0.25, 3) + grain * 0.3);
  const marks = clamp(bands * (dorsal * 0.9 + side * 0.35) + blotch * side * 0.6, 0, 1);
  mixInto(c, COL.mark, 0.72 * marks * (1 - hm));
  const front = smoothstep(0.15, 0.75, nz);
  const down = smoothstep(-0.1, -0.8, ny);
  const low = 1 - smoothstep(5, 16, py);
  const ruffZone = 1 - smoothstep(4.5, 9.0, dist3(px, py, pz, 0, 16.0, 5.0));
  const creamAmt = clamp(front * low * 0.35 + down * 0.45 + ruffZone * 0.45, 0, 0.55);
  mixInto(c, COL.cream, creamAmt * (1 - hm * 0.7));
  for (const sg of [-1, 1]) {   // zampe anteriori un po' più chiare
    const ld = segDist(px, py, pz, sg * 3.6, 1.4, 5.6, sg * 3.9, 12.5, 3.6);
    mixInto(c, COL.cream, 0.25 * (1 - smoothstep(2.5, 4.5, ld)) * (1 - hm));
  }
  const tp = tailParam(px, py, pz);
  if (tp.d < 5.5) {
    const tailMask = 1 - smoothstep(2.5, 5.5, tp.d);
    const ring = smoothstep(0.35, 0.7, Math.sin(tp.t * 24.0 + wn * 4.0) + grain * 0.6);
    mixInto(c, COL.mark, 0.65 * ring * tailMask);
    mixInto(c, COL.deep, 0.5 * smoothstep(0.86, 1.0, tp.t) * tailMask);
  }

  // ---- testa
  if (hm > 0) {
    const hc = COL.base.slice();
    mixInto(hc, COL.back, 0.55 * smoothstep(0.0, 0.8, ny) + 0.3 * smoothstep(0.5, 3.0, qy));
    mixInto(hc, COL.cream, 0.35 * (1 - smoothstep(-2.0, -0.2, qy)));              // parte bassa del muso
    mixInto(hc, COL.cream, 0.55 * (1 - smoothstep(-5.0, -3.2, qy)));              // sotto la mascella
    mixInto(hc, COL.cream, 0.55 * (1 - smoothstep(2.3, 3.4, dist3(qx, qy, qz, MUZZLE.x, MUZZLE.y, MUZZLE.z))));
    mixInto(hc, COL.cream, 0.55 * (1 - smoothstep(1.5, 2.6, dist3(qx, qy, qz, CHIN.x, CHIN.y, CHIN.z))));
    for (const e of EYES) {
      const ex = qx - e.x, ey = qy - e.y, ez = qz - e.z;
      if (ez > 0.4) {
        const ad = Math.sqrt((ex / LID.rx) ** 2 + ((ey - LID.dy) / LID.ry) ** 2);
        mixInto(hc, COL.liner, 0.7 * smoothstep(0.88, 1.02, ad) * (1 - smoothstep(1.12, 1.3, ad)));   // riga scura sul margine delle palpebre
        mixInto(hc, COL.cream, 0.35 * smoothstep(1.6, 2.0, ad) * (1 - smoothstep(2.5, 3.1, ad)));   // "occhiali" chiari
      }
      const tear = segDist(qx, qy, qz, e.s * 1.35, 0.05, 4.65, e.s * 0.95, -1.2, 5.05);
      mixInto(hc, COL.tear, 0.6 * (1 - smoothstep(0.22, 0.45, tear)));                            // riga lacrimale
      const cs1 = segDist(qx, qy, qz, e.s * 3.5, 0.3, 4.1, e.s * 5.9, -1.4, 1.0);
      const cs2 = segDist(qx, qy, qz, e.s * 3.6, -0.9, 3.9, e.s * 5.8, -2.9, 1.4);
      const cheekStripes = Math.max(1 - smoothstep(0.25, 0.55, cs1 + wn * 0.3), 1 - smoothstep(0.25, 0.55, cs2 + wn * 0.3));
      mixInto(hc, COL.mark, 0.7 * cheekStripes);
    }
    // "M" della fronte + strisce sulla sommità
    const ax = Math.abs(qx);
    const yWin = (lo, hi) => smoothstep(lo, lo + 0.5, qy) * (1 - smoothstep(hi - 0.5, hi, qy));
    const centerLine = (1 - smoothstep(0.22, 0.48, ax + wn * 0.2)) * yWin(1.2, 5.5);
    const armIn = (1 - smoothstep(0.22, 0.48, Math.abs(ax - (1.0 + 0.6 * (qy - 0.8))) + wn * 0.25)) * yWin(0.8, 4.8);
    const armOut = (1 - smoothstep(0.25, 0.5, Math.abs(ax - (3.5 + 0.3 * (qy - 0.8))) + wn * 0.25)) * yWin(0.8, 4.2);
    const frontal = smoothstep(0.0, 1.5, qz + 0.5 * (qy - 1.0));
    const M = clamp(centerLine + armIn + armOut, 0, 1) * frontal;
    mixInto(hc, COL.deep, 0.75 * M);
    const crown = smoothstep(0.45, 0.75, Math.sin(qx * 2.4 + wn * 3.5) + grain * 0.6) * smoothstep(0.3, 0.8, ny) * smoothstep(2.0, 3.5, qy);
    mixInto(hc, COL.mark, 0.55 * crown);
    for (const e of EARS) {
      const earM = 1 - smoothstep(1.7, 2.6, segDist(qx, qy, qz, e.bx, e.by, e.bz, e.tx, e.ty, e.tz));
      mixInto(hc, COL.earBack, 0.7 * earM * (1 - smoothstep(0.0, 0.5, nz)));
      mixInto(hc, COL.cream, 0.3 * earM * smoothstep(0.1, 0.6, nz));
      mixInto(hc, COL.mark, 0.35 * earM * smoothstep(0.3, 0.75, Math.abs(nx)));
    }
    mixInto(hc, COL.mark, 0.25 * smoothstep(0.55, 0.7, fbm3(qx * 0.6 + 5, qy * 0.6, qz * 0.6, 3)) * smoothstep(0.0, 1.0, qy));
    mixInto(hc, COL.nose, 1 - smoothstep(0.75, 1.0, dist3(qx, qy, qz, NOSE.x, NOSE.y, NOSE.z)));
    c[0] = mix(c[0], hc[0], hm); c[1] = mix(c[1], hc[1], hm); c[2] = mix(c[2], hc[2], hm);
  }
  const g = 1 + grain * 0.12;
  return [clamp(c[0] * g, 0, 1), clamp(c[1] * g, 0, 1), clamp(c[2] * g, 0, 1)];
}

// ---------------------------------------------------------------- Baffi (coordinate locali della testa)
export function whiskerCurves() {
  const list = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const s of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const rx = s * (0.85 + 0.5 * col + 0.15 * rnd()), ry = -0.95 - 0.42 * row + 0.1 * (rnd() - 0.5), rz = 5.15 - 0.15 * col - 0.12 * row;
        const L = 5.0 + 2.2 * rnd() + (col === 2 ? 0.6 : 0);
        const d = norm3(s * (0.85 + 0.15 * rnd()), 0.15 - 0.22 * row + 0.1 * (rnd() - 0.5), 0.55 - 0.1 * row);
        const droop = 0.35 + 0.4 * rnd();
        list.push({
          p0: [rx, ry, rz],
          p1: [rx + d.x * L * 0.55, ry + d.y * L * 0.55 + 0.35, rz + d.z * L * 0.55],
          p2: [rx + d.x * L, ry + d.y * L - droop * L * 0.35, rz + d.z * L * 0.9],
          r: 0.03,
        });
      }
    }
    for (let i = 0; i < 3; i++) { // sopracciglia
      const rx = s * (2.0 + 0.5 * i), ry = 2.05 + 0.15 * i, rz = 3.9 - 0.2 * i;
      const L = 3.0 + 1.2 * rnd();
      const d = norm3(s * 0.45, 0.75, 0.45);
      list.push({
        p0: [rx, ry, rz],
        p1: [rx + d.x * L * 0.5, ry + d.y * L * 0.5, rz + d.z * L * 0.5 + 0.2],
        p2: [rx + d.x * L, ry + d.y * L - 0.1 * L, rz + d.z * L],
        r: 0.03,
      });
    }
  }
  return list;
}
