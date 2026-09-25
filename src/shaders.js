/* ============================================================================
 * shaders.js: GLSL ES 3.00 programs.
 *
 *   TRACE      one null geodesic per pixel, traced backwards from the camera
 *              (a port of Kerr.trace in physics.js), disk emission, lensed sky
 *   SKY        one-off generation of the Milky Way cubemap and a dust map
 *   ACCUM      temporal accumulation (anti-aliasing while the view is still)
 *   DOWN / UP  bloom pyramid (the glare of a real lens / eye)
 *   EXPOSURE   eye-like exposure adaptation
 *   COMPOSITE  upscaling, bloom, exposure, AgX tone mapping
 * ==========================================================================*/
const Shaders = (() => {
  'use strict';

  const VERT = `#version 300 es
void main() {
  // One triangle that covers the screen.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const HASH = `
const float PI = 3.14159265358979;

uvec4 pcg4d(uvec4 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v ^= v >> 16u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  return v;
}
vec4 rand4(uvec4 v) { return vec4(pcg4d(v)) * (1.0 / 4294967296.0); }
`;

  const COMMON = HASH + `
// Blackbody table: rgb = chromaticity (unit luminance), a = log10 of luminance relative to 6500 K.
uniform sampler2D uPlanck;
uniform vec4 uPlanckLut;
vec4 planckLookup(float T) {
  float x = clamp((log2(max(T, 1.0)) * 0.30103 - uPlanckLut.x) * uPlanckLut.y, 0.0, 1.0);
  return texture(uPlanck, vec2(x * uPlanckLut.z + uPlanckLut.w, 0.5));
}
vec3 planckRGB(float T) {
  vec4 p = planckLookup(T);
  return p.rgb * exp2(p.a * 3.321928);
}
`;

  /* ------------------------------------------------------------ ray tracer */
  const TRACE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;

out vec4 fragColor;

uniform vec2 uRes;
uniform vec2 uJitter;
uniform vec2 uTanFov;
uniform vec4 uCamU, uCamF, uCamR, uCamUp;   // covariant, ingoing Kerr (v, r, θ, φ̃)
uniform vec3 uCamPos;                       // r, θ, φ̃
uniform float uA;
uniform vec4 uHor;       // r+, r−, r_ISCO, r_escape
uniform vec4 uIsco;      // E_I, L_I, Ω_I, √(1 − E_I²)
uniform vec4 uDisk;      // inner emission cut, outer radius, T_max [K], colour correction
uniform vec4 uDiskLut;   // log r_lo, 1/(log r_hi − log r_lo), texel scale, texel offset
uniform vec4 uGain;      // disk, diffuse sky, stars, sky temperature scale
uniform vec4 uPat;       // flow-noise phases τ1, τ2 and weights w1, w2
uniform vec4 uOpt;       // doppler on, stars on, disk on, pixel angle
uniform vec3 uGalZ;      // galactic north pole
uniform vec4 uStarAvg;   // mean radiance of the three star layers, then unused
uniform float uStepK;
uniform int uMaxSteps;
uniform sampler2D uDiskTex;
uniform sampler3D uNoise;
uniform samplerCube uSky;
uniform samplerCube uDust;
${COMMON}

// ---------------------------------------------------------------- the photon
float gE, gL, gQ, gK, gA, gA2, gAL, gAE2, gA2E, gLam0;

// X = p_r = (P + ṙ)/Δ without cancellation (finite for light crossing the future horizon).
float radialX(float r, float rd) {
  float P = gE * (r * r + gA2) - gAL;
  if (P * rd >= 0.0) {
    float D = r * r - 2.0 * r + gA2;
    return (P + rd) / (D >= 0.0 ? max(D, 1e-6) : min(D, -1e-6));
  }
  return gK / (P - rd);
}

float potR(float r) {
  float P = gE * (r * r + gA2) - gAL;
  return P * P - (r * r - 2.0 * r + gA2) * gK;
}

// State: s = (r, ṙ, φx, v), n = direction on the unit sphere, m = dn/dσ.
void deriv(vec4 s, vec3 n, vec3 m, out vec4 ds, out vec3 dm, out float X) {
  float r = s.x;
  float ra = r * r + gA2;
  float P = gE * ra - gAL;
  X = radialX(r, s.y);
  float lam = gLam0 + 2.0 * gAE2 * n.z * n.z;
  ds = vec4(s.y, 2.0 * gE * r * P - (r - 1.0) * gK, gA * (X - gE), ra * X + gAL - gA2E * (1.0 - n.z * n.z));
  dm = -lam * n;
  dm.z += gAE2 * n.z;
}

float stepSize(vec4 s, vec3 m, float X) {
  float Xc = min(abs(X), 4.0 * abs(gE) + 4.0);
  float rate = abs(s.y) / max(s.x, 1e-3) + length(m) + abs(gA) * (abs(gE) + Xc);
  return uStepK * min(1.0 + s.x / 20.0, 4.0) / (rate + 1e-9);
}

float hermite(float p0, float p1, float m0, float m1, float t) {
  float t2 = t * t, t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * p0 + (t3 - 2.0 * t2 + t) * m0 + (-2.0 * t3 + 3.0 * t2) * p1 + (t3 - t2) * m1;
}
float hermiteRoot(float p0, float p1, float m0, float m1) {
  float t = p0 / (p0 - p1);
  for (int i = 0; i < 3; i++) {
    float t2 = t * t;
    float f = hermite(p0, p1, m0, m1, t);
    float df = (6.0 * t2 - 6.0 * t) * p0 + (3.0 * t2 - 4.0 * t + 1.0) * m0 + (-6.0 * t2 + 6.0 * t) * p1 + (3.0 * t2 - 2.0 * t) * m1;
    if (abs(df) < 1e-9) break;
    t = clamp(t - f / df, 0.0, 1.0);
  }
  return t;
}

// ------------------------------------------------------------------ the disk
vec4 diskLut(float r) {
  float x = clamp((log(r) - uDiskLut.x) * uDiskLut.y, 0.0, 1.0);
  return texture(uDiskTex, vec2(x * uDiskLut.z + uDiskLut.w, 0.5));
}

vec4 noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return texture(uNoise, (i + f + 0.5) * (1.0 / 64.0));
}

// Turbulence in the gas: long streaks along the flow, as MRI turbulence is
// sheared by differential rotation. Periodic in the azimuth ψ.
float diskPattern(float r, float psi, float seed) {
  float lr = log(r);
  vec2 cs = vec2(cos(psi), sin(psi));
  vec3 p = vec3(cs * 2.4, lr * 8.0) + seed;
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p)[i];
    p = p * vec3(2.02, 2.02, 2.3) + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  v /= 0.9375;
  float fine = noise3(vec3(cs * 9.0, lr * 44.0) + seed * 1.3).y;
  return v * 0.8 + fine * 0.2;
}

// Light from the disk at radius r where the ray crossed the equator.
// Returns emitted radiance (already shifted to the camera frame) and opacity.
vec4 diskEmission(float r, float rd, float phi, float dv) {
  if (r > uDisk.y || r < uDisk.x) return vec4(0.0);
  vec4 lut = diskLut(r);
  float rI = uHor.z;
  float ra = r * r + gA2;
  float g, Om;
  if (r >= rI) {
    // Prograde Keplerian orbit: ν_obs/ν_em = 1 / (u^t (E − Ω L)).
    float sr = sqrt(r);
    float den = pow(r, 0.75) * sqrt(max(r * sr - 3.0 * sr + 2.0 * gA, 1e-6));
    Om = 1.0 / (r * sr + gA);
    g = den / ((r * sr + gA) * (gE - Om * gL));
  } else {
    // Gas plunging from the ISCO on the geodesic (E_I, L_I).
    float EI = uIsco.x, LI = uIsco.y;
    float D = r * r - 2.0 * r + gA2;
    float Pp = gE * ra - gAL;
    float Pu = EI * ra - gA * LI;
    float Ku = r * r + (LI - gA * EI) * (LI - gA * EI);
    float sqRu = sqrt(r) * uIsco.w * pow(max(rI - r, 0.0), 1.5);
    float du = Ku / (Pu + sqRu);
    float X = radialX(r, rd);
    float pu = (X * Pu + du * Pp - D * X * du - (gL - gA * gE) * (LI - gA * EI)) / (r * r);
    g = 1.0 / pu;
    Om = uIsco.z;
  }
  if (!(g > 0.0) || g > 1e4) return vec4(0.0);
  float gs = uOpt.x > 0.5 ? g : 1.0;

  // Pattern carried by the gas, sampled at the retarded time v (light-travel delay included).
  float psi = phi - lut.y;
  float p1 = diskPattern(r, psi - Om * (uPat.x + dv), 0.0);
  float p2 = diskPattern(r, psi - Om * (uPat.y + dv), 37.0);
  float pat = p1 * uPat.z + p2 * uPat.w;

  float T = uDisk.z * lut.x * (0.78 + 0.44 * pat);
  // Electron-scattering atmosphere: Chandrasekhar limb darkening.
  float mu = clamp(sqrt(max(gQ, 0.0)) * g / r, 0.0, 1.0);
  float limb = (1.0 + 2.06 * mu) / 2.3733;
  vec3 col = planckRGB(gs * uDisk.w * T) * (uGain.x * limb);

  // Opacity: the disk is optically thick; only its outer rim frays into
  // translucent streamers. Inside the ISCO the surface density falls as the gas
  // accelerates (Σ ∝ 1/(r|U^r|)), so the plunging stream thins out.
  float rim = smoothstep(uDisk.y * 0.62, uDisk.y, r);
  float edge = 1.0 - rim * smoothstep(0.25, 0.75, 1.0 - pat + rim * 0.35);
  float plunge = r < rI ? 1.0 - exp(-60.0 * lut.z) : 1.0;
  float alpha = clamp(edge * plunge, 0.0, 1.0);
  return vec4(col, alpha);
}

// ------------------------------------------------------------------- the sky
// Finish an escaping ray analytically: remaining Mino time to r = ∞ by
// Gauss–Legendre quadrature, then the angular motion over that interval.
vec3 skyDirection(vec4 s, vec3 n, vec3 m) {
  float x0 = 1.0 / s.x;
  float ds = 0.0, dragX = 0.0;
  const float g0 = 0.1127016654, g2 = 0.8872983346;
  for (int i = 0; i < 3; i++) {
    float t = i == 0 ? g0 : (i == 1 ? 0.5 : g2);
    float w = i == 1 ? 8.0 / 18.0 : 5.0 / 18.0;
    float x = t * x0;
    float Pt = gE * (1.0 + gA2 * x * x) - gAL * x * x;
    float sf = sqrt(max(Pt * Pt - (1.0 - 2.0 * x + gA2 * x * x) * gK * x * x, 1e-12));
    ds += w * x0 / sf;
    dragX += w * x0 * gA * gK * x * x / ((Pt + sf) * sf);
  }
  float h = -ds / 3.0;
  float phx = s.z;
  for (int i = 0; i < 3; i++) {
    vec3 k1n = m;
    vec3 k1m = -(gLam0 + 2.0 * gAE2 * n.z * n.z) * n; k1m.z += gAE2 * n.z;
    vec3 n2 = n + 0.5 * h * k1n, m2 = m + 0.5 * h * k1m;
    vec3 k2m = -(gLam0 + 2.0 * gAE2 * n2.z * n2.z) * n2; k2m.z += gAE2 * n2.z;
    vec3 n3 = n + 0.5 * h * m2, m3 = m + 0.5 * h * k2m;
    vec3 k3m = -(gLam0 + 2.0 * gAE2 * n3.z * n3.z) * n3; k3m.z += gAE2 * n3.z;
    vec3 n4 = n + h * m3, m4 = m + h * k3m;
    vec3 k4m = -(gLam0 + 2.0 * gAE2 * n4.z * n4.z) * n4; k4m.z += gAE2 * n4.z;
    n += h / 6.0 * (k1n + 2.0 * m2 + 2.0 * m3 + m4);
    m += h / 6.0 * (k1m + 2.0 * k2m + 2.0 * k3m + k4m);
    phx += h * (-gA * gE);
  }
  n = normalize(n);
  phx -= dragX;
  float c = cos(phx), sn = sin(phx);
  return vec3(n.x * c - n.y * sn, n.x * sn + n.y * c, n.z);
}

// Colour ratio that Doppler/gravitational shift by g applies to a blackbody at T.
vec3 shiftRatio(float T, float g) {
  vec4 p0 = planckLookup(T), p1 = planckLookup(T * g);
  return p1.rgb / max(p0.rgb, vec3(1e-3)) * exp2((p1.a - p0.a) * 3.321928);
}

vec2 cubeUV(vec3 D, out int face) {
  vec3 q = abs(D);
  if (q.x >= q.y && q.x >= q.z) { face = D.x > 0.0 ? 0 : 1; return vec2(D.y, D.z) / q.x; }
  if (q.y >= q.z) { face = D.y > 0.0 ? 2 : 3; return vec2(D.z, D.x) / q.y; }
  face = D.z > 0.0 ? 4 : 5; return vec2(D.x, D.y) / q.z;
}
vec3 cubeDir(int face, vec2 uv) {
  if (face == 0) return vec3(1.0, uv.x, uv.y);
  if (face == 1) return vec3(-1.0, uv.x, uv.y);
  if (face == 2) return vec3(uv.y, 1.0, uv.x);
  if (face == 3) return vec3(uv.y, -1.0, uv.x);
  if (face == 4) return vec3(uv.x, uv.y, 1.0);
  return vec3(uv.x, uv.y, -1.0);
}

// Point stars. Each star is drawn as a point-spread function in screen space
// at its lensed position; its flux is multiplied by the lensing magnification
// (pixel solid angle / sky solid angle seen by the pixel, from the Jacobian).
vec3 starLayer(vec3 D, vec3 Jx, vec3 Jy, float Afp, float cells, float prob, float m0, float dm, uint layer, float gs) {
  int face;
  vec2 uv = cubeUV(D, face);
  vec2 w = atan(uv) * (4.0 / PI);
  vec2 gp = (w * 0.5 + 0.5) * cells;
  vec2 base = floor(gp - 0.5);
  float a11 = dot(Jx, Jx), a12 = dot(Jx, Jy), a22 = dot(Jy, Jy);
  float det = max(a11 * a22 - a12 * a12, 1e-30);
  float dens = 0.5 + 2.2 * exp(-abs(dot(D, uGalZ)) / 0.2);
  float pr = min(prob * dens, 0.95);
  float lf = pow(10.0, 0.46 * dm) - 1.0;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 c = base + vec2(float(i), float(j));
      if (c.x < 0.0 || c.y < 0.0 || c.x >= cells || c.y >= cells) continue;
      uvec4 key = uvec4(uvec2(c), uint(face), layer);
      vec4 h = rand4(key);
      if (h.x > pr) continue;
      vec2 sw = ((c + 0.08 + 0.84 * h.yz) / cells) * 2.0 - 1.0;
      vec3 S = normalize(cubeDir(face, tan(sw * (PI / 4.0))));
      vec3 dl = S - D;
      float b1 = dot(Jx, dl), b2 = dot(Jy, dl);
      vec2 dp = vec2(a22 * b1 - a12 * b2, a11 * b2 - a12 * b1) / det;
      float wgt = exp(-dot(dp, dp) * 1.18);   // σ = 0.65 px
      if (wgt < 1e-4) continue;
      vec4 h2 = rand4(key + uvec4(0u, 0u, 16u, 7u));
      float mag = m0 + log(1.0 + h.w * lf) / (0.46 * 2.302585);
      float T = pow(10.0, 3.52 + 0.93 * pow(h2.x, 2.2));
      vec4 p0 = planckLookup(T), p1 = planckLookup(T * gs);
      acc += p1.rgb * exp2((p1.a - p0.a) * 3.321928) * (pow(10.0, -0.4 * mag) * wgt);
    }
  }
  // Flux zero point: the Milky Way band (texture value 1) is about −6.6 mag per
  // steradian, so a magnitude-0 star carries 2.3e-3 of it times one steradian.
  return acc * (2.3e-3 / (4.0841 * Afp));   // 2πσ² = 4.084 px²
}

vec3 skyRadiance(vec3 D, vec3 dDx, vec3 dDy, bool validJ, float gs) {
  float pixA = uOpt.w;
  if (!validJ) {
    // Neighbouring pixels ended far apart on the sky (next to the photon ring, or
    // at the edge of the disk): the pixel sees a compressed patch of sky, so it
    // gets the average of a wide footprint instead of individual stars.
    vec3 t1 = normalize(cross(D, abs(D.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(D, t1);
    dDx = t1 * (pixA * 10.0); dDy = t2 * (pixA * 10.0);
  }
  vec4 t = textureGrad(uSky, D, dDx, dDy);
  float T = 1500.0 + t.a * 20000.0;
  vec3 col = t.rgb * shiftRatio(T, gs) * uGain.y;
  if (uOpt.y > 0.5) {
    // Magnification is capped at 25: finite differences over one pixel cannot
    // resolve the true peak near caustics, and point stars would only sparkle.
    float Afp = max(length(cross(dDx, dDy)), pixA * pixA * 0.04);
    float fp = sqrt(Afp);
    float ext = texture(uDust, D).r;
    vec3 avgCol = shiftRatio(5600.0, gs);
    vec3 st = vec3(0.0);
    // Three magnitude ranges, each fading to its mean glow when the pixel covers many stars.
    float f1 = smoothstep(0.35, 0.9, fp * 40.0 / 1.5708);
    float f2 = smoothstep(0.35, 0.9, fp * 110.0 / 1.5708);
    float f3 = smoothstep(0.35, 0.9, fp * 300.0 / 1.5708);
    if (f1 < 1.0) st += (1.0 - f1) * starLayer(D, dDx, dDy, Afp, 40.0, 0.11, -1.5, 6.0, 1u, gs);
    if (f2 < 1.0) st += (1.0 - f2) * starLayer(D, dDx, dDy, Afp, 110.0, 0.28, 4.5, 2.7, 2u, gs);
    if (f3 < 1.0) st += (1.0 - f3) * starLayer(D, dDx, dDy, Afp, 300.0, 0.33, 7.2, 2.4, 3u, gs);
    st += (f1 * uStarAvg.x + f2 * uStarAvg.y + f3 * uStarAvg.z) * avgCol;
    col += min(st, vec3(6e4)) * ext * uGain.z;
  }
  return col;
}

void main() {
  vec2 ndc = (gl_FragCoord.xy + uJitter) / uRes * 2.0 - 1.0;
  vec2 xy = ndc * uTanFov;
  vec4 p = uCamU - (uCamF + xy.x * uCamR + xy.y * uCamUp) * inversesqrt(1.0 + dot(xy, xy));

  float r0 = uCamPos.x, th = uCamPos.y, ph0 = uCamPos.z;
  gA = uA; gA2 = gA * gA;
  gE = -p.x; gL = p.w;
  float pth = p.z;
  float ct = cos(th), st = sin(th);
  gQ = pth * pth + ct * ct * (gL * gL / (st * st) - gA2 * gE * gE);
  gK = gQ + (gL - gA * gE) * (gL - gA * gE);
  gAL = gA * gL; gAE2 = gA2 * gE * gE; gA2E = gA2 * gE; gLam0 = gQ + gL * gL;

  float rp = uHor.x;
  bool inside = r0 < rp;
  float Pplus = gE * (rp * rp + gA2) - gAL;
  float rEsc = max(uHor.w, r0 * 1.02);

  vec4 s = vec4(r0, (r0 * r0 - 2.0 * r0 + gA2) * p.y - (gE * (r0 * r0 + gA2) - gAL), 0.0, 0.0);
  vec3 n = vec3(st * cos(ph0), st * sin(ph0), ct);
  vec3 m = pth * vec3(ct * cos(ph0), ct * sin(ph0), -st) + (gL / st) * vec3(-sin(ph0), cos(ph0), 0.0);

  vec4 ds; vec3 dm; float X;
  deriv(s, n, m, ds, dm, X);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  int fate = 0;           // 0 lost (step budget), 1 sky, 2 hole, 3 opaque disk
  bool diskOn = uOpt.z > 0.5;

  for (int i = 0; i < 1200; i++) {
    if (i >= uMaxSteps) break;
    if (s.x > rEsc && s.y < 0.0) { fate = 1; break; }
    if (s.x < rp + 0.005 && s.y > 0.0) { fate = 2; break; }
    if (inside && s.x > rp - 0.005 && Pplus < 0.0) { fate = 2; break; }
    float h = -stepSize(s, m, X);

    vec4 s2 = s + 0.5 * h * ds; vec3 n2 = n + 0.5 * h * m; vec3 m2 = m + 0.5 * h * dm;
    vec4 ds2; vec3 dm2; float X2; deriv(s2, n2, m2, ds2, dm2, X2);
    vec4 s3 = s + 0.5 * h * ds2; vec3 n3 = n + 0.5 * h * m2; vec3 m3 = m + 0.5 * h * dm2;
    vec4 ds3; vec3 dm3; float X3; deriv(s3, n3, m3, ds3, dm3, X3);
    vec4 s4 = s + h * ds3; vec3 n4 = n + h * m3; vec3 m4 = m + h * dm3;
    vec4 ds4; vec3 dm4; float X4; deriv(s4, n4, m4, ds4, dm4, X4);

    vec4 sN = s + h / 6.0 * (ds + 2.0 * ds2 + 2.0 * ds3 + ds4);
    vec3 nN = n + h / 6.0 * (m + 2.0 * m2 + 2.0 * m3 + m4);
    vec3 mN = m + h / 6.0 * (dm + 2.0 * dm2 + 2.0 * dm3 + dm4);
    // Project back onto the constraints (see physics.js).
    sN.y = sign(sN.y) * sqrt(max(potR(sN.x), 0.0));
    nN = normalize(nN);
    mN -= dot(mN, nN) * nN;
    float mm = length(mN);
    if (mm > 1e-9) mN *= sqrt(max(gLam0 + gAE2 * nN.z * nN.z, 0.0)) / mm;

    vec4 dsN; vec3 dmN; float XN;
    deriv(sN, nN, mN, dsN, dmN, XN);

    if (diskOn && n.z * nN.z < 0.0) {
      float t = hermiteRoot(n.z, nN.z, m.z * h, mN.z * h);
      float rc = hermite(s.x, sN.x, ds.x * h, dsN.x * h, t);
      vec3 nc = normalize(mix(n, nN, t));
      float phc = atan(nc.y, nc.x) + mix(s.z, sN.z, t);
      vec4 em = diskEmission(rc, mix(s.y, sN.y, t), phc, mix(s.w, sN.w, t));
      col += trans * em.a * em.rgb;
      trans *= 1.0 - em.a;
      if (trans < 0.003) { fate = 3; break; }
    }
    s = sN; n = nN; m = mN; ds = dsN; dm = dmN; X = XN;
  }

  // Sky. Derivatives are taken outside any branch so the whole 2x2 quad agrees.
  float esc = fate == 1 ? 1.0 : 0.0;
  vec3 D = fate == 1 ? skyDirection(s, n, m) : vec3(0.0, 0.0, 1.0);
  vec3 dDx = dFdx(D), dDy = dFdy(D);
  bool validJ = fwidth(esc) == 0.0 && dot(dDx, dDx) < 0.02 && dot(dDy, dDy) < 0.02;
  if (fate == 1 && trans > 0.003) {
    col += trans * skyRadiance(D, dDx, dDy, validJ, 1.0 / gE);
  }
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

  /* ---------------------------------------------------- sky generation */
  const SKY = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
precision highp sampler2D;
out vec4 o;
uniform int uFace;
uniform float uSize;
uniform mat3 uGal;
uniform int uMode;
uniform sampler3D uNoise;
${COMMON}

vec3 faceDir(int f, vec2 c) {
  if (f == 0) return vec3(1.0, -c.y, -c.x);
  if (f == 1) return vec3(-1.0, -c.y, c.x);
  if (f == 2) return vec3(c.x, 1.0, c.y);
  if (f == 3) return vec3(c.x, -1.0, -c.y);
  if (f == 4) return vec3(c.x, -c.y, 1.0);
  return vec3(-c.x, -c.y, -1.0);
}
float vn(vec3 p, int ch) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return texture(uNoise, (i + f + 0.5) * (1.0 / 64.0))[ch];
}
const mat3 ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5, nrm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * vn(p, i & 3); nrm += a;
    p = ROT * p * 2.03 + 0.17; a *= 0.5;
  }
  return s / nrm;
}
float ridged(vec3 p, int oct) {
  float s = 0.0, a = 0.5, nrm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float v = 1.0 - abs(vn(p, (i + 1) & 3) * 2.0 - 1.0);
    s += a * v * v; nrm += a;
    p = ROT * p * 2.11 + 0.31; a *= 0.52;
  }
  return s / nrm;
}

void main() {
  vec2 c = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  vec3 d = normalize(faceDir(uFace, c));
  vec3 g = uGal * d;                      // galactic frame: x → centre, z → north pole
  float b = asin(clamp(g.z, -1.0, 1.0));  // latitude
  float l = atan(g.y, g.x);               // longitude
  float ab = abs(b);

  // Interstellar dust: a warped mid-plane lane broken into filaments, plus cirrus.
  float warp = 0.035 * sin(l * 1.3 + 0.4) + 0.015 * sin(l * 3.1 + 1.9);
  float db = b - warp;
  float lane = exp(-abs(db) / 0.03);
  float fil = ridged(g * 6.5 + vec3(3.1, 1.7, 5.3), 6);
  float mask = smoothstep(0.38, 0.62, fbm(g * 2.4 + vec3(11.0), 5));
  float tau = 3.4 * lane * (0.2 + 1.2 * fil * fil) * (0.3 + 0.7 * mask)
            + 0.8 * exp(-abs(db) / 0.10) * smoothstep(0.35, 0.75, fbm(g * 4.6 + vec3(4.0, 2.0, 7.0), 5))
            + 0.35 * exp(-ab / 0.35) * smoothstep(0.58, 0.8, fbm(g * 3.0 + 2.0, 5));
  if (uMode == 1) { o = vec4(exp(-0.9 * tau), 0.0, 0.0, 1.0); return; }

  // Starlight of the galactic disk (star clouds) and the boxy bulge.
  float lp = 0.26 + 0.74 * exp(-l * l / (2.0 * 1.05 * 1.05));
  float cl1 = fbm(g * 4.2 + vec3(1.3), 6);
  float cl2 = fbm(g * 12.0 + vec3(7.7), 5);
  float thin = exp(-ab / 0.065);
  float thick = exp(-ab / 0.2);
  float disk = lp * (thin * (0.1 + 2.2 * cl1 * cl1 * (0.55 + 0.9 * cl2)) + 0.035 * thick * (0.4 + cl1));
  float bulge = 1.1 * exp(-(l * l / (2.0 * 0.15 * 0.15) + b * b / (2.0 * 0.095 * 0.095)))
              + 0.12 * exp(-(l * l / (2.0 * 0.3 * 0.3) + b * b / (2.0 * 0.18 * 0.18)));
  vec3 cDisk = planckLookup(5400.0).rgb;
  vec3 cBulge = planckLookup(4300.0).rgb;
  vec3 ext = exp(-tau * vec3(0.78, 1.0, 1.32));   // extinction A_λ ∝ 1/λ reddens what it dims
  vec3 light = (disk * cDisk + bulge * cBulge) * ext;

  // Emission nebulae (Hα pink) and reflection nebulae (blue).
  float hii = pow(max(fbm(g * 9.0 + vec3(21.0, 3.0, 8.0), 5) - 0.6, 0.0) * 4.8, 2.0) * exp(-abs(db) / 0.05);
  float refl = pow(max(fbm(g * 7.5 + vec3(5.0, 9.0, 1.0), 4) - 0.64, 0.0) * 5.0, 2.0) * exp(-ab / 0.14);
  light += hii * vec3(1.0, 0.24, 0.36) * 0.8 * ext.r + refl * vec3(0.42, 0.58, 1.0) * 0.22 * ext.b;

  // Extragalactic background light.
  light += vec3(0.0020, 0.0022, 0.0027);

  // Faint unresolved stars, one texel each (flux conserved for any cubemap size).
  float tsc = (uSize / 1024.0) * (uSize / 1024.0);
  vec4 hs = rand4(uvec4(uvec2(gl_FragCoord.xy), uint(uFace), 91u));
  float dens = 0.006 * (1.0 + 4.0 * thin * lp + 3.0 * bulge);
  if (hs.x < dens * tsc * 4.0) {
    float mag = 8.2 + 3.8 * sqrt(hs.y);
    float T = pow(10.0, 3.5 + 0.75 * hs.z * hs.z);
    light += planckLookup(T).rgb * (0.30 * pow(10.0, -0.4 * (mag - 8.2)) / tsc) * ext * 0.25;
  }

  // Distant galaxies, mostly outside the dusty plane.
  vec3 gc = floor(d * 34.0);
  vec4 hg = rand4(uvec4(uvec3(ivec3(gc) + 4096), 5u));
  float galT = 0.0, galL = 0.0;
  if (hg.x < 0.16 * (1.0 - thin)) {
    vec4 hq = rand4(uvec4(uvec3(ivec3(gc) + 4096), 6u));
    vec3 cen = normalize((gc + 0.5 + (hg.yzw - 0.5) * 0.5) / 34.0);
    vec3 t1 = normalize(cross(cen, vec3(0.3, 0.5, 0.8)));
    vec3 t2 = cross(cen, t1);
    float ang = hq.x * 6.2831;
    vec3 ax = t1 * cos(ang) + t2 * sin(ang), ay = cross(cen, ax);
    float size = mix(0.0012, 0.0045, hq.y * hq.y);
    float ell = mix(0.25, 1.0, hq.z);
    vec2 q = vec2(dot(d - cen, ax), dot(d - cen, ay)) / size;
    float prof = exp(-length(vec2(q.x, q.y / ell)) * 3.0);
    galL = prof * mix(0.06, 0.4, hq.w * hq.w);
    galT = hq.w > 0.5 ? 6500.0 : 4600.0;
    light += galL * planckLookup(galT).rgb * ext;
  }

  // Luminance-weighted colour temperature of this patch of sky, used to
  // Doppler-shift it exactly as a blackbody when seen by a moving observer.
  float wsum = disk + bulge + hii + refl + galL + 0.002;
  float T = (disk * 5400.0 + bulge * 4300.0 + hii * 3200.0 + refl * 9000.0 + galL * max(galT, 1.0) + 0.002 * 6000.0) / wsum;
  T *= mix(1.0, 0.78, clamp(tau * 0.3, 0.0, 1.0));
  o = vec4(clamp(light * 0.8, 0.0, 1.0), clamp((T - 1500.0) / 20000.0, 0.0, 1.0));
}`;

  /* ------------------------------------------------ post-processing */
  const ACCUM = `#version 300 es
precision highp float;
uniform sampler2D uCur, uHist;
uniform float uAlpha;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uCur, p, 0).rgb;
  vec3 h = texelFetch(uHist, p, 0).rgb;
  if (any(isnan(h)) || any(isinf(h))) h = c;
  o = vec4(mix(h, c, uAlpha), 1.0);
}`;

  // 13-tap downsample (Jimenez 2014). The first pass uses a Karis average so
  // single bright pixels (stars, the photon ring) do not flicker in the glare.
  const DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform int uKaris;
uniform vec2 uDstRes;
out vec4 o;
vec3 T(vec2 uv) { return texture(uSrc, uv).rgb; }
float kw(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec2 t = uTexel;
  vec3 a = T(uv + t * vec2(-2.0, 2.0)), b = T(uv + t * vec2(0.0, 2.0)), c = T(uv + t * vec2(2.0, 2.0));
  vec3 d = T(uv + t * vec2(-2.0, 0.0)), e = T(uv), f = T(uv + t * vec2(2.0, 0.0));
  vec3 g = T(uv + t * vec2(-2.0, -2.0)), h = T(uv + t * vec2(0.0, -2.0)), i = T(uv + t * vec2(2.0, -2.0));
  vec3 j = T(uv + t * vec2(-1.0, 1.0)), k = T(uv + t * vec2(1.0, 1.0));
  vec3 l = T(uv + t * vec2(-1.0, -1.0)), m = T(uv + t * vec2(1.0, -1.0));
  vec3 r;
  if (uKaris == 1) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4);
    r = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5)
      / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(r, 1.0);
}`;

  const UP = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform vec2 uDstRes;
uniform float uWeight;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec2 t = uTexel;
  vec3 s = texture(uSrc, uv + t * vec2(-1.0, 1.0)).rgb + texture(uSrc, uv + t * vec2(1.0, 1.0)).rgb
         + texture(uSrc, uv + t * vec2(-1.0, -1.0)).rgb + texture(uSrc, uv + t * vec2(1.0, -1.0)).rgb
         + 2.0 * (texture(uSrc, uv + t * vec2(0.0, 1.0)).rgb + texture(uSrc, uv + t * vec2(0.0, -1.0)).rgb
                + texture(uSrc, uv + t * vec2(-1.0, 0.0)).rgb + texture(uSrc, uv + t * vec2(1.0, 0.0)).rgb)
         + 4.0 * texture(uSrc, uv).rgb;
  o = vec4(s * (uWeight / 16.0), 1.0);
}`;

  // Exposure adapts like an eye. The meter uses the arithmetic mean luminance:
  // a log average would be dragged down by the shadow, which is black by nature.
  const EXPOSURE = `#version 300 es
precision highp float;
uniform sampler2D uSmall;
uniform sampler2D uPrev;
uniform float uBlend;
uniform float uKey;
uniform float uAuto;
uniform float uManual;
out vec4 o;
void main() {
  float sum = 0.0, peak = 0.0;
  for (int j = 0; j < 8; j++) {
    for (int i = 0; i < 8; i++) {
      vec2 uv = (vec2(float(i), float(j)) + 0.5) / 8.0;
      float Y = dot(texture(uSmall, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
      sum += Y;
      peak = max(peak, Y);
    }
  }
  // Each sample already averages a 32×32 block, so the peak is a bright region,
  // not a star. Metering on it protects the highlights, like a camera would.
  float avg = max(2.0 * sum / 64.0, 0.5 * peak);
  float target = uAuto > 0.5 ? clamp(uKey / max(avg, 1e-6), 1e-3, 60.0) : 1.0;
  target *= uManual;
  float prev = texelFetch(uPrev, ivec2(0), 0).r;
  if (!(prev > 0.0) || isinf(prev)) prev = target;
  float e = exp2(mix(log2(prev), log2(target), uBlend));
  o = vec4(e, avg, 0.0, 1.0);
}`;

  const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uHdr;
uniform sampler2D uBloom;
uniform sampler2D uExp;
uniform vec2 uSrcRes;
uniform vec2 uDstRes;
uniform float uBloomAmt;
uniform float uBloomNorm;
uniform float uFrame;
uniform float uTone;
out vec4 o;
${HASH}
// Catmull–Rom upscaling in 9 bilinear taps.
vec3 sampleCR(vec2 uv) {
  vec2 pos = uv * uSrcRes;
  vec2 tc = floor(pos - 0.5) + 0.5;
  vec2 f = pos - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 o12 = w2 / w12;
  vec2 t0 = (tc - 1.0) / uSrcRes, t3 = (tc + 2.0) / uSrcRes, t12 = (tc + o12) / uSrcRes;
  vec3 r = vec3(0.0);
  r += texture(uHdr, vec2(t0.x, t0.y)).rgb * w0.x * w0.y;
  r += texture(uHdr, vec2(t12.x, t0.y)).rgb * w12.x * w0.y;
  r += texture(uHdr, vec2(t3.x, t0.y)).rgb * w3.x * w0.y;
  r += texture(uHdr, vec2(t0.x, t12.y)).rgb * w0.x * w12.y;
  r += texture(uHdr, vec2(t12.x, t12.y)).rgb * w12.x * w12.y;
  r += texture(uHdr, vec2(t3.x, t12.y)).rgb * w3.x * w12.y;
  r += texture(uHdr, vec2(t0.x, t3.y)).rgb * w0.x * w3.y;
  r += texture(uHdr, vec2(t12.x, t3.y)).rgb * w12.x * w3.y;
  r += texture(uHdr, vec2(t3.x, t3.y)).rgb * w3.x * w3.y;
  return max(r, vec3(0.0));
}

// AgX (Sobotka) with a gentle "punchy" look: highlights roll off to white
// without the hue skews of simpler curves.
vec3 agxCurve(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 c) {
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                      0.0784335999999992, 0.878468636469772, 0.0784336,
                      0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                       -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                       -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float lo = -12.47393, hi = 4.026069;
  c = m * max(c, vec3(1e-10));
  c = clamp(log2(c), lo, hi);
  c = (c - lo) / (hi - lo);
  c = agxCurve(c);
  // "Punchy" look (Blender): power 1.35, saturation 1.4.
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = pow(max(c, vec3(0.0)), vec3(1.35));
  luma = pow(max(luma, 0.0), 1.35);
  c = luma + 1.4 * (c - luma);
  return max(mi * c, vec3(0.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec3 c = sampleCR(uv);
  vec3 b = texture(uBloom, uv).rgb * uBloomNorm;   // the pyramid sums its levels
  c = mix(c, b, uBloomAmt);
  c *= texelFetch(uExp, ivec2(0), 0).r;
  if (uTone < 0.5) {
    c = agx(c);
  } else {
    // ACES filmic (Narkowicz fit), then the sRGB transfer curve.
    c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  // Triangular dither against banding in the dark sky.
  vec4 h = rand4(uvec4(uvec2(gl_FragCoord.xy), uint(uFrame), 3u));
  c += (h.x + h.y - 1.0) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

  // Fallback for devices that cannot render to floating-point targets:
  // the tracer output is tone-mapped inline and drawn straight to the screen.
  const TRACE_DIRECT = TRACE.replace(
    'fragColor = vec4(max(col, vec3(0.0)), 1.0);',
    `vec3 c2 = max(col, vec3(0.0)) * uGain.w;
  c2 = c2 / (1.0 + dot(c2, vec3(0.2126, 0.7152, 0.0722)));
  fragColor = vec4(pow(c2, vec3(1.0 / 2.2)), 1.0);`
  );

  return { VERT, TRACE, TRACE_DIRECT, SKY, ACCUM, DOWN, UP, EXPOSURE, COMPOSITE };
})();

if (typeof module !== 'undefined') module.exports = Shaders;
