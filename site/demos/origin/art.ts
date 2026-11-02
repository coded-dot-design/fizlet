/**
 * The origin scene's art: one SVG, seen from above, in two looks on the same shapes.
 * - "2015": the flat 2015 portfolio palette (teal desk, ink, cream, the red accents). Its colours are
 *   the shapes' own fill and stroke attributes.
 * - "fizlet" (the default): cyberpunk × Tron, flat colours. `.og--fz` on the wrapper repaints the
 *   same shapes from the site's Board UI tokens (--k-sys, --k-cmd, --k-attack, --k-go, --k-advance,
 *   --hurt, --k-flag on the --rim night; the fallbacks are the dark theme's values), and shows the
 *   few shapes only it has: the desk grid, the neon edge lines and the pixel patterns. The stage stays
 *   night in both themes, like the home hero's stage and the placeholder poster.
 * A desk under a window: the lamp, a sketchbook, the coffee (Chris's 2015 cup sheet, coffee.png, in
 * the 2015 look; a neon cup in the Fizlet look), the laptop, the phone, the headphones, and him: a
 * backwards trucker cap, headphones over it, arms that bend at the elbow. Pure strings and numbers:
 * the scene builds it once at mount; the build renders the same markup as the poster.
 * Pose numbers (0..1): aw awake (head up), ph headphones on, lid laptop open, hd hands on the keys,
 * sip the cup at his mouth. Every moving part is placed by the functions below, so the poster and the
 * scene put it in the same spot.
 */
export const C = { teal: "#65b9ad", tealD: "#4f9e93", tealL: "#8fd0c5", ink: "#43353d", inkL: "#5d4c56", cream: "#f3eed5", creamD: "#e2dbbf", red: "#e15e49", redD: "#b9432f", skin: "#e8b48f", skinD: "#d39a74", sun: "#f8d78b", code: "#2e2a3a" };

export type OriginLook = "2015" | "fizlet";

// The Fizlet look's paint: Board UI tokens (the site sets them; the fallbacks are their values).
const FZ = `.og--fz{--r:var(--rim,#07060f);--s:var(--k-sys,#19f0ff);--m:var(--k-cmd,#9a63ff);--g:var(--k-go,#39ffb0);--a:var(--k-attack,#ff2e88);--v:var(--k-advance,#ff8a1f);--y:var(--hurt,#ffc21a);--w:var(--k-flag,#f6f3ff);--d:color-mix(in srgb,var(--m) 22%,var(--r));--fc:color-mix(in srgb,var(--m) 14%,#0b0918);--b:color-mix(in srgb,var(--s) 22%,var(--r));--p:color-mix(in srgb,var(--s) 45%,var(--r));background:var(--r)}
.og-fz{display:none}.og--fz .og-fz{display:inline}.og--fz .og-15{display:none}
.og--fz .o-sky{fill:color-mix(in srgb,var(--m) calc((.62 - var(--night)) * 40%),var(--r))}.og--fz .o-star{fill:var(--w)}.og--fz .og-sun{fill:var(--y)}
.og--fz .o-city{fill:var(--r);stroke:var(--m);stroke-width:2;opacity:1}.og--fz .o-lit{fill:var(--s)}.og--fz .o-frame{fill:var(--fc);stroke:var(--m);stroke-width:2}
.og--fz .o-desk{fill:var(--d)}.og--fz .o-sh{fill:var(--r);opacity:.9;transform:translate(calc(7px * var(--shadow-x, 0) - 4px),calc(7px * var(--shadow-y, 1) - 4px))}.og--fz .o-csh{fill:var(--r);opacity:.9}.og--fz .o-beam{fill:var(--s)}
.og--fz .o-face{fill:var(--fc);stroke:var(--s);stroke-width:2}.og--fz .o-faceD{fill:var(--b)}.og--fz .o-rule{stroke:var(--m)}
.og--fz .o-red{fill:var(--a)}.og--fz .o-redS{stroke:var(--a)}.og--fz .o-ink{fill:var(--r)}.og--fz .o-scr{fill:#0b0918}.og--fz .o-teal{fill:var(--s)}.og--fz .o-tealD{fill:var(--g)}.og--fz .o-sun{fill:var(--y)}.og--fz .o-cream{fill:var(--r)}
.og--fz .o-i0{fill:var(--s)}.og--fz .o-i1{fill:var(--a)}.og--fz .o-i2{fill:var(--w)}.og--fz .o-i3{fill:var(--y)}
.og--fz .o-l1{fill:var(--g)}.og--fz .o-l2{fill:color-mix(in srgb,var(--g) 60%,var(--r))}.og--fz .o-l3{fill:var(--k-fallin,#a8ff3e)}
.og--fz .o-shirt{fill:var(--m)}.og--fz line.o-shirt{stroke:var(--m)}.og--fz .o-shirtD{stroke:color-mix(in srgb,var(--m) 55%,var(--r))}
.og--fz .o-mesh{fill:var(--r)}.og--fz .o-dot{fill:var(--s)}.og--fz .o-foam{fill:var(--a)}.og--fz .o-bill{fill:color-mix(in srgb,var(--a) 45%,var(--r))}.og--fz .o-billE{stroke:var(--w)}.og--fz .o-btn{fill:var(--s)}.og--fz .o-seam{stroke:color-mix(in srgb,var(--a) 45%,var(--r))}.og--fz .o-strap{stroke:var(--s)}
.og--fz .o-band{stroke:var(--r)}.og--fz .o-band2{stroke:var(--s)}.og--fz .o-hcup{fill:var(--r);stroke:var(--s);stroke-width:2}.og--fz .o-pad{fill:var(--a)}.og--fz .o-cord{stroke:var(--a)}
.og--fz .o-lid{fill:var(--r);stroke:var(--s);stroke-width:2.5}.og--fz .o-glow{stroke:var(--s);opacity:.22}.og--fz .o-neon{stroke:var(--s)}.og--fz .o-grid{stroke:color-mix(in srgb,var(--s) 13%,transparent)}
.og--fz .o-pix{fill:var(--v)}.og--fz .o-pud{fill:color-mix(in srgb,var(--v) 30%,var(--r));stroke:var(--v);stroke-width:2}.og--fz .o-pot{fill:var(--fc);stroke:var(--s);stroke-width:2}.og--fz .o-brew{fill:var(--v)}.og--fz .o-pour{stroke:var(--v)}
.og--fz .og-night{fill:var(--r);opacity:calc(var(--night) * .75)}.og--fz .og-liquid{fill:var(--lq,var(--v))}
.og--fz .og-tag rect{fill:var(--r);stroke:var(--s)}.og--fz .og-tag text{fill:var(--w)}.og--fz .og-tag text+text{fill:var(--s)}
.og--fz .og-why{background:color-mix(in srgb,var(--r) 86%,transparent);border:2px solid var(--m);border-radius:6px;box-shadow:calc(4px * var(--shadow-x, 0)) calc(4px * var(--shadow-y, 1)) 0 color-mix(in srgb,var(--m) 50%,var(--r));color:var(--w)}.og--fz .og-why b{color:var(--s)}
.og--fz .og-bar button{background:var(--fc);color:var(--w);border:2px solid color-mix(in srgb,var(--m) 60%,var(--r));border-radius:6px;box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 var(--r);text-transform:uppercase;font-weight:700;letter-spacing:.06em}
.og--fz .og-bar button:hover{border-color:var(--s)}.og--fz .og-bar button:active{transform:translate(calc(3px * var(--shadow-x, 0)),calc(3px * var(--shadow-y, 1)));box-shadow:0 0 0 var(--r)}
.og--fz .og-bar button[aria-pressed=true]:not([data-k=look]){background:var(--s);color:var(--r);border-color:var(--r);transform:translate(calc(3px * var(--shadow-x, 0)),calc(3px * var(--shadow-y, 1)));box-shadow:0 0 14px color-mix(in srgb,var(--s) 45%,transparent)}
.og--fz [data-k=look] span+span{background:var(--s);color:var(--r)}.og--fz .og-grip:hover{box-shadow:0 0 0 2px var(--s),0 0 14px color-mix(in srgb,var(--s) 45%,transparent)}
.og--fz .og-body:focus-visible .o-mesh,.og--fz .og-laptop:focus-visible>.o-face{stroke:var(--s);stroke-width:4}
@media (hover:hover){.og--fz .og-l [data-p]:is([data-p=laptop],[data-p=phone],[data-p=phones],[data-p=person]):hover{filter:drop-shadow(0 0 5px var(--s))}}`;

/** The scene's styles (the poster carries them too). Lighting is custom properties on .og. */
export const CSS = `.og{position:absolute;inset:0;overflow:hidden;background:${C.teal};--sky:rgb(29,27,52);--night:.62;--lamp:0;--sun:0;--beam:0;--glow:0;font:600 10.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-tap-highlight-color:transparent;user-select:none}
.og-l{position:absolute;inset:0}.og-svg,.og canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.og canvas{pointer-events:none;filter:brightness(calc(1 - var(--night) * .8))}
.og-night{opacity:var(--night);mix-blend-mode:multiply;pointer-events:none}
.og-lampg{opacity:var(--lamp);mix-blend-mode:screen;pointer-events:none}
.og-scrg{opacity:calc(var(--night) * var(--glow) * 1.3);mix-blend-mode:screen;pointer-events:none}
.og-scrl{opacity:calc(var(--night) * var(--glow) * .3);mix-blend-mode:screen;pointer-events:none}
.og-beam{opacity:calc(var(--beam) * .2);transform:translateX(calc((.5 - var(--sun)) * 240px));pointer-events:none}
.og-sun{transform:translate(calc(40px + var(--sun) * 720px),calc(74px - sin(var(--sun) * 180deg) * 54px))}
.og-stars,.og-lit,.og-moon{opacity:calc(var(--night) * 1.6)}.og-sun{opacity:calc(1 - var(--night) * 1.6)}
.og-bulb{opacity:calc(.35 + var(--lamp) * .65)}
.og-tag{opacity:0;transition:opacity .2s;pointer-events:none}.og-tag text{font:inherit}
.og--tags .og-tag${["laptop", "phone", "cup", "phones", "lamp", "sky", "person"].map((p) => `,.og:has([data-p=${p}]:hover) [data-t=${p}]`).join("")}{opacity:1}
[data-p=laptop],[data-p=phone],[data-p=cup],[data-p=phones],[data-p=person]{cursor:pointer}.og-body{outline:none}.og-body:focus-visible .o-mesh{stroke:#2f80ed;stroke-width:4}
.og-laptop{outline:none}.og-laptop:focus-visible>rect:nth-child(2){stroke:#2f80ed;stroke-width:4}
@media (hover:hover){.og-l [data-p]:is([data-p=laptop],[data-p=phone],[data-p=phones],[data-p=person]):hover{filter:drop-shadow(0 0 4px ${C.cream})}}
.og-grip{position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;cursor:grab;touch-action:none;outline:none;z-index:1}.og-grip:active{cursor:grabbing}.og-grip:hover{box-shadow:0 0 0 2px ${C.cream}}.og-grip:focus-visible{box-shadow:0 0 0 3px #2f80ed}
.og--reduce .og-night,.og--reduce .og-lampg,.og--reduce .og-scrg{transition:opacity 1.6s}
.og-bar{position:absolute;right:10px;bottom:10px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px 6px;z-index:2}
.og-bar button{all:unset;position:relative;box-sizing:border-box;min-height:32px;display:inline-flex;align-items:center;font:inherit;font-size:11px;letter-spacing:.03em;padding:7px 11px;border-radius:999px;border:1.5px solid ${C.ink};background:${C.cream};color:${C.ink};cursor:pointer;touch-action:manipulation}
.og-bar button::before{content:"";position:absolute;inset:-6px -3px}
.og-bar button[aria-pressed=true]:not([data-k=look]){background:${C.ink};color:${C.cream}}.og-bar button:active{transform:scale(.94)}
.og-bar button:focus-visible{outline:2px solid #2f80ed;outline-offset:2px}.og-bar button:hover{border-color:${C.red}}
.og-bar [data-k=look]{padding:0;overflow:hidden}.og-bar [data-k=look] span{padding:7px 9px;align-self:stretch;display:flex;align-items:center}.og-bar [data-k=look] span:first-child{background:${C.ink};color:${C.cream}}.og--fz .og-bar [data-k=look] span:first-child{background:none;color:inherit}
.og-why{position:absolute;left:12px;top:10px;z-index:2;margin:0;max-width:min(64%,460px);padding:7px 11px;border-radius:8px;background:rgba(29,27,52,.72);color:${C.cream};font:500 12px/1.45 ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em;transition:opacity .5s}
.og-why b{color:${C.sun};font-weight:700;margin-right:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.08em}
.og-credit{display:block;margin-top:3px;font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.72}
.og-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:520px){.og-bar button{font-size:10px;padding:6px 8px}.og-bar [data-k=look] span{padding:6px 7px}.og-lg{display:none}.og-why{font-size:11px;max-width:calc(100% - 24px)}}
${FZ}
@media (max-width:520px){.og .og-bar{left:8px;right:8px;bottom:8px;gap:4px;justify-content:space-between;flex-wrap:nowrap}.og .og-bar button{font-size:9.5px;padding:6px;letter-spacing:.02em}.og .og-bar [data-k=look] span{padding:6px 5px}}`;

/** The "why" caption: real text. The whole line for screen readers (and as the still); `beat`
 *  (one sentence) is what shows while the day plays; `credit` says what the scene is after. */
export const why = (full: string, beat: string, step: string, credit = "") =>
  `<p class="og-why"><span class="og-vh">${full}</span><span aria-hidden="true"><b>${step}</b><span class="og-beat">${beat}</span></span>${credit ? `<small class="og-credit">${credit}</small>` : ""}</p>`;

/** The viewBox the art is drawn in; the scene crops it to the stage's shape around the middle. */
export const VB = { w: 800, h: 500 };
/** The parts a tap or a label points at: x, y, w, h in art units. */
export const BOX = {
  laptop: [286, 124, 228, 262],
  phone: [566, 236, 82, 140],
  cup: [196, 268, 78, 78],
  phones: [540, 120, 130, 90],
  lamp: [50, 120, 110, 110],
  sky: [0, -200, 800, 296],
  person: [300, 340, 200, 260],
} as const;
/** Where the cup can stand: the desk, inside the window's sill (x0, y0, x1, y1, cup centres). */
export const DESK = [44, 140, 756, 470] as const;
/** The cup's home (its top left on the saucer) and where it sits when he drinks. */
export const CUP = { x: 196, y: 268, mx: 345, my: 352, r: 39 } as const;

/** Shoulders, upper arm (seen from above it hangs down, so it is short) and forearm lengths. */
export const SH = { lx: 310, rx: 490, y: 478, ua: 52, fa: 108 } as const;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (v: number) => Math.round(v * 10) / 10;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Head centre and tilt for a pose. Asleep, the head is forward on his folded arms, tipped. */
export function head(aw: number, sip: number) {
  return { x: 400, y: mix(406, 434, aw) - sip * 6, a: mix(-12, 0, aw) };
}
export const headT = (aw: number, sip: number, bob = 0) => {
  const h = head(aw, sip);
  return `translate(${r1(h.x)} ${r1(h.y + bob)}) rotate(${r1(h.a)})`;
};
/** The upper back and neck: the shirt from the shoulders up under the head, so head and body read
 *  as one at every pose (asleep the head leans forward onto the arms; the back follows it). */
export function neck(aw: number, sip: number) {
  const h = head(aw, sip), top = h.y + 8;
  return { cx: 400, cy: r1((top + 480) / 2), ry: r1((480 - top) / 2 + 12) };
}
/** Hand targets: asleep folded under the head; awake on the keys (hd) or resting by the laptop. */
export function hands(aw: number, hd: number, tl: number, tr: number) {
  return { lx: mix(mix(434, 352, aw), 350, hd), ly: mix(mix(400, 404, aw), 336, hd) + tl, rx: mix(mix(368, 452, aw), 448, hd), ry: mix(mix(408, 404, aw), 336, hd) + tr };
}
/** The sip in two moves: the hand reaches for the cup (sip 0..0.35), then brings it up (0.35..1). */
export const reach = (sip: number) => ease(sip / 0.35);
export const carry = (sip: number) => ease((sip - 0.35) / 0.65);
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
/** Where the cup is drawn: on the desk at (x, y) (its top left), lifted by `lift` (0..1, a drag), or
 *  carried to his mouth by the sip. `sq` squashes it (a press: -1, a pop: > 0). */
export function cupT(sip: number, x: number = CUP.x, y: number = CUP.y, lift = 0, sq = 0) {
  const c = carry(sip), s = (1 + c * 0.09 + lift * 0.14) * (1 + sq * 0.07);
  return `translate(${r1(mix(x, CUP.mx, c))} ${r1(mix(y, CUP.my, c) - lift * 6)}) rotate(${r1(c * (x + CUP.r < 400 ? -18 : 18))} 39 39) translate(39 39) scale(${Math.round(s * 1000) / 1000}) translate(-39 -39)`;
}
/** The cup's shadow on the desk: it grows and drifts as the cup lifts; hidden while he drinks. */
export const cupShT = (x: number, y: number, lift: number) => `translate(${r1(x + CUP.r + 3 + lift * 9)} ${r1(y + CUP.r + 4 + lift * 12)}) scale(${Math.round((1 + lift * 0.3) * 100) / 100})`;
/** The coffee's surface in each frame of the 2015 sheet (cx, cy, rx, ry in its 84 px frame), measured
 *  from coffee.png: the scene paints its own liquid over it, so the colour can cool. */
export const LIQUID = [[0, 0, 0, 0], [42, 48.5, 2.6, 2.1], [42, 49, 3.6, 3.6], [42, 49, 5.6, 4.6], [42, 48.5, 6.6, 6.1], [42, 48.5, 7.6, 7.1], [42, 49, 11.6, 10.6], [42, 49, 12.6, 11.6], [42, 48.5, 16.6, 15.1], [42, 47, 18.6, 16.6], [42, 45, 20.6, 18.6], [42, 43.5, 22.6, 20.1]];
/** Coffee (code) or matcha (design), hot (h = 1) to cooled (h = 0). `fz`: the Fizlet look's pair of
 *  tokens instead (hot, cooled) as [r, g, b]. */
export function brew(design: boolean, h: number, fz?: readonly (readonly number[])[]) {
  const a = fz ? fz[0]! : design ? [47, 125, 109] : [70, 40, 30], b = fz ? fz[1]! : design ? [150, 205, 185] : [182, 134, 100];
  return `rgb(${Math.round(mix(b[0]!, a[0]!, h))},${Math.round(mix(b[1]!, a[1]!, h))},${Math.round(mix(b[2]!, a[2]!, h))})`;
}
const SAUCER = `<circle class="o-sh" cx="43" cy="44.5" r="40" fill="#d9d1b3"/><circle class="o-face" cx="42" cy="42.5" r="40" fill="${C.cream}"/><circle class="o-faceD" cx="42" cy="43" r="30" fill="none" stroke="#e6dfc4" stroke-width="2"/>`;
/** The headphones: lying open on the desk by the phone, or on his head over the cap, the band
 *  across the crown and a cup over each ear (they ride the head's tilt). */
export function phonesT(ph: number, aw: number, sip: number, bob = 0) {
  const h = head(aw, sip), e = ease(ph), lift = Math.sin(e * Math.PI) * 26;
  return `translate(${r1(mix(604, h.x, e))} ${r1(mix(170, h.y + bob, e) - lift)}) rotate(${r1(mix(-14, h.a, e))}) scale(${r1(mix(0.92, 1, e) * 100) / 100})`;
}
/** The band's curve: a deep U lying on the desk, nearly flat across the crown on his head. */
export const band = (ph: number) => `M-52 -2Q0 ${r1(mix(-104, -14, ease(ph)))} 52 -2`;
/** The cord from the right ear cup to the phone's jack (a soft curve). */
export function cord(ph: number, aw: number, sip: number) {
  const h = head(aw, sip), e = ease(ph);
  const x = mix(604 + 48, h.x + 52, e), y = mix(170 + 18, h.y + 20, e);
  return `M${r1(x)} ${r1(y)}C${r1(x + 40)} ${r1(y + 40)} 616 390 607 372`;
}
/** The laptop lid: above 0.5 the screen unfolds up from the hinge; below, the lid covers the keys. */
export const screenT = (lid: number) => `translate(0 250) scale(1 ${r1(Math.max(0, lid * 2 - 1) * 100) / 100}) translate(0 -250)`;
export const coverT = (lid: number) => `translate(0 250) scale(1 ${r1(Math.max(0, 1 - lid * 2) * 100) / 100}) translate(0 -250)`;
/** A part's press: squash (sq < 0) and pop (sq > 0) around its centre. */
export const sqT = (cx: number, cy: number, sq: number) => (sq ? `translate(${cx} ${cy}) scale(${Math.round((1 + sq * 0.07) * 1000) / 1000}) translate(${-cx} ${-cy})` : "");

// ---------- static parts ----------
const keys = () => {
  let s = "";
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 12; c++) {
      const wide = r === 4 && c > 3 && c < 8;
      if (r === 4 && c > 4 && c < 8) continue;
      s += `<rect x="${302 + c * 16.4}" y="${262 + r * 15}" width="${wide ? 16.4 * 4 - 3 : 13}" height="11" rx="2"/>`;
    }
  return s;
};
// Code: two identical pages of lines (scrolled as one strip, wrapping), in 2015's syntax colours.
const CODE = [[0, 40, 1], [12, 60, 2], [12, 30, 0], [24, 52, 3], [24, 70, 1], [12, 22, 0], [0, 14, 2], [0, 0, 0], [0, 48, 1], [12, 34, 3], [24, 64, 2], [24, 40, 0], [36, 30, 1], [24, 18, 0], [12, 26, 3], [0, 14, 2]];
const INK = [C.tealL, C.red, C.cream, C.sun];
const codePage = (y0: number) => CODE.map(([x, w, c], i) => (w ? `<rect class="o-i${c}" x="${316 + x!}" y="${y0 + i * 7}" width="${w! * 1.7}" height="3.4" rx="1.7" fill="${INK[c!]}"/>` : "")).join("");
// The phone's code: a short terminal.
const PHONE_CODE = [[0, 30, 2], [6, 22, 0], [6, 34, 1], [0, 16, 3], [0, 28, 0], [6, 20, 2]].map(([x, w, c], i) => `<rect class="o-i${c}" x="${-23 + x!}" y="${4 + i * 7}" width="${w}" height="3" rx="1.5" fill="${INK[c!]}"/>`).join("");
// A hand seen from above (the back of it), pointing along +x: palm, fingers, the thumb on the
// inner side (+y for the left hand; the right is mirrored).
const HAND = (m: string) => `<g${m}><rect x="-5" y="6" width="17" height="9" rx="4.5" fill="${C.skin}" stroke="${C.skinD}" stroke-width="1.4" transform="rotate(22 -5 10)"/><rect x="-13" y="-12" width="26" height="24" rx="9" fill="${C.skin}"/><rect x="3" y="-11.5" width="20" height="23" rx="7" fill="${C.skin}"/><path d="M13-5.6h8M13 0h9M13 5.6h8" stroke="${C.skinD}" stroke-width="1.6" stroke-linecap="round"/></g>`;
/** One arm's markup at its pose: the upper arm under the sleeve, the forearm, the hand. */
const armEl = (s: number, tx: number, ty: number) => {
  const k = arm(s, tx, ty), side = s < 0 ? "l" : "r";
  return `<g class="og-arm-${side}"><line class="og-ua" x1="${k.sx}" y1="${SH.y}" x2="${k.ex}" y2="${k.ey}" stroke="${C.skinD}" stroke-width="26" stroke-linecap="round"/><line class="og-fa" x1="${k.ex}" y1="${k.ey}" x2="${k.hx}" y2="${k.hy}" stroke="${C.skin}" stroke-width="20" stroke-linecap="round"/><line class="og-fm" x1="${k.ex}" y1="${k.ey}" x2="${r1(mix(k.ex, k.hx, 0.45))}" y2="${r1(mix(k.ey, k.hy, 0.45))}" stroke="${C.skin}" stroke-width="25" stroke-linecap="round"/><line class="og-sl o-shirt" x1="${k.sx}" y1="${SH.y}" x2="${r1(mix(k.sx, k.ex, 0.72))}" y2="${r1(mix(SH.y, k.ey, 0.72))}" stroke="${C.red}" stroke-width="36" stroke-linecap="round"/><g class="og-hand-${side}" transform="translate(${k.hx} ${k.hy}) rotate(${k.deg})">${HAND(s < 0 ? "" : ' transform="scale(1 -1)"')}</g></g>`;
};

/** The whole scene as SVG markup. `p`: the pose to draw (the scene then moves it); `mode`: what
 *  the screens show first; `cup`: the coffee sheet's URL. */
export function art(p: { aw: number; ph: number; lid: number; hd: number }, mode: "code" | "design", cup: string, sizes: Record<string, number> = {}, id = "og-") {
  const tag = (id: string, x: number, y: number, bricks: string[], what: string) => {
    const a = bricks.map((b) => `${b === "kernel" ? "kernel" : "@fzlt/core/" + b}${sizes[b] ? ` ${sizes[b]!.toLocaleString("en-US")} B` : ""}`).join(" + "), w = Math.max(a.length, what.length) * 6.3 + 16;
    return `<g class="og-tag" data-t="${id}" transform="translate(${x} ${y})"><rect width="${r1(w)}" height="34" rx="5" fill="${C.ink}" stroke="${C.cream}" stroke-width="1"/><text x="8" y="14" fill="${C.cream}">${a}</text><text x="8" y="27" fill="${C.tealL}">${what}</text></g>`;
  };
  const hn = hands(p.aw, p.hd, 0, 0), design = mode === "design", nk = neck(p.aw, 0);
  return `<svg class="og-svg" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid slice" role="group" aria-label="A desk seen from above: he sleeps at night, wakes with the sun, puts the headphones on, drinks his coffee and codes all day">
<defs>
<radialGradient id="${id}lampg"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".9"/><stop offset=".55" stop-color="#ffcf7a" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}scrg"><stop offset="0" stop-color="#bff3ea" stop-opacity=".75"/><stop offset="1" stop-color="#8fd0c5" stop-opacity="0"/></radialGradient>
<clipPath id="${id}dsp"><rect x="304" y="140" width="192" height="100"/></clipPath>
<clipPath id="${id}psc"><rect x="-26" y="-44" width="52" height="86" rx="3"/></clipPath>
<pattern id="${id}mesh" width="5" height="5" patternUnits="userSpaceOnUse"><rect class="o-dot" x="1.5" y="1.5" width="2" height="2" fill="${C.cream}" opacity=".6"/></pattern>
<pattern id="${id}pix" width="6" height="6" patternUnits="userSpaceOnUse"><rect class="o-pix" width="3" height="3" fill="${C.redD}" opacity=".5"/><rect class="o-pix" x="3" y="3" width="3" height="3" fill="${C.redD}" opacity=".5"/></pattern>
<pattern id="${id}grid" width="40" height="40" patternUnits="userSpaceOnUse" x="0" y="102"><path class="o-grid" d="M40 0H0V40" fill="none" stroke-width="1"/></pattern>
</defs>
<g class="og-sky" data-p="sky">
<rect class="o-sky" x="-300" y="-300" width="1400" height="396" fill="var(--sky)"/>
<g class="og-stars o-star" fill="${C.cream}"><circle cx="90" cy="26" r="1.6"/><circle cx="180" cy="58" r="1.2"/><circle cx="330" cy="20" r="1.4"/><circle cx="470" cy="46" r="1.2"/><circle cx="560" cy="16" r="1.6"/><circle cx="720" cy="40" r="1.3"/><circle cx="30" cy="66" r="1.1"/><circle cx="770" cy="70" r="1.2"/></g>
<circle class="og-moon o-star" cx="660" cy="36" r="15" fill="${C.cream}"/><circle class="og-moon o-sky" cx="667" cy="31" r="13" fill="var(--sky)"/>
<circle class="og-sun" cx="0" cy="0" r="18" fill="${C.sun}"/>
<path class="o-city" fill="${C.ink}" opacity=".55" d="M-300 96V64h330v-22h44v30h60V50h36v46h90V58h52v38h70V40h30v-8h20v64h90V60h56v36h54V48h40v48h90V66h54V96Z"/>
<g class="og-lit o-lit" fill="${C.sun}"><rect x="40" y="52" width="4" height="5"/><rect x="230" y="64" width="4" height="5"/><rect x="138" y="58" width="4" height="5"/><rect x="404" y="70" width="4" height="5"/><rect x="560" y="48" width="4" height="5"/><rect x="700" y="74" width="4" height="5"/><rect x="608" y="62" width="4" height="5"/></g>
<rect class="o-frame" x="-300" y="88" width="1400" height="14" fill="${C.cream}"/><rect class="o-frame" x="263" y="-300" width="10" height="390" fill="${C.cream}"/><rect class="o-frame" x="527" y="-300" width="10" height="390" fill="${C.cream}"/>
</g>
<rect class="o-desk" x="-300" y="102" width="1400" height="700" fill="${C.teal}"/>
<rect class="og-fz" x="-300" y="102" width="1400" height="700" fill="url(#${id}grid)"/>
<rect class="og-15" x="-300" y="102" width="1400" height="10" fill="${C.tealD}" opacity=".6"/>
<path class="og-fz o-glow" d="M-300 103.5H1100" stroke-width="8"/><path class="og-fz o-neon" d="M-300 103.5H1100" stroke-width="2"/>
<path class="og-beam o-beam" fill="${C.cream}" d="M150 102h230l120 400H270Z"/>
<g data-p="lamp"><circle class="o-sh" cx="104" cy="176" r="34" fill="${C.ink}" opacity=".18"/><circle class="o-face" cx="100" cy="172" r="32" fill="${C.cream}"/><path class="o-redS" d="M100 172L132 214" stroke="${C.inkL}" stroke-width="6" stroke-linecap="round"/><circle class="o-red" cx="136" cy="218" r="22" fill="${C.red}"/><circle cx="136" cy="218" r="12" class="og-bulb o-star" fill="${C.cream}"/></g>
<g transform="rotate(-9 128 380)"><rect class="o-face" x="70" y="320" width="118" height="132" rx="4" fill="${C.cream}"/><rect class="o-faceD" x="70" y="320" width="12" height="132" fill="${C.creamD}"/><path class="o-rule" d="M96 354h70M96 372h56M96 390h64" stroke="${C.creamD}" stroke-width="3" stroke-linecap="round"/><circle class="o-redS" cx="148" cy="420" r="16" fill="none" stroke="${C.red}" stroke-width="3"/><rect class="o-tealD" x="176" y="340" width="7" height="92" rx="2" fill="${C.red}" transform="rotate(12 180 386)"/></g>
<g transform="translate(724 210)"><circle class="o-face" r="30" fill="${C.cream}"/><ellipse class="o-l2" rx="34" ry="13" fill="#3f8f6f" transform="rotate(30)"/><ellipse class="o-l1" rx="34" ry="13" fill="#4ea27d" transform="rotate(-40)"/><ellipse class="o-l3" rx="30" ry="11" fill="#5fb48c" transform="rotate(95)"/><circle class="o-l2" r="6" fill="#3f8f6f"/></g>
<svg class="og-saucer" x="${CUP.x}" y="${CUP.y}" width="78" height="78" viewBox="0 0 84 84" overflow="visible">${SAUCER}</svg>
<g data-p="laptop" class="og-laptop" tabindex="0" role="button" aria-label="Close the laptop">
<rect class="o-sh" x="290" y="252" width="224" height="134" rx="10" fill="${C.ink}" opacity=".16"/>
<rect class="o-face" x="286" y="248" width="228" height="134" rx="10" fill="${C.cream}"/>
<rect class="og-fz o-glow" x="286" y="248" width="228" height="134" rx="10" fill="none" stroke-width="8"/>
<g class="o-faceD" fill="${C.creamD}">${keys()}</g><rect class="o-faceD" x="366" y="344" width="68" height="30" rx="5" fill="${C.creamD}"/>
<g class="og-cover" transform="${coverT(p.lid)}"><rect class="o-lid" x="286" y="248" width="228" height="134" rx="10" fill="#cfc8b2"/><circle class="o-face" cx="400" cy="315" r="9" fill="${C.cream}"/></g>
<g class="og-screen" transform="${screenT(p.lid)}">
<rect class="og-fz o-glow" x="292" y="128" width="216" height="122" rx="9" fill="none" stroke-width="8"/>
<rect class="o-lid" x="292" y="128" width="216" height="122" rx="9" fill="${C.ink}"/>
<rect class="o-scr" x="304" y="140" width="192" height="100" fill="${C.code}"/>
<g clip-path="url(#${id}dsp)">
<g class="og-code" ${design ? 'style="display:none"' : ""}><rect class="o-ink" x="304" y="140" width="192" height="12" fill="${C.ink}"/><circle class="o-red" cx="312" cy="146" r="2.4" fill="${C.red}"/><circle class="o-sun" cx="320" cy="146" r="2.4" fill="${C.sun}"/><circle class="o-tealD" cx="328" cy="146" r="2.4" fill="${C.tealL}"/><g class="og-scroll">${codePage(158)}${codePage(158 + CODE.length * 7)}</g><rect class="og-caret o-star" x="316" y="230" width="5" height="6" fill="${C.cream}"/></g>
<g class="og-des" ${design ? "" : 'style="display:none"'}><rect class="o-scr" x="304" y="140" width="192" height="100" fill="#efe9d6"/><g class="o-red" fill="${C.red}" opacity=".12">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${330 + i * 24}" y="146" width="18" height="88"/>`).join("")}</g><rect class="o-teal" x="330" y="150" width="138" height="34" rx="3" fill="${C.teal}"/><rect class="o-cream" x="338" y="160" width="60" height="5" rx="2.5" fill="${C.cream}"/><rect class="o-cream" x="338" y="170" width="38" height="4" rx="2" fill="${C.cream}" opacity=".7"/><circle class="og-shape o-sun" cx="444" cy="167" r="10" fill="${C.sun}"/><rect class="o-red" x="330" y="192" width="42" height="34" rx="3" fill="${C.red}"/><rect class="o-faceD" x="378" y="192" width="42" height="34" rx="3" fill="${C.ink}"/><rect class="o-tealD" x="426" y="192" width="42" height="34" rx="3" fill="${C.tealD}"/><rect class="og-sel" x="374" y="188" width="50" height="42" fill="none" stroke="#2f80ed" stroke-width="1.4"/><path class="og-arrow" d="M0 0v12l3.4-3 2.4 5.4 2-1-2.4-5.2h4.6Z" fill="${C.ink}" stroke="${C.cream}" stroke-width=".8"/></g>
</g>
<circle cx="400" cy="134" r="1.8" fill="${C.inkL}"/>
</g>
</g>
<path class="og-cord o-cord" d="${cord(p.ph, p.aw, 0)}" fill="none" stroke="${C.red}" stroke-width="3" stroke-linecap="round"/>
<g data-p="phone" transform="translate(607 306) rotate(8)"><g class="og-sqp">
<rect class="o-sh" x="-31" y="-58" width="66" height="122" rx="10" fill="${C.ink}" opacity=".18"/>
<rect class="og-fz o-glow" x="-34" y="-62" width="68" height="124" rx="10" fill="none" stroke-width="8"/>
<rect class="o-face" x="-34" y="-62" width="68" height="124" rx="10" fill="${C.cream}"/>
<rect x="-26" y="-44" width="52" height="86" rx="3" class="og-pscr o-scr" fill="${C.code}"/>
<g clip-path="url(#${id}psc)">
<image class="og-pix" x="-15" y="-42" width="30" height="30" style="image-rendering:pixelated"/>
<g class="og-code" transform="translate(0 -8)" ${design ? 'style="display:none"' : ""}>${PHONE_CODE}</g>
<g class="og-des" transform="translate(0 -8)" ${design ? "" : 'style="display:none"'}>${[["teal", C.teal], ["red", C.red], ["sun", C.sun], ["tealD", C.ink], ["star", C.cream]].map(([k, c], i) => `<rect class="o-${k}" x="${-22 + (i % 3) * 15}" y="${6 + (i / 3 | 0) * 15}" width="12" height="12" rx="2" fill="${c}"/>`).join("")}<circle cx="16" cy="27" r="6" fill="none" stroke="${C.cream}" stroke-width="1.4"/></g>
</g>
<rect class="o-faceD" x="-8" y="-54" width="16" height="3" rx="1.5" fill="${C.creamD}"/><circle class="o-faceD" cy="52" r="5" fill="${C.creamD}"/>
</g></g>
<g class="og-body" data-p="person" tabindex="0" role="button" aria-label="Nudge him">
<path class="o-sh" d="M298 508Q300 466 342 460H458Q500 466 502 508L512 640H288Z" fill="${C.ink}" opacity=".16"/>
<path class="o-shirt" d="M294 504Q296 462 338 456H462Q504 462 506 504L516 640H284Z" fill="${C.red}"/>
<ellipse class="og-neck o-shirt" cx="400" cy="${nk.cy}" rx="50" ry="${nk.ry}" fill="${C.red}"/><ellipse class="og-nape" cx="400" cy="${r1(nk.cy - nk.ry + 30)}" rx="18" ry="14" fill="${C.skinD}"/>
<path class="o-shirtD" d="M370 466q30 16 60 0" fill="none" stroke="${C.redD}" stroke-width="5" stroke-linecap="round"/>
${armEl(-1, hn.lx, hn.ly)}${armEl(1, hn.rx, hn.ry)}
<g class="og-head" transform="${headT(p.aw, 0)}"><ellipse cx="-43" cy="5" rx="7" ry="11" fill="${C.skinD}"/><ellipse cx="43" cy="5" rx="7" ry="11" fill="${C.skinD}"/><circle r="44" fill="${C.ink}"/>
<circle class="o-mesh" cy="-2" r="41" fill="${C.inkL}"/><circle cy="-2" r="41" fill="url(#${id}mesh)"/>
<path class="o-foam" d="M0-2L-36 18A41 41 0 0 0 36 18Z" fill="${C.cream}"/>
<path class="o-seam" d="M0-2L-40-11M0-2L40-11M0-2L-15-40M0-2L15-40" fill="none" stroke="${C.ink}" stroke-width="1.6" opacity=".55"/>
<path d="M-12-41q12 14 24 0Z" fill="${C.ink}"/><path class="o-strap" d="M-14-36h28" stroke="${C.cream}" stroke-width="3" stroke-linecap="round"/>
<circle class="o-btn" cy="-2" r="4.5" fill="${C.red}"/>
<path class="o-bill" d="M-36 18C-46 46-24 60 0 60S46 46 36 18A41 41 0 0 1-36 18Z" fill="${C.tealD}"/><path class="o-billE" d="M-36 18C-46 46-24 60 0 60S46 46 36 18" fill="none" stroke="${C.ink}" stroke-width="2.4"/></g>
</g>
<g data-p="phones" class="og-phones" transform="${phonesT(p.ph, p.aw, 0)}"><path class="og-band o-band" d="${band(p.ph)}" fill="none" stroke="#c9bf9f" stroke-width="13" stroke-linecap="round"/><path class="og-band o-band2" d="${band(p.ph)}" fill="none" stroke="${C.cream}" stroke-width="6" stroke-linecap="round"/><rect class="o-hcup" x="-60" y="-21" width="16" height="42" rx="7" fill="${C.red}"/><rect class="o-hcup" x="44" y="-21" width="16" height="42" rx="7" fill="${C.red}"/><rect class="o-pad" x="-57" y="-14" width="6" height="28" rx="3" fill="${C.cream}"/><rect class="o-pad" x="51" y="-14" width="6" height="28" rx="3" fill="${C.cream}"/></g>
<g class="og-pud" style="display:none"><path class="o-pud" d="M-4-15C14-24 44-19 50-3S38 26 18 22C4 28-10 16-7 4S-10-10-4-15Z" fill="#5a3526"/><path class="og-fz" d="M-4-15C14-24 44-19 50-3S38 26 18 22C4 28-10 16-7 4S-10-10-4-15Z" fill="url(#${id}pix)"/><ellipse class="og-15" cx="22" cy="-4" rx="9" ry="4" fill="${C.cream}" opacity=".35"/></g>
<circle class="og-cupsh o-csh" r="30" fill="${C.ink}" opacity=".16"/>
<g data-p="cup" class="og-cup" transform="${cupT(0)}"><g class="og-upg"><svg class="og-up" width="78" height="78" viewBox="0 0 84 84" overflow="visible"><clipPath id="${id}cupc"><circle cx="42" cy="43.5" r="27.6"/><rect x="3.5" y="35.5" width="20" height="13" rx="6.5"/></clipPath><g class="og-15" clip-path="url(#${id}cupc)"><image class="og-cupimg" href="${cup}" x="${-11 * 84}" y="${design ? -84 : 0}" width="1008" height="168"/></g><g class="og-fz"><rect class="o-neon" x="3" y="35" width="22" height="15" rx="7.5" fill="none" stroke-width="3.5"/><circle class="o-glow" cx="42" cy="43.5" r="28" fill="none" stroke-width="8"/><circle class="o-face" cx="42" cy="43.5" r="27.5" stroke-width="2.5"/><circle class="o-scr" cx="42" cy="43.5" r="23.5"/></g><ellipse class="og-liquid" cx="42" cy="43.5" rx="22.6" ry="20.1" fill="${brew(design, 0.8)}"/></svg></g>
<g class="og-tip" style="display:none"><rect class="o-face" x="9" y="16" width="60" height="48" rx="9" fill="${C.cream}"/><rect class="o-faceD" x="9" y="16" width="12" height="48" rx="6" fill="${C.creamD}"/><rect x="26" y="31" width="20" height="18" rx="8" fill="none" class="o-redS" stroke="${C.creamD}" stroke-width="4"/><ellipse class="o-face" cx="70" cy="40" rx="8" ry="24" fill="${C.cream}"/><ellipse class="o-brew" cx="70" cy="40" rx="5" ry="19" fill="${C.ink}"/></g></g>
<g class="og-pot" style="display:none"><path class="o-pour og-stream" d="M40 0H66" stroke="#5a3526" stroke-width="0" stroke-linecap="round"/><g class="og-potb"><circle class="o-csh" cx="4" cy="6" r="27" fill="${C.ink}" opacity=".16"/><circle class="o-pot" r="27" fill="${C.cream}"/><circle class="o-brew" r="19" fill="#5a3526"/><path class="o-pot" d="M24-8L44 0L24 8Z" fill="${C.cream}"/><rect class="o-pot" x="-44" y="-7" width="18" height="14" rx="6" fill="${C.ink}"/></g></g>
<rect class="og-night o-night" x="-300" y="-300" width="1400" height="1100" fill="#1d1a3c"/>
<circle class="og-lampg" cx="150" cy="250" r="230" fill="url(#${id}lampg)"/>
<ellipse class="og-scrg" cx="400" cy="250" rx="170" ry="140" fill="url(#${id}scrg)"/>
<rect class="og-scrl" x="304" y="140" width="192" height="100" fill="#bff3ea" transform="${screenT(p.lid)}"/>
<g class="og-tags" aria-hidden="true">${tag("sky", 290, 108, ["timeline"], "the day and night cycle")}${tag("person", 300, 452, ["timeline"], "wake, sip, sleep")}${tag("phones", 476, 100, ["fx", "sound"], "notes and the beat")}${tag("cup", 120, 352, ["input", "timeline", "fx"], "drag, flick, refill")}${tag("laptop", 304, 196, ["input", "fx"], "the lid, keys, code sparks")}${tag("phone", 520, 384, ["sprite"], "the pixel coder")}${tag("lamp", 40, 250, ["kernel"], "one loop, settle, Recall")}</g>
</svg>`;
}
