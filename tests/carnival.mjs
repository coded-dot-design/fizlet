// The carnival pieces (site/gallery/pieces/duck-derby.ts, oodles-o-moles.ts, dunk-tank.ts) in Chromium, each on
// its own stage (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does: it
// mounts (the poster steps aside), plays its intro and settles to no frames with the page exactly as
// it was; a tap starts a round and really hits (a duck tips over, a mole is bonked; a double tap is
// the BOOM; the bomb mole blows the letters about; the target drops Sir Dry in and the splash wets
// the letters it lands on); a miss moves only the letters it reaches; the
// round ends at the bell with a prize and the scene sleeps again; Recall mid-play gives the page
// back byte for byte; reduced motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as ducks } from "./site/gallery/pieces/duck-derby.ts"; export { mount as moles } from "./site/gallery/pieces/oodles-o-moles.ts"; export { mount as dunk } from "./site/gallery/pieces/dunk-tank.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, and fails only after the scene has
// drawn `frames` frames without it (or stopped drawing for 15 s while not running).
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

/** The figure's elements as they were (style text as the browser reads it; Recall checks the bytes). */
const samePage = (p) => p.evaluate(() => {
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]")?.remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return norm(fig) === norm(was);
});
/** A click at art units (160 across) on the figure. */
const at = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  return { x: b.x + (x / 160) * b.width, y: b.y + (y / 160) * b.width };
};
const click = async (p, x, y) => {
  const c = await at(p, x, y);
  await p.mouse.click(c.x, c.y);
};
/** Run the scene by hand for `sec` (the engine stopped: deterministic, no wall time). */
const run = (p, sec) => p.evaluate((sec) => {
  for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60);
}, sec);

const PIECES = [
  {
    id: "duck-derby", make: "ducks",
    async play(p) {
      // A tap on a standing duck starts the round and tips it over (a ticket flies).
      const d = await p.evaluate(() => { for (let i = 0; i < 8; i++) { const d = scene.duck(i); if (d.up && d.x > 30 && d.x < 130) return d; } return null; });
      assert.ok(d, "duck-derby: a duck in sight to shoot");
      await p.evaluate(() => scene.engine.stop());
      await click(p, d.x, d.y);
      await run(p, 0.5);
      let s = await p.evaluate(() => scene.state);
      assert.equal(s.mode, 2, "duck-derby: the first tap starts a round");
      assert.ok(s.down >= 1, "duck-derby: the cork tips the duck over");
      await run(p, 1);
      assert.ok((await p.evaluate(() => scene.state)).tickets >= 1, "duck-derby: its ticket lands on the stub");
      // A miss on the sign: the letter it hits swings on its nail (through the ledger), only that one.
      const L = await p.evaluate(() => { const r = document.querySelector(".dd-t i:nth-of-type(6)").getBoundingClientRect(), f = document.querySelector("figure").getBoundingClientRect(); return { x: ((r.left + r.width / 2 - f.left) / f.width) * 160, y: ((r.top + r.height / 2 - f.top) / f.width) * 160 }; });
      await p.waitForTimeout(400); // past the double-tap window: this one is a single
      await click(p, L.x, L.y);
      await run(p, 0.15);
      const moved = await p.evaluate(() => [...document.querySelectorAll(".dd i")].filter((e) => e.style.getPropertyValue("--r")).map((e) => e.textContent));
      assert.deepEqual(moved, ["C"], "duck-derby: the cork swings the letter it hit, only that one");
      // A double tap: the second shot is the BOOM.
      await p.waitForTimeout(400);
      const c = await at(p, 80, 50);
      await p.mouse.click(c.x, c.y);
      await run(p, 0.05);
      await p.mouse.click(c.x, c.y);
      await run(p, 0.2);
      s = await p.evaluate(() => scene.state);
      assert.equal(s.booms, 1, "duck-derby: a double tap fires the BOOM");
    },
  },
  {
    id: "oodles-o-moles", make: "moles",
    async play(p) {
      await p.evaluate(() => scene.engine.stop());
      // A miss starts the round and thunks the poster: the letters by it hop, the far ones don't.
      const N = await p.evaluate(() => { const r = document.querySelector(".oo-s i").getBoundingClientRect(), f = document.querySelector("figure").getBoundingClientRect(); return { x: ((r.left + r.width / 2 - f.left) / f.width) * 160, y: ((r.bottom - f.top) / f.width) * 160 + 3 }; });
      await click(p, N.x, N.y);
      await run(p, 0.1);
      const hop = await p.evaluate(() => ({ near: !!document.querySelector(".oo-s i:first-child").style.getPropertyValue("--ty"), far: !!document.querySelector(".oo-s i:last-child").style.getPropertyValue("--ty"), mode: scene.state.mode }));
      assert.deepEqual(hop, { near: true, far: false, mode: 2 }, "oodles-o-moles: a miss starts the round and hops only the letters by it");
      // Bonk the moles as they come up (the bomb one too, once).
      let bonked = 0, boomed = 0;
      for (let k = 0; k < 200 && (bonked < 2 || !boomed); k++) {
        await run(p, 0.1);
        const ms = await p.evaluate(() => scene.moles());
        const m = ms.find((m) => m.kind === 3 && !boomed) || ms.find((m) => m.kind !== 3);
        if (!m) continue;
        await click(p, m.x, m.y);
        await run(p, 0.05);
        if (m.kind === 3) boomed++;
        else bonked++;
      }
      const s = await p.evaluate(() => scene.state);
      assert.ok(s.bonks >= 1, "oodles-o-moles: a bonk lands on a mole");
      assert.equal(s.booms, 1, "oodles-o-moles: bonking the bomb mole sets it off");
    },
  },
  {
    id: "dunk-tank", make: "dunk",
    async play(p) {
      await p.evaluate(() => scene.engine.stop());
      const sp = await p.evaluate(() => scene.spots);
      // A ball on the sign knocks the letter it hits, only that one.
      const K = await p.evaluate(() => { const r = document.querySelector(".dk-t i:nth-of-type(4)").getBoundingClientRect(), f = document.querySelector("figure").getBoundingClientRect(); return { x: ((r.left + r.width / 2 - f.left) / f.width) * 160, y: ((r.top + r.height / 2 - f.top) / f.width) * 160 }; });
      await click(p, K.x, K.y);
      await run(p, 0.5);
      const moved = await p.evaluate(() => [...document.querySelectorAll(".dk i")].filter((e) => e.style.getPropertyValue("--r")).map((e) => e.textContent));
      assert.deepEqual(moved, ["K"], "dunk-tank: the ball knocks the letter it hit, only that one");
      // A double tap at him: the second ball is the fastball.
      await p.waitForTimeout(400);
      const c = await at(p, sp.head.x, sp.head.y);
      await p.mouse.click(c.x, c.y);
      await run(p, 0.05);
      await p.mouse.click(c.x, c.y);
      await run(p, 1.5);
      assert.equal((await p.evaluate(() => scene.state)).fast, 1, "dunk-tank: a double tap throws the fastball");
      // The target: he drops in, and the splash wets letters on the sign (through the ledger).
      await p.waitForTimeout(400);
      await click(p, sp.target.x, sp.target.y);
      await run(p, 1.6);
      const s = await p.evaluate(() => ({ ...scene.state, marked: document.querySelectorAll(".dk i[data-wet]").length }));
      assert.equal(s.dunks, 1, "dunk-tank: a hit on the target dunks him");
      assert.ok(s.wet >= 1 && s.marked === s.wet, `dunk-tank: the splash wets the letters it lands on (${s.wet})`);
    },
  },
];

try {
  for (const pc of PIECES) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id));
    // Same run every time: the scene seeds its engine from Math.random once, at mount.
    await p.evaluate(() => {
      let s = 0x2f6b1d3;
      Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv[make](stage, el, first)), { idle: 0 });
    }, pc.make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: 1, poster: "none" }, `${pc.id}: mounts its canvas on the stage; the poster steps aside`);

    // The intro plays, then it settles: no frames, the page's elements back in place.
    await until(p, () => scene.engine.stats().frames > 30, null, 600, `${pc.id}: plays on load`);
    await until(p, () => scene.engine.paused.includes("settled"), null, 4000, `${pc.id}: settles after the intro`);
    const quiet = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
      return scene.engine.stats().frames - a;
    });
    assert.equal(quiet, 0, `${pc.id}: settled, no frames`);
    assert.ok(await samePage(p), `${pc.id}: settled with the page's elements as they were`);

    // A round: taps that really hit.
    await pc.play(p);

    // The bell, the prize, and it sleeps again with the page in place.
    await run(p, 26);
    const end = await p.evaluate(() => scene.state.mode);
    assert.equal(end, 3, `${pc.id}: the round ends (the bell, or the dunk) with a prize`);
    await p.evaluate(() => scene.engine.start());
    await until(p, () => scene.engine.paused.includes("settled"), null, 4000, `${pc.id}: sleeps after the prize`);
    assert.ok(await samePage(p), `${pc.id}: after the round, the page's elements are as they were`);

    // Recall mid-play: a new round, then destroy: the page comes back byte for byte.
    await click(p, 80, 40);
    await until(p, () => scene.engine.running && scene.state.mode === 2, null, 600, `${pc.id}: a tap starts the next round`);
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${pc.id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${pc.id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("carnival: all three mount, play the intro and settle, a tap hits (duck, letter, BOOM; mole, thunk, bomb; ball, fastball, dunk and splash), the round ends with a prize and sleeps, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
