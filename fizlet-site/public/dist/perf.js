// src/perf.ts
var BARS = 120;
var WINDOW = 500;
var FrameRing = class {
  cap;
  ms;
  /** The next slot written. */
  head = 0;
  size = 0;
  constructor(cap) {
    this.cap = cap;
    this.ms = new Float32Array(cap);
  }
  push(ms) {
    this.ms[this.head] = ms;
    this.head = (this.head + 1) % this.cap;
    if (this.size < this.cap) this.size++;
  }
  /** Slot of the k-th oldest frame held. */
  slot(k) {
    return (this.head - this.size + k + this.cap) % this.cap;
  }
};
var fps = (frames, ms) => ms > 0 ? frames * 1e3 / ms : 0;
var missed = (ms, budget) => ms > budget * 1.5 ? Math.round(ms / budget) - 1 : 0;
var cache = [[], []];
var out = new Float64Array(6);
var fmt = (i) => {
  const t = +(i === 1 || i === 3), k = Math.round(t ? out[i] * 10 : out[i]);
  return k >= 0 && k < 1024 ? cache[t][k] ??= t ? (k / 10 | 0) + "." + k % 10 : "" + k : "" + Math.round(out[i]);
};
var LABELS = ["FPS", "MS", "DROP", "WORK", "LIVE", "MB"];
var VARS = ["--k-go", "--hurt", "--critical", "--line"];
var TONES = ["#39ffb0", "#ffc21a", "#f0506e", "#3b3170"];
function perf(engine, o = {}) {
  const L = engine.ledger, clock = engine.timing, budget = o.budget ?? 1e3 / 60, ring = new FrameRing(BARS), s = new Float64Array(5);
  const want = o.host ?? engine.root ?? document.body, host = "getContext" in want || "ownerSVGElement" in want ? document.body : want, page = host === document.body, corner = o.corner ?? "tr", key = o.key === void 0 ? "F9" : o.key;
  const tpl = document.createElement("div");
  tpl.innerHTML = `<div class=fizlet-perf role=group aria-label=Performance data-fizlet-ignore hidden aria-hidden=true style="position:${page ? "fixed" : "absolute"};${corner[0] === "t" ? "top" : "bottom"}:8px;${corner[1] === "l" ? "left" : "right"}:8px;z-index:60;contain:layout paint style;pointer-events:none;box-sizing:content-box;width:120px;padding:6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;background:var(--surface,#110d22);color:var(--muted,#aea4d6);border:2px solid var(--rim,#07060f);border-radius:6px;box-shadow:calc(3px*var(--shadow-x,0)) calc(3px*var(--shadow-y,1)) 0 var(--shadow-color,var(--rim,#07060f));font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.08em;font-variant-numeric:tabular-nums"><canvas aria-hidden=true style="grid-column:1/-1;width:120px;height:36px;background:var(--bg,#07060f)"></canvas>` + LABELS.map((l) => `<span><b style="color:var(--ink,#f6f3ff)">0</b> ${l}</span>`).join("") + "</div>";
  const el = tpl.firstChild, canvas = el.firstChild, dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
  const cw = canvas.width = Math.round(BARS * dpr), ch = canvas.height = Math.round(36 * dpr), ctx = canvas.getContext("2d");
  const tones = [...TONES], texts = [...el.querySelectorAll("b")].map((b) => b.firstChild);
  let on = false, dead = false;
  const write = () => {
    const n = s[
      1
      /* WN */
    ], heap = performance.memory;
    out[0] = n ? n * 1e3 / s[
      0
      /* WT */
    ] : 0;
    out[1] = n ? s[
      0
      /* WT */
    ] / n : 0;
    out[2] = s[
      3
      /* DROP */
    ];
    out[3] = n ? s[
      2
      /* WS */
    ] / n : 0;
    out[4] = engine.live;
    out[5] = heap ? heap.usedJSHeapSize / 1048576 : 0;
    for (let i = 0; i < 6; i++) L.text(texts[i], i < 5 || heap ? fmt(i) : "--");
  };
  const draw = () => {
    if (!ctx) return;
    const bw = cw / BARS, top = budget * 3, x0 = cw - ring.size * bw;
    ctx.clearRect(0, 0, cw, ch);
    let tone = -1;
    for (let k = 0; k < ring.size; k++) {
      const v = ring.ms[ring.slot(k)], h = Math.max(dpr, Math.min(1, v / top) * ch), c = v <= budget * 1.25 ? 0 : v <= budget * 2 ? 1 : 2;
      if (c !== tone) ctx.fillStyle = tones[tone = c];
      ctx.fillRect(x0 + k * bw, ch - h, bw, h);
    }
    ctx.fillStyle = tones[3];
    ctx.fillRect(0, Math.round(ch * 2 / 3) - dpr, cw, dpr);
  };
  const system = engine.add({
    render() {
      const d = clock[0] * 1e3, w = clock[1];
      if (!(d > 0)) return;
      ring.push(d);
      s[
        0
        /* WT */
      ] += d;
      s[
        1
        /* WN */
      ]++;
      s[
        2
        /* WS */
      ] += w;
      s[
        3
        /* DROP */
      ] += missed(d, budget);
      s[
        4
        /* FRAMES */
      ]++;
      if (s[
        0
        /* WT */
      ] >= WINDOW) {
        if (on) write();
        s[
          0
          /* WT */
        ] = s[
          1
          /* WN */
        ] = s[
          2
          /* WS */
        ] = 0;
      }
      if (on) draw();
    }
  });
  const show = (next = !on) => {
    if (dead || next === on) return;
    on = next;
    L.attr(el, "hidden", on ? null : "");
    L.attr(el, "aria-hidden", on ? null : "true");
    if (on) {
      const cs = globalThis.getComputedStyle?.(el);
      for (let i = 0; i < VARS.length; i++) tones[i] = cs?.getPropertyValue(VARS[i]).trim() || TONES[i];
      if (cs && !page && getComputedStyle(host).position === "static") L.style(host, "position", "relative");
      write();
      draw();
    } else L.unstyle(host, "position");
    o.change?.(on);
  };
  const ctl = new AbortController();
  const destroy = () => {
    if (dead) return;
    dead = true;
    ctl.abort();
    engine.remove(system);
    el.remove();
    L.unstyle(host, "position");
  };
  engine.signal.addEventListener("abort", destroy, { signal: ctl.signal });
  if (key) document.addEventListener("keydown", (ev) => ev.code === key && !ev.repeat && show(), { signal: ctl.signal });
  host.append(L.add(el));
  if (o.on) show(true);
  return {
    el,
    ring,
    /** Show (true), hide (false) or flip (no argument). */
    show,
    get on() {
      return on;
    },
    /** Frames recorded (0-length frames after a pause are not frames). */
    get frames() {
      return s[
        4
        /* FRAMES */
      ];
    },
    /** Dropped frames so far. */
    get dropped() {
      return s[
        3
        /* DROP */
      ];
    },
    /** Remove the overlay, its key and its system; the engine keeps running. */
    destroy
  };
}
export {
  BARS,
  FrameRing,
  WINDOW,
  fps,
  missed,
  perf
};
