// Play passes (src/pass.js) on fakes: the format, the checks, the device lock, revoking, and that
// REQUIRE_PASS off changes nothing. The pass is minted here with node:crypto, the way the Blitz
// workflow and the owner's mint CLI make it, so the Worker's WebCrypto check is pinned to that format.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { registerHooks } from "node:module";
import { inviteKey } from "../src/limits.js";

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
  }
  json() {
    return JSON.parse(this.body);
  }
};
const { PassBook, signPass, verifyPass, requirePass } = await import("../src/pass.js");
const { default: worker } = await import("../src/worker.js");

const SECRET = "test-only-pass-secret-0123456789", ADMIN = "test-only-admin-key-0123456789", CODE = "TEST-ROOM-CODE1";
const T0 = 1_800_000_000; // Unix seconds
/** The mint, as the Blitz script does it (node:crypto, not the Worker's code). */
const mint = (payload, secret = SECRET) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
};
const play = (o = {}) => ({ v: 1, id: "AbCdEfGhIjKlMnOp", gh: "octocat", issue: 7, exp: T0 + 3600, ...o });
const family = (o = {}) => ({ v: 1, id: "FaMiLyPaSs000001", kind: "family", name: "Mom", dev: 3, exp: T0 + 30 * 86400, ...o });
const DEV = ["device-aaaaaaaaaaaaaaaa", "device-bbbbbbbbbbbbbbbb", "device-cccccccccccccccc", "device-dddddddddddddddd"];

/** Durable Object storage on a Map (get, put, delete, list, alarms). */
function storage() {
  const m = new Map();
  return { m, alarm: null, get: async (k) => m.get(k), put: async (k, v) => void m.set(k, structuredClone(v)), delete: async (k) => m.delete(k), list: async () => new Map(m), getAlarm: async function () { return this.alarm; }, setAlarm: async function (t) { this.alarm = t; } };
}
async function envWith(over = {}) {
  const keys = new Set([await inviteKey(CODE)]);
  const store = storage(), passes = new PassBook(store);
  return {
    store,
    MAX_PLAYERS: "2", GATE_RATE: "300",
    INVITES: { get: async (k) => (keys.has(k) ? "label" : null) },
    ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(null, { status: 101 }) }) },
    PASSES: { idFromName: (n) => n, get: () => passes },
    REQUIRE_PASS: "true", PASS_SECRET: SECRET, ROOMS_ADMIN_KEY: ADMIN,
    ...over,
  };
}
let ip = 0;
const call = (env, path, init = {}) => worker.fetch(new Request("https://rooms.example" + path, { ...init, headers: { "cf-connecting-ip": `10.1.${(ip >> 8) & 255}.${++ip & 255}`, ...init.headers } }), env);
const joinWith = (env, protocols) => call(env, "/room/1?players=2", { headers: { upgrade: "websocket", "sec-websocket-protocol": protocols } });
const joinPass = (env, pass, device) => joinWith(env, `fizlet-rooms, pass.${pass}, device.${device}`);
const revoke = (env, pass, key = ADMIN) => call(env, "/pass/revoke", { method: "POST", body: pass, headers: key ? { authorization: "Bearer " + key } : {} });

test("pass: a pass minted with node:crypto verifies in WebCrypto, and the Worker's own mint is byte-identical", async () => {
  const p = mint(play());
  assert.equal(await signPass(play(), SECRET), p);
  const v = await verifyPass(p, SECRET, T0);
  assert.ok(v.ok);
  assert.deepEqual(v.pass, { id: "AbCdEfGhIjKlMnOp", exp: T0 + 3600, dev: 1, kind: "play", gh: "octocat", issue: 7, name: undefined });
});

test("pass: tampered, expired, wrong-secret, too-long-lived and malformed passes are refused", async () => {
  const p = mint(play()), [body, sig] = p.split(".");
  const forged = Buffer.from(JSON.stringify(play({ gh: "mallory" }))).toString("base64url") + "." + sig;
  assert.equal((await verifyPass(forged, SECRET, T0)).why, "bad signature", "payload changed, signature kept");
  assert.equal((await verifyPass(body + "." + (sig[0] === "A" ? "B" : "A") + sig.slice(1), SECRET, T0)).why, "bad signature");
  assert.equal((await verifyPass(p, "another-secret-entirely-000000", T0)).why, "bad signature", "wrong secret");
  assert.equal((await verifyPass(p, SECRET, T0 + 3600)).why, "expired", "at exp");
  assert.equal((await verifyPass(mint(play({ exp: T0 + 31 * 86400 })), SECRET, T0)).why, "too long", "over 30 days");
  assert.equal((await verifyPass(mint(play({ dev: 4 })), SECRET, T0)).why, "malformed", "more than 3 devices");
  assert.equal((await verifyPass(mint(play({ v: 2 })), SECRET, T0)).why, "malformed");
  assert.equal((await verifyPass(mint(play({ id: "x" })), SECRET, T0)).why, "malformed");
  assert.equal((await verifyPass("not a pass", SECRET, T0)).why, "malformed");
  assert.equal((await verifyPass(body, SECRET, T0)).why, "malformed");
  assert.equal((await verifyPass("a".repeat(700) + ".b", SECRET, T0)).why, "malformed");
  assert.equal((await verifyPass(p, "", T0)).why, "malformed", "no secret, no pass");
  // A family pass may last 30 days.
  const f = await verifyPass(mint(family()), SECRET, T0);
  assert.ok(f.ok);
  assert.equal(f.pass.kind, "family");
  assert.equal(f.pass.dev, 3);
  assert.ok((await verifyPass(mint(family()), SECRET, T0 + 30 * 86400 - 1)).ok, "still good on day 30");
  assert.equal((await verifyPass(mint(family()), SECRET, T0 + 30 * 86400)).why, "expired");
});

test("join: the pass locks to the first device; the same device rejoins, a second device is refused", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith(), p = mint(play());
  assert.equal((await joinPass(env, p, DEV[0])).status, 101);
  const other = await joinPass(env, p, DEV[1]);
  assert.equal(other.status, 403);
  assert.deepEqual(other.json(), { error: "pass in use on another device" });
  assert.equal((await joinPass(env, p, DEV[0])).status, 101, "the same device, again (a rematch, a reload)");
  assert.equal((await joinWith(env, `fizlet-rooms, pass.${p}`)).status, 403, "no device key, no seat");
  assert.equal((await joinWith(env, `fizlet-rooms, invite.${CODE}`)).status, 403, "passes on: an invite alone isn't enough");
  // After exp: a match already running plays on (passes are checked at join), the next join is refused.
  t.mock.timers.tick(3600 * 1000);
  const late = await joinPass(env, p, DEV[0]);
  assert.equal(late.status, 403);
  assert.deepEqual(late.json(), { error: "pass expired" });
});

test("join: a family pass holds up to 3 devices; the 4th is refused", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith(), p = mint(family());
  for (const d of DEV.slice(0, 3)) assert.equal((await joinPass(env, p, d)).status, 101, d);
  assert.equal((await joinPass(env, p, DEV[3])).status, 403);
  t.mock.timers.tick(29 * 86400 * 1000);
  assert.equal((await joinPass(env, p, DEV[1])).status, 101, "day 30: a held device still joins");
  assert.equal((await joinPass(env, p, DEV[3])).status, 403);
});

test("revoke: the admin key revokes a pass (play or family) until it expires; without the key, nothing", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith(), p = mint(play()), f = mint(family());
  assert.equal((await joinPass(env, p, DEV[0])).status, 101);
  assert.equal((await joinPass(env, f, DEV[0])).status, 101);
  assert.equal((await revoke(env, p, null)).status, 401);
  assert.equal((await revoke(env, p, "wrong-admin-key")).status, 401);
  assert.equal((await revoke(env, mint(play(), "another-secret-entirely-000000"))).status, 400, "only passes this server signed");
  assert.equal((await joinPass(env, p, DEV[0])).status, 101, "a refused revoke changed nothing");
  for (const x of [p, f]) {
    const r = await revoke(env, x);
    assert.equal(r.status, 200);
  }
  for (const x of [p, f]) {
    const j = await joinPass(env, x, DEV[0]);
    assert.equal(j.status, 403);
    assert.deepEqual(j.json(), { error: "pass revoked" });
  }
  assert.equal((await joinPass(env, f, DEV[2])).status, 403, "a free family seat is no way back in");
  assert.equal((await revoke(await envWith({ ROOMS_ADMIN_KEY: undefined }), p)).status, 404, "no admin key set: no revoke endpoint");
});

test("store: entries go when their pass expires (one alarm, the earliest)", async (t) => {
  const s = storage();
  let now = T0;
  const b = new PassBook(s, () => now);
  assert.equal(await b.claim("AbCdEfGhIjKlMnOp", DEV[0], 1, T0 + 3600), "ok");
  assert.equal(await b.claim("FaMiLyPaSs000001", DEV[0], 3, T0 + 30 * 86400), "ok");
  await b.revoke("RevokedPass00001", T0 + 7200);
  assert.equal(s.alarm, (T0 + 3600 + 60) * 1000);
  now = T0 + 3661;
  await b.sweep();
  assert.deepEqual([...s.m.keys()].sort(), ["p:FaMiLyPaSs000001", "r:RevokedPass00001"]);
  assert.equal(s.alarm, (T0 + 7200 + 60) * 1000);
  now = T0 + 30 * 86400 + 61;
  await b.sweep();
  assert.equal(s.m.size, 0);
});

test("invite: passes on, POST /invite says pass:true and checks a pass without taking a seat", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith(), p = mint(play());
  const ask = await call(env, "/invite", { method: "POST", body: "" });
  assert.equal(ask.status, 403);
  assert.deepEqual(ask.json(), { ok: false, pass: true, why: "pass needed" });
  const ok = await call(env, "/invite", { method: "POST", body: `${p}\n${DEV[1]}` });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json(), { ok: true, players: 2, pass: true });
  assert.equal(env.store.m.size, 0, "the check took no seat");
  assert.equal((await joinPass(env, p, DEV[0])).status, 101);
  const taken = await call(env, "/invite", { method: "POST", body: `${p}\n${DEV[1]}` });
  assert.deepEqual(taken.json(), { ok: false, pass: true, why: "pass in use on another device" });
  const bad = await call(env, "/invite", { method: "POST", body: `${p.slice(0, -2)}xx\n${DEV[0]}` });
  assert.deepEqual(bad.json(), { ok: false, pass: true, why: "pass not valid" });
});

test("switch: REQUIRE_PASS on without PASS_SECRET refuses every join (503), never lets one through", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith({ PASS_SECRET: undefined });
  const r = await joinPass(env, mint(play()), DEV[0]);
  assert.equal(r.status, 503);
  assert.equal((await joinWith(env, `fizlet-rooms, invite.${CODE}`)).status, 503);
});

test("switch: REQUIRE_PASS off (unset, false, anything else) changes nothing: the invite is the gate, passes are ignored", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  for (const v of [undefined, "false", "", "0", "no"]) assert.equal(requirePass({ REQUIRE_PASS: v }), false, String(v));
  for (const v of ["true", "TRUE", "1"]) assert.equal(requirePass({ REQUIRE_PASS: v }), true, v);
  for (const over of [{ REQUIRE_PASS: undefined }, { REQUIRE_PASS: "false" }, { REQUIRE_PASS: "false", PASS_SECRET: undefined, ROOMS_ADMIN_KEY: undefined, PASSES: undefined }]) {
    const env = await envWith(over), p = mint(play());
    const yes = await call(env, "/invite", { method: "POST", body: CODE });
    assert.deepEqual([yes.status, yes.json()], [200, { ok: true, players: 2 }], "no pass field");
    const no = await call(env, "/invite", { method: "POST", body: "" });
    assert.deepEqual([no.status, no.json()], [403, { ok: false }]);
    assert.equal((await call(env, "/invite", { method: "POST", body: "x".repeat(300), headers: { "content-length": "300" } })).status, 403);
    assert.equal((await joinWith(env, `fizlet-rooms, invite.${CODE}`)).status, 101);
    assert.equal((await joinWith(env, `fizlet-rooms, invite.${CODE}, pass.junk, device.${DEV[0]}`)).status, 101, "a pass offered is ignored");
    const only = await joinPass(env, p, DEV[0]);
    assert.deepEqual([only.status, only.json()], [403, { error: "invite code needed" }], "a pass alone is no way in");
    assert.equal(env.store.m.size, 0, "the pass store is never touched");
  }
});

const owner = (o = {}) => ({ v: 1, id: "OwnerPass0000001", kind: "owner", name: "Chris", dev: 5, exp: T0 + 365 * 86400, ...o });
const DEV6 = Array.from({ length: 6 }, (_, i) => `device-owner-${String(i).repeat(8)}`);

test("pass: an owner pass holds up to 5 devices for a year; other kinds stay at 3 devices and 30 days", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const o = await verifyPass(mint(owner()), SECRET, T0);
  assert.ok(o.ok);
  assert.deepEqual([o.pass.kind, o.pass.dev], ["owner", 5]);
  assert.equal((await verifyPass(mint(owner({ dev: 6 })), SECRET, T0)).why, "malformed", "owner: 5 devices at most");
  assert.equal((await verifyPass(mint(owner({ exp: T0 + 367 * 86400 })), SECRET, T0)).why, "too long", "owner: a year at most");
  assert.equal((await verifyPass(mint(family({ dev: 5 })), SECRET, T0)).why, "malformed", "family: 3 devices at most");
  assert.equal((await verifyPass(mint(family({ exp: T0 + 60 * 86400 })), SECRET, T0)).why, "too long", "family: 30 days at most");
  const env = await envWith(), p = mint(owner());
  for (const d of DEV6.slice(0, 5)) assert.equal((await joinPass(env, p, d)).status, 101, d);
  assert.equal((await joinPass(env, p, DEV6[5])).status, 403, "the 6th device");
  t.mock.timers.tick(364 * 86400 * 1000);
  assert.equal((await joinPass(env, p, DEV6[0])).status, 101, "day 365");
  assert.equal((await revoke(env, p)).status, 200);
  assert.equal((await joinPass(env, p, DEV6[0])).status, 403, "revocable like the others");
});

test("admin: revoke by id alone, and list what the store holds (ids, device counts, expiries; never device keys)", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 * 1000 });
  const env = await envWith(), p = mint(play()), f = mint(family());
  assert.equal((await joinPass(env, p, DEV[0])).status, 101);
  assert.equal((await joinPass(env, f, DEV[0])).status, 101);
  assert.equal((await joinPass(env, f, DEV[1])).status, 101);
  const list = (key = ADMIN) => call(env, "/pass/list", { method: "POST", headers: key ? { authorization: "Bearer " + key } : {} });
  assert.equal((await list(null)).status, 401);
  const before = await list();
  assert.equal(before.status, 200);
  assert.deepEqual(before.json(), { passes: [{ id: "AbCdEfGhIjKlMnOp", devices: 1, exp: T0 + 3600 }, { id: "FaMiLyPaSs000001", devices: 2, exp: T0 + 30 * 86400 }], revoked: [] });
  assert.ok(!before.body.includes("device-"), "no device keys leave the store");
  assert.equal((await revoke(env, "FaMiLyPaSs000001")).status, 200, "the id alone");
  assert.equal((await revoke(env, "x")).status, 400);
  assert.equal((await joinPass(env, f, DEV[0])).status, 403);
  const after = (await list()).json();
  assert.deepEqual(after.passes.map((x) => x.id), ["AbCdEfGhIjKlMnOp"]);
  assert.equal(after.revoked[0].id, "FaMiLyPaSs000001");
  assert.ok(after.revoked[0].exp >= T0 + 365 * 86400, "an id revoked alone stays revoked as long as any pass may live");
});
