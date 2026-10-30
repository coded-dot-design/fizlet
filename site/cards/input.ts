// input card: whack-a-brick. Tap the card to start an eight-second round: bricks pop out of four
// holes; whack one with a tap on it or its key (1 2 3 4, or A S D F). Keys and the pointer map to
// the same named intents, and a hit is true for exactly one step: the readout names what landed it.
import type { SlotMount } from "../../src/slot";
import { controls } from "../../src/input";
import { mountCard, ground, brick, ink, faint, W, H, FLOOR } from "./frame";

const HOLES = 4, HX = [52, 124, 196, 268], HW = 46, BH = 30, ROUND = 8, INTENTS = ["h0", "h1", "h2", "h3"];
const KEYS = ["1 · A", "2 · S", "3 · D", "4 · F"];

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const pad = controls(card.e, { keys: { h0: ["Digit1", "KeyA"], h1: ["Digit2", "KeyS"], h2: ["Digit3", "KeyD"], h3: ["Digit4", "KeyF"] }, target: card.c, stick: false });
  // Per hole: rise 0..1, time left up, whacked flight y, flight vy, flight spin, miss shake.
  const up = new Float64Array(HOLES), left = new Float64Array(HOLES), fy = new Float64Array(HOLES), fvy = new Float64Array(HOLES), fa = new Float64Array(HOLES), miss = new Float64Array(HOLES);
  const flying = new Uint8Array(HOLES);
  // round time left, next pop in, score, popped, last source (0 none, 1 key, 2 pointer), last hole, drew, start asked
  const s = new Float64Array([0, 0, 0, 0, 0, -1, 0, 0]);
  const whack = (h: number, src: number) => {
    s[4] = src;
    s[5] = h;
    if (up[h]! > 0.35 && !flying[h]) {
      flying[h] = 1;
      fy[h] = FLOOR - BH * up[h]!;
      fvy[h] = -360;
      fa[h] = 0;
      up[h] = 0;
      left[h] = 0;
      s[2] = s[2]! + 1;
    } else miss[h] = 0.3;
  };
  card.e.add({
    step(e, dt) {
      let busy = 0;
      if (s[7]) (s[7] = 0), (s[0] = ROUND), (s[1] = 0.3), (s[2] = 0), (s[3] = 0);
      if (s[0]! > 0) {
        busy = 1;
        s[0] = Math.max(0, s[0]! - dt);
        for (let h = 0; h < HOLES; h++) if (pad.hit(INTENTS[h]!)) whack(h, 1);
        if (pad.pointer.hit && s[0]! < ROUND - 0.02) {
          const x = pad.pointer.x / card.px[1]!; // CSS px → drawing units (measured outside the loop)
          for (let h = 0; h < HOLES; h++) if (x > HX[h]! - HW / 2 - 6 && x < HX[h]! + HW / 2 + 6) whack(h, 2);
        }
        s[1] = s[1]! - dt;
        if (s[1]! <= 0 && s[0]! > 0.6) {
          const h = (e.random() * HOLES) | 0;
          if (!flying[h] && left[h]! <= 0) (left[h] = 0.75 + e.random() * 0.4), (s[3] = s[3]! + 1);
          s[1] = 0.32 + e.random() * 0.35 - (ROUND - s[0]!) * 0.02;
        }
      }
      for (let h = 0; h < HOLES; h++) {
        if (left[h]! > 0) (left[h] = left[h]! - dt), (up[h] = Math.min(1, up[h]! + dt * 7)), (busy = 1);
        else if (up[h]! > 0) (up[h] = Math.max(0, up[h]! - dt * 6)), (busy = 1);
        if (miss[h]! > 0) (miss[h] = Math.max(0, miss[h]! - dt)), (busy = 1);
        if (flying[h]) {
          busy = 1;
          fvy[h] = fvy[h]! + 1300 * dt;
          fy[h] = fy[h]! + fvy[h]! * dt;
          fa[h] = fa[h]! + 9 * dt;
          if (fy[h]! > H + 40) flying[h] = 0;
        }
      }
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]! || (s[0]! > 0 ? 1 : 0);
      for (let h = 0; h < HOLES; h++) if (up[h]! > 0 || flying[h] || miss[h]! > 0) moving = 1;
      if (!moving && !s[6]) return;
      s[6] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      ctx.font = "800 9px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let h = 0; h < HOLES; h++) {
        const x = HX[h]! - HW / 2, shake = miss[h]! > 0 ? Math.sin(miss[h]! * 70) * 3 : 0;
        if (up[h]! > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - 6, 0, HW + 12, FLOOR);
          ctx.clip();
          brick(card, x, FLOOR - BH * up[h]!, HW, BH, card.tone, h === 0 ? card.kb : card.tag, 0, 3);
          ctx.restore();
        }
        ctx.fillStyle = ink(theme);
        ctx.fillRect(x - 4 + shake, FLOOR - 2, HW + 8, 5);
        ctx.fillStyle = faint(theme);
        ctx.fillRect(x + shake, FLOOR + 6, HW, 12);
        ctx.fillStyle = s[5] === h && s[4] === 1 && s[0]! > 0 ? card.tone : ink(theme);
        ctx.fillText(KEYS[h]!, HX[h]! + shake, FLOOR + 12.5);
        if (flying[h]) {
          ctx.save();
          ctx.translate(HX[h]!, fy[h]!);
          ctx.rotate(fa[h]!);
          brick(card, -HW / 2, -BH / 2, HW, BH, card.tone, "", 0.001, 3);
          ctx.restore();
        }
      }
      if (s[0]! <= 0) {
        ctx.fillStyle = ink(theme);
        ctx.font = "800 13px ui-monospace, Menlo, monospace";
        ctx.fillText(s[3] ? "TAP FOR ANOTHER ROUND" : "TAP TO START", W / 2, 70);
      } else {
        ctx.fillStyle = card.tone;
        ctx.fillRect(0, H - 3, (W * s[0]!) / ROUND, 3);
      }
    },
  });
  return {
    tap() {
      if (s[0]! <= 0) s[7] = 1;
    },
    read: () => {
      const by = s[4] === 1 ? `KEY ${KEYS[s[5]!]!.slice(-1)}` : s[4] === 2 ? "POINTER" : "";
      return s[0]! > 0 ? `SCORE ${s[2]}${by ? ` · LAST ${by}` : ""}` : s[3] ? `SCORE ${s[2]} / ${s[3]} · ROUND OVER` : "INTENTS 4 · KEYS 8 · POINTER";
    },
  };
});
export default mount;
