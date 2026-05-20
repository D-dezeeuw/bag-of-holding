// SRD 5.2 Origin Feats — the three referenced by the four shipped
// backgrounds. General / Fighting Style / Epic Boon feats are out of
// scope for v0; see docs/spec.md.

export default {
  'magic-initiate': {
    id: 'magic-initiate',
    name: 'Magic Initiate',
    category: 'origin',
    // The feat picks a spell list. `variant` is set on selection.
    variants: ['cleric', 'druid', 'wizard'],
    grants: {
      cantripsKnown: 2,
      level1Spell: 1,           // free cast once per Long Rest
      spellcastingAbility: 'choose:int|wis|cha'
    },
    repeatable: true            // different list each time
  },
  'alert': {
    id: 'alert',
    name: 'Alert',
    category: 'origin',
    grants: {
      initiativeProficiency: true,
      initiativeSwap: true      // swap with a willing ally after rolling
    }
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: 'Savage Attacker',
    category: 'origin',
    grants: {
      // Once per turn on a weapon hit, roll damage dice twice and keep
      // either roll. The loop reads this flag and rolls accordingly.
      rerollWeaponDamageOncePerTurn: true
    }
  },
  // Epic Boon feats per SRD 5.2 § Feats — Epic Boon. Available at
  // L19 and reflect the campaign's final ascent.
  'boon-of-combat-prowess': {
    id: 'boon-of-combat-prowess', name: 'Boon of Combat Prowess',
    category: 'epic-boon',
    grants: { missedAttackRerollOncePerTurn: true }
  },
  'boon-of-dimensional-travel': {
    id: 'boon-of-dimensional-travel', name: 'Boon of Dimensional Travel',
    category: 'epic-boon',
    grants: { freeTeleport30FtOncePerTurn: true }
  },
  'boon-of-energy-resistance': {
    id: 'boon-of-energy-resistance', name: 'Boon of Energy Resistance',
    category: 'epic-boon',
    grants: { pickThreeEnergyResistances: true }
  },
  'boon-of-fate': {
    id: 'boon-of-fate', name: 'Boon of Fate',
    category: 'epic-boon',
    grants: { d10ToCreatureRollOncePerTurn: true }
  },
  'boon-of-fortitude': {
    id: 'boon-of-fortitude', name: 'Boon of Fortitude',
    category: 'epic-boon',
    grants: { hpMaxBonus: 40, regen5OnTurnStart: true }
  },
  'boon-of-irresistible-offense': {
    id: 'boon-of-irresistible-offense', name: 'Boon of Irresistible Offense',
    category: 'epic-boon',
    grants: { trueStrikeWeaponDamageOncePerTurn: true }
  },
  'boon-of-recovery': {
    id: 'boon-of-recovery', name: 'Boon of Recovery',
    category: 'epic-boon',
    grants: { selfHealAsBonusActionOncePerLongRest: true }
  },
  'boon-of-skill': {
    id: 'boon-of-skill', name: 'Boon of Skill',
    category: 'epic-boon',
    grants: { allSkillsProficient: true }
  },
  'boon-of-spell-recall': {
    id: 'boon-of-spell-recall', name: 'Boon of Spell Recall',
    category: 'epic-boon',
    grants: { castWithoutSlotOnConSaveOncePerTurn: true }
  },
  'boon-of-the-night-spirit': {
    id: 'boon-of-the-night-spirit', name: 'Boon of the Night Spirit',
    category: 'epic-boon',
    grants: { dimLightResistance: true, dimLightInvisibility: true }
  },
  'boon-of-truesight': {
    id: 'boon-of-truesight', name: 'Boon of Truesight',
    category: 'epic-boon',
    grants: { truesightFt: 60 }
  }
};
