# Changelog

## Unreleased

- **`fizlet/actor`** (new brick, E11, EXPERIMENTAL; 908 B gz, budget 1,229 = its planned target):
  units, bots, turrets and shots as one fixed-capacity table of typed arrays, the part every board
  game still writes itself (DOM Battlefield's `Unit` objects and its arena's hand-written
  swap-remove, Blitz's `Tank` roster, Swarm's 37 parallel arrays). `actors({ cap, sides, x, y, a,
  events })`: rows with `alive`, `side`, `kind`, `tags`, `hp` / `max` and a body (`x`, `y`, `a`,
  `vx`, `vy`, `r`); a game's own fields are its own arrays of length `cap`, indexed by row.
  - `spawn(side, hp, kind, tags)` takes a free row (-1 when full); `kill` marks it dead at once
    (out of `count(side)` and `live`) and `sweep()`, once per step after the loops that kill, gives
    the rows back. The list keeps spawn order through sweeps, so killing mid-loop never skips or
    repeats an actor and a seeded run replays row for row.
  - `hurt(i, damage)` is true on the kill; `heal` never goes over max; tag bits with `has` / `tag`;
    `nearest(i, range, sides, tags)` (side bits, inclusive range, squared distances: exact, no
    `hypot` needed; ties to the earlier spawn).
  - Handles outlive rows: `ref(i)` / `get(handle)` is -1 once that actor is gone, even when its row
    lives again (always a small integer, never a boxed double).
  - Shares a body with `fizlet/steer`: `actors({ cap, x: m.x, y: m.y, a: m.a })`.
  - With `events: engine.events` it rings `actor:spawn`, `actor:hurt`, `actor:kill` (row, side,
    where in whole pixels, damage). Whole pixels because a double handed to the ring from a step too
    big to inline costs a heap number; a small integer never does.
  - Tests: `tests/actor.test.mjs` (spawn and refuse, kill and sweep order, killing mid-loop, hurt and
    heal with events, stale handles at any capacity, tags, nearest, a shared steer body, a seeded
    replay, 0 young GCs over 1M steps of 48 actors spawning, fighting and dying, best of 3 windows).
  - Status: EXPERIMENTAL in `site/bricks.mjs` (since 0.21.0) with a generated brick page and a
    README row; BETA once a board game runs on it. Out of PLANNED; E11 lists it as shipped, with
    `fizlet/aim` and `fizlet/view-dom` still planned.

- Roadmap: E0 is nearly done. The Battlefield archive selector (dom-battlefield#20) and the hub's TEST A RELEASE list of every game version (dom-virus#26) are shipped; only the `engine-baseline` tags remain (owner, needs tag push).
- **Kernel: `engine.busy(seconds)` holds a settling engine awake for something scheduled.** An
  intro delay, a pause between beats or an autoplay timer counted down in `step` without `busy()`
  could lose to `settle`: the engine slept before the scheduled thing happened (#026's intro, about
  1 run in 3). `busy(sec)` keeps the engine awake for `sec` of its own time, then settle counts
  from there. A later, shorter hold never cuts a longer one; `busy()`, `busy(0)` and `busy(NaN)` are
  the plain "something moved" call.
  - Settle now counts engine time (steps), not wall time. On a slow page whose frames drop steps,
    wall time runs ahead of the engine's own, so a plain `busy()` with settle 0.6 used to sleep
    after 0.27 s of engine time on 250 ms frames; now it waits the full 0.6 s.
  - One value instead of two: the quiet clock becomes "the engine time settle counts from"
    (`busy()` sets it to now, `busy(sec)` to now + sec, at least), and the `moved` flag is gone.
    `wake()` is `busy()`, so a hold asked before the engine runs (a scene's intro, at mount)
    survives start and wake.
  - Sizes (gzip, measured on the 0.20.0 release train): kernel 3,443 → 3,438 B; page build (kernel +
    slot + input + fx) 7,164 → 7,166 B (cap 7,168); arcade with `hud` omitted 18,351 → 18,348 B;
    the layers hero's live chunk 9,720 → 9,724 B (the 5% margin under 10 KB, ≤ 9,728, unchanged).
    No budget moves.
  - Tests: a hold keeps the engine awake for its length, then settle (also on 250 ms frames); a
    hold asked mid-run counts from there; a hold asked before start survives start and wake; a later shorter hold never cuts a longer one; 0 and NaN
    are plain `busy()`; 1M steps calling `busy(sec)` allocate nothing.
- **Gallery: scheduled intros hold the engine.** #023 (red cape) waited 0.5 s before its intro
  without keeping the engine busy (settle 0.6 s); #026 (the landing) waited 0.6 s (settle 0.6 s)
  and was fixed by counting the wait as busy. Both now call `engine.busy(wait)` when the wait is
  set (at mount). The settle guard below found #023 and confirmed #026.
- **Settle guard** (`npm run test:settle`, in CI after the site build; `tests/settle-guard.mjs`):
  every gallery entry, live and archived, runs alone on its gallery page in Chromium with a probe in
  the kernel, and must play its autoplay story through without a quiet stretch that turns busy again
  by itself, then stay settled once woken with nothing pending. It failed on #023 and on #026
  before these fixes in 3 of 3 runs each.
- **`fizlet/css-clock`** (new brick, 477 B gz of its own; 5,377 B on 0.20.0 with the kernel and timeline it
  composes, budget 5,632): a page's own CSS `@keyframes` on the kernel clock, so a site's ambient
  loops (blinks, pulses, diagram loops, patrols) eat the dog food without being rewritten. The look
  stays in the stylesheet: each animation is `paused` and reads its time from one custom property,
  `animation-delay: var(--fz-t, 0s)` (or `calc(var(--fz-t, 0s) + <its own delay>)`); a timeline
  moves that property through the ledger. `cssClock(root, { span, loops, prop, fps, motion, signal })`
  → `{ engine, tl, play, hold, destroy }`. One shared requestAnimationFrame; off screen or in a
  hidden tab, no frames; after `loops` plays of `span` seconds it rests on frame one (every
  animation whose duration divides `span`) and the engine settles; a pointer, focus or coming back
  into view plays it again; reduced motion lands on the rest frame at once; `destroy()` is Recall.
  - Tests: `tests/css-clock.test.mjs` (clock, rest, settle, replay, hold, reduced motion, Recall) and
    `tests/css-clock.mjs` in Chromium (real paused keyframes follow the clock mid-way, an own delay
    composes with `calc()`, settled at 0 frames on frame one, Recall byte for byte).
  - Status: BETA in `site/bricks.mjs` (since 0.21.0; fizlet.com ships it, its API may still move),
    and a README row.
- **Website: the last two CSS loops are on Fizlet.** The home demo's "CLICK THE PAGE" blink and the
  roadmap's current-phase pulse (the kit's `bui-locked`) run on `fizlet/css-clock`: four blinks and
  three pulses, then they rest and settle (before: infinite CSS loops). `demo.js` 10,070 → 12,077 B
  gzip (+2,007 B: timeline and the brick; the kernel was already there).
- **Site: on phones the layers story waits for a tap.** On a coarse pointer or at ≤ 600px (the
  site's phone rule), the hero starts on the poster pose with the Board UI Play key showing, and
  it asks for no frames until a tap. Desktop still autoplays. Each autoplay frame cost a 4× phone
  about +40 idle points of main thread over the poster page. Paused, `npm run perf:page` measures
  mobile idle at −3.6, −2.8 and +3.5 points over three runs (budget +10). `tests/layers.mjs`
  covers a 390px window and a 1024px touch device (paused, no frames, a tap plays). Poster +
  loader: 5,398 B gzip (+27 B). The live chunk is unchanged (9,720 B on 0.20.0).

- **Fix: the layers story no longer shifts the page's layout as it opens (`index#layers`, CLS
  +0.002 → 0).** As the story fanned the layers out, its slider's knob moved by `bottom`/`left`
  and its rail squares spread by a growing flex `gap`, so the browser counted each frame as a
  layout shift. The PerformanceObserver gave the knob `.lyr__k` and the rail's `i` squares as the
  sources. Both now move by `translate`, measured in container units on the slider (`.lyr__sl`
  is a size container; the figure's container is named `lyr` so its orientation queries still
  read the figure). They draw where they did before: a pixel diff at 1440 and 390 for `--e` 0,
  0.5 and 1 shows 0 changed pixels at rest and sub-pixel antialiasing only on the moving squares.
  `tests/layers.mjs` now fails on any layout shift over a full cycle. Poster + loader: 5,371 B
  gzip (+102 B; budget 6,144). The live chunk is unchanged (9,720 B on 0.20.0).
- **Site: the home page reads shorter, and every link follows the site nav rules.** The sections
  below the fold reveal as they come on screen: a divider draws in, then the head and the panels
  stagger up. The hero grid and a big ghost number per numbered section drift with a light
  parallax. All of it runs on Fizlet itself (`site/home-motion.ts`: one settling engine and
  `fizlet/timeline`, with parallax as paused timelines scrubbed by `seek()`). It moves only opacity,
  scale and translate, so there is no layout shift. It is still once the scroll stops,
  hides nothing without JS, and does nothing under reduced motion. The home brick cards are now
  compact: each snippet lives on its brick page, and the name's long story moved to `demos/fizz/`.
  The home page is 13,578 px tall at 1440 (was 15,756) and 22,884 px at 390 (was 27,063). An
  "On this page" strip jumps to each numbered section. Nav: the header lists the top-level pages
  (Notes and Contest added; Recall and Games now live in the strip). Header and
  footer links show where you are (`aria-current`). Every deep page has breadcrumbs (`crumbs()`
  in `site/layout.mjs`). External links end in ↗, and the footer reaches every section, demos
  included, so `examples/fizz/` is no longer an orphan. `scripts/check-nav.mjs` checks these rules
  on every build in `npm run test:site`, with unit tests in `tests/check-nav.test.mjs`. The site
  test also checks the reveals, reduced motion, settling and layout shift. Two press fixes: a
  revealed section (positioned) no longer covers the base of a key on the previous section's
  bottom edge (its box lets the pointer through, its content takes it back), and `.hero` is
  `overflow: clip`, so the parallaxed field never gives a focus or `scrollIntoView` a hidden
  scroll to move. The site test's `revealAll` and the home rhythm check wait on the reveals' state, not on time.

## 0.20.0

- **Gallery: the 7 kept pieces, rebuilt by hand as micro games** (owner approved, 2026-10-30). Each
  has its own stage (`stage: "own"`, `site/gallery/stages/<id>.html`) and story; page text moves
  only where the game hits it.
  - #004 Sparky's workshop (pink sparks): a welding robot strikes an arc where you tap; sparks
    bounce, scorch and fade, and one landing on the firework's fuse may set it off.
  - #005 The rainy neon street (neon rain): taps raise the storm; drops short the real FIZLET sign
    only where they hit it, and the third short blows it.
  - #020 POW! BAM! ZAP!: click the Glitch to land hits with knockback; miss and it hits back; KO it
    and the next one comes back tougher.
  - #021 Here comes the rush (speed lines): a rocket bowls over the real heading's letters, the
    wind leans the ones it passes, STRIKE for a whole line, and the "!" is a heavy pin.
  - #022 Attack of the Halftone: each click prints a plate as a halftone dot wave; the cover is a
    surprise until the black plate lands; about one sheet in four is a MISPRINT.
  - #023 The night patrol (red cape): the gust swings each real pennant only as he passes it; a tap
    dashes him into the city (bonks, waking windows, a leaking water tower, a cross moon).
  - #026 The landing (hero lands): a three-point landing on its own landing page, a crater that
    fades, a shockwave that knocks only the letters and buttons it reaches, and a cat that may end
    up on his head.
  - Posters are drawn from the scenes themselves (`scripts/gallery-posters.mjs`,
    `scripts/pixel-posters.mjs`). Their frames-per-second and allocation lines are not re-measured
    yet, so the cards leave them out.
- **Fix: the heroes page's Prev key is served disabled** (the row starts on the first card), not
  disabled only once the carousel's IntersectionObserver runs. The phone key check could list it as
  enabled and then tap a disabled key (a flake on main too); it also waits for the centre card.
- **Status flags on every brick; Fizlet launches as a 0.x public beta.** One source,
  `site/bricks.mjs`: `STATUS` (COMPLETE "done, and always getting smaller and faster", BETA,
  EXPERIMENTAL, ROADMAP, DEPRECATED, each with written criteria) and per brick `status`, `since`,
  `tests`, `used` (released games and pages that ship it) and `why` (what keeps a BETA brick from
  COMPLETE); `PLANNED` lists the ROADMAP bricks with phase, purpose, size target and dependencies.
  At 0.19.0: 14 COMPLETE, 9 BETA (grid, camera, hud, match, presence, steer, coach, timeline,
  board-page: tested only in the browser, no allocation test yet). A COMPLETE brick's `used` names
  the releases that ship it (rules: DOM Battlefield 1.0.0, Blitz 0.8.0+, Null Invaders and Sherman
  Bytes 1.0). The
  README table gains a Status column and a Status flags section; brick pages show the flag as a
  Board UI status pill with its evidence; the bricks index adds the pills, the criteria and the
  planned bricks; the home page says "public beta" under the byline. `tests/status.test.mjs`
  checks the evidence (test files exist, `since` is a release, COMPLETE names a shipped user, BETA a
  why, planned bricks aren't exported) and that the README agrees.
- **README sizes come from the build.** `npm run readme:sizes` rewrites the "What's in the box"
  size column and the kernel's measured bytes from `scripts/sizes.mjs` (the CI budget's measure).
  It is a release step, not a PR gate: `land.py bump` runs it, the release workflow fails on a stale
  README (`--check`), and `tests/status.test.mjs` proves the generator on a fixture. Corrected at 0.19.0: kernel 3.4 KB
  (3,439 B), slot 1.8, board-page 4.0, fx 2.7 (the whole module), camera 1.4, presence/check 4.8,
  arcade 17.5 / 21.5, ui 2.8 + 4.8 KB css.
- **Website: the roadmap runs E0 to E16, ticked only with evidence.** E1, E2 (re-scoped: the 22
  bricks shipped; layout, view and actor bricks move to E10/E11) and E4 (re-scoped: two players on
  the live site; Battlefield matches and AI players move to E12) are done; E0, E3, E5–E8 list what's
  left; E7 (page interactions) and E8 (the game kit) are new; E9–E16 are planned with their bricks.
  The games section and README say what's true now: every DOM VIRUS game runs on Fizlet.
- **Website: the roadmap has one source, `site/roadmap.mjs`.** The home page's section 09 renders
  it (phase range, launch scope, pills and boxes all from the data; no phase written in
  `pages/index.mjs`), and a planned phase lists its ROADMAP bricks from `site/bricks.mjs` `PLANNED`
  with their size targets. Statuses use the engine ROADMAP's words (done, partly, nearly, in
  progress, started, planned), so the engine side can check that both say the same thing.
  `tests/roadmap.test.mjs` checks phases in order, the launch scope (E0–E8) vs planned (E9–E16),
  ticks that agree with each status, every planned brick under its phase, and that the page shows
  exactly the source.
- **fizlet/arcade's skirmish preset runs its flow on `fizlet/match` (G15).** One owner of the phase:
  the countdown, pause / surrender and result are match's, on a small engine of its own that lives
  as long as the overlay (Recall destroys it, and its ledger takes the overlay back). The shell keeps
  the keys (P, Escape, the bar's pause key) and asks: `pause()`, `resume()` and the end go to the
  HUD's new `ask` when it has one, and the HUD answers through `HudRun.go` (pause, resume, won,
  lost, restart, exit). The countdown is on the flow's clock (was three 600 ms wall-time timers), the
  game's engine waits for it; the result sticker outlives the game's engine (whose end gives the page
  back) until REMATCH, EXIT or Recall; a hidden tab pauses with BATTLE PAUSED; surrender waves the
  white flag (WHITE FLAG / GAME OVER). The preset's own overlay code is gone. Card games (`hud` left
  out or `arcadeHud()`) behave as before: tests/arcade-hud.mjs still checks the card byte for byte.
  Sizes: arcade 23,990 B gzip (+2,015 B: match in the bundle, less the overlays it replaced; budget
  22,016 → 24,064); the card build 18,033 B (+62 B: the flow contract; budget 17,984 → 18,048).
- **skirmishHud: the keys a game asks for.** `nav: ["auto", "next", "restart"]` adds Auto fire
  (with `fire`), Next gate and Restart to the bar, as on the card; `header` takes `fold` (hides the
  title and the text keys). Default: none, so existing bars are unchanged. On phones the bar's keys
  wrap to another row instead of pushing the exit key off screen.
- **fizlet/match: `on(phase)` and `hide`, and three contract fixes** (brick audit P-items), each
  tested and each test failing on the old code:
  - a settling engine stays awake through the countdown and play (`busy()` in step); before, the
    countdown and clock froze once the engine settled;
  - no layout read on a phase change or countdown beat: the sticker slams by re-insertion instead
    of the kit's `slam()` (an `offsetWidth` read, a forced reflow each time);
  - the white flag's 480 ms wait is cleared by `destroy()` (it outlived Recall), and a destroyed
    engine's match is inert (no transition writes past Recall).
  - `on(phase)`: each phase change once painted (not the first intro); `hide`: phases that show no
    overlay. fizlet/match 2,652 B gzip (+54 B).
  - Tests: `tests/match.test.mjs` (settle, `on`, inert after destroy, the arcade flow's zero
    allocation over 1M frames, best of 3 windows, `--test-concurrency=1`), `tests/browser.mjs`
    (no layout reads, the slam restarts, the flag's wait cleared), `tests/arcade-hud.mjs` (the
    skirmish flow end to end, the nav and fold keys).
- **Fix: a sprite id that names no sprite throws instead of drawing another sprite.** In
  `sprites()`, an unknown name, an index past the end or a fraction made a cache key of 0, so once
  sprite 0 was baked `tile("typo")` returned sprite 0's tile and `draw()` silently painted nothing.
  `tile()` and `draw()` now throw a `RangeError` ("fizlet/sprite: no sprite …"), like `need` does
  for bad options. Test: `tests/bricks.test.mjs` ("an id that names no sprite throws"); `draw`
  still allocates nothing once baked. fizlet/sprite 1,403 → 1,437 B gzip (budget 1,536).
- **fizlet/input: intents resolve once; `id()` gives a step a number.** `down`, `hit` and `axis`
  looked an intent up with `names.indexOf` on every call: a scan of the names in the step. Each
  intent now resolves once, at setup, in a Map keyed by its name and by its number, so a lookup is
  one Map read, never a scan. New `c.id("fire")` returns the number for hot paths (`c.hit(FIRE)` in
  a step); a name that is no intent throws there, at setup. Names keep working everywhere.
  Test: `tests/bricks.test.mjs` "input: intents resolve once…" (handle and name read the same over
  65 intents, a typo throws, 0 young GCs over 1M frames by number). Size (gzip): input 1,287 →
  1,335 B; page build 7,126 → 7,161 (budget 7,168 kept); arcade 21,973 → 22,015; arcade (`hud`
  omitted) 17,967 → 18,024. The arcade budgets rise by exactly those deltas (22,058; 18,041), with
  the reason in `scripts/sizes.mjs`.
- **Fix: an on-screen key wakes a settled engine.** `controls().press()` and `steer()` now call
  `engine.wake()`, as a real key or pointer already did. A `fizlet/pad` key is
  `[data-fizlet-ignore]`, so its tap never reached input's own wake: on an engine with `settle`, a
  tap was latched but not stepped until something else woke it. Test: `tests/bricks.test.mjs`
  ("press() and steer() wake a settled engine"). fizlet/input 1,283 → 1,287 B gzip; arcade
  21,970 → 21,973; arcade (hud omitted) 17,964 → 17,967; page build 7,127 → 7,130 (all in budget).
- **Fix: the fps cap counts its slot from the frame's start, not the end of its work.** A capped
  engine napped `1000/fps − 4` ms after its hooks finished, so a frame whose work took longer than
  the 4 ms slack missed its slot by a whole vsync: at 4× CPU the battlefield.domvirus.com hero
  (`fps: 30`, ~13–28 ms a frame on a 390 × 844 phone) ran at 21.6–21.9 rAF/s instead of 30. The nap
  is now shortened by the frame's own work time (`timing[1]`), never below 0. Test:
  `tests/kernel.test.mjs` ("a slow frame still meets its next slot": 20 ms frames, 20 → 30 fps;
  the fake display's timers now count each frame's work). Kernel 3,441 → 3,443 B gzip (a negative
  nap is left to `setTimeout`, which clamps it to 0); page build unchanged (budget 7,168).
- **Fix: `destroy()` clears the fps cap's pending wake-up.** An engine with `fps` waits off the
  shared clock on a timer between frames; `destroy()` left that timer to fire once more (harmless,
  but it held the engine until then). It now clears it, so nothing of the engine outlives
  `destroy()`. Test: `tests/kernel.test.mjs` ("destroy() clears the pending wake-up timer").
  Kernel 3,439 → 3,441 B gzip; page build 7,127 → 7,128; arcade 21,970 → 21,973; arcade (`hud`
  omitted) 17,964 → 17,963.
- **Website: gallery numbers are given at land time, never in a PR.** Parallel PRs each took "the
  next number" and kept claiming the same one (three PRs on #047). `scripts/gallery-number.mjs`
  holds the rule, pure and shared with the engine's land step (`fe anim number --write`). Existing
  numbers stay; a live entry without one takes the next free number by approval date, then merge
  order, then id; a pending entry has none. When two entries share a number, the first to land keeps
  it. The build shows a live entry's coming number (so a PR builds) and fails on a shared number,
  naming the entries and the fix. Tests: `tests/gallery-number.test.mjs`.
- **fizlet-rooms: hardened for launch (brick audit 2, S1–S5).** Needs `wrangler deploy` (owner's go).
  - **First input wins at the relay (S1).** A seat's `INPUT` and `HASH` frames must rise: a second,
    different input for a frame, or an older frame, is never relayed, so one peer can't split the
    others (fizlet/presence keeps the first one too, in its own PR).
  - **Invite codes out of URLs and logs (S2).** `POST /invite` with the code as a text body, and the
    WebSocket subprotocols `["fizlet-rooms", "invite." + code]` (the `101` answers `fizlet-rooms`).
    `?code=` / `?invite=` still work for one release. `wrangler.toml` turns invocation logs off
    (they record URLs); the worker logs nothing itself. Codes that travelled in URLs should be
    rotated after the deploy (DEPLOY.md).
  - **Rate caps and longer codes (S3).** `GATE_RATE` (30): invite checks + joins per IP a minute,
    counted in each Worker isolate, refused with `429` before the KV read. `JOIN_RATE` (10): joins
    per IP a minute into one room, counted by the room before a socket is accepted. Both are free
    (no binding, no KV), with ceilings in `src/limits.js` like every cap. Codes are now 10 to 64
    characters (was 6); the invite helper makes 15.
  - **No room squatting (S4).** Only relayed messages and seats taken keep a room alive; a lone
    player's refused messages and "room full" joiners no longer do, and a room not full
    `LOBBY_SECONDS` (90) after its first seat closes with `1001 room not filled` (it could be held
    open for 30 min).
  - **Threat model (S5):** `rooms/THREAT-MODEL.md`, what is protected and what isn't. CI runs
    `cd rooms && npm test`.
  - Tests: `test/room.test.mjs` (new: the Worker and the Room on platform fakes; each test fails on
    the old code), relay and limits tests; `test:wrangler` adds the lobby timeout, `POST /invite` and
    the subprotocol invite through real workerd. Ran: `npm test` 16/16, `npm run test:wrangler` ✓.
- **fizlet-rooms: rooms of up to 4 players, and `/invite` says the room size.** `wrangler.toml`
  `MAX_PLAYERS` 2 → 4 (the code ceiling stays 8 in `src/limits.js`); `GET /invite` now answers
  `{"ok":true,"players":<MAX_PLAYERS>}` so a page offers only room sizes that can join (Blitz's
  multiplayer page shows its 2 · 3 · 4 pick from it; an older answer without `players` means two).
  Relay unchanged: it already seated any count. Cost: a 4-player room relays each input to three
  sockets instead of one (MSG_RATE per socket is unchanged). Needs `wrangler deploy` (owner's go).
  `test/relay.test.mjs`: a four-player room (seats, fan-out to the other three, a leave told to all).
- **CI: one run per change, not two.** `Fizlet checks` ran on `push` and `pull_request`, so every
  push to a branch with an open PR ran the whole workflow twice. Push now runs on `main` only
  (`tag-version` and `release` are unchanged); branches are checked by their PR run. On
  2026-10-30, 35 of the 90 runs were these duplicates: 159 of 401 wall minutes (40 %).
- **`PERF-LOG.md`: every perf win, one measured line each.** Generated from `tests/perf/wins.json`
  by `node scripts/perf-log.mjs --write` (never by hand); each row has before → after, how it was
  measured, the test that holds it and the PR. First entries (0.19.0, #67): the fps cap caps rAF
  (home at 1440, 119.6 → 28.5 rAF/s) and the demo settles (60.4 → 0 rAF/s). `tests/perf-log.test.mjs`
  fails when the log is stale or an entry has no measured number, PR or test.
- **Phones: taps and swipes never zoom or pan the page** (owner: "for mobile all of our pages right
  now need to lock down double tap and pinch to zoom… the pages get all out of shape").
  - **`fizlet/touch`** (new brick, 310 B gzip, budget 512): `lockTouch(doc, sel)`, one delegated,
    non-passive listener set that cancels iOS Safari's `gesturestart` / `gesturechange` (its pinch
    ignores `user-scalable=no`) and any multi-touch start or move on the surfaces matching `sel`
    (default `SURFACES`: slot stages, game hosts, the pad, draggable grips, `[data-touch-lock]`).
    One finger is never touched, so taps, drags and scrolling stay. `null` locks the whole page (a
    full-screen board). Returns `release()`.
  - **Board UI kit (CSS):** `.bui` is `touch-action: manipulation` (no double-tap zoom) with
    `text-size-adjust: 100%`; game hosts and `[data-touch-lock]` are `touch-action: none`, slots
    (`.ae-slot`, `[data-fizlet-slot]`, `[data-touch-lock="y"]`) `pan-y`, all
    `overscroll-behavior: none`. Slots stay `pan-y`, not `none`, so a hero that fills a phone never
    traps the page's scroll; a swipe game sets `none` on its stage.
  - **Every arcade game, automatically:** while a run is live the page is the board, so `arcade`
    calls `lockTouch(document, null)` (no pinch or iOS gesture anywhere) and sets
    `touch-action: manipulation` on the page through the ledger (no double-tap zoom, scrolling
    stays); the engine's end releases both, so the page comes back exactly. Budgets rise by the
    measured cost (owner-approved): `fizlet/arcade` +174 B (22,089 B, budget 22,190), the card build
    +181 B (18,093 B, budget 18,101). `tests/arcade.mjs` checks the lock and its release.
  - **fizlet.com:** every page runs `lockTouch` on the demo surfaces (home demo, brick demos,
    timeline, labs, slots); they are `pan-y` and the full-screen hero `none`. Content pages keep
    pinch-zoom on the copy (WCAG 1.4.4); only the double-tap zoom and the surfaces are locked. The
    fizz example does the same.
  - `tests/touch.mjs` (Chromium, 390 × 844, touch, mobile; in `test:browser`): pinch, double-tap
    and swipe on a slot and a game host leave `visualViewport.scale` at 1 and the page 390 wide; a
    game host never scrolls, the page still scrolls through a slot, the copy still zooms, and the
    unlocked control page does zoom and scroll. `test:site` checks every page on a phone:
    `touch-action: manipulation` on the page, every demo surface `none` or `pan-y`.
  - **Status: BETA** in `site/bricks.mjs` (since 0.20.0; no released game ships it yet) and a README
    row. `tests/status.test.mjs` accepts a `since` that is the coming release (newer than
    package.json's version, with an Unreleased section) as well as a released one.
- **Fix: fizlet/hud's events zero-allocation test no longer flakes; an event frame reads no DOM.**
  The feed and banner read `el.children` on every frame with an event, not only on the first. On
  the test's fake DOM each read built a new array, about 12 MB per 1M frames; a real `children`
  is a cached live collection, but still a DOM call per event. The GC count of the same bytes
  scaled with the young generation V8 chose: 3 scavenges at ~4 MB each, 14 when a loaded machine
  had shrunk it to ~1 MB (`--trace-gc`). Ring numbers passed to `line`/`text` were not it (whole
  numbers stay small integers). Rows and text nodes are now found once, on the first event. The
  events window measures 0 young GCs and its bound drops from 10 to 1 (the test's banner returns
  an array it holds); a new check counts `children` reads on later event frames (fails on main).
  fizlet/hud 1,320 → 1,325 B gzip; arcade 21,970 → 21,980.
- **Fix: fizlet/pad's `stickAt` and `dpadAt` allocate nothing (K5).** `stickAt` said "never
  allocates" but called `Math.hypot`, which boxes its arguments: 23 young GCs per 1M fractional
  drags. `stickAt`, `dpadAt` and the stick drag now use fizlet/steer's exact `hypot` (the same bits
  as `Math.hypot`): 0. Test: `tests/bricks.test.mjs` "pad: stickAt and dpadAt allocate nothing"
  (fails on main with 23). Size (gzip): pad 1,995 → 2,073 B; arcade 21,970 → 22,037; arcade (`hud`
  omitted) 17,964 → 18,040. Each budget rises by exactly that delta (pad 2,126; arcade 22,083;
  card 18,060), with the reason in `scripts/sizes.mjs`.
- **Fix: fizlet/board-page's `hit` computes its query radius with the exact `hypot` (K5).** It used
  `Math.sqrt(dx * dx + dy * dy)`, which differs from `Math.hypot` in the last bit for about 40% of
  inputs (the games' `dist` is exact, so a replay keeps every bit). It now uses fizlet/steer's
  `hypot`. Test: `tests/bricks.test.mjs` "K5: no plain-sqrt distance in a brick" scans every
  source (fails on main at `src/board-page.ts:261`). Size (gzip): board-page 4,097 → 4,162 B;
  arcade 21,970 → 22,023; arcade (`hud` omitted) 17,964 → 18,024. Each budget rises by exactly that
  delta (board-page 4,193; arcade 22,069; card 18,044), with the reason in `scripts/sizes.mjs`.
- **Tests: no wall-time waits of 300, 500 or 1000 ms; the fx "full pool" check counts work, not
  milliseconds.** `tests/browser.mjs` waits on the launch burst being gone (was 1 s), on 30 engine
  frames for "one rAF for many engines" (was 500 ms) and on the offscreen / onscreen pause state
  (was 300 ms twice); `tests/arcade-hud.mjs` holds fire until a shot is out (was 500 ms);
  `tests/labs.mjs`, `tests/virus.mjs` and `tests/layers.mjs` count page frames (was 300, 500 and
  300 ms). Every wait is capped. `tests/bricks.test.mjs` "a full pool stops the blast's work" no
  longer asserts `ms < 20`: two pools on one visual seed show that ten 1e6-power blasts on a full
  pool draw exactly what ten tiny ones do (it fails if the work scales with power). No source change.
- **fizlet.com: the two stylesheets every page loads are minified.** `npm run site` writes
  `board-ui.css` and `site.css` through esbuild's CSS minifier instead of copying the readable
  sources: board-ui.css 8,301 → 4,884 B gzip (exactly the `fizlet/ui (css)` number the bricks
  page quotes, now what the site serves), site.css 11,530 → 9,091 B; 5,856 B gzip less on every
  first visit. The npm package's `dist/ui/board-ui.css` is unchanged (consumers minify).
- **Gallery: DOM Virus, two hand-built micro games (pending the owner's approval).** A new theme,
  `dom-virus`, with #047 **Terminal virus**: a worm types itself into a terminal, crawls onto the
  README beside it and eats its real letters (each bite rewrites a character of the page's own
  text through the ledger), forking a new pid every four letters. Tap a worm to `kill -9` it: it
  bursts, the blast knocks its neighbours tumbling, and every letter it chewed flies home as a
  packet and is written back exactly. Let it eat half the page and the kernel panics, then Recall
  rolls the whole page back. And #048 **Petri dish**: virus cells drift, collide (circle
  collisions, mass by size) and split under a microscope; a zap bursts a cell, and its shockwave
  bursts any cell caught mid-split, so a well-timed zap sets off a chain. Gold mutants split
  faster and take two zaps; at 40 cells a UV sweep sterilises the dish. Dark is a fluorescence
  scope, light a brightfield one. Bricks: kernel, `fizlet/steer`'s exact `hypot`, slot; both
  settle to no frames, no allocation in step, a still poster under reduced motion. Live sizes
  (gzip, measured): terminal virus 8,076 B, petri dish 7,608 B (kernel 3,353 B of each).
  `tests/virus.mjs` (in `test:browser`) plays both: kills and zaps have their consequences, the
  README reads exactly as before once every worm is dead, both settle, a tap plays again,
  `destroy()` mid-play gives the page back byte for byte, and reduced motion loads nothing.
- **fizlet/presence: first input wins (security).** A peer that sent two different inputs for one
  frame could split the other peers' sims: one ran the frame with the first input, another got the
  second before its step (brick audit 2, S1). Now a second INPUT or HASH for a frame a seat already
  sent is dropped and counted in `dropped`, and the pre-filled frames before `delay` can't be
  rewritten. Honest peers send one input per frame, so nothing changes for them. fizlet-rooms
  drops the same duplicates at the relay (its own PR). Test: `tests/presence.test.mjs` (a cheating
  seat 0, one peer stepping between the two inputs; fails on the old code). +14 B gzip (1,792 →
  1,806 / 2,048), with:
- **fizlet/presence: `join(url, signal, protocols)`.** The protocols go to the WebSocket handshake,
  so a page can hand fizlet-rooms its invite code as `["fizlet-rooms", "invite." + code]` instead of
  in the URL (URLs land in request logs). Optional; `join(url)` is unchanged.
- **Fix: fizlet/sound no longer crashes on an event or cue named like an `Object.prototype` key.**
  `o.cues[ev.type]` with an event type such as `"constructor"` or `"toString"` (a timeline label
  can be anything) found a function, `NOTES[fn]` was undefined, and `for…of` threw in render, so
  the engine's `onError` stopped the game; `play("toString")` from JS did the same (brick audit 2,
  P10). `play()` now plays only cues that are `NOTES`' own keys (`Object.hasOwn`), so unknown cues
  are ignored for the synth and a custom `play` alike (`Cue` already names the nine). An own
  `cues.constructor` mapping still plays. Test: `tests/sound.test.mjs` (new; the old code throws
  "NOTES[cue] is not iterable"). Sizes: sound 1,000 → 1,015 B gzip; arcade 21,970 → 21,981;
  the card build 17,964 → 17,979, so its budget rises by the same 15 B (17,984 → 17,999,
  reason in `scripts/sizes.mjs`): with fizlet#103 (+7 B) it would be 2 B over the old budget.
- **Fix: `slot("page#slot", …)` finds astro-engine's current slot markup.** The engine now renders
  `<figure class="ae-slot-figure"><div class="ae-slot" data-slot-target role="img">…</div><figcaption
  class="ae-slot__fallback">` (the caption outside the role="img" box), and `findSlot()` looked only
  for `figure.ae-slot`, so the target found nothing. It now matches any `.ae-slot[data-slot-target]`,
  the figure or the box; the caption outside the box stays visible while the scene runs.
  `tests/browser.mjs` mounts a scene in both shapes. fizlet/slot 1,852 B gzip (−4 B); page build
  7,122 B (−5 B).
- **Docs: no private pointers.** The README no longer links a private repo (astro-base-engine), and
  `rooms/DEPLOY.md` makes invite keys with the public `inviteKey()` (a one-line command) instead of
  a helper outside this repo. No code change.
- **Website: Make one (`/make/`), v0.** Type a prompt, get one drop-in file: a `data-fizlet`
  mount and one module script with only the bricks the scene uses, its gzip size measured into its
  own header, by Chris Cooley, MIT. It all runs in the browser: the prompt is matched against the
  gallery's recipe set (`site/make/make.mjs` + `table.json`, generated by the engine, the same
  matcher `fe anim` runs), the scene's template is prebuilt at build (`make/templates/`), and the
  size is measured with `CompressionStream`. Live preview in a sandboxed frame, Copy snippet and
  Download; the page shows which words matched and says unknown words are logged nowhere (no server,
  no tracking). Every gallery entry made from a prompt gets a **Get the snippet** key (the same
  file). Snippets settle to zero frames once still, never run under reduced motion, and
  `el.fizlet.slot.destroy()` gives the page back (tested in `tests/site.mjs`).
- Gallery: the five how-it-works labs (#042–#046) approved by the owner and live.
- **Fix: a dragged scoreboard no longer jumps when its board is not the viewport.** `drag()`
  (fizlet/arcade's panel drag, also used by Battlefield Blitz) set `left`/`top` from viewport
  coordinates and replaced the card's whole inline style, so a board under a page header, mid-page
  or scrolled made the card jump on the first move. It now measures the card's containing block
  (its offset parent's padding box) once on pointerdown and sets only `left`, `top`, `right`,
  `bottom` and `translate`. `tests/drag.mjs` drags a card in a bordered board under a header,
  scrolled. Arcade with `hud` omitted: 17,964 B gzip (+52 B; budget 17,920 → 17,984).
- **Gallery #051 "Big things, small packages"** (micro game, new theme Dev humor; approved by the
  owner). A pixel dev drags a package.json crate across a Board UI arena while
  dependencies keep raining onto it (twelve a round, never past seven high). Tap one to cut it: it
  shatters into shards that bounce off the floor, the stack, the crate and the dev
  (`fizlet/collide`), and what was above it drops with a bounce. Cut them all and the crate shrinks
  to the glowing Fizlet box, which flies to his hands: "Big things come in small packages", with the
  kernel's gzip size measured by the same build (`scripts/site.mjs` puts it on the figure as
  `data-kernel-gzip`; without it the scene shows no number at all). Tap again to play again.
  - One world, two outputs: `site/gallery/pieces/small-packages/world.ts` paints palette indices
    (Board UI tokens, dark and light; the page's theme picks) for the live canvas and for the two
    build-time posters (SVG runs). Reduced motion: the poster is the whole joke and a tap shrinks
    it (a checkbox and `:has()`, no script; the scene never loads).
  - Bricks: kernel, collide, slot. Live chunk 8,557 B gzip (≤ 9,728 B); settles to 0 frames,
    pauses off screen, Recall exact (Chromium 153). `tests/small-packages.mjs` (in `test:browser`)
    plays a round to the end with real clicks.
- **Brick audit (2026-10-30), Board UI, coach and arcade.** Fixes with tests, no API change:
  - **Fix: the coach card's ring gives a control its own outline back.** `card().show(…, target)`
    set the target's inline `outline` and `outline-offset` and cleared them when the ring moved on,
    so a control with its own inline outline lost it (Recall not exact). It now puts back what was
    there. A card made with an already-aborted `signal` is removed at once instead of staying on
    the page. `tests/coach.mjs`. fizlet/coach 1,192 → 1,220 B gzip (budget 1,536).
  - **`drag()` reads layout only on a press and while dragging.** Every `pointermove` and
    `pointerup` over a panel (a plain hover) called `getBoundingClientRect()`, forcing a layout
    after the page's own writes: 11 reads for 10 hover moves and a release, now 0 (a press and each
    drag move read once, as before). `tests/drag.mjs` counts them.
  - **The skirmish preset no longer ships the overlay CSS twice.** Its `css` repeated `BASE`, which
    the shell already mounts before every preset's CSS (same cascade, one copy).
    `tests/arcade-css.test.mjs`.
  - **`launch()` reads the key's look once, not once per copy.** The burst's seven copies each
    re-read the key's computed style after the burst layer went in (a style pass each): for a key
    with one child, 16 `getComputedStyle` calls, now 4. Same look on every copy (`tests/browser.mjs`).
  - `press()`'s doc comment sat on `readouts()`: moved back to `press()`.
  - Sizes: fizlet/arcade 21,970 → 21,975 B, with `hud` omitted 17,964 → 17,971 B, fizlet/ui (js)
    2,884 → 2,893 B gzip (all inside budget).
- **Brick audit (2026-10-30), timeline, presence and camera.** Fixes with tests, no API change:
  - **Fix: timeline's `repeat` must be a whole number ≥ 0 (or Infinity).** `repeat: -1` passed the
    setup check and looped forever (it took the Infinity path); `repeat: 0.5` ended mid-play. Both
    now throw a `RangeError` at setup, like every other bad option. `tests/timeline.test.mjs`.
    fizlet/timeline 2,050 → 2,060 B gzip (budget 2,304).
  - **Fix: presence refuses a seat outside 0..players-1.** A negative or fractional `slot` (or more
    than 32 players: seats are bits in `lost`) never stored its own input, so the sim stalled for
    good without a word. It now throws a `RangeError` at setup, like `slot ≥ players` did.
  - **presence's WebSocket transport allocates nothing per message.** `send` copied each 12-byte
    message (`slice`) before `WebSocket.send`, which copies it again, so every sim step allocated an
    array: 22 young GCs per 400k sends, now 0. `tests/presence.test.mjs` (fake socket, best of 3).
    fizlet/presence 1,792 → 1,818 B gzip (budget 2,048).
  - `tests/camera.mjs` waits on frames until the engine settles instead of a 2 s wall-clock sleep.
- **Sizes with release train 0.20.0's changes together** (#103, #96, #113, #115, #114, #117–#122,
  #111, #105; measured on the integrated branch against main with #116; the numbers in the bullets
  above are each change on its own). fizlet/arcade 23,999 → 24,334 B gzip (budget 24,064 →
  24,399); the card build 18,038 → 18,351 (budget 18,048 → 18,361); fizlet/board-page 4,097 →
  4,162 (budget 4,193); fizlet/pad 1,995 → 2,073 (budget 2,126); kernel 3,441 → 3,443; the page
  build 7,129 → 7,164 (budget 7,168, unchanged: the hero's bricks stay ≤ 7 KB). Pad's and
  board-page's exact `hypot` share code, so arcade rises 73 B for both, not 135.

## 0.19.0

- **Contest: weekly, and small wins.** One winner a week, picked from that week's dailies (the
  gallery's new pieces dated inside the ISO week, at most one a day); no daily winner and no
  12-entry minimum. Data moves from `site/contest/days/<date>.json` to
  `site/contest/weeks/<YYYY-Www>.json`, and entries no longer carry a `contest` stamp (the build
  fails on one). The prompt is no longer the judge (the 60-character rule is gone); size is: a
  piece whose live chunk is 10 KB gzip or less (10,240 B, the hero live-chunk budget, measured at
  build) can win; a bigger one is posted with a "Too big to win" sticker (on `/contest/` and its
  gallery card) and the build fails if it is a week's winner. `/contest/` lists the week's dailies
  smallest first with their measured size and marks the smallest that can win. Archived entries
  never enter.
- **Gallery: the owner approves every new piece.** An entry is live once it carries
  `"approved": "<date>"`; a new one lands pending (no `approved`) and is checked but never built,
  listed, indexed or entered in the contest until the owner approves it (or pulls it to the
  archive). The 25 entries already live are grandfathered with their own date. Tests: the gate in
  `tests/gallery.test.mjs`, and no card, index row or bundle for a pending entry in `tests/site.mjs`.
- **Gallery archive: noindex, nofollow** (owner: "archive the rest somewhere… but definitely no-follow
  those pages"). `gallery/archive/` is `noindex,nofollow`, stays out of the sitemap and llms.txt,
  and the gallery's one quiet link to it is `rel="nofollow"`.
- **Gallery: the "how it works" labs, #42–#46.** DOM VIRUS's five Under the hood labs move onto
  Fizlet as scenes in `site/labs/` (one source: the hub vendors them): pool ("One loop. Bounded
  work.", a real `engine.pool` of 32), Recall ("Recall gives the page back.", the real `Ledger`:
  each letter a Text node, the game's hits in a ledger whose `restore()` is the RECALL key), duel
  ("Two Macs, one network."), board ("One host. Two worlds.") and pipeline ("Build once. Ship
  each."). Each is one engine on the shared clock: read caches layout, step moves state, render
  writes through the ledger, seeded random; it settles when idle, sleeps off screen, and destroy()
  gives the figure back exactly. Attract mode plays for 12 s after a visit or the last input.
  Reduced motion: nothing plays on its own, the keys still work. `tests/labs.mjs` (Chromium).
- **The fizz: the original can, without the zoom** (owner: "the og ones were good, just the zoom
  needs to be killed"). The 20 × 40 can and its story are back (the 0.18.0 hi-def redraw stays in
  history, to try other cans later; it never shipped in a release), and `fizlet/camera` is out: the card holds still, the side and
  top views tell it. Live chunk 8,752 B gzip (9,455 B for the redraw, 9,710 B with the camera),
  poster 3,457 B; settled 0 frames a second, measured in Chromium 153.
- **Gallery: quality over quantity.** Of the 23 recipe entries made by `fe anim`, the owner kept 7
  (pink sparks, neon rain, POW BAM ZAP, speed lines, halftone wave, red cape, hero landing); the
  other 16 move into an archive, `gallery/archive/` (noindex, out of the gallery's index and
  search), kept to revisit and numbered A006–A025. The Christmas and
  Thanksgiving themes live only there. The gallery keeps the fizz, layers and how-it-works.
- **`fizlet/timeline`** (new brick, 2,050 B gzip, budget 2,304; the target was 1,536): scripted DOM
  choreography on the kernel clock, for the animations still on WAAPI or CSS keyframes (a cartridge
  flying into a console, a screen growing through `clip-path`, doors folding open, staggered
  entrances, looping patrols and diagram loops). `timeline(engine, { repeat, yoyo, rate, motion, id })`
  and `.to(targets, values, { dur, delay, ease, stagger, at })`: keyframe tracks on CSS values (the
  numbers change, the words stay: transform, translate, scale, rotate, opacity, clip-path, filter,
  custom properties) or typed-array slots; easings `linear`, `in`, `out`, `inOut`, `back`,
  `steps(n)` or a function, each sampled once into a shared 256-step table so the step never calls a
  function (a call through a function value boxed a number per step in a node test once several
  easings were in use); sequencing by default, `"<"`, labels, negative delays for overlap; `play`,
  `reverse`, `pause`, `seek`, `finish`, `revert`, `done()`; `timeline:start`, `timeline:end` and
  label names on the event ring. Writes happen in render through the ledger, change-only (values
  rounded to a thousandth); done or paused it never calls `busy()`, so the engine settles. Reduced
  motion: `play()` lands on the end state in one step (`motion: true` plays a variant built on
  `tl.reduced`).
  - Tests: `tests/timeline.test.mjs` (easings, interpolation, keyframes, sequencing, seek, reverse,
    finish, repeat and yoyo labels, events and `done()`, `motion: false`, settle, revert, Recall, host
    edits win, setup errors; zero allocation: at most 1 young-generation GC over 200k steps with
    eight tracks and four easings, and over 200k whole frames once done) and `tests/timeline.mjs` in
    Chromium (values mid-way on real elements, 0 frames requested once settled, done or paused,
    Recall mid-play byte for byte with a host inline style, reduced motion lands on the end).
  - Website: a brick page with a live demo (a cartridge seats in a console; the screen opens; the
    lines stagger in).
- **Kernel: the fps cap now caps requestAnimationFrame, not just the work** (real-browser audit,
  `abe browse`). A capped engine used to keep asking for a frame every vsync and skip most of them,
  so a 30 fps hero still cost 57–120 rAF calls a second (two heroes on the home page: 119.6 rAF/s at
  1440). Now, after each frame it leaves the shared clock and one timer brings it back at its next
  slot: 30 rAF/s for `fizz#hero` and `index#layers`, and an uncapped engine on the same page no
  longer drags a capped one along. Something that puts it back early (a resume, a focus change)
  gets one frame at once and the timer starts over. Kernel 3,439 B gzip (+17 B); `page build`
  7,127 B (budget 7,168); layers live chunk 9,727 B (its ≤ 9,728 B budget). The `fizlet/board-page`
  budget is 4,128 B (was 4,096): it was at 4,095 and esbuild's renamer moves it 2 B with any kernel
  edit, though it bundles only the kernel's phase constants. Tests: rAF calls per
  second at 60 and 120 Hz and a capped engine beside an uncapped one (`tests/kernel.test.mjs`, both
  fail before), and the fizz story's real page-wide rAF count ≤ 33 a second (`tests/site.mjs`).
- **Home demo settles.** The blast demo ("Blast it. Recall it.") ran its engine every vsync while on
  screen even when nothing moved (60 rAF/s, blamed on whichever slot was in view: `fizz#hero` on the
  home page, `gallery#howitworks` at 60.4). It now settles half a second after the last letter,
  wave, particle and scorch mark stop (input wakes it; the HUD reads PAUSED · SETTLED), and its
  CLICK THE PAGE blink pauses off screen (the gallery slot kept a CSS animation running offscreen at
  390). Tests: settles untouched with 0 frames, and no running CSS animation in the gallery slot once
  scrolled away (`tests/site.mjs`).
- **Board UI contrast (tokens, both themes).** Every key label passes WCAG AA on its face: the
  shortcut chip (`kbd`) fades to `--bui-kbd-alpha` 0.88 instead of 0.7 (rim ink on the command face
  3.72 → 4.84:1, on the attack face 4.04 → 5.24:1); the light `--k-sys-ink` is one shade deeper,
  `#006e91` (4.06 → 5.77:1 on white, 3.58 → 5.08:1 on the page); new derived `--k-cmd-deep`
  (command 80% over the rim) under white text: the back tab 3.42 → 4.89:1; the PLAN sticker label is
  rim ink (4.06 → 5.38:1); a dim aim key's face is aim at 18% (was 28%) so its `kbd` reads 4.69:1
  (was 3.86), and the light `--k-fire-ink` is `#c01033` (its `kbd` on the light dim face 4.07 →
  4.67:1, 5.0:1 on raised). Site: the `v0.2` chip sits on `--k-cmd-deep` (3.42 → 4.89:1) and the
  light `--hl` is `#0b7a54` (4.36 → 5.35:1). Same hues; tokens.json, board-ui.css and BOARD-UI.md
  agree. Measured with abe browse's own contrast check: 0 failures in dark (3 before) and light
  (only the roadmap's large phase numbers remain in light).
- **Tap targets on touch (≥ 44 px, nothing moves).** Text links grow their box with padding (taken
  back with a negative margin where it would take room): footer, card titles, hero, gallery, notes,
  brick contents and prev/next. The header icon keys are 44 px. Phone screenshots of every changed
  page are pixel-identical. 668 → 24 small targets over the 30 pages at 390 px; the 24 left are the
  copy keys, whose hit area grows instead (the kit's invisible `::before`) because their face can't.
- **Website: the roadmap tells the truth again.** E2 lists rules, steer, coach, camera, perf and
  arcade as shipped (timeline and layout to come); E3 is nearly done (Null Invaders, Byte Runner,
  Sherman Bytes and DOM Battlefield at 1.0, Battlefield Blitz on Fizlet, Swarm Protocol 1.4 in
  review) and adds "every animation on the sites on Fizlet, heroes first"; E4 adds the room
  server's invite gate and spend caps; E5 adds the gallery and notes.
- **`fizlet/arcade`: every HUD preset's panel drags** (owner: "the in-page scoreboard is always
  draggable"). The arcade card and the skirmish bar move from anywhere that isn't a key, mouse or
  touch, and stay on screen when the window shrinks (shared in `arcade-parts`). Browser test at 2×
  for both presets: the canvas at CSS size, the drag, the clamp.
- **Fix: games with `exactOptionalPropertyTypes` compile again.** `pressCue` (board-ui) and
  `coach` passed an optional `signal` straight into listener options, which strict consumers (the
  arcade games) reject; 0.18.0 broke their typecheck. Same runtime, no byte change. `npm run
  typecheck` now also runs with `exactOptionalPropertyTypes`, so it can't regress.
- **Website: gallery #032, "the transformer fights the diffuser to a KO".** Made by `fe anim` from
  the prompt (recipe fight, the fight scene, gag ko; kernel + sprite + fx + slot): live 9,490 B ·
  total 11,416 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never
  under reduced motion; settles to zero frames.
- **Website: gallery #033, "the tokenizer counts tokens in a punch combo".** Made by `fe anim` from
  the prompt (recipe fight, the fight scene, gag combo; kernel + sprite + fx + slot): live 9,493 B ·
  total 11,419 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never
  under reduced motion; settles to zero frames.
- **Website: gallery #034, "the context window takes punches until it overflows".** Made by `fe
  anim` from the prompt (recipe fight, the fight scene, gag overflow; kernel + sprite + fx + slot):
  live 9,492 B · total 11,418 B gzip (with the 1,926 B loader) on this build, loaded only near the
  viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #035, "the hallucinator punches a mirage".** Made by `fe anim` from the prompt
  (recipe fight, the fight scene, gag hallucinate; kernel + sprite + fx + slot): live 9,491 B ·
  total 11,417 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never
  under reduced motion; settles to zero frames.
- **Website: gallery #036, "the overfitter blocks every jab it trained on".** Made by `fe anim` from
  the prompt (recipe fight, the fight scene, gag overfit; kernel + sprite + fx + slot): live 9,494 B
  · total 11,420 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport,
  never under reduced motion; settles to zero frames.
- **Website: gallery #037, "the diffuser denoises out of static and wins".** Made by `fe anim` from
  the prompt (recipe fight, the fight scene, gag diffuse; kernel + sprite + fx + slot): live 9,489 B
  · total 11,415 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport,
  never under reduced motion; settles to zero frames.
- **Website: gallery #038, "a to the moon rocket launches off a button".** Made by `fe anim` from
  the prompt (recipe meme, the meme scene, bit rocket; kernel + sprite + fx + slot): live 9,233 B ·
  total 11,159 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never
  under reduced motion; settles to zero frames.
- **Website: gallery #039, "diamond hands sparkle and never let go".** Made by `fe anim` from the
  prompt (recipe meme, the meme scene, bit diamond; kernel + sprite + fx + slot): live 9,240 B ·
  total 11,166 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never
  under reduced motion; settles to zero frames.
- **Website: gallery #040, "a candle chart pumps then dumps".** Made by `fe anim` from the prompt
  (recipe meme, the meme scene, bit candles; kernel + sprite + fx + slot): live 9,238 B · total
  11,164 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under
  reduced motion; settles to zero frames.
- **Website: gallery #041, "laser eyes mascot powers on and fires".** Made by `fe anim` from the
  prompt (recipe meme, the meme scene, bit laser; kernel + sprite + fx + slot): live 9,239 B · total
  11,165 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under
  reduced motion; settles to zero frames.

## 0.18.0
- **`fizlet/arcade` canvas fills its root on 2x/zoomed screens** (`width:100%;height:100%`): the backing store is `innerWidth × dpr` with no CSS size, so it drew 1.5–2× too big and game art sat away from the page targets (owner report; from fizlet#60).
- **Arcade: an array of controls and scoreboards (`hud`)**, the first step of the plan to make
  DOM Battlefield / Blitz the standard game UI. `ArcadeDef` takes `hud`, a preset; each preset is
  its own export, so a game ships only the one it names (BOARD-UI.md §19).
  - **`arcadeHud({ header?, nav? })`, the default:** the card as it was. Leaving `hud` out (or
    passing `arcadeHud()`) renders it byte for byte: a browser test compares the scoreboard's
    markup at start, at game over and on a phone with a fixture captured from 0.17.0. `header`
    and `nav` keep only the keys named.
  - **`skirmishHud({ readouts, … })`:** Battlefield Blitz's HUD on the shell: a top bar with
    readouts in their formats (`num`, `clock`, `rank`, `pct`, an armor `bar` with a `low` state),
    aim toggles (intents `aim-auto` / `aim-lock`), action keys with count badges, fullscreen /
    sound / pause / exit; a feed and a banner from the event ring; pause / surrender / countdown /
    result overlays (the result lists `stats()` keys and keeps a best on the device); on phones
    the pad with the aim toggles and counted keys. Values go through `fizlet/hud`.
  - **The preset contract** (`ArcadeHud`, `HudRun`, `HudView`) is exported, so a game can bring its
    own. `readouts` is optional in `ArcadeDef` (the card's; skirmish has its own).
  - `tests/arcade-hud.mjs` (Chromium): the card byte for byte, picked keys, every skirmish piece,
    change-only (0 mutations on unchanged frames), Recall exact (after a surrender, mid-run, during
    the countdown), the phone pad, and zero allocation in the steady state: 0 minor GCs over 200k
    HUD writes for the card and for skirmish, unchanged and with every value changing (best of 3;
    the card's own path, which allocates when values change, shows 8, so the check can see it).
  - **Size:** a card game (`hud` left out) 17,622 B gzip, +311 B over 0.17.0's 17,311 for the
    preset contract and the header / nav choice (budget 17,408 → 17,920, its own line
    "fizlet/arcade (hud omitted)"). The whole module with skirmish: 21,634 B (budget 22,016):
    skirmish adds 4,012 B to a game that uses it, `fizlet/hud` (1,320 B) included.
- **Website: gallery #007, "orange red and gold leaves fall gently".** Made by `fe anim` from the
  prompt (recipe fall, the spray scene; kernel + fx + slot): live 6,784 B · total 8,710 B gzip (with
  the 1,926 B loader) on this build, loaded only near the viewport, never under reduced motion;
  settles to zero frames.
- **Website: gallery #008, "red orange and gold turkey feathers fan out on hover".** Made by `fe
  anim` from the prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,791 B · total
  8,717 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under
  reduced motion; settles to zero frames.
- **Website: gallery #009, "white steam rises gently off a warm pie".** Made by `fe anim` from the
  prompt (recipe rise, the spray scene; kernel + fx + slot): live 6,786 B · total 8,712 B gzip (with
  the 1,926 B loader) on this build, loaded only near the viewport, never under reduced motion;
  settles to zero frames.
- **Website: gallery #010, "a cornucopia spills red orange and lime fruit on tap".** Made by `fe
  anim` from the prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,785 B · total
  8,711 B gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under
  reduced motion; settles to zero frames.
- **Website: gallery #011, "orange and gold leaves settle on every heading".** Made by `fe anim`
  from the prompt (recipe settle, a decor scene (settle) that reads the page's own headings and
  writes only through the ledger; kernel + board-page + slot): live 8,903 B · total 10,829 B gzip
  (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #012, "orange embers rise from the harvest fire".** Made by `fe anim` from the
  prompt (recipe rise, the spray scene; kernel + fx + slot): live 6,788 B · total 8,714 B gzip (with
  the 1,926 B loader) on this build, loaded only near the viewport, never under reduced motion;
  settles to zero frames.
- **Website: gallery #013, "snow settles on every heading".** Made by `fe anim` from the prompt
  (recipe settle, a decor scene (settle) that reads the page's own headings and writes only through
  the ledger; kernel + board-page + slot): live 8,906 B · total 10,832 B gzip (with the 1,926 B
  loader) on this build, loaded only near the viewport, never under reduced motion; settles to zero
  frames.
- **Website: gallery #014, "red green and gold string lights twinkle on the nav".** Made by `fe
  anim` from the prompt (recipe lights, a decor scene (lights) that reads the page's own buttons and
  writes only through the ledger; kernel + board-page + slot): live 8,674 B · total 10,600 B gzip
  (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #015, "a gift box pops open into red and green confetti".** Made by `fe anim`
  from the prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,785 B · total 8,711 B
  gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #016, "a sleigh streaks across the top with gold sparkles".** Made by `fe anim`
  from the prompt (recipe trail, the spray scene; kernel + fx + slot): live 6,806 B · total 8,732 B
  gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #017, "ornaments jingle when you hover a button".** Made by `fe anim` from the
  prompt (recipe jingle, a decor scene (jingle) that reads the page's own buttons and writes only
  through the ledger; kernel + board-page + slot): live 8,702 B · total 10,628 B gzip (with the
  1,926 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: gallery #018, "gold stars pop and twinkle where you tap".** Made by `fe anim` from the
  prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,779 B · total 8,705 B gzip
  (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #019, "candy cane red and white sweeps every heading".** Made by `fe anim` from
  the prompt (recipe sweep, a page scene that reads the page's own headings and writes only through
  the ledger; kernel + board-page + slot): live 8,923 B · total 10,849 B gzip (with the 1,926 B
  loader) on this build, loaded only near the viewport, never under reduced motion; settles to zero
  frames.
- **Website: gallery #020, "POW BAM ZAP comic bursts where you click".** Made by `fe anim` from the
  prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,813 B · total 8,739 B gzip
  (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #021, "speed lines rush past every heading".** Made by `fe anim` from the
  prompt (recipe dash, a decor scene (dash) that reads the page's own headings and writes only
  through the ledger; kernel + board-page + slot): live 8,883 B · total 10,809 B gzip (with the
  1,926 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: gallery #022, "a halftone dot wave reveals every heading".** Made by `fe anim` from the
  prompt (recipe halftone, a decor scene (halftone) that reads the page's own headings and writes
  only through the ledger; kernel + board-page + slot): live 8,765 B · total 10,691 B gzip (with the
  1,926 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: gallery #023, "a red cape whooshes across the top".** Made by `fe anim` from the prompt
  (recipe trail, the spray scene; kernel + fx + slot): live 6,784 B · total 8,710 B gzip (with the
  1,926 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: gallery #024, "red laser eyes scan every heading".** Made by `fe anim` from the prompt
  (recipe sweep, a page scene that reads the page's own headings and writes only through the ledger;
  kernel + board-page + slot): live 8,923 B · total 10,849 B gzip (with the 1,926 B loader) on this
  build, loaded only near the viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #025, "a comic panel wipes across every heading".** Made by `fe anim` from the
  prompt (recipe wipe, a decor scene (wipe) that reads the page's own headings and writes only
  through the ledger; kernel + board-page + slot): live 8,667 B · total 10,593 B gzip (with the
  1,926 B loader) on this build, loaded only near the viewport, never under reduced motion; settles
  to zero frames.
- **Website: gallery #026, "a hero lands with a cyan shockwave where you tap".** Made by `fe anim`
  from the prompt (recipe burst, the spray scene; kernel + fx + slot): live 6,766 B · total 8,692 B
  gzip (with the 1,926 B loader) on this build, loaded only near the viewport, never under reduced
  motion; settles to zero frames.
- **Website: gallery #027, "bat blaster: tap to shoot the swooping pixel bats before they fly off
  across the page".** Made by `fe anim` from the prompt (recipe bats, a playable Halloween hero;
  kernel + fx + sprite + slot): live 9,671 B · total 11,597 B gzip (with the 1,926 B loader) on this
  build, loaded only near the viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #028, "pumpkin smash: whack the jack-o-lanterns as they pop up, pixel goo
  bursts".** Made by `fe anim` from the prompt (recipe smash, a playable Halloween hero; kernel + fx
  + sprite + slot): live 9,471 B · total 11,397 B gzip (with the 1,926 B loader) on this build,
  loaded only near the viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #029, "pumpkin slice: swipe through the pumpkins as they arc up, halves and
  seeds fall".** Made by `fe anim` from the prompt (recipe slice, a playable Halloween hero; kernel
  + fx + sprite + slot): live 9,700 B · total 11,626 B gzip (with the 1,926 B loader) on this build,
  loaded only near the viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #030, "haunted page: a ghost drifts over the headings and makes the letters
  shiver".** Made by `fe anim` from the prompt (recipe haunt, a playable Halloween hero that reads
  the page's own headings and writes only through the ledger; kernel + board-page + sprite + slot):
  live 9,541 B · total 11,467 B gzip (with the 1,926 B loader) on this build, loaded only near the
  viewport, never under reduced motion; settles to zero frames.
- **Website: gallery #031, "candy cauldron: tap to drop candy into a bubbling cauldron and watch it
  fizz".** Made by `fe anim` from the prompt (recipe cauldron, a playable Halloween hero; kernel +
  fx + sprite + slot): live 9,638 B · total 11,564 B gzip (with the 1,926 B loader) on this build,
  loaded only near the viewport, never under reduced motion; settles to zero frames.
- **Website: the gallery theme filter follows the address.** A `#theme-` link to the page you are
  on (or back) now filters too, not only on arrival (`hashchange`); it showed once there were two
  themes.

## 0.17.0

- **Website: people and the daily contest.** `/people/` lists who makes the animations: Chris
  Cooley (the maker) and three **house personas**, Frame Zero, Hex Hazel and DJ Mempool, Fizlet
  characters that every card, page and JSON-LD node marks "House persona — a Fizlet character, not
  a real person" (no photos, no links). `/people/<id>/` shows the avatar, role, what they make, prompt
  style, favorite games, hobbies, their gallery entries and two stats measured on this build (entries,
  total live gzip bytes). The maker's favorite games stay a `KIT:` placeholder ("Not picked yet")
  until he fills them. Data: `site/contributors/<id>.json` (adds `kind`, `description`, `style`,
  `hobbies`, `favoriteGames`, persona `handle`/`promptStyle`/`samplePrompt`, and `avatar`).
  - **Avatars**: original 32 × 32 pixel art as letter grids, drawn as inline SVG from Board UI
    tokens only (`AVATAR_PALETTE`, one path per color, `crispEdges` + `image-rendering: pixelated`);
    each 0.7–0.9 KB gzip, budget 2 KB in `tests/people.test.mjs`. The maker's is a stylized rider
    in a dirt-bike helmet, not a likeness.
  - **`/contest/`**: the rules (prompt ≤ 60 characters, one entry per person per day, judged by the
    team, at least 12 entries and one winner a day, winners featured on `/gallery/` with a
    **Winner** badge), today's theme, how to enter (a GitHub issue or a PR; no backend), past winners
    from data, and open visitor prompts marked planned, not live. A day is
    `site/contest/days/<date>.json` (generated by the engine's `fe content contest`); its entries are
    the gallery entries stamped `"contest": "<date>"`. The build fails on a contest prompt over 60
    characters, two entries by one person on a day, an unknown author, or a winner that is not one of
    the day's entries or has fewer than 12 (`scripts/people.mjs`). Launch day 2026-10-31: Halloween.
  - Footer links to People and Daily contest; `tests/site.mjs` checks the measured stats, the
    persona line, that only the maker is a schema.org Person, and the contest page's keys.
- **Website: a themed gallery, a heroes row and contributor profiles** (launch infrastructure).
  - **Data, one file each:** every gallery entry (`site/gallery/entries/<id>.json`) now has `kind`
    (`"hero"` or `"micro"`), `theme` and `author` (a contributor id; it replaces `by`). Themes are
    data (`site/gallery/themes/<id>.json`: title, blurb, order; Halloween, Thanksgiving, Christmas,
    Heroes and comics, Crypto memes, Battle of the Models, Everyday): a new theme is a file, not
    code. Contributors are `site/contributors/<id>.json` (the owner's, `chris-cooley`, to start).
    The build checks every entry against them and writes the index, `gallery/index.json` (each
    entry's page, author name and sizes measured on that build); nothing shared is hand-edited.
  - **/gallery/:** theme sections (an `h2` and a `#theme-<id>` anchor each), newest first inside
    each, still lazy-mounted through `fizlet/slot`. A row of theme chips (`bui-key` links: each
    jumps to its theme without script, filters the page with it) and a search box over title,
    prompt, theme and author (`site/gallery/browse.ts` + `search.ts`, no dependencies; the index is
    fetched on the first keystroke). Pages of 24 (`/gallery/page/2/` …, built only once there are
    more than 24). Every card says "by <name>", linked to the profile.
  - **/heroes/ (new):** the hero animations as large cards (at least 300 × 300 px, bigger on
    desktop) in a scroll-snap row; prev / next keys and the arrow keys move a card. The card in
    the centre plays (an IntersectionObserver band); the rest are posters. A Play key per card
    pauses or plays it (the only way to play under reduced motion). Full screen through the
    Fullscreen API, or an overlay where it is missing; Esc closes and focus returns to the key that
    opened it. A size badge on each card (its gallery bundle). Fizz and Layers are the first heroes.
  - **/people/<id>/ (new):** a contributor's profile and every animation of theirs.
  - Fixed: the gallery's "TAP TO PLAY" rule left its `@media` block open, so the size badge
    styles applied only without reduced motion.
  - `tests/site.mjs`: pages, sections and chips in order, index rows against the built files,
    attribution links, the filter and the search in a browser, the heroes row (centre plays alone,
    next / arrow keys, pause, full screen and the overlay with focus return, reduced motion
    posters and play on request) and the profiles; `tests/gallery.test.mjs` for the data model.
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
