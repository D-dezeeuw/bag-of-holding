import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVEMENT_MODES, LIGHT_LEVELS,
  speedFor, movementCost,
  fall, longJump, highJump,
  effectiveLight, obscuredState,
  hasLineOfSight, hasLineOfEffect
} from '../src/movement.js';
import { createEngine } from '../src/engine.js';

// === Movement modes / speeds ===

test('MOVEMENT_MODES lists the five SRD modes', () => {
  assert.deepEqual([...MOVEMENT_MODES].sort(),
    ['burrow', 'climb', 'fly', 'swim', 'walk']);
});

test('speedFor reads per-mode speed from actor.speeds', () => {
  const actor = { speeds: { walk: 30, fly: 60, swim: 20 } };
  assert.equal(speedFor(actor, 'walk'), 30);
  assert.equal(speedFor(actor, 'fly'), 60);
  assert.equal(speedFor(actor, 'swim'), 20);
});

test('speedFor falls back to actor.speed for walk only (legacy default)', () => {
  const actor = { speed: 30 };
  assert.equal(speedFor(actor, 'walk'), 30);
  assert.equal(speedFor(actor, 'fly'), 0);
});

test('speedFor returns 0 for an actor without speeds or speed', () => {
  assert.equal(speedFor({}, 'walk'), 0);
});

test('speedFor rejects unknown mode', () => {
  assert.throws(() => speedFor({}, 'phase'));
});

// === Movement cost ===

test('movementCost: 1 foot of normal terrain costs 1', () => {
  assert.equal(movementCost(10), 10);
});

test('movementCost: difficult terrain doubles cost', () => {
  assert.equal(movementCost(10, { difficult: true }), 20);
});

test('movementCost: crawling doubles cost', () => {
  assert.equal(movementCost(10, { crawling: true }), 20);
});

test('movementCost: difficult + crawling compound', () => {
  assert.equal(movementCost(10, { difficult: true, crawling: true }), 40);
});

test('movementCost rejects non-integer / negative feet', () => {
  assert.throws(() => movementCost(-1));
  assert.throws(() => movementCost(1.5));
});

// === Fall ===

test('fall: 10 ft → 1d6', () => {
  const result = fall(10, () => 0.5);   // d6 face 4
  assert.equal(result.dice, 1);
  assert.equal(result.total, 4);
  assert.equal(result.prone, true);
});

test('fall: 200 ft caps at 20d6', () => {
  const result = fall(200, () => 0.99);   // d6 face 6
  assert.equal(result.dice, 20);
  assert.equal(result.total, 120);
});

test('fall: 500 ft also caps at 20d6 (SRD max)', () => {
  const result = fall(500, () => 0.5);
  assert.equal(result.dice, 20);
});

test('fall: 0 ft yields 0 dice, prone false (no damage)', () => {
  const result = fall(0);
  assert.equal(result.dice, 0);
  assert.equal(result.total, 0);
  assert.equal(result.prone, false);
});

test('fall: 5 ft (under 10) yields 0 dice', () => {
  const result = fall(5);
  assert.equal(result.dice, 0);
  assert.equal(result.prone, false);
});

test('fall rejects negative distance', () => {
  assert.throws(() => fall(-10));
});

// === Jumping ===

test('longJump: STR mod feet with running start', () => {
  assert.equal(longJump({ abilityScores: { str: 16 } }), 3);
  assert.equal(longJump({ abilityScores: { str: 20 } }), 5);
});

test('longJump: half without running start (floor)', () => {
  assert.equal(longJump({ abilityScores: { str: 16 } }, { runningStart: false }), 1);
  assert.equal(longJump({ abilityScores: { str: 15 } }, { runningStart: false }), 1);
});

test('longJump: floors at 0 for negative STR mod', () => {
  assert.equal(longJump({ abilityScores: { str: 8 } }), 0);
});

test('longJump defaults STR to 10 (mod 0) when actor has no abilityScores', () => {
  assert.equal(longJump({}), 0);
});

test('highJump: 3 + STR mod feet with running start', () => {
  assert.equal(highJump({ abilityScores: { str: 16 } }), 6);
});

test('highJump: half without running start (floor)', () => {
  assert.equal(highJump({ abilityScores: { str: 16 } }, { runningStart: false }), 3);
});

test('highJump: floors at 0 for STR ≤ 4', () => {
  // 3 + (-3) = 0; max(0, …) = 0.
  assert.equal(highJump({ abilityScores: { str: 4 } }), 0);
});

// === Light + senses ===

test('LIGHT_LEVELS lists bright / dim / darkness', () => {
  assert.deepEqual([...LIGHT_LEVELS], ['bright', 'dim', 'darkness']);
});

test('effectiveLight: bright stays bright', () => {
  assert.equal(effectiveLight({}, { ambient: 'bright', distanceFt: 30 }), 'bright');
});

test('effectiveLight: darkvision converts dim → bright within range', () => {
  const viewer = { senses: { darkvision: 60 } };
  assert.equal(effectiveLight(viewer, { ambient: 'dim', distanceFt: 30 }), 'bright');
});

test('effectiveLight: darkvision converts darkness → dim within range', () => {
  const viewer = { senses: { darkvision: 60 } };
  assert.equal(effectiveLight(viewer, { ambient: 'darkness', distanceFt: 30 }), 'dim');
});

test('effectiveLight: darkvision does not apply past its range', () => {
  const viewer = { senses: { darkvision: 60 } };
  assert.equal(effectiveLight(viewer, { ambient: 'darkness', distanceFt: 90 }), 'darkness');
});

test('effectiveLight: blindsight reports bright regardless of ambient', () => {
  const viewer = { senses: { blindsight: 30 } };
  assert.equal(effectiveLight(viewer, { ambient: 'darkness', distanceFt: 20 }), 'bright');
});

test('effectiveLight: truesight wins over blindsight and darkvision', () => {
  const viewer = { senses: { truesight: 120 } };
  assert.equal(effectiveLight(viewer, { ambient: 'darkness', distanceFt: 100 }), 'bright');
});

test('effectiveLight: tolerates a viewer without senses (default empty)', () => {
  assert.equal(effectiveLight({}, { ambient: 'dim', distanceFt: 30 }), 'dim');
});

test('effectiveLight: rejects unknown ambient level', () => {
  assert.throws(() => effectiveLight({}, { ambient: 'twilight', distanceFt: 10 }));
});

// === Obscured state ===

test('obscuredState classifies darkness → heavy, dim → light, bright → none', () => {
  const viewer = {};
  assert.equal(obscuredState(viewer, { ambient: 'darkness', distanceFt: 30 }), 'heavy');
  assert.equal(obscuredState(viewer, { ambient: 'dim', distanceFt: 30 }), 'light');
  assert.equal(obscuredState(viewer, { ambient: 'bright', distanceFt: 30 }), 'none');
});

test('obscuredState upgrades for a viewer with darkvision in range', () => {
  const viewer = { senses: { darkvision: 60 } };
  assert.equal(obscuredState(viewer, { ambient: 'darkness', distanceFt: 30 }), 'light');
});

// === Line of sight / line of effect ===

test('hasLineOfSight: true when no obstacles block sight', () => {
  assert.equal(hasLineOfSight({}, {}, []), true);
  assert.equal(hasLineOfSight({}, {}, [{ id: 'a' }]), true);
});

test('hasLineOfSight: false when an obstacle blocks sight', () => {
  assert.equal(hasLineOfSight({}, {}, [{ blocksSight: true }]), false);
});

test('hasLineOfSight: default obstacles to []', () => {
  assert.equal(hasLineOfSight({}, {}), true);
});

test('hasLineOfEffect: independent of blocksSight', () => {
  // A magical darkness blocks sight but not effect.
  const magicalDark = { blocksSight: true };
  assert.equal(hasLineOfEffect({}, {}, [magicalDark]), true);
  // A glass wall blocks effect but not sight.
  const glassWall = { blocksEffect: true };
  assert.equal(hasLineOfEffect({}, {}, [glassWall]), false);
});

test('hasLineOfEffect: default obstacles to []', () => {
  assert.equal(hasLineOfEffect({}, {}), true);
});

// === Engine binding ===

test('engine.Movement surface is exposed', () => {
  const engine = createEngine({ rng: () => 0.5 });
  // Bound fall uses the engine rng.
  const result = engine.Movement.fall(30);
  assert.equal(result.dice, 3);
  // Static helpers come through too.
  assert.deepEqual([...engine.Movement.MOVEMENT_MODES].sort(),
    ['burrow', 'climb', 'fly', 'swim', 'walk']);
});

test('engine.Movement.speedFor / movementCost / jumping all exposed', () => {
  const engine = createEngine();
  assert.equal(engine.Movement.speedFor({ speed: 30 }, 'walk'), 30);
  assert.equal(engine.Movement.movementCost(10, { difficult: true }), 20);
  assert.equal(engine.Movement.longJump({ abilityScores: { str: 16 } }), 3);
  assert.equal(engine.Movement.highJump({ abilityScores: { str: 16 } }), 6);
});
