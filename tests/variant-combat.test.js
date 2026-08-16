// Variant rules: combat — six opt-in helpers. What must hold: flanking
// is strict opposite-side geometry; every called-shot location trades
// accuracy for a rider; the three roll tables are total (every die face
// lands on exactly one row) and deterministic under a pinned rng; cleave
// carryover is exact; and the engine exposes the namespace with rolls
// that land in the roll log.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Dice, VariantCombat } from '../index.js';
import {
  isFlanking, calledShot, CALLED_SHOT_LOCATIONS,
  LINGERING_INJURIES, rollLingeringInjury,
  SYSTEM_SHOCK, massiveDamageCheck,
  cleaveCarryover, FUMBLE_EFFECTS, rollFumbleEffect,
} from '../src/variants/combat.js';

test('flanking: opposite sides and corners only, both adjacent', () => {
  const target = { x: 5, y: 5 };
  // Opposite sides.
  assert.equal(isFlanking({ attacker: { x: 4, y: 5 }, ally: { x: 6, y: 5 }, target }), true);
  // Opposite corners.
  assert.equal(isFlanking({ attacker: { x: 4, y: 4 }, ally: { x: 6, y: 6 }, target }), true);
  // Same side — no.
  assert.equal(isFlanking({ attacker: { x: 4, y: 5 }, ally: { x: 4, y: 4 }, target }), false);
  // Right angle — no (midpoint rule, not mere adjacency).
  assert.equal(isFlanking({ attacker: { x: 4, y: 5 }, ally: { x: 5, y: 6 }, target }), false);
  // Ally out of reach — no, even though the line is right.
  assert.equal(isFlanking({ attacker: { x: 4, y: 5 }, ally: { x: 7, y: 5 }, target }), false);
  // The payoff is the existing advantage path — no new attack math. The
  // host that confirms flanking rolls the attack's d20 with advantage.
  const engine = createEngine({ rng: Dice.seededRng(3) });
  const adv = engine.Dice.rollAdvantage('1d20');
  assert.ok(adv.total >= 1 && adv.total <= 20, 'advantage rides the existing dice surface');
});

test('called shots: every location prices its rider; unknown locations refuse', () => {
  for (const [key, entry] of Object.entries(CALLED_SHOT_LOCATIONS)) {
    const res = calledShot(key);
    assert.equal(res.ok, true);
    assert.ok(res.attackPenalty <= -2, `${key} costs accuracy`);
    assert.ok(res.onHit, `${key} pays with a rider`);
  }
  // Harder targets cost more.
  assert.ok(CALLED_SHOT_LOCATIONS.eye.attackPenalty < CALLED_SHOT_LOCATIONS.arm.attackPenalty);
  // The eye rider maps to a REAL engine condition.
  const engine = createEngine();
  const blinded = engine.Conditions.apply({ id: 'pc' }, CALLED_SHOT_LOCATIONS.eye.onHit.conditionId);
  assert.ok(blinded.conditions.includes('blinded'));
  assert.match(calledShot('torso').reason, /unknown called-shot location/);
});

test('the three roll tables are total and deterministic under a pinned rng', () => {
  // Totality: every face of the die lands on exactly one row.
  const covers = (table, faces) => {
    for (let face = 1; face <= faces; face++) {
      const rows = table.filter((e) => face >= e.range[0] && face <= e.range[1]);
      assert.equal(rows.length, 1, `face ${face} maps to exactly one row`);
    }
  };
  covers(LINGERING_INJURIES, 20);
  covers(SYSTEM_SHOCK, 10);
  covers(FUMBLE_EFFECTS, 6);
  // Pinned lowest roll → the worst row every time.
  assert.equal(rollLingeringInjury(() => 0).injury.id, 'lose-an-eye');
  assert.equal(rollFumbleEffect(() => 0).fumble.id, 'off-balance');
  // Pinned highest → the mildest.
  assert.equal(rollLingeringInjury(() => 0.999).injury.id, 'minor-scar');
  assert.equal(rollFumbleEffect(() => 0.999).fumble.id, 'wide-open');
});

test('massive damage triggers at half hp max; cleave carryover is exact', () => {
  assert.deepEqual(massiveDamageCheck({ amount: 24, hpMax: 50 }), { triggered: false });
  const shocked = massiveDamageCheck({ amount: 25, hpMax: 50 }, () => 0);
  assert.equal(shocked.triggered, true);
  assert.equal(shocked.saveDC, 15);
  assert.equal(shocked.saveAbility, 'con');
  assert.equal(shocked.onFail.shock.id, 'cardiac-shock');
  // Odd hp maximums round the threshold up (26 needed at 51 hp).
  assert.equal(massiveDamageCheck({ amount: 25, hpMax: 51 }).triggered, false);
  assert.equal(massiveDamageCheck({ amount: 26, hpMax: 51 }, () => 0.9).triggered, true);
  // Cleave: exact leftover, no carryover on a survivor.
  assert.deepEqual(cleaveCarryover({ damage: 17, targetHp: 5 }), { killed: true, carryover: 12 });
  assert.deepEqual(cleaveCarryover({ damage: 4, targetHp: 5 }), { killed: false, carryover: 0 });
  assert.deepEqual(cleaveCarryover({ damage: 5, targetHp: 5 }), { killed: true, carryover: 0 });
});

test('the engine exposes VariantCombat with deterministic seeded rolls', () => {
  const engine = createEngine({ rng: Dice.seededRng(7) });
  assert.equal(typeof engine.VariantCombat.isFlanking, 'function');
  assert.equal(typeof engine.VariantCombat.rollLingeringInjury, 'function');
  // Same seed, same table results — the variant rolls ride the engine rng.
  const twin = createEngine({ rng: Dice.seededRng(7) });
  assert.deepEqual(
    engine.VariantCombat.rollLingeringInjury(),
    twin.VariantCombat.rollLingeringInjury());
  assert.deepEqual(
    engine.VariantCombat.rollFumbleEffect(),
    twin.VariantCombat.rollFumbleEffect());
  // Module-level export carries the same surface for engine-less callers.
  assert.equal(typeof VariantCombat.cleaveCarryover, 'function');
});
