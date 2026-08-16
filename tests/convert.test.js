// Conversion tools (5.2.0 row). What must hold: a snake_case third-
// party stat block imports into a record the ENGINE actually accepts
// (mounted via extraMonsters, attacks resolve through the combat
// math); guesses are REPORTED, not logged; textual CRs normalize;
// spells import and cast; the character-migration seam validates and
// passes through (the ledger is empty by design as of 3.x); and save
// snapshots report unknown fields instead of dropping them.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Convert, Dice } from '../index.js';
import {
  normalizeCr, monsterFromJson, spellFromJson, migrateCharacter, sessionFromJson,
} from '../src/convert.js';

// A typical third-party SRD-JSON stat block: snake_case, textual CR,
// long ability names, actions with damage_dice prose.
const THIRD_PARTY_WOLF = {
  name: 'Gray Hunter',
  slug: 'gray-hunter',
  challenge_rating: '1/4',
  armor_class: 13,
  hit_points: 11,
  size: 'Medium',
  speed: { walk: 40 },
  strength: 12, dexterity: 15, constitution: 12,
  intelligence: 3, wisdom: 12, charisma: 6,
  actions: [
    { name: 'Bite', attack_bonus: 4, damage_dice: '2d4 + 2', damage_type: 'Piercing' },
    { name: 'Pack Howl', desc: 'No attack roll — skipped, and the report says so.' },
  ],
};

test('CR normalization covers the textual family', () => {
  assert.equal(normalizeCr('1/8'), 0.125);
  assert.equal(normalizeCr('1/4'), 0.25);
  assert.equal(normalizeCr('1/2'), 0.5);
  assert.equal(normalizeCr('3'), 3);
  assert.equal(normalizeCr(5), 5);
  assert.equal(normalizeCr('boss'), null);
});

test('a third-party stat block imports, mounts, and FIGHTS', () => {
  const { record, warnings } = monsterFromJson(THIRD_PARTY_WOLF);
  assert.equal(record.id, 'gray-hunter');
  assert.equal(record.cr, 0.25);
  assert.equal(record.ac, 13);
  assert.equal(record.speed, 40);
  assert.deepEqual(record.abilityScores, { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 });
  assert.deepEqual(record.attacks, [
    { name: 'Bite', attackBonus: 4, damage: '2d4+2', damageType: 'piercing' },
  ]);
  // The guess report names the skipped action; clean fields stay silent.
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /'Pack Howl' skipped/);
  // The imported record passes the engine's registry validation and
  // its attack resolves through the real combat math.
  const engine = createEngine({ rng: Dice.seededRng(5), extraMonsters: { [record.id]: record } });
  assert.ok(engine.monsters['gray-hunter']);
  const roll = engine.Combat.attackRoll({ attackBonus: record.attacks[0].attackBonus, ac: 15 });
  assert.ok(typeof roll.hit === 'boolean');
  assert.ok(engine.Dice.parse(record.attacks[0].damage));
  // Sparse input degrades with named defaults, not throws.
  const sparse = monsterFromJson({ name: 'Fog Shape' });
  assert.equal(sparse.record.hp, 1);
  assert.ok(sparse.warnings.some((w) => /no hit points/.test(w)));
  assert.equal(monsterFromJson({}).record, null);
});

test('a third-party spell imports and casts through the engine', () => {
  const { record, warnings } = spellFromJson({
    name: 'Winter Lance', level: '3rd-level', school: { name: 'Evocation' },
    damage_dice: '6d8', dc_type: { name: 'Constitution' }, concentration: 'yes',
    range: '90 feet', duration: '1 minute',
  });
  assert.deepEqual(warnings, []);
  assert.equal(record.id, 'winter-lance');
  assert.equal(record.level, 3);
  assert.equal(record.school, 'evocation');
  assert.equal(record.damage, '6d8');
  assert.equal(record.save, 'con');
  assert.equal(record.concentration, true);
  const engine = createEngine({ extraSpells: { [record.id]: record } });
  const caster = { classId: 'wizard', spellSlots: engine.Spellcasting.freshSlots('full', 5) };
  const cast = engine.Spellcasting.castSpell(caster, engine.spells['winter-lance']);
  assert.equal(cast.ok, true, 'the import is castable, not just storable');
  // Cantrip strings parse to level 0.
  assert.equal(spellFromJson({ name: 'Chill Spark', level: 'Cantrip', school: 'evocation' }).record.level, 0);
});

test('the character-migration seam: empty ledger by design, identity gated', () => {
  const clean = migrateCharacter({ id: 'pc', speciesId: 'human', classId: 'fighter' });
  assert.deepEqual(clean.changes, [], 'no breaking record change has shipped as of 3.x');
  assert.deepEqual(clean.errors, []);
  assert.equal(clean.record.id, 'pc');
  const broken = migrateCharacter({ classId: 'fighter' });
  assert.equal(broken.record, null);
  assert.deepEqual(broken.errors, ['missing id', 'missing speciesId']);
});

test('save snapshots report unknown fields instead of dropping them', () => {
  const { snapshot, warnings } = sessionFromJson({
    id: 's-1', campaign: 'fen', party: [], futureField: { x: 1 },
  });
  assert.equal(snapshot.futureField.x, 1, 'preserved');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unknown field 'futureField'/);
  // The namespace export mirrors the module surface.
  assert.equal(Convert.monsterFromJson, monsterFromJson);
  assert.equal(Convert.normalizeCr, normalizeCr);
});
