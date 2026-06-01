// === GitHub Pages build (since 2.0.0) ===
//
// Assembles a static `public/` tree the Pages workflow uploads.
// The kernel is pure ESM with relative imports, so the "build"
// here is just file copying + one path rewrite — no bundler, no
// transpile, no transform of source code.
//
// Output layout (everything the page needs to run in a browser):
//
//   public/
//     index.html        — the solo sandbox at the Pages root
//     index.js          — engine entry
//     src/              — engine modules (resolved by relative imports)
//
// Local sanity check:  npm run pages:build && npx http-server public

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

async function clean() {
  await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
}

async function buildSoloPage() {
  const src = await fs.readFile(path.join(ROOT, 'examples/solo.html'), 'utf8');
  // The page lives in `examples/` and imports `'../index.js'`. At
  // the Pages root the kernel is alongside the page, so the
  // relative path collapses to `'./index.js'`. One targeted swap;
  // brittle by design — keeps the example file working unchanged
  // for local repo use.
  const rewritten = src.replace("'../index.js'", "'./index.js'");
  if (rewritten === src) {
    throw new Error('pages-build: expected examples/solo.html to import from ../index.js — did the import line change?');
  }
  await fs.writeFile(path.join(PUBLIC_DIR, 'index.html'), rewritten);
}

async function main() {
  await clean();
  await buildSoloPage();
  await fs.copyFile(path.join(ROOT, 'index.js'), path.join(PUBLIC_DIR, 'index.js'));
  await fs.cp(path.join(ROOT, 'src'), path.join(PUBLIC_DIR, 'src'), { recursive: true });

  // Quick byte-count sanity check so a regression in the file copy
  // is loud in CI logs.
  const files = await listFiles(PUBLIC_DIR);
  const total = files.reduce((acc, { size }) => acc + size, 0);
  console.log(`pages-build → ${PUBLIC_DIR}`);
  console.log(`  ${files.length} files, ${(total / 1024).toFixed(1)} kB`);
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push({ path: full, size: (await fs.stat(full)).size });
  }
  return out;
}

await main();
