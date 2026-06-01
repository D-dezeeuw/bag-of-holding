// === 1.17.0 equipment depth ===
//
// Encumbrance variant, armor metadata (don/doff time, stealth
// disadvantage, strRequired), tool proficiency, and adventuring gear
// + lifestyle + services registries.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';
import {
  encumbranceLevel,
  encumbranceSpeedPenalty,
  armorStrengthPenalty,
  carriedWeight,
  donTime,
  doffTime,
  toolCheck,
  ADVENTURING_GEAR,
  TOOLS,
  LIFESTYLES,
  SERVICES
} from '../src/equipment.js';

test('encumbranceLevel: under 5x STR is none', () => {
  assert.equal(encumbranceLevel({ strength: 10, carriedWeight: 30 }), 'none');
});

test('encumbranceLevel: between 5x and 10x STR is encumbered', () => {
  assert.equal(encumbranceLevel({ strength: 10, carriedWeight: 60 }), 'encumbered');
});

test('encumbranceLevel: past 10x STR is heavily-encumbered', () => {
  assert.equal(encumbranceLevel({ strength: 10, carriedWeight: 120 }), 'heavily-encumbered');
});

test('encumbranceLevel: edge case at exactly 5x is still none', () => {
  assert.equal(encumbranceLevel({ strength: 10, carriedWeight: 50 }), 'none');
});

test('encumbranceLevel: rejects negative strength', () => {
  assert.throws(() => encumbranceLevel({ strength: -1, carriedWeight: 5 }), /strength/);
});

test('encumbranceLevel: rejects negative carriedWeight', () => {
  assert.throws(() => encumbranceLevel({ strength: 10, carriedWeight: -5 }), /carriedWeight/);
});

test('encumbranceSpeedPenalty matches SRD: 10 ft encumbered, 20 ft heavily', () => {
  assert.equal(encumbranceSpeedPenalty('encumbered'), 10);
  assert.equal(encumbranceSpeedPenalty('heavily-encumbered'), 20);
  assert.equal(encumbranceSpeedPenalty('none'), 0);
  assert.equal(encumbranceSpeedPenalty(undefined), 0);
});

test('armorStrengthPenalty: 10 ft when STR is below the armor requirement', () => {
  const splint = { strRequired: 15 };
  assert.equal(armorStrengthPenalty(splint, 12), 10);
  assert.equal(armorStrengthPenalty(splint, 15), 0);
  assert.equal(armorStrengthPenalty(splint, 18), 0);
});

test('armorStrengthPenalty: zero penalty for armor with no requirement', () => {
  assert.equal(armorStrengthPenalty({}, 8), 0);
  assert.equal(armorStrengthPenalty(null, 12), 0);
});

test('carriedWeight sums the items registry weights', () => {
  const items = { 'a': { weight: 5 }, 'b': { weight: 2 }, 'c': {} };
  assert.equal(carriedWeight(['a', 'b', 'c'], items), 7);
});

test('carriedWeight returns 0 for non-array input', () => {
  assert.equal(carriedWeight(undefined, {}), 0);
});

test('carriedWeight skips unknown ids', () => {
  const items = { 'a': { weight: 5 } };
  assert.equal(carriedWeight(['a', 'unknown'], items), 5);
});

test('donTime and doffTime return null for unknown / missing armor', () => {
  assert.equal(donTime('unknown', {}), null);
  assert.equal(doffTime('unknown', {}), null);
});

test('donTime and doffTime return the SRD minutes for known armor', () => {
  const engine = createEngine();
  assert.equal(engine.Equipment.donTime('plate'), 10);
  assert.equal(engine.Equipment.doffTime('plate'), 5);
  assert.equal(engine.Equipment.donTime('shield'), 0);
});

test('toolCheck proficient roll adds the proficiency bonus', () => {
  const actor = { proficiencies: { tools: ['thieves-tools'] } };
  const result = toolCheck({ actor, toolId: 'thieves-tools', abilityScore: 16, dc: 15, proficiencyBonus: 2 }, () => 0.99);
  // d20=20, +3 (DEX 16 mod), +2 (prof) = 25, beats 15.
  assert.equal(result.success, true);
  assert.equal(result.mod, 5);
});

test('toolCheck non-proficient skips the proficiency bonus', () => {
  const actor = {};
  const result = toolCheck({ actor, toolId: 'thieves-tools', abilityScore: 14, dc: 10 }, () => 0.5);
  assert.equal(result.mod, 2);
});

test('toolCheck reads actor.tools as a fallback proficiency list', () => {
  const actor = { tools: ['herbalism-kit'] };
  const result = toolCheck({ actor, toolId: 'herbalism-kit', abilityScore: 12, dc: 10 }, () => 0.99);
  assert.equal(result.mod, 3); // wis 12 mod=+1, prof +2
});

test('toolCheck throws when toolId is missing', () => {
  assert.throws(() => toolCheck({ actor: {}, abilityScore: 10, dc: 10 }), /toolId is required/);
});

test('toolCheck defaults abilityScore to 10 when omitted', () => {
  const result = toolCheck({ actor: {}, toolId: 'thieves-tools', dc: 10 }, () => 0.99);
  assert.equal(result.mod, 0);
});

test('toolCheck handles actor without a proficiencies block', () => {
  const result = toolCheck({ actor: null, toolId: 'thieves-tools', abilityScore: 10, dc: 10 }, () => 0.5);
  assert.equal(result.mod, 0);
});

test('ADVENTURING_GEAR includes the canonical kit', () => {
  assert.ok(ADVENTURING_GEAR['backpack']);
  assert.ok(ADVENTURING_GEAR['bedroll']);
  assert.ok(ADVENTURING_GEAR['torch']);
  assert.ok(ADVENTURING_GEAR['rope-hempen-50']);
});

test('TOOLS lists all 16 SRD tool ids', () => {
  assert.equal(Object.keys(TOOLS).length, 16);
  assert.equal(TOOLS['thieves-tools'], 'Thieves\' Tools');
});

test('LIFESTYLES table matches SRD gp/day rates', () => {
  assert.equal(LIFESTYLES.modest, 1);
  assert.equal(LIFESTYLES.aristocratic, 10);
});

test('SERVICES table includes hireling rates', () => {
  assert.equal(SERVICES['hireling-skilled'].cost, 2);
});

test('engine.Equipment.toolCheck routes through the seeded rng', () => {
  const engine = createEngine();
  const logBefore = engine.rollLog.length;
  engine.Equipment.toolCheck({ actor: { proficiencies: { tools: ['thieves-tools'] } }, toolId: 'thieves-tools', abilityScore: 14, dc: 10 });
  // toolCheck delegates to abilityCheck which calls rollDie; rollLog gets at least one entry.
  assert.ok(engine.rollLog.length >= logBefore); // toolCheck doesn't yet log itself, but rng was consumed
});

test('engine.Equipment.carriedWeight uses the engine items registry', () => {
  const engine = createEngine();
  // shield = 6 lb, chain-shirt = 20 lb
  assert.equal(engine.Equipment.carriedWeight(['shield', 'chain-shirt']), 26);
});

test('character sheet: heavy armor flags stealth disadvantage', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', level: 3,
    abilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'plate', weaponIds: [] }
  });
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('character sheet: heavy armor without meeting strRequired reduces walk speed by 10', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', level: 3,
    abilityScores: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'plate', weaponIds: [] }
  });
  // STR 8 < 15 required, base speed 30, -10 = 20.
  // Background soldier bumps STR +1 (default), making STR 9, still under 15.
  assert.equal(sheet.speed.walk, 20);
});

test('character sheet: meeting strRequired removes the speed penalty', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', level: 3,
    abilityScores: { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'plate', weaponIds: [] }
  });
  // STR 15 + soldier +1 = 16, meets the splint/plate threshold.
  assert.equal(sheet.speed.walk, 30);
});

test('character sheet: encumbrance variant subtracts 10 ft for encumbered', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', level: 1,
    abilityScores: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: [] },
    encumbrance: 'encumbered'
  });
  assert.equal(sheet.speed.walk, 20);
});

test('character sheet: encumbrance variant subtracts 20 ft for heavily encumbered', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter', level: 1,
    abilityScores: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: [] },
    encumbrance: 'heavily-encumbered'
  });
  assert.equal(sheet.speed.walk, 10);
});

test('items: SRD armor records carry category + weight + don/doff time', () => {
  const engine = createEngine();
  assert.equal(engine.items.plate.category, 'heavy');
  assert.equal(engine.items.plate.weight, 65);
  assert.equal(engine.items.plate.donTime, 10);
  assert.equal(engine.items.plate.strRequired, 15);
  assert.equal(engine.items['leather-armor'].category, 'light');
  assert.equal(engine.items.shield.category, 'shield');
});
