// The fizz page: the slot loads the scene (kernel + fx + sprite + the can) only once the figure is
// near the viewport and the main thread is idle. Reduced motion: the scene never loads; the poster
// is the still frame. POP cracks the can again; RECALL gives the page back.
import { slot } from "../../../src/slot";
import type { FizzScene } from "./scene";

const fig = document.querySelector<HTMLElement>("figure.ae-slot[data-slot-target='fizz#hero']")!;
let scene: FizzScene | null = null;
const load = () => import("./scene").then((m) => (stage: HTMLElement, el: HTMLElement, first: Parameters<typeof m.fizz>[2]) => (scene = m.fizz(stage, el, first)));
let hero = slot(fig, load);

const status = document.querySelector<HTMLElement>("[data-fizz-status]");
const say = (t: string) => status && (status.textContent = t);
document.querySelector("[data-fizz-pop]")?.addEventListener("click", () => {
  if (hero.mounted && scene) return scene.pop();
  hero.destroy();
  hero = slot(fig, load, { idle: 0 });
  say("LIVE");
});
document.querySelector("[data-fizz-recall]")?.addEventListener("click", () => {
  hero.destroy();
  scene = null;
  say("RESTORED · PAGE AS IT WAS");
});
