// The Board UI kit's CSS in WebKit and Chromium (tests/engines.mjs, BROWSERS) on a 390 x 844 touch
// phone: `[hidden]` wins over a component's own display (a grid or flex child with `hidden` has no
// box), and an icon inside a key never takes the touch (a tap on the SVG presses the key; an unsized
// SVG in WebKit is 300 x 150 and would otherwise swallow the thumb).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eachEngine, PHONE } from "./engines.mjs";

const css = readFileSync("src/ui/board-ui.css", "utf8");
const ICON = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6"/></svg>';
const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
.own-grid { display: grid; } .own-flex { display: flex; }</style>
<body style="margin:0"><div class="bui" id="root" style="padding:20px">
<div class="own-grid" id="g" hidden>grid panel</div><p class="own-flex" id="f" hidden>flex row</p>
<div class="bui-overlay" id="o" hidden>overlay</div>
<button type="button" class="bui-key" id="k" style="width:120px;height:120px">${ICON}</button>
<button type="button" class="bui-key" id="u" style="width:120px;height:120px"><svg viewBox="0 0 20 20" style="width:auto;height:auto"><rect width="20" height="20"/></svg></button>
<div class="bui-pad" id="pad" style="position:relative"><button type="button" class="bui-arcade" id="a" style="width:96px;height:96px">${ICON}</button></div>
</div></body>`;

await eachEngine("ui css: [hidden] wins, icons never take a touch", async (browser) => {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setContent(PAGE);
  const boxes = await page.evaluate(() => ["g", "f", "o"].map((id) => { const el = document.getElementById(id), r = el.getBoundingClientRect(); return [id, getComputedStyle(el).display, r.width, r.height]; }));
  assert.deepEqual(boxes, [["g", "none", 0, 0], ["f", "none", 0, 0], ["o", "none", 0, 0]], "a hidden grid, flex or overlay has no box");
  const shown = await page.evaluate(() => { const g = document.getElementById("g"); g.hidden = false; return getComputedStyle(g).display; });
  assert.equal(shown, "grid", "hidden off: the component's own display is back");
  await page.evaluate(() => {
    window.taps = [];
    for (const id of ["k", "u", "a"]) document.getElementById(id).addEventListener("click", (ev) => taps.push([id, ev.target.id || ev.target.tagName.toLowerCase()]));
  });
  // What the finger hits at the icon's centre is the key itself, never the svg or its shape.
  const hit = await page.evaluate(() => ["k", "u", "a"].map((id) => {
    const s = document.querySelector(`#${id} svg`).getBoundingClientRect(), el = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    return [id, el?.id ?? el?.tagName];
  }));
  assert.deepEqual(hit, [["k", "k"], ["u", "u"], ["a", "a"]], "the key is the hit target over its icon");
  for (const id of ["k", "u", "a"]) {
    const s = await page.locator(`#${id} svg`).boundingBox();
    await page.touchscreen.tap(s.x + s.width / 2, s.y + s.height / 2);
  }
  await page.waitForFunction(() => taps.length === 3);
  assert.deepEqual(await page.evaluate(() => taps), [["k", "k"], ["u", "u"], ["a", "a"]], "a tap on each icon presses its key");
  assert.deepEqual(errs, []);
  await ctx.close();
});
