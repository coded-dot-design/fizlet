// #22 Halftone: a micro print shop. A blank sheet lies on the press bed; every click prints the next
// plate (yellow, magenta, cyan, then black) as a halftone dot wave from where you clicked: dots
// grow out of the wave, wobble a pixel out of register, then merge into flat ink. Nobody knows
// what's on the cover until the black plate lands: the Glitch looming over the city, or a cat with
// a lit bomb. The black plate prints the cover's real title too: each letter comes up in dots as
// the wave reaches it, then goes crisp. Now and then a sheet comes out a MISPRINT (the black plate
// stays off register). Click a finished cover and it's pulled off the bed; a fresh sheet slides on.
// Bricks: the kernel (fixed step, settle: it sleeps between plates), @fzlt/core/slot (loads near the
// screen, never under reduced motion; destroy() gives the page back: the title, through the ledger).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, offscreen, print, textW } from "./pix";
import { letters } from "./letters";

// The sheet on the bed, in art px, and its halftone cells.
const SX = 20, SY = 7, SW = 120, SH = 76, CELL = 4, CW = SW / CELL, CH = SH / CELL;
// The plates, in print order: ink colours and their labels.
const INKS = [C.hurt, C.attack, C.sys, C.rim], LABEL = ["Y", "M", "C", "K"], NP = 4;
// A plate's wave: px per second across the sheet, and how long a cell takes to fill once reached.
const SPEED = 150, FILL = 0.32;

// ---------- The covers, painted flat in the four inks on paper ----------
type Painter = (g: CanvasRenderingContext2D) => void;
const disc = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) => {
  g.fillStyle = c;
  for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1);
};
const burst = (g: CanvasRenderingContext2D, cx: number, cy: number, n: number, c: string, y0: number, y1: number) => {
  g.fillStyle = c;
  for (let y = y0; y < y1; y++) for (let x = 0; x < SW; x++) if (((Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 1) * n | 0) % 2) g.fillRect(x, y, 1, 1);
};
const frame: Painter = (g) => {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, SW, SH);
};
const masthead: Painter = (g) => {
  g.fillStyle = C.rim;
  g.fillRect(0, 0, SW, 12);
  print(g, "FIZLET COMICS", 4, 4, C.hurt);
  g.fillStyle = C.attack;
  g.fillRect(SW - 24, 2, 22, 8);
  print(g, "NO.22", SW - 22, 4, C.ink);
  // The title band (the real title sits on it).
  g.fillStyle = C.rim;
  g.fillRect(0, 59, SW, 1);
  g.fillStyle = C.attack;
  g.fillRect(0, 60, SW, SH - 60);
};
const COVERS: Painter[] = [
  // The Glitch looms over the city.
  (g) => {
    frame(g);
    burst(g, 60, 34, 18, C.hurt, 12, 59);
    // The city, cyan, under it.
    for (const [x, top, w] of [[0, 46, 14], [13, 40, 12], [26, 50, 10], [86, 42, 13], [98, 48, 10], [107, 38, 13]] as const) {
      g.fillStyle = C.rim;
      g.fillRect(x, top, w, 59 - top);
      g.fillStyle = C.sys;
      g.fillRect(x + 1, top + 1, w - 2, 58 - top);
      g.fillStyle = C.rim;
      for (let wy = top + 3; wy < 56; wy += 4) for (let wx = x + 3; wx < x + w - 2; wx += 3) g.fillRect(wx, wy, 1, 2);
    }
    // Spikes with knobs, the body, one big eye, a grin.
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.62, ex = 60 + Math.cos(a) * 22, ey = 34 + Math.sin(a) * 22;
      g.fillStyle = C.rim;
      for (let k = 14; k < 22; k++) g.fillRect(Math.round(60 + Math.cos(a) * k) - 1, Math.round(34 + Math.sin(a) * k) - 1, 3, 3);
      disc(g, Math.round(ex), Math.round(ey), 3.2, C.rim);
      disc(g, Math.round(ex), Math.round(ey), 2.2, C.hurt);
    }
    disc(g, 60, 34, 17.5, C.rim);
    disc(g, 60, 34, 16.3, C.attack);
    disc(g, 55, 30, 7.6, C.rim);
    disc(g, 55, 30, 6.4, C.ink);
    disc(g, 52, 31, 2.6, C.rim);
    g.fillStyle = C.rim;
    g.fillRect(49, 42, 22, 5);
    g.fillStyle = C.ink;
    for (let x = 50; x < 70; x += 3) g.fillRect(x, 42, 2, 2);
    masthead(g);
  },
  // A cat, holding a lit bomb.
  (g) => {
    frame(g);
    burst(g, 54, 36, 16, C.sys, 12, 59);
    // Ears, head, eyes, nose, whiskers.
    for (const s of [-1, 1]) {
      g.fillStyle = C.rim;
      for (let y = 0; y < 12; y++) g.fillRect(54 + s * 11 - ((12 - y) >> 1) - 1, 15 + y, ((12 - y) >> 1) * 2 + 2, 1);
      g.fillStyle = C.hurt;
      for (let y = 1; y < 11; y++) g.fillRect(54 + s * 11 - ((11 - y) >> 1), 16 + y, ((11 - y) >> 1) * 2, 1);
    }
    disc(g, 54, 38, 17.5, C.rim);
    disc(g, 54, 38, 16.3, C.hurt);
    for (const s of [-1, 1]) {
      disc(g, 54 + s * 7, 34, 4.4, C.rim);
      disc(g, 54 + s * 7, 34, 3.4, C.sys);
      g.fillStyle = C.rim;
      g.fillRect(54 + s * 7, 31, 1, 6);
      g.fillRect(54 + s * 18 - (s > 0 ? 6 : 0), 41, 7, 1);
      g.fillRect(54 + s * 18 - (s > 0 ? 6 : 0), 44, 7, 1);
    }
    g.fillStyle = C.rim;
    g.fillRect(52, 40, 5, 4);
    g.fillStyle = C.attack;
    g.fillRect(53, 40, 3, 2);
    g.fillStyle = C.rim;
    g.fillRect(50, 47, 3, 1);
    g.fillRect(56, 47, 3, 1);
    g.fillRect(53, 46, 3, 1);
    // The bomb, its fuse, the spark.
    disc(g, 88, 46, 9.5, C.rim);
    g.fillStyle = C.ink;
    g.fillRect(84, 41, 2, 2);
    g.fillStyle = C.rim;
    g.fillRect(87, 34, 4, 3);
    for (let k = 0; k < 8; k++) g.fillRect(90 + (k >> 1), 33 - k, 1, 1);
    disc(g, 94, 24, 3.2, C.attack);
    disc(g, 94, 24, 1.6, C.hurt);
    g.fillStyle = C.hurt;
    g.fillRect(94, 18, 1, 3);
    g.fillRect(98, 24, 3, 1);
    g.fillRect(88, 24, 3, 1);
    // A paw on it.
    disc(g, 79, 50, 4.2, C.rim);
    disc(g, 79, 50, 3.1, C.hurt);
    masthead(g);
  },
];

/** A cover as four plates: each plate's own pixels (a canvas) and its coverage per cell (0–16). */
function plates(paint: Painter) {
  const art = offscreen(SW, SH);
  paint(art);
  const d = art.getImageData(0, 0, SW, SH).data, rgb = INKS.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const out = INKS.map(() => offscreen(SW, SH)), cover = INKS.map(() => new Uint8Array(CW * CH));
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const o = (y * SW + x) * 4, p = rgb.findIndex((c) => c[0] === d[o] && c[1] === d[o + 1] && c[2] === d[o + 2]);
      if (p < 0) continue;
      out[p]!.fillStyle = INKS[p]!;
      out[p]!.fillRect(x, y, 1, 1);
      cover[p]![((y / CELL) | 0) * CW + ((x / CELL) | 0)]!++;
    }
  return { canvas: out.map((g) => g.canvas), cover };
}

// ---------- The press bed ----------
function paintBed(g: CanvasRenderingContext2D) {
  g.fillStyle = C.base;
  g.fillRect(0, 0, W, H);
  // A cutting-mat grid.
  g.fillStyle = C.line;
  for (let x = 4; x < W; x += 8) g.fillRect(x, 0, 1, H);
  for (let y = 4; y < H; y += 8) g.fillRect(0, y, W, 1);
  // Registration targets left and right of the sheet, crop marks at its corners.
  for (const [x, y] of [[10, 45], [150, 74]] as const) {
    g.fillStyle = C.ink;
    for (let a = 0; a < 40; a++) g.fillRect(Math.round(x + Math.cos(a / 6.37) * 4), Math.round(y + Math.sin(a / 6.37) * 4), 1, 1);
    g.fillRect(x - 6, y, 13, 1);
    g.fillRect(x, y - 6, 1, 13);
  }
  g.fillStyle = C.ink;
  for (const [x, y] of [[SX, SY], [SX + SW, SY], [SX, SY + SH], [SX + SW, SY + SH]] as const) {
    g.fillRect(x + (x === SX ? -6 : 2), y, 4, 1);
    g.fillRect(x, y + (y === SY ? -6 : 2), 1, 4);
  }
}

export type PressScene = SlotScene & { engine: ReturnType<typeof createEngine>; press(x: number, y: number): void; poster(): void; readonly plates: number; readonly prints: number };

// State slots.
const NEXT = 0, COVER = 1, PULL = 2, PEND = 3, PX = 4, PY = 5, AUTO = 6, DIRTY = 7, MIS = 8, PRINTS = 9, DONE = 10, TITLE = 11;
// Dot radius per print level (0–8) of the title's mask; HIDDEN: no dot at all (not yet printed).
const D = Array.from({ length: 9 }, (_, i) => `${(i * 0.0125).toFixed(4)}em`), HIDDEN = "-0.05em";

export function press(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): PressScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const L = engine.ledger;
  const ctx = artCanvas(engine, stage);
  const bed = offscreen(W, H);
  paintBed(bed);
  const covers = COVERS.map(plates);
  const title = letters(engine, slot, ".ht-t i"), tn = title.n, tl = new Int8Array(tn).fill(-2);
  const titleEl = slot.querySelector<HTMLElement>(".ht-t");
  const s = new Float64Array(12);
  s[AUTO] = first ? -1 : 0.5;
  s[DIRTY] = 1;
  s[PULL] = -1;
  s[TITLE] = 1;
  // Each plate on this sheet: wave origin (sheet px), seconds since it was pressed (-1: not yet),
  // done (drawn whole now), its register wobble.
  const ox = new Float32Array(NP), oy = new Float32Array(NP), pt = new Float32Array(NP).fill(-1), pd = new Uint8Array(NP);
  // The distance of every cell's middle from a plate's origin, filled at the press.
  const dist = new Float32Array(NP * CW * CH);

  const pressAt = (x: number, y: number) => ((s[PX] = x), (s[PY] = y), (s[PEND] = 1), engine.wake());
  if (first) pressAt((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  slot.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per click, outside any frame
    pressAt(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  function click(x: number, y: number, e: typeof engine) {
    if (s[PULL]! >= 0) return;
    if (s[NEXT]! >= NP) {
      // A finished cover: pull it off the bed; a fresh sheet (the other cover) slides on.
      if (s[DONE]) s[PULL] = 0;
      return;
    }
    const p = s[NEXT]!;
    s[NEXT] = p + 1;
    ox[p] = Math.min(SW - 1, Math.max(0, x - SX));
    oy[p] = Math.min(SH - 1, Math.max(0, y - SY));
    pt[p] = 0;
    pd[p] = 0;
    for (let c = 0; c < CW * CH; c++) dist[p * CW * CH + c] = Math.hypot((c % CW) * CELL + 2 - ox[p]!, ((c / CW) | 0) * CELL + 2 - oy[p]!);
    if (p === NP - 1) s[MIS] = e.random() < 0.25 ? 1 : 0;
  }
  /** How far a cell of plate p has printed: 0 (not reached) to 1 (solid). */
  const level = (p: number, c: number) => Math.max(0, Math.min(1, (pt[p]! - dist[p * CW * CH + c]! / SPEED) / FILL));
  const span = Math.hypot(SW, SH) / SPEED + FILL;

  function fresh() {
    s[COVER] = (s[COVER]! + 1) % COVERS.length;
    s[NEXT] = 0;
    s[DONE] = 0;
    s[MIS] = 0;
    pt.fill(-1);
    pd.fill(0);
  }

  engine.add({
    read() {
      title.read();
    },
    step(e, dt) {
      if (s[PEND]) (s[PEND] = 0), click(s[PX]!, s[PY]!, e);
      // On its own, once: the yellow plate, from the middle of the sheet.
      if (s[AUTO]! > 0 && (s[AUTO] = s[AUTO]! - dt) <= 0) click(SX + SW / 2, SY + SH / 2, e);
      let busy = s[AUTO]! > 0;
      for (let p = 0; p < NP; p++) {
        if (pt[p]! < 0 || pd[p]) continue;
        pt[p] = pt[p]! + dt;
        busy = true;
        if (pt[p]! > span + 0.25) pd[p] = 1;
      }
      if (pd[NP - 1] && !s[DONE]) (s[DONE] = 1), (s[PRINTS] = s[PRINTS]! + 1);
      // The title: hidden until the black plate's wave reaches each letter, then dots, then crisp.
      for (let i = 0; i < tn; i++) {
        let l = -1; // hidden
        if (pt[NP - 1]! >= 0) {
          const cx = Math.min(CW - 1, Math.max(0, ((title.x[i]! - SX) / CELL) | 0)), cy = Math.min(CH - 1, Math.max(0, ((title.y[i]! - SY) / CELL) | 0));
          const v = level(NP - 1, cy * CW + cx);
          l = v >= 1 ? 9 : Math.round(v * 8);
        }
        tl[i] = s[TITLE] ? 9 : l;
      }
      if (s[PULL]! >= 0) {
        s[PULL] = s[PULL]! + dt;
        busy = true;
        if (s[PULL]! >= 0.35 && s[NEXT]! >= NP) fresh();
        if (s[PULL]! >= 0.7) s[PULL] = -1;
      }
      s[TITLE] = 0;
      if (busy) (e.busy(), (s[DIRTY] = 1));
    },
    render() {
      // The title's letters: a dot mask while printing, nothing while unprinted, the page's own when crisp.
      for (let i = 0; i < tn; i++) {
        const el = title.els[i]!, l = tl[i]!;
        if (l === 9) (L.attr(el, "data-print", null), L.unstyle(el, "--d"));
        else (L.attr(el, "data-print", ""), L.style(el, "--d", l < 0 ? HIDDEN : D[l]!));
      }
      // The sheet's slide (out right, in from the left) carries the title with it.
      const sl = slide();
      if (titleEl) sl ? L.style(titleEl, "--slide", SLIDE[Math.round(sl * 10) + 20]!) : L.unstyle(titleEl, "--slide");
      if (!s[DIRTY]) return;
      s[DIRTY] = 0;
      draw(ctx, sl);
    },
  });
  /** The sheet's offset as a fraction of the bed (-1 off left … 1 off right). */
  function slide() {
    const t = s[PULL]!;
    if (t < 0) return 0;
    return t < 0.35 ? (t / 0.35) ** 2 * 1.1 : -1.1 * (1 - (t - 0.35) / 0.35) ** 2;
  }

  function draw(g: CanvasRenderingContext2D, sl: number) {
    g.drawImage(bed.canvas, 0, 0);
    // The ink column: each plate's swatch, lit once printed; the next one marked.
    for (let p = 0; p < NP; p++) {
      const y = 13 + p * 13, inked = pt[p]! >= 0;
      g.fillStyle = C.rim;
      g.fillRect(145, y - 1, 12, 10);
      g.fillStyle = inked ? INKS[p]! : C.line;
      g.fillRect(146, y, 10, 8);
      print(g, LABEL[p]!, 150, y + 2, inked ? (p === 3 ? C.ink : C.rim) : C.muted);
      if (s[NEXT] === p) (g.fillStyle = C.ink), g.fillRect(142, y + 2, 2, 4);
    }
    // Covers printed so far, as tally marks under the inks.
    g.fillStyle = C.ink;
    for (let i = 0; i < Math.min(5, s[PRINTS]!); i++) g.fillRect(146 + i * 2, 63, 1, 4);
    const x0 = Math.round(SX + sl * W), y0 = SY;
    // The sheet: paper, a shadow under it.
    g.fillStyle = C.rim;
    g.fillRect(x0 + 2, y0 + 2, SW, SH);
    g.fillStyle = C.ink;
    g.fillRect(x0, y0, SW, SH);
    const cov = covers[s[COVER]!]!;
    for (let p = 0; p < NP; p++) {
      if (pt[p]! < 0) continue;
      const t = pt[p]!, plate = cov.canvas[p]!, cv = cov.cover[p]!;
      // Register: a pixel out while the wave runs, then true (the black stays out on a misprint).
      const off = !pd[p] ? (((t * 12) | 0) & 1 ? 1 : -1) : p === NP - 1 && s[MIS] ? 2 : 0;
      const px = x0 + off, py = y0 + (p === NP - 1 && s[MIS] && pd[p] ? -1 : off > 0 ? 0 : off);
      if (pd[p]) {
        g.drawImage(plate, px, py);
        continue;
      }
      g.fillStyle = INKS[p]!;
      for (let c = 0; c < CW * CH; c++) {
        const k = cv[c]!;
        if (!k) continue;
        const v = level(p, c);
        if (v <= 0) continue;
        const cx = (c % CW) * CELL, cy = ((c / CW) | 0) * CELL;
        // Solid: the plate's own pixels. Not yet: a dot sized by the wave and the ink under it.
        if (v >= 1) g.drawImage(plate, cx, cy, CELL, CELL, px + cx, py + cy, CELL, CELL);
        else {
          const d = Math.max(1, Math.round(v * Math.sqrt(k / 16) * 4));
          g.fillRect(px + cx + ((CELL - d) >> 1), py + cy + ((CELL - d) >> 1), d, d);
        }
      }
    }
    // The stamp on a misprint.
    if (s[MIS] && pd[NP - 1]) {
      const w = textW("MISPRINT", 2) + 6, x = x0 + SW - w - 3, y = y0 + 42;
      g.fillStyle = C.attack;
      g.fillRect(x, y, w, 15);
      g.fillStyle = C.ink;
      g.fillRect(x + 1, y + 1, w - 2, 13);
      print(g, "MISPRINT", x + 3, y + 3, C.attack, 2);
    }
  }

  engine.start();
  return {
    engine,
    press: pressAt,
    /** Plates down on this sheet (0–4), and covers finished so far. */
    get plates() {
      return s[NEXT]!;
    },
    get prints() {
      return s[PRINTS]!;
    },
    /** The poster: the first cover, every plate down. */
    poster() {
      for (let p = 0; p < NP; p++) (pt[p] = span + 1), (pd[p] = 1);
      s[NEXT] = NP;
      s[DONE] = 1;
      s[AUTO] = -1;
      s[DIRTY] = 1;
    },
    destroy: () => engine.destroy(),
  };
}

const SLIDE = Array.from({ length: 41 }, (_, i) => `${(i - 20) * 10}%`);

/** The poster: see poster() (scripts/gallery-posters.mjs). */
export const posterAt = 0.1;

/** For `slot(fig, () => import("./halftone-press").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => press(stage, slot, first);
