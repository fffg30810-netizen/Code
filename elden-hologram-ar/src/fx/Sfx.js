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
  // ----- fendenti -----
  swingLight() { this._swing(0.22, 700, 3200, 0.3); }
  swingHeavy() { this._swing(0.34, 380, 1900, 0.45); }
  _swing(dur, f0, f1, gain) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this._noise(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = this.ctx.createGain();
    this._env(g, t, dur * 0.25, dur * 0.8, gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.1);
  }
  swing() { this.swingLight(); }

  /** Impatto: botta grave + metallo. */
  hit(intensity = 1) { this._impact(intensity, 3000, 110, 38); }
  impactHeavy() { this._impact(1.5, 2200, 80, 26); }
  _impact(intensity, cutoff, f0, f1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this._noise(0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.16);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, 0.18, Math.min(0.95, 0.8 * intensity));
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.3);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.24);
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.005, 0.26, Math.min(0.95, 0.9 * intensity));
    o.connect(g2).connect(this.master);
    o.start(t); o.stop(t + 0.34);
  }

  /** Passo / scarto. */
  step() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this._noise(0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, 0.1, 0.22);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.16);
  }

  /** Parata: metallo contro metallo. */
  guard() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [2100, 3300, 4700].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq * (0.98 + Math.random() * 0.04);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.005, 0.002, 0.12, 0.09);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.2);
    });
  }

  /** Telegrafo: la mossa sta per partire. */
  telegraph() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.3);
    const g = this.ctx.createGain();
    this._env(g, t, 0.12, 0.25, 0.12);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.42);
  }

  /** Raffica della Danza dei Trampolieri. */
  flurry() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 9; i++) {
      const d = t + i * 0.16 + Math.random() * 0.03;
      const src = this._noise(0.14);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(900 + Math.random() * 500, d);
      f.frequency.exponentialRampToValueAtTime(3600, d + 0.1);
      const g = this.ctx.createGain();
      this._env(g, d, 0.01, 0.12, 0.26);
      src.connect(f).connect(g).connect(this.master);
      src.start(d); src.stop(d + 0.2);
    }
  }

  /** Fioritura del marciume: esplosione sorda e sibilo. */
  bloom() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    const g = this.ctx.createGain();
    this._env(g, t, 0.02, 0.95, 0.85);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.1);
    const n = this._noise(1.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(400, t + 1.2);
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.05, 1.2, 0.3);
    n.connect(bp).connect(g2).connect(this.master);
    n.start(t); n.stop(t + 1.5);
  }

  /** Attrazione gravitazionale: risucchio. */
  gravity() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.25, 0.5, 0.3);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.9);
  }

  /** Carica pesante. */
  charge() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const n = this._noise(0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1200, t + 0.5);
    const g = this.ctx.createGain();
    this._env(g, t, 0.1, 0.6, 0.35);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.8);
  }

  /** Meteora: boato lungo e impatto. */
  meteor() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const n = this._noise(1.6);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(1800, t + 1.0);
    const g = this.ctx.createGain();
    this._env(g, t, 0.6, 0.8, 0.5);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 1.7);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t + 1.0);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.9);
    const g2 = this.ctx.createGain();
    this._env(g2, t + 1.0, 0.01, 0.9, 0.95);
    o.connect(g2).connect(this.master);
    o.start(t + 1.0); o.stop(t + 2.0);
  }

  /** Martello di luce: rintocco dorato. */
  lightHammer() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [523, 784, 1046].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.02, 0.01, 0.6, 0.16);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.8);
    });
    this._impact(1.1, 1800, 90, 30);
  }

  /** Lancio del pugnale. */
  daggerThrow() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const g = this.ctx.createGain();
    this._env(g, t, 0.006, 0.24, 0.18);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  /** Ruggito di passaggio alla seconda fase. */
  roar() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.1);
    const g = this.ctx.createGain();
    this._env(g, t, 0.08, 1.2, 0.6);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.4);
    const n = this._noise(1.2);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 700;
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.1, 1.0, 0.28);
    n.connect(bp).connect(g2).connect(this.master);
    n.start(t); n.stop(t + 1.3);
  }

  /** Rottura della posa. */
  stagger() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [320, 210].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t + i * 0.06);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + i * 0.06 + 0.2);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.06, 0.005, 0.2, 0.14);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.3);
    });
  }

  /** Morte: crollo. */
  death() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 1.3);
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

  /** Evocazione: accordo che sale. */
  summon() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [220, 330, 440, 660].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.98, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.6);
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
