// Rush hour on Skyway 5: bubble-top commuters weave between the floating traffic islands, three
// lanes, five o'clock. Tap the sky to drop a traffic beacon there: the drivers who spot it in time
// brake, the ones who don't plough in, and the cars behind them pile up: real collisions, car on
// car, cars knocked spinning into the air (hit the RUSH HOUR sign's real letters and they jump),
// bouncing on the clouds, then floating back up dizzy and driving off. Tap a car and it honks and
// hops a lane (it may sideswipe someone); double-tap to send a whole RUSH of traffic down that
// lane. Tap the billboard and its little rocket takes off. Once the skyway is clear it settles.
// Bricks: the kernel (fixed step, settle; its ledger: the canvas and every letter go back on Recall)
// and fizlet/slot. The signs are real text (./letters.ts springs); the rest is vector art (./sky-city.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { letters, ROT, TX, TY } from "./letters";
import { K, PAINT, TRIM, W, car, cloudBank, inked, puffs, shout, skyCanvas, star } from "./sky-city";

export type RushScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly cars: number; readonly tumbling: number };

const { abs, cos, hypot, max, min, PI, sign, sin } = Math;
const N = 18, CS = 6.4, CR = 4.8, FLOOR = 73;
const LY = [30, 45, 60], LD = [1, -1, 1]; // lanes: height, direction
const IX = [50, 112], IY = [37.5, 52.5]; // the floating traffic islands
const BBX = 10, BBY = 69.5; // the rocket's spot on the billboard
// Cars: x, y, vx, vy, angle, spin, state, timer, lane, paint, squash, squash speed, cruise speed, reaction distance.
const X = 0, Y = 1, VX = 2, VY = 3, A = 4, AV = 5, ST = 6, T = 7, LN = 8, PT = 9, SQ = 10, SQV = 11, SP = 12, RE = 13, F = 14;
const OFF = 0, DRIVE = 1, TUMBLE = 2, RECOVER = 3;
// Scene slots.
const BON = 0, BX = 1, BY = 2, BVX = 3, BVY = 4, BT = 5, BA = 6, Q = 7, QX = 8, QY = 9, WORD = 10, WT = 11, WX = 12, WY = 13;
const QUEUE = 14, QT = 15, QL = 16, RK = 17, RX = 18, RY = 19, RVX = 20, RVY = 21, RT = 22, NOW = 23, DBL = 24, DIRTY = 25, AUTO = 26;
const WORDS = ["CRUNCH!", "BONK!", "BEEP!", "RUSH!", "WHOOSH!", "BOING!", "HONK!"];
const BURST = [K.coral, K.mustard, K.teal, K.coral, K.lilac, K.mint, K.mustard];

export function rushHour(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RushScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 5 });
  const rnd = engine.random;
  const sky = skyCanvas(engine, stage), g = sky.g;
  const lt = letters(engine, slot, ".sa2-t i, .sa2-bb i", 150, 7);
  const fx = puffs(56);
  const C = new Float32Array(N * F), S = new Float64Array(28), LC = new Float32Array(lt.n);
  // The flame of the billboard rocket: purple into orange (made once, drawn in the rocket's frame).
  const flame = g.createLinearGradient(0, 0, -7, 0);
  flame.addColorStop(0, "#9b4dff");
  flame.addColorStop(0.55, "#ff4fa0");
  flame.addColorStop(1, "#ff8a1e");
  S[WT] = 9;
  S[DIRTY] = 1;
  S[RX] = BBX;
  S[RY] = BBY;
  S[QUEUE] = 9;
  S[QL] = -1;
  S[AUTO] = first ? 0 : 1.5;

  const laneY = (l: number, x: number) => LY[l]! + sin(x * 0.075 + l * 2) * 2.4;
  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * 90);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * 90);
  }, { signal: engine.signal });

  const say = (w: number, x: number, y: number) => ((S[WORD] = w), (S[WT] = 0), (S[WX] = max(16, min(W - 16, x))), (S[WY] = max(9, y)));
  const near = (y: number) => (y < 37.5 ? 0 : y < 52.5 ? 1 : 2);
  function spawn(l: number) {
    for (let i = 0; i < N; i++) {
      const o = i * F;
      if (C[o + ST]) continue;
      // Not on top of one that just came in.
      for (let j = 0; j < N; j++) if (C[j * F + ST] === DRIVE && C[j * F + LN] === l && abs(C[j * F + X]! - (LD[l]! > 0 ? -8 : W + 8)) < 13) return false;
      C.fill(0, o, o + F);
      C[o + ST] = DRIVE;
      C[o + LN] = l;
      C[o + X] = LD[l]! > 0 ? -8 : W + 8;
      C[o + Y] = laneY(l, C[o + X]!);
      C[o + SP] = 30 + rnd() * 14 + (S[QL]! >= 0 ? 8 : 0);
      C[o + VX] = LD[l]! * C[o + SP]!;
      C[o + PT] = (rnd() * PAINT.length) | 0;
      C[o + RE] = S[QL]! >= 0 ? 1 + rnd() * 4 : rnd() < 0.45 ? 1 + rnd() * 3 : 10 + rnd() * 20; // some see it coming, some are looking at the view
      return true;
    }
    return false;
  }
  function knock(i: number, vx: number, vy: number, spin: number) {
    const o = i * F;
    if (C[o + ST] === DRIVE) (C[o + ST] = TUMBLE), (C[o + T] = 0);
    C[o + VX] = C[o + VX]! + vx;
    C[o + VY] = C[o + VY]! + vy;
    C[o + AV] = C[o + AV]! + spin;
    C[o + SQV] = C[o + SQV]! + 9;
  }
  function beacon(x: number, y: number) {
    // Dropped near a lane, it lands right in it.
    const l = near(y), ly = laneY(l, x);
    S[BON] = 1;
    S[BX] = x;
    S[BY] = abs(ly - y) < 7 ? ly : y;
    S[BVX] = 0;
    S[BVY] = 0;
    S[BT] = 0;
    for (let k = 0; k < 6; k++) fx.add(x, y, cos(k) * 16, sin(k) * 16, 0.8, 0.35);
  }
  /** A tap: a car (honk, hop a lane), the billboard (the rocket), the sky (a beacon); a quick second tap sends a RUSH. */
  function act(x: number, y: number) {
    const dbl = S[NOW]! - S[DBL]! < 0.32;
    S[DBL] = S[NOW]!;
    if (dbl) return (S[QUEUE] = S[QUEUE]! + 7), (S[QL] = near(y)), say(3, x, y - 12);
    for (let i = 0; i < N; i++) {
      const o = i * F;
      if (C[o + ST] !== DRIVE || hypot(x - C[o + X]!, y - C[o + Y]!) > CS + 1.5) continue;
      const l = C[o + LN]!, to = l === 0 ? 1 : l === 2 ? 1 : rnd() < 0.5 ? 0 : 2;
      C[o + LN] = to;
      C[o + VY] = (LY[to]! - LY[l]!) * 2.2;
      C[o + SQV] = -8;
      return say(6, C[o + X]!, C[o + Y]! - 11);
    }
    if (!S[RK] && x < 36 && y > 62) return (S[RK] = 1), (S[RVX] = 30), (S[RVY] = -50), say(4, 30, 46);
    beacon(x, y);
    let live = 0;
    for (let i = 0; i < N; i++) if (C[i * F + ST] === DRIVE) live++;
    if (live < 5 && S[QUEUE]! < 5) S[QUEUE] = S[QUEUE]! + 6;
  }

  engine.add({
    read() {
      if (sky.read()) S[DIRTY] = 1;
      lt.read();
    },
    step(e, dt) {
      S[NOW] = S[NOW]! + dt;
      let busy = false;
      if (S[AUTO]! > 0) {
        busy = true;
        if ((S[AUTO] = S[AUTO]! - dt) <= 0) beacon(98, 30);
      }
      if (S[Q]) (S[Q] = 0), act(S[QX]!, S[QY]!);
      // The traffic: one car at a time per gap, into a random lane (or the lane a RUSH was sent down).
      if (S[QUEUE]! > 0 && (S[QT] = S[QT]! - dt) <= 0) {
        if (spawn(S[QL]! >= 0 ? S[QL]! : (rnd() * 3) | 0)) S[QUEUE] = S[QUEUE]! - 1;
        S[QT] = S[QL]! >= 0 ? 0.28 : 0.3 + rnd() * 0.35;
        if (!S[QUEUE]) S[QL] = -1;
      }
      if (S[QUEUE]! > 0) busy = true;
      // The beacon: it bobs up, settles, blinks; knocked, it drifts back; after a while it pops.
      if (S[BON]) {
        busy = true;
        S[BT] = S[BT]! + dt;
        S[BVX] = S[BVX]! * (1 - dt * 2);
        S[BVY] = S[BVY]! * (1 - dt * 3);
        S[BX] = max(4, min(W - 4, S[BX]! + S[BVX]! * dt));
        S[BY] = max(6, min(FLOOR, S[BY]! + S[BVY]! * dt));
        S[BA] = S[BA]! * (1 - dt * 3) + S[BVX]! * dt * 0.05;
        if (S[BT]! > 5.5) {
          S[BON] = 0;
          for (let k = 0; k < 8; k++) fx.add(S[BX]!, S[BY]!, cos(k) * 22, sin(k) * 22, 1, 0.4);
        }
      }
      // Cars.
      let tumbling = 0;
      for (let i = 0; i < N; i++) {
        const o = i * F, st = C[o + ST]!;
        if (!st) continue;
        const l = C[o + LN]!, d = LD[l]!, x = C[o + X]!;
        if (st === DRIVE) {
          // Cruise, unless something's in the lane ahead: a beacon, or a slower car. Seen too late, it's a crash.
          let gap = 99, ov = 0;
          if (S[BON] && abs(S[BY]! - C[o + Y]!) < 7) {
            const ahead = (S[BX]! - x) * d;
            if (ahead > 0) (gap = ahead - CS - 3), (ov = 0);
          }
          for (let j = 0; j < N; j++) {
            const q = j * F;
            if (j === i || !C[q + ST] || abs(C[q + Y]! - C[o + Y]!) > 6) continue;
            const ahead = (C[q + X]! - x) * d - CS * 2;
            if (ahead > -2 && ahead < gap) (gap = ahead), (ov = C[q + VX]! * d);
          }
          const want = gap < C[o + RE]! ? max(0, min(C[o + SP]!, ov)) * (gap < 3 ? 0.5 : 1) : C[o + SP]!;
          // Brakes have limits: seen late, it can't stop in time.
          C[o + VX] = C[o + VX]! + d * max(-40 * dt, min(30 * dt, (d * want - C[o + VX]!) * d));
          C[o + VY] = C[o + VY]! + ((laneY(l, x) - C[o + Y]!) * 5 - C[o + VY]!) * min(1, dt * 5);
          C[o + A] = C[o + A]! * (1 - dt * 6) + C[o + VY]! * d * 0.004;
          if (x < -14 || x > W + 14) (C[o + ST] = OFF), (busy = true);
        } else {
          C[o + T] = C[o + T]! + dt;
          if (st === TUMBLE) {
            tumbling++;
            C[o + VY] = C[o + VY]! + 70 * dt;
            C[o + VX] = C[o + VX]! * (1 - dt * 0.7);
            C[o + AV] = C[o + AV]! * (1 - dt * 1.2);
            // Dizzy on the clouds a moment, then the hover kicks back in.
            if (C[o + T]! > 2 + (i % 4) * 0.25 && abs(C[o + VY]!) < 25) {
              C[o + ST] = RECOVER;
              C[o + T] = 0;
              if (S[BON] && abs(LY[l]! - S[BY]!) < 7) C[o + LN] = l === 1 ? (rnd() < 0.5 ? 0 : 2) : 1;
            }
          } else {
            const ty = laneY(C[o + LN]!, x);
            C[o + VY] = C[o + VY]! + ((ty - C[o + Y]!) * 2.5 - C[o + VY]!) * min(1, dt * 3);
            C[o + VX] = C[o + VX]! + (LD[C[o + LN]!]! * 10 - C[o + VX]!) * min(1, dt * 2);
            C[o + AV] = C[o + AV]! + (-C[o + A]! * 40 - C[o + AV]! * 6) * dt;
            if (abs(ty - C[o + Y]!) < 2 && abs(C[o + A]!) < 0.08) {
              C[o + ST] = DRIVE;
              C[o + A] = C[o + AV] = 0;
              C[o + SQV] = -7;
              if (S[WT]! > 0.8 && rnd() < 0.5) say(2, C[o + X]!, C[o + Y]! - 10);
            }
          }
          C[o + A] = C[o + A]! + C[o + AV]! * dt;
          // The cloud deck: a soft floor; the sides of the scene keep the pile in view.
          if (C[o + Y]! > FLOOR) {
            if (C[o + VY]! > 30 && S[WT]! > 0.9) say(5, C[o + X]!, FLOOR - 10);
            C[o + Y] = FLOOR;
            C[o + VY] = -C[o + VY]! * 0.5;
            C[o + VX] = C[o + VX]! * 0.8;
            C[o + AV] = C[o + AV]! * 0.7 + C[o + VX]! * 0.02;
            if (C[o + VY]! > -6) C[o + VY] = 0;
            C[o + SQV] = C[o + SQV]! + 6;
          }
          if (C[o + X]! < 5 || C[o + X]! > W - 5) (C[o + VX] = -C[o + VX]! * 0.6), (C[o + X] = max(5, min(W - 5, C[o + X]!)));
          if (C[o + Y]! < 4) (C[o + VY] = abs(C[o + VY]!) * 0.5), (C[o + Y] = 4);
        }
        C[o + X] = C[o + X]! + C[o + VX]! * dt;
        C[o + Y] = C[o + Y]! + C[o + VY]! * dt;
        C[o + SQV] = C[o + SQV]! + (-240 * C[o + SQ]! - 10 * C[o + SQV]!) * dt;
        C[o + SQ] = max(-0.9, min(0.9, C[o + SQ]! + C[o + SQV]! * dt));
        // The islands: a bump, not a wall.
        for (let k = 0; k < 2; k++) {
          const dx = C[o + X]! - IX[k]!, dy = (C[o + Y]! - IY[k]!) * 2.6;
          if (abs(dx) > 9 + CS * 0.8 || abs(dy) > 9 || st === DRIVE) continue;
          C[o + VY] = (dy < 0 ? -1 : 1) * max(14, abs(C[o + VY]!) * 0.6);
          C[o + Y] = IY[k]! + (dy < 0 ? -1 : 1) * 3.6;
          C[o + AV] = C[o + AV]! + sign(dx) * 3;
        }
        // The signs: a car flung into a letter knocks it.
        if (st !== DRIVE)
          for (let j = 0; j < lt.n; j++) {
            if (LC[j]! > 0 || abs(C[o + X]! - lt.x[j]!) > lt.w[j]! / 2 + CS * 0.7 || abs(C[o + Y]! - lt.y[j]!) > lt.h[j]! / 2 + 2.5) continue;
            LC[j] = 0.35;
            lt.kick(j, TY, C[o + VY]! * 3 - 120, 0.3);
            lt.kick(j, TX, C[o + VX]! * 4);
            lt.kick(j, ROT, (C[o + X]! < lt.x[j]! ? 1 : -1) * 320);
            C[o + VY] = abs(C[o + VY]!) * 0.4;
          }
        if (st !== DRIVE || abs(C[o + VX]!) < C[o + SP]! * 0.95 || abs(C[o + SQ]!) > 0.02) busy = true;
      }
      for (let j = 0; j < lt.n; j++) if (LC[j]! > 0) LC[j] = LC[j]! - dt;
      // Car on car: an exchange of momentum; hard enough, both go spinning. Car on beacon: it's knocked.
      for (let i = 0; i < N; i++) {
        const o = i * F;
        if (!C[o + ST]) continue;
        for (let j = i + 1; j < N; j++) {
          const q = j * F;
          // A car floating back up passes through the pile (the hover's on).
          if (!C[q + ST] || C[q + ST] === RECOVER || C[o + ST] === RECOVER) continue;
          const dx = C[q + X]! - C[o + X]!, dy = (C[q + Y]! - C[o + Y]!) * 1.6, dd = hypot(dx, dy);
          if (dd > CR * 2 || dd < 0.001) continue;
          const nx = dx / dd, ny = dy / dd, rv = (C[q + VX]! - C[o + VX]!) * nx + (C[q + VY]! - C[o + VY]!) * ny, push = (CR * 2 - dd) / 2;
          C[o + X] = C[o + X]! - nx * push;
          C[o + Y] = C[o + Y]! - (ny * push) / 1.6;
          C[q + X] = C[q + X]! + nx * push;
          C[q + Y] = C[q + Y]! + (ny * push) / 1.6;
          if (rv >= 0) continue;
          const jm = -1.7 * rv * 0.5;
          C[o + VX] = C[o + VX]! - jm * nx;
          C[o + VY] = C[o + VY]! - jm * ny;
          C[q + VX] = C[q + VX]! + jm * nx;
          C[q + VY] = C[q + VY]! + jm * ny;
          if (rv < -10) {
            const up = -18 - rnd() * 34 * min(1, -rv / 30);
            knock(i, 0, up, (rnd() - 0.5) * 16);
            knock(j, 0, up * 0.6, (rnd() - 0.5) * 16);
            const mx = (C[o + X]! + C[q + X]!) / 2, my = (C[o + Y]! + C[q + Y]!) / 2;
            for (let k = 0; k < 6; k++) fx.add(mx, my, (rnd() - 0.5) * 50, (rnd() - 0.8) * 40, 0.9, 0.4);
            if (S[WT]! > 0.7) say(rv < -24 ? 0 : 1, mx, my - 12);
          }
        }
        if (S[BON] && hypot(C[o + X]! - S[BX]!, C[o + Y]! - S[BY]!) < CS + 2.5) {
          const vx = C[o + VX]!;
          if (abs(vx) > 10 && C[o + ST] === DRIVE) {
            knock(i, -vx * 1.15, -22 - rnd() * 28, sign(vx) * (6 + rnd() * 6));
            S[BVX] = vx * 0.25;
            S[BVY] = -10;
            if (S[WT]! > 0.6) say(1, S[BX]!, S[BY]! - 12);
          }
        }
      }
      // The billboard rocket: off it goes, through the traffic, out of the sky; then it lands back.
      if (S[RK]) {
        busy = true;
        if (S[RK] === 1) {
          S[RVX] = S[RVX]! + 40 * dt;
          S[RVY] = S[RVY]! - 45 * dt;
          S[RX] = S[RX]! + S[RVX]! * dt;
          S[RY] = S[RY]! + S[RVY]! * dt;
          if ((S[RT] = S[RT]! - dt) <= 0) (S[RT] = 0.05), fx.add(S[RX]! - S[RVX]! * 0.05, S[RY]! - S[RVY]! * 0.05, 0, 0, 0.8, 0.5);
          for (let i = 0; i < N; i++) {
            const o = i * F;
            if (C[o + ST] && hypot(C[o + X]! - S[RX]!, C[o + Y]! - S[RY]!) < CS + 1) knock(i, S[RVX]! * 0.3, S[RVY]! * 0.3, 8);
          }
          for (let j = 0; j < lt.n; j++)
            if (!(LC[j]! > 0) && abs(S[RX]! - lt.x[j]!) < lt.w[j]! / 2 + 2 && abs(S[RY]! - lt.y[j]!) < lt.h[j]! / 2 + 2) (LC[j] = 0.4), lt.kick(j, TY, -220, 0.3), lt.kick(j, ROT, 260);
          if (S[RY]! < -10 || S[RX]! > W + 10) (S[RK] = 2), (S[RT] = 1.4);
        } else if (S[RK] === 2 && (S[RT] = S[RT]! - dt) <= 0) (S[RK] = 3), (S[RX] = BBX), (S[RY] = 30);
        else if (S[RK] === 3) {
          // Back down onto the board, nose up, with a little bounce.
          S[RY] = S[RY]! + 40 * dt;
          if (S[RY]! >= BBY) (S[RY] = BBY), (S[RK] = 0), fx.add(BBX, BBY + 3, -10, 0, 0.8, 0.3), fx.add(BBX, BBY + 3, 10, 0, 0.8, 0.3);
        }
      }
      if (fx.step(dt)) busy = true;
      if (S[WT]! < 1.2) (S[WT] = S[WT]! + dt), (busy = true);
      if (lt.step(dt)) busy = true;
      S[27] = tumbling;
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      lt.render();
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function island(k: number) {
    const x = IX[k]!, y = IY[k]!;
    star(g, x, y + 3.6, 2.2, 6, 0.4, S[NOW]! * 3);
    inked(g, K.mustard, 0.3);
    g.beginPath();
    g.ellipse(x, y, 9, 2.4, 0, 0, PI * 2);
    inked(g, k ? K.coral : K.teal, 0.45);
    g.beginPath();
    g.ellipse(x + 2.5, y - 0.8, 4, 4, 0, PI, 0);
    inked(g, K.cream, 0.4);
    g.beginPath();
    g.arc(x + 2.5, y - 2.4, 1, 0, PI * 2);
    inked(g, K.lit, 0.3);
    g.beginPath();
    g.moveTo(x - 3, y - 1.5);
    g.lineTo(x - 3, y - 8);
    g.strokeStyle = K.ink;
    g.lineWidth = 0.5;
    g.stroke();
    g.beginPath();
    g.moveTo(x - 6.5, y - 8.5);
    g.quadraticCurveTo(x - 3, y - 11, x + 1, y - 8);
    g.lineTo(x + 0.4, y - 7.2);
    g.quadraticCurveTo(x - 3, y - 9.6, x - 6.5, y - 8.5);
    inked(g, K.cream, 0.35);
  }

  function rocket(x: number, y: number, a: number, burn: boolean) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale(1.5, 1.5);
    if (burn) {
      g.beginPath();
      g.moveTo(-2.5, -1.3);
      g.quadraticCurveTo(-7 - sin(S[NOW]! * 40), 0, -2.5, 1.3);
      g.fillStyle = flame;
      g.fill();
    }
    g.beginPath();
    g.moveTo(3.6, 0);
    g.quadraticCurveTo(1.5, -1.8, -2.6, -1.2);
    g.lineTo(-2.6, 1.2);
    g.quadraticCurveTo(1.5, 1.8, 3.6, 0);
    inked(g, K.cream, 0.3);
    g.beginPath();
    g.moveTo(-1.2, -1.3);
    g.lineTo(-3.2, -2.8);
    g.lineTo(-2.6, -0.6);
    g.moveTo(-1.2, 1.3);
    g.lineTo(-3.2, 2.8);
    g.lineTo(-2.6, 0.6);
    inked(g, K.teal, 0.3);
    g.beginPath();
    g.arc(0.8, 0, 0.7, 0, PI * 2);
    inked(g, K.mustard, 0.25);
    g.restore();
  }

  function draw() {
    sky.begin();
    // The billboard's stand, down into the clouds.
    g.fillStyle = K.ink;
    g.fillRect(19, 75, 1.4, 10);
    // The skyway: lane lights along each lane.
    g.fillStyle = K.lit;
    g.globalAlpha = 0.45;
    for (let l = 0; l < 3; l++) for (let x = 3; x < W; x += 8) g.fillRect(x, laneY(l, x) + 4.2, 1.6, 0.6);
    g.globalAlpha = 1;
    island(0);
    island(1);
    // The rocket: painted on the board, or flying.
    if (S[RK] !== 2) rocket(S[RX]!, S[RY]!, S[RK] === 1 ? Math.atan2(S[RVY]!, S[RVX]!) : -0.9, S[RK] === 1 || S[RK] === 3);
    if (S[BON]) {
      // The beacon: a striped cone on a ring, its lamp blinking; it shrinks away at the end.
      const s = S[BT]! < 0.15 ? S[BT]! / 0.15 : S[BT]! > 5.2 ? max(0, (5.5 - S[BT]!) / 0.3) : 1;
      g.save();
      g.translate(S[BX]!, S[BY]!);
      g.rotate(S[BA]!);
      g.scale(s, s);
      if ((S[BT]! * 3) % 1 < 0.5) {
        g.globalAlpha = 0.35;
        star(g, 0, -4.5, 6, 8, 0.4, S[BT]!);
        g.fillStyle = K.mustard;
        g.fill();
        g.globalAlpha = 1;
      }
      g.beginPath();
      g.moveTo(-3, 3);
      g.lineTo(0, -4);
      g.lineTo(3, 3);
      g.closePath();
      inked(g, K.coral, 0.4);
      g.fillStyle = K.cream;
      g.fillRect(-1.6, -0.6, 3.2, 1.2);
      g.beginPath();
      g.ellipse(0, 3, 4.6, 1.2, 0, 0, PI * 2);
      inked(g, K.teal, 0.4);
      g.beginPath();
      g.arc(0, -4.4, 1, 0, PI * 2);
      inked(g, (S[BT]! * 3) % 1 < 0.5 ? K.lit : K.coralD, 0.3);
      g.restore();
    }
    for (let i = 0; i < N; i++) {
      const o = i * F, st = C[o + ST]!;
      if (!st) continue;
      const d = LD[C[o + LN]!]!, x = C[o + X]!, y = C[o + Y]!;
      car(g, x, y, CS, d, C[o + A]!, C[o + SQ]!, PAINT[C[o + PT]!]!, TRIM[C[o + PT]!]!, st === DRIVE ? 0 : 2);
      if (st !== DRIVE) {
        // Seeing stars.
        g.fillStyle = K.lit;
        for (let k = 0; k < 3; k++) {
          const a = S[NOW]! * 7 + k * 2.1 + i;
          star(g, x + cos(a) * 4, y - 6 + sin(a) * 1.2, 1, 4, 0.4, a);
          g.fill();
        }
      }
    }
    fx.draw(g, K.smoke);
    cloudBank(g, 82, K.cloud);
    if (S[WT]! < 1.1) shout(g, WORDS[S[WORD]!]!, S[WX]!, S[WY]!, 4.4, S[WT]!, 1.1, BURST[S[WORD]!]!);
  }

  engine.start();
  return {
    engine,
    tap,
    get cars() {
      let n = 0;
      for (let i = 0; i < N; i++) if (C[i * F + ST]) n++;
      return n;
    },
    get tumbling() {
      return S[27]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the opening pile-up at the beacon, cars
 *  in the air (scripts/gallery-posters.mjs draws it). */
export const posterAt = 4.4;

/** For `slot(fig, () => import("./sky-city-rush-hour-pile-up").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => rushHour(stage, slot, first);
