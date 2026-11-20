// @fzlt/core/backdrop in Node (recording canvases): fit covers the frame and keeps the safe box whole
// (Holeshot's garage fit, number for number), shapes that touch the art's left, right or bottom edge run
// on past it, pack and unpack round-trip, layers paint once per size (a resize, a dpr change or
// repaint() paints again), the pan slides each layer by its depth (clamped), and drawing every frame
// allocates nothing. Real pixels in Chromium: tests/backdrop.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { fit, fill, band, pack, unpack, backdrop } = await import("../src/backdrop.ts");

const ART = { w: 1200, h: 840, safe: [45, 80, 1155, 800] };
/** Holeshot's garage fit (src/garage/backdrop.ts fitOf), the reference. */
const fitOf = (w, h) => {
  const s = Math.min(Math.max(w / 1200, h / 840), w / 1110, h / 720);
  return [s, (w - 1200 * s) / 2, Math.min(h - 800 * s, Math.max(-80 * s, (h - 840 * s) / 2))];
};

test("fit: cover the frame, keep the safe box whole (Holeshot's garage fit)", () => {
  const out = new Float64Array(3);
  for (const [w, h] of [[1200, 840], [390, 844], [1440, 900], [800, 300], [2000, 600], [320, 1200]]) {
    fit(w, h, ART, out);
    const ref = fitOf(w, h);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i] - ref[i]) < 1e-9, `${w}×${h} [${i}]: ${out[i]} vs ${ref[i]}`);
    const [s, dx, dy] = out;
    assert.ok(45 * s + dx >= -1e-9 && 1155 * s + dx <= w + 1e-9 && 80 * s + dy >= -1e-9 && 800 * s + dy <= h + 1e-9, `${w}×${h}: the safe box shows whole`);
  }
  // No safe box: plain cover, centred.
  fit(100, 50, { w: 100, h: 100 }, out);
  assert.deepEqual(Array.from(out), [1, 0, -25]);
});

/** A context that records lineTo points and fills. */
const rec = () => ({ pts: [], fills: [], rects: [], fillStyle: "", beginPath() { this.pts = []; }, lineTo(x, y) { this.pts.push([x, y]); }, fill() { this.fills.push({ style: this.fillStyle, pts: this.pts }); }, fillRect(x, y, w, h) { this.rects.push([this.fillStyle, x, y, w, h]); } });

test("fill and band: shapes on the art's left, right or bottom edge run on past it", () => {
  const c = rec(), art = { w: 100, h: 80 };
  // A hill from the left edge to the right edge, down to the bottom: its sides and bottom run on.
  fill(c, art, "#123456", [0, 40, 50, 20, 99, 40, 99, 79, 0, 79]);
  const P = c.fills[0].pts, xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  assert.equal(c.fills[0].style, "#123456");
  assert.ok(Math.min(...xs) <= -4000 && Math.max(...xs) >= 4100 && Math.max(...ys) >= 4080, "on past left, right and bottom");
  assert.ok(Math.min(...ys) === 20, "the top stays where it is drawn");
  // A shape inside the art is drawn as given.
  fill(c, art, "#000000", [10, 10, 20, 10, 20, 20]);
  assert.deepEqual(c.fills[1].pts, [[10, 10], [20, 10], [20, 20]]);
  band(c, art, "#ffffff", 30, 35);
  assert.deepEqual(c.rects[0], ["#ffffff", -4000, 30, 8100, 5]);
});

test("pack and unpack round-trip traced polygons", () => {
  const shapes = [[0, [0, 0, 1199, 0, 1199, 839]], [5, [12, 4095, 600, 300, 7, 7]]];
  const s = pack(shapes);
  assert.equal(s.split(" ").length, 2);
  assert.deepEqual(unpack(s), shapes);
  assert.deepEqual(unpack(""), []);
});

/** A fake canvas: counts its context's calls. */
const canvas = (log) => {
  const ctx = { setTransform: (...a) => log.push(["setTransform", ...a]), fillRect() {}, beginPath() {}, lineTo() {}, fill() {}, fillStyle: "" };
  return { width: 0, height: 0, getContext: () => ctx };
};

test("backdrop: layers paint once per size; the pan slides each by its depth", () => {
  const log = [], painted = [], blits = [];
  const layers = [{ paint: () => painted.push("sky") }, { paint: () => painted.push("hills"), depth: 0.5 }, { paint: () => painted.push("near"), depth: 1 }];
  const bd = backdrop(ART, layers, { pan: 40, canvas: () => canvas(log) });
  const ctx = { drawImage: (cv, x, y, w, h) => blits.push([x, y, w, h]) };
  bd.draw(ctx, 600, 400, 2, 0);
  bd.draw(ctx, 600, 400, 2, 10);
  assert.deepEqual(painted, ["sky", "hills", "near"], "painted once for 600×400 @2");
  assert.equal(bd.stats.paints, 3);
  // Blits: x = −reach + pan × depth, width = w + 2 × reach (reach = pan max × depth).
  assert.deepEqual(blits.slice(3), [[0, 0, 600, 400], [-15, 0, 640, 400], [-30, 0, 680, 400]]);
  // The layer canvases: wider by the reach, at dpr, and their transform puts the fit's offset past it.
  const F = bd.fit;
  assert.deepEqual(log.filter((l) => l[0] === "setTransform")[2], ["setTransform", 2 * F[0], 0, 0, 2 * F[0], 2 * (F[1] + 40), 2 * F[2]]);
  // Clamped pan; a resize and a dpr change repaint; repaint() too.
  blits.length = 0;
  bd.draw(ctx, 600, 400, 2, 999);
  assert.deepEqual(blits[2], [0, 0, 680, 400]);
  bd.draw(ctx, 700, 400, 2);
  bd.draw(ctx, 700, 400, 1);
  bd.repaint();
  bd.draw(ctx, 700, 400, 1);
  assert.equal(bd.stats.paints, 12);
});

test("backdrop: drawing every frame allocates nothing (1M frames)", async (t) => {
  const bd = backdrop(ART, [{ paint() {} }, { paint() {}, depth: 0.4 }], { pan: 30, canvas: () => canvas([]) });
  let n = 0;
  const ctx = { drawImage() { n++; } };
  let f = 0;
  const frames = (k, on) => { for (let i = 0; i < k; i++, f++) if (on) bd.draw(ctx, 640, 360, 2, Math.sin(f * 0.01) * 30); };
  frames(2000, true);
  const bare = await minorGCs(() => frames(1000000, false)), drawn = await minorGCs(() => frames(1000000, true));
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, drawn ${drawn}`);
  assert.ok(drawn <= bare, `drawing allocates: ${drawn} young GCs (bare ${bare})`);
  assert.equal(bd.stats.paints, 2, "painted once");
  assert.ok(n > 0);
});
