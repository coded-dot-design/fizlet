// @fzlt/core/pad's one-axis stick and key cluster on a 390 px phone (Chromium, real touches through
// CDP): `axis: "x"` gives an analog value proportional to the drag (dead zone and curve), ignores y,
// centres on the finger's landing point and springs back to 0; `setScheme(s, axis)` swaps it with the
// round stick and the move keys (no new listeners); `layout: "cluster"` puts the primary key in the
// corner and three keys on an arc, every key at least 44 px, none overlapping each other or the
// stick, in both hands and both themes. Default "xy" is unchanged (tests/browser.mjs covers it).
// PAD_AXIS_SHOTS=<dir> also saves screenshots and a short video.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { readFileSync, mkdirSync, renameSync } from "node:fs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { controls } from "./src/input.ts"; export { pad } from "./src/pad.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;
const CSS = readFileSync("src/ui/board-ui.css", "utf8");
const SHOTS = process.env.PAD_AXIS_SHOTS;
const ICON = (d) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;

const browser = await chromium.launch(launchOptions());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(SHOTS ? { recordVideo: { dir: SHOTS, size: { width: 390, height: 844 } } } : {}) });
const tp = await ctx.newPage();
const errs = [];
tp.on("pageerror", (e) => errs.push(e.message));
await tp.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0"><style>${CSS}.bui-pad{--u:.85px}</style>
<div class="bui" id="board" data-theme="dark" style="position:relative;width:390px;height:844px;background:var(--bg)"><p id="v" style="margin:0;padding:24px;font:900 28px ui-monospace,monospace;color:var(--ink)">0.00</p></div><script>${bundle}</script></body>`);
const cdp = await ctx.newCDPSession(tp);
// Chromium delivers touch moves aligned to frames: each touch waits for the next frame's events.
const touch = async (type, points) => {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
  await tp.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r))));
};
const box = (sel) => tp.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, sel);

const setup = await tp.evaluate(([icon]) => {
  const added = (window.added = []), orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) { added.push(type); return orig.call(this, type, fn, opt); };
  const board = document.getElementById("board");
  const e = (window.e = fizlet.createEngine({ root: board }));
  const c = (window.c = fizlet.controls(e, { keys: { left: ["KeyA"], right: ["KeyD"], go: ["KeyW"], stop: ["KeyS"], slide: ["ShiftLeft"], boost: ["Space"] } }));
  const v = document.getElementById("v");
  e.add({ render() { v.textContent = c.axis("left", "right", 0).toFixed(2); } });
  const p = (window.p = fizlet.pad(e, c, { axis: "x", dead: 0.08, curve: 1.3, layout: "cluster", move: ["", "", "left", "right"], actions: [
    { intent: "go", label: "", name: "Gas", icon: icon[0], role: "go", hold: true },
    { intent: "stop", label: "", name: "Brake", icon: icon[1], role: "attack", hold: true },
    { intent: "slide", label: "", name: "Drift", icon: icon[2], role: "fallin", hold: true },
    { intent: "boost", label: "", name: "Boost", icon: icon[3], role: "sys", hold: true },
  ] }));
  window.base = added.length;
  return { scheme: p.scheme, axis: p.axis, label: p.el.querySelector(".bui-stick").getAttribute("aria-label"), layout: p.el.dataset.layout };
}, [[ICON("M4 13l6-6 6 6"), ICON("M5 9h10v3H5z"), ICON("M4 14c4 0 4-8 12-8"), ICON("M11 2L5 11h4l-1 7 6-9h-4z")]]);
assert.deepEqual(setup, { scheme: "stick", axis: "x", label: "Move: drag left or right", layout: "cluster" });

// Layout: a wide pill, keys ≥ 44 px, primary in the corner, nothing overlapping.
const layout = async () => tp.evaluate(() => {
  const r = (n) => n.getBoundingClientRect(), s = r(p.el.querySelector(".bui-stick")), keys = [...p.el.querySelectorAll(".bui-pad-keys > button")].map(r);
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  // Round keys: circles (their boxes' corners may touch on the arc's diagonal).
  const round = (a, b) => Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2) < (a.width + b.width) / 2 + 4;
  let overlaps = 0;
  for (let i = 0; i < keys.length; i++) { if (hit(keys[i], s)) overlaps++; for (let j = i + 1; j < keys.length; j++) if (round(keys[i], keys[j])) overlaps++; }
  const pr = keys[0], corner = Math.max(...keys.map((k) => k.right)) === pr.right && Math.max(...keys.map((k) => k.bottom)) === pr.bottom;
  return { pill: s.width / s.height, minKey: Math.min(...keys.map((k) => Math.min(k.width, k.height))), primaryBiggest: keys.every((k) => k.width <= pr.width), corner, overlaps, inside: keys.every((k) => k.left >= 0 && k.right <= innerWidth && k.bottom <= innerHeight) };
});
const L = await layout();
assert.ok(L.pill > 2.4 && L.minKey >= 44 && L.primaryBiggest && L.corner && L.overlaps === 0 && L.inside, `cluster + pill layout at 390 px: ${JSON.stringify(L)}`);
if (SHOTS) mkdirSync(SHOTS, { recursive: true }), await tp.screenshot({ path: `${SHOTS}/pad-axis-390-dark.png` });

// A thumb lands right of centre (no jump: the landing point is centre), drags partway right.
const [sx, sy, sw, sh] = await box(".bui-stick"), throw_ = (sw - sh) / 2, land = sx + sw * 0.62, y = sy + sh / 2;
await touch("touchStart", [[land, y, 1]]);
const landed = await tp.evaluate(() => (e.advance(0), [c.stick.x, c.stick.active]));
assert.deepEqual(landed, [0, true], "landing anywhere on the track steers nothing yet");
const read = () => tp.evaluate(() => (e.advance(0), { x: c.stick.x, y: c.stick.y, axis: c.axis("left", "right", 0), knob: p.el.querySelector(".bui-knob").style.translate }));
const want = (f) => (Math.max(0, f - 0.08) / 0.92) ** 1.3;
for (let i = 1; i <= 6; i++) await touch("touchMove", [[land + throw_ * 0.08 * i, y - 25 * i, 1]]), SHOTS && (await tp.waitForTimeout(40));
const part = await read();
assert.ok(Math.abs(part.x - want(0.48)) < 0.02 && part.x > 0.2 && part.x < 0.7, `partway right is proportional, not full: ${part.x.toFixed(3)} (want ${want(0.48).toFixed(3)})`);
assert.equal(part.y, 0, "y is ignored in x mode (the finger moved 150 px up)");
assert.equal(part.axis, part.x, "axis() reads it");
assert.ok(Math.abs(parseFloat(part.knob) - throw_ * 0.48) < 0.2 && !/px \S/.test(part.knob.replace(/ 0px$/, "")), `knob follows along x only (${part.knob})`);
if (SHOTS) await tp.screenshot({ path: `${SHOTS}/pad-axis-390-dark-drag.png` });
await touch("touchMove", [[land + throw_ * 2, y, 1]]);
const full = await read();
assert.ok(full.x === 1 && full.knob.startsWith(throw_.toFixed(1)), `past the end: full, knob at the end of its throw (${full.x}, ${full.knob})`);
await touch("touchMove", [[land - throw_ * 0.05, y, 1]]);
assert.equal((await read()).x, 0, "back inside the dead zone: 0");
await touch("touchMove", [[land - throw_ * 0.5, y, 1]]);
assert.ok((await read()).x < -0.3, "left is negative");
// Hold GAS with a second thumb while steering, then let both go: springs back to 0.
const [gx, gy, gw, gh] = await box(".bui-primary");
await touch("touchStart", [[land - throw_ * 0.5, y, 1], [gx + gw / 2, gy + gh / 2, 2]]);
const both = await tp.evaluate(() => (e.advance(0), [c.down("go"), c.stick.x < 0]));
assert.deepEqual(both, [true, true], "GAS held while steering");
if (SHOTS) await tp.waitForTimeout(300);
await touch("touchEnd", [[land - throw_ * 0.5, y, 1], [gx + gw / 2, gy + gh / 2, 2]]);
const back = await read();
assert.deepEqual([back.x, back.y, back.knob, await tp.evaluate(() => c.stick.active || c.down("go"))], [0, 0, "", false], "release: 0, knob back to centre");
if (SHOTS) await tp.waitForTimeout(300);

// Swaps: x stick → move keys → round stick → x stick; no new listeners; y mode ignores x.
const swaps = await tp.evaluate(() => {
  p.setScheme("buttons");
  const keys = p.el.querySelectorAll(".bui-pad-move > button").length;
  p.setScheme("stick", "xy");
  const round = [p.axis, p.el.querySelector(".bui-stick").dataset.axis];
  p.setScheme("stick", "y");
  const y = p.el.querySelector(".bui-stick").getBoundingClientRect();
  p.setScheme("stick", "x");
  return { keys, round, tall: y.height > y.width * 2.4, axis: p.axis, added: window.added.length - window.base };
});
assert.deepEqual(swaps, { keys: 2, round: ["xy", "xy"], tall: true, axis: "x", added: 0 }, "setScheme swaps scheme and axes, adding no listeners");
await tp.evaluate(() => p.setScheme("stick", "y"));
const [yx, yy, yw, yh] = await box(".bui-stick");
await touch("touchStart", [[yx + yw / 2, yy + yh / 2, 3]]);
await touch("touchMove", [[yx + yw / 2 + 120, yy + yh / 2 + (yh - yw) / 4, 3]]);
const ym = await read();
await touch("touchEnd", [[yx + yw / 2 + 120, yy + yh / 2 + (yh - yw) / 4, 3]]);
assert.ok(ym.x === 0 && ym.y > 0.3 && ym.y < 0.7, `y mode: x ignored, y proportional (${ym.x}, ${ym.y})`);
await tp.evaluate(() => p.setScheme("stick", "x"));

// Light theme, and the left hand mirrors the cluster (still no overlaps).
await tp.evaluate(() => (document.getElementById("board").dataset.theme = "light"));
if (SHOTS) await tp.screenshot({ path: `${SHOTS}/pad-axis-390-light.png` }), await tp.waitForTimeout(300);
await tp.evaluate(() => (p.el.dataset.hand = "left"));
const LL = await tp.evaluate(() => {
  const keys = [...p.el.querySelectorAll(".bui-pad-keys > button")].map((n) => n.getBoundingClientRect()), pr = keys[0];
  return { corner: Math.min(...keys.map((k) => k.left)) === pr.left, inside: keys.every((k) => k.left >= 0) };
});
assert.deepEqual(LL, { corner: true, inside: true }, "left hand: primary in the bottom-left corner");
const L2 = await layout();
assert.equal(L2.overlaps, 0, "left hand: no overlaps");
if (SHOTS) await tp.screenshot({ path: `${SHOTS}/pad-axis-390-light-left.png` });

// Recall: destroy gives the board back.
const gone = await tp.evaluate(() => (e.destroy(), !document.querySelector(".bui-pad")));
assert.equal(gone, true);
assert.deepEqual(errs, []);
const video = SHOTS ? tp.video() : null;
await ctx.close();
if (video) renameSync(await video.path(), `${SHOTS}/pad-axis-390.webm`);
await browser.close();
console.log(`pad axis: x stick proportional (${part.x.toFixed(2)} at 48% throw), y ignored, springs back; swaps add no listeners; cluster at 390 px (min key ${L.minKey.toFixed(0)} px, 0 overlaps) passed.`);
