// === 1.15.0 hazards & environment ===
//
// Disease, poison, suffocation, starvation, extreme temperature, and
// underwater combat: every helper resolves through the seeded engine
// so the rolls land in `rollLog` and replay cleanly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';
import { exposure, tickPoison, tickSuffocation, holdBreathRounds, starvationTick, extremeTemperatureTick, classifyUnderwaterAttack, DISEASES, POISONS, POISON_VECTORS } from '../src/hazards.js';

const baseActor = (overrides = {}) => ({
  id: 'pc',
  abilityScores: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
  exhaustion: 0,
  ...overrides
});

test('DISEASES and POISONS ship with canonical SRD entries', () => {
  assert.ok(DISEASES['sewer-plague']);
  assert.ok(DISEASES['cackle-fever']);
  assert.ok(POISONS['serpent-venom']);
  assert.ok(POISONS['malice-powder']);
  assert.ok(POISONS['oil-of-taggit']);
  assert.ok(POISONS['pale-tincture']);
});

test('POISON_VECTORS lists the four SRD delivery vectors', () => {
  assert.deepEqual([...POISON_VECTORS], ['contact', 'ingested', 'inhaled', 'injury']);
});

test('exposure rolls the onset save and returns a save+effect pair', () => {
  const lowRoll = () => 0.01;
  const r = exposure({ actor: baseActor(), hazard: DISEASES['sewer-plague'] }, lowRoll);
  assert.equal(r.contracted, true);
  assert.equal(r.save.success, false);
  assert.deepEqual(r.effect, { exhaustionDelta: 1 });
});

test('exposure returns onSuccess effect when the save succeeds', () => {
  const highRoll = () => 0.99;
  const r = exposure({ actor: baseActor(), hazard: POISONS['serpent-venom'] }, highRoll);
  assert.equal(r.contracted, false);
  assert.equal(r.save.success, true);
  assert.deepEqual(r.effect, { damageDice: '1d6', damageType: 'poison' });
});

test('exposure tolerates hazards with no onSuccess effect', () => {
  const highRoll = () => 0.99;
  const r = exposure({ actor: baseActor(), hazard: DISEASES['sewer-plague'] }, highRoll);
  assert.equal(r.effect, null);
});

test('exposure tolerates hazards with no onFailure effect', () => {
  const lowRoll = () => 0.01;
  const hazard = {
    id: 'cosmetic', name: 'Cosmetic',
    onsetSave: { ability: 'con', dc: 11 }
  };
  const r = exposure({ actor: baseActor(), hazard }, lowRoll);
  assert.equal(r.contracted, true);
  assert.equal(r.effect, null);
});

test('exposure falls back to abilityScore=10 when the actor has no scores', () => {
  const noScores = { id: 'pc' };
  const lowRoll = () => 0.01;
  const r = exposure({ actor: noScores, hazard: DISEASES['sewer-plague'] }, lowRoll);
  assert.equal(r.contracted, true);
});

test('exposure throws on a malformed hazard with no save block', () => {
  assert.throws(
    () => exposure({ actor: baseActor(), hazard: { id: 'broken' } }),
    /onsetSave or save/
  );
});

test('tickPoison decrements roundsRemaining and flags expired', () => {
  let state = { roundsRemaining: 2 };
  state = tickPoison(state);
  assert.equal(state.roundsRemaining, 1);
  assert.equal(state.expired, false);
  state = tickPoison(state);
  assert.equal(state.roundsRemaining, 0);
  assert.equal(state.expired, true);
});

test('tickPoison floors at zero when called past expiry', () => {
  const state = tickPoison({ roundsRemaining: 0 });
  assert.equal(state.roundsRemaining, 0);
  assert.equal(state.expired, true);
});

test('tickPoison defaults missing roundsRemaining to zero', () => {
  const state = tickPoison({});
  assert.equal(state.roundsRemaining, 0);
  assert.equal(state.expired, true);
});

test('holdBreathRounds = 10 * (1 + CON mod), with a floor of 1', () => {
  assert.equal(holdBreathRounds(0), 10);
  assert.equal(holdBreathRounds(3), 40);
  assert.equal(holdBreathRounds(-5), 1);
});

test('tickSuffocation flags outOfBreath when the counter hits 0', () => {
  let state = { breathLeftRounds: 2 };
  state = tickSuffocation(state);
  assert.equal(state.outOfBreath, false);
  state = tickSuffocation(state);
  assert.equal(state.outOfBreath, true);
  assert.equal(state.breathLeftRounds, 0);
});

test('tickSuffocation defaults missing breathLeftRounds to 0', () => {
  const state = tickSuffocation({});
  assert.equal(state.outOfBreath, true);
});

test('starvation: no exhaustion within the grace period', () => {
  const r = starvationTick(baseActor(), { daysWithoutFood: 2 });
  assert.equal(r.actor.exhaustion, 0);
  assert.equal(r.reason, null);
});

test('starvation: exhaustion past the grace period', () => {
  const r = starvationTick(baseActor(), { daysWithoutFood: 5 });
  assert.equal(r.actor.exhaustion, 1);
  assert.equal(r.reason, 'starvation');
});

test('thirst on day 1 triggers a DC 15 CON save; failure costs exhaustion', () => {
  const lowRoll = () => 0.01;
  const r = starvationTick(baseActor(), { daysWithoutWater: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
  assert.equal(r.reason, 'thirst');
});

test('thirst save success leaves the actor untouched', () => {
  const highRoll = () => 0.99;
  const r = starvationTick(baseActor(), { daysWithoutWater: 1 }, highRoll);
  assert.equal(r.actor.exhaustion, 0);
  assert.equal(r.reason, null);
});

test('starvation + thirst together produce a combined reason tag', () => {
  const lowRoll = () => 0.01;
  const r = starvationTick(baseActor(), { daysWithoutFood: 5, daysWithoutWater: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 2);
  assert.equal(r.reason, 'starvation+thirst');
});

test('starvation defaults to no missed days when no args supplied', () => {
  const r = starvationTick(baseActor());
  assert.equal(r.actor.exhaustion, 0);
});

test('starvation grace period accounts for CON modifier', () => {
  const robust = baseActor({ abilityScores: { ...baseActor().abilityScores, con: 18 } });
  // CON 18 => +4 => grace = 5 days; day 5 is still fine, day 6 is not.
  assert.equal(starvationTick(robust, { daysWithoutFood: 5 }).actor.exhaustion, 0);
  assert.equal(starvationTick(robust, { daysWithoutFood: 6 }).actor.exhaustion, 1);
});

test('starvation handles an actor with no abilityScores via fallback grace', () => {
  const noScores = { id: 'pc', exhaustion: 0 };
  // No abilityScores means CON mod = 0, grace = 1 day; day 2 should fail.
  assert.equal(starvationTick(noScores, { daysWithoutFood: 2 }).actor.exhaustion, 1);
});

test('thirst save with no abilityScores routes through the CON=10 fallback', () => {
  const noScores = { id: 'pc', exhaustion: 0 };
  const lowRoll = () => 0.01;
  const r = starvationTick(noScores, { daysWithoutWater: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
});

test('extreme temperature: success leaves the actor alone', () => {
  const highRoll = () => 0.99;
  const r = extremeTemperatureTick(baseActor(), { hoursExposed: 1 }, highRoll);
  assert.equal(r.actor.exhaustion, 0);
  assert.equal(r.save.success, true);
});

test('extreme temperature: failure costs one exhaustion', () => {
  const lowRoll = () => 0.01;
  const r = extremeTemperatureTick(baseActor(), { hoursExposed: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
  assert.equal(r.save.success, false);
});

test('extreme temperature: DC ramps by hour exposed', () => {
  const lowRoll = () => 0.01;
  const five = extremeTemperatureTick(baseActor(), { hoursExposed: 5 }, lowRoll);
  assert.equal(five.save.dc, 9);
});

test('extreme temperature: acclimatised gear lowers DC by 5', () => {
  const r = extremeTemperatureTick(baseActor(), { hoursExposed: 1, gearAcclimatised: true }, () => 0.5);
  assert.equal(r.save.dc, 5); // base 5, clamped at 5 (DC floor)
});

test('extreme temperature: zero hours short-circuits to no save', () => {
  const r = extremeTemperatureTick(baseActor(), { hoursExposed: 0 });
  assert.equal(r.save, null);
  assert.equal(r.actor.exhaustion, 0);
});

test('extreme temperature: default opts treat the call as one-hour exposure', () => {
  const lowRoll = () => 0.01;
  const r = extremeTemperatureTick(baseActor(), undefined, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
});

test('extreme temperature: actor without CON score falls back to 10', () => {
  const noScores = { id: 'pc', exhaustion: 0 };
  const lowRoll = () => 0.01;
  const r = extremeTemperatureTick(noScores, { hoursExposed: 1 }, lowRoll);
  assert.equal(r.actor.exhaustion, 1);
});

test('classifyUnderwaterAttack: melee with a listed weapon resolves normally', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'trident', attackKind: 'melee' });
  assert.equal(r.stance, 'normal');
  assert.equal(r.autoMiss, false);
});

test('classifyUnderwaterAttack: melee with a non-listed weapon takes disadvantage', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'greataxe', attackKind: 'melee' });
  assert.equal(r.stance, 'disadvantage');
  assert.equal(r.autoMiss, false);
});

test('classifyUnderwaterAttack: ranged beyond normal range auto-misses', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'longbow', attackKind: 'ranged', beyondNormalRange: true });
  assert.equal(r.autoMiss, true);
});

test('classifyUnderwaterAttack: ranged listed weapon at normal range hits normally', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'crossbow-light', attackKind: 'ranged' });
  assert.equal(r.stance, 'normal');
  assert.equal(r.autoMiss, false);
});

test('classifyUnderwaterAttack: ranged non-listed weapon at normal range takes disadvantage', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'longbow', attackKind: 'ranged' });
  assert.equal(r.stance, 'disadvantage');
  assert.equal(r.autoMiss, false);
});

test('classifyUnderwaterAttack: fire damage always rolls at disadvantage underwater', () => {
  const r = classifyUnderwaterAttack({ weaponId: 'longsword', attackKind: 'melee', damageType: 'fire' });
  assert.equal(r.stance, 'disadvantage');
  assert.equal(r.autoMiss, false);
});

test('classifyUnderwaterAttack: unknown attackKind throws', () => {
  assert.throws(
    () => classifyUnderwaterAttack({ weaponId: 'longsword', attackKind: 'thrown' }),
    /melee or ranged/
  );
});

test('engine.Hazards binds the seeded rng so exposure rolls land in the log', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const logBefore = engine.rollLog.length;
  engine.Hazards.exposure({
    actor: baseActor(),
    hazard: engine.Hazards.POISONS['serpent-venom']
  });
  assert.ok(engine.rollLog.length > logBefore);
});

test('engine.Hazards exposes the registries through the bound namespace', () => {
  const engine = createEngine();
  assert.ok(engine.Hazards.DISEASES['sewer-plague']);
  assert.ok(engine.Hazards.POISONS['malice-powder']);
  assert.deepEqual([...engine.Hazards.POISON_VECTORS], ['contact', 'ingested', 'inhaled', 'injury']);
  assert.deepEqual([...engine.Hazards.UNDERWATER_RESISTED_DAMAGE], ['fire']);
});

test('engine.Hazards.starvationTick routes saves through the engine rng', () => {
  const engine = createEngine({ rng: Dice.seededRng(7) });
  const logBefore = engine.rollLog.length;
  engine.Hazards.starvationTick(baseActor(), { daysWithoutWater: 1 });
  assert.ok(engine.rollLog.length > logBefore);
});

test('engine.Hazards.extremeTemperatureTick routes saves through the engine rng', () => {
  const engine = createEngine({ rng: Dice.seededRng(7) });
  const logBefore = engine.rollLog.length;
  engine.Hazards.extremeTemperatureTick(baseActor(), { hoursExposed: 2 });
  assert.ok(engine.rollLog.length > logBefore);
});
