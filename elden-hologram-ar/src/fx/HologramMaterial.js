// Materiale "ologramma": tinta, scanline, bordo luminoso (fresnel), sfarfallio
// e taglio verticale (uRevealY) usato per l'evocazione e la dissolvenza.
// Supporta mesh skinnate (modelli glTF riggati) grazie ai chunk di three.js.
import * as THREE from 'three';

export const STYLES = {
  realistic: { label: 'Realistico' },
  spirit: { label: 'Spirito', tint: new THREE.Color(0x8fd8ff) },
  gold: { label: 'Oro ancestrale', tint: new THREE.Color(0xffd166) },
};
export const STYLE_ORDER = ['realistic', 'spirit', 'gold'];

export function createHologramUniforms() {
  return {
    uTime: { value: 0 },
    uRevealY: { value: 1e6 },
    uBaseY: { value: 0 },
    uHeight: { value: 1 },
    uOpacity: { value: 1 },
    uTint: { value: new THREE.Color(0x8fd8ff) },
    uGlow: { value: 1 },
  };
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  #include <common>
  #include <skinning_pars_vertex>
  #include <morphtarget_pars_vertex>
  void main() {
    vUv = uv;
    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
    vWorldPos = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * objectNormal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D map;
  uniform float uHasMap;
  uniform vec3 uColor;
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uRevealY;
  uniform float uBaseY;
  uniform float uHeight;
  uniform float uOpacity;
  uniform float uGlow;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  void main() {
    if (vWorldPos.y > uRevealY) discard;
    vec3 base = uColor;
    if (uHasMap > 0.5) base *= texture2D(map, vUv).rgb;
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndv = abs(dot(normalize(vNormalW), viewDir));
    float rim = pow(1.0 - ndv, 2.2);
    float h = max(uHeight, 0.001);
    float scan = 0.82 + 0.18 * sin((vWorldPos.y - uBaseY) / h * 110.0 - uTime * 7.0);
    float flicker = 0.94 + 0.06 * sin(uTime * 37.0) * sin(uTime * 13.0);
    float edge = 1.0 - smoothstep(0.0, 0.05 * h, uRevealY - vWorldPos.y);
    vec3 col = uTint * (0.22 + 0.78 * lum) * scan;
    col += uTint * rim * 1.7 * uGlow;
    col += uTint * edge * 3.5;
    float alpha = (0.32 + 0.68 * rim) * flicker * uOpacity;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/**
 * Crea un materiale ologramma che conserva la texture diffuse del materiale originale.
 * Le uniform passate sono condivise fra tutte le mesh dello stesso boss.
 */
export function makeHologramMaterial(source, sharedUniforms) {
  const map = source && source.map ? source.map : null;
  const color = source && source.color ? source.color.clone() : new THREE.Color(1, 1, 1);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      map: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uColor: { value: color },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  m.name = 'HologramMaterial';
  return m;
}
