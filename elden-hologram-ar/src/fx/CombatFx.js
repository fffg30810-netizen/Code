// Effetti visivi del combattimento: scie di lama, onde d'urto, telegrafi a terra,
// proiettili, meteora, fiore del marciume, attrazione gravitazionale.
// Tutte le dimensioni sono moltiplicate per l'altezza del boss, così gli effetti
// restano proporzionati sia a 20 cm sul tavolo sia a scala reale.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 0, 1);

function additive(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export class CombatFx {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./Particles.js').Particles} particles
   */
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.items = [];
    this.geo = {
      arc: new THREE.TorusGeometry(1, 0.075, 8, 40, Math.PI * 0.85),
      arcWide: new THREE.TorusGeometry(1, 0.09, 8, 56, Math.PI * 1.6),
      ring: new THREE.RingGeometry(0.82, 1, 64),
      thinRing: new THREE.RingGeometry(0.955, 1, 72),
      disc: new THREE.CircleGeometry(1, 48),
      sphere: new THREE.SphereGeometry(1, 16, 12),
      box: new THREE.BoxGeometry(1, 1, 1),
      cone: new THREE.ConeGeometry(1, 2, 12),
    };
  }

  _add(mesh, life, update) {
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.items.push({ mesh, t: 0, life, update });
    return mesh;
  }

  /**
   * Arco di lama: la spazzata attorno al boss, leggibile da qualsiasi angolo.
   * `tilt` è l'inclinazione del piano su cui corre la lama: quasi orizzontale per
   * una spazzata, ripida per un diagonale, rovesciata per una risalita. `flip`
   * esegue lo stesso arco dall'altro lato, per i colpi specchiati.
   */
  slashArc(boss, { color = 0xfff0c0, wide = false, thin = false, life = 0.32, tilt = null, flip = 1, yawOffset = null, rise = 0 } = {}) {
    const h = boss.height;
    const m = new THREE.Mesh(wide ? this.geo.arcWide : this.geo.arc, additive(color, 1));
    const r = (wide ? 0.88 : thin ? 0.6 : 0.74) * h;
    m.scale.set(r, r, (thin ? 0.7 : 1.1) * h);
    boss.chestPosition(_v);
    m.position.copy(_v).add(_v2.set(0, (-0.05 + rise) * h, 0));
    const pitch = tilt != null ? tilt : (wide ? 0.12 : 0.42);
    const yaw = yawOffset != null ? yawOffset : (wide ? 0 : -0.35);
    m.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - pitch * flip, boss.yaw + yaw * flip, 0, 'YXZ'));
    const s0 = m.scale.clone();
    const spin = (wide ? 3.0 : 1.8) * 0.016 * flip;
    return this._add(m, life, (it, k) => {
      it.mesh.scale.copy(s0).multiplyScalar(1 + k * (wide ? 0.35 : 0.22));
      it.mesh.material.opacity = (1 - k) ** 1.3;
      it.mesh.rotateOnAxis(_axisY, spin);
    });
  }

  /**
   * Lampo dell'urto: il bagliore breve nel punto esatto in cui la lama tocca.
   * Senza, un colpo che arriva è solo una barra vita che cala.
   * @param {THREE.Vector3} point punto di contatto (coordinate arena)
   * @param {number} height altezza del bersaglio
   */
  impactFlash(point, height, { color = 0xfff2c0, scale = 1, life = 0.16 } = {}) {
    const m = new THREE.Mesh(this.geo.sphere, additive(color, 1));
    const r = 0.085 * height * scale;
    m.position.copy(point);
    m.scale.setScalar(r);
    return this._add(m, life, (it, k) => {
      const s = r * (0.55 + k * 2.1);
      it.mesh.scale.set(s, s * 0.72, s);
      it.mesh.material.opacity = (1 - k) ** 2;
    });
  }

  /**
   * Segno del taglio: l'arco sottile che resta un istante dove la lama è
   * passata sul corpo. Orientato come il fendente, non come il bersaglio.
   */
  slashMark(point, height, yaw, { color = 0xffffff, scale = 1, life = 0.18, tilt = 0.6 } = {}) {
    const m = new THREE.Mesh(this.geo.arc, additive(color, 1));
    const r = 0.26 * height * scale;
    m.position.copy(point);
    m.scale.set(r, r, 0.28 * height * scale);
    m.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - tilt, yaw, 0, 'YXZ'));
    return this._add(m, life, (it, k) => {
      it.mesh.material.opacity = (1 - k) ** 1.6;
      it.mesh.scale.z = 0.28 * height * scale * (1 + k * 0.8);
    });
  }

  /** Bagliore di affondo lungo l'asse frontale. */
  thrustBeam(boss, { color = 0xfff0c0, life = 0.22 } = {}) {
    const h = boss.height;
    const m = new THREE.Mesh(this.geo.cone, additive(color, 0.8));
    boss.chestPosition(_v);
    m.position.copy(_v).add(_v2.set(Math.sin(boss.yaw), 0, Math.cos(boss.yaw)).multiplyScalar(0.5 * h));
    m.scale.set(0.09 * h, 0.55 * h, 0.09 * h);
    m.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, boss.yaw, 0, 'YXZ'));
    return this._add(m, life, (it, k) => { it.mesh.material.opacity = 0.8 * (1 - k); it.mesh.scale.y = 0.55 * h * (1 + k * 0.6); });
  }

  /** Onda d'urto a terra. */
  shockwave(position, height, { color = 0xffd08a, radius = 1.6, life = 0.5 } = {}) {
    radius = Math.min(radius, 2.0);
    const m = new THREE.Mesh(this.geo.ring, additive(color, 0.7));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(position).add(_v.set(0, 0.004 * height, 0));
    const R = radius * height;
    return this._add(m, life, (it, k) => {
      const s = R * (0.15 + k * 0.85);
      it.mesh.scale.set(s, s, 1);
      it.mesh.material.opacity = 0.7 * (1 - k) ** 1.4;
    });
  }

  /** Cerchio di preavviso: anello sottile che si chiude mentre la mossa carica. */
  telegraph(position, height, { color = 0xff5a3c, radius = 1.4, life = 0.7 } = {}) {
    const g = new THREE.Group();
    const R = Math.min(radius, 1.25) * height;
    const outline = new THREE.Mesh(this.geo.thinRing, additive(color, 0.6));
    outline.rotation.x = -Math.PI / 2;
    outline.scale.set(R, R, 1);
    const sweep = new THREE.Mesh(this.geo.thinRing, additive(color, 0.5));
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.y = 0.001 * height;
    g.add(outline, sweep);
    g.position.copy(position).add(_v.set(0, 0.003 * height, 0));
    return this._add(g, life, (it, k) => {
      const s = R * (0.12 + 0.88 * k);
      sweep.scale.set(s, s, 1);
      outline.material.opacity = 0.6 * (0.45 + 0.55 * Math.sin(k * Math.PI * 5) ** 2) * (1 - k * 0.3);
      sweep.material.opacity = 0.5 * (1 - k * 0.35);
      if (k > 0.97) { outline.material.opacity = 0; sweep.material.opacity = 0; }
    });
  }

  /** Aura di carica attorno al boss (preavviso delle mosse speciali). */
  chargeAura(boss, { color = 0xffd166, life = 0.8 } = {}) {
    const h = boss.height;
    const m = new THREE.Mesh(this.geo.sphere, additive(color, 0.25));
    m.material.side = THREE.BackSide;
    return this._add(m, life, (it, k) => {
      boss.chestPosition(_v);
      it.mesh.position.copy(_v);
      const s = (0.45 + 0.25 * Math.sin(k * Math.PI * 8)) * h * (1 - k * 0.3);
      it.mesh.scale.setScalar(s);
      it.mesh.material.opacity = 0.28 * (1 - k);
      if (Math.random() < 0.6) {
        this.particles.burst({ position: _v, color, count: 2, speed: 0.35 * h, life: 0.5, size: 0.02 * h, gravity: -0.5 * h, up: 0.2 });
      }
    });
  }

  /** Raffica della Danza dei Trampolieri: scie multiple attorno al bersaglio. */
  flurry(boss, { color = 0xffe9b0, life = 0.3 } = {}) {
    this.slashArc(boss, { color, thin: true, life });
    const h = boss.height;
    boss.chestPosition(_v);
    this.particles.burst({ position: _v, color, count: 10, speed: 1.1 * h, life: 0.35, size: 0.016 * h, gravity: 0.2 * h, up: 0.2, spread: 1.4 });
  }

  /** Fiore del marciume scarlatto: anelli concentrici + nube persistente. */
  aeonia(position, height, { life = 1.4 } = {}) {
    const R = 1.35 * height;
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(this.geo.thinRing, additive(i === 0 ? 0xffd7d0 : 0xc0392b, 0.7));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(position).add(_v.set(0, (0.004 + i * 0.002) * height, 0));
      const delay = i * 0.12;
      this._add(m, life, (it, k) => {
        const kk = Math.max(0, (k * life - delay) / (life - delay));
        const s = R * (0.1 + kk * (1 + i * 0.25));
        it.mesh.scale.set(s, s, 1);
        it.mesh.material.opacity = 0.7 * (1 - kk) ** 1.3;
      });
    }
    // petali
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(this.geo.cone, additive(0xc0392b, 0.7));
      petal.position.copy(position);
      this._add(petal, life * 0.8, (it, k) => {
        const s = height * (0.2 + k * 0.5);
        it.mesh.scale.set(s * 0.35, s, s * 0.35);
        it.mesh.position.copy(position).add(_v.set(Math.cos(a), 0.15, Math.sin(a)).multiplyScalar(height * (0.3 + k * 1.3)));
        it.mesh.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - 0.4, -a + Math.PI / 2, 0, 'YXZ'));
        it.mesh.material.opacity = 0.7 * (1 - k) ** 1.2;
      });
    }
    this.particles.burst({ position, color: 0xc0392b, count: 90, speed: 1.4 * height, life: 1.5, size: 0.03 * height, gravity: 0.15 * height, up: 0.7, spread: 1.6 });
    this.particles.burst({ position, color: 0xff7b6b, count: 40, speed: 0.7 * height, life: 2.0, size: 0.024 * height, gravity: -0.05 * height, up: 1.0 });
  }

  /** Scia di marciume dietro a chi si muove. */
  rotTrail(boss) {
    const h = boss.height;
    boss.chestPosition(_v);
    this.particles.burst({ position: _v, color: 0xc0392b, count: 4, speed: 0.25 * h, life: 0.7, size: 0.022 * h, gravity: 0.1 * h, up: 0.2 });
  }

  /** Attrazione gravitazionale: anello che si stringe verso chi lancia. */
  gravity(from, to, height, { life = 0.6 } = {}) {
    const m = new THREE.Mesh(this.geo.ring, additive(0x8e6bd0, 0.8));
    m.rotation.x = -Math.PI / 2;
    const R = 2.2 * height;
    return this._add(m, life, (it, k) => {
      it.mesh.position.copy(to).lerp(from, k * 0.6).add(_v.set(0, 0.01 * height, 0));
      const s = R * (1 - k * 0.8);
      it.mesh.scale.set(s, s, 1);
      it.mesh.material.opacity = 0.8 * (1 - k * 0.5);
      if (Math.random() < 0.8) {
        _v2.copy(to).add(_v.set((Math.random() - 0.5) * 2, Math.random() * 0.8, (Math.random() - 0.5) * 2).multiplyScalar(height));
        this.particles.burst({ position: _v2, color: 0x8e6bd0, count: 2, speed: 0.3 * height, life: 0.4, size: 0.02 * height, gravity: -0.2 * height, up: 0 });
      }
    });
  }

  /** Polvere sollevata da una carica. */
  dust(position, height, count = 8) {
    this.particles.burst({ position, color: 0xbda37a, count, speed: 0.5 * height, life: 0.6, size: 0.025 * height, gravity: 0.8 * height, up: 0.5 });
  }

  /** Meteora: corpo che cade dall'alto e impatta. */
  meteor(position, height, { life = 1.0, onImpact } = {}) {
    const m = new THREE.Mesh(this.geo.sphere, additive(0xff7b2a, 0.95));
    const core = new THREE.Mesh(this.geo.sphere, additive(0xfff0c0, 0.9));
    core.scale.setScalar(0.55);
    m.add(core);
    const start = position.clone().add(_v.set(0, 3.2 * height, 0));
    let impacted = false;
    return this._add(m, life, (it, k) => {
      const kk = Math.min(1, k / 0.7);
      it.mesh.position.copy(start).lerp(position, kk * kk);
      const s = height * (0.5 + 0.2 * Math.sin(k * 30));
      it.mesh.scale.setScalar(s * (1 - kk * 0.3));
      it.mesh.material.opacity = kk < 1 ? 0.95 : 0.4 * (1 - (k - 0.7) / 0.3);
      if (kk < 1 && Math.random() < 0.9) {
        this.particles.burst({ position: it.mesh.position, color: 0xff9a2a, count: 4, speed: 0.8 * height, life: 0.5, size: 0.03 * height, gravity: -0.4 * height, up: 0.6 });
      }
      if (!impacted && kk >= 1) {
        impacted = true;
        this.shockwave(position, height, { color: 0xff7b2a, radius: 3.2, life: 0.7 });
        this.shockwave(position, height, { color: 0xffd08a, radius: 2.2, life: 0.5 });
        this.particles.burst({ position, color: 0xff7b2a, count: 110, speed: 2.0 * height, life: 1.1, size: 0.035 * height, gravity: 1.4 * height, up: 0.9, spread: 1.5 });
        if (onImpact) onImpact();
      }
    });
  }

  /** Martello di luce che cala sul bersaglio. */
  lightHammer(position, height, { life = 0.75, color = 0xffe08a } = {}) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(this.geo.box, additive(color, 0.85));
    head.scale.set(1.15 * height, 0.55 * height, 0.55 * height);
    const haft = new THREE.Mesh(this.geo.box, additive(color, 0.6));
    haft.scale.set(0.11 * height, 1.6 * height, 0.11 * height);
    haft.position.y = 1.05 * height;
    g.add(head, haft);
    const top = position.clone().add(_v.set(0, 1.7 * height, 0));
    let hit = false;
    return this._add(g, life, (it, k) => {
      const kk = Math.min(1, k / 0.55);
      it.mesh.position.copy(top).lerp(position, kk * kk);
      it.mesh.rotation.y = k * 1.2;
      head.material.opacity = 0.75 * (kk < 1 ? 1 : 1 - (k - 0.55) / 0.45);
      haft.material.opacity = 0.55 * (kk < 1 ? 1 : 1 - (k - 0.55) / 0.45);
      if (!hit && kk >= 1) {
        hit = true;
        this.shockwave(position, height, { color, radius: 1.8, life: 0.5 });
        this.particles.burst({ position, color, count: 50, speed: 1.2 * height, life: 0.7, size: 0.028 * height, gravity: 1.2 * height, up: 0.7 });
      }
    });
  }

  /**
   * Proiettile che viaggia verso il bersaglio; chiama onArrive all'impatto.
   * Restituisce l'oggetto in volo, così il combattimento può seguirlo.
   */
  projectile(from, to, height, { color = 0xffd166, speed = 5.5, onArrive } = {}) {
    const m = new THREE.Mesh(this.geo.cone, additive(color, 0.95));
    m.scale.set(0.06 * height, 0.24 * height, 0.06 * height);
    m.position.copy(from);
    const dist = from.distanceTo(to);
    const life = Math.max(0.12, dist / (speed * height));
    const dir = _v.copy(to).sub(from).normalize().clone();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    let done = false;
    return this._add(m, life, (it, k) => {
      it.mesh.position.copy(from).lerp(to, k);
      if (Math.random() < 0.7) {
        this.particles.burst({ position: it.mesh.position, color, count: 2, speed: 0.2 * height, life: 0.3, size: 0.016 * height, gravity: 0.2 * height, up: 0 });
      }
      if (!done && k > 0.985) {
        done = true;
        this.particles.burst({ position: to, color, count: 24, speed: 0.9 * height, life: 0.5, size: 0.022 * height, gravity: 1.0 * height, up: 0.5 });
        if (onArrive) onArrive();
      }
    });
  }

  /** Scintille di assorbimento vitale, dal bersaglio verso chi colpisce. */
  lifesteal(from, to, height) {
    const m = new THREE.Mesh(this.geo.sphere, additive(0xffd166, 0.9));
    return this._add(m, 0.45, (it, k) => {
      it.mesh.position.copy(from).lerp(to, k * k);
      it.mesh.scale.setScalar(height * 0.06 * (1 - k * 0.5));
      it.mesh.material.opacity = 0.9 * (1 - k);
      this.particles.burst({ position: it.mesh.position, color: 0xffd166, count: 2, speed: 0.15 * height, life: 0.3, size: 0.014 * height, gravity: -0.3 * height, up: 0.4 });
    });
  }

  /** Esplosione dorata del passaggio alla seconda fase. */
  phaseBurst(boss) {
    const h = boss.height;
    boss.chestPosition(_v);
    const pos = _v.clone();
    this.shockwave(boss.root.position, h, { color: 0xffd166, radius: 3.0, life: 0.8 });
    this.shockwave(boss.root.position, h, { color: 0xfff3d0, radius: 2.0, life: 0.6 });
    this.particles.burst({ position: pos, color: 0xffd166, count: 140, speed: 1.8 * h, life: 1.4, size: 0.032 * h, gravity: -0.2 * h, up: 1.0, spread: 1.6 });
    const m = new THREE.Mesh(this.geo.sphere, additive(0xffd166, 0.5));
    m.material.side = THREE.BackSide;
    this._add(m, 0.9, (it, k) => {
      it.mesh.position.copy(pos);
      it.mesh.scale.setScalar(h * (0.3 + k * 2.2));
      it.mesh.material.opacity = 0.5 * (1 - k) ** 2;
    });
  }

  /** Parata: scintille sul punto di contatto. */
  guard(position, height) {
    this.particles.burst({ position, color: 0xfff0c0, count: 18, speed: 1.0 * height, life: 0.35, size: 0.018 * height, gravity: 1.5 * height, up: 0.4 });
    const m = new THREE.Mesh(this.geo.ring, additive(0xfff0c0, 0.8));
    m.position.copy(position);
    this._add(m, 0.24, (it, k) => {
      it.mesh.lookAt(0, position.y, 0);
      const s = height * 0.3 * (0.4 + k);
      it.mesh.scale.set(s, s, 1);
      it.mesh.material.opacity = 0.8 * (1 - k);
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      if (it.update) it.update(it, k);
      if (it.t >= it.life) {
        this.scene.remove(it.mesh);
        it.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.dispose) o.material.dispose(); });
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      it.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.dispose) o.material.dispose(); });
    }
    this.items.length = 0;
  }
}
