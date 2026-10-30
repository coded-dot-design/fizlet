// css-clock card: scrub a stylesheet's time. The scene is plain CSS @keyframes (LEDs blinking on
// steps(), a brick patrolling the floor, a ball hopping, a pendulum), every one of them `paused`
// and reading its time from `--fz-t`; fizlet/css-clock moves that one property on the kernel clock.
// Tap anywhere and the playhead jumps to that point of the four-second loop (the ruler under the
// floor) and plays out from there; at the end every animation is back on its first frame and the
// engine sleeps. No animation is written in JavaScript: the look stays in the stylesheet.
import type { SlotMount } from "../../src/slot";
import { cssClock } from "../../src/css-clock";
import { mountCard, ground, brick, ink, faint, W, H, FLOOR } from "./frame";

const SPAN = 4, RY = 190, RX0 = 16, RX1 = W - 16;
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;
const CSS = `
.bc-cc{position:absolute;inset:0;pointer-events:none}
.bc-cc *{position:absolute;box-sizing:border-box;animation-play-state:paused;animation-iteration-count:infinite}
.bc-cc .led{top:24%;width:4%;aspect-ratio:1;background:#39ffb0;border:2px solid #07060f;border-radius:50%;animation:bc-cc-blink 1s steps(2) infinite paused;animation-delay:calc(var(--fz-t,0s) - var(--d,0s))}
.bc-cc .walk{left:0;top:${pct(FLOOR - 18, H)};width:${pct(48, W)};height:${pct(18, H)};background:var(--tone);border:2px solid #07060f;border-radius:3px;box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 #07060f;animation:bc-cc-walk 4s ease-in-out infinite paused;animation-delay:var(--fz-t,0s)}
.bc-cc .hop{left:${pct(196, W)};top:${pct(FLOOR - 16, H)};width:${pct(16, W)};aspect-ratio:1;background:#ffd84a;border:2px solid #07060f;border-radius:50%;animation:bc-cc-hop 1s cubic-bezier(.3,0,.7,1) infinite paused;animation-delay:var(--fz-t,0s)}
.bc-cc .pen{left:${pct(150, W)};top:16%;width:2px;height:34%;background:currentColor;transform-origin:50% 0;animation:bc-cc-swing 2s ease-in-out infinite paused;animation-delay:var(--fz-t,0s)}
.bc-cc .pen i{left:-7px;bottom:-12px;width:16px;height:16px;background:#ff2b4e;border:2px solid #07060f;border-radius:3px}
@keyframes bc-cc-blink{50%{opacity:.15}}
@keyframes bc-cc-walk{0%,100%{transform:translateX(${pct(10, 48)})}50%{transform:translateX(${pct(120, 48)})}}
@keyframes bc-cc-hop{0%,100%{transform:translateY(0) scaleY(.8)}10%,90%{transform:translateY(-20%) scaleY(1)}50%{transform:translateY(-260%)}}
@keyframes bc-cc-swing{0%,100%{transform:rotate(32deg)}50%{transform:rotate(-32deg)}}`;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e;
  const root = document.createElement("div");
  root.className = "bc-cc";
  root.setAttribute("aria-hidden", "true");
  root.style.color = "var(--ink)";
  root.innerHTML = `<style>${CSS}</style>${[0, 1, 2, 3, 4].map((i) => `<b class="led" style="left:${10 + i * 6}%;--d:${i * 0.2}s"></b>`).join("")}<b class="walk"></b><b class="hop"></b><b class="pen"><i></i></b>`;
  card.stage.insertBefore(root, card.c.nextSibling);
  const clk = cssClock(root, { span: SPAN, loops: 1, signal: e.signal });
  // The clock has its own engine: while it plays, keep the card's engine (and its readout) awake.
  clk.engine.add({ read() { if (!e.running) e.wake(); } });
  const n = new Int32Array(2); // scrubs, drew
  e.add({
    step(e) {
      if (clk.tl.playing) e.busy();
    },
    render() {
      const moving = card.dirty[0]! || (clk.tl.playing ? 1 : 0);
      if (!moving && !n[1]) return;
      n[1] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      // The ruler: one tick a second, the playhead where the stylesheet's time is.
      ctx.fillStyle = faint(theme);
      ctx.fillRect(RX0, RY, RX1 - RX0, 2);
      for (let s = 0; s <= SPAN; s++) ctx.fillRect(RX0 + ((RX1 - RX0) * s) / SPAN - 1, RY - 3, 2, 8);
      const t = clk.tl.time % SPAN, hx = RX0 + ((RX1 - RX0) * t) / SPAN;
      ctx.fillStyle = card.tone;
      ctx.fillRect(RX0, RY, hx - RX0, 2);
      ctx.fillStyle = ink(theme);
      ctx.fillRect(hx - 1.5, RY - 6, 3, 14);
      // The name brick: the floor's right end, where nothing patrols.
      brick(card, 232, FLOOR - 40, 76, 18, card.tone, card.tag);
      brick(card, 232, FLOOR - 18, 76, 18, card.tone, card.kb);
    },
  });
  return {
    tap(x) {
      // Scrub: the playhead jumps to the tapped point of the loop and plays out from there.
      const t = Math.max(0, Math.min(0.98, (x - RX0) / (RX1 - RX0))) * SPAN;
      clk.tl.seek(t).play();
      n[0] = n[0]! + 1;
    },
    read: () => `CSS ${(clk.tl.time % SPAN).toFixed(1)} S / ${SPAN} S`,
  };
});
export default mount;
