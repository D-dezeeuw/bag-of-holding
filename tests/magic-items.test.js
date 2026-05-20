import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RARITY_BANDS, ATTUNEMENT_CAP, RECHARGE_KINDS,
  canAttune, attune, unattune,
  spendCharge, rechargeItem,
  identifyItem, isIdentified,
  itemSavingThrow
} from '../src/magic-items.js';
import { createEngine } from '../src/engine.js';
import { seededRng } from '../src/dice.js';

// Fixtures
const cloakOfElvenkind = {
  id: 'cloak-of-elvenkind', name: 'Cloak of Elvenkind',
  rarity: 'uncommon', requiresAttunement: {}
};
const wandOfMagicMissiles = {
  id: 'wand-of-magic-missiles', name: 'Wand of Magic Missiles',
  rarity: 'uncommon',
  charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' }
};
const staffOfTheMagi = {
  id: 'staff-of-the-magi', name: 'Staff of the Magi',
  rarity: 'legendary',
  requiresAttunement: { spellcaster: true, abilityMin: { int: 13 } },
  charges: { max: 50, recovers: '4d6+2', rechargesOn: 'dawn' },
  savingThrow: { bonus: 5 }
};
const helmOfDisjunction = {
  id: 'helm-of-disjunction', name: 'Helm of Disjunction',
  rarity: 'rare',
  requiresAttunement: { classId: 'fighter' },
  cursed: true
};

// === Constants ===

test('RARITY_BANDS lists the six SRD rarities', () => {
  assert.deepEqual([...RARITY_BANDS],
    ['common', 'uncommon', 'rare', 'veryRare', 'legendary', 'artifact']);
});

test('ATTUNEMENT_CAP is 3 per SRD', () => {
  assert.equal(ATTUNEMENT_CAP, 3);
});

test('RECHARGE_KINDS covers the canonical schedules', () => {
  assert.deepEqual([...RECHARGE_KINDS].sort(),
    ['dawn', 'dusk', 'longRest', 'shortRest']);
});

// === canAttune ===

test('canAttune accepts a freely-attunable item below the cap', () => {
  const actor = { id: 'pc', attunedItems: [] };
  const result = canAttune(actor, cloakOfElvenkind);
  assert.equal(result.ok, true);
});

test('canAttune refuses when the actor already has the item attuned', () => {
  const actor = { attunedItems: ['cloak-of-elvenkind'] };
  const result = canAttune(actor, cloakOfElvenkind);
  assert.equal(result.ok, false);
  assert.match(result.reason, /already attuned/);
});

test('canAttune refuses at the 3-slot cap', () => {
  const actor = { attunedItems: ['a', 'b', 'c'] };
  const result = canAttune(actor, cloakOfElvenkind);
  assert.equal(result.ok, false);
  assert.match(result.reason, /attunement cap/);
});

test('canAttune refuses when classId prereq is unmet', () => {
  const actor = { classId: 'wizard' };
  const result = canAttune(actor, helmOfDisjunction);
  assert.equal(result.ok, false);
  assert.match(result.reason, /requires class fighter/);
});

test('canAttune refuses when spellcaster prereq is unmet', () => {
  const actor = { spellcaster: false };
  const result = canAttune(actor, staffOfTheMagi);
  assert.equal(result.ok, false);
  assert.match(result.reason, /spellcasting feature/);
});

test('canAttune refuses on insufficient ability score', () => {
  const actor = { spellcaster: true, abilityScores: { int: 12 } };
  const result = canAttune(actor, staffOfTheMagi);
  assert.equal(result.ok, false);
  assert.match(result.reason, /INT 13/);
});

test('canAttune accepts when all prereqs are met', () => {
  const actor = {
    spellcaster: true,
    abilityScores: { int: 16 }
  };
  const result = canAttune(actor, staffOfTheMagi);
  assert.equal(result.ok, true);
});

test('canAttune refuses on a non-object item', () => {
  assert.equal(canAttune({}, null).ok, false);
});

test('canAttune defaults INT to 10 when abilityScores missing (refuses INT 13 prereq)', () => {
  const actor = { spellcaster: true };
  const result = canAttune(actor, staffOfTheMagi);
  assert.equal(result.ok, false);
});

// === attune ===

test('attune adds the item to attunedItems', () => {
  const actor = { id: 'pc', attunedItems: [] };
  const result = attune(actor, cloakOfElvenkind);
  assert.equal(result.ok, true);
  assert.deepEqual(result.actor.attunedItems, ['cloak-of-elvenkind']);
});

test('attune initialises charge state for items with charges', () => {
  const actor = { id: 'pc' };
  const result = attune(actor, wandOfMagicMissiles);
  assert.equal(result.ok, true);
  assert.deepEqual(result.actor.itemCharges['wand-of-magic-missiles'],
    { used: 0, max: 7 });
});

test('attune refuses on a failed prereq', () => {
  const actor = { classId: 'wizard' };
  const result = attune(actor, helmOfDisjunction);
  assert.equal(result.ok, false);
});

test('attune on an actor with no attunedItems field initialises it', () => {
  const actor = { id: 'pc' };
  const result = attune(actor, cloakOfElvenkind);
  assert.deepEqual(result.actor.attunedItems, ['cloak-of-elvenkind']);
});

// === unattune ===

test('unattune removes the item and clears its charge state', () => {
  let actor = { id: 'pc' };
  ({ actor } = attune(actor, wandOfMagicMissiles));
  const result = unattune(actor, wandOfMagicMissiles);
  assert.equal(result.ok, true);
  assert.deepEqual(result.actor.attunedItems, []);
  assert.equal(result.actor.itemCharges['wand-of-magic-missiles'], undefined);
});

test('unattune refuses on an item the actor isn\'t attuned to', () => {
  // Covers the `Array.isArray(attunedItems) ? : []` fallback by
  // passing an actor with no attunedItems field at all.
  const result = unattune({ id: 'pc' }, cloakOfElvenkind);
  assert.equal(result.ok, false);
});

test('unattune refuses on a cursed item without Remove Curse', () => {
  const actor = {
    id: 'pc', classId: 'fighter',
    attunedItems: ['helm-of-disjunction']
  };
  const result = unattune(actor, helmOfDisjunction);
  assert.equal(result.ok, false);
  assert.match(result.reason, /cursed/);
});

test('unattune succeeds on a cursed item when Remove Curse was applied', () => {
  const actor = {
    id: 'pc', classId: 'fighter',
    attunedItems: ['helm-of-disjunction']
  };
  const result = unattune(actor, helmOfDisjunction, { removeCurseApplied: true });
  assert.equal(result.ok, true);
});

// === spendCharge ===

test('spendCharge decrements the counter', () => {
  let actor = { id: 'pc' };
  ({ actor } = attune(actor, wandOfMagicMissiles));
  const result = spendCharge(actor, 'wand-of-magic-missiles', 2);
  assert.equal(result.ok, true);
  assert.equal(result.actor.itemCharges['wand-of-magic-missiles'].used, 2);
});

test('spendCharge refuses on insufficient charges', () => {
  const actor = {
    id: 'pc',
    itemCharges: { wand: { used: 6, max: 7 } }
  };
  const result = spendCharge(actor, 'wand', 3);
  assert.equal(result.ok, false);
});

test('spendCharge refuses on an untracked item', () => {
  const result = spendCharge({}, 'unknown', 1);
  assert.equal(result.ok, false);
});

test('spendCharge throws on non-positive amount', () => {
  assert.throws(() => spendCharge({ itemCharges: {} }, 'x', 0));
  assert.throws(() => spendCharge({ itemCharges: {} }, 'x', -1));
  assert.throws(() => spendCharge({ itemCharges: {} }, 'x', 1.5));
});

// === rechargeItem ===

test('rechargeItem with dice spec rolls and refunds charges', () => {
  let actor = { id: 'pc' };
  ({ actor } = attune(actor, wandOfMagicMissiles));
  ({ actor } = spendCharge(actor, 'wand-of-magic-missiles', 7));
  // Recovers '1d6+1' — with rng → 0.5 (face 4 on a d6), +1 = 5.
  const result = rechargeItem(actor, wandOfMagicMissiles, () => 0.5);
  assert.equal(result.ok, true);
  assert.equal(result.recovered, 5);
  assert.equal(result.actor.itemCharges['wand-of-magic-missiles'].used, 2);
});

test('rechargeItem with numeric recovers uses that fixed amount', () => {
  let actor = {
    id: 'pc',
    itemCharges: { gem: { used: 5, max: 10 } }
  };
  const item = { id: 'gem', charges: { max: 10, recovers: 3 } };
  const result = rechargeItem(actor, item);
  assert.equal(result.recovered, 3);
  assert.equal(result.actor.itemCharges.gem.used, 2);
});

test('rechargeItem with a flat dice spec (no modifier) parses correctly', () => {
  // Covers the `m[3] ? Number(m[3]) : 0` mod-fallback in the
  // inline parser — a spec like `'1d4'` without `+N`.
  const actor = { itemCharges: { wand: { used: 3, max: 5 } } };
  const item = { id: 'wand', charges: { max: 5, recovers: '1d4' } };
  // rng → 0.99 yields face 4 on a d4 → recovered = 3 (capped at used).
  const result = rechargeItem(actor, item, () => 0.99);
  assert.equal(result.recovered, 3);
});

test('rechargeItem with no recovers spec refills to full', () => {
  const actor = {
    id: 'pc',
    itemCharges: { ring: { used: 4, max: 5 } }
  };
  const item = { id: 'ring', charges: { max: 5 } };
  const result = rechargeItem(actor, item);
  assert.equal(result.recovered, 4);
  assert.equal(result.actor.itemCharges.ring.used, 0);
});

test('rechargeItem refuses on a non-object item', () => {
  const result = rechargeItem({}, null);
  assert.equal(result.ok, false);
});

test('rechargeItem refuses on an untracked item', () => {
  const result = rechargeItem({}, { id: 'x', charges: { max: 5 } });
  assert.equal(result.ok, false);
});

test('rechargeItem throws on an invalid dice spec', () => {
  const actor = { itemCharges: { x: { used: 1, max: 5 } } };
  const item = { id: 'x', charges: { max: 5, recovers: 'gibberish' } };
  assert.throws(() => rechargeItem(actor, item));
});

// === identifyItem / isIdentified ===

test('identifyItem appends the item id to identifiedItems', () => {
  const actor = { id: 'pc' };
  const next = identifyItem(actor, 'cloak-of-elvenkind');
  assert.deepEqual(next.identifiedItems, ['cloak-of-elvenkind']);
});

test('identifyItem is a no-op on an already-identified item', () => {
  const actor = { identifiedItems: ['x'] };
  assert.equal(identifyItem(actor, 'x'), actor);
});

test('isIdentified reads off identifiedItems', () => {
  const actor = { identifiedItems: ['cloak-of-elvenkind'] };
  assert.equal(isIdentified(actor, 'cloak-of-elvenkind'), true);
  assert.equal(isIdentified(actor, 'unknown'), false);
});

test('isIdentified tolerates an actor without identifiedItems', () => {
  assert.equal(isIdentified({}, 'x'), false);
});

// === itemSavingThrow ===

test('itemSavingThrow on an item with a save rolls vs DC', () => {
  // d20 = 11 (rng 0.5), +5 bonus = 16 vs DC 15 → success.
  const result = itemSavingThrow(staffOfTheMagi, 15, () => 0.5);
  assert.equal(result.d20, 11);
  assert.equal(result.total, 16);
  assert.equal(result.success, true);
});

test('itemSavingThrow on an item without a save reports noSave + success', () => {
  const result = itemSavingThrow({ id: 'plain', name: 'Plain Sword' }, 99);
  assert.equal(result.success, true);
  assert.equal(result.noSave, true);
});

test('itemSavingThrow defaults bonus to 0 when not declared', () => {
  // d20 = 20, no bonus → 20 vs DC 15 → success.
  const item = { id: 'x', savingThrow: {} };
  const result = itemSavingThrow(item, 15, () => 0.99);
  assert.equal(result.total, 20);
});

// === Engine binding ===

test('engine.MagicItems surface is exposed and functional', () => {
  const engine = createEngine({ rng: seededRng(42) });
  let actor = { id: 'pc' };
  ({ actor } = engine.MagicItems.attune(actor, cloakOfElvenkind));
  assert.deepEqual(actor.attunedItems, ['cloak-of-elvenkind']);
  // Recharge through the binding (uses the engine rng).
  ({ actor } = engine.MagicItems.attune(actor, wandOfMagicMissiles));
  ({ actor } = engine.MagicItems.spendCharge(actor, 'wand-of-magic-missiles', 3));
  const recharge = engine.MagicItems.rechargeItem(actor, wandOfMagicMissiles);
  assert.equal(recharge.ok, true);
  assert.ok(recharge.recovered >= 2 && recharge.recovered <= 7);   // 1d6+1
});

test('engine.MagicItems.itemSavingThrow uses the engine rng', () => {
  const engine = createEngine({ rng: () => 0.5 });
  const result = engine.MagicItems.itemSavingThrow(staffOfTheMagi, 15);
  assert.equal(result.d20, 11);
});
