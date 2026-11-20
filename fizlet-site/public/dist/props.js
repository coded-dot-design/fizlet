// src/props.ts
var SZ = new Float64Array(3);
var PS = new Float64Array(3);
var RT = new Float64Array(3);
var S = { size: SZ, pos: PS, rot: RT };
var D;
var R;
var O;
var P;
var K = 1;
var LV = 0;
var SEED = 0;
var N = 0;
function q(k) {
  let h = Math.imul(SEED, 2654435761) + Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^ h >>> 16) >>> 29;
}
var j = (k, amp) => 1 + amp * ((q(k) - 3.5) / 3.5);
var c = (key) => key[0] === "#" ? key : O.colors && O.colors[key] || P[key];
function root(d, o, pal, name, w, h, dd) {
  D = d;
  O = o;
  P = pal;
  K = o.scale ?? 1;
  SEED = (o.seed ?? 0) | 0;
  const p = o.pos, id = o.id ?? "prop" + ++N, on = o.on ?? null;
  SZ[0] = w * K;
  SZ[1] = h * K;
  SZ[2] = dd * K;
  PS[0] = p ? p[0] : 0;
  PS[1] = p ? p[1] : 0;
  PS[2] = p ? p[2] : 0;
  RT[0] = RT[2] = 0;
  RT[1] = o.rot ?? 0;
  S.id = id;
  S.shape = "group";
  S.on = on;
  S.layer = o.layer;
  S.cluster = o.cluster === null ? void 0 : o.cluster ?? id;
  S.shadow = o.shadow ?? (on ? 0.16 : 0);
  S.tag = o.tag ?? name;
  S.pick = o.pick;
  S.color = S.sides = S.top = S.mask = S.emissive = void 0;
  R = d.add(S);
  LV = R.layer;
  S.id = S.cluster = S.tag = void 0;
  S.shadow = 0;
  S.on = id;
  return R;
}
function part(shape, w, h, dd, x, y, z, col, lv, sides = 0, top = 1, ry = 0, rx = 0, glow = false) {
  SZ[0] = w * K;
  SZ[1] = h * K;
  SZ[2] = dd * K;
  PS[0] = x * K;
  PS[1] = y * K;
  PS[2] = z * K;
  RT[0] = rx;
  RT[1] = ry;
  RT[2] = 0;
  S.shape = shape;
  S.color = c(col);
  S.layer = LV + lv;
  S.emissive = glow;
  S.sides = shape === "cyl" ? sides : void 0;
  S.top = shape === "cyl" ? top : void 0;
  S.mask = shape === "box" && sides ? sides : void 0;
  D.add(S);
}
var box = (w, h, dd, x, y, z, col, lv, mask = 0, ry = 0) => part("box", w, h, dd, x, y, z, col, lv, mask, 1, ry);
var cyl = (w, h, x, y, z, col, lv, sides, top, ry = 0) => part("cyl", w, h, w, x, y, z, col, lv, sides, top, ry);
var FRONT = 16;
var HALF = Math.PI / 2;
var PINE = { trunk: "#a47c5b", leaf: "#7fc79b", leaf2: "#a3d9ab" };
function pineTree(d, o = {}) {
  const r = root(d, o, PINE, "pine", 2.1, 3.5, 2.1), h = j(0, 0.2), w = j(1, 0.12), t = q(2) * 0.4;
  cyl(0.36, 0.7 * h, 0, 0, 0, "trunk", 1, 6, 0.9);
  cyl(1.8 * w, 1.3 * h, 0, 0.55 * h, 0, "leaf", 2, 7, 0, t);
  cyl(1.4 * w, 1.1 * h, 0, 1.25 * h, 0, "leaf2", 3, 7, 0, t + 0.45);
  cyl(1 * w, 0.95 * h, 0, 1.9 * h, 0, "leaf", 4, 7, 0, t);
  return r;
}
var ROUND = { trunk: "#a47c5b", leaf: "#8fcf9b", leaf2: "#b0dfa8" };
function roundTree(d, o = {}) {
  const r = root(d, o, ROUND, "tree", 2.1, 3, 2.1), h = j(0, 0.18), w = j(1, 0.12), t = q(2) * 0.4;
  cyl(0.3, 1.1 * h, 0, 0, 0, "trunk", 1, 6, 0.85);
  cyl(1.2 * w, 0.7 * h, 0, 0.95 * h, 0, "leaf", 2, 8, 1.5, t);
  cyl(1.8 * w, 0.85 * h, 0, 1.65 * h, 0, "leaf2", 3, 8, 0.45, t);
  return r;
}
var BUSH = { leaf: "#8fcf9b", leaf2: "#b0dfa8" };
function bush(d, o = {}) {
  const r = root(d, o, BUSH, "bush", 2, 0.8, 1.4), a = j(0, 0.15), b = j(1, 0.2), e = (q(2) - 3.5) * 0.06;
  cyl(1.1 * a, 0.62 * a, 0, 0, 0, "leaf", 1, 7, 0.5, q(3) * 0.3);
  cyl(0.62 * b, 0.42 * b, -0.6, 0, 0.18 + e, "leaf2", 1, 7, 0.45);
  cyl(0.55 * a, 0.36 * a, 0.62, 0, -0.15 - e, "leaf2", 1, 7, 0.45);
  return r;
}
var ROCKS = { rock: "#b9b5c6", rock2: "#d2cedb" };
function rocks(d, o = {}) {
  const r = root(d, o, ROCKS, "rocks", 2, 0.8, 1.4), a = j(0, 0.15);
  cyl(1 * a, 0.62 * a, -0.2, 0, -0.1, "rock", 1, 5, 0.55, q(1) * 0.8);
  cyl(0.6 * j(2, 0.2), 0.4, 0.55, 0, 0.3, "rock2", 1, 6, 0.6, q(3) * 0.8);
  cyl(0.42, 0.26 * j(4, 0.2), -0.7, 0, 0.45, "rock2", 1, 5, 0.5, q(5) * 0.8);
  return r;
}
var CACTUS = { cactus: "#86c497", cactus2: "#a9d9ac", flower: "#f4a6b8" };
function cactus(d, o = {}) {
  const r = root(d, o, CACTUS, "cactus", 1.4, 2, 0.5), h = j(0, 0.15), a = 0.5 + q(1) * 0.05, b = 0.75 + q(2) * 0.05;
  cyl(0.5, 1.6 * h, 0, 0, 0, "cactus", 1, 8, 0.85);
  box(0.4, 0.2, 0.2, -0.38, a, 0, "cactus", 1);
  cyl(0.26, 0.55, -0.52, a, 0, "cactus2", 2, 6, 0.8);
  box(0.4, 0.2, 0.2, 0.38, b, 0, "cactus", 1);
  cyl(0.26, 0.45, 0.52, b, 0, "cactus2", 2, 6, 0.8);
  if (SEED & 1) cyl(0.24, 0.14, 0, 1.6 * h, 0, "flower", 3, 6, 0.4);
  return r;
}
var HOUSE = { wall: "#f6e7d8", roof: "#e9806f", trim: "#c9b8a6", door: "#a98a72", glass: "#bfe3f2", brick: "#d78f7d" };
function house(d, o = {}) {
  const r = root(d, o, HOUSE, "house", 2.6, 2.7, 2.2), h = 1.5 + q(0) * 0.03, s = SEED & 2 ? -1 : 1;
  box(2.4, h, 2, 0, 0, 0, "wall", 1);
  part("wedge", 1.3, 0.9, 2.2, 0.65, h, 0, "roof", 2);
  part("wedge", 1.3, 0.9, 2.2, -0.65, h, 0, "roof", 2, 0, 1, Math.PI);
  box(0.3, 0.75, 0.3, 0.6 * s, h + 0.2, -0.4, "brick", 3);
  box(0.5, 0.9, 0.04, -0.5, 0, 1, "door", 2, FRONT);
  box(0.5, 0.45, 0.04, 0.55, 0.6, 1, "glass", 2, FRONT);
  box(0.6, 0.06, 0.06, 0.55, 0.56, 1, "trim", 3);
  return r;
}
var SHOP = { wall: "#d8e8e0", trim: "#f7f2e8", awning: "#ef8a78", awning2: "#fbf4e6", door: "#8f9dc6", glass: "#bfe3f2" };
function shop(d, o = {}) {
  const r = root(d, o, SHOP, "shop", 2.8, 2.1, 2.8), h = 1.7 + q(0) * 0.02, n = 4 + (SEED & 1) * 2, sw = 2.6 / n;
  box(2.6, h, 2, 0, 0, -0.3, "wall", 1);
  box(2.72, 0.2, 2.1, 0, h, -0.3, "trim", 2);
  box(1.3, 0.75, 0.04, 0.45, 0.35, 0.7, "glass", 2, FRONT);
  box(0.5, 1, 0.04, -0.75, 0, 0.7, "door", 2, FRONT);
  for (let i = 0; i < n; i++) part("wedge", 0.6, 0.4, sw, -1.3 + sw * (i + 0.5), 1.2, 1, i & 1 ? "awning2" : "awning", 1, 0, 1, -HALF);
  return r;
}
var LAMP = { metal: "#6e6878", lamp: "#ffe7a0" };
function lamppost(d, o = {}) {
  const r = root(d, o, LAMP, "lamppost", 0.5, 2.9, 0.5);
  cyl(0.34, 0.16, 0, 0, 0, "metal", 1, 8, 0.7);
  cyl(0.1, 2.2, 0, 0.16, 0, "metal", 2, 6, 1);
  part("cyl", 0.34, 0.3, 0.34, 0, 2.36, 0, "lamp", 3, 6, 1.25, 0, 0, true);
  cyl(0.5, 0.24, 0, 2.66, 0, "metal", 4, 6, 0);
  return r;
}
var BENCH = { wood: "#d9a46c", metal: "#6e6878" };
function bench(d, o = {}) {
  const r = root(d, o, BENCH, "bench", 1.7, 0.9, 0.5);
  box(0.08, 0.4, 0.42, -0.68, 0, 0, "metal", 1);
  box(0.08, 0.4, 0.42, 0.68, 0, 0, "metal", 1);
  box(1.6, 0.08, 0.46, 0, 0.4, 0.01, "wood", 2);
  box(1.6, 0.34, 0.07, 0, 0.54, -0.2, "wood", 2);
  return r;
}
var FENCE = { fence: "#fbf7f0", post: "#e4d8ca" };
var FENCE_STEP = 2;
function fence(d, o = {}) {
  const r = root(d, o, FENCE, "fence", 2, 0.9, 0.16);
  box(0.14, 0.86, 0.14, -0.93, 0, 0, "post", 1);
  box(0.14, 0.86, 0.14, 0.93, 0, 0, "post", 1);
  box(1.72, 0.08, 0.05, 0, 0.25, -0.03, "fence", 1);
  box(1.72, 0.08, 0.05, 0, 0.58, -0.03, "fence", 1);
  for (let i = -1; i <= 1; i++) box(0.16, 0.74, 0.04, i * 0.55, 0.04, 0.02, "fence", 2);
  return r;
}
var CONE = { cone: "#f59a62", cone2: "#fbf7f0" };
function trafficCone(d, o = {}) {
  const r = root(d, o, CONE, "cone", 0.5, 0.7, 0.5);
  box(0.5, 0.06, 0.5, 0, 0, 0, "cone", 1);
  cyl(0.36, 0.24, 0, 0.06, 0, "cone", 2, 8, 0.7);
  cyl(0.252, 0.13, 0, 0.3, 0, "cone2", 3, 8, 0.76);
  cyl(0.19, 0.27, 0, 0.43, 0, "cone", 4, 8, 0);
  return r;
}
var CRATES = { wood: "#dcab72", wood2: "#c4925e" };
function crates(d, o = {}) {
  const r = root(d, o, CRATES, "crates", 1.2, 2, 1.2), n = 1 + q(0) % 3;
  box(0.9, 0.8, 0.9, 0, 0, 0, "wood", 1, 0, (q(1) - 3.5) * 0.05);
  box(0.62, 0.1, 0.04, 0, 0.35, 0.45, "wood2", 2, FRONT, (q(1) - 3.5) * 0.05);
  if (n > 1) box(0.7, 0.62, 0.7, 0.06, 0.8, -0.04, "wood", 3, 0, (q(2) - 3.5) * 0.12);
  if (n > 2) box(0.5, 0.45, 0.5, -0.04, 1.42, 0.02, "wood2", 4, 0, (q(3) - 3.5) * 0.15);
  return r;
}
var LIGHTHOUSE = { stone: "#aeb0bd", wall: "#faf6ee", stripe: "#ee8270", metal: "#5f6678", lamp: "#ffe7a0", roof: "#e66d5f", door: "#5f6678" };
function lighthouse(d, o = {}) {
  const r = root(d, o, LIGHTHOUSE, "lighthouse", 2.2, 5, 2.2);
  cyl(2.2, 0.45, 0, 0, 0, "stone", 1, 9, 0.85);
  for (let i = 0; i < 4; i++) cyl(1.5 - i * 0.12, 0.8, 0, 0.45 + i * 0.8, 0, i & 1 ? "stripe" : "wall", 2 + i, 9, (1.38 - i * 0.12) / (1.5 - i * 0.12));
  box(0.36, 0.6, 0.04, 0, 0.45, 0.72, "door", 3, FRONT);
  cyl(1.3, 0.12, 0, 3.65, 0, "metal", 6, 9, 1);
  part("cyl", 0.72, 0.55, 0.72, 0, 3.77, 0, "lamp", 7, 9, 1, 0, 0, true);
  cyl(0.95, 0.5, 0, 4.32, 0, "roof", 8, 9, 0);
  cyl(0.1, 0.18, 0, 4.8, 0, "metal", 9, 5, 1);
  return r;
}
var DOCK = { deck: "#ddb689", plank: "#b98f63", post: "#a07a58", metal: "#6f6a78" };
var DOCK_STEP = 3;
function dock(d, o = {}) {
  const r = root(d, o, DOCK, "dock", 3, 0.9, 1.4);
  for (let i = 0; i < 4; i++) cyl(0.18, 0.5, i & 1 ? 1.3 : -1.3, 0, i & 2 ? 0.55 : -0.55, "post", 1, 6, 1);
  box(3, 0.16, 1.4, 0, 0.5, 0, "deck", 2);
  for (let i = 0; i < 4; i++) box(3, 0.01, 0.05, 0, 0.66, -0.52 + i * 0.35, "plank", 3, 1);
  if (!(SEED & 1)) cyl(0.26, 0.24, 1.2, 0.66, 0.5, "metal", 4, 8, 0.8);
  return r;
}
var BUOY = { buoy: "#ef7d6a", buoy2: "#fbf7f0", lamp: "#ffe7a0" };
function buoy(d, o = {}) {
  const r = root(d, o, BUOY, "buoy", 0.6, 1.1, 0.6);
  cyl(0.6, 0.4, 0, 0, 0, "buoy", 1, 8, 0.8);
  cyl(0.48, 0.26, 0, 0.4, 0, "buoy2", 2, 8, 0.72);
  cyl(0.34, 0.32, 0, 0.66, 0, "buoy", 3, 8, 0.2);
  part("cyl", 0.12, 0.12, 0.12, 0, 0.98, 0, "lamp", 4, 6, 1, 0, 0, true);
  return r;
}
var PAINTS = ["#ef7d6a", "#6db0cf", "#f2c96b", "#7fcfa8"];
function axle(x, hz, rad) {
  part("cyl", rad * 2, 0.22, rad * 2, x, rad, hz, "tire", 1, 8, 1, 0, HALF);
  part("cyl", rad * 2, 0.22, rad * 2, x, rad, -hz - 0.22, "tire", 1, 8, 1, 0, HALF);
}
var CAR = { glass: "#d7eef8", tire: "#4a4656", lamp: "#fff3c4" };
function car(d, o = {}) {
  const r = root(d, o, CAR, "car", 2, 1.1, 1.2), paint = o.colors && o.colors.paint || PAINTS[q(0) & 3];
  box(1.9, 0.42, 0.9, 0, 0.16, 0, paint, 2);
  box(0.86, 0.36, 0.8, -0.15, 0.58, 0, "glass", 3);
  part("wedge", 0.3, 0.36, 0.8, 0.43, 0.58, 0, "glass", 3);
  part("wedge", 0.22, 0.36, 0.8, -0.69, 0.58, 0, "glass", 3, 0, 1, Math.PI);
  box(0.9, 0.06, 0.82, -0.15, 0.94, 0, paint, 4);
  box(0.04, 0.1, 0.2, 0.95, 0.4, 0.28, "lamp", 3, 4);
  box(0.04, 0.1, 0.2, 0.95, 0.4, -0.28, "lamp", 3, 4);
  axle(0.6, 0.34, 0.21);
  axle(-0.6, 0.34, 0.21);
  return r;
}
var TRUCK = { body: "#f7f2e8", glass: "#d7eef8", tire: "#4a4656", lamp: "#fff3c4", metal: "#6f6a78" };
function truck(d, o = {}) {
  const r = root(d, o, TRUCK, "truck", 3.1, 1.6, 1.2), paint = o.colors && o.colors.paint || PAINTS[q(0) & 3];
  box(2.9, 0.16, 0.86, 0, 0.2, 0, "metal", 2);
  box(0.9, 0.86, 0.96, 1, 0.36, 0, paint, 3);
  box(0.04, 0.38, 0.8, 1.45, 0.74, 0, "glass", 4, 4);
  box(0.04, 0.1, 0.2, 1.45, 0.46, 0.32, "lamp", 4, 4);
  box(0.04, 0.1, 0.2, 1.45, 0.46, -0.32, "lamp", 4, 4);
  box(1.9, 1.2, 1.04, -0.45, 0.36, 0, "body", 3);
  axle(1, 0.3, 0.23);
  axle(-0.55, 0.3, 0.23);
  axle(-1.1, 0.3, 0.23);
  return r;
}
var PROPS = { pineTree, roundTree, bush, rocks, cactus, house, shop, lamppost, bench, fence, trafficCone, crates, lighthouse, dock, buoy, car, truck };
export {
  DOCK_STEP,
  FENCE_STEP,
  PROPS,
  bench,
  buoy,
  bush,
  cactus,
  car,
  crates,
  dock,
  fence,
  house,
  lamppost,
  lighthouse,
  pineTree,
  rocks,
  roundTree,
  shop,
  trafficCone,
  truck
};
