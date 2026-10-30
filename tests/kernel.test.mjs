// Kernel contract tests (Node, no browser): one clock, fixed step, bounded pools and events,
// seeded random, pause, destroy, and zero allocation in the steady state.
// Run with: npm test (node --expose-gc --import tsx --test --test-concurrency=1 tests/*.test.mjs)
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

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

test("settle: no frames once nothing is busy; wake() and start() bring it back; no pause hooks", () => {
  const e = createEngine({ settle: 0.1 });
  let moving = true, steps = 0, pauses = 0;
  e.add({ step: (x) => (steps++, moving && x.busy()), pause: () => pauses++ });
  e.start();
  let t = 0;
  const frames = (k) => { for (let i = 0; i < k; i++) flush((t += 1000 / 60)); };
  frames(30);
  assert.equal(e.running, true, "busy every frame: awake");
  moving = false;
  frames(4);
  assert.equal(e.running, true, "quiet for less than settle: still awake");
  frames(6);
  assert.deepEqual(e.paused, ["settled"], "quiet for settle seconds: asleep");
  assert.equal(queue.length, 0, "asleep: no requestAnimationFrame at all");
  const ran = steps;
  flush((t += 5000));
  assert.equal(steps, ran);
  assert.equal(pauses, 0, "settling is not a pause: held input and sounds are kept");
  e.wake();
  assert.equal(e.running, true);
  frames(2);
  assert.ok(steps - ran <= 2, "waking does not replay the time asleep");
  frames(10);
  assert.deepEqual(e.paused, ["settled"], "and it settles again");
  e.stop();
  e.start();
  assert.equal(e.running, true, "start() wakes it too");
  assert.throws(() => createEngine({ settle: 0 }), RangeError);
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

test("pause hook: systems hear each running → paused change once (input drops held keys there)", () => {
  const e = createEngine();
  let pauses = 0;
  e.add({ pause: (x) => (assert.equal(x, e), pauses++) });
  e.stop(); // never started: not a change
  assert.equal(pauses, 0);
  e.start();
  e.stop();
  e.stop();
  assert.equal(pauses, 1, "once per change, not per call");
  e.start();
  e.destroy(); // destroy is not a pause: bricks clean up on the signal
  assert.equal(pauses, 1);
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

test("scheduler: an engine started from inside a hook does not add a second rAF", () => {
  const a = createEngine(), b = createEngine();
  a.add({ read: () => b.start() });
  a.start();
  assert.equal(queue.length, 1);
  flush(0);
  assert.equal(queue.length, 1, "exactly one pending frame after a hook starts another engine");
  flush(16);
  assert.equal(queue.length, 1);
  a.destroy();
  b.destroy();
  assert.equal(queue.length, 0);
});

test("scheduler: an engine stopping or destroying itself mid-frame does not skip the next engine", () => {
  const seen = [];
  const a = createEngine(), b = createEngine(), c = createEngine();
  a.add({ read: () => (seen.push("a"), a.destroy()) });
  b.add({ read: () => (seen.push("b"), b.stop(), b.start()) });
  c.add({ read: () => seen.push("c") });
  [a, b, c].forEach((e) => e.start());
  flush(0);
  assert.deepEqual(seen, ["a", "b", "c"], "every engine ran once this frame");
  seen.length = 0;
  flush(16);
  assert.deepEqual(seen.sort(), ["b", "c"], "a restarted engine runs once a frame, not twice");
  [b, c].forEach((e) => e.destroy());
  assert.equal(queue.length, 0);
});

test("engine.remove(system) during a hook does not skip the next system", () => {
  const e = createEngine();
  const seen = [];
  const a = e.add({ read: () => (seen.push("a.read"), e.remove(a)), step: () => seen.push("a.step"), render: () => seen.push("a.render") });
  e.add({ read: () => seen.push("b.read"), step: () => seen.push("b.step"), render: () => seen.push("b.render") });
  e.advance(1 / 60 + 1e-6);
  assert.deepEqual(seen, ["a.read", "b.read", "b.step", "b.render"]);
  seen.length = 0;
  e.advance(1 / 60);
  assert.deepEqual(seen, ["b.read", "b.step", "b.render"]);
  e.destroy();
});

test("a throwing hook stops only its own engine; the shared clock keeps running", () => {
  const errors = [];
  const bad = createEngine({ onError: (err, eng) => errors.push([err.message, eng === bad]) });
  const good = createEngine();
  let ok = 0;
  bad.add({ step: () => { throw new Error("boom"); } });
  good.add({ read: () => ok++ });
  bad.start();
  good.start();
  flush(0);
  flush(17);
  assert.deepEqual(errors, [["boom", true]]);
  assert.deepEqual(bad.paused, ["stopped"], "the failing engine is stopped");
  assert.equal(bad.phase, 0);
  assert.equal(good.running, true);
  assert.equal(queue.length, 1, "the shared clock is still scheduled");
  flush(34);
  assert.equal(ok, 3, "the other engine ran every frame");
  // Without onError the failure is reported on console.error, and the clock still survives.
  const logged = [], log = console.error;
  console.error = (x) => logged.push(x.message);
  const loud = createEngine();
  loud.add({ read: () => { throw new Error("loud"); } });
  loud.start();
  flush(51);
  console.error = log;
  assert.deepEqual(logged, ["loud"]);
  assert.equal(loud.running, false);
  assert.equal(queue.length, 1);
  [bad, good, loud].forEach((x) => x.destroy());
});

test("configuration is validated (finite numbers, positive integer capacities)", () => {
  for (const o of [{ step: 0 }, { step: -1 }, { step: NaN }, { step: Infinity }, { step: "1" }]) assert.throws(() => createEngine(o), { name: "RangeError", message: /step/ }, JSON.stringify(o));
  for (const o of [{ maxSteps: 0 }, { maxSteps: 1.5 }, { maxSteps: NaN }, { maxSteps: Infinity }]) assert.throws(() => createEngine(o), { name: "RangeError", message: /maxSteps/ });
  for (const o of [{ seed: NaN }, { seed: Infinity }, { seed: "1" }]) assert.throws(() => createEngine(o), { name: "RangeError", message: /seed/ });
  for (const o of [{ events: 0 }, { events: 2.5 }, { events: NaN }, { events: -1 }]) assert.throws(() => createEngine(o), { name: "RangeError", message: /events/ });
  for (const cap of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => new EventRing(cap), RangeError);
  const e = createEngine();
  for (const cap of [0, 1.5, NaN, Infinity, "2"]) assert.throws(() => e.pool("p", cap, () => ({})), { name: "RangeError", message: /cap/ });
  e.destroy();
  assert.equal(scheduler.engines, 0, "a rejected config leaves nothing scheduled");
});

test("destroy is idempotent and leaves the engine inert", () => {
  const e = createEngine();
  let hooks = 0;
  e.add({ read: () => hooks++, step: () => hooks++, render: () => hooks++ });
  e.start();
  e.destroy();
  e.destroy();
  e.start();
  e.advance(1);
  e.add({ read: () => hooks++ });
  e.advance(1);
  assert.equal(hooks, 0, "no hook runs after destroy");
  assert.equal(e.time, 0);
  assert.equal(e.running, false);
  assert.equal(scheduler.engines, 0);
  assert.equal(queue.length, 0);
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
  // 1M steps per window: even 16 bytes a step would fill the young generation many times over.
  // Best of three windows (tests/gc.mjs): a real per-step allocation shows as dozens in every one.
  const minor = await minorGCs(() => run(1000000));
  assert.ok(minor <= 1, `young-generation GCs during 1M steps (best of 3 windows): ${minor}`);
  e.destroy();
});

// A display with fake timers: each vsync fires the timers due by then, then the pending frame.
// Returns how many rAF callbacks ran (what a browser audit counts as frames). Pending timers carry
// over to the next call (the clock only moves forward). The kernel reads the global setTimeout at
// call time, so swapping it inside a synchronous test is safe.
let timers = [];
function display(t0, ms, hz = 60) {
  const real = globalThis.setTimeout;
  let now = t0, rafs = 0;
  globalThis.setTimeout = (cb, d) => timers.push({ at: now + d, cb });
  try {
    for (let k = 1; k * (1000 / hz) <= ms; k++) {
      now = t0 + k * (1000 / hz);
      for (const t of timers.filter((t) => t.at <= now)) (timers = timers.filter((x) => x !== t)), t.cb();
      if (queue.length) (rafs++, flush(now));
    }
  } finally {
    globalThis.setTimeout = real;
  }
  return { rafs };
}

test("fps cap: frames closer than 1/fps do no work; time still adds up", () => {
  const e = createEngine({ fps: 30 });
  let frames = 0;
  e.add({ render: () => frames++ });
  e.start();
  display(1e6, 1000);
  assert.ok(frames >= 29 && frames <= 31, `30 fps cap on a 60 Hz clock: ${frames} frames a second`);
  assert.ok(Math.abs(e.time - 1) < 0.05, `simulated time still follows the clock: ${e.time}`);
  assert.throws(() => createEngine({ fps: -1 }), RangeError);
  e.destroy();
});

test("fps cap: the page asks for ~fps frames a second, not one per vsync (60 and 120 Hz)", () => {
  for (const hz of [60, 120]) {
    const e = createEngine({ fps: 30 });
    let frames = 0;
    e.add({ render: () => frames++ });
    e.start();
    const { rafs } = display(2e6 + hz * 1e4, 1000, hz);
    assert.ok(frames >= 29 && frames <= 31, `${hz} Hz: ${frames} frames of work`);
    assert.ok(rafs <= 31, `${hz} Hz: ${rafs} requestAnimationFrame callbacks a second for a 30 fps engine (cap 30)`);
    e.destroy();
    assert.equal(queue.length, 0, "destroyed: no frame pending");
  }
});

test("fps cap: an uncapped engine joining gets every frame; the capped one keeps its own pace", () => {
  const capped = createEngine({ fps: 10 }), free = createEngine();
  let a = 0, b = 0;
  capped.add({ render: () => a++ });
  free.add({ render: () => b++ });
  capped.start();
  display(3e6, 50); // one frame, then off the clock for ~100 ms (a timer)
  assert.equal(queue.length, 0, "waiting on a timer, not on rAF");
  assert.equal(scheduler.engines, 0, "a capped engine leaves the shared clock between its frames");
  free.start();
  assert.equal(queue.length, 1, "the newcomer asks for a frame now");
  const { rafs } = display(3e6 + 100, 1000);
  assert.ok(b >= 59, `uncapped engine runs every vsync: ${b}`);
  assert.ok(a >= 9 && a <= 12, `capped engine still does ~10 frames of work: ${a}`);
  assert.ok(rafs >= 59);
  free.destroy();
  const left = display(3e6 + 1200, 300);
  assert.ok(left.rafs <= 4, `back to the cap alone: ${left.rafs} rAF in 300 ms`);
  capped.destroy();
  assert.equal(queue.length, 0);
  assert.equal(scheduler.engines, 0);
});
