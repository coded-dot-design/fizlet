// touch card: grab and throw. Press the brick and drag it, let go and it flies with your hand's
// speed, bounces off the walls and the floor and the name brick, and comes to rest. Tap the sky and
// it hops toward you. One finger always works: @fzlt/core/touch never touches it. Two fingers on the
// card would be a pinch that zooms the page, and @fzlt/core/touch cancels exactly that: the readout
// counts the pinch events it stopped (they arrive here already cancelled). Release gives the page
// its gestures back.
import type { SlotMount } from "../../src/slot";
import { lockTouch } from "../../src/touch";
import { mountCard, ground, brick, W, FLOOR } from "./frame";

const BW = 48, BH = 20, G = 1300, TOP = 22, VMAX = 1400;
// The name brick's pedestal (two bricks at the floor's left end): solid, so nothing passes over it.
const PX0 = 12, PX1 = 86, PY0 = FLOOR - 40;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e, c = card.c;
  c.dataset.bcTouch = "";
  c.style.touchAction = "pan-y"; // a sideways drag throws; an upward swipe still scrolls the page
  const release = lockTouch(document, "[data-bc-touch]");
  e.signal.addEventListener("abort", release);
  // x, y, vx, vy, held, pointer x, pointer y, grab dx, grab dy, throws, pinches blocked, drew, squash
  const s = new Float64Array([W / 2 - BW / 2, FLOOR - BH, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const count = (ev: Event) => {
    if (ev.defaultPrevented && (ev.type[0] === "g" || (ev as TouchEvent).touches.length > 1)) s[10] = s[10]! + 1;
  };
  for (const t of ["touchstart", "gesturestart"]) c.addEventListener(t, count, { signal: e.signal, passive: true });
  c.addEventListener("pointerdown", (ev) => s[4] && c.setPointerCapture(ev.pointerId), { signal: e.signal });
  const up = () => {
    if (!s[4]) return;
    s[4] = 0;
    s[9] = s[9]! + 1;
    e.busy();
  };
  c.addEventListener("pointerup", up, { signal: e.signal });
  c.addEventListener("pointercancel", up, { signal: e.signal });
  e.add({
    step(e, dt) {
      if (s[4]) {
        // Held: follow the hand; its speed is what the throw gets.
        const nx = Math.max(0, Math.min(W - BW, s[5]! - s[7]!)), ny = Math.max(TOP, Math.min(FLOOR - BH, s[6]! - s[8]!));
        s[2] = s[2]! * 0.5 + ((nx - s[0]!) / dt) * 0.5;
        s[3] = s[3]! * 0.5 + ((ny - s[1]!) / dt) * 0.5;
        s[2] = Math.max(-VMAX, Math.min(VMAX, s[2]!));
        s[3] = Math.max(-VMAX, Math.min(VMAX, s[3]!));
        s[0] = nx;
        s[1] = ny;
        e.busy();
        return;
      }
      if (s[12]! > 0.01) (s[12] = s[12]! * (1 - 10 * dt)), e.busy();
      else s[12] = 0;
      const over = s[0]! < PX1 && s[0]! + BW > PX0;
      if (s[1]! >= (over ? PY0 : FLOOR) - BH - 0.01 && s[3] === 0 && s[2] === 0) return; // at rest
      s[3] = s[3]! + G * dt;
      s[0] = s[0]! + s[2]! * dt;
      s[1] = s[1]! + s[3]! * dt;
      // Walls and ceiling.
      if (s[0]! < 0) (s[0] = 0), (s[2] = -s[2]! * 0.6);
      if (s[0]! > W - BW) (s[0] = W - BW), (s[2] = -s[2]! * 0.6);
      if (s[1]! < TOP) (s[1] = TOP), (s[3] = -s[3]! * 0.5);
      // The pedestal: push out along the shallower side and bounce.
      if (s[0]! < PX1 && s[0]! + BW > PX0 && s[1]! + BH > PY0) {
        const ox = PX1 - s[0]!, oy = s[1]! + BH - PY0;
        if (oy < ox && s[3]! > 0) (s[1] = PY0 - BH), (s[3] = -s[3]! * 0.45), (s[2] = s[2]! * 0.85), (s[12] = Math.min(1, s[12]! + 0.4));
        else (s[0] = PX1), (s[2] = Math.abs(s[2]!) * 0.6);
      }
      // The floor (or the pedestal top): bounce, lose some speed, then rest.
      const floor = s[0]! < PX1 && s[0]! + BW > PX0 ? PY0 : FLOOR;
      if (s[1]! >= floor - BH) {
        s[1] = floor - BH;
        if (s[3]! > 90) (s[12] = Math.min(1, s[3]! / 900)), (s[3] = -s[3]! * 0.42);
        else s[3] = 0;
        s[2] = s[2]! * 0.86;
        if (s[2]! < 6 && s[2]! > -6) s[2] = 0;
      }
      if (s[1]! < floor - BH - 0.01 || s[3] !== 0 || s[2] !== 0) e.busy();
    },
    render() {
      const moving = card.dirty[0]! || (s[4] || s[2] !== 0 || s[3] !== 0 || s[12] !== 0 ? 1 : 0);
      if (!moving && !s[11]) return;
      s[11] = moving;
      card.dirty[0] = 0;
      ground(card);
      brick(card, PX0, PY0, PX1 - PX0, 18, card.tone, card.tag);
      brick(card, PX0, PY0 + 20, PX1 - PX0, 18, card.tone, card.kb);
      brick(card, s[0]!, s[1]!, BW, BH, "#06c4ff", s[4] ? "HELD" : "THROW", s[12]!, s[4] ? 7 : 3);
    },
  });
  return {
    tap(x, y) {
      if (x >= s[0]! - 6 && x <= s[0]! + BW + 6 && y >= s[1]! - 8 && y <= s[1]! + BH + 8) {
        // Grab it where it was pressed.
        s[4] = 1;
        s[5] = x; s[6] = y; s[7] = x - s[0]!; s[8] = y - s[1]!;
        s[2] = s[3] = 0;
        return;
      }
      // The sky: a hop toward the tap.
      s[2] = Math.max(-520, Math.min(520, (x - s[0]! - BW / 2) * 2.2));
      s[3] = -Math.min(620, 260 + (FLOOR - y) * 2.2);
    },
    hover(x, y) {
      if (s[4] && x >= 0) (s[5] = x), (s[6] = y);
    },
    read: () => `THROWS ${s[9]} · PINCHES ${s[10]}`, // pinches: cancelled by @fzlt/core/touch
  };
});
export default mount;
