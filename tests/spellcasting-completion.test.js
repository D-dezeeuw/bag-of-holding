import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  castSpell, castAsRitual,
  AOE_SHAPES, targetsInArea, castSpellSave
} from '../src/spellcasting.js';
import { createEngine } from '../src/engine.js';

// === Spell record fixtures ===

const fireball = {
  id: 'fireball', name: 'Fireball', level: 3, school: 'evocation',
  components: { v: true, s: true, m: { cost: false, consumed: false } },
  save: 'dex', damage: '8d6',
  aoe: { shape: 'sphere', size: 20 },
  upcast: (level) => ({ extraDice: Math.max(0, level - 3) })
};

const bless = {
  id: 'bless', name: 'Bless', level: 1, school: 'enchantment',
  components: { v: true, s: true, m: { cost: true, consumed: false } },
  concentration: true
};

const findFamiliar = {
  id: 'find-familiar', name: 'Find Familiar', level: 1, school: 'conjuration',
  components: { v: true, s: true, m: { cost: true, consumed: true } },
  ritual: true
};

const fireBolt = { id: 'fire-bolt', name: 'Fire Bolt', level: 0, school: 'evocation' };

// === castSpell — component checks ===

test('castSpell refuses V spell when actor is silenced', () => {
  const actor = { spellSlots: [{ level: 1, used: 0, max: 4 }], silenced: true };
  const result = castSpell(actor, bless);
  assert.equal(result.ok, false);
  assert.match(result.reason, /silenced/);
});

test('castSpell refuses S spell when actor.somaticBlocked', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }], somaticBlocked: true,
    materials: { bless: true }
  };
  const result = castSpell(actor, bless);
  assert.equal(result.ok, false);
  assert.match(result.reason, /free hand/);
});

test('castSpell refuses M-cost spell when material is missing', () => {
  const actor = { spellSlots: [{ level: 1, used: 0, max: 4 }] };
  const result = castSpell(actor, bless);
  assert.equal(result.ok, false);
  assert.match(result.reason, /material component/);
});

test('castSpell accepts spell with components present and material flagged available', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    materials: { bless: true }
  };
  const result = castSpell(actor, bless);
  assert.equal(result.ok, true);
  assert.equal(result.castLevel, 1);
});

test('castSpell on a spell without components declared is permissive', () => {
  // Spell has no components field → no V/S/M gates fire.
  const actor = { spellSlots: [{ level: 1, used: 0, max: 4 }] };
  const result = castSpell(actor, { id: 'x', level: 1 });
  assert.equal(result.ok, true);
});

// === Slot consumption ===

test('castSpell consumes a slot at the spell base level', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    materials: { bless: true }
  };
  const result = castSpell(actor, bless);
  assert.equal(result.actor.spellSlots[0].used, 1);
});

test('castSpell upcasts to a higher slot when slotLevel arg is provided', () => {
  const actor = {
    spellSlots: [
      { level: 3, used: 0, max: 4 },
      { level: 4, used: 0, max: 2 }
    ]
  };
  const result = castSpell(actor, fireball, { slotLevel: 4 });
  assert.equal(result.castLevel, 4);
  assert.deepEqual(result.upcastEffect, { extraDice: 1 });
  assert.equal(result.actor.spellSlots[1].used, 1);
});

test('castSpell refuses slotLevel below the spell base level', () => {
  const actor = { spellSlots: [{ level: 1, used: 0, max: 4 }] };
  const result = castSpell(actor, fireball, { slotLevel: 1 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /below.*base level/);
});

test('castSpell refuses non-positive integer slotLevel', () => {
  const actor = { spellSlots: [{ level: 1, used: 0, max: 4 }] };
  for (const slotLevel of [0, -1, 1.5, 'one']) {
    const result = castSpell(actor, fireball, { slotLevel });
    assert.equal(result.ok, false, `slotLevel=${slotLevel} should refuse`);
  }
});

test('castSpell refuses when actor has no spellSlots', () => {
  const result = castSpell({}, fireball);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no spellSlots/);
});

test('castSpell refuses when the slot pool is empty at the requested level', () => {
  const actor = { spellSlots: [{ level: 3, used: 4, max: 4 }] };
  const result = castSpell(actor, fireball);
  assert.equal(result.ok, false);
});

test('castSpell on a cantrip skips slot consumption entirely', () => {
  // Fire Bolt is level 0; no slot field needed.
  const result = castSpell({}, fireBolt);
  assert.equal(result.ok, true);
  assert.equal(result.actor.spellSlots, undefined);
});

// === One leveled spell per turn ===

test('castSpell refuses a leveled spell when alreadyCastLeveledThisTurn is true', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    materials: { bless: true }
  };
  const result = castSpell(actor, bless, { alreadyCastLeveledThisTurn: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /one leveled spell/);
});

test('castSpell accepts a cantrip when alreadyCastLeveledThisTurn is true (cantrips exempt)', () => {
  const result = castSpell({}, fireBolt, { alreadyCastLeveledThisTurn: true });
  assert.equal(result.ok, true);
});

// === Concentration auto-bind ===

test('castSpell with concentration: true sets actor.concentration', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    materials: { bless: true }
  };
  const result = castSpell(actor, bless);
  assert.equal(result.actor.concentration.spellId, 'bless');
  assert.equal(result.actor.concentration.level, 1);
});

test('castSpell concentration binding uses the cast level (upcast)', () => {
  const actor = {
    spellSlots: [{ level: 3, used: 0, max: 4 }],
    materials: { bless: true }
  };
  const result = castSpell(actor, bless, { slotLevel: 3 });
  assert.equal(result.actor.concentration.level, 3);
});

// === Ritual casting ===

test('castAsRitual refuses a non-ritual spell', () => {
  const actor = { spellsPrepared: ['bless'], materials: { bless: true } };
  const result = castAsRitual(actor, bless);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Ritual tag/);
});

test('castAsRitual refuses when the ritual spell is not prepared', () => {
  const actor = { spellsPrepared: [], materials: { 'find-familiar': true } };
  const result = castAsRitual(actor, findFamiliar);
  assert.equal(result.ok, false);
  assert.match(result.reason, /requires the spell to be prepared/);
});

test('castAsRitual succeeds for a prepared ritual spell without consuming a slot', () => {
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    spellsPrepared: ['find-familiar'],
    materials: { 'find-familiar': true }
  };
  const result = castAsRitual(actor, findFamiliar);
  assert.equal(result.ok, true);
  assert.equal(result.ritual, true);
  assert.equal(result.actor.spellSlots[0].used, 0);    // slot untouched
});

test('castAsRitual with no spellsPrepared field treats as empty list (refuse)', () => {
  // Covers the `Array.isArray ? ... : []` fallback.
  const actor = { materials: { 'find-familiar': true } };
  const result = castAsRitual(actor, findFamiliar);
  assert.equal(result.ok, false);
});

// === AoE targeting ===

test('AOE_SHAPES lists the six SRD shapes', () => {
  assert.deepEqual([...AOE_SHAPES].sort(),
    ['cone', 'cube', 'cylinder', 'emanation', 'line', 'sphere']);
});

test('targetsInArea (sphere) returns candidates within the radius', () => {
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'sphere', size: 20,
    candidates: [
      { id: 'a', position: { x: 5, y: 5 } },
      { id: 'b', position: { x: 25, y: 0 } },
      { id: 'c', position: { x: 15, y: 10 } }
    ]
  });
  assert.deepEqual(result.map(c => c.id), ['a', 'c']);
});

test('targetsInArea (cube) uses max-distance per axis', () => {
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'cube', size: 10,
    candidates: [
      { id: 'in',   position: { x: 5, y: 8 } },     // inside (|x|, |y| <= 10)
      { id: 'edge', position: { x: 10, y: 0 } },    // on edge — inclusive
      { id: 'out',  position: { x: 11, y: 0 } }     // outside
    ]
  });
  assert.deepEqual(result.map(c => c.id), ['in', 'edge']);
});

test('targetsInArea (cylinder) behaves as sphere in 2D', () => {
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'cylinder', size: 15,
    candidates: [
      { id: 'inside', position: { x: 10, y: 5 } },
      { id: 'outside', position: { x: 20, y: 0 } }
    ]
  });
  assert.deepEqual(result.map(c => c.id), ['inside']);
});

test('targetsInArea (emanation) is also distance-based', () => {
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'emanation', size: 10,
    candidates: [{ id: 'close', position: { x: 5, y: 5 } }]
  });
  assert.equal(result.length, 1);
});

test('targetsInArea (cone) requires direction and uses ~26.57° half-angle', () => {
  // Cone facing positive X, length 30. Candidates at various angles.
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'cone', size: 30,
    direction: { x: 1, y: 0 },
    candidates: [
      { id: 'straight', position: { x: 20, y: 0 } },   // dead ahead
      { id: 'edge',     position: { x: 20, y: 8 } },   // ~21° → inside
      { id: 'wide',     position: { x: 20, y: 30 } },  // ~56° → outside
      { id: 'far',      position: { x: 40, y: 0 } }    // out of range
    ]
  });
  assert.deepEqual(result.map(c => c.id).sort(), ['edge', 'straight']);
});

test('targetsInArea (cone) includes the origin point itself', () => {
  const result = targetsInArea({
    origin: { x: 5, y: 5 }, shape: 'cone', size: 30, direction: { x: 1, y: 0 },
    candidates: [{ id: 'self', position: { x: 5, y: 5 } }]
  });
  assert.equal(result.length, 1);
});

test('targetsInArea (line) uses length × width swept along direction', () => {
  const result = targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'line', size: 30,
    direction: { x: 1, y: 0 }, width: 5,
    candidates: [
      { id: 'inLine',     position: { x: 15, y: 2 } },    // along, within width
      { id: 'pastEnd',    position: { x: 35, y: 0 } },    // past length
      { id: 'sideways',   position: { x: 10, y: 10 } },   // off-line
      { id: 'behind',     position: { x: -5, y: 0 } }     // behind origin
    ]
  });
  assert.deepEqual(result.map(c => c.id), ['inLine']);
});

test('targetsInArea (cone/line) refuses zero direction vector', () => {
  assert.throws(() => targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'cone', size: 30,
    direction: { x: 0, y: 0 }, candidates: []
  }));
  assert.throws(() => targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'line', size: 30,
    candidates: []   // direction missing → also refused
  }));
});

test('targetsInArea rejects unknown shape', () => {
  assert.throws(() => targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'blob', size: 10, candidates: []
  }));
});

test('targetsInArea rejects non-array candidates', () => {
  assert.throws(() => targetsInArea({
    origin: { x: 0, y: 0 }, shape: 'sphere', size: 10, candidates: null
  }));
});


// === castSpellSave ===

test('castSpellSave halves on success by default (Evocation pattern)', () => {
  const results = [
    { targetId: 'orc-1', saved: false, damage: 28 },
    { targetId: 'orc-2', saved: true, damage: 28 }
  ];
  const outcomes = castSpellSave(results);
  assert.equal(outcomes[0].appliedDamage, 28);
  assert.equal(outcomes[1].appliedDamage, 14);
});

test('castSpellSave with halfOnSuccess: false zeroes on success', () => {
  const outcomes = castSpellSave(
    [{ targetId: 'x', saved: true, damage: 20 }],
    { halfOnSuccess: false }
  );
  assert.equal(outcomes[0].appliedDamage, 0);
});

test('castSpellSave defaults missing damage to 0', () => {
  const outcomes = castSpellSave([
    { targetId: 'x', saved: false },
    { targetId: 'y', saved: true }
  ]);
  assert.equal(outcomes[0].appliedDamage, 0);
  assert.equal(outcomes[1].appliedDamage, 0);
});

test('castSpellSave rejects non-array input', () => {
  assert.throws(() => castSpellSave('not-an-array'));
});

// === Engine binding: onCast hook ===

test('engine.Spellcasting.castSpell fires onCast and proceeds when not cancelled', () => {
  const payloads = [];
  const engine = createEngine({
    hooks: { onCast: (p) => { payloads.push(p.spell.id); } }
  });
  const actor = { spellSlots: [{ level: 3, used: 0, max: 2 }] };
  const result = engine.Spellcasting.castSpell(actor, fireball);
  assert.equal(result.ok, true);
  assert.deepEqual(payloads, ['fireball']);
});

test('engine.Spellcasting.castSpell can be cancelled by onCast (Counterspell path)', () => {
  const engine = createEngine({
    hooks: { onCast: () => ({ cancelled: true, reason: 'countered' }) }
  });
  const actor = { spellSlots: [{ level: 3, used: 0, max: 2 }] };
  const result = engine.Spellcasting.castSpell(actor, fireball);
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, true);
  assert.match(result.reason, /countered/);
  // Slot not consumed when cast is cancelled.
  assert.equal(actor.spellSlots[0].used, 0);
});

test('engine.Spellcasting.castAsRitual succeeds when onCast does not cancel', () => {
  // Covers two binding branches at once: the args=undefined
  // fallback (`args ?? {}` → `{}`) AND the non-cancel return.
  const seen = [];
  const engine = createEngine({
    hooks: { onCast: (p) => { seen.push(p.args.ritual); } }   // no return = no cancel
  });
  const actor = {
    spellSlots: [{ level: 1, used: 0, max: 4 }],
    spellsPrepared: ['find-familiar'],
    materials: { 'find-familiar': true }
  };
  const result = engine.Spellcasting.castAsRitual(actor, findFamiliar);
  assert.equal(result.ok, true);
  assert.equal(result.ritual, true);
  // Hook observed the forced `ritual: true` argument override.
  assert.deepEqual(seen, [true]);
});

test('engine.Spellcasting.castAsRitual cancellation path with explicit args', () => {
  // Covers the args-provided branch of `args ?? {}` in the binding.
  const engine = createEngine({
    hooks: { onCast: () => ({ cancelled: true }) }
  });
  const result = engine.Spellcasting.castAsRitual(
    {}, findFamiliar, { slotLevel: 1 }
  );
  assert.equal(result.ok, false);
});
