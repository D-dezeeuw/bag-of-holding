import { test } from 'node:test';
import assert from 'node:assert/strict';
import druid, {
  wildShapeUsesForLevel,
  wildShapeMaxCR,
  wildShapeKnownForms,
  wildShapeAllowedMovement
} from '../src/classes/druid.js';
import { freshResources, applyMechanic } from '../src/mechanics.js';
import { createEngine } from '../src/engine.js';

const wolf = { id: 'wolf', cr: 0.25, speeds: { walk: 40 } };
const blackBear = { id: 'black-bear', cr: 0.5, speeds: { walk: 40, climb: 30 } };
const giantOctopus = { id: 'giant-octopus', cr: 1, speeds: { walk: 10, swim: 60 } };
const giantEagle = { id: 'giant-eagle', cr: 1, speeds: { walk: 10, fly: 80 } };

// === Tables ===

test('wildShapeUsesForLevel: 0 at L1, 2 from L2 onward', () => {
  assert.equal(wildShapeUsesForLevel(1), 0);
  for (const l of [2, 4, 8, 10]) assert.equal(wildShapeUsesForLevel(l), 2);
});

test('wildShapeMaxCR follows SRD step table', () => {
  assert.equal(wildShapeMaxCR(1), 0);
  for (const l of [2, 3]) assert.equal(wildShapeMaxCR(l), 0.25);
  for (const l of [4, 7]) assert.equal(wildShapeMaxCR(l), 0.5);
  for (const l of [8, 20]) assert.equal(wildShapeMaxCR(l), 1);
});

test('wildShapeKnownForms: 0 / 4 / 6 / 8 at L1 / L2 / L4 / L8', () => {
  assert.equal(wildShapeKnownForms(1), 0);
  assert.equal(wildShapeKnownForms(2), 4);
  assert.equal(wildShapeKnownForms(4), 6);
  assert.equal(wildShapeKnownForms(8), 8);
});

test('wildShapeAllowedMovement: swim from L4, fly from L8', () => {
  assert.deepEqual(wildShapeAllowedMovement(3), { swim: false, fly: false });
  assert.deepEqual(wildShapeAllowedMovement(4), { swim: true, fly: false });
  assert.deepEqual(wildShapeAllowedMovement(8), { swim: true, fly: true });
});

// === Resource provisioning ===

test('Druid L1 omits the wildShape counter', () => {
  const r = freshResources(druid, 1);
  assert.equal(r.wildShape, undefined);
});

test('Druid L2 provisions 2 uses with the short-rest partial refresh', () => {
  const r = freshResources(druid, 2);
  assert.equal(r.wildShape.max, 2);
  assert.equal(r.wildShape.refreshes, 'long');
  assert.equal(r.wildShape.shortRestRecovery, 1);
});

// === wildShape mechanic ===

test('wildShape into a CR 1/4 beast at L2 spends a use and stamps the form', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: freshResources(druid, 2)
  };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  });
  assert.equal(result.ok, true);
  assert.equal(result.actor.wildShape.active, true);
  assert.equal(result.actor.wildShape.beastId, 'wolf');
  assert.equal(result.actor.wildShape.cr, 0.25);
  assert.equal(result.actor.resources.wildShape.used, 1);
});

test('wildShape refuses a CR 1/2 beast at L2 (over the cap)', () => {
  const actor = {
    id: 'pc', level: 2, resources: freshResources(druid, 2)
  };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: blackBear }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /CR 0.5 exceeds your max CR 0.25/);
});

test('wildShape accepts a CR 1/2 beast at L4', () => {
  const actor = { id: 'pc', level: 4, resources: freshResources(druid, 4) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: blackBear }
  });
  assert.equal(result.ok, true);
});

test('wildShape refuses a swimming beast at L2', () => {
  const actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape',
    args: { beast: { id: 'pike', cr: 0.25, speeds: { swim: 40 } } }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /swimming Beast below L4/);
});

test('wildShape refuses a flying beast at L4 (fly locked until L8)', () => {
  const actor = { id: 'pc', level: 4, resources: freshResources(druid, 4) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape',
    args: { beast: { id: 'eagle', cr: 0.25, speeds: { fly: 60 } } }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /flying Beast below L8/);
});

test('wildShape accepts swim at L4 and fly at L8', () => {
  const l4 = { id: 'pc', level: 4, resources: freshResources(druid, 4) };
  const swim = applyMechanic({
    actor: l4, classDef: druid, id: 'wildShape',
    args: { beast: { id: 'crab', cr: 0, speeds: { swim: 30 } } }
  });
  assert.equal(swim.ok, true);

  const l8 = { id: 'pc', level: 8, resources: freshResources(druid, 8) };
  const fly = applyMechanic({
    actor: l8, classDef: druid, id: 'wildShape', args: { beast: giantEagle }
  });
  assert.equal(fly.ok, true);
});

test('wildShape refuses without args.beast', () => {
  const actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  const r1 = applyMechanic({ actor, classDef: druid, id: 'wildShape' });
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /args.beast/);
  const r2 = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: 'wolf' }
  });
  assert.equal(r2.ok, false);
});

test('wildShape refuses when already wild-shaped', () => {
  let actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  ({ actor } = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  }));
  const second = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  });
  assert.equal(second.ok, false);
  assert.match(second.reason, /already wild-shaped/);
});

test('wildShape refuses when no uses remain', () => {
  const actor = {
    id: 'pc', level: 2,
    resources: { wildShape: { used: 2, max: 2, refreshes: 'long', shortRestRecovery: 1 } }
  };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  });
  assert.equal(result.ok, false);
});

test('wildShape defaults beast CR to 0 when omitted on the record', () => {
  // CR-less beast → treated as CR 0, which is always under the cap.
  const actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape',
    args: { beast: { id: 'rat', speeds: { walk: 20 } } }
  });
  assert.equal(result.ok, true);
});

test('wildShape defaults actor.level to 1 (no Wild Shape access)', () => {
  // Covers the `actor.level ?? 1` fallback. With level=1, maxCR=0
  // and any CR > 0 beast is rejected.
  const actor = { id: 'pc', resources: freshResources(druid, 2) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  });
  assert.equal(result.ok, false);
});

test('wildShape tolerates a beast record without a speeds field', () => {
  // No `speeds` → defaults to `{}`, no swim/fly restrictions trigger.
  const actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  const result = applyMechanic({
    actor, classDef: druid, id: 'wildShape',
    args: { beast: { id: 'badger', cr: 0 } }
  });
  assert.equal(result.ok, true);
});

// === revertWildShape ===

test('revertWildShape clears the form', () => {
  let actor = { id: 'pc', level: 2, resources: freshResources(druid, 2) };
  ({ actor } = applyMechanic({
    actor, classDef: druid, id: 'wildShape', args: { beast: wolf }
  }));
  const reverted = applyMechanic({ actor, classDef: druid, id: 'revertWildShape' });
  assert.equal(reverted.ok, true);
  assert.equal(reverted.actor.wildShape, undefined);
});

test('revertWildShape refuses when not wild-shaped', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 2 }, classDef: druid, id: 'revertWildShape'
  });
  assert.equal(result.ok, false);
});

// === wildShapeCaps ===

test('wildShapeCaps reports the level-appropriate caps', () => {
  const result = applyMechanic({
    actor: { id: 'pc', level: 8 }, classDef: druid, id: 'wildShapeCaps'
  });
  assert.equal(result.maxCR, 1);
  assert.equal(result.knownForms, 8);
  assert.deepEqual(result.allowedMovement, { swim: true, fly: true });
});

test('wildShapeCaps defaults level to 1 when missing', () => {
  const result = applyMechanic({
    actor: { id: 'pc' }, classDef: druid, id: 'wildShapeCaps'
  });
  assert.equal(result.maxCR, 0);
  assert.equal(result.knownForms, 0);
});

// === Engine binding ===

test('engine.Mechanics.apply dispatches Wild Shape through the registry', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'druid', level: 4,
    resources: engine.Mechanics.freshResources(engine.classes.druid, 4)
  };
  const result = engine.Mechanics.apply(actor, 'wildShape', { beast: giantOctopus });
  // CR 1 vs L4 cap 1/2 → refused.
  assert.equal(result.ok, false);
  const r2 = engine.Mechanics.apply(actor, 'wildShape', { beast: blackBear });
  assert.equal(r2.ok, true);
});

test('engine end-to-end: wild-shape, revert, short rest, wild-shape again', () => {
  const engine = createEngine();
  let actor = {
    id: 'pc', classId: 'druid', level: 2,
    resources: engine.Mechanics.freshResources(engine.classes.druid, 2)
  };
  ({ actor } = engine.Mechanics.apply(actor, 'wildShape', { beast: wolf }));
  ({ actor } = engine.Mechanics.apply(actor, 'revertWildShape'));
  ({ actor } = engine.Mechanics.apply(actor, 'wildShape', { beast: wolf }));
  assert.equal(actor.resources.wildShape.used, 2);
  ({ actor } = engine.Mechanics.apply(actor, 'revertWildShape'));
  // Both uses spent; short rest recovers one.
  actor = engine.Rest.shortRest(actor);
  assert.equal(actor.resources.wildShape.used, 1);
  const allowed = engine.Mechanics.apply(actor, 'wildShape', { beast: wolf });
  assert.equal(allowed.ok, true);
});
