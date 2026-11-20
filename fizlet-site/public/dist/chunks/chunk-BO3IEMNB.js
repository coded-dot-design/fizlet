import {
  hypot
} from "./chunk-3IN3G3AQ.js";
import {
  Grid
} from "./chunk-5M26CMEK.js";

// src/board-page.ts
var SKIP = "input,textarea,select,[contenteditable],[aria-live],dialog,[role=dialog],[data-fizlet-ignore],[data-fizlet-host]";
var NOT_TEXT = ",option,button,a,script,style,noscript,pre,code";
var seq = 0;
function boardPage(e, o = {}) {
  const root = o.root ?? document.body, doc = root.ownerDocument, win = doc.defaultView, host = e.root, L = e.ledger;
  const textSel = o.text ?? "h1,h2,h3,h4,h5,h6,p,li,blockquote,[data-fizlet-text]";
  const targetSel = o.targets ?? "button,[role=button],a.button,a.btn,[data-fizlet-target]";
  const skip = o.exclude ? SKIP + "," + o.exclude : SKIP, skipText = skip + NOT_TEXT;
  const MAX = textSel ? o.maxGlyphs ?? 8e3 : 1, READS = o.reads ?? 900, MAXT = o.maxTargets ?? 32;
  const eligible = o.letters ? /\p{L}/u : /\p{L}|\p{N}/u;
  const x = new Float32Array(MAX), y = new Float32Array(MAX), w = new Float32Array(MAX), h = new Float32Array(MAX);
  const spent = new Uint8Array(MAX), gr = new Int32Array(MAX), gk = new Int32Array(MAX), queue = new Int32Array(MAX), found = new Int32Array(MAX);
  const qr = [];
  const recs = [], byNode = /* @__PURE__ */ new Map(), targets = [], byEl = /* @__PURE__ */ new Map();
  const grid = new Grid(32, MAX, 1, 1), range = doc.createRange(), seg = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  let count = 0, queued = 0, cursor = 0, reads = 0, dirty = 1, rescan = 1, mark = 0, scans = 0;
  let shown = new Int32Array(0);
  const qx = new Float64Array(1), qy = new Float64Array(1), qrad = new Float64Array(1), arg = new Float64Array(4);
  const STILL = o.still ?? 0.5;
  const n = new Float64Array([-9, -9, 2, 0]);
  const hex = o.color && /^#[\da-f]{3,8}$/i.test(o.color) ? o.color : "", name = "fizlet-board-" + ++seq;
  const hl = hex && win.Highlight && new win.Highlight();
  if (hl) {
    const st = L.add(doc.createElement("style"));
    st.textContent = `::highlight(${name}){color:${hex}}`;
    doc.head.append(st);
    win.CSS.highlights.set(name, hl);
  }
  const mine = (node) => !!host?.contains(node) || !!(node.nodeType === 1 ? node : node.parentElement)?.closest("[data-fizlet-host]");
  const drop = (r) => (byNode.delete(r[0]), r[5].forEach((g) => g && hl.delete(g)));
  const ours = (r) => r[0].isConnected && r[0].data === r[1];
  const visible = (el, b) => {
    const s = win.getComputedStyle(el);
    return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < win.innerWidth && b.top < win.innerHeight && s.visibility !== "hidden" && s.opacity !== "0";
  };
  function scan() {
    rescan = 0;
    scans++;
    const seen = /* @__PURE__ */ new Set();
    let total = 0, visited = 0;
    if (textSel) for (const el of [...root.querySelectorAll(textSel)].slice(0, 160)) {
      if (el.closest(skipText) || mine(el)) continue;
      const walk = doc.createTreeWalker(el, 4);
      for (let t; total < MAX && visited++ < 6e3 && (t = walk.nextNode()); ) {
        const node = t;
        let r = byNode.get(node);
        if (r && !ours(r)) drop(r), r = void 0;
        if (!r) {
          if (!node.data.trim() || node.parentElement.closest(skipText) || mine(node)) continue;
          byNode.set(node, r = [node, node.data, [], [], [], [], []]);
          for (const p of seg.segment(node.data)) if (eligible.test(p.segment)) r[2].push(p.index), r[3].push(p.segment.length), r[4].push(0), r[6].push(p.segment);
        }
        if (!seen.has(r)) seen.add(r), total += r[2].length;
      }
    }
    byNode.forEach((r) => seen.has(r) || drop(r));
    recs.length = 0;
    byNode.forEach((r) => recs.push(r));
    if (shown.length < recs.length) shown = new Int32Array(recs.length * 2);
    count = 0;
    for (let k = 0, more = 1; more; k += 8) {
      more = 0;
      for (let ri = 0; ri < recs.length; ri++)
        for (let j = k; j < k + 8 && j < recs[ri][2].length && count < MAX; j++, more = 1)
          gr[count] = ri, gk[count] = j, spent[count] = recs[ri][4][j] ? 1 : 0, w[count] = h[count] = 0, count++;
    }
    cursor = 0;
    targets.length = 0;
    for (const el of root.querySelectorAll(targetSel)) {
      if (targets.length === MAXT) break;
      if (el.closest(skip) || mine(el) || host && el.contains(host)) continue;
      let t = byEl.get(el);
      if (!t) byEl.set(el, t = { el, x: 0, y: 0, w: 0, h: 0, hp: 100 });
      targets.push(t);
    }
    byEl.forEach((t, el) => targets.includes(t) || byEl.delete(el));
  }
  function measure() {
    const W = win.innerWidth, H = win.innerHeight;
    dirty = reads = 0;
    mark++;
    if (grid.cols * grid.cell < W || grid.rows * grid.cell < H) grid.resize(W, H);
    grid.clear();
    for (let m = 0, i = cursor; m < count; m++, i = i + 1 < count ? i + 1 : 0) {
      if (spent[i]) continue;
      const ri = gr[i], r = recs[ri];
      if (Math.abs(shown[ri]) !== mark) {
        const el = r[0].parentElement, on3 = ours(r);
        shown[ri] = on3 && visible(el, el.getBoundingClientRect()) ? mark : -mark;
        if (!on3) rescan = 1;
      }
      if (shown[ri] < 0) {
        w[i] = h[i] = 0;
        continue;
      }
      if (reads === READS) {
        cursor = i;
        dirty = 1;
        for (; m < count; m++, i = i + 1 < count ? i + 1 : 0) if (w[i] > 0 && !spent[i]) put(i);
        break;
      }
      const k = gk[i], off = r[2][k];
      range.setStart(r[0], off);
      range.setEnd(r[0], off + r[3][k]);
      const g = range.getBoundingClientRect();
      reads++;
      const l = g.left > 0 ? g.left : 0, t = g.top > 0 ? g.top : 0, rw = (g.right < W ? g.right : W) - l, rh = (g.bottom < H ? g.bottom : H) - t;
      const on2 = rw > 0 && rh > 0;
      x[i] = l;
      y[i] = t;
      w[i] = on2 ? rw : 0;
      h[i] = on2 ? rh : 0;
      if (on2) put(i);
    }
    for (const t of targets) {
      const b = t.el.getBoundingClientRect(), on2 = visible(t.el, b);
      t.x = b.left;
      t.y = b.top;
      t.w = on2 ? b.width : 0;
      t.h = on2 ? b.height : 0;
    }
  }
  const put = (i) => grid.insert(i, x[i] + w[i] / 2, y[i] + h[i] / 2, (w[i] > h[i] ? w[i] : h[i]) / 2);
  function write(r, k) {
    const off = r[2][k], len = r[3][k];
    const s = r[4][k], bit = s === 2 ? "\xA0" : s === 3 ? "0" : s === 4 ? "1" : e.random() < 0.5 ? "0" : "1", next = r[1].slice(0, off) + bit + r[1].slice(off + len);
    if (!L.text(r[0], next)) return;
    r[1] = next;
    r[3][k] = 1;
    for (let j = 0; j < r[2].length; j++) if (r[2][j] > off) r[2][j] += 1 - len;
    if (hl) {
      hl.add(r[5][k] = doc.createRange());
      r[5].forEach((g, j) => g && (g.setStart(r[0], r[2][j]), g.setEnd(r[0], r[2][j] + 1)));
    }
    dirty = 1;
  }
  const touch = () => dirty = 1;
  const on = { signal: e.signal, passive: true, capture: true };
  win.addEventListener("scroll", touch, on);
  win.addEventListener("resize", touch, on);
  const mo = new win.MutationObserver((list) => {
    for (const m of list)
      if (!mine(m.target) && (m.type !== "characterData" || byNode.get(m.target)?.[1] !== m.target.nodeValue)) {
        if (m.type !== "attributes") rescan = 1;
        dirty = 1;
      }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributeFilter: ["class", "style", "hidden"] });
  const ro = new win.ResizeObserver(touch);
  ro.observe(root);
  e.signal.addEventListener("abort", () => {
    mo.disconnect();
    ro.disconnect();
    if (hl) win.CSS.highlights.delete(name);
    byNode.clear();
    recs.length = qr.length = targets.length = count = queued = 0;
    grid.clear();
  });
  function refresh(force) {
    const now = n[
      3
      /* NOW */
    ];
    if (rescan && (force || now - n[
      0
      /* SCANNED */
    ] >= 0.5)) n[
      0
      /* SCANNED */
    ] = now, scan(), force = true;
    if (force || now - n[
      1
      /* MEASURED */
    ] >= (dirty ? 0.08 : STILL)) n[
      1
      /* MEASURED */
    ] = now, measure();
  }
  function nearIn(p, i, out) {
    const px = p[i], py = p[i + 1], pr = p[i + 2];
    qx[0] = px;
    qy[0] = py;
    qrad[0] = pr;
    let m = 0;
    for (let k = 0, c = grid.near(qx, qy, qrad, 0, found); k < c && m < out.length; k++) {
      const j = found[k], dx = px - (px < x[j] ? x[j] : px > x[j] + w[j] ? x[j] + w[j] : px);
      const dy = py - (py < y[j] ? y[j] : py > y[j] + h[j] ? y[j] + h[j] : py);
      if (!spent[j] && dx * dx + dy * dy <= pr * pr) out[m++] = j;
    }
    return m;
  }
  function hitIn(p, i) {
    const x0 = p[i], y0 = p[i + 1], dx = p[i + 2] - x0, dy = p[i + 3] - y0;
    let best = -1;
    n[
      2
      /* T */
    ] = 2;
    qx[0] = x0 + dx / 2;
    qy[0] = y0 + dy / 2;
    qrad[0] = hypot(dx, dy) / 2 + 2;
    for (let k = 0, c = grid.near(qx, qy, qrad, 0, found); k < c; k++) {
      const j = found[k];
      let a = 0, b = 1;
      for (let ax = 0; ax < 2; ax++) {
        const s0 = ax ? y0 : x0, d = ax ? dy : dx, lo = (ax ? y[j] : x[j]) - 2, hi = lo + (ax ? h[j] : w[j]) + 4;
        if (d) {
          const u = (lo - s0) / d, v = (hi - s0) / d;
          a = Math.max(a, u < v ? u : v);
          b = Math.min(b, u < v ? v : u);
        } else if (s0 < lo || s0 > hi) a = 2;
      }
      if (!spent[j] && a <= b && a < n[
        2
        /* T */
      ]) n[
        2
        /* T */
      ] = a, best = j;
    }
    return best;
  }
  const system = {
    read: () => e.signal.aborted || (n[
      3
      /* NOW */
    ] = n[
      3
      /* NOW */
    ] + e.timing[0], refresh()),
    render() {
      for (let q = 0; q < queued; q++) write(qr[q], queue[q]);
      queued = 0;
    }
  };
  e.add(system);
  return {
    glyphs: {
      /** Glyphs indexed, spent ones included (w = 0 while not on screen). */
      get count() {
        return count;
      },
      x,
      y,
      w,
      h,
      /** 1 once consumed. */
      spent
    },
    /** Page targets (rects measured in read). */
    targets,
    /** Unspent on-screen glyphs touching the circle, into `out`. Returns how many. */
    near(px, py, pr, out) {
      arg[0] = px;
      arg[1] = py;
      arg[2] = pr;
      return nearIn(arg, 0, out);
    },
    /** `near` for hot paths: the circle is p[i], p[i + 1] (centre) and p[i + 2] (radius), so no
     *  number is passed (a number passed to a call V8 doesn't inline boxes: one allocation). */
    nearAt: (p, i, out) => nearIn(p, i, out),
    /** First unspent glyph the segment touches (2 px pad), or -1; how far along it (0..1) is `t`. */
    hit(x0, y0, x1, y1) {
      arg[0] = x0;
      arg[1] = y0;
      arg[2] = x1;
      arg[3] = y1;
      return hitIn(arg, 0);
    },
    /** `hit` for hot paths: the segment is p[i .. i + 3] (x0, y0, x1, y1); how far along it the
     *  glyph is goes in p[i + 4] (and `t`). No number is passed, so nothing boxes. */
    hitAt(p, i) {
      const g = hitIn(p, i);
      p[i + 4] = n[
        2
        /* T */
      ];
      return g;
    },
    get t() {
      return n[
        2
        /* T */
      ];
    },
    /** Rescans so far: glyph indices from before a rescan mean nothing after it. */
    get scans() {
      return scans;
    },
    /** Range reads made by the last refresh (never more than `reads`). */
    get reads() {
      return reads;
    },
    /**
     * Consume glyph i: a 0/1 ("binary": the board's random draw; "0" / "1": the game's) or a no-break
     * space ("erase") in the page's own text, through the ledger; from a step it is written in
     * render. False if spent or not ours anymore.
     */
    consume(i, as) {
      if (!(i >= 0 && i < count) || spent[i] || !ours(recs[gr[i]])) return false;
      spent[i] = 1;
      recs[gr[i]][4][gk[i]] = as === "erase" ? 2 : as === "0" ? 3 : as === "1" ? 4 : 1;
      w[i] = h[i] = 0;
      if (e.phase === 3 || e.phase === 0) write(recs[gr[i]], gk[i]);
      else qr[queued] = recs[gr[i]], queue[queued++] = gk[i];
      return true;
    },
    /** Glyph i as it was before the game changed it (the letter a bite ate). Not for a step: a string. */
    char: (i) => i >= 0 && i < count ? recs[gr[i]][6][gk[i]] : "",
    /** The element that holds glyph i's text (for a game's own read-phase checks, e.g. what covers it). */
    parent: (i) => i >= 0 && i < count ? recs[gr[i]][0].parentElement : null,
    /** Rescan and re-measure now; from a step, at the next read. */
    refresh() {
      rescan = 1;
      if (e.phase === 2) n[
        0
        /* SCANNED */
      ] = n[
        1
        /* MEASURED */
      ] = -9;
      else refresh(true);
    },
    system
  };
}

export {
  boardPage
};
