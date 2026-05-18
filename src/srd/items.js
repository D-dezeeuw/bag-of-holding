// SRD 5.2 weapon mastery property assignments per the Weapons table:
//   longsword     → sap
//   shortbow      → vex
//   dagger        → nick
//   quarterstaff  → topple
// Mastery effects are resolved through Combat.applyMastery.

export default {
  'longsword':      { id: 'longsword',      name: 'Longsword',         type: 'weapon',     damage: '1d8', damageType: 'slashing',    properties: ['versatile'],         mastery: 'sap' },
  'shortbow':       { id: 'shortbow',       name: 'Shortbow',          type: 'weapon',     damage: '1d6', damageType: 'piercing',    properties: ['ranged'],            mastery: 'vex' },
  'dagger':         { id: 'dagger',         name: 'Dagger',            type: 'weapon',     damage: '1d4', damageType: 'piercing',    properties: ['finesse', 'thrown'], mastery: 'nick' },
  'quarterstaff':   { id: 'quarterstaff',   name: 'Quarterstaff',      type: 'weapon',     damage: '1d6', damageType: 'bludgeoning', properties: ['versatile'],         mastery: 'topple' },
  'leather-armor':  { id: 'leather-armor',  name: 'Leather Armor',     type: 'armor',      ac: 11,        addsDex: true },
  'chain-shirt':    { id: 'chain-shirt',    name: 'Chain Shirt',       type: 'armor',      ac: 13,        addsDex: true,  maxDex: 2 },
  'shield':         { id: 'shield',         name: 'Shield',            type: 'armor',      acBonus: 2 },
  'potion-healing': { id: 'potion-healing', name: 'Potion of Healing', type: 'consumable', heals: '2d4+2' }
};
