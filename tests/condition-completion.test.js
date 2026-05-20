import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apply as applyCondition,
  isImmuneTo,
  effectsFor
} from '../src/conditions.js';
import { savingThrow } from '../src/checks.js';
import { attackRoll } from '../src/combat.js';
import { createEngine } from '../src/engine.js';
import { startConcentration } from '../src/spellcasting.js';

// === Condition immunity ===

test('Conditions.apply skips application when actor is immune', () => {
  const actor = { id: 'demon', conditionImmunities: ['charmed', 'frightened'] };
  const next = applyCondition(actor, 'charmed');
  assert.equal(next, actor);
  assert.deepEqual(actor.conditions, undefined);
});

test('Conditions.apply still applies non-immune conditions to the same actor', () => {
  const actor = {
    id: 'pc', conditionImmunities: ['charmed'], conditions: []
  };
  const next = applyCondition(actor, 'poisoned');
  assert.ok(next.conditions.includes('poisoned'));
});

test('isImmuneTo predicate matches the same data the apply filter reads', () => {
  const actor = { id: 'pc', conditionImmunities: ['poisoned'] };
  assert.equal(isImmuneTo(actor, 'poisoned'), true);
  assert.equal(isImmuneTo(actor, 'charmed'), false);
});

test('isImmuneTo tolerates an actor without the conditionImmunities field', () => {
  assert.equal(isImmuneTo({ id: 'pc' }, 'poisoned'), false);
});

// === Saving throw auto-fail ===

test('savingThrow with autoFailed:true short-circuits to a failed save', () => {
  const result = savingThrow({ abilityScore: 18, dc: 12, autoFailed: true });
  assert.equal(result.success, false);
  assert.equal(result.autoFailed, true);
  assert.equal(result.d20, 0);
});

test('savingThrow without autoFailed runs the normal d20 path', (t) => {
  t.mock.method(Math, 'random', () => 0.99);     // d20 = 20
  const result = savingThrow({ abilityScore: 18, dc: 15 });
  assert.equal(result.success, true);
  assert.equal('autoFailed' in result, false);
});

// === Auto-crit from within 5 ft ===

test('attackRoll auto-crits on hit against an unconscious target within 5 ft', (t) => {
  t.mock.method(Math, 'random', () => 0.6);     // d20 = 13
  // attackBonus 5, ac 15 → 13 + 5 = 18 hits without being a nat-crit.
  const target = { conditions: ['unconscious'] };
  const result = attackRoll({
    attackBonus: 5, ac: 15, target, attackerDistanceFt: 5
  });
  assert.equal(result.hit, true);
  assert.equal(result.critical, true);   // auto-crit kicked in
});

test('attackRoll does NOT auto-crit on hit when attacker is more than 5 ft away', (t) => {
  t.mock.method(Math, 'random', () => 0.6);
  const target = { conditions: ['paralyzed'] };
  const result = attackRoll({
    attackBonus: 5, ac: 15, target, attackerDistanceFt: 10
  });
  assert.equal(result.hit, true);
  assert.equal(result.critical, false);
});

test('attackRoll does NOT auto-crit on a miss even when target is paralyzed', (t) => {
  t.mock.method(Math, 'random', () => 0.05);     // d20 = 2
  const target = { conditions: ['paralyzed'] };
  const result = attackRoll({
    attackBonus: 0, ac: 15, target, attackerDistanceFt: 5
  });
  assert.equal(result.hit, false);
  assert.equal(result.critical, false);
});

test('attackRoll still nat-20 crits against a target without an auto-crit condition', (t) => {
  t.mock.method(Math, 'random', () => 0.9999);   // d20 = 20
  const result = attackRoll({ attackBonus: 5, ac: 15 });
  assert.equal(result.critical, true);
});

// === Concentration auto-drop (engine binding) ===

test('engine.Conditions.apply auto-drops concentration on an incapacitating condition', () => {
  const engine = createEngine();
  let actor = startConcentration({ id: 'pc' }, { spellId: 'bless', level: 1 }).actor;
  assert.ok(actor.concentration);
  actor = engine.Conditions.apply(actor, 'stunned');
  assert.equal(actor.concentration, undefined);
});

test('engine.Conditions.apply preserves concentration when condition is not incapacitating', () => {
  const engine = createEngine();
  let actor = startConcentration({ id: 'pc' }, { spellId: 'bless', level: 1 }).actor;
  actor = engine.Conditions.apply(actor, 'poisoned');
  assert.ok(actor.concentration);
});

test('engine.Conditions.apply on an immune actor is a no-op (no hook fire, no drop)', () => {
  let conditionApplied = false;
  const engine = createEngine({
    hooks: { onConditionApplied: () => { conditionApplied = true; } }
  });
  let actor = { id: 'demon', conditionImmunities: ['charmed'] };
  const next = engine.Conditions.apply(actor, 'charmed');
  assert.equal(next, actor);
  assert.equal(conditionApplied, false);
});

// === Engine saving throw auto-fail ===

test('engine.Checks.savingThrow auto-fails STR save on a paralyzed actor', () => {
  const engine = createEngine();
  const actor = { id: 'pc', conditions: ['paralyzed'] };
  const result = engine.Checks.savingThrow({
    abilityScore: 18, dc: 12, actor, ability: 'str'
  });
  assert.equal(result.success, false);
  assert.equal(result.autoFailed, true);
});

test('engine.Checks.savingThrow auto-fails DEX save on a stunned actor', () => {
  const engine = createEngine();
  const actor = { id: 'pc', conditions: ['stunned'] };
  const result = engine.Checks.savingThrow({
    abilityScore: 18, dc: 12, actor, ability: 'dex'
  });
  assert.equal(result.autoFailed, true);
});

test('engine.Checks.savingThrow does NOT auto-fail a CON save on a paralyzed actor', () => {
  const engine = createEngine();
  const actor = { id: 'pc', conditions: ['paralyzed'] };
  // CON saves not in the auto-fail list (per SRD: only STR and DEX).
  // Mock to ensure the normal roll happens.
  const result = engine.Checks.savingThrow({
    abilityScore: 18, dc: 5, actor, ability: 'con'
  });
  assert.equal('autoFailed' in result, false);
});

test('engine.Checks.savingThrow without actor uses the normal path', () => {
  const engine = createEngine();
  const result = engine.Checks.savingThrow({
    abilityScore: 14, dc: 12, ability: 'str'
  });
  assert.equal('autoFailed' in result, false);
});

test('engine.Checks.savingThrow without ability uses the normal path', () => {
  const engine = createEngine();
  const actor = { id: 'pc', conditions: ['paralyzed'] };
  const result = engine.Checks.savingThrow({
    abilityScore: 14, dc: 12, actor
  });
  assert.equal('autoFailed' in result, false);
});

test('engine.Conditions.isImmuneTo is re-exported on the bound namespace', () => {
  const engine = createEngine();
  const actor = { id: 'pc', conditionImmunities: ['poisoned'] };
  assert.equal(engine.Conditions.isImmuneTo(actor, 'poisoned'), true);
});

test('engine.Conditions.effectsFor / attackStance are re-exported', () => {
  const engine = createEngine();
  const stance = engine.Conditions.attackStance({
    attacker: {}, target: { conditions: ['prone'] }, attackerDistanceFt: 5
  });
  assert.equal(stance, 'advantage');
  const effects = engine.Conditions.effectsFor({ conditions: ['blinded'] });
  assert.equal(effects.ownAttackDisadvantage, true);
});
