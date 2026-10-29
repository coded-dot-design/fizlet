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
9. **Budgets in CI.** Kernel ≤ 4 KB gzip (today: ~2.8 KB), each brick ~1.5 KB.

## What's in the box

| Import | What | Size (min + gzip) |
|---|---|---|
| `fizlet` / `fizlet/kernel` | `createEngine`, scheduler, `Pool`, `EventRing`, `Ledger`, `seeded` | ~2.8 KB |
| `fizlet/debug` | `guardLayout(engine)`: counts layout reads during a step (dev only) | ~0.5 KB |
| `fizlet/input` | `controls(engine, { keys, stick })`: intents (`down`, `hit`, `axis`), pointer, touch stick, on-screen `press` / `steer` | ~1.0 KB |
| `fizlet/pad` | `pad(engine, controls, { scheme, actions })`: swappable touch controls (stick, d-pad or move keys + arcade action keys), one `setScheme()` away | ~1.8 KB |
| `fizlet/collide` | `Grid` spatial hash (`add` / `near`), `overlap`, `circles`, `circleRect`, `segCircle` (swept, no tunnelling) | ~0.8 KB |
| `fizlet/grid` | `board()`: the game board. Typed-array terrain, cost and flags; A* `path` with a per-call budget, `los`, `flood` (movement range), seeded `scatter` | ~1.5 KB |
| `fizlet/fx` | `effects()`: pooled particles, `blast()` (the hero explosion), pop words, scorch, shake | ~1.5 KB |
| `fizlet/sprite` | `sprites(defs, { palettes, cap })`: pixel-art characters as data, re-tinted by palette role, baked once per sprite/frame/scale/palette into a capped cache, `draw()` with no allocation; `svg()` / `url()` for page characters | ~1.3 KB |
| `fizlet/sound` | `sound(engine, { cues })`: event ring → synth cues (or your own player), unlock on gesture | ~0.9 KB |
| `fizlet/embed` | `embed(load, { name, palette, easterEgg })`: drop-in, hex-only palette, key / gesture / click triggers, lazy load, toggle, Escape | ~2.0 KB |
| `fizlet/slot` | `slot(target, load)`: mount a scene into an astro-base-engine slot: lazy start near the viewport, reduced motion keeps the fallback, `role="img"` kept, contained, `destroy()` gives the slot back | ~1.5 KB |

| `fizlet/match` | `match(engine, root, { count, seconds, begin, end })`: intro → count → play → paused → end on the kit's overlays; Esc / P pause, a hidden tab pauses, surrender, rematch; events on the ring | ~2.5 KB |
| `fizlet/ui` + `fizlet/ui/board-ui.css` | Board UI: 3D keys, cards, overlays, launch burst ([spec](src/ui/BOARD-UI.md)) | ~2.4 KB + ~3.8 KB css |

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

- `createEngine({ root, step, maxSteps, seed, events, signal, pause })`
- `engine.add(system)` / `remove(system)`: systems run in order; hooks `read`, `step`, `render`.
- `engine.start()` / `stop()` / `destroy()`; `engine.running`, `engine.paused` (reasons).
- `engine.advance(seconds)`: run time by hand (tests, headless, a server).
- `engine.pool(name, cap, create)`: a named bounded pool (shows in `stats()`).
- `engine.events`: the event ring (`emit(type, a, b, x, y, v)`, `size`, `at(i)`), cleared each frame.
- `engine.ledger`: `text`, `style`, `attr`, `cls`, `add(node)`, `restore()`.
- `engine.random()`: seeded; `engine.random.state` snapshots and restores it.
- `engine.stats()`: frames, steps, dropped time, frame ms, pools, events, ledger size, pause reasons.

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
