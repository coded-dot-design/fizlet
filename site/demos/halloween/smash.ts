// Pumpkin Smash: jack-o'-lanterns pop up out of the patch; tap one to smash it flat in a burst of
// pixel goo and seeds. Every smash buys the round time; when it ends the patch goes quiet and the
// scene sleeps. Bricks: the kernel, @fzlt/core/fx (goo, chunks, shake), @fzlt/core/sprite (the pumpkin and
// its smashed frame, baked once), on the Halloween hero core (./hero).
import { effects, emitter } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotTap } from "../../../src/slot";
import { hero, type HeroParams } from "./hero";
import { PUMPKIN, PAL } from "./art";

const N = 6;

export function smash(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, p: HeroParams) {
  return hero(stage, slot, first, { words: ["SPLAT!", "+10", "SMASH!"] }, (h) => {
    const S = h.S, R = h.e.random;
    const fx = effects({ cap: 300, colors: PAL, scorch: 0, gravity: 160 });
    const { ids: { goo }, emit } = emitter(fx, { goo: { shape: "square", drag: 1.2, gravity: 1, angle: -1.5708, spread: 2.4, speed: [40, 120], size: [1, 2.5], life: [0.5, 1.1] } });
    const sp = sprites({ p: PUMPKIN });
    // Per hole: state (0 empty, 1 up, 2 smashed), time in that state, how long it stays up.
    const st = new Uint8Array(N), t = new Float32Array(N), up = new Float32Array(N);
    const T = new Float64Array(1); // spawn timer
    const hx = (i: number) => Math.round(S[0]! * (0.2 + 0.3 * (i % 3) + (i > 2 ? 0.08 : -0.04)));
    const hy = (i: number) => Math.round(S[1]! * (i > 2 ? 0.96 : 0.8));
    // How far out of its hole (0..1): up fast, a wobble, down again.
    const rise = (i: number) => (st[i] === 1 ? Math.min(1, t[i]! * 6, (up[i]! - t[i]!) * 5) : 1);
    return {
      fx,
      start() {
        S[4] = p.seconds;
        T[0] = 0;
      },
      tap(x, y) {
        for (let i = 0; i < N; i++)
          if (st[i] === 1 && rise(i) > 0.3 && Math.abs(x - hx(i)) < 9 && y > hy(i) - 16 * rise(i) - 4 && y < hy(i) + 2) {
            st[i] = 2;
            t[i] = 0;
            const x0 = hx(i), y0 = hy(i) - 5;
            emit(goo, x0, y0, 26, 5, 2, p.scale);
            emit(goo, x0, y0, 14, 3, 2, p.scale * 0.8);
            fx.kick(6);
            h.pop(x0, y0 - 12, (R() * 3) | 0, (R() * 2) | 0 ? 6 : 4);
            h.add(10);
            h.more(0.7);
            return;
          }
        emit(goo, x, y, 4, 9, 2, 0.4); // a miss: a puff of dirt
      },
      step(dt) {
        let live = 0;
        if (S[4]! > 0.6 && (T[0] = T[0]! - dt) <= 0) {
          T[0] = (p.seconds / p.count) * (0.6 + R() * 0.6);
          const i = (R() * N) | 0;
          if (!st[i]) (st[i] = 1), (t[i] = 0), (up[i] = 0.9 + R() * 0.5);
        }
        for (let i = 0; i < N; i++) {
          if (!st[i]) continue;
          live++;
          t[i] = t[i]! + dt;
          if (st[i] === 1 && t[i]! >= up[i]!) st[i] = 0;
          if (st[i] === 2 && t[i]! > 1.2) st[i] = 0;
        }
        return live > 0;
      },
      draw(c) {
        for (let i = 0; i < N; i++) {
          const x = hx(i), y = hy(i);
          if (st[i] === 2) sp.draw(c, 0, 3, x, y - 7);
          else if (st[i] === 1) {
            // Out of the hole: drawn clipped to above its rim, with a squash as it pops.
            const r = rise(i);
            c.save();
            c.beginPath();
            c.rect(x - 10, y - 24, 20, 23);
            c.clip();
            sp.draw(c, 0, 0, x, y - 7 - Math.round(13 * r) + 13);
            c.restore();
          }
        }
      },
      scenery(c) {
        for (let i = 0; i < N; i++) {
          const x = hx(i), y = hy(i);
          c.fillStyle = PAL[12]!;
          c.fillRect(x - 8, y - 2, 17, 3);
          c.fillRect(x - 6, y - 3, 13, 1);
          c.fillStyle = PAL[10]!;
          c.fillRect(x - 9, y + 1, 19, 2);
        }
      },
    };
  });
}

export const scene = (p: HeroParams) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => smash(stage, slot, first, p);
