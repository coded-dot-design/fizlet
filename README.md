# Fizlet

By [Chris Cooley](https://coded.design/). **Tiny physics for your page.** A micro game and animation engine for the DOM: one shared loop,
bounded everything, zero allocation in the steady state, and the page always comes back exactly as
it was. No runtime dependencies, ever.

**Website, live demo and quick start: https://coded-dot-design.github.io/fizlet/**

The "fiz" is fizz (the pop of an effect) and a nod to physics; the "-let" is small, like an applet.
Fizlet runs every DOM VIRUS game: Battlefield Blitz, [DOM Battlefield](https://coded-dot-design.github.io/dom-battlefield/)
1.0, and the [DOM VIRUS](https://coded-dot-design.github.io/dom-virus/) arcade (Null Invaders,
Byte Runner and Sherman Bytes 1.0, Swarm Protocol 1.4).

> **Public beta (0.x).** Fizlet 0.x is a public beta: every brick carries a status flag, and a 0.x
> minor release may change a BETA brick's API (the CHANGELOG says how). COMPLETE bricks keep
> theirs. The flags and what earns each are under [Status flags](#status-flags).

## Install

```sh
npm install fizlet   # coming soon: not published yet
```

Until the first npm release, use the hosted builds or build from source (`npm ci && npm run build`
gives you `dist/` with the subpath exports). One package, one import per piece (`fizlet`, `fizlet/fx`, `fizlet/slot`, ...): you ship only what
you import. ES modules with TypeScript types; no runtime dependencies. No npm? The site hosts the
same builds (see the [quick start](https://coded-dot-design.github.io/fizlet/)).

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
3. **Zero steady-state allocation.** Measured: 1M kernel steps of a busy system cause 0
   young-generation GCs on Node 24 (best of three windows; the test fails above 1); each brick
   alone allocates nothing. Hot-path tip: pass typed arrays and indices (`grid.add`, `grid.near`,
   `overlap`) rather than many numbers, so V8 never boxes them in big step functions.
4. **No layout reads in the step.** Read in `read`, simulate in `step`, write in `render`.
   `fizlet/debug` counts any layout read made during a step.
5. **Change-only writes.** The ledger skips writes that change nothing.
6. **Pause by default.** Hidden tab, page leaving, root off screen, typing in the host's own fields
   (reduced motion is opt-in). Zero CPU while paused.
7. **Own nothing you can't give back.** Every page change goes through the ledger; `destroy()`
   restores it exactly, and a newer edit by the host page always wins. One `AbortSignal` removes
   every listener and observer.
8. **Embed-safe.** No globals, no global styles, many engines per page. Every root Fizlet owns is
   CSS-contained: the slot stage `contain: strict`; the pad, the match overlay and the launch burst
   `contain: layout style` (each is already positioned, so nothing moves or clips: a browser test
   compares every box inside with containment on and off); the `fizlet/ui` mount root
   `contain: style` (it is static, so layout or paint containment could move or clip a board's own
   layers). `hud` and `board-page` own no box: they write into the host's markup and never add
   containment to it.
9. **Budgets in CI.** Kernel ≤ 4 KB gzip (measured: 3,443 bytes); each brick has its own budget,
   1.5 to 5 KB, and a page build (kernel + slot + input + fx) ≤ 7 KB (`scripts/sizes.mjs`); over
   budget, the build fails.

## What's in the box

Sizes as `npm run size` measures them on this build: minified + gzip, everything an import pulls
in included, 1 KB = 1024 bytes.

| Import | Status | What | Size (min + gzip) |
|---|---|---|---|
| `fizlet` / `fizlet/kernel` | COMPLETE | `createEngine`, scheduler, `Pool`, `EventRing`, `Ledger`, `seeded` | 3.4 KB |
| `fizlet/debug` | COMPLETE | `guardLayout(engine)`: counts layout reads during a step (dev only) | 0.5 KB |
| `fizlet/perf` | COMPLETE | `perf(engine, { host, corner })`: the players' performance overlay (off by default): fps, a frame-time bar chart, dropped frames, engine work, live entities, JS heap | 1.9 KB |
| `fizlet/input` | COMPLETE | `controls(engine, { keys, stick })`: intents (`down`, `hit`, `axis`), pointer, touch stick, on-screen `press` / `steer`, `dispose` | 1.3 KB |
| `fizlet/pad` | COMPLETE | `pad(engine, controls, { scheme, actions })`: swappable touch controls (stick, d-pad or move keys + arcade action keys), one `setScheme()` away | 2.0 KB |
| `fizlet/collide` | COMPLETE | `Grid` spatial hash (`add` / `near`), `overlap`, `circles`, `circleRect`, `segCircle` (swept, no tunnelling) | 1.3 KB |
| `fizlet/grid` | BETA | `board()`: the game board. Typed-array terrain, cost and flags; A* `path` with a per-call budget, `los`, `flood` (movement range), seeded `scatter` | 1.5 KB |
| `fizlet/fx` | COMPLETE | `effects()`: pooled particles, `blast()` (the hero explosion), pop words, scorch, shake, `gravity`; `emitter(fx, KINDS)`: named particle kinds as data (bubble, spark, drip, debris, or your own), tree-shaken when unused | 2.7 KB (`emitter` and `KINDS` tree-shake away when unused) |
| `fizlet/camera` | BETA | `camera(engine, el, { ease, min, max, contain })`: the page is the camera. `to`, `pan`, `home`, `toWorld`; helpers `zoomAt`, `flyTo`, `fit`, `toScreen` stand alone (a hero that only zooms leaves them out); eased, settles, jumps with reduced motion, contained (no sideways scroll), one transform through the ledger (Recall exact), no allocation per step | 1.4 KB |
| `fizlet/sprite` | COMPLETE | `sprites(defs, { palettes, cap })`: pixel-art characters as data, re-tinted by palette role, baked once per sprite/frame/scale/palette into a capped cache, `draw()` with no allocation; `spriteSVG()` / `spriteURL()` for page characters, standalone (an SVG-only page ships ~1 KB less) | 1.4 KB |
| `fizlet/sound` | COMPLETE | `sound(engine, { cues })`: event ring → synth cues `fire`, `hit`, `boom`, `hurt`, `power`, `ready`, `win`, `end`, `click` (or your own player), at most 8 voices, unlock on gesture, `dispose` | 1.0 KB |
| `fizlet/embed` | COMPLETE | `embed(load, { name, palette, easterEgg })`: drop-in, hex-only palette, key / gesture / click triggers, lazy load, toggle, Escape | 2.0 KB |
| `fizlet/slot` | COMPLETE | `slot(target, load)`: mount a scene into an astro-base-engine slot: lazy start near the viewport, reduced motion keeps the fallback, `role="img"` kept, contained, `destroy()` gives the slot back | 1.8 KB |
| `fizlet/presence` | BETA | `presence(engine, { transport, slot, players, input, step })`: lockstep input exchange (input delay, never guesses), state-hash desync check; `memory()` and `websocket()` / `join(url)` transports | 1.8 KB |
| `fizlet/presence/check` | BETA | `syncCheck(setup, opts)`: runs a sim as lockstep clients and finds the first diverged frame (tests only) | 4.8 KB |
| `fizlet/hud` | BETA | `hud(engine, root)`: change-only readouts (`num`, `meter`, `flag`) and event-ring `feed` / `banner`, zero allocation, restored on destroy | 1.3 KB |
| `fizlet/match` | BETA | `match(engine, root, { count, seconds, begin, end })`: intro → count → play → paused → end on the kit's overlays; Esc / P pause, a hidden tab pauses, surrender, rematch; events on the ring | 2.6 KB |
| `fizlet/rules` | COMPLETE | `waves(engine, { alive })`, `drops(engine, { kinds, every, place })`, `score(engine, { levels })`: wave clock, pickups, combo and levels; DOM-free, zero allocation, events on the ring | 1.3 KB |
| `fizlet/steer` | BETA | `steer({ cap, speed, turn, blocked, random })`: movers on typed arrays (`x`, `y`, heading `a`) with `seek`, `flee`, `arrive` (or `arriveGoal`, the goal in `gx`/`gy`), `wander` and `patrol`; a turn-rate-limited heading and per-axis wall slide (Blitz's tank drive); DOM-free, zero allocation | 0.9 KB |
| `fizlet/coach` | BETA | `flag(key)` (a localStorage switch that never throws), `tour(engine, { steps, tips, every })` (tutorial steps, then tips in turn; `coach:step` on the ring; zero allocation) and `card(host, { onEnd })` (the Board UI coach card, rings the control it is about) | 1.2 KB |
| `fizlet/touch` | BETA | `lockTouch(doc, sel)`: a pinch (iOS gesture events, multi-touch) on a slot, a game host, the pad or `[data-touch-lock]` never zooms the page; one finger untouched; `null` locks the whole page; returns `release()`. The kit CSS adds `touch-action` (no double-tap zoom) | 0.3 KB |
| `fizlet/timeline` | BETA | `timeline(engine, { repeat, yoyo, rate, motion })`: DOM choreography on the kernel clock. `to(targets, values, { dur, delay, ease, stagger, at })` keyframe tracks on CSS values (transform, opacity, clip-path, custom properties: the numbers change, the words stay) or typed-array numbers; `label`, `play`, `reverse`, `pause`, `seek`, `finish`, `revert`, `done()`; events on the ring; change-only writes through the ledger (Recall exact), settles when done, jumps to the end with reduced motion, no allocation per step | 2.0 KB |
| `fizlet/css-clock` | BETA | `cssClock(root, { span, loops, prop, fps, motion, signal })`: a page's own CSS `@keyframes` on the kernel clock. Each animation stays in the stylesheet, `paused`, and reads its time from `--fz-t`; a timeline moves that one property through the ledger. One shared frame loop, no frames off screen, rests on frame one after `loops` plays and settles, reduced motion lands on the rest frame, `destroy()` is Recall | 5.3 KB |
| `fizlet/layout` | EXPERIMENTAL | `layout(engine, { cap, links, charge, distance, gravity, theta, ticks, motion })`: force-directed layout on typed arrays (`x`, `y`). Nodes repel through a Barnes-Hut quadtree rebuilt each step (O(n log n)), links pull toward their length, a weak pull holds the centre; `add`, `link`, `pin` / `free` (drags), `heat`, `nearest`, `bounds` (frame it with `fizlet/camera`). Cools over `ticks` steps, then rests and stops calling `busy()`: the engine settles. Replays bit for bit; reduced motion lands on the rest in one step; DOM-free, zero allocation | 1.7 KB |
| `fizlet/view-canvas` | EXPERIMENTAL | `viewCanvas(engine, root, { draw, maxDpr, label })`: one overlay canvas per root, its backing store the CSS size × devicePixelRatio (capped at 2), drawing in CSS px. `dirty([x, y, w, h])` grows one box; the render phase clears, clips and redraws only those device pixels, and nothing when nothing is dirty. Never keeps the engine awake (a `dirty()` wakes a settled one for one redraw); measures only after a resize or zoom; Recall removes the canvas; zero allocation | 0.9 KB |
| `fizlet/board-page` | BETA | `boardPage(engine)`: the host page as the board. Text glyphs (typed arrays, `near` / `hit`), buttons as targets, `consume` writes 0/1 into the page's own text | 4.1 KB |
| `fizlet/arcade` | COMPLETE | `arcade(def, options)`: the shell every page arcade game repeats, so a game is its rules and art. One engine per run over the page (board-page), an overlay canvas and a Board UI scoreboard chosen per game with `hud` (`arcadeHud()`: the card, the default; `skirmishHud()`: Blitz's bar with clock, rank, armor bar, feed, banner, its flow on `fizlet/match`, aim toggles, counted keys), keys, pointer and the touch pad, sound cues, sparks and stacking popups, target health painted into the buttons; the controller a hub drives (`start` · `pause` · `resume` · `stop` · `destroy` · `getSnapshot`) | 17.9 KB for a card game with every brick it composes; 23.8 KB with `skirmishHud` (in-page art via `ctx.attach`) |
| `fizlet/ui` + `fizlet/ui/board-ui.css` | COMPLETE | Board UI: 3D keys, cards, overlays, launch burst, Settings switch ([spec](src/ui/BOARD-UI.md)) | 2.8 KB + 4.9 KB css |
| `fizlet/ui/tokens.json` | COMPLETE | The Board UI tokens (palette roles, inks, surfaces, units, motion): the authoritative source; the build fails if `board-ui.css` or `applyPalette` drifts from it | data |

### Status flags

One source: `STATUS` and each brick's `status` in [`site/bricks.mjs`](site/bricks.mjs), with the
evidence (the release it shipped in, its tests, the released games and pages that ship it); the
table above, the brick pages and the bricks index read it, and `tests/status.test.mjs` checks it.

| Flag | Means | Earned by |
|---|---|---|
| COMPLETE | Done, and always getting smaller and faster. | Its own export and CI size budget; tests (Node, and Chromium where it touches the page), with zero allocation per step where it runs per step; a README row and a brick page; used by a released game or production page beyond its own demo; no breaking change since it first shipped (one moves it back to BETA). |
| BETA | Tested and budgeted; not yet carried by a shipped game, or its API is still moving. | Everything COMPLETE needs except the shipped user or the stable API. Safe to build on; a minor release may change it, and the CHANGELOG says how. |
| EXPERIMENTAL | In the package to try; no promise yet. | Its own export and budget; tests may be partial; may change or go away in any release. |
| ROADMAP | Planned, not shipped. | A name, a purpose, a size target and the bricks it needs; not in the package. |
| DEPRECATED | Still in the package, replaced by something named. | Removed in the first minor release after its replacement is COMPLETE. None today. |

ROADMAP bricks, each with its phase and size target (a goal until measured): `fizlet/actor`, `fizlet/aim` and `fizlet/view-dom` (E11),
`fizlet/snapshot` and `fizlet/agent` (E12, multiplayer everywhere), `fizlet/scene` (E13),
`fizlet/announce` (E14) and `fizlet/music` (E15). The phases, E0 to E16, are the
[roadmap on the website](https://fizlet.com/#roadmap).

### Input, sound and embed semantics

- **Bindings:** an intent can have several keys and a key several intents; an intent stays down while
  any of its keys (or `press()`) holds it. Auto-repeat is not a new press.
- **`hit`:** a press is seen by exactly one fixed step: the first step after it, even when that step
  comes frames later (0-step frames while catching up), and never by later steps of the same frame.
  Outside a step (`read`, `render`) `hit` is true for the one frame whose read latched it. Presses
  between two steps count once. `pointer.hit` works the same way.
- **Pointer and stick:** each is owned by the pointer id that pressed it. A release anywhere (outside
  the target too), `pointercancel` or `lostpointercapture` lets go; other fingers never move or
  release the stick, and the stick finger never moves the pointer. Pointer events record client
  coordinates only; the read phase measures the target once per frame when the pointer moved, so a
  pointer event never forces layout (`pointerdown` measures once, to pick the stick side).
- **No stuck input:** held keys, `press()` holds, the pointer and the stick are dropped on window
  blur, when the engine pauses, on `dispose()` and on `destroy()`.
- **Independent providers:** `controls(...).dispose()` and `sound(...).dispose()` remove that provider
  only (its listeners, its system, its held state or its AudioContext) while the engine keeps
  running; both are idempotent and also run when the engine is destroyed. With `play` (your own
  player), `sound` installs no AudioContext and no unlock listeners.
- **Sound unlock:** a trusted `pointerdown`, `pointerup` or `keydown` creates the synth's context, and
  resumes it whenever the browser or the OS suspended it. While switched off (`on = false`), gestures
  leave it suspended.
- **Embed:** `close()` (or Escape) while the game is still loading cancels that load: it never mounts
  afterwards, and a later `open()` starts a fresh one.

### Fill an astro-base-engine slot

astro-base-engine (a page engine for Astro sites) renders each `[slot animation]`
as a sized, described placeholder:
`<figure class="ae-slot" data-slot-target="<page>#<slot>" role="img" aria-label="…">`.
`fizlet/slot` fills it with a scene:

```ts
import { slot } from "fizlet/slot";

slot("home#hero", () => import("./hero-scene.js").then((m) => m.mount));

// hero-scene.ts: build inside the stage; return destroy (and accessible: true only when the
// scene renders real accessible content, which drops the slot's role="img").
import { createEngine } from "fizlet";
import { effects } from "fizlet/fx";
import type { SlotTap } from "fizlet/slot";
export function mount(stage: HTMLElement, figure: HTMLElement, first: SlotTap | null) {
  // settle: no frames once nothing moves (0.5 s quiet); fps: an ambient hero needs no more than 30.
  const engine = createEngine({ root: stage, pause: { reducedMotion: true }, settle: 0.5, fps: 30 });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!, fx = effects();
  engine.add({ step: (e, dt) => (fx.step(dt), fx.live && e.busy()), render: () => (ctx.clearRect(0, 0, canvas.width, canvas.height), fx.draw(ctx)) });
  if (first) fx.blast(first.x, first.y); // the tap that loaded the scene: an intent, not a stale event
  engine.start();
  return { destroy: () => engine.destroy() };
}
```

- **Lazy:** nothing loads until the slot comes within `margin` (default `"200px"`) of the viewport,
  and then not before the main thread is idle (`requestIdleCallback`, at most `idle` ms, default 1000).
- **First tap:** a tap on the slot before the scene is up loads it at once (no idle wait) and reaches
  `mount` as `first = { x, y, at }` (px from the slot's top left, `performance.now()`), never as the
  original `PointerEvent`, whose pointer is gone by then.
- **Page build:** kernel + `slot` + `input` + `fx` is budgeted at 7 KB gzip (`npm run size`), so a
  hero's live chunk stays under 10 KB with 3 KB for the scene; sound, debug, pad, HUD, match and the
  Board UI are never pulled in (`tests/page.test.mjs`).
- **Reduced motion:** with `prefers-reduced-motion: reduce` the scene never loads and the slot's
  placeholder and fallback stay; if the setting turns on mid-scene, the scene goes and they come back.
- **Accessible:** `role="img"` and `aria-label` stay; the stage is `aria-hidden` until the scene
  returns `accessible: true`.
- **Contained:** the scene gets its own stage (`position: absolute; inset: 0; contain: strict`)
  inside the slot. Every change goes through a ledger: `destroy()` puts the slot back exactly.
- `findSlot("<page>#<slot>")` returns the figure; `slot(figure, load)` takes the element too. An
  unknown target is inert (`el` is `null`).

### The board (`fizlet/grid`)

The board layer a board game sits on, separate from the rules. A `cols × rows` grid in typed
arrays (`terrain` id, move `cost`, `flags`: `BLOCKED`, `COVER`, `OCCUPIED`, bits 8–128 yours).
Every search reuses buffers made once in `board()`, so paths, sight and ranges never allocate.

```ts
import { board, BLOCKED, COVER, OCCUPIED } from "fizlet/grid";
import { seeded } from "fizlet";

const ROCK = 1, HEDGE = 2;                  // your terrain ids (0 = open ground)

const b = board(48, 30, { cell: 40, diagonal: false });
const rand = seeded(1234);                   // the same seed lays the same board
b.scatter(rand, 0.12, ROCK, 1, BLOCKED);     // density, terrain id, cost, flags
b.scatter(rand, 0.08, HEDGE, 1, COVER, 4, 1, 44, 29); // only inside a rect
b.flags[b.at(x, y)] |= OCCUPIED;             // world → cell, clamped

const out = new Int32Array(256);             // yours, reused
const n = b.path(from, to, out, 400);        // steps (start excluded, goal last), -1 = no path
if (b.partial) { /* budget hit: out leads toward the goal; replan next frame */ }
b.los(a, z, BLOCKED | COVER);                // symmetric; endpoints never block
b.hit(a, z);                                 // first blocking cell on the way (a shell's stop)
const m = b.flood(unit, 4, out);             // movement range, nearest first; b.dist(i)
```

Costs are per cell entered: an orthogonal step into a cost-1 cell costs 1, a diagonal 1.4 (no
corner cutting). `path` avoids `BLOCKED | OCCUPIED` by default (an occupied goal is allowed: attack
it). Not collision: `fizlet/collide` re-buckets moving bodies every step; the board is the ground
they cross. Use one cell size for both.

### Sprites

`fizlet/sprite` is the character layer's drawing primitive: good and bad characters, weapons,
pickups, written as data a prompt can compose.

```ts
import { sprites } from "fizlet/sprite";

const art = sprites({
  bug: {
    colors: { o: "rim", b: "team", e: "#fff6d6" },   // hex, or a role a palette fills
    frames: [                                         // one frame = rows; "." (any unlisted char) is empty
      [".o.o.", "obbbo", "obebo", ".o.o."],
      ["o...o", "obbbo", "obebo", "o...o"],
    ],
    ax: 2.5, ay: 2,                                   // pivot (default: the centre)
  },
}, { palettes: [{ team: "#39ffb0", rim: "#07060f" }, { team: "#ff5c8f" }, { "*": "#fff" }], cap: 256 });

art.draw(ctx, "bug", frame, x, y, angle, 3, side);   // palette 0 = side A, 1 = side B, 2 = hit flash
host.innerHTML = art.svg("bug");                      // or <img src={art.url("bug")}> on the page
```

- **Format**: `frames` is rows of characters (one frame) or a list of those; `colors` maps a
  character to a hex or a role. `outline` adds a 1px rim (readable on light and dark). A vector
  sprite gives `w`, `h`, `n` (frames) and `paint(c, frame, color)` instead; it is baked the same way.
- **Palettes**: role → hex. Palette 0 is the default and fills roles the others leave out, so one
  sprite serves every side; `*` paints every pixel one colour (a hit flash).
- **Cache**: one tile per (sprite, frame, whole scale 1–8, palette), on an `OffscreenCanvas` when
  there is one; the oldest is dropped past `cap`. `size` and `baked` (misses) show it working.
  Limits: 64 frames and 32 palettes per sprite.
- **Draw**: one `drawImage` (plus save/rotate/restore when turned), smoothing off, nothing
  allocated once baked (tested in Node and with Chromium's sampling heap profiler).

### Touch pad (`fizlet/pad`)

On-screen controls that drive your `controls` intents, so game code reads `down`, `hit` and `axis`
and never knows which control scheme is on screen. Swap it with one call, at any time.

```ts
import { controls } from "fizlet/input";
import { pad } from "fizlet/pad";

const input = controls(e, { keys: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], fire: ["Space"], auto: ["KeyQ"] } });
const touch = pad(e, input, {
  scheme: "stick", // "stick" (analog: input.axis(..., 0 | 1)) · "dpad" (one finger, 8-way) · "buttons" (a key per move intent)
  actions: [
    { intent: "fire", label: "", name: "Hold to fire (Space)", icon: FIRE_SVG, hold: true, key: "SPACE" }, // first = big primary key
    { intent: "auto", label: "AUTO", role: "aim", toggle: true, key: "Q" }, // down("auto") is the switch
  ],
  side: "right", // action keys under the right thumb (default); the move control takes the other
});
touch.setScheme("dpad"); // fingers on the old control let go; no listener is added
```

- `pad(engine, controls, { scheme?, actions?, side?, host?, move? })` → `{ el, scheme, setScheme(s), destroy() }`.
  `move` names the intents `[up, down, left, right]` for the d-pad and move keys (`""` leaves one out:
  `["", "", "left", "right"]` for a runner). Action keys tap (one `hit`), `hold`, or `toggle`.
- Looks: the Board UI kit (`.bui-pad`, `.bui-stick`, `.bui-dpad`, round `.bui-arcade` keys with roles;
  [spec](src/ui/BOARD-UI.md) §5.5). Put it inside a `.bui` root (`host`, default the engine root);
  show it only on touch layouts with your own CSS.
- Multi-touch: pointer capture per finger (fire while steering); a new finger on the move control
  takes it. The stick reads layout once per touch start; the knob moves in `render`, change-only.
- Recall: one element through the ledger, listeners delegated on it under the engine's signal.
  `destroy()` (or `engine.destroy()`) gives the page back exactly. Keys are named buttons;
  Enter / Space taps them; reduced motion turns the kit's transitions off.

### Performance overlay (`fizlet/perf`)

A stats panel for players, behind a Settings switch: live fps, a rolling frame-time bar chart,
dropped frames, the engine's work per frame, live entities and (Chromium) the JS heap. Off by
default, so shipped gameplay doesn't change until a player turns it on.

```ts
import { perf } from "fizlet/perf";
import { setting, PERF_KEY } from "fizlet/ui";

let opt;
const overlay = perf(engine, { corner: "tr", change: (on) => opt?.set(on) }); // F9 toggles it too
opt = setting(settingsKey, PERF_KEY, (on) => overlay.show(on), engine.signal); // remembered, off by default
```

- `perf(engine, { host, corner, key, on, budget, change })` → `{ el, show(on?), on, frames, dropped, ring, destroy() }`.
  `host` defaults to the engine root (position it), else `document.body` (then it is fixed);
  `corner` `"tl" | "tr" | "bl" | "br"`; `key` a `KeyboardEvent.code` (default `"F9"`, `null` for none).
- **Readouts** (updated every 0.5 s of frames): `FPS`; `MS` the mean frame interval; `DROP` dropped
  frames so far (a frame over 1.5 budgets counts the budgets it swallowed; `budget` defaults to
  1000/60 ms); `WORK` mean ms of the engine's hooks per frame (read, steps, render: `engine.timing[1]`);
  `LIVE` pooled entities in use (`engine.live`); `MB` used JS heap where `performance.memory` exists, else `--`.
- **Chart**: one canvas, the last 120 frames as 1px bars, go / hurt / critical colours from the
  kit tokens (under 1.25, 2 and over 2 budgets), the budget line over them.
- **Measures, doesn't distort**: it reads the engine's frames on the shared clock (no rAF, no timer
  of its own); frame times go into a `Float32Array` ring; nothing is allocated per frame, shown or
  hidden (Node test: 200k shown frames, at most 1 young GC; numbers format from typed-array slots
  into cached strings). Hidden, it only records. It never calls `engine.busy()`: a settling engine
  settles and the chart rests with it; the first frame after a sleep is not counted as dropped.
- **Look and a11y**: a flat arcade card on the Board UI tokens (inline, with the dark defaults as
  fallbacks, so it works with or without the kit CSS). `hidden` and `aria-hidden` while off; a
  labelled group while on (numbers as text, no live region). `pointer-events: none`.
- **Contained, Recall exact**: one root, `contain: layout paint style`, added through the ledger;
  shows and hides through it too. `destroy()` (or `engine.destroy()`) removes it, its key and its
  system, and the host is back byte for byte.
- **Settings switch** (`fizlet/ui`): `setting(button, key, change, signal, fallback = false)` keeps a
  kit key `aria-pressed` (the locked state) and stores `"1"` / `"0"` in localStorage; storage that
  throws (private mode, a sandboxed frame) is ignored. `PERF_KEY` is `"dom-virus:perf"`.

### Overload policy

Bounded everything (contract 2) means something has to give at capacity. What gives depends on the job:

- **Decorative particles may drop, counted.** `fx` refuses particles when its pool is full and
  counts them in `fx.dropped`; a `blast()` stops its per-particle work as soon as the pool is full,
  so a huge or repeated blast costs nothing extra. Invalid input (non-finite numbers, a life that
  would never end) is refused and counted the same way.
- **Collision results must not drop silently.** `new Grid(cell, cap, w, h, nodes = cap * 4)` has
  three separate capacities, and each one saturates visibly:
  - entities (`cap`): ids `0..cap-1`; any other id, or a non-finite circle, is refused: `grid.rejected`;
  - index (`nodes`): one entry per cell a body covers; past it, `grid.dropped`;
  - query results (the `out` buffer you pass): ids that did not fit set `grid.missed` (this query)
    and count in `grid.truncated`.

  Size them so every counter stays 0 and treat any rise as a bug (a missed candidate is a missed
  hit). Bad constructor or `resize` input (non-finite sizes, non-integer capacities) throws a `RangeError`.

### Engine API

- `createEngine({ root, step, maxSteps, seed, events, signal, pause, onError, settle, fps })`: numbers are
  checked at setup (`step` > 0, `seed` finite, `maxSteps`, `events` and pool caps positive
  integers); a bad one throws a `RangeError` naming the option.
- `engine.add(system)` / `remove(system)`: systems run in order; hooks `read`, `step`, `render`,
  and `pause` (the engine just stopped running: `stop()` or an auto-pause rule).
  `remove` is safe inside a hook (the other systems still run that frame).
- `engine.start()` / `stop()` / `destroy()`; `engine.running`, `engine.paused` (reasons).
  `destroy()` is idempotent and leaves the engine inert. Engines may start, stop or destroy each
  other from inside a hook: every engine still runs once per frame, on one rAF.
- **Settle** (`settle: seconds`, off by default): systems call `engine.busy()` in any frame where
  something moves; after `settle` seconds without one, the engine sleeps (`paused: ["settled"]`,
  no frames at all) until `engine.wake()`, its `controls` input or `start()`. Settling is not a
  pause: `pause` hooks don't run and held input stays. Something scheduled for later (an intro
  delay, a pause between beats, an autoplay timer) calls `engine.busy(seconds)` when it's set: the
  engine can't settle until that much more of its own time has run (counted in steps, so a slow
  frame can't outrun it), then settles as usual. A hold shorter than `settle` changes nothing.
  Counting a delay down in `step` without one can lose the scheduled thing to settle. **`fps`** caps the engine's frame rate on
  the shared clock (frames closer than `1/fps` do no work; time still follows the clock).
- A hook that throws in a scheduled frame stops only its own engine (`paused: ["stopped"]`,
  `start()` resumes) and goes to `onError(error, engine)` (default `console.error`); the shared
  clock and every other engine keep running.
- `engine.advance(seconds)`: run time by hand (tests, headless, a server); a hook's error throws.
- `engine.time` (seconds simulated) and `engine.steps` (fixed steps run; an integer, so reading it
  in a hot path never boxes).
- `engine.timing`: this frame as a `Float64Array` view, `[0]` seconds it advances on the shared
  clock (0 after a pause or a settle), `[1]` ms the last finished frame's hooks took. A slot, not a
  getter, so reading it never boxes. `engine.live`: pooled things in use, over every pool.
- `engine.pool(name, cap, create)`: a named bounded pool (shows in `stats()`).
- `engine.events`: the event ring (`emit(type, a, b, x, y, v)`, `size`, `at(i)`), cleared each frame.
- `engine.ledger`: `text`, `style`, `attr`, `cls`, `add(node)`, `restore()`.
- `engine.random()`: seeded; `engine.random.state` snapshots and restores it.
- `engine.stats()`: frames, steps, dropped time, frame ms, pools, events, ledger size, pause reasons.

### Multiplayer (`fizlet/presence`)

Every peer runs the same fixed-step sim from the same seed; only inputs cross the wire (12 bytes
each). Your input is sent `delay` frames ahead, and a frame runs only once every player's input
for it is here, so peers can't drift. Keep the sim on `engine.random` and typed arrays.

```js
import { createEngine } from "fizlet";
import { presence, join, hash32 } from "fizlet/presence";

const { transport, slot, players, seed } = await join("wss://your-rooms.example/room/abc?players=2");
const e = createEngine({ seed }), state = new Float64Array(64), bytes = new Uint8Array(state.buffer);
const net = presence(e, {
  transport, slot, players, delay: 2,
  input: () => (keys.down("left") ? 1 : 0) | (keys.down("right") ? 2 : 0), // your bits for a future frame
  step: (e, inputs, frame) => { /* simulate one frame from inputs[0..players-1] */ },
  hash: () => hash32(bytes), // compared across peers every 30 frames: net.desync
});
e.start();
```

**Check a game is deterministic** (any test, Node or browser): `syncCheck(setup, { players, frames,
latency, jitter })` from `fizlet/presence/check` runs your sim as lockstep clients over the memory
link and returns `{ ok, frames, diverged, stalls }`, where `diverged` is the first frame whose state
differed (or -1). `setup(e, slot, players)` returns `{ input(), step(e, inputs, frame), state }`, where
`state` is a byte view of the sim's typed arrays.

`net.frame`, `net.stalls`, `net.desync`, `net.lost`, `net.confirmed(slot, frame)` (the input log
a rollback layer can replay). A transport is `{ send(bytes), listen(fn), close() }`; the room server
prototype (Cloudflare Worker + Durable Object) is in [`rooms/`](rooms/README.md).

### HUD

```ts
import { hud } from "fizlet/hud";

const s = new Float64Array(2); // clock, armor (0..1): running fractions live in a typed array
hud(engine, wrap)
  .num("[data-k]", () => you.kills)            // 12
  .num("[data-t]", [s, 0], "clock")            // 2:59 (also "int", "rank" #2, "pct" 75%, or (v) => string)
  .meter("[data-hp]", [s, 1], 0.34)            // width 33%, aria-valuenow on a progressbar, class "low"
  .flag(fireKey, "hot", () => you.hot > 0)
  .feed(".feed", 4, "kill", (a, b) => NAMES[a] + " ✕ " + NAMES[b])
  .banner(".banner", "streak", (a) => [a + " KILL STREAK", REWARD[a]]);
```

Each value is compared as a number after rounding to what it shows (a clock compares whole
seconds), so it is formatted and written only when that changes; strings for 0–1023 are made once
and reused. `feed` and `banner` read `engine.events` in render (emit `kill` / `streak` from the
step), never per-frame state. Writes go through `engine.ledger`; rows or text nodes it adds are
removed on `destroy()`. It has no visuals of its own: it binds to your markup. A getter V8 doesn't
inline boxes a fractional double, so pass running fractions as a `[typedArray, index]` slot.

### Match flow (`fizlet/match`)

The flow every board shares, on the Board UI kit's overlay ([spec](src/ui/BOARD-UI.md) section 9):
a grey dim, a sticker that slams in, at most two sticker keys. The overlay is built once inside
`root` (pass `null` to run headless); each phase only flips attributes and text through the ledger,
so `destroy()` gives the page back exactly.

```ts
import { match } from "fizlet/match";
import { launch } from "fizlet/ui";

const m = match(engine, board, {
  count: 3,          // 3-2-1 beats of one second (0 skips the countdown)
  seconds: 180,      // the match clock; leave it out for no limit (the clock counts up)
  begin() { /* a new round: reset the field (runs in the click) */ },
  end({ won, why }) { /* why: "time", "flag" (surrender) or yours; may return a sticker */ },
  timeUp: () => myScore > theirs,  // who won when the clock runs out
  launch,            // PRESS START and SURRENDER blow up with the kit's launch burst
  labels: { intro: ["BATTLEFIELD", "BLITZ!"] },
  on(phase) { /* each phase change, once painted: a host that owns more follows here */ },
  hide: ["paused"],  // phases that show no overlay (the machine and its events still run)
});
engine.add({ step() { if (m.phase !== "play") return; /* the game */ } });
// m.phase, m.clock, m.start(), m.pause(on?), m.finish(won, why?), m.restart(), m.intro(), m.el
```

| Phase | Sticker (default words) | Keys |
|---|---|---|
| `intro` | PLAYER 1 / READY? | PRESS START |
| `count` | GET READY / 3, 2, 1 | none |
| `play` | (overlay hidden) | Esc / P pauses; a hidden tab pauses |
| `paused` | BATTLE PAUSED / GIVE UP? | KEEP FIGHTING · SURRENDER (the white flag) |
| `end` | STAGE CLEAR / MISSION COMPLETE, INSERT COIN / GAME OVER, WHITE FLAG / GAME OVER | REMATCH · NEW GAME |

- **Events, not callbacks, for the other layers:** `match:intro`, `match:count` (`a` = the number),
  `match:play` (`a` = 1 on resume), `match:paused` (`a` = 1 from a hidden tab), `match:flag`
  (surrender pressed), `match:won` / `match:lost` (`a` = the clock). Map them to cues in `sound()`.
  Transitions made outside a frame (a click) reach the ring in the next frame's read.
- **Pause is zero CPU:** `paused` stops the engine; the clock only counts in `play`, in the step,
  without allocating. Your systems check `m.phase` (the engine runs in the other phases).
- **Modal and focus:** while the overlay is up, its siblings in `root` are `inert`; focus moves to
  the primary key (the dialog when it has none) and goes back on play, unless the player is busy
  elsewhere on the host page. Reduced motion: no wave wait or burst on surrender, no slams.
- Your own overlay content (a mode picker, the standings table) goes in `m.el`; style it by
  `[data-phase]`.

### Rules (`fizlet/rules`)

The rules every arcade game repeats, as three small systems. They hold no DOM and draw nothing:
the game decides where and what to spawn, and the HUD, sound and fx react to the events.

```ts
import { waves, drops, score } from "fizlet/rules";

const w = waves(engine, { alive: () => enemies.length }); // prepare → assault → rebuild
const d = drops(engine, { kinds: ["repair", "charge"], every: 6, place: (out) => spot(out) });
const s = score(engine, { levels: [8, 24, 50] });         // combo 1 + floor(streak / 3), up to 5

engine.add({ step() {
  if (w.ready()) { spawnEnemy(); w.spawned(); }
  if (d.collect(player.x, player.y, 24) === "repair") player.hp++;
  if (hit) s.add(25, 4, hit.x, hit.y);                       // event "score": a = points, b = combo
} });
// Drawing a drop: d.x[i], d.y[i] now; d.landY[i] where it lands; d.age[i] seconds since it spawned
// (blink when d.life - d.age[i] < 2). Event "drop:land" once it touches down (a landing puff).
```

### Steer (`fizlet/steer`)

How things move toward, away from and around a point. Every mover has a position, a heading that
turns at most `turn` rad/s, and a speed; walls are checked per axis, so movers slide along them. The
defaults are DOM Battlefield Blitz's tank numbers (150 px/s, 7 rad/s), and a test runs `seek`,
`wander` and `arrive` frame by frame against Blitz's own bots and wingmen.

```ts
import { steer } from "fizlet/steer";

const m = steer({ cap: 16, random: engine.random,                 // seeded: runs replay
  blocked: (i, at) => wall(at[0], at[1]),                         // the spot comes in a typed array
  area: [60, 90, 840, 480] });                                    // wander picks goals in here
m.place(0, 100, 200);

engine.add({ step(_, dt) {
  m.seek(0, player.x, player.y, dt);    // stops inside `stop` (16 px)
  m.flee(1, bomb.x, bomb.y, dt);        // until `far` (240 px)
  m.arrive(2, slot.x, slot.y, dt);      // slows inside `slow` (140), stops inside `near` (14)
  m.gx[5] = lead.x - 40; m.gy[5] = lead.y;  // a goal that moves every frame: write it, then
  m.arriveGoal(5, dt);                  // arrive there (two fresh numbers as arguments get boxed)
  m.wander(3, dt, 0.55);                // a pace scales dt, so the turn slows too
  m.patrol(4, ROUTE, dt);               // ROUTE = new Float64Array([x0, y0, x1, y1, …])
} });
// Draw from m.x[i], m.y[i], m.a[i]; m.moved[i] is how far it went (tread marks, dust).
```

### Coach (`fizlet/coach`)

The hints and tutorial layer. `flag` remembers once-only things (tips turned off, tour seen) in
localStorage and answers "not set" when storage is blocked. `tour` walks the player through steps,
then cycles tips; `show()` names the card only when it changes, so `card` writes the DOM once per
card. The card is DOM Battlefield's coach card on the Board UI tokens (put it inside `.bui`).

```ts
import { flag, tour, card } from "fizlet/coach";

const tips = flag("my-game:tips", "off");
if (!tips.on) {
  const t = tour(engine, { steps: STEPS.length }), c = card(root, { onEnd: quit, signal });
  engine.add({
    step(_, dt) { t.tick(dt); if (didIt(t.step) || t.time[0] > 9) t.pass(); }, // "coach:step" on the ring
    render() {
      const k = t.show();
      if (k >= 0) k < t.steps ? c.show(`${k + 1}/${t.steps}`, STEPS[k][0], STEPS[k][1], keyFor(k)) : c.show("✓", "TIP", TIPS[k - t.steps]);
    },
  });
}
```

### Timeline (`fizlet/timeline`)

Scripted DOM moves (a cartridge flies in and boots, a screen grows to full size, doors fold open,
staggered entrances, a looping patrol) on the same clock as the game, instead of WAAPI or CSS
keyframes. A track animates one property of one target through keyframes: CSS values whose numbers
change and whose words stay (`"translate(0px,-8px)"`, `"inset(0 50% 0 0)"`, `"8px"`, `"0.5"`), or a
slot of a typed array (a number your step reads). Easings: `linear`, `in`, `out` (default), `inOut`,
`back`, `steps(n)` or your own function (sampled once into a table, so the step never calls it).

```ts
import { timeline } from "fizlet/timeline";

const e = createEngine({ settle: 0.5 });
const boot = timeline(e)                                       // paused until play()
  .to(cart, { translate: ["0px -150px", "0px 0px"], rotate: ["-14deg", "0deg"] }, { dur: 0.7, ease: "back" })
  .label("seated")                                              // its name goes on the ring as it passes
  .to(screen, { "clip-path": ["inset(48% 50%)", "inset(0% 0%)"] }, { at: "seated", dur: 0.5 })
  .to(deck, { "--glow": [0, 1, 0.35] }, { at: "<" })            // "<": with the track before
  .to(lines, { opacity: [0, 1] }, { delay: -0.1, stagger: 0.15 }) // negative delay overlaps
  .to(cart, { translate: "0px 12px" });                         // one value: from where it last ended
e.start();
boot.play();
await boot.done();                                              // or "timeline:end" on the ring

const patrol = timeline(e, { repeat: Infinity, yoyo: true })
  .to(tank, { translate: ["0px 0px", "240px 0px"] }, { dur: 3, ease: "inOut" });
patrol.play(); // patrol.pause(): no more frames once the engine settles
```

- **Where a track starts (`at`)**: by default at the end so far (one after another); `"<"` with the
  track before; a label's name; or seconds. `delay` adds to it (negative overlaps), `stagger` spaces
  the targets of one call.
- **One property, several tracks**: the first holds its first keyframe until it starts; a later one
  takes over once it starts.
- **Controls**: `play()` (from the start when at the end), `reverse()`, `pause()`, `seek(sec)`,
  `finish()` (the end in the next step), `revert()` (pause and give every property back now), and
  `done()` (a promise for the next end). `time`, `duration`, `playing`, `reduced`.
- **Events** on `engine.events` (`a` = the `id` option): `timeline:start`, `timeline:end`, and each
  label's name (`b` = its index) as the playhead passes it, forward or back.
- **Reduced motion**: by default `play()` lands on the end state in one step (a loop that runs
  forever stops at the end of one play). Pass `motion: true` to animate anyway (a gentler variant you
  build on `tl.reduced`), or `motion: false` to always jump.
- **The contract**: time moves in the fixed step with no DOM access and no allocation (state in
  typed arrays; a node test counts young-generation GCs); render writes only values that changed,
  rounded to a thousandth, through the ledger, so `engine.destroy()` restores every property byte for
  byte and a host edit wins. Done or paused, it never calls `busy()`, so the engine settles. An
  object's property (not a typed array) is written in render, since storing a number there can box it.

### Arcade: a page game's shell

`fizlet/arcade` is what Null Invaders, Byte Runner and Sherman Bytes share: everything but the rules
and the art. The game passes its definition and a `create(ctx)` that adds its own systems to
`ctx.engine`; the shell writes the controls into `ctx.ctl` in the read phase, so a step only reads
typed arrays.

```ts
import { arcade, MODE, PX, PY, KX, KY, FIRE, VW, VH } from "fizlet/arcade";

const game = arcade({
  id: "null-invaders", title: "Null Invaders", color: "#06c4ff", css: KIT_CSS, fire: true,
  hint: "Move: mouse / WASD · Fire: click / Space · G: next gate",
  readouts: [["Score", "team", (v) => String(v).padStart(6, "0")], ["Wave"]],
  colors: ["#06c4ff", "#f4457a"], cues: { fire: "fire", kill: "boom" },
  create: (ctx) => rules(ctx), // { reset, over, draw, hud, stats, react?, scroll?, meter? }
}, { root: "main", seed: 7 });
game.start(); // Escape, the exit key or game.stop(): Recall gives the page back exactly
```

- **Controls and scoreboards (`hud`):** one option, a preset per game; each preset is its own export,
  so a game ships only the one it names (BOARD-UI.md §19).
  - `arcadeHud({ header?, nav? })`, the default: today's card. Leaving `hud` out renders it byte for
    byte; `header` (`sound` · `pause` · `fold` · `exit`) and `nav` (`next` · `restart` · `auto`)
    keep only the keys named.
  - `skirmishHud({ readouts, header?, nav?, feed?, banner?, overlays?, result?, aim?, counts? })`:
    Battlefield Blitz's HUD. A bar across the top with readouts in their formats (`num`, `clock`,
    `rank`, `pct`, `bar` with a `low` state), aim toggles (`aim-auto`, `aim-lock` intents),
    the action keys with counts, the text keys a game asks for (`nav`: `auto` Auto fire, `next`
    Next gate, `restart`; none by default) and fullscreen / sound / pause / `fold` / exit; a feed
    and a banner from the event ring. Its flow (countdown, pause / surrender, result: the result
    lists `stats()` keys and keeps a best on the device) is `fizlet/match` on a small engine that
    lives as long as the overlay: match owns the phase, the shell's pause, resume and end ask it,
    the countdown runs on its clock while the game's engine waits, and the result stays up after
    the run (the page is already back) until REMATCH, EXIT or Recall; on phones the pad with the aim toggles and counted keys. Values
    go through `fizlet/hud` from the `hud(out)` slots: change-only, nothing allocated in the steady state.

  ```ts
  import { arcade, skirmishHud } from "fizlet/arcade";
  arcade({ ...def, hud: skirmishHud({
    readouts: [{ label: "Kills", tone: "team" }, { label: "Time", kind: "clock" }, { label: "Rank", kind: "rank" },
               { label: "Armor", kind: "bar", low: 0.3 }, { label: "Streak", tone: "enemy" }],
    feed: { on: "kill", line: (a, b) => NAMES[a] + " ✕ " + NAMES[b] },
    banner: { on: "streak", text: (n) => [n + " KILL STREAK", "AIRSTRIKE READY"] },
    aim: ["auto", "lock"], counts: { strike: 5 }, result: { stats: ["kills", "time"], best: "kills" },
  }) }); // hud(out): kills, time, rank, armor, streak, then out[5] = strikes left
  ```
- **In-page art:** `ctx.attach(el)` returns a shadow root in an overlay inside `el` that follows the page's layout and scrolling natively (Recall removes it). `keyboard: true` makes a keys-only game; without `fire` the first action is the big touch key.
- **One run, one engine.** `start()` builds the engine, the board and the overlay; `stop()` destroys
  the engine (the page comes back through its ledger) and removes the overlay. When the game reports
  `over()` the page comes back at once and the scoreboard stays with the result and a Restart key.
- **The page keeps what it owns.** While a run is live, a click on the page fires instead of following
  a link; the scoreboard, fields, dialogs and `[data-virus-ignore]` / `[data-fizlet-ignore]` keep their
  clicks and keys. Typing in a field pauses the engine (the kernel's rule).
- **The snapshot a hub reads:** `status` (idle, running, paused, won, gameover, destroyed), `elapsed`,
  the game's `stats()`, frame time, `board` (letters indexed, visible, spent, range reads) and
  `particles`.

### Board: the page

`fizlet/board-page` is the layer behind every embedded game: the host page's letters become terrain
and food, its buttons become targets, and Recall gives every one back.

```ts
import { boardPage } from "fizlet/board-page";

const board = boardPage(engine, { exclude: ".no-game" }); // root, text, targets, maxGlyphs, maxTargets, letters, reads, still, color
const near = new Int32Array(16);
engine.add({
  step() {
    const n = board.near(px, py, 12, near);          // unspent on-screen glyphs, no layout reads
    for (let k = 0; k < n; k++) board.consume(near[k]); // written in render: a literal 0 or 1
    const i = board.hit(x0, y0, x1, y1);             // first glyph on a shot, or -1 (`board.t`: where)
  },
});
```

- **Glyphs**: `board.glyphs` = `{ count, x, y, w, h, spent }`, typed arrays in viewport CSS px. Letters
  and digits of `text` containers (default headings, `p`, `li`, `blockquote`, `[data-fizlet-text]`),
  160 containers and 8,000 glyphs at most, interleaved 8 per text node so one paragraph can't take
  the cap. `w = 0` while not on screen. Indices hold for a frame (a rescan renumbers them).
- **Targets**: `board.targets` = `{ el, x, y, w, h, hp }[]` (default `button`, `[role=button]`,
  `a.button`, `a.btn`, `[data-fizlet-target]`; 32 at most). `hp` is the game's and survives a rescan.
- **Measured in `read` only, on a budget**: one reused `Range`, at most `reads` (default 900) Range
  reads per refresh (the rest on the next one), every 0.08 s while the page moves (scroll, resize,
  `ResizeObserver`, `MutationObserver`) and every `still` s (default 0.5) once it is still. Indexed
  with a collide `Grid`; `near`, `hit` and `consume` never read layout or allocate.
- **Targets only**: `text: false` indexes no glyphs; with `still: Infinity` it re-measures only after
  a scroll, resize or change, so a scene that reads page elements (headings it lights, keys it rains
  on) reads no layout in a still frame.
- **Changes through the ledger only**: `consume(i, "binary" | "erase")` writes `0`/`1` (or a no-break
  space) into the existing Text node with `engine.ledger.text`: no wrappers, spans or clones. From a
  step it waits for render. `color: "#f4457a"` tints the rubble with a CSS Custom Highlight.
  `destroy()` gives back every text still ours, byte for byte; a newer host edit wins.
- **Leaves alone**: fields, editable content, `[aria-live]`, dialogs, `[data-fizlet-ignore]`, any
  Fizlet host (`[data-fizlet-host]`), the engine's own root, your `exclude`; links, buttons and code
  are never food.

## Develop

```sh
npm ci
npm run check         # typecheck, contract tests (node), build
npm run size          # size budgets
npm run test:browser  # contract tests in Chromium (Playwright)
npm run test:pack     # pack, install the tarball, import + typecheck every subpath
npm run site          # the website, into site-dist/
```

### The website

`site/` is the source of https://coded-dot-design.github.io/fizlet/: template-string pages
(`site/layout.mjs`, `site/pages/`), `site/site.css` on top of the Board UI kit, and a live demo
(`site/demo.ts`) built with Fizlet itself. No framework: `scripts/site.mjs` writes static HTML.

One page per brick (`bricks/<id>.html`) is generated from the source, never typed: the summary is
the module's leading comment and the API its built declarations (`scripts/api.mjs`), the sizes are
measured by `scripts/sizes.mjs`. `site/bricks.mjs` only says which modules a page covers and which
small live demo it runs (`site/demos/`). `tests/api.test.mjs` checks the catalog against
`package.json` and every page's API against its module's runtime exports.

```sh
npm run site        # build dist/ and site-dist/ (gitignored); open site-dist/index.html
npm run test:site   # every page at desktop and 360px: errors, links, overflow, the demos (Chromium),
                    # SEO/a11y gates (scripts/check-html.mjs), sizes on the page = sizes measured
```

The site also hosts the builds for the quick start: `fizlet.js` (one file, `window.fizlet`) and
the ES modules under `dist/`. `.github/workflows/pages.yml` deploys it on every push to `main`.

Releases: bump `version` in `package.json` (and the lockfile) and add a CHANGELOG entry; CI tags
`vX.Y.Z` on `main` after the checks pass, and `.github/workflows/release.yml` publishes that tag to
npm with provenance (it also runs on a `v*` tag pushed by hand). Publishing needs the `NPM_TOKEN`
repository secret; without it the release job checks and packs, then skips the publish with a warning.

## Licence

MIT © Chris Cooley / coded.design
