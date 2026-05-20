// SRD 5.2 items — weapons (with mastery assignments), armor, shields,
// and a representative consumable set. Mastery effects are resolved
// through Combat.applyMastery.
//
// Weapon mastery assignments per the SRD Weapons table:
//   longsword/scimitar/battleaxe   → sap
//   shortbow/light-crossbow/rapier → vex
//   dagger/sickle                  → nick
//   quarterstaff/warhammer/maul    → topple
//   greataxe/halberd/glaive        → cleave
//   javelin/handaxe/pike           → slow
//   mace/morningstar/flail         → sap
//   greatsword                     → graze
//   spear/trident                  → push
//   light-hammer                   → nick

export default {
  // Simple melee weapons
  'club':           { id: 'club',           name: 'Club',            type: 'weapon', damage: '1d4', damageType: 'bludgeoning', properties: ['light'],                  mastery: 'slow' },
  'dagger':         { id: 'dagger',         name: 'Dagger',          type: 'weapon', damage: '1d4', damageType: 'piercing',    properties: ['finesse', 'light', 'thrown'], mastery: 'nick' },
  'handaxe':        { id: 'handaxe',        name: 'Handaxe',         type: 'weapon', damage: '1d6', damageType: 'slashing',    properties: ['light', 'thrown'],        mastery: 'vex' },
  'javelin':        { id: 'javelin',        name: 'Javelin',         type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['thrown'],                 mastery: 'slow' },
  'light-hammer':   { id: 'light-hammer',   name: 'Light Hammer',    type: 'weapon', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'],        mastery: 'nick' },
  'mace':           { id: 'mace',           name: 'Mace',            type: 'weapon', damage: '1d6', damageType: 'bludgeoning', properties: [],                         mastery: 'sap' },
  'quarterstaff':   { id: 'quarterstaff',   name: 'Quarterstaff',    type: 'weapon', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'],              mastery: 'topple' },
  'sickle':         { id: 'sickle',         name: 'Sickle',          type: 'weapon', damage: '1d4', damageType: 'slashing',    properties: ['finesse', 'light'],       mastery: 'nick' },
  'spear':          { id: 'spear',          name: 'Spear',           type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['thrown', 'versatile'],    mastery: 'push' },

  // Simple ranged
  'shortbow':       { id: 'shortbow',       name: 'Shortbow',        type: 'weapon', damage: '1d6', damageType: 'piercing',    properties: ['ranged', 'two-handed'],   mastery: 'vex' },
  'crossbow-light': { id: 'crossbow-light', name: 'Light Crossbow',  type: 'weapon', damage: '1d8', damageType: 'piercing',    properties: ['ranged', 'two-handed'],   mastery: 'slow' },

  // Martial melee
  'battleaxe':      { id: 'battleaxe',      name: 'Battleaxe',       type: 'weapon', damage: '1d8',  damageType: 'slashing',    properties: ['versatile'],             mastery: 'topple' },
  'flail':          { id: 'flail',          name: 'Flail',           type: 'weapon', damage: '1d8',  damageType: 'bludgeoning', properties: [],                        mastery: 'sap' },
  'glaive':         { id: 'glaive',         name: 'Glaive',          type: 'weapon', damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'graze' },
  'greataxe':       { id: 'greataxe',       name: 'Greataxe',        type: 'weapon', damage: '1d12', damageType: 'slashing',    properties: ['heavy', 'two-handed'],   mastery: 'cleave' },
  'greatsword':     { id: 'greatsword',     name: 'Greatsword',      type: 'weapon', damage: '2d6',  damageType: 'slashing',    properties: ['heavy', 'two-handed'],   mastery: 'graze' },
  'halberd':        { id: 'halberd',        name: 'Halberd',         type: 'weapon', damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'cleave' },
  'longsword':      { id: 'longsword',      name: 'Longsword',       type: 'weapon', damage: '1d8',  damageType: 'slashing',    properties: ['versatile'],             mastery: 'sap' },
  'maul':           { id: 'maul',           name: 'Maul',            type: 'weapon', damage: '2d6',  damageType: 'bludgeoning', properties: ['heavy', 'two-handed'],   mastery: 'topple' },
  'morningstar':    { id: 'morningstar',    name: 'Morningstar',     type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: [],                        mastery: 'sap' },
  'pike':           { id: 'pike',           name: 'Pike',            type: 'weapon', damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'reach', 'two-handed'], mastery: 'push' },
  'rapier':         { id: 'rapier',         name: 'Rapier',          type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['finesse'],               mastery: 'vex' },
  'scimitar':       { id: 'scimitar',       name: 'Scimitar',        type: 'weapon', damage: '1d6',  damageType: 'slashing',    properties: ['finesse', 'light'],      mastery: 'sap' },
  'shortsword':     { id: 'shortsword',     name: 'Shortsword',      type: 'weapon', damage: '1d6',  damageType: 'piercing',    properties: ['finesse', 'light'],      mastery: 'vex' },
  'trident':        { id: 'trident',        name: 'Trident',         type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['thrown', 'versatile'],   mastery: 'topple' },
  'warhammer':      { id: 'warhammer',      name: 'Warhammer',       type: 'weapon', damage: '1d8',  damageType: 'bludgeoning', properties: ['versatile'],             mastery: 'push' },

  // Martial ranged
  'longbow':        { id: 'longbow',        name: 'Longbow',         type: 'weapon', damage: '1d8',  damageType: 'piercing',    properties: ['heavy', 'ranged', 'two-handed'], mastery: 'slow' },
  'crossbow-heavy': { id: 'crossbow-heavy', name: 'Heavy Crossbow',  type: 'weapon', damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'ranged', 'two-handed'], mastery: 'push' },

  // Armor. category = light / medium / heavy / shield; donTime + doffTime
  // in minutes; strRequired + stealthDisadvantage per SRD 5.2 Armor table.
  'padded':           { id: 'padded',           name: 'Padded Armor',     type: 'armor', category: 'light',  ac: 11, addsDex: true,  weight: 8,  donTime: 1, doffTime: 1, stealthDisadvantage: true },
  'leather-armor':    { id: 'leather-armor',    name: 'Leather Armor',    type: 'armor', category: 'light',  ac: 11, addsDex: true,  weight: 10, donTime: 1, doffTime: 1 },
  'studded-leather':  { id: 'studded-leather',  name: 'Studded Leather',  type: 'armor', category: 'light',  ac: 12, addsDex: true,  weight: 13, donTime: 1, doffTime: 1 },
  'hide':             { id: 'hide',             name: 'Hide',             type: 'armor', category: 'medium', ac: 12, addsDex: true,  maxDex: 2, weight: 12, donTime: 1, doffTime: 1 },
  'chain-shirt':      { id: 'chain-shirt',      name: 'Chain Shirt',      type: 'armor', category: 'medium', ac: 13, addsDex: true,  maxDex: 2, weight: 20, donTime: 1, doffTime: 1 },
  'scale-mail':       { id: 'scale-mail',       name: 'Scale Mail',       type: 'armor', category: 'medium', ac: 14, addsDex: true,  maxDex: 2, weight: 45, donTime: 5, doffTime: 1, stealthDisadvantage: true },
  'breastplate':      { id: 'breastplate',      name: 'Breastplate',      type: 'armor', category: 'medium', ac: 14, addsDex: true,  maxDex: 2, weight: 20, donTime: 5, doffTime: 1 },
  'half-plate':       { id: 'half-plate',       name: 'Half Plate',       type: 'armor', category: 'medium', ac: 15, addsDex: true,  maxDex: 2, weight: 40, donTime: 5, doffTime: 1, stealthDisadvantage: true },
  'ring-mail':        { id: 'ring-mail',        name: 'Ring Mail',        type: 'armor', category: 'heavy',  ac: 14, addsDex: false, weight: 40, donTime: 5, doffTime: 5, stealthDisadvantage: true },
  'chain-mail':       { id: 'chain-mail',       name: 'Chain Mail',       type: 'armor', category: 'heavy',  ac: 16, addsDex: false, weight: 55, donTime: 5, doffTime: 5, stealthDisadvantage: true, strRequired: 13 },
  'splint':           { id: 'splint',           name: 'Splint',           type: 'armor', category: 'heavy',  ac: 17, addsDex: false, weight: 60, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15 },
  'plate':            { id: 'plate',            name: 'Plate Armor',      type: 'armor', category: 'heavy',  ac: 18, addsDex: false, weight: 65, donTime: 10, doffTime: 5, stealthDisadvantage: true, strRequired: 15 },
  'shield':           { id: 'shield',           name: 'Shield',           type: 'armor', category: 'shield', acBonus: 2, weight: 6, donTime: 0, doffTime: 0 },

  // Consumables
  'potion-healing':         { id: 'potion-healing',         name: 'Potion of Healing',         type: 'consumable', heals: '2d4+2' },
  'potion-greater-healing': { id: 'potion-greater-healing', name: 'Potion of Greater Healing', type: 'consumable', heals: '4d4+4' },
  'potion-superior-healing':{ id: 'potion-superior-healing',name: 'Potion of Superior Healing',type: 'consumable', heals: '8d4+8' }
};
