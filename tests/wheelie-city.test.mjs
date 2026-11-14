// Wheelie City's block and session (site/gallery/pieces/wheelie/city.ts), its scorer (tricks.ts) and
// its rides (ride.ts, on the Bikes series' shared bike), headless: the ground has its curbs, roads and
// kinds; the clock waits for the gas; the autopilot rides a whole minute on JOLT and STUBBY with
// long wheelies and no crash, and holds one wheelie down a whole boulevard (about 7 s, 70 m+) on every ride, rousing neighbours and the dog; full gas with the weight back loops each
// ride out (a crash: the trick and the combo dropped, then back up); a hard hit on a parked car is a
// crash, a soft one a bump; the rides feel different; the
// same inputs give the same session; the scorer's rules; and the piece's own code allocates nothing in a session
// (a sampled heap profile).
import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

const C = await import("../site/gallery/pieces/wheelie/city.ts");
const T = await import("../site/gallery/pieces/wheelie/tricks.ts");
const { READY, RUN, CRASH, DONE, E_START, E_TRICK, E_CRASH, E_RESPAWN, E_GRUMP, E_BARK, E_END } = C;

function ride(run, n, input) {
  const I = new Float64Array(5), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    if (input) input(I, i);
    else run.autopilot(I);
    run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 2], run.ev[k * 2 + 1]]);
    run.clear();
  }
  return ev;
}

test("wheelie city: the ground: roads at 0, curbs and lawns up, the bump and the kicker", () => {
  assert.equal(C.height(0, 8.5), 0, "the south street");
  assert.equal(C.height(-8, 0), C.CURB, "a block's lawn sits at the curb");
  assert.equal(C.kindAt(0, 8.5), C.K_ROAD);
  assert.equal(C.kindAt(-10.5, -4.6), C.K_LAWN);
  assert.equal(C.kindAt(-12.5, 0), C.K_WALK);
  assert.ok(C.height(C.BUMP[0], -8.5) > 0.1, "the speed bump");
  assert.ok(C.height(-15, 2.1) > 0.35, "the kicker's lip");
});

test("wheelie city: the clock waits for the gas; the autopilot rides a minute of wheelies with no crash", () => {
  for (const r of [1, 2]) {
    const run = C.cityRun();
    run.choose(r);
    run.step(1 / 60, 0, 0, 0, 0.5, 0);
    assert.equal(run.S[0], READY, "steering alone does not start it");
    assert.equal(run.S[1], C.SESSION, "and the clock waits");
    const ev = ride(run, 60 * 65);
    const name = C.RIDES[r].name;
    assert.equal(run.S[0], DONE, `${name}: time`);
    assert.equal(ev.filter((e) => e[0] === E_START).length, 1);
    assert.equal(ev.filter((e) => e[0] === E_END).length, 1);
    assert.equal(ev.filter((e) => e[0] === E_CRASH).length, 0, `${name}: no crash`);
    const tricks = ev.filter((e) => e[0] === E_TRICK);
    assert.ok(tricks.length >= 2, `${name}: tricks banked: ${tricks.length}`);
    assert.ok(run.sc.S[T.BEST_W] > 30, `${name}: a long wheelie: ${run.sc.S[T.BEST_W].toFixed(1)} m`);
    assert.ok(run.sc.S[T.SC] > 1500, `${name}: score ${run.sc.S[T.SC]}`);
    assert.ok(ev.some((e) => e[0] === E_GRUMP), `${name}: a neighbour came out`);
    assert.ok(ev.some((e) => e[0] === E_BARK), `${name}: the dog barked`);
  }
});

test("wheelie city: a boulevard is long enough to hold a wheelie end to end (about seven seconds, 70 m and more) on every ride", () => {
  assert.equal(C.BOULEVARD, 94);
  for (let r = 0; r < 3; r++) {
    const run = C.cityRun();
    run.choose(r);
    run.bike.reset(-44, 8.6, 0);
    run.S[0] = RUN;
    ride(run, 60 * 18, (I) => {
      run.autopilot(I);
      run.S[1] = 60;
      if (run.bike.b.pos[0] > 43) I[0] = 0, (I[2] = 1);
    });
    run.step(1 / 60, 0, 0, 1, 0, 0);
    const name = C.RIDES[r].name, s = run.sc.S[T.BEST_WS], m = run.sc.S[T.BEST_W];
    assert.ok(s > 6.5 && m > 70, `${name}: one wheelie down the south boulevard: ${s.toFixed(1)} s, ${m.toFixed(0)} m`);
  }
});

test("wheelie city: full gas with the weight back loops every ride out: a crash, the combo dropped, back up", () => {
  for (let r = 0; r < 3; r++) {
    const run = C.cityRun();
    run.choose(r);
    let crashAt = -1;
    const ev = ride(run, 60 * 6, (I, i) => {
      I[0] = run.S[0] === RUN ? 1 : 0; I[1] = 0; I[2] = -1; I[3] = 0; I[4] = 0;
      if (i === 0) I[0] = 1;
      if (crashAt < 0 && run.S[0] === CRASH) crashAt = i;
    });
    const crash = ev.find((e) => e[0] === E_CRASH);
    assert.ok(crash, `${C.RIDES[r].name} loops out`);
    assert.equal(run.sc.S[T.CB], 0, "combo dropped");
    assert.ok(ev.some((e) => e[0] === E_RESPAWN), "back up after the tumble");
  }
});

test("wheelie city: the rides feel different: VOLT lifts first, STUBBY last, JOLT is the fastest", () => {
  const lift = [], top = [];
  for (let r = 0; r < 3; r++) {
    const run = C.cityRun();
    run.choose(r);
    let t = -1, v = 0;
    ride(run, 60 * 3, (I, i) => {
      I[0] = 1; I[1] = 0; I[2] = 0; I[3] = 0; I[4] = 0;
      if (t < 0 && run.bike.nose > 0.3) t = i;
      v = Math.max(v, run.bike.b.speed);
    });
    lift.push(t < 0 ? 999 : t);
    top.push(v);
  }
  assert.ok(lift[0] < lift[1] && lift[1] < lift[2], `VOLT (light) lifts first, STUBBY (heavy) last: ${lift}`);
  assert.ok(top[1] > top[0] && top[1] > top[2], `JOLT is the fastest: ${top.map((v) => v.toFixed(1))}`);
});

test("wheelie city: ridden hard into a parked car it is a crash (the shared bike's knock), softly a bump", () => {
  for (const [gas, crash] of [[1, true], [0.25, false]]) {
    const run = C.cityRun();
    run.choose(1);
    run.S[0] = RUN;
    run.bike.reset(-15, 7.3, 0);
    const ev = ride(run, 60 * 3, (I) => {
      I[0] = gas; I[1] = 0; I[2] = 0.6; I[3] = 0; I[4] = 0;
    });
    assert.equal(ev.some((e) => e[0] === E_CRASH), crash, `gas ${gas}: ${crash ? "a crash" : "a bump"}`);
    assert.ok(run.bike.b.pos[0] < -11.6 || crash, "it does not pass through the car");
  }
});

test("wheelie city: the same inputs give the same session, bit for bit", () => {
  const go = () => {
    const run = C.cityRun();
    run.choose(1);
    ride(run, 60 * 20);
    return [...run.bike.b.pos, run.sc.S[T.SC], run.S[4]];
  };
  assert.deepEqual(go(), go());
});

test("wheelie city: the scorer: a wheelie on the gas, a manual off it, bonuses, the combo, a hop", () => {
  const s = T.tricks();
  for (let i = 0; i < 120; i++) s.step(1 / 60, 0.5, 0.6, 0.1, 5, 1, false);
  assert.equal(s.S[T.ON], 1);
  assert.ok(s.bonus(T.F_CROSS), "a crosswalk counts once");
  assert.ok(!s.bonus(T.F_CROSS));
  assert.equal(s.step(1 / 60, 0, 0.6, 0.1, 5, 1, false), T.BANKED);
  assert.equal(s.S[T.KIND], T.WHEELIE);
  assert.ok(Math.abs(s.S[T.DIST] - 8.75) < 0.2 && s.S[T.SWEET] > 1.5, `distance (from when it is called) and the sweet spot: ${s.S[T.DIST]}`);
  const first = s.S[T.PTS];
  for (let i = 0; i < 120; i++) s.step(1 / 60, 0.5, 0.6, 0.1, 5, 0, false);
  s.step(1 / 60, 0, 0.6, 0.1, 5, 0, false);
  assert.equal(s.S[T.KIND], T.MANUAL, "off the gas it is a manual");
  assert.equal(s.S[T.CB], 1, "back to back: a combo");
  assert.ok(s.S[T.PTS] > first, "a manual pays more, and the combo doubles it");
  assert.equal(s.hop(0.4, false), T.BANKED);
  assert.equal(s.S[T.HOPS], 1);
  s.drop();
  assert.equal(s.S[T.CB], 0, "a crash drops the combo");
});

test("wheelie city: the piece's own code allocates nothing in a session", async () => {
  // A sampled heap profile over three sessions (one ride: switching rides deopts the shared bike),
  // with every allocation charged to the function that made it, in pieces/wheelie/ (the block, the
  // run, the rides' adapter, the scorer).
  // (The shared bike, ../bikes/bike.ts, is the Bikes series' and is measured by its own tests.)
  const run = C.cityRun(), I = new Float64Array(5);
  const go = (n) => {
    for (let i = 0; i < n; i++) {
      run.autopilot(I);
      run.step(1 / 60, I[0], I[1], I[2], I[3], i % 90 === 0 ? 1 : 0);
      run.clear();
    }
  };
  for (let k = 0; k < 6; k++) run.choose(1), go(3600);
  const s = new Session();
  s.connect();
  await s.post("HeapProfiler.startSampling", { samplingInterval: 64 });
  for (let k = 0; k < 3; k++) run.choose(1), go(3600);
  const { profile } = await s.post("HeapProfiler.stopSampling");
  s.disconnect();
  const mine = [];
  let bytes = 0;
  const walk = (n) => {
    if (n.selfSize && n.callFrame.url.includes("/pieces/wheelie/")) (bytes += n.selfSize), mine.push(`${n.callFrame.functionName || "(anonymous)"} ${n.callFrame.url.split("/").pop()}: ${n.selfSize} B`);
    for (const c of n.children) walk(c);
  };
  walk(profile.head);
  // One object a step would be ≥ 16 B × 10,800 steps (170 KB+), and the ground is sampled ~20 times a
  // step; what can show is the JIT's one-off (a feedback vector, an on-stack replacement), a few KB.
  assert.ok(bytes < 40000, `no allocation per step in the piece's code: ${bytes} B in 180 s (${mine.join(", ")})`);
});
