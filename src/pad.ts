/**
 * @fzlt/core/pad: swappable on-screen controls for touch (and mouse). One move control (an analog
 * stick, a d-pad or move keys) under one thumb and round arcade action keys under the other, all
 * driving `controls` intents through `press()` / `steer()`: game code reads `down`, `hit` and
 * `axis` and never knows which scheme is on screen. Swap with `setScheme()` at any time.
 *
 * The stick drives both axes, or one on a pill track (`axis: "x"`: a steering slider), with a dead
 * zone and a response curve. Action keys sit in a row, or in a corner cluster (`layout: "cluster"`).
 * Visuals are the Board UI kit's (`.bui-pad`, `.bui-stick`, `.bui-dpad`, `.bui-arcade` + roles):
 * mount the pad inside a `.bui` root. Listeners are delegated on the pad's one element (bound to
 * the engine's signal), so a scheme swap adds none; the element goes through the ledger.
 */
import type { Engine } from "./kernel/engine";
import type { Controls } from "./input";
import { hypot } from "./steer";

/** The move control on screen: an analog stick, a one-finger d-pad, or a key per move intent. */
export type Scheme = "stick" | "dpad" | "buttons";
/** Which axes the stick drives: both ("xy", the round stick), or one, on a pill track ("x" steers
 *  left/right, "y" up/down); the other axis stays 0. */
export type Axis = "x" | "y" | "xy";
/** A Board UI kit key role: it sets an action key's colour. */
export type PadRole = "fire" | "aim" | "attack" | "advance" | "fallin" | "sys" | "cmd" | "go" | "flag";

/** One round action key: the intent it drives, its caption and accessible name, its role colour. */
export interface PadAction {
  /** The `controls` intent this key drives. */
  intent: string;
  /** Short caption on the key (e.g. "FIRE"); empty for icon-only. */
  label: string;
  /** Accessible name (default: label), e.g. "Hold to fire the cannon (Space)". */
  name?: string;
  /** Inline SVG markup (trusted game code). */
  icon?: string;
  /** Shortcut chip for fine pointers, e.g. "SPACE". */
  key?: string;
  /** Kit role colour (default: "fire" for the first action, "sys" for the rest). */
  role?: PadRole;
  /** Held while the finger is down (default: a tap = one press, one `hit`). */
  hold?: boolean;
  /** Each tap flips the intent: `down(intent)` is the switch; `press(intent, on)` from code flips the key too. */
  toggle?: boolean;
}

/** Options for `pad()`: the move scheme, the action keys, which thumb gets them and where the pad goes. */
export interface PadOptions {
  /** "stick" (analog, drives the stick axes), "dpad" (one finger, 8-way) or "buttons" (a key per move intent). */
  scheme?: Scheme;
  /** Action keys; the first is the big primary key. */
  actions?: PadAction[];
  /** Which thumb gets the action keys (default "right"); the move control takes the other. */
  side?: "left" | "right";
  /** Where the pad goes (default: the engine root). Must be inside a `.bui` root for the kit look. */
  host?: HTMLElement;
  /** Move intents [up, down, left, right] for the d-pad and move keys; "" leaves one out. */
  move?: string[];
  /** The stick's axes (default "xy", the round stick). "x" or "y" is a one-axis stick on a pill
   *  track: the finger's landing point is centre, so a thumb lands anywhere on it and drags; the
   *  value follows the drag (analog, `dead` and `curve` below) and springs back to 0 on release. */
  axis?: Axis;
  /** Stick dead zone, a fraction of the throw (default 0.15). Past it the value is rescaled from 0. */
  dead?: number;
  /** Stick response exponent past the dead zone (default 1, linear; 1.5 is finer near centre). */
  curve?: number;
  /** Action key layout: "row" (default) or "cluster", the primary key in the corner and up to three
   *  more on an arc around it (a console's face buttons), every key in a thumb's reach. */
  layout?: "row" | "cluster";
}

// Dead zones, literals named in a comment (src/kernel/engine.ts says why): stick 0.15 DEAD, d-pad 0.25 DPAD_DEAD.
const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5l5-5 5 5"/></svg>'; // the kit turns it per direction
const DIRS = ["Up", "Down", "Left", "Right"];

/** Stick vector from a drag offset in radii: clamped to the unit circle, dead zone rescaled so a
 *  light push still creeps (Battlefield's feel). Writes out[0], out[1]; never allocates
 *  (the exact `hypot` from @fzlt/core/steer: `Math.hypot` boxes its arguments, K5). */
export function stickAt(dx: number, dy: number, out: Float64Array, dead = 0.15 /* DEAD */, curve = 1) {
  const d = hypot(dx, dy), k = d < dead ? 0 : ((Math.min(1, d) - dead) / (1 - dead)) ** curve / d;
  out[0] = dx * k;
  out[1] = dy * k;
}

/** One-axis stick value from a drag offset in throws: 0 inside the dead zone, then rescaled from 0
 *  and shaped by `curve`, clamped to -1..1 (the pill stick, `axis: "x"` or `"y"`). Never allocates. */
export function axisAt(d: number, dead = 0.15 /* DEAD */, curve = 1) {
  const m = Math.abs(d);
  return m < dead ? 0 : Math.sign(d) * ((Math.min(1, m) - dead) / (1 - dead)) ** curve;
}

/** D-pad direction mask (up 1, down 2, left 4, right 8; diagonals combine) from a drag offset in radii. */
export function dpadAt(dx: number, dy: number) {
  // Eight equal 45° sectors: an axis counts once the direction is more than 22.5° off its normal.
  const d = hypot(dx, dy), t = d * 0.3827;
  return d < 0.25 /* DPAD_DEAD */ ? 0 : (dy < -t ? 1 : dy > t ? 2 : 0) | (dx < -t ? 4 : dx > t ? 8 : 0);
}

const stick = (a: Axis) =>
  `<div class="bui-stick" data-axis="${a}" role="application" aria-label="Move: drag ${a === "x" ? "left or right" : a === "y" ? "up or down" : "in any direction"}"><i class="bui-knob"></i></div>`;
const arrows = (move: string[]) =>
  move.map((m, d) => (m ? `<button type="button" class="bui-arcade bui-sys" data-d="${d}" aria-label="${DIRS[d]}">${ARROW}</button>` : "")).join("");

// Labels, names and keys are text (escaped); `icon` is trusted SVG markup supplied by the game.
const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** On-screen controls for touch (and mouse) that drive the intents of `c` (a `controls()` controller):
 *  a move control and action keys, in the Board UI kit's look. Swap the move control with
 *  `setScheme()`; `destroy()` (or the engine's) removes the pad. */
export function pad(e: Engine, c: Controls, o: PadOptions = {}) {
  const acts = o.actions ?? [], move = o.move ?? ["up", "down", "left", "right"];
  const ctl = new AbortController(), on = { signal: ctl.signal };
  e.signal.addEventListener("abort", () => ctl.abort(), on);
  const el = e.ledger.add(document.createElement("div"));
  el.className = "bui-pad";
  el.dataset.hand = o.side ?? "right";
  el.dataset.layout = o.layout ?? "row";
  el.setAttribute("data-fizlet-ignore", ""); // the field stick and pointer never see pad touches
  // Labels, names and icons are game code (trusted), like any markup the game writes.
  el.innerHTML = `<div class="bui-pad-move"></div><div class="bui-pad-keys">${acts
    .map((a, i) => `<button type="button" class="bui-arcade bui-${(a.role ?? (i ? "sys" : "fire")).replace(/[^a-z-]/g, "")}${i ? "" : " bui-primary"}" data-i="${i}" aria-label="${esc(a.name ?? a.label)}"${a.toggle ? ' aria-pressed="false"' : ""}>${a.icon ?? ""}${a.label ? `<small>${esc(a.label)}</small>` : ""}${a.key ? `<kbd>${esc(a.key)}</kbd>` : ""}</button>`)
    .join("")}</div>`;
  const moveEl = el.firstChild as HTMLElement, kb = (el.lastChild as HTMLElement).children as HTMLCollectionOf<HTMLElement>;
  // Move keys (d-pad arrows or move keys) by direction; the knob when the stick is on.
  const lit = new Uint8Array(acts.length);
  let dk: HTMLElement[] = [], knob: HTMLElement | null = null, mask = 0, scheme: Scheme | "" = "", axis: Axis = o.axis ?? "xy";
  const dead = o.dead ?? 0.15 /* DEAD */, curve = o.curve ?? 1;
  // Move control: centre x, y, radius (read once per touch start), knob offset wanted (3, 4) and
  // drawn (5, 6), and the pointer id holding it (7). The stick vector goes through v.
  const g = new Float64Array(9), v = new Float64Array(2);
  let pk: Element | null = null; // the key the last pointer pressed (its click is not a second tap)
  g[7] = -1;

  const paint = (i: number, now: boolean) => {
    lit[i] = now ? 1 : 0;
    kb[i]!.setAttribute("aria-pressed", String(now)); // in the handler: a key repainted a frame late bounces
  };
  // A tap: a toggle flips, a hold key holds (pointer), anything else presses once (one hit).
  const tap = (i: number, hold: boolean) => {
    const a = acts[i]!;
    if (a.toggle) return paint(i, (c.press(a.intent, !c.down(a.intent)), c.down(a.intent)));
    c.press(a.intent);
    if (!(hold && a.hold)) c.press(a.intent, false);
  };
  const dir = (m: number) => {
    for (let d = 0, b = 1; d < 4; d++, b <<= 1)
      if ((m ^ mask) & b && move[d]) c.press(move[d]!, (m & b) > 0), dk[d]?.classList.toggle("down", (m & b) > 0);
    mask = m;
  };
  const drag = (ev: PointerEvent) => {
    const dx = (ev.clientX - g[0]!) / g[2]!, dy = (ev.clientY - g[1]!) / g[2]!;
    if (!knob) return dir(dpadAt(dx, dy));
    if (axis !== "xy") {
      // One axis: the other is ignored; the knob slides along the track, clamped to its throw.
      const x = axis === "x", a = x ? dx : dy, s = axisAt(a, dead, curve), m = Math.max(-1, Math.min(1, a)) * g[2]!;
      c.steer(x ? s : 0, x ? 0 : s);
      g[3] = x ? m : 0;
      g[4] = x ? 0 : m;
      return;
    }
    stickAt(dx, dy, v, dead, curve);
    c.steer(v[0]!, v[1]!);
    const k = g[2]! / Math.max(1, hypot(dx, dy));
    g[3] = dx * k;
    g[4] = dy * k;
  };
  const letGo = (t: HTMLElement) => {
    const i = t.dataset.i, d = t.dataset.d;
    t.classList.remove("down");
    if (i) acts[+i]!.hold && c.press(acts[+i]!.intent, false);
    else if (d) c.press(move[+d]!, false);
    else if (((g[7] = -1), knob)) c.steer(0, 0, false), (g[3] = g[4] = 0);
    else dir(0);
  };
  const release = () => el.querySelectorAll<HTMLElement>(".down").forEach(letGo);

  // One delegated handler for every pointer event. Pointer capture sends each finger's events to
  // the element it pressed, so that element's `.down` is all the state a key needs (multi-touch).
  const handle = (ev: Event) => {
    const p = ev as PointerEvent, at = p.target as Element, key = at.closest<HTMLElement>("[data-i],[data-d]");
    const mv = at.closest<HTMLElement>(".bui-stick,.bui-dpad"), t = mv ?? key, i = key?.dataset.i, d = key?.dataset.d;
    if (!t) return;
    if (p.type === "click") {
      // Keyboard (Enter / Space on a focused key) is a tap; pointer clicks already acted on down.
      // Some browsers report a touch tap's click with detail 0 too, so a click on the key a pointer
      // just pressed is never a second tap.
      if (key && key === pk && p.timeStamp - g[8]! < 1000) return void (pk = null);
      if (!p.detail && key) i ? tap(+i, false) : (c.press(move[+d!]!), c.press(move[+d!]!, false));
    } else if (p.type === "pointerdown") {
      if (p.button > 0) return;
      pk = key;
      g[8] = p.timeStamp;
      p.preventDefault(); // no focus steal, no text selection, no emulated mouse
      try {
        t.setPointerCapture(p.pointerId);
      } catch {} // a synthetic or finished pointer can't be captured; the press still counts
      if (i && acts[+i]!.toggle) return tap(+i, true);
      t.classList.add("down");
      if (!mv) return i ? tap(+i, true) : c.press(move[+d!]!);
      // A new finger on the move control takes it (a release the browser dropped never blocks it).
      g[7] = p.pointerId;
      const r = t.getBoundingClientRect(); // one layout read per touch start, never in a step
      const one = knob && axis !== "xy";
      // A pill centres on the finger's landing point; its throw is the knob's travel along the track.
      g[0] = one ? p.clientX : r.left + r.width / 2;
      g[1] = one ? p.clientY : r.top + r.height / 2;
      g[2] = Math.max(1, one ? Math.abs(r.width - r.height) / 2 : r.width * (knob ? 0.36 : 0.5));
      drag(p);
    } else if (p.type === "pointermove") {
      if (mv && p.pointerId === g[7]) drag(p);
    } else if (mv ? p.pointerId === g[7] : t.classList.contains("down")) letGo(t);
  };
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture", "click"]) el.addEventListener(type, handle, on);

  const system = e.add({
    render() {
      if (knob && (g[3] !== g[5] || g[4] !== g[6])) {
        g[5] = g[3]!;
        g[6] = g[4]!;
        knob.style.translate = g[3] || g[4] ? `${g[3]!.toFixed(1)}px ${g[4]!.toFixed(1)}px` : "";
      }
      // Toggles follow the intent, so a press(intent, on) from game code repaints its key.
      for (let i = 0; i < acts.length; i++) if (acts[i]!.toggle && c.down(acts[i]!.intent) !== (lit[i] === 1)) paint(i, !lit[i]);
    },
  });

  /** Swap the move control (and, for the stick, its axes; left out, they stay). Fingers on the old
   *  one let go first; listeners stay as they are. */
  const setScheme = (s: Scheme, a: Axis = axis) => {
    if (s === scheme && a === axis) return;
    release();
    scheme = el.dataset.scheme = s;
    axis = a;
    g[3] = g[4] = g[5] = g[6] = 0;
    moveEl.innerHTML = s === "stick" ? stick(a) : s === "dpad" ? `<div class="bui-dpad" role="group" aria-label="Move">${arrows(move)}</div>` : arrows(move);
    knob = moveEl.querySelector("i");
    dk = [];
    moveEl.querySelectorAll<HTMLElement>("[data-d]").forEach((b) => (dk[+b.dataset.d!] = b));
  };
  setScheme(o.scheme ?? "stick");
  (o.host ?? (e.root as HTMLElement)).append(el);

  return {
    /** The pad's root element (`.bui-pad`). */
    el,
    get scheme() {
      return scheme as Scheme;
    },
    /** The stick's axes ("xy", "x" or "y"). */
    get axis() {
      return axis;
    },
    setScheme,
    /** Let go of every finger, remove the listeners and the pad (engine.destroy() does this too). */
    destroy() {
      release();
      ctl.abort();
      e.remove(system);
      el.remove();
    },
  };
}
/** The pad `pad()` returns. */
export type Pad = ReturnType<typeof pad>;
