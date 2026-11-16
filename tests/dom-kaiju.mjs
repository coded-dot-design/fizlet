// CitySmash (site/gallery/pieces/kaiju/dom-kaiju.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the block fills the stage and draws, the customiser is up with the ape's name, it
// settles with no audio before a gesture, keys are 44 px or more, wide (720) and tall (the phone shape,
// 358 wide, the pad under the block). Wide: the customiser's parts dress the ape and name it; SMASH!
// starts it; the keyboard plays: D walks, K at a wall jumps and grabs it, Space punches holes from the
// wall; 2 brings player two in on the crab and the arrow keys walk it; then the autopilot flattens the
// whole block to the score card (a line per player); M mutes; it settles; SMASH AGAIN resets. Tall: the
// customiser shows one part at a time (the tabs), the stick walks and the pad's PUNCH key punches.
// Recall mid-round gives the page back byte for byte; reduced motion keeps the still poster. The round
// itself: tests/dom-kaiju.test.mjs.
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
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#dom-kaiju" role="img" aria-label="CitySmash" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
    // (the customiser's keys laid out)
    await p.waitForFunction(() => [...document.querySelectorAll("[data-fizlet-slot] .kj-opt, [data-fizlet-slot] .kj-tab")].filter((b) => b.offsetParent).length > 6);
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
        keys: keys.every(Boolean) && keys.length > 6 ? true : [...document.querySelectorAll("[data-fizlet-slot] .kj-key, [data-fizlet-slot] .kj-opt, [data-fizlet-slot] .kj-tab, [data-fizlet-slot] .kj-go")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return b.className + (b.dataset.k || "") + b.dataset.i + ":" + Math.round(k.width) + "x" + Math.round(k.height); }).filter((x) => /:(\d|[1-3]\d|4[0-3])x|x(\d|[1-3]\d|4[0-3])$/.test(x)).join(" "),
        touch: getComputedStyle(document.querySelector("[data-fizlet-slot] .kj-play")).touchAction,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, making: true, name: "EMBER BROWLER", keys: true, touch: "none" }, `${at}: mounts, the poster steps aside, the block fills and draws, the customiser is up, keys ≥ 44 px`);
    await settle(p, `${at}: ready`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The customiser: fur, trim, pattern, face and gear dress the ape; the name follows.
      await p.click(".kj-opt[data-k='fur'][data-i='3']");
      await p.click(".kj-opt[data-k='trim'][data-i='1']");
      await p.click(".kj-opt[data-k='pattern'][data-i='2']");
      await p.click(".kj-opt[data-k='face'][data-i='2']");
      await p.click(".kj-opt[data-k='gear'][data-i='0']");
      await p.click(".kj-opt[data-k='gear'][data-i='2']");
      const look = await p.evaluate(() => ({ ...scene.look, name: document.querySelector(".kj-mname").textContent, chip: document.querySelector(".kj-name span").textContent, pressed: [...document.querySelectorAll(".kj-opt[aria-pressed='true']")].map((b) => b.dataset.k + b.dataset.i).join(" ") }));
      assert.deepEqual(look, { fur: 3, trim: 1, pattern: 2, face: 2, gear: 7, name: "MIDNIGHT TUSKER", chip: "MIDNIGHT TUSKER", pressed: "fur3 trim1 pattern2 face2 gear0 gear1 gear2" }, `${at}: the customiser dresses MIDNIGHT TUSKER`);
      await p.click(".kj-go");
      assert.deepEqual(await p.evaluate(() => [scene.state.making, scene.state.phase]), [false, 0], `${at}: SMASH! closes it; the round waits`);
      // The keyboard: D walks (the round starts); K at a wall jumps and grabs it; Space punches from the wall.
      await p.focus("[data-fizlet-slot] .kj-play");
      const x0 = (await st(p)).x;
      await p.keyboard.down("KeyD");
      await p.waitForFunction((x0) => scene.state.phase === 1 && scene.state.x > x0 + 0.5, x0, { timeout: 5000 }).catch(() => assert.fail(`${at}: D walks`));
      await p.keyboard.up("KeyD");
      await p.evaluate(() => (scene.run.M[0] = scene.run.wallX(3, -1) - 2, scene.run.M[6] = 1, scene.run.HE[8] = 1e9, scene.run.TK[4] = 1e9, scene.run.MV[1][24] = 0, scene.run.MV[2][24] = 0));
      await p.keyboard.down("KeyD");
      await p.keyboard.press("KeyK");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 5000 }).catch(() => assert.fail(`${at}: a jump at the wall grabs it`));
      await p.keyboard.up("KeyD");
      // Each press is one punch at the window in front: a chip, a crack, a hole (three presses); it never moves.
      const spot = await p.evaluate(() => [scene.run.M[0], scene.run.M[1]]);
      for (let n = 1; n <= 9; n++) {
        await p.keyboard.press("Space");
        await p.waitForFunction((n) => scene.run.HIT.reduce((a, v) => a + v, 0) >= n, n, { timeout: 3000 }).catch(() => assert.fail(`${at}: Space punch ${n} lands`));
        await p.waitForFunction(() => scene.run.M[8] <= 0, null, { timeout: 3000 });
      }
      assert.deepEqual(await p.evaluate(() => [scene.state.holes, scene.state.mode, document.querySelector(".kj-score span").textContent, scene.run.M[0], scene.run.M[1]]), [3, 2, "39", ...spot], `${at}: nine presses, three windows holed in a row from the wall, still on its spot`);
      // The wall pose: mounted on the building's front corner, chest pressed to it (its front faces the wall,
      // the body on the corner, never in the gap). The far hand wraps round onto the side wall (behind the
      // facade's plane) and holds through every punch; the near foot clamps the corner; the free near arm
      // smashes: at each punch's hit frame (down, level, up) its fist is on the window the round hits, in
      // front of the facade.
      const grip = await p.evaluate(() => {
        const r = scene.run, M = r.M, X0 = [-15.2, -8.6, -1, 4.6, 11.2], W = [4, 5, 3, 4, 4], out = [];
        for (const [b, s] of [[3, -1], [4, 1]]) for (const d of [-1, 0, 1]) {
          r.cell.fill(2); r.HIT.fill(0); r.B[b * 6 + 1] = 0;
          M[5] = 2; M[12] = b; M[22] = s; M[0] = r.wallX(b, s); M[2] = -0.55; M[6] = -s; M[1] = 1.6; M[8] = 0; M[33] = 0; M[7] = 100; M[15] = 0; M[23] = 0;
          scene.engine.stop();
          for (let i = 0; i < 40; i++) scene.engine.advance(1 / 60);
          const edge = s < 0 ? X0[b] : X0[b] + W[b], g = s < 0 ? 0 : 1, before = scene.contacts(0);
          const T = scene.torso(0), th = Math.hypot(T[3], T[5]), faces = ((T[3] / th) * -s - T[5] / th) / Math.SQRT2, corner = Math.hypot(T[0] - edge, T[2]);
          M[33] = d * 0.35; M[20] = 0.3;
          const i = r.sideTarget(d), h0 = r.HIT[i];
          let n = 0;
          while (r.HIT[i] === h0 && n++ < 40) scene.engine.advance(1 / 60);
          const c = scene.contacts(0), hit = c.slice((1 - g) * 3, (1 - g) * 3 + 3), hold = c.slice(g * 3, g * 3 + 3);
          const rel = i - [0, 20, 60, 72, 100][b], row = (rel / W[b]) | 0, cx = X0[b] + (rel - row * W[b]) + 0.5, cy = r.yOff(b) + row + 0.5;
          out.push({
            hit: r.HIT[i] > h0 && row - 3 === d && Math.abs(hit[0] - cx) < 0.75 && Math.abs(hit[1] - cy) < 0.8 && hit[2] > -0.1,
            grip: Math.abs(hold[0] - edge) < 0.75 && hold[2] < 0 && Math.hypot(hold[0] - before[g * 3], hold[1] - before[g * 3 + 1]) < 0.9,
            feet: [2, 3].every((k) => Math.abs(c[k * 3] - edge) < 0.8) && c[(3 - g) * 3 + 2] > -0.3,
            mounted: faces > 0.6 && corner < 1.4 && T[2] > -0.3,
            why: [b, s, d, row, hit.map((v) => +v.toFixed(2)), cx, cy],
          });
          for (let k = 0; k < 30; k++) scene.engine.advance(1 / 60);
          scene.engine.start();
        }
        return out;
      });
      const want = { hit: true, grip: true, feet: true, mounted: true };
      assert.deepEqual(grip.map(({ hit, grip, feet, mounted }) => ({ hit, grip, feet, mounted })), [want, want, want, want, want, want], `${at}: mounted on the corner (chest to the wall), the far hand round the side, the feet on the edge, the fist on the window it hits (down, level, up), both sides ${JSON.stringify(grip.map((g) => g.why))}`);
      // Player two: 2 brings them in on the crab; the arrows walk it.
      await p.keyboard.press("Digit2");
      assert.equal(await p.evaluate(() => scene.state.p2), true, `${at}: player two is in`);
      await p.evaluate(() => { const C = scene.run.MV[1]; C[24] = 1; C[5] = 0; C[0] = 10; C[1] = 0; });
      await p.keyboard.down("ArrowLeft");
      await p.waitForFunction(() => scene.run.MV[1][0] < 9, null, { timeout: 4000 }).catch(() => assert.fail(`${at}: the arrows walk player two`));
      await p.keyboard.up("ArrowLeft");
      assert.equal(await p.evaluate(() => !document.querySelector(".kj-r0").hidden && document.querySelector(".kj-r0 i").textContent), "P2", `${at}: the crab's chip says P2`);
      await p.keyboard.press("Digit2");
      assert.equal(await p.evaluate(() => scene.state.p2), false, `${at}: and out again`);
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
        scene.run.reset();
        scene.run.S[0] = 1;
        scene.auto = true;
      });
      await p.waitForFunction(() => scene.state.card, null, { timeout: 120000 });
      const end = await p.evaluate(() => ({ shake: cov.shake, fall: cov.fall, flat: scene.state.flat, head: document.querySelector(".kj-card b").textContent, t: document.querySelector(".kj-card .kj-t").textContent, chip: document.querySelector(".kj-flat span").textContent, rows: document.querySelectorAll(".kj-board li").length }));
      assert.deepEqual(end, { shake: true, fall: true, flat: 100, head: "BLOCK FLATTENED!", t: end.t, chip: "100%", rows: end.rows }, `${at}: the block shakes, falls, flat; the card`);
      assert.ok(end.rows >= 2, `${at}: a line per player on the card (${end.rows})`);
      assert.match(end.t, /^[\d,]+ pts together · BEST$/, `${at}: the card has the shared score`);
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
      assert.equal(await shown(), "fur", `${at}: the fur row first`);
      await p.click(".kj-tab[data-tab='face']");
      assert.equal(await shown(), "face", `${at}: FACE shows the faces`);
      await p.click(".kj-opt[data-k='face'][data-i='2']");
      assert.equal(await p.evaluate(() => scene.state.name), "EMBER TUSKER", `${at}: tusks`);
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
      await p.evaluate(() => { const M = scene.run.M; M[5] = 2; M[12] = 3; M[22] = -1; M[0] = scene.run.wallX(3, -1); M[6] = 1; M[1] = 0.9; for (const k of [1, 2]) scene.run.MV[k][24] = 0; });
      const punch = await p.locator(".kj-pad button[aria-label^='Punch']").boundingBox();
      await p.mouse.click(punch.x + punch.width / 2, punch.y + punch.height / 2);
      await p.waitForFunction(() => scene.run.HIT.some((v) => v > 0), null, { timeout: 3000 }).catch(() => assert.fail(`${at}: PUNCH punches`));
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
  console.log("dom-kaiju: mounts with the customiser up and settles (no audio before a gesture); wide: the parts dress MIDNIGHT TUSKER, SMASH! starts it, D walks, K at a wall grabs it, on a wall mounted on the corner (chest to the wall, far hand round the side, feet on the edge) and the fist on the window it hits (down, level, up, both sides), Space punches the window in front (three presses a hole), 2 brings player two in and the arrows walk the crab, the autopilot flattens the block (shake, pancake) to the score card, M mutes, SMASH AGAIN resets; tall: the tabs show one part at a time, the stick walks and PUNCH punches from a wall; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
