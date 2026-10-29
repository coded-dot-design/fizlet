// Helpers shared by the brick pages' live demos: a sized canvas, theme colours and a status line.
import type { Engine } from "../../src/index";

/** A canvas of w × h drawing units, scaled to the device, labelled for screen readers. */
export function stage(host: HTMLElement, w: number, h: number, label: string) {
  const c = document.createElement("canvas");
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = h * dpr;
  c.className = "bd-canvas";
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", label);
  host.querySelector("[data-stage]")!.append(c);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  /** A pointer event → drawing units (read in the event handler, never in a step). */
  const at = (ev: PointerEvent, out: Float64Array) => {
    const r = c.getBoundingClientRect();
    out[0] = ((ev.clientX - r.left) * w) / r.width;
    out[1] = ((ev.clientY - r.top) * h) / r.height;
  };
  return { c, ctx, at };
}

export const light = () => document.documentElement.dataset.theme === "light";
export const ink = () => (light() ? "#14121f" : "#e9e6ff");
export const line = () => (light() ? "rgba(20,18,31,.18)" : "rgba(233,230,255,.16)");

/** engine.stats() in the demo's status line, twice a second (outside the loop: settled means no frames). */
export function status(host: HTMLElement, e: Engine) {
  const el = host.querySelector<HTMLElement>("[data-status]")!;
  const put = () => {
    const s = e.stats(), state = e.running ? "RUNNING" : s.paused.length ? s.paused.join(" · ").toUpperCase() : "IDLE";
    const t = `${state} · ${s.frames} frames`;
    if (el.textContent !== t) el.textContent = t;
  };
  put();
  const id = setInterval(put, 500);
  e.signal.addEventListener("abort", () => clearInterval(id));
  return put;
}
