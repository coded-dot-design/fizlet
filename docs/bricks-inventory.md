# Bricks inventory

Facts for the owner's decision on which bricks stay public in `@fzlt/core`. No recommendation here.

**How it was measured** (2026-11-20, branch `split/fzlt-package` off main b8783b9, before the site was removed):

- **gzip**: `measure()` from `scripts/sizes.mjs` (the CI size budget's own measure: esbuild minify, ES2022, everything the import pulls in, zlib gzip), Node 24, esbuild 0.28.2. One row per public module; the size entry is the module's headline entry in `scripts/bricks.mjs`.
- **Games (catalog)**: the `used` evidence recorded in `scripts/bricks.mjs` (the released games and production pages that ship the brick, at the versions named there). **Not grepped:** the game repositories (dom-battlefield, dom-battlefield-blitz, dom-crossfire, dune-hop, salvo-bay, CooleyGit/holeshot, orbiters, citysmash, the four embeds) were not reachable from the session that wrote this, so this column is the catalog's claim, not a fresh search. A grep of those repos is still to do (see the end).
- **fizlet.com source files**: files in the website source (`site/` at b8783b9) that import the module, either `src/<module>` or `@fzlt/core/<sub>`, split into gallery pieces (`site/gallery/`), demos (`site/demos/`, `labs/`, `brick-examples/`, `recipes/`) and other pages and scripts. Counts are files, not pages.
- **Documented on fizlet.com**: every module below has a generated brick page (`bricks/<id>.html`, one per brick in `scripts/bricks.mjs`, built by the site from the source). The last column lists the hand-written docs and guides (`site/docs/`) that name the module, if any.

| Module | Status | Since | gzip (B) | Games and pages that ship it (catalog) | fizlet.com files: gallery / demos / other | Docs and guides naming it |
|---|---|---|---:|---|---|---|
| `@fzlt/core` | COMPLETE | 0.1.0 | 3,372 | every game: DOM Battlefield 1.0.3, Battlefield Blitz 1.0.1, Null Invaders 1.0.3, Byte Runner 1.0.2, Sherman Bytes 1.1.0, Swarm Protocol 1.4.0; fizlet.com; the DOM VIRUS site | 10 / 20 / 7 | `code/determinism.ts`, `code/first-engine.ts`, `code/hero-scene.ts`, `code/ledger.ts`, `code/micro-game.ts`, `code/port.ts`, `code/room-client.ts`, `code/settle.ts`, `code/tsconfig`, `docs/budgets`, `docs/getting-started`, `guides/micro-game` |
| `@fzlt/core/input` | COMPLETE | 0.2.0 | 1,909 | Battlefield Blitz 1.0.1; Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade) | 17 / 6 / 3 | `code/micro-game.ts`, `code/room-client.ts`, `docs/authoring`, `docs/budgets`, `docs/loop`, `guides/astro-slot`, `guides/micro-game` |
| `@fzlt/core/pad` | COMPLETE | 0.3.3 | 2,068 | Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade) | 16 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/collide` | COMPLETE | 0.2.0 | 1,265 | Battlefield Blitz 1.0.1 (inRect); Null Invaders 1.0.3, Byte Runner 1.0.2, Sherman Bytes 1.1.0 and Swarm Protocol 1.4.0 (the page-text Grid inside @fzlt/core/board-page) | 2 / 1 / 1 | `code/micro-game.ts`, `docs/authoring`, `guides/micro-game`, `guides/port-a-game` |
| `@fzlt/core/grid` | BETA | 0.3.1 | 1,652 | none recorded | 7 / 1 / 1 | brick page only |
| `@fzlt/core/fx` | COMPLETE | 0.2.0 | 2,792 | Battlefield Blitz 1.0.1; the hero battle on the DOM Battlefield 1.0.3 site; fizlet.com: the home demo and the gallery | 30 / 13 / 7 | `code/hero-scene.ts`, `code/micro-game.ts`, `docs/authoring`, `docs/budgets`, `docs/contract`, `docs/getting-started`, `guides/astro-slot`, `guides/micro-game` |
| `@fzlt/core/camera` | BETA | 0.9.0 | 1,400 | none recorded | 0 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/sprite` | COMPLETE | 0.3.2 | 1,437 | the hero battle on the DOM Battlefield 1.0.3 site; fizlet.com: the gallery's scenes | 51 / 13 / 2 | brick page only |
| `@fzlt/core/sound` | COMPLETE | 0.2.0 | 1,062 | Battlefield Blitz 1.0.1; Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade) | 96 / 5 / 4 | brick page only |
| `@fzlt/core/embed` | COMPLETE | 0.2.0 | 2,040 | Battlefield Blitz 1.0.1 (the drop-in) | 0 / 0 / 1 | brick page only |
| `@fzlt/core/slot` | COMPLETE | 0.3.0 | 1,849 | fizlet.com: the home hero, the fizz and the gallery; the hero battle on the DOM Battlefield 1.0.3 site | 229 / 15 / 32 | `code/hero-scene.ts`, `code/slot-page.ts`, `docs/authoring`, `docs/budgets`, `docs/getting-started`, `guides/astro-slot` |
| `@fzlt/core/hud` | BETA | 0.3.6 | 1,306 | Sherman Bytes 1.1.0 (its scoreboard is @fzlt/core/arcade's skirmish preset); fizlet.com: Before AI: 2015, live (the arcade column's score, combo and best) | 0 / 6 / 1 | `code/micro-game.ts`, `docs/authoring`, `guides/micro-game` |
| `@fzlt/core/match` | BETA | 0.4.3 | 2,617 | Sherman Bytes 1.1.0 (the skirmish preset's countdown, pause and result run on it) | 0 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/board-page` | COMPLETE | 0.4.4 | 4,104 | Swarm Protocol 1.4.0; Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade) | 3 / 2 / 2 | `docs/recall`, `guides/port-a-game` |
| `@fzlt/core/presence` | BETA (in-house) | 0.4.0 | 2,197 | Battlefield Blitz 1.0.1 multiplayer (behind an invite code) | 0 / 2 / 2 | `code/room-client.ts`, `docs/authoring`, `docs/determinism`, `guides/build-your-own-room-server` |
| `@fzlt/core/presence/check` | BETA (in-house) | 0.4.0 | 4,870 | Battlefield Blitz 1.0.1 multiplayer (behind an invite code) | 0 / 0 / 0 | `code/determinism.ts`, `code/tsconfig`, `docs/determinism`, `guides/build-your-own-room-server` |
| `@fzlt/core/presence/rollback` | BETA (in-house) | 0.4.0 | 2,176 | Battlefield Blitz 1.0.1 multiplayer (behind an invite code) | 0 / 0 / 0 | brick page only |
| `@fzlt/core/ui` | COMPLETE | 0.1.0 | 2,907 | DOM Battlefield 1.0.3; Battlefield Blitz 1.0.1; Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade); fizlet.com; the DOM VIRUS, DOM Battlefield and Battlefield Blitz sites | 1 / 1 / 4 | brick page only |
| `@fzlt/core/perf` | COMPLETE | 0.7.0 | 2,019 | DOM Battlefield 1.0.3 and the DOM VIRUS site (the performance switch) | 0 / 1 / 1 | brick page only |
| `@fzlt/core/rules` | COMPLETE | 0.6.0 | 1,318 | DOM Battlefield 1.0.0 (supply drops: drops in src/model.ts, dom-battlefield#11); Battlefield Blitz 0.8.0+ (supply crates: drops in src/game.ts, Blitz#4); Null Invaders 1.0 (drops, score); Sherman Bytes 1.0 (drops, score, waves) | 0 / 1 / 1 | `docs/authoring`, `guides/port-a-game` |
| `@fzlt/core/steer` | COMPLETE | 0.17.0 | 2,759 | Battlefield Blitz (every tank: drive, seek, arriveGoal, wander and the exact hypot in src/game.ts; dom-battlefield-blitz#22, from its next release) | 11 / 0 / 3 | `guides/port-a-game` |
| `@fzlt/core/coach` | COMPLETE | 0.17.0 | 1,220 | Battlefield Blitz (the practice coach's steps and tricks on tour in src/game.ts, its own card; dom-battlefield-blitz#22, from its next release) | 0 / 0 / 1 | brick page only |
| `@fzlt/core/timeline` | BETA | 0.19.0 | 2,137 | fizlet.com: the home page's reveals and parallax, the origin hero and Before AI: 2015, live; the DOM VIRUS site: the cartridge console, the detail-page scenes and the diagrams | 3 / 4 / 2 | `docs/authoring` |
| `@fzlt/core/touch` | BETA | 0.20.0 | 310 | Null Invaders 1.0.3, Byte Runner 1.0.2 and Sherman Bytes 1.1.0 (through @fzlt/core/arcade: no page zoom while a run is live); the DOM Battlefield and Battlefield Blitz sites; fizlet.com: every page | 0 / 0 / 2 | brick page only |
| `@fzlt/core/css-clock` | BETA | 0.21.0 | 5,368 | fizlet.com (the home demo's hint and the roadmap's current phase) | 2 / 0 / 2 | brick page only |
| `@fzlt/core/layout` | ALPHA | 0.21.0 | 1,745 | fizlet.com: the bricks index's brick graph | 0 / 0 / 1 | brick page only |
| `@fzlt/core/view-canvas` | ALPHA | 0.21.0 | 936 | fizlet.com: the bricks index's brick graph | 0 / 0 / 1 | brick page only |
| `@fzlt/core/diorama` | ALPHA | 0.22.0 | 7,258 | Salvo Bay prototype (gallery piece to follow) | 57 / 0 / 0 | brick page only |
| `@fzlt/core/dice` | ALPHA | 0.22.0 | 4,262 | none recorded | 3 / 0 / 0 | brick page only |
| `@fzlt/core/track` | ALPHA | 0.22.0 | 2,055 | none recorded | 2 / 0 / 0 | brick page only |
| `@fzlt/core/water` | ALPHA | 0.22.0 | 5,264 | none recorded | 2 / 0 / 0 | brick page only |
| `@fzlt/core/props` | ALPHA | 0.22.0 | 3,115 | none recorded | 2 / 0 / 0 | brick page only |
| `@fzlt/core/beam` | ALPHA | 0.22.0 | 4,388 | none recorded | 3 / 0 / 0 | brick page only |
| `@fzlt/core/cards` | ALPHA | 0.22.0 | 3,383 | none recorded | 15 / 0 / 0 | brick page only |
| `@fzlt/core/flick` | ALPHA | 0.22.0 | 5,410 | none recorded | 9 / 0 / 0 | brick page only |
| `@fzlt/core/actor` | ALPHA | 0.28.0 | 908 | none recorded | 0 / 0 / 0 | brick page only |
| `@fzlt/core/aim` | ALPHA | 0.28.0 | 691 | none recorded | 0 / 0 / 0 | brick page only |
| `@fzlt/core/view-dom` | ALPHA | 0.28.0 | 882 | none recorded | 0 / 0 / 0 | brick page only |
| `@fzlt/core/announce` | BETA | 0.28.0 | 612 | none recorded | 0 / 0 / 0 | brick page only |
| `@fzlt/core/scene` | ALPHA | 0.28.0 | 8,369 | fizlet.com: two gallery micros (#38 and #40 are scene data) | 2 / 0 / 0 | brick page only |
| `@fzlt/core/terrain` | ALPHA | 0.22.0 | 5,566 | none recorded | 9 / 0 / 0 | brick page only |
| `@fzlt/core/drive` | ALPHA | 0.22.0 | 5,262 | none recorded | 11 / 0 / 0 | brick page only |
| `@fzlt/core/math` | BETA | 0.27.0 | 1,746 | none recorded | 0 / 0 / 0 | brick page only |
| `@fzlt/core/arcade` | COMPLETE | 0.11.0 | 24,145 | Null Invaders 1.0.3; Byte Runner 1.0.2; Sherman Bytes 1.1.0 | 0 / 0 / 0 | `docs/authoring`, `docs/budgets`, `guides/port-a-game` |
| `@fzlt/core/debug` | COMPLETE | 0.1.0 | 1,133 | fizlet.com: the home demo (guardLayout) | 1 / 0 / 1 | `docs/authoring`, `docs/contract`, `docs/getting-started` |

## Counts

- 45 public modules (43 bricks; `ui/board-ui.css` and `ui/tokens.json` ride with `@fzlt/core/ui`).
- No game or production page recorded in the catalog (16): `@fzlt/core/grid`, `@fzlt/core/camera`, `@fzlt/core/dice`, `@fzlt/core/track`, `@fzlt/core/water`, `@fzlt/core/props`, `@fzlt/core/beam`, `@fzlt/core/cards`, `@fzlt/core/flick`, `@fzlt/core/actor`, `@fzlt/core/aim`, `@fzlt/core/view-dom`, `@fzlt/core/announce`, `@fzlt/core/terrain`, `@fzlt/core/drive`, `@fzlt/core/math`.
- Not imported by any fizlet.com source file (8): `@fzlt/core/presence/check`, `@fzlt/core/presence/rollback`, `@fzlt/core/actor`, `@fzlt/core/aim`, `@fzlt/core/view-dom`, `@fzlt/core/announce`, `@fzlt/core/math`, `@fzlt/core/arcade`.

## Still to do

- Grep the game repositories and the four embeds for `@fzlt/core/<sub>` imports (and vendored copies of `src/`), then replace the catalog column with what they actually import at their latest tags.
