// === 1.20.0 tier 4 class features + Epic Boons (L17-L20) ===

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';
import { attacksPerAction } from '../src/encounter.js';

test('every base class lists features through L20', () => {
  const engine = createEngine();
  for (const id of Object.keys(engine.classes)) {
    const classDef = engine.classes[id];
    for (let level = 17; level <= 20; level++) {
      assert.ok(
        Array.isArray(classDef.features?.[level]),
        `${id}.features[${level}] missing`
      );
    }
  }
});

test('every base class lists Epic Boon at L19', () => {
  const engine = createEngine();
  for (const id of Object.keys(engine.classes)) {
    const classDef = engine.classes[id];
    assert.ok(
      classDef.features[19].some((f) => f.includes('Epic Boon')),
      `${id} missing Epic Boon at L19`
    );
  }
});

test('Fighter attacksPerAction at L20 is 4 (three extras)', () => {
  const engine = createEngine();
  const fighter = engine.classes.fighter;
  assert.equal(attacksPerAction(fighter, 20), 4);
  assert.equal(attacksPerAction(fighter, 19), 3);
});

test('Fighter L20 capstone is Three Extra Attacks', () => {
  const engine = createEngine();
  const fighter = engine.classes.fighter;
  assert.ok(fighter.features[20].includes('Three Extra Attacks'));
});

test('Barbarian L20 capstone is Primal Champion', () => {
  const engine = createEngine();
  assert.ok(engine.classes.barbarian.features[20].includes('Primal Champion'));
});

test('Warlock L18 carries Mystic Arcanum (9th level)', () => {
  const engine = createEngine();
  assert.ok(engine.classes.warlock.features[18].some((f) => f.includes('9th')));
});

test('Cleric L20 is Greater Divine Intervention', () => {
  const engine = createEngine();
  assert.ok(engine.classes.cleric.features[20].includes('Greater Divine Intervention'));
});

test('Wizard L20 is Signature Spells', () => {
  const engine = createEngine();
  assert.ok(engine.classes.wizard.features[20].includes('Signature Spells'));
});

test('Bard L20 is Words of Creation', () => {
  const engine = createEngine();
  assert.ok(engine.classes.bard.features[20].includes('Words of Creation'));
});

test('Epic Boon feats live in the feats registry with category epic-boon', () => {
  const engine = createEngine();
  const boonCount = Object.values(engine.feats).filter((f) => f.category === 'epic-boon').length;
  assert.ok(boonCount >= 10, `expected at least 10 Epic Boons, got ${boonCount}`);
});

test('Boon of Truesight grants truesightFt: 60', () => {
  const engine = createEngine();
  const boon = engine.feats['boon-of-truesight'];
  assert.equal(boon.grants.truesightFt, 60);
});

test('Boon of Fortitude grants 40 HP and on-turn-start regen', () => {
  const engine = createEngine();
  const boon = engine.feats['boon-of-fortitude'];
  assert.equal(boon.grants.hpMaxBonus, 40);
  assert.equal(boon.grants.regen5OnTurnStart, true);
});

test('Boon of Skill grants all-skill proficiency', () => {
  const engine = createEngine();
  const boon = engine.feats['boon-of-skill'];
  assert.equal(boon.grants.allSkillsProficient, true);
});
