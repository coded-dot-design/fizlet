// @fzlt/core/dice and @fzlt/core/track in Chromium at 2× and 1×: a one-player roll-and-move on a
// diorama board, run by the kernel. A real click on the pop dome pops the die (the value is
// roll(seed)'s: a 2), the die lands with that face up and its pips painted, then the token hops two
// spaces along a looped track and the ladder at space 2 takes it to 9, and the engine settles to 0 frames
// once everything rests. Each brick's maths and zero allocation: tests/dice.test.mjs,
// tests/track.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { dice, roll, popDome, faceUp } from "./src/dice.ts"; export { track } from "./src/track.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="cv" style="display:block;width:480px;height:360px;margin:10px"></canvas><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    const p = await browser.newPage({ viewport: { width: 520, height: 400 }, deviceScaleFactor: dpr });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const at = await p.evaluate(() => {
      const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#efe8de" });
      Object.assign(d.cam, { yaw: -0.35, pitch: 0.95, dist: 21, tx: 0, ty: 0, tz: 0.4, fov: 0.62 });
      d.cluster("table", { fixed: 0 });
      d.add({ id: "board", size: [16, 0.4, 11], pos: [0, -0.4, 0], color: "#2f7d5b", cluster: "table", pick: false });
      const tr = fz.track({ points: [-6, -4, 6, -4, 6, 4, -6, 4], closed: true, smooth: true, spaces: 20, jumps: [[2, 9]] });
      for (let i = 0; i < tr.n; i++) d.add({ id: "s" + i, size: [0.9, 0.06, 0.9], pos: [tr.x[i], 0, tr.z[i]], rot: [0, tr.a[i], 0], on: "board", color: i % 2 ? "#f4efe6" : "#d8cbb5", pick: false });
      const tok = d.add({ id: "tok", shape: "cyl", sides: 12, top: 0.6, size: [0.6, 0.8, 0.6], on: "board", color: "#e04a3a", shadow: 0.3, emissive: true });
      const dc = fz.dice({ count: 1 }), dome = fz.popDome(d, dc, { on: "board", at: [0, 0.4] });
      const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(2); // time since the press, since the move
      let phase = "idle", seed = 0, draws = 0;
      tr.place(0, 0);
      tr.apply(tok, 0, 0.06);
      e.add({
        step(_, dt) {
          if (phase === "pop") {
            T[0] += dt;
            if (dome.show(T[0])) e.busy();
            else (phase = "move"), (T[1] = 0), tr.move(0, dc.value[0]), e.busy();
          } else if (phase === "move") {
            T[1] += dt;
            if (tr.apply(tok, T[1], 0.06)) e.busy();
            else phase = "done";
          }
        },
        render: () => (d.draw(), draws++),
      });
      e.start();
      cv.addEventListener("click", (ev) => {
        const hit = d.root(d.pick(ev.offsetX, ev.offsetY));
        if (phase !== "idle" || !hit || !hit.tag || !hit.tag.dome) return;
        seed = 20261115; // rolls a 2: the token lands on the ladder
        dome.press(seed);
        (phase = "pop"), (T[0] = 0);
        e.wake();
      });
      window.st = () => ({ phase, value: dc.value[0], want: fz.roll(seed), up: fz.faceUp(dc.path, (dc.frames - 1) * 7 + 3), space: tr.at[0], draws, paused: e.paused.slice() });
      window.eng = e;
      window.dio = d;
      d.draw();
      const out = new Float64Array(3);
      d.project(0, 0.15, 0.4 + 2.8, out); // the plinth's front rim
      return [out[0], out[1]];
    });
    // A real click on the front of the dome's plinth.
    const box = await p.locator("#cv").boundingBox();
    await p.mouse.click(box.x + at[0], box.y + at[1]);
    await p.waitForFunction(() => window.st().phase === "done", null, { timeout: 15000 });
    const s = await p.evaluate(() => window.st());
    assert.equal(s.value, s.want, "the value is roll(seed)'s");
    assert.equal(s.up, s.value, "the die lands with that face up");
    assert.equal(s.value, 2, "seed 20261115 rolls a 2");
    assert.equal(s.space, 9, "the token hopped 2 spaces and took the ladder from 2 to 9");
    const px = await p.evaluate(() => {
      const d = window.dio, out = new Float64Array(3), pick = (x, y, z) => (d.project(x, y, z, out), Array.from(d.ctx.getImageData(Math.round(out[0] * d.dpr), Math.round(out[1] * d.dpr), 1, 1).data.slice(0, 3)));
      const tok = d.get("tok"), die = d.get("dome-die0b");
      // The die's top face (body colour or a pip) and the token, from their world matrices.
      const m = die.M, top = [m[1] * 1 + m[9], m[4] * 1 + m[10], m[7] * 1 + m[11]], t = tok.M;
      // Dark pixels over the top face: pips are there.
      const c = [0, 0, 0];
      d.project(top[0], top[1], top[2], c);
      const r = Math.round(14 * d.dpr), img = d.ctx.getImageData(Math.round(c[0] * d.dpr) - r, Math.round(c[1] * d.dpr) - r, 2 * r, 2 * r).data;
      let dark = 0;
      for (let i = 0; i < img.length; i += 4) if (img[i] < 90 && img[i + 1] < 90 && img[i + 2] < 90) dark++;
      return { token: pick(t[1] * 0.4 + t[9], t[4] * 0.4 + t[10], t[7] * 0.4 + t[11]), dark: dark / (4 * r * r), size: [d.ctx.canvas.width, d.dpr] };
    });
    assert.deepEqual(px.size, [480 * dpr, dpr], `backing store at ${dpr}×`);
    assert.ok(px.token[0] > 180 && px.token[1] < 120 && px.token[2] < 120, `the red token stands on its space: ${px.token}`);
    assert.ok(px.dark > 0.02, `pips painted on the top face (${(px.dark * 100).toFixed(1)}% dark)`);
    // Everything rests: the engine settles and runs 0 frames.
    const frames = await p.evaluate(async () => {
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      for (let i = 0; i < 90 && !window.eng.paused.includes("settled"); i++) await frame();
      const f0 = window.eng.stats().frames;
      for (let i = 0; i < 20; i++) await frame();
      const n = window.eng.stats().frames - f0;
      window.eng.destroy();
      return n;
    });
    assert.equal(frames, 0, "settled: 0 frames");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("dice + track (Chromium): a click pops the dome, the die lands on roll(seed) with its pips, the token hops that far, the engine settles ✓");
} finally {
  await browser.close();
}
