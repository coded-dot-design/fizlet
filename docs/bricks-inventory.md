# Bricks inventory

Facts for the owner's decision on which bricks stay public in `@fzlt/core`. No recommendation here.

**How it was measured** (2026-11-20, branch `split/fzlt-package` off main b8783b9, before the site was removed; the game column was re-measured the same day by a grep of the game repos):

- **gzip**: `measure()` from `scripts/sizes.mjs` (the CI size budget's own measure: esbuild minify, ES2022, everything the import pulls in, zlib gzip), Node 24, esbuild 0.28.2. One row per public module; the size entry is the module's headline entry in `scripts/bricks.mjs`.
- **Game repos (grep)**: the `main` branch of each game checkout, fetched 2026-11-20 (dom-battlefield dfd1855, dom-battlefield-blitz 9dd32c8, dom-crossfire 2f7a930, dune-hop 48f2e3e, salvo-bay cacedfc, holeshot 75ea6f5, orbiters 9b1d10c, citysmash a1527fe, swarm-protocol c0d0494, null-invaders 8f3065c, byte-runner 2354612, sherman-bytes b3e386f, dom-virus 4ea2ccf; `git archive origin/main`). Every source file outside `node_modules/`, `dist/`, `vendor/` and `.git/` (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.astro`, `.html`) was searched for imports of `@fzlt/core`, `@fzlt/core/<sub>`, `fizlet/<sub>` and relative imports into the vendored copy `vendor/fizlet/<file>` (mapped to its module through `package.json` `exports`). **Direct**: the repo imports the module itself, in `src/`, `site/` or scripts; a module imported only from `tests/` is listed as "tests only". **Through another brick**: the module is reached only through the relative imports of a module the repo imports (for a vendored copy, inside that copy; for the npm package, inside `src/` on this branch, 0.27.0). The kernel (`@fzlt/core/kernel`, vendored `kernel/`) is counted in the `@fzlt/core` row. Vendored copies: dom-battlefield 0.27.0, dom-battlefield-blitz 0.21.2, dom-crossfire 0.27.0, swarm-protocol 0.27.0, null-invaders 0.27.0, byte-runner 0.27.0, sherman-bytes 0.27.0, dom-virus 0.20.0. npm: dune-hop ^0.25.0, salvo-bay ^0.22.0, holeshot ^0.27.0, orbiters ^0.25.0, citysmash ^0.25.0. `fizlet/<sub>` and `@coded.design/fizlet` imports: 0 found. The dom-virus site also imports `vendor/fizlet/labs/` (not a package module).
- **fizlet.com source files**: files in the website source (`site/` at b8783b9) that import the module, either `src/<module>` or `@fzlt/core/<sub>`, split into gallery pieces (`site/gallery/`), demos (`site/demos/`, `labs/`, `brick-examples/`, `recipes/`) and other pages and scripts. Counts are files, not pages.
- **Documented on fizlet.com**: every module below has a generated brick page (`bricks/<id>.html`, one per brick in `scripts/bricks.mjs`, built by the site from the source). The last column lists the hand-written docs and guides (`site/docs/`) that name the module, if any.

| Module | Status | Since | gzip (B) | Game repos that import it (grep of main, 13 repos): direct · through another brick | fizlet.com files: gallery / demos / other | Docs and guides naming it |
|---|---|---|---:|---|---|---|
| `@fzlt/core` | COMPLETE | 0.1.0 | 3,372 | 13: dom-battlefield, dom-battlefield-blitz, dom-crossfire, dune-hop, salvo-bay, holeshot, orbiters, citysmash, swarm-protocol, null-invaders, byte-runner, sherman-bytes, dom-virus · 0 | 10 / 20 / 7 | `code/determinism.ts`, `code/first-engine.ts`, `code/hero-scene.ts`, `code/ledger.ts`, `code/micro-game.ts`, `code/port.ts`, `code/room-client.ts`, `code/settle.ts`, `code/tsconfig`, `docs/budgets`, `docs/getting-started`, `guides/micro-game` |
| `@fzlt/core/input` | COMPLETE | 0.2.0 | 1,909 | 6: dom-battlefield-blitz, dom-crossfire, dune-hop, holeshot, orbiters, citysmash · 3: null-invaders, byte-runner, sherman-bytes | 17 / 6 / 3 | `code/micro-game.ts`, `code/room-client.ts`, `docs/authoring`, `docs/budgets`, `docs/loop`, `guides/astro-slot`, `guides/micro-game` |
| `@fzlt/core/pad` | COMPLETE | 0.3.3 | 2,068 | 4: dune-hop, holeshot, orbiters, citysmash · 3: null-invaders, byte-runner, sherman-bytes | 16 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/collide` | COMPLETE | 0.2.0 | 1,265 | 2: dom-battlefield-blitz, dom-crossfire · 4: swarm-protocol, null-invaders, byte-runner, sherman-bytes | 2 / 1 / 1 | `code/micro-game.ts`, `docs/authoring`, `guides/micro-game`, `guides/port-a-game` |
| `@fzlt/core/grid` | BETA | 0.3.1 | 1,652 | none | 7 / 1 / 1 | brick page only |
| `@fzlt/core/fx` | COMPLETE | 0.2.0 | 2,792 | 6: dom-battlefield, dom-battlefield-blitz, dom-crossfire, dune-hop, orbiters, citysmash · 0 | 30 / 13 / 7 | `code/hero-scene.ts`, `code/micro-game.ts`, `docs/authoring`, `docs/budgets`, `docs/contract`, `docs/getting-started`, `guides/astro-slot`, `guides/micro-game` |
| `@fzlt/core/camera` | BETA | 0.9.0 | 1,400 | none | 0 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/sprite` | COMPLETE | 0.3.2 | 1,437 | 1: dom-battlefield · 0 | 51 / 13 / 2 | brick page only |
| `@fzlt/core/sound` | COMPLETE | 0.2.0 | 1,062 | 7: dom-battlefield-blitz, dom-crossfire, dune-hop, salvo-bay, holeshot, orbiters, citysmash · 3: null-invaders, byte-runner, sherman-bytes | 96 / 5 / 4 | brick page only |
| `@fzlt/core/embed` | COMPLETE | 0.2.0 | 2,040 | 2: dom-battlefield-blitz, dom-crossfire · 0 | 0 / 0 / 1 | brick page only |
| `@fzlt/core/slot` | COMPLETE | 0.3.0 | 1,849 | 1: dom-battlefield · 0 | 229 / 15 / 32 | `code/hero-scene.ts`, `code/slot-page.ts`, `docs/authoring`, `docs/budgets`, `docs/getting-started`, `guides/astro-slot` |
| `@fzlt/core/hud` | BETA | 0.3.6 | 1,306 | 0 · 3: null-invaders, byte-runner, sherman-bytes | 0 / 6 / 1 | `code/micro-game.ts`, `docs/authoring`, `guides/micro-game` |
| `@fzlt/core/match` | BETA | 0.4.3 | 2,617 | 0 · 3: null-invaders, byte-runner, sherman-bytes | 0 / 1 / 1 | `docs/authoring` |
| `@fzlt/core/board-page` | COMPLETE | 0.4.4 | 4,104 | 3: swarm-protocol, byte-runner, sherman-bytes · 1: null-invaders | 3 / 2 / 2 | `docs/recall`, `guides/port-a-game` |
| `@fzlt/core/presence` | BETA (in-house) | 0.4.0 | 2,197 | 6: dom-battlefield-blitz, dom-crossfire, dune-hop, salvo-bay, holeshot, citysmash · 0 | 0 / 2 / 2 | `code/room-client.ts`, `docs/authoring`, `docs/determinism`, `guides/build-your-own-room-server` |
| `@fzlt/core/presence/check` | BETA (in-house) | 0.4.0 | 4,870 | none | 0 / 0 / 0 | `code/determinism.ts`, `code/tsconfig`, `docs/determinism`, `guides/build-your-own-room-server` |
| `@fzlt/core/presence/rollback` | BETA (in-house) | 0.4.0 | 2,176 | 1: holeshot · 0 | 0 / 0 / 0 | brick page only |
| `@fzlt/core/ui` | COMPLETE | 0.1.0 | 2,907 | 9: dom-battlefield, dom-battlefield-blitz, dom-crossfire, dune-hop, salvo-bay, holeshot, orbiters, citysmash, dom-virus · 3: null-invaders, byte-runner, sherman-bytes | 1 / 1 / 4 | brick page only |
| `@fzlt/core/perf` | COMPLETE | 0.7.0 | 2,019 | 2: dom-battlefield, dom-virus · 0 | 0 / 1 / 1 | brick page only |
| `@fzlt/core/rules` | COMPLETE | 0.6.0 | 1,318 | 5: dom-battlefield, dom-battlefield-blitz, dom-crossfire, null-invaders, sherman-bytes · 0 | 0 / 1 / 1 | `docs/authoring`, `guides/port-a-game` |
| `@fzlt/core/steer` | COMPLETE | 0.17.0 | 2,759 | 3: dom-battlefield-blitz, dune-hop, holeshot · 7: salvo-bay, orbiters, citysmash, swarm-protocol, null-invaders, byte-runner, sherman-bytes | 11 / 0 / 3 | `guides/port-a-game` |
| `@fzlt/core/coach` | COMPLETE | 0.17.0 | 1,220 | 1: dom-battlefield-blitz · 0 | 0 / 0 / 1 | brick page only |
| `@fzlt/core/timeline` | BETA | 0.19.0 | 2,137 | 1: dom-virus · 0 | 3 / 4 / 2 | `docs/authoring` |
| `@fzlt/core/touch` | BETA | 0.20.0 | 310 | 6: dom-battlefield, dom-battlefield-blitz, dom-crossfire, dune-hop, orbiters, citysmash · 3: null-invaders, byte-runner, sherman-bytes | 0 / 0 / 2 | brick page only |
| `@fzlt/core/css-clock` | BETA | 0.21.0 | 5,368 | none | 2 / 0 / 2 | brick page only |
| `@fzlt/core/layout` | ALPHA | 0.21.0 | 1,745 | none | 0 / 0 / 1 | brick page only |
| `@fzlt/core/view-canvas` | ALPHA | 0.21.0 | 936 | none | 0 / 0 / 1 | brick page only |
| `@fzlt/core/diorama` | ALPHA | 0.22.0 | 7,258 | 5: dune-hop, salvo-bay, holeshot, orbiters, citysmash · 0 | 57 / 0 / 0 | brick page only |
| `@fzlt/core/dice` | ALPHA | 0.22.0 | 4,262 | none | 3 / 0 / 0 | brick page only |
| `@fzlt/core/track` | ALPHA | 0.22.0 | 2,055 | none | 2 / 0 / 0 | brick page only |
| `@fzlt/core/water` | ALPHA | 0.22.0 | 5,264 | none | 2 / 0 / 0 | brick page only |
| `@fzlt/core/props` | ALPHA | 0.22.0 | 3,115 | none | 2 / 0 / 0 | brick page only |
| `@fzlt/core/beam` | ALPHA | 0.22.0 | 4,388 | none | 3 / 0 / 0 | brick page only |
| `@fzlt/core/cards` | ALPHA | 0.22.0 | 3,383 | none | 15 / 0 / 0 | brick page only |
| `@fzlt/core/flick` | ALPHA | 0.22.0 | 5,410 | none | 9 / 0 / 0 | brick page only |
| `@fzlt/core/actor` | ALPHA | 0.28.0 | 908 | none | 0 / 0 / 0 | brick page only |
| `@fzlt/core/aim` | ALPHA | 0.28.0 | 691 | none | 0 / 0 / 0 | brick page only |
| `@fzlt/core/view-dom` | ALPHA | 0.28.0 | 882 | none | 0 / 0 / 0 | brick page only |
| `@fzlt/core/announce` | BETA | 0.28.0 | 612 | none | 0 / 0 / 0 | brick page only |
| `@fzlt/core/scene` | ALPHA | 0.28.0 | 8,369 | none | 2 / 0 / 0 | brick page only |
| `@fzlt/core/terrain` | ALPHA | 0.22.0 | 5,566 | 2: dune-hop, holeshot · 0 | 9 / 0 / 0 | brick page only |
| `@fzlt/core/drive` | ALPHA | 0.22.0 | 5,262 | 3: dune-hop, holeshot, orbiters · 0 | 11 / 0 / 0 | brick page only |
| `@fzlt/core/math` | BETA | 0.27.0 | 1,746 | 1: holeshot · 8: dune-hop, salvo-bay, orbiters, citysmash, swarm-protocol, null-invaders, byte-runner, sherman-bytes | 0 / 0 / 0 | brick page only |
| `@fzlt/core/arcade` | COMPLETE | 0.11.0 | 24,145 | 3: null-invaders, byte-runner, sherman-bytes · 0 | 0 / 0 / 0 | `docs/authoring`, `docs/budgets`, `guides/port-a-game` |
| `@fzlt/core/debug` | COMPLETE | 0.1.0 | 1,133 | none | 1 / 0 / 1 | `docs/authoring`, `docs/contract`, `docs/getting-started` |

## Per repo

| Repo (main) | How it gets fzlt | Imports directly (kernel = `@fzlt/core/kernel` or vendored `kernel/`) |
|---|---|---|
| dom-battlefield dfd1855 | vendored copy, 0.27.0 (d372e26) | `ui`, `touch`, kernel, `slot`, `fx`, `sprite`, `perf`, `rules` |
| dom-battlefield-blitz 9dd32c8 | vendored copy, 0.21.2 (2922cbd) | `ui`, `touch`, `embed`, `@fzlt/core`, `presence`, `input`, `fx`, `sound`, `collide`, `rules`, `steer`, `coach` |
| dom-crossfire 2f7a930 | vendored copy, 0.27.0 (d372e26) | `ui`, `touch`, `embed`, `@fzlt/core`, `presence`, `input`, `fx`, `sound`, `collide`, `rules` |
| dune-hop 48f2e3e | npm `@fzlt/core` ^0.25.0 | `ui`, `diorama`, `drive`, `steer`, kernel, `terrain`, `touch`, `input`, `pad`, `sound`, `fx`, `presence` |
| salvo-bay cacedfc | npm `@fzlt/core` ^0.22.0 | `ui`, kernel, `presence`, `diorama`, `sound` |
| holeshot 75ea6f5 | npm `@fzlt/core` ^0.27.0 | `ui`, `diorama`, `input`, kernel, `presence`, `math`, `terrain`, `drive`, `pad`, `sound`, `steer`, `presence/rollback` |
| orbiters 9b1d10c | npm `@fzlt/core` ^0.25.0 | `ui`, kernel, `diorama`, `touch`, `drive`, `input`, `pad`, `fx`, `sound` |
| citysmash a1527fe | npm `@fzlt/core` ^0.25.0 | `ui`, `diorama`, kernel, `touch`, `presence`, `fx`, `input`, `pad`, `sound` |
| swarm-protocol c0d0494 | vendored copy, 0.27.0 (d372e26) | kernel, `board-page`, `@fzlt/core` (tests only) |
| null-invaders 8f3065c | vendored copy, 0.27.0 (d372e26) | `arcade`, kernel, `rules`, `@fzlt/core` (tests only) |
| byte-runner 2354612 | vendored copy, 0.27.0 (d372e26) | `arcade`, kernel, `board-page`, `@fzlt/core` (tests only) |
| sherman-bytes b3e386f | vendored copy, 0.27.0 (d372e26) | `arcade`, `board-page`, kernel, `rules`, `@fzlt/core` (tests only) |
| dom-virus 4ea2ccf | vendored copy, 0.20.0 (bf42a8c) | kernel, `timeline`, `ui`, `perf` |

## Counts

- 45 public modules (43 bricks; `ui/board-ui.css` and `ui/tokens.json` ride with `@fzlt/core/ui`).
- Imported by no game repo, directly or through another brick (19): `@fzlt/core/grid`, `@fzlt/core/camera`, `@fzlt/core/presence/check`, `@fzlt/core/css-clock`, `@fzlt/core/layout`, `@fzlt/core/view-canvas`, `@fzlt/core/dice`, `@fzlt/core/track`, `@fzlt/core/water`, `@fzlt/core/props`, `@fzlt/core/beam`, `@fzlt/core/cards`, `@fzlt/core/flick`, `@fzlt/core/actor`, `@fzlt/core/aim`, `@fzlt/core/view-dom`, `@fzlt/core/announce`, `@fzlt/core/scene`, `@fzlt/core/debug`.
- Reached only through another brick, never imported directly (2): `@fzlt/core/hud`, `@fzlt/core/match`.
- Not imported by any fizlet.com source file (8): `@fzlt/core/presence/check`, `@fzlt/core/presence/rollback`, `@fzlt/core/actor`, `@fzlt/core/aim`, `@fzlt/core/view-dom`, `@fzlt/core/announce`, `@fzlt/core/math`, `@fzlt/core/arcade`.
