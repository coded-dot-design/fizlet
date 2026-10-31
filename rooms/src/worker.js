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
//   The same, plus the subprotocol "resume.<token>" (the WELCOME token in hex): back in a seat that
//   dropped, within RESUME_SECONDS (README.md "Resume").
//   Deprecated, accepted for one release: GET /invite?code=XXXX and /room/<n>?invite=XXXX (URLs are logged).
//   Play passes (src/pass.js), only when REQUIRE_PASS is "true": the join offers "pass.<pass>" and
//   "device.<key>" instead of the invite; POST /invite checks "<pass>\n<device key>"; POST /pass/revoke
//   and /pass/list take the admin key (ROOMS_ADMIN_KEY).
//   Over a rate cap: 429 {error:"slow down"} with retry-after.
import { DurableObject } from "cloudflare:workers";
import { Relay } from "./relay.js";
import { Bucket, MSG_BYTES, Window, bodyText, inviteFrom, inviteKey, limits, originOk, resumeFrom, roomClock, roomNumber } from "./limits.js";
import { deviceKey, passFrom, passGate, requirePass, adminRequest } from "./pass.js";
export { Passes } from "./pass.js";

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
    if (url.pathname.startsWith("/pass/")) {
      if (!gate.hit(ipOf(req), Date.now())) return slow(origin);
      const r = await adminRequest(req, env, url.pathname);
      if (r) return json(r.body, r.status, origin);
    }
    if (url.pathname === "/invite") {
      if (!gate.hit(ipOf(req), Date.now())) return slow(origin);
      // A POST body is read to max + 1 bytes at most, chunked or not (P6-04): past max it's no code.
      // With passes on, the body may be a pass and a device key, so it may be longer.
      const code = req.method === "POST" ? await bodyText(req, requirePass(env) ? 1024 : 256) : inviteFrom(req, url).code;
      // Passes on (REQUIRE_PASS): the body is "<pass>\n<device key>", checked without taking a seat;
      // every answer says pass:true, so a page shows its PASS field (an empty POST asks just that).
      if (requirePass(env)) {
        const [p, d] = String(code ?? "").split("\n").map((s) => s.trim());
        const g = p ? await passGate(env, p, deviceKey(d), { claim: false }) : { ok: false, why: "pass needed" };
        return g.ok ? json({ ok: true, players: cap.MAX_PLAYERS, pass: true }, 200, origin) : json({ ok: false, pass: true, why: g.why }, 403, origin);
      }
      return (await invited(env, code)) ? json({ ok: true, players: cap.MAX_PLAYERS }, 200, origin) : json({ ok: false }, 403, origin);
    }
    const n = roomNumber(url.pathname, cap.MAX_ROOMS);
    if (n < 0) return json({ error: `rooms are /room/0 to /room/${cap.MAX_ROOMS - 1}` }, 404);
    if (req.headers.get("upgrade") !== "websocket") return json({ error: "expected a WebSocket upgrade" }, 426);
    const players = Number(url.searchParams.get("players") || 2);
    if (!Number.isInteger(players) || players < 1 || players > cap.MAX_PLAYERS) return json({ error: `players: 1 to ${cap.MAX_PLAYERS}` }, 400);
    if (!gate.hit(ipOf(req), Date.now())) return slow();
    // Passes on: a verified pass that this device holds replaces the invite. Off: the invite, as before.
    const offered = passFrom(req), pass = await passGate(env, offered.pass, offered.device);
    if (pass ? !pass.ok : !(await invited(env, inviteFrom(req, url).code))) return json({ error: pass?.why ?? "invite code needed" }, pass?.status ?? 403);
    return env.ROOMS.get(env.ROOMS.idFromName(`room-${n}`)).fetch(req);
  },
};

// A socket closed with one of these codes dropped (a network blip, a server restart): its seat is
// held for RESUME_SECONDS. Any other close (1000, 1001 a page going away, 1005 no code, 3000-4999)
// and a kick are a leave for good.
const DROPS = new Set([1006, 1011, 1012, 1014]);
// `last` is saved in the sender's attachment at most once a second, so a woken room knows it (P6-01).
const SAVE_MS = 1000;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.cap = limits(env);
    this.relay = null;
    this.buckets = new Map(); // socket → token bucket (in memory; a woken room starts them full)
    this.joins = new Window(this.cap.JOIN_RATE); // joins per IP a minute into this room (in memory)
    this.last = 0; // ms of the last relayed message or seat taken; saved in attachments (see save)
    this.saved = 0; // when `last` was last saved
    // Waking from hibernation: rebuild the seats, the holds and `last` from the sockets' attachments.
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      this.relay ??= Object.assign(new Relay(a.players, a.seed), { started: a.started, born: a.born, asked: a.asked ?? a.players, mode: a.mode ?? 0 });
      if (a.tokens) (this.relay.tokens = a.tokens), (this.relay.away = a.away);
      this.relay.seat(ws, a.slot);
      this.last = Math.max(this.last, a.last ?? 0);
    }
    // An attachment from before `last` was saved: unknown, so count from the wake (never from 0).
    if (this.relay && !this.last) this.last = Date.now();
  }
  /** Write the room's state into `ws`'s attachment (every socket, by default): a hibernated room wakes up whole. */
  save(only) {
    const r = this.relay;
    for (const ws of only ? [only] : this.ctx.getWebSockets()) {
      const s = r?.seats.indexOf(ws) ?? -1;
      if (s >= 0) ws.serializeAttachment({ slot: s, players: r.players, seed: r.seed, started: r.started, born: r.born, asked: r.asked, mode: r.mode, last: this.last, tokens: r.tokens, away: r.away });
    }
    this.saved = this.last;
  }
  /** Set the alarm to the room clock's next deadline or the first hold to run out, whichever is first. */
  async arm(now) {
    const r = this.relay, at = roomClock(this.cap, { born: r.born ?? now, last: this.last, started: r.started }, now).at;
    await this.ctx.storage.setAlarm(Math.min(at, ...r.away.filter(Boolean)) + 50);
  }
  async fetch(req) {
    const players = Number(new URL(req.url).searchParams.get("players") || 2), now = Date.now(), token = resumeFrom(req);
    // Refused before a socket is accepted: no seat, no timer refreshed.
    if (!this.joins.hit(ipOf(req), now)) return slow();
    // A client that sent its invite as a subprotocol must get one of its protocols back.
    const offered = (req.headers.get("sec-websocket-protocol") ?? "").split(",").some((p) => p.trim() === PROTOCOL);
    const upgraded = (client) => new Response(null, { status: 101, webSocket: client, headers: offered ? { "sec-websocket-protocol": PROTOCOL } : {} });
    if (token) {
      // A resume never takes a fresh seat: its token's seat, or closed 4002.
      const [client, server] = Object.values(new WebSocketPair()), r = this.relay, s = r?.slotOf(token) ?? -1;
      this.ctx.acceptWebSocket(server);
      if (s < 0) {
        server.close(4002, "seat gone");
        return upgraded(client);
      }
      // Half-open: the old socket may still sit in the seat. Let it go quietly (no LEAVE, no AWAY).
      const old = r.seats[s];
      if (old) {
        this.buckets.delete(old);
        old.serializeAttachment(null);
        r.seats[s] = null;
        try {
          old.close(4001, "resumed");
        } catch {}
      }
      r.resume(server, s);
      this.last = now;
      this.save();
      return upgraded(client);
    }
    if (this.relay?.live() && this.relay.asked !== players) return new Response("this room has a different player count\n", { status: 409 });
    if (!this.relay || !this.relay.live()) {
      this.relay = Object.assign(new Relay(players, crypto.getRandomValues(new Uint32Array(1))[0]), { born: now, asked: players });
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
    this.save();
    return upgraded(client);
  }
  webSocketMessage(ws, data) {
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s < 0) return;
    // Caps: binary messages of exactly 12 bytes, at most MSG_RATE a second (with a burst).
    if (typeof data === "string" || data.byteLength !== MSG_BYTES) return this.kick(ws, 1009, "12-byte binary messages only");
    let b = this.buckets.get(ws);
    if (!b) this.buckets.set(ws, (b = new Bucket(this.cap.MSG_RATE, this.cap.MSG_BURST)));
    const now = Date.now(), started = this.relay.started;
    if (!b.allow(now)) return this.kick(ws, 1008, "rate limit");
    // Only a relayed message keeps the room alive: a lone player's refused messages don't.
    if (this.relay.message(s, data)) {
      this.last = now;
      if (now - this.saved >= SAVE_MS) this.save(ws);
    } else if (!started && this.relay.started) this.save(); // START began the match
  }
  async webSocketClose(ws, code, reason) {
    // Answer the client's close, or it waits for one and ends with 1006 (~10 s on workerd).
    // 1005/1006 mean no code was sent and may not be sent back: answer those with 1000.
    const echo = code === 1000 || code === 1001 || (code >= 3000 && code < 5000);
    try {
      ws.close(echo ? code : 1000, echo ? reason : "");
    } catch {}
    // A drop holds the seat for its resume token; a clean close leaves.
    if (DROPS.has(code)) await this.drop(ws);
    else this.leave(ws);
  }
  async webSocketError(ws) {
    await this.drop(ws);
  }
  /** Not full after LOBBY_SECONDS, idle for IDLE_SECONDS, or older than MAX_ROOM_SECONDS: close everyone; else check again later. Holds that ran out leave. */
  async alarm() {
    const now = Date.now(), r = this.relay;
    if (!r || !r.live()) return;
    if (r.away.some((t) => t && t <= now)) r.expire(now), this.save();
    if (!r.live()) return;
    const { why } = roomClock(this.cap, { born: r.born ?? now, last: this.last, started: r.started }, now);
    if (why) {
      for (const ws of this.ctx.getWebSockets()) this.kick(ws, 1001, why);
      return;
    }
    await this.arm(now);
  }
  kick(ws, code, why) {
    this.leave(ws);
    try {
      ws.close(code, why);
    } catch {}
  }
  /** A seat that dropped: held for RESUME_SECONDS (with none, a leave). */
  async drop(ws) {
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s < 0 || !this.cap.RESUME_SECONDS || !this.relay.started) return this.leave(ws);
    this.buckets.delete(ws);
    ws.serializeAttachment(null); // never re-seated from its attachment after a wake (P6-06)
    const now = Date.now();
    this.relay.drop(s, now + this.cap.RESUME_SECONDS * 1000);
    this.save();
    await this.arm(now);
  }
  leave(ws) {
    this.buckets.delete(ws);
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s < 0) return;
    try {
      ws.serializeAttachment(null); // never re-seated from its attachment after a wake (P6-06)
    } catch {}
    this.relay.leave(s);
    this.save();
  }
}
