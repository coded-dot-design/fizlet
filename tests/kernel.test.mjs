// Kernel contract tests (Node, no browser): one clock, fixed step, bounded pools and events,
// seeded random, pause, destroy, and zero allocation in the steady state.
// Run with: node --expose-gc --import tsx --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver, constants } from "node:perf_hooks";

// A fake requestAnimationFrame we can step by hand.
let queue = [], nextId = 1;
globalThis.requestAnimationFrame = (cb) => (queue.push(cb), nextId++);
globalThis.cancelAnimationFrame = () => (queue = []);
const flush = (now) => {
  const q = queue;
  queue = [];
  q.forEach((cb) => cb(now));
};

const { createEngine, scheduler, seeded, Pool, EventRing, STEP, RENDER } = await import("../src/index.ts");

test("one clock: N engines share one requestAnimationFrame", () => {
  const before = scheduler.requests;
  const engines = [createEngine(), createEngine(), createEngine()];
  engines.forEach((e) => e.start());
  assert.equal(scheduler.engines, 3);
  assert.equal(scheduler.requests - before, 1, "one request for three engines");
  flush(1000);
  flush(1016);
  assert.equal(scheduler.requests - before, 3, "one request per frame, not per engine");
  engines.forEach((e) => e.destroy());
  assert.equal(scheduler.engines, 0);
  assert.equal(queue.length, 0, "no engines: the pending frame is cancelled, the clock stops");
});

test("fixed step with a catch-up cap (drop, don't spiral) and render alpha", () => {
  const e = createEngine({ step: 1 / 60, maxSteps: 4 });
  let steps = 0, alpha = -1;
  e.add({ step: () => steps++, render: (_, a) => (alpha = a) });
  e.advance(0.05);
  assert.equal(steps, 3);
  assert.ok(alpha >= 0 && alpha < 1);
  e.advance(1);
  assert.equal(steps, 7, "a long frame runs at most maxSteps");
  assert.ok(e.stats().dropped >= 50, "the rest is dropped and counted");
  assert.ok(Math.abs(e.time - 7 / 60) < 1e-9, "time only counts steps that ran");
  e.destroy();
});

test("phases: read, then steps, then render", () => {
  const e = createEngine();
  const seen = [];
  e.add({ read: (x) => seen.push(["read", x.phase]), step: (x) => seen.push(["step", x.phase]), render: (x) => seen.push(["render", x.phase]) });
  e.advance(1 / 60 + 1e-6);
  assert.deepEqual(seen, [["read", 1], ["step", STEP], ["render", RENDER]]);
  assert.equal(e.phase, 0);
  e.destroy();
});

test("pause stops all work; resume does not replay the gap", () => {
  const e = createEngine();
  let steps = 0;
  e.add({ step: () => steps++ });
  e.start();
  flush(0);
  flush(100);
  const ran = steps;
  assert.ok(ran > 0);
  e.stop();
  assert.equal(e.running, false);
  assert.deepEqual(e.paused, ["stopped"]);
  flush(5000);
  assert.equal(steps, ran, "nothing runs while paused");
  e.start();
  flush(9000);
  flush(9016);
  assert.ok(steps - ran <= 1, "the paused time is not simulated");
  e.destroy();
});

test("bounded: pools and the event ring refuse work at their cap", () => {
  const e = createEngine({ events: 3 });
  const p = e.pool("shots", 2, () => ({ x: 0 }));
  assert.ok(p.acquire() && p.acquire());
  assert.equal(p.acquire(), undefined, "a full pool refuses");
  assert.deepEqual(e.stats().pools.shots, { used: 2, cap: 2 });
  p.releaseAt(0);
  assert.equal(p.size, 1);
  for (let i = 0; i < 5; i++) e.events.emit("hit", i);
  assert.equal(e.events.size, 3);
  assert.equal(e.events.dropped, 2);
  assert.equal(e.events.at(2).a, 2);
  e.advance(0);
  assert.equal(e.events.size, 0, "each frame starts with an empty ring");
  assert.throws(() => new Pool(0, () => 1));
  assert.equal(new EventRing(1).emit("x") && true, true);
  e.destroy();
});

test("seeded random: deterministic, restorable, same sequence as the DOM VIRUS core", () => {
  const a = seeded(42), b = seeded(42);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  // The core's seededRandom(42): n = n * 1664525 + 1013904223 (mod 2^32), / 2^32.
  let n = 42;
  const core = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0), n / 4294967296);
  assert.deepEqual(xs, [core(), core(), core()]);
  const saved = a.state, next = a();
  a.state = saved;
  assert.equal(a(), next, "state snapshots and restores");
});

test("destroy: aborts the signal, stops, clears pools, follows a parent signal", () => {
  const parent = new AbortController();
  const e = createEngine({ signal: parent.signal });
  const p = e.pool("p", 4, () => ({}));
  p.acquire();
  e.start();
  parent.abort();
  assert.equal(e.signal.aborted, true);
  assert.equal(e.running, false);
  assert.equal(p.size, 0);
  e.start();
  assert.equal(e.running, false, "a destroyed engine never restarts");
});

test("zero allocation in the steady state (10k+ steps)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine({ events: 32 });
  const bodies = e.pool("bodies", 64, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  // A busy system: spawns and retires bodies, integrates, emits events, draws random numbers.
  e.add({
    step(x, dt) {
      if (bodies.size < 60) {
        const b = bodies.acquire();
        if (b) (b.x = x.random() * 100), (b.y = 0), (b.vx = x.random() - 0.5), (b.vy = 1);
      }
      const items = bodies.items;
      for (let i = items.length; i--; ) {
        const b = items[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt * 60;
        if (b.y > 100) (x.events.emit("touch", i, 0, b.x, b.y, b.vy), bodies.releaseAt(i));
      }
    },
  });
  const run = (frames) => {
    for (let i = 0; i < frames; i++) e.advance(1 / 60);
  };
  run(20000); // warm up: let the JIT settle and every pool and map reach its size
  gc();
  let minor = 0;
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
  });
  obs.observe({ entryTypes: ["gc"] });
  run(1000000); // 1M steps: even 16 bytes a step would fill the young generation many times over
  await new Promise((r) => setTimeout(r, 50));
  obs.disconnect();
  // One stray scavenge can come from the test runner itself; a real per-step allocation shows as dozens.
  assert.ok(minor <= 1, `young-generation GCs during 1M steps: ${minor}`);
  e.destroy();
});
