// === Solo mode tests (since 2.0.0) ===
//
// Covers the three namespaces shipped in the 2.0.0 solo foundation:
//   - Solo.oracle  (yes/no answers, twists, weighted tables)
//   - Session       (orchestrator: party + scene + encounter + log)
//   - Replay        (portable share payload + verify)
// Plus the bundled `STARTER_PARTY` records actually derive into
// usable sheets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEngine,
  Dice,
  Solo,
  Session,
  Replay,
  STARTER_PARTY
} from '../index.js';

// === Solo.oracle ===

test('Solo.oracle.ask returns yes when the d100 is under the threshold', () => {
  // A seeded rng gives a deterministic stream. With seed 1 and the
  // 'likely' band (threshold 75), the first d100 lands well under
  // threshold so the outcome is 'yes' (or 'yes-but' if near the
  // edge; the test asserts the yes-family).
  const oracle = Solo.oracle({ rng: Dice.seededRng(1) });
  const a = oracle.ask('Does the door open?', 'likely');
  assert.equal(a.threshold, 75);
  assert.ok(['yes', 'yes-but', 'exceptional-yes'].includes(a.outcome));
  assert.ok(a.d100 >= 1 && a.d100 <= 100);
});

test('Solo.oracle.ask flags exceptional results on extreme rolls', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(1) });
  // Sample enough times to surface at least one exceptional outcome.
  let sawExceptional = false;
  for (let i = 0; i < 200; i++) {
    const a = oracle.ask('?', 'fifty-fifty');
    if (a.outcome === 'exceptional-yes' || a.outcome === 'exceptional-no') {
      sawExceptional = true;
      break;
    }
  }
  assert.equal(sawExceptional, true);
});

test('Solo.oracle.ask accepts a numeric odds value', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(7) });
  const a = oracle.ask('A 20% question', 20);
  assert.equal(a.threshold, 20);
  assert.equal(a.odds, 20);
});

test('Solo.oracle.ask rejects unknown bands and out-of-range numbers', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(1) });
  assert.throws(() => oracle.ask('?', 'fnord'), /unknown odds band/);
  assert.throws(() => oracle.ask('?', 200), /numeric odds must be/);
  assert.throws(() => oracle.ask('?', -1), /numeric odds must be/);
});

test('Solo.oracle.twist returns a tagged twist with id and text', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(42) });
  const t = oracle.twist();
  assert.equal(typeof t.id, 'string');
  assert.equal(typeof t.text, 'string');
});

test('Solo.oracle.complication draws from the complications table', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(99) });
  const c = oracle.complication();
  assert.equal(typeof c.id, 'string');
  assert.equal(typeof c.text, 'string');
});

test('Solo.oracle.pick consumes a weighted table the caller supplied', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(123) });
  const table = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 9 }
  ];
  // 50 draws — with 9:1 odds we'd expect 'b' to dominate. Test the
  // contract not the distribution.
  const picks = Array.from({ length: 50 }, () => oracle.pick(table));
  for (const p of picks) assert.ok(p.id === 'a' || p.id === 'b');
});

test('Solo.oracle.pick rejects an empty table', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(1) });
  assert.throws(() => oracle.pick([]), /non-empty array/);
});

test('Solo.oracle.twist accepts extra entries', () => {
  const oracle = Solo.oracle({
    rng: Dice.seededRng(1),
    twists: [{ id: 'meteor', text: 'A meteor strikes nearby.', weight: 100 }]
  });
  // Heavy weight should make the custom twist dominate.
  const sample = Array.from({ length: 20 }, () => oracle.twist());
  assert.ok(sample.some(t => t.id === 'meteor'));
});

test('engine.Solo.oracle does NOT share the engine rng (oracle pulls would break replay)', () => {
  // The whole point of decoupling oracle rng from dice rng: an
  // oracle pull mid-session can't silently perturb the dice stream
  // that `engine.rollLog` is recording. Two seeded engines must
  // produce identical dice regardless of how many oracle questions
  // the host asks.
  const e1 = createEngine({ rng: Dice.seededRng(2026) });
  const e2 = createEngine({ rng: Dice.seededRng(2026) });
  const o1 = e1.Solo.oracle();   // default rng (Math.random)
  for (let i = 0; i < 5; i++) o1.ask('?', 'likely');
  // Both engines should produce the same first attack roll.
  const a1 = e1.Combat.attackRoll({ attackBonus: 5, ac: 10 });
  const a2 = e2.Combat.attackRoll({ attackBonus: 5, ac: 10 });
  assert.equal(a1.d20, a2.d20);
});

test('Solo.oracle is reproducible when an explicit seeded rng is passed', () => {
  const o1 = Solo.oracle({ rng: Dice.seededRng(2026) });
  const o2 = Solo.oracle({ rng: Dice.seededRng(2026) });
  const a1 = o1.ask('Same?', 'likely');
  const a2 = o2.ask('Same?', 'likely');
  assert.equal(a1.d100, a2.d100);
  assert.equal(a1.outcome, a2.outcome);
});

// === Session ===

test('Session.create requires a non-empty party', () => {
  const e = createEngine();
  assert.throws(() => e.Session.create({ party: [] }), /non-empty array/);
});

test('Session.create on the standalone namespace requires an engine', () => {
  // The Session namespace re-exported from index.js comes off the
  // default singleton's bound copy, so engine defaults. Pulling the
  // module-level Session (which has no default) surfaces the
  // contract test for the engine-required case.
  assert.throws(() => Session.create({ party: STARTER_PARTY, engine: undefined }), /engine is required/);
});

test('Session.create wires the starter party with full sheets', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: STARTER_PARTY });
  for (const record of STARTER_PARTY) {
    const a = session.actor(record.id);
    assert.equal(a.id, record.id);
    assert.equal(typeof a.hp, 'number');
    assert.ok(a.hp > 0);
    assert.equal(a.ac, engine.deriveSheet(record).ac.value);
  }
});

test('Session.create accepts a fresh encounter and runs turns', () => {
  const engine = createEngine({ rng: Dice.seededRng(1234) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],  // Thora alone
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'goblin', dexterity: 14, speed: 30, hp: 7, ac: 13 }
    ]}
  });
  assert.equal(session.encounter.round, 1);
  const first = session.currentActor();
  assert.ok(first);
  const { finished } = session.endTurn();
  assert.equal(finished, false);
  assert.notEqual(session.currentActor().id, first.id);
});

test('Session.attack rolls, hits, applies damage, logs the event', () => {
  const engine = createEngine({ rng: Dice.seededRng(5555) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'goblin', dexterity: 14, speed: 30, hp: 7, ac: 13 }
    ]}
  });
  // Drive enough swings that at least one connects.
  let hits = 0;
  for (let i = 0; i < 30 && session.actor('goblin').hp > 0; i++) {
    const r = session.attack({
      attackerId: 'thora', targetId: 'goblin',
      attackBonus: 5, damageDice: '1d8', damageMod: 3
    });
    if (r.attack.hit) hits++;
  }
  assert.ok(hits > 0, 'expected at least one hit in 30 swings');
  assert.ok(session.log.some(e => e.kind === 'attack'));
});

test('Session.applyDamage routes through the engine and updates the actor', () => {
  const engine = createEngine({ rng: Dice.seededRng(1) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe', dexterity: 10, speed: 30, hp: 20, ac: 10 }
    ]}
  });
  const result = session.applyDamage('foe', { amount: 15, type: 'slashing' });
  assert.equal(result.hpAfter, 5);
  assert.equal(session.actor('foe').hp, 5);
});

test('Session.heal removes Unconscious when HP rises above zero', () => {
  const engine = createEngine({ rng: Dice.seededRng(1) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[2]],   // Oran cleric
    encounter: { participants: [
      { id: 'oran', dexterity: 10, speed: 30, hp: 24, ac: 15 },
      { id: 'patient', dexterity: 10, speed: 30, hp: 1, hpMax: 10, ac: 10, conditions: [] }
    ]}
  });
  // Patient drops to 0 first.
  session.applyDamage('patient', { amount: 5 });
  assert.equal(session.actor('patient').hp, 0);
  // Then a heal pulls them back.
  const r = session.heal('patient', 4);
  assert.ok(r.hpAfter >= 1);
  assert.equal(session.actor('patient').conditions.includes('unconscious'), false);
});

test('Session.applyCondition + removeCondition mutate the actor and log it', () => {
  const engine = createEngine();
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe', dexterity: 10, speed: 30, hp: 20, ac: 10 }
    ]}
  });
  session.applyCondition('foe', 'prone');
  assert.ok(session.actor('foe').conditions.includes('prone'));
  session.removeCondition('foe', 'prone');
  assert.equal(session.actor('foe').conditions.includes('prone'), false);
  assert.ok(session.log.some(e => e.kind === 'applyCondition'));
  assert.ok(session.log.some(e => e.kind === 'removeCondition'));
});

test('Session.longRest advances the scene clock by 8 hours and resets resources', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[3]] });   // Merrick wizard
  const before = session.scene.minutes;
  // Burn a slot so we can verify long rest refills it.
  const a = session.actor('merrick');
  assert.ok(Array.isArray(a.spellSlots) && a.spellSlots[0]);
  a.spellSlots[0].used = 1;
  session.longRest();
  assert.equal(session.scene.minutes, (before + 8 * 60) % (24 * 60));
  assert.equal(session.actor('merrick').spellSlots[0].used, 0);
});

test('Session.shortRest fires for the whole party', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: STARTER_PARTY });
  session.shortRest();
  assert.ok(session.log.some(e => e.kind === 'shortRest'));
});

test('Session.advanceTime emits dawn / dusk events when crossing the boundary', () => {
  const engine = createEngine();
  // Start just before dusk.
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    scene: engine.SceneClock.freshScene({ startMinute: 18 * 60 - 30 })
  });
  const { events } = session.advanceTime({ minutes: 60 });
  assert.ok(events.includes('dusk'));
});

test('Session.endTurn requires an active encounter', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.throws(() => session.endTurn(), /no encounter running/);
});

test('Session.endTurn ticks timers on the outgoing actor', () => {
  const engine = createEngine({ rng: Dice.seededRng(1) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 10, ac: 10 }
    ]}
  });
  // Stamp a 1-round timer on whoever goes first.
  const first = session.currentActor();
  Object.assign(first, engine.Combat.addTimer(first, { id: 'bless', remainingRounds: 1 }));
  session.endTurn();
  const timersExpired = session.log.find(e => e.kind === 'timersExpired');
  assert.ok(timersExpired);
});

test('Session.serialize round-trips through Session.restore', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({
    seed: 2026,
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 10, ac: 10 }
    ]}
  });
  session.applyDamage('foe', { amount: 3 });
  const payload = session.serialize();
  // Round-trip through JSON to ensure it's serialisable.
  const wire = JSON.parse(JSON.stringify(payload));
  const engine2 = createEngine({ rng: Dice.seededRng(2026) });
  const restored = engine2.Session.restore(wire);
  assert.equal(restored.actor('foe').hp, 7);
  assert.equal(restored.scene.minutes, session.scene.minutes);
});

test('Session.restore rejects mismatched rulesFingerprint', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  const payload = session.serialize();
  // Tamper with the fingerprint.
  const tampered = { ...payload, rulesFingerprint: 'deadbeef' };
  assert.throws(
    () => engine.Session.restore(tampered),
    /fingerprint .* does not match/
  );
});

test('Session.restore rejects an unknown payload version', () => {
  const engine = createEngine();
  assert.throws(() => engine.Session.restore({ version: 'unknown' }), /unknown payload version/);
});

// === Replay ===

test('Replay.share captures the seed, fingerprint, party, and rollLog', () => {
  const engine = createEngine({ rng: Dice.seededRng(42) });
  const session = engine.Session.create({
    seed: 42,
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 10, ac: 10 }
    ]}
  });
  session.attack({ attackerId: 'thora', targetId: 'foe', attackBonus: 5, damageDice: '1d8', damageMod: 3 });
  const payload = engine.Replay.share(session);
  assert.equal(payload.version, 'bag-of-holding/replay@1');
  assert.equal(payload.seed, 42);
  assert.equal(payload.rulesFingerprint, engine.rulesFingerprint);
  assert.equal(payload.partyRecords[0].id, 'thora');
  assert.ok(payload.rollLog.length > 0);
});

test('Replay.share+verify proves the rollLog reproduces', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({
    seed: 2026,
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 10, ac: 10 }
    ]}
  });
  for (let i = 0; i < 5; i++) {
    session.attack({ attackerId: 'thora', targetId: 'foe', attackBonus: 5, damageDice: '1d8', damageMod: 3 });
  }
  const payload = engine.Replay.share(session);
  const engine2 = createEngine();   // any engine works for verify
  const verified = engine2.Replay.verify(payload);
  assert.equal(verified.ok, true);
});

test('Replay.share with includeLog folds in the session log', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ seed: 2026, party: [STARTER_PARTY[0]] });
  session.record('narrative', { text: 'The hero pondered her options.' });
  const payload = engine.Replay.share(session, { includeLog: true });
  assert.ok(Array.isArray(payload.log));
  assert.ok(payload.log.some(e => e.kind === 'narrative'));
});

test('Replay.share rejects a non-session argument', () => {
  const engine = createEngine();
  assert.throws(() => engine.Replay.share({}), /must be a Session/);
});

test('Replay.verify rejects a payload with a non-numeric seed', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  const payload = engine.Replay.share(session);
  // Default session.seed is null when none is given.
  assert.throws(() => engine.Replay.verify(payload), /seed must be a number/);
});

test('Replay.verify rejects unknown payload version', () => {
  const engine = createEngine();
  assert.throws(() => engine.Replay.verify({ version: 'unknown' }), /unknown payload version/);
});

// === Starter party ===

test('STARTER_PARTY has four canonical L3 archetypes', () => {
  assert.equal(STARTER_PARTY.length, 4);
  const classIds = STARTER_PARTY.map(r => r.classId).sort();
  assert.deepEqual(classIds, ['cleric', 'fighter', 'rogue', 'wizard']);
  for (const r of STARTER_PARTY) {
    assert.equal(r.level, 3);
    assert.ok(r.id && r.name);
  }
});

test('STARTER_PARTY records derive into valid sheets', () => {
  const engine = createEngine();
  for (const r of STARTER_PARTY) {
    const sheet = engine.deriveSheet(r);
    assert.equal(sheet.meta.classId, r.classId);
    assert.equal(sheet.proficiencyBonus, 2);
    assert.ok(sheet.hp.max > 0);
    assert.ok(sheet.ac.value >= 10);
    assert.ok(sheet.attacks.length > 0);
  }
});

test('STARTER_PARTY is frozen', () => {
  assert.equal(Object.isFrozen(STARTER_PARTY), true);
  assert.equal(Object.isFrozen(STARTER_PARTY[0]), true);
});
