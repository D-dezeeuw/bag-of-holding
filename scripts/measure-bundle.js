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
//   2.5.1  — 340 kB min / 80 kB gz (SRD class spell lists, monster tier
//            templates, replay/condition completion)
//   2.8.0  — 480 kB min / 115 kB gz (the content-batch era: The Quiet
//            Stair + Bestiary I landed inside the 2.5.1 pin at 336 kB;
//            Bestiary II breached it at 363 kB, and the roadmap's
//            remaining batches — Bestiary III, both Grimoires, the
//            Treasury, the Origin pack — are all data of the same kind.
//            This pin budgets the whole planned content track at once so
//            each batch is a deliberate line in this table, not a
//            re-pin-per-PR ritual. Post-content code growth should fit
//            WELL inside it; if engine code alone approaches this pin,
//            that is the smell this gate exists to catch. The code-split
//            idea (separate srd/engine entry points) remains the real
//            answer if install size ever matters more than one-file
//            simplicity — see the roadmap's post-SRD ideas.
//
// Note on the 2.5.1 re-pin: the 1.27.0 budget was silently breached at
// 2.4.0 (283.90 kB min) and again at 2.5.0 (286.12 kB) because this gate
// only ran via `prepublishOnly`, and nothing was published between
// 2026-06-01 and 2026-08-11. CI now runs `npm run bundle-size` on every
// push and PR, so the next breach is a red build rather than a surprise
// at `npm publish` time. The growth is SRD *content* — spell lists and
// tier-derived stat blocks — which is what this gate is meant to make
// deliberate, not to forbid.
// 3.1.0: setting packs split out of the kernel budget. `sideEffects:
// false` means a real bundler tree-shakes unmounted setting packs out of
// any app that doesn't import them, so charging Sundermark + Brassgear +
// the Hollow Vale against the kernel budget would eventually force a
// re-pin for bytes almost no consumer ships. The kernel budget therefore
// covers index.js + src minus src/settings/**; settings get their own
// track with its own ceiling, and BOTH are hard gates.
const BUDGETS = {
  minBytes: 480 * 1024,    // 480 kB approx-minified (kernel, sans settings)
  gzipBytes: 115 * 1024    // 115 kB gzipped
};
const SETTINGS_BUDGETS = {
  minBytes: 200 * 1024,    // 200 kB approx-minified across all setting packs
  gzipBytes: 60 * 1024     // 60 kB gzipped
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

async function measure(files) {
  let totalRaw = 0;
  let minified = '';
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    totalRaw += source.length;
    minified += approxMinify(source) + '\n';
  }
  return {
    count: files.length,
    totalRaw,
    minBytes: Buffer.byteLength(minified, 'utf8'),
    gzipBytes: gzipSync(minified).length,
  };
}

async function main() {
  const settingsDir = path.join(ROOT, 'src', 'settings');
  const allSrc = [path.join(ROOT, 'index.js'), ...await walk(path.join(ROOT, 'src'))];
  const isSetting = (f) => f.startsWith(settingsDir + path.sep);
  const kernel = await measure(allSrc.filter((f) => !isSetting(f)));
  const settings = await measure(allSrc.filter(isSetting));

  const pad = (n) => String(n).padStart(7);
  const kb = (n) => `${(n / 1024).toFixed(2)} kB`;

  console.log(`Kernel files       : ${kernel.count}`);
  console.log(`Raw bytes          : ${pad(kernel.totalRaw)}  (${kb(kernel.totalRaw)})`);
  console.log(`~Minified bytes    : ${pad(kernel.minBytes)}  (${kb(kernel.minBytes)})    budget ${kb(BUDGETS.minBytes)}`);
  console.log(`Gzipped (post-min) : ${pad(kernel.gzipBytes)}  (${kb(kernel.gzipBytes)})    budget ${kb(BUDGETS.gzipBytes)}`);
  console.log(`Setting-pack files : ${settings.count}`);
  console.log(`~Minified bytes    : ${pad(settings.minBytes)}  (${kb(settings.minBytes)})    budget ${kb(SETTINGS_BUDGETS.minBytes)}`);
  console.log(`Gzipped (post-min) : ${pad(settings.gzipBytes)}  (${kb(settings.gzipBytes)})    budget ${kb(SETTINGS_BUDGETS.gzipBytes)}`);

  let failed = false;
  if (kernel.minBytes > BUDGETS.minBytes) {
    console.error(`FAIL: kernel minified ${kb(kernel.minBytes)} exceeds budget ${kb(BUDGETS.minBytes)}`);
    failed = true;
  }
  if (kernel.gzipBytes > BUDGETS.gzipBytes) {
    console.error(`FAIL: kernel gzipped ${kb(kernel.gzipBytes)} exceeds budget ${kb(BUDGETS.gzipBytes)}`);
    failed = true;
  }
  if (settings.minBytes > SETTINGS_BUDGETS.minBytes) {
    console.error(`FAIL: settings minified ${kb(settings.minBytes)} exceeds budget ${kb(SETTINGS_BUDGETS.minBytes)}`);
    failed = true;
  }
  if (settings.gzipBytes > SETTINGS_BUDGETS.gzipBytes) {
    console.error(`FAIL: settings gzipped ${kb(settings.gzipBytes)} exceeds budget ${kb(SETTINGS_BUDGETS.gzipBytes)}`);
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('OK: bundle within budget.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
