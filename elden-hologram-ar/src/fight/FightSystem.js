// Combattimento fra boss: macchina a stati con preparazione leggibile (telegrafo),
// finestra di danno, scopertura, schivate, parate, rottura della posa (poise),
// seconda fase sotto metà vita e mosse speciali con i loro effetti.
//
// Ciclo di una mossa:  scelta → windup (telegrafo) → active (danno) → recovery
// Durante windup e active il corpo può spostarsi (dash) verso il bersaglio.
import { Rng } from '../util/rng.js';
import { dampAngle, clamp } from '../util/math.js';
import { movesetFor, moveDuration } from './Movesets.js';

const STRAFE_TIME = [0.5, 1.4];

export class FightSystem {
  /**
   * @param {object} hooks onMoveStart, onTelegraph, onActive, onHit, onEvade,
   *                       onGuard, onStagger, onPhase2, onDeath, onVictory,
   *                       onProjectile, onPull, onLifesteal
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.active = false;
    this.fighters = [];
    this.winner = null;
    this.elapsed = 0;
    this.rng = new Rng();
    this.pending = [];   // colpi differiti (proiettili in volo)
  }

  start(bosses, seed) {
    const list = bosses.filter((b) => b.root.visible);
    if (list.length < 2) return false;
    this.rng = new Rng(seed == null ? Date.now() >>> 0 : seed);
    this.fighters = list;
    this.active = true;
    this.winner = null;
    this.elapsed = 0;
    this.pending.length = 0;
    for (const b of list) {
      b.resetFight();
      b.hpBar.sprite.visible = true;
      b.moveset = movesetFor(b.def);
      const f = b.fight;
      f.state = 'approach';
      f.move = null;
      f.moveTime = 0;
      f.hitsDone = 0;
      f.cooldowns = {};
      f.maxPoise = 3 + (b.stats.hp / 60) * (b.moveset.traits.poiseArmor || 1);
      f.poise = f.maxPoise;
      f.staggerTimer = 0;
      f.phase = 1;
      f.decision = this.rng.range(0.2, 0.9);
      f.strafeDir = this.rng.chance(0.5) ? 1 : -1;
      f.strafeTimer = this.rng.range(...STRAFE_TIME);
      f.comboLeft = 0;
      f.comboNext = null;
      f.timing = null;
      f.motion = null;
      f.mirror = false;
      f.feintAt = 0;
      f.justFeinted = false;
      f.inCombo = false;
    }
    return true;
  }

  stop() {
    this.active = false;
    this.pending.length = 0;
    for (const b of this.fighters) {
      b.hpBar.sprite.visible = false;
      b.trail.clear();
      if (b.alive) { b.fight.state = 'idle'; b.play('idle'); }
    }
    this.fighters = [];
  }

  // ------------------------------------------------------------------ loop
  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); p.run(); }
    }

    const alive = this.fighters.filter((b) => b.alive);
    if (alive.length <= 1) return this._finish(alive[0] || null);
    for (const b of alive) this._updateFighter(b, alive, dt);
    this._separate(alive);
  }

  _finish(winner) {
    this.active = false;
    this.winner = winner;
    if (winner) {
      winner.fight.state = 'idle';
      winner.hpBar.sprite.visible = false;
      const hasVictory = winner.hasAnimation('victory');
      winner.play(hasVictory ? 'victory' : 'idle', { loop: !hasVictory, fade: 0.2 });
    }
    this.hooks.onVictory && this.hooks.onVictory(winner);
  }

  // ------------------------------------------------------------- decisioni
  _nearest(a, alive) {
    let best = null, bestD = Infinity;
    for (const b of alive) {
      if (b === a) continue;
      const d = a.root.position.distanceToSquared(b.root.position);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /** Distanza fra i due corpi in "altezze dell'attaccante". */
  _gap(a, t) {
    const d = Math.hypot(t.root.position.x - a.root.position.x, t.root.position.z - a.root.position.z);
    const surface = d - (a.bodyRadius * a.height + t.bodyRadius * t.height);
    return { dist: d, reach: Math.max(0, surface) / a.height };
  }

  _availableMoves(a) {
    const f = a.fight;
    const all = f.phase >= 2 ? a.moveset.moves.concat(a.moveset.phase2) : a.moveset.moves;
    return all.filter((m) => !(f.cooldowns[m.id] > 0));
  }

  /** Il bersaglio è scoperto? A terra o in barcollamento non può difendersi. */
  _punishable(t) {
    return t.fight.state === 'down' || t.fight.state === 'stagger';
  }

  _pickMove(a, t) {
    const f = a.fight;
    if (f.comboNext) {
      const next = this._availableMoves(a).find((m) => m.id === f.comboNext);
      f.comboNext = null;
      if (next) return next;
    }
    const { reach } = this._gap(a, t);
    const usable = this._availableMoves(a).filter((m) => m.kind !== 'evade' && reach >= m.range[0] && reach <= m.range[1]);
    if (!usable.length) return null;
    // Finestra di punizione: con l'avversario a terra si sceglie il colpo che fa
    // più male, non quello veloce. È così che si legge uno scontro vero.
    const punish = this._punishable(t);
    const weightOf = (m) => (m.weight || 1) * (punish ? 0.4 + (m.damage || 1) * (m.poise || 1) : 1);
    let total = 0;
    for (const m of usable) total += weightOf(m);
    let r = this.rng.next() * total;
    for (const m of usable) { r -= weightOf(m); if (r <= 0) return m; }
    return usable[usable.length - 1];
  }

  /**
   * Tempi della singola esecuzione. Due colpi identici sulla carta non devono
   * arrivare con lo stesso ritmo: chi guarda deve leggere il colpo, non
   * memorizzare un metronomo.
   */
  _timingFor(move) {
    const j = this.rng.range(0.88, 1.14);
    let windup = move.windup * j;
    const active = move.active * this.rng.range(0.92, 1.1);
    // preparazione lunga → recupero più corto, e viceversa: il totale resta leggibile
    const recovery = move.recovery * (2 - j) * this.rng.range(0.95, 1.08);
    // Colpo trattenuto: ogni tanto l'arma resta ferma in alto un istante di
    // troppo. È la firma dei boss di Elden Ring, quella che punisce chi schiva
    // a memoria, e rende illeggibile il ritmo a chi guarda.
    const hold = move.kind === 'melee' && this.rng.chance(0.24);
    if (hold) windup *= this.rng.range(1.5, 2.1);
    return { windup, active, recovery, hold, total: windup + active + recovery };
  }

  /** Sceglie la primitiva di questa esecuzione fra le varianti della mossa. */
  _motionFor(move) {
    const list = move.variants && move.variants.length ? move.variants : [move.motion];
    return list[Math.floor(this.rng.next() * list.length)];
  }

  _startMove(a, t, move) {
    const f = a.fight;
    f.move = move;
    f.moveTime = 0;
    f.hitsDone = 0;
    f.state = 'windup';
    f.target = t;
    f.timing = this._timingFor(move);
    // Dentro una catena il colpo successivo parte già caricato: è il ritmo
    // accelerato delle combo, non due attacchi separati appiccicati.
    if (f.inCombo) {
      f.inCombo = false;
      f.timing.hold = false;
      f.timing.windup *= 0.62;
      f.timing.recovery *= 0.9;
      f.timing.total = f.timing.windup + f.timing.active + f.timing.recovery;
    }
    f.motion = this._motionFor(move);
    // specchiata: lo stesso colpo eseguito dall'altro lato
    f.mirror = move.mirror !== false && this.rng.chance(0.42);
    // Finta: la preparazione parte e si spegne a metà, poi arriva un altro colpo.
    // Margit la usa di continuo; è quella che fa sbagliare la schivata.
    const feintable = move.kind === 'melee' && !f.justFeinted && !f.timing.hold;
    const chance = a.moveset.traits.feintChance || 0;
    f.feintAt = feintable && chance && this.rng.chance(chance) ? f.timing.windup * this.rng.range(0.5, 0.75) : 0;
    f.justFeinted = false;
    if (move.cooldown) f.cooldowns[move.id] = move.cooldown + moveDuration(move);
    a.playMove(f.motion, { ...f.timing, mirror: f.mirror, hold: f.timing.hold });
    this.hooks.onMoveStart && this.hooks.onMoveStart(a, t, move);
  }

  _startEvade(a, t) {
    const f = a.fight;
    const evade = a.moveset.moves.find((m) => m.kind === 'evade');
    const move = evade || { id: 'roll', name: 'Schivata', kind: 'evade', windup: 0.06, active: 0.18, recovery: 0.3, motion: 'roll', dash: -1.4, sfx: 'step' };
    f.move = move;
    f.moveTime = 0;
    f.state = 'evade';
    f.timing = { windup: move.windup, active: move.active, recovery: move.recovery, total: moveDuration(move) };
    f.motion = move.motion;
    f.mirror = false;
    a.playMove(move.motion, { ...f.timing });
    this.hooks.onEvade && this.hooks.onEvade(a, move);
  }

  /** Qualcuno sta caricando un colpo contro di me e sono nel raggio? */
  _threatened(a, alive) {
    for (const o of alive) {
      if (o === a || !o.alive) continue;
      const f = o.fight;
      if (f.state !== 'windup' || !f.move || f.target !== a) continue;
      const left = (f.timing ? f.timing.windup : f.move.windup) - f.moveTime;
      if (left < 0.26 && left > 0.02) return o;
    }
    return null;
  }

  // ---------------------------------------------------------- per singolo
  _updateFighter(a, alive, dt) {
    const f = a.fight;
    const traits = a.moveset.traits;

    for (const k in f.cooldowns) { f.cooldowns[k] -= dt; if (f.cooldowns[k] <= 0) delete f.cooldowns[k]; }
    f.poise = Math.min(f.maxPoise, f.poise + dt * 0.9);

    if (f.phase === 1 && a.hp <= a.maxHp * 0.5 && a.moveset.phase2.length) return this._enterPhase2(a);

    if (!f.target || !f.target.alive) f.target = this._nearest(a, alive);
    const t = f.target;
    if (!t) return;

    const { dist, reach } = this._gap(a, t);
    const desiredYaw = Math.atan2(t.root.position.x - a.root.position.x, t.root.position.z - a.root.position.z);
    // a terra non ci si gira: il corpo è dove l'ha lasciato il colpo
    if (f.state !== 'down') {
      const turnSpeed = f.state === 'windup' ? 5 : f.state === 'active' ? 1.2 : 9;
      a.root.rotation.y = dampAngle(a.root.rotation.y, desiredYaw, turnSpeed, dt);
      a.lookAt(t.root.position);   // la testa resta puntata sull'avversario
    }

    switch (f.state) {
      case 'approach': {
        if (this.rng.next() < traits.dodgeChance * dt * 3 && this._threatened(a, alive)) { this._startEvade(a, t); break; }
        const punish = this._punishable(t);
        // avversario scoperto: niente giri intorno, si va addosso e si colpisce
        if (punish) f.decision = Math.min(f.decision, 0.06);
        f.decision -= dt;
        const target = traits.preferredRange;
        if (reach > target) {
          const speed = a.stats.speed * a.height * (0.9 + traits.aggression * 0.5) * (punish ? 1.5 : 1);
          const step = Math.min(speed * dt, (reach - target * 0.8) * a.height);
          a.root.position.x += Math.sin(desiredYaw) * step;
          a.root.position.z += Math.cos(desiredYaw) * step;
          a.play('walk');
        } else if (f.decision > 0) {
          f.strafeTimer -= dt;
          if (f.strafeTimer <= 0) { f.strafeDir *= -1; f.strafeTimer = this.rng.range(...STRAFE_TIME); }
          const speed = a.stats.speed * a.height * 0.55;
          a.root.position.x += Math.cos(desiredYaw) * f.strafeDir * speed * dt;
          a.root.position.z -= Math.sin(desiredYaw) * f.strafeDir * speed * dt;
          a.play('strafe');
        }
        if (f.decision <= 0) {
          const move = this._pickMove(a, t);
          if (move) this._startMove(a, t, move);
          else { f.decision = this.rng.range(0.25, 0.7); a.play('walk'); }
        }
        break;
      }

      case 'windup': {
        f.moveTime += dt;
        const m = f.move;
        if (f.feintAt && f.moveTime >= f.feintAt) {
          // la finta: il colpo si spegne e ne parte subito un altro
          f.feintAt = 0;
          f.justFeinted = true;
          a.trail.setEmitting(false);
          this.hooks.onFeint && this.hooks.onFeint(a, t, m);
          const next = this._pickMove(a, t);
          if (next) { this._startMove(a, t, next); break; }
          f.state = 'recovery';
          f.moveTime = f.timing.windup + f.timing.active;
          break;
        }
        if (m.dash && m.dash > 0 && m.kind === 'dash') {
          const step = m.dash * a.height * dt * 0.35;
          a.root.position.x += Math.sin(a.yaw) * step;
          a.root.position.z += Math.cos(a.yaw) * step;
        }
        if (f.moveTime >= f.timing.windup) {
          f.state = 'active';
          f.moveTime = f.timing.windup;
          // la lama comincia a lasciare la scia proprio quando parte il fendente
          if (m.trail !== false && m.kind !== 'projectile') a.trail.setEmitting(true);
          this.hooks.onActive && this.hooks.onActive(a, t, m);
          if (m.kind === 'projectile') this._launchProjectile(a, t, m);
        } else {
          this.hooks.onTelegraph && this.hooks.onTelegraph(a, t, m, f.moveTime / Math.max(1e-4, f.timing.windup));
        }
        break;
      }

      case 'active': {
        const m = f.move;
        f.moveTime += dt;
        const k = clamp((f.moveTime - f.timing.windup) / Math.max(1e-4, f.timing.active), 0, 1);

        if (m.dash) {
          const step = m.dash * a.height * dt * (m.kind === 'evade' ? 1.6 : 1.1);
          a.root.position.x += Math.sin(a.yaw) * step;
          a.root.position.z += Math.cos(a.yaw) * step;
        }
        if (m.vfx === 'rotTrail' || m.vfx === 'dustTrail') this.hooks.onTrail && this.hooks.onTrail(a, m);

        if (m.kind !== 'projectile' && m.kind !== 'evade') {
          const hits = m.hits || 1;
          const want = Math.floor(k * hits + 1e-6);
          while (f.hitsDone < want && f.hitsDone < hits) {
            f.hitsDone++;
            this._resolveHit(a, t, m, alive, hits > 1);
          }
        }
        if (m.pull) this._applyPull(a, t, m, dt);

        if (f.moveTime >= f.timing.windup + f.timing.active) {
          if (m.kind !== 'projectile' && m.kind !== 'evade' && f.hitsDone === 0) this._resolveHit(a, t, m, alive, false);
          f.state = 'recovery';
        }
        break;
      }

      case 'recovery': {
        f.moveTime += dt;
        const m = f.move;
        // la scia continua un momento dopo l'impatto: una lama non si ferma di colpo
        if (f.moveTime >= f.timing.windup + f.timing.active + Math.min(0.18, f.timing.recovery * 0.5)) a.trail.setEmitting(false);
        if (f.moveTime >= f.timing.total) {
          a.trail.setEmitting(false);
          const combo = m.combo && m.combo.length && this.rng.chance(a.moveset.traits.comboChance);
          f.move = null;
          f.state = 'approach';
          f.decision = combo ? 0 : this.rng.range(0.25, 0.8) * (2 - a.moveset.traits.aggression);
          f.comboNext = combo ? m.combo[Math.floor(this.rng.next() * m.combo.length)] : null;
          f.inCombo = !!f.comboNext;
          a.play('idle');
        }
        break;
      }

      case 'evade': {
        f.moveTime += dt;
        const m = f.move;
        if (m.dash) {
          const step = m.dash * a.height * dt * 1.8;
          a.root.position.x += Math.sin(a.yaw) * step;
          a.root.position.z += Math.cos(a.yaw) * step;
        }
        if (f.moveTime >= f.timing.total) { f.move = null; f.state = 'approach'; f.decision = this.rng.range(0.1, 0.4); a.play('idle'); }
        break;
      }

      case 'stagger': {
        f.staggerTimer -= dt;
        if (f.staggerTimer <= 0) { f.state = 'approach'; f.decision = this.rng.range(0.1, 0.5); a.play('idle'); }
        break;
      }

      // Atterrato da un colpo pesante: cade, resta giù, si rialza. Finché è a
      // terra non attacca e non si difende: è la finestra per punirlo.
      case 'down': {
        f.downTimer -= dt;
        if (f.downTimer <= 0) {
          f.state = 'approach';
          f.poise = f.maxPoise;
          f.decision = this.rng.range(0.15, 0.45);
          a.play('idle', { fade: 0.12 });
        }
        break;
      }

      case 'phase2': {
        f.moveTime += dt;
        if (f.moveTime >= 1.6) { f.state = 'approach'; f.decision = 0.1; a.play('idle'); }
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------- risoluzione
  _resolveHit(a, t, move, alive, multi) {
    const targets = move.aoe
      ? alive.filter((o) => o !== a && o.alive && this._gap(a, o).reach <= move.aoe)
      : [t];
    for (const victim of targets) {
      if (!victim.alive) continue;
      const { reach } = this._gap(a, victim);
      const maxReach = move.aoe || Math.max(move.range[1], 1.1);
      if (reach > maxReach * 1.15) { this.hooks.onMiss && this.hooks.onMiss(a, move); continue; }

      // schivata riuscita: chi sta rotolando o saltando indietro evita il colpo
      if (victim.fight.state === 'evade' && victim.fight.moveTime < (victim.fight.timing ? victim.fight.timing.total * 0.8 : 0.3)) {
        this.hooks.onEvadeSuccess && this.hooks.onEvadeSuccess(victim, a, move);
        continue;
      }
      // parata: riduce il danno e non rompe la posa
      const guarded = victim.fight.state === 'approach' && this.rng.chance(0.14);
      const crit = !multi && this.rng.chance(0.1);
      let dmg = a.stats.attack * (move.damage || 1) * this.rng.range(0.85, 1.15) * (crit ? 1.7 : 1);
      if (guarded) dmg *= 0.35;
      // colpire chi è a terra fa più male: è la punizione che chiude gli scambi
      if (victim.fight.state === 'down') dmg *= 1.4;

      const wasAlive = victim.alive;
      victim.takeDamage(dmg);
      if (guarded) this.hooks.onGuard && this.hooks.onGuard(victim, a, move);
      else this.hooks.onHit && this.hooks.onHit(a, victim, dmg, crit, move);

      if (move.lifesteal || a.moveset.traits.lifesteal) {
        const heal = dmg * (move.lifesteal || a.moveset.traits.lifesteal);
        a.hp = Math.min(a.maxHp, a.hp + heal);
        a.hpBar.set(a.hp / a.maxHp);
        this.hooks.onLifesteal && this.hooks.onLifesteal(a, victim, heal);
      }
      if (move.rot) this.hooks.onRot && this.hooks.onRot(victim, a);

      // Contraccolpo: il colpo sposta davvero il corpo. La spinta è in metri al
      // secondo scalati sull'altezza, così a 20 cm sul tavolo si legge uguale.
      const weight = move.poise || 1;
      const dirX = victim.root.position.x - a.root.position.x;
      const dirZ = victim.root.position.z - a.root.position.z;
      const push = (move.knockback != null ? move.knockback : 0.22 + weight * 0.3)
        * (crit ? 1.6 : 1) * (guarded ? 0.4 : 1) * (multi ? 0.3 : 1);

      if (wasAlive && !victim.alive) {
        victim.applyImpulse(dirX, dirZ, push * 1.4 * victim.height);
        this.hooks.onDeath && this.hooks.onDeath(victim, a);
        continue;
      }

      if (!guarded && victim.alive) {
        victim.applyImpulse(dirX, dirZ, push * victim.height);
        // chi mena arretra un poco: è il rinculo che dà peso al colpo
        if (!multi && weight >= 1.5) a.applyImpulse(-dirX, -dirZ, push * 0.16 * a.height);

        victim.fight.poise -= weight * (multi ? 0.35 : 1);
        const interruptible = victim.fight.state !== 'active' && victim.fight.state !== 'phase2' && victim.fight.state !== 'down';
        const broken = victim.fight.poise <= 0 && interruptible;
        // rottura di posa con un colpo pesante: non barcolla, va a terra
        const floored = broken && (weight >= 2 || crit) && victim.hasAnimation('knockdown');
        if (floored) {
          victim.fight.poise = victim.fight.maxPoise;
          victim.fight.state = 'down';
          victim.fight.downTimer = 2.1;
          victim.fight.move = null;
          victim.trail.setEmitting(false);
          victim.hitFrom(a.root.position, 'knockdown');
          victim.applyImpulse(dirX, dirZ, push * 1.6 * victim.height);
          this.hooks.onKnockdown && this.hooks.onKnockdown(victim, a, move);
        } else if (broken) {
          victim.fight.poise = victim.fight.maxPoise;
          victim.fight.state = 'stagger';
          victim.fight.staggerTimer = 0.75;
          victim.fight.move = null;
          victim.trail.setEmitting(false);
          victim.hitFrom(a.root.position, 'hit');
          this.hooks.onStagger && this.hooks.onStagger(victim, a);
        } else if (interruptible && victim.fight.state !== 'stagger') {
          victim.hitFrom(a.root.position, 'hit');
        } else {
          // già impegnato in un colpo: incassa senza cambiare animazione,
          // ma la direzione serve lo stesso alle scintille
          victim.hitFrom(a.root.position, null);
        }
      } else if (guarded && victim.alive) {
        victim.applyImpulse(dirX, dirZ, push * 0.5 * victim.height);
      }
    }
  }

  _launchProjectile(a, t, move) {
    const delay = this.hooks.onProjectile ? this.hooks.onProjectile(a, t, move) : 0;
    this.pending.push({
      t: Math.max(0.05, delay || 0.3),
      run: () => {
        if (!a.alive || !t.alive || !this.active) return;
        const crit = this.rng.chance(0.08);
        const dmg = a.stats.attack * (move.damage || 1) * this.rng.range(0.85, 1.15) * (crit ? 1.7 : 1);
        const wasAlive = t.alive;
        t.takeDamage(dmg);
        this.hooks.onHit && this.hooks.onHit(a, t, dmg, crit, move);
        const kb = (move.knockback != null ? move.knockback : 0.3) * (crit ? 1.5 : 1);
        if (wasAlive && !t.alive) this.hooks.onDeath && this.hooks.onDeath(t, a);
        else if (t.alive) {
          t.applyImpulse(t.root.position.x - a.root.position.x, t.root.position.z - a.root.position.z, kb * t.height);
          t.hitFrom(a.root.position, t.fight.state !== 'active' ? 'hit' : null);
        }
      },
    });
  }

  _applyPull(a, t, move, dt) {
    if (!t.alive) return;
    const dx = a.root.position.x - t.root.position.x;
    const dz = a.root.position.z - t.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const step = Math.min(move.pull * t.height * dt, d - (a.bodyRadius * a.height + t.bodyRadius * t.height));
    if (step <= 0) return;
    t.root.position.x += (dx / d) * step;
    t.root.position.z += (dz / d) * step;
    this.hooks.onPull && this.hooks.onPull(a, t, move);
  }

  _enterPhase2(a) {
    const f = a.fight;
    f.phase = 2;
    f.state = 'phase2';
    f.moveTime = 0;
    f.move = null;
    f.poise = f.maxPoise = f.maxPoise * 1.5;
    a.stats.attack *= 1.15;
    a.stats.speed *= 1.12;
    a.play('phase2', { loop: false, fade: 0.1 });
    this.hooks.onPhase2 && this.hooks.onPhase2(a, a.moveset.phase2Name);
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
