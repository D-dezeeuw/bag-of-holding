export default {
  id: 'wizard',
  name: 'Wizard',
  hitDie: 6,
  primaryAbility: 'int',
  savingThrowProficiencies: ['int', 'wis'],
  spellcasting: { ability: 'int', cantripsKnown: { 1: 3, 4: 4, 10: 5 }, progression: 'full', preparation: 'prepared' },
  features: {
    1: ['Spellcasting', 'Arcane Recovery'],
    2: ['Arcane Tradition'],
    3: [],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature']
  }
};
