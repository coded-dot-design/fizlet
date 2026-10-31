// fzlt/rules (Node, headless): waves keep the DOM VIRUS core's timing, drops fall / collect /
// expire, score combos and levels, every rule reports on the event ring, and none allocates per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { waves, drops, score } = await import("../src/rules.ts");

const run = (e, sec, each) => {
  for (let i = Math.round(sec * 60); i--; ) { each?.(); e.advance(1 / 60); }
};
const listen = (e) => {
  const log = [];
  e.add({ render: (x) => { for (let i = 0; i < x.events.size; i++) { const v = x.events.at(i); log.push(`${v.type}:${v.a}`); } } });
  return log;
};

/** Run fn inside one step, the way a game calls the rules (events land on that frame's ring). */
const during = (e, fn) => {
  let r, todo = fn;
  e.add({ step() { if (todo) { r = todo(); todo = null; } } });
  e.advance(1 / 60);
  return r;
};

// The DOM VIRUS core's WaveDirector (dom-virus src/waves.ts, MIT), the behaviour waves() replaces.
class WaveDirector {
  wave = 1; phase = "prepare"; remaining = 0; countdown = 4; spawnIn = 0; capacity = 32;
  get limit() { return Math.min(this.capacity, 8 + this.wave * 4); }
  get ready() { return this.phase === "assault" && this.remaining > 0 && this.spawnIn <= 0; }
  update(dt, alive) {
    this.spawnIn -= dt;
    if (this.phase !== "assault") {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) {
        if (this.phase === "rebuild") this.wave++;
        this.phase = "assault"; this.remaining = Math.min(40, 5 + this.wave * 5); this.spawnIn = 0;
      }
    } else if (this.remaining === 0 && alive === 0) { this.phase = "rebuild"; this.countdown = 8; }
  }
  spawned() { this.remaining = Math.max(0, this.remaining - 1); }
  rest() { this.spawnIn = Math.max(0.7, 2.1 - this.wave * 0.12); }
}

test("waves: the same waves, phases and spawns as the core's WaveDirector", () => {
  const e = createEngine(), dt = 1 / 60;
  // enemies live 1.5 s; both sides spawn under the same rule
  const mine = [], ref = [], d = new WaveDirector();
  const w = waves(e, { alive: () => mine.length });
  const log = listen(e);
  for (let f = 0; f < 60 * 120; f++) {
    for (const list of [mine, ref]) for (let i = list.length - 1; i >= 0; i--) if ((list[i] -= dt) <= 0) list.splice(i, 1);
    if (w.ready()) { mine.push(1.5); w.spawned(); }
    if (d.ready && ref.length < d.limit) { ref.push(1.5); d.spawned(); d.rest(); }
    e.advance(dt);
    d.update(dt, ref.length);
    assert.deepEqual([w.wave, w.phase, w.left, mine.length], [d.wave, d.phase, d.remaining, ref.length], `frame ${f}`);
  }
  assert.ok(w.wave >= 4, `it got through waves (wave ${w.wave})`);
  assert.equal(log.filter((x) => x.startsWith("wave:start")).length, w.wave);
  assert.ok(log.includes("wave:clear:1"));
  w.reset();
  assert.deepEqual([w.wave, w.phase, w.left], [1, "prepare", 0]);
});

test("waves: limit, cap and custom sizes", () => {
  const e = createEngine();
  let alive = 0;
  const w = waves(e, { alive: () => alive, cap: 3, prepare: 0.1, size: () => 10, gap: () => 0 });
  run(e, 0.2);
  assert.equal(w.phase, "assault");
  assert.equal(w.limit, 3);
  let spawned = 0;
  while (w.ready()) { alive++; spawned++; w.spawned(); }
  assert.equal(spawned, 3, "never more alive than the cap");
  assert.equal(w.left, 7);
});

test("drops: timed drops fall, land, are collected or expire, with events", () => {
  const e = createEngine();
  const d = drops(e, { kinds: ["repair", "charge"], every: 1, place: (out) => void out.set([100, 200]) });
  const log = listen(e);
  run(e, 1.05);
  assert.equal(d.count, 1);
  assert.equal(d.y[0] < 200, true, "it starts above its spot");
  assert.equal(d.collect(100, 200, 24), null, "not landed yet");
  run(e, 0.7);
  assert.ok(d.landed(0));
  assert.equal(d.count, 1, "the second drop is still in the air... or not yet due");
  assert.equal(during(e, () => d.collect(110, 205, 24)), "repair");
  run(e, 0.4);
  assert.equal(d.count, 1);
  assert.equal(d.kind[0], 1, "kinds in turn");
  assert.equal(d.collect(400, 400, 24), null, "too far");
  run(e, 15);
  assert.ok(log.includes("drop:spawn:0") && log.includes("drop:collect:0") && log.includes("drop:expire:1"));
  d.reset();
  assert.equal(d.count, 0);
});

test("drops: cap, manual spawns, scroll and a skipped placement", () => {
  const e = createEngine();
  const d = drops(e, { kinds: ["a"], cap: 2, every: 0.5, place: () => false });
  run(e, 2);
  assert.equal(d.count, 0, "place() returned false: no timed drop");
  assert.ok(d.spawn(10, 10) && d.spawn(20, 10));
  assert.equal(d.spawn(30, 10), false, "full");
  assert.equal(d.spawn(30, 10, 5), false, "unknown kind");
  d.scroll(5, 5);
  assert.deepEqual([d.x[0], d.x[1]], [5, 15]);
  run(e, 1);
  assert.equal(d.collect(5, 5, 4), "a", "landed where the page moved it");
});

test("drops: per-drop age and landing spot, a drop:land event, kept in step on remove and scroll", () => {
  const e = createEngine();
  const d = drops(e, { kinds: ["a", "b"], cap: 3, fall: 90, speed: 90, life: 5 });
  const log = listen(e);
  during(e, () => d.spawn(10, 100, 0));
  run(e, 0.5);
  during(e, () => d.spawn(40, 300, 1));
  assert.equal(d.life, 5);
  assert.deepEqual([d.landY[0], d.landY[1]], [100, 300], "landing spots");
  assert.ok(Math.abs(d.age[0] - 0.5) < 0.02 && d.age[1] === 0, `ages ${d.age[0]}, ${d.age[1]}`);
  run(e, 0.6);
  assert.ok(d.landed(0) && !d.landed(1));
  assert.equal(log.filter((l) => l.startsWith("drop:land")).length, 1, "landing is an event, once");
  // The first is collected: the second moves into slot 0 with its own age and spot.
  run(e, 0.5);
  assert.equal(during(e, () => d.collect(10, 100, 4)), "a");
  assert.equal(d.landY[0], 300);
  assert.ok(Math.abs(d.age[0] - 1.1) < 0.02, `${d.age[0]}`);
  d.scroll(0, 50);
  assert.equal(d.landY[0], 250, "the landing spot scrolls with the page");
  assert.deepEqual(log.filter((l) => l.startsWith("drop:land")), ["drop:land:0", "drop:land:1"]);
});

test("score: combo multiplier, decay, levels and events", () => {
  const e = createEngine();
  const s = score(e, { levels: [8, 24, 50] });
  const log = listen(e);
  const got = [];
  during(e, () => { for (let i = 0; i < 7; i++) got.push(s.add(25, 4)); });
  assert.deepEqual(got, [25, 25, 25, 50, 50, 50, 75], "1 + floor(streak / 3), the Null Invaders combo");
  assert.equal(s.points, 300);
  assert.equal(s.level, 2, "28 XP passed 8 and 24");
  assert.equal(s.next, 22);
  run(e, 3.1);
  assert.equal(s.combo, 1, "the streak ran out");
  for (let i = 0; i < 20; i++) s.add(1);
  assert.equal(s.combo, 5, "capped at 5");
  during(e, () => s.miss());
  assert.equal(s.streak, 0);
  run(e, 0.1);
  assert.ok(log.includes("level:1") && log.includes("level:2") && log.includes("combo:end:7") && log.includes("score:75"));
  s.add(0, 100);
  assert.equal(s.level, 3);
  assert.equal(s.next, -1);
  s.reset();
  assert.deepEqual([s.points, s.xp, s.level], [0, 0, 0]);
  const flat = score(createEngine(), { combo: false });
  assert.deepEqual([flat.add(5), flat.add(5), flat.add(5), flat.add(5)], [5, 5, 5, 5]);
});

test("rules: zero allocation while playing (1M frames, against a bare engine)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const minors = async (withRules) => {
    const e = createEngine({ events: 32 });
    let alive = 0, f = 0;
    if (withRules) {
      const w = waves(e, { alive: () => alive });
      const d = drops(e, { kinds: ["a", "b"], every: 2, place: (out) => { out[0] = 50; out[1] = 50; } });
      const s = score(e, { levels: [10, 100] });
      // A game system using all three each step, the way a port would.
      e.add({ step() {
        if (w.ready()) { alive++; w.spawned(); }
        if (++f % 30 === 0 && alive > 0) { alive--; s.add(10, 1); }
        d.collect(50, 50, 24);
      } });
    }
    const frames = (k) => { for (let i = 0; i < k; i++) e.advance(1 / 60); };
    frames(100000);
    // Best of three windows (tests/gc.mjs), each after a full gc(): a stray scavenge from the test
    // runner or the JIT lands in one window, a real per-frame allocation in every one.
    const minor = await minorGCs(() => frames(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withRules = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with ${withRules}`);
  assert.ok(withRules <= bare + 1, `young-generation GCs over 1M frames: ${withRules} with rules, ${bare} bare`);
});
