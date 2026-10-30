// Shared by the Halloween fights (HUSH vs SNOOZE, NANA vs DUKE): the page's own elements as boxes a
// fight can hit, in art pixels (a 160-wide canvas grid). Each box is read from layout only after a
// resize, knocked on a spring (x, y, turn) when something reaches it, can be cut (a slash splits the
// glyph along a line: the stage's CSS draws the two halves from its `data-c`) and healed again, and
// is written through the engine's ledger only when a value changes, so Recall gives the page back
// byte for byte. Plus a fixed pool of sparks. No allocation per frame.
import type { createEngine } from "../../../src/kernel/index";

type Engine = ReturnType<typeof createEngine>;
const { abs, cos, max, min, round, sin } = Math;
// Offsets in half art pixels (1 art px = 0.625cqw on a 160-wide grid) and whole degrees.
const PX = Array.from({ length: 121 }, (_, i) => `${(i - 60) * 0.3125}cqw`);
const DG = Array.from({ length: 91 }, (_, i) => `${i - 45}deg`);

export function pageBoxes(engine: Engine, wrap: HTMLElement, els: HTMLElement[], W: number) {
  const L = engine.ledger, n = els.length;
  const X = new Float32Array(n), Y = new Float32Array(n), BW = new Float32Array(n), BH = new Float32Array(n), CD = new Float32Array(n);
  const P = new Float32Array(n * 3), V = new Float32Array(n * 3), LW = new Int16Array(n * 3), LIT = new Float32Array(n);
  /** Cut: 0 whole, 1 a slash down to the right, 2 down to the left. Written: CW (and the lit flag, LL). */
  const CUT = new Uint8Array(n), CW = new Uint8Array(n), LL = new Uint8Array(n);
  let res = 1;
  const ro = new ResizeObserver(() => ((res = 1), engine.wake()));
  ro.observe(wrap);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const box = {
    n, X, Y, BW, BH, CUT,
    /** Layout, once per resize (the read phase). */
    read() {
      if (!res) return;
      res = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        X[i] = x * k;
        Y[i] = y * k;
        BW[i] = el.offsetWidth * k;
        BH[i] = el.offsetHeight * k;
      }
    },
    /** Something reached box i: a push (art px/s), a turn, and maybe a cut (1 or 2). */
    hit(i: number, vx: number, vy: number, cut = 0) {
      if (CD[i]! > 0) return false;
      CD[i] = 0.2;
      LIT[i] = 0.25;
      V[i * 3] = V[i * 3]! + vx * 0.15;
      V[i * 3 + 1] = V[i * 3 + 1]! + vy * 0.15;
      V[i * 3 + 2] = V[i * 3 + 2]! + (vx < 0 ? -1 : 1) * (120 + abs(vx) * 0.6);
      if (cut) CUT[i] = cut;
      return true;
    },
    /** Every box overlapping the rect: hit (and cut). Returns how many. */
    sweep(x0: number, y0: number, x1: number, y1: number, vx: number, vy: number, cut = 0) {
      let k = 0;
      for (let i = 0; i < n; i++) if (X[i]! < x1 && X[i]! + BW[i]! > x0 && Y[i]! < y1 && Y[i]! + BH[i]! > y0 && box.hit(i, vx, vy, cut)) k++;
      return k;
    },
    /** The box under point (x, y) grown by r, or -1. */
    at(x: number, y: number, r: number) {
      for (let i = 0; i < n; i++) if (x > X[i]! - r && x < X[i]! + BW[i]! + r && y > Y[i]! - r && y < Y[i]! + BH[i]! + r) return i;
      return -1;
    },
    /** Springs home; true while anything still moves or is lit. */
    step(dt: number) {
      let busy = false;
      for (let i = 0; i < n * 3; i++) {
        V[i] = V[i]! + (-110 * P[i]! - 9 * V[i]!) * dt;
        P[i] = P[i]! + V[i]! * dt;
        if (abs(P[i]!) + abs(V[i]!) < 0.2) P[i] = V[i] = 0;
        else busy = true;
      }
      for (let i = 0; i < n; i++) {
        if (CD[i]! > 0) CD[i] = CD[i]! - dt;
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (busy = true);
      }
      return busy;
    },
    /** Change-only writes through the ledger: --x, --y (half art px), --r (deg), data-cut, data-hit. */
    render() {
      for (let i = 0; i < n * 3; i++) {
        const c = i % 3, v = c === 2 ? max(-45, min(45, round(P[i]!))) : max(-60, min(60, round(P[i]! * 2)));
        if (v === LW[i]) continue;
        LW[i] = v;
        const el = els[(i / 3) | 0]!, prop = c === 0 ? "--x" : c === 1 ? "--y" : "--r";
        v ? L.style(el, prop, c === 2 ? DG[v + 45]! : PX[v + 60]!) : L.unstyle(el, prop);
      }
      for (let i = 0; i < n; i++) {
        const l = LIT[i]! > 0 ? 1 : 0;
        if (l !== LL[i]) (LL[i] = l), L.attr(els[i]!, "data-hit", l ? "" : null);
        if (CUT[i] !== CW[i]) (CW[i] = CUT[i]!), L.attr(els[i]!, "data-cut", CUT[i] ? (CUT[i] === 1 ? "a" : "b") : null);
      }
    },
  };
  return box;
}

/** A fixed pool of sparks (x, y, velocity, life, colour index), falling to `floor`. */
export function sparkPool(rnd: () => number, cap: number, colors: string[]) {
  const X = new Float32Array(cap), Y = new Float32Array(cap), VX = new Float32Array(cap), VY = new Float32Array(cap), T = new Float32Array(cap), K = new Uint8Array(cap);
  let n = 0;
  return {
    /** k sparks of colour c (and c + 1) from (x, y) at speed sp; `up` lifts them. */
    burst(x: number, y: number, k: number, c: number, sp: number, up = 0.4) {
      for (let i = 0; i < k && n < cap; i++, n++) {
        const a = rnd() * 6.283, v = sp * (0.35 + rnd());
        X[n] = x;
        Y[n] = y;
        VX[n] = cos(a) * v;
        VY[n] = sin(a) * v - sp * up;
        T[n] = 0.25 + rnd() * 0.4;
        K[n] = min(colors.length - 1, c + ((rnd() * 2) | 0));
      }
    },
    step(dt: number, floor: number, g = 300) {
      for (let i = n - 1; i >= 0; i--) {
        if ((T[i] = T[i]! - dt) <= 0) {
          n--;
          (X[i] = X[n]!), (Y[i] = Y[n]!), (VX[i] = VX[n]!), (VY[i] = VY[n]!), (T[i] = T[n]!), (K[i] = K[n]!);
          continue;
        }
        VY[i] = VY[i]! + g * dt;
        X[i] = X[i]! + VX[i]! * dt;
        Y[i] = min(floor, Y[i]! + VY[i]! * dt);
      }
      return n > 0;
    },
    draw(g: CanvasRenderingContext2D) {
      for (let i = 0; i < n; i++) (g.fillStyle = colors[K[i]!]!), g.fillRect(round(X[i]!), round(Y[i]!), T[i]! > 0.3 ? 2 : 1, 1);
    },
  };
}

/** Rows mirrored left to right (a sprite frame facing the other way). */
export const flip = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

/** Each frame, then the same frames facing left: padded to w and shifted so the body's centre column
 *  (cx) is the sprite's (its pivot: ax = w - 1 - cx), so a fighter turning round stays on its feet. */
export function facing(f: string[][], w: number, cx: number) {
  const out = f.map((rows) => rows.map((r) => ".".repeat(w - 1 - 2 * cx) + r.padEnd(w, ".")));
  return [...out, ...out.map(flip)];
}
