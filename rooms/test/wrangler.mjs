// End to end, locally: `wrangler dev --local` runs the Worker + Durable Object + KV in workerd.
// 1. The gate: no invite, a wrong invite, a room past MAX_ROOMS, too many players → refused.
// 2. Two fizlet engines with a valid invite join one room, play N lockstep frames, compare state.
// 3. The caps: an oversized message and a message flood each get the socket closed; a silent room
//    is closed after IDLE_SECONDS.
// Needs fizlet built first (cd .. && npm run build). Node 22+ (global WebSocket, fetch).
import { spawn, execFileSync } from "node:child_process";
import { request } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as path } from "node:path";
import assert from "node:assert/strict";
import { inviteKey } from "../src/limits.js";

const { createEngine } = await import("../../dist/index.js");
const { presence, join, hash32 } = await import("../../dist/presence.js");
const PORT = 8799, N = Number(process.env.FRAMES ?? 600), HTTP = `http://127.0.0.1:${PORT}`, WS = `ws://127.0.0.1:${PORT}`;
const CODE = "E2E-TEST-INVITE"; // made up for this test; local KV only
const cwd = new URL("..", import.meta.url).pathname, state = mkdtempSync(path(tmpdir(), "rooms-e2e-"));
const env = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" };

// Seed the local KV with the test invite (its hash, as the owner's invite tool does).
execFileSync("npx", ["wrangler", "kv", "key", "put", "--binding", "INVITES", await inviteKey(CODE), "e2e", "--local", "--persist-to", state], { cwd, env, stdio: "pipe" });
const dev = spawn("npx", ["wrangler", "dev", "--local", "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", state, "--var", "IDLE_SECONDS:3", "--var", "MAX_ROOMS:4", "--var", "MAX_PLAYERS:2", "--var", "ALLOWED_ORIGINS:"], { cwd, env, detached: true });
let log = "";
dev.stdout.on("data", (d) => (log += d));
dev.stderr.on("data", (d) => (log += d));
// wrangler starts workerd as a child: stop the whole process group, or the port stays taken.
const bye = (code) => {
  try {
    process.kill(-dev.pid, "SIGTERM");
  } catch {}
  rmSync(state, { recursive: true, force: true });
  process.exit(code);
};
/** Open a socket; resolve with how it ended: { code, reason } (or "open" after `ms`). */
const ends = (url, onOpen, ms = 8000) =>
  new Promise((ok) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const t = setTimeout(() => (ok("open"), ws.close()), ms);
    ws.addEventListener("open", () => onOpen?.(ws));
    ws.addEventListener("close", (ev) => (clearTimeout(t), ok({ code: ev.code, reason: ev.reason })));
  });
/** The HTTP status a WebSocket upgrade request gets (101 when the room lets you in). */
const status = (url) =>
  new Promise((ok, fail) => {
    const req = request(url, { headers: { upgrade: "websocket", connection: "Upgrade", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", "sec-websocket-version": "13" } });
    req.on("response", (res) => (res.resume(), ok(res.statusCode)));
    req.on("upgrade", (res, socket) => (socket.destroy(), ok(101)));
    req.on("error", fail);
    req.end();
  });

try {
  for (let i = 0; !/Ready on/.test(log); i++) {
    if (i > 600 || dev.exitCode !== null) throw new Error("wrangler dev did not start:\n" + log);
    await new Promise((r) => setTimeout(r, 100));
  }
  // 1. The gate.
  const invite = await fetch(`${HTTP}/invite?code=${CODE}`);
  assert.equal(invite.status, 200, "the invite check accepts the code");
  assert.deepEqual(await invite.json(), { ok: true, players: 2 }, "and says how many players a room takes (MAX_PLAYERS)");
  assert.equal((await fetch(`${HTTP}/invite?code=e2e-test-invite`)).status, 200, "codes are case-insensitive");
  assert.equal((await fetch(`${HTTP}/invite?code=NOT-A-CODE`)).status, 403);
  assert.equal(await status(`${HTTP}/room/0?players=2`), 403, "no invite, no room");
  assert.equal(await status(`${HTTP}/room/0?players=2&invite=WRONG-CODE`), 403);
  assert.equal(await status(`${HTTP}/room/4?players=2&invite=${CODE}`), 404, "MAX_ROOMS=4: rooms 0..3 only");
  assert.equal(await status(`${HTTP}/room/abc?players=2&invite=${CODE}`), 404);
  assert.equal(await status(`${HTTP}/room/0?players=3&invite=${CODE}`), 400, "MAX_PLAYERS=2");

  // 2. Two clients play.
  const url = `${WS}/room/1?players=2&invite=${CODE}`;
  const seats = await Promise.all([join(url), join(url)]);
  assert.deepEqual(seats.map((s) => s.slot).sort(), [0, 1]);
  assert.equal(seats[0].seed, seats[1].seed, "one seed for the room");
  const clients = seats.map(({ transport, slot, players, seed }) => {
    const e = createEngine({ seed }), S = new Float64Array(1 + players * 2), bytes = new Uint8Array(S.buffer), hashes = [];
    let k = slot * 7 + 1;
    const net = presence(e, {
      transport, slot, players,
      input: () => (k = (k * 13 + 5) % 31), // this player's own button pattern
      step(e, inputs, f) {
        for (let p = 0; p < players; p++) S[1 + p * 2] += (inputs[p] & 15) - 7 + e.random(), S[2 + p * 2] += inputs[p] >> 4;
        S[0] = e.random.state;
        hashes[f] = hash32(bytes);
      },
      hash: () => hash32(bytes),
    });
    return { e, net, hashes, bytes };
  });
  const t0 = performance.now();
  // Paced at about 60 frames a second (a burst far above that would trip the rate cap, by design).
  while (clients.some((c) => c.net.frame < N)) {
    for (const c of clients) if (c.net.frame < N) c.e.advance(1 / 60);
    await new Promise((r) => setTimeout(r, 16));
    if (performance.now() - t0 > 120000) throw new Error("timed out at frames " + clients.map((c) => c.net.frame));
  }
  const [a, b] = clients;
  assert.deepEqual(a.hashes.slice(0, N), b.hashes.slice(0, N), "same state hash every frame");
  assert.deepEqual(a.bytes, b.bytes, "byte-identical state at frame N");
  assert.equal(a.net.desync, -1);
  const ms = performance.now() - t0;
  clients.forEach((c) => c.e.destroy());

  // 3. The caps. A full room of two: one floods, one sends a 13-byte message.
  const room2 = `${WS}/room/2?players=2&invite=${CODE}`;
  const flood = ends(room2, (ws) => setTimeout(() => { for (let i = 0; i < 2000; i++) ws.send(new Uint8Array(12).fill(1)); }, 300));
  const big = ends(room2, (ws) => setTimeout(() => ws.send(new Uint8Array(13)), 300));
  const [f, g] = await Promise.all([flood, big]);
  assert.deepEqual(f, { code: 1008, reason: "rate limit" });
  assert.deepEqual(g, { code: 1009, reason: "12-byte binary messages only" });
  // A silent full room closes after IDLE_SECONDS (3 here).
  // Timed by the room's LEAVE message (sent as it closes the seats): a client's own close event
  // can lag behind the server's close by the TCP teardown, ~10 s under local workerd.
  const room3 = `${WS}/room/3?players=2&invite=${CODE}`, t1 = performance.now();
  let leftAt = 0;
  const watch = (ws) => ws.addEventListener("message", (ev) => !leftAt && new Uint8Array(ev.data)[0] === 4 && (leftAt = performance.now()));
  const idle = await Promise.all([ends(room3, watch, 20000), ends(room3, watch, 20000)]);
  const idleMs = leftAt - t1;
  assert.ok(idle.some((x) => x.code === 1001 && x.reason === "room idle"), JSON.stringify(idle));
  assert.ok(leftAt && idleMs >= 2500 && idleMs < 6000, `the room let go after ${idleMs} ms`);

  console.log(`ok: gate (invite, room range, seats) refused bad joins; 2 clients, ${N} frames through wrangler dev (workerd, DO, KV) in ${ms.toFixed(0)} ms, byte-identical, stalls ${a.net.stalls}/${b.net.stalls}; flood → 1008, 13-byte message → 1009, silent room closed after ${(idleMs / 1000).toFixed(1)} s.`);
  bye(0);
} catch (err) {
  console.error(err);
  console.error(log.slice(-2000));
  bye(1);
}
