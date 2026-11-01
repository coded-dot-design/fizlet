// match card: a ten-second round. PRESS START, then 3 · 2 · 1, then bricks rain down: catch them on
// your paddle (it follows the pointer, or jumps to a tap). Eight caught when the clock runs out is a
// STAGE CLEAR; fewer is GAME OVER, and the bricks you missed lie cracked on the floor. The whole
// flow is @fzlt/core/match's phase machine, run headless: intro, count, play, end, rematch.
import type { SlotMount } from "../../src/slot";
import { match } from "../../src/match";
import { mountCard, ground, brick, ink, W, H, FLOOR } from "./frame";

const N = 10, BW = 30, BH = 12, PW = 64, PY = FLOOR - 16, GOAL = 8, SECONDS = 10;
const PHASE = ["intro", "count", "play", "paused", "end"];

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  // Falling bricks: x, y, vy, state (0 free, 1 falling, 2 caught (flash), 3 cracked on the floor), timer.
  const bx = new Float64Array(N), by = new Float64Array(N), bv = new Float64Array(N), bt = new Float64Array(N);
  const st = new Uint8Array(N);
  // paddle x, target x, caught, missed, next drop in, phase index, phase time, won, drew
  const s = new Float64Array([W / 2, W / 2, 0, 0, 0, 0, 0, 0, 0]);
  const label = `${card.tag} ${card.kb}`;
  const m = match(card.e, null, {
    count: 3, seconds: SECONDS, keys: [],
    begin() {
      st.fill(0);
      s[2] = 0;
      s[3] = 0;
      s[4] = 0.4;
    },
    timeUp: () => s[2]! >= GOAL,
    on(p) {
      s[5] = PHASE.indexOf(p);
      s[6] = 0;
      if (p === "end") s[7] = s[2]! >= GOAL ? 1 : 0;
    },
  });
  card.e.add({
    step(e, dt) {
      s[6] = s[6]! + dt;
      const playing = s[5] === 2;
      s[0] = s[0]! + (s[1]! - s[0]!) * Math.min(1, 16 * dt);
      if (playing || s[5] === 1) e.busy();
      if (playing) {
        s[4] = s[4]! - dt;
        if (s[4]! <= 0) {
          for (let i = 0; i < N; i++)
            if (st[i] === 0) {
              st[i] = 1;
              bx[i] = 20 + e.random() * (W - 40 - BW);
              by[i] = -BH;
              bv[i] = 70 + s[6]! * 9; // phase time = seconds played (no getter in the step: it would box)
              break;
            }
          s[4] = 0.75 - s[6]! * 0.035;
        }
      }
      for (let i = 0; i < N; i++) {
        if (st[i] === 1) {
          e.busy();
          bv[i] = bv[i]! + 140 * dt;
          by[i] = by[i]! + bv[i]! * dt;
          // Catch: the brick's bottom crosses the paddle's top while over it.
          if (by[i]! + BH >= PY && by[i]! + BH <= PY + 10 && bx[i]! + BW > s[0]! - PW / 2 && bx[i]! < s[0]! + PW / 2) (st[i] = 2), (bt[i] = 0.25), (s[2] = s[2]! + 1);
          else if (by[i]! + BH >= FLOOR) (by[i] = FLOOR - BH), (st[i] = 3), (s[3] = s[3]! + 1);
        } else if (st[i] === 2) {
          e.busy();
          bt[i] = bt[i]! - dt;
          if (bt[i]! <= 0) st[i] = 0;
        }
      }
      // Missed bricks stay cracked on the floor until the next round; free a slot if they fill up.
      if (playing) {
        let free = 0;
        for (let i = 0; i < N; i++) if (st[i] === 0) free++;
        if (!free) for (let i = 0; i < N; i++) if (st[i] === 3) { st[i] = 0; break; }
      }
      const d = s[1]! - s[0]!;
      if (d > 0.3 || d < -0.3) e.busy();
    },
    render() {
      const moving = card.dirty[0]! || (s[5] === 1 || s[5] === 2 || s[1]! - s[0]! > 0.3 || s[0]! - s[1]! > 0.3 ? 1 : 0);
      let any = moving;
      for (let i = 0; i < N; i++) if (st[i] === 1 || st[i] === 2) any = 1;
      if (!any && !s[8]) return;
      s[8] = any;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      for (let i = 0; i < N; i++) {
        if (!st[i]) continue;
        if (st[i] === 2) brick(card, bx[i]!, PY - BH - (0.25 - bt[i]!) * 60, BW, BH, "#ffffff", "", 0, 2);
        else brick(card, bx[i]!, by[i]!, BW, BH, card.tone, "", 0, 2);
        if (st[i] === 3) {
          ctx.strokeStyle = "#07060f";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx[i]! + 8, by[i]!);
          ctx.lineTo(bx[i]! + 14, by[i]! + 6);
          ctx.lineTo(bx[i]! + 11, by[i]! + BH);
          ctx.stroke();
        }
      }
      brick(card, s[0]! - PW / 2, PY, PW, 9, ink(theme), "", 0, 2);
      brick(card, 8, FLOOR + 4, 76, 12, card.tone, label, 0, 1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ink(theme);
      if (s[5] === 2) {
        ctx.fillStyle = card.tone;
        ctx.fillRect(0, H - 3, (W * m.clock) / SECONDS, 3);
      } else if (s[5] === 1) {
        ctx.font = "800 44px ui-monospace, Menlo, monospace";
        ctx.fillText(s[6]! < 1 ? "3" : s[6]! < 2 ? "2" : "1", W / 2, 84);
      } else {
        // The sticker: the kit's words, flat and tilted.
        ctx.save();
        ctx.translate(W / 2, 80);
        ctx.rotate(-0.06);
        ctx.fillStyle = "#07060f";
        ctx.fillRect(-96, -22, 196, 48);
        ctx.fillStyle = s[5] === 4 ? (s[7] ? card.tone : "#ff2b4e") : card.tone;
        ctx.fillRect(-100, -26, 196, 48);
        ctx.fillStyle = "#07060f";
        ctx.font = "800 16px ui-monospace, Menlo, monospace";
        ctx.fillText(s[5] === 4 ? (s[7] ? "STAGE CLEAR" : "GAME OVER") : "PRESS START", -2, -6);
        ctx.font = "800 9px ui-monospace, Menlo, monospace";
        ctx.fillText(s[5] === 4 ? "TAP FOR A REMATCH" : `CATCH ${GOAL} IN ${SECONDS} SECONDS`, -2, 11);
        ctx.restore();
      }
    },
  });
  return {
    tap(x) {
      if (s[5] === 0) m.start();
      else if (s[5] === 4) m.restart();
      else s[1] = Math.max(PW / 2, Math.min(W - PW / 2, x));
    },
    hover(x) {
      if (x >= 0 && (s[5] === 1 || s[5] === 2)) s[1] = Math.max(PW / 2, Math.min(W - PW / 2, x));
    },
    read: () => (s[5] === 2 ? `CAUGHT ${s[2]} / ${GOAL} · ${Math.ceil(m.clock)} S` : s[5] === 4 ? `CAUGHT ${s[2]} · MISSED ${s[3]}` : `PHASE ${PHASE[s[5]!]!.toUpperCase()}`),
  };
});
export default mount;
