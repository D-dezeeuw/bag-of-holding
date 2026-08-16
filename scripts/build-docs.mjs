// === Documentation site generator (5.3.0 row) ===
//
// Generates the static API reference the 1.0.0 release deferred
// ("TypeDoc site deferred to post-1.0") — without TypeDoc, because the
// kernel ships zero deps and index.d.ts's doc comments are already the
// documentation. The generator:
//
//   1. Parses index.d.ts for exported declarations (const / function /
//      interface / type) and the /** … */ comment above each.
//   2. Groups them under the file's own `// ===` section banners.
//   3. Renders docs/recipes.md through a minimal, dependency-free
//      markdown pass (headings, fenced code, inline code, paragraphs).
//   4. Emits examples/docs.html; pages-build ships it at /docs.html.
//
//   node scripts/build-docs.mjs
//
// `parseDeclarations()` is exported pure so tests can assert coverage:
// every `export const/function` in index.d.ts must surface in the
// reference — an export without a doc entry fails CI, which makes the
// doc site an api-honesty gate rather than a best-effort artifact.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parse index.d.ts into [{ section, name, kind, signature, doc }]. */
export function parseDeclarations(dts) {
  const out = [];
  let section = 'Core';
  const lines = dts.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const banner = /^\/\/ (.+[^= ]) *$/.exec(line);
    if (banner && /^\/\/ =+$/.test(lines[i - 1] ?? '') && /^\/\/ =+$/.test(lines[i + 1] ?? '')) {
      section = banner[1].trim();
      continue;
    }
    const decl = /^export (const|function|interface|type) ([A-Za-z_$][\w$]*)/.exec(line);
    if (!decl) continue;
    // Collect the /** … */ block immediately above (skipping blanks).
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j--;
    const docLines = [];
    if (lines[j]?.trim().endsWith('*/')) {
      while (j >= 0) {
        docLines.unshift(lines[j]);
        if (lines[j].trim().startsWith('/**')) break;
        j--;
      }
    }
    const doc = docLines.join('\n')
      .replace(/^\s*\/\*\*\s?/, '').replace(/\s*\*\/\s*$/, '')
      .split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join(' ')
      .replace(/\s+/g, ' ').trim();
    out.push({
      section,
      name: decl[2],
      kind: decl[1],
      signature: line.replace(/\s*\{?\s*$/, '').trim(),
      doc,
    });
  }
  return out;
}

/** Minimal markdown → HTML: headings, fenced code, inline code, lists, paragraphs. */
export function renderMarkdown(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = md.split(/\n\n+/);
  return blocks.map((block) => {
    if (block.startsWith('```')) {
      const body = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
      return `<pre><code>${esc(body)}</code></pre>`;
    }
    const h = /^(#{1,4}) (.+)$/m.exec(block);
    if (h && block.trim().split('\n').length === 1) {
      const level = h[1].length;
      return `<h${level + 1}>${inline(h[2])}</h${level + 1}>`;
    }
    if (/^[-*] /m.test(block)) {
      const items = block.split('\n').filter((l) => /^[-*] /.test(l))
        .map((l) => `<li>${inline(l.slice(2))}</li>`).join('');
      if (items) return `<ul>${items}</ul>`;
    }
    return `<p>${inline(block)}</p>`;
  }).join('\n');
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
}

function renderReference(decls, version) {
  const sections = new Map();
  for (const d of decls) {
    if (!sections.has(d.section)) sections.set(d.section, []);
    sections.get(d.section).push(d);
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const toc = [...sections.keys()]
    .map((s) => `<a href="#${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${esc(s)}</a>`).join(' · ');
  const body = [...sections.entries()].map(([name, ds]) => `
  <section id="${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
    <h2>${esc(name)}</h2>
    ${ds.map((d) => `
    <article class="decl">
      <h3><code>${esc(d.name)}</code> <span class="kind">${d.kind}</span></h3>
      ${d.doc ? `<p>${esc(d.doc)}</p>` : ''}
      <pre><code>${esc(d.signature)}</code></pre>
    </article>`).join('')}
  </section>`).join('\n');
  return { toc, body };
}

const PAGE = (version, toc, reference, recipes) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bag-of-holding — documentation</title>
<style>
  body { font-family: Georgia, serif; max-width: 62rem; margin: 2rem auto; padding: 0 1rem; background: #1b1b22; color: #e8e4da; line-height: 1.55; }
  h1 { font-variant: small-caps; letter-spacing: .04em; }
  h2 { border-bottom: 1px solid #444; padding-bottom: .25rem; margin-top: 2.5rem; }
  nav { font-size: .85rem; color: #8b867a; margin-bottom: 2rem; }
  nav a { color: #9c9; text-decoration: none; }
  .decl { margin: 1rem 0 1.5rem; }
  .decl h3 { margin-bottom: .25rem; }
  .kind { font-size: .7rem; color: #8b867a; font-family: monospace; }
  pre { overflow-x: auto; background: #14141a; padding: .6rem .8rem; border-radius: 6px; font-size: .8rem; }
  code { background: #14141a; padding: .05rem .3rem; border-radius: 4px; }
  .recipes { margin-top: 3rem; border-top: 2px solid #444; }
  footer { margin-top: 2rem; font-size: .85rem; color: #8b867a; }
</style>
</head>
<body>
<h1>bag-of-holding <small>v${version}</small></h1>
<p>API reference generated from <code>index.d.ts</code> doc comments, plus the cookbook.
Static — no scripts run on this page.</p>
<nav>${toc} · <a href="#recipes">Recipes</a></nav>
${reference}
<section id="recipes" class="recipes">
<h2>Recipes</h2>
${recipes}
</section>
<footer>Generated by <code>scripts/build-docs.mjs</code>.</footer>
</body>
</html>
`;

const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const dts = await fs.readFile(path.join(ROOT, 'index.d.ts'), 'utf8');
  const decls = parseDeclarations(dts);
  const recipesMd = await fs.readFile(path.join(ROOT, 'docs/recipes.md'), 'utf8');
  const { toc, body } = renderReference(decls, pkg.version);
  const html = PAGE(pkg.version, toc, body, renderMarkdown(recipesMd));
  await fs.writeFile(path.join(ROOT, 'examples', 'docs.html'), html);
  console.log(`docs: ${decls.length} declarations across ${new Set(decls.map((d) => d.section)).size} sections → examples/docs.html`);
}
