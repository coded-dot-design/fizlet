// The bricks index's live diagram: every brick and what it imports (read from the source at build
// time, site/brick-graph.mjs), laid out on the kernel clock by fizlet/layout and drawn by
// fizlet/view-canvas. Drag a brick and the rest flows round it; hover one to see its links. Once
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
  const kernel = g.nodes.findIndex((n) => n.name === "fizlet");
  const label = g.nodes.map((n) => (n.name === "fizlet" ? "kernel" : n.name.slice(7)));
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
  // hover node (-1 none), dragged node, scale (world → CSS px), last alpha seen.
  const s = new Float64Array([-1, -1, 1, -1]);
  const HOVER = 0, DRAG = 1, SCALE = 2, ALPHA = 3;
  const near = (a: number, b: number) => a === b || g.links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const v = viewCanvas(e, host.querySelector<HTMLElement>("[data-graph-stage]")!, {
    label: `The Fizlet bricks: ${N} modules and ${g.links.length} links, each from a brick to a brick it imports or needs. Drag a brick to move it.`,
    draw(ctx) {
      const k = (s[SCALE] = Math.min(v.width / WW, v.height / WH)), ox = (v.width - WW * k) / 2, oy = (v.height - WH * k) / 2, h = s[HOVER]!;
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
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      for (let i = 0; i < N; i++) {
        const n = g.nodes[i]!, r = i === kernel ? 11 : 6, c = tone[n.tone]!;
        ctx.globalAlpha = h >= 0 && !near(i, h) ? 0.3 : 1;
        ctx.beginPath();
        ctx.arc(lay.x[i]!, lay.y[i]!, r, 0, Math.PI * 2);
        if (n.planned) (ctx.strokeStyle = c), (ctx.lineWidth = 1.5), ctx.stroke();
        else (ctx.fillStyle = c), ctx.fill();
        ctx.fillStyle = i === h ? ink : muted;
        ctx.fillText(label[i]!, lay.x[i]!, lay.y[i]! - r - 5);
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
      if (!lay.resting || lay.alpha !== s[ALPHA]) v.dirty();
      s[ALPHA] = lay.alpha;
    },
  });

  // Input (outside the loop: reading the box here is fine). Screen → world through the fit.
  const at = new Float64Array(2);
  const world = (ev: PointerEvent) => {
    const r = host.querySelector("canvas")!.getBoundingClientRect(), k = s[SCALE]!;
    at[0] = (ev.clientX - r.left - (r.width - WW * k) / 2) / k;
    at[1] = (ev.clientY - r.top - (r.height - WH * k) / 2) / k;
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
  return { engine: e, layout: lay, view: v };
}

// The page's own figure; tests/brick-graph.mjs blocks this file and mounts one by hand (for Recall).
for (const host of document.querySelectorAll<HTMLElement>("[data-brick-graph]")) mount(host);
