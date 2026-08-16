// Variant rules: rest + downtime — three new rules knobs consumed by
// rest.js, plus the sanity track and exhaustion-on-failure stake. What
// must hold: slow natural healing actually withholds hp on a long rest;
// the healer's-kit gate actually refuses an untended hit die; gritty
// durations are queryable; sanity is a clean opt-in (absent field =
// untouched subsystem); the stake drives the REAL exhaustion ladder.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Dice, Rest, VariantRest, Conditions } from '../index.js';
import { longRest, spendHitDie, restDurations } from '../src/rest.js';
import {
  sanityCheck, applySanityLoss, restoreSanity, exhaustionOnFailure,
} from '../src/variants/rest.js';
import { buildRules } from '../src/rules.js';

const wounded = {
  id: 'pc', hp: 4, hpMax: 20, level: 4, hitDie: 8,
  hitDiceTotal: 4, hitDiceUsed: 4,
  abilityScores: { con: 14 },
};

test('slow natural healing: the knob withholds long-rest hp, dice still return', () => {
  // Baseline: full hp on a long rest.
  assert.equal(longRest(wounded).hp, 20);
  // Gritty: hp stays where it was; hit dice recovery still applies, so
  // the table heals by SPENDING dice, which is the variant's point.
  const gritty = buildRules({ longRestHpRecovery: 'none' });
  const rested = longRest(wounded, gritty);
  assert.equal(rested.hp, 4, 'no free hp');
  assert.equal(rested.hitDiceUsed, 2, 'hit dice half-recover as normal');
  // The knob validates like every other knob.
  assert.throws(() => buildRules({ longRestHpRecovery: 'most' }), /longRestHpRecovery/);
});

test("healer's-kit dependency: an untended actor cannot spend hit dice", () => {
  const kit = buildRules({ hitDiceRequireHealersKit: true });
  const refused = spendHitDie(wounded, () => 0.5, kit);
  assert.equal(refused.healed, 0);
  assert.match(refused.reason, /healer's kit/i);
  // Tended (the host burned a kit charge), the die rolls as normal.
  const tended = spendHitDie({ ...wounded, hitDiceUsed: 0, healersKitTended: true }, () => 0.999, kit);
  assert.ok(tended.healed > 0, 'tended actor heals');
  // Default rules: no gate, nothing changes for existing tables.
  const baseline = spendHitDie({ ...wounded, hitDiceUsed: 0 }, () => 0.999);
  assert.ok(baseline.healed > 0);
});

test('gritty realism durations are queryable per-engine', () => {
  assert.deepEqual(restDurations(), { shortRestHours: 1, longRestHours: 8 });
  const gritty = buildRules({ restDurationScale: 'gritty' });
  assert.deepEqual(restDurations(gritty), { shortRestHours: 8, longRestHours: 168 });
  // Engine-bound: the knob rides createEngine({ rules }).
  const engine = createEngine({ rules: { restDurationScale: 'gritty' } });
  assert.equal(engine.Rest.restDurations().longRestHours, 168);
  assert.equal(createEngine().Rest.restDurations().shortRestHours, 1);
});

test('sanity: an opt-in seventh score with checks, loss, breaking and recovery', () => {
  // No sanity field → the whole subsystem refuses cleanly.
  assert.match(sanityCheck({ id: 'x' }).reason, /no sanity track/);
  assert.match(applySanityLoss({ id: 'x' }, 3).reason, /no sanity track/);
  // Checks ride the standard modFromScore curve.
  const steady = sanityCheck({ sanity: 14 }, { dc: 10 }, () => 0.5); // d20=11, mod +2
  assert.deepEqual(
    { d20: steady.d20, mod: steady.mod, total: steady.total, success: steady.success },
    { d20: 11, mod: 2, total: 13, success: true });
  // Advantage/disadvantage stances work like every other d20.
  assert.equal(sanityCheck({ sanity: 10 }, { advantage: true }, () => 0.1).stance, 'advantage');
  // Loss clamps at zero and breaks the mind — a state, not a death.
  let actor = { id: 'pc', sanity: 5 };
  ({ actor } = applySanityLoss(actor, 3));
  assert.equal(actor.sanity, 2);
  assert.equal(actor.mindBroken, undefined);
  ({ actor } = applySanityLoss(actor, 9));
  assert.equal(actor.sanity, 0);
  assert.equal(actor.mindBroken, true);
  // Recovery caps at 18 and clears the broken state.
  ({ actor } = restoreSanity(actor, 4));
  assert.equal(actor.sanity, 4);
  assert.equal(actor.mindBroken, undefined);
  assert.equal(restoreSanity({ sanity: 17 }, 5).actor.sanity, 18);
});

test('exhaustion-on-failure drives the real ladder, and the engine exposes it all', () => {
  let actor = { id: 'pc' };
  // A passed check costs nothing.
  assert.equal(exhaustionOnFailure(actor, { success: true }).applied, false);
  // A failed one climbs the real ladder — speed penalty and all.
  const failed = exhaustionOnFailure(actor, { success: false });
  assert.equal(failed.applied, true);
  assert.equal(Conditions.exhaustion.level(failed.actor), 1);
  assert.equal(Conditions.exhaustion.speedPenalty(failed.actor), 5);
  // Six failures kill, per the SRD ladder the variant rides.
  let doomed = { id: 'pc' };
  for (let i = 0; i < 6; i++) {
    ({ actor: doomed } = exhaustionOnFailure(doomed, { success: false }));
  }
  assert.equal(Conditions.exhaustion.level(doomed), 6);
  // Engine surface: VariantRest bound with the engine rng for checks.
  const engine = createEngine({ rng: Dice.seededRng(11) });
  const twin = createEngine({ rng: Dice.seededRng(11) });
  assert.deepEqual(
    engine.VariantRest.sanityCheck({ sanity: 12 }, { dc: 12 }),
    twin.VariantRest.sanityCheck({ sanity: 12 }, { dc: 12 }));
  assert.equal(typeof VariantRest.applySanityLoss, 'function');
  assert.equal(typeof Rest.restDurations, 'function');
});
