// Variant rules: encounter + skills. What must hold: both initiative
// variants produce strict orders (ties always broken); tracks clamp to
// their bands and rank thresholds resolve; background-as-proficiency
// feeds the existing `proficient` flag; the six skill groups PARTITION
// the 18 SRD skills exactly.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Dice, Character, VariantEncounter } from '../index.js';
import {
  sideInitiative, groupInitiative,
  TRACK_PRESETS, adjustTrack, trackValue, rankFor, RENOWN_RANKS,
  backgroundApplies, SKILL_GROUPS, groupFor,
} from '../src/variants/encounter.js';
import { abilityCheck } from '../src/checks.js';

test('side initiative: one die per side, ties rerolled to a strict order', () => {
  assert.match(sideInitiative(['party']).reason, /at least two sides/);
  // Force a tie then a break: rolls 10, 10, then 4 and 18 on reroll.
  const faces = [10, 10, 4, 18];
  const rigged = () => (faces.shift() - 1) / 20;
  const { order } = sideInitiative(['party', 'monsters'], rigged);
  assert.deepEqual(order.map((o) => o.side), ['monsters', 'party']);
  assert.equal(new Set(order.map((o) => o.d20)).size, 2, 'strict order, no ties');
});

test('group initiative: d20 + group DEX mod, higher mod wins the near-tie', () => {
  // wolves DEX 15 (+2) roll 10 → 12; bandits DEX 12 (+1) roll 11 → 12.
  // Equal totals but different mods: the higher mod acts first, no reroll.
  const faces = [10, 11];
  const rigged = () => (faces.shift() - 1) / 20;
  const { order } = groupInitiative(
    [{ id: 'wolves', dexterity: 15 }, { id: 'bandits', dexterity: 12 }], rigged);
  assert.deepEqual(order.map((o) => o.group), ['wolves', 'bandits']);
  assert.deepEqual(order.map((o) => o.initiative), [12, 12]);
  // Identical total AND mod rerolls to a strict order.
  const faces2 = [10, 10, 3, 17];
  const rigged2 = () => (faces2.shift() - 1) / 20;
  const second = groupInitiative(
    [{ id: 'a', dexterity: 10 }, { id: 'b', dexterity: 10 }], rigged2);
  assert.deepEqual(second.order.map((o) => o.group), ['b', 'a']);
});

test('tracks: clamped bands, preset ladders, rank thresholds', () => {
  let actor = { id: 'pc' };
  // Honor starts at its preset midpoint and clamps at the band edges.
  assert.equal(trackValue(actor, 'honor'), 10);
  ({ actor } = adjustTrack(actor, 'honor', -15));
  assert.equal(trackValue(actor, 'honor'), 0, 'clamped at min');
  ({ actor } = adjustTrack(actor, 'renown', 7));
  ({ actor } = adjustTrack(actor, 'renown', 5));
  assert.equal(trackValue(actor, 'renown'), 12);
  // Rank ladder: 12 renown = agent; 2 renown = nobody yet.
  assert.equal(rankFor(trackValue(actor, 'renown'), RENOWN_RANKS).name, 'agent');
  assert.equal(rankFor(2, RENOWN_RANKS), null);
  // Custom tracks work with an explicit band.
  ({ actor } = adjustTrack(actor, 'dread', 3, { min: 0, max: 10, start: 0 }));
  assert.equal(trackValue(actor, 'dread', { start: 0 }), 3);
  assert.ok(TRACK_PRESETS.piety.max === 50);
});

test('background-as-proficiency feeds the existing proficient flag', () => {
  const engine = createEngine();
  const sage = engine.backgrounds.sage;
  assert.equal(backgroundApplies(sage, 'arcana'), true);
  assert.equal(backgroundApplies(sage, 'athletics'), false);
  // The verdict rides abilityCheck unchanged — same roll, the
  // proficiency bonus appears exactly when the background applies.
  // (Module-level import: the engine-bound version substitutes the
  // engine rng, so pinned-die assertions use the unbound one.)
  const rigged = () => 0.5; // d20 = 11
  const flat = abilityCheck({ abilityScore: 14, dc: 15, proficient: backgroundApplies(sage, 'athletics'), proficiencyBonus: 3 }, rigged);
  const prof = abilityCheck({ abilityScore: 14, dc: 15, proficient: backgroundApplies(sage, 'arcana'), proficiencyBonus: 3 }, rigged);
  assert.equal(flat.total, 13);
  assert.equal(prof.total, 16);
  assert.equal(prof.success, true);
});

test('the six skill groups partition the 18 SRD skills exactly', () => {
  const allSkills = Object.keys(Character.SKILL_ABILITY);
  const grouped = Object.values(SKILL_GROUPS).flat();
  assert.equal(grouped.length, allSkills.length, 'no skill grouped twice');
  for (const skill of allSkills) {
    assert.ok(groupFor(skill), `${skill} belongs to a group`);
  }
  assert.equal(groupFor('stealth'), 'finesse');
  assert.equal(groupFor('religion'), 'wits');
  assert.equal(groupFor('not-a-skill'), null);
});

test('the engine exposes VariantEncounter with seeded, replay-aligned rolls', () => {
  const engine = createEngine({ rng: Dice.seededRng(23) });
  const twin = createEngine({ rng: Dice.seededRng(23) });
  assert.deepEqual(
    engine.VariantEncounter.sideInitiative(['party', 'monsters']),
    twin.VariantEncounter.sideInitiative(['party', 'monsters']));
  assert.deepEqual(
    engine.VariantEncounter.groupInitiative([{ id: 'wolves', dexterity: 14 }]),
    twin.VariantEncounter.groupInitiative([{ id: 'wolves', dexterity: 14 }]));
  assert.equal(typeof VariantEncounter.adjustTrack, 'function');
  assert.equal(typeof VariantEncounter.SKILL_GROUPS, 'object');
});
