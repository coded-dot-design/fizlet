// @fzlt/core/pad in WebKit and Chromium (tests/engines.mjs, BROWSERS), on a 390 x 844 touch phone
// with the Board UI kit CSS: the stick, the d-pad, a hold key and a toggle. Fingers are synthetic
// PointerEvents on the pad's elements (WebKit has no CDP touch; a synthetic pointer can't be
// captured, which pad allows) and `page.touchscreen.tap` for real one-finger taps. The regression
// shapes of a touch that iOS ends badly: only `lostpointercapture`, or nothing; the control lets go,
// or the next finger takes it. An icon inside a key is laid out inside the key (an unsized SVG in
// WebKit is 300 x 150 and swallows the thumb).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { eachEngine, PHONE } from "./engines.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { controls } from "./src/input.ts"; export { pad } from "./src/pad.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;
const CSS = readFileSync("src/ui/board-ui.css", "utf8");

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="margin:0"><style>${CSS}</style><div class="bui" id="board" style="position:relative;width:390px;height:844px"></div><script>${bundle}</script></body>`;

await eachEngine("pad: stick, d-pad, hold key, toggle", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  await page.evaluate(() => {
    const board = document.getElementById("board");
    const e = (window.e = fizlet.createEngine({ root: board, pause: { hidden: false, offscreen: false, editable: false } }));
    const c = (window.c = fizlet.controls(e, { keys: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], fire: ["Space"], auto: ["KeyQ"] } }));
    window.p = fizlet.pad(e, c, { actions: [
      { intent: "fire", label: "", name: "Hold to fire", hold: true, icon: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5"/></svg>' },
      { intent: "auto", label: "AUTO", toggle: true },
    ] });
    window.hits = 0;
    e.add({ step: () => void (c.hit("fire") && window.hits++) });
    // One synthetic finger on the element `sel`, (dx, dy) px from its centre.
    window.finger = (type, id, sel, dx = 0, dy = 0) => {
      const el = p.el.querySelector(sel), r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy }));
    };
    window.stick = () => (e.advance(1 / 60), [c.stick.active, Math.round(c.stick.x * 100) / 100, p.el.querySelector(".bui-knob")?.style.translate ?? null]);
  });
  const centre = (sel) => page.evaluate((s) => { const r = p.el.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);

  // Stick: drag right (clamped), let go (the knob returns in render).
  const st = await page.evaluate(() => {
    finger("pointerdown", 1, ".bui-stick");
    finger("pointermove", 1, ".bui-stick", 200, 0);
    const on = stick();
    finger("pointerup", 1, ".bui-stick", 200, 0);
    return [on[0], on[1], on[2] !== "", ...stick()];
  });
  assert.deepEqual(st, [true, 1, true, false, 0, ""], "stick drives, then lets go and the knob returns");

  // Regression shapes on the stick: only lostpointercapture; then nothing, and a new finger takes it.
  const shapes = await page.evaluate(() => {
    finger("pointerdown", 2, ".bui-stick");
    finger("pointermove", 2, ".bui-stick", 200, 0);
    finger("lostpointercapture", 2, ".bui-stick", 200, 0);
    const lost = stick();
    finger("pointerdown", 3, ".bui-stick");
    finger("pointermove", 3, ".bui-stick", 200, 0); // this finger never ends
    finger("pointerdown", 4, ".bui-stick");
    finger("pointermove", 4, ".bui-stick", -200, 0);
    const taken = stick();
    finger("pointermove", 3, ".bui-stick", 200, 0); // the stale finger no longer drives
    const ignored = stick();
    finger("pointerup", 4, ".bui-stick", -200, 0);
    return [lost.slice(0, 2), taken.slice(0, 2), ignored.slice(0, 2), stick().slice(0, 2)];
  });
  assert.deepEqual(shapes, [[false, 0], [true, -1], [true, -1], [false, 0]], "lostpointercapture lets go; a new finger takes a stick whose finger never ended");

  // D-pad: up-right holds two intents; lostpointercapture alone lets both go.
  const dp = await page.evaluate(() => {
    p.setScheme("dpad");
    const dirs = () => ["up", "down", "left", "right"].filter((d) => c.down(d)).join(",");
    finger("pointerdown", 5, ".bui-dpad", 30, -30);
    const held = dirs();
    finger("lostpointercapture", 5, ".bui-dpad", 30, -30);
    const out = [held, dirs(), p.el.querySelectorAll(".down").length];
    p.setScheme("stick");
    return out;
  });
  assert.deepEqual(dp, ["up,right", "", 0], "d-pad diagonal, released by lostpointercapture alone");

  // Hold key: held while down; only lostpointercapture lets go; a finger that never ends is let go
  // by the next press's release.
  const hold = await page.evaluate(() => {
    finger("pointerdown", 6, ".bui-primary");
    const down = c.down("fire");
    finger("lostpointercapture", 6, ".bui-primary");
    const lost = c.down("fire");
    finger("pointerdown", 7, ".bui-primary"); // never ends
    finger("pointerdown", 8, ".bui-primary");
    finger("pointerup", 8, ".bui-primary");
    return [down, lost, c.down("fire"), p.el.querySelectorAll(".down").length];
  });
  assert.deepEqual(hold, [true, false, false, 0], "hold key: down, lostpointercapture, stale finger cleared by the next one");

  // Real taps: the hold key is one hit, the toggle flips on and off.
  await page.evaluate(() => (e.advance(1 / 60), (window.hits = 0)));
  const [fx, fy] = await centre(".bui-primary");
  await page.touchscreen.tap(fx, fy);
  assert.deepEqual(await page.evaluate(() => (e.advance(1 / 60), [hits, c.down("fire")])), [1, false], "a real tap on the hold key is one hit");
  const [ax, ay] = await centre('[data-i="1"]');
  const toggle = () => page.evaluate(() => (e.advance(1 / 60), [c.down("auto"), p.el.querySelector('[data-i="1"]').getAttribute("aria-pressed")]));
  await page.touchscreen.tap(ax, ay);
  const on = await toggle();
  await page.touchscreen.tap(ax, ay);
  assert.deepEqual([on, await toggle()], [[true, "true"], [false, "false"]], "a real tap flips the toggle, a second flips it back");

  // Layout: the icon sits inside its key, and every key is at least 44 px.
  const box = await page.evaluate(() => {
    const k = p.el.querySelector(".bui-primary").getBoundingClientRect(), s = p.el.querySelector(".bui-primary svg").getBoundingClientRect();
    const keys = [...p.el.querySelectorAll(".bui-arcade, .bui-stick")].map((el) => Math.round(Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)));
    return { inside: s.left >= k.left - 0.5 && s.right <= k.right + 0.5 && s.top >= k.top - 0.5 && s.bottom <= k.bottom + 0.5, svg: [Math.round(s.width), Math.round(s.height)], small: keys.filter((n) => n < 44) };
  });
  assert.ok(box.inside, `the key's icon is laid out inside the key (${box.svg.join(" x ")})`);
  assert.deepEqual(box.small, [], "every key and the stick are at least 44 px");

  assert.deepEqual(errs, []);
  await ctx.close();
});
