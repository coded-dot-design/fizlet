// The gallery page's only script before a demo nears the viewport: @fzlt/core/slot, armed on every
// entry's figure. Each entry's live chunk (gallery/<id>.js, its own bundle: the size on its badge)
// loads once its slot is near and the main thread is idle; reduced motion keeps every poster.
import { slot } from "../../src/slot";
import type { SlotMount } from "../../src/slot";
import { shapes } from "./shape";

const base = new URL(".", import.meta.url);
for (const fig of document.querySelectorAll<HTMLElement>("figure.ae-slot[data-gallery]")) {
  slot(fig, () => import(new URL(`${fig.dataset.gallery}.js`, base).href).then((m: { mount: SlotMount }) => {
    fig.dataset.live = "1";
    return m.mount;
  }));
}
shapes();
