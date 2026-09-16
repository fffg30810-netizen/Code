// Barra vita + nome, come sprite billboard sopra la testa del boss.
import * as THREE from 'three';

export class HPBar {
  constructor(name, color = '#d9b654') {
    this.name = name;
    this.color = color;
    this.ratio = 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite.renderOrder = 20;
    this.sprite.scale.set(0.72, 0.18, 1);
    this.sprite.position.set(0, 1.16, 0);
    this.sprite.visible = false;
    this.draw();
  }
  set(ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    if (Math.abs(ratio - this.ratio) < 0.004 && ratio !== 0) return;
    this.ratio = ratio;
    this.draw();
  }
  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 40px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f6ead0';
    ctx.fillText(this.name, canvas.width / 2, 34);
    ctx.shadowBlur = 0;
    const x = 36, y = 76, w = canvas.width - 72, h = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#3a1410';
    ctx.fillRect(x, y, w, h);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#f3d27a');
    grad.addColorStop(1, this.color);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * this.ratio, h);
    ctx.strokeStyle = 'rgba(217,182,84,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}
