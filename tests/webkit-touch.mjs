// @fzlt/core/touch (lockTouch) in WebKit and Chromium (tests/engines.mjs, BROWSERS), on a 390 x 844
// touch phone with the Board UI kit CSS. WebKit has no CDP touch and no Touch constructor, so the
// gestures are events dispatched on the surfaces: iOS's `gesturestart` / `gesturechange` (its pinch)
// and a two-finger `touchmove` are cancelled on a slot and a game host, never on the page's copy; a
// one-finger touch is never cancelled (taps, drags and the page's scroll stay); release() hands
// everything back. The kit's touch-action rules resolve the same in both engines, a real tap on a
// surface still lands, and the page stays 390 wide and scrolls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { eachEngine, PHONE } from "./engines.mjs";

const js = (await build({ entryPoints: ["src/touch.ts"], bundle: true, format: "iife", globalName: "touch", write: false, logLevel: "silent" })).outputFiles[0].text;
const CSS = readFileSync("src/ui/board-ui.css", "utf8");

const PAGE = `<!doctype html><html class="bui"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${CSS}</style><style>body{margin:0;font:16px/1.5 sans-serif}p{margin:16px}.slot{position:relative;display:block;margin:16px;height:300px;background:#123}
.host{margin:16px;height:400px;background:#321}</style></head><body>
<p id="copy">Copy the page keeps: it still pinch-zooms (WCAG 1.4.4).</p>
<figure class="ae-slot slot" id="slot"><div data-fizlet-slot="home#hero" style="position:absolute;inset:0"></div></figure>
<div data-fizlet-host="game" class="host" id="host"></div>
${"<p>Filler so the page scrolls.</p>".repeat(60)}<script>${js}</script></body></html>`;

await eachEngine("touch: lockTouch on slots and game hosts", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  // Which gestures each element cancels: a gesture event, a two-finger and a one-finger touchmove
  // (an Event with a `touches` list: what lockTouch reads), and a one-finger touchstart.
  const cancelled = () => page.evaluate(() => {
    const fire = (el, type, fingers) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      if (fingers) Object.defineProperty(ev, "touches", { value: { length: fingers } });
      el.dispatchEvent(ev);
      return ev.defaultPrevented ? 1 : 0;
    };
    const at = { slot: document.querySelector("[data-fizlet-slot]"), host: document.getElementById("host"), copy: document.getElementById("copy") };
    return Object.fromEntries(Object.entries(at).map(([k, el]) => [k, [fire(el, "gesturestart"), fire(el, "gesturechange"), fire(el, "touchmove", 2), fire(el, "touchmove", 1), fire(el, "touchstart", 1)].join("")]));
  });

  assert.deepEqual(await cancelled(), { slot: "00000", host: "00000", copy: "00000" }, "control: nothing is cancelled before the lock");
  await page.evaluate(() => (window.release = touch.lockTouch()));
  assert.deepEqual(await cancelled(), { slot: "11100", host: "11100", copy: "00000" }, "pinch gestures cancelled on surfaces only; one finger never");
  await page.evaluate(() => release());
  assert.deepEqual(await cancelled(), { slot: "00000", host: "00000", copy: "00000" }, "release() hands the gestures back");
  await page.evaluate(() => (window.release = touch.lockTouch(document, null)));
  assert.deepEqual(await cancelled(), { slot: "11100", host: "11100", copy: "11100" }, "null locks the whole page");
  await page.evaluate(() => (release(), (window.release = touch.lockTouch())));

  // The CSS half: touch-action resolves the same in both engines.
  const ta = await page.evaluate(() => ["html", "[data-fizlet-slot]", "#host", "#copy"].map((s) => getComputedStyle(document.querySelector(s)).touchAction));
  // touch-action is not inherited: the copy computes auto and gets the page's manipulation from its ancestor.
  assert.deepEqual(ta, ["manipulation", "pan-y", "none", "auto"], "touch-action: page, slot, host, copy");

  // A real tap on the host still lands (one finger, never cancelled), and the page still scrolls.
  await page.evaluate(() => { window.taps = 0; document.getElementById("host").addEventListener("pointerup", () => taps++); });
  await page.evaluate(() => document.getElementById("host").scrollIntoView({ block: "center" }));
  const box = await page.evaluate(() => { const r = document.getElementById("host").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(box[0], box[1]);
  const after = await page.evaluate(() => ({ taps, y: scrollY > 100, w: document.documentElement.scrollWidth, scale: visualViewport.scale }));
  assert.deepEqual(after, { taps: 1, y: true, w: 390, scale: 1 }, "a tap lands, the page scrolled to the host, 390 wide, scale 1");

  assert.deepEqual(errs, []);
  await ctx.close();
});
