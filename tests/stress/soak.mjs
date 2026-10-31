// P1 soak: the kernel and every DOM-free brick (plus camera and timeline on the stub page) for
// `--steps` fixed steps (default 10,000,000) in one Node process.
//   npm run test:stress -- soak [--steps 10000000] [--window 1000000] [--seed 1] [--self-test]
// Pass: heap flat (max − min ≤ 1 MB over every window after the warm-up window), 0 young GCs in
// every window after warm-up, no NaN or ±Infinity in any slot it can see, and Recall restores the
// stub page byte for byte at the end. It also measures what it can't pass/fail: float drift of the
// engine clock and the timeline playhead, the busy(sec) hold that spans the run, the event ring's
// `dropped` counter crossing 2^30 (the Smi limit), pools held at capacity.
// --self-test: a fixture system that leaks an object per step and writes NaN; the soak must fail.
import { selfRun, flags, prng, youngGCs, badSlots, heap } from "./lib/util.mjs";
import { stubPage, snapshot } from "./lib/stub-dom.mjs";

const { createEngine, seeded } = await import("../../src/index.ts");
const { effects, emitter, KINDS } = await import("../../src/fx.ts");
const { steer } = await import("../../src/steer.ts");
const { waves, drops, score } = await import("../../src/rules.ts");
const { Grid } = await import("../../src/collide.ts");
const { Board, BLOCKED } = await import("../../src/grid.ts");
const { camera } = await import("../../src/camera.ts");
const { timeline } = await import("../../src/timeline.ts");
const { FrameRing } = await import("../../src/perf.ts");
const { presence, memory, hash32 } = await import("../../src/presence.ts");

const MB = 1024 * 1024;

/** Builds the soak world. `leak`: the self-test fixture (a growing array and a NaN write). */
export function world(seed, steps, leak = false, skip = new Set()) {
  const on = (k) => !skip.has(k), dom = on("dom");
  const page = stubPage(), before = snapshot(page.body);
  const rnd = prng(seed);
  const A = createEngine({ seed, events: 256 }); // every brick
  const B = createEngine({ seed, settle: 0.5 }); // a busy(sec) hold spanning the run
  const C = createEngine({ seed }); // presence peer 1
  const D = createEngine({ seed, events: 64 }); // the event ring held over capacity
  const dt = A.dt;
  const hold = Math.round(steps * 0.6) * dt; // seconds of engine time B is held awake

  // Pools at capacity: always full, 8 released and 9 asked for every step (the 9th is refused).
  const pool = A.pool("bodies", 256, () => ({ x: 0, y: 0 }));
  while (pool.acquire());
  const refused = new Float64Array(1);
  A.add({
    step() {
      if (!on("pool")) return;
      for (let k = 0; k < 8; k++) pool.releaseAt((rnd() * pool.size) | 0);
      for (let k = 0; k < 9; k++) if (!pool.acquire()) refused[0]++;
    },
  });

  // Effects at capacity: blasts and sprays faster than particles age out.
  const fx = effects({ cap: 420 });
  const sprayer = emitter(fx, KINDS);
  // Movers on the seeded random.
  const st = steer({ cap: 64, random: A.random, area: [0, 0, 640, 480] });
  for (let i = 0; i < 64; i++) st.place(i, rnd() * 640, rnd() * 480, 0);
  const route = new Float64Array([40, 40, 600, 40, 600, 440, 40, 440]);
  // Rules: waves feed a counter of alive enemies, drops fall and get collected, score with levels.
  const alive = new Float64Array(1);
  const wv = waves(A, { alive: () => alive[0], prepare: 1, rebuild: 2 });
  const dr = drops(A, { kinds: ["ammo", "health"], every: 0.25, cap: 6, place: (out) => ((out[0] = 320), (out[1] = 240)) });
  const sc = score(A, { levels: [10, 100, 1000, 1e4, 1e5, 1e6] });
  // Collide grid and a pathfinding board.
  const grid = new Grid(32, 64, 640, 480), hits = new Int32Array(64);
  const board = new Board(48, 32);
  board.scatter(A.random, 0.2, 1);
  const path = new Int32Array(256);
  // Camera and timeline on the stub page (writes through A's ledger).
  const cam = camera(A, page.stage, { motion: true });
  const arr = new Float64Array(2);
  const tl = timeline(A, { repeat: Infinity, yoyo: true, motion: true })
    .to(arr, { 0: [0, 100] }, { dur: 0.7, ease: "inOut" });
  if (dom) tl.to(page.wrap, { opacity: ["0", "1"], translate: ["0px 0px", "40px 10px"] }, { dur: 0.5, at: 0.2 });
  tl.label("mid", 0.35);
  if (on("timeline")) tl.play();
  const ring = new FrameRing(120);
  // Presence: A is seat 0, C seat 1, over an in-memory link with latency and jitter.
  const link = memory({ peers: 2, latency: 1, jitter: 1, seed });
  const simA = new Uint32Array(4), simC = new Uint32Array(4);
  const bytesA = new Uint8Array(simA.buffer), bytesC = new Uint8Array(simC.buffer);
  const pA = presence(A, { transport: link.ends[0], slot: 0, players: 2, input: () => (A.steps & 7), step: (_, inp) => ((simA[0] += inp[0]), (simA[1] += inp[1])), hash: () => hash32(bytesA) });
  const pC = presence(C, { transport: link.ends[1], slot: 1, players: 2, input: () => (C.steps & 3), step: (_, inp) => ((simC[0] += inp[0]), (simC[1] += inp[1])), hash: () => hash32(bytesC) });

  // The game: one system that drives every brick from the step, like a real game would.
  const counts = new Float64Array(4); // labels seen, wave spawns, collects, paths
  const mid = "mid";
  A.add({
    step(e, dt) {
      const s = e.steps;
      if (on("fx")) {
        if (s % 6 === 0) fx.blast(rnd() * 640, rnd() * 480, 1 + rnd());
        if (s % 3 === 0) sprayer.emit(sprayer.ids.spark, rnd() * 640, rnd() * 480, 6, 0, 3);
        fx.step(dt);
      }
      if (on("steer")) {
        for (let i = 0; i < 32; i++) st.wander(i, dt);
        for (let i = 32; i < 48; i++) st.patrol(i, route, dt);
        for (let i = 48; i < 64; i++) st.seek(i, st.x[0], st.y[0], dt);
      }
      if (on("rules")) {
        if (wv.ready()) wv.spawned(), alive[0]++;
        if (alive[0] > 0 && rnd() < 0.05) alive[0]--;
        if (dr.count && dr.landed(0)) dr.collect(dr.x[0], dr.y[0], 4) && counts[2]++;
        if (s % 20 === 0) sc.add(1, 1);
        if (s % 300 === 0) sc.miss();
      }
      if (on("grid")) {
        grid.clear();
        for (let i = 0; i < 64; i++) grid.insert(i, st.x[i], st.y[i], 6);
        for (let i = 0; i < 8; i++) grid.query(st.x[i], st.y[i], 12, hits);
      }
      if (on("board") && s % 30 === 0) {
        const a = (rnd() * 1536) | 0, b = (rnd() * 1536) | 0;
        board.flags[a] &= ~BLOCKED;
        board.flags[b] &= ~BLOCKED;
        board.path(a, b, path, 600);
        counts[3]++;
      }
      if (!dom || !on("camera")) return;
      if (s % 240 === 0) cam.to(rnd() * 640, rnd() * 480, 1 + rnd() * 3);
      if (s % 50 === 25) cam.pan(rnd() * 20 - 10, rnd() * 20 - 10);
    },
    render(e) {
      for (let i = 0; i < e.events.size; i++) if (e.events.at(i).type === mid) counts[0]++;
      ring.push(e.timing[1]);
    },
  });

  // The ring over capacity on D: 128 emits a step into 64 slots. `dropped` starts just under the
  // point where it crosses 2^30 (V8's small-integer limit) a quarter of the way in.
  const drops64 = Math.max(1, Math.floor(steps * 0.25) * 112);
  D.events.dropped = 2 ** 30 - drops64;
  D.add({
    step(e) {
      if (on("ring")) for (let i = 0; i < 128; i++) e.events.emit("tick", i);
    },
  });

  // The self-test fixture: a leak (an object a step, kept forever) and a NaN in a scanned slot.
  const leaked = [], sink = { v: null };
  if (leak)
    A.add({
      step(e) {
        // Kept forever (a leak: the heap grows; V8 pretenures it, so it shows as heap, not young GCs)…
        leaked.push({ step: e.steps, pad: new Array(256) });
        // …and short-lived garbage that escapes (young GCs: what a per-step allocation looks like).
        sink.v = { step: e.steps, pad: new Array(512) };
        if (e.steps === 1000) arr[1] = NaN;
      },
    });

  B.busy(hold);
  for (const e of [A, B, C, D]) e.start();
  const settledAt = new Float64Array([-1]);
  return {
    A, B, C, D, dt, hold, page, before, settledAt, counts, refused, tl, pA, pC, link, sc, wv, fx, pool,
    frame() {
      const sec = dt * 4; // four steps a frame: the catch-up cap
      A.advance(sec);
      if (on("presence")) C.advance(sec);
      D.advance(sec);
      B.advance(sec);
      if (on("presence")) link.tick(), link.tick();
      if (settledAt[0] < 0 && !B.running) settledAt[0] = B.steps;
    },
    scan() {
      const [X, Y, VX, VY, ROT, SPIN, SIZE, LIFE, MAX] = fx.raw.f;
      return badSlots({
        "engine.timing": A.timing, "fx.x": X, "fx.y": Y, "fx.vx": VX, "fx.vy": VY, "fx.rot": ROT, "fx.spin": SPIN, "fx.size": SIZE, "fx.life": LIFE, "fx.max": MAX,
        "steer.x": st.x, "steer.y": st.y, "steer.a": st.a, "steer.gx": st.gx, "steer.gy": st.gy, "steer.think": st.think, "steer.moved": st.moved,
        "drops.x": dr.x, "drops.y": dr.y, "drops.age": dr.age, "drops.landY": dr.landY, "perf.ring": ring.ms, "timeline.target": arr,
        "engine.time": A.time, "engine.steps": A.steps, "B.time": B.time, "waves.countdown": wv.countdown, "waves.left": wv.left,
        "score.points": sc.points, "camera.zoom": cam.zoom, "camera.width": cam.width, "timeline.time": tl.time, "fx.shake": fx.shake,
        "ring.dropped": D.events.dropped, "presence.frame": pA.frame,
      });
    },
    leaked,
  };
}

/** Runs one world for `steps` and measures it window by window. */
async function phase(o, steps, skip) {
  const win = Math.min(o.window, Math.max(10_000, Math.floor(steps / 10)));
  const w = world(o.seed, steps, o.leak, skip);
  const windows = [];
  let bad = [];
  for (let done = 0; done < steps; ) {
    const gcs = youngGCs(), target = Math.min(steps, done + win), w0 = performance.now();
    while (w.A.steps < target) w.frame();
    const young = await gcs.stop();
    done = w.A.steps;
    const h = heap(), b = w.scan();
    if (b.length && !bad.length) bad = b.map((x) => ({ ...x, step: done }));
    windows.push({ steps: done, heapMB: +(h / MB).toFixed(3), youngGCs: young, ms: Math.round(performance.now() - w0) });
    if (o.verbose) console.error(JSON.stringify(windows.at(-1)));
  }
  const after = windows.slice(1), heaps = after.map((x) => x.heapMB);
  const heapSpread = heaps.length ? +(Math.max(...heaps) - Math.min(...heaps)).toFixed(3) : 0;
  const youngMax = after.length ? Math.max(...after.map((x) => x.youngGCs)) : 0;
  // Young GCs per 1M steps, so a shorter window reads the same as the spec's bar.
  const youngPerM = after.length ? +((after.reduce((s, x) => s + x.youngGCs, 0) / (steps - windows[0].steps)) * 1e6).toFixed(2) : 0;
  const A = w.A, dt = w.dt;
  const drift = { engineTimeMinusStepsDt: A.time - A.steps * dt, stepsTimesDt: A.steps * dt, engineTime: A.time };
  const play = 0.7, expectLabels = Math.floor(w.tl.time / play);
  const labels = { seen: w.counts[0], expected: expectLabels, playhead: w.tl.time, playheadMinusEngine: w.tl.time - A.time };
  const settleStep = w.settledAt[0], expectSettle = Math.ceil((w.hold + 0.5) / dt - 1e-6);
  const hold = { holdSec: w.hold, settledAtStep: settleStep, expectedStep: expectSettle, offBySteps: settleStep < 0 ? null : settleStep - expectSettle };
  const ring = { dropped: w.D.events.dropped, crossedSmi: w.D.events.dropped > 2 ** 30 };
  const pools = { cap: w.pool.cap, used: w.pool.size, refused: w.refused[0] };
  const presenceR = { frameA: w.pA.frame, frameC: w.pC.frame, desyncA: w.pA.desync, desyncC: w.pC.desync, stallsA: w.pA.stalls, queued: w.link.queued, dropped: w.link.dropped };
  for (const e of [A, w.B, w.C, w.D]) e.destroy();
  const after2 = snapshot(w.page.body), recall = after2 === w.before;
  return { steps, heapSpread, youngMax, youngPerM, bad, drift, labels, hold, ring, pools, presence: presenceR, recall, before: w.before, after: after2, windows };
}

export async function soak(o) {
  const t0 = performance.now();
  const skip = new Set(String(o.skip || "").split(",").filter(Boolean));
  // Main phase: every DOM-free brick, gated on heap, young GCs and NaN. The stub page's style writes
  // (camera, the timeline's element track) allocate strings by design (render, change-only, and the
  // stub itself allocates), so they run in a shorter DOM phase gated on Recall and NaN only.
  const m = await phase(o, o.steps, new Set([...skip, "dom"]));
  const d = skip.has("dom") ? null : await phase({ ...o, verbose: false }, Math.min(o.steps, o["dom-steps"]), skip);
  const checks = {
    heapFlat: m.heapSpread <= 1,
    zeroYoungGCs: m.youngMax === 0,
    noNaN: m.bad.length === 0 && (!d || d.bad.length === 0),
    recallExact: !d || d.recall,
    labelsOnTime: Math.abs(m.labels.seen - m.labels.expected) <= 2,
    // Settle is checked once a frame (4 steps here): it may land up to 3 steps after the exact step, never before.
    holdSettles: m.hold.offBySteps !== null && m.hold.offBySteps >= 0 && m.hold.offBySteps < 4,
    presenceInSync: m.presence.desyncA < 0 && m.presence.desyncC < 0,
  };
  return {
    pass: Object.values(checks).every(Boolean),
    flags: o,
    rerun: `npm run test:stress -- soak --steps ${o.steps} --seed ${o.seed}`,
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
    checks,
    heapSpreadMB: m.heapSpread,
    youngGCsPerMillion: m.youngPerM,
    youngGCsMaxWindow: m.youngMax,
    nan: m.bad.length ? m.bad : d?.bad ?? [],
    drift: m.drift, labels: m.labels, hold: m.hold, ring: m.ring, pools: m.pools, presence: m.presence,
    dom: d && { steps: d.steps, recall: d.recall ? "exact" : { before: d.before, after: d.after }, heapSpreadMB: d.heapSpread, youngGCsPerMillion: d.youngPerM, nan: d.bad },
    windows: m.windows,
  };
}

export async function main(argv) {
  // --skip fx,camera,…: leave parts out (to bisect an allocation or a leak). Parts: pool fx steer rules
  // grid board camera timeline presence ring.
  const o = flags(argv, { steps: 10_000_000, window: 1_000_000, seed: 1, "self-test": false, verbose: false, skip: "", "dom-steps": 200_000 });
  if (o["self-test"]) {
    // The checks must catch a leak and a NaN: run the fixture briefly and expect those to fail.
    const r = await soak({ ...o, steps: 200_000, window: 20_000, "dom-steps": 20_000, leak: true });
    const pass = !r.pass && !r.checks.heapFlat && !r.checks.noNaN && !r.checks.zeroYoungGCs;
    return { pass, selfTest: true, caught: { heapFlat: !r.checks.heapFlat, noNaN: !r.checks.noNaN, zeroYoungGCs: !r.checks.zeroYoungGCs }, heapSpreadMB: r.heapSpreadMB, nan: r.nan };
  }
  return soak(o);
}

await selfRun(import.meta.url, "soak", main);
