// Sistema di combattimento "tutti contro tutti": ogni boss cerca il nemico vivo più vicino,
// si avvicina, attacca quando è a portata, subisce contraccolpi e muore con dissolvenza.
import { Rng } from '../util/rng.js';
import { dampAngle } from '../util/math.js';

export class FightSystem {
  constructor(hooks = {}) {
    this.hooks = hooks; // onSwing(a), onHit(a,t,dmg,crit), onMiss(a), onVictory(winner), onDeath(b)
    this.active = false;
    this.fighters = [];
    this.winner = null;
    this.elapsed = 0;
    this.rng = new Rng();
  }

  start(bosses, seed) {
    const list = bosses.filter((b) => b.root.visible);
    if (list.length < 2) return false;
    this.rng = new Rng(seed == null ? Date.now() >>> 0 : seed);
    this.fighters = list;
    this.active = true;
    this.winner = null;
    this.elapsed = 0;
    for (const b of list) {
      b.resetFight();
      b.hpBar.sprite.visible = true;
      b.fight.state = 'seek';
      b.fight.cooldown = this.rng.range(0.2, 1.0);
    }
    return true;
  }

  stop() {
    this.active = false;
    for (const b of this.fighters) {
      b.hpBar.sprite.visible = false;
      if (b.alive) { b.fight.state = 'idle'; b.play('idle'); }
    }
    this.fighters = [];
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    const alive = this.fighters.filter((b) => b.alive);
    if (alive.length <= 1) {
      this.active = false;
      this.winner = alive[0] || null;
      if (this.winner) {
        this.winner.fight.state = 'idle';
        this.winner.hpBar.sprite.visible = false;
        this.winner.play(this.winner.actions.victory ? 'victory' : 'idle', { loop: !this.winner.actions.victory, fade: 0.2 });
      }
      this.hooks.onVictory && this.hooks.onVictory(this.winner);
      return;
    }
    for (const a of alive) this._updateFighter(a, alive, dt);
    this._separate(alive);
  }

  _nearest(a, alive) {
    let best = null, bestD = Infinity;
    for (const b of alive) {
      if (b === a) continue;
      const d = a.root.position.distanceToSquared(b.root.position);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  _updateFighter(a, alive, dt) {
    const f = a.fight;
    if (!f.target || !f.target.alive) f.target = this._nearest(a, alive);
    const t = f.target;
    if (!t) return;

    const dx = t.root.position.x - a.root.position.x;
    const dz = t.root.position.z - a.root.position.z;
    const dist = Math.max(1e-4, Math.hypot(dx, dz));
    const reach = a.stats.range * a.height + t.bodyRadius * t.height;
    const desiredYaw = Math.atan2(dx, dz);
    a.root.rotation.y = dampAngle(a.root.rotation.y, desiredYaw, f.state === 'attack' ? 3 : 9, dt);
    f.cooldown -= dt;

    switch (f.state) {
      case 'seek': {
        if (dist > reach) {
          const speed = a.stats.speed * a.height; // m/s
          const step = Math.min(speed * dt, dist - reach * 0.85);
          a.root.position.x += (dx / dist) * step;
          a.root.position.z += (dz / dist) * step;
          a.play('walk', { timeScale: Math.max(0.6, a.stats.speed / 0.5) });
        } else {
          a.play('idle');
          if (f.cooldown <= 0) this._startAttack(a);
        }
        break;
      }
      case 'attack': {
        f.attackTimer += dt;
        if (!f.hitApplied && f.attackTimer >= f.attackDuration * f.hitTime) {
          f.hitApplied = true;
          if (t.alive && dist <= reach * 1.4) {
            const crit = this.rng.chance(0.12);
            const dmg = a.stats.attack * this.rng.range(0.8, 1.25) * (crit ? 1.8 : 1);
            const wasAlive = t.alive;
            t.takeDamage(dmg);
            this.hooks.onHit && this.hooks.onHit(a, t, dmg, crit);
            if (wasAlive && !t.alive) this.hooks.onDeath && this.hooks.onDeath(t, a);
            if (t.alive && t.fight.state !== 'attack' && t.actions.hit) {
              t.play('hit', { loop: false, fade: 0.05 });
              t.fight.state = 'stagger';
              t.fight.staggerTimer = 0.45;
            }
          } else {
            this.hooks.onMiss && this.hooks.onMiss(a);
          }
        }
        if (f.attackTimer >= f.attackDuration) {
          f.state = 'seek';
          f.cooldown = a.stats.cooldown * this.rng.range(0.75, 1.3);
          a.play('idle');
        }
        break;
      }
      case 'stagger': {
        f.staggerTimer -= dt;
        if (f.staggerTimer <= 0) { f.state = 'seek'; a.play('idle'); }
        break;
      }
      default:
        break;
    }
  }

  _startAttack(a) {
    const f = a.fight;
    const action = a.play('attack', { loop: false, fade: 0.1 });
    const clip = action ? action.getClip() : null;
    f.state = 'attack';
    f.attackTimer = 0;
    f.hitApplied = false;
    f.attackDuration = clip ? Math.max(0.3, clip.duration) : 1.0;
    f.hitTime = clip ? a.hitTimeFor(clip.name) : 0.45;
    this.hooks.onSwing && this.hooks.onSwing(a);
  }

  _separate(alive) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.root.position.x - a.root.position.x;
        const dz = b.root.position.z - a.root.position.z;
        const d = Math.hypot(dx, dz);
        const min = (a.bodyRadius * a.height + b.bodyRadius * b.height) * 0.95;
        if (d < min && d > 1e-5) {
          const push = (min - d) / 2;
          a.root.position.x -= (dx / d) * push; a.root.position.z -= (dz / d) * push;
          b.root.position.x += (dx / d) * push; b.root.position.z += (dz / d) * push;
        }
      }
    }
  }
}
