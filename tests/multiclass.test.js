import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTICLASS_PREREQS, CASTER_WEIGHT,
  totalLevel, casterLevel, canMulticlassInto,
  languages, knowsLanguage, tools, isProficientWithTool
} from '../src/multiclass.js';
import { createEngine } from '../src/engine.js';

// === Tables ===

test('MULTICLASS_PREREQS lists prereqs for the 12 base classes', () => {
  for (const id of ['barbarian', 'bard', 'cleric', 'druid', 'fighter',
                    'monk', 'paladin', 'ranger', 'rogue', 'sorcerer',
                    'warlock', 'wizard']) {
    assert.ok(MULTICLASS_PREREQS[id], `missing prereq for ${id}`);
  }
});

test('CASTER_WEIGHT covers full / half casters; Warlock absent (Pact Magic is separate)', () => {
  assert.equal(CASTER_WEIGHT.wizard, 1);
  assert.equal(CASTER_WEIGHT.bard, 1);
  assert.equal(CASTER_WEIGHT.paladin, 0.5);
  assert.equal(CASTER_WEIGHT.ranger, 0.5);
  assert.equal(CASTER_WEIGHT.warlock, undefined);
});

// === totalLevel ===

test('totalLevel: single-class record returns level', () => {
  assert.equal(totalLevel({ classId: 'fighter', level: 5 }), 5);
});

test('totalLevel: multiclass record sums all class levels', () => {
  assert.equal(totalLevel({ classes: { fighter: 3, rogue: 2 } }), 5);
});

test('totalLevel: defaults to 0 when neither shape is present', () => {
  assert.equal(totalLevel({}), 0);
});

// === casterLevel ===

test('casterLevel: full caster counts fully', () => {
  assert.equal(casterLevel({ classId: 'wizard', level: 5 }), 5);
});

test('casterLevel: non-caster classes contribute 0', () => {
  assert.equal(casterLevel({ classId: 'fighter', level: 5 }), 0);
});

test('casterLevel: half casters round down', () => {
  // Paladin 3 → 1.5 → floor 1
  assert.equal(casterLevel({ classId: 'paladin', level: 3 }), 1);
  assert.equal(casterLevel({ classId: 'ranger', level: 5 }), 2);   // 2.5 → 2
});

test('casterLevel: multiclass sums weighted contributions', () => {
  // Wizard 3 (full) + Paladin 4 (half=2) → 5
  assert.equal(
    casterLevel({ classes: { wizard: 3, paladin: 4 } }),
    5
  );
});

test('casterLevel: Warlock contributes 0 (Pact Magic separate)', () => {
  assert.equal(
    casterLevel({ classes: { warlock: 5, sorcerer: 3 } }),
    3
  );
});

test('casterLevel: accepts a custom weights map (e.g. Eldritch Knight)', () => {
  const weights = { ...CASTER_WEIGHT, 'eldritch-knight': 1 / 3 };
  // EK 9 → 3 (floor 9/3)
  assert.equal(
    casterLevel({ classes: { 'eldritch-knight': 9 } }, weights),
    3
  );
});

// === canMulticlassInto ===

test('canMulticlassInto: accepts when both old and new prereqs are met', () => {
  const record = {
    classId: 'fighter',
    abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 10, cha: 16 }
  };
  const result = canMulticlassInto(record, 'paladin');
  assert.equal(result.ok, true);
});

test('canMulticlassInto: refuses when new class prereq fails', () => {
  // Fighter (STR 16, CHA 8) wants to multiclass to Paladin (needs STR 13 + CHA 13).
  const record = {
    classId: 'fighter',
    abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 10, cha: 8 }
  };
  const result = canMulticlassInto(record, 'paladin');
  assert.equal(result.ok, false);
  assert.match(result.reason, /CHA 13/);
});

test('canMulticlassInto: refuses when current class prereq is unmet', () => {
  // Hypothetical "warlock with no CHA" tries to multiclass to wizard.
  const record = {
    classId: 'warlock',
    abilityScores: { cha: 10, int: 16 }     // CHA below Warlock's 13
  };
  const result = canMulticlassInto(record, 'wizard');
  assert.equal(result.ok, false);
});

test('canMulticlassInto: Fighter requireAny (STR or DEX) accepts either', () => {
  const dexBuild = {
    classId: 'rogue',
    abilityScores: { str: 10, dex: 18 }
  };
  const result = canMulticlassInto(dexBuild, 'fighter');
  assert.equal(result.ok, true);
});

test('canMulticlassInto: Fighter requireAny refuses when neither STR nor DEX qualifies', () => {
  // Wizard with INT focus, no STR or DEX above 13 → can't multiclass
  // into Fighter (needs STR 13 OR DEX 13).
  const record = {
    classId: 'wizard',
    abilityScores: { str: 8, dex: 12, int: 18 }
  };
  const result = canMulticlassInto(record, 'fighter');
  assert.equal(result.ok, false);
  assert.match(result.reason, /STR or DEX 13/);
});

test('canMulticlassInto: refuses on unknown new class', () => {
  const result = canMulticlassInto({ classId: 'fighter' }, 'planeswalker');
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown class/);
});

test('canMulticlassInto: refuses when newClassId is missing', () => {
  assert.equal(canMulticlassInto({ classId: 'fighter' }).ok, false);
});

test('canMulticlassInto: works on a multiclass record (enforces every existing class)', () => {
  // Already Fighter 3 / Rogue 2 (both met). Trying to add Wizard (needs INT 13). INT 8 → refused.
  const record = {
    classes: { fighter: 3, rogue: 2 },
    abilityScores: { str: 16, dex: 16, int: 8 }
  };
  const result = canMulticlassInto(record, 'wizard');
  assert.equal(result.ok, false);
  assert.match(result.reason, /INT 13/);
});

test('canMulticlassInto: tolerates a record with neither classId nor classes', () => {
  // New character with no class yet — only the new-class prereq matters.
  const record = { abilityScores: { int: 16 } };
  const result = canMulticlassInto(record, 'wizard');
  assert.equal(result.ok, true);
});

test('canMulticlassInto: defaults missing ability scores to 10', () => {
  // Score not declared → defaults to 10 → fails a 13+ prereq.
  const record = { classId: 'fighter', abilityScores: { str: 16 } };
  const result = canMulticlassInto(record, 'paladin');
  assert.equal(result.ok, false);
});

test('canMulticlassInto: tolerates an actor with no abilityScores field', () => {
  // Covers the `record.abilityScores ?? {}` fallback. Empty scores
  // → every prereq fails (default 10 < 13).
  const result = canMulticlassInto({}, 'wizard');
  assert.equal(result.ok, false);
});

test('canMulticlassInto: requireAny defaults missing alternative to 10', () => {
  // Covers the `scores[ability] ?? 10` fallback when the FIRST
  // alternative iterated by Object.entries is missing (`??` fires)
  // and the second alternative qualifies. Object.entries returns
  // keys in insertion order: { str: 13, dex: 13 } iterates STR first.
  // Omitting STR makes the STR iteration hit `?? 10` (10 < 13);
  // DEX 14 then qualifies.
  const record = { abilityScores: { dex: 14 } };
  const result = canMulticlassInto(record, 'fighter');
  assert.equal(result.ok, true);
});

test('canMulticlassInto: casterLevel of single-class with no level defaults to 0', () => {
  // Covers the `record.level ?? 0` fallback in casterLevel.
  assert.equal(casterLevel({ classId: 'wizard' }), 0);
});

test('canMulticlassInto: skips unknown existing class entries (host-side typo)', () => {
  // Existing-class side: an unknown class is the host's content
  // bug; the picker doesn't refuse the multiclass over it.
  const record = {
    classes: { 'invented-class': 2 },
    abilityScores: { str: 16, dex: 16 }
  };
  const result = canMulticlassInto(record, 'fighter');
  assert.equal(result.ok, true);
});

// === Languages + tools ===

test('languages returns a frozen copy of the actor list', () => {
  const record = { languages: ['Common', 'Elvish'] };
  const list = languages(record);
  assert.deepEqual([...list], ['Common', 'Elvish']);
  assert.throws(() => list.push('Goblin'));
});

test('languages returns an empty frozen list when none declared', () => {
  const list = languages({});
  assert.deepEqual([...list], []);
});

test('knowsLanguage: predicate true for known, false otherwise', () => {
  const record = { languages: ['Common', 'Draconic'] };
  assert.equal(knowsLanguage(record, 'Common'), true);
  assert.equal(knowsLanguage(record, 'Sylvan'), false);
});

test('knowsLanguage: false when the field is absent', () => {
  assert.equal(knowsLanguage({}, 'Common'), false);
});

test('tools returns a frozen copy', () => {
  const list = tools({ tools: ['thieves-tools', 'lyre'] });
  assert.deepEqual([...list], ['thieves-tools', 'lyre']);
});

test('tools returns [] when missing', () => {
  assert.deepEqual([...tools({})], []);
});

test('isProficientWithTool: predicate', () => {
  const record = { tools: ['thieves-tools'] };
  assert.equal(isProficientWithTool(record, 'thieves-tools'), true);
  assert.equal(isProficientWithTool(record, 'lyre'), false);
  assert.equal(isProficientWithTool({}, 'thieves-tools'), false);
});

// === Engine binding ===

test('engine.Multiclass surface is exposed', () => {
  const engine = createEngine();
  assert.equal(typeof engine.Multiclass.totalLevel, 'function');
  assert.equal(
    engine.Multiclass.totalLevel({ classes: { fighter: 3, rogue: 2 } }),
    5
  );
  assert.equal(
    engine.Multiclass.casterLevel({ classes: { wizard: 4, paladin: 2 } }),
    5    // 4 + 1
  );
});
