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
import * as CharacterModule from './src/character.js';
import { createEngine, HOOK_EVENTS } from './src/engine.js';
import { verifyLog } from './src/replay.js';
import { STARTER_PARTY } from './src/solo/starter.js';

export { createEngine, verifyLog, HOOK_EVENTS, STARTER_PARTY };

const _default = createEngine();
export default _default;

export const {
  Dice, Checks, Combat, Conditions, XP, Movesets, Beats, Spellcasting, Rest, Mechanics, SceneClock, MagicItems, Monsters, Movement, Multiclass, Inspiration, EncounterDesign, Hazards, Equipment, Travel, MountedCombat,
  Solo, Session, Replay,
  species, classes, backgrounds, feats, spells, items, monsters
} = _default;

// Monster templates — derive higher-tier stat blocks (Elite / Champion /
// Ancient) from verified SRD entries, so a campaign can reach CR 16-24 and give
// the monster-mechanics module (multiattack, legendary actions and resistance)
// something to consume, without transcribing stat blocks from memory.
export { elevate, tiersFor, templateForTargetCr, TEMPLATES } from './src/monster-templates.js';

// Adventures (2.6.0) — the pack format (validateAdventure + run glue) and
// The Quiet Stair, the starter adventure shipped inside the package. The
// content packs are deliberately NOT merged into the default engine: mount
// them at construction — `createEngine({ extraMonsters:
// QUIET_STAIR_MONSTERS, extraItems: QUIET_STAIR_ITEMS })` — so the SRD
// registries stay SRD-only.
import * as AdventuresModule from './src/adventures/index.js';
export const Adventures = Object.freeze({ ...AdventuresModule });
export { QUIET_STAIR, QUIET_STAIR_MONSTERS, QUIET_STAIR_ITEMS, QUIET_STAIR_NPCS } from './src/adventures/index.js';

// Bestiary I (2.7.0) — 50 invented creatures, CR 0–5, across the common
// ecology niches. Mount via `createEngine({ extraMonsters: BESTIARY_I })`
// (composable with the adventure packs: spread them into one map). The SRD
// registry stays SRD-only.
export { BESTIARY_I } from './src/bestiary/bestiary-i.js';
// Bestiary II (2.8.0) — 30 boss-tier opponents, CR 6–15, the first AUTHORED
// data with Legendary Actions, Lair Actions and Innate Spellcasting.
export { BESTIARY_II } from './src/bestiary/bestiary-ii.js';
// Bestiary III (2.9.0) — 10 capstone monsters, CR 16–20, with Legendary
// Resistance pools, Mythic Actions (whose consumer lands with this batch)
// and Innate Spellcasting at levels 6+.
export { BESTIARY_III } from './src/bestiary/bestiary-iii.js';

// Grimoire I (2.10.0) — 50 invented spells, cantrips through 5th, filling
// the tactical roles the SRD selection left thin (reaction casts,
// cylinder/line save-for-half AoEs, concentration buffs, single-target
// debuffs). First shipped data carrying 1.8's `upcast(castLevel)` deltas.
// Mount via `createEngine({ extraSpells: GRIMOIRE_I })`.
export { GRIMOIRE_I } from './src/grimoire/grimoire-i.js';
// Grimoire II (2.11.0) — 30 invented spells, 6th through 9th: city-sized
// AoEs, plane-shifting alternatives, complex multi-target control, so
// tier-3/4 spellcasters have a real list. Composable with Grimoire I.
export { GRIMOIRE_II } from './src/grimoire/grimoire-ii.js';

// The Treasury (2.12.0) — 40 invented magic items across all six rarity
// bands, demonstrating every 1.9 mechanic: charges on all four recharge
// schedules, all three attunement-prereq kinds, cursed items, item saving
// throws, and sentient blocks as host data. Mount via
// `createEngine({ extraItems: TREASURY })`.
export { TREASURY } from './src/treasury/treasury.js';

// Character — exposed as a namespace so module-level callers can
// derive sheets without going through the default singleton:
//   import { Character, createEngine } from '@zeeuw/bag-of-holding';
//   Character.deriveSheet(record, createEngine());
// The default singleton's `deriveSheet` also re-exports below for the
// common case ("just give me the sheet").
export const Character = Object.freeze({
  deriveSheet: CharacterModule.deriveSheet,
  SKILL_ABILITY: CharacterModule.SKILL_ABILITY,
  encumbranceLevel: CharacterModule.encumbranceLevel
});

// Back-compat `SRD` namespace: groups the data registries the way
// pre-Phase-A consumers imported them. New code can read the
// registries directly off the default export or an engine instance.
export const SRD = Object.freeze({ species, classes, backgrounds, feats, spells, items, monsters });

// Which classes may learn which spells — the half of the SRD spell data the
// records themselves never carried. A host offering a player their real spell
// list had to invent one from school and level, which gets a wizard casting
// Cure Wounds.
export {
  CASTER_CLASSES, classesFor, isOnClassList, spellsFor, maxSpellLevel,
} from './src/srd/spell-lists.js';

// `Classes` was historically exported as the class-definition map.
// Kept for compatibility — same content as `_default.classes`, just
// under the old name.
export { Classes };
