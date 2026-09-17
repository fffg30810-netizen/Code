// Le tre modalità di visualizzazione:
//  - WebXRMode:      AR vera (ARCore/Chrome Android): hit-test sulle superfici, DOM overlay, stima luce.
//  - GyroCameraMode: fotocamera + giroscopio (iPhone e tutto il resto): piano virtuale davanti a te.
//  - PreviewMode:    tavolo virtuale con orbit camera, per sviluppo/desktop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
import { VisualStabilizer } from '../ar/Stabilizer.js';
import { CameraLight } from '../ar/CameraLight.js';

// ---------------------------------------------------------------------------
function rayPlaneY(ray, planeY, out) {
  const t = (planeY - ray.origin.y) / ray.direction.y;
  if (!Number.isFinite(t) || t < 0.02 || t > 60) return null;
  return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
}

// ---------------------------------------------------------------------------
export class PreviewMode {
  constructor(app) {
    this.app = app;
    this.name = 'preview';
    this.label = 'Anteprima 3D';
    this.groundY = 0;
    this.controls = null;
    this.table = null;
  }
  get camera() { return this.app.camera; }

  async start() {
    const { app } = this;
    app.camera.fov = 50;
    app.camera.position.set(0.7, 0.62, 1.05);
    app.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(app.camera, app.canvas);
    this.controls.target.set(0, 0.12, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 8;
    this.controls.update();

    const table = new THREE.Group();
    table.name = 'VirtualTable';
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.75, metalness: 0.05 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.0), wood);
    top.position.y = -0.02;
    top.receiveShadow = true;
    table.add(top);
    for (const [x, z] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.42], [0.72, 0.42]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), wood);
      leg.position.set(x, -0.4, z);
      table.add(leg);
    }
    const grid = new THREE.GridHelper(1.6, 16, 0xd9b654, 0x8a6f2e);
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.position.y = 0.001;
    grid.scale.z = 1.0 / 1.6;
    table.add(grid);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.76;
    floor.receiveShadow = true;
    table.add(floor);
    this.table = table;
    app.scene.add(table);
    this._onDown = (x, y) => { if (app.pickBoss(x, y)) this.controls.enabled = false; };
    this._onUp = () => { this.controls.enabled = true; };
    app.gestures.on('down', this._onDown);
    app.gestures.on('up', this._onUp);
  }

  async stop() {
    this.app.gestures.off('down', this._onDown);
    this.app.gestures.off('up', this._onUp);
    this.controls && this.controls.dispose();
    this.controls = null;
    if (this.table) {
      this.table.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
      this.app.scene.remove(this.table);
      this.table = null;
    }
  }

  update() { this.controls && this.controls.update(); }
  placeFromScreen(x, y) { return this.groundPointFromScreen(x, y, this.groundY); }
  groundPointFromScreen(x, y, planeY) {
    return rayPlaneY(this.app.screenRay(x, y), planeY, new THREE.Vector3());
  }
}

// ---------------------------------------------------------------------------
const _anchorVec = new THREE.Vector3();
const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° attorno a X
function quaternionFromDeviceOrientation(q, alpha, beta, gamma, orient) {
  _euler.set(beta, alpha, -gamma, 'YXZ');
  q.setFromEuler(_euler);
  q.multiply(_q1);
  q.multiply(_q0.setFromAxisAngle(_zee, -orient));
}

export class GyroCameraMode {
  constructor(app) {
    this.app = app;
    this.name = 'gyro';
    this.label = 'Camera';
    this.video = document.getElementById('camera-feed');
    this.stream = null;
    this.orientation = null;
    this.hasGyro = false;
    this.lookYaw = 0;
    this.lookPitch = -0.55;
    this.groundY = -app.settings.phoneHeight;
    this._onOrientation = (e) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      this.hasGyro = true;
      this.orientation = { alpha: THREE.MathUtils.degToRad(e.alpha), beta: THREE.MathUtils.degToRad(e.beta), gamma: THREE.MathUtils.degToRad(e.gamma) };
    };
    this._onScreenOrientation = () => {
      const angle = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
      this.screenOrient = THREE.MathUtils.degToRad(angle);
    };
    this.screenOrient = 0;
    this.stabilizer = null;
    this.light = null;      // luce dedotta dall'immagine della fotocamera
  }
  get camera() { return this.app.camera; }

  async start() {
    const { app } = this;
    app.camera.fov = app.settings.fov;
    app.camera.position.set(0, 0, 0);
    app.camera.updateProjectionMatrix();
    this.lookYaw = 0;
    this.lookPitch = -0.55;
    this.stabilizer = new VisualStabilizer(this.video);
    this.stabilizer.enabled = app.settings.stabilize !== false;
    // luce, esposizione e riflessi presi dalla stanza vera: senza questo
    // l'ologramma resta "incollato sopra" l'immagine invece di starci dentro
    this.light = new CameraLight(this.video, app.renderer);

    // iOS 13+: i sensori richiedono un permesso esplicito e vanno chiesti PRIMA della fotocamera,
    // finché il gesto dell'utente (tap sul pulsante) è ancora valido.
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') app.toast('Sensori negati: trascina per guardarti intorno');
      } catch { /* fuori da un gesto utente: proveremo comunque ad ascoltare */ }
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('getUserMedia non disponibile (serve HTTPS)');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
    } catch (e) {
      app.toast(`Fotocamera non disponibile: ${e.message || e}`);
    }
    this._onScreenOrientation();
    window.addEventListener('deviceorientation', this._onOrientation, true);
    window.addEventListener('orientationchange', this._onScreenOrientation);
    if (screen.orientation) screen.orientation.addEventListener('change', this._onScreenOrientation);
    setTimeout(() => { if (!this.hasGyro) app.toast('Nessun giroscopio: trascina sullo sfondo per orientare la vista'); }, 2500);
  }

  async stop() {
    window.removeEventListener('deviceorientation', this._onOrientation, true);
    window.removeEventListener('orientationchange', this._onScreenOrientation);
    if (screen.orientation) screen.orientation.removeEventListener('change', this._onScreenOrientation);
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    this.video.srcObject = null;
    this.stabilizer = null;
    if (this.light) { this.light.dispose(); this.light = null; }
    this.app.applyRoomLight(null);
    this.app.camera.position.set(0, 0, 0);
  }

  onDragEmpty(dx, dy) {
    if (this.hasGyro) return;
    this.lookYaw -= dx * 0.005;
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - dy * 0.005, -1.4, 1.2);
  }

  update(dt) {
    const cam = this.app.camera;
    this.groundY = -this.app.settings.phoneHeight;
    if (this.hasGyro && this.orientation) {
      const o = this.orientation;
      quaternionFromDeviceOrientation(cam.quaternion, o.alpha, o.beta, o.gamma, this.screenOrient);
    } else {
      cam.quaternion.setFromEuler(_euler.set(this.lookPitch, this.lookYaw, 0, 'YXZ'));
    }
    if (cam.fov !== this.app.settings.fov) { cam.fov = this.app.settings.fov; cam.updateProjectionMatrix(); }

    // Stabilizzazione: sposta la camera virtuale quanto si è spostato il telefono,
    // così il boss resta ancorato al punto del tavolo dove l'hai messo.
    if (this.stabilizer) {
      this.stabilizer.enabled = this.app.settings.stabilize !== false;
      const off = this.stabilizer.update(dt || 0.016, cam.quaternion, THREE.MathUtils.degToRad(cam.fov), this.app.settings.phoneHeight);
      cam.position.copy(off);
    }

    // La luce della stanza cambia mentre ti muovi: aggiornarla di continuo tiene
    // i boss illuminati come gli oggetti veri che hanno intorno.
    if (this.light && this.app.settings.autoLight !== false) {
      this.light.update(dt || 0.016);
      if (this.light.ready) this.app.applyRoomLight(this.light);
    }
  }

  /** Riporta l'ologramma al centro se la stima si è allontanata troppo. */
  recenter() {
    if (this.stabilizer) this.stabilizer.reset();
    this.app.camera.position.set(0, 0, 0);
  }

  placeFromScreen(x, y) {
    const p = this.groundPointFromScreen(x, y, this.groundY);
    if (!p) this.app.toast('Punta il telefono verso il tavolo, poi tocca');
    return p;
  }
  groundPointFromScreen(x, y, planeY) {
    return rayPlaneY(this.app.screenRay(x, y), planeY, new THREE.Vector3());
  }
}

// ---------------------------------------------------------------------------
function makeReticle() {
  const g = new THREE.Group();
  g.name = 'Reticle';
  const gold = new THREE.MeshBasicMaterial({ color: 0xe7c565, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.068, 48), gold);
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 32), gold);
  const spokes = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.11), gold);
  const spokes2 = spokes.clone();
  spokes2.rotation.z = Math.PI / 2;
  for (const m of [ring, inner, spokes, spokes2]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  spokes.rotation.set(-Math.PI / 2, 0, 0);
  spokes2.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  g.matrixAutoUpdate = true;
  return g;
}

export class WebXRMode {
  constructor(app) {
    this.app = app;
    this.name = 'webxr';
    this.label = 'WebXR';
    this.session = null;
    this.hitSource = null;
    this.transientSource = null;
    this.reticle = makeReticle();
    this.reticle.visible = false;
    app.scene.add(this.reticle);
    this.hasHit = false;
    this.hitPos = new THREE.Vector3();
    this.lastTouchHit = { pos: new THREE.Vector3(), time: -1 };
    this.xrLight = null;
    this._ending = false;
    this.anchor = null;          // ancora dell'arena
    this.anchorRequest = false;  // ancora da creare al prossimo frame
    this.anchorTarget = new THREE.Vector3();
    this.supportsAnchors = false;
  }

  static async isSupported() {
    if (!('xr' in navigator) || !navigator.xr) return false;
    try { return await navigator.xr.isSessionSupported('immersive-ar'); } catch { return false; }
  }

  get camera() {
    const xr = this.app.renderer.xr;
    return xr.isPresenting ? xr.getCamera() : this.app.camera;
  }

  async start() {
    const { app } = this;
    const overlay = document.getElementById('hud');
    overlay.classList.remove('hidden');
    const init = {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'light-estimation', 'anchors', 'local-floor'],
      domOverlay: { root: overlay },
    };
    const session = await navigator.xr.requestSession('immersive-ar', init);
    this.session = session;
    this._ending = false;
    // local-floor tiene l'origine sul pavimento: meno deriva verticale del piano.
    app.renderer.xr.setReferenceSpaceType(
      (session.enabledFeatures && session.enabledFeatures.includes('local-floor')) ? 'local-floor' : 'local',
    );
    app.renderer.xr.setFramebufferScaleFactor(app.settings.hd ? 1.4 : 1.0);
    await app.renderer.xr.setSession(session);

    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitSource = await session.requestHitTestSource({ space: viewerSpace });
    try {
      this.transientSource = await session.requestHitTestSourceForTransientInput({ profile: 'generic-touchscreen' });
    } catch { this.transientSource = null; }

    this.supportsAnchors = !!(session.enabledFeatures && session.enabledFeatures.includes('anchors'));
    session.addEventListener('end', () => this._onEnd());

    // Stima della luce reale (se disponibile): ambiente + direzione del sole per le ombre
    try {
      const xrLight = new XREstimatedLight(app.renderer);
      xrLight.addEventListener('estimationstart', () => {
        app.scene.add(xrLight);
        if (xrLight.environment) app.setEnvironment(xrLight.environment);
        app.hemi.intensity = 0.15;
        this.xrLight = xrLight;
      });
      xrLight.addEventListener('estimationend', () => {
        app.scene.remove(xrLight);
        app.setEnvironment(null);
        app.hemi.intensity = 0.6;
        this.xrLight = null;
      });
      this._xrLightObj = xrLight;
    } catch (e) {
      console.warn('[WebXR] light estimation non disponibile', e);
    }
  }

  async stop() {
    this.reticle.visible = false;
    if (this.session) {
      const s = this.session;
      this._ending = true;
      try { await s.end(); } catch { /* già chiusa */ }
    }
    this._cleanup();
  }

  _cleanup() {
    if (this.anchor && this.anchor.delete) { try { this.anchor.delete(); } catch { /* già rimossa */ } }
    this.anchor = null;
    this.anchorRequest = false;
    this.session = null;
    this.hitSource = null;
    this.transientSource = null;
    this.hasHit = false;
    if (this.xrLight) { this.app.scene.remove(this.xrLight); this.xrLight = null; this.app.setEnvironment(null); this.app.hemi.intensity = 0.6; }
    if (this._xrLightObj && this._xrLightObj.dispose) { try { this._xrLightObj.dispose(); } catch { /* ok */ } }
    this._xrLightObj = null;
  }

  _onEnd() {
    const userEnded = !this._ending;
    this._cleanup();
    if (userEnded) this.app.onExternalSessionEnd(this);
  }

  update(dt, frame) {
    if (!frame || !this.session) return;
    const refSpace = this.app.renderer.xr.getReferenceSpace();
    if (!refSpace) return;

    // 1) L'ancora tiene l'arena ferma su un punto reale anche se il tracciamento corregge la deriva.
    if (this.anchor) {
      const pose = frame.getPose(this.anchor.anchorSpace, refSpace);
      if (pose) {
        const p = pose.transform.position;
        this.app.setArenaOrigin(_anchorVec.set(p.x, p.y, p.z));
      }
    }

    let firstResult = null;
    if (this.hitSource) {
      const results = frame.getHitTestResults(this.hitSource);
      firstResult = results.length ? results[0] : null;
      const pose = firstResult ? firstResult.getPose(refSpace) : null;
      if (pose) {
        this.reticle.matrix.fromArray(pose.transform.matrix);
        this.reticle.matrix.decompose(this.reticle.position, this.reticle.quaternion, this.reticle.scale);
        this.hitPos.copy(this.reticle.position);
        this.hasHit = true;
        this.reticle.visible = !this.app.fight.active;
        const s = THREE.MathUtils.clamp(this.app.settings.defaultHeight * 1.6, 0.6, 12);
        this.reticle.scale.setScalar(s);
      } else {
        this.hasHit = false;
        this.reticle.visible = false;
      }
    }

    // 2) Creazione dell'ancora: va fatta dentro il frame in cui esiste il risultato dell'hit test.
    if (this.anchorRequest && !this.anchor) {
      this.anchorRequest = false;
      this._createAnchor(frame, refSpace, firstResult);
    }

    if (this.transientSource) {
      const list = frame.getHitTestResultsForTransientInput(this.transientSource);
      for (const r of list) {
        if (!r.results.length) continue;
        const pose = r.results[0].getPose(refSpace);
        if (pose) {
          const p = pose.transform.position;
          this.lastTouchHit.pos.set(p.x, p.y, p.z);
          this.lastTouchHit.time = performance.now();
        }
      }
    }
    if (this.xrLight && this.xrLight.directionalLight) {
      this.app.setSunDirection(this.xrLight.directionalLight.position);
      // stanza buia → ombra di contatto più tenue, come per gli oggetti veri
      const lit = THREE.MathUtils.clamp(this.xrLight.directionalLight.intensity / 2.2, 0, 1);
      this.app.shadowStrength = 0.45 + lit * 0.65;
    }
  }

  /** Aggancia l'arena al punto toccato: da qui in poi il tracciamento la tiene ferma. */
  _createAnchor(frame, refSpace, hitResult) {
    if (!this.supportsAnchors) return;
    const target = this.anchorTarget;
    const finish = (anchor) => {
      if (!anchor || !this.session) return;
      this.anchor = anchor;
      this.app.toast('Ancorato al tavolo');
    };
    try {
      if (hitResult && hitResult.createAnchor) {
        hitResult.createAnchor().then(finish).catch(() => {});
        return;
      }
      if (frame.createAnchor) {
        const t = new XRRigidTransform({ x: target.x, y: target.y, z: target.z });
        frame.createAnchor(t, refSpace).then(finish).catch(() => {});
      }
    } catch { /* ancore non disponibili: resta il tracciamento normale */ }
  }

  /** Richiede l'ancoraggio dell'arena al punto indicato (creata al prossimo frame). */
  requestAnchor(worldPosition) {
    if (this.anchor || !this.supportsAnchors) return;
    this.anchorTarget.copy(worldPosition);
    this.anchorRequest = true;
  }

  placeFromScreen(x, y) {
    if (performance.now() - this.lastTouchHit.time < 600) return this.lastTouchHit.pos.clone();
    if (this.hasHit) {
      return this.groundPointFromScreen(x, y, this.hitPos.y) || this.hitPos.clone();
    }
    this.app.toast('Muovi lentamente il telefono finché appare il sigillo dorato sul tavolo');
    return null;
  }
  groundPointFromScreen(x, y, planeY) {
    return rayPlaneY(this.app.screenRay(x, y), planeY, new THREE.Vector3());
  }
}
