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

// ─── verifyLog totality ──────────────────────────────────────────────────────
//
// verifyLog threw `Cannot replay unknown roll op` on three ops the engine
// itself records: deathSave, mechanicApplied and hookFired. A downed character
// is not an edge case, so in practice any real session was unverifiable — and
// downstream hosts worked around it by re-encoding death saves as bare d20s
// rather than reusing the engine's own log. A verifier that cannot verify the
// logs its own recorder produces is not a verifier.

test('verifyLog replays a death save', () => {
  const e = createEngine({ rng: Dice.seededRng(7), logRolls: true });
  e.Combat.deathSave({ deathSaves: { successes: 0, failures: 0, stable: false, dead: false } });
  assert.ok(e.rollLog.some(r => r.op === 'deathSave'), 'the engine must record the save');
  assert.equal(verifyLog({ seed: 7, log: e.rollLog }).ok, true);
});

test('verifyLog replays a death save mid-tracker, checking the outcome', () => {
  const e = createEngine({ rng: Dice.seededRng(99), logRolls: true });
  // Two failures already banked: the entry snapshots them, so replay must
  // rebuild the same tracker or the outcome will not match.
  e.Combat.deathSave({ deathSaves: { successes: 0, failures: 2, stable: false, dead: false } });
  assert.equal(verifyLog({ seed: 99, log: e.rollLog }).ok, true);
});

test('verifyLog catches a tampered death save', () => {
  const e = createEngine({ rng: Dice.seededRng(7), logRolls: true });
  e.Combat.deathSave({ deathSaves: { successes: 0, failures: 0, stable: false, dead: false } });
  const log = e.rollLog.map(r => r.op === 'deathSave' ? { ...r, d20: 20, outcome: 'revived' } : r);
  const res = verifyLog({ seed: 7, log });
  assert.equal(res.ok, false, 'a forged nat 20 must not verify');
});

test('verifyLog skips bookkeeping ops that draw no dice', () => {
  // A real recorded draw, with the shapes the engine records for a fired hook
  // and an applied class mechanic spliced around it. Either one used to throw.
  const e = createEngine({ rng: Dice.seededRng(3), logRolls: true });
  e.Dice.rollDie(20);
  const log = [
    { op: 'hookFired', event: 'onDeath', handlerCount: 1 },
    ...e.rollLog,
    { op: 'mechanicApplied', classId: 'fighter', subclassId: null, mechanic: 'second-wind', ok: true },
  ];
  assert.equal(verifyLog({ seed: 3, log }).ok, true);
});

test('a session mixing dice, a mechanic and a death save verifies whole', () => {
  const e = createEngine({ rng: Dice.seededRng(2024), logRolls: true });
  e.Combat.attackRoll({ attackBonus: 4, ac: 13 });
  e.Checks.abilityCheck({ abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 12 });
  e.Combat.deathSave({ deathSaves: { successes: 1, failures: 1, stable: false, dead: false } });
  const res = verifyLog({ seed: 2024, log: e.rollLog });
  assert.equal(res.ok, true, res.ok ? '' : `diverged at ${res.divergedAt}`);
});

test('verifyLog still refuses an op it genuinely cannot replay', () => {
  assert.throws(() => verifyLog({ seed: 1, log: [{ op: 'consultTheOracle' }] }),
    /Cannot replay unknown roll op/);
});
