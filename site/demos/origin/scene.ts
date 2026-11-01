/**
 * Origin: Code. Sleep. Drink. Repeat. A desk at night, seen from above: he sleeps with his head on
 * the desk. The sun comes up, he wakes, puts the headphones on (♪, the beat), drinks his coffee
 * (steam, the sip) and codes all day on the laptop and the phone. Night falls, he closes the laptop
 * and sleeps. Repeat. Design mode swaps the screens' code for design work (shapes, swatches, a grid).
 * Close the laptop (tap it, or Enter on it) and he goes to sleep; open it and the day starts.
 * Two looks on one scene: "2015" (the portfolio's flat palette) and "Fizlet" (the default:
 * cyberpunk × Tron in the Board UI tokens). The look key switches them.
 *
 * The cup is a toy: tap it and he sips; double-tap it and it refills (a pour, then steam); drag it
 * and it lifts (its shadow grows) and goes down anywhere on the desk; flick it and it knocks over
 * and spills. Tap the spill, or wait, and it rights itself, refilled. Keys on the cup: Enter sips,
 * R refills, the arrows move it (K knocks it over). Every press squashes and pops on the next frame.
 *
 * Bricks, each on a part you can see: the kernel (one loop, 30 fps cap, settle, the ledger),
 * @fzlt/core/timeline (the day/night cycle on CSS custom properties; the wake/sleep, sip, pour and
 * spill sequences on typed arrays), @fzlt/core/fx (notes, steam, code sparks, the splash, the Zzz),
 * @fzlt/core/sound (the beat, key clicks, the sip, taps, the pour, the spill; silent until a gesture,
 * mute key), @fzlt/core/input (the pointer: taps, the drag, the flick; the lid key),
 * @fzlt/core/sprite (the pixel coder on the phone). "Show bricks" labels each part with its brick and
 * its gzip bytes (scripts/sizes.mjs, put in by the build).
 *
 * Rules: off screen or in a hidden tab the kernel pauses it; pause() rests it at 0 frames; reduced
 * motion gets still frames (lighting crossfades in CSS, no particles, no typing; the cup's toys
 * change state with no animation); the step never allocates; every change to the host goes through
 * the ledger, so destroy() gives the root back.
 */
import { createEngine } from "../../../src/kernel/index";
import { timeline } from "../../../src/timeline";
import { effects, emitter } from "../../../src/fx";
import { sound } from "../../../src/sound";
import { controls } from "../../../src/input";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import type { SlotMount, SlotScene } from "../../../src/slot";
import { ORIGIN_WHY, ORIGIN_WHY_BEATS, ORIGIN_CREDIT, ORIGIN_LOOKS } from "./copy";
import { why, art, CSS, BOX, C, VB, DESK, CUP, SH, head, headT, hands, neck, arm, reach, carry, cupT, cupShT, LIQUID, brew, phonesT, band, cord, screenT, coverT, sqT, type OriginLook } from "./art";

export type { OriginLook } from "./art";
declare const __ORIGIN_BRICKS__: Record<string, number> | undefined;
/** Brick → gzip bytes, measured by the build (scripts/sizes.mjs); empty when bundled elsewhere. */
const BRICKS: Record<string, number> = typeof __ORIGIN_BRICKS__ === "object" ? __ORIGIN_BRICKS__ : {};

export type OriginMode = "code" | "design";
export interface OriginOptions {
  /** What the screens show (default "code"). */
  mode?: OriginMode;
  /** The look: "fizlet" (default: the Board UI tokens, cyberpunk × Tron) or "2015" (the portfolio's). */
  look?: OriginLook;
  /** Sound armed (default true): still silent until the visitor's first gesture. */
  sound?: boolean;
  /** Label every moving part with its brick and size (default false). */
  showBricks?: boolean;
  /** Calm version (default: the visitor's prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** The scene's own key row: look, mode, bricks, sound, pause (default true). */
  controls?: boolean;
  /** Clock speed (default 1; tests run it faster). One day is 24 s. */
  speed?: number;
  /** URL of the 2015 coffee sheet (default: coffee.png next to this chunk). */
  cup?: string;
  /** Brick sizes for the labels (default: the build's measured numbers). */
  bricks?: Record<string, number>;
}
export interface OriginState {
  mode: OriginMode;
  look: OriginLook;
  /** The laptop is open (day) or closed (night, asleep). */
  open: boolean;
  bricks: boolean;
  sound: boolean;
  paused: boolean;
  /** He is awake (head up). */
  awake: boolean;
}
export interface OriginScene extends SlotScene {
  setMode(mode: OriginMode): void;
  setLook(look: OriginLook): void;
  setShowBricks(on: boolean): void;
  setSound(on: boolean): void;
  /** Open (day, he wakes) or close (night, he sleeps) the laptop. */
  setLaptop(open: boolean): void;
  /** Rest: every clock stops, the kernel settles (0 frames a second). */
  pause(): void;
  play(): void;
  readonly state: OriginState;
  /** He drinks (when awake and the cup is in reach). */
  sip(): void;
  /** Refill the cup (a pour, then steam). Spilled: it rights itself first. */
  refill(): void;
  /** Knock the cup over (it spills); `angle` is the way it falls, in radians (default: right). */
  knock(angle?: number): void;
  /** Nudge him awake (when asleep). */
  nudge(): void;
  /** Live particles and Zs so far; the cup (its top left in art units, its level, spilled); `toys`:
   *  how many of the cup's own motions are still running (0 once they have all settled). */
  stats(): { particles: number; zzz: number; cup: { x: number; y: number; level: number; spilled: boolean; lifted: boolean }; toys: number };
}

// The day, in seconds of a 24 s loop (one second an hour).
const DAY = 24, DAWN = 2.4, WAKE = 4.2, NOON = 9, DUSK = 15.4, SLEEP = 19.2, REST = 21.2;
// Pose slots (the wake and sip timelines write these): awake, headphones on, lid open, hands on keys, sip.
const AW = 0, PH = 1, LID = 2, HD = 3, SIP = 4;
// fx colours, by role: steam, note, note, spark, ink, white, coffee, coffee light. The look swaps them.
const COLORS = [C.cream, C.red, C.sun, C.tealL, C.ink, "#ffffff", "#5a3526", "#b98a66"];
const FZ_TOKENS: [string, string][] = [["--k-flag", "#f6f3ff"], ["--k-attack", "#ff2e88"], ["--k-sys", "#19f0ff"], ["--k-go", "#39ffb0"], ["--k-cmd", "#9a63ff"], ["--k-flag", "#f6f3ff"], ["--k-advance", "#ff8a1f"], ["--hurt", "#ffc21a"]];
const WORDS = ["♪", "♫", "z", "Z", "{ }", "</>", ";", "=>", "#"];
const WORD = 4; // fx's word-shaped part
// The parts a press can land on (squash slots too).
const CUPP = 1, LAP = 2, PHONE = 3, PHONES = 4, PERSON = 5, SPILLP = 6;
// What the status line says (polite): an index, set in the step, written in render.
const SAY = ["", "Sip.", "Refilling the cup.", "Refilled: hot coffee.", "Knocked over! Tap the spill, or wait: it rights itself.", "Back up. Refilling.", "Picked up the cup.", "Cup set down.", "Back on the saucer.", "He is asleep. Tap him to wake him.", "Out of his reach: move the cup closer.", "Cup moved.", "Fizlet look.", "2015 look.", "Nearly empty: double-tap or press R to refill."];
const FLICK = 1300; // CSS px/s at release: faster than this knocks it over
let uid = 0; // each mount's own SVG ids (a poster or a second scene on the page has its own)

// The pixel coder on the phone (@fzlt/core/sprite): two dance frames and one asleep.
const PIX: SpriteDef = {
  frames: [
    ["...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".csessssesc.", "..ssssssss..", "..sssmmsss..", "...ssssss...", "..rrrrrrrr..", ".srrrrrrrrs.", ".srrrrrrrrs.", "..rrrrrrrr..", "..bb....bb.."],
    ["...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".csessssesc.", "..ssssssss..", "..sssmmsss..", "s..ssssss..s", "srrrrrrrrrrs", "..rrrrrrrr..", "..rrrrrrrr..", "..rrrrrrrr..", "...bb..bb..."],
    ["............", "...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".cskssssksc.", "..ssssssss..", "...ssssss...", "..rrrrrrrr..", ".srrrrrrrrs.", ".srrrrrrrrs.", "..rrrrrrrr..", "..bb....bb.."],
  ],
  colors: { h: C.ink, s: C.skin, e: C.ink, k: C.inkL, c: C.cream, m: C.red, r: C.red, b: C.ink },
};
const hex = (s: string, f: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim()) ?? /^#([0-9a-f]{6})$/i.exec(f)!;
  return [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16));
};
const tint = (a: number[], t: number) => a.map((v) => Math.round(v + (246 - v) * t));

/** Mount the scene into `root` (it fills it: give the root a size; 16:10 is the shape it is drawn
 *  for, and it crops to any other around the middle). Returns the scene's controls. */
export function mount(root: HTMLElement, o: OriginOptions = {}): OriginScene {
  const reduce = o.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const speed = o.speed ?? 1;
  const engine = createEngine({ root, fps: 30, settle: 0.4 });
  const L = engine.ledger, rand = engine.random;
  let mode: OriginMode = o.mode ?? "code", look: OriginLook = o.look === "2015" ? "2015" : "fizlet", tags = !!o.showBricks, paused = false, music = true;

  // ---------- DOM: one wrapper (the ledger removes it), the art, the fx canvas, the key row ----------
  if (getComputedStyle(root).position === "static") L.style(root, "position", "relative");
  const wrap = L.add(document.createElement("div"));
  const cls = () => `og${look === "fizlet" ? " og--fz" : ""}${reduce ? " og--reduce" : ""}${tags ? " og--tags" : ""}`;
  wrap.className = cls();
  const cup = o.cup ?? new URL("coffee.png", import.meta.url).href;
  wrap.innerHTML = `<style>${CSS}</style><div class="og-l">${art({ aw: 0, ph: 0, lid: 0, hd: 0 }, mode, cup, o.bricks ?? BRICKS, `og${++uid}-`)}<canvas></canvas><div class="og-grip" role="button" tabindex="0" aria-label="The coffee cup: Enter sips, R refills, the arrow keys move it, K knocks it over" aria-keyshortcuts="Enter R K ArrowLeft ArrowRight ArrowUp ArrowDown"></div></div>${why(ORIGIN_WHY, reduce ? ORIGIN_WHY : ORIGIN_WHY_BEATS[0]!, reduce ? "WHY" : "1/4", ORIGIN_CREDIT)}<p class="og-vh" role="status" aria-live="polite"></p>` +
    (o.controls === false ? "" : `<div class="og-bar"><button type="button" data-k="look" aria-pressed="false" aria-label="Fizlet look"><span>${ORIGIN_LOOKS["2015"]}</span><span>${ORIGIN_LOOKS.fizlet}</span></button><button type="button" data-k="mode" aria-pressed="false">Design<span class="og-lg">&nbsp;mode</span></button><button type="button" data-k="tags" aria-pressed="false"><span class="og-lg">Show&nbsp;</span>bricks</button><button type="button" data-k="sound" aria-pressed="true">Sound</button><button type="button" data-k="pause" aria-pressed="false">Pause</button></div>`);
  root.append(wrap);
  const layer = wrap.querySelector<HTMLElement>(".og-l")!, svg = layer.querySelector("svg")!, cv = layer.querySelector("canvas")!, grip = layer.querySelector<HTMLElement>(".og-grip")!;
  const status = wrap.querySelector<HTMLElement>("[role=status]")!;
  const q = <T extends Element = SVGElement>(s: string) => svg.querySelector<T>(s)!;
  const qa = (s: string) => [...svg.querySelectorAll<SVGElement>(s)];
  const neckEl = q(".og-neck"), napeEl = q(".og-nape"), headEl = q(".og-head"), phonesEl = q(".og-phones"), bandEls = qa(".og-band"), cordEl = q(".og-cord"), cupEl = q(".og-cup"), cupImg = q(".og-cupimg"), liquid = q(".og-liquid"), body = q(".og-body");
  const cupSh = q(".og-cupsh"), upEl = q(".og-up"), upG = q(".og-upg"), tipEl = q(".og-tip"), pudEl = q(".og-pud"), potEl = q(".og-pot"), potB = q(".og-potb"), stream = q(".og-stream"), sqp = q(".og-sqp");
  const arms = [-1, 1].map((s) => { const g = q(s < 0 ? ".og-arm-l" : ".og-arm-r"); return { s, ua: g.querySelector(".og-ua")!, fa: g.querySelector(".og-fa")!, fm: g.querySelector(".og-fm")!, sl: g.querySelector(".og-sl")!, hd: g.querySelector(s < 0 ? ".og-hand-l" : ".og-hand-r")! }; });
  const screen = q(".og-screen"), cover = q(".og-cover"), scrl = q(".og-scrl"), laptop = q(".og-laptop");
  const scroll = q(".og-scroll"), caret = q(".og-caret"), arrow = q(".og-arrow"), sel = q(".og-sel"), shape = q(".og-shape");
  const pix = q(".og-pix"), codeEls = qa(".og-code"), desEls = qa(".og-des");
  const keyEl = (k: string) => wrap.querySelector<HTMLButtonElement>(`.og-bar [data-k=${k}]`);
  const lookKey = keyEl("look"), modeKey = keyEl("mode"), tagsKey = keyEl("tags"), soundKey = keyEl("sound"), pauseKey = keyEl("pause");
  const ctx = cv.getContext("2d")!;
  const beatEl = wrap.querySelector<HTMLElement>(".og-beat")!, stepEl = wrap.querySelector<HTMLElement>(".og-why b")!;
  const pixURL = [0, 1, 2].map((f) => spriteURL(PIX, f));

  // ---------- the stage's shape: crop the art around the middle; the canvas follows ----------
  // k: CSS px per art unit; vx, vy: the art's top left on screen; W, H; w, h in art units.
  const view = new Float64Array(7);
  let resized = true;
  const ro = new ResizeObserver(() => ((resized = true), engine.wake()));
  ro.observe(wrap);
  engine.signal.addEventListener("abort", () => ro.disconnect());
  function fit() {
    const W = wrap.clientWidth || 1, H = wrap.clientHeight || 1, a = W / H;
    // Keep x 140..660 and y 0..500 in view; past 16:9 crop the window and the person a little.
    let w = a >= 1.04 ? Math.min(VB.h * a, 900) : 520, h = w / a;
    if (a > 1.8) (w = 800 + (a - 1.8) * 50), (h = w / a);
    const vx = 400 - w / 2, vy = 250 - h / 2 + (a < 1 ? 30 : 0);
    svg.setAttribute("viewBox", `${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    view[0] = W / w, view[1] = vx, view[2] = vy, view[3] = W, view[4] = H, view[5] = w, view[6] = h;
    ctx.setTransform(view[0]! * dpr, 0, 0, view[0]! * dpr, -vx * view[0]! * dpr, -vy * view[0]! * dpr);
  }

  // ---------- fx: one pool on one canvas; the look picks its colours ----------
  const fx = effects({ cap: 220, colors: COLORS.slice(), words: WORDS, scorch: 0 });
  const { ids: { puff, chip, bub, splash }, emit } = emitter(fx, {
    puff: { shape: "disc", drag: 0.7, gravity: 0, angle: -1.5708, spread: 0.6, speed: [12, 24], size: [3, 6], life: [1.3, 2.1] },
    chip: { shape: "square", drag: 1.6, gravity: 0, angle: -1.5708, spread: 1.4, speed: [30, 70], size: [3, 5], life: [0.6, 1] },
    bub: { shape: "ring", drag: 3, gravity: 0, angle: -1.5708, spread: 6.28, speed: [1, 5], size: [1.2, 2.4], life: [0.35, 0.8] },
    splash: { shape: "square", drag: 2.4, gravity: 0, angle: 0, spread: 6.28, speed: [30, 80], size: [1.5, 3], life: [0.3, 0.6] },
  });
  // The Fizlet look's coffee (and matcha): hot and cooled, from the tokens.
  let FZB: number[][][] = [];
  function paint() {
    const cs = getComputedStyle(wrap), tok = FZ_TOKENS.map(([n, f]) => hex(cs.getPropertyValue(n), f));
    for (let i = 0; i < COLORS.length; i++) fx.colors[i] = look === "fizlet" ? `rgb(${tok[i]!.join(",")})` : COLORS[i]!;
    FZB = [[tok[6]!, tint(tok[6]!, 0.5)], [tok[3]!, tint(tok[3]!, 0.5)]];
  }
  paint();

  // ---------- sound: events → cues (silent until a gesture; the Sound key mutes) ----------
  const snd = sound(engine, {
    cues: { beat: "kick", key: "tick", slurp: "slurp", clink: "clink", wake: "yawn", sleep: "end", nudge: "nudge", tap: "pop", pour: "pour", spill: "spill", set: "clink", lift: "tick" }, on: o.sound ?? true, volume: 0.3,
    notes: {
      kick: [[150, 48, 0.2, 0, "sine", 0.9], [2400, 1800, 0.03, 0, "square", 0.04]],
      tick: [[2200, 1500, 0.018, 0, "square", 0.12]],
      slurp: [[260, 820, 0.16, 0, "sawtooth", 0.16], [820, 420, 0.12, 0.15, "triangle", 0.2], [500, 700, 0.08, 0.3, "sawtooth", 0.1]],
      clink: [[2600, 2500, 0.12, 0, "triangle", 0.4], [3900, 3800, 0.08, 0.01, "sine", 0.25]],
      yawn: [[380, 240, 0.55, 0, "sine", 0.5], [240, 300, 0.5, 0.5, "triangle", 0.35]],
      nudge: [[300, 200, 0.1, 0, "triangle", 0.5]],
      pop: [[520, 900, 0.05, 0, "triangle", 0.35]],
      pour: [[300, 620, 0.22, 0, "sine", 0.3], [420, 760, 0.2, 0.2, "sine", 0.25], [520, 940, 0.2, 0.4, "sine", 0.2], [640, 1100, 0.18, 0.6, "sine", 0.16]],
      spill: [[620, 110, 0.32, 0, "sawtooth", 0.22], [2600, 900, 0.1, 0, "square", 0.06], [2600, 2500, 0.1, 0.05, "triangle", 0.3]],
    },
  });

  // ---------- input: the pointer (taps, the drag, the flick), the lid key, the cup's keys ----------
  const ctl = controls(engine, { keys: { lid: [], sip: [], music: [], nudge: [], refill: [], knock: [] }, target: layer });
  const LIDK = ctl.id("lid"), SIPK = ctl.id("sip"), MUSK = ctl.id("music"), NUDK = ctl.id("nudge"), REFK = ctl.id("refill"), KNKK = ctl.id("knock");
  const tap = (k: string) => (ctl.press(k), ctl.press(k, false));
  const enter = (el: Element, k: string) => el.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter" && (ev as KeyboardEvent).key !== " ") return;
    ev.preventDefault();
    tap(k);
  }, { signal: engine.signal });
  enter(body, "nudge");
  enter(laptop, "lid");
  // The cup's keys: Enter (or Space) sips, R refills, K knocks it over, the arrows move it.
  const MV = new Float64Array(2);
  const ARROWS: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  grip.addEventListener("keydown", (ev) => {
    const k = (ev as KeyboardEvent).key, a = ARROWS[k];
    if (k === "Enter" || k === " ") tap("sip");
    else if (k === "r" || k === "R") tap("refill");
    else if (k === "k" || k === "K") tap("knock");
    else if (a) (MV[0]! += a[0]! * 18), (MV[1]! += a[1]! * 18), engine.wake();
    else return;
    ev.preventDefault();
  }, { signal: engine.signal });
  // A drag keeps the pointer while it leaves the stage.
  grip.addEventListener("pointerdown", (ev) => grip.setPointerCapture?.((ev as PointerEvent).pointerId), { signal: engine.signal });

  // ---------- timelines ----------
  // The day: lighting as custom properties on the wrapper (sky, night shade, lamp, sun, window light).
  const day = timeline(engine, { repeat: Infinity, motion: true, rate: speed });
  const SKY = { night: "rgb(29,27,52)", dawn: "rgb(243,166,131)", day: "rgb(158,214,224)", dusk: "rgb(236,140,104)" };
  const io = { ease: "inOut" } as const;
  day.to(wrap, { "--sky": [SKY.night, SKY.dawn] }, { at: DAWN, dur: 1.4, ...io }).to(wrap, { "--sky": SKY.day }, { at: DAWN + 1.4, dur: 1.4, ...io })
    .to(wrap, { "--sky": SKY.dusk }, { at: DUSK - 0.4, dur: 1.6, ...io }).to(wrap, { "--sky": SKY.night }, { at: DUSK + 1.2, dur: 1.8, ...io })
    .to(wrap, { "--night": ["0.62", "0"] }, { at: DAWN + 0.2, dur: 2.4, ...io }).to(wrap, { "--night": "0.62" }, { at: DUSK, dur: 3, ...io })
    .to(wrap, { "--sun": ["0", "1"] }, { at: DAWN + 0.6, dur: DUSK + 1.6 - DAWN, ease: "linear" })
    .to(wrap, { "--beam": ["0", "1"] }, { at: WAKE, dur: 2, ...io }).to(wrap, { "--beam": "0" }, { at: DUSK - 1, dur: 2, ...io })
    .to(wrap, { "--lamp": ["0", "1"] }, { at: DUSK + 0.8, dur: 0.3 }).to(wrap, { "--lamp": "0" }, { at: SLEEP + 1.2, dur: 0.3 })
    .to(new Float64Array(1), { 0: [0, 1] }, { at: DAY - 0.01, dur: 0.01 }) // the day is 24 s long
    .label("dawn", DAWN).label("wake", WAKE).label("sip", WAKE + 1.6).label("sip", 12.5).label("sleep", SLEEP);
  // Wake (reversed: sleep): head up, headphones on, the lid opens, hands to the keys.
  const P = new Float64Array(5);
  const wake = timeline(engine, { rate: speed, motion: true })
    .to(P, { [AW]: [0, 1] }, { at: 0, dur: 0.9, ...io }).to(P, { [PH]: [0, 1] }, { at: 0.7, dur: 1, ...io })
    .to(P, { [LID]: [0, 1] }, { at: 1.4, dur: 0.7 }).to(P, { [HD]: [0, 1] }, { at: 1.9, dur: 0.5, ...io });
  // The sip: the hand reaches the cup, brings it to his mouth, a slurp, back.
  const sip = timeline(engine, { rate: speed, motion: true }).to(P, { [SIP]: [0, 1, 1, 0] }, { dur: 2.4, ...io }).label("slurp", 1.1).label("clink", 2.3);
  // The pour (refill): the pot slides in, pours, slides out. PR: pot in, stream.
  const PR = new Float64Array(2);
  const pour = timeline(engine, { motion: true, id: 7 })
    .to(PR, { 0: [0, 1] }, { at: 0, dur: 0.35 }).to(PR, { 1: [0, 1] }, { at: 0.3, dur: 0.12 })
    .to(PR, { 1: 0 }, { at: 1.25, dur: 0.15 }).to(PR, { 0: 0 }, { at: 1.35, dur: 0.35, ease: "in" }).label("pour", 0.3).label("full", 1.3);
  // The spill: the cup tips (a little overshoot), the puddle spreads. Reversed: it rights itself.
  const SPL = new Float64Array(2);
  const spill = timeline(engine, { motion: true, id: 8 }).to(SPL, { 0: [0, 1] }, { dur: 0.3, ease: "back" }).to(SPL, { 1: [0, 1] }, { at: 0.12, dur: 0.9 });

  // ---------- state ----------
  // N: clocks and counters (typed: the step writes them every frame without boxing).
  const N = new Float64Array(16);
  const BEAT = 0, BEATS = 1, KEY = 2, STEAM = 3, ZZZ = 4, LEVEL = 5, SCROLL = 6, DES = 7, HOLD = 8, CLOCK = 9, WDIR = 10, TYPE = 11, HEAT = 12, STIR = 13, ZN = 14, ZC = 15;
  N[LEVEL] = 0.15;
  const T = new Float64Array(2); // typing offsets for the two hands
  // Q: the cup and the pointer. The cup's top left (art units), its lift and target, the part under
  // the pointer, dragging, the press point, the grab offset, velocity (art units/s), the last move,
  // the clock, the last tap, spilled, the spill timer, the fall angle, the slide, righting, the line to say.
  const Q = new Float64Array(24);
  const CX = 0, CY = 1, LIFT = 2, LIFTT = 3, GRAB = 4, DRAG = 5, SX = 6, SY = 7, OX = 8, OY = 9, VX = 10, VY = 11, PX = 12, PY = 13, PT = 14, CLK = 15, TAPT = 16, SPILL = 17, SPT = 18, DIR = 19, KVX = 20, KVY = 21, RIGHT = 22, MSG = 23;
  Q[CX] = CUP.x, Q[CY] = CUP.y, Q[TAPT] = -9;
  // Squash springs, one per part: offset (-1 pressed), velocity, target.
  const SQ = new Float64Array(7), SQV = new Float64Array(7), SQT = new Float64Array(7);
  let saidAt = -1, timer = 0;
  engine.signal.addEventListener("abort", () => clearTimeout(timer));

  function goWake(d: number) {
    N[WDIR] = d;
    d > 0 ? wake.play() : wake.reverse();
  }
  function setLaptop(open: boolean) {
    if (reduce) {
      // Calm: land on the still frame (the lighting crossfades in CSS), no sequence.
      day.seek(open ? NOON : REST + 1);
      wake.seek(open ? wake.duration : 0);
      N[HOLD] = +!open;
      return void engine.wake();
    }
    if (open) {
      N[HOLD] = 0;
      if (P[AW]! > 0.5 && N[WDIR]! > 0) return;
      const t = day.time % DAY;
      if (t > WAKE && t < SLEEP) return goWake(1); // daytime already: just wake up
      day.seek(WAKE - 0.7);
      day.play();
      N[CLOCK] = 1;
    } else {
      N[HOLD] = 1;
      goWake(-1);
      const t = day.time % DAY;
      if (t >= WAKE && t < DUSK) day.seek(DUSK);
      if (N[CLOCK]) day.play();
    }
  }

  // ---------- the cup's toys ----------
  const say = (i: number) => (Q[MSG] = i, engine.wake());
  const pouring = () => pour.playing;
  // In reach: the cup's centre within his arm's stretch (plus the cup's own half) of a shoulder.
  const reachable = () => Math.min(Math.hypot(Q[CX]! + CUP.r - SH.lx, Q[CY]! + CUP.r - SH.y), Math.hypot(Q[CX]! + CUP.r - SH.rx, Q[CY]! + CUP.r - SH.y)) < SH.ua + SH.fa + 44;
  const canSip = () => P[AW]! > 0.9 && !sip.playing && !Q[SPILL] && !Q[DRAG] && !pouring() && reachable();
  function drink() {
    if (Q[SPILL]) return right();
    if (P[AW]! <= 0.9) return say(9);
    if (!reachable()) return say(10);
    if (sip.playing || pouring() || Q[DRAG]) return;
    if (N[LEVEL]! < 0.25) say(14);
    else say(1);
    if (reduce) N[LEVEL] = Math.max(0.18, N[LEVEL]! - 0.25);
    else sip.play();
  }
  function refill() {
    if (Q[SPILL]) return right();
    if (sip.playing || P[SIP]! > 0) sip.pause(), sip.seek(0);
    if (reduce) {
      N[LEVEL] = 1, N[HEAT] = 1;
      return say(3);
    }
    pour.seek(0), pour.play();
    say(2);
  }
  function knock(a: number, vx: number, vy: number) {
    if (Q[SPILL]) return;
    if (sip.playing || P[SIP]! > 0) sip.pause(), sip.seek(0);
    if (pouring()) pour.pause(), pour.seek(0);
    Q[SPILL] = 1, Q[DIR] = a, Q[SPT] = 5, Q[LIFT] = Q[LIFTT] = Q[DRAG] = 0;
    N[LEVEL] = 0, N[HEAT] = 0;
    engine.events.emit("spill");
    say(4);
    if (reduce) {
      spill.seek(spill.duration);
      clearTimeout(timer);
      timer = setTimeout(right, 5000) as unknown as number;
      return;
    }
    Q[KVX] = vx, Q[KVY] = vy;
    spill.seek(0), spill.play();
    const mx = Q[CX]! + CUP.r + Math.cos(a) * 34, my = Q[CY]! + CUP.r + Math.sin(a) * 34;
    emit(splash, mx, my, 14, 6, 2, 1.4);
  }
  function right() {
    if (!Q[SPILL] || Q[RIGHT]) return;
    Q[RIGHT] = 1, Q[SPT] = 0, Q[KVX] = Q[KVY] = 0;
    clearTimeout(timer);
    if (reduce) return spill.seek(0), upright();
    spill.reverse();
  }
  function upright() {
    Q[SPILL] = Q[RIGHT] = 0;
    refill();
    say(reduce ? 3 : 5);
  }
  // The cup's centre may go anywhere on the desk that is on screen.
  const clampX = (x: number) => Math.min(Math.max(x, Math.max(DESK[0], view[1]! + 34) - CUP.r), Math.min(DESK[2], view[1]! + view[5]! - 34) - CUP.r);
  const clampY = (y: number) => Math.min(Math.max(y, Math.max(DESK[1], view[2]! + 34) - CUP.r), Math.min(DESK[3], view[2]! + view[6]! - 34) - CUP.r);
  // Where the cup is drawn right now (it travels to his mouth on a sip): its centre.
  const cupAt = (i: 0 | 1) => { const c = carry(P[SIP]!); return (i ? Q[CY]! + (CUP.my - Q[CY]!) * c : Q[CX]! + (CUP.mx - Q[CX]!) * c) + CUP.r; };
  function press(x: number, y: number) {
    const k = view[0]!, pad = (b: readonly number[]) => Math.max(6, (44 / k - Math.min(b[2]!, b[3]!)) / 2);
    const inBox = (b: readonly number[]) => x >= b[0]! - pad(b) && x <= b[0]! + b[2]! + pad(b) && y >= b[1]! - pad(b) && y <= b[1]! + b[3]! + pad(b);
    const r = Math.max(40, 24 / k), mx = Q[CX]! + CUP.r + Math.cos(Q[DIR]!) * 56, my = Q[CY]! + CUP.r + Math.sin(Q[DIR]!) * 56;
    const g = Math.hypot(x - cupAt(0), y - cupAt(1)) < r ? (Q[SPILL] ? SPILLP : CUPP) : Q[SPILL] && Math.hypot(x - mx, y - my) < 44 ? SPILLP
      : inBox(BOX.laptop) ? LAP : inBox(BOX.person) ? PERSON : inBox(BOX.phone) ? PHONE : inBox(BOX.phones) ? PHONES : 0;
    Q[GRAB] = g;
    if (!g) return;
    const s = g === SPILLP ? CUPP : g;
    SQT[s] = -1;
    if (!reduce) (SQ[s] = -1), (SQV[s] = 0);
    engine.events.emit("tap");
    Q[DRAG] = 0, Q[SX] = Q[PX] = x, Q[SY] = Q[PY] = y, Q[PT] = Q[CLK]!, Q[OX] = x - Q[CX]!, Q[OY] = y - Q[CY]!, Q[VX] = Q[VY] = 0;
  }
  function release() {
    const g = Q[GRAB]!;
    Q[GRAB] = 0;
    SQT.fill(0);
    if (g === CUPP && Q[DRAG]) {
      Q[DRAG] = 0, Q[LIFTT] = 0;
      if (reduce) Q[LIFT] = 0;
      const still = Q[CLK]! - Q[PT]! > 0.1, sp = still ? 0 : Math.hypot(Q[VX]!, Q[VY]!) * view[0]!;
      if (sp > FLICK) return knock(Math.atan2(Q[VY]!, Q[VX]!), Q[VX]! * 0.3, Q[VY]! * 0.3);
      engine.events.emit("set");
      if (Math.hypot(Q[CX]! - CUP.x, Q[CY]! - CUP.y) < 28) return (Q[CX] = CUP.x), (Q[CY] = CUP.y), say(8);
      return say(7);
    }
    if (g === CUPP) {
      // A second tap soon after the first: refill. One tap: a sip.
      if (Q[CLK]! - Q[TAPT]! < 0.36) return (Q[TAPT] = -9), refill();
      Q[TAPT] = Q[CLK]!;
      return drink();
    }
    if (g === SPILLP) return right();
    if (g === LAP) tap("lid");
    else if (g === PERSON) P[AW]! < 0.5 && tap("nudge");
    else if (g) tap("music");
  }

  // ---------- the scene system ----------
  const sfx = (x: number, y: number, w: number, c: number, size: number, vy: number) =>
    fx.spawn(WORD, x, y, (rand() - 0.5) * 30, vy, size, 1.3 + rand() * 0.5, c, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.5, w);
  engine.add({
    step(e, dt) {
      if (paused) return;
      Q[CLK]! += dt;
      // The pointer (@fzlt/core/input), in art units: a press picks the part under it; on the cup, a
      // move past 6 px is a drag; the release is a tap, a set-down or (fast) a flick.
      const x = view[1]! + ctl.pointer.x / view[0]!, y = view[2]! + ctl.pointer.y / view[0]!;
      if (ctl.pointer.hit) press(x, y);
      if (Q[GRAB]) {
        if (Q[GRAB] === CUPP && ctl.pointer.down) {
          if (!Q[DRAG] && Math.hypot(x - Q[SX]!, y - Q[SY]!) * view[0]! > 6 && !Q[SPILL] && !pouring() && carry(P[SIP]!) === 0) {
            Q[DRAG] = 1, Q[LIFTT] = 1, SQT[CUPP] = 0;
            if (reduce) Q[LIFT] = 1;
            if (sip.playing) sip.pause(), sip.seek(0);
            e.events.emit("lift");
            say(6);
          }
          if (x !== Q[PX] || y !== Q[PY]) {
            const t = Math.max(Q[CLK]! - Q[PT]!, 1 / 120);
            Q[VX] = Q[VX]! * 0.35 + ((x - Q[PX]!) / t) * 0.65;
            Q[VY] = Q[VY]! * 0.35 + ((y - Q[PY]!) / t) * 0.65;
            Q[PX] = x, Q[PY] = y, Q[PT] = Q[CLK]!;
          }
          if (Q[DRAG]) (Q[CX] = clampX(x - Q[OX]!)), (Q[CY] = clampY(y - Q[OY]!)), e.busy();
        }
        if (!ctl.pointer.down) release();
      }
      // The cup's keys.
      if (MV[0] || MV[1]) {
        if (!Q[SPILL] && !Q[DRAG]) {
          Q[CX] = clampX(Q[CX]! + MV[0]!), Q[CY] = clampY(Q[CY]! + MV[1]!);
          if (!reduce) (SQ[CUPP] = -0.6), (SQV[CUPP] = 0);
          say(Math.hypot(Q[CX]! - CUP.x, Q[CY]! - CUP.y) < 1 ? 8 : 11);
        }
        MV[0] = MV[1] = 0;
      }
      if (ctl.hit(REFK)) refill();
      if (ctl.hit(KNKK)) knock(Q[CX]! + CUP.r < 400 ? Math.PI : 0, 0, 0);
      if (ctl.hit(NUDK) && P[AW]! < 0.5 && N[WDIR]! <= 0 && N[STIR]! <= 0) {
        e.events.emit("nudge");
        if (reduce) setLaptop(true);
        else N[STIR] = 0.7;
      }
      if (N[STIR]! > 0 && (N[STIR]! -= dt) <= 0) {
        // He stirs, then the day starts now.
        N[HOLD] = 0;
        day.seek(WAKE - 0.1);
        day.play();
        N[CLOCK] = 1;
      }
      if (ctl.hit(LIDK)) setLaptop(P[LID]! < 0.5 && N[WDIR]! <= 0);
      if (ctl.hit(MUSK)) music = !music;
      if (ctl.hit(SIPK)) {
        if (!reduce) (SQ[CUPP] = -0.6), (SQV[CUPP] = 0);
        drink();
      }
      // Rest at night when the laptop was closed by hand: the clock stops there until it opens.
      if (N[HOLD] && N[CLOCK] && !reduce && day.time % DAY >= REST) (day.pause(), (N[CLOCK] = 0));
      if (reduce) return;
      // The toys' own motion: squash springs, the lift, the knocked cup sliding, the spill timer, the pour.
      for (let i = 1; i < 7; i++) {
        if (!SQ[i] && !SQV[i] && !SQT[i]) continue;
        SQV[i]! += (520 * (SQT[i]! - SQ[i]!) - 13 * SQV[i]!) * dt;
        SQ[i]! += SQV[i]! * dt;
        if (!SQT[i] && Math.abs(SQ[i]!) < 0.004 && Math.abs(SQV[i]!) < 0.05) SQ[i] = SQV[i] = 0;
        e.busy();
      }
      if (Q[LIFT] !== Q[LIFTT]) {
        Q[LIFT]! += (Q[LIFTT]! - Q[LIFT]!) * Math.min(1, dt * 16);
        if (Math.abs(Q[LIFT]! - Q[LIFTT]!) < 0.004) Q[LIFT] = Q[LIFTT]!;
        e.busy();
      }
      if (Q[KVX] || Q[KVY]) {
        const nx = Q[CX]! + Q[KVX]! * dt, ny = Q[CY]! + Q[KVY]! * dt, f = Math.exp(-5 * dt);
        Q[CX] = clampX(nx), Q[CY] = clampY(ny);
        if (Q[CX] !== nx) Q[KVX] = -Q[KVX]! * 0.4;
        if (Q[CY] !== ny) Q[KVY] = -Q[KVY]! * 0.4;
        Q[KVX]! *= f, Q[KVY]! *= f;
        if (Math.hypot(Q[KVX]!, Q[KVY]!) < 6) Q[KVX] = Q[KVY] = 0;
        e.busy();
      }
      if (Q[SPILL] && !Q[RIGHT] && (Q[SPT]! -= dt) <= 0) right();
      if (Q[SPILL] && !Q[RIGHT]) e.busy();
      if (PR[1]! > 0.3) N[LEVEL] = Math.min(1, N[LEVEL]! + dt * 1.5);
      const awake = P[AW]! > 0.9, h = head(P[AW]!, P[SIP]!);
      // The beat: while the headphones are on and the music plays, a thump every half second, notes rising.
      if (awake && P[PH]! > 0.95 && music) {
        if ((N[BEAT]! -= dt * speed) <= 0) {
          N[BEAT]! += 0.5;
          e.events.emit("beat", 0, 0, 0, 0, 0.6);
          if (N[BEATS]!++ % 2 === 0) {
            const s = N[BEATS]! % 4 < 2 ? -1 : 1;
            sfx(h.x + s * 54, h.y - 10, (N[BEATS]! / 2) & 1, s < 0 ? 1 : 2, 20 + rand() * 6, -60 - rand() * 30);
          }
        }
        e.busy();
      }
      // Typing: key clicks, the code scrolls, sparks of code (or swatch chips) fly off the screen.
      if (P[HD]! > 0.95 && P[SIP]! < 0.05) {
        N[TYPE]! += dt * speed;
        if ((N[KEY]! -= dt * speed) <= 0) {
          N[KEY] = 0.09 + rand() * 0.22;
          e.events.emit("key", 0, 0, 0, 0, 0.5);
          N[SCROLL]! += 3.5;
          if (rand() < 0.3) {
            const x = 320 + rand() * 160;
            if (mode === "code") sfx(x, 132, 4 + ((rand() * 5) | 0), 3 + ((rand() * 2) | 0) * 2 - 2, 12, -50 - rand() * 30);
            else emit(chip, x, 134, 1, 1, 4);
          }
        }
        T[0] = Math.sin(N[TYPE]! * 31) * 3;
        T[1] = Math.sin(N[TYPE]! * 27 + 1.7) * 3;
        e.busy();
      } else T[0] = T[1] = 0;
      N[DES]! += dt * speed;
      // The coffee: filled at dawn, a little gone each sip; it steams while there is some.
      if (P[SIP]! > 0.6) N[LEVEL] = Math.max(0.18, N[LEVEL]! - dt * speed * 0.18);
      N[HEAT] = Math.max(0, N[HEAT]! - (dt * speed) / 9);
      const cx = cupAt(0), cy = cupAt(1);
      if (!Q[SPILL] && N[HEAT]! > 0.5 && N[LEVEL]! > 0.3 && P[SIP]! < 0.05 && rand() < dt * 6 * N[HEAT]!) {
        const a = rand() * 6.283, r = rand() * 13 * N[LEVEL]!;
        emit(bub, cx + Math.cos(a) * r, cy + 4 + Math.sin(a) * r * 0.9, 1, 0, 1);
      }
      if (!Q[SPILL] && N[LEVEL]! > 0.2 && N[HEAT]! > 0.15 && (N[STEAM]! -= dt * speed * N[HEAT]!) <= 0) {
        N[STEAM] = 0.32;
        emit(puff, cx + (rand() - 0.5) * 12, cy - 9, 1, 0, 1);
      }
      // Asleep: Zzz.
      if (P[AW]! < 0.05 && N[STIR]! <= 0 && (N[ZZZ]! -= dt * speed) <= 0) {
        const k = N[ZN]!++ % 3; // z, z, Z, then a breath
        N[ZZZ] = k === 2 ? 1.1 : 0.45;
        N[ZC]!++;
        fx.spawn(WORD, h.x + 30 + k * 6, h.y - 30, 6 + k * 4, -34, 12 + k * 5, 1.6, 0, 0.2, 0, k === 2 ? 3 : 2);
      }
      fx.step(dt);
      if (fx.live) e.busy();
    },
    render(e) {
      // Story beats from the timelines' labels (on the ring this frame).
      for (let i = 0; i < e.events.size; i++) {
        const ev = e.events.at(i)!;
        if (ev.type === "dawn" && !Q[SPILL]) (N[LEVEL] = 1), (N[HEAT] = 1);
        else if ((ev.type === "slurp" || ev.type === "clink") && !reduce) emit(splash, ev.type === "clink" ? cupAt(0) : 360, ev.type === "clink" ? cupAt(1) + 4 : 404, 5, 6, 2);
        else if (ev.type === "wake" && !N[HOLD]) goWake(1);
        else if (ev.type === "sleep") goWake(-1);
        else if (ev.type === "sip" && canSip()) sip.play();
        else if (ev.type === "full") ((N[LEVEL] = 1), (N[HEAT] = 1), say(3), emit(puff, cupAt(0), cupAt(1) - 6, 10, 0, 1, 1.3));
        else if (ev.type === "timeline:end" && ev.a === 8 && Q[RIGHT]) upright();
      }
      if (resized) (fit(), (resized = false));
      const aw = P[AW]!, ph = P[PH]!, lid = P[LID]!, s = P[SIP]!, bob = aw > 0.9 && ph > 0.95 && music && !reduce ? Math.max(0, Math.cos((0.5 - N[BEAT]!) * Math.PI * 4)) * -2 : 0;
      const sq = (i: number) => (SQ[i] ? ` scale(${Math.round((1 + SQ[i]! * 0.07) * 1000) / 1000})` : "");
      set(headEl, "transform", (N[STIR]! > 0 ? `${headT(aw, s, bob)} rotate(${(Math.sin(N[STIR]! * 40) * 6).toFixed(1)})` : headT(aw, s, bob)) + sq(PERSON));
      const nk = neck(aw, s);
      set(neckEl, "cy", `${nk.cy}`), set(neckEl, "ry", `${nk.ry}`), set(napeEl, "cy", `${Math.round((nk.cy - nk.ry + 30) * 10) / 10}`);
      set(phonesEl, "transform", phonesT(ph, aw, s, bob) + sq(PHONES));
      const bd = band(ph);
      for (const b of bandEls) set(b, "d", bd);
      set(cordEl, "d", cord(ph, aw, s));
      set(laptop, "transform", sqT(400, 255, SQ[LAP]!)), set(sqp, "transform", sqT(0, 0, SQ[PHONE]!));
      // Arms: the hands' targets (the keys, the desk, folded asleep), the nearer hand to the cup on a
      // sip; two bones each, the elbows out.
      const hn = hands(aw, P[HD]!, T[0]!, T[1]!), rc = reach(s), side = Q[CX]! + CUP.r < 400 ? 0 : 1, gx = cupAt(0) + (side ? 22 : -22), gy = cupAt(1) + 8;
      for (const a of arms) {
        const i = a.s < 0 ? 0 : 1, tx = i ? hn.rx : hn.lx, ty = i ? hn.ry : hn.ly, k = arm(a.s, i === side ? tx + (gx - tx) * rc : tx, i === side ? ty + (gy - ty) * rc : ty);
        set(a.ua, "x2", `${k.ex}`), set(a.ua, "y2", `${k.ey}`), set(a.fa, "x1", `${k.ex}`), set(a.fa, "y1", `${k.ey}`), set(a.fa, "x2", `${k.hx}`), set(a.fa, "y2", `${k.hy}`);
        set(a.fm, "x1", `${k.ex}`), set(a.fm, "y1", `${k.ey}`), set(a.fm, "x2", `${Math.round((k.ex + (k.hx - k.ex) * 0.45) * 10) / 10}`), set(a.fm, "y2", `${Math.round((k.ey + (k.hy - k.ey) * 0.45) * 10) / 10}`);
        set(a.sl, "x2", `${Math.round((k.sx + (k.ex - k.sx) * 0.72) * 10) / 10}`), set(a.sl, "y2", `${Math.round((SH.y + (k.ey - SH.y) * 0.72) * 10) / 10}`);
        set(a.hd, "transform", `translate(${k.hx} ${k.hy}) rotate(${k.deg})`);
      }
      set(screen, "transform", screenT(lid)), set(scrl, "transform", screenT(lid)), set(cover, "transform", coverT(lid));
      // The cup: on the desk, lifted, at his mouth, tipped over; the puddle, the pot.
      const tip = SPL[0]!, pud = SPL[1]!, deg = Math.round((Q[DIR]! * 180) / Math.PI), lift = Q[LIFT]!, c = carry(s);
      set(cupEl, "transform", cupT(s, Q[CX]!, Q[CY]!, lift, SQ[CUPP]!));
      set(upEl, "style", tip < 0.5 ? "" : "display:none"), set(tipEl, "style", tip < 0.5 ? "display:none" : "");
      set(upG, "transform", tip > 0 && tip < 0.5 ? `rotate(${deg} 39 39) translate(39 39) scale(${(1 + tip * 0.7).toFixed(2)} ${(1 - tip * 0.3).toFixed(2)}) translate(-39 -39) rotate(${-deg} 39 39)` : "");
      set(tipEl, "transform", `rotate(${deg} 39 39) translate(39 39) scale(${Math.min(1, 0.7 + tip * 0.3).toFixed(2)}) translate(-39 -39)`);
      set(cupSh, "transform", cupShT(Q[CX]!, Q[CY]!, lift)), set(cupSh, "style", tip >= 0.5 || c > 0.5 ? "display:none" : c ? `opacity:${(1 - c * 2).toFixed(2)}` : "");
      const ox = Q[CX]! + CUP.r + Math.cos(Q[DIR]!) * 30, oy = Q[CY]! + CUP.r + Math.sin(Q[DIR]!) * 30;
      set(pudEl, "style", pud > 0.01 ? "" : "display:none"), set(pudEl, "transform", `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) rotate(${deg}) scale(${pud.toFixed(2)})`);
      const D = 240 - 174 * PR[0]!;
      set(potEl, "style", PR[0]! > 0.001 ? "" : "display:none"), set(potEl, "transform", `translate(${(cupAt(0) - D * 0.766).toFixed(1)} ${(cupAt(1) - D * 0.643).toFixed(1)}) rotate(40)`);
      set(stream, "stroke-width", `${(PR[1]! * 8).toFixed(1)}`), set(potB, "transform", `rotate(${Math.round(PR[1]! * 14)})`);
      const fr = Math.round(N[LEVEL]! * 11), lq = LIQUID[fr]!, design = mode === "design";
      set(cupImg, "x", `${-fr * 84}`), set(cupImg, "y", design ? "-84" : "0");
      set(liquid, "cx", `${lq[0]}`), set(liquid, "cy", `${lq[1]}`), set(liquid, "rx", `${lq[2]}`), set(liquid, "ry", `${lq[3]}`);
      const ht = Math.round(N[HEAT]! * 20) / 20;
      set(liquid, "fill", brew(design, ht)), set(liquid, "style", look === "fizlet" ? `--lq:${brew(design, ht, FZB[design ? 1 : 0])}` : "");
      // The cup's key target follows the cup (at least 44 px square).
      const k = view[0]!, gs = Math.max(44, 70 * k);
      set(grip, "style", `width:${gs | 0}px;height:${gs | 0}px;left:${((cupAt(0) - view[1]!) * k - gs / 2) | 0}px;top:${((cupAt(1) - view[2]!) * k - gs / 2) | 0}px`);
      // Screens.
      set(scroll, "transform", `translate(0 ${-((N[SCROLL]! % 112) | 0)})`);
      set(caret, "opacity", (N[DES]! * 2) % 2 < 1 ? "1" : "0");
      const d = N[DES]! % 6, kk = (d / 2) | 0, f = Math.min(1, (d % 2) * 1.5), sx = [376, 446, 404][kk]!, sy = [214, 168, 210][kk]!, px = [446, 404, 376][kk]!, py = [168, 210, 214][kk]!;
      set(arrow, "transform", `translate(${(sx + (px - sx) * f).toFixed(1)} ${(sy + (py - sy) * f).toFixed(1)})`);
      set(sel, "x", `${[374, 326, 422][kk]}`);
      set(shape, "r", `${10 + (kk === 1 ? f * 3 : 0)}`);
      set(pix, "href", pixURL[aw < 0.5 ? 2 : reduce || !music || ph < 0.95 ? 0 : (N[BEATS]! & 1)]!);
      for (const el of codeEls) set(el, "style", mode === "code" ? "" : "display:none");
      for (const el of desEls) set(el, "style", mode === "design" ? "" : "display:none");
      set(body, "aria-label", aw < 0.5 ? "Nudge him awake" : "He is working");
      set(laptop, "aria-label", lid > 0.5 ? "Close the laptop: he sleeps" : "Open the laptop: he wakes");
      // The why, one sentence per part of the day: before (night), in between (dawn), built (the
      // day's work), shared (afternoon into dusk). Calm: the whole line stays.
      if (!reduce) {
        const t = day.time % DAY, b = t < DAWN || t >= SLEEP + 1 ? 0 : t < WAKE + 1.4 ? 1 : t < 11 ? 2 : 3;
        if (beatEl.textContent !== ORIGIN_WHY_BEATS[b]) (beatEl.textContent = ORIGIN_WHY_BEATS[b]!), (stepEl.textContent = `${b + 1}/${ORIGIN_WHY_BEATS.length}`);
      }
      // The status line (polite): what just changed. The same line again is said again.
      if (Q[MSG]) {
        status.textContent = SAY[Q[MSG]!]! + (saidAt === Q[MSG] ? " " : "");
        saidAt = saidAt === Q[MSG] ? -1 : Q[MSG]!;
        Q[MSG] = 0;
      }
      // Our own wrapper: the screen glow follows the lid.
      wrap.style.setProperty("--glow", `${Math.round(lid * 100) / 100}`);
      wrap.className = cls();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.restore();
      fx.draw(ctx, true);
      // The key row and the host's event, on change only.
      const st = `${mode}${look}${lid > 0.5}${tags}${snd.on}${paused}`;
      if (st !== last) {
        last = st;
        lookKey?.setAttribute("aria-pressed", `${look === "fizlet"}`);
        modeKey?.setAttribute("aria-pressed", `${mode === "design"}`);
        tagsKey?.setAttribute("aria-pressed", `${tags}`);
        if (soundKey) (soundKey.setAttribute("aria-pressed", `${snd.on}`), (soundKey.textContent = snd.on ? "Sound" : "Muted"));
        if (pauseKey) (pauseKey.setAttribute("aria-pressed", `${paused}`), (pauseKey.textContent = paused ? "Play" : "Pause"));
        root.dispatchEvent(new CustomEvent("origin:state", { detail: scene.state, bubbles: true }));
      }
    },
  });
  let last = "";
  const cache = new Map<Element, Record<string, string>>();
  function set(el: Element, name: string, v: string) {
    const c = cache.get(el) ?? (cache.set(el, {}), cache.get(el)!);
    if (c[name] === v) return;
    c[name] = v;
    el.setAttribute(name, v);
  }

  // The key row.
  wrap.querySelector(".og-bar")?.addEventListener("click", (ev) => {
    const k = (ev.target as HTMLElement).closest("button")?.dataset.k;
    if (k === "look") scene.setLook(look === "fizlet" ? "2015" : "fizlet");
    else if (k === "mode") scene.setMode(mode === "code" ? "design" : "code");
    else if (k === "tags") scene.setShowBricks(!tags);
    else if (k === "sound") scene.setSound(!snd.on);
    else if (k === "pause") paused ? scene.play() : scene.pause();
  }, { signal: engine.signal });

  const scene: OriginScene = {
    accessible: o.controls !== false,
    destroy: () => engine.destroy(),
    setMode(m) {
      mode = m;
      engine.wake();
    },
    setLook(l) {
      if (l === look) return;
      look = l === "2015" ? "2015" : "fizlet";
      wrap.className = cls();
      paint();
      engine.events.emit("tap");
      say(look === "fizlet" ? 12 : 13);
    },
    setShowBricks(on) {
      tags = on;
      engine.wake();
    },
    setSound(on) {
      snd.on = on;
      engine.wake();
    },
    setLaptop(open) {
      if (paused) scene.play();
      setLaptop(open);
    },
    pause() {
      paused = true;
      day.pause(), wake.pause(), sip.pause(), pour.pause(), spill.pause();
      engine.wake(); // one frame to update the keys, then it settles
    },
    play() {
      if (!paused) return;
      paused = false;
      if (N[CLOCK]) day.play();
      if (N[WDIR] && wake.time > 0 && wake.time < wake.duration) goWake(N[WDIR]!);
      if (sip.time > 0 && sip.time < sip.duration) sip.play();
      if (pour.time > 0 && pour.time < pour.duration) pour.play();
      if (Q[RIGHT]) spill.reverse();
      else if (Q[SPILL] && spill.time < spill.duration) spill.play();
      engine.wake();
    },
    get state() {
      return { mode, look, open: P[LID]! > 0.5, bricks: tags, sound: snd.on, paused, awake: P[AW]! > 0.5 };
    },
    sip: () => tap("sip"),
    refill: () => tap("refill"),
    knock(a = 0) {
      if (paused) scene.play();
      knock(a, 0, 0);
    },
    nudge: () => tap("nudge"),
    stats() {
      let toys = +pour.playing + +spill.playing + +!!Q[DRAG] + +(Q[LIFT] !== Q[LIFTT]) + +!!(Q[KVX] || Q[KVY]) + +(Q[SPILL] === 1);
      for (let i = 1; i < 7; i++) toys += +!!(SQ[i] || SQV[i]);
      return { particles: fx.live, zzz: N[ZC]!, cup: { x: Q[CX]!, y: Q[CY]!, level: N[LEVEL]!, spilled: !!Q[SPILL], lifted: Q[LIFT]! > 0.5 }, toys };
    },
  };

  // Start: night, asleep, a moment before dawn, so the day begins soon after it comes into view.
  if (reduce) {
    day.seek(NOON);
    wake.seek(wake.duration);
    N[LEVEL] = 1;
    N[HEAT] = 0.8;
  } else {
    day.seek(DAWN - 1.2);
    day.play();
    N[CLOCK] = 1;
  }
  engine.start();
  return scene;
}

/** For @fzlt/core/slot: options from the slot figure's data attributes (data-mode, data-look="2015",
 *  data-bricks="1", data-sound="0", data-speed). */
export const mountSlot: SlotMount = (stage, fig) => {
  const d = fig.dataset;
  return mount(stage, { mode: d.mode === "design" ? "design" : "code", look: d.look === "2015" ? "2015" : "fizlet", showBricks: d.bricks === "1", sound: d.sound !== "0", ...(+d.speed! > 0 && { speed: +d.speed! }) });
};
