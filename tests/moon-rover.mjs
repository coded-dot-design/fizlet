// Moon Rover (site/gallery/pieces/orb/moon-rover.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the moon fills the stage and draws, it settles with no audio before a gesture, keys
// are 44 px or more, wide (720) and tall (the phone shape, 358 wide, the pad under the moon). Wide,
// the keyboard plays it: ↑ drives (the clock runs), Space fires a bolt, a friend on the light side
// reacts when the rover drives up (a wave, a gift), then the autopilot drives a whole lap of the
// moon: the coverage is checked in latitude and longitude, the night side spawns chasers and a bolt
// brings one down; M mutes; the clock runs out to the end card, it settles, DRIVE AGAIN resets.
// Tall: the stick drives and the pad's FIRE key shoots. Recall mid-run gives the page back byte for
// byte; reduced motion keeps the still poster. The run itself: tests/moon-rover.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/orb/moon-rover.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/moon-rover.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#moon-rover" role="img" aria-label="Moon Rover" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
const bolts = (p) => p.evaluate(() => { let n = 0; for (let b = 0; b < 10; b++) n += scene.run.BO[b * 7] > 0 ? 1 : 0; return n; });

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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, (cvs.height * 0.7) | 0, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .mr-key, [data-fizlet-slot] .mr-pad button")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        drawn: px[3] === 255,
        pad: !!document.querySelector("[data-fizlet-slot] .mr-pad").offsetParent,
        keys: keys.every(Boolean) && keys.length,
        touch: getComputedStyle(document.querySelector("[data-fizlet-slot] .mr-play")).touchAction,
        tiles: scene.state.tiles > 60 && scene.state.tiles < 1200,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, pad: phone, keys: phone ? 4 : 1, touch: "none", tiles: true }, `${at}: mounts, the poster steps aside, the moon fills and draws (the far side culled), keys ≥ 44 px`);
    await settle(p, `${at}: ready`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .mr-play");
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.speed > 2, null, { timeout: 5000 });
      await p.keyboard.up("ArrowUp");
      assert.ok((await st(p)).clock < 150, `${at}: the clock runs`);
      await p.keyboard.down("Space");
      await p.waitForFunction(() => { let n = 0; for (let b = 0; b < 10; b++) n += scene.run.BO[b * 7] > 0 ? 1 : 0; return n > 0; }, null, { timeout: 3000 }).catch(() => assert.fail(`${at}: Space fires`));
      await p.keyboard.up("Space");
      // A friend on the light side: drive up to one, it waves and hands over a gift.
      await p.evaluate(() => scene.near(scene.run.friend.subarray(0, 3), 7));
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.state.met >= 1, null, { timeout: 6000 }).catch(() => assert.fail(`${at}: the friend reacts`));
      await p.keyboard.up("ArrowUp");
      const fr = await p.evaluate(() => ({ react: scene.run.fReact[0], toast: document.querySelector(".mr-toast").textContent, light: scene.run.day(...scene.run.friend.subarray(0, 3)) > 0 }));
      assert.ok(fr.react > 0 && fr.light && /A FRIEND!/.test(fr.toast), `${at}: a friend on the light side waves and gives (${fr.toast})`);
      // A whole lap on the autopilot: round the moon in latitude and longitude, through the night.
      await p.evaluate(() => {
        scene.run.reset();
        window.cov = { lat0: 90, lat1: -90, lons: new Set(), dark: false, spawned: 0, killed: 0, laps: 0 };
        const tick = () => {
          const s = scene.state, c = window.cov;
          c.lat0 = Math.min(c.lat0, s.lat); c.lat1 = Math.max(c.lat1, s.lat);
          c.lons.add(Math.floor((s.lon + 180) / 45));
          if (s.dark) c.dark = true;
          if (s.dark && s.ships > 0) c.spawned = 1;
          c.killed = s.kills; c.laps = s.laps;
          if (scene.state.phase !== 2 && s.laps < 1) requestAnimationFrame(tick);
        };
        tick();
        scene.auto = true;
      });
      await p.waitForFunction(() => window.cov.laps >= 1 || scene.state.phase === 2, null, { timeout: 150000 });
      const cov = await p.evaluate(() => ({ ...window.cov, lons: window.cov.lons.size }));
      assert.equal(cov.laps, 1, `${at}: a lap of the moon on the autopilot`);
      assert.ok(cov.lat1 - cov.lat0 > 60 && cov.lons === 8, `${at}: round the whole moon: latitude ${cov.lat0.toFixed(0)}..${cov.lat1.toFixed(0)}, ${cov.lons}/8 longitudes`);
      assert.ok(cov.dark && cov.spawned, `${at}: the night side spawns chasers`);
      assert.ok(cov.killed >= 1, `${at}: a bolt brings one down (${cov.killed})`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".mr-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // The clock runs out: the end card, then still.
      await p.evaluate(() => (scene.auto = false, (scene.run.S[1] = 0.2)));
      await p.waitForFunction(() => scene.state.card, null, { timeout: 8000 });
      assert.match(await p.evaluate(() => document.querySelector(".mr-card .mr-t").textContent), /^[\d,]+ pts · BEST$/, `${at}: the end card has the score`);
      await settle(p, `${at}: finished`);
      assert.equal(await frames(p), 0, `${at}: settled at the end`);
      await p.evaluate(() => document.querySelector(".mr-again").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.clock]), [0, false, 150], `${at}: DRIVE AGAIN resets`);
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.state.phase === 1);
      await p.keyboard.up("ArrowUp");
    } else {
      // The stick, pushed up, drives; the pad's FIRE shoots.
      const stick = await p.locator(".mr-pad .bui-stick").boundingBox();
      await p.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
      await p.mouse.down();
      await p.mouse.move(stick.x + stick.width / 2, stick.y + 2, { steps: 4 });
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.speed > 2, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: the stick drives`));
      await p.mouse.up();
      const fire = await p.locator(".mr-pad button[aria-label^='Fire']").boundingBox();
      await p.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => { let n = 0; for (let b = 0; b < 10; b++) n += scene.run.BO[b * 7] > 0 ? 1 : 0; return n > 0; }, null, { timeout: 3000 }).catch(() => assert.fail(`${at}: FIRE shoots`));
      await p.mouse.up();
      void bolts;
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
  console.log("moon-rover: mounts and settles (no audio before a gesture); wide: ↑ drives, Space fires, a friend on the light side reacts and gives, a lap of the whole moon on the autopilot (latitude and longitude covered), the night side spawns chasers and a bolt brings one down, M mutes, the clock runs out to the card, DRIVE AGAIN resets; tall: the stick drives and FIRE shoots; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
