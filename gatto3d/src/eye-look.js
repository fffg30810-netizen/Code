// Aspetto degli occhi di Artù (rame/ambra con bordo scuro) condiviso fra shader e texture GLB.
import { noise3 } from './noise.js';

export const EYE_LOOK = {
  irisInner: 0xd4923c,  // ambra vicino alla pupilla
  irisOuter: 0xa1581a,  // rame scuro
  rim: 0x4a2608,        // anello limbare scuro
  sclera: 0xe6d6bf,
  pupil: 0.36,          // raggio della pupilla (proiezione frontale, 0..1)
  irisEdge: 1.05,       // raggio angolare dell'iride (radianti)
};

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Colore (sRGB) dell'occhio per una direzione unitaria sulla sfera, con +Z = sguardo.
export function eyeColor(dx, dy, dz) {
  const ang = Math.acos(Math.max(-1, Math.min(1, dz)));
  const th = Math.atan2(dy, dx);
  const rr = ang / EYE_LOOK.irisEdge;
  const pr = Math.sqrt(dx * dx * 1.15 * 1.15 + dy * dy);
  const pupil = 1 - sstep(EYE_LOOK.pupil - 0.02, EYE_LOOK.pupil + 0.02, pr);
  const iris = 1 - sstep(EYE_LOOK.irisEdge - 0.03, EYE_LOOK.irisEdge + 0.03, ang);
  const fib = noise3(th * 9.0, rr * 6.0, 0.5) * 0.6 + noise3(th * 25.0 + 3.0, rr * 14.0, 2.5) * 0.4;
  const A = hex(EYE_LOOK.irisInner), B = hex(EYE_LOOK.irisOuter), R = hex(EYE_LOOK.rim), S = hex(EYE_LOOK.sclera);
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let c = lerp(A[i], B[i], sstep(0.15, 0.85, rr));
    c *= 0.75 + 0.5 * fib;
    c = lerp(c, R[i], sstep(0.78, 1.0, rr));
    c = lerp(c, A[i] * 1.12, (1 - sstep(0.25, 0.45, rr)) * 0.5);
    c = lerp(S[i], c, iris);
    c = lerp(c, 0.02, pupil);
    out[i] = Math.max(0, Math.min(1, c));
  }
  return out;
}

// Texture RGBA per una SphereGeometry di three.js (u = longitudine attorno a Y, v = 1 - polare).
export function bakeEyeTexture(w, h) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = 1 - (y + 0.5) / h, theta = v * Math.PI;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, phi = u * Math.PI * 2;
      const dx = -Math.cos(phi) * Math.sin(theta), dy = Math.cos(theta), dz = Math.sin(phi) * Math.sin(theta);
      const c = eyeColor(dx, dy, dz);
      const o = (y * w + x) * 4;
      rgba[o] = c[0] * 255; rgba[o + 1] = c[1] * 255; rgba[o + 2] = c[2] * 255; rgba[o + 3] = 255;
    }
  }
  return rgba;
}
