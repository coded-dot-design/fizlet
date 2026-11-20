# Contributing

Pull requests welcome. Before you open one, run `npm run check`, `npm run test:browser` and `npm run size`, and keep them green. Keep the contract in README.md; no runtime dependencies.

This repository is the `@fzlt/core` package only. The website (fizlet.com) and the docs (https://docs.fzlt.dev) live in their own repositories; gallery pieces and contest entries go there, not here.

## Docs on every export

Every public export of a brick, and every member of an exported options or return type, carries a `/** */` TSDoc comment in `src/`: what it does, its units and default, whether it allocates (never in a step) and how it settles or is undone at Recall. Editors and the API pages show it. `npm run docs:coverage` lists what has none; CI fails on a new undocumented one (`scripts/docs-coverage.json` is the shrinking list of old ones: `npm run docs:coverage -- --write` after you document some).

## Roadmap line

Each roadmap item has a key, like `E9.npm` or `E10.diagram`. If your PR finishes one, add a line to its description:

```
Roadmap: E10.diagram
```

Several keys go on one line, comma separated. A release note can carry the same line. To take a tick back, say `Roadmap-undo: <key>` and why.
