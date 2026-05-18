import { rollDie, roll as rollDice } from './dice.js';
import { modFromScore } from './checks.js';

/**
 * Initiative is mechanically just `d20 + DEX mod`, but it lives in
 * combat (not checks) because it belongs to the encounter system —
 * the loop calls `rollInitiative` at the start of combat, never as
 * a generic check. Keeping it here means combat code never has to
 * reach into another module to start a turn.
 */
export function rollInitiative({ dexterity }) {
  return rollDie(20) + modFromScore(dexterity);
}

/**
 * One attack roll, fully decided in one call. We surface `critical`
 * and `fumble` as flags (rather than making the caller re-inspect
 * the d20) because the narrator agent branches on them — "you
 * connect cleanly" vs "the blade scrapes off the plate" — and we
 * don't want every caller redoing the nat-20 / nat-1 comparison.
 *
 * Nat 20 always hits and nat 1 always misses, regardless of AC and
 * attack bonus. That's SRD canon; cheaters and AI hallucinators
 * sometimes try to defeat it, so it's encoded here as the single
 * source of truth rather than left to the loop.
 */
export function attackRoll({ attackBonus, ac }) {
  const d20 = rollDie(20);
  const critical = d20 === 20;
  const fumble = d20 === 1;
  const total = d20 + attackBonus;
  const hit = critical || (!fumble && total >= ac);
  return { d20, attackBonus, total, ac, hit, critical, fumble };
}

/**
 * Roll damage, with three rules baked in so callers can't get them
 * wrong:
 *   1. On a crit, the **dice** double but the modifier does not —
 *      SRD § "Critical Hits". A common port-bug is doubling the
 *      whole total; we avoid it by rolling the extra dice
 *      separately and adding the flat modifier once.
 *   2. Total damage floors at 1. A creature reduced to a negative
 *      result by a debuff shouldn't heal the target — the floor
 *      keeps "tickle for 1" rather than producing "heals for 3".
 *   3. `damageMod = 0` and `critical = false` defaults so test
 *      and AI-tool callers that pass only `damageDice` work.
 */
export function damageRoll({ damageDice, damageMod = 0, critical = false }) {
  const base = rollDice(damageDice);
  const extra = critical ? rollDice(damageDice) : { rolls: [], total: 0 };
  const total = Math.max(1, base.total + extra.total + damageMod);
  return {
    damageDice,
    baseRolls: base.rolls,
    critRolls: extra.rolls,
    damageMod,
    total
  };
}

// === Weapon Mastery (SRD 5.2) ===
//
// Each weapon carries one mastery property; the loop resolves its
// rider effect after the attack roll via `applyMastery`. Returns a
// plain rider object describing what happens — no I/O, no narration,
// no state mutation. The loop owns turning that rider into a state
// delta and a piece of prose (see bag-of-holding/docs/boundary.md).
//
// Handlers are looked up by name from a table rather than a switch
// so plugins (Phase A engine extensions) can contribute new mastery
// properties without forking this file.

/**
 * A mastery handler resolves one attack into a rider object. Inputs
 * mirror `applyMastery`'s public arguments (minus the handler table
 * itself). Handlers must be pure — same inputs, same output — so
 * the engine stays replay-deterministic.
 *
 * @callback MasteryHandler
 * @param {object} weapon         The attacker's weapon record.
 * @param {object} target         The defender (for plugin handlers
 *                                that branch on size, type, etc.).
 * @param {object} attackResult   The `attackRoll` return.
 * @param {object} attacker       The attacker (for proficiency,
 *                                ability mods, etc.).
 * @returns {object}              `{ kind, ... }` rider.
 */

/**
 * The eight SRD 5.2 mastery handlers, keyed by mastery name. Frozen
 * at the module level so the default singleton can share it; the
 * engine factory clones it and merges plugin contributions on top.
 *
 * Each handler is gated per SRD: graze fires on miss, every other
 * property fires on hit (with topple also building a save DC from
 * the attacker's modifiers).
 */
export const DEFAULT_MASTERY_HANDLERS = Object.freeze({
  graze: (_w, _t, result) => {
    if (result?.hit) return { kind: 'none' };
    return { kind: 'graze', damage: result?.attackBonus ?? 0 };
  },

  cleave: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'cleave', range: 5 };
  },

  nick: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'nick', extraAttack: true };
  },

  push: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'push', distance: 10, sizeCap: 'large' };
  },

  sap: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'sap', disadvantage: true };
  },

  slow: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'slow', speedReduction: 10 };
  },

  topple: (_w, _t, result, attacker) => {
    if (!result?.hit) return { kind: 'none' };
    // Past the hit guard, `result` is defined.
    const attackAbilityMod = result.attackBonus ?? 0;
    const proficiencyBonus = attacker?.proficiencyBonus ?? 0;
    const saveDC = 8 + attackAbilityMod + proficiencyBonus;
    return { kind: 'topple', saveDC, ability: 'con', onFail: 'prone' };
  },

  vex: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'vex', advantage: true };
  }
});

/**
 * Frozen canonical list of the SRD 5.2 mastery property names. Kept
 * as a separate constant from the handler table so consumers can
 * iterate names without dereferencing functions (useful for
 * editor autocomplete, schema generation, and registering UI chips).
 */
export const MASTERY_PROPERTIES = Object.freeze(Object.keys(DEFAULT_MASTERY_HANDLERS));

/**
 * Resolve a weapon's mastery rider for one attack. Returns a plain
 * descriptor object the game loop interprets — the engine never
 * mutates target state or generates prose, both of which would
 * violate the AI/engine boundary.
 *
 * The `handlers` table defaults to the SRD 5.2 set. Plugins extend
 * this by passing a merged table (`{ ...DEFAULT_MASTERY_HANDLERS,
 * pin: customHandler }`) — typically constructed once by the engine
 * factory and bound, so callers never thread it explicitly.
 *
 * Unknown masteries throw rather than silently returning `none`:
 * a misspelled weapon record is always a bug, and we want it loud
 * at construction time rather than silently disabling combat math.
 */
export function applyMastery(weapon, target, attackResult, attacker = {}, handlers = DEFAULT_MASTERY_HANDLERS) {
  const mastery = weapon?.mastery;
  if (!mastery) return { kind: 'none' };
  const handler = handlers[mastery];
  if (!handler) throw new Error(`Unknown weapon mastery: ${mastery}`);
  return handler(weapon, target, attackResult, attacker);
}
