// The page profile (fizlet-engine docs/LAYERS.md, "Page interactions"): the page build stays inside its
// budget and pulls in no game-only brick. Kernel settle and fps cap: tests/kernel.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { BUDGETS } from "../scripts/sizes.mjs";

const HERO_CHUNK = 10240, SCENE_MIN = 3072; // LAYERS.md: live chunk ≤ 10 KB gz; leave the scene ≥ 3 KB

test("page build: only kernel, slot, input and fx; inside the hero budget", async () => {
  const res = await build({ entryPoints: ["scripts/page-build.ts"], bundle: true, minify: true, write: false, format: "esm", target: "es2022", metafile: true, logLevel: "silent" });
  const inputs = Object.keys(res.metafile.inputs).filter((p) => p.startsWith("src/")).sort();
  const banned = inputs.filter((p) => /src\/(sound|debug|pad|hud|match|board-page|presence|embed|grid|sprite|ui\/)/.test(p));
  assert.deepEqual(banned, [], "no game-only brick in the page build");
  assert.deepEqual(inputs.filter((p) => !p.startsWith("src/kernel/")), ["src/fx.ts", "src/input.ts", "src/slot.ts"]);
  const gz = gzipSync(res.outputFiles[0].contents).length, budget = BUDGETS.find(([, entry]) => entry === "scripts/page-build.ts")[2];
  assert.ok(gz <= budget, `page build ${gz} B gz > budget ${budget}`);
  assert.ok(budget <= HERO_CHUNK - SCENE_MIN, `budget ${budget} leaves the scene under ${SCENE_MIN} B of a ${HERO_CHUNK} B hero chunk`);
});
