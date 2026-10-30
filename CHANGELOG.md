# Changelog

## Unreleased

- **Perf: the demo's blasts are back to 60 fps at 4× CPU throttle** (30 fps since 0.10.1). Bisected
  to 1337112 (the layers story in the home page hero): scrolled off screen, its scene kept about 50
  composited 3D layers, and Chromium layerizes the whole document on every frame that repaints, so
  each blast frame paid 8.4–11.7 ms of `Layerize` for a scene nobody could see. `fizlet/slot`'s
  stage is now `content-visibility: auto` (a scene off screen is skipped for style, layout, paint and
  layers), and so is the layers figure (its slider's eight 3D plates sit outside the stage).
  Measured (`npm run perf`, Chromium 153, 4× throttle, 10 s, a busy 4-core Xeon): before p50
  33.3–33.4 ms, 47–61% dropped, `Layerize` 10.6–11.4 ms per frame; after p50 16.7 ms, 24–32%
  dropped, `Layerize` 1.6–1.7 ms (0.4.4: 1.5–1.8). Size: `fizlet/slot` 1,845 B gzip (budget
  2,048); layers live chunk 9,720 B (≤ 9,728; the
  13 B the slot adds are paid for in the scene, which now makes its fx canvas directly instead of
  through a `canvas` branch in its element helper). The harness now reports `layerizeMs`, and
  `tests/perf/budgets.json` fails the demo on this regression: p50 ≤ 25 ms, p95 ≤ 67, ≤ 45%
  dropped, `layerizeMs` ≤ 4.
- **board-page runs in its root's own document and window.** `boardPage(e, { root })` now measures,
  observes and writes in `root.ownerDocument` (its viewport, `getComputedStyle`, observers, scroll
  and resize, highlights), so a board inside an iframe's page works. Before, it always used the
  global `document` and window. Swarm Protocol needs this: its API runs in the document it is given.
- **The ledger's Recall normalises style text in the element's own document**, not the global one,
  so restoring an element in another document (or with no global `document`) works.
- **`fizlet/perf`: the card pins `box-sizing: content-box`.** Its inline width (120px plus
  padding) assumed content-box, so on a page with a global `* { box-sizing: border-box }` (the
  DOM VIRUS hub and DOM Battlefield both) its right column clipped. Node test asserts it.
- **Website: a size badge on every live demo** ("9.4 KB GZ"): the layers hero, the blast board,
  the fizz can, the quick start, each brick page's demo and every gallery entry. The number is what that demo ships,
  gzipped, with every chunk it imports statically (`scripts/live-bytes.mjs`), measured on the built
  file at build time and never typed; kit tokens only; screen readers get the whole description
  as one (`role="img"` + `aria-label`, no extra CSS needed) and the tooltip has the byte count. One component for all of them: `sizeBadge(bytes, live, what)` in `site/size-badge.mjs`
  (it replaces the gallery's `{ name, note }` form; one `.size-badge` style). A module's own size
  names its `scripts/sizes.mjs` entry instead of a file (`"size:fizlet (kernel)"`, the notes' kernel badge).
  `tests/site.mjs` fails if a live demo has no badge, if a badge's bytes differ from a fresh
  measurement of the file it names, or if it is hidden. The demos' own standalone pages
  (`demos/fizz/`, `examples/fizz/`) have none on their demo yet; they are listed in the test. The
  layers story page shows its badge in the caption, through the same component.
- **The fizz, dialled in** (the brand animation, `site/demos/fizz/`). A tap **crunches** the can
  (it squashes and dents, and stays dented), then the tab pops. The fizz **sprays out of the
  card**: a geyser, a burst and a glug fly on a pixel layer the card's width, reaching from 70% of
  the card's height above it down to its bottom (no pointer), so the top of the spray is no longer
  cropped. The card shows the **side view and a top-down view** of the same moment, looking into
  the can as the tab opens and it fizzes (22 × 22 sprite pixels from the same tokens). The
  full-page zoom is gone: `fizlet/camera` moves only the inside of the card, in on the opening,
  across to the top view while it fizzes, then home. Headline "Crack the can. / *Hear the fizz.*";
  CAM 1 · SIDE / CAM 2 · TOP labels on the card (HTML, not in the chunk).
  - Bytes: the scene draws `spriteURL` frames (each rasterised once into a bitmap, so no SVG work
    per frame) instead of the whole `sprites()` cache. Scene and loader are two files with no
    shared chunk (a split cost ~260 B). The story state is plain locals. To fit, the screen shake,
    the third pop word, the slow bubbles, a second drip and the drip's fall off the base went (it
    runs down the side and splashes at the floor).
  - Measured (Chromium 153, 4× CPU throttle): live chunk **9,701 B** gzip (5.3% under 10,240),
    loader 2,023 B, poster 3,457 B; script per frame 1.3 ms avg, 4.0 ms p95, 18.2 ms max; 0 frames
    settled, offscreen and with reduced motion; CLS from the slot 0. `tests/fizz.mjs`: the spray
    leaves the card, and the camera moves the card, never the page.
- **Layers story: controls** (owner feedback). A play/pause key (the kit's arcade key) on one side
  and a 3D slider on the other that scrubs the explode/assemble timeline: vertical down the right
  edge when the slot is wide, along the bottom when it is tall. The slider is a small copy of the
  stack (eight tilted plates on a kit rail, collision in green) that fans out as the real one does,
  with the kit's arcade key as its knob. `role="slider"`: arrows, Page Up/Down, Home/End, touch and
  mouse drag, the kit's focus ring. Scrubbing pauses; play resumes from that pose; paused, it
  settles (0 frames). Reduced motion: the play key is hidden and the scene never loads, but the
  slider still scrubs the still view (the poster is posed by one CSS variable, `--e`). One writer
  at a time: the inline controller before the scene loads, the scene (through its ledger) once it
  is mounted, so Recall restores the controls exactly. The figure is now labelled and described
  (`aria-describedby`) instead of `role="img"`, so its controls stay reachable. The HUD's clock,
  the tank hit flash, the scene's hex fallbacks for kit tokens (the figure is always a `.bui` root
  with `board-ui.css`) and its `data-settle` option went to keep the live chunk ≥ 5% under budget on
  0.15.0's bricks: 9,713 B gzip (≤ 9,728); poster, controls and inline script 5,258 B (budget 6 KB). The demo page shows the live chunk on
  the size badge (`site/size-badge.mjs`). Tests: the controls with the scene (pause settles, keys,
  pointer, play, Recall) and under reduced motion (keys, pointer); the budget test now fails above
  9,728 B.
- **Layers story: clean labels at every size** (owner feedback: "at the end the layer labels get
  a little jumbled"). Four causes, each fixed:
  - while the fix phase dimmed the other layers, `opacity` on a `preserve-3d` layer flattened it,
    so its label lost its counter-rotation and smeared into the layer's plane; the scene now dims
    a layer's children, never the layer;
  - the scene's state classes (`o`, `f`, `b`, `k`) could match a host page's CSS: the demo page's
    `.k` kicker stretched every label for the patched phase. Now `lz--o`, `lz--f`, `lz--b`, `lz--k`;
  - labels faded with the open amount, so they slid together and ran off the edge as the stack
    folded; they now show only while the stack is fully open (in after it opens, out before the
    fold starts);
  - the exploded gap was fixed, so on narrow slots labels sat closer than their height. The gap now
    widens to keep a 28px label pitch on screen, and the scene measures its widest label at mount
    (one layout read), so a wide fallback monospace no longer clips. The reduced-motion poster gets
    the same pitch rule in CSS.
  New browser test: through one full cycle at 390 and 1440, every visible label faces the screen,
  stays inside the figure and overlaps no other (fails on 0.10.0). Measured (Chromium 153, 4× CPU
  throttle): live chunk 9,609 → 9,717 B gzip (still ≥ 5% under 10 KB), poster + loader 2,962 →
  3,153 B; script per frame 0.8 ms median, 3.1 ms p95; CLS 0; 0 frames settled.
- **Website: notes (`/notes/`)**, posts written for fizlet.com from `site/notes/<slug>.json` (generated, never hand-edited), on the site's own parts: section head, panels, stat cards, kit keys, and the kernel's size badge measured on the build. BlogPosting + FAQPage JSON-LD; listed in the sitemap and under Notes in llms.txt. First note: "Moving the games onto a 4 KB kernel" (every number from the size ledger and this changelog).
- **`fizlet/steer`** (new brick, 950 B gzip, budget 1,280): `seek`, `flee`, `arrive`, `wander` and
  `patrol` for movers on typed arrays (position, heading, wander goal, patrol leg), DOM-free. The
  heading turns at most `turn` rad/s and walls are checked per axis, like DOM Battlefield Blitz's tank
  `drive`; its defaults are Blitz's numbers. A test runs `wander`, `seek` and `arrive` frame by frame
  against Blitz's practice movers, bots and wingmen (same seed, same walls: identical positions and
  headings). `flee` and `patrol` are the same drive pointed away from a point, or along a route. No
  allocation per frame across 1M frames with 16 movers: it ships its own `hypot` (the same bits as
  `Math.hypot`, tested), because V8 boxes `Math.hypot`'s arguments, and `blocked(i, at)` gets the
  spot in a typed array for the same reason.
- **`fizlet/coach`** (new brick, 1,192 B gzip, budget 1,536): the hints and tutorial layer of DOM
  Battlefield and Blitz. `flag(key, value)` is a once-only localStorage switch whose reads and
  writes are each wrapped in try/catch (blocked storage reads "not set"). `tour(engine)` runs the
  tutorial steps, then cycles tips, says `coach:step` on the ring, and allocates nothing per frame.
  `card(host)` is the Board UI coach card (DOM Battlefield's dashed card, on the kit tokens): it
  writes only what changed and rings the control it is about. Tests: `tour` frame by frame against
  Blitz's practice coach (steps, time on the step, the card shown, the power-up events), `flag`
  against Battlefield's tips switch (each reads what the other wrote; blocked and missing storage),
  and the card in Chromium.

## 0.16.0

- **`board-page.consume(i, "0" | "1")`**: the game picks the digit (its particle and event show the
  same one); `"binary"` still lets the board draw it.
- **`board-page.scans`**: how many rescans so far. A rescan renumbers glyph indices, so a game that
  keeps an index across frames (a bug's reserved letter) drops it when this moves.
- **Tests: the camera's reduced-motion check waits for frames, not 120 ms of wall time**, so slow CI
  runners no longer fail it.
- **Tests: zero-allocation checks no longer flake.** `match` and `rules` count young GCs with the
  shared best-of-3 helper (`tests/gc.mjs`) like every other check, and assert at most one over the
  bare engine (was three). `npm test` runs test files one at a time (`--test-concurrency=1`): with
  files in parallel, CPU contention delays V8's background compiler, and the HUD events check read
  14 young GCs instead of 3.

## 0.15.0

For page scenes in the gallery (`fe anim`'s second scene type: it reads the page's own elements):

- **`fizlet/board-page` `text: false`**: targets only, no glyphs indexed. **`still`**: seconds
  between re-measures while the page is still (default 0.5); `Infinity` re-measures only after a
  scroll, resize or change, so a still frame reads no layout.
- **`fizlet/board-page` reads its refresh clock from `engine.timing`** (a typed array), not the
  `time` getter: the getter returned a double and boxed a number every frame (12 B a frame in steady
  state, measured with the sampling heap profiler while time advances).
- **Kernel: the frame-time maximum is written every frame**, so a new maximum no longer deopts
  `advance()` (V8 had no feedback for a store that runs only on a new record).
- **Tests find Chromium by themselves** (`tests/chromium.mjs`): `CHROMIUM_PATH`, else
  `/opt/pw-browsers/chromium`, else Playwright's own; every browser test and the site test use it.
- **Website: gallery #006, "a scanline sweep that lights up every heading it passes".** Made by `fe
  anim` from the prompt (recipe sweep, a page scene that reads the page's own headings and writes
  only through the ledger; kernel + board-page + slot): live 8,852 B · total 10,752 B gzip (with the
  1,900 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: the gallery shows one size, both parts named**: the live chunk on the badge and the
  total with the shared loader beside it; #004 and #005 re-published (no byte numbers in the
  entries; the spray scene rains around a tap on an edge source).
- Size: kernel 3,413 B gzip (budget 4,096); `fizlet/board-page` 4,050 B (4,010 in 0.14.0, budget
  4,096); `fizlet/arcade` 17,246 B (budget 17,408).

## 0.14.1

- **Board UI: page keys press right (`.bui-key`, links and buttons).** On a mouse, a pressed link
  key stayed lifted: its hover rule outranked the press rule, so the face never dropped onto its
  base. Press now always beats hover. A click on the base (a box-shadow, which takes no pointer) or
  just under the top edge (which the dropping face leaves) missed the key; an invisible `::before`
  now covers face and base and stays put while the face travels. New `pressCue(root)` in
  `fizlet/ui`: Enter (and Space on a button) shows the pressed face, and iOS Safari applies
  `:active`. Disabled link keys (`aria-disabled="true"`), and a darker face as the press cue under
  reduced motion. The site's keys all wear `bui-key`; `tests/keys.mjs` presses every page key at
  its centre, top edge and base (mouse and keyboard at 1440, taps at 390). ui CSS 4,858 B gz
  (was 4,737), ui JS 2,887 B gz (was 2,745).

## 0.14.0

For Swarm Protocol's port onto the kernel (its own engine kept page-level hooks the bricks lacked):

- **Kernel `Ledger.unstyle(el, prop)`**: put one style property back now, as Recall would, and
  forget it (a later `style` records the value then as the new original). Hands off if the host
  changed it since our last write. Swarm drops a breached button's paint and a hit's wobble mid-round.
- **`fizlet/board-page` `letters: true`**: letters only (digits stay page text, not glyphs).
- **`board-page.char(i)`**: the letter glyph i was before the game changed it (a bite reports which
  letter it ate). **`board-page.parent(i)`**: the element that holds it, for a game's own
  read-phase checks (what covers it). Neither is for a step.
- Size: kernel 3,415 B gzip (budget 4,096); `fizlet/board-page` 4,043 B (3,960 in 0.13.0, budget
  4,096); `fizlet/arcade` 17,206 B (budget 17,408).

## 0.13.0

- **`fizlet/board-page`: hot-path forms `hitAt(p, i)` and `nearAt(p, i, out)`.** They take the
  segment (x0, y0, x1, y1) or the circle (x, y, r) from a typed array, and `hitAt` writes how far
  along the segment the glyph is into `p[i + 4]`. The reason: a number passed to a call V8 doesn't
  inline is boxed (one allocation), and a big game step stops V8 inlining `hit` and `near`. Sherman
  Bytes' step boxed four numbers per shell per step through `hit`; with `hitAt`, 20,000 busy steps
  make no minor GC (its test). `near` and `hit` are unchanged; inside, they now go through the
  grid's typed `near` too. Lesson K4: hot-path forms take typed arrays plus indices.
- Size: `fizlet/board-page` is 3,960 B gzip (3,841 in 0.12.1, budget 4,096); `fizlet/arcade` is 17,081 B
  (budget 17,408).
- **Website: gallery #005, "cyan and purple neon rain falls when you tap".** Made by `fe anim` from
  the prompt (recipe fall, an engine rain kind, kernel + fx + slot): 6,502 B gzip live chunk on this
  build, loaded only near the viewport, never under reduced motion; settles to zero frames.

## 0.12.1

- **`fizlet/arcade`: scoreboard keys keep their labels on one line.** The keys size to their labels
  and wrap as whole keys. Before, four keys shared one row, and "M · Refresh maze" broke onto three lines in
  Byte Runner. Three short keys (Null Invaders) still share one row.

## 0.12.0

- **`fizlet/arcade`: in-page art and keys-only games**, for Byte Runner and Sherman Bytes:
  - `ctx.attach(el)` gives a game a shadow root in an overlay inside a page element. The overlay
    follows the page's layout, scrolling and transforms natively (Byte Runner's maze is SVG in the
    page). A static element becomes relative. It goes through the ledger, so Recall removes it and
    restores the style.
  - `keyboard: true` means the mouse never steers.
  - Without `fire`, the first action is the big touch key.
- **`fizlet/board-page`: in-page art never makes the board rescan.** Mutations inside any
  `[data-fizlet-host]` count as the engine's own, like its root (before, a game redrawing SVG in the
  page made the board rescan).

## 0.11.0

- **`fizlet/arcade`** (new brick): the shell every page arcade game repeats (DOM VIRUS ENGINE.md E3),
  so Null Invaders, Byte Runner and Sherman Bytes share one instead of each carrying a copy. One
  engine per run over the page (`board-page`), an overlay canvas and a Board UI scoreboard (sound,
  pause, fold, exit, readouts, a meter, action keys, the comms toast), keys and pointer (`input`), the
  touch pad (`pad`), sound cues (`sound`), sparks and stacking popups, target health painted into the
  buttons through the ledger, and the controller a hub drives. Extracted from Null Invaders 1.0.0
  (null-invaders#4) with its review fixes: a failed start leaves nothing behind, Escape and P work
  after a run ends, the end of a run is read from the game (never from a ring that may drop events),
  G scrolls in render. 16,731 B gzip with every brick it composes (budget 17,408); its own code,
  markup and CSS 6,448 B. The Board UI kit CSS stays the game's (it bakes in the sections it uses).

## 0.10.1

- **`fizlet/rules` drops: per-drop age and landing spot.** `drops()` now exposes `age` (seconds since
  each drop spawned), `landY` (where it lands: `(x[i], landY[i])`, moved by `scroll`) and `life`,
  and emits `drop:land` once when a drop touches down. Blitz can draw its fall shadow, landing puff
  and blink from these instead of keeping its own spawn time per crate (dom-battlefield-blitz#4).
  Still no allocation per step; 1,264 → 1,318 B gzip (budget 1,536).
- **Website: the gallery (`gallery/`).** Every animation, newest first: the prompt (or, for the
  hand-built ones, the brief) it was made from, the live demo lazy-mounted through `fizlet/slot`
  (one shared loader; each entry's live chunk is its own bundle and loads only near the viewport,
  never under reduced motion, where the poster stays), and a size badge with that chunk's gzip
  bytes, measured by `scripts/gallery.mjs` on this build. Seeded with the fizz can, the layers
  story and the blast demo ("How it works"), plus the first animation made by the engine's
  `fe anim` from one prompt ("pink sparks burst where you tap": the spray scene,
  `site/gallery/scenes/spray.ts`, kernel + fx, settles to zero frames). Entries are data
  (`site/gallery/entries/*.json`). New shared `site/size-badge.mjs`; `site/demo.ts` exports
  `run()` and the home page's blast figure is `playFigure()`, so the gallery can mount it.
  `tests/site.mjs`: order, a measured badge and the prompt on every entry, each demo mounts
  only near the screen, a spray draws on a tap, reduced motion loads no scene.
- **Website: one page per brick, generated from the source.** `bricks/<id>.html` for the kernel
  and every brick (input, pad, collide, grid, fx, sprite, sound, embed, slot, hud, match,
  board-page, presence, ui, perf, rules, camera, debug) plus a bricks index. Each page has the module's summary (its
  leading comment), every export with its doc comment (read from the built `.d.ts` by
  `scripts/api.mjs`), the gzip size measured by `scripts/sizes.mjs`, ESM imports from the hosted
  `dist/`, and npm marked coming soon. Live demos where cheap: kernel settle (the frame count stops
  once the puck does), fx, grid (A* on a seeded board), sprite and sound; each loads only its own
  chunk. `tests/api.test.mjs`: the catalog covers every public module in `package.json`, each page
  lists every runtime export, the page shows the measured bytes.
- **Home:** the bricks section comes from the same catalog and links to each page; a page profile
  section explains settle, the fps cap and slot with the measured page-build size; "by Chris
  Cooley" links to coded.design; `npm install` is marked coming soon (here and in the README);
  the roadmap reflects the shipped bricks; Blitz's unmeasured "~17 KB" claim is gone. The hero
  is the layers story (Blitz as a stack of bricks: its poster, CSS and loader from
  `site/demos/layers/poster.ts`, the live chunk loading only near the viewport); the blast demo
  moves to its own "Blast it. Recall it." section below it. A "The name" section tells the origin
  story (-let from applet, fiz from the soda-commercial fizz, DOM VIRUS first) with the fizz can
  live in it (the figure and poster from the fizz build). Each links to its own demo page; the
  sizes shown are the ones their builds measure. `npm run site` now runs both demo builds.
- **SEO and accessibility gates** (`scripts/check-html.mjs`, run by `npm run test:site` on every
  built page): one title and description of sane length, canonical and `og:url` equal to the
  page's URL, Open Graph tags (a generated `og.png`, PNG-encoded with `node:zlib`), lang, one
  `h1`, one `main` plus header, nav and footer landmarks, no skipped heading levels, unique ids,
  alt on every image, every svg and canvas hidden or named, every link and button named. A
  `sitemap.xml` lists every page. The demos' own standalone pages (`demos/fizz/`, `demos/layers/`,
  `examples/fizz/`) are gated too, with their open gaps listed exactly in `tests/site.mjs`. Kernel lead comment rewritten (it is the kernel page's summary);
  no code or size change.

## 0.10.0

- **Both heroes 5% under the 10 KB live budget** (fizlet-engine docs/LAYERS.md), by making bricks
  leave out what a page doesn't call:
  - Layers story: live chunk 10,230 → 9,616 B gzip (6.1% under). It places its tanks as SVG
    backgrounds, so it now imports `spriteURL` instead of all of `fizlet/sprite`.
  - Fizz: live chunk 10,100 → 9,725 B gzip (5.0% under). It takes `BUBBLE` alone, the camera
    helpers it doesn't use stay out, and it uses the default camera ease (7: ~0.9 s in, like the
    original curve).
  - Measured (Chromium 153, 4× CPU throttle). Fizz: script per frame 1.0 ms avg, 3.7 ms p95,
    16.8 ms max (was 1.1 / 4.1 / 22.4). Layers: p50 1.0, p95 3.2, max 8.8 ms (0.8.1 measured 0.8 /
    2.6 / 6.3). Both: 0 frames once settled, CLS 0 from the slot.
- **Breaking (`fizlet/sprite`):** `sprites().svg()` / `.url()` are now the standalone
  `spriteSVG(def, frame, palettes, palette)` / `spriteURL(...)`, the same output. A canvas scene no
  longer ships the SVG writer, and an SVG-only page never ships the canvas cache.
- **Breaking (`fizlet/camera`, new in 0.9.0):** `zoomAt(cam, …)`, `flyTo(cam, …)`, `fit(cam, …)` and
  `toScreen(cam, …)` are standalone exports, and `snap()` is gone (use `motion: false`). New
  `cam.width` / `cam.height`. `flyTo`'s zoom now defaults to the current zoom.
- **fx:** the built-in kinds are also separate consts (`BUBBLE`, `SPARK`, `DRIP`, `DEBRIS_KIND`), so
  taking one ships only that one; `KINDS` still groups all four. A turned particle now draws with
  one save/restore, and an unturned one with none.

## 0.9.0

- **`fizlet/camera`** (new, 1,330 B gzip, budget 1,536): the page is the camera. `camera(engine, el)`
  pans and zooms a DOM stage with one transform written through the ledger (Recall exact, even
  mid-move). `zoomAt`, `flyTo`, `fit`, `pan`, `home`, `snap`, `toWorld` / `toScreen` (into a caller's
  array). Moves ease (`ease`, per second) and land exactly on the target, then the engine settles;
  with reduced motion every move jumps. `contain` (default on) keeps the stage over its own box and
  clips its parent while moved, so the page never scrolls sideways. Zoom limits `min` / `max`. No
  allocation per step (tests/camera.test.mjs); Chromium: tests/camera.mjs (in `test:browser`).
- **fx: gravity and named particle kinds as data.** `effects({ gravity })` (px/s², settable), and each
  kind takes its own share (the blast's debris falls; its other parts don't). `emitter(fx, KINDS)`
  registers kinds (shape, drag, gravity, angle, spread, speed, size, life) and `emit(id, x, y, n, c,
  cn, scale)` sprays them: built-in `bubble`, `spark`, `drip`, `debris`, or your own (up to 26 per
  pool). Capacity-bounded (a full pool counts the rest in `dropped` without looping) and zero
  allocation (tests/bricks.test.mjs). New shape `streak`. `emitter` and `KINDS` tree-shake away when
  unused: `effects()` alone is 2,1xx B in the page build (7,029 / 7,168 B; was 6,859). The whole
  module is 2,758 B (budget raised 2,048 → 3,072 for `emitter`).
- **Fizz demo on camera + fx kinds:** the hand-rolled zoom (origin, ease curve, ledger writes) is
  now `fizlet/camera`; the spray, bubble and splash loops are three `emit()` calls on kinds as data;
  drips fall under the pool's gravity. Scene source 8,422 → 8,220 B (180 → 175 lines). Live chunk
  8,400 → 10,100 B gzip (+camera; still ≤ 10 KB). Measured (Chromium 153, 4× CPU throttle): script
  per frame 1.2 → 1.1 ms avg, p95 4.0 → 4.1 ms, max 25.3 → 22.4 ms; 0 frames settled, offscreen and
  with reduced motion; CLS from the slot 0. The layers story's live chunk is 10,230 B (≤ 10,240).

## 0.8.2

- **Layers story fits the hero budget** (fizlet-engine docs/LAYERS.md): live chunk 12,621 →
  10,054 B gzip (≤ 10 KB), and 0 B of JS before the slot nears the viewport (was 1,957 B). The
  tanks patrol fixed loops instead of searching paths, so the hero drops `fizlet/grid`; a ~300 B
  inline loader imports one `layers.js` (slot + scene) when the slot is near (never with reduced
  motion); the scene's state styles moved to the page CSS. Measured (Chromium 153, 4× CPU
  throttle): script per frame 0.8 ms median, 2.6 ms p95; poster + loader inline 2,962 B; CLS 0;
  0 frames once settled. `npm run test:layers` now also checks the loader and fails over budget.

## 0.8.1

- **Layers story** (`site/demos/layers/`, `examples/layers/`): a landing-page graphic. A Battlefield
  Blitz-style board plays, turns and fans out into eight DOM layers in CSS 3D (board grid,
  characters, movement, collision, rules, effects, input, HUD), each labelled with Blitz's measured
  bytes for that layer (layer manifest, Blitz c8c8ca4). The collision layer faults red, a scan
  patches it, it flashes green, and the stack folds back into the game. Built on the kernel (30 fps
  cap, settle), `grid`, `sprite` and `fx`; mounted through `fizlet/slot`. It wears the Board UI kit:
  kit tokens for every colour, the kit's arcade fire key, a `.bui` root (hosts load `board-ui.css`). After 3 cycles it rests on
  the game frame and settles; reduced motion keeps a CSS-only still exploded view with labels.
  Measured (Chromium 153, 4× CPU throttle): script per frame 0.9 ms median, 4.5 ms p95; live chunk
  12,621 B gzip (over the 10 KB hero budget), poster 2,560 B; CLS 0; 0 frames once settled. New
  `npm run test:layers` (in CI): mounts, cycles once, settles, Recall is exact, reduced motion.

## 0.8.0

- **`fizlet/ui` readouts:** DOM Battlefield's metrics row (ARMOR · FRIENDLY · HOSTILE · ELAPSED) as a kit part, `.bui-readouts` / `.bui-readout`.
  - A muted caps label over a 20u tabular value.
  - `data-tone="team|enemy"` tints the value from the palette.
  - `.bui-on-map` gives the phone cockpit's flat see-through plate.
  - The `readouts(parent, items, onMap)` helper returns the value elements for `fizlet/hud`.
  - BOARD-UI.md section 18; the browser test renders it with the real kit CSS.
  - ui js 2,446 → 2,574 B gzip; ui css 4,602 → 4,737 B (budgets 3,072 / 5,120). No new tokens.

## 0.7.0

- **`fizlet/perf`**, the players' performance overlay (new brick, its own import rather than part
  of the dev-only `fizlet/debug`, which patches Element prototypes and must never ship).
  `perf(engine, { host, corner, key, on, budget, change })` → `{ el, show(on?), destroy, ... }`:
  live fps, a 120-frame bar chart on one canvas (go / hurt / critical against the frame budget),
  dropped frames, the engine's work per frame, live pooled entities and the JS heap where Chromium
  exposes it. Off by default; F9 toggles it. Typed-array ring, numbers twice a second from
  typed-array slots into cached strings through the ledger: no allocation per frame, shown or
  hidden. Never keeps a settling engine awake. Board UI tokens inline (works without the kit CSS),
  `contain: layout paint style`, `aria-hidden` while hidden, Recall exact. 1,947 B gzip (budget
  2,048: the logic is ~1.5 KB, the inline token styles ~0.45 KB).
- kernel: `engine.timing`, a `Float64Array` view of this frame (`[0]` the shared clock's delta in
  seconds, `[1]` ms the last finished frame's hooks took, the number `stats().frameMs` averages,
  no extra clock read), and `engine.live`, pooled things in use over every pool. Slots, not
  getters, so a reader never boxes a number. Kernel 3,275 → 3,347 B gzip.
- `fizlet/ui`: `setting(button, key, change, signal)`, a Settings switch on a kit key
  (`aria-pressed`) that persists `"1"` / `"0"` in localStorage, wrapped in try/catch, and
  `PERF_KEY` (`"dom-virus:perf"`, also in `tokens.json` storage). 2,446 → 2,624 B gzip.
- Tests: Node (ring, fps and dropped-frame math, `timing` / `live`, show/hide and the key through
  the ledger, 200k shown frames with at most 1 young GC); Chromium (off by default, the Settings
  switch and F9 kept in step and persisted, storage that throws, the chart moves with real frames,
  settles with the engine with no dropped-frame burst on wake, no layout reads in a step, Recall
  byte for byte, `destroy()` alone).

## 0.6.1

- **The fizz demo** (`site/demos/fizz/`, live at `demos/fizz/`; host-page example in
  `examples/fizz/`), the proof piece behind the name: an 80s arcade soda can whose tab pops (on
  load or on a tap), fizz sprays from the opening, a drip runs down the side, and the page itself
  zooms in on it. Built from the kernel (`settle` + `fps: 30`), `fizlet/fx` and `fizlet/sprite`
  only, mounted through `fizlet/slot`. The zoom is one `transform` on a host element
  (`[data-fizz-zoom]`) written through the engine's ledger, so Recall gives it back. Reduced
  motion: the scene never loads; the poster (the same sprite pixels as an SVG) is the still frame.
  Measured (`site/demos/fizz/measure.mjs`, Chromium 153): live chunk 8,400 B gzip, loader 2,105 B,
  poster 1,989 B; script per frame at 4× CPU throttle 1.2 ms avg, 4.0 ms p95, 25.3 ms max; 0 frames
  once settled, offscreen or with reduced motion; layout shift from the slot 0; the scene loads
  only once the slot is near. New browser test `tests/fizz.mjs` (in `test:browser`): mounts,
  animates, zooms, settles, wakes on a tap, Recall byte for byte, reduced motion still.
  Brick gaps found: `fizlet/fx` exports no particle kinds and has no constant force (buoyancy or
  gravity), so the demo uses raw kind numbers and drag-only spray; there is no `camera` brick yet,
  so the zoom is done in the demo.

## 0.6.0

- **`fizlet/rules`** (new brick, 1,264 B gzip, budget 1,536): `waves`, `drops` and `score`, the
  rules every arcade game repeats, as DOM-free systems that step without allocating and report on
  the event ring (`wave:start`, `wave:clear`, `drop:spawn`, `drop:collect`, `drop:expire`, `score`,
  `combo:end`, `level`). Defaults are the DOM VIRUS core's WaveDirector and SupplyDrops numbers and
  Null Invaders' combo, so a port keeps its feel; a test runs `waves` frame by frame against the
  core's WaveDirector and they match. Rules is the biggest layer in the games measured so far
  (42,076 B gzip of game code across eight builds). No version bump.

## 0.5.1

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

## 0.5.0

The page profile for heroes and interactive diagrams (fizlet-engine docs/LAYERS.md, "Page
interactions"; lab audit docs/audit-heroes.md: idle CPU while visible was the hero's real cost).

- kernel: `settle` option. Systems call `engine.busy()` while something moves; after `settle`
  seconds without it the engine sleeps (`paused: ["settled"]`, no requestAnimationFrame at all)
  until `engine.wake()`, its `controls` input (keys, pointer down/move) or `start()`. Not a pause:
  `pause` hooks don't run. `fps` option: a frame-rate cap on the shared clock. Both off by default;
  kernel 3106 → 3275 B gzip.
- slot: waits for an idle main thread once near the viewport (`idle`, default 1000 ms). A tap on
  the slot before the scene is up loads it at once and reaches `mount(stage, slot, first)` as
  `{ x, y, at }`, never as the stale PointerEvent (the DOM VIRUS hero threw on `setPointerCapture`
  for exactly this). Slot 1767 B gzip.
- Page build budget: kernel + slot + input + fx ≤ 7 KB gzip (6,792 B), leaving a 10 KB hero chunk
  ≥ 3 KB for the scene. `tests/page.test.mjs` fails if a game-only brick gets into it.
- Tests: settle (sleeps, no rAF, no pause hooks, wake and start), fps cap (30 on a 60 Hz clock),
  and in Chromium the idle wait, the first tap and a key waking a settled engine.

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
