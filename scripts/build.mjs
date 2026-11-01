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

const num = (n) => String(n).padStart(2, '0');
const short = (c) => c.short || c.title;
/** Text for a meta description: the chapter's own, else its card summary without markup. */
const describe = (c) => c.description || c.summary.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;');

/**
 * Fill {{name}} and {{name:arg}} placeholders. `vars` values are strings or functions of arg.
 * Unknown names are an error, so a typo fails the build instead of shipping.
 */
function fill(template, vars, where) {
  return template.replace(/\{\{([\w-]+)(?::([\w-]+))?\}\}/g, (_, k, arg) => {
    if (!(k in vars)) throw new Error(`${where}: unknown placeholder {{${k}}}`);
    const v = vars[k];
    return typeof v === 'function' ? v(arg) : v;
  });
}

// ---- generated fragments (all derived from chapters.json)

/** Contents page: one group heading and card list per group. */
function toc(ch) {
  return ch.groups.map((g) => [
    `  <div class="group"><h3>${g.group}</h3><p>${g.blurb}</p></div>`,
    '  <ol class="toc">',
    ...g.chapters.map((c) => [
      '    <li>',
      `      <a class="card" href="./${c.id}.html">`,
      `        <div class="thumb" style="background-image:url(./thumbs/${c.id}.jpg)"></div>`,
      '        <div class="body">',
      `          <h3>${short(c)}</h3>`,
      `          <p>${c.summary}</p>`,
      `          <div class="meta"><span>${c.kind}</span><span>${c.length}</span></div>`,
      '        </div>',
      '      </a>',
      '    </li>',
    ].join('\n')),
    '  </ol>',
  ].join('\n')).join('\n');
}

/** "The rest of the book" map: every chapter after the given one. */
function chapterMap(ch, after) {
  return ch.list.filter((c) => c.n > after.n)
    .map((c) => `      <a href="./${c.id}.html"><b>${num(c.n)} &middot; ${short(c)}</b><span>${c.tagline}</span></a>`)
    .join('\n');
}

/** End-of-chapter links: next (primary), previous, contents. */
function nav(ch, c) {
  const prev = ch.list[c.n - 1], next = ch.list[c.n + 1];
  return [
    next ? `<a class="pill" href="./${next.id}.html">Next: ${short(next)} &#x2192;</a>` : '<a class="pill" href="./index.html">Back to contents</a>',
    prev && `<a class="pill ghost" href="./${prev.id}.html">&#x2190; ${short(prev)}</a>`,
    next && '<a class="pill ghost" href="./index.html">Contents</a>',
  ].filter(Boolean).join('\n      ');
}

/** README chapter list. */
function readmeList(ch) {
  return ch.groups.map((g) => {
    const first = g.chapters[0], last = g.chapters.at(-1);
    const range = first === last ? num(ch.byId[first.id].n) : `${num(ch.byId[first.id].n)}–${num(ch.byId[last.id].n)}`;
    return [`**${g.group}** (${range}): ${g.blurb}`, '', ...g.chapters.map((c) => `- ${num(ch.byId[c.id].n)} [${short(c)}](https://camunda.github.io/agentic-engineering-explainers/${c.id}.html) (\`src/pages/${c.id}.html\`)`)].join('\n');
  }).join('\n\n');
}

function headMeta(id, c) {
  const title = `${c.title} — The Software Garden`;
  const description = describe(c);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="The Software Garden" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
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
  const c = ch.byId[id];
  const needChapter = (name) => () => { throw new Error(`${id}: {{${name}}} only works on pages listed in chapters.json`); };
  const vars = {
    // Usable anywhere in a page
    num: (ref) => {
      if (!ch.byId[ref]) throw new Error(`${id}: {{num:${ref}}}: no chapter "${ref}" in chapters.json`);
      return num(ch.byId[ref].n);
    },
    range: (group) => {
      const g = ch.groups.find((x) => x.group === group);
      if (!g) throw new Error(`${id}: {{range:${group}}}: no group "${group}" in chapters.json`);
      const first = ch.byId[g.chapters[0].id].n, last = ch.byId[g.chapters.at(-1).id].n;
      return first === last ? num(first) : `${num(first)}&ndash;${num(last)}`;
    },
    toc: toc(ch),
    kicker: c ? `The Software Garden &middot; ${c.group} &middot; ${num(c.n)}` : needChapter('kicker'),
    nav: c ? nav(ch, c) : needChapter('nav'),
    chapter_map: c ? chapterMap(ch, c) : needChapter('chapter_map'),
    prev_href: c && ch.list[c.n - 1] ? `./${ch.list[c.n - 1].id}.html` : './index.html',
    prev_title: c && ch.list[c.n - 1] ? short(ch.list[c.n - 1]) : 'Contents',
    next_href: c && ch.list[c.n + 1] ? `./${ch.list[c.n + 1].id}.html` : './index.html',
    next_title: c && ch.list[c.n + 1] ? short(ch.list[c.n + 1]) : 'Contents',
  };
  const body = fill(content, vars, id);
  const cut = body.indexOf('</style>\n');
  const shell = {
    content: body,
    style: cut < 0 ? '' : body.slice(0, cut + 9),
    body: cut < 0 ? body : body.slice(cut + 9),
    head: () => {
      if (!c) throw new Error(`${id}: layout ${layout} needs a chapters.json entry for its <head>`);
      return headMeta(id, c);
    },
    short_title: () => {
      if (!c) throw new Error(`${id}: layout ${layout} needs a chapters.json entry for its header`);
      return short(c);
    },
  };
  return fill(layouts[layout], shell, `${id} (layout ${layout})`);
}

/** Replace the generated block between the README markers. */
function readme(ch) {
  const file = join(ROOT, 'README.md');
  const text = readFileSync(file, 'utf8');
  const START = '<!-- chapters:start (generated from chapters.json by scripts/build.mjs; do not edit) -->', END = '<!-- chapters:end -->';
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a < 0 || b < 0) throw new Error('README.md: missing chapters markers');
  return { file, current: text, next: `${text.slice(0, a + START.length)}\n${readmeList(ch)}\n${text.slice(b)}` };
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
  const rd = readme(ch);
  return { ch, ids, rd };
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
  const { ids, rd } = build();
  console.log(`built ${ids.length} pages into _site/`);
  if (rd.current !== rd.next) {
    if (args.has('--check')) { console.error('README.md chapter list is out of date: run node scripts/build.mjs and commit README.md'); process.exit(1); }
    writeFileSync(rd.file, rd.next);
    console.log('updated README.md chapter list');
  }
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
