// fizlet/view-dom in Chromium: a skirmish of real nodes moves on the kernel clock; a still board
// makes 0 DOM mutations and settles to 0 frames; a death lingers with data-dead, then hides; a reborn
// row takes its node back; with reduced motion a death hides at once; Recall mid-fight restores
// the host byte for byte (its own children and inline style included).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine, scheduler } from "./src/kernel/index.ts"; export { actors } from "./src/actor.ts"; export { viewDom } from "./src/view-dom.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><style>
#board { position: relative; width: 600px; height: 400px; }
#board i { position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: #19f0ff; }
#board i[data-side="1"] { background: #ff2e88; }
#board i[data-dead] { opacity: 0.3; }
</style><body style="margin:0"><div id="board" style="outline: 1px solid red;"><p>The host's own text</p></div><script>${bundle}</script></body>`;

const run = (page) => page.evaluate(async () => {
  const board = document.getElementById("board"), before = board.outerHTML;
  const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
  const frames = async (n) => { for (let k = 0; k < n; k++) await frame(); };
  const e = fz.createEngine({ root: board, settle: 0.3 });
  const A = fz.actors({ cap: 8, sides: 2 });
  const v = fz.viewDom(e, A, board, { linger: 0.4 });
  for (let k = 0; k < 6; k++) { const i = A.spawn(k & 1, 4, k % 3); A.x[i] = 40 + k * 80; A.y[i] = 100 + (k & 1) * 200; }
  let marching = true;
  e.add({ step(e, dt) { if (!marching) return; for (let k = 0; k < A.n; k++) { const i = A.list[k]; if (A.alive[i]) A.y[i] += (A.side[i] ? -40 : 40) * dt; } A.sweep(); } });
  e.start();
  await frames(20);
  const out = { nodes: board.querySelectorAll("i").length };
  const box = board.querySelector("i").getBoundingClientRect(), b0 = board.getBoundingClientRect();
  out.centred = [Math.round(box.left - b0.left + 10), Math.round(box.top - b0.top + 10)];
  out.body = [Math.round(A.x[0]), Math.round(A.y[0])];
  // Hold still: 0 mutations, then settled at 0 frames.
  marching = false;
  await frames(2);
  let muts = 0;
  const mo = new MutationObserver((l) => (muts += l.length));
  mo.observe(board, { attributes: true, childList: true, subtree: true });
  await frames(30);
  out.stillMutations = muts;
  out.settled = e.stats().paused.includes("settled");
  const r0 = fz.scheduler.requests;
  await new Promise((ok) => setTimeout(ok, 300));
  out.framesWhileSettled = fz.scheduler.requests - r0;
  mo.disconnect();
  // A death lingers, then hides; the row lives again in the same node.
  e.wake();
  const el = v.node(2);
  A.kill(2);
  await frames(3);
  out.lingering = [el.hasAttribute("data-dead"), el.hidden];
  await frames(40);
  out.hidden = el.hidden;
  A.sweep();
  const j = A.spawn(1, 4, 2);
  e.wake();
  await frames(3);
  out.reborn = [j, v.node(j) === el, el.hidden, el.hasAttribute("data-dead"), el.dataset.side, board.querySelectorAll("i").length];
  // Recall mid-fight.
  marching = true;
  await frames(5);
  e.destroy();
  out.recall = board.outerHTML === before;
  return out;
});

const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  const r = await run(p);
  assert.deepEqual(errs, []);
  assert.equal(r.nodes, 6, "one node per actor");
  assert.deepEqual(r.centred, r.body, "the node's centre is the body");
  assert.equal(r.stillMutations, 0, "a still board writes nothing");
  assert.ok(r.settled, "and settles");
  assert.equal(r.framesWhileSettled, 0, "at 0 frames");
  assert.deepEqual(r.lingering, [true, false], "a death lingers with data-dead");
  assert.equal(r.hidden, true, "then hides");
  assert.deepEqual(r.reborn, [2, true, false, false, "1", 6], "the reborn row takes its node back, fresh");
  assert.ok(r.recall, "Recall: the host byte for byte");

  const q = await browser.newPage();
  await q.emulateMedia({ reducedMotion: "reduce" });
  await q.setContent(PAGE);
  const m = await q.evaluate(async () => {
    const board = document.getElementById("board");
    const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
    const e = fz.createEngine({ root: board }), A = fz.actors({ cap: 2 }), v = fz.viewDom(e, A, board, { linger: 0.4 });
    A.spawn(0, 1);
    e.start();
    await frame(); await frame();
    A.kill(0);
    await frame(); await frame();
    const el = v.node(0), out = [el.hidden, el.hasAttribute("data-dead")];
    e.destroy();
    return out;
  });
  assert.deepEqual(m, [true, false], "reduced motion: a death hides at once");
  console.log("view-dom: nodes pooled per row, centred on the body, still = 0 mutations and 0 frames settled, linger then hide, reborn row, reduced motion, Recall byte for byte ok");
} finally {
  await browser.close();
}
