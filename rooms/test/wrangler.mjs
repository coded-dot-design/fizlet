// End to end, locally: `wrangler dev --local` runs the Worker + Durable Object in workerd; two
// fizlet engines join one room over real WebSockets, play N lockstep frames and compare state.
// Needs fizlet built first (cd .. && npm run build). Node 22+ (global WebSocket).
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const { createEngine } = await import("../../dist/index.js");
const { presence, join, hash32 } = await import("../../dist/presence.js");
const PORT = 8799, N = Number(process.env.FRAMES ?? 600);

const dev = spawn("npx", ["wrangler", "dev", "--local", "--port", String(PORT), "--ip", "127.0.0.1"], { cwd: new URL("..", import.meta.url), env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" }, detached: true });
let log = "";
dev.stdout.on("data", (d) => (log += d));
dev.stderr.on("data", (d) => (log += d));
// wrangler starts workerd as a child: stop the whole process group, or the port stays taken.
const bye = (code) => {
  try {
    process.kill(-dev.pid, "SIGTERM");
  } catch {}
  process.exit(code);
};
try {
  for (let i = 0; !/Ready on/.test(log); i++) {
    if (i > 600 || dev.exitCode !== null) throw new Error("wrangler dev did not start:\n" + log);
    await new Promise((r) => setTimeout(r, 100));
  }
  const url = `ws://127.0.0.1:${PORT}/room/e2e-${Date.now()}?players=2`;
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
  while (clients.some((c) => c.net.frame < N)) {
    for (const c of clients) if (c.net.frame < N) c.e.advance(1 / 60);
    await new Promise((r) => setTimeout(r, 1)); // let the sockets breathe
    if (performance.now() - t0 > 60000) throw new Error("timed out at frames " + clients.map((c) => c.net.frame));
  }
  const [a, b] = clients;
  assert.deepEqual(a.hashes.slice(0, N), b.hashes.slice(0, N), "same state hash every frame");
  assert.deepEqual(a.bytes, b.bytes, "byte-identical state at frame N");
  assert.equal(a.net.desync, -1);
  assert.equal(b.net.desync, -1);
  const ms = performance.now() - t0;
  console.log(`ok: 2 clients, ${N} frames through wrangler dev (workerd, Durable Object) in ${ms.toFixed(0)} ms; byte-identical; stalls ${a.net.stalls}/${b.net.stalls}`);
  clients.forEach((c) => c.e.destroy());
  bye(0);
} catch (err) {
  console.error(err);
  bye(1);
}
