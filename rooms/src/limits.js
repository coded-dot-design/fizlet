// Spend caps and the invite gate, free of platform APIs so the Worker and the Node tests share them.
// Every cap has a default and a hard ceiling: a wrong or missing [vars] value can lower a cap but
// never lift it past the ceiling.

/** Defaults and ceilings for every cap, as [default, min, max]. */
export const CAPS = {
  MAX_ROOMS: [16, 1, 256], // rooms are numbered 0..MAX_ROOMS-1: at most this many Durable Objects
  MAX_PLAYERS: [2, 1, 8], // seats per room
  MSG_RATE: [90, 10, 240], // messages per second per socket (lockstep at 60 Hz sends ~62)
  MSG_BURST: [180, 10, 480], // short bursts allowed above the rate (a tab coming back)
  IDLE_SECONDS: [120, 2, 3600], // a room with no relayed message for this long is closed
  MAX_ROOM_SECONDS: [1800, 10, 14400], // and every room closes after this, busy or not
  LOBBY_SECONDS: [90, 2, 600], // a room that isn't full this long after its first seat is closed
  GATE_RATE: [30, 5, 300], // invite checks + joins per IP per minute, counted in each Worker isolate
  JOIN_RATE: [10, 2, 120], // joins per IP per minute into one room, counted by the room itself
};
export const MSG_BYTES = 12; // the only message size a room accepts (@fzlt/core/presence wire format)

/** The caps from the Worker's env ([vars]), clamped to their ceilings. */
export function limits(env = {}) {
  const out = {};
  for (const [k, [def, min, max]] of Object.entries(CAPS)) {
    const v = Number(env[k]);
    out[k] = Number.isFinite(v) && env[k] !== "" && env[k] != null ? Math.min(max, Math.max(min, Math.floor(v))) : def;
  }
  out.ORIGINS = String(env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return out;
}

/** A token bucket: `rate` per second, up to `burst` saved. allow(now ms) spends one token. */
export class Bucket {
  constructor(rate, burst) {
    this.rate = rate;
    this.burst = burst;
    this.tokens = burst;
    this.last = -1;
  }
  allow(now) {
    if (this.last >= 0) this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/**
 * Requests per key (an IP) in fixed one-minute windows: hit(key, now ms) is false past `limit`.
 * Memory is bounded: past `keys` distinct keys the table starts over (a flood of addresses
 * resets the counts rather than growing the isolate).
 */
export class Window {
  constructor(limit, ms = 60000, keys = 4096) {
    this.limit = limit;
    this.ms = ms;
    this.keys = keys;
    this.map = new Map(); // key → [window start ms, count]
  }
  hit(key, now) {
    let w = this.map.get(key);
    if (!w || now - w[0] >= this.ms) {
      if (!w && this.map.size >= this.keys) this.map.clear();
      this.map.set(key, (w = [now, 0]));
    }
    return ++w[1] <= this.limit;
  }
}

/**
 * When a room closes: { why, at }. `why` is set when it's due now ("room not filled", "room idle",
 * "room time is up"), else `at` is the ms to check again. `last` is the last relayed message (or
 * seat taken); a room that hasn't started must fill within LOBBY_SECONDS of its first seat.
 */
export function roomClock(cap, { born, last, started }, now) {
  const lobby = started ? Infinity : born + cap.LOBBY_SECONDS * 1000, idle = last + cap.IDLE_SECONDS * 1000, old = born + cap.MAX_ROOM_SECONDS * 1000;
  const why = now >= lobby ? "room not filled" : now >= idle ? "room idle" : now >= old ? "room time is up" : "";
  return { why, at: Math.min(lobby, idle, old) };
}

/**
 * The invite code a request carries: a WebSocket subprotocol `invite.<code>` (the client offers
 * `["fizlet-rooms", "invite." + code]`), else the body of a POST /invite (the caller reads it),
 * else, for one release, the URL (`?code=` / `?invite=`: URLs are logged, so clients move off it).
 */
export function inviteFrom(req, url) {
  for (const p of (req.headers.get("sec-websocket-protocol") ?? "").split(",")) {
    const t = p.trim();
    if (t.startsWith("invite.")) return { code: t.slice(7), via: "protocol" };
  }
  const q = url.searchParams.get("invite") ?? url.searchParams.get("code");
  return q == null ? { code: null, via: "" } : { code: q, via: "url" };
}

/** The room number in /room/<n>, or -1 when it's not a room this deployment runs. */
export function roomNumber(path, max) {
  const m = /^\/room\/(\d{1,3})$/.exec(path);
  const n = m ? Number(m[1]) : -1;
  return n >= 0 && n < max ? n : -1;
}

/** Invite codes are 10 to 64 characters (the invite helper makes 15: BLITZ-XXXX-XXXX). */
export const CODE_MIN = 10, CODE_MAX = 64;

/** The KV key for an invite code: its SHA-256 (the code itself is never stored). */
export async function inviteKey(code) {
  const norm = String(code ?? "").trim().toUpperCase();
  if (norm.length < CODE_MIN || norm.length > CODE_MAX) return null;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return "invite:" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Is `origin` allowed? An empty list allows any (local dev only: set ALLOWED_ORIGINS to deploy). */
export const originOk = (origin, list) => !list.length || list.includes(origin ?? "");
