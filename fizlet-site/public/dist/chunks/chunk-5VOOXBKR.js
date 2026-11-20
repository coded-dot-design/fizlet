import {
  Ledger
} from "./chunk-RXTVZ32U.js";
import {
  seeded
} from "./chunk-26IPXWAE.js";
import {
  need
} from "./chunk-RA74YNEB.js";

// src/kernel/ring.ts
var EventRing = class {
  cap;
  size = 0;
  dropped = 0;
  s = [];
  // short: esbuild keeps property names
  constructor(cap = 64) {
    this.cap = need(cap, "events capacity", 2);
    for (let i = 0; i < cap; i++) this.s.push({ type: "", a: 0, b: 0, x: 0, y: 0, v: 0 });
  }
  emit(type, a = 0, b = 0, x = 0, y = 0, v = 0) {
    if (this.size === this.cap) return this.dropped++, false;
    const s = this.s[this.size++];
    s.type = type;
    s.a = a;
    s.b = b;
    s.x = x;
    s.y = y;
    s.v = v;
    return true;
  }
  at(i) {
    return i < this.size ? this.s[i] : void 0;
  }
  clear() {
    this.size = 0;
  }
};

// src/kernel/pool.ts
var Pool = class {
  cap;
  items = [];
  f = [];
  // the free items (short: esbuild keeps property names)
  constructor(cap, create) {
    this.cap = need(cap, "pool cap", 2);
    for (let i = 0; i < cap; i++) this.f.push(create());
  }
  get size() {
    return this.items.length;
  }
  acquire() {
    const item = this.f.pop();
    if (item !== void 0) this.items.push(item);
    return item;
  }
  /** Swap-remove by index (order is not kept). Iterate backwards when releasing in a loop. */
  releaseAt(i) {
    const items = this.items, item = items[i];
    if (item === void 0) return false;
    const last = items.pop();
    if (i < items.length) items[i] = last;
    this.f.push(item);
    return true;
  }
  release(item) {
    return this.releaseAt(this.items.indexOf(item));
  }
  clear() {
    while (this.items.length) this.releaseAt(this.items.length - 1);
  }
};

// src/kernel/engine.ts
var IDLE = 0;
var READ = 1;
var STEP = 2;
var RENDER = 3;
var live = [];
var raf = 0;
var requests = 0;
var cur = 0;
var end = -1;
function tick(now) {
  raf = 0;
  for (cur = 0, end = live.length; cur < end; cur++)
    try {
      live[cur].frame(now);
    } catch (err) {
      console.error(err);
    }
  end = -1;
  schedule(null, false);
}
function schedule(e, on) {
  const i = live.indexOf(e);
  if (on && i < 0) live.push(e);
  if (!on && i >= 0) {
    live.splice(i, 1);
    if (i < end) end--;
    if (i <= cur) cur--;
  }
  if (end < 0 && live.length && !raf && typeof requestAnimationFrame === "function") requests++, raf = requestAnimationFrame(tick);
  if (!live.length && raf) cancelAnimationFrame(raf), raf = 0;
}
var scheduler = {
  get engines() {
    return live.length;
  },
  get requests() {
    return requests;
  }
};
var REASONS = ["stopped", "hidden", "offscreen", "editable", "reduced-motion", "settled"];
var GONE = {};
function createEngine(o = {}) {
  const dt = need(o.step ?? 1 / 60, "step", 1), maxSteps = need(o.maxSteps ?? 4, "maxSteps", 2), root = o.root ?? null;
  const settle = o.settle == null ? 0 : need(o.settle, "settle", 1), gap = o.fps == null ? 0 : 1e3 / need(o.fps, "fps", 1) - 4;
  const ctl = new AbortController(), signal = ctl.signal;
  const systems = [], pools = [];
  const events = new EventRing(o.events ?? 64), ledger = new Ledger(), random = seeded(need(o.seed ?? 1, "seed"));
  let held = 1, phase = 0, dead = false, gone = false;
  let napT;
  const n = new Float64Array(11);
  n[
    1
    /* LAST */
  ] = -1;
  const set = (bit, on) => {
    const was = !held && !dead;
    held = on ? held | bit : held & ~bit;
    if (held) n[
      1
      /* LAST */
    ] = -1;
    schedule(engine, !held && !dead);
    if (was && held && bit !== 32) for (let i = 0; i < systems.length; i++) systems[i].pause?.(engine);
  };
  const engine = {
    signal,
    events,
    ledger,
    random,
    root,
    /**
     * The current (or last) frame, as a typed-array view (reading a slot never boxes a number):
     * `[0]` seconds this frame advances on the shared clock (0 after a pause or a settle), `[1]` ms
     * the last finished frame's hooks took (read, steps, render). Read-only by convention.
     */
    timing: n.subarray(9, 10 + 1),
    /** Fixed step length in seconds. */
    dt,
    get time() {
      return n[
        2
        /* TIME */
      ];
    },
    /** Fixed steps run so far: an integer, so reading it in a hot path never boxes a number. */
    get steps() {
      return n[
        4
        /* STEPS */
      ];
    },
    get phase() {
      return phase;
    },
    /** Pooled things in use right now, summed over every `engine.pool` (no allocation). */
    get live() {
      let k = 0;
      for (let i = 0; i < pools.length; i++) k += pools[i][1].size;
      return k;
    },
    get running() {
      return !held && !dead;
    },
    /** Why it's paused right now (empty when running). */
    get paused() {
      return REASONS.filter((_, i) => held & 1 << i);
    },
    add(s) {
      if (!dead) systems.push(s);
      return s;
    },
    /** Safe from inside a hook: the rest of the frame still runs every other system. */
    remove(s) {
      const i = systems.indexOf(s);
      if (i < 0) return;
      if (phase) systems[i] = GONE, gone = true;
      else systems.splice(i, 1);
    },
    /** A named, bounded pool, listed in stats(). */
    pool(name, cap, create) {
      const p = new Pool(cap, create);
      pools.push([name, p]);
      return p;
    },
    /** Run (again). On a settled engine this is wake() too: the quiet time starts over, so it runs a
     *  full settle window instead of going back to sleep on its first frame. Inert once destroyed. */
    start() {
      engine.wake(), dead || set(1, false);
    },
    /**
     * Something moved this frame: keeps a settling engine awake (no-op without `settle`). With
     * `sec`, something is scheduled that far ahead (an intro delay, a pause between beats): the
     * engine stays awake for `sec` of its own time (steps, so a slow frame can't outrun it), and
     * settle counts from then. A later, shorter hold never cuts a longer one; 0 or NaN is busy().
     */
    busy(sec) {
      n[
        8
        /* QUIET */
      ] = Math.max(n[
        8
        /* QUIET */
      ], n[
        2
        /* TIME */
      ] + (sec || 0));
    },
    /** Wake a settled engine (input does this for you); the quiet time starts again. */
    wake() {
      engine.busy();
      if (held & 32) set(32, false);
    },
    stop() {
      set(1, true);
    },
    /** Called by the scheduler with the rAF timestamp. */
    frame(now) {
      const sec = n[
        1
        /* LAST */
      ] < 0 ? 0 : (now - n[
        1
        /* LAST */
      ]) / 1e3;
      n[
        1
        /* LAST */
      ] = now;
      try {
        engine.advance(sec);
      } catch (err) {
        phase = 0;
        engine.stop();
        if (!o.onError) throw err;
        o.onError(err, engine);
      }
      if (gap) clearTimeout(napT), schedule(engine, false), napT = setTimeout(set, gap - n[
        10
        /* WORK */
      ], 0, false);
    },
    /** Run one frame's worth of time by hand (tests, headless, a server). A hook's error throws here.
     *  `sec` must be a finite number (0 or less runs a frame with no steps); anything else throws a
     *  RangeError before the frame starts, instead of stalling the clock for good (S6 P2-04). */
    advance(sec) {
      if (dead) return;
      need(sec, "sec");
      const t0 = performance.now();
      events.clear();
      phase = 1;
      for (let i = 0; i < systems.length; i++) systems[i].read?.(engine);
      phase = 2;
      n[
        9
        /* DELTA */
      ] = sec;
      if (sec > 0) n[
        0
        /* ACC */
      ] += sec;
      for (let k = 0; n[
        0
        /* ACC */
      ] >= dt; k++) {
        if (k === maxSteps) {
          n[
            5
            /* DROPPED */
          ] += Math.floor(n[
            0
            /* ACC */
          ] / dt);
          n[
            0
            /* ACC */
          ] %= dt;
          break;
        }
        for (let i = 0; i < systems.length; i++) systems[i].step?.(engine, dt);
        n[
          0
          /* ACC */
        ] -= dt;
        n[
          2
          /* TIME */
        ] += dt;
        n[
          4
          /* STEPS */
        ]++;
      }
      phase = 3;
      const alpha = n[
        0
        /* ACC */
      ] / dt;
      for (let i = 0; i < systems.length; i++) systems[i].render?.(engine, alpha);
      phase = 0;
      if (gone) {
        gone = false;
        for (let i = systems.length; i--; ) if (systems[i] === GONE) systems.splice(i, 1);
      }
      if (settle && n[
        2
        /* TIME */
      ] - n[
        8
        /* QUIET */
      ] >= settle) set(32, true);
      const ms = n[
        10
        /* WORK */
      ] = performance.now() - t0;
      n[
        3
        /* FRAMES */
      ]++;
      n[
        6
        /* MS */
      ] += ms;
      n[
        7
        /* MAX */
      ] = ms > n[
        7
        /* MAX */
      ] ? ms : n[
        7
        /* MAX */
      ];
    },
    stats() {
      const p = {};
      for (const [name, pool] of pools) p[name] = { used: pool.size, cap: pool.cap };
      const frames = n[
        3
        /* FRAMES */
      ];
      return {
        frames,
        steps: n[
          4
          /* STEPS */
        ],
        dropped: n[
          5
          /* DROPPED */
        ],
        time: n[
          2
          /* TIME */
        ],
        frameMs: { avg: frames ? n[
          6
          /* MS */
        ] / frames : 0, max: n[
          7
          /* MAX */
        ] },
        events: { size: events.size, cap: events.cap, dropped: events.dropped },
        pools: p,
        ledger: ledger.size,
        paused: engine.paused
      };
    },
    /** Stop for good: every listener and observer goes (one signal), the page is restored.
     *  Idempotent; afterwards the engine is inert (start, add and advance do nothing). */
    destroy() {
      if (dead) return;
      dead = true;
      n[
        0
        /* ACC */
      ] = 0;
      clearTimeout(napT);
      set(1, true);
      ctl.abort();
      ledger.restore(true);
      for (const [, pool] of pools) pool.clear();
      systems.length = 0;
    }
  };
  const rule = o.pause ?? {};
  if (typeof document === "object") {
    const on = { signal };
    if (rule.hidden !== false) {
      const vis = () => set(2, document.visibilityState === "hidden");
      document.addEventListener("visibilitychange", vis, on);
      addEventListener("pagehide", () => set(2, true), on);
      addEventListener("pageshow", vis, on);
      vis();
    }
    if (rule.offscreen !== false && root && typeof IntersectionObserver === "function") {
      const io = new IntersectionObserver((list) => set(4, !list[list.length - 1].isIntersecting));
      io.observe(root);
      signal.addEventListener("abort", () => io.disconnect(), { once: true });
    }
    if (rule.editable !== false) {
      const edit = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !root?.contains(t);
      document.addEventListener("focusin", (ev) => set(8, !!edit(ev.target)), on);
      document.addEventListener("focusout", () => set(8, false), on);
    }
    if (rule.reducedMotion && typeof matchMedia === "function") {
      const mq = matchMedia("(prefers-reduced-motion: reduce)");
      set(16, mq.matches);
      mq.addEventListener("change", () => set(16, mq.matches), on);
    }
  }
  if (o.signal) {
    if (o.signal.aborted) engine.destroy();
    else o.signal.addEventListener("abort", () => engine.destroy(), { signal });
  }
  return engine;
}

export {
  EventRing,
  Pool,
  IDLE,
  READ,
  STEP,
  RENDER,
  scheduler,
  createEngine
};
