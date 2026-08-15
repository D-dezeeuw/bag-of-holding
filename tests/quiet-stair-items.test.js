// The Quiet Stair item batch — 8 items that exercise the 1.9 magic-item
// lifecycle end to end. The headliner: the Oathkeeper's Signet is the
// FIRST cursed item in the package, so the unattune refusal branch
// (magic-items.js) finally runs against shipped data instead of nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, QUIET_STAIR_ITEMS } from '../index.js';
// The rng-controlled assertions use the UNBOUND module functions: the
// engine binding deliberately substitutes the engine's own rng (so play
// rolls land in the replay log), which is exactly wrong for a test that
// wants to pin the die face.
import { rechargeItem, itemSavingThrow } from '../src/magic-items.js';

const engine = createEngine({ extraItems: QUIET_STAIR_ITEMS });
const MI = engine.MagicItems;
const item = (id) => engine.items[id];

test('all 8 mount through the plugin validator with the declared mix', () => {
  const ids = Object.keys(QUIET_STAIR_ITEMS);
  assert.equal(ids.length, 8);
  for (const id of ids) assert.ok(engine.items[id], `${id} merged into the registry`);
  // The roadmap's exact mix: one charged, one cursed, one consumable,
  // and mundane keyed items alongside the sparkle.
  assert.deepEqual(ids.filter((id) => item(id).charges), ['hush-lantern']);
  assert.deepEqual(ids.filter((id) => item(id).cursed), ['oathkeepers-signet']);
  assert.deepEqual(ids.filter((id) => item(id).type === 'consumable'), ['draught-of-the-clear-bell']);
  assert.deepEqual(ids.filter((id) => item(id).type === 'gear'), ['brass-stair-key', 'sextons-ledger']);
});

test('the charged lifecycle: attune → spend to empty → refuse → dawn recharge', () => {
  let actor = { id: 'pc', abilityScores: { dex: 14 } };
  const lantern = item('hush-lantern');

  const a = MI.attune(actor, lantern);
  assert.equal(a.ok, true);
  actor = a.actor;
  assert.deepEqual(actor.itemCharges['hush-lantern'], { used: 0, max: 6 },
    'attuning stamps the full pool');

  for (let i = 0; i < 6; i++) {
    const s = MI.spendCharge(actor, 'hush-lantern');
    assert.equal(s.ok, true, `charge ${i + 1} spends`);
    actor = s.actor;
  }
  assert.equal(actor.itemCharges['hush-lantern'].used, 6);
  assert.equal(MI.spendCharge(actor, 'hush-lantern').ok, false, 'an empty lantern refuses');

  // Dawn: recovers 1d4+2, capped at max (used never goes below 0).
  // Seeded rng makes the roll exact: top face 4, +2 → recovers 6 of 6.
  const seeded = () => 0.999;
  const r = rechargeItem(actor, lantern, seeded);
  assert.equal(r.ok, true);
  assert.equal(r.recovered, 6);
  assert.deepEqual(r.actor.itemCharges['hush-lantern'], { used: 0, max: 6 },
    'recovered to (and never past) full');
});

test('the cursed signet: the first data through the refusal branch', () => {
  let actor = { id: 'pc' };
  const signet = item('oathkeepers-signet');

  const a = MI.attune(actor, signet);
  assert.equal(a.ok, true);
  actor = a.actor;

  const refused = MI.unattune(actor, signet);
  assert.equal(refused.ok, false, 'a sworn hand does not let go');
  assert.match(refused.reason, /cursed/, 'and the reason says why');
  assert.ok(actor.attunedItems.includes('oathkeepers-signet'), 'still attuned after the refusal');

  const freed = MI.unattune(actor, signet, { removeCurseApplied: true });
  assert.equal(freed.ok, true, 'Remove Curse clears the way');
  assert.ok(!freed.actor.attunedItems.includes('oathkeepers-signet'));
});

test('attunement prerequisites: the amulet wants a caster, the cloak wants grace', () => {
  const amulet = item('bell-shard-amulet');
  const cloak = item('cloak-of-settled-dust');

  assert.equal(MI.canAttune({ id: 'martial' }, amulet).ok, false);
  assert.match(MI.canAttune({ id: 'martial' }, amulet).reason, /spellcasting/);
  assert.equal(MI.canAttune({ id: 'caster', spellcaster: true }, amulet).ok, true);

  assert.equal(MI.canAttune({ id: 'clumsy', abilityScores: { dex: 10 } }, cloak).ok, false);
  assert.match(MI.canAttune({ id: 'clumsy', abilityScores: { dex: 10 } }, cloak).reason, /DEX 13/);
  assert.equal(MI.canAttune({ id: 'nimble', abilityScores: { dex: 14 } }, cloak).ok, true);

  // The 3-slot cap holds across the batch.
  const full = { id: 'pc', spellcaster: true, abilityScores: { dex: 16 },
    attunedItems: ['hush-lantern', 'oathkeepers-signet', 'blade-of-the-last-watch'] };
  assert.equal(MI.canAttune(full, amulet).ok, false);
  assert.match(MI.canAttune(full, amulet).reason, /cap/);
});

test('the blade resists destruction; the ledger identifies; the draught heals', () => {
  const blade = item('blade-of-the-last-watch');
  const win = itemSavingThrow(blade, 10, () => 0.999);   // d20 top face + 5
  assert.equal(win.success, true);
  assert.equal(win.total, 25);
  const loss = itemSavingThrow(blade, 10, () => 0);      // d20 bottom face + 5
  assert.equal(loss.success, false);
  assert.equal(loss.total, 6);
  // A mundane key has no save and survives routine damage by convention.
  assert.equal(itemSavingThrow(item('brass-stair-key'), 15).noSave, true);

  const read = MI.identifyItem({ id: 'pc' }, 'sextons-ledger');
  assert.ok(read.identifiedItems.includes('sextons-ledger'));
  assert.equal(MI.isIdentified(read, 'sextons-ledger'), true);

  const heals = engine.Dice.parse(item('draught-of-the-clear-bell').heals);
  assert.deepEqual(heals, { count: 2, sides: 4, modifier: 2 }, 'the draught heals like a potion');
});
