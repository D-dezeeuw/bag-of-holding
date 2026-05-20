import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tickTimers, addTimer, turnStart, turnEnd
} from '../src/combat.js';
import {
  freshScene, advanceTime, formatTimeOfDay,
  DEFAULT_DAWN_MINUTE, DEFAULT_DUSK_MINUTE, MINUTES_PER_DAY
} from '../src/scene-clock.js';
import { createEngine, HOOK_EVENTS } from '../src/engine.js';

// === Hook events ===

test('HOOK_EVENTS includes the 7 new Phase D events', () => {
  for (const ev of ['onTurnStart', 'onTurnEnd', 'onLongRest', 'onShortRest',
                    'onCast', 'onDamageApplied', 'onHpChanged']) {
    assert.ok(HOOK_EVENTS.includes(ev), `missing ${ev}`);
  }
});

// === Timers ===

test('addTimer appends a fresh timer', () => {
  const actor = { id: 'pc' };
  const next = addTimer(actor, { id: 'bless', kind: 'spell', remainingRounds: 10 });
  assert.equal(next.timers.length, 1);
  assert.equal(next.timers[0].id, 'bless');
  assert.equal(next.timers[0].remainingRounds, 10);
});

test('addTimer preserves existing timers', () => {
  const actor = { id: 'pc', timers: [{ id: 'a', remainingRounds: 5 }] };
  const next = addTimer(actor, { id: 'b', remainingRounds: 3 });
  assert.equal(next.timers.length, 2);
});

test('addTimer rejects non-object / missing-id / non-positive-rounds', () => {
  const actor = { id: 'pc' };
  assert.throws(() => addTimer(actor, null));
  assert.throws(() => addTimer(actor, { remainingRounds: 1 }));
  assert.throws(() => addTimer(actor, { id: '', remainingRounds: 1 }));
  assert.throws(() => addTimer(actor, { id: 'x', remainingRounds: 0 }));
  assert.throws(() => addTimer(actor, { id: 'x', remainingRounds: 1.5 }));
});

test('tickTimers is a no-op on an actor with no timers', () => {
  const actor = { id: 'pc' };
  const result = tickTimers(actor);
  assert.equal(result.actor, actor);
  assert.deepEqual(result.expired, []);
});

test('tickTimers is a no-op on an actor with an empty timers array', () => {
  const actor = { id: 'pc', timers: [] };
  const result = tickTimers(actor);
  assert.equal(result.actor, actor);
});

test('tickTimers decrements each timer by 1 round', () => {
  const actor = {
    id: 'pc',
    timers: [
      { id: 'bless', remainingRounds: 5 },
      { id: 'haste', remainingRounds: 3 }
    ]
  };
  const result = tickTimers(actor);
  assert.equal(result.actor.timers[0].remainingRounds, 4);
  assert.equal(result.actor.timers[1].remainingRounds, 2);
  assert.deepEqual(result.expired, []);
});

test('tickTimers moves timers reaching 0 into expired', () => {
  const actor = {
    id: 'pc',
    timers: [
      { id: 'sap', remainingRounds: 1 },
      { id: 'bless', remainingRounds: 5 }
    ]
  };
  const result = tickTimers(actor);
  assert.equal(result.actor.timers.length, 1);
  assert.equal(result.actor.timers[0].id, 'bless');
  assert.equal(result.expired.length, 1);
  assert.equal(result.expired[0].id, 'sap');
});

test('tickTimers treats already-expired timers as expired this tick', () => {
  // remainingRounds 0 (or negative) → expired on first tick.
  const actor = { id: 'pc', timers: [{ id: 'stale', remainingRounds: 0 }] };
  const result = tickTimers(actor);
  assert.equal(result.expired.length, 1);
});

test('tickTimers defaults missing remainingRounds to 0 (immediate expiry)', () => {
  // Covers the `?? 0` fallback on the per-timer decrement. A timer
  // entry without remainingRounds is treated as expired this tick —
  // belt-and-braces against host-side typos.
  const actor = { id: 'pc', timers: [{ id: 'orphaned', kind: 'spell' }] };
  const result = tickTimers(actor);
  assert.equal(result.expired.length, 1);
  assert.equal(result.actor.timers.length, 0);
});

// === turnStart / turnEnd module-level ===

test('turnStart returns the actor untouched', () => {
  const actor = { id: 'pc', hp: 10 };
  const result = turnStart(actor);
  assert.equal(result.actor, actor);
});

test('turnEnd ticks timers', () => {
  const actor = { id: 'pc', timers: [{ id: 'x', remainingRounds: 2 }] };
  const result = turnEnd(actor);
  assert.equal(result.actor.timers[0].remainingRounds, 1);
});

// === Scene clock ===

test('freshScene defaults to Dawn (06:00)', () => {
  const scene = freshScene();
  assert.equal(scene.minutes, DEFAULT_DAWN_MINUTE);
  assert.equal(scene.dawnMinute, DEFAULT_DAWN_MINUTE);
  assert.equal(scene.duskMinute, DEFAULT_DUSK_MINUTE);
});

test('freshScene rejects negative / non-integer startMinute', () => {
  assert.throws(() => freshScene({ startMinute: -1 }));
  assert.throws(() => freshScene({ startMinute: 1.5 }));
});

test('freshScene accepts custom Dawn / Dusk', () => {
  const scene = freshScene({ startMinute: 0, dawnMinute: 240, duskMinute: 1200 });
  assert.equal(scene.dawnMinute, 240);
  assert.equal(scene.duskMinute, 1200);
});

test('advanceTime by minutes moves the clock forward', () => {
  const scene = freshScene({ startMinute: 600 });   // 10:00
  const result = advanceTime(scene, { minutes: 45 });
  assert.equal(result.scene.minutes, 645);
  assert.deepEqual(result.events, []);
});

test('advanceTime by hours rolls past Dusk', () => {
  const scene = freshScene({ startMinute: 1000 });   // 16:40
  const result = advanceTime(scene, { hours: 3 });   // → 19:40
  assert.deepEqual(result.events, ['dusk']);
});

test('advanceTime by 24h from 05:00 crosses dawn then dusk', () => {
  const scene = freshScene({ startMinute: 300 });    // 05:00 (before dawn)
  const result = advanceTime(scene, { hours: 24 });
  // 05:00 → 05:00 next day. Crosses dawn (06:00 same day, +1h)
  // and dusk (18:00 same day, +13h). The next dawn at 06:00 day 2
  // is +25h away — beyond the 24h window. A 24h window always
  // crosses each boundary exactly once.
  assert.deepEqual(result.events, ['dawn', 'dusk']);
});

test('advanceTime by rounds converts 10 rounds → 1 minute', () => {
  const scene = freshScene({ startMinute: 600 });
  const result = advanceTime(scene, { rounds: 30 });   // 3 minutes
  assert.equal(result.scene.minutes, 603);
});

test('advanceTime by days rolls multiple cycles', () => {
  const scene = freshScene({ startMinute: 0 });        // midnight
  const result = advanceTime(scene, { days: 2 });
  // 2 days → dawn, dusk, dawn, dusk.
  assert.deepEqual(result.events, ['dawn', 'dusk', 'dawn', 'dusk']);
});

test('advanceTime: zero delta returns no events', () => {
  const scene = freshScene({ startMinute: 360 });
  const result = advanceTime(scene, {});
  assert.equal(result.scene.minutes, 360);
  assert.deepEqual(result.events, []);
});

test('advanceTime rejects negative deltas', () => {
  assert.throws(() => advanceTime(freshScene(), { minutes: -5 }));
});

test('advanceTime rejects non-object scene', () => {
  assert.throws(() => advanceTime(null, { minutes: 5 }));
});

test('advanceTime tolerates a bare scene without minutes/dawn/dusk fields', () => {
  // Covers the three `?? default` fallbacks: minutes → 0,
  // dawnMinute → 360 (06:00), duskMinute → 1080 (18:00).
  // From minute 0 advancing 12 hours crosses Dawn (06:00).
  const result = advanceTime({}, { hours: 12 });
  assert.equal(result.scene.minutes, 720);
  assert.deepEqual(result.events, ['dawn']);
});

test('formatTimeOfDay renders minutes as HH:MM', () => {
  assert.equal(formatTimeOfDay(0), '00:00');
  assert.equal(formatTimeOfDay(60), '01:00');
  assert.equal(formatTimeOfDay(720), '12:00');
  assert.equal(formatTimeOfDay(1380), '23:00');
});

test('formatTimeOfDay wraps for minutes >= 24h', () => {
  assert.equal(formatTimeOfDay(MINUTES_PER_DAY + 60), '01:00');
});

test('formatTimeOfDay tolerates undefined', () => {
  assert.equal(formatTimeOfDay(undefined), '00:00');
});

test('formatTimeOfDay tolerates negative input by wrapping forward', () => {
  // Defensive: a -1 minute input should render as 23:59, not crash.
  assert.equal(formatTimeOfDay(-1), '23:59');
});

// === Engine bindings: hook firing ===

test('engine.Combat.turnStart fires onTurnStart', () => {
  const events = [];
  const engine = createEngine({
    hooks: { onTurnStart: (p) => { events.push(p.actor.id); } }
  });
  engine.Combat.turnStart({ id: 'pc' }, 'round 1');
  assert.deepEqual(events, ['pc']);
});

test('engine.Combat.turnEnd fires onTurnEnd with expired timers', () => {
  const payloads = [];
  const engine = createEngine({
    hooks: { onTurnEnd: (p) => { payloads.push(p); } }
  });
  const actor = { id: 'pc', timers: [{ id: 'sap', remainingRounds: 1 }] };
  const result = engine.Combat.turnEnd(actor);
  assert.equal(result.actor.timers.length, 0);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].expired.length, 1);
  assert.equal(payloads[0].expired[0].id, 'sap');
});

test('engine.Rest.longRest fires onLongRest', () => {
  let fired = null;
  const engine = createEngine({
    hooks: { onLongRest: (p) => { fired = p; } }
  });
  const actor = {
    id: 'pc', level: 3, hitDie: 8, hitDiceTotal: 3, hitDiceUsed: 1, hp: 5, hpMax: 20
  };
  engine.Rest.longRest(actor);
  assert.ok(fired);
  assert.equal(fired.previous.hp, 5);
  assert.equal(fired.actor.hp, 20);
});

test('engine.Rest.shortRest fires onShortRest', () => {
  let fired = null;
  const engine = createEngine({
    hooks: { onShortRest: (p) => { fired = p; } }
  });
  engine.Rest.shortRest({ id: 'pc' });
  assert.ok(fired);
});

test('engine.Combat.applyDamage fires onDamageApplied for damaged outcome', () => {
  const payloads = [];
  const engine = createEngine({
    hooks: { onDamageApplied: (p) => { payloads.push(p); } }
  });
  engine.Combat.applyDamage({ id: 'pc', hp: 20, hpMax: 30 }, { amount: 5 });
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].amount, 5);
});

test('engine.Combat.applyDamage fires onDamageApplied for immune outcome', () => {
  const payloads = [];
  const engine = createEngine({
    hooks: { onDamageApplied: (p) => { payloads.push(p); } }
  });
  engine.Combat.applyDamage(
    { id: 'pc', hp: 20, hpMax: 30, damageImmunities: ['fire'] },
    { amount: 5, type: 'fire' }
  );
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].outcome, 'immune');
});

test('engine.Combat.applyDamage fires onHpChanged only when HP moves', () => {
  let count = 0;
  const engine = createEngine({
    hooks: { onHpChanged: () => { count++; } }
  });
  // Damage absorbed entirely by tempHp → no HP change.
  engine.Combat.applyDamage({ id: 'pc', hp: 20, hpMax: 30, tempHp: 10 }, { amount: 5 });
  assert.equal(count, 0);
  // Real HP damage → onHpChanged fires.
  engine.Combat.applyDamage({ id: 'pc', hp: 20, hpMax: 30 }, { amount: 5 });
  assert.equal(count, 1);
});

test('engine.Combat.heal fires onHpChanged on a real heal', () => {
  let payload = null;
  const engine = createEngine({
    hooks: { onHpChanged: (p) => { payload = p; } }
  });
  engine.Combat.heal({ id: 'pc', hp: 5, hpMax: 20 }, 10);
  assert.ok(payload);
  assert.equal(payload.hpAfter, 15);
  assert.equal(payload.cause, 'heal');
});

test('engine.Combat.heal does not fire onHpChanged on a no-op heal', () => {
  let count = 0;
  const engine = createEngine({
    hooks: { onHpChanged: () => { count++; } }
  });
  engine.Combat.heal({ id: 'pc', hp: 20, hpMax: 20 }, 5);    // at max
  assert.equal(count, 0);
});

test('engine.SceneClock surface is exposed', () => {
  const engine = createEngine();
  assert.equal(typeof engine.SceneClock.freshScene, 'function');
  assert.equal(typeof engine.SceneClock.advanceTime, 'function');
  assert.equal(typeof engine.SceneClock.formatTimeOfDay, 'function');
  assert.equal(engine.SceneClock.DEFAULT_DAWN_MINUTE, 360);
  assert.equal(engine.SceneClock.MINUTES_PER_DAY, 1440);
});
