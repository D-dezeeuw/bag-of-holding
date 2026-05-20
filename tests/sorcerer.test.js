import { test } from 'node:test';
import assert from 'node:assert/strict';
import sorcerer, {
  sorceryPointsForLevel,
  SLOT_CREATION_COSTS,
  METAMAGIC_OPTIONS
} from '../src/classes/sorcerer.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('sorceryPointsForLevel = 0 at L1, = level from L2 onward', () => {
  assert.equal(sorceryPointsForLevel(1), 0);
  assert.equal(sorceryPointsForLevel(2), 2);
  assert.equal(sorceryPointsForLevel(10), 10);
  assert.equal(sorceryPointsForLevel(20), 20);
});

test('SLOT_CREATION_COSTS covers levels 1–5 only', () => {
  assert.deepEqual(SLOT_CREATION_COSTS, { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 });
});

test('METAMAGIC_OPTIONS includes the SRD options the engine ships', () => {
  for (const id of ['careful', 'distant', 'empowered', 'extended',
                    'heightened', 'quickened', 'seeking', 'subtle',
                    'transmuted', 'twinned']) {
    assert.ok(METAMAGIC_OPTIONS[id], `missing ${id}`);
  }
});

// === Resource provisioning ===

test('Sorcerer L1 omits the sorceryPoints counter', () => {
  assert.equal(freshResources(sorcerer, 1).sorceryPoints, undefined);
});

test('Sorcerer L3 has 3 sorcery points, long refresh', () => {
  const r = freshResources(sorcerer, 3);
  assert.equal(r.sorceryPoints.max, 3);
  assert.equal(r.sorceryPoints.refreshes, 'long');
});

// === convertSlotToPoints ===

test('convertSlotToPoints: spend a L1 slot, gain 1 sorcery point back', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  // Pool starts at 5/5 used=0. Spending a L1 slot adds 1 point but
  // the pool is already full → newUsed = max(0, 0 - 1) = 0, gained 0.
  // To see the gain, set pool to partially used.
  actor.resources.sorceryPoints.used = 3;
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'convertSlotToPoints',
    args: { slotLevel: 1 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.pointsGained, 1);
  assert.equal(result.actor.spellSlots[0].used, 1);
  assert.equal(result.actor.resources.sorceryPoints.used, 2);
});

test('convertSlotToPoints saturates at full pool (no overflow)', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5),
    spellSlots: [{ level: 3, used: 0, max: 2 }]
  };
  // Pool is 5/5 with 0 used. Spending a L3 slot would refund 3
  // points but no room → still no overflow.
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'convertSlotToPoints',
    args: { slotLevel: 3 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.pointsGained, 0);
  assert.equal(result.actor.resources.sorceryPoints.used, 0);
});

test('convertSlotToPoints refuses for invalid slotLevel', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  for (const slotLevel of [undefined, 0, 6, 1.5, 'one']) {
    const result = applyMechanic({
      actor, classDef: sorcerer, id: 'convertSlotToPoints',
      args: { slotLevel }
    });
    assert.equal(result.ok, false, `slotLevel=${slotLevel} should refuse`);
  }
});

test('convertSlotToPoints refuses when no spellSlots field', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(sorcerer, 5) };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'convertSlotToPoints', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spellSlots/);
});

test('convertSlotToPoints refuses when the named slot level is unavailable', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5),
    spellSlots: [{ level: 1, used: 4, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'convertSlotToPoints', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
});

test('convertSlotToPoints refuses on an actor without the sorceryPoints resource', () => {
  const actor = {
    id: 'pc', level: 5, resources: {},
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'convertSlotToPoints', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no sorceryPoints/);
});

// === createSpellSlot ===

test('createSpellSlot: spend 2 SP for a L1 slot tagged temporary', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'createSpellSlot', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.cost, 2);
  assert.equal(result.slot.level, 1);
  assert.equal(result.slot.temporary, true);
  assert.equal(result.actor.spellSlots.length, 2);
  assert.equal(result.actor.resources.sorceryPoints.used, 2);
});

test('createSpellSlot: L5 slot costs 7 SP', () => {
  const actor = {
    id: 'pc', level: 9, resources: freshResources(sorcerer, 9)
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'createSpellSlot', args: { slotLevel: 5 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.cost, 7);
});

test('createSpellSlot refuses on insufficient points', () => {
  const actor = {
    id: 'pc', level: 3,
    resources: { sorceryPoints: { used: 2, max: 3, refreshes: 'long' } }
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'createSpellSlot', args: { slotLevel: 2 }
  });
  assert.equal(result.ok, false);
});

test('createSpellSlot refuses for invalid slotLevel', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(sorcerer, 5) };
  for (const slotLevel of [undefined, 0, 6]) {
    const result = applyMechanic({
      actor, classDef: sorcerer, id: 'createSpellSlot', args: { slotLevel }
    });
    assert.equal(result.ok, false);
  }
});

test('createSpellSlot tolerates an actor with no spellSlots array yet', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(sorcerer, 5) };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'createSpellSlot', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots.length, 1);
});

// === applyMetamagic ===

test('applyMetamagic: Careful Spell costs 1 SP and reports the effect', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5)
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic',
    args: { metamagic: 'careful' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.cost, 1);
  assert.equal(result.metamagic, 'careful');
  assert.equal(result.effect.allyAutoPassesAoESave, true);
  assert.equal(result.actor.resources.sorceryPoints.used, 1);
});

test('applyMetamagic: Twinned Spell costs the slot level', () => {
  const actor = {
    id: 'pc', level: 10, resources: freshResources(sorcerer, 10)
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic',
    args: { metamagic: 'twinned', slotLevel: 3 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.cost, 3);
  assert.equal(result.effect.additionalTarget, 1);
});

test('applyMetamagic: Twinned refuses without slotLevel', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(sorcerer, 5) };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic', args: { metamagic: 'twinned' }
  });
  assert.equal(result.ok, false);
});

test('applyMetamagic: unknown option is refused', () => {
  const actor = { id: 'pc', level: 5, resources: freshResources(sorcerer, 5) };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic',
    args: { metamagic: 'invented' }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown metamagic/);
});

test('applyMetamagic: insufficient SP refused', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: { sorceryPoints: { used: 2, max: 2, refreshes: 'long' } }
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic',
    args: { metamagic: 'careful' }
  });
  assert.equal(result.ok, false);
});

test('applyMetamagic: Quickened costs 2 SP', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5)
  };
  const result = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic',
    args: { metamagic: 'quickened' }
  });
  assert.equal(result.cost, 2);
  assert.equal(result.effect.castingTime, 'bonus');
});

// === sorceryPointsStatus ===

test('sorceryPointsStatus reports remaining / max', () => {
  let actor = {
    id: 'pc', level: 5, resources: freshResources(sorcerer, 5)
  };
  ({ actor } = applyMechanic({
    actor, classDef: sorcerer, id: 'applyMetamagic', args: { metamagic: 'careful' }
  }));
  const status = applyMechanic({
    actor, classDef: sorcerer, id: 'sorceryPointsStatus'
  });
  assert.equal(status.remaining, 4);
  assert.equal(status.max, 5);
});

test('sorceryPointsStatus reports 0/0 without the resource', () => {
  const status = applyMechanic({
    actor: { id: 'pc' }, classDef: sorcerer, id: 'sorceryPointsStatus'
  });
  assert.equal(status.remaining, 0);
  assert.equal(status.max, 0);
});

// === Rest integration ===

test('Long Rest refills the Sorcery Points pool', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5, hitDie: 6, hitDiceTotal: 5, hp: 0, hpMax: 30,
    resources: { sorceryPoints: { used: 5, max: 5, refreshes: 'long' } }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.sorceryPoints.used, 0);
});

// === Engine binding ===

test('engine end-to-end: convert L1 slot to point, then quicken a spell', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'sorcerer', level: 5,
    resources: engine.Mechanics.freshResources(engine.classes.sorcerer, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  // Burn three SP to put the pool at 3/5 used, then convert a slot.
  ({ actor } = engine.Mechanics.apply(actor, 'applyMetamagic', { metamagic: 'quickened' }));
  ({ actor } = engine.Mechanics.apply(actor, 'applyMetamagic', { metamagic: 'careful' }));
  assert.equal(actor.resources.sorceryPoints.used, 3);
  const conv = engine.Mechanics.apply(actor, 'convertSlotToPoints', { slotLevel: 1 });
  assert.equal(conv.ok, true);
  assert.equal(conv.pointsGained, 1);
  assert.equal(conv.actor.resources.sorceryPoints.used, 2);
});
