// Effetti sonori sintetizzati con WebAudio (nessun file audio da scaricare).
export class Sfx {
  constructor() { this.ctx = null; this.enabled = true; this.master = null; }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio non disponibile */ }
  }
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.6 : 0; }
  _ok() { return this.enabled && this.ctx && this.master; }
  _noise(duration) {
    const n = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }
  _env(gainNode, t0, attack, decay, peak = 1) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  swing() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this._noise(0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
    const g = this.ctx.createGain();
    this._env(g, t, 0.05, 0.22, 0.35);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.35);
  }
  hit(intensity = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this._noise(0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.15);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.16, 0.8 * intensity);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.25);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.005, 0.24, 0.9 * intensity);
    o.connect(g2).connect(this.master);
    o.start(t); o.stop(t + 0.3);
  }
  death() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(32, t + 1.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.05, 1.3, 0.35);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.5);
    const n = this._noise(1.2);
    const g2 = this.ctx.createGain();
    this._env(g2, t + 0.1, 0.1, 0.9, 0.2);
    n.connect(g2).connect(this.master);
    n.start(t + 0.1); n.stop(t + 1.4);
  }
  summon() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [220, 330, 440, 660].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.98, t); o.frequency.linearRampToValueAtTime(freq, t + 0.6);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.06, 0.35, 0.9, 0.12);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 1.6);
    });
  }
  victory() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.16, 0.03, 0.7, 0.25);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.8);
    });
  }
}
