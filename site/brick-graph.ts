// The bricks index's live diagram: every brick and what it imports (read from the source at build
// time, site/brick-graph.mjs), laid out on the kernel clock by @fzlt/core/layout and drawn by
// @fzlt/core/view-canvas. Drag a brick and the rest flows round it; hover one to see its links. Once
// the layout rests the engine settles: the page asks for 0 frames until the next touch. Off screen
// it pauses; with reduced motion the layout lands at once.
import { createEngine } from "../src/index";
import { layout } from "../src/layout";
import { viewCanvas } from "../src/view-canvas";

/** World size: the graph is laid out in an 800 × 450 box, scaled to the canvas. */
const WW = 800, WH = 450, PAD = 28;
interface Graph { nodes: { id: string; name: string; status: string; tone: string; planned?: boolean }[]; links: [number, number, number][] }

export function mount(host: HTMLElement) {
  const g = JSON.parse(host.dataset.graph!) as Graph, N = g.nodes.length;
  const e = createEngine({ root: host, settle: 0.5 });
  const lay = layout(e, { cap: N, links: g.links.length, charge: 260, distance: 58, gravity: 0.06, cx: WW / 2, cy: WH / 2 });
  for (let i = 0; i < N; i++) lay.add();
  for (const [a, b] of g.links) lay.link(a, b, 58);
  const kernel = g.nodes.findIndex((n) => n.name === "@fzlt/core");
  const label = g.nodes.map((n) => (n.name === "@fzlt/core" ? "kernel" : n.name.slice("@fzlt/core/".length)));
  // Theme colours, read once and again when the theme changes (never in a frame).
  let tone: Record<string, string> = {}, ink = "", muted = "", line = "";
  const colors = () => {
    const cs = getComputedStyle(host), v = (k: string) => cs.getPropertyValue(k).trim();
    tone = Object.fromEntries(g.nodes.map((n) => [n.tone, v(`--k-${n.tone}`) || v("--ink")]));
    ink = v("--ink") || "#e9e6ff";
    muted = v("--muted") || "#8d88b0";
    line = v("--line") || "rgba(233,230,255,.16)";
  };
  colors();
  // hover node (-1 none), dragged node, scale (world → CSS px), last alpha seen, the fit's offset
  // (screen = world × scale + offset), and the world box the fit shows (left, top, right, bottom).
  const s = new Float64Array([-1, -1, 1, -1, 0, 0, 0, 0, WW, WH]);
  const HOVER = 0, DRAG = 1, SCALE = 2, ALPHA = 3, TX = 4, TY = 5, B0 = 6, B1 = 7, B2 = 8, B3 = 9;
  const rad = (i: number) => (i === kernel ? 11 : 6);
  const near = (a: number, b: number) => a === b || g.links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  // Labels: measured once here (never in a step), then placed on one of four sides of their brick
  // (above, below, right, left; nudged up or down a little) so no two overlap. The placing is a
  // one-shot pass when the layout rests, on typed arrays: no allocation, same input, same output.
  const FONT = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace", MARGIN = 4;
  // Every helper takes indices and small integers and writes into the typed arrays: a double handed
  // to a call V8 doesn't inline is boxed.
  const lw = new Float64Array(N), side = new Uint8Array(N), dy = new Int8Array(N);
  const lx = new Float64Array(N), ly = new Float64Array(N); // where the text is drawn (its baseline)
  const bx0 = new Float64Array(N), by0 = new Float64Array(N), bx1 = new Float64Array(N), by1 = new Float64Array(N);
  const DY = new Int8Array([0, -7, 7, -14, 14]), ALIGN = ["center", "center", "left", "right"] as const;
  const f = new Float64Array([9, 3, 0]), ASC = 0, DSC = 1, COST = 2; // the font's ascent and descent; a place's cost
  {
    const c = document.createElement("canvas").getContext("2d");
    if (c) {
      c.font = FONT;
      for (let i = 0; i < N; i++) lw[i] = c.measureText(label[i]!).width;
      const m = c.measureText("Hgjp|");
      if (m.actualBoundingBoxAscent > 0) (f[ASC] = m.actualBoundingBoxAscent), (f[DSC] = m.actualBoundingBoxDescent);
    } else for (let i = 0; i < N; i++) lw[i] = label[i]!.length * 6.6;
  }
  /** Put label i on side `sd` (0 above, 1 below, 2 right, 3 left) nudged `d` px down: its baseline and box. */
  const put = (i: number, sd: number, d: number) => {
    const x = lay.x[i]!, y = lay.y[i]!, r = rad(i), w = lw[i]!, A = f[ASC]!, D = f[DSC]!;
    const tx = sd === 2 ? x + r + 4 : sd === 3 ? x - r - 4 : x;
    const ty = (sd === 0 ? y - r - 5 : sd === 1 ? y + r + 4 + A : y + (A - D) / 2) + d;
    lx[i] = tx;
    ly[i] = ty;
    bx0[i] = sd === 2 ? tx : sd === 3 ? tx - w : tx - w / 2;
    bx1[i] = bx0[i]! + w;
    by0[i] = ty - A;
    by1[i] = ty + D;
  };
  /** What label i costs where it is, into f[COST]: its overlap with other labels and with any brick's
   *  dot (its own too), and a little for leaving the world box (the fit shows it all anyway, but
   *  inside keeps the graph large). */
  const cost = (i: number) => {
    const x0 = bx0[i]!, y0 = by0[i]!, x1 = bx1[i]!, y1 = by1[i]!;
    let c = 0;
    for (let j = 0; j < N; j++) {
      if (j !== i) {
        const w = Math.min(x1, bx1[j]!) - Math.max(x0, bx0[j]!), h = Math.min(y1, by1[j]!) - Math.max(y0, by0[j]!);
        if (w > 0 && h > 0) c += w * h;
      }
      const r = rad(j) + 2, x = lay.x[j]!, y = lay.y[j]!;
      const w = Math.min(x1, x + r) - Math.max(x0, x - r), h = Math.min(y1, y + r) - Math.max(y0, y - r);
      if (w > 0 && h > 0) c += w * h;
    }
    const iw = Math.min(x1, WW) - Math.max(x0, 0), ih = Math.min(y1, WH) - Math.max(y0, 0);
    f[COST] = c + 0.25 * ((x1 - x0) * (y1 - y0) - (iw > 0 && ih > 0 ? iw * ih : 0));
  };
  /** Every label at its chosen place, and the box the fit shows: the world box, grown round any
   *  dot or label that sticks out of it (plus a margin), so nothing is clipped at any width. */
  const boxes = () => {
    s[B0] = 0, s[B1] = 0, s[B2] = WW, s[B3] = WH;
    for (let i = 0; i < N; i++) {
      put(i, side[i]!, dy[i]!);
      const r = rad(i) + MARGIN, x = lay.x[i]!, y = lay.y[i]!;
      s[B0] = Math.min(s[B0]!, bx0[i]! - MARGIN, x - r);
      s[B1] = Math.min(s[B1]!, by0[i]! - MARGIN, y - r);
      s[B2] = Math.max(s[B2]!, bx1[i]! + MARGIN, x + r);
      s[B3] = Math.max(s[B3]!, by1[i]! + MARGIN, y + r);
    }
  };
  /** The one-shot pass: each label in turn moves to its cheapest place (an earlier place in the
   *  list wins a tie, and a label stays put unless a place is strictly cheaper), until none moves. */
  const place = () => {
    for (let i = 0; i < N; i++) (side[i] = 0), (dy[i] = 0), put(i, 0, 0);
    for (let round = 0, moved = 1; moved && round < 8; round++) {
      moved = 0;
      for (let i = 0; i < N; i++) {
        cost(i);
        let best = f[COST]!, bs = side[i]!, bd = dy[i]!;
        for (let sd = 0; sd < 4; sd++) for (let k = 0; k < DY.length; k++) {
          put(i, sd, DY[k]!);
          cost(i);
          if (f[COST]! < best - 1e-6) (best = f[COST]!), (bs = sd), (bd = DY[k]!);
        }
        if (bs !== side[i] || bd !== dy[i]) moved = 1;
        (side[i] = bs), (dy[i] = bd), put(i, bs, bd);
      }
    }
    boxes();
  };
  boxes();

  const v = viewCanvas(e, host.querySelector<HTMLElement>("[data-graph-stage]")!, {
    label: `The Fizlet bricks: ${N} modules and ${g.links.length} links, each from a brick to a brick it imports or needs. Drag a brick to move it.`,
    draw(ctx) {
      // Fit to the canvas the box round the world, the dots and their labels (see boxes()).
      const bw = s[B2]! - s[B0]!, bh = s[B3]! - s[B1]!, k = (s[SCALE] = Math.min(v.width / bw, v.height / bh)), h = s[HOVER]!;
      const ox = (s[TX] = (v.width - bw * k) / 2 - s[B0]! * k), oy = (s[TY] = (v.height - bh * k) / 2 - s[B1]! * k);
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      ctx.lineWidth = 1.2;
      for (const [a, b, kind] of g.links) {
        const lit = h >= 0 && (a === h || b === h);
        ctx.globalAlpha = h >= 0 && !lit ? 0.25 : 1;
        ctx.strokeStyle = lit ? ink : kind === 0 ? muted : line;
        ctx.setLineDash(kind === 0 ? [] : kind === 1 ? [2, 4] : [6, 5]);
        ctx.beginPath();
        ctx.moveTo(lay.x[a]!, lay.y[a]!);
        ctx.lineTo(lay.x[b]!, lay.y[b]!);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.font = FONT;
      for (let i = 0; i < N; i++) {
        const n = g.nodes[i]!, r = rad(i), c = tone[n.tone]!;
        ctx.globalAlpha = h >= 0 && !near(i, h) ? 0.3 : 1;
        ctx.beginPath();
        ctx.arc(lay.x[i]!, lay.y[i]!, r, 0, Math.PI * 2);
        if (n.planned) (ctx.strokeStyle = c), (ctx.lineWidth = 1.5), ctx.stroke();
        else (ctx.fillStyle = c), ctx.fill();
        ctx.fillStyle = i === h ? ink : muted;
        ctx.textAlign = ALIGN[side[i]!]!;
        ctx.fillText(label[i]!, lx[i]!, ly[i]!);
      }
      ctx.globalAlpha = 1;
    },
  });
  // Keep the graph in its box, and redraw while it moves (and once more on the step it rests).
  e.add({
    step() {
      for (let i = 0; i < N; i++) {
        lay.x[i] = Math.min(WW - PAD, Math.max(PAD, lay.x[i]!));
        lay.y[i] = Math.min(WH - PAD, Math.max(PAD, lay.y[i]!));
      }
      // Moving: the labels follow on their sides. Just rested: place them once, then refit.
      if (!lay.resting) boxes();
      else if (lay.alpha !== s[ALPHA]) place();
      if (!lay.resting || lay.alpha !== s[ALPHA]) v.dirty();
      s[ALPHA] = lay.alpha;
    },
  });

  // Input (outside the loop: reading the box here is fine). Screen → world through the fit.
  const at = new Float64Array(2);
  const world = (ev: PointerEvent) => {
    const r = host.querySelector("canvas")!.getBoundingClientRect(), k = s[SCALE]!;
    at[0] = (ev.clientX - r.left - s[TX]!) / k;
    at[1] = (ev.clientY - r.top - s[TY]!) / k;
    return lay.nearest(at[0], at[1], 18 / Math.min(1, k));
  };
  const on = { signal: e.signal };
  host.addEventListener("pointerdown", (ev) => {
    const i = world(ev);
    if (i < 0) return;
    s[DRAG] = s[HOVER] = i;
    host.setPointerCapture(ev.pointerId);
    lay.pin(i, at[0]!, at[1]!);
    ev.preventDefault();
  }, on);
  host.addEventListener("pointermove", (ev) => {
    const i = world(ev);
    if (s[DRAG]! >= 0) return lay.pin(s[DRAG]!, Math.min(WW - PAD, Math.max(PAD, at[0]!)), Math.min(WH - PAD, Math.max(PAD, at[1]!)));
    e.ledger.style(host, "cursor", i >= 0 ? "grab" : ""); // through the ledger: Recall gives it back
    if (i !== s[HOVER]) (s[HOVER] = i), v.dirty();
  }, on);
  const drop = () => {
    if (s[DRAG]! >= 0) lay.free(s[DRAG]!);
    s[DRAG] = -1;
  };
  host.addEventListener("pointerup", drop, on);
  host.addEventListener("pointercancel", drop, on);
  host.addEventListener("pointerleave", () => s[DRAG]! < 0 && s[HOVER]! >= 0 && ((s[HOVER] = -1), v.dirty()), on);
  const mo = new MutationObserver(() => (colors(), v.dirty()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  e.signal.addEventListener("abort", () => mo.disconnect(), { once: true });
  e.start();
  e.ledger.attr(host, "data-ready", "1"); // a marker for tests; Recall takes it back too
  /** For tests: each label's box and each dot's box on the canvas, [left, top, right, bottom] in CSS px. */
  const onCanvas = () => {
    const k = s[SCALE]!, tx = s[TX]!, ty = s[TY]!, sc = (a: number, b: number, c: number, d: number) => [a * k + tx, b * k + ty, c * k + tx, d * k + ty];
    return {
      width: v.width, height: v.height,
      labels: label.map((name, i) => ({ name, box: sc(bx0[i]!, by0[i]!, bx1[i]!, by1[i]!) })),
      dots: label.map((name, i) => ({ name, box: sc(lay.x[i]! - rad(i), lay.y[i]! - rad(i), lay.x[i]! + rad(i), lay.y[i]! + rad(i)) })),
    };
  };
  return { engine: e, layout: lay, view: v, onCanvas };
}

// The page's own figure; tests/brick-graph.mjs blocks this file and mounts one by hand (for Recall).
for (const host of document.querySelectorAll<HTMLElement>("[data-brick-graph]")) mount(host);
