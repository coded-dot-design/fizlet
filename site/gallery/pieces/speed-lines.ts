// #21 Speed lines: a micro bowling game on a comic page. The page's heading, HERE COMES THE RUSH!,
// is real text, and its letters are the pins. Click a height and Dash, a rider on a pixel rocket,
// launches from the start flag on the left and streaks across at that height, speed lines blasting
// out behind. Every letter the rocket touches (a real hit test, box on box) is bowled over: it
// flies, spins, flashes and springs back up. Letters it only passes lean and stretch in its wind,
// then snap back. Bowl a whole line in one run for a STRIKE. Each run goes faster (the flame turns
// cyan at full boost). The exclamation mark is a heavy pin: hit it and the rocket bonks off it.
// Nothing on the page moves unless the rocket or its wind reaches it.
// Bricks: the kernel (fixed step, settle: it sleeps between runs), fzlt/sprite (the rider and the
// rocket as pixel data, baked once; the bonk flash as a palette), fzlt/slot (loads near the
// screen, never under reduced motion; destroy() gives the page back: every letter, through the ledger).
import { createEngine } from "../../../src/kernel/index";
import { sprites, type SpriteDef } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, offscreen, print, sfx, sfxW, bits } from "./pix";
import { letters, TX, TY, ROT, LEAN, STRETCH } from "./letters";

// Dash on the rocket, facing right: c helmet, v visor, p scarf, b suit and nozzle, y rocket,
// w shine, r nose cone. 24 × 12, the pivot at the rocket's middle.
const ROCKET: SpriteDef = {
  frames: [
    [
      "..........ccc...........",
      ".........ccccc..........",
      "........cccvvvv.........",
      "...pp...ccccccc.........",
      ".pp.pppbbbbbb...........",
      "......bbbbbbbbbb........",
      "....yyyyyyyyyyyyyyrr....",
      "bbbyyyyyyyyyyyyyyyyrrr..",
      "bbbyywwwwwyyyyyyyyyrrrr.",
      "bbbyyyyyyyyyyyyyyyyrrr..",
      "....yyyyyyyyyyyyyyrr....",
      "..bbb.........bbb.......",
    ],
  ],
  colors: { c: C.attack, v: C.rim, p: C.sys, b: C.cmd, y: C.hurt, w: C.ink, r: C.attack },
  outline: C.rim,
  ax: 12,
  ay: 8,
};

// ---------- The page: paper, a print screen of dots in one corner, the panel rule, the start flag ----------
function paintPage(g: CanvasRenderingContext2D) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);
  // Halftone, growing into the bottom right corner (a printed comic's shading).
  g.fillStyle = C.muted;
  for (let y = 4, row = 0; y < H - 3; y += 4, row++)
    for (let x = 4 + (row & 1) * 2; x < W - 3; x += 4) {
      const d = Math.hypot(W - x, H - y), s = d < 40 ? 2 : d < 70 ? 1 : 0;
      if (s) g.fillRect(x, y, s, s);
    }
  // The panel rule.
  g.fillStyle = C.rim;
  g.fillRect(2, 2, W - 4, 1);
  g.fillRect(2, H - 3, W - 4, 1);
  g.fillRect(2, 2, 1, H - 4);
  g.fillRect(W - 3, 2, 1, H - 4);
  // The start flag: a checkered post on the left edge.
  for (let y = 14; y < H - 8; y += 2) for (let x = 4; x < 8; x += 2) (g.fillStyle = ((x + y) >> 1) & 1 ? C.rim : C.ink), g.fillRect(x, y, 2, 2);
  g.fillStyle = C.rim;
  g.fillRect(3, 14, 1, H - 22);
  g.fillRect(8, 14, 1, H - 22);
}

export type RushScene = SlotScene & { engine: ReturnType<typeof createEngine>; send(y: number): void; readonly pins: number; readonly best: number };

// State slots.
const RX = 0, RY = 1, RV = 2, RUN = 3, DIR = 4, PINS = 5, BEST = 6, LEVEL = 7, BUMP = 8, BANNER = 9, BTYPE = 10, PEND = 11, PY = 12, AUTO = 13, DIRTY = 14, CLOCK = 15, LANE = 16, RUNS = 17, BONK = 18, SPIN = 19, LINE = 20;
// Speed lines: x where it left the rocket, y, seconds left, colour.
const NL = 40, LIFE = 0.42;

export function rush(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RushScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  // Two layers: the page and its speed lines under the heading, the rocket and the tally over it.
  const ctx = artCanvas(engine, stage), top = artCanvas(engine, slot, true);
  const page = offscreen(W, H);
  paintPage(page);
  const cast = sprites({ rocket: ROCKET }, { palettes: [{}, { "*": C.ink }] });
  const strike = offscreen(sfxW("STRIKE!") + 6, 15);
  sfx(strike, "STRIKE!", 2, 2, C.attack, C.hurt, C.rim, [0, -1, 0, 1]);
  const pins = letters(engine, slot, ".sl-h i");
  const n = pins.n;
  // The heavy pin: the exclamation mark.
  const heavy = new Uint8Array(n), down = new Uint8Array(n), passed = new Uint8Array(n);
  for (let i = 0; i < n; i++) heavy[i] = pins.els[i]!.hasAttribute("data-heavy") ? 1 : 0;
  const lx = new Float32Array(NL), ly = new Float32Array(NL), ll = new Float32Array(NL), lc = new Uint8Array(NL);
  const chips = bits(48, [C.rim, C.attack, C.hurt, C.sys]);
  const s = new Float64Array(24);
  s[AUTO] = first ? -1 : 0.6;
  s[DIRTY] = 1;
  s[DIR] = 1;

  const send = (y: number) => ((s[PY] = y), (s[PEND] = 1), engine.wake());
  if (first) send((first.y / stage.clientHeight) * H);
  slot.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per click, outside any frame
    send(((ev.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  function launch(y: number) {
    if (s[RUN]) return; // one rocket at a time: the next waits for a click after this one
    s[RUN] = 1;
    s[LANE] = Math.min(H - 12, Math.max(12, y));
    s[RX] = 4;
    s[RY] = s[LANE]!;
    s[DIR] = 1;
    s[RV] = 120 * (1 + 0.22 * s[LEVEL]!);
    s[PINS] = 0;
    s[BANNER] = 0;
    s[BONK] = 0;
    s[SPIN] = 0;
    s[CLOCK] = 0;
    for (let i = 0; i < n; i++) (down[i] = 0), (passed[i] = 0);
  }
  /** Letters in the rocket's line (their middles within its band): the row a STRIKE needs. */
  const inLane = (i: number) => Math.abs(pins.y[i]! - s[LANE]!) < pins.h[i]! * 0.5 + 2;

  function run(e: typeof engine, dt: number) {
    const v = s[RV]!, dir = s[DIR]!;
    s[CLOCK] = s[CLOCK]! + dt;
    s[RX] = s[RX]! + v * dir * dt;
    if (s[BONK]) (s[RY] = s[RY]! + 40 * dt), (s[SPIN] = s[SPIN]! + dt);
    s[BUMP] = Math.max(0, s[BUMP]! - dt);
    const x = s[RX]!, y = s[RY]!;
    // Speed lines out of the back, in a band around the rocket.
    if (!s[BONK]) {
      s[LINE] = s[LINE]! + dt * (60 + v * 0.3);
      while (s[LINE]! >= 1) {
        s[LINE] = s[LINE]! - 1;
        let k = 0;
        for (let i = 1; i < NL; i++) if (ll[i]! < ll[k]!) k = i;
        lx[k] = x - 12;
        ly[k] = Math.round(y + (e.random() - 0.5) * 26);
        ll[k] = LIFE;
        lc[k] = e.random() < 0.2 ? 1 : 0;
      }
    }
    // Collision: the rocket's box against each letter's box (shrunk a little: the ink, not the
    // line box). A touch bowls it over; the heavy one bonks the rocket back.
    for (let i = 0; i < n; i++) {
      const hw = pins.w[i]! * 0.4 + 10, hh = pins.h[i]! * 0.36 + 4;
      if (!down[i] && !s[BONK] && Math.abs(pins.x[i]! - x) < hw && Math.abs(pins.y[i]! - y) < hh) {
        down[i] = 1;
        if (heavy[i]) {
          // Bonk: the "!" only rocks; the rocket flips back the way it came.
          pins.kick(i, LEAN, -260, 0.12);
          s[BONK] = 1;
          s[DIR] = -1;
          s[RV] = 70;
          s[BANNER] = 1;
          s[BTYPE] = 2;
          for (let k = 0; k < 10; k++) chips.spawn(x + 8, y, -20 - e.random() * 60, -60 + e.random() * 70, 0.5, 1, 3);
          continue;
        }
        const f = 0.7 + v / 300, up = y > pins.y[i]! ? -1 : 1;
        pins.kick(i, TX, 900 * f, 0.22);
        pins.kick(i, TY, (-500 - e.random() * 300) * f * (up < 0 ? 1.2 : 0.8));
        pins.kick(i, ROT, (500 + e.random() * 500) * f);
        s[PINS] = s[PINS]! + 1;
        s[RV] = v * 0.95;
        s[BUMP] = 0.12;
        for (let k = 0; k < 6; k++) chips.spawn(pins.x[i]!, pins.y[i]!, 40 + e.random() * 80, -70 + e.random() * 90, 0.45 + e.random() * 0.3, 1, (e.random() * 3) | 0);
      }
      // The wind: a letter the lines pass (and the rocket missed) leans and stretches, then snaps back.
      if (!down[i] && !passed[i] && dir > 0 && x > pins.x[i]! && Math.abs(pins.y[i]! - y) < pins.h[i]! * 0.5 + 15) {
        passed[i] = 1;
        const near = 1 - Math.min(1, Math.abs(pins.y[i]! - y) / (pins.h[i]! * 0.5 + 15));
        pins.kick(i, LEAN, -(120 + v * 0.9) * (0.4 + near));
        pins.kick(i, STRETCH, (60 + v * 0.5) * (0.4 + near));
        pins.kick(i, TX, (80 + v * 0.4) * near);
      }
    }
    // Off the page: the run's tally, a STRIKE if the whole line went down, and more boost next time.
    if (x > W + 30 || x < -30) {
      s[RUN] = 0;
      s[RUNS] = s[RUNS]! + 1;
      let row = 0, hit = 0;
      for (let i = 0; i < n; i++) if (inLane(i) && !heavy[i]) (row++, down[i] && hit++);
      if (!s[BONK]) (s[BANNER] = 1.3), (s[BTYPE] = row > 0 && hit === row ? 1 : 0);
      s[BEST] = Math.max(s[BEST]!, s[PINS]!);
      s[LEVEL] = Math.min(4, s[LEVEL]! + 1);
    }
  }

  engine.add({
    read() {
      pins.read();
    },
    step(e, dt) {
      if (s[PEND]) (s[PEND] = 0), launch(s[PY]!);
      // On its own, once: through the first line of the heading.
      if (s[AUTO]! > 0 && (s[AUTO] = s[AUTO]! - dt) <= 0) launch(pins.n ? pins.y[0]! : H / 2);
      let busy = s[AUTO]! > 0 || chips.live > 0;
      if (s[RUN]) run(e, dt), (busy = true);
      for (let i = 0; i < NL; i++) if (ll[i]! > 0) (ll[i] = ll[i]! - dt), (busy = true);
      if (s[BANNER]! > 0) (s[BANNER] = s[BANNER]! - dt), (busy = true);
      chips.step(dt, 220, H - 4);
      if (pins.step(dt)) busy = true;
      if (busy) (e.busy(), (s[DIRTY] = 1));
    },
    render() {
      pins.render();
      if (!s[DIRTY]) return;
      s[DIRTY] = 0;
      draw(ctx, top);
    },
  });

  function draw(g: CanvasRenderingContext2D, f: CanvasRenderingContext2D) {
    g.drawImage(page.canvas, 0, 0);
    f.clearRect(0, 0, W, H);
    // The scoreboard, lettered on the page.
    print(g, "RUN", 12, 6, C.rim);
    print(g, "PINS", 40, 6, C.rim);
    print(g, "BEST", 72, 6, C.rim);
    g.fillStyle = C.attack;
    num(g, s[RUNS]!, 26, 6);
    num(g, s[PINS]!, 58, 6);
    num(g, s[BEST]!, 90, 6);
    // Boost pips: how fast the next run goes.
    for (let i = 0; i < 4; i++) (g.fillStyle = i < s[LEVEL]! ? C.sys : C.muted), g.fillRect(132 + i * 5, 7, 4, 3);
    // Speed lines: each shrinks toward the rocket's path as it fades.
    for (let i = 0; i < NL; i++) {
      if (ll[i]! <= 0) continue;
      const k = ll[i]! / LIFE, len = Math.round(10 + 34 * k), x1 = Math.round(lx[i]!), x0 = x1 - len + Math.round((1 - k) * len * 0.6);
      g.fillStyle = lc[i] ? C.sys : C.rim;
      g.fillRect(x0, ly[i]!, x1 - x0, 1);
    }
    chips.draw(g);
    // Over the heading: the rocket, its flame, the tally.
    g = f;
    if (s[RUN]) {
      const x = Math.round(s[RX]!), y = Math.round(s[RY]! + (s[BUMP]! > 0 ? 1 : 0)), t = s[CLOCK]!, boost = s[LEVEL]! >= 4;
      // The flame: flickering lengths, cyan at full boost (out when it bonks).
      if (!s[BONK]) {
        const fl = 5 + (((t * 30) | 0) % 3) * 2 + s[LEVEL]!;
        g.fillStyle = boost ? C.sys : C.attack;
        g.fillRect(x - 13 - fl, y - 2, fl, 3);
        g.fillStyle = boost ? C.ink : C.hurt;
        g.fillRect(x - 13 - (fl >> 1), y - 1, fl >> 1, 1);
      }
      if (s[BONK] && ((s[SPIN]! / 0.08) | 0) & 1) {
        // Tumbling: upside down every other beat.
        const tile = cast.tile("rocket", 0, 1, 0);
        g.save();
        g.translate(x, y);
        g.scale(-1, -1);
        g.drawImage(tile, -13, -6);
        g.restore();
      } else cast.draw(g, "rocket", 0, x, y, 0, 1, s[BONK] && s[SPIN]! < 0.1 ? 1 : 0);
    }
    // The run's tally: STRIKE! slams in; otherwise the pin count; BONK! off the heavy one.
    const b = s[BANNER]!;
    if (b > 0) {
      if (s[BTYPE] === 1) {
        const z = b > 1.24 ? 1.3 : b > 1.18 ? 0.92 : 1, w = Math.round(strike.canvas.width * z), h = Math.round(strike.canvas.height * z);
        g.drawImage(strike.canvas, Math.round(W / 2 - w / 2), Math.round(H - 12 - h / 2), w, h);
      } else {
        const bonk = s[BTYPE] === 2, x = bonk ? Math.round(s[RX]! + 6) : W - 40, y = bonk ? Math.round(s[RY]! - 16) : H - 14;
        g.fillStyle = C.rim;
        g.fillRect(x - 2, y - 2, bonk ? 23 : 31, 9);
        print(g, bonk ? "BONK!" : "PINS", x, y, bonk ? C.hurt : C.ink);
        if (!bonk) (g.fillStyle = C.hurt), num(g, s[PINS]!, x + 18, y);
      }
    }
  }
  engine.start();
  return {
    engine,
    send,
    /** Letters bowled on the last run, and the best run so far. */
    get pins() {
      return s[PINS]!;
    },
    get best() {
      return s[BEST]!;
    },
    destroy: () => engine.destroy(),
  };
}

// Two digits in the caption font (no string is built per frame): the current fillStyle.
const DIGITS = "0123456789";
function num(g: CanvasRenderingContext2D, v: number, x: number, y: number) {
  const c = g.fillStyle as string, t = Math.min(99, v | 0);
  print(g, DIGITS[(t / 10) | 0]!, x, y, c);
  print(g, DIGITS[t % 10]!, x + 4, y, c);
}

/** The poster: the first run, just launched toward the heading (scripts/gallery-posters.mjs). */
export const posterAt = 0.95;

/** For `slot(fig, () => import("./speed-lines").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => rush(stage, slot, first);
