// The artillery duels (Pricing war, Hill war) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does, Math.random
// seeded (each draws its duel's winner from it). Each: left alone it plays a duel to a KO, mends
// and settles to no frames with the page exactly as it was; taps have their consequence (Pricing
// war: one tap a fast shell, a double tap a bomb, PRO fires back, blocks crumble, a KO; Hill war: a
// chip picks the weapon, a tap on your turn fires, the hill is dug, the other side answers, the MEGA
// is spent once, a KO); Recall mid-play gives the page back byte for byte; reduced motion keeps the
// still poster (the scene never mounts). Waits are on state and frames, never wall time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { war } from "./site/gallery/pieces/pricing-war-forts-fire-back.ts"; export { hills } from "./site/gallery/pieces/hill-war-pick-weapon-mind-wind.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "ar", write: false, logLevel: "silent",
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

// Frames, not time: `until` steps one animation frame at a time.
const UNTIL = `async (f, cap = 3600) => { for (let i = 0; i < cap && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }`;

const settle = async (p) => {
  await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 90000, polling: 100 });
  return p.evaluate(async (same) => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    return { more: scene.engine.stats().frames - a, same: new Function(`return (${same})()`)() };
  }, SAME.toString());
};

const browser = await chromium.launch(launchOptions());
try {
  for (const [id, make, seed] of [["pricing-war-forts-fire-back", "war", +(process.env.SEED ?? 7)], ["hill-war-pick-weapon-mind-wind", "hills", +(process.env.SEED ?? 7)]]) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.addInitScript((seed) => {
      let s = seed;
      Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    }, seed);
    await p.setContent(page(id));
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = ar.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = ar[make](stage, el, first)), { idle: 0 });
    }, make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas on the stage; the poster steps aside`);

    // Left alone: a duel to a KO (someone wins), then the page mends and the engine sleeps.
    const auto = await p.evaluate(async ([u, make]) => {
      const until = eval(u);
      let hit = false;
      await until(() => ((hit ||= make === "war" ? scene.broken > 0 : scene.dug > 0), scene.winner >= 0), 60 * 60);
      return { hit, winner: scene.winner };
    }, [UNTIL, make]);
    assert.ok(auto.hit && auto.winner >= 0, `${id}: plays a duel on its own, hits land, someone wins (${auto.winner})`);
    assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: after the duel the page is whole and it sleeps`);

    if (make === "war") {
      // Two taps in a beat: a bomb. Then one tap: a fast shell. (PRO answers each.)
      const shots = await p.evaluate(async (u) => {
        const until = eval(u);
        scene.tap(132, 30);
        scene.tap(132, 30);
        await until(() => scene.big === 1, 60);
        const two = scene.big;
        await until(() => scene.engine.paused.includes("settled"), 60 * 30);
        scene.tap(132, 30);
        await until(() => scene.big === 0, 60);
        return { one: scene.big, two };
      }, UNTIL);
      assert.deepEqual(shots, { one: 0, two: 1 }, `${id}: one tap is a fast shell, a double tap a bomb`);
      // Bombs on PRO's mascot until someone is KO'd; a crumbled block is hidden on the page meanwhile.
      const ko = await p.evaluate(async (u) => {
        const until = eval(u);
        let gone = false;
        for (let i = 0; i < 20 && scene.winner < 0; i++) {
          await until(() => scene.mode === 0, 600);
          scene.tap(132, 30);
          scene.tap(132, 30);
          await until(() => ((gone ||= !!document.querySelector(".pwar i[data-gone]")), scene.winner >= 0), 150);
        }
        return { gone, winner: scene.winner };
      }, UNTIL);
      assert.ok(ko.gone && ko.winner >= 0, `${id}: bombs crumble blocks and end in a KO (winner ${ko.winner})`);
      assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: the forts rebuilt after the KO, settled`);
      // A real click on a block wakes it and fires.
      const box = await p.locator(".pwar .b.btn").boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForFunction(() => scene.engine.running && document.querySelector(".pwar i[data-gone], .pwar i[style*='--']"), null, { timeout: 10000 });
    } else {
      // Your turn, asleep. A chip picks the weapon (the page's own button lights up).
      assert.deepEqual(await p.evaluate(() => [scene.turn, scene.mode]), [0, 0], `${id}: after the duel it is your turn`);
      const chip = await p.evaluate(async (u) => {
        const until = eval(u);
        scene.tap(30, 6);
        await until(() => document.querySelector(".hwar .c[data-on]")?.textContent === "CLUSTER", 60);
        return document.querySelector(".hwar .c[data-on]").textContent;
      }, UNTIL);
      assert.equal(chip, "CLUSTER", `${id}: a chip picks the weapon`);
      // A tap fires; the hill is dug; the other side answers; then it is your turn again.
      const turn = await p.evaluate(async (u) => {
        const until = eval(u);
        const dug = scene.dug;
        scene.tap(136, 45);
        await until(() => scene.turn === 1, 600);
        const answered = await until(() => scene.turn === 0 && scene.mode === 0, 900);
        return { dug: scene.dug > dug, answered };
      }, UNTIL);
      assert.deepEqual(turn, { dug: true, answered: true }, `${id}: your shot digs the hill, the other side answers`);
      // The MEGA: once a round (its chip is spent), and a tap on it after does nothing.
      const mega = await p.evaluate(async (u) => {
        const until = eval(u);
        scene.tap(73, 6);
        await until(() => document.querySelector(".hwar .c[data-on]")?.textContent === "MEGA", 60);
        scene.tap(136, 45);
        await until(() => !!document.querySelector(".hwar .c[data-spent]"), 120);
        const spent = document.querySelector(".hwar .c[data-spent]")?.textContent;
        await until(() => (scene.turn === 0 && scene.mode === 0) || scene.winner >= 0, 900);
        scene.tap(73, 6);
        await until(() => false, 10);
        return { spent, on: document.querySelector(".hwar .c[data-on]")?.textContent };
      }, UNTIL);
      assert.deepEqual(mega, { spent: "MEGA", on: "BALL" }, `${id}: the MEGA is spent once used`);
      // Shots until a KO; the hills grow back, the words fly home.
      const ko = await p.evaluate(async (u) => {
        const until = eval(u);
        for (let i = 0; i < 30 && scene.winner < 0; i++) {
          await until(() => (scene.turn === 0 && scene.mode === 0) || scene.winner >= 0, 900);
          if (scene.winner < 0) scene.tap(136 - scene.wind * 0.6, 44);
          await until(() => scene.mode !== 0 || scene.winner >= 0, 30);
        }
        return scene.winner;
      }, UNTIL);
      assert.ok(ko >= 0, `${id}: the duel ends in a KO (winner ${ko})`);
      assert.deepEqual(await settle(p), { more: 0, same: true }, `${id}: the hills grew back, the words are home, settled`);
      // A real click wakes it and fires (the hill is dug).
      const box = await p.locator("figure").boundingBox();
      await p.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.45);
      await p.waitForFunction(() => scene.engine.running && scene.mode === 1, null, { timeout: 10000 });
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
      const s = ar.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, ar[make](stage, el, first)), { idle: 0 });
      for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
      const img = document.querySelector(".ae-slot__placeholder");
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 160 };
    }, make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("artillery: Pricing war (tap a shell, double-tap a bomb, PRO fires back, blocks crumble, KO) and Hill war (chips, turns, wind, craters, MEGA once, KO) both duel on their own, mend and settle with the page in place, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
