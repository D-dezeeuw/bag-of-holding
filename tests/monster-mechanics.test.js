import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  multiattackSequence,
  freshLegendaryState, useLegendaryAction, refreshLegendaryActions,
  freshLegendaryResistance, useLegendaryResistance,
  lairActionAvailable, fireLairAction,
  freshInnateState, castInnate, refreshInnateSpells,
  senses, saveBonus
} from '../src/monsters.js';
import { createEngine } from '../src/engine.js';

// === Monster fixtures ===

const goblin = {
  id: 'goblin',
  abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  attacks: [{ name: 'Scimitar' }]
};

const adultRedDragon = {
  id: 'adult-red-dragon',
  abilityScores: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
  saves: { dex: 6, con: 13, wis: 7, cha: 11 },
  damageResistances: [],
  damageImmunities: ['fire'],
  conditionImmunities: [],
  senses: { darkvision: 120, blindsight: 60, passivePerception: 23 },
  languages: ['Common', 'Draconic'],
  multiattack: {
    attacks: [
      { name: 'Bite', attackRef: 'bite' },
      { name: 'Claw', attackRef: 'claw' },
      { name: 'Claw', attackRef: 'claw' }
    ]
  },
  legendaryActions: {
    uses: 3,
    options: [
      { id: 'detect', cost: 1, name: 'Detect' },
      { id: 'tail-attack', cost: 1, name: 'Tail Attack' },
      { id: 'wing-attack', cost: 2, name: 'Wing Attack' }
    ]
  },
  legendaryResistance: { uses: 3 },
  lairActions: {
    triggersOnInitiative: 20,
    options: [
      { id: 'magma-eruption', name: 'Magma Eruption' },
      { id: 'volcanic-gas',   name: 'Volcanic Gas' }
    ]
  },
  innateSpellcasting: {
    atWill: ['fire-bolt'],
    '3day': ['fireball'],
    '1day': ['scorching-ray']
  }
};

// === Multiattack ===

test('multiattackSequence returns the ordered attack list', () => {
  const seq = multiattackSequence(adultRedDragon);
  assert.equal(seq.length, 3);
  assert.equal(seq[0].name, 'Bite');
  assert.equal(seq[1].name, 'Claw');
});

test('multiattackSequence returns [] for a monster without Multiattack', () => {
  assert.deepEqual(multiattackSequence(goblin), []);
});

test('multiattackSequence returns [] when attacks array is missing', () => {
  // Covers the `Array.isArray(...)` false branch.
  assert.deepEqual(multiattackSequence({ multiattack: {} }), []);
});

// === Legendary Actions ===

test('freshLegendaryState reads uses (default 3)', () => {
  assert.deepEqual(freshLegendaryState(adultRedDragon), { used: 0, max: 3 });
});

test('freshLegendaryState defaults uses to 3 when omitted on the record', () => {
  // Covers the `?? 3` fallback.
  const monster = { legendaryActions: { options: [] } };
  assert.deepEqual(freshLegendaryState(monster), { used: 0, max: 3 });
});

test('freshLegendaryState returns null for a monster without Legendary Actions', () => {
  assert.equal(freshLegendaryState(goblin), null);
});

test('useLegendaryAction spends from the pool and returns the option', () => {
  const actor = { id: 'dragon-1' };
  const result = useLegendaryAction(actor, adultRedDragon, 'detect');
  assert.equal(result.ok, true);
  assert.equal(result.option.name, 'Detect');
  assert.equal(result.actor.legendary.used, 1);
});

test('useLegendaryAction with cost 2 (Wing Attack) consumes 2 uses', () => {
  const actor = { id: 'dragon-1' };
  const result = useLegendaryAction(actor, adultRedDragon, 'wing-attack', 2);
  assert.equal(result.actor.legendary.used, 2);
});

test('useLegendaryAction refuses on insufficient uses', () => {
  const actor = { legendary: { used: 3, max: 3 } };
  const result = useLegendaryAction(actor, adultRedDragon, 'detect');
  assert.equal(result.ok, false);
});

test('useLegendaryAction refuses on a monster without legendary actions', () => {
  const result = useLegendaryAction({}, goblin, 'x');
  assert.equal(result.ok, false);
});

test('useLegendaryAction refuses on unknown option id', () => {
  const result = useLegendaryAction({}, adultRedDragon, 'breath-weapon');
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown legendary option/);
});

test('useLegendaryAction throws on non-positive cost', () => {
  assert.throws(() => useLegendaryAction({}, adultRedDragon, 'detect', 0));
  assert.throws(() => useLegendaryAction({}, adultRedDragon, 'detect', 1.5));
});

test('useLegendaryAction refuses when options list is empty / missing', () => {
  // Covers the `monster.legendaryActions.options?.find` branch where
  // options is undefined.
  const monster = { legendaryActions: { uses: 2 } };
  const result = useLegendaryAction({}, monster, 'x');
  assert.equal(result.ok, false);
});

test('refreshLegendaryActions resets the used counter to 0', () => {
  const actor = { legendary: { used: 2, max: 3 } };
  const next = refreshLegendaryActions(actor);
  assert.equal(next.legendary.used, 0);
});

test('refreshLegendaryActions is a no-op if already at 0', () => {
  const actor = { legendary: { used: 0, max: 3 } };
  assert.equal(refreshLegendaryActions(actor), actor);
});

test('refreshLegendaryActions is a no-op on an actor without legendary state', () => {
  const actor = { id: 'goblin-1' };
  assert.equal(refreshLegendaryActions(actor), actor);
});

// === Legendary Resistance ===

test('useLegendaryResistance spends from the LR pool', () => {
  const actor = { id: 'dragon-1' };
  const result = useLegendaryResistance(actor, adultRedDragon);
  assert.equal(result.ok, true);
  assert.equal(result.actor.legendaryResistance.used, 1);
});

test('useLegendaryResistance refuses when exhausted', () => {
  const actor = { legendaryResistance: { used: 3, max: 3 } };
  const result = useLegendaryResistance(actor, adultRedDragon);
  assert.equal(result.ok, false);
});

test('useLegendaryResistance refuses on a monster without LR', () => {
  const result = useLegendaryResistance({}, goblin);
  assert.equal(result.ok, false);
});

test('freshLegendaryResistance returns null without the field', () => {
  assert.equal(freshLegendaryResistance(goblin), null);
});

test('freshLegendaryResistance default uses to 3 when omitted', () => {
  const monster = { legendaryResistance: {} };
  assert.deepEqual(freshLegendaryResistance(monster), { used: 0, max: 3 });
});

// === Lair Actions ===

test('lairActionAvailable: true at init 20 when in lair', () => {
  assert.equal(lairActionAvailable(adultRedDragon, {
    initiativeCount: 20, inLair: true
  }), true);
});

test('lairActionAvailable: false when not in lair', () => {
  assert.equal(lairActionAvailable(adultRedDragon, {
    initiativeCount: 20, inLair: false
  }), false);
});

test('lairActionAvailable: false on wrong initiative count', () => {
  assert.equal(lairActionAvailable(adultRedDragon, {
    initiativeCount: 15, inLair: true
  }), false);
});

test('lairActionAvailable: false when monster has no Lair Actions', () => {
  assert.equal(lairActionAvailable(goblin, { initiativeCount: 20, inLair: true }), false);
});

test('lairActionAvailable: respects a custom triggersOnInitiative', () => {
  const m = { lairActions: { triggersOnInitiative: 15, options: [] } };
  assert.equal(lairActionAvailable(m, { initiativeCount: 15, inLair: true }), true);
});

test('lairActionAvailable: defaults trigger to 20 when omitted', () => {
  const m = { lairActions: { options: [] } };
  assert.equal(lairActionAvailable(m, { initiativeCount: 20, inLair: true }), true);
});

test('fireLairAction returns the matching option', () => {
  const result = fireLairAction(adultRedDragon, 'magma-eruption');
  assert.equal(result.ok, true);
  assert.equal(result.option.name, 'Magma Eruption');
});

test('fireLairAction refuses unknown option', () => {
  const result = fireLairAction(adultRedDragon, 'flood');
  assert.equal(result.ok, false);
});

test('fireLairAction refuses on a monster without Lair Actions', () => {
  const result = fireLairAction(goblin, 'x');
  assert.equal(result.ok, false);
});

test('fireLairAction with no options list refuses cleanly', () => {
  const m = { lairActions: {} };
  const result = fireLairAction(m, 'x');
  assert.equal(result.ok, false);
});

// === Innate Spellcasting ===

test('freshInnateState builds counters from 3day / 1day lists', () => {
  const state = freshInnateState(adultRedDragon);
  assert.deepEqual(state.fireball, { used: 0, max: 3 });
  assert.deepEqual(state['scorching-ray'], { used: 0, max: 1 });
});

test('freshInnateState returns null without innateSpellcasting field', () => {
  assert.equal(freshInnateState(goblin), null);
});

test('freshInnateState handles missing 3day / 1day arrays', () => {
  const m = { innateSpellcasting: { atWill: ['light'] } };
  assert.deepEqual(freshInnateState(m), {});
});

test('castInnate with at-will spell succeeds without depleting counters', () => {
  const actor = { id: 'dragon-1' };
  const result = castInnate(actor, adultRedDragon, 'fire-bolt');
  assert.equal(result.ok, true);
  assert.equal(result.atWill, true);
  assert.equal(result.actor, actor);
});

test('castInnate with 3/day spell decrements the counter', () => {
  const actor = { id: 'dragon-1' };
  const result = castInnate(actor, adultRedDragon, 'fireball');
  assert.equal(result.ok, true);
  assert.equal(result.actor.innateSpells.fireball.used, 1);
});

test('castInnate refuses when the named spell is not in the innate list', () => {
  const result = castInnate({}, adultRedDragon, 'wish');
  assert.equal(result.ok, false);
});

test('castInnate refuses when the per-day counter is exhausted', () => {
  const actor = {
    innateSpells: { 'scorching-ray': { used: 1, max: 1 } }
  };
  const result = castInnate(actor, adultRedDragon, 'scorching-ray');
  assert.equal(result.ok, false);
});

test('castInnate refuses on a monster without innate spellcasting', () => {
  const result = castInnate({}, goblin, 'fireball');
  assert.equal(result.ok, false);
});

test('castInnate tolerates a monster innate block without an atWill list', () => {
  // Covers the `(innate.atWill ?? []).includes` fallback when atWill
  // is omitted entirely (the monster has no at-will spells).
  const m = { innateSpellcasting: { '3day': ['fireball'] } };
  const result = castInnate({}, m, 'fireball');
  assert.equal(result.ok, true);
  assert.equal(result.actor.innateSpells.fireball.used, 1);
});

test('refreshInnateSpells resets the per-day counters', () => {
  const actor = {
    innateSpells: { fireball: { used: 3, max: 3 }, 'scorching-ray': { used: 1, max: 1 } }
  };
  const next = refreshInnateSpells(actor, adultRedDragon);
  assert.equal(next.innateSpells.fireball.used, 0);
  assert.equal(next.innateSpells['scorching-ray'].used, 0);
});

test('refreshInnateSpells is a no-op on a non-innate monster', () => {
  const actor = { id: 'goblin-1' };
  assert.equal(refreshInnateSpells(actor, goblin), actor);
});

// === Senses + save bonus ===

test('senses returns the block; empty default', () => {
  assert.deepEqual(senses(adultRedDragon), {
    darkvision: 120, blindsight: 60, passivePerception: 23
  });
  assert.deepEqual(senses(goblin), {});
});

test('saveBonus reads from monster.saves when declared', () => {
  assert.equal(saveBonus(adultRedDragon, 'con'), 13);
});

test('saveBonus falls back to ability modifier when not declared', () => {
  assert.equal(saveBonus(adultRedDragon, 'str'), 8);    // STR 27 → mod 8
});

test('saveBonus defaults score to 10 when abilityScores absent', () => {
  assert.equal(saveBonus({}, 'wis'), 0);
});

// === Engine binding ===

test('engine.Monsters surface is exposed and works through the binding', () => {
  const engine = createEngine();
  const actor = { id: 'dragon-1' };
  const result = engine.Monsters.useLegendaryAction(actor, adultRedDragon, 'detect');
  assert.equal(result.ok, true);
});
