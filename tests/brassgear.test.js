// Brassgear (3.1.0) — the second setting pack. What must hold: the
// roadmap numbers (5 city-states, 10 hooks, 1 species, 2 backgrounds,
// 1 adventure); the inherited-talent system's referential shape; the
// Tinker actually working as a Phase A.2 graft (infuse → overclock →
// pool exhaustion → long-rest refresh, with NO new top-level class);
// referential integrity; and the heist validating deep + running a
// full sitting.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Adventures, Beats, Character, Mechanics, STARTER_PARTY, TREASURY,
  BRASSGEAR, THE_GREENMIST_HEIST,
} from '../index.js';

const engine = createEngine({
  extraRegions: BRASSGEAR.regions,
  extraNpcs: BRASSGEAR.npcs,
  extraStoryHooks: BRASSGEAR.hooks,
  extraAdventures: BRASSGEAR.adventures,
  extraSpecies: BRASSGEAR.species,
  extraBackgrounds: BRASSGEAR.backgrounds,
  extraFeats: BRASSGEAR.feats,
  extraMechanics: BRASSGEAR.tinker.mechanics,
  extraResources: BRASSGEAR.tinker.resources,
  extraItems: TREASURY,
});

test('the roadmap numbers: 5 city-states, 10 hooks, talents, origins, one heist', () => {
  assert.equal(Object.keys(BRASSGEAR.regions).length, 5);
  assert.equal(Object.keys(BRASSGEAR.cities).length, 5, 'city-states: one seat each');
  assert.equal(Object.keys(BRASSGEAR.hooks).length, 10);
  assert.equal(Object.keys(BRASSGEAR.talents).length, 6);
  assert.equal(Object.keys(BRASSGEAR.species).length, 1);
  assert.equal(Object.keys(BRASSGEAR.backgrounds).length, 2);
  assert.equal(Object.keys(BRASSGEAR.adventures).length, 1);
  // Mounted beside Sundermark's slots without collision: the registries
  // fill from this pack alone here.
  assert.equal(Object.keys(engine.regions).length, 5);
  assert.equal(Object.keys(engine.storyHooks).length, 10);
});

test('referential integrity: city-states, hooks, talents, npcs', () => {
  for (const region of Object.values(BRASSGEAR.regions)) {
    assert.equal(region.cities.length, 1, `${region.id} is a city-STATE`);
    assert.equal(BRASSGEAR.cities[region.cities[0]]?.regionId, region.id);
  }
  for (const city of Object.values(BRASSGEAR.cities)) {
    for (const hookId of city.hooks) {
      assert.equal(BRASSGEAR.hooks[hookId]?.cityId, city.id, `${hookId} points back`);
    }
  }
  for (const hook of Object.values(BRASSGEAR.hooks)) {
    assert.ok(BRASSGEAR.factions[hook.factionId], `${hook.id} faction resolves`);
    if (hook.adventureId) assert.ok(BRASSGEAR.adventures[hook.adventureId]);
  }
  for (const npc of Object.values(BRASSGEAR.npcs)) {
    assert.ok(BRASSGEAR.factions[npc.factionId], `${npc.id} faction resolves`);
    assert.ok(Beats.ARCHETYPE_ROLES.includes(npc.archetypeRole));
  }
  // Talents: each owned by a distinct house; advantage grants name real skills.
  const houses = Object.values(BRASSGEAR.talents).map((t) => t.house);
  assert.equal(new Set(houses).size, houses.length, 'one talent per house');
  for (const t of Object.values(BRASSGEAR.talents)) {
    if (t.grants.advantageOnSkill) {
      assert.ok(t.grants.advantageOnSkill in Character.SKILL_ABILITY, `${t.id} skill is real`);
    }
  }
});

test('the Tinker is a graft, not a class: infuse → overclock → exhaust → refresh', () => {
  // No new top-level class — the wizard chassis carries the mechanics.
  assert.equal(Object.keys(engine.classes).length, Object.keys(createEngine().classes).length);
  const wizard = engine.classes.wizard;
  assert.equal(typeof wizard.mechanics.infuseDevice, 'function');
  assert.equal(typeof wizard.mechanics.overclock, 'function');

  // The resource pool arrives through the standard resource machinery.
  const resources = Mechanics.freshResources(wizard, 5, {});
  let tinker = { id: 'tink', classId: 'wizard', resources };
  assert.equal(resources['infusion-charges'].max, 3);
  assert.equal(resources['infusion-charges'].used, 0);
  assert.equal(resources['infusion-charges'].refreshes, 'long');

  // Infuse a device, overclock it, and run the pool dry.
  let r = wizard.mechanics.infuseDevice(tinker, { itemId: 'lodestar-compass' });
  assert.equal(r.ok, true);
  tinker = r.actor;
  assert.equal(tinker.infusedDevices['lodestar-compass'], true);
  r = wizard.mechanics.overclock(tinker, { itemId: 'lodestar-compass' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.effect, { advantageOnNextUse: 'lodestar-compass' });
  tinker = r.actor;
  r = wizard.mechanics.infuseDevice(tinker, { itemId: 'sparrow-whistle' });
  tinker = r.actor;
  assert.equal(tinker.resources['infusion-charges'].used, 3);
  assert.match(wizard.mechanics.infuseDevice(tinker, { itemId: 'x' }).reason, /no infusion charges/);
  // Overclock refuses on a device that was never infused.
  assert.match(wizard.mechanics.overclock(tinker, { itemId: 'never-infused' }).reason, /infused device/);
  // A long rest refreshes the pool through the standard machinery.
  const rested = engine.Rest.longRest({ ...tinker, hp: 10, hpMax: 10 });
  assert.equal(rested.resources['infusion-charges'].used, 0);
});

test('cogborn and the noir origins derive playable characters', () => {
  const pc = {
    ...STARTER_PARTY[0], id: 'brassgear-pc',
    speciesId: 'cogborn', backgroundId: 'salvage-broker',
  };
  const sheet = Character.deriveSheet(pc, engine);
  assert.equal(sheet.senses.darkvision, 60);
  assert.ok(sheet.damageResistances.includes('poison'));
  for (const bg of Object.values(BRASSGEAR.backgrounds)) {
    assert.equal(engine.feats[bg.originFeat.id]?.category, 'origin', `${bg.id} feat resolves`);
  }
});

test('The Greenmist Heist validates deep and runs a full sitting', () => {
  const verdict = Adventures.validateAdventure(THE_GREENMIST_HEIST, {
    monsters: engine.monsters, items: engine.items,
  });
  assert.deepEqual(verdict.errors, []);
  assert.equal(verdict.valid, true);

  let run = Adventures.createRun(THE_GREENMIST_HEIST);
  const walk = [
    ['scene.the-wet-ledger', 'gh.hired', 'scene.stilt-row'],
    ['scene.stilt-row', 'gh.guided', 'scene.the-drowned-orchard'],
    ['scene.the-drowned-orchard', 'gh.at-the-vault', 'scene.the-fen-vault'],
  ];
  for (const [expectHere, flag, goNext] of walk) {
    assert.equal(Adventures.currentScene(THE_GREENMIST_HEIST, run).id, expectHere);
    run = Adventures.setFlag(run, flag);
    const step = Adventures.goTo(THE_GREENMIST_HEIST, run, goNext);
    assert.equal(step.moved, true, `exit to ${goNext} is open`);
    run = step.run;
  }
  const finale = Adventures.currentScene(THE_GREENMIST_HEIST, run);
  assert.equal(finale.id, 'scene.the-fen-vault');
  const foes = Adventures.encounterParticipants(finale, engine.monsters);
  assert.equal(foes.length, 4, 'the actuary\'s muscle takes the floor');
  run = Adventures.setFlag(run, 'gh.schematic-decided');
  assert.equal(run.flags['gh.schematic-decided'], true, 'the heist completes');
});
