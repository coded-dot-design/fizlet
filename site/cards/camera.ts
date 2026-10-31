// camera card: the fine print. The card holds a tiny page of real DOM: a headline, a row of bricks,
// and lines of type too small to read. Tap anywhere and the camera dives in four times on that spot
// (one transform, written through the ledger); tap again and it flies back. Every brick hides a
// line you can only read up close. With reduced motion the moves jump; Recall gives the page back.
import type { SlotMount } from "../../src/slot";
import { camera, zoomAt } from "../../src/camera";
import { mountCard } from "./frame";

const LINES = [
  "the camera is one transform on one element",
  "written through the ledger: Recall puts it back",
  "it eases, then the engine sleeps",
  "zoom about a point: that point stays put",
];
const CSS = `
.bc-cam{position:absolute;inset:0;font:700 9px/1.3 ui-monospace,Menlo,monospace;color:var(--muted);transform-origin:0 0}
.bc-cam h4{position:absolute;left:6%;top:16%;margin:0;font:800 18px/1 ui-monospace,Menlo,monospace;color:var(--ink);letter-spacing:.04em}
.bc-cam i{position:absolute;display:grid;place-items:center;width:15%;height:12%;background:var(--tone);border:2px solid #07060f;border-radius:3px;box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 #07060f;font:800 2.6px/1.15 ui-monospace,Menlo,monospace;color:#07060f;font-style:normal;text-align:center;padding:2px;box-sizing:border-box}
.bc-cam p{position:absolute;left:6%;margin:0;font-size:3px;letter-spacing:.02em;white-space:nowrap}
.bc-cam .lbl{top:auto;bottom:6%;font-size:9px;color:var(--ink)}`;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  card.c.style.opacity = "0"; // the canvas only takes the taps; the page here is real DOM
  const world = document.createElement("div");
  world.className = "bc-cam";
  world.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = CSS;
  world.append(style);
  const h = document.createElement("h4");
  h.textContent = "Tap anywhere.";
  world.append(h);
  for (let i = 0; i < 4; i++) {
    const b = document.createElement("i");
    b.style.left = `${8 + i * 22}%`;
    b.style.top = "38%";
    b.textContent = LINES[i]!;
    world.append(b);
  }
  for (let i = 0; i < 6; i++) {
    const p = document.createElement("p");
    p.style.top = `${60 + i * 3.4}%`;
    p.textContent = i === 5 ? `the fine print: fzlt/camera is ${card.bytes.toLocaleString("en-US")} bytes gzip, measured on this build. You found it.` : "Fizlet moves the page itself: no canvas copy, no clone, the real elements, still selectable and still the page.";
    world.append(p);
  }
  const lbl = document.createElement("p");
  lbl.className = "lbl";
  lbl.textContent = `${card.tag} ${card.kb}`;
  world.append(lbl);
  card.stage.insertBefore(world, card.c);
  const cam = camera(card.e, world, { ease: 6, max: 4 });
  const n = new Int32Array(2); // dives, zoomed in
  card.e.add({ render() { card.dirty[0] = 0; } });
  return {
    tap(x, y) {
      // Drawing units → the stage's CSS px (world coordinates at zoom 1).
      const k = card.px[1]!;
      if (n[1]) cam.home(), (n[1] = 0);
      else zoomAt(cam, (x * k), (y * k), 4), (n[1] = 1), (n[0] = n[0]! + 1);
    },
    read: () => (n[1] ? "ZOOM 4× · TAP TO FLY BACK" : n[0] ? `${n[0]} DIVES · ZOOM 1×` : "ZOOM 1× · ONE TRANSFORM"),
  };
});
export default mount;
