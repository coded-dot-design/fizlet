# Changelog

## 0.3.3

- **`fizlet/pad`**: swappable on-screen controls for touch (and mouse). `pad(engine, controls, {
  scheme, actions, side, host, move })` → `{ el, scheme, setScheme, destroy }`. Schemes: `stick`
  (analog, drives the stick axes), `dpad` (one finger, 8-way) and `buttons` (a key per move intent),
  each with round arcade action keys (tap, `hold` or `toggle`, the first is the big primary key).
  Drives `controls` intents only, so a game swaps its mobile scheme with one config change.
  Multi-touch with pointer capture (fire while steering), one delegated set of listeners on the
  engine's signal (a scheme swap adds none), one ledger node, exact Recall. ~1.8 KB gzip (budget 2 KB).
- input: `controls().steer(x, y, on)` drives the stick axes from code (the pad's stick).
- ui: Board UI section 11, the pad: `.bui-pad`, `.bui-stick` + `.bui-knob` (Battlefield's cockpit
  stick), `.bui-dpad`, round pad keys (Blitz's pad), `data-hand="left"`.

## 0.3.2

- **`fizlet/sprite`** (new brick, ~1.3 KB gzip): the character layer's drawing primitive.
  `sprites(defs, { palettes, cap, canvas })` takes pixel art as data (rows of characters, a colour
  map whose values can be palette roles such as `team`, frames, a pivot, an optional 1px outline)
  or a vector `paint()`, bakes each (sprite, frame, scale, palette) once into a capped cache
  (OffscreenCanvas when available) and `draw(ctx, id, frame, x, y, angle, scale, palette)` blits it
  with no allocation. `svg()` / `url()` give the same pixels for characters placed in the page. A
  test fixture redraws the Sherman tank hull pixel for pixel.

## 0.3.1

- **`fizlet/grid`**, the board layer (1,533 B gzip, budget 1,536): `board(cols, rows, { cell,
  diagonal })` with per-cell `terrain`, `cost` and `flags` (`BLOCKED`, `COVER`, `OCCUPIED`) in typed
  arrays; world ↔ cell (`at`, `cellOf`, `center`); A* `path(from, to, out, budget, avoid)` into your
  `Int32Array` with a decrease-key heap and stamped buffers made once (no allocation per call), a
  per-call expansion budget that returns a partial path instead of stalling a frame, 4- or 8-way
  without corner cutting; symmetric Bresenham `los` and `hit`; `flood` for movement range with `dist`;
  seeded `scatter` and `pick` so a seed reproduces the board. Tested against a reference Dijkstra
  on random weighted boards; 0 young-generation GCs over 100k path + LOS calls.

## 0.3.0

- **`fizlet/slot`**: mount a scene into an astro-base-engine slot
  (`figure.ae-slot[data-slot-target="<page>#<slot>"]`). Lazy start near the viewport, reduced motion
  keeps the placeholder and fallback (and removes a running scene), `role="img"` + `aria-label` kept
  until the scene says it is accessible, a contained stage (`contain: strict`), and `destroy()` gives
  the slot back exactly (a Ledger). 1515 bytes min + gzip, Ledger included; budget 2048.
- **Publish-ready on npm**: `exports` gains `./slot`; `files` ships `dist`, CHANGELOG, LICENSE,
  README; `publishConfig` sets public access and provenance; `prepack` builds.
- Types: relative imports in the shipped `.d.ts` now carry `.js`, so TypeScript consumers on
  `moduleResolution: node16 / nodenext` resolve them (they failed before).
- `npm run test:pack` (CI): pack, install the tarball in an empty project, import and typecheck every
  subpath.
- `.github/workflows/release.yml`: publishes a `v*` tag to npm with provenance, after the checks,
  using the `NPM_TOKEN` secret. CI's version tag on `main` calls it.

## 0.2.4

- ui: `.bui-grip` matches DOM Battlefield's card grip exactly: a flat violet tab with a strip of dark
  dots (was white dots), no rim, base or press motion even as a button, and a wider invisible area
  for thumbs.

## 0.2.3

- ui: the SURRENDER key's white-flag icon keeps its grid lines, white frame and flag outline. The
  sticker key's icon rule (fill only, no stroke) wiped them; each part now has a class
  (`bui-grid`, `bui-frame`, `bui-pole`, `bui-cloth`) the kit colours. Markup in BOARD-UI.md 9.3.

## 0.2.2

- **The website**: https://coded-dot-design.github.io/fizlet/, styled with the Board UI kit (the
  Battlefield design system). The contract, every brick with its measured size and a usage snippet,
  Recall, the spec sheet, the games built on Fizlet, the E0–E6 roadmap and a quick start. A live
  demo built with Fizlet itself: blast a small page, watch `engine.stats()`, press Recall.
- The site hosts the builds: `fizlet.js` (one script tag, `window.fizlet`, kernel and every brick
  but debug) and the ES modules under `dist/`, so the quick start works without npm.
- `npm run site` builds it (`scripts/site.mjs`, static HTML, no framework); `npm run test:site`
  checks every page at desktop and 360px (no errors, links, no overflow, the demo, reduced motion,
  the quick start). `pages.yml` deploys it on push to `main`. Not part of the published package.
- `scripts/sizes.mjs`: one size measurement for `npm run size` and the site.

## 0.2.1

- `fizlet/embed`: `open: false` waits closed behind the toggle key (a PLAY key on the page) instead
  of opening right away.

## 0.2.0

E2, the first bricks (the ones Battlefield Blitz needs):
- `fizlet/input`: keys → intents with one-frame edges latched in the read phase, pointer, a touch
  stick, on-screen `press()`; keys typed in the host's fields never count.
- `fizlet/collide`: fixed-capacity spatial hash (`add` / `near` take typed arrays and indices so
  nothing boxes), `overlap`, `circles`, `circleRect`, `inRect`, swept `segCircle`.
- `fizlet/fx`: pooled particles (struct of arrays), the hero `blast()`, pop words, scorch, shake.
- `fizlet/sound`: the event ring → synth cues adapter (or your own player); gesture unlock.
- `fizlet/embed`: palette (hex only), easter-egg triggers (sequence, gesture, click; desktop /
  mobile scope), lazy load, the open / close toggle, Escape to close.
- Tests for every brick (Node and Chromium); budgets in CI.

## 0.1.0

E1, the kernel:
- `createEngine`: one shared `requestAnimationFrame` for every engine, fixed 60 Hz step with a
  catch-up cap, `read → step → render` phases, render alpha, `advance()` for headless runs.
- Auto-pause: hidden tab, page leaving, root off screen, typing in the host's fields; reduced
  motion opt-in. One `AbortSignal` tears everything down.
- `Pool` (bounded, prefilled, never grows), `EventRing` (fixed capacity, cleared each frame),
  `seeded` random (the DOM VIRUS core sequence, allocation-free, restorable state).
- `Ledger`: text, styles, attributes, classes and added nodes; change-only writes; `restore()` gives
  the page back exactly (style text byte for byte) and a newer host edit always wins.
- `stats()`: frames, steps, dropped time, frame ms, pools, events, ledger size, pause reasons.
- `fizlet/debug`: `guardLayout(engine)` counts layout reads during a step.
- `fizlet/ui`: the Board UI kit and spec, moved here from DOM Battlefield.
- Contract tests: one rAF for N engines, fixed step + cap, pause, bounded pools and events, seeded
  random, destroy, **zero allocation over 1M steps**, exact DOM restore, host edits win, auto-pause,
  layout guard. Size budgets in CI (kernel ~2.6 KB of 4 KB gzip).
