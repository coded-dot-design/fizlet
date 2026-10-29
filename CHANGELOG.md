# Changelog

## Unreleased

- **CSS containment on every root Fizlet owns** (contract rule 8): the pad and the match overlay
  (kit CSS) and the launch burst are `contain: layout style`; the `fizlet/ui` mount root is
  `contain: style` (it is static, so layout or paint containment could move or clip a board's own
  layers); the slot stage stays `contain: strict`. `hud` and `board-page` own no box and add none
  to the host's markup. New browser test: each root's computed `contain`, every box inside the
  pad, overlay and burst identical with containment on and off (nothing moves or clips), host
  boxes uncontained, and Recall still restores the page byte for byte. No visual change. Sizes:
  `fizlet/ui` js 2,424 → 2,446 B, css 4,585 → 4,602 B gzip.
- **README truth pass** (measured numbers only): "runs Battlefield Blitz; the arcade and Battlefield
  move onto it next" replaces "powers the arcade and Battlefield"; every size is what
  `npm run size` measures (several were stale: pad, match, board-page, ui css); "each brick
  ~1.5 KB" is now the per-brick budgets (1.5 to 5 KB); the allocation claim says how it is measured
  (0 young GCs in 1M steps on Node 24, best of three); `sound` lists its real cue names and
  8 voices; the split size table, duplicate rows, duplicate "More bricks" note (which still listed
  `presence` and `board-page` as planned) and duplicate Develop section are fixed.
  `src/ui/BOARD-UI.md`: cue names (`ready`, `win`, `end`, not `start`, `won`, `gameover`), 8 voices
  not 6, it lives in Fizlet (`src/ui/`) now, measured kit sizes. Site: the contract cards say the
  same.

## 0.4.4

- **`fizlet/board-page`**, the page-as-board brick (from DOM VIRUS `board.ts`): `boardPage(engine,
  { root, text, targets, exclude, maxGlyphs, maxTargets, reads, color })` → `glyphs` (typed arrays),
  `targets`, `near`, `hit` (+ `t`), `consume`, `refresh`, `reads`, `system`. Geometry measured in the
  read phase only, Range reads capped per refresh (900), 12.5 Hz while the page moves and 2 Hz once
  still, indexed with collide `Grid`; `consume` writes 0/1 into the page's own Text node through
  the ledger (queued from a step, written in render; seeded bits). Budget 4 KB gzip: 3.8 KB measured
  with Grid (3.4 KB on the Grid before 0.4.1's hardening, which adds 379 B here). Browser tests: index, near/hit, consume, erase, no layout reads in step,
  rescan, host edit wins, byte-for-byte Recall, read cap, steady-state allocation, scroll.

## 0.4.3

- **`fizlet/match`**: the match flow every board shares (layer 11): intro → count → play → paused →
  end on the Board UI kit's overlay, built once and flipped through the ledger. Esc / P pause and
  resume, a hidden tab during play shows the pause overlay, SURRENDER runs the white-flag ritual and
  the launch burst (pass `launch` from `fizlet/ui`), REMATCH and NEW GAME. The clock counts in the
  step without allocating; every transition is an event on the ring (`match:play`, `match:won`, …).
  Siblings go `inert` while an overlay is up, focus moves to the primary key and back, reduced
  motion skips the waits. Runs headless with a `null` root. Node tests (phases, clock, events,
  restart, zero allocation against a bare engine) and a browser test (overlays, keys, Escape,
  hidden tab, surrender, reduced motion, Recall restores the DOM exactly).

## 0.4.2

- tests: the fx live-scene and input allocation checks use `tests/gc.mjs` (best of 3 windows); they had lost their `perf_hooks` import when the GC helper landed, which only failed when a GC actually ran.

Hardening from the engineering review of 0.2.4 (input, sound, embed); each item has a regression
test in `tests/browser.mjs`.
- `fizlet/input`:
  - Several keys per intent: releasing one of two held keys (A and ArrowLeft) keeps the intent
    down. Auto-repeat keydowns are not new presses.
  - The pointer and the stick let go on a release outside the target, on `pointercancel` anywhere
    and on `lostpointercapture` (they stayed down before).
  - Multitouch: the pointer and the stick each follow their own pointer id; the stick finger no
    longer moves `pointer.x/y`.
  - Pause and destroy drop held keys, `press()` holds, the pointer and the stick (only window blur
    did); no ghost press on resume.
  - `hit` / `pointer.hit` in a step: a press is seen by exactly one step, the first after it. It
    was lost when the latching frame ran 0 steps, and seen by every step of a frame that ran
    several. Outside a step it stays "the frame that latched it", as before.
  - `dispose()`: remove one controller (listeners, system, held state) without destroying the engine.
  - Pointer events no longer call `getBoundingClientRect` (one forced layout per event when the page
    had pending style changes: 2,000 pointermoves on a 3,000-paragraph page took 3.8 s, now 9 ms in
    Chromium). The read phase measures the target once per frame when the pointer moved.
- `fizlet/sound`:
  - A custom `play` installs no AudioContext and no unlock listeners.
  - While switched off, gestures no longer resume a suspended context; switched on, any later
    trusted gesture resumes one the browser or OS suspended. `pointerup` also unlocks (touch grants
    the gesture on release).
  - `dispose()`: remove the sound provider (listeners, system, close its context) while the engine runs.
- `fizlet/embed`: `close()` during a pending lazy load cancels it (the game no longer mounts after
  being closed); Escape cancels a pending load too, and a later `open()` starts a fresh one.
- Kernel: systems can have a `pause(engine)` hook (called when a running engine pauses), and
  `engine.steps` (fixed steps run, an integer: reading it in a hot path never boxes).

## 0.4.1

Hardening from the engineering review (2026-10-29, §8: UI and tokens, collision and effects).

- pack smoke test: data subpaths (`.css`, `.json`) resolve instead of importing.
- ui: `mount()` keys its shared constructed stylesheet by the CSS text. It cached the first sheet
  for the whole page, so a second game mounted with different CSS got the first game's styles.
  Stylesheet ownership is documented (BOARD-UI.md 2.1). No visual change.
- ui: `tokens.json` is the authoritative token source. Published as `fizlet/ui/tokens.json`; the
  build fails when a `board-ui.css` default or `applyPalette`'s variable map disagrees with it
  (`scripts/tokens.mjs`, tested). `board-ui.css` is byte-identical.
- collide: `Grid` separates entity capacity (`cap`), index capacity (new 5th argument `nodes`,
  default `cap * 4`) and query-result capacity (`out`), and every saturation is counted:
  `dropped` (index full; now counts every refused cell entry), `rejected` (id outside `0..cap-1`
  or a non-finite circle; such ids used to alias the dedupe stamps), `truncated` and `missed`
  (query results that did not fit; they used to vanish silently). The constructor and `resize`
  throw a `RangeError` on non-finite sizes or non-integer capacities.
- collide: `add`, `near`, `insert` and `query` pass numbers through a typed array, so the grid
  allocates nothing even when V8 does not inline it (the mixed collide + fx test went from ~24
  young GCs per 200k frames to 0; its allowance drops from 100 to 1).
- fx: `blast()` stops at capacity instead of attempting every particle on a full pool (10 blasts
  of power 1e6 on a full pool: ~4.7 s before, ~0 ms now), and counts refused particles in
  `fx.dropped`. `effects()` validates `cap`, `scorch` (0 now turns scorch marks off) and the
  colour and word tables; `spawn`, `blast` and `kick` refuse non-finite input (a NaN life used to
  hold a pool slot forever).
- fx: no allocation in a live scene. `blast()` allocated on every call (Math.random returns a new
  heap number); the visual random is now a private generator seeded from Math.random (still never
  the simulation's seeded random) and blast writes the pool directly. Same recipe, same
  distributions.
- tests: the allocation test runs a populated fx scene (blasts every frame window, the pool full,
  drops counted) and asserts no young-generation GC; new regression tests for every item above,
  and a browser test for two games mounting different CSS.
- README: the overload policy (decorative particles may drop, counted; collision results never
  drop silently).

## 0.4.0

- **presence** brick (`fizlet/presence`, 1.8 KB gzip): lockstep input exchange on the seeded,
  fixed-step kernel. Inputs are sent `delay` frames ahead into fixed typed-array rings; a frame
  runs only when every player's input is in (it waits, never guesses); state hashes are exchanged to
  catch a desync. Transports behind a 3-method adapter: `memory()` (bounded, latency + jitter, for
  tests) and `websocket()` / `join(url)`.
- `fizlet/presence/check`: `syncCheck(setup, opts)`, the determinism check as a function. It runs a
  game's sim as N lockstep clients and returns pass/fail plus the first divergent frame.
- `rooms/`: a room server prototype (Cloudflare Worker + Durable Object, hibernating WebSockets)
  that seats players, hands out one seed and relays inputs. Its own package; not deployed.

## 0.3.6

- `fizlet/hud`: change-only, allocation-free HUD bindings fed by the event ring. `hud(engine, root)`
  → `num` (int, clock, rank, pct or your own format), `meter` (width %, `aria-valuenow`, `low`),
  `flag` (class), `feed` (last N events of a type, newest first) and `banner` (title + sub on an
  event). Values compare as numbers and write only when the shown value changes; formatted strings
  are cached; every write goes through the ledger. Tests: 1M renders with unchanged values cause no
  young GC and no DOM write; 0 mutations over 120 idle frames in Chromium; destroy restores exactly.

## 0.3.5

### Fixed

- kernel: the root's `IntersectionObserver` is disconnected on `destroy()` and when the parent
  `signal` aborts, before or after `start()`. Its abort listener was tied to the same signal, so
  the browser removed it before it could run.
- kernel: starting, stopping or destroying engines from inside a hook no longer asks for a second
  `requestAnimationFrame` or skips the next engine's frame, and a restarted engine runs once per
  frame, not twice.
- kernel: `engine.remove(system)` inside a hook no longer skips the next system's hooks that frame.
- kernel: a hook that throws no longer stops the shared clock for every engine on the page. Only
  that engine stops (`paused: ["stopped"]`, `start()` resumes); the error goes to the new
  `onError(error, engine)` option, or `console.error`.
- kernel: `destroy()` is idempotent and leaves the engine inert: `advance`, `add` and `start` do
  nothing, and a destroy from inside a step runs no more steps that frame.

### Changed

- kernel: options are validated at setup. `step` must be a finite number > 0, `seed` finite,
  `maxSteps`, `events` and pool caps positive integers (`new EventRing` and `new Pool` too); a bad
  value throws a `RangeError` that names it. Kernel size 2839 → 3106 bytes gzip (budget 4096).

## 0.3.4

- `fizlet/pad`: a touch tap's `click` (some Chromium builds report it with `detail` 0, like a keyboard
  press) no longer flips a toggle key back off. Regression test added; this was red on `main` in CI.
- CI: failing lines from check, browser and site tests are echoed as annotations, so they can be read
  through the API.

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
