// Every page: the theme toggle (shared with DOM VIRUS and Battlefield), the copy keys and the
// kit's press cue for page keys (keyboard press, iOS :active).
import { pressCue } from "../src/ui/board-ui";

pressCue(document);
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
