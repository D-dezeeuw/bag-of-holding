// SRD 5.2 Ranger, levels 1–5.
//   L1 Favored Enemy, Spellcasting (half-caster, WIS, prepared).
//   L2 Deft Explorer, Fighting Style.
//   L3 Ranger Subclass (subclass), Primal Awareness.
//   L5 Extra Attack.

export default {
  id: 'ranger',
  name: 'Ranger',
  hitDie: 10,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['str', 'dex'],
  extraAttacks: { 5: 1 },
  spellcasting: {
    ability: 'wis',
    progression: 'half',
    preparation: 'prepared'
  },
  subclasses: {
    'hunter': {
      id: 'hunter',
      name: 'Hunter',
      features: {
        3: ["Hunter's Lore", "Hunter's Prey"]
      }
    }
  },
  features: {
    1: ['Favored Enemy', 'Spellcasting'],
    2: ['Deft Explorer', 'Fighting Style'],
    3: ['Ranger Subclass', 'Primal Awareness'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack']
  }
};
