// SRD 5.2 Sorcerer, levels 1–5.
//   L1 Spellcasting (full, CHA, known), Innate Sorcery.
//   L2 Sorcerous Origin (subclass — early in 5.2 from 1).
//      Font of Magic — sorcery points.
//   L3 Metamagic (pick 2).
//   L5 Sorcerous Restoration.

export default {
  id: 'sorcerer',
  name: 'Sorcerer',
  hitDie: 6,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['con', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 4, 4: 5 },
    progression: 'full',
    preparation: 'known'
  },
  subclasses: {
    'draconic-sorcery': {
      id: 'draconic-sorcery',
      name: 'Draconic Sorcery',
      features: {
        1: ['Draconic Resilience', 'Draconic Ancestry'],
        3: ['Elemental Affinity']
      }
    }
  },
  features: {
    1: ['Spellcasting', 'Innate Sorcery'],
    2: ['Font of Magic'],
    3: ['Metamagic'],
    4: ['Ability Score Improvement'],
    5: ['Sorcerous Restoration']
  }
};
