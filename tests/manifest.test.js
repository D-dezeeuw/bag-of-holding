// The plugin manifest format (5.0.0 row). What must hold: a canonical
// manifest validates; every malformed field gets a pointer; the range
// grammar answers correctly at its edges (caret majors, half-open
// windows, exacts); and manifestMatches gives the loader a red/green
// with reasons.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Manifest } from '../index.js';
import {
  MANIFEST_VERSION, MANIFEST_TABLES,
  validateManifest, kernelSatisfies, manifestMatches,
} from '../src/manifest.js';

const CANONICAL = Object.freeze({
  manifestVersion: 1,
  name: '@example/frost-marches',
  version: '1.2.0',
  kernel: '^3.0.0',
  description: 'A winter setting pack.',
  entry: './index.js',
  contributes: { regions: 4, npcs: 9, monsters: 20, spells: 12 },
});

test('a canonical manifest validates; the surface is exported as Manifest', () => {
  assert.deepEqual(validateManifest(CANONICAL), { valid: true, errors: [] });
  assert.equal(Manifest.VERSION, MANIFEST_VERSION);
  assert.equal(Manifest.validate, validateManifest);
  assert.equal(Manifest.matches, manifestMatches);
  // Every declarable table maps to a real engine option name.
  for (const option of Object.values(MANIFEST_TABLES)) {
    assert.match(option, /^(extra[A-Z]|rules$|hooks$)/);
  }
});

test('malformed manifests fail with a pointer per defect', () => {
  const bad = validateManifest({
    manifestVersion: 2,
    name: 'Not A Package Name!',
    version: 'one',
    kernel: 'latest',
    entry: 'index.js',
    contributes: { spellz: 3, monsters: 0 },
  });
  assert.equal(bad.valid, false);
  const text = bad.errors.join('\n');
  assert.match(text, /manifestVersion must be 1/);
  assert.match(text, /npm-shaped package name/);
  assert.match(text, /semver triple/);
  assert.match(text, /kernel must be a range/);
  assert.match(text, /contributes\.spellz: unknown table/);
  assert.match(text, /contributes\.monsters: count must be a positive integer/);
  assert.match(text, /entry must be a relative module path/);
  // Empty contributions are a defect — a pack that adds nothing is not a pack.
  assert.match(validateManifest({ ...CANONICAL, contributes: {} }).errors.join(), /at least one table/);
  assert.equal(validateManifest(null).valid, false);
});

test('the range grammar at its edges', () => {
  // Caret: same major, at least the floor.
  assert.equal(kernelSatisfies('3.5.0', '^3.0.0'), true);
  assert.equal(kernelSatisfies('3.0.0', '^3.0.0'), true);
  assert.equal(kernelSatisfies('4.0.0', '^3.0.0'), false, 'majors are walls');
  assert.equal(kernelSatisfies('2.17.0', '^3.0.0'), false);
  // >= floor, open top.
  assert.equal(kernelSatisfies('4.2.1', '>=2.6.0'), true);
  assert.equal(kernelSatisfies('2.5.9', '>=2.6.0'), false);
  // Half-open window.
  assert.equal(kernelSatisfies('3.4.0', '>=3.0.0 <4.0.0'), true);
  assert.equal(kernelSatisfies('4.0.0', '>=3.0.0 <4.0.0'), false, 'the top is exclusive');
  // Exact.
  assert.equal(kernelSatisfies('3.5.0', '3.5.0'), true);
  assert.equal(kernelSatisfies('3.5.1', '3.5.0'), false);
  // Garbage in, false out — never a throw in the loader path.
  assert.equal(kernelSatisfies('not-a-version', '^3.0.0'), false);
  assert.equal(kernelSatisfies('3.5.0', 'whatever'), false);
});

test('manifestMatches: the loader red/green with reasons', () => {
  assert.deepEqual(manifestMatches(CANONICAL, '3.5.0'), { ok: true, reasons: [] });
  const stale = manifestMatches(CANONICAL, '4.0.0');
  assert.equal(stale.ok, false);
  assert.match(stale.reasons[0], /kernel 4\.0\.0 does not satisfy .*'\^3\.0\.0'/);
  // An invalid manifest reports its defects, not a range verdict.
  const broken = manifestMatches({ ...CANONICAL, version: 'x' }, '3.5.0');
  assert.equal(broken.ok, false);
  assert.match(broken.reasons.join(), /semver triple/);
});
