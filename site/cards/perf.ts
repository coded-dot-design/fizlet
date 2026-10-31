// perf card: drop a long task on the frame. Tap and a brick falls; the higher you tap, the longer the
// task it carries (16 to 52 ms). The step it lands in does that much real work, so that frame runs
// late: fizlet/perf's own overlay, sitting in the card, draws the spike over its budget line and
// counts the dropped frames, while the bricks around it stay green. The brick crumbles, the engine
// settles and the chart rests with it (perf never keeps an engine awake).
import type { SlotMount } from "../../src/slot";
import { perf } from "../../src/perf";
import { mountCard, ground, brick, FLOOR } from "./frame";

const CAP = 6, BW = 46, BH = 18, G = 1200, HOT = "#ff2b4e";

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e;
  const p = perf(e, { host: card.stage, corner: "tr", key: null, on: true });
  p.el.style.top = "22px"; // under the card's readout
  // Iterations of the busy loop a millisecond: a first guess at mount (best of three), then measured
  // again in render from the engine's own work time for each frame that ran a task (the loop runs
  // much faster once it is optimized, so the first guess is low).
  const acc = new Int32Array(1), cal = new Float64Array(3); // iterations a ms, spun this frame, spun last frame
  for (let r = 0; r < 3; r++) {
    const t0 = performance.now();
    for (let i = 0; i < 400000; i++) acc[0] = (Math.imul(acc[0]!, 31) + i) | 0;
    cal[0] = Math.max(cal[0]!, 400000 / Math.max(0.05, performance.now() - t0));
  }
  const timing = e.timing;
  // Per brick: x, y, vy, task ms, state (0 free, 1 falling, 2 crumbling), crumble 0..1.
  const x = new Float64Array(CAP), y = new Float64Array(CAP), vy = new Float64Array(CAP), ms = new Int32Array(CAP);
  const st = new Uint8Array(CAP), cr = new Float64Array(CAP);
  const n = new Int32Array(2); // tasks run, drew
  const LABEL = ["16 MS", "28 MS", "40 MS", "52 MS"];
  e.add({
    step(e, dt) {
      let busy = 0;
      for (let i = 0; i < CAP; i++) {
        if (st[i] === 1) {
          busy = 1;
          vy[i] = vy[i]! + G * dt;
          y[i] = y[i]! + vy[i]! * dt;
          if (y[i]! >= FLOOR - BH) {
            y[i] = FLOOR - BH;
            st[i] = 2;
            // The long task: real work in this step, so this frame runs late.
            const k = ms[i]! * cal[0]!;
            for (let j = 0; j < k; j++) acc[0] = (Math.imul(acc[0]!, 31) + j) | 0;
            cal[1] = cal[1]! + k;
            n[0] = n[0]! + 1;
          }
        } else if (st[i] === 2) {
          busy = 1;
          cr[i] = cr[i]! + dt * 1.6;
          if (cr[i]! >= 1) st[i] = 0;
        }
      }
      if (busy) e.busy();
    },
    render() {
      // The last frame ran a task: its work time (written after render) says how fast the loop is.
      if (cal[2]! > 0 && timing[1]! > 1) cal[0] = cal[0]! * 0.3 + (cal[2]! / timing[1]!) * 0.7;
      cal[2] = cal[1]!;
      cal[1] = 0;
      let moving = card.dirty[0]!;
      for (let i = 0; i < CAP; i++) if (st[i]) moving = 1;
      if (!moving && !n[1]) return;
      n[1] = moving;
      card.dirty[0] = 0;
      const { ctx } = card;
      ground(card);
      for (let i = 0; i < CAP; i++) {
        if (!st[i]) continue;
        const label = LABEL[(ms[i]! - 16) / 12]!;
        if (st[i] === 1) brick(card, x[i]!, y[i]!, BW, BH, HOT, label, 0, 3);
        else {
          // Crumbling: the brick splits into four bits that sink and fade.
          const c = cr[i]!, q = BW / 4;
          ctx.globalAlpha = 1 - c;
          for (let b = 0; b < 4; b++) brick(card, x[i]! + b * q + (b - 1.5) * c * 10, y[i]! + c * c * 6, q - 2, BH * (1 - c * 0.5), HOT, "", 0.0001, 2);
          ctx.globalAlpha = 1;
        }
      }
      // The name brick: on the floor at the right, under the overlay, where no task falls.
      brick(card, 236, FLOOR - 40, 72, 18, card.tone, card.tag);
      brick(card, 236, FLOOR - 18, 72, 18, card.tone, card.kb);
    },
  });
  return {
    tap(px, py) {
      for (let i = 0; i < CAP; i++)
        if (!st[i]) {
          const level = Math.max(0, Math.min(3, Math.floor((1 - py / FLOOR) * 4)));
          ms[i] = 16 + level * 12;
          x[i] = Math.max(10, Math.min(190 - BW, px - BW / 2));
          y[i] = -BH;
          vy[i] = 0;
          cr[i] = 0;
          st[i] = 1;
          return;
        }
    },
    read: () => `TASKS ${n[0]} · DROPPED ${p.dropped}`,
  };
});
export default mount;
