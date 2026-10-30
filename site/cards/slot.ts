// slot card: a film strip of six real astro-base-engine slot figures behind a small window. Each is
// a real fizlet/slot: it loads only once the window shows it (the browser's own visibility test:
// a figure clipped out of sight is not near), and its little scene drops a brick in. Tap the card
// to slide the strip on; tap a live figure to drop its brick again. At the end of the strip a tap
// destroys every slot and checks each figure against the markup it started as (Recall), then the
// strip runs back and the slots load again as they come into view.
import type { SlotMount } from "../../src/slot";
import { slot } from "../../src/slot";
import { mountCard, ground, brick, ink, faint, W, FLOOR } from "./frame";

const N = 6, SHOWN = 2, LAST = N - SHOWN, WX0 = 80, WX1 = 240, WY0 = 48, WY1 = 150, PITCH = (WX1 - WX0) / SHOWN, FW = PITCH * 0.9;
const CSS = `
.bc-sl{position:absolute;left:${(WX0 / W) * 100}%;width:${((WX1 - WX0) / W) * 100}%;top:${(WY0 / 200) * 100}%;height:${((WY1 - WY0) / 200) * 100}%;overflow:hidden;pointer-events:none}
.bc-sl>div{position:absolute;inset:0}
.bc-sl figure{position:absolute;top:0;bottom:0;width:${(FW / (WX1 - WX0)) * 100}%;margin:0 0 0 ${(((PITCH - FW) / 2) / (WX1 - WX0)) * 100}%;background:color-mix(in srgb,var(--tone) 10%,var(--bg));border:2px solid var(--rim);border-radius:6px;cursor:pointer;pointer-events:auto}
.bc-sl .ae-slot__placeholder{position:absolute;inset:auto 0 8px;text-align:center;font:800 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;color:var(--muted)}
.bc-sl i{position:absolute;left:30%;width:40%;height:24%;background:var(--tone);border:2px solid #07060f;border-radius:3px;box-shadow:0 3px 0 #07060f;font:800 9px/1 ui-monospace,Menlo,monospace;color:#07060f;display:grid;place-items:center;font-style:normal}`;

const mount: SlotMount = (stage, _slot, first) => mountCard(stage, _slot, first, (card) => {
  // Mini scenes: drop y (0 top .. 1 floor), its speed, live, drops, last drawn y (rounded tenths).
  const my = new Float64Array(N).fill(1), mv = new Float64Array(N), drawn = new Float64Array(N);
  const live = new Uint8Array(N);
  const els: (HTMLElement | null)[] = new Array(N).fill(null);
  // strip offset, wanted offset, recalls, exact on the last recall, loads, drew a moving frame
  const s = new Float64Array([0, 0, 0, -1, 0, 0]);
  const box = document.createElement("div");
  box.className = "bc-sl";
  box.innerHTML = `<style>${CSS}</style><div>${Array.from({ length: N }, (_, i) => `<figure class="ae-slot" data-slot-target="card#m${i + 1}" role="img" aria-label="Scene ${i + 1}" style="left:${(i / SHOWN) * 100}%"><span class="ae-slot__placeholder">WAITING</span></figure>`).join("")}</div>`;
  card.stage.insertBefore(box, card.c.nextSibling);
  const strip = box.lastChild as HTMLElement, figs = [...strip.children] as HTMLElement[];
  const before = figs.map((f) => f.outerHTML);

  // One figure's scene: a brick that drops in (at the first tap's height, if a tap loaded it).
  const scene = (i: number): SlotMount => (st, _f, tap) => {
    const b = document.createElement("i");
    b.textContent = String(i + 1);
    st.append(b);
    els[i] = b;
    live[i] = 1;
    my[i] = tap ? Math.max(0, Math.min(1, tap.y / Math.max(1, st.clientHeight))) - 0.3 : -0.4;
    mv[i] = 0;
    drawn[i] = -9;
    s[4] = s[4]! + 1;
    card.e.wake();
    return { destroy: () => ((live[i] = 0), (els[i] = null)) };
  };
  let slots: ReturnType<typeof slot>[] = [];
  const arm = () => (slots = figs.map((f, i) => slot(f, () => scene(i), { margin: "0px", idle: 0 })));
  arm();
  card.e.signal.addEventListener("abort", () => slots.forEach((x) => x.destroy()));
  // A tap on a live figure drops its brick again (the figure's own listener: the canvas is under it).
  figs.forEach((f, i) =>
    f.addEventListener("pointerdown", () => live[i] && ((my[i] = -0.3), (mv[i] = 0), card.e.running ? card.e.busy() : card.e.wake()), { signal: card.e.signal }),
  );

  card.e.add({
    step(e, dt) {
      let busy = 0;
      const d = s[1]! - s[0]!;
      const k = 7 * dt;
      if (d > 0.002 || d < -0.002) (s[0] = s[0]! + d * (k < 1 ? k : 1)), (busy = 1);
      else s[0] = s[1]!;
      // The mini scenes mount whenever the browser says they are in view, so the step may never have
      // run a live one before: branch-free arithmetic keeps every operation warm (a first-time
      // branch deoptimizes, and the unoptimized code boxes its doubles).
      for (let i = 0; i < N; i++) {
        const a = (my[i]! < 1 ? 1 : mv[i] !== 0 ? 1 : 0) * live[i]!;
        const v = mv[i]! + 5 * dt * a, y = my[i]! + v * dt * a, land = y >= 1 ? 1 : 0, back = -0.42 * v * (v > 0.4 ? 1 : 0);
        my[i] = land ? 1 : y;
        mv[i] = land ? back : v;
        busy |= a;
      }
      if (busy) e.busy();
    },
    render() {
      for (let i = 0; i < N; i++) {
        const b = els[i];
        if (!b) continue;
        // Written only when it moved a tenth of a percent (the DOM write is the cost).
        const y = Math.round(my[i]! * 700) / 10;
        if (y !== drawn[i]) (drawn[i] = y), (b.style.top = `calc(${y}% - 2px)`);
      }
      const moving = card.dirty[0]! || s[0] !== s[1] ? 1 : 0;
      if (!moving && !s[5]) return;
      s[5] = moving;
      card.dirty[0] = 0;
      strip.style.translate = s[0] ? `${(-s[0]! * 100) / SHOWN}% 0` : "";
      const { ctx, theme } = card;
      ground(card);
      // The figures outside the window, as the page would have them: there, but not loaded.
      ctx.strokeStyle = faint(theme);
      ctx.lineWidth = 2;
      ctx.setLineDash(DASHES);
      for (let i = 0; i < N; i++) {
        const x = WX0 + (i - s[0]!) * PITCH + (PITCH - FW) / 2;
        if (x + FW > WX0 && x < WX1) continue;
        ctx.strokeRect(x, WY0 + 1, FW, WY1 - WY0 - 2);
      }
      ctx.setLineDash(NONE);
      // The window: the viewport stand-in, its corners in the ink.
      ctx.fillStyle = ink(theme);
      for (let k = 0; k < 4; k++) {
        const r = k & 1, b = k >> 1, x = r ? WX1 + 4 : WX0 - 4, y = b ? WY1 + 4 : WY0 - 4;
        ctx.fillRect(r ? x - 10 : x, b ? y - 2 : y, 10, 2);
        ctx.fillRect(r ? x - 2 : x, b ? y - 10 : y, 2, 10);
      }
      ctx.font = "800 8px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("IN VIEW", (WX0 + WX1) / 2, WY0 - 9);
      // Where the strip is: a dot per figure, the shown ones in the tone.
      for (let i = 0; i < N; i++) {
        ctx.fillStyle = i >= Math.round(s[0]!) && i < Math.round(s[0]!) + SHOWN ? card.tone : faint(theme);
        ctx.fillRect(W / 2 - N * 6 + i * 12 + 3, WY1 + 12, 6, 6);
      }
      brick(card, 8, FLOOR + 4, 76, 12, card.tone, `${card.tag} ${card.kb}`, 0, 1);
    },
  });
  return {
    tap() {
      if (s[1]! < LAST) return void (s[1] = s[1]! + 1);
      // The end of the strip: give every figure back and check it is the markup it started as.
      slots.forEach((x) => x.destroy());
      let same = 0;
      for (let i = 0; i < N; i++) if (figs[i]!.outerHTML === before[i]) same++;
      s[3] = same;
      s[2] = s[2]! + 1;
      arm();
      s[1] = 0;
    },
    read: () => `LIVE ${live.reduce((a, b) => a + b, 0)}/${N}${s[3]! >= 0 ? ` · EXACT ${s[3]}` : ""}`,
  };
});
const DASHES = [4, 3], NONE: number[] = [];
export default mount;
