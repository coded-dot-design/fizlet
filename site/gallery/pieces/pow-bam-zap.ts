// #20 POW BAM ZAP: a micro fighting game in one comic panel. On a rooftop under a halftone night
// sky, a cyan hero squares up to the Glitch, a spiky pink virus. Click the Glitch and the hero
// lands a hit right there: POW! (a punch), BAM! (a flying charge), ZAP! (a bolt), in a jagged
// starburst balloon, with anticipation, impact lines, chips, a flash, knockback, a hop, a squash
// and a skid left on the roof that fades. Miss, and the Glitch hits back. Run either side out of
// pips and it's KO!: launched off the roof, a twinkle in the sky, and it drops back in. Each new
// Glitch dodges about, then comes back angrier with more pips. The panel shakes on impacts only;
// the caption's real letters move only when a balloon slams down on them.
// Bricks: the kernel (fixed step, settle: it sleeps between hits), fizlet/sprite (both fighters
// as pixel data, baked once; the hit flash and the angry Glitch as palettes), fizlet/slot (loads
// near the screen, never under reduced motion; destroy() gives the page back through the ledger).
import { createEngine } from "../../../src/kernel/index";
import { sprites, type SpriteDef } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, offscreen, print, sfx, sfxW, line, bits } from "./pix";
import { letters } from "./letters";

// ---------- The cast, as pixel data ----------
// Sprites are stamped together from parts ("." is see-through), so each pose is the same hero.
const blank = (w: number, h: number) => Array.from({ length: h }, () => ".".repeat(w));
function stamp(rows: string[], x: number, y: number, part: readonly string[]) {
  part.forEach((p, j) => {
    const r = rows[y + j];
    if (r === undefined) return;
    let o = "";
    for (let i = 0; i < r.length; i++) o += i >= x && i < x + p.length && p[i - x] !== "." ? p[i - x] : r[i];
    rows[y + j] = o;
  });
  return rows;
}

// The hero, facing right: c suit, w shine, v visor, g glint, k eyes shut, y bolt and belt,
// b gloves, trunks and boots, p/a scarf. 24 × 30; frames: 0 guard, 1 punch, 2 hurt, 3 zap.
const HEAD = ["...ccccc..", ".cccccccc.", "cwcccccccc", "cwcccccccc", "ccccvvvvvv", "ccccvgvvgv", "cccccvvvv.", ".cccccccc.", "..vvvvvv.."];
const HEAD_HURT = ["...ccccc..", ".cccccccc.", "cwcccccccc", "cwcccccccc", "ccccvkvvkv", "ccccvvkkvv", "cccccvvvv.", ".cccccccc.", "..vvvvvv.."];
const TORSO = ["...cccccc...", ".cccccccccc.", "cccccccccccc", "cccccccyyccc", "ccccccyycccc", "cccccyyyyccc", ".cccccyyccc.", ".ccccyycccc.", "..cccycccc..", "..yyyyyyyy.."];
const LEGS = ["..bbbbbbbb....", "..bbbb.bbbb...", "..ccc...ccc...", ".ccc.....ccc..", ".ccc.....ccc..", "ccc.......ccc.", "ccc.......ccc.", "bbbb......bbbb", "bbbbbb....bbbbbb"];
const LUNGE_LEGS = ["...bbbbbbbb.....", "...bbbb.bbbb....", "..ccc....ccc....", ".ccc......ccc...", "ccc........ccc..", "cc..........ccc.", "cc...........ccc", "bbbb.........bbbb", "bbbbbb.......bbbbbb"];
const GUARD = ["cccc..", ".cccbbb", "..bbbbb", "...bbb."];
const REAR = ["bbb", "bbbb", ".bb"];
const JAB = ["ccccccbbb", "cccccbbbbb", ".....bbbb."];
const ZAPFIST = ["ccccccwgw", "cccccwwwww", ".....gwg.."];
const FLAIL = ["..bb.", ".bbbb", "ccbb.", "cc..."];
const SCARF = [".....ppp", "...ppppa", ".pppp...", "ppa.....", "p......."];
const SCARF_UP = ["......pp", ".....pp.", "....pp..", "..ppa...", "ppp....."];
function hero(f: number) {
  const r = blank(28, 30), lean = f === 1 || f === 3 ? 2 : f === 2 ? -2 : 0;
  stamp(r, lean, 10, f === 2 ? SCARF_UP : SCARF);
  if (f !== 2) stamp(r, 13 + lean, 13, REAR);
  stamp(r, f === 1 || f === 3 ? 2 : 3, 21, f === 1 || f === 3 ? LUNGE_LEGS : LEGS);
  stamp(r, 5 + lean, 11, TORSO);
  stamp(r, 7 + lean, 2, f === 2 ? HEAD_HURT : HEAD);
  stamp(r, 15 + lean, 12, f === 0 ? GUARD : f === 1 ? JAB : f === 3 ? ZAPFIST : FLAIL);
  if (f === 2) stamp(r, 2 + lean, 10, ["bb.", "bbb", ".cc", "..c"]);
  return r;
}
const HERO_ROWS = [hero(0), hero(1), hero(2), hero(3)];

// The Glitch, facing left: a spiky pink virus with one big eye, drawn from its shape.
// p body, a highlight, y knobs, t eye white and teeth, k pupil and mouth, b feet.
// Frames: 0 grin, 1 attack (brow down, mouth wide), 2 hurt (eye shut tight, mouth wobbles).
const S = 32;
function glitch(mode: number) {
  const rows: string[] = [];
  const cx = 16, cy = 15, R = 10.5;
  for (let y = 0; y < S; y++) {
    let r = "";
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let ch = ".";
      // Spikes: seven, none pointing straight down (the feet are there); a knob on each.
      for (let i = 0; i < 7; i++) {
        const sa = -Math.PI / 2 + (i - 3) * 0.74, da = Math.abs(Math.atan2(Math.sin(a - sa), Math.cos(a - sa)));
        if (d > R - 1 && d < R + 3 && da * d < 1.1) ch = "p";
        const kx = cx + Math.cos(sa) * (R + 3.6), ky = cy + Math.sin(sa) * (R + 3.6);
        if (Math.hypot(x + 0.5 - kx, y + 0.5 - ky) < 1.7) ch = "y";
      }
      if (d < R) ch = d > R - 1.6 && dx + dy < -5 ? "a" : "p";
      // Feet.
      if (y >= 25 && y <= 27 && ((x >= 9 && x <= 13) || (x >= 19 && x <= 23))) ch = y === 25 && (x === 9 || x === 23) ? "." : "b";
      // The eye, looking left at the hero.
      const ex = x + 0.5 - 13.5, ey = y + 0.5 - 12.5, ed = Math.hypot(ex, ey);
      if (ed < 4.6) ch = "t";
      if (mode === 2) {
        // Shut tight: a > across the white.
        if (ed < 4.6 && Math.abs(Math.abs(ey) - (x + 0.5 - 10.5) * 0.55) < 0.6 && x >= 10) ch = "k";
      } else if (x >= 10 && x <= 11 && y >= 11 && y <= 13) ch = "k";
      if (mode === 0 && x === 15 && y === 10) ch = "w";
      if (mode === 1 && ((y === 7 && x >= 10 && x <= 17) || (y === 8 && x >= 15 && x <= 17))) ch = "k"; // the angry brow
      // The mouth.
      if (mode === 0 && y === 19 && x >= 10 && x <= 20) ch = x % 2 ? "t" : "k";
      if (mode === 0 && y === 20 && x >= 11 && x <= 19) ch = "k";
      if (mode === 1 && y >= 18 && y <= 21 && x >= 9 && x <= 20) ch = (y === 18 || y === 21) && x % 2 ? "t" : "k";
      if (mode === 2 && y >= 19 && y <= 20 && x >= 11 && x <= 19) ch = (x + y * 2) % 4 < 2 ? "k" : "p";
      r += ch;
    }
    rows.push(r);
  }
  return rows;
}

export const CAST: Record<"hero" | "glitch", SpriteDef> = {
  hero: {
    frames: HERO_ROWS,
    colors: { c: C.sys, w: C.ink, v: C.rim, k: C.ink, g: C.go, y: C.hurt, b: C.cmd, p: C.attack, a: C.aim },
    outline: C.rim,
    ax: 10,
    ay: 30,
  },
  glitch: {
    frames: [glitch(0), glitch(1), glitch(2)],
    colors: { p: "body", a: "shine", y: C.hurt, t: C.ink, w: C.ink, k: C.rim, b: C.cmd },
    outline: C.rim,
    ax: 16,
    ay: 28,
  },
};

// ---------- The set: a halftone night sky over a city, a rooftop, a caption box ----------
const GROUND = 80, HERO_X = 42, GLITCH_X = 118;

function paintSet(g: CanvasRenderingContext2D) {
  g.fillStyle = C.base;
  g.fillRect(0, 0, W, H);
  // A halftone glow over the city: dots on a print screen, growing toward the horizon.
  g.fillStyle = C.cmd;
  for (let y = 22, row = 0; y < GROUND; y += 4, row++) {
    const s = y < 36 ? 1 : y < 50 ? 2 : 3;
    for (let x = (row & 1) * 2; x < W; x += 4) g.fillRect(x, y, s, s);
  }
  // A few stars up top, and the moon.
  g.fillStyle = C.ink;
  for (const [x, y] of [[112, 6], [126, 15], [90, 11], [70, 4], [150, 28], [104, 19]] as const) g.fillRect(x, y, 1, 1);
  g.fillStyle = C.hurt;
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y < 42 && (x - 3) * (x - 3) + (y + 2) * (y + 2) > 26) g.fillRect(150 + x, 10 + y, 1, 1);
  // The skyline: dark blocks, a few lit windows, an antenna, a water tower.
  const blocks = [[-2, 58, 14], [12, 52, 12], [24, 62, 10], [34, 48, 15], [49, 56, 11], [60, 44, 13], [73, 60, 12], [85, 50, 15], [100, 58, 10], [110, 46, 13], [123, 54, 12], [135, 60, 9], [144, 50, 18]] as const;
  for (const [x, top, w] of blocks) {
    g.fillStyle = C.rim;
    g.fillRect(x, top - 1, w, GROUND - top + 1);
    g.fillStyle = C.line;
    g.fillRect(x + 1, top, w - 2, GROUND - top);
    g.fillStyle = C.hurt;
    for (let wy = top + 3; wy < GROUND - 4; wy += 4) for (let wx = x + 3; wx < x + w - 2; wx += 3) if ((wx * 7 + wy * 13) % 7 === 0) g.fillRect(wx, wy, 1, 2);
  }
  g.fillStyle = C.rim;
  g.fillRect(66, 34, 1, 10); // antenna
  g.fillStyle = C.attack;
  g.fillRect(66, 33, 1, 1);
  g.fillStyle = C.rim;
  g.fillRect(89, 42, 8, 7); // water tower
  g.fillRect(90, 49, 1, 1);
  g.fillRect(95, 49, 1, 1);
  g.fillStyle = C.line;
  g.fillRect(90, 43, 6, 5);
  // The rooftop: a parapet edge, bricks.
  g.fillStyle = C.rim;
  g.fillRect(0, GROUND, W, H - GROUND);
  g.fillStyle = C.line;
  g.fillRect(0, GROUND, W, 2);
  g.fillStyle = C.base;
  for (let y = GROUND + 4, row = 0; y < H; y += 3, row++) for (let x = (row & 1) * 4 - 4; x < W; x += 8) g.fillRect(x, y, 7, 1);
}

// ---------- The balloons: a jagged starburst per word, baked once ----------
const WORDS = ["POW!", "BAM!", "ZAP!", "KO!"];
// Balloon, inner burst, letters, extrude: per word.
const SCHEME = [
  [C.hurt, C.ink, C.attack, C.rim],
  [C.attack, C.hurt, C.ink, C.rim],
  [C.sys, C.ink, C.hurt, C.cmd],
  [C.ink, C.hurt, C.attack, C.rim],
] as const;
const BW = 52, BH = 36;

function balloon(word: number, seed: number) {
  const g = offscreen(BW, BH), [fill, inner, face, drop] = SCHEME[word]!;
  // Spike radii, from a fixed little LCG (the same balloon every time, poster included).
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const N = word === 2 ? 11 : 14, out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = 0.86 + rnd() * 0.22;
  const inside = (x: number, y: number, k: number) => {
    const dx = (x + 0.5 - BW / 2) / (BW / 2 - 1), dy = (y + 0.5 - BH / 2) / (BH / 2 - 1), a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * N, i = Math.floor(a) % N, f = a - Math.floor(a);
    // Out to a spike tip at the middle of each sector, in to a notch at its edges.
    const tip = out[i]! * k, r = 0.6 * k + (tip - 0.6 * k) * (1 - Math.abs(f - 0.5) * 2) ** (word === 2 ? 1.6 : 1.1);
    return Math.hypot(dx, dy) < r;
  };
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if (!inside(x, y, 1)) continue;
      const edge = !inside(x - 1, y, 1) || !inside(x + 1, y, 1) || !inside(x, y - 1, 1) || !inside(x, y + 1, 1);
      g.fillStyle = edge ? C.rim : inside(x, y, 0.62) ? inner : fill;
      g.fillRect(x, y, 1, 1);
    }
  const t = WORDS[word]!;
  sfx(g, t, Math.round((BW - sfxW(t)) / 2) - 1, Math.round((BH - 9) / 2) - 1, face, drop, C.rim, [0, -1, 1, 0]);
  return g.canvas;
}

// ---------- The game ----------
// Click the Glitch: the hero lands a hit there (POW!, BAM!, ZAP! in turn). Click anywhere else:
// the hero swings at air, and the Glitch hits back. Each side has pips; the one that runs out is
// launched off the roof (KO!), twinkles away, and drops back in. Every Glitch after the first
// dodges about after each hit, and from the third on it comes back angrier, with more pips.
export type PowScene = SlotScene & { engine: ReturnType<typeof createEngine>; hit(x: number, y: number): void; readonly score: number[]; readonly hp: number[] };

// State slots (one typed array: nothing boxes in a step).
const T = 0, ATK = 1, WORD = 2, NEXT = 3, AUTO = 4, IX = 5, IY = 6, SHAKE = 7, FLASH = 8, DIRTY = 9, PEND = 10, PX = 11, PY = 12;
const KO = 13, KOW = 14, ROUND = 15, NEWB = 16, MISS = 17, MX = 18, MY = 19, BI = 20, FINAL = 21;
// The beat of a hit, in seconds: wind up, dash, contact; then the struck one flies, lands, slides.
const WIND = 0.1, HIT = 0.2, OVER = 1.15;
// The beat of a KO: launched, gone (a twinkle), dropped back in, done.
const GONE = 1.05, BACK = 2.0, DONE = 2.6;
// Per word: how far the struck one flies, how high it hops.
const KNOCKS = [12, 18, 10], HOPS = [5, 8, 4];
const HOME = [42, 118];
// Up to three balloons: x, y, word, age (s), going (s left; 0: staying up).
const NB = 3;
// Marks left on the roof (a skid where a fighter lands, a crack where a bolt hits): x, width, seconds left, kind.
const NM = 6, MARK = 5;
const BCOL = [C.hurt, C.ink, C.attack, C.sys, C.cmd, C.muted];

export function pow(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): PowScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const ctx = artCanvas(engine, stage);
  const set = offscreen(W, H);
  paintSet(set);
  // Palettes: 0 the Glitch as it starts, 1 the hit flash, 2 an angrier Glitch.
  const cast = sprites(CAST, { palettes: [{ body: C.attack, shine: C.aim }, { "*": C.ink }, { body: C.cmd, shine: C.attack }] });
  const ball = [balloon(0, 7), balloon(1, 19), balloon(2, 23), balloon(3, 5)];
  const chips = bits(72, BCOL);
  // The caption's real letters: a balloon that slams down on them knocks them about.
  const cap = letters(engine, slot, ".pz-cap i");
  const s = new Float64Array(24);
  s[T] = s[KO] = s[MISS] = -1;
  s[AUTO] = first ? -1 : 0.55;
  s[DIRTY] = 1;
  // The fighters (0 the hero, 1 the Glitch): where they stand, pips, max pips, KOs scored.
  const base = new Float32Array(HOME), hp = new Float32Array([3, 4]), max = new Float32Array([3, 4]), score = new Float32Array(2);
  // Where each is drawn this frame: x, y off the roof, frame, flash, squash, upside down.
  const fx = new Float32Array(2), fy = new Float32Array(2), ff = new Uint8Array(2), fp = new Uint8Array(2), fs = new Uint8Array(2), fu = new Uint8Array(2);
  const bx = new Float32Array(NB), by = new Float32Array(NB), bw = new Uint8Array(NB), ba = new Float32Array(NB), bg = new Float32Array(NB), bl = new Uint8Array(NB);
  const mx = new Float32Array(NM), mw = new Float32Array(NM), ml = new Float32Array(NM), mk = new Uint8Array(NM);
  // Impact rays and the zap bolt's kinks, rolled at each hit (no allocation).
  const ray = new Float32Array(12), kink = new Float32Array(9);

  const hit = (x: number, y: number) => ((s[PX] = x), (s[PY] = y), (s[PEND] = 1), engine.wake());
  if (first) hit((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  // Clicks on the figure, in art pixels (one layout read per click, outside any frame).
  slot.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect();
    hit(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const mark = (x: number, w: number, kind: number) => {
    let k = 0;
    for (let i = 1; i < NM; i++) if (ml[i]! < ml[k]!) k = i;
    mx[k] = x;
    mw[k] = w;
    ml[k] = MARK;
    mk[k] = kind;
  };
  const dust = (x: number, n: number, e: typeof engine) => {
    for (let i = 0; i < n; i++) chips.spawn(x + (e.random() - 0.5) * 14, GROUND, (e.random() - 0.5) * 60, -15 - e.random() * 30, 0.4 + e.random() * 0.3, 1, 5);
  };
  const balloonAt = (x: number, y: number, word: number) => {
    for (let i = 0; i < NB; i++) if (bl[i] && !bg[i]) bg[i] = 0.16;
    let k = 0;
    while (k < NB - 1 && bl[k]) k++;
    bl[k] = 1;
    bx[k] = Math.min(W - BW / 2 - 1, Math.max(BW / 2 + 1, x));
    by[k] = Math.min(GROUND - 6 - BH / 2, Math.max(BH / 2 + 1, y));
    bw[k] = word;
    ba[k] = -HIT;
    bg[k] = 0;
    s[BI] = k;
  };

  /** A click lands: the hero swings at it; it hits if it's on the Glitch (a real hit test), else the Glitch counters. */
  function click(x: number, y: number) {
    const e = engine;
    if (s[KO]! >= 0) return; // someone is flying off the roof: wait for the drop-in
    const onGlitch = Math.abs(x - fx[1]!) < 15 && y > GROUND - 34 && y < GROUND + 3;
    s[ATK] = onGlitch ? 0 : 1;
    s[WORD] = s[NEXT]!;
    s[NEXT] = (s[NEXT]! + 1) % 3;
    s[T] = 0;
    s[FINAL] = hp[1 - s[ATK]!]! <= 1 ? 1 : 0;
    if (!onGlitch) (s[MISS] = 0.6), (s[MX] = x), (s[MY] = y);
    // The balloon: where you clicked when it lands; over the hero's head when the Glitch counters.
    if (s[FINAL]) balloonAt(W / 2, 30, 3);
    else if (onGlitch) balloonAt(x, Math.min(y, GROUND - 30) - 20, s[WORD]!);
    else balloonAt(base[0]! + 6, GROUND - 52, s[WORD]!);
    // Where the Glitch goes after a hit: it stands its ground in round one, then dodges about.
    s[NEWB] = !onGlitch ? base[0]! : s[ROUND]! >= 1 ? 92 + e.random() * 46 : base[1]!;
    for (let i = 0; i < 12; i++) ray[i] = (i / 12) * Math.PI * 2 + (e.random() - 0.5) * 0.35;
    for (let i = 0; i < 9; i++) kink[i] = (e.random() - 0.5) * 9;
  }

  function stepHit(e: typeof engine, dt: number) {
    const t0 = s[T]!, t = (s[T] = t0 + dt), word = s[WORD]!, zap = word === 2, a = s[ATK]!, b = 1 - a, dir = a === 0 ? 1 : -1;
    const at = (x: number) => t0 < x && t >= x;
    // The attacker: winds back, dashes in (a leap for BAM!), holds at contact, hops home.
    // A zap fires from where it stands: it only rocks back as it lets go.
    const D = zap ? 0 : base[b]! - dir * 30 - base[a]!;
    const d = (t - WIND) / (HIT - WIND), back = (t - 0.42) / 0.3;
    fx[a] = base[a]! + (t < WIND ? -3 * dir * Math.sin((t / WIND) * 1.57) : t < HIT ? -3 * dir + (D + 3 * dir) * d * d : t < 0.42 ? D - (zap ? 2 * dir : 0) : t < 0.72 ? D * (1 - back * (2 - back)) : 0);
    fy[a] = word === 1 && t >= WIND && t < HIT ? Math.sin(d * Math.PI) * 10 : t >= 0.42 && t < 0.72 && !zap ? Math.sin(back * Math.PI) * 3 : 0;
    ff[a] = t >= WIND * 0.5 && t < 0.42 ? (a === 0 && zap ? 3 : 1) : 0;
    // The struck one: knocked back fast, a hop, a squash as it lands, a slide to where it stands next.
    const u = t - HIT, K = KNOCKS[word]!, nb = s[NEWB]!;
    if (s[KO]! < 0 || s[KOW] !== b) {
      fx[b] = u < 0 ? base[b]! : u < 0.12 ? base[b]! + dir * (u / 0.12) * K : u < 0.6 ? base[b]! + dir * K : u < 0.95 ? base[b]! + dir * K + (nb - base[b]! - dir * K) * ((u - 0.6) / 0.35) : nb;
      fy[b] = u > 0 && u < 0.28 ? Math.sin((u / 0.28) * Math.PI) * HOPS[word]! : 0;
      fs[b] = u >= 0.28 && u < 0.38 ? 1 : 0;
      ff[b] = u >= 0 && u < 0.6 ? 2 : 0;
      fp[b] = s[FLASH]! > 0 ? 1 : 0;
    }
    // The zap charges: sparks pull in to the fist (or the eye).
    if (zap && t < HIT && ((t * 60) | 0) % 2) chips.spawn(fx[a]! + dir * (a ? 6 : 15) + (e.random() - 0.5) * 14, GROUND - 17 + (e.random() - 0.5) * 12, 0, 0, 0.08, 1, a ? 2 : 3);
    if (at(HIT)) {
      // Contact: a pip off, the flash, one shake, chips, the balloon slams down (and knocks any
      // caption letter under it). The last pip: KO, and the struck one is launched.
      const ix = base[b]! - dir * (b ? 10 : 6), iy = GROUND - (b ? 15 : 19);
      s[IX] = ix;
      s[IY] = iy;
      s[SHAKE] = word === 1 || s[FINAL] ? 0.26 : 0.2;
      s[FLASH] = 0.08;
      hp[b] = Math.max(0, hp[b]! - 1);
      for (let i = 0; i < 16; i++) chips.spawn(ix, iy, dir * (30 + e.random() * 100), -40 - e.random() * 90, 0.6 + e.random() * 0.6, 1 + ((e.random() * 2) | 0), (e.random() * 5) | 0);
      const k = s[BI]!;
      cap.blast(bx[k]!, by[k]!, 22, 1);
      if (zap) mark(fx[b]!, 14, 1);
      if (word === 1) dust(base[a]! + D, 6, e);
      if (!hp[b]) (s[KO] = 0), (s[KOW] = b), (score[a] = score[a]! + 1);
    }
    if (at(HIT + 0.28) && s[KO]! < 0) mark(fx[b]! - dir * 3, 10, 0), dust(fx[b]!, 8, e);
    if (t > OVER) (s[T] = -1), (base[b] = s[KO]! >= 0 && s[KOW] === b ? base[b]! : nb);
  }

  function stepKO(e: typeof engine, dt: number) {
    const t0 = s[KO]!, t = (s[KO] = t0 + dt), l = s[KOW]!, away = l ? 1 : -1;
    const at = (x: number) => t0 < x && t >= x;
    if (t < GONE) {
      // Launched: up and away, tumbling (upside down every other beat), off the top of the panel.
      fx[l] = base[l]! + away * 70 * t;
      fy[l] = 190 * t - 60 * t * t;
      ff[l] = 2;
      fu[l] = ((t / 0.09) | 0) & 1;
      fp[l] = t < 0.08 ? 1 : 0;
      if (((t * 30) | 0) % 3 === 0) chips.spawn(fx[l]!, GROUND - fy[l]! - 12, -away * 20, 20, 0.35, 1, 0);
    } else if (t < BACK) {
      fx[l] = -99; // gone
      fu[l] = 0;
    } else {
      // Dropped back in from the top: a thud, dust, one shake, fresh pips (more, for a new Glitch).
      if (at(BACK)) {
        base[l] = HOME[l]!;
        if (l) (s[ROUND] = s[ROUND]! + 1), (max[1] = Math.min(7, 4 + s[ROUND]!));
        hp[l] = max[l]!;
      }
      const d = Math.min(1, (t - BACK) / 0.3);
      fx[l] = base[l]!;
      fy[l] = (1 - d * d) * 110;
      ff[l] = d < 1 ? 2 : 0;
      fs[l] = d === 1 && t - BACK < 0.42 ? 1 : 0;
      if (at(BACK + 0.3)) (s[SHAKE] = 0.2), dust(base[l]!, 12, e), mark(base[l]!, 16, 0);
    }
    if (t > DONE) s[KO] = -1;
  }

  engine.add({
    read() {
      cap.read();
    },
    step(e, dt) {
      if (s[PEND]) (s[PEND] = 0), click(s[PX]!, s[PY]!);
      if (s[AUTO]! > 0 && (s[AUTO] = s[AUTO]! - dt) <= 0) click(base[1]!, GROUND - 16);
      // At rest unless a hit or a KO says otherwise.
      for (let i = 0; i < 2; i++) (fx[i] = base[i]!), (fy[i] = 0), (ff[i] = 0), (fp[i] = 0), (fs[i] = 0), (fu[i] = 0);
      let busy = s[AUTO]! > 0 || chips.live > 0;
      if (s[T]! >= 0) stepHit(e, dt), (busy = true);
      if (s[KO]! >= 0) stepKO(e, dt), (busy = true);
      s[SHAKE] = Math.max(0, s[SHAKE]! - dt);
      s[FLASH] = Math.max(0, s[FLASH]! - dt);
      if (s[MISS]! >= 0 && (s[MISS] = s[MISS]! - dt) >= 0) busy = true;
      for (let i = 0; i < NB; i++) {
        if (!bl[i]) continue;
        ba[i] = ba[i]! + dt;
        if (ba[i]! < 0.4) busy = true;
        if (bg[i]! > 0 && (bg[i] = bg[i]! - dt) <= 0) (bl[i] = 0), (bg[i] = 0);
        if (bg[i]! > 0) busy = true;
      }
      for (let i = 0; i < NM; i++) if (ml[i]! > 0) (ml[i] = ml[i]! - dt), (busy = true);
      chips.step(dt, 260, GROUND);
      if (cap.step(dt)) busy = true;
      if (busy) (e.busy(), (s[DIRTY] = 1));
    },
    render() {
      cap.render();
      if (!s[DIRTY]) return;
      s[DIRTY] = 0;
      draw(ctx);
    },
  });

  /** A fighter: squashed for a landing (its baked tile, stretched whole pixels) or upside down (tumbling). */
  function fighter(g: CanvasRenderingContext2D, i: number, ox: number, oy: number) {
    const id = i ? "glitch" : "hero", x = Math.round(fx[i]! + ox), y = Math.round(GROUND - fy[i]! + oy);
    if (x < -40) return;
    const pal = fp[i] ? 1 : i && s[ROUND]! >= 2 ? 2 : 0;
    if (!fs[i] && !fu[i]) return cast.draw(g, id, ff[i]!, x, y, 0, 1, pal);
    const t = cast.tile(id, ff[i]!, 1, pal), ax = i ? 17 : 11;
    if (fu[i]) {
      g.save();
      g.translate(x, y - t.height / 2);
      g.scale(1, -1);
      g.drawImage(t, -ax, -Math.round(t.height / 2));
      g.restore();
    } else g.drawImage(t, x - ax - 2, y - t.height + 4, t.width + 4, t.height - 3);
  }
  /** A fighter's pips, over its head: filled while it has them. */
  function pips(g: CanvasRenderingContext2D, i: number, ox: number, oy: number) {
    if (fx[i]! < -40 || (s[KO]! >= 0 && s[KOW] === i)) return;
    const n = max[i]!, x0 = Math.round(fx[i]! - (n * 4 - 1) / 2 + ox), y = Math.round(GROUND - fy[i]! - (i ? 36 : 37) + oy);
    g.fillStyle = C.rim;
    g.fillRect(x0 - 1, y - 1, n * 4 + 1, 4);
    for (let k = 0; k < n; k++) (g.fillStyle = k < hp[i]! ? (i ? C.hurt : C.sys) : C.line), g.fillRect(x0 + k * 4, y, 3, 2);
  }

  function draw(g: CanvasRenderingContext2D) {
    // One shake, on an impact or a landing only: a few whole pixels, decaying.
    const sh = s[SHAKE]!, k = sh > 0 ? Math.ceil((sh / 0.2) * 3) : 0, ox = k ? (k & 1 ? k : -k) : 0, oy = k ? (k & 1 ? -1 : 1) : 0;
    g.fillStyle = C.rim;
    g.fillRect(0, 0, W, H);
    g.drawImage(set.canvas, ox, oy);
    // Marks on the roof, fading in steps (whole pixels, a dither, then gone).
    for (let i = 0; i < NM; i++) {
      const l = ml[i]!;
      if (l <= 0) continue;
      const x0 = Math.round(mx[i]! - mw[i]! / 2) + ox, n = Math.round(mw[i]!), dense = l > MARK * 0.5 ? 1 : 2;
      g.fillStyle = mk[i] ? C.rim : C.base;
      // A skid: a dark streak on the parapet. A crack: a zigzag down into the bricks.
      if (!mk[i]) for (let j = 0; j < n; j += dense) g.fillRect(x0 + j, GROUND + oy, 1, 1);
      else for (let j = 0; j < n; j += dense) g.fillRect(x0 + j, GROUND + oy + ((j >> 1) & 1) + (j > n / 2 ? 1 : 0), 1, 1);
      if (mk[i] && l > MARK * 0.8) (g.fillStyle = C.sys), g.fillRect(x0 + (n >> 1), GROUND - 1 + oy, 1, 1);
    }
    // The score, chalked on the parapet.
    print(g, "YOU", 4, 84 + oy, C.sys);
    print(g, "GLITCH", 46, 84 + oy, C.hurt);
    g.fillStyle = C.ink;
    for (let i = 0; i < Math.min(8, score[0]!); i++) g.fillRect(18 + i * 3, 84 + oy, 1, 5);
    for (let i = 0; i < Math.min(8, score[1]!); i++) g.fillRect(72 + i * 3, 84 + oy, 1, 5);
    const t = s[T]!, word = s[WORD]!, live = t >= 0, a = s[ATK]!, b = 1 - a;
    // Shadows on the roof, under each fighter (shrinking as it leaves the ground).
    g.fillStyle = C.line;
    for (let i = 0; i < 2; i++) if (fx[i]! > -40 && fy[i]! < 40) g.fillRect(Math.round(fx[i]! + ox) - (i ? 9 : 7), GROUND + oy, i ? 19 : 15, 1);
    // Speed streaks behind a dashing attacker.
    if (live && word !== 2 && t >= WIND && t < HIT + 0.05) {
      const d = a === 0 ? -1 : 1, x = fx[a]! + ox + d * (a ? 14 : 12), y = GROUND - fy[a]! + oy;
      g.fillStyle = C.ink;
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(d < 0 ? x - 14 + i * 3 : x - i * 3), Math.round(y - 7 - i * 8), 14 - i * 3, 1);
    }
    fighter(g, 0, ox, oy);
    fighter(g, 1, ox, oy);
    pips(g, 0, ox, oy);
    pips(g, 1, ox, oy);
    // The zap: a kinked bolt from the attacker's fist (or the Glitch's eye) to the struck one.
    if (live && word === 2 && t > HIT - 0.03 && t < HIT + 0.14) {
      const x0 = fx[a]! + ox + (a ? -6 : 15), y0 = GROUND + oy - 17, x1 = fx[b]! + ox + (b ? -10 : 6), y1 = GROUND - fy[b]! + oy - (b ? 15 : 19);
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass ? C.ink : a === 0 ? C.sys : C.attack;
        for (let i = 0; i < 8; i++) {
          const p0 = i / 8, p1 = (i + 1) / 8, ka = i ? kink[i]! : 0, kb = i < 7 ? kink[i + 1]! : 0;
          for (let o = pass ? 0 : -1; o <= (pass ? 0 : 1); o++) line(g, x0 + (x1 - x0) * p0, y0 + (y1 - y0) * p0 + ka + o, x0 + (x1 - x0) * p1, y0 + (y1 - y0) * p1 + kb + o);
        }
      }
    }
    // Impact lines: rays bursting off the struck figure, anchored to it as it flies back.
    const u = t - HIT;
    if (live && u >= 0 && u < 0.16) {
      const r0 = 6 + u * 50, r1 = 13 + u * 80, x = s[IX]! + ox + (fx[b]! - base[b]!), y = s[IY]! + oy - fy[b]!;
      g.fillStyle = C.ink;
      for (let i = 0; i < 12; i++) {
        const c = Math.cos(ray[i]!), sn = Math.sin(ray[i]!), l = i & 1 ? 0.7 : 1;
        line(g, x + c * r0, y + sn * r0, x + c * r1 * l, y + sn * r1 * l);
        if (!(i & 1)) line(g, x + c * r0 + 1, y + sn * r0, x + c * r1 + 1, y + sn * r1);
      }
      // The contact star, for the first frames.
      if (u < 0.07) g.fillRect(x - 5, y, 11, 1), g.fillRect(x, y - 5, 1, 11), g.fillRect(x - 2, y - 2, 5, 5);
    }
    // A KO'd fighter twinkles where it left the sky.
    const ko = s[KO]!;
    if (ko >= GONE && ko < GONE + 0.3) {
      const l = s[KOW]!, x = l ? 150 : 10, y = l ? 26 : 22, r = ko < GONE + 0.15 ? 3 : 1;
      g.fillStyle = C.ink;
      g.fillRect(x - r, y, r * 2 + 1, 1);
      g.fillRect(x, y - r, 1, r * 2 + 1);
    }
    // A swing at nothing: MISS, where you clicked.
    if (s[MISS]! > 0) {
      const x = Math.round(s[MX]! - 7), y = Math.round(s[MY]! - 3 - (0.6 - s[MISS]!) * 12);
      g.fillStyle = C.rim;
      g.fillRect(x - 2, y - 2, 19, 9);
      print(g, "MISS", x, y, C.ink);
    }
    chips.draw(g, ox, oy);
    // The balloons: each slams in big, settles, and stays (an older one shrinks away).
    for (let i = 0; i < NB; i++) {
      if (!bl[i] || ba[i]! < 0) continue;
      const age = ba[i]!, go = bg[i]!;
      const z = go > 0 ? go / 0.16 : age < 0.04 ? 1.3 : age < 0.08 ? 0.92 : 1;
      const w = Math.round(BW * z), h = Math.round(BH * z);
      g.drawImage(ball[bw[i]!]!, Math.round(bx[i]! - w / 2 + ox), Math.round(by[i]! - h / 2 + oy), w, h);
    }
  }

  engine.start();
  return {
    engine,
    hit,
    /** KOs scored: [the hero's, the Glitch's]. */
    get score() {
      return [score[0]!, score[1]!];
    },
    /** Pips left: [the hero's, the Glitch's]. */
    get hp() {
      return [hp[0]!, hp[1]!];
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads) is this scene at this second, with no
 *  tap: the hero's first POW! has just landed on the Glitch (scripts/gallery-posters.mjs draws it). */
export const posterAt = 0.86;

/** For `slot(fig, () => import("./pow-bam-zap").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => pow(stage, slot, first);
