import "./chunks/chunk-62P4PJ5K.js";
import {
  hypot
} from "./chunks/chunk-3IN3G3AQ.js";
import "./chunks/chunk-RA74YNEB.js";

// src/track.ts
var TAU = 6.283185307179586;
var HOP = {
  /** A step to the next (or previous) space. */
  step: 0,
  /** A jump from a space to its target. */
  jump: 1,
  /** Flag: this hop enters the start space going forward on a loop (pass go). */
  pass: 1,
  /** Flag: a step backward after the end (bounce). */
  back: 2,
  /** Flag: the move ends on the last space of an open path. */
  finish: 4,
  /** Flag: the last hop of the move. */
  land: 8
};
function track(o) {
  const pts = o.points, np = pts.length >> 1, closed = !!o.closed, T = o.tokens ?? 8, MH = o.maxHops ?? 64;
  const n = o.spaces ?? np, sp = o.spacing ?? 0.3, lvl = o.level ?? 0.3, hh = o.hop ?? 0.6, ht = o.hopTime ?? 0.22, js = o.jumpSpeed ?? 6;
  if (np < 2 || n < 2) throw new RangeError("track: two points and two spaces at least");
  const x = new Float64Array(n), z = new Float64Array(n), a = new Float64Array(n), jump = new Int32Array(n).fill(-1);
  const capOf = (i) => Math.max(1, typeof o.cap === "number" ? o.cap : o.cap ? o.cap[i] ?? 4 : 4);
  if (o.spaces == null) for (let i = 0; i < n; i++) x[i] = pts[i * 2], z[i] = pts[i * 2 + 1];
  else {
    const seg = closed ? np : np - 1, per = o.smooth ? 16 : 1, m = seg * per + 1, px = new Float64Array(m), pz = new Float64Array(m), L = new Float64Array(m);
    const P = (i, k) => closed ? pts[(i % np + np) % np * 2 + k] : pts[Math.max(0, Math.min(np - 1, i)) * 2 + k];
    for (let s = 0, j = 0; s < seg; s++)
      for (let q = 0; q < per || s === seg - 1 && q === per; q++, j++) {
        const t = q / per, t2 = t * t, t3 = t2 * t;
        for (let k = 0; k < 2; k++) {
          const p0 = P(s - 1, k), p1 = P(s, k), p2 = P(s + 1, k), p3 = P(s + 2, k);
          const v = o.smooth ? 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3) : p1 + (p2 - p1) * t;
          (k ? pz : px)[j] = v;
        }
        if (j) L[j] = L[j - 1] + hypot(px[j] - px[j - 1], pz[j] - pz[j - 1]);
      }
    const tot = L[m - 1];
    for (let i = 0, j = 1; i < n; i++) {
      const d = tot * i / (closed ? n : n - 1);
      while (j < m - 1 && L[j] < d) j++;
      const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1);
      x[i] = px[j - 1] + (px[j] - px[j - 1]) * f;
      z[i] = pz[j - 1] + (pz[j] - pz[j - 1]) * f;
    }
  }
  for (let i = 0; i < n; i++) {
    const p = closed ? (i + n - 1) % n : Math.max(0, i - 1), q = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    a[i] = Math.atan2(-(z[q] - z[p]), x[q] - x[p]);
  }
  if (o.jumps) for (let i = 0; i < o.jumps.length; i++) jump[o.jumps[i][0]] = o.jumps[i][1];
  const at = new Int32Array(T).fill(-1), seq = new Float64Array(T), start = o.start ?? 0, fin = o.finish ?? "stop";
  const hops = {
    /** Hops in the last move. */
    n: 0,
    kind: new Uint8Array(MH),
    flag: new Uint8Array(MH),
    from: new Int32Array(MH),
    to: new Int32Array(MH),
    t0: new Float64Array(MH),
    t1: new Float64Array(MH),
    A: new Float64Array(MH * 3),
    B: new Float64Array(MH * 3)
  };
  const V = new Float64Array(3);
  const C = new Float64Array(3);
  let mover = -1;
  function slot(k, out, s = at[k]) {
    let r = 0, m = 0;
    for (let j = 0; j < T; j++) if (at[j] === s) m++, seq[j] < seq[k] && j !== k && r++;
    if (at[k] !== s) m++, r = m - 1;
    return spot(s, r, m, out);
  }
  function spot(s, r, m, out) {
    const c = capOf(s), lv = Math.floor(r / c), on = Math.min(c, m - lv * c), j = r % c;
    out[0] = x[s];
    out[1] = lv * lvl;
    out[2] = z[s];
    if (on > 1) {
      const th = TAU * j / on + Math.PI / 2 + a[s], ca = Math.cos(th), sa = Math.sin(th);
      out[0] = x[s] + ca * sp;
      out[2] = z[s] - sa * sp;
    }
    return out;
  }
  function push(kind, flag, from, to) {
    const h = hops.n;
    if (h >= MH) return;
    hops.kind[h] = kind;
    hops.flag[h] = flag;
    hops.from[h] = from;
    hops.to[h] = to;
    hops.t0[h] = C[0];
    hops.t1[h] = C[0] = C[0] + (kind ? Math.max(ht * 1.5, hypot(x[to] - x[from], z[to] - z[from]) / js) : ht);
    hops.A[h * 3] = x[from];
    hops.A[h * 3 + 1] = 0;
    hops.A[h * 3 + 2] = z[from];
    hops.B[h * 3] = x[to];
    hops.B[h * 3 + 1] = 0;
    hops.B[h * 3 + 2] = z[to];
    hops.n = h + 1;
  }
  function pose(out) {
    const N = hops.n, t = C[1];
    if (!N) return mover >= 0 && slot(mover, out), false;
    let h = 0;
    while (h < N - 1 && t >= hops.t1[h]) h++;
    const u = Math.max(0, Math.min(1, (t - hops.t0[h]) / (hops.t1[h] - hops.t0[h]))), j = h * 3;
    const e = hops.kind[h] ? u * u * (3 - 2 * u) : u, lift = (hops.kind[h] ? 0.25 : 1) * hh * 4 * e * (1 - e);
    out[0] = hops.A[j] + (hops.B[j] - hops.A[j]) * e;
    out[1] = hops.A[j + 1] + (hops.B[j + 1] - hops.A[j + 1]) * e + lift;
    out[2] = hops.A[j + 2] + (hops.B[j + 2] - hops.A[j + 2]) * e;
    return t < C[0];
  }
  function put(ob) {
    const m = pose(V);
    ob.pos[0] = V[0];
    ob.pos[1] = V[1] + C[2];
    ob.pos[2] = V[2];
    return m;
  }
  const emit = (type, k, s) => o.events && o.events.emit(type, k, s);
  let order = 0;
  const api = {
    /** Spaces. */
    n,
    closed,
    /** Space centres. */
    x,
    z,
    /** Each space's heading: diorama's rot[1] that turns +x along the path. */
    a,
    /** Each space's jump target, or −1. */
    jump,
    /** Each token's space, or −1 off the board. */
    at,
    /** The last move's hops (`HOP` kinds and flags; `A`, `B`: each hop's ends, [x, y, z] × n). */
    hops,
    /** The token the last move moved, or −1. */
    get token() {
      return mover;
    },
    /** Seconds the last move takes. */
    duration: 0,
    /** Put token k on space s (−1 takes it off), with no hops. */
    place(k, s) {
      at[k] = s;
      seq[k] = ++order;
    },
    /** Tokens on space s. */
    count(s) {
      let m = 0;
      for (let j = 0; j < T; j++) if (at[j] === s) m++;
      return m;
    },
    /** Move token k by `steps` (negative: back) and any jumps where it lands. Fills `hops` and
     *  returns its count (0: it did not move, e.g. an exact finish it overshot). */
    move(k, steps) {
      hops.n = C[0] = api.duration = 0;
      mover = k;
      let p = at[k] < 0 ? 0 : at[k], dir = steps < 0 ? -1 : 1, left = Math.abs(steps | 0), back = 0;
      const last = n - 1, from = p;
      if (!closed && fin === "exact" && dir > 0 && p + left > last) return emit("track:stay", k, p), 0;
      slot(k, V);
      const a0 = V[0], a1 = V[1], a2 = V[2];
      while (left > 0) {
        let q = p + dir;
        if (closed) q = (q + n) % n;
        else if (q > last) {
          if (fin !== "bounce") break;
          dir = -1, back = HOP.back, q = p - 1;
        } else if (q < 0) break;
        const pass = closed && dir > 0 && q === start ? HOP.pass : 0;
        push(HOP.step, pass | back, p, q);
        if (pass) emit("track:pass", k, q);
        p = q;
        left--;
      }
      for (let g = 0; g < n && jump[p] >= 0 && jump[p] !== p; g++) {
        const q = jump[p];
        push(HOP.jump, 0, p, q);
        emit("track:jump", k, q);
        p = q;
      }
      api.duration = C[0];
      if (!hops.n && p === from) return 0;
      at[k] = p;
      seq[k] = ++order;
      const h = hops.n - 1;
      hops.A[0] = a0;
      hops.A[1] = a1;
      hops.A[2] = a2;
      slot(k, V);
      hops.B[h * 3] = V[0];
      hops.B[h * 3 + 1] = V[1];
      hops.B[h * 3 + 2] = V[2];
      hops.flag[h] |= HOP.land | (!closed && p === last ? HOP.finish : 0);
      if (!closed && p === last) emit("track:finish", k, p);
      emit("track:land", k, p);
      return hops.n;
    },
    slot,
    spot,
    /** Where the moving token is at t seconds into the last move: out = [x, y, z] (y over the board's
     *  top). False once the move is over (out is then its landing place). */
    sample(t, out) {
      C[1] = t;
      return pose(out);
    },
    /** Write `sample(t)` into a diorama object's `pos` (plus `y0` up); true while it moves. */
    apply(ob, t, y0 = 0) {
      C[1] = t;
      C[2] = y0;
      return put(ob);
    }
  };
  return api;
}
export {
  HOP,
  track
};
