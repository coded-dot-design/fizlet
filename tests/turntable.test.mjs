// @fzlt/core/turntable in Node (a fake element): a drag turns it by `rate` per px at once; ← → turn it
// by `key`, eased, and Home goes back the short way; `spin` shows it off and rests; a throw coasts
// under `friction` and rests on a `snap` step; with motion off turns jump, nothing coasts and `spin`
// does nothing; `onTurn` fires only when the angle changed; the engine sleeps at rest; destroy gives
// the element back (attributes, style, listeners); and a turntable coasting, easing and showing for
// 300k steps allocates nothing. The real pointer, keys and prefers-reduced-motion: tests/turntable.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";
import { El } from "./fake-dom.mjs";

const { createEngine } = await import("../src/kernel/index.ts");
const { turntable } = await import("../src/turntable.ts");

const run = (e, sec) => {
  for (let t = 0; t < sec; t += 1 / 60) e.advance(1 / 60);
};
const near = (a, b, eps = 1e-9, m = "") => assert.ok(Math.abs(a - b) < eps, `${m} ${a} vs ${b}`);
const stage = () => Object.assign(new El("canvas"), { setPointerCapture() {} });
const key = (el, k) => el.dispatch("keydown", { key: k, stopPropagation() {} });

test("turntable: a drag turns it by rate per px at once; a release rests where it is; one pointer holds it", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), turns = [];
  const tt = turntable(e, el, { yaw: -0.15, motion: true, onTurn: (y) => turns.push(y) });
  e.start();
  run(e, 0.05);
  assert.deepEqual(turns, [-0.15], "drawn once at the start");
  el.dispatch("pointerdown", { pointerId: 7, button: 0, clientX: 100, timeStamp: 0 });
  el.dispatch("pointermove", { pointerId: 7, clientX: 150, timeStamp: 16 });
  near(tt.yaw, -0.15 + 50 * 0.012, 1e-12, "follows at once");
  el.dispatch("pointermove", { pointerId: 9, clientX: 900, timeStamp: 20 });
  el.dispatch("pointerdown", { pointerId: 9, button: 0, clientX: 900, timeStamp: 20 });
  near(tt.yaw, -0.15 + 50 * 0.012, 1e-12, "another pointer does not move or steal it");
  el.dispatch("pointerup", { pointerId: 7, timeStamp: 30 });
  assert.equal(tt.moving, false, "no friction: a release stops");
  run(e, 0.5);
  assert.equal(turns.length, 2, "onTurn only when the angle changed");
  assert.ok(e.paused.includes("settled"), "the engine sleeps at rest");
  el.dispatch("pointerdown", { pointerId: 1, button: 2, clientX: 0, timeStamp: 40 });
  assert.equal(tt.moving, false, "a secondary button does not grab");
  el.dispatch("pointerdown", { pointerId: 1, button: 0, clientX: 0, timeStamp: 40 });
  assert.equal(e.running, true, "a grab wakes it");
  el.dispatch("pointercancel", { pointerId: 1, timeStamp: 41 });
  assert.equal(tt.moving, false);
});

test("turntable: arrow keys ease by a step and add up; Home returns the short way; other keys pass", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), tt = turntable(e, el, { yaw: 0.2, motion: true });
  e.start();
  const ev = key(el, "ArrowRight");
  assert.equal(ev.defaultPrevented, true);
  key(el, "ArrowRight");
  run(e, 0.05);
  assert.ok(tt.moving && tt.yaw > 0.2 && tt.yaw < 0.2 + Math.PI / 6, `eases (${tt.yaw})`);
  run(e, 2);
  near(tt.yaw, 0.2 + Math.PI / 6, 1e-12, "two presses, landed exactly");
  key(el, "ArrowLeft");
  run(e, 2);
  near(tt.yaw, 0.2 + Math.PI / 12, 1e-12);
  assert.equal(key(el, "a").defaultPrevented, undefined, "other keys are not eaten");
  tt.turn(0.2 + Math.PI * 2 * 3 + 0.4);
  tt.home();
  run(e, 2);
  near(tt.yaw, 0.2 + Math.PI * 2 * 3, 1e-12, "home: the nearest turn of the start angle");
  assert.equal(tt.deg, Math.round((0.2 * 180) / Math.PI));
  // A negative rate flips the keys with the drag.
  const el2 = stage(), t2 = turntable(e, el2, { rate: -0.012, motion: true });
  key(el2, "ArrowRight");
  run(e, 2);
  near(t2.yaw, -Math.PI / 12, 1e-12);
  const el3 = stage();
  turntable(e, el3, { key: 0 });
  assert.equal(el3.count("keydown"), 0, "key: 0 adds no key listener");
});

test("turntable: spin shows it off for its seconds, then rests; a grab stops it", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), tt = turntable(e, el, { motion: true, spin: 1.6 });
  e.start();
  tt.spin(1);
  run(e, 0.5);
  assert.ok(tt.moving);
  near(tt.yaw, 0.8, 0.06, "half way");
  run(e, 1);
  assert.equal(tt.moving, false);
  near(tt.yaw, 1.6, 0.06, "1.6 rad/s for a second");
  run(e, 0.5);
  assert.ok(e.paused.includes("settled"));
  tt.spin();
  run(e, 0.2);
  const at = tt.yaw;
  tt.grab(10);
  run(e, 0.5);
  assert.equal(tt.yaw, at, "held: the show stops");
  tt.spin();
  run(e, 0.2);
  assert.equal(tt.yaw, at, "spin does nothing while held");
  tt.release();
});

test("turntable: a throw coasts under friction and rests on a snap step", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), tt = turntable(e, el, { motion: true, friction: 4, snap: Math.PI / 4 });
  e.start();
  tt.grab(0, 0);
  for (let i = 1; i <= 6; i++) tt.drag(i * 20, i * 16);
  const let_go = tt.yaw;
  tt.release(6 * 16 + 8);
  assert.ok(tt.moving, "thrown");
  run(e, 0.3);
  assert.ok(tt.yaw > let_go + 0.5, `coasts on (${tt.yaw} from ${let_go})`);
  run(e, 6);
  assert.equal(tt.moving, false);
  const k = tt.yaw / (Math.PI / 4);
  near(k, Math.round(k), 1e-9, "rests on a step");
  assert.ok(tt.yaw > let_go + 1, "well past where it was let go");
  // Held still before letting go: no throw, but still the nearest step.
  tt.grab(0, 10000);
  tt.drag(30, 10016);
  tt.release(10500);
  run(e, 3);
  const k2 = tt.yaw / (Math.PI / 4);
  near(k2, Math.round(k2), 1e-9);
  near(k2, k, 1e-9, "30 px is under half a step: back where it was");
});

test("turntable: motion off jumps (keys, home, snap), never coasts, and spin does nothing", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), tt = turntable(e, el, { motion: false, friction: 4, snap: 0.5 });
  e.start();
  key(el, "ArrowRight");
  assert.equal(tt.moving, false);
  near(tt.yaw, Math.PI / 12, 1e-12, "a key lands at once");
  tt.spin();
  run(e, 0.3);
  near(tt.yaw, Math.PI / 12, 1e-12, "no show");
  tt.grab(0, 0);
  for (let i = 1; i <= 6; i++) tt.drag(i * 20, i * 16);
  tt.release(100);
  assert.equal(tt.moving, false, "no coast");
  near(tt.yaw / 0.5, Math.round(tt.yaw / 0.5), 1e-9, "snapped at once");
  tt.home();
  assert.equal(tt.yaw, 0);
});

test("turntable: the visitor's reduced-motion setting is read when motion is not given", () => {
  const was = globalThis.matchMedia, mq = { matches: true };
  globalThis.matchMedia = () => mq;
  try {
    const e = createEngine(), tt = turntable(e, stage());
    e.start();
    tt.spin();
    assert.equal(tt.moving, false);
    mq.matches = false;
    tt.spin();
    assert.equal(tt.moving, true, "the setting is read live");
    mq.matches = true;
    run(e, 0.1);
    assert.equal(tt.moving, false, "turned on mid-show: it rests");
  } finally {
    globalThis.matchMedia = was;
  }
});

test("turntable: a label makes it a slider through the ledger; destroy gives the element back", () => {
  const e = createEngine(), el = stage();
  el.setAttribute("aria-label", "the host's");
  const tt = turntable(e, el, { label: "Turn the model", motion: true, yaw: Math.PI / 2 });
  e.start();
  run(e, 0.05);
  assert.equal(el.getAttribute("role"), "slider");
  assert.equal(el.getAttribute("tabindex"), "0");
  assert.equal(el.getAttribute("aria-label"), "Turn the model");
  assert.equal(el.getAttribute("aria-valuenow"), "90");
  assert.equal(el.getAttribute("aria-valuetext"), "90°");
  assert.equal(el.style.getPropertyValue("touch-action"), "pan-y");
  tt.turn(-Math.PI / 2);
  run(e, 0.05);
  assert.equal(el.getAttribute("aria-valuenow"), "270", "0..359");
  assert.ok(el.count() >= 5);
  e.destroy();
  assert.equal(el.count(), 0, "every listener gone");
  assert.equal(el.getAttribute("aria-label"), "the host's");
  assert.deepEqual(el.getAttributeNames().filter((n) => n !== "aria-label" && n !== "style"), [], "no attribute left");
  assert.equal(el.style.getPropertyValue("touch-action"), "");
});

test("turntable: bad options fail at setup with their name; bad angles are ignored", () => {
  const e = createEngine();
  assert.throws(() => turntable(e, stage(), { rate: NaN }), /rate/);
  assert.throws(() => turntable(e, stage(), { ease: 0 }), /ease/);
  const tt = turntable(e, stage(), { motion: true });
  tt.turn(NaN);
  tt.by(Infinity);
  assert.equal(tt.yaw, 0);
});

test("turntable: coasting, easing and showing allocate nothing (0 young GCs over 300k steps)", async () => {
  const e = createEngine(), el = stage();
  let seen = 0;
  const tt = turntable(e, el, { motion: true, friction: 0.5, snap: 0.3, onTurn: (y) => (seen += y) });
  e.start();
  const work = () => {
    for (let i = 0; i < 300000; i++) {
      const m = i % 900;
      if (m === 0) tt.grab(0, i), tt.drag(40, i + 16), tt.drag(90, i + 32), tt.release(i + 40);
      else if (m === 400) tt.by(0.7);
      else if (m === 600) tt.spin(2);
      e.advance(1 / 60);
    }
  };
  work(); // warm up
  const gcs = await minorGCs(work);
  assert.ok(seen !== 0);
  assert.ok(gcs <= 1, `${gcs} young GCs`);
});
