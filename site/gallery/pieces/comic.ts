// Comic lettering for the heroes pieces, as pixels: chunky 7 × 7 letters with two-pixel strokes, a
// rim, a coloured extrude down and right, a highlight along the top, and an italic lean. A word is
// compiled once into a flat list of pixels; drawing it is fillRects only (no text, no allocation).
const G: Record<string, string[]> = {
  W: ["11...11", "11...11", "11.1.11", "11.1.11", "1111111", "111.111", "11...11"],
  H: ["11...11", "11...11", "11...11", "1111111", "11...11", "11...11", "11...11"],
  O: [".11111.", "11...11", "11...11", "11...11", "11...11", "11...11", ".11111."],
  S: [".111111", "11.....", "11.....", ".11111.", ".....11", ".....11", "111111."],
  B: ["111111.", "11...11", "11...11", "111111.", "11...11", "11...11", "111111."],
  N: ["11...11", "111..11", "1111.11", "11.1111", "11..111", "11...11", "11...11"],
  K: ["11..11.", "11.11..", "1111...", "111....", "1111...", "11.11..", "11..11."],
  M: ["11...11", "111.111", "1111111", "11.1.11", "11...11", "11...11", "11...11"],
  R: ["111111.", "11...11", "11...11", "111111.", "11.11..", "11..11.", "11...11"],
  A: [".11111.", "11...11", "11...11", "1111111", "11...11", "11...11", "11...11"],
  "!": ["11", "11", "11", "11", "11", "..", "11"],
};

/** A compiled word: [letter, x, y] per lit pixel (x already advanced), and its width. */
export interface Word {
  px: Int16Array;
  w: number;
  n: number;
}
export function word(text: string): Word {
  const out: number[] = [];
  let x = 0;
  [...text].forEach((ch, i) => {
    const g = G[ch]!;
    g.forEach((r, y) => [...r].forEach((c, cx) => c === "1" && out.push(i, x + cx, y)));
    x += g[0]!.length + 1;
  });
  return { px: Int16Array.from(out), w: x - 1, n: text.length };
}

/**
 * Draw the first `shown` letters of `wd` with its top left at (x, y) in art px. The newest letter
 * sits `pop` px up and left (it slams in). `face`, `ext`: the letter and its extrude.
 */
export function drawWord(ctx: CanvasRenderingContext2D, wd: Word, x: number, y: number, shown: number, pop: number, face: string, ext: string, rim: string, light: string) {
  const p = wd.px;
  x = Math.round(x);
  y = Math.round(y);
  for (let pass = 0; pass < 4; pass++) {
    ctx.fillStyle = pass === 0 ? rim : pass === 1 ? ext : pass === 2 ? face : light;
    for (let q = 0; q < p.length; q += 3) {
      const i = p[q]!, row = p[q + 2]!;
      if (i >= shown) continue;
      const o = i === shown - 1 ? pop : 0, px = x + p[q + 1]! + (3 - (row >> 1)) - o, py = y + row - o;
      if (pass === 0) ctx.fillRect(px - 1, py - 1, 4, 4);
      else if (pass === 1) ctx.fillRect(px + 1, py + 1, 1, 1);
      else if (pass === 2) ctx.fillRect(px, py, 1, 1);
      else if (row === 0) ctx.fillRect(px, py, 1, 1);
    }
  }
}
