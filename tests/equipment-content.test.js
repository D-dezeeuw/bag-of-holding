// === 1.31.0 content data: mounts, vehicles, trade goods, treasure ===

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../index.js';
import { MOUNTS, VEHICLES, TRADE_GOODS, TREASURE_HOARDS, INDIVIDUAL_TREASURE } from '../src/equipment.js';

test('MOUNTS: SRD canonical entries are present', () => {
  for (const id of ['camel', 'donkey', 'draft-horse', 'elephant', 'mastiff', 'mule', 'pony', 'riding-horse', 'warhorse']) {
    assert.ok(MOUNTS[id], `missing mount ${id}`);
  }
});

test('MOUNTS: each entry carries cost + speed + carryingCapacity', () => {
  for (const id of Object.keys(MOUNTS)) {
    const m = MOUNTS[id];
    assert.equal(typeof m.name, 'string');
    assert.equal(typeof m.cost, 'number');
    assert.equal(typeof m.speed, 'number');
    assert.equal(typeof m.carryingCapacity, 'number');
  }
});

test('MOUNTS: warhorse is faster + carries more than riding horse', () => {
  assert.ok(MOUNTS.warhorse.cost > MOUNTS['riding-horse'].cost);
  assert.equal(MOUNTS.warhorse.speed, 60);
  assert.ok(MOUNTS.warhorse.carryingCapacity > MOUNTS['riding-horse'].carryingCapacity);
});

test('VEHICLES: includes both land and waterborne entries', () => {
  for (const id of ['cart', 'wagon', 'chariot', 'carriage', 'sled']) {
    assert.ok(VEHICLES[id], `missing land vehicle ${id}`);
  }
  for (const id of ['galley', 'longship', 'sailing-ship', 'warship', 'keelboat', 'rowboat']) {
    assert.ok(VEHICLES[id], `missing watercraft ${id}`);
  }
});

test('VEHICLES: tack and saddles are present', () => {
  for (const id of ['bit-bridle', 'saddle-riding', 'saddle-military', 'saddle-pack', 'saddle-exotic', 'saddlebags']) {
    assert.ok(VEHICLES[id], `missing tack ${id}`);
  }
});

test('TRADE_GOODS: SRD price ladder ordering preserved', () => {
  assert.equal(TRADE_GOODS['wheat-1lb'].cost, 0.01);
  assert.equal(TRADE_GOODS['platinum-1lb'].cost, 500);
  assert.equal(TRADE_GOODS['salt-1lb'].cost, 0.05);
});

test('TRADE_GOODS: every entry has name + unit + cost', () => {
  for (const id of Object.keys(TRADE_GOODS)) {
    const g = TRADE_GOODS[id];
    assert.equal(typeof g.name, 'string');
    assert.equal(typeof g.unit, 'string');
    assert.equal(typeof g.cost, 'number');
  }
});

test('TREASURE_HOARDS: bands cover CR 0-4 / 5-10 / 11-16 / 17+', () => {
  for (const band of ['cr-0-4', 'cr-5-10', 'cr-11-16', 'cr-17-plus']) {
    assert.ok(TREASURE_HOARDS[band], `missing hoard band ${band}`);
    assert.equal(typeof TREASURE_HOARDS[band].magicItemTable, 'string');
    assert.equal(typeof TREASURE_HOARDS[band].coins, 'object');
  }
});

test('TREASURE_HOARDS: cr-17-plus produces platinum-tier rewards', () => {
  const top = TREASURE_HOARDS['cr-17-plus'];
  assert.ok(top.coins.pp);
  assert.ok(top.magicItemTable.includes('H') || top.magicItemTable.includes('I'));
});

test('INDIVIDUAL_TREASURE: covers the same CR bands as hoards', () => {
  for (const band of ['cr-0-4', 'cr-5-10', 'cr-11-16', 'cr-17-plus']) {
    assert.ok(INDIVIDUAL_TREASURE[band], `missing individual band ${band}`);
    assert.equal(typeof INDIVIDUAL_TREASURE[band].coins, 'object');
  }
});

test('engine.Equipment exposes the new registries', () => {
  const engine = createEngine();
  assert.ok(engine.Equipment.MOUNTS);
  assert.ok(engine.Equipment.VEHICLES);
  assert.ok(engine.Equipment.TRADE_GOODS);
  assert.ok(engine.Equipment.TREASURE_HOARDS);
  assert.ok(engine.Equipment.INDIVIDUAL_TREASURE);
});
