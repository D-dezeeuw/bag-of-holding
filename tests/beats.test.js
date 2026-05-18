import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEmptyBeat, validateBeat, ARCHETYPE_ROLES } from '../src/beats/schema.js';
import { createThread, currentBeat, isReady, isComplete, advance } from '../src/beats/thread.js';
import { castArchetypes } from '../src/beats/casting.js';

test('makeEmptyBeat + validateBeat yields a valid beat', () => {
  const beat = makeEmptyBeat('beat.test');
  beat.dramaticPurpose = 'Test purpose';
  const result = validateBeat(beat);
  assert.ok(result.valid, JSON.stringify(result.errors));
});

test('validateBeat reports missing required fields', () => {
  const result = validateBeat({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});

test('validateBeat rejects wrong-shaped fields', () => {
  const result = validateBeat({
    id: 123,
    dramaticPurpose: 'x',
    targetPlaytimeMinutes: 'soon',
    setRequiredFlags: 'not-an-array'
  });
  assert.equal(result.valid, false);
});

test('archetype role vocabulary is non-empty', () => {
  assert.ok(ARCHETYPE_ROLES.includes('authority'));
  assert.ok(ARCHETYPE_ROLES.includes('antagonist'));
});

test('thread starts at index 0', () => {
  const a = { ...makeEmptyBeat('a'), dramaticPurpose: 'a' };
  const b = { ...makeEmptyBeat('b'), dramaticPurpose: 'b' };
  const thread = createThread([a, b]);
  assert.equal(currentBeat(thread).id, 'a');
});

test('isReady checks prerequisites', () => {
  const beat = { ...makeEmptyBeat('x'), dramaticPurpose: 'x', prerequisites: ['gate.open'] };
  assert.equal(isReady(beat, { flags: {} }), false);
  assert.equal(isReady(beat, { flags: { 'gate.open': true } }), true);
});

test('isComplete checks setRequiredFlags', () => {
  const beat = { ...makeEmptyBeat('x'), dramaticPurpose: 'x', setRequiredFlags: ['done.x'] };
  assert.equal(isComplete(beat, { flags: {} }), false);
  assert.equal(isComplete(beat, { flags: { 'done.x': true } }), true);
});

test('advance walks forward when current beat is complete', () => {
  const a = { ...makeEmptyBeat('a'), dramaticPurpose: 'a', setRequiredFlags: ['done.a'] };
  const b = { ...makeEmptyBeat('b'), dramaticPurpose: 'b', setRequiredFlags: ['done.b'] };
  const thread = createThread([a, b]);

  const blocked = advance(thread, { flags: {} });
  assert.equal(blocked.advanced, false);

  const moved = advance(thread, { flags: { 'done.a': true } });
  assert.equal(moved.advanced, true);
  assert.equal(moved.finished, false);
  assert.equal(currentBeat(moved.thread).id, 'b');

  const done = advance(moved.thread, { flags: { 'done.a': true, 'done.b': true } });
  assert.equal(done.advanced, true);
  assert.equal(done.finished, true);
});

test('castArchetypes uses the provider callback', () => {
  const beat = {
    ...makeEmptyBeat('test'),
    dramaticPurpose: 't',
    requiredArchetypes: [{ role: 'authority', weight: 1.0 }]
  };
  const result = castArchetypes(beat, {
    entityProvider: ({ role }) => role === 'authority' ? { id: 'npc.queen', name: 'Queen' } : null
  });
  assert.equal(result.error, null);
  assert.equal(result.cast.authority.id, 'npc.queen');
});

test('castArchetypes reports missing slots', () => {
  const beat = {
    ...makeEmptyBeat('test'),
    dramaticPurpose: 't',
    requiredArchetypes: [{ role: 'authority', weight: 1.0 }]
  };
  const result = castArchetypes(beat, { entityProvider: () => null });
  assert.notEqual(result.error, null);
  assert.equal(result.cast, null);
});

test('castArchetypes throws when no provider is given', () => {
  const beat = makeEmptyBeat('test');
  assert.throws(() => castArchetypes(beat, {}));
});

// === edge cases for schema.validateBeat ===

test('validateBeat rejects null with a single explanatory error', () => {
  const result = validateBeat(null);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /must be an object/);
});

test('validateBeat rejects undefined the same way', () => {
  const result = validateBeat(undefined);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /must be an object/);
});

test('validateBeat rejects a primitive (string) as the beat input', () => {
  const result = validateBeat('not-a-beat');
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /must be an object/);
});

test('validateBeat accepts an array-valued optional field', () => {
  const beat = {
    ...makeEmptyBeat('x'),
    dramaticPurpose: 'x',
    successors: ['next-beat-id']
  };
  assert.equal(validateBeat(beat).valid, true);
});

// === edge cases for thread ===

test('createThread surfaces the beat id in the error when one is invalid', () => {
  assert.throws(
    () => createThread([{ id: 'bad', dramaticPurpose: 'x' }]),  // missing targetPlaytimeMinutes + setRequiredFlags
    /Invalid beat bad:/
  );
});

test('createThread falls back to <no id> when the invalid beat lacks an id', () => {
  // Covers the `?? '<no id>'` branch when beat?.id is undefined.
  assert.throws(
    () => createThread([{ dramaticPurpose: 'x' }]),
    /<no id>/
  );
});

test('currentBeat returns null past the end of the thread', () => {
  const a = { ...makeEmptyBeat('a'), dramaticPurpose: 'a' };
  const thread = createThread([a]);
  const past = { ...thread, currentIndex: 7 };
  assert.equal(currentBeat(past), null);
});

test('isReady returns false for a null beat', () => {
  assert.equal(isReady(null, { flags: {} }), false);
});

test('isReady treats a beat with no prerequisites as ready', () => {
  const beat = { ...makeEmptyBeat('x'), dramaticPurpose: 'x' };
  delete beat.prerequisites;                                    // exercise `?? []` branch
  assert.equal(isReady(beat, { flags: {} }), true);
});

test('isReady tolerates a missing state argument', () => {
  // `state?.flags?.[flag]` should chain-short to undefined → falsy.
  const beat = { ...makeEmptyBeat('x'), dramaticPurpose: 'x', prerequisites: ['gate.open'] };
  assert.equal(isReady(beat, undefined), false);
});

test('isComplete returns false for a null beat', () => {
  assert.equal(isComplete(null, { flags: {} }), false);
});

test('isComplete treats a beat with no setRequiredFlags as trivially complete', () => {
  const beat = { ...makeEmptyBeat('x'), dramaticPurpose: 'x' };
  delete beat.setRequiredFlags;                                 // exercise `?? []` branch
  assert.equal(isComplete(beat, { flags: {} }), true);
});

test('advance refuses to step past the end when no current beat exists', () => {
  const a = { ...makeEmptyBeat('a'), dramaticPurpose: 'a' };
  const thread = createThread([a]);
  const exhausted = { ...thread, currentIndex: 99 };
  const result = advance(exhausted, { flags: {} });
  assert.equal(result.advanced, false);
  assert.equal(result.reason, 'no current beat');
});

// === edge cases for casting ===

test('castArchetypes returns an empty cast when the beat has no archetypes', () => {
  const beat = { ...makeEmptyBeat('test'), dramaticPurpose: 't' };
  delete beat.requiredArchetypes;                               // exercise `?? []` branch
  const result = castArchetypes(beat, { entityProvider: () => ({ id: 'never-asked' }) });
  assert.deepEqual(result.cast, {});
  assert.equal(result.error, null);
  assert.equal(result.missing, null);
});
