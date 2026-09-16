// Gesti touch/mouse unificati via Pointer Events: tap, drag, pinch (scala), rotazione a due dita.
// Ascolta su window così funziona anche dentro il DOM Overlay WebXR.
import { Emitter } from '../util/events.js';

const UI_SELECTOR = 'button, input, select, textarea, a, label, .hud-top, .hud-side, .hud-bottom, .sheet, #entry';

export class Gestures extends Emitter {
  constructor() {
    super();
    this.pointers = new Map();
    this.enabled = true;
    this.multi = false;
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    window.addEventListener('pointerdown', this._down, { passive: false });
    window.addEventListener('pointermove', this._move, { passive: false });
    window.addEventListener('pointerup', this._up, { passive: false });
    window.addEventListener('pointercancel', this._up, { passive: false });
    // evita lo zoom del browser con due dita
    window.addEventListener('touchmove', (e) => { if (this.enabled && e.touches.length > 1 && !this._isUI(e.target)) e.preventDefault(); }, { passive: false });
    window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  }

  _isUI(target) { return !!(target && target.closest && target.closest(UI_SELECTOR)); }

  _down(e) {
    if (!this.enabled || this._isUI(e.target)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false });
    if (this.pointers.size === 1) {
      this.multi = false;
      this.emit('down', e.clientX, e.clientY);
    } else if (this.pointers.size === 2) {
      this.multi = true;
      const [a, b] = [...this.pointers.values()];
      this.lastDist = Math.hypot(b.x - a.x, b.y - a.y);
      this.lastAngle = Math.atan2(b.y - a.y, b.x - a.x);
      this.emit('pinchstart');
    }
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 1) {
      if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > 8) { p.moved = true; this.emit('dragstart', p.x0, p.y0); }
      if (p.moved) this.emit('drag', p.x, p.y, dx, dy);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (this.lastDist > 0) this.emit('pinch', dist / this.lastDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      let da = ang - this.lastAngle;
      if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      this.emit('rotate', da);
      this.lastDist = dist; this.lastAngle = ang;
      a.moved = b.moved = true;
    }
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      if (!p.moved && !this.multi && performance.now() - p.t0 < 450) this.emit('tap', p.x, p.y);
      else if (p.moved) this.emit('dragend', p.x, p.y);
      this.multi = false;
      this.emit('up', p.x, p.y);
    } else if (this.pointers.size === 1) {
      const rem = [...this.pointers.values()][0];
      rem.moved = true; // il dito rimasto non deve generare un tap
      this.emit('pinchend');
    }
  }
}
