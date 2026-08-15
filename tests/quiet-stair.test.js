// The Quiet Stair, played through headlessly — the run glue drives the
// Beats runtime, both branches of the descent, the casting surface, the
// encounter expansion into Session-adoptable participants, and a JSON
// round-trip mid-adventure. This is the milestone's "the CLI has
// something to drive" proof at the format level (the session-loop proof
// lands with the sandbox wiring).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Beats, Adventures, QUIET_STAIR, QUIET_STAIR_MONSTERS, QUIET_STAIR_NPCS,
  STARTER_PARTY,
} from '../index.js';

const {
  createRun, setFlag, currentScene, activeBeat, availableExits, goTo,
  encounterParticipants, entityProviderFrom,
} = Adventures;
const engine = createEngine({ extraMonsters: QUIET_STAIR_MONSTERS });

const FLAGS_IN_ORDER = [
  'qs.hired', 'qs.learned-bell', 'qs.reached-undercroft',
  'qs.found-the-bell', 'qs.vel-answered', 'qs.stair-quiet',
];

test('the golden path: flags in story order walk the thread beat by beat to done', () => {
  let run = createRun(QUIET_STAIR);
  assert.equal(currentScene(QUIET_STAIR, run).id, 'scene.wardens-gate');
  assert.equal(activeBeat(run).id, 'beat.01.the-wardens-plea');
  assert.deepEqual(availableExits(QUIET_STAIR, run), [], 'the gate is shut until the party is hired');

  // Down the gallery branch (the deterministic default: first ready successor).
  const beatsSeen = [activeBeat(run).id];
  for (const flag of FLAGS_IN_ORDER) {
    run = setFlag(run, flag);
    if (activeBeat(run)) beatsSeen.push(activeBeat(run).id);
  }
  assert.deepEqual(beatsSeen, [
    'beat.01.the-wardens-plea', 'beat.02.the-sextons-secret', 'beat.03.descent',
    'beat.04a.the-flooded-gallery', 'beat.05.parley-in-the-dark', 'beat.06.toll-or-still',
  ]);
  assert.equal(activeBeat(run), null, 'past the finale the thread is done');
  assert.equal(Beats.isComplete(QUIET_STAIR.beats.at(-1), { flags: run.flags }), true);
});

test('the branch is real: chooseSuccessor sends the party through the side-vault instead', () => {
  let run = createRun(QUIET_STAIR);
  const viaVault = ({ candidates }) =>
    candidates.includes('beat.04b.the-side-vault') ? 'beat.04b.the-side-vault' : candidates[0];
  for (const flag of FLAGS_IN_ORDER) run = setFlag(run, flag, { chooseSuccessor: viaVault });
  assert.equal(activeBeat(run), null, 'the vault path also reaches the end');
  // And the merge held: 04b's successor jumps to 05, never walking into 04a.
  let probe = createRun(QUIET_STAIR);
  for (const flag of ['qs.hired', 'qs.learned-bell', 'qs.reached-undercroft']) {
    probe = setFlag(probe, flag, { chooseSuccessor: viaVault });
  }
  assert.equal(activeBeat(probe).id, 'beat.04b.the-side-vault');
  probe = setFlag(probe, 'qs.found-the-bell');
  assert.equal(activeBeat(probe).id, 'beat.05.parley-in-the-dark');
});

test('scenes gate movement by flags; goTo refuses shut doors and walks open ones', () => {
  let run = createRun(QUIET_STAIR);
  assert.equal(goTo(QUIET_STAIR, run, 'scene.bell-tower').moved, false, 'not hired, not moving');
  run = setFlag(run, 'qs.hired');
  const step = goTo(QUIET_STAIR, run, 'scene.bell-tower');
  assert.equal(step.moved, true);
  run = step.run;
  assert.equal(currentScene(QUIET_STAIR, run).id, 'scene.bell-tower');
  // From the landing, both descent routes open on the same flag.
  run = setFlag(run, 'qs.learned-bell');
  run = goTo(QUIET_STAIR, run, 'scene.the-landing').run;
  run = setFlag(run, 'qs.reached-undercroft');
  assert.deepEqual(availableExits(QUIET_STAIR, run).map((e) => e.to).sort(),
    ['scene.flooded-gallery', 'scene.side-vault']);
});

test('casting: every beat casts fully from the pack npcs; a missing role reports itself', () => {
  const provider = entityProviderFrom(QUIET_STAIR_NPCS);
  for (const beat of QUIET_STAIR.beats) {
    const { cast, missing, error } = Beats.castArchetypes(beat, { entityProvider: provider });
    assert.equal(missing, null, `${beat.id}: ${error ?? ''}`);
    assert.ok(cast, `${beat.id} casts fully`);
  }
  // The Warden answers for authority; Vel answers for antagonist — with a
  // stat block for when the parley fails.
  assert.equal(provider({ role: 'authority' }).id, 'warden-hesk');
  assert.equal(provider({ role: 'antagonist' }).statBlockId, 'still-abbot');

  const gutted = { 'warden-hesk': QUIET_STAIR_NPCS['warden-hesk'] };
  const short = Beats.castArchetypes(QUIET_STAIR.beats[5], { entityProvider: entityProviderFrom(gutted) });
  assert.equal(short.cast, null);
  assert.equal(short.missing.role, 'antagonist');
});

test('encounter expansion is Session-adoptable and drives a REAL session encounter', () => {
  const landing = QUIET_STAIR.scenes.find((s) => s.id === 'scene.the-landing');
  const foes = encounterParticipants(landing, engine.monsters);
  assert.deepEqual(foes.map((f) => f.id), ['cellar-lurker-1', 'cellar-lurker-2', 'silt-shade-1', 'silt-shade-2']);
  for (const f of foes) {
    assert.ok(f.hp > 0 && f.ac > 0 && Number.isInteger(f.dexterity), `${f.id} carries adoptable stats`);
    assert.equal(f.side, 'foe');
  }
  // Feed them to the real Session layer (party = real character records —
  // the session derives sheets): initiative rolls, order forms.
  const session = engine.Session.create({
    engine,
    party: [STARTER_PARTY[0]],
    encounter: { participants: [
      { id: STARTER_PARTY[0].id, dexterity: 12, speed: 30, hp: 28, ac: 18 },
      ...foes,
    ] },
  });
  assert.equal(session.encounter.round, 1, 'initiative rolled over the scene composition');
  assert.ok(session.currentActor(), 'someone acts first');
  const state = session.serialize();
  assert.ok(state, 'a scene encounter is a session encounter, no adapter layer');

  assert.throws(() => encounterParticipants(
    { encounter: { monsters: [{ id: 'creature-of-nowhere' }] } }, engine.monsters), /not in the monster registry/);
});

test('a run is plain data: JSON round-trip mid-adventure resumes identically', () => {
  let run = createRun(QUIET_STAIR);
  for (const flag of ['qs.hired', 'qs.learned-bell', 'qs.reached-undercroft']) run = setFlag(run, flag);
  run = goTo(QUIET_STAIR, setFlag(run, 'qs.found-the-bell'), 'scene.bell-tower').run ?? run;

  const revived = JSON.parse(JSON.stringify(run));
  assert.deepEqual(revived, run, 'nothing in a run resists JSON');
  assert.equal(activeBeat(revived).id, activeBeat(run).id);
  // And the revived run keeps advancing — the thread survived the trip.
  const onward = setFlag(revived, 'qs.vel-answered');
  assert.equal(activeBeat(onward).id, 'beat.06.toll-or-still');
});

test('the estimated runtime is what the beats add up to — the 90-minute claim is arithmetic', () => {
  const total = QUIET_STAIR.beats
    .filter((b) => !b.id.startsWith('beat.04b'))   // one branch per playthrough
    .reduce((sum, b) => sum + b.targetPlaytimeMinutes, 0);
  assert.equal(total, QUIET_STAIR.estimatedMinutes);
});
