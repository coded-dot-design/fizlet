// @fzlt/core/turntable in Chromium (the demo): a diorama model on a plinth, its camera's yaw owned by a
// turntable. A real mouse drag turns it by 0.012 rad per px and the picture changes; ← → turn it 15°
// (eased) and Home goes back; the slider's ARIA follows; a second table with `friction` and `snap`
// coasts after a throw and rests on a quarter turn; under prefers-reduced-motion a key lands in one
// frame and spin() does nothing; at rest the engine settles to 0 frames; destroy gives the canvas back.
// Screenshots when TURNTABLE_SHOTS names a folder. Motion rules and allocation: tests/turntable.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.TURNTABLE_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export * from "./src/turntable.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#efe8de"><canvas id="cv" style="display:block;width:480px;height:360px"></canvas><div id="b" style="width:200px;height:80px"></div><script>${bundle}</script></body>`;

function setup(opts) {
  const cv = document.getElementById("cv");
  const d = fz.diorama(cv, { background: () => "#efe8de", light: [-0.4, 1, 0.6], ambient: 0.55 });
  d.cluster("pl", { fixed: 0 });
  d.add({ shape: "cyl", sides: 24, size: [3.4, 0.2, 3.4], pos: [0, -0.2, 0], color: "#d9d3ca", cluster: "pl", pick: false });
  // A model that looks different from every side: a body, a nose, a fin, a lamp.
  d.add({ id: "m", shape: "group", size: [1, 0, 1], pos: [0, 0, 0] });
  d.add({ size: [1.6, 0.5, 0.7], pos: [0, 0.3, 0], on: "m", color: "#4f7bd9" });
  d.add({ shape: "wedge", size: [0.7, 0.5, 0.7], pos: [1.15, 0.3, 0], on: "m", color: "#e2574c" });
  d.add({ size: [0.1, 0.6, 0.5], pos: [-0.6, 0.8, 0], on: "m", color: "#f2b632" });
  d.add({ shape: "cyl", size: [0.3, 0.3, 0.3], pos: [0.2, 0.8, 0.2], on: "m", color: "#3aa76d" });
  Object.assign(d.cam, { pitch: 0.3, dist: 9, tx: 0, ty: 0.5, tz: 0, fov: 0.5 });
  const e = fz.createEngine({ settle: 0.25 });
  let draws = 0;
  const tt = fz.turntable(e, cv, { yaw: -0.15, label: "Turn the model: drag, or the arrow keys", ...opts, onTurn(yaw) { d.cam.yaw = yaw; d.draw(); draws++; } });
  // A second table on a plain element: a throw that coasts and rests on quarter turns.
  const b = document.getElementById("b"), tb = fz.turntable(e, b, { friction: 3, snap: Math.PI / 2, ...opts });
  e.start();
  window.T = { d, e, tt, tb, get draws() { return draws; }, get state() { return e.paused.join(); } };
}

const browser = await chromium.launch(launchOptions());
try {
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 460 }, deviceScaleFactor: 2, reducedMotion: reduced ? "reduce" : "no-preference" });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const before = await p.evaluate(() => document.getElementById("cv").outerHTML);
    await p.evaluate(setup, {});
    const frames = (n) => p.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const pic = () => p.evaluate(() => {
      const { d } = window.T, cv = d.ctx.canvas, img = d.ctx.getImageData(0, 0, cv.width, cv.height).data, colours = new Set();
      let h = 0;
      for (let i = 0; i < img.length; i += 4 * 37) colours.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2]), (h = (h * 31 + img[i] + img[i + 1] * 7) | 0);
      return { colours: colours.size, h };
    });
    const yaw = () => p.evaluate(() => window.T.tt.yaw);
    const rest = () => p.waitForFunction(() => !window.T.tt.moving && !window.T.tb.moving && window.T.state.includes("settled"), null, { timeout: 8000 });
    await frames(3);
    const p0 = await pic();
    assert.ok(p0.colours >= 8, `a model is drawn, not blank: ${p0.colours} colours`);
    assert.equal(await p.getAttribute("#cv", "role"), "slider");
    assert.equal(await p.getAttribute("#cv", "aria-valuenow"), "351", "−0.15 rad is 351°");
    if (SHOTS && !reduced) await p.locator("#cv").screenshot({ path: join(SHOTS, "turntable-0.png") });

    // A real drag: 100 px to the right is 1.2 rad, at once.
    await p.mouse.move(200, 180);
    await p.mouse.down();
    await p.mouse.move(250, 180, { steps: 5 });
    await p.mouse.move(300, 190, { steps: 5 });
    assert.ok(Math.abs((await yaw()) - (-0.15 + 1.2)) < 1e-9, `drag: ${await yaw()}`);
    await p.mouse.up();
    await frames(3);
    const p1 = await pic();
    assert.notEqual(p1.h, p0.h, "the picture turned");
    assert.equal(await p.getAttribute("#cv", "aria-valuenow"), "" + Math.round(((-0.15 + 1.2) * 180) / Math.PI));
    if (SHOTS && !reduced) await p.locator("#cv").screenshot({ path: join(SHOTS, "turntable-1.png") });
    await rest();
    const n0 = await p.evaluate(() => window.T.draws);
    await p.waitForTimeout(250);
    assert.equal(await p.evaluate(() => window.T.draws), n0, "at rest: 0 frames, 0 draws");

    // Keys with focus: → is 15° the way a drag to the right goes; Home is the start angle.
    await p.focus("#cv");
    await p.keyboard.press("ArrowRight");
    if (reduced) assert.ok(Math.abs((await yaw()) - (-0.15 + 1.2 + Math.PI / 12)) < 1e-9, "reduced motion: a key lands at once");
    else {
      await frames(2);
      const y = await yaw();
      assert.ok(y > -0.15 + 1.2 && y < -0.15 + 1.2 + Math.PI / 12, `eases (${y})`);
    }
    await rest();
    assert.ok(Math.abs((await yaw()) - (-0.15 + 1.2 + Math.PI / 12)) < 1e-9);
    await p.keyboard.press("Home");
    await rest();
    assert.equal(await yaw(), -0.15, "home");
    assert.equal((await pic()).h, p0.h, "home: the first picture again, pixel for pixel");

    // spin(): a show after a change; nothing under reduced motion.
    await p.evaluate(() => window.T.tt.spin(0.5));
    await frames(4);
    if (reduced) assert.equal(await yaw(), -0.15, "reduced motion: no show");
    else assert.ok((await yaw()) > -0.15, "showing");
    await rest();
    if (!reduced) assert.ok(Math.abs((await yaw()) - (-0.15 + 0.8)) < 0.1, `0.5 s at 1.6 rad/s (${await yaw()})`);

    // The second table: a quick throw coasts on and rests on a quarter turn (reduced: it snaps at once).
    await p.mouse.move(20, 400);
    await p.mouse.down();
    for (let x = 30; x <= 110; x += 10) await p.mouse.move(x, 400), await p.waitForTimeout(8);
    const held = await p.evaluate(() => window.T.tb.yaw);
    await p.mouse.up();
    const moving = await p.evaluate(() => window.T.tb.moving);
    assert.equal(moving, !reduced, reduced ? "reduced motion: no coast" : "thrown: it coasts");
    await rest();
    const end = await p.evaluate(() => window.T.tb.yaw), q = end / (Math.PI / 2);
    assert.ok(Math.abs(q - Math.round(q)) < 1e-9, `rests on a quarter turn (${end})`);
    if (!reduced) assert.ok(end > held, `coasted past where it was let go (${held} → ${end})`);

    // Destroy: the canvas is the host's again.
    await p.evaluate(() => window.T.e.destroy());
    const after = await p.evaluate(() => document.getElementById("cv").outerHTML.replace(/ width="\d+" height="\d+"/, ""));
    assert.equal(after, before, "destroy gives the element back");
    assert.deepEqual(errs, [], "no page errors");
    await ctx.close();
  }
  console.log("turntable: drag, keys, home, spin, throw and snap, reduced motion, settled, restored");
} finally {
  await browser.close();
}
