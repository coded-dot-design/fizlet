// fizlet/match (Node, headless: root null): the phase machine, the clock, events, restart and zero
// allocation while playing. Overlays, keys, focus and Recall: tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver, constants } from "node:perf_hooks";

const { createEngine } = await import("../src/index.ts");
const { match } = await import("../src/match.ts");

/** Run `sec` seconds as 60 Hz frames. */
const run = (e, sec) => {
  for (let i = Math.round(sec * 60); i--; ) e.advance(1 / 60);
};
/** Every event type (and `a`) seen by a system added after the match. */
const listen = (e) => {
  const log = [];
  e.add({ render: (x) => { for (let i = 0; i < x.events.size; i++) log.push(`${x.events.at(i).type}:${x.events.at(i).a}`); } });
  return log;
};

test("match: intro → count → play → paused → end, then restart", () => {
  const e = createEngine();
  let begins = 0, result = null;
  const m = match(e, null, { count: 3, seconds: 60, begin: () => begins++, end: (r) => void (result = r) });
  assert.equal(m.phase, "intro");
  assert.equal(m.el, null, "headless");
  m.pause(true);
  m.finish(true);
  assert.equal(m.phase, "intro", "no pause or finish before the match starts");
  m.start();
  assert.equal(m.phase, "count");
  assert.equal(begins, 1);
  assert.equal(e.running, true, "start runs the engine");
  run(e, 2.9);
  assert.equal(m.phase, "count");
  run(e, 0.2);
  assert.equal(m.phase, "play", "three one-second beats, then play");
  m.pause();
  assert.equal(m.phase, "paused");
  assert.deepEqual(e.paused, ["stopped"], "pause stops the engine (zero CPU)");
  m.pause();
  assert.equal(m.phase, "play", "no argument toggles");
  assert.equal(e.running, true);
  m.pause(false);
  assert.equal(m.phase, "play", "resume while playing does nothing");
  m.finish(false, "hq");
  assert.equal(m.phase, "end");
  assert.deepEqual({ ...result, clock: Math.round(result.clock) }, { won: false, why: "hq", clock: 60 });
  m.finish(true);
  assert.equal(result.won, false, "finish once");
  m.pause(true);
  assert.equal(m.phase, "end", "no pause after the end");
  m.restart();
  assert.equal(m.phase, "count");
  assert.equal(begins, 2);
  assert.equal(m.clock, 60, "restart resets the clock");
  m.intro();
  assert.equal(m.phase, "intro");
  e.destroy();
});

test("match: the clock counts only in play; time up asks who won", () => {
  const e = createEngine();
  let result = null;
  const m = match(e, null, { count: 0, seconds: 2, timeUp: () => true, end: (r) => void (result = r) });
  run(e, 1);
  assert.equal(m.clock, 2, "no clock in the intro");
  m.start();
  assert.equal(m.phase, "play", "count: 0 skips the countdown");
  run(e, 1);
  assert.ok(Math.abs(m.clock - 1) < 1e-9);
  m.pause(true);
  run(e, 5); // advance by hand still runs systems: the clock must not move while paused
  assert.ok(Math.abs(m.clock - 1) < 1e-9);
  m.pause(false);
  run(e, 1.5);
  assert.equal(m.phase, "end");
  assert.equal(m.clock, 0);
  assert.deepEqual(result, { won: true, why: "time", clock: 0 });
  e.destroy();

  const free = createEngine(), u = match(free, null, { count: 0 });
  u.start();
  run(free, 3);
  assert.ok(Math.abs(u.clock - 3) < 1e-9, "no limit: the clock counts up");
  assert.equal(u.phase, "play");
  free.destroy();
});

test("match: every transition is an event on the ring", () => {
  const e = createEngine();
  const log = listen(e);
  const m = match(e, null, { count: 2, seconds: 1 });
  e.advance(0);
  assert.deepEqual(log, [], "the first intro is not an event");
  m.start(); // outside a frame: queued for the next read
  assert.deepEqual(log, []);
  e.advance(0);
  assert.deepEqual(log, ["match:count:2"]);
  run(e, 2.1);
  assert.deepEqual(log, ["match:count:2", "match:count:1", "match:play:0"]);
  m.pause();
  m.pause();
  e.advance(0);
  assert.deepEqual(log.slice(3), ["match:paused:0", "match:play:1"], "resume says a = 1");
  run(e, 1.1);
  assert.equal(log[5], "match:lost:0", "time up, lost by default; a = the clock");
  m.intro();
  e.advance(0);
  assert.equal(log[6], "match:intro:0");
  e.destroy();
});

test("match: zero allocation while playing (1M frames, against a bare engine)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  // The kernel's own frame loop is the baseline (it may box a few numbers on some Node versions);
  // the match brick must add nothing on top of it.
  const minors = async (withMatch) => {
    const e = createEngine({ events: 32 });
    const m = withMatch ? match(e, null, { count: 3, seconds: 1e9 }) : null;
    m?.start();
    const frames = (k) => {
      for (let i = 0; i < k; i++) e.advance(1 / 60);
    };
    frames(100000); // warm up: let the JIT settle on the play path
    if (m) assert.equal(m.phase, "play");
    gc();
    let minor = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
    });
    obs.observe({ entryTypes: ["gc"] });
    frames(1000000);
    await new Promise((r) => setTimeout(r, 50));
    obs.disconnect();
    if (m) assert.ok(m.clock < 1e9 - 16000, "it played");
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withMatch = await minors(true);
  // A real per-frame allocation (an object, a closure, a boxed number) shows as hundreds here.
  assert.ok(withMatch <= bare + 3, `young-generation GCs over 1M frames: ${withMatch} with match, ${bare} bare`);
});
