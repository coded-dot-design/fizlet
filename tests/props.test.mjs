// @fzlt/core/props in Node (a fake canvas): every prop adds a valid object tree (a group root, parts
// resting on it, the counts below), every vertex lies inside the footprint its root declares (at
// several seeds, scales and turns), a palette override reaches the parts and the defaults stay
// otherwise, the seed picks deterministic variants from eight steps (the same seed, the same parts,
// bit for bit), options reach the root (on, pos, rot, cluster, shadow, tag, pick), picking a part
// climbs to its root, and re-adding the kit into a cleared scene allocates nothing beyond what the
// diorama's own `add` does (and keeps nothing). Real pixels and real clicks in Chromium: tests/props.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const P = await import("../src/props.ts");
const { PROPS } = P;

class NullCtx {
  setTransform() {} fillRect() {} clearRect() {} beginPath() {} moveTo() {} lineTo() {} arc() {} closePath() {} fill() {} stroke() {}
}
const ctx = new NullCtx();
const fake = () => ({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx });
const scene = () => {
  const d = diorama(fake());
  d.cluster("floor", { fixed: 0 });
  d.add({ id: "floor", size: [60, 0.5, 60], pos: [0, -0.5, 0], color: "#d9d3ca", cluster: "floor", layer: 0 });
  return d;
};
/** The parts added since index i0 (the root first). */
const added = (d, i0) => {
  const out = [];
  d.recolor((ob) => out.push(ob));
  return out.slice(i0);
};
const count = (d) => { let n = 0; d.recolor(() => n++); return n; };

// Each prop's parts at seed 0 and the range over seeds (crates stack 1–3, a cactus flowers on odd seeds).
const PARTS = { pineTree: 4, roundTree: 3, bush: 3, rocks: 3, cactus: 5, house: 7, shop: 8, lamppost: 4, bench: 4, fence: 7, trafficCone: 4, crates: [2, 4], lighthouse: 10, dock: 10, buoy: 4, car: 11, truck: 12 };
const RANGE = { cactus: [5, 6], crates: [2, 4], dock: [9, 10], shop: [8, 10] };

/** The local vertices of a part, exactly as diorama builds them (box, wedge, cyl; groups have none). */
function verts(ob) {
  const [w, h, dd] = ob.size, x = w / 2, z = dd / 2, V = [];
  if (ob.shape === "group") return V;
  if (ob.shape === "cyl") {
    // diorama keeps sides and top on its mesh: read them from the face count instead (n + 2 faces, or n + 1 for a cone)
    throw new Error("cyl handled by caller");
  }
  if (ob.shape === "wedge") V.push([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [-x, h, z]);
  else for (const yy of [0, h]) for (const xx of [-x, x]) for (const zz of [-z, z]) V.push([xx, yy, zz]);
  return V;
}
/** Every world vertex of a prop's parts in its root's frame (the root's rotation inverted). */
function localPoints(d, r, i0, defs) {
  const pts = [], R = r.M;
  added(d, i0).forEach((ob, k) => {
    if (ob === r) return;
    const def = defs[k];
    let V;
    if (ob.shape === "cyl") {
      const n = def.sides || 10, t = def.top ?? 1, [w, h, dd] = ob.size;
      V = [];
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2, px = Math.cos(a) * w / 2, pz = Math.sin(a) * dd / 2;
        V.push([px, 0, pz]);
        if (t >= 0.02) V.push([px * t, h, pz * t]);
      }
      if (t < 0.02) V.push([0, h, 0]);
    } else V = verts(ob);
    const m = ob.M;
    for (const [x, y, z] of V) {
      const wx = m[0] * x + m[1] * y + m[2] * z + m[9] - R[9], wy = m[3] * x + m[4] * y + m[5] * z + m[10] - R[10], wz = m[6] * x + m[7] * y + m[8] * z + m[11] - R[11];
      pts.push([R[0] * wx + R[3] * wy + R[6] * wz, R[1] * wx + R[4] * wy + R[7] * wz, R[2] * wx + R[5] * wy + R[8] * wz]);
    }
  });
  return pts;
}
/** Run a prop, recording each def `add` receives (copied: props reuse one scratch definition). */
function addRecorded(d, fn, o) {
  const defs = [], add = d.add;
  d.add = (def) => (defs.push({ ...def, size: [...def.size], pos: [...def.pos], rot: [...def.rot] }), add(def));
  const i0 = count(d), r = fn(d, o);
  d.add = add;
  return { r, i0, defs };
}

test("props: every prop adds a group root and its parts resting on it, the counts expected", () => {
  assert.deepEqual(Object.keys(PROPS).sort(), Object.keys(PARTS).sort(), "the kit is the 17 props");
  for (const [name, fn] of Object.entries(PROPS)) {
    for (let seed = 0; seed < 8; seed++) {
      const d = scene(), i0 = count(d), r = fn(d, { id: "p", on: "floor", seed });
      const parts = added(d, i0);
      assert.equal(parts[0], r, `${name}: the root comes first`);
      assert.equal(r.shape, "group", `${name}: a group root`);
      assert.equal(r.id, "p");
      assert.equal(r.parent, d.get("floor"), `${name}: the root stands on floor`);
      const n = parts.length - 1, want = RANGE[name] || [PARTS[name], PARTS[name]];
      if (seed === 0 && typeof PARTS[name] === "number") assert.equal(n, PARTS[name], `${name}: ${n} parts`);
      assert.ok(n >= want[0] && n <= want[1], `${name} seed ${seed}: ${n} parts in ${want}`);
      for (const p of parts.slice(1)) {
        assert.equal(p.parent, r, `${name}: every part rests on the root`);
        assert.ok(p.id === null, `${name}: parts are anonymous`);
        assert.match(p.color, /^#[0-9a-f]{6}$/, `${name}: a colour`);
        assert.ok(p.layer > r.layer, `${name}: parts layer above the root`);
        assert.ok(p.size.every((v) => v > 0 && Number.isFinite(v)), `${name}: a real size ${[...p.size]}`);
        assert.equal(p.shape === "group", false);
      }
      d.draw();
      assert.ok(d.stats.faces > 0 && d.stats.dropped === 0, `${name}: draws faces`);
    }
  }
  // Seeds change what they should: crates stack 1–3, odd cacti flower, odd docks have no bollard.
  const counts = (fn) => new Set(Array.from({ length: 16 }, (_, seed) => { const d = scene(), i0 = count(d); fn(d, { seed }); return count(d) - i0; }));
  assert.deepEqual([...counts(P.crates)].sort(), [3, 4, 5]);
  assert.deepEqual([...counts(P.cactus)].sort(), [6, 7]);
});

test("props: every vertex inside the declared footprint (seeds, scales, turns)", () => {
  for (const [name, fn] of Object.entries(PROPS)) {
    const reach = [0, 0, 0];
    for (const [seed, scale, rot] of [[0, 1, 0], [1, 1, 0.7], [2, 0.5, -2], [3, 2, 3], [4, 1, 1], [5, 1.5, 0], [6, 1, 0], [7, 0.75, 0.3], [123457, 1, 0]]) {
      const d = scene(), { r, i0, defs } = addRecorded(d, fn, { on: "floor", pos: [3, 0, -2], seed, scale, rot });
      d.draw();
      const [w, h, dd] = r.size, eps = 1e-9;
      for (const [x, y, z] of localPoints(d, r, i0, defs)) {
        assert.ok(Math.abs(x) <= w / 2 + eps && Math.abs(z) <= dd / 2 + eps, `${name} (seed ${seed}, ×${scale}): (${x.toFixed(3)}, ${z.toFixed(3)}) inside ${w} × ${dd}`);
        assert.ok(y >= -eps && y <= h + eps, `${name} (seed ${seed}, ×${scale}): y ${y.toFixed(3)} in 0..${h}`);
      }
      // How much of the footprint the parts reach, per axis (checked below over every seed).
      const pts = localPoints(d, r, i0, defs), span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
      for (const [k, v] of [[0, w], [1, h], [2, dd]]) reach[k] = Math.max(reach[k], span(k) / v);
      // Scale multiplies the footprint.
      const ref = scene(), r1 = fn(ref, { seed });
      assert.ok(r.size.every((v, k) => Math.abs(v - r1.size[k] * scale) < 1e-12), `${name}: the footprint scales`);
    }
    // The footprint is snug: over the seeds, the parts reach at least 85% of it on each axis.
    reach.forEach((v, k) => assert.ok(v >= 0.85, `${name}: axis ${k} reaches ${(v * 100).toFixed(0)}% of its footprint`));
  }
});

test("props: a palette override reaches its parts; defaults otherwise; a #hex key is itself", () => {
  const keyed = { pineTree: "leaf", roundTree: "leaf2", bush: "leaf", rocks: "rock", cactus: "cactus", house: "roof", shop: "awning", lamppost: "lamp", bench: "wood", fence: "fence", trafficCone: "cone", crates: "wood", lighthouse: "stripe", dock: "deck", buoy: "buoy", car: "paint", truck: "paint" };
  for (const [name, key] of Object.entries(keyed)) {
    const a = scene(), i0 = count(a);
    PROPS[name](a, { colors: { [key]: "#123456" } });
    const b = scene(), j0 = count(b);
    PROPS[name](b, {});
    const pa = added(a, i0).slice(1), pb = added(b, j0).slice(1);
    assert.ok(pa.some((p) => p.color === "#123456"), `${name}: ${key} applied`);
    assert.ok(!pb.some((p) => p.color === "#123456"), `${name}: not without the override`);
    pa.forEach((p, i) => assert.ok(p.color === "#123456" || p.color === pb[i].color, `${name}: only ${key} changed`));
  }
  // A theme object for every prop: unknown keys are ignored, undefined falls back.
  const d = scene(), i0 = count(d);
  P.house(d, { colors: { wall: undefined, roof: "#000001", nothing: "#ffffff" } });
  const cols = added(d, i0).slice(1).map((p) => p.color);
  assert.ok(cols.includes("#f6e7d8") && cols.includes("#000001") && !cols.includes("#ffffff"));
});

test("props: seeded variants are deterministic and step in eighths", () => {
  const snap = (fn, seed) => { const d = scene(), i0 = count(d); fn(d, { seed }); return added(d, i0).map((p) => [p.shape, p.color, ...p.size, ...p.pos, ...p.rot]); };
  for (const [name, fn] of Object.entries(PROPS)) {
    for (const seed of [0, 1, 2, 99, -5, 2 ** 31 - 1]) assert.deepEqual(snap(fn, seed), snap(fn, seed), `${name}: seed ${seed} twice, bit for bit`);
    assert.deepEqual(snap(fn, 3.7), snap(fn, 3), `${name}: a fractional seed is its integer`);
  }
  // A pine's height: different seeds differ, at most eight heights over many seeds.
  const tops = new Set();
  for (let seed = 0; seed < 400; seed++) {
    const d = scene(), i0 = count(d);
    P.pineTree(d, { seed });
    const top = added(d, i0)[4];
    tops.add(top.pos[1] + top.size[1]);
  }
  assert.ok(tops.size >= 6 && tops.size <= 8, `pine heights: ${tops.size} steps`);
  // The step is spread fairly: every step shows up, none more than twice its share.
  const hist = new Map();
  for (let seed = 0; seed < 4000; seed++) {
    const d = scene(), i0 = count(d);
    P.pineTree(d, { seed });
    const k = added(d, i0)[1].size[1].toFixed(6);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  assert.equal(hist.size, 8);
  for (const v of hist.values()) assert.ok(v > 250 && v < 1000, `a step's share: ${v} of 4000`);
  // Vehicles: the seed picks the paint when none is given.
  const paints = new Set(Array.from({ length: 32 }, (_, seed) => snap(P.car, seed)[1][1]));
  assert.equal(paints.size, 4);
});

test("props: options reach the root (on, pos, rot, cluster, shadow, layer, tag, pick); pick climbs to it", () => {
  const d = scene();
  const a = P.house(d, { id: "home", on: "floor", pos: [4, 0, -3], rot: 0.5, shadow: 0.4, tag: { lot: 7 }, layer: 2 });
  assert.deepEqual([...a.pos], [4, 0, -3]);
  assert.deepEqual([...a.rot], [0, 0.5, 0]);
  assert.equal(a.shadow, 0.4);
  assert.equal(a.layer, 2);
  assert.deepEqual(a.tag, { lot: 7 });
  const b = P.pineTree(d, { id: "pine1", on: "floor" });
  assert.equal(b.tag, "pine", "the default tag is the prop's name");
  assert.equal(b.shadow, 0.16, "a shadow by default when standing on something");
  const c = P.buoy(d, { id: "free" });
  assert.equal(c.shadow, 0, "no parent, no shadow");
  const e = P.bench(d, { id: "b2", on: "floor", cluster: null, pick: false });
  const auto = P.rocks(d, { on: "floor" }), auto2 = P.rocks(d, { on: "floor" });
  assert.match(auto.id, /^prop\d+$/);
  assert.notEqual(auto.id, auto2.id, "auto ids are unique");
  d.recolor((ob) => { if (ob.parent === e) assert.equal(ob.pick, false, "pick: false reaches every part"); });
  // Turning and moving the root carries the parts.
  side(d);
  d.draw();
  const roofBefore = partOf(d, a, "wedge").M[9];
  a.pos[0] += 1;
  d.draw();
  assert.ok(Math.abs(partOf(d, a, "wedge").M[9] - roofBefore - 1) < 1e-9, "parts follow the root");
  // A pick on any part of a prop gives the prop's root.
  d.clear();
  d.cluster("floor", { fixed: 0 });
  d.add({ id: "floor", size: [60, 0.5, 60], pos: [0, -0.5, 0], color: "#d9d3ca", cluster: "floor", layer: 0, pick: false });
  const home = P.house(d, { id: "home", on: "floor" });
  Object.assign(d.cam, { yaw: 0, pitch: 0.5, dist: 14, tx: 0, ty: 1, tz: 0, ox: 0, oy: 0, fov: 0.62 });
  d.draw();
  const out = new Float64Array(3);
  for (const [x, y, z] of [[0, 0.8, 1], [0.6, 1.9, 0], [-0.5, 0.4, 1.0]]) {
    d.project(x, y, z, out);
    const hit = d.pick(out[0], out[1]);
    assert.ok(hit && hit !== home, `a part under (${x}, ${y}, ${z})`);
    assert.equal(d.root(hit), home, "root() climbs to the prop");
  }
});
const side = (d) => Object.assign(d.cam, { yaw: 0, pitch: 0.4, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.8 });
const partOf = (d, r, shape) => { let f = null; d.recolor((ob) => { if (!f && ob.parent === r && ob.shape === shape) f = ob; }); return f; };

test("props: the wedges and wheels face the way the docs say (awning out front, wheels outside, roofs to the ridge)", () => {
  const d = scene();
  const s = P.shop(d, { id: "s" }), c = P.car(d, { id: "c", pos: [10, 0, 0] }), h = P.house(d, { id: "h", pos: [-10, 0, 0] });
  d.draw();
  const tall = (ob) => { const m = ob.M, [w, hh] = ob.size; return [m[0] * (-w / 2) + m[1] * hh + m[9], m[3] * (-w / 2) + m[4] * hh + m[10], m[6] * (-w / 2) + m[7] * hh + m[11]]; };
  const kids = (r) => { const a = []; d.recolor((ob) => ob.parent === r && a.push(ob)); return a; };
  for (const aw of kids(s).filter((p) => p.shape === "wedge")) assert.ok(Math.abs(tall(aw)[2] - 0.7) < 1e-9, `an awning's tall edge on the wall (z = 0.7): ${tall(aw)[2]}`);
  for (const rf of kids(h).filter((p) => p.shape === "wedge")) assert.ok(Math.abs(tall(rf)[0] + 10) < 1e-9, "a roof half's tall edge at the ridge");
  for (const wh of kids(c).filter((p) => p.shape === "cyl")) {
    const m = wh.M, ax = [m[1], m[4], m[7]], z0 = m[11], z1 = m[11] + m[7] * wh.size[1];
    assert.ok(Math.abs(Math.abs(ax[2]) - 1) < 1e-9, "a wheel's axis along z");
    assert.ok(Math.min(Math.abs(z0), Math.abs(z1)) >= 0.33, `a wheel outside the body: ${z0.toFixed(2)}..${z1.toFixed(2)}`);
  }
});

test("props: re-adding the kit into a cleared scene allocates no more than diorama's own add, and keeps nothing", async (t) => {
  const ids = Object.keys(PROPS);
  const d = scene();
  // The same parts as raw add() calls, recorded once (diorama's own cost for these objects).
  const raw = [];
  const add = d.add;
  d.add = (def) => (raw.push({ ...def, size: Float64Array.from(def.size), pos: Float64Array.from(def.pos), rot: Float64Array.from(def.rot) }), add(def));
  const opts = ids.map((id, i) => ({ id, on: "floor", pos: new Float64Array([(i % 6) * 4 - 10, 0, ((i / 6) | 0) * 4 - 4]), seed: i }));
  ids.forEach((id, i) => PROPS[id](d, opts[i]));
  d.add = add;
  const floor = { id: "floor", size: [60, 0.5, 60], pos: [0, -0.5, 0], color: "#d9d3ca", cluster: "floor", layer: 0 };
  const reset = () => (d.clear(), d.cluster("floor", { fixed: 0 }), d.add(floor));
  const viaProps = () => { reset(); for (let i = 0; i < ids.length; i++) PROPS[ids[i]](d, opts[i]); };
  const viaAdd = () => { reset(); for (let i = 0; i < raw.length; i++) d.add(raw[i]); };
  for (let i = 0; i < 200; i++) viaProps(), viaAdd();
  const a = await minorGCs(() => { for (let i = 0; i < 400; i++) viaAdd(); });
  const b = await minorGCs(() => { for (let i = 0; i < 400; i++) viaProps(); });
  t.diagnostic(`young GCs over 400 rebuilds of ${raw.length} objects: add() alone ${a}, through props ${b}`);
  assert.ok(b <= a * 1.1 + 2, `props allocate beyond add(): ${b} vs ${a}`);
  // The same scene each time: nothing piles up (no cache grows, no ids drift).
  viaProps();
  const first = [];
  d.recolor((ob) => first.push([ob.id, ob.shape, ob.color, ...ob.size, ...ob.pos, ...ob.rot].join()));
  globalThis.gc?.();
  const h0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 2000; i++) viaProps();
  globalThis.gc?.();
  const grew = process.memoryUsage().heapUsed - h0;
  t.diagnostic(`heap after 2,000 rebuilds: ${grew >= 0 ? "+" : ""}${grew} B`);
  assert.ok(grew < 256 * 1024, `nothing kept per rebuild: +${grew} B`);
  const again = [];
  d.recolor((ob) => again.push([ob.id, ob.shape, ob.color, ...ob.size, ...ob.pos, ...ob.rot].join()));
  assert.deepEqual(again, first, "the same scene every time");
});

test("props: tree-shakes (one prop bundles alone), imports diorama for types only, no Math.hypot", async () => {
  const { build } = await import("esbuild");
  const { gzipSync } = await import("node:zlib");
  const gz = async (contents) => gzipSync((await build({ stdin: { contents, resolveDir: process.cwd(), loader: "ts" }, bundle: true, minify: true, write: false, format: "esm", logLevel: "silent" })).outputFiles[0].contents).length;
  const one = await gz('export { pineTree } from "./src/props.ts";'), all = await gz('export * from "./src/props.ts";');
  assert.ok(one < all / 3, `one prop ${one} B, the kit ${all} B`);
  const src = readFileSync("src/props.ts", "utf8");
  assert.match(src, /^import type \{[^}]*\} from "\.\/diorama";$/m, "diorama is a type-only import");
  assert.doesNotMatch(src, /Math\.(hypot|random)/);
});
