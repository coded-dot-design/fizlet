// presence/rollback tests (Node): screens over the in-memory link, each its own engine and rollback
// link, end byte for byte on the run with no network at all; hashes match on every final frame; a
// forced difference shows as a desync; a seat that leaves plays `gone`; the delay follows the latency;
// a screen that starts ahead slows to meet the others; no allocation per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { memory, LEAVE, INPUT, HASH } = await import("../src/presence.ts");
const { rollback } = await import("../src/rollback.ts");

const OFF = { hidden: false, offscreen: false, editable: false };
const LEFT = 1, RIGHT = 2, UP = 4, DOWN = 8, FIRE = 16, AUTO = 32, SHOTS = 32;

/** A small deterministic world, all of it in one Float64Array and one Uint32Array (its random state):
 *  one ship per seat, a ring of shots, a score. `AUTO` steers a ship by itself (what a leaver plays). */
function world(P) {
  const S = new Float64Array(P * 4 + SHOTS * 4 + 1), R = new Uint32Array(1);
  R[0] = 0x9e3779b9;
  for (let p = 0; p < P; p++) (S[p * 4] = 100 + p * 40), (S[p * 4 + 1] = 100);
  const B0 = P * 4, bytes = [new Uint8Array(S.buffer), new Uint8Array(R.buffer)];
  const rnd = () => ((R[0] ^= R[0] << 13), (R[0] ^= R[0] >>> 17), (R[0] ^= R[0] << 5), R[0] / 4294967296);
  const step = (inputs, frame) => {
    for (let p = 0; p < P; p++) {
      let b = inputs[p], o = p * 4;
      if (b & AUTO) b = (frame >> 4) & 1 ? LEFT | UP : RIGHT | DOWN;
      S[o + 2] = S[o + 2] * 0.9 + ((b & RIGHT ? 1 : 0) - (b & LEFT ? 1 : 0)) * 0.7;
      S[o + 3] = S[o + 3] * 0.9 + ((b & DOWN ? 1 : 0) - (b & UP ? 1 : 0)) * 0.7 + (rnd() - 0.5) * 0.05;
      S[o] += S[o + 2];
      S[o + 1] += S[o + 3];
      if (b & FIRE) {
        const k = B0 + ((frame + p) % SHOTS) * 4;
        (S[k] = S[o]), (S[k + 1] = S[o + 1]), (S[k + 2] = S[o + 2] * 2 + rnd()), (S[k + 3] = -4);
      }
    }
    for (let k = B0; k < B0 + SHOTS * 4; k += 4) (S[k] += S[k + 2]), (S[k + 1] += S[k + 3]);
    S[S.length - 1] += Math.sin(S[0] * 0.01) * Math.cos(S[1] * 0.01); // the same engine on every screen
  };
  return { S, bytes, step };
}
/** Seat p's input for frame f: a scripted thumb that changes often (so guesses miss and frames run again). */
const script = (f, p) => {
  const r = Math.imul(f * 2654435761 + p * 40503, 2246822519) >>> 0;
  return ((r >>> 3) % 7 < 2 ? LEFT : (r >>> 3) % 7 > 4 ? RIGHT : 0) | (r & 64 ? UP : r & 128 ? DOWN : 0) | ((r >>> 9) % 11 === 0 ? FIRE : 0);
};
/** The same frames with no network: frame f runs every seat's input(f). */
function straight(P, frames, input = script) {
  const w = world(P), ins = new Uint32Array(P);
  for (let f = 0; f < frames; f++) {
    for (let p = 0; p < P; p++) ins[p] = input(f, p);
    w.step(ins, f);
  }
  return w;
}
const u32 = (d, i) => (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0;
const same = (a, b) => a.bytes.every((v, i) => Buffer.from(v).equals(Buffer.from(b.bytes[i])));

/** P screens over one in-memory link (latency ± jitter ticks; later messages may overtake). Each end is
 *  wrapped so a test can play the room's own messages (LEAVE) into a screen. */
function screens(P, { latency = 0, jitter = 0, seed = 3, input = script, opts = {}, onStep, log = true } = {}) {
  const hub = memory({ peers: P, latency, jitter, seed, cap: 8192 }), room = [];
  const runs = Array.from({ length: P }, (_, s) => {
    const end = hub.ends[s], t = { send: (d) => (log && d[0] === HASH && (hashes[u32(d, 4)] = u32(d, 8)), end.send(d)), listen: (fn) => ((room[s] = fn), end.listen(fn)), close: () => end.close() };
    const e = createEngine({ seed: 1, pause: OFF }), w = world(P), hashes = [], seen = [];
    const rb = rollback(e, {
      transport: t, slot: s, players: P, bytes: w.bytes, gone: AUTO, input: (f) => input(f, s),
      step: (inputs, f, live, sure) => void (w.step(inputs, f), onStep?.(s, f, live, sure, w)),
      confirm: log ? (_i, f) => void seen.push(f) : undefined,
      ...opts,
    });
    return { e, w, rb, hashes, seen };
  });
  const tick = (skip) => {
    hub.tick();
    for (let s = 0; s < P; s++) if (!skip?.(s)) runs[s].e.advance(1 / 60);
  };
  return { hub, runs, tick, room };
}
/** Hold every screen at `frames` and run until each has `frames` final frames. */
function finishAt(net, frames, budget = frames * 3) {
  for (const r of net.runs) r.rb.hold = frames;
  for (let t = 0; t < budget && !net.runs.every((r) => r.rb.final === frames); t++) net.tick();
}

test("rollback: two and four screens with latency and jitter end byte for byte on the run with no network", () => {
  for (const P of [2, 4]) {
    const N = 1500, want = straight(P, N);
    for (const [latency, jitter, seed] of [[0, 0, 1], [4, 3, 2], [9, 7, 3], [18, 14, 4]]) {
      const net = screens(P, { latency, jitter, seed });
      finishAt(net, N);
      for (const r of net.runs) {
        assert.equal(r.rb.final, N, `${P} screens, ${latency}±${jitter}: every frame final`);
        assert.equal(r.rb.desync, -1, `${P} screens, ${latency}±${jitter}: no desync`);
        assert.ok(same(r.w, want), `${P} screens, latency ${latency} ± ${jitter} ticks: byte for byte the run with no network`);
      }
      if (latency) assert.ok(net.runs.every((r) => r.rb.corrections > 0 && r.rb.resims > 0), `${P} × ${latency}±${jitter}: late inputs ran frames again (${net.runs.map((r) => r.rb.corrections)})`);
      for (const r of net.runs) r.e.destroy();
    }
  }
});

test("rollback: a 3-minute match on random latency, two and four screens: the state hash equal on every final frame", () => {
  for (const P of [2, 4]) {
    // hashEvery 1: every screen sends (and checks) the hash of every final frame; the test keeps them.
    const N = 3 * 60 * 60, net = screens(P, { latency: 6, jitter: 12, seed: 7 + P, opts: { hashEvery: 1 } });
    finishAt(net, N);
    const [a] = net.runs;
    assert.equal(Object.keys(a.hashes).length, N, `${P} screens: a hash for every final frame`);
    for (const r of net.runs) {
      assert.equal(r.rb.final, N);
      assert.equal(r.rb.desync, -1, "no desync");
      assert.deepEqual(r.hashes, a.hashes, `${P} screens: every final frame's hash equal`);
    }
    assert.ok(same(a.w, straight(P, N)), "and byte for byte the run with no network");
    for (const r of net.runs) r.e.destroy();
  }
});

test("rollback: local input runs at once on guesses; every final frame is confirmed once, in order; sure frames run once", () => {
  const sureRuns = [new Map(), new Map()];
  const net = screens(2, { latency: 8, jitter: 4, seed: 9, onStep: (s, f, live, sure) => sure && sureRuns[s].set(f, (sureRuns[s].get(f) ?? 0) + 1) });
  let ahead = 0;
  for (let t = 0; t < 900; t++) {
    net.tick();
    if (t > 60) ahead = Math.max(ahead, net.runs[0].rb.frame - net.runs[0].rb.final);
  }
  // 8 ticks each way (16 a round trip), yet every engine step ran a frame.
  for (const r of net.runs) assert.ok(r.rb.stalls === 0 && r.rb.frame >= 890, `ran every step: frame ${r.rb.frame}, stalls ${r.rb.stalls}`);
  assert.ok(ahead >= 6, `frames ran ahead of the final ones, on guesses: ${ahead}`);
  for (const r of net.runs) assert.deepEqual(r.seen, Array.from({ length: r.seen.length }, (_, i) => i), "final frames confirmed once each, in order");
  for (const m of sureRuns) for (const [f, k] of m) assert.equal(k, 1, `frame ${f} ran sure once`);
  for (const r of net.runs) r.e.destroy();
});

test("rollback: the correction meters read only the clock the host gives (none: 0, no wall time)", () => {
  for (const withClock of [false, true]) {
    const e = createEngine({ seed: 1, pause: OFF }), w = world(2);
    let listener, ticks = 0;
    const t = { send() {}, listen: (fn) => (listener = fn), close() {} };
    const clock = () => (ticks += 3);
    const rb = rollback(e, { transport: t, slot: 0, players: 2, bytes: w.bytes, delay: 1, input: (f) => script(f, 0), step: (i, f) => w.step(i, f), ...(withClock ? { clock } : {}) });
    const msg = new Uint8Array(12);
    for (let i = 0; i < 10; i++) e.advance(1 / 60);
    for (let f = 0; f < 10; f++) {
      msg.fill(0), (msg[0] = INPUT), (msg[1] = 1), (msg[2] = 1);
      new DataView(msg.buffer).setUint32(4, f, true), new DataView(msg.buffer).setUint32(8, script(f, 1) | FIRE, true);
      listener(msg);
    }
    e.advance(1 / 60);
    assert.equal(rb.corrections, 1);
    if (withClock) assert.ok(ticks === 6 && rb.resimMs === 3 && rb.resimTotal === 3, `one read each side of the correction: ${ticks}, ${rb.resimMs}`);
    else assert.ok(rb.resimMs === 0 && rb.resimTotal === 0, "no clock: the meters stay 0");
    e.destroy();
  }
});

test("rollback: a late input (after its frame ran on a guess) rewinds to that frame and runs forward again", () => {
  // Seat 1 is a hand-driven peer: its inputs reach seat 0 only when the test sends them.
  const e = createEngine({ seed: 1, pause: OFF }), w = world(2), rewinds = [];
  let listener;
  const t = { send() {}, listen: (fn) => (listener = fn), close() {} };
  const rb = rollback(e, { transport: t, slot: 0, players: 2, bytes: w.bytes, delay: 1, input: (f) => script(f, 0), step: (i, f) => w.step(i, f), rewind: (b) => rewinds.push(b) });
  const msg = new Uint8Array(12);
  const put = (f, bits) => {
    msg.fill(0), (msg[0] = INPUT), (msg[1] = 1), (msg[2] = 1);
    new DataView(msg.buffer).setUint32(4, f, true), new DataView(msg.buffer).setUint32(8, bits, true);
    listener(msg);
  };
  for (let i = 0; i < 20; i++) e.advance(1 / 60);
  assert.equal(rb.frame, 20, "ran 20 frames on guesses");
  assert.equal(rb.final, 0, "none final (seat 1 said nothing)");
  // Seat 1's real inputs for frames 0..19 arrive, all late, all different from the guess (0).
  for (let f = 0; f < 20; f++) put(f, script(f, 1) | FIRE);
  e.advance(1 / 60);
  assert.deepEqual(rewinds, [true, false], "one correction");
  assert.equal(rb.corrections, 1);
  assert.ok(rb.deepest >= 20 && rb.resims >= 20, `ran the 20 frames again: deepest ${rb.deepest}`);
  assert.equal(rb.final, 20, "the corrected frames are final");
  // An input for a frame that is already final is ignored (counted, never applied).
  const d0 = rb.dropped;
  put(5, 0);
  assert.equal(rb.dropped, d0 + 1);
  e.destroy();
});

test("rollback: a late input lands on the same bytes as the straight run", () => {
  // Seat 0 runs ahead on guesses, then seat 1's real inputs arrive in a burst; once final, byte for byte.
  const P = 2, N = 240, e = createEngine({ seed: 1, pause: OFF }), w = world(P);
  let listener;
  const rb = rollback(e, { transport: { send() {}, listen: (fn) => (listener = fn), close() {} }, slot: 0, players: P, bytes: w.bytes, delay: 1, window: 100, input: (f) => script(f, 0), step: (i, f) => w.step(i, f) });
  const msg = new Uint8Array(12), dv = new DataView(msg.buffer);
  const put = (f) => ((msg[0] = INPUT), (msg[1] = 1), (msg[2] = 1), dv.setUint32(4, f, true), dv.setUint32(8, script(f, 1), true), listener(msg));
  rb.hold = N;
  let sent = 0;
  for (let t = 0; t < N * 3 && rb.final < N; t++) {
    e.advance(1 / 60);
    // Seat 1 is 40 frames behind, then catches up in bursts of 16.
    if (t > 40 && t % 8 === 0) for (let k = 0; k < 16 && sent < N; k++) put(sent++);
  }
  assert.equal(rb.final, N);
  assert.ok(rb.corrections >= 3, `corrections: ${rb.corrections}`);
  assert.ok(same(w, straight(P, N)), "byte for byte the run with no network");
  e.destroy();
});

test("rollback: a forced difference on one screen is reported as a desync at the next hash", () => {
  const AT = 400;
  const net = screens(2, { latency: 3, jitter: 2, onStep: (s, f, _l, _s, w) => s === 1 && f === AT && (w.S[0] += 1e-9) });
  finishAt(net, 900);
  for (const r of net.runs) assert.ok(r.rb.desync > AT && r.rb.desync <= AT + 31, `desync caught at frame ${r.rb.desync}`);
  assert.equal(net.runs[0].rb.desync, net.runs[1].rb.desync, "both screens name the same frame");
  for (const r of net.runs) r.e.destroy();
});

test("rollback: four seats, one leaves: it plays `gone` from the same frame on every screen, the rest stay identical", () => {
  const P = 4, AT = 600, net = screens(P, { latency: 3, jitter: 2, seed: 5 });
  let told = false, quiet = 0;
  for (let t = 0; t < 2000; t++) {
    net.tick((s) => s === 3 && net.runs[3].rb.frame >= AT); // seat 3 closed the tab
    // Once its last messages are through the link, the room says LEAVE (after everything it relayed).
    if (!told && net.runs[3].rb.frame >= AT && ++quiet > 8) {
      told = true;
      net.runs[3].rb.destroy();
      for (let s = 0; s < 3; s++) net.room[s](Uint8Array.of(LEAVE, 3, P, 0, 0, 0, 0, 0, 0, 0, 0, 0));
    }
  }
  const stay = net.runs.slice(0, 3), from = stay[0].rb.leftAt(3);
  assert.ok(told);
  for (const r of stay) {
    assert.equal(r.rb.left, 1 << 3, "the others know seat 3 left");
    assert.equal(r.rb.lost, 1 << 3);
    assert.equal(r.rb.leftAt(3), from, "`gone` from the same frame everywhere");
  }
  assert.ok(from > AT - 4 && from <= AT + 4, `from the frame after its last input: ${from}`);
  const at = Math.max(...stay.map((r) => r.rb.frame)) + 2;
  for (const r of stay) r.rb.hold = at;
  for (let t = 0; t < 600 && !stay.every((r) => r.rb.final === at); t++) net.tick((s) => s === 3);
  const want = straight(P, at, (f, p) => (p === 3 && f >= from ? AUTO : script(f, p)));
  for (const r of stay) {
    assert.equal(r.rb.final, at);
    assert.equal(r.rb.desync, -1);
    assert.ok(same(r.w, want), "byte for byte the run where seat 3 plays `gone` from that frame");
  }
  for (const r of net.runs) r.e.destroy();
});

test("rollback: the input delay follows the measured latency (1 to 3 frames); a fixed delay stays", () => {
  const pick = (latency) => {
    const net = screens(2, { latency, seed: 2 });
    for (let t = 0; t < 600; t++) net.tick();
    const d = net.runs.map((r) => r.rb.delay);
    for (const r of net.runs) r.e.destroy();
    return d;
  };
  assert.deepEqual(pick(0), [1, 1], "a fast link: 1 frame");
  assert.deepEqual(pick(9), [2, 2], "9 ticks each way: 2 frames");
  assert.deepEqual(pick(20), [3, 3], "20 ticks each way: 3 frames");
  const net = screens(2, { latency: 20, opts: { delay: 1 } });
  for (let t = 0; t < 600; t++) net.tick();
  assert.deepEqual(net.runs.map((r) => r.rb.delay), [1, 1], "delay: 1 stays 1");
  for (const r of net.runs) r.e.destroy();
});

test("rollback: a screen that starts ahead waits a frame now and then until the others meet it", () => {
  const net = screens(2, { latency: 4, jitter: 1, seed: 6 });
  for (let t = 0; t < 30; t++) (net.hub.tick(), net.runs[0].e.advance(1 / 60)); // seat 0 starts half a second early
  for (let t = 0; t < 60; t++) net.tick();
  const early = net.runs[0].rb.lead;
  for (let t = 0; t < 400; t++) net.tick();
  const [a, b] = net.runs, w0 = [a.rb.waits, b.rb.waits];
  for (let t = 0; t < 1000; t++) net.tick();
  assert.ok(early > 4, `seat 0 ran ahead at first: ${early.toFixed(1)} frames`);
  // The early screen does most of the waiting (the late one may wait a little on an overshoot).
  assert.ok(a.rb.waits > 2 * b.rb.waits, `the early screen waited (${a.rb.waits}), more than the other (${b.rb.waits})`);
  assert.deepEqual([a.rb.waits, b.rb.waits], w0, "once they met, no more waits");
  assert.ok(Math.abs(a.rb.lead) <= 1 && Math.abs(b.rb.lead) <= 1, `they met: leads ${a.rb.lead.toFixed(1)}, ${b.rb.lead.toFixed(1)}`);
  assert.ok(Math.abs(a.rb.frame - b.rb.frame) <= 3, `frames ${a.rb.frame}, ${b.rb.frame}`);
  for (const r of net.runs) r.e.destroy();
});

test("rollback: bad options throw; destroy and the engine's end stop it", () => {
  const hub = memory({ peers: 2 }), make = (o) => () => rollback(createEngine(), { transport: hub.ends[0], slot: 0, players: 2, bytes: [new Uint8Array(8)], input: () => 0, step() {}, ...o });
  for (const o of [{ slot: 2 }, { slot: -1 }, { slot: 0.5 }, { players: 9 }, { window: 1 }, { window: 101 }, { delay: 4 }]) assert.throws(make(o), RangeError, JSON.stringify(o));
  const e = createEngine({ pause: OFF }), w = world(2), rb = rollback(e, { transport: hub.ends[0], slot: 0, players: 2, bytes: w.bytes, input: () => 0, step: (i, f) => w.step(i, f) });
  for (let i = 0; i < 10; i++) e.advance(1 / 60);
  assert.equal(rb.frame, 10);
  rb.destroy();
  for (let i = 0; i < 10; i++) e.advance(1 / 60);
  assert.equal(rb.frame, 10, "destroyed: no more frames");
  const e2 = createEngine({ pause: OFF }), rb2 = rollback(e2, { transport: hub.ends[1], slot: 1, players: 2, bytes: world(2).bytes, input: () => 0, step() {} });
  e2.destroy();
  e2.advance?.(1 / 60);
  assert.equal(rb2.frame, 0, "the engine's end stops it");
});

test("rollback: no allocation per frame (four screens, corrections every few frames)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const net = screens(4, { latency: 5, jitter: 3, seed: 2, log: false });
  for (let i = 0; i < 6000; i++) net.tick();
  const r0 = net.runs.map((r) => r.rb.resims);
  const minor = await minorGCs(() => {
    for (let i = 0; i < 20000; i++) net.tick();
  });
  const resims = net.runs.map((r, i) => r.rb.resims - r0[i]);
  console.log(`# young-generation GCs over 20,000 ticks of four screens with rollback: ${minor} (${resims.join(" / ")} frames run again)`);
  assert.ok(net.runs.every((r) => r.rb.desync < 0), "no desync");
  assert.ok(resims.every((n) => n > 5000), `corrections ran: ${resims}`);
  assert.ok(minor <= 1, `young GCs: ${minor}`);
  for (const r of net.runs) r.e.destroy();
});
