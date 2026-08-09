import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pkg from '../index.js';
import { Conditions, Spellcasting, createEngine, SRD } from '../index.js';

// This file exists because the package's declarations promised one increment
// more than the code performed: `conditionName`, `conditionsRequiringSave` and
// record-form `apply` lived only in index.d.ts (a merge dropped the
// implementation and the typecheck never compares declarations to src/), and
// the 2.4.0 spell lists shipped as data that `castSpell` never consulted.
// These tests drive the REAL exports, so a declaration can no longer outlive
// its implementation silently.

// === Condition records (v1.6.1 API, restored in 2.5.0) ===

test('record-form apply carries save metadata and appends per source', () => {
  let actor = { id: 'pc' };
  actor = Conditions.apply(actor, { name: 'poisoned', dc: 11, saveAbility: 'con', endsOn: 'turnEnd' });
  actor = Conditions.apply(actor, { name: 'poisoned', dc: 14, saveAbility: 'con', endsOn: 'turnEnd' });
  assert.equal(actor.conditions.length, 2, 'two sources, two entries');
  const due = Conditions.conditionsRequiringSave(actor, 'turnEnd');
  assert.deepEqual(due.map((d) => d.dc), [11, 14]);
  assert.equal(Conditions.conditionsRequiringSave(actor, 'turnStart').length, 0);
});

test('string apply keeps set semantics and the legacy stored shape', () => {
  let actor = { id: 'pc' };
  actor = Conditions.apply(actor, 'prone');
  actor = Conditions.apply(actor, 'prone');
  assert.deepEqual(actor.conditions, ['prone'], 'idempotent, and still a plain string');
});

test('effects, has and remove read mixed string/record lists', () => {
  let actor = { id: 'pc', conditions: ['prone', { name: 'restrained', dc: 12, saveAbility: 'str', endsOn: 'turnEnd' }] };
  const effects = Conditions.effectsFor(actor);
  assert.equal(effects.proneOnTarget, true);
  assert.equal(effects.targetAdvantage, true, 'restrained must contribute through its record form');
  assert.equal(Conditions.has(actor, 'restrained'), true);
  actor = Conditions.remove(actor, { name: 'restrained' });
  assert.equal(Conditions.has(actor, 'restrained'), false);
  assert.equal(Conditions.has(actor, 'prone'), true);
  assert.equal(Conditions.conditionName({ name: 'stunned' }), 'stunned');
  assert.equal(Conditions.conditionName('stunned'), 'stunned');
});

test('the engine-bound namespace exposes the record API too', () => {
  const e = createEngine();
  assert.equal(typeof e.Conditions.conditionName, 'function');
  assert.equal(typeof e.Conditions.conditionsRequiringSave, 'function');
  const a = e.Conditions.apply({ id: 'x' }, { name: 'blinded', dc: 13, saveAbility: 'con', endsOn: 'turnEnd' });
  assert.equal(e.Conditions.conditionsRequiringSave(a, 'turnEnd').length, 1);
});

test('paralyzed still auto-fails DEX saves when applied as a record', () => {
  const e = createEngine();
  const actor = e.Conditions.apply({ id: 'pc', abilityScores: { dex: 14 } },
    { name: 'paralyzed', dc: 13, saveAbility: 'wis', endsOn: 'turnEnd' });
  const save = e.Checks.savingThrow({ actor, ability: 'dex', abilityScore: 14, dc: 10 });
  assert.equal(save.autoFailed, true, 'the record shape must feed the same effect flags');
});

// === Spell lists finally gate casting (2.5.0) ===

const wizard = () => ({
  id: 'wiz', classId: 'wizard',
  spellSlots: [{ level: 1, used: 0, max: 2 }],
  spellsPrepared: ['cure-wounds', 'magic-missile'],
});

test('a wizard cannot cast Cure Wounds', () => {
  const spell = SRD.spells['cure-wounds'];
  assert.ok(spell, 'fixture spell must exist');
  const result = Spellcasting.castSpell(wizard(), spell);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not on the wizard spell list/);
});

test('the same wizard casts Magic Missile fine', () => {
  const spell = SRD.spells['magic-missile'];
  assert.ok(spell, 'fixture spell must exist');
  const result = Spellcasting.castSpell(wizard(), spell);
  assert.equal(result.ok, true, result.reason);
});

test('classless actors and ignoreClassList pass through', () => {
  const spell = SRD.spells['cure-wounds'];
  const monster = { id: 'hag', spellSlots: [{ level: 1, used: 0, max: 1 }] };
  assert.equal(Spellcasting.castSpell(monster, spell).ok, true, 'no classId, no gate');
  const fiat = Spellcasting.castSpell(wizard(), spell, { ignoreClassList: true });
  assert.equal(fiat.ok, true, 'the escape hatch must work');
});

test('a scroll lets a wizard cast an off-list spell — that is what scrolls are for', () => {
  const spell = SRD.spells['cure-wounds'];
  const result = Spellcasting.castFromScroll(
    { ...wizard(), maxCastableLevel: 1, abilityScores: { int: 16 } },
    spell, { ability: 'int' }, () => 0.99);
  assert.equal(result.scrollConsumed, true);
  assert.equal(result.ok, true, result.reason);
});

// === Declarations may not outlive implementations ===

test('every namespace member declared in index.d.ts exists at runtime', () => {
  const dts = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8');
  // Walk the declared interface for each exported namespace we ship as an
  // object, and assert each declared method name is a real function/property.
  const namespaceFor = { ConditionsNamespace: pkg.Conditions };
  for (const [iface, ns] of Object.entries(namespaceFor)) {
    const block = dts.split(`interface ${iface} `)[1]?.split('\n}')[0] ?? '';
    const members = [...block.matchAll(/^\s{2}(?:readonly\s+)?(\w+)[(:<]/gm)].map((m) => m[1]);
    assert.ok(members.length >= 5, `parsed too few members from ${iface} — parser drifted`);
    for (const member of members) {
      assert.ok(member in ns, `${iface}.${member} is declared but missing at runtime`);
    }
  }
});
