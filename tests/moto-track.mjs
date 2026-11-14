// Moto Track (site/gallery/pieces/bikes/moto-track.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through @fzlt/core/slot:
// it mounts (the poster steps aside) on the bike pick over the table view and settles to no frames
// with no audio before a gesture; every key is 44 px or more, wide (720) and tall (the phone shape, 358
// wide, the pad under the track). Wide, the keyboard plays it: 1 picks the 2-stroke, the countdown
// holds everyone at the gate while Space revs, the gate drops and the clock runs in the chase view; a
// loop-out is called and the rider is back on it; the autopilot takes it through three laps to the
// finish card (place and time); M mutes; RACE AGAIN lines up again; R goes back to the pick. Tall, a
// tap on the 4-STROKE and the pad's GAS key ride it. Recall mid-race gives the page back byte for
// byte; reduced motion keeps the still poster. The bike and the race themselves: tests/moto-track.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/bikes/moto-track.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/moto-track.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#moto-track" role="img" aria-label="Moto Track" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, cvs.height - 4, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .mt-key, [data-fizlet-slot] .mt-pad button, [data-fizlet-slot] .mt-bike")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        drawn: px[3] === 255,
        pad: !!document.querySelector("[data-fizlet-slot] .mt-pad").offsetParent,
        keys: keys.every(Boolean) && keys.length,
        pick: scene.state.pick,
        view: scene.state.view,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, pad: phone, keys: phone ? 6 : 4, pick: true, view: "table" }, `${at}: mounts on the bike pick over the table, keys ≥ 44 px`);
    await settle(p, `${at}: the pick`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .mt-play");
      await p.keyboard.press("Digit1");
      const g = await st(p);
      assert.deepEqual([g.pick, g.phase, g.bike, g.view], [false, 1, "2-STROKE", "chase"], `${at}: 1 picks the 2-stroke and lines up at the gate`);
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.count < 1.5);
      assert.ok(Math.abs((await st(p)).speed) < 0.05, `${at}: the gate holds it while it revs`);
      await p.waitForFunction(() => scene.state.phase === 2 && scene.state.speed > 3, null, { timeout: 6000 }).catch(() => assert.fail(`${at}: the gate drops and it goes`));
      await p.keyboard.up("Space");
      assert.match(await p.evaluate(() => document.querySelector(".mt-toast").textContent), /GATE DROP|^\d$/, `${at}: the gate is called`);
      // A loop-out: called, the tumble, back on it.
      await p.evaluate(() => scene.race.riders[0].knock(1));
      await p.waitForFunction(() => /LOOPED OUT/.test(document.querySelector(".mt-toast").textContent));
      await p.waitForFunction(() => !scene.race.riders[0].crashed, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: back on it after the crash`));
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".mt-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.card, null, { timeout: 90000 });
      const end = await p.evaluate(() => ({ s: scene.state, p: document.querySelector(".mt-card > b").textContent, t: document.querySelector(".mt-card .mt-t").textContent }));
      assert.equal(end.s.phase, 3);
      assert.equal(end.s.crashes, 1, `${at}: one crash on the card`);
      assert.match(end.p, /^(1ST|2ND|3RD|4TH)$/, `${at}: the place: ${end.p}`);
      assert.match(end.t, /^\d:\d\d\.\d · BEST$/, `${at}: the time: ${end.t}`);
      await settle(p, `${at}: finished`);
      assert.equal(await frames(p), 0, `${at}: settled at the finish`);
      await p.evaluate(() => document.querySelector(".mt-re").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.clock]), [1, false, 0], `${at}: RACE AGAIN lines up again`);
      await p.keyboard.press("r");
      assert.equal((await st(p)).pick, true, `${at}: R goes back to the pick`);
    } else {
      // Tap the 4-stroke, then hold the pad's GAS key through the gate.
      await p.locator(".mt-bike[data-b='1']").tap();
      assert.equal((await st(p)).bike, "4-STROKE", `${at}: a tap picks the 4-stroke`);
      const gas = await p.locator(".mt-pad button[aria-label^='Gas']").boundingBox();
      await p.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.state.phase === 2 && scene.state.speed > 2, null, { timeout: 8000 }).catch(() => assert.fail(`${at}: GAS rides it`));
      await p.mouse.up();
    }
    // Recall mid-race: the page comes back byte for byte.
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
  console.log("moto-track: mounts on the bike pick and settles (no audio before a gesture); wide: 1 picks, the gate holds while it revs and drops, a loop-out is called and it is back on, three laps to the finish card, M mutes, RACE AGAIN, R to the pick; tall: a tap picks, the pad's GAS rides; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
