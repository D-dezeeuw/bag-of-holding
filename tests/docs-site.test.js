// Documentation site (5.3.0 row). What must hold: the d.ts parser
// surfaces every exported const/function (the doc site is an
// api-honesty gate, not a best-effort artifact); section banners group
// the reference; doc comments survive extraction; the markdown pass
// renders the recipe shapes it claims; and the shipped page names the
// load-bearing namespaces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseDeclarations, renderMarkdown } from '../scripts/build-docs.mjs';

test('every exported const/function in index.d.ts surfaces in the reference', async () => {
  const dts = await readFile(new URL('../index.d.ts', import.meta.url), 'utf8');
  const decls = parseDeclarations(dts);
  const names = new Set(decls.map((d) => d.name));
  // Exhaustive: re-scan the raw file; anything the parser missed fails.
  for (const line of dts.split('\n')) {
    const m = /^export (?:const|function) ([A-Za-z_$][\w$]*)/.exec(line);
    if (m) assert.ok(names.has(m[1]), `${m[1]} is in the reference`);
  }
  // The load-bearing namespaces are present with their doc text.
  for (const name of ['createEngine', 'Settings', 'Manifest', 'Cards', 'Convert', 'Strings', 'VariantCombat', 'SUNDERMARK', 'TREASURY']) {
    assert.ok(names.has(name), `${name} documented`);
  }
  const settings = decls.find((d) => d.name === 'Settings');
  assert.match(settings.doc, /setting plugin contract/i, 'doc comments survive extraction');
  // Section banners group the reference.
  const sections = new Set(decls.map((d) => d.section));
  assert.ok(sections.size >= 5, `sections extracted (${sections.size})`);
});

test('the minimal markdown pass renders the recipe shapes', () => {
  const html = renderMarkdown([
    '# Recipes',
    'Use `createEngine` with **seeded** rng.',
    '```js\nconst e = createEngine();\n```',
    '- first\n- second',
  ].join('\n\n'));
  assert.match(html, /<h2>Recipes<\/h2>/);
  assert.match(html, /<code>createEngine<\/code>/);
  assert.match(html, /<strong>seeded<\/strong>/);
  assert.match(html, /<pre><code>const e = createEngine\(\);<\/code><\/pre>/);
  assert.match(html, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
  // Raw HTML in prose is escaped, not injected.
  assert.match(renderMarkdown('<script>alert(1)</script>'), /&lt;script&gt;/);
});

test('the shipped page exists, is versioned, and carries reference + recipes', async () => {
  const html = await readFile(new URL('../examples/docs.html', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(html.includes(`v${pkg.version}`), 'the page is stamped with the generating version');
  for (const name of ['createEngine', 'Settings', 'Manifest', 'Cards', 'Convert']) {
    assert.ok(html.includes(`<code>${name}</code>`), `${name} on the page`);
  }
  assert.match(html, /id="recipes"/);
  assert.ok(!html.includes('<script'), 'fully static — no scripts on the page');
});
