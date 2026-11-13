// Dune Hop (site/gallery/pieces/dune/dune-hop.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet, as the gallery has them), mounted through @fzlt/core/slot: it
// mounts (the poster steps aside), the diorama fills the stage and draws the table view, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide, the pad under the course). Wide, the keyboard plays it: ↑ starts
// the run (the clock, the chase view), the autopilot takes it to a jump, ↓ held in the air noses it
// in (a crash, a respawn at the last gate), then on through both laps to the finish card; M mutes;
// R restarts. Tall, the pad's GAS key drives it. Recall mid-run gives the page back byte for byte;
// reduced motion keeps the still poster. The run itself: tests/dune-hop.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/dune/dune-hop.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/dune-hop.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#dune-hop" role="img" aria-label="Dune Hop" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });
const st = (p) => p.evaluate(() => scene.state);

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    await p.waitForFunction(() => scene.engine.stats().frames > 2);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), fig = r("figure"), art = r("[data-fizlet-slot] canvas");
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .dh-key, [data-fizlet-slot] .dh-pad button")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        backing: cvs.width >= Math.floor(art.width) && cvs.height >= Math.floor(art.height),
        drawn: px[3] === 255,
        pad: !!document.querySelector("[data-fizlet-slot] .dh-pad").offsetParent,
        keys: keys.every(Boolean) && keys.length,
        view: scene.state.view,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, backing: true, drawn: true, pad: phone, keys: phone ? 6 : 2, view: "table" }, `${at}: mounts, the poster steps aside, the diorama fills and draws the table, keys ≥ 44 px`);
    await settle(p, `${at}: ready`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .dh-play");
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.speed > 2, null, { timeout: 5000 });
      await p.keyboard.up("ArrowUp");
      assert.equal((await st(p)).view, "chase", `${at}: ↑ starts the run in the chase view`);
      assert.ok((await st(p)).clock > 0, `${at}: the clock runs`);
      // The autopilot to the first jump past gate 1; ↓ held in the air noses it in.
      await p.evaluate(() => (scene.auto = true));
      // (In the page, on the frame it takes off: a round trip from here would miss the jump.)
      const gate = await p.evaluate(() => new Promise((ok) => {
        const tick = () => {
          if (scene.state.gate >= 2 && scene.state.air > 0) {
            document.querySelector("[data-fizlet-slot] .dh-play").dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown", key: "ArrowDown", bubbles: true }));
            return ok(scene.run.S[3]);
          }
          requestAnimationFrame(tick);
        };
        tick();
      }));
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: ↓ in the air crashes`));
      await p.evaluate(() => document.querySelector("[data-fizlet-slot] .dh-play").dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown", key: "ArrowDown", bubbles: true })));
      assert.match(await p.evaluate(() => document.querySelector(".dh-toast").textContent), /WIPEOUT|OFF THE TABLE/, `${at}: the crash is called`);
      await p.waitForFunction(() => scene.state.phase === 1, null, { timeout: 5000 });
      assert.equal(await p.evaluate(() => scene.run.S[3]), gate, `${at}: back at the last gate`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".dh-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // On to the finish.
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.card, null, { timeout: 60000 });
      const end = await p.evaluate(() => ({ s: scene.state, t: document.querySelector(".dh-card .dh-t").textContent }));
      assert.equal(end.s.phase, 3);
      assert.equal(end.s.crashes, 1, `${at}: one crash on the card`);
      assert.match(end.t, /^\d:\d\d\.\d · BEST$/, `${at}: the finish card has the time: ${end.t}`);
      await settle(p, `${at}: finished`);
      assert.equal(await frames(p), 0, `${at}: settled at the finish`);
      await p.evaluate(() => document.querySelector(".dh-again").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.clock]), [0, false, 0], `${at}: RUN AGAIN resets`);
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.state.phase === 1);
      await p.keyboard.up("ArrowUp");
    } else {
      // The pad's GAS key, held, drives it.
      const gas = await p.locator(".dh-pad button[aria-label^='Gas']").boundingBox();
      await p.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.speed > 2, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: GAS drives`));
      await p.mouse.up();
    }
    // Recall mid-run: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(720, false));
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, "reduced motion keeps the poster");
  await ctx.close();
  console.log("dune-hop: mounts on the table view and settles (no audio before a gesture); wide: ↑ starts the run, ↓ in the air crashes it back to the last gate, both laps to the finish card, M mutes, RUN AGAIN resets; tall: the pad's GAS drives; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
