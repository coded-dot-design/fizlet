// fzlt/sound (Node): which events and cues make a sound. The browser suite plays the real synth.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.requestAnimationFrame ??= () => 0; // started engines are advanced by hand here
globalThis.cancelAnimationFrame ??= () => {};
const { createEngine } = await import("../src/index.ts");
const { sound } = await import("../src/sound.ts");

// Event types (a timeline label can be anything) and JS-called cues named like Object.prototype keys.
const PROTO = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"];

function engineWith(types) {
  const e = createEngine();
  e.add({ step: (e) => types.forEach((t) => e.events.emit(t)) });
  e.start(); // sound plays only while the engine runs
  return e;
}

test("sound: only own cue keys play; Object.prototype names are ignored, not thrown on", () => {
  const e = engineWith(["shot", ...PROTO, "wreck"]), heard = [];
  const s = sound(e, { cues: { shot: "fire", wreck: "boom" }, play: (cue) => heard.push(cue) });
  assert.equal(e.running, true);
  e.advance(1 / 60);
  assert.deepEqual(heard, ["fire", "boom"]);
  for (const k of PROTO) s.play(k);
  assert.deepEqual(heard, ["fire", "boom"], "a JS caller's unknown cue plays nothing");
  e.destroy();
});

test("sound: the synth skips a prototype-named event or cue instead of crashing render", () => {
  const listeners = [], oscs = [];
  const node = () => ({ connect: (n) => n ?? node(), disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  const keep = { addEventListener: globalThis.addEventListener, AudioContext: globalThis.AudioContext };
  globalThis.addEventListener = (type, fn) => listeners.push(fn);
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 1;
    destination = node();
    resume = async () => {};
    close = async () => {};
    createGain = node;
    createOscillator() {
      const o = { ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} };
      oscs.push(o);
      return o;
    }
  };
  try {
    // An own "constructor" key is a real mapping and plays; "toString" is not mapped and is skipped.
    const e = engineWith(["toString", "constructor", "valueOf"]);
    const s = sound(e, { cues: { constructor: "boom" } });
    listeners[0]({ isTrusted: true }); // a trusted gesture unlocks the synth
    e.advance(1 / 60);
    assert.equal(oscs.length, 2, "boom's two notes, nothing else");
    for (const k of PROTO) s.play(k);
    assert.equal(oscs.length, 2);
    assert.equal(e.running, true);
    e.destroy();
  } finally {
    Object.assign(globalThis, keep);
  }
});

test("sound: off, paused or disposed plays nothing; intensity reaches the player; destroy disposes", () => {
  const e = engineWith([]), heard = [];
  const s = sound(e, { cues: { shot: "fire" }, on: false, play: (cue, v) => heard.push([cue, v]) });
  const shoot = (v) => e.add({ step: (e) => e.events.emit("shot", 0, 0, 0, 0, v) });
  const sys = shoot(0.5);
  e.advance(1 / 60);
  assert.deepEqual(heard, [], "switched off at start: silent");
  s.on = true;
  e.advance(1 / 60);
  assert.deepEqual(heard, [["fire", 0.5]], "an event's v is the cue's intensity");
  e.remove(sys);
  shoot(0); // v 0 plays at full intensity 1
  heard.length = 0;
  e.advance(1 / 60);
  assert.deepEqual(heard, [["fire", 1]]);
  e.stop();
  heard.length = 0;
  s.play("fire");
  assert.deepEqual(heard, [], "a paused engine is silent, even to a direct play()");
  e.start();
  s.dispose();
  e.advance(1 / 60);
  s.play("fire");
  assert.deepEqual(heard, [], "disposed: its system is gone and play() is inert");
  assert.equal(e.running, true, "dispose leaves the engine running");
  e.destroy();
  const e2 = engineWith(["shot"]), heard2 = [];
  const s2 = sound(e2, { cues: { shot: "fire" }, play: (c) => heard2.push(c) });
  e2.destroy();
  s2.play("fire");
  assert.deepEqual(heard2, [], "the engine's destroy() disposes the sound");
});

// A fake Web Audio: counts what the synth builds and what it hands back.
function fakeAudio() {
  const listeners = [], log = { ctx: 0, oscs: 0, started: 0, ended: [], closed: 0, suspended: 0, resumed: 0, removed: 0 };
  const node = () => ({ connect: (n) => n ?? node(), disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  const keep = { addEventListener: globalThis.addEventListener, AudioContext: globalThis.AudioContext };
  globalThis.addEventListener = (type, fn, opts) => {
    const l = { type, fn, live: true };
    listeners.push(l);
    opts?.signal?.addEventListener("abort", () => ((l.live = false), log.removed++));
  };
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 1;
    destination = node();
    constructor() {
      log.ctx++;
      log.last = this;
    }
    resume = async () => void log.resumed++;
    suspend = async () => void log.suspended++;
    close = async () => void log.closed++;
    createGain = node;
    createOscillator() {
      const o = { ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start: () => log.started++, stop() {} };
      log.oscs++;
      log.ended.push(o);
      return o;
    }
  };
  const gesture = (trusted = true) => listeners.filter((l) => l.live).forEach((l) => l.fn({ isTrusted: trusted }));
  return { log, listeners, gesture, restore: () => Object.assign(globalThis, keep) };
}

test("sound: the synth waits for a trusted gesture, rate-limits a cue, caps voices at 8, and Recall closes it", () => {
  const a = fakeAudio();
  try {
    const e = engineWith([]);
    const s = sound(e, { cues: {} });
    assert.deepEqual(a.listeners.map((l) => l.type), ["pointerdown", "pointerup", "keydown"]);
    s.play("boom");
    a.gesture(false);
    assert.equal(a.log.ctx, 0, "no context before a trusted gesture (a script's synthetic event never unlocks)");
    a.gesture(true);
    assert.equal(a.log.ctx, 1, "one context, created on the first trusted gesture");
    s.play("boom");
    assert.equal(a.log.oscs, 2, "boom is two notes");
    s.play("boom");
    assert.equal(a.log.oscs, 2, "the same cue again within 0.12 s is skipped");
    a.log.last.currentTime += 0.2;
    s.play("boom");
    s.play("win");
    s.play("power");
    assert.equal(a.log.oscs, 4 + 3 + 1, "a ninth voice never starts: power's second note is dropped at 8");
    a.log.ended.forEach((o) => o.onended?.());
    a.log.last.currentTime += 0.2;
    s.play("fire");
    assert.equal(a.log.oscs, 9, "ended voices free their slots");
    s.on = false;
    assert.equal(a.log.suspended, 1, "switched off: the context sleeps");
    s.play("hit");
    assert.equal(a.log.oscs, 9);
    s.on = true;
    assert.ok(a.log.resumed >= 1, "switched on: it wakes");
    e.destroy();
    assert.equal(a.log.closed, 1, "destroy closes the AudioContext");
    assert.equal(a.listeners.filter((l) => l.live).length, 0, "and removes every gesture listener");
    a.gesture(true);
    assert.equal(a.log.ctx, 1, "a gesture after destroy creates nothing");
  } finally {
    a.restore();
  }
});

test("sound: a custom player gets no gesture listeners and no AudioContext", () => {
  const a = fakeAudio();
  try {
    const e = engineWith(["shot"]), heard = [];
    sound(e, { cues: { shot: "fire" }, play: (c) => heard.push(c) });
    assert.equal(a.listeners.length, 0);
    e.advance(1 / 60);
    assert.deepEqual(heard, ["fire"]);
    assert.equal(a.log.ctx, 0);
    e.destroy();
  } finally {
    a.restore();
  }
});

test("sound: zero allocation per frame reading the ring (mapped, unmapped and prototype-named events)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const { minorGCs } = await import("./gc.mjs");
  const e = createEngine({ events: 16 });
  e.start();
  let sink = null, plays = 0;
  // Its render system alone, as the kernel test runs the kernel alone.
  const add = e.add;
  let system = null;
  e.add = (s) => ((system = s), add(s));
  const keep = (cue, v) => void (plays += v > 0 ? 1 : 0);
  const leak = (cue, v) => void (sink = { cue, v }); // the self-check: a player that allocates
  let player = keep, v = 0;
  sound(e, { cues: { shot: "fire", wreck: "boom" }, play: (cue, v) => player(cue, v) });
  e.add = add;
  const ring = e.events;
  const run = (n) => {
    for (let i = 0; i < n; i++) {
      ring.clear();
      ring.emit("shot", 0, 0, 0, 0, v);
      ring.emit("wreck", 0, 0, 0, 0, 2);
      ring.emit("miss");
      ring.emit("constructor"); // not a cue: must not stringify Object.prototype.constructor
      system.render(e, 0);
    }
  };
  run(20000);
  const still = await minorGCs(() => run(1000000));
  // A fractional intensity reaches the player as a JS number argument: one boxed double per played
  // cue (16 B), the price of the callback, bounded by the cues played and nothing else.
  v = 0.5;
  run(20000);
  const fraction = await minorGCs(() => run(1000000));
  v = 0;
  player = leak;
  run(20000);
  const control = await minorGCs(() => run(1000000));
  console.log(`# sound young GCs over 1M frames (2M cues): ${still}; a 0.5 intensity ${fraction}; self-check, an allocating player: ${control}`);
  assert.ok(plays > 0 && sink !== null);
  assert.ok(control >= 5, `the method sees a 1-object-per-play allocation: ${control} young GCs`);
  assert.ok(still <= 1, `reading the ring and calling the player: ${still} young GCs`);
  assert.ok(fraction < control, `a fractional intensity costs less than one object per cue: ${fraction} vs ${control}`);
  e.destroy();
});

test("sound: your own notes add cues (and win over a built-in name); unknown names still play nothing", () => {
  const e = engineWith(["sip", "shot", "nope"]), heard = [];
  sound(e, { cues: { sip: "slurp", shot: "fire", nope: "nothing" }, notes: { slurp: [[300, 900, 0.12, 0, "sawtooth", 0.1]] }, play: (cue) => heard.push(cue) });
  e.advance(1 / 60);
  assert.deepEqual(heard, ["slurp", "fire"]);
  e.destroy();
});
