// === 1.0.0 integration / worked-example test ===
//
// One file that drives the full kernel end-to-end: build a party,
// derive their sheets, start an encounter, run a couple of rounds
// with hooks firing, apply conditions, consume spell slots, level
// up via milestone XP, and verify the roll log replays cleanly.
//
// This stands in for "real production consumer" — until a downstream
// host imports the package, this is the highest-fidelity proof that
// every namespace is wired together correctly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Dice } from '../index.js';

test('integration: full party combat round-trip', () => {
  const events = [];

  // === 1. Build engine with seeding + hooks for trace and resistance.
  const engine = createEngine({
    rng: Dice.seededRng(2026),
    hooks: {
      beforeAttack: (p) => { events.push({ kind: 'beforeAttack', ac: p.ac }); },
      afterDamage: ({ total }) => ({ total: Math.floor(total / 2) }),  // global resistance
      onConditionApplied: (p) => { events.push({ kind: 'condition', who: p.actor.id, cond: p.condition }); },
      onLevelUp: (p) => { events.push({ kind: 'levelUp', from: p.fromLevel, to: p.toLevel }); }
    }
  });

  // === 2. Derive a Wizard sheet at L3.
  const wizardRecord = {
    id: 'merlin', name: 'Merlin',
    speciesId: 'human', backgroundId: 'sage', classId: 'wizard',
    level: 3,
    abilityScores: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
    equipment: { weaponIds: ['quarterstaff'] }
  };
  const sheet = engine.deriveSheet(wizardRecord);
  assert.equal(sheet.meta.classId, 'wizard');
  assert.equal(sheet.proficiencyBonus, 2);
  assert.ok(sheet.spellcasting);
  assert.equal(sheet.spellcasting.ability, 'int');

  // === 3. Set up Merlin's spell slot bar from class progression.
  let merlinSlots = engine.Spellcasting.freshSlots('full', 3);
  assert.deepEqual(merlinSlots, [
    { level: 1, used: 0, max: 4 },
    { level: 2, used: 0, max: 2 }
  ]);

  // === 4. Start an encounter against a goblin and an orc.
  const participants = [
    { id: 'merlin', dexterity: 14, speed: 30, hp: sheet.hp.max },
    { id: 'goblin', dexterity: 14, speed: 30, hp: engine.monsters.goblin.hp },
    { id: 'orc',    dexterity: 12, speed: 30, hp: engine.monsters.orc.hp }
  ];
  let state = engine.Combat.startEncounter(participants);
  assert.equal(state.round, 1);
  assert.equal(state.order.length, 3);

  // === 5. First turn: whoever goes first uses an action and ends turn.
  let actor = engine.Combat.currentActor(state);
  let r = engine.Combat.spend(state, actor.id, 'action');
  assert.equal(r.allowed, true);
  state = r.state;
  ({ state } = engine.Combat.endTurn(state));

  // === 6. Merlin casts Magic Missile — consume an L1 slot.
  const cast = engine.Spellcasting.consumeSlot(merlinSlots, 1);
  assert.equal(cast.ok, true);
  merlinSlots = cast.slots;
  assert.equal(cast.levelCast, 1);
  assert.equal(merlinSlots[0].used, 1);

  // === 7. Apply poisoned condition to the orc — fires the hook.
  let orcActor = { id: 'orc', conditions: [] };
  orcActor = engine.Conditions.apply(orcActor, 'poisoned');
  assert.deepEqual(orcActor.conditions, ['poisoned']);
  assert.ok(events.some(e => e.kind === 'condition' && e.who === 'orc'));

  // === 8. Attack the poisoned orc — stance is normal (orc poisoned
  // gives the orc disadvantage on its attacks, not advantage on
  // attackers); verify the engine returns a stance field.
  const attack = engine.Combat.attackRoll({
    attackBonus: 5, ac: engine.monsters.orc.ac,
    target: orcActor
  });
  assert.equal(typeof attack.hit, 'boolean');
  assert.equal(['normal', 'advantage', 'disadvantage'].includes(attack.stance), true);

  // === 9. If hit, roll damage — afterDamage hook halves it.
  if (attack.hit) {
    const dmg = engine.Combat.damageRoll({ damageDice: '1d6', damageMod: 0 });
    // Resistance hook halves the post-floor result; can drop to 0
    // on a min roll. The hook is documented to override the floor.
    assert.ok(dmg.total >= 0);
  }

  // === 10. Apply prone to the goblin — moveset switches.
  const goblinPc = { id: 'goblin', classId: 'fighter', level: 1, conditions: ['prone'] };
  const proneMoveset = engine.Movesets.legal({ pc: goblinPc, scene: { mode: 'combat' } });
  assert.ok(proneMoveset.some(c => c.id === 'stand-up'));

  // === 11. Award milestone XP — push Merlin into L4, firing onLevelUp.
  const award = engine.XP.awardMilestone({
    pc: { xp: 2600, level: 3 },
    beat: { targetPlaytimeMinutes: 30 }
  });
  assert.equal(award.willLevelUp, true);
  assert.ok(events.some(e => e.kind === 'levelUp' && e.to === 4));

  // === 12. Roll log captures the session; replay it.
  assert.ok(engine.rollLog.length > 0);
  const replay = engine.verifyLog({ seed: 2026, log: engine.rollLog });
  assert.equal(replay.ok, true);

  // === 13. Sub-thread story integration.
  const mainThread = engine.Beats.createThread([
    { id: 'inn', dramaticPurpose: 'meet the patron', targetPlaytimeMinutes: 15, setRequiredFlags: ['talked.patron'] }
  ]);
  const withSide = engine.Beats.pushSubThread(mainThread, [
    { id: 'bar-brawl', dramaticPurpose: 'show off', targetPlaytimeMinutes: 5, setRequiredFlags: ['won.brawl'] }
  ]);
  assert.equal(engine.Beats.subThreadDepth(withSide), 1);
  assert.equal(engine.Beats.currentBeat(withSide).id, 'bar-brawl');
});

test('integration: monster registry is queryable by id', () => {
  const engine = createEngine();
  assert.equal(engine.monsters.goblin.cr, 0.25);
  assert.equal(engine.monsters.orc.hp, 15);
  assert.equal(engine.monsters['young-dragon-red'].cr, 10);
});

test('integration: extraMonsters plugin extension works', () => {
  const engine = createEngine({
    extraMonsters: {
      // Homebrew creature; deliberately invented (not from any
      // published product) — this test demonstrates the plugin
      // extension surface itself.
      'void-thrall': {
        id: 'void-thrall', name: 'Void Thrall', cr: 7, ac: 15, hp: 71,
        size: 'medium', speed: 30,
        abilityScores: { str: 11, dex: 12, con: 12, int: 19, wis: 17, cha: 17 }
      }
    }
  });
  assert.equal(engine.monsters['void-thrall'].cr, 7);
  // Defaults still present.
  assert.ok(engine.monsters.goblin);
});

test('integration: monster validator rejects malformed records', () => {
  assert.throws(
    () => createEngine({ extraMonsters: { bad: { id: 'bad', name: 'B' } } }),
    /missing required field/
  );
});
