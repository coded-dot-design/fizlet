// The pixel type of the hand-built fight pieces (KRUNCH's SMASH and the hammer, HUSH vs SNOOZE, the
// laser-sword duel): the brand tokens and a 3 × 5 pixel font with a shout style (rim, extrude, a
// lean) for HUDs and sound effects. Its own module so a piece that only needs the lettering doesn't
// ship KRUNCH's sprites. Whole pixels only, so it stays crisp on a pixel canvas scaled up with CSS.

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
  red: "#ff2b4e",
};

// ---------- A 3 × 5 font: each glyph 15 bits (rows top down, 3 bits each), base 36 ----------
const F: Record<string, number> = {};
"0:odr 1:8t3 2:jhj 3:jgu 4:i4p 5:o0e 6:bfz 7:mmq 8:ohb 9:oge A:8od B:l9q C:bab D:l7y E:o13 F:o10 G:bcb H:i5p I:n13 K:i3x L:eg7 M:iy5 N:l7x O:8kq P:l9g R:l9p S:b66 T:n0y U:i27 V:i22 W:i65 Y:hw2 !:77m %:gbp J:3my Q:8kz X:hwt Z:mnb ?:mo2 .:2 -:cg ':740"
  .split(" ").forEach((g) => (F[g[0]!] = parseInt(g.slice(2), 36)));

/** Width of `s` in the font at `k` px per font pixel. */
export const textW = (s: string, k = 1) => (s.length * 4 - 1) * k;

/** Print `s` (A–Z, 0–9 and ! % ? . - ') top left at (x, y) in `color`; each font pixel is k wide, `tall` high. */
export function print(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, k = 1, tall = k) {
  g.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const b = F[s[i]!] ?? 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (b & (1 << (14 - r * 3 - c))) g.fillRect(x + (i * 4 + c) * k, y + r * tall, k, tall);
  }
}

/** A shout: comic lettering centred on x (a rim, a drop in `ext` down and right, the face), tall letters. */
export function shout(g: CanvasRenderingContext2D, s: string, x: number, y: number, k: number, face: string, ext: string) {
  x = Math.round(x - textW(s, k) / 2);
  y = Math.round(y);
  const t = k + (k >> 1);
  for (let o = 0; o < 16; o++) print(g, s, x + (o & 3) - 1, y + (o >> 2) - 1, C.rim, k, t);
  print(g, s, x + 1, y + 1, ext, k, t);
  print(g, s, x, y, face, k, t);
}

/** A speech bubble (ink on a rimmed card, a tail down to x) above (x, y), kept inside a 160-wide grid. */
export function bubble(g: CanvasRenderingContext2D, s: string, x: number, y: number) {
  const w = textW(s) + 4, bx = Math.round(Math.max(2, Math.min(158 - w, x - w / 2)));
  g.fillStyle = C.rim;
  g.fillRect(bx - 1, y - 1, w + 2, 9);
  g.fillStyle = C.ink;
  g.fillRect(bx, y, w, 7);
  g.fillRect(Math.round(x), y + 7, 2, 2);
  print(g, s, bx + 2, y + 1, C.rim);
}
