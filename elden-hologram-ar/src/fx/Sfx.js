// Effetti sonori sintetizzati con WebAudio (nessun file audio da scaricare).
//
// Timbro per famiglia di colpo. Non sono campioni: sono parametri scelti a
// orecchio perché l'acciaio canti, la mazza tuoni e la magia squilli. `body` è
// il tonfo grave (da → a), `metal` i parziali inarmonici che restano a vibrare,
// `ring` quanto durano, `air` lo spazzolio d'aria, `noise` quanto pesa il rumore.
const IMPACT = {
  slash:  { body: [190, 52], metal: [1850, 2660, 3910, 5480], ring: 0.42, air: [2400, 5200], noise: 0.55, bright: 1.0 },
  thrust: { body: [250, 95], metal: [2600, 3700, 5200, 7100], ring: 0.22, air: [3200, 7200], noise: 0.32, bright: 1.15 },
  blunt:  { body: [105, 32], metal: [520, 760, 1140, 1600], ring: 0.5, air: [600, 1500], noise: 0.9, bright: 0.55 },
  magic:  { body: [165, 72], metal: [900, 1490, 2230, 3710], ring: 1.15, air: [1200, 4200], noise: 0.35, bright: 0.95 },
  rot:    { body: [130, 44], metal: [430, 690, 980, 1370], ring: 0.35, air: [500, 1800], noise: 1.0, bright: 0.45 },
  guard:  { body: [320, 165], metal: [2400, 3150, 4600, 6200], ring: 0.75, air: [2600, 6400], noise: 0.25, bright: 1.2 },
};

// Fendenti: l'aria che si apre. La frequenza sale e poi ricade — è l'effetto
// Doppler della lama che passa — invece di salire e basta come una sirena.
const SWING = {
  light:  { dur: 0.20, f: [520, 3400, 900], q: 1.6, gain: 0.30 },
  heavy:  { dur: 0.34, f: [230, 1700, 420], q: 1.2, gain: 0.46 },
  thrust: { dur: 0.16, f: [800, 4200, 1600], q: 2.6, gain: 0.26 },
  spin:   { dur: 0.52, f: [300, 2100, 500], q: 1.0, gain: 0.42 },
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    // Posizione del suono rispetto a chi guarda: i colpi arrivano da dove sta
    // il boss, non dal centro della testa. È metà dell'illusione "sono qui".
    this.pan = 0;
    this.gain = 1;
    this.canPan = false;
  }

  /**
   * Prepara il prossimo suono come proveniente da `worldPos`, visto da `camera`.
   * @param {{x:number,y:number,z:number}} worldPos
   * @param {import('three').Camera} camera
   * @param {number} [scale] altezza del boss: regola la distanza "percepita"
   */
  at(worldPos, camera, scale = 0.25) {
    if (!worldPos || !camera) { this.pan = 0; this.gain = 1; return; }
    const e = camera.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    const dx = worldPos.x - cx, dy = worldPos.y - cy, dz = worldPos.z - cz;
    // asse destro della camera (prima colonna della matrice mondo)
    const right = dx * e[0] + dy * e[1] + dz * e[2];
    const dist = Math.hypot(dx, dy, dz) || 1e-3;
    this.pan = Math.max(-0.85, Math.min(0.85, right / dist));
    // riferimento: un boss alto `scale` metri suona "a portata" a ~8 sue altezze
    const ref = Math.max(0.15, scale * 6);
    this.gain = Math.max(0.25, Math.min(1, ref / (ref + dist)) * 1.8);
  }

  /**
   * Riverbero della stanza: una coda corta costruita da rumore che decade.
   * È quello che toglie ai suoni il timbro "da sintetizzatore" e li fa sembrare
   * emessi da qualcosa che sta davvero su un tavolo, in una stanza.
   */
  _buildReverb() {
    if (this.wet || typeof this.ctx.createConvolver !== 'function') return;
    try {
      const dur = 0.55, rate = this.ctx.sampleRate;
      const n = Math.floor(rate * dur);
      const buf = this.ctx.createBuffer(2, n, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < n; i++) {
          const k = i / n;
          // prime riflessioni dense, poi coda che si spegne in fretta
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.6) * (i < rate * 0.01 ? 0.3 : 1);
        }
      }
      const conv = this.ctx.createConvolver();
      conv.buffer = buf;
      const wet = this.ctx.createGain();
      wet.gain.value = 1;
      const level = this.ctx.createGain();
      level.gain.value = 0.28;
      wet.connect(conv).connect(level).connect(this.master);
      this.wet = wet;
    } catch { this.wet = null; }
  }

  /** Uscita del singolo suono: volume per distanza + stereo + mandata al riverbero. */
  _out() {
    if (!this.ctx || !this.master) return this.master;
    const g = this.ctx.createGain();
    g.gain.value = this.gain;
    let node = g;
    if (this.canPan) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = this.pan;
      g.connect(pan);
      node = pan;
    }
    node.connect(this.master);
    if (this.wet) node.connect(this.wet);
    return g;
  }

  /** Numero casuale in un intervallo: ogni colpo suona un po' diverso dal precedente. */
  _r(a, b) { return a + Math.random() * (b - a); }

  /** Sceglie una variante diversa dall'ultima usata per la stessa famiglia. */
  _vary(key, n) {
    if (!this._last) this._last = {};
    let i = Math.floor(Math.random() * n);
    if (this._last[key] === i) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this._last[key] = i;
    return i;
  }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
        this.canPan = typeof this.ctx.createStereoPanner === 'function';
        this._buildReverb();
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
  /**
   * Fendente: rumore filtrato in banda con la curva Doppler della lama.
   * @param {'light'|'heavy'|'thrust'|'spin'} kind
   * @param {number} speed 1 = normale; sopra 1 il colpo è più rapido e acuto
   */
  swing(kind = 'light', speed = 1) {
    if (!this._ok()) return;
    const out = this._out();
    const p = SWING[kind] || SWING.light;
    const t = this.ctx.currentTime;
    const sp = Math.max(0.5, Math.min(2, speed));
    const dur = p.dur / sp;
    const k = this._r(0.88, 1.16);                 // niente due fendenti identici
    const src = this._noise(dur + 0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = p.q * this._r(0.85, 1.2);
    f.frequency.setValueAtTime(p.f[0] * k, t);
    f.frequency.exponentialRampToValueAtTime(p.f[1] * k * sp, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(p.f[2] * k, t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, dur * 0.3, dur * 0.85, p.gain * this._r(0.85, 1.15));
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + dur + 0.12);
    // coda grave: lo spostamento d'aria di un'arma pesante si sente nel petto
    if (kind === 'heavy' || kind === 'spin') {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(95 * k, t);
      o.frequency.exponentialRampToValueAtTime(48 * k, t + dur);
      const og = this.ctx.createGain();
      this._env(og, t, dur * 0.35, dur * 0.7, 0.16);
      o.connect(og).connect(out);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  swingLight() { this.swing('light', this._r(0.92, 1.18)); }
  swingHeavy() { this.swing('heavy', this._r(0.88, 1.1)); }
  swingThrust() { this.swing('thrust', this._r(0.95, 1.25)); }
  swingSpin() { this.swing('spin', this._r(0.9, 1.1)); }

  /**
   * Impatto a strati: transiente, tonfo del corpo, parziali del metallo che
   * continuano a vibrare, e il rumore dell'urto. Ogni chiamata cambia
   * accordatura e durate, così venti colpi di fila non suonano mai uguali.
   * @param {number} intensity 1 = colpo normale, 1.5+ = pesante o critico
   * @param {keyof IMPACT} kind famiglia del colpo
   */
  hit(intensity = 1, kind = 'slash') { this._impact(intensity, kind); }
  impactHeavy(kind = 'blunt') { this._impact(1.5, kind); }
  _impact(intensity = 1, kind = 'slash') {
    if (!this._ok()) return;
    const out = this._out();
    const p = IMPACT[kind] || IMPACT.slash;
    const t = this.ctx.currentTime;
    const I = Math.max(0.3, Math.min(2.2, intensity));
    const tune = this._r(0.88, 1.14);          // l'accordatura cambia a ogni colpo
    const ring = p.ring * this._r(0.75, 1.3);

    // 1. transiente: il "tac" secco che dice dove comincia il colpo
    const cl = this._noise(0.03);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200 * p.bright;
    const cg = this.ctx.createGain();
    this._env(cg, t, 0.001, 0.028, Math.min(0.9, 0.42 * I * p.bright));
    cl.connect(hp).connect(cg).connect(out);
    cl.start(t); cl.stop(t + 0.05);

    // 2. corpo: il peso. Scende di tono mentre si spegne.
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(p.body[0] * tune, t);
    o.frequency.exponentialRampToValueAtTime(p.body[1] * tune, t + 0.22);
    const og = this.ctx.createGain();
    this._env(og, t, 0.004, 0.24 * this._r(0.85, 1.2), Math.min(0.95, 0.75 * I));
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.36);

    // 3. metallo: tre parziali su quattro, stonati fra loro. Quello che si tace
    // cambia sempre rispetto al colpo precedente: è lì che si sente la varietà.
    const skip = this._vary(`metal:${kind}`, p.metal.length);
    p.metal.forEach((freq, i) => {
      if (i === skip) return;
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq * tune * this._r(0.97, 1.035);
      const g = this.ctx.createGain();
      const dec = ring * (1 - i * 0.16);
      this._env(g, t + i * 0.002, 0.002, Math.max(0.05, dec), Math.min(0.5, (0.17 / (1 + i * 0.7)) * I * p.bright));
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + ring + 0.2);
    });

    // 4. urto: rumore in banda che scivola verso il basso
    const src = this._noise(0.3);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(p.air[1] * tune, t);
    bp.frequency.exponentialRampToValueAtTime(p.air[0] * tune * 0.6, t + 0.2);
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.004, 0.2 * this._r(0.8, 1.25), Math.min(0.8, 0.5 * p.noise * I));
    src.connect(bp).connect(ng).connect(out);
    src.start(t); src.stop(t + 0.34);

    // 5. sotto-basso: solo sui colpi che contano, quelli che fanno saltare il tavolo
    if (I > 1.25) {
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(64 * tune, t);
      sub.frequency.exponentialRampToValueAtTime(28, t + 0.3);
      const sg = this.ctx.createGain();
      this._env(sg, t, 0.008, 0.32, Math.min(0.7, 0.3 * I));
      sub.connect(sg).connect(out);
      sub.start(t); sub.stop(t + 0.45);
    }
  }

  /** Passo / scarto. */
  step() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const src = this._noise(0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, 0.1, 0.22);
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + 0.16);
  }

  /** Passo: più sordo e più corto di `step`, per la camminata continua. */
  footstep(scale = 1) {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const src = this._noise(0.09);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 520 * scale;
    const g = this.ctx.createGain();
    this._env(g, t, 0.003, 0.07, 0.13);
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + 0.12);
  }

  /** Corpo che cade a terra: tonfo grave più il raschio dell'armatura. */
  bodyFall() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.28);
    const og = this.ctx.createGain();
    this._env(og, t, 0.006, 0.34, 0.5);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.45);

    const src = this._noise(0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, 0.26, 0.2);
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + 0.34);
  }

  /** Parata: metallo contro metallo, più il raschio delle lame che scivolano. */
  guard() {
    if (!this._ok()) return;
    this._impact(this._r(0.85, 1.15), 'guard');
    const out = this._out();
    const t = this.ctx.currentTime;
    const src = this._noise(0.22);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(this._r(3200, 4600), t);
    f.frequency.exponentialRampToValueAtTime(this._r(1400, 2200), t + 0.2);
    const g = this.ctx.createGain();
    this._env(g, t + 0.02, 0.01, 0.18, 0.12);
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + 0.26);
  }

  /** Telegrafo: la mossa sta per partire. */
  telegraph() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.3);
    const g = this.ctx.createGain();
    this._env(g, t, 0.12, 0.25, 0.12);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.42);
  }

  /** Raffica della Danza dei Trampolieri. */
  flurry() {
    if (!this._ok()) return;
    const out = this._out();
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
      src.connect(f).connect(g).connect(out);
      src.start(d); src.stop(d + 0.2);
    }
  }

  /** Fioritura del marciume: esplosione sorda e sibilo. */
  bloom() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    const g = this.ctx.createGain();
    this._env(g, t, 0.02, 0.95, 0.85);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 1.1);
    const n = this._noise(1.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(400, t + 1.2);
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.05, 1.2, 0.3);
    n.connect(bp).connect(g2).connect(out);
    n.start(t); n.stop(t + 1.5);
  }

  /** Attrazione gravitazionale: risucchio. */
  gravity() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.25, 0.5, 0.3);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + 0.9);
  }

  /** Carica pesante. */
  charge() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const n = this._noise(0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1200, t + 0.5);
    const g = this.ctx.createGain();
    this._env(g, t, 0.1, 0.6, 0.35);
    n.connect(f).connect(g).connect(out);
    n.start(t); n.stop(t + 0.8);
  }

  /** Meteora: boato lungo e impatto. */
  meteor() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const n = this._noise(1.6);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(1800, t + 1.0);
    const g = this.ctx.createGain();
    this._env(g, t, 0.6, 0.8, 0.5);
    n.connect(f).connect(g).connect(out);
    n.start(t); n.stop(t + 1.7);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t + 1.0);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.9);
    const g2 = this.ctx.createGain();
    this._env(g2, t + 1.0, 0.01, 0.9, 0.95);
    o.connect(g2).connect(out);
    o.start(t + 1.0); o.stop(t + 2.0);
  }

  /** Martello di luce: rintocco dorato. */
  lightHammer() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    [523, 784, 1046].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.02, 0.01, 0.6, 0.16);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.8);
    });
    this._impact(1.15, 'magic');
  }

  /** Lancio del pugnale. */
  daggerThrow() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    const g = this.ctx.createGain();
    this._env(g, t, 0.006, 0.24, 0.18);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.32);
  }

  /** Ruggito di passaggio alla seconda fase. */
  roar() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.1);
    const g = this.ctx.createGain();
    this._env(g, t, 0.08, 1.2, 0.6);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + 1.4);
    const n = this._noise(1.2);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 700;
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.1, 1.0, 0.28);
    n.connect(bp).connect(g2).connect(out);
    n.start(t); n.stop(t + 1.3);
  }

  /** Rottura della posa. */
  stagger() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    [320, 210].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, t + i * 0.06);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + i * 0.06 + 0.2);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.06, 0.005, 0.2, 0.14);
      o.connect(g).connect(out);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.3);
    });
  }

  /** Morte: crollo. */
  death() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 1.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.05, 1.3, 0.35);
    o.connect(f).connect(g).connect(out);
    o.start(t); o.stop(t + 1.5);
    const n = this._noise(1.2);
    const g2 = this.ctx.createGain();
    this._env(g2, t + 0.1, 0.1, 0.9, 0.2);
    n.connect(g2).connect(out);
    n.start(t + 0.1); n.stop(t + 1.4);
  }

  /** Evocazione: accordo che sale. */
  summon() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    [220, 330, 440, 660].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.98, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.6);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.06, 0.35, 0.9, 0.12);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 1.6);
    });
  }

  victory() {
    if (!this._ok()) return;
    const out = this._out();
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.16, 0.03, 0.7, 0.25);
      o.connect(g).connect(out);
      o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.8);
    });
  }
}
