# Fizlet: voice

How Fizlet sounds on its site, in its README, release notes and posts, and in anything the
marketing engine writes for it. This guide is written down from the copy that already ships
(`README.md`, `CHANGELOG.md`, `site/pages/*.mjs`, `site/layout.mjs`, `src/ui/BOARD-UI.md`) and from
the family rulebook (`dom-virus/brand/README.md`, §1, §2 and §9). The look is in
[`style-guide.md`](style-guide.md).

**Brand level:** engine. **Content mix: ~100% the engine.** That means speed, size, performance, and
consistent games built fast at a small scale. DOM VIRUS and the games appear only as use cases and
proof. Fizlet stands on its own (rulebook §1).

---

## Who we talk to

- **Developers and makers who build interactive pages and small games:**
  - front-end developers who want a page to *do* something (a hero that reacts, a diagram you can
    play with, a tiny game on a landing page) without shipping a big engine;
  - small-game makers who like the DOM and care about bytes;
  - agencies building fast marketing sites (`dom-virus/ENGINE.md` §1, "Agency work").
- **The curious:** people who arrive from a DOM VIRUS game and wonder how a game can run on a page
  and then hand it back. They should leave understanding the trick even if they never install
  anything.
- **Agents.** The plan has a strict, AI-readable spec (ENGINE.md E5, not built yet). Until then,
  write copy that a person *or* an agent could follow step by step.

What we assume about readers:

- they know HTML, CSS and some JavaScript;
- they don't know game-loop theory, and we teach it.

## How we sound

**Confident, plain and specific. A bit of arcade swagger, backed by a test.**

- **Short, loud headlines.** Two lines, with the second line as the turn
  ("Nine promises. / *Each one tested.*").
- **Explanations a smart non-specialist can follow.** One idea per sentence, with the real API name
  in `code` beside it.
- **The swagger is earned by the numbers.** Every promise has a test or a measurement behind it.
- **British spelling** ("licence", "spiralling"), present tense, active voice, "we"
  for the project and "you" for the reader.
- **One voice family with DOM VIRUS:** the same arcade attitude, but Fizlet talks about the machine,
  not the match.

Real lines that set the tone:

> **Tiny physics for your page.** A micro game and animation engine for the DOM: one shared loop,
> bounded everything, zero allocation in the steady state, and the page always comes back exactly as
> it was. No runtime dependencies, ever.
> (`README.md:3-5`)

> The page *is the board.*
> (`site/pages/index.mjs:175`)

> Most engines assume they own the page. Fizlet is a guest: it runs inside someone else's site, on a
> phone, next to their code, and it leaves no trace.
> (`site/pages/index.mjs:231`)

> Pools are filled up front and never grow; when one is full it says no, and the frame stays inside
> its budget.
> (`site/pages/index.mjs:276`)

> Limits constrain work; they are not frame-rate promises. Real frame time still depends on the page,
> the fonts and the device.
> (`site/pages/index.mjs:317`)

> Make the page play.
> (`site/pages/index.mjs:426`)

The name, when we need to explain it: "The 'fiz' is fizz (the pop of an effect) and a nod to
physics; the '-let' is small, like an applet." (`README.md:9`)

## Words we use / avoid

| Use | Not | Why |
|---|---|---|
| **engine**, **micro game engine for the DOM**, **game and animation engine** | framework, library, platform | It is an engine with a loop. It is not a tween library (ENGINE.md §1) |
| **kernel** | core, runtime | The 2.8 KB piece every brick needs |
| **brick** (`fizlet/input`, `fizlet/fx` …) | plugin, harness, add-on | "Harness" is the plan's internal word (ENGINE.md); the public word is brick (README, site) |
| **the contract**, **promise**, **each one tested** | guarantee, best practice | The nine rules in README "The contract" |
| **the page is the board**, **host page**, **guest** | canvas, viewport, "your app" (for the page) | Fizlet plays on the page you already have |
| **Recall**, **give the page back**, **the ledger** | undo, cleanup, reset | `engine.ledger`, `destroy()` |
| **bounded**, **pool**, **cap**, **says no**, **drops time** | unlimited, scales infinitely | Pools never grow; a long frame drops time |
| **one shared loop** / **one requestAnimationFrame** | game loop per widget | One rAF per page |
| **pause by default**, **sleeps**, **zero CPU while paused** | idle, lazy | Hidden tab, offscreen, typing |
| **KB gzip** (1 KB = 1024 bytes), **measured**, **budget** | kB without a definition, "tiny" with no number | The site's unit (`index.mjs:323`). DOM VIRUS's Under the Hood uses decimal kB, so state the unit |
| **no runtime dependencies** | zero-dependency (fine), "dependency-free*" (no asterisks) | It is a CI rule (CLAUDE.md) |
| **embed-safe** | sandboxed, isolated | No globals, no global styles, one `AbortSignal` |

Avoid these whole families of words:

- **virus or attack words for the engine itself** ("infect", "hijack", "take over"). Fizlet has a
  friendly, non-virus name on purpose (ENGINE.md §7). Blast and break are fine for *what a game
  does*, because the page always comes back.
- **hype with no number:** "blazing", "insanely fast", "lightweight" on its own, "best-in-class".

## CTA labels

Calls to action are 3D keys (see [`style-guide.md` §3](style-guide.md#3-the-shared-3d-key)). The
labels are one to three words, verbs or nouns, sentence case on the key.

| Label | Key role | Where today | Goes to |
|---|---|---|---|
| **Quick start** | `bui-go` | hero, final (`index.mjs:178, 428`) | `#start` |
| **Start** | `bui-go` | header (`layout.mjs:88`) | `#start` |
| **The contract** | `bui-sys` | hero (`index.mjs:179`) | `#contract` |
| **Run the example** | `bui-go` | quick start (`index.mjs:407`) | `examples/quick-start.html` |
| **Read the API** / **The API** | `bui-sys` / `bui-cmd` | quick start, example page (`index.mjs:408`, `quick-start.mjs:37`) | README `#readme` |
| **Source on GitHub** | `bui-sys` | final, footer (`index.mjs:429`, `layout.mjs:117`) | the repo |
| **Back to the demo** | `bui-cmd` | Recall section (`index.mjs:297`) | the demo |
| **Blast** / **Recall** | `bui-attack` / `bui-cmd` | demo keys (`index.mjs:194-195`) | in-page action |
| **Copy** → **Copied** / **Select it** | small key | code cards (`site/site.ts`) | clipboard |
| **Play Blitz** · **About Blitz** | `bui-attack` / `bui-sys` | games (`index.mjs:360-361`) | Blitz play / landing |
| **Visit DOM VIRUS ↗** · **DOM Battlefield ↗** | `bui-cmd` / `bui-go` | games (`index.mjs:368, 374`) | sibling sites |
| **Fizlet home** | `bui-go` | 404 (`not-found.mjs:50`) | home |

Rules for CTA labels:

- The **primary** CTA on a Fizlet page is to *try or build*: Quick start, then Run the example. The
  secondary is to *understand* (The contract) or to *read the code* (Source on GitHub). Playing a
  game is never Fizlet's primary CTA.
- Keep **playing a game** and **getting the code** visibly different (rulebook §7).
- `↗` marks a link that leaves the Fizlet site.
- Family labels from `family.json` `links` apply when Fizlet links to a game: "Play {board}".
  Fizlet does **not** use "Get the code & setup instructions", which belongs to embedded-game pages
  (rulebook §6). Fizlet's equivalent is "Source on GitHub" or "Read the API".

## Avoid

1. **Numbers we didn't measure,** or old ones (see Limits).
2. **Benchmark claims:**
   - no "faster than Phaser / Kontra / GSAP", no fps promises, no "60 fps on any device";
   - we have run no head-to-head benchmarks. The size table in ENGINE.md §1 is prior-art
     *research* (published sizes, 2026-10), not our benchmark, and it is not marketing copy.
3. **Speaking of planned work as done:**
   - multiplayer, presence and AI agents in rooms are **planned (E4)**;
   - the playground, recipes and AGENTS.md are **planned (E5)**;
   - ports of the DOM VIRUS games are **planned (E3)**.
4. **"Install from npm".** Fizlet is **not on npm yet** (`site/pages/index.mjs:404`). Today the
   routes are the script tag, the hosted ES modules, or building from source.
5. **Copy-paste-into-your-app framing.** Fizlet is taught, not pasted (rulebook §9). Snippets show
   the shape of the API. They are not a drop-in solution, except the quick start, which we know runs
   because the site test clicks it (`site/pages/quick-start.mjs:1-2`).
6. **Leading with a game.** Games are proof, and they come after the engine story.
7. **Install directions for board games.** Board games are played on our sites, not installed
   (rulebook §3). See the open questions on Blitz's drop-in line.
8. **Engine-competitor territory:**
   - shaders, hundreds of sprites, physics simulations ("use Pixi/Phaser");
   - UI tweening ("use Motion/WAAPI/CSS").
   - ENGINE.md §1 lists these as "where others already win (don't compete)".
9. **Long explanations on keys, stickers or overlays.** Keys are one or two words; explanations go
   in body copy (BOARD-UI.md §6.2).

## Limits: numbers and claims

**Only measured numbers, each with its source. Re-measure before you publish.** On the site, sizes
are read at build time from `scripts/sizes.mjs` and are never typed in. Copy outside the site
(posts, README, social) must quote the latest `npm run size`.

**Sizes, measured 2026-10-28 on v0.2.4** with `npm run size` (`scripts/size.mjs` →
`scripts/sizes.mjs`: each entry bundled, minified and gzipped, everything it imports included):

| Entry | gzip (bytes) | Budget | Say |
|---|---|---|---|
| `fizlet` (kernel) | 2839 | 4096 | "2.8 KB kernel" / "under 3 KB" |
| `fizlet/debug` | 493 | 1536 | ~0.5 KB, dev only |
| `fizlet/input` | 979 | 1536 | ~1.0 KB |
| `fizlet/collide` | 897 | 1536 | ~0.9 KB |
| `fizlet/fx` | 1475 | 2048 | ~1.4 KB |
| `fizlet/sound` | 915 | 1536 | ~0.9 KB |
| `fizlet/embed` | 1984 | 2560 | ~1.9 KB |
| `fizlet/ui` (js) | 2412 | 3072 | ~2.4 KB |
| `fizlet/ui` (css) | 3905 | 5120 | ~3.8 KB |
| `fizlet.js` script-tag bundle (kernel + every brick but debug) | 10313 | (no budget) | ~10.1 KB, from `npm run site` (`scripts/site.mjs:21-29`) |

- "Each brick ~1.5 KB" (README:48, CLAUDE.md) is the **target**, not a fact for every brick: fx,
  embed and ui have larger budgets. Say "most bricks about 1 KB, none over its budget" or quote the
  table.
- Budgets are enforced in CI: say "checked on every push" (`index.mjs:160`).
- **Kernel history:** ~2.6 KB at 0.1.0 (CHANGELOG.md:62), 2.8 KB now.

**Behaviour, backed by tests** (say "tested"; cite the test when you can):

- One rAF for N engines: `tests/kernel.test.mjs:20`.
- Fixed 60 Hz step with a catch-up cap (default 4 steps, `src/kernel/engine.ts:79`):
  `kernel.test.mjs:34`.
- Pause stops all work and does not replay the gap: `kernel.test.mjs:58`. Auto-pause (hidden,
  editable field, offscreen): `tests/browser.mjs`.
- Bounded pools and event ring (default 64 events, `engine.ts:82`): `kernel.test.mjs:79`.
- Seeded random, the same sequence as the DOM VIRUS core: `kernel.test.mjs:98`.
- **"1M steps, no young-generation GC":** `kernel.test.mjs:125-160`. The assertion allows at most one
  stray minor GC from the test runner. Say "a million steps of a busy system cause no
  young-generation GC", as the site does. Don't say "zero garbage, ever".
- Rewriting the same values makes 0 DOM mutations, and Recall restores the exact DOM:
  `tests/browser.mjs:50-65`.
- A newer host edit always wins: `tests/browser.mjs:69-85`.
- The layout guard counts layout reads in a step: `tests/browser.mjs:140`.
- fx particle cap 420 by default (`src/fx.ts:22`), with the cap enforced: `tests/bricks.test.mjs:39`.
- The site: every page at desktop and 360px, links, no overflow, demo, reduced motion, quick start
  (`tests/site.mjs`).

**Done vs planned** (`dom-virus/ENGINE.md` §6 and progress log, and the site roadmap
`site/pages/index.mjs:56-96`):

| Phase | State | Say |
|---|---|---|
| E0 Baseline | Partly done (perf harness and baseline numbers done; baseline tags and archive selectors to do) | "We measured the games before porting them" |
| E1 Kernel | **Done** (0.1.0) | Fully, in the present tense |
| E2 Bricks | **In progress**. Shipped: input, collide, fx, sound, embed, ui (+ debug). Planned: actor, steer, aim, rules, board-page, board-grid, view-dom, camera, playground | Name only the shipped bricks as available |
| E3 Port the games | Not started | "DOM VIRUS games move onto Fizlet next" |
| E4 Presence and multiplayer | **Not started: planned, not built** | "Planned", always. Never "multiplayer-ready" |
| E5 Docs for humans and AI | Not started | "Planned" |
| E6 Weekly performance wins | Not started | "Planned" |

**Games on Fizlet today: only Battlefield Blitz.** DOM VIRUS's games and DOM Battlefield are
not on Fizlet yet: they port in E3. DOM Battlefield is where the Board UI kit came from, and its
`board-ui/` is still a copy until it consumes this package (CLAUDE.md).

Never quote these without re-checking:

- "No runtime dependencies, ever" is safe: it is a CI rule.
- "MIT" is safe.
- Anything with a frame rate is not safe. We make no fps claims.

## Content mix

- **~100% engine.** Every page and post is about how Fizlet works, what it costs (bytes, CPU,
  allocations) and how to build with it.
- **Games appear only as proof:** "Battlefield Blitz is built on `fizlet`, `input`, `collide`,
  `fx`, `sound`, `embed` and `ui`" (`index.mjs:358`). That is a fact about the engine, not a pitch
  for the game.
- On the home page today, one section of ten is about games (08 "Built on Fizlet"). Keep that ratio
  or smaller.
- **Size is a theme on every page** (rulebook §2): the kernel size and the budget appear in the
  hero, the stats strip, the bricks and the spec sheet.

## How we explain the tech

Use the Under the Hood method (`dom-virus/site-kit/components/UnderTheHood.astro`), which the Fizlet
home page already follows. Teach in four beats, in this order:

1. **Theory first.** Say the problem and the idea in plain words before any API. "A web page is a
   surprisingly good game map. The trick is reading it cheaply, changing only what you own and
   leaving cleanly." (`index.mjs:259`, after UnderTheHood.astro:30)
2. **A diagram of the real mechanism.** For example:
   - Read → Step → Render;
   - one rAF for three engines with a catch-up cap;
   - a 24-slot pool that says no;
   - the ledger table.
   - Draw it with real counts and real names (style guide §5).
3. **A live experiment.** Something to poke that runs on Fizlet, shows `engine.stats()`, sleeps
   offscreen and gives the page back. For example: "Try it in the demo: blast the heading, then
   press **Recall**." (`index.mjs:296`)
4. **How to hook in, by use case.** Not code to paste, but which bricks to use, which phase each part
   goes in, and what the contract asks of you. The rulebook's pattern (§9) is "to add an action to
   the page, do this; if you're building a shooter, do that; if it's multiplayer, do this". With
   what exists today, that reads:

| You want to… | Hook in with | The rule to respect |
|---|---|---|
| **Add an action to a page** (a hero that reacts, a button that blasts) | `createEngine({ root })`, `fizlet/input`, `fizlet/fx`; write to the page only through `engine.ledger` | Measure in `read`, simulate in `step`, write in `render`; `destroy()` gives it all back |
| **Drop a game onto any page** | `fizlet/embed` (palette, easter-egg trigger, lazy load, toggle, Escape) | No globals, no global styles; one `AbortSignal` |
| **Build a shooter** | `input` (intents, one-frame edges), `collide` (spatial hash, swept segments: no tunnelling), `fx` (pooled blast), `sound` (cues from the event ring) | Pools sized up front; pass typed arrays and indices so nothing boxes (README:37-38) |
| **Build a board with game controls** | `fizlet/ui` (the Board UI kit) | The only per-game input is the palette (BOARD-UI.md §3) |
| **Multiplayer** | **Planned (E4).** The kernel's fixed step and seeded random are the groundwork the plan names (ENGINE.md §4.1, §5); the presence brick and a room server are not built | Say "planned". Never show multiplayer code |

Snippets show the shape of the API in three lines or fewer per idea (as on the brick cards,
`index.mjs:22-53`). Full, runnable code lives in the repo, plus the one quick start the site test
runs.

## The open-source stance

- **Fizlet is meant to be built on.** It is MIT, it lives at `coded-dot-design/fizlet`, and we
  encourage people to use it in their own projects (rulebook §3 "Installing", §9). This is the one
  brand in the family that invites reuse of its code, by design.
- **Say how to get it honestly.** Today: one script tag (`fizlet.js`), ES modules hosted on the
  site, or build from source. It is **not on npm yet** (`index.mjs:402-404`). When it is published,
  update this line and the site in one go.
- **Show the discipline, not just the licence.** The contract, the tests and the size budgets are
  part of what we open-source: "Every brick and every game built on it keeps these." (`index.mjs:231`)
- The changelog is public and linked from the footer. Write release notes in the same voice:
  - lead with what changed for a builder;
  - name the brick;
  - give the number if one moved.

## How we mention DOM VIRUS and the games

- **As proof and use cases, never as the subject.** Pattern: what the game needed → which bricks
  did it → a measured fact. "The first bricks shipped with Blitz." (`index.mjs:386`)
- **DOM VIRUS is where the discipline was proved:** "Fizlet is the engine they proved out"
  (`index.mjs:367`). Use the past tense for the proving and the future tense for the ports (E3).
- **DOM Battlefield** is "the game whose board UI became this design system" (`index.mjs:373`). It
  does not run on Fizlet yet.
- **Battlefield Blitz** is "the first game on Fizlet" (`index.mjs:348`, ENGINE.md progress log).
- Use the family's names and tags from `dom-virus/brand/family.json` (DOM TANK, SQUAD TACTICS,
  DOM BLITZ …). Link through the site's URL constants (`site/layout.mjs:6-11`), later `family.json`,
  and never hard-code a host in a page.
- **Don't write** "Fizlet powers the DOM VIRUS arcade and DOM Battlefield" (README.md:10-11) until
  E3 ports them. It overstates today. "Built for", or "the engine they proved out", is accurate.

## Credit line

Every page shows the credit (rulebook §2, `family.json` `credit`):

> By Chris Cooley · [coded.design](https://coded.design)

Use exactly that text, with coded.design linked to <https://coded.design>. Today the site footer
reads "© 2026 coded.design · MIT licence · no runtime dependencies" and "Created by Chris Cooley",
unlinked (`site/layout.mjs:133`). It should move to the family line when the site is next changed.

## Open questions

1. **Blitz's size on the Fizlet site is stale.** The games section says "About 17 KB gzipped with
   the engine and the art" (`site/pages/index.mjs:350, 354`), which was Blitz 0.1.0
   (`dom-battlefield-blitz/CHANGELOG.md:104`). Blitz 0.6.5 measures **34,501 B gzip**
   (`dist/blitz.js`, `node scripts/size.mjs` in that repo, 2026-10-28, Board UI kit included; budget
   40 KB). Update the copy (or read the number from Blitz's build), and confirm which figure to
   lead with.
2. **Blitz drop-in vs "board games aren't installable".** The rulebook classes Blitz as a board game
   with no install directions (§3), but the Fizlet site shows its one-line drop-in `<script>` and
   "drops onto any website with one line" (`index.mjs:350-352`). Is the Blitz drop-in an allowed
   engine proof, or should the snippet go?
3. **README "Fizlet powers the DOM VIRUS arcade and DOM Battlefield"** (`README.md:10-11`) is ahead
   of the plan (E3 not started). Reword it?
4. **npm.** The rulebook (§9) calls Fizlet "npm packages", but it is not published yet
   (`index.mjs:404`). When will it be? And one package with subpaths, or many (ENGINE.md §7, still
   open)?
5. **"Each brick ~1.5 KB"** (README:48) vs the budgets of 2 KB (fx), 2.5 KB (embed) and 3 KB + 5 KB
   (ui). Keep the line as a target, or change it to "about 1 KB each, budgets in CI"?
6. **Benchmarks.** Do we want a measured comparison (size, frame time under the 4× throttle harness)
   against named engines? Until one is run and published, copy makes no comparative claims.
7. **CTA wording for games:** "Play Blitz" vs the family's "Play {board}" ("Play Battlefield
   Blitz"), and "About Blitz" (no family label). Align them?
8. **Credit line:** approve moving the footer to "By Chris Cooley · coded.design" (linked).
9. **Unit:** Fizlet uses KB = 1024 bytes. DOM VIRUS's Under the Hood uses decimal kB
   (`UnderTheHood.astro:8`). Pick one for the family, or always state it?
10. **Spelling:** the existing copy mixes "licence" (British) with otherwise neutral English. Confirm
    British spelling for Fizlet.
11. **Who leads:** human developers first and agents second (as here), or both equally once E5
    ships?
