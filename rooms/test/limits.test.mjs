import test from "node:test";
import assert from "node:assert/strict";
import { CAPS, Bucket, Window, inviteFrom, inviteKey, limits, originOk, roomClock, roomNumber } from "../src/limits.js";

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
  assert.equal(await inviteKey("ABCDEFGHJ"), null, "9 characters: below the 10 minimum");
  assert.equal(await inviteKey("x".repeat(65)), null);
  assert.equal(await inviteKey(null), null);
});

test("origins: an empty list allows any (local dev); a list allows only itself", () => {
  assert.equal(originOk("https://x.example", []), true);
  assert.equal(originOk("https://a.example", ["https://a.example"]), true);
  assert.equal(originOk("https://x.example", ["https://a.example"]), false);
  assert.equal(originOk(null, ["https://a.example"]), false);
});

test("window: `limit` hits per key a minute, bounded memory", () => {
  const w = new Window(3, 60000, 2);
  assert.deepEqual([1, 2, 3, 4].map(() => w.hit("a", 0)), [true, true, true, false]);
  assert.equal(w.hit("b", 0), true, "another key has its own count");
  assert.equal(w.hit("a", 59999), false);
  assert.equal(w.hit("a", 60000), true, "a new window");
  w.hit("c", 60000); // a third key: past `keys`, the table starts over
  assert.equal(w.map.size, 1);
});

test("room clock: lobby deadline, idle, lifetime", () => {
  const cap = limits({ LOBBY_SECONDS: "90", IDLE_SECONDS: "120", MAX_ROOM_SECONDS: "1800" });
  assert.deepEqual(roomClock(cap, { born: 0, last: 0, started: false }, 0), { why: "", at: 90000 });
  assert.equal(roomClock(cap, { born: 0, last: 80000, started: false }, 90000).why, "room not filled", "seats taken late don't extend the lobby");
  assert.deepEqual(roomClock(cap, { born: 0, last: 80000, started: true }, 90000), { why: "", at: 200000 });
  assert.equal(roomClock(cap, { born: 0, last: 80000, started: true }, 200000).why, "room idle");
  assert.equal(roomClock(cap, { born: 0, last: 1799000, started: true }, 1800000).why, "room time is up");
});

test("invite from a request: subprotocol first, then the URL (deprecated)", () => {
  const req = (h) => new Request("https://r.example/room/1", { headers: h });
  assert.deepEqual(inviteFrom(req({ "sec-websocket-protocol": "fizlet-rooms, invite.ABCD-EFGH-JK" }), new URL("https://r.example/room/1?invite=OTHER")), { code: "ABCD-EFGH-JK", via: "protocol" });
  assert.deepEqual(inviteFrom(req({}), new URL("https://r.example/room/1?invite=URL-CODE-123")), { code: "URL-CODE-123", via: "url" });
  assert.deepEqual(inviteFrom(req({}), new URL("https://r.example/invite?code=URL-CODE-123")), { code: "URL-CODE-123", via: "url" });
  assert.deepEqual(inviteFrom(req({ "sec-websocket-protocol": "fizlet-rooms" }), new URL("https://r.example/room/1")), { code: null, via: "" });
});

test("resume token from a request: the subprotocol resume.<hex>, never the URL", async () => {
  const { resumeFrom } = await import("../src/limits.js");
  const req = (p) => new Request("https://rooms.example/room/1?resume.a1b2c3d4", { headers: p ? { "sec-websocket-protocol": p } : {} });
  assert.equal(resumeFrom(req("fizlet-rooms, invite.ABCDEFGHJK, resume.a1b2c3d4")), 0xa1b2c3d4);
  assert.equal(resumeFrom(req("fizlet-rooms, resume.7")), 7, "leading zeros optional");
  assert.equal(resumeFrom(req("fizlet-rooms, resume.123456789")), 0, "more than 32 bits");
  assert.equal(resumeFrom(req("fizlet-rooms, resume.xyz")), 0);
  assert.equal(resumeFrom(req("")), 0);
});
