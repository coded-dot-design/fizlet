// @fzlt/core/beam and @fzlt/core/cards in Chromium at 2× and 1×, each on a diorama board run by
// the kernel.
// - A mirror puzzle on a grid: the beam starts off the board; a real click on the first mirror
//   turns it a quarter, the beam re-routes off a second mirror and a splitter, grows out and lights
//   both targets (their tint changes on screen), then the engine settles to 0 frames.
// - A deck: five cards dealt face down into a hand fanned toward the camera; a real click on the
//   top card flips it face up, a second click plays it to the table, where its painted face shows;
//   then the engine settles.
// The maths, timing and zero allocation: tests/beam.test.mjs, tests/cards.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { beam, dioramaBeam } from "./src/beam.ts"; export { deck, dioramaCards } from "./src/cards.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="cv" style="display:block;width:480px;height:360px;margin:10px"></canvas><script>${bundle}</script></body>`;

/** The mirror puzzle (runs in the page). */
function beamScene() {
  const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#1b1d27" }), Q = Math.PI / 4, C = 1.2;
  Object.assign(d.cam, { yaw: -0.3, pitch: 0.95, dist: 13, tx: 0, ty: 0, tz: 0.3, fov: 0.62 });
  d.cluster("table", { fixed: 0 });
  d.add({ id: "board", size: [7 * C + 0.6, 0.4, 5 * C + 0.6], pos: [0, -0.4, 0], color: "#3a3f52", cluster: "table", pick: false });
  for (let c = 0; c < 7; c++) for (let r = 0; r < 5; r++) d.add({ size: [C - 0.08, 0.03, C - 0.08], pos: [(c - 3) * C, 0, (r - 2) * C], on: "board", color: (c + r) % 2 ? "#4a5068" : "#434960", pick: false });
  const b = fz.beam({ grid: { cell: C, x0: -3.5 * C, z0: -2.5 * C }, bounds: [-3.5 * C, -2.5 * C, 3.5 * C, 2.5 * C] });
  const parts = [
    { kind: "emitter", col: 0, row: 1, a: 0 },
    { kind: "mirror", col: 4, row: 1, a: 3 * Q, turn: true }, // sends the beam off the top edge until turned
    { kind: "mirror", col: 4, row: 3, a: 3 * Q },
    { kind: "splitter", col: 2, row: 3, a: Q },
    { kind: "target", col: 0, row: 3, r: 0.32 },
    { kind: "target", col: 2, row: 0, r: 0.32 },
    { kind: "blocker", col: 6, row: 1, a: Math.PI / 2 },
  ];
  const obs = [];
  parts.forEach((p, i) => {
    const j = b.add(p), x = b.x[j], z = b.z[j], id = "p" + i, tag = { part: j, turn: !!p.turn };
    if (p.kind === "emitter") d.add({ id, size: [0.9, 0.55, 0.6], pos: [x, 0.03, z], rot: [0, -p.a, 0], on: "board", color: "#c9ccd6", shadow: 0.3, tag });
    else if (p.kind === "target") d.add({ id, shape: "cyl", sides: 14, size: [0.64, 0.5, 0.64], pos: [x, 0.03, z], on: "board", color: "#6b7088", shadow: 0.3, tag });
    else if (p.kind === "blocker") d.add({ id, size: [C * 0.9, 0.7, 0.3], pos: [x, 0.03, z], rot: [0, -p.a, 0], on: "board", color: "#7a5a48", shadow: 0.3, tag });
    else {
      d.add({ id: id + "s", shape: "cyl", sides: 12, size: [0.5, 0.12, 0.5], pos: [x, 0.03, z], on: "board", color: p.turn ? "#f2b33d" : "#8d93a8", tag });
      d.add({ id, size: [C * 0.95, 0.7, 0.07], rot: [0, -p.a, 0], on: id + "s", color: p.kind === "splitter" ? "#7fd8ff" : "#dfe6f2", alpha: p.kind === "splitter" ? 0.7 : 1, tag });
    }
    obs[j] = d.get(id);
  });
  const v = fz.dioramaBeam(d, b, { on: "board", light: (j, on) => { obs[j].tint = on ? "#6dff8e" : null; obs[j].emissive = on; } });
  b.run();
  const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(1);
  let draws = 0;
  e.add({ step(_, dt) { T[0] += dt; if (v.show(T[0])) e.busy(); }, render: () => (d.draw(), draws++) });
  e.start();
  cv.addEventListener("click", (ev) => {
    const hit = d.root(d.pick(ev.offsetX, ev.offsetY)), t = hit && hit.tag;
    if (!t || !t.turn) return;
    b.turn(t.part, 2 * Q);
    obs[t.part].rot[1] = -b.a[t.part];
    b.run();
    e.wake();
  });
  window.st = () => ({ lit: b.litCount(), shown: v.lit, n: b.n, draws, tint: [obs[4].tint, obs[5].tint] });
  window.eng = e;
  window.dio = d;
  d.draw();
  const out = new Float64Array(3), m = obs[1].M;
  d.project(m[9], m[10] + 0.35, m[11], out); // the turnable mirror's middle
  return [out[0], out[1]];
}

/** The card table (runs in the page). */
function cardsScene() {
  const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#18402f" });
  Object.assign(d.cam, { yaw: 0, pitch: 0.82, dist: 11, tx: 0, ty: 0, tz: 0.6, fov: 0.62 });
  d.cluster("table", { fixed: 0 });
  d.add({ id: "table", size: [11, 0.3, 8], pos: [0, -0.3, 0], color: "#1f6b4a", cluster: "table", pick: false });
  const SUIT = ["♠", "♥", "♦", "♣"], RANK = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const k = fz.deck({ size: 52, piles: ["draw", "hand", "table"] });
  k.shuffle(0, 20261113);
  const v = fz.dioramaCards(d, k, {
    on: "table",
    piles: [{ type: "stack", x: -3.2, z: -1.2 }, { type: "fan", x: 0, z: 2.4 }, { type: "row", x: 0.8, z: -1.2 }],
    face(ctx, c) {
      const red = (c / 13 | 0) % 3 !== 0;
      ctx.fillStyle = "#fbf8f1";
      ctx.fillRect(0, 0, 100, 140);
      ctx.fillStyle = red ? "#d0312d" : "#1d1b22";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(RANK[c % 13], 9, 31);
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(SUIT[c / 13 | 0], 50, 96);
    },
  });
  const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(1);
  e.add({ step(_, dt) { T[0] += dt; if (v.show(T[0])) e.busy(); }, render: () => d.draw() });
  e.start();
  const hand = k.id("hand"), table = k.id("table");
  k.deal(0, [hand], 5, 0); // five, face down
  cv.addEventListener("click", (ev) => {
    const c = v.pick(ev.offsetX, ev.offsetY);
    if (c < 0 || k.pile[c] !== hand) return;
    if (!k.up[c]) k.flip(c, 1);
    else k.move(c, table, -1, 1);
    e.wake();
  });
  window.st = () => ({ hand: k.count(hand), table: k.count(table), top: k.top(hand), up: k.up.slice(), played: k.at(table, 0) });
  window.at = (c) => {
    const m = v.groups[c].M, out = new Float64Array(3);
    d.project(m[9], m[10], m[11], out);
    return [out[0], out[1]];
  };
  // A point on card c's top side (the face), (u, w) from its centre in card widths and heights.
  window.on = (c, u, w) => {
    const m = v.bodies[c].M, x = u, y = 0.012, z = w * 1.4, out = new Float64Array(3);
    d.project(m[0] * x + m[1] * y + m[2] * z + m[9], m[3] * x + m[4] * y + m[5] * z + m[10], m[6] * x + m[7] * y + m[8] * z + m[11], out);
    return [out[0], out[1]];
  };
  window.eng = e;
  window.dio = d;
}

const settled = async (p) => p.evaluate(async () => {
  const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
  for (let i = 0; i < 240 && !window.eng.paused.includes("settled"); i++) await frame();
  const f0 = window.eng.stats().frames;
  for (let i = 0; i < 20; i++) await frame();
  return window.eng.stats().frames - f0;
});
const pixel = (p, x, y) => p.evaluate(([x, y]) => { const d = window.dio; return Array.from(d.ctx.getImageData(Math.round(x * d.dpr), Math.round(y * d.dpr), 1, 1).data.slice(0, 3)); }, [x, y]);

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    // Beam.
    let p = await browser.newPage({ viewport: { width: 520, height: 400 }, deviceScaleFactor: dpr });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const at = await p.evaluate(beamScene);
    assert.equal(await settled(p), 0, "settled before the click");
    let s = await p.evaluate(() => window.st());
    assert.deepEqual([s.lit, s.shown], [0, 0], "nothing lit at first");
    const box = await p.locator("#cv").boundingBox();
    await p.mouse.click(box.x + at[0], box.y + at[1]);
    assert.equal(await settled(p), 0, "settled after the beam grew and the sparks died");
    s = await p.evaluate(() => window.st());
    assert.deepEqual([s.lit, s.shown, s.tint], [2, 2, ["#6dff8e", "#6dff8e"]], "both targets lit, on screen too");
    const px = await p.evaluate(() => {
      const d = window.dio, out = new Float64Array(3), m = d.get("board").M, C = 1.2, top = 0.4;
      const pt = (x, y, z) => (d.project(x, m[10] + top + y, z, out), Array.from(d.ctx.getImageData(Math.round(out[0] * d.dpr), Math.round(out[1] * d.dpr), 1, 1).data.slice(0, 3)));
      return { beam: pt(-1.5 * C + 0.3, 0.35, -C), target: pt(-3 * C, 0.53, C) };
    });
    assert.ok(px.beam[0] > 200 && px.beam[0] > px.beam[2], `the beam glows red-white over row 1: ${px.beam}`);
    assert.ok(px.target[1] > 180, `the target's top is lit green: ${px.target}`);
    assert.deepEqual(errs, []);
    await p.evaluate(() => window.eng.destroy());
    await p.close();

    // Cards.
    p = await browser.newPage({ viewport: { width: 520, height: 400 }, deviceScaleFactor: dpr });
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    await p.evaluate(cardsScene);
    assert.equal(await settled(p), 0, "settled after the deal");
    s = await p.evaluate(() => window.st());
    assert.deepEqual([s.hand, s.table, s.up[s.top]], [5, 0, 0], "five in the hand, face down");
    const card = s.top, xy = await p.evaluate((c) => window.at(c), card);
    const back = await pixel(p, xy[0], xy[1]);
    assert.ok(back[2] > back[0] + 30, `its back shows (blue): ${back}`);
    await p.mouse.click(box.x + xy[0], box.y + xy[1]);
    assert.equal(await settled(p), 0, "settled after the flip");
    s = await p.evaluate(() => window.st());
    assert.equal(s.up[card], 1, "the clicked card flipped face up");
    const fxy = await p.evaluate((c) => window.on(c, 0.3, -0.2), card), face = await pixel(p, fxy[0], fxy[1]);
    assert.ok(face[0] > 200 && face[1] > 200 && face[2] > 190, `its face shows (paper): ${face}`);
    await p.mouse.click(box.x + xy[0], box.y + xy[1]);
    assert.equal(await settled(p), 0, "settled after the play");
    s = await p.evaluate(() => window.st());
    assert.deepEqual([s.hand, s.table, s.played], [4, 1, card], "played to the table");
    const on = await p.evaluate((c) => window.on(c, 0.3, -0.2), card), lay = await pixel(p, on[0], on[1]);
    assert.ok(lay[0] > 200 && lay[1] > 200, `face up on the table: ${lay}`);
    assert.deepEqual(errs, []);
    await p.evaluate(() => window.eng.destroy());
    await p.close();
  }
  console.log("beam + cards (Chromium): a click turns a mirror and the beam lights two targets; five cards fan, one flips and plays to the table; both settle ✓");
} finally {
  await browser.close();
}
