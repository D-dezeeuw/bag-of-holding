import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, PROFICIENCY_BY_LEVEL, levelForXP, nextLevelThreshold } from '../src/xp.js';
import { createEngine } from '../src/engine.js';

const ALL_CLASSES = [
  'fighter', 'rogue', 'cleric', 'wizard',
  'barbarian', 'bard', 'druid', 'monk',
  'paladin', 'ranger', 'sorcerer', 'warlock'
];

// === XP table and proficiency

test('THRESHOLDS includes L6..L20 inclusive', () => {
  for (let lvl = 6; lvl <= 20; lvl++) {
    assert.ok(Number.isInteger(THRESHOLDS[lvl]), `missing L${lvl}`);
  }
});

test('THRESHOLDS is monotonic non-decreasing', () => {
  for (let lvl = 2; lvl <= 20; lvl++) {
    assert.ok(THRESHOLDS[lvl] > THRESHOLDS[lvl - 1], `L${lvl} not > L${lvl - 1}`);
  }
});

test('PROFICIENCY_BY_LEVEL matches SRD breakpoints', () => {
  // +2 at 1–4
  for (let lvl = 1; lvl <= 4; lvl++) assert.equal(PROFICIENCY_BY_LEVEL[lvl], 2, `L${lvl}`);
  // +3 at 5–8
  for (let lvl = 5; lvl <= 8; lvl++) assert.equal(PROFICIENCY_BY_LEVEL[lvl], 3, `L${lvl}`);
  // +4 at 9–12
  for (let lvl = 9; lvl <= 12; lvl++) assert.equal(PROFICIENCY_BY_LEVEL[lvl], 4, `L${lvl}`);
  // +5 at 13–16
  for (let lvl = 13; lvl <= 16; lvl++) assert.equal(PROFICIENCY_BY_LEVEL[lvl], 5, `L${lvl}`);
  // +6 at 17–20
  for (let lvl = 17; lvl <= 20; lvl++) assert.equal(PROFICIENCY_BY_LEVEL[lvl], 6, `L${lvl}`);
});

test('levelForXP resolves tier 2 thresholds correctly', () => {
  assert.equal(levelForXP(14000), 6);
  assert.equal(levelForXP(13999), 5);
  assert.equal(levelForXP(64000), 10);
  assert.equal(levelForXP(355000), 20);
});

test('nextLevelThreshold returns null at level 20', () => {
  assert.equal(nextLevelThreshold(355000), null);
});

// === Class features at L6–10

for (const id of ALL_CLASSES) {
  test(`${id} declares features at L6–10`, () => {
    const engine = createEngine();
    const cls = engine.classes[id];
    for (let lvl = 6; lvl <= 10; lvl++) {
      assert.ok(Array.isArray(cls.features[lvl]), `${id} L${lvl} features not array`);
    }
  });
}

test('Rogue carries scaling sneakAttackDice through tier 2', () => {
  const engine = createEngine();
  const rogue = engine.classes.rogue;
  assert.equal(rogue.sneakAttackDice[5], 3);
  assert.equal(rogue.sneakAttackDice[7], 4);
  assert.equal(rogue.sneakAttackDice[9], 5);
});

// === Spellcasting at tier 2

test('Wizard L10 has access to L5 slots', () => {
  const engine = createEngine();
  assert.equal(engine.Spellcasting.fullCasterSlots(10, 5), 2);
});

test('Paladin L9 has access to L3 slots', () => {
  const engine = createEngine();
  assert.equal(engine.Spellcasting.halfCasterSlots(9, 3), 2);
});

test('Warlock L7 has 2 pact slots at level 4', () => {
  const engine = createEngine();
  assert.deepEqual(engine.Spellcasting.warlockPactSlots(7), { count: 2, level: 4 });
});

test('Wizard L10 freshSlots reflects the full L10 row', () => {
  const engine = createEngine();
  const slots = engine.Spellcasting.freshSlots('full', 10);
  // L10 row: [_, 4, 3, 3, 3, 2, 0, 0, 0, 0]
  assert.deepEqual(slots, [
    { level: 1, used: 0, max: 4 },
    { level: 2, used: 0, max: 3 },
    { level: 3, used: 0, max: 3 },
    { level: 4, used: 0, max: 3 },
    { level: 5, used: 0, max: 2 }
  ]);
});

// === Cantrip scaling crossing the L5 → tier-2 boundary

test('Fire Bolt at L5 doubles dice (tier 2)', () => {
  const engine = createEngine();
  assert.equal(engine.Spellcasting.scaledDamageSpec('1d10', 5), '2d10');
});

test('Fire Bolt at L10 stays at tier 2 (not tier 3)', () => {
  const engine = createEngine();
  assert.equal(engine.Spellcasting.scaledDamageSpec('1d10', 10), '2d10');
});

// === Character sheet derivation at L10

test('deriveSheet handles a tier-2 character (L10 Wizard)', () => {
  const engine = createEngine();
  const record = {
    id: 'gandalf', name: 'Gandalf',
    speciesId: 'human', backgroundId: 'sage', classId: 'wizard',
    level: 10,
    abilityScores: { str: 10, dex: 12, con: 14, int: 18, wis: 14, cha: 10 },
    equipment: { weaponIds: [] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.meta.level, 10);
  assert.equal(sheet.proficiencyBonus, 4);   // SRD: +4 at L9–12
  assert.ok(sheet.hp.max > 0);
});

test('deriveSheet falls back to ceil(level/4)+1 when custom proficiency table omits the level', () => {
  // A pack that ships a sparse proficiencyByLevel (only L1) — every
  // higher level falls back to the formula. The fallback exists so
  // a partially-specified pack doesn't crash a tier-2 sheet.
  const engine = createEngine({
    rules: { proficiencyByLevel: { 1: 2 } }
  });
  const record = {
    id: 'a', name: 'A',
    speciesId: 'human', backgroundId: 'sage', classId: 'wizard',
    level: 5,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: [] }
  };
  const sheet = engine.deriveSheet(record);
  // ceil(5/4) + 1 = 2 + 1 = 3
  assert.equal(sheet.proficiencyBonus, 3);
});
