// The built package keeps its public documentation and nothing else: every brick's .d.ts carries the
// TSDoc blocks of its exports (editors show them), the JS keeps the bundler annotations consumers'
// tree-shaking reads, and no other comment survives in dist/ (scripts/build.mjs strips them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAnnotation, isDocBlock, scanComments } from "../scripts/comments.mjs";

if (!existsSync("dist/index.js")) execFileSync("node", ["scripts/build.mjs"], { stdio: "inherit" });
const files = readdirSync("dist", { recursive: true }).map((f) => join("dist", String(f)));

test("a brick's built .d.ts keeps the doc comments of its exports", () => {
  const grid = readFileSync("dist/grid.d.ts", "utf8");
  assert.match(grid, /\/\*\*[^]*?cols × rows[^]*?\*\/\s*export declare const board/, "board's doc comment, right above it");
  const kernel = readFileSync("dist/index.d.ts", "utf8") + readFileSync("dist/kernel/engine.d.ts", "utf8");
  assert.match(kernel, /\/\*\*[^]*?\*\/\s*export declare function createEngine/, "createEngine's doc comment");
});

test("no `//` comment and no internal block comment survives anywhere in dist/", () => {
  const bad = [];
  for (const f of files.filter((f) => /\.(js|d\.ts)$/.test(f))) {
    const keep = f.endsWith(".d.ts") ? isDocBlock : isAnnotation;
    for (const c of scanComments(readFileSync(f, "utf8"))) if (!keep(c.text)) bad.push(`${f}:${c.line}: ${c.text.slice(0, 50)}`);
  }
  assert.deepEqual(bad, []);
});

test("the JS keeps its bundler annotations, and only those", () => {
  let pure = 0;
  for (const f of files.filter((f) => f.endsWith(".js"))) {
    const cs = scanComments(readFileSync(f, "utf8"));
    for (const c of cs) assert.ok(isAnnotation(c.text), `${f}:${c.line}: ${c.text}`);
    pure += cs.length;
  }
  assert.ok(pure > 0, "esbuild's /* @__PURE__ */ annotations are kept");
});
