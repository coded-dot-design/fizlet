// The two heroes pixel pieces (#047 the wall-crawler, #048 spin it back) in Chromium, each on its own
// stage (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does. At 390 and
// 1440 wide: the real blocks sit exactly on the holes the scene leaves for them; it plays by itself
// and the page's letters move only where something reaches them (never all of them); it settles to
// no frames with every letter home; a tap wakes it and reaches the page again; off screen it sleeps;
// Recall mid-play gives the page back byte for byte; reduced motion keeps the still poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as climber, BLOCKS } from "./site/gallery/pieces/wall-crawler-climbs-page.ts"; export { mount as rewinder, PAGE } from "./site/gallery/pieces/spin-it-back.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "hp", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id, w) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p><div style="height:3000px"></div></main>
<script>${bundle}</script></body>`;

const PIECES = [
  { id: "wall-crawler-climbs-page", make: "climber", letter: ".wc47-l", tap: [0.62, 0.62], holes: () => [...document.querySelectorAll(".wc47 > b")].map((b, i) => [b, hp.BLOCKS[i]]) },
  { id: "spin-it-back", make: "rewinder", letter: ".sb48-l", tap: [0.2, 0.3], holes: () => [[document.querySelector(".sb48-pg"), hp.PAGE]] },
];
const moved = (sel) => document.querySelectorAll(`${sel}[style*="--"]`).length;

const browser = await chromium.launch(launchOptions());
try {
  for (const pc of PIECES)
    for (const width of [390, 1440]) {
      const at = `${pc.id} @${width}`;
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(page(pc.id, width - 32));
      // The real blocks sit on the scene's holes (art px × the card's scale), to a pixel.
      const off = await p.evaluate((holes) => {
        const fig = document.querySelector("figure").getBoundingClientRect(), k = fig.width / 160;
        return eval(holes)().map(([el, [x, y, w, h]]) => {
          const r = el.getBoundingClientRect();
          return Math.max(Math.abs(r.left - fig.left - x * k), Math.abs(r.top - fig.top - y * k), Math.abs(r.width - w * k), Math.abs(r.height - h * k));
        });
      }, `(${pc.holes})`);
      assert.ok(off.length && off.every((d) => d < 1), `${at}: blocks on their holes (off by ${off.map((d) => d.toFixed(2))} px)`);

      await p.evaluate((make) => {
        window.before = document.body.innerHTML;
        window.figBefore = document.querySelector("figure").innerHTML;
        window.h = hp.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = hp[make](stage, el, first)), { idle: 0 });
      }, pc.make);
      await p.waitForFunction(() => window.scene);
      const up = await p.evaluate(() => ({ canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
      assert.deepEqual(up, { canvas: 1, poster: "none" }, `${at}: one pixel canvas; the poster steps aside`);

      // It plays by itself; the letters it reaches move, never all of them.
      await p.evaluate((sel) => {
        window.most = 0;
        window.total = document.querySelectorAll(sel).length;
        new MutationObserver(() => (window.most = Math.max(window.most, document.querySelectorAll(`${sel}[style*="--"]`).length))).observe(document.querySelector("figure"), { attributes: true, subtree: true, attributeFilter: ["style"] });
      }, pc.letter);
      await p.waitForFunction(() => window.most > 0, null, { timeout: 8000 });
      await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 25000 });
      const still = await p.evaluate(async (sel) => {
        const a = scene.engine.stats().frames;
        await new Promise((r) => setTimeout(r, 500));
        return { more: scene.engine.stats().frames - a, home: document.querySelectorAll(`${sel}[style*="--"]`).length, some: window.most > 0 && window.most < window.total };
      }, pc.letter);
      assert.deepEqual(still, { more: 0, home: 0, some: true }, `${at}: settled, no frames, every letter home; only some were ever moved`);

      // A tap wakes it and reaches the page again.
      const box = await p.locator("figure").boundingBox();
      await p.evaluate(() => (window.most = 0));
      await p.mouse.click(box.x + box.width * pc.tap[0], box.y + box.height * pc.tap[1]);
      await p.waitForFunction(() => scene.engine.running && window.most > 0, null, { timeout: 8000 });
      // Off screen it sleeps.
      await p.evaluate(() => window.scrollTo(0, 2500));
      await p.waitForTimeout(300);
      const away = await p.evaluate(async () => {
        const a = scene.engine.stats().frames;
        await new Promise((r) => setTimeout(r, 400));
        return scene.engine.stats().frames - a;
      });
      assert.equal(away, 0, `${at}: no frames off screen`);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.mouse.click(box.x + box.width * pc.tap[0], box.y + box.height * pc.tap[1]);
      await p.waitForTimeout(700);
      // Recall mid-play: the page comes back byte for byte.
      const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
      assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await p.close();
    }

  // Reduced motion: the poster (over the real page, its holes showing it) is the still; nothing mounts.
  for (const pc of PIECES) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id, 720));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = hp.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, hp[make](stage, el, first)), { idle: 0 });
      await new Promise((r) => setTimeout(r, 600));
      const img = document.querySelector(".ae-slot__placeholder");
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none" && img.getBoundingClientRect().width > 700 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("heroes pixel: both line up with their pages at 390 and 1440, play, move only the letters they reach, settle with every letter home, wake on a tap, sleep off screen, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
