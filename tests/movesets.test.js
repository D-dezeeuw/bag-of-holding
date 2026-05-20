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

// === Class-aware moveset chips (since 0.6.0) ===

test('Fighter L1 in combat sees Second Wind', () => {
  const out = legal({ pc: { classId: 'fighter', level: 1 }, scene: { mode: 'combat' } });
  assert.ok(ids(out).includes('fighter.second-wind'));
});

test('Fighter L2 in combat adds Action Surge on top of Second Wind', () => {
  const out = legal({ pc: { classId: 'fighter', level: 2 }, scene: { mode: 'combat' } });
  const got = ids(out);
  assert.ok(got.includes('fighter.second-wind'));
  assert.ok(got.includes('fighter.action-surge'));
});

test('Rogue L2 sees Cunning Action chips', () => {
  const out = legal({ pc: { classId: 'rogue', level: 2 }, scene: { mode: 'combat' } });
  const got = ids(out);
  assert.ok(got.includes('rogue.cunning-action.dash'));
  assert.ok(got.includes('rogue.cunning-action.disengage'));
  assert.ok(got.includes('rogue.cunning-action.hide'));
});

test('Rogue L1 does NOT see Cunning Action (gated to L2)', () => {
  const out = legal({ pc: { classId: 'rogue', level: 1 }, scene: { mode: 'combat' } });
  assert.equal(ids(out).includes('rogue.cunning-action.dash'), false);
});

test('Barbarian L1 sees Rage; L2 adds Reckless Attack', () => {
  const l1 = legal({ pc: { classId: 'barbarian', level: 1 }, scene: { mode: 'combat' } });
  assert.ok(ids(l1).includes('barbarian.rage'));
  assert.equal(ids(l1).includes('barbarian.reckless-attack'), false);
  const l2 = legal({ pc: { classId: 'barbarian', level: 2 }, scene: { mode: 'combat' } });
  assert.ok(ids(l2).includes('barbarian.reckless-attack'));
});

test('Bard sees Bardic Inspiration in or out of combat', () => {
  const a = legal({ pc: { classId: 'bard', level: 1 }, scene: { mode: 'combat' } });
  const b = legal({ pc: { classId: 'bard', level: 1 }, scene: { mode: 'exploration' } });
  assert.ok(ids(a).includes('bard.bardic-inspiration'));
  assert.ok(ids(b).includes('bard.bardic-inspiration'));
});

test('Monk L5 has Stunning Strike on top of Martial Arts', () => {
  const out = legal({ pc: { classId: 'monk', level: 5 }, scene: { mode: 'combat' } });
  const got = ids(out);
  assert.ok(got.includes('monk.martial-arts'));
  assert.ok(got.includes('monk.stunning-strike'));
});

test('Paladin L1 sees Lay on Hands; L2 adds Divine Smite in combat', () => {
  const l1 = legal({ pc: { classId: 'paladin', level: 1 }, scene: { mode: 'exploration' } });
  assert.ok(ids(l1).includes('paladin.lay-on-hands'));
  const l2 = legal({ pc: { classId: 'paladin', level: 2 }, scene: { mode: 'combat' } });
  assert.ok(ids(l2).includes('paladin.divine-smite'));
});

test('Druid L2 in combat sees Wild Shape', () => {
  const out = legal({ pc: { classId: 'druid', level: 2 }, scene: { mode: 'combat' } });
  assert.ok(ids(out).includes('druid.wild-shape'));
});

test('Sorcerer L2 sees Font of Magic chip', () => {
  const out = legal({ pc: { classId: 'sorcerer', level: 2 } });
  assert.ok(ids(out).includes('sorcerer.font-of-magic'));
});

test('Warlock L1 in combat sees Eldritch Blast', () => {
  const out = legal({ pc: { classId: 'warlock', level: 1 }, scene: { mode: 'combat' } });
  assert.ok(ids(out).includes('warlock.eldritch-blast'));
});

test('Wizard L1 sees Arcane Recovery', () => {
  const out = legal({ pc: { classId: 'wizard', level: 1 }, scene: { mode: 'exploration' } });
  assert.ok(ids(out).includes('wizard.arcane-recovery'));
});

test('Ranger L1 sees Favored Enemy recall-lore chip', () => {
  const out = legal({ pc: { classId: 'ranger', level: 1 }, scene: { mode: 'exploration' } });
  assert.ok(ids(out).includes('ranger.favored-enemy'));
});

test('Cleric L2 sees Channel Divinity', () => {
  const out = legal({ pc: { classId: 'cleric', level: 2 }, scene: { mode: 'exploration' } });
  assert.ok(ids(out).includes('cleric.channel-divinity'));
});

test('unknown class falls back to base actions only', () => {
  const out = legal({ pc: { classId: 'no-such-class', level: 5 }, scene: { mode: 'combat' } });
  const got = ids(out);
  assert.ok(got.includes('attack.melee'));
  // no class-specific chips
  assert.equal(got.some(id => id.includes('.')), got.some(id => id.startsWith('attack.') || id.startsWith('move.')));
});

test('legal accepts pc without classId (defaults to base)', () => {
  const out = legal({ pc: {}, scene: { mode: 'combat' } });
  assert.ok(ids(out).includes('attack.melee'));
});

test('legal handles a pc with classId but no level (treated as level 0)', () => {
  const out = legal({ pc: { classId: 'wizard' }, scene: { mode: 'exploration' } });
  // No class chips at level 0 — only base actions.
  assert.equal(ids(out).includes('wizard.arcane-recovery'), false);
});

test('combat-only chips are filtered outside combat', () => {
  // Fighter Second Wind is combat-only — should be absent in an
  // exploration scene at the same level.
  const out = legal({ pc: { classId: 'fighter', level: 1 }, scene: { mode: 'exploration' } });
  assert.equal(ids(out).includes('fighter.second-wind'), false);
});
