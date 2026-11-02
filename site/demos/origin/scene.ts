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
import { why, art, CSS, BOX, C, VB, DESK, CUP, SH, PLANT, BOOK, KEYS_HOME, TIPS_HOME, head, headT, hands, neck, armD, reach, carry, cupT, cupShT, LIQUID, brew, phonesT, band, cord, screenT, coverT, sqT, type OriginLook } from "./art";

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
  /** The seed for his typing and doodles (default 2015): the same seed types the same keys. */
  seed?: number;
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
  stats(): { particles: number; zzz: number; cup: { x: number; y: number; level: number; spilled: boolean; lifted: boolean }; toys: number; drops: number; pages: number; lamp: boolean; lit: number; keys: number[]; music: { genre: string; playing: string; paused: boolean; bars: number[] } };
  /** Water the plant; write or doodle in the notebook; switch the lamp. */
  water(): void;
  write(): void;
  setLamp(on: boolean): void;
}

// The day, in seconds of a 24 s loop (one second an hour).
const DAY = 24, DAWN = 2.4, WAKE = 4.2, NOON = 9, DUSK = 15.4, SLEEP = 19.2, REST = 21.2;
// Pose slots (the wake and sip timelines write these): awake, headphones on, lid open, hands on keys, sip.
const AW = 0, PH = 1, LID = 2, HD = 3, SIP = 4;
// fx colours, by role: steam, note, note, spark, ink, white, coffee, coffee light. The look swaps them.
const COLORS = [C.cream, C.red, C.sun, C.tealL, C.ink, "#ffffff", "#5a3526", "#b98a66"];
const FZ_TOKENS: [string, string][] = [["--k-flag", "#f6f3ff"], ["--k-attack", "#ff2e88"], ["--k-sys", "#19f0ff"], ["--k-go", "#39ffb0"], ["--k-cmd", "#9a63ff"], ["--k-flag", "#f6f3ff"], ["--k-advance", "#ff8a1f"], ["--hurt", "#ffc21a"]];
const WORDS = ["♪", "♫", "z", "Z", "{ }", "</>", ";", "=>", "#", "♬", "★"];
// The phone's music: three genres, each a one-bar loop on the audio clock (@fzlt/core/sound plays
// each cue at its time). Per genre: tempo, steps in a bar (eighths or sixteenths), the cues on each
// step, the ♪ words, colours (fx palette) and how many beats between notes.
const GENRES = ["country", "rock", "pop"] as const;
const BPM = [110, 132, 118], STEPS = [8, 8, 16], NOTE_W = [[0, 1], [9, 8], [10, 1]], NOTE_C = [[7, 2], [1, 4], [3, 2]], NOTE_EVERY = [2, 1, 1];
const PAT: string[][][] = [
  [["cb1"], [], ["cch"], ["ctw"], ["cb2"], [], ["cch"], ["ctw"]],
  [["rk", "rb1", "rh"], ["rh"], ["rs", "rh"], ["rh"], ["rk", "rb2", "rh"], ["rk", "rh"], ["rs", "rh"], ["rh"]],
  [["pk", "pa"], [], ["ph"], ["pb"], ["pk", "pcl"], [], ["ph", "pc"], [], ["pk"], [], ["ph", "pb"], [], ["pk", "pcl"], ["pc"], ["ph"], []],
];
const WORD = 4; // fx's word-shaped part
// The parts a press can land on (squash slots too).
const CUPP = 1, LAP = 2, PHONE = 3, PHONES = 4, PERSON = 5, SPILLP = 6, PLANTP = 7, BOOKP = 8, LAMPP = 9;
// What the status line says (polite): an index, set in the step, written in render.
const SAY = ["", "Sip.", "Refilling the cup.", "Refilled: hot coffee.", "Knocked over! Tap the spill, or wait: it rights itself.", "Back up. Refilling.", "Picked up the cup.", "Cup set down.", "Back on the saucer.", "He is asleep. Tap him to wake him.", "Out of his reach: move the cup closer.", "Cup moved.", "Fizlet look.", "2015 look.", "Nearly empty: double-tap or press R to refill.", "Watering the plant.", "Lamp on.", "Lamp off.", "", "", "Music paused.", ""];
// The notebook: a line of code, or one of these doodles (24 units square), drawn as one stroke path.
const DOODLES: [string, string][] = [["a star", "M12 1l3.4 7.2 7.9.9-5.9 5.4 1.6 7.8L12 18.4l-7 3.9 1.6-7.8L.7 9.1l7.9-.9Z"], ["a heart", "M12 21C4 15.5 0 11 2.5 6 4.5 2 9.5 2 12 6c2.5-4 7.5-4 9.5 0 2.5 5-1.5 9.5-9.5 15Z"], ["a happy face", "M23 12A11 11 0 1 1 1 12 11 11 0 1 1 23 12ZM8 9v2M16 9v2M7 15q5 4 10 0"], ["a lightning bolt", "M14 1 4 13h7l-3 10 12-14h-7l3-8Z"], ["a triangle", "M12 1 23 22H1Z"], ["a square", "M2 2h20v20H2Z"], ["a house", "M2 23V11L12 2l10 9v12ZM9 23v-7h6v7"], ["a sun", "M17 12a5 5 0 1 1-10 0 5 5 0 1 1 10 0M12 0v3M12 21v3M0 12h3M21 12h3M3.5 3.5l2 2M18.5 18.5l2 2M3.5 20.5l2-2M18.5 5.5l2-2"]];
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
  let mode: OriginMode = o.mode ?? "code", look: OriginLook = o.look === "2015" ? "2015" : "fizlet", tags = !!o.showBricks, paused = false;

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
  const arms = [-1, 1].map((s) => { const g = q(s < 0 ? ".og-arm-l" : ".og-arm-r"); return { s, skin: g.querySelector(".og-skin")!, sl: g.querySelector(".og-sl")!, hem: g.querySelector(".og-hem")!, hd: g.querySelector(s < 0 ? ".og-hand-l" : ".og-hand-r")! }; });
  const pen = q(".og-pen"), plantEl = q(".og-plant"), sqf = q(".og-sqf"), leaves = q(".og-leaves"), bookEl = q(".og-book"), sqb = q(".og-sqb"), lampEl = q(".og-lamp"), sqm = q(".og-sqm");
  const inks = qa(".og-ink"), drops = qa(".og-drops circle"), canEl = q(".og-can"), canB = q(".og-canb"), wstream = q(".og-wstream"), klit = qa(".o-klit");
  const screen = q(".og-screen"), cover = q(".og-cover"), scrl = q(".og-scrl"), laptop = q(".og-laptop");
  const scroll = q(".og-scroll"), caret = q(".og-caret"), arrow = q(".og-arrow"), sel = q(".og-sel"), shape = q(".og-shape");
  const phoneEl = q(".og-phone"), genreEl = q(".og-genre"), pzEl = q(".og-pz");
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
    // Keep x 110..690 and y 0..500 in view (the lamp, the plant); past 16:9 crop the window and the person a little.
    let w = a >= 1.04 ? Math.min(VB.h * a, 900) : 580, h = w / a;
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
    cues: { key: "tick", slurp: "slurp", clink: "clink", wake: "yawn", sleep: "end", nudge: "nudge", tap: "pop", pour: "pour", spill: "spill", set: "clink", lift: "tick", lamp: "click", scribble: "scribble" }, on: o.sound ?? true, volume: 0.3,
    notes: {
      // The loops' voices: country (bass root and fifth, the chick, the twang), rock (kick, snare,
      // hat, power bass), pop (kick, clap, hat, a three-note pluck).
      cb1: [[98, 97, 0.3, 0, "triangle", 0.5]], cb2: [[147, 146, 0.3, 0, "triangle", 0.45]], cch: [[2400, 1800, 0.03, 0, "square", 0.05], [900, 700, 0.05, 0, "triangle", 0.15]], ctw: [[392, 370, 0.14, 0, "sawtooth", 0.07], [784, 740, 0.1, 0, "triangle", 0.05]],
      rk: [[150, 48, 0.18, 0, "sine", 0.8]], rs: [[240, 150, 0.12, 0, "triangle", 0.45], [3200, 1800, 0.08, 0, "square", 0.06]], rh: [[7000, 6800, 0.025, 0, "square", 0.025]], rb1: [[82.4, 82, 0.22, 0, "sawtooth", 0.16]], rb2: [[110, 109, 0.22, 0, "sawtooth", 0.14]],
      pk: [[130, 45, 0.16, 0, "sine", 0.8]], pcl: [[1400, 900, 0.06, 0, "triangle", 0.3], [2600, 1500, 0.05, 0.012, "square", 0.05]], ph: [[8000, 7800, 0.02, 0, "square", 0.02]], pa: [[523.25, 523, 0.14, 0, "triangle", 0.18]], pb: [[659.25, 659, 0.14, 0, "triangle", 0.16]], pc: [[784, 783, 0.14, 0, "triangle", 0.14]],
      tick: [[2200, 1500, 0.018, 0, "square", 0.12]],
      slurp: [[260, 820, 0.16, 0, "sawtooth", 0.16], [820, 420, 0.12, 0.15, "triangle", 0.2], [500, 700, 0.08, 0.3, "sawtooth", 0.1]],
      clink: [[2600, 2500, 0.12, 0, "triangle", 0.4], [3900, 3800, 0.08, 0.01, "sine", 0.25]],
      yawn: [[380, 240, 0.55, 0, "sine", 0.5], [240, 300, 0.5, 0.5, "triangle", 0.35]],
      nudge: [[300, 200, 0.1, 0, "triangle", 0.5]],
      pop: [[520, 900, 0.05, 0, "triangle", 0.35]],
      scribble: [[1800, 2600, 0.05, 0, "sawtooth", 0.05], [2200, 1600, 0.06, 0.12, "sawtooth", 0.05], [1900, 2500, 0.05, 0.26, "sawtooth", 0.05]],
      pour: [[300, 620, 0.22, 0, "sine", 0.3], [420, 760, 0.2, 0.2, "sine", 0.25], [520, 940, 0.2, 0.4, "sine", 0.2], [640, 1100, 0.18, 0.6, "sine", 0.16]],
      spill: [[620, 110, 0.32, 0, "sawtooth", 0.22], [2600, 900, 0.1, 0, "square", 0.06], [2600, 2500, 0.1, 0.05, "triangle", 0.3]],
    },
  });

  // ---------- input: the pointer (taps, the drag, the flick), the lid key, the cup's keys ----------
  const ctl = controls(engine, { keys: { lid: [], sip: [], music: [], genre: [], nudge: [], refill: [], knock: [], water: [], write: [], lamp: [] }, target: layer });
  const LIDK = ctl.id("lid"), SIPK = ctl.id("sip"), MUSK = ctl.id("music"), GENK = ctl.id("genre"), NUDK = ctl.id("nudge"), REFK = ctl.id("refill"), KNKK = ctl.id("knock"), WATK = ctl.id("water"), WRTK = ctl.id("write"), LMPK = ctl.id("lamp");
  const tap = (k: string) => (ctl.press(k), ctl.press(k, false));
  const enter = (el: Element, k: string) => el.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter" && (ev as KeyboardEvent).key !== " ") return;
    ev.preventDefault();
    tap(k);
  }, { signal: engine.signal });
  enter(body, "nudge");
  enter(laptop, "lid");
  enter(plantEl, "water");
  enter(bookEl, "write");
  enter(lampEl, "lamp");
  // The phone: Enter changes the style; Space or P pauses and resumes the loop.
  phoneEl.addEventListener("keydown", (ev) => {
    const k = (ev as KeyboardEvent).key;
    if (k === "Enter") tap("genre");
    else if (k === " " || k === "p" || k === "P") tap("music");
    else return;
    ev.preventDefault();
  }, { signal: engine.signal });
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

  // The watering can: it comes in, pours (drops spill around the pot, the plant perks up), goes.
  const CAN = new Float64Array(2);
  const can = timeline(engine, { motion: true, id: 9 })
    .to(CAN, { 0: [0, 1] }, { at: 0, dur: 0.35 }).to(CAN, { 1: [0, 1] }, { at: 0.3, dur: 0.12 })
    .to(CAN, { 1: 0 }, { at: 1.45, dur: 0.15 }).to(CAN, { 0: 0 }, { at: 1.5, dur: 0.35, ease: "in" }).label("pour", 0.3).label("perk", 0.7);

  // ---------- state ----------
  // N: clocks and counters (typed: the step writes them every frame without boxing).
  const N = new Float64Array(16);
  const BEAT = 0, BEATS = 1, KEY = 2, STEAM = 3, ZZZ = 4, LEVEL = 5, SCROLL = 6, DES = 7, HOLD = 8, CLOCK = 9, WDIR = 10, TYPE = 11, HEAT = 12, STIR = 13, ZN = 14, ZC = 15;
  N[LEVEL] = 0.15;
  // Typing: each hand's position (lx, ly, rx, ry), its target, its press dip; the key lights (x, y,
  // width, glow) in a pool of 4; the keys typed so far (the first 32: r * 12 + c, 99 the trackpad).
  const HP = Float64Array.from(KEYS_HOME), HT = Float64Array.from(KEYS_HOME), PRS = new Float64Array(2), KL = new Float64Array(16), TYPED = new Uint8Array(32);
  // Typing and doodles draw from their own seeded generator (never Math.random, never the clock).
  const SEED = new Uint32Array([(o.seed ?? 2015) >>> 0 || 1]);
  const lcg = () => ((SEED[0] = Math.imul(SEED[0]!, 1664525) + 1013904223), SEED[0]! / 4294967296);
  // X: the other toys. Lamp (target, value), the can's clock, the drop timer, the plant's perk (value,
  // velocity, rest), writing (clock, slot), pages written, the hand that typed last, keys typed.
  const X = new Float64Array(12), LT = 0, LV = 1, DRT = 2, PK = 3, PKV = 4, PKR = 5, WT = 6, WS = 7, PAGES = 8, LASTH = 9, NTYPED = 10;
  X[LT] = X[LV] = 1, X[PK] = X[PKR] = 1, X[WT] = -1;
  // The water drops around the plant: x, y, age, life (0: free), radius.
  const DX = new Float64Array(16), DY = new Float64Array(16), DA = new Float64Array(16), DL = new Float64Array(16), DR = new Float64Array(16);
  let drew = "";
  // M: the music. The genre chosen, the genre playing (it changes at the next bar line), paused, the
  // next step's time on the audio clock, the step, the last phone tap, a single tap waiting (a
  // second tap within 250 ms makes it a double: pause, not a change). BARS: when the last bars began.
  const M = new Float64Array(8), GEN = 0, AG = 1, MP = 2, NEXT = 3, STEP = 4, PTAP = 5, PEND = 6, BN = 7, BARS = new Float64Array(8);
  M[PTAP] = -9;
  // Q: the cup and the pointer. The cup's top left (art units), its lift and target, the part under
  // the pointer, dragging, the press point, the grab offset, velocity (art units/s), the last move,
  // the clock, the last tap, spilled, the spill timer, the fall angle, the slide, righting, the line to say.
  const Q = new Float64Array(24);
  const CX = 0, CY = 1, LIFT = 2, LIFTT = 3, GRAB = 4, DRAG = 5, SX = 6, SY = 7, OX = 8, OY = 9, VX = 10, VY = 11, PX = 12, PY = 13, PT = 14, CLK = 15, TAPT = 16, SPILL = 17, SPT = 18, DIR = 19, KVX = 20, KVY = 21, RIGHT = 22, MSG = 23;
  Q[CX] = CUP.x, Q[CY] = CUP.y, Q[TAPT] = -9;
  // Squash springs, one per part: offset (-1 pressed), velocity, target.
  const SQ = new Float64Array(10), SQV = new Float64Array(10), SQT = new Float64Array(10);
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
  const canSip = () => X[WT]! < 0 && P[AW]! > 0.9 && !sip.playing && !Q[SPILL] && !Q[DRAG] && !pouring() && reachable();
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
  // ---------- the plant, the notebook, the lamp ----------
  const pop = (i: number) => void (reduce || ((SQ[i] = -0.6), (SQV[i] = 0)));
  function water() {
    pop(PLANTP);
    say(15);
    if (reduce) return void (X[PK] = X[PKR] = 1.07);
    can.seek(0), can.play();
  }
  let inkD = "", inkX = 122, inkW = 60, inkCode = false;
  function write() {
    pop(BOOKP);
    if (P[AW]! <= 0.9) return say(9);
    if (X[WT]! >= 0) return;
    // A line of code (three rows of strokes) or a doodle, from the seeded generator.
    if (lcg() < 0.4) {
      inkD = "";
      for (let r = 0, x = 0; r < 3; r++, x = 6 * ((lcg() * 3) | 0))
        for (let w = 6 + ((lcg() * 22) | 0); x + w <= 76; x += w + 5, w = 6 + ((lcg() * 22) | 0)) inkD += `M${x} ${4 + r * 8}h${w}`;
      (inkX = 122), (inkW = 72), (inkCode = true), (drew = "He wrote a line of code.");
    } else {
      const [name, d] = DOODLES[(lcg() * DOODLES.length) | 0]!;
      (inkD = d), (inkX = 122 + ((lcg() * 50) | 0)), (inkW = 24), (inkCode = false), (drew = `He drew ${name}.`);
    }
    X[WS] = X[PAGES]! % 3;
    X[PAGES]!++;
    X[11] = 1;
    X[WT] = reduce ? -1 : 0;
    engine.events.emit("scribble");
    say(18);
  }
  function lamp(on: boolean) {
    pop(LAMPP);
    X[LT] = +on;
    if (reduce) X[LV] = X[LT]!;
    engine.events.emit("lamp");
    say(on ? 16 : 17);
  }
  // The phone: a tap waits 250 ms (a second tap makes it a double: pause or resume), then changes
  // the style; the loop takes the new one at its next bar line.
  function phoneTap() {
    if (Q[CLK]! - M[PTAP]! < 0.3) return (M[PEND] = 0), (M[PTAP] = -9), hush();
    (M[PTAP] = Q[CLK]!), (M[PEND] = 1);
  }
  function genre() {
    M[GEN] = (M[GEN]! + 1) % 3;
    pop(PHONE);
    say(19);
  }
  function hush() {
    M[MP] = +!M[MP];
    pop(PHONE);
    say(M[MP] ? 20 : 19);
  }
  // One key press: a hand (mostly the other one) goes to a random key in its half, or in design mode
  // the right hand goes to the trackpad now and then; the key lights up.
  function typeKey() {
    const h = X[WT]! >= 0 ? 1 : lcg() < 0.7 ? 1 - X[LASTH]! : X[LASTH]!;
    X[LASTH] = h;
    PRS[h] = 1;
    let code = 99;
    if (mode === "design" && h === 1 && lcg() < 0.35) (HT[2] = 386 + lcg() * 34), (HT[3] = 370 + lcg() * 12);
    else {
      let c = h * 6 + ((lcg() * 6) | 0);
      const r = (lcg() * 5) | 0, sp = r === 4 && c > 3 && c < 8, kx = sp ? 367.6 : 302 + c * 16.4, ky = 262 + r * 15, kw = sp ? 62.6 : 13, j = (X[NTYPED]! % 4) * 4;
      if (sp) c = 4;
      HT[h * 2] = KEYS_HOME[h * 2]! + (kx + kw / 2 - TIPS_HOME[h * 2]!) * 0.6;
      HT[h * 2 + 1] = KEYS_HOME[h * 2 + 1]! + (ky + 5.5 - TIPS_HOME[h * 2 + 1]!) * 0.6;
      (KL[j] = kx), (KL[j + 1] = ky), (KL[j + 2] = kw), (KL[j + 3] = 1);
      code = r * 12 + c;
    }
    if (X[NTYPED]! < 32) TYPED[X[NTYPED]!] = code;
    X[NTYPED]!++;
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
      : inBox(BOX.laptop) ? LAP : inBox(BOX.person) ? PERSON : inBox(BOX.phone) ? PHONE : inBox(BOX.phones) ? PHONES : inBox(BOX.plant) ? PLANTP : inBox(BOX.book) ? BOOKP : inBox(BOX.lamp) ? LAMPP : 0;
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
    else if (g === PLANTP) tap("water");
    else if (g === BOOKP) tap("write");
    else if (g === LAMPP) tap("lamp");
    else if (g === PHONE) phoneTap();
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
      if (ctl.hit(WATK)) water();
      if (ctl.hit(WRTK)) write();
      if (ctl.hit(LMPK)) lamp(!X[LT]);
      if (ctl.hit(LIDK)) setLaptop(P[LID]! < 0.5 && N[WDIR]! <= 0);
      if (ctl.hit(MUSK)) hush();
      if (ctl.hit(GENK)) genre();
      if (M[PEND] && Q[CLK]! - M[PTAP]! >= 0.25) (M[PEND] = 0), genre();
      if (M[PEND]) e.busy();
      if (ctl.hit(SIPK)) {
        if (!reduce) (SQ[CUPP] = -0.6), (SQV[CUPP] = 0);
        drink();
      }
      // Rest at night when the laptop was closed by hand: the clock stops there until it opens.
      if (N[HOLD] && N[CLOCK] && !reduce && day.time % DAY >= REST) (day.pause(), (N[CLOCK] = 0));
      if (reduce) return;
      // The toys' own motion: squash springs, the lift, the knocked cup sliding, the spill timer, the pour.
      if (X[LV] !== X[LT]) {
        X[LV]! += (X[LT]! - X[LV]!) * Math.min(1, dt * 14);
        if (Math.abs(X[LV]! - X[LT]!) < 0.004) X[LV] = X[LT]!;
        e.busy();
      }
      // The can's drops: one every 60 ms while it pours, around the pot; each fades in 1 to 3 s.
      if (CAN[1]! > 0.5 && (X[DRT]! -= dt) <= 0) {
        X[DRT] = 0.06;
        for (let i = 0; i < 16; i++)
          if (!DL[i]) {
            const a = lcg() * 6.283, rr = 30 + lcg() * 28;
            (DX[i] = PLANT.x + Math.cos(a) * rr), (DY[i] = PLANT.y + Math.sin(a) * rr * 0.9), (DA[i] = 0), (DL[i] = 1 + lcg() * 2), (DR[i] = 2 + lcg() * 2.5);
            break;
          }
      }
      for (let i = 0; i < 16; i++) if (DL[i]) ((DA[i]! += dt) >= DL[i]! && (DL[i] = 0), e.busy());
      if (X[PK] !== X[PKR] || X[PKV]) {
        X[PKV]! += (260 * (X[PKR]! - X[PK]!) - 9 * X[PKV]!) * dt;
        X[PK]! += X[PKV]! * dt;
        if (Math.abs(X[PK]! - X[PKR]!) < 0.001 && Math.abs(X[PKV]!) < 0.01) (X[PK] = X[PKR]!), (X[PKV] = 0);
        e.busy();
      }
      if (X[WT]! >= 0 && (X[WT]! += dt) >= 1.3) X[WT] = -1;
      if (X[WT]! >= 0) e.busy();
      for (let j = 3; j < 16; j += 4) if (KL[j]) (KL[j] = Math.max(0, KL[j]! - dt * 2.4)), e.busy();
      for (let i = 1; i < 10; i++) {
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
      // The beat: while the headphones are on and the music plays, notes rise on the genre's beat
      // (its words, colours and rate); the head bobs to it (render).
      if (awake && P[PH]! > 0.95 && !M[MP]) {
        const g = M[AG]!;
        if ((N[BEAT]! -= dt) <= 0) {
          N[BEAT]! += 60 / BPM[g]!;
          if (N[BEATS]!++ % NOTE_EVERY[g]! === 0) {
            const s = N[BEATS]! & 2 ? 1 : -1, k = (N[BEATS]! / NOTE_EVERY[g]!) & 1;
            sfx(h.x + s * 54, h.y - 10, NOTE_W[g]![k]!, NOTE_C[g]![k]!, 20 + rand() * 6, -60 - rand() * 30);
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
          typeKey();
          if (rand() < 0.3) {
            const x = 320 + rand() * 160;
            if (mode === "code") sfx(x, 162, 4 + ((rand() * 5) | 0), 3 + ((rand() * 2) | 0) * 2 - 2, 12, -50 - rand() * 30);
            else emit(chip, x, 164, 1, 1, 4);
          }
        }
        // The hands glide to their keys and dip as they press.
        for (let i = 0; i < 4; i++) HP[i]! += (HT[i]! - HP[i]!) * Math.min(1, dt * 22);
        (PRS[0] = Math.max(0, PRS[0]! - dt * 7)), (PRS[1] = Math.max(0, PRS[1]! - dt * 7));
        e.busy();
      }
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
        else if (ev.type === "perk") (X[PKR] = 1.07), (X[PKV]! += 1.6);
      }
      if (resized) (fit(), (resized = false));
      const aw = P[AW]!, ph = P[PH]!, lid = P[LID]!, s = P[SIP]!, bdur = 60 / BPM[M[AG]!]!, bob = aw > 0.9 && ph > 0.95 && !M[MP] && !reduce ? Math.max(0, Math.cos((1 - N[BEAT]! / bdur) * Math.PI * 2)) * (M[AG] === 1 ? -3 : -2) : 0;
      // The loop, on the audio clock: schedule every step that starts in the next 0.2 s. It plays
      // while he wears the headphones, awake, unpaused, the scene playing and sound on (time >= 0);
      // otherwise it stops, and starts on a fresh bar.
      const at = snd.time;
      if (at >= 0 && aw > 0.9 && ph > 0.95 && !M[MP] && !paused && !reduce) {
        if (M[NEXT]! < at) (M[NEXT] = at + 0.05), (M[STEP] = 0);
        while (M[NEXT]! < at + 0.2) {
          if (!M[STEP]) (M[AG] = M[GEN]!), (BARS[M[BN]! % 8] = M[NEXT]!), M[BN]!++;
          const g = M[AG]!, cues = PAT[g]![M[STEP]!]!;
          for (let i = 0; i < cues.length; i++) snd.play(cues[i]!, 1, M[NEXT]!);
          M[NEXT]! += 60 / BPM[g]! / (STEPS[g]! / 4);
          M[STEP] = (M[STEP]! + 1) % STEPS[g]!;
        }
      } else (M[NEXT] = 0), (M[AG] = M[GEN]!);
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
      const hn = hands(aw, P[HD]!, HP), rc = reach(s), side = Q[CX]! + CUP.r < 400 ? 0 : 1, gx = cupAt(0) + (side ? 22 : -22), gy = cupAt(1) + 8;
      hn.ly += PRS[0]! * 2.5, hn.ry += PRS[1]! * 2.5;
      // Writing: the left hand goes to the book, the pen follows the stroke, then it comes back.
      const wt = X[WT]!, wb = wt < 0 ? 0 : wt < 0.25 ? wt / 0.25 : wt > 1.05 ? (1.3 - wt) / 0.25 : 1, wp = Math.min(1, Math.max(0, (wt - 0.25) / 0.8)), we = wb * wb * (3 - 2 * wb);
      if (we > 0) {
        const bx = inkX + 4 + wp * inkW - BOOK.cx, by = BOOK.y[X[WS]!]! + 12 + Math.sin(wp * 19) * 5 - BOOK.cy, ca = Math.cos(BOOK.a), sa = Math.sin(BOOK.a);
        hn.lx += (BOOK.cx + bx * ca - by * sa + 12 - hn.lx) * we, hn.ly += (BOOK.cy + bx * sa + by * ca + 18 - hn.ly) * we;
      }
      set(pen, "style", we > 0.5 ? "" : "display:none");
      for (const a of arms) {
        const i = a.s < 0 ? 0 : 1, tx = i ? hn.rx : hn.lx, ty = i ? hn.ry : hn.ly, d = armD(a.s, i === side ? tx + (gx - tx) * rc : tx, i === side ? ty + (gy - ty) * rc : ty), k = d.k;
        set(a.skin, "d", d.skin), set(a.sl, "d", d.sleeve), set(a.hem, "d", d.hem);
        set(a.hd, "transform", `translate(${k.hx} ${k.hy}) rotate(${k.deg})`);
      }
      // The key lights, the drops, the can, the plant's perk, the notebook's ink, the lamp.
      for (let j = 0; j < 4; j++) {
        const el = klit[j]!, g = KL[j * 4 + 3]!;
        set(el, "opacity", g.toFixed(2));
        if (g) set(el, "x", `${KL[j * 4]}`), set(el, "y", `${KL[j * 4 + 1]}`), set(el, "width", `${KL[j * 4 + 2]}`);
      }
      for (let i = 0; i < 16; i++) {
        const el = drops[i]!, f = DL[i] ? (DA[i]! < 0.15 ? DA[i]! / 0.15 : 1 - (DA[i]! - 0.15) / (DL[i]! - 0.15)) : 0;
        set(el, "r", (DR[i]! * f).toFixed(1));
        if (f) set(el, "cx", DX[i]!.toFixed(1)), set(el, "cy", (DY[i]! - 6 + Math.min(1, DA[i]! / 0.2) * 6).toFixed(1)), set(el, "opacity", f.toFixed(2));
      }
      const cd = 260 - 164 * CAN[0]!;
      set(canEl, "style", CAN[0]! > 0.001 ? "" : "display:none"), set(canEl, "transform", `translate(${(PLANT.x + 0.766 * cd).toFixed(1)} ${(PLANT.y - 0.643 * cd).toFixed(1)}) rotate(140)`);
      set(canB, "transform", `rotate(${Math.round(CAN[1]! * -14)})`), set(wstream, "stroke-width", (CAN[1]! * 4).toFixed(1)), set(wstream, "stroke-dashoffset", CAN[1] ? ((Q[CLK]! * -60) % 9).toFixed(1) : "0");
      set(sqf, "transform", sqT(0, 0, SQ[PLANTP]!)), set(leaves, "transform", X[PK] === 1 ? "" : `scale(${X[PK]!.toFixed(3)})`);
      set(sqb, "transform", sqT(155, 416, SQ[BOOKP]!)), set(sqm, "transform", sqT(118, 195, SQ[LAMPP]!));
      if (X[11]) {
        const el = inks[X[WS]!]!;
        set(el, "d", inkD), set(el, "transform", `translate(${inkX} ${BOOK.y[X[WS]!]})`), set(el, "class", inkCode ? "og-ink o-code" : "og-ink");
        X[11] = 0;
      }
      set(inks[X[WS]!]!, "stroke-dashoffset", wt < 0 ? "0" : (1 - wp).toFixed(3));
      wrap.style.setProperty("--lamp", `${Math.round(X[LV]! * 100) / 100}`);
      set(lampEl, "aria-label", X[LT] ? "Turn the lamp off" : "Turn the lamp on");
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
      set(pix, "href", pixURL[aw < 0.5 ? 2 : reduce || M[MP] || ph < 0.95 ? 0 : (N[BEATS]! & 1)]!);
      set(pix, "style", M[MP] ? "display:none" : "image-rendering:pixelated"), set(pzEl, "style", M[MP] ? "" : "display:none");
      set(genreEl, "textContent", GENRES[M[GEN]!]!.toUpperCase());
      set(phoneEl, "aria-label", `Music: ${GENRES[M[GEN]!]}${M[MP] ? ", paused" : ""}. Change style`);
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
        status.textContent = (Q[MSG] === 18 ? drew : Q[MSG] === 19 ? `Music: ${GENRES[M[GEN]!]}.` : SAY[Q[MSG]!]!) + (saidAt === Q[MSG] ? " " : "");
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
    if (name === "textContent") el.textContent = v;
    else el.setAttribute(name, v);
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
      day.pause(), wake.pause(), sip.pause(), pour.pause(), spill.pause(), can.pause();
      engine.wake(); // one frame to update the keys, then it settles
    },
    play() {
      if (!paused) return;
      paused = false;
      if (N[CLOCK]) day.play();
      if (N[WDIR] && wake.time > 0 && wake.time < wake.duration) goWake(N[WDIR]!);
      if (sip.time > 0 && sip.time < sip.duration) sip.play();
      if (pour.time > 0 && pour.time < pour.duration) pour.play();
      if (can.time > 0 && can.time < can.duration) can.play();
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
      let toys = +pour.playing + +spill.playing + +can.playing + +!!Q[DRAG] + +(Q[LIFT] !== Q[LIFTT]) + +!!(Q[KVX] || Q[KVY]) + +(Q[SPILL] === 1) + +(X[WT]! >= 0) + +(X[PK] !== X[PKR] || !!X[PKV]) + +(X[LV] !== X[LT]), drops = 0, lit = 0;
      for (let i = 1; i < 10; i++) toys += +!!(SQ[i] || SQV[i]);
      for (let i = 0; i < 16; i++) drops += +!!DL[i];
      for (let j = 3; j < 16; j += 4) lit += +(KL[j]! > 0.01);
      return { particles: fx.live, zzz: N[ZC]!, cup: { x: Q[CX]!, y: Q[CY]!, level: N[LEVEL]!, spilled: !!Q[SPILL], lifted: Q[LIFT]! > 0.5 }, toys: toys + drops, drops, pages: X[PAGES]!, lamp: !!X[LT], lit, keys: [...TYPED.subarray(0, Math.min(32, X[NTYPED]!))], music: { genre: GENRES[M[GEN]!]!, playing: GENRES[M[AG]!]!, paused: !!M[MP], bars: [...BARS.subarray(0, Math.min(8, M[BN]!))] } };
    },
    water: () => tap("water"),
    write: () => tap("write"),
    setLamp(on) {
      if (on !== !!X[LT]) tap("lamp");
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
