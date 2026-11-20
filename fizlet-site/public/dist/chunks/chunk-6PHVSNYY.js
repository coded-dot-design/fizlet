// src/input.ts
var EDIT = "input,textarea,select,[contenteditable],[data-fizlet-ignore]";
function controls(e, o = {}) {
  const ctl = new AbortController(), on = { signal: ctl.signal };
  const names = Object.keys(o.keys ?? {}), N = names.length;
  const byCode = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Map();
  names.forEach((n, i) => (ids.set(n, i).set(i, i), o.keys[n].forEach((c) => (byCode.get(c) ?? byCode.set(c, []).get(c)).push(i))));
  const keys = /* @__PURE__ */ new Set();
  const cnt = new Uint8Array(N), btn = new Uint8Array(N);
  const pend = new Uint8Array(N + 1), fresh = new Uint8Array(N + 1), at = new Float64Array(N + 1).fill(-1);
  const index = (n) => ids.get(n) ?? -1;
  const isDown = (i) => cnt[i] + btn[i] > 0;
  const hit = (i) => e.phase === 2 ? at[i] === e.steps : fresh[i] === 1;
  const target = o.target ?? e.root ?? null;
  const R = o.radius ?? 60;
  const p = new Float64Array(10), s = new Float64Array(6);
  p[5] = s[5] = -1;
  const measure = () => {
    const r = target?.getBoundingClientRect();
    p[6] = r?.left ?? 0;
    p[7] = r?.top ?? 0;
    p[8] = r?.width ?? innerWidth;
    p[9] = 0;
  };
  const editing = (t) => t instanceof Element && !!t.closest(EDIT);
  const clear = () => {
    keys.clear();
    cnt.fill(0);
    btn.fill(0);
    pend.fill(0);
    fresh.fill(0);
    at.fill(-1);
    p[2] = s[0] = s[1] = s[2] = 0;
    p[5] = s[5] = -1;
  };
  addEventListener("keydown", (ev) => {
    const list = byCode.get(ev.code);
    if (!list || editing(ev.target) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    e.wake();
    if (e.running) ev.preventDefault();
    if (keys.has(ev.code)) return;
    keys.add(ev.code);
    for (const i of list) {
      if (!ev.repeat && !isDown(i)) pend[i] = 1;
      cnt[i]++;
    }
  }, on);
  addEventListener("keyup", (ev) => {
    if (keys.delete(ev.code)) for (const i of byCode.get(ev.code)) cnt[i]--;
  }, on);
  addEventListener("blur", clear, on);
  const el = target ?? window;
  el.addEventListener("pointermove", (ev) => {
    const pe = ev;
    e.wake();
    if (pe.pointerId === s[5]) {
      let dx = pe.clientX - s[3], dy = pe.clientY - s[4];
      const d = Math.hypot(dx, dy);
      if (d > R) dx *= R / d, dy *= R / d;
      s[0] = dx / R;
      s[1] = dy / R;
      return;
    }
    p[3] = pe.clientX;
    p[4] = pe.clientY;
    p[9] = 1;
  }, on);
  el.addEventListener("pointerdown", (ev) => {
    const pe = ev;
    if (editing(pe.target)) return;
    e.wake();
    measure();
    if (pe.pointerType === "touch" && o.stick && (s[5] < 0 || pe.isPrimary) && (o.stick === "any" || pe.clientX - p[6] < p[8] / 2)) {
      s[2] = 1;
      s[3] = pe.clientX;
      s[4] = pe.clientY;
      s[5] = pe.pointerId;
      s[0] = s[1] = 0;
      return;
    }
    p[3] = pe.clientX;
    p[4] = pe.clientY;
    p[2] = 1;
    p[5] = pe.pointerId;
    pend[N] = 1;
  }, on);
  const up = (ev) => {
    const id = ev.pointerId;
    if (id === s[5]) s[0] = s[1] = s[2] = 0, s[5] = -1;
    if (id === p[5]) p[2] = 0, p[5] = -1;
  };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) addEventListener(t, up, { signal: ctl.signal, capture: true });
  const system = {
    read() {
      const t = e.steps;
      for (let i = 0; i <= N; i++) {
        fresh[i] = pend[i];
        if (pend[i]) at[i] = t, pend[i] = 0;
      }
      if (p[9]) measure();
      p[0] = p[3] - p[6];
      p[1] = p[4] - p[7];
    },
    pause: clear
  };
  e.add(system);
  const dispose = () => {
    ctl.abort();
    e.remove(system);
    clear();
  };
  e.signal.addEventListener("abort", dispose, on);
  return {
    /** An intent's number, for a hot path: `const FIRE = c.id("fire")`, then `c.hit(FIRE)` in a step.
     *  A name that is not an intent throws here, at setup (a typo is never a silent `false`). */
    id(intent) {
      const i = index(intent);
      if (i < 0) throw Error("fizlet/input: no " + intent);
      return i;
    },
    /** Held right now (any of its keys, or press()). */
    down: (intent) => isDown(index(intent)),
    /** Pressed: true in the first step after the press; outside steps, for the frame it latched. */
    hit: (intent) => hit(index(intent)),
    /** -1..1 from two intents (keys), plus the stick when it's active. */
    axis(neg, pos, stickAxis) {
      const k = +isDown(index(pos)) - +isDown(index(neg));
      return k || (stickAxis === void 0 ? 0 : s[stickAxis]);
    },
    pointer: {
      get x() {
        return p[0];
      },
      get y() {
        return p[1];
      },
      get down() {
        return p[2] === 1;
      },
      get hit() {
        return hit(N);
      }
    },
    stick: {
      get x() {
        return s[0];
      },
      get y() {
        return s[1];
      },
      get active() {
        return s[2] === 1;
      }
    },
    /** Press an intent from code (on-screen keys): `press("strike")`. */
    press(intent, down = true) {
      const i = index(intent);
      if (i < 0) return;
      e.wake();
      if (down && !isDown(i)) pend[i] = 1;
      btn[i] = +down;
    },
    /** Drive the stick from code (an on-screen stick, @fzlt/core/pad): x, y in -1..1; `on = false` lets go. */
    steer(x, y, on2 = true) {
      e.wake();
      s[0] = on2 ? x : 0;
      s[1] = on2 ? y : 0;
      s[2] = on2 ? 1 : 0;
    },
    dispose,
    system
  };
}
function gamepad(c, o = {}) {
  const ctl = new AbortController(), on = { signal: ctl.signal };
  const map = o.map ?? {}, names = Object.keys(map), N = names.length, D = o.dead ?? 0.15, only = o.index ?? -1;
  const held = new Uint8Array(N), val = new Float64Array(N);
  const sys = c.system, read = sys.read;
  let count = 0, steering = 0;
  const poll = () => {
    const pads = navigator.getGamepads();
    let x = 0, y = 0, m = D * D;
    val.fill(0);
    for (let k = 0; k < pads.length; k++) {
      const g = pads[k];
      if (!g || !g.connected || only >= 0 && g.index !== only) continue;
      for (let i = 0; i < N; i++) {
        const b = map[names[i]];
        for (let j = 0; j < b.length; j++) {
          const btn = g.buttons[b[j]];
          const v = btn ? btn.value || +btn.pressed : 0;
          if (v > val[i]) val[i] = v;
        }
      }
      const ax = g.axes[0], ay = g.axes[1], d = ax * ax + ay * ay;
      if (d > m) m = d, x = ax, y = ay;
    }
    for (let i = 0; i < N; i++) {
      const v = val[i], d = +(v >= 0.5);
      val[i] = v > D ? (v - D) / (1 - D) : 0;
      if (d !== held[i]) held[i] = d, c.press(names[i], d > 0);
    }
    if (m > D * D) {
      m = Math.sqrt(m);
      const k = Math.min(1, (m - D) / (1 - D)) / m;
      c.steer(x * k, y * k);
      steering = 1;
    } else if (steering) steering = 0, c.steer(0, 0, false);
  };
  const free = () => {
    for (let i = 0; i < N; i++) if (held[i]) held[i] = 0, c.press(names[i], false);
    val.fill(0);
    if (steering) steering = 0, c.steer(0, 0, false);
  };
  const seen = () => {
    count = 0;
    try {
      for (const g of navigator.getGamepads()) if (g && (only < 0 || g.index === only)) count++;
    } catch {
    }
    if (!count) free();
  };
  sys.read = (e) => {
    if (count) poll();
    read(e);
  };
  addEventListener("gamepadconnected", () => (seen(), c.stick.active || c.steer(0, 0, false)), on);
  addEventListener("gamepaddisconnected", seen, on);
  seen();
  return {
    /** A pad is connected (the one at `index`, when given). */
    get connected() {
      return count > 0;
    },
    /** Pads connected (the one at `index` counts as at most 1). */
    get count() {
      return count;
    },
    /** An intent's analog value, 0..1 past the dead zone (a trigger's pull), as of the last read. */
    value: (intent) => val[names.indexOf(intent)] ?? 0,
    /** Stop reading pads: listeners off, polling off, its held intents and the stick let go. */
    stop() {
      ctl.abort();
      sys.read = read;
      count = 0;
      free();
    }
  };
}

export {
  controls,
  gamepad
};
