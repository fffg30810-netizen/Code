// Occhi: sfera con iride procedurale (fibre radiali, anello limbare scuro, pupilla), cornea lucida
// con riflessi e occlusione verso le palpebre.
import * as THREE from 'three';
import { EYE_LOOK } from './eye-look.js';

const VERT = /* glsl */ `
varying vec3 vL;
varying vec3 vNw;
varying vec3 vWp;
void main() {
  vL = position;
  vNw = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uIrisA;
uniform vec3 uIrisB;
uniform vec3 uRim;
uniform vec3 uSclera;
uniform float uPupil;
uniform float uIrisEdge;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uFillDir;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
varying vec3 vL;
varying vec3 vNw;
varying vec3 vWp;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 d = normalize(vL);
  float ang = acos(clamp(d.z, -1.0, 1.0));
  float th = atan(d.y, d.x);
  float rr = ang / uIrisEdge;
  float pr = length(vec2(d.x * 1.15, d.y));
  float pupil = 1.0 - smoothstep(uPupil - 0.02, uPupil + 0.02, pr);
  float iris = 1.0 - smoothstep(uIrisEdge - 0.03, uIrisEdge + 0.03, ang);
  float fib = vnoise(vec2(th * 9.0, rr * 6.0)) * 0.6 + vnoise(vec2(th * 25.0 + 3.0, rr * 14.0)) * 0.4;
  vec3 irisCol = mix(uIrisA, uIrisB, smoothstep(0.15, 0.85, rr));
  irisCol *= 0.75 + 0.5 * fib;
  irisCol = mix(irisCol, uRim, smoothstep(0.78, 1.0, rr));
  irisCol = mix(irisCol, uIrisA * 1.15, (1.0 - smoothstep(0.25, 0.45, rr)) * 0.5);
  vec3 col = mix(uSclera, irisCol, iris);
  col = mix(col, vec3(0.012, 0.009, 0.007), pupil);

  vec3 N = normalize(vNw);
  vec3 V = normalize(cameraPosition - vWp);
  float diff = clamp(dot(N, uKeyDir), 0.0, 1.0) * 0.8 + 0.5;
  vec3 hemi = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 lit = col * (uKeyCol * diff * 0.75 + hemi * 0.8);
  vec3 H1 = normalize(uKeyDir + V);
  float s1 = pow(max(dot(N, H1), 0.0), 260.0);
  vec3 H2 = normalize(uFillDir + V);
  float s2 = pow(max(dot(N, H2), 0.0), 120.0) * 0.25;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 env = mix(uGroundCol * 0.8, uSkyCol * 1.4, smoothstep(-0.3, 0.8, R.y));
  lit += (s1 * 0.8 + s2) * uKeyCol + env * fres * 0.7;
  lit *= 1.0 - 0.45 * smoothstep(0.85, 1.35, ang);
  lit *= 1.0 - 0.3 * smoothstep(0.35, 0.9, d.y); // ombra della palpebra superiore
  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createEyeMaterial(lights) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uKeyDir: lights.uKeyDir, uKeyCol: lights.uKeyCol, uFillDir: lights.uFillDir, uSkyCol: lights.uSkyCol, uGroundCol: lights.uGroundCol,
      uIrisA: { value: new THREE.Color(EYE_LOOK.irisInner) },
      uIrisB: { value: new THREE.Color(EYE_LOOK.irisOuter) },
      uRim: { value: new THREE.Color(EYE_LOOK.rim) },
      uSclera: { value: new THREE.Color(EYE_LOOK.sclera) },
      uPupil: { value: EYE_LOOK.pupil },
      uIrisEdge: { value: EYE_LOOK.irisEdge },
    },
  });
}
