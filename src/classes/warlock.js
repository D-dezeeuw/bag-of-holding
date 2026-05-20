// SRD 5.2 Warlock, levels 1–5.
//   L1 Eldritch Invocations (2), Pact Magic.
//   L2 Eldritch Invocation (3).
//   L3 Patron's Boon, Pact Boon.
//   L5 — class feature pause.

export default {
  id: 'warlock',
  name: 'Warlock',
  hitDie: 8,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['wis', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'warlock',
    preparation: 'known'
  },
  subclasses: {
    'fiend-patron': {
      id: 'fiend-patron',
      name: 'Patron: The Fiend',
      features: {
        1: ['Dark One\'s Blessing', 'Expanded Spell List'],
        3: ['Dark One\'s Own Luck']
      }
    }
  },
  features: {
    1: ['Eldritch Invocations', 'Pact Magic'],
    2: ['Eldritch Invocation'],
    3: ["Patron's Boon", 'Pact Boon'],
    4: ['Ability Score Improvement'],
    5: []
  }
};
