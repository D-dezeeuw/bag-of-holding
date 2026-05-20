// === 1.18.0 travel & exploration ===

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';
import { milesTravelled, forcedMarchCheck, checkRestInterruption, forageCheck, navigateCheck, TRAVEL_PACES } from '../src/travel.js';

const baseActor = (overrides = {}) => ({
  id: 'pc',
  abilityScores: { str: 10, dex: 10, con: 12, int: 10, wis: 12, cha: 10 },
  proficiencyBonus: 2,
  exhaustion: 0,
  ...overrides
});

test('TRAVEL_PACES matches SRD per-hour and per-day mileage', () => {
  assert.equal(TRAVEL_PACES.slow.milesPerHour, 2);
  assert.equal(TRAVEL_PACES.normal.milesPerHour, 3);
  assert.equal(TRAVEL_PACES.fast.milesPerHour, 4);
  assert.equal(TRAVEL_PACES.slow.milesPerDay, 16);
  assert.equal(TRAVEL_PACES.normal.milesPerDay, 24);
  assert.equal(TRAVEL_PACES.fast.milesPerDay, 30);
});

test('TRAVEL_PACES: fast pace forfeits passive Perception', () => {
  assert.equal(TRAVEL_PACES.fast.passivePerceptionBonus, -5);
  assert.equal(TRAVEL_PACES.slow.stealthOk, true);
});

test('milesTravelled scales hours by per-hour rate', () => {
  assert.equal(milesTravelled({ pace: 'normal', hours: 8 }), 24);
  assert.equal(milesTravelled({ pace: 'fast', hours: 8 }), 32);
});

test('milesTravelled floors negative hours at zero', () => {
  assert.equal(milesTravelled({ pace: 'normal', hours: -3 }), 0);
});

test('milesTravelled throws on unknown pace', () => {
  assert.throws(() => milesTravelled({ pace: 'turbo', hours: 8 }), /unknown pace/);
});

test('forcedMarchCheck: success leaves the actor alone', () => {
  const highRoll = () => 0.99;
  const r = forcedMarchCheck(baseActor(), { hoursPast8: 1 }, highRoll);
  assert.equal(r.actor.exhaustion, 0);
  assert.equal(r.save.success, true);
});

test('forcedMarchCheck: failure costs one exhaustion', () => {
  const lowRoll = () => 0.01;
  const r = forcedMarchCheck(baseActor(), { hoursPast8: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
  assert.equal(r.save.success, false);
});

test('forcedMarchCheck: DC ramps by hours past 8', () => {
  const lowRoll = () => 0.5;
  const r = forcedMarchCheck(baseActor(), { hoursPast8: 4 }, lowRoll);
  assert.equal(r.save.dc, 14);
});

test('forcedMarchCheck: rejects non-positive hoursPast8', () => {
  assert.throws(() => forcedMarchCheck(baseActor(), { hoursPast8: 0 }), /positive integer/);
  assert.throws(() => forcedMarchCheck(baseActor(), { hoursPast8: -1 }), /positive integer/);
});

test('forcedMarchCheck: actor without CON falls back to 10', () => {
  const noScores = { id: 'pc', exhaustion: 0 };
  const lowRoll = () => 0.01;
  const r = forcedMarchCheck(noScores, { hoursPast8: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
});

test('checkRestInterruption: low roll flags interrupted', () => {
  const r = checkRestInterruption({ probability: 0.5 }, () => 0.1);
  assert.equal(r.interrupted, true);
  assert.equal(r.roll, 0.1);
});

test('checkRestInterruption: high roll leaves the rest intact', () => {
  const r = checkRestInterruption({ probability: 0.2 }, () => 0.99);
  assert.equal(r.interrupted, false);
});

test('checkRestInterruption: probability 0 never interrupts', () => {
  const r = checkRestInterruption({ probability: 0 }, () => 0.0);
  assert.equal(r.interrupted, false);
});

test('checkRestInterruption: rejects probabilities outside [0, 1]', () => {
  assert.throws(() => checkRestInterruption({ probability: -0.1 }), /\[0, 1\]/);
  assert.throws(() => checkRestInterruption({ probability: 1.5 }), /\[0, 1\]/);
});

test('forageCheck: plentiful terrain DC 10, success yields food + water', () => {
  const r = forageCheck({ actor: baseActor(), terrain: 'plentiful' }, () => 0.99);
  assert.equal(r.check.dc, 10);
  assert.equal(r.check.success, true);
  assert.ok(r.foundFoodLbs > 0);
  assert.ok(r.foundWaterGallons > 0);
});

test('forageCheck: failure yields zero food and water', () => {
  const r = forageCheck({ actor: baseActor(), terrain: 'barren' }, () => 0.01);
  assert.equal(r.check.success, false);
  assert.equal(r.foundFoodLbs, 0);
  assert.equal(r.foundWaterGallons, 0);
});

test('forageCheck: survival proficiency adds prof bonus on the check', () => {
  const actor = baseActor({ proficiencies: { skills: ['survival'] } });
  const r = forageCheck({ actor }, () => 0.5);
  assert.equal(r.check.mod, 3); // wis 12 (+1) + prof (+2)
});

test('forageCheck: throws on unknown terrain', () => {
  assert.throws(() => forageCheck({ actor: baseActor(), terrain: 'lava' }), /unknown terrain/);
});

test('forageCheck: actor without proficiencyBonus defaults to 2', () => {
  const minimal = { abilityScores: { wis: 10 } };
  const r = forageCheck({ actor: minimal }, () => 0.5);
  assert.equal(r.check.mod, 0); // wis 10 (+0), not proficient
});

test('navigateCheck: success leaves the party on course', () => {
  const r = navigateCheck({ actor: baseActor(), terrain: 'open' }, () => 0.99);
  assert.equal(r.lost, false);
});

test('navigateCheck: failure means the party is lost', () => {
  const r = navigateCheck({ actor: baseActor(), terrain: 'jungle' }, () => 0.01);
  assert.equal(r.lost, true);
});

test('navigateCheck: navigator tools satisfy the proficiency check', () => {
  const actor = baseActor({ proficiencies: { tools: ['navigators-tools'] } });
  const r = navigateCheck({ actor }, () => 0.5);
  assert.equal(r.check.mod, 3); // wis +1 + prof +2
});

test('navigateCheck: throws on unknown terrain', () => {
  assert.throws(() => navigateCheck({ actor: baseActor(), terrain: 'sky' }), /unknown terrain/);
});

test('navigateCheck: defaults to open terrain when terrain is omitted', () => {
  const r = navigateCheck({ actor: baseActor() }, () => 0.99);
  assert.equal(r.check.dc, 10);
});

test('forageCheck: defaults to plentiful when terrain is omitted', () => {
  const r = forageCheck({ actor: baseActor() }, () => 0.5);
  assert.equal(r.check.dc, 10);
});

test('engine.Travel.forcedMarchCheck logs saves through the engine rng', () => {
  const engine = createEngine({ rng: Dice.seededRng(11) });
  const logBefore = engine.rollLog.length;
  engine.Travel.forcedMarchCheck(baseActor(), { hoursPast8: 2 });
  assert.ok(engine.rollLog.length > logBefore);
});

test('engine.Travel.checkRestInterruption uses the seeded rng', () => {
  const engineA = createEngine({ rng: Dice.seededRng(11) });
  const engineB = createEngine({ rng: Dice.seededRng(11) });
  assert.deepEqual(
    engineA.Travel.checkRestInterruption({ probability: 0.5 }),
    engineB.Travel.checkRestInterruption({ probability: 0.5 })
  );
});

test('forageCheck: actor without abilityScores falls back to wis 10', () => {
  const noScores = { id: 'pc' };
  const r = forageCheck({ actor: noScores }, () => 0.99);
  assert.equal(r.check.mod, 0);
});

test('navigateCheck: survival skill alone (no navigator tools) grants proficiency', () => {
  const actor = baseActor({ proficiencies: { skills: ['survival'] } });
  const r = navigateCheck({ actor }, () => 0.5);
  assert.equal(r.check.mod, 3);
});

test('navigateCheck: actor without proficiencyBonus defaults to 2', () => {
  const minimal = { abilityScores: { wis: 12 }, proficiencies: { tools: ['navigators-tools'] } };
  const r = navigateCheck({ actor: minimal }, () => 0.5);
  assert.equal(r.check.mod, 3);
});

test('navigateCheck: actor without abilityScores falls back to wis 10', () => {
  const noScores = { id: 'pc' };
  const r = navigateCheck({ actor: noScores }, () => 0.5);
  assert.equal(r.check.mod, 0);
});

test('engine.Travel.forageCheck and navigateCheck route through seeded rng', () => {
  const engineA = createEngine({ rng: Dice.seededRng(11) });
  const engineB = createEngine({ rng: Dice.seededRng(11) });
  assert.deepEqual(
    engineA.Travel.forageCheck({ actor: baseActor() }),
    engineB.Travel.forageCheck({ actor: baseActor() })
  );
  assert.deepEqual(
    engineA.Travel.navigateCheck({ actor: baseActor() }),
    engineB.Travel.navigateCheck({ actor: baseActor() })
  );
});
