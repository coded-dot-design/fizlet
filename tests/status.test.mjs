// Status flags (site/bricks.mjs STATUS): every brick has one, the evidence behind it is real, and the
// README's table says the same thing as the catalog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BUDGETS } from "../scripts/sizes.mjs";
import { readmeSizes } from "../scripts/readme-sizes.mjs";
import { BRICKS, PLANNED, STATUS, BETA_LINE } from "../site/bricks.mjs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");
const SHIPPED = ["complete", "beta", "experimental", "deprecated"];
const ver = (v) => v.split(".").map(Number);
/** A brick merged since the last release: `since` is newer than package.json's version and the CHANGELOG has an Unreleased section. */
const coming = (v) => {
  const [a, b] = [ver(v), ver(pkg.version)];
  const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return newer > 0 && readFileSync("CHANGELOG.md", "utf8").includes("## Unreleased");
};

test("every brick carries a known flag, the release it shipped in and its tests", () => {
  for (const b of BRICKS) {
    assert.ok(SHIPPED.includes(b.status), `${b.id}: status "${b.status}" (a shipped brick can't be roadmap)`);
    assert.match(b.since, /^\d+\.\d+\.\d+$/, `${b.id}: since`);
    assert.ok(readFileSync("CHANGELOG.md", "utf8").includes(`## ${b.since}`) || coming(b.since), `${b.id}: ${b.since} is not a CHANGELOG release (or the coming one)`);
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
  const exported = Object.keys(pkg.exports).map((k) => (k === "." ? "@fzlt/core" : `@fzlt/core/${k.slice(2)}`));
  const known = new Set([...exported, ...PLANNED.map((p) => p.name)]);
  for (const p of PLANNED) {
    assert.ok(!exported.includes(p.name), `${p.name} is in package.json: give it a status in BRICKS`);
    assert.match(p.phase, /^E(9|1[0-6])$/, `${p.name}: phase`);
    assert.ok(p.purpose && p.target > 0, `${p.name}: purpose and size target`);
    for (const n of p.needs) assert.ok(known.has(n), `${p.name} needs ${n}, which is neither shipped nor planned`);
  }
});

test("the README table shows each brick's flag, and the beta line", () => {
  const rows = readme.split("\n").filter((l) => /^\| `@fzlt\/core/.test(l));
  for (const b of BRICKS)
    for (const m of b.modules) {
      const row = rows.find((r) => r.split(" | ")[0].split(/[`]/).includes(m.name));
      assert.ok(row, `README: no row for ${m.name}`);
      assert.equal(row.split(" | ")[1], STATUS[b.status].label, `README: ${m.name} is ${STATUS[b.status].label} in site/bricks.mjs`);
    }
  assert.ok(readme.replace(/\n> /g, " ").includes(BETA_LINE), "README: the beta line, word for word");
});

test("readmeSizes: rewrites the size column and the kernel bytes from measured sizes (a release step, not a PR gate)", () => {
  const md = [
    "9. **Budgets in CI.** Kernel ≤ 4 KB gzip (measured: 1,000 bytes); each brick",
    "| `@fzlt/core` / `@fzlt/core/kernel` | COMPLETE | createEngine | 0.1 KB |",
    "| `@fzlt/core/fx` | COMPLETE | effects | 9.9 KB (old) |",
    "| `@fzlt/core/arcade` | COMPLETE | the shell | old |",
    "| `@fzlt/core/ui` + `@fzlt/core/ui/board-ui.css` | COMPLETE | Board UI | old |",
    "| `@fzlt/core/ui/tokens.json` | COMPLETE | tokens | data |",
  ].join("\n");
  const sizes = Object.entries({ "@fzlt/core (kernel)": 3439, "@fzlt/core/fx": 2797, "@fzlt/core/arcade": 21970, "@fzlt/core/arcade (hud omitted)": 17964, "@fzlt/core/ui (js)": 2884, "@fzlt/core/ui (css)": 4884 }).map(([name, gzip]) => ({ name, gzip }));
  const out = readmeSizes(md, sizes).split("\n");
  assert.match(out[0], /\(measured: 3,439 bytes\)/);
  assert.match(out[1], /\| 3\.4 KB \|$/);
  assert.match(out[2], /\| 2\.7 KB \(`emitter`/);
  assert.match(out[3], /\| 17\.5 KB for a card game.*; 21\.5 KB with `skirmishHud`/);
  assert.match(out[4], /\| 2\.8 KB \+ 4\.8 KB css \|$/);
  assert.equal(out[5], md.split("\n")[5], "tokens.json has no size of its own");
  assert.equal(readmeSizes(out.join("\n"), sizes), out.join("\n"), "idempotent");
  assert.throws(() => readmeSizes("| `@fzlt/core/nope` | BETA | x | 1 KB |", sizes), /no known module/);
});
