// Hazards registry back-fill (2.17.0) — the 1.15 row shipped the
// mechanics with starter registries of 2 diseases / 4 poisons; this
// closes the content half. What must hold: SRD disease coverage is
// complete (all three), every poison vector has multiple entries across
// a real DC spread, every record's dice parse and conditions are real,
// and `exposure` resolves each new entry through the engine.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createEngine, Hazards, Conditions, Dice } from '../index.js';
import { POISON_VECTORS } from '../src/hazards.js';

test('the SRD disease registry is complete: all three, sight-rot uncured by rest', () => {
  assert.deepEqual(
    Object.keys(Hazards.DISEASES).sort(),
    ['cackle-fever', 'sewer-plague', 'sight-rot']);
  const rot = Hazards.DISEASES['sight-rot'];
  assert.equal(rot.onsetSave.dc, 15);
  assert.equal(rot.recoveryDc, undefined, 'mundane rest never clears sight rot');
  assert.equal(rot.cure, 'magical-healing-or-eyebright-salve');
  assert.deepEqual(rot.stages[0].onFailure.conditions, ['blinded']);
});

test('twelve poisons: every vector multiply covered, DCs span 10-19', () => {
  const all = Object.values(Hazards.POISONS);
  assert.equal(all.length, 12);
  const byVector = new Map();
  for (const p of all) {
    assert.ok(POISON_VECTORS.includes(p.vector), `${p.id} vector '${p.vector}' is real`);
    byVector.set(p.vector, (byVector.get(p.vector) ?? 0) + 1);
    assert.equal(p.save.ability, 'con', `${p.id} poison saves are CON saves`);
    assert.ok(p.save.dc >= 10 && p.save.dc <= 19, `${p.id} DC in the SRD band`);
    for (const effect of [p.onFailure, p.onSuccess].filter(Boolean)) {
      if (effect.damageDice) assert.ok(Dice.parse(effect.damageDice), `${p.id} dice parse`);
      for (const c of effect.conditions ?? []) {
        assert.ok(Conditions.CONDITIONS.includes(c), `${p.id} condition '${c}' is real`);
      }
    }
  }
  for (const vector of POISON_VECTORS) {
    assert.ok(byVector.get(vector) >= 2, `${vector} has multiple entries (${byVector.get(vector) ?? 0})`);
  }
  // The DC spread reaches both ends of the band.
  const dcs = all.map((p) => p.save.dc);
  assert.equal(Math.min(...dcs), 10);
  assert.equal(Math.max(...dcs), 19);
});

test('exposure resolves every new entry through the engine save machinery', () => {
  const engine = createEngine({ rng: Dice.seededRng(31) });
  const victim = { id: 'pc', abilityScores: { con: 14 } };
  for (const id of ['assassins-blood', 'burnt-othur-fumes', 'crawler-mucus',
    'essence-of-ether', 'midnight-tears', 'purple-worm-poison', 'torpor', 'wyvern-poison']) {
    const result = engine.Hazards.exposure({ actor: victim, hazard: engine.Hazards.POISONS[id] });
    assert.ok(typeof result.save.success === 'boolean', `${id} rolled a save`);
    assert.ok(result.effect !== undefined, `${id} resolved an effect branch`);
  }
  // Same seed, same outcomes — the registry rides the replay contract.
  const twin = createEngine({ rng: Dice.seededRng(31) });
  for (const id of ['assassins-blood', 'burnt-othur-fumes', 'crawler-mucus',
    'essence-of-ether', 'midnight-tears', 'purple-worm-poison', 'torpor', 'wyvern-poison']) {
    twin.Hazards.exposure({ actor: victim, hazard: twin.Hazards.POISONS[id] });
  }
  assert.deepEqual(engine.rollLog, twin.rollLog);
});
