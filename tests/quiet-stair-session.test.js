// The Quiet Stair through a REAL session — the milestone's "the sandbox
// has something to drive" proof, in CI. One seeded engine mounts the
// packs, one Session runs the party, one run walks the adventure: hire,
// influence Brann, fight the landing to a body count, loot and attune
// (dawn recharges the lantern, the cursed signet refuses to leave),
// serialize mid-adventure, restore, and finish. Every die is in the
// engine's replay stream.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Dice, Adventures, STARTER_PARTY,
  QUIET_STAIR, QUIET_STAIR_MONSTERS, QUIET_STAIR_ITEMS,
} from '../index.js';

const { createRun, setFlag, currentScene, activeBeat, goTo, encounterParticipants } = Adventures;

const SEED = 90;
const mount = () => createEngine({
  rng: Dice.seededRng(SEED),
  extraMonsters: QUIET_STAIR_MONSTERS,
  extraItems: QUIET_STAIR_ITEMS,
});

test('a full sitting: session + run from the gate to the crypt, saved and restored midway', () => {
  const engine = mount();
  const session = engine.Session.create({ engine, seed: SEED, party: STARTER_PARTY });
  let run = createRun(QUIET_STAIR);

  // === Act 1: the Warden hires the party; Brann is Influenced. =========
  session.record('scene', { sceneId: run.sceneId });
  run = setFlag(run, 'qs.hired');
  run = goTo(QUIET_STAIR, run, 'scene.bell-tower').run;

  // The social verb is the mechanism, not a vibe: influence spends the
  // action and owes the host a check.
  const parley = engine.Combat.influence(
    engine.Combat.startEncounter([{ id: 'thora', dexterity: 12, speed: 30 }]),
    { id: 'thora' });
  assert.equal(parley.result.needsCheck, true);
  run = setFlag(run, 'qs.learned-bell');

  // === Act 2: the landing skirmish, driven through the Session. ========
  run = goTo(QUIET_STAIR, run, 'scene.the-landing').run;
  const landing = currentScene(QUIET_STAIR, run);
  const foes = encounterParticipants(landing, engine.monsters);
  const partyParticipants = STARTER_PARTY.map((r) => {
    const sheet = engine.deriveSheet(r);
    return {
      id: r.id, name: r.name, dexterity: sheet.abilityScores.final.dex,
      speed: sheet.speed.walk, hp: sheet.hp.max, hpMax: sheet.hp.max, ac: sheet.ac.value,
    };
  });
  session.startEncounter([...partyParticipants, ...foes]);
  assert.equal(session.encounter.order.length, 8, 'four PCs, four foes, one initiative order');

  // The party grinds the landing down — seeded, so this always ends.
  const swords = partyParticipants.map((p) => p.id);
  let rounds = 0;
  const standing = () => foes.filter((f) => (session.actor(f.id)?.hp ?? 0) > 0);
  while (standing().length && rounds < 60) {
    rounds++;
    for (const pc of swords) {
      const target = standing()[0];
      if (!target) break;
      session.attack({ attackerId: pc, targetId: target.id, attackBonus: 5, damageDice: '1d8', damageMod: 3, damageType: 'slashing' });
    }
    session.endTurn();
  }
  assert.equal(standing().length, 0, `the landing falls (${rounds} rounds)`);
  session.endEncounter();
  run = setFlag(run, 'qs.reached-undercroft');

  // === Loot: attune the lantern, spend it, and let dawn pay it back. ===
  let bearer = session.actor('thora');
  const lantern = engine.items['hush-lantern'];
  const attuned = engine.MagicItems.attune(bearer, lantern);
  assert.equal(attuned.ok, true);
  bearer = attuned.actor;
  bearer = engine.MagicItems.spendCharge(bearer, 'hush-lantern', 3).actor;
  assert.equal(bearer.itemCharges['hush-lantern'].used, 3);
  // A long rest rolls the scene clock through dawn; the host's dawn
  // handler is a rechargeItem call — through the ENGINE binding, so the
  // recovery die joins the same replay stream as the attack rolls.
  session.longRest();
  const dawn = engine.MagicItems.rechargeItem(bearer, lantern);
  assert.equal(dawn.ok, true);
  bearer = dawn.actor;
  assert.equal(bearer.itemCharges['hush-lantern'].used, 0, 'dawn refills what the crypt spent');

  // The cursed signet: worn mid-run, refuses mid-run.
  const sworn = engine.MagicItems.attune(bearer, engine.items['oathkeepers-signet']);
  assert.equal(sworn.ok, true);
  assert.equal(engine.MagicItems.unattune(sworn.actor, engine.items['oathkeepers-signet']).ok, false,
    'a sworn hand does not let go in the middle of an adventure either');

  // === Save mid-adventure; restore into a fresh engine; keep playing. ==
  run = setFlag(run, 'qs.found-the-bell');
  const savedSession = session.serialize();
  const savedRun = JSON.stringify(run);

  const engine2 = createEngine({
    rng: Dice.seededRng(SEED),
    extraMonsters: QUIET_STAIR_MONSTERS,
    extraItems: QUIET_STAIR_ITEMS,
  });
  const revivedSession = engine2.Session.restore(savedSession, engine2);
  const revivedRun = JSON.parse(savedRun);
  assert.equal(revivedSession.seed, SEED);
  assert.equal(activeBeat(revivedRun).id, 'beat.05.parley-in-the-dark',
    'the save landed exactly where the story stood');

  // === Act 3: the parley and the quieting, on the revived state. =======
  // The revived party stands on the landing; the road runs through the
  // gallery to the chancel before the crypt opens.
  let ending = revivedRun;
  ending = goTo(QUIET_STAIR, ending, 'scene.flooded-gallery').run;
  ending = goTo(QUIET_STAIR, ending, 'scene.drowned-chancel').run;
  ending = setFlag(ending, 'qs.vel-answered');
  ending = goTo(QUIET_STAIR, ending, 'scene.bell-crypt').run;
  assert.equal(currentScene(QUIET_STAIR, ending).id, 'scene.bell-crypt');
  ending = setFlag(ending, 'qs.stair-quiet');
  assert.equal(activeBeat(ending), null, 'the stair is quiet; the thread is done');

  // And the first engine's whole sitting replays: every d20, every
  // damage die, every recharge — one verified stream.
  const verdict = engine.verifyLog({ seed: SEED, log: engine.rollLog });
  assert.equal(verdict.ok, true, 'the entire sitting is reproducible from its seed');
});
