import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import defaultEngine, { Combat, Conditions, SRD, createEngine as createEngineFromIndex } from '../index.js';

// === Default singleton ===

test('createEngine with no opts returns SRD 5.2 defaults', () => {
  const e = createEngine();
  assert.ok(e.species.elf,       'elf should be present');
  assert.ok(e.species.dragonborn, 'dragonborn should be present');
  assert.equal(e.backgrounds.acolyte.originFeat.id, 'magic-initiate');
});

test('default export is a createEngine() instance with the same shape', () => {
  // The named exports spread from the default singleton, so they
  // must point at the same object identity as the default's fields.
  assert.equal(Combat, defaultEngine.Combat);
  assert.equal(Conditions, defaultEngine.Conditions);
  assert.equal(SRD.species, defaultEngine.species);
});

test('createEngine is re-exported from the package entry point', () => {
  assert.equal(createEngineFromIndex, createEngine);
});

// === Content extension: each registry independently ===

test('extraSpecies merges with SRD defaults, last-write-wins on collision', () => {
  const e = createEngine({
    extraSpecies: {
      'half-elf': { id: 'half-elf', name: 'Half-Elf', size: 'medium', speed: 30, traits: ['Adaptable'] },
      // Override — should win over the SRD elf entry.
      'elf':      { id: 'elf',      name: 'High Elf', size: 'medium', speed: 30, traits: ['Custom'] }
    }
  });
  assert.equal(e.species['half-elf'].name, 'Half-Elf');
  assert.equal(e.species.elf.name, 'High Elf');
});

test('extraClasses, extraBackgrounds, extraFeats, extraSpells, extraItems each merge in', () => {
  const e = createEngine({
    extraClasses:     { 'artificer': { id: 'artificer', name: 'Artificer', hitDie: 8 } },
    extraBackgrounds: { 'guild-artisan': { id: 'guild-artisan', name: 'Guild Artisan', abilityScores: ['str', 'con', 'wis'], skillProficiencies: ['insight', 'persuasion'], originFeat: { id: 'tough' } } },
    extraFeats:       { 'tough': { id: 'tough', name: 'Tough', category: 'origin' } },
    extraSpells:      { 'eldritch-blast': { id: 'eldritch-blast', name: 'Eldritch Blast', level: 0, school: 'evocation' } },
    extraItems:       { 'rapier-of-fire': { id: 'rapier-of-fire', name: 'Rapier of Fire', type: 'weapon', mastery: 'vex' } }
  });
  assert.ok(e.classes.artificer);
  assert.ok(e.backgrounds['guild-artisan']);
  assert.ok(e.feats.tough);
  assert.ok(e.spells['eldritch-blast']);
  assert.ok(e.items['rapier-of-fire']);

  // Defaults are still there.
  assert.ok(e.classes.fighter);
  assert.ok(e.backgrounds.acolyte);
});

// === Conditions extension ===

test('extraConditions extend the boolean condition vocabulary', () => {
  const e = createEngine({ extraConditions: ['cursed', 'marked'] });
  assert.ok(e.Conditions.CONDITIONS.includes('cursed'));
  assert.ok(e.Conditions.CONDITIONS.includes('marked'));
  assert.ok(e.Conditions.CONDITIONS.includes('prone'));      // SRD still present

  const actor = e.Conditions.apply({ id: 'pc' }, 'cursed');
  assert.deepEqual(actor.conditions, ['cursed']);
});

test('extraConditions apply works through the bound Conditions namespace, not the global', () => {
  const e = createEngine({ extraConditions: ['cursed'] });
  // Same condition name should be rejected by the default-singleton's
  // Conditions.apply because that singleton wasn't built with the
  // extra — engines are scoped, the global isn't contaminated.
  assert.throws(() => Conditions.apply({}, 'cursed'));
  assert.doesNotThrow(() => e.Conditions.apply({}, 'cursed'));
});

test('extraConditions rejects a non-array', () => {
  assert.throws(() => createEngine({ extraConditions: 'cursed' }), /must be an array/);
});

test('extraConditions rejects non-string and empty-string entries', () => {
  assert.throws(() => createEngine({ extraConditions: [123] }), /non-empty strings/);
  assert.throws(() => createEngine({ extraConditions: [''] }),  /non-empty strings/);
});

test('extraConditions deduplicates collisions with SRD defaults', () => {
  // Listing an SRD-canon condition shouldn't double it.
  const e = createEngine({ extraConditions: ['prone'] });
  const count = e.Conditions.CONDITIONS.filter(c => c === 'prone').length;
  assert.equal(count, 1);
});

// === Mastery extension ===

test('extraMastery contributes a new weapon mastery property', () => {
  // A "pin" mastery: on a hit, the target is grappled until the
  // start of the attacker's next turn. Pure rider object, no I/O.
  const e = createEngine({
    extraMastery: {
      pin: (_w, _t, result) =>
        result?.hit ? { kind: 'pin', condition: 'grappled', duration: '1 turn' } : { kind: 'none' }
    }
  });

  assert.ok(e.Combat.MASTERY_PROPERTIES.includes('pin'));

  const hit = { hit: true, attackBonus: 3 };
  const rider = e.Combat.applyMastery({ mastery: 'pin' }, {}, hit);
  assert.equal(rider.kind, 'pin');
  assert.equal(rider.condition, 'grappled');
});

test('extraMastery may override an SRD mastery handler', () => {
  // Replace topple with a fixed-DC variant.
  const e = createEngine({
    extraMastery: {
      topple: (_w, _t, result) =>
        result?.hit ? { kind: 'topple', saveDC: 15, ability: 'con', onFail: 'prone' } : { kind: 'none' }
    }
  });
  const rider = e.Combat.applyMastery({ mastery: 'topple' }, {}, { hit: true, attackBonus: 99 });
  assert.equal(rider.saveDC, 15);                            // fixed, not 8 + 99 + 0
});

test('extraMastery rejects a non-function handler', () => {
  assert.throws(
    () => createEngine({ extraMastery: { pin: 'not-a-function' } }),
    /must be a function/
  );
});

test('default engine Combat does not see plugin masteries from another engine', () => {
  createEngine({ extraMastery: { pin: () => ({ kind: 'pin' }) } });
  // Default singleton remains unmodified.
  assert.equal(Combat.MASTERY_PROPERTIES.includes('pin'), false);
  assert.throws(() => Combat.applyMastery({ mastery: 'pin' }, {}, { hit: true }));
});

// === Validation of registry contributions ===

test('createEngine throws when a species contribution is missing a required field', () => {
  assert.throws(
    () => createEngine({ extraSpecies: { 'broken': { id: 'broken' } } }),    // missing name/size/speed
    /species\.broken missing required field/
  );
});

test('createEngine throws when traits is not an array', () => {
  assert.throws(
    () => createEngine({
      extraSpecies: {
        'broken': { id: 'broken', name: 'Broken', size: 'medium', speed: 30, traits: 'not-an-array' }
      }
    }),
    /traits must be an array/
  );
});

test('createEngine throws when a contribution is not an object', () => {
  assert.throws(
    () => createEngine({ extraSpecies: { 'broken': null } }),
    /must be an object/
  );
});

test('createEngine throws for backgrounds missing originFeat', () => {
  assert.throws(
    () => createEngine({
      extraBackgrounds: {
        'broken': { id: 'broken', name: 'Broken', abilityScores: ['str'], skillProficiencies: ['athletics'] }
      }
    }),
    /backgrounds\.broken missing required field: originFeat/
  );
});

// === Isolation between engines ===

test('two engines created from the same factory have independent registries', () => {
  const a = createEngine({ extraSpecies: { 'a-only': { id: 'a-only', name: 'A', size: 'medium', speed: 30 } } });
  const b = createEngine({ extraSpecies: { 'b-only': { id: 'b-only', name: 'B', size: 'medium', speed: 30 } } });
  assert.ok(a.species['a-only']);
  assert.ok(b.species['b-only']);
  assert.equal(a.species['b-only'], undefined);
  assert.equal(b.species['a-only'], undefined);
});

test('shared SRD records appear in both engines (same identity, just spread)', () => {
  const a = createEngine();
  const b = createEngine();
  // The SRD spell record is the same object — engines spread it,
  // they don't deep-clone.
  assert.equal(a.spells['cure-wounds'], b.spells['cure-wounds']);
});
