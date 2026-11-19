// @fzlt/core/input's gamepad() in WebKit and Chromium (tests/engines.mjs, BROWSERS): a page has no
// real pad in CI, so navigator.getGamepads is replaced by one standard-layout pad made once and a
// plain `gamepadconnected` event is dispatched on window (what a browser fires on the first press).
// It checks what differs by engine: the Gamepad API's shape on navigator, window events, and that
// a page without a pad never polls.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { eachEngine, PHONE } from "./engines.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { controls, gamepad } from "./src/input.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="margin:0"><div id="field" style="position:fixed;inset:0;background:#123"></div><script>${bundle}</script></body>`;

await eachEngine("input: gamepad", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  const r = await page.evaluate(() => {
    const api = typeof navigator.getGamepads === "function";
    const pad = { index: 0, connected: true, buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })), axes: [0, 0, 0, 0] };
    const pads = [null, null, null, null];
    let calls = 0;
    navigator.getGamepads = () => (calls++, pads);
    const field = document.getElementById("field");
    const e = fizlet.createEngine({ root: field, pause: { hidden: false, offscreen: false, editable: false } });
    const c = fizlet.controls(e, { target: field, stick: "left", keys: { fire: ["Space"], gas: ["KeyG"] } });
    const g = fizlet.gamepad(c, { map: { fire: [0], gas: [7] } });
    let hits = 0;
    e.add({ step: () => void (c.hit("fire") && hits++) });
    const read = () => (e.advance(1 / 60), { connected: g.connected, fire: c.down("fire"), hits, gas: +g.value("gas").toFixed(3), active: c.stick.active, x: +c.stick.x.toFixed(3) });
    const setup = calls;
    const idle = read();
    const idleCalls = calls - setup;
    pads[0] = pad;
    dispatchEvent(new Event("gamepadconnected"));
    pad.buttons[0] = { value: 1, pressed: true };
    pad.buttons[7] = { value: 0.575, pressed: true };
    pad.axes[0] = -0.575;
    const on = read();
    pad.buttons[0] = { value: 0, pressed: false };
    const up = read();
    pads[0] = null;
    dispatchEvent(new Event("gamepaddisconnected"));
    const off = read();
    g.stop();
    return { api, idle, idleCalls, on, up, off };
  });
  assert.equal(r.api, true, "the engine has navigator.getGamepads");
  assert.equal(r.idleCalls, 0, "no pad: a read never polls");
  assert.deepEqual(r.idle, { connected: false, fire: false, hits: 0, gas: 0, active: false, x: 0 });
  assert.deepEqual(r.on, { connected: true, fire: true, hits: 1, gas: 0.5, active: true, x: -0.5 }, "A presses fire (one hit), the trigger reads past the dead zone, the stick steers");
  assert.deepEqual(r.up, { connected: true, fire: false, hits: 1, gas: 0.5, active: true, x: -0.5 }, "A up lets fire go");
  assert.deepEqual(r.off, { connected: false, fire: false, hits: 1, gas: 0, active: false, x: 0 }, "unplugged: everything let go");
  assert.deepEqual(errs, []);
  await ctx.close();
});
