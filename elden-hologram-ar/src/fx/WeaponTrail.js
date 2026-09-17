// Scia dell'arma: il nastro luminoso che la lama lascia dietro di sé.
//
// Nei video dei boss di Elden Ring è quello che rende leggibile un fendente:
// l'arco che la spada disegna nell'aria resta visibile per una frazione di
// secondo e racconta da dove arriva il colpo. Qui la scia è costruita campionando
// ogni frame due punti — impugnatura e punta — e cucendoli in una striscia di
// quad che sfuma con l'età.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aAge;
  attribute float aEdge;
  varying float vAge;
  varying float vEdge;
  void main() {
    vAge = aAge;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;
  uniform float uOpacity;
  varying float vAge;
  varying float vEdge;
  void main() {
    float life = 1.0 - clamp(vAge, 0.0, 1.0);
    // la scia si assottiglia verso la punta e svanisce con l'età
    float taper = mix(1.0, 0.18, vEdge);
    float a = life * life * taper * uOpacity;
    if (a < 0.004) discard;
    vec3 col = mix(uEdgeColor, uColor, life);
    gl_FragColor = vec4(col * a, a);
  }
`;

export class WeaponTrail {
  /**
   * @param {object} [opts]
   * @param {number} [opts.segments] campioni tenuti in memoria (lunghezza della scia)
   * @param {number|string} [opts.color] colore del nucleo
   * @param {number|string} [opts.edgeColor] colore del bordo, più freddo
   */
  constructor({ segments = 22, color = 0xfff3d2, edgeColor = 0xffb347 } = {}) {
    this.segments = segments;
    this.samples = [];          // [{ a: Vector3, b: Vector3, age: number }]
    this.emitting = false;
    this.fade = 0.22;           // secondi di vita di un campione
    this.opacity = 1;

    const n = segments * 2;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(n * 3);
    this.ages = new Float32Array(n);
    this.edges = new Float32Array(n);
    for (let i = 0; i < segments; i++) { this.edges[i * 2] = 0; this.edges[i * 2 + 1] = 1; }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.ages, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aEdge', new THREE.BufferAttribute(this.edges, 1));
    const index = [];
    for (let i = 0; i < segments - 1; i++) {
      const o = i * 2;
      index.push(o, o + 1, o + 3, o, o + 3, o + 2);
    }
    geo.setIndex(index);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e3); // niente frustum culling

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uEdgeColor: { value: new THREE.Color(edgeColor) },
        uOpacity: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'WeaponTrail';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
  }

  setColor(color, edgeColor) {
    this.material.uniforms.uColor.value.set(color);
    if (edgeColor != null) this.material.uniforms.uEdgeColor.value.set(edgeColor);
  }

  /** Accende o spegne l'emissione: la scia già disegnata continua a sfumare. */
  setEmitting(v) {
    if (v && !this.emitting) this.samples.length = 0;   // niente salto dal colpo precedente
    this.emitting = !!v;
  }

  /**
   * Aggiunge un campione (impugnatura → punta), in coordinate dell'arena.
   * Se fra un frame e l'altro la lama ha percorso molta strada — spazzata veloce
   * o telefono che arranca — i punti intermedi vengono ricostruiti, altrimenti
   * la scia diventa una scaletta di segmenti staccati.
   */
  push(a, b) {
    if (!this.emitting) return;
    const s = this.samples;
    const span = a.distanceTo(b) || 1;      // lunghezza dell'arma: unità di misura naturale
    if (s.length) {
      const prev = s[0];
      const d = prev.a.distanceTo(a);
      if (d > span * 8) {
        s.length = 0;                        // salto enorme: la scia si spezza
      } else if (d > span * 0.3) {
        const steps = Math.min(5, Math.round(d / (span * 0.3)));
        for (let i = 1; i < steps; i++) {
          const k = i / steps;
          s.unshift({
            a: prev.a.clone().lerp(a, k),
            b: prev.b.clone().lerp(b, k),
            age: prev.age * (1 - k),
          });
        }
      }
    }
    s.unshift({ a: a.clone(), b: b.clone(), age: 0 });
    if (s.length > this.segments) s.length = this.segments;
  }

  update(dt) {
    const s = this.samples;
    for (let i = s.length - 1; i >= 0; i--) {
      s[i].age += dt;
      if (s[i].age > this.fade) s.length = i;
    }
    const count = s.length;
    if (count < 2) { this.mesh.visible = false; this.mesh.geometry.setDrawRange(0, 0); return; }

    const pos = this.positions, ages = this.ages;
    for (let i = 0; i < count; i++) {
      const smp = s[i];
      const k = i * 6;
      pos[k] = smp.a.x; pos[k + 1] = smp.a.y; pos[k + 2] = smp.a.z;
      pos[k + 3] = smp.b.x; pos[k + 4] = smp.b.y; pos[k + 5] = smp.b.z;
      // l'età conta sia il tempo sia la posizione nella coda: la punta sfuma prima
      const age = Math.max(smp.age / this.fade, i / this.segments);
      ages[i * 2] = age; ages[i * 2 + 1] = age;
    }
    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAge.needsUpdate = true;
    geo.setDrawRange(0, (count - 1) * 6);
    this.material.uniforms.uOpacity.value = this.opacity;
    this.mesh.visible = true;
  }

  clear() {
    this.samples.length = 0;
    this.emitting = false;
    this.mesh.visible = false;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
