import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seededRng,
  rollDie,
  roll,
  rollAdvantage,
  rollDisadvantage
} from '../src/dice.js';
import { abilityCheck, savingThrow } from '../src/checks.js';
import { attackRoll, damageRoll, rollInitiative } from '../src/combat.js';
import { createEngine, verifyLog, Dice } from '../index.js';

// ============================================================
// Pinned seed → output pairs.
// These tests lock the Mulberry32 implementation as a public
// contract. Changing the algorithm — even to a "better" one — will
// fail these tests loud, which is the point: same-seed sequences
// across versions are part of the library's promise.
// ============================================================

test('seededRng(42) emits the canonical first five floats', () => {
  const rng = seededRng(42);
  const got = Array.from({ length: 5 }, () => rng());
  assert.deepEqual(got, [
    0.6011037519201636,
    0.44829055899754167,
    0.8524657934904099,
    0.6697340414393693,
    0.17481389874592423
  ]);
});

test('seededRng(42) + rollDie(20) — pinned d20 sequence', () => {
  const rng = seededRng(42);
  const d20s = Array.from({ length: 10 }, () => rollDie(20, rng));
  assert.deepEqual(d20s, [13, 9, 18, 14, 4, 11, 6, 13, 18, 10]);
});

test('seededRng(0) — handles the edge seed', () => {
  const rng = seededRng(0);
  const d6s = Array.from({ length: 5 }, () => rollDie(6, rng));
  assert.deepEqual(d6s, [2, 1, 2, 1, 3]);
});

test('seededRng(2026) + rollDie(100) — pinned percentile sequence', () => {
  const rng = seededRng(2026);
  const d100s = Array.from({ length: 3 }, () => rollDie(100, rng));
  assert.deepEqual(d100s, [46, 31, 67]);
});

test('roll(spec) — pinned 3d6+2 outcome at seed 42', () => {
  const rng = seededRng(42);
  const result = roll('3d6+2', rng);
  assert.deepEqual(result.rolls, [4, 3, 6]);
  assert.equal(result.total, 15);
});

test('rollAdvantage + rollDisadvantage — pinned at seed 42', () => {
  // Advantage keeps the higher of two full-expression rolls.
  const adv = rollAdvantage('1d20+5', seededRng(42));
  assert.equal(adv.total, 18);
  // Disadvantage keeps the lower.
  const dis = rollDisadvantage('1d20+5', seededRng(42));
  assert.equal(dis.total, 14);
});

// ============================================================
// Determinism: same seed → identical sequences across instances.
// ============================================================

test('two rngs with the same seed produce identical sequences', () => {
  const a = seededRng(7);
  const b = seededRng(7);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b(), `divergence at step ${i}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = seededRng(1);
  const b = seededRng(2);
  let firstDifferenceAt = -1;
  for (let i = 0; i < 10; i++) {
    if (a() !== b()) { firstDifferenceAt = i; break; }
  }
  assert.notEqual(firstDifferenceAt, -1, 'sequences should diverge quickly');
});

test('rng output is always in [0, 1)', () => {
  const rng = seededRng(12345);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of [0, 1)`);
  }
});

test('rng handles negative seeds via unsigned coercion', () => {
  // Mulberry32's state is `(seed | 0) >>> 0`, so -1 maps to 0xFFFFFFFF.
  // The sequence should be deterministic, just different from seed 1.
  const a = Array.from({ length: 3 }, (() => { const r = seededRng(-1); return () => r(); })());
  const b = Array.from({ length: 3 }, (() => { const r = seededRng(-1); return () => r(); })());
  assert.deepEqual(a, b);
});

// ============================================================
// rng cascades correctly through every rolling function.
// ============================================================

test('rollDie defaults to Math.random when no rng is supplied', (t) => {
  // Replace Math.random to a known constant via the test mock so we
  // can prove rollDie reads it.
  t.mock.method(Math, 'random', () => 0.5);
  assert.equal(rollDie(20), 11);  // 1 + floor(0.5 * 20) = 1 + 10 = 11
});

test('attackRoll uses the seeded rng end-to-end', () => {
  const result = attackRoll({ attackBonus: 5, ac: 14 }, seededRng(42));
  assert.equal(result.d20, 13);                       // pinned
  assert.equal(result.total, 18);
  assert.equal(result.hit, true);
});

test('damageRoll uses the seeded rng end-to-end', () => {
  const result = damageRoll({ damageDice: '1d8', damageMod: 3 }, seededRng(42));
  assert.deepEqual(result.baseRolls, [5]);            // pinned
  assert.equal(result.total, 8);
});

test('rollInitiative uses the seeded rng', () => {
  const init = rollInitiative({ dexterity: 16 }, seededRng(42));
  assert.equal(init, 16);                             // 13 + 3
});

test('abilityCheck uses the seeded rng', () => {
  const chk = abilityCheck(
    { abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 13 },
    seededRng(42)
  );
  assert.equal(chk.d20, 13);
  assert.equal(chk.success, true);
});

test('savingThrow uses the seeded rng', () => {
  const save = savingThrow({ abilityScore: 14, dc: 10 }, seededRng(42));
  assert.equal(save.d20, 13);
});

// ============================================================
// Engine-bound: rng + rollLog + onRoll + context.
// ============================================================

test('engine with seeded rng produces deterministic operations', () => {
  const e1 = createEngine({ rng: Dice.seededRng(42) });
  const e2 = createEngine({ rng: Dice.seededRng(42) });
  const r1 = e1.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  const r2 = e2.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  assert.deepEqual(r1, r2);
});

test('engine.rollLog accumulates one entry per logged operation', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  assert.deepEqual(e.rollLog, []);
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  e.Combat.damageRoll({ damageDice: '1d8', damageMod: 3 });
  assert.equal(e.rollLog.length, 2);
  assert.equal(e.rollLog[0].op, 'attackRoll');
  assert.equal(e.rollLog[1].op, 'damageRoll');
});

test('entry.index is monotonic across operations', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  e.Dice.roll('3d6');
  e.Combat.rollInitiative({ dexterity: 14 });
  assert.deepEqual(e.rollLog.map(x => x.index), [0, 1, 2]);
});

test('onRoll callback fires after each logged operation', () => {
  const captured = [];
  const e = createEngine({
    rng: Dice.seededRng(42),
    onRoll: (entry) => captured.push(entry)
  });
  e.Dice.rollDie(20);
  e.Dice.roll('1d6');
  assert.equal(captured.length, 2);
  assert.equal(captured[0].op, 'rollDie');
  assert.equal(captured[1].op, 'roll');
});

test('context attaches to the log entry when provided', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20, 'attack vs orc');
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 }, 'turn 14');
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 }, { actor: 'pc', why: 'lockpick' });
  assert.equal(e.rollLog[0].context, 'attack vs orc');
  assert.equal(e.rollLog[1].context, 'turn 14');
  assert.deepEqual(e.rollLog[2].context, { actor: 'pc', why: 'lockpick' });
});

test('context is absent (no key) when not provided', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  assert.equal('context' in e.rollLog[0], false);
});

test('rollLogCap drops the oldest entries on overflow', () => {
  const e = createEngine({ rng: Dice.seededRng(42), rollLogCap: 3 });
  for (let i = 0; i < 5; i++) e.Dice.rollDie(20);
  assert.equal(e.rollLog.length, 3);
  // Index field is monotonic — dropped entries don't reset positions.
  assert.deepEqual(e.rollLog.map(x => x.index), [2, 3, 4]);
});

test('engines are isolated: separate rngs and logs', () => {
  const a = createEngine({ rng: Dice.seededRng(1) });
  const b = createEngine({ rng: Dice.seededRng(2) });
  a.Dice.rollDie(20);
  assert.equal(a.rollLog.length, 1);
  assert.equal(b.rollLog.length, 0);
});

test('every rolling op type appears in the log with the right shape', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  e.Dice.roll('1d6');
  e.Dice.rollAdvantage('1d20');
  e.Dice.rollDisadvantage('1d20');
  e.Combat.rollInitiative({ dexterity: 14 });
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  e.Combat.damageRoll({ damageDice: '1d8' });
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 });
  e.Checks.savingThrow({ abilityScore: 14, dc: 12 });

  const ops = e.rollLog.map(x => x.op);
  assert.deepEqual(ops, [
    'rollDie',
    'roll',
    'rollAdvantage',
    'rollDisadvantage',
    'rollInitiative',
    'attackRoll',
    'damageRoll',
    'abilityCheck',
    'savingThrow'
  ]);
});

// ============================================================
// verifyLog — replay verification.
// ============================================================

test('verifyLog returns ok:true for a clean log', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  e.Combat.damageRoll({ damageDice: '1d8', damageMod: 3 });
  e.Dice.rollAdvantage('1d20+5');
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 });

  const result = verifyLog({ seed: 42, log: e.rollLog });
  assert.equal(result.ok, true);
});

test('engine.verifyLog method is identical to the module-level export', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  assert.equal(e.verifyLog, verifyLog);
});

test('verifyLog detects a single-value tamper at the rollDie level', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  e.Dice.rollDie(20);

  // Forge the second entry to a value the seed wouldn't produce.
  const tampered = [...e.rollLog];
  tampered[1] = { ...tampered[1], value: 1 };

  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.divergedAt, 1);
  }
});

test('verifyLog detects tamper in an aggregate roll', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.roll('3d6');

  const tampered = [...e.rollLog];
  tampered[0] = { ...tampered[0], total: 999 };

  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog detects tamper in attackRoll d20 face', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });

  const tampered = [{ ...e.rollLog[0], d20: 1, hit: false }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog covers every op type via end-to-end replay', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDie(20);
  e.Dice.roll('1d6');
  e.Dice.rollAdvantage('1d20');
  e.Dice.rollDisadvantage('1d20');
  e.Combat.rollInitiative({ dexterity: 14 });
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });
  e.Combat.damageRoll({ damageDice: '1d8' });
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 });
  e.Checks.savingThrow({ abilityScore: 14, dc: 12 });

  const result = verifyLog({ seed: 42, log: e.rollLog });
  assert.equal(result.ok, true);
});

test('verifyLog detects wrong-seed replays', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.attackRoll({ attackBonus: 5, ac: 14 });

  const result = verifyLog({ seed: 999, log: e.rollLog });
  assert.equal(result.ok, false);
});

test('verifyLog throws on an unknown op (forwards-incompat log)', () => {
  const log = [{ index: 0, op: 'fictionalOp', sides: 20, value: 7 }];
  assert.throws(() => verifyLog({ seed: 42, log }), /Cannot replay unknown roll op/);
});

test('verifyLog accepts an empty log as trivially ok', () => {
  const result = verifyLog({ seed: 42, log: [] });
  assert.equal(result.ok, true);
});

// ============================================================
// Cross-version safety: damageRoll critical replay.
// damageRoll's critical-flag isn't directly in the log; the
// verifier infers it from critRolls.length > 0. Verify that path.
// ============================================================

test('verifyLog replays a critical damageRoll correctly', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.damageRoll({ damageDice: '1d8', damageMod: 3, critical: true });
  assert.ok(e.rollLog[0].critRolls.length > 0);

  const result = verifyLog({ seed: 42, log: e.rollLog });
  assert.equal(result.ok, true);
});

test('verifyLog detects tamper in damageRoll baseRolls', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.damageRoll({ damageDice: '1d8' });
  const tampered = [{ ...e.rollLog[0], baseRolls: [99], total: 99 }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

// Divergence-path coverage for every op type. Each test forges one
// field of a recorded entry and asserts the verifier flags it.

test('verifyLog detects tamper in rollAdvantage', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollAdvantage('1d20+5');
  const tampered = [{ ...e.rollLog[0], total: 999 }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog detects tamper in rollDisadvantage', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Dice.rollDisadvantage('1d20+5');
  const tampered = [{ ...e.rollLog[0], total: 999 }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog detects tamper in rollInitiative value', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Combat.rollInitiative({ dexterity: 16 });
  const tampered = [{ ...e.rollLog[0], value: 99 }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog detects tamper in abilityCheck success', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 });
  const tampered = [{ ...e.rollLog[0], success: !e.rollLog[0].success }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});

test('verifyLog detects tamper in savingThrow d20', () => {
  const e = createEngine({ rng: Dice.seededRng(42) });
  e.Checks.savingThrow({ abilityScore: 14, dc: 12 });
  const tampered = [{ ...e.rollLog[0], d20: 99, success: true }];
  const result = verifyLog({ seed: 42, log: tampered });
  assert.equal(result.ok, false);
});
