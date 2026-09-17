// Stabilizzazione visiva per la modalità Camera.
//
// Il giroscopio dà solo la rotazione: se sposti il telefono di lato, l'ologramma
// ti segue perché nessuno misura la traslazione. Qui la si stima dall'immagine:
// si confronta il fotogramma con il precedente, si sottrae lo scorrimento dovuto
// alla rotazione (che il giroscopio conosce) e quello che resta è parallasse,
// cioè movimento vero della fotocamera. Muovendo la camera virtuale della stessa
// quantità, il boss resta dov'è sul tavolo.
import * as THREE from 'three';

const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _prevEuler = new THREE.Euler();
const _euler = new THREE.Euler();

export class VisualStabilizer {
  /**
   * @param {HTMLVideoElement} video
   * @param {object} opts w,h della miniatura analizzata e raggio di ricerca in pixel
   */
  constructor(video, { w = 64, h = 48, radius = 6, gain = 0.85 } = {}) {
    this.video = video;
    this.w = w; this.h = h; this.radius = radius; this.gain = gain;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.prev = null;
    this.curr = new Uint8ClampedArray(w * h);
    this.offset = new THREE.Vector3();
    this.lastYaw = null;
    this.lastPitch = null;
    this.confidence = 0;
    this.enabled = true;
    this.accum = 0;
  }

  reset() {
    this.prev = null;
    this.offset.set(0, 0, 0);
    this.lastYaw = this.lastPitch = null;
    this.confidence = 0;
  }

  _grab() {
    const { video, ctx, w, h } = this;
    if (!video || video.readyState < 2 || !video.videoWidth) return false;
    try { ctx.drawImage(video, 0, 0, w, h); } catch { return false; }
    const d = ctx.getImageData(0, 0, w, h).data;
    const out = this.curr;
    for (let i = 0, j = 0; i < out.length; i++, j += 4) {
      out[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    }
    return true;
  }

  /** Scorrimento in pixel fra il fotogramma precedente e quello corrente. */
  _flow() {
    const { prev, curr, w, h, radius } = this;
    const mx = radius, my = radius;
    let best = Infinity, bx = 0, by = 0, sum = 0, n = 0;
    for (let dy = -my; dy <= my; dy++) {
      for (let dx = -mx; dx <= mx; dx++) {
        let sad = 0;
        for (let y = my; y < h - my; y += 2) {
          const row = y * w, rowP = (y + dy) * w + dx;
          for (let x = mx; x < w - mx; x += 2) {
            const diff = curr[row + x] - prev[rowP + x];
            sad += diff < 0 ? -diff : diff;
          }
        }
        sum += sad; n++;
        if (sad < best) { best = sad; bx = dx; by = dy; }
      }
    }
    const mean = sum / Math.max(1, n);
    // quanto il minimo si stacca dalla media: sotto una certa soglia la stima non è affidabile
    this.confidence = mean > 0 ? Math.max(0, 1 - best / (mean * 0.75)) : 0;
    return { dx: bx, dy: by };
  }

  /**
   * @param {number} dt
   * @param {THREE.Quaternion} quat orientamento corrente della camera
   * @param {number} fovY in radianti
   * @param {number} distance distanza stimata dal piano (metri)
   * @returns {THREE.Vector3} offset da applicare alla camera (mondo)
   */
  update(dt, quat, fovY, distance) {
    if (!this.enabled) { this.offset.multiplyScalar(0.9); return this.offset; }
    this.accum += dt;
    if (this.accum < 1 / 30) return this.offset;   // ~30 Hz basta e avanza
    const step = this.accum;
    this.accum = 0;

    if (!this._grab()) return this.offset;
    if (!this.prev) { this.prev = this.curr.slice(); return this.offset; }

    _euler.setFromQuaternion(quat, 'YXZ');
    const yaw = _euler.y, pitch = _euler.x;
    const dYaw = this.lastYaw == null ? 0 : shortest(yaw - this.lastYaw);
    const dPitch = this.lastPitch == null ? 0 : shortest(pitch - this.lastPitch);
    this.lastYaw = yaw; this.lastPitch = pitch;

    const { dx, dy } = this._flow();
    const focal = (this.h / 2) / Math.tan(fovY / 2);      // in pixel della miniatura
    const expectedX = -dYaw * focal;
    const expectedY = dPitch * focal;
    const resX = dx - expectedX;
    const resY = dy - expectedY;

    // Poca confidenza o rotazione troppo rapida: non fidarsi della stima.
    const rotSpeed = Math.hypot(dYaw, dPitch) / Math.max(1e-3, step);
    if (this.confidence < 0.12 || rotSpeed > 2.5) {
      this.prev.set(this.curr);
      this.offset.multiplyScalar(0.97);
      return this.offset;
    }

    const scale = (distance / focal) * this.gain * this.confidence;
    _right.set(1, 0, 0).applyQuaternion(quat);
    _up.set(0, 1, 0).applyQuaternion(quat);
    // feature che scorrono a destra = fotocamera che si è spostata a sinistra
    const move = _fwd.set(0, 0, 0)
      .addScaledVector(_right, -resX * scale)
      .addScaledVector(_up, resY * scale);
    const maxStep = distance * 0.12;
    if (move.length() > maxStep) move.setLength(maxStep);
    this.offset.add(move);
    // rientro lento verso l'origine: evita che l'errore si accumuli all'infinito
    this.offset.multiplyScalar(0.985);
    const maxOffset = distance * 1.5;
    if (this.offset.length() > maxOffset) this.offset.setLength(maxOffset);

    this.prev.set(this.curr);
    return this.offset;
  }
}

function shortest(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
