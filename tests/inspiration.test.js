import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasInspiration, grantInspiration, spendInspiration,
  applyHalflingLucky, rerollFailedSave,
  groupCheck, workingTogether
} from '../src/inspiration.js';
import { createEngine } from '../src/engine.js';

// === Heroic Inspiration ===

test('hasInspiration / grant / spend round-trip', () => {
  let actor = { id: 'pc' };
  assert.equal(hasInspiration(actor), false);
  actor = grantInspiration(actor);
  assert.equal(hasInspiration(actor), true);
  const result = spendInspiration(actor);
  assert.equal(result.ok, true);
  assert.equal(hasInspiration(result.actor), false);
});

test('grantInspiration is a no-op when actor already has it', () => {
  const actor = { id: 'pc', inspiration: true };
  assert.equal(grantInspiration(actor), actor);
});

test('spendInspiration refuses when none to spend', () => {
  const result = spendInspiration({ id: 'pc' });
  assert.equal(result.ok, false);
});

// === Halfling Lucky ===

test('applyHalflingLucky: no reroll when d20 isn\'t 1', () => {
  const result = applyHalflingLucky(15, () => 0.99);
  assert.equal(result.d20, 15);
  assert.equal(result.replaced, false);
});

test('applyHalflingLucky: rerolls on a 1 and keeps the new value', () => {
  const result = applyHalflingLucky(1, () => 0.99);   // reroll → 20
  assert.equal(result.d20, 20);
  assert.equal(result.replaced, true);
  assert.equal(result.original, 1);
});

test('applyHalflingLucky: keeps even a poor reroll (SRD: must use new)', () => {
  // Reroll → 2 (rng 0.05). Halfling Lucky must keep it.
  const result = applyHalflingLucky(1, () => 0.05);
  assert.equal(result.d20, 2);
  assert.equal(result.replaced, true);
});

// === rerollFailedSave ===

test('rerollFailedSave: spends a resource use and rolls a new d20', () => {
  const actor = {
    resources: { indomitable: { used: 0, max: 1, refreshes: 'long' } }
  };
  const result = rerollFailedSave({ actor, resourceId: 'indomitable' }, () => 0.99);
  assert.equal(result.used, true);
  assert.equal(result.newRoll, 20);
  assert.equal(result.actor.resources.indomitable.used, 1);
});

test('rerollFailedSave: refuses (no spend) when pool is exhausted', () => {
  const actor = {
    resources: { indomitable: { used: 1, max: 1, refreshes: 'long' } }
  };
  const result = rerollFailedSave({ actor, resourceId: 'indomitable' });
  assert.equal(result.used, false);
  assert.equal(result.actor, actor);
});

test('rerollFailedSave: refuses on an actor without the resource', () => {
  const result = rerollFailedSave({ actor: { id: 'pc' }, resourceId: 'indomitable' });
  assert.equal(result.used, false);
});

// === groupCheck ===

test('groupCheck: half-or-more pass → success', () => {
  // 3 of 5 succeed → threshold ⌈5/2⌉ = 3 → success.
  assert.equal(groupCheck({ successes: 3, total: 5 }).success, true);
});

test('groupCheck: under half → failure', () => {
  assert.equal(groupCheck({ successes: 1, total: 4 }).success, false);
});

test('groupCheck: 4-person group, exactly 2 succeed → success (threshold 2)', () => {
  const result = groupCheck({ successes: 2, total: 4 });
  assert.equal(result.success, true);
  assert.equal(result.threshold, 2);
});

test('groupCheck rejects non-positive total or negative successes', () => {
  assert.throws(() => groupCheck({ successes: -1, total: 5 }));
  assert.throws(() => groupCheck({ successes: 0, total: 0 }));
  assert.throws(() => groupCheck({ successes: 1.5, total: 5 }));
});

// === workingTogether ===

test('workingTogether: advantage when ally proficient', () => {
  assert.deepEqual(workingTogether({ allyProficient: true }), { advantage: true });
});

test('workingTogether: no advantage when ally not proficient', () => {
  assert.deepEqual(workingTogether({ allyProficient: false }), { advantage: false });
});

// === Engine binding ===

test('engine.Inspiration surface is exposed and rng-bound', () => {
  const engine = createEngine({ rng: () => 0.99 });
  const result = engine.Inspiration.applyHalflingLucky(1);
  assert.equal(result.d20, 20);
});

test('engine.Inspiration end-to-end: grant, spend, rerollFailedSave', () => {
  const engine = createEngine({ rng: () => 0.99 });
  let actor = engine.Inspiration.grant({ id: 'pc' });
  ({ actor } = engine.Inspiration.spend(actor));
  assert.equal(actor.inspiration, undefined);
  // rerollFailedSave on an actor with a resource pool.
  actor = {
    resources: { indomitable: { used: 0, max: 1, refreshes: 'long' } }
  };
  const reroll = engine.Inspiration.rerollFailedSave({
    actor, resourceId: 'indomitable'
  });
  assert.equal(reroll.newRoll, 20);
});
