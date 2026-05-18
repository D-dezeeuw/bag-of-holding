import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, PROFICIENCY_BY_LEVEL, levelForXP, nextLevelThreshold, awardMilestone } from '../src/xp.js';

test('thresholds match basic-rules tier 1', () => {
  assert.equal(THRESHOLDS[1], 0);
  assert.equal(THRESHOLDS[2], 300);
  assert.equal(THRESHOLDS[5], 6500);
});

test('proficiency bumps from +2 to +3 at level 5', () => {
  assert.equal(PROFICIENCY_BY_LEVEL[4], 2);
  assert.equal(PROFICIENCY_BY_LEVEL[5], 3);
});

test('levelForXP maps thresholds correctly', () => {
  assert.equal(levelForXP(0), 1);
  assert.equal(levelForXP(299), 1);
  assert.equal(levelForXP(300), 2);
  assert.equal(levelForXP(2700), 4);
  assert.equal(levelForXP(99999), 5);
});

test('nextLevelThreshold returns next threshold or null at cap', () => {
  assert.equal(nextLevelThreshold(0), 300);
  assert.equal(nextLevelThreshold(99999), null);
});

test('awardMilestone returns a positive delta and detects level-up', () => {
  const pc = { xp: 100, level: 1 };
  const beat = { targetPlaytimeMinutes: 30 };
  const result = awardMilestone({ pc, beat });
  assert.ok(result.xpDelta > 0);
  assert.equal(result.newTotal, pc.xp + result.xpDelta);
  assert.equal(result.willLevelUp, true);
});

test('awardMilestone falls back to a 30-minute target when the beat omits one', () => {
  // Covers the `?? 30` branch — beats from older saves or hand-authored
  // tests may not carry targetPlaytimeMinutes.
  const pc = { xp: 0, level: 1 };
  const without = awardMilestone({ pc, beat: {} });
  const explicit = awardMilestone({ pc, beat: { targetPlaytimeMinutes: 30 } });
  assert.equal(without.xpDelta, explicit.xpDelta);
});

test('awardMilestone tolerates a missing beat entirely', () => {
  // `beat?.targetPlaytimeMinutes ?? 30` — same default applies when the
  // whole beat argument is absent.
  const pc = { xp: 0, level: 1 };
  const result = awardMilestone({ pc });
  assert.equal(result.xpDelta, 300);            // 30 minutes × 10 xp
});

test('awardMilestone reports willLevelUp=false when staying in the same band', () => {
  const pc = { xp: 0, level: 1 };
  // A 2-minute "interlude" beat: 20 xp, stays at level 1.
  const result = awardMilestone({ pc, beat: { targetPlaytimeMinutes: 2 } });
  assert.equal(result.willLevelUp, false);
});
