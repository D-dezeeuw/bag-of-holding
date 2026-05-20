// SRD 5.2 Druid, levels 1–5.
//   L1 Spellcasting (full caster, WIS, prepared), Druidic.
//   L2 Wild Shape, Druid Circle (subclass).
//   L3 — class feature pause.
//   L5 — class feature pause.

export default {
  id: 'druid',
  name: 'Druid',
  hitDie: 8,
  primaryAbility: 'wis',
  savingThrowProficiencies: ['int', 'wis'],
  spellcasting: {
    ability: 'wis',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'full',
    preparation: 'prepared'
  },
  subclasses: {
    'circle-of-the-land': {
      id: 'circle-of-the-land',
      name: 'Circle of the Land',
      features: {
        2: ['Cantrip', 'Land Stride'],
        3: ['Circle Spells']
      }
    }
  },
  features: {
    1: ['Druidic', 'Spellcasting'],
    2: ['Wild Shape', 'Druid Circle'],
    3: [],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: ['Elemental Fury'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature']
  }
};
