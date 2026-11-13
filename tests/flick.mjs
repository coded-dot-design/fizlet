// @fzlt/core/flick in Chromium at 2× and 1×: a shuffleboard shot on a @fzlt/core/diorama table, run
// by the kernel. A real mouse drag pulls back from the puck (`sling`: the power meter fills), the
// release flicks it down the table between the rails, it knocks the target disc off the open end
// (`flick:hit`, then `flick:fall`: the target lies on the floor, flagged off), the puck stays on
// the table, the box stack beside the lane stands, and the engine settles to 0 frames once
// everything rests. The maths (determinism, collisions, friction, falls, topples, ramps) and zero
// allocation per step: tests/flick.test.mjs. FLICK_SHOTS=<dir> saves screenshots and a video.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { flick, sling } from "./src/flick.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1d1b22"><canvas id="cv" style="display:block;width:560px;height:360px;margin:10px"></canvas><script>${bundle}</script></body>`;
const shots = process.env.FLICK_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    const video = shots && dpr === 2 ? { recordVideo: { dir: shots, size: { width: 580, height: 380 } } } : {};
    const p = await browser.newPage({ viewport: { width: 580, height: 380 }, deviceScaleFactor: dpr, ...video });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const at = await p.evaluate(() => {
      const cv = document.getElementById("cv"), out = new Float64Array(3), Pt = new Float64Array(3);
      const a = fz.sling({ pull: 2.5, max: 14 }), ev = [];
      const d = fz.diorama(cv, {
        background: "#2a2730",
        overlay(ctx) {
          if (!a.active) return;
          // The game's own aim art: a line along the shot, as long as the power, and a meter.
          const x = w.x[puck], z = w.z[puck];
          d.project(x, 0.1, z, out);
          const sx = out[0], sy = out[1];
          d.project(x + a.dx * (1 + a.power * 4), 0.1, z + a.dz * (1 + a.power * 4), out);
          ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(out[0], out[1]); ctx.stroke();
          ctx.fillStyle = "#00000080"; ctx.fillRect(16, 16, 120, 12);
          ctx.fillStyle = a.power > 0.8 ? "#ff5d5d" : "#ffd23f"; ctx.fillRect(16, 16, 120 * a.power, 12);
        },
      });
      Object.assign(d.cam, { yaw: -0.3, pitch: 0.6, dist: 19, tx: 2, ty: -0.8, tz: 0, fov: 0.62 });
      d.cluster("room", { fixed: 0 });
      d.cluster("table", { fixed: 1 });
      d.add({ id: "floor", size: [30, 0.2, 18], pos: [0, -2.2, 0], color: "#3b3642", cluster: "room", pick: false });
      // Pieces draw on layer 5 (the table's + 1), over the line (4.6) and their shadows (4.5).
      d.add({ id: "table", size: [14, 0.4, 4.6], pos: [0, -0.4, 0], color: "#e7d6b8", cluster: "table", pick: false });
      d.add({ id: "line", size: [0.08, 0.01, 4], on: "table", pos: [4.2, 0, 0], color: "#e04a3a", layer: 4.6, pick: false });
      const w = fz.flick({ table: [14, 4.6], floor: -2, events: { emit: (t, i, j) => (ev.push(t === "flick:hit" ? [t, i, j] : t === "flick:rest" ? [t] : [t, i]), true) } });
      // Rails along both long sides; the far end (+x) is open.
      for (const z of [-2.15, 2.15]) {
        w.add({ shape: "box", fixed: true, size: [14, 0.35, 0.3], pos: [0, z] });
        d.add({ size: [14, 0.35, 0.3], on: "table", pos: [0, 0, z], color: "#7a4f32", pick: false });
      }
      const puck = w.add({ pos: [-5, 0], size: [0.8, 0.25], mass: 1.2, friction: 0.12 });
      const target = w.add({ pos: [5.2, 0.05], size: [0.7, 0.22], friction: 0.12 });
      const stack = [w.add({ shape: "box", size: [0.7, 0.7, 0.7], pos: [2.2, 1.4] }), w.add({ shape: "box", size: [0.7, 0.7, 0.7], pos: [2.25, 1.4] })];
      const obs = [];
      obs[puck] = d.add({ id: "puck", shape: "cyl", sides: 18, size: [0.8, 0.25, 0.8], on: "table", color: "#2f6fd6", shadow: 0.3 });
      obs[target] = d.add({ id: "target", shape: "cyl", sides: 18, size: [0.7, 0.22, 0.7], on: "table", color: "#e04a3a", shadow: 0.3 });
      obs[stack[0]] = d.add({ id: "box0", size: [0.7, 0.7, 0.7], on: "table", color: "#ffd23f", shadow: 0.3 });
      obs[stack[1]] = d.add({ id: "box1", size: [0.7, 0.7, 0.7], on: "table", color: "#57c785", shadow: 0.3, layer: 6 });
      const e = fz.createEngine({ settle: 0.3 });
      let draws = 0;
      e.add({
        step(eng, dt) { if (w.step(dt)) eng.busy(); },
        render() {
          for (let i = 0; i < obs.length; i++) {
            if (!obs[i]) continue;
            // What fell off moves onto the floor object (its shadow on the floor), pose and all.
            if (obs[i].on !== "floor" && Math.abs(w.x[i]) > 7) d.on(obs[i], "floor");
            w.apply(i, obs[i], obs[i].on === "floor" ? -2 : 0);
          }
          d.draw();
          draws++;
        },
      });
      // The drag: press on the puck, pull back, let go.
      const ground = (ev2) => d.ground(ev2.offsetX, ev2.offsetY, 0, Pt);
      cv.addEventListener("pointerdown", (ev2) => {
        if (!ground(ev2)) return;
        if (Math.hypot(Pt[0] - w.x[puck], Pt[2] - w.z[puck]) < 0.8) a.begin(w.x[puck], w.z[puck], Pt[0], Pt[2]), e.wake();
      });
      cv.addEventListener("pointermove", (ev2) => { if (a.active && ground(ev2)) a.move(Pt[0], Pt[2]), e.busy(), e.wake(); });
      cv.addEventListener("pointerup", () => {
        if (a.end()) window.shot = [a.angle, a.level], w.flick(puck, a.jx, a.jz);
        e.wake();
      });
      for (let i = 0; i < obs.length; i++) if (obs[i]) w.apply(i, obs[i]);
      d.draw();
      e.start();
      Object.assign(window, { w, d, e, a, ev, puck, target, stack, draws: () => draws });
      const scr = (x, y, z) => (d.project(x, y, z, out), [out[0], out[1]]);
      return { puck: scr(-5, 0.12, 0), back: scr(-6.4, 0, 0) };
    });
    const box = await p.locator("#cv").boundingBox();
    const frame = () => p.evaluate(() => new Promise((ok) => requestAnimationFrame(() => ok())));
    for (let i = 0; i < 3; i++) await frame();
    if (shots) await p.screenshot({ path: `${shots}/flick-${dpr}x-1-ready.png` });
    // A real drag: down on the puck, pull straight back (−x), up.
    await p.mouse.move(box.x + at.puck[0], box.y + at.puck[1]);
    await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(box.x + at.puck[0] + ((at.back[0] - at.puck[0]) * k) / 8, box.y + at.puck[1] + ((at.back[1] - at.puck[1]) * k) / 8);
    await frame();
    const meter = await p.evaluate(() => [a.active, a.power, a.dx, a.dz]);
    assert.equal(meter[0], true, "the press on the puck starts a drag");
    assert.ok(meter[1] > 0.45, `the pull fills the meter: ${meter[1]}`);
    assert.ok(meter[2] > 0.98 && Math.abs(meter[3]) < 0.2, `aimed down the lane (+x): ${meter[2]}, ${meter[3]}`);
    if (shots) await p.screenshot({ path: `${shots}/flick-${dpr}x-2-aim.png` });
    await p.mouse.up();
    if (shots && dpr === 2) {
      await p.waitForFunction(() => w.y[target] < -0.7);
      await p.screenshot({ path: `${shots}/flick-2x-3-falling.png` });
    }
    const r = await p.evaluate(async () => {
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      for (let i = 0; i < 900 && w.busy; i++) await frame();
      for (let i = 0; i < 90 && !e.paused.includes("settled"); i++) await frame();
      const f0 = e.stats().frames;
      for (let i = 0; i < 20; i++) await frame();
      const out = new Float64Array(3);
      d.project(w.x[target], w.y[target] + 0.22, w.z[target], out);
      const floorOb = d.get("target").on;
      const pk = d.pick(out[0], out[1]);
      return {
        busy: w.busy, frames: e.stats().frames - f0, shot: window.shot, ev: ev.map((x) => x.join(" ")),
        target: [w.x[target], w.y[target], w.off[target], w.state[target]], puck: [w.x[puck], w.y[puck], w.off[puck]],
        stack: stack.map((i) => [w.y[i], w.on[i]]), picked: pk && pk.id, floorOb, dims: [d.width, d.height, cv.width],
      };
    });
    if (shots) await p.screenshot({ path: `${shots}/flick-${dpr}x-4-settled.png` });
    assert.ok(r.shot && r.shot[1] > 45, `a shot of two integers: ${r.shot}`);
    assert.ok(r.ev.includes(`flick:hit ${await p.evaluate(() => puck)} ${await p.evaluate(() => target)}`), `the puck hit the target: ${r.ev}`);
    assert.ok(r.ev.includes(`flick:fall ${await p.evaluate(() => target)}`), `the target fell: ${r.ev}`);
    assert.equal(r.ev.at(-1), "flick:rest");
    assert.ok(r.target[0] > 7 && r.target[0] < 12 && r.target[1] === -2 && r.target[2] === 1 && r.target[3] === 0, `the target lies on the floor past the end: ${r.target}`);
    assert.ok(r.puck[0] < 7 && r.puck[1] === 0 && r.puck[2] === 0, `the puck stays on the table: ${r.puck}`);
    assert.deepEqual(r.stack.map((s) => s[0]), [0, 0.7], "the stack beside the lane stands");
    assert.equal(r.picked, "target", "the target is drawn where flick put it (picked there)");
    assert.equal(r.floorOb, "floor", "the page moved it onto the floor object");
    assert.equal(r.busy, false);
    assert.equal(r.frames, 0, "settled: 0 frames");
    assert.deepEqual(r.dims, [560, 360, 560 * dpr], `backing store at ${dpr}×`);
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("flick (Chromium): a real drag fills the meter, the flick knocks the target off the open end onto the floor, the puck stays, the stack stands, the engine settles ✓");
} finally {
  await browser.close();
}
