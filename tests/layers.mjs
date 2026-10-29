// Browser test for the layers story (site/demos/layers): it mounts through fizlet/slot, runs one
// full cycle (open, fault, scan, patch, fold), settles (no requestAnimationFrame at all), Recall
// gives the page back byte for byte, and reduced motion keeps the still exploded poster.
// Run: node tests/layers.mjs (set CHROMIUM_PATH to use a preinstalled Chromium).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

const OUT = "site-dist/test-layers";
execFileSync(process.execPath, ["site/demos/layers/build.mjs", OUT], { stdio: "inherit" });
const html = readFileSync(`${OUT}/index.html`, "utf8");
const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mountSlot } from "./site/demos/layers/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "L", write: false, logLevel: "silent",
})).outputFiles[0].text;
// The built page, with the test's own script (keeps the slot handle) in place of entry.js.
const PAGE = html
  .replace('<link rel="stylesheet" href="board-ui.css">', `<style>${readFileSync("src/ui/board-ui.css", "utf8")}</style>`)
  .replace('<figure class=', '<figure data-loops="1" data-speed="4" data-settle="0.3" class=')
  .replace('<script type="module" src="entry.js"></script>', `<script>${bundle}
(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.frames_ = 0;
  window.requestAnimationFrame = (cb) => raf((t) => (window.frames_++, cb(t)));
  window.states = [];
  window.before = document.body.innerHTML;
  window.handle = L.slot(document.querySelector("figure.lyr"), () => L.mountSlot, { idle: 0 });
  new MutationObserver(() => {
    const s = document.querySelector('[data-layer="collision"] .lz-tag')?.dataset.state;
    if (s != null && window.states[window.states.length - 1] !== s) window.states.push(s);
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
})();
</script>`);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✖ ${name}\n${e.stack}`);
  }
}

await test("mounts, cycles once, settles, Recall is exact", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.setContent(PAGE);
  await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 10000 });
  const m = await page.evaluate(() => ({
    layers: [...document.querySelectorAll("[data-layer]")].map((l) => l.dataset.layer),
    hidden: document.querySelector("[data-fizlet-slot]").getAttribute("aria-hidden"),
    label: document.querySelector("figure.lyr").getAttribute("aria-label"),
    role: document.querySelector("figure.lyr").getAttribute("role"),
  }));
  assert.deepEqual(m.layers, ["grid", "characters", "movement", "collision", "rules", "fx", "input", "hud"]);
  assert.equal(m.hidden, "true");
  // The Board UI kit styles it: the fire key is the kit's arcade key in the fire colour.
  const fire = await page.evaluate(() => getComputedStyle(document.querySelector(".lz-fire")).backgroundColor);
  assert.equal(fire, "rgb(255, 43, 78)");
  assert.equal(m.role, "img");
  assert.match(m.label, /fans out into its eight stacked layers.*collision layer turns red.*folds back/);
  // One cycle at 4× speed is 3.25 s; then 0.3 s of quiet and the kernel settles.
  await page.waitForFunction(() => window.handle.mounted && window.states.includes("PATCHED"), null, { timeout: 8000 });
  await page.waitForTimeout(13000 / 4 + 600);
  const states = await page.evaluate(() => window.states);
  assert.deepEqual(states.filter(Boolean), ["FAULT", "SCANNING", "PATCHED"]);
  const pose = await page.evaluate(() => document.querySelector(".lz-s").style.transform);
  assert.match(pose, /rotateX\(0deg\)/, "rests in game mode");
  const f0 = await page.evaluate(() => window.frames_);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => window.frames_), f0, "settled: no frames");
  // Recall.
  // The parser adds the trailing whitespace after this script ran, so compare trimmed.
  const same = await page.evaluate(() => (window.handle.destroy(), document.body.innerHTML.trimEnd() === window.before.trimEnd()));
  assert.ok(same, "destroy() gives the page back exactly");
  assert.deepEqual(errs, []);
  await page.close();
});

await test("reduced motion: the scene never loads; the still exploded view shows every label", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.setContent(PAGE);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({
    stage: !!document.querySelector("[data-fizlet-slot]"),
    labels: [...document.querySelectorAll(".lyr__t")].filter((t) => getComputedStyle(t).display !== "none").map((t) => t.textContent),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.equal(r.stage, false);
  assert.equal(r.labels.length, 8);
  assert.match(r.labels[0], /^Board: grid · 630 B gz$/);
  assert.equal(r.overflow, false);
  await page.close();
});

await browser.close();
if (failed) process.exit(1);
