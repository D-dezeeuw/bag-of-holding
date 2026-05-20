// SRD 5.2 Bard, levels 1–5.
//   L1 Bardic Inspiration, Spellcasting (full caster, CHA, known list).
//   L2 Expertise (2 skills), Jack of All Trades.
//   L3 Bard College (subclass), Bardic Inspiration die d8.
//   L5 Font of Inspiration, Bardic Inspiration die d8 → d8.

export default {
  id: 'bard',
  name: 'Bard',
  hitDie: 8,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['dex', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'full',
    preparation: 'known'
  },
  subclasses: {
    'college-of-lore': {
      id: 'college-of-lore',
      name: 'College of Lore',
      features: {
        3: ['Bonus Proficiencies', 'Cutting Words']
      }
    }
  },
  features: {
    1: ['Bardic Inspiration', 'Spellcasting'],
    2: ['Expertise', 'Jack of All Trades'],
    3: ['Bard College'],
    4: ['Ability Score Improvement'],
    5: ['Font of Inspiration']
  }
};
