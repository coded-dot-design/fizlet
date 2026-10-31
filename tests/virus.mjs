// The DOM Virus pieces (#047 terminal virus, #048 petri dish), each on its own stage markup
// (site/gallery/stages/<id>.html) in Chromium: it mounts through fzlt/slot (the poster steps
// aside), plays by itself, every tap has its consequence (a worm killed and its letters written
// back exactly; a cell zapped and burst), it settles to no frames once still, destroy() mid-play
// gives the page back byte for byte, and under reduced motion nothing loads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const PIECES = [
  { id: "terminal-virus", module: "pieces/terminal-virus.ts" },
  { id: "petri-dish", module: "pieces/petri-dish.ts" },
];
const browser = await chromium.launch(launchOptions());
const frames = (p, n = 4) => p.evaluate((n) => new Promise((ok) => { const f = () => (n-- ? requestAnimationFrame(f) : ok()); f(); }), n);
try {
  for (const piece of PIECES) {
    const js = (await build({
      stdin: { contents: `export { slot } from "./src/slot.ts"; export { mount } from ${JSON.stringify("./site/gallery/" + piece.module)};`, resolveDir: process.cwd(), loader: "ts" },
      bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
    })).outputFiles[0].text;
    const stageHtml = readFileSync(`site/gallery/stages/${piece.id}.html`, "utf8").trim();
    const PAGE = `<!doctype html><html data-theme="dark"><meta charset="utf-8"><body style="margin:0">
<main id="page"><div style="width:800px;padding:40px"><figure class="ae-slot gal-fig gal-own" data-slot-target="gallery#${piece.id}" role="img" aria-label="${piece.id}" style="position:relative;margin:0;aspect-ratio:16 / 9;overflow:hidden">${stageHtml}</figure></div>
<p>Copy after the piece.</p></main><script>${js}</script></body></html>`;
    const open = async (opts = {}) => {
      const p = await browser.newPage({ viewport: { width: 900, height: 700 }, ...opts });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(PAGE);
      await p.evaluate(() => {
        window.before = document.getElementById("page").innerHTML;
        const fig = document.querySelector("figure.ae-slot");
        window.host = fz.slot(fig, () => (stage, el, first) => (window.scene = fz.mount(stage, el, first)), { idle: 0 });
      });
      return { p, errs };
    };
    // A tap on the scene's thing number i (a worm, a cell), where it is now.
    const tapThing = async (p) => {
      const at = await p.evaluate(() => scene.worm(0));
      if (!at) return false;
      const b = await p.locator("figure").boundingBox();
      await p.mouse.click(b.x + at.x, b.y + at.y);
      await frames(p, 2);
      return true;
    };

    const { p, errs } = await open();
    await p.waitForFunction(() => window.scene);
    const up = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(up, { canvas: true, poster: "none" }, `${piece.id}: mounts its canvas, the poster steps aside`);

    if (piece.id === "terminal-virus") {
      // The worm crawls out and eats real letters of the README (its own text nodes change).
      const text0 = await p.locator("[data-tv-doc]").textContent();
      await p.waitForFunction(() => scene.state.eaten >= 3, null, { timeout: 8000 });
      assert.notEqual(await p.locator("[data-tv-doc]").textContent(), text0, "the README's letters are eaten");
      assert.match(await p.locator("[data-tv-log]").textContent(), /curl -s dom\.virus \| sh/, "it typed itself in");
      // Kill every worm: each kill rolls its letters back, and the page reads exactly as before.
      for (let i = 0; i < 60 && (await p.evaluate(() => scene.state.live)); i++) await tapThing(p);
      assert.ok((await p.evaluate(() => scene.state.kills)) >= 1, "a tap kills a worm");
      await p.waitForFunction(() => scene.state.phase === 4 && scene.state.eaten === 0, null, { timeout: 8000 });
      assert.equal(await p.locator("[data-tv-doc]").textContent(), text0, "every chewed letter is written back");
      assert.match(await p.locator("[data-tv-log]").textContent(), /kill -9 \d+/, "the terminal logs the kill");
    } else {
      // Cells are cultured; a zap on one bursts it (a mutant takes two).
      await p.waitForFunction(() => scene.state.cells >= 2, null, { timeout: 4000 });
      // A miss scorches the agar and counts as a zap.
      const z0 = await p.evaluate(() => scene.state.zaps);
      const b = await p.locator("figure").boundingBox();
      await p.mouse.click(b.x + 4, b.y + 4);
      await frames(p, 2);
      assert.equal(await p.evaluate(() => scene.state.zaps), z0 + 1, "every tap is a zap");
      const b0 = await p.evaluate(() => scene.state.burst);
      await tapThing(p);
      await tapThing(p);
      await tapThing(p);
      assert.ok((await p.evaluate(() => scene.state.burst)) > b0, "a zap bursts a cell");
      // Zap them all: STERILE.
      for (let i = 0; i < 120 && (await p.evaluate(() => scene.state.phase === 0)); i++) await tapThing(p);
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 8000 });
    }
    // Then it settles: no frames at all.
    await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 12000 });
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      // 30 page frames (not wall time): a settled engine takes none of them.
      for (let f = 0; f < 30; f++) await new Promise(requestAnimationFrame);
      return scene.engine.stats().frames - a;
    });
    assert.equal(still, 0, `${piece.id}: settled, no frames`);
    // A tap starts it again (reinfect / a new culture), and destroy() mid-play gives the page back.
    const bb = await p.locator("figure").boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.7, bb.y + bb.height * 0.5);
    await p.waitForTimeout(piece.id === "terminal-virus" ? 2600 : 600);
    assert.ok(!(await p.evaluate(() => scene.engine.paused.includes("settled"))), `${piece.id}: a tap plays it again`);
    if (piece.id === "terminal-virus") await p.waitForFunction(() => scene.state.eaten > 0, null, { timeout: 8000 });
    const back = await p.evaluate(() => (host.destroy(), document.getElementById("page").innerHTML === window.before));
    assert.ok(back, `${piece.id}: destroy() mid-play gives the page back byte for byte`);
    assert.deepEqual(errs, [], `${piece.id}: no page errors`);
    await p.close();

    // Reduced motion: the poster stays, the scene never loads.
    const rm = await open({ reducedMotion: "reduce" });
    await rm.p.waitForTimeout(600);
    assert.equal(await rm.p.evaluate(() => !!window.scene), false, `${piece.id}: reduced motion loads nothing`);
    assert.notEqual(await rm.p.evaluate(() => getComputedStyle(document.querySelector(".ae-slot__placeholder")).display), "none", `${piece.id}: the poster stays`);
    await rm.p.close();
    console.log(`ok ${piece.id}`);
  }
} finally {
  await browser.close();
}
