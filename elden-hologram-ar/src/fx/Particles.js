// Sistema particellare leggero (Points) per scintille dei colpi, evocazioni e vittoria.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.05);
    gl_Position = projectionMatrix * mv;
  }
`;
const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float a = smoothstep(1.0, 0.2, r) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export class Particles {
  constructor(scene, max = 800) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.cursor = 0;
    this.alive = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // mai cullato
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader, fragmentShader,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.name = 'Particles';
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  /** Emette `count` particelle da `position` (world). Dimensioni in metri. */
  burst({ position, color = 0xffd166, count = 24, speed = 0.6, spread = 1, life = 0.6, size = 0.02, gravity = 1.2, up = 0.4 }) {
    this._c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + up, Math.random() - 0.5).normalize();
      const s = speed * (0.4 + Math.random() * 0.9) * spread;
      this.pos[i3] = position.x; this.pos[i3 + 1] = position.y; this.pos[i3 + 2] = position.z;
      this.vel[i3] = dir.x * s; this.vel[i3 + 1] = dir.y * s; this.vel[i3 + 2] = dir.z * s;
      const jitter = 0.75 + Math.random() * 0.5;
      this.col[i3] = Math.min(1, this._c.r * jitter); this.col[i3 + 1] = Math.min(1, this._c.g * jitter); this.col[i3 + 2] = Math.min(1, this._c.b * jitter);
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.alpha[i] = 1;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.8);
      this.gravity[i] = gravity;
    }
  }

  update(dt, renderer) {
    const size = renderer.getDrawingBufferSize(_v2);
    let scale = size.y;
    const session = renderer.xr && renderer.xr.isPresenting ? renderer.xr.getSession() : null;
    if (session && session.renderState.baseLayer) scale = session.renderState.baseLayer.framebufferHeight;
    this.material.uniforms.uScale.value = scale * 0.5;

    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.gravity[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = t * t;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}
const _v2 = new THREE.Vector2();
