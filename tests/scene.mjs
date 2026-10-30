// fizlet/scene in Chromium: the three meme micros ported from code to scene data draw the same
// pixels as the recipe code they replace (site/gallery/scenes/meme.ts), frame for frame, through
// the whole run, a tap replay and the rest frame (fx's own random seeded the same for both). Both engines run by hand on the same clock
// (engine.advance), so the comparison is exact: every pixel of every frame. Also: both settle on
// the same step, the reduced-motion poster is the rest frame, and destroy() gives the stage back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

// [entry id, the meme params its old generated module passed] (from git: site/gallery/anims/<id>.ts).
const PORTS = [
  ["moon-rocket-launches-off-button", { bit: "rocket", colors: ["#ff2e88", "#19f0ff", "#ffc21a", "#ffc21a", "#f6f3ff"], loop: 0, scale: 1 }],
  ["laser-eyes-mascot-powers-fires", { bit: "laser", colors: ["#ff8a1f", "#ff2b4e", "#ffc21a", "#ff2e88", "#f6f3ff"], loop: 0, scale: 1 }],
  ["candle-chart-pumps-dumps", { bit: "candles", colors: ["#39ffb0", "#ff2b4e", "#ffc21a", "#f6f3ff", "#f6f3ff"], loop: 0, scale: 1 }],
];
const data = Object.fromEntries(PORTS.map(([id]) => [id, JSON.parse(readFileSync(`site/gallery/anims/${id}.scene.json`, "utf8"))]));

const bundle = (await build({
  stdin: { contents: 'export { meme } from "./site/gallery/scenes/meme.ts"; export { mountScene } from "./src/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div id="a" style="position:relative;width:320px;height:180px"></div>
<div id="b" style="position:relative;width:320px;height:180px"></div><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  for (const [id, params] of PORTS) {
    const p = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async ({ params, data }) => {
      const A = document.getElementById("a"), B = document.getElementById("b"), before = [A.outerHTML, B.outerHTML];
      // fizlet/fx seeds its visual randomness from Math.random (on purpose: every run differs): the
      // same seed for both, so their particles match too.
      const rand = Math.random;
      Math.random = () => 0.4242;
      const old = fz.meme(A, params), now = fz.mountScene(B, data, { motion: true });
      Math.random = rand;
      // Off the shared clock: both move only when advanced here, by the same steps.
      old.engine.stop(), now.engine.stop();
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const ca = A.querySelector("canvas"), cb = B.querySelector("canvas");
      const px = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const settled = (s) => s.engine.stats().paused.includes("settled");
      const out = { frames: 0, diff: [], settleA: -1, settleB: -1 };
      const run = (n, tag) => {
        for (let i = 0; i < n; i++, out.frames++) {
          old.engine.advance(1 / 60), now.engine.advance(1 / 60);
          const a = px(ca), b = px(cb);
          let d = 0;
          for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d++;
          if (d && out.diff.length < 5) out.diff.push(`${tag} frame ${i}: ${d} bytes differ`);
          if (out.settleA < 0 && settled(old)) out.settleA = out.frames;
          if (out.settleB < 0 && settled(now)) out.settleB = out.frames;
        }
      };
      run(Math.round((data.stage.end + 1.2) * 60), "first play");
      const rest = px(cb);
      out.size = [cb.width, cb.height];
      // A tap plays it again: both from the start.
      for (const el of [A, B]) el.firstElementChild.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      out.settleA = out.settleB = -1;
      const replayFrom = out.frames;
      run(Math.round((data.stage.end + 1.2) * 60), "replay");
      out.settleA -= replayFrom, out.settleB -= replayFrom;
      old.destroy(), now.destroy();
      out.recall = A.outerHTML === before[0] && B.outerHTML === before[1];
      // Reduced motion: the poster is the rest frame, drawn at once; no cues fire.
      const still = fz.mountScene(B, data, { motion: false });
      still.engine.stop();
      await new Promise((ok) => requestAnimationFrame(ok));
      still.engine.advance(1 / 60);
      const pb = px(B.querySelector("canvas"));
      let pd = 0;
      for (let k = 0; k < pb.length; k++) if (pb[k] !== rest[k]) pd++;
      out.poster = pd;
      out.posterLive = still.engine.stats().paused;
      still.destroy();
      return out;
    }, { params, data: data[id] });
    await p.close();
    assert.deepEqual(errs, [], `${id}: page errors`);
    assert.deepEqual(r.size, [320, 180], `${id}: canvas fills the stage`);
    assert.deepEqual(r.diff, [], `${id}: scene data draws what the recipe code drew (${r.frames} frames compared)`);
    assert.ok(r.settleA > 0 && r.settleB > 0, `${id}: both settle (code ${r.settleA}, data ${r.settleB})`);
    assert.ok(Math.abs(r.settleA - r.settleB) <= 1, `${id}: settled within a step of each other (code ${r.settleA}, data ${r.settleB})`);
    assert.equal(r.recall, true, `${id}: destroy() gives both stages back byte for byte`);
    assert.equal(r.poster, 0, `${id}: the reduced-motion poster is the rest frame`);
    console.log(`scene ${id}: ${r.frames} frames pixel-identical to the recipe code; settled at step ${r.settleB} (code ${r.settleA}); poster = rest frame; Recall exact`);
  }
} finally {
  await browser.close();
}
