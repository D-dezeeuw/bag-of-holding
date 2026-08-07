import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITIONS, has, apply, remove, effectsFor,
  conditionName, conditionsRequiringSave,
  exhaustion, EXHAUSTION_MAX
} from '../src/conditions.js';
import { createEngine as createEngineForConditions } from '../src/engine.js';

test('CONDITIONS holds the SRD 5.2 boolean list and excludes exhaustion', () => {
  assert.equal(CONDITIONS.includes('exhaustion'), false);
  assert.equal(CONDITIONS.includes('prone'), true);
  assert.equal(CONDITIONS.length, 14);
});

test('apply/has/remove round-trip', () => {
  const actor = { id: 'pc' };
  const blinded = apply(actor, 'blinded');
  assert.equal(has(blinded, 'blinded'), true);
  const cleared = remove(blinded, 'blinded');
  assert.equal(has(cleared, 'blinded'), false);
});

test('apply rejects unknown condition', () => {
  assert.throws(() => apply({}, 'cursed'));
});

test('exhaustion clamps to [0, 6]', () => {
  assert.equal(exhaustion.level({}), 0);
  assert.equal(exhaustion.level({ exhaustion: -3 }), 0);
  assert.equal(exhaustion.level({ exhaustion: 9 }), EXHAUSTION_MAX);
});

test('exhaustion.gain and reduce are immutable and bounded', () => {
  const actor = { id: 'pc', exhaustion: 2 };
  const tired = exhaustion.gain(actor, 2);
  assert.equal(tired.exhaustion, 4);
  assert.equal(actor.exhaustion, 2);            // original untouched

  const rested = exhaustion.reduce(tired);
  assert.equal(rested.exhaustion, 3);

  const dead = exhaustion.gain(actor, 99);
  assert.equal(dead.exhaustion, EXHAUSTION_MAX);
  assert.equal(exhaustion.isDead(dead), true);
});

test('exhaustion penalties scale linearly with level', () => {
  const actor = { exhaustion: 3 };
  assert.equal(exhaustion.modifierToD20Tests(actor), -6);
  assert.equal(exhaustion.speedPenalty(actor), 15);
});

test('exhaustion.set overwrites the level and clamps to bounds', () => {
  const actor = { id: 'pc', exhaustion: 2 };
  const reset = exhaustion.set(actor, 0);
  assert.equal(reset.exhaustion, 0);
  assert.equal(actor.exhaustion, 2);            // original untouched

  // Clamping: values outside [0, 6] saturate.
  assert.equal(exhaustion.set(actor, -3).exhaustion, 0);
  assert.equal(exhaustion.set(actor, 99).exhaustion, EXHAUSTION_MAX);
});

test('exhaustion.gain defaults to a single level', () => {
  const actor = { exhaustion: 1 };
  assert.equal(exhaustion.gain(actor).exhaustion, 2);
});

test('exhaustion.reduce defaults to a single level', () => {
  const actor = { exhaustion: 3 };
  assert.equal(exhaustion.reduce(actor).exhaustion, 2);
});

test('apply tolerates an actor with no prior conditions array', () => {
  const actor = {};
  const tagged = apply(actor, 'prone');
  assert.deepEqual(tagged.conditions, ['prone']);
});

test('remove tolerates an actor with no prior conditions array', () => {
  const actor = {};
  const stripped = remove(actor, 'prone');
  assert.deepEqual(stripped.conditions, []);
});

test('has returns false when actor.conditions is missing or not an array', () => {
  assert.equal(has({}, 'prone'), false);
  assert.equal(has({ conditions: 'not-an-array' }, 'prone'), false);
});

// ─── Condition records (restored) ────────────────────────────────────────────
//
// Records shipped in 1.6.1 and the 2.1.0 merge silently dropped them, taking
// conditionName and conditionsRequiringSave with them. A host could apply a
// condition with a save DC and had no way to ask what needed saving against —
// so nothing ever cleared on a save.

test('conditionName reads both entry shapes', () => {
  assert.equal(conditionName('poisoned'), 'poisoned');
  assert.equal(conditionName({ name: 'poisoned', dc: 13 }), 'poisoned');
});

test('a record survives apply/has/remove alongside bare strings', () => {
  let actor = apply({ conditions: ['prone'] },
    { name: 'poisoned', source: 'giant-spider', saveAbility: 'con', dc: 11, endsOn: 'turnEnd' });
  assert.ok(has(actor, 'poisoned'), 'has() must match on the record name');
  assert.ok(has(actor, 'prone'), 'the bare string is untouched');

  actor = remove(actor, 'poisoned');
  assert.equal(has(actor, 'poisoned'), false);
  assert.deepEqual(actor.conditions, ['prone']);
});

test('re-applying with metadata upgrades a bare condition rather than duplicating it', () => {
  const actor = apply({ conditions: ['poisoned'] },
    { name: 'poisoned', saveAbility: 'con', dc: 13, endsOn: 'turnEnd' });
  assert.equal(actor.conditions.length, 1, 'no duplicate entry');
  assert.equal(conditionName(actor.conditions[0]), 'poisoned');
  assert.equal(actor.conditions[0].dc, 13, 'the save metadata must not be dropped');
});

test('effects apply identically whichever shape the entry has', () => {
  const asString = effectsFor({ conditions: ['poisoned'] });
  const asRecord = effectsFor({ conditions: [{ name: 'poisoned', dc: 11 }] });
  assert.deepEqual(asRecord, asString);
});

test('the vocabulary gate applies to a record name', () => {
  assert.throws(() => apply({}, { name: 'blided', dc: 10 }), /Unknown condition: blided/);
});

test('immunity is honoured for records too', () => {
  const actor = { conditionImmunities: ['poisoned'], conditions: [] };
  assert.deepEqual(apply(actor, { name: 'poisoned', dc: 11 }).conditions, []);
});

test('conditionsRequiringSave returns only entries the engine can actually clear', () => {
  const actor = { conditions: [
    'prone',                                                              // no metadata
    { name: 'frightened', endsOn: 'turnEnd', saveAbility: 'wis', dc: 13 },
    { name: 'poisoned',   endsOn: 'turnEnd' },                          // no ability/dc
    { name: 'charmed',    endsOn: 'turnStart', saveAbility: 'wis', dc: 12 },
  ] };
  const due = conditionsRequiringSave(actor, 'turnEnd');
  assert.equal(due.length, 1);
  assert.equal(due[0].name, 'frightened');
  assert.equal(conditionsRequiringSave(actor, 'turnStart')[0].name, 'charmed');
  assert.deepEqual(conditionsRequiringSave({}, 'turnEnd'), []);
});

test('the bound engine namespace exposes the record readers', () => {
  const e = createEngineForConditions();
  assert.equal(typeof e.Conditions.conditionName, 'function');
  assert.equal(typeof e.Conditions.conditionsRequiringSave, 'function');
  assert.equal(e.Conditions.conditionName({ name: 'prone' }), 'prone');
});
