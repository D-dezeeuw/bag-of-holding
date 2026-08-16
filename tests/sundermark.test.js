// Sundermark (3.0.0) — the first complete setting pack, and the four
// new engine slots it mounts through. What must hold: the roadmap
// numbers (6 regions, 10 cities, 15 factions, 12 NPCs, 1 species, 3
// backgrounds, 5 feats, 2 adventures); referential integrity across the
// whole pack (region→city→hook→adventure, faction→seat, npc→faction);
// both adventures VALID under the 2.6.0 deep validator with their
// difficulty claims re-derived; and a full sitting of The Singing Tower
// through the run glue.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Adventures, Beats, Character, STARTER_PARTY, TREASURY,
  SUNDERMARK, THE_SINGING_TOWER, HALBERDS_EDGE,
} from '../index.js';

const engine = createEngine({
  extraRegions: SUNDERMARK.regions,
  extraNpcs: SUNDERMARK.npcs,
  extraStoryHooks: SUNDERMARK.hooks,
  extraAdventures: SUNDERMARK.adventures,
  extraSpecies: SUNDERMARK.species,
  extraBackgrounds: SUNDERMARK.backgrounds,
  extraFeats: SUNDERMARK.feats,
  extraItems: TREASURY,
});

test('the roadmap numbers, mounted through the 3.0.0 slots', () => {
  assert.equal(Object.keys(SUNDERMARK.regions).length, 6);
  assert.equal(Object.keys(SUNDERMARK.cities).length, 10);
  assert.equal(Object.keys(SUNDERMARK.factions).length, 15);
  assert.equal(Object.keys(SUNDERMARK.npcs).length, 12);
  assert.equal(Object.keys(SUNDERMARK.species).length, 1);
  assert.equal(Object.keys(SUNDERMARK.backgrounds).length, 3);
  assert.equal(Object.keys(SUNDERMARK.feats).length, 5);
  assert.equal(Object.keys(SUNDERMARK.adventures).length, 2);
  // The new registries exist on the engine, filled by the pack…
  assert.equal(Object.keys(engine.regions).length, 6);
  assert.equal(Object.keys(engine.npcs).length, 12);
  assert.equal(Object.keys(engine.storyHooks).length, 13);
  assert.equal(Object.keys(engine.adventures).length, 2);
  // …and stay EMPTY on a bare engine: no setting is on by default.
  const bare = createEngine();
  assert.deepEqual(
    [bare.regions, bare.npcs, bare.storyHooks, bare.adventures].map((r) => Object.keys(r).length),
    [0, 0, 0, 0]);
  // Registry validation guards the new slots like every other.
  assert.throws(
    () => createEngine({ extraNpcs: { broken: { id: 'broken', name: 'X' } } }),
    /missing required field: archetypeRole/);
});

test('referential integrity: region→city→hook→adventure, faction→seat, npc→faction', () => {
  for (const region of Object.values(SUNDERMARK.regions)) {
    for (const cityId of region.cities) {
      assert.equal(SUNDERMARK.cities[cityId]?.regionId, region.id, `${cityId} belongs to ${region.id}`);
    }
  }
  for (const city of Object.values(SUNDERMARK.cities)) {
    assert.ok(SUNDERMARK.regions[city.regionId], `${city.id} region resolves`);
    for (const hookId of city.hooks) {
      assert.equal(SUNDERMARK.hooks[hookId]?.cityId, city.id, `${hookId} points back at ${city.id}`);
    }
  }
  for (const hook of Object.values(SUNDERMARK.hooks)) {
    assert.ok(SUNDERMARK.factions[hook.factionId], `${hook.id} faction resolves`);
    if (hook.adventureId) {
      assert.ok(SUNDERMARK.adventures[hook.adventureId], `${hook.id} opens a real adventure`);
    }
  }
  for (const faction of Object.values(SUNDERMARK.factions)) {
    if (faction.seat) assert.ok(SUNDERMARK.cities[faction.seat], `${faction.id} seat resolves`);
    for (const enemy of faction.enemies) {
      assert.ok(SUNDERMARK.factions[enemy], `${faction.id} enemy '${enemy}' resolves`);
    }
  }
  for (const npc of Object.values(SUNDERMARK.npcs)) {
    assert.ok(SUNDERMARK.factions[npc.factionId], `${npc.id} faction resolves`);
    if (npc.cityId) assert.ok(SUNDERMARK.cities[npc.cityId], `${npc.id} city resolves`);
    assert.ok(Beats.ARCHETYPE_ROLES.includes(npc.archetypeRole), `${npc.id} role is castable`);
  }
  // Every faction stance is a distinct answer to the setting's question.
  const stances = Object.values(SUNDERMARK.factions).map((f) => f.stance);
  assert.equal(new Set(stances).size, stances.length, 'no two factions give the same answer');
});

test('both adventures validate deep: refs, reachability, difficulty claims re-derived', () => {
  for (const pack of [THE_SINGING_TOWER, HALBERDS_EDGE]) {
    const verdict = Adventures.validateAdventure(pack, {
      monsters: engine.monsters, items: engine.items,
    });
    assert.deepEqual(verdict.errors, [], `${pack.id} validates`);
    assert.equal(verdict.valid, true);
  }
});

test('the setting origins derive a playable character', () => {
  const pc = {
    ...STARTER_PARTY[0], id: 'sundermark-pc',
    speciesId: 'vesperin', backgroundId: 'seance-clerk',
  };
  const sheet = Character.deriveSheet(pc, engine);
  assert.equal(sheet.senses.darkvision, 60);
  assert.ok(sheet.damageResistances.includes('psychic'));
  // The racial cantrip resolves (Message — the species that remembers
  // sound perfectly whispers well).
  assert.equal(engine.spells[SUNDERMARK.species.vesperin.effects.cantripId].level, 0);
  // Background origin feats resolve into the merged registry.
  for (const bg of Object.values(SUNDERMARK.backgrounds)) {
    assert.equal(engine.feats[bg.originFeat.id]?.category, 'origin', `${bg.id} feat resolves`);
  }
});

test('a full sitting of The Singing Tower: hook to final flag through the run glue', () => {
  let run = Adventures.createRun(THE_SINGING_TOWER);
  const walk = [
    ['scene.magistrates-hall', 'st.commissioned', 'scene.choir-loft'],
    ['scene.choir-loft', 'st.learned-verse', 'scene.processional-road'],
    ['scene.processional-road', 'st.reached-tower', 'scene.bell-chamber'],
  ];
  for (const [expectHere, flag, goNext] of walk) {
    assert.equal(Adventures.currentScene(THE_SINGING_TOWER, run).id, expectHere);
    run = Adventures.setFlag(run, flag);
    const step = Adventures.goTo(THE_SINGING_TOWER, run, goNext);
    assert.equal(step.moved, true, `exit to ${goNext} is open`);
    run = step.run;
  }
  // The climax: cast resolves, encounter builds real participants.
  const finale = Adventures.currentScene(THE_SINGING_TOWER, run);
  assert.equal(finale.id, 'scene.bell-chamber');
  const voice = THE_SINGING_TOWER.npcs['the-tower-voice'];
  assert.equal(engine.monsters[voice.statBlockId].id, 'banshee', 'the antagonist IS the climax monster');
  const foes = Adventures.encounterParticipants(finale, engine.monsters);
  assert.equal(foes.length, 3, 'banshee + wisp + shadow take the field');
  run = Adventures.setFlag(run, 'st.song-ended');
  assert.equal(run.flags['st.song-ended'], true, 'the sitting completes');
});
