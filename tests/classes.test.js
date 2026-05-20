import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine.js';

const engine = createEngine();

const EXPECTED_CLASSES = [
  'fighter', 'rogue', 'cleric', 'wizard',
  'barbarian', 'bard', 'druid', 'monk',
  'paladin', 'ranger', 'sorcerer', 'warlock'
];

for (const id of EXPECTED_CLASSES) {
  test(`class registry includes ${id}`, () => {
    const cls = engine.classes[id];
    assert.ok(cls, `missing class ${id}`);
    assert.equal(cls.id, id);
    assert.equal(typeof cls.hitDie, 'number');
    assert.ok(Array.isArray(cls.savingThrowProficiencies));
  });
}

test('all classes carry features for levels 1–5', () => {
  for (const id of EXPECTED_CLASSES) {
    const cls = engine.classes[id];
    for (let lvl = 1; lvl <= 5; lvl++) {
      assert.ok(Array.isArray(cls.features[lvl]), `${id} level ${lvl} features not array`);
    }
  }
});

test('every class with extra-attack progression has it at L5', () => {
  const fighters = ['fighter', 'barbarian', 'monk', 'paladin', 'ranger'];
  for (const id of fighters) {
    assert.equal(engine.Combat.attacksPerAction(engine.classes[id], 5), 2, `${id} should get 2 attacks at L5`);
  }
});

test('full casters carry full progression', () => {
  const full = ['wizard', 'cleric', 'bard', 'druid', 'sorcerer'];
  for (const id of full) {
    assert.equal(engine.classes[id].spellcasting?.progression, 'full', `${id} progression`);
  }
});

test('half casters carry half progression', () => {
  for (const id of ['paladin', 'ranger']) {
    assert.equal(engine.classes[id].spellcasting?.progression, 'half', `${id} progression`);
  }
});

test('warlock declares Pact Magic progression', () => {
  assert.equal(engine.classes.warlock.spellcasting?.progression, 'warlock');
});

test('non-casters have no spellcasting block', () => {
  for (const id of ['fighter', 'rogue', 'barbarian', 'monk']) {
    assert.equal(engine.classes[id].spellcasting, undefined, `${id} should not cast`);
  }
});

test('each class carries one subclass at L3', () => {
  // Fighter, Rogue, Wizard, Cleric shipped without subclasses in
  // the original release; new classes ship with one. The schema is
  // optional, but we verify the new ones include theirs.
  const withSubclass = ['barbarian', 'bard', 'druid', 'monk', 'paladin', 'ranger', 'sorcerer', 'warlock'];
  for (const id of withSubclass) {
    const cls = engine.classes[id];
    assert.ok(cls.subclasses, `${id} missing subclasses`);
    assert.equal(Object.keys(cls.subclasses).length, 1);
  }
});

test('freshSlots produces expected slot count per class at L5', () => {
  const cases = [
    { id: 'wizard',   progression: 'full',    slots: [{ level: 1, used: 0, max: 4 }, { level: 2, used: 0, max: 3 }, { level: 3, used: 0, max: 2 }] },
    { id: 'paladin',  progression: 'half',    slots: [{ level: 1, used: 0, max: 4 }, { level: 2, used: 0, max: 2 }] },
    { id: 'warlock',  progression: 'warlock', slots: [{ level: 3, used: 0, max: 2, source: 'pact' }] }
  ];
  for (const c of cases) {
    const cls = engine.classes[c.id];
    assert.equal(cls.spellcasting.progression, c.progression);
    const slots = engine.Spellcasting.freshSlots(c.progression, 5);
    assert.deepEqual(slots, c.slots);
  }
});
