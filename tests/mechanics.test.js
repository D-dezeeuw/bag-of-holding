import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshResource,
  freshResources,
  spendResource,
  refreshResources,
  applyMechanic,
  REFRESH_KINDS
} from '../src/mechanics.js';
import fighter from '../src/classes/fighter.js';
import rogue from '../src/classes/rogue.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';

const scriptedRng = (faces, sides = 10) => {
  let i = 0;
  return () => (faces[i++] - 1) / sides;
};

// === freshResource ===

test('REFRESH_KINDS lists the three SRD-compatible refresh tags', () => {
  assert.deepEqual([...REFRESH_KINDS].sort(), ['day', 'long', 'short']);
});

test('freshResource starts at full capacity', () => {
  assert.deepEqual(
    freshResource({ max: 3, refreshes: 'short' }),
    { used: 0, max: 3, refreshes: 'short' }
  );
});

test('freshResource rejects negative or non-integer max', () => {
  assert.throws(() => freshResource({ max: -1, refreshes: 'short' }));
  assert.throws(() => freshResource({ max: 1.5, refreshes: 'short' }));
});

test('freshResource rejects an unknown refresh tag', () => {
  assert.throws(() => freshResource({ max: 1, refreshes: 'turn' }));
});

// === freshResources ===

test('freshResources builds the class def map at a given level', () => {
  const resources = freshResources(fighter, 5);
  assert.deepEqual(resources.secondWind, { used: 0, max: 1, refreshes: 'short' });
  assert.deepEqual(resources.actionSurge, { used: 0, max: 1, refreshes: 'short' });
});

test('freshResources returns {} for classes without a resources table', () => {
  // Rogue carries `mechanics` but no `resources` map.
  assert.deepEqual(freshResources(rogue, 5), {});
});

test('freshResources tolerates a null classDef', () => {
  assert.deepEqual(freshResources(null, 1), {});
});

test('freshResources evaluates level-dependent max functions', () => {
  // Synthetic class with `max: level => level * 2`.
  const cls = {
    resources: {
      brawn: { max: (level) => level * 2, refreshes: 'long' }
    }
  };
  const r = freshResources(cls, 4);
  assert.equal(r.brawn.max, 8);
});

test('freshResources omits resources whose max evaluates to 0', () => {
  const cls = {
    resources: {
      sapience: { max: (level) => Math.max(0, level - 5), refreshes: 'long' }
    }
  };
  assert.deepEqual(freshResources(cls, 3), {});
});

// === spendResource ===

test('spendResource increments used and returns the new actor', () => {
  const actor = { id: 'pc', resources: freshResources(fighter, 1) };
  const result = spendResource(actor, 'secondWind');
  assert.equal(result.ok, true);
  assert.equal(result.actor.resources.secondWind.used, 1);
  assert.equal(result.actor.resources.actionSurge.used, 0);
});

test('spendResource refuses when the pool is empty', () => {
  const actor = {
    id: 'pc',
    resources: { secondWind: { used: 1, max: 1, refreshes: 'short' } }
  };
  const result = spendResource(actor, 'secondWind');
  assert.equal(result.ok, false);
  assert.match(result.reason, /not enough secondWind/);
});

test('spendResource refuses an unknown resource id', () => {
  const actor = { id: 'pc', resources: {} };
  const result = spendResource(actor, 'somethingElse');
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown resource/);
});

test('spendResource refuses when no resources at all are initialised', () => {
  const actor = { id: 'pc' };
  const result = spendResource(actor, 'rage');
  assert.equal(result.ok, false);
});

test('spendResource supports spending more than one unit at a time', () => {
  const actor = {
    id: 'pc',
    resources: { sorceryPoints: { used: 0, max: 5, refreshes: 'long' } }
  };
  const r = spendResource(actor, 'sorceryPoints', 3);
  assert.equal(r.ok, true);
  assert.equal(r.actor.resources.sorceryPoints.used, 3);
});

test('spendResource throws on a non-positive amount', () => {
  const actor = { id: 'pc', resources: freshResources(fighter, 1) };
  assert.throws(() => spendResource(actor, 'secondWind', 0));
  assert.throws(() => spendResource(actor, 'secondWind', -1));
  assert.throws(() => spendResource(actor, 'secondWind', 1.5));
});

// === refreshResources ===

test('refreshResources(short) zeroes short-tagged counters only', () => {
  const actor = {
    id: 'pc',
    resources: {
      secondWind: { used: 1, max: 1, refreshes: 'short' },
      lay: { used: 3, max: 5, refreshes: 'long' }
    }
  };
  const next = refreshResources(actor, 'short');
  assert.equal(next.resources.secondWind.used, 0);
  assert.equal(next.resources.lay.used, 3);
});

test('refreshResources(long) zeroes both short- and long-tagged counters', () => {
  const actor = {
    id: 'pc',
    resources: {
      secondWind: { used: 1, max: 1, refreshes: 'short' },
      lay: { used: 5, max: 5, refreshes: 'long' },
      daily: { used: 1, max: 1, refreshes: 'day' }
    }
  };
  const next = refreshResources(actor, 'long');
  assert.equal(next.resources.secondWind.used, 0);
  assert.equal(next.resources.lay.used, 0);
  assert.equal(next.resources.daily.used, 1);   // day not touched by long
});

test('refreshResources(all) resets every counter including day-tagged', () => {
  const actor = {
    id: 'pc',
    resources: { daily: { used: 1, max: 1, refreshes: 'day' } }
  };
  const next = refreshResources(actor, 'all');
  assert.equal(next.resources.daily.used, 0);
});

test('refreshResources is a no-op on an actor without resources', () => {
  const actor = { id: 'pc' };
  assert.equal(refreshResources(actor, 'short'), actor);
});

test('refreshResources returns the same reference when nothing changes', () => {
  const actor = {
    id: 'pc',
    resources: { secondWind: { used: 0, max: 1, refreshes: 'short' } }
  };
  // Already at 0/1 — refresh has nothing to do.
  assert.equal(refreshResources(actor, 'short'), actor);
});

test('refreshResources rejects an unknown rest kind', () => {
  const actor = { id: 'pc', resources: freshResources(fighter, 1) };
  assert.throws(() => refreshResources(actor, 'nap'));
});

// === applyMechanic dispatch ===

test('applyMechanic dispatches Fighter Second Wind end-to-end', () => {
  let actor = {
    id: 'pc', level: 3,
    abilityScores: { con: 12 }, hp: 5, hpMax: 30,
    resources: freshResources(fighter, 3)
  };
  // d10 face 6, +3 level = 9 healed → hp 14.
  const result = applyMechanic(
    { actor, classDef: fighter, id: 'secondWind' },
    scriptedRng([6], 10)
  );
  assert.equal(result.ok, true);
  assert.equal(result.die, 6);
  assert.equal(result.healed, 9);
  assert.equal(result.hpAfter, 14);
  assert.equal(result.actor.resources.secondWind.used, 1);
});

test('applyMechanic throws on an unknown mechanic id', () => {
  const actor = { id: 'pc', resources: {} };
  assert.throws(() => applyMechanic({ actor, classDef: fighter, id: 'wat' }));
});

test('applyMechanic throws when the class has no mechanics map', () => {
  const actor = { id: 'pc', resources: {} };
  assert.throws(() => applyMechanic({ actor, classDef: { id: 'plain' }, id: 'x' }));
});

test('applyMechanic throws when the classDef is missing entirely', () => {
  assert.throws(() => applyMechanic({ actor: { id: 'pc' }, id: 'secondWind' }));
});

// === Fighter Second Wind ===

test('Fighter Second Wind caps at hpMax', () => {
  let actor = {
    id: 'pc', level: 5,
    abilityScores: { con: 10 }, hp: 28, hpMax: 30,
    resources: freshResources(fighter, 5)
  };
  // d10 = 10, +5 = 15 raw; only 2 fits before hpMax.
  const result = applyMechanic(
    { actor, classDef: fighter, id: 'secondWind' },
    scriptedRng([10], 10)
  );
  assert.equal(result.healed, 2);
  assert.equal(result.hpAfter, 30);
});

test('Fighter Second Wind refuses a second use before a Short Rest', () => {
  let actor = {
    id: 'pc', level: 3, hp: 5, hpMax: 30,
    resources: freshResources(fighter, 3)
  };
  ({ actor } = applyMechanic({ actor, classDef: fighter, id: 'secondWind' }, scriptedRng([5], 10)));
  const second = applyMechanic({ actor, classDef: fighter, id: 'secondWind' }, scriptedRng([5], 10));
  assert.equal(second.ok, false);
});

test('Fighter Second Wind defaults level to 1 when missing', () => {
  let actor = { id: 'pc', hp: 1, hpMax: 30, resources: freshResources(fighter, 1) };
  const result = applyMechanic({ actor, classDef: fighter, id: 'secondWind' }, scriptedRng([7], 10));
  // d10=7, level=1, raw=8 → healed=8 → hp=9.
  assert.equal(result.healed, 8);
});

test('Fighter Second Wind tolerates a missing hp / hpMax', () => {
  let actor = { id: 'pc', level: 1, resources: freshResources(fighter, 1) };
  const result = applyMechanic({ actor, classDef: fighter, id: 'secondWind' }, scriptedRng([5], 10));
  assert.equal(result.hpAfter, 6);
});

// === Fighter Action Surge ===

test('Fighter Action Surge marks the use and returns extraAction', () => {
  let actor = { id: 'pc', level: 2, resources: freshResources(fighter, 2) };
  const result = applyMechanic({ actor, classDef: fighter, id: 'actionSurge' });
  assert.equal(result.ok, true);
  assert.equal(result.extraAction, true);
  assert.equal(result.actor.resources.actionSurge.used, 1);
});

test('Fighter Action Surge refuses a second use before a rest', () => {
  let actor = { id: 'pc', level: 2, resources: freshResources(fighter, 2) };
  ({ actor } = applyMechanic({ actor, classDef: fighter, id: 'actionSurge' }));
  const second = applyMechanic({ actor, classDef: fighter, id: 'actionSurge' });
  assert.equal(second.ok, false);
});

// === Rogue Sneak Attack ===

test('Rogue Sneak Attack triggers on advantage + finesse weapon, returns the dice', () => {
  const actor = { id: 'pc', level: 5 };
  const result = applyMechanic({
    actor, classDef: rogue, id: 'sneakAttack',
    args: { attackHadAdvantage: true, weaponFinesse: true }
  });
  assert.equal(result.triggers, true);
  // L5 Rogue: ⌈5/2⌉ = 3d6.
  assert.equal(result.damageDice, '3d6');
  assert.equal(result.actor.sneakAttackUsedThisTurn, true);
});

test('Rogue Sneak Attack triggers on adjacent ally + ranged weapon', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 3 },
    classDef: rogue, id: 'sneakAttack',
    args: { allyAdjacent: true, weaponRanged: true }
  });
  assert.equal(result.triggers, true);
  assert.equal(result.damageDice, '2d6');
});

test('Rogue Sneak Attack refuses with a non-finesse non-ranged weapon', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 5 },
    classDef: rogue, id: 'sneakAttack',
    args: { attackHadAdvantage: true }   // no weapon flags
  });
  assert.equal(result.triggers, false);
  assert.match(result.reason, /Finesse or Ranged/);
});

test('Rogue Sneak Attack refuses without advantage or adjacent ally', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 5 },
    classDef: rogue, id: 'sneakAttack',
    args: { weaponFinesse: true }
  });
  assert.equal(result.triggers, false);
  assert.match(result.reason, /Advantage or an adjacent ally/);
});

test('Rogue Sneak Attack fires only once per turn', () => {
  let actor = { id: 'pc', level: 5 };
  const args = { attackHadAdvantage: true, weaponFinesse: true };
  ({ actor } = applyMechanic({ actor, classDef: rogue, id: 'sneakAttack', args }));
  const second = applyMechanic({ actor, classDef: rogue, id: 'sneakAttack', args });
  assert.equal(second.triggers, false);
  assert.match(second.reason, /already used this turn/);
});

test('Rogue Sneak Attack endTurn clears the once-per-turn flag', () => {
  const actor = { id: 'pc', level: 5, sneakAttackUsedThisTurn: true };
  const { actor: next } = applyMechanic({ actor, classDef: rogue, id: 'endTurn' });
  assert.equal(next.sneakAttackUsedThisTurn, undefined);
});

test('Rogue Sneak Attack endTurn is a no-op when the flag was not set', () => {
  const actor = { id: 'pc', level: 5 };
  const { actor: next } = applyMechanic({ actor, classDef: rogue, id: 'endTurn' });
  assert.equal(next, actor);
});

test('Rogue Sneak Attack defaults the damage type to "precision" but lets args override', () => {
  const actor = { id: 'pc', level: 1 };
  const r1 = applyMechanic({
    actor, classDef: rogue, id: 'sneakAttack',
    args: { attackHadAdvantage: true, weaponFinesse: true }
  });
  assert.equal(r1.damageType, 'precision');
  const r2 = applyMechanic({
    actor, classDef: rogue, id: 'sneakAttack',
    args: { attackHadAdvantage: true, weaponFinesse: true, damageType: 'piercing' }
  });
  assert.equal(r2.damageType, 'piercing');
});

test('Rogue Sneak Attack default level falls back to 1 (1d6)', () => {
  const result = applyMechanic({
    actor: { id: 'pc' },   // no level
    classDef: rogue, id: 'sneakAttack',
    args: { attackHadAdvantage: true, weaponFinesse: true }
  });
  assert.equal(result.damageDice, '1d6');
});

// === Rest integration ===

test('Long Rest refreshes Fighter Second Wind / Action Surge', async () => {
  const { longRest } = await import('../src/rest.js');
  const exhausted = {
    id: 'pc', level: 3, hitDie: 10, hitDiceTotal: 3, hp: 0, hpMax: 30,
    resources: {
      secondWind: { used: 1, max: 1, refreshes: 'short' },
      actionSurge: { used: 1, max: 1, refreshes: 'short' }
    }
  };
  const rested = longRest(exhausted);
  assert.equal(rested.resources.secondWind.used, 0);
  assert.equal(rested.resources.actionSurge.used, 0);
});

test('Short Rest refreshes Fighter short-tagged resources but leaves long-tagged alone', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    resources: {
      secondWind: { used: 1, max: 1, refreshes: 'short' },
      lay: { used: 5, max: 25, refreshes: 'long' }
    }
  };
  const rested = shortRest(actor);
  assert.equal(rested.resources.secondWind.used, 0);
  assert.equal(rested.resources.lay.used, 5);
});

test('Short Rest also refills warlock pact slots', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    spellSlots: [{ level: 3, used: 2, max: 2, source: 'pact' }]
  };
  const rested = shortRest(actor);
  assert.equal(rested.spellSlots[0].used, 0);
});

test('Short Rest leaves a non-pact spell slot pool untouched', async () => {
  const { shortRest } = await import('../src/rest.js');
  const actor = {
    id: 'pc', level: 5,
    spellSlots: [{ level: 1, used: 3, max: 4 }]
  };
  const rested = shortRest(actor);
  assert.equal(rested.spellSlots[0].used, 3);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches against the registered class', () => {
  const engine = createEngine({ rng: seededRng(1) });
  let actor = {
    id: 'pc', classId: 'fighter', level: 3,
    abilityScores: { con: 12 }, hp: 5, hpMax: 30,
    resources: engine.Mechanics.freshResources(engine.classes.fighter, 3)
  };
  const result = engine.Mechanics.apply(actor, 'secondWind', {}, 'turn 1');
  assert.equal(result.ok, true);
  assert.ok(result.die > 0 && result.die <= 10);
  // The die was logged.
  const last = engine.rollLog.at(-1);
  assert.equal(last.op, 'rollDie');
  assert.equal(last.sides, 10);
  assert.equal(last.context, 'turn 1');
});

test('engine.Mechanics.apply throws on an unknown class', () => {
  const engine = createEngine();
  assert.throws(() => engine.Mechanics.apply({ id: 'pc', classId: 'spaceknight' }, 'x'));
});

test('engine.Mechanics.apply throws on an unknown mechanic', () => {
  const engine = createEngine();
  assert.throws(() => engine.Mechanics.apply({ id: 'pc', classId: 'fighter' }, 'breathe'));
});

test('engine.Mechanics.apply throws when the class has no mechanics at all', () => {
  // Inject a plain class through extraClasses (no mechanics field).
  const engine = createEngine({
    extraClasses: { 'plain': { id: 'plain', name: 'Plain', hitDie: 6 } }
  });
  assert.throws(() => engine.Mechanics.apply({ id: 'pc', classId: 'plain' }, 'wave'));
});

test('engine.Mechanics.apply defaults args to {} when omitted', () => {
  // Rogue.endTurn doesn't read args at all — covers the
  // `args ?? {}` fallback in the engine binding.
  const engine = createEngine();
  const result = engine.Mechanics.apply({ id: 'pc', classId: 'rogue', level: 1 }, 'endTurn');
  assert.equal(result.actor.id, 'pc');
});

test('engine.Mechanics.apply with no context still works (covers context=undefined branch)', () => {
  const engine = createEngine();
  const actor = {
    id: 'pc', classId: 'fighter', level: 2,
    resources: engine.Mechanics.freshResources(engine.classes.fighter, 2)
  };
  const result = engine.Mechanics.apply(actor, 'actionSurge');
  assert.equal(result.ok, true);
});

test('engine.Rest.longRest refreshes class resources via the binding', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'fighter', level: 3,
    hitDie: 10, hitDiceTotal: 3, hp: 0, hpMax: 30,
    resources: engine.Mechanics.freshResources(engine.classes.fighter, 3)
  };
  // Spend Second Wind first.
  ({ actor } = engine.Mechanics.apply({ ...actor, hp: 5 }, 'secondWind'));
  assert.equal(actor.resources.secondWind.used, 1);
  const rested = engine.Rest.longRest(actor);
  assert.equal(rested.resources.secondWind.used, 0);
});

test('engine.Rest.shortRest is exposed and refreshes short-tagged resources', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'fighter', level: 2,
    resources: engine.Mechanics.freshResources(engine.classes.fighter, 2)
  };
  ({ actor } = engine.Mechanics.apply(actor, 'actionSurge'));
  const rested = engine.Rest.shortRest(actor);
  assert.equal(rested.resources.actionSurge.used, 0);
});

// === Type-level surface ===

test('engine.Mechanics re-exports freshResource / spendResource / refreshResources', () => {
  const engine = createEngine();
  assert.equal(typeof engine.Mechanics.freshResource, 'function');
  assert.equal(typeof engine.Mechanics.spendResource, 'function');
  assert.equal(typeof engine.Mechanics.refreshResources, 'function');
  assert.equal(typeof engine.Mechanics.freshResources, 'function');
  assert.deepEqual([...engine.Mechanics.REFRESH_KINDS].sort(), ['day', 'long', 'short']);
});
