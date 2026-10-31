// The header nav (site/layout.mjs navTree): each group is a disclosure button and a small menu
// (click or Enter/Space opens it, Escape closes it and gives focus back, a click outside or focus
// leaving closes it; never hover-only). On a phone the whole nav is one full-width panel behind the
// menu key: focus stays inside it while it is open, Escape or a tap outside closes it. No motion.
export function siteNav(head: HTMLElement): void {
  const key = head.querySelector<HTMLButtonElement>("[data-menu]");
  const panel = head.querySelector<HTMLElement>(".site-nav");
  const btns = [...head.querySelectorAll<HTMLButtonElement>(".nav-btn")];
  if (!key || !panel) return;
  const set = (b: HTMLButtonElement, open: boolean) => b.setAttribute("aria-expanded", String(open));
  const isOpen = (b: HTMLButtonElement) => b.getAttribute("aria-expanded") == "true";
  const shut = (except?: HTMLButtonElement) => btns.forEach((b) => b != except && set(b, false));
  const menu = (open: boolean, back?: boolean) => {
    set(key, open);
    head.classList.toggle("menu-open", open);
    if (open) panel.querySelector("a")?.focus();
    else if (back) key.focus();
  };
  for (const b of btns) {
    b.onclick = () => (shut(b), set(b, !isOpen(b)));
    b.parentElement!.addEventListener("focusout", (e) => !b.parentElement!.contains(e.relatedTarget as Node) && set(b, false));
  }
  key.onclick = () => menu(!isOpen(key));
  matchMedia("(min-width: 961px)").addEventListener("change", () => menu(false));
  document.addEventListener("keydown", (e) => {
    if (e.key == "Escape") {
      if (isOpen(key)) return menu(false, true);
      const b = btns.find(isOpen);
      if (b) set(b, false), b.focus();
    } else if (e.key == "Tab" && isOpen(key)) {
      const f = [key, ...panel.querySelectorAll("a")];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey ? i < 1 : i < 0 || i == f.length - 1) e.preventDefault(), f[e.shiftKey ? f.length - 1 : 0]!.focus();
    }
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Node;
    if (isOpen(key) && !panel.contains(t) && !key.contains(t)) menu(false);
    const b = btns.find(isOpen);
    if (b && !b.parentElement!.contains(t)) set(b, false);
  });
}
