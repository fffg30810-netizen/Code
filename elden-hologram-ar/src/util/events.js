export class Emitter {
  constructor() { this._l = new Map(); }
  on(ev, fn) { (this._l.get(ev) || this._l.set(ev, new Set()).get(ev)).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._l.get(ev)?.delete(fn); }
  emit(ev, ...args) { this._l.get(ev)?.forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } }); }
}
