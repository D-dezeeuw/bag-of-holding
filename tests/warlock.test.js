import { test } from 'node:test';
import assert from 'node:assert/strict';
import warlock, {
  invocationsKnownForLevel,
  ELDRITCH_INVOCATIONS,
  validateInvocations
} from '../src/classes/warlock.js';
import { applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('invocationsKnownForLevel follows the SRD progression', () => {
  assert.equal(invocationsKnownForLevel(1), 1);
  for (const l of [2, 4]) assert.equal(invocationsKnownForLevel(l), 2);
  for (const l of [5, 6]) assert.equal(invocationsKnownForLevel(l), 3);
  for (const l of [7, 8]) assert.equal(invocationsKnownForLevel(l), 4);
  for (const l of [9, 11]) assert.equal(invocationsKnownForLevel(l), 5);
  assert.equal(invocationsKnownForLevel(12), 6);
  assert.equal(invocationsKnownForLevel(15), 7);
  assert.equal(invocationsKnownForLevel(18), 8);
});

test('ELDRITCH_INVOCATIONS includes the canonical 2024 starters', () => {
  for (const id of ['agonizing-blast', 'armor-of-shadows', 'devils-sight',
                    'eldritch-mind', 'fiendish-vigor', 'mask-of-many-faces',
                    'misty-visions', 'repelling-blast', 'beguiling-influence',
                    'eyes-of-the-rune-keeper']) {
    assert.ok(ELDRITCH_INVOCATIONS[id], `missing ${id}`);
  }
});

// === validateInvocations ===

test('validateInvocations accepts a single valid invocation at L1', () => {
  const actor = { level: 1 };
  const result = validateInvocations(['armor-of-shadows'], actor);
  assert.equal(result.ok, true);
});

test('validateInvocations refuses non-array input', () => {
  const result = validateInvocations('armor-of-shadows', { level: 1 });
  assert.equal(result.ok, false);
});

test('validateInvocations refuses when count > level cap', () => {
  const result = validateInvocations(
    ['armor-of-shadows', 'eldritch-mind'], { level: 1 }
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /max 1/);
});

test('validateInvocations refuses an unknown invocation', () => {
  const result = validateInvocations(['blink-cantrip-of-doom'], { level: 5 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown invocation/);
});

test('validateInvocations enforces warlockLevel prerequisites', () => {
  const result = validateInvocations(['agonizing-blast'], { level: 1 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Warlock level 2/);
});

test('validateInvocations enforces cantrip prerequisites (Repelling Blast needs Eldritch Blast)', () => {
  const without = validateInvocations(['repelling-blast'],
    { level: 2, cantripsKnown: ['mage-hand'] });
  assert.equal(without.ok, false);
  assert.match(without.reason, /eldritch-blast/);
  const withIt = validateInvocations(['repelling-blast'],
    { level: 2, cantripsKnown: ['eldritch-blast'] });
  assert.equal(withIt.ok, true);
});

test('validateInvocations refuses repeats of a non-repeatable invocation', () => {
  const result = validateInvocations(['armor-of-shadows', 'armor-of-shadows'],
    { level: 2 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /cannot repeat/);
});

test('validateInvocations allows repeats of Agonizing Blast (repeatable: true)', () => {
  const result = validateInvocations(['agonizing-blast', 'agonizing-blast'],
    { level: 2 });
  assert.equal(result.ok, true);
});

test('validateInvocations defaults level to 1 when actor.level missing', () => {
  // Covers the `actor.level ?? 1` fallback. With level 1, L2+ prereqs
  // refuse.
  const result = validateInvocations(['agonizing-blast'], {});
  assert.equal(result.ok, false);
});

test('validateInvocations tolerates a missing cantripsKnown', () => {
  // Covers the `actor.cantripsKnown ?? []` fallback. No cantrips →
  // any cantrip prereq fails.
  const result = validateInvocations(['repelling-blast'], { level: 2 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /eldritch-blast/);
});

// === setInvocations mechanic ===

test('setInvocations persists a valid selection on the actor', () => {
  const actor = { id: 'pc', level: 3 };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'setInvocations',
    args: { invocations: ['armor-of-shadows', 'devils-sight'] }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.actor.invocations, ['armor-of-shadows', 'devils-sight']);
  assert.equal(result.invocationsKnown, 2);
  assert.equal(result.maxKnown, 2);
});

test('setInvocations defaults level to 1 when actor.level is missing', () => {
  // Covers the `actor.level ?? 1` fallback in the success path.
  // L1 cap = 1, so a single invocation valid at L1 succeeds.
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: warlock, id: 'setInvocations',
    args: { invocations: ['armor-of-shadows'] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.maxKnown, 1);
});

test('setInvocations refuses an over-budget selection', () => {
  const actor = { id: 'pc', level: 1 };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'setInvocations',
    args: { invocations: ['armor-of-shadows', 'eldritch-mind'] }
  });
  assert.equal(result.ok, false);
});

// === hasInvocation ===

test('hasInvocation reports whether an actor carries the invocation', () => {
  const actor = { id: 'pc', invocations: ['devils-sight', 'agonizing-blast'] };
  const yes = applyMechanic({
    actor, classDef: warlock, id: 'hasInvocation',
    args: { invocationId: 'devils-sight' }
  });
  const no = applyMechanic({
    actor, classDef: warlock, id: 'hasInvocation',
    args: { invocationId: 'fiendish-vigor' }
  });
  assert.equal(yes.has, true);
  assert.equal(no.has, false);
});

test('hasInvocation tolerates an actor without invocations', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: warlock, id: 'hasInvocation',
    args: { invocationId: 'devils-sight' }
  });
  assert.equal(result.has, false);
});

// === agonizingBlastBonus ===

test('agonizingBlastBonus returns CHA mod when the invocation is taken', () => {
  const actor = {
    id: 'pc', abilityScores: { cha: 18 },
    invocations: ['agonizing-blast']
  };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'agonizingBlastBonus'
  });
  assert.equal(result.bonus, 4);
});

test('agonizingBlastBonus returns 0 without the invocation', () => {
  const result = applyMechanic({
    actor: { id: 'pc', abilityScores: { cha: 18 } },
    classDef: warlock, id: 'agonizingBlastBonus'
  });
  assert.equal(result.bonus, 0);
});

test('agonizingBlastBonus floors negative CHA mod at 0 (SRD: no negative bonus)', () => {
  const actor = {
    id: 'pc', abilityScores: { cha: 6 },   // mod -2
    invocations: ['agonizing-blast']
  };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'agonizingBlastBonus'
  });
  assert.equal(result.bonus, 0);
});

test('agonizingBlastBonus defaults CHA to 10 (mod 0) when abilityScores missing', () => {
  // Covers the `actor.abilityScores?.cha ?? 10` fallback.
  const actor = { id: 'pc', invocations: ['agonizing-blast'] };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'agonizingBlastBonus'
  });
  assert.equal(result.bonus, 0);
});

// === invocationsStatus ===

test('invocationsStatus reports known / max', () => {
  const actor = { id: 'pc', level: 5, invocations: ['devils-sight', 'agonizing-blast'] };
  const result = applyMechanic({
    actor, classDef: warlock, id: 'invocationsStatus'
  });
  assert.equal(result.known, 2);
  assert.equal(result.max, 3);
});

test('invocationsStatus reports 0 known when actor has no invocations array', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 5 }, classDef: warlock, id: 'invocationsStatus'
  });
  assert.equal(result.known, 0);
  assert.equal(result.max, 3);
});

test('invocationsStatus defaults level to 1 (max 1) when missing', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: warlock, id: 'invocationsStatus'
  });
  assert.equal(result.max, 1);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches setInvocations through the registry', () => {
  const engine = createEngine();
  const actor = { id: 'pc', classId: 'warlock', level: 2 };
  const result = engine.Mechanics.apply(actor, 'setInvocations',
    { invocations: ['agonizing-blast', 'devils-sight'] });
  assert.equal(result.ok, true);
});
