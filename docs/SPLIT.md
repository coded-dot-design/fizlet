# The split: this repository is the package

## What this repository is

After the split, this repository holds `@fzlt/core` and nothing else. It is public and MIT-licensed
at `fizlet/fzlt`. It contains:

- `src/` (the bricks), `bin/fzlt.mjs`, the build (`scripts/build.mjs`) and the size budgets
  (`scripts/sizes.mjs`, `npm run size`).
- The API snapshots of the COMPLETE bricks (`api/`, `npm run api:check`) and the brick catalog
  (`scripts/bricks.mjs`).
- The engine tests (Node, Chromium, WebKit) and perf (`npm run perf`, measured on
  `tests/perf/fixture`, the home demo on a page of its own).
- The release workflow (`.github/workflows/release.yml`).

What npm ships is `bin/`, `dist/`, `CHANGELOG.md`, `LICENSE`, `README.md` and `package.json`.
`npm run publish-clean` checks this on every PR and before every publish: no other files, no
agent words, no private names (doc comments included), and no comments in shipped code except its
public documentation (see "Comments in the package" below).

## Where the rest lives

- **fizlet.com**: the website, on Astro, in its own private repository (named fizlet-site). The
  gallery, contest, demos, recipes, guides and the brick pages all live there.
- **docs.fzlt.dev**: the docs (each brick's guide and full API, generated from this package's
  source and declarations). `package.json` `homepage` points here, and so does `npx @fzlt/core`.
- **The games**: each in its own repository. Each one depends on a published `@fzlt/core`.

## How a release reaches the site

1. Here: bump `version` in `package.json` and the lockfile, and add the CHANGELOG entry. Then merge
   to `main`.
2. CI goes green on `main`, `tag-version` tags `vX.Y.Z`, and `release.yml` publishes to npm with
   provenance, from `fizlet/fzlt` only, using the `NPM_TOKEN` secret.
3. The site pins `@fzlt/core` to an exact version. To take the release, it opens a PR that bumps
   the pin, builds, and runs its own checks. That PR gets a preview; `main` goes to staging, and a
   promote goes to production.
4. The site builds what it hosts from the installed package, not from this repository:
   - `fizlet.com/fizlet.js`: the one-file script-tag build, bundled from `node_modules/@fzlt/core`.
   - `fizlet.com/dist/...`: the ES modules of the quick start, copied from the package's `dist/`.
   - `llms-full.txt` and the brick pages: generated from the package's `dist/*.d.ts` (with their
     doc comments) and the catalog.

   Before the split, `scripts/site.mjs` here built all of these from `src/`.

## Comments in the package

The default, until the owner decides otherwise, is that the package keeps its public
documentation. It is set in `scripts/build.mjs`, checked by `npm run publish-clean` and
`tests/build-output.test.mjs`, and reversible.

- **Kept:** every TSDoc block (`/** ... */`) in `dist/*.d.ts`, so editors show each export's docs,
  and the bundler annotations (`/* @__PURE__ */`, `/* @__NO_SIDE_EFFECTS__ */`) in `dist/*.js`,
  which consumers' tree-shaking reads.
- **Stripped:** everything else. That covers line comments, internal block comments, esbuild's path
  markers and notes inside function bodies. Nothing is kept in `bin/`.

Measured on 2026-11-20 (0.27.0 plus tonight's main, esbuild 0.28.2, npm pack):

| Shipped comments | Packed (tgz) | Unpacked | Files |
|---|---:|---:|---:|
| None stripped (the build before PR 287) | 377,562 B | 1,100,844 B | 128 |
| **Docs and annotations kept (default)** | **364,459 B** | **1,068,351 B** | 128 |
| All stripped (PR 287 as written) | 301,118 B | 896,304 B | 128 |

Keeping the docs costs 63,341 B packed (+21%) over stripping everything. That is a download cost
only: it changes nothing in a consumer's bundle.

What consumers ship (one import, bundled with esbuild `--minify`, gzip bytes):

| Import | None stripped | Docs kept | All stripped |
|---|---:|---:|---:|
| `createEngine` from `@fzlt/core` | 3,227 | 3,227 | 3,227 |
| `effects` from `/fx` | 2,089 | 2,089 | 2,089 |
| `emitter` from `/fx` | 681 | 681 | 681 |
| `arcade` from `/arcade` | 18,152 | 18,152 | 18,188 (+36) |
| `press` from `/ui` | 192 | 192 | 192 |
| `diorama` from `/diorama` | 6,607 | 6,607 | 6,647 (+40) |
| `scene` from `/scene` | 8,385 | 8,385 | 8,385 |
| `presence` from `/presence` | 1,019 | 1,019 | 1,019 |
| `sprites` from `/sprite` | 1,175 | 1,175 | 1,175 |
| `timeline` from `/timeline` | 2,130 | 2,130 | 2,130 |

Keeping the annotations leaves every consumer bundle as it was before any strip. Stripping them
grows 2 of these 10 (arcade +36 B, diorama +40 B).

## URLs the site must keep serving

These are linked from what is already on npm: the README and CHANGELOG of 0.27.0 and earlier,
and the CHANGELOG this package still ships.

| URL | Linked from |
|---|---|
| https://fizlet.com/ | every published README |
| https://fizlet.com/guides/build-your-own-room-server/ | published READMEs (presence); the packed CHANGELOG |
| https://fizlet.com/#roadmap | published READMEs (status flags) |
| https://fizlet.com/fizlet.js | the quick start, the docs (script-tag build, `window.fizlet`) |
| https://fizlet.com/dist/ (every subpath, such as `dist/index.js`, `dist/fx.js`, `dist/input.js`) | the quick start and the docs (ESM without npm) |
| https://fizlet.com/llms.txt, https://fizlet.com/llms-full.txt | robots.txt, the docs |
| https://fizlet.com/bricks/ and `bricks/<id>.html` | published READMEs (brick pages), the bricks index |
| https://fizlet.com/contest/ | the old CONTRIBUTING (GitHub only, not packed) |
| https://coded-dot-design.github.io/fizlet/ | published READMEs (0.27.0 and earlier) and the packed CHANGELOG. This was this repository's Pages deploy, which the split removes, so it needs a redirect to https://fizlet.com/ (a Pages stub, or Pages on the site repository). |

## Transfer steps for the owner

In this order:

1. **The site serves fizlet.com from its own repository**, with `fizlet.js` and `dist/` built from
   the npm package. It must also serve the redirect from the old Pages address.
2. **Transfer this repository to `fizlet/fzlt`** (Settings > Transfer).
3. **Keep it public.** npm provenance needs a public source repository.
4. **Add the `NPM_TOKEN` secret** in `fizlet/fzlt` (Settings > Secrets and variables > Actions),
   and check it is there after the transfer.
5. **Merge PR 377** (HOLD). Rebase it on `main` first and wait for CI to go green on its head.
6. **Release from `fizlet/fzlt`.** The next version bump is published from there. Optionally,
   check the release with `npm audit signatures` after installing it.

## What breaks if the order is wrong

- **377 merged before the transfer.** The release job skips the publish, because it publishes from
  `fizlet/fzlt` only. That guard exists because `package.json` already names `fizlet/fzlt`, and npm
  rejects a provenance publish whose `repository` does not match the repository that built it. A
  version bump merged in that window gets its tag but is never published. `tag-version` sees the
  tag on every later run and does nothing, so publish that tag by hand after the transfer (Actions >
  Release to npm > Run workflow, tag `vX.Y.Z`).
- **377 merged before the site serves fizlet.com from its own repository.** `pages.yml` is gone, so
  `coded-dot-design.github.io/fizlet/` stops getting new builds, and links to it break once Pages is
  turned off. The hosted `fizlet.js` and `dist/` stay at the last deploy and fall behind npm.
- **The repository made private, or transferred to a private repository.** The publish fails at the
  provenance step.
- **No `NPM_TOKEN` in `fizlet/fzlt`.** Every release checks and packs, then warns and skips the
  publish. Nothing is published until the secret is added and the tag is run by hand.
- **A new repository created under the old name (`coded-dot-design/fizlet`).** GitHub's redirect
  from the old address stops. Old clones, links in published READMEs and issue links then point at
  the new repository instead of `fizlet/fzlt`.
