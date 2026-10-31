// fizlet-rooms under load, locally: `wrangler dev --local` (workerd, Durable Objects, KV), never deployed.
//   node test/load.mjs [--rooms 1,8,16,17] [--seconds 10] [--soak 60] [--seed 1] [--phases load,caps,hostile,wake,gate]
//                      [--delay 3] [--p95 50] [--json out.json] [--self-test]
// Phases:
//   load    N rooms × 4 players running real fizlet/presence lockstep (seeded inputs, a state hash every
//           frame) for N = 1, 8, 16, 17: input latency p50/p95 (send → each peer's receive), desyncs,
//           stalls, join time, room 17 refused, workerd RSS sampled every second; then a soak at N = 16.
//   caps    on a second wrangler with short timers: lobby, idle and max-room timeouts fire; bursts under
//           and over MSG_BURST; a sustained flood; reconnect after a drop.
//   hostile malformed frames (text, 0, 11, 13 bytes, 64 KiB, 1 MiB, 2 MiB), forged seats and room
//           messages, bad/missing/short/long invites, bad paths and player counts, a chunked POST /invite.
//   wake    a room that goes quiet long enough to hibernate across its first alarm (end to end).
//   gate    GATE_RATE and JOIN_RATE refuse with 429 (last: it locks 127.0.0.1 out for a minute).
// --self-test runs one room with a deliberate desync (one peer's sim draws an extra random number at
// frame 30) and one slow peer (+250 ms on its sends): it passes only when both are caught.
// Exit 0 when every check passes; prints a JSON summary (and writes it with --json).
// Needs fizlet built (cd .. && npm run build) and `npm ci` here. Node 22+ (global WebSocket, fetch).
import { spawn, execFileSync } from "node:child_process";
import { request } from "node:http";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir, loadavg, cpus } from "node:os";
import { join as path } from "node:path";
import { inviteKey } from "../src/limits.js";

const { createEngine } = await import("../../dist/index.js");
const { presence, websocket, hash32 } = await import("../../dist/presence.js");

// ---------- args ----------
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const SELF = argv.includes("--self-test");
const SEED = Number(arg("seed", 1)) >>> 0;
const ROOMS = SELF ? [1] : String(arg("rooms", "1,8,16,17")).split(",").map(Number);
const DELAY = Number(arg("delay", 3)); // input delay in frames: Blitz online uses 3 (game.ts `net.delay ?? 3`)
const SECONDS = Number(arg("seconds", SELF ? 6 : 10)), SOAK = SELF ? 0 : Number(arg("soak", 60));
const PHASES = SELF ? ["load"] : String(arg("phases", "load,caps,hostile,wake,gate")).split(",");
const BUDGET = { p95: Number(arg("p95", 50)), desyncs: 0, rssGrowMB: 64 }; // local loopback budgets
const CODE = "BLITZ-LOAD-TEST1"; // made up for this test; local KV only
const cwd = new URL("..", import.meta.url).pathname;
const wenv = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const checks = [];
const check = (name, ok, got, want) => (checks.push({ name, ok: !!ok, got, want }), console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${typeof got === "string" ? got : JSON.stringify(got)}${want != null ? `  (want ${want})` : ""}`), ok);
const mulberry = (a) => () => ((a = (a + 0x6d2b79f5) | 0), (((a = Math.imul(a ^ (a >>> 15), a | 1)), (a ^= a + Math.imul(a ^ (a >>> 7), a | 61))), ((a ^ (a >>> 14)) >>> 0)));
const pct = (xs, p) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : NaN);
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- wrangler dev ----------
const procs = [];
async function wrangler(port, vars) {
  const state = mkdtempSync(path(tmpdir(), "rooms-load-"));
  execFileSync("npx", ["wrangler", "kv", "key", "put", "--binding", "INVITES", await inviteKey(CODE), "load", "--local", "--persist-to", state], { cwd, env: wenv, stdio: "pipe" });
  const v = Object.entries({ ALLOWED_ORIGINS: "", ...vars }).flatMap(([k, x]) => ["--var", `${k}:${x}`]);
  const dev = spawn("npx", ["wrangler", "dev", "--local", "--port", String(port), "--ip", "127.0.0.1", "--persist-to", state, ...v], { cwd, env: wenv, detached: true });
  const w = { dev, state, port, log: "", http: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}` };
  dev.stdout.on("data", (d) => (w.log += d));
  dev.stderr.on("data", (d) => (w.log += d));
  procs.push(w);
  for (let i = 0; !/Ready on/.test(w.log); i++) {
    if (i > 600 || dev.exitCode !== null) throw new Error("wrangler dev did not start:\n" + w.log);
    await sleep(100);
  }
  return w;
}
/** RSS (MB) of workerd in this wrangler's process group. */
function rss(w) {
  try {
    return r1(execFileSync("ps", ["-o", "rss=,comm=", "-g", String(w.dev.pid)], { encoding: "utf8" }).split("\n").filter((l) => /workerd/.test(l)).reduce((s, l) => s + Number(l.trim().split(/\s+/)[0]), 0) / 1024);
  } catch {
    return NaN;
  }
}
/** CPU seconds workerd has used so far (utime + stime of its processes, from /proc). */
function cpu(w) {
  try {
    const pids = execFileSync("ps", ["-o", "pid=,comm=", "-g", String(w.dev.pid)], { encoding: "utf8" }).split("\n").filter((l) => /workerd/.test(l)).map((l) => l.trim().split(/\s+/)[0]);
    return pids.reduce((s, p) => {
      const f = readFileSync(`/proc/${p}/stat`, "utf8").split(") ")[1].split(" ");
      return s + (Number(f[11]) + Number(f[12])) / 100;
    }, 0);
  } catch {
    return NaN;
  }
}
const stop = () => {
  for (const w of procs) {
    try {
      process.kill(-w.dev.pid, "SIGTERM");
    } catch {}
    rmSync(w.state, { recursive: true, force: true });
  }
};

// ---------- raw sockets ----------
/** A raw client: messages kept, how it ended. */
function sock(url, protocols = ["fizlet-rooms", `invite.${CODE}`]) {
  const ws = new WebSocket(url, protocols), c = { ws, msgs: [], end: null, at: 0 };
  ws.binaryType = "arraybuffer";
  c.open = new Promise((ok) => {
    ws.addEventListener("open", () => ok(true));
    ws.addEventListener("error", () => ok(false));
  });
  c.closed = new Promise((ok) => ws.addEventListener("close", (ev) => ((c.end = { code: ev.code, reason: ev.reason }), (c.at = now()), ok(c.end))));
  ws.addEventListener("message", (ev) => c.msgs.push({ t: now(), d: typeof ev.data === "string" ? ev.data : new Uint8Array(ev.data) }));
  return c;
}
const frame = (kind, slot, f, v = 0) => {
  const b = new Uint8Array(12), dv = new DataView(b.buffer);
  b[0] = kind, b[1] = slot, b[2] = 4, dv.setUint32(4, f >>> 0, true), dv.setUint32(8, v >>> 0, true);
  return b;
};
/** Four raw seats in `room`; resolves when all have WELCOME. */
async function seats(w, room, n = 4) {
  const cs = Array.from({ length: n }, () => sock(`${w.ws}/room/${room}?players=${n}`));
  for (let i = 0; i < 200 && !cs.every((c) => c.msgs.some((m) => m.d[0] === 3) || c.end); i++) await sleep(25);
  cs.forEach((c) => (c.slot = c.msgs.find((m) => m.d[0] === 3)?.d[1] ?? -1));
  return cs;
}
const ended = (c, ms) => Promise.race([c.closed, sleep(ms).then(() => "open")]);
/** The status a WebSocket upgrade request gets (101 = let in). */
const upgrade = (url, headers = {}) =>
  new Promise((ok) => {
    const req = request(url, { headers: { upgrade: "websocket", connection: "Upgrade", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", "sec-websocket-version": "13", ...headers } });
    req.on("response", (res) => (res.resume(), ok(res.statusCode)));
    req.on("upgrade", (res, s) => (s.destroy(), ok(101)));
    req.on("error", (e) => ok("error " + e.code));
    req.end();
  });

// ---------- phase: load (real lockstep) ----------
/** One room of `players` fizlet engines on fizlet/presence. */
async function lockstepRoom(w, room, players, opt = {}) {
  const url = `${w.ws}/room/${room}?players=${players}`, t0 = now(), R = 1024;
  const sent = new Float64Array(players * R).fill(-1), lat = [], opened = [];
  const seated = await Promise.all(
    Array.from({ length: players }, (_, i) =>
      new Promise((ok) => {
        const ws = new WebSocket(url, ["fizlet-rooms", `invite.${CODE}`]), t = websocket(ws);
        opened.push(ws);
        ws.addEventListener("close", (ev) => ok({ refused: { code: ev.code, reason: ev.reason } }));
        ws.addEventListener("error", () => ok({ refused: { code: "error" } }));
        t.listen((d) => d[0] === 3 && (t.listen(null), ok({ ws, t, slot: d[1], players: d[2], seed: (d[4] | (d[5] << 8) | (d[6] << 16) | (d[7] << 24)) >>> 0, joinMs: now() - t0 })));
        setTimeout(() => ok({ refused: { code: "timeout" } }), 15000);
      }),
    ),
  );
  if (seated.some((s) => s.refused)) {
    opened.forEach((ws) => ws.close()); // seated ones too, or they hold the room for the next run
    return { room, refused: { ...seated.find((s) => s.refused).refused, seats: seated.map((s) => (s.refused ? s.refused.code : `seat ${s.slot}`)) } };
  }
  const clients = seated.map(({ ws, t, slot, seed, joinMs }) => {
    // Latency: an INPUT's send time (by seat and frame) → each peer's receive time.
    const slowMs = opt.slowSlot === slot ? opt.slowMs : 0;
    const transport = {
      send(d) {
        if (d[0] === 1) sent[slot * R + ((d[4] | (d[5] << 8)) % R)] = now();
        if (slowMs) {
          const c = Uint8Array.from(d);
          setTimeout(() => t.send(c), slowMs);
        } else t.send(d);
      },
      listen(fn) {
        t.listen(fn && ((d) => {
          if (d[0] === 1) {
            const s0 = sent[d[1] * R + ((d[4] | (d[5] << 8)) % R)];
            if (s0 >= 0) lat.push(now() - s0);
          }
          fn(d);
        }));
      },
      close: () => t.close(),
    };
    const e = createEngine({ seed }), S = new Float64Array(1 + players * 2), bytes = new Uint8Array(S.buffer), hashes = new Uint32Array(SECONDS * 60 * 4 + SOAK * 60 * 2 + 4096);
    const rnd = mulberry(SEED ^ (room * 2654435761) ^ (slot * 40503));
    const net = presence(e, {
      transport, slot, players, delay: DELAY,
      input: () => rnd() & 0xff,
      step(e, inputs, f) {
        for (let p = 0; p < players; p++) (S[1 + p * 2] += (inputs[p] & 15) - 7 + e.random()), (S[2 + p * 2] += inputs[p] >> 4);
        if (opt.desyncSlot === slot && f === 30) e.random(); // the self-test's deliberate desync
        S[0] = e.random.state;
        if (f < hashes.length) hashes[f] = hash32(bytes);
      },
      hash: () => hash32(bytes),
    });
    return { e, net, hashes, ws, joinMs, slot };
  });
  return { room, clients, lat, joinMs: Math.max(...clients.map((c) => c.joinMs)) };
}
/** Drive every engine at real time (60 Hz) for `sec` seconds; sample RSS and event-loop lag. */
async function drive(rooms, sec, w, mem) {
  const all = rooms.flatMap((r) => r.clients ?? []), t0 = now();
  let last = t0, lag = 0, tick = 0, busy = 0;
  while (now() - t0 < sec * 1000) {
    const t = now(), dt = Math.min(0.1, (t - last) / 1000);
    lag = Math.max(lag, t - last - 16);
    last = t;
    for (const c of all) c.e.advance(dt);
    busy += now() - t;
    if (++tick % 60 === 0) mem.push({ t: r1((now() - mem.t0) / 1000), rss: rss(w), sockets: all.length });
    await sleep(16);
  }
  // busy: the share of wall time this process spent stepping the sims (not counting socket I/O).
  return { lagMs: r1(lag), busyPct: r1((100 * busy) / (now() - t0)) };
}
function verdict(r) {
  const cs = r.clients, top = Math.min(...cs.map((c) => c.net.frame), cs[0].hashes.length);
  let bad = -1;
  for (let f = 0; f < top && bad < 0; f++) if (cs.some((c) => c.hashes[f] !== cs[0].hashes[f])) bad = f;
  return { frames: top, firstBadFrame: bad, presenceDesync: cs.map((c) => c.net.desync).filter((d) => d >= 0), stalls: cs.reduce((s, c) => s + c.net.stalls, 0), dropped: cs.reduce((s, c) => s + c.net.dropped, 0) };
}
async function closeRooms(rooms) {
  for (const r of rooms) for (const c of r.clients ?? []) c.e.destroy();
  await sleep(500);
}

async function loadPhase(out) {
  // JOIN_RATE at its ceiling: every run reuses rooms 0..N-1 from one IP, and the default 10 a minute
  // would refuse the third run's joins into room 0 (that cap has its own check in the gate phase).
  const w = await wrangler(8801, { MAX_ROOMS: 16, MAX_PLAYERS: 4, GATE_RATE: 300, JOIN_RATE: 120 });
  const mem = Object.assign([], { t0: now() });
  mem.push({ t: 0, rss: rss(w), sockets: 0, note: "started" });
  out.load = [];
  const runs = SELF ? [{ n: 1, sec: SECONDS }] : [...ROOMS.map((n) => ({ n, sec: SECONDS })), ...(SOAK ? [{ n: 16, sec: SOAK, soak: true }] : [])];
  for (const { n, sec, soak } of runs) {
    const rooms = await Promise.all(Array.from({ length: n }, (_, i) => lockstepRoom(w, i, 4, SELF ? { desyncSlot: 3, slowSlot: 1, slowMs: 250 } : {})));
    const running = rooms.filter((r) => r.clients), refused = rooms.filter((r) => r.refused);
    const td = now(), cpuD = cpu(w);
    const { lagMs, busyPct } = await drive(running, sec, w, mem);
    const workerdCpuPct = r1((100 * (cpu(w) - cpuD)) / ((now() - td) / 1000)); // 100 = one core: workerd runs every room on one thread locally
    const v = running.map(verdict), lat = running.flatMap((r) => r.lat);
    const row = {
      rooms: n, soak: !!soak, seconds: sec, running: running.length, refused: refused.map((r) => ({ room: r.room, ...r.refused })),
      joinMsMax: r1(Math.max(...running.map((r) => r.joinMs))), samples: lat.length, p50: r1(pct(lat, 50)), p95: r1(pct(lat, 95)), p99: r1(pct(lat, 99)), max: r1(lat.reduce((m, x) => Math.max(m, x), 0)),
      framesMin: Math.min(...v.map((x) => x.frames)), fps: r1(Math.min(...v.map((x) => x.frames)) / sec), desyncs: v.filter((x) => x.firstBadFrame >= 0 || x.presenceDesync.length).length,
      firstBadFrame: v.map((x) => x.firstBadFrame).filter((f) => f >= 0), stallsPerClient: Math.round(v.reduce((s, x) => s + x.stalls, 0) / (running.length * 4)), clientLoopLagMaxMs: lagMs, clientSimBusyPct: busyPct, workerdCpuPct, loadavg: loadavg().map(r1), rssMB: rss(w), uptime: execFileSync("uptime", { encoding: "utf8" }).trim(),
    };
    out.load.push(row);
    console.log(JSON.stringify(row));
    await closeRooms(rooms);
    mem.push({ t: r1((now() - mem.t0) / 1000), rss: rss(w), sockets: 0, note: `after N=${n}${soak ? " soak" : ""}` });
    if (SELF) {
      check("self-test: the deliberate desync is caught", row.desyncs > 0 && row.firstBadFrame.some((f) => f >= 30 && f <= 32), row.firstBadFrame, "≥1 room, first bad frame 30..32");
      check("self-test: the slow peer breaks the p95 budget", row.p95 > BUDGET.p95, row.p95, `> ${BUDGET.p95} ms`);
      continue;
    }
    const expectRun = Math.min(n, 16);
    check(`N=${n}${soak ? " soak" : ""}: rooms running`, row.running === expectRun, row.running, expectRun);
    if (n > 16) check(`N=${n}: room 17 (/room/16) refused cleanly`, row.refused.length === n - 16 && row.refused.every((x) => x.code === 1002 || x.code === 1006 || x.code === "error"), row.refused, "refused at the upgrade (HTTP 404)");
    check(`N=${n}${soak ? " soak" : ""}: no desync`, row.desyncs === 0, row.desyncs, 0);
    check(`N=${n}${soak ? " soak" : ""}: input latency p95 ≤ ${BUDGET.p95} ms`, row.p95 <= BUDGET.p95, { p50: row.p50, p95: row.p95 }, `p95 ≤ ${BUDGET.p95}`);
    check(`N=${n}${soak ? " soak" : ""}: sim keeps up (≥ 54 frames/s)`, row.fps >= 54, row.fps, "≥ 54");
    await sleep(1500); // rooms reset when their last seat leaves
  }
  if (!SELF) {
    // Room 17 at the HTTP level: what the refusal looks like.
    const st = await upgrade(`${w.http}/room/16?players=4&invite=${CODE}`);
    check("room 17: HTTP status for /room/16", st === 404, st, 404);
    // Leak check at the same load: idle RSS after the first N=16 run vs after the N=16 soak.
    const a = mem.find((m) => m.note === "after N=16"), b = mem.find((m) => m.note === "after N=16 soak");
    if (a && b) check("workerd RSS: idle after the soak vs idle after the first N=16 run", b.rss - a.rss <= BUDGET.rssGrowMB, { before: a.rss, after: b.rss, grow: r1(b.rss - a.rss) }, `≤ +${BUDGET.rssGrowMB} MB`);
  }
  out.memory = mem.map(({ ...m }) => m);
}

// ---------- phase: caps ----------
async function capsPhase(out) {
  // Shortest timers the code allows (limits.js mins: idle 2, lobby 2, max room 10); MSG_RATE/BURST default.
  const w = await wrangler(8802, { MAX_ROOMS: 8, MAX_PLAYERS: 4, IDLE_SECONDS: 3, LOBBY_SECONDS: 3, MAX_ROOM_SECONDS: 10, GATE_RATE: 300, JOIN_RATE: 120 });
  out.caps = {};
  // Lobby: one seat of four, sending all the while (refused, so it doesn't count).
  let t = now();
  const lone = sock(`${w.ws}/room/0?players=4`);
  await lone.open;
  const lt = setInterval(() => lone.ws.readyState === 1 && lone.ws.send(frame(1, 0, 1)), 200);
  const le = await ended(lone, 15000);
  clearInterval(lt);
  check("lobby: lone seat closed 'room not filled' after ~3 s", le.reason === "room not filled" && lone.at - t < 6000, { ...le, s: r1((lone.at - t) / 1000) }, "1001 room not filled, 3–6 s");
  // Idle: four seats, silent. Timed by the LEAVE the room sends as it lets go.
  t = now();
  const idle = await seats(w, 1);
  const ie = await Promise.all(idle.map((c) => ended(c, 20000)));
  const firstLeave = Math.min(...idle.flatMap((c) => c.msgs.filter((m) => m.d[0] === 4).map((m) => m.t)));
  check("idle: silent full room closed 'room idle' after ~3 s", ie.some((e) => e.reason === "room idle") && firstLeave - t < 6000, { reasons: [...new Set(ie.map((e) => e.reason))], leaveS: r1((firstLeave - t) / 1000), closeS: r1((Math.max(...idle.map((c) => c.at)) - t) / 1000) }, "room idle, 3–6 s");
  // Reconnect after idle: the same four come back to the room that just timed out.
  const again = await seats(w, 1);
  check("reconnect after idle: the timed-out room seats its four again", again.every((c) => c.slot >= 0), again.map((c) => c.slot), "[0..3]");
  again.forEach((c) => c.ws.close());
  // Max room: four seats relaying at 20 Hz each: idle never fires, MAX_ROOM_SECONDS (10) does.
  t = now();
  const busy = await seats(w, 2);
  let f = 0;
  const bt = setInterval(() => (f++, busy.forEach((c) => c.ws.readyState === 1 && c.ws.send(frame(1, c.slot, f)))), 50);
  const be = await Promise.all(busy.map((c) => ended(c, 25000)));
  clearInterval(bt);
  const bLeave = Math.min(...busy.flatMap((c) => c.msgs.filter((m) => m.d[0] === 4).map((m) => m.t)));
  check("max room: busy room closed 'room time is up' after ~10 s", be.some((e) => e.reason === "room time is up") && bLeave - t >= 9000 && bLeave - t < 14000, { reasons: [...new Set(be.map((e) => e.reason))], leaveS: r1((bLeave - t) / 1000) }, "room time is up, 10–14 s");

  // Rate: bursts in a full room (MSG_RATE 90, MSG_BURST 180).
  const rate = await seats(w, 3);
  const [a, b, c, d] = rate;
  let fa = 0, fd = 0;
  const keep = setInterval(() => [b, c].forEach((x) => x.ws.readyState === 1 && x.ws.send(frame(1, x.slot, ++fd))), 100); // keeps the room alive
  for (let i = 0; i < 170; i++) a.ws.send(frame(1, a.slot, ++fa));
  await sleep(1500); // refills ~135 tokens
  const under = a.end;
  for (let i = 0; i < 260; i++) a.ws.send(frame(1, a.slot, ++fa));
  const over = await ended(a, 3000);
  check("rate: a burst of 170 (under MSG_BURST 180) is let through", under === null, under ?? "open", "open");
  check("rate: a burst of 260 right after is closed 1008", over.code === 1008, over, "1008 rate limit");
  const relayed = b.msgs.filter((m) => m.d[0] === 1 && m.d[1] === a.slot).length;
  out.caps.burstRelayedToPeer = relayed;
  // Sustained: 85/s for 4 s stays; 240/s trips (measure when).
  const sus = async (x, hz, ms) => {
    const t0 = now();
    let n = 0;
    while (now() - t0 < ms && x.ws.readyState === 1) {
      const want = Math.floor(((now() - t0) / 1000) * hz);
      while (n < want && x.ws.readyState === 1) x.ws.send(frame(1, x.slot, 100000 + ++n));
      await sleep(5);
    }
    return { sent: n, end: await ended(x, 1500), s: r1((now() - t0) / 1000) };
  };
  const s85 = await sus(d, 85, 4000);
  check("rate: sustained 85/s for 4 s stays open", s85.end === "open", s85, "open");
  const s240 = await sus(d, 240, 6000);
  check("rate: sustained 240/s is closed 1008", s240.end?.code === 1008, s240, "1008 within ~1.5 s");
  out.caps.sustained = { s85, s240 };
  clearInterval(keep);
  rate.forEach((x) => x.ws.close());

  // Reconnect after a drop: four play (raw lockstep inputs); one client's process is killed (no close
  // frame: the room sees 1006) and it comes back with the resume token from its WELCOME.
  await sleep(500);
  const kid = spawn(process.execPath, ["--input-type=module", "-e", `const ws = new WebSocket(${JSON.stringify(`${w.ws}/room/4?players=4`)}, ["fizlet-rooms", "invite.${CODE}"]); ws.binaryType = "arraybuffer"; ws.onmessage = (e) => { const d = new Uint8Array(e.data); if (d[0] === 3) console.log(Buffer.from(d).toString("hex")); }; setInterval(() => {}, 1000);`], { stdio: ["ignore", "pipe", "inherit"] });
  let kidOut = "";
  kid.stdout.on("data", (d) => (kidOut += d));
  const rc = Array.from({ length: 3 }, () => sock(`${w.ws}/room/4?players=4`));
  for (let i = 0; i < 400 && !(rc.every((c) => c.msgs.some((m) => m.d[0] === 3)) && kidOut.includes("\n")); i++) await sleep(25);
  rc.forEach((c) => (c.slot = c.msgs.find((m) => m.d[0] === 3)?.d[1] ?? -1));
  const welcome = Buffer.from(kidOut.trim(), "hex"), kidSlot = welcome[1], token = welcome.readUInt32LE(8);
  let fr = 0;
  const rt = setInterval(() => (fr++, rc.forEach((x) => x.ws.readyState === 1 && x.ws.send(frame(1, x.slot, fr)))), 50);
  await sleep(1000);
  kid.kill("SIGKILL");
  const seen = (k, slot, ms) => (async () => { for (let i = 0; i < ms / 25; i++) { if (rc.every((x) => x.msgs.some((m) => m.d[0] === k && m.d[1] === slot))) return true; await sleep(25); } return false; })();
  const awaySeen = await seen(6, kidSlot, 15000), dropT = now();
  check("reconnect: peers hear AWAY (reconnecting), not LEAVE, when a seat drops", awaySeen && !rc.some((x) => x.msgs.some((m) => m.d[0] === 4)), { awaySeen, slot: kidSlot }, "AWAY");
  await sleep(1000); // a second later, still within RESUME_SECONDS
  const frAt = fr, back = sock(`${w.ws}/room/4?players=4`, ["fizlet-rooms", `invite.${CODE}`, `resume.${token.toString(16)}`]);
  for (let i = 0; i < 200 && !back.msgs.some((m) => m.d[0] === 5) && !back.end; i++) await sleep(25);
  const bw = back.msgs.find((m) => m.d[0] === 3)?.d, resumed = await seen(5, kidSlot, 3000);
  // Replayed: the other seats' inputs from before the resume (live ones are later frames).
  const replayed = back.msgs.filter((m) => m.d[0] === 1 && new DataView(m.d.buffer).getUint32(4, true) <= frAt - 5).length;
  out.caps.reconnect = { slot: kidSlot, welcome: bw ? [...bw.slice(0, 3)] : null, resumeFrame: back.msgs.some((m) => m.d[0] === 5), peersResumed: resumed, replayed, s: r1((now() - dropT) / 1000) };
  check("reconnect: the dropped player gets its seat back (WELCOME, its old seat, then RESUME)", bw?.[1] === kidSlot && back.msgs.some((m) => m.d[0] === 5) && resumed, out.caps.reconnect, "WELCOME with its old seat, RESUME to everyone");
  check("reconnect: the inputs it missed are replayed", replayed > 0, replayed, "> 0 INPUT after RESUME");
  back.ws.send(frame(1, kidSlot, 100000));
  await sleep(300);
  check("reconnect: lockstep continues: its input reaches the others", rc.every((x) => x.msgs.some((m) => m.d[0] === 1 && m.d[1] === kidSlot)), true, true);
  const leaveT = now();
  back.ws.close(1000, "bye");
  const own = await ended(back, 15000);
  // Timed, not the code: Node's client sometimes reports 1006 even when the answer comes at once.
  check("close: a client's own close is answered at once (not a ~10 s timeout)", back.at - leaveT < 2000, { ...own, s: r1((back.at - leaveT) / 1000) }, "closed in < 2 s");
  check("reconnect: a clean close (1000) is a leave: peers hear LEAVE", await seen(4, kidSlot, 3000), true, true);
  clearInterval(rt);
  // The three left behind stall in lockstep; the room only frees after IDLE (they keep relaying here, so MAX_ROOM).
  rc.forEach((x) => x.ws.close());
  await sleep(800);
  const fresh = await seats(w, 4);
  check("reconnect: once everyone left, the room seats a fresh four", fresh.every((x) => x.slot >= 0), fresh.map((x) => x.slot), "[0..3]");
  fresh.forEach((x) => x.ws.close());

  // A full room: a fifth joiner is refused 4000 and doesn't keep the room alive.
  const full = await seats(w, 5);
  const fifth = sock(`${w.ws}/room/5?players=4`), ft0 = now();
  const fe = await ended(fifth, 15000);
  check("full: a fifth joiner is closed 4000 'room full'", fe.code === 4000, { ...fe, s: r1((now() - ft0) / 1000), opened: await fifth.open }, "4000 room full (close event lags ~10 s on local workerd)");
  full.forEach((x) => x.ws.close());
  out.caps.rss = rss(w);
}

// ---------- phase: hostile ----------
async function hostilePhase(out) {
  const w = await wrangler(8803, { MAX_ROOMS: 8, MAX_PLAYERS: 4, IDLE_SECONDS: 30, LOBBY_SECONDS: 30, GATE_RATE: 300, JOIN_RATE: 120 });
  out.hostile = {};
  const H = w.http, base = `${H}/room/0?players=4`;
  // Invites (URL form for the HTTP status; the subprotocol form below).
  const inv = {
    missing: await upgrade(base),
    wrong: await upgrade(`${base}&invite=BLITZ-AAAA-AAAA`),
    short: await upgrade(`${base}&invite=BLITZ-AAA`),
    long65: await upgrade(`${base}&invite=${"A".repeat(65)}`),
    empty: await upgrade(`${base}&invite=`),
    lowercaseValid: await upgrade(`${base}&invite=${CODE.toLowerCase()}`),
    paddedValid: await upgrade(`${base}&invite=%20${CODE}%20`),
    protoWrong: await upgrade(base, { "sec-websocket-protocol": "fizlet-rooms, invite.BLITZ-AAAA-AAAA" }),
    protoEmpty: await upgrade(base, { "sec-websocket-protocol": "fizlet-rooms, invite." }),
    protoWrongUrlRight: await upgrade(`${base}&invite=${CODE}`, { "sec-websocket-protocol": "fizlet-rooms, invite.BLITZ-AAAA-AAAA" }),
    spoofedIp: await upgrade(`${base}&invite=BLITZ-AAAA-AAAA`, { "cf-connecting-ip": "203.0.113.9" }),
  };
  out.hostile.invites = inv;
  for (const k of ["missing", "wrong", "short", "long65", "empty", "protoWrong", "protoEmpty", "protoWrongUrlRight"]) check(`invite ${k}: refused 403`, inv[k] === 403, inv[k], 403);
  check("invite: case and padding don't matter (normalised)", inv.lowercaseValid === 101 && inv.paddedValid === 101, { lower: inv.lowercaseValid, padded: inv.paddedValid }, 101);
  await sleep(300);
  const post = async (body, headers) => (await fetch(`${H}/invite`, { method: "POST", body, headers })).status;
  out.hostile.post = { valid: await post(CODE), wrong: await post("BLITZ-AAAA-AAAA"), empty: await post(""), big: await post("A".repeat(300)) };
  check("POST /invite: valid 200, wrong/empty/oversized 403", out.hostile.post.valid === 200 && ["wrong", "empty", "big"].every((k) => out.hostile.post[k] === 403), out.hostile.post);
  // Chunked body, no content-length: the length check reads 0 and the whole body is read before the slice.
  const chunked = (mb) =>
    new Promise((ok) => {
      const t0 = now(), req = request(`${H}/invite`, { method: "POST", headers: { "transfer-encoding": "chunked", "content-type": "text/plain" } });
      req.on("response", (res) => (res.resume(), res.on("end", () => ok({ status: res.statusCode, ms: r1(now() - t0) }))));
      req.on("error", (e) => ok({ error: e.code, ms: r1(now() - t0) }));
      const chunk = Buffer.alloc(1 << 20, 65);
      for (let i = 0; i < mb; i++) req.write(chunk);
      req.end();
    });
  const rss0 = rss(w);
  out.hostile.chunked = { mb1: await chunked(1), mb32: await chunked(32), mb96: await chunked(96), rssBefore: rss0, rssAfter: rss(w) };
  // Timing is noisy on a shared machine; the RSS step is not (the body is buffered whole before the slice).
  const grew = r1(out.hostile.chunked.rssAfter - rss0);
  check("POST /invite chunked 96 MiB: refused without buffering the body", grew < 32, { ...out.hostile.chunked, rssGrowMB: grew }, "workerd RSS + < 32 MB");
  // Paths and player counts.
  const paths = {};
  for (const p of ["/room/8?players=4", "/room/-1?players=4", "/room/abc?players=4", "/room/0001?players=4", "/room/01?players=4", "/room/0?players=0", "/room/0?players=5", "/room/0?players=2.5", "/room/0?players=abc", "/room/0?players=", "/"]) paths[p] = await upgrade(`${H}${p}&invite=${CODE}`.replace("/&", "/?"));
  paths["GET /room/0 (no upgrade)"] = (await fetch(`${H}/room/0?players=4`)).status;
  out.hostile.paths = paths;
  check("paths: out-of-range and junk rooms 404, bad player counts 400, no upgrade 426", paths["/room/8?players=4"] === 404 && paths["/room/abc?players=4"] === 404 && paths["/room/0?players=0"] === 400 && paths["/room/0?players=5"] === 400 && paths["/room/0?players=2.5"] === 400 && paths["GET /room/0 (no upgrade)"] === 426, paths);
  // Different player count into a seated room.
  const holder = sock(`${w.ws}/room/1?players=4`);
  await holder.open;
  out.hostile.playerMismatch = await upgrade(`${H}/room/1?players=2&invite=${CODE}`);
  check("players mismatch into a seated room: 409", out.hostile.playerMismatch === 409, out.hostile.playerMismatch, 409);
  holder.ws.close();
  // Malformed frames: each on its own seat in a full room; the others watch.
  const frames = { text: "hello", empty: new Uint8Array(0), b11: new Uint8Array(11), b13: new Uint8Array(13), kib64: new Uint8Array(64 << 10), mib1: new Uint8Array(1 << 20), mib2: new Uint8Array(2 << 20) };
  out.hostile.frames = {};
  let room = 2;
  for (const [k, data] of Object.entries(frames)) {
    const cs = await seats(w, room++ % 8);
    const t0 = now();
    cs[0].ws.send(data);
    const e = await ended(cs[0], 4000);
    out.hostile.frames[k] = { end: e, ms: r1(now() - t0), othersOpen: cs.slice(1).every((c) => c.end === null) };
    cs.forEach((c) => c.ws.close());
    await sleep(200);
  }
  for (const [k, v] of Object.entries(out.hostile.frames)) check(`frame ${k}: sender closed (1009), others stay`, v.end?.code === 1009 && v.othersOpen, v, "1009, others open");
  // Forged seat, room-only kinds, repeats and old frames: what peers receive.
  const cs = await seats(w, 6);
  const [m, p] = cs, other = (cs[1].slot + 1) % 4;
  const got = () => p.msgs.filter((x) => x.d[0] !== 3).map((x) => [...x.d.slice(0, 2), x.d[4]]);
  m.ws.send(frame(1, other, 5, 7)); // claims another seat
  m.ws.send(frame(3, m.slot, 6)); // WELCOME from a client
  m.ws.send(frame(4, other, 7)); // LEAVE for someone else
  m.ws.send(frame(0, m.slot, 8)); // kind 0
  m.ws.send(frame(255, m.slot, 9)); // kind 255
  m.ws.send(frame(1, m.slot, 5, 9)); // second INPUT for frame 5
  m.ws.send(frame(1, m.slot, 4)); // old frame
  m.ws.send(frame(1, m.slot, 0xffffffff)); // last frame there is: the seat can never send again
  m.ws.send(frame(1, m.slot, 10)); // so this is dropped
  await sleep(500);
  const seen = p.msgs.filter((x) => x.d[0] !== 3).map((x) => ({ kind: x.d[0], slot: x.d[1], frame: new DataView(x.d.buffer).getUint32(4, true) }));
  out.hostile.relay = { sender: m.slot, seen };
  check("relay: forged seat restamped, room-only kinds and repeats dropped", seen.length === 2 && seen.every((s) => s.kind === 1 && s.slot === m.slot) && seen[0].frame === 5 && seen[1].frame === 0xffffffff, seen, "2 INPUTs from the sender's real seat (f 5, f 2^32-1)");
  cs.forEach((c) => c.ws.close());
  await sleep(300);
  out.hostile.healthAfter = (await fetch(`${H}/invite`, { method: "POST", body: CODE })).status;
  check("server still answers after the hostile run", out.hostile.healthAfter === 200, out.hostile.healthAfter, 200);
  out.hostile.rss = rss(w);
}

// ---------- phase: wake (hibernation, end to end) ----------
// workerd hibernates a Room after ~10 s without an event, locally too. A room that plays, then goes
// quiet (every tab paused, or one: lockstep stalls everyone) across its first alarm (the lobby
// deadline, set at the first seat) woke with `last` = 0 and closed as idle, however recently it
// played (P6-01; `last` now rides in the attachments). LOBBY 20 s, IDLE 60 s: play 3 s, then silence. Expected: open until ~63 s.
async function wakePhase(out) {
  const w = await wrangler(8805, { MAX_ROOMS: 4, MAX_PLAYERS: 4, LOBBY_SECONDS: 20, IDLE_SECONDS: 60, MAX_ROOM_SECONDS: 600, GATE_RATE: 300, JOIN_RATE: 120 });
  const t0 = now(), cs = await seats(w, 0);
  for (let f = 1; f <= 90; f++) {
    cs.forEach((c) => c.ws.readyState === 1 && c.ws.send(frame(1, c.slot, f)));
    await sleep(33);
  }
  const lastPlay = now();
  const e = await Promise.race([Promise.all(cs.map((c) => c.closed)), sleep(40000).then(() => "open")]);
  const leave = Math.min(...cs.flatMap((c) => c.msgs.filter((m) => m.d[0] === 4).map((m) => m.t)), now());
  out.wake = { end: e === "open" ? "open" : [...new Set(e.map((x) => x.reason))], closedAtS: r1((leave - t0) / 1000), quietForS: r1((leave - lastPlay) / 1000) };
  check("wake: a room quiet for 15 s across its first alarm stays open (idle is 60 s)", e === "open", out.wake, "open for 40 s of quiet");
  cs.forEach((c) => c.ws.close());
}

// ---------- phase: gate (rate limits on joins) ----------
async function gatePhase(out) {
  const w = await wrangler(8804, { MAX_ROOMS: 8, MAX_PLAYERS: 4, GATE_RATE: 30, JOIN_RATE: 10, LOBBY_SECONDS: 30 });
  out.gate = {};
  // JOIN_RATE: 12 joins into one room from one IP (each closes at once). Counted by the room.
  const js = [];
  for (let i = 0; i < 12; i++) js.push(await upgrade(`${w.http}/room/0?players=4&invite=${CODE}`));
  out.gate.joinRate = js;
  check("JOIN_RATE 10: the 11th join into one room is 429", js.slice(0, 10).every((s) => s === 101) && js[10] === 429, js, "10 × 101 then 429");
  // GATE_RATE: invite checks + joins per IP a minute (12 joins counted already).
  const gs = [];
  for (let i = 0; i < 25; i++) gs.push((await fetch(`${w.http}/invite`, { method: "POST", body: "BLITZ-AAAA-AAAA" })).status);
  out.gate.gateRate = gs;
  const first429 = gs.indexOf(429);
  check("GATE_RATE 30: the 31st check from one IP is 429 (before the KV read)", first429 === 18, { first429AtCall: 12 + first429 + 1, statuses: gs }, "31st");
  const ra = (await fetch(`${w.http}/invite`, { method: "POST", body: CODE })).headers.get("retry-after");
  check("429 says retry-after", ra === "60", ra, "60");
  // Does a client-set cf-connecting-ip reset the count? (Local only: Cloudflare sets this header itself.)
  out.gate.spoofedIp = (await fetch(`${w.http}/invite`, { method: "POST", body: CODE, headers: { "cf-connecting-ip": "203.0.113.7" } })).status;
  // A 4-player NAT party: 16 rooms × 4 seats from one address = 64 joins a minute.
  out.gate.natNote = "GATE_RATE 30/min per IP: a venue behind one NAT seats at most 30 joins a minute per isolate (7 rooms of 4)";
}

// ---------- run ----------
const out = { seed: SEED, selfTest: SELF, node: process.version, wrangler: execFileSync("npx", ["wrangler", "--version"], { cwd, env: wenv, encoding: "utf8" }).trim().split("\n").pop(), machine: `${cpus()[0].model} × ${cpus().length}`, loadavgStart: loadavg().map(r1), uptimeStart: execFileSync("uptime", { encoding: "utf8" }).trim(), budget: BUDGET };
console.log(`rooms load: seed ${SEED}, rooms ${ROOMS}, ${SECONDS} s each, soak ${SOAK} s, phases ${PHASES}${SELF ? " (SELF-TEST)" : ""}`);
let code = 1;
try {
  for (const p of PHASES) {
    stop();
    procs.length = 0;
    await { load: loadPhase, caps: capsPhase, hostile: hostilePhase, wake: wakePhase, gate: gatePhase }[p](out);
  }
  out.loadavgEnd = loadavg().map(r1);
  out.checks = checks;
  out.pass = checks.every((c) => c.ok);
  code = out.pass ? 0 : 1;
} catch (err) {
  console.error(err);
  for (const w of procs) console.error(w.log.slice(-2000));
  out.error = String(err?.stack ?? err);
}
const failed = checks.filter((c) => !c.ok).map((c) => c.name);
console.log(JSON.stringify({ pass: code === 0, seed: SEED, checks: checks.length, failed }, null, 1));
if (arg("json")) writeFileSync(arg("json"), JSON.stringify(out, null, 1));
stop();
process.exit(code);
