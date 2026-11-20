// @fzlt/core/rig in Node (a fake canvas): ik2 keeps both bones their length and lands on a target in
// reach (pulled in along the line when not), bending the way asked; ik3 does the same in 3D, in the
// plane nearest the normal, and its rotations, run through the diorama's own matrices, put each bone's
// +x along it and the plane's normal on its +z; `limb` poses two groups so the lower bone's tip lands on
// the target; `outset` grows an outline by e on every side; and a limb posed every frame allocates nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { ik2, ik3, limb, outset } = await import("../src/rig.ts");

class NullCtx { setTransform() {} fillRect() {} clearRect() {} beginPath() {} moveTo() {} lineTo() {} arc() {} closePath() {} fill() {} stroke() {} }
const ctx = new NullCtx();
const fake = () => ({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx });
const near = (a, b, e = 1e-6, m = "") => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);
const len = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z);

test("ik2: bones keep their lengths, the tip lands in reach, the knee bends the way asked", () => {
  const J = new Float64Array(4);
  for (const [bx, by] of [[0.5, -0.3], [-0.2, -0.6], [0.1, 0.7]]) {
    for (const bend of [1, -1]) {
      ik2(J, 0, 0, bx, by, 0.4, 0.42, bend);
      near(len(J[2], J[3]), 0.4, 1e-9, "upper");
      const ex = J[2] + Math.cos(J[1]) * 0.42, ey = J[3] + Math.sin(J[1]) * 0.42;
      near(ex, bx, 1e-6, "tip x"); near(ey, by, 1e-6, "tip y");
      near(Math.cos(J[0]) * 0.4, J[2], 1e-9); near(Math.sin(J[0]) * 0.4, J[3], 1e-9);
      // The middle joint is on the left of A→B for +1 (a positive cross product).
      const cross = bx * J[3] - by * J[2];
      assert.ok(Math.sign(cross) === bend, `bend ${bend}: cross ${cross}`);
    }
  }
  // Out of reach: straight, pulled in along the line.
  ik2(J, 0, 0, 3, 0, 1, 1);
  near(J[0], 0, 0.02); near(J[1], 0, 0.02);
  // On top of A: no NaN.
  ik2(J, 1, 1, 1, 1, 1, 1);
  assert.ok(J.every(Number.isFinite));
});

/** A world matrix from a rotation the diorama's way (R = Ry Rx Rz), columns: x, y, z axes. */
const axes = (r) => {
  const d = diorama(fake());
  const o = d.add({ id: "o", shape: "group", size: [0.1, 0, 0.1], rot: r });
  d.draw();
  const M = o.M;
  return { x: [M[0], M[3], M[6]], y: [M[1], M[4], M[7]], z: [M[2], M[5], M[8]] };
};

test("ik3: lengths, the tip, the plane, and each bone's frame through the diorama's matrices", () => {
  const K = new Float64Array(12);
  const cases = [
    [0, 0, 0, 0.3, -0.6, 0.1, 0, 0, 1, 1],
    [0.1, 0.2, -0.1, -0.4, -0.2, 0.3, 0, 1, 0, -1],
    [0, 0, 0, 0.2, 0.1, -0.5, 1, 0.3, 0.2, 1],
  ];
  for (const [ax, ay, az, bx, by, bz, nx, ny, nz, bend] of cases) {
    ik3(K, ax, ay, az, bx, by, bz, 0.4, 0.42, nx, ny, nz, bend);
    near(len(K[0] - ax, K[1] - ay, K[2] - az), 0.4, 1e-9, "upper");
    near(len(K[3] - K[0], K[4] - K[1], K[5] - K[2]), 0.42, 1e-6, "lower");
    near(K[3], bx, 1e-6); near(K[4], by, 1e-6); near(K[5], bz, 1e-6);
    for (const [o, from, to] of [[6, [ax, ay, az], [K[0], K[1], K[2]]], [9, [K[0], K[1], K[2]], [K[3], K[4], K[5]]]]) {
      const A = axes([K[o], K[o + 1], K[o + 2]]), dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], l = len(dx, dy, dz);
      near(A.x[0], dx / l, 1e-9, "x"); near(A.x[1], dy / l, 1e-9, "y"); near(A.x[2], dz / l, 1e-9, "z");
      // The z axis is square to both bones (the limb plane's normal) and on n's side.
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      near(A.z[0] * ux + A.z[1] * uy + A.z[2] * uz, 0, 1e-9, "z ⊥ AB");
      assert.ok(A.z[0] * nx + A.z[1] * ny + A.z[2] * nz > 0, "z on n's side");
    }
  }
  // The same plane as ik2 with n = +z: the same joints.
  const J = new Float64Array(4);
  ik2(J, 0, 0, 0.5, -0.3, 0.4, 0.42, -1);
  ik3(K, 0, 0, 0, 0.5, -0.3, 0, 0.4, 0.42, 0, 0, 1, -1);
  near(K[0], J[2], 1e-9); near(K[1], J[3], 1e-9); near(K[2], 0, 1e-12);
  near(K[8], J[0], 1e-9); near(K[11], J[1], 1e-9);
  // Degenerate: the normal along the line, the target on the root: finite.
  ik3(K, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1);
  assert.ok(K.every(Number.isFinite));
  ik3(K, 0, 0, 0, 0, 0, 0, 1, 1);
  assert.ok(K.every(Number.isFinite));
});

test("limb: the lower bone's tip, through the scene's matrices, lands on the target", () => {
  const d = diorama(fake());
  d.add({ id: "body", shape: "group", size: [0.5, 0, 0.5], pos: [1, 2, -1], rot: [0.2, 0.7, -0.1] });
  const leg = limb(d, "leg", { on: "body", l1: 0.4, l2: 0.42, normal: [0, 0, 1], bend: 1 });
  const shin = d.add({ id: "shin", shape: "box", size: [0.42, 0.05, 0.05], pos: [0.21, 0, 0], on: "leg:b" });
  for (const [bx, by, bz] of [[0.3, -0.6, 0.1], [-0.2, -0.5, -0.2], [0.6, 0.2, 0]]) {
    leg.reach(0, 0, 0, bx, by, bz);
    d.draw();
    const B = d.get("body").M, M = leg.b.M;
    // The target in world space, and the lower bone's tip (its origin plus l2 along its +x).
    const tw = [B[9] + B[0] * bx + B[1] * by + B[2] * bz, B[10] + B[3] * bx + B[4] * by + B[5] * bz, B[11] + B[6] * bx + B[7] * by + B[8] * bz];
    const tip = [M[9] + M[0] * 0.42, M[10] + M[3] * 0.42, M[11] + M[6] * 0.42];
    for (let i = 0; i < 3; i++) near(tip[i], tw[i], 1e-6, "tip");
    // The upper bone ends where the lower begins.
    const A = leg.a.M;
    for (let i = 0; i < 3; i++) near(A[9 + i] + A[i * 3] * 0.4, M[9 + i], 1e-9, "joint");
    assert.ok(shin.M.every(Number.isFinite));
  }
});

test("outset: every edge moves out by e (either winding)", () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const P of [sq, [...sq].reverse()]) {
    const G = outset(P, 0.1);
    const xs = G.map((p) => p[0]), ys = G.map((p) => p[1]);
    near(Math.min(...xs), -0.1, 1e-9); near(Math.max(...xs), 1.1, 1e-9);
    near(Math.min(...ys), -0.1, 1e-9); near(Math.max(...ys), 1.1, 1e-9);
  }
});

test("limb: zero allocation posing four limbs every frame (100k frames)", async (t) => {
  const d = diorama(fake());
  d.add({ id: "r", shape: "group", size: [0.5, 0, 0.5] });
  const L = [0, 1, 2, 3].map((i) => limb(d, "l" + i, { on: "r", l1: 0.4, l2: 0.4, bend: i & 1 ? 1 : -1, normal: [0, i * 0.2, 1] }));
  const J = new Float64Array(4);
  let f = 0;
  const frames = (n, on) => {
    for (let k = 0; k < n; k++, f++) {
      if (!on) continue;
      for (let i = 0; i < 4; i++) L[i].reach(0, 0, i * 0.1, 0.3 * Math.sin(f * 0.01 + i), -0.5, 0.1 * Math.cos(f * 0.02));
      ik2(J, 0, 0, Math.sin(f * 0.01), -0.6, 0.4, 0.4, 1);
    }
  };
  frames(2000, true);
  const bare = await minorGCs(() => frames(100000, false));
  const posed = await minorGCs(() => frames(100000, true));
  t.diagnostic(`young GCs over 100k frames (best of 3 windows): bare ${bare}, posed ${posed}`);
  assert.ok(posed <= bare, `posing allocates: ${posed} young GCs (bare ${bare})`);
});
