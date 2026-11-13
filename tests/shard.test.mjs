// scripts/shard.mjs: CI's split of the chained browser and site suites. Every file of a script lands in
// exactly one shard for any n, and shards are deterministic and balanced (a test added to package.json
// without a time in tests/shard-times.json still runs, at the median cost; no table edit needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { files, shards } from "../scripts/shard.mjs";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const times = JSON.parse(readFileSync("tests/shard-times.json", "utf8"));
const SHARDED = ["test:browser", "test:site"];

test("files: reads a chained node script in order, refuses anything else", () => {
  assert.deepEqual(files("node tests/a.mjs && node tests/b.mjs"), ["tests/a.mjs", "tests/b.mjs"]);
  assert.throws(() => files("node tests/a.mjs && tsc -p x"), /not a plain/);
});

for (const name of SHARDED) {
  const list = files(scripts[name]);
  test(`${name}: every file in exactly one shard for n = 1..5, in package.json order`, () => {
    for (let n = 1; n <= 5; n++) {
      const got = shards(list, n, times[name]);
      assert.equal(got.length, n);
      const flat = got.flatMap((s) => s.files);
      assert.equal(flat.length, list.length, `n=${n}: ${flat.length} files, want ${list.length}`);
      assert.deepEqual([...flat].sort(), [...list].sort(), `n=${n}`);
      for (const s of got) assert.deepEqual(s.files, list.filter((f) => s.files.includes(f)));
      assert.deepEqual(shards(list, n, times[name]), got, `n=${n} is deterministic`);
    }
  });
  test(`${name}: the times table holds seconds (a file it lacks runs at the median)`, () => {
    for (const [f, s] of Object.entries(times[name])) assert.ok(Number.isFinite(s) && s > 0, f);
  });
}

test("shards: balanced by time, unknown files at the median, no table falls back to equal weights", () => {
  const t = { a: 10, b: 6, c: 4, d: 2 };
  assert.deepEqual(shards(["a", "b", "c", "d"], 2, t).map((s) => s.seconds), [12, 10]);
  const withNew = shards(["a", "b", "c", "d", "new"], 2, t);
  assert.equal(withNew.flatMap((s) => s.files).length, 5);
  assert.equal(withNew.reduce((s, x) => s + x.seconds, 0), 22 + 6);
  assert.deepEqual(shards(["x", "y", "z"], 2).map((s) => s.files.length), [2, 1]);
  assert.throws(() => shards(["a"], 0), /n must be/);
});
