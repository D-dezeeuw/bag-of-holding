// SRD 5.2 species — size, speed, signature traits.
// Ability score increases come from backgrounds (see backgrounds.js),
// not species, per the 5.2 character-creation rules.
//
// Structured mechanic fields (since v1.13.0):
//   senses             — { darkvision?: ft } — consumed by effectiveLight()
//                        and surfaced on DerivedSheet.senses.
//   damageResistances  — damage-type strings the species resists by default.
//                        Dragonborn is omitted here: their resistance is
//                        determined by draconic ancestry (a character-record
//                        choice), not shared across the species.
//   conditionImmunities — condition names the species is immune to by default.
//                         None for SRD 5.2 player species.
//   flags              — boolean trait switches consumed by rules modules
//                        (e.g. halflingLucky → Inspiration.applyHalflingLucky).

export default {
  human:      {
    id: 'human',      name: 'Human',      size: 'medium', speed: 30,
    traits: ['Resourceful', 'Skillful', 'Versatile'],
    senses: {}, damageResistances: [], conditionImmunities: [], flags: {}
  },
  elf:        {
    id: 'elf',        name: 'Elf',        size: 'medium', speed: 30,
    traits: ['Darkvision 60ft', 'Fey Ancestry', 'Keen Senses', 'Trance'],
    senses: { darkvision: 60 }, damageResistances: [], conditionImmunities: [],
    flags: { feyAncestry: true }
  },
  dwarf:      {
    id: 'dwarf',      name: 'Dwarf',      size: 'medium', speed: 30,
    traits: ['Darkvision 120ft', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'],
    senses: { darkvision: 120 }, damageResistances: [], conditionImmunities: [],
    flags: { dwarvenResilience: true, stonecunning: true }
  },
  halfling:   {
    id: 'halfling',   name: 'Halfling',   size: 'small',  speed: 30,
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'],
    senses: {}, damageResistances: [], conditionImmunities: [],
    flags: { halflingLucky: true, brave: true }
  },
  dragonborn: {
    id: 'dragonborn', name: 'Dragonborn', size: 'medium', speed: 30,
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Draconic Flight (L5)'],
    // Damage resistance depends on draconic ancestry chosen at char-creation.
    // Hosts supply it via record.damageResistances; the base species omits it.
    senses: {}, damageResistances: [], conditionImmunities: [],
    flags: { breathWeapon: true }
  },
  gnome:      {
    id: 'gnome',      name: 'Gnome',      size: 'small',  speed: 30,
    traits: ['Darkvision 60ft', 'Gnomish Cunning'],
    senses: { darkvision: 60 }, damageResistances: [], conditionImmunities: [],
    flags: { gnomishCunning: true }
  },
  goliath:    {
    id: 'goliath',    name: 'Goliath',    size: 'medium', speed: 35,
    traits: ['Giant Ancestry', 'Powerful Build', 'Large Form (L5)'],
    senses: {}, damageResistances: [], conditionImmunities: [],
    flags: { powerfulBuild: true }
  },
  orc:        {
    id: 'orc',        name: 'Orc',        size: 'medium', speed: 30,
    traits: ['Adrenaline Rush', 'Darkvision 120ft', 'Powerful Build', 'Relentless Endurance'],
    senses: { darkvision: 120 }, damageResistances: [], conditionImmunities: [],
    flags: { powerfulBuild: true, relentlessEndurance: true }
  },
  tiefling:   {
    id: 'tiefling',   name: 'Tiefling',   size: 'medium', speed: 30,
    traits: ['Darkvision 60ft', 'Fiendish Legacy', 'Otherworldly Presence'],
    senses: { darkvision: 60 }, damageResistances: ['fire'], conditionImmunities: [],
    flags: {}
  }
};
