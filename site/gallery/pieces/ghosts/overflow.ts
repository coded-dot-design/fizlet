// Overflow: the Spook Sweep crew's own home page promises ALL CONTAINED. ROOK, the rookie, keeps
// stuffing ghosts into one mop-bucket trap. Tap and one more comes down the page on his stream and
// the lid slams on it; the bucket rattles harder with every ghost (the only tell: each bucket holds
// a different number before it blows). Tap DOT and she hauls the bucket off safe (your best haul is
// kept). Push your luck and the lid rockets off: KA-BLOOEY, every ghost in there escapes at once,
// ricocheting off the heading's letters, the button and each other, knocking ROOK flat, and
// out across the page. The page's own LEAKS counter goes up. ROOK gets up, finds the lid, and
// a fresh bucket is ready.
// Bricks: the kernel (fixed step, seeded random; settle: no frames while the bucket sits still; the
// ledger for every page write (the counter's text included), so Recall gives the page back byte for
// byte) and @fzlt/core/sprite (the ghosts, the crew, the bucket and its lid, baked once). Shared world:
// spook.ts (with Smoosh and Wrangle).
import { createEngine } from "../../../../src/kernel/index";
import { sprites } from "../../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { W, H, artCanvas, bits, print } from "../pix";
import { letters, TX, TY, ROT } from "../letters";
import { GHOST, FLAVOURS, CREW, CREWS, BUCKET, LID, GLOWS, NOZZLE_X, NOZZLE_Y, stream, shout } from "./spook";

export type OverflowScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly mode: number; readonly inside: number; readonly cap: number; readonly leaks: number; readonly best: number };

const { abs, max, min, round, sin, cos, exp, PI } = Math;
const FLOOR = 82, BX = 80, RK = 50, DT = 136, MAXG = 12, NOZ = FLOOR + NOZZLE_Y;
// Modes.
export const READY = 0, STUFF = 1, BLOWN = 2, HAUL = 3, RESET = 4;
// State slots (a const enum: inlined to plain numbers in the live chunk).
const enum K { MODE = 0, T = 1, IN = 2, CAP = 3, GX = 4, GY = 5, G0X = 6, G0Y = 7, LA = 8, RAT = 9, Q = 10, QX = 11, QY = 12, WORD = 13, WT = 14, WX = 15, WY = 16, LX = 17, LY = 18, LVX = 19, LVY = 20, LR = 21, LVR = 22, DOWN = 23, LEAKS = 24, BEST = 25, BXO = 26, AUTO = 27, DIRTY = 28, FLAV = 30, FLASH = 31, SLAM = 32, SHOWN = 33 }
const WORDS = ["SLAM!", "KA-BLOOEY!", "ONE MORE?", "WHOA!", "SAFE!"];
const NUM = Array.from({ length: 100 }, (_, i) => String(i));

export function overflow(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): OverflowScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 1e9) | 0 });
  const rnd = engine.random, L = engine.ledger;
  const wrap = slot.querySelector<HTMLElement>(".ov")!;
  const leakRow = wrap.querySelector<HTMLElement>(".ov-k")!, leakText = wrap.querySelector("b")!.firstChild as Text;
  const g = artCanvas(engine, stage, true);
  const ghostArt = sprites({ ghost: GHOST }, { palettes: FLAVOURS });
  const crewArt = sprites({ crew: CREW }, { palettes: CREWS });
  const kit = sprites({ bucket: BUCKET, lid: LID }, { palettes: GLOWS });
  const lt = letters(engine, wrap, "i");
  const n = lt.n, CD = new Float32Array(n * MAXG);
  const sparks = bits(80, ["#f6f3ff", "#19f0ff", "#ff2e88", "#ffc21a", "#9a63ff"]);
  // The escaped ghosts: where, how fast, their flavour, how long they've been out.
  const EX = new Float32Array(MAXG), EY = new Float32Array(MAXG), EVX = new Float32Array(MAXG), EVY = new Float32Array(MAXG), EA = new Float32Array(MAXG);
  const EF = new Uint8Array(MAXG), EON = new Uint8Array(MAXG);
  const S = new Float64Array(36);
  const fresh = () => ((S[K.IN] = 0), (S[K.CAP] = 2 + ((rnd() * 6) | 0)));
  fresh();
  S[K.WT] = 9;
  S[K.DIRTY] = 1;
  S[K.AUTO] = first ? 0 : 2; // the intro: ROOK stuffs two on his own
  S[K.LX] = BX - 16;
  S[K.LY] = FLOOR - 22;
  if (!first) engine.busy(0.5);

  const tap = (x: number, y: number) => ((S[K.QX] = x), (S[K.QY] = y), (S[K.Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (w: number, x: number, y: number) => ((S[K.WORD] = w), (S[K.WT] = 0), (S[K.WX] = max(22, min(W - 22, x))), (S[K.WY] = max(3, min(64, y))));

  /** One more: a ghost comes in from the top of the page; ROOK's stream catches it. */
  function stuff() {
    S[K.G0X] = 20 + rnd() * 120;
    S[K.G0Y] = -10;
    S[K.FLAV] = (rnd() * 4) | 0;
    to(STUFF);
  }
  /** It blows: the lid off like a rocket, every ghost inside out at once, ROOK flat on his back. */
  function blow() {
    to(BLOWN);
    say(1, BX, 30);
    S[K.FLASH] = 0.15;
    S[K.LVX] = (rnd() - 0.5) * 90;
    S[K.LVY] = -260;
    S[K.LVR] = (rnd() - 0.5) * 30;
    S[K.LX] = BX - 16;
    S[K.LY] = FLOOR - 22;
    S[K.DOWN] = 1;
    const k = min(MAXG, S[K.IN]!);
    for (let j = 0; j < k; j++) {
      const a = PI + 0.25 + (j / max(1, k - 1)) * (PI - 0.5) + (rnd() - 0.5) * 0.3, sp = 130 + rnd() * 110;
      EX[j] = BX + cos(a) * 6;
      EY[j] = FLOOR - 26;
      EVX[j] = cos(a) * sp;
      EVY[j] = sin(a) * sp;
      EA[j] = 0;
      EF[j] = j & 3;
      EON[j] = 1;
    }
    for (let j = 0; j < 40; j++) {
      const a = PI + rnd() * PI;
      sparks.spawn(BX, FLOOR - 22, cos(a) * (40 + rnd() * 120), sin(a) * (40 + rnd() * 140), 0.9, 1 + (j % 3 === 0 ? 1 : 0), j % 5);
    }
    S[K.IN] = 0;
  }
  /** What a body at (x, y) with half-size r hits on the page: knocked, and it bounces off. */
  function hit(x: number, y: number, r: number, vx: number, vy: number, j: number) {
    for (let i = 0; i < n; i++) {
      const c = i * MAXG + j;
      if (CD[c]! > 0) continue;
      const ox: number = r + lt.w[i]! / 2 - abs(x - lt.x[i]!), oy: number = r + lt.h[i]! / 2 - abs(y - lt.y[i]!);
      if (ox <= 0 || oy <= 0) continue;
      CD[c] = 0.35;
      const sx = x < lt.x[i]! ? -1 : 1, sy = y < lt.y[i]! ? -1 : 1;
      lt.kick(i, ROT, vx * 2.2, 0.14);
      lt.kick(i, TX, vx * 1.6);
      lt.kick(i, TY, vy * 1.4 - 80);
      for (let s = 0; s < 3; s++) sparks.spawn(x - sx * r, y, -sx * rnd() * 40, -rnd() * 50, 0.3, 1, 2 + s);
      return ox < oy ? sx * 2 : sy; // ±2: bounced off a side; ±1: off a top or bottom
    }
    return 0;
  }

  engine.add({
    read() {
      lt.read();
    },
    step(e, dt) {
      let busy = false;
      let m = S[K.MODE]!, t = (S[K.T] = S[K.T]! + dt);
      if (S[K.AUTO]! > 0 && m === READY) (S[K.AUTO] = S[K.AUTO]! - 1), stuff(), (m = S[K.MODE]!), (t = 0);
      if (S[K.Q] && m === READY) {
        S[K.Q] = 0;
        // DOT hauls a bucket with something in it; anywhere else is one more.
        if (S[K.IN]! > 0 && abs(S[K.QX]! - DT) < 12 && S[K.QY]! > FLOOR - 26) to(HAUL), say(4, DT - 12, FLOOR - 36);
        else stuff();
        (m = S[K.MODE]!), (t = 0);
      }
      if (m === STUFF) {
        // In from the top, zig-zagging, until the stream has it; then down into the bucket.
        const u = min(1, t / 0.75), q = u * u * (3 - 2 * u);
        S[K.GX] = S[K.G0X]! + (BX - S[K.G0X]!) * q + sin(t * 18) * 8 * (1 - u);
        S[K.GY] = S[K.G0Y]! + (FLOOR - 18 - S[K.G0Y]!) * q;
        if (u >= 1) {
          // SLAM: the lid comes down; the bucket takes it, or doesn't.
          S[K.IN] = S[K.IN]! + 1;
          if (S[K.IN]! > S[K.CAP]!) blow();
          else to(READY), (S[K.SLAM] = 0.2), (S[K.RAT] = 0.5 + (S[K.IN]! / S[K.CAP]!) * 0.9), say(S[K.IN]! === 1 ? 0 : 2, BX, FLOOR - 33);
        }
      } else if (m === BLOWN) {
        // The lid: up, off the heading, down on the floor.
        S[K.LVY] = S[K.LVY]! + 420 * dt;
        S[K.LX] = S[K.LX]! + S[K.LVX]! * dt;
        S[K.LY] = S[K.LY]! + S[K.LVY]! * dt;
        S[K.LR] = S[K.LR]! + S[K.LVR]! * dt;
        const b = hit(S[K.LX]! + 16, S[K.LY]!, 8, S[K.LVX]!, S[K.LVY]!, MAXG - 1);
        if (b) abs(b) === 2 ? (S[K.LVX] = -S[K.LVX]! * 0.7) : (S[K.LVY] = abs(S[K.LVY]!) * 0.5 * (b > 0 ? 1 : -1));
        if (S[K.LX]! < 0 || S[K.LX]! > W - 32) (S[K.LX] = max(0, min(W - 32, S[K.LX]!))), (S[K.LVX] = -S[K.LVX]! * 0.7);
        if (S[K.LY]! > FLOOR - 2) (S[K.LY] = FLOOR - 2), (S[K.LVY] = -abs(S[K.LVY]!) * 0.35), (S[K.LVX] = S[K.LVX]! * 0.7), (S[K.LVR] = S[K.LVR]! * 0.6);
        S[K.LR] = S[K.LY] === FLOOR - 2 && abs(S[K.LVY]!) < 20 ? S[K.LR]! * exp(-dt * 10) : S[K.LR]!;
        // The ghosts: out and about for a beat, then away across the page.
        let out = 0;
        for (let j = 0; j < MAXG; j++) {
          if (!EON[j]) continue;
          out++;
          const a = (EA[j] = EA[j]! + dt);
          if (a > 1.3) EVX[j] = EVX[j]! + (EX[j]! < BX ? -1 : 1) * 260 * dt, (EVY[j] = EVY[j]! - 60 * dt);
          else EVY[j] = EVY[j]! + sin(a * 9 + j) * 200 * dt;
          EX[j] = EX[j]! + EVX[j]! * dt;
          EY[j] = EY[j]! + EVY[j]! * dt;
          if (a < 1.3 && (EX[j]! < 9 || EX[j]! > W - 9)) (EX[j] = max(9, min(W - 9, EX[j]!))), (EVX[j] = -EVX[j]!);
          if (EY[j]! < 9) (EY[j] = 9), (EVY[j] = abs(EVY[j]!));
          if (EY[j]! > FLOOR - 10) (EY[j] = FLOOR - 10), (EVY[j] = -abs(EVY[j]!));
          const b = hit(EX[j]!, EY[j]!, 7, EVX[j]!, EVY[j]!, j);
          if (b) abs(b) === 2 ? (EVX[j] = abs(EVX[j]!) * (b > 0 ? 1 : -1)) : (EVY[j] = abs(EVY[j]!) * (b > 0 ? 1 : -1));
          // Each other: two that meet head on bonk off (equal masses: they trade velocities).
          for (let k = j + 1; k < MAXG; k++) {
            const dx = EX[k]! - EX[j]!, dy = EY[k]! - EY[j]!;
            if (EON[k] && dx * dx + dy * dy < 169 && (EVX[j]! - EVX[k]!) * dx + (EVY[j]! - EVY[k]!) * dy > 0) {
              const a = EVX[j]!, b = EVY[j]!;
              (EVX[j] = EVX[k]!), (EVY[j] = EVY[k]!), (EVX[k] = a), (EVY[k] = b);
            }
          }
          if (EX[j]! < -12 || EX[j]! > W + 12) {
            EON[j] = 0;
            S[K.LEAKS] = S[K.LEAKS]! + 1;
          }
        }
        if (t > 0.5 && S[K.DOWN] === 1) (S[K.DOWN] = 2), say(3, RK, FLOOR - 32);
        if (!out && t > 1.2 && abs(S[K.LVY]!) < 20 && S[K.LY] === FLOOR - 2) to(RESET);
      } else if (m === HAUL) {
        // DOT wheels it off; a fresh one rolls in from the other side.
        S[K.BXO] = t < 0.9 ? t * t * 260 : min(0, -170 + (t - 0.9) * 340);
        if (t > 0.9 && S[K.IN]) (S[K.BEST] = max(S[K.BEST]!, S[K.IN]!)), fresh();
        if (t > 1.5) (S[K.BXO] = 0), to(READY), (S[K.SLAM] = 0.15);
      } else if (m === RESET) {
        // ROOK gets up, fetches the lid, and it's a fresh bucket.
        const f = min(1, dt * 7 * t);
        S[K.DOWN] = t > 0.25 ? 0 : 2;
        S[K.LX] = S[K.LX]! + (BX - 16 - S[K.LX]!) * f;
        S[K.LY] = S[K.LY]! + (FLOOR - 22 - S[K.LY]!) * f;
        S[K.LR] = S[K.LR]! * (1 - f);
        if (t > 0.8) fresh(), to(READY), (S[K.SLAM] = 0.15);
      }
      m = S[K.MODE]!;
      if (m !== READY) busy = true;
      // The lid sits on the bucket, open while one goes in; the bucket rattles after a slam.
      const lid = m === STUFF && t > 0.35 ? -1.1 : 0;
      if (m !== BLOWN && m !== RESET && S[K.LA] !== lid) (S[K.LA] = lid < S[K.LA]! ? max(lid, S[K.LA]! - 10 * dt) : min(lid, S[K.LA]! + 30 * dt)), (busy = true);
      if (S[K.RAT]! > 0) (S[K.RAT] = S[K.RAT]! - dt), (busy = true);
      if (S[K.SLAM]! > 0) (S[K.SLAM] = S[K.SLAM]! - dt), (busy = true);
      if (S[K.FLASH]! > 0) (S[K.FLASH] = S[K.FLASH]! - dt), (busy = true);
      for (let c = 0; c < CD.length; c++) if (CD[c]! > 0) CD[c] = CD[c]! - dt;
      if (sparks.live) sparks.step(dt, 220, FLOOR), (busy = true);
      if (lt.step(dt)) busy = true;
      if (S[K.WT]! < 1.1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render() {
      lt.render();
      // The page's own counter: LEAKS THIS YEAR.
      if (S[K.LEAKS] !== S[K.SHOWN]) {
        S[K.SHOWN] = S[K.LEAKS]!;
        L.text(leakText, NUM[min(99, S[K.LEAKS]!)]!);
        L.attr(leakRow, "data-leak", S[K.LEAKS] ? "" : null);
        const i = n - 2;
        lt.kick(i, TY, -260, 0.4);
      }
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw();
    },
  });

  function crew(x: number, frame: number, pal: number, flip: boolean, lying: boolean) {
    g.save();
    g.translate(round(x), FLOOR);
    if (flip) g.scale(-1, 1);
    crewArt.draw(g, "crew", frame, lying ? -8 : 0, lying ? -3 : 0, lying ? -PI / 2 : 0, 1, pal);
    g.restore();
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    const m = S[K.MODE]!, t = S[K.T]!, tt = engine.steps / 60, r = S[K.RAT]! > 0 ? S[K.RAT]! : 0, fill = S[K.IN]! / S[K.CAP]!;
    // The bucket: it rattles (harder the fuller it is), glows amber then red, flashes when it blows.
    const bx = BX + S[K.BXO]! + (r ? round(sin(tt * 70) * r * fill * 2.2) : 0), by = FLOOR - (S[K.SLAM]! > 0.1 ? 1 : 0) - (r && fill > 0.6 ? round(abs(sin(tt * 35)) * r * 2) : 0);
    // The ghost going in (under the lid).
    if (m === STUFF) {
      const u = min(1, t / 0.75), w = 18 * (1 - u * 0.4), h = 19 * (1 + u * 0.3);
      g.drawImage(ghostArt.tile("ghost", 2, 1, S[K.FLAV]!), round(S[K.GX]! - w / 2), round(S[K.GY]! - h / 2), round(w), round(h));
      if (t > 0.25) stream(g, RK + NOZZLE_X, NOZ, S[K.GX]!, S[K.GY]!, min(1, (t - 0.25) / 0.12), tt, 2.5);
    }
    kit.draw(g, "bucket", 0, bx, by, 0, 2, S[K.FLASH]! > 0 ? 3 : fill > 0.75 ? 2 : fill > 0.4 ? 1 : 0);
    if (m === BLOWN || m === RESET) kit.draw(g, "lid", 0, S[K.LX]!, S[K.LY]!, S[K.LR]!, 2, 0);
    else kit.draw(g, "lid", 0, bx - 16, by - 22, S[K.LA]!, 2, 0);
    // The crew: ROOK by the bucket (flat on his back after a blow-out), DOT by the dolly.
    crew(RK, m === STUFF ? 0 : m === BLOWN && S[K.DOWN] ? 2 : 0, 1, false, !!S[K.DOWN]);
    crew(DT + (m === HAUL ? (t < 0.9 ? S[K.BXO]! : max(0, (1.5 - t) * 200)) : 0), m === HAUL ? 2 : 0, 0, true, false);
    if (m === READY && S[K.IN]! > 0) {
      // DOT's offer, while there's something to haul.
      g.fillStyle = "#07060f";
      g.fillRect(DT - 13, FLOOR - 34, 25, 11);
      g.fillRect(DT - 3, FLOOR - 24, 5, 3);
      g.fillStyle = "#f6f3ff";
      g.fillRect(DT - 12, FLOOR - 33, 23, 9);
      g.fillRect(DT - 2, FLOOR - 24, 3, 2);
      print(g, "HAUL?", DT - 10, FLOOR - 31, "#07060f");
    }
    // The escaped ghosts.
    for (let j = 0; j < MAXG; j++) if (EON[j]) ghostArt.draw(g, "ghost", EA[j]! < 1.3 ? 2 : 3, EX[j]!, EY[j]!, sin(EA[j]! * 12 + j) * 0.25, 1, EF[j]!);
    sparks.draw(g);
    // The floor HUD (its left half: the gallery card says TAP TO PLAY on the right): what's in the
    // bucket now; the best haul.
    print(g, "IN", 3, FLOOR + 2, "#9fb3c8");
    print(g, NUM[S[K.IN]!]!, 13, FLOOR + 2, "#ffc21a");
    print(g, "BEST HAUL", 30, FLOOR + 2, "#9fb3c8");
    print(g, NUM[S[K.BEST]!]!, 68, FLOOR + 2, "#39ffb0");
    if (S[K.WT]! < 0.9) shout(g, WORDS[S[K.WORD]!]!, S[K.WX]!, S[K.WY]! - (S[K.WT]! < 0.06 ? 1 : 0), S[K.WORD] === 1 ? 3 : 2, "#f6f3ff", S[K.WORD] === 1 ? "#ff2e88" : "#19f0ff");
  }

  engine.start();
  return {
    engine,
    tap,
    get mode() {
      return S[K.MODE]!;
    },
    get inside() {
      return S[K.IN]!;
    },
    get cap() {
      return S[K.CAP]!;
    },
    get leaks() {
      return S[K.LEAKS]!;
    },
    get best() {
      return S[K.BEST]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  ROOK's stream bringing the second ghost down into the bucket. */
export const posterAt = 1.5;

/** For `slot(fig, () => import("./overflow").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => overflow(stage, slot, first);
