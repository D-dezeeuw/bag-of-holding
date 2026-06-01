// === 1.23.0 audit / replay surface completion ===

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';

test('mechanicApplied entries land after the inner rolls', () => {
  const engine = createEngine({ rng: Dice.seededRng(99) });
  const actor = {
    classId: 'fighter', level: 1,
    abilityScores: { con: 12 }, hp: 5, hpMax: 30,
    resources: engine.Mechanics.freshResources(engine.classes.fighter, 1)
  };
  engine.Mechanics.apply(actor, 'secondWind');
  const last = engine.rollLog.at(-1);
  assert.equal(last.op, 'mechanicApplied');
  assert.equal(last.classId, 'fighter');
  assert.equal(last.mechanic, 'secondWind');
  assert.equal(last.ok, true);
});

test('mechanicApplied includes subclassId when actor.subclassId is set', () => {
  const engine = createEngine();
  const actor = { classId: 'fighter', subclassId: 'champion' };
  engine.Mechanics.apply(actor, 'improvedCritOn', { level: 3 });
  const last = engine.rollLog.at(-1);
  assert.equal(last.subclassId, 'champion');
});

test('mechanicApplied records ok: true for mechanics with no ok field', () => {
  const engine = createEngine();
  const actor = { classId: 'rogue', subclassId: 'thief' };
  engine.Mechanics.apply(actor, 'fastHands');
  const last = engine.rollLog.at(-1);
  assert.equal(last.ok, true);
});

test('mechanicApplied records ok: false when the resource is exhausted', () => {
  const engine = createEngine();
  const actor = {
    classId: 'fighter', level: 1,
    resources: { secondWind: { used: 1, max: 1, refreshes: 'short' } },
    hp: 5, hpMax: 30
  };
  engine.Mechanics.apply(actor, 'secondWind');
  const last = engine.rollLog.at(-1);
  assert.equal(last.op, 'mechanicApplied');
  assert.equal(last.ok, false);
});

test('hookFired entries land in the log when opts.logHooks is set', () => {
  const engine = createEngine({
    logHooks: true,
    hooks: {
      beforeAttack: ({ ac }) => ({ ac: ac + 1 })
    }
  });
  const logBefore = engine.rollLog.length;
  engine.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  const hookEntries = engine.rollLog.slice(logBefore).filter((e) => e.op === 'hookFired');
  assert.ok(hookEntries.length > 0);
  assert.equal(hookEntries[0].event, 'beforeAttack');
  assert.equal(hookEntries[0].handlerCount, 1);
});

test('hookFired skips events with no registered handlers', () => {
  const engine = createEngine({
    logHooks: true,
    hooks: { beforeAttack: ({ ac }) => ({ ac: ac + 1 }) }
  });
  const logBefore = engine.rollLog.length;
  // afterDamage isn't registered; ensure no hookFired entry appears.
  engine.Combat.damageRoll({ damageDice: '1d6', damageMod: 0 });
  const fires = engine.rollLog.slice(logBefore).filter((e) => e.op === 'hookFired' && e.event === 'afterDamage');
  assert.equal(fires.length, 0);
});

test('rulesFingerprint is exposed on the engine and stable for identical rules', () => {
  const a = createEngine();
  const b = createEngine();
  assert.equal(typeof a.rulesFingerprint, 'string');
  assert.equal(a.rulesFingerprint.length, 8);
  assert.equal(a.rulesFingerprint, b.rulesFingerprint);
});

test('rulesFingerprint changes when a rule knob changes', () => {
  const a = createEngine();
  const b = createEngine({ rules: { critOn: [19, 20] } });
  assert.notEqual(a.rulesFingerprint, b.rulesFingerprint);
});

test('deathSave log entries carry previousSuccesses and previousFailures', () => {
  const engine = createEngine({ rng: Dice.seededRng(5) });
  const actor = {
    classId: 'fighter', level: 1, hp: 0,
    deathSaves: { successes: 1, failures: 2 },
    abilityScores: { con: 12 }
  };
  engine.Combat.deathSave(actor);
  const last = engine.rollLog.findLast((e) => e.op === 'deathSave');
  assert.equal(last.previousSuccesses, 1);
  assert.equal(last.previousFailures, 2);
});

test('deathSave previous-state snapshot defaults to zero when no tracker exists', () => {
  const engine = createEngine({ rng: Dice.seededRng(5) });
  const actor = { classId: 'fighter', level: 1, hp: 0, abilityScores: { con: 12 } };
  engine.Combat.deathSave(actor);
  const last = engine.rollLog.findLast((e) => e.op === 'deathSave');
  assert.equal(last.previousSuccesses, 0);
  assert.equal(last.previousFailures, 0);
});
