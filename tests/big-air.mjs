// Big Air (site/gallery/pieces/bikes/big-air.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster steps
// aside) on the bike pick over the arena and settles to no frames with no audio before a gesture;
// every key is 44 px or more, wide (720) and tall (358, the pad under the arena). Wide, the keyboard
// plays it: 1 picks the 2-stroke, it waits (settled) for the gas, Space starts the minute in the chase
// view; the autopilot to the first lip, then L held with no stick puts out a SKY PLANK, called, and
// held through the landing it is a bail; on through the minute to the judges' card (five scores); M
// mutes; RIDE AGAIN; R back to the pick. Tall, a tap on the 4-STROKE and the pad's GAS ride it, and the
// pad's TRICK key is there. Recall mid-run gives the page back byte for byte; reduced motion keeps the
// still poster. The run and the scorer themselves: tests/big-air.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/bikes/big-air.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/big-air.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#big-air" role="img" aria-label="Big Air" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .ba-key, [data-fizlet-slot] .ba-pad button, [data-fizlet-slot] .ba-bike")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        drawn: px[3] === 255,
        pad: !!document.querySelector("[data-fizlet-slot] .ba-pad").offsetParent,
        keys: keys.every(Boolean) && keys.length,
        pick: scene.state.pick,
        view: scene.state.view,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, pad: phone, keys: phone ? 7 : 4, pick: true, view: "arena" }, `${at}: mounts on the bike pick over the arena, keys ≥ 44 px`);
    await settle(p, `${at}: the pick`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .ba-play");
      await p.keyboard.press("Digit1");
      const g = await st(p);
      assert.deepEqual([g.pick, g.phase, g.bike, g.view], [false, 1, "2-STROKE", "chase"], `${at}: 1 picks the 2-stroke, ready in the chase view`);
      await settle(p, `${at}: ready`);
      assert.equal(await frames(p), 0, `${at}: it waits for the gas, settled`);
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.phase === 2 && scene.state.clock < 59.8, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: Space starts the minute`));
      await p.keyboard.up("Space");
      // The autopilot to the first lip; then L held (no stick): a SKY PLANK, held through the landing: a bail.
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.air > 0.1, null, { timeout: 10000 });
      await p.evaluate(() => {
        scene.auto = false;
        document.querySelector("[data-fizlet-slot] .ba-play").dispatchEvent(new KeyboardEvent("keydown", { code: "KeyL", key: "l", bubbles: true }));
      });
      await p.waitForFunction(() => /SKY PLANK/.test(document.querySelector(".ba-toast").textContent), null, { timeout: 3000 }).catch(() => assert.fail(`${at}: L puts out a SKY PLANK`));
      await p.waitForFunction(() => /BAILED/.test(document.querySelector(".ba-toast").textContent), null, { timeout: 5000 }).catch(() => assert.fail(`${at}: held through the landing: a bail`));
      await p.evaluate(() => document.querySelector("[data-fizlet-slot] .ba-play").dispatchEvent(new KeyboardEvent("keyup", { code: "KeyL", key: "l", bubbles: true })));
      assert.equal((await st(p)).crashes, 1, `${at}: one crash`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".ba-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await p.evaluate(() => (scene.auto = true));
      await p.waitForFunction(() => scene.state.card, null, { timeout: 90000 });
      const end = await p.evaluate(() => ({ s: scene.state, j: [...document.querySelectorAll(".ba-judges span")].map((s) => s.textContent), t: document.querySelector(".ba-card .ba-t").textContent }));
      assert.equal(end.s.phase, 3);
      assert.equal(end.j.length, 5, `${at}: five judges`);
      assert.ok(end.j.every((x) => /^\d+\.\d$/.test(x)), `${at}: their scores: ${end.j.join(" ")}`);
      assert.match(end.t, /^\d+\.\d · BEST$/, `${at}: the total: ${end.t}`);
      await settle(p, `${at}: the judges`);
      assert.equal(await frames(p), 0, `${at}: settled on the card`);
      await p.evaluate(() => document.querySelector(".ba-re").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.clock, scene.state.score]), [1, false, 60, 0], `${at}: RIDE AGAIN`);
      await p.keyboard.press("r");
      assert.equal((await st(p)).pick, true, `${at}: R goes back to the pick`);
    } else {
      await p.locator(".ba-bike[data-b='1']").tap();
      assert.equal((await st(p)).bike, "4-STROKE", `${at}: a tap picks the 4-stroke`);
      assert.ok(await p.locator(".ba-pad button[aria-label^='Trick']").isVisible(), `${at}: the pad has TRICK`);
      const gas = await p.locator(".ba-pad button[aria-label^='Gas']").boundingBox();
      await p.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.state.phase === 2 && scene.show.b.speed > 2, null, { timeout: 8000 }).catch(() => assert.fail(`${at}: GAS rides it`));
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
  console.log("big-air: mounts on the bike pick and settles (no audio before a gesture); wide: 1 picks, it waits settled, Space starts the minute, L puts out a SKY PLANK and held through the landing it is a bail, on to the five judges, M mutes, RIDE AGAIN, R to the pick; tall: a tap picks, the pad has TRICK, GAS rides; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
