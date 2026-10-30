// The bubble-top: a space-age commuter car over SKYVIEW ACRES, a neighbourhood of houses on stilts
// above the clouds, at dusk. On load it zips out of its carport, past every house, puffing smoke
// rings, and parks again. Then it's yours. Tap the sky and it swerves there; tap a house and it
// bumps it (BONK: the house wobbles on its pole and the lights flicker); tap the car and it honks
// (a sound wave rolls out: it rocks the houses and knocks the sign's letters it reaches). Double-tap
// and it throws a loop-the-loop, leaving a circle of rings. The rings drift up and pop on the sign's
// real letters, and only a letter something reaches moves. It parks itself and settles to no frames.
// Bricks: the kernel (fixed step, settle; its ledger: the canvas and every letter go back on Recall)
// and fizlet/slot. The sign is real text (./letters.ts springs); the rest is vector art (./sky-city.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { letters, ROT, TX, TY } from "./letters";
import { K, W, car, cloudBank, inked, puffs, ring, shout, skyCanvas, star } from "./sky-city";

export type BubbleScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly mode: number };

const { abs, atan2, cos, exp, hypot, max, min, PI, sign, sin, sqrt } = Math;
const CS = 8; // car half length
const PIV = 98; // the poles stand on this line, under the clouds
// Houses: pole x, body y, scale, paint and trim.
const HB = [30, 87, 139], HT = [52, 60, 42], HS = [1, 0.82, 0.92];
const HP = [K.teal, K.coral, K.lilac], HQ = [K.coral, K.mustard, K.teal];
const NR = 28; // smoke rings
// State slots.
const MODE = 0, CX = 1, CY = 2, VX = 3, VY = 4, FACE = 5, SQ = 6, SQV = 7, TX0 = 8, TY0 = 9, MT = 10, PUFF = 11, AIM = 12;
const WP = 13, WORD = 14, WT = 15, WX = 16, WY = 17, HONK = 18, HR = 19, HXO = 20, HYO = 21, LAST = 22, Q = 23, QX = 24, QY = 25, LOOP = 26;
const MOOD = 27, DIRTY = 28, CD = 29, DBL = 30, NOW = 31, LS = 32, FT = 33, LQ = 34;
// Modes: parked, flying to a point, hovering, flying home, looping, the opening run.
const PARK = 0, GO = 1, HOVER = 2, HOME = 3, LOOPING = 4, RUN = 5;
const WORDS = ["HONK!", "BONK!", "ZOOM!", "WHEE!", "POP!"];
const BURST = [K.mustard, K.coral, K.teal, K.lilac, K.mint];
const ROUTE = [58, 26, 112, 34, 148, 22, 120, 14];

export function bubbleTop(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BubbleScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 62 });
  const rnd = engine.random;
  const sky = skyCanvas(engine, stage), g = sky.g;
  const lt = letters(engine, slot, ".sa1-t i", 150, 7);
  const fx = puffs(48);
  const S = new Float64Array(35);
  // Houses: wobble angle and speed, light flicker.
  const TH = new Float32Array(3), OM = new Float32Array(3), FL = new Float32Array(3), BC = new Float32Array(3);
  // Rings: x, y, vx, vy, age, life.
  const R = new Float32Array(NR * 6);
  let rn = 0;
  // Which letters this honk has already reached; a letter the car just hit (a cooldown).
  const HIT = new Uint8Array(lt.n), LC = new Float32Array(lt.n);

  /** Where house i's body sits (its pole leans with the wobble). */
  const hx = (i: number) => HB[i]! + (PIV - HT[i]!) * sin(TH[i]!), hy = (i: number) => PIV - (PIV - HT[i]!) * cos(TH[i]!);
  /** The carport: house 0's pad, riding its wobble. */
  const padX = () => hx(0) + cos(TH[0]!) * 20.5 + sin(TH[0]!) * 4, padY = () => hy(0) + sin(TH[0]!) * 20.5 - cos(TH[0]!) * 4;

  S[MODE] = RUN;
  S[CX] = padX();
  S[CY] = padY();
  S[FACE] = S[FT] = 1;
  S[WT] = 9;
  S[HR] = -1;
  S[AIM] = -1;
  S[DIRTY] = 1;

  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * 90);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * 90);
  }, { signal: engine.signal });

  const say = (w: number, x: number, y: number) => ((S[WORD] = w), (S[WT] = 0), (S[WX] = max(14, min(W - 14, x))), (S[WY] = max(9, y)));
  const kick = (k: number) => ((S[SQV] = S[SQV]! + k));
  function blow(x: number, y: number, vx: number, vy: number) {
    if (rn === NR) return;
    const o = rn++ * 6;
    (R[o] = x), (R[o + 1] = y), (R[o + 2] = vx), (R[o + 3] = vy), (R[o + 4] = 0), (R[o + 5] = 2.8 + rnd() * 1.2);
  }
  function pop(i: number, n: number) {
    const o = i * 6, r = 1 + 3 * (1 - exp(-R[o + 4]! * 1.3));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * PI + rnd();
      fx.add(R[o]! + cos(a) * r, R[o + 1]! + sin(a) * r * 0.8, cos(a) * 14, sin(a) * 14, 0.9 + rnd() * 0.6, 0.35 + rnd() * 0.25);
    }
    R[o + 5] = 0;
  }
  function wobble(i: number, w: number) {
    OM[i] = OM[i]! + w;
    FL[i] = 0.7;
  }

  /** A tap: the car (honk), a house (bump it), the sky (swerve); a quick second tap loops. */
  function act(x: number, y: number) {
    const dbl = S[NOW]! - S[DBL]! < 0.32;
    S[DBL] = S[NOW]!;
    if (dbl && S[MODE] === GO) return (S[LQ] = 1), say(3, S[TX0]!, S[TY0]! - 14);
    if (hypot(x - S[CX]!, y - S[CY]!) < CS + 2) {
      S[HONK] = 0.5;
      S[HR] = 0;
      S[HXO] = S[CX]!;
      S[HYO] = S[CY]!;
      HIT.fill(0);
      kick(-9);
      S[MOOD] = 1;
      for (let k = 0; k < 3; k++) blow(S[CX]! - S[FACE]! * CS, S[CY]! + 2, -S[FACE]! * (10 + k * 8), -4 - k * 3);
      return say(0, S[CX]! + 6, S[CY]! - 15);
    }
    let aim = -1;
    for (let i = 0; i < 3; i++) if (abs(x - hx(i)) < 12 * HS[i]! && y > hy(i) - 12 && (y < hy(i) + 4 || abs(x - hx(i)) < 3)) aim = i;
    if (aim === 0 && S[MODE] === PARK) aim = -1; // its own house: take off instead
    S[AIM] = aim;
    S[MODE] = GO;
    S[LQ] = 0;
    S[TX0] = aim >= 0 ? hx(aim) : max(8, min(W - 8, x));
    S[TY0] = aim >= 0 ? hy(aim) - 3 : max(8, min(72, y));
    S[MT] = 0;
    if (S[WT]! > 0.6) say(2, S[CX]!, S[CY]! - 14);
  }

  engine.add({
    read() {
      if (sky.read()) S[DIRTY] = 1;
      lt.read();
    },
    step(e, dt) {
      S[NOW] = S[NOW]! + dt;
      if (S[Q]) (S[Q] = 0), act(S[QX]!, S[QY]!);
      const m = S[MODE]!;
      let busy = m !== PARK;
      // Steering: toward the target (or the next leg of the run, or home), banking and puffing.
      if (m !== PARK) {
        let tx = S[TX0]!, ty = S[TY0]!, top = 75;
        if (m === RUN) (tx = ROUTE[S[WP]!]!), (ty = ROUTE[S[WP]! + 1]!), (top = 62);
        if (m === HOME) (tx = padX()), (ty = padY());
        if (m === LOOPING) {
          // A loop-the-loop around (TX0, TY0): up and over (or, near the top, down and under), a ring
          // every few degrees.
          const a = (S[LOOP] = S[LOOP]! + dt * 7.5), px = S[CX]!, py = S[CY]!;
          S[CX] = S[TX0]! + sin(a) * 9 * (S[FACE]! < 0 ? -1 : 1);
          S[CY] = S[TY0]! + cos(a) * 9 * S[LS]!;
          S[VX] = (S[CX]! - px) / dt;
          S[VY] = (S[CY]! - py) / dt;
          if ((S[PUFF] = S[PUFF]! - dt) <= 0) (S[PUFF] = 0.06), blow(px, py, 0, -3);
          if (a > 2 * PI) (S[MODE] = HOVER), (S[MT] = 0.7);
        } else {
          const dx = tx - S[CX]!, dy = ty - S[CY]!, d = hypot(dx, dy) || 1, sp = min(top, d * (m === HOME ? 2.2 : 3.2) + 6);
          const k = min(1, dt * (m === HOME ? 3 : 3.6));
          S[VX] = S[VX]! + ((dx / d) * sp - S[VX]!) * k;
          S[VY] = S[VY]! + ((dy / d) * sp - S[VY]!) * k;
          if (m === HOVER) S[VX] = S[VX]! * (1 - dt * 4), S[VY] = S[VY]! * (1 - dt * 4);
          S[CX] = S[CX]! + S[VX]! * dt;
          S[CY] = S[CY]! + S[VY]! * dt;
          if (m === RUN && d < 9) S[WP] = S[WP]! + 2, S[WP]! >= ROUTE.length && ((S[MODE] = HOME), (S[WP] = 0));
          if (m === GO && (d < 2.5 || (S[MT] = S[MT]! + dt) > 2.4)) {
            S[MODE] = HOVER;
            S[MT] = 0.9;
            // A double tap: the loop-the-loop, there.
            if (S[LQ]) (S[LQ] = 0), (S[MODE] = LOOPING), (S[LOOP] = 0), (S[LS] = S[CY]! < 20 ? -1 : 1), (S[TX0] = S[CX]!), (S[TY0] = S[CY]! - 9 * S[LS]!);
          }
          if (m === HOVER && (S[MT] = S[MT]! - dt) <= 0) (S[MODE] = HOME), (S[MOOD] = 0);
          if (m === HOME && d < 1.2) {
            S[MODE] = PARK;
            S[VX] = S[VY] = 0;
            S[MOOD] = 0;
            kick(7);
            for (let k = 0; k < 5; k++) fx.add(S[CX]! + (k - 2) * 2.5, S[CY]! + 3.5, (k - 2) * 9, -3, 1.1, 0.5);
          }
        }
        const v = hypot(S[VX]!, S[VY]!);
        if (m !== LOOPING && v > 14 && (S[PUFF] = S[PUFF]! - dt) <= 0) {
          S[PUFF] = 0.15;
          blow(S[CX]! - S[FACE]! * CS * 0.95, S[CY]! + 2.6, -S[VX]! * 0.08 - S[FACE]! * 6, -3);
        }
        if (abs(S[VX]!) > 6 && m !== LOOPING) S[FT] = sign(S[VX]!);
        // Walls: bounce back in.
        if (S[CX]! < 6 || S[CX]! > W - 6) (S[VX] = -S[VX]! * 0.6), (S[CX] = max(6, min(W - 6, S[CX]!)));
        if (S[CY]! < 6 || S[CY]! > 76) (S[VY] = -S[VY]! * 0.6), (S[CY] = max(6, min(76, S[CY]!)));
        // Houses: a bump knocks it over on its pole (the car bounces off); its own carport is home.
        if (S[CD]! > 0) S[CD] = S[CD]! - dt;
        for (let i = 0; i < 3; i++) {
          if ((i === 0 && m === HOME) || m === LOOPING) continue;
          const bx: number = hx(i), by: number = hy(i) - 2 * HS[i]!, dx: number = S[CX]! - bx, dy: number = S[CY]! - by, d = hypot(dx, dy) || 1, rr = CS + 8.5 * HS[i]!;
          const pole: boolean = abs(S[CX]! - bx) < CS * 0.7 && S[CY]! > by + 4 && S[CY]! < 84;
          if ((d > rr && !pole) || S[CD]! > 0) continue;
          const nx: number = pole ? sign(dx) || 1 : dx / d, ny: number = pole ? 0 : dy / d, vn: number = S[VX]! * nx + S[VY]! * ny;
          if (vn < 0) (S[VX] = S[VX]! - 1.7 * vn * nx), (S[VY] = S[VY]! - 1.7 * vn * ny);
          if (!pole) (S[CX] = bx + nx * rr), (S[CY] = by + ny * rr);
          S[CD] = 0.3;
          wobble(i, -nx * min(3, abs(vn) * 0.05 + 0.6) / HS[i]!);
          kick(10);
          S[MOOD] = 2;
          for (let k = 0; k < 7; k++) fx.add(S[CX]! - nx * CS, S[CY]! - ny * 4, (rnd() - 0.5) * 40 - nx * 20, (rnd() - 0.5) * 30, 0.9, 0.4);
          say(1, S[CX]! - nx * CS, S[CY]! - 14);
          if (i === S[AIM] || m === GO) (S[MODE] = HOVER), (S[MT] = 1.1), (S[AIM] = -1);
        }
        // The sign: the car bowls through a letter it reaches.
        for (let i = 0; i < lt.n; i++) {
          if (LC[i]! > 0) LC[i] = LC[i]! - dt;
          if (abs(S[CX]! - lt.x[i]!) < lt.w[i]! / 2 + CS * 0.8 && abs(S[CY]! - lt.y[i]!) < lt.h[i]! / 2 + 2.5 && !(LC[i]! > 0)) {
            LC[i] = 0.4;
            lt.kick(i, TX, S[VX]! * 4, 0.3);
            lt.kick(i, TY, S[VY]! * 3 - 160);
            lt.kick(i, ROT, sign(S[VX]!) * 300);
          }
        }
      }
      // The honk: a sound wave rolls out; letters and houses it reaches jump.
      if (S[HR]! >= 0) {
        const r = (S[HR] = S[HR]! + dt * 95);
        for (let i = 0; i < lt.n; i++) {
          if (HIT[i] || hypot(lt.x[i]! - S[HXO]!, lt.y[i]! - S[HYO]!) > r) continue;
          HIT[i] = 1;
          lt.kick(i, TY, -260, 0.25);
          lt.kick(i, ROT, (lt.x[i]! > S[HXO]! ? 1 : -1) * 220);
        }
        for (let i = 0; i < 3; i++) if (!(BC[i]! > 0) && hypot(hx(i) - S[HXO]!, hy(i) - S[HYO]!) < r) (BC[i] = 1), wobble(i, (hx(i) > S[HXO]! ? 0.5 : -0.5) / HS[i]!);
        if (r > 190) (S[HR] = -1), BC.fill(0), HIT.fill(0);
        busy = true;
      }
      if (S[HONK]! > 0) (S[HONK] = S[HONK]! - dt), S[HONK]! <= 0 && m === PARK && (S[MOOD] = 0);
      // Rings: they swell, slow, rise and wobble; a letter or a house in the way pops them.
      for (let i = rn - 1; i >= 0; i--) {
        const o = i * 6, age = (R[o + 4] = R[o + 4]! + dt);
        if (R[o + 5]! <= 0 || age > R[o + 5]!) {
          if (age > R[o + 5]! && R[o + 5]! > 0) pop(i, 3);
          busy = true;
          rn--;
          R.copyWithin(o, rn * 6, rn * 6 + 6);
          continue;
        }
        R[o + 2] = R[o + 2]! * (1 - dt * 0.9) + sin(age * 3 + i) * dt * 3;
        R[o + 3] = R[o + 3]! + (-5 - R[o + 3]!) * dt * 0.8;
        const x = (R[o] = R[o]! + R[o + 2]! * dt), y = (R[o + 1] = R[o + 1]! + R[o + 3]! * dt), r = 1 + 3 * (1 - exp(-age * 1.3));
        for (let j = 0; j < lt.n && age > 0.25; j++) {
          if (abs(x - lt.x[j]!) < lt.w[j]! / 2 + r * 0.6 && abs(y - lt.y[j]!) < lt.h[j]! / 2 + r * 0.5) {
            lt.kick(j, TY, -120 - r * 30, 0.2);
            lt.kick(j, ROT, (x < lt.x[j]! ? 1 : -1) * 160);
            pop(i, 6);
            if (S[WT]! > 0.7) say(4, x, y - 6);
            break;
          }
        }
        for (let j = 0; j < 3 && age > 0.4; j++) if (hypot(x - hx(j), y - hy(j) + 3) < 8 * HS[j]!) pop(i, 4);
        if (y < -6) R[o + 5] = 0;
        busy = true;
      }
      // Houses wobble on their poles; the lights flicker while they do.
      for (let i = 0; i < 3; i++) {
        OM[i] = OM[i]! + (-38 * TH[i]! - 1.6 * OM[i]!) * dt;
        TH[i] = max(-0.45, min(0.45, TH[i]! + OM[i]! * dt));
        if (FL[i]! > 0) FL[i] = FL[i]! - dt;
        if (abs(TH[i]!) + abs(OM[i]!) < 0.002) TH[i] = OM[i] = 0;
        else busy = true;
      }
      if (m === PARK) (S[CX] = padX()), (S[CY] = padY()), (S[FT] = 1);
      // Turning round: the car squashes through the turn, quickly.
      if (S[FACE] !== S[FT]) (S[FACE] = S[FT]! > S[FACE]! ? min(S[FT]!, S[FACE]! + dt * 10) : max(S[FT]!, S[FACE]! - dt * 10)), (busy = true);
      // The car's squash: a spring.
      S[SQV] = S[SQV]! + (-260 * S[SQ]! - 11 * S[SQV]!) * dt;
      S[SQ] = max(-0.9, min(0.9, S[SQ]! + S[SQV]! * dt));
      if (abs(S[SQ]!) + abs(S[SQV]!) < 0.01) S[SQ] = S[SQV] = 0;
      else busy = true;
      if (fx.step(dt)) busy = true;
      if (S[WT]! < 1.2) (S[WT] = S[WT]! + dt), (busy = true);
      if (lt.step(dt)) busy = true;
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      lt.render();
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function house(i: number) {
    const s = HS[i]!, off = FL[i]! > 0 && (FL[i]! * 14) % 2 < 1;
    g.save();
    g.translate(HB[i]!, PIV);
    g.rotate(TH[i]!);
    // The pole and its struts.
    const top = -(PIV - HT[i]!);
    g.beginPath();
    g.rect(-1.1, top + 2, 2.2, -top);
    inked(g, K.cream, 0.45);
    g.translate(0, top);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(-7, 2);
    g.lineTo(0, 9);
    g.lineTo(7, 2);
    g.strokeStyle = K.ink;
    g.lineWidth = 1.1;
    g.stroke();
    if (!i) {
      // The carport: a pad off the side, a LAUNCH lamp on its rail.
      g.beginPath();
      g.rect(8, -0.4, 22.5, 2.2);
      inked(g, K.cream, 0.45);
      g.fillStyle = K.coral;
      g.fillRect(9, 1.1, 20.5, 0.5);
      g.beginPath();
      g.moveTo(30, -0.4);
      g.lineTo(30, -6);
      g.strokeStyle = K.ink;
      g.lineWidth = 0.5;
      g.stroke();
      star(g, 30, -6.6, 1.6, 4, 0.4, 0);
      inked(g, off ? K.haze : K.mustard, 0.35);
    }
    // The dome house: a Googie roof, round windows, an antenna with a starburst.
    g.beginPath();
    g.ellipse(0, -1, 7.6, 7.4, 0, PI, 0);
    g.closePath();
    inked(g, K.cream, 0.5);
    g.beginPath();
    g.moveTo(-10, -4.5);
    g.quadraticCurveTo(-2, -12, 10, -6.5);
    g.lineTo(9, -5);
    g.quadraticCurveTo(-1, -9.5, -10, -4.5);
    inked(g, HQ[i]!, 0.45);
    for (let w = -1; w <= 1; w++) {
      g.beginPath();
      g.arc(w * 3.6, -3.2, 1.25, 0, PI * 2);
      inked(g, off ? K.haze : K.lit, 0.35);
    }
    g.beginPath();
    g.moveTo(2, -9.6);
    g.lineTo(3.5, -15);
    g.strokeStyle = K.ink;
    g.lineWidth = 0.45;
    g.stroke();
    star(g, 3.5, -15.5, 2, 4, 0.35, TH[i]! * 4);
    inked(g, K.mustard, 0.3);
    // The saucer under it.
    g.beginPath();
    g.ellipse(0, 0, 11.5, 3.1, 0, 0, PI * 2);
    inked(g, HP[i]!, 0.5);
    g.beginPath();
    g.ellipse(0, 0.6, 9, 1, 0, 0, PI);
    g.strokeStyle = K.cream;
    g.lineWidth = 0.5;
    g.stroke();
    g.restore();
  }

  function draw() {
    sky.begin();
    for (let i = 2; i >= 0; i--) house(i);
    // The honk's sound wave.
    if (S[HR]! >= 0) {
      g.globalAlpha = max(0, 1 - S[HR]! / 190);
      g.strokeStyle = K.cream;
      g.lineWidth = 1.2;
      for (let k = 0; k < 2; k++) {
        g.beginPath();
        g.arc(S[HXO]!, S[HYO]!, max(0.1, S[HR]! - k * 5), 0, PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    for (let i = 0; i < rn; i++) {
      const o = i * 6, age = R[o + 4]!, left = R[o + 5]! - age;
      ring(g, R[o]!, R[o + 1]!, 1 + 3 * (1 - exp(-age * 1.3)), min(1, left * 1.5, age * 8));
    }
    fx.draw(g, K.smoke);
    // The car: the jet's glow under it while it flies.
    const fly = S[MODE] !== PARK, tilt = S[MODE] === LOOPING ? atan2(S[VY]!, S[VX]!) * (S[FACE]! < 0 ? 1 : 1) - (S[FACE]! < 0 ? PI : 0) : max(-0.45, min(0.45, S[VY]! * 0.012 * sign(S[FACE]!)));
    if (fly) {
      g.beginPath();
      star(g, S[CX]! - S[FACE]! * CS * 0.62, S[CY]! + CS * 0.5, 1.4 + sqrt(abs(S[VX]!) + abs(S[VY]!)) * 0.12, 6, 0.45, S[NOW]! * 20);
      inked(g, K.mustard, 0.3);
    }
    car(g, S[CX]!, S[CY]!, CS, S[FACE]!, tilt, S[SQ]!, K.coral, K.teal, S[MOOD]!);
    cloudBank(g, 82, K.cloud);
    if (S[WT]! < 1.1) shout(g, WORDS[S[WORD]!]!, S[WX]!, S[WY]!, S[WORD] === 4 ? 3.6 : 4.6, S[WT]!, S[WORD] === 4 ? 0.6 : 1.1, BURST[S[WORD]!]!);
  }

  engine.start();
  return {
    engine,
    tap,
    get mode() {
      return S[MODE]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the opening run at this second, the car
 *  between the houses with its rings rising (scripts/gallery-posters.mjs draws it). */
export const posterAt = 1.3;

/** For `slot(fig, () => import("./bubble-top-car-puffs-smoke-rings").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bubbleTop(stage, slot, first);
