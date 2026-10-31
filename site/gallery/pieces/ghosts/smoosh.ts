// Smoosh: SMUDGE, a grape-jelly slime ghost, haunts a dry cleaner's page called SPOTLESS. He flies
// at you and smooshes flat on the inside of the screen (palms, squashed face, SPLAT), and the goo
// he sprays lands on the page: every glob that hits a real letter, word or button sticks to it
// (that element is slimed, and only that one), runs down its face, hangs off its bottom edge and
// drips onto whatever is below, letter to button to price list, until it pools on the floor. He
// peels off the glass (SHLORP) leaving a smudge that fades. Tap anywhere and he smooshes there;
// tap him and he bounces off the walls and the letters (BOING), sliming what he hits, then
// smooshes. Once the dripping stops he slurps the whole puddle back up, burps, and floats still:
// the page is spotless again and the scene sleeps.
// Bricks: the kernel (fixed step, seeded random; settle: no frames once he's still; the ledger for
// every page write, so Recall gives the page back byte for byte) and @fzlt/core/sprite (SMUDGE and his
// palms, baked once). Shared world: spook.ts (with Wrangle and Overflow).
import { createEngine } from "../../../../src/kernel/index";
import { sprites } from "../../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { W, H, artCanvas, offscreen } from "../pix";
import { letters, TY, ROT, STRETCH } from "../letters";
import { GHOST, PALM, FLAVOURS, GOO, shout } from "./spook";

export type SmooshScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly mode: number; readonly x: number; readonly y: number; readonly goo: number };

const { abs, max, min, round, sin, cos, exp, PI } = Math;
const FLOOR = 84, CAP = 160, GW = 18, GH = 19, RX = 146, RY = 50;
// Modes.
export const IDLE = 0, DIVE = 1, SMOOSH = 2, SLIDE = 3, PEEL = 4, BOING = 5, SLURP = 6, BURP = 7, HOME = 8;
// State slots (a const enum: inlined to plain numbers in the live chunk).
const enum K { MODE = 0, T = 1, X = 2, Y = 3, VX = 4, VY = 5, X0 = 6, Y0 = 7, TX = 8, TY_ = 9, SQ = 10, FAT = 11, HITS = 12, GA = 13, Q = 14, QX = 15, QY = 16, WORD = 17, WT = 18, WX = 19, WY = 20, AUTO = 21, DIRTY = 22, FW = 23, FH = 24, SHK = 26, PX = 27, PY = 28, PW = 29, PH = 30 }
const WORDS = ["SPLAT!", "SHLORP", "BOING!", "SLUUURP", "BURP!"];

export function smoosh(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SmooshScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 1e9) | 0 });
  const rnd = engine.random, L = engine.ledger;
  const wrap = slot.querySelector<HTMLElement>(".sg")!;
  const g = artCanvas(engine, stage, true);
  const glass = offscreen(W, H);
  const art = sprites({ ghost: GHOST, palm: PALM }, { palettes: FLAVOURS });
  const lt = letters(engine, wrap, "i");
  const n = lt.n, SL = new Uint8Array(n), WAS = new Uint8Array(n), CD = new Float32Array(n);
  // Goo: where, how fast, how big; flying (1) or stuck to element KE (2), its streak's tail, when the
  // tail starts down, how long its drop has hung (-1: it fell).
  // (Ten slots each: x, y, vx, vy, tail, delay, hang, size, mode, element.)
  const G = new Float32Array(CAP * 10);
  let kn = 0;
  const P = new Float32Array(W); // the puddle on the floor, per art column
  const S = new Float64Array(32), SM = new Float32Array(8); // SM: where his smear streaks run
  S[K.X] = RX;
  S[K.Y] = RY;
  S[K.AUTO] = first ? 0 : 0.45;
  S[K.WT] = 9;
  S[K.DIRTY] = 1;
  if (!first) engine.busy(0.5); // the intro dive is scheduled: hold the engine for it

  const tap = (x: number, y: number) => ((S[K.QX] = x), (S[K.QY] = y), (S[K.Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (w: number, x: number, y: number) => ((S[K.WORD] = w), (S[K.WT] = 0), (S[K.WX] = max(16, min(W - 16, x))), (S[K.WY] = max(3, min(70, y))));

  function goo(x: number, y: number, vx: number, vy: number, s: number) {
    if (kn >= CAP) return;
    const k = kn++;
    G[k * 10] = x;
    G[k * 10 + 1] = y;
    G[k * 10 + 2] = vx;
    G[k * 10 + 3] = vy;
    G[k * 10 + 7] = s;
    G[k * 10 + 8] = 1;
  }
  /** Glob k lands on element i at (x, y): it sticks, the element is slimed, and it flinches. */
  function stick(k: number, i: number, x: number, y: number) {
    const hw = lt.w[i]! / 2, s = G[k * 10 + 7]!;
    G[k * 10 + 8] = 2;
    G[k * 10 + 9] = i;
    G[k * 10] = max(lt.x[i]! - hw + 1, min(lt.x[i]! + hw - 1, x));
    G[k * 10 + 1] = G[k * 10 + 4] = y;
    G[k * 10 + 5] = 0.35 + rnd() * 0.7;
    G[k * 10 + 6] = 0;
    SL[i] = SL[i]! + 1;
    lt.kick(i, TY, 70 + s * 50);
    lt.kick(i, STRETCH, 40 + s * 25);
    lt.kick(i, ROT, (rnd() - 0.5) * 160);
  }
  /** Which element (if any) has (x, y) inside it. */
  function under(x: number, y: number) {
    for (let i = 0; i < n; i++) if (abs(x - lt.x[i]!) <= lt.w[i]! / 2 && abs(y - lt.y[i]!) <= lt.h[i]! / 2) return i;
    return -1;
  }

  /** The smoosh: the glass gets his face print, the goo flies. */
  function splat() {
    const x = S[K.X]!, y = S[K.Y]!, w = S[K.FW]!, h = S[K.FH]!;
    say(0, x, y + h / 2 - 4);
    S[K.SHK] = 0.3;
    S[K.GA] = 1;
    glass.globalAlpha = 1;
    glass.clearRect(0, 0, W, H);
    glass.drawImage(art.tile("ghost", 2, 1, 5), round(x - w / 2), round(y - h / 2), round(w), round(h));
    // A smudge, not a sheet: wiped streaks through his print.
    glass.globalCompositeOperation = "destination-out";
    for (let c = round(x - w / 2); c < x + w / 2; c += 2 + (c & 1)) glass.fillRect(c, 0, 1 + (c % 3 & 1), H);
    glass.globalCompositeOperation = "source-over";
    for (let i = 0; i < 8; i++) SM[i] = 0.08 + rnd() * 0.84;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * PI * 2 + rnd() * 0.2, sp = 0.6 + rnd() * 0.8;
      goo(x + cos(a) * w * 0.4, y + sin(a) * h * 0.4, cos(a) * 85 * sp, sin(a) * 60 * sp - 45, rnd() < 0.25 ? 3 : rnd() < 0.5 ? 2 : 1);
    }
  }

  function decide(x: number, y: number) {
    const m = S[K.MODE]!;
    if (m !== BOING && abs(x - S[K.X]!) < 11 && abs(y - S[K.Y]!) < 12) {
      // Tapped him: he boings off the walls and the page first.
      S[K.VX] = (S[K.X]! - x) * 10 + (S[K.X]! > 80 ? -90 : 90);
      S[K.VY] = -150;
      S[K.HITS] = 0;
      S[K.SQ] = 0.35;
      say(2, S[K.X]!, S[K.Y]! - 18);
      return to(BOING);
    }
    dive(x, y);
  }
  function dive(x: number, y: number) {
    S[K.X0] = S[K.X]!;
    S[K.Y0] = S[K.Y]!;
    S[K.TX] = max(46, min(W - 46, x));
    S[K.TY_] = max(30, min(58, y));
    S[K.SQ] = 0;
    to(DIVE);
  }

  engine.add({
    read() {
      lt.read();
    },
    step(e, dt) {
      let busy = false;
      let t = (S[K.T] = S[K.T]! + dt), m = S[K.MODE]!;
      if (S[K.AUTO]! > 0 && (S[K.AUTO] = S[K.AUTO]! - dt) <= 0) dive(lt.x[3]! + 2, lt.y[3]!); // the T of SPOTLESS
      if (S[K.Q] && (m === IDLE || m === HOME || m === SLURP || m === BURP || (m === BOING && t > 0.3))) (S[K.Q] = 0), decide(S[K.QX]!, S[K.QY]!), (m = S[K.MODE]!), (t = S[K.T]!);
      if (m === DIVE) {
        // A wind-up (he shrinks back into the room), then straight at the screen, growing.
        if (t < 0.16) S[K.SQ] = -(t / 0.16) * 0.3;
        else {
          const u = min(1, (t - 0.16) / 0.34), q = 1 - (1 - u) * (1 - u);
          S[K.X] = S[K.X0]! + (S[K.TX]! - S[K.X0]!) * q;
          S[K.Y] = S[K.Y0]! + (S[K.TY_]! - S[K.Y0]!) * q - sin(u * PI) * 6;
          S[K.SQ] = -0.3 + u * u * 3.3;
          if (u >= 1) (S[K.FW] = GW * 4.9), (S[K.FH] = GH * 2.9), to(SMOOSH), splat();
        }
      } else if (m === SMOOSH) {
        // Flat on the glass: a jelly wobble that dies down.
        const j = sin(t * 30) * 0.13 * exp(-t * 5);
        S[K.FW] = GW * 4.9 * (1 + j);
        S[K.FH] = GH * 2.9 * (1 - j);
        if (t > 0.65) to(SLIDE);
      } else if (m === SLIDE) {
        // He slides down the glass, leaving a smear (streaks from his top edge).
        S[K.Y] = S[K.Y]! + (10 + t * 30) * dt;
        S[K.FW] = S[K.FW]! - 6 * dt;
        const top = S[K.Y]! - S[K.FH]! * 0.42, l = S[K.X]! - S[K.FW]! / 2;
        glass.fillStyle = GOO.l;
        for (let i = 0; i < 8; i++) glass.fillRect(round(l + SM[i]! * S[K.FW]!), round(top + sin(i * 2.3) * 3), (i & 1) + 1, 1);
        if (t > 0.5) to(PEEL), say(1, S[K.X]!, S[K.Y]! - 12), (S[K.PX] = S[K.X]!), (S[K.PY] = S[K.Y]!), (S[K.PW] = S[K.FW]!), (S[K.PH] = S[K.FH]!);
      } else if (m === PEEL) {
        // Off the glass and back into the room: from flat to his own size, with a pop.
        const u = min(1, t / 0.22);
        S[K.FW] = S[K.FW]! + (GW - S[K.FW]!) * u;
        S[K.FH] = S[K.FH]! + (GH - S[K.FH]!) * u;
        if (u >= 1) (S[K.X0] = S[K.X]!), (S[K.Y0] = S[K.Y]!), (S[K.SQ] = 0.3), to(HOME);
      } else if (m === HOME) {
        // Back to his spot by the sign, bobbing once.
        const u = min(1, t / 0.9), q = u * u * (3 - 2 * u);
        S[K.X] = S[K.X0]! + (RX - S[K.X0]!) * q;
        S[K.Y] = S[K.Y0]! + (RY - S[K.Y0]!) * q - sin(u * PI) * 8;
        if (u >= 1) to(IDLE);
      } else if (m === BOING) {
        // A rubber ball of jelly: walls, floor and the page's own elements; every element hit is slimed.
        S[K.VY] = S[K.VY]! + 420 * dt;
        S[K.X] = S[K.X]! + S[K.VX]! * dt;
        S[K.Y] = S[K.Y]! + S[K.VY]! * dt;
        let hit = 0;
        if (S[K.X]! < 9 || S[K.X]! > W - 9) (S[K.X] = max(9, min(W - 9, S[K.X]!))), (S[K.VX] = -S[K.VX]! * 0.9), (hit = 1);
        if (S[K.Y]! < 10) (S[K.Y] = 10), (S[K.VY] = abs(S[K.VY]!) * 0.8), (hit = 1);
        if (S[K.Y]! > FLOOR - 9) {
          (S[K.Y] = FLOOR - 9), (S[K.VY] = -max(120, abs(S[K.VY]!) * 0.85)), (hit = 1);
          goo(S[K.X]!, FLOOR - 1, 0, 0, 2);
        }
        for (let i = 0; i < n; i++) {
          if (CD[i]! > 0) continue;
          const ox: number = 7 + lt.w[i]! / 2 - abs(S[K.X]! - lt.x[i]!), oy: number = 7 + lt.h[i]! / 2 - abs(S[K.Y]! - lt.y[i]!);
          if (ox <= 0 || oy <= 0) continue;
          CD[i] = 0.25;
          hit = 1;
          const sx: number = S[K.X]! < lt.x[i]! ? -1 : 1, sy: number = S[K.Y]! < lt.y[i]! ? -1 : 1;
          if (ox < oy) (S[K.X] = S[K.X]! + ox * sx), (S[K.VX] = sx * abs(S[K.VX]!) * 0.9);
          else (S[K.Y] = S[K.Y]! + oy * sy), (S[K.VY] = sy * max(90, abs(S[K.VY]!) * 0.85));
          lt.kick(i, TY, sy * -60 + S[K.VY]! * 0.8, 0.15);
          lt.kick(i, ROT, S[K.VX]! * 1.6);
          goo(ox < oy ? lt.x[i]! - sx * lt.w[i]! / 2 : S[K.X]!, ox < oy ? S[K.Y]! : lt.y[i]! - sy * lt.h[i]! / 2, 0, 0, 2);
        }
        if (hit) (S[K.SQ] = 0.35), (S[K.HITS] = S[K.HITS]! + 1);
        if ((S[K.HITS]! >= 9 && t > 0.9) || t > 1.8) dive(S[K.X]!, S[K.Y]!);
      } else if (m === SLURP) {
        // Down to the puddle, mouth wide, and the floor drains into him.
        let sum = 0;
        for (let c = 0; c < W; c++) sum += P[c]!;
        if (t < 0.7) {
          if (t < dt * 1.5) (S[K.X0] = S[K.X]!), (S[K.Y0] = S[K.Y]!), (S[K.TX] = puddleMid());
          const u = min(1, t / 0.6), q = u * u * (3 - 2 * u);
          S[K.X] = S[K.X0]! + (S[K.TX]! - S[K.X0]!) * q;
          S[K.Y] = S[K.Y0]! + (FLOOR - 11 - S[K.Y0]!) * q;
        } else {
          if (S[K.WORD] !== 3) say(3, S[K.X]!, FLOOR - 32);
          const gx = round(S[K.X]!);
          for (let c = 0; c < W; c++) {
            const p = P[c]!;
            if (!p) continue;
            if (abs(c - gx) <= 4) {
              const d = min(p, p * 7 * dt + 0.02);
              P[c] = p - d;
              S[K.FAT] = min(0.45, S[K.FAT]! + d * 0.004);
            } else {
              const d = p * min(1, 9 * dt), nb = c + (c < gx ? 1 : -1);
              P[c] = p - d;
              P[nb] = P[nb]! + d;
            }
          }
          if (sum < 0.5 || t > 6) P.fill(0), to(BURP);
        }
      } else if (m === BURP) {
        if (t > 0.2 && S[K.WORD] !== 4) say(4, S[K.X]!, S[K.Y]! - 22), (S[K.SQ] = 0.5);
        if (t > 0.9) (S[K.X0] = S[K.X]!), (S[K.Y0] = S[K.Y]!), to(HOME);
      }
      if (S[K.MODE] !== IDLE) busy = true;
      // Squash and stretch spring back; the belly goes down once he's home.
      if (S[K.MODE] !== DIVE && S[K.SQ] && abs((S[K.SQ] = S[K.SQ]! * exp(-dt * 7))) < 0.01) S[K.SQ] = 0;
      if (S[K.FAT]! > 0 && (S[K.MODE] === HOME || S[K.MODE] === IDLE)) S[K.FAT] = max(0, S[K.FAT]! - dt * 0.35);
      if (S[K.SQ] || S[K.FAT]) busy = true;
      for (let i = 0; i < n; i++) if (CD[i]! > 0) CD[i] = CD[i]! - dt;

      // The goo: flying globs stick to what they hit; stuck ones run down, hang, drop.
      for (let k = kn - 1; k >= 0; k--) {
        if (G[k * 10 + 8] === 1) {
          G[k * 10 + 3] = G[k * 10 + 3]! + 260 * dt;
          G[k * 10] = G[k * 10]! + G[k * 10 + 2]! * dt;
          G[k * 10 + 1] = G[k * 10 + 1]! + G[k * 10 + 3]! * dt;
          const i = under(G[k * 10]!, G[k * 10 + 1]!);
          if (i >= 0) stick(k, i, G[k * 10]!, G[k * 10 + 1]!);
          else if (G[k * 10 + 1]! >= FLOOR - P[max(0, min(W - 1, round(G[k * 10]!)))]! || G[k * 10]! < -4 || G[k * 10]! > W + 4) {
            const c = round(G[k * 10]!), s = G[k * 10 + 7]!;
            if (c >= 0 && c < W) {
              for (let j = -s; j <= s; j++) if (c + j >= 0 && c + j < W) P[c + j] = min(6, P[c + j]! + (s + 1 - abs(j)) * 0.35);
            }
            drop(k);
          }
        } else {
          const i = G[k * 10 + 9]!, b = lt.y[i]! + lt.h[i]! / 2, v = 9 + G[k * 10 + 7]! * 6;
          if (G[k * 10 + 1]! < b) G[k * 10 + 1] = min(b, G[k * 10 + 1]! + v * dt);
          else if (G[k * 10 + 6]! >= 0 && (G[k * 10 + 6] = G[k * 10 + 6]! + dt) > 0.35) (G[k * 10 + 6] = -1), goo(G[k * 10]!, b + 1.5, 0, 12, max(1, G[k * 10 + 7]! - 1));
          if ((G[k * 10 + 5] = G[k * 10 + 5]! - dt) <= 0) G[k * 10 + 4] = G[k * 10 + 4]! + v * 0.9 * dt;
          if (G[k * 10 + 4]! >= b) {
            if (G[k * 10 + 6]! >= 0) goo(G[k * 10]!, b + 1.5, 0, 12, 1);
            SL[i] = SL[i]! - 1;
            drop(k);
          }
        }
      }
      if (kn) busy = true;
      // The puddle levels out.
      let mv = 0;
      for (let c = 0; c < W - 1; c++) {
        const d = P[c]! - P[c + 1]!;
        if (abs(d) > 0.5) {
          const f = d * min(0.5, 6 * dt);
          (P[c] = P[c]! - f), (P[c + 1] = P[c + 1]! + f), (mv = 1);
        }
      }
      // Once nothing is left running down the page, he comes for the puddle.
      if (S[K.MODE] === IDLE && !kn) {
        let sum = 0;
        for (let c = 0; c < W; c++) sum += P[c]!;
        if (sum > 0.05) to(SLURP);
      }
      if (mv || S[K.MODE] === SLURP) busy = true;
      if (lt.step(dt)) busy = true;
      if (S[K.GA]! > 0 && S[K.MODE] !== SMOOSH && S[K.MODE] !== SLIDE && (S[K.GA] = S[K.GA]! - dt / 2.4) <= 0) (S[K.GA] = 0), glass.clearRect(0, 0, W, H);
      if (S[K.GA]! > 0) busy = true;
      if (S[K.SHK]! > 0) (S[K.SHK] = S[K.SHK]! - dt), (busy = true);
      if (S[K.WT]! < 1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render() {
      lt.render();
      for (let i = 0; i < n; i++) {
        const s = SL[i]! > 0 ? 1 : 0;
        if (s !== WAS[i]) (WAS[i] = s), L.attr(lt.els[i]!, "data-slimed", s ? "" : null);
      }
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw();
    },
  });

  const drop = (k: number) => G.copyWithin(k * 10, --kn * 10, kn * 10 + 10);
  function puddleMid() {
    let s = 0, sx = 0;
    for (let c = 0; c < W; c++) (s += P[c]!), (sx += P[c]! * c);
    return max(12, min(W - 12, s ? sx / s : S[K.X]!));
  }

  function ghost(x: number, y: number, w: number, h: number, frame: number) {
    g.drawImage(art.tile("ghost", frame, 1, 0), round(x - w / 2), round(y - h / 2), round(w), round(h));
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    // Goo on the page: streaks down the faces of what it hit, a drop at the bottom edge, globs in the air.
    for (let k = 0; k < kn; k++) {
      const s = G[k * 10 + 7]!, x = round(G[k * 10]!), y = round(G[k * 10 + 1]!);
      if (G[k * 10 + 8] === 1) {
        g.fillStyle = GOO.g;
        g.fillRect(x, y - s, s, s);
        if (s > 1) (g.fillStyle = GOO.l), g.fillRect(x, y - s, 1, 1);
        continue;
      }
      // A blob where it landed (until it runs), a thin streak, a fat bead at its head, a drop that stretches.
      const ws = s > 2 ? 2 : 1, top = round(G[k * 10 + 4]!), hang = G[k * 10 + 6]! > 0 ? min(4, 1 + round(G[k * 10 + 6]! * 9)) : 0;
      g.fillStyle = GOO.g;
      g.fillRect(x, top, ws, y - top);
      if (G[k * 10 + 5]! > 0) g.fillRect(x - 1, top - 1, ws + 2, 2), (g.fillStyle = GOO.l), g.fillRect(x - 1, top - 1, 1, 1), (g.fillStyle = GOO.g);
      g.fillRect(x - (s > 1 ? 1 : 0), y - 1, ws + (s > 1 ? 1 : 0), 2);
      if (hang) g.fillRect(x, y + 1, ws, hang - 1), g.fillRect(x - (hang > 2 ? 1 : 0), y + hang - 1, ws + (hang > 2 ? 1 : 0), 2);
      g.fillStyle = GOO.d;
      g.fillRect(x + ws - 1, y + max(1, hang), 1, 1);
    }
    // The puddle, on the floor.
    for (let c = 0; c < W; c++) {
      const h = round(P[c]!);
      if (h <= 0) continue;
      g.fillStyle = GOO.d;
      g.fillRect(c, FLOOR - h, 1, h + 1);
      g.fillStyle = GOO.g;
      g.fillRect(c, FLOOR - h + 1, 1, h - 1);
      if (h > 1) (g.fillStyle = GOO.l), g.fillRect(c, FLOOR - h + 1, 1, 1);
    }
    const m = S[K.MODE]!, sq = S[K.SQ]!, fat = S[K.FAT]!, onGlass = m === DIVE || m === SMOOSH || m === SLIDE || m === PEEL;
    const sh = S[K.SHK]! > 0 ? (round(S[K.SHK]! * 30) & 1 ? 1 : -1) : 0;
    // In the room (behind the glass): his own size, squashing and stretching, fat after a slurp.
    if (!onGlass) {
      const w = GW * (1 + sq + fat), h = GH * (1 - sq * 0.8 + fat * 0.5);
      ghost(S[K.X]!, S[K.Y]! + (GH - h) / 2, w, h, m === SLURP ? 2 : m === BURP ? 1 : m === BOING ? 3 : 0);
    }
    // The glass: his smudge, fading.
    if (S[K.GA]! > 0) (g.globalAlpha = 0.4 * S[K.GA]!), g.drawImage(glass.canvas, sh, 0), (g.globalAlpha = 1);
    if (onGlass) {
      if (m === DIVE) {
        const k = 1 + sq;
        ghost(S[K.X]!, S[K.Y]!, GW * k, GH * k, 2);
      } else {
        const x = S[K.X]! + sh, y = S[K.Y]!, w = S[K.FW]!, h = S[K.FH]!;
        ghost(x, y, w, h, 2);
        if (m !== PEEL) art.draw(g, "palm", 0, x - w / 2 - 3, y + 2, -0.3, 2, 0), art.draw(g, "palm", 0, x + w / 2 + 3, y + 2, 0.3, 2, 0);
      }
    }
    // Peeling off: goo strands from the glass to him, stretching, then snapping.
    if (m === PEEL || (m === HOME && S[K.T]! < 0.25)) {
      g.fillStyle = GOO.l;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + 0.4, c = cos(a), s = sin(a);
        for (let q = 0; q < 1; q += 0.04) g.fillRect(round(S[K.PX]! + c * S[K.PW]! * 0.42 * (1 - q) + (S[K.X]! - S[K.PX]!) * q), round(S[K.PY]! + s * S[K.PH]! * 0.4 * (1 - q) + (S[K.Y]! - S[K.PY]!) * q + sin(q * PI) * 3), 1, 1);
      }
    }
    if (S[K.WT]! < 0.85) {
      const wd = WORDS[S[K.WORD]!]!, big = S[K.WT]! < 0.06 ? 1 : 0;
      shout(g, wd, S[K.WX]!, S[K.WY]! - big, S[K.WORD] === 0 ? 3 : 2, GOO.l, GOO.d);
    }
  }

  engine.start();
  return {
    engine,
    tap,
    get mode() {
      return S[K.MODE]!;
    },
    get x() {
      return S[K.X]!;
    },
    get y() {
      return S[K.Y]!;
    },
    get goo() {
      return kn;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  SMUDGE flat on the glass over SPOTLESS, the goo in the air (scripts/gallery-posters.mjs draws it). */
export const posterAt = 1.12;

/** For `slot(fig, () => import("./smoosh").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => smoosh(stage, slot, first);
