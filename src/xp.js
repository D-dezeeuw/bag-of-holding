/**
 * The SRD 5.2 XP-to-level table, tier 1 only (levels 1–5). Frozen
 * so a buggy import can't mutate progression for the whole runtime
 * — the engine's MVP scope is explicitly capped at level 5 (see
 * docs/spec.md § Out of scope), so extending this table is the
 * deliberate step into tier 2+, not an accident.
 */
export const THRESHOLDS = Object.freeze({
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500
});

/**
 * Proficiency bonus as a lookup, not a formula, because the SRD
 * table isn't perfectly linear past tier 1 (the +X bumps every
 * four levels in tier 1 but five thereafter). A formula would
 * silently miscompute for tier-2 work later.
 */
export const PROFICIENCY_BY_LEVEL = Object.freeze({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 3 });

/**
 * Linear scan rather than binary search because THRESHOLDS has 5
 * entries; introducing log-n complexity for a 5-element table is
 * the classic premature optimisation. Re-evaluate if level cap
 * ever exceeds tier 1.
 *
 * The optional `thresholds` parameter lets rule-modification plugins
 * substitute a custom progression curve (gritty/heroic packs) without
 * forking this module. Default keeps the SRD 5.2 baseline.
 */
export function levelForXP(xp, thresholds = THRESHOLDS) {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(thresholds)) {
    if (xp >= threshold) level = Number(lvl);
  }
  return level;
}

/**
 * Returns `null` (not `undefined`) at the level cap so the UI can
 * distinguish "max level reached" from "value not yet computed".
 * Callers rendering progression bars rely on this discriminator.
 */
export function nextLevelThreshold(xp, thresholds = THRESHOLDS) {
  const current = levelForXP(xp, thresholds);
  return thresholds[current + 1] ?? null;
}

/**
 * Milestone XP keyed off a beat's `targetPlaytimeMinutes` rather
 * than a fixed "kill XP" budget. The 10-xp-per-minute rate is the
 * tuning constant: a 30-minute beat → 300 xp → exactly the L1→L2
 * threshold under the SRD curve. Treat the multiplier as the dial
 * we'll turn once real playtest data lands.
 *
 * Defaults to 30 minutes when the beat omits the field so that
 * hand-authored beats and older save formats don't crash the loop;
 * 30 is the midpoint of the expected beat length. The `thresholds`
 * parameter is threaded through for the level-up detection.
 */
export function awardMilestone({ pc, beat }, thresholds = THRESHOLDS) {
  const minutes = beat?.targetPlaytimeMinutes ?? 30;
  const xpDelta = Math.round(minutes * 10);
  const newTotal = pc.xp + xpDelta;
  return { xpDelta, newTotal, willLevelUp: levelForXP(newTotal, thresholds) > pc.level };
}
