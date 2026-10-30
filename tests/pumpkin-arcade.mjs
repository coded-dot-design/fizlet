// Patch slash (Halloween) and Grab-O-Tron (arcade) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does: the autoplay
// story plays and reaches the page's own letters, it settles to no frames with every letter back in
// place, input has its consequence (a swipe through two pumpkins is a combo, a sliced bomb blows a
// word apart; the claw wins a block and the counter counts its tickets, or fumbles it back onto the
// pile), Recall mid-play gives the page back byte for byte, and reduced motion keeps the still poster.
// Waits are on frames and state, never on the clock.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { slash } from "./site/gallery/pieces/pumpkin-patch-slash.ts"; export { claw } from "./site/gallery/pieces/claw-machine-grabs-letters.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "pa", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><html data-theme="dark"><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:800px;aspect-ratio:16/9;margin:0;overflow:hidden">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());

// Resolves once `cond` holds; fails after the scene has drawn `frames` frames without it (or has
// stopped drawing for good). A loaded machine just takes longer.
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
const frames = (p, n) => p.evaluate((n) => new Promise((ok) => { const f = () => (n-- ? requestAnimationFrame(f) : ok()); f(); }), n);

/** Mount, check the canvas is up and the poster is aside. */
async function open(id, make) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(id));
  await p.evaluate(() => {
    let s = 0x2f6b1d3;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await p.evaluate((make) => {
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = pa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = pa[make](stage, el, first)), { idle: 0 });
  }, make);
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
  assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas; the poster steps aside`);
  return { p, errs, box: await p.locator("figure").boundingBox() };
}

/** Settled: no frames, and (`home`) every page element it moved is back as it was. The claw's pile
 *  stays where the blocks fell (that is the game); its blocks must rest inside the glass, apart. */
async function settled(p, id, cap, home = true) {
  await until(p, () => scene.engine.paused.includes("settled"), null, cap, `${id}: settles`);
  const still = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    for (let f = 0; f < 30; f++) await new Promise(requestAnimationFrame);
    const fig = document.querySelector("figure").cloneNode(true);
    fig.querySelector("[data-fizlet-slot]").remove();
    fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
    const norm = (root) => {
      for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
      return root.innerHTML;
    };
    const was = document.createElement("figure");
    was.innerHTML = window.figBefore;
    // The counters (the HUD, the ticket LED) keep their score; everything else is as it was.
    for (const r of [fig, was]) for (const e of r.querySelectorAll(".pp-hud, .cm-led")) e.textContent = "";
    return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
  });
  if (!home) {
    const ok = await p.evaluate(() => {
      const g = document.querySelector(".cm-glass").getBoundingClientRect(), bs = [...document.querySelectorAll(".cm-pile i")].map((e) => e.getBoundingClientRect());
      const inside = bs.every((b) => b.left >= g.left - 1 && b.right <= g.right + 1 && b.top >= g.top - 1 && b.bottom <= g.bottom + 1);
      const apart = bs.every((a, i) => bs.every((b, j) => i === j || Math.min(a.right, b.right) - Math.max(a.left, b.left) < 4 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 4));
      return { inside, apart };
    });
    assert.deepEqual({ more: still.more, ...ok }, { more: 0, inside: true, apart: true }, `${id}: settled, no frames, every block at rest in the glass`);
    return;
  }
  assert.deepEqual(still, { more: 0, same: true }, `${id}: settled, no frames, the page's elements back in place`);
}

async function recall(p, errs, id) {
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, `${id}: Recall gives the page back byte for byte`);
  assert.deepEqual(errs, [], `${id}: no page errors`);
  await p.close();
}

async function reduced(id, make) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(id));
  const rm = await q.evaluate(async (make) => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = pa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, pa[make](stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
  }, make);
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
  await ctx.close();
}

try {
  // Patch slash.
  {
    const id = "pumpkin-patch-slash";
    const { p, errs, box } = await open(id, "slash");
    // The demo: a ghost blade cuts two in one stroke (a combo) and the letters take hits.
    await until(p, () => scene.state.sliced >= 2 && scene.state.best >= 2, null, 400, `${id}: the ghost blade's combo`);
    await until(p, () => document.querySelector(".pp-h i[style*='transform']") || scene.state.splats > 0, null, 400, `${id}: the crop reaches the letters`);
    await settled(p, id, 3000);
    // A swipe through two pumpkins near their peak: both cut, a combo.
    const s0 = await p.evaluate(() => (scene.toss(0, 0.35, 0.3), scene.toss(1, 0.65, 0.3), scene.state.sliced));
    await until(p, () => { const a = scene.crop(0), b = scene.crop(1); return a && b && a.y < 0.36 * 450 && b.y < 0.36 * 450; }, null, 300, `${id}: the pair rises`);
    const [a, b] = await p.evaluate(() => [scene.crop(0), scene.crop(1)]);
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    await p.mouse.move(box.x + l.x - 60, box.y + l.y);
    await p.mouse.down();
    for (let k = 0; k <= 8; k++) await p.mouse.move(box.x + l.x - 60 + ((r.x - l.x + 120) * k) / 8, box.y + l.y + ((r.y - l.y) * k) / 8);
    await p.mouse.up();
    await until(p, (s0) => scene.state.sliced >= s0 + 2, s0, 60, `${id}: a swipe cuts both`);
    // A bomb: tapped, it blows up and a whole word takes off.
    await settled(p, id, 3000);
    await p.evaluate(() => scene.toss(4, 0.5, 0.3));
    await until(p, () => scene.crop(0) && scene.crop(0).y < 0.4 * 450, null, 300, `${id}: the bomb rises`);
    const bomb = await p.evaluate(() => scene.crop(0));
    await p.mouse.click(box.x + bomb.x, box.y + bomb.y);
    await until(p, () => scene.state.booms >= 1 && scene.state.moved >= 3, null, 60, `${id}: the bomb blows a word apart`);
    await until(p, () => scene.state.moved > 0, null, 10, `${id}: letters in the air`);
    await recall(p, errs, id);
    await reduced(id, "slash");
  }
  // Grab-O-Tron.
  {
    const id = "claw-machine-grabs-letters";
    const { p, errs, box } = await open(id, "claw");
    // The demo: one go, and the claw fumbles it.
    await until(p, () => scene.state.plays === 1 && scene.state.slips === 1, null, 900, `${id}: the demo grab slips`);
    await settled(p, id, 3000, false);
    // A rigged win on the block under a tap: it goes down the chute, tickets come out, it comes back.
    const target = await p.evaluate(() => scene.block(9));
    await p.evaluate(() => scene.rig(1));
    await p.mouse.click(box.x + target.x, box.y + target.y);
    await until(p, () => scene.state.wins === 1 && scene.state.tickets > 0, null, 1200, `${id}: a win`);
    await until(p, () => /TICKETS 00[0-9][1-9]|TICKETS 00[1-9]/.test(document.querySelector(".cm-led").textContent), null, 300, `${id}: the LED counts the tickets`);
    await until(p, () => scene.state.gone === 0 && scene.state.mode === 0, null, 900, `${id}: the block is restocked`);
    await settled(p, id, 3000, false);
    // A rigged slip: the block lands back on the pile.
    // The highest block now (the pile has moved), so the claw lands on it.
    const top = await p.evaluate(() => Array.from({ length: 10 }, (_, i) => scene.block(i)).filter(Boolean).sort((a, b) => a.y - b.y)[0]);
    await p.evaluate(() => scene.rig(2));
    await p.mouse.click(box.x + top.x, box.y + top.y);
    await until(p, () => scene.state.slips === 2, null, 1200, `${id}: a fumble`);
    await recall(p, errs, id);
    await reduced(id, "claw");
  }
  console.log("pumpkin arcade: both mount, play, hit the page's letters, settle with the page in place, answer input, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
