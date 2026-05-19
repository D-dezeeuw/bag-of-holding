// Public surface for `@zeeuw/bag-of-holding`.
//
// Two ways to consume:
//
//   1. Default singleton — convenient for the common single-engine
//      case. Namespaces are spread as named exports.
//
//      import { Combat, Conditions, SRD } from '@zeeuw/bag-of-holding';
//      Combat.applyMastery(weapon, target, attackResult);
//
//   2. Custom engine — when you want to mix in plugin content
//      (homebrew species, custom masteries, additional conditions),
//      seed the RNG for replay-determinism, or run multiple isolated
//      rule sets on the same page.
//
//      import { createEngine, Dice } from '@zeeuw/bag-of-holding';
//      const engine = createEngine({
//        rng: Dice.seededRng(42),
//        extraSpecies: { 'half-elf': ... }
//      });
//      engine.Combat.applyMastery(weapon, target, attackResult);
//      engine.rollLog;          // audit trail
//      engine.verifyLog({ seed: 42, log });
//
// The two share the same shape — the default singleton is just
// `createEngine()` with no options.

import * as Classes from './src/classes/index.js';
import { createEngine } from './src/engine.js';
import { verifyLog } from './src/replay.js';

export { createEngine, verifyLog };

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
