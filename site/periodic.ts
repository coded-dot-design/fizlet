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

  // Wider than its box (narrow screens): say so. The board gets data-scrolls (the SWIPE label and an
  // edge fade) and data-end once scrolled to the end; measured on resize and scroll, no frame loop.
  const board = root.querySelector<HTMLElement>(".pt-board")!;
  const scroller = root.querySelector<HTMLElement>(".pt-scroll")!;
  // Copy on the left (1000 px and up, site/periodic.mjs): when the 3D block runs past the content's
  // right edge it hangs off the screen (data-peek); sliding (data-slid) moves the table left by
  // --shift, so the 3D block ends at the content's edge and the 2D block slides under the copy. All
  // measured on resize; the slide is one CSS transition, no frame loop.
  const table = root.querySelector<HTMLElement>(".pt-table")!;
  const grid = root.querySelector<HTMLElement>(".pt-grid")!;
  const side = matchMedia("(min-width:1000px)");
  const split = parseInt(getComputedStyle(root.querySelector<HTMLElement>(".pt-split")!).gridColumnStart, 10) || Infinity;
  let peek = false, slid = false;
  const slide = (on: boolean) => {
    on &&= peek;
    if (on === slid) return;
    slid = on;
    board.toggleAttribute("data-slid", on);
    close(); // its place moves with the table: a press opens it again where it belongs
  };
  const fit = () => {
    const wide = side.matches;
    const box = wide ? 0 : scroller.scrollWidth - scroller.clientWidth;
    board.toggleAttribute("data-scrolls", box > 1);
    board.toggleAttribute("data-end", box <= 1 || scroller.scrollLeft >= box - 2);
    // The table's right edge as laid out (its offset, so a slide in progress does not count).
    const b = board.getBoundingClientRect(), g = grid.getBoundingClientRect();
    const right = b.left + parseFloat(getComputedStyle(board).paddingLeft) + table.offsetWidth;
    const edge = g.right - parseFloat(getComputedStyle(grid).paddingRight);
    // Slid, the table moves by whole columns, so the copy's edge falls between two of them.
    const over = wide ? right - edge : 0, unit = (keys[0]?.offsetWidth ?? 1) + (parseFloat(getComputedStyle(table).columnGap) || 0);
    peek = over > 1;
    const shift = peek ? Math.ceil(over / unit) * unit : 0;
    board.toggleAttribute("data-peek", peek);
    board.style.setProperty("--shift", `${shift}px`);
    if (!peek) slide(false);
  };
  scroller.addEventListener("scroll", fit, { passive: true });
  new ResizeObserver(fit).observe(board);
  for (const go of root.querySelectorAll<HTMLElement>("[data-go]")) {
    go.addEventListener("click", () => {
      const on = go.dataset.go === "3d";
      slide(on);
      // The keys: focus follows to the other one, so Enter, Enter goes there and back.
      if (go.localName === "button") root.querySelector<HTMLElement>(`.pt-go[data-go="${on ? "2d" : "3d"}"]`)?.focus();
    });
  }
  // Swipe on touch: left shows the 3D block, right brings the 2D block back.
  let x0 = 0, y0 = 0;
  board.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { x0 = e.clientX; y0 = e.clientY; } }, { passive: true });
  board.addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse" || !peek) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) slide(dx < 0);
  }, { passive: true });

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
  // A key in the 3D block slides it in; a 2D key under the copy (or pressed while slid) slides back.
  const is3d = (i: number) => (at[i]?.[1] ?? 0) > split;
  const reveal = (i: number, press = false) => {
    if (!peek) return;
    const k = keys[i]!;
    if (is3d(i)) slide(true);
    else if (slid && (press || k.offsetLeft - parseFloat(board.style.getPropertyValue("--shift")) < 0)) slide(false);
  };
  for (const [i, k] of keys.entries()) {
    k.tabIndex = i === 0 ? 0 : -1;
    k.addEventListener("focus", () => reveal(i));
    k.addEventListener("click", () => {
      for (const [j, x] of keys.entries()) x.tabIndex = j === i ? 0 : -1;
      reveal(i, true);
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
    if (e.key !== "Escape") return;
    if (open) {
      e.preventDefault();
      close(root.contains(document.activeElement));
    } else if (slid) {
      e.preventDefault();
      const k = document.activeElement;
      slide(false);
      // Focus on a 3D key would slide it straight back in: hand it to the way in.
      if (k instanceof HTMLButtonElement && k.matches(".el-key") && is3d(keys.indexOf(k))) root.querySelector<HTMLElement>('.pt-go[data-go="3d"]')?.focus();
    }
  });
}
