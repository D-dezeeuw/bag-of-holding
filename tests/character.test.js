import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createEngine } from '../src/engine.js';
import * as Character from '../src/character.js';
import defaultEngine, { Character as CharacterNamespace } from '../index.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'character');
const loadFixture = (name) =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));

// === Pinned fixtures (golden-output tests) ===
//
// Any math change here forces an intentional update — these are the
// receipts for the worked example in docs/character-sheet.md. If you
// edit the rules, regenerate the fixture deliberately rather than
// silently letting the test pass.

test('L3 Fighter (Soldier, chain shirt + shield + longsword) matches pinned sheet', () => {
  const engine = createEngine();
  const record = loadFixture('fighter-l3.record.json');
  const expected = loadFixture('fighter-l3.expected.json');
  const sheet = engine.deriveSheet(record);
  assert.deepEqual(sheet, expected);
});

test('L1 Halfling Rogue (Criminal, dagger, stealth expertise) matches pinned sheet', () => {
  const engine = createEngine();
  const record = loadFixture('rogue-l1.record.json');
  const expected = loadFixture('rogue-l1.expected.json');
  const sheet = engine.deriveSheet(record);
  assert.deepEqual(sheet, expected);
});

test('L5 Wizard (Sage, +2/+1/0 ability bumps, quarterstaff, blinded) matches pinned sheet', () => {
  const engine = createEngine();
  const record = loadFixture('wizard-l5.record.json');
  const expected = loadFixture('wizard-l5.expected.json');
  const sheet = engine.deriveSheet(record);
  assert.deepEqual(sheet, expected);
});

// === Output is deeply frozen ===

test('the returned sheet and its nested objects are frozen', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(loadFixture('fighter-l3.record.json'));
  assert.ok(Object.isFrozen(sheet), 'top-level frozen');
  assert.ok(Object.isFrozen(sheet.abilityScores), 'abilityScores frozen');
  assert.ok(Object.isFrozen(sheet.abilityScores.final), 'abilityScores.final frozen');
  assert.ok(Object.isFrozen(sheet.ac), 'ac frozen');
  assert.ok(Object.isFrozen(sheet.ac.breakdown), 'ac.breakdown frozen');
  assert.ok(Object.isFrozen(sheet.attacks), 'attacks frozen');
  assert.ok(Object.isFrozen(sheet.attacks[0]), 'attacks[0] frozen');
  assert.ok(Object.isFrozen(sheet.attacks[0].properties), 'attacks[0].properties frozen');
  assert.throws(() => { sheet.ac.value = 0; }, /Cannot assign/);
});

// === Module-level API (registry-injection form) ===

test('Character.deriveSheet works module-level with an engine view as registries', () => {
  const engine = createEngine();
  const record = loadFixture('fighter-l3.record.json');
  const sheet = Character.deriveSheet(record, engine);
  // Engine satisfies CharacterRegistries structurally — same sheet.
  assert.deepEqual(sheet, engine.deriveSheet(record));
});

test('Character namespace re-export carries deriveSheet and SKILL_ABILITY', () => {
  assert.equal(typeof CharacterNamespace.deriveSheet, 'function');
  assert.equal(CharacterNamespace.SKILL_ABILITY.athletics, 'str');
  assert.equal(CharacterNamespace.SKILL_ABILITY['sleight-of-hand'], 'dex');
});

test('default engine carries deriveSheet bound to its registries', () => {
  const sheet = defaultEngine.deriveSheet(loadFixture('rogue-l1.record.json'));
  assert.equal(sheet.meta.classId, 'rogue');
});

// === Validation ===

test('rejects a non-object record', () => {
  const engine = createEngine();
  assert.throws(() => engine.deriveSheet(null), /CharacterRecord must be an object/);
  assert.throws(() => engine.deriveSheet('not-a-record'), /CharacterRecord must be an object/);
  assert.throws(() => engine.deriveSheet([]), /CharacterRecord must be an object/);
});

test('rejects missing or empty required string fields', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  for (const field of ['id', 'name', 'speciesId', 'backgroundId', 'classId']) {
    assert.throws(
      () => engine.deriveSheet({ ...valid, [field]: '' }),
      new RegExp(`CharacterRecord\\.${field} must be a non-empty string`)
    );
    assert.throws(
      () => engine.deriveSheet({ ...valid, [field]: 42 }),
      new RegExp(`CharacterRecord\\.${field} must be a non-empty string`)
    );
  }
});

test('rejects a non-positive-integer level', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  assert.throws(() => engine.deriveSheet({ ...valid, level: 0 }),    /level must be a positive integer/);
  assert.throws(() => engine.deriveSheet({ ...valid, level: -1 }),   /level must be a positive integer/);
  assert.throws(() => engine.deriveSheet({ ...valid, level: 1.5 }),  /level must be a positive integer/);
  assert.throws(() => engine.deriveSheet({ ...valid, level: 'two' }),/level must be a positive integer/);
});

test('rejects malformed abilityScores object or non-integer scores', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  assert.throws(() => engine.deriveSheet({ ...valid, abilityScores: null }), /abilityScores must be an object/);
  assert.throws(() => engine.deriveSheet({ ...valid, abilityScores: 'high' }), /abilityScores must be an object/);
  assert.throws(
    () => engine.deriveSheet({ ...valid, abilityScores: { ...valid.abilityScores, str: 'high' } }),
    /abilityScores\.str must be an integer/
  );
});

test('rejects equipment that is not an object or has a non-array weaponIds', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  assert.throws(() => engine.deriveSheet({ ...valid, equipment: null }), /equipment must be an object/);
  assert.throws(
    () => engine.deriveSheet({ ...valid, equipment: { ...valid.equipment, weaponIds: 'longsword' } }),
    /equipment\.weaponIds must be an array/
  );
});

test('rejects unknown speciesId / classId / backgroundId with the offending value', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  assert.throws(
    () => engine.deriveSheet({ ...valid, speciesId: 'kobold' }),
    /speciesId 'kobold' not registered with engine/
  );
  assert.throws(
    () => engine.deriveSheet({ ...valid, classId: 'not-a-real-class' }),
    /classId 'not-a-real-class' not registered with engine/
  );
  assert.throws(
    () => engine.deriveSheet({ ...valid, backgroundId: 'not-a-real-background' }),
    /backgroundId 'not-a-real-background' not registered with engine/
  );
});

test('rejects unknown armor / shield / weapon ids in equipment', () => {
  const engine = createEngine();
  const valid = loadFixture('fighter-l3.record.json');
  assert.throws(
    () => engine.deriveSheet({ ...valid, equipment: { ...valid.equipment, armorId: 'no-such-armor' } }),
    /equipment\.armorId 'no-such-armor' not registered with engine/
  );
  assert.throws(
    () => engine.deriveSheet({ ...valid, equipment: { ...valid.equipment, shieldId: 'tower-shield' } }),
    /equipment\.shieldId 'tower-shield' not registered with engine/
  );
  assert.throws(
    () => engine.deriveSheet({ ...valid, equipment: { ...valid.equipment, weaponIds: ['no-such-weapon'] } }),
    /equipment\.weaponIds entry 'no-such-weapon' not registered with engine/
  );
});

// === Ability bump edge cases ===

test('explicit ability bumps leave unspecified abilities unchanged (?? 0 path)', () => {
  // Sage background lists con/int/wis; bumps only int+2/wis+1 and
  // omit con — the engine must NOT add anything to con under the
  // explicit path.
  const engine = createEngine();
  const record = {
    ...loadFixture('wizard-l5.record.json'),
    abilityScoreBumps: { int: 2, wis: 1 }            // no con field at all
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.abilityScores.final.con, record.abilityScores.con);   // unchanged
  assert.equal(sheet.abilityScores.final.int, record.abilityScores.int + 2);
});

// === HP edge cases ===

test('hpRolled overrides the L1 max-die default and per-level averages', () => {
  const engine = createEngine();
  const base = loadFixture('fighter-l3.record.json');
  // L1 rolled = 7 (instead of die max 10), L2 rolled = 4 (instead of avg 6).
  // L3 left blank → average (6). conMod = +2 each level.
  const record = { ...base, hpRolled: [7, 4] };
  const sheet = engine.deriveSheet(record);
  // 7 + 2 (L1) + 4 + 2 (L2) + 6 + 2 (L3) = 23
  assert.equal(sheet.hp.max, 23);
});

test('falls back to (floor(d/2)+1) when the class hit die is off-table', () => {
  // A homebrew d20 class — well off the SRD table — exercises the
  // AVG_HP_BY_DIE fallback branch. d20 → floor(10)+1 = 11.
  const engine = createEngine({
    extraClasses: {
      'titan': { id: 'titan', name: 'Titan', hitDie: 20, savingThrowProficiencies: ['str', 'con'] }
    }
  });
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    classId: 'titan',
    level: 2
  };
  const sheet = engine.deriveSheet(record);
  // L1: die 20 + con(+2) = 22. L2: avg-fallback 11 + 2 = 13. Total 35.
  assert.equal(sheet.hp.max, 35);
});

// === AC edge cases ===

test('light armor (addsDex, no maxDex) lets DEX through unclamped', () => {
  // Leather has addsDex true and no maxDex. A DEX-heavy PC should
  // get the full DEX mod.
  const engine = createEngine();
  const record = {
    ...loadFixture('rogue-l1.record.json'),
    equipment: { armorId: 'leather-armor', weaponIds: ['dagger'] }
  };
  const sheet = engine.deriveSheet(record);
  // leather 11 + DEX(+3) = 14, no shield.
  assert.equal(sheet.ac.value, 14);
  assert.equal(sheet.ac.breakdown.armor, 11);
  assert.equal(sheet.ac.breakdown.dex, 3);
});

test('heavy armor (addsDex omitted/false) ignores DEX', () => {
  // No heavy armor ships in the SRD registry yet — introduce one as
  // a plugin item to exercise the "no DEX" branch.
  const engine = createEngine({
    extraItems: { 'plate': { id: 'plate', name: 'Plate', type: 'armor', ac: 18 } }
  });
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    equipment: { armorId: 'plate', weaponIds: ['longsword'] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.ac.value, 18);                          // no DEX, no shield
  assert.equal(sheet.ac.breakdown.dex, 0);
});

test('armor with no `ac` field falls back to 10 in the breakdown', () => {
  // A pathological homebrew armor — exercises the `armor.ac ?? 10`
  // path so a future schema change doesn't silently produce NaN ACs.
  const engine = createEngine({
    extraItems: { 'cloak': { id: 'cloak', name: 'Cloak', type: 'armor', addsDex: true } }
  });
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    equipment: { armorId: 'cloak', weaponIds: ['longsword'] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.ac.breakdown.armor, 10);
});

test('shield without an explicit acBonus contributes 0 via the optional chain', () => {
  // Defensive: a malformed shield record shouldn't crash. Adds 0 AC,
  // breakdown reflects it.
  const engine = createEngine({
    extraItems: { 'buckler': { id: 'buckler', name: 'Buckler', type: 'armor' } }
  });
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    equipment: { ...loadFixture('fighter-l3.record.json').equipment, shieldId: 'buckler' }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.ac.breakdown.shield, 0);
});

// === Initiative ===

test('Alert grants proficiency-bonus on initiative (covered by rogue fixture); confirm directly', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(loadFixture('rogue-l1.record.json'));
  // dex(+3) + prof(2) = +5.
  assert.equal(sheet.initiative, 5);
});

// === Speed edge cases ===

test('a speed-zero condition (Restrained) drops walking speed to 0 even before exhaustion', () => {
  const engine = createEngine();
  const record = { ...loadFixture('fighter-l3.record.json'), conditions: ['restrained'] };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.speed.walk, 0);
  assert.deepEqual(sheet.activeEffects.conditions, ['restrained']);
});

test('Exhaustion subtracts 5 ft per level', () => {
  const engine = createEngine();
  const record = { ...loadFixture('fighter-l3.record.json'), exhaustion: 3 };
  const sheet = engine.deriveSheet(record);
  // 30 - 5*3 = 15.
  assert.equal(sheet.speed.walk, 15);
  assert.equal(sheet.activeEffects.exhaustion, 3);
});

test('Exhaustion past species speed floors walking speed at 0', () => {
  const engine = createEngine();
  const record = { ...loadFixture('fighter-l3.record.json'), exhaustion: 6 };  // 6 × 5 = 30
  const sheet = engine.deriveSheet(record);
  // 30 - 30 = 0; Max guard prevents going negative on huge penalties.
  assert.equal(sheet.speed.walk, 0);
});

// === Saves / skills extension ===

test('record.proficiencies.saves adds saves on top of class proficiencies', () => {
  const engine = createEngine();
  const record = {
    ...loadFixture('rogue-l1.record.json'),
    proficiencies: { saves: ['cha'], expertise: ['stealth'] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.saves.cha.proficient, true);
  assert.equal(sheet.saves.cha.mod, 0 + 2);                  // cha 0 + prof 2
  // Class saves still apply.
  assert.equal(sheet.saves.dex.proficient, true);
});

test('record.proficiencies.skills adds skill proficiencies on top of background', () => {
  const engine = createEngine();
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    proficiencies: { skills: ['perception'] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.perception.proficient, true);
  assert.equal(sheet.skills.perception.mod, 1 + 2);          // wis +1 + prof 2
  // Background skill still proficient.
  assert.equal(sheet.skills.athletics.proficient, true);
});

test('expertise on a non-proficient skill is silently ignored (tolerant edit-state)', () => {
  const engine = createEngine();
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    proficiencies: { expertise: ['arcana'] }                 // not proficient
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.skills.arcana.expertise, false);
  assert.equal(sheet.skills.arcana.proficient, false);
  assert.equal(sheet.skills.arcana.mod, 0);                  // int +0, no prof
});

// === Attacks ===

test('ranged weapon uses DEX', () => {
  const engine = createEngine();
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    equipment: { ...loadFixture('fighter-l3.record.json').equipment, weaponIds: ['shortbow'] }
  };
  const sheet = engine.deriveSheet(record);
  // dex(+2) + prof(2) = +4.
  assert.equal(sheet.attacks[0].attackBonus, 4);
  assert.equal(sheet.attacks[0].damageMod, 2);
  assert.equal(sheet.attacks[0].masteryProperty, 'vex');
});

test('weapon without damage or properties uses safe defaults', () => {
  // A homebrew "improvised club" — no damage spec, no properties.
  // Engine must not crash, and the sheet should reflect the gaps.
  const engine = createEngine({
    extraItems: { 'club': { id: 'club', name: 'Club', type: 'weapon' } }
  });
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    equipment: { ...loadFixture('fighter-l3.record.json').equipment, weaponIds: ['club'] }
  };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.attacks[0].damageDice, '0');
  assert.deepEqual(sheet.attacks[0].properties, []);
  assert.equal(sheet.attacks[0].masteryProperty, undefined);
});

// === Spellcasting ===

test('non-caster classes return spellcasting: null', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(loadFixture('rogue-l1.record.json'));
  assert.equal(sheet.spellcasting, null);
});

// === Feats / origin-feat dedup ===

test('listing the background origin feat on the record does not duplicate it', () => {
  // Soldier's origin feat is `savage-attacker`. Listing it explicitly
  // alongside Alert should collapse on id and still let Alert add
  // initiative proficiency.
  const engine = createEngine();
  const record = {
    ...loadFixture('fighter-l3.record.json'),
    feats: [{ id: 'savage-attacker' }, { id: 'alert' }]
  };
  const sheet = engine.deriveSheet(record);
  // dex(+2) + prof(2) = +4 (alert kicked in).
  assert.equal(sheet.initiative, 4);
});

// === Carrying capacity by size ===

test('Tiny creatures get the 0.5 size multiplier on carrying capacity', () => {
  // No tiny PCs in the SRD set — add a homebrew "Sprite" species.
  const engine = createEngine({
    extraSpecies: { 'sprite': { id: 'sprite', name: 'Sprite', size: 'tiny', speed: 25 } }
  });
  const record = { ...loadFixture('rogue-l1.record.json'), speciesId: 'sprite' };
  const sheet = engine.deriveSheet(record);
  // str 8 × 15 × 0.5 = 60.
  assert.equal(sheet.carryingCapacity.capacity, 60);
});

test('unknown sizes fall back to ×1 (?? 1 branch)', () => {
  const engine = createEngine({
    extraSpecies: { 'weirdling': { id: 'weirdling', name: 'Weirdling', size: 'mythic', speed: 30 } }
  });
  const record = { ...loadFixture('rogue-l1.record.json'), speciesId: 'weirdling' };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.carryingCapacity.capacity, 8 * 15);     // ×1 fallback
});

// === Proficiency bonus fallback past tier 1 ===

test('proficiency bonus falls back to the ceil(level/4)+1 formula past the XP table', () => {
  // The shipped XP.PROFICIENCY_BY_LEVEL only covers L1–5. A L6 PC
  // exercises the fallback so a future tier-2 release replacing the
  // lookup doesn't silently break this case.
  const engine = createEngine();
  const record = { ...loadFixture('fighter-l3.record.json'), level: 6 };
  const sheet = engine.deriveSheet(record);
  // ceil(6/4) + 1 = 3.
  assert.equal(sheet.proficiencyBonus, 3);
});

// === Defensive defaults on incomplete plugin records ===
//
// The plugin validator requires `id`/`name`/`hitDie` for classes and
// `skillProficiencies` for backgrounds, but neither is required to
// be a non-empty list — a homebrew "commoner" class with no save
// proficiencies is legitimate, and a malformed background mid-edit
// shouldn't crash derivation. Both `?? []` paths get exercised here.

test('class with no savingThrowProficiencies yields no proficient saves', () => {
  const engine = createEngine({
    extraClasses: { 'commoner': { id: 'commoner', name: 'Commoner', hitDie: 6 } }
  });
  const record = { ...loadFixture('rogue-l1.record.json'), classId: 'commoner' };
  const sheet = engine.deriveSheet(record);
  for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    assert.equal(sheet.saves[ability].proficient, false);
  }
});

test('background with missing skillProficiencies derives no skill proficiencies (defensive)', () => {
  // The plugin validator requires the field, so we call the module
  // surface directly with a custom registries view to hit the
  // defensive `?? []` fallback.
  const engine = createEngine();
  const registries = {
    ...engine,
    backgrounds: {
      ...engine.backgrounds,
      'wanderer': {
        id: 'wanderer', name: 'Wanderer', abilityScores: ['str', 'dex', 'con'],
        originFeat: { id: 'alert' }
        // skillProficiencies intentionally omitted
      }
    }
  };
  const record = { ...loadFixture('fighter-l3.record.json'), backgroundId: 'wanderer' };
  const sheet = Character.deriveSheet(record, registries);
  for (const skill of Object.keys(sheet.skills)) {
    assert.equal(sheet.skills[skill].proficient, false);
  }
});

// === Subclass / notes / xp pass-through ===

test('subclassId surfaces in meta when set on the record', () => {
  const engine = createEngine();
  const record = { ...loadFixture('fighter-l3.record.json'), subclassId: 'champion' };
  const sheet = engine.deriveSheet(record);
  assert.equal(sheet.meta.subclassId, 'champion');
});
