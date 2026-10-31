// timeline card: six real DOM bricks, choreographed. Each tap builds a new timeline: every brick hops
// up (staggered), a label marks the moment they are all in the air, then each flies to its place in
// the next arrangement (a pyramid, the pyramid upside down, two towers) on a `back` ease and
// lands. Scripted, not simulated: the same tap plays the same dance. Recall gives every style back.
import type { SlotMount } from "../../src/slot";
import { timeline, type Timeline } from "../../src/timeline";
import { mountCard, W, FLOOR } from "./frame";

const N = 6, BH = 16, WIDTHS = [96, 80, 64, 50, 38, 26];
const NAMES = ["PYRAMID", "UPSIDE DOWN", "TWO TOWERS"];

/** Where brick i stands in arrangement a (drawing units, its top-left corner). */
function place(a: number, i: number, out: Float64Array) {
  const w = WIDTHS[i]!;
  if (a === 0) (out[0] = W / 2 - w / 2), (out[1] = FLOOR - BH * (i + 1));
  else if (a === 1) (out[0] = W / 2 - w / 2), (out[1] = FLOOR - BH * (N - i));
  // Two towers: the bricks deal out left, right, left…
  else (out[0] = (i % 2 ? 228 : 92) - w / 2), (out[1] = FLOOR - BH * (((i / 2) | 0) + 1));
}

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  card.c.style.opacity = "0"; // taps only: the bricks are DOM
  const k = card.px[1]!, at = new Float64Array(2), to = new Float64Array(2);
  const els: HTMLElement[] = [];
  for (let i = 0; i < N; i++) {
    const b = document.createElement("i");
    place(0, i, at);
    b.style.cssText = `position:absolute;left:0;top:0;display:grid;place-items:center;width:${WIDTHS[i]! * k}px;height:${BH * k}px;box-sizing:border-box;background:var(--tone);border:2px solid #07060f;border-radius:3px;box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 #07060f;font:800 ${Math.round(8 * k)}px ui-monospace,Menlo,monospace;color:#07060f;font-style:normal;translate:${at[0]! * k}px ${at[1]! * k}px`;
    if (i === 0) b.textContent = `${card.tag} ${card.kb}`;
    els.push(b);
    card.stage.insertBefore(b, card.c);
  }
  const floor = document.createElement("b");
  floor.style.cssText = `position:absolute;left:0;right:0;top:${(FLOOR + 3) * k}px;height:2px;background:color-mix(in srgb,var(--ink) 14%,transparent)`;
  card.stage.insertBefore(floor, card.c);
  const n = new Int32Array(2); // arrangement now, plays
  let tl: Timeline | null = null;
  card.e.add({ render() { card.dirty[0] = 0; } });
  return {
    tap() {
      if (tl && tl.playing) return; // let the dance land first
      if (tl) card.e.remove(tl);
      const from = n[0]!, next = (from + 1) % 3;
      tl = timeline(card.e);
      for (let i = 0; i < N; i++) {
        place(from, i, at);
        tl.to(els[i]!, { translate: [`${at[0]! * k}px ${at[1]! * k}px`, `${at[0]! * k}px ${(at[1]! - 46 - i * 6) * k}px`] }, { dur: 0.28, ease: "out", at: i * 0.05 });
      }
      tl.label("air");
      for (let i = 0; i < N; i++) {
        place(from, i, at);
        place(next, i, to);
        const order = next === 1 ? N - 1 - i : i;
        tl.to(els[i]!, { translate: [`${at[0]! * k}px ${(at[1]! - 46 - i * 6) * k}px`, `${to[0]! * k}px ${to[1]! * k}px`] }, { dur: 0.55, ease: "back", at: "air", delay: order * 0.07 });
      }
      tl.play();
      n[0] = next;
      n[1] = n[1]! + 1;
    },
    read: () => `${NAMES[n[0]!]} · ${n[1] ? `${n[1]} DANCES · ` : ""}${N * 2} TRACKS`,
  };
});
export default mount;
