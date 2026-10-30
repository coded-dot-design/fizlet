# Perf harness

Measured numbers, not claims. Playwright + Chromium over CDP; it loads built pages and only observes.

```sh
npm run perf                 # one command: builds the site, 4x CPU throttle, 10 s per target, then the
                             # allocation test; writes perf-results.json, exits 1 over budget
npm run test:alloc           # the allocation test alone (after `npm run site`)
npm run perf:page            # the page-cost gate (after `npm run site`): page-cost-results.json, exits 1 over budget
# cloud sessions: CHROMIUM_PATH=/opt/pw-browsers/chromium npm run perf
# options: PERF_SECONDS, PERF_THROTTLE, PERF_OUT=<file.json>, ALLOC_FRAMES
# Battlefield Blitz: BLITZ_DIR=<its built dir> [BLITZ_PATH=play/] npm run perf
```

| File | What |
| --- | --- |
| `harness.mjs` | static server, CPU throttle (`Emulation.setCPUThrottlingRate`), GC trace, frame stats, seeded clicker |
| `recorder.js` | rAF frame recorder injected before page scripts; writes into a preallocated `Float64Array` |
| `run.mjs` | the perf run against `budgets.json` (CI job `perf`) |
| `alloc.mjs` | allocation test; the template a game copies |
| `page-cost.mjs` / `page-cost-run.mjs` | the page-cost gate against `page-budgets.json` (below) |

## What each number means

- **p50 / p95 / p99**: rAF-to-rAF frame interval in ms over the measured window (after a 2 s warm-up).
- **dropped**: per interval, `round(dt / 16.67) - 1` missed vsyncs, summed.
- **FCP**: `first-contentful-paint` from the page's paint timing (time to first frame).
- **heap**: CDP `JSHeapUsedSize` at the end of the run, no forced GC.
- **minor / major GC**: V8 scavenges (`MinorGC`) and mark-compacts (`MajorGC`) in a trace of the window.
- **layerize**: Chromium's `Layerize` ms per frame in the same trace. Every frame that repaints
  layerizes the whole document, so every composited layer on the page costs it, on screen or not.

The input is a seeded click every 250 ms on the demo board (a blast and a shock wave each time).

## Measured (demo, 2026-10-29)

Machine: cloud container, Intel Xeon @ 2.80 GHz × 4, 15 GB, Linux, headless Chromium 153.0.8010.12,
Node 24, viewport 1280×800, 10 s window, a seeded click on the demo board every 250 ms.

| fizlet main | Throttle | Runs | p50 ms | p95 ms | p99 ms | Dropped | FCP ms | Heap MB | Minor GC | Major GC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 652455e (0.15.0) | 4× | 6 | 33.4 (one 50.0) | 50.1–83.3 | 83.3–100 | 55–66% | 308–1384 | 2.74–3.43 | 0–2 | 1–5 |
| 652455e (0.15.0) | 1× | 2 | 16.7 | 16.7–16.8 | 16.8 | 0–0.3% | 240–276 | 2.84–2.86 | 1 | 7–8 |
| 0.2.4 to 0.4.4 | 4× | 9 | 16.7 | 33.3–33.4 | 33.4–50.0 | 14–25% | 140–1232 | 2.42–3.30 | 3–4 | 2–6 |
| 0.2.4 | 1× | 1 | 16.7 | 16.7 | 16.8 | 0% | 196 | 2.64 | 3 | 7 |

Between 0.4.4 and 0.15.0 the scripted demo at 4× went from 60 to about 30 fps. Idle with the demo in
view it still holds 60 fps at 4× (0 dropped in 6 s), so the cost is in the blasts; idle at the top of
the page (the hero) drops 82 of 360 frames at 4×. Not investigated further here (measure only).

Allocation test (no throttle, ~600 frames, 0.15.0): idle 0 minor GCs; scripted 2. Sampled bytes in
the scripted run, per frame: `draw` 2.77 KB, `drawGround` 1.04 KB, `render` 1.01 KB, `step` 0.81 KB.
On 0.2.4 a 30 s warm-up made `step` disappear (its early bytes are pre-optimization), while `render`
kept allocating (the style strings it writes).

Sensitivity: V8 grows its young generation, so minor-GC counts only catch sustained allocation. An
injected allocation of 4 KB/frame showed 2 extra scavenges per 600 frames, 16 KB/frame showed 6.
That is why `alloc.mjs` also prints the sampled top allocators.

Battlefield Blitz: not measured yet. Its source is not in this repo and the hosted build was not
reachable from the session that wrote this; set `BLITZ_DIR` to measure it.

## Page cost (`npm run perf:page`)

What a page's interactions cost the page they sit on. Each page in `page-budgets.json` is loaded
as built ("live") and with only its posters ("poster": every `<script type="module">` removed
except the ones in `keep`, the site chrome), at desktop (1440×900) and mobile (390×844, 4× CPU).
The gate is live minus poster, against the page budgets: CLS +0 (at 0.000), a tap on page text
outside every interaction +8 ms desktop / +24 ms mobile, idle main-thread CPU while visible +3 /
+10 points.

- **Frames, not wall time.** Every wait counts animation frames: 120 to settle after load, a
  180-frame idle window, 20 frames between taps.
- **Best of N.** Each measure is the median over its taps (5) or its window inside a run, then the
  best of `PAGE_RUNS` runs (default 3), live and poster interleaved. Noise only adds cost, so the
  best run is the closest to the page's real cost.
- **Tap latency** is read in the page: the input event's own `timeStamp` to the start of the next
  frame after its handlers, at sub-ms resolution. Event Timing reports nothing under 16 ms and
  rounds to 8 ms, too coarse for a +8 ms budget.
- **Idle CPU** is CDP `TaskDuration` over the idle window, divided by its length.

**Exceptions.** `exceptions` in `page-budgets.json` names a page, profile and measure that may stay
over its budget while its own tracking task fixes it. It is reported on every run (a warning
annotation and `excepted` in the JSON), fails past its `ceiling` (the level measured when it was
written), and never moves the budget. Each one names a roadmap task, links its tracking issue,
says why and records the measured runs; CLS has none. Today: home desktop idle, G20 (#139).

Options: `PAGE_RUNS`, `PAGE_OUT=<file.json>`, `PAGE_ONLY=<page name>`. Unit tests for the pure
parts (poster page, best of N, verdict): `tests/page-cost.test.mjs`.
