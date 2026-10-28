# Fizlet

**Tiny physics for your page.** A micro game and animation engine for the DOM: one shared loop,
bounded everything, zero allocation in the steady state, and the page always comes back exactly as
it was. No runtime dependencies, ever.

**Website, live demo and quick start: https://coded-dot-design.github.io/fizlet/**

The "fiz" is fizz (the pop of an effect) and a nod to physics; the "-let" is small, like an applet.
Fizlet powers the [DOM VIRUS](https://coded-dot-design.github.io/dom-virus/) arcade and
[DOM Battlefield](https://coded-dot-design.github.io/dom-battlefield/).

```ts
import { createEngine } from "fizlet";

const engine = createEngine({ root: document.querySelector("#game"), seed: 7 });
const sparks = engine.pool("sparks", 64, () => ({ x: 0, y: 0, vx: 0, vy: 0, el: null }));

engine.add({
  read(e) { /* cached geometry, input */ },
  step(e, dt) { /* the simulation: fixed 60 Hz, no DOM, no allocation */ },
  render(e, alpha) { /* change-only DOM writes through e.ledger; sounds from e.events */ },
});
engine.start();
// Later: Recall. Every listener goes, every page change is undone.
engine.destroy();
```

## The contract

Every brick and every game built on Fizlet keeps these (each one has a test):

1. **One clock per page.** Every engine shares one `requestAnimationFrame`. Fixed step (default
   60 Hz) with an accumulator and a catch-up cap: a long frame drops time, it never spirals.
2. **Bounded everything.** Pools and the event ring have a fixed capacity and refuse work when full.
3. **Zero steady-state allocation.** Tested: 1M kernel steps of a busy system cause no young-generation
   GC; each brick alone allocates nothing. Hot-path tip: pass typed arrays and indices (`grid.add`,
   `grid.near`, `overlap`) rather than many numbers, so V8 never boxes them in big step functions.
4. **No layout reads in the step.** Read in `read`, simulate in `step`, write in `render`.
   `fizlet/debug` counts any layout read made during a step.
5. **Change-only writes.** The ledger skips writes that change nothing.
6. **Pause by default.** Hidden tab, page leaving, root off screen, typing in the host's own fields
   (reduced motion is opt-in). Zero CPU while paused.
7. **Own nothing you can't give back.** Every page change goes through the ledger; `destroy()`
   restores it exactly, and a newer edit by the host page always wins. One `AbortSignal` removes
   every listener and observer.
8. **Embed-safe.** No globals, no global styles, many engines per page.
9. **Budgets in CI.** Kernel ≤ 4 KB gzip (today: ~2.8 KB), each brick ~1.5 KB.

## What's in the box

| Import | What | Size (min + gzip) |
|---|---|---|
| `fizlet` / `fizlet/kernel` | `createEngine`, scheduler, `Pool`, `EventRing`, `Ledger`, `seeded` | ~2.8 KB |
| `fizlet/debug` | `guardLayout(engine)`: counts layout reads during a step (dev only) | ~0.5 KB |
| `fizlet/input` | `controls(engine, { keys, stick })`: intents (`down`, `hit`, `axis`), pointer, touch stick, on-screen `press` | ~1.0 KB |
| `fizlet/collide` | `Grid` spatial hash (`add` / `near`), `overlap`, `circles`, `circleRect`, `segCircle` (swept, no tunnelling) | ~0.8 KB |
| `fizlet/fx` | `effects()`: pooled particles, `blast()` (the hero explosion), pop words, scorch, shake | ~1.5 KB |
| `fizlet/sound` | `sound(engine, { cues })`: event ring → synth cues (or your own player), unlock on gesture | ~0.9 KB |
| `fizlet/embed` | `embed(load, { name, palette, easterEgg })`: drop-in, hex-only palette, key / gesture / click triggers, lazy load, toggle, Escape | ~2.0 KB |
| `fizlet/ui` + `fizlet/ui/board-ui.css` | Board UI: 3D keys, cards, overlays, launch burst ([spec](src/ui/BOARD-UI.md)) | ~2.4 KB + ~3.8 KB css |

More bricks land through phase E2 (actor, steer, aim, rules, board-page, board-grid, camera,
view-dom, presence): see the [engine plan](https://github.com/coded-dot-design/dom-virus/blob/main/ENGINE.md).

### Engine API

- `createEngine({ root, step, maxSteps, seed, events, signal, pause })`
- `engine.add(system)` / `remove(system)`: systems run in order; hooks `read`, `step`, `render`.
- `engine.start()` / `stop()` / `destroy()`; `engine.running`, `engine.paused` (reasons).
- `engine.advance(seconds)`: run time by hand (tests, headless, a server).
- `engine.pool(name, cap, create)`: a named bounded pool (shows in `stats()`).
- `engine.events`: the event ring (`emit(type, a, b, x, y, v)`, `size`, `at(i)`), cleared each frame.
- `engine.ledger`: `text`, `style`, `attr`, `cls`, `add(node)`, `restore()`.
- `engine.random()`: seeded; `engine.random.state` snapshots and restores it.
- `engine.stats()`: frames, steps, dropped time, frame ms, pools, events, ledger size, pause reasons.

## Develop

```sh
npm ci
npm run check         # typecheck, contract tests (node), build
npm run size          # size budgets
npm run test:browser  # contract tests in Chromium (Playwright)
npm run site          # the website, into site-dist/
```

### The website

`site/` is the source of https://coded-dot-design.github.io/fizlet/: template-string pages
(`site/layout.mjs`, `site/pages/`), `site/site.css` on top of the Board UI kit, and a live demo
(`site/demo.ts`) built with Fizlet itself. No framework: `scripts/site.mjs` writes static HTML.

```sh
npm run site        # build dist/ and site-dist/ (gitignored); open site-dist/index.html
npm run test:site   # every page at desktop and 360px: errors, links, overflow, the demo (Chromium)
```

The site also hosts the builds for the quick start: `fizlet.js` (one file, `window.fizlet`) and
the ES modules under `dist/`. `.github/workflows/pages.yml` deploys it on every push to `main`.

Releases: bump `version` in `package.json`; CI tags `vX.Y.Z` on `main` after the checks pass.

## Licence

MIT © Chris Cooley / coded.design
