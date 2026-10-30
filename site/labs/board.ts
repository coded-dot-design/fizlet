// Lab: "One host. Two worlds." A miniature page whose real elements are the board: their boxes are
// read once (and on resize), cached, and the bugs bounce off that cache, never off live layout.
// X-RAY draws what the game reads; the button is an enemy factory (a pool of six bugs, then CAP);
// tap a bug to squash it.
import { $, kf, key, labEngine, reduced, textOf, type Lab, type LabOptions } from "./lab";

export const BUG_CAP = 6;
const BUG = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 1h1v2h4V1h1v2h1v2h1v8h-1v1H4v-1H3V5h1V3h1zM6 6v1h1V6zm3 0v1h1V6zM1 6h2v1H1zm12 0h2v1h-2zM1 9h2v1H1zm12 0h2v1h-2zM1 12h2v1H1zm12 0h2v1h-2z"/></svg>';
const NAMES: Record<string, string> = { H4: "<h4> COVER", P: "<p> TERRAIN", BUTTON: "<button> FACTORY" };

export const boardFigure = (poster = false) =>
  `<figure class="lab-stage board fzl" data-fzl="board" aria-label="A miniature web page. X-ray shows the rectangles a game reads; bugs bounce off them; the button spawns more bugs.">` +
  `<div class="mini-page" data-board><div class="mini-chrome"><i></i><i></i><i></i><span>your.page</span></div>` +
  `<div class="mini-title" data-solid>Hello, world.</div><p data-solid>Paragraphs become terrain.</p><p data-solid class="short">Text is cover.</p>` +
  key("data-solid data-factory", "BUTTON_01", poster, "mini-button") +
  `<div class="xray" aria-hidden="true"></div><div class="bugs" aria-hidden="true"></div></div>` +
  `<div class="lab-keys">${key('data-xray aria-pressed="false"', "X-RAY", poster)}<span class="lab-readout" data-bug-count>BUGS 1 / ${BUG_CAP}</span></div></figure>`;

const S = 20, POP = 0.26, SQUASH = 0.22, NOPE = 0.24;
const POP_KF = [0, 1.3, 1], SQ_SCALE = [1, 1.6, 0.2], SQ_OP = [1, 0.6, 0], NOPE_KF = [0, -3, 3, 0];
interface Bug { k: number; x: number; y: number; vx: number; vy: number; pop: number }

export function board(figure: HTMLElement, o: LabOptions = {}): Lab {
  const reduce = reduced();
  const page = $(figure, "[data-board]"), xray = $(page, ".xray"), nest = $(page, ".bugs"), chrome = $(page, ".mini-chrome");
  const factory = $(page, "[data-factory]"), toggle = $(figure, "[data-xray]"), count = textOf($(figure, "[data-bug-count]"));
  const solids = [...page.querySelectorAll<HTMLElement>("[data-solid]")], NS = solids.length;
  const lab = labEngine(figure, 3, o, () => {});
  const { engine } = lab, L = engine.ledger, rnd = engine.random;
  const r = (a: number, b: number) => a + rnd() * (b - a);
  // Nodes made once: one X-ray box per solid, one element per pooled bug.
  const boxes = solids.map((el) => {
    const b = L.add(document.createElement("b")), label = document.createElement("span");
    label.textContent = NAMES[el.tagName] ?? el.tagName;
    b.append(label);
    xray.append(b);
    return b;
  });
  const els: HTMLElement[] = [];
  let made = 0;
  const bugs = engine.pool<Bug>("bugs", BUG_CAP, () => ({ k: made++, x: 0, y: 0, vx: 0, vy: 0, pop: 0 }));
  for (let k = 0; k < BUG_CAP; k++) {
    const el = L.add(document.createElement("i"));
    el.innerHTML = BUG;
    el.style.opacity = "0";
    nest.append(el);
    els.push(el);
  }
  // Cached geometry (read phase only): page w, h, chrome height; then x, y, w, h per solid.
  const geo = new Float64Array(3 + NS * 4);
  // Squash timers per bug element (a squashed bug fades after it has left the pool), shown flags.
  const squash = new Float64Array(BUG_CAP), shown = new Uint8Array(BUG_CAP);
  // measure needed, x-ray on, factory "no" s left, queued: random spawn, factory spawns, squash x, y
  const s = new Float64Array([1, 0, 0, 1, 0, -1, -1, -1]);
  const ro = new ResizeObserver(() => ((s[0] = 1), engine.wake()));
  ro.observe(page);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const on = { signal: engine.signal };
  factory.addEventListener("click", () => ((s[4]! += 1), (s[0] = 1), lab.input()), on);
  toggle.addEventListener("click", () => ((s[1] = s[1] ? 0 : 1), (s[0] = 1), lab.input()), on);
  // Easter egg: tap a bug to squash it (one layout read per tap, outside any frame).
  page.addEventListener("pointerdown", (ev) => {
    if (ev.target === factory) return;
    const p = page.getBoundingClientRect();
    s[5] = ev.clientX - p.left - page.clientLeft;
    s[6] = ev.clientY - p.top - page.clientTop;
    lab.input();
  }, on);

  const hits = (x: number, y: number) => {
    if (x < 0 || y < geo[2]! || x + S > geo[0]! || y + S > geo[1]!) return true;
    for (let i = 0; i < NS; i++) {
      const o = 3 + i * 4;
      if (x < geo[o]! + geo[o + 2]! && x + S > geo[o]! && y < geo[o + 1]! + geo[o + 3]! && y + S > geo[o + 1]!) return true;
    }
    return false;
  };
  const spawn = (fromButton: boolean) => {
    const b = bugs.acquire();
    if (!b) return void (s[2] = NOPE);
    const W = geo[0]!, H = geo[1]!, top = geo[2]!, f = 3 + (NS - 1) * 4;
    let x = fromButton ? geo[f]! + geo[f + 2]! + 6 : r(10, W - S - 10), y = fromButton ? geo[f + 1]! + geo[f + 3]! / 2 - S / 2 : r(top + 6, H - S - 6);
    for (let n = 0; n < 40 && hits(x, y); n++) (x = r(6, W - S - 6)), (y = r(top + 6, H - S - 6));
    const a = fromButton ? r(-1.2, -0.3) : r(0, Math.PI * 2), v = r(46, 70);
    (b.x = x), (b.y = y), (b.vx = Math.cos(a) * v), (b.vy = Math.sin(a) * v), (b.pop = reduce ? 0 : POP);
    squash[b.k] = 0;
  };

  engine.add({
    read() {
      if (!s[0]) return;
      s[0] = 0;
      // Read the geometry once (and on resize), like the board adapter: the loop only uses the cache.
      const p = page.getBoundingClientRect();
      (geo[0] = page.clientWidth), (geo[1] = page.clientHeight), (geo[2] = chrome.offsetHeight);
      for (let i = 0; i < NS; i++) {
        const b = solids[i]!.getBoundingClientRect(), o = 3 + i * 4;
        (geo[o] = b.left - p.left - page.clientLeft), (geo[o + 1] = b.top - p.top - page.clientTop), (geo[o + 2] = b.width), (geo[o + 3] = b.height);
      }
    },
    step(e, dt) {
      if (s[3]) (s[3] = 0), spawn(false);
      for (; s[4]! > 0; s[4]!--) spawn(true);
      if (s[5]! >= 0) {
        const items = bugs.items;
        for (let i = items.length; i--; ) {
          const b = items[i]!;
          if (Math.hypot(b.x + S / 2 - s[5]!, b.y + S / 2 - s[6]!) < 22) {
            squash[b.k] = SQUASH;
            bugs.releaseAt(i);
            break;
          }
        }
        s[5] = s[6] = -1;
      }
      if (s[2]! > 0) (s[2]! -= dt), e.busy();
      for (let k = 0; k < BUG_CAP; k++) if (squash[k]! > 0) (squash[k]! -= dt), e.busy();
      const walk = !reduce && lab.attract(-1);
      for (const b of bugs.items) {
        if (b.pop > 0) (b.pop -= dt), e.busy();
        if (!walk) continue;
        e.busy();
        const W = geo[0]!, H = geo[1]!, top = geo[2]!;
        // Move one axis at a time against the cached rectangles: bounce on whichever axis hits.
        const nx = b.x + b.vx * dt;
        if (hits(nx, b.y)) b.vx = -b.vx;
        else b.x = nx;
        const ny = b.y + b.vy * dt;
        if (hits(b.x, ny)) b.vy = -b.vy;
        else b.y = ny;
        if (hits(b.x, b.y)) (b.x = Math.min(Math.max(b.x, 2), W - S - 2)), (b.y = Math.min(Math.max(b.y, top + 2), H - S - 2));
        if (rnd() < dt * 0.4) {
          const a = Math.atan2(b.vy, b.vx) + r(-0.8, 0.8), v = Math.hypot(b.vx, b.vy);
          (b.vx = Math.cos(a) * v), (b.vy = Math.sin(a) * v);
        }
      }
    },
    render() {
      shown.fill(0);
      for (const b of bugs.items) {
        const el = els[b.k]!, a = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        shown[b.k] = 1;
        L.style(el, "transform", `translate(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px) rotate(${Math.round((a * 180) / Math.PI / 45) * 45}deg)`);
        L.style(el, "opacity", "1");
        L.style(el, "scale", b.pop > 0 ? String(kf(POP_KF, 1 - b.pop / POP, 3)) : "1");
      }
      for (let k = 0; k < BUG_CAP; k++) {
        if (shown[k]) continue;
        const q = squash[k]! > 0 ? 1 - squash[k]! / SQUASH : 1;
        L.style(els[k]!, "scale", squash[k]! > 0 ? String(kf(SQ_SCALE, q, 3)) : "1");
        L.style(els[k]!, "opacity", squash[k]! > 0 ? String(kf(SQ_OP, q, 3)) : "0");
      }
      for (let i = 0; i < NS; i++) {
        const o = 3 + i * 4, b = boxes[i]!;
        L.style(b, "left", `${geo[o]! - 4}px`);
        L.style(b, "top", `${geo[o + 1]! - 4}px`);
        L.style(b, "width", `${geo[o + 2]! + 8}px`);
        L.style(b, "height", `${geo[o + 3]! + 8}px`);
      }
      L.attr(toggle, "aria-pressed", s[1] ? "true" : "false");
      L.attr(figure, "data-xray-on", s[1] ? "" : null);
      L.style(factory, "translate", s[2]! > 0 ? `${kf(NOPE_KF, 1 - s[2]! / NOPE)}px 0` : "0px 0px");
      const n = bugs.size;
      L.text(count, `BUGS ${n} / ${BUG_CAP}${n === BUG_CAP ? " · CAP" : ""}`);
    },
  });
  return { engine, entities: () => bugs.size, destroy: () => engine.destroy() };
}
