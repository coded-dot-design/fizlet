// The three hand-built comic pieces of the gallery (#20 POW BAM ZAP, #21 speed lines, #22 halftone
// press), each on its own stage markup (site/gallery/stages/<id>.html) in Chromium: it mounts
// through fzlt/slot (the poster steps aside), plays its first move by itself and settles (no
// frames), clicks have their consequences (hits and a KO, letters bowled over, plates printed and
// a cover finished), real letters move only while hit and keep no inline property once they rest,
// and destroy() mid-move gives the page back exactly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const PIECES = [
  { id: "pow-bam-zap-comic-bursts", module: "pieces/pow-bam-zap.ts" },
  { id: "speed-lines-rush-past-heading", module: "pieces/speed-lines.ts" },
  { id: "halftone-dot-wave-reveals-heading", module: "pieces/halftone-press.ts" },
];

const browser = await chromium.launch(launchOptions());
const settled = (p) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 12000 });
// A click on the figure at art pixel (x, y) of the 160 × 90 grid.
const click = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  await p.mouse.click(b.x + (b.width * x) / 160, b.y + (b.height * y) / 90);
};
try {
  for (const piece of PIECES) {
    const js = (await build({
      stdin: { contents: `export { slot } from "./src/slot.ts"; export { mount } from ${JSON.stringify("./site/gallery/" + piece.module)};`, resolveDir: process.cwd(), loader: "ts" },
      bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
    })).outputFiles[0].text;
    const stageHtml = readFileSync(`site/gallery/stages/${piece.id}.html`, "utf8").trim();
    const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<main id="page"><div class="gal-stage" style="width:800px;padding:40px"><figure class="ae-slot gal-fig gal-own" data-slot-target="gallery#${piece.id}" role="img" aria-label="${piece.id}" style="position:relative;margin:0;aspect-ratio:16 / 9;overflow:hidden">${stageHtml}</figure></div>
<p>Copy after the piece.</p></main><script>${js}</script></body>`;
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const mountIt = () => p.evaluate(() => {
      window.before = document.getElementById("page").innerHTML;
      const fig = document.querySelector("figure.ae-slot");
      window.host = fz.slot(fig, () => (stage, el, first) => (window.scene = fz.mount(stage, el, first)), { idle: 0 });
    });
    await mountIt();
    await p.waitForFunction(() => window.scene);
    const up = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
      hidden: document.querySelector("[data-fizlet-slot]").getAttribute("aria-hidden"),
    }));
    assert.deepEqual(up, { canvas: true, poster: "none", hidden: "true" }, `${piece.id}: mounts its canvas, the poster steps aside`);

    // Plays its first move by itself, then settles: no frames at all.
    await p.waitForTimeout(400);
    assert.ok(await p.evaluate(() => scene.engine.stats().frames > 5), `${piece.id}: plays by itself`);
    await settled(p);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 500));
      return scene.engine.stats().frames - a;
    });
    assert.equal(still, 0, `${piece.id}: settled, no frames`);

    // Clicks have consequences.
    if (piece.id.startsWith("pow")) {
      // A click on the Glitch lands (one pip off it); a click on empty sky misses and it hits back.
      const hp0 = await p.evaluate(() => scene.hp);
      await click(p, 118, 66);
      await p.waitForFunction((h) => scene.hp[1] === h - 1, hp0[1], { timeout: 3000 });
      await settled(p);
      await click(p, 20, 40);
      await p.waitForFunction((h) => scene.hp[0] === h - 1, hp0[0], { timeout: 3000 });
      // Keep hitting it: a KO, then it drops back in with its pips back. Wherever it dodges to.
      for (let i = 0; i < 6 && (await p.evaluate(() => scene.score[0])) === 0; i++) {
        await settled(p);
        await click(p, 118, 66); // the first Glitch stands its ground
        await p.waitForTimeout(250);
      }
      assert.deepEqual(await p.evaluate(() => scene.score), [1, 0], "pow: a KO for the hero");
      await settled(p);
      assert.ok(await p.evaluate(() => scene.hp[1] > 4), "pow: the next Glitch drops in with more pips");
    } else if (piece.id.startsWith("speed")) {
      // A run through the second line bowls letters over: they move (through the ledger) only
      // while hit, then rest with the page exactly as it was.
      const resting = () => p.evaluate(() => [...document.querySelectorAll(".sl-h i")].filter((i) => i.style.length || i.hasAttribute("data-hit")).length);
      await settled(p);
      assert.equal(await resting(), 0, "speed: every letter at rest after the first run");
      const best = await p.evaluate(() => scene.best);
      assert.ok(best > 0, `speed: the first run bowls letters (${best})`);
      await click(p, 80, 50);
      await p.waitForFunction(() => document.querySelector(".sl-h i[style]"), null, { timeout: 3000 });
      await settled(p);
      assert.ok(await p.evaluate(() => scene.pins > 0), "speed: the second run bowls too");
      assert.equal(await resting(), 0, "speed: every letter at rest again (no inline property left)");
    } else {
      // The auto press laid yellow; three more clicks lay M, C and K: the cover is done and its
      // title (hidden on a blank sheet, dots while the black plate reaches it) is crisp again.
      assert.equal(await p.evaluate(() => scene.plates), 1, "press: the yellow plate by itself");
      assert.ok(await p.evaluate(() => document.querySelectorAll(".ht-t i[data-print]").length > 0), "press: the title waits for the black plate");
      for (let i = 0; i < 3; i++) await click(p, 40 + i * 30, 40), await p.waitForTimeout(150);
      await settled(p);
      assert.deepEqual(await p.evaluate(() => [scene.plates, scene.prints, [...document.querySelectorAll(".ht-t i")].filter((i) => i.style.length || i.hasAttribute("data-print")).length]), [4, 1, 0], "press: four plates, one cover, the title crisp");
      // A click on a finished cover pulls it; the fresh sheet is blank (its title hidden again).
      await click(p, 80, 40);
      await settled(p);
      assert.equal(await p.evaluate(() => scene.plates), 0, "press: a fresh sheet");
    }

    // destroy() mid-move: the page is back byte for byte.
    await click(p, 118, 30);
    await p.waitForTimeout(260);
    await p.evaluate(() => host.destroy());
    assert.equal(await p.evaluate(() => document.getElementById("page").innerHTML), await p.evaluate(() => before), `${piece.id}: destroy gives the page back exactly`);
    assert.deepEqual(errs, [], `${piece.id}: no page errors`);
    await p.close();
    console.log(`${piece.id}: mounts, settles, clicks land, letters rest, destroy restores`);
  }
} finally {
  await browser.close();
}
