// The skater (skate-sesh): one grown-up pixel character on a board, for any side-on skate piece
// (Two-Minute Sesh; Boardwalk Run next). Hard-edged pixel art on a 20 × 31 grid, a one-pixel ink
// outline traced around every frame, a limited palette: a backward cap (no hair), a tee, baggy
// pants, skate shoes. Frames: roll, push, air, grab, grind, manual (and a slam, which tumbles the
// roll frame). The board is pixels too: it flips (kick, heel, tre, a double for a special) and
// glows when told.
//
//   const sk = skater(g)               g: the piece's 2D context (art units)
//   sk.paint(cols)                     the palette (SK_* slots), once and after a theme change
//   P = sk.P                           the pose, numbers only (slots below): set them, then
//   sk.draw()                          draws at P[X], P[Y] (the board's wheels on that point)
//
// Each frame is drawn once into its own small canvas (on paint); draw() is a few drawImage and
// fillRect calls with smoothing off, no strings, no allocation.

/** Palette slots for paint(): outline, skin, cap, tee, tee shade, pants, pants shade, shoes, deck, the board's underside, glow. */
export const SK_INK = 0, SK_SKIN = 1, SK_CAP = 2, SK_TEE = 3, SK_TEE2 = 4, SK_PANTS = 5, SK_PANTS2 = 6, SK_SHOE = 7, SK_DECK = 8, SK_UNDER = 9, SK_GLOW = 10;
/** Frames (P[POSE]). */
export const SK_ROLL = 0, SK_PUSH = 1, SK_AIR = 2, SK_GRAB = 3, SK_GRIND = 4, SK_MANUAL = 5, SK_SLAM = 6;
/** Pose slots: x, y (wheels, art units), facing (−1..1: a 180 passes through 0), scale (art units
 *  per pixel), frame, tilt (rad, the floor's slope), board flip (0..1 of a turn), flip kind
 *  (0 kick, 1 heel, 2 tre, 3 double), slam time (s), glow (0 / 1), spin (rad, the whole rider). */
export const X = 0, Y = 1, FACE = 2, SCALE = 3, POSE = 4, TILT = 5, FLIP = 6, KIND = 7, SLAM = 8, GLOW = 9, SPIN = 10;

const GW = 20, GH = 31, TAU = 6.2832;
// Each frame, in grid pixels (facing right; the board's centre at x 10, the floor at row 30): hip y, torso x shift, then the back
// and front leg (knee x, y, foot x, y), the back and front hand (x, y), the board's y.
const FR = [
  [16, 0, 7, 20, 6, 25, 13, 20, 13, 25, 5, 15, 15, 15, 26], // roll: a loose crouch
  [16, 0, 3, 24, 0, 30, 12, 20, 12, 25, 4, 13, 15, 14, 26], // push: the back foot down on the ground
  [15, 0, 5, 18, 7, 22, 14, 18, 13, 22, 3, 10, 17, 11, 23], // air: knees up, arms out
  [16, 1, 6, 19, 7, 23, 14, 19, 13, 23, 4, 10, 13, 22, 24], // grab: the front hand down on the board
  [17, 0, 6, 21, 6, 25, 14, 21, 13, 25, 2, 12, 17, 12, 26], // grind: low, arms wide for balance
  [16, -1, 6, 20, 6, 25, 13, 21, 14, 25, 3, 9, 15, 10, 26], // manual: leaning back, arms up
];

export function skater(g: CanvasRenderingContext2D) {
  const P = new Float64Array(11);
  (P[FACE] = 1), (P[SCALE] = 0.72);
  const frames = FR.map(() => document.createElement("canvas"));
  const col: string[] = [];
  const px = new Uint8Array(GW * GH);

  /** Draw each frame into its canvas with the palette. */
  function paint(cols: readonly string[]) {
    col.length = 0;
    col.push(...cols);
    FR.forEach((f, n) => {
      px.fill(255);
      const [hip, dx, bkx, bky, bfx, bfy, fkx, fky, ffx, ffy, bhx, bhy, fhx, fhy] = f as number[];
      const set = (x: number, y: number, c: number) => x >= 0 && x < GW && y >= 0 && y < GH && (px[y * GW + x] = c);
      const box = (x: number, y: number, w: number, h: number, c: number) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
      };
      // A thick line (legs and arms): w pixels wide.
      const limb = (x0: number, y0: number, x1: number, y1: number, w: number, c: number) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let k = 0; k <= n; k++) box(Math.round(x0 + ((x1 - x0) * k) / n - (w - 1) / 2), Math.round(y0 + ((y1 - y0) * k) / n), w, 1, c);
      };
      const sx = 7 + dx!, sy = hip! - 9; // shoulders
      // Legs (baggy pants, darker at the back), shoes.
      limb(sx + 1, hip!, bkx!, bky!, 3, SK_PANTS2), limb(bkx!, bky!, bfx!, bfy! - 1, 3, SK_PANTS2);
      limb(sx + 4, hip!, fkx!, fky!, 3, SK_PANTS), limb(fkx!, fky!, ffx!, ffy! - 1, 3, SK_PANTS);
      box(bfx! - 1, bfy! - 1, 3, 2, SK_SHOE), box(ffx! - 1, ffy! - 1, 4, 2, SK_SHOE);
      // Back arm, the tee (a shade down its back), the front arm.
      limb(sx, sy + 1, bhx!, bhy!, 2, SK_SKIN), box(sx - 1, sy, 2, 2, SK_TEE2);
      box(sx, sy, 6, hip! - sy + 1, SK_TEE), box(sx, sy, 1, hip! - sy + 1, SK_TEE2), box(sx + 2, sy + 2, 3, 1, SK_CAP), box(sx, hip! - 1, 6, 2, SK_PANTS);
      limb(sx + 5, sy + 1, fhx!, fhy!, 2, SK_SKIN), box(sx + 4, sy, 2, 3, SK_TEE);
      // The head: the neck, the face (an eye, an ear), the cap on backward: the brim out the back.
      box(sx + 2, sy - 1, 2, 1, SK_SKIN);
      box(sx + 1, sy - 5, 5, 4, SK_SKIN);
      set(sx + 4, sy - 4, SK_INK), set(sx + 1, sy - 3, SK_SKIN);
      box(sx + 1, sy - 7, 5, 3, SK_CAP), box(sx - 2, sy - 5, 3, 1, SK_CAP), set(sx + 6, sy - 5, SK_CAP);
      // The outline: every empty pixel that touches the figure (4-way) goes ink.
      for (let y = 0; y < GH; y++)
        for (let x = 0; x < GW; x++) {
          const i = y * GW + x;
          if (px[i] !== 255) continue;
          if ((x > 0 && px[i - 1]! < 200) || (x < GW - 1 && px[i + 1]! < 200) || (y > 0 && px[i - GW]! < 200) || (y < GH - 1 && px[i + GW]! < 200)) px[i] = 200;
        }
      const cv = frames[n]!;
      (cv.width = GW), (cv.height = GH);
      const c = cv.getContext("2d")!;
      c.clearRect(0, 0, GW, GH);
      for (let i = 0; i < GW * GH; i++) {
        const v = px[i]!;
        if (v === 255) continue;
        c.fillStyle = col[v === 200 ? SK_INK : v]!;
        c.fillRect(i % GW, (i / GW) | 0, 1, 1);
      }
    });
  }

  /** The rider and the board at P (call with the piece's art-unit transform set). */
  function draw() {
    const s = P[SCALE]!, f = P[POSE]! | 0, slam = f === SK_SLAM, fr = FR[slam ? SK_ROLL : f]!, a = P[FLIP]! * TAU * (P[KIND] === 3 ? 2 : 1);
    g.save();
    g.translate(P[X]!, P[Y]!);
    g.rotate(P[TILT]! + P[SPIN]! + (slam ? Math.min(1.6, P[SLAM]! * 6) * -Math.sign(P[FACE]! || 1) : 0));
    g.scale(s * P[FACE]!, s);
    g.imageSmoothingEnabled = false;
    // The board: deck, grip, trucks and wheels, in pixels; it turns over on a flip (the underside
    // shows), spins end over end on a tre, and flies ahead on a slam.
    const th = Math.cos(a), w = P[KIND] === 2 && P[FLIP]! > 0 ? Math.cos(a) : 1, bx = slam ? 6 + P[SLAM]! * 26 : 0;
    const by = slam ? -4 - Math.sin(Math.min(3, P[SLAM]! * 6)) * 7 : fr[14]! - 30 - (P[FLIP]! > 0 ? 1 : 0);
    const half = Math.round(9 * Math.abs(w)) || 1, thick = Math.abs(th) > 0.35 ? 2 : 1;
    if (P[GLOW]) (g.fillStyle = col[SK_GLOW]!), g.fillRect(bx - half - 2, by - 2, half * 2 + 4, thick + 4);
    g.fillStyle = col[SK_INK]!;
    g.fillRect(bx - half - 1, by - 1, half * 2 + 2, thick + 2);
    g.fillStyle = col[th >= 0 ? SK_DECK : SK_UNDER]!;
    g.fillRect(bx - half, by, half * 2, thick);
    if (Math.abs(th) > 0.35) {
      g.fillStyle = col[SK_INK]!;
      const wy = th > 0 ? by + thick + 1 : by - 3;
      g.fillRect(bx - half + 2, wy, 2, 2), g.fillRect(bx + half - 4, wy, 2, 2);
    }
    // The rider: feet on the board (lifted with it on a flip), x centred on the board.
    g.drawImage(frames[slam ? SK_ROLL : f]!, -10, -30 - (P[FLIP]! > 0 ? 1 : 0));
    g.restore();
  }
  return { P, paint, draw };
}
export type Skater = ReturnType<typeof skater>;
