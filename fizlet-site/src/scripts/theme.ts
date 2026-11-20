// The theme key (ThemeToggle): light or dark, shared with DOM VIRUS and Battlefield through
// localStorage "dom-virus:theme". BaseLayout's inline head script applies the saved choice before
// first paint, so there is no flash; this only flips it.
const html = document.documentElement;
for (const key of document.querySelectorAll("[data-theme-toggle]")) {
  key.addEventListener("click", () => {
    const next = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = next;
    try {
      localStorage.setItem("dom-virus:theme", next);
    } catch {}
  });
}
