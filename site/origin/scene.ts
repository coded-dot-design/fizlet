// The Origin PLACEHOLDER scene: it meets the mount contract (contract.ts, README.md) until the
// origin-story scene replaces this file. It clones the poster into the slot's stage and plays a short
// idle loop on the kernel: steam rises off the coffee, notes float off the headphones, the cursor
// blinks and the screen types. Then it settles: no requestAnimationFrame at all until a tap or a
// mode flip plays it again. A tap makes a soft blip only when the sound gate is on.
// Everything it adds is inside the stage the slot made (gone on destroy) or a listener on the engine's
// signal, so destroy() gives the page back exactly.
import { createEngine } from "../../src/kernel/index";
import { MODE_EVENT, type OriginMount } from "./contract";

const RUN = 4.5; // seconds of idle loop after each wake

export const mount: OriginMount = (figure, { reduced, sound, stage, first }) => {
  const engine = createEngine({ root: stage, settle: 0.5, fps: 30 });
  const src = figure.querySelector("svg.og-poster")!;
  const art = src.cloneNode(true) as SVGSVGElement;
  art.classList.remove("ae-slot__placeholder");
  art.classList.add("og-live");
  art.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  stage.append(art);

  const steam = [...art.querySelectorAll<SVGElement>(".og-steam")];
  const notes = [...art.querySelectorAll<SVGElement>(".og-note")];
  const lines = [...art.querySelectorAll<SVGRectElement>(".og-ln")];
  const full = lines.map((l) => Number(l.getAttribute("width")));
  const cursor = art.querySelector<SVGElement>(".og-cursor")!;
  let t = reduced ? RUN : 0, drawn = -1;

  engine.add({
    step(e, dt) {
      if (t >= RUN) return;
      t = Math.min(RUN, t + dt);
      e.busy();
    },
    render() {
      if (t === drawn) return;
      drawn = t;
      const k = t / RUN, live = t < RUN;
      // SVG attributes on the scene's own clone (never the page's styles): change-only by the guard above.
      const set = (el: Element, k: string, v: string | null) => (v === null ? el.removeAttribute(k) : el.setAttribute(k, v));
      steam.forEach((s, i) => {
        const p = (t * 0.6 + i / 3) % 1;
        set(s, "transform", live ? `translate(0 ${(-40 * p).toFixed(1)})` : null);
        set(s, "opacity", live ? (Math.sin(p * Math.PI) * 0.9).toFixed(2) : ".55");
      });
      notes.forEach((n, i) => {
        const p = (t * 0.45 + i / 2) % 1;
        set(n, "transform", live ? `translate(0 ${(-70 * p).toFixed(1)})` : null);
        set(n, "opacity", live ? (Math.sin(p * Math.PI) * (1 - k * 0.5)).toFixed(2) : "0");
      });
      // the screen types its lines in during the first half, then holds
      lines.forEach((l, i) => l.setAttribute("width", String(Math.round(full[i]! * Math.min(1, Math.max(0, k * 2 * lines.length - i))))));
      set(cursor, "opacity", live && (t * 2.4) % 1 > 0.5 ? "0" : null);
    },
  });

  const replay = () => {
    if (reduced) return;
    t = 0;
    engine.wake();
  };
  const blip = () => {
    const ctx = sound.ctx();
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.16);
  };
  const on = { signal: engine.signal };
  figure.addEventListener("pointerdown", () => (replay(), blip()), on);
  figure.addEventListener(MODE_EVENT, replay, on);
  if (first) blip();
  engine.start();

  return {
    destroy() {
      engine.destroy();
      art.remove();
    },
  };
};
