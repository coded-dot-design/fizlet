// The brick cards' loader: every <figure data-brick-card="<id>"> on the page (site/brick-cards.mjs)
// becomes a fizlet/slot; its card's chunk loads only when it nears the viewport, never under
// reduced motion. `mountBrickCards(root)` mounts the cards under `root` and returns their slots
// (destroy() each to give the page back); this file mounts the whole page on load.
import { slot } from "../src/slot";
import type { SlotMount } from "../src/slot";

type Load = () => Promise<{ default: SlotMount }>;
export const CARDS: Record<string, Load> = {
  kernel: () => import("./cards/kernel"),
  fx: () => import("./cards/fx"),
  collide: () => import("./cards/collide"),
  grid: () => import("./cards/grid"),
  steer: () => import("./cards/steer"),
};

const mounted = new WeakSet<Element>(); // not a data attribute: the page stays byte for byte

export function mountBrickCards(root: ParentNode = document) {
  const out: ReturnType<typeof slot>[] = [];
  for (const fig of root.querySelectorAll<HTMLElement>("figure[data-brick-card]")) {
    const load = CARDS[fig.dataset.brickCard!];
    if (load && !mounted.has(fig)) mounted.add(fig), out.push(slot(fig, () => load().then((m) => m.default), { idle: 400 }));
  }
  return out;
}

(globalThis as { fizletBrickCards?: unknown }).fizletBrickCards = mountBrickCards();
