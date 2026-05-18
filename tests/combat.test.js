import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollInitiative, attackRoll, damageRoll } from '../src/combat.js';

// rollDie maps Math.random ∈ [0, 1) to a 1..sides integer via
//   1 + Math.floor(Math.random() * sides)
// So Math.random() = 0       → die = 1
//    Math.random() = 0.9999  → die = sides
// Tests mock Math.random to land on specific d20 outcomes.

// === rollInitiative ===

test('rollInitiative adds the DEX modifier to a d20', (t) => {
  t.mock.method(Math, 'random', () => 0.5);   // d20 = 11
  // DEX 16 → +3 mod, so 11 + 3 = 14
  assert.equal(rollInitiative({ dexterity: 16 }), 14);
});

test('rollInitiative handles a negative DEX modifier', (t) => {
  t.mock.method(Math, 'random', () => 0.9999); // d20 = 20
  // DEX 6 → -2 mod, so 20 + (-2) = 18
  assert.equal(rollInitiative({ dexterity: 6 }), 18);
});

// === attackRoll: each of the four outcome paths ===

test('attackRoll natural 20 is a critical hit regardless of AC', (t) => {
  t.mock.method(Math, 'random', () => 0.9999);
  const r = attackRoll({ attackBonus: 0, ac: 99 });   // AC absurdly high
  assert.equal(r.d20, 20);
  assert.equal(r.critical, true);
  assert.equal(r.fumble, false);
  assert.equal(r.hit, true);                          // crit always hits
  assert.equal(r.total, 20);
});

test('attackRoll natural 1 is a fumble regardless of bonus', (t) => {
  t.mock.method(Math, 'random', () => 0);             // d20 = 1
  const r = attackRoll({ attackBonus: 50, ac: 5 });   // bonus would otherwise dwarf AC
  assert.equal(r.d20, 1);
  assert.equal(r.fumble, true);
  assert.equal(r.critical, false);
  assert.equal(r.hit, false);                         // fumble always misses
});

test('attackRoll ordinary hit when total >= AC', (t) => {
  t.mock.method(Math, 'random', () => 0.5);           // d20 = 11
  const r = attackRoll({ attackBonus: 5, ac: 15 });   // 11 + 5 = 16 >= 15
  assert.equal(r.d20, 11);
  assert.equal(r.hit, true);
  assert.equal(r.critical, false);
  assert.equal(r.fumble, false);
  assert.equal(r.total, 16);
});

test('attackRoll ordinary miss when total < AC', (t) => {
  t.mock.method(Math, 'random', () => 0.25);          // d20 = 6
  const r = attackRoll({ attackBonus: 2, ac: 15 });   // 6 + 2 = 8 < 15
  assert.equal(r.hit, false);
  assert.equal(r.critical, false);
  assert.equal(r.fumble, false);
});

// === damageRoll: with and without crit, and the floor-of-1 guard ===

test('damageRoll sums dice plus modifier on a normal hit', (t) => {
  t.mock.method(Math, 'random', () => 0.5);           // each d8 = 5
  const r = damageRoll({ damageDice: '2d8', damageMod: 3 });
  assert.deepEqual(r.baseRolls, [5, 5]);
  assert.deepEqual(r.critRolls, []);
  assert.equal(r.damageMod, 3);
  assert.equal(r.total, 13);
});

test('damageRoll doubles the dice on a critical (not the modifier)', (t) => {
  t.mock.method(Math, 'random', () => 0.5);           // each d8 = 5
  const r = damageRoll({ damageDice: '1d8', damageMod: 4, critical: true });
  assert.deepEqual(r.baseRolls, [5]);
  assert.deepEqual(r.critRolls, [5]);
  assert.equal(r.total, 5 + 5 + 4);                   // dice doubled, mod once
});

test('damageRoll never drops below 1 even with a deeply negative modifier', (t) => {
  t.mock.method(Math, 'random', () => 0);             // each d4 = 1
  const r = damageRoll({ damageDice: '1d4', damageMod: -10 });
  assert.equal(r.total, 1);                           // floored, not -9
});

test('damageRoll defaults damageMod to 0 when omitted', (t) => {
  t.mock.method(Math, 'random', () => 0.5);           // d6 = 4
  const r = damageRoll({ damageDice: '1d6' });
  assert.equal(r.damageMod, 0);
  assert.equal(r.total, 4);
});
