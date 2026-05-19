import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fullCasterSlots, halfCasterSlots, warlockPactSlots,
  freshSlots, consumeSlot, refundSlot, longRest, shortRest,
  startConcentration, concentrationSaveDC, endConcentration,
  cantripTier, scaledDamageSpec,
  preparedSpellCount, validatePreparation
} from '../src/spellcasting.js';
import { createEngine } from '../src/engine.js';

// === Full caster slots

test('fullCasterSlots: L1 Wizard has 2 first-level slots', () => {
  assert.equal(fullCasterSlots(1, 1), 2);
});

test('fullCasterSlots: L3 caster has 2 second-level slots', () => {
  assert.equal(fullCasterSlots(3, 2), 2);
});

test('fullCasterSlots: L5 caster has 2 third-level slots', () => {
  assert.equal(fullCasterSlots(5, 3), 2);
});

test('fullCasterSlots: L9 caster has 1 fifth-level slot', () => {
  assert.equal(fullCasterSlots(9, 5), 1);
});

test('fullCasterSlots: L17 caster has 1 ninth-level slot', () => {
  assert.equal(fullCasterSlots(17, 9), 1);
});

test('fullCasterSlots: L20 caster has 1 ninth-level slot', () => {
  assert.equal(fullCasterSlots(20, 9), 1);
});

test('fullCasterSlots: returns 0 below access', () => {
  assert.equal(fullCasterSlots(1, 2), 0);
  assert.equal(fullCasterSlots(4, 3), 0);
});

test('fullCasterSlots: throws on out-of-range inputs', () => {
  assert.throws(() => fullCasterSlots(0, 1), /casterLevel out of range/);
  assert.throws(() => fullCasterSlots(21, 1), /casterLevel out of range/);
  assert.throws(() => fullCasterSlots(5, 0), /spellLevel out of range/);
  assert.throws(() => fullCasterSlots(5, 10), /spellLevel out of range/);
});

// === Half caster

test('halfCasterSlots: L1 has no slots', () => {
  assert.equal(halfCasterSlots(1, 1), 0);
});

test('halfCasterSlots: L2 has 2 first-level slots', () => {
  assert.equal(halfCasterSlots(2, 1), 2);
});

test('halfCasterSlots: L5 has 2 second-level slots', () => {
  assert.equal(halfCasterSlots(5, 2), 2);
});

test('halfCasterSlots: L17 has 1 fifth-level slot', () => {
  assert.equal(halfCasterSlots(17, 5), 1);
});

test('halfCasterSlots: throws on out-of-range inputs', () => {
  assert.throws(() => halfCasterSlots(0, 1), /casterLevel out of range/);
  assert.throws(() => halfCasterSlots(2, 6), /half-caster/);
});

// === Warlock pact

test('warlockPactSlots: L1 → 1 slot at level 1', () => {
  assert.deepEqual(warlockPactSlots(1), { count: 1, level: 1 });
});

test('warlockPactSlots: L5 → 2 slots at level 3', () => {
  assert.deepEqual(warlockPactSlots(5), { count: 2, level: 3 });
});

test('warlockPactSlots: L11 → 3 slots at level 5', () => {
  assert.deepEqual(warlockPactSlots(11), { count: 3, level: 5 });
});

test('warlockPactSlots: L17 → 4 slots at level 5', () => {
  assert.deepEqual(warlockPactSlots(17), { count: 4, level: 5 });
});

test('warlockPactSlots: throws on out-of-range', () => {
  assert.throws(() => warlockPactSlots(0), /out of range/);
  assert.throws(() => warlockPactSlots(21), /out of range/);
});

// === Fresh slots

test('freshSlots: none progression → empty array', () => {
  assert.deepEqual(freshSlots('none', 5), []);
});

test('freshSlots: full progression L1 → 2x1st', () => {
  assert.deepEqual(freshSlots('full', 1), [{ level: 1, used: 0, max: 2 }]);
});

test('freshSlots: half progression L5 → mixed slot counts', () => {
  const slots = freshSlots('half', 5);
  assert.deepEqual(slots, [
    { level: 1, used: 0, max: 4 },
    { level: 2, used: 0, max: 2 }
  ]);
});

test('freshSlots: warlock → pact-tagged single line', () => {
  const slots = freshSlots('warlock', 5);
  assert.deepEqual(slots, [{ level: 3, used: 0, max: 2, source: 'pact' }]);
});

// === Consume / refund

test('consumeSlot uses an exact-level slot', () => {
  const start = [{ level: 1, used: 0, max: 2 }];
  const r = consumeSlot(start, 1);
  assert.equal(r.ok, true);
  assert.equal(r.slots[0].used, 1);
  assert.equal(r.levelCast, 1);
});

test('consumeSlot upcasts when exact level is full', () => {
  const start = [{ level: 1, used: 2, max: 2 }, { level: 2, used: 0, max: 1 }];
  const r = consumeSlot(start, 1);
  assert.equal(r.ok, true);
  assert.equal(r.levelCast, 2);
  assert.equal(r.slots[1].used, 1);
});

test('consumeSlot fails when no slot available', () => {
  const start = [{ level: 1, used: 2, max: 2 }];
  const r = consumeSlot(start, 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /no slot/);
});

test('consumeSlot rejects non-array input', () => {
  assert.throws(() => consumeSlot('x', 1), /must be an array/);
});

test('consumeSlot rejects non-positive level', () => {
  assert.throws(() => consumeSlot([], 0), /positive integer/);
});

test('refundSlot returns a slot that was consumed', () => {
  const start = [{ level: 1, used: 1, max: 2 }];
  const next = refundSlot(start, 1);
  assert.equal(next[0].used, 0);
});

test('refundSlot is a no-op when level not present', () => {
  const start = [{ level: 1, used: 1, max: 2 }];
  assert.equal(refundSlot(start, 5), start);
});

test('refundSlot is a no-op when used is already 0', () => {
  const start = [{ level: 1, used: 0, max: 2 }];
  assert.equal(refundSlot(start, 1), start);
});

// === Rests

test('longRest refills every slot', () => {
  const start = [{ level: 1, used: 2, max: 2 }, { level: 3, used: 1, max: 2, source: 'pact' }];
  const next = longRest(start);
  for (const s of next) assert.equal(s.used, 0);
});

test('shortRest refills only pact slots', () => {
  const start = [{ level: 1, used: 2, max: 2 }, { level: 3, used: 2, max: 2, source: 'pact' }];
  const next = shortRest(start);
  assert.equal(next[0].used, 2);
  assert.equal(next[1].used, 0);
});

// === Concentration

test('startConcentration sets the field and reports no previous', () => {
  const r = startConcentration({ id: 'wiz' }, { spellId: 'mage-armor', level: 1 });
  assert.deepEqual(r.actor.concentration, { spellId: 'mage-armor', level: 1 });
  assert.equal(r.dropped, null);
});

test('startConcentration replaces and reports the dropped spell', () => {
  const a1 = { id: 'wiz', concentration: { spellId: 'bless', level: 1 } };
  const r = startConcentration(a1, { spellId: 'haste', level: 3 });
  assert.equal(r.dropped.spellId, 'bless');
  assert.deepEqual(r.actor.concentration, { spellId: 'haste', level: 3 });
});

test('endConcentration removes the field', () => {
  const a1 = { id: 'wiz', concentration: { spellId: 'bless', level: 1 } };
  const a2 = endConcentration(a1);
  assert.equal(a2.concentration, undefined);
});

test('endConcentration is a no-op when nothing active', () => {
  const a = { id: 'wiz' };
  assert.equal(endConcentration(a), a);
});

test('concentrationSaveDC is floor(damage/2) clamped to 10', () => {
  assert.equal(concentrationSaveDC(0), 10);
  assert.equal(concentrationSaveDC(15), 10);
  assert.equal(concentrationSaveDC(20), 10);
  assert.equal(concentrationSaveDC(21), 10);
  assert.equal(concentrationSaveDC(22), 11);
  assert.equal(concentrationSaveDC(80), 40);
});

test('concentrationSaveDC rejects bad damage', () => {
  assert.throws(() => concentrationSaveDC(-1), /non-negative/);
  assert.throws(() => concentrationSaveDC(NaN), /non-negative/);
});

// === Cantrip scaling

test('cantripTier breakpoints at 5/11/17', () => {
  assert.equal(cantripTier(1), 1);
  assert.equal(cantripTier(4), 1);
  assert.equal(cantripTier(5), 2);
  assert.equal(cantripTier(10), 2);
  assert.equal(cantripTier(11), 3);
  assert.equal(cantripTier(16), 3);
  assert.equal(cantripTier(17), 4);
  assert.equal(cantripTier(20), 4);
});

test('scaledDamageSpec multiplies dice count by tier', () => {
  assert.equal(scaledDamageSpec('1d10', 1), '1d10');
  assert.equal(scaledDamageSpec('1d10', 5), '2d10');
  assert.equal(scaledDamageSpec('1d10', 11), '3d10');
  assert.equal(scaledDamageSpec('1d10', 17), '4d10');
});

test('scaledDamageSpec preserves a modifier', () => {
  assert.equal(scaledDamageSpec('1d4+1', 5), '2d4+1');
  assert.equal(scaledDamageSpec('1d4-1', 11), '3d4-1');
});

test('scaledDamageSpec returns unchanged for non-dice specs', () => {
  assert.equal(scaledDamageSpec('special', 5), 'special');
});

// === Preparation

test('preparedSpellCount: full caster at L5 with +3 ability', () => {
  assert.equal(preparedSpellCount({ casterLevel: 5, abilityMod: 3, progression: 'full' }), 8);
});

test('preparedSpellCount: half caster at L10 with +3 ability', () => {
  assert.equal(preparedSpellCount({ casterLevel: 10, abilityMod: 3, progression: 'half' }), 8);
});

test('preparedSpellCount: floors at 1', () => {
  assert.equal(preparedSpellCount({ casterLevel: 1, abilityMod: -1, progression: 'full' }), 1);
});

test('preparedSpellCount: rejects bad inputs', () => {
  assert.throws(() => preparedSpellCount({ casterLevel: 0, abilityMod: 1 }), /positive integer/);
  assert.throws(() => preparedSpellCount({ casterLevel: 5, abilityMod: 1.5 }), /integer/);
});

test('preparedSpellCount defaults progression to full', () => {
  assert.equal(preparedSpellCount({ casterLevel: 2, abilityMod: 0 }), 2);
});

test('validatePreparation accepts a subset within budget', () => {
  const r = validatePreparation({
    known: ['cure-wounds', 'bless', 'shield'],
    prepared: ['bless', 'shield'],
    casterLevel: 3,
    abilityMod: 2,
    progression: 'full'
  });
  assert.equal(r.valid, true);
});

test('validatePreparation rejects unknown spells', () => {
  const r = validatePreparation({
    known: ['bless'],
    prepared: ['fireball'],
    casterLevel: 5,
    abilityMod: 3,
    progression: 'full'
  });
  assert.equal(r.valid, false);
  assert.match(r.reason, /not in known list/);
});

test('validatePreparation rejects when budget exceeded', () => {
  const r = validatePreparation({
    known: ['a', 'b', 'c'],
    prepared: ['a', 'b', 'c'],
    casterLevel: 1,
    abilityMod: 0,
    progression: 'full'
  });
  assert.equal(r.valid, false);
  assert.match(r.reason, /exceeds budget/);
});

test('validatePreparation rejects non-array inputs', () => {
  const r = validatePreparation({ known: 'x', prepared: [], casterLevel: 1, abilityMod: 1, progression: 'full' });
  assert.equal(r.valid, false);
});

// === Engine integration

test('engine exposes Spellcasting namespace', () => {
  const engine = createEngine();
  assert.equal(typeof engine.Spellcasting.fullCasterSlots, 'function');
  assert.equal(typeof engine.Spellcasting.consumeSlot, 'function');
  assert.equal(typeof engine.Spellcasting.startConcentration, 'function');
});

test('engine Wizard class declares full progression', () => {
  const engine = createEngine();
  assert.equal(engine.classes.wizard.spellcasting.progression, 'full');
  assert.equal(engine.classes.cleric.spellcasting.progression, 'full');
});
