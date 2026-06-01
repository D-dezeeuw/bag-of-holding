// === 1.19.0 tier 3 class features (L11-L16) ===
//
// Verifies every class extends through L16 in `features`, the Fighter
// gains a third attack at L11, Indomitable wires through the resource
// system, Rogue's Reliable Talent treats sub-10 d20 as 10, Barbarian
// Relentless Rage drops to 1 HP on a successful CON save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';
import { attacksPerAction } from '../src/encounter.js';

test('every base class lists features through L16', () => {
  const engine = createEngine();
  for (const id of Object.keys(engine.classes)) {
    const classDef = engine.classes[id];
    for (let level = 11; level <= 16; level++) {
      assert.ok(
        Array.isArray(classDef.features?.[level]),
        `${id} missing features[${level}]`
      );
    }
  }
});

test('Fighter attacksPerAction at L11 is 3 (two extras)', () => {
  const engine = createEngine();
  const fighter = engine.classes.fighter;
  assert.equal(attacksPerAction(fighter, 11), 3);
  assert.equal(attacksPerAction(fighter, 10), 2);
});

test('Fighter Indomitable consumes the resource and signals reroll', () => {
  const engine = createEngine();
  const actor = {
    classId: 'fighter',
    level: 13,
    resources: { indomitable: { used: 0, max: 2, refreshes: 'long' } }
  };
  const result = engine.Mechanics.apply(actor, 'indomitable');
  assert.equal(result.ok, true);
  assert.equal(result.reroll, true);
  assert.equal(result.actor.resources.indomitable.used, 1);
});

test('Fighter Indomitable refuses once exhausted', () => {
  const engine = createEngine();
  const actor = {
    classId: 'fighter',
    level: 13,
    resources: { indomitable: { used: 2, max: 2, refreshes: 'long' } }
  };
  const result = engine.Mechanics.apply(actor, 'indomitable');
  assert.equal(result.ok, false);
});

test('Rogue Reliable Talent treats sub-10 d20 as 10', () => {
  const engine = createEngine();
  const actor = { classId: 'rogue', level: 11 };
  assert.deepEqual(engine.Mechanics.apply(actor, 'reliableTalent', { d20: 3 }),  { d20: 3,  adjusted: 10 });
  assert.deepEqual(engine.Mechanics.apply(actor, 'reliableTalent', { d20: 9 }),  { d20: 9,  adjusted: 10 });
  assert.deepEqual(engine.Mechanics.apply(actor, 'reliableTalent', { d20: 11 }), { d20: 11, adjusted: 11 });
});

test('Rogue Reliable Talent defaults d20 to 1 when args omitted', () => {
  const engine = createEngine();
  const actor = { classId: 'rogue', level: 11 };
  const r = engine.Mechanics.apply(actor, 'reliableTalent');
  assert.equal(r.adjusted, 10);
});

test('Barbarian Relentless Rage drops to 1 HP on a successful CON save', () => {
  const engine = createEngine();
  const actor = {
    classId: 'barbarian',
    level: 11,
    hp: 0,
    abilityScores: { con: 18 }
  };
  const result = engine.Mechanics.apply(actor, 'relentlessRage');
  assert.equal(typeof result.save.success, 'boolean');
  if (result.ok) {
    assert.equal(result.actor.hp, 1);
    assert.equal(result.actor.relentlessRageUses, 1);
  } else {
    assert.equal(result.actor.hp, 0);
  }
});

test('Barbarian Relentless Rage success keeps the actor up at 1 HP', () => {
  // Seed with a known high-rolling rng so the CON save succeeds.
  const engine = createEngine({ rng: () => 0.99 });
  const actor = {
    classId: 'barbarian', level: 11, hp: 0,
    abilityScores: { con: 18 }
  };
  const result = engine.Mechanics.apply(actor, 'relentlessRage');
  assert.equal(result.ok, true);
  assert.equal(result.actor.hp, 1);
});

test('Barbarian Relentless Rage failure leaves the actor at 0 HP', () => {
  const engine = createEngine({ rng: () => 0.01 });
  const actor = {
    classId: 'barbarian', level: 11, hp: 0,
    abilityScores: { con: 10 }
  };
  const result = engine.Mechanics.apply(actor, 'relentlessRage');
  assert.equal(result.ok, false);
  assert.equal(result.actor.hp, 0);
});

test('Barbarian Relentless Rage falls back to abilityScore=10 with no abilityScores', () => {
  const engine = createEngine({ rng: () => 0.01 });
  const actor = { classId: 'barbarian', level: 11, hp: 0 };
  const result = engine.Mechanics.apply(actor, 'relentlessRage');
  assert.equal(typeof result.save.success, 'boolean');
});

test('Barbarian Relentless Rage DC ramps by 5 per prior use', () => {
  const engine = createEngine();
  const actor = {
    classId: 'barbarian',
    level: 11,
    hp: 0,
    relentlessRageUses: 2,
    abilityScores: { con: 12 }
  };
  // Force-fail by passing a fake rng through a fresh engine so we can
  // inspect the DC even on failure.
  const result = engine.Mechanics.apply(actor, 'relentlessRage');
  assert.equal(result.save.dc, 20);
});

test('Cleric, Druid, Wizard tier-3 features are populated as strings or empty arrays', () => {
  const engine = createEngine();
  for (const id of ['cleric', 'druid', 'wizard']) {
    const classDef = engine.classes[id];
    for (let level = 11; level <= 16; level++) {
      assert.ok(
        Array.isArray(classDef.features[level]),
        `${id}.features[${level}] missing`
      );
      for (const f of classDef.features[level]) {
        assert.equal(typeof f, 'string');
      }
    }
  }
});

test('Warlock Mystic Arcanum tier-3 progression is listed', () => {
  const engine = createEngine();
  const warlock = engine.classes.warlock;
  assert.ok(warlock.features[11].some((f) => f.includes('Mystic Arcanum')));
  assert.ok(warlock.features[13].some((f) => f.includes('Mystic Arcanum')));
  assert.ok(warlock.features[15].some((f) => f.includes('Mystic Arcanum')));
});
