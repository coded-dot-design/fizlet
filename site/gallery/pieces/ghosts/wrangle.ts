// Wrangle: the Spook Sweep crew ("we mop the paranormal") answer a call at the public library,
// where a slime ghost is loose in the stacks: it ricochets off the heading's letters and knocks the
// books over, then sits on the shelf pulling faces. Tap it and both crew fire their scrub streams:
// the streams latch on, wobbling, and the ghost fights them (it jerks, the streams strain, the crew
// lean back). Drag (or tap where to pull it) and it follows, struggling, smashing through whatever
// it's dragged across; pull it over the mop-bucket trap and the lid SNAPS shut in a burst. Too slow
// and the wands overheat: PFFT, and it's loose again. Miss, and the streams zap the page where you
// tapped. Every bag sends the next ghost out of a letter, in a new flavour.
// Bricks: the kernel (fixed step, seeded random; settle: no frames once the ghost sits still; the
// ledger for every page write, so Recall gives the page back byte for byte) and fzlt/sprite (the
// ghost, the crew, the bucket and its lid, baked once). Shared world: spook.ts (with Smoosh, Overflow).
import { createEngine } from "../../../../src/kernel/index";
import { sprites } from "../../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { W, H, artCanvas, bits, print } from "../pix";
import { letters, TX, TY, ROT } from "../letters";
import { GHOST, FLAVOURS, CREW, CREWS, BUCKET, LID, GLOWS, NOZZLE_X, NOZZLE_Y, RIM, stream, shout } from "./spook";

export type WrangleScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; aim(x: number, y: number): void; readonly mode: number; readonly bagged: number; readonly x: number; readonly y: number };

const { abs, max, min, round, sin, cos, hypot, exp, PI } = Math;
const FLOOR = 82, BX = 80, CX0 = 14, CX1 = 146, NY = FLOOR + NOZZLE_Y;
// Modes.
export const PERCH = 0, FREE = 1, LATCH = 2, SUCK = 3, BAGGED = 4, LAND = 5;
// State slots (a const enum: inlined to plain numbers in the live chunk).
const enum K { MODE = 0, T = 1, X = 2, Y = 3, VX = 4, VY = 5, PX = 6, PY = 7, HEAT = 8, BAG = 9, FLAV = 10, LA = 11, Q = 12, QX = 13, QY = 14, WORD = 15, WT = 16, WX = 17, WY = 18, MISS = 19, MX = 20, MY = 21, JERK = 22, SQ = 23, WPX = 24, WPY = 25, WPT = 26, FT = 27, AUTO = 28, BURST = 29, HOP = 30, DIRTY = 31, PFF = 32, LX = 33, LY = 34, CHEER = 35, TT = 36, X0 = 37, Y0 = 38, BY = 39 }
const TIMERS = [K.MISS, K.BURST, K.PFF, K.CHEER];
// The page, in order: the heading's 12 letters (5 is the comma), the notice's 5 words, the sign, 13 books.
const LETTERS = 12, BOOK0 = 18;
const WORDS = ["SNAP!", "BAGGED!", "PFFT!", "NYAH!", "BOO!"];

export function wrangle(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): WrangleScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 1e9) | 0 });
  const rnd = engine.random;
  const wrap = slot.querySelector<HTMLElement>(".wl")!;
  const g = artCanvas(engine, stage, true);
  const ghostArt = sprites({ ghost: GHOST }, { palettes: FLAVOURS });
  const crewArt = sprites({ crew: CREW }, { palettes: CREWS });
  const kit = sprites({ bucket: BUCKET, lid: LID }, { palettes: GLOWS });
  const lt = letters(engine, wrap, "i");
  const n = lt.n, CD = new Float32Array(n);
  const sparks = bits(64, ["#19f0ff", "#f6f3ff", "#ff2e88", "#ffc21a"]);
  const S = new Float64Array(40);
  // The intro: as if one was just bagged, the first ghost (SMUDGE, grape) bursts out of a letter.
  S[K.MODE] = BAGGED;
  S[K.T] = 1.25;
  S[K.FLAV] = 3;
  S[K.WORD] = 4;
  S[K.WT] = 9;
  S[K.DIRTY] = 1;
  S[K.AUTO] = first ? 0 : 1.7;
  engine.busy(first ? 0 : 1.8); // the intro (a loose ghost, one demo miss) is scheduled: hold for it

  const tap = (x: number, y: number) => ((S[K.QX] = x), (S[K.QY] = y), (S[K.Q] = 1), engine.wake());
  const aim = (x: number, y: number) => {
    if (S[K.MODE] === LATCH) (S[K.PX] = x), (S[K.PY] = y);
  };
  const at = (e: PointerEvent, f: (x: number, y: number) => void) => {
    const r = stage.getBoundingClientRect(); // one read per pointer event, outside any frame
    f(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => e.isPrimary && at(e, tap), { signal: engine.signal });
  stage.addEventListener("pointermove", (e) => e.isPrimary && S[K.MODE] === LATCH && at(e, aim), { signal: engine.signal });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (w: number, x: number, y: number) => ((S[K.WORD] = w), (S[K.WT] = 0), (S[K.WX] = max(18, min(W - 18, x))), (S[K.WY] = max(3, min(64, y))));
  const near = (x: number, y: number) => abs(x - S[K.X]!) < 13 && abs(y - S[K.Y]!) < 13;

  /** Loose: a new waypoint, and some time before it settles on a perch. */
  function loose(sec: number) {
    S[K.FT] = sec;
    S[K.WPT] = 0;
    to(FREE);
  }
  function fire(x: number, y: number) {
    if (near(x, y)) {
      // Latched: both streams on it, the lid flips open, it's a fight.
      S[K.PX] = S[K.X]!;
      S[K.PY] = S[K.Y]!;
      S[K.HEAT] = 0;
      return to(LATCH);
    }
    // A miss: the streams hit the page where you tapped, and the ghost is off.
    S[K.MISS] = 0.32;
    S[K.MX] = x;
    S[K.MY] = y;
    for (let i = 0; i < n; i++)
      if (abs(x - lt.x[i]!) < lt.w[i]! / 2 + 3 && abs(y - lt.y[i]!) < lt.h[i]! / 2 + 3) lt.kick(i, TY, -260, 0.3), lt.kick(i, ROT, (rnd() - 0.5) * 500);
    for (let j = 0; j < 10; j++) sparks.spawn(x, y, (rnd() - 0.5) * 90, -rnd() * 80, 0.4, 1, j & 3);
    if (S[K.MODE] === PERCH) say(3, S[K.X]!, S[K.Y]! - 16);
    S[K.VX] = (S[K.X]! - x) * 4 + (rnd() - 0.5) * 60;
    S[K.VY] = -60;
    loose(2.2);
  }
  /** The ghost against the page: it bounces off what it hits, and what it hits gets knocked. */
  function bump(power: number) {
    for (let i = 0; i < n; i++) {
      if (CD[i]! > 0) continue;
      const ox = 7 + lt.w[i]! / 2 - abs(S[K.X]! - lt.x[i]!), oy = 7 + lt.h[i]! / 2 - abs(S[K.Y]! - lt.y[i]!);
      if (ox <= 0 || oy <= 0) continue;
      CD[i] = 0.3;
      const sx = S[K.X]! < lt.x[i]! ? -1 : 1, sy = S[K.Y]! < lt.y[i]! ? -1 : 1;
      if (ox < oy) (S[K.X] = S[K.X]! + ox * sx), (S[K.VX] = sx * abs(S[K.VX]!) * 0.8);
      else (S[K.Y] = S[K.Y]! + oy * sy), (S[K.VY] = sy * abs(S[K.VY]!) * 0.8);
      lt.kick(i, ROT, (S[K.VX]! || sx) * -3 * power, 0.12);
      lt.kick(i, TX, -sx * 160 * power);
      lt.kick(i, TY, -sy * 120 * power);
      S[K.SQ] = 0.3;
      for (let j = 0; j < 4; j++) sparks.spawn(S[K.X]! - sx * 7, S[K.Y]!, -sx * rnd() * 50, -rnd() * 50, 0.3, 1, 2);
    }
  }

  engine.add({
    read() {
      lt.read();
    },
    step(e, dt) {
      let busy = false;
      let m = S[K.MODE]!, t = (S[K.T] = S[K.T]! + dt);
      if (S[K.AUTO]! > 0 && (S[K.AUTO] = S[K.AUTO]! - dt) <= 0) fire(S[K.X]! + 22, S[K.Y]! + 4); // the crew's first try: a miss
      if (S[K.Q]) {
        S[K.Q] = 0;
        if (m === LATCH) (S[K.PX] = S[K.QX]!), (S[K.PY] = S[K.QY]!);
        else if (m === PERCH || m === FREE || m === LAND) fire(S[K.QX]!, S[K.QY]!);
        (m = S[K.MODE]!), (t = S[K.T]!);
      }
      const gx = S[K.X]!, gy = S[K.Y]!;
      if (m === FREE) {
        // Loose in the stacks: it darts between waypoints, ricocheting off the page.
        if ((S[K.WPT] = S[K.WPT]! - dt) <= 0) (S[K.WPT] = 0.5 + rnd() * 0.5), (S[K.WPX] = 14 + rnd() * 132), (S[K.WPY] = 10 + rnd() * 56);
        const dx = S[K.WPX]! - gx, dy = S[K.WPY]! - gy, d = hypot(dx, dy) || 1;
        S[K.VX] = S[K.VX]! + ((dx / d) * 75 - S[K.VX]!) * 2.2 * dt;
        S[K.VY] = S[K.VY]! + ((dy / d) * 75 - S[K.VY]!) * 2.2 * dt;
        if ((S[K.FT] = S[K.FT]! - dt) <= 0) {
          // Enough: it picks a perch on a book or a letter and floats down onto it.
          let i = rnd() < 0.35 ? (rnd() * LETTERS) | 0 : BOOK0 + ((rnd() * (n - BOOK0)) | 0);
          if (i === 5) i = 4;
          (S[K.LX] = lt.x[i]!), (S[K.LY] = lt.y[i]! - lt.h[i]! / 2 - 8.5), to(LAND);
        }
      } else if (m === LAND) {
        S[K.VX] = S[K.VX]! + ((S[K.LX]! - gx) * 30 - S[K.VX]! * 9) * dt;
        S[K.VY] = S[K.VY]! + ((S[K.LY]! - gy) * 30 - S[K.VY]! * 9) * dt;
        if (t > 1.2 || (abs(S[K.LX]! - gx) < 0.5 && abs(S[K.LY]! - gy) < 0.5 && hypot(S[K.VX]!, S[K.VY]!) < 3)) (S[K.X] = S[K.LX]!), (S[K.Y] = S[K.LY]!), (S[K.VX] = S[K.VY] = 0), (S[K.SQ] = 0.25), to(PERCH);
      } else if (m === LATCH) {
        // A fight: pulled toward the pointer, it jerks and drags away from the bucket.
        if ((S[K.JERK] = S[K.JERK]! - dt) <= 0) {
          S[K.JERK] = 0.12 + rnd() * 0.22;
          const a = rnd() * PI * 2;
          S[K.VX] = S[K.VX]! + cos(a) * 110 + (gx < BX ? -40 : 40);
          S[K.VY] = S[K.VY]! + sin(a) * 90 - 30;
          S[K.SQ] = 0.25;
        }
        S[K.VX] = S[K.VX]! + ((S[K.PX]! - gx) * 16 - S[K.VX]! * 4) * dt;
        S[K.VY] = S[K.VY]! + ((S[K.PY]! - gy) * 16 - S[K.VY]! * 4) * dt;
        if ((S[K.HEAT] = S[K.HEAT]! + dt / 5) >= 1) {
          // Overheat: the wands vent, the streams drop, it's loose.
          S[K.PFF] = 1.2;
          say(2, 80, 52);
          S[K.VY] = -120;
          loose(2.5);
        } else if (abs(gx - BX) < 11 && gy > FLOOR - 30) (S[K.X0] = gx), (S[K.Y0] = gy), to(SUCK);
      } else if (m === SUCK) {
        // Into the bucket: stretched thin, down it goes; then the lid.
        const u = min(1, t / 0.3);
        S[K.X] = S[K.X0]! + (BX - S[K.X0]!) * u;
        S[K.Y] = S[K.Y0]! + (FLOOR - 9 - S[K.Y0]!) * u * u;
        if (u >= 1) {
          to(BAGGED);
          S[K.BAG] = S[K.BAG]! + 1;
          S[K.BURST] = 0.35;
          S[K.HOP] = -60;
          S[K.CHEER] = 1.2;
          say(0, BX, FLOOR - 34);
          for (let j = 0; j < 36; j++) {
            const a = PI + (j / 35) * PI;
            sparks.spawn(BX, FLOOR - 12, cos(a) * (60 + rnd() * 70), sin(a) * (60 + rnd() * 80), 0.7, 1 + (j & 1), j & 3);
          }
        }
      } else if (m === BAGGED) {
        if (t > 0.5 && S[K.WORD] === 0) say(1, BX, FLOOR - 36);
        if (t > 1.4) {
          // The next one: out of a letter of the heading, in a new flavour.
          const i = (rnd() * LETTERS) | 0;
          S[K.FLAV] = (S[K.FLAV]! + 1) % 4;
          S[K.X] = lt.x[i]!;
          S[K.Y] = lt.y[i]!;
          S[K.VX] = (rnd() - 0.5) * 120;
          S[K.VY] = -90;
          lt.kick(i, TY, -300, 0.25);
          lt.kick(i, ROT, (rnd() - 0.5) * 600);
          say(4, S[K.X]!, S[K.Y]! - 18);
          loose(2.4);
        }
      }
      m = S[K.MODE]!;
      if (m === FREE || m === LATCH || m === LAND) {
        S[K.X] = S[K.X]! + S[K.VX]! * dt;
        S[K.Y] = S[K.Y]! + S[K.VY]! * dt;
        if (S[K.X]! < 9 || S[K.X]! > W - 9) (S[K.X] = max(9, min(W - 9, S[K.X]!))), (S[K.VX] = -S[K.VX]! * 0.8);
        if (S[K.Y]! < 9 || S[K.Y]! > FLOOR - 10) (S[K.Y] = max(9, min(FLOOR - 10, S[K.Y]!))), (S[K.VY] = -S[K.VY]! * 0.8);
        if (m !== LAND) bump(m === LATCH ? 1.4 : 1);
      }
      if (m !== PERCH) busy = true;
      for (let i = 0; i < n; i++) if (CD[i]! > 0) CD[i] = CD[i]! - dt;
      // The lid: open while a ghost is on the streams, shut otherwise (a snap when it bags one).
      const lid = m === LATCH || m === SUCK ? -1.3 : 0;
      if (S[K.LA] !== lid) (S[K.LA] = lid < S[K.LA]! ? max(lid, S[K.LA]! - 9 * dt) : min(lid, S[K.LA]! + (m === BAGGED ? 40 : 4) * dt)), (busy = true);
      if (S[K.HOP] || S[K.BY]) {
        S[K.HOP] = S[K.HOP]! + 500 * dt;
        S[K.BY] = min(0, S[K.BY]! + S[K.HOP]! * dt);
        if (!S[K.BY] && S[K.HOP]! > 0) S[K.HOP] = 0;
        busy = true;
      }
      if (S[K.SQ]) (S[K.SQ] = abs(S[K.SQ]!) < 0.01 ? 0 : S[K.SQ]! * exp(-dt * 8)), (busy = true);
      if (m !== LATCH && S[K.HEAT]! > 0) (S[K.HEAT] = max(0, S[K.HEAT]! - dt / 1.5)), (busy = true);
      for (const k of TIMERS) if (S[k]! > 0) (S[k] = S[k]! - dt), (busy = true);
      if (sparks.live) sparks.step(dt, 200, FLOOR), (busy = true);
      if (lt.step(dt)) busy = true;
      if (S[K.WT]! < 1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      S[K.TT] = S[K.TT]! + dt;
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render() {
      lt.render();
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw();
    },
  });

  function crew(x: number, frame: number, pal: number, flip: boolean) {
    if (!flip) return crewArt.draw(g, "crew", frame, x, FLOOR, 0, 1, pal);
    g.save();
    g.translate(x, 0);
    g.scale(-1, 1);
    crewArt.draw(g, "crew", frame, 0, FLOOR, 0, 1, pal);
    g.restore();
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    const m = S[K.MODE]!, t = S[K.TT]!, gx = S[K.X]!, gy = S[K.Y]!, by = round(S[K.BY]!), on = m === LATCH || m === SUCK;
    // The bucket and its lid (under the ghost going in).
    kit.draw(g, "bucket", 0, BX, FLOOR + by, 0, 1, S[K.BURST]! > 0.2 ? 3 : on ? 1 : 0);
    // The ghost.
    if (m !== BAGGED) {
      const sq = S[K.SQ]!, thin = m === SUCK ? min(1, S[K.T]! / 0.3) : 0;
      const w = 18 * (1 + sq) * (1 - thin * 0.6), h = 19 * (1 - sq * 0.7) * (1 + thin * 0.5);
      const f = on ? 2 : m === PERCH ? (S[K.WORD] === 3 && S[K.WT]! < 0.8 ? 1 : 3) : 0;
      g.drawImage(ghostArt.tile("ghost", f, 1, S[K.FLAV]!), round(gx - w / 2), round(gy - h / 2), round(w), round(h));
    }
    kit.draw(g, "lid", 0, BX - 8, FLOOR - 11 + by, S[K.LA]!, 1, 0);
    // The crew: aiming, straining on a catch, cheering a bag; steam when the wands vent.
    const f = S[K.CHEER]! > 0 ? 1 : on ? 2 : 0;
    crew(CX0, f, 0, false);
    crew(CX1, f, 1, true);
    if (S[K.PFF]! > 0) {
      g.fillStyle = "#f6f3ff";
      for (let j = 0; j < 6; j++) {
        const u = (1.2 - S[K.PFF]!) * 20 + j * 3;
        g.fillRect(round(CX0 - 4 + sin(j + u * 0.3) * 2), round(FLOOR - 12 - u), 1 + (j & 1), 1);
        g.fillRect(round(CX1 + 4 + sin(j + u * 0.3) * 2), round(FLOOR - 12 - u), 1 + (j & 1), 1);
      }
    }
    // The streams: on the ghost while latched (wobbling harder as it fights), or at a miss.
    if (on && m === LATCH) {
      const a = 2 + abs(S[K.SQ]!) * 8 + S[K.HEAT]! * 2;
      stream(g, CX0 + NOZZLE_X, NY, gx, gy, 1, t, a);
      stream(g, CX1 - NOZZLE_X, NY, gx, gy, 1, t + 0.4, a);
    } else if (S[K.MISS]! > 0) {
      const u = min(1, (0.32 - S[K.MISS]!) / 0.1);
      stream(g, CX0 + NOZZLE_X, NY, S[K.MX]!, S[K.MY]!, u, t, 2);
      stream(g, CX1 - NOZZLE_X, NY, S[K.MX]!, S[K.MY]!, u, t + 0.4, 2);
    }
    // The snap: a ring out of the bucket.
    if (S[K.BURST]! > 0) {
      const r = (0.35 - S[K.BURST]!) * 160;
      g.fillStyle = "#f6f3ff";
      for (let j = 0; j < 28; j++) g.fillRect(round(BX + cos((j / 28) * PI * 2) * r), round(FLOOR - 10 + sin((j / 28) * PI * 2) * r * 0.6), 2, 1);
    }
    sparks.draw(g);
    // The HUD on the floor (its left half: the gallery card says TAP TO PLAY on the right): the
    // tally and the wands' heat.
    print(g, "BAGGED", 3, FLOOR + 2, "#aea4d6");
    print(g, DIGITS[min(99, S[K.BAG]!)]!, 29, FLOOR + 2, "#ffc21a");
    print(g, "HEAT", 44, FLOOR + 2, "#aea4d6");
    g.fillStyle = "#3b3170";
    g.fillRect(61, FLOOR + 2, 20, 5);
    g.fillStyle = S[K.HEAT]! > 0.7 ? "#ff2b4e" : "#19f0ff";
    g.fillRect(61, FLOOR + 2, round(S[K.HEAT]! * 20), 5);
    g.fillStyle = RIM;
    if (S[K.WT]! < 0.85) shout(g, WORDS[S[K.WORD]!]!, S[K.WX]!, S[K.WY]! - (S[K.WT]! < 0.06 ? 1 : 0), S[K.WORD]! < 2 ? 3 : 2, "#f6f3ff", S[K.WORD]! < 2 ? "#19f0ff" : "#ff2e88");
  }

  engine.start();
  return {
    engine,
    tap,
    aim,
    get mode() {
      return S[K.MODE]!;
    },
    get bagged() {
      return S[K.BAG]!;
    },
    get x() {
      return S[K.X]!;
    },
    get y() {
      return S[K.Y]!;
    },
    destroy: () => engine.destroy(),
  };
}
const DIGITS = Array.from({ length: 100 }, (_, i) => String(i));

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the crew's first try going wide while the ghost ricochets through the stacks. */
export const posterAt = 1.85;

/** For `slot(fig, () => import("./wrangle").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => wrangle(stage, slot, first);
