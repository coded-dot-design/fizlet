// The two Halloween fight pieces (HUSH vs SNOOZE, the last slice) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through @fzlt/core/slot as the gallery does. Each: it fights
// on its own to a winner, and the page's own elements move only once something has reached them (a
// swing, a thrown thing, a bolt, a landing); it settles to no frames with every element back as it
// was (the cut letters mended); its clicks have consequences (the lamp, the alarm clock, a thrown-in
// pan or pillow, a rematch; a surge, a drone whose bolts ricochet off the real boxes); Recall
// mid-fight gives the page back byte for byte; reduced motion keeps the still poster. And the fight
// is the seed's: the same Math.random gives the same fight and winner, and different seeds give
// different fights, with both sides winning some.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { hushVsSnooze } from "./site/gallery/pieces/slasher-fights-dream-claw.ts"; export { lastSlice } from "./site/gallery/pieces/laser-swords-duel-last-slice.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "hf", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const PIECES = [
  { id: "slasher-fights-dream-claw", make: "hushVsSnooze", boxes: ".hs-t i[data-c]" },
  { id: "laser-swords-duel-last-slice", make: "lastSlice", boxes: ".ld-t i[data-c], .ld-c" },
];
/** A seeded Math.random (the scenes seed their engine from it once, at mount). */
const SEED = (seed) => {
  let s = seed;
  Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails only after the scene has drawn
// `frames` frames without it (or stopped drawing for 15 s with the engine not running).
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

/** Settled: no frames for a while, and the figure's markup as it was (styles as the browser reads them). */
const settled = (p) => p.evaluate(async () => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]").remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
});

/** A box's centre in art pixels (160 × 90). */
const centre = (p, sel, i) => p.evaluate(({ sel, i }) => {
  const f = document.querySelector("figure").getBoundingClientRect(), b = document.querySelectorAll(sel)[i].getBoundingClientRect();
  return [((b.left + b.width / 2 - f.left) / f.width) * 160, ((b.top + b.height / 2 - f.top) / f.height) * 90];
}, { sel, i });

try {
  for (const pc of PIECES) {
    // The fight is the seed's: run by hand (engine stopped, fixed steps) to the end, per seed.
    const h = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await h.setContent(page(pc.id));
    const runs = await h.evaluate(({ make, SEED }) => {
      const seed = new Function(`return (${SEED})`)();
      const host = document.querySelector("figure");
      const fight = (s) => {
        seed(s);
        const st = document.createElement("div");
        host.append(st);
        const sc = hf[make](st, host, null);
        sc.engine.stop();
        for (let i = 0; i < 60 * 90 && !sc.over; i++) sc.engine.advance(1 / 60);
        const r = { winner: sc.winner, log: sc.log, over: sc.over };
        sc.destroy();
        st.remove();
        return r;
      };
      const out = [];
      for (let s = 1; s <= 12; s++) out.push(fight(s * 7919));
      return { out, again: fight(7919) };
    }, { make: pc.make, SEED: SEED.toString() });
    assert.ok(runs.out.every((r) => r.over && r.winner >= 0), `${pc.id}: every seeded fight ends with a winner`);
    assert.deepEqual(runs.again, runs.out[0], `${pc.id}: the same seed gives the same fight and the same winner`);
    assert.deepEqual([...new Set(runs.out.map((r) => r.winner))].sort(), [0, 1], `${pc.id}: different seeds, different winners (${runs.out.map((r) => r.winner).join("")})`);
    assert.ok(new Set(runs.out.map((r) => r.log)).size === runs.out.length, `${pc.id}: every seed fights a different fight`);
    await h.close();

    // Live, through the slot, as the gallery mounts it.
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id));
    await p.evaluate((SEED) => new Function(`return (${SEED})`)()(0x2f6b1d3), SEED.toString());
    await p.evaluate(({ make, boxes }) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = hf.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = hf[make](stage, el, first)), { idle: 0 });
      // Every frame: a page box that shows a change (moved, lit or cut) must be one something reached.
      const els = [...document.querySelectorAll(boxes)];
      window.stray = [];
      window.changed = 0;
      const watch = () => {
        if (!window.scene) return requestAnimationFrame(watch);
        els.forEach((e, i) => {
          if (e.hasAttribute("style") && /--/.test(e.getAttribute("style")) || e.hasAttribute("data-cut") || e.hasAttribute("data-hit")) {
            window.changed++;
            if (!scene.hits[i]) window.stray.push(i);
          }
        });
        if (!window.stopWatch) requestAnimationFrame(watch);
      };
      watch();
    }, pc);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${pc.id}: mounts its canvas on the stage; the poster steps aside`);

    // On its own: the fight reaches the page, ends with a winner, mends and settles.
    await until(p, () => window.changed > 0, null, 3000, `${pc.id}: the fight reaches a page element`);
    await until(p, () => scene.over && scene.engine.paused.includes("settled"), null, 4000, `${pc.id}: a winner, the tease, then it settles`);
    assert.deepEqual(await settled(p), { more: 0, same: true }, `${pc.id}: settled, no frames, every page element back (the cuts mended)`);
    assert.deepEqual(await p.evaluate(() => [window.stray.length, window.changed > 0]), [0, true], `${pc.id}: only the page elements something reached ever moved`);

    // A click after the end: the rematch, a fresh fight.
    const box = await p.locator("figure").boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
    await until(p, () => scene.engine.running && scene.winner < 0 && scene.hp[0] === 4 && scene.hp[1] === 4, null, 60, `${pc.id}: a click after the end starts the rematch`);

    if (pc.make === "hushVsSnooze") {
      // The lamp: lights out (the page itself goes dark, through the ledger).
      await p.evaluate(() => scene.tap(150, 30));
      await until(p, () => scene.dark && document.querySelector(".hs[data-dark]"), null, 60, `${pc.id}: the lamp cuts the lights`);
      // The alarm clock: the dreamer half wakes.
      await p.evaluate(() => scene.tap(10, 76));
      await until(p, () => scene.ringing, null, 60, `${pc.id}: the alarm clock rings`);
      // Something thrown in onto a letter: that letter (and only what's reached) is knocked.
      const [x, y] = await centre(p, ".hs-t i[data-c]", 9);
      await p.evaluate(() => (window.hitBefore = scene.hits[9]));
      await p.evaluate(([x, y]) => scene.tap(x, y), [x, y + 2]);
      await until(p, () => scene.hits[9] === 1 && document.querySelectorAll(".hs-t i[data-c]")[9].hasAttribute("data-hit"), null, 120, `${pc.id}: a thrown-in pan or pillow knocks the letter it lands on`);
    } else {
      // A click on a duelist (NANA, still on her mark as the rematch opens): a surge.
      await p.evaluate(() => scene.tap(36, 72));
      await until(p, () => scene.surge[0] > 0, null, 30, `${pc.id}: a click on NANA surges her`);
      // A click in the air: a drone, and its bolts ricochet off the page's real boxes.
      await p.evaluate(() => (window.r0 = scene.log.split("r").length, scene.tap(80, 8)));
      await until(p, () => scene.drone, null, 60, `${pc.id}: a click in the air sends a drone`);
      await until(p, () => scene.log.split("r").length > window.r0 || scene.winner >= 0, null, 1500, `${pc.id}: a bolt ricochets off a page box`);
    }
    assert.deepEqual(await p.evaluate(() => window.stray), [], `${pc.id}: still nothing moved that wasn't reached`);

    // Recall mid-fight: the page comes back byte for byte.
    const after = await p.evaluate(() => ((window.stopWatch = 1), h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
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
      const s = hf.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, hf[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 160 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("halloween fights: seeded fights (same seed same fight, both sides win), each fights to a winner, touches only what it reaches, mends and settles, clicks change it (lights, alarm, thrown-in; surge, drone ricochets), rematch, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
