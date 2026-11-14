// Wheelie City (site/gallery/pieces/wheelie/wheelie-city.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the diorama fills the stage and draws the table view with the garage open, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide, the pad under the block). Wide, the keyboard plays it: 2 picks
// JOLT, Space starts the minute (the clock, the chase view), the autopilot banks a wheelie, Space
// held with S (the weight back) loops it out (called, the combo gone, back up), then the autopilot
// rides to the time-up card; M mutes; RIDE AGAIN resets; CHANGE RIDE opens the garage. Tall, a tap
// picks a ride and the pad's GAS key rides it. Recall mid-session gives the page back byte for byte;
// reduced motion keeps the still poster. The session itself: tests/wheelie-city.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/wheelie/wheelie-city.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/wheelie-city.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#wheelie-city" role="img" aria-label="Wheelie City" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(async () => { throw new Error(`${what}: never settled: ${await p.evaluate(() => JSON.stringify({ ...scene.state, rest: scene.run.bike.b.resting, crashed: scene.run.bike.b.crashed }))}`); });
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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, cvs.height >> 3, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .wc-key, [data-fizlet-slot] .wc-ride, [data-fizlet-slot] .wc-pad button")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        drawn: px[3] === 255,
        pad: !!document.querySelector("[data-fizlet-slot] .wc-pad").offsetParent,
        keys: keys.every(Boolean) && keys.length,
        garage: scene.state.garage,
        view: scene.state.view,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, pad: phone, keys: phone ? 9 : 6, garage: true, view: "table" }, `${at}: mounts, the poster steps aside, the diorama fills and draws the table, the garage is open, keys ≥ 44 px`);
    await settle(p, `${at}: ready`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .wc-play");
      await p.keyboard.press("Digit2");
      assert.deepEqual(await p.evaluate(() => [scene.state.ride, scene.state.garage]), ["jolt", false], `${at}: 2 picks JOLT and closes the garage`);
      await p.focus("[data-fizlet-slot] .wc-play");
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.phase === 1, null, { timeout: 5000 });
      await p.keyboard.up("Space");
      assert.equal((await st(p)).view, "chase", `${at}: Space starts the minute in the chase view`);
      // The autopilot banks a wheelie.
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.score > 0, null, { timeout: 15000 }).catch(() => assert.fail(`${at}: a wheelie scores`));
      assert.match(await p.evaluate(() => document.querySelector(".wc-toast").textContent), /WHEELIE|MANUAL|STOPPIE|HOP|BONUS|WHEELIE!|RUN!/, `${at}: the trick is called`);
      // Gas held with the weight back loops it out.
      await p.evaluate(() => (scene.auto = false));
      await p.keyboard.down("KeyS");
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 8000 }).catch(() => assert.fail(`${at}: gas and the weight back loop it out`));
      await p.keyboard.up("Space");
      await p.keyboard.up("KeyS");
      assert.match(await p.evaluate(() => document.querySelector(".wc-toast").textContent), /LOOPED OUT|OVER THE BARS|BAILED|CASED|BOTTOMED/, `${at}: the crash is called`);
      assert.equal((await st(p)).combo, 0, `${at}: the combo is gone`);
      await p.waitForFunction(() => scene.state.phase === 1, null, { timeout: 5000 });
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".wc-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.card, null, { timeout: 90000 });
      const end = await p.evaluate(() => ({ s: scene.state, t: document.querySelector(".wc-card .wc-t").textContent, x: document.querySelector(".wc-card .wc-stats").textContent }));
      assert.equal(end.s.phase, 3);
      assert.match(end.t, /^[\d,]+ pts · BEST$/, `${at}: the card has the score: ${end.t}`);
      assert.match(end.x, /^JOLT · longest wheelie [\d.]+ m .* 1 crash$/, `${at}: and the session: ${end.x}`);
      await settle(p, `${at}: time`);
      assert.equal(await frames(p), 0, `${at}: settled at the card`);
      await p.evaluate(() => document.querySelector(".wc-again").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.score, scene.state.ride]), [0, false, 0, "jolt"], `${at}: RIDE AGAIN resets on the same ride`);
      await p.evaluate(() => document.querySelector(".wc-garage-k").click());
      assert.equal((await st(p)).garage, true, `${at}: RIDE opens the garage`);
      await p.keyboard.press("Digit3");
      await p.focus("[data-fizlet-slot] .wc-play");
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.ride === "stub");
      await p.keyboard.up("Space");
    } else {
      await p.locator(".wc-ride").first().click();
      assert.deepEqual(await p.evaluate(() => [scene.state.ride, scene.state.garage]), ["volt", false], `${at}: a tap picks VOLT`);
      const gas = await p.locator(".wc-pad button[aria-label^='Gas']").boundingBox();
      await p.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.speed > 2, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: GAS rides`));
      await p.mouse.up();
    }
    // Recall mid-session: the page comes back byte for byte.
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
  console.log("wheelie-city: mounts on the table view with the garage open and settles (no audio before a gesture); wide: 2 picks JOLT, Space starts the minute, a wheelie scores, gas with the weight back loops it out, the autopilot rides to the time-up card, M mutes, RIDE AGAIN resets, RIDE opens the garage; tall: a tap picks a ride and the pad's GAS rides; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
