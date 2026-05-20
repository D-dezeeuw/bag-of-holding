// === 1.30.0 visibility + mounted combat ===

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';
import { attackStance } from '../src/conditions.js';
import { mount, dismount, isMountedOn, legalMountActions, CONTROLLED_MOUNT_ACTIONS } from '../src/mounted-combat.js';

test('attackStance: unseen attacker gives Advantage', () => {
  assert.equal(attackStance({ attacker: { unseen: true }, target: {} }), 'advantage');
});

test('attackStance: unseen target gives Disadvantage', () => {
  assert.equal(attackStance({ attacker: {}, target: { unseen: true } }), 'disadvantage');
});

test('attackStance: both unseen cancel to normal', () => {
  assert.equal(attackStance({ attacker: { unseen: true }, target: { unseen: true } }), 'normal');
});

test('attackStance: unseen attacker + prone target within 5 ft both give Advantage (no cancel)', () => {
  // prone target within 5 ft gives advantage; unseen attacker also advantage; net = advantage
  const r = attackStance({
    attacker: { unseen: true },
    target: { conditions: ['prone'] },
    attackerDistanceFt: 5
  });
  assert.equal(r, 'advantage');
});

test('mount: links rider and mount, default controlled', () => {
  const rider = { id: 'pc', name: 'Pat' };
  const horse = { id: 'horse', name: 'Horse' };
  const { rider: r, mount: m } = mount(rider, horse);
  assert.equal(r.mountedOn, 'horse');
  assert.equal(r.mountControlled, true);
  assert.equal(m.riddenBy, 'pc');
});

test('mount: { controlled: false } leaves an independent mount', () => {
  const { rider } = mount({ id: 'pc' }, { id: 'horse' }, { controlled: false });
  assert.equal(rider.mountControlled, false);
});

test('mount: throws if rider is already mounted', () => {
  assert.throws(() => mount({ id: 'pc', mountedOn: 'horse' }, { id: 'pony' }), /already mounted/);
});

test('mount: throws if mount is already ridden', () => {
  assert.throws(() => mount({ id: 'pc' }, { id: 'horse', riddenBy: 'other' }), /already ridden/);
});

test('mount: throws on non-object rider or mount', () => {
  assert.throws(() => mount(null, {}), /rider must be an actor object/);
  assert.throws(() => mount({}, null), /mount must be an actor object/);
});

test('dismount: clears the linkage on both sides', () => {
  const { rider, mount: m } = mount({ id: 'pc' }, { id: 'horse' });
  const { rider: r2, mount: m2 } = dismount(rider, m);
  assert.equal(r2.mountedOn, undefined);
  assert.equal(r2.mountControlled, undefined);
  assert.equal(m2.riddenBy, undefined);
});

test('dismount: involuntary stamps a flag on the rider', () => {
  const { rider, mount: m } = mount({ id: 'pc' }, { id: 'horse' });
  const { rider: r2 } = dismount(rider, m, { involuntary: true });
  assert.equal(r2.justDismountedInvoluntarily, true);
});

test('dismount: throws when the linkage is missing', () => {
  assert.throws(() => dismount({ id: 'pc' }, { id: 'horse' }), /not mounted/);
});

test('dismount: throws on non-object rider or mount', () => {
  assert.throws(() => dismount(null, {}), /rider must be an actor object/);
  assert.throws(() => dismount({}, null), /mount must be an actor object/);
});

test('isMountedOn: true when linkage matches, false otherwise', () => {
  assert.equal(isMountedOn({ mountedOn: 'horse' }, { id: 'horse' }), true);
  assert.equal(isMountedOn({ mountedOn: 'horse' }, { id: 'pony' }), false);
  assert.equal(isMountedOn({}, { id: 'horse' }), false);
  assert.equal(isMountedOn(null, null), false);
});

test('CONTROLLED_MOUNT_ACTIONS lists Dash/Disengage/Dodge per SRD', () => {
  assert.deepEqual([...CONTROLLED_MOUNT_ACTIONS], ['dash', 'disengage', 'dodge']);
});

test('legalMountActions: controlled mount returns the SRD-restricted list', () => {
  const ridden = { id: 'horse', riddenBy: 'pc', mountControlled: true };
  assert.deepEqual(legalMountActions(ridden), ['dash', 'disengage', 'dodge']);
});

test('legalMountActions: independent mount returns null (unrestricted)', () => {
  assert.equal(legalMountActions({ id: 'horse', riddenBy: 'pc', mountControlled: false }), null);
});

test('legalMountActions: unridden mount returns null', () => {
  assert.equal(legalMountActions({ id: 'horse' }), null);
});

test('legalMountActions: null actor returns null', () => {
  assert.equal(legalMountActions(null), null);
});

test('engine.MountedCombat exposes mount/dismount/isMountedOn', () => {
  const engine = createEngine();
  const { rider, mount: m } = engine.MountedCombat.mount({ id: 'pc' }, { id: 'horse' });
  assert.equal(engine.MountedCombat.isMountedOn(rider, m), true);
});
