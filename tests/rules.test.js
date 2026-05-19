import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES, buildRules } from '../src/rules.js';
import { seededRng, rollExplosive } from '../src/dice.js';
import { attackRoll, damageRoll } from '../src/combat.js';
import { levelForXP, nextLevelThreshold, awardMilestone } from '../src/xp.js';
import {
  createEngine,
  verifyLog,
  Dice
} from '../index.js';

// ============================================================
// DEFAULT_RULES — frozen, has the documented shape.
// ============================================================

test('DEFAULT_RULES exposes the documented SRD 5.2 baseline', () => {
  assert.deepEqual([...DEFAULT_RULES.critOn], [20]);
  assert.deepEqual([...DEFAULT_RULES.fumbleOn], [1]);
  assert.equal(DEFAULT_RULES.damageFloor, 1);
  assert.equal(DEFAULT_RULES.explodingDamageDice, false);
  assert.equal(DEFAULT_RULES.xpThresholds, null);
  assert.equal(DEFAULT_RULES.proficiencyByLevel, null);
});

test('DEFAULT_RULES is frozen, including nested arrays', () => {
  assert.equal(Object.isFrozen(DEFAULT_RULES), true);
  assert.equal(Object.isFrozen(DEFAULT_RULES.critOn), true);
  assert.equal(Object.isFrozen(DEFAULT_RULES.fumbleOn), true);
});

// ============================================================
// buildRules — defaults pass through, overrides merge.
// ============================================================

test('buildRules with no input returns the default shape', () => {
  const r = buildRules();
  assert.deepEqual([...r.critOn], [20]);
  assert.deepEqual([...r.fumbleOn], [1]);
  assert.equal(r.damageFloor, 1);
  assert.equal(r.explodingDamageDice, false);
});

test('buildRules merges custom critOn and preserves other defaults', () => {
  const r = buildRules({ critOn: [19, 20] });
  assert.deepEqual([...r.critOn], [19, 20]);
  assert.deepEqual([...r.fumbleOn], [1]);   // default still
});

test('buildRules accepts custom xpThresholds and proficiencyByLevel maps', () => {
  const xp = { 1: 0, 2: 1000 };
  const prof = { 1: 2, 2: 2 };
  const r = buildRules({ xpThresholds: xp, proficiencyByLevel: prof });
  assert.deepEqual(r.xpThresholds, xp);
  assert.deepEqual(r.proficiencyByLevel, prof);
});

test('buildRules freezes its output (depth 2)', () => {
  const r = buildRules({ critOn: [19, 20], xpThresholds: { 1: 0, 2: 500 } });
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.critOn), true);
  assert.equal(Object.isFrozen(r.xpThresholds), true);
});

test('buildRules accepts explicit null for xpThresholds/proficiencyByLevel', () => {
  const r = buildRules({ xpThresholds: null, proficiencyByLevel: null });
  assert.equal(r.xpThresholds, null);
  assert.equal(r.proficiencyByLevel, null);
});

// === Validation: every error path ===

test('buildRules rejects non-object input', () => {
  assert.throws(() => buildRules(null), /must be an object/);
  assert.throws(() => buildRules('grim'), /must be an object/);
  assert.throws(() => buildRules([]), /must be an object/);
});

test('buildRules rejects malformed critOn / fumbleOn', () => {
  assert.throws(() => buildRules({ critOn: 'twenty' }), /critOn/);
  assert.throws(() => buildRules({ critOn: [0] }), /critOn/);           // out of range
  assert.throws(() => buildRules({ critOn: [21] }), /critOn/);          // out of range
  assert.throws(() => buildRules({ critOn: [20.5] }), /critOn/);        // not integer
  assert.throws(() => buildRules({ fumbleOn: 'one' }), /fumbleOn/);
  assert.throws(() => buildRules({ fumbleOn: [0] }), /fumbleOn/);
});

test('buildRules rejects malformed damageFloor', () => {
  assert.throws(() => buildRules({ damageFloor: -1 }), /damageFloor/);
  assert.throws(() => buildRules({ damageFloor: 1.5 }), /damageFloor/);
  assert.throws(() => buildRules({ damageFloor: '1' }), /damageFloor/);
});

test('buildRules rejects non-boolean explodingDamageDice', () => {
  assert.throws(() => buildRules({ explodingDamageDice: 'yes' }), /explodingDamageDice/);
  assert.throws(() => buildRules({ explodingDamageDice: 1 }), /explodingDamageDice/);
});

test('buildRules rejects malformed xpThresholds', () => {
  assert.throws(() => buildRules({ xpThresholds: 'fast' }), /xpThresholds/);
  assert.throws(() => buildRules({ xpThresholds: [] }), /xpThresholds/);
  assert.throws(() => buildRules({ xpThresholds: { 0: 100 } }), /xpThresholds/);   // level 0 invalid
  assert.throws(() => buildRules({ xpThresholds: { 1: -5 } }), /xpThresholds/);    // negative xp
  assert.throws(() => buildRules({ xpThresholds: { 1: 1.5 } }), /xpThresholds/);   // non-integer
});

test('buildRules rejects malformed proficiencyByLevel', () => {
  assert.throws(() => buildRules({ proficiencyByLevel: 'auto' }), /proficiencyByLevel/);
  assert.throws(() => buildRules({ proficiencyByLevel: { 1: -1 } }), /proficiencyByLevel/);
  assert.throws(() => buildRules({ proficiencyByLevel: { 1: 2.5 } }), /proficiencyByLevel/);
});

// ============================================================
// rollExplosive — pinned outputs + chain behaviour.
// ============================================================

test('rollExplosive chains on max rolls (seed 42, 1d6 sequence)', () => {
  const rng = seededRng(42);
  // First few 1d6 outputs at seed 42: 4, 3, 6+5 (chain), 2, 4
  assert.deepEqual(rollExplosive('1d6', rng).rolls, [4]);
  assert.deepEqual(rollExplosive('1d6', rng).rolls, [3]);
  assert.deepEqual(rollExplosive('1d6', rng).rolls, [6, 5]);   // chain fired
  assert.deepEqual(rollExplosive('1d6', rng).rolls, [2]);
  assert.deepEqual(rollExplosive('1d6', rng).rolls, [4]);
});

test('rollExplosive returns the documented shape', () => {
  const rng = seededRng(1);
  const r = rollExplosive('2d6+3', rng);
  assert.equal(r.spec, '2d6+3');
  assert.ok(Array.isArray(r.rolls));
  assert.equal(r.modifier, 3);
  assert.equal(r.total, r.rolls.reduce((a, b) => a + b, 0) + 3);
});

test('rollExplosive without max never chains (rolls.length === count)', () => {
  // Mock Math.random to always return < 1/6 (so 1d6 always = 1)
  const tinyRng = () => 0.01;
  const r = rollExplosive('3d6', tinyRng);
  assert.equal(r.rolls.length, 3);
  assert.deepEqual(r.rolls, [1, 1, 1]);
});

// ============================================================
// attackRoll — critOn / fumbleOn knobs.
// ============================================================

test('attackRoll respects an extended crit range (Pathfinder-style 19-20)', () => {
  // Seed 4 produces a d20 of 19 on the first roll.
  const rules = buildRules({ critOn: [19, 20] });
  const result = attackRoll({ attackBonus: 0, ac: 99 }, seededRng(4), rules);
  assert.equal(result.d20, 19);
  assert.equal(result.critical, true);
  assert.equal(result.hit, true);                 // crit always hits
});

test('attackRoll under SRD defaults does NOT crit on 19', () => {
  const result = attackRoll({ attackBonus: 0, ac: 99 }, seededRng(4));
  assert.equal(result.d20, 19);
  assert.equal(result.critical, false);
  assert.equal(result.hit, false);                // 19 + 0 < 99
});

test('attackRoll respects custom fumbleOn list', () => {
  // Bad-luck pack: 1, 2, 3 all fumble.
  // Seed 42 → first d20 = 13, so no fumble. But seed where d20=2 should.
  const rules = buildRules({ fumbleOn: [1, 2, 3] });
  // Force a small d20 via a custom rng
  const tinyRng = () => 0.05;                     // d20 = 1 + floor(0.05 * 20) = 1 + 1 = 2
  const result = attackRoll({ attackBonus: 50, ac: 5 }, tinyRng, rules);
  assert.equal(result.d20, 2);
  assert.equal(result.fumble, true);
  assert.equal(result.hit, false);                // fumble always misses
});

// ============================================================
// damageRoll — damageFloor + explodingDamageDice knobs.
// ============================================================

test('damageRoll honours a custom damageFloor of 0', () => {
  // Defaults to 1; with floor=0, a deeply negative mod can produce 0.
  const rules = buildRules({ damageFloor: 0 });
  const tinyRng = () => 0;                        // every die = 1
  const result = damageRoll({ damageDice: '1d4', damageMod: -10 }, tinyRng, rules);
  assert.equal(result.total, 0);
});

test('damageRoll under default rules still floors at 1', () => {
  const tinyRng = () => 0;
  const result = damageRoll({ damageDice: '1d4', damageMod: -10 }, tinyRng);
  assert.equal(result.total, 1);                  // SRD baseline
});

test('damageRoll uses explosive dice when explodingDamageDice is on', () => {
  // Seed 42 + 1d6 yields a chain at the third call (6 → 5).
  const rules = buildRules({ explodingDamageDice: true });
  const rng = seededRng(42);
  rollExplosive('1d6', rng);                      // burn first two so seed lines up
  rollExplosive('1d6', rng);
  const result = damageRoll({ damageDice: '1d6' }, rng, rules);
  assert.deepEqual(result.baseRolls, [6, 5]);     // chain captured
  assert.equal(result.total, 11);
});

test('damageRoll under default rules never chains', () => {
  const rng = seededRng(42);
  damageRoll({ damageDice: '1d6' }, rng);
  damageRoll({ damageDice: '1d6' }, rng);
  const result = damageRoll({ damageDice: '1d6' }, rng);
  assert.equal(result.baseRolls.length, 1);       // single die, no chain
});

// ============================================================
// xp.js — thresholds parameter cascade.
// ============================================================

test('levelForXP uses custom thresholds when supplied', () => {
  const grittyThresholds = { 1: 0, 2: 1000, 3: 5000, 4: 15000, 5: 35000 };
  assert.equal(levelForXP(500, grittyThresholds), 1);
  assert.equal(levelForXP(1000, grittyThresholds), 2);
  assert.equal(levelForXP(35000, grittyThresholds), 5);
});

test('nextLevelThreshold returns the override-table value', () => {
  const grittyThresholds = { 1: 0, 2: 1000, 3: 5000 };
  assert.equal(nextLevelThreshold(0, grittyThresholds), 1000);
  assert.equal(nextLevelThreshold(5000, grittyThresholds), null);     // at cap
});

test('awardMilestone uses the override table for level-up detection', () => {
  const grittyThresholds = { 1: 0, 2: 1000 };
  const pc = { xp: 100, level: 1 };
  const beat = { targetPlaytimeMinutes: 100 };   // 1000 XP
  const result = awardMilestone({ pc, beat }, grittyThresholds);
  assert.equal(result.willLevelUp, true);        // 100 + 1000 = 1100 >= 1000
});

// ============================================================
// engine.rules — exposed, frozen, defaults-merged.
// ============================================================

test('engine.rules exposes the merged frozen rules object', () => {
  const e = createEngine({ rules: { critOn: [19, 20] } });
  assert.deepEqual([...e.rules.critOn], [19, 20]);
  assert.deepEqual([...e.rules.fumbleOn], [1]);   // default
  assert.equal(Object.isFrozen(e.rules), true);
});

test('engine with no rules option still exposes DEFAULT_RULES-equivalent', () => {
  const e = createEngine();
  assert.deepEqual([...e.rules.critOn], [20]);
  assert.deepEqual([...e.rules.fumbleOn], [1]);
  assert.equal(e.rules.damageFloor, 1);
  assert.equal(e.rules.explodingDamageDice, false);
});

// ============================================================
// engine-level integration — rules are actually applied.
// ============================================================

test('engine.Combat.attackRoll uses the engine rules', () => {
  const e = createEngine({
    rng: Dice.seededRng(4),
    rules: { critOn: [19, 20] }
  });
  const result = e.Combat.attackRoll({ attackBonus: 0, ac: 14 });
  assert.equal(result.d20, 19);
  assert.equal(result.critical, true);
});

test('engine.Combat.damageRoll uses the engine rules', () => {
  const e = createEngine({
    rng: Dice.seededRng(42),
    rules: { explodingDamageDice: true }
  });
  e.Combat.damageRoll({ damageDice: '1d6' });
  e.Combat.damageRoll({ damageDice: '1d6' });
  const result = e.Combat.damageRoll({ damageDice: '1d6' });
  assert.deepEqual(result.baseRolls, [6, 5]);
});

test('engine.XP uses the rule override tables', () => {
  const e = createEngine({
    rules: { xpThresholds: { 1: 0, 2: 500, 3: 2000 } }
  });
  assert.equal(e.XP.levelForXP(500), 2);
  assert.equal(e.XP.nextLevelThreshold(0), 500);
  assert.deepEqual(e.XP.THRESHOLDS, { 1: 0, 2: 500, 3: 2000 });
});

test('engine.XP falls back to SRD defaults when no override', () => {
  const e = createEngine();
  assert.equal(e.XP.levelForXP(2700), 4);           // SRD baseline
  assert.equal(e.XP.PROFICIENCY_BY_LEVEL[5], 3);    // SRD baseline
});

test('engine.XP awardMilestone respects the override table', () => {
  const e = createEngine({
    rules: { xpThresholds: { 1: 0, 2: 1000 } }
  });
  const result = e.XP.awardMilestone({
    pc: { xp: 100, level: 1 },
    beat: { targetPlaytimeMinutes: 100 }
  });
  assert.equal(result.willLevelUp, true);
});

// ============================================================
// Rules + audit + replay interplay.
// ============================================================

test('verifyLog with custom rules replays cleanly under those rules', () => {
  const e = createEngine({
    rng: Dice.seededRng(4),
    rules: { critOn: [19, 20] }
  });
  e.Combat.attackRoll({ attackBonus: 0, ac: 14 });

  const result = verifyLog({ seed: 4, log: e.rollLog, rules: { critOn: [19, 20] } });
  assert.equal(result.ok, true);
});

test('verifyLog against wrong rules detects the divergence', () => {
  const e = createEngine({
    rng: Dice.seededRng(4),
    rules: { critOn: [19, 20] }
  });
  // d20 = 19 + critOn [19, 20] → critical: true, hit: true
  e.Combat.attackRoll({ attackBonus: 0, ac: 14 });

  // Replay under SRD defaults — d20=19 produces critical:false, hit:false
  // (19 + 0 < 14? No, 19 >= 14, so hit:true. But critical:false. Hit matches.)
  // Need a higher AC so the hit flag also flips.
  const e2 = createEngine({
    rng: Dice.seededRng(4),
    rules: { critOn: [19, 20] }
  });
  e2.Combat.attackRoll({ attackBonus: 0, ac: 99 });   // d20=19 + crit:true → hit:true vs AC 99

  // Replay this with default rules — d20=19, critical=false, total=19 < 99 → hit:false
  const result = verifyLog({ seed: 4, log: e2.rollLog });    // no rules → defaults
  assert.equal(result.ok, false);
});

test('verifyLog throws on malformed rules input', () => {
  assert.throws(
    () => verifyLog({ seed: 1, log: [], rules: { critOn: 'twenty' } }),
    /critOn/
  );
});
