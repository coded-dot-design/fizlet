// src/hud.ts
var FMTS = ["int", "clock", "rank", "pct"];
var N = 1024;
var caches = [];
var key = (f, v) => f === 1 ? Math.max(0, Math.floor(v)) : f === 3 ? Math.round(v * 100) : f < 0 ? v : Math.round(v);
function str(f, k) {
  if (f === 1) return Math.floor(k / 60) + (k % 60 < 10 ? ":0" : ":") + k % 60;
  return f === 2 ? "#" + k : f === 3 ? k + "%" : "" + k;
}
var cached = (f, k) => k >= 0 && k < N && k === (k | 0) ? (caches[f] ??= new Array(N))[k] ??= str(f, k) : str(f, k);
function hud(engine, root = document) {
  const L = engine.ledger, vals = [], evs = [];
  let last = new Float64Array(8);
  const el = (t) => {
    const x = typeof t === "string" ? root.querySelector(t) : t;
    if (!x) throw Error("fizlet/hud: no " + t);
    return x;
  };
  const textOf = (x) => {
    const f = x.firstChild;
    if (f && f.nodeType === 3 && !f.nextSibling) return f;
    return x.appendChild(L.add(x.ownerDocument.createTextNode("")));
  };
  const bind = (k, t, g, f, fn, c, n, line, text, play) => {
    const fnGet = typeof g === "function", x = el(t);
    const b = { k, el: x, g: fnGet ? g : null, a: g && !fnGet ? g[0] : null, i: g && !fnGet ? g[1] : 0, f, fn, c, n, line, text, play, p: x, t: [], lines: Array(k === 3 ? n : 2).fill(""), dirty: false };
    if (k < 3) {
      if (vals.length === last.length) {
        const o = last;
        (last = new Float64Array(o.length * 2).fill(NaN)).set(o);
      }
      vals.push(b);
    } else evs.push(b);
    return api;
  };
  last.fill(NaN);
  const system = {
    render() {
      for (let i = 0; i < vals.length; i++) {
        const b = vals[i], v = b.g ? +b.g() : b.a[b.i], k = b.k === 0 ? key(b.fn ? -1 : b.f, v) : b.k === 1 ? key(3, v < 0 ? 0 : v > 1 ? 1 : v) : v ? 1 : 0;
        if (k === last[i] || k !== k && last[i] !== last[i]) continue;
        last[i] = k;
        if (b.k === 0) L.text(b.t[0] ??= textOf(b.el), b.fn ? b.fn(k) : cached(b.f, k));
        else if (b.k === 2) L.cls(b.el, b.c, k === 1);
        else {
          L.style(b.el, "width", cached(3, k));
          if (b.el.getAttribute("role") === "progressbar") L.attr(b.el, "aria-valuenow", cached(0, k));
          if (b.n >= 0) L.cls(b.el, "low", k <= b.n);
        }
      }
      const ring = engine.events;
      if (evs.length)
        for (let j = 0; j < ring.size; j++) {
          const x = ring.at(j);
          for (let i = 0; i < evs.length; i++) {
            const b = evs[i];
            if (x.type !== b.c) continue;
            b.dirty = true;
            if (b.k === 3) {
              for (let r = b.n - 1; r > 0; r--) b.lines[r] = b.lines[r - 1];
              b.lines[0] = b.line(x.a, x.b);
            } else {
              const s = b.text(x.a, x.b);
              b.lines[0] = s[0];
              b.lines[1] = s[1] ?? "";
            }
          }
        }
      for (let i = 0; i < evs.length; i++) {
        const b = evs[i];
        if (!b.dirty) continue;
        b.dirty = false;
        if (!b.t.length) {
          const kids = b.el.children;
          if (b.k === 3)
            for (let r = 0; r < b.n; r++) {
              const row = kids[r] ?? b.el.appendChild(L.add(b.el.ownerDocument.createElement(/^[OU]L$/.test(b.el.tagName) ? "li" : "div")));
              if (!r) b.p = row;
              b.t.push(textOf(row));
            }
          else b.t.push(textOf(kids[0] ?? b.el)), kids[1] && b.t.push(textOf(kids[1]));
        }
        if (b.k === 3) for (let r = 0; r < b.n; r++) L.text(b.t[r], b.lines[r]);
        else {
          L.text(b.t[0], b.lines[0]);
          if (b.t[1]) L.text(b.t[1], b.lines[1]);
        }
        b.play?.(b.p);
      }
    }
  };
  engine.add(system);
  const api = {
    /** A number readout: written only when its shown value changes. */
    num: (t, get, fmt = "int") => typeof fmt === "function" ? bind(0, t, get, -1, fmt, "", 0, null, null, null) : bind(0, t, get, FMTS.indexOf(fmt), null, "", 0, null, null, null),
    /** A bar: `width` in whole percent (0..1 in), `aria-valuenow` on a progressbar, class `low` at or under `low`. */
    meter: (t, get, low) => bind(1, t, get, 0, null, "", low === void 0 ? -1 : Math.round(low * 100), null, null, null),
    /** A class that follows a condition. */
    flag: (t, cls, get) => bind(2, t, get, 0, null, cls, 0, null, null, null),
    /** A list of the last `rows` events of a type, newest first (`play` runs on the newest row). */
    feed: (list, rows, on, line, play) => bind(3, list, null, 0, null, on, rows, line, null, play ?? null),
    /** Title and sub from an event; `play` (re)starts the game's own animation. */
    banner: (t, on, text, play) => bind(4, t, null, 0, null, on, 0, null, text, play ?? null),
    /** The render system (already added to the engine; `engine.remove(system)` unbinds everything). */
    system
  };
  return api;
}

export {
  hud
};
