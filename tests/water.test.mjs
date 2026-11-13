// @fzlt/core/water in Node (a fake canvas): the height at (x, z, t) is deterministic and its crests roll
// along the wave's dir; the swell travels, peels and reports its crest and slope; the body is built
// as depth bands under the surface; wakes follow a moving object (speed, heading, a trail behind it);
// splash, ripple, bubbles and whirl run from fixed pools that never grow, are seeded (a replay splashes
// the same) and end: `busy` goes false once they and the idle roll are over; `still` stops the surface
// and keeps effects short; and step + draw with every effect allocate nothing. Real pixels in
// Chromium: tests/water.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { water } = await import("../src/water.ts");

/** A 2D context that counts strokes and fills (or records nothing). */
class FakeCtx {
  constructor(rec) { this.rec = rec; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; }
  setTransform() {}
  fillRect() {}
  clearRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  closePath() {}
  save() {}
  restore() {}
  clip() { if (this.rec) this.rec.clips++; }
  fill() { if (this.rec) this.rec.fills++; }
  stroke() { if (this.rec) this.rec.strokes++; }
}
function scene(opts = {}, record = true) {
  const rec = record ? { fills: 0, strokes: 0, clips: 0 } : null, ctx = new FakeCtx(rec);
  const d = diorama({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx }, { background: "#000000" });
  Object.assign(d.cam, { yaw: 0, pitch: 0.8, dist: 18, tx: 0, ty: 0, tz: 0 });
  const w = water(d, { rect: [-4, -4, 4, 4], level: 1, still: false, ...opts });
  return { d, w, rec };
}
const run = (w, sec, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(sec / dt); i++) w.step(dt);
};

test("water: the height at (x, z, t) is deterministic and its crests roll along dir", () => {
  const a = scene().w, b = scene().w;
  for (const [x, z, t] of [[0, 0, 0], [1.3, -2.2, 0.7], [-3, 3.5, 4.25]]) assert.equal(a.height(x, z, t), b.height(x, z, t), "same (x, z, t), same height");
  // The default wave: amp 0.03, crests every 2 units rolling toward +z at 0.3/s.
  let hi = -1, lo = 1;
  for (let z = -4; z <= 4; z += 0.05) (hi = Math.max(hi, a.height(0, z, 1))), (lo = Math.min(lo, a.height(0, z, 1)));
  assert.ok(hi <= 0.03 + 1e-9 && hi > 0.028 && lo < -0.028, `amp: ${lo}..${hi}`);
  // The field: crests along dir (u = z here, v = −x across), rolling at 0.3/s with a slow wobble.
  const f = (x, z, t) => 0.03 * Math.sin(Math.PI * (z - 0.3 * t + 0.2 * Math.sin(0.9 * -x + 1.3 * t + 0.85 * z)));
  for (const [x, z, t] of [[0.5, -1, 1], [2, 3, 7.5]]) assert.ok(Math.abs(a.height(x, z, t) - f(x, z, t)) < 1e-12, "the documented field");
  const r = scene({ wave: { dir: [1, 0], len: 4, amp: 0.1 } }).w;
  assert.ok(Math.abs(r.height(1, 0, 0) - 0.1 * Math.sin((Math.PI / 2) * (1 + 0.2 * Math.sin(0.85)))) < 1e-12, "dir, len and amp");
  // Its clock: height() with no t reads the surface's own time, which step() advances while it rolls.
  assert.equal(a.time, 0);
  run(a, 0.5);
  assert.ok(Math.abs(a.time - 0.5) < 1e-9);
  assert.equal(a.height(1, 2), a.height(1, 2, 0.5));
  const flat = scene({ wave: false }).w;
  assert.equal(flat.height(1, 2, 3), 0, "wave: false is flat");
  const ph = scene({ phase: 3 }).w;
  assert.equal(ph.height(1, 2, 0), a.height(1, 2, 3), "phase shifts the roll");
});

test("water: the body is depth bands under the surface band, in the given cluster and layers", () => {
  const { d, w } = scene({ bands: [{ h: 0.3, color: "#4f8fb5" }, { h: 0.2, color: "#6db0cf" }], depth: 0.25, cluster: "pool", layer: 3 });
  assert.equal(w.bodies.length, 3);
  assert.deepEqual(w.bodies.map((b) => [+b.pos[1].toFixed(3), +b.size[1].toFixed(3), b.layer, b.shape]), [[0.25, 0.3, 1, "prism"], [0.55, 0.2, 1, "prism"], [0.75, 0.25, 3, "prism"]]);
  assert.equal(w.bodies[2].alpha, 0.84);
  assert.equal(w.points.cluster, "pool");
  assert.equal(w.points.layer, 4);
  assert.equal(scene({ body: false }).w.bodies.length, 0, "body: false builds no faces");
  d.draw();
});

test("water: the swell travels across, peels along its crest, and gives its height, slope and crest", () => {
  const { w } = scene({ wave: false, swell: { amp: 0.6, width: 1.5, speed: 2, dir: [1, 0], peel: 1.5 } });
  const c = new Float64Array(3), s = new Float64Array(2);
  assert.equal(w.crest(c, 0), false, "it starts off the water (behind the far edge)");
  assert.equal(w.crest(c, 2.5), true);
  // At t = 2.5 the crest is at x = −4 − 3 + 5 = −2 along +x, its break 3.75 in from z = −4.
  assert.ok(Math.abs(c[0] + 2) < 1e-9 && Math.abs(c[1] + 0.25) < 1e-9 && c[2] === 0.6, `crest ${Array.from(c)}`);
  assert.ok(Math.abs(w.height(-2, 2, 2.5) - 0.6) < 1e-9, "unbroken: the full height on the crest");
  assert.ok(Math.abs(w.height(-2, -2, 2.5) - 0.33) < 1e-9, "broken (behind the peel): lower");
  assert.ok(w.height(-0.5, 2, 2.5) < 0.1 && w.height(-0.5, 2, 2.5) > 0, "the face ahead is steep, so low a step ahead");
  w.slope(-2.4, 2, s, 2.5);
  assert.ok(s[0] > 0.15 && Math.abs(s[1]) < 1e-6, `the back slopes up toward the crest: ${Array.from(s)}`);
  w.slope(-1.6, 2, s, 2.5);
  assert.ok(s[0] < -0.5, `the face slopes down ahead of it: ${s[0]}`);
  // Sets repeat every period (default: the crossing plus 2 s).
  const per = (8 + 4.5) / 2 + 2;
  assert.ok(Math.abs(w.height(-2, 2, 2.5 + per) - w.height(-2, 2, 2.5)) < 1e-9);
  assert.equal(scene().w.crest(c), false, "no swell: false");
});

test("water: a wake follows its object (speed, heading, the trail behind it) and fades when it stops", () => {
  const { d, w } = scene({ idle: 0.5 });
  const boat = d.add({ id: "boat", size: [2, 0.4, 0.6], pos: [-3, 1, 0], color: "#e04a3a" });
  const k = w.wake(boat);
  w.step(1 / 60);
  assert.equal(k.speed, 0, "not drawn yet: nothing to follow");
  assert.equal(k.size, 1);
  assert.equal(k.width, 0.3);
  for (let i = 0; i < 60; i++) (boat.pos[0] += 1.5 / 60), d.draw(), w.step(1 / 60);
  assert.ok(Math.abs(k.speed - 1.5) < 0.05, `speed: ${k.speed}`);
  assert.ok(Math.abs(k.hx - 1) < 1e-9 && Math.abs(k.hz) < 1e-9, "heading: the way it moves");
  assert.ok(k.n >= 10, `a trail: ${k.n} samples`);
  // Newest first, each further behind (−x) and older.
  for (let j = 1; j < k.n; j++) assert.ok(k.trail[j * 5] < k.trail[(j - 1) * 5] && k.trail[j * 5 + 4] > k.trail[(j - 1) * 5 + 4], `sample ${j} behind`);
  assert.ok(k.trail[0] <= boat.M[9] && k.trail[0] > boat.M[9] - 0.2, "the newest is at the boat");
  // A turn: the heading follows.
  for (let i = 0; i < 30; i++) (boat.pos[2] += 1 / 60), d.draw(), w.step(1 / 60);
  assert.ok(k.hz > 0.99, `turned: ${k.hz}`);
  // A jump (a respawn) starts it again from there, with no streak across the water.
  boat.pos[0] = -3, d.draw(), w.step(1 / 60);
  assert.equal(k.n, 0);
  assert.equal(k.speed, 0);
  // It stops: the trail ages out, the speed decays, and nothing keeps it busy.
  w.stir(0);
  let n = 0;
  while (w.step(1 / 60) && n < 600) d.draw(), n++;
  assert.ok(n < 200, `settles after it stops: ${n} steps`);
  assert.equal(k.n, 0);
  assert.ok(k.speed < 0.05);
  w.unwake(k);
  d.draw();
});

test("water: effects run from fixed pools, are seeded, and busy goes false when they end", () => {
  const { d, w, rec } = scene({ idle: 0.5 });
  run(w, 1);
  assert.equal(w.busy, false, "the idle roll rests after `idle` seconds");
  const t0 = w.time;
  run(w, 1);
  assert.equal(w.time, t0, "at rest the surface's clock stops");
  w.splash(0, 0);
  assert.equal(w.step(1 / 60), true);
  assert.ok(w.live >= 60, `a column, spray and a crown: ${w.live}`);
  d.draw();
  assert.ok(rec.clips >= 1 && rec.strokes > 0 && rec.fills > 0, "painted, clipped to the outline");
  // The column rises over the surface.
  let top = 0;
  for (let i = 0; i < 20; i++) w.step(1 / 60);
  for (let i = 0; i < w.points.n; i++) top = Math.max(top, w.points.y[i]);
  assert.ok(top > 2, `the column rises: ${top}`);
  let n = 0;
  while (w.step(1 / 60) && n < 1000) n++;
  assert.ok(n > 60 && n < 300, `busy until the splash, its rings and the idle roll end: ${n} steps`);
  assert.equal(w.live, 0);
  // A replay with the same seed splashes the same.
  const a = scene({ seed: 7 }).w, b = scene({ seed: 7 }).w;
  a.splash(1, 1, 1.5), b.splash(1, 1, 1.5), run(a, 0.3), run(b, 0.3);
  assert.deepEqual(Array.from(a.points.y.subarray(0, a.points.n)), Array.from(b.points.y.subarray(0, b.points.n)));
  // Pools never grow: past capacity an effect is dropped.
  const c = scene({ cap: 50, rings: 4 }).w;
  for (let i = 0; i < 20; i++) c.splash(0, 0), c.ripple(1, 1), c.bubbles(0, 0), c.whirl(0, 0);
  run(c, 0.2);
  assert.ok(c.points.n <= 50 && c.points.x.length === 50, `capped: ${c.points.n}`);
  // Bubbles and the whirlpool keep it busy while they last, then end.
  const e = scene({ idle: 0 }).w;
  e.bubbles(0, 0, 1), e.whirl(1, 1, 1.5, 1.2);
  run(e, 0.5);
  assert.ok(e.busy && e.live > 0, "bubbles breaking");
  n = 0;
  while (e.step(1 / 60) && n < 1000) n++;
  assert.ok(n < 240, `ends: ${n}`);
  e.splash(0, 0), e.clear();
  assert.equal(e.step(1 / 60), false, "clear() ends every effect");
});

test("water: still holds the surface and keeps effects short", () => {
  const { d, w } = scene({ still: true });
  run(w, 2);
  assert.equal(w.time, 0, "still: the clock never moves");
  assert.equal(w.busy, false);
  w.splash(0, 0);
  assert.ok(w.step(1 / 60) && w.live === 10, `a few drops: ${w.live}`);
  w.bubbles(0, 0), w.whirl(0, 0);
  let n = 0;
  while (w.step(1 / 60) && n < 600) n++;
  assert.ok(n < 40, `short: ${n} steps`);
  assert.equal(w.time, 0);
  // Switched on while it rolls: the surface stops where it is.
  const m = scene().w;
  run(m, 1);
  m.still = true;
  const t = m.time, h = m.height(1, 1);
  run(m, 1);
  assert.equal(m.time, t);
  assert.equal(m.height(1, 1), h);
  assert.equal(m.busy, false);
  // A boat moving on still water draws no trail.
  const boat = d.add({ size: [2, 0.4, 0.6], pos: [-3, 1, 0] }), k = w.wake(boat);
  for (let i = 0; i < 30; i++) (boat.pos[0] += 0.05), d.draw(), w.step(1 / 60);
  assert.equal(k.n, 0);
});

test("water: zero allocation per step and draw, with every effect and a wake", async (t) => {
  const minors = async (on) => {
    const { d, w } = scene({ swell: { peel: 1, dir: [1, 0] }, bands: [{ h: 0.3, color: "#4f8fb5" }], idle: Infinity }, false);
    const boat = d.add({ size: [2, 0.4, 0.6], pos: [-3, 1, 0], color: "#e04a3a" });
    w.wake(boat);
    const s = new Float64Array(2), out = new Float64Array(3);
    const frame = () => {
      s[0]++;
      boat.pos[0] = Math.sin(s[0] / 90) * 3;
      boat.pos[2] = Math.cos(s[0] / 130) * 2;
      if (!on) return;
      const f = s[0] % 240;
      if (f === 1) w.splash(Math.sin(s[0]) * 3, 1);
      if (f === 60) w.ripple(-1, 2);
      if (f === 90) w.bubbles(2, -2, 1.5);
      if (f === 120) w.whirl(-2, -1);
      w.step(1 / 60);
      s[1] += w.height(1, 1) + w.slope(0, 0, out)[0] + (w.crest(out) ? 1 : 0);
      d.draw();
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  };
  const bare = await minors(false), withWater = await minors(true);
  t.diagnostic(`young GCs over 20k frames (best of 3): bare ${bare}, water ${withWater}`);
  assert.ok(withWater <= bare + 1, `young-generation GCs: ${withWater} with water, ${bare} bare`);
});
