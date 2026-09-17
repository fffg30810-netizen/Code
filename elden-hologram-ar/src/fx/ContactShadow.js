// Ombra di contatto: la macchia scura morbida subito sotto i piedi.
// È l'indizio più forte che un oggetto poggi davvero su una superficie: senza,
// un ologramma sembra appiccicato allo schermo. Si somma all'ombra direzionale,
// che invece dà la direzione della luce.
import * as THREE from 'three';

let sharedTexture = null;

function radialTexture() {
  if (sharedTexture) return sharedTexture;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // nucleo denso sotto il corpo, sfumatura lunga verso il bordo
  g.addColorStop(0.0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.16)');
  g.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  sharedTexture = new THREE.CanvasTexture(c);
  sharedTexture.colorSpace = THREE.SRGBColorSpace;
  return sharedTexture;
}

export class ContactShadow {
  /** @param {number} radius raggio in unità normalizzate (1 = altezza del boss) */
  constructor(radius = 0.42) {
    const mat = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      color: 0x000000,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.0015;
    this.mesh.renderOrder = -1;          // prima dei boss: non deve coprirli
    this.mesh.name = 'ContactShadow';
    this.mesh.raycast = () => {};
    this.radius = radius;
    this.base = 0.62;
    this.mesh.scale.setScalar(radius * 2);
  }

  /**
   * @param {number} lift quanto il corpo è sollevato da terra (unità normalizzate):
   *                      saltando, l'ombra si allarga e si schiarisce
   * @param {number} strength intensità della luce ambiente (1 = piena)
   */
  update(lift = 0, strength = 1) {
    const l = Math.max(0, Math.min(1.2, lift));
    const spread = 1 + l * 1.4;
    this.mesh.scale.setScalar(this.radius * 2 * spread);
    this.mesh.material.opacity = this.base * strength / (1 + l * 2.2);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
