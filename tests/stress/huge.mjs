// P2 (crashes and hangs): Board searches given a cell id that is not an integer on the board, and every constructor that takes a count, given a huge one (1e9 and 2^53), each in its
// own child process (512 MB heap, 15 s limit), so an out-of-memory crash or a hang is measured instead
// of taking the fuzz down with it. The fuzz records these as "crash" and never calls them.
//   npm run test:stress -- huge [--timeout 15000] [--self-test]
// Pass: each one either works or throws a named error ("fizlet: …", "Grid: …") — never a crash, a
// hang or a raw JS error. --self-test: a fixture that allocates an object per slot must read as a crash.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flags, selfRun } from "./lib/util.mjs";

const here = fileURLToPath(import.meta.url);
const CASES = {
  "new EventRing(cap)": (m, v) => new m.K.EventRing(v),
  "new Pool(cap)": (m, v) => new m.K.Pool(v, () => ({})),
  "engine.pool(name,cap)": (m, v) => m.K.createEngine().pool("x", v, () => ({})),
  "createEngine({events})": (m, v) => m.K.createEngine({ events: v }),
  "effects({cap})": (m, v) => m.FX.effects({ cap: v }),
  "effects({scorch}) + 1 step": (m, v) => m.FX.effects({ scorch: v }).step(1 / 60),
  "steer({cap})": (m, v) => m.ST.steer({ cap: v }),
  "new Grid(cell,cap,w,h)": (m, v) => new m.CO.Grid(32, v, 640, 480),
  "new Board(cols,rows)": (m, v) => new m.GR.Board(v, v),
  "new FrameRing(cap)": (m, v) => new m.PF.FrameRing(v),
  "memory({cap})": (m, v) => m.PR.memory({ peers: 2, cap: v }),
  "drops({cap})": (m, v) => m.RU.drops(m.K.createEngine(), { kinds: ["a"], cap: v }),
  "presence({cap})": (m, v) => m.PR.presence(m.K.createEngine(), { transport: m.PR.memory({ peers: 2 }).ends[0], slot: 0, players: 2, cap: v, input: () => 0, step() {} }),
};
// Calls that loop forever on a cell id that is not an integer on the board (value unused).
const HANGS = {
  "board.path(NaN,5)": (m) => new m.GR.Board(16, 12).path(NaN, 5, new Int32Array(64)),
  "board.path(1.5,5)": (m) => new m.GR.Board(16, 12).path(1.5, 5, new Int32Array(64)),
  "board.path('5',7)": (m) => new m.GR.Board(16, 12).path("5", 7, new Int32Array(64)),
  "board.los(0,1.5)": (m) => new m.GR.Board(16, 12).los(0, 1.5),
  "board.los(NaN,4)": (m) => new m.GR.Board(16, 12).los(NaN, 4),
  "new Board(null,12).flood(0,3)": (m) => new m.GR.Board(null, 12).flood(0, 3, new Int32Array(64)),
  "new Board(0,12).path(0,1)": (m) => new m.GR.Board(0, 12).path(0, 1, new Int32Array(64)),
};
const FIXTURE = { "fixture(cap)": (m, v) => Array.from({ length: v }, () => ({ v: 0 })) };
const VALUES = [1e9, 2 ** 53];
const CLEAR = /^(RangeError|TypeError|Error): (fizlet|Grid|effects|presence|timeline|camera|steer|rules|Board|perf|pool|events)\b/;

async function child(name, v) {
  const m = {
    K: await import("../../src/index.ts"), FX: await import("../../src/fx.ts"), ST: await import("../../src/steer.ts"), RU: await import("../../src/rules.ts"),
    CO: await import("../../src/collide.ts"), GR: await import("../../src/grid.ts"), PF: await import("../../src/perf.ts"), PR: await import("../../src/presence.ts"),
  };
  const t0 = performance.now();
  try {
    ({ ...CASES, ...HANGS, ...FIXTURE })[name](m, v);
    console.log(JSON.stringify({ result: "ok", ms: Math.round(performance.now() - t0) }));
  } catch (err) {
    console.log(JSON.stringify({ result: CLEAR.test(String(err)) ? "clear-error" : "raw-error", error: String(err).slice(0, 160), ms: Math.round(performance.now() - t0) }));
  }
}

function probe(name, v, timeout) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--max-old-space-size=512", "--import", "tsx", here, "--child", name, "--value", String(v)], { encoding: "utf8", timeout, killSignal: "SIGKILL" });
  const ms = Date.now() - t0;
  if (r.error?.code === "ETIMEDOUT" || r.signal === "SIGKILL") return { result: "hang", ms };
  const line = r.stdout.trim().split("\n").at(-1);
  try {
    return JSON.parse(line);
  } catch {
    return { result: /heap out of memory|Allocation failed/.test(r.stderr) ? "crash-oom" : "crash", exit: r.status, ms };
  }
}

export async function main(argv) {
  const o = flags(argv, { timeout: 15_000, "self-test": false, child: null, value: 0 });
  if (o.child) return void (await child(o.child, o.value), process.exit(0));
  const cases = o["self-test"] ? FIXTURE : CASES;
  const rows = [];
  if (!o["self-test"]) for (const name of Object.keys(HANGS)) rows.push({ call: name, value: "-", ...probe(name, 0, o.timeout) });
  for (const name of Object.keys(cases)) for (const v of o["self-test"] ? [1e9] : VALUES) rows.push({ call: name, value: v === 2 ** 53 ? "2^53" : String(v), ...probe(name, v, o.timeout) });
  const bad = rows.filter((r) => r.result !== "ok" && r.result !== "clear-error");
  if (o["self-test"]) return { pass: bad.length === rows.length && rows.every((r) => r.result.startsWith("crash") || r.result === "hang"), selfTest: true, rows };
  return { pass: bad.length === 0, rerun: "npm run test:stress -- huge", rows, failing: bad.length };
}

await selfRun(import.meta.url, "huge", main);
