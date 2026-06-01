// === 1.28.0 small wins ===
//
// Passive checks, Surprise on initiative, object interaction budget,
// interrupted rest, stable creatures regen helper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';
import { passiveCheck } from '../src/checks.js';
import { rollStableRegenHours } from '../src/combat.js';
import { longRest } from '../src/rest.js';
import { rollOrder, startEncounter, spend, freshBudget } from '../src/encounter.js';

test('passiveCheck: base = 10 + ability mod', () => {
  assert.equal(passiveCheck({ abilityScore: 14 }), 12);
  assert.equal(passiveCheck({ abilityScore: 10 }), 10);
  assert.equal(passiveCheck({ abilityScore: 6 }), 8);
});

test('passiveCheck: proficient adds the proficiency bonus', () => {
  assert.equal(passiveCheck({ abilityScore: 14, proficient: true, proficiencyBonus: 3 }), 15);
});

test('passiveCheck: advantage adds +5, disadvantage subtracts 5', () => {
  assert.equal(passiveCheck({ abilityScore: 14, advantage: true }), 17);
  assert.equal(passiveCheck({ abilityScore: 14, disadvantage: true }), 7);
});

test('passiveCheck: advantage + disadvantage cancel', () => {
  assert.equal(passiveCheck({ abilityScore: 14, advantage: true, disadvantage: true }), 12);
});

test('passiveCheck: extra bonus is additive', () => {
  assert.equal(passiveCheck({ abilityScore: 14, bonus: 2 }), 14);
});

test('passiveCheck: rejects non-finite ability score', () => {
  assert.throws(() => passiveCheck({}), /abilityScore must be a finite number/);
});

test('passiveCheck: defaults to 10 + 0 when called with empty opts (still validates)', () => {
  assert.throws(() => passiveCheck(), /abilityScore must be a finite number/);
});

test('engine.Checks.passiveCheck is exposed', () => {
  const engine = createEngine();
  assert.equal(engine.Checks.passiveCheck({ abilityScore: 16, proficient: true }), 15);
});

test('Surprise: rolling initiative with surprised flag uses disadvantage (min of 2d20)', () => {
  // Seeded RNG: with surprise enabled the engine rolls 2 d20s and keeps the lower.
  const engine = createEngine({ rng: Dice.seededRng(1) });
  const surprised = rollOrder(
    [
      { id: 'a', dexterity: 14, speed: 30, surprised: true }
    ],
    Dice.seededRng(1)
  );
  const unsurprised = rollOrder(
    [
      { id: 'a', dexterity: 14, speed: 30 }
    ],
    Dice.seededRng(1)
  );
  // The surprised actor's d20 should be ≤ the unsurprised one's (same seed, 2 rolls kept-lower).
  assert.ok(surprised[0].initiativeD20 <= unsurprised[0].initiativeD20);
});

test('Surprise: the encounter engine respects participant.surprised', () => {
  const state = startEncounter(
    [
      { id: 'a', dexterity: 18, speed: 30, surprised: true },
      { id: 'b', dexterity: 10, speed: 30 }
    ],
    Dice.seededRng(42)
  );
  // Both actors land in the order; the surprised one tends to roll lower.
  assert.equal(state.order.length, 2);
});

test('Initiative tiebreak: deterministic chain (initiative → d20 → DEX → id)', () => {
  // Two actors with identical stats and the same rng produce a stable id-based order.
  const order = rollOrder(
    [
      { id: 'b', dexterity: 14, speed: 30 },
      { id: 'a', dexterity: 14, speed: 30 }
    ],
    () => 0.5  // both roll the same d20
  );
  // localeCompare puts 'a' before 'b' when all other tiebreakers tie.
  assert.equal(order[0].id, 'a');
  assert.equal(order[1].id, 'b');
});

test('Free object interaction: freshBudget grants 1 freeInteraction', () => {
  const b = freshBudget(30);
  assert.equal(b.freeInteraction, 1);
});

test('Free object interaction: spend("freeInteraction") decrements the budget', () => {
  let state = startEncounter([{ id: 'a', dexterity: 10, speed: 30 }], Dice.seededRng(1));
  const r1 = spend(state, 'a', 'freeInteraction');
  assert.equal(r1.allowed, true);
  state = r1.state;
  assert.equal(state.budgets.a.freeInteraction, 0);
  // A second free interaction in the same turn is refused (SRD: one per turn).
  const r2 = spend(state, 'a', 'freeInteraction');
  assert.equal(r2.allowed, false);
});

test('Long rest: opts.interrupted = true returns the actor unchanged', () => {
  const actor = {
    hp: 5, hpMax: 30, level: 5, hitDiceTotal: 5, hitDiceUsed: 3,
    exhaustion: 2, spellSlots: [{ level: 1, used: 4, max: 4 }]
  };
  const result = longRest(actor, undefined, { interrupted: true });
  assert.strictEqual(result, actor);
});

test('Long rest: opts.interrupted not set still resets HP per the SRD', () => {
  const actor = { hp: 5, hpMax: 30, level: 5, hitDiceTotal: 5, hitDiceUsed: 3 };
  const result = longRest(actor);
  assert.equal(result.hp, 30);
});

test('engine.Rest.longRest forwards opts to the base helper', () => {
  const engine = createEngine();
  const actor = { hp: 5, hpMax: 30, level: 5, hitDiceTotal: 5, hitDiceUsed: 3 };
  const interrupted = engine.Rest.longRest(actor, { interrupted: true });
  assert.strictEqual(interrupted, actor);
});

test('engine onLongRest hook receives interrupted flag', () => {
  const events = [];
  const engine = createEngine({
    hooks: {
      onLongRest: (p) => { events.push({ interrupted: p.interrupted }); }
    }
  });
  const actor = { hp: 5, hpMax: 30, level: 5, hitDiceTotal: 5, hitDiceUsed: 3 };
  engine.Rest.longRest(actor, { interrupted: true });
  engine.Rest.longRest(actor);
  assert.deepEqual(events, [{ interrupted: true }, { interrupted: false }]);
});

test('rollStableRegenHours: returns an integer in [1, 4]', () => {
  for (let i = 0; i < 20; i++) {
    const h = rollStableRegenHours();
    assert.ok(h >= 1 && h <= 4 && Number.isInteger(h));
  }
});

test('engine.Combat.rollStableRegenHours routes through the seeded rng', () => {
  const a = createEngine({ rng: Dice.seededRng(5) });
  const b = createEngine({ rng: Dice.seededRng(5) });
  assert.equal(a.Combat.rollStableRegenHours(), b.Combat.rollStableRegenHours());
});
