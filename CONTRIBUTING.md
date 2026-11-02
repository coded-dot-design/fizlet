# Contributing

Pull requests welcome. Before you open one, run `npm run check`, `npm run test`, `npm run test:browser`, `npm run size` and keep them green. Keep the contract in README.md; no runtime dependencies.

## Weekly contest entries

No backend yet: enter on GitHub. Open an issue titled `Contest <week>: <your prompt>` (any length; a week is an ISO week like `2026-W45`), or open a PR that adds your animation under `site/gallery/`, dated on a day of that week, with your `"author"` id on its entry (and `site/contributors/<id>.json` if you are new). One or two new pieces join the gallery a day, at most, and each goes live only once the owner approves it; a week's pieces are its entries, and the team picks one winner a week. Size decides: a piece whose live code is 10 KB gzip or less (measured at build) can win; a bigger one is posted, marked too big to win. The build checks it. Rules: https://fizlet.com/contest/

## Roadmap line

The roadmap on fizlet.com (section 09, from `site/roadmap.mjs`) ticks a box only with evidence. Each item has a key, like `E9.npm` or `E10.diagram`. If your PR finishes one, add a line to its description:

```
Roadmap: E10.diagram
```

Several keys go on one line, comma separated. A release note can carry the same line. The roadmap is refreshed from merged PRs and releases that name a key; a key that isn't in `site/roadmap.mjs` is reported, not ticked. To take a tick back, say `Roadmap-undo: <key>` and why.
