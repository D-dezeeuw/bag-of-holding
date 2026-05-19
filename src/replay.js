// Replay verification for roll logs. Lives in its own module rather
// than in dice.js because it has to import from combat.js and
// checks.js too — putting it in dice.js would create an import
// cycle. The engine factory re-exports `verifyLog` as a method on
// each engine instance, so consumers mostly reach it via that path.

import { seededRng, rollDie, roll, rollAdvantage, rollDisadvantage } from './dice.js';
import { abilityCheck, savingThrow } from './checks.js';
import { attackRoll, damageRoll, rollInitiative } from './combat.js';

const arraysEqual = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    && a.length === b.length
    && a.every((v, i) => v === b[i]);

/**
 * Walk a recorded `rollLog` forward from `seed`, re-executing each
 * logged operation with a fresh seeded RNG and comparing the results
 * to the values stored in the log. Returns `{ ok: true }` on a clean
 * replay, or `{ ok: false, divergedAt, expected, actual }` on the
 * first disagreement.
 *
 * **What this catches:**
 *   - Determinism regressions when the Mulberry32 implementation or
 *     any rolling function silently changes between releases.
 *   - AI hallucinations claiming the engine produced an outcome it
 *     never could from the same seed.
 *   - State corruption across saves where a log no longer matches
 *     the engine that produced it.
 *
 * **What this does NOT do:** it doesn't re-execute the *surrounding
 * application logic* (turn loop, AI calls, narration). It only
 * verifies that the engine's stochastic outputs, in the order they
 * were recorded, are reproducible from the given seed.
 *
 * The log entries' `op` field is the dispatch key. Unknown ops throw
 * loudly — a forwards-incompatible log shouldn't silently pass
 * verification.
 */
export function verifyLog({ seed, log }) {
  const rng = seededRng(seed);
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    let actual;
    switch (entry.op) {
      case 'rollDie':
        actual = rollDie(entry.sides, rng);
        if (actual !== entry.value) {
          return { ok: false, divergedAt: i, expected: entry.value, actual };
        }
        break;
      case 'roll':
        actual = roll(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollAdvantage':
        actual = rollAdvantage(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollDisadvantage':
        actual = rollDisadvantage(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollInitiative':
        actual = rollInitiative({ dexterity: entry.dexterity }, rng);
        if (actual !== entry.value) {
          return { ok: false, divergedAt: i, expected: entry.value, actual };
        }
        break;
      case 'attackRoll':
        actual = attackRoll({ attackBonus: entry.attackBonus, ac: entry.ac }, rng);
        if (actual.d20 !== entry.d20 || actual.hit !== entry.hit) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'damageRoll':
        actual = damageRoll({
          damageDice: entry.damageDice,
          damageMod: entry.damageMod,
          critical: entry.critRolls.length > 0
        }, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.baseRolls, entry.baseRolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'abilityCheck':
        actual = abilityCheck({
          abilityScore: entry.abilityScore,
          proficient: entry.proficient,
          proficiencyBonus: entry.proficiencyBonus,
          dc: entry.dc
        }, rng);
        if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'savingThrow':
        actual = savingThrow({
          abilityScore: entry.abilityScore,
          proficient: entry.proficient,
          proficiencyBonus: entry.proficiencyBonus,
          dc: entry.dc
        }, rng);
        if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      default:
        throw new Error(`Cannot replay unknown roll op: ${entry.op}`);
    }
  }
  return { ok: true };
}
