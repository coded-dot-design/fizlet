// fzlt/arcade's drag() on a board that is not the viewport: under a page header, mid-page and
// scrolled, inside a bordered box (the Blitz case). The card follows the pointer exactly (no jump on
// the first move) and stays inside its board. The arcade overlay itself (fixed to the viewport) is
// covered by tests/arcade.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const js = (await build({ stdin: { contents: 'export { drag } from "./src/arcade-parts";', resolveDir: ".", loader: "ts" }, bundle: true, format: "iife", globalName: "P", write: false, logLevel: "silent" })).outputFiles[0].text;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<header style="height:320px;background:#223">Site header</header>
<p style="height:200px;margin:0">Copy above the board.</p>
<div id="board" style="position:relative;width:700px;height:500px;margin-left:90px;border:7px solid #333">
  <section id="card" style="position:absolute;right:12px;bottom:12px;width:220px;height:120px;background:#eee"><b>Score</b> <button id="k">Key</button></section>
</div><div style="height:1500px"></div><script>${js}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await p.setContent(PAGE);
  await p.evaluate(() => (window.ctl = new AbortController(), P.drag(document.getElementById("card"), window.ctl.signal)));
  await p.evaluate(() => scrollTo(0, 400)); // the board is now partly above the fold's top
  const box = () => p.locator("#card").evaluate((c) => c.getBoundingClientRect().toJSON());
  const a = await box();
  const x = a.left + 30, y = a.top + 20;
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(x + 1, y + 1);
  const first = await box();
  assert.ok(Math.abs(first.left - (a.left + 1)) < 1 && Math.abs(first.top - (a.top + 1)) < 1, `no jump on the first move: ${JSON.stringify([a.left, a.top, first.left, first.top])}`);
  await p.mouse.move(x - 250, y - 150, { steps: 5 });
  await p.mouse.up();
  const b = await box();
  assert.ok(Math.abs(b.left - (a.left - 250)) < 1 && Math.abs(b.top - (a.top - 150)) < 1, `follows the pointer: ${JSON.stringify([a.left, a.top, b.left, b.top])}`);
  // Dragged far out, it stops at the board's padding box (inside the 7 px border), not the viewport.
  await p.mouse.move(b.left + 30, b.top + 20);
  await p.mouse.down();
  await p.mouse.move(-500, -500, { steps: 4 });
  await p.mouse.up();
  const c = await box(), board = await p.locator("#board").evaluate((d) => d.getBoundingClientRect().toJSON());
  assert.ok(Math.abs(c.left - (board.left + 7)) < 1 && Math.abs(c.top - (board.top + 7)) < 1, `stays inside its board: ${JSON.stringify([c.left, c.top, board.left, board.top])}`);
  // The card's own inline styles survive (only left/top/right/bottom/translate change).
  assert.deepEqual(await p.locator("#card").evaluate((c) => [c.style.position, c.style.width, c.style.background]), ["absolute", "220px", "rgb(238, 238, 238)"], "keeps its own inline styles");
  // A hover or a release over the card reads no layout (each move would force one after the page's
  // own writes); a press and each drag move read it once.
  const reads = await p.evaluate(() => {
    const card = document.getElementById("card"), proto = Element.prototype, real = proto.getBoundingClientRect;
    let n = 0;
    proto.getBoundingClientRect = function () { if (this === card) n++; return real.call(this); };
    const at = card.getBoundingClientRect(), x = at.left + 30, y = at.top + 20, ev = (type, dx = 0) => card.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x + dx, clientY: y, pointerId: 1, isPrimary: true }));
    n = 0;
    for (let i = 0; i < 10; i++) ev("pointermove", i);
    ev("pointerup");
    const hover = n;
    n = 0;
    try { ev("pointerdown"); } catch {}
    const press = n;
    n = 0;
    for (let i = 0; i < 5; i++) ev("pointermove", i);
    const moves = n;
    ev("pointerup");
    proto.getBoundingClientRect = real;
    return { hover, press, moves };
  });
  assert.deepEqual(reads, { hover: 0, press: 1, moves: 5 }, "layout is read only on a press and while dragging");
  // Its keys still click, and do not start a drag.
  await p.locator("#k").click();
  assert.equal(await p.locator("#card").evaluate((c) => c.classList.contains("drag")), false);
  console.log("drag: under a header, mid-page and scrolled, in a bordered board: no jump, follows the pointer, stays inside, keeps its styles, keys click — ok");
} finally {
  await browser.close();
}
