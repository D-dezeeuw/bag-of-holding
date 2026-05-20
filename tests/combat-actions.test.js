import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dash, disengage, dodge, help, hide, ready, ability,
  grapple, shove, offHandAttack, improvisedAttack,
  startEncounter, opportunityAttack
} from '../src/encounter.js';
import { attackStance } from '../src/conditions.js';
import { createEngine } from '../src/engine.js';

const buildState = () => startEncounter([
  { id: 'pc', dexterity: 14, speed: 30 },
  { id: 'orc', dexterity: 10, speed: 30 }
], () => 0.5);

// === Dash ===

test('dash adds the actor speed to the movement budget', () => {
  const state = buildState();
  const result = dash(state, 'pc');
  assert.equal(result.allowed, true);
  // Base movement = speed (30) + dash bonus (30) = 60.
  assert.equal(result.state.budgets.pc.movement, 60);
});

test('dash spends the action budget', () => {
  const state = buildState();
  const result = dash(state, 'pc');
  assert.equal(result.state.budgets.pc.action, 0);
});

test('dash refuses when no action left', () => {
  let state = buildState();
  ({ state } = dash(state, 'pc'));
  const second = dash(state, 'pc');
  assert.equal(second.allowed, false);
});

test('dash on an unknown actor reports an unknown-actor error', () => {
  const state = buildState();
  const result = dash(state, 'ghost');
  assert.equal(result.allowed, false);
});

test('dash on an actor without a speed entry adds 0 (defensive)', () => {
  const state = buildState();
  // Remove the participant's speed to exercise the `?? 0` fallback.
  const tweaked = {
    ...state,
    order: state.order.map((p) => p.id === 'pc' ? { ...p, speed: undefined } : p),
    budgets: { ...state.budgets, pc: { ...state.budgets.pc, movement: 20 } }
  };
  const result = dash(tweaked, 'pc');
  assert.equal(result.allowed, true);
  assert.equal(result.state.budgets.pc.movement, 20);
});

test('dash on an actor whose budget has no movement field defaults to 0 (defensive)', () => {
  // Covers the `budget.movement ?? 0` fallback.
  const state = buildState();
  const tweaked = {
    ...state,
    budgets: { ...state.budgets, pc: { action: 1, bonus: 1, reaction: 1, movement: undefined } }
  };
  const result = dash(tweaked, 'pc');
  assert.equal(result.allowed, true);
  assert.equal(result.state.budgets.pc.movement, 30);   // 0 + speed
});

// === Disengage ===

test('disengage spends the action and sets actor.disengaged', () => {
  const state = buildState();
  const result = disengage(state, { id: 'pc' });
  assert.equal(result.allowed, true);
  assert.equal(result.actor.disengaged, true);
  assert.equal(result.state.budgets.pc.action, 0);
});

test('disengage flag short-circuits opportunityAttack', () => {
  let state = buildState();
  const opp = opportunityAttack(state, {
    reactorId: 'orc',
    attackerArgs: { attackBonus: 5, ac: 12 },
    disengaged: true
  });
  assert.equal(opp.triggered, false);
  assert.match(opp.reason, /disengaged/);
});

// === Dodge ===

test('dodge sets actor.dodging and spends the action', () => {
  const state = buildState();
  const result = dodge(state, { id: 'pc' });
  assert.equal(result.allowed, true);
  assert.equal(result.actor.dodging, true);
});

test('attackStance gives disadvantage to attacks vs a dodging target', () => {
  const stance = attackStance({
    attacker: {},
    target: { dodging: true },
    attackerDistanceFt: 5
  });
  assert.equal(stance, 'disadvantage');
});

test('attackStance: dodging vs prone-within-5 cancels to normal', () => {
  // Prone gives attackers within 5 ft advantage; dodging gives
  // disadvantage. Advantage + disadvantage → normal.
  const stance = attackStance({
    attacker: {},
    target: { dodging: true, conditions: ['prone'] },
    attackerDistanceFt: 5
  });
  assert.equal(stance, 'normal');
});

// === Help ===

test('help spends the action and binds the target', () => {
  const state = buildState();
  const result = help(state, { id: 'pc' }, { targetId: 'orc' });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.actor.helping, { targetId: 'orc' });
});

test('help refuses without targetId', () => {
  const state = buildState();
  const result = help(state, { id: 'pc' }, {});
  assert.equal(result.allowed, false);
});

// === Hide ===

test('hide spends the action and reports a Stealth check is owed', () => {
  const state = buildState();
  const result = hide(state, { id: 'pc' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.needsStealthCheck, true);
});

// === Ready ===

test('ready spends both action and reaction; stores trigger + action', () => {
  const state = buildState();
  const result = ready(state, { id: 'pc' }, {
    trigger: 'enemy enters range', action: 'attack-with-bow'
  });
  assert.equal(result.allowed, true);
  assert.equal(result.actor.readied.trigger, 'enemy enters range');
  assert.equal(result.actor.readied.action, 'attack-with-bow');
  assert.equal(result.state.budgets.pc.action, 0);
  assert.equal(result.state.budgets.pc.reaction, 0);
});

test('ready refuses without trigger or action', () => {
  const state = buildState();
  for (const args of [
    {},
    { trigger: 'x' },
    { action: 'y' },
    { trigger: '', action: 'y' },
    { trigger: 'x', action: '' }
  ]) {
    const result = ready(state, { id: 'pc' }, args);
    assert.equal(result.allowed, false);
  }
});

test('ready refuses when reaction is already spent', () => {
  let state = buildState();
  // Burn the reaction.
  const opp = opportunityAttack(state, {
    reactorId: 'pc',
    attackerArgs: { attackBonus: 5, ac: 12 }
  });
  state = opp.state;
  const result = ready(state, { id: 'pc' }, { trigger: 'x', action: 'y' });
  assert.equal(result.allowed, false);
});

// === Search / Study / Influence ===

test('ability(search) spends the action and reports a check is owed', () => {
  const state = buildState();
  const result = ability(state, { id: 'pc' }, { kind: 'search' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.needsCheck, true);
  assert.equal(result.result.kind, 'search');
});

test('ability(study) and ability(influence) also work', () => {
  for (const kind of ['study', 'influence']) {
    const state = buildState();
    const result = ability(state, { id: 'pc' }, { kind });
    assert.equal(result.allowed, true);
    assert.equal(result.result.kind, kind);
  }
});

test('ability refuses an unknown kind', () => {
  const state = buildState();
  const result = ability(state, { id: 'pc' }, { kind: 'dance' });
  assert.equal(result.allowed, false);
});

test('disengage / dodge / help / hide / ability refuse when action already spent', () => {
  // Drain the action via dash, then try each downstream verb.
  let state = buildState();
  ({ state } = dash(state, 'pc'));
  for (const [name, call] of [
    ['disengage', () => disengage(state, { id: 'pc' })],
    ['dodge',     () => dodge(state, { id: 'pc' })],
    ['help',      () => help(state, { id: 'pc' }, { targetId: 'orc' })],
    ['hide',      () => hide(state, { id: 'pc' })],
    ['ability',   () => ability(state, { id: 'pc' }, { kind: 'search' })]
  ]) {
    const result = call();
    assert.equal(result.allowed, false, `${name} should refuse without action`);
  }
});

test('ready refuses when the action is already spent (first guard)', () => {
  let state = buildState();
  ({ state } = dash(state, 'pc'));
  const result = ready(state, { id: 'pc' }, {
    trigger: 'enemy enters range', action: 'attack'
  });
  assert.equal(result.allowed, false);
});

test('grapple and shove refuse when the action is already spent', () => {
  let state = buildState();
  ({ state } = dash(state, 'pc'));
  const g = grapple(state, { id: 'pc' }, { targetId: 'orc' });
  assert.equal(g.allowed, false);
  const s = shove(state, { id: 'pc' }, { targetId: 'orc' });
  assert.equal(s.allowed, false);
});

test('shove on an actor without abilityScores or proficiencyBonus uses the L1 defaults', () => {
  // Covers the `?? 10` and `?? 2` fallbacks on a successful path
  // (not the choice-validation refusal). DC = 8 + 0 + 2 = 10.
  const state = buildState();
  const result = shove(state, { id: 'pc' }, { choice: 'push', targetId: 'orc' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.save.dc, 10);
});

// === Grapple ===

test('grapple computes DC = 8 + STR mod + prof, reports save + onFail', () => {
  const state = buildState();
  const actor = {
    id: 'pc', abilityScores: { str: 16 }, proficiencyBonus: 3
  };
  const result = grapple(state, actor, { targetId: 'orc' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.save.dc, 14);     // 8 + 3 + 3
  assert.deepEqual([...result.result.save.abilities].sort(), ['dex', 'str']);
  assert.equal(result.result.onFail.condition, 'grappled');
});

test('grapple defaults STR to 10 (mod 0) and prof to 2', () => {
  const state = buildState();
  const result = grapple(state, { id: 'pc' }, { targetId: 'orc' });
  assert.equal(result.result.save.dc, 10);     // 8 + 0 + 2
});

// === Shove ===

test('shove with choice "prone" reports the prone outcome', () => {
  const state = buildState();
  const actor = { id: 'pc', abilityScores: { str: 14 }, proficiencyBonus: 2 };
  const result = shove(state, actor, { choice: 'prone', targetId: 'orc' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.onFail.condition, 'prone');
  assert.equal(result.result.choice, 'prone');
});

test('shove with choice "push" reports a 5 ft push', () => {
  const state = buildState();
  const actor = { id: 'pc', abilityScores: { str: 14 }, proficiencyBonus: 2 };
  const result = shove(state, actor, { choice: 'push', targetId: 'orc' });
  assert.equal(result.allowed, true);
  assert.equal(result.result.onFail.pushFt, 5);
});

test('shove defaults choice to "prone"', () => {
  const state = buildState();
  const actor = { id: 'pc', abilityScores: { str: 14 }, proficiencyBonus: 2 };
  const result = shove(state, actor, { targetId: 'orc' });
  assert.equal(result.result.choice, 'prone');
});

test('shove refuses unknown choice values', () => {
  const state = buildState();
  const result = shove(state, { id: 'pc' }, { choice: 'kick' });
  assert.equal(result.allowed, false);
});

// === Off-hand attack ===

test('offHandAttack spends a bonus action and flags damage-mod suppression', () => {
  const state = buildState();
  const result = offHandAttack(state, { id: 'pc' }, { weapon: { id: 'dagger' } });
  assert.equal(result.allowed, true);
  assert.equal(result.result.suppressPositiveAbilityMod, true);
  assert.equal(result.state.budgets.pc.bonus, 0);
});

test('offHandAttack refuses without weapon arg', () => {
  const state = buildState();
  const result = offHandAttack(state, { id: 'pc' }, {});
  assert.equal(result.allowed, false);
});

// === Improvised attack ===

test('improvisedAttack default: 1d4 bludgeoning, not proficient', () => {
  const result = improvisedAttack();
  assert.equal(result.damageDice, '1d4');
  assert.equal(result.damageType, 'bludgeoning');
  assert.equal(result.proficient, false);
});

test('improvisedAttack accepts overrides for die / type / proficiency', () => {
  const result = improvisedAttack({ damageDie: 'd6', damageType: 'piercing', proficient: true });
  assert.equal(result.damageDice, '1d6');
  assert.equal(result.damageType, 'piercing');
  assert.equal(result.proficient, true);
});

// === Engine binding ===

test('engine.Combat verbs are exposed', () => {
  const engine = createEngine();
  for (const verb of ['dash', 'disengage', 'dodge', 'help', 'hide',
                      'ready', 'ability', 'grapple', 'shove',
                      'offHandAttack', 'improvisedAttack']) {
    assert.equal(typeof engine.Combat[verb], 'function', `missing ${verb}`);
  }
});

test('engine end-to-end: dodge then attack against the dodger has disadvantage', () => {
  const engine = createEngine({ rng: () => 0.99 });
  let state = engine.Combat.startEncounter([
    { id: 'pc', dexterity: 14, speed: 30 },
    { id: 'orc', dexterity: 10, speed: 30 }
  ]);
  const result = engine.Combat.dodge(state, { id: 'pc' });
  // Now attack the pc with the orc.
  const attack = engine.Combat.attackRoll({
    attackBonus: 5, ac: 14, target: result.actor, attackerDistanceFt: 5
  });
  assert.equal(attack.stance, 'disadvantage');
});
