// "FizzBuzz" (dev-humor): the interview classic, played out on a desk. A counter ticks 1, 2, 3…
// On a multiple of 3 the soda can pops its tab and fizzes (FIZZ): the spray splashes the counter
// and drips off its edges, bubbles pop on its underside. On a multiple of 5 a bee buzzes in (BUZZ)
// and bonks into the counter before it goes over. On 15 it's both: the bee dives into the fizz and
// comes out a fizzy bee. Tap the stage (or Space) to count faster. Or call the next one before it
// ticks: FIZZ, BUZZ, both (FIZZ + BUZZ: FIZZBUZZ) or 123 for the number (keys F, B, N or any digit);
// every right call grows the streak, a wrong or a skipped one breaks it. Leave it alone for six
// ticks and it stops (and sleeps); at 100 it's done.
// Bricks: the kernel (fixed step; settle; its ledger for the canvas, the keys and the stage's
// attributes, so Recall gives the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound; the
// keys strip (keys.ts) and the pixel font (pix.ts). The game is `fizzGame()`: plain numbers, no DOM,
// no allocation a step (tests/fizzbuzz.test.mjs, with the FizzBuzz rule checked against 1–100).
import { createEngine } from "../../../src/kernel/index";
import { seeded } from "../../../src/kernel/random";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { keys } from "./keys";
import { C, H, W, print, textW } from "./pix";

/** FizzBuzz: 0 the number, 1 FIZZ, 2 BUZZ, 3 FIZZBUZZ. Fizz and buzz are bits: 3 is both. */
export const fizzbuzz = (n: number) => (n % 3 === 0 ? 1 : 0) | (n % 5 === 0 ? 2 : 0);
/** What FizzBuzz prints for n. */
export const SAYS = ["", "FIZZ", "BUZZ", "FIZZBUZZ"] as const;
export const said = (n: number) => SAYS[fizzbuzz(n)] || String(n);
/** A call: FIZZ 1, BUZZ 2, both 3, the number 4. The right call for n. */
export const NUMBER = 4;
export const call = (n: number) => fizzbuzz(n) || NUMBER;
/** Modes: waiting, the attract count, counting, stopped (the card). */
export const IDLE = 0, DEMO = 1, RUN = 2, DONE = 3;
/** Events this step. */
export const EV_TICK = 0, EV_FIZZ = 1, EV_BUZZ = 2, EV_RIGHT = 3, EV_WRONG = 4, EV_BONK = 5, EV_FIZZY = 6, EV_POP = 7;
export const SLOW = 0.9, FAST = 0.32, LAST = 100, QUIET = 6;
// State slots.
const MODE = 0, N = 1, CLOCK = 2, BEAT = 3, GUESS = 4, STREAK = 5, BEST = 6, SKIP = 7, RES = 8, RESAGE = 9, T = 10;
const BX = 11, BY = 12, BVX = 13, BVY = 14, BK = 15, BONK = 16, CAN = 17, SHAKE = 18, CALLS = 19, RIGHTS = 20, FIZZT = 21, TICKAGE = 22;
/** The counter (the panel's box), the desk, the can's mouth. */
export const PL = 62, PR = 118, PT = 14, PB = 50, DESK = 70, MX = 30, MY = 35;
/** Bee kinds: none, buzzing, the fizzy dive, fizzy. */
const BEE = 1, DIVE = 2, FIZZY = 3;

/** The game on plain numbers. */
export function fizzGame() {
  const S = new Float64Array(24), ev = new Uint8Array(8);
  // Spray: drops (fall) and bubbles (rise), and the can's tab: position, velocity, life, kind.
  const P = 120, X = new Float32Array(P), Y = new Float32Array(P), VX = new Float32Array(P), VY = new Float32Array(P), L = new Float32Array(P), K = new Uint8Array(P), at = new Uint32Array(1);
  // Seeded noise (the kernel's): the test replays it.
  const rnd = seeded(7);
  function spawn(x: number, y: number, vx: number, vy: number, life: number, k: number) {
    const i = at[0]! % P;
    at[0] = i + 1;
    (X[i] = x), (Y[i] = y), (VX[i] = vx), (VY[i] = vy), (L[i] = life), (K[i] = k);
  }
  function start(demo: boolean) {
    (S[MODE] = demo ? DEMO : RUN), (S[N] = 0), (S[BEAT] = demo ? 0.3 : SLOW), (S[CLOCK] = demo ? 0.3 : 0.7), (S[GUESS] = 0), (S[STREAK] = 0), (S[SKIP] = 0), (S[RES] = 0), (S[CALLS] = 0), (S[RIGHTS] = 0);
    if (!demo) S[BEST] = 0;
  }
  /** The next number ticks over: judge the call, set off the can and the bee. */
  function tick() {
    const n = (S[N] = S[N]! + 1), f = fizzbuzz(n), want = call(n), g = S[GUESS]!;
    (ev[EV_TICK] = 1), (S[TICKAGE] = 0);
    if (S[MODE] === RUN) {
      if (g) {
        S[CALLS] = S[CALLS]! + 1;
        if (g === want) (S[STREAK] = S[STREAK]! + 1), (S[RIGHTS] = S[RIGHTS]! + 1), (S[BEST] = Math.max(S[BEST]!, S[STREAK]!)), (S[RES] = 1), (ev[EV_RIGHT] = 1);
        else (S[STREAK] = 0), (S[RES] = 2), (ev[EV_WRONG] = 1);
        S[SKIP] = 0;
      } else {
        if (S[STREAK]! > 0) (S[STREAK] = 0), (S[RES] = 3), (ev[EV_WRONG] = 1);
        else S[RES] = 0;
        S[SKIP] = S[SKIP]! + 1;
      }
      S[RESAGE] = 0;
    }
    S[GUESS] = 0;
    if (f & 1) {
      // FIZZ: the tab pops, the can jumps, a spray of drops and a column of bubbles.
      (S[CAN] = 0.001), (S[FIZZT] = f === 3 ? 1.4 : 0.8), (ev[EV_FIZZ] = 1);
      spawn(MX + 4, MY - 2, 22, -80, 2, 2);
      for (let j = 0; j < (f === 3 ? 34 : 24); j++) spawn(MX + rnd() * 6 - 3, MY, 14 + rnd() * 56, -40 - rnd() * 70, 1.8, 0);
    }
    if (f === 2) (S[BK] = BEE), (S[BX] = W + 8), (S[BY] = 24 + rnd() * 18), (S[BVX] = -78), (S[BVY] = 0), (S[BONK] = 0), (ev[EV_BUZZ] = 1);
    if (f === 3) (S[BK] = DIVE), (S[BX] = W + 8), (S[BY] = 6), (S[BVX] = -84), (S[BVY] = 0), (S[BONK] = 0), (ev[EV_BUZZ] = 1);
    if (S[MODE] === DEMO && n >= 15) S[MODE] = IDLE;
    if (S[MODE] === RUN && (n >= LAST || S[SKIP]! >= QUIET)) S[MODE] = DONE;
  }
  const g = {
    S, ev, X, Y, L, K, P,
    /** Call the next one: FIZZ (1) or BUZZ (2) toggle (both: FIZZBUZZ), NUMBER sets the number. */
    guess(c: number) {
      if (S[MODE] !== RUN) start(false);
      const was = S[GUESS]!;
      S[GUESS] = c === NUMBER ? (was === NUMBER ? 0 : NUMBER) : (was === NUMBER ? 0 : was) ^ c;
      S[SKIP] = 0;
    },
    /** A tap: start counting, or count faster. */
    faster() {
      if (S[MODE] !== RUN) return start(false);
      S[BEAT] = Math.max(FAST, S[BEAT]! * 0.8);
      S[SKIP] = 0;
    },
    start,
    step(dt: number) {
      ev.fill(0);
      S[T] = S[T]! + dt;
      (S[RESAGE] = S[RESAGE]! + dt), (S[TICKAGE] = S[TICKAGE]! + dt);
      const m = S[MODE]!;
      if (m === RUN || m === DEMO) {
        S[CLOCK] = S[CLOCK]! - dt;
        if (S[CLOCK]! <= 0) (S[CLOCK] = S[CLOCK]! + S[BEAT]!), tick();
      }
      // The fizz keeps bubbling up out of the can for a moment.
      if (S[FIZZT]! > 0) {
        S[FIZZT] = S[FIZZT]! - dt;
        if (rnd() < 0.35) spawn(MX + rnd() * 10 - 5, MY - 1, (rnd() - 0.5) * 10, -16 - rnd() * 14, 0.6 + rnd() * 0.6, 1);
      }
      if (S[CAN]! > 0) S[CAN] = S[CAN]! + dt;
      if (S[CAN]! > 0.6) S[CAN] = 0;
      if (S[SHAKE]! > 0) S[SHAKE] = Math.max(0, S[SHAKE]! - dt);
      // The bee: in from the right; a buzzing bee bonks into the counter, backs off and goes over it.
      const bk = S[BK]!;
      if (bk) {
        S[BONK] = S[BONK]! + (S[BONK]! > 0 ? dt : 0);
        if (bk === BEE && !S[BONK] && S[BX]! - 10 <= PR && S[BY]! > PT - 6 && S[BY]! < PB + 4) (S[BONK] = 0.001), (S[BVX] = 46), (S[BVY] = -40), (S[SHAKE] = 0.3), (ev[EV_BONK] = 1);
        if (bk === BEE && S[BONK]! > 0.3) (S[BVX] = -82), (S[BVY] = (7 - S[BY]!) * 3);
        if (bk === DIVE && S[BX]! < 70) (S[BVY] = (MY - 10 - S[BY]!) * 3), (S[BVX] = -62);
        if (bk === DIVE && S[BX]! < MX + 12) (S[BK] = FIZZY), (S[BVX] = -46), (S[BVY] = -12), (ev[EV_FIZZY] = 1);
        S[BX] = S[BX]! + S[BVX]! * dt;
        S[BY] = S[BY]! + S[BVY]! * dt;
        if (S[BX]! < -14 || S[BY]! < -14) S[BK] = 0;
      }
      // The spray: drops fall, splash on top of the counter and drip off it, bounce off its sides
      // and pop on the desk; bubbles rise and pop on its underside or at the top.
      let alive = 0;
      for (let i = 0; i < P; i++) {
        if (L[i]! <= 0) continue;
        alive++;
        L[i] = L[i]! - dt;
        const k = K[i]!, x0 = X[i]!, y0 = Y[i]!;
        if (k === 1) (VY[i] = VY[i]! - 10 * dt), (VX[i] = VX[i]! + Math.sin(S[T]! * 9 + i) * 20 * dt);
        else VY[i] = VY[i]! + 150 * dt;
        X[i] = x0 + VX[i]! * dt;
        Y[i] = y0 + VY[i]! * dt;
        const x = X[i]!, y = Y[i]!;
        if (x > PL && x < PR) {
          if (k !== 1 && y0 <= PT && y > PT) (Y[i] = PT), (VY[i] = 0), (VX[i] = VX[i]! * 0.5);
          else if (k === 1 && y0 >= PB && y < PB) (L[i] = 0), (ev[EV_POP] = 1);
          else if (k !== 1 && y > PT && y < PB) (X[i] = x0 < PL ? PL : PR), (VX[i] = -VX[i]! * 0.4);
        }
        if (k !== 1 && Y[i]! >= DESK) {
          (Y[i] = DESK), (VY[i] = k === 2 ? -VY[i]! * 0.4 : 0), (VX[i] = VX[i]! * 0.6);
          if (k === 0 && L[i]! > 0.4) L[i] = 0.4;
        }
        if (k === 1 && y < 2) L[i] = 0;
      }
      return m === RUN || m === DEMO || alive > 0 || S[BK]! > 0 || S[CAN]! > 0 || S[SHAKE]! > 0 || S[RESAGE]! < 1 || S[TICKAGE]! < 1.4;
    },
  };
  return g;
}
export type FizzGame = ReturnType<typeof fizzGame>;

export type FizzScene = SlotScene & { engine: ReturnType<typeof createEngine>; game: FizzGame; poster(): void };

// Sprites: rows of keys. The can (a cyan bubble label on purple), the bee (two wing frames, facing left).
const CAN_ART = ["..kkkkkkkk..", ".kssssssssk.", ".kkkkkkkkkk.", "kppppppppppk", "kpwppppppppk", "kpwppppcpppk", "kpwpppcwcppk", "kpwcppcwcppk", "kpcwcppcpppk", "kpwcppppcppk", "kpwpppppcppk", "kpwpaaaaappk", "kpwppppppppk", "kpwppppppppk", "kppppppppppk", ".kkkkkkkkkk.", ".kssssssssk.", "..kkkkkkkk.."];
const BEE_ART = [["....ww.ww.", "....wwwww.", "..kyykyyk.", ".kwykyykyk", ".kkykyykyk", "..kyykyyk.", "...k...k.."], ["..........", "...wwwwww.", "..kyykyyk.", ".kwykyykyk", ".kkykyykyk", "..kyykyyk.", "...k...k.."]];
const KEYS: Record<string, string> = { k: C.rim, s: C.muted, p: C.cmd, c: C.sys, w: C.ink, a: C.attack, y: C.hurt };
const SAY_COL = [C.ink, C.sys, C.hurt, C.attack];
const DIGITS = /* @__PURE__ */ Array.from({ length: LAST + 1 }, (_, i) => String(i));
const RES_WORD = ["", "YES!", "NOPE", "MISSED"];
const BG = "#110d22", WOOD = "#3f296a", WOOD2 = "#6a3ae6", SCREEN = "#0b0918";

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FizzScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const L = engine.ledger;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.imageRendering = "pixelated";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const game = fizzGame(), S = game.S;
  const snd = sound(engine, {
    cues: { tick: "click", fizz: "fizz", buzz: "buzz", right: "power", wrong: "hurt", bonk: "hit", fizzy: "win" },
    notes: {
      fizz: [[1800, 3400, 0.09, 0, "square", 0.03], [2600, 4200, 0.08, 0.05, "square", 0.025], [2000, 3800, 0.08, 0.1, "square", 0.02]],
      buzz: [[150, 140, 0.4, 0, "sawtooth", 0.06], [152, 146, 0.4, 0, "square", 0.03]],
    },
    volume: 0.1,
  });
  // FIZZ, BUZZ and 123 (toggles: FIZZ + BUZZ is FIZZBUZZ), a tap on the stage for faster, and mute.
  const B = keys(engine, stage, [
    { id: 1, label: "FIZZ", aria: "Call FIZZ next (F)" },
    { id: 2, label: "BUZZ", aria: "Call BUZZ next (B)" },
    { id: NUMBER, label: "123", aria: "Call the number next (N)" },
    { id: 9, label: "♪", aria: "Mute (M)" },
  ], (id, down) => down && (id === 9 ? mute() : id === 8 ? game.faster() : game.guess(id), engine.wake()), 8);
  const mute = () => {
    snd.on = !snd.on;
    B[3]!.textContent = snd.on ? "♪" : "✕";
    B[3]!.setAttribute("aria-pressed", snd.on ? "false" : "true");
  };
  L.attr(stage, "tabindex", "0");
  L.attr(stage, "role", "application");
  L.attr(stage, "aria-label", "FizzBuzz. Tap or Space: count faster. Call the next one before it ticks: F fizz, B buzz, both for fizzbuzz, N for the number. M: mute.");
  L.style(stage, "touch-action", "manipulation");
  stage.addEventListener("keydown", (e) => {
    if (e.target !== stage || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code, id = c === "KeyF" ? 1 : c === "KeyB" ? 2 : c === "KeyN" || /^(Digit|Numpad)\d$/.test(c) ? NUMBER : c === "Space" || c === "Enter" ? 8 : c === "KeyM" ? 9 : -1;
    if (id < 0) return;
    e.preventDefault();
    id === 9 ? mute() : id === 8 ? game.faster() : game.guess(id);
    engine.wake();
  }, { signal: engine.signal });
  // The keys show the call you've made (aria-pressed: the site's sheet lights a pressed key).
  const shown = new Float64Array(1).fill(-1);
  if (first) game.faster();
  else game.start(true);
  void slot;

  const px = (x: number, y: number, w: number, h: number, c: string) => ((g.fillStyle = c), g.fillRect(x | 0, y | 0, w, h));
  /** A sprite at two art pixels a key. */
  function sprite(rows: readonly string[], x: number, y: number) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]!;
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") px(x + i * 2, y + j * 2, 2, 2, KEYS[row[i]!]!);
    }
  }
  /** Pixel text with a rim, centred on x. */
  function say(s: string, x: number, y: number, c: string, k: number) {
    const x0 = Math.round(x - textW(s, k) / 2);
    for (let d = 0; d < 4; d++) print(g, s, x0 + (d === 0 ? -k : d === 1 ? k : 0), y + (d === 2 ? -k : d === 3 ? k : 0), C.rim, k);
    print(g, s, x0, y, c, k);
  }
  engine.add({
    step(e, dt) {
      if (game.step(dt)) e.busy();
      const ev = game.ev;
      if (ev[EV_TICK]) e.events.emit("tick");
      if (ev[EV_FIZZ]) e.events.emit("fizz");
      if (ev[EV_BUZZ]) e.events.emit("buzz");
      if (ev[EV_RIGHT]) e.events.emit("right");
      if (ev[EV_WRONG]) e.events.emit("wrong");
      if (ev[EV_BONK]) e.events.emit("bonk");
      if (ev[EV_FIZZY]) e.events.emit("fizzy");
    },
    render() {
      const t = S[T]!, n = S[N]! | 0, f = fizzbuzz(n), m = S[MODE]!;
      // The keys light up with the call.
      if (shown[0] !== S[GUESS]) {
        shown[0] = S[GUESS]!;
        const q = S[GUESS]!;
        L.attr(B[0]!, "aria-pressed", q & 1 && q !== NUMBER ? "true" : "false");
        L.attr(B[1]!, "aria-pressed", q & 2 && q !== NUMBER ? "true" : "false");
        L.attr(B[2]!, "aria-pressed", q === NUMBER ? "true" : "false");
      }
      // The wall: a dark room with a dot grid; the desk.
      px(0, 0, W, H, BG);
      for (let y = 6; y < DESK; y += 8) for (let x = 4 + ((y >> 3) & 1) * 4; x < W; x += 8) px(x, y, 1, 1, C.line);
      px(0, DESK, W, H - DESK, WOOD), px(0, DESK, W, 1, WOOD2), px(0, DESK + 1, W, 1, C.rim);
      for (let x = 6; x < W; x += 22) px(x, DESK + 6, 12, 1, C.rim);
      // The counter: a hard-shadowed board with a screen; a bonk shakes it.
      const sh = S[SHAKE]! > 0 ? Math.round(Math.sin(t * 70) * 2 * S[SHAKE]! / 0.3) : 0;
      const cx = PL + sh;
      px(cx + 24, PB, 12, DESK - PB, C.rim), px(cx + 25, PB, 10, DESK - PB, WOOD);
      px(cx + 3, PT + 3, PR - PL, PB - PT, C.rim);
      px(cx, PT, PR - PL, PB - PT, C.rim), px(cx + 1, PT + 1, PR - PL - 2, PB - PT - 2, WOOD2), px(cx + 3, PT + 3, PR - PL - 6, PB - PT - 12, SCREEN);
      // What FizzBuzz prints for n (the number itself, or the word), and n underneath.
      if (n > 0) {
        const s = f ? SAYS[f]! : DIGITS[n]!, k = f === 3 ? 1 : f ? 2 : 4, mid = (PL + PR) / 2 + sh;
        say(s, mid, f === 3 ? 26 : f ? 22 : 18, SAY_COL[f]!, k);
        if (f) print(g, DIGITS[n]!, mid - textW(DIGITS[n]!) / 2, 33, C.muted, 1);
      } else say("0", (PL + PR) / 2, 18, C.line, 4);
      // Time to the next tick: a bar that drains.
      if (m === RUN || m === DEMO) px(cx + 3, PB - 7, (PR - PL - 6) * Math.max(0, S[CLOCK]!) / S[BEAT]!, 2, S[CLOCK]! < 0.2 ? C.attack : C.go);
      // Speed: five pips.
      const lvl = Math.round(Math.log(SLOW / S[BEAT]!) / Math.log(1 / 0.8));
      for (let i = 0; i < 5; i++) px(cx + 4 + i * 4, PB - 4, 3, 1, i < lvl ? C.hurt : C.line);
      // The can: pops its tab and jumps.
      const ca = S[CAN]!, jump = ca > 0 ? Math.round(Math.sin(Math.min(1, ca / 0.3) * 3.14) * 4) : 0;
      px(MX - 10, DESK - 1, 24, 2, C.rim);
      sprite(CAN_ART, MX - 12, DESK - 36 - jump);
      // The tab sits on the lid until it pops (a fresh can after every fizz).
      if (ca === 0 && S[FIZZT]! <= 0) px(MX + 1, DESK - 37, 6, 2, C.muted), px(MX + 1, DESK - 37, 6, 1, C.ink);
      // The spray: drops (cyan, white), bubbles (rings), the tab.
      for (let i = 0; i < game.P; i++) {
        const l = game.L[i]!;
        if (l <= 0) continue;
        const k = game.K[i]!, x = game.X[i]! | 0, y = game.Y[i]! | 0;
        if (k === 0) px(x, y, l > 0.5 ? 2 : 1, l > 0.5 ? 2 : 1, i & 1 ? C.sys : C.ink);
        else if (k === 1) px(x, y, 2, 1, C.sys), px(x, y + 3, 2, 1, C.sys), px(x - 1, y + 1, 1, 2, C.sys), px(x + 2, y + 1, 1, 2, C.sys);
        else px(x, y, 6, 2, C.muted), px(x, y, 6, 1, C.ink);
      }
      // The bee: two wing frames; fizzy, it trails bubbles and hiccups.
      if (S[BK]!) {
        const bx = S[BX]! | 0, by = (S[BY]! + Math.sin(t * 20) * 1.2) | 0;
        sprite(BEE_ART[((t * 16) | 0) & 1]!, bx - 10, by - 7);
        if (S[BK] === FIZZY) for (let k = 0; k < 5; k++) {
          const a = t * 6 + k * 1.26, x = bx + Math.cos(a) * 13, y = by + Math.sin(a) * 9;
          px(x, y, 2, 1, C.sys), px(x, y + 3, 2, 1, C.sys), px(x - 1, y + 1, 1, 2, C.sys), px(x + 2, y + 1, 1, 2, C.sys);
        }
        if (S[BONK]! > 0 && S[BONK]! < 0.6) for (let k = 0; k < 3; k++) {
          const a = S[BONK]! * 10 + k * 2.1;
          px(bx + Math.cos(a) * 8, by - 10 + Math.sin(a) * 2, 2, 2, C.hurt);
        }
      }
      // The words: FIZZ! BUZZ! over what made them, the call's result over the counter.
      if (n > 0 && S[TICKAGE]! < (f === 3 ? 1.2 : 0.5)) {
        const u = S[TICKAGE]!;
        if (f & 1) say(f === 3 ? "FIZZBUZZ!" : "FIZZ!", f === 3 ? 90 : MX + 2, (f === 3 ? 56 : 24) - u * 6, f === 3 ? C.attack : C.sys, f === 3 ? 2 : 1);
        if (f === 2) say("BUZZ!", 140, 16 - u * 6, C.hurt, 1);
      }
      if (S[RES]! && S[RESAGE]! < 0.9) say(RES_WORD[S[RES]!]!, 140, 42 - Math.min(0.2, S[RESAGE]!) * 10, S[RES] === 1 ? C.go : C.attack, 1);
      // Your call (the next one), the streak and the best.
      const q = S[GUESS]!;
      if (q && m === RUN) {
        const s = q === NUMBER ? DIGITS[Math.min(LAST, n + 1)]! : SAYS[q]!;
        const bw = textW(s) + 12, x0 = Math.min(PR + 6, W - 3 - bw);
        px(x0, 24, bw, 9, C.rim), px(x0 + 1, 25, bw - 2, 7, C.ink), px(x0 + 3, 33, 3, 2, C.rim);
        print(g, "?", x0 + 3, 26, C.cmd, 1), print(g, s, x0 + 8, 26, C.rim, 1);
      }
      // The streak and the best, on their own chips over everything (the bee flies under them).
      px(2, 2, 37, 9, C.rim), px(122, 2, 36, 9, C.rim);
      print(g, "STREAK", 4, 4, C.muted, 1), say(DIGITS[Math.min(LAST, S[STREAK]!)]!, 32, 4, S[STREAK]! > 0 ? C.go : C.ink, 1);
      print(g, "BEST", 126, 4, C.muted, 1), say(DIGITS[Math.min(LAST, S[BEST]!)]!, 150, 4, C.hurt, 1);
      if (m === IDLE && S[TICKAGE]! > 1.3) say("TAP TO COUNT", 92, 56, C.ink, 1), say("OR CALL THE NEXT ONE", 92, 63, C.muted, 1);
      if (m === DONE) {
        px(44, 54, 72, 14, C.rim);
        if (n >= LAST) say("100! DONE", 80, 56, C.ink, 1);
        else say("STOPPED AT", 72, 56, C.ink, 1), say(DIGITS[n]!, 72 + textW("STOPPED AT") / 2 + 4 + textW(DIGITS[n]!) / 2, 56, C.hurt, 1);
        print(g, "TAP TO GO AGAIN", 80 - textW("TAP TO GO AGAIN") / 2, 62, C.muted, 1);
      }
    },
  });
  engine.start();
  return {
    engine,
    game,
    poster() {},
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract count at 15, the fizzy bee in the fizz. */
export const posterAt = 5.1;
