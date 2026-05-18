export default {
  'cure-wounds':   { id: 'cure-wounds',   name: 'Cure Wounds',   level: 1, school: 'evocation',     healing: '1d8+mod' },
  'magic-missile': { id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'evocation',     damage: '1d4+1', autohit: true, projectiles: 3 },
  'fire-bolt':     { id: 'fire-bolt',     name: 'Fire Bolt',     level: 0, school: 'evocation',     damage: '1d10' },
  'sacred-flame':  { id: 'sacred-flame',  name: 'Sacred Flame',  level: 0, school: 'evocation',     damage: '1d8', save: 'dex' },
  'shield':        { id: 'shield',        name: 'Shield',        level: 1, school: 'abjuration',    reaction: true, acBonus: 5 },
  'mage-armor':    { id: 'mage-armor',    name: 'Mage Armor',    level: 1, school: 'abjuration',    sets: { ac: '13+dex' } }
};
