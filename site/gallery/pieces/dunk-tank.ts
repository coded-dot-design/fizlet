// "Dunk Sir Dry": the midway dunk tank, and the smuggest man on it. Sir Dry sits on the plank over
// the tank in his striped bathing suit and bowler, arms folded, and tells you you'll miss. Tap to
// throw a ball where you tap (it flies in from your hand on an arc); tap twice, quick, and the
// second is a fastball. Hit the target and the plank drops: SPLOOSH, and the splash really flies:
// every drop that lands on the booth's sign wets that letter (it sags, goes blue and drips dry). He
// climbs back up, soggy, and the prize comes down. Hit him instead and he says OI (a fastball takes
// his hat); the glass goes TONK; a ball on the sign knocks the letter it hits. Five balls a go; miss
// with all five and you still get a small one. Then it sleeps until the next tap.
// Bricks: the kernel (fixed step, settle: it sleeps once he is dry and seated and the last ball has
// stopped rolling; busy(sec) holds the intro; its ledger for every page write, so Recall gives the
// page back byte for byte) and fzlt/slot. The booth, particles and prize: midway.ts; the letters:
// letters.ts.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { letters, ROT, STRETCH, TX, TY } from "./letters";
import { booth, CHIP, CREAM, CYAN, DROP, FONT, GOLD, INK, PAPER, PURPLE, RED, SKIN, SMOKE, STAR, W, WOOD, WOOD2 } from "./midway";

export type DunkScene = SlotScene & { engine: ReturnType<typeof createEngine>; throwAt(x: number, y: number, fast: boolean): void; readonly state: { mode: number; balls: number; dunks: number; wet: number; fast: number } };

const BALLS = 5, TX0 = 88, TX1 = 142, TTOP = 50, FLOOR = 75, WATER = 58, SEAT = 46, DX = 114, TGX = 74, TGY = 38, TGR = 6.5;
const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
/** Sir Dry: seated, falling, under, climbing back. */
const SIT = 0, FALL = 1, UNDER = 2, CLIMB = 3;
const SPLOOSH = 0, OI = 1, TONK = 2, THUD = 3, FAST = 4, BULLSEYE = 5;
const SAYS = ["MISS ME?", "HA! MISSED!", "TOO SLOW!", "IS THAT IT?", "...RUDE.", "MY HAT!", "OI!", "COME ON THEN!", "SO CLOSE!"];
const MISS0 = 1, RUDE = 4, MYHAT = 5, OIS = 6, COME = 7, CLOSE = 8;
// State slots.
const MODE = 0, T = 1, LEFT = 2, POSE = 3, PT = 4, DY = 5, DVY = 6, SEATA = 7, BUB = 8, BUBI = 9, HAT = 10, HATX = 11, HATY = 12, HATVX = 13, HATVY = 14;
const AMP = 15, WOB = 16, GLASS = 17, SOG = 18, DUNKS = 19, FASTS = 20, PRIZED = 21, LASTBALL = 22, DEMO = 23, HURT = 24, MISSES = 26, Q = 27;
// Balls: [0] flight (0..1, then -1 falling, -2 gone), x0, y0, tx, ty, fast, x, y, vx, vy, age.
const NB = 4, BS = 11;

export function dunkTank(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): DunkScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const R = engine.random, L = engine.ledger;
  const skin = slot.querySelector<HTMLElement>("[data-dk]")!;
  const b = booth(engine, stage, skin, -1, 0); // no ticket stub: the balls left are the count here
  b.words(["SPLOOSH!", "OI!", "TONK", "THUD", "FASTBALL!", "BULLSEYE!"]);
  const g = b.g, col = b.col, { circ, oval } = b;
  const lt = letters(engine, slot, ".dk i", 160, 8);
  // Wet letters: seconds left to dry; the attribute as last written.
  const WETT = new Float32Array(lt.n), WAS = new Uint8Array(lt.n);
  const S = new Float64Array(40), B = new Float64Array(NB * BS);
  for (let k = 0; k < NB; k++) B[k * BS] = -2;
  (S[LEFT] = BALLS), (S[HAT] = 1), (S[DEMO] = first ? -1 : 1.1), (S[BUB] = first ? 0 : 1.3), (S[BUBI] = COME);
  if (!first) engine.busy(3.8); // the intro's taunt and demo throw are scheduled: hold the engine for them

  /** Throw at (x, y) art units; fast: the second of a double tap. */
  const throwAt = (x: number, y: number, fast: boolean) => {
    const k = S[Q]!;
    if (k < 4) (S[28 + k * 3] = x), (S[29 + k * 3] = y), (S[30 + k * 3] = fast ? 1 : 0), (S[Q] = k + 1);
    engine.wake();
  };
  const tap = new Float64Array(4);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    b.at(e, tap, 0);
    const quick = e.timeStamp - tap[2]! < 320 && Math.abs(tap[0]! - tap[3]!) < 30;
    tap[2] = quick ? -1e9 : e.timeStamp;
    tap[3] = tap[0]!;
    throwAt(tap[0]!, tap[1]!, quick);
  }, { signal: engine.signal });
  L.style(stage, "cursor", "crosshair");
  L.style(stage, "touch-action", "manipulation");

  const say = (i: number, sec = 1.6) => ((S[BUBI] = i), (S[BUB] = sec));
  function launch(x: number, y: number, fast: boolean) {
    for (let k = 0; k < NB; k++) {
      const o = k * BS;
      if (B[o]! > -2) continue;
      (B[o] = 0), (B[o + 1] = fast ? 80 : 60 + R() * 40), (B[o + 2] = 100), (B[o + 3] = x), (B[o + 4] = y), (B[o + 5] = fast ? 1 : 0), (B[o + 10] = 0);
      if (fast) (S[FASTS] = S[FASTS]! + 1), b.say(FAST, 80, 80, GOLD, 7);
      return true;
    }
    return false;
  }
  /** A drop hit a letter: it gets wet (sags, goes blue, drips dry). */
  const wetHit = (x: number, y: number) => {
    for (let i = 0; i < lt.n; i++) {
      if (Math.abs(lt.x[i]! - x) > lt.w[i]! / 2 || Math.abs(lt.y[i]! - y) > lt.h[i]! / 2) continue;
      WETT[i] = 3 + R() * 1.5;
      lt.kick(i, TY, 140), lt.kick(i, STRETCH, -50), lt.kick(i, ROT, (R() - 0.5) * 200);
      return true;
    }
    return false;
  };
  /** The ball lands at (x, y) on the booth's plane: target, Sir Dry, the glass, a letter, the wall. */
  function land(o: number) {
    const x = B[o + 3]!, y = B[o + 4]!, fast = B[o + 5] === 1, play = S[MODE] === PLAY;
    (B[o] = -1), (B[o + 6] = x), (B[o + 7] = y), (B[o + 8] = (R() - 0.5) * 30), (B[o + 9] = -25), (B[o + 10] = 0);
    if (Math.hypot(x - TGX, y - TGY) < TGR + 2.6 && S[POSE] === SIT) {
      // BULLSEYE: the plank drops.
      b.say(BULLSEYE, TGX, TGY - 9, GOLD, 8);
      b.spray(STAR, TGX, TGY, 12, 90, GOLD);
      (S[POSE] = FALL), (S[PT] = 0), (S[DVY] = -20), (S[BUB] = 0);
      if (play) S[DUNKS] = S[DUNKS]! + 1;
      return;
    }
    if (S[POSE] === SIT && Math.abs(x - DX) < 7 && y > SEAT - 26 && y < SEAT + 2) {
      // Him: OI (a fastball takes his hat).
      b.say(OI, x, y - 6, RED, 8);
      b.spray(STAR, x, y, 6, 50, GOLD);
      S[HURT] = 0.5;
      if (fast && S[HAT]) (S[HAT] = 0), (S[HATX] = DX), (S[HATY] = SEAT - 22), (S[HATVX] = x < DX ? 40 : -40), (S[HATVY] = -60), say(MYHAT);
      else say(OIS, 1.2);
      B[o + 8] = x < DX ? -40 : 40;
      if (play) S[MISSES] = S[MISSES]! + 1;
      return;
    }
    if (play) S[MISSES] = S[MISSES]! + 1;
    if (x > TX0 - 2 && x < TX1 + 2 && y > TTOP && y < FLOOR) {
      b.say(TONK, x, y - 6, CYAN, 7);
      (S[GLASS] = 0.4), (S[AMP] = Math.max(S[AMP]!, fast ? 1.6 : 0.8));
      B[o + 9] = 10;
    } else {
      let hit = 0;
      for (let i = 0; i < lt.n && !hit; i++) {
        if (Math.abs(lt.x[i]! - x) > lt.w[i]! / 2 + 2 || Math.abs(lt.y[i]! - y) > lt.h[i]! / 2 + 2) continue;
        const s = x < lt.x[i]! ? 1 : -1;
        lt.kick(i, ROT, s * (fast ? 700 : 420), 0.4), lt.kick(i, TY, -300), lt.kick(i, TX, -s * 160);
        hit = 1;
      }
      if (fast) lt.blast(x, y, 16, 0.8);
      if (!hit) b.say(THUD, x, y - 6, CREAM, 6), b.spray(CHIP, x, y, 3, 30, PAPER);
    }
    if (S[POSE] === SIT && S[BUB]! <= 0.2) say(MISS0 + ((R() * 3) | 0));
  }

  engine.add({
    read() {
      b.read();
      lt.read();
    },
    step(e, dt) {
      S[T] = S[T]! + dt;
      // Taps: the first starts a go; each is a throw while balls are left.
      for (let k = 0; k < S[Q]!; k++) {
        const x = S[28 + k * 3]!, y = S[29 + k * 3]!, fast = S[30 + k * 3] === 1;
        if (S[MODE] === DONE && (!S[PRIZED] || b.prizing >= 0)) continue;
        if (S[MODE] !== PLAY) (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = BALLS), (S[DUNKS] = 0), (S[PRIZED] = 0), (S[MISSES] = 0), (S[HAT] = 1);
        if (S[LEFT]! > 0 && S[POSE] === SIT && launch(x, y, fast)) (S[LEFT] = S[LEFT]! - 1), (S[LASTBALL] = 0);
      }
      S[Q] = 0;
      if (S[MODE] === INTRO) {
        if (S[DEMO]! > 0 && S[T]! >= S[DEMO]!) (S[DEMO] = -1), launch(TX0 + 8, 62, false); // the demo ball: TONK off the glass
        if (S[T]! > 3.4) S[MODE] = IDLE;
      }
      // The balls: in flight to the booth, then falling, bouncing and rolling to a stop.
      let live = 0;
      for (let k = 0; k < NB; k++) {
        const o = k * BS;
        if (B[o]! === -2) continue;
        live++;
        if (B[o]! >= 0) {
          B[o] = B[o]! + dt / (B[o + 5] ? 0.22 : 0.42);
          if (B[o]! >= 1) land(o);
          continue;
        }
        B[o + 10] = B[o + 10]! + dt;
        B[o + 9] = B[o + 9]! + 220 * dt;
        (B[o + 6] = B[o + 6]! + B[o + 8]! * dt), (B[o + 7] = B[o + 7]! + B[o + 9]! * dt);
        if (B[o + 7]! > FLOOR - 2.6) (B[o + 7] = FLOOR - 2.6), (B[o + 9] = -Math.abs(B[o + 9]!) * 0.45), (B[o + 8] = B[o + 8]! * 0.8);
        // The tank's walls stop it (it is in front of the glass: it bounces off the edges).
        if (B[o + 7]! > TTOP && B[o + 6]! > TX0 - 3 && B[o + 6]! < TX0 + 2) (B[o + 6] = TX0 - 3), (B[o + 8] = -Math.abs(B[o + 8]!) * 0.6);
        if (B[o + 7]! > TTOP && B[o + 6]! < TX1 + 3 && B[o + 6]! > TX1 - 2) (B[o + 6] = TX1 + 3), (B[o + 8] = Math.abs(B[o + 8]!) * 0.6);
        if (B[o + 10]! > 1.6) B[o] = -2;
      }
      // Sir Dry: the fall, the splash, under, and the climb back up.
      S[PT] = S[PT]! + dt;
      const pose = S[POSE]!;
      if (pose === FALL) {
        S[SEATA] = Math.min(1.35, S[SEATA]! + dt * 9);
        S[DVY] = S[DVY]! + 300 * dt;
        S[DY] = S[DY]! + S[DVY]! * dt;
        if (S[DY]! > WATER - SEAT + 2) {
          // SPLOOSH: water everywhere; each drop that reaches the sign wets its letter.
          (S[POSE] = UNDER), (S[PT] = 0), (S[AMP] = 4.5), (S[SOG] = 1);
          b.say(SPLOOSH, DX, WATER - 16, CYAN, 12);
          b.spray(DROP, DX, WATER, 46, 175, CYAN, -2.35, 1.1, 1.4);
          b.spray(DROP, DX, WATER, 22, 130, CYAN, -1.1, 1.2, 1.4);
          b.spray(DROP, DX, WATER, 14, 60, PAPER, -1.5708, 1, 1);
          b.shake(0.5);
        }
      } else if (pose === UNDER) {
        S[DY] = Math.min(FLOOR - SEAT - 6, S[DY]! + 30 * dt * Math.max(0, 1 - S[PT]! * 0.8));
        if (((S[PT]! * 10) | 0) !== (((S[PT]! - dt) * 10) | 0)) b.spray(SMOKE, DX + (R() - 0.5) * 8, SEAT + S[DY]! - 8, 1, 8, PAPER, -1.5708, 0.6, 0.5);
        if (S[PT]! > 1.8) {
          (S[POSE] = CLIMB), (S[PT] = 0);
          if (S[MODE] === PLAY && !S[PRIZED]) prize(); // he comes up spluttering; the prize comes down
        }
      } else if (pose === CLIMB) {
        const u = Math.min(1, S[PT]! / 0.9);
        S[DY] = (1 - u * u * (3 - 2 * u)) * (FLOOR - SEAT - 6);
        S[SEATA] = Math.max(0, S[SEATA]! - dt * 2);
        if (u >= 1) (S[POSE] = SIT), (S[PT] = 0), (S[DY] = 0), (S[SEATA] = 0), say(RUDE, 1.8);
      }
      if (S[SOG]! > 0) {
        // Dripping dry on the plank.
        S[SOG] = Math.max(0, S[SOG]! - dt * 0.18);
        if (S[POSE] === SIT && ((S[T]! * 5) | 0) !== (((S[T]! - dt) * 5) | 0)) b.spray(DROP, DX + (R() - 0.5) * 10, SEAT - 4, 1, 6, CYAN, 1.5708, 0.5, 0.8);
      }
      // A go runs out of balls: the last one rolls to a stop, then a consolation plush.
      if (S[MODE] === PLAY && S[LEFT] === 0 && !live && S[POSE] === SIT && !S[PRIZED]) {
        S[LASTBALL] = S[LASTBALL]! + dt;
        if (S[LASTBALL]! > 0.6) say(CLOSE, 2), prize();
      }
      // The hat, the water, the glass, the bubble.
      // His hat, knocked off: it falls to the floor and lies there until he next comes up out of the
      // tank (he fishes it out) or a new go starts.
      if (!S[HAT]) {
        if (S[HATY]! < FLOOR - 1) {
          S[HATVY] = S[HATVY]! + 200 * dt;
          (S[HATX] = S[HATX]! + S[HATVX]! * dt), (S[HATY] = Math.min(FLOOR - 1, S[HATY]! + S[HATVY]! * dt));
          live++;
        }
        if (S[POSE] === CLIMB) S[HAT] = 1;
      }
      S[AMP] = S[AMP]! * Math.pow(0.35, dt);
      if (S[AMP]! < 0.05) S[AMP] = 0;
      S[WOB] = S[WOB]! + dt;
      S[GLASS] = Math.max(0, S[GLASS]! - dt);
      S[BUB] = Math.max(0, S[BUB]! - dt);
      S[HURT] = Math.max(0, S[HURT]! - dt);
      let wet = 0;
      for (let i = 0; i < lt.n; i++) if (WETT[i]! > 0) (WETT[i] = Math.max(0, WETT[i]! - dt)), wet++;
      const flying = b.step(dt);
      b.catch(DROP, wetHit);
      const moving = lt.step(dt);
      if (live || wet || flying || moving || S[POSE] !== SIT || S[AMP]! > 0 || S[SOG]! > 0 || S[BUB]! > 0 || S[GLASS]! > 0 || S[HURT]! > 0 || (S[MODE] === PLAY && S[LEFT]! > 0) || (S[MODE] === DONE && b.prizing >= 0)) e.busy();
    },
    render() {
      lt.render();
      for (let i = 0; i < lt.n; i++) {
        const w = WETT[i]! > 0 ? 1 : 0;
        if (w !== WAS[i]) (WAS[i] = w), L.attr(lt.els[i]!, "data-wet", w ? "" : null);
      }
      b.begin();
      b.awning(9, 10);
      b.bulbs(8, 152, 17.5, 10);
      // The target on its post, the arm to the plank's latch.
      g.fillStyle = col[WOOD2]!;
      g.fillRect(TGX - 1, TGY, 2, FLOOR - TGY);
      g.fillRect(TGX, TGY - 0.6, TX0 + 8 - TGX, 1.2);
      const rings = [RED, PAPER, RED, PAPER, GOLD];
      for (let k = 0; k < 5; k++) (g.fillStyle = col[rings[k]!]!), circ(TGX, TGY, TGR * (1 - k * 0.19));
      // The tank: the back of the water, Sir Dry, the water over him, the glass.
      const sh = S[GLASS]! > 0 ? Math.sin(S[GLASS]! * 60) * S[GLASS]! * 1.5 : 0;
      g.save();
      g.translate(sh, 0);
      const amp = S[AMP]!, t = S[WOB]!;
      plank();
      dry();
      g.fillStyle = col[CYAN]!;
      g.globalAlpha = 0.42;
      g.beginPath();
      g.moveTo(TX0, FLOOR);
      for (let x = TX0; x <= TX1; x += 3) g.lineTo(x, WATER + Math.sin(x * 0.35 + t * 9) * amp * 0.6 + Math.sin(x * 0.9 - t * 13) * amp * 0.3 + Math.sin(x * 0.2 + t * 1.7) * 0.4);
      g.lineTo(TX1, FLOOR);
      g.fill();
      g.globalAlpha = 0.2;
      g.fillStyle = col[PAPER]!;
      g.fillRect(TX0 + 3, TTOP + 2, 2.4, FLOOR - TTOP - 4);
      g.globalAlpha = 1;
      g.strokeStyle = col[PAPER]!;
      g.lineWidth = 1.4;
      g.strokeRect(TX0, TTOP, TX1 - TX0, FLOOR - TTOP);
      g.fillStyle = col[WOOD]!;
      g.fillRect(TX0 - 2, FLOOR - 2.5, TX1 - TX0 + 4, 2.5);
      g.fillRect(TX0 - 2, TTOP - 1.2, 3.5, 1.6);
      g.fillRect(TX1 - 1.5, TTOP - 1.2, 3.5, 1.6);
      g.restore();
      // The hat on its own, the balls, the bubble, the balls left.
      if (!S[HAT]) (g.save(), g.translate(S[HATX]!, S[HATY]!), g.rotate(S[HATY]! < FLOOR - 1 ? S[HATY]! * 0.3 : 0), bowler(), g.restore());
      for (let k = 0; k < NB; k++) {
        const o = k * BS, f = B[o]!;
        if (f === -2) continue;
        let x = B[o + 6]!, y = B[o + 7]!, r = 2.6;
        if (f >= 0) {
          const u = f, arc = B[o + 5] ? 5 : 22;
          (x = B[o + 1]! + (B[o + 3]! - B[o + 1]!) * u), (y = B[o + 2]! + (B[o + 4]! - B[o + 2]!) * u - Math.sin(u * Math.PI) * arc), (r = 2.6 * (1 + (1 - u) * 2.2));
        }
        g.globalAlpha = f < 0 && B[o + 10]! > 1.2 ? (1.6 - B[o + 10]!) / 0.4 : 1;
        g.fillStyle = col[B[o + 5] ? GOLD : PAPER]!;
        circ(x, y, r);
        g.strokeStyle = col[RED]!;
        g.lineWidth = r * 0.22;
        g.beginPath();
        g.arc(x - r * 0.9, y, r * 0.8, -0.9, 0.9);
        g.moveTo(x + r * 0.9 + r * 0.8 * Math.cos(Math.PI - 0.9), y + r * 0.8 * Math.sin(Math.PI - 0.9));
        g.arc(x + r * 0.9, y, r * 0.8, Math.PI - 0.9, Math.PI + 0.9);
        g.stroke();
        g.globalAlpha = 1;
      }
      if (S[BUB]! > 0 && S[POSE] === SIT) bubble(SAYS[S[BUBI]!]!);
      for (let k = 0; k < BALLS; k++) {
        g.fillStyle = col[k < S[LEFT]! || (S[MODE] === DONE && b.prizing < 0) ? PAPER : WOOD2]!;
        circ(126 + k * 6, 83, 2.2);
      }
      b.draw();
      if (S[MODE] === IDLE || (S[MODE] === DONE && b.prizing < 0) || (S[MODE] === INTRO && S[T]! > 3)) b.hint(103, 83, S[MODE] === DONE ? "AGAIN?" : "TAP TO THROW");
      b.drawPrize(PRIZE_COL, S[DUNKS] ? "DUNKED!" : "WINNER!");
    },
  });

  const PRIZE_COL = [PURPLE, CYAN, RED];
  function prize() {
    S[PRIZED] = 1;
    S[MODE] = DONE;
    const used = BALLS - S[LEFT]!;
    b.prize(!S[DUNKS] ? 0 : used <= 2 ? 2 : 1, 80, -20);
  }
  /** The plank (hinged at its right end: it drops when the target is hit). */
  function plank() {
    g.save();
    g.translate(DX + 15, SEAT);
    g.rotate(-S[SEATA]!);
    g.fillStyle = col[WOOD]!;
    g.fillRect(-28, 0, 30, 2.4);
    g.fillStyle = col[GOLD]!;
    g.fillRect(-28, 0, 30, 0.6);
    g.restore();
    g.fillStyle = col[WOOD2]!;
    g.fillRect(DX + 15, SEAT - 2, 2.4, TTOP - SEAT + 2);
  }
  function bowler() {
    g.fillStyle = col[INK]!;
    oval(0, 0, 6, 1.2);
    g.beginPath();
    g.arc(0, 0, 4, Math.PI, 0);
    g.fill();
    g.fillStyle = col[RED]!;
    g.fillRect(-4, -1.4, 8, 1);
  }
  /** Sir Dry: seated and smug, falling (arms up, mouth an O), under the water, climbing back. */
  function dry() {
    const pose = S[POSE]!, y = SEAT + S[DY]!, sog = S[SOG]!, falling = pose !== SIT, hurt = S[HURT]! > 0, sway = falling ? 0 : Math.sin(S[WOB]! * 1.4) * 0.03;
    g.save();
    if (pose !== SIT) {
      // Clip to the tank once he's in it (he's behind the glass).
      g.beginPath();
      g.rect(TX0 + 0.7, 0, TX1 - TX0 - 1.4, FLOOR);
      g.clip();
    }
    g.translate(DX, y);
    g.rotate(sway + (pose === FALL ? 0.25 : 0));
    // Legs, the bathing suit (stripes), the arms (folded; up when he falls), the head.
    g.fillStyle = col[SKIN]!;
    g.fillRect(-4.6, -1, 2.4, 10);
    g.fillRect(1.6, -1, 2.4, 10);
    g.fillStyle = col[INK]!;
    g.fillRect(-5, 8, 3.2, 1.6);
    g.fillRect(1.2, 8, 3.2, 1.6);
    g.fillStyle = col[PAPER]!;
    g.beginPath();
    g.roundRect(-6.5, -13, 13, 14, 4);
    g.fill();
    g.fillStyle = col[PURPLE]!;
    for (let k = 0; k < 4; k++) g.fillRect(-6.5 + (k === 0 ? 1 : 0), -11 + k * 3.4, 13 - (k === 0 ? 2 : 0), 1.7);
    g.fillStyle = col[SKIN]!;
    if (falling) {
      g.save(), g.translate(-6, -11), g.rotate(-2.4 + Math.sin(S[PT]! * 30) * 0.3), g.fillRect(0, -1.2, 8, 2.4), g.restore();
      g.save(), g.translate(6, -11), g.rotate(-0.7 + Math.sin(S[PT]! * 30 + 1) * 0.3), g.fillRect(0, -1.2, 8, 2.4), g.restore();
    } else {
      g.beginPath();
      g.roundRect(-7, -9, 14, 3.2, 1.6);
      g.fill();
    }
    circ(0, -18, 5.4);
    // The face: smug lids (or wide eyes falling, shut when hit), the moustache, the mouth.
    g.fillStyle = col[INK]!;
    if (falling || hurt) {
      circ(-2, -19, falling ? 1 : 0.5);
      circ(2, -19, falling ? 1 : 0.5);
    } else {
      g.fillRect(-3.2, -19.6, 2.4, 0.7), g.fillRect(0.8, -19.6, 2.4, 0.7);
      circ(-1.8, -18.9, 0.55), circ(2.2, -18.9, 0.55);
    }
    const droop = sog * 1.4;
    g.beginPath();
    g.moveTo(0, -16.6);
    g.quadraticCurveTo(-3, -17.6 + droop, -5, -15.4 + droop * 1.6);
    g.quadraticCurveTo(-2.4, -15.2, 0, -15.8);
    g.quadraticCurveTo(2.4, -15.2, 5, -15.4 + droop * 1.6);
    g.quadraticCurveTo(3, -17.6 + droop, 0, -16.6);
    g.fill();
    if (falling) circ(0, -13.8, 1.1);
    else (g.fillRect(0.6, -14.4, 2.2, 0.6));
    // The bowler (a soggy one sits low).
    if (S[HAT]) g.save(), g.translate(0, -22.2 + sog * 1.2), g.rotate(-0.12), bowler(), g.restore();
    g.restore();
  }
  /** His speech bubble, by his head. */
  function bubble(text: string) {
    g.font = FONT[4]!;
    const w = g.measureText(text).width + 5, x = DX - 9 - w / 2, y = SEAT - 25;
    g.fillStyle = col[PAPER]!;
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    g.beginPath();
    g.roundRect(x - w / 2, y - 4, w, 8, 3);
    g.moveTo(x + w / 2 - 0.4, y - 1), g.lineTo(x + w / 2 + 4, y + 2), g.lineTo(x + w / 2 - 0.4, y + 2);
    g.fill();
    g.stroke();
    g.fillStyle = col[INK]!;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, x, y + 0.4);
  }

  engine.start();
  if (first) {
    const k = W / (stage.clientWidth || 1);
    throwAt(first.x * k, first.y * k, false);
  }
  return {
    engine,
    throwAt,
    /** For tests: the mode (0 intro, 1 idle, 2 a go, 3 done), balls left, dunks, letters wet now, fastballs. */
    get state() {
      let wet = 0;
      for (let i = 0; i < lt.n; i++) wet += WETT[i]! > 0 ? 1 : 0;
      return { mode: S[MODE]!, balls: S[LEFT]!, dunks: S[DUNKS]!, wet, fast: S[FASTS]! };
    },
    /** For tests: the target and his head, in art units. */
    spots: { target: { x: TGX, y: TGY }, head: { x: DX, y: SEAT - 18 } },
    /** The poster's canvas is drawn smaller (scripts/gallery-posters.mjs). */
    poster: () => b.poster(),
    destroy: () => engine.destroy(),
  } as DunkScene & { spots: { target: { x: number; y: number }; head: { x: number; y: number } } };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => dunkTank(stage, slot, first);
/** The poster: the intro, his taunt up and the demo ball on its way (scripts/gallery-posters.mjs). */
export const posterAt = 1.25;
