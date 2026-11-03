# The Software Garden

Agentic engineering, from the model to the organisation.

Interactive explainers, published at https://camunda.github.io/agentic-engineering-explainers/. Chapters, in reading order:

<!-- chapters:start (generated from chapters.json by scripts/build.mjs; do not edit) -->
**Why** (00–03): The model, where humans fit in it, and the risks it balances.

- 00 [From Dark Factory to Software Garden](https://camunda.github.io/agentic-engineering-explainers/dark-factory.html) (`src/pages/dark-factory.html`)
- 01 [The role of humans](https://camunda.github.io/agentic-engineering-explainers/humans.html) (`src/pages/humans.html`)
- 02 [The organisation of agents](https://camunda.github.io/agentic-engineering-explainers/garden.html) (`src/pages/garden.html`)
- 03 [Engineering Risk](https://camunda.github.io/agentic-engineering-explainers/risk.html) (`src/pages/risk.html`)

**Quality** (04–08): How you know it's any good, at agentic speed.

- 04 [Agentic Loop Engineering](https://camunda.github.io/agentic-engineering-explainers/loops.html) (`src/pages/loops.html`)
- 05 [There are no flaky tests](https://camunda.github.io/agentic-engineering-explainers/no-flaky.html) (`src/pages/no-flaky.html`)
- 06 [All software fails somewhere](https://camunda.github.io/agentic-engineering-explainers/fails-somewhere.html) (`src/pages/fails-somewhere.html`)
- 07 [Point them at a number](https://camunda.github.io/agentic-engineering-explainers/telemetry.html) (`src/pages/telemetry.html`)
- 08 [Zero-eyes PR approval](https://camunda.github.io/agentic-engineering-explainers/zero-eyes.html) (`src/pages/zero-eyes.html`)

**Structure** (09–11): Know where the model is reliable, and harden the edges at compiler speed.

- 09 [Every model has an envelope](https://camunda.github.io/agentic-engineering-explainers/envelope.html) (`src/pages/envelope.html`)
- 10 [Rules that enforce themselves](https://camunda.github.io/agentic-engineering-explainers/enforce.html) (`src/pages/enforce.html`)
- 11 [Derivation over duplication](https://camunda.github.io/agentic-engineering-explainers/derive.html) (`src/pages/derive.html`)

**System** (12–14): The tools agents use, and the gates they pass through.

- 12 [Designing for agent users](https://camunda.github.io/agentic-engineering-explainers/agent-users.html) (`src/pages/agent-users.html`)
- 13 [Get to the eleventh](https://camunda.github.io/agentic-engineering-explainers/eleventh.html) (`src/pages/eleventh.html`)
- 14 [The merge button is part of the system](https://camunda.github.io/agentic-engineering-explainers/merge-gate.html) (`src/pages/merge-gate.html`)

**Organisation** (15–19): Rolling it out: people, teams, tools and bottlenecks.

- 15 [The bottleneck moved](https://camunda.github.io/agentic-engineering-explainers/constraints.html) (`src/pages/constraints.html`)
- 16 [The constraint is mindset, not the model](https://camunda.github.io/agentic-engineering-explainers/mindset.html) (`src/pages/mindset.html`)
- 17 [You are the skill](https://camunda.github.io/agentic-engineering-explainers/skill.html) (`src/pages/skill.html`)
- 18 [Conway's Law still holds](https://camunda.github.io/agentic-engineering-explainers/conway.html) (`src/pages/conway.html`)
- 19 [Start with one garden](https://camunda.github.io/agentic-engineering-explainers/start.html) (`src/pages/start.html`)

**Case studies** (20–22): What happened when we did it: the numbers, from the git history.

- 20 [The Cambrian explosion](https://camunda.github.io/agentic-engineering-explainers/case-study.html) (`src/pages/case-study.html`)
- 21 [Three shapes](https://camunda.github.io/agentic-engineering-explainers/three-shapes.html) (`src/pages/three-shapes.html`)
- 22 [c8ctl](https://camunda.github.io/agentic-engineering-explainers/c8ctl.html) (`src/pages/c8ctl.html`)

**Conclusion** (23): What it comes down to.

- 23 [Agency, not AGENTS.md](https://camunda.github.io/agentic-engineering-explainers/agency.html) (`src/pages/agency.html`)
<!-- chapters:end -->

The case study's numbers are snapshots from October and November 2026; the data scripts that produced them are not in this repo.

## How it's built

The site is generated. Don't edit HTML in `_site/`: it's build output and isn't committed.

| What | Where |
|---|---|
| Chapter order, groups, titles, card text, descriptions | `chapters.json` (the single source of truth) |
| A page's styles and body | `src/pages/<id>.html`, after a front-matter block (`---`, `layout: chapter`, `---`) |
| The shared page shell (head, sharing tags, header bar, section dots, brand.css, hints.js) | `src/layouts/chapter.html` |
| Images, scripts, fonts, brand files | `src/assets/`, copied to the site root unchanged |

    node scripts/build.mjs            # build into _site/ (also refreshes the chapter list above)
    node scripts/build.mjs --serve    # build, serve http://localhost:8931, rebuild on save
    node scripts/build.mjs --check    # what CI runs: build, check links, check this README is current

Pages get chapter metadata through placeholders, so nothing about order or numbering is hand-written:

- `{{kicker}}`: "The Software Garden · Group · NN", for the intro
- `{{nav}}`: the end-of-chapter Next / Previous / Contents links
- `{{num:<id>}}`: a chapter's number, e.g. `{{num:zero-eyes}}`; `{{range:<Group>}}`: a group's span, e.g. `{{range:Structure}}`
- `{{chapter_map}}`, `{{toc}}`: the chapter map (dark-factory) and the contents cards (index)
- `{{prev_href}}`, `{{prev_title}}`, `{{next_href}}`, `{{next_title}}`: for pages with their own navigation (garden)

To add or move a chapter: add `src/pages/<id>.html` and `src/assets/thumbs/<id>.jpg` (1200×750), add or move its entry in `chapters.json`, and run the build. Numbers, cards, maps, links and this README follow. An unknown placeholder, a chapter without a page, or a broken link fails the build.

Branding and interactivity hints: `src/layouts/chapter.html` loads `brand/brand.css` after the page styles and `brand/hints.js` before `</body>`. Mark every interactive control (button, slider, toggle) with `data-hint="…"`, e.g. `data-hint="drag the slider"`. It gets a "Try it: …" label and pulses until the reader first uses it, so interactive diagrams don't read as static pictures.

## The organisation of agents (`garden.html`)

    cd ~/workspace/agentic-engineering-explainers && node scripts/build.mjs --serve
    open http://localhost:8931            # contents
    open http://localhost:8931/garden.html

Fully offline (three.js vendored). Drag pan · right-drag rotate/tilt · scroll zoom-to-cursor ·
double-click fly in · 1–6 codebases (press twice to enter the garden) · 0 overview · space auto-orbit · g toggles structured / unstructured garden · p partial garden (⚙ in the mode pill: human/agentic speed, agents wait/carry on) · m toggles stable / evolving (structured) · ←/→ (or PageUp/PageDown) step through the guide sidebar · t hides it.

Live: https://camunda.github.io/agentic-engineering-explainers/
