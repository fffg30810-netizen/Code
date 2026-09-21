// Rumore a valori 3D deterministico (seed fisso) + fBm, usato per il pattern del manto.
const PERM = new Uint8Array(512);
(function seed() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 1337;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function h(ix, iy, iz) { return PERM[(PERM[(PERM[ix & 255] + iy) & 255] + iz) & 255] / 255; }
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

export function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const fx = x - X, fy = y - Y, fz = z - Z;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const c000 = h(X, Y, Z), c100 = h(X + 1, Y, Z), c010 = h(X, Y + 1, Z), c110 = h(X + 1, Y + 1, Z);
  const c001 = h(X, Y, Z + 1), c101 = h(X + 1, Y, Z + 1), c011 = h(X, Y + 1, Z + 1), c111 = h(X + 1, Y + 1, Z + 1);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w; // in [0,1]
}

export function fbm3(x, y, z, octaves = 3, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 4.7);
    norm += amp; amp *= gain; f *= lacunarity;
  }
  return sum / norm; // in [0,1], media ~0.5
}
