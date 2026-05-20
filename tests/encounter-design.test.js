import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  xpForCR, ENCOUNTER_BUDGETS, budgetFor, classifyEncounter
} from '../src/encounter-design.js';
import { createEngine } from '../src/engine.js';

// === xpForCR ===

test('xpForCR: fractional CRs', () => {
  assert.equal(xpForCR(0), 10);
  assert.equal(xpForCR(1 / 8), 25);
  assert.equal(xpForCR(1 / 4), 50);
  assert.equal(xpForCR(1 / 2), 100);
});

test('xpForCR: integer CRs cover 1..30', () => {
  assert.equal(xpForCR(1), 200);
  assert.equal(xpForCR(10), 5900);
  assert.equal(xpForCR(20), 25000);
  assert.equal(xpForCR(30), 155000);
});

test('xpForCR rejects unknown / negative / non-numeric CR', () => {
  assert.throws(() => xpForCR(-1));
  assert.throws(() => xpForCR('one'));
  assert.throws(() => xpForCR(31));
  assert.throws(() => xpForCR(2.5));
});

// === ENCOUNTER_BUDGETS ===

test('ENCOUNTER_BUDGETS lists L1..L20 with low/moderate/high bands', () => {
  for (let level = 1; level <= 20; level++) {
    const band = ENCOUNTER_BUDGETS[level];
    assert.ok(band, `missing band for level ${level}`);
    assert.ok(band.low < band.moderate);
    assert.ok(band.moderate <= band.high);
  }
});

// === budgetFor ===

test('budgetFor: single L5 character at moderate', () => {
  assert.equal(budgetFor([5], 'moderate'), 750);
});

test('budgetFor: mixed-level party sums per-character budgets', () => {
  // L5 (moderate 750) + L3 (moderate 225) = 975
  assert.equal(budgetFor([5, 3], 'moderate'), 975);
});

test('budgetFor rejects unknown difficulty', () => {
  assert.throws(() => budgetFor([5], 'epic'));
});

test('budgetFor rejects empty / non-array partyLevels', () => {
  assert.throws(() => budgetFor([], 'low'));
  assert.throws(() => budgetFor('5', 'low'));
});

test('budgetFor rejects an unknown character level', () => {
  assert.throws(() => budgetFor([25], 'low'));
});

// === classifyEncounter ===

test('classifyEncounter: trivial when XP < low band', () => {
  // Party of 4 L5 → low = 2000. One CR 1 = 200 XP.
  const result = classifyEncounter({ monsterCRs: [1], partyLevels: [5, 5, 5, 5] });
  assert.equal(result.band, 'trivial');
});

test('classifyEncounter: moderate when XP between moderate and high', () => {
  // Party of 4 L5 → low 2000, moderate 3000, high 4400.
  // Three CR 3 monsters = 3 × 700 = 2100. That falls in [low, moderate) → "low".
  // Four CR 3 = 2800, still <moderate (3000) → "low".
  // Five CR 3 = 3500, in [moderate, high) → "moderate".
  const result = classifyEncounter({ monsterCRs: [3, 3, 3, 3, 3], partyLevels: [5, 5, 5, 5] });
  assert.equal(result.band, 'moderate');
});

test('classifyEncounter: deadly when XP > high band', () => {
  // Party of 4 L5 → high 4400. CR 8 = 3900, CR 8 + CR 4 = 5000 → deadly.
  const result = classifyEncounter({ monsterCRs: [8, 4], partyLevels: [5, 5, 5, 5] });
  assert.equal(result.band, 'deadly');
});

test('classifyEncounter: exactly at high band → "high"', () => {
  // Party of 4 L5 → high 4400. Need exactly 4400.
  // CR 7 = 2900, CR 4 = 1100, CR 1 = 200, CR 1 = 200 → 4400.
  const result = classifyEncounter({ monsterCRs: [7, 4, 1, 1], partyLevels: [5, 5, 5, 5] });
  assert.equal(result.band, 'high');
});

test('classifyEncounter: returns the XP and budget breakdown', () => {
  const result = classifyEncounter({ monsterCRs: [3], partyLevels: [5, 5] });
  assert.equal(result.xp, 700);
  assert.equal(result.budgets.low, 1000);
  assert.equal(result.budgets.moderate, 1500);
});

test('classifyEncounter rejects non-array monsterCRs', () => {
  assert.throws(() => classifyEncounter({ monsterCRs: 'one', partyLevels: [5] }));
});

// === Engine binding ===

test('engine.EncounterDesign surface is exposed', () => {
  const engine = createEngine();
  assert.equal(engine.EncounterDesign.xpForCR(5), 1800);
  const cls = engine.EncounterDesign.classifyEncounter({
    monsterCRs: [3, 3, 3], partyLevels: [5, 5, 5, 5]
  });
  assert.equal(cls.xp, 2100);
});
