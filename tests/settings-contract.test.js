// The setting plugin contract (3.3.0). What must hold: all three
// shipped packs validate clean (the contract describes what they
// already are); broken packs fail with pointers, not booleans;
// registerSetting throws the full report; composeSettings mounts TWO
// settings into one engine for crossover play with every registry
// filled from both; and cross-pack id collisions refuse loudly instead
// of last-write-winning.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Adventures, Settings, TREASURY,
  SUNDERMARK, BRASSGEAR, HOLLOW_VALE,
  THE_SINGING_TOWER, BRAMBLEFELL,
} from '../index.js';

test('the three shipped packs validate clean — the contract describes them', () => {
  for (const pack of [SUNDERMARK, BRASSGEAR, HOLLOW_VALE]) {
    const verdict = Settings.validate(pack);
    assert.deepEqual(verdict.errors, [], `${pack.id} validates`);
    assert.equal(verdict.valid, true);
  }
});

test('broken packs fail with pointers; registerSetting throws the report', () => {
  const broken = {
    id: 'broken-pack', name: 'Broken', pitch: 'A pack with holes.',
    regions: { 'r-1': { id: 'r-1', name: 'Region One', cities: ['no-such-city'] } },
    cities: {
      'c-1': { id: 'c-1', name: 'City One', regionId: 'no-such-region', hooks: ['h-1'] },
    },
    hooks: {
      'h-1': { id: 'h-1', title: 'Hook One', cityId: 'SOMEWHERE-ELSE', factionId: 'ghost-faction' },
      'h-2': { id: 'mismatched', title: 'Hook Two' },
    },
    factions: { 'f-1': { id: 'f-1', name: 'Faction One', seat: 'no-such-city', enemies: ['ghost-faction'] } },
  };
  const verdict = Settings.validate(broken);
  assert.equal(verdict.valid, false);
  const text = verdict.errors.join('\n');
  assert.match(text, /regions\.r-1: city 'no-such-city'/);
  assert.match(text, /cities\.c-1: regionId 'no-such-region'/);
  assert.match(text, /hook 'h-1' points at 'SOMEWHERE-ELSE'/);
  assert.match(text, /hooks\.h-1: factionId 'ghost-faction'/);
  assert.match(text, /hooks\.h-2: record id 'mismatched'/);
  assert.match(text, /factions\.f-1: seat 'no-such-city'/);
  assert.match(text, /factions\.f-1: enemy 'ghost-faction'/);
  assert.throws(() => Settings.register(broken), /failed validation:[\s\S]*ghost-faction/);
  // A valid pack passes through register unchanged.
  assert.equal(Settings.register(SUNDERMARK), SUNDERMARK);
});

test('crossover play: two settings composed into one engine', () => {
  const opts = Settings.compose(SUNDERMARK, HOLLOW_VALE);
  const engine = createEngine({ ...opts, extraItems: { ...(opts.extraItems ?? {}), ...TREASURY } });
  // Both worlds are present in the same registries.
  assert.equal(Object.keys(engine.regions).length, 6 + 8);
  assert.equal(Object.keys(engine.npcs).length, 12 + 8);
  assert.equal(Object.keys(engine.storyHooks).length, 13 + 8);
  assert.equal(Object.keys(engine.adventures).length, 2 + 1);
  assert.ok(engine.regions['the-reliquary-coast'] && engine.regions['bramblefell']);
  // Both packs' adventures validate against the SAME composed engine —
  // a crossover campaign can run either at the same table.
  for (const pack of [THE_SINGING_TOWER, BRAMBLEFELL]) {
    const verdict = Adventures.validateAdventure(pack, {
      monsters: engine.monsters, items: engine.items,
    });
    assert.equal(verdict.valid, true, `${pack.id} runs on the crossover engine`);
  }
  // All three at once also composes.
  const grand = createEngine(Settings.compose(SUNDERMARK, BRASSGEAR, HOLLOW_VALE));
  assert.equal(Object.keys(grand.regions).length, 6 + 5 + 8);
});

test('cross-pack id collisions refuse loudly instead of last-write-winning', () => {
  const rival = {
    id: 'rival-pack', name: 'Rival', pitch: 'Claims a taken id.',
    regions: { 'bramblefell': { id: 'bramblefell', name: 'A Different Bramblefell' } },
  };
  assert.throws(
    () => Settings.compose(HOLLOW_VALE, rival),
    /regions id 'bramblefell' appears in both 'hollow-vale' and 'rival-pack'/);
  // The same pack composed twice is fine (same owner, idempotent).
  const opts = Settings.compose(SUNDERMARK, SUNDERMARK);
  assert.equal(Object.keys(opts.extraRegions).length, 6);
});
