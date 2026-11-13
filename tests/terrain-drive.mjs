// @fzlt/core/terrain and @fzlt/core/drive in Chromium at 2× and 1×: a small desert course (ridged
// dunes from a seed, a flat track ribbon round a loop, a jump ramp, whoops, a banked berm) drawn
// into a diorama, and a four-wheeler on it driven by a scripted input (follow the loop for a lap,
// then brake) under the chase camera, all on the kernel's fixed step. The car leaves the ground off
// the ramp and lands without crashing, the canvas shows the sand, the track and the car, and once
// the car stops and the camera has caught up the engine settles to 0 frames. Each brick's maths and
// zero allocation: tests/terrain.test.mjs, tests/drive.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { terrain, terrainView } from "./src/terrain.ts"; export { drive, chase } from "./src/drive.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

/** The course and the run, as page code (tests/terrain-drive.mjs and the brick's screenshots share it). */
export const SCENE = `
const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#f6e7cf" });
const t = fz.terrain({ cols: 96, rows: 64, cell: 0.5 });
t.noise({ seed: 20261113, amp: 2.2, scale: 9, octaves: 3, ridge: 0.7, wind: [1, 0.3], stretch: 2.5 });
// The loop: straights at z = ±8 from x = −13 to 13, half circles of radius 8 at each end (counter-clockwise from above).
const loop = [];
for (let i = 0; i <= 13; i++) loop.push(-13 + i * 2, 8);
for (let i = 1; i < 12; i++) { const a = Math.PI / 2 - (i / 12) * Math.PI; loop.push(13 + Math.cos(a) * 8, Math.sin(a) * 8); }
for (let i = 0; i <= 13; i++) loop.push(13 - i * 2, -8);
for (let i = 1; i < 12; i++) { const a = -Math.PI / 2 - (i / 12) * Math.PI; loop.push(-13 + Math.cos(a) * 8, Math.sin(a) * 8); }
loop.push(-13, 8);
t.ribbon(loop, { width: 3.6, edge: 2, kind: 1 });
t.ramp([-3, 8], [1, 8], { width: 3.6, height: 0.9, back: 0.8 });
t.whoops([6, -8], [-6, -8], { width: 3.6, height: 0.3, count: 5 });
t.berm(loop.slice(28, 52), { width: 3.6, height: 0.7, side: 1 });
const tv = fz.terrainView(d, t, { bands: [[0.7, "#e8c08a"], [1.5, "#dcaa70"], [99, "#cf975c"]], steepColor: "#bf8550", kinds: ["#9c7a55"], lod: [26] });
// The car: a group the model drives, a body and a cabin, four wheels that spin and ride their springs.
const v = fz.drive(t, { kind: "car" });
v.reset(-9, 8, 0);
const car = d.add({ id: "car", shape: "group", size: [1.9, 0.6, 1.1], tag: { car: 1 } });
d.add({ id: "body", size: [1.9, 0.4, 1.0], pos: [0, -0.05, 0], on: "car", color: "#e04a3a", layer: 5 });
d.add({ id: "cab", size: [0.9, 0.35, 0.85], pos: [-0.2, 0.35, 0], on: "car", color: "#2b3445", layer: 5 });
const hubs = [];
for (let i = 0; i < 4; i++) {
  const hub = d.add({ id: "hub" + i, shape: "group", size: [0.5, 0, 0.5], on: "car" });
  d.add({ id: "tyre" + i, shape: "cyl", sides: 10, size: [0.56, 0.24, 0.56], pos: [0, 0, -0.12], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: "#22262c", layer: 5 });
  hubs.push(hub);
}
const dust = d.points({ cap: 48, color: "#d8b88a" });
const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(4); // time, waypoint, max airtime, emit carry
T[1] = 3;
let phase = "drive", draws = 0;
const chaseOpts = { dist: 10, pitch: 0.5, rate: 3, turn: 2.2 };
Object.assign(d.cam, { yaw: -Math.PI / 2, pitch: 0.5, dist: 10, tx: -9, ty: 1, tz: 8 });
function pose() {
  car.pos.set(v.pos); car.rot.set(v.rot);
  for (let i = 0; i < 4; i++) {
    const h = hubs[i];
    h.pos[0] = v.wheels[i * 2]; h.pos[1] = -(v.rest - v.comp[i]); h.pos[2] = v.wheels[i * 2 + 1];
    h.rot[1] = i < 2 ? -v.steerAngle : 0; h.rot[2] = -v.spin[i];
  }
  tv.shadow(0, v.pos[0], v.pos[2], 1.15, Math.max(0, 0.32 - (v.pos[1] - t.height(v.pos[0], v.pos[2])) * 0.12));
}
e.add({
  step(_, dt) {
    T[0] += dt;
    if (phase === "drive") {
      // Steer for a point on the loop two waypoints ahead; a lap, then brake.
      let k = T[1] | 0;
      const px = loop[(k * 2) % loop.length], pz = loop[(k * 2 + 1) % loop.length];
      if (Math.hypot(px - v.pos[0], pz - v.pos[2]) < 3.2) T[1] = k + 1;
      const fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw), ux = px - v.pos[0], uz = pz - v.pos[2], ul = Math.hypot(ux, uz) || 1;
      const cross = (fx * uz - fz * ux) / ul;
      v.set(0.75, 0, Math.max(-1, Math.min(1, cross * 2.5)));
      if (T[1] >= loop.length / 2 - 4) phase = "stop";
    } else v.set(0, Math.abs(v.speed) > 0.3 ? 1 : 0, 0); // brake, and let go at a stop (held, it reverses)
    const moved = v.step(dt);
    if (v.air > 0) T[2] = Math.max(T[2], v.air);
    if (phase === "stop" && v.resting) phase = "rest";
    const cam = fz.chase(d.cam, v, chaseOpts, dt);
    // Dust: emit at the rear wheels by v.dust, then drift up and fade.
    T[3] += v.dust * 40 * dt;
    while (T[3] >= 1) {
      T[3] -= 1;
      const j = dust.n < dust.x.length ? dust.n++ : (T[0] * 997 | 0) % dust.x.length, w = 2 + ((T[0] * 60) & 1);
      dust.x[j] = v.wheel[w * 3]; dust.y[j] = v.wheel[w * 3 + 1] - 0.15; dust.z[j] = v.wheel[w * 3 + 2]; dust.r[j] = 0.18; dust.a[j] = 0.55;
    }
    let live = 0;
    for (let i = 0; i < dust.n; i++) if (dust.a[i] > 0) (dust.a[i] = Math.max(0, dust.a[i] - dt * 0.6)), (dust.r[i] += dt * 0.5), (dust.y[i] += dt * 0.4), live++;
    if (moved || cam || live || phase !== "rest") e.busy();
  },
  render: () => (pose(), d.draw(), draws++),
});
pose();
e.start();
window.st = () => ({ phase, way: T[1], air: T[2], crashed: v.crashed, resting: v.resting, speed: v.speed, draws, paused: e.paused.slice(), faces: tv.stats.faces, chunks: tv.stats.chunks, x: v.pos[0], z: v.pos[2], landing: Array.from(v.landing) });
window.eng = e; window.dio = d; window.car = v;
`;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="cv" style="display:block;width:640px;height:400px;margin:10px"></canvas><script>${bundle}</script><script>${SCENE}</script></body>`;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const browser = await chromium.launch(launchOptions());
  try {
    for (const dpr of [2, 1]) {
      const p = await browser.newPage({ viewport: { width: 680, height: 440 }, deviceScaleFactor: dpr });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(PAGE);
      // Mid-run, on the track: sand, track and car on screen.
      await p.waitForFunction(() => window.st().way >= 8, null, { timeout: 20000 });
      const mid = await p.evaluate(() => {
        const d = window.dio, v = window.car, out = new Float64Array(3), img = d.ctx.getImageData(0, 0, d.ctx.canvas.width, d.ctx.canvas.height).data, colours = new Set();
        for (let i = 0; i < img.length; i += 4 * 61) colours.add((img[i] >> 3 << 10) | (img[i + 1] >> 3 << 5) | (img[i + 2] >> 3));
        const m = d.get("body").M;
        d.project(m[9] + m[0] * 0.75 + m[1] * 0.4, m[10] + m[3] * 0.75 + m[4] * 0.4, m[11] + m[6] * 0.75 + m[7] * 0.4, out); // the bonnet's top, ahead of the cabin
        const px = Array.from(d.ctx.getImageData(Math.round(out[0] * d.dpr), Math.round(out[1] * d.dpr), 1, 1).data.slice(0, 3));
        return { colours: colours.size, body: px, size: [d.ctx.canvas.width, d.dpr], ...window.st() };
      });
      assert.deepEqual(mid.size, [640 * dpr, dpr], `backing store at ${dpr}×`);
      assert.ok(mid.colours >= 12, `shaded sand, track and car: ${mid.colours} colours`);
      assert.ok(mid.body[0] > 150 && mid.body[1] < 110 && mid.body[2] < 110, `the red body is on screen where the model puts it: ${mid.body}`);
      assert.ok(mid.faces > 400 && mid.chunks > 4, `terrain faces drawn: ${mid.faces} in ${mid.chunks} chunks`);
      // The lap, the stop, the settle.
      await p.waitForFunction(() => window.st().phase === "rest", null, { timeout: 40000 });
      const end = await p.evaluate(async () => {
        const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        for (let i = 0; i < 480 && !window.eng.paused.includes("settled"); i++) await frame();
        const s = window.st(), f0 = window.eng.stats().frames;
        for (let i = 0; i < 20; i++) await frame();
        const n = window.eng.stats().frames - f0;
        window.eng.destroy();
        return { ...s, frames: n };
      });
      assert.ok(end.air > 0.2, `airtime off the ramp: ${end.air.toFixed(2)} s`);
      assert.equal(end.crashed, false, `a clean landing (off the slope by ${end.landing[1].toFixed(2)} rad)`);
      assert.ok(end.resting && Math.abs(end.speed) < 0.05, `stopped: ${end.speed}`);
      assert.ok(end.paused.includes("settled"), `settled: ${end.paused}`);
      assert.equal(end.frames, 0, "settled: 0 frames");
      assert.deepEqual(errs, []);
      await p.close();
    }
    console.log("terrain + drive (Chromium): a desert loop drawn in chunks, a scripted car laps it under the chase camera, jumps the ramp and lands, stops, the engine settles ✓");
  } finally {
    await browser.close();
  }
}

export { PAGE };
