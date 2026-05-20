import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMastery, MASTERY_PROPERTIES } from '../src/combat.js';
import items from '../src/srd/items.js';

const HIT = { hit: true, attackBonus: 3 };
const MISS = { hit: false, attackBonus: 3 };

test('MASTERY_PROPERTIES lists the SRD 5.2 eight', () => {
  assert.deepEqual(
    [...MASTERY_PROPERTIES].sort(),
    ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex']
  );
});

test('every SRD weapon carries a recognised mastery property', () => {
  for (const item of Object.values(items)) {
    if (item.type !== 'weapon') continue;
    assert.ok(item.mastery, `${item.id} missing mastery`);
    assert.ok(MASTERY_PROPERTIES.includes(item.mastery),
      `${item.id} has unknown mastery ${item.mastery}`);
  }
});

test('no rider when weapon has no mastery', () => {
  assert.deepEqual(applyMastery({}, {}, HIT), { kind: 'none' });
});

test('no rider when weapon itself is null or undefined', () => {
  // Covers the optional-chain short-circuit on `weapon?.mastery`.
  assert.deepEqual(applyMastery(null,      {}, HIT), { kind: 'none' });
  assert.deepEqual(applyMastery(undefined, {}, HIT), { kind: 'none' });
});

test('graze fires on miss only', () => {
  // No attacker passed → proficiencyBonus defaults to 0, so the
  // damage collapses to `attackBonus - 0 = 3`. Same answer as the
  // pre-1.0.1 buggy formula; the divergent case is pinned below.
  const glaive = { mastery: 'graze' };
  assert.deepEqual(applyMastery(glaive, {}, MISS), { kind: 'graze', damage: 3 });
  assert.deepEqual(applyMastery(glaive, {}, HIT),  { kind: 'none' });
});

test('graze damage equals the ability modifier, not the full attack bonus', () => {
  // SRD 5.2 § Weapon Mastery Properties — Graze: damage equals the
  // ability modifier used to make the attack. A L5 Fighter with
  // +3 STR (ability mod) and +3 proficiency has `attackBonus = 6`,
  // so the rider must report 3 (the ability mod), not 6.
  const rider = applyMastery(
    { mastery: 'graze' },
    {},
    { hit: false, attackBonus: 6 },
    { proficiencyBonus: 3 }
  );
  assert.deepEqual(rider, { kind: 'graze', damage: 3 });
});

test('vex / sap / cleave / nick / push / slow / topple fire on hit only', () => {
  for (const m of ['vex', 'sap', 'cleave', 'nick', 'push', 'slow', 'topple']) {
    const w = { mastery: m };
    assert.equal(applyMastery(w, {}, MISS).kind, 'none', `${m} should not fire on miss`);
    assert.equal(applyMastery(w, {}, HIT).kind,  m,      `${m} should fire on hit`);
  }
});

test('topple builds a Constitution save DC = 8 + ability mod + prof bonus', () => {
  // SRD 5.2 § Weapon Mastery Properties — Topple. The attacker has
  // attackBonus +3 and proficiency +2, so their ability modifier is
  // 3 - 2 = 1, and the DC is 8 + 1 + 2 = 11. The pre-1.0.1 bug
  // returned 13 by adding the proficiency bonus twice.
  const weapon = { mastery: 'topple' };
  const rider = applyMastery(weapon, {}, HIT, { proficiencyBonus: 2 });
  assert.equal(rider.kind, 'topple');
  assert.equal(rider.ability, 'con');
  assert.equal(rider.onFail, 'prone');
  assert.equal(rider.saveDC, 8 + 1 + 2);
});

test('topple DC matches the SRD for a L5 Fighter (+4 STR, +3 prof)', () => {
  // Canonical SRD example: attackBonus = +4 ability + +3 prof = +7,
  // so the DC is 8 + 4 + 3 = 15. The pre-1.0.1 bug produced 18.
  const rider = applyMastery(
    { mastery: 'topple' },
    {},
    { hit: true, attackBonus: 7 },
    { proficiencyBonus: 3 }
  );
  assert.equal(rider.saveDC, 15);
});

test('unknown mastery throws', () => {
  assert.throws(() => applyMastery({ mastery: 'pancake' }, {}, HIT));
});

test('applyMastery treats a missing attackResult as a miss (hit falsy)', () => {
  // `!!attackResult?.hit` short-circuits to false when attackResult is
  // undefined. Hit-gated properties return 'none'; graze fires.
  assert.deepEqual(applyMastery({ mastery: 'vex' },   {}, undefined), { kind: 'none' });
  assert.deepEqual(applyMastery({ mastery: 'graze' }, {}, undefined), { kind: 'graze', damage: 0 });
});

test('graze defaults its damage to 0 when no attackBonus is reported', () => {
  // Covers the `?? 0` branch on attackResult.attackBonus.
  const rider = applyMastery({ mastery: 'graze' }, {}, { hit: false });
  assert.equal(rider.kind, 'graze');
  assert.equal(rider.damage, 0);
});

test('topple builds DC = 8 + 0 + 0 with no attacker mods supplied', () => {
  // Covers both `?? 0` fallbacks (attackBonus, proficiencyBonus) and
  // the `attacker = {}` parameter default — called with three args only.
  const rider = applyMastery({ mastery: 'topple' }, {}, { hit: true });
  assert.equal(rider.kind, 'topple');
  assert.equal(rider.saveDC, 8);
});

test('topple tolerates a null attacker (short-circuits proficiencyBonus chain)', () => {
  // Explicitly passes `null` for attacker — covers the optional-chain
  // short-circuit on `attacker?.proficiencyBonus`. With profBonus
  // defaulting to 0, the ability mod is recovered as `attackBonus - 0
  // = 3`, so the DC is 8 + 3 + 0 = 11.
  const rider = applyMastery({ mastery: 'topple' }, {}, HIT, null);
  assert.equal(rider.kind, 'topple');
  assert.equal(rider.saveDC, 8 + 3 + 0);
});
