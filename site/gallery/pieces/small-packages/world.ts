// Big things, small packages: the world and its art. A pixel dev drags a package.json crate with
// dependencies stacked on it; cut them all and it shrinks to the Fizlet box. Everything is drawn as
// palette indices into one W x H buffer (no anti-aliasing, every colour a Board UI token or a mix
// of two), so the live scene (./scene) and the build-time posters (./poster) paint the same world.
// No DOM here: the posters run it in Node.

export const W = 192, H = 108, FLOOR = 96, HORIZON = 70;
/** The package.json crate: left, width, height (it stands on the floor). */
export const CX = 104, CW = 64, CH = 22;
/** A dependency block's height; the stack's most; the dev's left edge. */
export const BH = 11, MAXB = 12, DX = 30;
export const SHARDS = 220, POPS = 6;

// ---------- Colour: Board UI tokens (src/ui/tokens.json), dark then light ----------
const RIM = "#07060f";
/** a mixed into b by t (the tokens' color-mix(in srgb, a t, b)). */
const mix = (a: string, b: string, t: number) =>
  "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, "0")).join("");
// Neon faces (the same in both themes): cmd, attack, advance, fallin, go, hurt, sys, fire.
const FACES = ["#9a63ff", "#ff2e88", "#ff8a1f", "#a8ff3e", "#39ffb0", "#ffc21a", "#19f0ff", "#ff2b4e"];
const theme = (bg: string, floor: string, line: string, ink: string, muted: string, sysInk: string, grid: string) => [
  bg, mix(grid, bg, 0.09), floor, line, RIM, ink, muted, "#f6f3ff", sysInk, mix("#9a63ff", RIM, 0.8), mix("#9a63ff", RIM, 0.5),
  ...FACES, ...FACES.map((f) => mix(f, RIM, 0.45)), // the key edge: color-mix(var(--c) 45%, var(--rim))
];
/** Palette index → colour. 0 bg · 1 wall grid · 2 floor · 3 floor line · 4 rim · 5 ink · 6 muted ·
 *  7 flag · 8 sys ink · 9 cmd deep · 10 cmd base · 11–18 faces · 19–26 their edges. */
export const DARK = theme("#0b0918", "#110d22", "#3b3170", "#f6f3ff", "#aea4d6", "#19f0ff", "#19f0ff");
export const LIGHT = theme("#f6f5fd", "#e6e4f8", "#b9b2e3", "#1b1636", "#5d5684", "#006e91", "#9a63ff");
const BG = 0, WALL = 1, FLOORC = 2, LINE = 3, R = 4, INK = 5, MUTED = 6, FLAG = 7, SYSINK = 8, DEEP = 9, BASE = 10;
export const FACE = 11, EDGE = 19;
export const HOODIE = 6, GO = 4, ROPE = 5; // indices into FACES

// ---------- Text: a 3 x 5 pixel font ----------
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.,";
const GLYPH = "odr,8t3,mw7,mvj,i4p,o27,o33,mky,ohb,ogf,oh9,l9q,nxj,l7y,o13,o10,nzj,i5p,n13,3n3,i3x,eg7,iy5,l7x,odr,oh0,oe1,l9p,o27,n0y,i27,i22,i65,hwt,i4y,mnb,cg,2,k"
  .split(",").map((s) => parseInt(s, 36));
/** The dependencies (made-up names, the joke kind): each block wears one. */
export const NAMES = ["PAD-LEFT", "IS-ODD", "IS-EVEN", "IS-TRUE", "ADD-ONE", "NOOP", "POLYFILL", "UTILS", "HELPERS", "SHIM", "DEEP-COPY", "TO-ARRAY", "ONCE", "COLORS"];
/** A block's width for name k: the label plus a rim and two pixels each side. */
export const bw = (k: number) => NAMES[k]!.length * 4 + 5;

// ---------- The captions (the live scene's and the posters') ----------
export const SAY = [
  ["Some people say size doesn’t matter…", ""],
  ["…but those people are usually dragging around a huge package.json.", "Tap a dependency to cut it."],
  ["We keep our packages as small as possible. Big things come in small packages.", ""],
];
/** The caption's look (the live scene's inline style and the posters' rule; Board UI tokens). */
export const CAPTION = "position:absolute;left:3%;top:5%;max-width:46%;margin:0;padding:.45em .65em;border:2px solid var(--rim,#07060f);border-radius:8px;" +
  "box-shadow:0 3px 0 var(--rim,#07060f);background:var(--surface,#110d22);color:var(--ink,#f6f3ff);font:700 1em/1.25 var(--sans,system-ui,sans-serif);pointer-events:none";
export const CAPTION_SMALL = "display:block;margin-top:.35em;font:700 .8em/1.3 var(--mono,monospace);color:var(--k-sys-ink,#19f0ff)";
/** The still's caption: the setup in one line. */
export const SETUP = "Some people say size doesn’t matter, but those people are usually dragging around a huge package.json…";
/** The punchline's number: the kernel's gzip bytes, measured at build (never typed). */
export const kernelLine = (bytes: number) => `Fizlet kernel: ${bytes.toLocaleString("en-US")} B gzip, 0 runtime dependencies`;

// ---------- The dev: rows of characters (r rim, f face, h hoodie, e hoodie edge, p pants) ----------
const TOP = ["...rrrrr...", "..rrrrrrr..", ".rrffffrrr.", ".rfrffffrr.", ".rffffffr..", "..rffffr...", "..rhhhhhrr.", ".rhhhhhhhhr", "rffhhhhhhhr", "rrrhhhhhhr.", "...rhhhhhr.", "...reeeeer."];
const PULL = [TOP.concat("...rpprppr.", "..rppr.rppr", ".rppr...rpr", ".rrrr...rrr"), TOP.concat("...rpprppr.", "...rpprpr..", "...rpprpr..", "..rrrrrrr..")];
const HOLD = ["rr.......rr", "rfr.....rfr", "rhr.rrr.rhr", "rhrrrrrrrhr", "rhrfffffrhr", "rhrfrfrfrhr", "rhrfffffrhr", ".rhrfffrhr.", "..rhhhhhr..", ".rhhhhhhhr.", ".rhhhhhhhr.", ".rhhhhhhhr.", ".reeeeeeer.", "..rpppppr..", "..rppprppr.", "..rppr.rppr", "..rppr.rppr", ".rrrr.rrrr."];
const INKOF: Record<string, number> = { r: R, f: FLAG, h: FACE + HOODIE, e: EDGE + HOODIE, p: BASE };
/** A sprite: palette indices, 255 clear. */
const sprite = (rows: string[]) => Uint8Array.from(rows.join(""), (c) => INKOF[c] ?? 255);
const SPR = [sprite(PULL[0]!), sprite(PULL[1]!), sprite(HOLD)];
const SW = 11;

// ---------- The world: plain numbers in typed arrays ----------
/** Scalars, by name. */
export const enum K {
  /** 0 play · 1 shrink · 2 fly · 3 done. */
  Phase, T, Scroll, Walk, Squash, Box, BoxX, BoxY, Glow, Supply, Spawn, Idle, Say, Time, Dirty, Yank, Pose,
}
export interface World {
  S: Float32Array;
  /** Blocks, bottom to top: count in n[0]; left x, top y, fall speed, name, face. */
  n: Uint8Array;
  bx: Float32Array; by: Float32Array; bv: Float32Array; bk: Uint8Array; bc: Uint8Array;
  /** Shards: x, y, vx, vy, life; colour; size. */
  px: Float32Array; py: Float32Array; vx: Float32Array; vy: Float32Array; pl: Float32Array; pc: Uint8Array; ps: Uint8Array;
  /** Pops (a cut dependency's name floats up): x, y, life, name. */
  ox: Float32Array; oy: Float32Array; ol: Float32Array; ok: Uint8Array;
  /** The picture: one palette index a pixel. */
  buf: Uint8Array;
  /** The size on the box ("3,439 B GZIP"), from the build; "" without one. */
  label: string;
}
export function world(): World {
  const f = (n: number) => new Float32Array(n), u = (n: number) => new Uint8Array(n);
  return { S: f(20), n: u(1), bx: f(MAXB), by: f(MAXB), bv: f(MAXB), bk: u(MAXB), bc: u(MAXB),
    px: f(SHARDS), py: f(SHARDS), vx: f(SHARDS), vy: f(SHARDS), pl: f(SHARDS), pc: u(SHARDS), ps: u(SHARDS),
    ox: f(POPS), oy: f(POPS), ol: f(POPS), ok: u(POPS), buf: u(W * H), label: "" };
}
/** Where block i rests: on the block below, or on the crate. */
export const restOf = (w: World, i: number) => (i ? w.by[i - 1]! : FLOOR - CH + w.S[K.Squash]!) - BH;
/** Put a block with name k on top of the stack (at y, or resting when y is NaN). */
export function addBlock(w: World, k: number, x: number, y: number) {
  const i = w.n[0]!;
  if (i >= MAXB) return;
  w.n[0] = i + 1;
  w.bk[i] = k;
  w.bc[i] = (k * 3) % 8 === HOODIE ? 0 : (k * 3) % 8; // never the dev's own colour
  w.bx[i] = Math.round(CX + CW / 2 - bw(k) / 2 + x);
  w.by[i] = y === y ? y : restOf(w, i);
  w.bv[i] = 0;
}

// ---------- Painting ----------
function fill(b: Uint8Array, x: number, y: number, w: number, h: number, c: number) {
  const x0 = Math.max(0, x | 0), x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let j = Math.max(0, y | 0); j < y1; j++) b.fill(c, j * W + x0, j * W + x1);
}
const dot = (b: Uint8Array, x: number, y: number, c: number) => fill(b, x, y, 1, 1, c);
/** A Board UI key in pixels: ink rim, the face, a hard base below it (b rows). */
function key(b: Uint8Array, x: number, y: number, w: number, h: number, face: number, edge: number, base: number) {
  fill(b, x, y, w, h, R);
  fill(b, x + 1, y + 1, w - 2, h - 2, edge);
  fill(b, x + 1, y + 1, w - 2, h - 2 - base, face);
}
/** Text in the pixel font, top left at (x, y). Only the glyphs in CHARS; anything else is a space. */
export function text(b: Uint8Array, s: string, x: number, y: number, c: number) {
  for (let i = 0; i < s.length; i++, x += 4) {
    const g = GLYPH[CHARS.indexOf(s[i]!)] ?? 0;
    for (let p = 0; p < 15; p++) if (g & (1 << (14 - p))) dot(b, x + (p % 3), y + ((p / 3) | 0), c);
  }
}
function blit(b: Uint8Array, s: Uint8Array, x: number, y: number) {
  for (let i = 0; i < s.length; i++) if (s[i]! < 255) dot(b, x + (i % SW), y + ((i / SW) | 0), s[i]!);
}
function line(b: Uint8Array, x0: number, y0: number, x1: number, y1: number, c: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) | 0;
  for (let i = 0; i <= n; i++) dot(b, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
}
const ease = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2; // out, with a little overshoot

/** Paint the whole picture into w.buf. */
export function paint(w: World) {
  const b = w.buf, S = w.S, n = w.n[0]!, ph = S[K.Phase]!, scroll = S[K.Scroll]!;
  // The arena: a back wall on a faint grid, the horizon lit, a floor in perspective that slides
  // under the dev as he pulls.
  fill(b, 0, 0, W, HORIZON, BG);
  for (let x = 6; x < W; x += 12) fill(b, x, 0, 1, HORIZON, WALL);
  for (let y = 4; y < HORIZON; y += 12) fill(b, 0, y, W, 1, WALL);
  fill(b, 0, HORIZON, W, H - HORIZON, FLOORC);
  fill(b, 0, HORIZON, W, 1, SYSINK);
  for (let i = 1, y = HORIZON; i < 7; i++) fill(b, 0, (y += i * 1.6) | 0, W, 1, LINE);
  for (let i = -6; i < 14; i++) {
    const xb = i * 28 + (scroll % 28);
    line(b, W / 2 + (xb - W / 2) * 0.3, HORIZON + 1, xb, H, LINE);
  }

  // The crate, morphing into the Fizlet box as it shrinks.
  const k = ph === 1 ? ease(Math.min(1, S[K.T]! / 0.55)) : ph > 1 ? 1 : 0;
  const sq = S[K.Squash]!;
  if (ph < 2) {
    const cw = Math.round(CW + (11 - CW) * k), ch = Math.round(CH - sq + (11 - CH) * k), x = Math.round(CX + (CW - cw) / 2);
    fill(b, x + 2, FLOOR, cw - 4, 1, LINE); // its shadow
    if (k < 0.5) {
      key(b, x, FLOOR - ch, cw, ch, DEEP, BASE, 4);
      for (let y = FLOOR - ch + 6; y < FLOOR - 5; y += 5) fill(b, x + 1, y, cw - 2, 1, BASE); // planks
      fill(b, x + 4, FLOOR - 3, 4, 3, R), fill(b, x + cw - 8, FLOOR - 3, 4, 3, R); // skids
      if (k < 0.15) key(b, x + 5, FLOOR - ch + 4, cw - 10, 9, FLAG, MUTED, 1), text(b, "PACKAGE.JSON", x + 8, FLOOR - ch + 6, R);
    } else key(b, x, FLOOR - ch, cw, ch, FACE + GO, EDGE + GO, Math.max(2, ch >> 2));
  }
  // The stack.
  for (let i = 0; i < n; i++) {
    const c = w.bc[i]!, x = w.bx[i]!, y = Math.round(w.by[i]!);
    key(b, x, y, bw(w.bk[i]!), BH, FACE + c, EDGE + c, 2);
    text(b, NAMES[w.bk[i]!]!, x + 3, y + 2, R);
  }
  // The dev, and the rope from his shoulder to the crate (it sags less the harder he pulls).
  const top = FLOOR - 16 - (ph >= 2 ? 2 : 0), dx = DX - Math.round(S[K.Yank]!);
  if (ph < 2) {
    const sag = 2 + (n < 3 ? 2 : 0);
    line(b, dx + 9, top + 7, (dx + 9 + CX) / 2, FLOOR - 9 + sag, FACE + ROPE);
    line(b, (dx + 9 + CX) / 2, FLOOR - 9 + sag, CX, FLOOR - 12, FACE + ROPE);
  }
  blit(b, SPR[ph >= 2 ? 2 : S[K.Walk]! & 1]!, dx, top);
  if (ph < 2 && n > 4 && (S[K.Time]! * 3) % 2 < 1.2) dot(b, dx - 1, top + 2, SYSINK), fill(b, dx - 2, top + 3, 3, 2, SYSINK); // sweat
  // The Fizlet box: flying to his hands, then held up in its glow.
  if (ph >= 2) {
    const x = Math.round(S[K.BoxX]! - 5), y = Math.round(S[K.BoxY]! - 11), g = S[K.Glow]!;
    if (ph === 3) {
      const r = 10 + Math.round(g * 3);
      for (let a = 0; a < 24; a++) dot(b, x + 5 + Math.round(Math.cos(a * 0.2618) * r), y + 5 + Math.round(Math.sin(a * 0.2618) * r), a & 1 ? FACE + GO : SYSINK);
    }
    key(b, x, y, 11, 11, FACE + GO, EDGE + GO, 3);
    fill(b, x + 4, y + 2, 3, 1, R), fill(b, x + 4, y + 3, 1, 4, R), fill(b, x + 5, y + 4, 1, 1, R); // an F
    // Its size, measured at build, on a sticker beside it once it is in his hands.
    if (ph === 3 && w.label) key(b, x + 17, y + 1, w.label.length * 4 + 5, 9, FLAG, MUTED, 1), text(b, w.label, x + 20, y + 3, R);
  }
  // Shards and pops on top.
  for (let i = 0; i < SHARDS; i++) if (w.pl[i]! > 0.35 || (w.pl[i]! > 0 && (w.pl[i]! * 16) & 1)) fill(b, w.px[i]!, w.py[i]!, w.ps[i]!, w.ps[i]!, w.pc[i]!);
  for (let i = 0; i < POPS; i++) if (w.ol[i]! > 0 && (w.ol[i]! > 0.3 || (S[K.Time]! * 20) & 1)) {
    const s = NAMES[w.ok[i]!]!, x = Math.round(w.ox[i]! - s.length * 2), y = Math.max(15, Math.round(w.oy[i]!));
    text(b, "-", x - 4, y, FACE + 7), text(b, s, x, y, INK);
  }
  // HUD on top: corner brackets and the dependency count.
  for (let i = 0; i < 4; i++) {
    const x = i & 1 ? W - 8 : 2, y = i & 2 ? H - 3 : 2;
    fill(b, x, y, 6, 1, SYSINK), fill(b, i & 1 ? x + 5 : x, i & 2 ? y - 5 : y, 1, 6, SYSINK);
  }
  const deps = n + S[K.Supply]!;
  fill(b, W - 34, 4, 30, 9, BG);
  text(b, "DEPS", W - 31, 6, MUTED);
  for (let v = deps, x = W - 9; x === W - 9 || v > 0; v = (v / 10) | 0, x -= 4) text(b, CHARS[v % 10]!, x, 6, deps ? INK : FACE + GO);
}
