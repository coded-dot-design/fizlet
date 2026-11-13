// @fzlt/core/beam in Node: reflection off a mirror at any angle (out = 2φ − θ), exact on the π/4
// table, one-sided mirrors, splitters (both branches, half power each, transmitted first),
// blockers, targets (segments and circles), the board's edge, the bounce cap and capacities, the
// same parts giving the same bits, the grid, and run() and dioramaBeam's show() + a diorama draw
// allocating nothing. Real pixels and a real click in Chromium: tests/beam-cards.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { beam, dioramaBeam, MIRROR, TARGET } = await import("../src/beam.ts");
const { diorama } = await import("../src/diorama.ts");

class FakeCtx {
  constructor(rec) { this.rec = rec; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; this.lineCap = ""; }
  setTransform() {}
  fillRect() {}
  clearRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  closePath() {}
  fill() {}
  stroke() { if (this.rec) this.rec.push(this.strokeStyle); }
}
const canvas = (rec = null) => ({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => new FakeCtx(rec) });
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const ang = (x, z) => Math.atan2(z, x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test("beam: a mirror reflects at any angle (out = 2φ − θ), and the 45° table is exact", () => {
  for (let k = 0; k < 200; k++) {
    const phi = (k * 0.7316) % Math.PI, th = ((k * 1.913) % 2.4) - 1.2; // mirror angle, incoming angle
    if (Math.abs(Math.sin(phi - th)) < 0.05) continue; // grazing
    const b = beam({ bounds: [-20, -20, 20, 20] });
    b.add({ kind: "mirror", x: 0, z: 0, a: phi, len: 4 });
    b.cast(-Math.cos(th) * 5, -Math.sin(th) * 5, Math.cos(th), Math.sin(th));
    assert.ok(b.n >= 2 && b.se[0] === 0, "it hits the mirror");
    close(b.x1[0], 0, 1e-9, "at the centre x");
    close(b.z1[0], 0, 1e-9, "at the centre z");
    const out = ang(b.x1[1] - b.x0[1], b.z1[1] - b.z0[1]);
    close(wrap(out - (2 * phi - th)), 0, 1e-9, `reflected angle for φ ${phi.toFixed(3)}, θ ${th.toFixed(3)}`);
  }
  // A beam along +x off a 45° mirror goes along +z, exactly; off 135°, along −z.
  const b = beam({ bounds: [-5, -5, 5, 5] });
  b.add({ kind: "emitter", x: -4, z: 0, a: 0 });
  const m = b.add({ kind: "mirror", x: 0, z: 0, a: Math.PI / 4 });
  b.run();
  assert.deepEqual([b.n, b.x1[1], b.z1[1], b.se[1]], [2, 0, 5, -1], "to the edge at z = 5, exactly");
  b.turn(m, Math.PI / 2);
  b.run();
  assert.deepEqual([b.x1[1], b.z1[1]], [0, -5], "a quarter turn sends it to z = −5");
  // A circle mirror reflects about its normal at the hit.
  const c = beam({ bounds: [-9, -9, 9, 9] });
  c.add({ kind: "mirror", x: 0, z: 0, r: 1 });
  c.cast(-5, Math.SQRT1_2, 1, 0);
  close(c.x1[0], -Math.SQRT1_2, 1e-12, "meets the circle at 135°");
  close(ang(c.x1[1] - c.x0[1], c.z1[1] - c.z0[1]), Math.PI / 2, 1e-12, "a 45° normal turns it a right angle");
});

test("beam: one-sided mirrors block from behind", () => {
  const b = beam({ bounds: [-5, -5, 5, 5] });
  b.add({ kind: "mirror", x: 0, z: 0, a: 0, one: true }); // front faces +z: normal (0, 1)
  b.cast(0, 3, 0, -1);
  assert.equal(b.n, 2, "from the front: reflected");
  b.reset();
  b.cast(0, -3, 0, 1);
  assert.deepEqual([b.n, b.se[0]], [1, 0], "from behind: stopped at it");
});

test("beam: a splitter passes and reflects, half power each, transmitted first; targets light", () => {
  const b = beam({ bounds: [-5, -5, 5, 5] });
  b.add({ kind: "emitter", x: -4, z: 0, a: 0 });
  const sp = b.add({ kind: "splitter", x: 0, z: 0, a: Math.PI / 4 });
  const t1 = b.add({ kind: "target", x: 3, z: 0, r: 0.3 }), t2 = b.add({ kind: "target", x: 0, z: 3, len: 1 });
  b.run();
  assert.equal(b.n, 3);
  assert.deepEqual([b.se[0], b.sp[0]], [sp, 1]);
  assert.deepEqual([b.x1[1], b.z1[1], b.se[1], b.sp[1], b.sg[1]], [2.7, 0, t1, 0.5, 1], "transmitted to the round target's rim");
  assert.deepEqual([b.x1[2], b.z1[2], b.se[2], b.sp[2], b.sl[2]], [0, 3, t2, 0.5, 4], "reflected to the flat target; 4 from the emitter");
  assert.deepEqual([b.lit[t1], b.lit[t2], b.litCount(), b.nh], [1, 1, 2, 3]);
  assert.deepEqual([...b.hp.slice(0, 3)], [sp, t1, t2], "hits in trace order");
  // Two splitters in a row: four branches at a quarter power.
  b.add({ kind: "splitter", x: 2, z: 0, a: -Math.PI / 4 });
  b.run();
  assert.ok(b.sp.slice(0, b.n).includes(0.25), "a second split halves again");
});

test("beam: blockers stop it; parts behind stay dark; off parts let it pass", () => {
  const b = beam({ bounds: [-5, -5, 5, 5] });
  b.add({ kind: "emitter", x: -4, z: 0, a: 0 });
  const bl = b.add({ kind: "blocker", x: 0, z: 0, a: Math.PI / 2 }), t = b.add({ kind: "target", x: 3, z: 0, a: Math.PI / 2 });
  b.run();
  assert.deepEqual([b.n, b.se[0], b.x1[0], b.lit[t]], [1, bl, 0, 0], "stopped at the blocker");
  b.enable(bl, false);
  b.run();
  assert.deepEqual([b.n, b.se[0], b.lit[t]], [1, t, 1], "off: passes to the target");
  // The board's edge ends a free beam; an off emitter stays dark.
  const e = beam({ bounds: [-2, -1, 3, 1] });
  const em = e.add({ kind: "emitter", x: 0, z: 0, a: Math.PI / 4 });
  e.run();
  close(e.x1[0], 1, 1e-12, "edge at z = 1");
  assert.equal(e.se[0], -1);
  e.enable(em, false);
  assert.equal(e.run(), 0);
});

test("beam: the bounce cap stops a trapped beam; capacities count what they drop", () => {
  const b = beam({ bounds: [-9, -9, 9, 9], bounces: 10 });
  // A box of four mirrors and a beam inside at an angle: it would bounce for ever.
  for (const [x, z, a] of [[0, -2, 0], [0, 2, 0], [-2, 0, Math.PI / 2], [2, 0, Math.PI / 2]]) b.add({ kind: "mirror", x, z, a, len: 4 });
  b.cast(0, 0, 1, 0.37);
  assert.deepEqual([b.n, b.capped], [11, 1], "10 turns, then it stops");
  assert.deepEqual([...b.sg.slice(0, 11)], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const s = beam({ bounds: [-9, -9, 9, 9], segs: 4, bounces: 100 });
  for (const [x, z, a] of [[0, -2, 0], [0, 2, 0], [-2, 0, Math.PI / 2], [2, 0, Math.PI / 2]]) s.add({ kind: "mirror", x, z, a, len: 4 });
  s.cast(0, 0, 1, 0.37);
  assert.deepEqual([s.n, s.dropped], [4, 1], "segments past `segs` are dropped and counted");
  assert.throws(() => { const c = beam({ cap: 1 }); c.add({ kind: "mirror" }); c.add({ kind: "mirror" }); }, RangeError);
});

test("beam: the same parts give the same bits; the grid places and finds parts", () => {
  const make = () => {
    const b = beam({ grid: { cell: 1, x0: -4, z0: -3 }, bounds: [-4, -3, 4, 3] });
    b.add({ kind: "emitter", col: 0, row: 1, a: 0 });
    b.add({ kind: "mirror", col: 3, row: 1, a: Math.PI / 4 });
    b.add({ kind: "splitter", col: 3, row: 4, a: 0.3 });
    b.add({ kind: "mirror", col: 6, row: 2, a: 1.1, len: 2 });
    b.add({ kind: "target", col: 1, row: 4, r: 0.35 });
    b.run();
    return b;
  };
  const a = make(), c = make(), keys = ["x0", "z0", "x1", "z1", "sl", "sp", "sg", "se"];
  for (const k of keys) assert.deepEqual(Array.from(a[k].slice(0, a.n)), Array.from(c[k].slice(0, c.n)), k);
  assert.deepEqual([a.x[1], a.z[1]], [-0.5, -1.5], "col 3, row 1: the cell's centre");
  assert.equal(a.partAt(3, 1), 1);
  assert.equal(a.partAt(5, 5), -1);
  assert.deepEqual(Array.from(a.cellAt(-0.2, -1.1, [0, 0])), [3, 1]);
  assert.equal(a.kind[1], MIRROR);
  assert.equal(a.kind[4], TARGET);
});

test("dioramaBeam: grows out, lights the target when it gets there, sparks, then rests", () => {
  const rec = [], d = diorama(canvas(rec));
  Object.assign(d.cam, { yaw: 0, pitch: 0.9, dist: 14 });
  d.add({ id: "board", size: [10, 0.2, 8], pos: [0, -0.2, 0] });
  const b = beam({ bounds: [-5, -4, 5, 4] });
  b.add({ kind: "emitter", x: -4, z: 0, a: 0 });
  const m = b.add({ kind: "mirror", x: 2, z: 0, a: Math.PI / 4 });
  const t = b.add({ kind: "target", x: 2, z: 3, r: 0.4 });
  const lights = [], v = dioramaBeam(d, b, { on: "board", speed: 10, hold: 1, light: (p, on) => lights.push([p, on]) });
  b.run();
  let time = 0, frames = 0;
  const step = () => { time += 1 / 60; frames++; const busy = v.show(time); d.draw(); return busy; };
  step();
  assert.equal(v.on[t], 0, "not lit until the beam gets there");
  while (!v.on[t] && frames < 600) step();
  // 6 to the mirror and then 2.6 to the target's rim at 10 per second: 0.86 s.
  close(time, 0.86, 1 / 30, "lit when the grown beam reaches it");
  assert.deepEqual(lights, [[t, true]]);
  assert.ok(v.sparks.n > 0, "sparks at the hit");
  assert.ok(rec.includes("#ff3b3b") && rec.includes("#fff1ea"), "glow and core stroked");
  while (step() && frames < 900);
  assert.ok(frames < 300, `rests after the pulse's hold (${frames} frames)`);
  assert.equal(v.dots.n, 0, "the pulse faded");
  // Turn the mirror away: the target goes dark at once; turn it back: the beam regrows from the mirror only.
  b.turn(m, Math.PI / 2);
  b.run();
  step();
  assert.deepEqual(lights.at(-1), [t, false]);
  b.turn(m, -Math.PI / 2);
  b.run();
  const t0 = time;
  while (!v.on[t] && frames < 2000) step();
  close(time - t0, 0.26, 1 / 30, "regrown from the mirror (2.6 to go), not from the emitter");
  // Reduced motion: lit at once, nothing moves.
  const d2 = diorama(canvas()), still = dioramaBeam(d2, b, { on: "board", motion: false });
  d2.add({ id: "board", size: [10, 0.2, 8] });
  assert.equal(still.show(0), false);
  assert.equal(still.on[t], 1);
});

test("beam: zero allocation per run() and per show() + draw", async (t) => {
  const minors = async (on) => {
    const d = diorama(canvas()), b = beam({ grid: { cell: 1, x0: -5, z0: -4 }, bounds: [-5, -4, 5, 4] });
    Object.assign(d.cam, { yaw: 0.2, pitch: 0.9, dist: 14 });
    d.add({ id: "board", size: [10, 0.2, 8], pos: [0, -0.2, 0] });
    b.add({ kind: "emitter", col: 0, row: 3, a: 0 });
    const m = b.add({ kind: "mirror", col: 5, row: 3, a: Math.PI / 4 });
    b.add({ kind: "splitter", col: 5, row: 6, a: 0.4 });
    b.add({ kind: "target", col: 8, row: 6, r: 0.4 });
    b.add({ kind: "blocker", col: 2, row: 6, a: Math.PI / 2 });
    const v = dioramaBeam(d, b, { on: "board", hold: 0.5 });
    const s = new Float64Array(2);
    const frame = () => {
      s[0] += 1 / 60;
      s[1]++;
      if (!on) return;
      if (s[1] % 50 === 0) b.turn(m, s[1] % 100 === 0 ? 0.37 : -0.37), b.run();
      v.show(s[0]);
      d.draw();
    };
    b.run();
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  };
  const bare = await minors(false), withBeam = await minors(true);
  t.diagnostic(`young GCs over 20k frames (best of 3): bare ${bare}, tracing and drawing ${withBeam}`);
  assert.ok(withBeam <= bare + 1, `young-generation GCs: ${withBeam} with beams, ${bare} bare`);
});
