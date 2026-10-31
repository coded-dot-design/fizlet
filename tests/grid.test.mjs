// Grid brick tests (Node): board storage, A* against a reference Dijkstra, budgets, line of sight,
// movement range, seeded boards, and zero allocation across many searches.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { board, BLOCKED, COVER, OCCUPIED } = await import("../src/grid.ts");
const { seeded } = await import("../src/kernel/random.ts");

/** Draw a board from rows of text: "#" blocked, "c" cover, "o" occupied, digits = cost. */
function draw(rows, diagonal = false) {
  const b = board(rows[0].length, rows.length, { diagonal });
  rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      const i = r * b.cols + c;
      if (ch === "#") b.flags[i] = BLOCKED;
      else if (ch === "c") b.flags[i] = COVER;
      else if (ch === "o") b.flags[i] = OCCUPIED;
      else if (ch >= "1" && ch <= "9") b.cost[i] = Number(ch);
    }),
  );
  return b;
}

/** Reference: plain Dijkstra with the same rules (allocates freely; it is the oracle). */
function reference(b, from, to, avoid = BLOCKED | OCCUPIED) {
  const n = b.cols * b.rows, dist = new Array(n).fill(Infinity), done = new Array(n).fill(false);
  const D = b.diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dist[from] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < n; k++) if (!done[k] && dist[k] < Infinity && (i < 0 || dist[k] < dist[i])) i = k;
    if (i < 0) return dist;
    done[i] = true;
    const c = i % b.cols, r = (i - c) / b.cols;
    D.forEach(([dx, dy], k) => {
      const nc = c + dx, nr = r + dy, j = nr * b.cols + nc;
      if (nc < 0 || nr < 0 || nc >= b.cols || nr >= b.rows) return;
      if (b.flags[j] & avoid && j !== to) return;
      if (k > 3 && (b.flags[r * b.cols + nc] | b.flags[nr * b.cols + c]) & avoid) return;
      const nd = dist[i] + b.cost[j] * (k > 3 ? 14 : 10);
      if (nd < dist[j]) dist[j] = nd;
    });
  }
}

/** Walk a returned path: every step is a legal move; returns its cost in tenths. */
function walk(b, from, out, n) {
  let cost = 0, at = from;
  for (let k = 0; k < n; k++) {
    const i = out[k], dc = Math.abs((i % b.cols) - (at % b.cols)), dr = Math.abs(Math.floor(i / b.cols) - Math.floor(at / b.cols));
    assert.ok(dc <= 1 && dr <= 1 && dc + dr > 0 && (b.diagonal || dc + dr === 1), `step ${k} is adjacent`);
    assert.equal(b.flags[i] & BLOCKED, 0, "never through a blocked cell");
    cost += b.cost[i] * (dc + dr === 2 ? 14 : 10);
    at = i;
  }
  return cost;
}

test("grid: storage, world ↔ cell, clamped", () => {
  const b = board(10, 6, { cell: 32 });
  assert.equal(b.terrain.length, 60);
  assert.equal(b.cost[0], 1, "cost defaults to 1");
  assert.equal(b.at(40, 70), 2 * 10 + 1);
  assert.equal(b.at(-50, -50), 0, "clamped");
  assert.equal(b.at(9999, 9999), 59, "clamped");
  assert.equal(b.cellOf(new Float64Array([40]), new Float64Array([70]), 0), 21);
  const p = new Float64Array(2);
  b.center(21, p);
  assert.deepEqual([...p], [48, 80]);
  b.set(5, 3, 4, BLOCKED | COVER);
  assert.deepEqual([b.terrain[5], b.cost[5], b.flags[5]], [3, 4, BLOCKED | COVER]);
});

test("grid: paths go round walls, through the gap, start excluded and goal last", () => {
  const b = draw([
    "..........",
    "....#.....",
    "....#.....",
    "....#.....",
    "..........",
  ]);
  const out = new Int32Array(64), from = 2 * 10 + 2, to = 2 * 10 + 7;
  const n = b.path(from, to, out);
  assert.equal(out[n - 1], to);
  assert.equal(walk(b, from, out, n), reference(b, from, to)[to]);
  assert.equal(n, 9, "around the wall: 5 across + 2 × 2 detour");
  assert.equal(b.path(from, from, out), 0);
});

test("grid: no path, blocked goal, occupied cells and occupied goals", () => {
  const b = draw([
    "...#...",
    "...#...",
    "...#...",
  ]);
  const out = new Int32Array(32);
  assert.equal(b.path(0, 6, out), -1, "sealed off");
  assert.equal(b.path(0, 3, out), -1, "blocked goal");
  const o = draw([
    ".......",
    "...o...",
    ".......",
  ]);
  const n = o.path(7, 13, out);
  assert.ok(n > 6, "goes around the occupied cell");
  for (let k = 0; k < n; k++) assert.notEqual(out[k], 10);
  assert.equal(o.path(7, 10, out), 3, "an occupied goal (attack it) is reachable");
  assert.equal(o.path(7, 13, out, 0, BLOCKED), 6, "avoid mask: drive through units");
});

test("grid: A* is optimal on random weighted boards (4-way and 8-way, no corner cutting)", () => {
  const rand = seeded(9), out = new Int32Array(512);
  for (const diagonal of [false, true])
    for (let round = 0; round < 6; round++) {
      const b = board(17, 11, { diagonal });
      b.scatter(rand, 0.25, 1);
      b.scatter(rand, 0.3, 2, 3, 0); // rough ground: cost 3
      for (let q = 0; q < 12; q++) {
        const from = b.pick(rand), to = b.pick(rand), ref = reference(b, from, to)[to], n = b.path(from, to, out);
        if (ref === Infinity) assert.equal(n, -1);
        else assert.equal(walk(b, from, out, n), ref, `${diagonal ? 8 : 4}-way ${from}→${to}`);
      }
    }
});

test("grid: a budget caps the work and returns a partial path toward the goal", () => {
  const b = board(48, 30), out = new Int32Array(256);
  for (let r = 0; r < 25; r++) b.flags[r * 48 + 24] = BLOCKED; // a long wall
  const from = 10 * 48 + 2, to = 10 * 48 + 45;
  const full = b.path(from, to, out);
  assert.ok(full > 0 && !b.partial);
  const all = b.expanded;
  const n = b.path(from, to, out, 40);
  assert.ok(b.partial, "ran out");
  assert.ok(b.expanded <= 41 && b.expanded < all, `expanded ${b.expanded} of ${all}`);
  assert.ok(n > 0 && out[n - 1] !== to, "a step toward it, not the goal");
  assert.ok(Math.abs((out[n - 1] % 48) - 45) < 43, "closer than the start");
  const short = new Int32Array(3);
  assert.equal(b.path(from, to, short), full, "full length returned when out is short");
  b.path(from, to, out);
  assert.deepEqual([...short], [...out.slice(0, 3)], "the first steps are written");
});

test("grid: line of sight is symmetric, walls block, cover blocks only when asked", () => {
  const b = draw([
    "........",
    "...#....",
    "........",
    "...c....",
    "........",
  ]);
  const at = (c, r) => r * 8 + c;
  assert.equal(b.los(at(0, 1), at(7, 1)), false, "the wall");
  assert.equal(b.hit(at(0, 1), at(7, 1)), at(3, 1), "hit names the blocking cell");
  assert.equal(b.los(at(0, 0), at(7, 0)), true);
  assert.equal(b.los(at(0, 3), at(7, 3)), true, "cover does not block by default");
  assert.equal(b.los(at(0, 3), at(7, 3), BLOCKED | COVER), false);
  assert.equal(b.los(at(3, 1), at(3, 4)), true, "endpoints never block (a unit in cover still sees out)");
  const rand = seeded(3), r = board(20, 14);
  r.scatter(rand, 0.2, 1);
  for (let k = 0; k < 400; k++) {
    const a = Math.floor(rand() * 280), z = Math.floor(rand() * 280);
    assert.equal(r.los(a, z), r.los(z, a), "symmetric");
  }
});

test("grid: flood gives the movement range, nearest first", () => {
  const b = draw([
    ".....",
    ".#3..",
    ".....",
  ]);
  const out = new Int32Array(64);
  const n = b.flood(0, 2, out);
  assert.deepEqual([...out.slice(0, n)].sort((x, y) => x - y), [0, 1, 2, 5, 10]);
  assert.equal(out[0], 0, "the start first");
  assert.equal(b.dist(2), 2);
  assert.equal(b.dist(4), -1, "out of range");
  const ref = reference(b, 0, -1);
  const all = b.flood(0, 99, out);
  assert.equal(all, 14, "everything but the wall");
  for (let k = 0; k < all; k++) assert.equal(b.dist(out[k]) * 10, ref[out[k]]);
  for (let k = 1; k < all; k++) assert.ok(b.dist(out[k]) >= b.dist(out[k - 1]), "settled in cost order");
  assert.equal(b.dist(7), 5, "entering the cost-3 cell costs 3");
  assert.equal(b.flood(0, 99, new Int32Array(4)), 4, "capped at out.length");
});

test("grid: a seed reproduces the board", () => {
  const lay = (seed) => {
    const b = board(48, 30), rand = seeded(seed);
    b.scatter(rand, 0.12, 1, 1, BLOCKED);
    b.scatter(rand, 0.08, 2, 1, COVER, 4, 1, 44, 29); // keep the deployment columns clear
    b.scatter(rand, 0.1, 3, 2, 0);
    return { b, spawn: b.pick(rand) };
  };
  const a = lay(1234), c = lay(1234), d = lay(99);
  assert.deepEqual(a.b.terrain, c.b.terrain);
  assert.deepEqual(a.b.flags, c.b.flags);
  assert.deepEqual(a.b.cost, c.b.cost);
  assert.equal(a.spawn, c.spawn);
  assert.notDeepEqual(a.b.terrain, d.b.terrain);
  for (let r = 0; r < 30; r++) assert.notEqual(a.b.terrain[r * 48 + 2], 2, "rect respected");
});

test("grid: zero allocation across many searches", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const b = board(48, 30, { diagonal: true }), rand = seeded(7);
  b.scatter(rand, 0.18, 1);
  b.scatter(rand, 0.1, 2, 3, 0);
  const N = 256, ends = new Int32Array(N * 2), out = new Int32Array(512), sum = new Int32Array(2);
  for (let k = 0; k < N * 2; k++) ends[k] = b.pick(rand);
  const frame = (k) => {
    const a = ends[(k * 2) % (N * 2)], z = ends[(k * 2 + 1) % (N * 2)];
    sum[0] += b.path(a, z, out, 600);
    if (b.los(a, z)) sum[1]++;
    if ((k & 63) === 0) sum[0] += b.flood(a, 6, out);
  };
  for (let k = 0; k < 10000; k++) frame(k);
  gc();
  let ms = 0;
  const minor = await minorGCs(() => {
    const t0 = performance.now();
    for (let k = 0; k < 100000; k++) frame(k);
    ms = performance.now() - t0;
  });
  assert.ok(sum[0] > 0);
  t.diagnostic(`100k path + los calls (48×30, 8-way, budget 600) and 1,563 floods: ${minor} young GCs, ${(ms / 100).toFixed(1)} µs per frame`);
  assert.ok(minor <= 1, `young-generation GCs over 100k searches: ${minor}`);
});

test("grid: options are checked at setup (a bad size throws with its name, never NaN cells)", () => {
  for (const bad of [0, -3, 2.5, NaN, Infinity, "8"]) {
    assert.throws(() => board(bad, 4), /cols/, `cols ${bad}`);
    assert.throws(() => board(4, bad), /rows/, `rows ${bad}`);
  }
  for (const bad of [0, -1, NaN, Infinity, "2"]) assert.throws(() => board(4, 4, { cell: bad }), /cell/, `cell ${bad}`);
  // cell: 0 used to make at() NaN; good values still pass.
  const b = board(4, 3, { cell: 0.5 });
  assert.deepEqual([b.cols, b.rows, b.cell, b.at(1.2, 0.7)], [4, 3, 0.5, 6]);
});

// The probes run in a child with a time limit: before the fix some never returned, and a test must
// fail on that, not hang the suite. Each case prints its error (or "returned").
import { spawnSync } from "node:child_process";
const GRID = JSON.stringify(new URL("../src/grid.ts", import.meta.url).href);
function probe(cases) {
  const body = cases.map((c) => `try { ${c}; console.log("returned"); } catch (e) { console.log(String(e)); }`).join("\n");
  const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `const { board } = await import(${GRID});\n${body}`], { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL" });
  assert.notEqual(r.signal, "SIGKILL", "a call never returned (an infinite loop)");
  return r.stdout.trim().split("\n");
}

test("grid: a cell id that is not an integer on the board throws a named error, never hangs (S6 P2-01)", () => {
  const out = new Int32Array(64), cases = [
    // wrong answers before the fix (no hang): path(-1, 5) gave 6, los(0, 999) true
    "board(16, 12).path(-1, 5, new Int32Array(64))", "board(16, 12).path(0, 192, new Int32Array(64))", "board(16, 12).los(0, 999)", "board(16, 12).hit(0, 192)",
    // never returned before the fix
    "board(16, 12).path(NaN, 5, new Int32Array(64))", "board(16, 12).path(1.5, 5, new Int32Array(64))", "board(16, 12).path('5', 7, new Int32Array(64))",
    "board(16, 12).path(0, Infinity, new Int32Array(64))", "board(16, 12).path(0, 1.5, new Int32Array(64))",
    "board(16, 12).flood(NaN, 3, new Int32Array(64))", "board(16, 12).flood(-1, 3, new Int32Array(64))",
    "board(16, 12).los(0, 1.5)", "board(16, 12).los(NaN, 4)", "board(16, 12).los(null, 4)", "board(16, 12).hit(0, -Infinity)",
  ];
  probe(cases).forEach((l, i) => assert.match(l, /^RangeError: fizlet\/grid: cell \S+ is not on the board$/, cases[i]));
  // Good ids, -0 included (it is cell 0), still search as before.
  const b = board(16, 12);
  assert.deepEqual([b.path(-0, 2, out), b.los(-0, 15), b.hit(0, 191), b.flood(0, 1, out)], [2, true, -1, 3]);
});

test("grid: zero-size or invalid boards are refused at construction with a named error (S6 P2-02)", () => {
  const bad = [[0, 12], [null, 12], [12, null], [-0, 12], [undefined, 3], [2.5, 3], ["4", 3], [-1, 3], [{}, 3], [true, 3]];
  for (const [c, r] of bad) assert.throws(() => board(c, r), { name: "RangeError", message: /^fizlet\/grid: cols .*, rows .*, cell .* is not a board$/ }, `${c}, ${r}`);
  // On main 0.20.0, Board(null, 12) and Board(0, 12) built a 0-cell board whose searches never ended.
  for (const l of probe(["board(null, 12).flood(0, 3, new Int32Array(64))", "board(0, 12).path(0, 1, new Int32Array(64))"])) assert.match(l, /^RangeError: fizlet\/grid: cols .* is not a board$/);
});
