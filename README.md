# Fizlet™

[![npm @fzlt/core](https://img.shields.io/npm/v/@fzlt/core?label=npm%20%40fzlt%2Fcore)](https://www.npmjs.com/package/@fzlt/core)

By Chris Cooley, sponsored by [coded.design](https://coded.design/). **Fizlet is the building blocks for animation and games
on the DOM.** Each brick is a task we wrote hundreds of times over two decades,
now kept by AI and human developers who chase performance at all costs. You bring the logic and
style, even from a prompt. One shared loop, bounded everything, zero allocation in the steady state,
and the page always comes back exactly as it was. No runtime dependencies, ever.

**Docs, guides and the full API of every brick: https://docs.fzlt.dev**

The "fiz" is fizz (the pop of an effect) and a nod to physics; the "-let" is small, like an applet.
Fizlet runs every DOM VIRUS game: Battlefield Blitz, DOM Battlefield 1.0, and the DOM VIRUS arcade
(Null Invaders and Byte Runner 1.0, Sherman Bytes 1.1, Swarm Protocol 1.4). "The page is the board" is DOM VIRUS's
approach: one use of the bricks.

> **Public beta (0.x).** Fizlet 0.x is a public beta: every brick carries a status flag, and a 0.x
> minor release may change a BETA brick's API (the CHANGELOG says how). COMPLETE bricks keep
> theirs. The flags and what earns each are under [Status flags](#status-flags).

## Install

```sh
npm i @fzlt/core
```

Fizlet on npm is `@fzlt/core` (the `fzlt` org; npm refused `fizlet` and `fzlt` as too close to existing
names). The project is still Fizlet; this repository (`fizlet/fzlt`) is the package alone.
Fizlet is not affiliated with the `figlet` or `flat` packages.

```ts
import { createEngine } from "@fzlt/core"; // the kernel
import { effects } from "@fzlt/core/fx";    // one import per brick: you ship only what you import
import "@fzlt/core/ui/board-ui.css";        // the Board UI stylesheet, when you use @fzlt/core/ui
```

One package, one subpath per brick (`@fzlt/core`, `@fzlt/core/fx`, `@fzlt/core/slot`, ...; the full list is
under [What's in the box](#whats-in-the-box)). ES modules with TypeScript types (Node and bundler
resolution); no runtime dependencies; only the stylesheet has side effects, so a bundler drops
every brick you don't import. Releases are published from CI with
[npm provenance](https://docs.npmjs.com/generating-provenance-statements), so
`npm audit signatures` can check that the tarball was built from this repo.

> On npm since 0.21.2 (2026-10-31), published from CI on tag (`.github/workflows/release.yml`).
> No npm? Build from source: `git clone https://github.com/fizlet/fzlt && cd fzlt && npm ci &&
> npm run build` gives you `dist/` with the same subpath exports.

```ts
import { createEngine } from "@fzlt/core";

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
   `@fzlt/core/debug` counts any layout read made during a step.
5. **Change-only writes.** The ledger skips writes that change nothing.
6. **Pause by default.** Hidden tab, page leaving, root off screen, typing in the host's own fields
   (reduced motion is opt-in). Zero CPU while paused.
7. **Own nothing you can't give back.** Every page change goes through the ledger; `destroy()`
   restores it exactly, and a newer edit by the host page always wins. One `AbortSignal` removes
   every listener and observer.
8. **Embed-safe.** No globals, no global styles, many engines per page. Every root Fizlet owns is
   CSS-contained: the slot stage `contain: strict`; the pad, the match overlay and the launch burst
   `contain: layout style` (each is already positioned, so nothing moves or clips: a browser test
   compares every box inside with containment on and off); the `@fzlt/core/ui` mount root
   `contain: style` (it is static, so layout or paint containment could move or clip a board's own
   layers). `hud` and `board-page` own no box: they write into the host's markup and never add
   containment to it.
9. **Budgets in CI.** Kernel ≤ 4 KB gzip (measured: 3,372 bytes); each brick has its own budget,
   1.5 to 5 KB, and a page build (kernel + slot + input + fx) ≤ 7 KB (`scripts/sizes.mjs`); over
   budget, the build fails.

## What's in the box

Sizes as `npm run size` measures them on this build: minified + gzip, everything an import pulls
in included, 1 KB = 1024 bytes.

| Import | Status | What | Size (min + gzip) |
|---|---|---|---|
| `@fzlt/core` / `@fzlt/core/kernel` | COMPLETE | `createEngine`, scheduler, `Pool`, `EventRing`, `Ledger`, `seeded` | 3.3 KB |
| `@fzlt/core/debug` | COMPLETE | `guardLayout(engine)`: counts layout reads during a step; `touchLog({ lines, moves, host })`: an on-screen log of pointer and touch events and the element each hit (shadow roots too), for real phones; `stop()` (dev only) | 1.1 KB |
| `@fzlt/core/perf` | COMPLETE | `perf(engine, { host, corner })`: the players' performance overlay (off by default): fps, a frame-time bar chart, dropped frames, engine work, live entities, JS heap | 2.0 KB |
| `@fzlt/core/input` | COMPLETE | `controls(engine, { keys, stick })`: intents (`down`, `hit`, `axis`), pointer, touch stick, on-screen `press` / `steer`, `dispose`; opt-in `gamepad(controls, { map, dead, index })`: standard-layout buttons press intents, analog `value(intent)`, the left stick steers, polled only while a pad is connected (+0.6 KB when imported) | 1.9 KB |
| `@fzlt/core/pad` | COMPLETE | `pad(engine, controls, { scheme, actions })`: swappable touch controls (stick, d-pad or move keys + arcade action keys), one `setScheme()` away | 2.0 KB |
| `@fzlt/core/collide` | COMPLETE | `Grid` spatial hash (`add` / `near`), `overlap`, `circles`, `circleRect`, `segCircle` (swept, no tunnelling) | 1.2 KB |
| `@fzlt/core/grid` | BETA | `board()`: the game board. Typed-array terrain, cost and flags; A* `path` with a per-call budget, `los`, `flood` (movement range), seeded `scatter` | 1.6 KB |
| `@fzlt/core/fx` | COMPLETE | `effects()`: pooled particles, `blast()` (the hero explosion), pop words, scorch, shake, `gravity`; `emitter(fx, KINDS)`: named particle kinds as data (bubble, spark, drip, debris, or your own), tree-shaken when unused | 2.7 KB (`emitter` and `KINDS` tree-shake away when unused) |
| `@fzlt/core/camera` | BETA | `camera(engine, el, { ease, min, max, contain })`: the page is the camera. `to`, `pan`, `home`, `toWorld`; helpers `zoomAt`, `flyTo`, `fit`, `toScreen` stand alone (a hero that only zooms leaves them out); eased, settles, jumps with reduced motion, contained (no sideways scroll), one transform through the ledger (Recall exact), no allocation per step | 1.4 KB |
| `@fzlt/core/sprite` | COMPLETE | `sprites(defs, { palettes, cap })`: pixel-art characters as data, re-tinted by palette role, baked once per sprite/frame/scale/palette into a capped cache, `draw()` with no allocation; `spriteSVG()` / `spriteURL()` for page characters, standalone (an SVG-only page ships ~1 KB less) | 1.4 KB |
| `@fzlt/core/sound` | COMPLETE | `sound(engine, { cues })`: event ring → synth cues `fire`, `hit`, `boom`, `hurt`, `power`, `ready`, `win`, `end`, `click` (or your own player), at most 8 voices, unlock on gesture, `dispose` | 1.0 KB |
| `@fzlt/core/embed` | COMPLETE | `embed(load, { name, palette, easterEgg })`: drop-in, hex-only palette, key / gesture / click triggers, lazy load, toggle, Escape | 2.0 KB |
| `@fzlt/core/slot` | COMPLETE | `slot(target, load)`: mount a scene into an Astro page engine slot: lazy start near the viewport, reduced motion keeps the fallback, `role="img"` kept, contained, `destroy()` gives the slot back | 1.8 KB |
| `@fzlt/core/hud` | BETA | `hud(engine, root)`: change-only readouts (`num`, `meter`, `flag`) and event-ring `feed` / `banner`, zero allocation, restored on destroy | 1.3 KB |
| `@fzlt/core/match` | BETA | `match(engine, root, { count, seconds, begin, end })`: intro → count → play → paused → end on the kit's overlays; Esc / P pause, a hidden tab pauses, surrender, rematch; events on the ring | 2.6 KB |
| `@fzlt/core/rules` | COMPLETE | `waves(engine, { alive })`, `drops(engine, { kinds, every, place })`, `score(engine, { levels })`: wave clock, pickups, combo and levels; DOM-free, zero allocation, events on the ring | 1.3 KB |
| `@fzlt/core/steer` | COMPLETE | `steer({ cap, speed, turn, blocked, random })`: movers on typed arrays (`x`, `y`, heading `a`) with `seek`, `flee`, `arrive` (or `arriveGoal`, the goal in `gx`/`gy`), `wander` and `patrol`; a turn-rate-limited heading and per-axis wall slide (Blitz's tank drive); the heading's trig is `@fzlt/core/math`'s, so a seeded run gives the same bits in every browser; DOM-free, zero allocation | 2.7 KB |
| `@fzlt/core/math` | BETA | `sin`, `cos`, `atan`, `atan2`, `hypot`: trig with the same bits in every browser (fdlibm, the algorithms V8 ports; Node's builtins bit for bit), for anything that steps a sim online; each tree-shakes on its own; zero allocation | 1.7 KB |
| `@fzlt/core/coach` | COMPLETE | `flag(key)` (a localStorage switch that never throws), `tour(engine, { steps, tips, every })` (tutorial steps, then tips in turn; `coach:step` on the ring; zero allocation) and `card(host, { onEnd })` (the Board UI coach card, rings the control it is about) | 1.2 KB |
| `@fzlt/core/touch` | BETA | `lockTouch(doc, sel)`: a pinch (iOS gesture events, multi-touch) on a slot, a game host, the pad or `[data-touch-lock]` never zooms the page; one finger untouched; `null` locks the whole page; returns `release()`. The kit CSS adds `touch-action` (no double-tap zoom) | 0.3 KB |
| `@fzlt/core/timeline` | BETA | `timeline(engine, { repeat, yoyo, rate, motion })`: DOM choreography on the kernel clock. `to(targets, values, { dur, delay, ease, stagger, at })` keyframe tracks on CSS values (transform, opacity, clip-path, custom properties: the numbers change, the words stay) or typed-array numbers; `label`, `play`, `reverse`, `pause`, `seek`, `finish`, `revert`, `done()`; events on the ring; change-only writes through the ledger (Recall exact), settles when done, jumps to the end with reduced motion, no allocation per step | 2.1 KB |
| `@fzlt/core/css-clock` | BETA | `cssClock(root, { span, loops, prop, fps, motion, signal })`: a page's own CSS `@keyframes` on the kernel clock. Each animation stays in the stylesheet, `paused`, and reads its time from `--fz-t`; a timeline moves that one property through the ledger. One shared frame loop, no frames off screen, rests on frame one after `loops` plays and settles, reduced motion lands on the rest frame, `destroy()` is Recall | 5.2 KB |
| `@fzlt/core/scene` | ALPHA | `scene(data, { motion })` (a slot mount) and `mountScene(stage, data)`: an animation recipe as JSON. A **stage** (a pixel grid fitted to the box, background, starfield, shake, `end`, `loop`, intro `delay`), a **cast** (sprites, rects, text, lines; each value a number, a track `[from, to, at, dur, ease]` on timeline's easings, or a blink), **cues** (fx words, kicks, bursts, once at their time) and **gags** (an emitter held open over a window, following a track). One canvas through the ledger, no allocation per step, rests on the last frame and settles (`busy(sec)` holds it until then), a tap replays, reduced motion draws the poster, `destroy()` is Recall. Its own code is 1.9 KB; the size counts the bricks it composes | 8.3 KB |
| `@fzlt/core/layout` | ALPHA | `layout(engine, { cap, links, charge, distance, gravity, theta, ticks, motion })`: force-directed layout on typed arrays (`x`, `y`). Nodes repel through a Barnes-Hut quadtree rebuilt each step (O(n log n)), links pull toward their length, a weak pull holds the centre; `add`, `link`, `pin` / `free` (drags), `heat`, `nearest`, `bounds` (frame it with `@fzlt/core/camera`). Cools over `ticks` steps, then rests and stops calling `busy()`: the engine settles. Replays bit for bit; reduced motion lands on the rest in one step; DOM-free, zero allocation | 1.7 KB |
| `@fzlt/core/view-canvas` | ALPHA | `viewCanvas(engine, root, { draw, maxDpr, label })`: one overlay canvas per root, its backing store the CSS size × devicePixelRatio (capped at 2), drawing in CSS px. `dirty([x, y, w, h])` grows one box; the render phase clears, clips and redraws only those device pixels, and nothing when nothing is dirty. Never keeps the engine awake (a `dirty()` wakes a settled one for one redraw); measures only after a resize or zoom; Recall removes the canvas; zero allocation | 0.9 KB |
| `@fzlt/core/actor` | ALPHA | `actors({ cap, sides, x, y, a, events })`: units, bots and shots as one fixed table of typed arrays. `spawn(side, hp, kind, tags)` (-1 when full), `kill`, `hurt` (true on the kill), `heal`, `sweep()` once per step (rows come back, spawn order kept, so seeded runs replay); handles that outlive a row (`ref` / `get`), live `count(side)`, tag bits, `nearest(i, range, sides, tags)`; shares a body with `@fzlt/core/steer`; `actor:spawn` / `hurt` / `kill` on the ring; DOM-free, zero allocation | 0.9 KB |
| `@fzlt/core/aim` | ALPHA | `aim({ x, y, a, vx, vy, board, mask, clear, foe })`: where bots and turrets point. `lead(i, j, speed)` (the intercept of a straight shot and a straight mover, earliest ahead; false when it can never catch up), `cone(i, j, half, range)` (signed angle off the heading: turn by it), `sees(i, j)` (`@fzlt/core/grid` line of sight; `mask` lets cover block; or your own `clear`), `pick(i, list, n, half, range)` (the nearest foe in the cone and in sight); results in `out`, `@fzlt/core/steer`'s exact `hypot`, DOM-free, zero allocation | 0.7 KB |
| `@fzlt/core/view-dom` | ALPHA | `viewDom(engine, actors, host, { make, scale, turn, center, linger, motion, paint })`: an actor table as DOM nodes, one per row, pooled (made the first time a row shows, hidden when it dies, back when the row lives again). Change-only through the ledger: `transform` (centred, turned by the heading), `--hp`, `data-side` / `data-kind`; the look is the page's CSS. A still board writes nothing and settles; a death can `linger` with `data-dead` (not with reduced motion); Recall removes every node; no allocation per step | 0.9 KB |
| `@fzlt/core/announce` | BETA | `announce(engine, { words, gap, doc })` → `{ say, flush, destroy }`: game events read out to screen readers through one polite live region per page (`[data-fz-announce]`, status, atomic, visually hidden, made on the first word). `words(event)` turns ring events into sentences in render; sentences coalesce by key (the latest score, not ten), at most one write per `gap` (1 s); the same sentence twice is read twice; nothing in step, zero allocation; `destroy()` is Recall | 0.6 KB |
| `@fzlt/core/diorama` | ALPHA | `diorama(canvas, { light, ambient, background, shadowColor, edge, overlay, maxDpr })`: software 3D for cutaway tabletop scenes on a 2D canvas you own (no WebGL). A scene is data: `add({ id, shape, size, pos, rot, color, alpha, tint, hidden, off, on, shadow, layer, below, cluster, emissive, pick, tag })` with `box` (face mask), `wedge`, `cyl` (cones), `prism` (an outline) and `group`; `on` rests a part on another (it moves, tilts and sinks with it; alpha and tint inherited; `off` drops a whole subtree from the draw, shadows, picks and matrix work, so a fixed pool of composites is let go with one flag, while `hidden` hides the object alone). Flat shading from one light, edge lines, blob shadows on the tilted top they sit on; a painter's sort by cluster → layer → depth, with `points()` (effects; `rank: "depth"` sorts each point among the clusters by its own depth) and `decal()` in the same sort. The orbit `cam`, `fit` (frame points in a safe rect), `clamp`, `pick` (front-most object), `ground` (screen → plane), `project`, `eye` (the camera's world position); `draw()` from the render phase allocates nothing. `occlude(d, { objects, ghost, t, reduced, near })` (tree-shakes) fades what stands between the eye and target points: `step(dt, pts)` eases a box in the way to `ghost`, one the eye is inside to 0, the rest back to 1, and returns whether anything is still fading. `glide(cam, goal, rate, dt, snap)` (tree-shakes) eases the camera toward a goal, each field the goal names, lands exactly and returns whether it still moves (a view change after `fit`, a pan, a reframe; `snap` under reduced motion). Faces are never split: order crossing parts with clusters and layers | 7.1 KB |
| `@fzlt/core/dice` | ALPHA | `roll(seed, n, sides, out)`: seeded dice for any number of sides, from integer maths only, so every player who rolls the same seed gets the same values in every browser. `dice({ count, cap, size, duration, rate })` → `roll(seed, { from, to, height, spread, jitter, turns, pop })` gives each d6 a short tumble that ends flat on the value `roll` gives (built to land there, never a physics run that ends on an edge): `path` holds [x, y, z, qx, qy, qz, qw] per frame, `pose(i, t, out)` reads it, `value` and `total` hold the result. `dioramaDice(d, dc, { on, color, pip })` builds them into a `@fzlt/core/diorama` scene (a chamfered body, pips painted in the depth sort on the faces that look at the camera); `popDome(d, dc, { on, at, radius })`: under a clear dome you press, they jump and land. `euler`, `faceUp` helpers. Zero allocation per roll, pose and show | 4.2 KB |
| `@fzlt/core/track` | ALPHA | `track({ points, closed, spaces, smooth, jumps, cap, spacing, level, tokens, finish, start, hop, hopTime, jumpSpeed, events })`: board paths for roll-and-move games, in board coordinates [x, z]: spaces at the points, or at even steps along a polyline or a Catmull-Rom curve, open or looped, each with a heading for diorama's `rot`. `place`, then `move(token, steps)` works out the hops at once (a step per space, then jumps: ladders, chutes, shortcuts), flagged pass go, bounce back, finish and land; an open path stops at the end, needs the exact count, or bounces. Tokens on one space stand side by side, then stack (`cap` per space). `sample(t, out)` / `apply(ob, t)`: an arc per step, a slide or climb per jump. Events `track:pass`, `track:jump`, `track:finish`, `track:land`, `track:stay` on an engine's ring. No randomness; zero allocation per move and sample | 2.0 KB |
| `@fzlt/core/water` | ALPHA | `water(d, { rect \| outline, level, color, alpha, depth, bands, light, wave: { amp, len, speed, dir }, foam: { edges, alpha, width }, sheen, swell, cluster, layer, idle, still, seed })`: animated water for `@fzlt/core/diorama` scenes, lifted from the Salvo Bay prototype. Builds the body (depth bands as prisms) and paints the surface in the depth sort, clipped to its outline: crests rolling along `dir`, a drifting sheen, foam lapping on the edges you pick. `wake(ob)`: bow waves and a trail that follow a moving object. `splash(x, z, size)` (a column, spray, a crown of drops, rings and ripples), `ripple`, `bubbles`, `whirl`, from fixed pools. `height(x, z, t)` and `slope` are deterministic; `swell` adds a travelling, peeling crest for a wave pool (`crest(out)`: where it is and where it has broken). `step(dt)` returns `busy`: the surface rolls `idle` seconds after the last effect, then rests so the engine settles; `still` (default: prefers-reduced-motion) holds it and keeps effects short. Seeded; zero allocation per step and draw | 5.1 KB |
| `@fzlt/core/props` | ALPHA | Low-poly models that furnish a `@fzlt/core/diorama` scene: `pineTree`, `roundTree`, `bush`, `rocks`, `cactus`, `house`, `shop`, `lamppost`, `bench`, `fence`, `trafficCone`, `crates`, `lighthouse`, `dock`, `buoy`, `car`, `truck`, each `prop(d, { id, on, pos, rot, scale, seed, colors, cluster, shadow, layer, pick, tag })` → a `group` root sized to its footprint (its blob shadow fits) with its parts resting on it, so moving, turning, tinting or picking the root takes the whole prop (`d.root(d.pick(x, y))`). Soft pastel defaults overridable by shared keys (`wood`, `roof`, `glass`, `lamp`, …: one object re-themes a scene); `seed` picks heights, turns and counts from integer maths in eight steps (every player builds the same scene; the mesh cache stays small); `FENCE_STEP`, `DOCK_STEP` join segments; `PROPS` lists them all. Each prop is its own function: import one and the rest tree-shake (835 B for `pineTree`). Adds nothing beyond diorama's own `add` | 3.0 KB |
| `@fzlt/core/beam` | ALPHA | `beam({ cap, segs, hits, bounces, bounds, grid })`: lasers on a board. `add({ kind, x, z, col, row, a, len, r, one, off, tag })` places mirrors (reflect at any angle; `one`: the back blocks), splitters (pass and reflect, half power each), blockers, targets and emitters as segments or circles, free or on a grid; `set`, `turn`, `enable`, then `run()` casts every emitter: the segments (`x0 z0 x1 z1`, distance, power, turns, the part at the end) and hits (`hp hx hz`) in fixed typed arrays, `lit` per part, `litCount()`. Depth first and deterministic; π/4 angles trace exact bits in every browser; `bounces` caps a trapped beam. `dioramaBeam(d, b, { on, y, color, width, speed, pulse, hold, motion, light })` draws it on a `@fzlt/core/diorama` board: glowing beams as decals in the depth sort, a pulse of points, sparks where it hits; a re-routed beam grows out from where it changed, `light(part, on)` when it reaches a target; `show(t)` is false once it rests. Zero allocation per run and show | 4.3 KB |
| `@fzlt/core/cards` | ALPHA | `deck({ size, piles })`: a deck for tabletop games. Cards are numbers; each is in one pile at one place, face up or down: `shuffle(pile, seed)` (Fisher-Yates on a 32-bit integer generator, no modulo bias: the same seed gives the same order everywhere), `draw`, `deal` round by round, `move`, `flip`, `gather`, `reset`, `count`, `at`, `top`, `id`; every change stamps the card in move order. `dioramaCards(d, k, { on, size, thick, piles, face, back, art, dur, stagger, arc, motion })` builds it into a `@fzlt/core/diorama` scene: thin cards with your `face(ctx, card)` (and `back`) painted on the side that looks at the camera; piles lie as a `stack`, a `row` or a `fan` held up toward the camera; moves arc and flips turn over, staggered in move order; `pick` names the card under a point; `show(t)` is false once every card rests. Zero allocation per deck operation and show | 3.3 KB |
| `@fzlt/core/flick` | ALPHA | `flick({ cap, table, floor, floorFriction, gravity, sub, tip, lip, events })`: light tabletop physics for diorama pieces, in the table top's frame (y = 0 inside `table` [width, depth]). `add({ shape, size, pos, yaw, mass, friction, bounce, fixed })` discs, boxes, ramps (tall at −x, like diorama's wedge) and fixed walls; `flick(i, jx, jz)` an impulse; pieces slide with μ·g friction against what holds them (a piece on another is dragged along), hit each other with restitution (boxes spin from off-centre hits), ride ramps and launch off them, fall off the table's edges onto `floor` (`off`), and a stack topples when its centre of mass leaves its support, the pieces on it with it, landing on the nearest quarter turn. `step(dt)` (fixed sub-steps) returns `busy`; `run()` plays to rest at once (reduced motion); `pose(i, out)` / `apply(i, ob)` for diorama's `pos` and `rot`; events `flick:hit`, `flick:topple`, `flick:fall`, `flick:rest`. `sling({ pull, max, min, steps, turns })`: a slingshot drag → a power meter and a shot as two integers (`angle`, `level`), so both players replay it bit for bit (no Math.sin in a step). Zero allocation per step | 5.3 KB |
| `@fzlt/core/terrain` | ALPHA | `terrain({ cols, rows, cell, x0, z0, heights, base, split })`: a heightfield for diorama scenes, its vertex heights in `h`. Fill it from data, `noise({ seed, amp, scale, octaves, gain, ridge, wind, stretch })` (hills, or ridged dunes across a wind) and stamps: `bump`, `ramp(from, to, { width, height, back, edge })` (a lip that throws), `whoops`, `berm` (a banked turn; past each end it keeps its cross-section and runs out flat over `edge`), `ribbon(points, { width, edge, y, kind })` (a flat track that paints its kind), `shape(fn)`. Integer hashing and + − × ÷ and square roots only: the same seed gives the same course in every browser. `height(x, z)`, `normal(x, z, out)`, `sample(x, z, out)` → [h, nx, ny, nz] and its kind: exactly the drawn triangles. `split: "adaptive"` splits each cell along its diagonal with the smaller height difference (sharp dune crests as one straight fold, not stair-steps; default one fixed diagonal). `terrainView(d, t, { bands, steep, steepColor, kinds, light, ambient, chunk, lod, sort, split, shadows, haze })` draws it inside `d.draw()` as flat-shaded faces (a colour per height band, steep faces, painted kinds), chunk by chunk, culled, coarser with distance with stitched edges, far to near; `sort: "depth"` lets hills hide what is behind; `shadow(i, x, z, r, a)` lies on the slope; `haze: { from, to, color }` fades faces into a colour by their distance from the camera's target (untouched before `from`, all `color` past `to`). Endless grounds: `terrainWindow({ cols, rows, cell, step, split, fill(i0, j0, i1, j1, t) })` is a terrain (the same queries, the same face rule, the same view) whose origin slides over the world lattice: `follow(x, z)` keeps a point in its middle step by whole `step`s, keeps what overlaps (`copyWithin`) and asks `fill` only for the vertex rows and columns it gains (heights into `t.h`, kinds into `t.kind`; vertex (i, j) sits at lattice point `t.origin` + (i, j)), `moveTo(i, j)` puts its first vertex anywhere, `version` bumps once per move and `stats` counts moves and filled vertices; `fill` must be a pure function of the place, so where the window sits is never state. A far ring to the horizon: a second, coarse `terrainWindow` over the same ground (e.g. 4-unit cells, 136 a side) with its own view in a fixed cluster behind the near one (`cluster: "far", fixed: -1`), both views with the same `haze`, so the two grounds meet at the same haze. Zero allocation per query, per draw and per slide | 5.4 KB |
| `@fzlt/core/drive` | ALPHA | `drive(ground, { kind, wheels, radius, rest, travel, hz, stiffness, progressive, damping, rebound, bump, inertia, droop, gravity, accel, top, brake, reverse, coast, grip, drift, swing, slide, recover, steer, steerFall, cg, lean, airPitch, crashPitch, crashRoll, crashDrop, surfaces, substeps, mass, hull, events, id })`: vehicle feel on any ground with `sample` (`@fzlt/core/terrain` is one): a bike (two wheels in line, leans into turns) or a car, Jeep or truck (four). `set(throttle, brake, steer, drift)` then `step(dt)` on the fixed step: power that fades to top speed, brakes and reverse, steering that tightens less at speed, sideways grip that lets go into a slide, a handbrake drift (the `drift` input: the rear grip drops to `drift`, the tail swings out by `swing`, the slide holds under `slide` radians, counter-steer catches it, `recover` of the slide comes back as speed on the way out; 0.22.0's drift, bit for bit: `{ swing: 0.5, slide: 9, recover: 0 }`), long-travel suspension: a spring and damper per wheel, each wheel sampling the ground on its own (`travel`, `stiffness` or `hz`, `progressive` springs, `damping` compressing and `rebound` extending, a `bump` stop past the travel), the body heaving, pitching and rolling on the spring loads with its own `inertia`, so a big drop compresses the springs, rebounds and settles (a buggy: `{ travel: 0.6, stiffness: 70, progressive: 1.2, damping: 0.4, rebound: 0.85, inertia: 1.5 }`), airtime, throttle and brake pitch it in the air, a landing judged against the slope and a crash past `crashPitch` or a rollover past `crashRoll`. Out: `pos`, `rot` (diorama's order), per wheel `comp`, `press` (0..1 of the travel: an arm's angle), `spin`, `contact`, `wheel` (`droop`: how fast a wheel off the ground drops, for drawing); `bodyPitch` and `bodyRoll` (the lean on the springs, against the ground under the wheels), `stroke` (the most any spring is in; 1 is the bump stop); `steerAngle`, `speed`, `groundSpeed`, `slip`, `dust`, `air`, `landing`, `crashed`, `resting`; drift scoring: `drift` (0..1 now), `slide` (body to travel, radians), `chain` (∫ drift dt so far), `lastChain`; `spinOut(rate, secs)` spins it round with no control (`spinning`: seconds left); rollback: `state` (every byte of the car's state, one buffer), `save(dst)` and `load(src)` (no allocation; a replay from a load is bit for bit); events `drive:air`, `drive:land`, `drive:crash`, `drive:drift` (v: the chain's score, b: 1 when a crash or spin-out broke it). Contact: `touch(a, b, { bounce, height, onHit })` and `touchAll(cars, opts)` push box (`hull` [half length, half width]) or circle (one radius) hulls apart by `mass` and bounce them along the normal; `onHit(a, b, hit)` gets `touchHit` [impulse, nx, nz, depth, x, z], e.g. `if (b.drift > 0.3) b.spinOut(7, 1.2)`. Deterministic bit for bit (its own polynomial trig; pairs in a fixed order); `step` returns false at rest, so the engine settles. `chase(cam, target, { dist, pitch, lift, ahead, side, rate, turn, snap }, dt)` eases a diorama camera behind anything with `pos` and `yaw`. Zero allocation per step and per contact, with several vehicles and races in one process (one class: the read-outs are getters on its prototype and the model is module functions, so every car shares one call target; in a hot loop over many cars write computed inputs into `input`, as `set`'s double arguments box when a call is not inlined) | 5.1 KB |
| `@fzlt/core/rig` | ALPHA | Jointed limbs for `@fzlt/core/diorama` figures: `limb(d, id, { on, l1, l2, normal, bend })` adds two groups (`limb.a` the upper bone at the root joint, `limb.b` the lower at the middle joint; hang each bone's parts along +x) and `limb.reach(ax, ay, az, bx, by, bz)` poses both from a hip or shoulder toward a foot or hand, in the parent's frame, the tip exactly on a target in reach (pulled in along the line when not). The solves stand alone: `ik2(out, ax, ay, bx, by, l1, l2, bend)` (a plane: two angles and the middle joint) and `ik3(out, …, nx, ny, nz, bend)` (3D, in the plane nearest a normal: the joints and each bone's diorama rotation, +x along it). `outset(outline, e)` grows an outline all round (an ink edge's twin, build time). Results go into typed arrays: no allocation per pose | 1.3 KB |
| `@fzlt/core/ribbon` | ALPHA | Roads, tracks and edge strips drawn along their true curve at their true width on a heightfield (an `@fzlt/core/terrain`), not coloured onto its triangles (whose edges zigzag along the grid). `ribbon(d, ground, { cluster, layer, step, cap, buckets, light, ambient, lift, hide, reach })` adds one decal to the ground's cluster; `band(line, from, to, color, closed)` paints the strip between two offsets across a line (negative: its left), mitred at the joints, cut into pieces no longer than `step`, every corner on the ground's own height. Pieces are near-clipped, culled off screen, shaded by slope like the terrain's faces, painted far to near in depth buckets with one fill per colour and shade, each reaching a little back over the one before (no seams); `hide` skips a piece behind a crest. `clear()`, `heights()` (after a stamp), `stats` (pieces, dropped, fills). Nothing to call per frame; no allocation per frame | 2.6 KB |
| `@fzlt/core/turntable` | ALPHA | `turntable(engine, el, { yaw, rate, key, friction, snap, ease, spin, motion, label, onTurn })`: a model viewer's angle. A sideways drag turns it at once (`rate` radians per px, pointer capture, one pointer); with focus ← → turn it by `key` (15°), eased, and Home goes back the short way; `spin(secs)` shows it off after a change; `friction` lets a throw coast and `snap` rests it on a step (both off by default); with reduced motion turns jump, nothing coasts and `spin` does nothing. `onTurn(yaw)` runs in render only when the angle changed (set a diorama's `cam.yaw` and draw, or write a CSS `rotateY`); `label` makes the element a slider (role, tabindex, aria-valuenow 0..359) through the ledger. `turn(to)`, `by(d)`, `home()`, `grab` / `drag` / `release` for your own input; `yaw`, `deg`, `moving`. The engine sleeps at rest; zero allocation per step | 1.4 KB |
| `@fzlt/core/ground` | ALPHA | Paint on the ground of a `@fzlt/core/diorama` scene, inside a decal or an overlay, through the diorama's own projection; each call adds to the context's current path, so many lines are one stroke. `seg(d, ctx, ax, ay, az, bx, by, bz, near)`: a line between two world points, dropped when an end is at or behind the eye; `spot(d, ctx, x, y, z, r, flat)`: a level disc as an ellipse, `r × focal / depth` wide (light pools, reticles); `ring(d, ctx, x, z, r, y \| ground, lift, n)`: a closed ring of world points on a plane or on a ground's slope (anything with `sample`, e.g. a terrain); `shadow(d, ctx, x, y, z, r, lift, alpha, fade, flat)`: a blob shadow that fades and narrows as its owner lifts, filled at once; `horizon(d)`: the horizon's screen y (a sky's edge, fog bands). `at` is the last point projected ([x, y, depth]: a line's width by distance). Zero allocation per call | 0.6 KB |
| `@fzlt/core/board-page` | COMPLETE | `boardPage(engine)`: the host page as the board. Text glyphs (typed arrays, `near` / `hit`), buttons as targets, `consume` writes 0/1 into the page's own text | 4.0 KB |
| `@fzlt/core/arcade` | COMPLETE | `arcade(def, options)`: the shell every page arcade game repeats, so a game is its rules and art. One engine per run over the page (board-page), an overlay canvas and a Board UI scoreboard chosen per game with `hud` (`arcadeHud()`: the card, the default; `skirmishHud()`: Blitz's bar with clock, rank, armor bar, feed, banner, its flow on `@fzlt/core/match`, aim toggles, counted keys), keys, pointer and the touch pad, sound cues, sparks and stacking popups, target health painted into the buttons; the controller a hub drives (`start` · `pause` · `resume` · `stop` · `destroy` · `getSnapshot`) | 17.8 KB for a card game with every brick it composes; 23.6 KB with `skirmishHud` (in-page art via `ctx.attach`) |
| `@fzlt/core/ui` + `@fzlt/core/ui/board-ui.css` | COMPLETE | Board UI: 3D keys, cards, overlays, launch burst, Settings switch ([spec](src/ui/BOARD-UI.md)); `[hidden]` hides any part inside `.bui` whatever its own `display`, and icons in keys and the pad never take a touch | 2.8 KB + 5.0 KB css |
| `@fzlt/core/ui/tokens.json` | COMPLETE | The Board UI tokens (palette roles, inks, surfaces, units, motion): the authoritative source; the build fails if `board-ui.css` or `applyPalette` drifts from it | data |

**In-house / experimental.** Used in our games. Not a supported multiplayer service. These bricks
stay in the package (MIT, flagged as below), but there is no hosted room server: to run your own,
follow the "Build your own room server" guide in the [docs](https://docs.fzlt.dev) (the wire
protocol presence speaks, the one-room-one-object pattern and a threat checklist).

| Import | Status | What | Size (min + gzip) |
|---|---|---|---|
| `@fzlt/core/presence` | BETA | `presence(engine, { transport, slot, players, input, step })`: lockstep input exchange (input delay, never guesses), state-hash desync check; `memory()` and `websocket()` / `join(url)` transports | 2.1 KB |
| `@fzlt/core/presence/check` | BETA | `syncCheck(setup, opts)`: runs a sim as lockstep clients and finds the first diverged frame (tests only) | 4.8 KB |
| `@fzlt/core/presence/rollback` | BETA | `rollback(engine, { transport, slot, players, input(frame), step(inputs, frame, live, sure), bytes, confirm, gone, window, delay })`: rollback on presence's wire and room: every frame runs at once on guessed remote inputs, a late input that differs runs the frames since again from a snapshot ring of the sim's byte views; hashes on final frames (`desync`), the input delay 1..3 from the measured latency, a screen ahead waits a frame now and then (`lead`), a seat that left plays `gone`. Deterministic; zero allocation per frame. API may move | 2.1 KB |

### Status flags

One source: `STATUS` and each brick's `status` in [`scripts/bricks.mjs`](scripts/bricks.mjs), with the
evidence (the release it shipped in, its tests, the released games and pages that ship it); the
table above and the docs read it, and `tests/status.test.mjs` checks it.

| Flag | Means | Earned by |
|---|---|---|
| COMPLETE | Done, and always getting smaller and faster. | Its own export and CI size budget; tests (Node, and Chromium where it touches the page), with zero allocation per step where it runs per step; a README row and a brick page; used by a released game or production page beyond its own demo; no breaking change since it first shipped (one moves it back to BETA). |
| BETA | Tested and budgeted; not yet carried by a shipped game, or its API is still moving. | Everything COMPLETE needs except the shipped user or the stable API. Safe to build on; a minor release may change it, and the CHANGELOG says how. |
| ALPHA | In the package to try; no promise yet. | Its own export and budget; tests may be partial; may change or go away in any release. |
| ROADMAP | Planned, not shipped. | A name, a purpose, a size target and the bricks it needs; not in the package. |
| DEPRECATED | Still in the package, replaced by something named. | Removed in the first minor release after its replacement is COMPLETE. None today. |

ROADMAP bricks, each with its phase and size target (a goal until measured):
`@fzlt/core/snapshot` and `@fzlt/core/agent` (E12, multiplayer everywhere), `@fzlt/core/scene` (E13)
and `@fzlt/core/music` (E15). The phases, E0 to E16, are the
roadmap on fizlet.com.

## Bricks in depth

Each brick's guide, its semantics (input, sound, embed, overload policy, multiplayer, match flow,
timeline, arcade, the page as the board) and its full API, generated from the source:
**https://docs.fzlt.dev**. Every export in `dist/*.d.ts` keeps its doc comment, so your editor
shows the same text. The build strips every other comment (`npm run publish-clean` checks it).

### Named constants and small helpers

Every runtime export has a name in the docs; these small ones are named here too.

- `@fzlt/core` and `@fzlt/core/kernel`: the frame phases `IDLE`, `READ`, `STEP`, `RENDER` (0..3; read
  geometry only in `READ`, write the page only in `RENDER`).
- `@fzlt/core/perf`: `BARS` (frames in the chart, 120: 2 s at 60 fps), `WINDOW` (ms between number
  updates, 500) and `FrameRing` (the last `cap` frame times in a typed array; `push` never allocates).
- `@fzlt/core/pad`: `stickAt(dx, dy, out)` (a drag offset in radii to the stick's values, dead zone
  and curve applied, into `out[0]`, `out[1]`) and `dpadAt(dx, dy)` (the d-pad mask: up 1, down 2,
  left 4, right 8).
- `@fzlt/core/collide`: `inRect(px, py, x, y, w, h)` (a point inside a rect).
- `@fzlt/core/fx`: `SHAPES` (what a kind draws as) and the built-in kinds `BUBBLE`, `SPARK`, `DRIP`,
  `DEBRIS_KIND`.
- `@fzlt/core/touch`: `SURFACES`, the selector `lockTouch` locks by default (slot stages, game hosts,
  the pad, draggable panels, `[data-touch-lock]`).
- `@fzlt/core/presence`: the wire kinds `INPUT`, `HASH`, `WELCOME`, `LEAVE`, `RESUME`, `AWAY`,
  `START`, `LOBBY` (the protocol a room server speaks: the "Build your own room server" guide in the docs).
- `@fzlt/core/timeline`: `EASES`, the easing table by name.
- `@fzlt/core/track`: `HOP`, the hop kinds and flags (`hops.kind`, `hops.flag`).
- `@fzlt/core/beam`: the part kinds `MIRROR`, `SPLITTER`, `BLOCKER`, `TARGET`, `EMITTER`.
- `@fzlt/core/flick`: `STATE`, a piece's state (`rest`, `slide`, `air`, `tip`).
- `@fzlt/core/arcade`: the control slots `MODE`, `PX`, `PY`, `PON`, `KX`, `KY`, `FIRE`, `VW`, `VH`,
  `CALM` (reduced motion) and `TARGET_HP` (written by the game: a target's full health).
- `@fzlt/core/ui`: `pressCue(root, signal)` (keyboard and iOS press faces on page keys), `slam(sticker)`
  (restart an overlay sticker's slam) and `toast(el, text, ms)` (the comms toast; a new line replaces
  the old).

## Develop

```sh
npm ci
npm run check         # typecheck, contract tests (node), build
npm run size          # size budgets
npm run test:browser  # contract tests in Chromium (Playwright)
npm run test:webkit   # touch, pointer and pad in WebKit
npm run test:pack     # pack, install the tarball, import + typecheck every subpath
npm run api:check     # the COMPLETE bricks' API snapshots (api/) match the build
npm run api:write     # rewrite them after an intended API change (+ a CHANGELOG line)
npm run perf          # frame times, dropped frames, heap and GCs under a 4x CPU throttle
                      # (tests/perf/fixture: the home demo on a page of its own), and the alloc test
```

The website (fizlet.com) and the docs site live in their own repositories; this one is the
`@fzlt/core` package only (docs/SPLIT.md says where the rest lives). `npm pack --dry-run` lists what ships: `bin/`, `dist/`, the CHANGELOG,
the LICENSE and this README.

Releases: bump `version` in `package.json` (and the lockfile) and add a CHANGELOG entry; CI tags
`vX.Y.Z` on `main` after the checks pass, and `.github/workflows/release.yml` publishes that tag to
npm with provenance (it also runs on a `v*` tag pushed by hand). It publishes from `fizlet/fzlt` only,
and needs the `NPM_TOKEN` repository secret; without it the release job checks and packs, then skips
the publish with a warning.

API snapshots: `api/<brick>.api.txt` holds the public types of each COMPLETE brick (its built
declarations, comments stripped). CI runs `npm run api:check -- --base HEAD^`: it fails when a
snapshot no longer matches the build (run `npm run api:write`), and when one changed and the
CHANGELOG's `## Unreleased` does not name the brick (`@fzlt/core/fx`, or "Kernel" / "Board UI").
COMPLETE bricks keep their API, so that line says what changed; a breaking change moves the brick
back to BETA.

## Credits

Created by Chris Cooley · Built with fzlt · Sponsored by [coded.design](https://coded.design/).

## Licence

MIT © Chris Cooley
