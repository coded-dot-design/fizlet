// @fzlt/core/drive's long-travel suspension in Chromium at 2× and 1×: a desert strip with a run of
// whoops, then a kicker with a sharp lip and a big drop to the flat, and a buggy on soft, progressive
// springs with more rebound than compression damping (travel 0.6, a heavy body), drawn with its wheels
// on swinging arms, under the chase camera from the side, on the kernel's fixed step. Through the
// whoops each wheel follows the ground on its own (front and rear out of step) and the body pitches;
// in the air the wheels drop to full droop; the landing pushes the springs deep, the body rebounds and
// settles back to its ride height without a crash; it brakes to rest and the engine settles to 0
// frames. The maths and zero allocation: tests/drive.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { terrain, terrainView } from "./src/terrain.ts"; export { drive, chase } from "./src/drive.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

/** The strip and the run, as page code. */
export const SCENE = `
const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#f6e3c6" });
const t = fz.terrain({ cols: 150, rows: 40, cell: 0.5 });
t.noise({ seed: 11, amp: 0.15, scale: 6 });
t.whoops([-26, 0], [-10, 0], { width: 5, height: 0.42, count: 7 });
t.ramp([-2, 0], [5, 0], { width: 5, height: 1.9, back: 0.6 });
const tv = fz.terrainView(d, t, { bands: [[0.3, "#ecc896"], [1, "#dfb27a"], [99, "#d09a60"]], steepColor: "#c48a52", lod: [36] });
const LONG = { wheels: [0.85, -0.8, 0.85, 0.8, -0.8, -0.8, -0.8, 0.8], radius: 0.42, rest: 0.66, travel: 0.6, stiffness: 70, progressive: 1.2,
  damping: 0.4, rebound: 0.85, inertia: 1.5, droop: 3, top: 15, accel: 10, airPitch: 3 };
const v = fz.drive(t, LONG);
v.reset(-34, 0, 0);
// The buggy: a low tub and a cage, and per wheel an arm from the tub to the hub, swinging as the spring works.
const car = d.add({ id: "car", shape: "group", size: [2, 0.6, 1.2] });
d.add({ id: "tub", size: [2.1, 0.3, 0.6], pos: [0, -0.02, 0], on: "car", color: "#ff5a36", layer: 5 });
d.add({ id: "cage", size: [1.0, 0.42, 0.58], pos: [-0.2, 0.36, 0], on: "car", color: "#2a2f3a", layer: 5 });
d.add({ id: "nose", size: [0.5, 0.16, 0.5], pos: [1.15, -0.06, 0], on: "car", color: "#ffd23a", layer: 5 });
const hubs = [], arms = [], MOUNT = 0.24, ARM = 0.56;
for (let i = 0; i < 4; i++) {
  const s = v.wheels[i * 2 + 1] < 0 ? -1 : 1;
  const arm = d.add({ id: "arm" + i, shape: "group", size: [0.1, 0, 0.1], pos: [v.wheels[i * 2], -0.08, s * MOUNT], on: "car" });
  d.add({ id: "armb" + i, size: [0.16, 0.08, ARM], pos: [0, 0, s * ARM / 2], on: "arm" + i, color: "#c3cbd8", layer: 5 });
  const hub = d.add({ id: "hub" + i, shape: "group", size: [0.6, 0, 0.6], on: "car" });
  d.add({ id: "tyre" + i, shape: "cyl", sides: 12, size: [0.84, 0.34, 0.84], pos: [0, 0, -0.17], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: "#202328", layer: 5 });
  hubs.push(hub); arms.push(arm);
}
const dust = d.points({ cap: 64, color: "#d9ba8c" });
const e = fz.createEngine({ settle: 0.3 }), T = new Float64Array(3); // time, time since landing, dust carry
const S = { phase: "whoops", out: 0, droop: 1, stroke: 0, landStroke: 0, landed: 0, rebound: 0, air: 0, pitch: 0, crashed: false, rideErr: 1 };
const chaseOpts = { dist: 10, pitch: 0.24, side: 1.3, lift: 0.4, rate: 3.5, turn: 3 };
Object.assign(d.cam, { yaw: -Math.PI / 2 + 1.3, pitch: 0.24, dist: 10, tx: -34, ty: 1, tz: 0 });
let ride = 0;
function pose() {
  car.pos.set(v.pos); car.rot.set(v.rot);
  for (let i = 0; i < 4; i++) {
    const h = hubs[i], s = v.wheels[i * 2 + 1] < 0 ? -1 : 1, y = -(v.rest - v.comp[i]);
    h.pos[0] = v.wheels[i * 2]; h.pos[1] = y; h.pos[2] = v.wheels[i * 2 + 1];
    h.rot[1] = i < 2 ? -v.steerAngle : 0; h.rot[2] = -v.spin[i];
    // The arm points from its mount down to the hub (a roll about the car's x axis).
    arms[i].rot[0] = s * Math.atan2(y + 0.08, Math.abs(v.wheels[i * 2 + 1]) - MOUNT);
  }
  tv.shadow(0, v.pos[0], v.pos[2], 1.3, Math.max(0, 0.34 - (v.pos[1] - t.height(v.pos[0], v.pos[2])) * 0.1));
}
e.add({
  step(_, dt) {
    T[0] += dt;
    const hold = Math.max(-1, Math.min(1, -v.pos[2] * 0.6 + v.yaw * 2)); // hold the line z = 0
    if (S.phase === "stop" || S.phase === "rest") v.set(0, Math.abs(v.speed) > 0.3 ? 1 : 0, 0);
    else v.set(S.phase === "whoops" ? 0.75 : 1, 0, hold);
    const moved = v.step(dt);
    if (v.pos[0] < -10 && v.pos[0] > -25) S.out = Math.max(S.out, Math.abs(v.press[0] - v.press[2])), S.pitch = Math.max(S.pitch, Math.abs(v.bodyPitch));
    if (S.phase === "whoops" && v.pos[0] > -8) S.phase = "jump";
    if (S.phase === "jump" && v.air > 0.3) S.droop = Math.min(S.droop, v.press[0], v.press[1], v.press[2], v.press[3]), (S.air = Math.max(S.air, v.air));
    if (S.phase === "jump" && S.air > 0.3 && v.air === 0) S.phase = "land", (S.landed = 1);
    if (S.phase === "land") {
      T[1] += dt;
      S.landStroke = Math.max(S.landStroke, v.stroke);
      if (T[1] > 0.1 && v.vel[1] > 0.3) S.rebound = 1;
      if (T[1] > 1.6) (S.phase = "stop"), (S.rideErr = Math.abs(v.comp[0] - ride) + Math.abs(v.comp[2] - ride));
    }
    S.stroke = Math.max(S.stroke, v.stroke); S.crashed = S.crashed || v.crashed;
    if (S.phase === "stop" && v.resting) S.phase = "rest";
    const cam = fz.chase(d.cam, v, chaseOpts, dt);
    T[2] += (v.dust + (S.phase === "land" && T[1] < 0.3 ? 1 : 0)) * 50 * dt;
    while (T[2] >= 1) {
      T[2] -= 1;
      const j = dust.n < dust.x.length ? dust.n++ : (T[0] * 997 | 0) % dust.x.length, w = (T[0] * 240) & 3;
      dust.x[j] = v.wheel[w * 3]; dust.y[j] = v.wheel[w * 3 + 1] - 0.2; dust.z[j] = v.wheel[w * 3 + 2]; dust.r[j] = 0.2; dust.a[j] = 0.55;
    }
    let live = 0;
    for (let i = 0; i < dust.n; i++) if (dust.a[i] > 0) (dust.a[i] = Math.max(0, dust.a[i] - dt * 0.7)), (dust.r[i] += dt * 0.6), (dust.y[i] += dt * 0.4), live++;
    if (moved || cam || live || S.phase !== "rest") e.busy();
  },
  render: () => (pose(), d.draw()),
});
ride = v.comp[0];
pose();
e.start();
window.st = () => ({ ...S, ride, x: v.pos[0], resting: v.resting, paused: e.paused.slice() });
window.eng = e; window.dio = d; window.car = v;
`;

export const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f6e3c6"><canvas id="cv" style="display:block;width:640px;height:400px;margin:10px"></canvas><script>${bundle}</script><script>${SCENE}</script></body>`;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const browser = await chromium.launch(launchOptions());
  const shots = process.env.SHOTS; // a directory: also save frames (whoops, air, landing, rest) and a video
  try {
    for (const dpr of [2, 1]) {
      const video = shots && dpr === 2 ? { dir: shots, size: { width: 660, height: 420 } } : undefined;
      const ctx = await browser.newContext({ viewport: { width: 660, height: 420 }, deviceScaleFactor: dpr, recordVideo: video });
      const p = await ctx.newPage();
      const errs = [];
      p.on("pageerror", (x) => errs.push(x.message));
      await p.setContent(PAGE);
      await p.waitForFunction(() => window.st().x > -17, null, { timeout: 20000 });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/susp-1-whoops.png` });
      await p.waitForFunction(() => window.car.air > 0.35, null, { timeout: 20000 });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/susp-2-air.png` });
      await p.waitForFunction(() => window.st().landed && window.car.stroke > 0.75, null, { timeout: 20000 });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/susp-3-landing.png` });
      await p.waitForFunction(() => window.st().phase === "rest", null, { timeout: 30000 });
      const end = await p.evaluate(async () => {
        const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        for (let i = 0; i < 900 && !window.eng.paused.includes("settled"); i++) await frame();
        const s = window.st(), f0 = window.eng.stats().frames;
        for (let i = 0; i < 20; i++) await frame();
        return { ...s, frames: window.eng.stats().frames - f0 };
      });
      if (shots && dpr === 2) await p.screenshot({ path: `${shots}/susp-4-rest.png` });
      await p.evaluate(() => window.eng.destroy());
      assert.ok(end.out > 0.3, `through the whoops each wheel works on its own: front and rear ${end.out.toFixed(2)} of the travel apart`);
      assert.ok(end.pitch > 0.03, `and the body pitches on the springs: ${end.pitch.toFixed(3)} rad`);
      assert.ok(end.air > 0.4, `off the lip: ${end.air.toFixed(2)} s in the air`);
      assert.ok(end.droop < 0.05, `in the air the wheels hang at full droop: press ${end.droop.toFixed(3)}`);
      assert.ok(end.landStroke > 0.75, `the landing pushes the springs deep: stroke ${end.landStroke.toFixed(2)}`);
      assert.ok(end.rebound === 1, "then the body rebounds");
      assert.equal(end.crashed, false, "no crash: the springs took it");
      assert.ok(end.rideErr < 0.03, `settled back at its ride height: ${end.rideErr.toFixed(3)} off`);
      assert.ok(end.resting && end.paused.includes("settled"), `at rest, settled: ${end.paused}`);
      assert.equal(end.frames, 0, "settled: 0 frames");
      assert.deepEqual(errs, []);
      await ctx.close();
    }
    console.log("drive suspension (Chromium): wheels work on their own through the whoops, droop in the air, soak up the big drop, rebound and settle; the engine settles ✓");
  } finally {
    await browser.close();
  }
}
