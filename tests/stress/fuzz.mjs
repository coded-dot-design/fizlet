// P2 fuzz: seeded random calls against the public API: the kernel (createEngine, Pool, EventRing,
// seeded, Ledger, the engine's lifecycle) and the DOM-free bricks (fx, steer, rules, collide, grid,
// perf, presence), plus camera and timeline on the stub page.
//   npm run test:stress -- fuzz [--seed 1] [--runs 10000] [--ops 12] [--only <run>] [--self-test]
// Every run builds a fresh stub page and engine, makes some bricks, then makes `--ops` random calls.
// Each argument is a documented value (in the range the API's docs and types give) or a hostile one:
// NaN, ±Infinity, negative, huge, -0, a string, null, an object. After each call it runs two frames
// and scans every slot it can see. A finding is:
//   doc-throw       a documented call threw                                   (high)
//   deferred-throw  a later frame threw because of an earlier call            (high)
//   nan-state       NaN or ±Infinity in a state slot afterwards               (high if documented, med if not)
//   stall           a running engine stopped stepping                         (high)
//   unbounded       a bounded thing grew past its cap                         (med)
//   unclear-error   an undocumented input threw a raw JS error, not a named one (low)
//   recall          destroy() did not give the stub page back byte for byte   (crit)
//   lifecycle-throw a call after destroy (or a double destroy) threw          (high)
//   hang            the call never returns (an infinite loop; not called, see huge.mjs) (crit)
//   crash           a huge capacity takes the process down (OOM/hang) instead of throwing (med; not called, see huge.mjs)
// Undocumented inputs that are silently accepted without harm are counted (silentAccepts), not findings.
// Rerun one run exactly: `--seed <seed> --only <run>`. --self-test adds a fixture brick that corrupts
// on NaN and leaves a style behind; the fuzz must report both.
import { selfRun, flags, prng, badSlots } from "./lib/util.mjs";
import { stubPage, snapshot } from "./lib/stub-dom.mjs";

const K = await import("../../src/index.ts");
const FX = await import("../../src/fx.ts");
const ST = await import("../../src/steer.ts");
const RU = await import("../../src/rules.ts");
const CO = await import("../../src/collide.ts");
const GR = await import("../../src/grid.ts");
const CA = await import("../../src/camera.ts");
const TL = await import("../../src/timeline.ts");
const PF = await import("../../src/perf.ts");
const PR = await import("../../src/presence.ts");

const HOSTILE = [NaN, Infinity, -Infinity, -1, -1e9, 1e9, 2 ** 53, 1e308, -0, 0, 0.5, "5", "abc", "", null, undefined, {}, true];
const label = (v) => (typeof v === "number" ? (Number.isNaN(v) ? "NaN" : Object.is(v, -0) ? "-0" : !isFinite(v) ? String(v) : Math.abs(v) >= 1e9 ? "huge" : v < 0 ? "negative" : v % 1 ? "fraction" : v === 0 ? "0" : "int") : v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

// Argument kinds: a documented generator and the test of whether a value is documented.
const KINDS = {
  num: { gen: (r) => r() * 2000 - 1000, ok: (v) => typeof v === "number" && isFinite(v) },
  coord: { gen: (r) => r() * 640, ok: (v) => typeof v === "number" && isFinite(v) && Math.abs(v) < 1e6 },
  pos: { gen: (r) => 0.05 + r() * 8, ok: (v) => typeof v === "number" && isFinite(v) && v > 0 && v < 1e6 },
  dt: { gen: (r) => r() * 0.1, ok: (v) => typeof v === "number" && isFinite(v) && v >= 0 && v < 1e3 },
  int: { gen: (r) => 1 + ((r() * 64) | 0), ok: (v) => Number.isInteger(v) && v > 0 && v <= 1e5 },
  idx: { gen: (r) => (r() * 8) | 0, ok: (v) => Number.isInteger(v) && v >= 0 && v < 8 },
  stick: { gen: (r) => r() * 2 - 1, ok: (v) => typeof v === "number" && v >= -1 && v <= 1 },
  busy: { gen: (r) => (r() < 0.2 ? undefined : r() * 5), ok: (v) => v === undefined || Number.isNaN(v) || (typeof v === "number" && v >= 0 && isFinite(v)) },
  seat: { gen: (r) => (r() * 2) | 0, ok: (v) => v === 0 || v === 1 },
  players: { gen: (r) => 2 + ((r() * 7) | 0), ok: (v) => Number.isInteger(v) && v >= 2 && v <= 32 },
  delay: { gen: (r) => (r() * 8) | 0, ok: (v) => Number.isInteger(v) && v >= 0 && v <= 7 },
  cap16: { gen: (r) => 16 + ((r() * 48) | 0), ok: (v) => Number.isInteger(v) && v >= 16 && v <= 1e5 },
  zoom: { gen: (r) => 1 + r() * 3, ok: (v) => typeof v === "number" && v >= 1 && v <= 4 },
};
const val = (kind, r, hostile) => (hostile ? HOSTILE[(r() * HOSTILE.length) | 0] : KINDS[kind].gen(r));

// ---------- The world a run fuzzes: an engine on a stub page, and bricks made on demand ----------
function newWorld(seed) {
  const page = stubPage(), before = snapshot(page.body);
  const e = K.createEngine({ seed, settle: 30 });
  e.start();
  const w = { page, before, e, b: {}, dead: false, extra: [] };
  return w;
}
// Documented makers: each brick on the run's engine with options in their documented range.
const MAKE = {
  fx: (w) => ({ fx: FX.effects({ cap: 64 }) }),
  emit: (w) => {
    const fx = (w.b.fx ??= MAKE.fx(w)).fx;
    return { em: FX.emitter(fx, FX.KINDS), fx };
  },
  steer: (w) => ({ st: ST.steer({ cap: 8, random: w.e.random }) }),
  waves: (w) => {
    const alive = new Float64Array(1);
    return { wv: RU.waves(w.e, { alive: () => alive[0], prepare: 0.1, rebuild: 0.1 }), alive };
  },
  drops: (w) => ({ dr: RU.drops(w.e, { kinds: ["a", "b"], every: 0.05, cap: 6, place: (o) => ((o[0] = 10), (o[1] = 10)) }) }),
  score: (w) => ({ sc: RU.score(w.e, { levels: [5, 20, 80] }) }),
  grid: () => ({ g: new CO.Grid(32, 8, 640, 480), out: new Int32Array(8) }),
  board: () => ({ bd: new GR.Board(16, 12), out: new Int32Array(64) }),
  ring: () => ({ fr: new PF.FrameRing(16) }),
  pool: (w) => ({ p: w.e.pool("fuzz", 8, () => ({ v: 0 })) }),
  camera: (w) => ({ cam: CA.camera(w.e, w.page.stage, { motion: true }) }),
  timeline: (w) => {
    const arr = new Float64Array(2);
    const tl = TL.timeline(w.e, { motion: true }).to(arr, { 0: [0, 10] }, { dur: 0.3 }).to(w.page.wrap, { opacity: ["0.2", "1"] }, { dur: 0.3 });
    return { tl, arr };
  },
  presence: (w) => {
    const link = PR.memory({ peers: 2, latency: 1, seed: 1 }), sim = new Uint32Array(2);
    const p = PR.presence(w.e, { transport: link.ends[0], slot: 0, players: 2, input: () => 1, step: (_, i) => (sim[0] += i[0]), hash: () => sim[0] });
    // The other seat echoes inputs so lockstep keeps moving.
    link.ends[1].listen((d) => d[0] === PR.INPUT && ((w.echo ??= new Uint8Array(12)).set(d), (w.echo[1] = 1), link.ends[1].send(w.echo)));
    return { p, link, sim };
  },
  ledger: () => ({}),
};
const need = (w, k) => (w.b[k] ??= MAKE[k](w));
/** A valid cell id on the run's board. */
const cell = (w, i) => Number.isInteger(i) && i >= 0 && i < w.b.board.bd.cols * w.b.board.bd.rows;
/** The run's board has a real size (Board(null, 12) builds one with 0 columns, whose searches never end). */
const sized = (w) => { const { cols, rows } = w.b.board.bd; return Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0; };

// ---------- The op table: one entry per public call (name, brick it needs, argument kinds, call) ----------
// A constructor op makes a fresh brick from fuzzed options and puts it in the world, so later ops and
// frames run on whatever state it built.
const OPS = [
  // kernel: options, lifecycle, time
  { name: "createEngine({step,maxSteps,seed,events,settle,fps})", args: ["pos", "int", "num", "int", "pos", "pos"], crashArg: 3, call: (w, [step, maxSteps, seed, events, settle, fps]) => {
    const e = K.createEngine({ step, maxSteps, seed, events, settle, fps });
    w.extra.push(e);
    e.start(), e.advance(0.05), e.destroy();
  } },
  { name: "engine.advance(sec)", args: ["dt"], call: (w, [s]) => w.e.advance(s) },
  { name: "engine.busy(sec)", args: ["busy"], call: (w, [s]) => w.e.busy(s) },
  { name: "engine.frame(now)", args: ["pos"], call: (w, [n]) => (w.e.frame(n * 1000), w.e.frame(n * 1000 + 16.7)) },
  { name: "engine.start()", args: [], call: (w) => w.e.start() },
  { name: "engine.stop()", args: [], call: (w) => w.e.stop() },
  { name: "engine.wake()", args: [], call: (w) => w.e.wake() },
  { name: "engine.destroy()", args: [], call: (w) => (w.e.destroy(), (w.dead = true)) },
  { name: "engine.pool(name,cap)", args: ["int"], crashArg: 0, call: (w, [cap]) => (w.b.pool = { p: w.e.pool("fz", cap, () => ({ v: 0 })) }) },
  { name: "new Pool(cap)", args: ["int"], crashArg: 0, call: (w, [cap]) => new K.Pool(cap, () => ({})) },
  { name: "pool.acquire()×(n)", args: ["int"], need: "pool", call: (w, [n], b) => { for (let i = 0; i < Math.min(n, 1e4); i++) b.p.acquire(); } },
  { name: "pool.releaseAt(i)", args: ["idx"], need: "pool", call: (w, [i], b) => b.p.releaseAt(i) },
  { name: "new EventRing(cap)", args: ["int"], crashArg: 0, call: (w, [cap]) => new K.EventRing(cap) },
  { name: "events.emit(type,a,b,x,y,v)", args: ["num", "num", "coord", "coord", "num"], call: (w, a) => w.e.events.emit("fz", ...a) },
  { name: "seeded(seed)", args: ["num"], call: (w, [s]) => {
    const r = K.seeded(s), x = r();
    if (!(x >= 0 && x < 1)) throw new Error("seeded: out of [0,1)");
    // A non-number seed is silently a different seed: report it as an accept (same sequence as 0).
    if (!KINDS.num.ok(s) && K.seeded(0)() === x) w.silent = "seeded(" + label(s) + ") is seeded(0)";
  } },
  { name: "ledger.style(el,prop,value)", args: [], call: (w) => w.e.ledger.style(w.page.bare, "color", "blue") },
  { name: "ledger.attr/cls/text/add", args: [], call: (w) => {
    const L = w.e.ledger, p = w.page;
    L.attr(p.stage, "data-x", "2"), L.cls(p.wrap, "fz", true), L.text(p.text, "Hi"), p.body.append(L.add(p.doc.createElement("canvas")));
  } },
  // fx
  { name: "effects({cap,scorch})", args: ["int", "int"], call: (w, [cap, sc]) => (w.b.fx = { fx: FX.effects({ cap, scorch: sc }) }) },
  { name: "fx.blast(x,y,power,tint)", args: ["coord", "coord", "pos", "idx"], need: "fx", call: (w, a, b) => b.fx.blast(...a) },
  { name: "fx.word(x,y,w,c,size)", args: ["coord", "coord", "idx", "idx", "pos"], need: "fx", call: (w, a, b) => b.fx.word(...a) },
  { name: "fx.kick(amount)", args: ["pos"], need: "fx", call: (w, [a], b) => b.fx.kick(a) },
  { name: "fx.gravity=", args: ["num"], need: "fx", call: (w, [g], b) => (b.fx.gravity = g) },
  { name: "fx.step(dt)", args: ["dt"], need: "fx", call: (w, [dt], b) => b.fx.step(dt) },
  { name: "fx.spawn(k,x,y,vx,vy,size,life,c)", args: ["idx", "coord", "coord", "num", "num", "pos", "pos", "idx"], need: "fx", call: (w, a, b) => b.fx.spawn(...a) },
  { name: "emitter.emit(k,x,y,n,c,cn,scale)", args: ["idx", "coord", "coord", "int", "idx", "int", "pos"], need: "emit", call: (w, [k, ...a], b) => b.em.emit(6 + (k % 4), ...a) },
  // steer
  { name: "steer({cap,speed,turn,stop})", args: ["int", "pos", "pos", "pos"], call: (w, [cap, speed, turn, stop]) => (w.b.steer = { st: ST.steer({ cap, speed, turn, stop, random: w.e.random }) }) },
  { name: "steer.place(i,x,y,heading)", args: ["idx", "coord", "coord", "num"], need: "steer", call: (w, a, b) => b.st.place(...a) },
  { name: "steer.drive(i,ax,ay,dt)", args: ["idx", "stick", "stick", "dt"], need: "steer", call: (w, a, b) => b.st.drive(...a) },
  { name: "steer.seek(i,tx,ty,dt,pace)", args: ["idx", "coord", "coord", "dt", "pos"], need: "steer", call: (w, a, b) => b.st.seek(...a) },
  { name: "steer.flee(i,fx,fy,dt,pace)", args: ["idx", "coord", "coord", "dt", "pos"], need: "steer", call: (w, a, b) => b.st.flee(...a) },
  { name: "steer.arrive(i,tx,ty,dt)", args: ["idx", "coord", "coord", "dt"], need: "steer", call: (w, a, b) => b.st.arrive(...a) },
  { name: "steer.wander(i,dt,pace)", args: ["idx", "dt", "pos"], need: "steer", call: (w, a, b) => b.st.wander(...a) },
  { name: "steer.patrol(i,points,dt)", args: ["idx", "dt"], need: "steer", call: (w, [i, dt], b) => b.st.patrol(i, [0, 0, 100, 100], dt) },
  { name: "turn(from,to,max)", args: ["num", "num", "pos"], call: (w, a) => ST.turn(...a) },
  // rules
  { name: "waves({cap,prepare,rebuild})", args: ["int", "dt", "dt"], call: (w, [cap, prepare, rebuild]) => {
    const alive = new Float64Array(1);
    w.b.waves = { wv: RU.waves(w.e, { alive: () => alive[0], cap, prepare, rebuild }), alive };
  } },
  { name: "waves.spawned()", args: [], need: "waves", call: (w, a, b) => b.wv.ready() && (b.wv.spawned(), b.alive[0]++) },
  { name: "drops({cap,every,life,fall,speed})", args: ["int", "dt", "pos", "pos", "pos"], call: (w, [cap, every, life, fall, speed]) => (w.b.drops = { dr: RU.drops(w.e, { kinds: ["a", "b"], cap, every, life, fall, speed, place: (o) => ((o[0] = 5), (o[1] = 5)) }) }) },
  { name: "drops.spawn(x,y,k)", args: ["coord", "coord", "idx"], need: "drops", call: (w, [x, y, k], b) => b.dr.spawn(x, y, k % 2) },
  { name: "drops.collect(x,y,r)", args: ["coord", "coord", "pos"], need: "drops", call: (w, a, b) => b.dr.collect(...a) },
  { name: "drops.scroll(dx,dy)", args: ["coord", "coord"], need: "drops", call: (w, a, b) => b.dr.scroll(...a) },
  { name: "score.add(points,xp,x,y)", args: ["int", "int", "coord", "coord"], need: "score", call: (w, a, b) => b.sc.add(...a) },
  { name: "score({combo:{window,step,max}})", args: ["pos", "int", "int"], call: (w, [window, step, max]) => (w.b.score = { sc: RU.score(w.e, { combo: { window, step, max } }) }) },
  // collide, grid
  { name: "new Grid(cell,cap,w,h)", args: ["pos", "int", "pos", "pos"], call: (w, [c, cap, ww, h]) => (w.b.grid = { g: new CO.Grid(c * 10, cap, ww * 80, h * 60), out: new Int32Array(8) }) },
  { name: "grid.insert(id,x,y,r)", args: ["idx", "coord", "coord", "pos"], need: "grid", call: (w, a, b) => b.g.insert(...a) },
  { name: "grid.query(x,y,r)", args: ["coord", "coord", "pos"], need: "grid", call: (w, a, b) => b.g.query(...a, b.out) },
  { name: "segCircle(x0,y0,x1,y1,cx,cy,r)", args: ["coord", "coord", "coord", "coord", "coord", "coord", "pos"], call: (w, a) => CO.segCircle(...a) },
  { name: "new Board(cols,rows)", args: ["int", "int"], call: (w, [c, r]) => (w.b.board = { bd: new GR.Board(c, r), out: new Int32Array(64) }) },
  { name: "board.los(a,b)", args: ["idx", "idx"], need: "board", hangIf: ([a, b], w) => !sized(w) || !cell(w, a) || !cell(w, b), call: (w, [a, z], b) => b.bd.los(a, z) },
  { name: "board.flood(from,max)", args: ["idx", "pos"], need: "board", hangIf: (a, w) => !sized(w), call: (w, [a, m], b) => {
    const n = b.bd.flood(a, m, b.out);
    if (!cell(w, a) && n > 0) w.silent = `flood(${label(a)}) returned ${n} cells`;
  } },
  { name: "board.path(from,to)", args: ["idx", "idx"], need: "board", hangIf: ([a], w) => !sized(w) || !cell(w, a), call: (w, [a, z], b) => b.bd.path(a, z, b.out) },
  { name: "board.at(x,y)", args: ["coord", "coord"], need: "board", call: (w, [x, y], b) => {
    const i = b.bd.at(x, y);
    if (!(Number.isInteger(i) && i >= 0 && i < b.bd.cols * b.bd.rows)) throw new Error(`board.at: not a cell id (${i})`);
  } },
  { name: "board.set(i,terrain,cost,flags)", args: ["idx", "idx", "int", "idx"], need: "board", call: (w, a, b) => b.bd.set(...a) },
  // perf
  { name: "new FrameRing(cap)", args: ["int"], call: (w, [cap]) => (w.b.ring = { fr: new PF.FrameRing(cap) }) },
  { name: "frameRing.push(ms)", args: ["pos"], need: "ring", call: (w, [ms], b) => b.fr.push(ms) },
  // presence
  { name: "memory({peers,latency,jitter,cap})", args: ["int", "idx", "idx", "int"], call: (w, [peers, latency, jitter, cap]) => {
    const m = PR.memory({ peers: Math.min(peers, 8), latency, jitter, cap });
    const msg = new Uint8Array(12);
    for (let i = 0; i < 40; i++) m.ends[0]?.send(msg), m.tick();
    w.b.mem = { m, cap };
  } },
  { name: "presence({slot,players,delay,cap})", args: ["seat", "players", "delay", "cap16"], crashArg: 3, call: (w, [slot, players, delay, cap]) => {
    const link = PR.memory({ peers: 2 });
    PR.presence(w.e, { transport: link.ends[0], slot, players, delay, cap, input: () => 0, step() {} });
  } },
  // camera, timeline (stub page)
  { name: "camera({ease,min,max})", args: ["pos", "zoom", "zoom"], call: (w, [ease, min, max]) => (w.b.camera = { cam: CA.camera(w.e, w.page.stage, { ease, min, max, motion: true }) }) },
  { name: "camera.to(x,y,zoom,px,py)", args: ["coord", "coord", "zoom", "coord", "coord"], need: "camera", call: (w, a, b) => b.cam.to(...a) },
  { name: "camera.pan(dx,dy)", args: ["coord", "coord"], need: "camera", call: (w, a, b) => b.cam.pan(...a) },
  { name: "zoomAt/flyTo/fit", args: ["coord", "coord", "zoom"], need: "camera", call: (w, [x, y, z], b) => (CA.zoomAt(b.cam, x, y, z), CA.flyTo(b.cam, x, y, z), CA.fit(b.cam, x, y, 100, 100)) },
  { name: "timeline({rate,repeat})", args: ["pos", "idx"], call: (w, [rate, repeat]) => {
    const arr = new Float64Array(2);
    w.b.timeline = { tl: TL.timeline(w.e, { rate, repeat, motion: true }).to(arr, { 0: [0, 1] }, { dur: 0.2 }), arr };
  } },
  { name: "timeline.to(arr,{dur,delay,stagger})", args: ["pos", "dt", "dt"], need: "timeline", call: (w, [dur, delay, stagger], b) => b.tl.to(b.arr, { 1: [0, 5] }, { dur, delay, stagger }) },
  { name: "timeline.seek(t)", args: ["dt"], need: "timeline", call: (w, [t], b) => b.tl.seek(t) },
  { name: "timeline.play/reverse/pause/finish/revert", args: ["idx"], need: "timeline", call: (w, [k], b) => b.tl[["play", "reverse", "pause", "finish", "revert", "play", "play", "reverse"][k % 8]]() },
];
// The self-test fixture: a "brick" that turns NaN into state and writes a style it never records.
const FIXTURE = [
  { name: "fixture.set(v)", args: ["num"], need: "fixture", call: (w, [v], b) => (b.s[0] = v) },
  { name: "fixture.paint()", args: [], need: "fixture", call: (w) => w.page.stage.style.setProperty("outline", "1px solid red") },
];
MAKE.fixture = () => ({ s: new Float64Array(1) });

const CLEAR = /^(fizlet|Grid|effects|presence|timeline|camera|steer|rules|Board|board|perf|seeded|pool|events)\b/;
const isClear = (err) => err instanceof Error && CLEAR.test(err.message);

/** Every slot a run can see: the engine, then each brick made so far. */
function scanWorld(w) {
  const e = w.e, s = { "engine.timing": e.timing, "engine.time": e.time, "engine.steps": e.steps };
  const b = w.b;
  if (b.fx) b.fx.fx.raw.f.forEach((a, i) => (s["fx.f" + i] = a)), (s["fx.shake"] = b.fx.fx.shake);
  if (b.steer) for (const k of ["x", "y", "a", "gx", "gy", "think", "moved"]) s["steer." + k] = b.steer.st[k];
  if (b.waves) (s["waves.countdown"] = b.waves.wv.countdown), (s["waves.left"] = b.waves.wv.left), (s["waves.limit"] = b.waves.wv.limit);
  if (b.drops) for (const k of ["x", "y", "age", "landY"]) s["drops." + k] = b.drops.dr[k].subarray(0, Math.min(b.drops.dr.count, b.drops.dr.x.length));
  if (b.score) (s["score.points"] = b.score.sc.points), (s["score.xp"] = b.score.sc.xp), (s["score.combo"] = b.score.sc.combo);
  if (b.ring) (s["frameRing.ms"] = b.ring.fr.ms), (s["frameRing.head"] = b.ring.fr.head);
  if (b.camera) (s["camera.zoom"] = b.camera.cam.zoom), (s["camera.width"] = b.camera.cam.width), (s["camera.toWorld"] = b.camera.cam.toWorld(1, 1, new Float64Array(2)));
  if (b.timeline) (s["timeline.time"] = b.timeline.tl.time), (s["timeline.target"] = b.timeline.arr);
  if (b.fixture) s["fixture.s"] = b.fixture.s;
  return badSlots(s, 3, 4096);
}
/** Bounded things past their cap: [what, size, cap]. */
function overCap(w) {
  const b = w.b, out = [];
  if (b.drops && !(b.drops.dr.count <= b.drops.dr.x.length)) out.push(["drops.count", b.drops.dr.count, b.drops.dr.x.length]);
  if (b.mem && !(b.mem.m.queued <= (b.mem.cap ?? 1024))) out.push(["memory.queued", b.mem.m.queued, b.mem.cap]);
  if (b.fx && !(b.fx.fx.live <= b.fx.fx.raw.cap)) out.push(["fx.live", b.fx.fx.live, b.fx.fx.raw.cap]);
  if (b.pool && !(b.pool.p.size <= b.pool.p.cap)) out.push(["pool.size", b.pool.p.size, b.pool.p.cap]);
  if (b.waves && !(b.waves.wv.limit >= 1)) out.push(["waves.limit", b.waves.wv.limit, ">= 1"]);
  return out;
}

const TIMES = new Map();
const CTOR = /^(new |createEngine|effects|steer\(|waves\(|drops\(|score\(|memory|presence|camera\(|timeline\(|engine\.pool)/;
export function fuzzRun(seed, run, nOps, ops, trace = false) {
  const r = prng((seed * 2654435761 + run * 40503) >>> 0);
  const realRandom = Math.random;
  Math.random = r; // fx seeds its visual LCG from Math.random: keep the run exact
  const w = newWorld(seed + run);
  const found = [];
  const add = (kind, op, args, extra) => found.push({ kind, op, args: args.map((v) => (v === "ok" ? "ok" : label(v))), ...extra });
  let silent = 0, skippedHuge = 0;
  try {
    for (let k = 0; k < nOps; k++) {
      const op = ops[(r() * ops.length) | 0];
      const hostile = op.args.length > 0 && r() < 0.4;
      // One hostile argument at a time, so a finding names the argument that caused it.
      const at = hostile ? (r() * op.args.length) | 0 : -1;
      const args = op.args.map((kind, i) => val(kind, r, i === at));
      const documented = op.args.every((kind, i) => KINDS[kind].ok(args[i]));
      const shown = args.map((v, i) => (i === at ? v : KINDS[op.args[i]].ok(v) ? "ok" : v));
      const bad = shown.map((v) => (v === "ok" ? { label: "ok" } : v));
      if (trace) console.error(`run ${run} op ${k}: ${op.name} (${args.map(label)})`);
      // A huge capacity here takes the whole process down (heap OOM after tens of seconds, or a hang
      // filling a multi-GB array): measured once with tests/stress/huge.mjs, recorded, never called.
      const big = op.crashArg != null && typeof args[op.crashArg] === "number" && args[op.crashArg] >= 1e7 && args[op.crashArg] < Infinity;
      if (big) {
        add("crash", op.name, args.map((v, i) => (i === op.crashArg ? v : "ok")), { note: "process OOM or hang, no error: npm run test:stress -- huge" });
        continue;
      }
      // Any other constructor given a huge count is measured in a child by huge.mjs too: here it would
      // page in gigabytes on a shared machine (effects({ scorch: 1e9 }) walks 4 GB a step).
      if (CTOR.test(op.name) && args.some((v) => typeof v === "number" && v >= 1e7 && v < Infinity)) {
        skippedHuge++;
        continue;
      }
      const b = op.need ? need(w, op.need) : null;
      // A call that never returns (measured once by tests/stress/huge.mjs in a child): recorded, not called.
      if (op.hangIf?.(args, w)) {
        const why = sized(w) ? "" : `on Board(${label(w.b.board.bd.cols)}, ${label(w.b.board.bd.rows)})`;
        add("hang", op.name + why, args.map((v) => (sized(w) && cell(w, v) ? "ok" : v)), { note: "infinite loop: npm run test:stress -- huge" });
        continue;
      }
      const steps0 = w.e.steps, wasRunning = w.e.running;
      let threw = null;
      w.silent = null;
      const c0 = performance.now();
      try {
        op.call(w, args, b);
      } catch (err) {
        threw = err;
      }
      TIMES.set(op.name, (TIMES.get(op.name) ?? 0) + performance.now() - c0);
      const argsOut = bad.map((v) => (v && v.label === "ok" ? "ok" : v));
      if (threw) {
        if (documented) add(w.dead ? "lifecycle-throw" : "doc-throw", op.name, argsOut, { error: String(threw) });
        else if (!isClear(threw)) add("unclear-error", op.name, argsOut, { error: String(threw) });
        continue;
      }
      // Two frames on whatever state the call left (a destroyed engine must stay inert and quiet).
      const t0 = w.e.steps;
      try {
        w.e.advance(1 / 30);
        w.e.advance(1 / 30);
      } catch (err) {
        add(w.dead ? "lifecycle-throw" : "deferred-throw", op.name, argsOut, { error: String(err) });
        continue;
      }
      const nan = scanWorld(w);
      if (nan.length) add("nan-state", op.name, argsOut, { documented, slots: nan });
      const stalled = !w.dead && w.e.steps === t0;
      if (stalled) add("stall", op.name, argsOut, { documented, steps: w.e.steps, running: wasRunning });
      const over = overCap(w);
      if (over.length) add("unbounded", op.name, argsOut, { over });
      if (!documented && !nan.length && !over.length && w.e.steps !== t0) silent++;
      if (w.silent) add("silent-accept", op.name, argsOut, { note: w.silent });
      if (nan.length || over.length || stalled) break; // later ops would only repeat this one
    }
    // Recall: destroy (twice), then calls after destroy must be inert; the page must be back exactly.
    try {
      w.e.destroy();
      w.e.destroy();
      w.e.start();
      w.e.advance(1 / 30);
      w.e.busy(1);
      w.e.stop();
    } catch (err) {
      add("lifecycle-throw", "destroy/after-destroy", [], { error: String(err) });
    }
    for (const e of w.extra) e.destroy();
    const after = snapshot(w.page.body);
    if (after !== w.before) add("recall", "destroy()", [], { before: w.before, after });
  } finally {
    Math.random = realRandom;
  }
  return { found, silent, skippedHuge };
}

const SEVERITY = (f) => (f.kind === "recall" || f.kind === "hang" ? "crit" : f.kind === "crash" ? "med" : f.kind === "doc-throw" || f.kind === "deferred-throw" || f.kind === "stall" || f.kind === "lifecycle-throw" || (f.kind === "nan-state" && f.documented) ? "high" : f.kind === "nan-state" || f.kind === "unbounded" ? "med" : "low");

export async function fuzz(o, ops = OPS) {
  const t0 = performance.now(), byKey = new Map();
  let silent = 0, skippedHuge = 0;
  const runs = o.only != null ? [o.only] : Array.from({ length: o.runs }, (_, i) => i);
  for (const run of runs) {
    const res = fuzzRun(o.seed, run, o.ops, ops, o.trace);
    silent += res.silent;
    skippedHuge += res.skippedHuge;
    for (const f of res.found) {
      const key = `${f.kind} ${f.op} ${f.args.join(",")}`;
      const had = byKey.get(key);
      if (had) had.count++;
      else byKey.set(key, { severity: SEVERITY(f), ...f, count: 1, seed: o.seed, run, rerun: `npm run test:stress -- fuzz --seed ${o.seed} --only ${run}` });
    }
  }
  const order = { crit: 0, high: 1, med: 2, low: 3 };
  const findings = [...byKey.values()].sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
  const bySeverity = { crit: 0, high: 0, med: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity]++;
  return {
    pass: findings.length === 0,
    rerun: `npm run test:stress -- fuzz --seed ${o.seed} --runs ${o.runs}`,
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
    runs: runs.length, opsPerRun: o.ops, ops: ops.length, silentAccepts: silent, skippedHuge,
    slowestOpsMs: [...TIMES].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)]),
    bySeverity, findings,
  };
}

export async function main(argv) {
  const o = flags(argv, { seed: 1, runs: 10_000, ops: 12, only: null, "self-test": false, trace: false });
  if (o["self-test"]) {
    // The fixture alone must be caught: a NaN in its state and a style that outlives destroy().
    const r = await fuzz({ ...o, runs: 200 }, FIXTURE);
    const kinds = new Set(r.findings.map((f) => f.kind));
    return { pass: kinds.has("nan-state") && kinds.has("recall"), selfTest: true, caught: [...kinds], bySeverity: r.bySeverity };
  }
  return fuzz(o);
}

await selfRun(import.meta.url, "fuzz", main);
