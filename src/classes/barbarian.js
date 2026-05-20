// SRD 5.2 Barbarian, levels 1–5.
//   L1 Rage, Unarmored Defense.
//   L2 Reckless Attack, Danger Sense.
//   L3 Primal Path (subclass).
//   L5 Extra Attack, Fast Movement.

export default {
  id: 'barbarian',
  name: 'Barbarian',
  hitDie: 12,
  primaryAbility: 'str',
  savingThrowProficiencies: ['str', 'con'],
  weaponMasterySlots: 2,
  extraAttacks: { 5: 1 },
  // Berserker is the SRD 5.2 reference subclass.
  subclasses: {
    berserker: {
      id: 'berserker',
      name: 'Path of the Berserker',
      features: {
        3: ['Frenzy'],
        // 6+ deferred to 0.9.0.
      }
    }
  },
  features: {
    1: ['Rage', 'Unarmored Defense'],
    2: ['Reckless Attack', 'Danger Sense'],
    3: ['Primal Path'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Fast Movement']
  }
};
