// @fzlt/core/math in real browsers: Chromium, and WebKit when it is installed (`npx playwright install
// webkit`; MATH_ENGINES=chromium,webkit makes a missing one fail; CI's webkit job runs it with webkit). The page runs the same seeded vectors
// as tests/math.test.mjs and must give the committed digests and exact table bit for bit: the point
// of the brick is that WebKit, whose builtins call the system's libm, agrees with V8. It also prints
// whether that engine's builtins agree (information only: they need not). A seeded @fzlt/core/steer
// run must end on the same bits as in Node (its step's trig is the brick's).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { DIGESTS, TABLE, steerDigest } from "./math-vectors.mjs";


const bundle = (await build({
  stdin: { contents: 'export * as m from "./src/math.ts"; export { digests, bits, steerDigest } from "./tests/math-vectors.mjs"; export { steer } from "./src/steer.ts"; export { seeded } from "./src/kernel/random.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;
const PAGE = `<!doctype html><meta charset="utf-8"><script>${bundle}</script>`;
// The same bundle in Node: the steer run every browser must match.
const node = await import(`data:text/javascript,${encodeURIComponent(bundle.replace(/^var fz\s*=/, "export const fz ="))}`);
const STEER = steerDigest(node.fz.steer, node.fz.seeded);

const want = (process.env.MATH_ENGINES ?? "").split(",").filter(Boolean);
const engines = [["chromium", () => chromium.launch(launchOptions())], ["webkit", () => webkit.launch()]];
let ran = 0;
for (const [name, launch] of engines) {
  let browser;
  try {
    browser = await launch();
  } catch (err) {
    if (want.includes(name)) throw err;
    console.log(`math-engines: ${name} not installed, skipped`);
    continue;
  }
  try {
    const page = await browser.newPage();
    await page.setContent(PAGE);
    const got = await page.evaluate((table) => {
      const { m, digests, bits, steerDigest, steer, seeded } = window.fz;
      const B = { sin: Math.sin, cos: Math.cos, atan2: Math.atan2, hypot: Math.hypot };
      return {
        digests: digests(m, 20000),
        builtins: digests(B, 20000),
        table: table.map(([f, args]) => bits(m[f](...args))),
        steer: steerDigest(steer, seeded),
      };
    }, TABLE);
    assert.deepEqual(got.digests, DIGESTS, `${name}: @fzlt/core/math's digests`);
    assert.deepEqual(got.table, TABLE.map((r) => r[2]), `${name}: the exact table`);
    assert.equal(got.steer, STEER, `${name}: a seeded steer run (1,200 frames, 4 movers) ends on Node's bits`);
    const same = Object.keys(DIGESTS).filter((k) => got.builtins[k] === DIGESTS[k]);
    console.log(`math-engines: ${name} ok (${Object.keys(DIGESTS).length} digests, ${TABLE.length} exact values, a steer run); its builtins agree on: ${same.join(", ") || "none"}`);
    ran++;
  } finally {
    await browser.close();
  }
}
assert.ok(ran > 0, "no browser ran");
