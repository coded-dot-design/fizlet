/**
 * @fzlt/core/turntable: turn a model with a drag. One angle (`yaw`, radians) that a sideways drag,
 * the arrow keys and Home move, a showcase `spin(secs)` after a change, and, when asked for, a throw
 * that coasts to rest (`friction`) and rests on a step (`snap`). The brick owns the angle and its
 * motion; the game draws with it in `onTurn` (a diorama's `cam.yaw`, a CSS `rotateY`). Lifted from the
 * model viewers two games built by hand: a garage's bike (drag, ← →, Home, a slider's ARIA) and a
 * garage's monster (drag, a spin after each change, none under reduced motion).
 *
 * The contract: the angle moves in the fixed step with no DOM access and no allocation (state in one
 * typed array; reduced motion is latched in `read`); `onTurn` and the ARIA value are written in
 * `render`, only when the angle changed; the engine sleeps at rest; every listener is on the engine's
 * signal and every attribute and style goes through the ledger, so `destroy()` gives the element back.
 * Cosmetic: builtin `Math.exp` (a viewer's angle is drawn, not simulated).
 */
import type { Engine } from "./kernel/engine";
import { need } from "./kernel/need";

/** Options for `turntable()`. */
export interface TurntableOptions {
  /** The angle it starts at and `home()` returns to, radians (default 0). */
  yaw?: number;
  /** Radians per CSS px dragged (default 0.012; negative turns the other way). */
  rate?: number;
  /** Radians per ← or → press (default π/12, 15°; 0: no keys). → turns the way a drag to the right does. */
  key?: number;
  /** How fast a thrown turn slows, per second (default 0: no throw, a release stops where it is). 4 coasts about a second. */
  friction?: number;
  /** Rest only on multiples of this angle from `yaw` (default 0: anywhere). */
  snap?: number;
  /** Easing rate per second of key turns, `home()`, `by()` and the snap (default 10). */
  ease?: number;
  /** Showcase speed of `spin()`, radians per second (default 1.6; negative the other way). */
  spin?: number;
  /** Move (default: yes, unless the visitor prefers reduced motion; then turns jump, nothing coasts and `spin()` does nothing). */
  motion?: boolean;
  /** An accessible name: makes the element a focusable slider (role, tabindex, aria-valuenow 0..359, aria-valuetext "45°"), through the ledger. */
  label?: string;
  /** Called in render when the angle changed (and once at the start): draw here. */
  onTurn?: (yaw: number) => void;
}

// Slots of the state `s`, as literals named in a comment (src/kernel/engine.ts says why): 0 YAW, 1 VEL
// (radians per second), 2 GOAL, 3 MODE (0 rest, 1 held, 2 coast, 3 ease, 4 show), 4 LEFT (seconds of
// show), 5 DRAWN (the angle last handed to onTurn), 6 JUMP (reduced motion, latched), 7 X and 8 T (the
// last drag sample: px and ms), 9 GRIP (the pointer id holding it, −1: none).
const TAU = Math.PI * 2;

/** A turntable on `el`: drag it sideways (pointer capture, one pointer), or focus it and press ← → or
 *  Home. Returns the handle; `yaw` is the angle now. */
export function turntable(engine: Engine, el: HTMLElement | SVGElement, o: TurntableOptions = {}) {
  const yaw0 = need(o.yaw ?? 0, "yaw"), rate = need(o.rate ?? 0.012, "rate"), key = need(o.key ?? Math.PI / 12, "key");
  const friction = need(o.friction ?? 0, "friction"), snap = need(o.snap ?? 0, "snap"), ease = need(o.ease ?? 10, "ease", 1), show = need(o.spin ?? 1.6, "spin");
  const s = new Float64Array(10), L = engine.ledger, onTurn = o.onTurn, label = o.label;
  s[0 /* YAW */] = s[2 /* GOAL */] = yaw0;
  s[5 /* DRAWN */] = NaN;
  s[9 /* GRIP */] = -1;
  const mq = o.motion == null && typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const still = () => (mq ? mq.matches : o.motion === false);

  /** Come to rest from here: on the nearest step when snapping (eased, or at once under reduced motion). No DOM: a step calls it. */
  const settle = () => {
    s[1 /* VEL */] = 0;
    s[3 /* MODE */] = 0;
    if (snap > 0) (s[2 /* GOAL */] = yaw0 + Math.round((s[0 /* YAW */]! - yaw0) / snap) * snap), glide();
  };
  /** Ease to GOAL (or land on it under reduced motion). */
  const glide = () => {
    if (s[6 /* JUMP */]) (s[0 /* YAW */] = s[2 /* GOAL */]!), (s[3 /* MODE */] = 0);
    else s[3 /* MODE */] = s[2 /* GOAL */] === s[0 /* YAW */] ? 0 : 3;
  };
  /** An input arrived: latch reduced motion now (an event may read the DOM; a step may not) and wake a settled engine. */
  const touch = () => ((s[6 /* JUMP */] = +still()), engine.wake());

  const tt = {
    /** The angle now, radians (unbounded: a full turn adds 2π). */
    get yaw() {
      return s[0 /* YAW */]!;
    },
    /** The angle as whole degrees, 0..359. */
    get deg() {
      const d = Math.round(((s[0 /* YAW */]! % TAU) * 360) / TAU) % 360;
      return d < 0 ? d + 360 : d;
    },
    /** Turning by itself (coasting, easing or showing) or held. */
    get moving() {
      return s[3 /* MODE */]! > 0;
    },
    /** Put it at `to` radians at once (no easing, no snap). */
    turn(to: number) {
      if (to - to !== 0) return;
      s[0 /* YAW */] = s[2 /* GOAL */] = to;
      s[1 /* VEL */] = s[3 /* MODE */] = 0;
      touch();
    },
    /** Turn by `d` radians, eased (a key press; presses add up). */
    by(d: number) {
      if (d - d !== 0 || s[3 /* MODE */] === 1) return;
      s[2 /* GOAL */] = (s[3 /* MODE */] === 3 ? s[2 /* GOAL */]! : s[0 /* YAW */]!) + d;
      touch();
      glide();
    },
    /** Back to the start angle, the short way round, eased. */
    home() {
      if (s[3 /* MODE */] === 1) return;
      s[2 /* GOAL */] = yaw0 + Math.round((s[0 /* YAW */]! - yaw0) / TAU) * TAU;
      touch();
      glide();
    },
    /** Show it off: turn at the `spin` speed for `secs` (default 2.4), then rest. Nothing under reduced motion, or while held. */
    spin(secs = 2.4) {
      touch();
      if (s[6 /* JUMP */] || s[3 /* MODE */] === 1 || !(secs > 0)) return;
      s[4 /* LEFT */] = secs;
      s[3 /* MODE */] = 4;
    },
    /** Take hold at screen x (CSS px): stops any motion. The pointer listeners call these three; a game may too. */
    grab(x: number, ms = 0) {
      s[7 /* X */] = x;
      s[8 /* T */] = ms;
      s[1 /* VEL */] = 0;
      s[3 /* MODE */] = 1;
      touch();
    },
    /** Follow the hold to screen x at time `ms` (an event's timeStamp): the angle moves at once. */
    drag(x: number, ms = 0) {
      if (s[3 /* MODE */] !== 1) return;
      const d = (x - s[7 /* X */]!) * rate, dt = (ms - s[8 /* T */]!) / 1000;
      s[0 /* YAW */] = s[0 /* YAW */]! + d;
      // The throw's speed: the drag's, smoothed over a few samples (one late event must not set it).
      if (dt > 0) s[1 /* VEL */] = s[1 /* VEL */]! * 0.5 + (d / dt) * 0.5;
      s[7 /* X */] = x;
      s[8 /* T */] = ms;
      touch();
    },
    /** Let go at time `ms`: coast when thrown (`friction`, motion on, moved in the last 0.1 s), else rest (on a step when snapping). */
    release(ms = 0) {
      if (s[3 /* MODE */] !== 1) return;
      s[9 /* GRIP */] = -1;
      touch();
      if (friction > 0 && !s[6 /* JUMP */] && ms - s[8 /* T */]! < 100 && Math.abs(s[1 /* VEL */]!) > 0.3) s[3 /* MODE */] = 2;
      else settle();
    },
    /** The engine's read phase: latches reduced motion while the angle is held or moving (it may read the DOM; a step may not). */
    read() {
      if (s[3 /* MODE */]) s[6 /* JUMP */] = +still();
    },
    /** The engine's fixed step: moves the angle (a throw, a spin, an eased turn) and keeps the engine awake until it rests. No DOM, no allocation. */
    step(e: Engine, dt: number) {
      const m = s[3 /* MODE */]!;
      if (m < 2) return;
      if (s[6 /* JUMP */]) settle();
      else if (m === 2) {
        s[0 /* YAW */] = s[0 /* YAW */]! + s[1 /* VEL */]! * dt;
        s[1 /* VEL */] = s[1 /* VEL */]! * Math.exp(-friction * dt);
        if (Math.abs(s[1 /* VEL */]!) < 0.05) settle();
      } else if (m === 4) {
        s[0 /* YAW */] = s[0 /* YAW */]! + show * dt;
        if ((s[4 /* LEFT */] = s[4 /* LEFT */]! - dt) <= 0) settle();
      } else {
        const left = s[2 /* GOAL */]! - s[0 /* YAW */]!;
        // Settled within a 20th of a degree: land exactly on the goal.
        if (Math.abs(left) < 1e-3) (s[0 /* YAW */] = s[2 /* GOAL */]!), (s[3 /* MODE */] = 0);
        else s[0 /* YAW */] = s[0 /* YAW */]! + left * (1 - Math.exp(-ease * dt));
      }
      e.busy();
    },
    /** The engine's render phase: only when the angle changed, writes the ARIA value (with `label`) and calls `onTurn(yaw)`. */
    render() {
      const y = s[0 /* YAW */]!;
      if (y === s[5 /* DRAWN */]) return;
      s[5 /* DRAWN */] = y;
      if (label) {
        const d = tt.deg;
        L.attr(el, "aria-valuenow", "" + d);
        L.attr(el, "aria-valuetext", d + "°");
      }
      onTurn?.(y);
    },
  };

  const on = { signal: engine.signal };
  el.addEventListener("pointerdown", (ev) => {
    const e = ev as PointerEvent;
    if (e.button > 0 || s[9 /* GRIP */]! >= 0) return;
    s[9 /* GRIP */] = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    tt.grab(e.clientX, e.timeStamp);
  }, on);
  el.addEventListener("pointermove", (ev) => {
    const e = ev as PointerEvent;
    if (e.pointerId === s[9 /* GRIP */]) tt.drag(e.clientX, e.timeStamp);
  }, on);
  const up = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerId === s[9 /* GRIP */]) tt.release(e.timeStamp);
  };
  el.addEventListener("pointerup", up, on);
  el.addEventListener("pointercancel", up, on);
  if (key)
    el.addEventListener("keydown", (ev) => {
      const k = (ev as KeyboardEvent).key, d = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0;
      if (d) tt.by(d * key * (rate < 0 ? -1 : 1));
      else if (k === "Home") tt.home();
      else return;
      ev.preventDefault();
      ev.stopPropagation();
    }, on);
  // A sideways drag turns it; the page still scrolls up and down under a finger.
  L.style(el, "touch-action", "pan-y");
  if (label) {
    L.attr(el, "role", "slider");
    L.attr(el, "aria-label", label);
    L.attr(el, "aria-valuemin", "0");
    L.attr(el, "aria-valuemax", "359");
    if (!el.hasAttribute("tabindex")) L.attr(el, "tabindex", "0");
  }
  engine.add(tt);
  engine.wake();
  return tt;
}
/** The handle `turntable()` returns. */
export type Turntable = ReturnType<typeof turntable>;
