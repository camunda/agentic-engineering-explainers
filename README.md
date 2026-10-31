# Agentic Engineering Basics

Interactive explainers. `index.html` is the table of contents; each chapter is its own page:

- `dark-factory.html`: chapter 0, From Dark Factory to Software Garden: introduces the garden metaphor (scroll-through with interactive demos)
- `humans.html`: the role of humans in the agentic SDLC (scroll-through)
- `garden.html`: the organisation of agents (three.js semantic-zoom presentation, described below)
- `loops.html`: Agentic Loop Engineering (scroll-through with interactive demos)
- `fails-somewhere.html`: All software fails somewhere: keep the defect rate falling as throughput rises (scroll-through with interactive demos)
- `no-flaky.html`: There are no flaky tests (scroll-through)
- `zero-eyes.html`: Zero-eyes PR approval (scroll-through with interactive demos)
- `enforce.html`: Rules that enforce themselves (scroll-through)
- `derive.html`: Derivation over duplication (scroll-through)
- `agent-users.html`: Designing for agent users (scroll-through)
- `merge-gate.html`: The merge button is part of the system (scroll-through with interactive demos)
- `constraints.html`: The bottleneck moved (scroll-through)
- `mindset.html`: The constraint is mindset, not the model (scroll-through)
- `skill.html`: You are the skill (scroll-through)
- `conway.html`: Conway's Law still holds (scroll-through)
- `start.html`: Start with one garden (scroll-through)

Chapters are grouped on the contents page: Why (00–02), Quality (03–06), Structure (07–08), System (09–10) and Organisation (11–15).

To add a chapter: add the page, a card in the right group's `<ol class="toc">` in `index.html` (thumbnail in `thumbs/`), an entry in the chapter map in `dark-factory.html`, and next/previous links in the end-of-chapter `cta` blocks of the page and its neighbours.

Branding and interactivity hints: load `brand/brand.css` after the page styles and `brand/hints.js` before `</body>`. Mark every interactive control (button, slider, toggle) with `data-hint="…"`, e.g. `data-hint="drag the slider"`. It gets a "Try it: …" label and pulses until the reader first uses it, so interactive diagrams don't read as static pictures.

## The organisation of agents (`garden.html`)

    cd ~/workspace/agentic-engineering-explainers && python3 -m http.server 8931
    open http://localhost:8931            # contents
    open http://localhost:8931/garden.html

Fully offline (three.js vendored). Drag pan · right-drag rotate/tilt · scroll zoom-to-cursor ·
double-click fly in · 1–6 codebases (press twice to enter the garden) · 0 overview · space auto-orbit · g toggles structured / unstructured garden · p partial garden (⚙ in the mode pill: human/agentic speed, agents wait/carry on) · m toggles stable / evolving (structured) · ←/→ (or PageUp/PageDown) step through the guide sidebar · t hides it.

Live: https://camunda.github.io/agentic-engineering-explainers/
