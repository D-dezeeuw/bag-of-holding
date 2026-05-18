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

/**
 * Tolerates actors that have never been touched (no `conditions`
 * array yet) so callers don't have to initialise an empty array on
 * every actor — predicate-style checks should be safe to call on a
 * bare actor record.
 */
export function has(actor, condition) {
  return Array.isArray(actor.conditions) && actor.conditions.includes(condition);
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
  if (!allowedConditions.includes(condition)) throw new Error(`Unknown condition: ${condition}`);
  const current = new Set(actor.conditions ?? []);
  current.add(condition);
  return { ...actor, conditions: [...current] };
}

/**
 * Mirror of `apply`. Doesn't throw on a no-op removal because
 * "clear if present" is the common idiom — forcing callers to check
 * first would just push the boilerplate one level out.
 */
export function remove(actor, condition) {
  const current = new Set(actor.conditions ?? []);
  current.delete(condition);
  return { ...actor, conditions: [...current] };
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
