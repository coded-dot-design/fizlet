// The origin scene's shapes as plain numbers and path data: the palette, his pose (head, neck, two-bone
// arms), the laptop lid and screen, the cap, the code lines, his back and the chair. No markup and no
// CSS here, so a piece that draws the desk its own way (a canvas: the gallery's "Day 1 → Day 30")
// takes only these; art.ts builds the SVG from them.
export const C = { teal: "#65b9ad", tealD: "#4f9e93", tealL: "#8fd0c5", ink: "#43353d", inkL: "#5d4c56", cream: "#f3eed5", creamD: "#e2dbbf", red: "#e15e49", redD: "#b9432f", skin: "#e8b48f", skinD: "#d39a74", sun: "#f8d78b", code: "#2e2a3a" };
/** Shoulders, upper arm (seen from above it hangs down a little, foreshortened) and forearm lengths. */
export const SH = { lx: 314, rx: 486, y: 474, ua: 66, fa: 116 } as const;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const r1 = (v: number) => Math.round(v * 10) / 10;
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Head centre and tilt for a pose. Asleep, the head is forward on his folded arms, tipped. */
export function head(aw: number, sip: number) {
  return { x: 400, y: mix(406, 434, aw) - sip * 6, a: mix(-12, 0, aw) };
}
/** The upper back and neck: the shirt from the shoulders up under the head, so head and body read
 *  as one at every pose (asleep the head leans forward onto the arms; the back follows it). */
export function neck(aw: number, sip: number) {
  const h = head(aw, sip), top = h.y + 8;
  return { cx: 400, cy: r1((top + 466) / 2), ry: r1((466 - top) / 2 + 6) };
}
/** The hands' home on the keys (centres) and the key under each one's fingers (tips): typing moves
 *  a hand part of the way from its home toward the key it hits. */
export const KEYS_HOME = [342, 314, 458, 314] as const, TIPS_HOME = [342, 294, 458, 294] as const;
/** Hand targets: asleep folded under the head; awake on the keys (hd, at `k`: lx, ly, rx, ry) or
 *  resting by the laptop. */
export function hands(aw: number, hd: number, k: ArrayLike<number> = KEYS_HOME) {
  return { lx: mix(mix(434, 352, aw), k[0]!, hd), ly: mix(mix(400, 404, aw), k[1]!, hd), rx: mix(mix(368, 452, aw), k[2]!, hd), ry: mix(mix(408, 404, aw), k[3]!, hd) };
}
/** One arm, two bones: shoulder → elbow → hand. The elbow bends outward; a hand out of reach stops
 *  at full stretch. `s` -1 left, 1 right. Out: elbow (ex, ey), hand (hx, hy), forearm angle (deg). */
export function arm(s: number, tx: number, ty: number) {
  const sx = s < 0 ? SH.lx : SH.rx, A = SH.ua, B = SH.fa;
  let dx = tx - sx, dy = ty - SH.y, d = Math.hypot(dx, dy) || 1;
  const dd = Math.min(Math.max(d, B - A + 1), A + B - 0.5);
  const th = Math.atan2(dy, dx), a = Math.acos((A * A + dd * dd - B * B) / (2 * A * dd)), e = th + (s < 0 ? -a : a);
  const ex = sx + Math.cos(e) * A, ey = SH.y + Math.sin(e) * A, hx = sx + (dx / d) * dd, hy = SH.y + (dy / d) * dd;
  return { sx, ex: r1(ex), ey: r1(ey), hx: r1(hx), hy: r1(hy), deg: r1((Math.atan2(hy - ey, hx - ex) * 180) / Math.PI) };
}
/** A limb segment seen from above: two circles (radii r1, r2) and the hull between them, as a path. */
export const limb = (x1: number, y1: number, a: number, x2: number, y2: number, b: number) => {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1, nx = ((y1 - y2) / d), ny = ((x2 - x1) / d);
  return `M${r1(x1 + nx * a)} ${r1(y1 + ny * a)}L${r1(x2 + nx * b)} ${r1(y2 + ny * b)}A${b} ${b} 0 1 0 ${r1(x2 - nx * b)} ${r1(y2 - ny * b)}L${r1(x1 - nx * a)} ${r1(y1 - ny * a)}A${a} ${a} 0 1 0 ${r1(x1 + nx * a)} ${r1(y1 + ny * a)}Z`;
};
/** One arm's shapes for a pose: the sleeve over the deltoid, the upper arm (the biceps swell, then
 *  the elbow), the forearm (the muscle near the elbow, tapering to the wrist), and where the hand goes. */
export function armD(s: number, tx: number, ty: number) {
  const k = arm(s, tx, ty), sy = SH.y, at = (t: number, ax: number, ay: number, bx: number, by: number) => [ax + (bx - ax) * t, ay + (by - ay) * t] as const;
  const b = at(0.55, k.sx, sy, k.ex, k.ey), f = at(0.32, k.ex, k.ey, k.hx, k.hy), w = at(0.8, k.ex, k.ey, k.hx, k.hy), h = at(0.5, k.sx, sy, k.ex, k.ey);
  return {
    k,
    skin: limb(b[0], b[1], 20, k.ex, k.ey, 14) + limb(k.ex, k.ey, 14, f[0], f[1], 16.5) + limb(f[0], f[1], 16.5, w[0], w[1], 10.5),
    sleeve: limb(k.sx, sy, 24, h[0], h[1], 20),
    hem: `M${r1(h[0] + ((sy - k.ey) / SH.ua) * 19)} ${r1(h[1] + ((k.ex - k.sx) / SH.ua) * 19)}L${r1(h[0] - ((sy - k.ey) / SH.ua) * 19)} ${r1(h[1] - ((k.ex - k.sx) / SH.ua) * 19)}`,
  };
}
/** Coffee (code) or matcha (design), hot (h = 1) to cooled (h = 0). `fz`: the Fizlet look's pair of
 *  tokens instead (hot, cooled) as [r, g, b]. */
export function brew(design: boolean, h: number, fz?: readonly (readonly number[])[]) {
  const a = fz ? fz[0]! : design ? [47, 125, 109] : [70, 40, 30], b = fz ? fz[1]! : design ? [150, 205, 185] : [182, 134, 100];
  return `rgb(${Math.round(mix(b[0]!, a[0]!, h))},${Math.round(mix(b[1]!, a[1]!, h))},${Math.round(mix(b[2]!, a[2]!, h))})`;
}
/** The laptop lid: above 0.5 the screen unfolds up from the hinge; below, the lid covers the keys.
 *  Open, seen from above and behind him, the lid is as wide as the base at the hinge, and its far edge
 *  (tilted back, up toward the eye) a little wider; it is foreshortened to about two thirds of the
 *  base's depth (LID: its far edge's y). */
export const LID = 160;
export const LIDP = `M286 250H514L519 ${LID + 7}Q520 ${LID} 513 ${LID}H287Q280 ${LID} 281 ${LID + 7}Z`;
// The display inside the bezel, and the map from the screens' drawing box (304, 140, 192 x 100) onto it.
export const SCR = `M298 241H502L507 ${LID + 9}H293Z`, SCRT = `translate(300 ${LID + 9}) scale(1.0417 .72) translate(-304 -140)`;
/** The cap from above (its own frame, the head's centre): the foam panel, the seams, the bill and its edge. */
export const CAP = { foam: "M0-2L-36 18A41 41 0 0 0 36 18Z", seam: "M0-2L-40-11M0-2L40-11M0-2L-15-40M0-2L15-40", bill: "M-36 18C-46 46-24 60 0 60S46 46 36 18A41 41 0 0 1-36 18Z", edge: "M-36 18C-46 46-24 60 0 60S46 46 36 18" } as const;
// Code: two identical pages of lines (scrolled as one strip, wrapping), in 2015's syntax colours.
export const CODE = [[0, 40, 1], [12, 60, 2], [12, 30, 0], [24, 52, 3], [24, 70, 1], [12, 22, 0], [0, 14, 2], [0, 0, 0], [0, 48, 1], [12, 34, 3], [24, 64, 2], [24, 40, 0], [36, 30, 1], [24, 18, 0], [12, 26, 3], [0, 14, 2]];
// His back from above: the trapezius sloping from the neck to the shoulders, broad shoulders, the
// lats tapering toward the waist (out of frame).
export const TORSO = "M376 452C354 455 332 458 314 466C296 474 286 490 288 512L304 640H496L512 512C514 490 504 474 486 466C468 458 446 455 424 452Z";
// The chair under him (the back's top edge and its two arm ends at the bottom): his shirt is cut
// where the chair shows, so it reads as one layer under him with only its dark edge in sight.
export const CHAIR = "M330 492Q400 478 470 492Q482 495 482 506V650H318V506Q318 495 330 492ZM297 548h2a9 9 0 0 1 9 9v82a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-82a9 9 0 0 1 9-9ZM501 548h2a9 9 0 0 1 9 9v82a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-82a9 9 0 0 1 9-9Z";
