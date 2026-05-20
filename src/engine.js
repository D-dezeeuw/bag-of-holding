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
//
// 0.1.0 also adds **forensically inspectable randomness**: pass
// `rng: Dice.seededRng(seed)` for deterministic play, read
// `engine.rollLog` for the full audit trail, tag rolls with
// `context` for trace-back, and call `engine.verifyLog(log)` to
// replay-verify a session.

import * as Dice from './dice.js';
import * as Checks from './checks.js';
import * as CombatBase from './combat.js';
import * as ConditionsBase from './conditions.js';
import * as XPBase from './xp.js';
import * as Movesets from './movesets.js';
import * as Beats from './beats/index.js';
import * as Classes from './classes/index.js';
import * as Character from './character.js';
import * as EncounterBase from './encounter.js';
import * as Spellcasting from './spellcasting.js';
import { verifyLog } from './replay.js';
import { buildRules } from './rules.js';
import { buildHookRegistry, HOOK_EVENTS } from './hooks.js';

import defaultSpecies     from './srd/species.js';
import defaultBackgrounds from './srd/backgrounds.js';
import defaultFeats       from './srd/feats.js';
import defaultSpells      from './srd/spells.js';
import defaultItems       from './srd/items.js';
import defaultMonsters    from './srd/monsters.js';

const REGISTRY_VALIDATORS = {
  species:     { required: ['id', 'name', 'size', 'speed'], arrayFields: ['traits'] },
  classes:     { required: ['id', 'name', 'hitDie'] },
  backgrounds: { required: ['id', 'name', 'abilityScores', 'skillProficiencies', 'originFeat'] },
  feats:       { required: ['id', 'name', 'category'] },
  spells:      { required: ['id', 'name', 'level', 'school'] },
  items:       { required: ['id', 'name', 'type'] },
  monsters:    { required: ['id', 'name', 'ac', 'hp', 'abilityScores'], arrayFields: ['attacks', 'traits'] }
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
 * Build a per-engine `XP` namespace whose progression tables can be
 * overridden via `rules.xpThresholds` / `rules.proficiencyByLevel`
 * (Phase B). When the rule values are `null`, the SRD 5.2 defaults
 * from `xp.js` apply — same behaviour as not overriding at all,
 * just expressed through a single path.
 */
function buildXP(rules, hooks) {
  const thresholds = rules.xpThresholds ?? XPBase.THRESHOLDS;
  const proficiency = rules.proficiencyByLevel ?? XPBase.PROFICIENCY_BY_LEVEL;
  return {
    THRESHOLDS: thresholds,
    PROFICIENCY_BY_LEVEL: proficiency,
    levelForXP: (xp) => XPBase.levelForXP(xp, thresholds),
    nextLevelThreshold: (xp) => XPBase.nextLevelThreshold(xp, thresholds),
    awardMilestone: ({ pc, beat }) => {
      const result = XPBase.awardMilestone({ pc, beat }, thresholds);
      if (hooks && result.willLevelUp) {
        const newLevel = XPBase.levelForXP(result.newTotal, thresholds);
        hooks.fire('onLevelUp', {
          pc,
          fromLevel: pc.level,
          toLevel: newLevel,
          xpDelta: result.xpDelta,
          newTotal: result.newTotal
        });
      }
      return result;
    }
  };
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
 * (gritty resting, faster death) can do so by combining rule mods
 * (Phase B) with their own host-side state machine.
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
 * **0.1.0 — determinism options:**
 *   - `rng`: a `() => [0, 1)` function (default: `Math.random`).
 *     Pass `Dice.seededRng(seed)` for replay-deterministic play.
 *     Threaded to every rolling function the engine owns.
 *   - `onRoll`: called with each `RollEntry` immediately after it's
 *     appended to `engine.rollLog`. Useful for telemetry, live
 *     debug overlays, or piping rolls into Spektrum history.
 *   - `rollLogCap`: drop-oldest size cap on the in-memory log
 *     (default: `Infinity`). The roll counter on each entry is
 *     monotonic across the session, so dropped-then-kept entries
 *     don't shift indexes.
 *
 * **0.2.0 — rule modifications (plugin Phase B):**
 *   - `rules`: small named-knob object tuning combat/XP math.
 *     Validated at construction; defaults preserve SRD 5.2 exactly.
 *     See `src/rules.js § DEFAULT_RULES` for the full knob list.
 *     The merged frozen object is exposed as `engine.rules` for
 *     introspection (handy when a host wants to render "this pack
 *     uses Pathfinder crits" in the UI).
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
 * @param {() => number} [opts.rng]         Custom RNG; default `Math.random`.
 * @param {(entry: object) => void} [opts.onRoll]  Per-roll callback.
 * @param {number} [opts.rollLogCap]        Max log entries (default ∞).
 * @param {object} [opts.rules]             Phase B rule overrides; see DEFAULT_RULES.
 */
export function createEngine(opts = {}) {
  const species     = mergeRegistry('species',     defaultSpecies,     opts.extraSpecies);
  const classes     = mergeRegistry('classes',     Classes,            opts.extraClasses);
  const backgrounds = mergeRegistry('backgrounds', defaultBackgrounds, opts.extraBackgrounds);
  const feats       = mergeRegistry('feats',       defaultFeats,       opts.extraFeats);
  const spells      = mergeRegistry('spells',      defaultSpells,      opts.extraSpells);
  const items       = mergeRegistry('items',       defaultItems,       opts.extraItems);
  const monsters    = mergeRegistry('monsters',    defaultMonsters,    opts.extraMonsters);

  const ConditionsBoundBase = buildConditions(opts.extraConditions);

  // === Phase B rule modifications ===
  const rules = buildRules(opts.rules);

  // === Phase C behavioural hooks ===
  const hooks = buildHookRegistry(opts.hooks);

  // Conditions namespace bound to fire hooks on apply/exhaustion-death.
  // We wrap the base bound namespace rather than re-implementing it
  // so the boolean-condition vocabulary stays the single source of
  // truth.
  const ConditionsBound = {
    ...ConditionsBoundBase,
    apply: (actor, condition) => {
      const next = ConditionsBoundBase.apply(actor, condition);
      hooks.fire('onConditionApplied', { actor: next, condition, previous: actor });
      return next;
    },
    exhaustion: {
      ...ConditionsBoundBase.exhaustion,
      gain: (actor, amount) => {
        const next = ConditionsBoundBase.exhaustion.gain(actor, amount);
        if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
          hooks.fire('onDeath', { actor: next, cause: 'exhaustion', previous: actor });
        }
        return next;
      },
      set: (actor, level) => {
        const next = ConditionsBoundBase.exhaustion.set(actor, level);
        if (ConditionsBoundBase.exhaustion.isDead(next) && !ConditionsBoundBase.exhaustion.isDead(actor)) {
          hooks.fire('onDeath', { actor: next, cause: 'exhaustion', previous: actor });
        }
        return next;
      }
    }
  };

  // === Engine-bound XP namespace (respects rule overrides) ===
  const XPBound = buildXP(rules, hooks);

  // === Determinism plumbing ===
  const rng = opts.rng ?? Math.random;
  const rollLogCap = opts.rollLogCap ?? Infinity;
  const rollLog = [];
  let rollCount = 0;

  const record = (op, payload, context) => {
    const entry = { index: rollCount++, op, ...payload };
    if (context !== undefined) entry.context = context;
    rollLog.push(entry);
    if (opts.onRoll) opts.onRoll(entry);
    if (rollLog.length > rollLogCap) {
      rollLog.splice(0, rollLog.length - rollLogCap);
    }
    return entry;
  };

  // === Per-engine namespaces ===
  // Dice — logged wrappers + the seedable RNG helper. Pure math
  // (`parse`) passes through unchanged because it does no rolling.
  const DiceBound = {
    parse: Dice.parse,
    seededRng: Dice.seededRng,
    rollDie: (sides, context) => {
      const value = Dice.rollDie(sides, rng);
      record('rollDie', { sides, value }, context);
      return value;
    },
    roll: (spec, context) => {
      const result = Dice.roll(spec, rng);
      record('roll', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    },
    rollAdvantage: (spec, context) => {
      const result = Dice.rollAdvantage(spec, rng);
      record('rollAdvantage', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    },
    rollDisadvantage: (spec, context) => {
      const result = Dice.rollDisadvantage(spec, rng);
      record('rollDisadvantage', { spec, rolls: result.rolls, modifier: result.modifier, total: result.total }, context);
      return result;
    }
  };

  // Checks — only `abilityCheck` and `savingThrow` are stochastic;
  // `modFromScore` and `clampDC` are pure helpers.
  const ChecksBound = {
    modFromScore: Checks.modFromScore,
    clampDC: Checks.clampDC,
    abilityCheck: (args, context) => {
      const result = Checks.abilityCheck(args, rng);
      record('abilityCheck', {
        abilityScore: args.abilityScore,
        proficient: args.proficient ?? false,
        proficiencyBonus: args.proficiencyBonus ?? 2,
        ...result
      }, context);
      return result;
    },
    savingThrow: (args, context) => {
      const result = Checks.savingThrow(args, rng);
      record('savingThrow', {
        abilityScore: args.abilityScore,
        proficient: args.proficient ?? false,
        proficiencyBonus: args.proficiencyBonus ?? 2,
        ...result
      }, context);
      return result;
    }
  };

  // Combat — bind both the mastery handler table (plugin contracts)
  // AND the rolling wrappers (logging contracts). `applyMastery`
  // doesn't roll dice; it's pure dispatch over the result of a
  // separate `attackRoll`, so no log entry is needed.
  if (opts.extraMastery) {
    for (const [name, handler] of Object.entries(opts.extraMastery)) {
      if (typeof handler !== 'function') {
        throw new Error(`extraMastery.${name} must be a function`);
      }
    }
  }
  const masteryHandlers = Object.freeze({
    ...CombatBase.DEFAULT_MASTERY_HANDLERS,
    ...(opts.extraMastery ?? {})
  });
  const masteryProperties = Object.freeze(Object.keys(masteryHandlers));
  const CombatBound = {
    rollInitiative: (args, context) => {
      const value = CombatBase.rollInitiative(args, rng);
      record('rollInitiative', { dexterity: args.dexterity, value }, context);
      return value;
    },
    attackRoll: (args, context) => {
      // beforeAttack runs first so a hook can short-circuit (Shield
      // spell raising AC, blur granting disadvantage, etc.). The
      // hook receives the args and returns a delta — the most
      // common deltas are `{ ac: newAc }` and `{ cancelled: true }`.
      // `pre` is a fresh object seeded from args, so attackBonus/ac
      // are always defined on it; hooks can replace either via a
      // delta. No `??` fallback needed.
      const pre = hooks.fire('beforeAttack', { ...args, context });
      if (pre.cancelled === true) {
        const cancelled = { d20: 0, attackBonus: args.attackBonus, total: 0, ac: pre.ac, hit: false, critical: false, fumble: false, stance: 'normal', cancelled: true };
        record('attackRoll', cancelled, context);
        return cancelled;
      }
      // Forward attacker/target/distance so condition-aware
      // advantage/disadvantage flows through. CombatBase.attackRoll
      // computes the stance and rolls the right number of d20s.
      const result = CombatBase.attackRoll({
        attackBonus: pre.attackBonus,
        ac: pre.ac,
        attacker: pre.attacker,
        target: pre.target,
        attackerDistanceFt: pre.attackerDistanceFt
      }, rng, rules);
      record('attackRoll', result, context);
      return result;
    },
    damageRoll: (args, context) => {
      const result = CombatBase.damageRoll(args, rng, rules);
      // afterDamage fires once damage is known. Handlers can adjust
      // `total` (resistances, vulnerabilities, Heavy Armor Master)
      // by returning `{ total: newTotal }`. `merged.total` is always
      // present because it starts as `result.total`.
      const merged = hooks.fire('afterDamage', { ...result, context });
      const final = { ...result, total: merged.total };
      record('damageRoll', final, context);
      return final;
    },
    MASTERY_PROPERTIES: masteryProperties,
    applyMastery: (weapon, target, attackResult, attacker) =>
      CombatBase.applyMastery(weapon, target, attackResult, attacker, masteryHandlers),
    // === Encounter system (since 0.4.0) ===
    //
    // Bound here rather than as a separate top-level namespace so
    // the encounter functions share the engine's rng and rules
    // without the caller threading them per call.
    // Every initiative draw is logged so the encounter's stochastic
    // surface flows into the same rollLog the rest of the engine
    // populates — replay verification then covers an entire combat
    // session end-to-end.
    startEncounter: (participants) => EncounterBase.startEncounter(
      participants, rng,
      ({ dexterity, value }) => record('rollInitiative', { dexterity, value })
    ),
    rollOrder: (participants) => EncounterBase.rollOrder(
      participants, rng,
      ({ dexterity, value }) => record('rollInitiative', { dexterity, value })
    ),
    currentActor: EncounterBase.currentActor,
    endTurn: EncounterBase.endTurn,
    removeParticipant: EncounterBase.removeParticipant,
    spend: EncounterBase.spend,
    freshBudget: EncounterBase.freshBudget,
    attacksPerAction: EncounterBase.attacksPerAction,
    opportunityAttack: (state, args) => {
      const result = EncounterBase.opportunityAttack(state, { ...args, rng, rules });
      if (result.triggered) {
        record('attackRoll', result.attack, args.context);
      }
      return result;
    },
    effectiveAc: EncounterBase.effectiveAc,
    rangeBand: EncounterBase.rangeBand,
    ACTION_COSTS: EncounterBase.ACTION_COSTS,
    COVER_BONUSES: EncounterBase.COVER_BONUSES
  };

  // Engine view passed to character derivation. Built once here so
  // every `deriveSheet` call sees the same plugin-merged registries
  // without re-allocating; the view is structural, so consumers can
  // also use the engine directly (it satisfies the same shape).
  const characterRegistries = {
    species, classes, backgrounds, feats, items, XP: XPBound
  };

  return {
    // Data registries — plain objects, mutate at your own risk.
    species, classes, backgrounds, feats, spells, items, monsters,
    // Math + helpers (bound to this engine's data + rng + rules).
    Dice: DiceBound,
    Checks: ChecksBound,
    Combat: CombatBound,
    Conditions: ConditionsBound,
    XP: XPBound,
    Movesets, Beats,
    // Spellcasting: pure module, no engine binding needed (slot
    // tables are static; concentration state lives on the actor).
    Spellcasting,
    // Character derivation — turns a host-owned record into a
    // frozen sheet. See docs/character-sheet.md.
    deriveSheet: (record) => Character.deriveSheet(record, characterRegistries),
    // Audit / replay surface.
    rollLog,
    verifyLog,
    // Frozen merged rules — exposed for introspection ("which
    // pack is loaded?" UI, debug overlay, telemetry).
    rules,
    // Phase C: read-only hook registry. Hosts can inspect counts
    // and fire ad-hoc events (e.g. `onDeath` from non-exhaustion
    // causes the host detects, like dropping below 0 hp).
    hooks
  };
}

export { HOOK_EVENTS };
