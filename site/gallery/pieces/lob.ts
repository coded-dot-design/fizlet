// Shared by the artillery duels (Pricing war, Hill war): the pixel blast every shell ends in, and a
// tiny baker for the critters. A blast is a fireball that cools from white to purple, one or two
// shock rings, debris that bounces once on the ground and lies there fading, sparks, smoke that
// climbs and spreads, a full-stage flash and a shake (both decay). One fixed pool (struct of
// arrays), so a blast allocates nothing; it settles: every part has a life, and `step` says when
// the last one is gone. Whole pixels only, for a pixel canvas scaled up with CSS.
import { C } from "./ink";

const { cos, sin, sqrt, round, min, max, abs } = Math;
const DEBRIS = 0, SMOKE = 1, FIRE = 2, RING = 3, SPARK = 4;
const HEAT = [C.cmd, C.attack, "#ff8a1f", C.hurt, C.ink];

/** A filled pixel disc of radius r centred on (x, y) (one fillRect per row). */
export function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  x = round(x);
  y = round(y);
  for (let d = -r; d <= r; d++) {
    const w = round(sqrt(r * r - d * d));
    g.fillRect(x - w, y + d, w * 2 + 1, 1);
  }
}

/** Bake pixel rows (char → colour) to a canvas with a 1 px rim; `flip` mirrors it. */
export function art(rows: string[], cols: Record<string, string>, flip = 0) {
  const w = rows[0]!.length + 2, h = rows.length + 2, c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  for (let p = 0; p < 2; p++)
    rows.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        const col = cols[ch];
        if (!col) return;
        const X = flip ? w - 2 - x : x + 1;
        g.fillStyle = p ? col : C.rim;
        p ? g.fillRect(X, y + 1, 1, 1) : g.fillRect(X - 1, y, 3, 3);
      }),
    );
  return c;
}

/** The blast pool: `cap` parts on a stage `w` × `h`; `ground(x)` is where debris lands; `rnd` is
 *  the scene's seeded random (a replay draws the same blast); `dirt` tints a share of the debris. */
export function booms(cap: number, w: number, h: number, ground: (x: number) => number, rnd: () => number, dirt: string = C.rim) {
  const BITS = [C.hurt, "#ff8a1f", C.attack, dirt, C.ink];
  const X = new Float32Array(cap), Y = new Float32Array(cap), VX = new Float32Array(cap), VY = new Float32Array(cap);
  const L = new Float32Array(cap), M = new Float32Array(cap), R = new Float32Array(cap), K = new Uint8Array(cap), CO = new Uint8Array(cap);
  const st = new Float32Array(4); // live, shake, flash, wind
  const put = (k: number, x: number, y: number, vx: number, vy: number, r: number, life: number, c: number) => {
    const i = st[0]!;
    if (i >= cap) return;
    st[0] = i + 1;
    K[i] = k;
    X[i] = x;
    Y[i] = y;
    VX[i] = vx;
    VY[i] = vy;
    R[i] = r;
    L[i] = M[i] = life;
    CO[i] = c;
  };
  return {
    get live() {
      return st[0]!;
    },
    /** The shake left (seconds-ish): a whole-pixel offset for this frame, alternating sides. */
    jolt(frame: number) {
      const s = st[1]!;
      return s > 0 ? (frame & 1 ? 1 : -1) * min(4, round(s * 14)) : 0;
    },
    /** Smoke drifts with the wind (px/s). */
    set wind(v: number) {
      st[3] = v;
    },
    /** A puff (a muzzle, a landing): smoke only. */
    puff(x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) put(SMOKE, x + (rnd() - 0.5) * 4, y, (rnd() - 0.5) * 16, -8 - rnd() * 10, 1 + rnd() * 1.5, 0.5 + rnd() * 0.4, 0);
    },
    /** A blast at (x, y): power 1 (a pellet) to 3 (the mega bomb). */
    blast(x: number, y: number, p: number) {
      put(FIRE, x, y, 0, 0, 2 + p * 2.5, 0.22 + p * 0.1, 0);
      for (let i = 0; i < p * 2; i++) put(FIRE, x + (rnd() - 0.5) * p * 6, y + (rnd() - 0.5) * p * 4, 0, -10, 1 + p * 1.2, 0.3 + rnd() * 0.25, 0);
      put(RING, x, y, 0, 0, 7 + p * 9, 0.32 + p * 0.06, 0);
      if (p > 1.5) put(RING, x, y, 0, 0, 12 + p * 12, 0.5, 1);
      for (let i = 0, n = 5 + p * 8; i < n; i++) {
        const a = -1.5708 + (rnd() - 0.5) * 3.6, s = 40 + rnd() * (40 + p * 45);
        put(DEBRIS, x, y - 1, cos(a) * s, sin(a) * s, rnd() < 0.3 ? 2 : 1, 0.9 + rnd() * 0.9, (rnd() * 5) | 0);
      }
      for (let i = 0, n = 3 + p * 4; i < n; i++) {
        const a = rnd() * 6.283, s = 50 + rnd() * 90 * p;
        put(SPARK, x, y, cos(a) * s, sin(a) * s - 20, 1, 0.15 + rnd() * 0.25, 0);
      }
      for (let i = 0, n = 1 + p * 3; i < n; i++) put(SMOKE, x + (rnd() - 0.5) * p * 7, y - rnd() * p * 3, (rnd() - 0.5) * 14, -10 - rnd() * 12, 1.5 + rnd() * p, 0.9 + rnd() * 0.5 * p, 0);
      st[1] = min(0.7, st[1]! + p * p * 0.06);
      if (p > 1.5) st[2] = 0.07 * p;
    },
    /** Advance every part; false once nothing is left (no parts, no shake, no flash). */
    step(dt: number) {
      let n = st[0]!;
      for (let i = n - 1; i >= 0; i--) {
        if ((L[i] = L[i]! - dt) <= 0) {
          n--;
          X[i] = X[n]!, Y[i] = Y[n]!, VX[i] = VX[n]!, VY[i] = VY[n]!, L[i] = L[n]!, M[i] = M[n]!, R[i] = R[n]!, K[i] = K[n]!, CO[i] = CO[n]!;
          continue;
        }
        const k = K[i]!;
        if (k === DEBRIS || k === SPARK) VY[i] = VY[i]! + 260 * dt;
        if (k === SMOKE) (VX[i] = VX[i]! + (st[3]! - VX[i]!) * dt), (R[i] = R[i]! + 3 * dt);
        X[i] = X[i]! + VX[i]! * dt;
        Y[i] = Y[i]! + VY[i]! * dt;
        if (k === DEBRIS) {
          const f = ground(X[i]!) - 1;
          if (Y[i]! > f) (Y[i] = f), (VY[i] = abs(VY[i]!) > 60 ? -VY[i]! * 0.3 : 0), (VX[i] = VX[i]! * 0.5);
          if (X[i]! < 0 || X[i]! > w) VX[i] = -VX[i]!;
        }
      }
      st[0] = n;
      if (st[1]! > 0) st[1] = max(0, st[1]! - dt);
      if (st[2]! > 0) st[2] = max(0, st[2]! - dt);
      return n > 0 || st[1]! > 0 || st[2]! > 0;
    },
    /** Every part, then the flash over the whole stage. */
    draw(g: CanvasRenderingContext2D, ox: number) {
      const n = st[0]!;
      for (let i = 0; i < n; i++) {
        const k = K[i]!, u = L[i]! / M[i]!, x = X[i]! + ox, y = Y[i]!;
        if (k === SMOKE) {
          g.globalAlpha = min(0.55, u);
          g.fillStyle = u > 0.6 ? C.muted : C.line;
          disc(g, x, y, round(R[i]!));
          g.globalAlpha = 1;
        } else if (k === FIRE) {
          g.fillStyle = HEAT[min(4, (u * 5) | 0)]!;
          disc(g, x, y, round(R[i]! * (0.4 + u * 0.6)));
          if (u > 0.5) (g.fillStyle = C.ink), disc(g, x, y, round(R[i]! * (u - 0.5)));
        } else if (k === RING) {
          const r = R[i]! * (1 - u * u), m = round(r * 2.5) + 6;
          g.fillStyle = u > 0.5 ? C.ink : CO[i] ? C.hurt : C.muted;
          for (let a = 0; a < m; a++) {
            const t = (a / m) * 6.283;
            g.fillRect(round(x + cos(t) * r), round(y + sin(t) * r * 0.7), 1, 1);
          }
        } else if (k === SPARK) {
          g.fillStyle = u > 0.5 ? C.ink : C.hurt;
          g.fillRect(round(x), round(y), 1, 1);
        } else {
          if (u < 0.3 && (u * 40) & 1) continue; // debris blinks out
          g.fillStyle = BITS[CO[i]!]!;
          g.fillRect(round(x), round(y), R[i]!, R[i]!);
        }
      }
      if (st[2]! > 0) {
        g.globalAlpha = min(0.85, st[2]! * 6);
        g.fillStyle = C.ink;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
    },
  };
}
