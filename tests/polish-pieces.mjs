// The three polished gallery pieces (#30 Haunted Page, #32 the transformer's KO, #41 laser eyes),
// each hand-built on its own stage (site/gallery/stages/<id>.html), in Chromium through fizlet/slot
// as the gallery mounts them: the poster steps aside, the opening story plays by itself (the ghost
// rearranges the page's real elements; the bout ends in a KO; the beams cut the stack), it settles
// to no frames (the haunted page with every element back exactly as it was), a click has its
// consequence (the ghost is caught, or comes to move what you clicked; a rematch; a zap that cuts,
// and an overheat), Recall mid-play gives the page back byte for byte, and reduced motion keeps
// the still poster (the scene never mounts). Every wait is on frames or state, never on the clock.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const PIECES = [
  { id: "haunted-page", module: "pieces/haunted-page.ts" },
  { id: "transformer-fights-diffuser-ko", module: "pieces/transformer-fights-diffuser-ko.ts" },
  { id: "laser-eyes-mascot-powers-fires", module: "pieces/laser-eyes-mascot-powers-fires.ts" },
];

const page = (id, js) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${js}</script></body>`;

// Waits on the scene, not the clock: resolves once `cond` holds, fails once the scene has drawn
// `frames` frames without it (or stopped drawing for good first).
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
// A click on the figure at art pixel (x, y) of the 160 × 90 grid.
const click = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  await p.mouse.click(b.x + (b.width * x) / 160, b.y + (b.height * y) / 90);
};
// A few frames pass (state, not time).
const frames = (p, n) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  while (scene.engine.stats().frames - a < n && scene.engine.running) await new Promise((r) => requestAnimationFrame(r));
}, n);

const browser = await chromium.launch(launchOptions());
try {
  for (const pc of PIECES) {
    const js = (await build({
      stdin: { contents: `export { slot } from "./src/slot.ts"; export { mount } from ${JSON.stringify("./site/gallery/" + pc.module)};`, resolveDir: process.cwd(), loader: "ts" },
      bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
    })).outputFiles[0].text;
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id, js));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = fz.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = fz.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${pc.id}: mounts its canvas; the poster steps aside`);

    // The opening story, by itself.
    if (pc.id === "haunted-page") await until(p, () => document.querySelector(".hp30 i[style*='--x']") && scene.moved >= 2, null, 900, `${pc.id}: the ghost moves the page's own elements`);
    if (pc.id === "transformer-fights-diffuser-ko") await until(p, () => scene.over && scene.hp[1] === 0 && scene.hp[0] > 0, null, 1200, `${pc.id}: the bout ends in a KO for the transformer`);
    if (pc.id === "laser-eyes-mascot-powers-fires") await until(p, () => scene.cuts >= 3, null, 900, `${pc.id}: the beams cut the stack`);

    // It settles: no frames; the haunted page has every element back exactly as it was.
    await until(p, () => scene.engine.paused.includes("settled"), null, 2400, `${pc.id}: settles`);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
      const fig = document.querySelector("figure").cloneNode(true);
      fig.querySelector("[data-fizlet-slot]").remove();
      fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
      fig.querySelector("canvas")?.remove(); // the ghost's canvas inside the page (Recall below checks it goes)
      const norm = (root) => {
        for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
        return root.innerHTML;
      };
      const was = document.createElement("figure");
      was.innerHTML = window.figBefore;
      return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
    });
    assert.deepEqual(still, { more: 0, same: true }, `${pc.id}: settled, no frames, the page's elements in place`);

    // A click has a consequence.
    if (pc.id === "haunted-page") {
      // Click BOOK A ROOM: the ghost comes back and swaps the buttons; catch it while it works.
      const b = await p.evaluate(() => {
        const f = document.querySelector("figure").getBoundingClientRect(), e = document.querySelector(".hp30-book").getBoundingClientRect();
        return [((e.left + e.width / 2 - f.left) / f.width) * 160, ((e.top + e.height / 2 - f.top) / f.height) * 90];
      });
      await click(p, b[0], b[1]);
      await until(p, () => document.querySelector(".hp30-book[style*='--x']") && scene.ghost[2] > 0.3, null, 300, `${pc.id}: a click on a button brings the ghost to move it`);
      const g = await p.evaluate(() => scene.ghost);
      await click(p, g[0], g[1]);
      await until(p, () => scene.spotted === 1, null, 30, `${pc.id}: a click on the ghost catches it`);
      await until(p, () => scene.engine.paused.includes("settled"), null, 2400, `${pc.id}: caught, it tidies up and settles`);
      const tidy = await p.evaluate(() => [...document.querySelectorAll(".hp30 i")].every((e) => !e.style.cssText));
      assert.equal(tidy, true, `${pc.id}: after it is caught, every element is back home`);
      await click(p, 40, 25); // the heading: it comes again (Recall mid-move below)
      await until(p, () => document.querySelector(".hp30 i[data-hit]"), null, 300, `${pc.id}: moving again`);
    }
    if (pc.id === "transformer-fights-diffuser-ko") {
      await click(p, 80, 45);
      await until(p, () => scene.engine.running && !scene.over && scene.hp[1] === 1, null, 30, `${pc.id}: a click after the KO is a rematch`);
      await until(p, () => scene.hp[1] < 1, null, 300, `${pc.id}: the rematch lands a hit`);
    }
    if (pc.id === "laser-eyes-mascot-powers-fires") {
      const c0 = await p.evaluate(() => scene.cuts);
      await click(p, 130, 66);
      await until(p, (c0) => scene.cuts > c0, c0, 60, `${pc.id}: a zap at the crates cuts`);
      for (let i = 0; i < 4 && !(await p.evaluate(() => scene.hot)); i++) {
        await frames(p, 24);
        await click(p, 60, 20);
      }
      await until(p, () => scene.hot, null, 60, `${pc.id}: zapping fast overheats`);
    }

    // Recall mid-play: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${pc.id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${pc.id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id, js));
    const rm = await q.evaluate(async () => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = fz.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, fz.mount(stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 160 };
    });
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("polish pieces: haunted page, the KO, laser eyes mount, play their story, settle (the page in place), answer a click, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
