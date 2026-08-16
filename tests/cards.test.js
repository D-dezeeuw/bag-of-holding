// Reference card generator (4.3.0 row). What must hold: every card
// kind shares ONE shape (a host writes one layout); cards generate
// clean for EVERY record in every shipped registry and pack (the
// generator is total over the data, not just the pretty rows); and the
// cheat-sheet reads the LIVE rules — a gritty engine prints a gritty
// sheet.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEngine, Cards,
  GRIMOIRE_I, GRIMOIRE_II, TREASURY, BESTIARY_I, BESTIARY_II, BESTIARY_III,
} from '../index.js';

const engine = createEngine({
  extraSpells: { ...GRIMOIRE_I, ...GRIMOIRE_II },
  extraItems: TREASURY,
  extraMonsters: { ...BESTIARY_I, ...BESTIARY_II, ...BESTIARY_III },
});

const isCard = (c) => c
  && typeof c.kind === 'string' && typeof c.id === 'string'
  && typeof c.title === 'string' && Array.isArray(c.sections)
  && c.sections.every((s) => Array.isArray(s.lines) && s.lines.every((l) => typeof l === 'string'));

test('the generator is total: a clean card for every record in every registry', () => {
  for (const spell of Object.values(engine.spells)) {
    assert.ok(isCard(Cards.spellCard(spell)), `spell ${spell.id} makes a card`);
  }
  for (const item of Object.values(engine.items)) {
    assert.ok(isCard(Cards.itemCard(item)), `item ${item.id} makes a card`);
  }
  for (const monster of Object.values(engine.monsters)) {
    assert.ok(isCard(Cards.monsterCard(monster)), `monster ${monster.id} makes a card`);
  }
  for (const classDef of Object.values(engine.classes)) {
    assert.ok(isCard(Cards.classCard(classDef)), `class ${classDef.id} makes a card`);
  }
});

test('cards carry the mechanics a table actually reads at play', () => {
  const fireball = Cards.spellCard(engine.spells.fireball);
  const text = fireball.sections.flatMap((s) => s.lines).join('\n');
  assert.match(text, /Level 3 · Evocation/);
  assert.match(text, /Damage: 8d6/);
  assert.match(text, /Save: DEX/);
  // Grimoire extras surface their new vocabulary.
  const cataract = Cards.spellCard(engine.spells['cataract-of-stars']);
  const cataractText = cataract.sections.flatMap((s) => s.lines).join('\n');
  assert.match(cataractText, /half on success/);
  assert.match(cataractText, /Upcastable/);
  assert.match(cataractText, /Area: cylinder-10/);
  // A charged, cursed, sentient artifact shows all three flags.
  const testament = Cards.itemCard(engine.items['the-unwritten-testament']);
  const testamentText = testament.sections.flatMap((s) => s.lines).join('\n');
  assert.match(testamentText, /Cursed/);
  assert.match(testamentText, /Sentient \(conflict DC 18\)/);
  assert.match(testamentText, /Requires attunement/);
  // A mythic capstone advertises every deep mechanic it carries.
  const silence = Cards.monsterCard(engine.monsters['the-silence-crowned']);
  const silenceText = silence.sections.flatMap((s) => s.lines).join('\n');
  assert.match(silenceText, /Mythic actions/);
  assert.match(silenceText, /Legendary resistance \(3\)/);
  assert.match(silenceText, /Innate spellcasting/);
  // A class card lists features by level.
  const wizard = Cards.classCard(engine.classes.wizard);
  const wizardText = wizard.sections.flatMap((s) => s.lines).join('\n');
  assert.match(wizardText, /Hit die: d6/);
  assert.match(wizardText, /L1: Spellcasting, Arcane Recovery/);
});

test('the cheat-sheet reads the LIVE rules: a gritty engine prints a gritty sheet', () => {
  const srd = Cards.combatCheatSheet(createEngine());
  const srdText = srd.sections.flatMap((s) => s.lines).join('\n');
  assert.match(srdText, /Critical hit on 20/);
  assert.match(srdText, /DC 10, 3 successes/);
  assert.match(srdText, /Long rest: 8 h — hp to max/);

  const gritty = Cards.combatCheatSheet(createEngine({
    rules: {
      critOn: [19, 20], deathSaveDC: 12,
      longRestHpRecovery: 'none', restDurationScale: 'gritty',
    },
  }));
  const grittyText = gritty.sections.flatMap((s) => s.lines).join('\n');
  assert.match(grittyText, /Critical hit on 19, 20/);
  assert.match(grittyText, /DC 12/);
  assert.match(grittyText, /Long rest: 168 h — NO free hp/);
  // One shape across every kind — the host writes ONE layout.
  for (const c of [srd, Cards.spellCard(engine.spells.fireball), Cards.itemCard(engine.items['hush-lantern'] ?? engine.items['lodestar-compass']), Cards.monsterCard(engine.monsters.goblin), Cards.classCard(engine.classes.rogue)]) {
    assert.ok(isCard(c));
  }
  // Refusals are pointers, not undefined behavior.
  assert.throws(() => Cards.spellCard(null), /spell record with an id/);
  assert.throws(() => Cards.combatCheatSheet({}), /engine instance/);
});
