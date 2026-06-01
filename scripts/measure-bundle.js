#!/usr/bin/env node
// Bundle-size budget gate. Measures the published JS surface
// (index.js + src/**/*.js) by reading each file and summing bytes,
// then computing a single-file "concatenated minified" size estimate
// by stripping comments / whitespace. Reports raw bytes and gzip.
//
// Why not webpack/rollup? Zero deps is the headline; a 60-line script
// that gives a useful upper bound is friendlier than a build step.
// The intent is a *gate*, not a precise bundle. Real-bundler sizes
// will run smaller because tree-shaking drops unused branches.

import { promises as fs } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 1.0 budgets. The pre-1.0 roadmap targeted 25 kB min / 10 kB gz —
// that was set when the engine was four classes + L1–5 + dice + the
// encounter wrapper hadn't shipped. At 1.0 with all 12 classes,
// L1–10 features, encounter system, spellcasting, condition effects,
// monster stat blocks, and full plugin scaffolding, those budgets
// aren't reachable without tree-shaking entry points (deferred —
// see roadmap "post-1.0").
//
// What we *can* hold: the bundle grows linearly with content, not
// quadratically with engineering. The gate ensures a doubling of
// content (a new sourcebook) triggers a deliberate decision rather
// than silent drift. Budget set at ~1.5× current to absorb minor
// patches without re-pinning every commit.
//
// Budget history:
//   1.0.0  — 120 kB min / 30 kB gz (initial)
//   1.5.0  — 160 kB min / 40 kB gz (10 class mechanics, damage
//            pipeline, condition completion)
//   1.18.0 — 175 kB min / 42 kB gz (species effects, hazards module)
//   1.21.0 — 200 kB min / 48 kB gz (tier 3 features, equipment depth,
//            travel module, mechanic adapters)
//   1.27.0 — 280 kB min / 65 kB gz (SRD content expansion: all 16
//            backgrounds, ~30 feats, 104 spells, 102 items, 66 monsters)
const BUDGETS = {
  minBytes: 280 * 1024,    // 280 kB approx-minified
  gzipBytes:  65 * 1024    //  65 kB gzipped
};

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Very lightweight comment/whitespace stripping. Not a real
// minifier — only meant to put us in the ballpark of what a real
// bundler would produce. Aggressive enough to detect a doubling
// of the source size, conservative enough not to break correctness.
function approxMinify(source) {
  return source
    // Block comments (non-greedy).
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Line comments.
    .replace(/^\s*\/\/.*$/gm, '')
    // Trailing line comments.
    .replace(/\s\/\/.*$/gm, '')
    // Collapse whitespace.
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const files = [
    path.join(ROOT, 'index.js'),
    ...await walk(path.join(ROOT, 'src'))
  ];

  let totalRaw = 0;
  let minified = '';
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    totalRaw += source.length;
    minified += approxMinify(source) + '\n';
  }
  const minBytes = Buffer.byteLength(minified, 'utf8');
  const gzipBytes = gzipSync(minified).length;

  const pad = (n) => String(n).padStart(7);
  const kb = (n) => `${(n / 1024).toFixed(2)} kB`;

  console.log(`Files measured     : ${files.length}`);
  console.log(`Raw bytes          : ${pad(totalRaw)}  (${kb(totalRaw)})`);
  console.log(`~Minified bytes    : ${pad(minBytes)}  (${kb(minBytes)})    budget ${kb(BUDGETS.minBytes)}`);
  console.log(`Gzipped (post-min) : ${pad(gzipBytes)}  (${kb(gzipBytes)})    budget ${kb(BUDGETS.gzipBytes)}`);

  let failed = false;
  if (minBytes > BUDGETS.minBytes) {
    console.error(`FAIL: minified ${kb(minBytes)} exceeds budget ${kb(BUDGETS.minBytes)}`);
    failed = true;
  }
  if (gzipBytes > BUDGETS.gzipBytes) {
    console.error(`FAIL: gzipped ${kb(gzipBytes)} exceeds budget ${kb(BUDGETS.gzipBytes)}`);
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('OK: bundle within budget.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
