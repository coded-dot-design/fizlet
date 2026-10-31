// The three hand-built Halloween ghost pieces (site/gallery/pieces/ghosts/) in Chromium, each on its
// own stage (site/gallery/stages/<id>.html), mounted through fzlt/slot as the gallery does: it
// plays its intro, a tap has its consequence (Smoosh: goo slimes the letters it hits and they
// drip clean; Wrangle: a latched ghost dragged into the bucket is bagged; Overflow: stuffed past
// its limit, the bucket blows and the page's own LEAKS counter goes up), the page's own elements move
// only when something reaches them, it sleeps off screen mid-play, it settles to no frames with the
// page back in place (Overflow: all but its counter), Recall mid-play gives the page back byte for
// byte, and reduced motion keeps the still poster (the scene never mounts). Every wait is on the
// scene's frames or state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { smoosh } from "./site/gallery/pieces/ghosts/smoosh.ts"; export { wrangle } from "./site/gallery/pieces/ghosts/wrangle.ts"; export { overflow } from "./site/gallery/pieces/ghosts/overflow.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "hg", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p><div style="height:3000px"></div></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, and fails only after the scene has
// drawn `frames` frames without it (or, if it stops drawing, after 15 s with no new frame).
const until = (p, cond, arg, frames, what) => p.evaluate(async ({ cond, arg, frames, what }) => {
  const ok = new Function("arg", `return (${cond})(arg)`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok(arg)) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), arg, frames, what });

/** Settled: no frames, and every element it moved back as it was (style text compared as the browser
 *  reads it; Recall checks the bytes). `skip`: a selector whose text the scene keeps (a counter). */
const settledInPlace = (p, skip) => p.evaluate(async (skip) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
  const norm = (root) => {
    root.querySelector("[data-fizlet-slot]")?.remove();
    root.querySelector(".ae-slot__placeholder")?.removeAttribute("style"); // the slot's own: poster hidden
    if (skip) for (const e of root.querySelectorAll(skip)) (e.textContent = ""), e.parentElement.closest("[data-leak]")?.removeAttribute("data-leak");
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return { more: scene.engine.stats().frames - a, same: norm(document.querySelector("figure").cloneNode(true)) === norm(was) };
}, skip);

async function open(id, make) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(id));
  // Same run every time: each scene seeds its engine (every roll) from Math.random once, at mount.
  await p.evaluate(() => {
    let s = 0x2f6b1d3;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await p.evaluate((make) => {
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = hg.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = hg[make](stage, el, first)), { idle: 0 });
  }, make);
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({
    canvas: !!document.querySelector("[data-fizlet-slot] canvas[aria-hidden='true']"),
    poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
  }));
  assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas over the stage; the poster steps aside`);
  return { p, errs };
}
/** A tap at art pixel (x, y) of the 160 × 90 grid, through the real pointer. */
const tapAt = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  await p.mouse.click(b.x + (x / 160) * b.width, b.y + (y / 90) * b.height);
};
/** Scrolled away mid-play, it sleeps (no frames at all); back on screen, it plays on. */
async function offscreen(p, id) {
  await p.evaluate(() => window.scrollTo(0, 2500));
  await p.waitForFunction(() => scene.engine.paused.includes("offscreen"), null, { timeout: 15000 });
  const away = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    return scene.engine.stats().frames - a;
  });
  assert.equal(away, 0, `${id}: off screen, no frames`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForFunction(() => !scene.engine.paused.includes("offscreen"), null, { timeout: 15000 });
}
async function recall(p, errs, id) {
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, `${id}: Recall mid-play restores the page byte for byte`);
  assert.deepEqual(errs, [], `${id}: no page errors`);
  await p.close();
}
async function reducedMotion(id, make) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(id));
  const rm = await q.evaluate(async (make) => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = hg.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, hg[make](stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth === 160 };
  }, make);
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster drawn from the scene`);
  await ctx.close();
}

try {
  // Smoosh: the intro dive slimes letters (only the ones its goo hits), they drip clean, he slurps
  // the puddle and floats still. A tap on him: BOING (he bounces off the page, sliming what he hits).
  {
    const id = "slime-ghost-smooshes-screen", { p, errs } = await open(id, "smoosh");
    await until(p, () => document.querySelectorAll(".sg i[data-slimed]").length >= 3, null, 600, `${id}: goo slimes letters`);
    await offscreen(p, id);
    const some = await p.evaluate(() => [...document.querySelectorAll(".sg i")].filter((e) => !e.hasAttribute("data-slimed")).length);
    assert.ok(some > 0, `${id}: only what the goo hits is slimed`);
    await until(p, () => scene.engine.paused.includes("settled"), null, 3000, `${id}: drips, slurps, settles`);
    assert.deepEqual(await settledInPlace(p), { more: 0, same: true }, `${id}: settled, no frames, the page spotless again`);
    await p.evaluate(() => scene.engine.wake());
    await tapAt(p, ...(await p.evaluate(() => [scene.x, scene.y])));
    await until(p, () => scene.mode === 5, null, 120, `${id}: a tap on him is a BOING`);
    await until(p, () => document.querySelector(".sg i[style*='--ty']"), null, 600, `${id}: he hits the page`);
    await recall(p, errs, id);
    await reducedMotion(id, "smoosh");
  }
  // Wrangle: a loose ghost knocks the page, then perches. Tap it: latched. Pull it to the bucket: bagged.
  {
    const id = "ghost-crew-wrangles-ghost", { p, errs } = await open(id, "wrangle");
    await until(p, () => document.querySelector(".wl i[style*='--r'],.wl i[style*='--ty']"), null, 900, `${id}: the ghost (or the crew's miss) knocks the page`);
    await until(p, () => scene.engine.paused.includes("settled"), null, 3000, `${id}: perches and settles`);
    assert.deepEqual(await settledInPlace(p), { more: 0, same: true }, `${id}: settled, no frames, the page back in place`);
    await tapAt(p, ...(await p.evaluate(() => [scene.x, scene.y])));
    await until(p, () => scene.mode === 2, null, 120, `${id}: a tap on the ghost latches the streams`);
    await offscreen(p, id);
    await p.evaluate(() => scene.aim(80, 76)); // pull it down to the bucket
    await until(p, () => scene.bagged === 1, null, 900, `${id}: pulled over the trap, it's bagged`);
    await until(p, () => scene.mode === 1, null, 300, `${id}: the next ghost is out`);
    await recall(p, errs, id);
    await reducedMotion(id, "wrangle");
  }
  // Overflow: the rookie stuffs two on his own; past the bucket's limit it blows, every ghost
  // escapes across the page and the LEAKS counter (the page's own text) goes up; DOT hauls one off.
  {
    const id = "ghost-bucket-overflows", { p, errs } = await open(id, "overflow");
    await until(p, () => scene.inside === 2 && scene.engine.paused.includes("settled"), null, 3000, `${id}: two stuffed, then it settles`);
    assert.deepEqual(await settledInPlace(p), { more: 0, same: true }, `${id}: settled, no frames, the page untouched`);
    // DOT hauls it: the best haul is two, and a fresh bucket.
    await tapAt(p, 136, 72);
    await until(p, () => scene.best === 2 && scene.inside === 0 && scene.mode === 0, null, 600, `${id}: DOT hauls the bucket off safe`);
    // One more, and one more…: it blows.
    while ((await p.evaluate(() => scene.mode)) !== 2) {
      await until(p, () => scene.mode === 0, null, 600, `${id}: ready for one more`);
      await tapAt(p, 80, 40);
      await until(p, () => scene.mode !== 0, null, 60, `${id}: the tap stuffs one more`);
      await until(p, () => scene.mode !== 1, null, 600, `${id}: in it goes`);
    }
    await until(p, () => document.querySelector(".ov i[style*='--r']"), null, 300, `${id}: the escapees and the lid knock the page`);
    await offscreen(p, id);
    const cap = await p.evaluate(() => scene.cap);
    await until(p, (n) => scene.leaks === n && document.querySelector(".ov-k b").textContent === String(n), cap + 1, 900, `${id}: all ${cap + 1} escape, the page's counter says so`);
    await until(p, () => scene.engine.paused.includes("settled"), null, 3000, `${id}: a fresh bucket, and it settles`);
    assert.deepEqual(await settledInPlace(p, ".ov-k b"), { more: 0, same: true }, `${id}: settled, the page in place but for its counter`);
    await recall(p, errs, id);
    await reducedMotion(id, "overflow");
  }
  console.log("halloween ghosts: Smoosh, Wrangle and Overflow mount, play, slime / bag / blow on a tap, move the page only where hit, sleep off screen, settle with the page in place, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
