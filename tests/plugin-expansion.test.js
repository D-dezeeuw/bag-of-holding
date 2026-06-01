// === 1.22.0 plugin surface expansion ===
//
// extraMechanics, extraResources, extraSenses, extraLightLevels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';

test('extraMechanics grafts a handler onto an existing class', () => {
  const engine = createEngine({
    extraMechanics: {
      fighter: {
        signaturePose: (actor, args) => ({ ok: true, pose: args?.name ?? 'stoic', actor })
      }
    }
  });
  const actor = { classId: 'fighter', level: 5 };
  const r = engine.Mechanics.apply(actor, 'signaturePose', { name: 'gunslinger' });
  assert.equal(r.ok, true);
  assert.equal(r.pose, 'gunslinger');
});

test('extraMechanics does not clobber existing class mechanics', () => {
  const engine = createEngine({
    extraMechanics: {
      fighter: {
        signaturePose: () => ({ ok: true })
      }
    }
  });
  const actor = {
    classId: 'fighter', level: 1,
    resources: { secondWind: { used: 0, max: 1, refreshes: 'short' } },
    hp: 5, hpMax: 30
  };
  // Existing secondWind still resolves.
  const r = engine.Mechanics.apply(actor, 'secondWind');
  assert.equal(r.ok, true);
});

test('extraMechanics rejects unknown classId', () => {
  assert.throws(
    () => createEngine({ extraMechanics: { 'shadow-priest': { spook: () => null } } }),
    /unknown classId/
  );
});

test('extraMechanics rejects non-function handler', () => {
  assert.throws(
    () => createEngine({ extraMechanics: { fighter: { signaturePose: 'not-a-function' } } }),
    /must be a function/
  );
});

test('extraResources grafts a resource spec onto an existing class', () => {
  const engine = createEngine({
    extraResources: {
      fighter: {
        battleFocus: { max: 2, refreshes: 'long' }
      }
    }
  });
  assert.deepEqual(engine.classes.fighter.resources.battleFocus, { max: 2, refreshes: 'long' });
  // Existing resources remain.
  assert.ok(engine.classes.fighter.resources.secondWind);
});

test('extraResources rejects unknown classId', () => {
  assert.throws(
    () => createEngine({ extraResources: { 'shadow-priest': { mana: { refreshes: 'long' } } } }),
    /unknown classId/
  );
});

test('extraResources requires refreshes field', () => {
  assert.throws(
    () => createEngine({ extraResources: { fighter: { glory: { max: 1 } } } }),
    /refreshes/
  );
});

test('engine.senses combines defaults + extras', () => {
  const engine = createEngine({ extraSenses: ['echolocation', 'tremorsense'] });
  assert.deepEqual([...engine.senses], ['darkvision', 'blindsight', 'truesight', 'echolocation', 'tremorsense']);
});

test('engine.lightLevels combines defaults + extras', () => {
  const engine = createEngine({ extraLightLevels: ['magical-darkness'] });
  assert.ok(engine.lightLevels.includes('magical-darkness'));
  assert.ok(engine.lightLevels.includes('bright'));
});

test('default engine exposes the SRD defaults for senses and light levels', () => {
  const engine = createEngine();
  assert.deepEqual([...engine.senses], ['darkvision', 'blindsight', 'truesight']);
  assert.deepEqual([...engine.lightLevels], ['bright', 'dim', 'darkness']);
});

test('senses and lightLevels arrays are frozen', () => {
  const engine = createEngine();
  assert.throws(() => engine.senses.push('xray'));
  assert.throws(() => engine.lightLevels.push('twilight'));
});

test('extraMechanics + extraResources work on a homebrew class that has no defaults', () => {
  const engine = createEngine({
    extraClasses: {
      'shadowdancer': {
        id: 'shadowdancer', name: 'Shadow Dancer', hitDie: 8
      }
    },
    extraMechanics: {
      shadowdancer: {
        vanish: () => ({ vanished: true })
      }
    },
    extraResources: {
      shadowdancer: {
        shadowsteps: { max: 3, refreshes: 'long' }
      }
    }
  });
  const result = engine.Mechanics.apply({ classId: 'shadowdancer' }, 'vanish');
  assert.equal(result.vanished, true);
  assert.equal(engine.classes.shadowdancer.resources.shadowsteps.max, 3);
});

test('empty extraMechanics + extraResources leaves the class registry untouched', () => {
  const engine = createEngine({ extraMechanics: {}, extraResources: {} });
  const defaultEngine = createEngine();
  assert.deepEqual(Object.keys(engine.classes.fighter.mechanics), Object.keys(defaultEngine.classes.fighter.mechanics));
});
