import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITION_EFFECTS, effectsFor, attackStance
} from '../src/conditions.js';
import { attackRoll } from '../src/combat.js';
import { legal } from '../src/movesets.js';
import { seededRng } from '../src/dice.js';

// === CONDITION_EFFECTS table

test('CONDITION_EFFECTS is the frozen canonical map', () => {
  assert.throws(() => { CONDITION_EFFECTS.blinded.foo = true; });
});

test('paralyzed flags incapacitates, speedZero, autoFailStrDexSaves, targetAdvantage, critIfWithin5', () => {
  const p = CONDITION_EFFECTS.paralyzed;
  assert.equal(p.incapacitates, true);
  assert.equal(p.speedZero, true);
  assert.equal(p.autoFailStrDexSaves, true);
  assert.equal(p.targetAdvantage, true);
  assert.equal(p.critIfAttackerWithin5, true);
});

test('blinded gives ownAttackDisadvantage and targetAdvantage', () => {
  assert.equal(CONDITION_EFFECTS.blinded.ownAttackDisadvantage, true);
  assert.equal(CONDITION_EFFECTS.blinded.targetAdvantage, true);
});

test('restrained flags speedZero, targetAdvantage, ownAttackDisadvantage', () => {
  const r = CONDITION_EFFECTS.restrained;
  assert.equal(r.speedZero, true);
  assert.equal(r.targetAdvantage, true);
  assert.equal(r.ownAttackDisadvantage, true);
});

// === effectsFor union

test('effectsFor ORs flags across multiple conditions', () => {
  const flags = effectsFor({ conditions: ['paralyzed', 'restrained'] });
  assert.equal(flags.speedZero, true);
  assert.equal(flags.autoFailStrDexSaves, true);
  assert.equal(flags.targetAdvantage, true);
  assert.equal(flags.ownAttackDisadvantage, true);
});

test('effectsFor on a fresh actor returns empty flags', () => {
  const flags = effectsFor({});
  assert.deepEqual(flags, {});
});

test('effectsFor skips unknown conditions', () => {
  const flags = effectsFor({ conditions: ['blinded', 'not-a-real-condition'] });
  assert.equal(flags.cantSee, true);
});

test('effectsFor propagates non-boolean values (petrified resistance)', () => {
  const flags = effectsFor({ conditions: ['petrified'] });
  assert.equal(flags.resistance, 'all');
});

// === attackStance dispatch

test('attackStance returns normal when no conditions are set', () => {
  assert.equal(attackStance({ attacker: {}, target: {} }), 'normal');
});

test('attackStance gives advantage when target is paralyzed', () => {
  assert.equal(
    attackStance({ attacker: {}, target: { conditions: ['paralyzed'] } }),
    'advantage'
  );
});

test('attackStance gives disadvantage when attacker is blinded', () => {
  assert.equal(
    attackStance({ attacker: { conditions: ['blinded'] }, target: {} }),
    'disadvantage'
  );
});

test('attackStance: prone target — advantage when within 5 ft, disadvantage otherwise', () => {
  const t = { conditions: ['prone'] };
  assert.equal(attackStance({ attacker: {}, target: t, attackerDistanceFt: 5 }), 'advantage');
  assert.equal(attackStance({ attacker: {}, target: t, attackerDistanceFt: 30 }), 'disadvantage');
});

test('attackStance: advantage and disadvantage cancel to normal', () => {
  const r = attackStance({
    attacker: { conditions: ['blinded'] },     // ownAttackDisadvantage
    target: { conditions: ['paralyzed'] }      // targetAdvantage
  });
  assert.equal(r, 'normal');
});

test('attackStance: invisible attacker has advantage', () => {
  const r = attackStance({
    attacker: { conditions: ['invisible'] },
    target: {}
  });
  assert.equal(r, 'advantage');
});

test('attackStance: invisible target has disadvantage attacking it', () => {
  const r = attackStance({
    attacker: {},
    target: { conditions: ['invisible'] }
  });
  assert.equal(r, 'disadvantage');
});

// === attackRoll integration

test('attackRoll without conditions has stance "normal"', () => {
  const r = attackRoll({ attackBonus: 0, ac: 10 }, seededRng(1));
  assert.equal(r.stance, 'normal');
});

test('attackRoll with paralyzed target picks the higher of two d20s (advantage)', () => {
  // We can verify by running with the same seed and confirming the
  // stance is 'advantage' and the d20 is at least as high as the
  // normal-roll d20. With two rolls, advantage takes max — so the
  // result is >= the seed's first d20.
  const normal = attackRoll({ attackBonus: 0, ac: 10 }, seededRng(7));
  const adv = attackRoll({
    attackBonus: 0, ac: 10,
    target: { conditions: ['paralyzed'] }
  }, seededRng(7));
  assert.equal(adv.stance, 'advantage');
  // adv takes max of (normal.d20, second roll); so adv.d20 >= normal.d20.
  assert.ok(adv.d20 >= normal.d20);
});

test('attackRoll with blinded attacker rolls disadvantage', () => {
  const r = attackRoll({
    attackBonus: 0, ac: 10,
    attacker: { conditions: ['blinded'] }
  }, seededRng(9));
  assert.equal(r.stance, 'disadvantage');
});

// === Moveset gating

test('movesets: paralyzed actor sees only a wait chip', () => {
  const out = legal({ pc: { classId: 'fighter', level: 5, conditions: ['paralyzed'] }, scene: { mode: 'combat' } });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'wait');
});

test('movesets: stunned actor sees only a wait chip', () => {
  const out = legal({ pc: { classId: 'wizard', level: 3, conditions: ['stunned'] } });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'wait');
});

test('movesets: prone actor gets "stand up" instead of normal chips', () => {
  const out = legal({ pc: { classId: 'fighter', level: 3, conditions: ['prone'] }, scene: { mode: 'combat' } });
  const ids = out.map(a => a.id);
  assert.ok(ids.includes('stand-up'));
  assert.equal(ids.includes('attack.melee'), false);
});

test('movesets: poisoned actor keeps full chip set (only modifies attacks via stance)', () => {
  const out = legal({ pc: { classId: 'fighter', level: 1, conditions: ['poisoned'] }, scene: { mode: 'combat' } });
  const ids = out.map(a => a.id);
  assert.ok(ids.includes('attack.melee'));
  assert.ok(ids.includes('fighter.second-wind'));
});

test('movesets: multiple incapacitating conditions surface combined in the wait label', () => {
  const out = legal({ pc: { classId: 'fighter', level: 1, conditions: ['paralyzed', 'unconscious'] }, scene: { mode: 'combat' } });
  assert.equal(out.length, 1);
  assert.match(out[0].label, /paralyzed/);
  assert.match(out[0].label, /unconscious/);
});
