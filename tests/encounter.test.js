import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startEncounter, currentActor, endTurn, removeParticipant,
  spend, freshBudget, attacksPerAction, opportunityAttack,
  effectiveAc, rangeBand, COVER_BONUSES, ACTION_COSTS, rollOrder
} from '../src/encounter.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';

const PARTICIPANTS = [
  { id: 'pc-a', dexterity: 16, speed: 30, hp: 20 },
  { id: 'orc',  dexterity: 12, speed: 30, hp: 15 },
  { id: 'pc-b', dexterity: 14, speed: 25, hp: 18 }
];

// === startEncounter and order

test('startEncounter sorts participants by initiative descending', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(1));
  assert.equal(state.order.length, 3);
  for (let i = 1; i < state.order.length; i++) {
    assert.ok(state.order[i - 1].initiative >= state.order[i].initiative);
  }
  assert.equal(state.round, 1);
  assert.equal(state.turnIndex, 0);
});

test('startEncounter assigns a fresh budget per actor', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(2));
  for (const p of PARTICIPANTS) {
    const b = state.budgets[p.id];
    assert.equal(b.action, 1);
    assert.equal(b.bonus, 1);
    assert.equal(b.reaction, 1);
    assert.equal(b.movement, p.speed);
  }
});

test('startEncounter rejects empty participant list', () => {
  assert.throws(() => startEncounter([]), /at least one participant/);
  assert.throws(() => startEncounter('not-array'), /at least one participant/);
});

test('startEncounter validates participant shape', () => {
  assert.throws(() => startEncounter([null]), /must be an object/);
  assert.throws(() => startEncounter([{}]), /non-empty string id/);
  assert.throws(() => startEncounter([{ id: 'x', speed: 30 }]), /dexterity must be an integer/);
  assert.throws(() => startEncounter([{ id: 'x', dexterity: 10, speed: -5 }]), /speed must be a non-negative integer/);
});

test('rollOrder uses dexterity then id to break ties', () => {
  // Force the d20 to come up the same for both actors by pinning
  // the rng to a constant — that drives initiative through the
  // dexterity tiebreaker, then the id tiebreaker. Note: same
  // *initiative* requires same *modifier*, so we pair dex values
  // that produce the same mod (12 and 13 both mod +1).
  const constantRng = () => 0;   // rollDie(20, () => 0) === 1
  // dex 12 vs 13 — both mod +1, so initiative ties; dex tiebreaker
  // picks the higher dex.
  const r1 = rollOrder([
    { id: 'a', dexterity: 12, speed: 30 },
    { id: 'b', dexterity: 13, speed: 30 }
  ], constantRng);
  assert.equal(r1[0].id, 'b');
  // Identical dex → falls through to id tiebreaker (lex asc).
  const r2 = rollOrder([
    { id: 'z', dexterity: 14, speed: 30 },
    { id: 'a', dexterity: 14, speed: 30 }
  ], constantRng);
  assert.equal(r2[0].id, 'a');
});

test('rollOrder is deterministic across runs with the same seed', () => {
  const a = startEncounter(PARTICIPANTS, seededRng(42));
  const b = startEncounter(PARTICIPANTS, seededRng(42));
  assert.deepEqual(a.order.map(p => p.id), b.order.map(p => p.id));
});

// === Action budget

test('spend deducts from the chosen budget slot', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(3));
  const id = state.order[0].id;
  const r = spend(state, id, 'action');
  assert.equal(r.allowed, true);
  assert.equal(r.state.budgets[id].action, 0);
});

test('spend refuses when budget is exhausted', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(4));
  const id = state.order[0].id;
  ({ state } = { state: spend(state, id, 'action').state });
  const second = spend(state, id, 'action');
  assert.equal(second.allowed, false);
  assert.match(second.reason, /insufficient action/);
});

test('spend rejects unknown cost', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(5));
  const r = spend(state, state.order[0].id, 'turbo');
  assert.equal(r.allowed, false);
  assert.match(r.reason, /unknown cost/);
});

test('spend rejects unknown actor', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(6));
  const r = spend(state, 'ghost', 'action');
  assert.equal(r.allowed, false);
  assert.match(r.reason, /unknown actor/);
});

test('spend allows free actions without changing budget', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(7));
  const id = state.order[0].id;
  const r = spend(state, id, 'free');
  assert.equal(r.allowed, true);
  assert.equal(r.state, state);
});

test('spend movement deducts feet, refuses overflow', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(8));
  const id = state.order[0].id;
  const a = spend(state, id, 'movement', 20);
  assert.equal(a.allowed, true);
  assert.equal(a.state.budgets[id].movement, state.budgets[id].movement - 20);
  const b = spend(a.state, id, 'movement', 999);
  assert.equal(b.allowed, false);
});

test('spend refuses when slot has no budget', () => {
  // Construct a state where movement is null (encounter-state edge).
  const state = startEncounter(PARTICIPANTS, seededRng(9));
  const id = state.order[0].id;
  const patched = { ...state, budgets: { ...state.budgets, [id]: { ...state.budgets[id], movement: null } } };
  const r = spend(patched, id, 'movement', 5);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /no movement budget/);
});

test('ACTION_COSTS lists the public cost vocabulary', () => {
  assert.deepEqual([...ACTION_COSTS], ['action', 'bonus', 'reaction', 'movement', 'free']);
});

test('freshBudget honours speed', () => {
  const b = freshBudget(45);
  assert.equal(b.movement, 45);
  assert.equal(b.action, 1);
});

// === Turn rotation

test('endTurn advances turnIndex and refreshes budgets', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(10));
  const before = state.turnIndex;
  ({ state } = endTurn(state));
  assert.notEqual(state.turnIndex, before);
  assert.equal(state.budgets[currentActor(state).id].action, 1);
});

test('endTurn increments round when wrapping', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(11));
  for (let i = 0; i < state.order.length; i++) {
    ({ state } = endTurn(state));
  }
  assert.equal(state.round, 2);
});

test('endTurn returns finished:true when no participants', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(12));
  for (const p of PARTICIPANTS) state = removeParticipant(state, p.id);
  const r = endTurn(state);
  assert.equal(r.finished, true);
});

// === Removal

test('removeParticipant drops actor from order and budgets', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(13));
  const victim = state.order[1].id;
  state = removeParticipant(state, victim);
  assert.equal(state.order.find(p => p.id === victim), undefined);
  assert.equal(state.budgets[victim], undefined);
});

test('removeParticipant adjusts turnIndex when removing earlier actor', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(14));
  // Move to turn index 2.
  ({ state } = endTurn(state));
  ({ state } = endTurn(state));
  const earlier = state.order[0].id;
  const before = state.order[state.turnIndex].id;
  state = removeParticipant(state, earlier);
  assert.equal(state.order[state.turnIndex].id, before);
});

test('removeParticipant wraps to 0 when removing the last actor in order', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(15));
  // Move to the last turn.
  while (state.turnIndex < state.order.length - 1) {
    ({ state } = endTurn(state));
  }
  state = removeParticipant(state, state.order[state.turnIndex].id);
  assert.equal(state.turnIndex, 0);
});

test('removeParticipant is a no-op for unknown ids', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(16));
  const after = removeParticipant(state, 'ghost');
  assert.equal(after, state);
});

test('currentActor returns null when order is empty', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(17));
  for (const p of PARTICIPANTS) state = removeParticipant(state, p.id);
  assert.equal(currentActor(state), null);
});

// === Multi-attack

test('attacksPerAction defaults to 1 without a class table', () => {
  assert.equal(attacksPerAction(null, 5), 1);
  assert.equal(attacksPerAction({}, 5), 1);
});

test('attacksPerAction reads extraAttacks table', () => {
  const fighter = { extraAttacks: { 5: 1, 11: 2 } };
  assert.equal(attacksPerAction(fighter, 4), 1);
  assert.equal(attacksPerAction(fighter, 5), 2);
  assert.equal(attacksPerAction(fighter, 10), 2);
  assert.equal(attacksPerAction(fighter, 11), 3);
});

test('Fighter L5 gets 2 attacks per action via the bundled class def', () => {
  const engine = createEngine();
  const fighter = engine.classes.fighter;
  assert.equal(engine.Combat.attacksPerAction(fighter, 4), 1);
  assert.equal(engine.Combat.attacksPerAction(fighter, 5), 2);
});

// === Opportunity attacks

test('opportunityAttack short-circuits when disengaged', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(20));
  const r = opportunityAttack(state, {
    reactorId: state.order[0].id,
    attackerArgs: { attackBonus: 5, ac: 12 },
    disengaged: true,
    rng: seededRng(21)
  });
  assert.equal(r.triggered, false);
  assert.match(r.reason, /disengaged/);
});

test('opportunityAttack rolls when reactor has reaction', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(22));
  const r = opportunityAttack(state, {
    reactorId: state.order[0].id,
    attackerArgs: { attackBonus: 4, ac: 14 },
    rng: seededRng(23)
  });
  assert.equal(r.triggered, true);
  assert.equal(typeof r.attack.hit, 'boolean');
  assert.equal(r.state.budgets[state.order[0].id].reaction, 0);
});

test('opportunityAttack refuses when reaction is spent', () => {
  let state = startEncounter(PARTICIPANTS, seededRng(24));
  const id = state.order[0].id;
  ({ state } = { state: spend(state, id, 'reaction').state });
  const r = opportunityAttack(state, {
    reactorId: id,
    attackerArgs: { attackBonus: 4, ac: 14 },
    rng: seededRng(25)
  });
  assert.equal(r.triggered, false);
  assert.match(r.reason, /insufficient reaction/);
});

test('opportunityAttack refuses when reactor not in encounter', () => {
  const state = startEncounter(PARTICIPANTS, seededRng(26));
  const r = opportunityAttack(state, {
    reactorId: 'ghost',
    attackerArgs: { attackBonus: 0, ac: 10 },
    rng: seededRng(27)
  });
  assert.equal(r.triggered, false);
  assert.match(r.reason, /not in encounter/);
});

test('engine.Combat.opportunityAttack logs the attack roll', () => {
  const engine = createEngine({ rng: seededRng(28) });
  const state = engine.Combat.startEncounter(PARTICIPANTS);
  const before = engine.rollLog.length;
  const r = engine.Combat.opportunityAttack(state, {
    reactorId: state.order[0].id,
    attackerArgs: { attackBonus: 3, ac: 14 }
  });
  assert.equal(r.triggered, true);
  // initiative rolls during startEncounter + this attack roll
  assert.ok(engine.rollLog.length > before);
});

// === Cover and range

test('effectiveAc applies SRD cover bonuses', () => {
  assert.equal(effectiveAc(14, 'none'), 14);
  assert.equal(effectiveAc(14, 'half'), 16);
  assert.equal(effectiveAc(14, 'three-quarters'), 19);
  assert.equal(effectiveAc(14, 'full'), null);
});

test('effectiveAc defaults to none', () => {
  assert.equal(effectiveAc(13), 13);
});

test('effectiveAc throws on unknown cover', () => {
  assert.throws(() => effectiveAc(14, 'super'), /Unknown cover/);
});

test('COVER_BONUSES is the frozen canonical map', () => {
  assert.equal(COVER_BONUSES.none, 0);
  assert.equal(COVER_BONUSES.full, null);
  assert.throws(() => { COVER_BONUSES.none = 99; });
});

test('rangeBand classifies distance against weapon range', () => {
  assert.equal(rangeBand({ distance: 20, normalRange: 30, longRange: 120 }), 'in-range-normal');
  assert.equal(rangeBand({ distance: 60, normalRange: 30, longRange: 120 }), 'in-range-long');
  assert.equal(rangeBand({ distance: 200, normalRange: 30, longRange: 120 }), 'out-of-range');
});

test('rangeBand rejects bad distance', () => {
  assert.throws(() => rangeBand({ distance: -5, normalRange: 30, longRange: 120 }), /non-negative/);
  assert.throws(() => rangeBand({ distance: 'far', normalRange: 30, longRange: 120 }), /non-negative/);
});

// === Engine integration

test('engine exposes the encounter surface', () => {
  const engine = createEngine({ rng: seededRng(30) });
  assert.equal(typeof engine.Combat.startEncounter, 'function');
  assert.equal(typeof engine.Combat.endTurn, 'function');
  assert.equal(typeof engine.Combat.spend, 'function');
  assert.equal(typeof engine.Combat.effectiveAc, 'function');
});

test('engine startEncounter consumes the engine rng', () => {
  const a = createEngine({ rng: seededRng(40) });
  const b = createEngine({ rng: seededRng(40) });
  const sa = a.Combat.startEncounter(PARTICIPANTS);
  const sb = b.Combat.startEncounter(PARTICIPANTS);
  assert.deepEqual(sa.order.map(p => p.id), sb.order.map(p => p.id));
});

test('engine exposes rollOrder for ad-hoc reordering', () => {
  const engine = createEngine({ rng: seededRng(50) });
  const ordered = engine.Combat.rollOrder(PARTICIPANTS);
  assert.equal(ordered.length, PARTICIPANTS.length);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(ordered[i - 1].initiative >= ordered[i].initiative);
  }
});
