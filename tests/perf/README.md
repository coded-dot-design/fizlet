# Perf harness

Measured numbers, not claims. Playwright + Chromium over CDP; it loads built pages and only observes.

```sh
npm run perf                 # one command: builds the site, 4x CPU throttle, 10 s per target, then the
                             # allocation test; writes perf-results.json, exits 1 over budget
npm run test:alloc           # the allocation test alone (after `npm run site`)
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

## What each number means

- **p50 / p95 / p99**: rAF-to-rAF frame interval in ms over the measured window (after a 2 s warm-up).
- **dropped**: per interval, `round(dt / 16.67) - 1` missed vsyncs, summed.
- **FCP**: `first-contentful-paint` from the page's paint timing (time to first frame).
- **heap**: CDP `JSHeapUsedSize` at the end of the run, no forced GC.
- **minor / major GC**: V8 scavenges (`MinorGC`) and mark-compacts (`MajorGC`) in a trace of the window.

The input is a seeded click every 250 ms on the demo board (a blast and a shock wave each time).

## Measured (demo, 2026-10-29)

Machine: cloud container, Intel Xeon @ 2.80 GHz × 4, 15 GB, Linux, headless Chromium 153.0.8010.12,
viewport 1280×800, 10 s window. Five runs at 4×; one at 1× for reference.

| Throttle | p50 ms | p95 ms | p99 ms | Dropped | FCP ms | Heap MB | Minor GC | Major GC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4× (5 runs) | 16.7 | 33.3–33.4 | 33.4 | 73–104 of 514–541 (14–20%) | 244–520 | 2.43–2.93 | 3–4 | 5–6 |
| 1× (1 run) | 16.7 | 16.7 | 16.8 | 0 of 611 | 196 | 2.64 | 3 | 7 |

Allocation test (no throttle, 600 frames): idle 0 minor GCs; scripted 3. Sampled bytes in the scripted
run, per frame: `draw` 2.25 KB, `render` 1.22 KB, `drawGround` 1.07 KB, `step` 0.67 KB. After a 30 s
warm-up `step` no longer shows (its early bytes are pre-optimization), while `render` keeps allocating
(the style strings it writes).

Sensitivity: V8 grows its young generation, so minor-GC counts only catch sustained allocation. An
injected allocation of 4 KB/frame showed 2 extra scavenges per 600 frames, 16 KB/frame showed 6.
That is why `alloc.mjs` also prints the sampled top allocators.

Battlefield Blitz: not measured yet. Its source is not in this repo and the hosted build was not
reachable from the session that wrote this; set `BLITZ_DIR` to measure it.
