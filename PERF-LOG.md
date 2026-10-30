# Perf log

Every performance win in Fizlet, one line each, measured before and after. Newest first.
Generated from `tests/perf/wins.json` by `node scripts/perf-log.mjs --write`; do not edit by hand.

| Version | Win | Measured | Before → after | How | Test | PR |
| --- | --- | --- | --- | --- | --- | --- |
| 0.19.0 | The fps cap caps requestAnimationFrame, not just the work | page-wide rAF calls a second while fizz#hero is in view, home page at 1440 (two 30 fps heroes) | 119.6 → 28.5 rAF/s | real-browser audit (Chromium, abe browse, page-wide rAF count) | tests/kernel.test.mjs (rAF calls a second at 60 and 120 Hz), tests/site.mjs (fizz story page-wide rAF ≤ 33/s) | [#67](https://github.com/coded-dot-design/fizlet/pull/67) |
| 0.19.0 | The home demo settles when nothing moves | page-wide rAF calls a second while the demo is in view and untouched, /gallery/ at 1440 (60.3 → 0 at 390) | 60.4 → 0 rAF/s | real-browser audit (Chromium, abe browse); it settles half a second after the last letter, wave, particle and scorch mark stop | tests/site.mjs (settled: no frames while nothing moves) | [#67](https://github.com/coded-dot-design/fizlet/pull/67) |
