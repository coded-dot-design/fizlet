// @fzlt/core/dice in Node: `roll` is seeded (same seed, same values; any sides), fair over many seeds;
// `dice().roll` makes the same path from the same seed, lands flat on the value `roll` gives, never
// dips under the floor, moves smoothly; a pop starts where the dice rest and stays under the dome;
// `euler` turns a quaternion into diorama's rot; `dioramaDice` paints exactly the landed value's pips
// on the top face; and roll, pose, show and a diorama draw allocate nothing. Real pixels in
// Chromium: tests/dice-track.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { roll, dice, faceUp, euler, dioramaDice, popDome } = await import("../src/dice.ts");
const { diorama } = await import("../src/diorama.ts");

/** A 2D context that records each pip fill as [arcs, the face's screen area] when `rec` is set. */
class FakeCtx {
  constructor(rec) { this.rec = rec; this.arcs = 0; this.det = 0; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; }
  setTransform(a, b, c, d) { this.det = Math.abs(a * d - b * c); }
  fillRect() {}
  clearRect() {}
  beginPath() { this.arcs = 0; }
  moveTo() {}
  lineTo() {}
  arc() { this.arcs++; }
  ellipse() {}
  closePath() {}
  fill() { if (this.rec && this.fillStyle === "#1d1b22") this.rec.push([this.arcs, this.det]); }
  stroke() {}
}
const canvas = (rec = null) => ({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => new FakeCtx(rec) });

/** The rotation matrix rows of quaternion q at qi. */
function mat(q, qi = 0) {
  const [x, y, z, w] = [q[qi], q[qi + 1], q[qi + 2], q[qi + 3]];
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
/** Diorama's rot (applied y, then x, then z): R = Ry · Rx · Rz. */
function fromEuler([a, b, c]) {
  const cx = Math.cos(a), sx = Math.sin(a), cy = Math.cos(b), sy = Math.sin(b), cz = Math.cos(c), sz = Math.sin(c);
  const A = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx], Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1], R = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.push(A[i * 3] * Z[j] + A[i * 3 + 1] * Z[3 + j] + A[i * 3 + 2] * Z[6 + j]);
  return R;
}
const NORMAL = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, 0, 1], 4: [0, 0, -1] };

test("roll: the same seed gives the same values; any sides; the total", () => {
  const a = new Int32Array(5), b = new Int32Array(5);
  for (let seed = 0; seed < 200; seed++) {
    const ta = roll(seed, 5, 6, a), tb = roll(seed, 5, 6, b);
    assert.deepEqual([...a], [...b]);
    assert.equal(ta, tb);
    assert.equal(ta, a.reduce((s, v) => s + v, 0));
    for (const v of a) assert.ok(v >= 1 && v <= 6);
  }
  const d20 = new Set();
  for (let seed = 0; seed < 2000; seed++) d20.add(roll(seed, 1, 20));
  assert.deepEqual([...d20].sort((x, y) => x - y), Array.from({ length: 20 }, (_, i) => i + 1), "a d20 shows 1..20");
  assert.equal(roll(-1, 1, 6), roll(0xffffffff, 1, 6), "seeds are taken as 32-bit");
  // Neighbouring seeds (turn numbers) do not give runs of one value.
  const run = Array.from({ length: 12 }, (_, i) => roll(1000 + i));
  assert.ok(new Set(run).size >= 4, `seeds 1000..1011 roll ${run}`);
});

test("roll: fair over 60,000 seeds (chi-square), and two dice add up like two dice", () => {
  const N = 60000, c = new Array(6).fill(0), sums = new Array(13).fill(0), out = new Int32Array(2);
  for (let s = 0; s < N; s++) c[roll(s) - 1]++, sums[roll(s * 7919 + 3, 2, 6, out)]++;
  const chi = c.reduce((t, k) => t + (k - N / 6) ** 2 / (N / 6), 0);
  assert.ok(chi < 20.5, `chi-square ${chi.toFixed(2)} over 5 degrees of freedom (p = 0.001 at 20.5): ${c}`);
  const p7 = sums[7] / N;
  assert.ok(Math.abs(p7 - 1 / 6) < 0.01, `P(7) with two dice ${p7.toFixed(4)}`);
  assert.ok(Math.abs(sums[2] / N - 1 / 36) < 0.004 && Math.abs(sums[12] / N - 1 / 36) < 0.004, "snake eyes and boxcars about 1 in 36");
});

test("dice: same seed, same values and the same path, bit for bit; the values are roll()'s", () => {
  const a = dice({ count: 3 }), b = dice({ count: 3 }), v = new Int32Array(3);
  for (const seed of [1, 2, 99, 123456789]) {
    const t = { from: [-5, 1], to: [0, 0] };
    assert.equal(a.roll(seed, t), b.roll(seed, t));
    assert.deepEqual(a.path, b.path, "identical paths");
    assert.equal(a.total, roll(seed, 3, 6, v));
    assert.deepEqual([...a.value], [...v]);
  }
  const p1 = a.path.slice();
  a.roll(2, { from: [-5, 1] });
  assert.notDeepEqual(a.path, p1, "another seed, another path");
  assert.equal(a.frames, Math.ceil(1.4 * 60) + 1);
});

test("dice: every roll lands flat on its value, never under the floor, and moves smoothly", () => {
  const dc = dice({ count: 3, size: 1 }), F = dc.frames, corner = [-0.5, 0.5];
  let worst = 0, sink = 0;
  for (let seed = 0; seed < 1500; seed++) {
    dc.roll(seed, { pop: seed % 3 === 0, from: [-4, seed % 5], to: [0, 0] });
    for (let i = 0; i < 3; i++) {
      const end = (i * F + F - 1) * 7;
      assert.equal(faceUp(dc.path, end + 3), dc.value[i], `seed ${seed} die ${i}: the face up is the value`);
      const R = mat(dc.path, end + 3), n = NORMAL[dc.value[i]];
      const up = R[3] * n[0] + R[4] * n[1] + R[5] * n[2];
      assert.ok(up > 1 - 1e-9, `flat: the value's face points up (${up})`);
      assert.ok(Math.abs(dc.path[end + 1] - 0.5) < 1e-12, "resting on the floor");
      for (let f = 0; f < F; f++) {
        const j = (i * F + f) * 7, M = mat(dc.path, j + 3);
        let low = Infinity;
        for (const x of corner) for (const y of corner) for (const z of corner) low = Math.min(low, dc.path[j + 1] + M[3] * x + M[4] * y + M[5] * z);
        sink = Math.min(sink, low);
        if (f) worst = Math.max(worst, Math.hypot(dc.path[j] - dc.path[j - 7], dc.path[j + 1] - dc.path[j - 6], dc.path[j + 2] - dc.path[j - 5]));
      }
    }
  }
  assert.ok(sink > -1e-9, `the lowest corner never goes under the floor (${sink})`);
  assert.ok(worst < 0.8, `no frame moves a die more than 0.8 units (${worst.toFixed(3)})`);
});

test("dice: pose reads the path (unit quaternions, rest after the duration); a pop starts at rest", () => {
  const dc = dice({ count: 2 }), out = new Float64Array(7), F = dc.frames;
  dc.roll(5, { from: [-4, 0] });
  assert.equal(dc.pose(0, 0.5, out), true, "moving at 0.5 s");
  assert.ok(Math.abs(Math.hypot(out[3], out[4], out[5], out[6]) - 1) < 1e-12);
  assert.equal(dc.pose(1, 9, out), false, "at rest after the duration");
  assert.deepEqual([...out], [...dc.path.subarray((F + F - 1) * 7, (F + F) * 7)], "the last sample");
  dc.pose(0, 0, out);
  assert.deepEqual([...out].slice(0, 3), [...dc.path.subarray(0, 3)]);
  const rest = [0, 1].map((i) => [...dc.path.subarray((i * F + F - 1) * 7, (i * F + F) * 7)]);
  dc.roll(6, { pop: true });
  for (const i of [0, 1]) {
    const now = dc.path.subarray(i * F * 7, i * F * 7 + 7), A = mat(now, 3), B = mat(rest[i], 3);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(now[k] - rest[i][k]) < 1e-9, `die ${i}: a pop starts where it rested`);
    for (let k = 0; k < 9; k++) assert.ok(Math.abs(A[k] - B[k]) < 1e-9, `die ${i}: turned as it rested`);
  }
});

test("euler: the quaternion as diorama's rot (Ry · Rx · Rz), the straight-up case included", () => {
  const out = new Float64Array(3), q = new Float64Array(4);
  for (let k = 0; k < 300; k++) {
    const u1 = (k * 0.618) % 1, u2 = ((k * 0.414) % 1) * 2 * Math.PI, u3 = ((k * 0.732) % 1) * 2 * Math.PI;
    q.set([Math.sqrt(1 - u1) * Math.sin(u2), Math.sqrt(1 - u1) * Math.cos(u2), Math.sqrt(u1) * Math.sin(u3), Math.sqrt(u1) * Math.cos(u3)]);
    const A = mat(q), B = fromEuler(euler(q, out));
    for (let i = 0; i < 9; i++) assert.ok(Math.abs(A[i] - B[i]) < 1e-9, `k ${k} entry ${i}: ${A[i]} vs ${B[i]}`);
  }
  // A quarter turn about x (pitch at ±90°: the gimbal case).
  q.set([Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  const A = mat(q), B = fromEuler(euler(q, out));
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(A[i] - B[i]) < 1e-6);
});

test("dioramaDice: seen from above, the top face shows exactly the landed value's pips", () => {
  for (const seed of [3, 4, 5, 6, 7, 8, 9, 10]) {
    const rec = [], d = diorama(canvas(rec));
    Object.assign(d.cam, { yaw: 0.3, pitch: 1.5, dist: 14, tx: 0, ty: 0, tz: 0, fov: 0.6 });
    d.add({ id: "floor", size: [12, 0.2, 12], pos: [0, -0.2, 0], color: "#2f7d5b" });
    const dc = dice({ count: 2 }), v = dioramaDice(d, dc, { on: "floor" });
    dc.roll(seed, { from: [-4, 0], to: [0, 0] });
    d.draw();
    v.show(0.3);
    rec.length = 0;
    d.draw();
    assert.ok(rec.length >= 2, "pips painted while it tumbles");
    assert.equal(v.show(5), false, "at rest");
    d.draw();
    rec.length = 0;
    d.draw();
    // The faces turned up face the camera square on; the sides (seen in perspective) are thin slivers.
    const big = Math.max(...rec.map((r) => r[1])), up = rec.filter((r) => r[1] > big * 0.5).map((r) => r[0]);
    assert.ok(rec.every((r) => r[1] > big * 0.5 || r[1] < big * 0.2), "top faces and side faces tell apart");
    assert.deepEqual(up.sort(), [...dc.value].sort(), `seed ${seed}: pips on the faces turned up are the values ${[...dc.value]}`);
    assert.ok(Math.abs(v.groups[0].pos[1] - 0.5) < 1e-12 && v.groups[1].hidden === false);
    dc.n = 1;
    v.show(5);
    assert.equal(v.groups[1].hidden, true, "dice past n are hidden");
  }
});

test("popDome: press pops from rest, every frame stays inside the dome, lands on roll()'s value", () => {
  const d = diorama(canvas()), dc = dice({ count: 1 });
  d.add({ id: "floor", size: [12, 0.2, 12], color: "#2f7d5b" });
  const dome = popDome(d, dc, { on: "floor", at: [2, 1] }), R = 2.6, F = dc.frames;
  for (let seed = 0; seed < 300; seed++) {
    assert.equal(dome.press(seed), roll(seed, 1, 6));
    for (let f = 0; f < F; f++) {
      const j = f * 7, M = mat(dc.path, j + 3);
      let top = -Infinity, far = 0;
      for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
        const cx = dc.path[j] + M[0] * x + M[1] * y + M[2] * z, cy = dc.path[j + 1] + M[3] * x + M[4] * y + M[5] * z, cz = dc.path[j + 2] + M[6] * x + M[7] * y + M[8] * z;
        top = Math.max(top, cy);
        far = Math.max(far, Math.hypot(cx, cz, Math.max(0, cy)));
      }
      assert.ok(far < R, `seed ${seed} frame ${f}: inside the dome (${far.toFixed(3)} < ${R})`);
    }
    assert.equal(faceUp(dc.path, (F - 1) * 7 + 3), dc.value[0]);
  }
  assert.equal(dome.show(0.05), true);
  assert.ok(dome.plinth.pos[1] < 0, "the dome dips as it is pressed");
  assert.equal(dome.show(5), false);
  assert.ok(dome.plinth.pos[1] === 0, "back up when it is over");
});

test("dice: zero allocation per roll, pose and show + draw", async (t) => {
  const minors = async (on) => {
    const d = diorama(canvas()), dc = dice({ count: 2 }), dc1 = dice({ count: 1 }), out = new Float64Array(7), from = new Float64Array([-4, 0]), th = { from };
    Object.assign(d.cam, { yaw: 0.3, pitch: 0.8, dist: 18 });
    d.add({ id: "floor", size: [12, 0.2, 12], pos: [0, -0.2, 0], color: "#2f7d5b" });
    const v = dioramaDice(d, dc, { on: "floor" }), dome = popDome(d, dc1, { on: "floor", at: [3, 2] });
    const s = new Float64Array(2);
    const frame = () => {
      s[1] += 1 / 60;
      if (s[1] > 1.6) (s[1] = 0), s[0]++;
      if (!on) return;
      if (s[1] === 1 / 60) dc.roll(s[0], th), dome.press(s[0]);
      dc.pose(0, s[1], out);
      v.show(s[1]);
      dome.show(s[1]);
      d.draw();
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  };
  const bare = await minors(false), withDice = await minors(true);
  t.diagnostic(`young GCs over 20k frames (best of 3): bare ${bare}, rolling and drawing ${withDice}`);
  assert.ok(withDice <= bare + 1, `young-generation GCs: ${withDice} with dice, ${bare} bare`);
});
