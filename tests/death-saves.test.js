import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshDeathSaves,
  dropToZero,
  deathSave,
  applyDamageWhileDown,
  stabilize,
  reviveTo
} from '../src/combat.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';
import { buildRules } from '../src/rules.js';

// A deterministic rng helper: returns a function that yields the
// floats in `seq`, one per call. Floor(seq[i] * 20) + 1 is the d20
// face we want, so seq[i] = (face - 1) / 20.
const scriptedRng = (faces) => {
  let i = 0;
  return () => (faces[i++] - 1) / 20;
};

// === Tracker shape ===

test('freshDeathSaves returns a zeroed, non-terminal tracker', () => {
  assert.deepEqual(freshDeathSaves(), {
    successes: 0,
    failures: 0,
    stable: false,
    dead: false
  });
});

// === dropToZero ===

test('dropToZero zeroes HP, applies Unconscious, initialises tracker', () => {
  const actor = { id: 'pc', hp: 4, conditions: [] };
  const next = dropToZero(actor);
  assert.equal(next.hp, 0);
  assert.ok(next.conditions.includes('unconscious'));
  assert.deepEqual(next.deathSaves, freshDeathSaves());
  // Original untouched.
  assert.equal(actor.hp, 4);
});

test('dropToZero preserves existing conditions and is idempotent', () => {
  const actor = { id: 'pc', hp: 1, conditions: ['poisoned'] };
  const once = dropToZero(actor);
  const twice = dropToZero(once);
  assert.ok(once.conditions.includes('poisoned'));
  assert.ok(once.conditions.includes('unconscious'));
  // Re-dropping refreshes the tracker but doesn't duplicate conditions.
  assert.equal(twice.conditions.filter(c => c === 'unconscious').length, 1);
  assert.deepEqual(twice.deathSaves, freshDeathSaves());
});

// === deathSave — base mechanics ===

test('deathSave success increments successes when d20 >= 10', () => {
  const actor = dropToZero({ id: 'pc', hp: 5, conditions: [] });
  const { d20, outcome, actor: next } = deathSave(actor, scriptedRng([15]));
  assert.equal(d20, 15);
  assert.equal(outcome, 'success');
  assert.equal(next.deathSaves.successes, 1);
  assert.equal(next.deathSaves.failures, 0);
});

test('deathSave failure increments failures when d20 < DC', () => {
  const actor = dropToZero({ id: 'pc' });
  const { d20, outcome, actor: next } = deathSave(actor, scriptedRng([5]));
  assert.equal(d20, 5);
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 1);
});

test('three successes flip the tracker to stable', () => {
  let actor = dropToZero({ id: 'pc' });
  const rng = scriptedRng([10, 12, 14]);
  let outcome;
  for (let i = 0; i < 3; i++) {
    ({ outcome, actor } = deathSave(actor, rng));
  }
  assert.equal(outcome, 'stable');
  assert.equal(actor.deathSaves.stable, true);
  assert.equal(actor.deathSaves.successes, 3);
});

test('three failures flip the tracker to dead', () => {
  let actor = dropToZero({ id: 'pc' });
  const rng = scriptedRng([2, 3, 4]);
  let outcome;
  for (let i = 0; i < 3; i++) {
    ({ outcome, actor } = deathSave(actor, rng));
  }
  assert.equal(outcome, 'dead');
  assert.equal(actor.deathSaves.dead, true);
  assert.equal(actor.deathSaves.failures, 3);
});

// === Nat 20 and nat 1 special cases ===

test('nat 20 revives the actor to 1 HP and removes Unconscious', () => {
  const actor = dropToZero({ id: 'pc', hp: 0, conditions: [] });
  const { d20, outcome, actor: next } = deathSave(actor, scriptedRng([20]));
  assert.equal(d20, 20);
  assert.equal(outcome, 'revived');
  assert.equal(next.hp, 1);
  assert.ok(!next.conditions.includes('unconscious'));
  assert.deepEqual(next.deathSaves, freshDeathSaves());
});

test('nat 1 counts as two failures', () => {
  const actor = dropToZero({ id: 'pc' });
  const { outcome, actor: next } = deathSave(actor, scriptedRng([1]));
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 2);
});

test('nat 1 with one prior failure kills outright', () => {
  let actor = dropToZero({ id: 'pc' });
  ({ actor } = deathSave(actor, scriptedRng([5])));        // 1 failure
  ({ actor } = deathSave(actor, scriptedRng([1])));        // +2 → 3 failures
  assert.equal(actor.deathSaves.dead, true);
  assert.equal(actor.deathSaves.failures, 3);
});

// === Terminal states ===

test('rolling on a stable tracker is a noop', () => {
  const actor = { id: 'pc', hp: 0, deathSaves: { successes: 3, failures: 0, stable: true, dead: false } };
  const { d20, outcome, actor: next } = deathSave(actor, scriptedRng([5]));
  assert.equal(d20, 0);
  assert.equal(outcome, 'noop');
  assert.equal(next, actor);   // exact same reference
});

test('rolling on a dead tracker is a noop', () => {
  const actor = { id: 'pc', hp: 0, deathSaves: { successes: 0, failures: 3, stable: false, dead: true } };
  const { d20, outcome, actor: next } = deathSave(actor, scriptedRng([20]));
  assert.equal(d20, 0);
  assert.equal(outcome, 'noop');
  assert.equal(next, actor);
});

test('deathSave tolerates an actor without a tracker', () => {
  const actor = { id: 'pc', hp: 0 };
  const { outcome, actor: next } = deathSave(actor, scriptedRng([12]));
  assert.equal(outcome, 'success');
  assert.equal(next.deathSaves.successes, 1);
});

// === applyDamageWhileDown ===

test('damage at 0 HP counts as one failed save', () => {
  const actor = dropToZero({ id: 'pc' });
  const { outcome, actor: next } = applyDamageWhileDown(actor, 4);
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 1);
});

test('critical hit while down counts as two failed saves', () => {
  const actor = dropToZero({ id: 'pc' });
  const { actor: next } = applyDamageWhileDown(actor, 6, { critical: true });
  assert.equal(next.deathSaves.failures, 2);
});

test('massive damage (>= hpMax) at 0 HP is instant death', () => {
  const actor = dropToZero({ id: 'pc', hpMax: 20 });
  const { outcome, actor: next } = applyDamageWhileDown(actor, 20);
  assert.equal(outcome, 'dead');
  assert.equal(next.deathSaves.dead, true);
});

test('massive damage from hpMax in args overrides actor.hpMax', () => {
  const actor = dropToZero({ id: 'pc', hpMax: 100 });
  const { outcome } = applyDamageWhileDown(actor, 12, { hpMax: 10 });
  assert.equal(outcome, 'dead');
});

test('damage without hpMax skips the massive-damage check', () => {
  const actor = dropToZero({ id: 'pc' });   // no hpMax field
  const { outcome, actor: next } = applyDamageWhileDown(actor, 9999);
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 1);
});

test('a stabilised actor losing the stable flag on damage', () => {
  const actor = stabilize(dropToZero({ id: 'pc' }));
  assert.equal(actor.deathSaves.stable, true);
  const { actor: next } = applyDamageWhileDown(actor, 3);
  assert.equal(next.deathSaves.stable, false);
  assert.equal(next.deathSaves.failures, 1);
});

test('applyDamageWhileDown on an already-dead actor is a noop', () => {
  const actor = { id: 'pc', hp: 0, deathSaves: { successes: 0, failures: 3, stable: false, dead: true } };
  const { outcome, actor: next } = applyDamageWhileDown(actor, 5);
  assert.equal(outcome, 'noop');
  assert.equal(next, actor);
});

test('two crits in sequence reach 3 failures and kill', () => {
  let actor = dropToZero({ id: 'pc' });
  ({ actor } = applyDamageWhileDown(actor, 4, { critical: true }));  // 2 failures
  const second = applyDamageWhileDown(actor, 4, { critical: true });  // +2 → 4 → dead
  assert.equal(second.outcome, 'dead');
});

// === stabilize / reviveTo ===

test('stabilize clears counters and sets stable', () => {
  let actor = dropToZero({ id: 'pc' });
  ({ actor } = deathSave(actor, scriptedRng([5])));   // 1 failure
  ({ actor } = deathSave(actor, scriptedRng([8])));   // 2 failures
  const stabilised = stabilize(actor);
  assert.deepEqual(stabilised.deathSaves, {
    successes: 0, failures: 0, stable: true, dead: false
  });
});

test('reviveTo restores HP, clears tracker, removes Unconscious', () => {
  const down = dropToZero({ id: 'pc', conditions: ['poisoned'] });
  const up = reviveTo(down, 7);
  assert.equal(up.hp, 7);
  assert.ok(!up.conditions.includes('unconscious'));
  assert.ok(up.conditions.includes('poisoned'));    // unrelated conditions stay
  assert.deepEqual(up.deathSaves, freshDeathSaves());
});

test('reviveTo throws on non-positive HP', () => {
  const down = dropToZero({ id: 'pc' });
  assert.throws(() => reviveTo(down, 0));
  assert.throws(() => reviveTo(down, -3));
  assert.throws(() => reviveTo(down, 1.5));
});

// === Rules knobs ===

test('rule knob deathSaveDC lowers the bar', () => {
  const rules = buildRules({ deathSaveDC: 5 });
  const actor = dropToZero({ id: 'pc' });
  // d20=6 is a failure at DC 10 but a success at DC 5.
  const { outcome } = deathSave(actor, scriptedRng([6]), rules);
  assert.equal(outcome, 'success');
});

test('rule knob deathSaveSuccessesRequired changes the threshold', () => {
  const rules = buildRules({ deathSaveSuccessesRequired: 1 });
  const actor = dropToZero({ id: 'pc' });
  const { outcome, actor: next } = deathSave(actor, scriptedRng([12]), rules);
  assert.equal(outcome, 'stable');
  assert.equal(next.deathSaves.stable, true);
});

test('buildRules rejects deathSaveDC out of range', () => {
  assert.throws(() => buildRules({ deathSaveDC: 0 }));
  assert.throws(() => buildRules({ deathSaveDC: 31 }));
  assert.throws(() => buildRules({ deathSaveDC: 'ten' }));
});

test('buildRules rejects non-positive deathSaveSuccessesRequired', () => {
  assert.throws(() => buildRules({ deathSaveSuccessesRequired: 0 }));
  assert.throws(() => buildRules({ deathSaveSuccessesRequired: -1 }));
  assert.throws(() => buildRules({ deathSaveSuccessesRequired: 1.5 }));
});

// === Engine binding: rollLog + onDeath hook ===

test('engine.Combat.deathSave records a rollLog entry', () => {
  const engine = createEngine({ rng: seededRng(1) });
  const actor = engine.Combat.dropToZero({ id: 'pc', conditions: [] });
  engine.Combat.deathSave(actor, 'turn 1');
  const last = engine.rollLog.at(-1);
  assert.equal(last.op, 'deathSave');
  assert.equal(last.context, 'turn 1');
});

test('engine deathSave terminating with death fires onDeath', () => {
  // Force d20 = 1 every time (→ nat-1, two failures). After two
  // saves the cumulative failure count crosses the threshold and
  // the hook fires.
  let onDeathFired = null;
  const engine = createEngine({
    rng: () => 0.0,
    hooks: { onDeath: (payload) => { onDeathFired = payload; } }
  });
  let actor = engine.Combat.dropToZero({ id: 'pc', conditions: [] });
  ({ actor } = engine.Combat.deathSave(actor));   // nat 1 → 2 failures
  const r2 = engine.Combat.deathSave(actor);      // nat 1 → 4 failures → dead
  assert.ok(onDeathFired, 'onDeath did not fire');
  assert.equal(onDeathFired.cause, 'deathSave');
  assert.equal(r2.outcome, 'dead');
});

test('engine applyDamageWhileDown fires onDeath on the killing blow', () => {
  let fired = false;
  const engine = createEngine({ hooks: { onDeath: () => { fired = true; } } });
  const actor = engine.Combat.dropToZero({ id: 'pc', hpMax: 8 });
  const result = engine.Combat.applyDamageWhileDown(actor, 8);   // massive
  assert.equal(result.outcome, 'dead');
  assert.equal(fired, true);
});

test('engine applyDamageWhileDown on an already-dead actor does not refire onDeath', () => {
  let count = 0;
  const engine = createEngine({ hooks: { onDeath: () => { count++; } } });
  const dead = { id: 'pc', hp: 0, deathSaves: { successes: 0, failures: 3, stable: false, dead: true } };
  engine.Combat.applyDamageWhileDown(dead, 5);
  assert.equal(count, 0);
});

test('engine dropToZero fires onConditionApplied for unconscious', () => {
  const seen = [];
  const engine = createEngine({
    hooks: { onConditionApplied: (p) => { seen.push(p.condition); } }
  });
  engine.Combat.dropToZero({ id: 'pc', conditions: [] });
  assert.ok(seen.includes('unconscious'));
});

test('engine.Combat.freshDeathSaves matches the module export', () => {
  const engine = createEngine();
  assert.deepEqual(engine.Combat.freshDeathSaves(), freshDeathSaves());
});

test('engine.Combat.stabilize / reviveTo are re-exported', () => {
  const engine = createEngine();
  const actor = engine.Combat.dropToZero({ id: 'pc' });
  const stable = engine.Combat.stabilize(actor);
  assert.equal(stable.deathSaves.stable, true);
  const up = engine.Combat.reviveTo(actor, 5);
  assert.equal(up.hp, 5);
});

test('engine.Combat.deathSave on a terminal tracker logs nothing', () => {
  const engine = createEngine();
  const stable = engine.Combat.stabilize(engine.Combat.dropToZero({ id: 'pc' }));
  const startCount = engine.rollLog.length;
  engine.Combat.deathSave(stable);
  assert.equal(engine.rollLog.length, startCount);
});

test('engine applyDamageWhileDown without args / non-lethal does not fire onDeath', () => {
  // Two branches at once: (a) the `args ?? {}` fallback when the
  // caller omits the third arg, and (b) the outcome !== 'dead' path
  // through the hook check.
  let fired = false;
  const engine = createEngine({ hooks: { onDeath: () => { fired = true; } } });
  const actor = engine.Combat.dropToZero({ id: 'pc' });
  const result = engine.Combat.applyDamageWhileDown(actor, 3);
  assert.equal(result.outcome, 'failure');
  assert.equal(fired, false);
});

test('engine deathSave with no context still logs (covers context=undefined branch)', () => {
  const engine = createEngine();
  const actor = engine.Combat.dropToZero({ id: 'pc' });
  const startCount = engine.rollLog.length;
  engine.Combat.deathSave(actor);   // no context argument
  assert.equal(engine.rollLog.length, startCount + 1);
  assert.equal(engine.rollLog.at(-1).context, undefined);
});

test('deathSave on a fresh actor uses default DEFAULT_RULES (no rules arg)', () => {
  // Covers the `rules = DEFAULT_RULES` default-arg branch on the
  // module-level function. Same for `rng = Math.random` — implicit
  // when only `actor` is passed.
  const actor = dropToZero({ id: 'pc' });
  const result = deathSave(actor);
  assert.ok(['success', 'failure'].includes(result.outcome));
});

test('damage at 0 with hpMax set but damage < hpMax is a normal failure', () => {
  // Covers the `damageTaken >= max` = false branch of the
  // massive-damage check (max defined, damage below it).
  const actor = dropToZero({ id: 'pc', hpMax: 20 });
  const { outcome, actor: next } = applyDamageWhileDown(actor, 5);
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 1);
});

test('applyDamageWhileDown initialises a tracker when the actor has none', () => {
  // Hits the `actor.deathSaves ?? freshDeathSaves()` fallback on the
  // non-massive, non-lethal path — the failure increments from a
  // synthesised tracker rather than an existing one.
  const actor = { id: 'pc', hp: 0 };
  const { outcome, actor: next } = applyDamageWhileDown(actor, 3);
  assert.equal(outcome, 'failure');
  assert.equal(next.deathSaves.failures, 1);
});

test('engine applyDamageWhileDown fires onDeath even when actor lacks a tracker', () => {
  // Covers the `actor.deathSaves?.dead ?? false` short-circuit: the
  // optional chain returns undefined when there's no tracker, the
  // `??` falls through to false, and `=== false` is true → hook
  // fires. Setup: an actor with hpMax but no deathSaves field gets
  // massive-damaged in one call.
  let fired = false;
  const engine = createEngine({ hooks: { onDeath: () => { fired = true; } } });
  const result = engine.Combat.applyDamageWhileDown(
    { id: 'pc', hp: 0, hpMax: 10 },
    10
  );
  assert.equal(result.outcome, 'dead');
  assert.equal(fired, true);
});
