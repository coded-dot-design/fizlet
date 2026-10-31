// Pumpkin Slice: pumpkins arc up out of the dark; swipe (or drag, or tap) through them to cut
// them in half, the halves tumble apart and the seeds spill. Every cut buys the round time; when it
// ends the last pumpkins fall away and the scene sleeps. Original art and rules.
// Bricks: the kernel, fzlt/fx (seeds, goo), fzlt/sprite (whole, left and right halves; turned
// as they spin, baked once), on the Halloween hero core (./hero).
import { effects, emitter } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotTap } from "../../../src/slot";
import { hero, type HeroParams } from "./hero";
import { PUMPKIN, PAL } from "./art";

const N = 18, B = 8, G = 120;
// Its layout per stage aspect (wide, square, tall): where a volley leaves from (x from, x span: of
// the width), how high it peaks (from, span: of the height), how hard it drifts in, most per volley.
// A phone's portrait stage gets bigger art (100 rows tall), steeper arcs and the score up top centre.
const LAY = [0.15, 0.7, 0.6, 0.2, 0.4, 2.4, 0.15, 0.7, 0.6, 0.2, 0.35, 2.4, 0.22, 0.56, 0.55, 0.25, 0.25, 1.8];

export function slice(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, p: HeroParams) {
  return hero(stage, slot, first, { words: ["+10", "SLICE!", "x2"], touch: "none", rows: [90, 90, 100], hud: [1, 1, 0.5] }, (h) => {
    const S = h.S, R = h.e.random;
    const fx = effects({ cap: 300, colors: PAL, scorch: 0, gravity: G });
    const { ids: { seed }, emit } = emitter(fx, { seed: { shape: "square", drag: 0.6, gravity: 1, angle: -1.5708, spread: 2.2, speed: [20, 70], size: [1, 1.5], life: [0.6, 1.2] } });
    const sp = sprites({ p: PUMPKIN });
    // Pieces: x, y, vx, vy, angle, spin, frame (0 none, 1 whole, 2 left half, 3 right half).
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), a = new Float32Array(N), w = new Float32Array(N), f = new Uint8Array(N);
    // The blade: the last B points and their age; launch timer, previous point, a swipe's cuts.
    const bx = new Float32Array(B), by = new Float32Array(B), ba = new Float32Array(B).fill(9);
    const T = new Float64Array([0, -1, -1, 0]);
    const piece = (fr: number, px: number, py: number, pvx: number, pvy: number, spin: number) => {
      for (let i = 0; i < N; i++) if (!f[i]) return void ((f[i] = fr), (x[i] = px), (y[i] = py), (vx[i] = pvx), (vy[i] = pvy), (a[i] = 0), (w[i] = spin));
    };
    // Cut every whole pumpkin within 8 art px of the segment (x0, y0)–(x1, y1).
    const cut = (x0: number, y0: number, x1: number, y1: number) => {
      const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy || 1;
      for (let i = 0; i < N; i++) {
        if (f[i] !== 1) continue;
        const k = Math.max(0, Math.min(1, ((x[i]! - x0) * dx + (y[i]! - y0) * dy) / l)), ex = x0 + dx * k - x[i]!, ey = y0 + dy * k - y[i]!;
        if (ex * ex + ey * ey > 64) continue;
        f[i] = 0;
        piece(2, x[i]! - 3, y[i]!, vx[i]! - 25, vy[i]! - 20, -4 - R() * 3);
        piece(3, x[i]! + 3, y[i]!, vx[i]! + 25, vy[i]! - 20, 4 + R() * 3);
        emit(seed, x[i]!, y[i]!, 24, 2, 4, p.scale); // seeds, pulp and a little goo
        fx.kick(2);
        T[3] = T[3]! + 1;
        h.pop(x[i]!, y[i]! - 10, T[3]! > 1 ? 2 : (R() * 2) | 0, T[3]! > 1 ? 7 : 4);
        h.add(T[3]! > 1 ? 20 : 10);
        h.more(0.8);
      }
    };
    const blade = (px: number, py: number) => {
      for (let k = B - 1; k > 0; k--) (bx[k] = bx[k - 1]!), (by[k] = by[k - 1]!), (ba[k] = ba[k - 1]!);
      bx[0] = px;
      by[0] = py;
      ba[0] = 0;
    };
    return {
      fx,
      start() {
        S[4] = p.seconds;
        T[0] = 0.2;
      },
      tap(px, py) {
        T[3] = 0;
        blade(px, py);
        cut(px - 1, py, px + 1, py);
      },
      drag(px, py) {
        cut(bx[0]!, by[0]!, px, py);
        blade(px, py);
      },
      step(dt) {
        const W = S[0]!, H = S[1]!, l = S[9]! * 6;
        let live = 0;
        // Launch one, two or three in a volley while the round runs; they peak in the top third.
        if (S[4]! > 0.8 && (T[0] = T[0]! - dt) <= 0) {
          T[0] = (p.seconds / p.count) * 1.6;
          for (let n = 1 + ((R() * LAY[l + 5]!) | 0); n > 0; n--) {
            const px = W * (LAY[l]! + R() * LAY[l + 1]!);
            piece(1, px, H + 8, (W / 2 - px) * (LAY[l + 4]! * 0.75 + R() * LAY[l + 4]!), -Math.sqrt(2 * G * H * (LAY[l + 2]! + R() * LAY[l + 3]!)), (R() - 0.5) * 4);
          }
        }
        for (let i = 0; i < N; i++) {
          if (!f[i]) continue;
          vy[i] = vy[i]! + G * dt;
          x[i] = x[i]! + vx[i]! * dt;
          y[i] = y[i]! + vy[i]! * dt;
          a[i] = a[i]! + w[i]! * dt;
          if (y[i]! > H + 12 && vy[i]! > 0) f[i] = 0;
          else live++;
        }
        for (let k = 0; k < B; k++) if (ba[k]! < 0.2) (ba[k] = ba[k]! + dt), live++;
        return live > 0;
      },
      draw(c) {
        for (let i = 0; i < N; i++) if (f[i]) sp.draw(c, 0, f[i]! - 1, x[i]! | 0, y[i]! | 0, a[i]!);
        // The blade's trail: thick at the newest point, thinning and fading behind it.
        c.strokeStyle = PAL[2]!;
        for (let k = 1; k < B; k++)
          if (ba[k]! < 0.2) {
            c.lineWidth = 3 - k * 0.35;
            c.beginPath();
            c.moveTo(bx[k - 1]!, by[k - 1]!);
            c.lineTo(bx[k]!, by[k]!);
            c.stroke();
          }
      },
    };
  });
}

export const scene = (p: HeroParams) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => slice(stage, slot, first, p);
