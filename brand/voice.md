# Fizlet: voice

How Fizlet sounds on its site, in its README, release notes and posts, and in anything the
marketing engine writes for it. Look: [`style-guide.md`](style-guide.md). Family rules:
`dom-virus/brand/README.md` (§1, §2, §9) and `DECISIONS.md`. Persona: Chris Cooley's persona story
(`coded` `clients/domvirus/cd-domvirus-persona-story.md`, "The voice").

**Brand level: engine. Content mix: ~100% the engine**: speed, size, performance, consistent games
built fast at a small scale. DOM VIRUS and the games appear only as use cases and proof.

---

## Who's talking

**The engine first.** Fizlet stands on its own: the contract, the numbers, the tests. Chris Cooley
is **proof, not the pitch**: the maker who built it and the games that ran on it. His voice
(excited, opinionated about small-engine design, generous with technique) colours the explanations,
the release notes and the "why" posts; it never replaces a measurement. Creative licence on tone,
never on facts or biography.

## Who we talk to

- **Developers and makers** who want a page to *do* something (a hero that reacts, a diagram you
  can play, a tiny game) without shipping a big engine; small-game makers who care about bytes;
  agencies building fast sites.
- **The curious** from a DOM VIRUS game, who should leave understanding the trick.
- **Agents**, later (E5). Until then, write copy a person or an agent could follow step by step.

They know HTML, CSS and some JavaScript; they don't know game-loop theory, and we teach it.

## How we sound

**Confident, plain and specific. Arcade swagger, backed by a test.**

- Short, loud, two-line headlines with the turn on line two ("Nine promises. / *Each one tested.*").
- One idea per sentence, with the real API name in `code` beside it.
- The maker's opinions as teaching: "Most jank is self-inflicted." "Every kilobyte is a choice."
  "Measure before you believe." Each one followed by the mechanism and the number.
- British spelling ("licence"), present tense, active voice; "we" for the project, "you" for the
  reader, "I" only in Chris's notes and posts.

Real lines that set the tone:
- "**Tiny physics for your page.** A micro game and animation engine for the DOM."
- "Most engines assume they own the page. Fizlet is a guest."
- "Pools are filled up front and never grow; when one is full it says no, and the frame stays inside
  its budget."
- "Limits constrain work; they are not frame-rate promises."
- "Make the page play."

### Do / don't

| Don't | Do |
|---|---|
| "Blazing-fast games that run at full speed on anything." | "One rAF for every engine on the page. Paused, it does no work." |
| "Build games in days instead of months." | "Blitz went from 0.1.0 to 0.6.5 in one day of commits." (git, C4) |
| "I've been coding for twenty years, so trust me." | "A million steps of a busy system cause no young-generation GC. The test is in the repo." |
| "Fizlet powers the DOM VIRUS arcade." | "Fizlet runs Battlefield Blitz; the arcade and Battlefield move onto it next." (A9) |

Sample maker's lines for posts and notes (style, not facts):
- "The DOM is faster than you think if you stop fighting it. Fizlet is me not fighting it."
- "I wanted an engine that's a polite guest: it plays on your page and leaves no trace."

## The byline

Every page says **"by Chris Cooley"**: **By Chris Cooley · coded.design** (`family.json` →
`credit`), linked to <https://coded.design/>, in the footer and the About/credits. JSON-LD `author`
/ `creator`: Person "Chris Cooley", url `https://coded.design/`. Today the footer reads "Created by
Chris Cooley", unlinked (`site/layout.mjs`); it moves to the family line (A6).

## Words we use / words we never use

| Use | Not |
|---|---|
| engine, micro game engine for the DOM | framework, library, platform |
| kernel; brick (`fizlet/input`, `fizlet/fx` …) | core, runtime; plugin, harness, add-on |
| the contract, promise, each one tested | guarantee, best practice |
| the page is the board, host page, guest | canvas, "your app" (for the page) |
| Recall, give the page back, the ledger | undo, cleanup, reset |
| bounded, pool, cap, says no, drops time | unlimited, scales infinitely |
| one shared loop, one requestAnimationFrame | a game loop per widget |
| KB gzip (1 KB = 1024 bytes), measured, budget | "tiny" with no number |
| no runtime dependencies; embed-safe | "dependency-free*"; sandboxed, isolated |

Never virus or attack words for the engine itself ("infect", "hijack", "take over"): blast and
break are for what a game does, because the page always comes back. Never hype with no number.

## CTA labels

Keys, one to three words. Primary is *try or build*: **Quick start**, **Run the example**.
Secondary is *understand* or *read*: **The contract**, **Read the API**, **Source on GitHub**. Demo
keys **Blast** / **Recall**. Games: **Play Blitz** · **About Blitz** · **Visit DOM VIRUS ↗** ·
**DOM Battlefield ↗**. Playing a game is never the primary CTA. `↗` marks a link off the site.
Fizlet never uses "Get the code & setup instructions" (embedded-game pages only).

## What we never do

1. Numbers we didn't measure, or old ones (the Blitz "17 KB" is stale, C2).
2. Benchmarks we haven't run: no "faster than [engine]", no fps promises, no "60 fps on any device".
3. Planned work as done: multiplayer and presence (E4), playground, recipes and AGENTS.md (E5),
   ports of the DOM VIRUS games (E3) are **planned**.
4. "Install from npm": not published yet (A10). Today: a script tag, hosted ES modules or source.
5. Copy-paste-into-your-app framing: Fizlet is taught; snippets show the API's shape (the quick
   start is the one runnable snippet, because the site test clicks it).
6. Leading with a game, or with Chris's story. The engine leads; they are proof.
7. Install directions for board games; competitor territory (shaders, thousands of sprites, physics
   sims, UI tweening).
8. Persona claims that aren't measured: "run at full speed on anything", "days instead of months".
9. Biography beyond the persona (no employers, family, places or hobbies).

## Claims: numbers and tests

**Only measured numbers, each with its source; re-measure before you publish.** The site reads sizes
at build time (`scripts/sizes.mjs`); copy outside the site quotes the latest `npm run size`. On
v0.2.4 (2026-10-28): kernel 2,839 bytes gzip (budget 4,096, say "2.8 KB kernel"); bricks input
979, collide 897, fx 1,475, sound 915, embed 1,984, ui 2,412 js + 3,905 css, debug 493; the
script-tag bundle ~10.1 KB. "Each brick ~1.5 KB" is a target; say "most bricks about 1 KB, none over
its budget, checked on every push".

**Behaviour, tested** (cite the test): one rAF for N engines; fixed 60 Hz step with a catch-up cap;
pause stops all work and doesn't replay the gap; bounded pools and event ring; seeded random; "a
million steps of a busy system cause no young-generation GC" (never "zero garbage, ever"); rewriting
the same values makes 0 DOM mutations and Recall restores the exact DOM; a newer host edit wins.

**Done vs planned:** E1 kernel done; E2 bricks in progress (shipped: input, collide, fx, sound,
embed, ui, debug); E0 partly done; E3–E6 planned. **Only Battlefield Blitz runs on Fizlet today.**
Safe always: "No runtime dependencies, ever" (a CI rule) and "MIT". Never safe: a frame rate.

## How we explain the tech

Theory first, in plain words. Then a diagram of the real mechanism with real counts. Then a live
experiment to poke (shows `engine.stats()`, sleeps offscreen, gives the page back). Then how to hook
in by use case: add an action to a page (`createEngine`, `input`, `fx`, writes through
`engine.ledger`); drop a game on any page (`embed`); build a shooter (`input`, `collide`, `fx`,
`sound`, pools sized up front); a board with controls (`ui`); multiplayer is planned (E4), never
shown as code.

## The games and the maker, as proof

Pattern: what the game needed → which bricks did it → a measured fact. "Battlefield Blitz is built on
`fizlet`, `input`, `collide`, `fx`, `sound`, `embed` and `ui`." DOM VIRUS is where the discipline was
proved (past tense); the ports are next (future tense). DOM Battlefield is "the game whose board UI
became this design system" and doesn't run on Fizlet yet. Chris appears as the byline, in release
notes and in the "why I built it" post; about one section in ten on the home page, or less, is games.

## Avoid

<!-- Read by astro-base-engine (voice.avoid): one word or phrase per bullet, flagged wherever it
appears in page copy. The reasons are in the sections above. -->

- revolutionary
- game-changing
- cutting-edge
- best-in-class
- world-class
- seamless
- synergy
- blazing
- insanely fast
- infect
- hijack
- dependency-free*
- scales infinitely
- next-gen
- disruptive
- unleash
- supercharge
- lightning-fast
- full speed on anything
- days instead of months
- powers the dom virus arcade

## Limits

<!-- Read by astro-base-engine (voice.maxSentenceWords, voice.maxExclamations). -->

- max sentence words: 30
- max exclamations: 1

## Open questions

1. **Brick size line:** keep "each brick ~1.5 KB" as a target, or "about 1 KB each, budgets in CI"?
2. **Benchmarks:** run and publish a measured comparison against named engines? Until then, none.
3. **Game CTAs:** "Play Blitz" vs the family's "Play {board}"; "About Blitz" has no family label.
4. **Unit:** Fizlet uses KB = 1024 bytes; the hub uses decimal kB. One unit, or always state it?
5. **Who leads:** human developers first and agents second, or both equally once E5 ships?
