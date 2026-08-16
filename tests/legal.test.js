// The legal sweep — the kernel's first (the client repo has had one since
// its content tables grew; this file lands with the first INVENTED kernel
// content, the Quiet Stair packs).
//
// docs/legal.md draws the line: SRD 5.2-listed names are fine under
// CC-BY-4.0; Wizards' Product Identity (creatures, named characters,
// settings, published-module specifics) is not, anywhere, ever — not in a
// name, not in a trait string, not in a flavor comment that ships as data.
// This test walks every string in every shipped data table against the
// same forbidden list the client enforces, so a lapse fails CI instead of
// shipping.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import monsters from '../src/srd/monsters.js';
import items from '../src/srd/items.js';
import { QUIET_STAIR_MONSTERS } from '../src/adventures/quiet-stair/monsters.js';
import { QUIET_STAIR_ITEMS } from '../src/adventures/quiet-stair/items.js';
import { QUIET_STAIR } from '../src/adventures/quiet-stair/adventure.js';
import { QUIET_STAIR_NPCS } from '../src/adventures/quiet-stair/npcs.js';
import { BESTIARY_I } from '../src/bestiary/bestiary-i.js';

const FORBIDDEN = [
  // Product Identity creatures
  'beholder', 'mind flayer', 'illithid', 'yuan-ti', 'yuanti', 'slaad',
  'displacer beast', 'carrion crawler', 'githyanki', 'githzerai', 'kuo-toa',
  'modron',
  // Characters Wizards owns
  'mordenkainen', 'tasha', 'bigby', 'tenser', 'drizzt', 'elminster',
  'acererak', 'strahd', 'vecna',
  // Setting names
  'forgotten realms', 'eberron', 'greyhawk', 'faerun', 'faerûn', 'waterdeep',
  'neverwinter', 'sword coast', 'underdark', 'feywild', 'shadowfell',
  'dragonlance', 'ravenloft',
  // Deities from published settings
  'kelemvor', 'myrkul', 'raven queen', 'tempus', 'gruumsh', 'silvanus',
  'mielikki', 'chauntea', 'cyric', 'lolth', 'lathander', 'pelor', 'oghma',
  'mystra', 'azuth', 'umberlee', 'moradin', 'ilmater', 'lliira', 'boldrei',
  'jergal', 'wee jas', 'pholtus', 'aureon', 'selune', 'sehanine', 'celestian',
  'corellon', 'boccob', 'erythnul', 'tharizdun', 'procan', 'sashelas',
  'malar', 'ehlonna', 'obad-hai', 'celanil', 'dal quor',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERN = new RegExp(`\\b(${FORBIDDEN.map(escape).join('|')})\\b`, 'i');

// Collect every string reachable in a value, with the path that found it.
function strings(value, path = '$', out = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
  return out;
}

function offendersIn(table, label) {
  return strings(table, label)
    .filter(([, s]) => PATTERN.test(s))
    .map(([path, s]) => `${path}: "${s}"`);
}

test('the SRD registries carry no Product Identity names', () => {
  const bad = [...offendersIn(monsters, 'srd/monsters'), ...offendersIn(items, 'srd/items')];
  assert.deepEqual(bad, [], `forbidden names in SRD registries:\n${bad.slice(0, 10).join('\n')}`);
});

test('the Quiet Stair packs are invented all the way down', () => {
  const bad = [
    ...offendersIn(QUIET_STAIR_MONSTERS, 'quiet-stair/monsters'),
    ...offendersIn(QUIET_STAIR_ITEMS, 'quiet-stair/items'),
    // The whole adventure — beats' dramaticPurpose, scene titles and
    // readAloud prose, npc names/voice/wants — ships to players; every
    // string in it is scanned, not just the ids.
    ...offendersIn(QUIET_STAIR, 'quiet-stair/adventure'),
    ...offendersIn(QUIET_STAIR_NPCS, 'quiet-stair/npcs'),
    ...offendersIn(BESTIARY_I, 'bestiary-i'),
  ];
  assert.deepEqual(bad, [], `forbidden names in Quiet Stair packs:\n${bad.slice(0, 10).join('\n')}`);
  // And no pack id shadows an SRD id — the packs ADD, they never replace
  // (last-write-wins in mergeRegistry would silently swap a rulebook
  // creature for a homebrew one).
  for (const id of Object.keys(QUIET_STAIR_MONSTERS)) {
    assert.ok(!(id in monsters), `${id} shadows an SRD monster`);
  }
  for (const id of Object.keys(QUIET_STAIR_ITEMS)) {
    assert.ok(!(id in items), `${id} shadows an SRD item`);
  }
  for (const id of Object.keys(BESTIARY_I)) {
    assert.ok(!(id in monsters), `${id} shadows an SRD monster`);
  }
});
