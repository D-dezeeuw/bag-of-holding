// === 1.29.0 spellcasting + saves + feats wins ===
//
// hasComponents, castFromScroll, applyEvasion, magicResistanceDcFor,
// applySculptSpells, featGrants on deriveSheet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';
import { hasComponents, castFromScroll, applyEvasion, magicResistanceDcFor, applySculptSpells } from '../src/spellcasting.js';

const focusSpell = {
  id: 'fireball', name: 'Fireball', level: 3, school: 'evocation',
  components: { v: true, s: true, m: { cost: false, consumed: false } }
};

const cantrip = {
  id: 'fire-bolt', name: 'Fire Bolt', level: 0, school: 'evocation',
  components: { v: true, s: true }
};

test('hasComponents: V blocked when silenced', () => {
  const r = hasComponents({ silenced: true, componentPouch: true }, focusSpell);
  assert.equal(r.ok, false);
  assert.equal(r.missing, 'verbal');
});

test('hasComponents: S blocked when somaticBlocked', () => {
  const r = hasComponents({ somaticBlocked: true, componentPouch: true }, focusSpell);
  assert.equal(r.ok, false);
  assert.equal(r.missing, 'somatic');
});

test('hasComponents: M with no cost requires pouch or focus', () => {
  const r = hasComponents({}, focusSpell);
  assert.equal(r.ok, false);
  assert.equal(r.missing, 'pouch-or-focus');
});

test('hasComponents: pouch satisfies M-without-cost', () => {
  const r = hasComponents({ componentPouch: true }, focusSpell);
  assert.equal(r.ok, true);
});

test('hasComponents: focus satisfies M-without-cost', () => {
  const r = hasComponents({ spellcastingFocus: 'arcane-orb' }, focusSpell);
  assert.equal(r.ok, true);
});

test('hasComponents: M with cost requires materials[spell.id]', () => {
  const costSpell = { id: 'revivify', level: 3, components: { v: true, s: true, m: { cost: 300 } } };
  const r1 = hasComponents({ componentPouch: true }, costSpell);
  assert.equal(r1.ok, false);
  assert.equal(r1.missing, 'material:revivify');
  const r2 = hasComponents({ materials: { revivify: true } }, costSpell);
  assert.equal(r2.ok, true);
});

test('hasComponents: cantrip with no M passes without pouch/focus', () => {
  const r = hasComponents({}, cantrip);
  assert.equal(r.ok, true);
});

test('hasComponents: missing spell record returns ok', () => {
  assert.equal(hasComponents({}, undefined).ok, true);
});

test('castFromScroll: succeeds for a class-list spell at L0/L1', () => {
  const actor = { abilityScores: { int: 16 }, maxCastableLevel: 1 };
  const r = castFromScroll(actor, cantrip);
  assert.equal(r.ok, true);
  assert.equal(r.scrollConsumed, true);
});

test('castFromScroll: higher-level spell triggers an ability check', () => {
  const actor = { abilityScores: { int: 14 }, maxCastableLevel: 2 };
  const lowRoll = () => 0.01;
  const r = castFromScroll(actor, focusSpell, { ability: 'int' }, lowRoll);
  assert.equal(r.ok, false);
  assert.equal(r.scrollConsumed, true);
  assert.equal(r.check.success, false);
  assert.equal(r.check.dc, 13); // 10 + spell level 3
});

test('castFromScroll: high roll passes the higher-level check', () => {
  const actor = { abilityScores: { int: 20 }, maxCastableLevel: 2 };
  const highRoll = () => 0.99;
  const r = castFromScroll(actor, focusSpell, { ability: 'int' }, highRoll);
  assert.equal(r.ok, true);
  assert.equal(r.check.success, true);
});

test('castFromScroll: no check when caster can already cast that level', () => {
  const actor = { abilityScores: { int: 14 }, maxCastableLevel: 5 };
  const r = castFromScroll(actor, focusSpell);
  assert.equal(r.check, null);
  assert.equal(r.ok, true);
});

test('castFromScroll: rejects malformed spell record', () => {
  const r = castFromScroll({}, null);
  assert.equal(r.ok, false);
  assert.equal(r.scrollConsumed, false);
});

test('castFromScroll: not-on-class-list still casts (host opted in via onClassList=false)', () => {
  const actor = { abilityScores: { int: 10 }, maxCastableLevel: 0 };
  const r = castFromScroll(actor, focusSpell, { onClassList: false });
  assert.equal(r.ok, true);
});

test('castFromScroll: uses default INT-mod ability score when none supplied', () => {
  const actor = { abilityScores: { int: 18 }, maxCastableLevel: 0 };
  const lowRoll = () => 0.5;
  const r = castFromScroll(actor, focusSpell, {}, lowRoll);
  assert.equal(typeof r.check.success, 'boolean');
});

test('castFromScroll: actor with no spellcasting ability falls back to 10', () => {
  const r = castFromScroll({}, focusSpell, {}, () => 0.5);
  assert.equal(typeof r.check.dc, 'number');
});

test('engine.Spellcasting.castFromScroll honours an onCast cancel hook', () => {
  const engine = createEngine({
    hooks: {
      onCast: () => ({ cancelled: true, reason: 'counterspell from scroll' })
    }
  });
  const r = engine.Spellcasting.castFromScroll({ maxCastableLevel: 5 }, focusSpell);
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true);
});

test('engine.Spellcasting.castFromScroll routes through the seeded rng', () => {
  const a = createEngine({ rng: Dice.seededRng(11) });
  const b = createEngine({ rng: Dice.seededRng(11) });
  const r1 = a.Spellcasting.castFromScroll({ maxCastableLevel: 0 }, focusSpell);
  const r2 = b.Spellcasting.castFromScroll({ maxCastableLevel: 0 }, focusSpell);
  assert.deepEqual(r1.check, r2.check);
});

test('applyEvasion: success → no damage for evasion targets', () => {
  const results = [
    { targetId: 'a', saved: true, appliedDamage: 8, damage: 16 },
    { targetId: 'b', saved: true, appliedDamage: 8, damage: 16 }
  ];
  const out = applyEvasion(results, {
    a: { evasion: true },
    b: {}
  });
  assert.equal(out[0].appliedDamage, 0);
  assert.equal(out[0].evasion, true);
  assert.equal(out[1].appliedDamage, 8);
});

test('applyEvasion: failed save → half damage for evasion targets', () => {
  const results = [
    { targetId: 'a', saved: false, appliedDamage: 16, damage: 16 }
  ];
  const out = applyEvasion(results, { a: { evasion: true } });
  assert.equal(out[0].appliedDamage, 8);
});

test('applyEvasion: missing targetsById leaves results unchanged', () => {
  const results = [{ targetId: 'a', saved: true, appliedDamage: 5, damage: 10 }];
  const out = applyEvasion(results, undefined);
  assert.equal(out[0].appliedDamage, 5);
});

test('applyEvasion: throws on non-array input', () => {
  assert.throws(() => applyEvasion('x', {}), /must be an array/);
});

test('magicResistanceDcFor: lowers DC by 5 for resistant targets', () => {
  assert.equal(magicResistanceDcFor({ magicResistance: true }, 15), 10);
  assert.equal(magicResistanceDcFor({ magicResistance: false }, 15), 15);
  assert.equal(magicResistanceDcFor(null, 15), 15);
});

test('magicResistanceDcFor: floors at 0', () => {
  assert.equal(magicResistanceDcFor({ magicResistance: true }, 3), 0);
});

test('applySculptSpells: protects 1 + spellLevel chosen targets', () => {
  const results = [
    { targetId: 'a', saved: false, appliedDamage: 30, damage: 30 },
    { targetId: 'b', saved: false, appliedDamage: 30, damage: 30 },
    { targetId: 'c', saved: false, appliedDamage: 30, damage: 30 },
    { targetId: 'd', saved: false, appliedDamage: 30, damage: 30 }
  ];
  const out = applySculptSpells(results, { spellLevel: 3, chosenIds: ['a', 'b', 'c', 'd'] });
  // 1 + 3 = 4 max, all four protected
  assert.equal(out.filter((r) => r.sculpted).length, 4);
  for (const r of out.filter((r) => r.sculpted)) {
    assert.equal(r.appliedDamage, 0);
    assert.equal(r.saved, true);
  }
});

test('applySculptSpells: caps protection at 1 + spell level', () => {
  const results = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
    targetId: id, saved: false, appliedDamage: 20, damage: 20
  }));
  const out = applySculptSpells(results, { spellLevel: 1, chosenIds: ['a', 'b', 'c', 'd', 'e'] });
  // 1 + 1 = 2 protected
  assert.equal(out.filter((r) => r.sculpted).length, 2);
});

test('applySculptSpells: throws on non-array input', () => {
  assert.throws(() => applySculptSpells(undefined, {}), /must be an array/);
});

test('applySculptSpells: default spellLevel=0 still protects 1 target', () => {
  const results = [{ targetId: 'a', saved: false, appliedDamage: 10, damage: 10 }];
  const out = applySculptSpells(results, { chosenIds: ['a'] });
  assert.equal(out[0].sculpted, true);
});

test('applySculptSpells: empty chosenIds protects nobody', () => {
  const results = [{ targetId: 'a', saved: false, appliedDamage: 10, damage: 10 }];
  const out = applySculptSpells(results, { spellLevel: 3 });
  assert.equal(out[0].sculpted, undefined);
});

test('deriveSheet: featGrants surfaces origin-feat grants by id', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC', speciesId: 'human', backgroundId: 'soldier',
    classId: 'fighter', level: 1,
    abilityScores: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: [] }
  });
  assert.ok(sheet.featGrants['savage-attacker']);
  assert.equal(sheet.featGrants['savage-attacker'].rerollWeaponDamageOncePerTurn, true);
});

test('deriveSheet: variant feats keyed as <featId>_<variant>', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC', speciesId: 'elf', backgroundId: 'sage',
    classId: 'wizard', level: 1,
    abilityScores: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
    equipment: { weaponIds: [] }
  });
  assert.ok(sheet.featGrants['magic-initiate_wizard']);
  assert.equal(sheet.featGrants['magic-initiate_wizard'].cantripsKnown, 2);
});

test('Character.deriveSheet tolerates a registries view without `feats`', async () => {
  const engine = createEngine();
  const record = {
    id: 'pc', name: 'PC', speciesId: 'human', backgroundId: 'soldier',
    classId: 'fighter', level: 1,
    abilityScores: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    equipment: { weaponIds: [] }
  };
  const minimalRegistries = {
    species: engine.species,
    classes: engine.classes,
    backgrounds: engine.backgrounds,
    items: engine.items,
    XP: engine.XP
    // intentionally no `feats`
  };
  const { Character } = await import('../index.js');
  const sheet = Character.deriveSheet(record, minimalRegistries);
  assert.deepEqual(sheet.featGrants, {});
});

test('deriveSheet: feats without a `grants` block are skipped', () => {
  const engine = createEngine({
    extraFeats: {
      'mystery-feat': { id: 'mystery-feat', name: 'Mystery Feat', category: 'general' }
    }
  });
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC', speciesId: 'human', backgroundId: 'soldier',
    classId: 'fighter', level: 4,
    abilityScores: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    feats: [{ id: 'mystery-feat' }],
    equipment: { weaponIds: [] }
  });
  assert.equal(sheet.featGrants['mystery-feat'], undefined);
});

test('applyEvasion: failed save without explicit damage falls back to appliedDamage * 2', () => {
  const results = [{ targetId: 'a', saved: false, appliedDamage: 8 }];
  const out = applyEvasion(results, { a: { evasion: true } });
  // damage=undefined → falls back to appliedDamage*2 = 16 → half = 8
  assert.equal(out[0].appliedDamage, 8);
});

test('deriveSheet: extra feats on the record merge into featGrants', () => {
  const engine = createEngine();
  const sheet = engine.deriveSheet({
    id: 'pc', name: 'PC', speciesId: 'human', backgroundId: 'soldier',
    classId: 'fighter', level: 4,
    abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    feats: [{ id: 'tough' }],
    equipment: { weaponIds: [] }
  });
  assert.ok(sheet.featGrants['tough']);
  assert.equal(sheet.featGrants['tough'].hpPerLevelBonus, 2);
});
