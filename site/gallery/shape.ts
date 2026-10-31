// The layout key on a piece that lays itself out per stage aspect (site/gallery/aspect.ts). Auto,
// its frame follows the screen in CSS: wide, or its phone shape (`--phone`, square or portrait) on a
// phone held upright. A tap pins the other shape on the figure (data-shape="wide|phone"); the piece
// sees its stage resize and re-lays itself out, the same path as a rotate. The choice is remembered
// per piece (localStorage, when the browser allows it). Gallery chrome, never the scene's: Recall
// gives back the scene's page; the key and its choice stay.
const KEY = "fizlet:shape:", PHONE = "(max-width: 600px) and (orientation: portrait)";

export function shapes(root: ParentNode = document) {
  const mq = matchMedia(PHONE);
  for (const b of root.querySelectorAll<HTMLButtonElement>("button[data-shape-for]")) {
    const id = b.dataset.shapeFor!, fig = b.parentElement!.querySelector<HTMLElement>("figure")!, name = b.dataset.name!;
    const now = () => fig.dataset.shape ?? (mq.matches ? "phone" : "wide");
    const show = () => {
      const other = now() === "phone" ? "wide" : name;
      b.textContent = other === "wide" ? "TO WIDE" : name === "square" ? "TO SQUARE" : "TO TALL";
      b.ariaLabel = `Layout: switch this piece to ${other}`;
    };
    try {
      const v = localStorage.getItem(KEY + id);
      if (v === "wide" || v === "phone") fig.dataset.shape = v;
    } catch {}
    b.addEventListener("click", () => {
      const v = (fig.dataset.shape = now() === "phone" ? "wide" : "phone");
      try {
        localStorage.setItem(KEY + id, v);
      } catch {}
      show();
    });
    mq.addEventListener("change", show);
    show();
    b.hidden = false;
  }
}
