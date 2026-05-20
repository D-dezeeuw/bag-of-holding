import { test } from 'node:test';
import assert from 'node:assert/strict';
import monk, {
  focusPointsForLevel,
  martialArtsDieSize,
  flurryStrikeCount
} from '../src/classes/monk.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// Deterministic rng across dice sizes — yields face seq[i].
const scriptedRng = (faces, sides) => {
  let i = 0;
  return () => (faces[i++] - 1) / sides;
};

// === Tables ===

test('focusPointsForLevel: 0 at L1, = level from L2 onward', () => {
  assert.equal(focusPointsForLevel(1), 0);
  assert.equal(focusPointsForLevel(2), 2);
  assert.equal(focusPointsForLevel(10), 10);
  assert.equal(focusPointsForLevel(20), 20);
});

test('martialArtsDieSize follows the SRD progression', () => {
  for (const l of [1, 4]) assert.equal(martialArtsDieSize(l), 6);
  for (const l of [5, 10]) assert.equal(martialArtsDieSize(l), 8);
  for (const l of [11, 16]) assert.equal(martialArtsDieSize(l), 10);
  for (const l of [17, 20]) assert.equal(martialArtsDieSize(l), 12);
});

test('flurryStrikeCount: 2 by default, 3 from L10 via Heightened Focus', () => {
  for (const l of [2, 9]) assert.equal(flurryStrikeCount(l), 2);
  for (const l of [10, 20]) assert.equal(flurryStrikeCount(l), 3);
});

// === Resource provisioning ===

test('Monk L1 omits the focusPoints counter (no Focus yet)', () => {
  assert.equal(freshResources(monk, 1).focusPoints, undefined);
});

test('Monk L5 provisions 5 Focus Points, short refresh', () => {
  const r = freshResources(monk, 5);
  assert.equal(r.focusPoints.max, 5);
  assert.equal(r.focusPoints.refreshes, 'short');
});

// === spendFocusPoints generic ===

test('spendFocusPoints(default 1) decrements the counter', () => {
  let actor = { id: 'pc', level: 4, resources: freshResources(monk, 4) };
  const result = applyMechanic({ actor, classDef: monk, id: 'spendFocusPoints' });
  assert.equal(result.ok, true);
  assert.equal(result.actor.resources.focusPoints.used, 1);
});

test('spendFocusPoints accepts an explicit amount', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(monk, 5) };
  const result = applyMechanic({
    actor, classDef: monk, id: 'spendFocusPoints', args: { amount: 3 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.resources.focusPoints.used, 3);
});

test('spendFocusPoints refuses when insufficient', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: { focusPoints: { used: 2, max: 2, refreshes: 'short' } }
  };
  const result = applyMechanic({ actor, classDef: monk, id: 'spendFocusPoints' });
  assert.equal(result.ok, false);
});

// === Flurry of Blows ===

test('Flurry of Blows spends 1 FP, reports 2 strikes at L2', () => {
  const actor = { id: 'pc', level: 2, resources: freshResources(monk, 2) };
  const result = applyMechanic({ actor, classDef: monk, id: 'flurryOfBlows' });
  assert.equal(result.ok, true);
  assert.equal(result.strikes, 2);
  assert.equal(result.actor.resources.focusPoints.used, 1);
});

test('Flurry of Blows reports 3 strikes at L10 via Heightened Focus', () => {
  const actor = { id: 'pc', level: 10, resources: freshResources(monk, 10) };
  const result = applyMechanic({ actor, classDef: monk, id: 'flurryOfBlows' });
  assert.equal(result.strikes, 3);
});

test('Flurry of Blows refuses without Focus Points', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: { focusPoints: { used: 2, max: 2, refreshes: 'short' } }
  };
  const result = applyMechanic({ actor, classDef: monk, id: 'flurryOfBlows' });
  assert.equal(result.ok, false);
});

test('Flurry of Blows defaults level to 1 (2 strikes)', () => {
  // Covers the `actor.level ?? 1` fallback.
  const actor = {
    id: 'pc',
    resources: { focusPoints: { used: 0, max: 2, refreshes: 'short' } }
  };
  const result = applyMechanic({ actor, classDef: monk, id: 'flurryOfBlows' });
  assert.equal(result.strikes, 2);
});

// === Patient Defense ===

test('Patient Defense (no FP) gives a free Disengage as a Bonus Action', () => {
  const actor = { id: 'pc', level: 2, resources: freshResources(monk, 2) };
  const result = applyMechanic({
    actor, classDef: monk, id: 'patientDefense', args: { spendFp: false }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.actions, ['disengage']);
  assert.equal(result.actor.resources.focusPoints.used, 0);   // free version
});

test('Patient Defense (1 FP) gives Disengage + Dodge + 2-MA-die tempHp', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(monk, 5) };
  // L5 → d8. Faces 4 and 6 → tempHp 10.
  const result = applyMechanic(
    { actor, classDef: monk, id: 'patientDefense' },
    scriptedRng([4, 6], 8)
  );
  assert.equal(result.ok, true);
  assert.deepEqual([...result.actions].sort(), ['disengage', 'dodge']);
  assert.equal(result.tempHp, 10);
  assert.deepEqual(result.rolls, [4, 6]);
  assert.equal(result.actor.resources.focusPoints.used, 1);
});

test('Patient Defense (1 FP) refuses without points', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { focusPoints: { used: 5, max: 5, refreshes: 'short' } }
  };
  const result = applyMechanic({ actor, classDef: monk, id: 'patientDefense' });
  assert.equal(result.ok, false);
});

test('Patient Defense defaults level to 1 (d6) when actor.level is missing', () => {
  // Covers the `actor.level ?? 1` fallback inside patientDefense.
  const actor = {
    id: 'pc',
    resources: { focusPoints: { used: 0, max: 1, refreshes: 'short' } }
  };
  const result = applyMechanic(
    { actor, classDef: monk, id: 'patientDefense' },
    scriptedRng([3, 5], 6)
  );
  assert.equal(result.tempHp, 8);
});

test('Patient Defense uses d10 at L11 (martial arts die scaling)', () => {
  const actor = { id: 'pc', level: 11, resources: freshResources(monk, 11) };
  // d10 faces 10 and 10 → tempHp 20.
  const result = applyMechanic(
    { actor, classDef: monk, id: 'patientDefense' },
    scriptedRng([10, 10], 10)
  );
  assert.equal(result.tempHp, 20);
});

// === Step of the Wind ===

test('Step of the Wind (no FP) gives a free Dash as a Bonus Action', () => {
  const actor = { id: 'pc', level: 2, resources: freshResources(monk, 2) };
  const result = applyMechanic({
    actor, classDef: monk, id: 'stepOfTheWind', args: { spendFp: false }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.actions, ['dash']);
  assert.equal(result.actor.resources.focusPoints.used, 0);
});

test('Step of the Wind (1 FP) gives Disengage + Dash + doubled jump + carry-ally', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(monk, 5) };
  const result = applyMechanic({ actor, classDef: monk, id: 'stepOfTheWind' });
  assert.equal(result.ok, true);
  assert.deepEqual([...result.actions].sort(), ['dash', 'disengage']);
  assert.equal(result.doubledJump, true);
  assert.equal(result.canCarryAlly, true);
  assert.equal(result.actor.resources.focusPoints.used, 1);
});

test('Step of the Wind (1 FP) refuses without points', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: { focusPoints: { used: 2, max: 2, refreshes: 'short' } }
  };
  const result = applyMechanic({ actor, classDef: monk, id: 'stepOfTheWind' });
  assert.equal(result.ok, false);
});

// === martialArtsDie helper ===

test('martialArtsDie reports current die spec', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 11 }, classDef: monk, id: 'martialArtsDie'
  });
  assert.equal(result.dieSize, 10);
  assert.equal(result.die, '1d10');
});

test('martialArtsDie defaults to L1 (d6) when level missing', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: monk, id: 'martialArtsDie'
  });
  assert.equal(result.dieSize, 6);
});

// === Rest integration ===

test('Short Rest fully refills Focus Points', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    resources: { focusPoints: { used: 5, max: 5, refreshes: 'short' } }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.focusPoints.used, 0);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Flurry of Blows through the registry', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'monk', level: 5,
    resources: engine.Mechanics.freshResources(engine.classes.monk, 5)
  };
  const result = engine.Mechanics.apply(actor, 'flurryOfBlows');
  assert.equal(result.ok, true);
  assert.equal(result.strikes, 2);
});

test('engine end-to-end: spend all FP, short rest restores them', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'monk', level: 4,
    resources: engine.Mechanics.freshResources(engine.classes.monk, 4)
  };
  ({ actor } = engine.Mechanics.apply(actor, 'spendFocusPoints', { amount: 4 }));
  const denied = engine.Mechanics.apply(actor, 'flurryOfBlows');
  assert.equal(denied.ok, false);
  actor = engine.Rest.shortRest(actor);
  assert.equal(actor.resources.focusPoints.used, 0);
  const allowed = engine.Mechanics.apply(actor, 'flurryOfBlows');
  assert.equal(allowed.ok, true);
});
