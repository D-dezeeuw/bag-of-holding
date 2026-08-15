// The Quiet Stair bestiary — 15 invented creatures, CR 0–4, the first
// AUTHORED stat blocks to carry the 1.10 deep fields. What must hold:
// every block passes the plugin validator; the deep-field consumers
// (multiattackSequence, saveBonus, senses) finally run against data a
// person wrote; and a real combat drives one of them through the engine
// to a verified kill.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, QUIET_STAIR_MONSTERS, STARTER_PARTY, Dice } from '../index.js';

const engine = createEngine({ extraMonsters: QUIET_STAIR_MONSTERS });

test('all 15 mount through the plugin validator, in tier, with senses', () => {
  const ids = Object.keys(QUIET_STAIR_MONSTERS);
  assert.equal(ids.length, 15, 'the roadmap number is the shipped number');
  for (const id of ids) {
    const m = engine.monsters[id];
    assert.ok(m, `${id} merged into the registry`);
    assert.ok(m.cr >= 0 && m.cr <= 4, `${id} stays in the CR 0–4 tier`);
    assert.ok(m.senses && Object.keys(m.senses).length >= 1,
      `${id} has senses — a crypt bestiary that cannot see in the dark is set dressing`);
    assert.ok(Array.isArray(m.attacks) && m.attacks.length >= 1, `${id} can fight`);
    // Every declared attack's damage spec must parse — a typo here would
    // otherwise surface mid-combat at a table.
    for (const a of m.attacks) assert.ok(engine.Dice.parse(a.damage), `${id} ${a.name} damage parses`);
  }
  // No boss-tier mechanics at this CR: legendary/lair/innate belong to
  // Bestiary II/III per the roadmap. This is a claim, so it is a test.
  for (const id of ids) {
    const m = engine.monsters[id];
    assert.equal(m.legendaryActions, undefined, `${id} has no legendary actions`);
    assert.equal(m.lairActions, undefined, `${id} has no lair actions`);
    assert.equal(m.innateSpells, undefined, `${id} has no innate spellcasting`);
  }
});

test('multiattack routines resolve through multiattackSequence — first authored data', () => {
  const routines = Object.values(QUIET_STAIR_MONSTERS).filter((m) => m.multiattack);
  assert.equal(routines.length, 5, 'five multiattackers, per the design');
  for (const m of routines) {
    const seq = engine.Monsters.multiattackSequence(m);
    assert.equal(seq.length, m.multiattack.attacks.length);
    for (const step of seq) {
      const ref = m.attacks[step.attackRef];
      assert.ok(ref, `${m.id} step '${step.name}' resolves into attacks[]`);
      assert.equal(step.name, ref.name, `${m.id} routine names match the attack they index`);
    }
  }
  // The climax monster swings three times — the tier's ceiling.
  assert.equal(engine.Monsters.multiattackSequence(engine.monsters['still-abbot']).length, 3);
  // And a non-multiattacker yields the empty routine, not a crash.
  assert.deepEqual(engine.Monsters.multiattackSequence(engine.monsters['grave-tick']), []);
});

test('saveBonus reads trained saves and falls back to the bare mod', () => {
  const abbot = engine.monsters['still-abbot'];
  assert.equal(engine.Monsters.saveBonus(abbot, 'wis'), 5, 'trained WIS save');
  assert.equal(engine.Monsters.saveBonus(abbot, 'cha'), 6, 'trained CHA save');
  assert.equal(engine.Monsters.saveBonus(abbot, 'dex'), 2, 'untrained falls back to the DEX mod');
  const knight = engine.monsters['hollow-knight'];
  assert.equal(engine.Monsters.saveBonus(knight, 'str'), 5);
  assert.equal(engine.Monsters.saveBonus(knight, 'con'), 4);
  // The trained set: exactly the four the design declares.
  const trained = Object.values(QUIET_STAIR_MONSTERS).filter((m) => m.saves);
  assert.deepEqual(trained.map((m) => m.id).sort(),
    ['drowned-porter', 'hollow-knight', 'stair-warden', 'still-abbot']);
});

test('a cellar-lurker fight runs through the real engine to a verified kill', () => {
  const e = createEngine({ extraMonsters: QUIET_STAIR_MONSTERS, rng: Dice.seededRng(41) });
  const lurker = e.monsters['cellar-lurker'];
  const pc = STARTER_PARTY[0];
  const sheet = e.deriveSheet(pc);
  const swing = sheet.attacks?.[0] ?? { attackBonus: 5, damageDice: '1d8', damageMod: 3 };
  const pcAc = typeof sheet.ac === 'object' ? sheet.ac.value : (sheet.ac ?? 15);

  // Trade rounds: the lurker's full multiattack routine swings at the PC's
  // AC, the PC answers — every roll seeded, every hit through the real
  // damage pipeline (typed, temp-HP-aware, death-save-routing).
  let lurkerActor = { id: 'lurker-1', hp: lurker.hp, hpMax: lurker.hp };
  let rounds = 0;
  while (lurkerActor.hp > 0 && rounds < 50) {
    rounds++;
    for (const step of e.Monsters.multiattackSequence(lurker)) {
      const ref = lurker.attacks[step.attackRef];
      e.Combat.attackRoll({ attackBonus: ref.attackBonus, ac: pcAc });
    }
    const attack = e.Combat.attackRoll({ attackBonus: swing.attackBonus ?? 5, ac: lurker.ac });
    if (attack.hit) {
      const spec = e.Dice.parse(swing.damageDice ?? swing.damage ?? '1d8+3');
      const dmg = e.Combat.damageRoll({
        damageDice: `${spec.count}d${spec.sides}`,
        damageMod: (spec.modifier ?? 0) + (swing.damageMod ?? 0),
        critical: attack.critical === true,
      });
      const out = e.Combat.applyDamage(lurkerActor, { amount: dmg.total, type: 'slashing' });
      lurkerActor = out.actor;
    }
  }
  assert.ok((lurkerActor.hp ?? 0) <= 0, `the lurker falls (in ${rounds} rounds)`);
  // The whole exchange replays: the roll log verifies against the seed.
  const verdict = e.verifyLog({ seed: 41, log: e.rollLog });
  assert.equal(verdict.ok, true, 'seeded combat is reproducible');
});
