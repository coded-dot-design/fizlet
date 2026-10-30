import test from "node:test";
import assert from "node:assert/strict";
import { Relay, msg, INPUT, HASH, WELCOME, LEAVE } from "../src/relay.js";

const peer = () => ({ got: [], send(d) { this.got.push(Uint8Array.from(d)); } });

test("relay: seats, welcome when full, relays with the real seat, refuses extras", () => {
  const r = new Relay(2, 77), a = peer(), b = peer(), c = peer();
  assert.equal(r.join(a), 0);
  assert.equal(a.got.length, 0, "no welcome until the room is full");
  assert.equal(r.join(b), 1);
  assert.deepEqual([a.got[0][0], a.got[0][1], a.got[0][2], a.got[0][4]], [WELCOME, 0, 2, 77]);
  assert.deepEqual([b.got[0][0], b.got[0][1]], [WELCOME, 1]);
  assert.equal(r.join(c), -1, "a started room takes nobody new");
  const spoof = msg(INPUT, 1, 0, 5, 9); // a claims to be seat 1
  assert.equal(r.message(0, spoof), true);
  assert.equal(b.got[1][1], 0, "the relay stamps the sender's real seat");
  assert.equal(a.got.length, 1, "nothing echoes back to the sender");
  assert.equal(r.message(0, new Uint8Array(5)), false);
  assert.equal(r.message(0, msg(WELCOME, 0, 0, 0, 0)), false, "clients can't send room messages");
  r.leave(0);
  assert.deepEqual([b.got.at(-1)[0], b.got.at(-1)[1]], [LEAVE, 0]);
  r.leave(1);
  assert.equal(r.started, false, "an empty room starts over");
});

test("relay: four players, every input to the three others, a leave told to all of them", () => {
  const r = new Relay(4, 9), p = [peer(), peer(), peer(), peer()];
  p.forEach((x, i) => assert.equal(r.join(x), i));
  p.forEach((x, i) => assert.deepEqual([x.got[0][0], x.got[0][1], x.got[0][2]], [WELCOME, i, 4], "each gets its seat and the room size"));
  assert.equal(r.message(2, msg(INPUT, 0, 0, 1, 5)), true);
  p.forEach((x, i) => assert.equal(x.got.length, i === 2 ? 1 : 2, "fan-out to the other three only"));
  assert.ok(p.every((x, i) => i === 2 || x.got[1][1] === 2), "stamped with seat 2");
  r.leave(3);
  p.slice(0, 3).forEach((x) => assert.deepEqual([x.got.at(-1)[0], x.got.at(-1)[1]], [LEAVE, 3]));
  assert.equal(r.join(peer()), -1, "a started room takes nobody new, even after a leave");
});

test("relay: first input wins: a seat's repeated or older frame is never relayed", () => {
  const r = new Relay(3, 1), p = [peer(), peer(), peer()];
  p.forEach((x) => r.join(x));
  assert.equal(r.message(0, msg(INPUT, 0, 0, 5, 1)), true);
  assert.equal(r.message(0, msg(INPUT, 0, 0, 5, 2)), false, "a second, different input for frame 5");
  assert.equal(r.message(0, msg(INPUT, 0, 0, 4, 2)), false, "an older frame");
  assert.equal(r.message(0, msg(INPUT, 0, 0, 6, 3)), true);
  assert.equal(r.message(1, msg(INPUT, 0, 0, 5, 9)), true, "each seat has its own frames");
  assert.equal(r.message(0, msg(HASH, 0, 0, 30, 7)), true, "hashes are counted apart from inputs");
  assert.equal(r.message(0, msg(HASH, 0, 0, 30, 8)), false);
  const got = p[2].got.slice(1).map((d) => [d[1], d[0], d[4], d[8]]);
  assert.deepEqual(got, [[0, INPUT, 5, 1], [0, INPUT, 6, 3], [1, INPUT, 5, 9], [0, HASH, 30, 7]], "both others got the first input only");
  assert.deepEqual(p[1].got.slice(1).map((d) => d[8]), [1, 3, 7]);
});
