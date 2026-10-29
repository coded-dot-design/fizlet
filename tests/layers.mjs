// Browser test for the layers story (site/demos/layers): it mounts through fizlet/slot, runs one
// full cycle (open, fault, scan, patch, fold), settles (no requestAnimationFrame at all), Recall
// gives the page back byte for byte (controls included), reduced motion keeps the still exploded
// poster, the inline loader fetches no JS until the slot nears the viewport, and the controls (play
// key, 3D slider) work by keyboard and pointer, with and without the scene.
// Run: node tests/layers.mjs (set CHROMIUM_PATH to use a preinstalled Chromium).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { serve } from "../site/demos/layers/serve.mjs";

const OUT = "site-dist/test-layers";
execFileSync(process.execPath, ["site/demos/layers/build.mjs", OUT], { stdio: "inherit" });
const html = readFileSync(`${OUT}/index.html`, "utf8");
const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mountSlot } from "./site/demos/layers/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "L", write: false, logLevel: "silent",
})).outputFiles[0].text;
// The built page. Its inline script stays (the controls' controller) but does not import the chunk:
// the test's own script mounts the scene through fizlet/slot and keeps the handle.
const PAGE = html
  .replace('import("./layers.js")', "0")
  .replace('<link rel="stylesheet" href="board-ui.css">', `<style>${readFileSync("src/ui/board-ui.css", "utf8")}</style>`)
  .replace('<figure class=', '<figure data-loops="1" data-speed="4" data-settle="0.3" class=')
  .replace("</body>", () => `<script>${bundle}
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
</script></body>`);

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
    desc: document.getElementById(document.querySelector("figure.lyr").getAttribute("aria-describedby")).textContent,
  }));
  assert.deepEqual(m.layers, ["grid", "characters", "movement", "collision", "rules", "fx", "input", "hud"]);
  assert.equal(m.hidden, "true");
  // The Board UI kit styles it: the fire key is the kit's arcade key in the fire colour.
  const fire = await page.evaluate(() => getComputedStyle(document.querySelector(".lz-fire")).backgroundColor);
  assert.equal(fire, "rgb(255, 43, 78)");
  assert.equal(m.label, "The layers story");
  assert.match(m.desc, /fans out into its eight stacked layers.*collision layer turns red.*folds back/);
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
  const [now, was] = await page.evaluate(() => (window.handle.destroy(), [document.body.innerHTML.trimEnd(), window.before.trimEnd()]));
  if (now !== was) { let i = 0; while (now[i] === was[i]) i++; console.log("DIFF at", i, JSON.stringify(was.slice(i - 60, i + 80)), "\nnow", JSON.stringify(now.slice(i - 60, i + 80))); }
  assert.ok(now === was, "destroy() gives the page back exactly");
  assert.deepEqual(errs, []);
  await page.close();
});

// Label geometry over one whole cycle: every visible label faces the screen (not smeared into its
// layer's plane), sits inside the figure and overlaps no other label. The page's own CSS (its `.k`
// kicker) stays in, so a host class that matches a scene state class shows up here.
for (const [w, h] of [[390, 844], [1440, 900]])
  await test(`labels never overlap, clip or smear over a cycle (${w}px)`, async () => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(PAGE);
    await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 10000 });
    const bad = new Set();
    let seen = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 13000 / 4 + 300) {
      const r = await page.evaluate(() => {
        const f = document.querySelector("figure.lyr").getBoundingClientRect();
        const vis = [...document.querySelectorAll(".lz-tag")].filter((t) => +getComputedStyle(t).opacity > 0.05)
          .map((t) => ({ n: t.parentElement.dataset.layer, r: t.getBoundingClientRect() }));
        const out = [];
        for (const { n, r } of vis) {
          if (r.height < 14) out.push(`${n} smeared (${r.height.toFixed(1)}px tall)`);
          if (r.left < f.left - 0.5 || r.right > f.right + 0.5 || r.top < f.top - 0.5 || r.bottom > f.bottom + 0.5) out.push(`${n} outside the figure`);
        }
        for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
          const a = vis[i].r, b = vis[j].r;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) out.push(`${vis[i].n}/${vis[j].n} overlap`);
        }
        return { n: vis.length, out };
      });
      seen = Math.max(seen, r.n);
      for (const o of r.out) bad.add(o);
      await page.waitForTimeout(80);
    }
    assert.equal(seen, 8, "all 8 labels show during the cycle");
    assert.deepEqual([...bad], []);
    await page.close();
  });

// The controls with the scene: pause settles it, the slider scrubs the explode/assemble timeline by
// keyboard and pointer (and pauses), play resumes, focus is visible, and Recall restores the
// controls exactly (the scene writes them only through its ledger).
await test("controls: pause settles, slider scrubs (keys, pointer), play resumes, Recall exact", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE.replace('data-loops="1"', 'data-loops="9"'));
  await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 10000 });
  const s = page.locator("[role=slider]"), b = page.locator(".lyr__play");
  const now = () => s.getAttribute("aria-valuenow");
  const pose = () => page.evaluate(() => document.querySelector(".lz-s").style.transform);
  const frames = () => page.evaluate(() => window.frames_);
  assert.equal(await b.getAttribute("aria-label"), "Pause");
  await b.click();
  await page.waitForFunction(() => document.querySelector(".lyr__play").ariaLabel === "Play");
  await page.waitForTimeout(900);
  let f0 = await frames();
  await page.waitForTimeout(700);
  assert.equal(await frames(), f0, "paused: settled, no frames");
  // Keyboard: End explodes it fully (labels in), arrows step 5, Home assembles it.
  await s.focus();
  await page.keyboard.press("End");
  await page.waitForFunction(() => document.querySelector("[role=slider]").ariaValueNow === "100");
  await page.waitForTimeout(150);
  assert.match(await pose(), /rotateX\(56deg\)/, "End: exploded");
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".lz-tag")].every((t) => +t.style.opacity > 0.99)), "fully open: every label shows");
  const ring = await page.evaluate(() => getComputedStyle(document.querySelector(".lyr__k")).boxShadow);
  assert.match(ring, /rgb\(25, 240, 255\)/, "keyboard focus: the kit's sys ring on the knob");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("[role=slider]").ariaValueNow === "90");
  await page.keyboard.press("Home");
  await page.waitForFunction(() => document.querySelector("[role=slider]").ariaValueNow === "0");
  await page.waitForTimeout(150);
  assert.match(await pose(), /rotateX\(0deg\)/, "Home: assembled");
  assert.equal(await b.getAttribute("aria-label"), "Play", "scrubbing keeps it paused");
  // Pointer: press near the top of the (vertical) track, then drag to the middle.
  const box = await s.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 14);
  await page.mouse.down();
  await page.waitForFunction(() => +document.querySelector("[role=slider]").ariaValueNow >= 98);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(document.querySelector("[role=slider]").ariaValueNow - 50) <= 3);
  // Play resumes: frames run, the key reads Pause, the slider follows the story.
  await b.click();
  await page.waitForFunction(() => document.querySelector(".lyr__play").ariaLabel === "Pause");
  f0 = await frames();
  await page.waitForTimeout(400);
  assert.ok((await frames()) > f0 + 5, "playing: frames run");
  // Recall: the controls come back exactly as the page had them.
  const same = await page.evaluate(() => (window.handle.destroy(), document.body.innerHTML.trimEnd() === window.before.trimEnd()));
  assert.ok(same, "destroy() gives the page back exactly, controls included");
  assert.equal(await now(), "0");
  assert.deepEqual(errs, []);
  await page.close();
});

// Reduced motion: no scene, no play key, the still exploded view; the slider still scrubs it (CSS).
await test("reduced motion: the slider still scrubs the still view (keys, pointer)", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.setContent(PAGE);
  await page.waitForTimeout(300);
  const s = page.locator("[role=slider]");
  const look = () => page.evaluate(() => ({
    v: document.querySelector("[role=slider]").ariaValueNow,
    shown: [...document.querySelectorAll(".lyr__t")].filter((t) => +getComputedStyle(t).opacity > 0.99).length,
    flat: !getComputedStyle(document.querySelector(".lyr__s")).transform.startsWith("matrix3d"),
    stage: !!document.querySelector("[data-fizlet-slot]"),
    play: getComputedStyle(document.querySelector(".lyr__play")).display,
  }));
  let r = await look();
  assert.deepEqual([r.v, r.shown, r.flat, r.stage, r.play], ["100", 8, false, false, "none"]);
  assert.equal(await s.getAttribute("aria-orientation"), "horizontal", "portrait: the slider runs along the bottom");
  await s.focus();
  await page.keyboard.press("ArrowLeft");
  r = await look();
  assert.deepEqual([r.v, r.shown], ["95", 0], "not fully open: labels out");
  await page.keyboard.press("Home");
  r = await look();
  assert.deepEqual([r.v, r.flat], ["0", true], "Home: the flat board");
  const box = await s.boundingBox(); // portrait: horizontal, along the bottom
  await page.mouse.click(box.x + box.width - 10, box.y + box.height / 2);
  r = await look();
  assert.deepEqual([r.v, r.shown], ["100", 8], "pointer at the end: exploded, labels in");
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

await test("the inline loader: no JS until the slot is near; then the live chunk mounts", async () => {
  const srv = await serve(OUT);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const js = [];
    page.on("request", (r) => r.url().endsWith(".js") && js.push(r.url().split("/").pop()));
    await page.route(srv.url, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: (await res.text()).replace("<main>", '<main><div style="height:5000px"></div>') });
    });
    await page.goto(srv.url);
    await page.waitForTimeout(1500);
    assert.deepEqual(js, [], "no JS while the slot is far");
    await page.evaluate(() => document.querySelector("figure.lyr").scrollIntoView());
    await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 10000 });
    assert.deepEqual(js, ["layers.js"]);
    await page.close();
    const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const js2 = [];
    rm.on("request", (r) => r.url().endsWith(".js") && js2.push(r.url()));
    await rm.goto(srv.url);
    await rm.waitForTimeout(1500);
    assert.deepEqual(js2, [], "reduced motion: nothing loads");
    await rm.close();
  } finally {
    srv.close();
  }
});

await test("hero budgets (fizlet-engine docs/LAYERS.md): live chunk ≥ 5% under 10 KB, poster ≤ 6 KB gzip", async () => {
  const sizes = JSON.parse(readFileSync(`${OUT}/sizes.json`, "utf8"));
  assert.ok(sizes.live <= 10240 * 0.95, `live chunk ${sizes.live} B gzip (≥ 5% under 10 KB: ≤ 9,728)`);
  assert.ok(sizes.poster <= 6144, `inline poster + loader ${sizes.poster} B gzip`);
});

await browser.close();
if (failed) process.exit(1);
