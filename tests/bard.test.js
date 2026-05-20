import { test } from 'node:test';
import assert from 'node:assert/strict';
import bard, {
  bardicInspirationDieSize,
  bardicInspirationUses
} from '../src/classes/bard.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('bardicInspirationDieSize matches the SRD scaling (d6/d8/d10/d12)', () => {
  for (const l of [1, 4]) assert.equal(bardicInspirationDieSize(l), 6);
  for (const l of [5, 9]) assert.equal(bardicInspirationDieSize(l), 8);
  for (const l of [10, 14]) assert.equal(bardicInspirationDieSize(l), 10);
  for (const l of [15, 20]) assert.equal(bardicInspirationDieSize(l), 12);
});

test('bardicInspirationUses returns max(1, CHA mod) — SRD minimum-1 floor', () => {
  assert.equal(bardicInspirationUses(10), 1);   // mod 0 → floored at 1
  assert.equal(bardicInspirationUses(8), 1);    // mod -1 → floored at 1
  assert.equal(bardicInspirationUses(14), 2);
  assert.equal(bardicInspirationUses(18), 4);
  assert.equal(bardicInspirationUses(20), 5);
});

test('bardicInspirationUses defaults CHA to 10 when omitted', () => {
  assert.equal(bardicInspirationUses(undefined), 1);
});

// === Resource provisioning ===

test('Bard freshResources at L1 with CHA 16 → 3 BI uses, refreshes long', () => {
  const actor = { abilityScores: { cha: 16 } };
  const r = freshResources(bard, 1, actor);
  assert.equal(r.bardicInspiration.max, 3);
  assert.equal(r.bardicInspiration.refreshes, 'long');
  assert.equal(r.bardicInspiration.used, 0);
});

test('Bard freshResources at L5 flips refresh to short (Font of Inspiration)', () => {
  const actor = { abilityScores: { cha: 16 } };
  const r = freshResources(bard, 5, actor);
  assert.equal(r.bardicInspiration.refreshes, 'short');
});

test('Bard freshResources tolerates a missing actor (defaults to 1 BI use, long refresh)', () => {
  // No actor → CHA defaults to 10 → mod 0 → max(1, 0) = 1 use.
  const r = freshResources(bard, 1);
  assert.equal(r.bardicInspiration.max, 1);
  assert.equal(r.bardicInspiration.refreshes, 'long');
});

// === Bardic Inspiration mechanic ===

test('bardicInspiration spends a use and reports the conferred die', () => {
  const actor = {
    id: 'pc', level: 5,
    abilityScores: { cha: 16 },
    resources: freshResources(bard, 5, { abilityScores: { cha: 16 } })
  };
  const result = applyMechanic({ actor, classDef: bard, id: 'bardicInspiration' });
  assert.equal(result.ok, true);
  assert.equal(result.dieSize, 8);          // L5 → d8
  assert.equal(result.die, '1d8');
  assert.equal(result.actor.resources.bardicInspiration.used, 1);
});

test('bardicInspiration refuses when no uses remain', () => {
  const actor = {
    id: 'pc', level: 1,
    abilityScores: { cha: 12 },                                  // mod +1 → 1 use
    resources: { bardicInspiration: { used: 1, max: 1, refreshes: 'long' } }
  };
  const result = applyMechanic({ actor, classDef: bard, id: 'bardicInspiration' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not enough bardicInspiration/);
});

test('bardicInspiration die size at L10 is d10, L15+ is d12', () => {
  const make = (level) => {
    const a = { id: 'pc', level, abilityScores: { cha: 20 } };
    return { ...a, resources: freshResources(bard, level, a) };
  };
  const r10 = applyMechanic({ actor: make(10), classDef: bard, id: 'bardicInspiration' });
  assert.equal(r10.dieSize, 10);
  const r15 = applyMechanic({ actor: make(15), classDef: bard, id: 'bardicInspiration' });
  assert.equal(r15.dieSize, 12);
});

test('bardicInspiration falls back to level 1 (d6) when actor.level is missing', () => {
  const actor = {
    id: 'pc',
    abilityScores: { cha: 14 },
    resources: { bardicInspiration: { used: 0, max: 2, refreshes: 'long' } }
  };
  const result = applyMechanic({ actor, classDef: bard, id: 'bardicInspiration' });
  assert.equal(result.dieSize, 6);
});

// === Font of Inspiration ===

test('fontOfInspiration refunds a BI use at the cost of a spell slot', () => {
  const actor = {
    id: 'pc', level: 5,
    abilityScores: { cha: 16 },
    resources: { bardicInspiration: { used: 2, max: 3, refreshes: 'short' } },
    spellSlots: [
      { level: 1, used: 0, max: 4 },
      { level: 2, used: 0, max: 3 }
    ]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration',
    args: { slotLevel: 2 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.resources.bardicInspiration.used, 1);
  assert.equal(result.actor.spellSlots[1].used, 1);
  assert.equal(result.actor.spellSlots[0].used, 0);  // L1 slot untouched
});

test('fontOfInspiration refuses below L5', () => {
  const actor = {
    id: 'pc', level: 4,
    resources: { bardicInspiration: { used: 1, max: 2, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /level 5/);
});

test('fontOfInspiration treats a missing actor.level as L1 (refuses)', () => {
  // Covers the `actor.level ?? 1` fallback on the level check.
  const actor = {
    id: 'pc',
    resources: { bardicInspiration: { used: 1, max: 2, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /level 5/);
});

test('fontOfInspiration refuses without a slotLevel', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { bardicInspiration: { used: 1, max: 3, refreshes: 'short' } },
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const a = applyMechanic({ actor, classDef: bard, id: 'fontOfInspiration', args: {} });
  assert.equal(a.ok, false);
  const b = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 0 }
  });
  assert.equal(b.ok, false);
});

test('fontOfInspiration refuses without spellSlots on the actor', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { bardicInspiration: { used: 1, max: 3, refreshes: 'short' } }
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spellSlots/);
});

test('fontOfInspiration refuses when the requested slot level has none available', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { bardicInspiration: { used: 1, max: 3, refreshes: 'short' } },
    spellSlots: [{ level: 2, used: 3, max: 3 }]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 2 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spell slot of level 2/);
});

test('fontOfInspiration refuses when BI is already at full uses', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { bardicInspiration: { used: 0, max: 3, refreshes: 'short' } },
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /already at full/);
});

test('fontOfInspiration refuses on an actor without a bardicInspiration resource', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: {},
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: bard, id: 'fontOfInspiration', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no bardicInspiration resource/);
});

// === Read-only helper ===

test('inspirationDie reports the current die size + spec', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 10 }, classDef: bard, id: 'inspirationDie'
  });
  assert.equal(result.dieSize, 10);
  assert.equal(result.die, '1d10');
});

test('inspirationDie defaults to L1 (d6) when actor.level is missing', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: bard, id: 'inspirationDie'
  });
  assert.equal(result.dieSize, 6);
});

// === Rest integration ===

test('L1 Bard: BI uses refresh on Long Rest only', async () => {
  const { longRest, shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 1, hitDie: 8, hitDiceTotal: 1, hp: 8, hpMax: 8,
    abilityScores: { cha: 16 },
    resources: { bardicInspiration: { used: 3, max: 3, refreshes: 'long' } }
  };
  const afterShort = shortRest(actor);
  assert.equal(afterShort.resources.bardicInspiration.used, 3);   // unchanged
  const afterLong = longRest(actor);
  assert.equal(afterLong.resources.bardicInspiration.used, 0);
});

test('L5+ Bard: Font of Inspiration flips refresh to Short Rest', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    abilityScores: { cha: 16 },
    resources: { bardicInspiration: { used: 3, max: 3, refreshes: 'short' } }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.bardicInspiration.used, 0);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Bardic Inspiration through the class registry', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'bard', level: 3,
    abilityScores: { cha: 14 },
    resources: engine.Mechanics.freshResources(engine.classes.bard, 3, { abilityScores: { cha: 14 } })
  };
  const result = engine.Mechanics.apply(actor, 'bardicInspiration');
  assert.equal(result.ok, true);
  assert.equal(result.dieSize, 6);    // L3 still d6 — die scales at L5
});

test('engine end-to-end: L5 Bard spends BI → fontOfInspiration refunds via slot', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'bard', level: 5,
    abilityScores: { cha: 16 },
    resources: engine.Mechanics.freshResources(engine.classes.bard, 5, { abilityScores: { cha: 16 } }),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  ({ actor } = engine.Mechanics.apply(actor, 'bardicInspiration'));
  assert.equal(actor.resources.bardicInspiration.used, 1);
  ({ actor } = engine.Mechanics.apply(actor, 'fontOfInspiration', { slotLevel: 1 }));
  assert.equal(actor.resources.bardicInspiration.used, 0);
  assert.equal(actor.spellSlots[0].used, 1);
});
