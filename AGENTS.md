# Agent notes

The site is generated. Read "How it's built" in README.md first.

- Edit `chapters.json`, `src/pages/`, `src/layouts/` and `src/assets/`. Never edit `_site/` (build output, not committed).
- Never hand-write a chapter number, a chapter's title in a Next/Back link, a contents card, or a chapter list. Use the placeholders (`{{nav}}`, `{{num:<id>}}`, `{{range:<Group>}}`, `{{kicker}}`, `{{chapter_map}}`, `{{toc}}`).
- To add, rename or reorder a chapter, change `chapters.json` and run `node scripts/build.mjs`. Commit the README.md it regenerates.
- Before committing, run `node scripts/build.mjs --check` (CI runs the same). It fails on unknown placeholders, chapters without a page, broken relative links and a stale README.
- Preview: `node scripts/build.mjs --serve` (http://localhost:8931, rebuilds on save). Check pages in a real browser; most chapters are interactive.
- Every interactive control needs `data-hint="…"` (see README).
- Every chapter needs `src/assets/thumbs/<id>.jpg` at 1200×750; it's the contents card and the social preview.

Content rules:

- Case studies don't name individual people (not in pages, not in commit messages).
- Don't link private or internal repositories from the site; describe them instead.
- Don't feature Nano ProcessOS.
- Flag illustrative (made-up) examples as such when proposing changes.
