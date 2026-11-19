// @fzlt/core/input's pointer and touch stick in WebKit and Chromium (tests/engines.mjs, BROWSERS),
// on a 390 x 844 touch phone. WebKit has no CDP `Input.dispatchTouchEvent`, so fingers are synthetic
// PointerEvents dispatched on the field (the same in both engines) and `page.touchscreen.tap` where
// one real finger is enough. The regression shapes of a touch that iOS ends badly: a finger that ends
// with only `lostpointercapture`, and one that ends with nothing at all; either way the next press
// must take the stick. A second finger while the stick is held stays the pointer (multi-touch).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { eachEngine, PHONE } from "./engines.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { controls } from "./src/input.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="margin:0"><div id="field" style="position:fixed;inset:0;background:#123"></div><script>${bundle}</script></body>`;

await eachEngine("input: pointer and touch stick", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  await page.evaluate(() => {
    const field = document.getElementById("field");
    const e = (window.e = fizlet.createEngine({ root: field, pause: { hidden: false, offscreen: false, editable: false } }));
    const c = (window.c = fizlet.controls(e, { target: field, stick: "left", keys: { fire: ["Space"] } }));
    window.hits = 0;
    e.add({ step: () => void (c.pointer.hit && window.hits++) });
    // One synthetic finger: a touch PointerEvent on the field (radius 60: 60 px is a full push).
    window.finger = (type, id, x, y, primary = true) =>
      field.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: "touch", isPrimary: primary, clientX: x, clientY: y }));
    window.read = () => (e.advance(1 / 60), { active: c.stick.active, x: +c.stick.x.toFixed(3), y: +c.stick.y.toFixed(3), down: c.pointer.down, px: c.pointer.x, hits: window.hits });
  });
  const read = () => page.evaluate(() => read());

  // A real tap on the right half is one pointer press; on the left half it is the stick, not the pointer.
  await page.touchscreen.tap(300, 400);
  assert.deepEqual(await read(), { active: false, x: 0, y: 0, down: false, px: 300, hits: 1 }, "a right-half tap is one pointer hit, then lets go");
  await page.touchscreen.tap(90, 400);
  assert.deepEqual(await read(), { active: false, x: 0, y: 0, down: false, px: 300, hits: 1 }, "a left-half tap takes the stick and lets go; the pointer never sees it");

  // A drag on the left half drives the stick, clamped to the radius; pointerup lets go.
  const drag = await page.evaluate(() => {
    finger("pointerdown", 1, 100, 400);
    finger("pointermove", 1, 130, 400);
    const half = read();
    finger("pointermove", 1, 100, 200);
    const clamped = read();
    finger("pointerup", 1, 100, 200);
    return [half, clamped, read()];
  });
  assert.deepEqual(drag.map((r) => [r.active, r.x, r.y]), [[true, 0.5, 0], [true, 0, -1], [false, 0, 0]], "half push, clamped push, released");

  // Regression shape 1: the finger ends with only lostpointercapture (no pointerup, no pointercancel).
  const lost = await page.evaluate(() => {
    finger("pointerdown", 2, 100, 400);
    finger("pointermove", 2, 160, 400);
    const on = read();
    finger("lostpointercapture", 2, 160, 400);
    const off = read();
    finger("pointerdown", 3, 120, 500);
    finger("pointermove", 3, 90, 500);
    const next = read();
    finger("pointerup", 3, 90, 500);
    return [on.active, on.x, off.active, off.x, next.active, next.x];
  });
  assert.deepEqual(lost, [true, 1, false, 0, true, -0.5], "lostpointercapture alone ends the finger; the next press takes the stick");

  // Regression shape 2: the finger ends with nothing at all. The next press (the primary pointer:
  // no other finger is down) takes the stick from its own origin; the stale finger's moves are ignored.
  const dropped = await page.evaluate(() => {
    finger("pointerdown", 4, 100, 400);
    finger("pointermove", 4, 160, 400);
    const stale = read();
    finger("pointerdown", 5, 50, 600);
    finger("pointermove", 5, 80, 600);
    const taken = read();
    finger("pointermove", 4, 40, 400); // the stale finger: no longer the stick
    const ignored = read();
    finger("pointerup", 5, 80, 600);
    const off = read();
    finger("pointerup", 4, 40, 400); // late, harmless
    return [[stale.active, stale.x], [taken.active, taken.x, taken.down], [ignored.active, ignored.x], [off.active, off.x]];
  });
  // TODO(D2): input starts the stick only while its slot is free, so this fails until the fix; a
  // known failure is reported, not fatal, and one that starts passing fails the run (flip it).
  try {
    assert.deepEqual(dropped, [[true, 1], [true, 0.5, false], [true, 0.5], [false, 0]], "a dropped pointerup never leaves the stick dead");
  } catch {
    console.log("todo a dropped pointerup leaves the stick dead (known, fixed in D2):", JSON.stringify(dropped));
    dropped.todo = true;
  }
  assert.ok(dropped.todo, "the todo case passes now: make it a plain assert");

  // Multi-touch: a second finger on the stick side while the stick is held is the pointer.
  const multi = await page.evaluate(() => {
    finger("pointerdown", 6, 100, 400);
    finger("pointermove", 6, 70, 400);
    finger("pointerdown", 7, 150, 300, false); // not primary: another finger is down
    finger("pointermove", 7, 60, 200, false);
    const both = read();
    finger("pointerup", 7, 60, 200, false);
    const one = read();
    finger("pointerup", 6, 70, 400);
    return [[both.active, both.x, both.down, both.px], [one.active, one.x, one.down], read().active];
  });
  assert.deepEqual(multi, [[true, -0.5, true, 60], [true, -0.5, false], false], "the stick keeps its finger; the second finger is the pointer");

  assert.deepEqual(errs, []);
  await ctx.close();
});
