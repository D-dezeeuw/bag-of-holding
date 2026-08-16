// Bestiary II — 30 boss-tier opponents, CR 6–15. The promise this batch
// exists to keep: the 1.10 boss mechanics (Legendary Actions, Legendary
// Resistance, Lair Actions, Innate Spellcasting) finally run against
// AUTHORED data instead of template-synthesized variants — and every
// reference inside that data resolves: legendary attackRefs name real
// attacks, innate lists name real SRD spells, tier discipline holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, BESTIARY_II, BESTIARY_I, QUIET_STAIR_MONSTERS } from '../index.js';

const engine = createEngine({ extraMonsters: BESTIARY_II });

test('30 bosses, CR 6–15, all mount; every block multiattacks and trains saves', () => {
  const ids = Object.keys(BESTIARY_II);
  assert.equal(ids.length, 30, 'the roadmap number is the shipped number');
  for (const id of ids) {
    const m = engine.monsters[id];
    assert.ok(m, `${id} merged`);
    assert.ok(m.cr >= 6 && m.cr <= 15, `${id} stays in the CR 6–15 tier (cr ${m.cr})`);
    assert.ok(m.senses && Object.keys(m.senses).length >= 1, `${id} has senses`);
    assert.ok(m.multiattack, `${id} multiattacks — a boss that swings once is a loot piñata`);
    assert.ok(m.saves && Object.keys(m.saves).length >= 1, `${id} trains saves`);
    for (const a of m.attacks) assert.ok(engine.Dice.parse(a.damage), `${id} ${a.name} damage parses`);
    for (const step of engine.Monsters.multiattackSequence(m)) {
      const ref = m.attacks[step.attackRef];
      assert.ok(ref && ref.name === step.name, `${m.id} routine resolves into its own attacks`);
    }
  }
  // CR 10+ never runs out of "no": every top-half boss carries Legendary
  // Resistance — the tier's signature, stated as a test.
  for (const m of Object.values(BESTIARY_II).filter((x) => x.cr >= 10)) {
    assert.ok(m.legendaryResistance, `${m.id} (CR ${m.cr}) carries Legendary Resistance`);
  }
});

test('legendary actions: pools spend, options resolve, attackRefs name real attacks', () => {
  const legends = Object.values(BESTIARY_II).filter((m) => m.legendaryActions);
  assert.equal(legends.length, 15, 'half the batch fights outside its own turn');
  for (const m of legends) {
    // Every attackRef in a legendary option names one of the monster's own
    // attacks — a routine that points at nothing is a boss that stalls.
    for (const opt of m.legendaryActions.options) {
      if (opt.attackRef !== undefined) {
        assert.ok(m.attacks.some((a) => a.name === opt.attackRef),
          `${m.id} legendary '${opt.id}' references its own attack`);
      }
    }
    // The pool spends and refuses honestly.
    let actor = { id: m.id };
    const first = engine.Monsters.useLegendaryAction(actor, m, m.legendaryActions.options[0].id);
    assert.equal(first.ok, true, `${m.id} spends a legendary use`);
    actor = first.actor;
    const uses = m.legendaryActions.uses;
    for (let spent = 1; spent < uses; spent++) {
      actor = engine.Monsters.useLegendaryAction(actor, m, m.legendaryActions.options[0].id).actor;
    }
    assert.equal(engine.Monsters.useLegendaryAction(actor, m, m.legendaryActions.options[0].id).ok, false,
      `${m.id} refuses past its pool`);
    const refreshed = engine.Monsters.refreshLegendaryActions(actor, m);
    assert.equal(engine.Monsters.useLegendaryAction(refreshed, m, m.legendaryActions.options[0].id).ok, true,
      `${m.id} refreshes at turn start`);
  }
});

test('legendary resistance converts a failed save until the pool is dry', () => {
  const king = BESTIARY_II['the-first-forgotten-king'];
  let actor = { id: 'king' };
  for (let i = 0; i < king.legendaryResistance.uses; i++) {
    const r = engine.Monsters.useLegendaryResistance(actor, king);
    assert.equal(r.ok, true, `refusal ${i + 1} converts`);
    actor = r.actor;
  }
  assert.equal(engine.Monsters.useLegendaryResistance(actor, king).ok, false, 'then the failures count');
});

test('lair actions fire at initiative 20, in the lair, and only there', () => {
  const lairs = Object.values(BESTIARY_II).filter((m) => m.lairActions);
  assert.equal(lairs.length, 8, 'a lair is a place, not a stat — only home-holders have one');
  for (const m of lairs) {
    assert.equal(engine.Monsters.lairActionAvailable(m, { inLair: true, initiativeCount: 20 }), true);
    assert.equal(engine.Monsters.lairActionAvailable(m, { inLair: true, initiativeCount: 12 }), false);
    assert.equal(engine.Monsters.lairActionAvailable(m, { inLair: false, initiativeCount: 20 }), false,
      `${m.id} dragged from its lair loses the home advantage`);
    const fired = engine.Monsters.fireLairAction(m, m.lairActions.options[0].id);
    assert.equal(fired.ok, true);
    assert.equal(fired.option.id, m.lairActions.options[0].id);
  }
});

test('innate spellcasting: every listed id is a real SRD spell, and the counters bite', () => {
  const casters = Object.values(BESTIARY_II).filter((m) => m.innateSpellcasting);
  assert.equal(casters.length, 8);
  for (const m of casters) {
    const inn = m.innateSpellcasting;
    for (const list of [inn.atWill ?? [], inn['3day'] ?? [], inn['1day'] ?? []]) {
      for (const id of list) assert.ok(engine.spells[id], `${m.id} innate '${id}' is a shipped SRD spell`);
    }
  }
  // The daily economy on one caster: at-will never depletes; 1/day is 1/day.
  const hag = BESTIARY_II['mirror-pool-hag'];
  let actor = { id: 'hag' };
  assert.equal(engine.Monsters.castInnate(actor, hag, 'minor-illusion').atWill, true);
  const cast1 = engine.Monsters.castInnate(actor, hag, 'counterspell');
  assert.equal(cast1.ok, true);
  actor = cast1.actor;
  assert.equal(engine.Monsters.castInnate(actor, hag, 'counterspell').ok, false, 'one per day means one');
  const rested = engine.Monsters.refreshInnateSpells(actor, hag);
  assert.equal(engine.Monsters.castInnate(rested, hag, 'counterspell').ok, true, 'dawn gives it back');
});

test('the three packs compose without a single id collision', () => {
  const all = createEngine({ extraMonsters: { ...BESTIARY_I, ...BESTIARY_II, ...QUIET_STAIR_MONSTERS } });
  assert.equal(
    Object.keys(all.monsters).length,
    Object.keys(createEngine().monsters).length + 50 + 30 + 15,
    'every pack block landed; nothing shadowed anything');
});
