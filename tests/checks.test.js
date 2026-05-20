import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modFromScore, clampDC, abilityCheck, savingThrow } from '../src/checks.js';

// === modFromScore ===

test('modFromScore returns the canonical (score - 10) / 2 modifier', () => {
  // Spot-check the standard 5e table.
  assert.equal(modFromScore(1),  -5);
  assert.equal(modFromScore(8),  -1);
  assert.equal(modFromScore(10),  0);
  assert.equal(modFromScore(11),  0);
  assert.equal(modFromScore(15),  2);
  assert.equal(modFromScore(18),  4);
  assert.equal(modFromScore(20),  5);
});

test('modFromScore floors toward minus infinity for odd low scores', () => {
  // (9 - 10) / 2 = -0.5; Math.floor(-0.5) = -1, not 0.
  assert.equal(modFromScore(9), -1);
});

// === clampDC ===

test('clampDC raises DCs below 5 up to the floor', () => {
  assert.equal(clampDC(-100), 5);
  assert.equal(clampDC(4),    5);
  assert.equal(clampDC(5),    5);
});

test('clampDC lowers DCs above 30 down to the ceiling', () => {
  // SRD 5.2 § Ability Checks — Typical Difficulty Classes caps at
  // Nearly Impossible = 30.
  assert.equal(clampDC(30),  30);
  assert.equal(clampDC(31),  30);
  assert.equal(clampDC(999), 30);
});

test('clampDC passes ordinary DCs through untouched', () => {
  for (const dc of [5, 8, 13, 17, 20, 25, 30]) {
    assert.equal(clampDC(dc), dc);
  }
});

// === abilityCheck ===

test('abilityCheck adds the ability modifier and (optionally) proficiency', (t) => {
  t.mock.method(Math, 'random', () => 0.5);   // → d20 = 11
  const proficient = abilityCheck({ abilityScore: 16, proficient: true, proficiencyBonus: 3, dc: 14 });
  // d20=11, mod = (+3 ability) + (+3 proficiency) = +6, total = 17, dc clamped = 14, success
  assert.equal(proficient.d20, 11);
  assert.equal(proficient.mod, 6);
  assert.equal(proficient.total, 17);
  assert.equal(proficient.dc, 14);
  assert.equal(proficient.success, true);
});

test('abilityCheck defaults proficient to false', (t) => {
  t.mock.method(Math, 'random', () => 0);     // → d20 = 1
  const unprofiicient = abilityCheck({ abilityScore: 16, dc: 10 });
  // d20=1, mod=+3, total=4, dc=10, fail
  assert.equal(unprofiicient.mod, 3);          // ability mod only
  assert.equal(unprofiicient.total, 4);
  assert.equal(unprofiicient.success, false);
});

test('abilityCheck respects the DC clamp', (t) => {
  t.mock.method(Math, 'random', () => 0.9999); // → d20 = 20
  const absurd = abilityCheck({ abilityScore: 10, dc: 100 });
  assert.equal(absurd.dc, 30);                 // clamped down from 100
  assert.equal(absurd.success, false);         // 20 + 0 < 30
});

// === savingThrow ===

test('savingThrow is a re-export of abilityCheck with the same shape', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  const save  = savingThrow({ abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 13 });
  const check = abilityCheck({ abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 13 });
  assert.deepEqual(save, check);
});
