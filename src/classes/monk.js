// SRD 5.2 Monk, levels 1–5.
//   L1 Unarmored Defense (WIS), Martial Arts (bonus-action attack,
//      martial-arts die starts d6).
//   L2 Monk's Focus (ki points), Unarmored Movement +10ft.
//   L3 Monastic Tradition (subclass), Deflect Attacks.
//   L5 Extra Attack, Stunning Strike.

export default {
  id: 'monk',
  name: 'Monk',
  hitDie: 8,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['str', 'dex'],
  extraAttacks: { 5: 1 },
  // Open Hand is the SRD 5.2 reference subclass.
  subclasses: {
    'open-hand': {
      id: 'open-hand',
      name: 'Warrior of the Open Hand',
      features: {
        3: ['Open Hand Technique']
      }
    }
  },
  features: {
    1: ['Unarmored Defense', 'Martial Arts'],
    2: ["Monk's Focus", 'Unarmored Movement'],
    3: ['Monastic Tradition', 'Deflect Attacks'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Empowered Strikes', 'Subclass Feature'],
    7: ['Evasion'],
    8: ['Ability Score Improvement'],
    9: ['Acrobatic Movement'],
    10: ['Heightened Focus']
  }
};
