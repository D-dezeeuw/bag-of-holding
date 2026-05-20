import { test } from 'node:test';
import assert from 'node:assert/strict';
import ranger, {
  huntersMarkFreeCastsForLevel
} from '../src/classes/ranger.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('huntersMarkFreeCastsForLevel scales with proficiency bonus', () => {
  for (const l of [1, 4]) assert.equal(huntersMarkFreeCastsForLevel(l), 2);
  for (const l of [5, 8]) assert.equal(huntersMarkFreeCastsForLevel(l), 3);
  for (const l of [9, 12]) assert.equal(huntersMarkFreeCastsForLevel(l), 4);
  for (const l of [13, 16]) assert.equal(huntersMarkFreeCastsForLevel(l), 5);
  for (const l of [17, 20]) assert.equal(huntersMarkFreeCastsForLevel(l), 6);
});

// === Resource provisioning ===

test('Ranger L1 has 2 free Hunter\'s Mark casts, long-rest refresh', () => {
  const r = freshResources(ranger, 1);
  assert.equal(r.huntersMarkFree.max, 2);
  assert.equal(r.huntersMarkFree.refreshes, 'long');
});

test('Ranger L9 has 4 free casts', () => {
  assert.equal(freshResources(ranger, 9).huntersMarkFree.max, 4);
});

// === castHuntersMark — free cast path ===

test('castHuntersMark prefers a free cast when available', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(ranger, 5),
    spellSlots: [{ level: 1, used: 0, max: 3 }]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.usedFreeCast, true);
  assert.equal(result.castLevel, 1);
  assert.equal(result.actor.huntersMark.targetId, 'orc-3');
  assert.equal(result.actor.resources.huntersMarkFree.used, 1);
  assert.equal(result.actor.spellSlots[0].used, 0);   // slot untouched
});

test('castHuntersMark falls back to a slot when no free casts remain', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { huntersMarkFree: { used: 3, max: 3, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 0, max: 3 }]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3' }
  });
  assert.equal(result.ok, true);
  assert.equal(result.usedFreeCast, false);
  assert.equal(result.castLevel, 1);
  assert.equal(result.actor.spellSlots[0].used, 1);
});

test('castHuntersMark with useFreeCast:false forces slot consumption', () => {
  // Player has free casts AND slots; they choose to upcast.
  const actor = {
    id: 'pc', level: 5, resources: freshResources(ranger, 5),
    spellSlots: [
      { level: 1, used: 0, max: 3 },
      { level: 2, used: 0, max: 2 }
    ]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3', useFreeCast: false, slotLevel: 2 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.usedFreeCast, false);
  assert.equal(result.castLevel, 2);
  assert.equal(result.actor.resources.huntersMarkFree.used, 0);   // free untouched
  assert.equal(result.actor.spellSlots[1].used, 1);
});

test('castHuntersMark uses the lowest available slot at or above slotLevel', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { huntersMarkFree: { used: 3, max: 3, refreshes: 'long' } },
    spellSlots: [
      { level: 1, used: 3, max: 3 },     // exhausted
      { level: 2, used: 0, max: 2 }      // available, becomes the chosen slot
    ]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3', slotLevel: 1 }
  });
  assert.equal(result.castLevel, 2);
});

test('castHuntersMark refuses without targetId', () => {
  const actor = {
    id: 'pc', level: 1, resources: freshResources(ranger, 1)
  };
  for (const targetId of [undefined, '', 42, null]) {
    const result = applyMechanic({
      actor, classDef: ranger, id: 'castHuntersMark', args: { targetId }
    });
    assert.equal(result.ok, false, `targetId=${targetId} should refuse`);
  }
});

test('castHuntersMark refuses when no free casts and no slots', () => {
  const actor = {
    id: 'pc', level: 1,
    resources: { huntersMarkFree: { used: 2, max: 2, refreshes: 'long' } }
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark', args: { targetId: 'orc-3' }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spellSlots/);
});

test('castHuntersMark refuses when the slotLevel arg is non-positive', () => {
  const actor = {
    id: 'pc', level: 1,
    resources: { huntersMarkFree: { used: 2, max: 2, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 0, max: 2 }]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3', slotLevel: 0 }
  });
  assert.equal(result.ok, false);
});

test('castHuntersMark refuses when no slot of the requested level is available', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { huntersMarkFree: { used: 3, max: 3, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 3, max: 3 }]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3', slotLevel: 2 }
  });
  assert.equal(result.ok, false);
});

test('castHuntersMark slotLevel defaults to 1 when omitted', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: { huntersMarkFree: { used: 3, max: 3, refreshes: 'long' } },
    spellSlots: [{ level: 1, used: 0, max: 3 }]
  };
  const result = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3' }
  });
  assert.equal(result.castLevel, 1);
});

// === endHuntersMark ===

test('endHuntersMark clears the binding', () => {
  let actor = {
    id: 'pc', level: 1, resources: freshResources(ranger, 1)
  };
  ({ actor } = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark', args: { targetId: 'orc-3' }
  }));
  assert.equal(actor.huntersMark.targetId, 'orc-3');
  const ended = applyMechanic({ actor, classDef: ranger, id: 'endHuntersMark' });
  assert.equal(ended.ok, true);
  assert.equal(ended.actor.huntersMark, undefined);
});

test('endHuntersMark refuses when no Hunters Mark active', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: ranger, id: 'endHuntersMark'
  });
  assert.equal(result.ok, false);
});

// === huntersMarkDamage rider ===

test('huntersMarkDamage triggers vs the marked target with 1d6 force', () => {
  let actor = {
    id: 'pc', level: 1, resources: freshResources(ranger, 1)
  };
  ({ actor } = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark', args: { targetId: 'orc-3' }
  }));
  const rider = applyMechanic({
    actor, classDef: ranger, id: 'huntersMarkDamage', args: { targetId: 'orc-3' }
  });
  assert.equal(rider.triggers, true);
  assert.equal(rider.damageDice, '1d6');
  assert.equal(rider.damageType, 'force');
});

test('huntersMarkDamage does not trigger against a different target', () => {
  let actor = {
    id: 'pc', level: 1, resources: freshResources(ranger, 1)
  };
  ({ actor } = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark', args: { targetId: 'orc-3' }
  }));
  const rider = applyMechanic({
    actor, classDef: ranger, id: 'huntersMarkDamage', args: { targetId: 'goblin-1' }
  });
  assert.equal(rider.triggers, false);
  assert.match(rider.reason, /not against the marked target/);
});

test('huntersMarkDamage does not trigger when no mark is active', () => {
  const rider = applyMechanic({
    actor: { id: 'pc' }, classDef: ranger, id: 'huntersMarkDamage',
    args: { targetId: 'orc-3' }
  });
  assert.equal(rider.triggers, false);
});

// === favoredEnemyStatus ===

test('favoredEnemyStatus reports remaining / max', () => {
  let actor = {
    id: 'pc', level: 5, resources: freshResources(ranger, 5)
  };
  ({ actor } = applyMechanic({
    actor, classDef: ranger, id: 'castHuntersMark',
    args: { targetId: 'orc-3' }
  }));
  const status = applyMechanic({
    actor, classDef: ranger, id: 'favoredEnemyStatus'
  });
  assert.equal(status.remaining, 2);   // 3 max - 1 used
  assert.equal(status.max, 3);
});

test('favoredEnemyStatus reports 0/0 on an actor without the resource', () => {
  const status = applyMechanic({
    actor: { id: 'pc' }, classDef: ranger, id: 'favoredEnemyStatus'
  });
  assert.equal(status.remaining, 0);
  assert.equal(status.max, 0);
});

// === Rest integration ===

test('Long Rest refills the free Hunters Mark casts', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5, hitDie: 10, hitDiceTotal: 5, hp: 0, hpMax: 50,
    resources: { huntersMarkFree: { used: 3, max: 3, refreshes: 'long' } }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.huntersMarkFree.used, 0);
});

// === Engine binding ===

test('engine end-to-end: cast, attack the marked target rider, end', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'ranger', level: 1,
    resources: engine.Mechanics.freshResources(engine.classes.ranger, 1)
  };
  ({ actor } = engine.Mechanics.apply(actor, 'castHuntersMark', { targetId: 'wolf-2' }));
  const rider = engine.Mechanics.apply(actor, 'huntersMarkDamage', { targetId: 'wolf-2' });
  assert.equal(rider.triggers, true);
  ({ actor } = engine.Mechanics.apply(actor, 'endHuntersMark'));
  assert.equal(actor.huntersMark, undefined);
});
