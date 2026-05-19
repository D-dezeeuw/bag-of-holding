import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, HOOK_EVENTS } from '../src/engine.js';
import { buildHookRegistry } from '../src/hooks.js';
import { seededRng } from '../src/dice.js';

// === buildHookRegistry — direct unit tests for the registry itself.

test('HOOK_EVENTS is the frozen canonical list', () => {
  assert.deepEqual([...HOOK_EVENTS], [
    'beforeAttack', 'afterDamage', 'onLevelUp', 'onConditionApplied', 'onDeath'
  ]);
  assert.throws(() => HOOK_EVENTS.push('x'));
});

test('buildHookRegistry with no extras returns zero-count registry', () => {
  const reg = buildHookRegistry();
  for (const event of HOOK_EVENTS) {
    assert.equal(reg.count(event), 0);
  }
});

test('buildHookRegistry accepts a single function per event', () => {
  const calls = [];
  const reg = buildHookRegistry({ beforeAttack: () => calls.push('a') });
  reg.fire('beforeAttack', { ac: 14 });
  assert.deepEqual(calls, ['a']);
});

test('buildHookRegistry accepts an array of functions per event', () => {
  const calls = [];
  const reg = buildHookRegistry({
    afterDamage: [() => calls.push('a'), () => calls.push('b')]
  });
  reg.fire('afterDamage', { total: 5 });
  assert.deepEqual(calls, ['a', 'b']);
});

test('fire merges deltas left-to-right into the payload', () => {
  const reg = buildHookRegistry({
    afterDamage: [
      ({ total }) => ({ total: total * 2 }),
      ({ total }) => ({ total: total + 1 })
    ]
  });
  const result = reg.fire('afterDamage', { total: 3 });
  assert.equal(result.total, 7); // (3*2)+1
});

test('fire short-circuits on cancelled:true', () => {
  let secondRan = false;
  const reg = buildHookRegistry({
    beforeAttack: [
      () => ({ cancelled: true }),
      () => { secondRan = true; return { ac: 99 }; }
    ]
  });
  const result = reg.fire('beforeAttack', { ac: 10 });
  assert.equal(result.cancelled, true);
  assert.equal(result.ac, 10); // unchanged by skipped second handler
  assert.equal(secondRan, false);
});

test('fire returns merged payload (no delta = pass-through)', () => {
  const reg = buildHookRegistry({
    beforeAttack: () => undefined
  });
  const out = reg.fire('beforeAttack', { ac: 12, attackBonus: 5 });
  assert.equal(out.ac, 12);
  assert.equal(out.attackBonus, 5);
});

test('buildHookRegistry throws on non-object input', () => {
  assert.throws(() => buildHookRegistry(null), /hooks must be an object/);
  assert.throws(() => buildHookRegistry([]), /hooks must be an object/);
  assert.throws(() => buildHookRegistry('x'), /hooks must be an object/);
});

test('buildHookRegistry throws on unknown event names', () => {
  assert.throws(
    () => buildHookRegistry({ beforAttack: () => {} }),
    /Unknown hook event: beforAttack/
  );
});

test('buildHookRegistry throws on non-function handlers', () => {
  assert.throws(
    () => buildHookRegistry({ beforeAttack: 'not-a-fn' }),
    /must be functions/
  );
  assert.throws(
    () => buildHookRegistry({ beforeAttack: [() => {}, 42] }),
    /must be functions/
  );
});

test('count throws on unknown event', () => {
  const reg = buildHookRegistry();
  assert.throws(() => reg.count('nope'), /Unknown hook event/);
});

// === engine integration — hooks fire from the right places.

test('beforeAttack can raise AC (Shield-spell pattern)', () => {
  const engine = createEngine({
    rng: seededRng(7),
    hooks: {
      beforeAttack: ({ ac }) => ({ ac: ac + 5 })
    }
  });
  const result = engine.Combat.attackRoll({ attackBonus: 3, ac: 10 });
  assert.equal(result.ac, 15);
});

test('beforeAttack can cancel an attack', () => {
  const engine = createEngine({
    rng: seededRng(7),
    hooks: { beforeAttack: () => ({ cancelled: true }) }
  });
  const result = engine.Combat.attackRoll({ attackBonus: 5, ac: 10 });
  assert.equal(result.hit, false);
  assert.equal(result.cancelled, true);
  // The cancellation is logged so a replay can reconstruct it.
  const entry = engine.rollLog[engine.rollLog.length - 1];
  assert.equal(entry.cancelled, true);
});

test('afterDamage can modify total (resistance pattern)', () => {
  const engine = createEngine({
    rng: seededRng(1),
    hooks: {
      afterDamage: ({ total }) => ({ total: Math.floor(total / 2) })
    }
  });
  const result = engine.Combat.damageRoll({ damageDice: '1d4', damageMod: 0 });
  // baseline 1d4 with seed=1 produces a deterministic value; halving
  // it is what we're verifying — exact value pinned via the seed.
  assert.equal(result.total, Math.floor(result.baseRolls[0] / 2));
});

test('afterDamage no-op returns engine result unchanged', () => {
  const engine = createEngine({ rng: seededRng(2), hooks: { afterDamage: () => {} } });
  const result = engine.Combat.damageRoll({ damageDice: '1d6', damageMod: 2 });
  assert.equal(result.total, result.baseRolls[0] + 2);
});

test('onConditionApplied fires with new and previous actor', () => {
  let captured = null;
  const engine = createEngine({
    hooks: {
      onConditionApplied: (p) => { captured = p; }
    }
  });
  const before = { id: 'a', conditions: [] };
  const after = engine.Conditions.apply(before, 'poisoned');
  assert.deepEqual(after.conditions, ['poisoned']);
  assert.equal(captured.condition, 'poisoned');
  assert.deepEqual(captured.previous, before);
});

test('onDeath fires once when exhaustion crosses to 6', () => {
  const fired = [];
  const engine = createEngine({
    hooks: { onDeath: (p) => fired.push(p) }
  });
  let actor = { id: 'pc', exhaustion: 5 };
  actor = engine.Conditions.exhaustion.gain(actor); // 5 -> 6
  assert.equal(fired.length, 1);
  assert.equal(fired[0].cause, 'exhaustion');
  // Already-dead actors don't fire again.
  actor = engine.Conditions.exhaustion.gain(actor);
  assert.equal(fired.length, 1);
});

test('onDeath fires when set jumps directly to 6', () => {
  const fired = [];
  const engine = createEngine({ hooks: { onDeath: (p) => fired.push(p) } });
  engine.Conditions.exhaustion.set({ id: 'x', exhaustion: 0 }, 6);
  assert.equal(fired.length, 1);
});

test('onLevelUp fires from awardMilestone when willLevelUp is true', () => {
  let upgrade = null;
  const engine = createEngine({
    hooks: { onLevelUp: (p) => { upgrade = p; } }
  });
  // 30-minute beat awards 300 xp; a level-1 PC with 0 xp crosses the
  // L2 threshold and triggers willLevelUp.
  engine.XP.awardMilestone({
    pc: { xp: 0, level: 1 },
    beat: { targetPlaytimeMinutes: 30 }
  });
  assert.equal(upgrade.fromLevel, 1);
  assert.equal(upgrade.toLevel, 2);
});

test('onLevelUp does not fire when willLevelUp is false', () => {
  let fired = 0;
  const engine = createEngine({
    hooks: { onLevelUp: () => { fired += 1; } }
  });
  engine.XP.awardMilestone({
    pc: { xp: 0, level: 1 },
    beat: { targetPlaytimeMinutes: 5 }
  });
  assert.equal(fired, 0);
});

test('hooks are per-engine isolated', () => {
  let aCount = 0, bCount = 0;
  const a = createEngine({ hooks: { beforeAttack: () => { aCount += 1; } } });
  const b = createEngine({ hooks: { beforeAttack: () => { bCount += 1; } } });
  a.Combat.attackRoll({ attackBonus: 0, ac: 10 });
  assert.equal(aCount, 1);
  assert.equal(bCount, 0);
  b.Combat.attackRoll({ attackBonus: 0, ac: 10 });
  assert.equal(aCount, 1);
  assert.equal(bCount, 1);
});

test('engine.hooks.count exposes registration counts', () => {
  const engine = createEngine({
    hooks: {
      beforeAttack: [() => {}, () => {}],
      onDeath: () => {}
    }
  });
  assert.equal(engine.hooks.count('beforeAttack'), 2);
  assert.equal(engine.hooks.count('onDeath'), 1);
  assert.equal(engine.hooks.count('afterDamage'), 0);
});

test('createEngine rejects non-object hooks', () => {
  assert.throws(() => createEngine({ hooks: 'x' }), /hooks must be an object/);
});
