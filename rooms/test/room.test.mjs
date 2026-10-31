// The Worker and the Room Durable Object in Node, on small fakes of the platform (no wrangler):
// the invite transports, the per-IP rate caps, and when a room closes. The real platform run is
// test/wrangler.mjs (npm run test:wrangler).
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { inviteKey } from "../src/limits.js";
import { msg, INPUT, WELCOME, LEAVE } from "../src/relay.js";

registerHooks({
  resolve: (spec, ctx, next) =>
    spec === "cloudflare:workers" ? { url: "data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }", shortCircuit: true } : next(spec, ctx),
});
// Node's Response refuses status 101; the Worker only needs status, headers, body and webSocket.
globalThis.Response = class {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.headers = new Headers(init.headers);
    this.webSocket = init.webSocket;
  }
  json() {
    return JSON.parse(this.body);
  }
};
class Socket {
  sent = [];
  closed = null;
  lobby = []; // LOBBY (8) messages are kept apart, so the other checks read the match's messages
  send(d) {
    (d[0] === 8 ? this.lobby : this.sent).push(Uint8Array.from(d));
  }
  close(code, why) {
    this.closed ??= [code, why];
  }
  serializeAttachment(a) {
    this.att = a;
  }
  deserializeAttachment() {
    return this.att;
  }
}
globalThis.WebSocketPair = class {
  constructor() {
    this[0] = new Socket();
    this[1] = new Socket();
  }
};
const { default: worker, Room } = await import("../src/worker.js");

const CODE = "TEST-ROOM-CODE1", ENV = { MAX_PLAYERS: "2", IDLE_SECONDS: "120", LOBBY_SECONDS: "90", GATE_RATE: "5", JOIN_RATE: "3" };
const kv = async (codes) => {
  const keys = new Set(await Promise.all(codes.map(inviteKey))), kv = { reads: 0 };
  kv.get = async (k) => (kv.reads++, keys.has(k) ? "label" : null);
  return kv;
};
/** A room on fake state: alarms are recorded, sockets accepted into a list. */
function room(env = ENV) {
  const sockets = [], alarms = [];
  const ctx = { getWebSockets: () => sockets.filter((s) => !s.closed), acceptWebSocket: (s) => sockets.push(s), storage: { setAlarm: async (t) => void alarms.push(t) } };
  const r = new Room(ctx, env);
  r.ctx = ctx;
  return { r, sockets, alarms };
}
const join = (r, { ip = "1.1.1.1", players = 2, protocols } = {}) =>
  r.fetch(new Request(`https://rooms.example/room/1?players=${players}`, { headers: { upgrade: "websocket", "cf-connecting-ip": ip, ...(protocols ? { "sec-websocket-protocol": protocols } : {}) } }));

test("worker: the invite travels in a subprotocol or a POST body; the URL still works for one release", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1e6 });
  const INVITES = await kv([CODE]), env = { ...ENV, INVITES, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(null, { status: 101 }) }) } };
  let ip = 0;
  const call = (path, init = {}) => worker.fetch(new Request("https://rooms.example" + path, { ...init, headers: { "cf-connecting-ip": `10.0.0.${++ip}`, ...init.headers } }), env);
  const post = await call("/invite", { method: "POST", body: CODE.toLowerCase() });
  assert.equal(post.status, 200);
  assert.deepEqual(post.json(), { ok: true, players: 2 });
  assert.equal((await call("/invite", { method: "POST", body: "NOT-ON-THE-LIST" })).status, 403);
  assert.equal((await call("/invite", { method: "POST", body: "x".repeat(300), headers: { "content-length": "300" } })).status, 403, "an oversized body isn't read");
  assert.equal((await call(`/invite?code=${CODE}`)).status, 200, "deprecated: the code in the URL");
  const ws = { upgrade: "websocket" };
  assert.equal((await call("/room/1?players=2", { headers: { ...ws, "sec-websocket-protocol": `fizlet-rooms, invite.${CODE}` } })).status, 101);
  assert.equal((await call(`/room/1?players=2&invite=${CODE}`, { headers: ws })).status, 101, "deprecated: ?invite=");
  assert.equal((await call("/room/1?players=2", { headers: { ...ws, "sec-websocket-protocol": "fizlet-rooms, invite.WRONG-CODE-1" } })).status, 403);
  assert.equal((await call("/room/1?players=2", { headers: ws })).status, 403, "no invite, no room");
  // Codes shorter than 10 characters are never on the list.
  assert.equal(await inviteKey("ABCDEFGHJ"), null);
  assert.match(await inviteKey("ABCDEFGHJK"), /^invite:/);
});

test("worker: GATE_RATE invite checks + joins per IP a minute, refused before the KV read", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 2e6 });
  const INVITES = await kv([CODE]), env = { ...ENV, INVITES, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(null, { status: 101 }) }) } };
  const call = (ip, path = "/invite", init = {}) => worker.fetch(new Request("https://rooms.example" + path, { method: "POST", body: "GUESS-000000", ...init, headers: { "cf-connecting-ip": ip, ...init.headers } }), env);
  for (let i = 0; i < 5; i++) assert.equal((await call("9.9.9.9")).status, 403);
  const over = await call("9.9.9.9");
  assert.equal(over.status, 429);
  assert.equal(over.headers.get("retry-after"), "60");
  assert.equal(INVITES.reads, 5, "the refused check cost no KV read");
  assert.equal((await call("9.9.9.9", "/room/0?players=2", { method: "GET", body: undefined, headers: { upgrade: "websocket", "sec-websocket-protocol": `fizlet-rooms, invite.${CODE}` } })).status, 429, "joins share the IP's count");
  assert.equal((await call("9.9.9.8")).status, 403, "another IP has its own count");
  t.mock.timers.tick(60000);
  assert.equal((await call("9.9.9.9")).status, 403, "a minute later the IP may check again");
});

test("room: a lone player's refused messages don't keep it open; it closes LOBBY_SECONDS after the first seat", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 3e6 });
  const { r, sockets, alarms } = room();
  const res = await join(r, { protocols: `fizlet-rooms, invite.${CODE}` });
  assert.equal(res.status, 101);
  assert.equal(res.headers.get("sec-websocket-protocol"), "fizlet-rooms", "the subprotocol is answered, or browsers drop the socket");
  assert.equal(alarms.at(-1), 3e6 + 90000, "the first alarm is the lobby deadline, not the 120 s idle one");
  const a = sockets[0];
  for (let s = 1; s < 90; s++) {
    t.mock.timers.tick(1000);
    r.webSocketMessage(a, msg(INPUT, 0, 2, s, 1).buffer); // refused: the room hasn't started
  }
  t.mock.timers.tick(1000);
  await r.alarm();
  assert.deepEqual(a.closed, [1001, "room not filled"]);
});

test("room: a full room's refused joiner and refused messages don't refresh the idle timer", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 4e6 });
  const { r, sockets, alarms } = room();
  await join(r, { ip: "1.0.0.1" });
  await join(r, { ip: "1.0.0.2" });
  const [a, b] = sockets;
  assert.equal(a.sent[0][0], WELCOME);
  t.mock.timers.tick(10000);
  r.webSocketMessage(a, msg(INPUT, 0, 2, 2, 1).buffer); // relayed: activity at +10 s
  assert.equal(b.sent.length, 2);
  for (let s = 0; s < 100; s++) {
    t.mock.timers.tick(1000);
    r.webSocketMessage(a, msg(INPUT, 0, 2, 2, 7).buffer); // the same frame again: refused
    if (s % 20 === 0) await join(r, { ip: `2.0.0.${s}` }); // "room full"
  }
  assert.equal(b.sent.length, 2, "repeats of frame 2 never reached b");
  assert.ok(sockets.slice(2).every((s) => s.closed?.[0] === 4000));
  t.mock.timers.tick(19000); // +119 s after the last relayed message: still open
  await r.alarm();
  assert.equal(a.closed, null);
  assert.equal(alarms.at(-1), 4e6 + 10000 + 120000 + 50, "the next check is 120 s after the last relayed message");
  t.mock.timers.tick(1000);
  await r.alarm();
  assert.deepEqual(a.closed, [1001, "room idle"]);
  assert.deepEqual(b.closed, [1001, "room idle"]);
});

test("room: JOIN_RATE joins per IP a minute, refused before a socket is accepted", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 5e6 });
  const { r, sockets } = room({ ...ENV, MAX_PLAYERS: "4" });
  for (let i = 0; i < 3; i++) assert.equal((await join(r, { ip: "3.3.3.3", players: 4 })).status, 101);
  const over = await join(r, { ip: "3.3.3.3", players: 4 });
  assert.equal(over.status, 429);
  assert.equal(sockets.length, 3, "no socket for the refused join");
  assert.equal((await join(r, { ip: "3.3.3.4", players: 4 })).status, 101);
  t.mock.timers.tick(60000);
  assert.equal((await join(r, { ip: "3.3.3.3", players: 4 })).status, 101, "a minute later");
});

test("room: a client's close is answered (else the client sees 1006 after a timeout, ~10 s on workerd)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 6e6 });
  const { r, sockets } = room();
  await join(r, { ip: "6.0.0.1" });
  await join(r, { ip: "6.0.0.2" });
  const [a, b] = sockets;
  r.webSocketClose(a, 1000, "bye");
  assert.deepEqual(a.closed, [1000, "bye"], "the close frame is echoed back");
  assert.equal(b.sent.at(-1)[0], 4, "and the others hear LEAVE");
  r.webSocketClose(b, 1006, ""); // abnormal: no close frame came, and 1006 may not be sent
  assert.equal(b.closed?.[0], 1000);
});

// ---- Resume, wake, the chunked invite body, START (kinds as numbers: RESUME 5, AWAY 6, START 7) ----
const RESUME = 5, AWAY = 6, START = 7;
const u32 = (d, i) => (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0;
const hex = (t) => t.toString(16).padStart(8, "0");
const kinds = (s) => s.sent.map((d) => [d[0], d[1]]);

test("room (P6-01): a room woken from hibernation keeps its idle clock", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 7e6 });
  const { r: r0, sockets, alarms } = room();
  let r = r0;
  await join(r, { ip: "7.0.0.1" });
  await join(r, { ip: "7.0.0.2" });
  const [a] = sockets;
  for (let f = 1; f <= 100; f++) {
    t.mock.timers.tick(1000);
    r.webSocketMessage(a, msg(INPUT, 0, 2, f, 1).buffer); // relayed: busy until +100 s
  }
  r = new Room(r.ctx, ENV); // quiet for > 10 s: hibernated; the lobby alarm (+90 s was set first) wakes it
  t.mock.timers.tick(20000); // +120 s: 20 s after the last relayed message
  await r.alarm();
  assert.equal(a.closed, null, "busy until +100 s: not idle at +120 s");
  assert.ok(Math.abs(alarms.at(-1) - (7e6 + 100000 + 120000 + 50)) <= 1000, `next check ~120 s after the last message, got +${(alarms.at(-1) - 7e6) / 1000} s`);
  r = new Room(r.ctx, ENV); // hibernates again: the clock still holds, it doesn't restart on every wake
  t.mock.timers.tick(101000); // +221 s
  await r.alarm();
  assert.deepEqual(a.closed, [1001, "room idle"]);
});

test("worker (P6-04): a chunked POST /invite body is read only to 257 bytes", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 8e6 });
  const INVITES = await kv([CODE]), env = { ...ENV, GATE_RATE: "100", INVITES };
  const stream = (chunks) => {
    const s = { pulled: 0 };
    let i = 0;
    s.body = new ReadableStream({ pull(c) { if (i >= chunks.length) return c.close(); const b = chunks[i++]; s.pulled += b.byteLength; c.enqueue(b); } }, { highWaterMark: 0 });
    return s;
  };
  const post = (s) => worker.fetch(new Request("https://rooms.example/invite", { method: "POST", body: s.body, duplex: "half", headers: { "cf-connecting-ip": "8.8.8.8" } }), env);
  const big = stream(Array.from({ length: 16384 }, () => new Uint8Array(64).fill(65))); // 1 MiB, no content-length
  assert.equal((await post(big)).status, 403);
  assert.ok(big.pulled <= 320, `read ${big.pulled} bytes of a 1 MiB body (want ≤ 257 + one chunk)`);
  const enc = new TextEncoder().encode(CODE), ok = stream([enc.slice(0, 5), enc.slice(5)]);
  assert.equal((await post(ok)).status, 200, "a code sent in chunks still works");
});

test("room (P6-02): a dropped seat is held; its token gets it back with a resume frame and the inputs it missed", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 9e6 });
  const { r, sockets, alarms } = room();
  await join(r, { ip: "9.0.0.1" });
  await join(r, { ip: "9.0.0.2" });
  const [a, b] = sockets, ta = u32(a.sent[0], 8), tb = u32(b.sent[0], 8);
  assert.ok(ta && tb && ta !== tb, "WELCOME carries a per-seat resume token (bytes 8..11)");
  for (let f = 1; f <= 3; f++) r.webSocketMessage(a, msg(INPUT, 0, 2, f, 10 + f).buffer), r.webSocketMessage(b, msg(INPUT, 1, 2, f, 20 + f).buffer);
  r.webSocketClose(a, 1006, ""); // a Wi-Fi blip: no close frame
  assert.deepEqual(kinds(b).at(-1), [AWAY, 0], "the others hear AWAY (reconnecting), not LEAVE");
  assert.ok(alarms.at(-1) <= 9e6 + 20000 + 50, "an alarm at the end of the resume window");
  t.mock.timers.tick(3000);
  r.webSocketMessage(b, msg(INPUT, 1, 2, 4, 24).buffer); // sent while a is away
  assert.equal((await join(r, { ip: "9.0.0.3" })).status, 101);
  assert.deepEqual(sockets[2].closed, [4000, "room full"], "a held seat is not free for a stranger");
  await join(r, { ip: "9.0.0.4", protocols: `fizlet-rooms, invite.${CODE}, resume.${hex((tb ^ 1) >>> 0)}` });
  assert.equal(sockets[3].closed?.[0], 4002, "a wrong token gets no seat");
  const res = await join(r, { ip: "9.0.0.1", protocols: `fizlet-rooms, invite.${CODE}, resume.${hex(ta)}` });
  assert.equal(res.headers.get("sec-websocket-protocol"), "fizlet-rooms");
  const c = sockets[4];
  assert.equal(c.closed, null);
  assert.deepEqual([c.sent[0][0], c.sent[0][1], c.sent[0][2], u32(c.sent[0], 8)], [WELCOME, 0, 2, ta], "WELCOME: its old seat and token");
  assert.deepEqual(kinds(c)[1], [RESUME, 0], "then a resume frame");
  const replay = c.sent.filter((d) => d[0] === INPUT).map((d) => [d[1], u32(d, 4), u32(d, 8)]);
  assert.deepEqual(replay, [[1, 1, 21], [1, 2, 22], [1, 3, 23], [1, 4, 24]], "and the other seats' recent inputs, the one sent while away included");
  assert.deepEqual(kinds(b).at(-1), [RESUME, 0], "the others hear RESUME: lockstep continues");
  assert.equal(r.webSocketMessage(c, msg(INPUT, 0, 2, 2, 99).buffer), undefined);
  assert.notEqual(u32(b.sent.at(-1), 4), 2, "first input wins across a resume: frame 2 isn't sent twice");
  r.webSocketMessage(c, msg(INPUT, 0, 2, 4, 14).buffer);
  assert.deepEqual([b.sent.at(-1)[0], b.sent.at(-1)[1], u32(b.sent.at(-1), 4)], [INPUT, 0, 4]);
  // Half-open: the room still seats the old socket when the client comes back. The old one is let go.
  await join(r, { ip: "9.0.0.1", protocols: `fizlet-rooms, invite.${CODE}, resume.${hex(ta)}` });
  assert.deepEqual(c.closed, [4001, "resumed"]);
  assert.ok(!b.sent.some((d) => d[0] === LEAVE), "nobody heard LEAVE");
  r.webSocketClose(c, 1006, ""); // the replaced socket's own close: not this seat any more
  assert.equal(kinds(b).at(-1)[0], RESUME);
  // Hibernation while a seat is away: the hold survives the wake.
  const d = sockets[5];
  r.webSocketClose(d, 1006, "");
  const w = new Room(r.ctx, ENV);
  await join(w, { ip: "9.0.0.1", protocols: `fizlet-rooms, invite.${CODE}, resume.${hex(ta)}` });
  assert.deepEqual([sockets[6].sent[0][0], sockets[6].sent[0][1]], [WELCOME, 0], "resumed after a wake");
  // Past the window, the seat is gone for good: LEAVE, and the token no longer works.
  w.webSocketClose(sockets[6], 1006, "");
  t.mock.timers.tick(20001);
  await w.alarm();
  assert.deepEqual(kinds(b).at(-1), [LEAVE, 0]);
  await join(w, { ip: "9.0.0.1", protocols: `fizlet-rooms, invite.${CODE}, resume.${hex(ta)}` });
  assert.equal(sockets[7].closed?.[0], 4002);
  assert.equal(b.closed, null, "the one left keeps its seat");
});

test("room (P6-06): a seat that left is not re-seated after a wake; a clean close (1000) leaves at once", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 10e6 });
  const sockets = [], ctx = { getWebSockets: () => sockets, acceptWebSocket: (s) => sockets.push(s), storage: { setAlarm: async () => {} } };
  const r = new Room(ctx, ENV);
  await join(r, { ip: "10.0.0.1" });
  await join(r, { ip: "10.0.0.2" });
  const [a, b] = sockets;
  r.webSocketClose(a, 1000, "bye");
  assert.deepEqual(kinds(b).at(-1), [LEAVE, 0]);
  const w = new Room(ctx, ENV); // the platform still lists a's socket
  assert.equal(w.relay.seats[0], null);
});

test("room: START from the host (seat 0) begins before the room is full, with the seats taken", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 11e6 });
  const { r, sockets } = room({ ...ENV, MAX_PLAYERS: "4", JOIN_RATE: "50" });
  for (let i = 0; i < 3; i++) await join(r, { ip: `11.0.0.${i}`, players: 4 });
  const [a, b, c] = sockets;
  r.webSocketClose(b, 1000, "bye"); // a hole before the start
  const start = (ws, n, mode) => r.webSocketMessage(ws, Uint8Array.from([START, 0, n, mode, 0, 0, 0, 0, 0, 0, 0, 0]).buffer);
  start(c, 0, 5);
  assert.equal(c.sent.length, 0, "only the host may start");
  start(a, 3, 9); // begin once 3 are seated
  assert.equal(a.sent.length, 0, "2 seated: waits for a third");
  await join(r, { ip: "11.0.0.9", players: 4 });
  const d = sockets[3];
  for (const [s, slot] of [[a, 0], [d, 1], [c, 2]]) assert.deepEqual([...s.sent[0].slice(0, 4)], [WELCOME, slot, 3, 9], "seats 0..2 of 3 (the newcomer took the hole), the host's mode in byte 3");
  await join(r, { ip: "11.0.0.10", players: 4 });
  assert.equal(sockets[4].closed?.[0], 4000, "a started room takes nobody new");
  r.webSocketMessage(c, msg(INPUT, 0, 3, 2, 7).buffer);
  assert.deepEqual([d.sent.at(-1)[0], d.sent.at(-1)[1]], [INPUT, 2], "relayed, stamped with the compacted seat");
  const { r: r2, sockets: s2 } = room({ ...ENV, MAX_PLAYERS: "4" });
  await join(r2, { ip: "12.0.0.1", players: 4 });
  await join(r2, { ip: "12.0.0.2", players: 4 });
  r2.webSocketMessage(s2[0], Uint8Array.from([START, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer); // 0: now
  assert.deepEqual([...s2[1].sent[0].slice(0, 3)], [WELCOME, 1, 2]);
});

test("room: LOBBY before the start tells each waiting seat its seat, how many are seated and the room size, on every join and leave", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 13e6 });
  const LOBBY = 8, { r, sockets } = room({ ...ENV, MAX_PLAYERS: "4", JOIN_RATE: "50" });
  const last = (s) => [...s.lobby.at(-1)?.slice(0, 4) ?? []];
  await join(r, { ip: "13.0.0.1", players: 4 });
  const [a] = sockets;
  assert.deepEqual(last(a), [LOBBY, 0, 4, 1], "seat 0 of a 4-seat room, 1 seated");
  await join(r, { ip: "13.0.0.2", players: 4 });
  await join(r, { ip: "13.0.0.3", players: 4 });
  const [, b, c] = sockets;
  assert.deepEqual([last(a), last(b), last(c)], [[LOBBY, 0, 4, 3], [LOBBY, 1, 4, 3], [LOBBY, 2, 4, 3]], "everyone hears the new count, each with its own seat");
  r.webSocketClose(b, 1000, "bye");
  assert.deepEqual([last(a), last(c)], [[LOBBY, 0, 4, 2], [LOBBY, 2, 4, 2]], "a leave is told too");
  r.webSocketMessage(a, Uint8Array.from([7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer); // START now
  const n = a.lobby.length;
  assert.equal(a.sent[0][0], WELCOME);
  await join(r, { ip: "13.0.0.4", players: 4 });
  assert.equal(a.lobby.length, n, "no LOBBY once started");
});
