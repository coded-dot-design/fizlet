# Voice — Fizlet

Brand level: engine · by Chris Cooley (https://coded.design/)

Fizlet is the micro animation and game engine for the DOM. It speaks for itself: speed, size and
consistency at small scale. The engine leads; the games and the maker are proof, never the pitch.

## Who we talk to

- **Developers and makers** who want a page to *do* something (a hero that reacts, a diagram you
  can poke, a tiny game) without shipping a big engine.
- **Small-game makers who count bytes**, and studios building fast sites that must stay fast.
- **The curious**, arriving from a game, who should leave knowing the trick.

They know HTML, CSS and some JavaScript. They may not know game-loop theory, so we teach it in
plain words, then show the real API name beside it.

## How we sound

**Confident, plain, specific. Arcade swagger, backed by a test.**

- Two-line headlines, the turn on line two: "Nine promises. / *Each one tested.*"
- One idea per sentence. The real name in `code` next to the claim (`engine.ledger`, `destroy()`).
- Opinions as teaching, then the mechanism, then the number: "Every kilobyte is a choice."
- The engine is a polite guest. It plays on your page and leaves it exactly as it found it.
- Present tense, active voice. "We" is the project, "you" is the reader. British spelling (licence).
- Joy over hype: the pop of an effect, the click of a key, the page coming back.

Lines that set the tone (from the live site and README):

- "**Tiny physics for your page.**"
- "The page / *is the board.*"
- "One loop. / *Bounded work.*"
- "Recall gives / *the page back.*"
- "Take only / *what you need.*"
- "Make the page play."

### Do / don't

| Don't | Do |
|---|---|
| "Blazing-fast games on any device." | "One `requestAnimationFrame` for every engine on the page. Paused, it does no work." |
| "A tiny kernel." | "The kernel is 3,275 bytes gzip, budget 4 KB, checked in CI." |
| "Zero garbage, ever." | "1M kernel steps of a busy system: 0 young-generation GCs on Node 24." |
| "Fizlet powers the whole arcade." | "Fizlet runs Battlefield Blitz. The DOM VIRUS arcade and DOM Battlefield move onto it next." |
| "Drop it in and forget it." | "`destroy()` restores every page change exactly. A newer host edit wins." |

### Words we use / words we skip

| Use | Skip |
|---|---|
| engine, micro animation and game engine for the DOM | framework, platform |
| kernel; brick (`fizlet/fx`, `fizlet/input` …) | plugin, add-on |
| the contract, each one tested | guarantee, best practice |
| host page, guest, the page is the board | "your app" (for the page) |
| Recall, the ledger, give the page back | cleanup, reset |
| bounded, pool, cap, refuses work when full | unlimited, infinite |
| KB gzip (1 KB = 1024 bytes), measured, budget | "tiny" with no number |

Virus and attack words never describe the engine itself. Blast and break are what a game does,
because the page always comes back.

## Facts we say

Measured on Fizlet 0.5.1. Sizes are minified + gzip, everything an import pulls in included.
Re-measure (`npm run size`) before any release copy.

- Kernel: **3,275 bytes gzip**, budget ≤ 4 KB; over budget, the build fails. <!-- src: README.md 0.5.1, contract rule 9; scripts/sizes.mjs -->
- Each brick has its own budget, **1.5 to 5 KB**; a page build (kernel + slot + input + fx) is budgeted at **≤ 7 KB**. <!-- src: README.md 0.5.1; scripts/sizes.mjs -->
- Brick sizes: input 1.3 KB · collide 1.3 KB · grid 1.5 KB · fx 1.9 KB · sprite 1.3 KB · sound 1.0 KB · slot 1.7 KB · embed 2.0 KB · presence 1.8 KB · hud 1.3 KB · match 2.5 KB · ui 2.4 KB + 4.5 KB css. <!-- src: README.md 0.5.1, "What's in the box" -->
- **One clock per page:** every engine shares one `requestAnimationFrame`; fixed step, default 60 Hz, with a catch-up cap. A long frame drops time; it never spirals. <!-- src: README.md 0.5.1, contract rule 1 -->
- **Zero steady-state allocation:** 1M kernel steps of a busy system cause 0 young-generation GCs on Node 24 (best of three; the test fails above 1). <!-- src: README.md 0.5.1, contract rule 3 -->
- **Bounded everything:** pools and the event ring have a fixed capacity and refuse work when full. <!-- src: README.md 0.5.1, contract rule 2 -->
- **Pause by default:** hidden tab, page leaving, root off screen. Zero CPU while paused. <!-- src: README.md 0.5.1, contract rule 6 -->
- **Recall:** every page change goes through the ledger; `destroy()` restores it exactly. <!-- src: README.md 0.5.1, contract rule 7 -->
- **Nine rules, each with a test.** No runtime dependencies, ever. MIT. <!-- src: README.md 0.5.1 -->
- Lockstep multiplayer brick: only inputs cross the wire, **12 bytes each**. The room server is a prototype. <!-- src: README.md 0.5.1, "Multiplayer" -->
- Version on the site and in copy: **0.5.1**. <!-- src: package.json -->

**Proof, not the pitch.** Fizlet runs **Battlefield Blitz** today, built on `fizlet`, `input`,
`collide`, `fx`, `sound`, `embed` and `ui`. The DOM VIRUS arcade and DOM Battlefield **move onto
it next** (planned, future tense). <!-- src: README.md 0.5.1; site/pages/index.mjs:358 -->
More bricks (actor, steer, aim, rules, camera, view-dom) are **planned**. <!-- src: README.md 0.5.1 -->

Never said: a frame rate promise, a benchmark against another engine, a size we did not measure,
or planned work as shipped.

### Calls to action

Keys of one to three words. Primary is *try or build*: **Quick start**, **Run the example**.
Secondary is *understand*: **The contract**, **Read the API**, **Source on GitHub**. Demo keys:
**Blast** · **Recall**. Proof: **Play Blitz** · **About Blitz**. `↗` marks a link off the site.
<!-- src: site/pages/index.mjs:178-179, 194-195, 360-361, 407-408, 428-429 -->

## Byline

Every surface says **by Chris Cooley**, linked to <https://coded.design/>: the header or footer,
the About or credits, and JSON-LD `author` / `creator` (Person "Chris Cooley",
url `https://coded.design/`). The README opens with it: "By [Chris Cooley](https://coded.design/)."
<!-- src: README.md 0.5.1 line 3; package.json author -->

Chris appears as the byline, in release notes and in "why I built it" posts. His voice (excited,
opinionated about small engines, generous with technique) colours the explanation; it never
replaces a measurement.

## Avoid

- revolutionary
- game-changing
- cutting-edge
- best-in-class
- world-class
- seamless
- blazing
- lightning-fast
- insanely fast
- next-gen
- unleash
- supercharge
- infect
- hijack
- unlimited
- scales infinitely
- zero garbage
- full speed on anything
- 60 fps on any device
- faster than
- powers the arcade

## Limits

- max sentence words: 30
- max exclamations: 1
