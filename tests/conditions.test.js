import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITIONS, has, apply, remove,
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
