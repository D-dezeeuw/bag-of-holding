import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legal } from '../src/movesets.js';

const ids = (actions) => actions.map(a => a.id);

test('legal always offers free dialogue and free observation', () => {
  const out = legal({ pc: {}, scene: { mode: 'exploration' } });
  assert.ok(ids(out).includes('talk'));
  assert.ok(ids(out).includes('look'));
});

test('legal adds combat actions when the scene is in combat mode', () => {
  const out = legal({ pc: {}, scene: { mode: 'combat' } });
  const got = ids(out);
  for (const id of ['attack.melee', 'move.disengage', 'move.dash']) {
    assert.ok(got.includes(id), `combat action ${id} missing`);
  }
  assert.equal(got.includes('move'), false, 'free move should not appear in combat');
});

test('legal adds the free move action outside of combat', () => {
  const out = legal({ pc: {}, scene: { mode: 'exploration' } });
  assert.ok(ids(out).includes('move'));
  assert.equal(ids(out).includes('attack.melee'), false);
});

test('legal handles a missing scene by treating it as non-combat', () => {
  const out = legal({ pc: {} });            // no scene field
  assert.ok(ids(out).includes('move'));
  assert.equal(ids(out).includes('attack.melee'), false);
});

test('legal returns chips with the expected shape', () => {
  const out = legal({ pc: {}, scene: { mode: 'combat' } });
  for (const action of out) {
    assert.equal(typeof action.id, 'string');
    assert.equal(typeof action.label, 'string');
    assert.ok(['free', 'action', 'bonus', 'reaction'].includes(action.cost) || action.cost === 'free' || action.cost === 'action');
  }
});
