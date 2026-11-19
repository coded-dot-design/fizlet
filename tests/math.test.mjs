// @fzlt/core/math (Node, headless): sin, cos, atan, atan2 and hypot give V8's builtin bits for a
// million seeded arguments and every edge case, match the committed digests and table (the vectors
// tests/math-engines.mjs runs in Chromium and WebKit), use no builtin trig, and allocate nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";
import { lcg, RANGES, digests, DIGESTS, TABLE, bits } from "./math-vectors.mjs";

const m = await import("../src/math.ts");
const B = { sin: Math.sin, cos: Math.cos, atan: Math.atan, atan2: Math.atan2, hypot: Math.hypot };
const same = (name, args) => {
  const got = m[name](...args), want = B[name](...args);
  assert.ok(Object.is(got, want), `${name}(${args.join(", ")}): ${bits(got)}, Math.${name} ${bits(want)}`);
};

test("sin and cos: Math.sin's and Math.cos's bits for 1M seeded arguments up to 2^20·π/2", () => {
  const R = lcg(1);
  for (const r of RANGES)
    for (let i = 0; i < 1e6 / RANGES.length; i++) {
      const x = (R() * 2 - 1) * r;
      same("sin", [x]);
      same("cos", [x]);
    }
  // Every exponent: tiny to the edge of the exact range.
  for (let e = -1074; e <= 20; e++)
    for (let k = 0; k < 40; k++) {
      const x = (R() + 0.5) * 2 ** e * (k & 1 ? -1 : 1);
      if (Math.abs(x) > 1647099) continue;
      same("sin", [x]);
      same("cos", [x]);
    }
});

test("sin and cos: the edges (±0, multiples and near-multiples of π/2, NaN, ±Infinity)", () => {
  const xs = [0, -0, 5e-324, -5e-324, 2 ** -27, 2 ** -26, 0.7853981633974483, 0.7853981633974484, Math.PI / 2, -Math.PI / 2, 2.356194490192345, Math.PI, -Math.PI, 2 * Math.PI, 3 * Math.PI, 1e3 * Math.PI, 1647099, -1647099, NaN, Infinity, -Infinity];
  for (let k = 1; k < 2000; k++) xs.push((k * Math.PI) / 2, (k * Math.PI) / 2 + 2 ** -40, (-k * Math.PI) / 2);
  for (const x of xs) {
    same("sin", [x]);
    same("cos", [x]);
  }
});

test("sin and cos past 2^20·π/2: x mod 2π first, so finite, in [−1, 1] and the same twice (V8 may differ there)", () => {
  const R = lcg(3);
  for (const x of [1.7e6, -1.7e6, 1e7, -3e8]) {
    // The reduction's error grows with x (2π is not exact), so near the edge it is still close to the builtin.
    assert.ok(Math.abs(m.sin(x) - Math.sin(x)) < 1e-7 && Math.abs(m.cos(x) - Math.cos(x)) < 1e-7, `${x}`);
  }
  for (let i = 0; i < 10000; i++) {
    const x = (R() - 0.5) * 2 ** ((R() * 1000) | 0) + 2e6;
    const s = m.sin(x), c = m.cos(x);
    assert.ok(Math.abs(s) <= 1 && Math.abs(c) <= 1, `${x}`);
    assert.ok(Object.is(s, m.sin(x)) && Object.is(c, m.cos(x)), `${x}: the same bits again`);
  }
});

test("atan and atan2: the builtins' bits for 1M seeded pairs, every sign and magnitude", () => {
  const R = lcg(2);
  for (let i = 0; i < 1e6; i++) {
    const y = (R() - 0.5) * 2 ** ((R() * 140 - 70) | 0), x = (R() - 0.5) * 2 ** ((R() * 140 - 70) | 0);
    same("atan2", [y, x]);
    if (i % 4 === 0) same("atan", [y]);
  }
  for (let i = 0; i < 1e5; i++) same("atan2", [(R() - 0.5) * 2, (R() - 0.5) * 2]);
});

test("atan2: the edges (±0, ±Infinity, NaN, |y/x| past 2^60 either way, x = 1)", () => {
  const v = [0, -0, 1, -1, 5e-324, -5e-324, 1e-300, 1e300, -1e300, 2 ** 61, -(2 ** 61), Infinity, -Infinity, NaN, 3, -4];
  for (const y of v) for (const x of v) same("atan2", [y, x]);
  for (const x of [0, -0, 2 ** -1022, 0.4375, 0.6875, 1.1875, 2.4375, 2 ** 66, -(2 ** 66), NaN, Infinity, -Infinity]) same("atan", [x]);
});

test("hypot: Math.hypot's bits (steer's, moved here)", () => {
  const R = lcg(4);
  for (let i = 0; i < 2e5; i++) same("hypot", [(R() - 0.5) * 2 ** ((R() * 60 - 30) | 0), (R() - 0.5) * 2 ** ((R() * 60 - 30) | 0)]);
  for (const [a, b] of [[0, 0], [-0, 0], [NaN, 1], [1, NaN], [Infinity, NaN], [NaN, -Infinity], [3, 4], [1e308, 1e308], [5e-324, 0]]) same("hypot", [a, b]);
});

test("the cross-engine vectors: committed digests and exact table (what Chromium and WebKit must give)", () => {
  assert.deepEqual(digests(m, 20000), DIGESTS);
  assert.deepEqual(digests(B, 20000), DIGESTS, "V8's builtins give the same digests");
  for (const [f, args, want] of TABLE) assert.equal(bits(m[f](...args)), want, `${f}(${args})`);
});

test("no builtin transcendental calls: only Math.abs, Math.sqrt and Math.trunc", () => {
  const src = readFileSync(new URL("../src/math.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const used = new Set(src.match(/Math\.\w+/g));
  assert.deepEqual([...used].sort(), ["Math.abs", "Math.sqrt", "Math.trunc"]);
});

test("no allocation: steps of 1,000 calls, small and big angles, make no young GC", async () => {
  const R = lcg(5), xs = new Float64Array(4096), out = new Float64Array(1);
  for (let i = 0; i < xs.length; i++) xs[i] = (R() * 2 - 1) * (i & 1 ? 1e4 : 1);
  // Steps the way a game calls them (functions the JIT optimises whole, not one long loop). hypot is
  // small and inlines where it is called (steer's test holds it there); in a step this full it may not.
  const trig = (j) => {
    let acc = 0;
    for (let i = j; i < j + 1000; i++) {
      const x = xs[i & 4095], y = xs[(i + 7) & 4095];
      acc += m.sin(x) + m.cos(y) + m.atan2(y, x) + m.atan(x);
    }
    out[0] = acc;
  };
  const len = (j) => {
    let acc = 0;
    for (let i = j; i < j + 1000; i++) acc += m.hypot(xs[i & 4095], xs[(i + 7) & 4095]);
    out[0] = acc;
  };
  for (const step of [trig, len]) {
    const run = () => {
      for (let k = 0; k < 2000; k++) step(k * 13);
    };
    run();
    run();
    assert.equal(await minorGCs(run, 5), 0, step.name);
  }
});
