# Fizlet: notes for agents

- The plan of record is `dom-virus/ENGINE.md` (phases E0–E6, the contract, the bricks). This repo
  is the engine itself; DOM VIRUS and DOM Battlefield are the showcases.
- **No runtime dependencies, ever** (CI fails if `dependencies` or `peerDependencies` appear).
  Dev tools only: typescript, esbuild, tsx, playwright.
- Every change keeps the contract in README.md. Hot paths (`step`) never allocate, never read
  layout, never write the DOM. Use pools, the event ring and typed arrays for running numbers
  (a captured `let` that holds a double boxes a new number on every write).
- Every page change goes through `engine.ledger`; `destroy()` must restore the page exactly.
- Budgets: `npm run size` (kernel ≤ 4 KB gzip, bricks ~1.5 KB). Tests: `npm run check` and
  `npm run test:browser` (Chromium at `/opt/pw-browsers/chromium` in cloud sessions:
  `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:browser`).
- Board UI lives in `src/ui/` (source of truth; `dom-battlefield/board-ui/` is a copy until
  Battlefield consumes this package). Spec: `src/ui/BOARD-UI.md`.
- Website: `site/` → `npm run site` → `site-dist/` (no framework), `npm run test:site`, Pages via `pages.yml`.
- Release: bump `package.json` version (+ lockfile), add a CHANGELOG entry, push `main`; CI tags.
  Landing a PR: `node scripts/land.mjs bump <version>` (package, lockfile, CHANGELOG Unreleased),
  `land.mjs changelog` (resolve a CHANGELOG rebase conflict), `land.mjs ci <sha>` (wait; fails unless
  every check is green). Code conflicts are resolved by hand, never by script.
