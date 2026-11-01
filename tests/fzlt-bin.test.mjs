// The `fzlt` bin (bin/fzlt.mjs, `npx @fzlt/core`): it prints the version from package.json and every
// measured entry of dist/sizes.json, `--json` parses, and it imports nothing but node: built-ins.
// It runs from a copy of the package layout (bin/, package.json, dist/sizes.json measured here the
// way scripts/build.mjs writes it), so the test needs no build. scripts/pack-smoke.mjs runs it from
// the packed tarball, installed and through npx.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUDGETS, measure, sizesJson } from "../scripts/sizes.mjs";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const binFile = new URL(pkg.bin.fzlt, root);

test("package.json ships the fzlt bin, outside the bricks", () => {
  assert.deepEqual(pkg.bin, { fzlt: "bin/fzlt.mjs" });
  assert.ok(pkg.files.includes("bin"));
  const targets = JSON.stringify(pkg.exports);
  assert.ok(!targets.includes("bin/") && !targets.includes("sizes.json"), "the bin and its data are not exports");
  assert.ok(!BUDGETS.some(([, entry]) => entry.startsWith("bin/")), "the bin has no size budget");
  assert.ok(pkg.description.startsWith("Fizlet™ (fzlt™) "));
  for (const k of ["fzlt", "fizlet"]) assert.ok(pkg.keywords.includes(k));
});

test("the bin imports only node: built-ins and starts with a shebang", () => {
  const src = readFileSync(binFile, "utf8");
  assert.ok(src.startsWith("#!/usr/bin/env node\n"));
  const specs = [...src.matchAll(/\bimport\s*(?:[^"'();]*?\bfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  assert.ok(specs.length > 0);
  assert.deepEqual(specs.filter((s) => !s.startsWith("node:")), []);
});

test("the bin prints the version and every measured entry; --json parses", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fzlt-bin-"));
  try {
    mkdirSync(join(dir, "bin"));
    mkdirSync(join(dir, "dist"));
    cpSync(binFile, join(dir, "bin/fzlt.mjs"));
    cpSync(new URL("package.json", root), join(dir, "package.json"));
    const sizes = sizesJson(await measure(), pkg.version);
    writeFileSync(join(dir, "dist/sizes.json"), JSON.stringify(sizes));
    const run = (...args) => execFileSync(process.execPath, [join(dir, "bin/fzlt.mjs"), ...args], { encoding: "utf8" });

    const text = run();
    const [first] = text.split("\n");
    assert.match(first, /^Fizlet™ \(fzlt™\)/);
    assert.ok(text.includes(`version  ${pkg.version}`));
    assert.ok(text.includes("npm i @fzlt/core"));
    assert.ok(text.includes("https://fizlet.com"));
    for (const e of sizes.entries) {
      const row = text.split("\n").find((l) => l.startsWith(e.name + " "));
      assert.ok(row, `no row for ${e.name}`);
      assert.ok(row.includes(e.gzip.toLocaleString("en-US")) && row.includes(e.budget.toLocaleString("en-US")), row);
    }

    const json = JSON.parse(run("--json"));
    assert.equal(json.name, pkg.name);
    assert.equal(json.version, pkg.version);
    assert.deepEqual(json.sizes, sizes.entries);
    assert.equal(run("--version").trim(), pkg.version);

    // Without the measured file (a broken install) it still prints the version, and no numbers.
    rmSync(join(dir, "dist/sizes.json"));
    const bare = run();
    assert.ok(bare.includes(pkg.version) && !/\bgz\b/.test(bare));
    assert.deepEqual(JSON.parse(run("--json")).sizes, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
