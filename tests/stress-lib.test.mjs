// The stress tests' shared helpers (tests/stress/lib.mjs): flags, medians and the trace breakdown
// (self time per group on the renderer main thread). The browser runs themselves are not in `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { breakdown, flags, list, median } from "./stress/lib.mjs";

test("flags: --k v, --k=v, bare --flag; list splits commas", () => {
  assert.deepEqual(flags(["--runs", "5", "--throttle=4,6", "--self-test", "--x"]), { runs: "5", throttle: "4,6", "self-test": true, x: true });
  assert.deepEqual(list("4, 6", "1").map(Number), [4, 6]);
  assert.deepEqual(list(undefined, "1,8"), ["1", "8"]);
});

test("median ignores null and NaN", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, null, NaN, 2, 3]), 2.5);
  assert.ok(Number.isNaN(median([])));
});

test("breakdown: self time, main thread only, grouped, per frame", () => {
  const M = { pid: 1, tid: 2 };
  const ev = (name, ts, dur, t = M) => ({ ph: "X", name, ts, dur, ...t });
  const events = [
    { ph: "M", name: "thread_name", pid: 1, tid: 2, args: { name: "CrRendererMain" } },
    ev("RunTask", 0, 10000),
    ev("FireAnimationFrame", 0, 6000), // 6 ms, 4 of them in the call below
    ev("FunctionCall", 1000, 4000),
    ev("Paint", 6000, 2000),
    ev("Layerize", 8000, 1000),
    ev("MinorGC", 9000, 500),
    ev("Paint", 0, 50000, { pid: 1, tid: 9 }), // another thread: not counted
  ];
  const b = breakdown(events, 2);
  assert.deepEqual(b.msPerFrame, { script: 3, paint: 1, "layerize+commit": 0.5, gc: 0.25 });
  assert.equal(b.busyMsPerFrame, 4.75);
});
