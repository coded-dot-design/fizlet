// @fzlt/core/drive's drift and contact, and terrain's berm run-out, in Chromium at 2× and 1×: a low
// desert pad with a banked turn whose ends run out flat, two cars on the kernel's fixed step under a
// fixed table camera. The red car runs up, pulls the handbrake into a left turn (the tail swings out,
// skid marks, a drift score), catches it with counter-steer and banks the chain (`drive:drift`), then
// homes in on the blue car, which circles on its own handbrake; the hit (`touchAll`, its `onHit`)
// spins the blue drifter out (`spinOut`, its chain broken). Both brake to rest and the engine settles
// to 0 frames. The maths and zero allocation: tests/drive.test.mjs, tests/terrain.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { terrain, terrainView } from "./src/terrain.ts"; export { drive, touchAll } from "./src/drive.ts"; export { EventRing } from "./src/kernel/ring.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

/** The pad and the run, as page code. */
export const SCENE = `
const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#f4e4cc" });
const t = fz.terrain({ cols: 80, rows: 56, cell: 0.5 });
t.noise({ seed: 5, amp: 0.25, scale: 7 });
// A banked turn at the back of the pad: high on its outside, running out flat past both ends.
const bank = [];
for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.15 + 0.7 * i / 8); bank.push(-6 + Math.cos(a) * 9, -1 - Math.sin(a) * 9); }
t.berm(bank, { width: 4, height: 1, edge: 1.5, side: -1 });
const tv = fz.terrainView(d, t, { bands: [[0.18, "#ead0a4"], [0.5, "#ddb47e"], [99, "#cf9a5e"]], steepColor: "#c48a52", lod: [40] });
const ev = new fz.EventRing(32);
const A = fz.drive(t, { events: ev, id: 1 }), B = fz.drive(t, { events: ev, id: 2 }), cars = [A, B];
A.reset(-16, 7, 0); B.reset(5, -2, 0);
function body(id, color) {
  const g = d.add({ id, shape: "group", size: [1.9, 0.6, 1.1] });
  d.add({ id: id + "b", size: [1.9, 0.4, 1.0], pos: [0, -0.05, 0], on: id, color, layer: 5 });
  d.add({ id: id + "c", size: [0.9, 0.35, 0.85], pos: [-0.2, 0.35, 0], on: id, color: "#2b3445", layer: 5 });
  const hubs = [];
  for (let i = 0; i < 4; i++) {
    hubs.push(d.add({ id: id + "h" + i, shape: "group", size: [0.5, 0, 0.5], on: id }));
    d.add({ id: id + "t" + i, shape: "cyl", sides: 10, size: [0.56, 0.24, 0.56], pos: [0, 0, -0.12], rot: [Math.PI / 2, 0, 0], on: id + "h" + i, color: "#22262c", layer: 5 });
  }
  return { g, hubs };
}
const art = [body("red", "#e04a3a"), body("blue", "#3a6ee0")];
const skid = d.points({ cap: 400, color: "#5b4632" });
const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(3); // phase time, skid carry, time since the hit
const S = { phase: "run", hits: 0, spins: 0, banked: [], draws: 0, maxSlide: 0, maxDrift: 0 };
const hitOpts = { onHit: (a, b) => { S.hits++; for (const v of [a, b]) if (v.drift > 0.3 && !v.spinning) v.spinOut(v.slide > 0 ? 7 : -7, 1.2), S.spins++; } };
Object.assign(d.cam, { yaw: 0.25, pitch: 0.78, dist: 33, tx: -3, ty: 0, tz: 0 });
function pose() {
  for (let k = 0; k < 2; k++) {
    const v = cars[k], a = art[k];
    a.g.pos.set(v.pos); a.g.rot.set(v.rot);
    for (let i = 0; i < 4; i++) {
      const h = a.hubs[i];
      h.pos[0] = v.wheels[i * 2]; h.pos[1] = -(v.rest - v.comp[i]); h.pos[2] = v.wheels[i * 2 + 1];
      h.rot[1] = i < 2 ? -v.steerAngle : 0; h.rot[2] = -v.spin[i];
    }
    tv.shadow(k, v.pos[0], v.pos[2], 1.15, 0.3);
  }
}
e.add({
  step(_, dt) {
    T[0] += dt;
    if (S.phase === "run") {
      if (T[0] < 1.6) A.set(1, 0, 0, 0);
      else if (T[0] < 2.5) A.set(0.8, 0, -1, 1); // the handbrake into a left turn
      else if (T[0] < 2.9) A.set(0.8, 0, Math.max(-1, Math.min(1, A.slide * 2)), 0); // catch it
      else {
        const fx = Math.cos(A.yaw), fz = -Math.sin(A.yaw), ux = B.pos[0] - A.pos[0], uz = B.pos[2] - A.pos[2], l = Math.hypot(ux, uz) || 1;
        A.set(0.9, 0, Math.max(-1, Math.min(1, (-(fx * uz - fz * ux) / l) * 3)), 0); // home in on the blue car
      }
      B.set(0.75, 0, -1, 1); // circling on the handbrake
      if (S.spins) T[2] += dt;
      if (T[2] > 1.6 || T[0] > 10) S.phase = "stop";
    } else for (const v of cars) v.set(0, Math.abs(v.speed) > 0.3 ? 1 : 0, 0, 0);
    let moved = false;
    for (const v of cars) moved = v.step(dt) || moved;
    fz.touchAll(cars, hitOpts);
    S.maxSlide = Math.max(S.maxSlide, Math.abs(A.slide)); S.maxDrift = Math.max(S.maxDrift, A.drift);
    for (let i = 0; i < ev.size; i++) { const x = ev.at(i); if (x.type === "drive:drift") S.banked.push({ id: x.a, broken: x.b, score: x.v }); }
    ev.clear();
    // Skid marks under the rear wheels while a car drifts; they fade slowly.
    for (const v of cars) {
      T[1] += (v.drift + (v.spinning ? 1 : 0)) * 30 * dt;
      while (T[1] >= 1) {
        T[1] -= 1;
        for (const w of [2, 3]) {
          const j = skid.n < skid.x.length ? skid.n++ : (S.draws * 7 + w) % skid.x.length;
          skid.x[j] = v.wheel[w * 3]; skid.y[j] = v.wheel[w * 3 + 1] - v.radius + 0.02; skid.z[j] = v.wheel[w * 3 + 2]; skid.r[j] = 0.13; skid.a[j] = 0.7;
        }
      }
    }
    let live = 0;
    for (let i = 0; i < skid.n; i++) if (skid.a[i] > 0) (skid.a[i] = Math.max(0, skid.a[i] - dt * 0.25)), live++;
    if (S.phase === "stop" && A.resting && B.resting) S.phase = "rest";
    if (moved || live || S.phase !== "rest") e.busy();
  },
  render() {
    pose(); d.draw(); S.draws++;
    const c = d.ctx;
    c.save(); c.setTransform(d.dpr, 0, 0, d.dpr, 0, 0);
    c.font = "700 15px system-ui, sans-serif"; c.fillStyle = "#3b2a1a";
    const red = S.banked.filter((b) => b.id === 1 && !b.broken).reduce((s, b) => s + b.score, 0) + A.chain;
    c.fillText("DRIFT " + Math.round(red * 100), 14, 24);
    if (B.spinning) (c.fillStyle = "#3a6ee0"), c.fillText("SPUN OUT", 14, 44);
    c.restore();
  },
});
pose();
e.start();
window.st = () => ({ ...S, banked: S.banked.slice(), a: { chain: A.chain, drift: A.drift, slide: A.slide, resting: A.resting }, b: { spinning: B.spinning, resting: B.resting }, paused: e.paused.slice() });
window.eng = e; window.dio = d; window.tr = t; window.bank = bank;
`;

export const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4e4cc"><canvas id="cv" style="display:block;width:640px;height:400px;margin:10px"></canvas><script>${bundle}</script><script>${SCENE}</script></body>`;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const browser = await chromium.launch(launchOptions());
  const shots = process.env.SHOTS; // a directory: also save frames (mid-drift, the hit, at rest)
  try {
    for (const dpr of [2, 1]) {
      const p = await browser.newPage({ viewport: { width: 660, height: 420 }, deviceScaleFactor: dpr });
      const errs = [];
      p.on("pageerror", (x) => errs.push(x.message));
      await p.setContent(PAGE);
      // Mid-drift: the slide held, skid marks down, the score counting.
      await p.waitForFunction(() => window.st().a.drift >= 1 && window.st().maxSlide > 0.6, null, { timeout: 20000 });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/drift-1-handbrake.png` });
      const mid = await p.evaluate(() => window.st());
      assert.ok(mid.a.chain > 0, `a drift chain is counting: ${mid.a.chain}`);
      // The hit: the blue drifter spins out, its chain broken; the red car's drift banked clean.
      await p.waitForFunction(() => window.st().spins > 0, null, { timeout: 20000 });
      if (shots && dpr === 2) await p.waitForTimeout(250), await p.screenshot({ path: `${shots}/drift-2-spin-out.png` });
      const hit = await p.evaluate(() => window.st());
      assert.ok(hit.hits >= 1, `the cars touched: ${hit.hits}`);
      const red = hit.banked.find((b) => b.id === 1), blue = hit.banked.find((b) => b.id === 2);
      assert.ok(red && !red.broken && red.score > 0.5, `the red car's drift banked: ${JSON.stringify(red)}`);
      assert.ok(blue && blue.broken === 1, `the blue car's chain broken by the spin-out: ${JSON.stringify(blue)}`);
      assert.ok(hit.maxSlide > 0.6 && hit.maxSlide < 0.85, `the handbrake slide held under \`slide\`: ${hit.maxSlide.toFixed(2)} rad`);
      // The berm's ends run out: the centre line past each end only falls.
      const runout = await p.evaluate(() => {
        const t = window.tr, b = window.bank, n = b.length / 2, out = [];
        for (const [e, q] of [[0, 1], [n - 1, n - 2]]) {
          const ex = b[e * 2], ez = b[e * 2 + 1], dx = ex - b[q * 2], dz = ez - b[q * 2 + 1], l = Math.hypot(dx, dz);
          let last = Infinity, ok = true;
          for (let s = -0.5; s <= 3; s += 0.125) { const y = t.height(ex + (dx / l) * s, ez + (dz / l) * s); ok = ok && y <= last + 0.02; last = y; }
          out.push(ok);
        }
        return out;
      });
      assert.deepEqual(runout, [true, true], "no lump past either end of the banked turn (within the noise)");
      // Both brake to rest; the engine settles.
      await p.waitForFunction(() => window.st().phase === "rest", null, { timeout: 30000 });
      const end = await p.evaluate(async () => {
        const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        for (let i = 0; i < 900 && !window.eng.paused.includes("settled"); i++) await frame();
        const s = window.st(), f0 = window.eng.stats().frames;
        for (let i = 0; i < 20; i++) await frame();
        return { ...s, frames: window.eng.stats().frames - f0 };
      });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/drift-3-rest.png` });
      await p.evaluate(() => window.eng.destroy());
      assert.ok(end.a.resting && end.b.resting, "both at rest");
      assert.ok(end.paused.includes("settled"), `settled: ${end.paused}`);
      assert.equal(end.frames, 0, "settled: 0 frames");
      assert.deepEqual(errs, []);
      await p.close();
    }
    console.log("drive drift + contact (Chromium): a handbrake drift banks its score, a hit spins the drifting car out, the berm runs out flat, both stop, the engine settles ✓");
  } finally {
    await browser.close();
  }
}
