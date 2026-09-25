/* ============================================================================
 * physics.js: Kerr black hole physics in geometric units (G = c = M = 1).
 *
 * Coordinates are ingoing Kerr (v, r, θ, φ̃):
 *     v = t + ∫ (r² + a²)/Δ dr,      φ̃ = φ + ∫ a/Δ dr
 * where (t, φ) are Boyer–Lindquist. They are regular across the future event
 * horizon, so both the camera and the light rays can cross it.
 *
 * Photons are integrated in Mino time σ (dλ = Σ dσ) with Carter's constants
 * E, L, Q. With u = cos θ, ṙ = dr/dσ and w = du/dσ:
 *
 *     d²r/dσ² = R'(r)/2,   R = P² − Δ K,   P = E (r² + a²) − a L
 *     d²u/dσ² = U'(u)/2,   U = Q(1 − u²) + a²E²u²(1 − u²) − L²u²
 *     dφ̃/dσ  = a X − a E + L / (1 − u²)
 *     dv/dσ  = (r² + a²) X + a L − a² E (1 − u²)
 *
 * with K = Q + (L − aE)² and X = (P + ṙ)/Δ = p_r, the covariant ingoing-Kerr
 * radial momentum, which stays finite for light falling through the horizon.
 * After every step ṙ and w are projected back onto ṙ² = R(r), w² = U(u):
 * far from the hole the impact parameter lives in a tiny correction to ṙ
 * and would otherwise be lost to round-off.
 *
 * This file is shared by the page (camera frames, look-up tables, HUD) and by
 * tests/physics.test.mjs, which checks it against textbook results. The GLSL
 * integrator in shaders.js is a line-by-line port of trace() below.
 * ==========================================================================*/
const Kerr = (() => {
  'use strict';
  const { sqrt, cbrt, cos, sin, acos, abs, max, min, log, exp, PI } = Math;

  /* ---------------------------------------------------------------- orbits */

  function horizons(a) {
    const s = sqrt(max(0, 1 - a * a));
    return { rp: 1 + s, rm: 1 - s };
  }

  /** Prograde innermost stable circular orbit (Bardeen, Press & Teukolsky 1972). */
  function iscoRadius(a) {
    const z1 = 1 + cbrt(1 - a * a) * (cbrt(1 + a) + cbrt(1 - a));
    const z2 = sqrt(3 * a * a + z1 * z1);
    return 3 + z2 - sqrt((3 - z1) * (3 + z1 + 2 * z2));
  }

  /** Equatorial circular photon orbits: prograde and retrograde. */
  function photonOrbits(a) {
    return {
      pro: 2 * (1 + cos((2 / 3) * acos(-a))),
      retro: 2 * (1 + cos((2 / 3) * acos(a))),
    };
  }

  /** Outer boundary of the ergoregion (static limit) at polar angle θ. */
  function ergosphere(a, th) {
    return 1 + sqrt(max(0, 1 - a * a * cos(th) ** 2));
  }

  /** Prograde Keplerian circular orbit in the equatorial plane. */
  function circularOrbit(a, r) {
    const sr = sqrt(r);
    const den = Math.pow(r, 0.75) * sqrt(r * sr - 3 * sr + 2 * a);
    return {
      E: (r * sr - 2 * sr + a) / den,
      L: (r * r - 2 * a * sr + a * a) / den,
      Om: 1 / (r * sr + a),
      ut: (r * sr + a) / den,
    };
  }

  /* ---------------------------------------------------------------- metric */

  const zeros4 = () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

  /** Covariant Kerr metric in ingoing Kerr coordinates, order (v, r, θ, φ̃). */
  function metricIK(a, r, th) {
    const s2 = sin(th) ** 2;
    const S = r * r + a * a * cos(th) ** 2;
    const D = r * r - 2 * r + a * a;
    const A = (r * r + a * a) ** 2 - a * a * D * s2;
    const g = zeros4();
    g[0][0] = -(1 - (2 * r) / S);
    g[0][1] = g[1][0] = 1;
    g[0][3] = g[3][0] = (-2 * a * r * s2) / S;
    g[1][3] = g[3][1] = -a * s2;
    g[2][2] = S;
    g[3][3] = (A * s2) / S;
    return g;
  }

  /** Contravariant metric in ingoing Kerr coordinates. */
  function invMetricIK(a, r, th) {
    const s2 = sin(th) ** 2;
    const S = r * r + a * a * cos(th) ** 2;
    const D = r * r - 2 * r + a * a;
    const gi = zeros4();
    gi[0][0] = (a * a * s2) / S;
    gi[0][1] = gi[1][0] = (r * r + a * a) / S;
    gi[0][3] = gi[3][0] = a / S;
    gi[1][1] = D / S;
    gi[1][3] = gi[3][1] = a / S;
    gi[2][2] = 1 / S;
    gi[3][3] = 1 / (S * s2);
    return gi;
  }

  const contract = (g, x, y) => {
    let s = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += g[i][j] * x[i] * y[j];
    return s;
  };
  const lower = (g, x) => g.map((row) => row[0] * x[0] + row[1] * x[1] + row[2] * x[2] + row[3] * x[3]);

  /* --------------------------------------------------------- the observer */

  /**
   * Doran ("rain") observer: free fall from rest at infinity with zero angular
   * momentum (E = 1, L = 0, Q = 0). It is the Kerr version of the
   * Painlevé–Gullstrand observer and falls smoothly through both horizons.
   * β = √(2r/(r² + a²)) is the inflow speed of space in the river model
   * (Hamilton & Lisle 2008): β = 1 exactly on the event horizon.
   */
  function doranVelocity(a, r, th) {
    const s2 = sin(th) ** 2;
    const S = r * r + a * a * cos(th) ** 2;
    const ra = r * r + a * a;
    const beta = sqrt((2 * r) / ra);
    return {
      beta,
      up: [(ra / (1 + beta) - a * a * s2) / S, (-beta * ra) / S, 0, (-a * beta) / ((1 + beta) * S)],
      down: [-1, 1 / (1 + beta), 0, 0],
    };
  }

  /**
   * Orthonormal tetrad carried by the Doran observer. e_r points outward
   * (away from the hole), e_θ points south, e_φ points prograde.
   */
  function doranFrame(a, r, th) {
    const g = metricIK(a, r, th);
    const { up: u, down: ud, beta } = doranVelocity(a, r, th);
    const S = r * r + a * a * cos(th) ** 2;
    const eth = [0, 0, 1 / sqrt(S), 0];
    const eph = [0, 0, 0, 1 / sqrt(g[3][3])];
    // Project ∂_r (a null vector in these coordinates) into the rest space.
    const yu = ud[1];
    const yph = g[1][3] * eph[3];
    let er = [0, 1, 0, 0].map((y, i) => y + yu * u[i] - yph * eph[i]);
    const n = sqrt(contract(g, er, er));
    er = er.map((x) => x / n);
    return { g, u, ud, er, eth, eph, beta, S };
  }

  /**
   * Camera basis as covariant 4-vectors. yaw/pitch rotate the view away from
   * the hole's centre. Returns U (observer), F (forward), R (right), Up.
   * A pixel looking along d = F + x R + y Up (normalised in the local frame)
   * receives the photon p_μ = U_μ − d_μ, whose energy measured by the
   * observer is exactly 1.
   */
  function cameraFrame(a, r, th, yaw = 0, pitch = 0) {
    const fr = doranFrame(a, r, th);
    const cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
    // Local axes: X = right (e_φ), Y = up (−e_θ), Z = back (e_r).
    const f = [sy * cp, sp, -cy * cp];
    const rt = [cy, 0, sy];
    const upv = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
    const toVec = (v) => [0, 1, 2, 3].map((i) => v[0] * fr.eph[i] - v[1] * fr.eth[i] + v[2] * fr.er[i]);
    const F = lower(fr.g, toVec(f));
    const R = lower(fr.g, toVec(rt));
    const Up = lower(fr.g, toVec(upv));
    return { U: fr.ud.slice(), F, R, Up, frame: fr };
  }

  /** Covariant photon momentum received from local direction (x, y) on the image plane. */
  function pixelMomentum(cam, x, y) {
    const inv = 1 / sqrt(1 + x * x + y * y);
    return [0, 1, 2, 3].map((i) => cam.U[i] - (cam.F[i] + x * cam.R[i] + y * cam.Up[i]) * inv);
  }

  /* ------------------------------------------------------ photon geodesics */

  /** Constants of motion and initial state of a photon given p_μ at (r, θ, φ̃). */
  function photonState(a, r, th, p, ph = 0) {
    const E = -p[0], L = p[3], pth = p[2], X = p[1];
    const u = cos(th), st = sin(th), s2 = 1 - u * u;
    const Q = pth * pth + u * u * ((L * L) / s2 - a * a * E * E);
    const K = Q + (L - a * E) ** 2;
    const D = r * r - 2 * r + a * a;
    const P = E * (r * r + a * a) - a * L;
    const cp = cos(ph), sp = sin(ph);
    // Direction on the unit sphere and its Mino-time derivative p_θ θ̂ + (L/sinθ) φ̂.
    const n = [st * cp, st * sp, u];
    const m = [pth * u * cp - (L / st) * sp, pth * u * sp + (L / st) * cp, -pth * st];
    return { E, L, Q, K, r, rd: D * X - P, n, m };
  }

  /** Radial potential R(r) = P² − ΔK. */
  function potR(a, c, r) {
    const P = c.E * (r * r + a * a) - a * c.L;
    return P * P - (r * r - 2 * r + a * a) * c.K;
  }

  /** X = p_r = (P + ṙ)/Δ, evaluated without cancellation. */
  function radialMomentum(a, c, r, rd) {
    const P = c.E * (r * r + a * a) - a * c.L;
    if (P * rd >= 0) {
      const D = r * r - 2 * r + a * a;
      const s = D >= 0 ? 1 : -1;
      return (P + rd) / (s * max(abs(D), 1e-12));
    }
    return c.K / (P - rd);
  }

  /**
   * State y = [r, ṙ, nx, ny, nz, mx, my, mz, φx, v].
   * The polar/azimuthal motion is carried by a unit vector n with m = dn/dσ:
   * it moves on the sphere under the potential −½a²E²n_z², which reproduces
   * Carter's θ equation exactly and has no coordinate singularity at the
   * poles. The frame-dragging part of dφ̃/dσ, a(X − E), is kept apart in φx,
   * so φ̃ = atan2(ny, nx) + φx.
   */
  function rhs(a, c, y, out) {
    const r = y[0], rd = y[1], nz = y[4];
    const ra = r * r + a * a;
    const P = c.E * ra - a * c.L;
    const aE2 = a * a * c.E * c.E;
    const X = radialMomentum(a, c, r, rd);
    const lam = c.Q + c.L * c.L + 2 * aE2 * nz * nz;
    out[0] = rd;
    out[1] = 2 * c.E * r * P - (r - 1) * c.K;
    out[2] = y[5]; out[3] = y[6]; out[4] = y[7];
    out[5] = -lam * y[2];
    out[6] = -lam * y[3];
    out[7] = aE2 * nz - lam * nz;
    out[8] = a * (X - c.E);
    out[9] = ra * X + a * c.L - a * a * c.E * (1 - nz * nz);
    out.X = X;
    return out;
  }

  /** Re-impose ṙ² = R(r), |n| = 1, n·m = 0 and |m|² = Q + L² + a²E²n_z². */
  function project(a, c, y) {
    y[1] = Math.sign(y[1]) * sqrt(max(potR(a, c, y[0]), 0));
    const nn = Math.hypot(y[2], y[3], y[4]);
    y[2] /= nn; y[3] /= nn; y[4] /= nn;
    const mn = y[5] * y[2] + y[6] * y[3] + y[7] * y[4];
    y[5] -= mn * y[2]; y[6] -= mn * y[3]; y[7] -= mn * y[4];
    const mm = Math.hypot(y[5], y[6], y[7]);
    const want = sqrt(max(c.Q + c.L * c.L + a * a * c.E * c.E * y[4] * y[4], 0));
    if (mm > 1e-12) { y[5] *= want / mm; y[6] *= want / mm; y[7] *= want / mm; }
  }

  /**
   * Mino-time step. The relative step k shrinks wherever r or the direction
   * change quickly. The winding of φ̃ right next to the horizon (a gauge
   * effect on rays that are lost anyway) is capped so it cannot stall.
   */
  function stepSize(a, c, y, d, k) {
    const Xc = min(abs(d.X), 4 * abs(c.E) + 4);
    const rate = abs(y[1]) / max(y[0], 1e-3) + Math.hypot(y[5], y[6], y[7]) + abs(a) * (abs(c.E) + Xc);
    return (k * min(1 + y[0] / 20, 4)) / (rate + 1e-9);
  }

  /** Cartesian (Kerr–Schild) position of (r, u, φ̃). */
  function cartesian(a, r, u, ph) {
    const s = sqrt(max(0, 1 - u * u));
    return [s * (r * cos(ph) - a * sin(ph)), s * (r * sin(ph) + a * cos(ph)), r * u];
  }

  // 3-point Gauss–Legendre nodes on [0, 1].
  const GL3 = [[0.5 - 0.5 * sqrt(0.6), 5 / 18], [0.5, 8 / 18], [0.5 + 0.5 * sqrt(0.6), 5 / 18]];

  /**
   * Direction a photon came from, found by finishing its path to r = ∞
   * analytically: the remaining Mino time is ∫₀^{1/r} dx / √(R(1/x) x⁴), after
   * which only the angular motion needs a few more steps.
   */
  function skyDirection(a, c, y) {
    const x0 = 1 / y[0];
    let ds = 0, dragX = 0;
    for (const [t, wgt] of GL3) {
      const x = t * x0;
      const Pt = c.E * (1 + a * a * x * x) - a * c.L * x * x; // P x²
      const sf = sqrt(max(Pt * Pt - (1 - 2 * x + a * a * x * x) * c.K * x * x, 1e-12)); // √R x²
      ds += (wgt * x0) / sf;
      dragX += (wgt * x0 * a * c.K * x * x) / ((Pt + sf) * sf); // ∫ a X dσ with X = K/(P + √R)
    }
    // Angular motion (and the drag term with X → 0) over the remaining σ.
    const z = y.slice(2, 9);
    const f7 = (s, o) => {
      const aE2 = a * a * c.E * c.E, lam = c.Q + c.L * c.L + 2 * aE2 * s[2] * s[2];
      o[0] = s[3]; o[1] = s[4]; o[2] = s[5];
      o[3] = -lam * s[0]; o[4] = -lam * s[1]; o[5] = aE2 * s[2] - lam * s[2];
      o[6] = -a * c.E;
      return o;
    };
    const n = 3, h = -ds / n;
    const k1 = [], k2 = [], k3 = [], k4 = [], t = [];
    for (let i = 0; i < n; i++) {
      f7(z, k1);
      for (let j = 0; j < 7; j++) t[j] = z[j] + 0.5 * h * k1[j];
      f7(t, k2);
      for (let j = 0; j < 7; j++) t[j] = z[j] + 0.5 * h * k2[j];
      f7(t, k3);
      for (let j = 0; j < 7; j++) t[j] = z[j] + h * k3[j];
      f7(t, k4);
      for (let j = 0; j < 7; j++) z[j] += (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    }
    const nn = Math.hypot(z[0], z[1], z[2]);
    const phx = z[6] - dragX; // backward in σ: the drag integral enters with h < 0
    const cx = cos(phx), sx = sin(phx);
    return [(z[0] * cx - z[1] * sx) / nn, (z[0] * sx + z[1] * cx) / nn, z[2] / nn];
  }

  /**
   * Trace a photon backwards in time from the camera at (r0, θ0, φ̃0).
   * Mirrors the GLSL integrator. Fates: 'sky' (escaped, with the direction it
   * came from), 'hole' (it emerged from the past horizon, i.e. from inside the
   * hole: black), 'maxsteps'. Every crossing of the equatorial plane is kept.
   */
  function trace(a, r0, th0, p, opts = {}) {
    const k = opts.k ?? 0.1;
    const maxSteps = opts.maxSteps ?? 2000;
    const ph0 = opts.ph ?? 0;
    const rEsc = max(opts.rEsc ?? 40, r0 * 1.02);
    const { rp } = horizons(a);
    const c = photonState(a, r0, th0, p, ph0);
    const inside = r0 < rp;
    const Pp = c.E * (rp * rp + a * a) - a * c.L; // P on the horizon
    const y = [c.r, c.rd, ...c.n, ...c.m, 0, 0];
    const d = [], k1 = [], k2 = [], k3 = [], k4 = [], tmp = [], yn = [];
    const crossings = [];
    const N = 10;
    for (let i = 0; i < maxSteps; i++) {
      rhs(a, c, y, d);
      if (y[0] > rEsc && d[0] < 0) {
        return { fate: 'sky', dir: skyDirection(a, c, y), c, steps: i, crossings, y };
      }
      // Reaching the horizon while moving outward (forward in time) means the
      // light came out of the past horizon: nothing emits there in a black hole
      // born from collapse, so it is dark. Inside the hole ṙ < 0 always, so this
      // test is valid wherever the camera is.
      if (y[0] < rp + 0.005 && y[1] > 0) return { fate: 'hole', c, steps: i, crossings, y };
      if (inside && y[0] > rp - 0.005 && Pp < 0) return { fate: 'hole', c, steps: i, crossings, y };
      const h = -stepSize(a, c, y, d, k);
      for (let j = 0; j < N; j++) k1[j] = d[j];
      for (let j = 0; j < N; j++) tmp[j] = y[j] + 0.5 * h * k1[j];
      rhs(a, c, tmp, k2);
      for (let j = 0; j < N; j++) tmp[j] = y[j] + 0.5 * h * k2[j];
      rhs(a, c, tmp, k3);
      for (let j = 0; j < N; j++) tmp[j] = y[j] + h * k3[j];
      rhs(a, c, tmp, k4);
      for (let j = 0; j < N; j++) yn[j] = y[j] + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      project(a, c, yn);
      if (y[4] * yn[4] < 0) {
        // Cubic Hermite root of n_z(s) on the step, then interpolate the state.
        const dn = rhs(a, c, yn, []);
        const s = hermiteRoot(y[4], yn[4], k1[4] * h, dn[4] * h);
        const at = (j) => hermite(y[j], yn[j], k1[j] * h, dn[j] * h, s);
        const r = at(0), rd = y[1] + (yn[1] - y[1]) * s;
        const ph = Math.atan2(at(3), at(2)) + at(8);
        crossings.push({ r, rd, X: radialMomentum(a, c, r, rd), ph, v: at(9), c });
      }
      for (let j = 0; j < N; j++) y[j] = yn[j];
    }
    return { fate: 'maxsteps', c, steps: maxSteps, crossings, y };
  }

  function hermite(p0, p1, m0, m1, s) {
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
  }

  function hermiteRoot(p0, p1, m0, m1) {
    let s = p0 / (p0 - p1);
    for (let i = 0; i < 3; i++) {
      const s2 = s * s;
      const f = hermite(p0, p1, m0, m1, s);
      const df = (6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * p1 + (3 * s2 - 2 * s) * m1;
      if (abs(df) < 1e-12) break;
      s = min(1, max(0, s - f / df));
    }
    return s;
  }

  /* ------------------------------------------------------------ disk flow */

  /**
   * Frequency ratio g = ν_observed / ν_emitted for a photon (E, L, Q; X at the
   * crossing) hitting the equatorial disk at radius r. Outside the ISCO the
   * gas is on prograde circular orbits; inside it plunges on the geodesic that
   * leaves the ISCO (E_I, L_I). The observer measured energy 1.
   */
  function diskRedshift(a, c, r, X, disk) {
    if (r >= disk.rI) {
      const o = circularOrbit(a, r);
      return 1 / (o.ut * (c.E - o.Om * c.L));
    }
    const ra = r * r + a * a;
    const D = r * r - 2 * r + a * a;
    const Pp = c.E * ra - a * c.L;
    const Pu = disk.EI * ra - a * disk.LI;
    const Ku = r * r + (disk.LI - a * disk.EI) ** 2;
    const Ru = plungePotential(r, disk);
    const du = Ku / (Pu + sqrt(Ru));
    const pu = (X * Pu + du * Pp - D * X * du - (c.L - a * c.E) * (disk.LI - a * disk.EI)) / (r * r);
    return 1 / pu;
  }

  /**
   * Radial potential of the gas plunging from the ISCO. For the marginally
   * stable orbit the quartic R(r) has a triple root at r_I, so exactly
   * R(r) = r (1 − E_I²)(r_I − r)³: no cancellation near the ISCO.
   */
  function plungePotential(r, disk) {
    return r * (1 - disk.EI * disk.EI) * max(disk.rI - r, 0) ** 3;
  }

  /** Radial 4-velocity dr/dτ of the plunging gas in the equatorial plane (negative). */
  function plungeRadialVelocity(a, r, disk) {
    return -sqrt(plungePotential(r, disk)) / (r * r);
  }

  function diskOrbits(a) {
    const rI = iscoRadius(a);
    const o = circularOrbit(a, rI);
    return { rI, EI: o.E, LI: o.L, OmI: o.Om };
  }

  /**
   * Novikov–Thorne / Page–Thorne flux with an optional torque at the ISCO:
   *   F(r) ∝ −Ω' / (r (E − ΩL)²) · [∫_{r_I}^{r} (E − ΩL) L' dr + C]
   * The integral equals Page & Thorne's closed-form bracket Q(x). A torque that
   * returns a fraction δ_J of the ISCO angular momentum to the disk gives
   * C = δ_J L_I (E_I − Ω_I L_I) (Agol & Krolik 2000), so F(r_I) > 0.
   * Integrated numerically from the ISCO on a log grid; returns {r[], F[]}.
   */
  function pageThorneProfile(a, rI, rMax, n = 3000, C = 0) {
    const rs = new Float64Array(n), F = new Float64Array(n);
    const lr0 = log(rI), lr1 = log(rMax);
    const orb = (r) => circularOrbit(a, r);
    const deriv = (fn, r) => {
      const h = 1e-5 * r;
      return (fn(r + h) - fn(r - h)) / (2 * h);
    };
    let integral = 0;
    let prev = null;
    for (let i = 0; i < n; i++) {
      const r = exp(lr0 + ((lr1 - lr0) * i) / (n - 1));
      const o = orb(r);
      const EmOL = o.E - o.Om * o.L;
      const integrand = EmOL * deriv((x) => orb(x).L, r);
      if (prev) integral += 0.5 * (integrand + prev.integrand) * (r - prev.r);
      const Omp = deriv((x) => orb(x).Om, r);
      rs[i] = r;
      F[i] = (-Omp / (r * EmOL * EmOL)) * (integral + C);
      prev = { r, integrand };
    }
    return { r: rs, F };
  }

  /**
   * Gas inside the ISCO (Mummery & Balbus 2023, as used by Mummery et al. 2024
   * to detect this emission in MAXI J1820+070). The gas plunges on the ISCO
   * geodesic, U^r = −√(2/(3r_I)) [(r_I/r − 1)^{3/2} + ε], with ε set by the
   * small inflow speed at the ISCO. Mass conservation gives Σ ∝ 1/(r |U^r|);
   * vertical balance (ν_z² = 2 r_I / r⁴) with adiabatic gas (P ∝ ρ^γ) gives
   *   ρ ∝ Φ^{−2/(γ+1)},  T_c ∝ Φ^{−2(γ−1)/(γ+1)},  Φ = (r/r_I)³ [1 + (r_I/r − 1)^{3/2}/ε]
   * and an electron-scattering atmosphere radiates T_eff⁴ ∝ T_c⁴ / Σ.
   * Returns T_eff / T_I and Σ / Σ_I (both 1 at the ISCO).
   */
  function plungeThermo(r, disk, eps = 0.005, gamma = 5 / 3) {
    if (r >= disk.rI) return { T: 1, sigma: 1 };
    const q = Math.pow(disk.rI / r - 1, 1.5) / eps;
    const x = r / disk.rI;
    const Phi = x * x * x * (1 + q);
    const sigma = 1 / (x * (1 + q));
    const Tc = Math.pow(Phi, (-2 * (gamma - 1)) / (gamma + 1));
    return { T: Tc * Math.pow(sigma, -0.25), sigma };
  }

  /**
   * Azimuthal phase Ψ(r) = Φ(r) − Ω_I V(r) accumulated by plunging gas since
   * it left the ISCO: the gas that sits at (r, φ̃, v) left the ISCO with pattern
   * phase φ̃ − Ω_I v − Ψ(r). Finite although Φ and V diverge at the ISCO.
   */
  function plungePhase(a, r, disk) {
    if (r >= disk.rI) return 0;
    // Substitute r = r_I − s²: the integrand is then finite at the ISCO.
    const smax = sqrt(disk.rI - r);
    const n = 400;
    const e2 = sqrt(1 - disk.EI * disk.EI);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const s = ((i + 0.5) / n) * smax;
      const rr = disk.rI - s * s;
      const ra = rr * rr + a * a;
      const Pu = disk.EI * ra - a * disk.LI;
      const Ku = rr * rr + (disk.LI - a * disk.EI) ** 2;
      const sqR = sqrt(rr) * e2 * s * s * s;
      const du = Ku / (Pu + sqR);
      const dphi = a * du - a * disk.EI + disk.LI;
      const dv = ra * du + a * disk.LI - a * a * disk.EI;
      sum += (2 * (dphi - disk.OmI * dv)) / (sqrt(rr) * e2 * s * s);
    }
    return (sum * smax) / n;
  }

  /**
   * Disk look-up table on a logarithmic radius grid:
   *   R = T(r) / T_max, G = Ψ(r) (plunge phase), B = Σ/Σ_I (1 outside the ISCO).
   * δ_J ≈ 0.05 is the ISCO stress found in GRMHD thin-disk simulations
   * (Rule et al. 2025) and in fits of MAXI J1820+070 (δ_J ≈ 0.04).
   */
  function diskLUT(a, opts = {}) {
    const n = opts.n ?? 512;
    const deltaJ = opts.deltaJ ?? 0.05;
    const disk = diskOrbits(a);
    const { rp, rm } = horizons(a);
    const rLo = max(rm * 0.98, 0.04);
    const rHi = opts.rHi ?? 64;
    const C = deltaJ * disk.LI * (disk.EI - disk.OmI * disk.LI);
    const pt = pageThorneProfile(a, disk.rI, rHi * 1.01, 4000, C);
    const lr0 = log(pt.r[0]), lr1 = log(pt.r[pt.r.length - 1]);
    const flux = (r) => {
      const f = ((log(r) - lr0) / (lr1 - lr0)) * (pt.r.length - 1);
      const i = Math.min(Math.max(Math.floor(f), 0), pt.r.length - 2);
      const t = Math.min(Math.max(f - i, 0), 1);
      return pt.F[i] * (1 - t) + pt.F[i + 1] * t;
    };
    const TI = Math.pow(pt.F[0], 0.25);
    const data = new Float32Array(n * 4);
    let rPeak = disk.rI, tPeak = 0;
    for (let i = 0; i < n; i++) {
      const r = exp(log(rLo) + ((log(rHi) - log(rLo)) * i) / (n - 1));
      let T, sigma = 1;
      if (r >= disk.rI) {
        T = Math.pow(max(flux(r), 0), 0.25);
      } else {
        const th = plungeThermo(r, disk, opts.eps, opts.gamma);
        T = TI * th.T;
        sigma = th.sigma;
      }
      // "Maximum temperature" refers to the disk proper, outside the ISCO.
      if (r >= disk.rI && T > tPeak) { tPeak = T; rPeak = r; }
      data[4 * i] = T;
      data[4 * i + 1] = plungePhase(a, r, disk);
      data[4 * i + 2] = sigma;
      data[4 * i + 3] = 1;
    }
    for (let i = 0; i < n; i++) data[4 * i] /= tPeak;
    return { data, n, rLo, rHi, disk, rPeak, rp, rm, TIrel: TI / tPeak };
  }

  /* ------------------------------------------------------------ blackbody */

  // CIE 1931 2° colour matching functions, multi-lobe fit of Wyman, Sloan &
  // Shirley (JCGT 2013).
  function cmf(l) {
    const g = (x, mu, s1, s2) => {
      const t = (x - mu) / (x < mu ? s1 : s2);
      return exp(-0.5 * t * t);
    };
    return [
      1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
      0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
      1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
    ];
  }

  /** Linear-sRGB colour (unit luminance) and luminance of a blackbody at T kelvin. */
  function planckColor(T) {
    const c2 = 1.438776877e-2; // m·K
    let X = 0, Y = 0, Z = 0;
    for (let l = 360; l <= 830; l += 2) {
      const lm = l * 1e-9;
      const x = c2 / (lm * T);
      const B = x > 700 ? 0 : 1 / (Math.pow(lm, 5) * (x < 1e-6 ? x : Math.expm1(x)));
      const [xb, yb, zb] = cmf(l);
      X += B * xb; Y += B * yb; Z += B * zb;
    }
    let R = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    let G = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
    let Bc = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    R = max(R, 0); G = max(G, 0); Bc = max(Bc, 0);
    const Yl = 0.2126 * R + 0.7152 * G + 0.0722 * Bc;
    if (!(Yl > 0)) return { rgb: [1, 0, 0], Y: 0 };
    return { rgb: [R / Yl, G / Yl, Bc / Yl], Y: Yl };
  }

  /** Planck table on log10 T ∈ [logT0, logT1]: rgb = chromaticity, a = log10(Y / Y(6500 K)). */
  function planckLUT(n = 512, logT0 = 2.7, logT1 = 9.0) {
    const Yref = planckColor(6500).Y;
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const T = Math.pow(10, logT0 + ((logT1 - logT0) * i) / (n - 1));
      const { rgb, Y } = planckColor(T);
      data[4 * i] = rgb[0];
      data[4 * i + 1] = rgb[1];
      data[4 * i + 2] = rgb[2];
      data[4 * i + 3] = Y > 0 ? Math.log10(Y / Yref) : -60;
    }
    return { data, n, logT0, logT1 };
  }

  /* ------------------------------------------------- the infall and HUD */

  /** Proper time for a Doran observer at polar angle θ to fall from r1 down to r2 (< r1). */
  function doranFallTime(a, th, r1, r2) {
    if (r1 <= r2) return 0;
    const c2 = cos(th) ** 2;
    // τ = ∫ Σ / √(2 r (r² + a²)) dr; substitute r = s² to tame r → 0.
    const s1 = sqrt(r1), s2 = sqrt(r2);
    const n = 256;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const s = s2 + ((i + 0.5) / n) * (s1 - s2);
      const r = s * s;
      sum += ((r * r + a * a * c2) / sqrt(2 * r * (r * r + a * a))) * 2 * s;
    }
    return (sum * (s1 - s2)) / n;
  }

  /** Change of φ̃ along the Doran infall per unit decrease of r (frame dragging). */
  function doranDphiDr(a, r) {
    const ra = r * r + a * a;
    const beta = sqrt((2 * r) / ra);
    return a / ((1 + beta) * ra);
  }

  /** Frequency ratio seen by the camera for light arriving from the local direction d (x,y,z in camera axes). */
  function observedShift(cam, x, y) {
    const p = pixelMomentum(cam, x, y);
    return 1 / -p[0];
  }

  /** Energy of the camera measured at infinity (Killing energy per unit mass): 1 for Doran. */
  function tidalStretch(a, r, th) {
    // Leading radial tidal eigenvalue, |Re Ψ₂| scaled: 2M/|r − i a cosθ|³ (exact for Schwarzschild).
    const rho2 = r * r + a * a * cos(th) ** 2;
    return 2 / Math.pow(rho2, 1.5);
  }

  return {
    horizons, iscoRadius, photonOrbits, ergosphere, circularOrbit,
    metricIK, invMetricIK, contract, lower,
    doranVelocity, doranFrame, cameraFrame, pixelMomentum,
    photonState, rhs, stepSize, trace, skyDirection, cartesian,
    diskOrbits, diskRedshift, plungePotential, plungeRadialVelocity, pageThorneProfile, plungePhase, diskLUT,
    potR, radialMomentum, project,
    plungeThermo, planckColor, planckLUT,
    doranFallTime, doranDphiDr, observedShift, tidalStretch,
  };
})();

if (typeof module !== 'undefined') module.exports = Kerr;
