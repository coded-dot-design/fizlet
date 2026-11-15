// DOM Kaiju (site/gallery/pieces/kaiju/dom-kaiju.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the block fills the stage and draws, the customiser is up with the monster's name, it
// settles with no audio before a gesture, keys are 44 px or more, wide (720) and tall (the phone shape,
// 358 wide, the pad under the block). Wide: the customiser's parts change the monster and its name;
// SMASH! starts it; the keyboard plays: D walks, W climbs a face, Space punches a hole, L grabs; then
// the autopilot flattens the whole block (a building pancakes, the helicopter is swatted) to the end
// card; M mutes; it settles; SMASH AGAIN resets. Tall: the customiser shows one part at a time (the
// tabs), the stick walks and the pad's PUNCH key punches. Recall mid-round gives the page back byte for
// byte; reduced motion keeps the still poster. The round itself: tests/dom-kaiju.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/kaiju/dom-kaiju.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/dom-kaiju.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#dom-kaiju" role="img" aria-label="DOM Kaiju" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 2, (cvs.height * 0.6) | 0, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .kj-key, [data-fizlet-slot] .kj-opt, [data-fizlet-slot] .kj-tab, [data-fizlet-slot] .kj-go")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && art.top - fig.top < 6,
        drawn: px[3] === 255,
        making: scene.state.making,
        name: document.querySelector(".kj-mname").textContent,
        keys: keys.every(Boolean) && keys.length > 6,
        touch: getComputedStyle(document.querySelector("[data-fizlet-slot] .kj-play")).touchAction,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, making: true, name: "RUMBLEHORN", keys: true, touch: "none" }, `${at}: mounts, the poster steps aside, the block fills and draws, the customiser is up, keys ≥ 44 px`);
    await settle(p, `${at}: ready`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The customiser: every part changes the monster and its name.
      await p.click(".kj-opt[data-k='body'][data-i='1']");
      await p.click(".kj-opt[data-k='head'][data-i='1']");
      await p.click(".kj-opt[data-k='main'][data-i='2']");
      await p.click(".kj-opt[data-k='pattern'][data-i='2']");
      const look = await p.evaluate(() => ({ ...scene.look, name: document.querySelector(".kj-mname").textContent, chip: document.querySelector(".kj-name span").textContent, pressed: [...document.querySelectorAll(".kj-opt[aria-pressed='true']")].map((b) => b.dataset.k + b.dataset.i).join(" ") }));
      assert.deepEqual(look, { body: 1, head: 1, main: 2, accent: 5, pattern: 2, name: "SKULKFIN", chip: "SKULKFIN", pressed: "body1 head1 main2 accent5 pattern2" }, `${at}: the customiser builds SKULKFIN`);
      await p.click(".kj-go");
      assert.deepEqual(await p.evaluate(() => [scene.state.making, scene.state.phase]), [false, 0], `${at}: SMASH! closes it; the round waits`);
      // The keyboard: D walks right (the round starts), W climbs the face in front, Space punches holes, L grabs.
      await p.focus("[data-fizlet-slot] .kj-play");
      const x0 = (await st(p)).x;
      await p.keyboard.down("KeyD");
      await p.waitForFunction((x0) => scene.state.phase === 1 && scene.state.x > x0 + 1, x0, { timeout: 5000 }).catch(() => assert.fail(`${at}: D walks`));
      await p.keyboard.up("KeyD");
      await p.evaluate(() => (scene.run.M[0] = -5.4, scene.run.HE[8] = 1e9));
      await p.keyboard.down("KeyW");
      await p.waitForFunction(() => scene.state.mode === 2 && scene.state.y > 0.8, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: W climbs`));
      await p.keyboard.up("KeyW");
      for (let i = 0; i < 4; i++) {
        await p.keyboard.press("Space");
        await p.waitForFunction((n) => scene.state.holes > n, i, { timeout: 3000 }).catch(() => assert.fail(`${at}: Space punches a hole (${i})`));
      }
      const holes = await p.evaluate(() => [scene.state.holes, document.querySelector(".kj-score span").textContent]);
      assert.deepEqual(holes, [4, "40"], `${at}: four holes, ten points each`);
      await p.keyboard.press("KeyL");
      // The whole block on the autopilot: a building pancakes, the helicopter goes down, the end card.
      await p.evaluate(() => {
        window.cov = { shake: false, fall: false, heli: false };
        const tick = () => {
          const B = scene.run.B;
          for (let b = 0; b < 5; b++) (B[b * 6] === 1 && (cov.shake = true)), (B[b * 6] === 2 && (cov.fall = true));
          if (scene.state.helis) cov.heli = true;
          if (!scene.state.card) requestAnimationFrame(tick);
        };
        tick();
        scene.run.HE[8] = 2;
        scene.auto = true;
      });
      await p.waitForFunction(() => scene.state.card, null, { timeout: 120000 });
      const end = await p.evaluate(() => ({ ...window.cov, flat: scene.state.flat, head: document.querySelector(".kj-card b").textContent, t: document.querySelector(".kj-card .kj-t").textContent, chip: document.querySelector(".kj-flat span").textContent }));
      assert.deepEqual(end, { shake: true, fall: true, heli: true, flat: 100, head: "BLOCK FLATTENED!", t: end.t, chip: "100%" }, `${at}: the block shakes, falls, flat; the helicopter swatted; the card`);
      assert.match(end.t, /^[\d,]+ pts · BEST$/, `${at}: the card has the score`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".kj-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await settle(p, `${at}: finished`);
      assert.equal(await frames(p), 0, `${at}: settled at the end`);
      await p.evaluate(() => (scene.auto = false, document.querySelector(".kj-again").click()));
      assert.deepEqual(await p.evaluate(() => [scene.state.phase, scene.state.card, scene.state.flat, scene.state.hp]), [0, false, 0, 100], `${at}: SMASH AGAIN resets`);
      await p.keyboard.down("KeyA");
      await p.waitForFunction(() => scene.state.phase === 1);
      await p.keyboard.up("KeyA");
    } else {
      // One part at a time: the tabs.
      const shown = () => p.evaluate(() => [...document.querySelectorAll(".kj-row")].filter((r) => r.offsetParent).map((r) => r.dataset.k).join());
      assert.equal(await shown(), "body", `${at}: the body row`);
      await p.click(".kj-tab[data-tab='head']");
      assert.equal(await shown(), "head", `${at}: HEAD shows the heads`);
      await p.click(".kj-opt[data-k='head'][data-i='3']");
      assert.equal(await p.evaluate(() => scene.state.name), "RUMBLEGAZE", `${at}: one eye`);
      await p.click(".kj-go");
      const pad = await p.evaluate(() => getComputedStyle(document.querySelector(".kj-pad")).visibility);
      assert.equal(pad, "visible", `${at}: the pad is back`);
      // The stick, pushed right, walks; the pad's PUNCH key punches.
      const stick = await p.locator(".kj-pad .bui-stick").boundingBox();
      const x0 = (await st(p)).x;
      await p.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
      await p.mouse.down();
      await p.mouse.move(stick.x + stick.width - 2, stick.y + stick.height / 2, { steps: 4 });
      await p.waitForFunction((x0) => scene.state.phase === 1 && scene.state.x > x0 + 1, x0, { timeout: 5000 }).catch(() => assert.fail(`${at}: the stick walks`));
      await p.mouse.up();
      await p.evaluate(() => (scene.run.M[0] = -5.4, scene.run.M[6] = 1, scene.run.M[5] = 2, scene.run.M[12] = 1, scene.run.M[1] = 0.5));
      const punch = await p.locator(".kj-pad button[aria-label^='Punch']").boundingBox();
      await p.mouse.click(punch.x + punch.width / 2, punch.y + punch.height / 2);
      await p.waitForFunction(() => scene.state.holes > 0, null, { timeout: 3000 }).catch(() => assert.fail(`${at}: PUNCH punches`));
    }
    // Recall mid-round: the page comes back byte for byte.
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
  console.log("dom-kaiju: mounts with the customiser up and settles (no audio before a gesture); wide: the parts build SKULKFIN, SMASH! starts it, D walks, W climbs, Space punches holes, L grabs, the autopilot flattens the block (shake, pancake, a helicopter swatted) to the card, M mutes, SMASH AGAIN resets; tall: the tabs show one part at a time, the stick walks and PUNCH punches; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
