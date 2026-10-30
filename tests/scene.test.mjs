// fizlet/scene in Node, on a recording 2D context: values (tracks, eases, jumps, blinks, windows),
// cues once and in order, gags inside their window, the intro delay held by busy(sec), settle at
// the end, a tap replays, loop, the reduced-motion poster, Recall, and zero allocation per step.
// The scene files in the gallery are checked against the format. Pixels in Chromium, against the
// recipe code they replaced: tests/scene.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

// A page just big enough for the engine, a canvas and fizlet/sprite's tiles.
const calls = [];
const ctx2d = (log) => new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : typeof k === "string" && /^[a-z]/.test(k) && !["font", "fillStyle", "strokeStyle", "lineWidth", "lineCap", "textAlign", "imageSmoothingEnabled", "globalAlpha", "globalCompositeOperation"].includes(k) ? (o[k] = log ? (...a) => calls.push([k, ...a]) : () => {}) : undefined),
  set: (o, k, v) => ((o[k] = v), log && calls.push(["set", k, v]), true),
});
const canvas = () => ({ width: 300, height: 150, style: {}, getContext: () => ctx2d(true), remove() { this.gone = true; } });
globalThis.document = { visibilityState: "visible", addEventListener() {}, createElement: () => canvas() };
globalThis.addEventListener ??= () => {};
globalThis.requestAnimationFrame ??= () => 0; // started engines are advanced by hand here
globalThis.devicePixelRatio = 1;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { mountScene, scene } = await import("../src/scene.ts");

function stage() {
  const kids = [], on = new Map();
  return { kids, on, clientWidth: 320, clientHeight: 180, append: (c) => kids.push(c), addEventListener: (t, f, o) => (on.set(t, f), o?.signal?.addEventListener("abort", () => on.delete(t))) };
}
const DT = 1 / 60;
const run = (s, sec) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) s.engine.advance(DT); };
const frame = (s) => (calls.length = 0, s.engine.advance(DT), calls.slice());
const rects = (c) => c.filter(([k]) => k === "fillRect").slice(1); // after the background
const words = (c) => c.filter(([k]) => k === "fillText").map(([, w]) => w);
const base = (more) => ({ v: 1, stage: { w: 160, h: 90, bg: "#000", end: 2, ...more.stage }, ...more, stage: { w: 160, h: 90, bg: "#000", end: 2, ...more.stage } });

test("scene: values on the clock: a track eases, dur 0 jumps, a blink ticks in its window, `on` shows and hides", () => {
  const s = mountScene(stage(), base({ cast: [
    { rect: [[0, 100, 0.5, 1], [10, 20, 0.5, 1, "in"], 1, [1, 2, 0.5, 0]], fill: { blink: ["a", "b"], hz: 2, on: [0.5, 1.5], then: "c" } },
    { rect: [0, 0, 1, 1], fill: "z", on: [1, 1.5] },
  ] }), { motion: true });
  const at = (sec) => { run(s, sec - DT); return rects(frame(s)); };
  let r = at(0.25);
  assert.deepEqual(r.map((c) => c.slice(1)), [[0, 10, 1, 1]], "before its time: the track's `from`, the jump not yet");
  assert.equal(r.length, 1, "`on` [1, 1.5) not shown yet");
  r = at(0.75); // t = 1
  assert.ok(Math.abs(r[0][1] - 50) < 1e-9, `linear half-way: ${r[0][1]}`);
  assert.ok(Math.abs(r[0][2] - 11.25) < 1e-9, `"in" (cubic) half-way: ${r[0][2]}`);
  assert.equal(r[0][4], 2, "dur 0: jumped once past `at`");
  assert.equal(r.length, 2, "`on` shows from its start");
  r = at(1);
  assert.deepEqual(r[0].slice(1), [100, 20, 1, 2], "the track holds its end");
  assert.equal(r.length, 1, "`on` hides at its end");
  s.destroy();
});

test("scene: a blink: `a` before its window, `b` on odd ticks inside, `then` after", () => {
  const s = mountScene(stage(), base({ cast: [{ rect: [0, 0, 1, 1], fill: { blink: ["a", "b"], hz: 2, on: [0.5, 1.5], then: "c" } }] }), { motion: true });
  const fill = () => frame(s).filter(([k, p]) => k === "set" && p === "fillStyle").map(([, , v]) => v)[1];
  const seen = [];
  for (const sec of [0.25, 0.5, 0.25, 0.6, 0.25, 0.5]) (run(s, sec - DT), seen.push(fill()));
  // t = 0.25, 0.75 (tick 1), 1.0 (tick 2), 1.6 (past the window), 1.85, 2.35
  assert.deepEqual(seen, ["a", "b", "a", "c", "c", "c"]);
  s.destroy();
});

test("scene: cues fire once, in order, at their time; gags emit only inside their window", () => {
  const d = base({ stage: { end: 5 }, fx: { words: ["ONE", "TWO", "THREE"], kinds: { s: "spark" } },
    cue: [[0.5, "word", 0, 10, 10, 0, 8], [0.5, "word", 1, 10, 10, 0, 8], [1, "word", 2, 10, 10, 0, 8], [1, "kick", 2]],
    gag: [{ emit: "s", on: [3.1, 4], x: 80, y: 45, n: 1 }] });
  const s = mountScene(stage(), d, { motion: true });
  run(s, 0.4);
  assert.deepEqual(words(frame(s)), [], "nothing before the first cue");
  run(s, 0.2);
  assert.deepEqual(words(frame(s)), ["ONE", "TWO"], "two cues on one time, in order");
  run(s, 0.5);
  assert.deepEqual(words(frame(s)).sort(), ["ONE", "THREE", "TWO"], "the next one joins; none fires twice");
  run(s, 1.5); // t 2.6: the words have faded, the gag's window is over
  const still = frame(s).length;
  run(s, 0.3);
  const before = frame(s).length;
  assert.equal(before, still, "nothing new drawn: the gag waits for its window");
  run(s, 0.25);
  assert.ok(frame(s).length > still, "inside its window, it emits sparks every step");
  s.destroy();
});

test("scene: rests at `end` and settles; a tap plays it again; `loop` replays on its own", () => {
  const st = stage(), s = mountScene(st, base({ fx: { words: ["HI"] }, cue: [[0.1, "word", 0, 1, 1, 0, 8]] }), { motion: true });
  run(s, 2.2);
  assert.ok(!s.engine.stats().paused.includes("settled"), "awake until the end (busy(sec)), then the settle time");
  run(s, 1.5);
  assert.ok(s.engine.stats().paused.includes("settled"), "settled on the last frame");
  st.on.get("pointerdown")();
  assert.ok(!s.engine.stats().paused.includes("settled"), "a tap wakes it");
  run(s, 0.2);
  assert.deepEqual(words(frame(s)), ["HI"], "and plays it from the start: the cue again");
  s.destroy();

  const l = mountScene(stage(), base({ stage: { end: 1, loop: 0.5 }, fx: { words: ["HI"] }, cue: [[0.1, "word", 0, 1, 1, 0, 8]] }), { motion: true });
  run(l, 1.65);
  assert.deepEqual(words(frame(l)), ["HI"], "loop: a second play starts `loop` seconds after the end");
  run(l, 3);
  assert.ok(!l.engine.stats().paused.includes("settled"), "a looping scene never settles while it is shown");
  l.destroy();
});

test("scene: an intro delay holds the clock (and the engine, busy(sec)), then plays", () => {
  const s = mountScene(stage(), base({ stage: { end: 1, delay: 2 }, fx: { words: ["GO"] }, cue: [[0, "word", 0, 1, 1, 0, 8]] }), { motion: true });
  run(s, 1.9);
  assert.deepEqual(words(frame(s)), [], "nothing during the delay");
  assert.ok(!s.engine.stats().paused.includes("settled"), "the delay keeps it awake: a settle is 0.5 s");
  run(s, 0.2);
  assert.deepEqual(words(frame(s)), ["GO"], "the clock starts after the delay");
  s.destroy();
});

test("scene: reduced motion draws the poster (no cues, no gags) and settles", () => {
  const st = stage(), d = base({ stage: { end: 2, poster: 1 }, fx: { words: ["NO"], kinds: { s: "spark" } }, cue: [[0, "word", 0, 1, 1, 0, 8]], gag: [{ emit: "s", on: [0, 2], x: 1, y: 1, n: 3 }], cast: [{ rect: [[0, 10, 0, 2], 0, 1, 1], fill: "#fff" }] });
  const s = mountScene(st, d, { motion: false });
  const c = frame(s);
  assert.deepEqual(rects(c).map((r) => r[1]), [5], "the poster time (1 s of a 0→10 track over 2 s)");
  assert.deepEqual(words(c), [], "no cue fired");
  const second = frame(s).length; // the first frame also sized the canvas
  run(s, 0.5);
  assert.equal(frame(s).length, second, "no gag ran: the same frame");
  assert.equal(st.on.has("pointerdown"), false, "no replay on tap");
  run(s, 1);
  assert.ok(s.engine.stats().paused.includes("settled"), "settled");
  s.destroy();
});

test("scene: destroy() is Recall: the canvas comes off, the listeners go; scene(d) is a slot mount", () => {
  const st = stage(), s = scene(base({}), { motion: true })(st, st, null);
  run(s, 0.1);
  assert.equal(st.kids.length, 1);
  s.destroy();
  assert.equal(st.kids[0].gone, true, "the canvas is removed");
  assert.equal(st.on.size, 0, "the tap listener is gone");
  assert.doesNotThrow(() => run(s, 0.1), "inert afterwards");
});

test("scene: zero allocation per step with tracks, blinks, cues and a gag running; a tracked gag costs emit's two numbers", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const d = (x) => base({ stage: { end: 1e9, stars: [24, "#111", 0.8], shake: 0.25 }, fx: { cap: 64, kinds: { s: "spark" } },
    art: { a: ["mm", "mm"] }, ink: { m: "m" }, palettes: [{ m: "#f00" }, { m: "#0f0" }],
    cast: [{ sprite: "a", x: [0, 160, 0, 1e9, "inOut"], y: 45, rot: [0, 1, 0, 1e9], scale: 2, pal: { blink: [0, 1], hz: 10 } }, { line: [0, 0, [0, 160, 0, 1e9], 90], stroke: "#fff", lw: { blink: [3, 4], hz: 30 } }],
    over: [{ text: "HI", x: 80, y: 10, font: "8px monospace", fill: "#fff", stroke: "#000", lw: 3 }],
    cue: [[0.1, "kick", 3], [0.2, "emit", "s", 4, 4, 9, 0, 1, 1]],
    gag: [{ emit: "s", on: [0, 1e9], x, y: 45, n: 1, scale: 0.4 }] });
  // Steps only, as the engine runs them (render paints a canvas once a frame, outside the step).
  const gcs = async (x) => {
    const s = mountScene(stage(), d(x), { motion: true });
    const steps = (n) => { for (let i = 0; i < n; i++) s.step(s.engine, DT); };
    steps(20000);
    gc();
    const minor = await minorGCs(() => steps(200000));
    s.destroy();
    return minor;
  };
  const still = await gcs(80);
  assert.ok(still <= 1, `young-generation GCs over 200k steps: ${still}`);
  // A gag on a track hands fx.emit a fresh x and y each step (fizlet/fx's emit takes numbers; the
  // recipe code it replaces made the same call). Bounded: only while its window is open.
  const moving = await gcs([0, 160, 0, 1e9, "in"]);
  assert.ok(moving <= 4, `a tracked gag over 200k steps: ${moving} young-generation GCs (≈ 32 B a step)`);
});

// The format, as the gallery's scene files use it (the factory validates as it writes; this keeps
// hand edits honest).
const isVal = (v) => typeof v === "number" || typeof v === "string" || (Array.isArray(v) && v.length >= 4 && v.length <= 5 && typeof v[2] === "number" && typeof v[3] === "number" && (v[4] === undefined || ["linear", "in", "out", "inOut", "back"].includes(v[4]))) || (v && Array.isArray(v.blink) && v.blink.length === 2 && v.hz > 0);
export function checkScene(d) {
  const bad = [];
  const need = (ok, what) => ok || bad.push(what);
  need(d.v === 1, "v is 1");
  for (const k of ["w", "h", "end"]) need(d.stage?.[k] > 0, `stage.${k} > 0`);
  need(typeof d.stage?.bg === "string", "stage.bg");
  const items = [...(d.cast ?? []), ...(d.over ?? [])];
  items.forEach((it, i) => {
    const kind = ["sprite", "rect", "text", "line"].filter((k) => k in it);
    need(kind.length === 1, `item ${i}: one of sprite, rect, text, line`);
    if (it.sprite) need(d.art?.[it.sprite], `item ${i}: art ${it.sprite}`);
    for (const k of ["x", "y", "rot", "scale", "pal", "fill", "stroke", "lw"]) if (k in it) need(isVal(it[k]), `item ${i}: ${k} is a value`);
    for (const k of ["rect", "line"]) if (it[k]) need(it[k].length === 4 && it[k].every(isVal), `item ${i}: ${k} is 4 values`);
  });
  let last = -Infinity;
  for (const c of d.cue ?? []) {
    need(c[0] >= last, `cue at ${c[0]} is in time order`);
    last = c[0];
    need({ word: 7, kick: 3, emit: 9 }[c[1]] === c.length, `cue ${c[1]} at ${c[0]}: its arguments`);
    if (c[1] === "emit") need(d.fx?.kinds?.[c[2]], `cue emit: kind ${c[2]}`);
    if (c[1] === "word") need(d.fx?.words?.[c[2]] !== undefined, `cue word: word ${c[2]}`);
  }
  for (const g of d.gag ?? []) need(d.fx?.kinds?.[g.emit] && isVal(g.x) && isVal(g.y) && g.n > 0 && g.on?.length === 2, `gag ${g.emit}`);
  return bad;
}

test("scene: every scene file in the gallery is in the format", () => {
  for (const dir of ["site/gallery/anims"]) for (const f of readdirSync(dir).filter((n) => n.endsWith(".scene.json"))) {
    assert.deepEqual(checkScene(JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))), [], f);
  }
  assert.ok(checkScene({ v: 1, stage: { w: 1, h: 1, end: 1, bg: "#000" }, cue: [[1, "kick", 1], [0, "word", 9, 0, 0, 0, 8]] }).length >= 2, "the check catches out-of-order and unknown words");
});

test("scene: its own code stays at its planned ≤ 2 KB gzip (the bricks it composes are shared on a page)", async () => {
  const { build } = await import("esbuild");
  const { gzipSync } = await import("node:zlib");
  const r = await build({ entryPoints: ["src/scene.ts"], bundle: true, minify: true, format: "esm", target: "es2022", write: false, logLevel: "silent", external: ["./kernel/index", "./fx", "./sprite", "./timeline"] });
  const own = gzipSync(r.outputFiles[0].contents).length;
  assert.ok(own <= 2048, `fizlet/scene's own code: ${own} B gz`);
});
