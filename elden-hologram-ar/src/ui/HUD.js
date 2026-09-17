// Interfaccia: schermata iniziale, selettore boss, slider grandezza/velocità, stile, combattimento, toast.
import { sliderToMeters, metersToSlider, formatMeters } from '../util/math.js';
import { STYLES } from '../fx/HologramMaterial.js';
import { WebXRMode } from '../app/Modes.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(app) {
    this.app = app;
    this.el = {
      entry: $('entry'), hud: $('hud'),
      btnWebxr: $('btn-webxr'), webxrStatus: $('webxr-status'), btnGyro: $('btn-gyro'), btnPreview: $('btn-preview'),
      badge: $('mode-badge'), hint: $('hint'), btnExit: $('btn-exit'),
      btnStyle: $('btn-style'), btnSound: $('btn-sound'), btnQuality: $('btn-quality'), btnSettings: $('btn-settings'),
      picker: $('boss-picker'),
      scale: $('scale'), scaleValue: $('scale-value'), btnLore: $('btn-lore'),
      btnRotate: $('btn-rotate'), btnRemove: $('btn-remove'), btnClear: $('btn-clear'), btnFight: $('btn-fight'),
      timescale: $('timescale'), speedValue: $('speed-value'),
      settings: $('settings'), phoneHeight: $('phone-height'), phoneHeightValue: $('phone-height-value'),
      fov: $('fov'), fovValue: $('fov-value'), shadows: $('shadows'), stabilize: $('stabilize'),
      btnRecenter: $('btn-recenter'), btnSettingsClose: $('btn-settings-close'),
      victory: $('victory'), victoryName: $('victory-name'), toasts: $('toasts'),
    };
    this.fightState = 'idle'; // idle | fighting | finished
    this._bind();
    this._checkSupport();
    this._syncSettings();
  }

  // ------------------------------------------------------------------ setup
  async _checkSupport() {
    const ok = await WebXRMode.isSupported();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ok) {
      this.el.btnWebxr.disabled = false;
      this.el.webxrStatus.textContent = 'WebXR pronto: superfici rilevate automaticamente';
    } else {
      this.el.btnWebxr.disabled = true;
      this.el.webxrStatus.textContent = isIOS
        ? 'Non disponibile su iPhone/iPad: usa la Modalità Camera'
        : (window.isSecureContext ? 'WebXR AR non supportato su questo dispositivo/browser' : 'Serve HTTPS per WebXR e fotocamera');
    }
  }

  _bind() {
    const { app, el } = this;
    const startMode = async (name) => {
      try { await app.startMode(name); }
      catch (e) { console.error(e); this.toast(`Impossibile avviare: ${e.message || e}`); }
    };
    el.btnWebxr.addEventListener('click', () => startMode('webxr'));
    el.btnGyro.addEventListener('click', () => startMode('gyro'));
    el.btnPreview.addEventListener('click', () => startMode('preview'));
    el.btnExit.addEventListener('click', () => app.stopMode());

    el.btnStyle.addEventListener('click', () => app.cycleStyle());
    el.btnSound.addEventListener('click', () => app.setSound(!app.settings.sound));
    el.btnQuality.addEventListener('click', () => { app.setHD(!app.settings.hd); this.toast(app.settings.hd ? 'Qualità HD attiva (riavvia AR per applicarla al WebXR)' : 'Qualità standard'); });
    el.btnSettings.addEventListener('click', () => el.settings.classList.toggle('hidden'));
    el.btnSettingsClose.addEventListener('click', () => el.settings.classList.add('hidden'));

    el.scale.addEventListener('input', () => app.setHeight(sliderToMeters(Number(el.scale.value))));
    el.btnLore.addEventListener('click', () => {
      const def = app.selected ? app.selected.def : app.selectedDef;
      if (def && def.loreHeight) { app.setHeight(def.loreHeight); this.toast(`${def.short || def.name}: altezza da lore ≈ ${formatMeters(def.loreHeight)}`); }
    });
    el.btnRotate.addEventListener('click', () => { if (app.selected) app.selected.yaw += Math.PI / 4; });
    el.btnRemove.addEventListener('click', () => app.remove(app.selected));
    el.btnClear.addEventListener('click', () => app.clearBosses());
    el.btnFight.addEventListener('click', () => {
      if (this.fightState === 'fighting') app.stopFight();
      else if (this.fightState === 'finished') { app.resetFight(); setTimeout(() => app.startFight(), 250); }
      else app.startFight();
    });
    el.timescale.addEventListener('input', () => {
      const v = Number(el.timescale.value) / 100;
      app.setTimeScale(v);
      el.speedValue.textContent = `${v.toFixed(1)}×`;
    });

    el.phoneHeight.addEventListener('input', () => {
      const m = Number(el.phoneHeight.value) / 100;
      app.updateSetting('phoneHeight', m);
      el.phoneHeightValue.textContent = formatMeters(m);
    });
    el.fov.addEventListener('input', () => {
      const f = Number(el.fov.value);
      app.updateSetting('fov', f);
      el.fovValue.textContent = `${f}°`;
    });
    el.shadows.addEventListener('change', () => app.setShadows(el.shadows.checked));
    el.stabilize.addEventListener('change', () => {
      app.updateSetting('stabilize', el.stabilize.checked);
      this.toast(el.stabilize.checked ? 'Ancoraggio al tavolo attivo' : 'Ancoraggio disattivato');
    });
    el.btnRecenter.addEventListener('click', () => {
      if (app.mode && app.mode.recenter) { app.mode.recenter(); this.toast('Vista ricentrata'); }
      else this.toast('Disponibile in modalità Camera');
    });

    // Con DOM overlay WebXR, i tocchi sui controlli non devono generare eventi "select" XR
    el.hud.addEventListener('beforexrselect', (e) => { if (e.target.closest('button, input, label, .hud-bottom, .hud-top, .hud-side, .sheet')) e.preventDefault(); });

    app.on('manifest', (m) => this.onManifest(m));
    app.on('mode', (name) => this._onMode(name));
    app.on('bosses', () => this._refresh());
    app.on('select', (b) => { this._syncScale(b ? b.height : app.settings.defaultHeight); this._refresh(); });
    app.on('height', (m) => this._syncScale(m));
    app.on('style', (s) => this.toast(`Stile: ${STYLES[s].label}`));
    app.on('settings', () => this._syncSettings());
    app.on('fight', (active) => {
      this.fightState = active ? 'fighting' : (app.fight.winner ? 'finished' : 'idle');
      if (active) this._hideVictory();
      this._refresh();
    });
    app.on('victory', (w) => this._showVictory(w));
    app.on('toast', (msg) => this.toast(msg));
    app.on('selectedDef', () => this._refreshPicker());
  }

  // ------------------------------------------------------------------ manifest / picker
  onManifest(manifest) {
    const { el, app } = this;
    el.picker.innerHTML = '';
    // I boss con un modello 3D vero vengono per primi.
    const ordered = [...manifest.bosses].sort((a, b) => (b.model ? 1 : 0) - (a.model ? 1 : 0));
    for (const def of ordered) {
      const real = !!def.model;
      const b = document.createElement('button');
      b.className = 'boss-btn';
      b.dataset.id = def.id;
      b.innerHTML = `<span class="boss-name">${def.short || def.name}${real ? '<i class="tag">3D</i>' : ''}</span>`
        + `<span class="boss-meta">${def.stats ? `HP ${def.stats.hp} · ATK ${def.stats.attack}` : ''}</span>`
        + `<span class="boss-swatch" style="background:${def.color || '#d9b654'}"></span>`;
      b.title = real ? `${def.name} — modello 3D` : `${def.name} — segnaposto`;
      b.addEventListener('click', () => {
        app.setSelectedDef(def);
        this.toast(real ? `Prossima evocazione: ${def.name}` : `${def.short || def.name}: segnaposto (vedi prompts/ per generarlo)`);
      });
      el.picker.appendChild(b);
    }
    this._refreshPicker();
    this._syncScale(app.settings.defaultHeight);
    this._setupQuickLook(manifest);
  }

  /** Su iOS/Safari mostra i link Quick Look (rel="ar") per i boss che hanno un file USDZ. */
  async _setupQuickLook(manifest) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const a = document.createElement('a');
    if (!isIOS || !a.relList || !a.relList.supports || !a.relList.supports('ar')) return;
    const base = import.meta.env.BASE_URL || './';
    const list = $('quicklook-list');
    let count = 0;
    for (const def of manifest.bosses) {
      if (!def.usdz) continue;
      const url = `${base}${def.usdz}`;
      const ok = await fetch(url, { method: 'HEAD' }).then((r) => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '')).catch(() => false);
      if (!ok) continue;
      const link = document.createElement('a');
      link.rel = 'ar';
      link.href = url;
      link.innerHTML = `<img src="${base}icons/icon.svg" alt="" /> ${def.short || def.name}`;
      list.appendChild(link);
      count++;
    }
    if (count) $('quicklook').classList.remove('hidden');
  }

  _refreshPicker() {
    const id = this.app.selectedDef ? this.app.selectedDef.id : null;
    for (const b of this.el.picker.querySelectorAll('.boss-btn')) b.classList.toggle('selected', b.dataset.id === id);
    this._refresh();
  }

  // ------------------------------------------------------------------ stato
  _onMode(name) {
    const { el, app } = this;
    const active = !!name;
    el.entry.classList.toggle('hidden', active);
    el.hud.classList.toggle('hidden', !active);
    el.settings.classList.add('hidden');
    this._hideVictory();
    if (active) el.badge.textContent = app.mode.label;
    this.fightState = 'idle';
    this._refresh();
  }

  _refresh() {
    const { el, app } = this;
    const n = app.bosses.filter((b) => b.root.visible).length;
    const hasSel = !!app.selected;
    el.btnRemove.disabled = !hasSel;
    el.btnRotate.disabled = !hasSel;
    el.btnClear.disabled = n === 0;
    el.btnFight.disabled = n < 2 && this.fightState !== 'fighting';
    el.btnFight.classList.toggle('active', this.fightState === 'fighting');
    el.btnFight.textContent = this.fightState === 'fighting' ? '■ Stop' : this.fightState === 'finished' ? '↺ Rivincita' : '⚔ Combatti';
    const next = app.selectedDef ? (app.selectedDef.short || app.selectedDef.name) : 'un boss';
    if (this.fightState === 'fighting') el.hint.textContent = 'Combattimento in corso';
    else if (this.fightState === 'finished') el.hint.textContent = 'Rivincita o evoca altri boss';
    else if (n === 0) el.hint.textContent = `Tocca il tavolo per evocare ${next}`;
    else if (n === 1) el.hint.textContent = `Evoca un altro boss (${next}) e premi Combatti`;
    else el.hint.textContent = 'Premi Combatti · pizzica per ridimensionare';
  }

  _syncScale(m) {
    this.el.scale.value = String(metersToSlider(m));
    this.el.scaleValue.textContent = formatMeters(m);
  }

  _syncSettings() {
    const { el, app } = this;
    const s = app.settings;
    el.btnSound.classList.toggle('active', !!s.sound);
    el.btnQuality.classList.toggle('active', !!s.hd);
    el.btnStyle.classList.toggle('active', s.style !== 'realistic');
    el.btnStyle.title = `Stile: ${STYLES[s.style] ? STYLES[s.style].label : s.style}`;
    el.phoneHeight.value = String(Math.round(s.phoneHeight * 100));
    el.phoneHeightValue.textContent = formatMeters(s.phoneHeight);
    el.fov.value = String(s.fov);
    el.fovValue.textContent = `${s.fov}°`;
    el.shadows.checked = !!s.shadows;
    el.stabilize.checked = s.stabilize !== false;
  }

  _showVictory(winner) {
    const { el } = this;
    if (!winner) { this.toast('Nessun vincitore'); return; }
    el.victoryName.textContent = winner.def.name;
    el.victory.classList.remove('hidden');
    clearTimeout(this._victoryTimer);
    this._victoryTimer = setTimeout(() => this._hideVictory(), 4500);
  }
  _hideVictory() { this.el.victory.classList.add('hidden'); }

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  }
}
