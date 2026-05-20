// === 1.21.0 subclass handler maps ===
//
// Every base class ships one registered subclass with a feature
// progression through tier 3/4 and an actionable mechanics map. The
// engine's mechanic dispatcher consults the subclass map first when
// the actor carries a `subclassId`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';

test('every base class ships at least one subclass with features and mechanics', () => {
  const engine = createEngine();
  for (const id of Object.keys(engine.classes)) {
    const classDef = engine.classes[id];
    const subclasses = classDef.subclasses ?? {};
    const keys = Object.keys(subclasses);
    assert.ok(keys.length > 0, `${id} has no subclasses`);
    const first = subclasses[keys[0]];
    assert.ok(first.features, `${id}.${keys[0]} missing features`);
    assert.ok(first.mechanics, `${id}.${keys[0]} missing mechanics`);
  }
});

test('Champion subclass mechanic returns crit-19-20 at L3 and crit-18-20 at L15', () => {
  const engine = createEngine();
  const actor = { classId: 'fighter', subclassId: 'champion' };
  assert.deepEqual(engine.Mechanics.apply(actor, 'improvedCritOn', { level: 3 }),  { critOn: [19, 20] });
  assert.deepEqual(engine.Mechanics.apply(actor, 'improvedCritOn', { level: 15 }), { critOn: [18, 19, 20] });
});

test('Berserker frenzy grants a bonus attack flag', () => {
  const engine = createEngine();
  const actor = { classId: 'barbarian', subclassId: 'berserker' };
  const r = engine.Mechanics.apply(actor, 'frenzy');
  assert.equal(r.bonusAttackThisTurn, true);
});

test('Berserker mindlessRageImmunities returns charm + fright immunity', () => {
  const engine = createEngine();
  const actor = { classId: 'barbarian', subclassId: 'berserker' };
  const r = engine.Mechanics.apply(actor, 'mindlessRageImmunities');
  assert.deepEqual(r.immune, ['charmed', 'frightened']);
});

test('College of Lore cuttingWords returns the inspiration die size', () => {
  const engine = createEngine();
  const actor = { classId: 'bard', subclassId: 'college-of-lore' };
  const r = engine.Mechanics.apply(actor, 'cuttingWords', { inspirationDie: 8 });
  assert.equal(r.dieSize, 8);
});

test('Life Domain discipleOfLife returns 2 + spellLevel bonus healing', () => {
  const engine = createEngine();
  const actor = { classId: 'cleric', subclassId: 'life-domain' };
  assert.equal(engine.Mechanics.apply(actor, 'discipleOfLife', { spellLevel: 1 }).bonusHealing, 3);
  assert.equal(engine.Mechanics.apply(actor, 'discipleOfLife', { spellLevel: 5 }).bonusHealing, 7);
});

test('Circle of the Land landsAid scales healing with WIS mod', () => {
  const engine = createEngine();
  const actor = { classId: 'druid', subclassId: 'circle-of-the-land', abilityScores: { wis: 18 } };
  const r = engine.Mechanics.apply(actor, 'landsAid', { slotLevel: 3 });
  assert.equal(r.healing, 7); // 3 + 4 (wis +4)
});

test('Open Hand monk dispatches the chosen rider', () => {
  const engine = createEngine();
  const actor = { classId: 'monk', subclassId: 'open-hand' };
  const r = engine.Mechanics.apply(actor, 'openHandTechnique', { choice: 'push' });
  assert.equal(r.rider, 'push');
});

test('Open Hand monk defaults to prone when no choice supplied', () => {
  const engine = createEngine();
  const actor = { classId: 'monk', subclassId: 'open-hand' };
  const r = engine.Mechanics.apply(actor, 'openHandTechnique');
  assert.equal(r.rider, 'prone');
});

test('Oath of Devotion sacredWeapon returns CHA-mod attack bonus', () => {
  const engine = createEngine();
  const actor = { classId: 'paladin', subclassId: 'oath-of-devotion', abilityScores: { cha: 18 } };
  const r = engine.Mechanics.apply(actor, 'sacredWeapon');
  assert.equal(r.attackBonus, 4);
  assert.equal(r.durationMinutes, 10);
});

test('Oath of Devotion sacredWeapon floor is +1 even with low CHA', () => {
  const engine = createEngine();
  const actor = { classId: 'paladin', subclassId: 'oath-of-devotion', abilityScores: { cha: 8 } };
  const r = engine.Mechanics.apply(actor, 'sacredWeapon');
  assert.equal(r.attackBonus, 1);
});

test('Hunter\'s Prey: marked target enables 1d8 bonus damage', () => {
  const engine = createEngine();
  const actor = { classId: 'ranger', subclassId: 'hunter' };
  const r = engine.Mechanics.apply(actor, 'huntersPrey', { targetMarked: true });
  assert.equal(r.ok, true);
  assert.equal(r.bonusDamageDice, '1d8');
});

test('Hunter\'s Prey refuses when target unmarked', () => {
  const engine = createEngine();
  const actor = { classId: 'ranger', subclassId: 'hunter' };
  const r = engine.Mechanics.apply(actor, 'huntersPrey', { targetMarked: false });
  assert.equal(r.ok, false);
});

test('Thief fastHands dispatches the chosen bonus action', () => {
  const engine = createEngine();
  const actor = { classId: 'rogue', subclassId: 'thief' };
  const r = engine.Mechanics.apply(actor, 'fastHands', { action: 'use-thieves-tools' });
  assert.equal(r.bonusActionUsed, 'use-thieves-tools');
});

test('Draconic Sorcery elementalAffinity grants CHA-mod bonus to matched damage type', () => {
  const engine = createEngine();
  const actor = {
    classId: 'sorcerer', subclassId: 'draconic-sorcery',
    abilityScores: { cha: 16 }, draconicAncestryType: 'fire'
  };
  assert.equal(engine.Mechanics.apply(actor, 'elementalAffinity', { spellDamageType: 'fire' }).bonus, 3);
  assert.equal(engine.Mechanics.apply(actor, 'elementalAffinity', { spellDamageType: 'cold' }).applies, false);
});

test('Draconic Sorcery falls back to ancestryType arg when actor.draconicAncestryType is absent', () => {
  const engine = createEngine();
  const actor = {
    classId: 'sorcerer', subclassId: 'draconic-sorcery',
    abilityScores: { cha: 14 }
  };
  const r = engine.Mechanics.apply(actor, 'elementalAffinity', { spellDamageType: 'fire', ancestryType: 'fire' });
  assert.equal(r.applies, true);
});

test('Fiend Patron darkOnesBlessing grants tempHp = CHA + level', () => {
  const engine = createEngine();
  const actor = { classId: 'warlock', subclassId: 'fiend-patron', level: 5, abilityScores: { cha: 16 } };
  const r = engine.Mechanics.apply(actor, 'darkOnesBlessing');
  assert.equal(r.tempHp, 8); // +3 cha + 5 level
});

test('Evoker sculptSpells protects 1 + spellLevel allies', () => {
  const engine = createEngine();
  const actor = { classId: 'wizard', subclassId: 'evoker' };
  assert.equal(engine.Mechanics.apply(actor, 'sculptSpells', { spellLevel: 3 }).protectedCount, 4);
});

test('Subclass mechanic falls back to class-level when actor lacks subclassId', () => {
  const engine = createEngine();
  const actor = { classId: 'rogue' };
  // sneakAttack is a class-level mechanic; should resolve fine.
  const r = engine.Mechanics.apply(actor, 'sneakAttack', { attackHadAdvantage: true, weaponFinesse: true });
  assert.ok(typeof r.triggers === 'boolean');
});

test('Engine throws on unknown subclass mechanic id', () => {
  const engine = createEngine();
  const actor = { classId: 'fighter', subclassId: 'champion' };
  assert.throws(() => engine.Mechanics.apply(actor, 'noSuchThing'), /Unknown class mechanic/);
});

test('Draconic Sorcery falls back to CHA 10 with no abilityScores on the actor', () => {
  const engine = createEngine();
  const actor = { classId: 'sorcerer', subclassId: 'draconic-sorcery' };
  const r = engine.Mechanics.apply(actor, 'elementalAffinity', { spellDamageType: 'fire' });
  assert.equal(r.applies, true);
  assert.equal(r.bonus, 0);
});

test('Subclass mechanic argument defaults: each falls back when args omitted', () => {
  const engine = createEngine();
  // cuttingWords default die size
  assert.equal(engine.Mechanics.apply({ classId: 'bard', subclassId: 'college-of-lore' }, 'cuttingWords').dieSize, 6);
  // discipleOfLife default spell level
  assert.equal(engine.Mechanics.apply({ classId: 'cleric', subclassId: 'life-domain' }, 'discipleOfLife').bonusHealing, 3);
  // landsAid default slot level + missing wis
  const r = engine.Mechanics.apply({ classId: 'druid', subclassId: 'circle-of-the-land' }, 'landsAid');
  assert.equal(r.healing, 1); // 1 + 0
  // sculptSpells default spell level
  assert.equal(engine.Mechanics.apply({ classId: 'wizard', subclassId: 'evoker' }, 'sculptSpells').protectedCount, 2);
  // improvedCritOn default level
  assert.deepEqual(engine.Mechanics.apply({ classId: 'fighter', subclassId: 'champion' }, 'improvedCritOn').critOn, [19, 20]);
  // sacredWeapon falls back to CHA 10 without abilityScores
  const sw = engine.Mechanics.apply({ classId: 'paladin', subclassId: 'oath-of-devotion' }, 'sacredWeapon');
  assert.equal(sw.attackBonus, 1);
  // fastHands default action
  assert.equal(engine.Mechanics.apply({ classId: 'rogue', subclassId: 'thief' }, 'fastHands').bonusActionUsed, 'use-object');
  // darkOnesBlessing CHA + level defaults
  const dob = engine.Mechanics.apply({ classId: 'warlock', subclassId: 'fiend-patron' }, 'darkOnesBlessing');
  assert.equal(dob.tempHp, 1); // 0 cha mod + 1 (default level) = 1
  // elementalAffinity defaults: no spellDamageType, no ancestry
  const ea = engine.Mechanics.apply(
    { classId: 'sorcerer', subclassId: 'draconic-sorcery', abilityScores: { cha: 10 } },
    'elementalAffinity'
  );
  assert.equal(ea.applies, false);
});
