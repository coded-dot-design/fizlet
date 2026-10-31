// "Duck Derby": a tin-duck shooting gallery on the midway. Two rails carry a parade of tin ducks
// across the booth (the top one right, the bottom one left), with a red King duck worth three
// tickets. Tap to fire a cork: POP, and the duck it hits tips over backwards with a PING and a
// ticket flies down to your stub. Tap twice, quick, and the second shot is the big one: BOOM, a
// blast that knocks every duck in reach flat (and a reload you have to wait out). The booth's real
// sign and price card are on the wall behind the ducks: a cork that misses the ducks pings a letter
// of the sign and it swings on its nail; a BOOM shakes every letter near it. Fifteen seconds a
// round; at the bell the rails coast to a stop and the prize comes off the shelf: small, big or
// jumbo, by your tickets. Then it sleeps until the next tap.
// Bricks: the kernel (fixed step, settle: it sleeps when the rails stop and the last ticket has
// landed; busy(sec) holds the intro; its ledger for every page write, so Recall gives the page back
// byte for byte) and fizlet/slot. The booth, particles and prize: midway.ts; the letters: letters.ts.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { letters, ROT, TX, TY } from "./letters";
import { booth, CHIP, CREAM, CYAN, FONT, GOLD, GREEN, INK, NUM, PAPER, PURPLE, RED, SHADE, SMOKE, STAR, TAU, WOOD, WOOD2, W } from "./midway";

export type DerbyScene = SlotScene & { engine: ReturnType<typeof createEngine>; shoot(x: number, y: number, big: boolean): void; readonly state: { mode: number; tickets: number; down: number; booms: number; sweeps: number; left: number } };

const DUCKS = 8, LEN = 176, RAIL_A = 50, RAIL_B = 66, TOP = 72, GX = 80, GY = 76, ROUND = 15;
/** Modes: the intro parade, waiting, a round, the bell (rails coast, then the prize). */
const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
const POP = 0, BOOM = 1, PING = 2, THUNK = 3, KING = 4, TIME = 5, CLANG = 6, SWEEP = 7;
// State slots.
const MODE = 0, T = 1, SPEED = 2, TARGET = 3, POS_A = 4, POS_B = 5, LEFT = 6, AIM = 7, AIM_TO = 8, RECOIL = 9, RELOAD = 10, FLASH = 11;
const SHOT = 12, SX = 13, SY = 14, SBIG = 15, CD = 16, DEMO = 17, DOWN = 18, PRIZED = 19, WON = 34, SWEEPS = 35, BOOMS = 36;
const QN = 20; // queued taps (x, y, big) from slot 21

export function duckDerby(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): DerbyScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const R = engine.random;
  const skin = slot.querySelector<HTMLElement>("[data-dd]")!;
  const b = booth(engine, stage, skin, 17, 82.5);
  b.words(["POP!", "BOOM!", "PING!", "THUNK", "+3 KING!", "TIME!", "CLANG", "SWEEP! +5"]);
  const g = b.g, col = b.col, { circ, oval } = b;
  const lt = letters(engine, slot, ".dd i", 150, 7);
  const S = new Float64Array(40);
  // Ducks: which rail (0 top, 1 bottom), offset along the loop, tipped angle (0 up, π/2 flat), its
  // spin, King, the wobble after a ping.
  const RL = new Uint8Array(DUCKS), OFF = new Float32Array(DUCKS), ANG = new Float32Array(DUCKS), AV = new Float32Array(DUCKS), KG = new Uint8Array(DUCKS), WB = new Float32Array(DUCKS);
  for (let i = 0; i < DUCKS; i++) (RL[i] = i & 1), (OFF[i] = (i >> 1) * (LEN / 4) + (i & 1) * 22), (KG[i] = i === 5 ? 1 : 0);
  S[AIM] = S[AIM_TO] = -1.5708;
  S[DEMO] = first ? -1 : 1.3;
  if (!first) engine.busy(3.6); // the intro's demo shot and coast are scheduled: hold the engine for them
  S[TARGET] = 26;

  /** A tap at (x, y) art units; big: the second of a double tap. */
  const shoot = (x: number, y: number, big: boolean) => {
    const k = S[QN]!;
    if (k < 4) (S[21 + k * 3] = x), (S[22 + k * 3] = y), (S[23 + k * 3] = big ? 1 : 0), (S[QN] = k + 1);
    engine.wake();
  };
  const tap = new Float64Array(4); // x, y, last time, last x
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    b.at(e, tap, 0);
    const quick = e.timeStamp - tap[2]! < 320 && Math.abs(tap[0]! - tap[3]!) < 30;
    tap[2] = quick ? -1e9 : e.timeStamp; // a third tap starts a new pair
    tap[3] = tap[0]!;
    shoot(tap[0]!, tap[1]!, quick);
  }, { signal: engine.signal });
  // The stage takes taps; a pointer over it gets a crosshair.
  engine.ledger.style(stage, "cursor", "crosshair");
  engine.ledger.style(stage, "touch-action", "manipulation");

  const duckX = (i: number) => {
    const p = (((RL[i] ? S[POS_B]! : S[POS_A]!) + OFF[i]!) % LEN + LEN) % LEN;
    return RL[i] ? 168 - p : p - 8;
  };
  const railY = (i: number) => (RL[i] ? RAIL_B : RAIL_A);
  /** Knock duck i over (from the shot at x). */
  function knock(i: number, big: boolean) {
    const x = duckX(i), y = railY(i) - 6;
    AV[i] = big ? 14 : 9;
    ANG[i] = 0.05;
    WB[i] = 0;
    b.spray(STAR, x, y, big ? 4 : 7, 50, GOLD);
    b.spray(CHIP, x, y, 3, 40, PAPER);
    if (S[MODE] === PLAY) {
      b.ticket(x, y, KG[i] ? 3 : 1);
      if (KG[i]) b.say(KING, x, y - 10, RED, 7);
    }
    S[DOWN] = S[DOWN]! + 1;
  }
  /** Every duck in sight is down: a clean sweep, five tickets and the bulbs chase. */
  function sweep() {
    for (let i = 0; i < DUCKS; i++) if (ANG[i]! < 0.3 && duckX(i) > 8 && duckX(i) < 152) return;
    if (S[MODE] !== PLAY) return;
    S[SWEEPS] = S[SWEEPS]! + 1;
    b.say(SWEEP, 80, 44, GREEN, 10);
    b.ticket(80, 44, 5);
    b.chase(1.2);
  }
  function fire(x: number, y: number, big: boolean) {
    if (S[RELOAD]! > 0 || (!big && S[CD]! > 0)) return;
    S[AIM_TO] = Math.atan2(y - GY, x - GX);
    S[AIM] = S[AIM_TO]!; // the barrel snaps to the shot
    (S[SHOT] = 0.001), (S[SX] = x), (S[SY] = y), (S[SBIG] = big ? 1 : 0);
    S[RECOIL] = big ? 1 : 0.5;
    S[FLASH] = big ? 0.2 : 0.08;
    S[CD] = 0.12;
    if (big) (S[RELOAD] = 0.8), (S[BOOMS] = S[BOOMS]! + 1), b.shake(0.7);
    const mx = GX + Math.cos(S[AIM]!) * 19, my = GY + Math.sin(S[AIM]!) * 19;
    b.spray(SMOKE, mx, my, big ? 7 : 2, big ? 30 : 12, big ? CREAM : PAPER, S[AIM]!, 0.9);
  }
  /** The cork lands at (x, y): a duck, a letter, the wall or the counter. */
  function land(x: number, y: number, big: boolean) {
    let hit = 0;
    if (big) {
      b.say(BOOM, x, y - 4, GOLD, 12);
      b.spray(SMOKE, x, y, 10, 40, CREAM);
      b.spray(STAR, x, y, 10, 90, GOLD);
      for (let i = 0; i < DUCKS; i++) {
        const dx = duckX(i) - x, dy = railY(i) - 6 - y;
        if (ANG[i]! < 0.3 && dx * dx + dy * dy < 17 * 17 && duckX(i) > 8 && duckX(i) < 152) knock(i, true), hit++;
      }
      lt.blast(x, y, 22, 0.9);
      if (hit) sweep();
    } else {
      let best = -1, bd = 1e9;
      for (let i = 0; i < DUCKS; i++) {
        const dx = (duckX(i) - x) / 6.5, dy = (railY(i) - 6.5 - y) / 6.5, d = dx * dx + dy * dy, dxs = duckX(i);
        if (ANG[i]! < 0.3 && d < 1 && d < bd && dxs > 8 && dxs < 152) (bd = d), (best = i);
      }
      if (best >= 0) {
        knock(best, false), hit++;
        b.say(KG[best] ? CLANG : PING, x, y - 6, KG[best] ? RED : PAPER, 7);
        sweep();
      } else {
        // A miss: the sign's letters swing on their nails; the counter thunks; corks bounce off the wall.
        for (let i = 0; i < lt.n; i++) {
          if (Math.abs(lt.x[i]! - x) > lt.w[i]! / 2 + 1 || Math.abs(lt.y[i]! - y) > lt.h[i]! / 2 + 1) continue;
          const s = x < lt.x[i]! ? 1 : -1;
          lt.kick(i, ROT, s * 520, 0.4), lt.kick(i, TY, -260), lt.kick(i, TX, -s * 120);
          b.say(PING, x, y - 6, CYAN, 6);
          hit++;
          break;
        }
        if (!hit) b.say(y > TOP - 1 ? THUNK : POP, x, y - 5, y > TOP - 1 ? CREAM : PAPER, 6);
        b.spray(CHIP, x, y, 1, 30, WOOD2, -1.5708, 1.2, 2.4);
        b.spray(STAR, x, y, 3, 30, PAPER);
      }
    }
    return hit;
  }

  engine.add({
    read() {
      b.read();
      lt.read();
    },
    step(e, dt) {
      S[T] = S[T]! + dt;
      const mode = S[MODE]!;
      // Taps: the first starts a round; every tap is a shot (the first tap of a round too).
      for (let k = 0; k < S[QN]!; k++) {
        const x = S[21 + k * 3]!, y = S[22 + k * 3]!, big = S[23 + k * 3] === 1;
        if (S[MODE] === DONE && (!S[PRIZED] || b.prizing >= 0)) continue; // the bell, then the prize: wait for it
        if (S[MODE] !== PLAY) {
          (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[TARGET] = 26), (S[DEMO] = -1), (S[DOWN] = 0), (S[PRIZED] = 0), (S[WON] = 0), (S[SWEEPS] = 0);
          b.tickets = 0;
          for (let i = 0; i < DUCKS; i++) if (duckX(i) < 8 || duckX(i) > 152) ANG[i] = 0;
        }
        fire(x, y, big);
      }
      S[QN] = 0;
      if (mode === INTRO) {
        // The demo: the gun takes one shot at the duck nearest the middle of the top rail.
        if (S[DEMO]! > 0 && S[T]! >= S[DEMO]!) {
          S[DEMO] = -1;
          let best = -1, bd = 1e9;
          for (let i = 0; i < DUCKS; i++) if (!RL[i] && Math.abs(duckX(i) - 86) < bd) (bd = Math.abs(duckX(i) - 86)), (best = i);
          if (best >= 0) fire(duckX(best) + S[SPEED]! * 0.06 + 1, RAIL_A - 6.5, false);
        }
        if (S[T]! > 2.6) S[TARGET] = 0;
        if (S[T]! > 2.6 && S[SPEED]! < 0.3) (S[MODE] = IDLE), (S[SPEED] = 0);
      } else if (mode === PLAY) {
        S[LEFT] = Math.max(0, S[LEFT]! - dt);
        S[TARGET] = 26 + (ROUND - S[LEFT]!) * 1.4;
        if (S[LEFT] === 0) {
          (S[MODE] = DONE), (S[T] = 0), (S[TARGET] = 0);
          b.say(TIME, 80, 42, RED, 12);
          b.chase(1);
        }
      } else if (mode === DONE) {
        if (!S[PRIZED] && S[T]! > 1.1) {
          // The prize, by the tickets: off the left shelf (small, big) or the right one (jumbo).
          S[PRIZED] = 1;
          const k = b.tickets, tier = k >= 12 ? 2 : k >= 6 ? 1 : 0;
          b.prize(tier, tier === 2 ? 142 : tier === 1 ? 26 : 14, 34);
          S[WON] = tier + 1; // its shelf stays empty until the next round
        }
      }
      // The rails: ease toward their speed; the loop wraps behind the side posts, where a tipped
      // duck is stood up again.
      S[SPEED] = S[SPEED]! + (S[TARGET]! - S[SPEED]!) * Math.min(1, dt * (S[TARGET]! > S[SPEED]! ? 2.5 : 1.4));
      if (S[SPEED]! < 0.05 && S[TARGET] === 0) S[SPEED] = 0;
      S[POS_A] = (S[POS_A]! + S[SPEED]! * dt) % LEN;
      S[POS_B] = (S[POS_B]! + S[SPEED]! * 1.25 * dt) % LEN;
      let anim = 0;
      for (let i = 0; i < DUCKS; i++) {
        const x = duckX(i);
        if ((x < 2 || x > 158) && ANG[i]! > 0) (ANG[i] = 0), (AV[i] = 0);
        if (AV[i]! !== 0 || (ANG[i]! > 0 && ANG[i]! < 1.5707)) {
          anim++;
          AV[i] = AV[i]! + 26 * dt;
          ANG[i] = ANG[i]! + AV[i]! * dt;
          if (ANG[i]! >= 1.5708) (ANG[i] = 1.5708), (AV[i] = Math.abs(AV[i]!) > 3 ? -AV[i]! * 0.25 : 0);
        }
        if (WB[i]! < 1) (WB[i] = WB[i]! + dt * 2), anim++;
      }
      // The cork in the air, the gun's recoil and aim, the muzzle flash.
      if (S[SHOT]! > 0) {
        S[SHOT] = S[SHOT]! + dt;
        if (S[SHOT]! >= (S[SBIG] ? 0.05 : 0.07)) (S[SHOT] = 0), land(S[SX]!, S[SY]!, S[SBIG] === 1);
      }
      S[AIM] = S[AIM]! + (S[AIM_TO]! - S[AIM]!) * Math.min(1, dt * 10);
      S[RECOIL] = Math.max(0, S[RECOIL]! - dt * 4);
      S[RELOAD] = Math.max(0, S[RELOAD]! - dt);
      S[CD] = Math.max(0, S[CD]! - dt);
      S[FLASH] = Math.max(0, S[FLASH]! - dt);
      const flying = b.step(dt), moving = lt.step(dt);
      if (S[SPEED]! > 0 || anim || flying || moving || S[SHOT]! > 0 || S[RECOIL]! > 0 || S[RELOAD]! > 0 || S[MODE] === PLAY || (S[MODE] === DONE && (!S[PRIZED] || b.prizing >= 0)) || Math.abs(S[AIM_TO]! - S[AIM]!) > 0.002) e.busy();
    },
    render() {
      lt.render();
      const t = S[T]!;
      b.begin();
      b.awning(12, 10);
      b.bulbs(8, 152, 20.5, 10);
      // Side posts (the loop goes round behind them), shelves and the prizes on them.
      g.fillStyle = col[WOOD2]!;
      g.fillRect(14, 35.5, 26, 1.6);
      g.fillRect(128, 35.5, 24, 1.6);
      const tier = S[WON]! - 1;
      if (tier !== 0) b.plush(14, 35.5, 9, PURPLE, 0, 0.6);
      if (tier !== 1) b.plush(27, 35.5, 12, CYAN, 0, 0.6);
      if (tier !== 2) b.plush(141, 35.5, 15, RED, 0, 0.6);
      // The rails and their ducks (the top rail first: it is further back).
      for (let r = 0; r < 2; r++) {
        const ry = r ? RAIL_B : RAIL_A;
        g.fillStyle = col[SHADE]!;
        g.globalAlpha = 0.35;
        g.fillRect(8, ry + 1.6, 144, 2.4);
        g.globalAlpha = 1;
        g.fillStyle = col[WOOD]!;
        g.fillRect(8, ry, 144, 2);
        g.fillStyle = col[GOLD]!;
        for (let k = 0; k < 18; k++) g.fillRect(10 + ((k * 8 + (r ? -1 : 1) * (r ? S[POS_B]! : S[POS_A]!)) % 144 + 144) % 144, ry + 0.6, 1.2, 0.8);
        for (let i = 0; i < DUCKS; i++) if (RL[i] === r) duck(i);
      }
      // Side posts over the wrap.
      for (let s = 0; s < 2; s++) {
        const x = s ? 152 : 0;
        g.fillStyle = col[WOOD]!;
        g.fillRect(x, 20, 8, TOP - 20);
        g.fillStyle = col[s ? CREAM : RED]!;
        for (let k = 0; k < 6; k++) g.fillRect(x + 1.5, 24 + k * 8, 5, 4);
      }
      b.bulbs(4, 4, 30, 1, 1), b.bulbs(156, 156, 30, 1, 1);
      // The counter's lip, the cork in flight, the gun.
      g.fillStyle = col[WOOD2]!;
      g.fillRect(0, TOP, W, 3.2);
      g.fillStyle = col[GOLD]!;
      g.fillRect(0, TOP + 3.2, W, 0.6);
      const a = S[AIM]!, ca = Math.cos(a), sa = Math.sin(a), rc = S[RECOIL]! * 2.4;
      if (S[SHOT]! > 0) {
        const u = S[SHOT]! / (S[SBIG] ? 0.05 : 0.07), mx = GX + ca * 19, my = GY + sa * 19;
        const x = mx + (S[SX]! - mx) * u, y = my + (S[SY]! - my) * u;
        g.strokeStyle = col[S[SBIG] ? GOLD : PAPER]!;
        g.globalAlpha = 0.5;
        g.lineWidth = S[SBIG] ? 2.2 : 0.8;
        g.beginPath();
        g.moveTo(mx + (x - mx) * 0.4, my + (y - my) * 0.4);
        g.lineTo(x, y);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = col[S[SBIG] ? GOLD : CREAM]!;
        circ(x, y, S[SBIG] ? 1.8 : 0.9);
      }
      g.save();
      g.beginPath();
      g.rect(0, 0, W, TOP + 3.8); // the stock stays above the counter's front
      g.clip();
      g.translate(GX - ca * rc, GY - sa * rc);
      g.rotate(a);
      // The stock (behind the pivot), the barrel with gold bands, a bell mouth that flares while it
      // reloads from a BOOM, the cork waiting on the muzzle.
      g.fillStyle = col[RED]!;
      g.beginPath();
      g.moveTo(-9, -2.2), g.lineTo(0, -1.8), g.lineTo(0, 2), g.lineTo(-9, 3.4);
      g.fill();
      g.fillStyle = col[INK]!;
      g.beginPath();
      g.roundRect(-2, -1.9, 18, 3.8, 1.2);
      g.fill();
      g.fillStyle = col[GOLD]!;
      g.fillRect(3, -1.9, 1.2, 3.8);
      g.fillRect(11, -1.9, 1.2, 3.8);
      g.fillStyle = col[PURPLE]!;
      g.fillRect(-1, -1.2, 16, 0.8);
      g.fillStyle = col[INK]!;
      g.beginPath();
      g.moveTo(15, -1.9), g.lineTo(18.5, -3 - S[RELOAD]! * 2.5), g.lineTo(18.5, 3 + S[RELOAD]! * 2.5), g.lineTo(15, 1.9);
      g.fill();
      if (S[CD]! <= 0 && S[RELOAD]! <= 0 && S[SHOT]! <= 0) {
        g.fillStyle = col[CREAM]!;
        g.beginPath();
        g.roundRect(18, -1.4, 2.4, 2.8, 0.6);
        g.fill();
      }
      if (S[FLASH]! > 0) {
        const f = S[FLASH]! * (S[SBIG] ? 30 : 60);
        g.fillStyle = col[GOLD]!;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(19, 0), g.lineTo(21 + f * 1.4, -f * 0.6), g.lineTo(20 + f, 0), g.lineTo(21 + f * 1.4, f * 0.6);
        g.fill();
        g.globalAlpha = 1;
      }
      g.restore();
      g.fillStyle = col[WOOD]!;
      g.beginPath();
      g.arc(GX, GY + 0.5, 4.4, Math.PI, 0);
      g.fill();
      g.fillStyle = col[GOLD]!;
      circ(GX, GY - 1, 1);
      // The clock: a pie of the round left, the seconds.
      const over = S[MODE] === DONE && b.prizing < 0 && S[PRIZED] === 1, left = S[MODE] === PLAY ? S[LEFT]! : S[MODE] === DONE && !over ? 0 : ROUND;
      b.clock(143, 82.5, left, ROUND, left < 4 && S[MODE] === PLAY);
      if (S[MODE] === IDLE || over || (S[MODE] === INTRO && t > 2.6)) {
        b.hint(141, 74.6, over ? "AGAIN?" : "TAP TO PLAY");
      }
      b.draw();
      b.drawPrize(PRIZE_COL, "WINNER!");
    },
  });

  const PRIZE_COL = [PURPLE, CYAN, RED];
  /** A tin duck on its rail: tipping back flattens it toward the rail; the King wears a crown. */
  function duck(i: number) {
    const x = duckX(i), ry = railY(i), a = ANG[i]!, dir = RL[i] ? -1 : 1;
    if (x < -8 || x > 168) return;
    const sy = Math.cos(a), wob = WB[i]! < 1 ? Math.sin(WB[i]! * 30) * (1 - WB[i]!) * 0.15 : 0;
    g.save();
    g.translate(x, ry);
    g.scale(dir, sy);
    g.rotate(wob);
    // The stand, the body, the tail, the head, the beak, the eye, the target on its side.
    g.fillStyle = col[WOOD2]!;
    g.fillRect(-0.6, -3, 1.2, 3);
    g.fillStyle = col[KG[i] ? RED : GOLD]!;
    oval(0, -5.8, 5.4, 3.2);
    g.beginPath();
    g.moveTo(-4.5, -7), g.lineTo(-7, -9.6), g.lineTo(-4, -5.2);
    g.fill();
    circ(3.4, -10.2, 2.5);
    g.fillStyle = col[KG[i] ? GOLD : RED]!;
    g.beginPath();
    g.moveTo(5.4, -10.8), g.lineTo(8.2, -9.9), g.lineTo(5.4, -9.1);
    g.fill();
    g.fillStyle = col[INK]!;
    circ(4, -10.8, 0.6);
    g.fillStyle = col[PAPER]!;
    circ(0, -5.8, 1.8);
    g.fillStyle = col[RED]!;
    circ(0, -5.8, 0.8);
    if (KG[i]) {
      g.fillStyle = col[GOLD]!;
      g.beginPath();
      g.moveTo(1.6, -12.2), g.lineTo(1.8, -14.6), g.lineTo(2.8, -13.2), g.lineTo(3.6, -15), g.lineTo(4.4, -13.2), g.lineTo(5.4, -14.6), g.lineTo(5.2, -12.2);
      g.fill();
    }
    // Shine on the tin.
    g.fillStyle = col[PAPER]!;
    g.globalAlpha = 0.45;
    g.fillRect(-2.8, -8.2, 3.4, 0.7);
    g.globalAlpha = 1;
    g.restore();
  }

  engine.start();
  if (first) {
    const k = W / (stage.clientWidth || 1);
    shoot(first.x * k, first.y * k, false);
  }
  return {
    engine,
    shoot,
    /** For tests: the mode (0 intro, 1 idle, 2 a round, 3 the bell), tickets, ducks down, BOOMs, sweeps, seconds left. */
    get state() {
      return { mode: S[MODE]!, tickets: b.tickets, down: S[DOWN]!, booms: S[BOOMS]!, sweeps: S[SWEEPS]!, left: S[LEFT]! };
    },
    /** For tests: where duck i is (art units), and whether it is standing. */
    duck(i: number) {
      return { x: duckX(i), y: railY(i) - 6.5, up: ANG[i]! < 0.3 };
    },
    /** The poster's canvas is drawn smaller (scripts/gallery-posters.mjs). */
    poster: () => b.poster(),
    destroy: () => engine.destroy(),
  } as DerbyScene & { duck(i: number): { x: number; y: number; up: boolean } };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => duckDerby(stage, slot, first);
/** The poster: the intro, the demo shot just landed (scripts/gallery-posters.mjs). */
export const posterAt = 1.5;
