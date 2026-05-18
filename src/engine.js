// === createEngine: per-instance scope for content registries ===
//
// The engine is what a host application — Dungeons-and-Dans, a
// homebrew theme, a tutorial sandbox — instantiates to get a bound
// set of rules namespaces plus the data registries (species,
// classes, items, etc.) it should look up against.
//
// Why instance-scoped instead of module-globals: a single page may
// run several distinct rule sets at once (the main campaign + a
// "what if my character had been a pirate" preview), and plugin
// authors need a place to land contributions that doesn't mutate
// global state and bleed into every other consumer. The default
// singleton (exported from index.js) is just a `createEngine()`
// with no opts — convenient for the common single-engine case.
//
// Phase A scope: **content extension only**. Plugins can contribute
// species, classes, backgrounds, feats, spells, items, conditions,
// and weapon mastery handlers. Rule modifications (custom crit
// thresholds, exploding dice, alternative XP curves) and behavioural
// hooks (`beforeAttack`, `afterDamage`) are deferred to Phases B/C —
// see docs/spec.md § Plugins.

import * as Dice from './dice.js';
import * as Checks from './checks.js';
import * as CombatBase from './combat.js';
import * as ConditionsBase from './conditions.js';
import * as XP from './xp.js';
import * as Movesets from './movesets.js';
import * as Beats from './beats/index.js';
import * as Classes from './classes/index.js';

import defaultSpecies     from './srd/species.js';
import defaultBackgrounds from './srd/backgrounds.js';
import defaultFeats       from './srd/feats.js';
import defaultSpells      from './srd/spells.js';
import defaultItems       from './srd/items.js';

const REGISTRY_VALIDATORS = {
  species:     { required: ['id', 'name', 'size', 'speed'], arrayFields: ['traits'] },
  classes:     { required: ['id', 'name', 'hitDie'] },
  backgrounds: { required: ['id', 'name', 'abilityScores', 'skillProficiencies', 'originFeat'] },
  feats:       { required: ['id', 'name', 'category'] },
  spells:      { required: ['id', 'name', 'level', 'school'] },
  items:       { required: ['id', 'name', 'type'] }
};

/**
 * Validate a single record against its registry's contract. Throws
 * with a clear pointer (registry + offending id + missing field) so
 * a plugin author sees exactly what's wrong rather than discovering
 * the gap at first use.
 *
 * Why per-registry-shape validation instead of a general schema lib:
 * we ship zero runtime deps, the rules are stable enough that hand-
 * rolled checks are cheap, and a 20-line validator is friendlier to
 * read than a Zod schema in this codebase.
 */
function validateRecord(registry, id, record) {
  const rules = REGISTRY_VALIDATORS[registry];
  if (record === null || typeof record !== 'object') {
    throw new Error(`Plugin contribution ${registry}.${id} must be an object`);
  }
  for (const field of rules.required) {
    if (record[field] === undefined) {
      throw new Error(`Plugin contribution ${registry}.${id} missing required field: ${field}`);
    }
  }
  for (const field of rules.arrayFields ?? []) {
    if (record[field] !== undefined && !Array.isArray(record[field])) {
      throw new Error(`Plugin contribution ${registry}.${id}.${field} must be an array`);
    }
  }
}

/**
 * Merge defaults with plugin contributions, validating each new
 * record on the way in. Last-write-wins on id collision: a plugin
 * that re-declares `species.elf` replaces the SRD entry, which is
 * how "rebalanced" or "themed" packs work (a grimdark theme might
 * ship harsher versions of the base species).
 */
function mergeRegistry(registry, defaults, extras = {}) {
  for (const [id, record] of Object.entries(extras)) {
    validateRecord(registry, id, record);
  }
  return { ...defaults, ...extras };
}

/**
 * Build a per-engine `Conditions` namespace whose `apply` is bound
 * to this engine's combined condition list. The boolean condition
 * vocabulary expands deterministically: SRD 5.2 conditions come
 * first, then plugin contributions appended in registration order,
 * with duplicates collapsed.
 *
 * Exhaustion stays as it is — a numeric scalar, not part of the
 * boolean list. Plugins that want to extend Exhaustion semantics
 * (gritty resting, faster death) belong to Phase B (rule mods).
 */
function buildConditions(extraConditions = []) {
  if (!Array.isArray(extraConditions)) {
    throw new Error('extraConditions must be an array of strings');
  }
  for (const c of extraConditions) {
    if (typeof c !== 'string' || c.length === 0) {
      throw new Error(`extraConditions entries must be non-empty strings (got ${JSON.stringify(c)})`);
    }
  }
  const combined = Object.freeze([...new Set([...ConditionsBase.CONDITIONS, ...extraConditions])]);
  return {
    CONDITIONS: combined,
    EXHAUSTION_MAX: ConditionsBase.EXHAUSTION_MAX,
    has: ConditionsBase.has,
    apply: (actor, condition) => ConditionsBase.apply(actor, condition, combined),
    remove: ConditionsBase.remove,
    exhaustion: ConditionsBase.exhaustion
  };
}

/**
 * Build a per-engine `Combat` namespace whose `applyMastery` is
 * bound to this engine's combined handler table. Custom mastery
 * properties contributed by plugins must each be a function — we
 * check that explicitly because the only way the dispatch can fail
 * silently is by handing it a non-callable handler.
 */
function buildCombat(extraMastery = {}) {
  for (const [name, handler] of Object.entries(extraMastery)) {
    if (typeof handler !== 'function') {
      throw new Error(`extraMastery.${name} must be a function`);
    }
  }
  const handlers = Object.freeze({ ...CombatBase.DEFAULT_MASTERY_HANDLERS, ...extraMastery });
  const masteryProperties = Object.freeze(Object.keys(handlers));
  return {
    rollInitiative: CombatBase.rollInitiative,
    attackRoll: CombatBase.attackRoll,
    damageRoll: CombatBase.damageRoll,
    MASTERY_PROPERTIES: masteryProperties,
    applyMastery: (weapon, target, attackResult, attacker) =>
      CombatBase.applyMastery(weapon, target, attackResult, attacker, handlers)
  };
}

/**
 * Create a new engine instance. With no options, you get the SRD 5.2
 * defaults — the same set the module-level default singleton uses.
 * With plugin contributions in `opts`, those are validated and
 * merged on top of the defaults.
 *
 * The returned engine is the canonical surface plugin and host code
 * should use: read data registries directly (`engine.species`),
 * call math through the namespaces (`engine.Combat.applyMastery`),
 * and trust that any binding to per-engine state has already been
 * done for you.
 *
 * @param {object} [opts]
 * @param {object} [opts.extraSpecies]      Map of id → species record.
 * @param {object} [opts.extraClasses]      Map of id → class record.
 * @param {object} [opts.extraBackgrounds]  Map of id → background record.
 * @param {object} [opts.extraFeats]        Map of id → feat record.
 * @param {object} [opts.extraSpells]       Map of id → spell record.
 * @param {object} [opts.extraItems]        Map of id → item record.
 * @param {string[]} [opts.extraConditions] Names of new boolean conditions.
 * @param {object} [opts.extraMastery]      Map of name → MasteryHandler.
 */
export function createEngine(opts = {}) {
  const species     = mergeRegistry('species',     defaultSpecies,     opts.extraSpecies);
  const classes     = mergeRegistry('classes',     Classes,            opts.extraClasses);
  const backgrounds = mergeRegistry('backgrounds', defaultBackgrounds, opts.extraBackgrounds);
  const feats       = mergeRegistry('feats',       defaultFeats,       opts.extraFeats);
  const spells      = mergeRegistry('spells',      defaultSpells,      opts.extraSpells);
  const items       = mergeRegistry('items',       defaultItems,       opts.extraItems);

  const Conditions  = buildConditions(opts.extraConditions);
  const Combat      = buildCombat(opts.extraMastery);

  return {
    // Data registries — plain objects, mutate at your own risk.
    species, classes, backgrounds, feats, spells, items,
    // Math + helpers (some bound to this engine's data).
    Dice, Checks, Combat, Conditions, XP, Movesets, Beats
  };
}
