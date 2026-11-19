// @fzlt/core/debug's touchLog() in WebKit and Chromium (tests/engines.mjs, BROWSERS) on a 390 x 844
// touch phone: real taps log pointer and touch events with the element hit (an icon inside a key
// in a shadow root names its host), the box never takes a touch (a tap through it lands on the page),
// nothing is cancelled (the page still gets its click), and stop() gives the page back.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { eachEngine, PHONE } from "./engines.mjs";

const bundle = (await build({
  stdin: { contents: 'export { touchLog } from "./src/debug.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="margin:0"><button id="go" style="position:fixed;left:20px;bottom:20px;width:200px;height:120px">GO</button>
<div id="game" style="position:fixed;left:20px;top:20px;width:200px;height:200px"></div><script>${bundle}</script></body>`;

await eachEngine("debug: touchLog", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  await page.evaluate(() => {
    const root = document.getElementById("game").attachShadow({ mode: "open" });
    root.innerHTML = '<button class="key" style="width:200px;height:200px"><span class="icon" style="display:block;width:100px;height:100px"></span></button>';
    window.clicks = [];
    addEventListener("click", (ev) => clicks.push(ev.composedPath()[0].id || ev.composedPath()[0].className));
    window.log = fizlet.touchLog({ lines: 20 });
  });
  await page.touchscreen.tap(70, 70); // the icon inside the shadow root
  await page.waitForFunction(() => log.lines.some((l) => l.includes(" click ")));
  const inShadow = await page.evaluate(() => log.lines.slice());
  for (const type of ["pointerdown", "touchstart", "pointerup", "touchend", "click"]) assert.ok(inShadow.some((l) => l.includes(" " + type + " ")), `${type} logged: ${inShadow.join(" | ")}`);
  assert.ok(inShadow.some((l) => / pointerdown touch \d+ 70,70 span\.icon in div#game$/.test(l)), `the hit element inside the shadow root, and its host: ${inShadow.join(" | ")}`);
  // The box sits over the GO key (bottom left): a tap through it lands on the key.
  const over = await page.evaluate(() => { const b = log.el.getBoundingClientRect(), g = document.getElementById("go").getBoundingClientRect(); return b.bottom > g.top && b.left < g.right; });
  assert.ok(over, "the log box overlaps the GO key");
  await page.touchscreen.tap(60, 844 - 40);
  await page.waitForFunction(() => clicks.includes("go"));
  assert.equal(await page.evaluate(() => document.elementFromPoint(60, 844 - 40).id), "go", "the box never takes a touch");
  assert.deepEqual(await page.evaluate(() => clicks), ["icon", "go"], "the page still gets every click (nothing cancelled)");
  const after = await page.evaluate(() => (log.stop(), [document.querySelectorAll("pre").length, log.lines.length]));
  await page.touchscreen.tap(60, 844 - 40);
  await page.waitForFunction(() => clicks.length === 3);
  assert.deepEqual(after, [0, await page.evaluate(() => log.lines.length)], "stop(): the box is gone and nothing more is logged");
  assert.deepEqual(errs, []);
  await ctx.close();
});
