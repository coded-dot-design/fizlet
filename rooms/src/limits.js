// Spend caps and the invite gate, free of platform APIs so the Worker and the Node tests share them.
// Every cap has a default and a hard ceiling: a wrong or missing [vars] value can lower a cap but
// never lift it past the ceiling.

/** Defaults and ceilings for every cap, as [default, min, max]. */
export const CAPS = {
  MAX_ROOMS: [16, 1, 256], // rooms are numbered 0..MAX_ROOMS-1: at most this many Durable Objects
  MAX_PLAYERS: [2, 1, 8], // seats per room
  MSG_RATE: [90, 10, 240], // messages per second per socket (lockstep at 60 Hz sends ~62)
  MSG_BURST: [180, 10, 480], // short bursts allowed above the rate (a tab coming back)
  IDLE_SECONDS: [120, 2, 3600], // a room with no message for this long is closed
  MAX_ROOM_SECONDS: [1800, 10, 14400], // and every room closes after this, busy or not
};
export const MSG_BYTES = 12; // the only message size a room accepts (fizlet/presence wire format)

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

/** The room number in /room/<n>, or -1 when it's not a room this deployment runs. */
export function roomNumber(path, max) {
  const m = /^\/room\/(\d{1,3})$/.exec(path);
  const n = m ? Number(m[1]) : -1;
  return n >= 0 && n < max ? n : -1;
}

/** The KV key for an invite code: its SHA-256 (the code itself is never stored). */
export async function inviteKey(code) {
  const norm = String(code ?? "").trim().toUpperCase();
  if (norm.length < 6 || norm.length > 64) return null;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return "invite:" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Is `origin` allowed? An empty list allows any (local dev only: set ALLOWED_ORIGINS to deploy). */
export const originOk = (origin, list) => !list.length || list.includes(origin ?? "");
