// Play passes: an optional gate in front of the rooms, switched on by REQUIRE_PASS (off by default:
// then nothing here runs and the invite code is the gate, as before).
//
// A pass is `base64url(payload).base64url(HMAC-SHA256(payload, PASS_SECRET))`, minted outside the
// Worker (the Blitz repo's play-pass workflow for a 1-hour pass; the owner's mint CLI for a family
// pass) and checked here with WebCrypto. Payload:
//   { v: 1, id, gh?, issue?, exp, kind?: "family" | "owner", name?, dev? }
// `exp` is Unix seconds; `dev` is how many devices may use it (default 1). Ceilings per kind
// (PASS_LIMITS): a play or family pass lives at most 30 days on at most 3 devices, an owner pass
// (minted only by the owner's CLI) a year on at most 5. The first joins lock the pass to their device keys (the client's
// `device.<key>` subprotocol), kept in one Durable Object (`Passes`) until the pass expires, so a pass
// copied from a public comment is no use on another device. A revoked pass id is refused until its
// `exp`. The pass is checked when a socket joins: a match already running when it expires plays on,
// the next join (a rematch too) is refused.
//
//   WebSocket join, subprotocols ["fizlet-rooms", "pass.<pass>", "device.<key>"]   (when REQUIRE_PASS)
//   POST /invite  body: "<pass>\n<device key>"  → 200 {ok, players, pass:true} | 403 {ok:false, pass:true, why}
//   POST /pass/revoke  authorization: Bearer <ROOMS_ADMIN_KEY>, body: the pass or its id  → 200 | 401 | 400
//   POST /pass/list    authorization: Bearer <ROOMS_ADMIN_KEY>  → {passes:[{id, devices, exp}], revoked:[{id, exp}]}
import { DurableObject } from "cloudflare:workers";

export const PASS_MAX_CHARS = 600;
/** [days, devices] at most, per kind. */
export const PASS_LIMITS = { play: [30, 3], family: [30, 3], owner: [366, 5] };
const DAY = 86400, SKEW = 60;
const ID = /^[A-Za-z0-9_-]{8,32}$/, DEVICE = /^[A-Za-z0-9_-]{16,64}$/, TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** Is the pass gate on? `REQUIRE_PASS` = "true" or "1"; anything else (or unset) is off. */
export const requirePass = (env) => ["true", "1"].includes(String(env?.REQUIRE_PASS ?? "").trim().toLowerCase());

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function unb64u(s) {
  try {
    return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
const keys = new Map(); // secret → CryptoKey (one or two secrets per isolate)
async function hmacKey(secret) {
  let k = keys.get(secret);
  if (!k) {
    if (keys.size > 4) keys.clear();
    keys.set(secret, (k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])));
  }
  return k;
}

/** Mint a pass (the Worker never mints; tests and tools do, and it pins the format). */
export async function signPass(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return body + "." + b64u(sig);
}

/**
 * Check a pass: { ok: true, pass: {id, exp, dev, kind, gh, issue, name} } or { ok: false, why }.
 * `why`: "malformed", "bad signature", "expired", "too long". `now` is Unix seconds.
 * `expired: true` skips the expiry checks (revoking an old pass is harmless).
 */
export async function verifyPass(token, secret, now, { expired = false } = {}) {
  if (!secret || typeof token !== "string" || token.length > PASS_MAX_CHARS || !TOKEN.test(token)) return { ok: false, why: "malformed" };
  const [body, sigText] = token.split(".");
  const sig = unb64u(sigText);
  if (!sig || sig.length !== 32) return { ok: false, why: "malformed" };
  // crypto.subtle.verify compares in constant time.
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(body)))) return { ok: false, why: "bad signature" };
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(unb64u(body) ?? new Uint8Array()));
  } catch {
    return { ok: false, why: "malformed" };
  }
  if (!p || p.v !== 1 || typeof p.id !== "string" || !ID.test(p.id) || !Number.isInteger(p.exp)) return { ok: false, why: "malformed" };
  const kind = p.kind ?? "play", dev = p.dev ?? 1, [days, devices] = PASS_LIMITS[kind] ?? [];
  if (!days || !Number.isInteger(dev) || dev < 1 || dev > devices) return { ok: false, why: "malformed" };
  if (!expired && p.exp <= now) return { ok: false, why: "expired" };
  if (!expired && p.exp > now + days * DAY + SKEW) return { ok: false, why: "too long" };
  return { ok: true, pass: { id: p.id, exp: p.exp, dev, kind, gh: p.gh, issue: p.issue, name: p.name } };
}

/** A device key (16 to 64 base64url characters, made by the page), or null. */
export const deviceKey = (d) => (typeof d === "string" && DEVICE.test(d) ? d : null);

/** The pass and device key a join offers as subprotocols `pass.<pass>` and `device.<key>`. */
export function passFrom(req) {
  let pass = null, device = null;
  for (const p of (req.headers.get("sec-websocket-protocol") ?? "").split(",")) {
    const t = p.trim();
    if (t.startsWith("pass.")) pass = t.slice(5);
    else if (t.startsWith("device.")) device = t.slice(7);
  }
  return { pass, device: deviceKey(device) };
}

const book = (env) => env.PASSES.get(env.PASSES.idFromName("passes"));
const SAY = { revoked: "pass revoked", locked: "pass in use on another device", expired: "pass expired", "bad signature": "pass not valid", malformed: "pass not valid", "too long": "pass not valid" };

/**
 * The join hook: null when REQUIRE_PASS is off (the caller checks the invite as before). Else
 * { ok: true } once the pass is verified and this device holds one of its seats, or
 * { ok: false, status, why }. `claim: false` only checks (the page's POST /invite), taking no seat.
 */
export async function passGate(env, pass, device, { claim = true, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!requirePass(env)) return null;
  if (!env.PASS_SECRET || !env.PASSES) return { ok: false, status: 503, why: "passes aren't switched on" };
  const v = await verifyPass(pass, env.PASS_SECRET, now);
  if (!v.ok) return { ok: false, status: 403, why: SAY[v.why] };
  if (!device) return { ok: false, status: 403, why: "device key needed" };
  const r = await book(env)[claim ? "claim" : "check"](v.pass.id, device, v.pass.dev, v.pass.exp);
  return r === "ok" ? { ok: true, pass: v.pass } : { ok: false, status: 403, why: SAY[r] };
}

/**
 * The admin endpoints (only when ROOMS_ADMIN_KEY is set): POST /pass/revoke with the pass (its
 * signature is checked, its expiry isn't) or just its id (then kept revoked for the longest a pass
 * may live), and POST /pass/list. Returns { status, body }, or null for any other path.
 */
export async function adminRequest(req, env, path, now = Math.floor(Date.now() / 1000)) {
  if (path !== "/pass/revoke" && path !== "/pass/list") return null;
  if (!env.ROOMS_ADMIN_KEY || !env.PASS_SECRET || !env.PASSES) return { status: 404, body: { error: "not found" } };
  if (req.method !== "POST") return { status: 405, body: { error: "POST only" } };
  const auth = req.headers.get("authorization") ?? "";
  if (!(await same(auth, "Bearer " + env.ROOMS_ADMIN_KEY))) return { status: 401, body: { error: "admin key needed" } };
  if (path === "/pass/list") return { status: 200, body: await book(env).list() };
  if (Number(req.headers.get("content-length") ?? 0) > PASS_MAX_CHARS) return { status: 400, body: { error: "pass not valid" } };
  const text = (await req.text()).trim();
  if (ID.test(text)) {
    await book(env).revoke(text, now + Math.max(...Object.values(PASS_LIMITS).map(([d]) => d)) * DAY + SKEW);
    return { status: 200, body: { ok: true, id: text } };
  }
  const v = await verifyPass(text, env.PASS_SECRET, now, { expired: true });
  if (!v.ok) return { status: 400, body: { error: "pass not valid" } };
  if (v.pass.exp > now) await book(env).revoke(v.pass.id, v.pass.exp);
  return { status: 200, body: { ok: true, id: v.pass.id } };
}

/** Constant-time string compare: both sides hashed first, so the lengths don't leak either. */
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))));
  let d = 0;
  for (let i = 0; i < 32; i++) d |= x[i] ^ y[i];
  return d === 0;
}

/**
 * The device locks and the revoked list, in one Durable Object (`passes`). Storage keys:
 * `p:<id>` → { d: [device keys], exp } and `r:<id>` → exp. An alarm deletes entries past `exp`, so
 * the store holds only passes that could still be used. A Durable Object runs one request at a time
 * across storage calls (input gates), so two devices racing for the last seat can't both win.
 */
export class PassBook {
  constructor(storage, now = () => Math.floor(Date.now() / 1000)) {
    this.storage = storage;
    this.now = now;
  }
  async status(id, device, dev) {
    if ((await this.storage.get("r:" + id)) != null) return { r: "revoked" };
    const e = await this.storage.get("p:" + id);
    if (e?.d.includes(device)) return { r: "ok", e };
    if ((e?.d.length ?? 0) >= dev) return { r: "locked" };
    return { r: "ok", e, add: true };
  }
  async check(id, device, dev, exp) {
    if (exp <= this.now()) return "expired";
    return (await this.status(id, device, dev)).r;
  }
  async claim(id, device, dev, exp) {
    if (exp <= this.now()) return "expired";
    const s = await this.status(id, device, dev);
    if (s.add) {
      await this.storage.put("p:" + id, { d: [...(s.e?.d ?? []), device], exp });
      await this.sweepAt(exp);
    }
    return s.r;
  }
  async revoke(id, exp) {
    await this.storage.put("r:" + id, exp);
    await this.storage.delete("p:" + id);
    await this.sweepAt(exp);
  }
  /** Pass ids with their device counts and expiries, and the revoked ids (never the device keys). */
  async list() {
    const passes = [], revoked = [];
    for (const [k, v] of await this.storage.list()) {
      if (k.startsWith("p:")) passes.push({ id: k.slice(2), devices: v.d.length, exp: v.exp });
      else if (k.startsWith("r:")) revoked.push({ id: k.slice(2), exp: v });
    }
    return { passes, revoked };
  }
  async sweepAt(exp) {
    const at = (exp + SKEW) * 1000, now = await this.storage.getAlarm();
    if (now == null || now > at) await this.storage.setAlarm(at);
  }
  /** Drop every entry past its expiry; wake again for the next one. */
  async sweep() {
    const t = this.now();
    let next = Infinity;
    for (const [k, v] of await this.storage.list()) {
      const exp = typeof v === "number" ? v : v?.exp;
      if (!(exp > t)) await this.storage.delete(k);
      else next = Math.min(next, exp);
    }
    if (next < Infinity) await this.storage.setAlarm((next + SKEW) * 1000);
  }
}

export class Passes extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.book = new PassBook(ctx.storage);
  }
  claim(id, device, dev, exp) {
    return this.book.claim(id, device, dev, exp);
  }
  check(id, device, dev, exp) {
    return this.book.check(id, device, dev, exp);
  }
  revoke(id, exp) {
    return this.book.revoke(id, exp);
  }
  list() {
    return this.book.list();
  }
  alarm() {
    return this.book.sweep();
  }
}
