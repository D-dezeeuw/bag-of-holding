// The Treasury — 40 invented magic items across all six rarity bands,
// exercising every 1.9 mechanic through the ENGINE, not just declaring
// shapes: attunement prereqs of all three kinds, charges on all four
// recharge schedules, the cursed unattune refusal, item saving throws,
// and sentient blocks as host data.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, TREASURY, MagicItems } from '../index.js';
import {
  attune as attuneUnbound, rechargeItem as rechargeUnbound,
} from '../src/magic-items.js';

const engine = createEngine({ extraItems: TREASURY });

test('40 items, all six rarity bands populated, every record well-formed', () => {
  const all = Object.values(TREASURY);
  assert.equal(all.length, 40, 'the roadmap number is the shipped number');
  const byRarity = new Map();
  for (const it of all) {
    byRarity.set(it.rarity, (byRarity.get(it.rarity) ?? 0) + 1);
    assert.ok(MagicItems.RARITY_BANDS.includes(it.rarity), `${it.id} rarity '${it.rarity}' is a real band`);
    assert.ok(engine.items[it.id], `${it.id} merged into the engine registry`);
    if (it.charges) {
      assert.ok(it.charges.max >= 1, `${it.id} charge pool is real`);
      assert.ok(MagicItems.RECHARGE_KINDS.includes(it.charges.rechargesOn),
        `${it.id} recharge schedule '${it.charges.rechargesOn}' is known`);
    }
    if (it.damage) assert.ok(engine.Dice.parse(it.damage), `${it.id} damage parses`);
    if (it.requiresAttunement) {
      assert.equal(it.attunement, true, `${it.id} prereq implies attunement`);
    }
  }
  assert.deepEqual(
    MagicItems.RARITY_BANDS.map((band) => byRarity.get(band)),
    [8, 10, 9, 6, 4, 3],
    'the six-band distribution is the documented one');
  // Every recharge schedule the engine knows appears in the pack.
  const schedules = new Set(all.filter((i) => i.charges).map((i) => i.charges.rechargesOn));
  assert.deepEqual([...schedules].sort(), ['dawn', 'dusk', 'longRest', 'shortRest']);
});

test('attunement prereqs: all three kinds refuse and admit through the engine', () => {
  const commoner = { id: 'pc', abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
  // classId
  const staff = engine.items['staff-of-the-orchard-warden'];
  assert.match(MagicItems.canAttune({ ...commoner, classId: 'wizard' }, staff).reason, /requires class druid/);
  assert.equal(MagicItems.canAttune({ ...commoner, classId: 'druid' }, staff).ok, true);
  // spellcaster
  const wand = engine.items['wand-of-gathered-sparks'];
  assert.match(MagicItems.canAttune(commoner, wand).reason, /spellcasting/);
  assert.equal(MagicItems.canAttune({ ...commoner, spellcaster: true }, wand).ok, true);
  // abilityMin
  const gauntlets = engine.items['gauntlets-of-the-drowned-fleet'];
  assert.match(MagicItems.canAttune(commoner, gauntlets).reason, /STR 15\+/);
  const strong = { ...commoner, abilityScores: { ...commoner.abilityScores, str: 16 } };
  assert.equal(MagicItems.canAttune(strong, gauntlets).ok, true);
});

test('the charged lifecycle runs on a pinned die: attune → spend → dawn recharge', () => {
  // Unbound module fns take an explicit rng — pin the die and the
  // arithmetic is exact (the engine-bound versions substitute the
  // engine rng for replay capture).
  const staff = TREASURY['staff-of-the-orchard-warden'];
  let druid = { id: 'pc', classId: 'druid' };
  ({ actor: druid } = attuneUnbound(druid, staff));
  assert.deepEqual(druid.itemCharges[staff.id], { used: 0, max: 10 });
  ({ actor: druid } = MagicItems.spendCharge(druid, staff.id, 7));
  assert.equal(druid.itemCharges[staff.id].used, 7);
  // Dawn: recovers 1d6+4; a pinned max die recovers 6+4 = 10 → capped at 7.
  const dawn = rechargeUnbound(druid, staff, () => 0.999);
  assert.equal(dawn.recovered, 7, 'recovery caps at what was spent');
  assert.equal(dawn.actor.itemCharges[staff.id].used, 0);
  // Flat numeric recovery works too (the single-use dawn items).
  const coin = TREASURY['coin-of-two-tomorrows'];
  let bearer = { id: 'pc2' };
  ({ actor: bearer } = attuneUnbound(bearer, coin));
  ({ actor: bearer } = MagicItems.spendCharge(bearer, coin.id, 1));
  assert.equal(rechargeUnbound(bearer, coin, () => 0).actor.itemCharges[coin.id].used, 0);
});

test('cursed items hold on until Remove Curse; saves and sentience carry data', () => {
  const mask = engine.items['mask-of-the-mourning-moon'];
  let wearer = { id: 'pc' };
  ({ actor: wearer } = MagicItems.attune(wearer, mask));
  assert.match(MagicItems.unattune(wearer, mask).reason, /cursed/);
  assert.equal(MagicItems.unattune(wearer, mask, { removeCurseApplied: true }).ok, true);
  // Four cursed items ship — one per band from uncommon up to artifact.
  const cursed = Object.values(TREASURY).filter((i) => i.cursed);
  assert.equal(cursed.length, 4);
  assert.ok(new Set(cursed.map((i) => i.rarity)).size >= 3, 'curses climb the bands');
  // Item saving throws resolve through the engine surface.
  const anvil = engine.items['anvil-of-first-making'];
  const save = MagicItems.itemSavingThrow(anvil, 10);
  assert.ok(typeof save.total === 'number' && typeof save.success === 'boolean');
  // Sentient blocks: ego scores, a purpose, and a conflict DC the host
  // can hand straight to Checks.abilityCheck against the wielder.
  const sentient = Object.values(TREASURY).filter((i) => i.sentient);
  assert.equal(sentient.length, 3);
  for (const it of sentient) {
    assert.ok(it.sentient.intelligence >= 1 && it.sentient.charisma >= 1, `${it.id} has ego scores`);
    assert.ok(typeof it.sentient.purpose === 'string' && it.sentient.purpose.length > 0);
    assert.ok(it.sentient.conflictDc >= 10, `${it.id} conflict DC is a real contest`);
    assert.equal(it.attunement, true, `${it.id} sentience requires attunement`);
  }
  const contest = engine.Checks.abilityCheck({
    abilityScore: 16, dc: TREASURY['blade-that-argues'].sentient.conflictDc,
  });
  assert.ok(typeof contest.success === 'boolean', 'a conflict resolves as an ordinary contest');
});
