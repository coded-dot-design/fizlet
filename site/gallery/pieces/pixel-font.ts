// A 3 × 5 pixel font for the hand-built canvas pieces (HUDs, sound effects, speech): each glyph is
// 15 bits (rows top down, 3 bits each) in base 36. Whole canvas pixels only, so it stays crisp on a
// pixel canvas scaled up with CSS. Shared by KRUNCH (./krunch.ts) and the space pup (./space-pup.ts).
const F: Record<string, number> = {};
"0:odr 1:8t3 2:jhj 3:jgu 4:i4p 5:o0e 6:bfz 7:mmq 8:ohb 9:oge A:8od B:l9q C:bab D:l7y E:o13 F:o10 G:bcb H:i5p I:n13 J:3my K:i3x L:eg7 M:iy5 N:l7x O:8kq P:l9g Q:8kz R:l9p S:b66 T:n0y U:i27 V:i22 W:i65 X:hwt Y:hw2 Z:mnb !:77m %:gbp ?:mo2 .:2 ':740 -:cg"
  .split(" ").forEach((g) => (F[g[0]!] = parseInt(g.slice(2), 36)));

/** Width of `s` in the font at `k` px per font pixel. */
export const textW = (s: string, k = 1) => (s.length * 4 - 1) * k;

/** Print `s` (A–Z, 0–9, ! % ? . ' -) top left at (x, y) in `color`; each font pixel is k wide, `tall` high. */
export function print(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, k = 1, tall = k) {
  g.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const b = F[s[i]!] ?? 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (b & (1 << (14 - r * 3 - c))) g.fillRect(x + (i * 4 + c) * k, y + r * tall, k, tall);
  }
}

/** A shout: comic lettering centred on x (a `rim`, a drop in `ext` down and right, the face), tall letters. */
export function shout(g: CanvasRenderingContext2D, s: string, x: number, y: number, k: number, face: string, ext: string, rim: string) {
  x = Math.round(x - textW(s, k) / 2);
  y = Math.round(y);
  const t = k + (k >> 1);
  for (let o = 0; o < 16; o++) print(g, s, x + (o & 3) - 1, y + (o >> 2) - 1, rim, k, t);
  print(g, s, x + 1, y + 1, ext, k, t);
  print(g, s, x, y, face, k, t);
}
