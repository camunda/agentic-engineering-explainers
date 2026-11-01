#!/usr/bin/env node
// Builds the site from src/ into _site/. No dependencies.
//
//   node scripts/build.mjs            build into _site/
//   node scripts/build.mjs --serve    build, serve on http://localhost:8931 and rebuild on change
//   node scripts/build.mjs --check    build, then fail if README.md is out of date or a link is broken
//
// Sources
//   chapters.json        reading order, groups and card text for every chapter (the single source of truth)
//   src/pages/*.html     one file per page: a front-matter block, then the page's <style> and body
//   src/layouts/*.html   page shells; {{name}} placeholders are filled from front matter and chapters.json
//   src/assets/          copied to the site root unchanged (brand/, thumbs/, vendor/, *.js)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync, statSync, watch } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src'), OUT = join(ROOT, '_site');
const SITE = 'https://camunda.github.io/agentic-engineering-explainers/';

// ---------------------------------------------------------------- sources

/** Parse `---\nkey: value\n---\n` front matter. Values are single-line strings. */
function parsePage(file) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) throw new Error(`${file}: bad front matter line: ${line}`);
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, content: text.slice(m[0].length) };
}

function loadChapters() {
  const groups = JSON.parse(readFileSync(join(ROOT, 'chapters.json'), 'utf8'));
  const list = [];
  for (const g of groups) for (const c of g.chapters) list.push({ ...c, group: g.group, n: list.length });
  const byId = Object.fromEntries(list.map((c) => [c.id, c]));
  if (Object.keys(byId).length !== list.length) throw new Error('chapters.json: duplicate id');
  return { groups, list, byId };
}

// ---------------------------------------------------------------- rendering

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const num = (n) => String(n).padStart(2, '0');

/** Fill {{name}} placeholders; unknown names are an error so typos don't ship. */
function fill(template, vars, where) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`${where}: unknown placeholder {{${k}}}`);
    return vars[k];
  });
}

function headMeta(id, meta) {
  const title = `${meta.title} — The Software Garden`;
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${meta.description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="The Software Garden" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${meta.description}" />`,
    `<meta property="og:url" content="${SITE}${id}.html" />`,
    `<meta property="og:image" content="${SITE}thumbs/${id}.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="750" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${SITE}thumbs/${id}.jpg" />`,
  ].join('\n');
}

function render(id, page, layouts, ch) {
  const { meta, content } = page;
  const layout = meta.layout || 'chapter';
  if (!(layout in layouts)) throw new Error(`${id}: unknown layout ${layout}`);
  const cut = content.indexOf("</style>\n");
  const vars = {
    content,
    style: cut < 0 ? "" : content.slice(0, cut + 9),
    body: cut < 0 ? content : content.slice(cut + 9),
    head: meta.title ? headMeta(id, meta) : "",
  };
  return fill(layouts[layout], vars, `${id} (layout ${layout})`);
}

// ---------------------------------------------------------------- build

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(SRC, 'assets'), OUT, { recursive: true });
  const ch = loadChapters();
  const layouts = Object.fromEntries(readdirSync(join(SRC, 'layouts')).map((f) => [f.replace(/\.html$/, ''), readFileSync(join(SRC, 'layouts', f), 'utf8')]));
  const ids = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
  for (const c of ch.list) if (!ids.includes(c.id)) throw new Error(`chapters.json: no page src/pages/${c.id}.html`);
  for (const id of ids) {
    const html = render(id, parsePage(join(SRC, 'pages', `${id}.html`)), layouts, ch);
    writeFileSync(join(OUT, `${id}.html`), html);
  }
  return { ch, ids };
}

// ---------------------------------------------------------------- checks

/** Every relative href/src/url() in every built page must resolve inside _site/. */
function checkLinks() {
  const bad = [];
  for (const f of readdirSync(OUT).filter((x) => x.endsWith('.html'))) {
    const html = readFileSync(join(OUT, f), 'utf8');
    for (const m of html.matchAll(/(?:href|src)="(\.\/[^"#?]*)|url\((\.\/[^)]+)\)/g)) {
      const target = (m[1] || m[2]).replace(/^\.\//, '') || 'index.html';
      if (!existsSync(join(OUT, target))) bad.push(`${f} -> ${target}`);
    }
  }
  return bad;
}

// ---------------------------------------------------------------- dev server

function serve(port = Number(process.env.PORT) || 8931) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(OUT, p);
    if (!f.startsWith(OUT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(f));
  }).listen(port, () => console.log(`serving _site/ on http://localhost:${port}`));
  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); console.log('rebuilt'); } catch (e) { console.error(e.message); } }, 100); };
  watch(SRC, { recursive: true }, rebuild);
  watch(join(ROOT, 'chapters.json'), rebuild);
}

// ---------------------------------------------------------------- main

const args = new Set(process.argv.slice(2));
try {
  const { ids } = build();
  console.log(`built ${ids.length} pages into _site/`);
  if (args.has('--check')) {
    const bad = checkLinks();
    if (bad.length) { console.error(`broken links:\n  ${bad.join('\n  ')}`); process.exit(1); }
    console.log('links ok');
  }
  if (args.has('--serve')) serve();
} catch (e) {
  console.error(`build failed: ${e.message}`);
  process.exit(1);
}
