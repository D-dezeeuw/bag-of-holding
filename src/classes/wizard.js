export default {
  id: 'wizard',
  name: 'Wizard',
  hitDie: 6,
  primaryAbility: 'int',
  savingThrowProficiencies: ['int', 'wis'],
  spellcasting: { ability: 'int', cantripsKnown: { 1: 3, 4: 4 } },
  features: {
    1: ['Spellcasting', 'Arcane Recovery'],
    2: ['Arcane Tradition'],
    3: [],
    4: ['Ability Score Improvement'],
    5: []
  }
};
