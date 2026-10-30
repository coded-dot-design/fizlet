// The Stone-Age cartoon pieces (site/gallery/pieces/: Rock drop, Stone strike, Foot brake) in
// Chromium, each on its own stage (site/gallery/stages/<id>.html), mounted through fizlet/slot as
// the gallery does, at 390 and 1440: the intro plays and moves page elements only where something
// reaches them; it settles to no frames with every element home; a tap (and a double tap) has its
// consequence; it sleeps off screen; Recall mid-play gives the page back byte for byte; reduced
// motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { crane } from "./site/gallery/pieces/dino-crane-drops-boulders.ts"; export { bowl } from "./site/gallery/pieces/stone-bowling-strike.ts"; export { car } from "./site/gallery/pieces/stone-car-skids.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "sa", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id, w) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p style="height:3000px">After it.</p></main>
<script>${bundle}</script></body>`;

// Each piece: its maker, what a moved page element looks like, the score text the game may keep
// (normalised before comparing), a tap and what it does, a double tap and what it does (art units).
const PIECES = [
  {
    id: "dino-crane-drops-boulders", make: "crane", moved: ".sq1 i[data-crack], .sq1 i[style*='--y']",
    // The intro: two boulders on the R of ROCK, a crack, then it's knocked out (and comes home).
    intro: () => scene.drops >= 2,
    tap: async (p) => p.evaluate(() => ((window.d0 = scene.drops), scene.tap(470, 100))), tapped: () => scene.drops > window.d0 && (scene.cracked > 0 || scene.loose > 0),
    // Double: the BIG one, which brings blocks down.
    double: async (p) => p.evaluate(() => (scene.tap(400, 100), scene.tap(400, 100))), doubled: () => scene.loose >= 2,
  },
  {
    id: "stone-bowling-strike", make: "bowl", moved: ".sb2-p[style*='--x']", score: /(<b class="sb2-n">)\d+/,
    intro: () => scene.rolls >= 1,
    tap: async (p) => p.evaluate(() => ((window.d0 = scene.rolls), scene.tap(320, 60))), tapped: () => scene.rolls > window.d0 && scene.down > 0,
    // Double: the twister, through the head pin: a strike.
    double: async (p) => p.evaluate(() => ((window.s0 = scene.strikes), scene.tap(320, 60), scene.tap(320, 60))), doubled: () => scene.strikes > window.s0,
  },
  {
    id: "stone-car-skids", make: "car", moved: ".sc3 i[data-crack], .sc3 i[style*='--y']",
    intro: () => scene.flung >= 1,
    // Tap: off he goes; tap again: the brakes, and the load flies.
    tap: async (p) => p.evaluate(() => (window.f0 = scene.flung, scene.tap(300, 200))), tapped: () => scene.speed > 0,
    // Double: he floors it (past cruising speed).
    double: async (p) => p.evaluate(() => (scene.tap(300, 200), scene.tap(300, 200))), doubled: () => scene.speed > 200,
  },
];

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails after `frames` frames without it.
const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})()`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok()) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), frames, what });

const settled = (p, what) => until(p, () => scene.engine.paused.includes("settled"), 2400, `${what}: settles`);

try {
  for (const pc of PIECES) for (const w of [390, 1440]) {
    const at = `${pc.id} @${w}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 900 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id, w));
    await p.evaluate(() => {
      let s = 0x2f6b1d3;
      Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = sa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = sa[make](stage, el, first)), { idle: 0 });
    }, pc.make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${at}: mounts its canvas; the poster steps aside`);

    // The intro plays on its own and reaches the page; then it settles, the page whole again.
    await until(p, pc.intro, 900, `${at}: the intro plays`);
    await until(p, new Function(`return () => document.querySelector(${JSON.stringify(pc.moved)})`)(), 900, `${at}: a page element is hit`);
    await settled(p, at);
    const still = await p.evaluate(async (score) => {
      const a = scene.engine.stats().frames;
      for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
      const fig = document.querySelector("figure").cloneNode(true);
      fig.querySelector("[data-fizlet-slot]").remove();
      fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
      const norm = (root) => {
        for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
        return score ? root.innerHTML.replace(new RegExp(score), "$1#") : root.innerHTML;
      };
      const was = document.createElement("figure");
      was.innerHTML = window.figBefore;
      return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
    }, pc.score?.source ?? null);
    assert.deepEqual(still, { more: 0, same: true }, `${at}: settled, no frames, every element home`);

    // A tap wakes it and has its consequence; a double tap, its own.
    const box = await p.locator("figure").boundingBox();
    await p.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);
    await until(p, () => scene.engine.running, 60, `${at}: a real click wakes it`);
    await settled(p, `${at} after the click`);
    await pc.tap(p);
    await until(p, pc.tapped, 900, `${at}: a tap does its thing`);
    if (pc.make === "car") {
      await p.evaluate(() => scene.tap(300, 200)); // the brakes: the load flies
      await until(p, () => scene.flung > window.f0, 600, `${at}: braking flings the load`);
      await until(p, () => scene.speed === 0, 900, `${at}: the car stops`);
    }
    await settled(p, `${at} after the tap`);
    await pc.double(p);
    await until(p, pc.doubled, 1200, `${at}: a double tap does its thing`);

    // Off screen: it sleeps.
    await p.evaluate(() => window.scrollTo(0, 2500));
    await until(p, () => scene.engine.paused.includes("offscreen"), 600, `${at}: sleeps off screen`);
    await p.evaluate(() => window.scrollTo(0, 0));
    await until(p, () => scene.engine.running, 600, `${at}: wakes back on screen`);

    // Recall mid-play: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }

  // Reduced motion: the poster is the still frame; the scene never mounts.
  for (const pc of PIECES) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id, 720));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = sa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, sa[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 640 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("stone age: Rock drop, Stone strike and Foot brake mount, play, move the page only where hit, settle with the page whole, answer a tap and a double tap, sleep off screen, Recall exact, reduced motion still, at 390 and 1440 — ok");
} finally {
  await browser.close();
}
