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

const { drive, chase, touch, touchAll, touchHit } = await import("../src/drive.ts");
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

test("drive: handbrake drift: the rear lets go, the slide builds to `slide` and holds, counter-steer catches it; drift, chain, drive:drift", () => {
  /** Up to speed, then a left turn for 1.5 s (handbrake `dr`), then counter-steer and drive on. */
  const turn = (dr, o = {}) => {
    const ev = new EventRing(16), v = drive(flat(), { events: ev, id: 3, ...o });
    v.reset(-40, 0, 0);
    run(v, 240, () => [0.9, 0, 0]);
    let slide = 0, drift = 0, held = 0, n = 0;
    run(v, 90, (i) => {
      if (i > 30) (slide = Math.max(slide, Math.abs(v.slide))), (drift = Math.max(drift, v.drift)), (held += v.slide), n++;
      return [0.8, 0, -1, dr];
    });
    const exit = Math.abs(v.slide), speed = v.groundSpeed;
    run(v, 30, () => [0.8, 0, Math.max(-1, Math.min(1, v.slide * 2)), 0]); // steer into the slide
    const caught = Math.abs(v.slide), after = v.groundSpeed;
    run(v, 60, () => [0.8, 0, 0, 0]);
    const types = [];
    for (let i = 0; i < ev.size; i++) types.push(ev.at(i));
    return { v, slide, drift, mean: held / n, exit, caught, speed, after, banked: types.filter((e) => e.type === "drive:drift") };
  };
  const grip = turn(0), hand = turn(1), tight = turn(1, { slide: 0.5 }), noRecover = turn(1, { recover: 0 });
  assert.ok(hand.slide > grip.slide + 0.1, `the handbrake swings the tail out: ${hand.slide.toFixed(2)} vs ${grip.slide.toFixed(2)} rad`);
  assert.ok(hand.mean > 0.7 && hand.slide < 0.8 + 0.03, `and holds the slide at about \`slide\` (0.8): mean ${hand.mean.toFixed(2)}, max ${hand.slide.toFixed(2)}`);
  assert.ok(tight.slide < 0.5 + 0.03 && tight.slide > 0.45, `slide: 0.5 holds 0.5: ${tight.slide.toFixed(2)}`);
  assert.ok(hand.mean > 0, "+: the nose points left of the travel in a left drift");
  assert.equal(hand.drift, 1, "full drift while it holds");
  assert.ok(hand.caught < 0.1, `counter-steer catches it: ${hand.caught.toFixed(3)} rad after half a second`);
  assert.ok(hand.after > noRecover.after + 0.3, `recover hands slide back as speed: ${hand.after.toFixed(2)} vs ${noRecover.after.toFixed(2)} with recover 0`);
  assert.equal(hand.banked.length, 1, "one drift chain banked");
  assert.ok(hand.banked[0].v > 1.3 && hand.banked[0].a === 3 && hand.banked[0].b === 0, `drive:drift: score ${hand.banked[0].v.toFixed(2)} (∫ drift dt), id, not broken`);
  close(hand.v.lastChain, hand.banked[0].v, 1e-12, "lastChain");
  assert.equal(hand.v.chain, 0, "the chain is empty again");
  assert.ok(hand.banked[0].v > (grip.banked[0]?.v ?? 0), "the handbrake drift scores more than a grip slide");
  // In a straight line there is nothing to score; the handbrake alone does not drift.
  const v = drive(flat());
  v.reset(-40, 0, 0);
  let d = 0;
  run(v, 240, () => (d = Math.max(d, v.drift), [1, 0, 0, 1]));
  assert.equal(d, 0, "straight on the handbrake: no drift");
});

test("drive: spinOut spins it round with no control, breaks the drift chain, then it drives again", () => {
  const ev = new EventRing(16), v = drive(flat(), { events: ev, id: 5 });
  v.reset(-40, 0, 0);
  run(v, 200, () => [0.9, 0, 0]);
  run(v, 40, () => [0.8, 0, -1, 1]);
  assert.ok(v.chain > 0.2, `drifting: chain ${v.chain.toFixed(2)}`);
  const yaw0 = v.yaw;
  v.spinOut(9, 1);
  assert.equal(v.chain, 0, "the chain is broken");
  const e = ev.at(ev.size - 1);
  assert.ok(e.type === "drive:drift" && e.b === 1 && e.v > 0.2, "drive:drift with b = 1: broken");
  let turned = 0, prev = v.yaw;
  run(v, 64, () => {
    let dy = v.yaw - prev;
    dy -= 2 * Math.PI * Math.round(dy / (2 * Math.PI));
    turned += dy; prev = v.yaw;
    if (v.spinning > 0) assert.ok(v.drift === 0, "no drift points while spun out");
    return [1, 0, 1, 0]; // ignored
  });
  assert.ok(turned > 3, `it spun round: ${turned.toFixed(2)} rad from ${yaw0.toFixed(2)}`);
  assert.ok(v.spinning === 0, "and the spin is over");
  const s = v.speed;
  run(v, 90, () => [1, 0, 0]);
  assert.ok(v.speed > s + 2 && !v.crashed, `control is back: ${s.toFixed(1)} → ${v.speed.toFixed(1)}`);
});

test("drive: touch pushes hulls apart by mass and bounces along the normal (box, circle); onHit; height passes; touchAll", () => {
  const g = flat();
  const pair = (oa = {}, ob = {}) => {
    const a = drive(g, oa), b = drive(g, ob);
    a.reset(0, 0, 0); b.reset(1.8, 0, 0);
    return [a, b];
  };
  // Box against box, nose to tail along x: hulls 1.03 long each, 0.26 deep.
  const [a, b] = pair({}, { mass: 2 });
  a.vel[0] = 10;
  const hits = [];
  assert.equal(touch(a, b, { onHit: (p, q, h) => hits.push([p, q, ...h]) }), true);
  close(touchHit[1], 1, 1e-9, "normal from a to b (x)");
  close(touchHit[2], 0, 1e-9, "normal (z)");
  close(touchHit[3], 0.26, 1e-9, "depth");
  close(b.pos[0] - a.pos[0], 2.06, 1e-9, "pushed apart to just touching");
  close(a.pos[0], -0.26 * (2 / 3), 1e-9, "the lighter one moves twice as far");
  close(a.vel[0] + 2 * b.vel[0], 10, 1e-9, "momentum kept");
  close(b.vel[0] - a.vel[0], 0.3 * 10, 1e-9, "bounce 0.3 of the closing speed");
  close(touchHit[0], (1.3 * 10) / 1.5, 1e-9, "impulse");
  assert.equal(hits.length, 1);
  assert.ok(hits[0][0] === a && hits[0][1] === b && hits[0][2] === touchHit[0], "onHit(a, b, hit)");
  assert.equal(touch(a, b), false, "apart now: no second contact");
  // Moving apart: pushed out, but no bounce.
  const [c, d] = pair();
  c.vel[0] = -3;
  touch(c, d);
  close(c.vel[0], -3, 1e-12, "already separating: velocity kept");
  // Side by side, one turned 90°: the box's width counts on that axis.
  const [e, f] = pair();
  f.reset(0, 1.5, Math.PI / 2); // f across e's flank: e half width 0.64 + f half length 1.03 > 1.5
  assert.equal(touch(e, f), true);
  close(touchHit[2], 1, 1e-6, "normal along +z");
  close(touchHit[3], 0.64 + 1.03 - 1.5, 1e-6, "depth on the z axis");
  // Circle against circle and against a box.
  const [r, s] = pair({ hull: 0.5 }, { hull: 0.5 });
  s.reset(0.6, 0.6, 0);
  assert.equal(touch(r, s), true);
  close(touchHit[3], 1 - Math.hypot(0.6, 0.6), 1e-9, "circles: radii less the distance");
  close(touchHit[1], Math.SQRT1_2, 1e-9, "along the centre line");
  const [k, m] = pair({}, { hull: 0.4 });
  m.reset(1.2, 0.3, 0); // past the box's nose (1.03): nearest point (1.03, 0.3)
  assert.equal(touch(k, m), true);
  close(touchHit[3], 0.4 - 0.17, 1e-9, "box and circle: the radius less the distance to the nearest point");
  close(touchHit[1], 1, 1e-9, "out of the nose");
  touch(m, k);
  close(touchHit[1], -1, 1e-9, "the other way round: the normal flips (from a to b)");
  // One over the other (a jump): no contact.
  const [u, w] = pair();
  w.pos[1] += 1.5;
  assert.equal(touch(u, w), false, "in the air over it: passes");
  // touchAll: every pair, in order; the result is the same every time.
  const pack = () => {
    const cars = [0, 1, 2, 3].map((i) => drive(g, { mass: 1 + i * 0.25 }));
    cars.forEach((v, i) => v.reset(i * 1.5, (i % 2) * 0.3, i * 0.4));
    return cars;
  };
  const p1 = pack(), p2 = pack();
  assert.ok(touchAll(p1) >= 3, "neighbours touch");
  touchAll(p2);
  assert.deepEqual(p1.map((v) => Array.from(v.pos)), p2.map((v) => Array.from(v.pos)), "deterministic");
});

test("drive: zero allocation per step with 4 cars in one process (drift, contact and every read-out)", async (t) => {
  const g = terrain({ cols: 128, rows: 128, cell: 0.5 });
  g.noise({ seed: 7, amp: 1.2, scale: 8 });
  const cars = [], acc = new Float64Array(1), hits = new Uint32Array(2), o = { onHit: (a, b) => { hits[0]++; if (b.drift > 0.3) b.spinOut(6, 0.5), hits[1]++; } };
  for (let k = 0; k < 4; k++) (cars[k] = drive(g, { kind: k === 3 ? "bike" : "car" })), cars[k].reset(-6 + k * 2.5, 0, k);
  const steps = (on) => {
    for (let i = 0; i < 100; i++) {
      for (let k = 0; k < 4; k++) {
        const v = cars[k];
        // (Computed inputs go straight into `input`: `set`'s double arguments box when a big loop does not inline it.)
        const inp = v.input;
        inp[0] = 0.9; inp[1] = 0; inp[2] = 0.6 - k * 0.3 + v.yaw * 0.001; inp[3] = (i + k * 13) % 40 < 18 ? 1 : 0;
        if (on) v.step(DT);
        acc[0] += v.speed + v.yaw + v.slip + v.air + v.drift + v.slide + v.chain + v.dust + v.steerAngle + v.groundSpeed + v.spinning + (v.crashed ? 1 : 0);
        if (v.crashed || Math.abs(v.pos[0]) > 28 || Math.abs(v.pos[2]) > 28) v.reset(-6 + k * 2.5, 0, k);
      }
      if (on) touchAll(cars, o);
    }
  };
  for (let i = 0; i < 200; i++) steps(true);
  const bare = await minorGCs(() => { for (let i = 0; i < 2000; i++) steps(false); });
  const n = await minorGCs(() => { for (let i = 0; i < 2000; i++) steps(true); });
  t.diagnostic(`4 cars: young GCs over 800k car steps: ${n} (bare ${bare}); ${hits[0]} contacts, ${hits[1]} spin-outs`);
  assert.ok(hits[0] > 100 && hits[1] > 10, "the cars bump and spin each other out");
  assert.ok(n <= bare + 1, `4 cars: ${n} young GCs`);
});

/** A fixed run (a car and a bike, the drift input pulsing, over noise, a ramp and whoops) hashed bit for bit. */
function pathHash(o = {}) {
  const g = terrain({ cols: 160, rows: 160, cell: 0.5 });
  g.noise({ seed: 4, amp: 1.2, scale: 6 }); g.ramp([-10, 0], [-6, 0], { height: 1.2, width: 4 }); g.whoops([0, 0], [14, 0], { height: 0.3, width: 4 });
  let h = 0;
  const mix = (a) => { for (const x of new Uint32Array(Float64Array.from(a).buffer)) h = (Math.imul(h, 31) + x) | 0; };
  for (const kind of ["car", "bike"]) {
    const v = drive(g, { kind, ...o });
    v.reset(-30, 0, 0.1);
    for (let i = 0; i < 1500; i++) {
      v.set(i % 500 < 400 ? 0.9 : 0, i % 500 >= 400 ? 0.6 : 0, Math.sin(i / 37) * 0.8, i % 200 < 40 ? 1 : 0);
      v.step(DT);
      mix(v.pos); mix(v.rot); mix(v.comp); mix(v.spin); mix(v.vel);
      if (v.crashed) v.reset(-30, 0, 0.1);
    }
  }
  return h;
}

test("drive: the defaults ride exactly as 0.23.0 did; 0.22.0's drift is three options away, bit for bit", () => {
  // Hashes measured on the released sources (src/drive.ts at v0.23.0 and v0.22.0) with this run.
  assert.equal(pathHash(), 97294112, "defaults: the 0.23.0 path");
  assert.equal(pathHash({ swing: 0.5, slide: 9, recover: 0 }), -2063471579, "swing 0.5, slide 9, recover 0: the 0.22.0 path");
});

/** A long-travel buggy's springs (soft, progressive, more rebound than compression damping, a heavy body). */
const LONG = { travel: 0.6, rest: 0.62, stiffness: 70, progressive: 1.2, damping: 0.4, rebound: 0.85, inertia: 1.5 };
/** Drop a car from `height` onto the flat; the run's read-outs. */
function drop(o, height = 3) {
  const v = drive(flat(), o);
  v.reset(0, 0, 0);
  const y0 = v.pos[1], sag = v.comp[0];
  v.pos[1] += height;
  let land = -1, peak = 0, dip = 0, up = -1, over = -Infinity, settled = -1, press = 0;
  for (let i = 0; i < 300; i++) {
    v.set(0, 0, 0);
    v.step(DT);
    if (land < 0 && v.contact[0]) land = i;
    if (land < 0) continue;
    peak = Math.max(peak, v.stroke); dip = Math.min(dip, v.pos[1] - y0); press = Math.max(press, Math.abs(v.press[0] - v.comp[0] / v.travel));
    if (up < 0 && v.vel[1] > 0.2) up = i;
    if (up >= 0) over = Math.max(over, v.pos[1] - y0);
    if (settled < 0 && i > land + 10 && Math.abs(v.pos[1] - y0) < 0.01 && Math.abs(v.vel[1]) < 0.05) settled = i;
  }
  return { v, sag, land, peak, dip, up, over, settled: (settled - land) * DT, press };
}

test("drive: suspension: a big drop compresses the springs, rebounds and settles; long travel soaks up more", () => {
  const short = drop({}), long = drop(LONG);
  close(long.sag, 0.24, 0.01, "long travel: softer, progressive springs sag further (0.24 of 0.6)");
  for (const [name, r] of [["default", short], ["long", long]]) {
    assert.equal(r.v.crashed, false, `${name}: a flat drop does not crash`);
    assert.ok(r.up > r.land, `${name}: compressed, then the springs push the body back up (step ${r.up})`);
    assert.ok(r.settled > 0 && r.settled < 1.5, `${name}: settled back at its sag in ${r.settled.toFixed(2)} s`);
    close(r.v.comp[0], r.sag, 5e-3, `${name}: back at sag`);
    assert.ok(r.press < 1e-12, `${name}: press is comp / travel`);
  }
  assert.ok(short.peak > 1.2, `default travel bottoms on the bump stop: stroke ${short.peak.toFixed(2)}`);
  assert.ok(long.peak < short.peak && long.dip < short.dip * 1.8, `long travel uses its stroke: stroke ${long.peak.toFixed(2)}, the body dips ${long.dip.toFixed(2)} (default ${short.dip.toFixed(2)})`);
  // More rebound damping holds the body down instead of bouncing it back over its ride height.
  const bouncy = drop({ ...LONG, rebound: 0.2 });
  assert.ok(bouncy.over > long.over + 0.03, `rebound 0.2 bounces higher than 0.85: ${bouncy.over.toFixed(3)} vs ${long.over.toFixed(3)}`);
  // A 1-unit drop stays off the bump stop with long travel.
  assert.ok(drop(LONG, 1).peak < 1, `a small drop: stroke ${drop(LONG, 1).peak.toFixed(2)}`);
});

test("drive: suspension: each wheel follows the ground on its own; the body rolls and pitches on the loads", () => {
  // A long bump under the left wheels only (right is +z).
  const g = terrain({ cols: 80, rows: 40, cell: 0.25 });
  g.shape((x, z) => (z < -0.2 && x > -2 && x < 2 ? 0.3 * (1 - (x / 2) * (x / 2)) : 0));
  const v = drive(g, LONG);
  v.reset(-6, 0, 0);
  v.vel[0] = 4;
  let left = 0, right = 0, roll = 0, pitch = 0;
  for (let i = 0; i < 120; i++) {
    v.set(0.25, 0, 0);
    v.step(DT);
    if (v.press[0] > left) (left = v.press[0]), (right = v.press[1]); // the front pair as the left one peaks
    if (Math.abs(v.bodyRoll) > Math.abs(roll)) roll = v.bodyRoll;
    pitch = Math.max(pitch, Math.abs(v.bodyPitch));
  }
  assert.ok(left > right + 0.15, `the left spring takes the bump: ${left.toFixed(2)} vs the right ${right.toFixed(2)}`);
  assert.ok(Math.abs(roll) > 0.03, `the body rolls on the springs: ${roll.toFixed(3)} rad`);
  assert.ok(pitch > 0.01, `and pitches: ${pitch.toFixed(3)} rad`);
  for (let i = 0; i < 4; i++) assert.equal(v.contact[i], 1, "all four on the ground after it");
  // Options: stiffness is the rate behind hz; inertia slows the pitch; droop eases a wheel off the ground.
  const a = drive(flat()), b = drive(flat(), { stiffness: (2 * Math.PI * 2.2) ** 2 });
  close(b.comp[0], a.comp[0], 1e-12, "stiffness (2π·2.2)² sags as hz 2.2");
  const nod = (o) => {
    const t = terrain({ cols: 80, rows: 20, cell: 0.25 });
    t.bump(0, 0, 1.2, 0.25);
    const c = drive(t, o);
    c.reset(-6, 0, 0); c.vel[0] = 6;
    let peak = 0, at = 0;
    for (let i = 0; i < 90; i++) (c.set(0.38, 0, 0), c.step(DT)), c.rot[2] > peak && ((peak = c.rot[2]), (at = i));
    return at;
  };
  assert.ok(nod({ inertia: 3 }) > nod({}), "more pitch inertia: the nose peaks later");
  const air = (o) => {
    const c = drive(flat(), o);
    c.reset(0, 0, 0); c.pos[1] += 2; c.step(DT);
    return c.comp[0];
  };
  assert.equal(air({}), 0, "off the ground a wheel drops to full droop at once (default)");
  assert.ok(air({ droop: 3 }) > 0.04, `droop 3: it eases down (${air({ droop: 3 }).toFixed(3)} after one step)`);
});

test("drive: zero allocation per step across many races in one process (other grounds, car counts and options; long travel)", async (t) => {
  // A game's test file runs race after race in one process: each with its own terrain and cars. The
  // per-vehicle model closures of 0.23.0 deoptimised here ("wrong call target") and boxed: 10 to 15
  // young GCs per 200,000 rounds of 4 cars.
  const course = (seed) => {
    const g = terrain({ cols: 128, rows: 128, cell: 0.5 });
    g.noise({ seed, amp: 1.2, scale: 8 }); g.ramp([0, 0], [5, 0], { height: 1 }); g.whoops([-20, 8], [10, 8], { height: 0.3, width: 4 });
    return g;
  };
  const race = (seed, n, o) => {
    const g = course(seed), cars = [];
    for (let k = 0; k < n; k++) (cars[k] = drive(g, { id: k, top: 12 + k * 0.1, ...o })), cars[k].reset(-6 + k * 2.5, 0, k);
    return (m) => {
      for (let i = 0; i < m; i++) {
        for (let k = 0; k < n; k++) {
          const v = cars[k], inp = v.input;
          inp[0] = 0.9; inp[1] = 0; inp[2] = 0.6 - k * 0.3 + v.yaw * 0.001; inp[3] = (i + k * 13) % 40 < 18 ? 1 : 0;
          v.step(DT);
          if (v.crashed || Math.abs(v.pos[0]) > 28 || Math.abs(v.pos[2]) > 28) v.reset(-6 + k * 2.5, 0, k);
        }
        touchAll(cars);
      }
    };
  };
  // One call target for every vehicle: the model is the class's, not a closure per car.
  const one = drive(flat()), two = drive(course(2), LONG);
  assert.ok(one.step === two.step && one.reset === two.reset && one.spinOut === two.spinOut, "step, reset and spinOut are shared, not per car");
  assert.equal(Object.getPrototypeOf(one), Object.getPrototypeOf(two));
  for (let s = 1; s < 8; s++) race(s, 1 + (s % 4), s % 2 ? LONG : { grip: 1.1 })(3000);
  const steps = race(9, 4, LONG);
  steps(20000);
  const bare = await minorGCs(() => {});
  const n = await minorGCs(() => steps(50000));
  t.diagnostic(`many races: young GCs over 200k car steps: ${n} (bare ${bare})`);
  assert.ok(n <= bare + 1, `many races: ${n} young GCs`);
});
