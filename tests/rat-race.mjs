// Rat Race (site/gallery/pieces/maze/rat-race.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, and it
// settles to no frames with no audio before a gesture, waiting for a go; every key is 44 px or more,
// wide (720) and tall (the phone shape, 358 wide). Wide: Space starts the count and the race, a click
// on the cheese's room sends your mouse there by A* (the doors swap on the way), the round is won
// and scored, the next maze drops in and waits; holding an arrow runs your mouse, letting go stops
// it in a room; M mutes; N starts a new race. Tall: a tap starts it and a tap on the cheese wins a
// round. Recall mid-race gives the page back byte for byte; reduced motion keeps the still poster.
// The model itself: tests/rat-race.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/maze/rat-race.ts"; export { CW, CH } from "./site/gallery/pieces/maze/rat.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/rat-race.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#rat-race" role="img" aria-label="Rat Race" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });

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
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.every(Boolean) && keys.length,
        phase: scene.state.phase,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 2, phase: 0 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, mute and NEW RACE ≥ 44 px, it waits for a go`);
    await settle(p, `${at}: idle`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    const box = await p.locator("[data-fizlet-slot]").boundingBox();
    const press = async (cell) => {
      const [x, y] = await p.evaluate((c) => scene.roomScreen(c), cell);
      if (phone) await p.touchscreen.tap(box.x + x, box.y + y);
      else await p.mouse.click(box.x + x, box.y + y);
    };
    const winRound = async () => {
      // Wait for the race, then click the cheese's room (again whenever the mouse stops: a door).
      await p.waitForFunction(() => scene.state.phase === 2, null, { timeout: 8000 });
      const r0 = await p.evaluate(() => scene.state.you + scene.state.rival);
      for (let k = 0; k < 40; k++) {
        const done = await p.evaluate((r0) => scene.state.you + scene.state.rival > r0, r0);
        if (done) break;
        if (await p.evaluate(() => scene.state.phase === 2 && scene.race.mice[0].at === scene.race.mice[0].to)) await press(await p.evaluate(() => scene.race.cheese));
        await p.waitForTimeout(250);
      }
      await p.waitForFunction((r0) => scene.state.you + scene.state.rival === r0 + 1, r0, { timeout: 20000 });
    };
    if (!phone) {
      // Space: the count, then the race.
      await p.focus("[data-fizlet-slot] .rr-play");
      await p.keyboard.press(" ");
      assert.equal(await p.evaluate(() => scene.state.phase), 1, `${at}: Space starts the count`);
      // Rig the rival to sit still (a test hook on the model) so the click's A* run must win.
      await p.evaluate(() => (scene.race.mice[1].wait = 1e9));
      await winRound();
      assert.deepEqual(await p.evaluate(() => [scene.state.you, scene.state.winner]), [1, 0], `${at}: a click on the cheese's room ran your mouse there: round won`);
      await p.waitForFunction(() => scene.state.round === 1 && scene.state.phase === 0, null, { timeout: 10000 });
      await settle(p, `${at}: round 2 waits`);
      // Hold → (or whichever way is open): the mouse runs; let go: it stops in a room.
      const dir = await p.evaluate(() => { const r = scene.race, g = r.g, s = r.mice[0].at; return ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].find((k, i) => !(g.flags[s + [1, -1, g.cols, -g.cols][[0, 1, 2, 3].indexOf(i)]] & 1)); });
      const start = await p.evaluate(() => scene.race.mice[0].at);
      await p.keyboard.down(dir);
      await p.waitForFunction((s) => scene.state.phase === 2 && scene.race.mice[0].at !== s, start, { timeout: 8000 });
      await p.keyboard.up(dir);
      await p.waitForFunction(() => scene.race.mice[0].at === scene.race.mice[0].to, null, { timeout: 5000 });
      assert.ok(await p.evaluate(() => { const r = scene.race, i = r.mice[0].at; return (i % r.g.cols) % 2 === 1 && ((i / r.g.cols) | 0) % 2 === 1; }), `${at}: an arrow ran the mouse; let go, it stopped in a room`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await p.keyboard.press("n");
      await p.waitForFunction(() => scene.state.round === 0 && scene.state.phase === 0 && scene.state.you === 0, null, { timeout: 8000 });
    } else {
      // A tap starts it; taps on the cheese win a round.
      await press(await p.evaluate(() => scene.race.cheese));
      await p.evaluate(() => (scene.race.mice[1].wait = 1e9));
      await winRound();
      assert.equal(await p.evaluate(() => scene.state.you), 1, `${at}: taps won a round`);
    }
    await settle(p, `${at}: after play`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
  // Reduced motion: the poster is the still frame; the scene never mounts.
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
  console.log("rat-race: mounts, the diorama draws and settles waiting for a go (no audio before a gesture); wide: Space counts in, a click on the cheese runs your mouse there and wins the round, the next maze drops in and waits, an arrow runs the mouse and letting go stops it in a room, M mutes, N a new race; tall: taps win a round; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
