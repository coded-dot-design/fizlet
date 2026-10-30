// Every page: the theme toggle (shared with DOM VIRUS and Battlefield), the copy keys, the
// kit's press cue for page keys (keyboard press, iOS :active) and fizlet/touch, so pinching a demo
// never zooms the page (the page itself keeps pinch-zoom, WCAG 1.4.4).
import { pressCue } from "../src/ui/board-ui";
import { lockTouch, SURFACES } from "../src/touch";

pressCue(document);
lockTouch(document, `${SURFACES},.demo-board,.bd-canvas,.bd-tl,.lab-stage`);
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
