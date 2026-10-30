// fizlet/timeline in Node: interpolation, easings, keyframes, sequencing (end, "<", labels, delay,
// stagger), seek, reverse, finish, repeat and yoyo, events and done(), reduced motion (motion:
// false), settle, revert and Recall, plain numbers, and zero allocation while it plays. The DOM half
// (real elements, computed values mid-way, prefers-reduced-motion, Recall byte for byte) is
// tests/timeline.mjs in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/kernel/index.ts");
const { timeline, EASES } = await import("../src/timeline.ts");

// Just enough of an element for the ledger: inline style properties and attributes.
function el(init = {}) {
  const props = new Map(Object.entries(init)), attrs = new Map();
  const style = {
    getPropertyValue: (p) => props.get(p) ?? "",
    getPropertyPriority: () => "",
    setProperty: (p, v) => (v ? props.set(p, v) : props.delete(p)),
    removeProperty: (p) => props.delete(p),
  };
  return { style, props, hasAttribute: (n) => attrs.has(n), getAttribute: (n) => attrs.get(n) ?? null, setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n) };
}
const DT = 1 / 60;
// Run `sec` seconds of frames; returns every event seen, as "type:a:b".
const run = (e, sec) => {
  const seen = [];
  for (let i = 0, n = Math.round(sec * 60); i < n; i++) {
    e.advance(DT);
    for (let k = 0; k < e.events.size; k++) {
      const ev = e.events.at(k);
      seen.push(`${ev.type}:${ev.a}:${ev.b}`);
    }
  }
  return seen;
};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// Eased progress at x, through a timeline (values are rounded to a thousandth).
const eased = (ease, x) => {
  const e = createEngine(), out = new Float64Array(1), tl = timeline(e).to(out, { 0: [0, 1] }, { dur: 1, ease });
  tl.seek(x).step(e, DT);
  return out[0];
};
test("timeline: easings", () => {
  const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-3, `${msg}: ${a} vs ${b}`);
  close(eased("linear", 0.3), 0.3, "linear");
  close(eased("in", 0.5), 0.125, "in");
  close(eased("out", 0.5), 0.875, "out");
  close(eased(undefined, 0.5), 0.875, "out is the default");
  close(eased("inOut", 0.25), 0.0625, "inOut, first half");
  close(eased("inOut", 0.75), 0.9375, "inOut, second half");
  for (const k of [...Object.keys(EASES), "steps(3)"]) close(eased(k, 0), 0, `${k}(0)`), close(eased(k, 1), 1, `${k}(1)`);
  assert.ok(eased("back", 0.7) > 1, "back overshoots");
  close(eased("steps(4)", 0.3), 0.25, "steps(4)");
  close(eased((p) => p * p, 0.5), 0.25, "a function");
});

test("timeline: interpolates CSS values and numbers, writes in render through the ledger", () => {
  const e = createEngine(), a = el(), nums = new Float64Array(2), obj = { x: 0 };
  const tl = timeline(e)
    .to(a, { opacity: [0, 1], transform: ["translate(0px,-8px) scale(1)", "translate(100px,40px) scale(2)"], "clip-path": ["inset(0 50% 0 0)", "inset(0 0% 0 0)"] }, { dur: 1, ease: "linear" })
    .to(nums, { 1: [10, 20] }, { at: 0, dur: 1, ease: "linear" })
    .to(obj, { x: [0, 1] }, { at: 0, dur: 1, ease: "in" });
  e.start();
  assert.equal(a.props.size, 0, "nothing is written before play()");
  tl.play();
  run(e, 0.5);
  assert.equal(a.props.get("opacity"), "0.5");
  assert.equal(a.props.get("transform"), "translate(50px,16px) scale(1.5)");
  assert.equal(a.props.get("clip-path"), "inset(0 25% 0 0)");
  assert.equal(nums[1], 15, "a typed array slot");
  near(obj.x, 0.125, "an object property, eased");
  run(e, 1);
  assert.equal(a.props.get("opacity"), "1");
  assert.equal(a.props.get("transform"), "translate(100px,40px) scale(2)");
  assert.equal(tl.playing, false);
  assert.equal(tl.time, 1);
});

test("timeline: keyframes, sequencing, '<', labels, delay, stagger, single values continue", () => {
  const e = createEngine(), a = el(), b = el(), list = [el(), el(), el()];
  const tl = timeline(e)
    .to(a, { opacity: [0, 1, 0] }, { dur: 1, ease: "linear" }) // 0..1
    .to(b, { "--x": ["0px", "10px"] }, { dur: 1, ease: "linear" }) // 1..2, after the first
    .to(a, { scale: [1, 2] }, { at: "<", dur: 1, ease: "linear" }) // 1..2, with the one before
    .label("boot")
    .to(list, { opacity: [0, 1] }, { at: "boot", dur: 0.5, stagger: 0.25, ease: "linear" }) // 2..3
    .to(b, { "--x": "30px" }, { delay: -0.5, dur: 0.5, ease: "linear" }); // 2.5..3, from 10px
  assert.equal(tl.duration, 3);
  e.start();
  tl.seek(0.5);
  run(e, DT);
  assert.equal(a.props.get("opacity"), "1", "middle keyframe");
  assert.equal(b.props.get("--x"), "0px", "a property's first track holds its first keyframe before it starts");
  assert.equal(a.props.get("scale"), "1");
  tl.seek(1.5);
  run(e, DT);
  assert.equal(a.props.get("opacity"), "0");
  assert.equal(b.props.get("--x"), "5px");
  assert.equal(a.props.get("scale"), "1.5", "'<' starts with the track before");
  tl.seek(2.25);
  run(e, DT);
  assert.deepEqual(list.map((x) => x.props.get("opacity")), ["0.5", "0", "0"], "stagger: each starts 0.25 s after the last");
  assert.equal(b.props.get("--x"), "10px", "a later track waits for its start");
  tl.seek(2.75);
  run(e, DT);
  assert.equal(b.props.get("--x"), "20px", "a single value starts where the last track ended (10px -> 30px)");
  assert.deepEqual(list.map((x) => x.props.get("opacity")), ["1", "1", "0.5"]);
});

test("timeline: play, events, labels, done(); reverse; finish; pause and seek", async () => {
  const e = createEngine(), a = el();
  const tl = timeline(e, { id: 7 }).to(a, { opacity: [0, 1] }, { dur: 0.5, ease: "linear" }).label("half", 0.25).to(a, { opacity: 0 }, { dur: 0.5 });
  e.start();
  let done = 0;
  tl.done().then(() => done++);
  tl.play();
  const seen = run(e, 1.2);
  assert.deepEqual(seen, ["timeline:start:7:0", "half:7:0", "timeline:end:7:0"]);
  await null;
  assert.equal(done, 1, "done() resolves at the end");
  assert.equal(a.props.get("opacity"), "0");
  tl.reverse();
  run(e, 0.3);
  near(tl.time, 0.7, "reversing");
  assert.equal(a.props.get("opacity"), "0.216", "1 - out(0.4) on the way back");
  tl.pause();
  const t = tl.time;
  run(e, 0.5);
  assert.equal(tl.time, t, "paused: the playhead stays");
  const back = (tl.reverse(), run(e, 1));
  assert.deepEqual(back, ["half:7:0", "timeline:end:7:0"], "backward: the label passes, then the end (at 0)");
  assert.equal(a.props.get("opacity"), "0");
  assert.equal(tl.time, 0);
  tl.finish();
  assert.deepEqual(run(e, DT), ["timeline:start:7:0", "half:7:0", "timeline:end:7:0"], "finish lands on the end in one step");
  assert.equal(tl.time, 1);
  tl.seek(0.5).play();
  run(e, 0.25);
  near(tl.time, 0.75, "seek then play continues from there");
  assert.throws(() => tl.seek(NaN), RangeError);
});

test("timeline: repeat and yoyo", () => {
  const e = createEngine(), a = el();
  const tl = timeline(e, { repeat: 2, yoyo: true }).to(a, { opacity: [0, 1] }, { dur: 1, ease: "linear" }).label("top", 1);
  assert.equal(tl.duration, 3);
  e.start();
  tl.play();
  let seen = run(e, 1.5);
  assert.equal(a.props.get("opacity"), "0.5", "the second play runs backwards");
  seen = seen.concat(run(e, 2));
  assert.deepEqual(seen, ["timeline:start:0:0", "top:0:0", "top:0:0", "timeline:end:0:0"], "the label passes once per play that reaches it");
  assert.equal(a.props.get("opacity"), "1", "three plays: ends at the top");
  const loop = timeline(e, { repeat: Infinity }).to(el(), { opacity: [0, 1] }, { dur: 0.5 });
  loop.play();
  run(e, 10);
  assert.equal(loop.playing, true, "Infinity loops");
  assert.equal(loop.duration, Infinity);
});

test("timeline: reduced motion (motion: false) jumps to the end; settles; revert and Recall give it back", () => {
  const e = createEngine({ settle: 0.2 }), a = el({ opacity: "0.3" });
  const tl = timeline(e, { motion: false }).to(a, { opacity: [0, 1], translate: ["0px 20px", "0px 0px"] }, { dur: 2 });
  assert.equal(tl.reduced, true);
  e.start();
  tl.play();
  assert.deepEqual(run(e, DT), ["timeline:start:0:0", "timeline:end:0:0"]);
  assert.equal(a.props.get("opacity"), "1");
  assert.equal(a.props.get("translate"), "0px 0px");
  run(e, 0.5);
  assert.ok(e.paused.includes("settled"), "done: the engine sleeps");
  tl.revert();
  assert.equal(e.running, true, "revert wakes it");
  run(e, DT);
  assert.deepEqual([...a.props], [["opacity", "0.3"]], "revert: the host's value is back, the rest removed");
  tl.play();
  run(e, DT);
  assert.equal(a.props.get("opacity"), "1", "plays again after a revert");
  e.destroy();
  assert.deepEqual([...a.props], [["opacity", "0.3"]], "Recall restores every property touched");
});

test("timeline: host edits win; bad input is refused at setup", () => {
  const e = createEngine(), a = el();
  const tl = timeline(e).to(a, { opacity: [0, 1] }, { dur: 1, ease: "linear" });
  e.start();
  tl.play();
  run(e, 0.2);
  a.props.set("opacity", "0.9"); // the host page changes it
  run(e, 0.5);
  assert.equal(a.props.get("opacity"), "0.9", "never overwritten");
  e.destroy();
  assert.equal(a.props.get("opacity"), "0.9", "never restored over");
  const t2 = timeline(createEngine());
  assert.throws(() => t2.to(el(), { transform: ["scale(1)", "rotate(1deg)"] }), RangeError, "keyframes must share a shape");
  assert.throws(() => t2.to(el(), { opacity: [0, 1] }, { ease: "bounce" }), RangeError);
  assert.throws(() => t2.to(el(), { opacity: [0, 1] }, { dur: NaN }), RangeError);
  assert.throws(() => timeline(createEngine(), { rate: 0 }), RangeError);
  // repeat is a whole number ≥ 0 or Infinity: -1 used to loop forever, 0.5 to stop mid-play.
  for (const repeat of [-1, -2, 0.5, NaN]) assert.throws(() => timeline(createEngine(), { repeat }), RangeError, `repeat ${repeat}`);
  for (const repeat of [0, 2, Infinity]) assert.doesNotThrow(() => timeline(createEngine(), { repeat }), `repeat ${repeat}`);
});

test("timeline: zero allocation while it plays (steps), and none once it is done (whole frames)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine(), nums = new Float64Array(8), els = [el(), el(), el(), el()];
  const tl = timeline(e, { repeat: Infinity, yoyo: true })
    .to(nums, { 0: [0, 1, 0], 1: [5, 9], 2: [0, 360] }, { dur: 0.7, ease: "back" })
    .label("mid")
    .to(els, { transform: ["translate(0px,0px) rotate(0deg)", "translate(9px,4px) rotate(90deg)"], opacity: [0, 1] }, { at: 0, dur: 0.4, stagger: 0.1, ease: "inOut" })
    .to(nums, { 3: [0, 1] }, { dur: 0.3, ease: "steps(3)" });
  e.start();
  tl.play();
  // Steps only (render builds a style string for each changed value, once a frame, outside the step).
  const work = (n) => {
    for (let i = 0; i < n; i++) tl.step(e, DT);
  };
  work(20000);
  gc();
  const minor = await minorGCs(() => work(200000));
  assert.ok(minor <= 1, `young-generation GCs over 200k timeline steps: ${minor}`);
  // Done: whole frames (read, steps, render) do nothing at all.
  const one = timeline(e).to(els, { opacity: [0, 1] }, { dur: 0.2 });
  tl.pause();
  one.play();
  run(e, 0.5);
  const frames = (n) => {
    for (let i = 0; i < n; i++) e.advance(DT);
  };
  frames(20000);
  gc();
  const idle = await minorGCs(() => frames(200000));
  assert.ok(idle <= 1, `young-generation GCs over 200k frames, every timeline done or paused: ${idle}`);
});
