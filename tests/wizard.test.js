import { test } from 'node:test';
import assert from 'node:assert/strict';
import wizard, {
  arcaneRecoveryCapForLevel,
  ARCANE_RECOVERY_MAX_SLOT_LEVEL
} from '../src/classes/wizard.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('arcaneRecoveryCapForLevel = ceil(level / 2)', () => {
  assert.equal(arcaneRecoveryCapForLevel(1), 1);
  assert.equal(arcaneRecoveryCapForLevel(2), 1);
  assert.equal(arcaneRecoveryCapForLevel(3), 2);
  assert.equal(arcaneRecoveryCapForLevel(4), 2);
  assert.equal(arcaneRecoveryCapForLevel(5), 3);
  assert.equal(arcaneRecoveryCapForLevel(10), 5);
  assert.equal(arcaneRecoveryCapForLevel(20), 10);
});

test('arcaneRecoveryCapForLevel defaults level to 1', () => {
  assert.equal(arcaneRecoveryCapForLevel(undefined), 1);
  assert.equal(arcaneRecoveryCapForLevel(null), 1);
});

test('ARCANE_RECOVERY_MAX_SLOT_LEVEL is 5 per SRD', () => {
  assert.equal(ARCANE_RECOVERY_MAX_SLOT_LEVEL, 5);
});

// === Resource provisioning ===

test('Wizard freshResources at any level provides 1 Arcane Recovery use', () => {
  for (const level of [1, 5, 10]) {
    assert.equal(freshResources(wizard, level).arcaneRecovery.max, 1);
  }
});

// === arcaneRecovery — happy paths ===

test('arcaneRecovery: L4 Wizard can recover two L1 slots', () => {
  const actor = {
    id: 'pc', level: 4, resources: freshResources(wizard, 4),
    spellSlots: [
      { level: 1, used: 4, max: 4 },
      { level: 2, used: 0, max: 3 }
    ]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1, 1] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots[0].used, 2);
  assert.equal(result.actor.resources.arcaneRecovery.used, 1);
});

test('arcaneRecovery: L4 Wizard can recover one L2 slot (sum = 2 = cap)', () => {
  const actor = {
    id: 'pc', level: 4, resources: freshResources(wizard, 4),
    spellSlots: [
      { level: 1, used: 0, max: 4 },
      { level: 2, used: 3, max: 3 }
    ]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [2] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots[1].used, 2);
});

test('arcaneRecovery: L1 Wizard recovers exactly one L1 slot', () => {
  const actor = {
    id: 'pc', level: 1, resources: freshResources(wizard, 1),
    spellSlots: [{ level: 1, used: 2, max: 2 }]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1] }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots[0].used, 1);
});

test('arcaneRecovery: L9 Wizard recovers L5 slot (sum 5, cap 5)', () => {
  const actor = {
    id: 'pc', level: 9, resources: freshResources(wizard, 9),
    spellSlots: [{ level: 5, used: 1, max: 1 }]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [5] }
  });
  assert.equal(result.ok, true);
});

// === arcaneRecovery — refusals ===

test('arcaneRecovery refuses without slotLevels arg', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(wizard, 5) };
  const empty = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [] }
  });
  assert.equal(empty.ok, false);
  const missing = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: {}
  });
  assert.equal(missing.ok, false);
});

test('arcaneRecovery refuses non-positive integer slot levels', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(wizard, 5),
    spellSlots: [{ level: 1, used: 4, max: 4 }]
  };
  for (const lvl of [0, -1, 1.5, 'one']) {
    const result = applyMechanic({
      actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [lvl] }
    });
    assert.equal(result.ok, false, `lvl=${lvl} should refuse`);
  }
});

test('arcaneRecovery refuses slot levels above 5', () => {
  const actor = {
    id: 'pc', level: 11, resources: freshResources(wizard, 11),
    spellSlots: [{ level: 6, used: 1, max: 1 }]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [6] }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /above level 5/);
});

test('arcaneRecovery refuses when the combined sum exceeds the cap', () => {
  const actor = {
    id: 'pc', level: 3, resources: freshResources(wizard, 3),
    spellSlots: [{ level: 2, used: 2, max: 2 }, { level: 1, used: 4, max: 4 }]
  };
  // L3 cap = 2; asking for 1+2 = 3 should refuse.
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery',
    args: { slotLevels: [1, 2] }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /exceed Arcane Recovery cap/);
});

test('arcaneRecovery refuses when the actor has no spellSlots field', () => {
  const actor = { id: 'pc', level: 3, resources: freshResources(wizard, 3) };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1] }
  });
  assert.equal(result.ok, false);
});

test('arcaneRecovery refuses when not enough spent slots of the requested level', () => {
  const actor = {
    id: 'pc', level: 3, resources: freshResources(wizard, 3),
    spellSlots: [{ level: 1, used: 0, max: 4 }]   // no spent slots
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1] }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not enough spent level-1 slots/);
});

test('arcaneRecovery refuses when already used this Long Rest', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { arcaneRecovery: { used: 1, max: 1, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 4, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1] }
  });
  assert.equal(result.ok, false);
});

test('arcaneRecovery defaults level to 1 when actor.level is missing', () => {
  // Covers the `actor.level ?? 1` fallback. L1 cap = 1, so [1] is allowed.
  const actor = {
    id: 'pc', resources: freshResources(wizard, 1),
    spellSlots: [{ level: 1, used: 1, max: 2 }]
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecovery', args: { slotLevels: [1] }
  });
  assert.equal(result.ok, true);
});

// === arcaneRecoveryStatus ===

test('arcaneRecoveryStatus reports availability and cap', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(wizard, 5)
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecoveryStatus'
  });
  assert.equal(result.available, true);
  assert.equal(result.cap, 3);
});

test('arcaneRecoveryStatus reports unavailable after one use', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { arcaneRecovery: { used: 1, max: 1, refreshes: 'long' } }
  };
  const result = applyMechanic({
    actor, classDef: wizard, id: 'arcaneRecoveryStatus'
  });
  assert.equal(result.available, false);
});

test('arcaneRecoveryStatus on an actor without the resource', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 5 }, classDef: wizard, id: 'arcaneRecoveryStatus'
  });
  assert.equal(result.available, false);
});

test('arcaneRecoveryStatus defaults level to 1 when missing', () => {
  // Covers the `actor.level ?? 1` fallback in the status helper.
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: wizard, id: 'arcaneRecoveryStatus'
  });
  assert.equal(result.cap, 1);
});

// === Rest integration ===

test('Long Rest refreshes the once-per-day Arcane Recovery', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5, hitDie: 6, hitDiceTotal: 5, hp: 0, hpMax: 30,
    resources: { arcaneRecovery: { used: 1, max: 1, refreshes: 'long' } }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.arcaneRecovery.used, 0);
});

// === Engine binding ===

test('engine end-to-end: cast a slot, short rest, arcane recovery refunds it', () => {
  const engine = createEngine();
  const actor = {
    id: 'pc', classId: 'wizard', level: 3,
    resources: engine.Mechanics.freshResources(engine.classes.wizard, 3),
    spellSlots: [
      { level: 1, used: 4, max: 4 },
      { level: 2, used: 0, max: 2 }
    ]
  };
  // L3 cap = 2; recover two L1s.
  const result = engine.Mechanics.apply(actor, 'arcaneRecovery',
    { slotLevels: [1, 1] });
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots[0].used, 2);
  assert.equal(result.actor.resources.arcaneRecovery.used, 1);
});
