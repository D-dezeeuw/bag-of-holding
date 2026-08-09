import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevate, tiersFor, templateForTargetCr, TEMPLATES } from '../src/monster-templates.js';
import { Monsters, SRD } from '../index.js';

// The bestiary stops at CR 15 and not one of its 66 entries carries a
// structured mechanics block, so the monster-mechanics module shipped complete
// and consumed nothing — a "boss" was a normal monster with more hit points.
// Templates derive the missing tiers from verified data rather than inventing
// stat blocks, and give that module something to work with.

const goblin = () => ({
  id: 'goblin', name: 'Goblin', cr: 1, hp: 10, ac: 15,
  attacks: [{ name: 'Scimitar', attackBonus: 4, damage: '1d6+2', damageType: 'slashing' },
            { name: 'Shortbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }],
});

test('elevate raises the tier across offence and defence together', () => {
  const elite = elevate(goblin(), 'elite');
  assert.equal(elite.cr, 5);
  assert.ok(elite.hp > goblin().hp);
  assert.ok(elite.ac > goblin().ac);
  assert.ok(elite.attacks[0].attackBonus > goblin().attacks[0].attackBonus);
});

test('elevate scales damage dice rather than leaving them flat', () => {
  const ancient = elevate(goblin(), 'ancient');
  assert.notEqual(ancient.attacks[0].damage, '1d6+2');
  assert.match(ancient.attacks[0].damage, /^\d+d6(\+\d+)?$/);
});

test('a derived monster never passes itself off as a transcribed SRD entry', () => {
  const elite = elevate(goblin(), 'elite');
  assert.equal(elite.derivedFrom, 'goblin');
  assert.equal(elite.template, 'elite');
  assert.equal(elite.id, 'goblin-elite');
  assert.match(elite.name, /^Elite /);
});

test('derived monsters carry the blocks the mechanics module needs', () => {
  const elite = elevate(goblin(), 'elite');
  const sequence = Monsters.multiattackSequence(elite);
  assert.equal(sequence.length, 2, 'a solo boss must not lose the action economy outright');
  const legendary = Monsters.freshLegendaryState(elite);
  assert.ok(legendary, 'legendary actions were unreachable because no monster declared any');
  assert.equal(legendary.max, 3);
  assert.equal(legendary.used, 0);
});

test('legendary resistance is available to a derived boss', () => {
  const champion = elevate(goblin(), 'champion');
  const state = Monsters.freshLegendaryResistance(champion);
  assert.equal(state.max, TEMPLATES.champion.legendaryResistance);
});

test('every tier is reachable and ordered', () => {
  const tiers = tiersFor(goblin());
  assert.deepEqual(tiers.map(t => t.name), ['elite', 'champion', 'ancient']);
  assert.ok(tiers[2].cr > tiers[1].cr && tiers[1].cr > tiers[0].cr);
});

test('a real SRD monster reaches the CR 16-24 band the bestiary lacked', () => {
  const vampire = SRD.monsters.vampire;
  assert.ok(vampire, 'expected a high-CR SRD entry to build from');
  const ancient = elevate(vampire, 'ancient');
  assert.ok(ancient.cr >= 16 && ancient.cr <= 30, `derived CR ${ancient.cr} should land in the top tier`);
});

test('templateForTargetCr picks the closest tier, or none when close enough', () => {
  assert.equal(templateForTargetCr(goblin(), 2), null, 'no template needed for a near-equal target');
  assert.equal(templateForTargetCr(goblin(), 5), 'elite');
  assert.equal(templateForTargetCr(goblin(), 13), 'ancient');
});

test('elevate refuses malformed input rather than producing a broken monster', () => {
  assert.throws(() => elevate(null), /stat block/);
  assert.throws(() => elevate(goblin(), 'godlike'), /unknown template/);
});

test('a damage expression it cannot parse is left alone', () => {
  const odd = elevate({ ...goblin(), attacks: [{ name: 'Slam', attackBonus: 3, damage: 'special' }] }, 'elite');
  assert.equal(odd.attacks[0].damage, 'special');
});

// The defect this guards against: the template used to emit
// `legendaryActions.actions[]` keyed by name while `useLegendaryAction`
// looks up `legendaryActions.options[].id` — so every derived boss had
// legendary actions it could never use. The test drives the CONSUMER
// against the producer's output, which is the call the old suite
// stopped one step short of.
test('a derived boss can actually USE its legendary actions', () => {
  const champion = elevate(goblin(), 'champion');
  const actor = { legendary: Monsters.freshLegendaryState(champion) };

  const strike = Monsters.useLegendaryAction(actor, champion, 'strike');
  assert.equal(strike.ok, true, `strike refused: ${strike.reason ?? ''}`);
  assert.equal(strike.option.attackRef, champion.attacks[0].name);

  const rally = Monsters.useLegendaryAction(strike.actor, champion, 'rally', 2);
  assert.equal(rally.ok, true, `rally refused: ${rally.reason ?? ''}`);
  assert.equal(rally.actor.legendary.used, 3);

  const exhausted = Monsters.useLegendaryAction(rally.actor, champion, 'move');
  assert.equal(exhausted.ok, false, 'the pool must actually deplete');
});

test('a single-attack base still multiattacks twice, not once', () => {
  const wolf = { id: 'wolf', name: 'Wolf', cr: 1, hp: 11, ac: 13,
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '2d4+2', damageType: 'piercing' }] };
  const elite = elevate(wolf, 'elite');
  const sequence = Monsters.multiattackSequence(elite);
  assert.equal(sequence.length, 2);
  assert.equal(sequence[0].attackRef, 'Bite');
  assert.equal(sequence[1].attackRef, 'Bite');
});
