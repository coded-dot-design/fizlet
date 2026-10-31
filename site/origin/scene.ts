// The Origin PLACEHOLDER scene: the fallback for a build without the origin scene
// (site/demos/origin/, fizlet#218). Same shape as that scene (contract.ts: mountSlot, setMode,
// setSound, state, origin:state). It clones the poster into the slot's stage and plays a short idle
// loop on the kernel: steam rises off the coffee, notes float off the headphones, the cursor blinks
// and the screen types. Then it settles: no requestAnimationFrame at all until a tap or a mode flip
// plays it again. A tap clicks through fzlt/sound only when sound is on (and after a gesture).
// Everything it adds is inside the stage the slot made (gone on destroy) or a listener on the engine's
// signal, so destroy() gives the page back exactly.
import { createEngine } from "../../src/kernel/index";
import { sound } from "../../src/sound";
import type { SlotMount } from "../../src/slot";
import { STATE_EVENT, type OriginMode, type OriginScene } from "./contract";

const RUN = 4.5; // seconds of idle loop after each wake

export const mountSlot: SlotMount = (stage, figure) => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const engine = createEngine({ root: stage, settle: 0.5, fps: 30 });
  const snd = sound(engine, { cues: {}, on: figure.dataset.sound === "1" });
  let mode: OriginMode = figure.dataset.mode === "design" ? "design" : "code";
  const src = figure.querySelector("svg.ogs-poster")!;
  const art = src.cloneNode(true) as SVGSVGElement;
  art.classList.remove("ae-slot__placeholder");
  art.classList.add("ogs-live");
  art.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  stage.append(art);

  const steam = [...art.querySelectorAll<SVGElement>(".ogs-steam")];
  const notes = [...art.querySelectorAll<SVGElement>(".ogs-note")];
  const lines = [...art.querySelectorAll<SVGRectElement>(".ogs-ln")];
  const full = lines.map((l) => Number(l.getAttribute("width")));
  const cursor = art.querySelector<SVGElement>(".ogs-cursor")!;
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
  const on = { signal: engine.signal };
  figure.addEventListener("pointerdown", () => (replay(), snd.play("click", 1)), on);
  const tell = () => figure.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: scene.state, bubbles: true }));
  const scene: OriginScene = {
    destroy: () => engine.destroy(),
    setMode(m) {
      mode = m;
      replay();
      tell();
    },
    setSound(v) {
      snd.on = v;
      tell();
    },
    pause: () => engine.stop(),
    play: () => engine.start(),
    get state() {
      return { mode, open: true, bricks: false, sound: snd.on, paused: !engine.running };
    },
  };
  engine.start();

  return scene;
};
