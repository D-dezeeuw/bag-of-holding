// === 1.13.0 species traits as mechanics ===
//
// The species records carry both a free-form `traits` list (UI labels)
// and a structured `effects` block (darkvision, resistances, flag map,
// alternate movement modes). These tests pin the surface deriveSheet
// exposes onto the sheet and the resilience to homebrew species that
// omit the effects block.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';

const baseRecord = (overrides = {}) => ({
  id: 'pc', name: 'PC',
  classId: 'fighter', level: 1, backgroundId: 'soldier',
  abilityScores: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
  equipment: { weaponIds: [] },
  ...overrides
});

test('elf surfaces darkvision 60 ft and fey-ancestry / trance flags', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'elf' }));
  assert.equal(sheet.senses.darkvision, 60);
  assert.equal(sheet.senses.blindsight, 0);
  assert.equal(sheet.senses.truesight, 0);
  assert.equal(sheet.traitFlags.feyAncestry, true);
  assert.equal(sheet.traitFlags.trance, true);
  assert.equal(sheet.traitFlags.keenSenses, true);
});

test('dwarf darkvision is 120 ft and grants poison resistance + stonecunning flag', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'dwarf' }));
  assert.equal(sheet.senses.darkvision, 120);
  assert.deepEqual(sheet.damageResistances, ['poison']);
  assert.equal(sheet.traitFlags.stonecunning, true);
});

test('tiefling carries fire resistance', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'tiefling' }));
  assert.deepEqual(sheet.damageResistances, ['fire']);
  assert.equal(sheet.senses.darkvision, 60);
});

test('halfling exposes brave + lucky flags with no darkvision', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'halfling' }));
  assert.equal(sheet.senses.darkvision, 0);
  assert.equal(sheet.traitFlags.brave, true);
  assert.equal(sheet.traitFlags.lucky, true);
});

test('damageResistances is a fresh array per derivation (no leaks into the species record)', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'dwarf' }));
  const otherSheet = engine.deriveSheet(baseRecord({ speciesId: 'dwarf' }));
  assert.notStrictEqual(sheet.damageResistances, otherSheet.damageResistances);
  assert.deepEqual(sheet.damageResistances, otherSheet.damageResistances);
});

test('homebrew species without an effects block derives empty senses, resistances, and flags', () => {
  const engine = createEngine({
    extraSpecies: {
      'cave-fish': { id: 'cave-fish', name: 'Cave Fish', size: 'small', speed: 20 }
    }
  });
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'cave-fish' }));
  assert.deepEqual(sheet.senses, { darkvision: 0, blindsight: 0, truesight: 0 });
  assert.deepEqual(sheet.damageResistances, []);
  assert.deepEqual(sheet.traitFlags, {});
  assert.deepEqual(sheet.speed, { walk: 20 });
});

test('extraSpeeds on a homebrew species merge into the derived speed block', () => {
  const engine = createEngine({
    extraSpecies: {
      'sky-elf': {
        id: 'sky-elf', name: 'Sky Elf', size: 'medium', speed: 30,
        effects: { extraSpeeds: { fly: 30, climb: 20 } }
      }
    }
  });
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'sky-elf' }));
  assert.equal(sheet.speed.walk, 30);
  assert.equal(sheet.speed.fly, 30);
  assert.equal(sheet.speed.climb, 20);
});

test('speed-zero condition zeroes every movement mode, not just walk', () => {
  const engine = createEngine({
    extraSpeeds: undefined,
    extraSpecies: {
      'sky-elf': {
        id: 'sky-elf', name: 'Sky Elf', size: 'medium', speed: 30,
        effects: { extraSpeeds: { fly: 30, swim: 20 } }
      }
    }
  });
  const sheet = engine.deriveSheet(baseRecord({
    speciesId: 'sky-elf',
    conditions: ['paralyzed']
  }));
  assert.equal(sheet.speed.walk, 0);
  assert.equal(sheet.speed.fly, 0);
  assert.equal(sheet.speed.swim, 0);
});

test('exhaustion subtracts 5 ft per level from every movement mode', () => {
  const engine = createEngine({
    extraSpecies: {
      'sky-elf': {
        id: 'sky-elf', name: 'Sky Elf', size: 'medium', speed: 30,
        effects: { extraSpeeds: { fly: 30, burrow: 15 } }
      }
    }
  });
  const sheet = engine.deriveSheet(baseRecord({
    speciesId: 'sky-elf',
    exhaustion: 2
  }));
  assert.equal(sheet.speed.walk, 20);
  assert.equal(sheet.speed.fly, 20);
  assert.equal(sheet.speed.burrow, 5);
});

test('blindsight and truesight come through when set on the species effects', () => {
  const engine = createEngine({
    extraSpecies: {
      'mind-seer': {
        id: 'mind-seer', name: 'Mind Seer', size: 'medium', speed: 30,
        effects: { blindsightFt: 30, truesightFt: 10 }
      }
    }
  });
  const sheet = engine.deriveSheet(baseRecord({ speciesId: 'mind-seer' }));
  assert.equal(sheet.senses.blindsight, 30);
  assert.equal(sheet.senses.truesight, 10);
});
