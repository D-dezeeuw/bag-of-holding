import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITIONS, has, apply, remove,
  conditionName, conditionsRequiringSave,
  exhaustion, EXHAUSTION_MAX
} from '../src/conditions.js';

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
  assert.deepEqual(tagged.conditions, [{ name: 'prone' }]);
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

// === v1.6.1: condition record shape ===

test('apply with a string normalises to a record entry', () => {
  const actor = apply({}, 'poisoned');
  assert.deepEqual(actor.conditions[0], { name: 'poisoned' });
});

test('apply with a full record stores all metadata', () => {
  const entry = { name: 'poisoned', source: 'spider', dc: 11, saveAbility: 'con', endsOn: 'turnEnd' };
  const actor = apply({}, entry);
  assert.deepEqual(actor.conditions[0], entry);
});

test('apply string path is idempotent — returns same actor reference on double-apply', () => {
  const a1 = apply({}, 'poisoned');
  const a2 = apply(a1, 'poisoned');
  assert.equal(a2, a1);                            // reference identity preserved
  assert.equal(a2.conditions.length, 1);
});

test('apply record path allows multiple applications (different sources)', () => {
  const a1 = apply({}, { name: 'poisoned', dc: 11, saveAbility: 'con', endsOn: 'turnEnd' });
  const a2 = apply(a1, { name: 'poisoned', dc: 13, saveAbility: 'con', endsOn: 'turnEnd' });
  assert.equal(a2.conditions.length, 2);
});

test('has works on record-shaped entries', () => {
  const actor = apply({}, { name: 'poisoned', dc: 11, saveAbility: 'con', endsOn: 'turnEnd' });
  assert.equal(has(actor, 'poisoned'), true);
  assert.equal(has(actor, 'prone'), false);
});

test('has works on legacy string entries (backward compat)', () => {
  const actor = { conditions: ['stunned'] };
  assert.equal(has(actor, 'stunned'), true);
  assert.equal(has(actor, 'prone'), false);
});

test('remove by name clears all entries with that name', () => {
  let actor = apply({}, { name: 'poisoned', dc: 11, saveAbility: 'con', endsOn: 'turnEnd' });
  actor = apply(actor, { name: 'poisoned', dc: 14, saveAbility: 'con', endsOn: 'turnEnd' });
  assert.equal(actor.conditions.length, 2);
  const cleared = remove(actor, 'poisoned');
  assert.equal(cleared.conditions.length, 0);
});

test('remove works on legacy string entries (backward compat)', () => {
  const actor = { conditions: ['poisoned', 'prone'] };
  const cleared = remove(actor, 'poisoned');
  assert.equal(cleared.conditions.length, 1);
  assert.equal(has(cleared, 'poisoned'), false);
  assert.equal(has(cleared, 'prone'), true);
});

test('conditionName extracts name from a string', () => {
  assert.equal(conditionName('poisoned'), 'poisoned');
});

test('conditionName extracts name from a record', () => {
  assert.equal(conditionName({ name: 'stunned', dc: 10, saveAbility: 'con' }), 'stunned');
});

test('conditionsRequiringSave returns only entries with matching endsOn and save fields', () => {
  const actor = {
    conditions: [
      { name: 'poisoned', saveAbility: 'con', dc: 11, endsOn: 'turnEnd' },
      { name: 'charmed',  saveAbility: 'wis', dc: 14, endsOn: 'turnEnd' },
      { name: 'prone' },                                   // no endsOn
      { name: 'blinded', saveAbility: 'con', endsOn: 'turnEnd' }  // no dc
    ]
  };
  const saves = conditionsRequiringSave(actor, 'turnEnd');
  assert.equal(saves.length, 2);
  assert.equal(saves[0].name, 'poisoned');
  assert.equal(saves[1].name, 'charmed');
});

test('conditionsRequiringSave filters by timing: turnStart vs turnEnd', () => {
  const actor = {
    conditions: [
      { name: 'poisoned', saveAbility: 'con', dc: 11, endsOn: 'turnEnd' },
      { name: 'charmed',  saveAbility: 'wis', dc: 14, endsOn: 'turnStart' }
    ]
  };
  assert.equal(conditionsRequiringSave(actor, 'turnEnd').length, 1);
  assert.equal(conditionsRequiringSave(actor, 'turnStart').length, 1);
});

test('conditionsRequiringSave returns empty array on actor with no conditions', () => {
  assert.deepEqual(conditionsRequiringSave({}, 'turnEnd'), []);
});

test('conditionsRequiringSave tolerates legacy string entries (no save metadata)', () => {
  const actor = { conditions: ['poisoned', 'prone'] };
  assert.deepEqual(conditionsRequiringSave(actor, 'turnEnd'), []);
});
