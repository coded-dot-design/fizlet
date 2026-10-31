// The periodic table's keys (site/periodic.mjs): press a brick (click, tap, Enter or Space) and its key
// goes down (aria-expanded, the kit's locked press), lights in its colour and says PRESSED, and the
// quick view flies in (CSS @starting-style; under reduced motion it simply appears). One open at a
// time; press it again, the close key or Esc to close. Arrow keys move between bricks (one tab
// stop: roving tabindex), Home and End jump to the first and last. No frame loop, no timers: the
// page settles at 0 frames whatever you do.
const root = document.querySelector<HTMLElement>("[data-periodic]");
if (root) {
  const keys = [...root.querySelectorAll<HTMLButtonElement>(".el-key")];
  const card = root.querySelector<HTMLElement>(".pt-card")!;
  const body = card.querySelector<HTMLElement>(".pt-q")!;
  const say = root.querySelector<HTMLElement>("[data-pt-say]")!;
  // Each key's place, [row, col], from its grid-area ("row / col").
  const at = keys.map((k): [number, number] => { const [r = "0", c = "0"] = k.style.gridArea.split("/"); return [parseInt(r, 10), parseInt(c, 10)]; });
  const cols = Math.max(...at.map(([, c]) => c));
  let open: HTMLButtonElement | null = null;

  const close = (focus = false) => {
    if (!open) return;
    const k = open;
    k.setAttribute("aria-expanded", "false");
    open = null;
    card.hidden = true;
    body.replaceChildren();
    say.textContent = "";
    if (focus) k.focus();
  };
  const show = (k: HTMLButtonElement) => {
    if (open === k) return close();
    const tpl = root.querySelector<HTMLTemplateElement>(`#pt-t-${k.dataset.el}`);
    if (!tpl) return;
    open?.setAttribute("aria-expanded", "false");
    card.hidden = true;
    getComputedStyle(card).display; // let the next show start from its @starting-style again
    body.replaceChildren(tpl.content.cloneNode(true));
    const name = body.querySelector(".pt-q-name")?.textContent ?? "";
    card.style.setProperty("--tone", k.style.getPropertyValue("--tone"));
    card.setAttribute("aria-label", `Quick view: ${name}`);
    card.hidden = false;
    k.setAttribute("aria-expanded", "true");
    open = k;
    say.textContent = `${name}: quick view open. Tab to its link; Escape closes.`;
  };
  const focus = (i: number) => {
    for (const [j, k] of keys.entries()) k.tabIndex = j === i ? 0 : -1;
    keys[i]?.focus();
  };
  // Arrows: up and down in a family's column; left and right to the next column that has a brick,
  // at the same row or the nearest one.
  const move = (i: number, dc: number, dr: number) => {
    const [r, c] = at[i] ?? [0, 0];
    if (dr) {
      const j = at.findIndex(([r2, c2]) => c2 === c && r2 === r + dr);
      return j < 0 ? i : j;
    }
    for (let c2 = c + dc; c2 >= 1 && c2 <= cols; c2 += dc) {
      let best = -1;
      for (const [j, [r2, c3]] of at.entries()) if (c3 === c2 && (best < 0 || Math.abs(r2 - r) < Math.abs((at[best]?.[0] ?? 0) - r))) best = j;
      if (best >= 0) return best;
    }
    return i;
  };
  for (const [i, k] of keys.entries()) {
    k.tabIndex = i === 0 ? 0 : -1;
    k.addEventListener("click", () => {
      for (const [j, x] of keys.entries()) x.tabIndex = j === i ? 0 : -1;
      show(k);
    });
    k.addEventListener("keydown", (e) => {
      const d = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[e.key];
      const j = d ? move(i, d[0], d[1]) : e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      focus(j);
    });
  }
  card.querySelector(".pt-x")!.addEventListener("click", () => close(true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close(root.contains(document.activeElement));
    }
  });
}
