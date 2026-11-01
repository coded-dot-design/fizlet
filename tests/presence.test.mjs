// Presence tests (Node): simulated clients over the in-memory transport stay byte-identical.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine, seeded } = await import("../src/index.ts");
const { presence, memory, websocket, hash32, INPUT, HASH, LEAVE } = await import("../src/presence.ts");
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

// A cheating seat 0 sends two different inputs for frame F: b steps F between them, c only after
// the second. Last write wins would split the sims; first write wins keeps them identical.
test("presence: first input wins: a second, different input for a frame can't split the peers", () => {
  const hub = memory({ peers: 3 }), F = 40, N = 200;
  const b = client(1, 3, hub.ends[1], { log: true }), c = client(2, 3, hub.ends[2], { log: true });
  const cheat = (f, v) => {
    const m = new Uint8Array(12), dv = new DataView(m.buffer);
    m[0] = INPUT, m[1] = 0, m[2] = 3;
    dv.setUint32(4, f, true), dv.setUint32(8, v, true);
    hub.ends[0].send(m);
    hub.tick();
  };
  const to = (x, frame) => {
    for (let i = 0; x.net.frame < frame && i < 1000; i++) (x.e.advance(1 / 60), hub.tick());
    assert.equal(x.net.frame, frame);
  };
  cheat(1, 99); // frames before `delay` are pre-filled with 0 on every peer: not rewritable either
  assert.equal(b.net.confirmed(0, 1), 0);
  assert.equal(c.net.dropped, 1);
  for (let f = 2; f < F; f++) cheat(f, f & 7);
  cheat(F, RIGHT | FIRE);
  for (let f = 0; f < F; f++) to(b, f + 1), to(c, f + 1); // both at frame F, F not run yet
  to(b, F + 1); // b runs F with the first input
  cheat(F, LEFT | UP); // the second, different input for F reaches both
  to(c, F + 1); // c runs F after it
  assert.equal(b.net.confirmed(0, F), RIGHT | FIRE);
  assert.equal(c.net.confirmed(0, F), RIGHT | FIRE, "c kept the first input, like b");
  assert.equal(c.net.dropped, 2, "the second input is refused and counted");
  for (let f = F + 1; f < N; f++) cheat(f, f & 7), to(b, f), to(c, f);
  to(b, N), to(c, N);
  assert.deepEqual(c.hashes.slice(0, N), b.hashes.slice(0, N), "same state every frame");
  assert.equal(b.net.desync, -1);
  assert.equal(c.net.desync, -1);
  // A second hash for one frame is refused too (the first one is what the check compares).
  const d0 = b.net.dropped;
  hub.ends[0].send(Object.assign(new Uint8Array(12), { 0: HASH, 4: 210 }));
  hub.ends[0].send(Object.assign(new Uint8Array(12), { 0: HASH, 4: 210, 8: 1 }));
  hub.tick();
  assert.equal(b.net.dropped - d0, 1, "the second hash for frame 210 is dropped");
  b.e.destroy(), c.e.destroy();
});

test("presence: join() passes its protocols to the WebSocket (the room's invite, out of the URL)", async () => {
  const real = globalThis.WebSocket, made = [];
  globalThis.WebSocket = class extends EventTarget {
    constructor(url, protocols) {
      super();
      made.push([url, protocols]);
      this.readyState = 1;
      this.send = () => {};
      this.close = () => {};
    }
  };
  try {
    const { join } = await import("../src/presence.ts");
    const p = join("wss://rooms.example/room/1?players=2", undefined, ["fizlet-rooms", "invite.ABCD-EFGH-JK"]);
    assert.deepEqual(made[0], ["wss://rooms.example/room/1?players=2", ["fizlet-rooms", "invite.ABCD-EFGH-JK"]]);
    p.catch(() => {});
  } finally {
    globalThis.WebSocket = real;
  }
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
  // A seat outside 0..players-1 (or a fraction) never stores its own input: refused, not a silent stall.
  for (const [slot, players] of [[-1, 2], [0.5, 2], [2, 2], [NaN, 2], [0, 33]])
    assert.throws(() => presence(createEngine(), { transport: hub.ends[0], slot, players, input: () => 0, step() {} }), RangeError, `slot ${slot} of ${players}`);
});

test("presence: a resumed link: AWAY then RESUME, the inputs lost while it was down are resent, lockstep goes on", () => {
  const RESUME = 5, AWAY = 6, hub = memory({ peers: 2, latency: 1 });
  let cut = false;
  const ends = hub.ends.map((e) => ({ ...e, send: (d) => cut || e.send(d) })); // a link that drops what it's given while cut
  const a = client(0, 2, ends[0], { log: true }), b = client(1, 2, ends[1], { log: true });
  run(hub, [a, b], 30);
  const room = (k, slot, to) => hub.ends[1 - to].send(Uint8Array.of(k, slot, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0)); // the room's word, delivered to `to`
  cut = true;
  room(AWAY, 0, 1);
  run(hub, [a, b], 40);
  assert.equal(b.net.away, 1, "b sees seat 0 reconnecting");
  assert.equal(b.net.lost, 0, "not left");
  const fa = a.net.frame, fb = b.net.frame;
  assert.ok(a.net.stalls > 20 && b.net.stalls > 20, "both stall: inputs were lost on the way");
  cut = false;
  room(RESUME, 0, 0); // the rejoined peer's own RESUME (after its WELCOME)
  room(RESUME, 0, 1); // and the others'
  run(hub, [a, b], 120);
  assert.equal(b.net.away, 0);
  assert.ok(a.net.frame > fa + 100 && b.net.frame > fb + 100, `lockstep goes on: ${fa} -> ${a.net.frame}, ${fb} -> ${b.net.frame}`);
  assert.equal(a.net.desync, -1);
  const f = Math.min(a.net.frame, b.net.frame) - 1;
  assert.equal(a.hashes[f], b.hashes[f], "byte-identical after the resume");
  a.e.destroy(), b.e.destroy();
});

test("presence: join() reconnects a dropped seat with its resume token, in memory only; START from the lobby", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const real = globalThis.WebSocket, made = [];
  globalThis.WebSocket = fakeWebSocket(made);
  try {
    const { join } = await import("../src/presence.ts");
    const url = "wss://rooms.example/room/1?players=4", P = ["fizlet-rooms", "invite.ABCD-EFGH-JK"];
    const lobbies = [];
    const p = join(url, undefined, P, { retry: 3, lobby: (start, seat, seated, size) => (lobbies.push([seat, seated, size]), seat === 0 && seated === 2 && start(2, 9)) });
    made[0].deliver([8, 0, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0]); // LOBBY: seat 0 of 4, 1 seated
    assert.equal(made[0].sent.length, 0);
    made[0].deliver([8, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(lobbies, [[0, 1, 4], [0, 2, 4]], "each LOBBY: seat, seated, room size");
    assert.deepEqual([...made[0].sent[0]], [7, 0, 2, 9, 0, 0, 0, 0, 0, 0, 0, 0], "the host's START: begin with 2, mode 9");
    made[0].deliver([3, 1, 2, 9, 0x2a, 0, 0, 0, 0xd4, 0xc3, 0xb2, 0xa1]);
    const j = await p;
    assert.deepEqual([j.slot, j.players, j.seed, j.mode], [1, 2, 42, 9]);
    assert.ok(!made[0].url.includes("a1b2c3d4"), "the token is never in the URL");
    const got = [];
    j.transport.listen((d) => got.push([d[0], d[1]]));
    made[0].deliver([1, 0, 0, 0, 5, 0, 0, 0, 1, 0, 0, 0]);
    made[0].fire("close", { code: 1006 }); // a Wi-Fi blip
    assert.deepEqual(got, [[1, 0], [6, 1]], "the input, then AWAY for this seat");
    t.mock.timers.tick(250);
    assert.equal(made.length, 2, "it reconnects");
    assert.deepEqual(made[1].protocols, [...P, "resume.a1b2c3d4"], "with the seat's token as a subprotocol");
    made[1].deliver([3, 1, 2, 9, 0x2a, 0, 0, 0, 0xd4, 0xc3, 0xb2, 0xa1]); // WELCOME again: eaten
    made[1].deliver([5, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // RESUME
    assert.deepEqual(got.at(-1), [5, 1]);
    j.transport.send(Uint8Array.of(1, 1, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0));
    assert.equal(made[1].sent.length, 1, "sends go to the new socket");
    // Drops again; the retries run out (3): LEAVE for this seat, and no more sockets.
    made[1].fire("close", { code: 1006 });
    for (let i = 0; i < 3; i++) t.mock.timers.tick(4000), made.at(-1).fire("close", { code: 1006 });
    assert.equal(made.length, 5);
    assert.deepEqual(got.at(-1), [4, 1]);
    t.mock.timers.tick(10000);
    assert.equal(made.length, 5);
    // The room's own close (seat gone, idle, the caps) is not retried; destroy closes with 1000 (a leave).
    const q = join(url, undefined, P);
    made.at(-1).deliver([3, 0, 2, 0, 1, 0, 0, 0, 7, 0, 0, 0]);
    const k = await q;
    made.at(-1).fire("close", { code: 1001 });
    t.mock.timers.tick(5000);
    assert.equal(made.length, 6);
    const r = join(url, undefined, P);
    made.at(-1).deliver([3, 0, 2, 0, 1, 0, 0, 0, 7, 0, 0, 0]);
    (await r).transport.close();
    assert.equal(made.at(-1).closed, 1000);
    made.at(-1).fire("close", { code: 1006 });
    t.mock.timers.tick(5000);
    assert.equal(made.length, 7, "a closed transport never reconnects");
    k.transport.close();
  } finally {
    globalThis.WebSocket = real;
  }
});

test("presence: join() keeps a play pass and device key on a resume (pass.<pass>, device.<key>, then resume.<token>)", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const real = globalThis.WebSocket, made = [];
  globalThis.WebSocket = fakeWebSocket(made);
  try {
    const { join } = await import("../src/presence.ts");
    const P = ["fizlet-rooms", "pass.eyJ2IjoxfQ.c2ln", "device.AAAAAAAAAAAAAAAAAAAA"];
    const p = join("wss://rooms.example/room/2?players=2", undefined, P);
    made[0].deliver([3, 0, 2, 0, 7, 0, 0, 0, 0xef, 0xbe, 0xad, 0x0e]);
    const j = await p;
    made[0].fire("close", { code: 1006 });
    t.mock.timers.tick(250);
    assert.deepEqual(made[1].protocols, [...P, "resume.eadbeef"], "the pass and device key ride again, the token after them");
    assert.ok(!made.some((w) => /pass|device|resume|eadbeef/.test(w.url)), "none of them in a URL");
    j.transport.close();
  } finally {
    globalThis.WebSocket = real;
  }
});
// The guide's close codes: a drop (1006, or a server restart: 1011, 1012, 1014) resumes the seat; the
// rest end the match. 1038 is 1006 + 32: JS takes shift counts mod 32, so the range guard must catch it.
for (const [code, resumes] of [[1006, 1], [1011, 1], [1012, 1], [1014, 1], [1000, 0], [1001, 0], [1005, 0], [1008, 0], [1009, 0], [4000, 0], [4001, 0], [4002, 0], [1038, 0]]) {
  test(`presence: join() ${resumes ? "resumes" : "ends"} on a close ${code}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const real = globalThis.WebSocket, made = [];
    globalThis.WebSocket = fakeWebSocket(made);
    try {
      const { join } = await import("../src/presence.ts");
      const P = ["fizlet-rooms", "invite.ABCD-EFGH-JK"];
      const p = join("wss://rooms.example/room/3?players=2", undefined, P);
      made[0].deliver([3, 1, 2, 0, 7, 0, 0, 0, 0xef, 0xbe, 0xad, 0x0e]);
      const j = await p, got = [];
      j.transport.listen((d) => got.push([d[0], d[1]]));
      made[0].fire("close", { code });
      t.mock.timers.tick(16000);
      if (resumes) {
        assert.deepEqual(got, [[6, 1]], "AWAY for this seat, no LEAVE");
        assert.equal(made.length, 2, "it reconnects");
        assert.deepEqual(made[1].protocols, [...P, "resume.eadbeef"], "with the resume token");
      } else {
        assert.deepEqual(got, [[4, 1]], "LEAVE for this seat at once");
        assert.equal(made.length, 1, "no retry");
      }
      j.transport.close();
    } finally {
      globalThis.WebSocket = real;
    }
  });
}

// A browser WebSocket stand-in for join(): records each socket made (url, protocols, what it sent, its
// close code); `deliver(bytes)` is a message from the room, `fire("close", { code })` a close.
function fakeWebSocket(made) {
  return class extends EventTarget {
    constructor(url, protocols) {
      super();
      made.push(this);
      Object.assign(this, { url, protocols, readyState: 1, sent: [], closed: null });
    }
    send(d) {
      this.sent.push(Uint8Array.from(d));
    }
    close(code) {
      this.closed = code;
    }
    fire(type, props = {}) {
      const ev = Object.assign(new Event(type), props);
      this.dispatchEvent(ev);
      this["on" + type]?.(ev);
    }
    deliver(bytes) {
      this.fire("message", { data: Uint8Array.from(bytes).buffer });
    }
  };
}

// A WebSocket stand-in: send copies the bytes before it returns (as browsers and Workers do).
function fakeSocket() {
  const got = new Uint8Array(12), n = new Int32Array(1);
  return { got, n, ws: { readyState: 1, binaryType: "", addEventListener() {}, close() {}, send(d) { got.set(d); n[0]++; } } };
}

test("presence: the WebSocket transport sends the 12 bytes as given and allocates nothing per message", async (t) => {
  const f = fakeSocket(), tr = websocket(f.ws), out = new Uint8Array(12);
  out.set([1, 0, 0, 0, 7, 1, 0, 0, 9, 0, 0, 0]);
  tr.send(out);
  assert.deepEqual([...f.got], [...out]);
  assert.equal(f.n[0], 1);
  f.ws.readyState = 3;
  tr.send(out);
  assert.equal(f.n[0], 1, "nothing goes out on a closed socket");
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  f.ws.readyState = 1;
  for (let i = 0; i < 20000; i++) (out[4] = i), tr.send(out);
  const minor = await minorGCs(() => {
    for (let i = 0; i < 400000; i++) (out[4] = i), tr.send(out);
  });
  console.log(`# young-generation GCs over 400k WebSocket sends: ${minor}`);
  assert.ok(minor <= 1, `the transport allocated per message: ${minor} scavenges`);
});

test("presence: adds no allocation to the steady state (exchange + memory link)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const count = async (frame) => {
    for (let i = 0; i < 20000; i++) frame(); // warm up (and let V8 optimise)
    return minorGCs(() => {
      for (let i = 0; i < 200000; i++) frame();
    });
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
