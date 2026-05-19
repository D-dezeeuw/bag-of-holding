// === Spellcasting mechanics ===
//
// Spell *records* shipped at 0.0.0; spell *mechanics* land here.
// What the engine handles:
//   - Slot tables per casting class, per level.
//   - Slot consumption with refund-on-cancel semantics.
//   - Rest semantics (long rest → all back; short rest → Warlock
//     pact slots).
//   - Concentration (one active spell, CON save on damage, drops
//     when broken or replaced).
//   - Cantrip scaling tier breakpoints (5/11/17).
//   - Preparation lists for the prep-casting classes.
//   - Reaction-cast: the host calls `castReaction(spell, caster)`
//     which fires the `beforeAttack`/`afterDamage` hooks the spell
//     declares; the actual hook plumbing lives in engine.js.
//
// Why a new module: it has its own opinions (slot tables, rest
// semantics) and pulls in nothing else. Folding it into engine.js
// would inflate the factory; folding it into spells.js would mix
// data and mechanics.

// === Slot tables ===
//
// SRD 5.2 full-caster table (Wizard, Cleric, Druid, Bard, Sorcerer).
// `null` cells mean "no slots at this level". Index = caster level,
// inner array index = spell level (1-indexed; index 0 is unused so
// the inner indices line up with spell levels for readability).
//
// We store this as a 2D table rather than a per-class hand-roll
// because every full caster shares it; subclass exceptions (e.g.
// Eldritch Knight's third-caster progression) live on the class def.

/**
 * Slot count for a full caster at `(casterLevel, spellLevel)`.
 * Returns 0 when the caster doesn't have access yet. Throws on
 * out-of-range inputs so a typo'd lookup is loud at the call site.
 */
export function fullCasterSlots(casterLevel, spellLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 9) {
    throw new Error(`spellLevel out of range: ${spellLevel}`);
  }
  return FULL_CASTER_TABLE[casterLevel - 1][spellLevel];
}

// Rows are caster levels 1..20. Inner indices 1..9 are spell
// levels; index 0 is a placeholder so the inner indices line up
// with the spell level being asked for.
const FULL_CASTER_TABLE = [
  /* L1  */ [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  /* L2  */ [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  /* L3  */ [0, 4, 2, 0, 0, 0, 0, 0, 0, 0],
  /* L4  */ [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
  /* L5  */ [0, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  /* L6  */ [0, 4, 3, 3, 0, 0, 0, 0, 0, 0],
  /* L7  */ [0, 4, 3, 3, 1, 0, 0, 0, 0, 0],
  /* L8  */ [0, 4, 3, 3, 2, 0, 0, 0, 0, 0],
  /* L9  */ [0, 4, 3, 3, 3, 1, 0, 0, 0, 0],
  /* L10 */ [0, 4, 3, 3, 3, 2, 0, 0, 0, 0],
  /* L11 */ [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* L12 */ [0, 4, 3, 3, 3, 2, 1, 0, 0, 0],
  /* L13 */ [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* L14 */ [0, 4, 3, 3, 3, 2, 1, 1, 0, 0],
  /* L15 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* L16 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 0],
  /* L17 */ [0, 4, 3, 3, 3, 2, 1, 1, 1, 1],
  /* L18 */ [0, 4, 3, 3, 3, 3, 1, 1, 1, 1],
  /* L19 */ [0, 4, 3, 3, 3, 3, 2, 1, 1, 1],
  /* L20 */ [0, 4, 3, 3, 3, 3, 2, 2, 1, 1]
];

/**
 * Half-caster slot table (Paladin, Ranger). Per SRD 5.2 they cast
 * starting at level 2; below that, returns 0.
 */
export function halfCasterSlots(casterLevel, spellLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  if (!Number.isInteger(spellLevel) || spellLevel < 1 || spellLevel > 5) {
    throw new Error(`spellLevel out of range for half-caster: ${spellLevel}`);
  }
  if (casterLevel < 2) return 0;
  return HALF_CASTER_TABLE[casterLevel - 2][spellLevel];
}

// Rows are caster levels 2..20 (level 1 has no slots).
const HALF_CASTER_TABLE = [
  /* L2  */ [0, 2, 0, 0, 0, 0],
  /* L3  */ [0, 3, 0, 0, 0, 0],
  /* L4  */ [0, 3, 0, 0, 0, 0],
  /* L5  */ [0, 4, 2, 0, 0, 0],
  /* L6  */ [0, 4, 2, 0, 0, 0],
  /* L7  */ [0, 4, 3, 0, 0, 0],
  /* L8  */ [0, 4, 3, 0, 0, 0],
  /* L9  */ [0, 4, 3, 2, 0, 0],
  /* L10 */ [0, 4, 3, 2, 0, 0],
  /* L11 */ [0, 4, 3, 3, 0, 0],
  /* L12 */ [0, 4, 3, 3, 0, 0],
  /* L13 */ [0, 4, 3, 3, 1, 0],
  /* L14 */ [0, 4, 3, 3, 1, 0],
  /* L15 */ [0, 4, 3, 3, 2, 0],
  /* L16 */ [0, 4, 3, 3, 2, 0],
  /* L17 */ [0, 4, 3, 3, 3, 1],
  /* L18 */ [0, 4, 3, 3, 3, 1],
  /* L19 */ [0, 4, 3, 3, 3, 2],
  /* L20 */ [0, 4, 3, 3, 3, 2]
];

/**
 * Warlock Pact Magic slots — small count, but they refresh on a
 * short rest and are always cast at a fixed level keyed to caster
 * level. Returns `{ count, level }` so the host can drive the slot
 * bar without a separate mechanism.
 */
export function warlockPactSlots(casterLevel) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1 || casterLevel > 20) {
    throw new Error(`casterLevel out of range: ${casterLevel}`);
  }
  const table = [
    /*  L1 */ { count: 1, level: 1 },
    /*  L2 */ { count: 2, level: 1 },
    /*  L3 */ { count: 2, level: 2 },
    /*  L4 */ { count: 2, level: 2 },
    /*  L5 */ { count: 2, level: 3 },
    /*  L6 */ { count: 2, level: 3 },
    /*  L7 */ { count: 2, level: 4 },
    /*  L8 */ { count: 2, level: 4 },
    /*  L9 */ { count: 2, level: 5 },
    /* L10 */ { count: 2, level: 5 },
    /* L11 */ { count: 3, level: 5 },
    /* L12 */ { count: 3, level: 5 },
    /* L13 */ { count: 3, level: 5 },
    /* L14 */ { count: 3, level: 5 },
    /* L15 */ { count: 3, level: 5 },
    /* L16 */ { count: 3, level: 5 },
    /* L17 */ { count: 4, level: 5 },
    /* L18 */ { count: 4, level: 5 },
    /* L19 */ { count: 4, level: 5 },
    /* L20 */ { count: 4, level: 5 }
  ];
  return table[casterLevel - 1];
}

// === Slot management ===
//
// Slot state is per-actor and lives in the host's character record
// (under `record.spells.slots`). The functions below are pure: take
// a slot array, return a new one.

/**
 * Build a fresh slot array for a class + level. The result is the
 * starting state for a new character or a long-rested one — every
 * slot at full capacity.
 *
 * `progression`:
 *   - `'full'`   → uses fullCasterSlots
 *   - `'half'`   → uses halfCasterSlots
 *   - `'warlock'` → pact slots
 *   - `'none'`   → returns empty array (Fighter, Rogue, etc.)
 */
export function freshSlots(progression, casterLevel) {
  if (progression === 'none') return [];
  const out = [];
  if (progression === 'warlock') {
    const { count, level } = warlockPactSlots(casterLevel);
    out.push({ level, used: 0, max: count, source: 'pact' });
    return out;
  }
  const slotFn = progression === 'full' ? fullCasterSlots : halfCasterSlots;
  const maxLevel = progression === 'full' ? 9 : 5;
  for (let spellLevel = 1; spellLevel <= maxLevel; spellLevel++) {
    const max = slotFn(casterLevel, spellLevel);
    if (max > 0) out.push({ level: spellLevel, used: 0, max });
  }
  return out;
}

/**
 * Consume one slot of `level`. Auto-upcasts: if the requested level
 * has no slots left, consumes the next-higher slot that does. SRD
 * cantrips don't consume slots — the host should special-case
 * `spell.level === 0` and skip this call.
 *
 * Returns `{ ok: true, slots, levelCast }` on success — `levelCast`
 * may be higher than `level` if the engine upcast — or
 * `{ ok: false, reason }` if no slot is available.
 */
export function consumeSlot(slots, level) {
  if (!Array.isArray(slots)) throw new Error('slots must be an array');
  if (!Number.isInteger(level) || level < 1) {
    throw new Error('level must be a positive integer');
  }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.level >= level && s.used < s.max) {
      const next = slots.slice();
      next[i] = { ...s, used: s.used + 1 };
      return { ok: true, slots: next, levelCast: s.level };
    }
  }
  return { ok: false, reason: `no slot of level ${level}+ available` };
}

/**
 * Refund a slot. Used by the host when a spell is interrupted
 * before resolution (Counterspell, target dies mid-cast). Idempotent:
 * if `used` is already 0, returns the slots unchanged.
 */
export function refundSlot(slots, level) {
  const i = slots.findIndex((s) => s.level === level);
  if (i === -1) return slots;
  if (slots[i].used === 0) return slots;
  const next = slots.slice();
  next[i] = { ...slots[i], used: slots[i].used - 1 };
  return next;
}

/**
 * Long rest: every slot refills, including Warlock pact slots
 * (technically Warlock refreshes on short rest too — this is the
 * conservative "long rest refreshes everything" behaviour). Returns
 * a new array.
 */
export function longRest(slots) {
  return slots.map((s) => ({ ...s, used: 0 }));
}

/**
 * Short rest: refreshes only `source: 'pact'` slots (Warlock).
 * Other slots are untouched.
 */
export function shortRest(slots) {
  return slots.map((s) => s.source === 'pact' ? { ...s, used: 0 } : s);
}

// === Concentration ===
//
// One concentration spell at a time per caster. Damage triggers a
// CON save (DC = max(10, floor(damage/2))). The state is a small
// `{ spellId, level }` object stored on the actor; we expose
// pure helpers that compute the new state.

/**
 * Set the caster's concentration to a new spell. If they were
 * already concentrating on something, the previous one is dropped.
 * Returns `{ actor, dropped }` so the host can fire whatever side-
 * effects "the previous spell ends" requires.
 */
export function startConcentration(actor, { spellId, level }) {
  const previous = actor.concentration ?? null;
  return {
    actor: { ...actor, concentration: { spellId, level } },
    dropped: previous
  };
}

/**
 * The DC for a CON save when concentration takes damage. SRD: max
 * of 10 and half the damage taken (round down).
 */
export function concentrationSaveDC(damageTaken) {
  if (!Number.isFinite(damageTaken) || damageTaken < 0) {
    throw new Error('damageTaken must be a non-negative number');
  }
  return Math.max(10, Math.floor(damageTaken / 2));
}

/**
 * Drop concentration unconditionally (incapacitated, dead,
 * deliberate release). Returns the new actor.
 */
export function endConcentration(actor) {
  if (!actor.concentration) return actor;
  const { concentration: _, ...rest } = actor;
  return rest;
}

// === Cantrip scaling ===
//
// SRD 5.2 cantrip damage scales at levels 5, 11, and 17 — extra
// damage dice match the breakpoint tier. Spell records carry their
// base damage spec (e.g. `1d10` for Fire Bolt); the scaling
// function returns the spec at a given level.
//
// `scaledDamageSpec` parses the base, multiplies the count by the
// tier multiplier, and re-serialises. Falls back to the original
// when the spec doesn't match `XdY` form.

const DICE_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;

export function cantripTier(casterLevel) {
  if (casterLevel >= 17) return 4;
  if (casterLevel >= 11) return 3;
  if (casterLevel >= 5) return 2;
  return 1;
}

export function scaledDamageSpec(baseSpec, casterLevel) {
  const m = DICE_PATTERN.exec(String(baseSpec).trim());
  if (!m) return baseSpec;
  const tier = cantripTier(casterLevel);
  const count = Number(m[1]) * tier;
  const modifier = m[3] ?? '';
  return `${count}d${m[2]}${modifier}`;
}

// === Preparation lists ===
//
// Prep-casting classes (Cleric, Druid, Paladin, Ranger, Wizard)
// know a list and prepare a subset each day. The prepared subset
// limits how many of the known list can actually be cast without
// re-prep. We model "valid prep list?" — the host owns the
// transition.

/** How many spells a class prepares per day at a given level.
 *  SRD 5.2: spellcasting ability mod + level (or half-level for
 *  half-casters). Defaults to `ability mod + level`. */
export function preparedSpellCount({ casterLevel, abilityMod, progression = 'full' }) {
  if (!Number.isInteger(casterLevel) || casterLevel < 1) {
    throw new Error('casterLevel must be a positive integer');
  }
  if (!Number.isInteger(abilityMod)) {
    throw new Error('abilityMod must be an integer');
  }
  const levelPortion = progression === 'half'
    ? Math.floor(casterLevel / 2)
    : casterLevel;
  return Math.max(1, abilityMod + levelPortion);
}

/**
 * Check that a prepared list is a subset of the known list, within
 * the prep-count budget. Returns `{ valid, reason? }`.
 *
 * Why an explicit validator: hosts will be tempted to mutate the
 * record's `spells.prepared` directly; surfacing the budget here
 * lets a UI show "5 / 7 prepared" without each consumer reimplementing
 * the math.
 */
export function validatePreparation({ known, prepared, casterLevel, abilityMod, progression }) {
  if (!Array.isArray(known) || !Array.isArray(prepared)) {
    return { valid: false, reason: 'known and prepared must be arrays' };
  }
  const knownSet = new Set(known);
  for (const id of prepared) {
    if (!knownSet.has(id)) return { valid: false, reason: `prepared spell not in known list: ${id}` };
  }
  const max = preparedSpellCount({ casterLevel, abilityMod, progression });
  if (prepared.length > max) {
    return { valid: false, reason: `prepared count ${prepared.length} exceeds budget ${max}` };
  }
  return { valid: true };
}
