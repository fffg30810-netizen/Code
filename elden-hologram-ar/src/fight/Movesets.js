// Moveset dei boss: ogni mossa descrive tempi, portata, movimento del corpo,
// effetto visivo e suono. I modelli generati non hanno scheletro, quindi una
// "mossa" è un movimento di tutto il corpo (scatto, salto, rotazione, affondo)
// accompagnato da effetti: è così che si leggono le mosse a 20 cm sul tavolo.
//
// Tempi in secondi, distanze in "altezze del boss" (1 = alto quanto lui).
//   windup   preparazione: telegrafo leggibile prima del colpo
//   active   finestra in cui il colpo fa danno
//   recovery scopertura dopo il colpo
//
// `motion` è una primitiva di RigidAnimator, `vfx` un effetto di CombatFx,
// `sfx` un suono di Sfx.

/** Mosse generiche, usate dai boss che non hanno un moveset dedicato. */
const GENERIC = [
  {
    id: 'slash', name: 'Fendente', kind: 'melee', weight: 3,
    range: [0, 1.05], windup: 0.42, active: 0.16, recovery: 0.5,
    damage: 1.0, poise: 1.0, motion: 'slash', vfx: 'arc', sfx: 'swingHeavy',
  },
  {
    id: 'thrust', name: 'Affondo', kind: 'dash', weight: 2,
    range: [0.8, 2.0], windup: 0.38, active: 0.2, recovery: 0.45,
    damage: 1.05, poise: 1.1, motion: 'thrust', dash: 1.1, vfx: 'thrust', sfx: 'swingLight',
  },
  {
    id: 'spin', name: 'Spazzata rotante', kind: 'melee', weight: 1.4,
    range: [0, 1.2], windup: 0.5, active: 0.3, recovery: 0.6,
    damage: 1.25, poise: 1.6, motion: 'spin', vfx: 'arcWide', sfx: 'swingHeavy', aoe: 1.2,
  },
  {
    id: 'slam', name: 'Schianto', kind: 'melee', weight: 1.2,
    range: [0, 1.0], windup: 0.62, active: 0.14, recovery: 0.7,
    damage: 1.4, poise: 2.0, motion: 'leapSlam', vfx: 'shockwave', sfx: 'impactHeavy', aoe: 1.5,
  },
];

/**
 * Moveset per boss. `phase2` elenca le mosse che si sbloccano sotto il 50% di vita.
 * `traits` cambia il comportamento: aggressione, distanza preferita, schivata.
 */
export const MOVESETS = {
  // -------------------------------------------------------------- Malenia
  malenia: {
    traits: { aggression: 0.92, preferredRange: 0.75, dodgeChance: 0.42, comboChance: 0.6, lifesteal: 0.28 },
    phase2Name: 'Malenia, Dea del Marciume',
    moves: [
      {
        id: 'cleave', name: 'Fendente della lama', kind: 'melee', weight: 3,
        range: [0, 0.95], windup: 0.3, active: 0.14, recovery: 0.32,
        damage: 0.9, poise: 0.8, motion: 'slash', vfx: 'arcThin', sfx: 'swingLight',
        combo: ['cleave', 'thrustStep'],
      },
      {
        id: 'thrustStep', name: 'Passo e stoccata', kind: 'dash', weight: 2,
        range: [0.7, 2.2], windup: 0.26, active: 0.18, recovery: 0.36,
        damage: 1.0, poise: 0.9, motion: 'thrust', dash: 1.4, vfx: 'thrust', sfx: 'swingLight',
      },
      {
        id: 'waterfowl', name: 'Danza dei Trampolieri', kind: 'special', weight: 1.1,
        range: [0, 4.5], windup: 0.75, active: 1.65, recovery: 0.85, cooldown: 11,
        damage: 0.42, hits: 9, poise: 0.5, motion: 'flurry', dash: 2.6,
        vfx: 'flurry', sfx: 'flurry', telegraph: 'rise', aoe: 0.9,
      },
      {
        id: 'backstep', name: 'Balzo indietro', kind: 'evade', weight: 1.2,
        range: [0, 0.8], windup: 0.1, active: 0, recovery: 0.34,
        damage: 0, motion: 'backstep', dash: -1.6, sfx: 'step',
      },
    ],
    phase2: [
      {
        id: 'aeonia', name: 'Scarlet Aeonia', kind: 'special', weight: 1.6,
        range: [0, 2.6], windup: 1.0, active: 0.5, recovery: 1.1, cooldown: 14,
        damage: 2.4, poise: 3.0, motion: 'bloom', vfx: 'aeonia', sfx: 'bloom',
        telegraph: 'rise', aoe: 1.8, rot: true,
      },
      {
        id: 'wingDash', name: 'Volo del marciume', kind: 'dash', weight: 2,
        range: [1.2, 4.0], windup: 0.4, active: 0.22, recovery: 0.4,
        damage: 1.2, poise: 1.2, motion: 'swoop', dash: 3.0, vfx: 'rotTrail', sfx: 'swingHeavy',
      },
    ],
  },

  // --------------------------------------------------------------- Radahn
  radahn: {
    traits: { aggression: 0.7, preferredRange: 0.95, dodgeChance: 0.12, comboChance: 0.45, poiseArmor: 2.2 },
    phase2Name: 'Radahn, Flagello delle Stelle',
    moves: [
      {
        id: 'doubleSweep', name: 'Doppia spazzata', kind: 'melee', weight: 3,
        range: [0, 1.25], windup: 0.48, active: 0.26, recovery: 0.55,
        damage: 1.25, poise: 1.8, motion: 'doubleSpin', vfx: 'arcWide', sfx: 'swingHeavy',
        aoe: 1.15, combo: ['overhead'],
      },
      {
        id: 'overhead', name: 'Colpo calante', kind: 'melee', weight: 2,
        range: [0, 1.1], windup: 0.6, active: 0.16, recovery: 0.66,
        damage: 1.5, poise: 2.2, motion: 'overhead', vfx: 'shockwave', sfx: 'impactHeavy', aoe: 1.05,
      },
      {
        id: 'gravityPull', name: 'Attrazione gravitazionale', kind: 'special', weight: 1.3,
        range: [1.6, 6.0], windup: 0.7, active: 0.3, recovery: 0.6, cooldown: 8,
        damage: 0.5, poise: 1.0, motion: 'cast', vfx: 'gravity', sfx: 'gravity', pull: 2.4,
      },
      {
        id: 'chargeRush', name: 'Carica', kind: 'dash', weight: 1.6,
        range: [1.8, 6.0], windup: 0.55, active: 0.4, recovery: 0.6,
        damage: 1.3, poise: 2.4, motion: 'charge', dash: 4.0, vfx: 'dustTrail', sfx: 'charge',
      },
    ],
    phase2: [
      {
        id: 'meteor', name: 'Grido del Chiamastelle', kind: 'special', weight: 1.8,
        range: [0, 7.0], windup: 1.25, active: 0.45, recovery: 1.3, cooldown: 16,
        damage: 2.8, poise: 4.0, motion: 'skyLeap', vfx: 'meteor', sfx: 'meteor',
        telegraph: 'rise', aoe: 2.4,
      },
    ],
  },

  // --------------------------------------------------------------- Margit
  margit: {
    traits: { aggression: 0.78, preferredRange: 0.8, dodgeChance: 0.3, comboChance: 0.7, feintChance: 0.28 },
    phase2Name: 'Margit, il Presagio Caduto',
    moves: [
      {
        id: 'caneCombo', name: 'Catena di bastonate', kind: 'melee', weight: 3,
        range: [0, 1.0], windup: 0.34, active: 0.15, recovery: 0.34,
        damage: 0.95, poise: 1.0, motion: 'slash', vfx: 'arcThin', sfx: 'swingLight',
        combo: ['caneCombo', 'goldenHammer'],
      },
      {
        id: 'goldenHammer', name: 'Martello di luce', kind: 'special', weight: 1.6,
        range: [0, 1.6], windup: 0.72, active: 0.18, recovery: 0.62, cooldown: 6,
        damage: 1.5, poise: 2.2, motion: 'overhead', vfx: 'lightHammer', sfx: 'lightHammer',
        telegraph: 'glow', aoe: 1.4,
      },
      {
        id: 'daggerThrow', name: 'Pugnale dorato', kind: 'projectile', weight: 1.5,
        range: [1.5, 6.0], windup: 0.45, active: 0.1, recovery: 0.4, cooldown: 4,
        damage: 0.8, poise: 0.6, motion: 'throw', vfx: 'dagger', sfx: 'daggerThrow',
        projectileSpeed: 5.5,
      },
      {
        id: 'leapStrike', name: 'Balzo del presagio', kind: 'dash', weight: 1.4,
        range: [1.2, 3.6], windup: 0.5, active: 0.2, recovery: 0.55,
        damage: 1.25, poise: 1.6, motion: 'leapSlam', dash: 2.4, vfx: 'shockwave', sfx: 'impactHeavy',
      },
      {
        id: 'sidestep', name: 'Scarto laterale', kind: 'evade', weight: 1.1,
        range: [0, 1.2], windup: 0.08, active: 0, recovery: 0.3,
        damage: 0, motion: 'sidestep', dash: -1.0, sfx: 'step',
      },
    ],
    phase2: [
      {
        id: 'goldenCleaver', name: 'Mannaia dorata', kind: 'special', weight: 1.8,
        range: [0, 1.8], windup: 0.85, active: 0.22, recovery: 0.75, cooldown: 9,
        damage: 1.9, poise: 3.0, motion: 'overhead', vfx: 'lightHammer', sfx: 'lightHammer',
        telegraph: 'glow', aoe: 1.8,
      },
    ],
  },
};

/** Moveset di riserva, scelto in base all'arma del segnaposto procedurale. */
const BY_WEAPON = {
  greatsword: ['slash', 'slam', 'spin'],
  katana: ['slash', 'thrust', 'spin'],
  axe: ['slash', 'slam'],
  hammer: ['slam', 'slash'],
  spear: ['thrust', 'slash'],
  trident: ['thrust', 'slash'],
  staff: ['thrust', 'slash'],
};

export function movesetFor(def) {
  const custom = MOVESETS[def.id];
  if (custom) {
    return {
      traits: { aggression: 0.75, preferredRange: 0.85, dodgeChance: 0.2, comboChance: 0.4, ...custom.traits },
      moves: custom.moves,
      phase2: custom.phase2 || [],
      phase2Name: custom.phase2Name || def.name,
    };
  }
  const weapon = (def.procedural && def.procedural.weapon) || 'greatsword';
  const ids = BY_WEAPON[weapon] || BY_WEAPON.greatsword;
  const moves = GENERIC.filter((m) => ids.includes(m.id));
  return {
    traits: { aggression: 0.7, preferredRange: 0.85, dodgeChance: 0.18, comboChance: 0.35 },
    moves: moves.length ? moves : GENERIC.slice(0, 2),
    phase2: [],
    phase2Name: def.name,
  };
}

/** Durata totale di una mossa. */
export const moveDuration = (m) => m.windup + m.active + m.recovery;
