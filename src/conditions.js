/**
 * The closed vocabulary of SRD 5.2 boolean conditions. Frozen so
 * downstream code (and the `apply` validation below) can treat it
 * as a contract — a mutation in one importer would silently change
 * what counts as a valid condition everywhere else.
 *
 * Exhaustion is deliberately absent: it carries a level 0–6, not a
 * boolean, and folding it into this list would force every consumer
 * to special-case it. It lives in the `exhaustion` namespace below.
 */
export const CONDITIONS = Object.freeze([
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious'
]);

// === Mechanical effects (since 0.7.0) ===
//
// Each condition declares the deltas it imposes on the math. Hosts
// don't need to memorise the SRD table — the engine reads these
// flags directly in attack / save / speed code. Flags:
//
//   attackerDisadvantage — attacker rolls disadvantage on attacks
//                          targeting this actor
//   targetAdvantage      — attackers gain advantage when attacking
//                          this actor
//   ownAttackDisadvantage — actor rolls disadvantage on their own
//                          attacks
//   autoFailStrDexSaves  — actor automatically fails STR/DEX saves
//   incapacitates        — actor can't take actions, bonus actions,
//                          or reactions
//   speedZero            — actor's speed drops to 0
//   critIfAttackerWithin5 — melee attacks from within 5 ft crit
//                           automatically on hit (paralyzed,
//                           petrified, unconscious, stunned)
//   cantSpeak            — actor can't speak; blocks somatic-free
//                          spellcasting
//   cantSee              — actor can't see; blocks sight-dependent
//                          checks and abilities (Sneak Attack via
//                          ranged for the rogue, etc.)
//
// Multiple conditions can carry the same flag — applying multiple
// `attackerDisadvantage`-tagged conditions doesn't stack
// disadvantage in 5e (you have disadvantage or you don't), so the
// merge is boolean-OR.

// Shallow-build then deep-freeze each entry so a consumer can't
// mutate the inner records.
const _RAW_CONDITION_EFFECTS = {
  blinded: {
    // SRD: a blinded creature's attacks have disadvantage; attacks
    // against it have advantage.
    ownAttackDisadvantage: true,
    targetAdvantage: true,
    cantSee: true
  },
  charmed: {
    // The charmer has advantage on social checks vs the charmed
    // actor; we surface that as `charmedBy` semantics on the actor
    // (host owns the charmer reference). The flag here lets
    // downstream code know to look.
    socialDisadvantageVsCharmer: true
  },
  deafened: {
    cantHear: true
  },
  frightened: {
    // While the source of fright is in sight: disadvantage on
    // ability checks AND attack rolls. Host decides "is the source
    // in sight" — the flag lets the math conservatively apply
    // disadvantage when the host doesn't deny it.
    ownAttackDisadvantage: true,
    ownCheckDisadvantage: true
  },
  grappled: {
    speedZero: true
  },
  incapacitated: {
    incapacitates: true,
    cantSpeak: true   // SRD 2024 update: incapacitated can't speak
  },
  invisible: {
    targetDisadvantage: true,      // attackers have disadvantage on this actor
    ownAttackAdvantage: true
  },
  paralyzed: {
    incapacitates: true,
    speedZero: true,
    autoFailStrDexSaves: true,
    targetAdvantage: true,
    critIfAttackerWithin5: true
  },
  petrified: {
    incapacitates: true,
    speedZero: true,
    autoFailStrDexSaves: true,
    targetAdvantage: true,
    resistance: 'all'  // host applies a flat 0.5x multiplier on damage
  },
  poisoned: {
    ownAttackDisadvantage: true,
    ownCheckDisadvantage: true
  },
  prone: {
    // Attackers within 5 ft have advantage; attackers further than
    // 5 ft have disadvantage. The math layer needs the distance to
    // decide — we surface `proneOnTarget: true` and let the call
    // site pass `attackerDistance` into the modifier helper.
    proneOnTarget: true,
    ownAttackDisadvantage: true   // 5e: a prone actor's attacks have disadvantage
  },
  restrained: {
    speedZero: true,
    targetAdvantage: true,
    ownAttackDisadvantage: true,
    saveDexDisadvantage: true
  },
  stunned: {
    incapacitates: true,
    speedZero: true,
    autoFailStrDexSaves: true,
    targetAdvantage: true
  },
  unconscious: {
    incapacitates: true,
    speedZero: true,
    autoFailStrDexSaves: true,
    targetAdvantage: true,
    critIfAttackerWithin5: true,
    cantSee: true,
    cantHear: true
  }
};

for (const v of Object.values(_RAW_CONDITION_EFFECTS)) Object.freeze(v);
export const CONDITION_EFFECTS = Object.freeze(_RAW_CONDITION_EFFECTS);

// === Condition entry helpers (since 1.6.1) ===
//
// `actor.conditions` entries are now record-shaped:
//   `{ name, source?, dc?, saveAbility?, endsOn? }`
// where `endsOn` is `'turnEnd'` or `'turnStart'`.
//
// String entries from saves predating v1.6.1 are tolerated on read
// by every internal site via `nameOf`. The public `apply` API still
// accepts a plain string and normalises it to `{ name }` on write,
// preserving idempotent set-semantics for that path.

/** @internal Extract the condition name from a string or record entry. */
function nameOf(entry) {
  return typeof entry === 'string' ? entry : entry.name;
}

/**
 * Public version of `nameOf` — extracts the condition name from a
 * string or a `ConditionRecord`. Useful for hosts iterating
 * `actor.conditions` to build UI labels without re-implementing the
 * shape check.
 */
export function conditionName(entry) {
  return nameOf(entry);
}

/**
 * Compute the union of effect flags from an actor's active
 * conditions. Multiple conditions OR together — applying
 * `paralyzed` and `restrained` to the same actor is the union of
 * both effect maps.
 *
 * `actor.conditions` may be absent (a fresh actor). The result is
 * a plain object the math layer reads with `.something`.
 * Accepts both string entries (legacy) and record entries (v1.6.1+).
 */
export function effectsFor(actor) {
  const flags = {};
  for (const entry of actor.conditions ?? []) {
    const condition = nameOf(entry);
    const effect = CONDITION_EFFECTS[condition];
    if (!effect) continue;
    for (const [k, v] of Object.entries(effect)) {
      if (typeof v === 'boolean') flags[k] = flags[k] || v;
      else flags[k] = v;
    }
  }
  return flags;
}

/**
 * Compute the advantage/disadvantage stance for one attack given
 * attacker and target conditions plus optional cover-style modifiers
 * the host already computed. Returns one of `'normal'`,
 * `'advantage'`, `'disadvantage'`. Per 5e rules, advantage and
 * disadvantage cancel — they don't stack.
 *
 * `prone` distance: if the target is prone and the attacker is
 * within 5 ft, advantage; further away (ranged) → disadvantage.
 */
export function attackStance({ attacker = {}, target = {}, attackerDistanceFt = 0 }) {
  const a = effectsFor(attacker);
  const t = effectsFor(target);
  let adv = false;
  let dis = false;

  // Attacker side.
  if (a.ownAttackDisadvantage) dis = true;
  if (a.ownAttackAdvantage) adv = true;

  // Target side.
  if (t.targetAdvantage) adv = true;
  if (t.targetDisadvantage) dis = true;

  // Prone is distance-sensitive.
  if (t.proneOnTarget) {
    if (attackerDistanceFt <= 5) adv = true;
    else dis = true;
  }

  // SRD § Combat — Dodge (since 1.7.0): attacks against a dodging
  // target have disadvantage. Read directly off the target record —
  // `dodging` is set by `Encounter.dodge`.
  if (target.dodging === true) dis = true;

  if (adv && dis) return 'normal';
  if (adv) return 'advantage';
  if (dis) return 'disadvantage';
  return 'normal';
}

/**
 * Tolerates actors that have never been touched (no `conditions`
 * array yet) so callers don't have to initialise an empty array on
 * every actor — predicate-style checks should be safe to call on a
 * bare actor record.
 * Accepts both string entries (legacy) and record entries (v1.6.1+).
 */
export function has(actor, condition) {
  if (!Array.isArray(actor.conditions)) return false;
  return actor.conditions.some(e => nameOf(e) === condition);
}

/**
 * Immutable: returns a new actor record. The engine's whole story
 * is pure functions over plain data — mutating in place would break
 * Spektrum's history replay and `attempt()` rollback semantics on
 * the app side.
 *
 * Throws on unknown conditions because the vocabulary is closed; a
 * typo'd "blided" would silently work and produce a phantom state
 * no later code knows how to clear.
 *
 * `allowedConditions` defaults to the SRD 5.2 vocabulary. The engine
 * factory passes a merged list when plugins contribute custom
 * conditions (e.g. `'cursed'`, `'marked'`) so the same gate works
 * for homebrew without forking this function.
 */
export function apply(actor, condition, allowedConditions = CONDITIONS) {
  // Accept both string ('poisoned') and record ({ name: 'poisoned', dc: 11, ... }).
  const name = typeof condition === 'string' ? condition : condition.name;
  if (!allowedConditions.includes(name)) throw new Error(`Unknown condition: ${name}`);
  // SRD § Monsters — Immunities (since 1.5.0): actors with the
  // condition listed in their `conditionImmunities` are unaffected.
  // We return the unchanged actor rather than throwing so the host
  // chip / UI can render "immune" gracefully without branch logic.
  if ((actor.conditionImmunities ?? []).includes(name)) return actor;

  if (typeof condition === 'string') {
    // String call: set semantics — idempotent, no duplicate entries.
    // Returns the same actor reference when already present so the
    // engine's hook-fire guard (`next === actor`) skips re-firing.
    if ((actor.conditions ?? []).some(e => nameOf(e) === name)) return actor;
    return { ...actor, conditions: [...(actor.conditions ?? []), { name }] };
  }

  // Record call: append semantics — allows multiple applications
  // from different sources (two casters both using Hold Person, etc.).
  const entry = { ...condition, name };
  return { ...actor, conditions: [...(actor.conditions ?? []), entry] };
}

/**
 * Returns `true` when the actor would be immune to the named
 * condition. Useful for hosts that want to surface an "immune to
 * Charmed" affordance in a chip set without first attempting an
 * `apply`. Reads `actor.conditionImmunities` directly.
 */
export function isImmuneTo(actor, condition) {
  return Array.isArray(actor.conditionImmunities) &&
    actor.conditionImmunities.includes(condition);
}

/**
 * Mirror of `apply`. Doesn't throw on a no-op removal because
 * "clear if present" is the common idiom — forcing callers to check
 * first would just push the boilerplate one level out.
 *
 * Removes ALL entries whose name matches, regardless of source — this
 * is the right behaviour for "cure the condition" operations. Accepts
 * both a string name and a record (uses `.name` from the record).
 * Accepts both string entries (legacy) and record entries (v1.6.1+).
 */
export function remove(actor, condition) {
  const name = typeof condition === 'string' ? condition : condition.name;
  const next = (actor.conditions ?? []).filter(e => nameOf(e) !== name);
  return { ...actor, conditions: next };
}

/**
 * Return the condition entries on an actor that require a saving throw
 * at the given `timing` (`'turnEnd'` | `'turnStart'`). Used by the
 * engine's turn-lifecycle bindings to auto-roll saves at each turn
 * boundary.
 *
 * Only entries that carry *both* `saveAbility` and `dc` are returned —
 * entries without those fields were applied without save metadata and
 * cannot be auto-cleared by the engine.
 */
export function conditionsRequiringSave(actor, timing) {
  return (actor.conditions ?? [])
    .map(e => (typeof e === 'string' ? { name: e } : e))
    .filter(e => e.endsOn === timing && e.saveAbility !== undefined && e.dc !== undefined);
}

// SRD 5.2 Exhaustion: cumulative levels 0–6.
//   • Each level imposes −2 on every D20 Test and −5 ft of Speed.
//   • A Long Rest removes one level.
//   • Level 6 is death.
// Modelled as `actor.exhaustion: number` rather than a string in the
// `conditions` array because the level matters for every roll the
// actor makes — folding it into the boolean list would force every
// roll site to dig out the level anyway.

/** Death threshold per SRD 5.2; kept as a named constant so a future
 *  rules update is a one-line change. */
export const EXHAUSTION_MAX = 6;

// Internal tuning constants — same one-line-change rationale.
const D20_PENALTY_PER_LEVEL = 2;
const SPEED_PENALTY_PER_LEVEL = 5;

/**
 * Clamp + coerce to integer. Save files written by older builds may
 * carry junk values; we trust nothing on the way in and saturate at
 * the bounds instead of letting a corrupted 99 produce an immediate
 * "you are dead" on load.
 */
const clampLevel = (n) => Math.max(0, Math.min(EXHAUSTION_MAX, n | 0));

export const exhaustion = {
  /**
   * `?? 0` so a fresh actor (never exhausted) reads as level 0
   * without needing initialisation, and `clampLevel` so a save with
   * a stale level survives a rules tweak.
   */
  level(actor) {
    return clampLevel(actor.exhaustion ?? 0);
  },

  /**
   * Default `amount = 1` because "one level" is overwhelmingly the
   * most common operation — forced marches, magical effects, and
   * curses almost always grant one level at a time.
   */
  gain(actor, amount = 1) {
    return { ...actor, exhaustion: clampLevel(exhaustion.level(actor) + amount) };
  },

  /**
   * Long Rest reduction in SRD 5.2 is one level per rest; same
   * default rationale as `gain`.
   */
  reduce(actor, amount = 1) {
    return { ...actor, exhaustion: clampLevel(exhaustion.level(actor) - amount) };
  },

  /**
   * Absolute setter that bypasses cumulative semantics. Useful for
   * save-load (set to a known persisted level) and for debug /
   * Nerd-mode console operations; the loop should normally prefer
   * `gain` / `reduce` so the deltas show up correctly in history.
   */
  set(actor, level) {
    return { ...actor, exhaustion: clampLevel(level) };
  },

  /**
   * Pre-derived penalty the loop adds to every D20 Test the actor
   * makes. Surfaced as a separate accessor so callers compose it
   * with other modifiers (proficiency, situational) without having
   * to know the per-level constant.
   */
  modifierToD20Tests(actor) {
    return -D20_PENALTY_PER_LEVEL * exhaustion.level(actor);
  },

  /**
   * Returned as a positive subtrahend rather than a negative speed
   * to match how the loop applies it (`baseSpeed - speedPenalty`),
   * matching the "your Speed is reduced by …" wording in the SRD.
   */
  speedPenalty(actor) {
    return SPEED_PENALTY_PER_LEVEL * exhaustion.level(actor);
  },

  /**
   * Convenience predicate so callers don't have to import
   * `EXHAUSTION_MAX` just to compare. Surfacing death as a flag
   * rather than letting callers branch on a magic number keeps
   * death-handling code grep-able.
   */
  isDead(actor) {
    return exhaustion.level(actor) >= EXHAUSTION_MAX;
  }
};
