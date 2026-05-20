import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  damageRoll,
  applyDamageModifiers,
  grantTempHp,
  applyDamage,
  heal,
  dropToZero
} from '../src/combat.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';

// === damageRoll: damageType propagation ===

test('damageRoll surfaces damageType when provided', () => {
  const result = damageRoll(
    { damageDice: '1d6', damageMod: 2, damageType: 'fire' },
    () => 0.5
  );
  assert.equal(result.damageType, 'fire');
});

test('damageRoll omits damageType when not provided (legacy shape preserved)', () => {
  const result = damageRoll({ damageDice: '1d6', damageMod: 2 }, () => 0.5);
  assert.equal('damageType' in result, false);
});

// === applyDamageModifiers ===

test('applyDamageModifiers: no type → amount unchanged', () => {
  assert.equal(applyDamageModifiers({}, { amount: 10 }), 10);
});

test('applyDamageModifiers: resistance halves (floor)', () => {
  const actor = { damageResistances: ['fire'] };
  assert.equal(applyDamageModifiers(actor, { amount: 11, type: 'fire' }), 5);
});

test('applyDamageModifiers: vulnerability doubles', () => {
  const actor = { damageVulnerabilities: ['cold'] };
  assert.equal(applyDamageModifiers(actor, { amount: 4, type: 'cold' }), 8);
});

test('applyDamageModifiers: immunity zeroes', () => {
  const actor = { damageImmunities: ['poison'] };
  assert.equal(applyDamageModifiers(actor, { amount: 999, type: 'poison' }), 0);
});

test('applyDamageModifiers: immunity wins over vulnerability (and resistance)', () => {
  const actor = {
    damageImmunities: ['fire'],
    damageResistances: ['fire'],
    damageVulnerabilities: ['fire']
  };
  assert.equal(applyDamageModifiers(actor, { amount: 100, type: 'fire' }), 0);
});

test('applyDamageModifiers: SRD order — resistance then vulnerability', () => {
  // Both apply: ⌊11/2⌋ = 5, then ×2 = 10. (Not 11×2/2 = 11.)
  const actor = {
    damageResistances: ['acid'],
    damageVulnerabilities: ['acid']
  };
  assert.equal(applyDamageModifiers(actor, { amount: 11, type: 'acid' }), 10);
});

test('applyDamageModifiers: untagged actor takes full damage', () => {
  assert.equal(applyDamageModifiers({}, { amount: 7, type: 'fire' }), 7);
});

test('applyDamageModifiers: type that does not match actor is unaffected', () => {
  const actor = { damageResistances: ['fire'] };
  assert.equal(applyDamageModifiers(actor, { amount: 7, type: 'cold' }), 7);
});

test('applyDamageModifiers rejects non-integer or negative amount', () => {
  assert.throws(() => applyDamageModifiers({}, { amount: -1 }));
  assert.throws(() => applyDamageModifiers({}, { amount: 1.5 }));
});

// === grantTempHp ===

test('grantTempHp sets the field when actor has none', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 20 };
  const next = grantTempHp(actor, 5);
  assert.equal(next.tempHp, 5);
});

test('grantTempHp replaces when new amount is larger', () => {
  const actor = { id: 'pc', tempHp: 3 };
  const next = grantTempHp(actor, 7);
  assert.equal(next.tempHp, 7);
});

test('grantTempHp keeps existing when new amount is smaller or equal', () => {
  const actor = { id: 'pc', tempHp: 7 };
  assert.equal(grantTempHp(actor, 5), actor);
  assert.equal(grantTempHp(actor, 7), actor);
});

test('grantTempHp rejects non-integer or negative', () => {
  assert.throws(() => grantTempHp({}, -1));
  assert.throws(() => grantTempHp({}, 1.5));
});

// === applyDamage — happy paths ===

test('applyDamage: untyped damage subtracts from HP', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30 };
  const result = applyDamage(actor, { amount: 7 });
  assert.equal(result.outcome, 'damaged');
  assert.equal(result.hpBefore, 20);
  assert.equal(result.hpAfter, 13);
  assert.equal(result.actor.hp, 13);
});

test('applyDamage: resistance halves before HP subtract', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30, damageResistances: ['fire'] };
  const result = applyDamage(actor, { amount: 10, type: 'fire' });
  assert.equal(result.finalAmount, 5);
  assert.equal(result.hpAfter, 15);
});

test('applyDamage: vulnerability doubles', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30, damageVulnerabilities: ['cold'] };
  const result = applyDamage(actor, { amount: 4, type: 'cold' });
  assert.equal(result.finalAmount, 8);
  assert.equal(result.hpAfter, 12);
});

test('applyDamage: immunity → outcome "immune", actor untouched', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30, damageImmunities: ['poison'] };
  const result = applyDamage(actor, { amount: 99, type: 'poison' });
  assert.equal(result.outcome, 'immune');
  assert.equal(result.finalAmount, 0);
  assert.equal(result.actor.hp, 20);
});

test('applyDamage: tempHp absorbs first', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30, tempHp: 5 };
  const result = applyDamage(actor, { amount: 3 });
  assert.equal(result.tempHpAbsorbed, 3);
  assert.equal(result.hpBefore, 20);
  assert.equal(result.hpAfter, 20);
  assert.equal(result.actor.tempHp, 2);
  assert.equal(result.outcome, 'absorbed');
});

test('applyDamage: tempHp absorbs partially, surplus carries to HP', () => {
  const actor = { id: 'pc', hp: 20, hpMax: 30, tempHp: 5 };
  const result = applyDamage(actor, { amount: 8 });
  assert.equal(result.tempHpAbsorbed, 5);
  assert.equal(result.actor.tempHp, 0);
  assert.equal(result.actor.hp, 17);
  assert.equal(result.outcome, 'damaged');
});

test('applyDamage: dropToZero on crossing 0 HP, fires Unconscious', () => {
  const actor = { id: 'pc', hp: 3, hpMax: 30, conditions: [] };
  const result = applyDamage(actor, { amount: 5 });
  assert.equal(result.outcome, 'downed');
  assert.equal(result.actor.hp, 0);
  assert.ok(result.actor.conditions.includes('unconscious'));
  assert.ok(result.actor.deathSaves);
});

test('applyDamage: massive damage instant death (remaining ≥ hpMax)', () => {
  const actor = { id: 'pc', hp: 5, hpMax: 10 };
  // damage 20 → hpBefore 5 → remaining 15 ≥ hpMax 10 → instant death.
  const result = applyDamage(actor, { amount: 20 });
  assert.equal(result.outcome, 'dead');
  assert.equal(result.actor.deathSaves.dead, true);
});

test('applyDamage: just-enough overkill stops at downed when remaining < hpMax', () => {
  const actor = { id: 'pc', hp: 5, hpMax: 10 };
  // damage 12 → hpBefore 5 → remaining 7 < hpMax 10 → downed (not dead).
  const result = applyDamage(actor, { amount: 12 });
  assert.equal(result.outcome, 'downed');
  assert.equal(result.actor.deathSaves.dead, false);
});

test('applyDamage at 0 HP routes through damage-while-down (failure)', () => {
  let actor = dropToZero({ id: 'pc', hpMax: 12, conditions: [] });
  const result = applyDamage(actor, { amount: 3 });
  // Not massive, not crit → 1 failure on the tracker, outcome "downed".
  assert.equal(result.outcome, 'downed');
  assert.equal(result.actor.deathSaves.failures, 1);
});

test('applyDamage at 0 HP with critical → two failures', () => {
  let actor = dropToZero({ id: 'pc', hpMax: 12 });
  const result = applyDamage(actor, { amount: 3, critical: true });
  assert.equal(result.actor.deathSaves.failures, 2);
});

test('applyDamage at 0 HP with massive damage → instant death', () => {
  let actor = dropToZero({ id: 'pc', hpMax: 8 });
  const result = applyDamage(actor, { amount: 8 });
  assert.equal(result.outcome, 'dead');
});

test('applyDamage preserves source tag on the result envelope', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 30 };
  const result = applyDamage(actor, { amount: 3, source: 'fireball-1' });
  assert.equal(result.source, 'fireball-1');
});

test('applyDamage omits source when not provided', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 30 };
  const result = applyDamage(actor, { amount: 3 });
  assert.equal('source' in result, false);
});

test('applyDamage rejects non-integer / negative amount', () => {
  assert.throws(() => applyDamage({}, { amount: -1 }));
  assert.throws(() => applyDamage({}, { amount: 1.5 }));
});

test('applyDamage defaults amount to 0 (no-op)', () => {
  const actor = { id: 'pc', hp: 10 };
  const result = applyDamage(actor, {});
  assert.equal(result.outcome, 'damaged');
  assert.equal(result.hpAfter, 10);
});

test('applyDamage immune outcome tolerates an actor without hp set', () => {
  // Covers the `actor.hp ?? 0` fallback in the immunity branch.
  const actor = { id: 'pc', damageImmunities: ['fire'] };
  const result = applyDamage(actor, { amount: 5, type: 'fire' });
  assert.equal(result.outcome, 'immune');
  assert.equal(result.hpBefore, 0);
  assert.equal(result.hpAfter, 0);
});

test('applyDamage on an actor with no hp set treats it as 0 (routes through downed path)', () => {
  // Covers the `actor.hp ?? 0` fallback on the main hpBefore line —
  // an actor with no hp acts as if it's at 0, so damage routes
  // through `applyDamageWhileDown`.
  const actor = { id: 'pc' };
  const result = applyDamage(actor, { amount: 3 });
  // Without an existing tracker, applyDamageWhileDown synthesises one.
  assert.equal(result.outcome, 'downed');
  assert.equal(result.actor.deathSaves.failures, 1);
});

test('applyDamage with 0 finalAmount + no tempHp returns damaged with hp unchanged', () => {
  const actor = { id: 'pc', hp: 10, damageImmunities: ['fire'] };
  // Immune to fire AND no other modifier — outcome should be 'immune'.
  const result = applyDamage(actor, { amount: 5, type: 'fire' });
  assert.equal(result.outcome, 'immune');
});

test('applyDamage with full tempHp absorption and no surplus → absorbed', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 30, tempHp: 5 };
  const result = applyDamage(actor, { amount: 5 });
  assert.equal(result.outcome, 'absorbed');
  assert.equal(result.actor.tempHp, 0);
});

// === heal ===

test('heal restores HP up to hpMax', () => {
  const actor = { id: 'pc', hp: 5, hpMax: 20 };
  const result = heal(actor, 10);
  assert.equal(result.healed, 10);
  assert.equal(result.actor.hp, 15);
});

test('heal caps at hpMax', () => {
  const actor = { id: 'pc', hp: 18, hpMax: 20 };
  const result = heal(actor, 10);
  assert.equal(result.healed, 2);
  assert.equal(result.actor.hp, 20);
});

test('heal at 0 HP wakes up an Unconscious actor and clears death saves', () => {
  let actor = dropToZero({ id: 'pc', hpMax: 20, conditions: [] });
  const result = heal(actor, 3);
  assert.equal(result.actor.hp, 3);
  assert.ok(!result.actor.conditions.includes('unconscious'));
  assert.equal(result.actor.deathSaves.successes, 0);
  assert.equal(result.actor.deathSaves.failures, 0);
});

test('heal 0 is a no-op', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 20 };
  const result = heal(actor, 0);
  assert.equal(result.healed, 0);
  assert.equal(result.actor, actor);
});

test('heal does not add tempHp', () => {
  const actor = { id: 'pc', hp: 10, hpMax: 20, tempHp: 0 };
  const result = heal(actor, 5);
  assert.equal(result.actor.tempHp, 0);
});

test('heal rejects non-integer / negative', () => {
  assert.throws(() => heal({}, -1));
  assert.throws(() => heal({}, 1.5));
});

test('heal of an actor with no hp / hpMax (unbounded) caps at Infinity', () => {
  const actor = { id: 'pc' };
  const result = heal(actor, 5);
  assert.equal(result.actor.hp, 5);
});

test('heal at 0 HP without Unconscious condition just adds HP', () => {
  const actor = { id: 'pc', hp: 0, hpMax: 10 };
  const result = heal(actor, 3);
  assert.equal(result.actor.hp, 3);
});

// === Engine binding ===

test('engine.Combat.applyDamage fires onDeath on instant death', () => {
  let fired = false;
  const engine = createEngine({ hooks: { onDeath: () => { fired = true; } } });
  const actor = { id: 'pc', hp: 5, hpMax: 8 };
  const result = engine.Combat.applyDamage(actor, { amount: 14 });
  assert.equal(result.outcome, 'dead');
  assert.equal(fired, true);
});

test('engine.Combat.applyDamage fires onConditionApplied on downed', () => {
  const seen = [];
  const engine = createEngine({
    hooks: { onConditionApplied: (p) => { seen.push(p.condition); } }
  });
  const actor = { id: 'pc', hp: 3, hpMax: 30, conditions: [] };
  engine.Combat.applyDamage(actor, { amount: 5 });
  assert.ok(seen.includes('unconscious'));
});

test('engine.Combat.applyDamage does not refire onDeath on an already-dead actor', () => {
  let count = 0;
  const engine = createEngine({ hooks: { onDeath: () => { count++; } } });
  const dead = {
    id: 'pc', hp: 0, hpMax: 8,
    deathSaves: { successes: 0, failures: 3, stable: false, dead: true }
  };
  engine.Combat.applyDamage(dead, { amount: 8 });
  assert.equal(count, 0);
});

test('engine.Combat.applyDamage does not refire onConditionApplied when already unconscious', () => {
  let count = 0;
  const engine = createEngine({
    hooks: { onConditionApplied: () => { count++; } }
  });
  // Actor is at HP 1 and already unconscious. Dropping to 0 from
  // damage shouldn't re-fire onConditionApplied for unconscious.
  const actor = {
    id: 'pc', hp: 1, hpMax: 30, conditions: ['unconscious'],
    deathSaves: { successes: 0, failures: 0, stable: false, dead: false }
  };
  engine.Combat.applyDamage(actor, { amount: 1 });
  assert.equal(count, 0);
});

test('engine.Combat.heal is re-exported and works', () => {
  const engine = createEngine();
  const result = engine.Combat.heal({ id: 'pc', hp: 5, hpMax: 20 }, 3);
  assert.equal(result.actor.hp, 8);
});

test('engine.Combat.grantTempHp is re-exported', () => {
  const engine = createEngine();
  const next = engine.Combat.grantTempHp({ id: 'pc' }, 4);
  assert.equal(next.tempHp, 4);
});

test('engine.Combat.applyDamageModifiers is re-exported', () => {
  const engine = createEngine();
  assert.equal(
    engine.Combat.applyDamageModifiers({ damageResistances: ['fire'] },
      { amount: 8, type: 'fire' }),
    4
  );
});
