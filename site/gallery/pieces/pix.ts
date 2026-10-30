// Shared by the three hand-built comic pieces (#20 POW BAM ZAP, #21 speed lines, #22 halftone):
// the brand colours, the art grid, a 3 × 5 pixel font for captions, a bold 7 × 9 font for comic
// sound effects, crisp lines and a crisp particle pool. All of it draws whole art pixels on a
// 160 × 90 canvas the browser scales up nearest-neighbour, so every edge stays sharp.
// Nothing here writes the page: each piece adds its canvas through its engine's ledger.
import type { Engine } from "../../../src/kernel/index";

/** Brand tokens (fizlet-engine brands/fizlet/style-guide.md). */
export const C = {
  rim: "#07060f",
  ink: "#f6f3ff",
  muted: "#aea4d6",
  line: "#3b3170",
  attack: "#ff2e88",
  aim: "#ff7389",
  sys: "#19f0ff",
  go: "#39ffb0",
  hurt: "#ffc21a",
  cmd: "#9a63ff",
  base: "#3f296a",
};

/** The art grid every piece draws on (16:9, like its figure). */
export const W = 160, H = 90;

/**
 * The art canvas: W × H pixels over `parent`, scaled up crisp. Added through the ledger. `front`:
 * a layer over the figure's real elements too (it never takes a pointer).
 */
export function artCanvas(engine: Engine, parent: HTMLElement, front = false) {
  const c = engine.ledger.add(document.createElement("canvas"));
  c.width = W;
  c.height = H;
  c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated${front ? ";z-index:2;pointer-events:none" : ""}`;
  if (front) c.setAttribute("aria-hidden", "true");
  parent.append(c);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** A detached canvas (baked art, plates): never on the page. */
export function offscreen(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return x;
}

// ---------- Fonts: glyph rows as bits, looked up by char code (no allocation when printing) ----------
const font = (w: number, h: number, src: Record<string, string>) => {
  const t: number[][] = [];
  for (const ch in src) {
    const s = src[ch]!.replace(/\s/g, ""), rows: number[] = [];
    for (let y = 0; y < h; y++) {
      let r = 0;
      for (let x = 0; x < w; x++) if (s[y * w + x] === "#") r |= 1 << (w - 1 - x);
      rows.push(r);
    }
    t[ch.charCodeAt(0)] = rows;
  }
  return t;
};

/** 3 × 5 caption font: A–Z, 0–9 and a little punctuation. */
const F3 = font(3, 5, {
  A: ".#. #.# ### #.# #.#", B: "##. #.# ##. #.# ##.", C: ".## #.. #.. #.. .##", D: "##. #.# #.# #.# ##.",
  E: "### #.. ##. #.. ###", F: "### #.. ##. #.. #..", G: ".## #.. #.# #.# .##", H: "#.# #.# ### #.# #.#",
  I: "### .#. .#. .#. ###", J: "..# ..# ..# #.# .#.", K: "#.# #.# ##. #.# #.#", L: "#.. #.. #.. #.. ###",
  M: "#.# ### ### #.# #.#", N: "##. #.# #.# #.# #.#", O: ".#. #.# #.# #.# .#.", P: "##. #.# ##. #.. #..",
  Q: ".#. #.# #.# ##. .##", R: "##. #.# ##. #.# #.#", S: ".## #.. .#. ..# ##.", T: "### .#. .#. .#. .#.",
  U: "#.# #.# #.# #.# ###", V: "#.# #.# #.# #.# .#.", W: "#.# #.# ### ### #.#", X: "#.# #.# .#. #.# #.#",
  Y: "#.# #.# .#. .#. .#.", Z: "### ..# .#. #.. ###",
  0: "### #.# #.# #.# ###", 1: ".#. ##. .#. .#. ###", 2: "##. ..# .#. #.. ###", 3: "##. ..# .#. ..# ##.",
  4: "#.# #.# ### ..# ..#", 5: "### #.. ##. ..# ##.", 6: ".## #.. ### #.# ###", 7: "### ..# .#. .#. .#.",
  8: "### #.# ### #.# ###", 9: "### #.# ### ..# ##.",
  ".": "... ... ... ... .#.", ",": "... ... ... .#. #..", "!": ".#. .#. .#. ... .#.", "-": "... ... ### ... ...",
  "'": ".#. .#. ... ... ...", "?": "##. ..# .#. ... .#.", "/": "..# ..# .#. #.. #..", "#": "#.# ### #.# ### #.#",
});

/** 7 × 9 sound-effect font, two-pixel strokes: just the letters the pieces shout. */
const F7 = font(7, 9, {
  P: "######. ####### ##...## ##...## ####### ######. ##..... ##..... ##.....",
  O: ".#####. ####### ##...## ##...## ##...## ##...## ##...## ####### .#####.",
  W: "##...## ##...## ##...## ##.#.## ##.#.## ####### ####### ###.### ##...##",
  B: "######. ####### ##...## ######. ######. ##...## ##...## ####### ######.",
  A: ".#####. ####### ##...## ##...## ####### ####### ##...## ##...## ##...##",
  M: "##...## ###.### ####### ##.#.## ##.#.## ##...## ##...## ##...## ##...##",
  Z: "####### ####### ....### ...###. ..###.. .###... ###.... ####### #######",
  "!": "..##... ..##... ..##... ..##... ..##... ..##... ....... ..##... ..##...",
  H: "##...## ##...## ##...## ####### ####### ##...## ##...## ##...## ##...##",
  S: ".###### ####### ##..... ######. .###### .....## .....## ####### ######.",
  U: "##...## ##...## ##...## ##...## ##...## ##...## ##...## ####### .#####.",
  K: "##...## ##..### ##.###. #####.. ####... #####.. ##.###. ##..### ##...##",
  ".": "....... ....... ....... ....... ....... ....... ....... ..##... ..##...",
  T: "####### ####### ..###.. ..###.. ..###.. ..###.. ..###.. ..###.. ..###..",
  R: "######. ####### ##...## ##...## ######. #####.. ##.###. ##..### ##...##",
  I: "####### ####### ..###.. ..###.. ..###.. ..###.. ..###.. ####### #######",
  E: "####### ####### ##..... ######. ######. ##..... ##..... ####### #######",
});

/** Width in art pixels of `s` in the caption font (k: pixels per font pixel). */
export const textW = (s: string, k = 1) => (s.length * 4 - 1) * k;

/** Print `s` in the 3 × 5 font, top left at (x, y). */
export function print(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, k = 1) {
  ctx.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = F3[s.charCodeAt(i)];
    if (g) for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r]! & (4 >> b)) ctx.fillRect(x + (i * 4 + b) * k, y + r * k, k, k);
  }
}

/** One 7 × 9 glyph in the current fillStyle, top left at (x, y). */
function glyph(ctx: CanvasRenderingContext2D, code: number, x: number, y: number, k: number) {
  const g = F7[code];
  if (g) for (let r = 0; r < 9; r++) for (let b = 0; b < 7; b++) if (g[r]! & (64 >> b)) ctx.fillRect(x + b * k, y + r * k, k, k);
}

/** Width of a sound effect in the 7 × 9 font, with its one-pixel tracking. */
export const sfxW = (s: string, k = 1) => (s.length * 8 - 1) * k;

/**
 * Comic lettering: `s` in the 7 × 9 font, each letter bounced up or down a little (`bounce`, art
 * px per letter), with a dark rim, a two-pixel extrude in `drop`, and the face in `fill`. Bake it
 * once; it draws a few hundred rects.
 */
export function sfx(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string, drop: string, rim: string, bounce: readonly number[] = [0], k = 1) {
  const at = (i: number) => x + i * 8 * k, dy = (i: number) => (bounce[i % bounce.length] ?? 0) * k;
  ctx.fillStyle = rim;
  for (let i = 0; i < s.length; i++)
    for (let ox = -1; ox <= 3; ox++) for (let oy = -1; oy <= 3; oy++) glyph(ctx, s.charCodeAt(i), at(i) + ox * k, y + dy(i) + oy * k, k);
  ctx.fillStyle = drop;
  for (let i = 0; i < s.length; i++) for (let d = 2; d >= 1; d--) glyph(ctx, s.charCodeAt(i), at(i) + d * k, y + dy(i) + d * k, k);
  ctx.fillStyle = fill;
  for (let i = 0; i < s.length; i++) glyph(ctx, s.charCodeAt(i), at(i), y + dy(i), k);
}

/** A crisp one-pixel line (Bresenham), in the current fillStyle. */
export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 400; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) (e += dy), (x0 += sx);
    if (e2 <= dx) (e += dx), (y0 += sy);
  }
}

/**
 * A crisp particle pool: square bits (1–3 art px) that fly, fall and stop at a floor. Fixed typed
 * arrays: spawning and stepping never allocate; drawing snaps every bit to whole pixels.
 */
export function bits(cap: number, colors: readonly string[]) {
  const X = new Float32Array(cap), Y = new Float32Array(cap), VX = new Float32Array(cap), VY = new Float32Array(cap), L = new Float32Array(cap);
  const S = new Uint8Array(cap), K = new Uint8Array(cap);
  const n = new Float64Array(1);
  return {
    get live() {
      return n[0]!;
    },
    spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: number) {
      const i = n[0]!;
      if (i >= cap) return;
      X[i] = x;
      Y[i] = y;
      VX[i] = vx;
      VY[i] = vy;
      L[i] = life;
      S[i] = size;
      K[i] = color;
      n[0] = i + 1;
    },
    /** Move every bit; gravity in art px/s²; a bit that reaches `floor` stops there and fades. */
    step(dt: number, gravity: number, floor: number) {
      let m = n[0]!;
      for (let i = m - 1; i >= 0; i--) {
        if ((L[i] = L[i]! - dt) <= 0) {
          m--;
          X[i] = X[m]!, Y[i] = Y[m]!, VX[i] = VX[m]!, VY[i] = VY[m]!, L[i] = L[m]!, S[i] = S[m]!, K[i] = K[m]!;
          continue;
        }
        VY[i] = VY[i]! + gravity * dt;
        X[i] = X[i]! + VX[i]! * dt;
        Y[i] = Y[i]! + VY[i]! * dt;
        if (Y[i]! > floor) (Y[i] = floor), (VY[i] = 0), (VX[i] = VX[i]! * 0.6);
      }
      n[0] = m;
    },
    draw(ctx: CanvasRenderingContext2D, ox = 0, oy = 0) {
      for (let i = 0; i < n[0]!; i++) {
        ctx.fillStyle = colors[K[i]!]!;
        ctx.fillRect(Math.round(X[i]! + ox), Math.round(Y[i]! - S[i]! + oy), S[i]!, S[i]!);
      }
    },
    clear() {
      n[0] = 0;
    },
  };
}
