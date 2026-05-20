// Extra replay-verifier tests covering branches that the
// integration test happens not to exercise: advantage / disadvantage
// stance replay, cancelled-attack replay, and a stance-less entry
// (pre-0.7 log format).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';
import { Dice, verifyLog } from '../index.js';

test('verifyLog reproduces an attack rolled at advantage', () => {
  const e = createEngine({ rng: Dice.seededRng(101) });
  // Target paralyzed → target advantage → attacker rolls 2 d20s.
  e.Combat.attackRoll({
    attackBonus: 3, ac: 12,
    target: { conditions: ['paralyzed'] }
  });
  const r = verifyLog({ seed: 101, log: e.rollLog });
  assert.equal(r.ok, true);
});

test('verifyLog reproduces an attack rolled at disadvantage', () => {
  const e = createEngine({ rng: Dice.seededRng(102) });
  e.Combat.attackRoll({
    attackBonus: 3, ac: 12,
    attacker: { conditions: ['blinded'] }
  });
  const r = verifyLog({ seed: 102, log: e.rollLog });
  assert.equal(r.ok, true);
});

test('verifyLog skips cancelled-attack entries', () => {
  const e = createEngine({
    rng: Dice.seededRng(103),
    hooks: { beforeAttack: () => ({ cancelled: true }) }
  });
  e.Combat.attackRoll({ attackBonus: 0, ac: 10 });
  // No d20 rolled — log entry has cancelled:true; replay just skips it.
  const r = verifyLog({ seed: 103, log: e.rollLog });
  assert.equal(r.ok, true);
});

test('verifyLog tolerates a stance-less entry (defaulting to normal)', () => {
  // Construct a log entry by hand to simulate a pre-0.7 log that
  // never carried a stance field. The replay defaults to 'normal'.
  const e = createEngine({ rng: Dice.seededRng(104) });
  e.Combat.attackRoll({ attackBonus: 0, ac: 10 });
  const log = e.rollLog.map((entry) => {
    if (entry.op !== 'attackRoll') return entry;
    const { stance, ...rest } = entry;
    return rest;
  });
  const r = verifyLog({ seed: 104, log });
  assert.equal(r.ok, true);
});
