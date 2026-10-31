// hud card: the high striker. Tap and the hammer brick slams the pad; the puck shoots up the tower.
// Tap again quickly and the heat builds, so the next strike goes higher: ring the bell at the top.
// The scoreboard beside it is real DOM bound with fizlet/hud: score, best, a heat meter, a HOT flag
// and a feed of the last strikes, each written only when what it shows changes. The readout counts
// the DOM writes against the frames drawn: far fewer, which is the point.
import type { SlotMount } from "../../src/slot";
import { hud } from "../../src/hud";
import { mountCard, ground, brick, ink, faint, FLOOR } from "./frame";

const TX = 92, TOP = 46, PAD = FLOOR - 10, G = 900, CSS = `
.bc-hud{position:absolute;right:4%;top:20%;bottom:8%;width:38%;display:grid;align-content:start;gap:6px;font:800 10px/1.2 ui-monospace,Menlo,monospace;color:var(--ink);letter-spacing:.06em}
.bc-hud dl{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:0}
.bc-hud dt{font-size:8px;color:var(--muted)}
.bc-hud dd{margin:0;font-size:18px}
.bc-hud .m{height:8px;border:2px solid #07060f;border-radius:3px;background:color-mix(in srgb,var(--ink) 10%,transparent);overflow:hidden}
.bc-hud .m i{display:block;height:100%;background:var(--tone);transition:none}
.bc-hud .hot{display:none;justify-self:start;padding:1px 6px;background:#ff2b4e;color:#fff;border:2px solid #07060f;border-radius:3px}
.bc-hud.is-hot .hot{display:block}
.bc-hud ol{margin:0;padding:0;list-style:none;display:grid;gap:2px;font-size:9px;color:var(--muted)}
.bc-hud ol li:first-child{color:var(--ink)}`;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  // puck y, puck vy, heat 0..1, score, best 0..1, strike asked, hammer squash, bell shake, last tap age,
  // drew, peak this flight, strikes
  const s = new Float64Array([PAD - 8, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0]);
  const box = document.createElement("div");
  box.className = "bc-hud";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `<style>${CSS}</style><dl><div><dt>SCORE</dt><dd></dd></div><div><dt>BEST</dt><dd></dd></div></dl><dt>HEAT</dt><div class="m"><i></i></div><span class="hot">HOT</span><ol></ol>`;
  card.stage.insertBefore(box, card.c.nextSibling);
  const dd = box.querySelectorAll<HTMLElement>("dd");
  const h = hud(card.e, box);
  h.num(dd[0]!, [s, 3]);
  h.num(dd[1]!, [s, 4], "pct");
  h.meter(box.querySelector<HTMLElement>(".m i")!, [s, 2]);
  h.flag(box, "is-hot", () => s[2]! > 0.6);
  h.feed(box.querySelector("ol")!, 3, "strike", (a) => (a >= 100 ? "DING! +10" : `${a}% +${(a / 25) | 0}`));
  // Count what the HUD writes to the DOM (outside the loop: a MutationObserver).
  const writes = new Int32Array(2);
  const mo = new MutationObserver((list) => (writes[0] = writes[0]! + list.length));
  mo.observe(box, { subtree: true, childList: true, characterData: true, attributes: true });
  card.e.signal.addEventListener("abort", () => mo.disconnect());
  card.e.add({
    step(e, dt) {
      let busy = 0;
      s[8] = s[8]! + dt;
      if (s[5]) {
        s[5] = 0;
        // Heat: quick taps stack it; it cools on its own.
        s[2] = Math.min(1, s[2]! + (s[8]! < 0.7 ? 0.22 : 0.1));
        s[8] = 0;
        s[6] = 1;
        const power = 0.35 + s[2]! * 0.75, rise = (PAD - 8 - TOP) * power;
        s[0] = PAD - 8;
        s[1] = -Math.sqrt(2 * G * rise);
        s[10] = 0;
        s[11] = s[11]! + 1;
      }
      if (s[1] !== 0 || s[0]! < PAD - 8) {
        busy = 1;
        s[1] = s[1]! + G * dt;
        s[0] = s[0]! + s[1]! * dt;
        const pct = Math.min(1, (PAD - 8 - s[0]!) / (PAD - 8 - TOP));
        if (pct > s[10]!) s[10] = pct;
        if (s[0]! <= TOP) {
          // The bell: the puck hits it and drops back.
          s[0] = TOP;
          s[1] = Math.abs(s[1]!) * 0.3;
          s[7] = 1;
          s[3] = s[3]! + 10;
          e.events.emit("strike", 100);
          s[10] = -1;
        }
        if (s[0]! >= PAD - 8 && s[1]! > 0) {
          s[0] = PAD - 8;
          s[1] = 0;
          if (s[10]! >= 0) {
            const pct = Math.round(s[10]! * 100);
            s[3] = s[3]! + ((pct / 25) | 0);
            e.events.emit("strike", pct);
          }
          if (s[10]! < 0 || s[10]! > s[4]!) s[4] = s[10]! < 0 ? 1 : s[10]!;
        }
      }
      if (s[2]! > 0) (s[2] = Math.max(0, s[2]! - dt * 0.18)), (busy = 1);
      if (s[6]! > 0.01) (s[6] = s[6]! * (1 - 10 * dt)), (busy = 1);
      else s[6] = 0;
      if (s[7]! > 0.01) (s[7] = s[7]! * (1 - 4 * dt)), (busy = 1);
      else s[7] = 0;
      if (busy) e.busy();
    },
    render() {
      writes[1] = writes[1]! + 1;
      const moving = card.dirty[0]! || (s[1] !== 0 || s[6]! > 0 || s[7]! > 0 || s[2]! > 0 ? 1 : 0);
      if (!moving && !s[9]) return;
      s[9] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      // The tower: a rail with marks every quarter, the bell on top.
      ctx.fillStyle = faint(theme);
      ctx.fillRect(TX - 3, TOP, 6, PAD - TOP);
      for (let q = 1; q < 4; q++) ctx.fillRect(TX - 12, TOP + ((PAD - 8 - TOP) * q) / 4, 24, 2);
      const shake = s[7]! > 0 ? Math.sin(s[7]! * 60) * 4 * s[7]! : 0;
      ctx.fillStyle = s[7]! > 0.05 ? "#ffd84a" : ink(theme);
      ctx.beginPath();
      ctx.arc(TX + shake, TOP - 6, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(TX - 14 + shake, TOP - 7, 28, 4);
      ctx.fillStyle = "#ff2b4e";
      ctx.fillRect(TX - 9, s[0]! - 8, 18, 16);
      // The pad and the hammer brick that slams it.
      brick(card, TX - 30, PAD, 60, 8, ink(theme), "", 0, 2);
      brick(card, TX + 40, PAD - 24 + s[6]! * 14, 52, 18, card.tone, card.kb, s[6]! * 0.8, 3);
    },
  });
  return {
    tap() {
      s[5] = 1;
    },
    read: () => `DOM WRITES ${writes[0]} · FRAMES ${writes[1]}`,
  };
});
export default mount;
