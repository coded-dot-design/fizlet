// Every page: the theme toggle (shared with DOM VIRUS and Battlefield), the copy keys, the
// kit's press cue for page keys (keyboard press, iOS :active) and @fzlt/core/touch, so pinching a demo
// never zooms the page (the page itself keeps pinch-zoom, WCAG 1.4.4).
import { pressCue } from "../src/ui/board-ui";
import { lockTouch, SURFACES } from "../src/touch";
import { scrollHint } from "./scroll-hint";
import { siteNav } from "./nav";

pressCue(document);
lockTouch(document, `${SURFACES},.demo-board,.bd-canvas,.bd-tl,.lab-stage`);
scrollHint(document); // a frame that keeps the page's scroll says why, when someone tries
const head = document.querySelector<HTMLElement>(".site-head");
if (head) siteNav(head); // the header menus and the phone menu
const html = document.documentElement;
document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = next;
  try {
    localStorage.setItem("dom-virus:theme", next);
  } catch {}
});

for (const key of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  const label = key.lastChild as Text;
  key.addEventListener("click", async () => {
    const text = key.closest(".code-card")?.querySelector("code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      label.nodeValue = "Copied";
    } catch {
      label.nodeValue = "Select it";
    }
    setTimeout(() => (label.nodeValue = "Copy"), 1400);
  });
}

// People avatars (/people/): cross-fade each avatar's frames every 4 s. Settles: only frames on
// screen turn, the timer stops while none is on screen or the tab is hidden, and under reduced
// motion nothing turns (the first frame stays). No brick: a page helper, not engine code.
const frames = document.querySelectorAll<HTMLElement>("[data-rotate]");
if (frames.length && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const seen = new Set<HTMLElement>();
  let timer = 0;
  const turn = () => {
    for (const f of seen) {
      const on = f.querySelector(".on");
      on?.classList.remove("on");
      (on?.nextElementSibling ?? f.firstElementChild)?.classList.add("on");
    }
  };
  const sync = () => {
    const run = seen.size > 0 && !document.hidden;
    if (run && !timer) timer = window.setInterval(turn, 4000);
    else if (!run && timer) timer = (clearInterval(timer), 0);
  };
  const io = new IntersectionObserver((list) => {
    for (const e of list) e.isIntersecting ? seen.add(e.target as HTMLElement) : seen.delete(e.target as HTMLElement);
    sync();
  });
  for (const f of frames) io.observe(f);
  document.addEventListener("visibilitychange", sync);
}
