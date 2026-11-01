// Fizlet's TypeScript is erasable: games vendor src/ and typecheck it with `erasableSyntaxOnly` (byte-runner,
// null-invaders, sherman-bytes), so a const enum, an enum, a namespace or a parameter property would break
// their build after a sync. tsconfig.json sets the flag for `npm run typecheck`; this test checks every
// file with Node's own type stripper, which refuses the same syntax.
import test from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const files = readdirSync("src", { recursive: true }).map(String).filter((f) => f.endsWith(".ts")).map((f) => join("src", f));

test("src/ is erasable TypeScript (no enum, const enum, namespace or parameter property)", () => {
  assert.ok(files.length > 20, "found the sources");
  const bad = [];
  for (const f of files) {
    try {
      stripTypeScriptTypes(readFileSync(f, "utf8"), { mode: "strip" });
    } catch (err) {
      bad.push(`${f}: ${err.message.split("\n")[0]}`);
    }
  }
  assert.deepEqual(bad, [], "non-erasable syntax in src/");
});

test("the erasable check does catch a const enum, an enum and a parameter property", () => {
  for (const code of ["const enum P { A }", "enum E { A }", "class C { constructor(private x: number) {} }"])
    assert.throws(() => stripTypeScriptTypes(code, { mode: "strip" }), /TypeScript|syntax/i, code);
});
