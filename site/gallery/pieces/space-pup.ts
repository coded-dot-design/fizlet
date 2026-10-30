// BLIP, the space-age pup of the space-age family pieces (belly rub, walkway): an original cartoon
// pup (cream, a teal ear and eye patch, a coral collar with a little rocket tag in a purple-to-orange
// gradient) drawn as a puppet, not a sprite sheet: a body, four legs, a tail, a head with a muzzle
// and two floppy ears, each a crisp pixel ellipse or capsule with a 1 px dusk-ink rim, posed by a
// few numbers (gait, kick, ears, tongue, face) and turned as one (rolled belly up, tumbling).
// Also what the pieces share: the atomic-age palette, the page's letters as knockable bodies
// (moved only through custom properties written by the engine's ledger, so Recall gives the page
// back), a small particle pool (hearts, sparkles, dust, sweat) and speech bubbles in the shared
// 3 × 5 pixel font. Whole canvas pixels only, on a W × H art canvas scaled up crisp with CSS.
import type { Ledger } from "../../../src/kernel/index";
import { print, shout, textW } from "./pixel-font";

/** The art: 240 × 135 (16:9), scaled crisp to the card. */
export const W = 240, H = 135;

/** The atomic-age palette: pastel teal, coral and cream under a starry dusk sky. */
export const P = {
  rim: "#231a45",
  cream: "#fff4dc",
  shade: "#ecd2a8",
  belly: "#ffd6c9",
  teal: "#3fc8b6",
  tealD: "#23908f",
  coral: "#ff7b5f",
  coralD: "#d9533f",
  pink: "#ff8fab",
  gold: "#ffc84a",
  white: "#ffffff",
  dusk: "#3a2470",
  violet: "#8b5cf6",
  orange: "#ff8a3d",
};

const { abs, ceil, cos, floor, max, min, PI, round, sin, sqrt } = Math;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------- Crisp pixel shapes (one fillRect per row) ----------

/** A filled ellipse (radii rx, ry, turned by a), pixel centres inside. */
export function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a: number, col: string) {
  const c = cos(a), s = sin(a), irx = 1 / (rx * rx), iry = 1 / (ry * ry), A = c * c * irx + s * s * iry, Cq = s * s * irx + c * c * iry, R = max(rx, ry);
  g.fillStyle = col;
  for (let y = floor(cy - R); y <= ceil(cy + R); y++) {
    const dy = y + 0.5 - cy, B = 2 * dy * c * s * (irx - iry), C = dy * dy * Cq - 1, d = B * B - 4 * A * C;
    if (d < 0) continue;
    const q = sqrt(d), x0 = ceil(cx + (-B - q) / (2 * A) - 0.5), x1 = floor(cx + (-B + q) / (2 * A) - 0.5);
    if (x1 >= x0) g.fillRect(x0, y, x1 - x0 + 1, 1);
  }
}

/** A capsule from (x0, y0) to (x1, y1), radius r: its row spans, from discs along the segment. */
export function capsule(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, r: number, col: string) {
  const len = abs(x1 - x0) + abs(y1 - y0), n = max(1, ceil(len / max(0.6, r * 0.5)));
  g.fillStyle = col;
  for (let y = floor(min(y0, y1) - r); y <= ceil(max(y0, y1) + r); y++) {
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= n; i++) {
      const cx = x0 + ((x1 - x0) * i) / n, dy = y + 0.5 - (y0 + ((y1 - y0) * i) / n), d = r * r - dy * dy;
      if (d < 0) continue;
      const q = sqrt(d);
      if (cx - q < lo) lo = cx - q;
      if (cx + q > hi) hi = cx + q;
    }
    const a = ceil(lo - 0.5), b = floor(hi - 0.5);
    if (b >= a) g.fillRect(a, y, b - a + 1, 1);
  }
}

// ---------- BLIP, the pup ----------

/** Face: eyes and mouth. */
export const HAPPY = 0, BLISS = 1, WORRY = 2, DIZZY = 3, SHUT = 4, WOW = 5;
// 3 × 3 eye glyphs (bit 8 top left): open (with a shine, drawn apart), ^ bliss, wide, x, shut, ring.
const EYES = [0b110110110, 0b010101000, 0b111111111, 0b101010101, 0b000111000, 0b111101111];

/** One pup: where, how big, which way, and its pose. The pieces set these; draw() reads them. */
export class Pup {
  /** Body centre (art px), scale, facing (1 right, -1 left), turn (radians; PI is belly up). */
  x = 0;
  y = 0;
  s = 1;
  dir = 1;
  rot = 0;
  /** Leg angles from straight down (radians, + forward): far hind, far front, near hind, near front. */
  leg = new Float32Array(4);
  /** Leg length (1 full; less is tucked under). */
  len = 1;
  /** Ears: 0 hang, 1 stream back; flap adds a flutter. */
  ear = 0;
  flap = 0;
  /** Tail swing (radians). */
  wag = 0;
  face = HAPPY;
  /** Tongue out, 0…1. */
  tongue = 0;
  /** Looks: the head tilts by this (radians). */
  tilt = 0;

  /** Legs for a gait: phase (radians) and how far they swing (0 stand … 1 full gallop). */
  gait(ph: number, amt: number) {
    const l = this.leg, a = 0.75 * amt;
    l[0] = sin(ph + 0.6) * a;
    l[1] = sin(ph + PI + 0.6) * a;
    l[2] = sin(ph + PI) * a;
    l[3] = sin(ph) * a;
  }
}

let G: CanvasRenderingContext2D, U: Pup, RIM = false, TX = 0, TY = 0, CR = 1, SR = 0;
/** Local (art px, body centre origin, facing right) to world. */
function T(lx: number, ly: number) {
  const fx = lx * U.dir;
  TX = U.x + (fx * CR - ly * SR) * U.s;
  TY = U.y + (fx * SR + ly * CR) * U.s;
}
const ang = (a: number) => U.rot + (U.dir > 0 ? a : -a);
/** A body part: an ellipse (local), rim or fill by pass. */
function E(lx: number, ly: number, rx: number, ry: number, a: number, col: string) {
  T(lx, ly);
  const o = RIM ? 1 : 0;
  ellipse(G, TX, TY, rx * U.s + o, ry * U.s + o, ang(a), RIM ? P.rim : col);
}
/** A body part: a capsule (local), rim or fill by pass. */
function K(x0: number, y0: number, x1: number, y1: number, r: number, col: string) {
  T(x0, y0);
  const ax = TX, ay = TY;
  T(x1, y1);
  capsule(G, ax, ay, TX, TY, r * U.s + (RIM ? 1 : 0), RIM ? P.rim : col);
}
/** A 3 × 3 glyph centred on local (lx, ly), turned upright or upside down with the pup. */
function glyph(bits: number, lx: number, ly: number, col: string, k: number) {
  T(lx, ly);
  const up = CR >= 0, x = round(TX) - k, y = round(TY) - k;
  G.fillStyle = col;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (bits & (1 << (8 - r * 3 - c))) G.fillRect(x + (U.dir > 0 === up ? c : 2 - c) * k, y + (up ? r : 2 - r) * k, k, k);
}

/** A leg: hip at local (hx, 3), its angle, length; a paw at the end. */
function leg(hx: number, a: number, col: string) {
  const L = 8.5 * U.len, px = hx + sin(a) * L, py = 3 + cos(a) * L;
  K(hx, 2, px, py, 2.7, col);
  E(px + 1.2, py + 0.3, 3.5, 2.3, 0, col);
}

function tail() {
  const t = 0.9 + U.wag, ex = -11 - cos(t) * 8, ey = -3 - sin(t) * 8;
  K(-10.5, -2, ex, ey, 1.7, P.cream);
  E(ex - cos(t) * 1.5, ey - sin(t) * 1.5, 2.2, 2.2, 0, P.tealD);
}

function ear(near: boolean) {
  const e = U.ear, f = U.flap, bx = near ? 9.5 : 7, by = near ? -19.5 : -20.5, hx = near ? 6.5 : 3.5;
  // Hanging down behind the cheek … streaming back behind the head.
  hd(bx, by);
  const ax = HX, ay = HY;
  hd(hx + (-5 - hx) * e + f * 1.5, -10 + (-19 + 10) * e - f * 2);
  K(ax, ay, HX, HY, near ? 2.6 : 2.3, near ? P.teal : P.tealD);
}

let HX = 0, HY = 0, HC = 1, HS = 0;
/** A point on the head, tilted about the neck at local (7, -6). */
function hd(x: number, y: number) {
  const dx = x - 7, dy = y + 6;
  HX = 7 + dx * HC - dy * HS;
  HY = -6 + dx * HS + dy * HC;
}
/** A head part: an ellipse at a head point. */
function HE(x: number, y: number, rx: number, ry: number, col: string) {
  hd(x, y);
  E(HX, HY, rx, ry, U.tilt, col);
}
function HG(bits: number, x: number, y: number, col: string, k: number) {
  hd(x, y);
  glyph(bits, HX, HY, col, k);
}

/** The head: skull, muzzle; then (fill pass) patch, eye, nose, mouth, tongue. Tilts about the neck. */
function head() {
  HE(13, -13.5, 9.6, 8.8, P.cream);
  HE(20.8, -9.8, 5.4, 4.4, P.cream);
  if (RIM) return;
  HE(15, -16, 3.6, 3.8, P.teal);
  HE(25.4, -12, 2.1, 1.5, P.rim);
  const k = U.s > 1.3 ? 2 : 1, f = U.face;
  HG(EYES[f]!, 15.6, -16, P.rim, k);
  if (f === HAPPY || f === WORRY) HG(0b100000000, 15.6, -16, P.white, k);
  // The mouth: a grin under the muzzle (an O when surprised or worried).
  HG(f === WOW || f === WORRY ? 0b010101010 : 0b100100011, 21.5, -6.2, P.rim, 1);
  if (U.tongue > 0.08) {
    hd(21, -5.6);
    const ax = HX, ay = HY;
    hd(21.3 + U.flap, -5.4 + 4.8 * U.tongue);
    K(ax, ay, HX, HY, 1.5, P.pink);
  }
}

/** The collar and its rocket tag (it hangs straight down, whichever way the pup is turned). */
function collar() {
  hd(3.5, -8);
  const ax = HX, ay = HY;
  hd(7.5, -3);
  K(ax, ay, HX, HY, 1.4, P.coral);
  if (RIM) return;
  T(HX - 0.3, HY + 1.2);
  const k = U.s > 1.3 ? 2 : 1, x = round(TX) - k, y = round(TY);
  // A rocket, purple nose to orange flame: a nod to the framework that builds the site.
  const R = [0b010, 0b111, 0b111, 0b111, 0b101], C = [P.violet, P.violet, "#b45ad6", "#e46a8a", P.orange];
  G.fillStyle = P.rim;
  G.fillRect(x - 1, y - 1, 3 * k + 2, 5 * k + 2);
  for (let r = 0; r < 5; r++) {
    G.fillStyle = C[r]!;
    for (let c = 0; c < 3; c++) if (R[r]! & (4 >> c)) G.fillRect(x + c * k, y + r * k, k, k);
  }
}

const GROUPS = [
  () => (leg(-6.5, U.leg[0]!, P.shade), leg(6.5, U.leg[1]!, P.shade), tail()),
  () => (E(0, 0, 12.2, 8.6, 0, P.cream), RIM || (E(-3, -4, 3.6, 2.2, 0, P.tealD), E(1, 4, 7, 3.2, 0, P.belly))),
  () => (leg(-7.5, U.leg[2]!, P.cream), leg(7.5, U.leg[3]!, P.cream)),
  () => ear(false),
  head,
  () => ear(true),
  collar,
];

/** Draw a pup: each group's rim, then its fill, so every part reads against the one under it. */
export function drawPup(g: CanvasRenderingContext2D, pup: Pup) {
  G = g;
  U = pup;
  CR = cos(pup.rot);
  SR = sin(pup.rot);
  HC = cos(pup.tilt);
  HS = sin(pup.tilt);
  for (let i = 0; i < GROUPS.length; i++) {
    RIM = true;
    GROUPS[i]!();
    RIM = false;
    GROUPS[i]!();
  }
}

/** A point on the pup (local, as in the rig) in world art px: [x, y] written to `out`. */
export function pupAt(pup: Pup, lx: number, ly: number, out: Float32Array) {
  U = pup;
  CR = cos(pup.rot);
  SR = sin(pup.rot);
  T(lx, ly);
  out[0] = TX;
  out[1] = TY;
}

// ---------- The page's letters, as bodies ----------

const XS = Array.from({ length: 2 * W + 1 }, (_, i) => `${(((i - W) * 100) / W).toFixed(3)}cqw`);
const YS = Array.from({ length: 2 * H + 1 }, (_, i) => `${(((i - H) * 100) / W).toFixed(3)}cqw`);
const RS = Array.from({ length: 61 }, (_, i) => `${(i - 30) * 6}deg`);
/** Letter modes: home (springing back from a bump), flying, lying on the floor, floating home. */
export const HOME = 0, FLY = 1, REST = 2, BACK = 3;

/**
 * Every `<i>` in `wrap` (a letter, a word, a button) as a body: a box (art px), knocked off its
 * place by a hit, tumbling under gravity, bouncing off the floor and walls, lying there until it is
 * sent home, when it floats back with a glow. Moved only through --x, --y, --r and data-hit.
 * (A closure, not a class: its arrays minify to one letter each.)
 */
export function letters(wrap: HTMLElement, floor: number, rnd: () => number) {
  const els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length, f = () => new Float32Array(n), i16 = () => new Int16Array(n);
  const EX = f(), EY = f(), EW = f(), EH = f(), OX = f(), OY = f(), VX = f(), VY = f(), RO = f(), RV = f(), D = f(), UU = f(), AX = f(), AY = f(), AR = f(), LIT = f();
  const M = new Uint8Array(n), LL = new Uint8Array(n), LX = i16(), LY = i16(), LR = i16();
  return {
    n, EX, EY, EW, EH, M,
    /** Read every box (in the READ phase: offsets only, no transforms), in art px. */
    measure() {
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        EX[i] = x * k;
        EY[i] = y * k;
        EW[i] = el.offsetWidth * k;
        EH[i] = el.offsetHeight * k;
      }
    },
    /** Knock letter i flying. */
    hit(i: number, vx: number, vy: number) {
      if (M[i] === BACK) return;
      M[i] = FLY;
      VX[i] = vx;
      VY[i] = vy;
      RV[i] = (rnd() - 0.5) * 900 + vx * 2;
      LIT[i] = 0.2;
    },
    /** A soft bump from below: it hops and wobbles in place (home letters only). */
    bump(i: number, vy: number) {
      if (M[i] !== HOME || OY[i]! < -1) return;
      VY[i] = vy;
      RV[i] = (rnd() - 0.5) * 300;
      LIT[i] = 0.25;
    },
    /** A letter (home or lying about, not flying) whose box comes within r of (x, y), or -1. */
    near(x: number, y: number, r: number) {
      for (let i = 0; i < n; i++) {
        if (M[i] === BACK || M[i] === FLY) continue;
        const bx = EX[i]! + OX[i]!, by = EY[i]! + OY[i]!, nx = clamp(x, bx, bx + EW[i]!), ny = clamp(y, by, by + EH[i]!);
        if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return i;
      }
      return -1;
    },
    /** Everything off its place floats home, left to right, after `wait` s. */
    home(wait: number) {
      for (let i = 0; i < n; i++) if (M[i] === FLY || M[i] === REST) D[i] = wait + EX[i]! * 0.004 + rnd() * 0.15;
    },
    /** How many are off their place. */
    get out() {
      let k = 0;
      for (let i = 0; i < n; i++) if (M[i] !== HOME) k++;
      return k;
    },
    /** One fixed step; true while anything moves. */
    step(dt: number) {
      let busy = false;
      for (let i = 0; i < n; i++) {
        const m = M[i]!;
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (busy = true);
        if (D[i]! > 0) {
          busy = true;
          if ((D[i] = D[i]! - dt) <= 0) (M[i] = BACK), (UU[i] = 0), (AX[i] = OX[i]!), (AY[i] = OY[i]!), (AR[i] = RO[i]!);
        }
        if (m === HOME) {
          // Springs: a hop falls back, a wobble rings out.
          if (OY[i]! < 0 || VY[i] !== 0) {
            VY[i] = VY[i]! + 600 * dt;
            OY[i] = OY[i]! + VY[i]! * dt;
            if (OY[i]! >= 0) (OY[i] = 0), (VY[i] = VY[i]! > 60 ? -VY[i]! * 0.3 : 0);
            busy = true;
          }
          RV[i] = RV[i]! + (-120 * RO[i]! - 10 * RV[i]!) * dt;
          RO[i] = RO[i]! + RV[i]! * dt;
          if (abs(RO[i]!) + abs(RV[i]!) < 0.5) RO[i] = RV[i] = 0;
          else busy = true;
        } else if (m === FLY) {
          busy = true;
          VY[i] = VY[i]! + 380 * dt;
          OX[i] = OX[i]! + VX[i]! * dt;
          OY[i] = OY[i]! + VY[i]! * dt;
          RO[i] = RO[i]! + RV[i]! * dt;
          const x = EX[i]! + OX[i]!, y = EY[i]! + OY[i]!, w = EW[i]!, h = EH[i]!;
          if (x < 0 && VX[i]! < 0) (OX[i] = -EX[i]!), (VX[i] = -VX[i]! * 0.5);
          if (x + w > W && VX[i]! > 0) (OX[i] = W - w - EX[i]!), (VX[i] = -VX[i]! * 0.5);
          if (y < 0 && VY[i]! < 0) (OY[i] = -EY[i]!), (VY[i] = -VY[i]! * 0.4);
          if (y + h > floor && VY[i]! > 0) {
            OY[i] = floor - h - EY[i]!;
            if (VY[i]! > 90) (VY[i] = -VY[i]! * 0.35), (VX[i] = VX[i]! * 0.7), (RV[i] = RV[i]! * 0.5);
            else {
              // It comes to rest: flat, or on its side (a long word always lies flat).
              M[i] = REST;
              VY[i] = VX[i] = RV[i] = 0;
              const q = round(RO[i]! / 90) * 90;
              RO[i] = abs(q % 180) === 90 && w > h * 1.6 ? 0 : clamp(q, -90, 90);
            }
          }
        } else if (m === BACK) {
          busy = true;
          const u = min(1, (UU[i] = UU[i]! + dt / 0.75)), q = u * u * (3 - 2 * u);
          OX[i] = AX[i]! * (1 - q);
          OY[i] = AY[i]! * (1 - q) - sin(u * PI) * 12;
          RO[i] = AR[i]! * (1 - q);
          LIT[i] = 0.3;
          if (u >= 1) (M[i] = HOME), (OX[i] = OY[i] = RO[i] = 0), (VY[i] = -50), (RV[i] = (rnd() - 0.5) * 200);
        }
      }
      return busy;
    },
    /** Write what changed (RENDER phase). */
    render(L: Ledger) {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, x = clamp(round(OX[i]!), -W, W), y = clamp(round(OY[i]!), -H, H), r = clamp(round((((RO[i]! % 360) + 540) % 360 - 180) / 6), -30, 30), lt = LIT[i]! > 0 ? 1 : 0;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--x", XS[x + W]!) : L.unstyle(el, "--x");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", YS[y + H]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", RS[r + 30]!) : L.unstyle(el, "--r");
        if (lt !== LL[i]) (LL[i] = lt), L.attr(el, "data-hit", lt ? "" : null);
      }
    },
  };
}

// ---------- Particles: hearts, sparkles, dust, sweat, stars ----------

export const HEART = 0, SPARK = 1, DUST = 2, SWEAT = 3, STAR = 4;
const HEART_ROWS = [0b0110110, 0b1111111, 0b1111111, 0b0111110, 0b0011100, 0b0001000];

/** A bounded pool: type, place, velocity, life left (a closure: its arrays minify). */
export function particles() {
  const TY = new Uint8Array(64), X = new Float32Array(64), Y = new Float32Array(64), VX = new Float32Array(64), VY = new Float32Array(64), L = new Float32Array(64);
  let n = 0, next = 0;
  return {
    add(t: number, x: number, y: number, vx: number, vy: number, life: number) {
      const k = n < 64 ? n++ : (next = (next + 1) & 63);
      TY[k] = t;
      X[k] = x;
      Y[k] = y;
      VX[k] = vx;
      VY[k] = vy;
      L[k] = life;
    },
    step(dt: number) {
      for (let k = n - 1; k >= 0; k--) {
        if ((L[k] = L[k]! - dt) <= 0) {
          const j = --n;
          TY[k] = TY[j]!; X[k] = X[j]!; Y[k] = Y[j]!; VX[k] = VX[j]!; VY[k] = VY[j]!; L[k] = L[j]!;
          continue;
        }
        const t = TY[k];
        // Hearts and sparkles float up (joy); dust drifts and slows; sweat and stars fall.
        if (t === SWEAT || t === STAR) VY[k] = VY[k]! + 260 * dt;
        else VX[k] = VX[k]! * (1 - 3 * dt);
        if (t === DUST) VY[k] = VY[k]! * (1 - 3 * dt);
        X[k] = X[k]! + VX[k]! * dt;
        Y[k] = Y[k]! + VY[k]! * dt;
      }
      return n > 0;
    },
    draw(g: CanvasRenderingContext2D) {
      for (let k = 0; k < n; k++) {
        const x = round(X[k]!), y = round(Y[k]!), l = L[k]!, t = TY[k];
        if (t === HEART) {
          g.fillStyle = P.rim;
          g.fillRect(x - 4, y - 1, 9, 6), g.fillRect(x - 3, y - 2, 7, 1), g.fillRect(x - 2, y + 5, 5, 1), g.fillRect(x - 1, y + 6, 3, 1);
          g.fillStyle = l < 0.25 && (round(l * 40) & 1) ? P.pink : P.coral;
          for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (HEART_ROWS[r]! & (64 >> c)) g.fillRect(x - 3 + c, y - 1 + r, 1, 1);
        } else if (t === SPARK || t === STAR) {
          g.fillStyle = t === STAR ? P.gold : l > 0.3 ? P.white : P.gold;
          const s = l > 0.25 ? 2 : 1;
          g.fillRect(x - s, y, 2 * s + 1, 1);
          g.fillRect(x, y - s, 1, 2 * s + 1);
        } else if (t === DUST) {
          g.fillStyle = l > 0.3 ? P.cream : P.shade;
          const s = l > 0.4 ? 3 : l > 0.2 ? 2 : 1;
          g.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        } else {
          g.fillStyle = P.rim;
          g.fillRect(x - 1, y - 1, 3, 4);
          g.fillStyle = P.teal;
          g.fillRect(x, y, 1, 2);
        }
      }
    },
  };
}

// ---------- Words: a speech bubble, a shout ----------

/** A speech bubble with its tail down to (tx, ty), the text above it (3 × 5, one row). */
export function bubble(g: CanvasRenderingContext2D, s: string, tx: number, ty: number) {
  const w = textW(s) + 6, h = 9, x = round(clamp(tx - w / 2, 2, W - w - 2)), y = round(clamp(ty - h - 4, 2, H - h - 2));
  g.fillStyle = P.rim;
  g.fillRect(x, y - 1, w, h + 2);
  g.fillRect(x - 1, y, w + 2, h);
  g.fillStyle = P.cream;
  g.fillRect(x, y, w, h);
  // The tail: a few steps down toward the speaker.
  const cx = round(clamp(tx, x + 3, x + w - 4));
  g.fillStyle = P.rim;
  g.fillRect(cx - 1, y + h, 4, 2), g.fillRect(cx, y + h + 2, 2, 2);
  g.fillStyle = P.cream;
  g.fillRect(cx, y + h - 1, 2, 2), g.fillRect(cx, y + h + 1, 1, 2);
  print(g, s, x + 3, y + 2, P.rim);
}

/** A shout: big comic lettering, cream face, coral drop, dusk rim, centred on x. */
export const yell = (g: CanvasRenderingContext2D, s: string, x: number, y: number, k = 2) =>
  shout(g, s, clamp(x, textW(s, k) / 2 + 3, W - textW(s, k) / 2 - 3), y, k, P.cream, P.coral, P.rim);
