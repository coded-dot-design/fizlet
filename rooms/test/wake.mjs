// What a Room remembers when its Durable Object wakes from hibernation (Node, on the same fakes as
// room.test.mjs; no wrangler). A hibernated object is rebuilt by its constructor from the sockets'
// attachments; everything else (`last`, the buckets, the relay's frames) starts over.
//   node test/wake.mjs [--self-test]
// 1. last: a room busy until +100 s, then quiet (every tab paused) long enough to hibernate. Its alarm
//    fires at +120 s (the deadline set from the first seat). Expected: still open (idle only at +220 s).
// 2. ghosts: a seat leaves; the platform still lists its socket (closing, attachment kept); the room
//    hibernates and wakes. Expected: the left seat is not re-seated (no ghost seat).
// --self-test runs both against a fixture Room that keeps `last` and drops a leaver's attachment: the
// checks must pass there, proving they can tell a fixed room from this one.
// Exit 0 when both hold; prints a JSON summary.
import { registerHooks } from "node:module";
import { msg, INPUT } from "../src/relay.js";

registerHooks({
  resolve: (spec, ctx, next) =>
    spec === "cloudflare:workers" ? { url: "data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }", shortCircuit: true } : next(spec, ctx),
});
globalThis.Response = class {
  constructor(body, init = {}) {
    this.status = init.status ?? 200;
    this.headers = new Headers(init.headers);
    this.webSocket = init.webSocket;
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
const { Room } = await import("../src/worker.js");
const SELF = process.argv.includes("--self-test");
// The fixture for --self-test: what a fixed room would do (keep `last` across a wake, forget a leaver).
class Fixed extends Room {
  constructor(ctx, env) {
    super(ctx, env);
    this.last = ctx.storage.last ?? this.last;
  }
  webSocketMessage(ws, data) {
    super.webSocketMessage(ws, data);
    this.ctx.storage.last = this.last;
  }
  leave(ws) {
    super.leave(ws);
    ws.serializeAttachment(null);
  }
}
const R = SELF ? Fixed : Room;
const ENV = { MAX_PLAYERS: "2", IDLE_SECONDS: "120", LOBBY_SECONDS: "90", MAX_ROOM_SECONDS: "1800", JOIN_RATE: "100" };
let clock = 1e9;
Date.now = () => clock;
function ctxOf() {
  const sockets = [], alarms = [];
  // A socket the client closed stays listed until the platform drops it (here: until the server closes it).
  return { sockets, alarms, getWebSockets: () => sockets.filter((s) => !s.closed), acceptWebSocket: (s) => sockets.push(s), storage: { setAlarm: async (t) => void alarms.push(t) } };
}
const join = (r, ip) => r.fetch(new Request("https://rooms.example/room/1?players=2", { headers: { upgrade: "websocket", "cf-connecting-ip": ip } }));
const results = [];
const check = (name, ok, got, want) => (results.push({ name, ok, got, want }), console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)} (want ${want})`));

{
  clock = 1e9;
  const ctx = ctxOf();
  let r = new R(ctx, ENV);
  await join(r, "1.0.0.1");
  await join(r, "1.0.0.2");
  const [a] = ctx.sockets;
  for (let f = 1; f <= 100; f++) {
    clock += 1000;
    r.webSocketMessage(a, msg(INPUT, 0, 2, f, 1).buffer); // relayed: busy until +100 s
  }
  r = new R(ctx, ENV); // quiet for > 10 s: the object hibernates; the alarm wakes it
  clock = 1e9 + 120000;
  await r.alarm();
  check("wake: a room busy until +100 s is still open at its +120 s alarm", a.closed === null, a.closed ?? "open", "open (idle closes at +220 s)");
}
{
  clock = 2e9;
  const ctx = ctxOf();
  let r = new R(ctx, ENV);
  await join(r, "2.0.0.1");
  await join(r, "2.0.0.2");
  const [a, b] = ctx.sockets;
  r.webSocketMessage(a, msg(INPUT, 0, 2, 1, 1).buffer);
  r.webSocketClose(a); // a's tab closed; the platform still lists the socket for a while
  r = new R(ctx, ENV); // hibernate + wake
  const ghost = r.relay?.seats[0] === a;
  check("wake: a seat that left is not re-seated from its stale attachment", !ghost, ghost ? "seat 0 re-seated with the closed socket" : "empty", "empty");
}
const pass = results.every((x) => x.ok);
console.log(JSON.stringify({ pass, selfTest: SELF, checks: results.length, failed: results.filter((x) => !x.ok).map((x) => x.name) }));
process.exit(pass ? 0 : 1);
