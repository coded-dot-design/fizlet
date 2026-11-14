// The card table series' deck (Blackjack, Solitaire, Gin Rummy, Hold'em): a standard 52-card deck on
// @fzlt/core/cards, card c = suit × 13 + rank. Suits 0..3 are spades, hearts, clubs, diamonds (so
// `red` is suit & 1), ranks 0..12 are ace, 2..10, jack, queen, king. The faces and the back are
// painted here, once, for every game in the series: clean, original faces (big corner indices
// readable at phone size, pips in the usual places, court cards as flat geometric busts drawn by this
// file, mirrored top to bottom) and a Fizlet back (the Fizlet mark from site/layout.mjs `MARK`, its
// pop in pink, over rising pixel fizz). Art box 100 × 140, its top edge at y = 0 (dioramaCards).

/** Suits and ranks. */
export const SPADES = 0, HEARTS = 1, CLUBS = 2, DIAMONDS = 3, ACE = 0, JACK = 10, QUEEN = 11, KING = 12;
export const suit = (c: number) => (c / 13) | 0;
export const rank = (c: number) => c % 13;
export const red = (c: number) => ((c / 13) | 0) & 1;
/** The card of suit s and rank r. */
export const card = (s: number, r: number) => s * 13 + r;
/** Rank labels and suit names for the HUD and the live region. */
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const RANK_NAMES = ["ace", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king"];
export const RANK_PLURAL = ["aces", "twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings"];
export const SUIT_NAMES = ["spades", "hearts", "clubs", "diamonds"];
export const SUIT_GLYPHS = ["♠", "♥", "♣", "♦"];
/** "queen of hearts". */
export const cardName = (c: number) => RANK_NAMES[rank(c)] + " of " + SUIT_NAMES[suit(c)];
/** "Q♥". */
export const short = (c: number) => RANKS[rank(c)]! + SUIT_GLYPHS[suit(c)]!;

const TAU = 6.283185307179586;
export const INK = "#1f2433", PAPER = "#fbf6ea", RED = "#d8473a", GOLD = "#f2c14e", BLUE = "#3b5aa8";
const FONT = "ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";

/** Suit s as a path, centred on the origin, `r` its half height. */
export function suitPath(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, r: number) {
  ctx.beginPath();
  if (s === DIAMONDS) {
    ctx.moveTo(x, y - r), ctx.lineTo(x + r * 0.74, y), ctx.lineTo(x, y + r), ctx.lineTo(x - r * 0.74, y);
    ctx.closePath();
  } else if (s === HEARTS) {
    ctx.moveTo(x, y + r);
    ctx.bezierCurveTo(x - r * 0.35, y + r * 0.55, x - r * 1.02, y + r * 0.12, x - r * 0.98, y - r * 0.4);
    ctx.bezierCurveTo(x - r * 0.94, y - r * 0.98, x - r * 0.12, y - r * 1.02, x, y - r * 0.42);
    ctx.bezierCurveTo(x + r * 0.12, y - r * 1.02, x + r * 0.94, y - r * 0.98, x + r * 0.98, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 1.02, y + r * 0.12, x + r * 0.35, y + r * 0.55, x, y + r);
    ctx.closePath();
  } else if (s === SPADES) {
    ctx.moveTo(x, y - r);
    ctx.bezierCurveTo(x + r * 0.3, y - r * 0.55, x + r * 1, y - r * 0.2, x + r * 0.96, y + r * 0.26);
    ctx.bezierCurveTo(x + r * 0.92, y + r * 0.72, x + r * 0.3, y + r * 0.74, x + r * 0.08, y + r * 0.38);
    ctx.lineTo(x + r * 0.3, y + r), ctx.lineTo(x - r * 0.3, y + r), ctx.lineTo(x - r * 0.08, y + r * 0.38);
    ctx.bezierCurveTo(x - r * 0.3, y + r * 0.74, x - r * 0.92, y + r * 0.72, x - r * 0.96, y + r * 0.26);
    ctx.bezierCurveTo(x - r * 1, y - r * 0.2, x - r * 0.3, y - r * 0.55, x, y - r);
    ctx.closePath();
  } else {
    const q = r * 0.46;
    ctx.arc(x, y - r * 0.5, q, 0, TAU);
    ctx.moveTo(x - r * 0.5 + q, y + r * 0.12);
    ctx.arc(x - r * 0.5, y + r * 0.12, q, 0, TAU);
    ctx.moveTo(x + r * 0.5 + q, y + r * 0.12);
    ctx.arc(x + r * 0.5, y + r * 0.12, q, 0, TAU);
    ctx.moveTo(x - r * 0.14, y), ctx.lineTo(x + r * 0.14, y);
    ctx.lineTo(x + r * 0.32, y + r), ctx.lineTo(x - r * 0.32, y + r);
    ctx.closePath();
  }
}
const pip = (ctx: CanvasRenderingContext2D, s: number, x: number, y: number, r: number, flip: boolean) => {
  if (!flip) return suitPath(ctx, s, x, y, r), ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI);
  suitPath(ctx, s, 0, 0, r);
  ctx.fill();
  ctx.restore();
};
/** Pip places for 2..10 on a 3 × 7 grid: column (0..2) and row (0..6) pairs. */
const PIPS: number[][] = [
  [1, 0, 1, 6],
  [1, 0, 1, 3, 1, 6],
  [0, 0, 2, 0, 0, 6, 2, 6],
  [0, 0, 2, 0, 1, 3, 0, 6, 2, 6],
  [0, 0, 2, 0, 0, 3, 2, 3, 0, 6, 2, 6],
  [0, 0, 2, 0, 1, 1.5, 0, 3, 2, 3, 0, 6, 2, 6],
  [0, 0, 2, 0, 1, 1.5, 0, 3, 2, 3, 1, 4.5, 0, 6, 2, 6],
  [0, 0, 2, 0, 0, 2, 2, 2, 1, 1, 0, 4, 2, 4, 0, 6, 2, 6],
  [0, 0, 2, 0, 1, 1, 0, 2, 2, 2, 0, 4, 2, 4, 1, 5, 0, 6, 2, 6],
];

/** Paint card c's face into (0, 0)–(100, 140). */
export function paintFace(ctx: CanvasRenderingContext2D, c: number) {
  const s = suit(c), r = rank(c), ink = s & 1 ? RED : INK;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 100, 140);
  ctx.lineJoin = ctx.lineCap = "round";
  // The corner indices: big, so a card reads at phone size; the bottom one turned round.
  for (let k = 0; k < 2; k++) {
    if (k) ctx.save(), ctx.translate(100, 140), ctx.rotate(Math.PI);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${r === 9 ? 22 : 27}px ${FONT}`;
    ctx.fillText(RANKS[r]!, 16, 30);
    suitPath(ctx, s, 16, 43, 8);
    ctx.fill();
    if (k) ctx.restore();
  }
  ctx.fillStyle = ink;
  if (r === ACE) {
    // One big pip in a ring.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(54, 72, 31, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    suitPath(ctx, s, 54, 72, 21);
    ctx.fill();
  } else if (r < JACK) {
    const L = PIPS[r - 1]!, pr = r >= 8 ? 8.5 : 9.5;
    for (let i = 0; i < L.length; i += 2) {
      const col = L[i]!, row = L[i + 1]!;
      pip(ctx, s, 38 + col * 16, 24 + row * 15.5, pr, row > 3);
    }
  } else court(ctx, s, r, ink);
  // A hairline frame inside the edge.
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(4, 4, 92, 132, 7);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A court card: a panel with a flat bust drawn twice, mirrored about the panel's middle. */
function court(ctx: CanvasRenderingContext2D, s: number, r: number, ink: string) {
  const X = 30, Y = 16, W = 52, H = 108;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(X, Y, W, H, 6);
  ctx.fillStyle = s & 1 ? "#fbe1d9" : "#dfe6f6";
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < 2; k++) {
    ctx.save();
    if (k) ctx.translate(X + W, Y + H), ctx.rotate(Math.PI), ctx.translate(-X, -Y);
    bust(ctx, X + W / 2, Y, r, s, ink);
    ctx.restore();
  }
  // The diagonal band where the halves meet, and the suit on it.
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(X, Y + H / 2 + 6), ctx.lineTo(X + W, Y + H / 2 - 10), ctx.lineTo(X + W, Y + H / 2 - 4), ctx.lineTo(X, Y + H / 2 + 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(X, Y, W, H, 6);
  ctx.stroke();
}
/** The top half's figure, centred at x, from the panel's top y: shoulders, a head, the headwear. */
function bust(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: number, ink: string) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const robe = r === KING ? (s & 1 ? RED : BLUE) : r === QUEEN ? (s & 1 ? "#e9897a" : "#6e86c8") : s & 1 ? "#f0a34a" : "#4f9a8a";
  // Shoulders: a robe with a collar.
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(x - 24, y + 56), ctx.quadraticCurveTo(x - 22, y + 36, x - 8, y + 34), ctx.lineTo(x + 8, y + 34), ctx.quadraticCurveTo(x + 22, y + 36, x + 24, y + 56);
  ctx.closePath();
  ctx.fill(), ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 34), ctx.lineTo(x, y + 46), ctx.lineTo(x + 8, y + 34);
  ctx.closePath();
  ctx.fill(), ctx.stroke();
  // The suit on the chest.
  ctx.fillStyle = PAPER;
  suitPath(ctx, s, x - 13, y + 46, 4.5);
  ctx.fill();
  // The head.
  ctx.fillStyle = "#f3d3b5";
  ctx.beginPath();
  ctx.arc(x, y + 25, 9.5, 0, TAU);
  ctx.fill(), ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x - 3.4, y + 25, 1.3, 0, TAU), ctx.arc(x + 3.4, y + 25, 1.3, 0, TAU);
  ctx.fill();
  if (r === KING) {
    // A beard and a three-point crown.
    ctx.fillStyle = s & 1 ? "#8a4b36" : "#5d5a6b";
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 28), ctx.quadraticCurveTo(x, y + 42, x + 8, y + 28), ctx.quadraticCurveTo(x, y + 32, x - 8, y + 28);
    ctx.fill(), ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 17), ctx.lineTo(x - 11, y + 5), ctx.lineTo(x - 5, y + 11), ctx.lineTo(x, y + 2), ctx.lineTo(x + 5, y + 11), ctx.lineTo(x + 11, y + 5), ctx.lineTo(x + 10, y + 17);
    ctx.closePath();
    ctx.fill(), ctx.stroke();
  } else if (r === QUEEN) {
    // Hair down to the shoulders, a round tiara with a jewel.
    ctx.fillStyle = s & 1 ? "#6a3b2e" : "#2f2a3d";
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 22), ctx.quadraticCurveTo(x - 14, y + 34, x - 9, y + 38), ctx.lineTo(x - 7, y + 26), ctx.closePath();
    ctx.moveTo(x + 10, y + 22), ctx.quadraticCurveTo(x + 14, y + 34, x + 9, y + 38), ctx.lineTo(x + 7, y + 26), ctx.closePath();
    ctx.fill(), ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 18), ctx.quadraticCurveTo(x, y + 4, x + 9, y + 18), ctx.closePath();
    ctx.fill(), ctx.stroke();
    ctx.fillStyle = s & 1 ? BLUE : RED;
    ctx.beginPath();
    ctx.arc(x, y + 12, 2.4, 0, TAU);
    ctx.fill();
  } else {
    // A flat cap with a feather.
    ctx.fillStyle = s & 1 ? BLUE : RED;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 19), ctx.quadraticCurveTo(x - 6, y + 8, x + 6, y + 10), ctx.lineTo(x + 13, y + 18);
    ctx.closePath();
    ctx.fill(), ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 11), ctx.quadraticCurveTo(x + 16, y + 0, x + 22, y + 4), ctx.quadraticCurveTo(x + 14, y + 6, x + 6, y + 14);
    ctx.closePath();
    ctx.fill(), ctx.stroke();
  }
  ctx.fillStyle = ink;
  ctx.font = `900 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(RANKS[r]!, x + 15, y + 52);
}

/** The Fizlet mark's rects on its 64-unit grid (site/layout.mjs `MARK`, the one source). */
const FRAME = [0, 0, 64, 2, 0, 62, 64, 2, 0, 2, 2, 60, 62, 2, 2, 60];
const MARK_INK = [8, 30, 26, 7, 8, 49, 26, 7, 8, 37, 7, 12, 27, 37, 7, 12, 36, 18, 14, 14, 40, 40, 8, 8];
const POP = [52, 6, 6, 6, 46, 6, 3, 3, 58, 14, 3, 3];
const rects = (ctx: CanvasRenderingContext2D, L: number[], x: number, y: number, u: number) => {
  for (let i = 0; i < L.length; i += 4) ctx.fillRect(x + L[i]! * u, y + L[i + 1]! * u, L[i + 2]! * u, L[i + 3]! * u);
};
/** The back: deep ink, a cream frame, pixel fizz rising, the Fizlet mark on a cream tile. */
export function paintBack(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#1d1b3a";
  ctx.fillRect(0, 0, 100, 140);
  // Pixel bubbles fizzing up from the bottom, in rows that thin out (fixed: the same on every card).
  ctx.fillStyle = "#3a3570";
  for (let row = 0; row < 15; row++)
    for (let col = 0; col < 11; col++) {
      const h = ((row * 7919 + col * 104729) >>> 0) % 17;
      if (h > 2 + row * 0.5) continue;
      const z = h < 2 ? 4 : 2.5;
      ctx.fillRect(10 + col * 7.6 + (row & 1) * 3, 130 - row * 8.3, z, z);
    }
  ctx.strokeStyle = "#f4ead2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(8, 8, 84, 124, 6);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.roundRect(13, 13, 74, 114, 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // The mark, with clear space round it, on a cream tile.
  const u = 0.6, m = 64 * u, x = 50 - m / 2, y = 70 - m / 2 - 6;
  ctx.fillStyle = "#f4ead2";
  ctx.fillRect(x - 9, y - 9, m + 18, m + 18);
  ctx.fillStyle = "#1d1b3a";
  rects(ctx, FRAME, x, y, u);
  rects(ctx, MARK_INK, x, y, u);
  ctx.fillStyle = "#ff2e88";
  rects(ctx, POP, x, y, u);
  ctx.fillStyle = "#f4ead2";
  ctx.font = "800 9px ui-monospace,Menlo,monospace";
  ctx.textAlign = "center";
  ctx.fillText("FIZLET", 50, y + m + 24);
}
