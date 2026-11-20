# fizlet.com → Astro: the migration

fizlet.com is a custom build today: `site/` in coded-dot-design/fizlet (layout.mjs, pages/, docs/,
bricks.mjs, gallery/, …) built by `scripts/site.mjs` into `site-dist/` and served from GitHub Pages.
This folder is its Astro rebuild. It is self-contained (its own package.json, lockfile and
workflows) so it can become the root of `fizlet/fizlet-site` with no edits.

Wave 1 (W1-site, 2026-11-20) built the foundation and ported four pages. This file is the plan for
the rest: every legacy route, its page type, the template and components that cover it, and done or
to do, so the next wave can split the remaining pages without overlap.

## How the port works

1. **Export** (`npm run export:legacy -- <legacy site-dist>`): `scripts/export-legacy.mjs` reads the
   legacy build and writes what this site renders to `src/data/legacy/` (committed, so this repo
   builds alone): `routes.json` (every page), `footer.json` (the site map), `site.json` (the
   version), one JSON per ported page, and `assets.json`, the legacy runtime files the ported pages
   load, copied into `public/` (the engine bundles: `site.js`, the demos, the gallery chunks,
   `dist/`, `fizlet.js`). Every number in the data was measured by the legacy build.
2. **Render**: pages in `src/pages/` take that data through shared components. Markup the engine
   owns (a demo's poster and loader, the API reference) stays as built, through `Html.astro`;
   each such use is a to-do below.
3. **Compare** (`npm run compare -- <legacyUrl> <newUrl> <outDir> [--full]`): screenshots both sites
   at 1440 and 390 wide, light and dark, and diffs them with pixelmatch (threshold 0.1).
   Target: ≤ 3% of pixels per shot.

To port a page of a type that already has a template (a doc, a brick, a gallery page): add its slug
to the export loop in `scripts/export-legacy.mjs`, re-export, add the path to `done` in
`src/data/migration.json`, `npm run migration`, build, compare, commit.

## Wave 1 results (measured 2026-11-20, legacy build v0.27.0)

`npm run compare -- http://localhost:4801/ http://localhost:4802/ <out> --full`, full-page shots:

| Page | 1440 light | 1440 dark | 390 light | 390 dark | Page height (1440 / 390) |
|---|---:|---:|---:|---:|---|
| `/` | 0.000% | 0.000% | 0.000% | 0.000% | 21,867 / 34,641 px |
| `/docs/getting-started/` | 0.000% | 0.000% | 0.000% | 0.000% | 3,625 / 4,523 px |
| `/bricks/kernel.html` | 0.000% | 0.000% | 0.000% | 0.000% | 7,647 / 8,701 px |
| `/gallery/` | 0.000% | 0.000% | 0.000% | 0.000% | 14,789 / 25,047 px |

Viewport-only shots (1440×900, 390×900): 0.000% on all 16 as well. Same heights on both sites.

## W2-home: the home page's sections

Each section below the stats becomes a component in `src/components/home/`, its content exported as
data (`scripts/export-legacy.mjs`, the `HOME` extractors → `src/data/legacy/pages/home.json`, one
entry per section with its `kind`). Shared pieces: `HomeSection` (the section shell, its drawn rule
and ghost number), `SectionCopy` (SectionHead plus body paragraphs and keys), `KeyRow`, `RuleList`.
A section without a component still renders through `Html` until it is ported.

| Chunk | Sections | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---:|---:|---:|---:|
| 1 | page-toc, profile, contract, board, loop, recall, ship, final | 0.000% | 0.000% | 0.000% | 0.000% |
| 2 | specs (SizeChip), games, roadmap, start | 0.000% | 0.000% | 0.000% | 0.000% |

Full-page `/` shots against the legacy build (v0.27.0), measured 2026-11-20; same heights on both
(21,867 / 34,641 px). The rendered `<main>` of each ported section is also element-for-element the
legacy one (attributes, classes and text).

## Design system

- **Tokens**: `src/design/tokens.json` is the one source (groups: color, type, space, radius,
  shadow, motion; dark is the default theme, light overrides). `npm run tokens` writes
  `src/styles/tokens.css`; `validate:content` and the tests fail when it is stale.
  Lifted from the legacy `src/ui/board-ui.css` and `site/site.css` token blocks; the six corner
  radii site.css used as literals (4, 5, 6, 8, 10, 12 px) are tokens now (`--r-N`).
- **Stylesheets**: `src/styles/board-ui.css` (the Board UI kit) and `src/styles/site.css` (page
  furniture), lifted from the legacy sheets with their token blocks removed; every rule reads the
  tokens. No page or component has a `<style>` block or a colour literal (`npm run audit` checks).
- **Components** (`src/components/`): SiteHeader (Lockup, NavTree, ThemeToggle, Key), SiteFooter
  (SiteMap, SymChip), Crumbs, SectionHead, CodeBlock (with Copy), DocsSidebar, DocSteps, Callout,
  Key (buttons), BrickCard, GalleryCard, Icon, Mark, Html (kept-as-built markup).

## Known gaps (to do)

- **Runtime**: the ported pages still run the legacy engine bundles from `public/` (`site.js` wires
  the theme toggle, nav menus, Copy keys; the demos and gallery pieces load their chunks). Next:
  build these here from `@fzlt/core` (npm) and move the behaviour into the components' scripts.
- **Kept as built** (`Html.astro`): the home page's sections origin, play and story (W2-home is
  porting them; see below),
  the home hero's layers figure, the brick page's head, demo, card, status and API, the gallery's
  theme chips, search, page nav, and each piece's stage and meta tail.
- **Analytics**: the legacy build adds GA4 + PostHog behind consent only when its public ids are
  set (they were not for this export). Port `site/analytics` before cutover if they are.
- **Redirects**: the two moved pages (`/heroes/`, `/guides/multiplayer-rooms/`) need Cloudflare
  `_redirects` entries plus their meta-refresh pages.
- **Not pages**: `sitemap.xml` (generated here from the done routes), `robots.txt`, `llms.txt`,
  `llms-full.txt`, `og.png`, `icon.svg`, `fizlet.js`, `dist/` (copied from the legacy build; at
  cutover `llms*.txt`, `og.png` and `fizlet.js` must be built, not copied).
- **The Astro page engine**: this wave could not reach the Fizlet factory's Astro engine, so it was
  built without its scaffold (`abe new`), `abe migrate compare` or `abe browse`. The gates here are
  standalone equivalents (`scripts/compare.mjs`, `scripts/browse.mjs`); move onto the engine's
  conventions when it is reachable (its token format, its placeholders, its deploy recipe).

## Route inventory

<!-- INVENTORY:START -->
148 legacy pages, 4 done, 144 to do (legacy build v0.27.0).

| Type | Pages | Done | Template | Components | Next wave |
|---|---:|---:|---|---|---|
| home | 1 | 1 | src/pages/index.astro | Hero (in page), stats row, BrickCard, CodeBlock, Key; home/: HomeSection, SectionCopy, KeyRow, RuleList, SizeChip, PageToc, Profile, Contract, Board, Loop, Recall, Specs, Ship, Games, Roadmap, Start, Final; 3 sections kept as built (Html) | W2-home: componentize origin, play, story |
| not-found | 1 | 0 | to build: src/pages/404.astro | SectionHead, Key | W2-misc |
| brand | 1 | 0 | to build: src/pages/brand/index.astro | Lockup, Mark, Key, token swatches (new, from tokens.json) | W2-misc |
| bricks-index | 1 | 0 | to build: src/pages/bricks/index.astro | BrickCard, SymChip, periodic table + stickers + factory (Html until componentized) | W2-bricks |
| brick | 43 | 1 | src/pages/bricks/[id].astro | Crumbs, CodeBlock; the head, demo, card and API kept as built (Html) | W2-bricks: add the ids to export-legacy.mjs, then compare; later an ApiDecl component for the API |
| contest | 1 | 0 | to build: src/pages/contest/index.astro | SectionHead, Callout, a week card (new) | W2-daily |
| legal | 2 | 0 | to build: src/pages/privacy/, src/pages/cookies/ | SectionHead, a table (new) | W2-misc |
| demo | 7 | 0 | to build: the engine demos' own host pages (no site shell for some) | kept as built (Html) until the demos build from @fzlt/core here | W2-demos |
| docs-index | 2 | 0 | to build: src/pages/docs/index.astro, src/pages/guides/index.astro | SectionHead, a doc list card (new) | W2-docs |
| doc | 11 | 1 | src/pages/docs/[slug]/index.astro | Crumbs, SectionHead, CodeBlock, Key, DocSteps, DocsSidebar | W2-docs: add the slug to export-legacy.mjs (guides need a guides/[slug] route on the same template), then compare |
| gallery-index | 6 | 1 | src/pages/gallery/index.astro (page 1); to build: gallery/page/[n]/ | SectionHead, Callout, GalleryCard | W2-gallery: one [n] route over the same template |
| gallery-archive | 1 | 0 | to build: src/pages/gallery/archive/index.astro (noindex,nofollow) | GalleryCard | W2-gallery |
| gallery-lane | 1 | 0 | to build: src/pages/gallery/hifi/index.astro | GalleryCard | W2-gallery |
| redirect | 2 | 0 | to build: a redirect (Cloudflare _redirects 301, plus the meta-refresh page) | none | W2-misc |
| make | 1 | 0 | to build: src/pages/make/index.astro | CodeBlock, Key; make.js runtime | W2-daily |
| news-index | 1 | 0 | to build: src/pages/news/index.astro | a release row (new) | W2-notes |
| release | 51 | 0 | to build: src/pages/news/[version]/index.astro | Crumbs, SectionHead | W2-notes |
| notes-index | 1 | 0 | to build: src/pages/notes/index.astro | a note card (new) | W2-notes |
| note | 6 | 0 | to build: src/pages/notes/[slug]/index.astro | Crumbs, SectionHead, CodeBlock, Callout | W2-notes |
| people-index | 1 | 0 | to build: src/pages/people/index.astro | a person card (new) | W2-daily |
| person | 7 | 0 | to build: src/pages/people/[id]/index.astro | a person card (new), GalleryCard | W2-daily |

Every route (`/path` · type · status · in sitemap · title):

<details><summary><b>home</b> (1)</summary>

- [x] `/` · done · Fizlet · Building blocks for DOM animation and games

</details>

<details><summary><b>not-found</b> (1)</summary>

- [ ] `/404.html` · to do · not in sitemap · noindex · Not found: this square is off the board · Fizlet

</details>

<details><summary><b>brand</b> (1)</summary>

- [ ] `/brand/` · to do · Brand: Fizlet™ marks, lockups and colour · Fizlet

</details>

<details><summary><b>bricks-index</b> (1)</summary>

- [ ] `/bricks/` · to do · Kernel and bricks: every module and its size · Fizlet

</details>

<details><summary><b>brick</b> (43)</summary>

- [ ] `/bricks/actor.html` · to do · @fzlt/core/actor: API and measured size · Fizlet
- [ ] `/bricks/aim.html` · to do · @fzlt/core/aim: API and measured size · Fizlet
- [ ] `/bricks/announce.html` · to do · @fzlt/core/announce: API and measured size · Fizlet
- [ ] `/bricks/arcade.html` · to do · @fzlt/core/arcade: API and measured size · Fizlet
- [ ] `/bricks/beam.html` · to do · @fzlt/core/beam: API and measured size · Fizlet
- [ ] `/bricks/board-page.html` · to do · @fzlt/core/board-page: API and measured size · Fizlet
- [ ] `/bricks/camera.html` · to do · @fzlt/core/camera: API and measured size · Fizlet
- [ ] `/bricks/cards.html` · to do · @fzlt/core/cards: API and measured size · Fizlet
- [ ] `/bricks/coach.html` · to do · @fzlt/core/coach: API and measured size · Fizlet
- [ ] `/bricks/collide.html` · to do · @fzlt/core/collide: API and measured size · Fizlet
- [ ] `/bricks/css-clock.html` · to do · @fzlt/core/css-clock: API and measured size · Fizlet
- [ ] `/bricks/debug.html` · to do · @fzlt/core/debug: API and measured size · Fizlet
- [ ] `/bricks/dice.html` · to do · @fzlt/core/dice: API and measured size · Fizlet
- [ ] `/bricks/diorama.html` · to do · @fzlt/core/diorama: API and measured size · Fizlet
- [ ] `/bricks/drive.html` · to do · @fzlt/core/drive: API and measured size · Fizlet
- [ ] `/bricks/embed.html` · to do · @fzlt/core/embed: API and measured size · Fizlet
- [ ] `/bricks/flick.html` · to do · @fzlt/core/flick: API and measured size · Fizlet
- [ ] `/bricks/fx.html` · to do · @fzlt/core/fx: API and measured size · Fizlet
- [ ] `/bricks/grid.html` · to do · @fzlt/core/grid: API and measured size · Fizlet
- [ ] `/bricks/hud.html` · to do · @fzlt/core/hud: API and measured size · Fizlet
- [ ] `/bricks/input.html` · to do · @fzlt/core/input: API and measured size · Fizlet
- [x] `/bricks/kernel.html` · done · @fzlt/core: API and measured size · Fizlet
- [ ] `/bricks/layout.html` · to do · @fzlt/core/layout: API and measured size · Fizlet
- [ ] `/bricks/match.html` · to do · @fzlt/core/match: API and measured size · Fizlet
- [ ] `/bricks/math.html` · to do · @fzlt/core/math: API and measured size · Fizlet
- [ ] `/bricks/pad.html` · to do · @fzlt/core/pad: API and measured size · Fizlet
- [ ] `/bricks/perf.html` · to do · @fzlt/core/perf: API and measured size · Fizlet
- [ ] `/bricks/presence.html` · to do · @fzlt/core/presence: API and measured size · Fizlet
- [ ] `/bricks/props.html` · to do · @fzlt/core/props: API and measured size · Fizlet
- [ ] `/bricks/rules.html` · to do · @fzlt/core/rules: API and measured size · Fizlet
- [ ] `/bricks/scene.html` · to do · @fzlt/core/scene: API and measured size · Fizlet
- [ ] `/bricks/slot.html` · to do · @fzlt/core/slot: API and measured size · Fizlet
- [ ] `/bricks/sound.html` · to do · @fzlt/core/sound: API and measured size · Fizlet
- [ ] `/bricks/sprite.html` · to do · @fzlt/core/sprite: API and measured size · Fizlet
- [ ] `/bricks/steer.html` · to do · @fzlt/core/steer: API and measured size · Fizlet
- [ ] `/bricks/terrain.html` · to do · @fzlt/core/terrain: API and measured size · Fizlet
- [ ] `/bricks/timeline.html` · to do · @fzlt/core/timeline: API and measured size · Fizlet
- [ ] `/bricks/touch.html` · to do · @fzlt/core/touch: API and measured size · Fizlet
- [ ] `/bricks/track.html` · to do · @fzlt/core/track: API and measured size · Fizlet
- [ ] `/bricks/ui.html` · to do · @fzlt/core/ui: API and measured size · Fizlet
- [ ] `/bricks/view-canvas.html` · to do · @fzlt/core/view-canvas: API and measured size · Fizlet
- [ ] `/bricks/view-dom.html` · to do · @fzlt/core/view-dom: API and measured size · Fizlet
- [ ] `/bricks/water.html` · to do · @fzlt/core/water: API and measured size · Fizlet

</details>

<details><summary><b>contest</b> (1)</summary>

- [ ] `/contest/` · to do · Daily contest: top picks, weekly winners · Fizlet

</details>

<details><summary><b>legal</b> (2)</summary>

- [ ] `/cookies/` · to do · Cookies and storage: none until you say yes · Fizlet
- [ ] `/privacy/` · to do · Privacy policy: analytics only with consent · Fizlet

</details>

<details><summary><b>demo</b> (7)</summary>

- [ ] `/demos/before-ai-2015/` · to do · Before AI: 2015, three sprites live · Fizlet
- [ ] `/demos/fizz/` · to do · Fizz: crack the can, hear the fizz · Fizlet
- [ ] `/demos/layers/` · to do · Layers: a game is a stack, each layer one brick · Fizlet
- [ ] `/demos/name-shift/` · to do · Fizlet → fzlt: the name shift · Fizlet
- [ ] `/demos/origin/` · to do · Origin: Code. Sleep. Drink. Repeat. · Fizlet
- [ ] `/examples/fizz/` · to do · Crack the can: the fizz as a Fizlet hero
- [ ] `/examples/quick-start.html` · to do · Quick start: ten lines to a blast · Fizlet

</details>

<details><summary><b>docs-index</b> (2)</summary>

- [ ] `/docs/` · to do · Docs: the contract, the loop, Recall, budgets · Fizlet
- [ ] `/guides/` · to do · Guides: build with Fizlet, step by step · Fizlet

</details>

<details><summary><b>doc</b> (11)</summary>

- [ ] `/docs/authoring/` · to do · Authoring with Fizlet: the shape and three recipes
- [ ] `/docs/budgets/` · to do · Fizlet size budgets: every module, measured
- [ ] `/docs/contract/` · to do · The Fizlet contract: nine tested rules
- [ ] `/docs/determinism/` · to do · Deterministic games in Fizlet: seeds and lockstep
- [x] `/docs/getting-started/` · done · Getting started with Fizlet: a DOM game engine
- [ ] `/docs/loop/` · to do · The Fizlet loop: fixed step, one shared rAF
- [ ] `/docs/recall/` · to do · Recall: how Fizlet gives the page back
- [ ] `/guides/astro-slot/` · to do · Fill an Astro animation slot with a Fizlet scene
- [ ] `/guides/build-your-own-room-server/` · to do · Build your own room server for Fizlet multiplayer
- [ ] `/guides/micro-game/` · to do · Build a micro game with Fizlet in one file
- [ ] `/guides/port-a-game/` · to do · Port an existing game onto the Fizlet kernel

</details>

<details><summary><b>gallery-index</b> (6)</summary>

- [x] `/gallery/` · done · Daily: tiny examples, made every day · Fizlet
- [ ] `/gallery/page/2/` · to do · Daily, page 2: tiny examples, made every day · Fizlet
- [ ] `/gallery/page/3/` · to do · Daily, page 3: tiny examples, made every day · Fizlet
- [ ] `/gallery/page/4/` · to do · Daily, page 4: tiny examples, made every day · Fizlet
- [ ] `/gallery/page/5/` · to do · Daily, page 5: tiny examples, made every day · Fizlet
- [ ] `/gallery/page/6/` · to do · Daily, page 6: tiny examples, made every day · Fizlet

</details>

<details><summary><b>gallery-archive</b> (1)</summary>

- [ ] `/gallery/archive/` · to do · not in sitemap · noindex · Gallery archive: earlier runs, kept to revisit · Fizlet

</details>

<details><summary><b>gallery-lane</b> (1)</summary>

- [ ] `/gallery/hifi/` · to do · Daily Hi-Fi: bigger pieces, their own lane · Fizlet

</details>

<details><summary><b>redirect</b> (2)</summary>

- [ ] `/guides/multiplayer-rooms/` · to do · not in sitemap · redirects to /../../guides/build-your-own-room-server/ · noindex · Multiplayer rooms moved: build your own room server · Fizlet
- [ ] `/heroes/` · to do · not in sitemap · redirects to /../gallery/ · noindex · Heroes moved to Daily · Fizlet

</details>

<details><summary><b>make</b> (1)</summary>

- [ ] `/make/` · to do · Make one: a prompt in, a snippet out · Fizlet

</details>

<details><summary><b>news-index</b> (1)</summary>

- [ ] `/news/` · to do · News: every Fizlet release, newest first · Fizlet

</details>

<details><summary><b>release</b> (51)</summary>

- [ ] `/news/0.1.0/` · to do · Fizlet 0.1.0 release notes · Fizlet
- [ ] `/news/0.10.0/` · to do · Fizlet 0.10.0 release notes · Fizlet
- [ ] `/news/0.10.1/` · to do · Fizlet 0.10.1 release notes · Fizlet
- [ ] `/news/0.11.0/` · to do · Fizlet 0.11.0 release notes · Fizlet
- [ ] `/news/0.12.0/` · to do · Fizlet 0.12.0 release notes · Fizlet
- [ ] `/news/0.12.1/` · to do · Fizlet 0.12.1 release notes · Fizlet
- [ ] `/news/0.13.0/` · to do · Fizlet 0.13.0 release notes · Fizlet
- [ ] `/news/0.14.0/` · to do · Fizlet 0.14.0 release notes · Fizlet
- [ ] `/news/0.14.1/` · to do · Fizlet 0.14.1 release notes · Fizlet
- [ ] `/news/0.15.0/` · to do · Fizlet 0.15.0 release notes · Fizlet
- [ ] `/news/0.16.0/` · to do · Fizlet 0.16.0 release notes · Fizlet
- [ ] `/news/0.17.0/` · to do · Fizlet 0.17.0 release notes · Fizlet
- [ ] `/news/0.18.0/` · to do · Fizlet 0.18.0 release notes · Fizlet
- [ ] `/news/0.19.0/` · to do · Fizlet 0.19.0 release notes · Fizlet
- [ ] `/news/0.2.0/` · to do · Fizlet 0.2.0 release notes · Fizlet
- [ ] `/news/0.2.1/` · to do · Fizlet 0.2.1 release notes · Fizlet
- [ ] `/news/0.2.2/` · to do · Fizlet 0.2.2 release notes · Fizlet
- [ ] `/news/0.2.3/` · to do · Fizlet 0.2.3 release notes · Fizlet
- [ ] `/news/0.2.4/` · to do · Fizlet 0.2.4 release notes · Fizlet
- [ ] `/news/0.20.0/` · to do · Fizlet 0.20.0 release notes · Fizlet
- [ ] `/news/0.21.0/` · to do · Fizlet 0.21.0 release notes · Fizlet
- [ ] `/news/0.21.1/` · to do · Fizlet 0.21.1 release notes · Fizlet
- [ ] `/news/0.21.2/` · to do · Fizlet 0.21.2 release notes · Fizlet
- [ ] `/news/0.21.3/` · to do · Fizlet 0.21.3 release notes · Fizlet
- [ ] `/news/0.22.0/` · to do · Fizlet 0.22.0 release notes · Fizlet
- [ ] `/news/0.23.0/` · to do · Fizlet 0.23.0 release notes · Fizlet
- [ ] `/news/0.24.0/` · to do · Fizlet 0.24.0 release notes · Fizlet
- [ ] `/news/0.25.0/` · to do · Fizlet 0.25.0 release notes · Fizlet
- [ ] `/news/0.26.0/` · to do · Fizlet 0.26.0 release notes · Fizlet
- [ ] `/news/0.27.0/` · to do · Fizlet 0.27.0 release notes · Fizlet
- [ ] `/news/0.3.0/` · to do · Fizlet 0.3.0 release notes · Fizlet
- [ ] `/news/0.3.1/` · to do · Fizlet 0.3.1 release notes · Fizlet
- [ ] `/news/0.3.2/` · to do · Fizlet 0.3.2 release notes · Fizlet
- [ ] `/news/0.3.3/` · to do · Fizlet 0.3.3 release notes · Fizlet
- [ ] `/news/0.3.4/` · to do · Fizlet 0.3.4 release notes · Fizlet
- [ ] `/news/0.3.5/` · to do · Fizlet 0.3.5 release notes · Fizlet
- [ ] `/news/0.3.6/` · to do · Fizlet 0.3.6 release notes · Fizlet
- [ ] `/news/0.4.0/` · to do · Fizlet 0.4.0 release notes · Fizlet
- [ ] `/news/0.4.1/` · to do · Fizlet 0.4.1 release notes · Fizlet
- [ ] `/news/0.4.2/` · to do · Fizlet 0.4.2 release notes · Fizlet
- [ ] `/news/0.4.3/` · to do · Fizlet 0.4.3 release notes · Fizlet
- [ ] `/news/0.4.4/` · to do · Fizlet 0.4.4 release notes · Fizlet
- [ ] `/news/0.5.0/` · to do · Fizlet 0.5.0 release notes · Fizlet
- [ ] `/news/0.5.1/` · to do · Fizlet 0.5.1 release notes · Fizlet
- [ ] `/news/0.6.0/` · to do · Fizlet 0.6.0 release notes · Fizlet
- [ ] `/news/0.6.1/` · to do · Fizlet 0.6.1 release notes · Fizlet
- [ ] `/news/0.7.0/` · to do · Fizlet 0.7.0 release notes · Fizlet
- [ ] `/news/0.8.0/` · to do · Fizlet 0.8.0 release notes · Fizlet
- [ ] `/news/0.8.1/` · to do · Fizlet 0.8.1 release notes · Fizlet
- [ ] `/news/0.8.2/` · to do · Fizlet 0.8.2 release notes · Fizlet
- [ ] `/news/0.9.0/` · to do · Fizlet 0.9.0 release notes · Fizlet

</details>

<details><summary><b>notes-index</b> (1)</summary>

- [ ] `/notes/` · to do · Notes: what the games taught the engine · Fizlet

</details>

<details><summary><b>note</b> (6)</summary>

- [ ] `/notes/before-ai-2015/` · to do · Before AI: 2015, three micro animations · Fizlet
- [ ] `/notes/how-small-is-small/` · to do · How small is small: Fizlet's sizes · Fizlet
- [ ] `/notes/lockstep-multiplayer-in-a-few-kb/` · to do · Lockstep multiplayer in a few KB · Fizlet
- [ ] `/notes/moving-the-games-onto-a-4-kb-kernel/` · to do · Moving the games onto a 4 KB kernel · Fizlet
- [ ] `/notes/recall-the-page-always-comes-back/` · to do · Recall: how Fizlet gives the page back · Fizlet
- [ ] `/notes/why-fzlt/` · to do · Why fzlt: the short mark of Fizlet, the DOM engine

</details>

<details><summary><b>people-index</b> (1)</summary>

- [ ] `/people/` · to do · People: the maker, AI agents and studio crew · Fizlet

</details>

<details><summary><b>person</b> (7)</summary>

- [ ] `/people/chris-cooley/` · to do · Chris Cooley: maker of Fizlet · Fizlet
- [ ] `/people/david-cooley/` · to do · David Cooley: creator · Fizlet
- [ ] `/people/dj-mempool/` · to do · DJ Mempool: studio crew · Fizlet
- [ ] `/people/frame-zero/` · to do · Frame Zero: studio crew · Fizlet
- [ ] `/people/hex-hazel/` · to do · Hex Hazel: studio crew · Fizlet
- [ ] `/people/pip/` · to do · Pip: an AI agent on the team · Fizlet
- [ ] `/people/quill/` · to do · Quill: an AI agent on the team · Fizlet

</details>

<!-- INVENTORY:END -->
