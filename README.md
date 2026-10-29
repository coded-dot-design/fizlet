# Fizlet

By [Chris Cooley](https://coded.design/). **Tiny physics for your page.** A micro game and animation engine for the DOM: one shared loop,
bounded everything, zero allocation in the steady state, and the page always comes back exactly as
it was. No runtime dependencies, ever.

**Website, live demo and quick start: https://coded-dot-design.github.io/fizlet/**

The "fiz" is fizz (the pop of an effect) and a nod to physics; the "-let" is small, like an applet.
Fizlet powers the [DOM VIRUS](https://coded-dot-design.github.io/dom-virus/) arcade and
[DOM Battlefield](https://coded-dot-design.github.io/dom-battlefield/).

## Install

```sh
npm install fizlet
```

One package, one import per piece (`fizlet`, `fizlet/fx`, `fizlet/slot`, ...): you ship only what
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
9. **Budgets in CI.** Kernel ≤ 4 KB gzip (today: ~3.1 KB), each brick ~1.5 KB.

## What's in the box

| Import | What | Size (min + gzip) |
|---|---|---|
| `fizlet` / `fizlet/kernel` | `createEngine`, scheduler, `Pool`, `EventRing`, `Ledger`, `seeded` | ~3.1 KB |
| `fizlet/debug` | `guardLayout(engine)`: counts layout reads during a step (dev only) | ~0.5 KB |
| `fizlet/input` | `controls(engine, { keys, stick })`: intents (`down`, `hit`, `axis`), pointer, touch stick, on-screen `press` / `steer`, `dispose` | ~1.3 KB |
| `fizlet/pad` | `pad(engine, controls, { scheme, actions })`: swappable touch controls (stick, d-pad or move keys + arcade action keys), one `setScheme()` away | ~1.8 KB |
| `fizlet/collide` | `Grid` spatial hash (`add` / `near`), `overlap`, `circles`, `circleRect`, `segCircle` (swept, no tunnelling) | ~0.8 KB |
| `fizlet/grid` | `board()`: the game board. Typed-array terrain, cost and flags; A* `path` with a per-call budget, `los`, `flood` (movement range), seeded `scatter` | ~1.5 KB |
| `fizlet/fx` | `effects()`: pooled particles, `blast()` (the hero explosion), pop words, scorch, shake | ~1.5 KB |
| `fizlet/sprite` | `sprites(defs, { palettes, cap })`: pixel-art characters as data, re-tinted by palette role, baked once per sprite/frame/scale/palette into a capped cache, `draw()` with no allocation; `svg()` / `url()` for page characters | ~1.3 KB |
| `fizlet/sound` | `sound(engine, { cues })`: event ring → synth cues (or your own player), unlock on gesture, `dispose` | ~1.0 KB |
| `fizlet/embed` | `embed(load, { name, palette, easterEgg })`: drop-in, hex-only palette, key / gesture / click triggers, lazy load, toggle, Escape | ~2.0 KB |
| `fizlet/slot` | `slot(target, load)`: mount a scene into an astro-base-engine slot: lazy start near the viewport, reduced motion keeps the fallback, `role="img"` kept, contained, `destroy()` gives the slot back | ~1.5 KB |
| `fizlet/presence` | `presence(engine, { transport, slot, players, input, step })`: lockstep input exchange (input delay, never guesses), state-hash desync check; `memory()` and `websocket()` / `join(url)` transports | ~1.8 KB |
| `fizlet/hud` | `hud(engine, root)`: change-only readouts (`num`, `meter`, `flag`) and event-ring `feed` / `banner`, zero allocation, restored on destroy | ~1.3 KB |
| `fizlet/ui` + `fizlet/ui/board-ui.css` | Board UI: 3D keys, cards, overlays, launch burst ([spec](src/ui/BOARD-UI.md)) | ~2.4 KB + ~3.8 KB css |

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

More bricks land through phase E2 (actor, steer, aim, rules, board-page, camera,
view-dom, presence): see the [engine plan](https://github.com/coded-dot-design/dom-virus/blob/main/ENGINE.md).

### Fill an astro-base-engine slot

[astro-base-engine](https://github.com/brain-cache/astro-engine) renders each `[slot animation]`
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
export function mount(stage: HTMLElement) {
  const engine = createEngine({ root: stage, pause: { reducedMotion: true } });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!, fx = effects();
  engine.add({ step: (e, dt) => fx.step(dt), render: () => (ctx.clearRect(0, 0, canvas.width, canvas.height), fx.draw(ctx)) });
  engine.start();
  return { destroy: () => engine.destroy() };
}
```

- **Lazy:** nothing loads until the slot comes within `margin` (default `"200px"`) of the viewport.
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

### Engine API

- `createEngine({ root, step, maxSteps, seed, events, signal, pause, onError })`: numbers are
  checked at setup (`step` > 0, `seed` finite, `maxSteps`, `events` and pool caps positive
  integers); a bad one throws a `RangeError` naming the option.
- `engine.add(system)` / `remove(system)`: systems run in order; hooks `read`, `step`, `render`,
  and `pause` (the engine just stopped running: `stop()` or an auto-pause rule).
  `remove` is safe inside a hook (the other systems still run that frame).
- `engine.start()` / `stop()` / `destroy()`; `engine.running`, `engine.paused` (reasons).
  `destroy()` is idempotent and leaves the engine inert. Engines may start, stop or destroy each
  other from inside a hook: every engine still runs once per frame, on one rAF.
- A hook that throws in a scheduled frame stops only its own engine (`paused: ["stopped"]`,
  `start()` resumes) and goes to `onError(error, engine)` (default `console.error`); the shared
  clock and every other engine keep running.
- `engine.advance(seconds)`: run time by hand (tests, headless, a server); a hook's error throws.
- `engine.time` (seconds simulated) and `engine.steps` (fixed steps run; an integer, so reading it
  in a hot path never boxes).
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

## Develop

```sh
npm ci
npm run check         # typecheck, contract tests (node), build
npm run size          # size budgets
npm run test:browser  # contract tests in Chromium (Playwright)
npm run test:pack     # pack, install the tarball, import + typecheck every subpath
npm run site          # the website, into site-dist/
```

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

```sh
npm run site        # build dist/ and site-dist/ (gitignored); open site-dist/index.html
npm run test:site   # every page at desktop and 360px: errors, links, overflow, the demo (Chromium)
```

The site also hosts the builds for the quick start: `fizlet.js` (one file, `window.fizlet`) and
the ES modules under `dist/`. `.github/workflows/pages.yml` deploys it on every push to `main`.

Releases: bump `version` in `package.json` (and the lockfile) and add a CHANGELOG entry; CI tags
`vX.Y.Z` on `main` after the checks pass, and `.github/workflows/release.yml` publishes that tag to
npm with provenance (it also runs on a `v*` tag pushed by hand). Publishing needs the `NPM_TOKEN`
repository secret; without it the release job checks and packs, then skips the publish with a warning.

## Licence

MIT © Chris Cooley / coded.design
