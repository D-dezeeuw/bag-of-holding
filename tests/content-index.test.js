// Content index (5.1.0 row). What must hold: the index derives a
// VALID manifest for every in-repo setting pack (dogfooding 3.6.0 —
// if a pack and the manifest format drift, this fails); every derived
// manifest matches the current kernel; contribution counts are the
// packs' real table sizes; and the generated page exists in the tree
// and names every pack (the pages build ships it as-is).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { Manifest, SUNDERMARK, BRASSGEAR, HOLLOW_VALE } from '../index.js';
import { buildIndexData, manifestFor } from '../scripts/build-content-index.mjs';

test('every in-repo pack derives a valid, kernel-matching manifest', async () => {
  const entries = await buildIndexData();
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assert.deepEqual(entry.valid.errors, [], `${entry.id} manifest validates`);
    assert.equal(entry.match.ok, true, `${entry.id} mounts on this kernel`);
    assert.equal(entry.settingContract.valid, true, `${entry.id} passes the setting contract`);
  }
});

test('contribution counts are the real table sizes', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const m = manifestFor(SUNDERMARK, pkg.version);
  assert.equal(m.contributes.regions, 6);
  assert.equal(m.contributes.npcs, 12);
  assert.equal(m.contributes.adventures, 2);
  assert.equal(m.contributes.storyHooks, 13);
  assert.equal(m.contributes.species, 1);
  assert.equal(manifestFor(BRASSGEAR, pkg.version).contributes.regions, 5);
  assert.equal(manifestFor(HOLLOW_VALE, pkg.version).contributes.storyHooks, 8);
  // Empty tables are omitted, not zero — a manifest declares what a
  // pack HAS (Hollow Vale ships no species).
  assert.equal(manifestFor(HOLLOW_VALE, pkg.version).contributes.species, undefined);
  // The derived manifest is pinned to the generating kernel's major.
  assert.equal(m.kernel, `^${pkg.version}`);
  assert.equal(Manifest.satisfies(pkg.version, m.kernel), true);
});

test('the generated page is in the tree and names every pack', async () => {
  const html = await readFile(new URL('../examples/plugins.html', import.meta.url), 'utf8');
  for (const pack of [SUNDERMARK, BRASSGEAR, HOLLOW_VALE]) {
    assert.ok(html.includes(pack.name), `${pack.id} is on the page`);
  }
  assert.match(html, /bag-of-holding\.json/);
  assert.match(html, /✓ mounts on this kernel/);
  assert.ok(!html.includes('✗ '), 'no pack is blocked on the shipped page');
});
