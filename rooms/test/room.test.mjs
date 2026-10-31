// The Worker and the Room Durable Object in Node, on small fakes of the platform (no wrangler):
// the invite transports, the per-IP rate caps, and when a room closes. The real platform run is
// test/wrangler.mjs (npm run test:wrangler).
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { inviteKey } from "../src/limits.js";
import { msg, INPUT, WELCOME } from "../src/relay.js";

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
  send(d) {
    this.sent.push(Uint8Array.from(d));
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
  return { r: new Room(ctx, env), sockets, alarms };
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
