// The origin page: fzlt/slot loads the scene (scene.js) once the figure is near the viewport and
// the main thread is idle. Reduced motion: the scene never loads; the poster is the still frame, and
// the title's word still swaps its screens. The word in the title switches code and design.
import { slot } from "../../../src/slot";
import type { OriginScene, OriginMode } from "./scene";

const fig = document.querySelector<HTMLElement>("figure.ae-slot[data-slot-target='origin#hero']");
const word = document.querySelector<HTMLButtonElement>("[data-og-word]");
let scene: OriginScene | null = null;
if (fig) {
  slot(fig, () => import("./scene.js").then((m) => (stage: HTMLElement, el: HTMLElement) => (scene = m.mountSlot(stage, el, null) as OriginScene)));
  // The scene says when its mode changes (its own key row, or ours).
  fig.addEventListener("origin:state", (ev) => show((ev as CustomEvent<{ mode: OriginMode }>).detail.mode));
}
function show(mode: OriginMode) {
  if (!word) return;
  word.textContent = mode === "code" ? "Code" : "Design";
  word.setAttribute("aria-label", `Switch the screens to ${mode === "code" ? "design work" : "code"}`);
}
word?.addEventListener("click", () => {
  const next: OriginMode = word.textContent === "Code" ? "design" : "code";
  if (scene && fig?.querySelector(".og:not(.og-poster)")) return scene.setMode(next);
  // No scene (reduced motion, or not loaded yet): swap the poster's screens.
  for (const g of fig?.querySelectorAll<SVGElement>(".og-poster .og-code") ?? []) g.style.display = next === "code" ? "" : "none";
  for (const g of fig?.querySelectorAll<SVGElement>(".og-poster .og-des") ?? []) g.style.display = next === "design" ? "" : "none";
  show(next);
});
