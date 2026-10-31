// @fzlt/core/touch + the kit's touch rules in Chromium's phone emulation (390 x 844, touch, mobile):
// a double-tap or a pinch on an animation slot or a game host never zooms the page, a sideways swipe
// on a slot never pans it, a swipe on a game host never scrolls it, and the page stays 390 wide.
// The same page without the lock is the control: there the pinch and the double-tap do zoom, so the
// checks can fail. release() gives the page its pinch back.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const js = (await build({ entryPoints: ["src/touch.ts"], bundle: true, format: "iife", globalName: "touch", write: false, logLevel: "silent" })).outputFiles[0].text;

const PAGE = `<!doctype html><html class="bui"><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font:16px/1.5 sans-serif}p{margin:16px}.slot{position:relative;display:block;margin:16px;height:300px;background:#123}
.host{margin:16px;height:400px;background:#321}</style></head><body>
<p>Copy the page keeps: it still pinch-zooms (WCAG 1.4.4).</p>
<figure class="ae-slot slot" id="slot"><div data-fizlet-slot="home#hero" style="position:absolute;inset:0"></div></figure>
<div data-fizlet-host="game" class="host" id="host"></div>
<div class="slot" id="js"></div>
${"<p>Filler so the page scrolls.</p>".repeat(60)}</body></html>`;

/** A fresh phone page; `lock` adds the kit CSS and lockTouch(). */
async function phone(browser, lock) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  if (lock) {
    await page.addStyleTag({ path: "src/ui/board-ui.css" });
    await page.addScriptTag({ content: js });
    await page.evaluate(() => (window.release = touch.lockTouch()));
  }
  const cdp = await ctx.newCDPSession(page);
  const state = () => page.evaluate(() => ({ scale: visualViewport.scale, x: scrollX, y: scrollY, w: document.documentElement.scrollWidth }));
  const center = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const settle = () => page.waitForTimeout(400);
  const touches = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  return {
    ctx, errs, state, center,
    async doubleTap(sel) {
      const c = await center(sel);
      await cdp.send("Input.synthesizeTapGesture", { ...c, tapCount: 2, gestureSourceType: "touch" });
      await settle();
    },
    // Raw touch points (synthesizePinchGesture's touch source never zooms headless Chromium).
    async pinch(sel) {
      const { x, y } = await center(sel);
      await touches("touchStart", [[x - 15, y], [x + 15, y]]);
      for (let i = 1; i <= 10; i++) await touches("touchMove", [[x - 15 - i * 12, y], [x + 15 + i * 12, y]]), await page.waitForTimeout(16);
      await touches("touchEnd", []);
      await settle();
    },
    async swipe(sel, dx, dy) {
      const { x, y } = await center(sel);
      await touches("touchStart", [[x, y]]);
      for (let i = 1; i <= 10; i++) await touches("touchMove", [[x + (dx * i) / 10, y + (dy * i) / 10]]), await page.waitForTimeout(16);
      await touches("touchEnd", []);
      await settle();
    },
    touchAction: (sel) => page.$eval(sel, (el) => getComputedStyle(el).touchAction),
  };
}

const browser = await chromium.launch(launchOptions());
try {
  // Control: no lock, the same gestures do move the page.
  {
    const p = await phone(browser, false);
    await p.pinch("#slot");
    const pinched = await p.state();
    assert.ok(pinched.scale > 1.2, `control: a pinch zooms an unlocked page (scale ${pinched.scale})`);
    await p.ctx.close();
    const q = await phone(browser, false);
    await q.swipe("#host", 0, -300);
    assert.ok((await q.state()).y > 100, "control: a swipe on an unlocked surface scrolls the page");
    await q.ctx.close();
  }

  const p = await phone(browser, true);
  const start = await p.state();
  assert.deepEqual(start, { scale: 1, x: 0, y: 0, w: 390 });

  await p.swipe("#host", 0, -300);
  assert.deepEqual(await p.state(), start, "a swipe on a game host never scrolls the page");
  await p.swipe("#slot", -250, 0);
  assert.deepEqual(await p.state(), start, "a sideways swipe on a slot neither pans nor zooms");
  for (const sel of ["#slot", "#host"]) {
    await p.doubleTap(sel);
    assert.equal((await p.state()).scale, 1, `double-tap on ${sel} does not zoom`);
    await p.pinch(sel);
    assert.equal((await p.state()).scale, 1, `pinch on ${sel} does not zoom`);
  }
  await p.swipe("#slot", 0, -300);
  assert.ok((await p.state()).y > 100, "the page still scrolls up and down through a slot");
  assert.equal((await p.state()).w, 390, "no horizontal overflow at 390");

  // Chromium on a mobile-friendly viewport never double-tap zooms (iOS Safari does): what stops it
  // there is touch-action, so check it is the one asked for.
  assert.deepEqual([await p.touchAction("html"), await p.touchAction("#slot"), await p.touchAction("#host")], ["manipulation", "pan-y", "none"]);
  // The copy itself keeps pinch-zoom.
  await p.swipe("#slot", 0, 300);
  await p.pinch("p");
  assert.ok((await p.state()).scale > 1.2, "the page's own copy still pinch-zooms");
  assert.deepEqual(p.errs, []);
  await p.ctx.close();

  // The script half alone (no CSS on #js): lockTouch cancels the pinch, release() hands it back.
  const j = await phone(browser, true);
  await j.ctx.pages()[0].evaluate(() => (release(), (window.release = touch.lockTouch(document, "#js"))));
  await j.swipe("#js", 0, -200);
  await j.pinch("#js");
  assert.equal((await j.state()).scale, 1, "lockTouch alone stops a pinch on its surface");
  await j.ctx.pages()[0].evaluate(() => release());
  await j.pinch("#js");
  assert.ok((await j.state()).scale > 1.2, "release() gives the pinch back");
  await j.ctx.close();
  console.log("touch: double-tap, pinch and swipe on slots and game hosts leave the page at scale 1, 390 wide; copy still zooms; control zooms; release() gives pinch back");
} finally {
  await browser.close();
}
