// The Origin pack — 5 species, 8 backgrounds, 12 feats. What must hold:
// every species trait mechanic flows through deriveSheet (senses, extra
// speeds, resistances) rather than sitting as inert data; the racial
// cantrip reference resolves to a real spell; every background's skills,
// tool and Origin Feat resolve; and the feat split (6 origin / 4 general
// / 2 epic boons) carries structured grants.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Character, STARTER_PARTY,
  ORIGIN_SPECIES, ORIGIN_BACKGROUNDS, ORIGIN_FEATS,
} from '../index.js';

const engine = createEngine({
  extraSpecies: ORIGIN_SPECIES,
  extraBackgrounds: ORIGIN_BACKGROUNDS,
  extraFeats: ORIGIN_FEATS,
});

test('5 species, 8 backgrounds, 12 feats — the roadmap numbers, all merged', () => {
  assert.equal(Object.keys(ORIGIN_SPECIES).length, 5);
  assert.equal(Object.keys(ORIGIN_BACKGROUNDS).length, 8);
  assert.equal(Object.keys(ORIGIN_FEATS).length, 12);
  for (const id of Object.keys(ORIGIN_SPECIES)) assert.ok(engine.species[id], `${id} merged`);
  for (const id of Object.keys(ORIGIN_BACKGROUNDS)) assert.ok(engine.backgrounds[id], `${id} merged`);
  for (const id of Object.keys(ORIGIN_FEATS)) assert.ok(engine.feats[id], `${id} merged`);
  // The promised category split.
  const byCategory = Object.values(ORIGIN_FEATS).reduce((m, f) => {
    m[f.category] = (m[f.category] ?? 0) + 1; return m;
  }, {});
  assert.deepEqual(byCategory, { origin: 6, general: 4, 'epic-boon': 2 });
});

test('every species exercises a mechanic the sheet deriver consumes', () => {
  // One species per mechanic, per the 1.13 back-fill promise.
  const mechanics = Object.values(ORIGIN_SPECIES).map((s) => s.effects);
  assert.ok(mechanics.some((e) => (e.darkvisionFt ?? 0) >= 120), 'deep darkvision shipped');
  assert.ok(mechanics.some((e) => e.damageResistances?.length), 'resistance shipped');
  assert.ok(mechanics.some((e) => e.extraSpeeds?.swim), 'swim mode shipped');
  assert.ok(mechanics.some((e) => e.extraSpeeds?.climb), 'climb mode shipped');
  assert.ok(mechanics.some((e) => e.extraSpeeds?.fly), 'fly mode shipped');
  // The racial cantrip resolves to a real spell in the merged registry.
  const emberkin = ORIGIN_SPECIES.emberkin;
  assert.ok(engine.spells[emberkin.effects.cantripId], 'racial cantrip id resolves');
  assert.equal(engine.spells[emberkin.effects.cantripId].level, 0, 'and it is a cantrip');

  // Through the sheet: a tidefolk record derives swim speed, darkvision
  // and (for the hollowed) necrotic resistance — the mechanics are LIVE.
  const base = { ...STARTER_PARTY[0], id: 'origin-pc', speciesId: 'tidefolk' };
  const sheet = Character.deriveSheet(base, engine);
  assert.equal(sheet.speed.swim, 30, 'swim speed derived');
  assert.equal(sheet.senses.darkvision, 60, 'darkvision derived');
  const hollowed = Character.deriveSheet({ ...base, speciesId: 'hollowed' }, engine);
  assert.ok(hollowed.damageResistances.includes('necrotic'), 'resistance derived');
  assert.equal(hollowed.senses.darkvision, 120);
});

test('backgrounds: skills, tools and Origin Feats all resolve', () => {
  for (const bg of Object.values(ORIGIN_BACKGROUNDS)) {
    assert.equal(bg.abilityScores.length, 3, `${bg.id} grants three ability bumps`);
    assert.equal(bg.skillProficiencies.length, 2, `${bg.id} grants two skills`);
    for (const skill of bg.skillProficiencies) {
      assert.ok(skill in Character.SKILL_ABILITY, `${bg.id} skill '${skill}' is real`);
    }
    assert.ok(typeof bg.toolProficiency === 'string' && bg.toolProficiency.length > 0);
    assert.ok(engine.feats[bg.originFeat.id], `${bg.id} origin feat '${bg.originFeat.id}' resolves`);
    assert.equal(engine.feats[bg.originFeat.id].category, 'origin',
      `${bg.id} grants an ORIGIN feat, not a general one`);
  }
  // A full character built from pack species + pack background derives.
  const pc = {
    ...STARTER_PARTY[0], id: 'pack-pc',
    speciesId: 'emberkin', backgroundId: 'lantern-keeper',
  };
  const sheet = Character.deriveSheet(pc, engine);
  assert.ok(sheet, 'a character can be built origin-pack all the way down');
});

test('feats carry structured grants; prerequisites follow the SRD shapes', () => {
  for (const feat of Object.values(ORIGIN_FEATS)) {
    assert.ok(feat.grants && Object.keys(feat.grants).length >= 1, `${feat.id} grants something`);
  }
  // Epic boons gate on level 19 like the SRD boons.
  const boons = Object.values(ORIGIN_FEATS).filter((f) => f.category === 'epic-boon');
  for (const boon of boons) assert.equal(boon.prerequisite.levelMin, 19);
  // General feats with ability gates use the same abilityMin shape items use.
  assert.deepEqual(ORIGIN_FEATS['shield-splitter'].prerequisite, { abilityMin: { str: 13 } });
  // advantageOnSkill grants always name a real skill.
  for (const feat of Object.values(ORIGIN_FEATS)) {
    if (feat.grants.advantageOnSkill) {
      assert.ok(feat.grants.advantageOnSkill in Character.SKILL_ABILITY,
        `${feat.id} advantage skill is real`);
    }
  }
});
