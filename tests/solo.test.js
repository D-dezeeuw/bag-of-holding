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
  // The contract: an oracle pull mid-session must not perturb the
  // dice stream that `engine.rollLog` is recording, otherwise
  // `verifyLog` diverges. Test the stronger version: build TWO
  // oracles on the SAME engine and ask many questions — the engine
  // dice must still match a parallel engine that asked nothing.
  const e1 = createEngine({ rng: Dice.seededRng(2026) });
  const e2 = createEngine({ rng: Dice.seededRng(2026) });
  const o1a = e1.Solo.oracle();
  const o1b = e1.Solo.oracle();
  for (let i = 0; i < 20; i++) {
    o1a.ask('many', 'likely');
    o1b.twist();
    o1a.complication();
  }
  // Now both engines roll a sequence — must be identical.
  for (let i = 0; i < 10; i++) {
    const a = e1.Combat.attackRoll({ attackBonus: 5, ac: 10 });
    const b = e2.Combat.attackRoll({ attackBonus: 5, ac: 10 });
    assert.equal(a.d20, b.d20, `attack #${i} d20 must match between engines`);
  }
  // And verifyLog must still pass for e1, proving the oracle did
  // not contaminate the recorded stream.
  assert.equal(e1.verifyLog({ seed: 2026, log: e1.rollLog }).ok, true);
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

test('STARTER_PARTY records derive into expected SRD HP / AC values', () => {
  // Literal expected values, computed by hand against SRD 5.2:
  //   - HP = first level full + (level - 1) * (avg + CON mod) + total CON-mod-from-derived-record
  //   - AC reads from the equipped armor + shield + Dex contribution.
  // Pinning these so a future plugin merge / character.js change
  // can't silently move a starter party member's baseline.
  const engine = createEngine();
  const expected = {
    thora:   { hp: 31, ac: 18 },   // Dwarf fighter, chain mail + shield, CON 16
    sable:   { hp: 24, ac: 15 },   // Halfling rogue, leather, DEX 18 (after bumps)
    oran:    { hp: 24, ac: 15 },   // Human cleric, chain shirt + shield, CON 14
    merrick: { hp: 17, ac: 12 }    // Elf wizard, no armor, DEX 14
  };
  for (const r of STARTER_PARTY) {
    const sheet = engine.deriveSheet(r);
    const e = expected[r.id];
    assert.ok(e, `no expected fixture for ${r.id}`);
    assert.equal(sheet.proficiencyBonus, 2);
    assert.equal(sheet.hp.max, e.hp, `${r.name} HP`);
    assert.equal(sheet.ac.value, e.ac, `${r.name} AC`);
    assert.ok(sheet.attacks.length > 0, `${r.name} should have at least one attack`);
  }
});

test('STARTER_PARTY is frozen', () => {
  assert.equal(Object.isFrozen(STARTER_PARTY), true);
  assert.equal(Object.isFrozen(STARTER_PARTY[0]), true);
});

// === Additional coverage from the 2.0.0 audit ===

test('Solo.oracle rejects negative-weight table entries', () => {
  const oracle = Solo.oracle({ rng: Dice.seededRng(1) });
  assert.throws(
    () => oracle.pick([{ id: 'a', weight: -3 }, { id: 'b', weight: 5 }]),
    /invalid weight/
  );
  // Extra-twists at construction time: validated lazily on first
  // draw, surfacing the same pointer-quality error.
  const bad = Solo.oracle({
    rng: Dice.seededRng(1),
    twists: [{ id: 'bad', text: 'x', weight: Infinity }]
  });
  assert.throws(() => bad.twist(), /invalid weight/);
});

test('Solo.oracle.ask returns yes-but / no-but in the threshold-adjacent band', () => {
  // Walk every d100 face from a deterministic stream; assert the
  // classification matches the documented contract.
  // Stream of 1..100 by hand:
  const queue = [];
  for (let i = 1; i <= 100; i++) queue.push((i - 0.5) / 100);
  const rng = () => queue.shift();
  const oracle = Solo.oracle({ rng });
  // threshold 50:
  //   d100 1-5    → exceptional-yes
  //   d100 6-40   → yes
  //   d100 41-50  → yes-but
  //   d100 51-59  → no-but
  //   d100 60-94  → no
  //   d100 95-100 → exceptional-no
  const buckets = { 'exceptional-yes': 0, 'yes': 0, 'yes-but': 0, 'no-but': 0, 'no': 0, 'exceptional-no': 0 };
  for (let i = 1; i <= 100; i++) {
    const a = oracle.ask('?', 'fifty-fifty');
    buckets[a.outcome]++;
  }
  assert.equal(buckets['exceptional-yes'], 5);
  assert.equal(buckets['yes'], 35);
  assert.equal(buckets['yes-but'], 10);
  assert.equal(buckets['no-but'], 9);   // 51-59
  assert.equal(buckets['no'], 35);
  assert.equal(buckets['exceptional-no'], 6);  // 95-100
});

test('Solo.oracle handles edge thresholds (0 and 100)', () => {
  const queue = [0.01, 0.99];
  const rng = () => queue.shift();
  const oracle = Solo.oracle({ rng });
  // odds = 0 → impossible: every answer must be a no-family.
  const a = oracle.ask('?', 0);
  assert.ok(a.outcome.includes('no') || a.outcome === 'exceptional-no');
  // odds = 100 → certain: every answer yes-family.
  const b = oracle.ask('?', 100);
  assert.ok(b.outcome.includes('yes') || b.outcome === 'exceptional-yes');
});

test('Session.endTurn fires onTurnEnd and onTurnStart hooks', () => {
  const fired = [];
  const engine = createEngine({
    rng: Dice.seededRng(2026),
    hooks: {
      onTurnEnd: ({ previous }) => { fired.push({ kind: 'end', id: previous.id }); },
      onTurnStart: ({ actor }) => { fired.push({ kind: 'start', id: actor.id }); }
    }
  });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 10, ac: 10 }
    ]}
  });
  const first = session.currentActor();
  session.endTurn();
  // Both hooks should have fired exactly once on the lifecycle boundary.
  assert.ok(fired.some(f => f.kind === 'end' && f.id === first.id), 'onTurnEnd fires for outgoing actor');
  assert.ok(fired.some(f => f.kind === 'start'), 'onTurnStart fires for incoming actor');
});

test('Session.snapshot deep-clones — later mutation does not leak in', () => {
  const engine = createEngine({ rng: Dice.seededRng(1) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'foe',   dexterity: 10, speed: 30, hp: 20, ac: 10 }
    ]}
  });
  const snap1 = session.snapshot();
  session.applyDamage('foe', { amount: 5 });
  const snap2 = session.snapshot();
  const foe1 = snap1.party.find(p => p.id === 'foe');
  const foe2 = snap2.party.find(p => p.id === 'foe');
  assert.equal(foe1.hp, 20, 'snapshot taken before damage must not move');
  assert.equal(foe2.hp, 15, 'snapshot taken after damage reflects new hp');
});

test('Session.serialize round-trips timers and concentration', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({
    seed: 2026,
    party: [STARTER_PARTY[3]],   // Merrick wizard
    encounter: { participants: [
      { id: 'merrick', dexterity: 14, speed: 30, hp: 17, ac: 12 },
      { id: 'foe',     dexterity: 10, speed: 30, hp: 20, ac: 10 }
    ]}
  });
  // Stamp state that previously fell off the snapshot whitelist.
  const a = session.actor('merrick');
  Object.assign(a, engine.Combat.addTimer(a, { id: 'bless', remainingRounds: 3 }));
  const concentrated = engine.Spellcasting.startConcentration(a, { spellId: 'mage-armor', level: 1 });
  Object.assign(a, concentrated.actor);

  const payload = JSON.parse(JSON.stringify(session.serialize()));
  // Payload SHOULD NOT carry the dice rollLog — that's the Replay.share path.
  assert.equal(payload.rollLog, undefined);

  const engine2 = createEngine({ rng: Dice.seededRng(2026) });
  const restored = engine2.Session.restore(payload);
  const merrick = restored.actor('merrick');
  assert.deepEqual(merrick.timers, [{ id: 'bless', remainingRounds: 3 }]);
  assert.deepEqual(merrick.concentration, { spellId: 'mage-armor', level: 1 });
});

test('Session.serialize does not emit Date-based timestamps', () => {
  // The engine doesn't read wall clocks — log entries must be host-
  // stamped if a timestamp is wanted. Pinning this so a future
  // accidental Date.now() in src/solo gets caught.
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  session.record('narrative', { text: 'hello' });
  const payload = session.serialize();
  for (const entry of payload.log) {
    assert.equal(entry.ts, undefined, `log entry of kind '${entry.kind}' must not carry a ts field`);
  }
});

test('Session passes through to session.oracle when given', () => {
  const engine = createEngine();
  const oracle = engine.Solo.oracle({ rng: Dice.seededRng(7) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]], oracle });
  assert.equal(session.oracle, oracle);
});

test('Session without an oracle exposes session.oracle as null', () => {
  const engine = createEngine();
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.equal(session.oracle, null);
});

test('Replay.verify surfaces rulesFingerprint mismatch at the boundary', () => {
  const e1 = createEngine({ rng: Dice.seededRng(2026), rules: { critOn: [19, 20] } });
  const e2 = createEngine({ rng: Dice.seededRng(2026) });  // default rules
  const session = e1.Session.create({ seed: 2026, party: [STARTER_PARTY[0]] });
  e1.Combat.attackRoll({ attackBonus: 5, ac: 10 });
  const payload = e1.Replay.share(session);
  const result = e2.Replay.verify(payload);
  assert.equal(result.ok, false);
  assert.equal(result.divergedAt, -1);
  assert.match(result.reason, /rulesFingerprint/);
});

// === Coverage tightening (2.0.1) ===
// The block below closes branches that were uncovered before the 2.0.1
// patch: the `pick` floating-point fallback, the `record.spells.slots`
// pre-set path, and four guards / branches inside Session.attack /
// startEncounter / endEncounter.

test('Solo.oracle.pick falls back to the last entry when FP rounding leaves remainder positive', () => {
  // pick()'s last line returns the tail entry as a safety net for
  // floating-point cumulative-weight underflow. The standard
  // Math.random() never returns 1.0, so this path normally can't
  // fire — we force it by providing an rng that yields 1.0 exactly.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const oracle = engine.Solo.oracle({ rng: () => 1.0 });
  const table = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
    { id: 'c', weight: 1 }
  ];
  const picked = oracle.pick(table);
  assert.equal(picked.id, 'c');
});

test('Solo.oracle.pick treats missing weight as 1 (the default branch)', () => {
  // Both the `total += entry.weight ?? 1` and the iteration
  // `r -= entry.weight ?? 1` rely on the same fallback. Tables
  // with mixed shapes (some entries explicit, some default) are
  // legal — verify both branches fire.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const oracle = engine.Solo.oracle({ rng: () => 0.0 });
  const table = [{ id: 'a' }, { id: 'b', weight: 1 }, { id: 'c' }];
  const picked = oracle.pick(table);
  assert.equal(picked.id, 'a');
});

test('Solo.oracle.pick rejects an all-zero-weight table', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const oracle = engine.Solo.oracle({ rng: Dice.seededRng(1) });
  assert.throws(
    () => oracle.pick([{ id: 'a', weight: 0 }, { id: 'b', weight: 0 }]),
    /at least one positive-weight entry/
  );
});

test('Solo.oracle.pick error message labels malformed entries that lack an id', () => {
  // Hits the `entry.id ?? '<no id>'` branch in the invalid-weight
  // error message — the labelling fallback for anonymous entries.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const oracle = engine.Solo.oracle({ rng: Dice.seededRng(1) });
  assert.throws(
    () => oracle.pick([{ weight: -1 }]),
    /<no id>/
  );
});

test('Session.actor throws when asked for an id not in the party', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.throws(() => session.actor('does-not-exist'), /no actor with id/);
});

test('Session.currentActor returns null when no encounter is active', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.equal(session.currentActor(), null);
});

test('Session.startEncounter fills in defaults for participants missing optional fields', () => {
  // The `?? 0` / `?? 10` / `?? 30` fallbacks in adoptParticipant
  // are the host-friendly path: a minimal participant with just an
  // id + a few combat stats still adopts cleanly.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  session.startEncounter([
    { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
    // No hp / hpMax / ac / dexterity / speed / conditions — every
    // field below should fall through to a default value.
    { id: 'wisp', dexterity: 10, speed: 30, hp: 1, ac: 10 }
  ]);
  const wisp = session.actor('wisp');
  assert.equal(wisp.hp, 1);
  assert.equal(wisp.ac, 10);
  assert.deepEqual(wisp.conditions, []);
});

test('Session.restore round-trips a session that never started an encounter or set a seed', () => {
  // Hits the `payload.encounter ?? undefined` and `payload.seed ??
  // undefined` fallbacks on the restore path.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  const payload = session.serialize();
  // Strip the optional fields the way an old / abbreviated host
  // payload might.
  delete payload.encounter;
  delete payload.seed;
  const restored = engine.Session.restore(payload);
  assert.equal(restored.encounter, null);
  assert.equal(restored.actor('thora').hp, session.actor('thora').hp);
});

test('Session.restore is tolerant of stripped encounter participants (defaults backfill)', () => {
  // adoptParticipant's `?? 0` / `?? 10` / `?? 30` defaults are
  // for hosts whose payload format predates a field. Force the
  // path by hand-crafting an encounter.order entry that omits
  // every optional field — the restore should backfill rather
  // than throw.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'goblin', dexterity: 14, speed: 30, hp: 7, ac: 13 }
    ]}
  });
  const payload = session.serialize();
  // Inject a truly minimal NPC: id only. Every other field
  // should fall through to the adoptParticipant default.
  payload.encounter.order.push({ id: 'wraith' });
  const restored = engine.Session.restore(payload);
  const wraith = restored.actor('wraith');
  assert.equal(wraith.hp, 0);          // p.hp ?? 0
  assert.equal(wraith.hpMax, 0);       // p.hpMax ?? p.hp ?? 0
  assert.equal(wraith.ac, 10);         // p.ac ?? 10
  assert.equal(wraith.dexterity, 10);  // p.dexterity ?? 10
  assert.equal(wraith.speed, 30);      // p.speed ?? 30
  assert.deepEqual(wraith.conditions, []);  // p.conditions ?? []
});

test('Session.create falls back to d8 when a registered class is missing a hitDie field', () => {
  // The `engine.classes[record.classId]?.hitDie ?? 8` fallback is
  // a defensive backstop against malformed class plugins or
  // hot-mutated registries. Trigger it by deleting hitDie from a
  // class after the engine has built — the registry is mutable
  // by design (1.0 contract: plugins compose post-construction).
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  delete engine.classes.fighter.hitDie;
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.equal(session.actor('thora').hitDie, 8);
});

test('Session.restore skips derived fields when overlaying volatile state from partyState', () => {
  // DERIVED_FIELDS includes `sheet`, `classId`, `level`, etc. —
  // anything the session re-derived from the record. If a payload
  // includes them on partyState, restore must SKIP them and keep
  // the freshly-derived values. The `continue` on line 418 is the
  // guard.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  const payload = session.serialize();
  // Force a derived field into the partyState so the continue
  // fires. Setting it to a wrong value lets us assert the
  // restored actor IGNORED the payload version.
  payload.partyState[0].classId = 'not-a-class-anyone-shipped';
  payload.partyState[0].sheet = { totally: 'fake' };
  const restored = engine.Session.restore(payload);
  assert.equal(restored.actor('thora').classId, 'fighter', 'derived classId stayed');
  assert.notDeepEqual(restored.actor('thora').sheet, { totally: 'fake' }, 'derived sheet stayed');
});

test('Session.create honors record.spells.slots when the host pre-builds the slot array', () => {
  // The `record.spells.slots` branch lets a host ship a custom
  // party member with their own slot ledger (multiclass, partial
  // caster, NPC ally) without going through engine progression.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const custom = {
    id: 'npc-sage',
    name: 'Sage',
    speciesId: 'human',
    backgroundId: 'sage',
    classId: 'wizard',
    level: 3,
    abilityScores: { str: 8, dex: 12, con: 12, int: 16, wis: 13, cha: 10 },
    equipment: { weaponIds: ['quarterstaff'] },
    spells: {
      slots: [
        { level: 1, used: 1, max: 4 },
        { level: 2, used: 0, max: 2 }
      ]
    }
  };
  const session = engine.Session.create({ party: [custom] });
  const actor = session.actor('npc-sage');
  assert.deepEqual(actor.spellSlots, [
    { level: 1, used: 1, max: 4 },
    { level: 2, used: 0, max: 2 }
  ]);
});

test('Session.startEncounter throws on an empty or non-array participants argument', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.throws(() => session.startEncounter([]), /non-empty array/);
  assert.throws(() => session.startEncounter(null), /non-empty array/);
  assert.throws(() => session.startEncounter({}), /non-empty array/);
});

test('engine.Session.create() with no arguments hits the `opts ?? {}` fallback and throws on missing party', () => {
  // Coverage gate: the no-arg call exercises the nullish-coalescing
  // fallback in engine.js where opts is undefined and {} stands in.
  // The downstream party check then throws.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  assert.throws(() => engine.Session.create(), /party/);
});

test('Session.startEncounter adopts new participants and returns the encounter state', () => {
  // The happy path: Session.create's inline encounter goes through
  // a different branch (it calls engine.Combat.startEncounter
  // directly), so the standalone session.startEncounter() method
  // is only reached by hosts spawning new foes mid-session.
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.equal(session.encounter, null, 'precondition: no encounter yet');
  const participants = [
    { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
    { id: 'orc-1', dexterity: 12, speed: 30, hp: 15, hpMax: 15, ac: 13 }
  ];
  const enc = session.startEncounter(participants);
  assert.ok(enc, 'returns the encounter state');
  assert.equal(session.encounter.round, 1);
  assert.equal(session.actor('orc-1').hp, 15, 'adopts the new participant into the actor table');
  const lastEntry = session.log[session.log.length - 1];
  assert.equal(lastEntry.kind, 'startEncounter');
  assert.deepEqual(lastEntry.participants, ['thora', 'orc-1']);
});

test('Session.endEncounter clears the active encounter and logs the close', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: 'thora', dexterity: 12, speed: 30, hp: 31, ac: 18 },
      { id: 'goblin', dexterity: 14, speed: 30, hp: 7, ac: 13 }
    ]}
  });
  assert.ok(session.encounter, 'precondition: encounter is active');
  session.endEncounter();
  assert.equal(session.encounter, null);
  const lastEntry = session.log[session.log.length - 1];
  assert.equal(lastEntry.kind, 'endEncounter');
});

test('Session.attack throws when neither args.ac nor a tracked target are provided', () => {
  const engine = createEngine({ rng: Dice.seededRng(2026) });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  assert.throws(
    () => session.attack({ attackerId: 'thora', attackBonus: 5, damageDice: '1d6' }),
    /must have an `ac` or args must include `ac`/
  );
});

test('Session.attack against a static AC (no targetId) returns damage without applying it', () => {
  // Lines 307-309 cover the "ranged attack at scenery / static
  // target with no tracked actor" path: damage rolls, the result
  // bubbles up, but no actor mutation happens.
  // Force a guaranteed hit (no fumble) by pinning the rng to ~0.7
  // so the first d20 reads 14 — +10 vs AC 5 always lands.
  const engine = createEngine({ rng: () => 0.7 });
  const session = engine.Session.create({ party: [STARTER_PARTY[0]] });
  const result = session.attack({
    attackerId: 'thora',
    attackBonus: 10,
    damageDice: '1d6',
    damageMod: 0,
    damageType: 'bludgeoning',
    ac: 5
  });
  assert.ok(result.attack.hit, 'precondition: the inflated bonus guarantees a hit');
  assert.ok(result.damage, 'damage was rolled');
  assert.equal(result.damage.type, 'bludgeoning');
  assert.equal(typeof result.damage.amount, 'number');
  // No `finalAmount` field — that's only set when applyDamage runs.
  assert.equal(result.damage.finalAmount, undefined);
});
