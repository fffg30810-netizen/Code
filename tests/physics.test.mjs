// Physics validation for src/physics.js. Run with: node tests/physics.test.mjs
// Every check compares the code with an independent textbook result.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const K = require('../src/physics.js');

let failures = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}: got ${fmt(got)}, want ${fmt(want)} (±${tol})`);
}
const fmt = (x) => (Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(5) : x.toFixed(6));

/* 1. Metric: g · g⁻¹ = 1, inside and outside the horizon */
{
  let worst = 0;
  for (const [a, r, th] of [[0.9, 5, 1.1], [0.9, 1.2, 0.4], [0.5, 0.7, 2.5], [0.998, 1.07, 1.5707], [0, 3, 0.8]]) {
    const g = K.metricIK(a, r, th), gi = K.invMetricIK(a, r, th);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += g[i][k] * gi[k][j];
      worst = Math.max(worst, Math.abs(s - (i === j ? 1 : 0)));
    }
  }
  check('metric × inverse metric = identity', worst, 0, 1e-12);
}

/* 2. Doran observer: unit timelike, tetrad orthonormal, even inside the horizon */
{
  let worst = 0;
  for (const [a, r, th] of [[0.9, 12, 1.2], [0.9, 1.3, 1.2], [0.9, 0.62, 0.9], [0, 1.0, 1.5], [0.6, 30, 0.3]]) {
    const f = K.doranFrame(a, r, th);
    const vs = [f.u, f.er, f.eth, f.eph];
    const eta = [-1, 1, 1, 1];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const d = K.contract(f.g, vs[i], vs[j]) - (i === j ? eta[i] : 0);
      worst = Math.max(worst, Math.abs(d));
    }
    const ud = K.lower(f.g, f.u);
    for (let i = 0; i < 4; i++) worst = Math.max(worst, Math.abs(ud[i] - f.ud[i]));
  }
  check('Doran tetrad orthonormal (max error)', worst, 0, 1e-12);
}

/* 3. Photons built from the camera are null */
{
  let worst = 0;
  for (const [a, r, th] of [[0.9, 20, 1.3], [0.9, 1.0, 1.0]]) {
    const cam = K.cameraFrame(a, r, th, 0.3, -0.2);
    const gi = K.invMetricIK(a, r, th);
    for (const [x, y] of [[0, 0], [0.5, -0.3], [-1.2, 0.9]]) {
      const p = K.pixelMomentum(cam, x, y);
      const u = cam.frame.u;
      worst = Math.max(worst, Math.abs(K.contract(gi, p, p)));
      worst = Math.max(worst, Math.abs(-(p[0] * u[0] + p[1] * u[1] + p[2] * u[2] + p[3] * u[3]) - 1));
    }
  }
  check('pixel photons are null with unit observed energy', worst, 0, 1e-12);
}

/* 4. Rain observer in Schwarzschild: light from straight above arrives
      redshifted by 1/(1+β); exactly 1/2 on the horizon. */
{
  const up = (r) => {
    const cam = K.cameraFrame(0, r, 1.0, Math.PI, 0); // yaw π: looking straight outward
    return K.observedShift(cam, 0, 0);
  };
  check('sky overhead at the horizon, a=0 (g = 1/2)', up(2), 0.5, 1e-9);
  check('sky overhead at r = 8, a=0 (g = 2/3)', up(8), 2 / 3, 1e-9);
}

/* 5. Special radii */
{
  check('ISCO a=0', K.iscoRadius(0), 6, 1e-12);
  check('ISCO a=0.9', K.iscoRadius(0.9), 2.320883, 1e-5);
  check('ISCO a=0.998', K.iscoRadius(0.998), 1.236970, 1e-5);
  check('prograde photon orbit a=0', K.photonOrbits(0).pro, 3, 1e-12);
  const o = K.circularOrbit(0, 6);
  check('E at ISCO a=0 (√(8/9))', o.E, Math.sqrt(8 / 9), 1e-12);
}

/* 6. Shadow of a Schwarzschild hole: critical impact parameter 3√3 */
function shadowEdge(a, th, dirx, diry, rCam = 2000) {
  const cam = K.cameraFrame(a, rCam, th);
  let lo = 0, hi = 12 / rCam;
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    const t = K.trace(a, rCam, th, K.pixelMomentum(cam, m * dirx, m * diry), { k: 0.05, maxSteps: 20000 });
    if (t.fate === 'sky') hi = m; else lo = m;
  }
  const p = K.pixelMomentum(cam, 0.5 * (lo + hi) * dirx, 0.5 * (lo + hi) * diry);
  return K.photonState(a, rCam, th, p);
}
{
  const c = shadowEdge(0, Math.PI / 2, 1, 0);
  check('Schwarzschild shadow radius b = 3√3', Math.sqrt(c.Q + c.L * c.L) / c.E, 3 * Math.sqrt(3), 2e-4);
}

/* 7. Kerr a = 0.9 seen edge-on: horizontal edges of the shadow sit at
      L/E = ξ(r_ph) of the equatorial photon orbits (Bardeen 1973). */
{
  const a = 0.9;
  const xi = (r) => (r * r * (3 - r) - a * a * (r + 1)) / (a * (r - 1));
  const po = K.photonOrbits(a);
  const right = shadowEdge(a, Math.PI / 2, 1, 0);
  const left = shadowEdge(a, Math.PI / 2, -1, 0);
  const got = [right.L / right.E, left.L / left.E].sort((x, y) => x - y);
  const want = [xi(po.retro), xi(po.pro)].sort((x, y) => x - y);
  check('Kerr a=0.9 shadow edge (retrograde side) L/E', got[0], want[0], 5e-4);
  check('Kerr a=0.9 shadow edge (prograde side) L/E', got[1], want[1], 5e-4);
  // Top edge: L = 0 photon orbit, η = Q/E² from the spherical photon orbit with ξ = 0.
  let lo = 1.5, hi = 4;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); if (xi(m) > 0) lo = m; else hi = m; }
  const r0 = 0.5 * (lo + hi);
  const eta = (r0 ** 3 * (4 * a * a - r0 * (r0 - 3) ** 2)) / (a * a * (r0 - 1) ** 2);
  const top = shadowEdge(a, Math.PI / 2, 0, 1);
  check('Kerr a=0.9 shadow top edge Q/E²', top.Q / (top.E * top.E), eta, 2e-3);
}

/* 8. Gravitational redshift of the disk seen face-on: g = √(1 − 3/r) at infinity */
{
  const a = 0, rCam = 3000, th = 1e-4;
  const cam = K.cameraFrame(a, rCam, th);
  const disk = K.diskOrbits(a);
  let lo = 0, hi = 20 / rCam, hit = null;
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    const t = K.trace(a, rCam, th, K.pixelMomentum(cam, m, 0), { k: 0.05, maxSteps: 20000 });
    const c0 = t.crossings[0];
    if (!c0 || c0.r > 8) hi = m; else lo = m;
    if (c0) hit = { c0, t };
  }
  const g = K.diskRedshift(a, hit.t.c, hit.c0.r, hit.c0.X, disk);
  check('face-on disk redshift at r = 8 (×E → √(1−3/8))', g * hit.t.c.E, Math.sqrt(1 - 3 / 8), 2e-4);
}

/* 9. Page–Thorne efficiency: ∫ r F E dr = 1 − E_ISCO */
for (const a of [0, 0.9]) {
  const rI = K.iscoRadius(a);
  const prof = K.pageThorneProfile(a, rI, 2e5, 20000);
  let eta = 0;
  for (let i = 1; i < prof.r.length; i++) {
    const f = (j) => prof.F[j] * prof.r[j] * K.circularOrbit(a, prof.r[j]).E;
    eta += 0.5 * (f(i) + f(i - 1)) * (prof.r[i] - prof.r[i - 1]);
  }
  check(`Page–Thorne radiative efficiency a=${a}`, eta, 1 - K.circularOrbit(a, rI).E, 2e-4);
}

/* 10. Newtonian limit of the flux far out: F r³ → 3/2 */
{
  const prof = K.pageThorneProfile(0, 6, 1e9, 6000);
  const i = prof.r.length - 1, r = prof.r[i];
  check('Page–Thorne flux, Newtonian limit F r³ at r = 10⁹', prof.F[i] * r ** 3, 1.5, 5e-3);
}

/* 11. Plunging gas: R(r) = r (1 − E²)(r_I − r)³ exactly, starts from rest at the ISCO */
{
  const a = 0.9, disk = K.diskOrbits(a);
  let worst = 0;
  for (const r of [0.8, 1.2, 1.6, 2.0]) {
    const ra = r * r + a * a, D = r * r - 2 * r + a * a;
    const Pu = disk.EI * ra - a * disk.LI;
    const direct = Pu * Pu - D * (r * r + (disk.LI - a * disk.EI) ** 2);
    worst = Math.max(worst, Math.abs(direct - K.plungePotential(r, disk)) / Math.abs(direct));
  }
  check('plunge potential factorisation (relative error)', worst, 0, 1e-10);
  check('plunge starts from rest at the ISCO (dr/dτ)', K.plungeRadialVelocity(a, disk.rI * 0.999999, disk), 0, 1e-6);
  const psi = [2.2, 2.0, 1.6, 1.44].map((r) => K.plungePhase(a, r, disk));
  console.log(`info  plunge phase Ψ(r) for r = 2.2, 2.0, 1.6, 1.44 (a=0.9): ${psi.map((x) => x.toFixed(3)).join(', ')}`);
  check('plunge phase finite and smooth near the ISCO', Math.abs(K.plungePhase(a, disk.rI - 1e-6, disk)), 0, 1e-2);
}

/* 11b. Plunging-region thermodynamics (Mummery & Balbus 2023) */
{
  const disk = K.diskOrbits(0.5);
  const near = K.plungeThermo(disk.rI * (1 - 1e-9), disk);
  check('plunge temperature continuous at the ISCO', near.T, 1, 1e-6);
  // As ε → 0 the central temperature has its minimum at r_I/2 for any γ.
  let best = null;
  for (let x = 0.2; x < 0.99; x += 0.0005) {
    const th = K.plungeThermo(x * disk.rI, disk, 1e-7, 4 / 3);
    const Tc = th.T * Math.pow(th.sigma, 0.25);
    if (!best || Tc < best.Tc) best = { x, Tc };
  }
  check('plunge central temperature minimum at r_I/2', best.x, 0.5, 2e-3);
  const lut = K.diskLUT(0.9);
  console.log(`info  disk LUT a=0.9: T peak at r = ${lut.rPeak.toFixed(3)}, T_ISCO/T_peak = ${lut.TIrel.toFixed(3)}`);
}

/* 12b. What a free-faller sees (Schwarzschild): the dark region seen by an
       observer falling from rest at infinity has angular radius ψ with
       cos ψ = (β + sS)/(1 + sβS), β = √(2/r), S = √(1 − 27(1 − 2/r)/r²),
       s = +1 outside r = 3, −1 inside (Chang & Zhu 2020): arccos(23/31) = 42.10° on the horizon. */
{
  const want = (r) => {
    if (r === 2) return (Math.acos(23 / 31) * 180) / Math.PI; // the 0/0 limit on the horizon
    const b = Math.sqrt(2 / r), S = Math.sqrt(1 - (27 * (1 - 2 / r)) / (r * r)), sg = r > 3 ? 1 : -1;
    return (Math.acos((b + sg * S) / (1 + sg * b * S)) * 180) / Math.PI;
  };
  for (const r of [10, 3.5, 2, 1]) {
    const cam = K.cameraFrame(0, r, Math.PI / 2);
    let lo = 0, hi = 20;   // tan of the angle from straight down
    for (let i = 0; i < 50; i++) {
      const m = 0.5 * (lo + hi);
      const t = K.trace(0, r, Math.PI / 2, K.pixelMomentum(cam, m, 0), { k: 0.03, maxSteps: 40000 });
      if (t.fate === 'sky') hi = m; else lo = m;
    }
    check(`free-fall shadow radius at r = ${r} (degrees)`, (Math.atan(0.5 * (lo + hi)) * 180) / Math.PI, want(r), 0.02);
  }
}

/* 12. Inside the horizon: looking outward reaches the sky, looking inward does not */
{
  const a = 0.9, r = 1.0, th = 1.0;
  const cam = K.cameraFrame(a, r, th);
  const outward = K.trace(a, r, th, K.pixelMomentum(K.cameraFrame(a, r, th, Math.PI, 0), 0, 0), { k: 0.05 });
  const inward = K.trace(a, r, th, K.pixelMomentum(cam, 0, 0), { k: 0.05 });
  console.log(`info  inside r=1.0: outward ray → ${outward.fate}, inward ray → ${inward.fate}`);
  check('inside horizon, outward ray escapes (1 = yes)', outward.fate === 'sky' ? 1 : 0, 1, 0);
  check('inside horizon, inward ray is dark (1 = yes)', inward.fate !== 'sky' ? 1 : 0, 1, 0);
}

/* 13. Integrator accuracy vs step parameter k (angle error of escaped rays, degrees) */
{
  const a = 0.9, rCam = 30, th = 1.40;
  const cam = K.cameraFrame(a, rCam, th);
  const rays = [];
  for (let i = 0; i < 400; i++) {
    const x = Math.sin(i * 12.9898) * 0.6, y = Math.sin(i * 78.233) * 0.6;
    rays.push([x, y]);
  }
  const ref = rays.map(([x, y]) => K.trace(a, rCam, th, K.pixelMomentum(cam, x, y), { k: 0.004, maxSteps: 200000, rEsc: 2e4 }));
  for (const k of [0.06, 0.1, 0.15, 0.2, 0.3]) {
    let worst = 0, sum = 0, n = 0, steps = 0, disagree = 0;
    rays.forEach(([x, y], i) => {
      const t = K.trace(a, rCam, th, K.pixelMomentum(cam, x, y), { k, maxSteps: 4000 });
      steps += t.steps;
      if (t.fate !== ref[i].fate) { disagree++; return; }
      if (t.fate !== 'sky') return;
      const d = t.dir, e = ref[i].dir;
      const ang = Math.acos(Math.min(1, d[0] * e[0] + d[1] * e[1] + d[2] * e[2])) * 180 / Math.PI;
      worst = Math.max(worst, ang); sum += ang; n++;
    });
    console.log(`info  k=${k}: mean ${(sum / n).toFixed(4)}°, worst ${worst.toFixed(3)}°, fate mismatches ${disagree}/400, mean steps ${(steps / 400).toFixed(1)}`);
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
