import {
  need
} from "./chunk-RA74YNEB.js";

// src/timeline.ts
var EASES = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - (1 - p) ** 3,
  inOut: (p) => p < 0.5 ? 4 * p * p * p : 1 - (2 - 2 * p) ** 3 / 2,
  back: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2
};
var TABLES = /* @__PURE__ */ new Map();
var table = (key, f) => TABLES.get(key) ?? TABLES.set(key, Float64Array.from({ length: 257 }, (_, i) => f(i / 256))).get(key);
var NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/g;
function timeline(engine, o = {}) {
  const tracks = [], props = [], names = [], marks = [], waits = [];
  const yoyo = o.yoyo, id = o.id ?? 0, rate = need(o.rate ?? 1, "rate", 1), reps = o.repeat === Infinity ? -1 : need((o.repeat ?? 0) + 1, "repeat + 1", 2) - 1;
  const mq = o.motion == null && typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const still = () => mq ? mq.matches : o.motion === false;
  const s = new Float64Array(1);
  let end = 0, prev = 0, dir = 0, owe = 0, jump = 0, start = 0, undo = 0;
  const ok = () => {
    for (let i = 0; i < waits.length; i++) waits[i]();
    waits.length = 0;
  };
  engine.signal.addEventListener("abort", ok);
  const total = () => reps < 0 ? Infinity : end * (reps + 1);
  const top = () => reps < 0 ? end : total();
  const at = (a, i = names.indexOf(a)) => typeof a === "number" ? a : a === "<" ? prev : i < 0 ? end : marks[i];
  const pass = (a, b) => {
    const L = end;
    for (let i = Math.floor(Math.min(a, b) / L); i * L <= Math.max(a, b); i++)
      for (let j = 0; j < marks.length; j++) {
        if (yoyo && i & 1 && marks[j] % L == 0) continue;
        const g = i * L + (yoyo && i & 1 ? L - marks[j] : marks[j]);
        if (b > a ? g > a && g <= b : g >= b && g < a) engine.events.emit(names[j], id, j);
      }
  };
  const sample = (t) => {
    const L = end, n = t > 0 && L ? Math.ceil(t / L) - 1 : 0, u = yoyo && n & 1 ? L - t + n * L : t - n * L;
    for (let i = 0; i < tracks.length; i++) {
      const k = tracks[i], p = k.p, out = p.o, w = out.length;
      if (u < k.t && !k.f) continue;
      const P = k.d > 0 ? Math.min(1, Math.max(0, (u - k.t) / k.d)) : +(u >= k.t), x = P * 256, c = k.e, h = Math.min(255, Math.floor(x)), n2 = k.n;
      const e = (n2 ? Math.min(1, Math.floor(P * n2) / n2) : c[h] + (c[h + 1] - c[h]) * (x - h)) * (k.m - 1);
      const j = Math.min(Math.max(Math.floor(e), 0), k.m - 2), f = e - j;
      for (let q = 0; q < w; q++) {
        const a = k.v[j * w + q], v = Math.round((a + (k.v[j * w + w + q] - a) * f) * 1e3) / 1e3;
        if (v !== out[q]) out[q] = v, p.y = 1;
      }
      if (p.h == 1 && p.y) p.el[p.k] = out[0], p.y = 0;
    }
  };
  const go = (d, j = still()) => {
    if (d > 0 ? s[0] >= total() : s[0] <= 0) s[0] = d > 0 ? 0 : top();
    start = +(dir !== d && s[0] === (d > 0 ? 0 : top()));
    jump = +j;
    dir = d;
    engine.wake();
    return tl;
  };
  const tl = {
    /** Add tracks: each property of `values` on each target (an element, a list of them, or any
     *  object or typed array for plain numbers: `tl.to(arr, { 0: [0, 1] })`). Chainable. */
    to(targets, values, t = {}) {
      const list = targets.style || ArrayBuffer.isView(targets) || !("length" in targets) ? [targets] : Array.from(targets);
      const dur = need(t.dur ?? 0.4, "dur"), st = need(t.stagger ?? 0, "stagger"), t0 = at(t.at) + need(t.delay ?? 0, "delay");
      const f = t.ease ?? "out", n = /^steps\((\d+)\)$/.exec(f)?.[1];
      const fn = typeof f === "function" ? f : n > 0 ? (p) => Math.min(1, Math.floor(p * n) / n) : EASES[f];
      if (!fn) throw new RangeError("timeline: ease " + f);
      const ease = table(f, fn);
      list.forEach((el, i) => {
        for (const name in values) {
          const key = isNaN(+name) ? name : +name, kf = [].concat(values[name]).map(String), shape = (x) => x.replace(NUM, "\0");
          let p = props.find((x) => x.el === el && x.k === key), last;
          const first = !p, w = kf[0].match(NUM)?.length ?? 0;
          if (!p) props.push(p = { el, k: key, w: shape(kf[0]).split("\0"), o: new Float64Array(w).fill(NaN), h: el.style ? 0 : ArrayBuffer.isView(el) ? 1 : 2, y: 0, b: el[key] });
          for (const k of tracks) if (k.p === p) last = k;
          const v = kf.map((x) => {
            if (shape(x) !== p.w.join("\0")) throw new RangeError("timeline: " + name + " " + x);
            return x.match(NUM) ?? [];
          });
          if (!v[1]) v.unshift(last ? [...last.v.subarray(last.v.length - w)] : v[0]);
          tracks.push({ p, t: t0 + i * st, d: dur, e: ease, n: +n || 0, v: new Float64Array(v.flat().map(Number)), m: v.length, f: first });
        }
      });
      prev = t0;
      end = Math.max(end, t0 + (list.length - 1) * st + dur);
      return tl;
    },
    /** Name a moment (default: the end so far) for `at`; its name goes on the ring as it passes. */
    label(name, t) {
      marks.push(at(t));
      names.push(name);
      return tl;
    },
    /** Play forward (from the start if it is at the end). */
    play: () => go(1),
    /** Play backward (from the end if it is at the start). */
    reverse: () => go(-1),
    /** Stop where it is. The engine calls this as its System pause hook (off screen, hidden tab,
     *  stop()): then it only suspends, and plays on when the engine resumes unless you paused it. */
    pause(by) {
      if (by !== engine) dir = 0;
      return tl;
    },
    /** Move the playhead to `t` seconds; it keeps playing or stays paused. */
    seek(t) {
      s[0] = Math.min(Math.max(need(t, "seek"), 0), total());
      owe = 1;
      engine.wake();
      return tl;
    },
    /** Land on the end in the next step ("timeline:end" fires). */
    finish: () => go(1, true),
    /** Pause and give every property back as it was before the timeline wrote it: styles through
     *  the ledger (a newer host edit wins), plain numbers to their value when the track was added. */
    revert() {
      dir = 0;
      undo = 1;
      engine.wake();
      return tl;
    },
    /** Resolves the next time the timeline ends, or when its engine is destroyed (at once if it was). */
    done: () => new Promise((r) => (waits.push(r), engine.signal.aborted && ok())),
    /** The playhead in seconds (over every play). */
    get time() {
      return s[0];
    },
    /** Every play together, in seconds (Infinity when it loops forever). */
    get duration() {
      return total();
    },
    get playing() {
      return dir !== 0;
    },
    /** The visitor prefers reduced motion (or `motion: false`): build the gentler variant on it. */
    get reduced() {
      return still();
    },
    step(e, dt) {
      const d = dir, a = s[0];
      if (d) {
        if (start) start = 0, e.events.emit("timeline:start", id);
        let b = jump ? d > 0 ? top() : 0 : a + dt * rate * d;
        pass(a, b);
        if (jump || (d > 0 ? b >= total() : b <= 0)) {
          b = Math.min(Math.max(b, 0), top());
          dir = 0;
          e.events.emit("timeline:end", id);
          ok();
        }
        s[0] = b;
        e.busy();
      } else if (!owe) return;
      owe = 0;
      sample(s[0]);
    },
    render() {
      for (let i = 0; i < props.length; i++) {
        const p = props[i], w = p.w, out = p.o;
        if (undo) {
          if (!p.h) engine.ledger.unstyle(p.el, p.k);
          else p.el[p.k] = p.b;
          out.fill(NaN);
        } else if (p.h) {
          if (p.y) p.el[p.k] = out[0];
        } else if (p.y) {
          let v = w[0];
          for (let q = 0; q < out.length; q++) v += out[q] + w[q + 1];
          engine.ledger.style(p.el, p.k, v);
        }
        p.y = 0;
      }
      undo = 0;
    }
  };
  engine.add(tl);
  return tl;
}

export {
  EASES,
  timeline
};
