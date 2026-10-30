import test from "node:test";
import assert from "node:assert/strict";
import { CAPS, Bucket, inviteKey, limits, originOk, roomNumber } from "../src/limits.js";

test("limits: defaults, overrides, and ceilings no config can lift", () => {
  const d = limits({});
  for (const [k, [def]] of Object.entries(CAPS)) assert.equal(d[k], def, k);
  assert.deepEqual(d.ORIGINS, []);
  const o = limits({ MAX_ROOMS: "4", MAX_PLAYERS: "99", MSG_RATE: "-5", IDLE_SECONDS: "abc", MAX_ROOM_SECONDS: "1e9", ALLOWED_ORIGINS: " https://a.example , https://b.example " });
  assert.equal(o.MAX_ROOMS, 4);
  assert.equal(o.MAX_PLAYERS, 8, "MAX_PLAYERS can't pass 8");
  assert.equal(o.MSG_RATE, 10, "a negative rate is clamped up to the floor");
  assert.equal(o.IDLE_SECONDS, 120, "garbage falls back to the default");
  assert.equal(o.MAX_ROOM_SECONDS, 14400, "rooms never live past 4 hours");
  assert.deepEqual(o.ORIGINS, ["https://a.example", "https://b.example"]);
});

test("bucket: rate per second with a burst", () => {
  const b = new Bucket(10, 5);
  let ok = 0;
  for (let i = 0; i < 20; i++) ok += b.allow(1000) ? 1 : 0;
  assert.equal(ok, 5, "a burst of 5, then refused");
  assert.equal(b.allow(1100), true, "100 ms at 10/s earns one more");
  assert.equal(b.allow(1100), false);
  assert.equal(b.allow(10000), true);
});

test("rooms are numbered below MAX_ROOMS", () => {
  assert.equal(roomNumber("/room/0", 16), 0);
  assert.equal(roomNumber("/room/15", 16), 15);
  assert.equal(roomNumber("/room/16", 16), -1);
  assert.equal(roomNumber("/room/abc", 16), -1);
  assert.equal(roomNumber("/room/1/x", 16), -1);
  assert.equal(roomNumber("/rooms/1", 16), -1);
});

test("invite keys: SHA-256 of the trimmed, upper-cased code; short or huge codes refused", async () => {
  const k = await inviteKey(" blitz-demo-1 ");
  assert.equal(k, await inviteKey("BLITZ-DEMO-1"));
  assert.match(k, /^invite:[0-9a-f]{64}$/);
  assert.ok(!k.includes("BLITZ"), "the code itself is never in the key");
  assert.equal(await inviteKey("abc"), null);
  assert.equal(await inviteKey("x".repeat(65)), null);
  assert.equal(await inviteKey(null), null);
});

test("origins: an empty list allows any (local dev); a list allows only itself", () => {
  assert.equal(originOk("https://x.example", []), true);
  assert.equal(originOk("https://a.example", ["https://a.example"]), true);
  assert.equal(originOk("https://x.example", ["https://a.example"]), false);
  assert.equal(originOk(null, ["https://a.example"]), false);
});
