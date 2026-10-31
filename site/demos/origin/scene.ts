/**
 * Origin: Code. Sleep. Drink. Repeat. A desk at night, seen from above: he sleeps with his head on
 * the desk. The sun comes up, he wakes, puts the headphones on (♪, the beat), drinks his coffee
 * (steam, the sip) and codes all day on the laptop and the phone. Night falls, he closes the laptop
 * and sleeps. Repeat. Design mode swaps the screens' code for design work (shapes, swatches, a grid).
 * Close the laptop (tap it, or Enter on it) and he goes to sleep; open it and the day starts.
 *
 * Bricks, each on a part you can see: the kernel (one loop, 30 fps cap, settle, the ledger),
 * fizlet/timeline (the day/night cycle on CSS custom properties; the wake/sleep and sip sequences on
 * a typed array), fizlet/fx (notes, steam, code sparks, the Zzz), fizlet/sound (the beat, key clicks,
 * the sip; silent until a gesture, mute key), fizlet/input (taps on the props, the lid key),
 * fizlet/sprite (the pixel coder on the phone). "Show bricks" labels each part with its brick and
 * its gzip bytes (scripts/sizes.mjs, put in by the build).
 *
 * Rules: off screen or in a hidden tab the kernel pauses it; pause() rests it at 0 frames; reduced
 * motion gets still frames (lighting crossfades in CSS, no particles, no typing); the step never
 * allocates; every change to the host goes through the ledger, so destroy() gives the root back.
 */
import { createEngine } from "../../../src/kernel/index";
import { timeline } from "../../../src/timeline";
import { effects, emitter } from "../../../src/fx";
import { sound } from "../../../src/sound";
import { controls } from "../../../src/input";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import type { SlotMount, SlotScene } from "../../../src/slot";
import { ORIGIN_WHY, ORIGIN_WHY_BEATS } from "./copy";
import { why, art, CSS, BOX, C, VB, head, headT, hands, cupT, LIQUID, brew, phonesT, cord, screenT, coverT } from "./art";

declare const __ORIGIN_BRICKS__: Record<string, number> | undefined;
/** Brick → gzip bytes, measured by the build (scripts/sizes.mjs); empty when bundled elsewhere. */
const BRICKS: Record<string, number> = typeof __ORIGIN_BRICKS__ === "object" ? __ORIGIN_BRICKS__ : {};

export type OriginMode = "code" | "design";
export interface OriginOptions {
  /** What the screens show (default "code"). */
  mode?: OriginMode;
  /** Sound armed (default true): still silent until the visitor's first gesture. */
  sound?: boolean;
  /** Label every moving part with its brick and size (default false). */
  showBricks?: boolean;
  /** Calm version (default: the visitor's prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** The scene's own key row: mode, bricks, sound, pause (default true). */
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
  setShowBricks(on: boolean): void;
  setSound(on: boolean): void;
  /** Open (day, he wakes) or close (night, he sleeps) the laptop. */
  setLaptop(open: boolean): void;
  /** Rest: every clock stops, the kernel settles (0 frames a second). */
  pause(): void;
  play(): void;
  readonly state: OriginState;
  /** He drinks (when awake). */
  sip(): void;
  /** Nudge him awake (when asleep). */
  nudge(): void;
  /** Live particles and Zs floated so far (tests, the debug HUD). */
  stats(): { particles: number; zzz: number };
}

// The day, in seconds of a 24 s loop (one second an hour).
const DAY = 24, DAWN = 2.4, WAKE = 4.2, NOON = 9, DUSK = 15.4, SLEEP = 19.2, REST = 21.2;
// Pose slots (the wake and sip timelines write these): awake, headphones on, lid open, hands on keys, sip.
const AW = 0, PH = 1, LID = 2, HD = 3, SIP = 4;
// fx colours and words.
const COLORS = [C.cream, C.red, C.sun, C.tealL, C.ink, "#ffffff", "#5a3526", "#b98a66"];
const WORDS = ["♪", "♫", "z", "Z", "{ }", "</>", ";", "=>", "#"];
const WORD = 4; // fx's word-shaped part
let uid = 0; // each mount's own SVG ids (a poster or a second scene on the page has its own)

// The pixel coder on the phone (fizlet/sprite): two dance frames and one asleep.
const PIX: SpriteDef = {
  frames: [
    ["...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".csessssesc.", "..ssssssss..", "..sssmmsss..", "...ssssss...", "..rrrrrrrr..", ".srrrrrrrrs.", ".srrrrrrrrs.", "..rrrrrrrr..", "..bb....bb.."],
    ["...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".csessssesc.", "..ssssssss..", "..sssmmsss..", "s..ssssss..s", "srrrrrrrrrrs", "..rrrrrrrr..", "..rrrrrrrr..", "..rrrrrrrr..", "...bb..bb..."],
    ["............", "...hhhhhh...", "..hhhhhhhh..", ".chsssssshc.", ".cskssssksc.", "..ssssssss..", "...ssssss...", "..rrrrrrrr..", ".srrrrrrrrs.", ".srrrrrrrrs.", "..rrrrrrrr..", "..bb....bb.."],
  ],
  colors: { h: C.ink, s: C.skin, e: C.ink, k: C.inkL, c: C.cream, m: C.red, r: C.red, b: C.ink },
};

/** Mount the scene into `root` (it fills it: give the root a size; 16:10 is the shape it is drawn
 *  for, and it crops to any other around the middle). Returns the scene's controls. */
export function mount(root: HTMLElement, o: OriginOptions = {}): OriginScene {
  const reduce = o.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const speed = o.speed ?? 1;
  const engine = createEngine({ root, fps: 30, settle: 0.4 });
  const L = engine.ledger, rand = engine.random;
  let mode: OriginMode = o.mode ?? "code", tags = !!o.showBricks, paused = false, music = true;

  // ---------- DOM: one wrapper (the ledger removes it), the art, the fx canvas, the key row ----------
  if (getComputedStyle(root).position === "static") L.style(root, "position", "relative");
  const wrap = L.add(document.createElement("div"));
  wrap.className = `og${reduce ? " og--reduce" : ""}${tags ? " og--tags" : ""}`;
  const cup = o.cup ?? new URL("coffee.png", import.meta.url).href;
  wrap.innerHTML = `<style>${CSS}</style><div class="og-l">${art({ aw: 0, ph: 0, lid: 0, hd: 0 }, mode, cup, o.bricks ?? BRICKS, `og${++uid}-`)}<canvas></canvas></div>${why(ORIGIN_WHY, reduce ? ORIGIN_WHY : ORIGIN_WHY_BEATS[0]!, reduce ? "WHY" : "1/4")}` +
    (o.controls === false ? "" : `<div class="og-bar"><button type="button" data-k="mode" aria-pressed="false">Design mode</button><button type="button" data-k="tags" aria-pressed="false">Show bricks</button><button type="button" data-k="sound" aria-pressed="true">Sound</button><button type="button" data-k="pause" aria-pressed="false">Pause</button></div>`);
  root.append(wrap);
  const layer = wrap.querySelector<HTMLElement>(".og-l")!, svg = layer.querySelector("svg")!, cv = layer.querySelector("canvas")!;
  const q = <T extends Element = SVGElement>(s: string) => svg.querySelector<T>(s)!;
  const qa = (s: string) => [...svg.querySelectorAll<SVGElement>(s)];
  const headEl = q(".og-head"), phonesEl = q(".og-phones"), cordEl = q(".og-cord"), cupEl = q(".og-cup"), cupImg = q(".og-cupimg"), liquid = q(".og-liquid"), body = q(".og-body");
  const armL = q(".og-arm-l"), armR = q(".og-arm-r"), handL = q(".og-hand-l"), handR = q(".og-hand-r");
  const screen = q(".og-screen"), cover = q(".og-cover"), scrl = q(".og-scrl"), laptop = q(".og-laptop");
  const scroll = q(".og-scroll"), caret = q(".og-caret"), arrow = q(".og-arrow"), sel = q(".og-sel"), shape = q(".og-shape");
  const pix = q(".og-pix"), codeEls = qa(".og-code"), desEls = qa(".og-des");
  const keysEl = [...wrap.querySelectorAll<HTMLButtonElement>(".og-bar button")];
  const ctx = cv.getContext("2d")!;
  const beatEl = wrap.querySelector<HTMLElement>(".og-beat")!, stepEl = wrap.querySelector<HTMLElement>(".og-why b")!;
  const pixURL = [0, 1, 2].map((f) => spriteURL(PIX, f));

  // ---------- the stage's shape: crop the art around the middle; the canvas follows ----------
  // k: CSS px per art unit; vx, vy: the art's top left on screen. Read on resize only (ResizeObserver).
  const view = new Float64Array(5); // k, vx, vy, W, H
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
    view[0] = W / w, view[1] = vx, view[2] = vy, view[3] = W, view[4] = H;
    ctx.setTransform(view[0]! * dpr, 0, 0, view[0]! * dpr, -vx * view[0]! * dpr, -vy * view[0]! * dpr);
  }

  // ---------- fx: one pool on one canvas ----------
  const fx = effects({ cap: 220, colors: COLORS, words: WORDS, scorch: 0 });
  const { ids: { puff, chip, bub, splash }, emit } = emitter(fx, {
    puff: { shape: "disc", drag: 0.7, gravity: 0, angle: -1.5708, spread: 0.6, speed: [12, 24], size: [3, 6], life: [1.3, 2.1] },
    chip: { shape: "square", drag: 1.6, gravity: 0, angle: -1.5708, spread: 1.4, speed: [30, 70], size: [3, 5], life: [0.6, 1] },
    bub: { shape: "ring", drag: 3, gravity: 0, angle: -1.5708, spread: 6.28, speed: [1, 5], size: [1.2, 2.4], life: [0.35, 0.8] },
    splash: { shape: "square", drag: 2.4, gravity: 0, angle: 0, spread: 6.28, speed: [30, 80], size: [1.5, 3], life: [0.3, 0.6] },
  });

  // ---------- sound: events → cues (silent until a gesture; the Sound key mutes) ----------
  const snd = sound(engine, {
    cues: { beat: "kick", key: "tick", slurp: "slurp", clink: "clink", wake: "yawn", sleep: "end", nudge: "nudge" }, on: o.sound ?? true, volume: 0.3,
    notes: {
      kick: [[150, 48, 0.2, 0, "sine", 0.9], [2400, 1800, 0.03, 0, "square", 0.04]],
      tick: [[2200, 1500, 0.018, 0, "square", 0.12]],
      slurp: [[260, 820, 0.16, 0, "sawtooth", 0.16], [820, 420, 0.12, 0.15, "triangle", 0.2], [500, 700, 0.08, 0.3, "sawtooth", 0.1]],
      clink: [[2600, 2500, 0.12, 0, "triangle", 0.4], [3900, 3800, 0.08, 0.01, "sine", 0.25]],
      yawn: [[380, 240, 0.55, 0, "sine", 0.5], [240, 300, 0.5, 0.5, "triangle", 0.35]],
      nudge: [[300, 200, 0.1, 0, "triangle", 0.5]],
    },
  });

  // ---------- input: taps on the props, the lid key ----------
  const ctl = controls(engine, { keys: { lid: [], sip: [], music: [], nudge: [] }, target: layer });
  const LIDK = ctl.id("lid"), SIPK = ctl.id("sip"), MUSK = ctl.id("music"), NUDK = ctl.id("nudge");
  body.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter" && (ev as KeyboardEvent).key !== " ") return;
    ev.preventDefault();
    ctl.press("nudge"), ctl.press("nudge", false);
  }, { signal: engine.signal });
  laptop.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key !== "Enter" && (ev as KeyboardEvent).key !== " ") return;
    ev.preventDefault();
    ctl.press("lid"), ctl.press("lid", false);
  }, { signal: engine.signal });

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
  // The sip: cup to his mouth, a slurp, back.
  const sip = timeline(engine, { rate: speed, motion: true }).to(P, { [SIP]: [0, 1, 1, 0] }, { dur: 2.4, ...io }).label("slurp", 1.1).label("clink", 2.3);

  // ---------- state ----------
  // N: clocks and counters (typed: the step writes them every frame without boxing).
  // beat timer, beats, key timer, steam timer, zzz timer, cup level, scroll, design cursor time, held at night (1), clock on (1), wake dir.
  const N = new Float64Array(16);
  const HEAT = 12, STIR = 13, ZN = 14, ZC = 15;
  const BEAT = 0, BEATS = 1, KEY = 2, STEAM = 3, ZZZ = 4, LEVEL = 5, SCROLL = 6, DES = 7, HOLD = 8, CLOCK = 9, WDIR = 10, TYPE = 11;
  N[LEVEL] = 0.15;
  N[HEAT] = 0;
  const T = new Float64Array(2); // typing offsets for the two hands
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

  // ---------- the scene system ----------
  const sfx = (x: number, y: number, w: number, c: number, size: number, vy: number) =>
    fx.spawn(WORD, x, y, (rand() - 0.5) * 30, vy, size, 1.3 + rand() * 0.5, c, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.5, w);
  engine.add({
    step(e, dt) {
      if (paused) return;
      // Taps (fizlet/input): which prop is under the pointer, in art units.
      if (ctl.pointer.hit) {
        const x = view[1]! + ctl.pointer.x / view[0]!, y = view[2]! + ctl.pointer.y / view[0]!;
        const inBox = (b: readonly number[]) => x >= b[0]! && x <= b[0]! + b[2]! && y >= b[1]! && y <= b[1]! + b[3]!;
        if (inBox(BOX.laptop)) ctl.press("lid"), ctl.press("lid", false);
        else if (inBox(BOX.cup)) ctl.press("sip"), ctl.press("sip", false);
        else if (inBox(BOX.person) && P[AW]! < 0.5) ctl.press("nudge"), ctl.press("nudge", false);
        else if (inBox(BOX.phone) || inBox(BOX.phones)) ctl.press("music"), ctl.press("music", false);
      }
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
      if (ctl.hit(SIPK) && P[AW]! > 0.9 && !sip.playing) sip.play();
      // Rest at night when the laptop was closed by hand: the clock stops there until it opens.
      if (N[HOLD] && N[CLOCK] && !reduce && day.time % DAY >= REST) (day.pause(), (N[CLOCK] = 0));
      if (reduce) return;
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
      if (N[HEAT]! > 0.5 && N[LEVEL]! > 0.3 && P[SIP]! < 0.05 && rand() < dt * 6 * N[HEAT]!) {
        const a = rand() * 6.283, r = rand() * 13 * N[LEVEL]!;
        emit(bub, 196 + 39 + Math.cos(a) * r, 268 + 43 + Math.sin(a) * r * 0.9, 1, 0, 1);
      }
      if (N[LEVEL]! > 0.2 && N[HEAT]! > 0.15 && (N[STEAM]! -= dt * speed * N[HEAT]!) <= 0) {
        N[STEAM] = 0.32;
        emit(puff, 196 + (324 - 196) * P[SIP]! + 39 + (rand() - 0.5) * 12, 268 + (366 - 268) * P[SIP]! + 30, 1, 0, 1);
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
        if (ev.type === "dawn") (N[LEVEL] = 1), (N[HEAT] = 1);
        else if ((ev.type === "slurp" || ev.type === "clink") && !reduce) emit(splash, ev.type === "clink" ? 235 : 360, ev.type === "clink" ? 311 : 404, 5, 6, 2);
        else if (ev.type === "wake" && !N[HOLD]) goWake(1);
        else if (ev.type === "sleep") goWake(-1);
        else if (ev.type === "sip" && P[AW]! > 0.9 && !sip.playing) sip.play();
      }
      if (resized) (fit(), (resized = false));
      const aw = P[AW]!, ph = P[PH]!, lid = P[LID]!, s = P[SIP]!, bob = aw > 0.9 && ph > 0.95 && music && !reduce ? Math.max(0, Math.cos((0.5 - N[BEAT]!) * Math.PI * 4)) * -2 : 0;
      const hn = hands(aw, P[HD]!, s, T[0]!, T[1]!);
      set(headEl, "transform", N[STIR]! > 0 ? `${headT(aw, s, bob)} rotate(${(Math.sin(N[STIR]! * 40) * 6).toFixed(1)})` : headT(aw, s, bob));
      set(phonesEl, "transform", phonesT(ph, aw, s, bob));
      set(cordEl, "d", cord(ph, aw, s));
      set(cupEl, "transform", cupT(s));
      set(armL, "x2", `${hn.lx}`), set(armL, "y2", `${hn.ly}`), set(handL, "cx", `${hn.lx}`), set(handL, "cy", `${hn.ly}`);
      set(armR, "x2", `${hn.rx}`), set(armR, "y2", `${hn.ry}`), set(handR, "cx", `${hn.rx}`), set(handR, "cy", `${hn.ry}`);
      set(screen, "transform", screenT(lid)), set(scrl, "transform", screenT(lid)), set(cover, "transform", coverT(lid));
      const fr = Math.round(N[LEVEL]! * 11), lq = LIQUID[fr]!;
      set(cupImg, "x", `${-fr * 84}`), set(cupImg, "y", mode === "design" ? "-84" : "0");
      set(liquid, "cx", `${lq[0]}`), set(liquid, "cy", `${lq[1]}`), set(liquid, "rx", `${lq[2]}`), set(liquid, "ry", `${lq[3]}`);
      set(liquid, "fill", brew(mode === "design", Math.round(N[HEAT]! * 20) / 20));
      // Screens.
      set(scroll, "transform", `translate(0 ${-((N[SCROLL]! % 112) | 0)})`);
      set(caret, "opacity", (N[DES]! * 2) % 2 < 1 ? "1" : "0");
      const d = N[DES]! % 6, k = (d / 2) | 0, f = Math.min(1, (d % 2) * 1.5), sx = [376, 446, 404][k]!, sy = [214, 168, 210][k]!, px = [446, 404, 376][k]!, py = [168, 210, 214][k]!;
      set(arrow, "transform", `translate(${(sx + (px - sx) * f).toFixed(1)} ${(sy + (py - sy) * f).toFixed(1)})`);
      set(sel, "x", `${[374, 326, 422][k]}`);
      set(shape, "r", `${10 + (k === 1 ? f * 3 : 0)}`);
      set(pix, "href", pixURL[aw < 0.5 ? 2 : reduce || !music || ph < 0.95 ? 0 : (N[BEATS]! & 1)]!);
      for (const c of codeEls) set(c, "style", mode === "code" ? "" : "display:none");
      for (const c of desEls) set(c, "style", mode === "design" ? "" : "display:none");
      set(body, "aria-label", aw < 0.5 ? "Nudge him awake" : "He is working");
      set(laptop, "aria-label", lid > 0.5 ? "Close the laptop: he sleeps" : "Open the laptop: he wakes");
      // The why, one sentence per part of the day: before (night), in between (dawn), built (the
      // day's work), shared (afternoon into dusk). Calm: the whole line stays.
      if (!reduce) {
        const t = day.time % DAY, b = t < DAWN || t >= SLEEP + 1 ? 0 : t < WAKE + 1.4 ? 1 : t < 11 ? 2 : 3;
        if (beatEl.textContent !== ORIGIN_WHY_BEATS[b]) (beatEl.textContent = ORIGIN_WHY_BEATS[b]!), (stepEl.textContent = `${b + 1}/${ORIGIN_WHY_BEATS.length}`);
      }
      // Our own wrapper: the screen glow follows the lid.
      wrap.style.setProperty("--glow", `${Math.round(lid * 100) / 100}`);
      wrap.className = `og${reduce ? " og--reduce" : ""}${tags ? " og--tags" : ""}`;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.restore();
      fx.draw(ctx, true);
      // The key row and the host's event, on change only.
      const st = `${mode}${lid > 0.5}${tags}${snd.on}${paused}`;
      if (st !== last) {
        last = st;
        if (keysEl.length) {
          keysEl[0]!.setAttribute("aria-pressed", `${mode === "design"}`);
          keysEl[1]!.setAttribute("aria-pressed", `${tags}`);
          keysEl[2]!.setAttribute("aria-pressed", `${snd.on}`);
          keysEl[2]!.textContent = snd.on ? "Sound" : "Muted";
          keysEl[3]!.setAttribute("aria-pressed", `${paused}`);
          keysEl[3]!.textContent = paused ? "Play" : "Pause";
        }
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
    if (k === "mode") scene.setMode(mode === "code" ? "design" : "code");
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
      day.pause(), wake.pause(), sip.pause();
      engine.wake(); // one frame to update the keys, then it settles
    },
    play() {
      if (!paused) return;
      paused = false;
      if (N[CLOCK]) day.play();
      if (N[WDIR] && wake.time > 0 && wake.time < wake.duration) goWake(N[WDIR]!);
      if (sip.time > 0 && sip.time < sip.duration) sip.play();
      engine.wake();
    },
    get state() {
      return { mode, open: P[LID]! > 0.5, bricks: tags, sound: snd.on, paused, awake: P[AW]! > 0.5 };
    },
    sip() {
      ctl.press("sip"), ctl.press("sip", false);
    },
    nudge() {
      ctl.press("nudge"), ctl.press("nudge", false);
    },
    stats() {
      return { particles: fx.live, zzz: N[ZC]! };
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

/** For fizlet/slot: options from the slot figure's data attributes (data-mode, data-bricks="1",
 *  data-sound="0", data-speed). */
export const mountSlot: SlotMount = (stage, fig) => {
  const d = fig.dataset;
  return mount(stage, { mode: d.mode === "design" ? "design" : "code", showBricks: d.bricks === "1", sound: d.sound !== "0", ...(+d.speed! > 0 && { speed: +d.speed! }) });
};
