/* ============================================================================
 * app.js: WebGL2 renderer, gestures, instruments and settings.
 * Depends on Kerr (physics.js) and Shaders (shaders.js).
 * ==========================================================================*/
(() => {
  'use strict';
  const K = Kerr, SH = Shaders;
  const $ = (id) => document.getElementById(id);
  const DEG = Math.PI / 180;
  const qs = new URLSearchParams(location.search);
  const TEST = qs.has('test');

  // Physical constants for the instruments.
  const GM_C2 = 1476.625;      // m, per solar mass
  const GM_C3 = 4.925491e-6;   // s, per solar mass
  const C2 = 8.98755179e16;    // m²/s²
  const AU = 1.495978707e11;   // m

  /* ============================================================== presets */
  const PRESETS = [
    {
      id: 'smbh', label: 'Supermassiccio', title: 'Buco nero supermassiccio',
      mass: 1e8, spin: 0.9, T: 9000, rOut: 22, th: 84, dist: 26, doppler: true,
      note: '10⁸ masse solari, come i motori dei quasar. Disco sottile e poco luminoso (circa 10⁻⁵ del limite di Eddington), quindi abbastanza freddo da brillare nel visibile.',
    },
    {
      id: 'sgra', label: 'Sgr A*', title: 'Sagittarius A*',
      mass: 4.3e6, spin: 0.9, T: 8000, rOut: 20, th: 62, dist: 28, doppler: true,
      note: 'Il buco nero al centro della Via Lattea: 4,3 milioni di masse solari, 26 700 anni luce. L’EHT lo ha fotografato nel 2022. All’orizzonte la marea è ancora sopportabile.',
    },
    {
      id: 'm87', label: 'M87*', title: 'M87*',
      mass: 6.5e9, spin: 0.9, T: 6500, rOut: 24, th: 163, dist: 30, doppler: true,
      note: '6,5 miliardi di masse solari a 55 milioni di anni luce: la prima immagine di un buco nero (EHT, 2019). Lo vediamo quasi di faccia, 17° dall’asse, con l’asse di rotazione rivolto lontano da noi.',
    },
    {
      id: 'cyg', label: 'Cygnus X-1', title: 'Cygnus X-1',
      mass: 21.2, spin: 0.998, T: 1.2e7, rOut: 18, th: 27, dist: 26, doppler: true,
      note: '21 masse solari, il primo buco nero scoperto (1971). Il disco è a milioni di kelvin: brilla in raggi X e nel visibile appare bianco-azzurro. La marea ti allungherebbe molto prima dell’orizzonte.',
    },
    {
      id: 'garg', label: 'Gargantua', title: 'Gargantua (Interstellar)',
      mass: 1e8, spin: 0.6, T: 5200, rOut: 20, th: 85, dist: 24, doppler: false,
      note: 'Come nel film del 2014: rotazione 0,6 e niente Doppler, per non confondere il pubblico. Riaccendi “Doppler e redshift” per vedere come apparirebbe davvero.',
    },
  ];
  const QUALITIES = [
    { id: 'auto', label: 'Auto' },
    { id: 'low', label: 'Bassa', k: 0.17, steps: 170, maxScale: 0.5 },
    { id: 'mid', label: 'Media', k: 0.12, steps: 260, maxScale: 0.75 },
    { id: 'high', label: 'Alta', k: 0.09, steps: 380, maxScale: 1.0 },
    { id: 'ultra', label: 'Ultra', k: 0.06, steps: 640, maxScale: 1.0 },
  ];
  const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

  const params = {
    preset: 'smbh', mass: 1e8, spin: 0.9, T: 9000, rOut: 22,
    disk: true, doppler: true, stars: true, autoExp: true,
    ev: 0, bloom: 0.5, timeSpeed: 1, quality: 'auto', tone: 0,
    view: 'visible', ehtBlur: false,
  };
  const VIEWS = [
    { id: 'visible', label: 'Luce visibile', note: 'Il disco sottile brilla come un corpo nero; stelle e Via Lattea sono deviate dalla lente gravitazionale.' },
    { id: 'radio', label: 'Radio 1,3 mm (EHT)', note: 'Come lo vedrebbe l’Event Horizon Telescope: gas caldo e trasparente fino all’orizzonte, in falsi colori. Gli anelli sottili sono le immagini n = 1 e n = 2 dell’anello fotonico, che nessun telescopio ha ancora separato.' },
  ];
  const cam = { s: 0, th: 84 * DEG, ph: 0, yaw: 0, pitch: 0, vth: 0, vph: 0 };
  const dive = { active: false, tau: 0, ended: false };
  let simTime = 0;

  /* ================================================================== GL */
  const canvas = $('view');
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: TEST, powerPreference: 'high-performance',
  });
  if (!gl) {
    fail('Questo browser non supporta WebGL 2. Prova con una versione recente di Chrome, Safari, Firefox o Edge.');
    return;
  }
  const floatRT = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.bindVertexArray(gl.createVertexArray());
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  function fail(msg) {
    const l = $('loading');
    if (l) {
      l.classList.remove('done');
      l.querySelector('.spinner')?.remove();
      $('loadingText').textContent = msg;
    }
    window.__bhError = msg;
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('Shader: ' + log);
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, SH.VERT);
  function makeProgram(fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const locs = new Map();
    const loc = (n) => {
      if (!locs.has(n)) locs.set(n, gl.getUniformLocation(p, n));
      return locs.get(n);
    };
    return {
      p, loc,
      use() { gl.useProgram(p); return this; },
      f(n, ...v) { const l = loc(n); if (l) gl[`uniform${v.length}f`](l, ...v); return this; },
      fv(n, arr) { const l = loc(n); if (l) gl[`uniform${arr.length}fv`](l, arr); return this; },
      i(n, v) { const l = loc(n); if (l) gl.uniform1i(l, v); return this; },
      m3(n, arr) { const l = loc(n); if (l) gl.uniformMatrix3fv(l, false, arr); return this; },
    };
  }

  function makeTex(w, h, internal, format, type, data, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }
  function makeTarget(w, h) {
    const tex = makeTex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }
  function bindTex(unit, target, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, tex);
  }
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  /* ========================================================== static data */
  const planck = K.planckLUT(512);
  const planckTex = makeTex(planck.n, 1, gl.RGBA16F, gl.RGBA, gl.FLOAT, planck.data);
  const planckUni = [planck.logT0, 1 / (planck.logT1 - planck.logT0), (planck.n - 1) / planck.n, 0.5 / planck.n];
  const lumOf = (T) => Math.pow(10, K.planckColor(T).Y > 0 ? Math.log10(K.planckColor(T).Y / K.planckColor(6500).Y) : -60);

  // Tileable value noise, 64³ texels with four independent channels.
  function noiseTexture() {
    const N = 64, data = new Uint8Array(N * N * N * 4);
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, t);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, N, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
    return t;
  }
  const noiseTex = noiseTexture();

  // Galactic frame: the Milky Way crosses the sky behind the hole at an angle.
  const galFrame = (() => {
    const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const zg = norm([0.12, 0.55, 0.83]);                   // north galactic pole
    let xg = norm([-0.35, 0.9, -0.2]);                      // toward the galactic centre, off to the side
    xg = norm(xg.map((x, i) => x - zg[i] * (xg[0] * zg[0] + xg[1] * zg[1] + xg[2] * zg[2])));
    const yg = cross(zg, xg);
    // Column-major mat3 whose rows are the galactic axes.
    return { m: [xg[0], yg[0], zg[0], xg[1], yg[1], zg[1], xg[2], yg[2], zg[2]], z: zg };
  })();

  let skyTex = null, dustTex = null;
  function buildSky(size) {
    const prog = makeProgram(SH.SKY).use();
    prog.m3('uGal', galFrame.m).fv('uPlanckLut', planckUni).i('uNoise', 2).i('uPlanck', 0);
    bindTex(0, gl.TEXTURE_2D, planckTex);
    bindTex(2, gl.TEXTURE_3D, noiseTex);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const make = (sz, internal, mips) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
      const levels = mips ? Math.floor(Math.log2(sz)) + 1 : 1;
      gl.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, internal, sz, sz);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const render = (tex, sz, mode) => {
      prog.f('uSize', sz).i('uMode', mode);
      gl.viewport(0, 0, sz, sz);
      for (let f = 0; f < 6; f++) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, tex, 0);
        prog.i('uFace', f);
        draw();
      }
    };
    skyTex = make(size, gl.SRGB8_ALPHA8, true);
    render(skyTex, size, 0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTex);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    if (aniso) gl.texParameterf(gl.TEXTURE_CUBE_MAP, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    dustTex = make(128, gl.RGBA8, false);
    render(dustTex, 128, 1);
    gl.deleteFramebuffer(fb);
    gl.deleteProgram(prog.p);
  }

  // Mean radiance of each procedural star layer (used where a pixel sees many
  // stars), with the same luminosity function and flux zero point as the shader.
  const starAvg = (() => {
    const layer = (cells, prob, m0, dm) => {
      const lf = Math.pow(10, 0.46 * dm) - 1;
      let mean = 0;
      const n = 2000;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const mag = m0 + Math.log10(1 + u * lf) / 0.46;
        mean += Math.pow(10, -0.4 * mag) / n;
      }
      const perSr = (6 * cells * cells * prob * 0.83) / (4 * Math.PI);
      return perSr * mean * 2.3e-3;
    };
    return [layer(40, 0.11, -1.5, 6.0), layer(110, 0.28, 4.5, 2.7), layer(300, 0.33, 7.2, 2.4), 0];
  })();

  /* ============================================================== disk LUT */
  let diskTex = null, diskInfo = null, diskSpin = -1;
  function buildDisk(a) {
    const lut = K.diskLUT(a, { rHi: 64 });
    if (diskTex) gl.deleteTexture(diskTex);
    diskTex = makeTex(lut.n, 1, gl.RGBA16F, gl.RGBA, gl.FLOAT, lut.data);
    diskInfo = lut;
    diskSpin = a;
  }

  /* ============================================================ programs */
  let progTrace, progAccum, progDown, progUp, progExp, progComp, progBlur;
  function buildPrograms() {
    progTrace = makeProgram(floatRT ? SH.TRACE : SH.TRACE_DIRECT);
    if (!floatRT) return;
    progAccum = makeProgram(SH.ACCUM);
    progDown = makeProgram(SH.DOWN);
    progUp = makeProgram(SH.UP);
    progExp = makeProgram(SH.EXPOSURE);
    progComp = makeProgram(SH.COMPOSITE);
    progBlur = makeProgram(SH.BLUR);
  }

  /* ======================================================= render targets */
  const RT = { w: 0, h: 0, trace: null, acc: [null, null], blur: [null, null], bloom: [], exp: [null, null], cur: 0, expCur: 0 };
  const BLOOM_LEVELS = 6;
  const BLOOM_DECAY = 0.55;
  const BLOOM_NORM = 1 / Array.from({ length: BLOOM_LEVELS }, (_, i) => BLOOM_DECAY ** i).reduce((x, y) => x + y);
  function ensureTargets(w, h) {
    if (!floatRT) return;
    if (RT.w === w && RT.h === h) return;
    freeTarget(RT.trace); RT.acc.forEach(freeTarget); RT.blur.forEach(freeTarget); RT.bloom.forEach(freeTarget);
    RT.w = w; RT.h = h;
    RT.trace = makeTarget(w, h);
    RT.acc = [makeTarget(w, h), makeTarget(w, h)];
    RT.blur = [makeTarget(w, h), makeTarget(w, h)];
    RT.bloom = [];
    let bw = w, bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
      RT.bloom.push(makeTarget(bw, bh));
    }
    if (!RT.exp[0]) RT.exp = [makeTarget(1, 1), makeTarget(1, 1)];
    accumFrames = 0;
  }

  /* ========================================================= camera math */
  const horizonsNow = () => K.horizons(params.spin);
  function rEndOf(a) { return Math.max(K.horizons(a).rm, 0.012); }
  let rEnd = rEndOf(params.spin);
  const S_MIN = Math.log(0.0035), S_MAX = Math.log(5000);
  const camR = () => rEnd + Math.exp(cam.s);
  function setR(r) { cam.s = Math.min(S_MAX, Math.max(S_MIN, Math.log(Math.max(r - rEnd, 1e-6)))); }

  /* ============================================================ quality */
  const perf = { ema: 16, scale: MOBILE ? 0.42 : 0.62, last: 0, frames: 0, fps: 60 };
  function qualitySettings() {
    const q = QUALITIES.find((x) => x.id === params.quality);
    if (q && q.id !== 'auto') return q;
    return MOBILE ? { k: 0.13, steps: 240, maxScale: 0.7 } : { k: 0.09, steps: 400, maxScale: 1.0 };
  }

  /* =========================================================== rendering */
  let accumFrames = 0;
  let lastKey = '';
  let frameNo = 0;
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 2 : 2);
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const q = qualitySettings();
    const sc = Math.min(perf.scale, q.maxScale);
    const w = Math.max(64, Math.round(cw * sc)), h = Math.max(48, Math.round(ch * sc));
    // Avoid reallocating for tiny changes.
    if (RT.w && Math.abs(w - RT.w) / RT.w < 0.06 && Math.abs(h - RT.h) / RT.h < 0.06 && RT.w <= cw) return { w: RT.w, h: RT.h, cw, ch };
    ensureTargets(w, h);
    return { w, h, cw, ch };
  }

  function render(dt) {
    const a = params.spin;
    if (diskSpin !== a) buildDisk(a);
    const { rp, rm } = K.horizons(a);
    const r = camR();
    const th = cam.th, ph = cam.ph;
    const frame = K.cameraFrame(a, r, th, cam.yaw, cam.pitch);
    const size = resize();
    const w = floatRT ? RT.w : size.cw, h = floatRT ? RT.h : size.ch;
    const q = qualitySettings();
    const fovY = (MOBILE && size.ch > size.cw ? 74 : 62) * DEG;
    const tanY = Math.tan(fovY / 2), tanX = tanY * (size.cw / size.ch);

    // Anything that changes the image besides the flow of time resets the accumulation.
    const key = [r, th, ph, cam.yaw, cam.pitch, a, params.T, params.rOut, params.disk, params.doppler, params.stars, params.view, w, h, q.k, q.steps].map((x) => (typeof x === 'number' ? x.toPrecision(7) : x)).join('|');
    if (key !== lastKey) { accumFrames = 0; lastKey = key; }
    const timeRunning = params.timeSpeed > 0 && params.disk;
    const jit = accumFrames > 0 ? [halton(frameNo % 64 + 1, 2) - 0.5, halton(frameNo % 64 + 1, 3) - 0.5] : [0, 0];

    // Flow-noise phases: two copies of the gas pattern restart in turn, each
    // fading out before it restarts, so the sheared pattern never over-winds.
    const Tc = 420;
    const f1 = ((simTime / Tc) % 1 + 1) % 1, f2 = (f1 + 0.5) % 1;
    const pat = [f1 * Tc, f2 * Tc, 1 - Math.abs(2 * f1 - 1), 1 - Math.abs(2 * f2 - 1)];

    const d = diskInfo.disk;
    const radio = params.view === 'radio';
    const fcol = params.T > 1e5 ? 1.7 : 1.0;
    const diskGain = 1 / Math.max(lumOf(fcol * params.T), 1e-30);
    const skyGain = 0.024;

    // ------------------------------------------------------------ trace
    gl.bindFramebuffer(gl.FRAMEBUFFER, floatRT ? RT.trace.fb : null);
    gl.viewport(0, 0, w, h);
    const P = progTrace.use();
    P.f('uRes', w, h).f('uJitter', jit[0], jit[1]).f('uTanFov', tanX, tanY)
      .fv('uCamU', frame.U).fv('uCamF', frame.F).fv('uCamR', frame.R).fv('uCamUp', frame.Up)
      .f('uCamPos', r, th, ph).f('uA', a)
      .f('uHor', rp, rm, d.rI, 40)
      .f('uIsco', d.EI, d.LI, d.OmI, Math.sqrt(1 - d.EI * d.EI))
      .f('uDisk', Math.max(rm * 1.001, 0.045), params.rOut, params.T, fcol)
      .f('uDiskLut', Math.log(diskInfo.rLo), 1 / (Math.log(diskInfo.rHi) - Math.log(diskInfo.rLo)), (diskInfo.n - 1) / diskInfo.n, 0.5 / diskInfo.n)
      .f('uGain', diskGain, skyGain, skyGain, Math.pow(2, params.ev) * 0.9)
      .f('uPat', ...pat)
      .f('uOpt', params.doppler ? 1 : 0, params.stars ? 1 : 0, params.disk ? 1 : 0, (2 * tanY) / h)
      .f('uGalZ', ...galFrame.z)
      .fv('uStarAvg', starAvg)
      .f('uStepK', q.k).i('uMaxSteps', q.steps)
      .f('uRadio', radio ? 1 : 0, rm, 1.0, -1.5)
      .fv('uPlanckLut', planckUni)
      .i('uPlanck', 0).i('uDiskTex', 1).i('uNoise', 2).i('uSky', 3).i('uDust', 4);
    bindTex(0, gl.TEXTURE_2D, planckTex);
    bindTex(1, gl.TEXTURE_2D, diskTex);
    bindTex(2, gl.TEXTURE_3D, noiseTex);
    bindTex(3, gl.TEXTURE_CUBE_MAP, skyTex);
    bindTex(4, gl.TEXTURE_CUBE_MAP, dustTex);
    draw();
    if (!floatRT) { frameNo++; return; }

    // ------------------------------------------------------- accumulate
    const alpha = accumFrames === 0 ? 1 : Math.max(1 / (accumFrames + 1), timeRunning ? 0.22 : 0.03);
    const src = RT.acc[RT.cur], dst = RT.acc[1 - RT.cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    progAccum.use().i('uCur', 5).i('uHist', 6).f('uAlpha', alpha);
    bindTex(5, gl.TEXTURE_2D, RT.trace.tex);
    bindTex(6, gl.TEXTURE_2D, src.tex);
    draw();
    RT.cur = 1 - RT.cur;
    accumFrames++;

    // The image the rest of the pipeline sees; in the radio view it can be
    // blurred to the resolution of the Event Horizon Telescope: a beam of about
    // 20 µas, some 5 gravitational radii across for M87* and Sgr A*.
    let img = dst;
    if (radio && params.ehtBlur) {
      const sigma = ((5 / 2.355) / r) * (h / (2 * tanY));
      progBlur.use().i('uSrc', 5).f('uRes', w, h).f('uSigma', Math.min(sigma, 80));
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.blur[0].fb);
      progBlur.f('uDir', 1, 0);
      bindTex(5, gl.TEXTURE_2D, dst.tex);
      draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.blur[1].fb);
      progBlur.f('uDir', 0, 1);
      bindTex(5, gl.TEXTURE_2D, RT.blur[0].tex);
      draw();
      img = RT.blur[1];
    }

    // ------------------------------------------------------------ bloom
    let prev = img;
    progDown.use().i('uSrc', 5);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const t = RT.bloom[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.viewport(0, 0, t.w, t.h);
      progDown.f('uTexel', 1 / prev.w, 1 / prev.h).i('uKaris', i === 0 ? 1 : 0).f('uDstRes', t.w, t.h);
      bindTex(5, gl.TEXTURE_2D, prev.tex);
      draw();
      prev = t;
    }
    // Exposure reads the smallest level before the upsampling adds into the chain.
    const expSrc = RT.exp[RT.expCur], expDst = RT.exp[1 - RT.expCur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, expDst.fb);
    gl.viewport(0, 0, 1, 1);
    progExp.use().i('uSmall', 5).i('uPrev', 6)
      .f('uBlend', frameNo < 3 || TEST ? 1 : 1 - Math.exp(-dt * 2.2))
      .f('uKey', radio ? 0.45 : 0.9).f('uAuto', params.autoExp || radio ? 1 : 0)
      .f('uManual', Math.pow(2, params.ev) * (params.autoExp ? 1 : 1.6));
    bindTex(5, gl.TEXTURE_2D, RT.bloom[Math.min(4, BLOOM_LEVELS - 1)].tex);
    bindTex(6, gl.TEXTURE_2D, expSrc.tex);
    draw();
    RT.expCur = 1 - RT.expCur;

    // Wider levels are weaker, like the fall-off of a real lens's glare.
    if (!radio) {
      progUp.use().i('uSrc', 5).f('uWeight', BLOOM_DECAY);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
        const s = RT.bloom[i], t = RT.bloom[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.viewport(0, 0, t.w, t.h);
        progUp.f('uTexel', 1 / s.w, 1 / s.h).f('uDstRes', t.w, t.h);
        bindTex(5, gl.TEXTURE_2D, s.tex);
        draw();
      }
      gl.disable(gl.BLEND);
    }

    // -------------------------------------------------------- composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, size.cw, size.ch);
    progComp.use().i('uHdr', 5).i('uBloom', 6).i('uExp', 7)
      .f('uSrcRes', w, h).f('uDstRes', size.cw, size.ch)
      .f('uBloomAmt', 0.02 + 0.1 * params.bloom).f('uBloomNorm', BLOOM_NORM).f('uFrame', frameNo % 1024)
      .f('uTone', params.tone).f('uRadioView', radio ? 1 : 0);
    bindTex(5, gl.TEXTURE_2D, img.tex);
    bindTex(6, gl.TEXTURE_2D, RT.bloom[0].tex);
    bindTex(7, gl.TEXTURE_2D, expDst.tex);
    draw();
    frameNo++;
  }

  /* ============================================================ gestures */
  const pointers = new Map();
  let pinch = null;
  let lastTap = 0;
  let interacting = 0;
  const hint = $('hint');
  let hintTimer = setTimeout(() => hint.classList.add('gone'), 9000);
  function touched() {
    interacting = performance.now();
    if (!hint.classList.contains('gone')) { hint.classList.add('gone'); clearTimeout(hintTimer); }
  }
  function stopDive() { if (dive.active) { dive.active = false; syncDive(); } }

  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or already released */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
    cam.vth = cam.vph = 0;
    touched();
    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 };
    }
    const now = performance.now();
    if (e.pointerType !== 'mouse' && pointers.size === 1) {
      if (now - lastTap < 300) { cam.yaw = 0; cam.pitch = 0; }
      lastTap = now;
    }
  });
  canvas.addEventListener('dblclick', () => { cam.yaw = 0; cam.pitch = 0; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const lookScale = () => (1.1 / Math.max(canvas.clientHeight, 1));
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    touched();
    if (pointers.size === 1) {
      if (p.button === 2 || p.shift || e.shiftKey) {
        look(dx, dy);
      } else {
        const k = 3.2 / Math.max(canvas.clientHeight, 1);
        orbit(-dx * k, -dy * k);
        // Flick velocity from the real event rate, smoothed.
        const now = performance.now();
        const dtm = Math.min(Math.max((now - (p.t || now - 16)) / 1000, 0.004), 0.1);
        p.t = now;
        cam.vph = 0.7 * cam.vph + 0.3 * ((-dx * k) / dtm);
        cam.vth = 0.7 * cam.vth + 0.3 * ((-dy * k) / dtm);
      }
    } else if (pointers.size === 2 && pinch) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      if (pinch.d > 10 && d > 10) {
        cam.s = clampS(cam.s - Math.log(d / pinch.d) * 1.35);
        stopDive();
        fly = null;
      }
      look(mx - pinch.mx, my - pinch.my);
      pinch = { d, mx, my };
    }
  });
  const endPointer = (e) => {
    const p = pointers.get(e.pointerId);
    // No flick if the finger rested before lifting.
    if (p && performance.now() - (p.t || 0) > 90) { cam.vth = 0; cam.vph = 0; }
    const cap = 3;
    cam.vth = Math.max(-cap, Math.min(cap, cam.vth));
    cam.vph = Math.max(-cap, Math.min(cap, cam.vph));
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const [p] = pointers.values();
      p.x = p.x; // keep last position
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    cam.s = clampS(cam.s + dy * 0.0016);
    stopDive();
    fly = null;
    touched();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key;
    if (k === 'ArrowLeft') orbit(0.05, 0);
    else if (k === 'ArrowRight') orbit(-0.05, 0);
    else if (k === 'ArrowUp') orbit(0, -0.05);
    else if (k === 'ArrowDown') orbit(0, 0.05);
    else if (k === '+' || k === '=' || k === 'w' || k === 'W') { cam.s = clampS(cam.s - 0.12); stopDive(); }
    else if (k === '-' || k === '_' || k === 's' || k === 'S') { cam.s = clampS(cam.s + 0.12); stopDive(); }
    else if (k === ' ') { e.preventDefault(); toggleDive(); }
    else if (k === 'r' || k === 'R') restart();
    else if (k === 'Escape') { $('settings').hidden = true; $('info').hidden = true; }
    else return;
    touched();
  });

  const clampS = (s) => Math.min(S_MAX, Math.max(S_MIN, s));
  function orbit(dph, dth) {
    cam.ph = (cam.ph + dph) % (2 * Math.PI);
    cam.th = Math.min(Math.PI - 0.03, Math.max(0.03, cam.th + dth));
  }
  function look(dx, dy) {
    const k = lookScale();
    cam.yaw = cam.yaw + dx * k;
    cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw));
    cam.pitch = Math.min(1.45, Math.max(-1.45, cam.pitch + dy * k));
  }

  /* ================================================================ dive */
  const btnDive = $('btnDive');
  function syncDive() {
    btnDive.setAttribute('aria-pressed', dive.active ? 'true' : 'false');
    $('diveText').textContent = dive.active ? 'Ferma' : camR() < K.horizons(params.spin).rp ? 'Continua' : 'Tuffati';
  }
  function toggleDive() {
    if (dive.ended) return;
    dive.active = !dive.active;
    if (dive.active && camR() > 60) setR(60);
    syncDive();
  }
  btnDive.addEventListener('click', () => { toggleDive(); touched(); });

  function restart() {
    const p = PRESETS.find((x) => x.id === params.preset) || PRESETS[0];
    dive.active = false; dive.ended = false; dive.tau = 0;
    $('endcard').hidden = true;
    cam.th = p.th * DEG; cam.ph = 0; cam.yaw = 0; cam.pitch = 0; cam.vth = cam.vph = 0;
    setR(p.dist);
    syncDive();
  }
  $('btnRestart').addEventListener('click', restart);
  $('btnStay').addEventListener('click', () => { $('endcard').hidden = true; });

  // Inside the hole the interesting view alternates between "toward the centre"
  // (the future) and "up" (the way you came, where the outside universe is).
  let lookAnim = null;
  const btnLook = $('btnLook');
  btnLook.addEventListener('click', () => {
    const toUp = Math.abs(cam.yaw) < Math.PI / 2;
    lookAnim = { y0: cam.yaw, p0: cam.pitch, y1: toUp ? Math.PI : 0, p1: 0, t: 0 };
    if (!toUp && cam.yaw < 0) lookAnim.y1 = 0;
    if (toUp && cam.yaw < 0) lookAnim.y1 = -Math.PI;
    touched();
  });
  function syncLook(r) {
    const show = r < K.horizons(params.spin).rp * 1.15;
    if (btnLook.hidden === show) btnLook.hidden = !show;
    if (!show) return;
    const up = Math.abs(cam.yaw) < Math.PI / 2;
    btnLook.classList.toggle('down', !up);
    const txt = up ? 'Guarda verso l’alto' : 'Guarda verso il centro';
    if ($('lookText').textContent !== txt) $('lookText').textContent = txt;
  }

  function updateCamera(dt) {
    if (lookAnim) {
      lookAnim.t = Math.min(1, lookAnim.t + dt / 1.2);
      const e = lookAnim.t < 0.5 ? 2 * lookAnim.t * lookAnim.t : 1 - (-2 * lookAnim.t + 2) ** 2 / 2;
      cam.yaw = lookAnim.y0 + (lookAnim.y1 - lookAnim.y0) * e;
      cam.pitch = lookAnim.p0 + (lookAnim.p1 - lookAnim.p0) * e;
      if (lookAnim.t >= 1) { cam.yaw = Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw)); lookAnim = null; }
    }
    // Inertia after a flick.
    if (pointers.size === 0 && (Math.abs(cam.vth) > 1e-4 || Math.abs(cam.vph) > 1e-4)) {
      orbit(cam.vph * dt, cam.vth * dt);
      const decay = Math.exp(-dt * 5.5);
      cam.vth *= decay; cam.vph *= decay;
    }
    if (dive.active) {
      const a = params.spin;
      const r0 = camR();
      // Cinematic pace: slower where the strong-field sights are, between the
      // photon orbits and the horizon.
      const { rp } = K.horizons(a);
      const sm = (x0, x1, x) => { const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); return t * t * (3 - 2 * t); };
      const rate = r0 > rp ? 0.11 + 0.15 * sm(2.5, 9, r0) : 0.22;
      const s1 = clampS(cam.s - rate * dt);
      const r1 = rEnd + Math.exp(s1);
      // Follow the Doran geodesic: zero angular momentum, dragged in φ̃ by the spin.
      cam.ph += K.doranDphiDr(a, 0.5 * (r0 + r1)) * (r1 - r0);
      dive.tau += K.doranFallTime(a, cam.th, r0, r1);
      cam.s = s1;
      if (s1 <= S_MIN + 1e-9) { dive.active = false; dive.ended = true; showEnd(); syncDive(); }
    }
  }

  function showEnd() {
    const a = params.spin;
    const kerr = a > 0.02;
    $('endEyebrow').textContent = kerr ? 'Fine della fisica conosciuta' : 'Fine del viaggio';
    $('endTitle').textContent = kerr ? 'Orizzonte interno' : 'Singolarità';
    $('endText').textContent = kerr
      ? 'Guarda verso l’alto: la luce dell’universo esterno si concentra in un punto sempre più blu, amplificata senza limite. È l’instabilità dell’orizzonte interno (inflazione di massa): la curvatura diverge e la relatività generale classica non basta più. Nessuno sa cosa ci sia oltre.'
      : 'In un buco nero che non ruota tutto finisce in r = 0. La marea ti stira all’infinito lungo la direzione di caduta e ti schiaccia di lato, e il cielo si riduce a una sottile fascia luminosa intorno a te.';
    $('endcard').hidden = false;
  }

  /* ============================================================= captions */
  // Short lines that appear as you cross each boundary on the way in.
  const caption = $('caption');
  let capTimer = 0, prevR = null;
  const capShown = {};
  function captionList() {
    const a = params.spin;
    const { rp, rm } = K.horizons(a);
    const kerr = a > 0.02;
    const list = [
      { id: 'disk', r: params.rOut, title: 'Sopra il disco', text: 'Sotto di te il gas orbita a una frazione della velocità della luce e brilla a migliaia di gradi.' },
      { id: 'isco', r: K.iscoRadius(a), title: 'Ultima orbita stabile', text: 'Più all’interno nessuna orbita regge: il gas smette di girare e precipita a spirale verso l’orizzonte.' },
      { id: 'photon', r: K.photonOrbits(a).retro, title: 'Dove la luce orbita', text: 'Qui un raggio di luce può girare intorno al buco nero. Il bordo dell’ombra è fatto di questa luce.' },
      { id: 'horizon', r: rp, title: 'Orizzonte degli eventi', text: 'Non hai sentito nulla. Ma da qui nessun segnale può più uscire: lo spazio cade verso il centro più veloce della luce.' },
      { id: 'inside', r: kerr ? rm + 0.55 * (rp - rm) : 1.2, title: 'Dentro il buco nero', text: 'Qui r misura il tempo, non lo spazio: il centro non è un luogo davanti a te, è il tuo futuro.' },
    ];
    if (kerr && K.ergosphere(a, cam.th) > rp + 0.02) {
      list.splice(3, 0, { id: 'ergo', r: K.ergosphere(a, cam.th), title: 'Ergosfera', text: 'Lo spazio è trascinato dalla rotazione del buco nero: nulla può restare fermo, nemmeno con un razzo.' });
    }
    list.push(kerr
      ? { id: 'inner', r: rm + 0.06, title: 'Verso l’orizzonte interno', text: 'Guarda verso l’alto: la luce di tutto l’universo esterno si concentra in un punto sempre più blu.' }
      : { id: 'inner', r: 0.35, title: 'Verso la singolarità', text: 'La marea ti stira lungo la caduta e ti schiaccia di lato. Guarda di lato: il cielo si stringe in una fascia.' });
    return list;
  }
  // Captions queue up so each one stays readable for a few seconds.
  const capQueue = [];
  let capBusyUntil = 0;
  function showCaption(c) {
    capQueue.push(c);
    pumpCaptions();
  }
  function pumpCaptions() {
    const now = performance.now();
    if (!capQueue.length) return;
    if (now < capBusyUntil) { setTimeout(pumpCaptions, capBusyUntil - now + 20); return; }
    const c = capQueue.shift();
    $('capTitle').textContent = c.title;
    $('capText').textContent = c.text;
    caption.classList.add('show');
    capBusyUntil = now + 4200;
    clearTimeout(capTimer);
    capTimer = setTimeout(() => { if (!capQueue.length) caption.classList.remove('show'); }, 6500);
    if (capQueue.length) setTimeout(pumpCaptions, 4220);
  }
  function checkCaptions(r) {
    if (prevR !== null && r < prevR) {
      for (const c of captionList()) {
        if (prevR >= c.r && r < c.r && !capShown[c.id]) { capShown[c.id] = true; showCaption(c); }
      }
    }
    // Leaving well outside a boundary lets its caption play again next time.
    for (const c of captionList()) if (r > c.r * 1.4 + 0.05) capShown[c.id] = false;
    prevR = r;
  }

  /* ========================================================== instruments */
  const fmtNum = (x, d = 3) => {
    if (!isFinite(x)) return '∞';
    const ax = Math.abs(x);
    if (ax !== 0 && (ax >= 1e6 || ax < 1e-3)) {
      const e = Math.floor(Math.log10(ax));
      const m = x / Math.pow(10, e);
      return `${m.toLocaleString('it-IT', { maximumFractionDigits: 1 })}×10${sup(e)}`;
    }
    return x.toLocaleString('it-IT', { maximumSignificantDigits: d });
  };
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (e) => String(e).split('').map((c) => SUP[c] ?? c).join('');
  function fmtLen(m) {
    if (m < 1e3) return `${fmtNum(m)} m`;
    if (m < 1e9) return `${fmtNum(m / 1e3)} km`;
    return `${fmtNum(m / AU)} UA`;
  }
  function fmtTime(s) {
    if (!isFinite(s)) return '∞';
    if (s < 1e-3) return `${fmtNum(s * 1e6)} µs`;
    if (s < 1) return `${fmtNum(s * 1e3)} ms`;
    if (s < 120) return `${fmtNum(s)} s`;
    if (s < 7200) return `${fmtNum(s / 60)} min`;
    if (s < 172800) return `${fmtNum(s / 3600)} h`;
    if (s < 3.15e7 * 2) return `${fmtNum(s / 86400)} giorni`;
    return `${fmtNum(s / 3.156e7)} anni`;
  }

  function regionOf(r, th) {
    const a = params.spin;
    const { rp, rm } = K.horizons(a);
    const po = K.photonOrbits(a);
    const rI = K.iscoRadius(a);
    const re = K.ergosphere(a, th);
    if (r < rp) {
      if (a > 0.02 && r - rEnd < 0.03) return '<span class="blue">Orizzonte interno</span>';
      return '<span class="amber">Dentro l’orizzonte</span>';
    }
    if (r < re) return 'Ergosfera';
    if (r < po.retro) return 'Regione delle orbite di luce';
    if (r < rI) return 'Sotto l’ISCO';
    if (r < params.rOut * 1.05) return 'Nel disco';
    return 'Spazio esterno';
  }

  // Frequency shift of the light from the distant universe across the current
  // view, from a coarse grid of real rays. Inside the hole some directions carry
  // no light from outside at all (it would have to come out of the past horizon).
  let skyKey = '', skyTime = 0;
  function updateSkyShift(a, r, th) {
    const key = [a, r, th, cam.yaw, cam.pitch].map((x) => x.toPrecision(5)).join('|');
    const now = performance.now();
    if (key === skyKey || now - skyTime < 300) return;
    skyKey = key; skyTime = now;
    const view = K.cameraFrame(a, r, th, cam.yaw, cam.pitch);
    const tanY = Math.tan(((MOBILE && canvas.clientHeight > canvas.clientWidth ? 74 : 62) * DEG) / 2);
    const tanX = tanY * (canvas.clientWidth / Math.max(canvas.clientHeight, 1));
    let gLo = Infinity, gHi = 0;
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 7; i++) {
        const x = ((i / 6) * 2 - 1) * tanX, y = ((j / 4) * 2 - 1) * tanY;
        const ray = K.trace(a, r, th, K.pixelMomentum(view, x, y), { k: 0.16, maxSteps: 400 });
        if (ray.fate !== 'sky') continue;
        const g = 1 / ray.c.E;
        gLo = Math.min(gLo, g); gHi = Math.max(gHi, g);
      }
    }
    const shade = (g) => `<span class="${g >= 1 ? 'blue' : 'red'}">${fmtNum(g, 2)}</span>`;
    $('hSky').innerHTML = gHi > 0 ? `ν × ${shade(gLo)} … ${shade(gHi)}` : '<em>nessuna luce dal cielo</em>';
  }

  let hudTimer = 0;
  let endShownAt = -1e9;
  function updateHUD() {
    const a = params.spin;
    const r = camR(), th = cam.th;
    const M = params.mass;
    const rg = GM_C2 * M, tg = GM_C3 * M;
    const { rp, rm } = K.horizons(a);
    $('hDist').innerHTML = `${fmtNum(r, r < 10 ? 3 : 3)} r<sub>g</sub> <em>· ${fmtLen(r * rg)}</em>`;
    $('hRegion').innerHTML = regionOf(r, th);
    const beta = Math.sqrt((2 * r) / (r * r + a * a));
    $('hFall').innerHTML = `${fmtNum(beta, 3)} c <em>${beta > 1 ? 'più veloce della luce' : 'caduta libera'}</em>`;
    const tide = (K.tidalStretch(a, r, th) * C2 * 2) / (rg * rg) / 9.80665;
    $('hTide').innerHTML = `${fmtNum(tide, 2)} g${tide > 1e3 ? ' <span class="red">letale</span>' : ''}`;
    updateSkyShift(a, r, th);
    const inside = r < rp;
    $('hTimeRow').hidden = !(inside || dive.tau > 0);
    if (inside || dive.tau > 0) {
      const left = K.doranFallTime(a, th, r, a > 0.02 ? rm : 0);
      $('hTime').innerHTML = inside
        ? `${fmtTime(left * tg)} <em>alla fine</em>`
        : `${fmtTime(dive.tau * tg)} <em>trascorso</em>`;
    }
    $('spinLabel').textContent = `a* ${a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
    updateGauge(r);
    syncLook(r);
    if (!TEST) checkCaptions(r);
    if (cam.s <= S_MIN + 0.02 && !dive.ended && $('endcard').hidden && performance.now() - endShownAt > 30000) {
      endShownAt = performance.now();
      showEnd();
    }
  }

  /* ================================================================ gauge */
  const gaugeMarks = $('gaugeMarks');
  let gaugeKey = '';
  function gaugeY(r) {
    const s = Math.log(Math.max(r - rEnd, 1e-6));
    const s0 = Math.log(0.0035), s1 = Math.log(80);
    return 1 - (Math.min(s1, Math.max(s0, s)) - s0) / (s1 - s0);
  }
  function buildGauge() {
    const a = params.spin;
    const { rp, rm } = K.horizons(a);
    const po = K.photonOrbits(a);
    const marks = [
      { r: params.rOut, label: 'Bordo del disco' },
      { r: K.iscoRadius(a), label: 'ISCO' },
      { r: K.ergosphere(a, cam.th), label: 'Ergosfera' },
      { r: po.pro, label: 'Orbita della luce' },
      { r: rp, label: 'Orizzonte', cls: 'horizon' },
      a > 0.02 ? { r: rm + 0.004, label: 'Orizzonte interno' } : { r: rEnd + 0.004, label: 'Singolarità' },
    ].sort((x, y) => y.r - x.r);
    const h = $('gauge').clientHeight || 400;
    const gap = h < 300 ? 15 : 18;
    // True tick positions, then labels pushed apart top-down and bottom-up.
    const ys = marks.map((m) => gaugeY(m.r) * h);
    const ly = ys.slice();
    for (let i = 1; i < ly.length; i++) ly[i] = Math.max(ly[i], ly[i - 1] + gap);
    for (let i = ly.length - 1; i >= 0; i--) ly[i] = Math.min(ly[i], (i === ly.length - 1 ? h : ly[i + 1]) - (i === ly.length - 1 ? 0 : gap));
    gaugeMarks.innerHTML = '';
    marks.forEach((m, i) => {
      const tick = document.createElement('i');
      tick.className = 'tick';
      tick.style.top = `${ys[i]}px`;
      gaugeMarks.appendChild(tick);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mark' + (m.cls ? ' ' + m.cls : '');
      b.style.top = `${ly[i]}px`;
      b.textContent = m.label;
      b.dataset.r = m.r;
      b.title = `Vai a r = ${fmtNum(m.r, 3)} r_g`;
      b.addEventListener('click', () => { flyTo(m.r * (m.cls === 'horizon' ? 1.003 : 1.0)); touched(); });
      gaugeMarks.appendChild(b);
    });
  }
  let fly = null;
  function flyTo(r, dur = 1.6) {
    stopDive();
    fly = { from: cam.s, to: clampS(Math.log(Math.max(r - rEnd, 0.0036))), t: 0, dur };
  }
  function updateGauge(r) {
    const a = params.spin;
    const key = `${a}|${params.rOut}|${Math.round(cam.th * 20)}|${$('gauge').clientHeight}`;
    if (key !== gaugeKey) { gaugeKey = key; buildGauge(); }
    const y = gaugeY(r);
    const me = $('gaugeMe');
    me.style.top = `${y * 100}%`;
    for (const b of gaugeMarks.children) b.classList.toggle('passed', r <= parseFloat(b.dataset.r));
  }

  /* ============================================================= settings */
  const sheet = $('settings'), info = $('info');
  $('btnSettings').addEventListener('click', () => { sheet.hidden = !sheet.hidden; info.hidden = true; touched(); });
  $('closeSettings').addEventListener('click', () => { sheet.hidden = true; });
  function fillFacts() {
    const a = params.spin, M = params.mass;
    const rg = GM_C2 * M, tg = GM_C3 * M;
    const { rp, rm } = K.horizons(a);
    const rI = K.iscoRadius(a);
    const p = PRESETS.find((x) => x.id === params.preset) || PRESETS[0];
    $('fHorizon').innerHTML = `${fmtNum(rp, 3)} r<sub>g</sub>`;
    $('fHorizonKm').textContent = fmtLen(rp * rg);
    $('fIsco').innerHTML = `${fmtNum(rI, 3)} r<sub>g</sub>`;
    $('fIscoKm').textContent = fmtLen(rI * rg);
    $('fPeriod').textContent = fmtTime(2 * Math.PI * (Math.pow(rI, 1.5) + a) * tg);
    $('fObject').textContent = `${p.title}, ${fmtNum(M, 3)} M☉`;
    $('fFall').textContent = fmtTime(K.doranFallTime(a, cam.th, rp, a > 0.02 ? rm : 0) * tg);
    $('fFallNote').textContent = a > 0.02 ? 'fino all’orizzonte interno' : 'fino alla singolarità';
  }
  $('btnInfo').addEventListener('click', () => { fillFacts(); info.hidden = false; sheet.hidden = true; info.scrollTop = 0; touched(); });
  $('closeInfo').addEventListener('click', () => { info.hidden = true; });

  function chipGroup(el, items, current, onPick) {
    el.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', it.id === current ? 'true' : 'false');
      b.textContent = it.label;
      b.addEventListener('click', () => {
        for (const c of el.children) c.setAttribute('aria-checked', 'false');
        b.setAttribute('aria-checked', 'true');
        onPick(it);
      });
      el.appendChild(b);
    }
  }

  const inSpin = $('inSpin'), inTemp = $('inTemp'), inROut = $('inROut');
  const inEV = $('inEV'), inBloom = $('inBloom'), inTime = $('inTime');
  function syncOutputs() {
    $('outSpin').textContent = params.spin.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    $('outTemp').textContent = params.T >= 1e5 ? `${fmtNum(params.T, 2)} K` : `${Math.round(params.T / 100) * 100} K`;
    $('outROut').innerHTML = `${params.rOut.toLocaleString('it-IT')} r<sub>g</sub>`;
    $('outEV').textContent = `${params.ev > 0 ? '+' : ''}${params.ev.toLocaleString('it-IT', { maximumFractionDigits: 1 })} EV`;
    $('outBloom').textContent = `${Math.round(params.bloom * 100)}%`;
    const perSec = 20 * params.timeSpeed;
    const real = perSec * GM_C3 * params.mass;
    $('outTime').textContent = perSec === 0 ? 'fermo' : `1 s = ${fmtTime(real)} reali`;
  }
  function applyPreset(p, moveCamera = true) {
    params.preset = p.id;
    params.mass = p.mass; params.spin = p.spin; params.T = p.T; params.rOut = p.rOut; params.doppler = p.doppler;
    inSpin.value = p.spin; inTemp.value = Math.log10(p.T); inROut.value = p.rOut;
    $('inDoppler').checked = p.doppler;
    $('presetLabel').textContent = p.title;
    $('presetNote').textContent = p.note;
    spinChanged();
    if (moveCamera) restart();
    syncOutputs();
  }
  function spinChanged() {
    const r = camR();
    rEnd = rEndOf(params.spin);
    setR(Math.max(r, rEnd + 0.004));
    gaugeKey = '';
  }
  inSpin.addEventListener('input', () => { params.spin = parseFloat(inSpin.value); spinChanged(); syncOutputs(); });
  inTemp.addEventListener('input', () => { params.T = Math.pow(10, parseFloat(inTemp.value)); syncOutputs(); });
  inROut.addEventListener('input', () => { params.rOut = parseFloat(inROut.value); gaugeKey = ''; syncOutputs(); });
  inEV.addEventListener('input', () => { params.ev = parseFloat(inEV.value); syncOutputs(); });
  inBloom.addEventListener('input', () => { params.bloom = parseFloat(inBloom.value); syncOutputs(); });
  inTime.addEventListener('input', () => { params.timeSpeed = parseFloat(inTime.value); syncOutputs(); });
  const bindToggle = (id, key) => $(id).addEventListener('change', (e) => { params[key] = e.target.checked; });
  bindToggle('inDisk', 'disk'); bindToggle('inDoppler', 'doppler'); bindToggle('inStars', 'stars'); bindToggle('inAuto', 'autoExp');
  chipGroup($('presetChips'), PRESETS, params.preset, (p) => applyPreset(p));
  function syncView() {
    const v = VIEWS.find((x) => x.id === params.view);
    $('viewNote').textContent = v.note;
    $('blurRow').hidden = params.view !== 'radio';
  }
  chipGroup($('viewChips'), VIEWS, params.view, (v) => { params.view = v.id; syncView(); });
  $('inBlur').addEventListener('change', (e) => { params.ehtBlur = e.target.checked; });
  syncView();
  chipGroup($('qualityChips'), QUALITIES, params.quality, (q) => { params.quality = q.id; perfNote(); });
  function perfNote() {
    $('perfNote').textContent = floatRT
      ? `Risoluzione interna ${Math.round(Math.min(perf.scale, qualitySettings().maxScale) * 100)}% · ${Math.round(perf.fps)} fotogrammi/s`
      : 'Modalità compatibile: questo dispositivo non supporta il rendering in virgola mobile.';
  }

  /* ============================================================ main loop */
  let lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / fly.dur);
      const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
      cam.s = fly.from + (fly.to - fly.from) * e;
      if (fly.dur > 3 && pointers.size === 0) cam.th += (PRESETS[0].th * DEG - cam.th) * Math.min(1, dt * 0.5);
      if (fly.t >= 1) fly = null;
    }
    updateCamera(dt);
    if (params.timeSpeed > 0) simTime += dt * 20 * params.timeSpeed;
    try {
      render(dt);
    } catch (err) {
      fail('Errore grafico: ' + err.message);
      throw err;
    }
    // Dynamic resolution: aim for ~30 fps, faster while the user is moving the view.
    perf.ema = perf.ema * 0.9 + dt * 1000 * 0.1;
    perf.fps = 1000 / perf.ema;
    if (t - perf.last > 450 && !TEST) {
      perf.last = t;
      const busy = t - interacting < 800;
      const target = busy ? 30 : 36;
      const q = qualitySettings();
      if (perf.ema > target * 1.25 && perf.scale > 0.28) perf.scale = Math.max(0.28, perf.scale * 0.86);
      else if (perf.ema < target * 0.72 && perf.scale < q.maxScale) perf.scale = Math.min(q.maxScale, perf.scale * 1.08);
    }
    if (t - hudTimer > 110) { hudTimer = t; updateHUD(); if (!sheet.hidden) perfNote(); }
  }

  /* ================================================================ boot */
  function boot() {
    const p = PRESETS[0];
    applyPreset(p, false);
    cam.th = p.th * DEG;
    setR(p.dist);
    if (TEST) {
      // Deterministic views for automated checks: ?test&r=..&th=..&ph=..&a=..&yaw=..&pitch=..
      const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
      params.spin = num('a', params.spin); rEnd = rEndOf(params.spin);
      setR(num('r', p.dist));
      cam.th = num('th', p.th) * DEG; cam.ph = num('ph', 0) * DEG;
      cam.yaw = num('yaw', 0) * DEG; cam.pitch = num('pitch', 0) * DEG;
      params.T = num('T', params.T);
      params.doppler = qs.get('doppler') !== '0';
      params.disk = qs.get('disk') !== '0';
      params.stars = qs.get('stars') !== '0';
      params.autoExp = qs.get('auto') !== '0';
      params.ev = num('ev', 0);
      params.tone = num('tone', 0);
      if (qs.get('view') === 'radio') params.view = 'radio';
      params.ehtBlur = qs.get('blur') === '1';
      params.timeSpeed = 0;
      simTime = num('t', 0);
      perf.scale = num('scale', 1);
      if (qs.has('q')) params.quality = qs.get('q');
    }
    syncOutputs();
    syncDive();
    $('loadingText').textContent = 'Genero la Via Lattea…';
    // Let the text paint before the heavy work.
    setTimeout(() => {
      try {
        buildPrograms();
        const skySize = TEST ? num0('sky', 512) : MOBILE ? 1024 : 2048;
        buildSky(skySize);
        buildDisk(params.spin);
      } catch (err) {
        fail('Non riesco a inizializzare la grafica: ' + err.message);
        console.error(err);
        return;
      }
      $('loading').classList.add('done');
      window.__bhReady = true;
      if (!TEST) {
        // Opening shot: drift in from afar while the lensing tightens around the hole.
        setR(95);
        cam.th = (p.th - 4) * DEG;
        flyTo(p.dist, 7);
      }
      requestAnimationFrame(loop);
    }, 30);
  }
  const num0 = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);

  // Expose a tiny hook for automated render checks.
  window.__bh = {
    params, cam,
    get r() { return camR(); },
    renderOnce: (n = 1) => { for (let i = 0; i < n; i++) render(1 / 60); },
    // Read back HDR values for automated checks: a horizontal line through the centre.
    probe(y = 0.5, n = 16) {
      if (!floatRT) return null;
      const out = [];
      const buf = new Float32Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.trace.fb);
      for (let i = 0; i < n; i++) {
        gl.readPixels(Math.floor(((i + 0.5) / n) * RT.w), Math.floor(y * RT.h), 1, 1, gl.RGBA, gl.FLOAT, buf);
        out.push([...buf.slice(0, 3)].map((v) => +v.toPrecision(3)));
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, RT.exp[RT.expCur].fb);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buf);
      return { line: out, exposure: buf[0], meanLum: buf[1] };
    },
  };

  window.addEventListener('resize', () => { gaugeKey = ''; });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('La scheda grafica si è riavviata. Ricarica la pagina per continuare.'); });
  boot();
})();
