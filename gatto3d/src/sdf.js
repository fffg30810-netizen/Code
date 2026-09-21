// Primitive di campo di distanza (Signed Distance Functions) e operatori di fusione.
// Unità: centimetri. Convenzione: valore negativo = dentro la superficie.

export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
export function mix(a, b, t) { return a + (b - a) * t; }
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
export function len3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
export function dist3(ax, ay, az, bx, by, bz) { return len3(ax - bx, ay - by, az - bz); }
export function norm3(x, y, z) { const l = len3(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; }

export function sdSphere(px, py, pz, cx, cy, cz, r) {
  return len3(px - cx, py - cy, pz - cz) - r;
}

// Ellissoide (approssimazione di Inigo Quilez, accurata vicino alla superficie)
export function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const k1 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz));
  return (k0 * (k0 - 1)) / k1;
}

// Capsula con raggio interpolato fra i due estremi (cono arrotondato approssimato)
export function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const bb = bax * bax + bay * bay + baz * baz;
  const h = bb > 0 ? clamp((pax * bax + pay * bay + paz * baz) / bb, 0, 1) : 0;
  const r = ra + (rb - ra) * h;
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

// Toro con asse arbitrario (nx,ny,nz normalizzato), raggio maggiore R e minore r
export function sdTorusAxis(px, py, pz, cx, cy, cz, nx, ny, nz, R, r) {
  const qx = px - cx, qy = py - cy, qz = pz - cz;
  const z = qx * nx + qy * ny + qz * nz;
  const rx = qx - nx * z, ry = qy - ny * z, rz = qz - nz * z;
  const a = len3(rx, ry, rz) - R;
  return Math.sqrt(a * a + z * z) - r;
}

// Unione morbida (polinomiale) e massimo morbido (per sottrazioni: smax(a, -b, k))
export function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}
export function smax(a, b, k) {
  const h = clamp(0.5 - (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) + k * h * (1 - h);
}
