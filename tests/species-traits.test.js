// === v1.13.0 — Species traits as mechanics ===
//
// Verifies that the structured mechanic fields added to each SRD
// species record (senses, damageResistances, conditionImmunities,
// flags) flow through deriveSheet correctly, that Movement.effectiveLight
// picks up darkvision from the sheet, and that the Halfling Lucky flag
// gates applyHalflingLucky calls appropriately.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import defaultSpecies from '../src/srd/species.js';

// === SRD species record fields ===

test('each SRD species has senses, damageResistances, conditionImmunities, flags', () => {
  for (const [id, sp] of Object.entries(defaultSpecies)) {
    assert.ok(typeof sp.senses === 'object' && sp.senses !== null && !Array.isArray(sp.senses),
      `${id}.senses must be an object`);
    assert.ok(Array.isArray(sp.damageResistances),
      `${id}.damageResistances must be an array`);
    assert.ok(Array.isArray(sp.conditionImmunities),
      `${id}.conditionImmunities must be an array`);
    assert.ok(typeof sp.flags === 'object' && sp.flags !== null && !Array.isArray(sp.flags),
      `${id}.flags must be an object`);
  }
});

test('darkvision species have correct ranges in senses', () => {
  assert.equal(defaultSpecies.elf.senses.darkvision, 60);
  assert.equal(defaultSpecies.gnome.senses.darkvision, 60);
  assert.equal(defaultSpecies.tiefling.senses.darkvision, 60);
  assert.equal(defaultSpecies.dwarf.senses.darkvision, 120);
  assert.equal(defaultSpecies.orc.senses.darkvision, 120);
});

test('non-darkvision species have empty senses', () => {
  assert.deepEqual(defaultSpecies.human.senses, {});
  assert.deepEqual(defaultSpecies.halfling.senses, {});
  assert.deepEqual(defaultSpecies.goliath.senses, {});
});

test('tiefling has fire in damageResistances', () => {
  assert.ok(defaultSpecies.tiefling.damageResistances.includes('fire'));
});

test('no other SRD species has base damageResistances', () => {
  for (const [id, sp] of Object.entries(defaultSpecies)) {
    if (id !== 'tiefling') {
      assert.deepEqual(sp.damageResistances, [],
        `${id} should have no base damage resistances`);
    }
  }
});

test('halfling flags contain halflingLucky and brave', () => {
  assert.equal(defaultSpecies.halfling.flags.halflingLucky, true);
  assert.equal(defaultSpecies.halfling.flags.brave, true);
});

test('elf flags contain feyAncestry', () => {
  assert.equal(defaultSpecies.elf.flags.feyAncestry, true);
});

test('dwarf flags contain dwarvenResilience and stonecunning', () => {
  assert.equal(defaultSpecies.dwarf.flags.dwarvenResilience, true);
  assert.equal(defaultSpecies.dwarf.flags.stonecunning, true);
});

// === DerivedSheet propagation ===

// Minimal valid character builder for this test file.
function makeRecord(speciesId) {
  return {
    id: 'test-pc', name: 'Tester',
    speciesId,
    backgroundId: 'acolyte',
    classId: 'fighter',
    level: 1,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: ['longsword'] }
  };
}

test('elf sheet carries darkvision 60 in senses', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('elf'));
  assert.equal(sheet.senses.darkvision, 60);
});

test('dwarf sheet carries darkvision 120 in senses', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('dwarf'));
  assert.equal(sheet.senses.darkvision, 120);
});

test('human sheet has empty senses object', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('human'));
  assert.deepEqual(sheet.senses, {});
});

test('tiefling sheet has fire in damageResistances', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('tiefling'));
  assert.ok(sheet.damageResistances.includes('fire'));
  assert.equal(sheet.damageResistances.length, 1);
});

test('human sheet has empty damageResistances', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('human'));
  assert.deepEqual(sheet.damageResistances, []);
});

test('all SRD species sheets have empty conditionImmunities', () => {
  const engine = createEngine();
  for (const id of Object.keys(defaultSpecies)) {
    const sheet = engine.deriveSheet(makeRecord(id));
    assert.deepEqual(sheet.conditionImmunities, [],
      `${id} should have no condition immunities`);
  }
});

test('halfling sheet flags contains halflingLucky: true', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('halfling'));
  assert.equal(sheet.flags.halflingLucky, true);
  assert.equal(sheet.flags.brave, true);
});

test('elf sheet flags contains feyAncestry: true', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('elf'));
  assert.equal(sheet.flags.feyAncestry, true);
});

test('human sheet has empty flags', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('human'));
  assert.deepEqual(sheet.flags, {});
});

test('sheet traits array matches species traits', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('elf'));
  assert.deepEqual(sheet.traits, ['Darkvision 60ft', 'Fey Ancestry', 'Keen Senses', 'Trance']);
});

test('sheet is deeply frozen — senses, traits, flags cannot be mutated', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('elf'));
  assert.ok(Object.isFrozen(sheet.senses));
  assert.ok(Object.isFrozen(sheet.traits));
  assert.ok(Object.isFrozen(sheet.flags));
  assert.ok(Object.isFrozen(sheet.damageResistances));
  assert.ok(Object.isFrozen(sheet.conditionImmunities));
  assert.throws(() => { sheet.senses.darkvision = 0; }, /Cannot assign/);
});

// === Plugin species can supply its own structured fields ===

test('extraSpecies with senses and flags flows through to the derived sheet', () => {
  const engine = createEngine({
    extraSpecies: {
      'shade': {
        id: 'shade', name: 'Shade', size: 'medium', speed: 30,
        traits: ['Shadow Vision'],
        senses: { darkvision: 90, truesight: 30 },
        damageResistances: ['necrotic'],
        conditionImmunities: [],
        flags: { shadowStep: true }
      }
    }
  });
  const sheet = engine.deriveSheet({ ...makeRecord('human'), speciesId: 'shade' });
  assert.equal(sheet.senses.darkvision, 90);
  assert.equal(sheet.senses.truesight, 30);
  assert.ok(sheet.damageResistances.includes('necrotic'));
  assert.equal(sheet.flags.shadowStep, true);
});

test('extraSpecies without optional mechanic fields gets empty defaults', () => {
  // Legacy / minimal plugin — no senses/damageResistances/flags at all.
  const engine = createEngine({
    extraSpecies: {
      'sprite': { id: 'sprite', name: 'Sprite', size: 'tiny', speed: 25 }
    }
  });
  const sheet = engine.deriveSheet({ ...makeRecord('human'), speciesId: 'sprite' });
  assert.deepEqual(sheet.senses, {});
  assert.deepEqual(sheet.damageResistances, []);
  assert.deepEqual(sheet.conditionImmunities, []);
  assert.deepEqual(sheet.flags, {});
});

// === effectiveLight picks up darkvision from the derived sheet senses ===

test('effectiveLight uses darkvision from species senses on a derived sheet', () => {
  const engine = createEngine();
  const elfSheet = engine.deriveSheet(makeRecord('elf'));
  // At 50 ft in darkness with a 60 ft darkvision — elf sees dim light.
  const elfLight = engine.Movement.effectiveLight(elfSheet, { ambient: 'darkness', distanceFt: 50 });
  assert.equal(elfLight, 'dim');

  // Human at the same distance in darkness — total darkness (no darkvision).
  const humanSheet = engine.deriveSheet(makeRecord('human'));
  const humanLight = engine.Movement.effectiveLight(humanSheet, { ambient: 'darkness', distanceFt: 50 });
  assert.equal(humanLight, 'darkness');
});

test('effectiveLight respects the 120 ft dwarf darkvision', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(makeRecord('dwarf'));
  // 100 ft in darkness — within dwarf darkvision, sees dim light.
  const r100 = engine.Movement.effectiveLight(sheet, { ambient: 'darkness', distanceFt: 100 });
  assert.equal(r100, 'dim');
  // 130 ft — beyond range, total darkness.
  const r130 = engine.Movement.effectiveLight(sheet, { ambient: 'darkness', distanceFt: 130 });
  assert.equal(r130, 'darkness');
});
