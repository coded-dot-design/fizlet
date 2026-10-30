// fizlet/match (Node, headless: root null): the phase machine, the clock, events, restart and zero
// allocation while playing. Overlays, keys, focus and Recall: tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

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
    // Best of three windows (tests/gc.mjs), each after a full gc(): a stray scavenge from the test
    // runner or the JIT lands in one window, a real per-frame allocation in every one.
    const minor = await minorGCs(() => frames(1000000));
    if (m) assert.ok(m.clock < 1e9 - 16000, "it played");
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withMatch = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with ${withMatch}`);
  // A real per-frame allocation (an object, a closure, a boxed number) shows as hundreds here.
  assert.ok(withMatch <= bare + 1, `young-generation GCs over 1M frames: ${withMatch} with match, ${bare} bare`);
});

test("match: a settling engine stays awake through the countdown and play, and may settle after", () => {
  const e = createEngine({ settle: 0.5 });
  const m = match(e, null, { count: 3 });
  m.start();
  run(e, 2);
  assert.equal(m.phase, "count");
  assert.deepEqual(e.paused, [], "the countdown keeps it awake (it froze at 0.5 s before)");
  run(e, 2);
  assert.equal(m.phase, "play");
  assert.deepEqual(e.paused, [], "the clock keeps it awake");
  m.finish(true);
  run(e, 1);
  assert.deepEqual(e.paused, ["settled"], "the result is still: it may settle");
  e.destroy();
});

test("match: `on` follows every phase change once (not the first intro); a destroyed engine's match is inert", () => {
  const e = createEngine();
  const seen = [];
  const m = match(e, null, { count: 1, on: (p) => seen.push(p) });
  assert.deepEqual(seen, [], "the first intro is not a change");
  m.start();
  run(e, 1.1);
  m.pause();
  m.pause();
  m.finish(false);
  m.intro();
  assert.deepEqual(seen, ["count", "play", "paused", "play", "end", "intro"]);
  m.start();
  e.destroy();
  m.pause(true);
  m.finish(true);
  m.restart();
  assert.equal(m.phase, "count", "no transition after destroy");
  assert.deepEqual(seen.slice(6), ["count"]);
});

test("match: the arcade flow (match on its own engine, the game's engine following it) allocates nothing per frame", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  // As fizlet/arcade's skirmish preset wires it: the flow engine runs match; each phase change starts
  // or stops the game's engine. Best of three windows (tests/gc.mjs), run with --test-concurrency=1.
  const minors = async (withFlow) => {
    const g = createEngine({ events: 32 }), f = withFlow ? createEngine({ events: 32 }) : null;
    let steps = 0;
    g.add({ step: () => void steps++ });
    const m = f ? match(f, null, { count: 3, on: (p) => (p === "play" ? g.start() : p === "paused" ? g.stop() : 0) }) : null;
    m ? m.start() : g.start();
    const frames = (k) => {
      for (let i = 1; i <= k; i++) {
        f?.advance(1 / 60);
        g.advance(1 / 60);
        // A pause and a resume every 50k frames: the transitions are on the path too.
        if (m && i % 50000 === 0) m.pause();
      }
    };
    frames(100000);
    if (m) assert.equal(m.phase, "play");
    const minor = await minorGCs(() => frames(1000000));
    assert.ok(steps > 1000000, "the game stepped");
    f?.destroy();
    g.destroy();
    return minor;
  };
  const bare = await minors(false), withFlow = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): game engine alone ${bare}, with the match flow ${withFlow}`);
  assert.ok(withFlow <= bare + 1, `young-generation GCs over 1M frames: ${withFlow} with the flow, ${bare} without`);
});
