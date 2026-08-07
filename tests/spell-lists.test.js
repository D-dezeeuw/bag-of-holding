// tests/spell-lists.test.js — the class spell lists, checked against the data
// they have to agree with rather than against themselves.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import SPELLS from '../src/srd/spells.js';
import * as CLASSES from '../src/classes/index.js';
import {
  CASTER_CLASSES, classesFor, isOnClassList, spellsFor, maxSpellLevel,
} from '../src/srd/spell-lists.js';
import { fullCasterSlots, halfCasterSlots, warlockPactSlots } from '../src/spellcasting.js';

// The top spell level a progression's own slot table actually grants.
function topSlotLevel(fn, casterLevel, cap = 9) {
  let top = 0;
  for (let s = 1; s <= cap; s++) if (fn(casterLevel, s) > 0) top = s;
  return top;
}

describe('spell lists — coverage', () => {
  it('every spell in the registry is on at least one class list', () => {
    const orphans = Object.keys(SPELLS).filter(id => classesFor(id).length === 0);
    assert.deepEqual(orphans, [], `spells nobody can cast: ${orphans.join(', ')}`);
  });

  it('every listed spell id exists in the registry', () => {
    for (const id of Object.keys(SPELLS)) assert.ok(SPELLS[id], id);
    // The inverse: spellsFor only ever yields real records.
    for (const cls of CASTER_CLASSES) {
      for (const spell of spellsFor(cls)) assert.equal(SPELLS[spell.id], spell);
    }
  });

  it('every class named on a list is a real class', () => {
    for (const id of Object.keys(SPELLS)) {
      for (const cls of classesFor(id)) {
        assert.ok(CLASSES[cls], `spell '${id}' lists unknown class '${cls}'`);
      }
    }
  });

  it('names exactly the classes the class data says can cast', () => {
    const declared = Object.values(CLASSES).filter(c => c.spellcasting).map(c => c.id).sort();
    // Every class with a spellcasting block has a list, and nothing else does.
    assert.deepEqual(CASTER_CLASSES, declared);
  });

  it('gives every caster class something at its first spell level', () => {
    for (const cls of CASTER_CLASSES) {
      const progression = CLASSES[cls].spellcasting?.progression ?? 'full';
      const first = progression === 'half' ? 1 : 0;
      assert.ok(spellsFor(cls, { level: first }).length > 0,
        `${cls} has no level-${first} spells`);
    }
  });

  it('gives no cantrips to the half casters', () => {
    for (const cls of ['paladin', 'ranger']) {
      assert.deepEqual(spellsFor(cls, { level: 0 }), [], `${cls} should have no cantrips`);
    }
  });
});

describe('spell lists — filtering', () => {
  it('filters by exact level', () => {
    for (const s of spellsFor('wizard', { level: 3 })) assert.equal(s.level, 3);
  });

  it('filters by ceiling', () => {
    for (const s of spellsFor('cleric', { maxLevel: 2 })) assert.ok(s.level <= 2);
  });

  it('sorts by level then name', () => {
    const list = spellsFor('bard');
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      assert.ok(a.level < b.level || (a.level === b.level && a.name.localeCompare(b.name) <= 0),
        `out of order: ${a.name} (${a.level}) before ${b.name} (${b.level})`);
    }
  });

  it('returns an empty list for a non-caster', () => {
    assert.deepEqual(spellsFor('barbarian'), []);
    assert.deepEqual(classesFor('not-a-spell'), []);
    assert.equal(isOnClassList('wizard', 'not-a-spell'), false);
  });
});

describe('maxSpellLevel agrees with the slot tables', () => {
  it('full casters', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      assert.equal(maxSpellLevel(lvl, 'full'), topSlotLevel(fullCasterSlots, lvl),
        `full caster level ${lvl}`);
    }
  });

  it('half casters', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      assert.equal(maxSpellLevel(lvl, 'half'), topSlotLevel(halfCasterSlots, lvl, 5),
        `half caster level ${lvl}`);
    }
  });

  it('pact magic', () => {
    for (let lvl = 1; lvl <= 20; lvl++) {
      assert.equal(maxSpellLevel(lvl, 'pact'), warlockPactSlots(lvl).level,
        `warlock level ${lvl}`);
    }
  });

  it('clamps nonsense input to a playable level', () => {
    assert.equal(maxSpellLevel(0), 1);
    assert.equal(maxSpellLevel(-3), 1);
    assert.equal(maxSpellLevel(NaN), 1);
    assert.equal(maxSpellLevel(999), 9);
  });
});

describe('spell lists — the specific mistakes an invented list makes', () => {
  it('does not let arcane casters heal', () => {
    for (const cls of ['wizard', 'sorcerer', 'warlock']) {
      assert.equal(isOnClassList(cls, 'cure-wounds'), false, `${cls} should not have Cure Wounds`);
      assert.equal(isOnClassList(cls, 'healing-word'), false, `${cls} should not have Healing Word`);
    }
  });

  it('does not let divine casters throw Fireball', () => {
    for (const cls of ['cleric', 'paladin', 'ranger']) {
      assert.equal(isOnClassList(cls, 'fireball'), false, `${cls} should not have Fireball`);
    }
  });

  it('keeps the signature cantrips with their class', () => {
    assert.deepEqual(classesFor('eldritch-blast'), ['warlock']);
    assert.deepEqual(classesFor('vicious-mockery'), ['bard']);
    assert.deepEqual(classesFor('sacred-flame'), ['cleric']);
    assert.deepEqual(classesFor('druidcraft'), ['druid']);
  });

  it('never lists a class twice for one spell', () => {
    for (const id of Object.keys(SPELLS)) {
      const list = classesFor(id);
      assert.equal(new Set(list).size, list.length, `duplicate class on '${id}'`);
    }
  });
});
