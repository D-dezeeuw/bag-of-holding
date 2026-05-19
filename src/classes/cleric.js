export default {
  id: 'cleric',
  name: 'Cleric',
  hitDie: 8,
  primaryAbility: 'wis',
  savingThrowProficiencies: ['wis', 'cha'],
  spellcasting: { ability: 'wis', cantripsKnown: { 1: 3, 4: 4 }, progression: 'full', preparation: 'prepared' },
  features: {
    1: ['Spellcasting', 'Divine Domain'],
    2: ['Channel Divinity (1/rest)'],
    3: [],
    4: ['Ability Score Improvement'],
    5: ['Destroy Undead (CR 1/2)']
  }
};
