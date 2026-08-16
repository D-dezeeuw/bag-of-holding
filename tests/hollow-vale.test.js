// The Hollow Vale (3.2.0) — gothic horror in one valley. What must
// hold: 8 domains, 8 Darklords each carrying a tragedy AND a door out;
// the dread track driving through VariantEncounter's existing custom-
// track machinery, feeding sanity (VariantRest) at the breaking
// threshold; light-as-resource costing dread when it runs out; the
// dream-sequence beat staged by the ordinary Beats runtime; and
// Bramblefell validating deep + running a full sitting.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Adventures, Beats, VariantEncounter, VariantRest, TREASURY,
  HOLLOW_VALE, HOLLOW_VALE_DREAD, burnLight, BRAMBLEFELL,
} from '../index.js';

const engine = createEngine({
  extraRegions: HOLLOW_VALE.regions,
  extraNpcs: HOLLOW_VALE.npcs,
  extraStoryHooks: HOLLOW_VALE.hooks,
  extraAdventures: HOLLOW_VALE.adventures,
  extraItems: TREASURY,
});

test('8 domains, 8 Darklords — every one a person with a tragedy and a door out', () => {
  assert.equal(Object.keys(HOLLOW_VALE.regions).length, 8);
  assert.equal(Object.keys(HOLLOW_VALE.cities).length, 8);
  assert.equal(Object.keys(HOLLOW_VALE.npcs).length, 8);
  assert.equal(Object.keys(HOLLOW_VALE.hooks).length, 8, 'one hook per domain');
  for (const lord of Object.values(HOLLOW_VALE.npcs)) {
    assert.equal(lord.archetypeRole, 'antagonist', `${lord.id} is castable as the antagonist`);
    assert.ok(typeof lord.tragedy === 'string' && lord.tragedy.length > 40,
      `${lord.id} carries a real tragedy`);
    assert.ok(typeof lord.redemption === 'string' && lord.redemption.length > 20,
      `${lord.id} has a door out — a moral arc, not a stake`);
    assert.ok(engine.monsters[lord.statBlockId], `${lord.id} can take the field if it comes to that`);
    // Each darklord rules their domain's seat.
    const city = Object.values(HOLLOW_VALE.cities).find((c) => c.ruler === lord.id);
    assert.ok(city, `${lord.id} rules a seat`);
  }
  // Domain → seat → hook integrity.
  for (const region of Object.values(HOLLOW_VALE.regions)) {
    assert.equal(region.cities.length, 1, `${region.id} is one domain, one seat`);
    assert.equal(HOLLOW_VALE.cities[region.cities[0]]?.regionId, region.id);
  }
  for (const city of Object.values(HOLLOW_VALE.cities)) {
    for (const hookId of city.hooks) {
      assert.equal(HOLLOW_VALE.hooks[hookId]?.cityId, city.id, `${hookId} points back`);
    }
  }
});

test('the dread track rides the existing machinery and feeds sanity at the break', () => {
  // adjustTrack with the pack band — no new engine surface.
  let pc = { id: 'pc', sanity: 12 };
  ({ actor: pc } = VariantEncounter.adjustTrack(pc, 'dread',
    HOLLOW_VALE_DREAD.gains.witnessDomainTruth, HOLLOW_VALE_DREAD.band));
  assert.equal(VariantEncounter.trackValue(pc, 'dread', HOLLOW_VALE_DREAD.band), 2);
  // Threshold ladder resolves through rankFor.
  assert.equal(VariantEncounter.rankFor(2, HOLLOW_VALE_DREAD.thresholds), null);
  assert.equal(VariantEncounter.rankFor(4, HOLLOW_VALE_DREAD.thresholds).name, 'unnerved');
  assert.equal(VariantEncounter.rankFor(7, HOLLOW_VALE_DREAD.thresholds).name, 'haunted');
  assert.equal(VariantEncounter.rankFor(10, HOLLOW_VALE_DREAD.thresholds).name, 'breaking');
  // The band clamps at 10; sanctuary rest walks it back down.
  ({ actor: pc } = VariantEncounter.adjustTrack(pc, 'dread', 99, HOLLOW_VALE_DREAD.band));
  assert.equal(VariantEncounter.trackValue(pc, 'dread', HOLLOW_VALE_DREAD.band), 10);
  ({ actor: pc } = VariantEncounter.adjustTrack(pc, 'dread',
    HOLLOW_VALE_DREAD.gains.restInSanctuary, HOLLOW_VALE_DREAD.band));
  assert.equal(VariantEncounter.trackValue(pc, 'dread', HOLLOW_VALE_DREAD.band), 8);
  // At 'breaking', the table costs sanity through VariantRest — the two
  // variant systems compose without either knowing the other exists.
  const broken = VariantRest.applySanityLoss(pc, 3);
  assert.equal(broken.ok, true);
  assert.equal(broken.actor.sanity, 9);
});

test('light as a resource: burning past empty costs dread', () => {
  let pc = { id: 'pc', lightHours: 2 };
  let r = burnLight(pc, 1);
  assert.deepEqual([r.remaining, r.inTheDark], [1, false]);
  r = burnLight(r.actor, 2);
  assert.equal(r.inTheDark, true);
  assert.equal(r.dreadGain, HOLLOW_VALE_DREAD.gains.nightWithoutLight);
  // Idle in the dark: an empty pool burning nothing is not a NEW night.
  assert.equal(burnLight(r.actor, 0).inTheDark, false);
});

test('Bramblefell validates deep; the dream beat is an ordinary beat', () => {
  const verdict = Adventures.validateAdventure(BRAMBLEFELL, {
    monsters: engine.monsters, items: engine.items,
  });
  assert.deepEqual(verdict.errors, []);
  assert.equal(verdict.valid, true);
  // The dream sequence is data on a standard beat — the runtime stages
  // it like any other; the host presents it as sleep.
  const dream = BRAMBLEFELL.beats.find((b) => b.dream === true);
  assert.equal(dream.id, 'beat.03.the-famine-dream');
  assert.ok(Beats.validateBeat(dream).valid, 'a dream beat is a valid beat');
});

test('a full sitting of Bramblefell: table → hedge → dream → refusal', () => {
  let run = Adventures.createRun(BRAMBLEFELL);
  const walk = [
    ['scene.the-green', 'bf.at-table', 'scene.the-hedge'],
    ['scene.the-hedge', 'bf.seen-the-briar', 'scene.the-famine-year'],
    ['scene.the-famine-year', 'bf.dreamed-the-famine', 'scene.the-long-table'],
  ];
  for (const [expectHere, flag, goNext] of walk) {
    assert.equal(Adventures.currentScene(BRAMBLEFELL, run).id, expectHere);
    run = Adventures.setFlag(run, flag);
    const step = Adventures.goTo(BRAMBLEFELL, run, goNext);
    assert.equal(step.moved, true, `exit to ${goNext} is open`);
    run = step.run;
  }
  const finale = Adventures.currentScene(BRAMBLEFELL, run);
  assert.equal(finale.id, 'scene.the-long-table');
  // Maren IS the encounter's fanatic — the Quiet Stair pattern again.
  assert.equal(BRAMBLEFELL.npcs['darklord-maren-ovenwarm'].statBlockId, 'cult-fanatic');
  const foes = Adventures.encounterParticipants(finale, engine.monsters);
  assert.equal(foes.length, 3, 'the oath, the briar\'s mouth, and a hedge-shade object');
  run = Adventures.setFlag(run, 'bf.chair-refilled');
  assert.equal(run.flags['bf.chair-refilled'], true, 'the chair empties and refills');
});
