// The gallery's on-screen keys (site/gallery/pieces/keys.ts) in Chromium on a touch screen: a real tap
// on a key fires it once (its follow-up click is the same press, whatever its detail), and a tap on
// one key never swallows a keyboard press (a click with detail 0) on another key within the second
// after it. The stage tap (`tap`) has its own timestamp too.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const js = (await build({ stdin: { contents: 'export { keys } from "./site/gallery/pieces/keys.ts";', resolveDir: ".", loader: "ts" }, bundle: true, format: "iife", globalName: "K", write: false, logLevel: "silent" })).outputFiles[0].text;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0">
<div id="stage" style="position:relative;width:360px;height:240px;background:#123"></div><script>${js}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.setContent(PAGE);
  await p.evaluate(() => {
    const ctl = new AbortController(), stage = document.getElementById("stage");
    // The two parts of an engine the keys use: its ledger (Recall) and its signal.
    const engine = { ledger: { add: (el) => el }, signal: ctl.signal };
    window.log = [];
    const [a, b] = K.keys(engine, stage, [{ label: "A", id: 1 }, { label: "B", id: 2 }, { label: "C", id: 3 }], (id, d) => window.log.push(id + (d ? "+" : "-")), 3);
    a.id = "ka"; b.id = "kb";
    a.style.cssText = "position:absolute;left:10px;top:10px;width:60px;height:60px";
    b.style.cssText = "position:absolute;left:100px;top:10px;width:60px;height:60px";
  });
  const log = () => p.evaluate(() => window.log.splice(0));
  const centre = async (sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };

  // A real tap on A fires it once.
  await p.touchscreen.tap(...(await centre("#ka")));
  await p.waitForTimeout(50);
  assert.deepEqual(await log(), ["1+"], "a real tap on A fires once");

  // The click a tap can bring with detail 0 (as CI's Chromium does) right after it: still the same press.
  await p.touchscreen.tap(...(await centre("#ka")));
  await p.evaluate(() => document.getElementById("ka").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  assert.deepEqual(await log(), ["1+"], "a tap's detail-0 follow-up click on A is not a second press");

  // Tap A, then a synthetic click (detail 0) on B within the second: both fire.
  await p.touchscreen.tap(...(await centre("#ka")));
  await p.evaluate(() => document.getElementById("kb").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  assert.deepEqual(await log(), ["1+", "2+"], "tap A, then click B (detail 0) within 1 s: both fire");

  // Tap A, then a keyboard press on B (Enter on the focused key) within the second: both fire.
  await p.touchscreen.tap(...(await centre("#ka")));
  await p.focus("#kb");
  await p.keyboard.press("Enter");
  assert.deepEqual(await log(), ["1+", "2+"], "tap A, then Enter on B within 1 s: both fire");

  // A tap on the stage itself (the `tap` key) never swallows a keyboard press on A (A's own last tap
  // is over a second ago).
  await p.waitForTimeout(1100);
  await p.touchscreen.tap(300, 200);
  await p.evaluate(() => document.getElementById("ka").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })));
  assert.deepEqual(await log(), ["3+", "1+"], "a stage tap, then click A (detail 0): both fire");

  console.log("gallery keys: a tap fires once, its follow-up click is swallowed, a tap never swallows a press on another key or after a stage tap: ok");
} finally {
  await browser.close();
}
