import test from "node:test";
import assert from "node:assert/strict";
import { Relay, msg, INPUT, WELCOME, LEAVE } from "../src/relay.js";

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
