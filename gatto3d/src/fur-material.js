// Pelliccia a "gusci" (shell fur): la stessa maglia viene disegnata N volte spostata lungo la normale
// (con gravità), e ogni strato conserva solo i pixel che appartengono a un ciuffo. Un solo draw call
// per maglia grazie all'instancing. Il colore di base è per vertice; i dettagli del muso (bordo degli
// occhi, tartufo, narici, bocca) sono calcolati per pixel nello spazio della testa.
import * as THREE from 'three';
import { HEAD, EYES, NOSE, LID } from './cat-shape.js';

const VERT = /* glsl */ `
attribute float aFur;
attribute float aLayer;
attribute vec3 aColor;
uniform float uFurScale;
uniform float uIsSkin;
uniform float uGravity;
varying vec3 vBase;
varying vec3 vNobj;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vColor;
varying float vT;
varying float vFur;
void main() {
  float t = uIsSkin > 0.5 ? 0.0 : aLayer;
  vec3 n = normalize(normal);
  float L = aFur * uFurScale;
  vec3 down = vec3(0.0, -1.0, 0.0);
  vec3 tDown = down - n * dot(down, n);
  float tl = length(tDown);
  tDown = tl > 1e-4 ? tDown / tl : vec3(0.0);
  float bend = t * t;
  vec3 disp = n * L * t * (1.0 - 0.30 * bend * uGravity)
            + tDown * L * bend * uGravity * 0.55
            + down * L * bend * uGravity * 0.25;
  vec3 p = position + disp;
  vBase = position;
  vNobj = n;
  vColor = aColor;
  vT = t;
  vFur = L;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWp = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uHead;
uniform vec3 uEyeL;
uniform vec3 uEyeR;
uniform vec3 uNose;
uniform vec3 uLid;
uniform float uIsSkin;
uniform float uDensity;
uniform float uThick;
uniform float uGravity;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uFillDir;
uniform vec3 uFillCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
uniform vec3 uNoseCol;
uniform vec3 uDarkCol;
varying vec3 vBase;
varying vec3 vNobj;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vColor;
varying float vT;
varying float vFur;

vec3 hash23(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  vec3 albedo = srgbToLinear(vColor);
  vec3 q = vBase - uHead;

  // bordo scuro delle palpebre: anello attorno all'apertura dell'occhio
  vec3 eL = q - uEyeL;
  vec3 eR = q - uEyeR;
  float adL = length(vec2(eL.x / uLid.x, (eL.y - uLid.z) / uLid.y));
  float adR = length(vec2(eR.x / uLid.x, (eR.y - uLid.z) / uLid.y));
  float lL = smoothstep(0.9, 1.02, adL) * (1.0 - smoothstep(1.12, 1.28, adL)) * step(0.4, eL.z);
  float lR = smoothstep(0.9, 1.02, adR) * (1.0 - smoothstep(1.12, 1.28, adR)) * step(0.4, eR.z);
  float liner = max(lL, lR);
  albedo = mix(albedo, uDarkCol, liner * 0.85);

  // tartufo rosa-bruno con bordo più scuro e narici
  vec3 nq = q - uNose;
  float nd = length(nq / vec3(0.95, 0.72, 0.8));
  float noseM = 1.0 - smoothstep(0.86, 1.04, nd);
  vec3 noseCol = mix(uNoseCol, uNoseCol * 0.5, smoothstep(0.5, 1.0, nd));
  float ns = min(distance(nq, vec3(0.34, -0.10, 0.42)), distance(nq, vec3(-0.34, -0.10, 0.42)));
  noseCol = mix(noseCol, vec3(0.04, 0.025, 0.02), 1.0 - smoothstep(0.12, 0.22, ns));
  float phil = (1.0 - smoothstep(0.04, 0.11, abs(nq.x))) * smoothstep(-1.15, -0.85, nq.y) * (1.0 - smoothstep(-0.55, -0.4, nq.y)) * step(0.0, nq.z);
  albedo = mix(albedo, noseCol, noseM);
  albedo = mix(albedo, uDarkCol * 0.7, phil * 0.75 * (1.0 - noseM));

  // linea della bocca, che scende agli angoli (l'espressione seria di Artù)
  vec2 m = vec2(q.x, q.y - (uNose.y - 1.15));
  float yLine = -0.10 * abs(m.x) - 0.10 * m.x * m.x;
  float mouth = (1.0 - smoothstep(0.05, 0.13, abs(m.y - yLine))) * (1.0 - smoothstep(1.15, 1.4, abs(m.x))) * step(uNose.z - 1.3, q.z);
  albedo = mix(albedo, uDarkCol * 0.5, mouth * 0.9);

  float alpha = 1.0;
  if (uIsSkin < 0.5) {
    if (vFur < 0.12) discard; // sul tartufo e sul bordo delle palpebre resta solo la pelle
    // celle 2D sul piano dominante della normale: un ciuffo per cella
    vec3 an = abs(vNobj);
    vec2 uv = (an.x >= an.y && an.x >= an.z) ? vBase.yz : (an.y >= an.z ? vBase.xz : vBase.xy);
    uv *= uDensity;
    vec2 cellBase = floor(uv - 0.5);
    float cover = 0.0;
    float tint = 0.5;
    for (int i = 0; i < 2; i++) {
      for (int j = 0; j < 2; j++) {
        vec2 c = cellBase + vec2(float(i), float(j));
        vec3 h = hash23(c);
        vec2 center = c + 0.5 + (h.xy - 0.5) * 0.9;
        float hgt = 0.35 + 0.65 * pow(h.z, 1.5);
        float rel = vT / hgt;
        if (rel < 1.0) {
          float r = uThick * (1.0 - rel * 0.6);
          float dd = distance(uv, center);
          float a = 1.0 - smoothstep(r * 0.35, r, dd);
          if (a > cover) { cover = a; tint = fract(h.x * 7.31 + h.y * 3.17); }
        }
      }
    }
    cover *= 1.0 - mouth * 0.85;
    if (cover < 0.03) discard;
    alpha = cover;
    albedo *= 0.9 + 0.2 * tint;
  }
  // radici in ombra, punte leggermente più chiare
  albedo *= mix(0.55, 0.9, smoothstep(0.0, 1.0, vT));

  vec3 N = normalize(vNw);
  vec3 V = normalize(cameraPosition - vWp);
  vec3 T = normalize(N + vec3(0.0, -1.0, 0.0) * (0.35 + 0.6 * vT) * uGravity);
  float wrap = 0.4;
  float dK = clamp((dot(N, uKeyDir) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float dF = clamp((dot(N, uFillDir) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float dR = clamp(dot(N, uRimDir), 0.0, 1.0);
  vec3 hemi = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 diffuse = uKeyCol * dK + uFillCol * dF + hemi;
  vec3 H = normalize(uKeyDir + V);
  float TdotH = dot(T, H);
  float sinTH = sqrt(max(0.0, 1.0 - TdotH * TdotH));
  float spec = pow(sinTH, 48.0) * 0.2 * smoothstep(0.0, 0.3, dK);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 rim = uRimCol * dR * fres * 0.6 + uKeyCol * fres * 0.06;
  vec3 col = albedo * diffuse + spec * uKeyCol * (1.0 - liner) * (1.0 - noseM * 0.5) + rim * (0.4 + 0.6 * vT);
  float nSpec = pow(max(dot(N, H), 0.0), 60.0) * noseM * 0.5;
  col += nSpec * uKeyCol;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const lin = (hex) => new THREE.Color(hex); // Color converte da sRGB a lineare con la gestione colore attiva

export function createLightUniforms() {
  return {
    uKeyDir: { value: new THREE.Vector3(0.55, 0.85, 0.75).normalize() },
    uKeyCol: { value: lin(0xfff6ee).multiplyScalar(1.3) },
    uFillDir: { value: new THREE.Vector3(-0.75, 0.25, 0.35).normalize() },
    uFillCol: { value: lin(0xcfdcef).multiplyScalar(0.55) },
    uRimDir: { value: new THREE.Vector3(0.15, 0.45, -0.9).normalize() },
    uRimCol: { value: lin(0xffe6c8).multiplyScalar(0.9) },
    uSkyCol: { value: lin(0xb9c6d8).multiplyScalar(0.7) },
    uGroundCol: { value: lin(0x8c7666).multiplyScalar(0.55) },
  };
}

export function createFurMaterials(lights) {
  const shared = {
    ...lights,
    uHead: { value: new THREE.Vector3(HEAD.x, HEAD.y, HEAD.z) },
    uEyeL: { value: new THREE.Vector3(EYES[1].x, EYES[1].y, EYES[1].z) },
    uEyeR: { value: new THREE.Vector3(EYES[0].x, EYES[0].y, EYES[0].z) },
    uNose: { value: new THREE.Vector3(NOSE.x, NOSE.y, NOSE.z) },
    uLid: { value: new THREE.Vector3(LID.rx, LID.ry, LID.dy) },
    uFurScale: { value: 1.0 },
    uGravity: { value: 1.0 },
    uDensity: { value: 7.0 },
    uThick: { value: 0.85 },
    uNoseCol: { value: lin(0xbf7f74) },
    uDarkCol: { value: lin(0x3f2416) },
  };
  const make = (isSkin) => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...shared, uIsSkin: { value: isSkin ? 1 : 0 } },
    side: THREE.FrontSide,
    alphaToCoverage: !isSkin,
  });
  return { skin: make(true), shell: make(false), uniforms: shared };
}
