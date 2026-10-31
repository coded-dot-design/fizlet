// fizlet-rooms: one Durable Object per numbered room, WebSockets with hibernation (an idle room holds
// no running object). Demo gate: an invite code checked against Workers KV. Spend caps are hard
// limits in code (src/limits.js): at most MAX_ROOMS rooms, MAX_PLAYERS seats, MSG_RATE messages a
// second per socket, 12-byte messages only, GATE_RATE invite checks + joins per IP a minute (per
// isolate) and JOIN_RATE joins per IP a minute into a room, unfilled rooms closed after
// LOBBY_SECONDS, idle rooms closed, every room closed after MAX_ROOM_SECONDS. Threats and limits:
// THREAT-MODEL.md.
//
//   POST /invite  body: the code (text/plain)      → 200 {ok:true, players} | 403 (the page's "sign in" check;
//                                                     players = MAX_PLAYERS, so a page offers only room sizes that join)
//   GET /room/<n>?players=2  (WebSocket, subprotocols ["fizlet-rooms", "invite.<code>"])
//                                                   → the room, n < MAX_ROOMS; the 101 answers "fizlet-rooms"
//   Deprecated, accepted for one release: GET /invite?code=XXXX and /room/<n>?invite=XXXX (URLs are logged).
//   Over a rate cap: 429 {error:"slow down"} with retry-after.
import { DurableObject } from "cloudflare:workers";
import { Relay } from "./relay.js";
import { Bucket, MSG_BYTES, Window, inviteFrom, inviteKey, limits, originOk, roomClock, roomNumber } from "./limits.js";

const PROTOCOL = "fizlet-rooms";
const json = (body, status, origin, headers) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}), ...headers } });
const slow = (origin) => json({ error: "slow down" }, 429, origin, { "retry-after": "60" });
const ipOf = (req) => req.headers.get("cf-connecting-ip") ?? "";

/** Is this invite code on the list? (KV `INVITES`: key = SHA-256 of the code, made by the owner.) */
async function invited(env, code) {
  const key = await inviteKey(code);
  return !!key && !!env.INVITES && (await env.INVITES.get(key)) !== null;
}

// Invite checks and joins per IP, counted in this isolate (free; Cloudflare runs many isolates, so
// this bounds one client's KV reads and Durable Object requests per isolate, not globally).
let gate = null;

export default {
  async fetch(req, env) {
    const url = new URL(req.url), cap = limits(env), origin = req.headers.get("origin");
    if (!originOk(origin, cap.ORIGINS)) return json({ error: "origin not allowed" }, 403);
    if (gate?.limit !== cap.GATE_RATE) gate = new Window(cap.GATE_RATE);
    if (url.pathname === "/invite") {
      if (!gate.hit(ipOf(req), Date.now())) return slow(origin);
      const len = Number(req.headers.get("content-length") ?? 0);
      const code = req.method === "POST" ? (len > 256 ? null : (await req.text()).slice(0, 256)) : inviteFrom(req, url).code;
      return (await invited(env, code)) ? json({ ok: true, players: cap.MAX_PLAYERS }, 200, origin) : json({ ok: false }, 403, origin);
    }
    const n = roomNumber(url.pathname, cap.MAX_ROOMS);
    if (n < 0) return json({ error: `rooms are /room/0 to /room/${cap.MAX_ROOMS - 1}` }, 404);
    if (req.headers.get("upgrade") !== "websocket") return json({ error: "expected a WebSocket upgrade" }, 426);
    const players = Number(url.searchParams.get("players") || 2);
    if (!Number.isInteger(players) || players < 1 || players > cap.MAX_PLAYERS) return json({ error: `players: 1 to ${cap.MAX_PLAYERS}` }, 400);
    if (!gate.hit(ipOf(req), Date.now())) return slow();
    if (!(await invited(env, inviteFrom(req, url).code))) return json({ error: "invite code needed" }, 403);
    return env.ROOMS.get(env.ROOMS.idFromName(`room-${n}`)).fetch(req);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.cap = limits(env);
    this.relay = null;
    this.buckets = new Map(); // socket → token bucket (in memory; a woken room starts them full)
    this.joins = new Window(this.cap.JOIN_RATE); // joins per IP a minute into this room (in memory)
    this.last = 0; // ms of the last relayed message or seat taken (in memory)
    // Waking from hibernation: rebuild the seats from the sockets' attachments.
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      this.relay ??= Object.assign(new Relay(a.players, a.seed), { started: a.started, born: a.born });
      this.relay.seat(ws, a.slot);
    }
  }
  async fetch(req) {
    const players = Number(new URL(req.url).searchParams.get("players") || 2), now = Date.now();
    // Refused before a socket is accepted: no seat, no timer refreshed.
    if (!this.joins.hit(ipOf(req), now)) return slow();
    if (this.relay?.seats.some(Boolean) && this.relay.players !== players) return new Response("this room has a different player count\n", { status: 409 });
    if (!this.relay || !this.relay.seats.some(Boolean)) {
      this.relay = Object.assign(new Relay(players, crypto.getRandomValues(new Uint32Array(1))[0]), { born: now });
      this.last = now;
      // The first seat arms the alarm: the lobby deadline comes first.
      await this.ctx.storage.setAlarm(roomClock(this.cap, { born: now, last: now, started: false }, now).at);
    }
    const r = this.relay;
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    // A seat taken counts as activity; a "room full" joiner doesn't keep the room open.
    if (r.join(server) < 0) server.close(4000, "room full");
    else this.last = now;
    // Every seated socket carries the room's state, so a hibernated room wakes up whole.
    for (const ws of this.ctx.getWebSockets()) {
      const s = r.seats.indexOf(ws);
      if (s >= 0) ws.serializeAttachment({ slot: s, players: r.players, seed: r.seed, started: r.started, born: r.born });
    }
    // A client that sent its invite as a subprotocol must get one of its protocols back.
    const offered = (req.headers.get("sec-websocket-protocol") ?? "").split(",").some((p) => p.trim() === PROTOCOL);
    return new Response(null, { status: 101, webSocket: client, headers: offered ? { "sec-websocket-protocol": PROTOCOL } : {} });
  }
  webSocketMessage(ws, data) {
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s < 0) return;
    // Caps: binary messages of exactly 12 bytes, at most MSG_RATE a second (with a burst).
    if (typeof data === "string" || data.byteLength !== MSG_BYTES) return this.kick(ws, 1009, "12-byte binary messages only");
    let b = this.buckets.get(ws);
    if (!b) this.buckets.set(ws, (b = new Bucket(this.cap.MSG_RATE, this.cap.MSG_BURST)));
    const now = Date.now();
    if (!b.allow(now)) return this.kick(ws, 1008, "rate limit");
    // Only a relayed message keeps the room alive: a lone player's refused messages don't.
    if (this.relay.message(s, data)) this.last = now;
  }
  webSocketClose(ws, code, reason) {
    this.leave(ws);
    // Answer the client's close, or it waits for one and ends with 1006 (~10 s on workerd).
    // 1005/1006 mean no code was sent and may not be sent back: answer those with 1000.
    const echo = code === 1000 || code === 1001 || (code >= 3000 && code < 5000);
    try {
      ws.close(echo ? code : 1000, echo ? reason : "");
    } catch {}
  }
  webSocketError(ws) {
    this.leave(ws);
  }
  /** Not full after LOBBY_SECONDS, idle for IDLE_SECONDS, or older than MAX_ROOM_SECONDS: close everyone; else check again later. */
  async alarm() {
    const now = Date.now(), r = this.relay;
    if (!r || !r.seats.some(Boolean)) return;
    const { why, at } = roomClock(this.cap, { born: r.born ?? now, last: this.last, started: r.started }, now);
    if (why) {
      for (const ws of this.ctx.getWebSockets()) this.kick(ws, 1001, why);
      return;
    }
    await this.ctx.storage.setAlarm(at + 50);
  }
  kick(ws, code, why) {
    this.leave(ws);
    try {
      ws.close(code, why);
    } catch {}
  }
  leave(ws) {
    this.buckets.delete(ws);
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s >= 0) this.relay.leave(s);
  }
}
