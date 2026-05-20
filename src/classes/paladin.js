// SRD 5.2 Paladin, levels 1–5.
//   L1 Lay on Hands, Spellcasting (half-caster, CHA, prepared).
//   L2 Fighting Style, Divine Smite, Channel Divinity.
//   L3 Sacred Oath (subclass).
//   L5 Extra Attack, Faithful Steed.

export default {
  id: 'paladin',
  name: 'Paladin',
  hitDie: 10,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['wis', 'cha'],
  extraAttacks: { 5: 1 },
  spellcasting: {
    ability: 'cha',
    progression: 'half',
    preparation: 'prepared'
  },
  subclasses: {
    'oath-of-devotion': {
      id: 'oath-of-devotion',
      name: 'Oath of Devotion',
      features: {
        3: ['Oath Spells', 'Channel Divinity: Sacred Weapon']
      }
    }
  },
  features: {
    1: ['Lay on Hands', 'Spellcasting'],
    2: ['Fighting Style', 'Divine Smite', 'Channel Divinity'],
    3: ['Sacred Oath'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Faithful Steed']
  }
};
