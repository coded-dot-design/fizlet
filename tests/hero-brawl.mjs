// The two brawl pieces (#49 SMASH, #50 the hammer) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does. Each: it plays on
// its own and its consequence reaches the page's real elements; it settles to no frames with the
// page exactly as it was; a tap has a consequence (SMASH: a letter crumbles, the steel badge never
// does, the flower calms him to zero; the hammer: a letter is knocked, a hit takes the giant's pips,
// a KO moves the round on); Recall mid-play gives the page back byte for byte; reduced motion keeps
// the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { smash } from "./site/gallery/pieces/rage-giant-smashes-page.ts"; export { hammer } from "./site/gallery/pieces/storm-god-hammer-fights-giant.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "hb", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

/** The figure's markup with the slot's own additions taken out, styles as the browser reads them. */
const SAME = () => {
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
};

const settle = async (p) => {
  await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 25000 });
  return p.evaluate(async (same) => {
    const a = scene.engine.stats().frames;
    await new Promise((r) => setTimeout(r, 500));
    return { more: scene.engine.stats().frames - a, same: new Function(`return (${same})()`)() };
  }, SAME.toString());
};

const browser = await chromium.launch(launchOptions());
try {
  for (const [id, make] of [["rage-giant-smashes-page", "smash"], ["storm-god-hammer-fights-giant", "hammer"]]) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(id));
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = hb.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = hb[make](stage, el, first)), { idle: 0 });
    }, make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas on the stage; the poster steps aside`);

    if (make === "smash") {
      // On its own: KRUNCH smashes the G of FRAGILE; it crumbles (hidden on the page, in pieces on the canvas).
      await p.waitForFunction(() => document.querySelector(".sm49-h i[data-gone]") && scene.broken > 0, null, { timeout: 5000 });
      // Left alone he calms down and the page puts itself back: no frames, every element as it was.
      assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: calms down, the page rebuilt, settled`);
      assert.equal(await p.evaluate(() => scene.rage), 0, `${id}: calm again`);
      // The steel badge: CLANG, it never breaks, and the backfire takes rage off rather than adding it.
      const safe = await p.evaluate(async () => {
        const f = document.querySelector("figure").getBoundingClientRect(), b = document.querySelector(".sm49-safe").getBoundingClientRect();
        scene.tap(((b.left + b.width / 2 - f.left) / f.width) * 160, ((b.top + b.height / 2 - f.top) / f.height) * 90);
        let gone = false;
        for (let i = 0; i < 40; i++) (gone ||= document.querySelector(".sm49-safe").hasAttribute("data-gone")), await new Promise((r) => setTimeout(r, 50));
        return { gone, rage: scene.rage, broken: scene.broken };
      });
      assert.deepEqual(safe, { gone: false, rage: 0, broken: 0 }, `${id}: the steel badge does not break`);
      // Rage builds with each smash; the flower calms him to zero and the page comes back.
      const rage = await p.evaluate(async () => {
        const until = async (f) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 50)); };
        for (const [x, y] of [[30, 40], [130, 40], [70, 22]]) {
          const was = scene.rage;
          scene.tap(x, y);
          await until(() => scene.rage > was);
        }
        const peak = scene.rage, broken = scene.broken;
        scene.tap(147, 78); // the flower
        await until(() => scene.rage === 0);
        return { peak, broken, calm: scene.rage };
      });
      assert.ok(rage.peak >= 3 && rage.broken > 0 && rage.calm === 0, `${id}: rage climbs with each smash (${rage.peak}), the flower calms him (${rage.calm})`);
      assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: rebuilt after the flower, settled`);
      // A tap on a letter wakes it, and it crumbles.
      const box = await p.locator(".sm49-h i").nth(1).boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForFunction(() => scene.engine.running && document.querySelector(".sm49 i[data-gone]"), null, { timeout: 5000 });
    } else {
      // On its own: the first hammer hits KRUNCH (a pip off, the panel flashes), he answers, it all settles.
      await p.waitForFunction(() => scene.pips[1] < 3, null, { timeout: 5000 });
      assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: settled after the first exchange, the page in place`);
      // Round 1: straight hits until KO, and the round moves on (the caption's own text, through the ledger).
      const until = `async (f) => { for (let i = 0; i < 120 && !f(); i++) await new Promise((r) => setTimeout(r, 50)); }`;
      const ko = await p.evaluate(async (u) => {
        const until = eval(u);
        for (let i = 0; i < 6 && scene.round === 1; i++) {
          await until(() => scene.engine.paused.length);
          scene.throwAt(132, 62);
          await until(() => scene.round > 1 || scene.engine.paused.length);
        }
        return { round: scene.round, caption: document.querySelector(".hm50-n").textContent };
      }, until);
      assert.deepEqual(ko, { round: 2, caption: "2" }, `${id}: a KO moves the bout to round 2`);
      // Round 2: he guards a straight throw (CLANG, no pip), but a ricochet off the ceiling is a TRICK SHOT (two).
      const r2 = await p.evaluate(async (u) => {
        const until = eval(u);
        await until(() => scene.engine.paused.length);
        const a = scene.pips[1];
        scene.throwAt(132, 62);
        await until(() => scene.engine.paused.length);
        const b = scene.pips[1];
        scene.throwAt(100, 4);
        await until(() => scene.pips[1] < b);
        return { guarded: a - b, trick: b - scene.pips[1] };
      }, until);
      assert.deepEqual(r2, { guarded: 0, trick: 2 }, `${id}: round 2 guards a straight throw; a ricochet gets past for two`);
      assert.deepEqual(await settle(p), { more: 0, same: false }, `${id}: settled (the caption says round 2)`);
      assert.equal(await p.evaluate(() => document.querySelectorAll(".hm50-t i[style*='--'], .hm50-t i[data-hit], .hm50[data-flash]").length), 0, `${id}: the letters are home`);
      // A throw at a letter knocks it (its own custom properties, through the ledger).
      const box = await p.locator(".hm50-t i").nth(2).boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForFunction(() => scene.engine.running && document.querySelector(".hm50-t i[style*='--']"), null, { timeout: 5000 });
    }

    // Recall mid-play: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(id));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = hb.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, hb[make](stage, el, first)), { idle: 0 });
      await new Promise((r) => setTimeout(r, 600));
      const img = document.querySelector(".ae-slot__placeholder");
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 160 };
    }, make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("hero brawl: SMASH crumbles and rebuilds the page (rage, CLANG, flower), the hammer knocks letters and KOs into round 2; both settle with the page in place, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
