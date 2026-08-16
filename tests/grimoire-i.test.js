// Grimoire I — 50 invented spells, cantrips through 5th. What must hold:
// the roadmap's role promises (reaction casts, cylinder/line save-for-half
// AoEs, concentration buffs, single-target debuffs), the 1.8 record
// contract exercised in full (components everywhere, ritual flags, upcast
// deltas — which castSpell has consumed since 1.8 while no shipped record
// carried one), and honest class data on every entry.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, GRIMOIRE_I, CASTER_CLASSES, Spellcasting } from '../index.js';

const engine = createEngine({ extraSpells: GRIMOIRE_I });
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SCHOOLS = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
];

test('50 spells, cantrips through 5th, every record well-formed', () => {
  const all = Object.values(GRIMOIRE_I);
  assert.equal(all.length, 50, 'the roadmap number is the shipped number');
  const byLevel = new Map();
  for (const s of all) {
    byLevel.set(s.level, (byLevel.get(s.level) ?? 0) + 1);
    assert.ok(s.level >= 0 && s.level <= 5, `${s.id} stays in Grimoire I's band`);
    assert.ok(SCHOOLS.includes(s.school), `${s.id} school '${s.school}' is real`);
    assert.ok(s.components && typeof s.components === 'object', `${s.id} declares components`);
    assert.ok(s.range, `${s.id} declares range`);
    assert.ok(s.duration, `${s.id} declares duration`);
    if (s.damage) assert.ok(engine.Dice.parse(s.damage), `${s.id} damage parses`);
    if (s.save) assert.ok(ABILITIES.includes(s.save), `${s.id} save '${s.save}' is an ability`);
    assert.ok(Array.isArray(s.classes) && s.classes.length >= 1, `${s.id} names its classes`);
    for (const c of s.classes) {
      assert.ok(CASTER_CLASSES.includes(c), `${s.id} class '${c}' is a caster class`);
    }
  }
  // The distribution the pack promises: a real list at every band.
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((l) => byLevel.get(l)),
    [10, 10, 8, 8, 7, 7]);
  // Every school appears somewhere — coverage, not a pile of evocations.
  for (const school of SCHOOLS) {
    assert.ok(all.some((s) => s.school === school), `${school} is represented`);
  }
});

test('the thin roles are now thick: reactions, cylinders, lines, buffs, debuffs', () => {
  const all = Object.values(GRIMOIRE_I);
  // Reaction casts beyond shield/counterspell/feather-fall.
  const reactions = all.filter((s) => s.reaction);
  assert.ok(reactions.length >= 3, `reaction options shipped (${reactions.length})`);
  // Save-for-half AoEs in the shapes the SRD selection never used.
  const cylinders = all.filter((s) => s.area?.startsWith('cylinder-'));
  const lines = all.filter((s) => s.area?.startsWith('line-'));
  assert.ok(cylinders.length >= 3, `cylinder AoEs shipped (${cylinders.length})`);
  assert.ok(lines.length >= 2, `line AoEs shipped (${lines.length})`);
  for (const s of [...cylinders, ...lines]) {
    assert.equal(s.halfOnSave, true, `${s.id} is save-for-half`);
    assert.ok(s.damage && s.save, `${s.id} carries the AoE mechanics`);
  }
  // Concentration effects and rituals in numbers.
  assert.ok(all.filter((s) => s.concentration).length >= 12, 'concentration effects shipped');
  assert.ok(all.filter((s) => s.ritual).length >= 4, 'ritual options shipped');
  // Single-target debuffs: a save, concentration, no area.
  const debuffs = all.filter((s) => s.save && s.concentration && !s.area && !s.damage);
  assert.ok(debuffs.length >= 5, `single-target debuffs shipped (${debuffs.length})`);
});

test('upcast deltas: the 1.8 contract finally has data, and castSpell consumes it', () => {
  const upcasters = Object.values(GRIMOIRE_I).filter((s) => typeof s.upcast === 'function');
  assert.ok(upcasters.length >= 7, `upcast deltas shipped (${upcasters.length})`);
  // Each delta scales monotonically with the slot level spent. ('+mod'
  // specs are host-resolved, not Dice-parseable — compare their die count.)
  const dieCount = (spec) => Number(/^(\d+)d/.exec(spec)?.[1]);
  for (const s of upcasters) {
    const atOwn = s.upcast(s.level);
    const above = s.upcast(s.level + 2);
    assert.ok(atOwn && above, `${s.id} upcast returns a delta`);
    for (const [k, v] of Object.entries(atOwn)) {
      if (typeof v === 'string' && dieCount(v)) {
        assert.ok(dieCount(above[k]) > dieCount(v), `${s.id} ${k} grows when upcast`);
      } else if (typeof v === 'number') {
        assert.ok(above[k] > v, `${s.id} ${k} grows when upcast`);
      }
    }
  }
  // End to end: a L9 wizard upcasts Cataract of Stars out of a 7th slot.
  const caster = { classId: 'wizard', spellSlots: Spellcasting.freshSlots('full', 17) };
  const res = Spellcasting.castSpell(caster, engine.spells['cataract-of-stars'], { slotLevel: 7 });
  assert.equal(res.ok, true);
  assert.equal(res.castLevel, 7);
  assert.deepEqual(res.upcastEffect, { damage: '10d8' });
});

test('the pack mounts, casts and ritual-casts through the engine', () => {
  // Mounted beside the SRD list: nothing shadowed, everything reachable.
  assert.equal(
    Object.keys(engine.spells).length,
    Object.keys(createEngine().spells).length + 50);
  // The class-list gate is SRD-scoped by design: homebrew spells pass
  // through even for a listed caster class, and the pack's `classes`
  // arrays are the host's data for building real lists.
  const cleric = { classId: 'cleric', spellSlots: Spellcasting.freshSlots('full', 5) };
  const cast = Spellcasting.castSpell(cleric, engine.spells['skyfall-lance']);
  assert.equal(cast.ok, true, 'homebrew passes the SRD class gate');
  // Concentration binds when the record says so.
  const conc = Spellcasting.castSpell(cleric, engine.spells['iron-oath']);
  assert.equal(conc.actor.concentration?.spellId, 'iron-oath');
  // Ritual casting works with the pack's ritual flags: no slot spent.
  const witch = {
    classId: 'wizard',
    spellsPrepared: ['second-sight'],
    spellSlots: Spellcasting.freshSlots('full', 5),
  };
  const rit = Spellcasting.castSpell(witch, engine.spells['second-sight'], { ritual: true });
  assert.equal(rit.ok, true);
  assert.equal(rit.ritual, true);
  assert.deepEqual(rit.actor.spellSlots, witch.spellSlots, 'ritual consumed no slot');
});
