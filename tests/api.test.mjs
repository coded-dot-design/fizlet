// The website's brick pages are generated from the source: this checks the
// generator's inputs. The catalog covers every public module in package.json, each page's API lists every
// runtime export of its module and every export has a doc comment, and signatures come from the compiler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { api, declarations, leadComment, undocumented } from "../scripts/api.mjs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS, STATUS } from "../scripts/bricks.mjs";

// The declarations come from the build (npm run check builds after the tests).
if (!existsSync("dist/index.d.ts")) execFileSync("node", ["scripts/build.mjs"], { stdio: "inherit" });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("the catalog covers every public module in package.json, once", () => {
  const listed = BRICKS.flatMap((b) => b.modules.map((m) => m.name));
  assert.equal(new Set(listed).size, listed.length, "a module is listed twice");
  const exported = Object.keys(pkg.exports)
    .filter((k) => !/\.(css|json)$/.test(k) && k !== "./kernel")
    .map((k) => (k === "." ? "@fzlt/core" : `@fzlt/core/${k.slice(2)}`));
  assert.deepEqual([...listed].sort(), exported.sort());
  for (const b of BRICKS) for (const m of b.modules) assert.ok(existsSync(m.src) && existsSync(m.dts), `${m.name}: ${m.src}, ${m.dts}`);
});

test("each brick's API lists every runtime export of its module, with a summary", async () => {
  for (const b of BRICKS)
    for (const m of b.modules) {
      const { summary, decls } = api(m);
      assert.ok(summary.length > 40, `${m.name}: a leading comment in ${m.src}`);
      const names = new Set(decls.flatMap((d) => d.names));
      const runtime = Object.keys(await import(`../${m.src}`));
      for (const n of runtime) assert.ok(names.has(n), `${m.name}: ${n} is exported but not on its page`);
      for (const d of decls) {
        assert.ok(d.code.startsWith("export "), `${m.name}.${d.name}: ${d.code.slice(0, 40)}`);
        assert.doesNotMatch(d.code, /^\s+private /m, `${m.name}.${d.name}: private members are not API`);
      }
    }
});

test("every public export has a doc comment", () => {
  const mods = BRICKS.flatMap((b) => b.modules.map((m) => ({ ...m, ...api(m) })));
  assert.deepEqual(undocumented(mods), [], "add a /** doc comment */ to each of these in src/ (it reaches the brick page and llms-full.txt)");
  // The gate itself: a declaration file with undocumented exports fails it, and a module's leading
  // comment does not count as the doc of the export right below it.
  const decls = declarations("tests/fixtures/api/mixed.d.ts", { lead: "A module's leading comment: its summary, not the doc of the first export below it." });
  assert.deepEqual(undocumented([{ name: "mixed", decls }]), ["mixed: FirstOptions", "mixed: bare"]);
});

test("declarations: signatures, parameters and return types from the compiler", () => {
  const fx = declarations("tests/fixtures/api/mixed.d.ts");
  const one = fx.find((d) => d.name === "one");
  assert.equal(one.sigs[0].text, "one(n: number, o?: FirstOptions): number");
  assert.deepEqual(one.sigs[0].params.map((p) => [p.name, p.type, p.optional, p.doc]), [["n", "number", false, "how many"], ["o", "FirstOptions", true, ""]]);
  assert.deepEqual(one.tags, [{ name: "deprecated", text: "Use `two()`." }]);
  assert.equal(fx.find((d) => d.name === "bare").sigs[0].text, "bare(...xs: string[]): void");
  assert.deepEqual(fx.find((d) => d.name === "A").names, ["A", "B"]);
  const kernel = declarations("dist/index.d.ts");
  // An inline object return type reads as its exported alias (type Engine = ReturnType<typeof createEngine>).
  assert.equal(kernel.find((d) => d.name === "createEngine").sigs[0].text, "createEngine(o?: EngineOptions): Engine");
  assert.equal(kernel.find((d) => d.name === "Pool").sigs[0].text, "new Pool<T>(cap: number, create: () => T): Pool<T>");
  // A const holding a function gets its signature.
  assert.equal(declarations("dist/grid.d.ts").find((d) => d.name === "board").sigs[0].text, "board(cols: number, rows: number, opts?: BoardOptions): Board");
});

test("declarations: re-exports, multi-name consts, doc comments", () => {
  const kernel = declarations("dist/index.d.ts");
  const names = kernel.flatMap((d) => d.names);
  for (const n of ["createEngine", "Ledger", "Pool", "EventRing", "seeded", "IDLE", "RENDER", "Engine", "System"]) assert.ok(names.includes(n), n);
  assert.deepEqual(declarations("dist/grid.d.ts").find((d) => d.name === "BLOCKED").names, ["BLOCKED", "COVER", "OCCUPIED"]);
  assert.match(declarations("dist/grid.d.ts").find((d) => d.name === "board").doc, /cols × rows/);
  assert.match(leadComment("src/presence.ts"), /^@fzlt\/core\/presence: lockstep/); // `//` comments too
});
