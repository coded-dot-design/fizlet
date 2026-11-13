// The card table series' play chips (Blackjack, Hold'em): stacks of clay chips on the felt, built
// once per scene and changed in place. `set(n)` shows n chips' worth (100, 25, 10 and 5, the biggest
// at the bottom; a stack shows at most `max` chips and a tall one leans a hair); `slide` moves a stack
// across the felt in an arc (a bet going in, a pot pushed over). No allocation once built.
import type { DioramaObject } from "../../../../src/diorama";
import { TOP, type Table } from "./table";

/** The chip values, and their clay and stripe colours. */
export const CHIP = [100, 25, 10, 5], CLAY = ["#2b2a45", "#3fa36b", "#3d72d1", "#d94a3c"], STRIPE = ["#f2c14e", "#f4efe4", "#f4efe4", "#f4efe4"];
const H = 0.07, R = 0.62;

export interface Stack {
  /** Its group (moved by `slide`). */
  g: DioramaObject;
  /** Felt position now. */
  x: number;
  z: number;
  /** Chips' worth shown. */
  amount: number;
  set(n: number): void;
  /** Slide to (x, z) over `dur` seconds from `t` (a running clock); `place` jumps. */
  slide(x: number, z: number, t: number, dur: number): void;
  place(x: number, z: number): void;
  /** Pose at t: true while it moves. */
  show(t: number): boolean;
}

/** A stack of chips on the felt at (x, z), named `id`, up to `max` chips high. */
export function stack(T: Table, id: string, x: number, z: number, max = 12): Stack {
  const at = new Float64Array(3), M = new Float64Array(5);
  T.dio.cluster(id, { at });
  const g = T.put({ id, shape: "group", size: [R, 0, R], on: "felt", pos: [x, 0, z], cluster: id, shadow: 0.24 });
  const list: DioramaObject[] = [], stripes: DioramaObject[] = [];
  for (let i = 0; i < max; i++) {
    const c = T.put({ shape: "cyl", sides: 16, size: [R, H, R], on: id, pos: [0, i * H * 1.04, 0], color: CLAY[0] });
    list.push(c);
    stripes.push(T.put({ shape: "cyl", sides: 16, size: [R * 0.7, 0.004, R * 0.7], on: id, pos: [0, i * H * 1.04 + H, 0], color: STRIPE[0] }));
  }
  const s: Stack = {
    g, x, z, amount: -1,
    set(n: number) {
      if (n === s.amount) return;
      s.amount = n;
      // The count per value, biggest first, then shown from the bottom; past `max`, the small ones go.
      let left = Math.max(0, n), k = 0;
      for (let v = 0; v < CHIP.length && k < max; v++)
        while (left >= CHIP[v]! && k < max) {
          left -= CHIP[v]!;
          list[k]!.color = CLAY[v]!;
          stripes[k]!.color = STRIPE[v]!;
          k++;
        }
      for (let i = 0; i < max; i++) {
        const on = i < k, lean = i * 0.004 * (i & 1 ? 1 : -1);
        list[i]!.hidden = !on;
        // Only the top chip's inlay shows (the others are under the next chip).
        stripes[i]!.hidden = !on || i !== k - 1;
        list[i]!.pos[0] = stripes[i]!.pos[0] = lean;
      }
      g.shadow = k ? 0.24 : 0;
      T.dirty = true;
    },
    slide(nx: number, nz: number, t: number, dur: number) {
      (M[0] = s.x), (M[1] = s.z), (M[2] = t), (M[3] = T.RM ? 0 : dur);
      (s.x = nx), (s.z = nz);
      M[4] = 1;
      T.engine.busy(dur + 0.05);
    },
    place(nx: number, nz: number) {
      (s.x = nx), (s.z = nz), (M[4] = 0);
      pose(nx, nz, 0);
    },
    show(t: number) {
      if (!M[4]) return false;
      const u = M[3]! > 0 ? Math.min(1, Math.max(0, (t - M[2]!) / M[3]!)) : 1, e = u * u * (3 - 2 * u);
      pose(M[0]! + (s.x - M[0]!) * e, M[1]! + (s.z - M[1]!) * e, Math.sin(Math.PI * u) * 0.5);
      if (u >= 1) M[4] = 0;
      return true;
    },
  };
  function pose(px: number, pz: number, lift: number) {
    g.pos[0] = px;
    g.pos[1] = lift;
    g.pos[2] = pz;
    at[0] = px;
    at[1] = TOP + lift + 0.1;
    at[2] = pz + T.fz + 0.05;
    T.dirty = true;
  }
  pose(x, z, 0);
  s.set(0);
  return s;
}
