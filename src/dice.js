// Every roll the engine produces flows through this module, so it's
// the natural place to centralise the RNG contract: `Math.random`
// today, replaceable by a seeded RNG when the app needs deterministic
// replay (see docs/spec.md § Determinism).

const PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;

/**
 * Parse the `XdY±Z` grammar the rest of the engine speaks in. Throws
 * rather than returning null on malformed input because a bad spec is
 * always a bug at the call site — silent fallback would hide it under
 * later "why is damage 0?" mysteries.
 */
export function parse(spec) {
  const m = PATTERN.exec(String(spec).trim());
  if (!m) throw new Error(`Invalid dice spec: ${spec}`);
  return { count: Number(m[1]), sides: Number(m[2]), modifier: m[3] ? Number(m[3]) : 0 };
}

/**
 * Single-die roll, uniform 1..sides. Intentionally non-seedable: the
 * engine commits to a global `Math.random` so app-level seeding (for
 * world-gen, replay, tests) is a single override point at the
 * boundary instead of an RNG argument threading through every call.
 */
export function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

/**
 * Roll a dice expression and return both the individual `rolls` and
 * the modified `total`. Keeping the per-die array around is what lets
 * Nerd mode show "you rolled 4 + 6 + 5 = 15" instead of just the sum
 * — losing the array would force the UI to re-roll for display.
 */
export function roll(spec) {
  const { count, sides, modifier } = parse(spec);
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { spec, rolls, modifier, total };
}

/**
 * Advantage compares whole-expression totals, not individual dice.
 * "3d6+2 with advantage" means roll the entire 3d6+2 twice and keep
 * the better outcome — re-rolling die-by-die would silently misapply
 * the rule for multi-die attacks.
 */
export function rollAdvantage(spec) {
  const a = roll(spec);
  const b = roll(spec);
  return a.total >= b.total ? a : b;
}

/** Symmetric inverse of `rollAdvantage` — same shape, lower wins. */
export function rollDisadvantage(spec) {
  const a = roll(spec);
  const b = roll(spec);
  return a.total <= b.total ? a : b;
}
