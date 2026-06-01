// === v1.17.0 — Equipment depth ===
//
// Covers:
//   - Armor stealth disadvantage on DerivedSheet.skills.stealth
//   - Heavy-armor STR-requirement speed penalty on DerivedSheet.speed
//   - Encumbrance variant rule (encumbranceLevel pure function)
//   - toolCheck module-level and engine-bound (auto-proficiency from actor)
//   - Armor metadata fields on SRD item records (category, don/doff times)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createEngine } from '../src/engine.js';
import { encumbranceLevel } from '../src/character.js';
import { toolCheck } from '../src/checks.js';
import defaultItems from '../src/srd/items.js';
import { Character } from '../index.js';
import { seededRng, rollDie } from '../src/dice.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'character');
const loadFixture = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));

// Minimal valid character helper — tweak per test.
function makeRecord(overrides = {}) {
  return {
    id: 'test-pc', name: 'Tester',
    speciesId: 'human', backgroundId: 'soldier', classId: 'fighter',
    level: 1,
    abilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    equipment: { weaponIds: ['longsword'] },
    ...overrides
  };
}

// === Armor stealth disadvantage ===

test('heavy armor (chain mail) sets stealth disadvantage on the derived sheet', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('plate armor sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'plate', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('splint armor sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    equipment: { armorId: 'splint', weaponIds: ['longsword'] }
  });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('ring mail (heavy, no STR req) sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'ring-mail', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('scale mail (medium) sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'scale-mail', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('hide (medium) sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'hide', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('half plate (medium) sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'half-plate', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('padded (light) sets stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'padded', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, true);
});

test('leather armor (light) does NOT set stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'leather-armor', weaponIds: ['dagger'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, undefined);
});

test('studded leather (light) does NOT set stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'studded-leather', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, undefined);
});

test('chain shirt (medium) does NOT set stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'chain-shirt', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, undefined);
});

test('breastplate (medium) does NOT set stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord({ equipment: { armorId: 'breastplate', weaponIds: ['longsword'] } });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, undefined);
});

test('unarmored character has no stealth disadvantage', () => {
  const engine = createEngine();
  const record = makeRecord();  // no armorId
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.stealth.disadvantage, undefined);
});

test('stealth disadvantage does not alter the stealth mod', () => {
  // The penalty is representational only — mod calculation is unchanged.
  const engine = createEngine();
  const withDisadvantage = engine.deriveSheet(makeRecord({ equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] } }));
  const withoutDisadvantage = engine.deriveSheet(makeRecord({ equipment: { armorId: 'chain-shirt', weaponIds: ['longsword'] } }));
  assert.equal(withDisadvantage.skills.stealth.mod, withoutDisadvantage.skills.stealth.mod);
  assert.equal(withDisadvantage.skills.stealth.disadvantage, true);
  assert.equal(withoutDisadvantage.skills.stealth.disadvantage, undefined);
});

// === STR requirement speed penalty ===

test('chain mail with STR below requirement (13) reduces speed by 10', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] }
  });
  const sheet = engine.deriveSheet(record);
  // Human base 30 ft − 10 ft penalty = 20 ft.
  assert.equal(sheet.speed.walk, 20);
});

test('chain mail with STR exactly at requirement (13) has no speed penalty', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    // Background soldier bumps str, dex, con each by +1 → str becomes 13.
    equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] }
  });
  const sheet = engine.deriveSheet(record);
  // str 12 + 1 (soldier background) = 13 — exactly at requirement.
  assert.equal(sheet.abilityScores.final.str, 13);
  assert.equal(sheet.speed.walk, 30);
});

test('plate armor (STR 15) with STR 14 reduces speed by 10', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 13, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    // Soldier background bumps str+1 → 14, still under 15.
    equipment: { armorId: 'plate', weaponIds: ['longsword'] }
  });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.abilityScores.final.str, 14);
  assert.equal(sheet.speed.walk, 20);
});

test('STR requirement penalty and exhaustion stack', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] },
    exhaustion: 2  // 2 × 5 = 10 ft exhaustion penalty
  });
  const sheet = engine.deriveSheet(record);
  // 30 − 10 (STR req) − 10 (exhaustion) = 10 ft.
  assert.equal(sheet.speed.walk, 10);
});

test('speed-zero condition overrides STR requirement penalty', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'chain-mail', weaponIds: ['longsword'] },
    conditions: ['restrained']
  });
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.speed.walk, 0);
});

test('medium armor (no STR requirement) never applies STR penalty', () => {
  const engine = createEngine();
  const record = makeRecord({
    abilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { armorId: 'scale-mail', weaponIds: ['longsword'] }
  });
  const sheet = engine.deriveSheet(record);
  // scale-mail has no strRequirement — no penalty even at STR 8.
  assert.equal(sheet.speed.walk, 30);
});

// The fighter-l3 golden fixture uses chain-shirt (no STR req, no stealth
// penalty). Verify our changes don't break it.
test('fighter-l3 golden fixture still matches (chain-shirt — no penalties)', () => {
  const engine = createEngine();
  const record = loadFixture('fighter-l3.record.json');
  const expected = loadFixture('fighter-l3.expected.json');
  assert.deepEqual(engine.deriveSheet(record), expected);
});

// === Encumbrance variant rule ===

test('encumbranceLevel: none when weight ≤ STR × 5', () => {
  assert.equal(encumbranceLevel(10, 50), 'none');
  assert.equal(encumbranceLevel(10, 0),  'none');
  assert.equal(encumbranceLevel(15, 75), 'none');
});

test('encumbranceLevel: encumbered when weight > STR × 5 and ≤ STR × 10', () => {
  assert.equal(encumbranceLevel(10, 51),  'encumbered');
  assert.equal(encumbranceLevel(10, 100), 'encumbered');
  assert.equal(encumbranceLevel(15, 100), 'encumbered');
});

test('encumbranceLevel: heavily-encumbered when weight > STR × 10', () => {
  assert.equal(encumbranceLevel(10, 101), 'heavily-encumbered');
  assert.equal(encumbranceLevel(10, 200), 'heavily-encumbered');
  assert.equal(encumbranceLevel(15, 151), 'heavily-encumbered');
});

test('encumbranceLevel boundary: exactly STR × 5 → none', () => {
  assert.equal(encumbranceLevel(10, 50), 'none');
});

test('encumbranceLevel boundary: exactly STR × 10 → encumbered', () => {
  assert.equal(encumbranceLevel(10, 100), 'encumbered');
});

test('Character.encumbranceLevel re-export matches the module function', () => {
  assert.equal(Character.encumbranceLevel(10, 50),  'none');
  assert.equal(Character.encumbranceLevel(10, 51),  'encumbered');
  assert.equal(Character.encumbranceLevel(10, 101), 'heavily-encumbered');
});

// === toolCheck module-level ===

test('toolCheck: proficient adds proficiency bonus to total', () => {
  // Seed the rng so d20=10 deterministically.
  // seededRng and rollDie imported at top of file
  const rng = seededRng(1);
  const d20 = rollDie(20, rng);
  const rng2 = seededRng(1);                                  // reset
  const result = toolCheck({ toolId: 'thieves-tools', abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 15 }, rng2);
  // mod = floor((14-10)/2) = 2. With proficiency: d20 + 2 + 2.
  assert.equal(result.toolId, 'thieves-tools');
  assert.equal(result.total, d20 + 2 + 2);
});

test('toolCheck: non-proficient omits proficiency bonus', () => {
  // seededRng and rollDie imported at top of file
  const rng = seededRng(2);
  const d20 = rollDie(20, rng);
  const rng2 = seededRng(2);
  const result = toolCheck({ toolId: 'herbalism-kit', abilityScore: 14, proficient: false, dc: 10 }, rng2);
  assert.equal(result.total, d20 + 2);    // mod only, no prof
  assert.equal(result.toolId, 'herbalism-kit');
});

test('toolCheck without toolId does not add the field to the result', () => {
  // seededRng imported at top of file
  const result = toolCheck({ abilityScore: 10, proficient: false, dc: 10 }, seededRng(5));
  assert.equal(result.toolId, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'toolId'));
});

test('toolCheck success/failure uses clampDC', () => {
  // DC 100 should clamp to 30 — still very hard but not impossible.
  // seededRng imported at top of file
  const result = toolCheck({ abilityScore: 20, proficient: false, dc: 100 }, seededRng(1));
  assert.equal(result.dc, 30);
});

// === Engine-bound toolCheck (auto-proficiency lookup) ===

test('engine.Checks.toolCheck auto-resolves proficiency from actor.tools', () => {
  const engine = createEngine({ rng: seededRng(7) });
  const actor = { id: 'rogue', tools: ['thieves-tools'], proficiencyBonus: 2 };
  const result = engine.Checks.toolCheck({ toolId: 'thieves-tools', abilityScore: 14, dc: 15, actor });
  // Proficient because actor.tools includes the toolId.
  assert.equal(result.total, result.d20 + 2 + 2);  // mod 2 + prof 2
  assert.equal(result.toolId, 'thieves-tools');
});

test('engine.Checks.toolCheck: actor without the tool — not proficient', () => {
  const engine = createEngine({ rng: seededRng(7) });
  const actor = { id: 'fighter', tools: [], proficiencyBonus: 2 };
  const result = engine.Checks.toolCheck({ toolId: 'thieves-tools', abilityScore: 14, dc: 15, actor });
  // Not proficient — only mod applied.
  assert.equal(result.total, result.d20 + 2);
});

test('engine.Checks.toolCheck: explicit proficient:true overrides actor.tools', () => {
  const engine = createEngine({ rng: seededRng(7) });
  const actor = { id: 'fighter', tools: [], proficiencyBonus: 2 };
  const result = engine.Checks.toolCheck({ toolId: 'thieves-tools', abilityScore: 14, dc: 15, actor, proficient: true });
  // Explicit override wins — proficient.
  assert.equal(result.total, result.d20 + 2 + 2);
});

test('engine.Checks.toolCheck logs to the roll log', () => {
  const engine = createEngine();
  engine.Checks.toolCheck({ toolId: 'thieves-tools', abilityScore: 14, proficient: false, dc: 15 });
  const entry = engine.rollLog[engine.rollLog.length - 1];
  assert.equal(entry.op, 'toolCheck');
  assert.equal(entry.toolId, 'thieves-tools');
});

// === Armor item metadata fields ===

test('all armor entries have armorCategory', () => {
  const armorIds = ['padded', 'leather-armor', 'studded-leather', 'hide', 'chain-shirt',
    'scale-mail', 'breastplate', 'half-plate', 'ring-mail', 'chain-mail', 'splint', 'plate'];
  for (const id of armorIds) {
    assert.ok(
      ['light', 'medium', 'heavy'].includes(defaultItems[id].armorCategory),
      `${id} should have armorCategory 'light' | 'medium' | 'heavy'`
    );
  }
});

test('heavy armor items have correct armorCategory', () => {
  assert.equal(defaultItems['ring-mail'].armorCategory,  'heavy');
  assert.equal(defaultItems['chain-mail'].armorCategory, 'heavy');
  assert.equal(defaultItems['splint'].armorCategory,     'heavy');
  assert.equal(defaultItems['plate'].armorCategory,      'heavy');
});

test('light and medium armor items have correct armorCategory', () => {
  assert.equal(defaultItems['leather-armor'].armorCategory, 'light');
  assert.equal(defaultItems['chain-shirt'].armorCategory,   'medium');
  assert.equal(defaultItems['breastplate'].armorCategory,   'medium');
});

test('armor entries with stealth disadvantage have stealthDisadvantage: true', () => {
  const disadvantageArmors = ['padded', 'hide', 'scale-mail', 'half-plate', 'ring-mail', 'chain-mail', 'splint', 'plate'];
  for (const id of disadvantageArmors) {
    assert.equal(defaultItems[id].stealthDisadvantage, true, `${id} should have stealthDisadvantage`);
  }
});

test('armor entries without stealth disadvantage have stealthDisadvantage omitted', () => {
  const noDisadvantageArmors = ['leather-armor', 'studded-leather', 'chain-shirt', 'breastplate'];
  for (const id of noDisadvantageArmors) {
    assert.equal(defaultItems[id].stealthDisadvantage, undefined, `${id} should not have stealthDisadvantage`);
  }
});

test('only chain mail, splint, and plate have strRequirement', () => {
  assert.equal(defaultItems['chain-mail'].strRequirement, 13);
  assert.equal(defaultItems['splint'].strRequirement,     15);
  assert.equal(defaultItems['plate'].strRequirement,      15);
  // Others have no requirement.
  assert.equal(defaultItems['ring-mail'].strRequirement,  undefined);
  assert.equal(defaultItems['breastplate'].strRequirement, undefined);
  assert.equal(defaultItems['leather-armor'].strRequirement, undefined);
});

test('light armor has donMinutes:1, doffMinutes:1', () => {
  for (const id of ['padded', 'leather-armor', 'studded-leather']) {
    assert.equal(defaultItems[id].donMinutes,  1, `${id}.donMinutes`);
    assert.equal(defaultItems[id].doffMinutes, 1, `${id}.doffMinutes`);
  }
});

test('medium armor has donMinutes:5, doffMinutes:1', () => {
  for (const id of ['hide', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate']) {
    assert.equal(defaultItems[id].donMinutes,  5, `${id}.donMinutes`);
    assert.equal(defaultItems[id].doffMinutes, 1, `${id}.doffMinutes`);
  }
});

test('heavy armor has donMinutes:10, doffMinutes:5', () => {
  for (const id of ['ring-mail', 'chain-mail', 'splint', 'plate']) {
    assert.equal(defaultItems[id].donMinutes,  10, `${id}.donMinutes`);
    assert.equal(defaultItems[id].doffMinutes, 5,  `${id}.doffMinutes`);
  }
});

test('shield has no donMinutes/doffMinutes (action-based)', () => {
  assert.equal(defaultItems['shield'].donMinutes,  undefined);
  assert.equal(defaultItems['shield'].doffMinutes, undefined);
});
