// Bestiary I — 50 invented creatures, CR 0–5. What must hold: the batch is
// the size and tier the roadmap promised, every block mounts through the
// plugin validator with senses and a parseable arsenal, the niches are all
// genuinely populated, the deep fields drive the 1.10 consumers, and the
// five dungeon-overlay ids that resolved to nothing for months finally
// resolve — under their exact downstream names.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, BESTIARY_I, QUIET_STAIR_MONSTERS, elevate } from '../index.js';

const engine = createEngine({ extraMonsters: BESTIARY_I });

test('50 creatures, CR 0–5, all mount with senses and parseable attacks', () => {
  const ids = Object.keys(BESTIARY_I);
  assert.equal(ids.length, 50, 'the roadmap number is the shipped number');
  for (const id of ids) {
    const m = engine.monsters[id];
    assert.ok(m, `${id} merged into the registry`);
    assert.ok(m.cr >= 0 && m.cr <= 5, `${id} stays in the CR 0–5 tier (cr ${m.cr})`);
    assert.ok(m.senses && Object.keys(m.senses).length >= 1, `${id} has senses`);
    assert.ok(Array.isArray(m.attacks) && m.attacks.length >= 1, `${id} can fight`);
    for (const a of m.attacks) assert.ok(engine.Dice.parse(a.damage), `${id} ${a.name} damage parses`);
    // Tier discipline: legendary/lair/innate belong to Bestiary II/III.
    assert.equal(m.legendaryActions, undefined, `${id} has no legendary actions at this tier`);
    assert.equal(m.lairActions, undefined, `${id} has no lair actions at this tier`);
    assert.equal(m.innateSpellcasting, undefined, `${id} has no innate casting at this tier`);
  }
});

test('every ecology niche is genuinely populated', () => {
  // Niches are asserted through their signature blocks — a rename that
  // guts a niche fails here rather than shipping a hollow batch.
  const niche = {
    warband: ['ditch-runner', 'toll-blade', 'fen-poacher', 'ash-zealot', 'dune-lancer',
      'warband-drummer', 'grave-sapper', 'oath-sworn-reaver', 'silver-tongue-captain', 'iron-tithe-champion'],
    beast: ['moor-hare', 'carrion-gull', 'bristle-boar', 'mire-strider', 'howl-lynx',
      'razor-crane', 'dusk-ox', 'pit-wyrmling'],
    undead: ['rattle-shambler', 'lantern-ghast', 'fungal-zombie', 'sorrow-wisp',
      'barrow-hound', 'pale-usher', 'gallows-choir', 'tomb-regent'],
    fey: ['thistle-imp', 'dew-dancer', 'hollow-piper', 'briar-shepherd', 'mirror-courtier', 'winter-warden'],
    elemental: ['ember-mote', 'silt-churn', 'gale-shrike', 'brine-column', 'quake-tortoise'],
    ooze: ['candle-slick', 'verdigris-creep', 'gloom-gelatin', 'howling-amalgam'],
    construct: ['ledger-golem', 'stone-sentinel', 'clockwork-hart', 'reliquary-warden'],
    plant: ['creeping-arbor', 'spore-lord-cap', 'myconid-sovereign'],
    fiendAndDragon: ['lesser-demon', 'young-drake'],
  };
  for (const [name, ids] of Object.entries(niche)) {
    for (const id of ids) assert.ok(BESTIARY_I[id], `${name} niche is missing ${id}`);
  }
  assert.equal(Object.values(niche).flat().length, 50, 'the niche map covers the whole batch');

  // Undead, constructs and oozes all carry their nature's immunities.
  for (const id of [...niche.undead, ...niche.construct, ...niche.ooze]) {
    assert.ok((BESTIARY_I[id].conditionImmunities ?? []).length >= 1,
      `${id} carries its nature's condition immunities`);
  }
});

test('the five dungeon-overlay debt ids finally resolve, under their exact names', () => {
  for (const id of ['fungal-zombie', 'stone-sentinel', 'myconid-sovereign', 'young-drake', 'lesser-demon']) {
    const m = engine.monsters[id];
    assert.ok(m, `${id} is real at last`);
    assert.equal(m.id, id, 'the id downstream pools reference is the id shipped');
  }
});

test('deep fields drive the 1.10 consumers across the batch', () => {
  const routines = Object.values(BESTIARY_I).filter((m) => m.multiattack);
  assert.ok(routines.length >= 14, `a third of the batch multiattacks (${routines.length})`);
  for (const m of routines) {
    for (const step of engine.Monsters.multiattackSequence(m)) {
      const ref = m.attacks[step.attackRef];
      assert.ok(ref && ref.name === step.name, `${m.id} routine resolves into its own attacks`);
    }
  }
  const trained = Object.values(BESTIARY_I).filter((m) => m.saves);
  assert.ok(trained.length >= 10, `tier-top blocks train saves (${trained.length})`);
  for (const m of trained) {
    for (const [ability, bonus] of Object.entries(m.saves)) {
      assert.equal(engine.Monsters.saveBonus(m, ability), bonus, `${m.id} trained ${ability}`);
    }
  }
  // The drake's breath is the batch's biggest single hit and still parses.
  const breath = BESTIARY_I['young-drake'].attacks.find((a) => a.name === 'Scorching Breath');
  assert.deepEqual(engine.Dice.parse(breath.damage), { count: 4, sides: 6, modifier: 0 });
});

test('the batch composes: with the Quiet Stair pack, with the tier templates', () => {
  // Both packs in one engine — no id collisions by construction.
  const both = createEngine({ extraMonsters: { ...BESTIARY_I, ...QUIET_STAIR_MONSTERS } });
  assert.ok(both.monsters['tomb-regent'] && both.monsters['still-abbot']);
  const overlap = Object.keys(BESTIARY_I).filter((id) => id in QUIET_STAIR_MONSTERS);
  assert.deepEqual(overlap, [], 'the packs never fight over an id');

  // And a Bestiary I block elevates through the tier templates, reaching
  // boss CR from authored data — the bridge until Bestiary II ships.
  const boss = elevate(BESTIARY_I['tomb-regent'], 'elite');
  assert.equal(boss.cr, 9);
  assert.ok(boss.legendaryActions, 'the template arms what the base tier deliberately omits');
});
