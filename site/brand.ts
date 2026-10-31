// /brand/: the sticker slam on the Stickers card. The motion is the kit's own CSS (bui-slam, from
// @fzlt/core/ui), restarted by its slam(); the sticker hides again once it has landed, so the page goes
// back to rest with nothing running. Under reduced motion the kit turns the animation off and the
// sticker just shows, then hides. No requestAnimationFrame.
import { slam } from "../src/ui/board-ui";

const key = document.querySelector<HTMLElement>("[data-slam-key]");
const wrap = document.querySelector<HTMLElement>("[data-slam]");
let timer = 0;
key?.addEventListener("click", () => {
  if (!wrap) return;
  wrap.hidden = false;
  slam(wrap.firstElementChild as HTMLElement);
  clearTimeout(timer);
  timer = window.setTimeout(() => (wrap.hidden = true), 1500);
});
