export default {
  id: 'rogue',
  name: 'Rogue',
  hitDie: 8,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['dex', 'int'],
  // Sneak Attack scales: 1d6 at L1, +1d6 every 2 levels (rounded).
  sneakAttackDice: { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5 },
  features: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant"],
    2: ['Cunning Action'],
    3: ['Roguish Archetype'],
    4: ['Ability Score Improvement'],
    5: ['Uncanny Dodge'],
    6: ['Expertise (2 more skills)'],
    7: ['Evasion', 'Reliable Talent'],
    8: ['Ability Score Improvement'],
    9: ['Subclass Feature'],
    10: ['Ability Score Improvement']
  }
};
