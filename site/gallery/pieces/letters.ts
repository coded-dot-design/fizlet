// Real letters a comic piece can hit: each one a span in the figure's own markup, moved only when
// an effect reaches it. Five springs per letter (shift x and y in % of the letter, turn and lean in
// degrees, stretch in %), kicked by the scene, overshooting home and resting. They go to the page as
// custom properties through the engine's ledger (strings made once, so a frame allocates nothing);
// the stage CSS turns them into one transform. A letter at rest gets its properties put back
// (unstyle: no inline property left, only an empty style attribute), and Recall (destroy) gives
// the page back byte for byte.
// Layout is read only after a resize (offsets, which ignore the transforms we write), never in a step.
import type { Engine } from "../../../src/kernel/index";
import { W } from "./pix";

/** Channels: shift x, shift y (% of the letter), turn, lean (deg), stretch x (% over 100). */
export const TX = 0, TY = 1, ROT = 2, LEAN = 3, STRETCH = 4;
const PROPS = ["--tx", "--ty", "--r", "--k", "--s"] as const;
const UNIT = ["%", "%", "deg", "deg", ""] as const;
const R = 120; // a value table from -R to R per channel
const TABLE = PROPS.map((_, c) => Array.from({ length: R * 2 + 1 }, (_, i) => (c === STRETCH ? String(1 + (i - R) / 100) : `${i - R}${UNIT[c]}`)));

export type Letters = ReturnType<typeof letters>;

/**
 * The letters matching `select` inside `slot`, in art pixels (centre x, centre y, width, height).
 * `stiff` and `damp`: the springs (the defaults overshoot once and rest in about 0.6 s).
 */
export function letters(engine: Engine, slot: HTMLElement, select: string, stiff = 170, damp = 11) {
  const els = [...slot.querySelectorAll<HTMLElement>(select)], n = els.length, L = engine.ledger;
  const x = new Float32Array(n), y = new Float32Array(n), w = new Float32Array(n), h = new Float32Array(n);
  const p = new Float32Array(n * 5), v = new Float32Array(n * 5), lit = new Float32Array(n);
  const on = new Uint8Array(n), was = new Int16Array(n * 5);
  const st = new Float64Array(2); // resized, live
  st[0] = 1;
  const ro = new ResizeObserver(() => ((st[0] = 1), engine.wake()));
  ro.observe(slot);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  return {
    n,
    els,
    /** The springs' positions (5 channels a letter: shift x, shift y in % of the letter, …). */
    p,
    x,
    y,
    w,
    h,
    get live() {
      return st[1]!;
    },
    /** In a read hook: re-measure after a resize (offsets up to the slot: our transforms don't count). */
    read() {
      if (!st[0]) return;
      st[0] = 0;
      const k = W / (slot.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        let ox = 0, oy = 0, e: HTMLElement | null = els[i]!;
        while (e && e !== slot) (ox += e.offsetLeft), (oy += e.offsetTop), (e = e.offsetParent as HTMLElement | null);
        w[i] = els[i]!.offsetWidth * k;
        h[i] = els[i]!.offsetHeight * k;
        x[i] = ox * k + w[i]! / 2;
        y[i] = oy * k + h[i]! / 2;
      }
    },
    /** Add velocity to one channel of letter i (units per second), and flash it for `flash` s. */
    kick(i: number, c: number, vel: number, flash = 0) {
      v[i * 5 + c] = v[i * 5 + c]! + vel;
      if (flash > lit[i]!) lit[i] = flash;
      on[i] = 1;
    },
    /** Knock every letter within `r` art px of (cx, cy) away from it: shift, turn, a flash. */
    blast(cx: number, cy: number, r: number, power: number) {
      for (let i = 0; i < n; i++) {
        const dx = x[i]! - cx, dy = y[i]! - cy, d = Math.hypot(dx, dy) || 1;
        if (d > r + w[i]! / 2) continue;
        const f = power * (1 - (d / (r + w[i]! / 2)) * 0.6);
        this.kick(i, TX, (dx / d) * 900 * f, 0.18);
        this.kick(i, TY, ((dy / d) * 700 - 500) * f);
        this.kick(i, ROT, (dx >= 0 ? 1 : -1) * 520 * f);
      }
    },
    /** In a step: the springs. Returns how many letters are still moving. */
    step(dt: number) {
      let live = 0;
      for (let i = 0; i < n; i++) {
        if (!on[i]) continue;
        let moving = lit[i]! > 0;
        if (moving) lit[i] = lit[i]! - dt;
        for (let c = 0; c < 5; c++) {
          const j = i * 5 + c;
          v[j] = v[j]! + (-stiff * p[j]! - damp * v[j]!) * dt;
          p[j] = Math.max(-R, Math.min(R, p[j]! + v[j]! * dt));
          if (Math.abs(p[j]!) > 0.5 || Math.abs(v[j]!) > 4) moving = true;
        }
        if (!moving) {
          for (let c = 0; c < 5; c++) (p[i * 5 + c] = 0), (v[i * 5 + c] = 0);
          on[i] = 2; // at rest: render puts its properties back, then forgets it
        } else live++;
      }
      return (st[1] = live);
    },
    /** In render: change-only writes through the ledger; a letter at rest gets its page back. */
    render() {
      for (let i = 0; i < n; i++) {
        if (!on[i]) continue;
        const el = els[i]!;
        if (on[i] === 2) {
          for (let c = 0; c < 5; c++) L.unstyle(el, PROPS[c]!), (was[i * 5 + c] = 0);
          L.attr(el, "data-hit", null);
          on[i] = 0;
          continue;
        }
        for (let c = 0; c < 5; c++) {
          const q = Math.round(p[i * 5 + c]!);
          if (q !== was[i * 5 + c]) (was[i * 5 + c] = q), L.style(el, PROPS[c]!, TABLE[c]![q + R]!);
        }
        L.attr(el, "data-hit", lit[i]! > 0 ? "" : null);
      }
    },
  };
}
