// Presence tests (Node): simulated clients over the in-memory transport stay byte-identical.
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver, constants } from "node:perf_hooks";

const { createEngine, seeded } = await import("../src/index.ts");
const { presence, memory, hash32, INPUT, LEAVE } = await import("../src/presence.ts");
const { syncCheck } = await import("../src/presence-check.ts");

const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8, FIRE = 16, SHOTS = 32;

// A small deterministic world: one ship per player plus a bounded ring of shots. All state is in
// one Float64Array, so a byte view of it is the whole state (the seeded random's state included).
function client(slot, players, transport, opts = {}) {
  const e = createEngine({ seed: 4242 });
  const S = new Float64Array(1 + players * 4 + SHOTS * 4), bytes = new Uint8Array(S.buffer);
  const P0 = 1, B0 = 1 + players * 4;
  for (let p = 0; p < players; p++) (S[P0 + p * 4] = 100 + p * 50), (S[P0 + p * 4 + 1] = 100);
  const mine = seeded(1000 + slot); // this player's "hands": only this client knows them
  const hashes = [];
  let snap = null;
  const input = () => {
    const r = mine();
    return (r < 0.3 ? LEFT : r > 0.7 ? RIGHT : 0) | (mine() < 0.4 ? UP : mine() < 0.3 ? DOWN : 0) | (mine() < 0.1 ? FIRE : 0);
  };
  const sim = {
    step(e, inputs, frame) {
      S[0] = e.random.state;
      for (let p = 0; p < players; p++) {
        const b = inputs[p], o = P0 + p * 4;
        S[o + 2] = S[o + 2] * 0.9 + ((b & RIGHT ? 1 : 0) - (b & LEFT ? 1 : 0)) * 0.7;
        S[o + 3] = S[o + 3] * 0.9 + ((b & DOWN ? 1 : 0) - (b & UP ? 1 : 0)) * 0.7 + (e.random() - 0.5) * 0.05;
        S[o] += S[o + 2];
        S[o + 1] += S[o + 3];
        if (b & FIRE) {
          const k = B0 + ((frame + p) % SHOTS) * 4;
          S[k] = S[o], S[k + 1] = S[o + 1], S[k + 2] = S[o + 2] * 2 + e.random(), S[k + 3] = -4;
        }
      }
      for (let k = B0; k < S.length; k += 4) (S[k] += S[k + 2]), (S[k + 1] += S[k + 3]);
      if (opts.cheat && frame === opts.cheat) S[P0] += 1e-9; // a one-ulp-ish drift on one peer
      if (opts.log) hashes[frame] = hash32(bytes);
      if (frame === opts.snapAt) snap = bytes.slice();
    },
  };
  if (opts.alone) {
    // The same sim and inputs without presence: the baseline for the allocation test.
    const ins = new Uint32Array(players), fr = new Int32Array(1);
    e.add({ step: (e) => ((ins[slot] = input()), sim.step(e, ins, fr[0]++)) });
    return { e };
  }
  const net = presence(e, { transport, slot, players, delay: opts.delay ?? 2, input, step: sim.step, hash: () => hash32(bytes) });
  return { e, net, hashes, get snap() { return snap; }, bytes };
}

function run(hub, clients, ticks, dts) {
  for (let t = 0; t < ticks; t++) {
    hub.tick();
    clients.forEach((c, i) => c.e.advance(dts ? dts[i](t) : 1 / 60));
  }
}

test("presence: two clients stay byte-identical for 3000 frames (no latency)", () => {
  const N = 3000, hub = memory({ peers: 2 });
  const a = client(0, 2, hub.ends[0], { log: true, snapAt: N - 1 });
  const b = client(1, 2, hub.ends[1], { log: true, snapAt: N - 1 });
  run(hub, [a, b], N + 10);
  assert.ok(a.net.frame >= N && b.net.frame >= N, `frames ${a.net.frame} / ${b.net.frame}`);
  assert.equal(a.net.stalls, 0, "input delay hides a zero-latency link completely");
  assert.deepEqual(a.hashes.slice(0, N), b.hashes.slice(0, N), "same state hash every frame");
  assert.deepEqual(a.snap, b.snap, "byte-identical state at frame N");
  assert.equal(a.net.desync, -1);
  assert.equal(b.net.desync, -1);
  assert.ok(a.snap.some((x) => x !== 0));
  a.e.destroy(), b.e.destroy();
});

test("presence: delayed, jittered, reordered inputs and unequal frame rates stay identical", () => {
  const N = 2000, hub = memory({ peers: 2, latency: 6, jitter: 5, seed: 9 });
  const a = client(0, 2, hub.ends[0], { log: true, snapAt: N - 1 });
  const b = client(1, 2, hub.ends[1], { log: true, snapAt: N - 1 });
  // A runs 60 Hz frames; B runs uneven frames (two steps, then none, then one).
  run(hub, [a, b], 6 * N, [() => 1 / 60, (t) => [2 / 60, 0, 1 / 60][t % 3]]);
  assert.ok(a.net.frame >= N && b.net.frame >= N, `frames ${a.net.frame} / ${b.net.frame}`);
  assert.ok(a.net.stalls > 0 && b.net.stalls > 0, "a link slower than the delay makes the sim wait");
  assert.ok(Math.abs(a.net.frame - b.net.frame) <= 2 * 2 + 1, "lockstep: peers never drift more than the delay window");
  assert.deepEqual(a.hashes.slice(0, N), b.hashes.slice(0, N));
  assert.deepEqual(a.snap, b.snap, "byte-identical state at frame N");
  assert.equal(a.net.desync, -1);
  assert.equal(hub.dropped, 0);
  a.e.destroy(), b.e.destroy();
});

test("presence: four players, latency 3", () => {
  const N = 1200, hub = memory({ peers: 4, latency: 3, jitter: 2, seed: 3 });
  const cs = [0, 1, 2, 3].map((s) => client(s, 4, hub.ends[s], { snapAt: N - 1, delay: 3 }));
  run(hub, cs, 2 * N);
  for (const c of cs) assert.ok(c.net.frame >= N);
  for (const c of cs.slice(1)) assert.deepEqual(c.snap, cs[0].snap);
  cs.forEach((c) => c.e.destroy());
});

test("presence: a desync is caught at the next hash check", () => {
  const hub = memory({ peers: 2, latency: 2 });
  const a = client(0, 2, hub.ends[0]), b = client(1, 2, hub.ends[1], { cheat: 100 });
  run(hub, [a, b], 400);
  assert.equal(a.net.desync, 120, "hashes every 30 frames: the drift at frame 100 shows at 120");
  assert.equal(b.net.desync, 120);
  a.e.destroy(), b.e.destroy();
});

test("presence: bounded window, lost seats, destroy", () => {
  const hub = memory({ peers: 2 });
  const a = client(0, 2, hub.ends[0]), b = client(1, 2, hub.ends[1]);
  run(hub, [a, b], 10);
  const f = a.net.frame;
  assert.ok(a.net.confirmed(1, f) >= 0, "the peer's input for the next frame is already here");
  const msg = new Uint8Array(12);
  msg[0] = INPUT, msg[1] = 1, msg[4] = 200; // frame 200: outside the 64-frame window
  hub.ends[1].send(msg);
  msg[0] = LEAVE;
  hub.ends[1].send(msg);
  hub.tick();
  assert.equal(a.net.dropped, 1);
  assert.equal(a.net.lost, 2, "seat 1 left");
  b.e.destroy(); // b stops sending: a waits, it never guesses
  const before = a.net.frame;
  run(hub, [a], 20);
  assert.ok(a.net.frame - before <= 2, "a runs at most the frames it already has inputs for");
  assert.ok(a.net.stalls >= 18);
  a.e.destroy();
  assert.throws(() => presence(createEngine(), { transport: hub.ends[0], slot: 0, players: 2, delay: 40, input: () => 0, step() {} }));
});

test("presence: adds no allocation to the steady state (exchange + memory link)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const count = async (frame) => {
    for (let i = 0; i < 20000; i++) frame(); // warm up (and let V8 optimise)
    gc();
    let minor = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
    });
    obs.observe({ entryTypes: ["gc"] });
    for (let i = 0; i < 200000; i++) frame();
    await new Promise((r) => setTimeout(r, 50));
    obs.disconnect();
    return minor;
  };
  const x = client(0, 2, null, { alone: true }), y = client(1, 2, null, { alone: true });
  const base = await count(() => (x.e.advance(1 / 60), y.e.advance(1 / 60)));
  const hub = memory({ peers: 2, latency: 1 });
  const a = client(0, 2, hub.ends[0]), b = client(1, 2, hub.ends[1]);
  const net = await count(() => (hub.tick(), a.e.advance(1 / 60), b.e.advance(1 / 60)));
  assert.equal(a.net.desync, -1);
  assert.ok(a.net.frame > 219000);
  console.log(`# young-generation GCs over 2 x 200k frames: same sim alone ${base}, over presence ${net}`);
  assert.ok(net <= base + 1, `presence added scavenges: ${base} -> ${net}`);
  [x, y, a, b].forEach((c) => c.e.destroy());
});

// A tiny game for syncCheck: one ship per player; `leak` makes it read a per-client value.
function tiny(leak) {
  return (e, slot, players) => {
    const S = new Float64Array(players * 2 + 1), mine = seeded(77 + slot);
    return {
      state: new Uint8Array(S.buffer),
      input: () => (mine() * 16) | 0,
      step(e, inputs, f) {
        for (let p = 0; p < players; p++) (S[p * 2] += (inputs[p] & 3) - 1.5 + e.random()), (S[p * 2 + 1] += inputs[p] >> 2);
        S[players * 2] = e.random.state;
        if (leak && f === leak) S[0] += slot; // reads something only this client has
      },
    };
  };
}

test("syncCheck: a deterministic game passes, a leaky one names its first divergent frame", () => {
  const good = syncCheck(tiny(0), { frames: 500, latency: 4, jitter: 3 });
  assert.deepEqual([good.ok, good.frames, good.diverged], [true, 500, -1]);
  assert.ok(good.stalls > 0);
  assert.equal(syncCheck(tiny(0), { players: 4, frames: 300 }).ok, true);
  const bad = syncCheck(tiny(123), { frames: 500 });
  assert.deepEqual([bad.ok, bad.frames, bad.diverged], [false, 500, 123]);
  // Math.random in the sim: caught on the first frame.
  const rand = syncCheck((e, s, p) => {
    const S = new Float64Array(1);
    return { state: new Uint8Array(S.buffer), input: () => 0, step: () => (S[0] += Math.random()) };
  }, { frames: 50 });
  assert.equal(rand.diverged, 0);
});
