// fizlet-rooms: one Durable Object per numbered room, WebSockets with hibernation (an idle room holds
// no running object). Demo gate: an invite code checked against Workers KV. Spend caps are hard
// limits in code (src/limits.js): at most MAX_ROOMS rooms, MAX_PLAYERS seats, MSG_RATE messages a
// second per socket, 12-byte messages only, idle rooms closed, every room closed after MAX_ROOM_SECONDS.
//
//   GET /invite?code=XXXX                           → 200 {ok:true, players} | 403 (the page's "sign in" check;
//                                                     players = MAX_PLAYERS, so a page offers only room sizes that join)
//   GET /room/<n>?players=2&invite=XXXX  (WebSocket) → the room, n < MAX_ROOMS
import { DurableObject } from "cloudflare:workers";
import { Relay } from "./relay.js";
import { Bucket, MSG_BYTES, inviteKey, limits, originOk, roomNumber } from "./limits.js";

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}) } });

/** Is this invite code on the list? (KV `INVITES`: key = SHA-256 of the code, made by the owner.) */
async function invited(env, code) {
  const key = await inviteKey(code);
  return !!key && !!env.INVITES && (await env.INVITES.get(key)) !== null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), cap = limits(env), origin = req.headers.get("origin");
    if (!originOk(origin, cap.ORIGINS)) return json({ error: "origin not allowed" }, 403);
    if (url.pathname === "/invite") return (await invited(env, url.searchParams.get("code"))) ? json({ ok: true, players: cap.MAX_PLAYERS }, 200, origin) : json({ ok: false }, 403, origin);
    const n = roomNumber(url.pathname, cap.MAX_ROOMS);
    if (n < 0) return json({ error: `rooms are /room/0 to /room/${cap.MAX_ROOMS - 1}` }, 404);
    if (req.headers.get("upgrade") !== "websocket") return json({ error: "expected a WebSocket upgrade" }, 426);
    const players = Number(url.searchParams.get("players") || 2);
    if (!Number.isInteger(players) || players < 1 || players > cap.MAX_PLAYERS) return json({ error: `players: 1 to ${cap.MAX_PLAYERS}` }, 400);
    if (!(await invited(env, url.searchParams.get("invite")))) return json({ error: "invite code needed" }, 403);
    return env.ROOMS.get(env.ROOMS.idFromName(`room-${n}`)).fetch(req);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.cap = limits(env);
    this.relay = null;
    this.buckets = new Map(); // socket → token bucket (in memory; a woken room starts them full)
    this.last = 0; // ms of the last message (in memory)
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
    if (!this.relay || !this.relay.seats.some(Boolean)) {
      this.relay = Object.assign(new Relay(players, crypto.getRandomValues(new Uint32Array(1))[0]), { born: now });
      // The first seat arms the idle / lifetime alarm.
      await this.ctx.storage.setAlarm(now + this.cap.IDLE_SECONDS * 1000);
    }
    const r = this.relay;
    if (r.players !== players) return new Response("this room has a different player count\n", { status: 409 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    if (r.join(server) < 0) server.close(4000, "room full");
    this.last = now;
    // Every seated socket carries the room's state, so a hibernated room wakes up whole.
    for (const ws of this.ctx.getWebSockets()) {
      const s = r.seats.indexOf(ws);
      if (s >= 0) ws.serializeAttachment({ slot: s, players: r.players, seed: r.seed, started: r.started, born: r.born });
    }
    return new Response(null, { status: 101, webSocket: client });
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
    this.last = now;
    this.relay.message(s, data);
  }
  webSocketClose(ws) {
    this.leave(ws);
  }
  webSocketError(ws) {
    this.leave(ws);
  }
  /** Idle for IDLE_SECONDS, or older than MAX_ROOM_SECONDS: close everyone; else check again later. */
  async alarm() {
    const now = Date.now(), r = this.relay;
    if (!r || !r.seats.some(Boolean)) return;
    const idle = now - this.last >= this.cap.IDLE_SECONDS * 1000, old = now - (r.born ?? now) >= this.cap.MAX_ROOM_SECONDS * 1000;
    if (idle || old) {
      for (const ws of this.ctx.getWebSockets()) this.kick(ws, 1001, idle ? "room idle" : "room time is up");
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(this.last + this.cap.IDLE_SECONDS * 1000, r.born + this.cap.MAX_ROOM_SECONDS * 1000) + 50);
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
