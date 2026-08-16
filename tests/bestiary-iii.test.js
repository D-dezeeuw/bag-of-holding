// Bestiary III — 10 capstone monsters, CR 16–20, and the Mythic Actions
// consumer that lands WITH them (the 1.10 header promised it; there was
// never data to drive it until now). What must hold: the tier's promises
// (LR 3 everywhere, deep senses, heavy save training, level 6+ innate
// lists), the mythic lifecycle (sealed → triggered → spends → refuses →
// refreshes without resealing), and composition with everything below.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, BESTIARY_III, BESTIARY_II, BESTIARY_I, QUIET_STAIR_MONSTERS,
} from '../index.js';

const engine = createEngine({ extraMonsters: BESTIARY_III });

test('10 capstones, CR 16–20, carrying the full tier-4 surface', () => {
  const ids = Object.keys(BESTIARY_III);
  assert.equal(ids.length, 10, 'the roadmap number is the shipped number');
  for (const id of ids) {
    const m = engine.monsters[id];
    assert.ok(m, `${id} merged`);
    assert.ok(m.cr >= 16 && m.cr <= 20, `${id} is tier-4 (cr ${m.cr})`);
    assert.ok(m.legendaryActions, `${id} fights outside its turn`);
    assert.deepEqual(m.legendaryResistance, { uses: 3 }, `${id} carries the full LR pool`);
    assert.ok(m.multiattack, `${id} multiattacks`);
    assert.ok(Object.keys(m.saves).length >= 3, `${id} trains 3+ saves`);
    const reach = Math.max(...Object.values(m.senses));
    assert.ok(m.senses.truesight || reach >= 120, `${id} perceives at capstone depth`);
    for (const a of m.attacks) assert.ok(engine.Dice.parse(a.damage), `${id} ${a.name} parses`);
    for (const step of engine.Monsters.multiattackSequence(m)) {
      assert.equal(m.attacks[step.attackRef]?.name, step.name, `${m.id} routine resolves`);
    }
    for (const opt of m.legendaryActions.options) {
      if (opt.attackRef !== undefined) {
        assert.ok(m.attacks.some((a) => a.name === opt.attackRef), `${m.id} legendary '${opt.id}' resolves`);
      }
    }
  }
});

test('the mythic lifecycle: sealed → triggered → spends → refuses → refreshes unsealed', () => {
  const mythics = Object.values(BESTIARY_III).filter((m) => m.mythicActions);
  assert.equal(mythics.length, 6, 'six carry a second phase');
  for (const m of mythics) {
    let actor = { id: m.id };
    const opt = m.mythicActions.options[0].id;

    // Sealed: the second phase never leaks into the first act.
    assert.equal(engine.Monsters.useMythicAction(actor, m, opt).ok, false);
    assert.match(engine.Monsters.useMythicAction(actor, m, opt).reason, /not yet triggered/);

    // The host fires the trigger (by convention: the first death).
    const woke = engine.Monsters.activateMythic(actor, m);
    assert.equal(woke.ok, true);
    actor = woke.actor;
    assert.equal(engine.Monsters.activateMythic(actor, m).alreadyActive, true, 'idempotent');

    // The pool spends and refuses past empty…
    for (let spent = 0; spent < m.mythicActions.uses; ) {
      const r = engine.Monsters.useMythicAction(actor, m, opt, 1);
      assert.equal(r.ok, true, `${m.id} spends mythic use`);
      actor = r.actor; spent += 1;
    }
    assert.equal(engine.Monsters.useMythicAction(actor, m, opt).ok, false, `${m.id} pool exhausts`);

    // …and the round refresh restores uses WITHOUT resealing the phase.
    actor = engine.Monsters.refreshMythicActions(actor, m);
    assert.equal(engine.Monsters.useMythicAction(actor, m, opt).ok, true, `${m.id} refreshes, still active`);

    // Every mythic option id is unique and named.
    const optIds = m.mythicActions.options.map((o) => o.id);
    assert.equal(new Set(optIds).size, optIds.length, `${m.id} mythic options are distinct`);
  }
  // A monster without a mythic block is a clean no.
  const plain = BESTIARY_III['the-shrouded-emperor'];
  assert.equal(engine.Monsters.activateMythic({ id: 'x' }, plain).ok, false);
  assert.equal(engine.Monsters.freshMythicState(plain), null);
});

test('innate lists reach spell level 6+ and every id resolves', () => {
  const casters = Object.values(BESTIARY_III).filter((m) => m.innateSpellcasting);
  assert.equal(casters.length, 5);
  for (const m of casters) {
    const inn = m.innateSpellcasting;
    const all = [...(inn.atWill ?? []), ...(inn['3day'] ?? []), ...(inn['1day'] ?? [])];
    for (const id of all) assert.ok(engine.spells[id], `${m.id} innate '${id}' is a shipped SRD spell`);
    const top = Math.max(...all.map((id) => engine.spells[id].level));
    assert.ok(top >= 6, `${m.id} casts at capstone level (best: ${top})`);
  }
  // The crown jewel: the Silence Crowned holds power-word-kill and gate.
  const silence = BESTIARY_III['the-silence-crowned'].innateSpellcasting['1day'];
  assert.deepEqual(silence.map((id) => engine.spells[id].level).sort(), [9, 9]);
});

test('all four packs compose; the whole invented bestiary is 105 blocks deep', () => {
  const all = createEngine({
    extraMonsters: { ...BESTIARY_I, ...BESTIARY_II, ...BESTIARY_III, ...QUIET_STAIR_MONSTERS },
  });
  assert.equal(
    Object.keys(all.monsters).length,
    Object.keys(createEngine().monsters).length + 50 + 30 + 10 + 15,
    'every pack block landed; nothing shadowed anything');
  // And the CR ladder is continuous from 0 to 20 — a campaign can climb
  // every tier without leaving invented content.
  const crs = new Set(Object.values({ ...BESTIARY_I, ...BESTIARY_II, ...BESTIARY_III }).map((m) => Math.floor(m.cr)));
  for (let cr = 0; cr <= 20; cr++) assert.ok(crs.has(cr), `CR ${cr} has at least one invented block`);
});
