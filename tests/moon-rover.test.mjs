// Moon Rover's orb and run, headless (site/gallery/pieces/orb/): the sphere maths (diorama angles
// from a matrix and back, tangent frames, a crack-free geodesic shell), the drive chart on a smooth
// ball (straight ahead goes round the whole moon and comes back, the frame stays square, the car
// stays on the surface), the run's rules (beacons in order, the night spawns chasers, a bolt brings
// one down, a friend reacts and gives), determinism (the same inputs give the same bytes) and zero
// allocation per step (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const O = await import("../site/gallery/pieces/orb/orb.ts");
const M = await import("../site/gallery/pieces/orb/moon-run.ts");

/** diorama's M = Ry · Rx · Rz from [x, y, z]. */
function fromEuler([x, y, z]) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const a = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx], r = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return O.mul3(a, r, new Float64Array(9));
}

test("orb: euler() gives diorama's angles back for any rotation, at the poles too", () => {
  const o = O.orb(), F = new Float64Array(9), C = new Float64Array(9), e = new Float64Array(3);
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const u = [Math.sin(i * 1.7) * Math.cos(i * 0.3), Math.cos(i * 1.7), Math.sin(i * 1.7) * Math.sin(i * 0.3)];
    if (i % 50 === 0) (u[0] = 0), (u[1] = 0), (u[2] = i % 100 ? 1 : -1); // the gimbal case: up along ±z
    const l = Math.hypot(...u);
    o.frame(u[0] / l, u[1] / l, u[2] / l, Math.cos(i), 0.3, Math.sin(i), F);
    O.columns(F, C);
    const back = fromEuler(O.euler(C, e));
    for (let k = 0; k < 9; k++) worst = Math.max(worst, Math.abs(back[k] - C[k]));
    // The frame is a rotation: rows unit and square, e2 = e1 × up.
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const d = F[a * 3] * F[b * 3] + F[a * 3 + 1] * F[b * 3 + 1] + F[a * 3 + 2] * F[b * 3 + 2];
      assert.ok(Math.abs(d - (a === b ? 1 : 0)) < 1e-12, "frame orthonormal");
    }
  }
  assert.ok(worst < 1e-9, `round trip error ${worst}`);
});

test("orb: the geodesic shell is closed: 20·f² tiles, shared corners, normals to the sky", () => {
  const o = O.orb({ radius: 30, seed: 3 }), f = 9, T = o.tiles(f);
  assert.equal(T.n, 20 * f * f);
  const keys = new Set();
  for (let i = 0; i < T.n * 3; i++) keys.add(T.corners.slice(i * 3, i * 3 + 3).join());
  // Euler: V − E + F = 2 with E = 3F/2 → V = F/2 + 2, every corner exactly the same float from every tile.
  assert.equal(keys.size, T.n / 2 + 2, "corners shared bit for bit (no cracks)");
  for (let i = 0; i < T.n; i++) {
    const c = T.centre.subarray(i * 3, i * 3 + 3), n = T.normal.subarray(i * 3, i * 3 + 3);
    assert.ok((c[0] * n[0] + c[1] * n[1] + c[2] * n[2]) / Math.hypot(...c) > 0.8, "normal points out");
  }
  // The surface is seeded: the same seed, the same heights; another seed, other heights.
  const a = O.orb({ seed: 5 }), b = O.orb({ seed: 5 }), c = O.orb({ seed: 6 });
  let same = true, diff = false;
  for (let i = 0; i < 500; i++) {
    const x = Math.sin(i), y = Math.cos(i * 1.3), z = Math.sin(i * 0.7), l = Math.hypot(x, y, z);
    same &&= a.height(x / l, y / l, z / l) === b.height(x / l, y / l, z / l);
    diff ||= a.height(x / l, y / l, z / l) !== c.height(x / l, y / l, z / l);
  }
  assert.ok(same && diff);
});

test("orb chart: straight ahead on a smooth ball goes all the way round and comes back", async () => {
  const { drive } = await import("../src/drive.ts");
  const R = 30, o = O.orb({ radius: R, craters: 0, hills: 0 }), G = o.chart(), car = drive(G, { gravity: 14, top: 12 });
  const u0 = [0, 1, 0];
  G.at(u0, [1, 0, 0]);
  car.reset(0, 0, 0);
  const P = new Float64Array(3);
  let dist = 0, worstH = 0, lastX = 0, lastY = 0, lastZ = 0, minDot = 1, back = Infinity;
  G.toOrb(car.pos[0], car.pos[1], car.pos[2], P);
  [lastX, lastY, lastZ] = P;
  for (let i = 0; i < 60 * 40; i++) {
    car.set(1, 0, 0);
    car.step(1 / 60);
    G.recentre(car);
    G.toOrb(car.pos[0], car.pos[1], car.pos[2], P);
    dist += Math.hypot(P[0] - lastX, P[1] - lastY, P[2] - lastZ);
    [lastX, lastY, lastZ] = P;
    const l = Math.hypot(...P);
    worstH = Math.max(worstH, Math.abs(l - R - (car.rest + car.radius)));
    minDot = Math.min(minDot, P[1] / l);
    if (dist > 2 * Math.PI * R * 0.9) back = Math.min(back, Math.hypot(P[0] / l - u0[0], P[1] / l - u0[1], P[2] / l - u0[2]) * R);
    const F = G.F;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const d = F[a * 3] * F[b * 3] + F[a * 3 + 1] * F[b * 3 + 1] + F[a * 3 + 2] * F[b * 3 + 2];
      assert.ok(Math.abs(d - (a === b ? 1 : 0)) < 1e-9, "the chart stays square");
    }
    if (dist > 2 * Math.PI * R * 1.1) break;
  }
  assert.ok(minDot < -0.99, "it reached the far pole");
  assert.ok(back < 1.5, `back where it started (${back.toFixed(2)} units off after a lap)`);
  assert.ok(worstH < 0.6, `on the surface all the way (${worstH.toFixed(3)})`);
});

const step = (r, I, n) => {
  for (let i = 0; i < n && r.S[M.PH] !== M.DONE; i++) (r.autopilot(I), r.step(1 / 60, I), r.clear());
};

test("moon run: the autopilot lights the beacons in order, the night brings chasers, bolts bring them down", () => {
  const r = M.moonRun(), I = new Float64Array(6), seen = new Set(), order = [];
  let lat0 = 90, lat1 = -90;
  const lons = new Set();
  for (let i = 0; i < 60 * 70 && r.S[M.PH] !== M.DONE; i++) {
    r.autopilot(I);
    r.step(1 / 60, I);
    for (let k = 0; k < r.n; k++) {
      const t = r.ev[k * 5];
      seen.add(t);
      if (t === M.E_BEACON) order.push(r.ev[k * 5 + 1]);
    }
    r.clear();
    const u = r.U, lat = Math.asin(u[1]) * 57.3, lon = Math.atan2(u[2], u[0]) * 57.3;
    lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat);
    lons.add(Math.floor((lon + 180) / 45));
    if (r.S[M.LAPS] >= 1) break;
  }
  assert.deepEqual(order.slice(0, 7), [1, 2, 3, 4, 5, 6, 7], "beacons in order");
  assert.equal(r.S[M.LAPS], 1, "a lap of the moon");
  assert.ok(seen.has(M.E_DARK) && seen.has(M.E_SPAWN), "the night side spawns chasers");
  assert.ok(seen.has(M.E_KILL), "a bolt brought one down");
  assert.ok(lat1 - lat0 > 60 && lons.size === 8, `round the whole moon: latitudes ${lat0.toFixed(0)}..${lat1.toFixed(0)}, ${lons.size}/8 longitudes`);
});

test("moon run: a friend on the light side reacts once and gives; a crystal counts once", () => {
  const r = M.moonRun(), I = new Float64Array(6);
  for (let i = 0; i < M.FRIENDS; i++) assert.ok(r.day(r.friend[i * 3], r.friend[i * 3 + 1], r.friend[i * 3 + 2]) > 0.2, "friends live on the light side");
  // Teleport next to friend 0 (the chart under the rover), then a step.
  const f = r.friend.subarray(0, 3);
  r.chart.at(f, [0.3, 1, 0.2]);
  r.car.reset(0, 0, 0);
  I[M.IN_GAS] = 1;
  r.step(1 / 60, I);
  let got = -1;
  for (let k = 0; k < r.n; k++) if (r.ev[k * 5] === M.E_FRIEND) got = r.ev[k * 5 + 1];
  r.clear();
  assert.equal(got, 0 * 4 + M.G_BOOST, "friend 0 gives a boost first");
  assert.ok(r.fReact[0] > 0 && r.S[M.MET] === 1);
  r.step(1 / 60, I);
  assert.equal(r.S[M.MET], 1, "once, then a cooldown");
});

test("moon run: the same inputs give the same run, bit for bit", () => {
  const a = M.moonRun(), b = M.moonRun(), I = new Float64Array(6);
  step(a, I, 60 * 50);
  step(b, I, 60 * 50);
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
  assert.deepEqual(Array.from(a.car.state), Array.from(b.car.state));
  assert.deepEqual(Array.from(a.SH), Array.from(b.SH));
  assert.ok(a.S[M.SCORE] > 0);
});

test("moon run: a whole session allocates nothing", async () => {
  const r = M.moonRun(), I = new Float64Array(6);
  const work = () => { for (let k = 0; k < 2; k++) { r.reset(); step(r, I, 60 * 80); } };
  work();
  const n = await minorGCs(work);
  assert.ok(n <= 1, `young-generation GCs over 2 sessions: ${n}`);
});
