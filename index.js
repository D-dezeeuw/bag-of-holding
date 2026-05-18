// Public surface for `bag-of-holding`.
//
// Two ways to consume:
//
//   1. Default singleton — convenient for the common single-engine
//      case. Namespaces are spread as named exports.
//
//      import { Combat, Conditions, SRD } from '@nekomedia/bag-of-holding';
//      Combat.applyMastery(weapon, target, attackResult);
//
//   2. Custom engine — when you want to mix in plugin content
//      (homebrew species, custom masteries, additional conditions)
//      or run multiple isolated rule sets on the same page.
//
//      import { createEngine } from '@nekomedia/bag-of-holding';
//      const engine = createEngine({ extraSpecies: { 'half-elf': ... } });
//      engine.Combat.applyMastery(weapon, target, attackResult);
//
// The two share the same shape — the default singleton is just
// `createEngine()` with no options.

import * as Classes from './src/classes/index.js';
import { createEngine } from './src/engine.js';

export { createEngine };

const _default = createEngine();
export default _default;

export const {
  Dice, Checks, Combat, Conditions, XP, Movesets, Beats,
  species, classes, backgrounds, feats, spells, items
} = _default;

// Back-compat `SRD` namespace: groups the data registries the way
// pre-Phase-A consumers imported them. New code can read the
// registries directly off the default export or an engine instance.
export const SRD = Object.freeze({ species, classes, backgrounds, feats, spells, items });

// `Classes` was historically exported as the class-definition map.
// Kept for compatibility — same content as `_default.classes`, just
// under the old name.
export { Classes };
