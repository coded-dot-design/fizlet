// coach card: a four-step tutorial for the card itself. The coach card (fzlt/coach's own Board UI
// card, real DOM) says which brick to tap and rings that brick, a real DOM element, with its dashed
// outline. Tap the right one and the step passes (`coach:step` on the ring), the brick hops and the
// row shuffles; tap a wrong one and it shakes and counts as a miss. After the last step the tour
// shows its tip; a tap starts a new practice run. The tour is DOM-free and steps without allocating;
// the card writes the DOM only when the step changes.
import type { SlotMount } from "../../src/slot";
import { tour, card as coachCard } from "../../src/coach";
import { mountCard, ground, brick, W, H, FLOOR } from "./frame";

const N = 4, BW = 40, BH = 22, X0 = 116, GAP = 50, G = 1400;
const COLORS = ["#ff2b4e", "#06c4ff", "#ffd84a", ""], NAMES = ["RED", "BLUE", "YELLOW", ""];
/** The brick each step asks for (an index into COLORS). */
const ASK = [0, 2, 1, 3];

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e, t = tour(e, { steps: N, tips: 1 });
  COLORS[3] = card.tone;
  NAMES[3] = card.tag;
  // Per brick: x now, x to slide to, hop height, hop speed, shake (0..1).
  const x = new Float64Array(N), to = new Float64Array(N), hy = new Float64Array(N), vy = new Float64Array(N), sh = new Float64Array(N);
  // tap pending, tap x, tap y, misses, shuffle in (s), seed, drew
  const s = new Float64Array([0, 0, 0, 0, 0, 0, 0]);
  const order = new Int32Array([0, 1, 2, 3]), seed = new Int32Array([11]);
  for (let i = 0; i < N; i++) x[i] = to[i] = X0 + i * GAP;
  const k = card.px[1]!;
  const els: HTMLElement[] = [];
  for (let i = 0; i < N; i++) {
    const b = document.createElement("i");
    b.style.cssText = `position:absolute;left:${(x[i]! / W) * 100}%;top:${((FLOOR - BH) / H) * 100}%;width:${(BW / W) * 100}%;height:${(BH / H) * 100}%;box-sizing:border-box;display:grid;place-items:center;background:${COLORS[i]};border:2px solid #07060f;border-radius:3px;box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 #07060f;font:800 ${Math.max(7, Math.round(7 * k))}px ui-monospace,Menlo,monospace;color:#07060f;font-style:normal;pointer-events:none`;
    if (i === 3) b.textContent = card.tag.slice(0, 5);
    els.push(b);
    card.stage.insertBefore(b, card.c.nextSibling);
  }
  const cc = coachCard(card.stage, { signal: e.signal });
  // The kit card is sized for a game board: here it sits in the card's sky, smaller.
  cc.el.style.top = "22%";
  cc.el.style.width = "84%";
  cc.el.style.padding = "4px 8px";
  cc.el.style.fontSize = `${Math.max(9, Math.round(9 * k))}px`;
  cc.el.setAttribute("aria-hidden", "true");
  const shuffle = () => {
    for (let i = N - 1; i > 0; i--) {
      seed[0] = Math.imul(seed[0]!, 1103515245) + 12345;
      const j = (seed[0]! >>> 16) % (i + 1), a = order[i]!;
      order[i] = order[j]!;
      order[j] = a;
    }
    for (let i = 0; i < N; i++) to[order[i]!] = X0 + i * GAP;
  };
  e.add({
    step(e, dt) {
      t.tick(dt);
      let busy = 0;
      if (s[0]) {
        s[0] = 0;
        let hit = -1;
        for (let i = 0; i < N; i++) if (s[1]! >= x[i]! - 4 && s[1]! <= x[i]! + BW + 4 && s[2]! >= FLOOR - BH - 30) hit = i;
        if (t.done) {
          t.reset();
          shuffle();
        } else if (hit >= 0 && hit === ASK[t.step]! && s[4] === 0) {
          vy[hit] = -340;
          t.pass();
          s[4] = 0.4;
        } else if (hit >= 0) (sh[hit] = 1), (s[3] = s[3]! + 1);
      }
      if (s[4]! > 0) {
        busy = 1;
        s[4] = s[4]! - dt;
        if (s[4]! <= 0) (s[4] = 0), shuffle();
      }
      for (let i = 0; i < N; i++) {
        const dx = to[i]! - x[i]!;
        if (dx > 0.3 || dx < -0.3) (x[i] = x[i]! + dx * Math.min(1, dt * 9)), (busy = 1);
        else x[i] = to[i]!;
        if (vy[i] !== 0 || hy[i]! < 0) {
          vy[i] = vy[i]! + G * dt;
          hy[i] = hy[i]! + vy[i]! * dt;
          if (hy[i]! >= 0) (hy[i] = 0), (vy[i] = 0);
          busy = 1;
        }
        if (sh[i]! > 0.02) (sh[i] = sh[i]! * (1 - 6 * dt)), (busy = 1);
        else sh[i] = 0;
      }
      if (busy) e.busy();
    },
    render() {
      // The coach card: written only when the step (or the tip) changes.
      const c = t.show();
      if (c >= 0) {
        if (c < N) cc.show(`${c + 1}/${N}`, `TAP ${NAMES[ASK[c]!]}`, "the ringed brick", els[ASK[c]!]);
        else cc.show("✓", "TOUR DONE", "tap to practise again", null);
      }
      let moving = card.dirty[0]!;
      for (let i = 0; i < N; i++) if (x[i] !== to[i] || hy[i] !== 0 || sh[i] !== 0) moving = 1;
      if (!moving && !s[6]) return;
      s[6] = moving;
      if (card.dirty[0]) {
        ground(card);
        // The name brick: on the floor at the left, where the row never goes.
        brick(card, 14, FLOOR - 40, 70, 18, card.tone, card.tag);
        brick(card, 14, FLOOR - 18, 70, 18, card.tone, card.kb);
        card.dirty[0] = 0;
      }
      for (let i = 0; i < N; i++) {
        const st = els[i]!.style, wob = sh[i]! > 0 ? Math.sin(sh[i]! * 40) * 4 * sh[i]! : 0;
        st.left = `${((x[i]! + wob) / W) * 100}%`;
        st.top = `${((FLOOR - BH + hy[i]!) / H) * 100}%`;
      }
    },
  });
  return {
    tap(px, py) {
      s[0] = 1; s[1] = px; s[2] = py;
    },
    read: () => `${t.done ? "DONE" : `STEP ${t.step + 1}/${N}`} · MISSES ${s[3]}`,
  };
});
export default mount;
