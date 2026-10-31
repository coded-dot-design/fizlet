// fizlet/steer (Node, headless): seek, wander and arrive move exactly like the DOM Battlefield Blitz
// tanks they replace (frame by frame, same seed), flee and patrol are that same drive pointed
// away / along a route, and none allocates per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { steer, turn, hypot } = await import("../src/steer.ts");
const { seeded } = await import("../src/kernel/random.ts");

// ---- DOM Battlefield Blitz (dom-battlefield-blitz src/game.ts @ b60931a, MIT): the code steer replaces.
const W = 960, H = 640, scale = 1.4;
const wall = { l: 400, t: 200, r: 520, b: 330 };
const blocked = (x, y, rad) => x + rad > wall.l && x - rad < wall.r && y + rad > wall.t && y - rad < wall.b;
const bTurn = (from, to, max) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.sign(d) * Math.min(Math.abs(d), max);
};
function drive(t, ax, ay, dt) {
  const m = Math.min(1, Math.hypot(ax, ay));
  if (m < 0.05) return;
  t.a = bTurn(t.a, Math.atan2(ay, ax), 7 * dt);
  const sp = 150 * m * (scale / 1.4) * dt, nx = t.x + Math.cos(t.a) * sp, ny = t.y + Math.sin(t.a) * sp, rad = 14 * scale;
  if (!blocked(nx, t.y, rad)) t.x = nx;
  if (!blocked(t.x, ny, rad)) t.y = ny;
}
/** bot(): a practice MOVER rolls about (game.ts 768–771). */
function mover(t, dt, R) {
  if ((t.think -= dt) <= 0) (t.think = 2 + R() * 2), (t.gx = 60 + R() * (W - 120)), (t.gy = 90 + R() * (H - 160));
  const dx = t.gx - t.x, dy = t.gy - t.y, d = Math.hypot(dx, dy);
  if (d > 16) drive(t, dx / d, dy / d, dt * 0.55);
}
/** bot(): drive to the goal it picked (game.ts 808–813). */
function chase(t, dt) {
  const dx = t.gx - t.x, dy = t.gy - t.y, d = Math.hypot(dx, dy);
  if (d > 16) drive(t, dx / d, dy / d, dt * 0.85);
}
/** follow(): a wingman closes on its slot behind the leader (game.ts 760–761). */
function slot(t, gx, gy, dt) {
  const dx = gx - t.x, dy = gy - t.y, d = Math.hypot(dx, dy);
  if (d > 14) drive(t, dx / d, dy / d, dt * (d > 140 ? 1.05 : 0.8));
}
// ----

const mk = (random) =>
  steer({ cap: 4, scale: scale / 1.4, area: [60, 90, W - 120, H - 160], blocked: (_, at) => blocked(at[0], at[1], 14 * scale), random });
const same = (s, i, t, f, what) => assert.deepEqual([s.x[i], s.y[i], s.a[i]], [t.x, t.y, t.a], `${what}: frame ${f}`);

test("turn: the same angle as Blitz's turn()", () => {
  const R = seeded(7);
  for (let k = 0; k < 10000; k++) {
    const f = (R() - 0.5) * 20, to = (R() - 0.5) * 20, m = R() * 0.3;
    assert.equal(turn(f, to, m), bTurn(f, to, m));
  }
});

test("hypot: the same bits as Math.hypot (it replaces it so no call boxes a number)", () => {
  const R = seeded(11);
  for (let k = 0; k < 200000; k++) {
    const a = (R() - 0.5) * 2 ** ((R() * 60 - 30) | 0), b = (R() - 0.5) * 2 ** ((R() * 60 - 30) | 0);
    assert.ok(Object.is(hypot(a, b), Math.hypot(a, b)), `${a}, ${b}`);
  }
  for (const [a, b] of [[0, 0], [-0, 0], [NaN, 1], [1, NaN], [Infinity, NaN], [NaN, -Infinity], [3, 4], [1e308, 1e308], [5e-324, 0]])
    assert.ok(Object.is(hypot(a, b), Math.hypot(a, b)), `${a}, ${b}`);
});

test("wander: frame by frame the same as a Blitz practice mover (same seed, walls)", () => {
  const dt = 1 / 60, s = mk(seeded(42)), R = seeded(42);
  const t = { x: 300, y: 300, a: 0.3, think: 0, gx: 300, gy: 300 };
  s.place(0, 300, 300, 0.3);
  let moved = 0;
  for (let f = 0; f < 60 * 120; f++) {
    mover(t, dt, R);
    s.wander(0, dt, 0.55);
    moved += s.moved[0];
    same(s, 0, t, f, "wander");
    assert.equal(s.think[0], t.think);
  }
  assert.ok(moved > 2000, `it went places (${moved | 0} px)`);
});

test("seek: frame by frame the same as a Blitz bot driving to its goal", () => {
  const dt = 1 / 60, s = mk(), R = seeded(3);
  const t = { x: 100, y: 500, a: 2, gx: 0, gy: 0 };
  s.place(0, 100, 500, 2);
  for (let f = 0; f < 60 * 60; f++) {
    if (f % 90 === 0) (t.gx = 40 + R() * (W - 80)), (t.gy = 70 + R() * (H - 120));
    chase(t, dt);
    s.seek(0, t.gx, t.gy, dt, 0.85);
    same(s, 0, t, f, "seek");
  }
});

test("arrive: frame by frame the same as a Blitz wingman closing on its slot", () => {
  const dt = 1 / 60, s = mk();
  const t = { x: 80, y: 80, a: 0 };
  s.place(0, 80, 80, 0);
  for (let f = 0; f < 60 * 60; f++) {
    // the leader circles, so the slot moves: far, near and inside the stop band all happen
    const gx = 480 + Math.cos(f / 200) * 380 * (f % 1200 < 600 ? 1 : 0.1), gy = 320 + Math.sin(f / 200) * 260;
    slot(t, gx, gy, dt);
    s.arrive(0, gx, gy, dt);
    same(s, 0, t, f, "arrive");
  }
});

test("arriveGoal: the goal from gx/gy, frame by frame the same as arrive and a Blitz wingman", () => {
  const dt = 1 / 60, s = mk(), u = mk();
  const t = { x: 80, y: 80, a: 0 };
  s.place(0, 80, 80, 0);
  u.place(0, 80, 80, 0);
  for (let f = 0; f < 60 * 60; f++) {
    const gx = 480 + Math.cos(f / 200) * 380 * (f % 1200 < 600 ? 1 : 0.1), gy = 320 + Math.sin(f / 200) * 260;
    slot(t, gx, gy, dt);
    s.gx[0] = gx;
    s.gy[0] = gy;
    s.arriveGoal(0, dt);
    u.arrive(0, gx, gy, dt);
    same(s, 0, t, f, "arriveGoal");
    assert.deepEqual([s.x[0], s.y[0], s.a[0], s.moved[0]], [u.x[0], u.y[0], u.a[0], u.moved[0]], `arriveGoal vs arrive: frame ${f}`);
  }
});

test("flee: Blitz's drive pointed away, until `far`", () => {
  const dt = 1 / 60, s = mk();
  const t = { x: 300, y: 300, a: 0 }, fx = 280, fy = 310;
  s.place(0, 300, 300, 0);
  for (let f = 0; f < 600; f++) {
    const dx = t.x - fx, dy = t.y - fy, d = Math.hypot(dx, dy);
    if (d < 240 && d > 0) drive(t, dx / d, dy / d, dt);
    s.flee(0, fx, fy, dt);
    same(s, 0, t, f, "flee");
  }
  assert.ok(Math.hypot(s.x[0] - fx, s.y[0] - fy) >= 240, "it got clear");
});

test("patrol: loops its waypoints with Blitz's drive", () => {
  const dt = 1 / 60, s = mk(), pts = new Float64Array([100, 100, 800, 120, 820, 560, 120, 540]);
  const t = { x: 100, y: 100, a: 0 };
  let k = 0, laps = 0;
  s.place(0, 100, 100, 0);
  for (let f = 0; f < 60 * 90; f++) {
    if (Math.hypot(pts[k * 2] - t.x, pts[k * 2 + 1] - t.y) <= 16) (k = (k + 1) % 4), k === 0 && laps++;
    const dx = pts[k * 2] - t.x, dy = pts[k * 2 + 1] - t.y, d = Math.hypot(dx, dy);
    if (d > 16) drive(t, dx / d, dy / d, dt);
    s.patrol(0, pts, dt);
    same(s, 0, t, f, "patrol");
    assert.equal(s.leg[0], k);
  }
  assert.ok(laps >= 1, `it went round (${laps} laps)`);
});

test("steer: zero allocation across 1M frames (16 movers, every behaviour)", async (t) => {
  const pts = new Float64Array([100, 100, 800, 120, 820, 560, 120, 540]);
  const minors = async (on) => {
    const e = createEngine({ maxSteps: 1 });
    const s = steer({ cap: 16, area: [60, 90, 840, 480], blocked: (i, at) => at[0] < 0 || at[1] < i, random: e.random });
    for (let i = 0; i < 16; i++) s.place(i, 100 + i * 40, 300, 0);
    e.add({
      step(_, dt) {
        if (!on) return;
        for (let i = 0; i < 16; i++) {
          const k = i % 5;
          if (k === 0) s.seek(i, 480, 320, dt);
          else if (k === 1) s.flee(i, 480, 320, dt);
          else if (k === 2) s.arrive(i, 300, 200, dt);
          else if (k === 3) s.wander(i, dt);
          else s.patrol(i, pts, dt);
        }
      },
    });
    const frames = (n) => { for (let f = 0; f < n; f++) e.advance(1 / 60); };
    frames(2000);
    const minor = await minorGCs(() => frames(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withSteer = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with ${withSteer}`);
  assert.ok(withSteer <= bare + 1, `young-generation GCs over 1M frames: ${withSteer} with steer, ${bare} bare`);
});

test("steer: options are checked at setup (a bad number throws with its name, never NaN mid-game)", () => {
  assert.throws(() => steer({ cap: 0 }), /cap/);
  assert.throws(() => steer({ cap: 2.5 }), /cap/);
  assert.throws(() => steer({ cap: NaN }), /cap/);
  assert.throws(() => steer({}), /cap/);
  for (const k of ["speed", "scale", "turn", "stop", "near", "slow", "fast", "calm", "far", "every", "jitter"]) {
    assert.throws(() => steer({ cap: 1, [k]: NaN }), new RegExp(k), k);
    assert.throws(() => steer({ cap: 1, [k]: "3" }), new RegExp(k), k);
  }
  assert.throws(() => steer({ cap: 1, area: [0, 0, NaN, 10] }), /area/);
  assert.throws(() => steer({ cap: 1, area: [0, 0, 10] }), /area/);
  // The defaults and good values still pass.
  assert.equal(steer({ cap: 3 }).cap, 3);
  assert.equal(steer({ cap: 1, speed: 0, turn: 0, area: [-5, -5, 10, 10] }).cap, 1);
});

test("patrol: no waypoints stands still (never writes NaN)", () => {
  for (const pts of [[], new Float64Array(0), [5]]) {
    const s = steer({ cap: 1 });
    s.place(0, 10, 20, 0.5);
    s.patrol(0, pts, 1 / 60);
    assert.deepEqual([s.x[0], s.y[0], s.a[0], s.moved[0]], [10, 20, 0.5, 0], `points ${JSON.stringify([...pts])}`);
    // One waypoint is a patrol of one: it drives there and stops.
    s.patrol(0, [100, 20], 1 / 60);
    assert.ok(s.x[0] > 10 && Number.isFinite(s.a[0]));
  }
});

test("arriveGoal: zero allocation for a platoon (each wingman's slot computed every frame)", async (t) => {
  // DOM Battlefield Blitz's platoons: a wingman's goal is a slot behind its leader, two fresh doubles
  // every frame. Passed to arrive(), V8 boxes them whenever the call isn't inlined (3 young GCs per
  // 20k steps on Chrome 145; on Node about 27 per 300k frames here). Written to gx/gy, nothing crosses a call.
  const minors = async (mode) => {
    const e = createEngine({ maxSteps: 1 });
    const s = steer({ cap: 16, area: [60, 90, 840, 480], blocked: (_, at) => at[0] < 0 || at[1] < 0, random: e.random });
    for (let i = 0; i < 16; i++) s.place(i, 100 + i * 50, 300, 0);
    e.add({
      step(_, dt) {
        if (!mode) return;
        for (let i = 0; i < 16; i++) {
          const k = i & 3, l = i - k; // four platoons: a leader that wanders, three wingmen
          if (k === 0) {
            s.wander(i, dt);
            continue;
          }
          const back = s.a[l] + Math.PI + (k === 1 ? 0.85 : k === 2 ? -0.85 : 0), r = k === 3 ? 78 : 58;
          const gx = Math.max(30, Math.min(930, s.x[l] + Math.cos(back) * r)), gy = Math.max(60, Math.min(610, s.y[l] + Math.sin(back) * r));
          if (mode === "goal") (s.gx[i] = gx), (s.gy[i] = gy), s.arriveGoal(i, dt);
          else s.arrive(i, gx, gy, dt);
        }
      },
    });
    const frames = (n) => { for (let f = 0; f < n; f++) e.advance(1 / 60); };
    frames(2000);
    const minor = await minorGCs(() => frames(300000));
    e.destroy();
    return minor;
  };
  const bare = await minors(null), args = await minors("args"), goal = await minors("goal");
  t.diagnostic(`young GCs over 300k frames (best of 3 windows): bare ${bare}, arriveGoal ${goal}, arrive(i, gx, gy) ${args}`);
  assert.ok(goal <= bare + 1, `young-generation GCs over 300k frames: ${goal} with arriveGoal, ${bare} bare`);
});
