// === Content index generator (5.1.0 row) ===
//
// Builds the static catalog page from PLUGIN MANIFESTS — the 3.6.0
// format is the source of truth, so the index dogfoods it: every
// in-repo setting pack gets a mechanically derived manifest, each is
// validated through Manifest.validate and matched against the current
// kernel with Manifest.matches, and the page embeds the verdicts. A
// third-party pack joins the index by publishing the same file.
//
//   node scripts/build-content-index.mjs   → examples/plugins.html
//
// `buildIndexData()` is exported pure so tests assert the derivation
// without touching the filesystem.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Manifest, Settings } from '../index.js';
import { SUNDERMARK } from '../src/settings/sundermark/index.js';
import { BRASSGEAR } from '../src/settings/brassgear/index.js';
import { HOLLOW_VALE } from '../src/settings/hollow-vale/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The tables a setting pack can contribute, in manifest vocabulary. */
const PACK_TABLES = ['regions', 'npcs', 'adventures', 'species', 'backgrounds', 'feats', 'items', 'monsters', 'spells'];

/** Derive a manifest for an in-repo setting pack, mechanically. */
export function manifestFor(pack, kernelVersion) {
  const contributes = {};
  for (const table of PACK_TABLES) {
    const count = Object.keys(pack[table] ?? {}).length;
    if (count > 0) contributes[table] = count;
  }
  if (Object.keys(pack.hooks ?? {}).length > 0) {
    contributes.storyHooks = Object.keys(pack.hooks).length;
  }
  return {
    manifestVersion: Manifest.VERSION,
    // The truthful publishable identity: these packs ship INSIDE the
    // kernel package; the entry (the subpath export) is what tells
    // them apart. A third-party pack would put its own name here.
    name: '@zeeuw/bag-of-holding',
    version: kernelVersion,
    kernel: `^${kernelVersion}`,
    description: pack.pitch,
    entry: `./src/settings/${pack.id}/index.js`,
    contributes,
  };
}

/** The full index: manifest + validation + kernel-match per pack. */
export async function buildIndexData() {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const packs = [SUNDERMARK, BRASSGEAR, HOLLOW_VALE];
  return packs.map((pack) => {
    const manifest = manifestFor(pack, pkg.version);
    return {
      id: pack.id,
      name: pack.name,
      pitch: pack.pitch,
      manifest,
      valid: Manifest.validate(manifest),
      match: Manifest.matches(manifest, pkg.version),
      settingContract: Settings.validate(pack),
    };
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPage(entries, kernelVersion) {
  const cards = entries.map((e) => `
    <article class="pack ${e.match.ok ? 'ok' : 'blocked'}">
      <h2>${esc(e.name)}</h2>
      <p class="pitch">${esc(e.pitch)}</p>
      <p class="verdict">${e.match.ok ? '✓ mounts on this kernel' : `✗ ${esc(e.match.reasons.join('; '))}`}
        · setting contract: ${e.settingContract.valid ? '✓' : '✗'}</p>
      <dl>${Object.entries(e.manifest.contributes)
        .map(([table, count]) => `<dt>${esc(table)}</dt><dd>${count}</dd>`).join('')}</dl>
      <details><summary>bag-of-holding.json</summary>
        <pre>${esc(JSON.stringify(e.manifest, null, 2))}</pre></details>
    </article>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bag-of-holding — content index</title>
<style>
  body { font-family: Georgia, serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; background: #1b1b22; color: #e8e4da; }
  h1 { font-variant: small-caps; letter-spacing: .04em; }
  .pack { border: 1px solid #444; border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; background: #232330; }
  .pack.blocked { border-color: #a33; }
  .pitch { font-style: italic; color: #bdb7a8; }
  .verdict { font-size: .9rem; color: #9c9; }
  .blocked .verdict { color: #c99; }
  dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: .1rem .75rem; font-size: .85rem; }
  dt { color: #8b867a; display: inline; }
  dd { display: inline; margin: 0 0 0 .35rem; font-weight: bold; }
  dl > div, dl dt, dl dd { white-space: nowrap; }
  pre { overflow-x: auto; background: #14141a; padding: .75rem; border-radius: 6px; font-size: .78rem; }
  footer { margin-top: 2rem; font-size: .85rem; color: #8b867a; }
</style>
</head>
<body>
<h1>Content index</h1>
<p>Setting packs published against the <code>bag-of-holding.json</code> manifest format
(kernel <code>${esc(kernelVersion)}</code>). Every card below is generated from a manifest and
validated by <code>Manifest.validate</code> + <code>Settings.validate</code> — a third-party pack
joins this index by publishing the same file.</p>
${cards}
<footer>Generated by <code>scripts/build-content-index.mjs</code>. Static — no scripts run on this page.</footer>
</body>
</html>
`;
}

// Run as a script: write examples/plugins.html.
const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const entries = await buildIndexData();
  const html = renderPage(entries, pkg.version);
  const out = path.join(ROOT, 'examples', 'plugins.html');
  await fs.writeFile(out, html);
  const blocked = entries.filter((e) => !e.match.ok || !e.valid.valid || !e.settingContract.valid);
  console.log(`content index: ${entries.length} packs → ${path.relative(ROOT, out)}`);
  if (blocked.length) {
    console.error(`FAIL: ${blocked.map((e) => e.id).join(', ')} did not validate`);
    process.exit(1);
  }
}
