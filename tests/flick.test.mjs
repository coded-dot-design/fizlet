// @fzlt/core/flick in Node: the same shot gives the same table bit for bit (and no step calls
// Math.sin, Math.cos or Math.atan2); collisions keep momentum, and energy when bounce is 1, and lose
// the right share when it is not; friction stops a piece at v² ÷ 2μg; pieces fall off the edges
// (fast: they fly; slow: they tip over the edge) and rest on the floor flagged off; a stack topples
// when its centre of mass leaves its support, the pieces on it with it, and lands on a side; ramps
// hold, launch and wall; `sling` turns a drag into two integers and back; and step, pose and sling
// allocate nothing. Real pixels and a real drag in Chromium: tests/flick.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { flick, sling, STATE } = await import("../src/flick.ts");
const { EventRing } = await import("../src/kernel/ring.ts");

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const KE = (w, i) => 0.5 * w.mass[i] * (w.vx[i] ** 2 + w.vz[i] ** 2) + (w.ii[i] ? (0.5 * w.spin[i] ** 2) / w.ii[i] : 0);

/** A busy table: rails, a rack of ten discs, a three-box stack, a ramp and a heavy cue disc. */
function table(events) {
  const w = flick({ table: [12, 6], cap: 40, events });
  w.add({ shape: "box", fixed: true, size: [12, 0.4, 0.3], pos: [0, -3.15] });
  w.add({ shape: "box", fixed: true, size: [12, 0.4, 0.3], pos: [0, 3.15] });
  for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) w.add({ pos: [2 + r * 0.55, (c - r / 2) * 0.62], size: [0.6, 0.2] });
  for (let k = 0; k < 3; k++) w.add({ shape: "box", size: [0.8, 0.8, 0.8], pos: [4.8 + k * 0.1, -2], yaw: 0.3 });
  w.add({ shape: "ramp", size: [2, 0.5, 1.2], pos: [-1, 2], yaw: Math.PI });
  const cue = w.add({ pos: [-4, 0.05], size: [0.7, 0.25], mass: 1.5 });
  return { w, cue };
}
const snapshot = (w) => [w.x, w.y, w.z, w.vx, w.vy, w.vz, w.spin].map((a) => Buffer.from(a.buffer.slice(0, w.n * 8)).toString("hex")).join("|") + [...w.state.subarray(0, w.n), ...w.off.subarray(0, w.n)].join("");

test("flick: the same shot gives the same table, bit for bit, with no trig in a step", () => {
  const ev1 = new EventRing(256), ev2 = new EventRing(256);
  const a = table(ev1), b = table(ev2);
  const sender = sling({ max: 18 }), receiver = sling({ max: 18 });
  sender.begin(a.w.x[a.cue], a.w.z[a.cue], -6.2, 0.3);
  assert.ok(sender.end(), "a shot");
  receiver.set(sender.angle, sender.level); // the two integers over the wire
  assert.deepEqual([receiver.jx, receiver.jz], [sender.jx, sender.jz], "the same impulse from the same integers");
  const trig = ["sin", "cos", "atan2", "tan", "asin", "acos", "hypot", "pow", "exp"].map((k) => [k, Math[k]]);
  a.w.run();
  b.w.run();
  const x0 = Float64Array.from(a.w.x), z0 = Float64Array.from(a.w.z);
  try {
    // A step runs on + − × ÷, sqrt, abs and round only: the same bits in every browser.
    for (const [k] of trig) Math[k] = () => { throw new Error(`Math.${k} in a step`); };
    a.w.flick(a.cue, sender.jx, sender.jz);
    b.w.flick(b.cue, receiver.jx, receiver.jz);
    let steps = 0;
    for (; steps < 5000 && (a.w.busy || b.w.busy); steps++) {
      a.w.step(1 / 60);
      b.w.step(1 / 60);
      if (steps % 20 === 0) assert.equal(snapshot(a.w), snapshot(b.w), `step ${steps}`);
    }
    assert.ok(steps > 60 && steps < 5000, `it comes to rest: ${steps} steps`);
  } finally {
    for (const [k, f] of trig) Math[k] = f;
  }
  assert.equal(snapshot(a.w), snapshot(b.w), "the same rest");
  assert.equal(ev1.size, ev2.size);
  for (let i = 0; i < ev1.size; i++) assert.deepEqual({ ...ev1.at(i) }, { ...ev2.at(i) }, `event ${i}`);
  assert.ok([...a.w.state.subarray(0, a.w.n)].every((s) => s === STATE.rest), "everything rests");
  const moved = [...Array(10).keys()].filter((k) => Math.abs(a.w.x[k + 2] - x0[k + 2]) + Math.abs(a.w.z[k + 2] - z0[k + 2]) > 0.05);
  assert.ok(moved.length >= 5, `the break scatters the rack: ${moved.length} moved`);
  for (let i = 0; i < a.w.n; i++) assert.ok(Number.isFinite(a.w.x[i] + a.w.y[i] + a.w.z[i]), `piece ${i} is finite`);
  // A different shot gives a different table.
  const c = table();
  c.w.run();
  receiver.set(sender.angle + 3, sender.level);
  c.w.flick(c.cue, receiver.jx, receiver.jz);
  c.w.run();
  assert.notEqual(snapshot(c.w), snapshot(a.w));
});

test("flick: collisions keep momentum; energy too at bounce 1, and lose the share bounce says", () => {
  // Discs, off-centre, elastic, different masses.
  let w = flick({ table: [40, 20] });
  let a = w.add({ pos: [-3, 0], mass: 2, friction: 0, bounce: 1 }), b = w.add({ pos: [0, 0.35], mass: 1, friction: 0, bounce: 1 });
  w.flick(a, 8, 0);
  const p0 = [2 * 4, 0], e0 = KE(w, a);
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(w.vz[b] > 0.5, "an off-centre hit sends b sideways");
  close(w.mass[a] * w.vx[a] + w.mass[b] * w.vx[b], p0[0], 1e-12, "momentum x");
  close(w.mass[a] * w.vz[a] + w.mass[b] * w.vz[b], p0[1], 1e-12, "momentum z");
  close(KE(w, a) + KE(w, b), e0, 1e-9, "kinetic energy at bounce 1");
  // Head-on, equal masses, bounce 0.6: v1' = v(1 − e)/2, v2' = v(1 + e)/2; energy (1 + e²)/2.
  w = flick({ table: [40, 20] });
  a = w.add({ pos: [-3, 0], friction: 0, bounce: 0.6 });
  b = w.add({ pos: [0, 0], friction: 0, bounce: 0.6 });
  w.flick(a, 5, 0);
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  close(w.vx[a], 5 * 0.2, 1e-12, "the striker keeps (1 − e)/2");
  close(w.vx[b], 5 * 0.8, 1e-12, "the target takes (1 + e)/2");
  close(KE(w, a) + KE(w, b), 12.5 * 0.68, 1e-9, "energy (1 + e²)/2");
  // A disc into the end of a box: the box slides and spins; momentum and energy (spin counted) kept.
  w = flick({ table: [40, 20] });
  const bx = w.add({ shape: "box", size: [0.6, 0.5, 2], mass: 3, friction: 0, bounce: 1 });
  a = w.add({ pos: [-3, 0.7], size: [0.6, 0.2], friction: 0, bounce: 1 });
  w.flick(a, 5, 0);
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(w.spin[bx] > 0.5, `a hit off the box's middle spins it: ${w.spin[bx]}`);
  close(w.vx[a] + 3 * w.vx[bx], 5, 1e-12, "momentum x");
  close(w.vz[a] + 3 * w.vz[bx], 0, 1e-12, "momentum z");
  close(KE(w, a) + KE(w, bx), 12.5, 1e-9, "energy with the spin");
  // A fixed wall sends a disc back at bounce² … here (1 + 0.5)/2 averaged: e = 0.75.
  w = flick({ table: [40, 20] });
  w.add({ shape: "box", fixed: true, size: [0.4, 0.5, 6], pos: [3, 0], bounce: 0.5 });
  a = w.add({ pos: [0, 0], friction: 0, bounce: 1 });
  w.flick(a, 4, 0);
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  close(w.vx[a], -3, 1e-12, "off the wall at e = 0.75");
  assert.equal(w.x[3 - 3], 3, "the wall never moves");
});

test("flick: friction stops a piece at v² ÷ 2μg", () => {
  for (const [v, mu] of [[3, 0.25], [6, 0.25], [8, 0.1], [5, 0.6]]) {
    const w = flick({ table: [200, 10] }), a = w.add({ pos: [-90, 0], friction: mu });
    w.flick(a, v, 0);
    const steps = w.run();
    const d = w.x[a] + 90, want = w.reach(a, v);
    close(want, (v * v) / (2 * mu * 9.8), 1e-12, "reach");
    assert.ok(Math.abs(d - want) / want < 0.01, `v ${v}, μ ${mu}: ${d.toFixed(4)} vs ${want.toFixed(4)}`);
    close(steps / 60, v / (mu * 9.8), 0.05, "time to stop v ÷ μg");
    assert.equal(w.busy, false);
    assert.equal(w.state[a], STATE.rest);
  }
  // Heavier is not slower: μg does not depend on mass, the flick's velocity change does.
  const w = flick({ table: [200, 10] }), a = w.add({ pos: [-90, 0], mass: 2 });
  w.flick(a, 8, 0);
  w.run();
  close(w.x[a] + 90, w.reach(a, 4), 0.1, "impulse 8 on mass 2 is 4 units/s");
});

test("flick: fast pieces fly off an edge, slow ones tip over it; both rest on the floor, off", () => {
  const ev = new EventRing(64), w = flick({ table: [10, 6], floor: -2, events: ev });
  const fast = w.add({ pos: [3, -1] }), slow = w.add({ pos: [3, 1] }), stays = w.add({ pos: [0, 2] });
  w.flick(fast, 6, 0);
  // Slow: friction leaves it creeping over the edge (2 units away: v² = 2 · μg · 2.05).
  w.flick(slow, Math.sqrt(2 * 0.25 * 9.8 * 2.05), 0);
  w.flick(stays, 3, 0);
  const types = [];
  let tipSeen = false;
  for (let k = 0; k < 2000 && w.busy; k++) {
    w.step(1 / 60);
    if (w.state[slow] === STATE.tip) tipSeen = true;
  }
  for (let i = 0; i < ev.size; i++) types.push(`${ev.at(i).type} ${ev.at(i).a}`);
  assert.ok(tipSeen, "the slow one tips over the edge");
  assert.ok(!types.includes(`flick:topple ${fast}`), "the fast one flies off without tipping");
  assert.ok(types.includes(`flick:fall ${fast}`) && types.includes(`flick:fall ${slow}`), types.join(", "));
  assert.equal(types.at(-1), "flick:rest 0");
  assert.ok(w.x[fast] > 6.5, `the fast one lands well out: ${w.x[fast]}`);
  assert.ok(w.x[slow] > 5 && w.x[slow] < 6, `the slow one drops by the edge: ${w.x[slow]}`);
  for (const i of [fast, slow]) assert.deepEqual([w.y[i], w.off[i], w.on[i], w.state[i]], [-2, 1, -2, STATE.rest], `piece ${i} on the floor`);
  assert.deepEqual([w.y[stays], w.off[stays], w.on[stays]], [0, 0, -1], "a piece that stops short stays");
  // Discs land flat (either face): their pose's tilt is a multiple of π.
  const out = new Float64Array(6);
  w.pose(slow, out);
  close(Math.abs(out[3]) % Math.PI, 0, 1e-9, "flat");
  close(Math.abs(out[5]) % Math.PI, 0, 1e-9, "flat");
});

test("flick: a stack topples when its centre of mass leaves its support, and lands on a side", () => {
  const two = (off) => {
    const ev = new EventRing(32), w = flick({ table: [10, 6], events: ev }), base = w.add({ shape: "box", size: [1, 1, 1] }), top = w.add({ shape: "box", size: [1, 1, 1], pos: [off, 0] });
    w.run();
    return { w, base, top, ev };
  };
  const s = two(0.49);
  assert.deepEqual([s.w.y[s.top], s.w.on[s.top], s.w.x[s.top]], [1, s.base, 0.49], "0.49 over a 0.5 half width: it stands");
  const t = two(0.51);
  assert.equal(t.ev.at(0).type, "flick:topple");
  assert.equal(t.ev.at(0).a, t.top);
  assert.deepEqual([t.w.y[t.top], t.w.on[t.top]], [0, -1], "0.51: it tips off onto the table");
  assert.ok(t.w.x[t.top] > 1, `beside the base: ${t.w.x[t.top]}`);
  const out = new Float64Array(6);
  t.w.pose(t.top, out);
  close(out[5], -Math.PI / 2, 1e-9, "lying on its side, turned toward +x (rot z −π/2)");
  close(out[1], 0.5, 1e-9, "its origin (the old bottom face's centre) half a width up");
  close(out[0], t.w.x[t.top] - 0.5, 1e-9, "and half a width back toward where it stood");
  // Three boxes: the top two lean out together. The top one is over its own support (0.75 is
  // inside the middle box), but middle + top have their centre at 0.525, past the base's edge.
  const three = (off) => {
    const ev = new EventRing(32), w = flick({ table: [10, 6], events: ev });
    w.add({ shape: "box", size: [1, 1, 1] });
    const mid = w.add({ shape: "box", size: [1, 1, 1], pos: [0.3, 0] }), top = w.add({ shape: "box", size: [1, 1, 1], pos: [off, 0] });
    w.run();
    return { w, mid, top, ev };
  };
  const ok = three(0.7);
  assert.deepEqual([ok.w.y[ok.mid], ok.w.y[ok.top], ok.ev.size], [1, 2, 1], "centre at 0.5: it stands (only flick:rest)");
  const no = three(0.8);
  assert.equal(no.ev.at(0).type, "flick:topple");
  assert.equal(no.ev.at(0).a, no.mid, "the middle box tips, carrying the top one");
  assert.deepEqual([no.w.y[no.mid], no.w.y[no.top]], [0, 0], "both end on the table");
  assert.ok(no.w.x[no.top] > no.w.x[no.mid], "the top one lands further out");
  // A hit can make a stack topple: knock the base out and the top falls.
  const h = two(0);
  const d = h.w.add({ pos: [-3, 0], size: [0.6, 0.3], mass: 4 });
  h.w.flick(d, 4 * 9, 0);
  h.w.run();
  assert.equal(h.w.on[h.top], -1, "the top box ends on the table");
  assert.ok(h.w.y[h.top] === 0, "not floating where the base was");
  // A piece set on another piece's top rests there and is carried by friction when it slides.
  const c = two(0);
  c.w.flick(c.base, 1.2, 0);
  for (let k = 0; k < 6; k++) c.w.step(1 / 60);
  assert.ok(c.w.vx[c.top] > 0, "friction drags the top along");
});

test("flick: ramps hold a piece, launch a fast one, and are walls from the tall end", () => {
  const run = (v, x = 4) => {
    const w = flick({ table: [40, 10] }), r = w.add({ shape: "ramp", size: [4, 1, 2] }), d = w.add({ pos: [x, 0], size: [0.6, 0.2] });
    w.flick(d, v, 0);
    let top = 0;
    for (let k = 0; k < 3000 && w.busy; k++) w.step(1 / 60), (top = Math.max(top, w.y[d]));
    return { w, r, d, top };
  };
  const hold = run(-6);
  assert.equal(hold.w.on[hold.d], hold.r, "it rests on the slope (tan θ 0.25 < μ 0.25 · (1 + k²))");
  close(hold.w.y[hold.d], (1 * (2 - hold.w.x[hold.d])) / 4, 1e-9, "at the slope's height");
  const fly = run(-9);
  assert.ok(fly.top > 1, `it leaves the tall end in the air: ${fly.top}`);
  assert.ok(fly.w.x[fly.d] < -4, `and lands beyond it: ${fly.w.x[fly.d]}`);
  assert.deepEqual([fly.w.on[fly.d], fly.w.y[fly.d]], [-1, 0]);
  const wall = run(5, -4);
  assert.ok(wall.w.x[wall.d] < -2.3, `from the tall end it bounces back: ${wall.w.x[wall.d]}`);
});

test("flick: sling turns a pull into a shot (two integers) and back", () => {
  const a = sling({ pull: 2, max: 10, steps: 100, turns: 4096 });
  a.begin(0, 0, -1, 0);
  assert.equal(a.active, true);
  assert.deepEqual([a.angle, a.level, a.power], [0, 50, 0.5], "pulled back 1 of 2 along −x: +x at half power");
  close(a.jx, 5, 1e-12, "jx");
  close(a.jz, 0, 1e-12, "jz");
  a.move(0, -5);
  assert.deepEqual([a.angle, a.level], [1024, 100], "pulled toward −z past full: +z at full power");
  close(a.dz, 1, 1e-15, "dz");
  close(a.dx, 0, 1e-15, "dx");
  for (let k = 0; k < 4096; k += 37) {
    a.set(k, 77);
    close(a.dx, Math.cos((k / 4096) * 2 * Math.PI), 2e-15, `cos at ${k}`);
    close(a.dz, Math.sin((k / 4096) * 2 * Math.PI), 2e-15, `sin at ${k}`);
  }
  a.move(-1.5, 0);
  assert.equal(a.end(), true);
  a.begin(0, 0, -0.05, 0);
  assert.equal(a.end(), false, "a twitch is no shot");
  a.begin(0, 0, -1, 0);
  a.cancel();
  assert.deepEqual([a.active, a.power, a.jx], [false, 0, 0]);
  assert.throws(() => sling({ pull: 0 }), RangeError);
  assert.throws(() => flick({ cap: 1.5 }), RangeError);
  const w = flick({ cap: 1 });
  w.add();
  assert.throws(() => w.add(), RangeError, "past cap");
});

test("flick: zero allocation per step, pose and sling", async (t) => {
  const minors = async (on) => {
    const { w, cue } = table(new EventRing(64)), a = sling(), out = new Float64Array(6), ob = { pos: new Float64Array(3), rot: new Float64Array(3) };
    w.run();
    const s = new Float64Array(1);
    const frame = () => {
      if (!on) return;
      if (!w.busy) {
        s[0]++;
        a.begin(w.x[cue], w.z[cue], w.x[cue] - 1.5, w.z[cue] + ((s[0] % 7) - 3) * 0.2);
        a.end();
        w.place(cue, -4, 0.05);
        w.flick(cue, a.jx, a.jz);
      }
      w.step(1 / 60);
      for (let i = 0; i < w.n; i++) w.pose(i, out);
      w.apply(cue, ob);
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  };
  const bare = await minors(false), playing = await minors(true);
  t.diagnostic(`young GCs over 20k frames (best of 3): bare ${bare}, shooting ${playing}`);
  assert.ok(playing <= bare + 1, `young-generation GCs: ${playing} shooting, ${bare} bare`);
});
