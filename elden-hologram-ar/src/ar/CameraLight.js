// Luce e riflessi presi dalla stanza vera.
//
// In modalità Camera il telefono non offre la stima della luce come fa WebXR,
// ma l'immagine della fotocamera contiene già l'informazione: quanto è luminoso
// l'ambiente, di che colore, e da che parte arriva la luce. Qui si legge un
// fotogramma ridotto e si regolano di conseguenza luce ambientale, esposizione
// e mappa di riflessione, così il metallo dei boss riflette la stanza e i colori
// combaciano con quelli ripresi.
import * as THREE from 'three';

export class CameraLight {
  /**
   * @param {HTMLVideoElement} video
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(video, renderer) {
    this.video = video;
    this.renderer = renderer;
    this.w = 64; this.h = 32;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.mapping = THREE.EquirectangularReflectionMapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envTarget = null;
    this.accum = 0;
    this.interval = 0.5;                 // aggiornamento due volte al secondo
    this.ambient = new THREE.Color(1, 1, 1);
    this.exposure = 1;
    this.luminance = 0.5;
    this.sunDir = new THREE.Vector3(0.4, 1.2, 0.6).normalize();
    this.ready = false;
  }

  /** Legge il fotogramma e aggiorna luce, esposizione e mappa ambientale. */
  update(dt) {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return false;
    this.accum += dt;
    if (this.accum < this.interval && this.ready) return false;
    this.accum = 0;

    const { ctx, w, h } = this;
    try {
      // sfocatura per media: disegnare piccolo equivale a mediare i pixel
      ctx.drawImage(v, 0, 0, w, h);
    } catch { return false; }
    const data = ctx.getImageData(0, 0, w, h).data;

    let r = 0, g = 0, b = 0;
    let topLum = 0, leftLum = 0, rightLum = 0, bottomLum = 0, n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const pr = data[i] / 255, pg = data[i + 1] / 255, pb = data[i + 2] / 255;
        r += pr; g += pg; b += pb;
        const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
        if (y < h / 2) topLum += lum; else bottomLum += lum;
        if (x < w / 2) leftLum += lum; else rightLum += lum;
        n++;
      }
    }
    r /= n; g /= n; b /= n;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    this.luminance = lum;

    // Colore ambientale normalizzato: si tiene la dominante della stanza (calda,
    // fredda) ma non la sua luminosità, che finisce nell'esposizione.
    const norm = Math.max(1e-3, (r + g + b) / 3);
    this.ambient.setRGB(
      THREE.MathUtils.clamp(r / norm, 0.55, 1.6),
      THREE.MathUtils.clamp(g / norm, 0.55, 1.6),
      THREE.MathUtils.clamp(b / norm, 0.55, 1.6),
    );
    // stanza scura → esposizione più bassa, così l'ologramma non "spara"
    this.exposure = THREE.MathUtils.clamp(0.55 + lum * 1.15, 0.5, 1.5);

    // direzione dominante della luce, dedotta da dove l'immagine è più chiara
    const half = n / 2;
    const dx = (rightLum - leftLum) / half;
    const dy = (topLum - bottomLum) / half;
    this.sunDir.set(-dx * 1.4, 0.75 + Math.max(0, dy) * 0.9, -0.55 - dy * 0.5).normalize();

    this.texture.needsUpdate = true;
    // il target viene riusato: rigenerarlo due volte al secondo farebbe
    // allocare e liberare texture di continuo
    this.envTarget = this.pmrem.fromEquirectangular(this.texture, this.envTarget);
    this.ready = true;
    return true;
  }

  get environment() { return this.envTarget ? this.envTarget.texture : null; }

  dispose() {
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = null;
    this.texture.dispose();
    this.pmrem.dispose();
  }
}
