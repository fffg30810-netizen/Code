// Innesto sui materiali dei boss per farli somigliare a ciò che la fotocamera riprende.
//
// Un modello 3D è "troppo pulito": niente rumore del sensore, neri assoluti,
// colori più saturi di quelli di una stanza ripresa da un telefono. Messo sopra
// l'immagine della fotocamera si stacca subito. Qui si aggiungono alla fine del
// fragment shader tre correzioni minime — grana, alzata del nero, desaturazione —
// che bastano a far sembrare il boss ripreso insieme alla stanza.
import * as THREE from 'three';

export function createMatchUniforms() {
  return {
    uTime: { value: 0 },
    uGrain: { value: 0.035 },     // ampiezza del rumore
    uLift: { value: 0.012 },      // il nero di una fotocamera non è mai nero
    uDesat: { value: 0.08 },      // un filo di desaturazione
  };
}

/**
 * Applica l'innesto a un materiale standard/physical. Idempotente: un materiale
 * già trattato viene lasciato com'è.
 * @param {THREE.Material} material
 * @param {ReturnType<createMatchUniforms>} uniforms condivise per boss
 */
export function applyCameraMatch(material, uniforms) {
  if (!material || material.userData.cameraMatch) return material;
  if (material.isShaderMaterial && !material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) return material;
  material.userData.cameraMatch = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (typeof prev === 'function') prev(shader, renderer);
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uGrain = uniforms.uGrain;
    shader.uniforms.uLift = uniforms.uLift;
    shader.uniforms.uDesat = uniforms.uDesat;
    const head = 'uniform float uTime;\nuniform float uGrain;\nuniform float uLift;\nuniform float uDesat;\n';
    shader.fragmentShader = head + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      {
        vec2 sp = gl_FragCoord.xy + vec2(fract(uTime * 37.0) * 311.0, fract(uTime * 17.0) * 197.0);
        float n = fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor.rgb += (n - 0.5) * uGrain;
        gl_FragColor.rgb += uLift;
        float l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(l), uDesat);
      }`,
    );
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `cameraMatch|${prevKey ? prevKey.call(material) : ''}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Regola la grana in base a quanta luce c'è: al buio il sensore di un telefono
 * fa molto più rumore, e il boss deve seguirlo.
 * @param {ReturnType<createMatchUniforms>} uniforms
 * @param {number} luminance 0..1
 */
export function tuneCameraMatch(uniforms, luminance) {
  const l = THREE.MathUtils.clamp(luminance, 0, 1);
  uniforms.uGrain.value = 0.02 + (1 - l) * 0.075;
  uniforms.uLift.value = 0.006 + (1 - l) * 0.022;
}
