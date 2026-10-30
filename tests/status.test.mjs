// Status flags (site/bricks.mjs STATUS): every brick has one, the evidence behind it is real, and the
// README's table says the same thing as the catalog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BUDGETS, measure } from "../scripts/sizes.mjs";
import { readmeSizes } from "../scripts/readme-sizes.mjs";
import { BRICKS, PLANNED, STATUS, BETA_LINE } from "../site/bricks.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");
const SHIPPED = ["complete", "beta", "experimental", "deprecated"];

test("every brick carries a known flag, the release it shipped in and its tests", () => {
  for (const b of BRICKS) {
    assert.ok(SHIPPED.includes(b.status), `${b.id}: status "${b.status}" (a shipped brick can't be roadmap)`);
    assert.match(b.since, /^\d+\.\d+\.\d+$/, `${b.id}: since`);
    assert.ok(readFileSync("CHANGELOG.md", "utf8").includes(`## ${b.since}`), `${b.id}: ${b.since} is not a CHANGELOG release`);
    assert.ok(Array.isArray(b.used), `${b.id}: used`);
    if (b.status !== "experimental") assert.ok(b.tests.length, `${b.id}: a ${b.status} brick needs tests`);
    for (const t of b.tests) assert.ok(existsSync(`tests/${t}`), `${b.id}: tests/${t} is missing`);
    for (const s of b.sizes) assert.ok(BUDGETS.some(([n]) => n === s), `${b.id}: no size budget "${s}"`);
  }
});

test("COMPLETE names who ships it; BETA says what keeps it from COMPLETE", () => {
  for (const b of BRICKS) {
    if (b.status === "complete") {
      assert.ok(b.used.length, `${b.id}: COMPLETE needs a released game or production page`);
      assert.equal(b.why, undefined, `${b.id}: a COMPLETE brick has nothing left to explain`);
    }
    if (b.status === "beta") assert.ok(b.why, `${b.id}: BETA needs a why`);
  }
});

test("ROADMAP bricks are planned, not shipped, and build on real or planned bricks", () => {
  const exported = Object.keys(pkg.exports).map((k) => (k === "." ? "fizlet" : `fizlet/${k.slice(2)}`));
  const known = new Set([...exported, ...PLANNED.map((p) => p.name)]);
  for (const p of PLANNED) {
    assert.ok(!exported.includes(p.name), `${p.name} is in package.json: give it a status in BRICKS`);
    assert.match(p.phase, /^E(9|1[0-6])$/, `${p.name}: phase`);
    assert.ok(p.purpose && p.target > 0, `${p.name}: purpose and size target`);
    for (const n of p.needs) assert.ok(known.has(n), `${p.name} needs ${n}, which is neither shipped nor planned`);
  }
});

test("the README table shows each brick's flag, and the beta line", () => {
  const rows = readme.split("\n").filter((l) => /^\| `fizlet/.test(l));
  for (const b of BRICKS)
    for (const m of b.modules) {
      const row = rows.find((r) => r.split(" | ")[0].split(/[`]/).includes(m.name));
      assert.ok(row, `README: no row for ${m.name}`);
      assert.equal(row.split(" | ")[1], STATUS[b.status].label, `README: ${m.name} is ${STATUS[b.status].label} in site/bricks.mjs`);
    }
  assert.ok(readme.replace(/\n> /g, " ").includes(BETA_LINE), "README: the beta line, word for word");
});

test("the README's sizes are this build's (npm run readme:sizes writes them)", async () => {
  assert.equal(readme, readmeSizes(readme, await measure()), "README sizes are stale: run npm run readme:sizes");
});
