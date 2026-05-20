import { test } from 'node:test';
import assert from 'node:assert/strict';
import cleric, {
  channelDivinityUsesForLevel,
  channelDivinityDC
} from '../src/classes/cleric.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';

const scriptedRng = (faces, sides = 8) => {
  let i = 0;
  return () => (faces[i++] - 1) / sides;
};

// === Tables ===

test('channelDivinityUsesForLevel matches the SRD step table', () => {
  assert.equal(channelDivinityUsesForLevel(1), 0);   // no CD yet
  assert.equal(channelDivinityUsesForLevel(2), 2);
  assert.equal(channelDivinityUsesForLevel(5), 2);
  assert.equal(channelDivinityUsesForLevel(6), 3);
  assert.equal(channelDivinityUsesForLevel(17), 3);
  assert.equal(channelDivinityUsesForLevel(18), 4);
  assert.equal(channelDivinityUsesForLevel(20), 4);
});

test('channelDivinityDC = 8 + prof + WIS mod', () => {
  // L5 Cleric, WIS 16 (+3), prof +3 → DC 14
  const actor = { proficiencyBonus: 3, abilityScores: { wis: 16 } };
  assert.equal(channelDivinityDC(actor), 14);
});

test('channelDivinityDC defaults to the L1 baseline when fields are missing', () => {
  // No prof / no WIS → 8 + 2 + 0 = 10.
  assert.equal(channelDivinityDC({}), 10);
});

// === Resource provisioning ===

test('Cleric L1 omits the channelDivinity counter (max is 0)', () => {
  const r = freshResources(cleric, 1);
  assert.equal(r.channelDivinity, undefined);
});

test('Cleric L2 provisions 2 uses, long refresh, 1 partial on short rest', () => {
  const r = freshResources(cleric, 2);
  assert.equal(r.channelDivinity.max, 2);
  assert.equal(r.channelDivinity.refreshes, 'long');
  assert.equal(r.channelDivinity.shortRestRecovery, 1);
});

test('Cleric L6 → 3 uses, L18 → 4 uses', () => {
  assert.equal(freshResources(cleric, 6).channelDivinity.max, 3);
  assert.equal(freshResources(cleric, 18).channelDivinity.max, 4);
});

// === Divine Spark ===

test('Divine Spark in heal mode returns die + WIS mod', () => {
  const actor = {
    id: 'pc', level: 5, proficiencyBonus: 3,
    abilityScores: { wis: 16 },
    resources: freshResources(cleric, 5)
  };
  // d8 = 5, WIS mod +3 → value 8.
  const result = applyMechanic(
    { actor, classDef: cleric, id: 'divineSpark', args: { mode: 'heal' } },
    scriptedRng([5], 8)
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'heal');
  assert.equal(result.die, 5);
  assert.equal(result.value, 8);
  assert.equal(result.actor.resources.channelDivinity.used, 1);
  assert.equal(result.save, undefined);
});

test('Divine Spark in damage mode adds the save block + damage type', () => {
  const actor = {
    id: 'pc', level: 5, proficiencyBonus: 3,
    abilityScores: { wis: 16 },
    resources: freshResources(cleric, 5)
  };
  const result = applyMechanic(
    { actor, classDef: cleric, id: 'divineSpark', args: { mode: 'damage', damageType: 'necrotic' } },
    scriptedRng([8], 8)
  );
  assert.equal(result.mode, 'damage');
  assert.equal(result.value, 11);  // 8 + 3
  assert.equal(result.damageType, 'necrotic');
  assert.equal(result.save.ability, 'con');
  assert.equal(result.save.dc, 14);   // 8 + 3 + 3
  assert.equal(result.halfOnSuccess, true);
});

test('Divine Spark defaults mode to heal when args omitted', () => {
  const actor = {
    id: 'pc', level: 2, proficiencyBonus: 2,
    abilityScores: { wis: 14 },
    resources: freshResources(cleric, 2)
  };
  const result = applyMechanic(
    { actor, classDef: cleric, id: 'divineSpark' },
    scriptedRng([4], 8)
  );
  assert.equal(result.mode, 'heal');
});

test('Divine Spark defaults WIS to 10 (mod 0) when abilityScores omitted', () => {
  // Covers the `actor.abilityScores?.wis ?? 10` fallback. d8 = 4,
  // mod = 0 → value = 4.
  const actor = {
    id: 'pc', level: 2, proficiencyBonus: 2,
    resources: freshResources(cleric, 2)
  };
  const result = applyMechanic(
    { actor, classDef: cleric, id: 'divineSpark', args: { mode: 'heal' } },
    scriptedRng([4], 8)
  );
  assert.equal(result.value, 4);
});

test('Divine Spark defaults damage type to radiant when not specified in damage mode', () => {
  const actor = {
    id: 'pc', level: 2, proficiencyBonus: 2,
    abilityScores: { wis: 14 },
    resources: freshResources(cleric, 2)
  };
  const result = applyMechanic(
    { actor, classDef: cleric, id: 'divineSpark', args: { mode: 'damage' } },
    scriptedRng([4], 8)
  );
  assert.equal(result.damageType, 'radiant');
});

test('Divine Spark refuses when no Channel Divinity uses remain', () => {
  const actor = {
    id: 'pc', level: 2, proficiencyBonus: 2,
    abilityScores: { wis: 14 },
    resources: { channelDivinity: { used: 2, max: 2, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const result = applyMechanic({ actor, classDef: cleric, id: 'divineSpark' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not enough channelDivinity/);
});

// === Turn Undead ===

test('Turn Undead reports DC, WIS save, on-fail conditions and range', () => {
  const actor = {
    id: 'pc', level: 5, proficiencyBonus: 3,
    abilityScores: { wis: 18 },
    resources: freshResources(cleric, 5)
  };
  const result = applyMechanic({ actor, classDef: cleric, id: 'turnUndead' });
  assert.equal(result.ok, true);
  assert.equal(result.save.ability, 'wis');
  assert.equal(result.save.dc, 15);    // 8 + 3 + 4 (WIS 18 mod)
  assert.deepEqual([...result.onFail.conditions].sort(), ['frightened', 'incapacitated']);
  assert.equal(result.onFail.duration, '1 minute');
  assert.equal(result.onFail.endsOnDamage, true);
  assert.equal(result.rangeFt, 30);
  assert.equal(result.actor.resources.channelDivinity.used, 1);
});

test('Turn Undead refuses without uses', () => {
  const actor = {
    id: 'pc', level: 2, proficiencyBonus: 2,
    abilityScores: { wis: 14 },
    resources: { channelDivinity: { used: 2, max: 2, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const result = applyMechanic({ actor, classDef: cleric, id: 'turnUndead' });
  assert.equal(result.ok, false);
});

// === Read-only helper ===

test('channelDivinityDC mechanic reports the same value as the helper', () => {
  const actor = { proficiencyBonus: 4, abilityScores: { wis: 20 } };
  const result = applyMechanic({ actor, classDef: cleric, id: 'channelDivinityDC' });
  assert.equal(result.dc, 17);    // 8 + 4 + 5
});

// === Rest integration ===

test('Long Rest fully refills Channel Divinity uses', async () => {
  const { longRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 6, hitDie: 8, hitDiceTotal: 6, hp: 0, hpMax: 50,
    resources: { channelDivinity: { used: 3, max: 3, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const rested = longRest(actor);
  assert.equal(rested.resources.channelDivinity.used, 0);
});

test('Short Rest recovers exactly one Channel Divinity use', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 6,
    resources: { channelDivinity: { used: 3, max: 3, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.channelDivinity.used, 2);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Turn Undead through the registry', () => {
  const engine = createEngine({ rng: seededRng(1) });
  let actor = {
    id: 'pc', classId: 'cleric', level: 5, proficiencyBonus: 3,
    abilityScores: { wis: 16 },
    resources: engine.Mechanics.freshResources(engine.classes.cleric, 5)
  };
  const result = engine.Mechanics.apply(actor, 'turnUndead');
  assert.equal(result.ok, true);
  assert.equal(result.save.dc, 14);
});

test('engine end-to-end: spend two CD uses, short rest recovers one', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'cleric', level: 2, proficiencyBonus: 2,
    abilityScores: { wis: 14 },
    resources: engine.Mechanics.freshResources(engine.classes.cleric, 2)
  };
  ({ actor } = engine.Mechanics.apply(actor, 'turnUndead'));
  ({ actor } = engine.Mechanics.apply(actor, 'turnUndead'));
  assert.equal(actor.resources.channelDivinity.used, 2);
  actor = engine.Rest.shortRest(actor);
  assert.equal(actor.resources.channelDivinity.used, 1);
});
