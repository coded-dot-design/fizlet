// PERF-LOG.md is generated from tests/perf/wins.json; every win is measured and links its PR.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWins, render } from "../scripts/perf-log.mjs";

test("perf log: PERF-LOG.md is the generated table (run `node scripts/perf-log.mjs --write`)", () => {
  assert.equal(readFileSync("PERF-LOG.md", "utf8"), render(loadWins()));
});

test("perf log: one row per win, with before → after and a link to its PR", () => {
  const wins = loadWins();
  assert.ok(wins.length >= 2);
  const rows = render(wins).split("\n").filter((l) => /^\| \d/.test(l));
  assert.equal(rows.length, wins.length);
  assert.match(rows[0], /119\.6 → 28\.5 rAF\/s/);
  assert.match(rows[0], /\[#67\]\(https:\/\/github\.com\/coded-dot-design\/fizlet\/pull\/67\)/);
  assert.match(rows[1], /60\.4 → 0 rAF\/s/);
});

test("perf log: an entry without a measured number, a PR or a test is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "perf-log-"));
  const good = { version: "1.0.0", pr: 1, win: "w", metric: "m", before: 2, after: 1, unit: "ms", how: "h", test: "t" };
  const bad = (patch, re) => {
    const f = join(dir, "wins.json");
    writeFileSync(f, JSON.stringify({ wins: [{ ...good, ...patch }] }));
    assert.throws(() => loadWins(f), re);
  };
  bad({ after: "fast" }, /measured numbers/);
  bad({ pr: undefined }, /missing pr/);
  bad({ test: "" }, /missing test/);
  bad({ after: 2 }, /not a win/);
  bad({ how: "a | b" }, /table cell/);
});
