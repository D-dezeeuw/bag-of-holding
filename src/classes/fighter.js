// SRD 5.2 Fighter, levels 1–5.
//   L1 adds Weapon Mastery (3 weapon slots, rotatable on a Long Rest).
//   L2 adds Tactical Mind (spend a Second Wind to bump a failed check).
//   L5 adds Tactical Shift (Second Wind + half-Speed move w/o OAs).
// `weaponMasterySlots` is the count of weapon kinds whose mastery
// property the fighter can use; the loop tracks which specific
// weapons fill the slots in actor state.

export default {
  id: 'fighter',
  name: 'Fighter',
  hitDie: 10,
  primaryAbility: 'str',
  savingThrowProficiencies: ['str', 'con'],
  weaponMasterySlots: 3,
  features: {
    1: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    2: ['Action Surge', 'Tactical Mind'],
    3: ['Fighter Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Tactical Shift']
  }
};
