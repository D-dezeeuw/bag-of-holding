// validateAdventure — the format's promises, proven from both sides:
// the shipped pack validates clean against its own mounted registries,
// and every class of authoring mistake yields its named error (the
// error-list style: all problems at once, never fix-one-rerun).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Adventures, QUIET_STAIR, QUIET_STAIR_MONSTERS, QUIET_STAIR_ITEMS,
} from '../index.js';

const { validateAdventure } = Adventures;
const engine = createEngine({ extraMonsters: QUIET_STAIR_MONSTERS, extraItems: QUIET_STAIR_ITEMS });
const REGISTRIES = { monsters: engine.monsters, items: engine.items };

// A pack is frozen; to break one for a negative test, clone deep.
const clone = () => JSON.parse(JSON.stringify(QUIET_STAIR));

test('THE SMOKE TEST: the shipped adventure validates clean against its own registries', () => {
  const verdict = validateAdventure(QUIET_STAIR, REGISTRIES);
  assert.deepEqual(verdict, { valid: true, errors: [] });
});

test('every reference class fails with its named error', () => {
  const broken = clone();
  broken.scenes[2].encounter.monsters[0].id = 'creature-of-nowhere';      // unknown monster
  broken.scenes[1].treasure[0] = 'sword-of-nowhere';                      // unknown treasure
  broken.beats[0].requiredArchetypes[0].role = 'mentor';                  // castable by no pack npc
  broken.scenes[0].exits[0].to = 'scene.nowhere';                         // dangling exit
  broken.scenes[6].exits = [{ to: 'scene.bell-crypt', requiresFlag: 'qs.flag-nobody-sets' }]; // unopenable gate

  const { valid, errors } = validateAdventure(broken, REGISTRIES);
  assert.equal(valid, false);
  const text = errors.join('\n');
  assert.match(text, /'creature-of-nowhere' is not in the registry/);
  assert.match(text, /'sword-of-nowhere' is not in the item registry/);
  assert.match(text, /no pack npc can cast 'mentor'/);
  assert.match(text, /exit to 'scene.nowhere' is not a scene/);
  assert.match(text, /'qs.flag-nobody-sets', which no beat sets/);
  assert.ok(errors.length >= 5, 'all problems at once, not the first one');
});

test('an unreachable scene is dead content, and dead content fails', () => {
  const broken = clone();
  // Cut the only road into the bell-tower.
  broken.scenes[0].exits = [];
  const { errors } = validateAdventure(broken, REGISTRIES);
  assert.ok(errors.some((e) => /scene\.bell-tower is unreachable/.test(e)));
});

test('intendedDifficulty is a claim the classifier re-derives — drift fails', () => {
  const broken = clone();
  // The landing skirmish is exactly 600 XP = the low floor. Doubling the
  // lurkers (4×200 + 2×100 = 1000 XP) pushes it into 'moderate'.
  broken.scenes[2].encounter.monsters[0].count = 4;
  const { errors } = validateAdventure(broken, REGISTRIES);
  assert.ok(errors.some((e) => /intendedDifficulty 'low' but the composition classifies 'moderate'/.test(e)),
    `expected the drift error, got:\n${errors.join('\n')}`);

  // And the climax is pinned at EXACTLY 1600 (the 'high' band is an
  // exact match for 4 × L3): removing the husk drops it to 'moderate'.
  const softened = clone();
  softened.scenes[6].encounter.monsters = softened.scenes[6].encounter.monsters.slice(0, 2);
  const softErr = validateAdventure(softened, REGISTRIES).errors;
  assert.ok(softErr.some((e) => /intendedDifficulty 'high' but the composition classifies 'moderate'/.test(e)));
});

test('structural junk is refused before reference checking', () => {
  assert.equal(validateAdventure(null, REGISTRIES).valid, false);
  const bare = validateAdventure({ id: 'x', title: 'X', start: 's' }, REGISTRIES);
  assert.equal(bare.valid, false);
  assert.ok(bare.errors.some((e) => /non-empty beats/.test(e)));
  assert.ok(bare.errors.some((e) => /partyProfile.levels/.test(e)));

  const dupes = clone();
  dupes.beats.push({ ...dupes.beats[0] });
  dupes.scenes.push({ ...dupes.scenes[0] });
  const { errors } = validateAdventure(dupes, REGISTRIES);
  assert.ok(errors.some((e) => /duplicate beat id/.test(e)));
  assert.ok(errors.some((e) => /duplicate scene id/.test(e)));

  const badNpc = clone();
  badNpc.npcs = { ...badNpc.npcs, ghost: { id: 'ghost', name: 'G', archetypeRole: 'muse', statBlockId: 'nothing' } };
  const npcErrs = validateAdventure(badNpc, REGISTRIES).errors;
  assert.ok(npcErrs.some((e) => /unknown archetypeRole 'muse'/.test(e)));
  assert.ok(npcErrs.some((e) => /statBlockId 'nothing' is not in the monster registry/.test(e)));
});

test('the pack refuses to validate against BARE registries — the mount matters', () => {
  // Against the SRD-only registries (no extraMonsters/extraItems), every
  // invented creature and item in the pack correctly fails to resolve.
  const bare = createEngine();
  const { valid, errors } = validateAdventure(QUIET_STAIR, { monsters: bare.monsters, items: bare.items });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => /'cellar-lurker' is not in the registry/.test(e)),
    'the adventure only exists on an engine that mounted its packs');
});
