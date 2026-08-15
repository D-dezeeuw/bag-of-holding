import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as SRD from '../src/srd/index.js';

test('SRD ships species (not races) at v0', () => {
  assert.equal(typeof SRD.species, 'object');
  assert.equal(SRD.races, undefined);
});

test('species list includes the 4 originals and the 5 SRD 5.2 additions', () => {
  const ids = Object.keys(SRD.species).sort();
  for (const id of ['human', 'elf', 'dwarf', 'halfling',
                    'dragonborn', 'gnome', 'goliath', 'orc', 'tiefling']) {
    assert.ok(ids.includes(id), `missing species ${id}`);
  }
});

test('species carry size + speed + traits (no ability bonuses)', () => {
  for (const sp of Object.values(SRD.species)) {
    assert.equal(typeof sp.size, 'string');
    assert.equal(typeof sp.speed, 'number');
    assert.ok(Array.isArray(sp.traits));
    assert.equal(sp.abilityBonuses, undefined,
      `${sp.id} should not carry abilityBonuses (those moved to backgrounds in 5.2)`);
  }
});

test('Goliath has the speed-35 Giant Ancestry trait', () => {
  assert.equal(SRD.species.goliath.speed, 35);
});

test('backgrounds ship the 4 SRD 5.2 backgrounds with origin feats', () => {
  const bgs = SRD.backgrounds;
  for (const id of ['acolyte', 'criminal', 'sage', 'soldier']) {
    assert.ok(bgs[id], `missing background ${id}`);
    assert.equal(bgs[id].abilityScores.length, 3);
    assert.equal(bgs[id].skillProficiencies.length, 2);
    assert.equal(typeof bgs[id].toolProficiency, 'string');
    assert.equal(typeof bgs[id].originFeat.id, 'string');
  }
});

test('background origin feats reference real feat records', () => {
  for (const bg of Object.values(SRD.backgrounds)) {
    assert.ok(SRD.feats[bg.originFeat.id],
      `background ${bg.id} references unknown feat ${bg.originFeat.id}`);
  }
});

test('Magic Initiate variants line up with Acolyte (cleric) and Sage (wizard)', () => {
  assert.equal(SRD.backgrounds.acolyte.originFeat.variant, 'cleric');
  assert.equal(SRD.backgrounds.sage.originFeat.variant, 'wizard');
  assert.ok(SRD.feats['magic-initiate'].variants.includes('cleric'));
  assert.ok(SRD.feats['magic-initiate'].variants.includes('wizard'));
});

// === 2.6.0 registry additions — the blocks downstream pools referenced ===

test('the overlay-gap monsters resolve by the exact ids downstream pools use', () => {
  // These eight ids were referenced by the client's dungeon overlays for
  // months while resolving to nothing (the overlay silently filtered
  // them and rooms lost their intended enemies). Now they are real.
  const added = ['bugbear', 'shadow', 'giant-rat', 'animated-armor',
    'flying-sword', 'will-o-wisp', 'gibbering-mouther', 'giant-wolf-spider'];
  for (const id of added) {
    const m = SRD.monsters[id];
    assert.ok(m, `${id} is in the registry`);
    assert.equal(m.id, id);
    assert.ok(m.cr >= 0 && m.hp > 0 && m.ac > 0, `${id} has sane numbers`);
    assert.ok(m.senses, `${id} carries senses`);
  }
  // Animated armor is the registry's first SRD block with an authored
  // multiattack routine.
  assert.equal(SRD.monsters['animated-armor'].multiattack.attacks.length, 2);
  // SRD 5.2 renamed the sword; the id stays put for downstream pools.
  assert.equal(SRD.monsters['flying-sword'].name, 'Animated Flying Sword');
});
