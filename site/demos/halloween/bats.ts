// Bat Blaster: pixel bats swoop across the night, in and out of the card and over the page above
// it; tap to fire the blaster at them. A round runs while you play (every hit buys time); when it
// ends, the bats left fly up and away off the page, and the scene sleeps.
// Bricks: the kernel, @fzlt/core/fx (one pool: bat bits, muzzle sparks, shake), @fzlt/core/sprite (the bat,
// two frames, baked once), on the Halloween hero core (./hero: canvas, spill layer, pixel font).
import { effects, emitter } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotTap } from "../../../src/slot";
import { hero, disc, type HeroParams } from "./hero";
import { BAT, PAL } from "./art";

const N = 16, SH = 8;

export function bats(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, p: HeroParams) {
  return hero(stage, slot, first, { spill: 0.6, words: ["+10", "BAM!"] }, (h) => {
    const S = h.S, R = h.e.random;
    const fx = effects({ cap: 240, colors: PAL, scorch: 0, gravity: 90 });
    const { ids: { bits }, emit } = emitter(fx, { bits: { shape: "square", drag: 1.4, gravity: 1, angle: -1.5708, spread: 6.2832, speed: [25, 85], size: [1, 2], life: [0.4, 0.9] } });
    const sp = sprites({ bat: BAT });
    // Bats: x, base y, vx, phase, swoop, time, state (0 none, 1 swooping, 2 leaving). Shots: x, y, vx, vy, life.
    const bx = new Float32Array(N), by = new Float32Array(N), bv = new Float32Array(N), bp = new Float32Array(N), ba = new Float32Array(N), bt = new Float32Array(N), bs = new Uint8Array(N);
    const sx = new Float32Array(SH), sy = new Float32Array(SH), svx = new Float32Array(SH), svy = new Float32Array(SH), sl = new Float32Array(SH);
    // Spawn timer, aim x, aim y, recoil.
    const T = new Float64Array([0, 0, -1, 0]);
    const gx = () => S[0]! / 2, gy = () => S[1]! * 0.86 - 3;
    const y = (i: number) => by[i]! + Math.sin(bt[i]! * 3 + bp[i]!) * ba[i]!;
    return {
      fx,
      start() {
        S[4] = p.seconds;
        T[0] = 0;
      },
      tap(x, ty) {
        const ox = gx(), oy = gy(), d = Math.hypot(x - ox, ty - oy) || 1, v = 240 * p.scale;
        T[1] = (x - ox) / d;
        T[2] = (ty - oy) / d;
        T[3] = 1;
        for (let i = 0; i < SH; i++)
          if (sl[i]! <= 0) {
            sx[i] = ox + T[1]! * 6;
            sy[i] = oy + T[2]! * 6;
            svx[i] = T[1]! * v;
            svy[i] = T[2]! * v;
            sl[i] = 1.4;
            emit(bits, sx[i]!, sy[i]!, 4, 3, 2, 0.5); // the muzzle flash
            break;
          }
      },
      step(dt) {
        const w = S[0]!, hh = S[1]!, up = S[6]!;
        let live = 0;
        // A new bat every round / count seconds while the round runs (not in its last 0.8 s).
        if (S[4]! > 0.8 && (T[0] = T[0]! - dt) <= 0) {
          T[0] = p.seconds / p.count;
          for (let i = 0; i < N; i++)
            if (!bs[i]) {
              const l = R() < 0.5;
              bs[i] = 1;
              bx[i] = l ? -8 : w + 8;
              bv[i] = (l ? 1 : -1) * (26 + R() * 26) * p.scale;
              by[i] = -up * 0.6 + R() * (hh * 0.55 + up * 0.6);
              bp[i] = R() * 6.3;
              ba[i] = 4 + R() * 12;
              bt[i] = 0;
              break;
            }
        }
        for (let i = 0; i < N; i++) {
          if (!bs[i]) continue;
          live++;
          bt[i] = bt[i]! + dt;
          bx[i] = bx[i]! + bv[i]! * dt;
          // Round over: every bat left climbs away, up and off the page.
          if (S[4]! <= 0 && bs[i] === 1) bs[i] = 2;
          if (bs[i] === 2) by[i] = by[i]! - 110 * dt;
          if (bx[i]! < -12 || bx[i]! > w + 12) bv[i] = -bv[i]!, (bx[i] = Math.max(-12, Math.min(w + 12, bx[i]!)));
          if (y(i) < -up - 10) bs[i] = 0;
        }
        for (let k = 0; k < SH; k++) {
          if (sl[k]! <= 0) continue;
          live++;
          sl[k] = sl[k]! - dt;
          sx[k] = sx[k]! + svx[k]! * dt;
          sy[k] = sy[k]! + svy[k]! * dt;
          for (let i = 0; i < N; i++)
            if (bs[i] && Math.abs(sx[k]! - bx[i]!) < 7 && Math.abs(sy[k]! - y(i)) < 5) {
              // A hit: the bat bursts into bits, the shot is spent, the round goes on.
              bs[i] = 0;
              sl[k] = 0;
              emit(bits, bx[i]!, y(i), 16, 0, 3);
              fx.kick(3);
              h.pop(bx[i]!, y(i) - 6, R() < 0.2 ? 1 : 0, 4);
              h.add(10);
              h.more(0.8);
              break;
            }
        }
        if (T[3]! > 0) T[3] = Math.max(0, T[3]! - dt * 6);
        return live > 0 || T[3]! > 0;
      },
      draw(c, oy) {
        // Shots (a bolt and its trail), the bats, then the blaster on the ground.
        for (let k = 0; k < SH; k++)
          if (sl[k]! > 0) {
            c.fillStyle = PAL[3]!;
            c.fillRect(sx[k]! - svx[k]! * 0.02, sy[k]! - svy[k]! * 0.02 + oy, 1, 1);
            c.fillStyle = PAL[4]!;
            c.fillRect(sx[k]! - 1, sy[k]! - 1 + oy, 2, 2);
          }
        for (let i = 0; i < N; i++) if (bs[i]) sp.draw(c, 0, (bt[i]! * 9) & 1, bx[i]! | 0, (y(i) + oy) | 0); // whole px: no boxing
        const ox = gx(), gyy = gy() + oy, r = 1 - T[3]! * 0.4;
        c.fillStyle = PAL[9]!;
        for (let d = 2; d < 8; d++) c.fillRect(Math.round(ox + T[1]! * d * r) - 1, Math.round(gyy + T[2]! * d * r) - 1, 2, 2);
        disc(c, ox, gyy + 1, 3, PAL[0]!);
        c.fillStyle = PAL[12]!;
        c.fillRect(ox - 4, gyy + 3, 9, 2);
      },
      scenery(c, w, hh) {
        // Tombstones on the hill.
        for (let i = 0; i < 4; i++) {
          const x = Math.round(w * (0.12 + i * 0.24 + (i & 1) * 0.05)), g = Math.round(hh * 0.86);
          disc(c, x, g - 6, 3, PAL[9]!);
          c.fillRect(x - 3, g - 6, 7, 6);
          c.fillStyle = PAL[10]!;
          c.fillRect(x - 1, g - 6, 3, 1);
          c.fillRect(x, g - 7, 1, 3);
        }
      },
    };
  });
}

/** For `slot(fig, () => import(...).then((m) => m.mount))`. */
export const scene = (p: HeroParams) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bats(stage, slot, first, p);
