# Contributing

Pull requests welcome. Before you open one, run `npm run check`, `npm run test:browser` and `npm run size`, and keep them green. Keep the contract in README.md; no runtime dependencies.

This repository is the `@fzlt/core` package only. The website (fizlet.com) and the docs (https://docs.fzlt.dev) live in their own repositories; gallery pieces and contest entries go there, not here.

## Roadmap line

Each roadmap item has a key, like `E9.npm` or `E10.diagram`. If your PR finishes one, add a line to its description:

```
Roadmap: E10.diagram
```

Several keys go on one line, comma separated. A release note can carry the same line. To take a tick back, say `Roadmap-undo: <key>` and why.
