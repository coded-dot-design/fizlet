// "Rail Run" (skate-sesh): a street line at night. Press to ollie (hold in the air to float a little
// further). Clear the cones, jump the gaps, and land on a rail to grind it in a shower of sparks.
// Every clean obstacle grows the multiplier; a slam (a cone to the shins, a gap you rolled into)
// resets it. Ten seconds a line, then the score card, then it rolls to a stop and sleeps until the
// next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), fzlt/slot, fzlt/sound. The rig: kit.ts. The line is `railRun()`, plain
// numbers, no DOM (tests/skate-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
const SX = 38, GY = 72, SPD = 64, POP = 120, GRAV = 340, FLOAT = 210, RAIL_H = 11, CONE_H = 7, N = 6;
/** Obstacle kinds. */
export const NONE = 0, CONE = 1, GAP = 2, RAIL = 3;
/** Rider states. */
export const ROLL = 0, AIR = 1, GRIND = 2, SLAM = 3;
// State slots.
const MODE = 0, T = 1, LEFT = 2, Z = 3, VZ = 4, ST = 5, SPEED = 6, SCROLL = 7, SCORE = 8, CLEAN = 9, MULT = 10, SLAMS = 11, GRINDS = 12, CLEARS = 13, SLAMT = 14, NEXT = 15, CARD = 16, PTS = 17, HELD = 18, WHEEL = 19, LAST = 20, SPARKT = 21;
/** Events this step: start, ollie, land, grind, slam, end. */
export const EV_START = 0, EV_POP = 1, EV_LAND = 2, EV_GRIND = 3, EV_SLAM = 4, EV_END = 5;
const WORDS = ["CLEAN", "GAP!", "GRIND!", "SLAM!", "x2", "x3", "x4", "LINE!"];
const SPARK = 0, DUST = 1, CHIP = 2;

export function railRun(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(24), ev = new Uint8Array(6);
  const OK = new Uint8Array(N), OX = new Float64Array(N), OW = new Float64Array(N), OD = new Uint8Array(N); // kind, left x (screen), width, done
  const sp = spray(180, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  S[SPEED] = demo ? SPD : 0;
  // The first few: a cone, a rail, a gap, so every line shows all three early.
  const seq = [CONE, RAIL, GAP];
  for (let i = 0; i < 3; i++) (OK[i] = seq[i]!), (OW[i] = seq[i] === CONE ? 5 : seq[i] === GAP ? 22 : 46), (OX[i] = 92 + i * 74);
  S[LAST] = OX[2]! + OW[2]!;
  S[NEXT] = 3;
  function spawn() {
    const i = S[NEXT]! % N;
    S[NEXT] = S[NEXT]! + 1;
    const r = R(), k = r < 0.36 ? CONE : r < 0.68 ? RAIL : GAP;
    (OK[i] = k), (OD[i] = 0), (OW[i] = k === CONE ? 5 : k === GAP ? 18 + R() * 10 : 36 + R() * 24);
    OX[i] = Math.max(W + 4, S[LAST]! + 40 + R() * 36);
    S[LAST] = OX[i]! + OW[i]!;
  }
  /** The obstacle under x (feet), or -1. */
  const under = (x: number, kind: number, pad0: number) => {
    for (let i = 0; i < N; i++) if (OK[i] === kind && x > OX[i]! - pad0 && x < OX[i]! + OW[i]! + pad0) return i;
    return -1;
  };
  function score(p: number) {
    if (S[MODE] !== PLAY) return;
    S[SCORE] = S[SCORE]! + p * S[MULT]!;
  }
  function clean(word: number) {
    S[CLEAN] = S[CLEAN]! + 1;
    S[CLEARS] = S[CLEARS]! + 1;
    const m = Math.min(4, 1 + Math.floor(S[CLEAN]! / 3));
    if (m > S[MULT]!) (S[MULT] = m), wd.say(3 + m, SX + 14, GY - 34, 1);
    else if (word >= 0) wd.say(word, SX + 10, GY - 26, 0);
  }
  function slam() {
    (S[ST] = SLAM), (S[SLAMT] = 0), (S[CLEAN] = 0), (S[MULT] = 1), (S[SLAMS] = S[SLAMS]! + 1), (S[SPEED] = S[SPEED]! * 0.35);
    wd.say(3, SX + 6, GY - 26, 2);
    sp.burst(SX, GY - 2, 14, 40, -1.5708, 2.8, 1.4, DUST);
    ev[EV_SLAM] = 1;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[CLEAN] = 0), (S[MULT] = 1), (S[SLAMS] = 0), (S[GRINDS] = 0), (S[CLEARS] = 0);
    if (S[ST] === SLAM) (S[ST] = ROLL), (S[Z] = 0), (S[VZ] = 0);
    ev[EV_START] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    let presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 0.8))) start(), (mode = PLAY), (presses = S[ST] === ROLL ? presses : 0);
    const riding = mode === PLAY || mode === DEMO;
    // The ghost (attract run) pops a beat before each cone, gap and rail.
    if (mode === DEMO && (S[ST] === ROLL || S[ST] === GRIND)) {
      for (let i = 0; i < N; i++) {
        const d = OX[i]! - SX;
        if (OK[i] !== NONE && !OD[i] && d > 0 && d < (OK[i] === RAIL ? 9 : OK[i] === GAP ? 16 : 18) && S[ST] === ROLL) presses = 1;
      }
    }
    const held = mode === PLAY ? pad[0]! > 0 : mode === DEMO;
    S[HELD] = held ? 1 : 0;
    // The street rolls by.
    const target = riding ? SPD + (mode === PLAY ? (ROUND - S[LEFT]!) * 2 : 0) : 0;
    if (S[ST] !== SLAM) S[SPEED] = S[SPEED]! + (target - S[SPEED]!) * Math.min(1, dt * (riding ? 1.5 : 1.8));
    if (!riding && S[SPEED]! < 0.5) S[SPEED] = 0;
    const dx = S[SPEED]! * dt;
    S[SCROLL] = S[SCROLL]! + dx;
    S[WHEEL] = S[WHEEL]! + dx * 0.6;
    for (let i = 0; i < N; i++) {
      if (OK[i] === NONE) continue;
      OX[i] = OX[i]! - dx;
      if (!OD[i] && OX[i]! + OW[i]! < SX - 4) {
        OD[i] = 1;
        if (S[ST] !== SLAM && OK[i] !== RAIL) {
          score(OK[i] === GAP ? 10 : 5), clean(OK[i] === GAP ? 1 : 0);
          ev[EV_LAND] = 1;
        }
      }
      if (OX[i]! + OW[i]! < -10) OK[i] = NONE;
    }
    S[LAST] = S[LAST]! - dx;
    if (riding && S[LAST]! < W + 30) spawn();
    // The rider.
    const st = S[ST]!;
    if (st === SLAM) {
      S[SLAMT] = S[SLAMT]! + dt;
      if (S[Z]! < 0) (S[VZ] = S[VZ]! - GRAV * dt), (S[Z] = S[Z]! + S[VZ]! * dt); // down the gap
      if (S[SLAMT]! > 0.75) {
        (S[ST] = ROLL), (S[Z] = 0), (S[VZ] = 0);
        // Back up on the street: clear whatever is under the feet.
        for (let i = 0; i < N; i++) if (OK[i] !== NONE && OX[i]! < SX + 18 && OX[i]! + OW[i]! > SX - 8) OD[i] = 1;
        for (let i = 0; i < N; i++) if (OK[i] === GAP && OX[i]! < SX + 8 && OX[i]! + OW[i]! > SX - 8) OX[i] = SX - 9 - OW[i]!;
      }
    } else if (st === ROLL) {
      if (presses > 0 && riding) {
        (S[ST] = AIR), (S[VZ] = POP);
        sp.burst(SX - 2, GY, 4, 20, -2.6, 0.8, 1, DUST);
        ev[EV_POP] = 1;
      } else {
        const c = under(SX, CONE, 2);
        if (c >= 0 && !OD[c]) (OD[c] = 1), (OK[c] = NONE), slam(), sp.burst(SX + 3, GY - 4, 8, 50, -0.8, 1.2, 1.4, CHIP);
        else if (under(SX, GAP, -3) >= 0) slam(), (S[Z] = -0.1), (S[VZ] = -20);
      }
    } else if (st === AIR) {
      S[VZ] = S[VZ]! - (held && S[VZ]! < 40 ? FLOAT : GRAV) * dt;
      const z0 = S[Z]!;
      S[Z] = S[Z]! + S[VZ]! * dt;
      const rl = under(SX, RAIL, 0);
      if (rl >= 0 && S[VZ]! < 0 && z0 >= RAIL_H && S[Z]! <= RAIL_H) {
        (S[ST] = GRIND), (S[Z] = RAIL_H), (S[VZ] = 0), (S[GRINDS] = S[GRINDS]! + 1);
        wd.say(2, SX + 12, GY - 30, 1);
        ev[EV_GRIND] = 1;
      } else if (S[Z]! <= 0) {
        if (under(SX, GAP, -3) >= 0) slam(), (S[Z] = -0.1), (S[VZ] = -20);
        else {
          const c = under(SX, CONE, 1);
          if (c >= 0 && !OD[c]) (OD[c] = 1), (OK[c] = NONE), slam();
          else (S[ST] = ROLL), (S[Z] = 0), (S[VZ] = 0), sp.burst(SX, GY, 3, 16, -1.5708, 2.6, 1, DUST);
        }
      }
    } else if (st === GRIND) {
      // Grinding: points by the inch, sparks off the trucks; off the end you drop to the street.
      S[PTS] = S[PTS]! + dt * 10;
      while (S[PTS]! >= 1) (S[PTS] = S[PTS]! - 1), score(1);
      S[SPARKT] = S[SPARKT]! + dt * 40;
      while (S[SPARKT]! >= 1) (S[SPARKT] = S[SPARKT]! - 1), sp.burst(SX - 4, GY - RAIL_H, 2, 50, -2.8, 0.9, 0.9, SPARK);
      if (presses > 0) (S[ST] = AIR), (S[VZ] = POP * 0.8), (ev[EV_POP] = 1);
      else if (under(SX, RAIL, 0) < 0) (S[ST] = AIR), (S[VZ] = 10);
      if (S[ST] === AIR) score(10), clean(-1), (ev[EV_LAND] = 1);
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1), wd.say(7, 80, 30, 1);
    } else if (mode === DEMO && S[T]! > 4.6 && S[ST] === ROLL) S[MODE] = IDLE;
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    const moving = sp.step(dt, 160) + wd.step(dt);
    return riding || S[SPEED]! > 0 || S[ST] !== ROLL || moving > 0 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  return { S, ev, sp, wd, step, OK, OX, OW };
}
export type RailRun = ReturnType<typeof railRun>;

export type RailScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: RailRun; poster(): void; readonly state: { mode: number; score: number; slams: number; grinds: number; clears: number; left: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): RailScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Press to ollie, hold to float", { start: "ready", pop: "click", land: "power", grind: "fire", slam: "hurt", end: "win" });
  const g = r.g;
  const ride = railRun((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { OK, OX, OW } = ride;
  if (first) r.pad[1] = 1;
  const DEBRIS = [C.hurt, "rgba(174,164,214,.5)", C.advance];
  const WCOL = [C.go, C.sys, C.attack];
  let sky: CanvasGradient | string = C.bg;
  engine.add({
    read() {
      r.read();
      if (typeof sky === "string") {
        const s = g.createLinearGradient(0, 0, 0, GY);
        s.addColorStop(0, C.bg), s.addColorStop(1, C.raised);
        sky = s;
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_POP]) e.events.emit("pop");
      if (ev[EV_LAND]) e.events.emit("land");
      if (ev[EV_GRIND]) e.events.emit("grind");
      if (ev[EV_SLAM]) e.events.emit("slam");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const sc = S[SCROLL]!, mode = S[MODE]!;
      g.fillStyle = sky;
      g.fillRect(0, 0, W, GY);
      // The skyline (slow), its windows, one neon sign.
      for (let k = 0; k < 8; k++) {
        const bw = 22 + ((k * 7) % 3) * 6, bh = 24 + ((k * 13) % 5) * 6, x = ((k * 27 - sc * 0.25) % 216 + 216) % 216 - 28;
        g.fillStyle = k & 1 ? C.surface : C.raised;
        g.fillRect(x, GY - 8 - bh, bw, bh + 8);
        g.fillStyle = k % 3 ? C.hurt : C.sys;
        g.globalAlpha = 0.55;
        for (let j = 0; j < 6; j++) if ((k * 5 + j * 3) % 4) g.fillRect(x + 3 + (j % 3) * 6, GY - bh + 2 + ((j / 3) | 0) * 7, 2.4, 2.8);
        g.globalAlpha = 1;
        if (k === 3) {
          g.strokeStyle = C.attack;
          g.lineWidth = 1;
          g.strokeRect(x + 4, GY - bh - 6, bw - 8, 6);
          g.fillStyle = C.attack;
          g.font = "900 4px system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("OPEN", x + bw / 2, GY - bh - 2.8);
        }
      }
      // Street lamps (faster) and their pools of light.
      for (let k = 0; k < 4; k++) {
        const x = ((k * 56 - sc * 0.7) % 224 + 224) % 224 - 32;
        g.fillStyle = C.advance;
        g.globalAlpha = 0.13;
        g.beginPath();
        g.moveTo(x + 6, 20), g.lineTo(x - 10, GY), g.lineTo(x + 22, GY);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = C.line;
        g.fillRect(x - 0.6, 18, 1.2, GY - 18);
        g.fillRect(x, 18, 7, 1.2);
        g.fillStyle = C.advance;
        g.fillRect(x + 4.5, 19, 3, 1.2);
      }
      // The street: curb, asphalt, the dashes running by; gaps cut through it.
      g.fillStyle = C.surface;
      g.fillRect(0, GY, W, H - GY);
      g.fillStyle = C.ink;
      g.fillRect(0, GY, W, 0.8);
      g.fillStyle = C.line;
      for (let k = 0; k < 9; k++) g.fillRect(((k * 24 - sc) % 216 + 216) % 216 - 24, GY + 9, 10, 1.2);
      for (let i = 0; i < N; i++) {
        const k = OK[i]!, x = OX[i]!, w = OW[i]!;
        if (k === GAP) {
          // A drop: stairs down into the dark.
          g.fillStyle = C.bg;
          g.fillRect(x, GY, w, H - GY);
          g.fillStyle = C.line;
          for (let s = 0; s < 4; s++) g.fillRect(x + s * (w / 4), GY + 3 + s * 4, w / 4, 1);
          g.fillStyle = C.hurt;
          g.fillRect(x - 1, GY - 0.2, 1.4, 1.4), g.fillRect(x + w - 0.4, GY - 0.2, 1.4, 1.4);
        } else if (k === CONE) {
          g.fillStyle = C.advance;
          g.beginPath();
          g.moveTo(x - 0.5, GY), g.lineTo(x + w / 2, GY - CONE_H), g.lineTo(x + w + 0.5, GY);
          g.fill();
          g.fillStyle = C.ink;
          g.fillRect(x + 1.2, GY - 3.6, w - 2.4, 1);
          g.fillStyle = C.rim;
          g.fillRect(x - 1, GY - 0.8, w + 2, 0.8);
        } else if (k === RAIL) {
          g.fillStyle = C.line;
          g.fillRect(x + 1, GY - RAIL_H, 1.4, RAIL_H), g.fillRect(x + w - 2.4, GY - RAIL_H, 1.4, RAIL_H);
          g.fillStyle = C.attack;
          g.fillRect(x, GY - RAIL_H - 1.2, w, 1.6);
          g.fillStyle = C.ink;
          g.globalAlpha = 0.6;
          g.fillRect(x + 2, GY - RAIL_H - 1.2, w - 4, 0.4);
          g.globalAlpha = 1;
        }
      }
      // The rider.
      rider(SX, GY - S[Z]!, S[ST]!, S[HELD]!, S[SLAMT]!);
      r.drawSpray(ride.sp, DEBRIS);
      r.drawWords(ride.wd, WCOL);
      r.hud(S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.sys);
      if (mode === PLAY && S[MULT]! > 1) {
        g.fillStyle = C.attack;
        g.font = "900 7px system-ui, sans-serif";
        g.textAlign = "left";
        g.fillText(WORDS[2 + S[MULT]!]!, 45, 9.8);
      }
      if (mode === IDLE || (mode === DEMO && S[T]! > 3.6)) r.caption("PRESS TO OLLIE · LAND ON THE RAIL", 30, 6, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.65)";
        g.beginPath();
        g.roundRect(42, 16, 76, 32, 6);
        g.fill();
        r.caption(NUM[Math.min(999, S[SCORE]! | 0)]!, 27, 14, C.sys);
        r.caption(S[SLAMS] === 0 ? "NO SLAMS. CLEAN LINE" : S[GRINDS]! ? "GOOD GRINDS" : "TRY THE RAIL", 38, 6, C.ink);
        if (S[CARD]! > 0.8) r.caption("PRESS TO ROLL AGAIN", 44.5, 5, C.muted);
      }
    },
  });
  /** The rider at the feet (x, y): rolling, popped (board tipped), grinding (crouched) or slammed. */
  function rider(x: number, y: number, st: number, held: number, slamT: number) {
    g.save();
    g.translate(x, y);
    if (st === SLAM) {
      // Tumbling: the board flies on ahead, the rider rolls.
      g.fillStyle = C.sys;
      g.fillRect(6 + slamT * 30, -2 - Math.sin(slamT * 6) * 4, 10, 1.4);
      g.rotate(Math.min(1.5, slamT * 5));
    }
    const pop = st === AIR ? Math.max(-0.35, Math.min(0.35, S[VZ]! / 300)) : 0;
    if (st !== SLAM) {
      g.save();
      g.rotate(-pop);
      g.fillStyle = C.sys;
      g.beginPath();
      g.roundRect(-6, -2.4, 12, 1.4, 0.7);
      g.fill();
      g.fillStyle = C.ink;
      const sp = S[WHEEL]!;
      for (let k = -1; k <= 1; k += 2) {
        g.beginPath();
        g.arc(k * 4, -0.5, 0.95, 0, TAU);
        g.fill();
      }
      g.fillStyle = C.rim;
      g.fillRect(-4 + Math.sin(sp) * 0.5, -0.8, 0.5, 0.5);
      g.restore();
    }
    const c = st === GRIND || (st === AIR && held) ? 1.8 : st === AIR ? 1 : 0, hip = -7.5 + c, sh = -13 + c * 1.4;
    g.strokeStyle = C.ink;
    g.lineWidth = 1.8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3, -2.8), g.lineTo(-1, hip), g.lineTo(3, -2.8);
    g.moveTo(-1, hip), g.lineTo(0.4, sh);
    g.moveTo(0.4, sh + 1.2), g.lineTo(-5, sh + (st === GRIND ? 0 : 4));
    g.moveTo(0.4, sh + 1.2), g.lineTo(5.4, sh + (st === GRIND ? -1 : 3.5));
    g.stroke();
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(1.2, sh - 2, 2, 0, TAU);
    g.fill();
    g.fillStyle = C.attack;
    g.fillRect(-1, sh - 4.4, 4.6, 1.5); // a cap
    g.fillRect(3, sh - 3.6, 2, 0.8);
    g.fillStyle = C.go;
    g.fillRect(-1.8, sh + 0.6, 3.8, 4.8); // the hoodie
    g.restore();
  }

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, slams: S[SLAMS]!, grinds: S[GRINDS]!, clears: S[CLEARS]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, grinding the first rail (scripts/gallery-posters.mjs). */
export const posterAt = 2.2;
