// Grimoire II — 30 invented spells, 6th through 9th, so tier-3/4 casters
// have a real list. What must hold: the roadmap's shapes (city-sized AoEs,
// plane-shifting alternatives, complex multi-target control), the same 1.8
// record discipline as Grimoire I, and composition with it — a full caster
// can climb level 0 to 9 without leaving invented content.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, GRIMOIRE_I, GRIMOIRE_II, CASTER_CLASSES, Spellcasting,
} from '../index.js';

const engine = createEngine({ extraSpells: GRIMOIRE_II });
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SCHOOLS = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
];

test('30 spells, 6th through 9th, every record well-formed', () => {
  const all = Object.values(GRIMOIRE_II);
  assert.equal(all.length, 30, 'the roadmap number is the shipped number');
  const byLevel = new Map();
  for (const s of all) {
    byLevel.set(s.level, (byLevel.get(s.level) ?? 0) + 1);
    assert.ok(s.level >= 6 && s.level <= 9, `${s.id} stays in Grimoire II's band`);
    assert.ok(SCHOOLS.includes(s.school), `${s.id} school '${s.school}' is real`);
    assert.ok(s.components && typeof s.components === 'object', `${s.id} declares components`);
    assert.ok(s.range && s.duration, `${s.id} declares range and duration`);
    if (s.damage) assert.ok(engine.Dice.parse(s.damage), `${s.id} damage parses`);
    if (s.save) assert.ok(ABILITIES.includes(s.save), `${s.id} save '${s.save}' is an ability`);
    assert.ok(Array.isArray(s.classes) && s.classes.length >= 1, `${s.id} names its classes`);
    for (const c of s.classes) {
      assert.ok(CASTER_CLASSES.includes(c), `${s.id} class '${c}' is a caster class`);
    }
  }
  assert.deepEqual([6, 7, 8, 9].map((l) => byLevel.get(l)), [9, 8, 7, 6]);
  for (const school of SCHOOLS) {
    assert.ok(all.some((s) => s.school === school), `${school} is represented`);
  }
});

test("the roadmap's high-tier shapes: city-sized AoEs, plane-shifts, mass control", () => {
  const all = Object.values(GRIMOIRE_II);
  // City-sized: areas whose radius reaches 100 ft or more.
  const citySized = all.filter((s) => {
    const size = Number(/-(\d+)$/.exec(s.area ?? '')?.[1]);
    return size >= 100;
  });
  assert.ok(citySized.length >= 3, `city-sized AoEs shipped (${citySized.length})`);
  // Save-for-half discipline on every damaging AoE.
  for (const s of all.filter((x) => x.damage && x.area)) {
    assert.equal(s.halfOnSave, true, `${s.id} is save-for-half`);
  }
  // Plane-shifting alternatives carry costed material components — the
  // classic gate on free interplanar travel.
  const gates = ['doorway-of-ash', 'lantern-across-the-veil', 'exodus-gate'];
  for (const id of gates) {
    assert.ok(GRIMOIRE_II[id], `${id} shipped`);
    assert.ok(GRIMOIRE_II[id].components.m?.cost >= 500, `${id} costs real components`);
  }
  // Complex multi-target control: save + concentration + an area.
  const massControl = all.filter((s) => s.save && s.concentration && s.area && !s.damage);
  assert.ok(massControl.length >= 3, `mass control shipped (${massControl.length})`);
  // Reaction options exist even at this tier.
  assert.ok(all.filter((s) => s.reaction).length >= 3, 'high-tier reactions shipped');
});

test('casts through the engine at tier 4, costed components enforced', () => {
  const wizard = { classId: 'wizard', spellSlots: Spellcasting.freshSlots('full', 17) };
  // A 9th-level slot pays for Last Dawn.
  const nova = Spellcasting.castSpell(wizard, engine.spells['last-dawn']);
  assert.equal(nova.ok, true);
  assert.equal(nova.castLevel, 9);
  // Costed material components refuse until the host marks them held.
  const broke = Spellcasting.castSpell(wizard, engine.spells['exodus-gate']);
  assert.equal(broke.ok, false);
  assert.match(broke.reason, /material/);
  const funded = { ...wizard, materials: { 'exodus-gate': true } };
  assert.equal(Spellcasting.castSpell(funded, engine.spells['exodus-gate']).ok, true);
  // Upcast delta at this tier: Harrowing of the Square out of a 9th slot.
  const harrow = Spellcasting.castSpell(wizard, engine.spells['harrowing-of-the-square'], { slotLevel: 9 });
  assert.equal(harrow.ok, true);
  assert.deepEqual(harrow.upcastEffect, { damage: '12d6' });
});

test('both grimoires compose: an invented list from cantrip to 9th', () => {
  const full = createEngine({ extraSpells: { ...GRIMOIRE_I, ...GRIMOIRE_II } });
  assert.equal(
    Object.keys(full.spells).length,
    Object.keys(createEngine().spells).length + 50 + 30,
    'every spell landed; nothing shadowed anything');
  const levels = new Set(Object.values({ ...GRIMOIRE_I, ...GRIMOIRE_II }).map((s) => s.level));
  for (let l = 0; l <= 9; l++) assert.ok(levels.has(l), `spell level ${l} has invented entries`);
});
