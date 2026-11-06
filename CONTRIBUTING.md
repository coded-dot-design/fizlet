# Contributing

Pull requests welcome. Before you open one, run `npm run check`, `npm run test`, `npm run test:browser`, `npm run size`, `npm run publish-clean` and keep them green. Keep the contract in README.md; no runtime dependencies.

## Weekly contest entries

Contest entries live with the website, not in this repo. Enter on GitHub by opening an issue titled `Contest <week>: <your prompt>` (any length; a week is an ISO week like `2026-W45`). Each entry goes live only once the owner approves it, and the team picks one winner a week. Size decides: a piece whose live code is 10 KB gzip or less (measured at build) can win; a bigger one is posted, marked too big to win. Rules: https://fizlet.com/contest/

## Roadmap line

The roadmap on https://fizlet.com/#roadmap ticks a box only with evidence. Each item has a key, like `E9.npm` or `E10.diagram`. If your PR finishes one, add a line to its description:

```
Roadmap: E10.diagram
```

Several keys go on one line, comma separated. A release note can carry the same line. The roadmap is refreshed from merged PRs and releases that name a key; a key that isn't on the roadmap is reported, not ticked. To take a tick back, say `Roadmap-undo: <key>` and why.
