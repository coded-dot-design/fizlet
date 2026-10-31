// The surf-sesh minis (site/gallery/pieces/surf/lip-line.ts, tube-time.ts, paddle-out.ts) in Chromium, each on its
// own stage, mounted through @fzlt/core/slot as the gallery does: it mounts (the poster steps aside),
// plays its attract run and settles to no frames with the page as it was; no audio exists before a
// gesture; the keyboard rides it (Space on the ride key starts and holds a ride) and M mutes; both
// keys are 44 px at 390 wide; Recall mid-ride gives the page back byte for byte; reduced motion
// keeps the still poster (the scene never mounts). The rides themselves: tests/surf-sesh.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as lip } from "./site/gallery/pieces/surf/lip-line.ts"; export { mount as tube } from "./site/gallery/pieces/surf/tube-time.ts"; export { mount as paddle } from "./site/gallery/pieces/surf/paddle-out.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id, w) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 15000 }).catch(() => { throw new Error(`${what}: never settled`); });

try {
  for (const [id, make, HELD] of [["lip-line", "lip", 14], ["tube-time", "tube", 8], ["paddle-out", "paddle", 12]]) {
    for (const w of [720, 358]) {
      const p = await browser.newPage({ viewport: { width: w + 40, height: 600 } });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(page(id, w));
      await p.evaluate((make) => {
        window.before = document.body.innerHTML;
        window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv[make](stage, el, first)), { idle: 0 });
      }, make);
      await p.waitForFunction(() => window.scene);
      const m = await p.evaluate(() => ({
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        keys: [...document.querySelectorAll("[data-fizlet-slot] button")].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) >= 44; }),
      }));
      assert.deepEqual(m, { canvas: 1, poster: "none", keys: [true, true] }, `${id} @${w}: mounts its canvas, the poster steps aside, both keys ≥ 44 px`);
      // The attract run plays, then it settles: no frames, no audio, the page as it was.
      await settle(p, `${id} @${w}: after the attract run`);
      assert.equal(await frames(p), 0, `${id} @${w}: settled, no frames`);
      assert.equal(await p.evaluate(() => window.audio || 0), 0, `${id} @${w}: no audio before a gesture`);
      // The keyboard: focus the ride key, Space starts and holds a ride; M mutes.
      await p.focus("[data-fizlet-slot] button[aria-label$='(Space)']");
      await p.keyboard.down(" ");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 3000 });
      await p.waitForTimeout(300);
      const held = await p.evaluate((k) => scene.ride.S[k], HELD);
      await p.keyboard.up(" ");
      assert.equal(held, 1, `${id} @${w}: Space holds`);
      await p.keyboard.press("m");
      const muted = await p.evaluate(() => document.querySelector("[data-fizlet-slot] button[aria-label^='Sound']").getAttribute("aria-pressed"));
      assert.equal(muted, "false", `${id} @${w}: M mutes`);
      // Recall mid-ride: the page comes back byte for byte.
      const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
      if (!after.same) console.log(await p.evaluate(() => { const a = window.before, b = document.body.innerHTML; let i = 0; while (a[i] === b[i]) i++; return [a.slice(i - 80, i + 120), b.slice(i - 80, i + 120)]; }));
      assert.deepEqual(after, { same: true, running: false }, `${id} @${w}: Recall restores the page byte for byte`);
      assert.deepEqual(errs, [], `${id} @${w}: no page errors`);
      await p.close();
    }
    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(id, 720));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
    }, make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("surf-sesh: all three mount, play the attract run and settle (no audio before a gesture), Space rides and M mutes with 44 px keys at 720 and 358 wide, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
