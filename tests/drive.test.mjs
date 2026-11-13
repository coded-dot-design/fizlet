// @fzlt/core/drive in Node: the same inputs give the same path bit for bit (and the model uses no
// builtin sine, cosine or arctangent, which can differ between browsers); full throttle on the flat
// pulls to top speed and no further, brakes stop it in about v²/2a, reverse at a stop; steering holds
// at low speed and slides past the grip at high speed, more with the drift input, and a bike leans
// in; off a ramp a clean landing passes and a nose-down one (or a lower crashPitch) crashes; a car
// rolls over on a slope that is too steep; a bump compresses the front springs, then the rear, the
// body pitches and settles back to its sag; events on a ring; the chase camera eases behind the
// vehicle and stops; zero allocation per step. A course in Chromium: tests/terrain-drive.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { drive, chase } = await import("../src/drive.ts");
const { terrain } = await import("../src/terrain.ts");
const { EventRing } = await import("../src/kernel/ring.ts");

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const DT = 1 / 60;
const flat = (cols = 240, rows = 240) => terrain({ cols, rows, cell: 0.5 });
/** Run n steps of input(i) → [throttle, brake, steer, drift]; return the vehicle. */
function run(v, n, input) {
  for (let i = 0; i < n; i++) {
    const [t, b, s, d = 0] = input(i);
    v.set(t, b, s, d);
    v.step(DT);
  }
  return v;
}

test("drive: deterministic: the same inputs give the same path, bit for bit; no builtin trig in the model", () => {
  const course = () => {
    const t = terrain({ cols: 120, rows: 120, cell: 0.5 });
    t.noise({ seed: 4, amp: 1.5, scale: 6 });
    t.ramp([-10, 0], [-6, 0], { height: 0.8, width: 4 });
    t.whoops([0, 0], [10, 0], { height: 0.25, width: 4 });
    return t;
  };
  const input = (i) => [i < 400 ? 0.9 : 0, i >= 400 ? 0.6 : 0, Math.sin(i / 37) * 0.7, i % 200 < 30 ? 1 : 0];
  for (const kind of ["car", "bike"]) {
    const paths = [0, 1].map(() => {
      const v = drive(course(), { kind }), out = [];
      v.reset(-20, 0, 0.1);
      for (let i = 0; i < 700; i++) {
        const [t, b, s, d] = input(i);
        v.set(t, b, s, d);
        v.step(DT);
        out.push(...v.pos, ...v.rot, ...v.comp, ...v.spin);
      }
      return Float64Array.from(out);
    });
    assert.deepEqual(Buffer.from(paths[0].buffer), Buffer.from(paths[1].buffer), `${kind}: the same path bit for bit`);
    const other = drive(course(), { kind });
    other.reset(-20, 0, 0.1);
    run(other, 700, (i) => { const r = input(i); r[2] += 0.01; return r; });
    const per = 6 + 2 * (kind === "car" ? 4 : 2), last = paths[0].subarray(699 * per, 699 * per + 3);
    assert.ok(Math.hypot(other.pos[0] - last[0], other.pos[2] - last[2]) > 0.01, `${kind}: other inputs, another path`);
  }
  const src = readFileSync(new URL("../src/drive.ts", import.meta.url), "utf8"), model = src.slice(0, src.indexOf("export function chase"));
  assert.doesNotMatch(model, /Math\.(sin|cos|tan|atan2?|exp|log|pow|hypot)\b/, "only + − × ÷, sqrt and its own polynomials in the model");
});

test("drive: straight line: accelerates to top speed and no further; brakes; reverses at a stop; coasts to rest", () => {
  for (const [kind, top, accel] of [["car", 16, 10], ["bike", 18, 12]]) {
    const v = drive(flat(), { kind });
    v.reset(-50, 0, 0);
    run(v, 1, () => [1, 0, 0]);
    close(v.speed, accel * DT, 0.02, `${kind}: the first step pulls at full accel`);
    let max = 0;
    for (let i = 0; i < 60 * 12; i++) run(v, 1, () => [1, 0, 0]), (max = Math.max(max, v.speed));
    assert.ok(max < top && max > top * 0.99, `${kind}: top speed ${max.toFixed(3)} of ${top}`);
    close(v.pos[2], 0, 1e-9, `${kind}: straight`);
    close(v.rot[0], 0, 1e-9, `${kind}: no roll`);
    // Brake from top: about v² / 2a (22 per s²), and it stops.
    const x0 = v.pos[0], v0 = v.speed;
    let n = 0;
    while (v.speed > 0.3 && n < 600) run(v, 1, () => [0, 1, 0]), n++;
    close(v.pos[0] - x0, (v0 * v0) / (2 * 22), 1.2, `${kind}: braking distance`);
    // Held at a stop, the brake reverses, to `reverse` (5) at most.
    run(v, 60 * 8, () => [0, 1, 0]);
    assert.ok(v.speed < -4.5 && v.speed >= -5, `${kind}: reverse ${v.speed.toFixed(2)}`);
    // No pedals: it coasts to rest, then nothing moves and step() says so.
    run(v, 60 * 6, () => [0, 0, 0]);
    assert.equal(v.resting, true);
    assert.equal(v.speed, 0);
    const p = Float64Array.from(v.pos);
    assert.equal(v.step(DT), false, "resting: step reports nothing moved");
    assert.deepEqual(Array.from(v.pos), Array.from(p), "and it stays exactly put");
  }
});

test("drive: cornering: grip holds at low speed, slides past it at high speed, more with drift; a bike leans in", () => {
  const corner = (speed, o = {}, drift = 0, kind = "car") => {
    const v = drive(flat(), { kind, ...o });
    v.reset(-20, 0, 0);
    v.vel[0] = speed;
    let slip = 0, yaw = 0, roll = 0;
    run(v, 90, (i) => {
      slip = Math.max(slip, v.slip); yaw = v.yaw; roll = v.rot[0];
      return [speed / 16 + 0.02, 0, -1, drift]; // hold the speed; full left
    });
    return { slip, yaw, roll, v };
  };
  const slow = corner(5), fast = corner(15), loose = corner(15, { grip: 0.6 }), drifting = corner(15, {}, 1);
  assert.ok(slow.slip < 0.2, `5 u/s: the tyres hold (${slow.slip.toFixed(3)})`);
  assert.ok(slow.yaw > 0.5, `and it turns left (yaw ${slow.yaw.toFixed(2)} rad)`);
  assert.ok(fast.slip > 2, `15 u/s: it slides (${fast.slip.toFixed(2)})`);
  assert.ok(loose.slip > fast.slip, `less grip, more slide (${loose.slip.toFixed(2)} vs ${fast.slip.toFixed(2)})`);
  assert.ok(drifting.slip > fast.slip, `the drift input lets it go (${drifting.slip.toFixed(2)} vs ${fast.slip.toFixed(2)})`);
  assert.ok(fast.v.dust > slow.v.dust, "sliding throws more dust");
  const bike = corner(8, {}, 0, "bike");
  assert.ok(bike.roll < -0.2, `a bike leans into a left turn (diorama roll ${bike.roll.toFixed(2)}: the left side down)`);
  const right = drive(flat(), { kind: "bike" });
  right.reset(-20, 0, 0);
  right.vel[0] = 8;
  run(right, 20, () => [0.52, 0, 1]);
  assert.ok(right.yaw < -0.5, `steer +1 turns right (yaw ${right.yaw.toFixed(2)})`);
  run(right, 70, () => [0.52, 0, 1]);
  close(right.rot[0], -bike.roll, 0.05, "and leans the other way into a right turn");
});

test("drive: airtime off a ramp; landing judged against the slope; crashes past crashPitch, rollover past crashRoll", () => {
  const ramp = () => {
    const r = terrain({ cols: 120, rows: 20, cell: 0.5 });
    r.ramp([-10, 0], [-5, 0], { width: 4, height: 1.6, back: 0.5 });
    return r;
  };
  const jump = (air, o = {}) => {
    const ev = new EventRing(16), v = drive(ramp(), { kind: "bike", events: ev, id: 7, ...o });
    let maxAir = 0;
    v.reset(-25, 0, 0);
    run(v, 360, () => (maxAir = Math.max(maxAir, v.air), v.air > 0 ? air : [1, 0, 0]));
    const types = [];
    for (let i = 0; i < ev.size; i++) types.push(ev.at(i).type);
    return { v, maxAir, types, land: ev.at(types.indexOf("drive:land")) };
  };
  const clean = jump([1, 0, 0]), nose = jump([0, 1, 0]), strict = jump([1, 0, 0], { crashPitch: 0.2 });
  assert.ok(clean.maxAir > 0.4, `airborne off the lip: ${clean.maxAir.toFixed(2)} s`);
  assert.equal(clean.v.crashed, false, `throttle in the air lifts the nose: a clean landing (${clean.v.landing[1].toFixed(2)} rad off)`);
  assert.ok(clean.v.landing[0] > 4, `it came down at ${clean.v.landing[0].toFixed(1)} u/s`);
  assert.deepEqual(clean.types.slice(0, 2), ["drive:air", "drive:land"]);
  assert.equal(clean.land.a, 7, "events carry the id");
  close(clean.land.v, clean.v.landing[1], 1e-12, "drive:land carries how far off the slope");
  assert.equal(nose.v.crashed, true, `brake in the air: nose down, a crash (${nose.v.landing[1].toFixed(2)} rad off)`);
  assert.ok(nose.v.landing[1] > 0.65, "past the bike's crashPitch");
  assert.ok(nose.types.includes("drive:crash"));
  assert.equal(strict.v.crashed, true, "the same clean jump crashes under a stricter crashPitch");
  // Inputs do nothing while crashed; reset puts it back on its wheels.
  const x = nose.v.pos[0];
  run(nose.v, 120, () => [1, 0, 0]);
  assert.ok(nose.v.pos[0] - x < 3, "crashed: the throttle does nothing");
  nose.v.reset(0, 0, 0);
  assert.equal(nose.v.crashed, false);
  // A car across a slope: fine at 0.3, rolls over at 1.4 (54°).
  for (const [slope, over] of [[0.3, false], [1.4, true]]) {
    const s = terrain({ cols: 80, rows: 40, cell: 0.5 });
    s.shape((_, z) => z * slope);
    const v = drive(s);
    v.reset(-15, 0, 0);
    run(v, 180, () => [0.6, 0, 0]);
    assert.equal(v.crashed, over, `side slope ${slope}: ${over ? "rollover" : "upright"} (roll ${v.rot[0].toFixed(2)})`);
  }
});

test("drive: suspension on a bump: front springs first, then rear; the body pitches and settles back to its sag", () => {
  const b = terrain({ cols: 80, rows: 20, cell: 0.25 });
  b.bump(0, 0, 1.2, 0.25);
  const v = drive(b);
  v.reset(-6, 0, 0);
  const sag = v.comp[0];
  close(sag, 20 / (2 * Math.PI * 2.2) ** 2, 1e-12, "at rest each spring sits at g / ω²");
  run(v, 30, () => [0, 0, 0]);
  close(v.comp[0], sag, 1e-3, "and stays there");
  v.vel[0] = 6;
  let frontPeak = -1, rearPeak = -1, front = 0, rear = 0, up = 0, down = 0;
  for (let i = 0; i < 120; i++) {
    run(v, 1, () => [0.38, 0, 0]);
    if (v.comp[0] > front) (front = v.comp[0]), (frontPeak = i);
    if (v.comp[2] > rear) (rear = v.comp[2]), (rearPeak = i);
    up = Math.max(up, v.rot[2]); down = Math.min(down, v.rot[2]);
  }
  assert.ok(front > sag + 0.05 && rear > sag + 0.05, `both springs pushed in: front ${front.toFixed(3)}, rear ${rear.toFixed(3)} (sag ${sag.toFixed(3)})`);
  assert.ok(frontPeak < rearPeak, `front first (step ${frontPeak}), then rear (step ${rearPeak})`);
  assert.ok(up > 0.05 && down < -0.05, `nose up onto the bump, nose down off it: ${up.toFixed(3)}, ${down.toFixed(3)}`);
  close(v.comp[0], sag, 0.01, "back to sag after it");
  close(v.rot[2], 0, 0.01, "level again");
});

test("drive: chase eases the camera behind and above the target, then stops; snap jumps there", () => {
  const v = drive(flat());
  v.reset(3, -2, 0.8);
  const cam = { yaw: 0, pitch: 1, dist: 20, tx: 0, ty: 0, tz: 0 }, o = { dist: 9, pitch: 0.45, lift: 0.6 };
  assert.equal(chase(cam, v, o, DT), true, "it moves");
  let n = 0;
  while (chase(cam, v, o, DT) && n < 2000) n++;
  assert.ok(n > 30 && n < 600, `eased over ${n} frames, then it reports no movement`);
  close(cam.tx, v.pos[0], 1e-3, "target x");
  close(cam.ty, v.pos[1] + 0.6, 1e-3, "lifted");
  close(cam.tz, v.pos[2], 1e-3, "target z");
  close(cam.dist, 9, 1e-3, "distance");
  // Behind: the eye sits opposite the vehicle's forward (cos yaw, 0, −sin yaw).
  const ex = Math.sin(cam.yaw) * Math.cos(cam.pitch), ez = Math.cos(cam.yaw) * Math.cos(cam.pitch);
  close(ex, -Math.cos(0.8) * Math.cos(0.45), 1e-3, "eye behind (x)");
  close(ez, Math.sin(0.8) * Math.cos(0.45), 1e-3, "eye behind (z)");
  const c2 = { yaw: 2, pitch: 0.1, dist: 3, tx: 9, ty: 9, tz: 9 };
  chase(c2, v, { snap: true, dist: 9 }, DT);
  close(c2.tx, v.pos[0], 1e-12, "snap: there in one call");
  assert.equal(chase(c2, v, { snap: true, dist: 9 }, DT), false);
  // The short way round: a target just past ±π turns a little, not almost a full circle.
  const c3 = { yaw: 3.1, pitch: 0.45, dist: 9, tx: 0, ty: 0, tz: 0 };
  chase(c3, { pos: [0, 0, 0], yaw: Math.PI / 2 - 3.1 + 0.2 - 2 * Math.PI + Math.PI }, o, DT);
  assert.ok(Math.abs(c3.yaw - 3.1) < 0.2, `short way: ${c3.yaw}`);
});

test("drive: zero allocation per step (car and bike on a bumpy course, with the chase camera)", async (t) => {
  const g = terrain({ cols: 128, rows: 128, cell: 0.5 });
  g.noise({ seed: 7, amp: 2, scale: 8 });
  g.ramp([0, 0], [5, 0], { height: 1 });
  for (const kind of ["car", "bike"]) {
    const v = drive(g, { kind }), cam = { yaw: 0, pitch: 0.5, dist: 9, tx: 0, ty: 0, tz: 0 }, o = { dist: 8 };
    v.reset(-20, 0, 0);
    const steps = (on) => {
      for (let i = 0; i < 100; i++) {
        v.set(1, 0, 0.35);
        if (on) v.step(DT), chase(cam, v, o, DT);
        if (v.crashed || Math.abs(v.pos[0]) > 28 || Math.abs(v.pos[2]) > 28) v.reset(-20, 0, 0);
      }
    };
    for (let i = 0; i < 100; i++) steps(true);
    const bare = await minorGCs(() => { for (let i = 0; i < 1000; i++) steps(false); });
    const n = await minorGCs(() => { for (let i = 0; i < 1000; i++) steps(true); });
    t.diagnostic(`${kind}: young GCs over 100k steps: ${n} (bare ${bare})`);
    assert.ok(n <= bare + 1, `${kind}: ${n} young GCs`);
  }
});
