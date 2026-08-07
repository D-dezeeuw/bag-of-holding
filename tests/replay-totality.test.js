import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, verifyLog, Dice, Session } from '../index.js';

// The package's flagship promise is forensic replay: a recorded session must
// reproduce from its seed. It did not. verifyLog threw 'Cannot replay unknown
// roll op' on any log containing a death save or a class-feature use — both
// recorded by the engine itself since 1.25.0 — and Travel/Equipment/Movement/
// MagicItems consumed draws without recording anything, silently shifting the
// stream so every later entry diverged. The downstream game had already noticed
// and worked around it.

const seeded = (seed) => createEngine({ rng: Dice.seededRng(seed), logRolls: true });

test('a log containing a death save verifies', () => {
  const e = seeded(3);
  const actor = { id: 'a', hp: 0, hpMax: 10, deathSaves: { successes: 0, failures: 0 } };
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  e.Combat.deathSave(actor);
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  assert.deepEqual(verifyLog({ seed: 3, log: e.rollLog }), { ok: true });
});

test('a log containing a class-feature use verifies', () => {
  const e = seeded(5);
  e.Combat.attackRoll({ attackBonus: 2, ac: 10 });
  e.rollLog.push({ index: 99, op: 'mechanicApplied', classId: 'fighter', mechanic: 'secondWind', ok: true });
  e.Combat.attackRoll({ attackBonus: 2, ac: 10 });
  assert.deepEqual(verifyLog({ seed: 5, log: e.rollLog }), { ok: true });
});

test('previously-unlogged surfaces keep the stream aligned', () => {
  const e = seeded(7);
  const actor = { proficiencyBonus: 2, abilityScores: { wis: 14 } };
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  e.Travel.forageCheck({ actor, dc: 12 });
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  e.Movement.fall(30);
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  assert.ok(e.rollLog.some(x => x.op === 'rngDraws'), 'the draws must be recorded at all');
  assert.deepEqual(verifyLog({ seed: 7, log: e.rollLog }), { ok: true });
});

test('advantage and disadvantage replay with the right number of dice', () => {
  const e = seeded(11);
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12 });
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12, advantage: true });
  e.Checks.abilityCheck({ abilityScore: 14, dc: 12, disadvantage: true });
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  assert.deepEqual(verifyLog({ seed: 11, log: e.rollLog }), { ok: true });
});

test('a tampered log still diverges — verification is not vacuous', () => {
  const e = seeded(13);
  e.Combat.attackRoll({ attackBonus: 3, ac: 12 });
  e.Combat.deathSave({ id: 'a', hp: 0, hpMax: 10, deathSaves: { successes: 0, failures: 0 } });
  const tampered = e.rollLog.map(x => x.op === 'deathSave' ? { ...x, d20: (x.d20 % 20) + 1 } : x);
  assert.equal(verifyLog({ seed: 13, log: tampered }).ok, false);
});

test('a session saved AFTER an encounter ends can be restored', () => {
  const record = {
    id: 'pc1', name: 'Mara', classId: 'fighter', speciesId: 'human', backgroundId: 'soldier',
    level: 1, equipment: { weaponIds: [], armorId: null, shield: false, packIds: [] },
    abilityScores: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 }
  };
  const p = (id, dex) => ({ id, dexterity: dex, speed: 30, hp: 10, hpMax: 10, ac: 12 });
  const s = Session.create({
    engine: createEngine(), party: [record], scene: { id: 'x' },
    encounter: { participants: [p('pc1', 12), p('gob', 14)] }
  });
  s.endEncounter();
  const back = Session.restore(s.serialize(), createEngine());
  assert.ok(back.actor('gob'), 'the adopted foe must survive the round trip');
  assert.equal(back.actor('pc1').name, 'Mara');
});
