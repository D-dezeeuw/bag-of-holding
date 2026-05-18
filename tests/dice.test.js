import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, roll, rollAdvantage, rollDisadvantage } from '../src/dice.js';

test('parse handles 2d6+3', () => {
  assert.deepEqual(parse('2d6+3'), { count: 2, sides: 6, modifier: 3 });
});

test('parse handles 1d20 without modifier', () => {
  assert.deepEqual(parse('1d20'), { count: 1, sides: 20, modifier: 0 });
});

test('parse handles a negative modifier', () => {
  assert.deepEqual(parse('1d4-1'), { count: 1, sides: 4, modifier: -1 });
});

test('parse rejects garbage', () => {
  assert.throws(() => parse('garbage'));
});

test('roll returns total within expected bounds', () => {
  for (let i = 0; i < 200; i++) {
    const r = roll('2d6+3');
    assert.ok(r.total >= 5 && r.total <= 15, `total ${r.total} out of bounds`);
    assert.equal(r.rolls.length, 2);
    for (const v of r.rolls) assert.ok(v >= 1 && v <= 6);
  }
});

test('rollAdvantage returns a roll in d20 bounds', () => {
  for (let i = 0; i < 50; i++) {
    const r = rollAdvantage('1d20');
    assert.ok(r.total >= 1 && r.total <= 20);
  }
});

test('rollDisadvantage returns a roll in d20 bounds', () => {
  for (let i = 0; i < 50; i++) {
    const r = rollDisadvantage('1d20');
    assert.ok(r.total >= 1 && r.total <= 20);
  }
});
