import { test } from 'node:test';
import assert from 'node:assert/strict';
import barbarian, {
  RAGES_BY_LEVEL,
  rageDamageForLevel,
  RAGE_MAX_ROUNDS,
  RAGE_RESISTANCES
} from '../src/classes/barbarian.js';
import {
  freshResource,
  freshResources,
  refreshResources,
  applyMechanic
} from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('RAGES_BY_LEVEL matches the SRD 5.2 Barbarian Features Rages column', () => {
  // Spot-check the well-known landmarks.
  assert.equal(RAGES_BY_LEVEL[1], 2);
  assert.equal(RAGES_BY_LEVEL[3], 3);
  assert.equal(RAGES_BY_LEVEL[6], 4);
  assert.equal(RAGES_BY_LEVEL[12], 5);
  assert.equal(RAGES_BY_LEVEL[17], 6);
  // L20 modelled as 999 ("Unlimited" in the PHB).
  assert.equal(RAGES_BY_LEVEL[20], 999);
});

test('rageDamageForLevel matches the SRD 5.2 Rage Damage column', () => {
  for (const l of [1, 4, 8]) assert.equal(rageDamageForLevel(l), 2);
  for (const l of [9, 12, 15]) assert.equal(rageDamageForLevel(l), 3);
  for (const l of [16, 18, 20]) assert.equal(rageDamageForLevel(l), 4);
});

test('RAGE_MAX_ROUNDS encodes the 10-minute cap (10 min × 10 rounds/min)', () => {
  assert.equal(RAGE_MAX_ROUNDS, 100);
});

test('RAGE_RESISTANCES is the BPS triple', () => {
  assert.deepEqual([...RAGE_RESISTANCES].sort(), ['bludgeoning', 'piercing', 'slashing']);
});

// === Resource shape ===

test('Barbarian freshResources(level=1) provisions 2 Rages', () => {
  const r = freshResources(barbarian, 1);
  assert.equal(r.rage.max, 2);
  assert.equal(r.rage.used, 0);
  assert.equal(r.rage.refreshes, 'long');
  assert.equal(r.rage.shortRestRecovery, 1);
});

test('Barbarian freshResources(level=20) provisions 999 Rages (engine-internal "unlimited")', () => {
  const r = freshResources(barbarian, 20);
  assert.equal(r.rage.max, 999);
});

test('Barbarian freshResources defaults to 6 Rages for an out-of-table level', () => {
  // Covers the `?? 6` fallback on the `RAGES_BY_LEVEL[level]` lookup.
  // Out-of-table values shouldn't happen in normal play (level cap is
  // 20) but the fallback exists so homebrew progression curves don't
  // crash the resource builder.
  const r = freshResources(barbarian, 25);
  assert.equal(r.rage.max, 6);
});

// === freshResource extension: shortRestRecovery ===

test('freshResource preserves shortRestRecovery when > 0', () => {
  const r = freshResource({ max: 4, refreshes: 'long', shortRestRecovery: 1 });
  assert.equal(r.shortRestRecovery, 1);
});

test('freshResource omits shortRestRecovery when 0 (clean shape for short/long without partial)', () => {
  const r = freshResource({ max: 2, refreshes: 'short' });
  assert.equal('shortRestRecovery' in r, false);
});

test('freshResource rejects a non-integer or negative shortRestRecovery', () => {
  assert.throws(() => freshResource({ max: 2, refreshes: 'long', shortRestRecovery: -1 }));
  assert.throws(() => freshResource({ max: 2, refreshes: 'long', shortRestRecovery: 1.5 }));
});

// === refreshResources: partial recovery on Short Rest ===

test('refreshResources(short) recovers shortRestRecovery uses on a long-tagged resource', () => {
  const actor = {
    resources: {
      rage: { used: 3, max: 4, refreshes: 'long', shortRestRecovery: 1 }
    }
  };
  const next = refreshResources(actor, 'short');
  assert.equal(next.resources.rage.used, 2);
});

test('refreshResources(short) saturates the partial recovery at 0 used', () => {
  const actor = {
    resources: {
      rage: { used: 1, max: 4, refreshes: 'long', shortRestRecovery: 3 }
    }
  };
  const next = refreshResources(actor, 'short');
  assert.equal(next.resources.rage.used, 0);
});

test('refreshResources(long) fully refills a long-tagged resource regardless of shortRestRecovery', () => {
  const actor = {
    resources: {
      rage: { used: 4, max: 4, refreshes: 'long', shortRestRecovery: 1 }
    }
  };
  const next = refreshResources(actor, 'long');
  assert.equal(next.resources.rage.used, 0);
});

test('refreshResources(short) on a long-tagged resource with no shortRestRecovery is a no-op', () => {
  const actor = {
    resources: {
      lay: { used: 3, max: 10, refreshes: 'long' }
    }
  };
  assert.equal(refreshResources(actor, 'short'), actor);
});

test('refreshResources returns the same actor reference when nothing changes', () => {
  // Used at 0 with shortRestRecovery > 0 — no recovery to apply.
  const actor = {
    resources: { rage: { used: 0, max: 4, refreshes: 'long', shortRestRecovery: 1 } }
  };
  assert.equal(refreshResources(actor, 'short'), actor);
});

// === Rage mechanic ===

test('Rage activates: spends a resource, sets actor.rage, returns damage bonus', () => {
  let actor = { id: 'pc', level: 3, resources: freshResources(barbarian, 3) };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(result.ok, true);
  assert.equal(result.damageBonus, 2);   // L3 → +2
  assert.equal(result.actor.rage.active, true);
  assert.equal(result.actor.rage.damageBonus, 2);
  assert.equal(result.actor.rage.roundsRemaining, RAGE_MAX_ROUNDS);
  assert.deepEqual([...result.actor.rage.resistances].sort(), [...RAGE_RESISTANCES].sort());
  assert.equal(result.actor.resources.rage.used, 1);
});

test('Rage damage bonus at L9 is +3', () => {
  let actor = { id: 'pc', level: 9, resources: freshResources(barbarian, 9) };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(result.damageBonus, 3);
});

test('Rage damage bonus at L16 is +4', () => {
  let actor = { id: 'pc', level: 16, resources: freshResources(barbarian, 16) };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(result.damageBonus, 4);
});

test('Rage refuses when no uses remain', () => {
  const actor = {
    id: 'pc', level: 1,
    resources: { rage: { used: 2, max: 2, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not enough rage/);
});

test('Rage refuses when already raging', () => {
  let actor = { id: 'pc', level: 3, resources: freshResources(barbarian, 3) };
  ({ actor } = applyMechanic({ actor, classDef: barbarian, id: 'rage' }));
  const second = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(second.ok, false);
  assert.match(second.reason, /already raging/);
});

test('Rage defaults level to 1 when actor.level is missing (damage bonus 2)', () => {
  const actor = { id: 'pc', resources: freshResources(barbarian, 1) };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rage' });
  assert.equal(result.damageBonus, 2);
});

// === endRage ===

test('endRage clears actor.rage', () => {
  let actor = { id: 'pc', level: 1, resources: freshResources(barbarian, 1) };
  ({ actor } = applyMechanic({ actor, classDef: barbarian, id: 'rage' }));
  assert.equal(actor.rage.active, true);
  const ended = applyMechanic({ actor, classDef: barbarian, id: 'endRage' });
  assert.equal(ended.ok, true);
  assert.equal(ended.actor.rage, undefined);
});

test('endRage refuses when not raging', () => {
  const actor = { id: 'pc' };
  const result = applyMechanic({ actor, classDef: barbarian, id: 'endRage' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not raging/);
});

// === Read-only helpers ===

test('rageDamageBonus returns 0 when not raging', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: barbarian, id: 'rageDamageBonus'
  });
  assert.equal(result.bonus, 0);
});

test('rageDamageBonus returns the active damage bonus while raging', () => {
  let actor = { id: 'pc', level: 9, resources: freshResources(barbarian, 9) };
  ({ actor } = applyMechanic({ actor, classDef: barbarian, id: 'rage' }));
  const result = applyMechanic({ actor, classDef: barbarian, id: 'rageDamageBonus' });
  assert.equal(result.bonus, 3);
});

test('isRaging reports false on a fresh actor and true after rage()', () => {
  let actor = { id: 'pc', level: 1, resources: freshResources(barbarian, 1) };
  assert.equal(applyMechanic({ actor, classDef: barbarian, id: 'isRaging' }).raging, false);
  ({ actor } = applyMechanic({ actor, classDef: barbarian, id: 'rage' }));
  assert.equal(applyMechanic({ actor, classDef: barbarian, id: 'isRaging' }).raging, true);
});

// === Rest integration ===

test('Long Rest refills all Rage uses', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5, hitDie: 12, hitDiceTotal: 5, hp: 0, hpMax: 60,
    resources: { rage: { used: 3, max: 3, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.rage.used, 0);
});

test('Short Rest recovers exactly one Rage use', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    resources: { rage: { used: 3, max: 3, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.rage.used, 2);
});

test('Short Rest leaves Rage alone when no uses spent', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    resources: { rage: { used: 0, max: 3, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.rage.used, 0);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Rage end-to-end through the registry', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'barbarian', level: 3,
    resources: engine.Mechanics.freshResources(engine.classes.barbarian, 3)
  };
  const result = engine.Mechanics.apply(actor, 'rage');
  assert.equal(result.ok, true);
  assert.equal(result.actor.rage.active, true);
});

test('engine end-to-end: rage → short rest recovers 1 → rage again ok', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'barbarian', level: 1,
    resources: engine.Mechanics.freshResources(engine.classes.barbarian, 1)
  };
  // L1 has 2 rages. Spend both.
  ({ actor } = engine.Mechanics.apply(actor, 'rage'));
  ({ actor } = engine.Mechanics.apply(actor, 'endRage'));
  ({ actor } = engine.Mechanics.apply(actor, 'rage'));
  ({ actor } = engine.Mechanics.apply(actor, 'endRage'));
  assert.equal(actor.resources.rage.used, 2);
  const denied = engine.Mechanics.apply(actor, 'rage');
  assert.equal(denied.ok, false);
  // Short rest recovers one.
  actor = engine.Rest.shortRest(actor);
  assert.equal(actor.resources.rage.used, 1);
  const allowed = engine.Mechanics.apply(actor, 'rage');
  assert.equal(allowed.ok, true);
});
