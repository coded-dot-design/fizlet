# Moving DOM Battlefield onto the actor bricks

A migration note for E11 (`fizlet/actor`, `fizlet/aim`, `fizlet/view-dom`). The port comes later,
in the game's own repo. This note says what moves, in what order, and what has to stay the same.
Line numbers are from `coded-dot-design/dom-battlefield` at `d28afe5`, the 1.0 engine cut on Fizlet
0.20.0 (vendored at `vendor/fizlet`).

## Why this game first

- It is the only board game that needs all three bricks. Its tanks are DOM nodes (`src/view.ts`).
  It has grid line of sight and nearest-visible targeting (`src/model.ts`). It keeps pools of
  shots and effects. Battlefield Blitz and Swarm Protocol draw their units on a canvas, so
  `view-dom` has nothing to do there.
- It has seeded replays (`tests/replay.test.mjs`, `tests/model.test.mjs`) and a zero-GC test
  (`tests/zero-gc.test.mjs`) to catch a port that changes the battle.
- It is on Fizlet 0.20.0 already, and `scripts/size.mjs` sets its budget (73,000 B gzip), so the
  size ledger can show the change.

## What it does today

| Part | Today | On the bricks |
|---|---|---|
| Tanks | `interface Unit` objects (`model.ts:22-56`), all fields set to 0.5 placeholders so the shape never changes (`:500-535`); `id = side * per + i`; dead = `hp <= 0`; tanks never come back | `actors({ cap: 2 * per, sides: 2 })`, spawned team-major so row = today's `id`; `side`, `hp` / `max`, `x`, `y`, `a` (hull `angle`); `kind` = role index |
| Tank fields of its own | `turret`, `tread`, `recoil`, `cooldown`, `jam`, `scan`, `plan`, `target`, `focus` | One `Float64Array(cap)` / `Int32Array(cap)` each, indexed by row. `target` and `focus` hold handles (`A.ref(j)`); `A.get(h) < 0` replaces `live(s, id)` |
| Non-numeric state | `order`, `route: number[]`, `resume`, a per-unit `path: Int16Array` | Stays as it is, in arrays indexed by row and made once at setup. The bricks don't try to own it |
| Shots | 200 objects, `cut()` keeps the order (`:800-804`), `nextId++` keys the view | A second table, `actors({ cap: 200 })`: `vx`, `vy`, `side`, `max` = damage; life and owner as own arrays. `kill` + `sweep()` keeps the order, as `cut` does |
| Nearest visible | `nearestVisible` (`:840-857`): insertion-sort enemies under 10 cells, the first with `clearShot` wins, rescanned at 5 Hz | `aim.pick(i, A.list, A.n, Math.PI, 10, …)` with `foe` = alive and the other side, and `clear` = the game's own `clearShot` (see below). Nearest first, sight last, and ties go to the earlier row, as the stable sort does today |
| Nearest enemy | `nearestEnemy` (`:858-868`) | `A.nearest(i, Infinity, 1 << (1 - side))` (strictly nearer replaces, so ties go to the first, as today) |
| Turret aim | `u.turret = atan2(aim − u)`, fire at once (`:1059`) | Unchanged in the first port. Next, `aim.lead` (shells fly at 15 cells/s) plus `cone`, for a slewing turret |
| Tank nodes | `<button class="bf-tank">` made once per unit (`view.ts:123-151`); per frame a cached `translate(…)` string, `hidden`, `--hp`, class toggles behind a flags string (`:311-357`) | `viewDom(e, A, world, { make, scale: tile, turn: false, paint })`. `make(i)` builds the button, canvas and health bar, with the click listener. `paint(i, el)` keeps the sprite redraw, the `selected` / `commander` toggles and the minimap dot |
| Shell nodes | `<i>` per shot keyed by `shot.id`, a new `Set` and key strings every frame (`:358-420`) | `viewDom(e, shots, world, { scale: tile })`: one pooled node per row, no `Set`, no keys. Its rows' generations do what the ids did |

## Order of work

1. **Shots first.** They form the simplest table, they cause the view's per-frame `Set`
   allocation, and they don't touch targeting. Replays must match frame for frame: the order is
   kept, and so are the hit sub-steps and `Math.max(0, hp - damage)`. `hurt` lets `hp` go below 0,
   so the game keeps its own clamp on the tanks' `hp`.
2. **Tanks onto `actors`**, fields first and the view later. Keep `per`, the team-major spawn
   order and the role table. `target` and `focus` become handles. The replay and model tests are
   the gate.
3. **Targeting onto `aim`.** `pick` with the game's `clearShot` as `clear` keeps the battle the
   same. A later step, behind its own replay update, can swap `clearShot` for a `fizlet/grid`
   board: Bresenham over cells is not the same as sampling every 0.2 cells, so some corner shots
   would change.
4. **The view onto `view-dom`.** Tanks and shells. Check the cached transform first, because
   view-dom centres with `translate(-50%, -50%)` where the game subtracts 24 px today. Then check
   `hidden`, `--hp` (view-dom writes a fraction where the game writes a percentage, so the CSS
   changes to `calc(var(--hp) * 100%)`) and Recall in `tests/browser.mjs`.
5. **The site's arena** (`site/src/scripts/arena/sim.ts`) last, or as a warm-up. It is already
   built on typed arrays with fixed caps (10 tanks, 48 shells). Its swap-remove is written out by
   hand for every field (`:276`, `:282`, `:350-351`), and `sweep()` replaces it. Shells swap
   today, so a port keeps their order, and the hero's look can change a hair.

## What has to stay the same

- **Determinism.** Same seed, same battle. `actor` keeps spawn order through every sweep, and
  `pick` and `nearest` break ties to the earlier row, so the stable-sort and first-wins rules
  carry over.
- **Range edges.** Today a target counts when `d² < 100` (strictly under 10 cells). `pick`'s range
  is inclusive (`d <= range`), so pass a range a hair under 10, or accept that a target at exactly
  10.000 cells counts.
- **Zero GC.** `tests/zero-gc.test.mjs` must stay green. The bricks allocate nothing per step. The
  game's own step must keep doubles out of calls it doesn't inline, using its `F` registers.
- **Recall.** All the nodes go through the engine's ledger, so the game's Recall path (Escape)
  gives the page back with no special code.

## Size: the target

`scripts/size.mjs` (the app budget) is the ledger. The bricks add about 2.4 KB gzip on their own
(actor 908 B, aim 692 B and view-dom 882 B, measured alone; the steer `hypot` and the kernel ledger
are shared). The code they replace is about 350 lines of `model.ts` and 130 of `view.ts`. Whether
the game ends up smaller is measured at the port, not assumed here. Each step records
`Total: … gzip bytes` before and after in the game's CHANGELOG, and the E11 box is ticked only
when the total goes down.

## Gaps found while writing this

Both are in the bricks now, so the port needs no API changes:

- `aim` takes `clear(i, j)`: the game's own line of sight, used instead of a `fizlet/grid` board.
  DOM Battlefield's tiles are strings with their own "shell solid" rule.
- `view-dom` takes `scale`: px per world unit. The game's units live in cells, and the view
  multiplies by the tile size.
