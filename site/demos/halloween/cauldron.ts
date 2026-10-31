// Candy Cauldron: tap to drop wrapped candy; land it in the cauldron and the brew fizzes up in a
// rush of pixel bubbles (a nod to Fizlet's first demo, the fizz). Miss and it bounces off into the
// grass. The brew calms down on its own and the scene sleeps.
// Bricks: the kernel, fzlt/fx (BUBBLE, the built-in kind, for the fizz; embers under the pot),
// fzlt/sprite (the cauldron and one candy in four flavours: palettes, baked once), on the
// Halloween hero core (./hero).
import { effects, emitter, BUBBLE } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotTap } from "../../../src/slot";
import { hero, type HeroParams } from "./hero";
import { CANDY, CANDY_PALETTES, CAULDRON, PAL } from "./art";

const N = 12, G = 150;

export function cauldron(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, p: HeroParams) {
  return hero(stage, slot, first, { words: ["FIZZ!", "+1", "PLOP!"] }, (h) => {
    const S = h.S, R = h.e.random;
    const fx = effects({ cap: 360, colors: PAL, scorch: 0, gravity: 100 });
    const { ids: { fizz, ember }, emit } = emitter(fx, {
      fizz: { ...BUBBLE, speed: [30, 110], life: [0.6, 1.3] },
      ember: { shape: "square", drag: 1.6, gravity: -0.4, angle: -1.5708, spread: 1.2, speed: [10, 40], size: [1, 1], life: [0.3, 0.8] },
    });
    const sp = sprites({ pot: CAULDRON, candy: CANDY }, { palettes: CANDY_PALETTES });
    // Candy: x, y, vx, vy, flavour, state (0 none, 1 falling, 2 bounced off).
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), fl = new Uint8Array(N), st = new Uint8Array(N);
    // Boil (s left), bubble carry, intro drops left, intro timer.
    const T = new Float64Array([0, 0, 0, 0]);
    const cx = () => Math.round(S[0]! / 2), rim = () => Math.round(S[1]! * 0.93) - 12;
    const drop = (px: number) => {
      for (let i = 0; i < N; i++)
        if (!st[i]) return void ((st[i] = 1), (x[i] = px), (y[i] = -6), (vx[i] = (R() - 0.5) * 20), (vy[i] = 10), (fl[i] = (R() * 4) | 0));
    };
    return {
      fx,
      start(px) {
        S[4] = p.seconds;
        if (px < 0) (T[2] = p.count), (T[3] = 0.1); // on mount: a few drops of its own
      },
      tap(px) {
        T[2] = 0;
        drop(px);
      },
      step(dt) {
        const c = cx(), r = rim(), ground = Math.round(S[1]! * 0.93);
        let live = 0;
        if (T[2]! > 0 && (T[3] = T[3]! - dt) <= 0) (T[3] = 0.3), T[2]!--, drop(c + ((R() - 0.5) * 14) | 0);
        for (let i = 0; i < N; i++) {
          if (!st[i]) continue;
          live++;
          vy[i] = vy[i]! + G * dt;
          x[i] = x[i]! + vx[i]! * dt;
          const py = y[i]!, ny = (y[i] = py + vy[i]! * dt);
          const dx = Math.abs(x[i]! - c);
          if (st[i] === 1 && py < r && ny >= r) {
            if (dx < 8) {
              // In: a splash, the brew boils up, a point.
              st[i] = 0;
              T[0] = Math.min(2, T[0]! + 1.2);
              emit(fizz, c, r, 40, 5, 3, 1.3 * p.scale);
              emit(fizz, c, r, 12, 0, 1, p.scale);
              fx.kick(2);
              h.pop(c, r - 14, (R() * 3) | 0 ? 0 : 2, 6);
              h.add(1);
              h.more(1);
            } else if (dx < 12) (st[i] = 2), (vy[i] = -vy[i]! * 0.5), (vx[i] = (x[i]! < c ? -1 : 1) * 40); // off the rim
          }
          if (y[i]! > ground && vy[i]! > 0) {
            if (Math.abs(vy[i]!) > 40) (vy[i] = -vy[i]! * 0.35), (y[i] = ground), (vx[i] = vx[i]! * 0.6);
            else st[i] = 0, emit(ember, x[i]! | 0, ground, 5, 9, 1);
          }
        }
        // The boil: bubbles out of the brew, embers under the pot, easing off.
        if (T[0]! > 0) {
          T[0] = T[0]! - dt;
          T[1] = T[1]! + dt * 14 * T[0]!;
          const n = T[1]! | 0;
          T[1] = T[1]! - n;
          emit(fizz, c + ((R() - 0.5) * 14) | 0, r, n, 5, 3, p.scale); // whole px: an int never boxes
          emit(ember, c + ((R() - 0.5) * 10) | 0, ground - 1, n > 0 ? 1 : 0, 3, 2);
          live++;
        }
        return live > 0 || T[2]! > 0;
      },
      draw(c) {
        const k = cx(), r = rim(), b = T[0]!;
        // The fire glows while it boils, then the pot (its brew heaving), then the candy in flight.
        if (b > 0) {
          c.fillStyle = PAL[b > 1 ? 4 : 3]!;
          c.fillRect(k - 5, r + 12, 11, 2);
          c.fillStyle = PAL[8]!;
          c.fillRect(k - 3, r + 11, 7, 2);
        }
        sp.draw(c, 0, 0, k, r + 5 - (b > 0 ? (S[8]! >> 1) & 1 : 0));
        for (let i = 0; i < N; i++) if (st[i]) sp.draw(c, 1, 0, x[i]! | 0, y[i]! | 0, 0, 1, fl[i]!); // whole px: no boxing
      },
      scenery(c, w, hh) {
        // Grass tufts along the ground.
        c.fillStyle = PAL[10]!;
        for (let gx = 3; gx < w; gx += 7) c.fillRect(gx, Math.round(hh * 0.93) - 1 - (gx % 3), 1, 2 + (gx % 3));
      },
    };
  });
}

export const scene = (p: HeroParams) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => cauldron(stage, slot, first, p);
