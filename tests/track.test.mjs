// @fzlt/core/track in Node: space positions (points as given, even steps along a polyline, a smooth
// loop) and headings; moves (steps, a loop's wrap and pass go, backward), jumps (ladders, chutes, a
// chain), an open path's three finishes (stop, exact, bounce), tokens sharing a space (side by side,
// then stacked), the hop animation (arcs, slides, start and end on the tokens' places), events on a
// kernel event ring, and no allocation per move and sample.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { track, HOP } = await import("../src/track.ts");
const { EventRing } = await import("../src/kernel/ring.ts");

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const square = { points: [0, 0, 4, 0, 4, 4, 0, 4] };

test("track: spaces at the points, or at even steps along a polyline or a loop; headings", () => {
  const t = track(square);
  assert.equal(t.n, 4);
  assert.deepEqual([...t.x], [0, 4, 4, 0]);
  assert.deepEqual([...t.z], [0, 0, 4, 4]);
  close(t.a[0], 0, 1e-12, "along +x: no turn");
  // Open: space 1 looks from 0 to 2 (diagonal); the last looks back from 2.
  close(t.a[3], Math.atan2(-0, -4), 1e-12, "the last space faces −x");
  const loop = track({ ...square, closed: true, spaces: 8 });
  assert.deepEqual([...loop.x].map((v) => +v.toFixed(9)), [0, 2, 4, 4, 4, 2, 0, 0], "16 units around, a space every 2");
  assert.deepEqual([...loop.z].map((v) => +v.toFixed(9)), [0, 0, 0, 2, 4, 4, 4, 2]);
  close(loop.a[1], 0, 1e-12, "bottom edge: +x");
  close(loop.a[3], -Math.PI / 2, 1e-12, "right edge: +z is diorama's rot y −π/2");
  const open = track({ points: [0, 0, 10, 0, 10, 5], spaces: 7 });
  for (let i = 1; i < 7; i++) close(Math.hypot(open.x[i] - open.x[i - 1], open.z[i] - open.z[i - 1]), 2.5, 1e-9, `space ${i}: 15 units in 6 even steps`);
  const smooth = track({ points: [-5, -3, 5, -3, 5, 3, -5, 3], closed: true, smooth: true, spaces: 20 });
  const gaps = [];
  for (let i = 0; i < 20; i++) gaps.push(Math.hypot(smooth.x[(i + 1) % 20] - smooth.x[i], smooth.z[(i + 1) % 20] - smooth.z[i]));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.05, `even steps along the curve: ${Math.min(...gaps).toFixed(3)}..${Math.max(...gaps).toFixed(3)}`);
  assert.deepEqual([smooth.x[0], smooth.z[0]], [-5, -3], "the curve starts at the first point");
  for (let i = 0; i < 20; i++) assert.ok(Math.abs(smooth.x[i]) < 6.5 && Math.abs(smooth.z[i]) < 4, "the curve stays near its points (it rounds the corners outward)");
  assert.throws(() => track({ points: [0, 0] }), RangeError);
});

test("track: move steps forward, wraps a loop and passes go; backward; hops and times", () => {
  const ev = new EventRing(32), t = track({ ...square, closed: true, spaces: 8, events: ev, hopTime: 0.2 });
  t.place(0, 6);
  assert.equal(t.move(0, 3), 3);
  assert.equal(t.at[0], 1);
  assert.deepEqual([...t.hops.from.subarray(0, 3)], [6, 7, 0]);
  assert.deepEqual([...t.hops.to.subarray(0, 3)], [7, 0, 1]);
  assert.deepEqual([...t.hops.flag.subarray(0, 3)], [0, HOP.pass, HOP.land], "entering space 0 forward: pass go; the last hop lands");
  close(t.duration, 0.6, 1e-12, "three steps of 0.2 s");
  assert.equal(ev.size, 2, "two events");
  assert.deepEqual([ev.at(0).type, ev.at(0).a, ev.at(0).b], ["track:pass", 0, 0]);
  assert.deepEqual([ev.at(1).type, ev.at(1).a, ev.at(1).b], ["track:land", 0, 1]);
  ev.clear();
  assert.equal(t.move(0, -2), 2, "back two");
  assert.equal(t.at[0], 7);
  assert.equal(t.hops.flag[0] & HOP.pass, 0, "going back over go is not passing it");
  assert.equal(ev.at(0).type, "track:land");
  t.place(1, -1);
  assert.equal(t.move(1, 2), 2, "a token off the board enters at space 0");
  assert.equal(t.at[1], 2);
});

test("track: jumps (ladder, chute, a chain) after the landing, as slides", () => {
  const ev = new EventRing(32), t = track({ points: Array.from({ length: 20 }, (_, i) => [i, 0]).flat(), jumps: [[3, 11], [11, 15], [17, 4]], events: ev, hopTime: 0.2, jumpSpeed: 4 });
  t.place(0, 0);
  assert.equal(t.move(0, 3), 5, "3 steps, then 3 → 11 → 15");
  assert.equal(t.at[0], 15);
  assert.deepEqual([...t.hops.kind.subarray(0, 5)], [HOP.step, HOP.step, HOP.step, HOP.jump, HOP.jump]);
  assert.deepEqual([t.hops.from[3], t.hops.to[3], t.hops.from[4], t.hops.to[4]], [3, 11, 11, 15]);
  close(t.hops.t1[3] - t.hops.t0[3], 2, 1e-12, "8 units at 4 per second");
  close(t.hops.t1[4] - t.hops.t0[4], 1, 1e-12, "4 units at 4 per second");
  assert.equal(t.hops.flag[4], HOP.land);
  assert.deepEqual([ev.at(0).type, ev.at(0).b, ev.at(1).type, ev.at(1).b, ev.at(2).type, ev.at(2).b], ["track:jump", 11, "track:jump", 15, "track:land", 15]);
  assert.equal(t.move(0, 2), 3, "a chute: 17 → 4");
  assert.equal(t.at[0], 4);
  assert.equal(t.move(0, 1), 1, "passing over a jump's start does not take it");
  assert.equal(t.at[0], 5);
});

test("track: an open path's end: stop, exact, bounce; the finish flag and event", () => {
  const pts = Array.from({ length: 10 }, (_, i) => [i, 0]).flat();
  const stop = track({ points: pts });
  stop.place(0, 7);
  assert.equal(stop.move(0, 5), 2, "stops on the last space");
  assert.equal(stop.at[0], 9);
  assert.equal(stop.hops.flag[1], HOP.land | HOP.finish);
  const ev = new EventRing(8), exact = track({ points: pts, finish: "exact", events: ev });
  exact.place(0, 7);
  assert.equal(exact.move(0, 3), 0, "past the end: no move");
  assert.equal(exact.at[0], 7);
  assert.deepEqual([ev.at(0).type, ev.at(0).a, ev.at(0).b], ["track:stay", 0, 7]);
  ev.clear();
  assert.equal(exact.move(0, 2), 2, "the exact count finishes");
  assert.deepEqual([ev.at(0).type, ev.at(1).type], ["track:finish", "track:land"]);
  const bounce = track({ points: pts, finish: "bounce", jumps: [[6, 2]] });
  bounce.place(0, 7);
  assert.equal(bounce.move(0, 4), 4, "2 up to the end, 2 back");
  assert.deepEqual([...bounce.hops.to.subarray(0, 4)], [8, 9, 8, 7]);
  assert.deepEqual([...bounce.hops.flag.subarray(0, 4)], [0, 0, HOP.back, HOP.back | HOP.land]);
  assert.equal(bounce.at[0], 7);
  bounce.place(1, 7);
  assert.equal(bounce.move(1, 5), 6);
  assert.deepEqual([...bounce.hops.to.subarray(0, 6)], [8, 9, 8, 7, 6, 2], "9 then back to 6, a chute to 2");
  assert.equal(bounce.at[1], 2);
});

test("track: tokens on one space stand side by side, then stack; places re-rank as they leave", () => {
  const t = track({ points: [0, 0, 10, 0, 20, 0], cap: 2, spacing: 0.5, level: 0.4 }), o = [0, 0, 0];
  t.place(0, 1);
  assert.deepEqual(t.slot(0, o), [10, 0, 0], "alone: the centre");
  t.place(1, 1);
  t.place(2, 1);
  const p = [0, 1, 2].map((k) => [...t.slot(k, [0, 0, 0])].map((v) => +v.toFixed(9)));
  assert.deepEqual(p[0], [10, 0, -0.5], "two side by side across the path");
  assert.deepEqual(p[1], [10, 0, 0.5]);
  assert.deepEqual(p[2], [10, 0.4, 0], "the third (over cap 2) on top, alone on its level");
  assert.equal(t.count(1), 3);
  t.move(0, 1);
  assert.deepEqual([...t.slot(1, o)].map((v) => +v.toFixed(9)), [10, 0, -0.5], "the first left: the others move up a place");
  assert.deepEqual([...t.slot(2, o)].map((v) => +v.toFixed(9)), [10, 0, 0.5]);
  assert.deepEqual([...t.spot(0, 4, 6, o)].map((v) => +v.toFixed(9)), [0, 0.8, -0.5], "spot: the 5th and 6th of six share level 2");
  const per = track({ points: [0, 0, 10, 0], cap: [1, 3] });
  per.place(0, 0);
  per.place(1, 0);
  assert.equal(per.slot(1, o)[1], 0.3, "cap per space: space 0 holds one per level");
});

test("track: the hop animation: from the token's place, an arc per step, a slide per jump, to its new place", () => {
  const t = track({ points: Array.from({ length: 8 }, (_, i) => [i * 2, 0]).flat(), jumps: [[3, 6]], hop: 1, hopTime: 0.25, jumpSpeed: 6 }), o = new Float64Array(3);
  t.place(1, 0);
  t.place(2, 6);
  t.place(0, 0);
  const start = [...t.slot(0, [0, 0, 0])];
  assert.equal(t.move(0, 3), 4);
  t.sample(0, o);
  assert.deepEqual([...o].map((v) => +v.toFixed(9)), start.map((v) => +v.toFixed(9)), "starts where it stood (beside token 1)");
  t.sample(0.125, o);
  close(o[1], 1, 1e-9, "top of the first arc");
  t.sample(0.25, o);
  assert.deepEqual([o[0], o[1], o[2]], [2, 0, 0], "lands on space 1's centre between steps");
  t.sample(0.75 + (t.hops.t1[3] - t.hops.t0[3]) / 2, o);
  close(o[0], 9, 1e-9, "halfway along the jump from 6 to 12");
  close(o[1], 0.25, 1e-9, "a jump keeps low");
  assert.equal(t.sample(t.duration + 1, o), false, "over");
  const end = [...t.slot(0, [0, 0, 0])];
  assert.deepEqual([...o], end, "ends on its place beside token 2");
  assert.notDeepEqual(end, [12, 0, 0], "shared, so not the centre");
  const ob = { pos: new Float64Array(3) };
  assert.equal(t.apply(ob, 0.125, 0.2), true);
  close(ob.pos[1], 1.2, 1e-9, "apply writes pos with the lift");
  assert.equal(t.token, 0);
});

test("track: zero allocation per move and sample", async (t) => {
  const minors = async (on) => {
    const ev = new EventRing(64), tr = track({ points: [-5, -3, 5, -3, 5, 3, -5, 3], closed: true, smooth: true, spaces: 28, jumps: [[4, 12], [20, 9]], events: ev, tokens: 4 });
    for (let k = 0; k < 4; k++) tr.place(k, k);
    const o = new Float64Array(3), ob = { pos: new Float64Array(3) }, s = new Float64Array(2);
    const frame = () => {
      s[1] += 1 / 60;
      if (!on) return;
      if (s[1] > tr.duration) (s[1] = 0), s[0]++, ev.clear(), tr.move(s[0] % 4, 1 + (s[0] % 6));
      tr.sample(s[1], o);
      tr.apply(ob, s[1]);
      for (let k = 0; k < 4; k++) tr.slot(k, o);
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 50000; i++) frame(); });
  };
  // The run with the track goes first: a bare run first leaves the frame's call sites trained on
  // `return` and the later run's calls less inlined (their time arguments boxed by the caller).
  const withTrack = await minors(true), bare = await minors(false);
  t.diagnostic(`young GCs over 50k frames (best of 3): bare ${bare}, moving and sampling ${withTrack}`);
  assert.ok(withTrack <= bare + 1, `young-generation GCs: ${withTrack} with track, ${bare} bare`);
});
