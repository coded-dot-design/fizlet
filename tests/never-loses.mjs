// Never Loses (site/gallery/pieces/never-loses.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet), mounted through @fzlt/core/slot, wide (720) and in its phone
// shape (358): it mounts and settles to no frames with no audio before a gesture; the nine cells are
// keys of 44 px or more; the keyboard plays it (1–9, arrows + Enter) and so does a tap; the bot answers
// every move and each one adds a line one step further right in its source; a game ends in a draw or
// a bot win with PLAY AGAIN?, which nests deeper still; the stage settles again; Recall gives the page
// back byte for byte; reduced motion keeps the still stage (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/never-loses.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/never-loses.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#never-loses" role="img" aria-label="Never Loses" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 15000 }).catch(() => { throw new Error(`${what}: never settled`); });
const moves = (p) => p.evaluate(() => scene.state.board.replace(/0/g, "").length);
const indent = (p) => p.evaluate(() => { const l = document.querySelector(".nl-code").lastElementChild.textContent; return l.length - l.trimStart().length; });

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    const keys = await p.evaluate(() => [...document.querySelectorAll(".nl-cell")].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) >= 44; }));
    assert.deepEqual(keys, Array(9).fill(true), `${at}: nine cell keys, 44 px or more`);
    await settle(p, `${at}: mounted`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    // Play a game: the keyboard (1, then arrows + Enter), then taps, until it ends.
    await p.focus(".nl-cell");
    await p.keyboard.press("1");
    await p.waitForFunction(() => scene.state.board.replace(/0/g, "").length === 2 && scene.state.turn === 1, null, { timeout: 3000 });
    const i1 = await indent(p);
    const empty = () => p.evaluate(() => scene.state.board.indexOf("0"));
    // Arrows from the focused cell to the first empty one, then Enter.
    const target = await empty();
    await p.evaluate(() => document.querySelectorAll(".nl-cell")[4].focus());
    for (let k = 4; k !== target; k = (k + 1) % 9) await p.keyboard.press("ArrowRight");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => scene.state.board.replace(/0/g, "").length >= 3 && scene.state.turn === 1, null, { timeout: 3000 });
    assert.ok((await indent(p)) > i1, `${at}: every move nests one step further right`);
    while (!(await p.evaluate(() => scene.state.over))) {
      const n = await moves(p), i = await empty();
      await p.click(`.nl-cell >> nth=${i}`);
      await p.waitForFunction((n) => scene.state.over || (scene.state.board.replace(/0/g, "").length > n + 1 && scene.state.turn === 1), n, { timeout: 3000 });
    }
    const end = await p.evaluate(() => scene.state);
    assert.ok(end.over === 1 || end.over === 2, `${at}: a draw or a bot win, never yours (${end.board})`);
    await p.waitForSelector(".nl-end button", { timeout: 4000 });
    const d0 = await indent(p);
    await p.click(".nl-end button");
    await p.waitForFunction(() => scene.state.board === "000000000" && !scene.state.over, null, { timeout: 3000 });
    assert.ok((await indent(p)) > d0, `${at}: PLAY AGAIN? nests deeper`);
    assert.equal(await p.evaluate(() => document.querySelector(".nl-end")), null, `${at}: the sticker goes`);
    await settle(p, `${at}: after a game`);
    // Recall: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
  // Reduced motion: the stage is the still; the scene never mounts.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(720, false));
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, board: document.querySelector(".nl-board").getBoundingClientRect().width > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, board: true }, "reduced motion keeps the still stage");
  await ctx.close();
  console.log("never-loses: mounts and settles (no audio before a gesture), 44 px cells, 1–9 / arrows + Enter / taps play, the bot answers and the source nests, a draw or a bot win, PLAY AGAIN? nests deeper, Recall exact, reduced motion still, wide and tall — ok");
} finally {
  await browser.close();
}
