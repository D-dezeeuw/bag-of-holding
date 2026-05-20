import { test } from 'node:test';
import assert from 'node:assert/strict';
import paladin, {
  layOnHandsPoolForLevel,
  divineSmiteDice
} from '../src/classes/paladin.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('layOnHandsPoolForLevel = 5 × level', () => {
  for (const l of [1, 5, 10, 15, 20]) {
    assert.equal(layOnHandsPoolForLevel(l), l * 5);
  }
});

test('layOnHandsPoolForLevel is 0 below L1', () => {
  assert.equal(layOnHandsPoolForLevel(0), 0);
});

test('divineSmiteDice: 2d8 at L1 slot, +1d8 per slot level above 1', () => {
  assert.equal(divineSmiteDice(1), 2);
  assert.equal(divineSmiteDice(2), 3);
  assert.equal(divineSmiteDice(3), 4);
  assert.equal(divineSmiteDice(4), 5);
  assert.equal(divineSmiteDice(5), 6);
});

test('divineSmiteDice returns 0 for invalid slot levels', () => {
  assert.equal(divineSmiteDice(0), 0);
  assert.equal(divineSmiteDice(-1), 0);
  assert.equal(divineSmiteDice('one'), 0);
  assert.equal(divineSmiteDice(undefined), 0);
});

// === Resource provisioning ===

test('Paladin L1 has 5 HP in Lay on Hands, no Divine Smite Once', () => {
  const r = freshResources(paladin, 1);
  assert.equal(r.layOnHands.max, 5);
  assert.equal(r.divineSmiteOnce, undefined);
});

test('Paladin L5 has 25 HP in Lay on Hands and 1 free Divine Smite', () => {
  const r = freshResources(paladin, 5);
  assert.equal(r.layOnHands.max, 25);
  assert.equal(r.divineSmiteOnce.max, 1);
});

// === layOnHands ===

test('layOnHands draws from the pool and reports the heal', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5)
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'layOnHands', args: { amount: 8 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.healed, 8);
  assert.equal(result.actor.resources.layOnHands.used, 8);
});

test('layOnHands refuses without amount or with a non-positive amount', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5)
  };
  for (const amount of [undefined, 0, -3, 1.5]) {
    const result = applyMechanic({
      actor, classDef: paladin, id: 'layOnHands', args: { amount }
    });
    assert.equal(result.ok, false, `amount=${amount} should refuse`);
  }
});

test('layOnHands refuses when the pool is too low', () => {
  const actor = {
    id: 'pc', level: 1,
    resources: { layOnHands: { used: 3, max: 5, refreshes: 'long' } }
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'layOnHands', args: { amount: 10 }
  });
  assert.equal(result.ok, false);
});

test('layOnHandsPool reports remaining / max', () => {
  let actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5)
  };
  ({ actor } = applyMechanic({
    actor, classDef: paladin, id: 'layOnHands', args: { amount: 10 }
  }));
  const status = applyMechanic({
    actor, classDef: paladin, id: 'layOnHandsPool'
  });
  assert.equal(status.remaining, 15);
  assert.equal(status.max, 25);
});

test('layOnHandsPool reports 0/0 on an actor without the resource', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: paladin, id: 'layOnHandsPool'
  });
  assert.equal(result.remaining, 0);
  assert.equal(result.max, 0);
});

// === Divine Smite ===

test('Divine Smite at slot level 1: 2d8 radiant', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.dice, 2);
  assert.equal(result.damageDice, '2d8');
  assert.equal(result.damageType, 'radiant');
  assert.equal(result.castLevel, 1);
  assert.equal(result.actor.spellSlots[0].used, 1);
});

test('Divine Smite upcast at slot level 3: 4d8', () => {
  const actor = {
    id: 'pc', level: 9, resources: freshResources(paladin, 9),
    spellSlots: [
      { level: 1, used: 0, max: 4 },
      { level: 2, used: 0, max: 3 },
      { level: 3, used: 0, max: 2 }
    ]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 3 }
  });
  assert.equal(result.dice, 4);
  assert.equal(result.damageDice, '4d8');
});

test('Divine Smite +1d8 vs Fiend/Undead', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite',
    args: { slotLevel: 1, targetIsFiendOrUndead: true }
  });
  assert.equal(result.dice, 3);
  assert.equal(result.damageDice, '3d8');
});

test('Divine Smite refuses below L2', () => {
  const actor = {
    id: 'pc', level: 1,
    spellSlots: [{ level: 1, used: 0, max: 2 }]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /level 2/);
});

test('Divine Smite refuses without slotLevel or useFreeCast', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: {}
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /slotLevel/);
});

test('Divine Smite refuses when the requested slot level is unavailable', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5),
    spellSlots: [{ level: 2, used: 2, max: 2 }]
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 2 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spell slot of level 2/);
});

test('Divine Smite refuses on an actor with no spellSlots', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5)
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spellSlots/);
});

test('Divine Smite useFreeCast consumes the once-per-long-rest charge instead', () => {
  const actor = {
    id: 'pc', level: 5, resources: freshResources(paladin, 5),
    spellSlots: [{ level: 1, used: 4, max: 4 }]    // no slots left
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { useFreeCast: true }
  });
  assert.equal(result.ok, true);
  assert.equal(result.dice, 2);                                   // 1st-level effect
  assert.equal(result.usedFreeCast, true);
  assert.equal(result.actor.spellSlots[0].used, 4);               // slot untouched
  assert.equal(result.actor.resources.divineSmiteOnce.used, 1);
});

test('Divine Smite useFreeCast refuses when already spent', () => {
  const actor = {
    id: 'pc', level: 5,
    resources: {
      layOnHands: { used: 0, max: 25, refreshes: 'long' },
      divineSmiteOnce: { used: 1, max: 1, refreshes: 'long' }
    }
  };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { useFreeCast: true }
  });
  assert.equal(result.ok, false);
});

test('Divine Smite defaults actor.level to 1 (refuses below L2)', () => {
  // Covers the `actor.level ?? 1` fallback.
  const actor = { id: 'pc' };
  const result = applyMechanic({
    actor, classDef: paladin, id: 'divineSmite', args: { slotLevel: 1 }
  });
  assert.equal(result.ok, false);
});

// === Rest integration ===

test('Long Rest refills the Lay on Hands pool and the free Divine Smite', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5, hitDie: 10, hitDiceTotal: 5, hp: 0, hpMax: 50,
    resources: {
      layOnHands: { used: 20, max: 25, refreshes: 'long' },
      divineSmiteOnce: { used: 1, max: 1, refreshes: 'long' }
    }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.layOnHands.used, 0);
  assert.equal(rested.resources.divineSmiteOnce.used, 0);
});

test('Short Rest leaves Lay on Hands and Divine Smite Once alone', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    resources: {
      layOnHands: { used: 10, max: 25, refreshes: 'long' },
      divineSmiteOnce: { used: 1, max: 1, refreshes: 'long' }
    }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.layOnHands.used, 10);
  assert.equal(rested.resources.divineSmiteOnce.used, 1);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Lay on Hands through the registry', () => {
  const engine = createEngine();
  const actor = {
    id: 'pc', classId: 'paladin', level: 3,
    resources: engine.Mechanics.freshResources(engine.classes.paladin, 3)
  };
  const result = engine.Mechanics.apply(actor, 'layOnHands', { amount: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.healed, 5);
});

test('engine end-to-end: smite once with slot, once with free cast, then refuse', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'paladin', level: 5,
    resources: engine.Mechanics.freshResources(engine.classes.paladin, 5),
    spellSlots: [{ level: 1, used: 0, max: 4 }]
  };
  ({ actor } = engine.Mechanics.apply(actor, 'divineSmite', { slotLevel: 1 }));
  ({ actor } = engine.Mechanics.apply(actor, 'divineSmite', { useFreeCast: true }));
  // Free cast spent; no more free smites until long rest.
  const denied = engine.Mechanics.apply(actor, 'divineSmite', { useFreeCast: true });
  assert.equal(denied.ok, false);
});
