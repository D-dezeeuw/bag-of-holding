import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spendHitDie, longRest } from '../src/rest.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';
import { buildRules, DEFAULT_RULES } from '../src/rules.js';
import { freshDeathSaves, dropToZero } from '../src/combat.js';

// Deterministic d-face rng: returns `(face - 1) / sides` once per call.
const scriptedRng = (faces, sides = 10) => {
  let i = 0;
  return () => (faces[i++] - 1) / sides;
};

// === spendHitDie ===

test('spendHitDie rolls one hit die + CON mod and applies it', () => {
  const actor = {
    id: 'pc',
    level: 3,
    hitDie: 10,
    hitDiceTotal: 3,
    hitDiceUsed: 0,
    abilityScores: { con: 14 },     // +2 mod
    hp: 5,
    hpMax: 30
  };
  // d10 face 7 → 7 + 2 = 9 healed → hp 14, hitDiceUsed 1.
  const { die, healed, hpAfter, actor: next } = spendHitDie(actor, scriptedRng([7], 10));
  assert.equal(die, 7);
  assert.equal(healed, 9);
  assert.equal(hpAfter, 14);
  assert.equal(next.hitDiceUsed, 1);
  assert.equal(next.hp, 14);
  // Original untouched.
  assert.equal(actor.hp, 5);
});

test('spendHitDie caps healing at hpMax', () => {
  const actor = {
    id: 'pc', level: 3, hitDie: 8, hitDiceTotal: 3, hitDiceUsed: 0,
    abilityScores: { con: 16 }, hp: 22, hpMax: 24
  };
  // d8 face 8 + 3 = 11 raw, but only 2 fits before hpMax.
  const { die, healed, hpAfter } = spendHitDie(actor, scriptedRng([8], 8));
  assert.equal(die, 8);
  assert.equal(healed, 2);
  assert.equal(hpAfter, 24);
});

test('spendHitDie enforces SRD minimum of 1 HP on a low CON', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1, hitDiceUsed: 0,
    abilityScores: { con: 4 },   // -3 mod
    hp: 1, hpMax: 10
  };
  // d6 face 1 + (-3) = -2 → clamps to 1 healed.
  const { healed, hpAfter } = spendHitDie(actor, scriptedRng([1], 6));
  assert.equal(healed, 1);
  assert.equal(hpAfter, 2);
});

test('spendHitDie returns healed=0 when no dice remain', () => {
  const actor = {
    id: 'pc', level: 2, hitDie: 10, hitDiceTotal: 2, hitDiceUsed: 2,
    abilityScores: { con: 12 }, hp: 5, hpMax: 20
  };
  const { healed, actor: next } = spendHitDie(actor);
  assert.equal(healed, 0);
  assert.equal(next, actor);
});

test('spendHitDie with no hp on the exhausted-pool path defaults to 0', () => {
  // Hits the `actor.hp ?? 0` fallback in the early-return branch.
  const actor = { id: 'pc', hitDie: 8, hitDiceTotal: 1, hitDiceUsed: 1 };
  const { healed, hpAfter } = spendHitDie(actor);
  assert.equal(healed, 0);
  assert.equal(hpAfter, 0);
});

test('spendHitDie with no hitDiceTotal and no level defaults the pool to 0', () => {
  // Hits the second `?? 0` in `actor.hitDiceTotal ?? actor.level ?? 0`.
  // No total + no level → pool 0 → exhausted → returns healed=0.
  const actor = { id: 'pc', hitDie: 8, hp: 5, hpMax: 30 };
  const { healed } = spendHitDie(actor);
  assert.equal(healed, 0);
});

test('spendHitDie falls back to actor.level when hitDiceTotal is omitted', () => {
  const actor = {
    id: 'pc', level: 4, hitDie: 8,    // no hitDiceTotal, no hitDiceUsed
    abilityScores: { con: 12 }, hp: 5, hpMax: 30
  };
  // Treated as 4 total, 0 used → still rolls successfully.
  const { actor: next } = spendHitDie(actor, scriptedRng([5], 8));
  assert.equal(next.hitDiceUsed, 1);
});

test('spendHitDie defaults CON to 10 (mod 0) when abilityScores absent', () => {
  const actor = { id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1, hp: 1, hpMax: 10 };
  const { die, healed } = spendHitDie(actor, scriptedRng([4], 6));
  assert.equal(die, 4);
  assert.equal(healed, 4);
});

test('spendHitDie defaults hpMax to Infinity when omitted (no cap)', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 12, hitDiceTotal: 1,
    abilityScores: { con: 10 }, hp: 0
    // no hpMax
  };
  const { die, healed } = spendHitDie(actor, scriptedRng([12], 12));
  assert.equal(die, 12);
  assert.equal(healed, 12);
});

test('spendHitDie throws on a missing or invalid hitDie', () => {
  assert.throws(() => spendHitDie({ id: 'pc' }));
  assert.throws(() => spendHitDie({ id: 'pc', hitDie: 0 }));
  assert.throws(() => spendHitDie({ id: 'pc', hitDie: 'd8' }));
});

test('spendHitDie defaults hp to 0 when omitted', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1,
    abilityScores: { con: 10 }    // no hp, no hpMax
  };
  const { healed, hpAfter } = spendHitDie(actor, scriptedRng([3], 6));
  assert.equal(hpAfter, 3);
  assert.equal(healed, 3);
});

// === longRest ===

test('longRest restores HP to max', () => {
  const actor = {
    id: 'pc', level: 5, hitDie: 8, hitDiceTotal: 5, hitDiceUsed: 0,
    hp: 1, hpMax: 40
  };
  const next = longRest(actor);
  assert.equal(next.hp, 40);
});

test('longRest recovers half (floored, min 1) of total Hit Dice', () => {
  const actor = {
    id: 'pc', level: 5, hitDie: 8, hitDiceTotal: 5, hitDiceUsed: 5,
    hp: 0, hpMax: 40
  };
  const next = longRest(actor);
  // floor(5 / 2) = 2 → 5 used - 2 = 3 used.
  assert.equal(next.hitDiceUsed, 3);
});

test('longRest minimum-1 floor on Hit Dice recovery (L1 character)', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 10, hitDiceTotal: 1, hitDiceUsed: 1,
    hp: 0, hpMax: 12
  };
  const next = longRest(actor);
  // floor(1/2) = 0, but SRD floor of 1 → recover 1.
  assert.equal(next.hitDiceUsed, 0);
});

test('longRest does not over-recover Hit Dice past total', () => {
  // If recovery formula would dip used below 0, saturate at 0.
  const actor = {
    id: 'pc', level: 10, hitDie: 10, hitDiceTotal: 10, hitDiceUsed: 1,
    hp: 0, hpMax: 80
  };
  const next = longRest(actor);   // half = 5, used would go to -4
  assert.equal(next.hitDiceUsed, 0);
});

test('longRest resets the death-save tracker if present', () => {
  let actor = dropToZero({ id: 'pc', hpMax: 12, level: 1, hitDie: 8, hitDiceTotal: 1 });
  // Carry one failure into the rest.
  actor = { ...actor, deathSaves: { successes: 0, failures: 2, stable: false, dead: false } };
  const next = longRest(actor);
  assert.deepEqual(next.deathSaves, freshDeathSaves());
});

test('longRest reduces Exhaustion by 1', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 8, hitDiceTotal: 1, hp: 1, hpMax: 8,
    exhaustion: 3
  };
  const next = longRest(actor);
  assert.equal(next.exhaustion, 2);
});

test('longRest leaves Exhaustion at 0 alone', () => {
  const actor = {
    id: 'pc', level: 1, hitDie: 8, hitDiceTotal: 1, hp: 8, hpMax: 8,
    exhaustion: 0
  };
  const next = longRest(actor);
  assert.equal(next.exhaustion, 0);
});

test('longRest refills spell slots when present', () => {
  const slots = [
    { level: 1, used: 2, max: 3 },
    { level: 2, used: 1, max: 2 }
  ];
  const actor = {
    id: 'pc', level: 3, hitDie: 6, hitDiceTotal: 3, hp: 1, hpMax: 20,
    spellSlots: slots
  };
  const next = longRest(actor);
  for (const s of next.spellSlots) assert.equal(s.used, 0);
});

test('longRest skips spell-slot refill when the field is absent', () => {
  const actor = {
    id: 'pc', level: 3, hitDie: 10, hitDiceTotal: 3, hp: 0, hpMax: 30
  };
  const next = longRest(actor);
  assert.equal(next.spellSlots, undefined);
});

test('longRest hpMax falls back to current hp when neither field is set', () => {
  const actor = { id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1, hp: 5 };
  const next = longRest(actor);
  assert.equal(next.hp, 5);
});

test('longRest hpMax falls back to 0 when neither hp nor hpMax is set', () => {
  const actor = { id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1 };
  const next = longRest(actor);
  assert.equal(next.hp, 0);
});

test('longRest with neither hitDiceTotal nor level defaults the pool to 0', () => {
  // Covers the second branch of `hitDiceTotal ?? level ?? 0` for longRest.
  const actor = { id: 'pc', hitDie: 6, hp: 1 };
  const next = longRest(actor);
  // Pool 0, used 0 → nothing to recover, but the rest still runs.
  assert.equal(next.hitDiceUsed, 0);
});

test('longRest falls back to actor.level when hitDiceTotal omitted', () => {
  // Covers the first branch of `?? actor.level ?? 0`.
  const actor = { id: 'pc', level: 4, hitDie: 8, hitDiceUsed: 4, hp: 0, hpMax: 30 };
  const next = longRest(actor);
  // floor(4/2) = 2 → 4 used - 2 = 2 used.
  assert.equal(next.hitDiceUsed, 2);
});

// === Rule knob: longRestHitDiceRecovery ===

test("rules.longRestHitDiceRecovery 'all' restores every used Hit Die", () => {
  const actor = {
    id: 'pc', level: 6, hitDie: 8, hitDiceTotal: 6, hitDiceUsed: 6,
    hp: 0, hpMax: 40
  };
  const rules = buildRules({ longRestHitDiceRecovery: 'all' });
  const next = longRest(actor, rules);
  assert.equal(next.hitDiceUsed, 0);
});

test("rules.longRestHitDiceRecovery 'none' restores no Hit Dice (gritty)", () => {
  const actor = {
    id: 'pc', level: 6, hitDie: 8, hitDiceTotal: 6, hitDiceUsed: 3,
    hp: 0, hpMax: 40
  };
  const rules = buildRules({ longRestHitDiceRecovery: 'none' });
  const next = longRest(actor, rules);
  assert.equal(next.hitDiceUsed, 3);
});

test('buildRules rejects an unknown longRestHitDiceRecovery mode', () => {
  assert.throws(() => buildRules({ longRestHitDiceRecovery: 'some' }));
  assert.throws(() => buildRules({ longRestHitDiceRecovery: 42 }));
});

test("DEFAULT_RULES.longRestHitDiceRecovery is 'half' (SRD baseline)", () => {
  assert.equal(DEFAULT_RULES.longRestHitDiceRecovery, 'half');
});

// === Engine binding ===

test('engine.Rest.spendHitDie records a rollDie entry', () => {
  const engine = createEngine({ rng: seededRng(1) });
  const actor = {
    id: 'pc', level: 3, hitDie: 8, hitDiceTotal: 3,
    abilityScores: { con: 12 }, hp: 5, hpMax: 30
  };
  engine.Rest.spendHitDie(actor, 'short rest die 1');
  const last = engine.rollLog.at(-1);
  assert.equal(last.op, 'rollDie');
  assert.equal(last.sides, 8);
  assert.equal(last.context, 'short rest die 1');
});

test('engine.Rest.spendHitDie returns no die when the pool is exhausted (no log entry)', () => {
  const engine = createEngine();
  const actor = {
    id: 'pc', level: 1, hitDie: 6, hitDiceTotal: 1, hitDiceUsed: 1,
    abilityScores: { con: 10 }, hp: 1, hpMax: 8
  };
  const before = engine.rollLog.length;
  const result = engine.Rest.spendHitDie(actor);
  assert.equal(result.die, undefined);
  assert.equal(result.healed, 0);
  assert.equal(engine.rollLog.length, before);
});

test('engine.Rest.longRest honours the resolved rules', () => {
  const engine = createEngine({ rules: { longRestHitDiceRecovery: 'all' } });
  const actor = {
    id: 'pc', level: 4, hitDie: 8, hitDiceTotal: 4, hitDiceUsed: 4,
    hp: 0, hpMax: 30
  };
  const next = engine.Rest.longRest(actor);
  assert.equal(next.hitDiceUsed, 0);
});

test('engine.Rest.longRest also refills spell slots end-to-end', () => {
  const engine = createEngine();
  const actor = {
    id: 'pc', level: 5, hitDie: 6, hitDiceTotal: 5, hp: 0, hpMax: 25,
    spellSlots: [{ level: 1, used: 3, max: 4 }]
  };
  const next = engine.Rest.longRest(actor);
  assert.equal(next.spellSlots[0].used, 0);
});
