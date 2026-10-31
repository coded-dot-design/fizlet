// "Oodles o' Moles": a midway poster with a hole punched in every O, and a mole living in each.
// They pop out of the headline's O's and the slogan's, and you have the mallet (it follows your
// pointer; a tap swings it). BONK one and it sees stars and sinks, and a ticket flies down to your
// stub; a gold mole is worth three; a mole in a hard hat takes two (CLANG, the hat flies); and the
// one holding a lit bomb is the one you leave alone: bonk it and KABOOM, the letters around it are
// blown about (they spring back), the mole is sooty and it costs you three tickets. A miss thunks
// the poster: a dent, and the letters next to it hop. Twenty seconds a round; at the bell the prize
// drops from the awning: small, big or jumbo, by your tickets. Then it sleeps until the next tap.
// Bricks: the kernel (fixed step, settle: it sleeps once the moles are down and the last ticket has
// landed; busy(sec) holds the intro; its ledger for every page write, so Recall gives the page back
// byte for byte) and fzlt/slot. The booth, particles and prize: midway.ts; the letters: letters.ts.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { letters, ROT, STRETCH, TY } from "./letters";
import { booth, CHIP, CONF, CREAM, CYAN, GOLD, GREEN, INK, PAPER, PURPLE, RED, SHADE, SMOKE, STAR, TAU, W, WOOD2 } from "./midway";

export type MolesScene = SlotScene & { engine: ReturnType<typeof createEngine>; bonk(x: number, y: number): void; readonly state: { mode: number; tickets: number; bonks: number; booms: number; up: number; left: number } };

const ROUND = 20, MAXH = 12;
const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
/** Mole kinds. */
const PLAIN = 0, HAT = 1, GILT = 2, BOMB = 3;
/** Hole states: empty, up (rising, holding, sinking), bonked. */
const EMPTY = 0, UP = 1, HIT = 2;
const BONK = 0, CLANG = 1, THUNK = 2, KABOOM = 3, PLUS3 = 4, MINUS3 = 5, TIME = 6, PFFT = 7, PLUS2 = 8;
// State slots.
const MODE = 0, T = 1, LEFT = 2, NEXT = 3, MX = 4, MY = 5, SWING = 6, BONKS = 7, BOOMS = 8, PRIZED = 9, Q = 10, QX = 11, QY = 12, HATX = 13, HATY = 14, HATVX = 15, HATVY = 16, HATT = 17, HATR = 18, LAST = 19, SEEN = 20;

export function oodlesOMoles(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): MolesScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const R = engine.random;
  const skin = slot.querySelector<HTMLElement>("[data-oo]")!;
  const b = booth(engine, stage, skin, 17, 82.5);
  b.words(["BONK!", "CLANG!", "THUNK", "KABOOM!", "+3!", "-3", "TIME!", "PFFT!", "+2!"]);
  const g = b.g, col = b.col, { circ, oval } = b;
  const lt = letters(engine, slot, ".oo i", 170, 9);
  // The holes: the letters with a punched O (class oo-o).
  const holes: number[] = [];
  for (let i = 0; i < lt.n; i++) if (lt.els[i]!.classList.contains("oo-o")) holes.push(i);
  const NH = Math.min(MAXH, holes.length);
  const HS = new Uint8Array(NH), HK = new Uint8Array(NH), HP = new Uint8Array(NH), SOOT = new Uint8Array(NH);
  const HH = new Float32Array(NH), HT = new Float32Array(NH), HU = new Float32Array(NH), LOOK = new Float32Array(NH);
  // Dents in the poster from misses: x, y, age.
  const DN = 6, DX = new Float32Array(DN), DY = new Float32Array(DN), DA = new Float32Array(DN).fill(9);
  const S = new Float64Array(24);
  (S[MX] = 136), (S[MY] = 60), (S[SWING] = 1), (S[HATT] = 9);
  if (!first) engine.busy(3.8); // the intro's peeks are scheduled: hold the engine for them

  const bonk = (x: number, y: number) => ((S[Q] = 1), (S[QX] = x), (S[QY] = y), (S[MX] = x), (S[MY] = y), engine.wake());
  const at = new Float64Array(2);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    b.at(e, at, 0);
    bonk(at[0]!, at[1]!);
  }, { signal: engine.signal });
  stage.addEventListener("pointermove", (e) => {
    if (!e.isPrimary || e.pointerType !== "mouse") return;
    b.at(e, at, 0);
    (S[MX] = at[0]!), (S[MY] = at[1]!);
    engine.wake();
  }, { signal: engine.signal });
  engine.ledger.style(stage, "cursor", "none");
  engine.ledger.style(stage, "touch-action", "manipulation");

  // A hole's centre and size (art units), from its letter.
  // A hole goes where its letter goes (a blown-about O takes its mole with it).
  const hx = (h: number) => lt.x[holes[h]!]! + (lt.p[holes[h]! * 5]! * lt.w[holes[h]!]!) / 100;
  const hy = (h: number) => lt.y[holes[h]!]! + (lt.p[holes[h]! * 5 + 1]! / 100 + 0.08) * lt.h[holes[h]!]!;
  const hs = (h: number) => lt.w[holes[h]!]! * 1.08;
  /** Where the mole's face is (its centre), and how far a bonk reaches it. */
  const headY = (h: number) => hy(h) - HH[h]! * hs(h) * 0.95 + hs(h) * 0.5;

  function pop(h: number, kind: number, up: number) {
    (HS[h] = UP), (HK[h] = kind), (HP[h] = kind === HAT ? 2 : 1), (HT[h] = 0), (HU[h] = up), (LOOK[h] = R() * TAU), (SOOT[h] = 0);
  }
  function upCount() {
    let k = 0;
    for (let h = 0; h < NH; h++) k += HS[h] ? 1 : 0;
    return k;
  }
  /** The mallet lands at (x, y). */
  function land(x: number, y: number) {
    S[SWING] = 0;
    let best = -1, bd = 1e9;
    for (let h = 0; h < NH; h++) {
      if (HS[h] !== UP || HH[h]! < 0.35) continue;
      const r = Math.max(6, hs(h) * 0.7), dx = x - hx(h), dy = y - headY(h), d = dx * dx + dy * dy;
      if (d < r * r && d < bd) (bd = d), (best = h);
    }
    if (best < 0) {
      // A miss: a dent, the letters by it hop, the nearest O shudders.
      const k = (S[LAST] = (S[LAST]! + 1) % DN);
      (DX[k] = x), (DY[k] = y), (DA[k] = 0);
      for (let i = 0; i < lt.n; i++) {
        const dx = lt.x[i]! - x, dy = lt.y[i]! - y, d = Math.hypot(dx, dy);
        if (d < 16) lt.kick(i, TY, -(1 - d / 16) * 520, d < 6 ? 0.25 : 0), lt.kick(i, ROT, (dx > 0 ? 1 : -1) * (1 - d / 16) * 260);
      }
      b.say(THUNK, x, y - 6, CREAM, 6);
      b.spray(CHIP, x, y, 4, 40, PAPER, -1.5708, 2.4);
      b.shake(0.25);
      return;
    }
    const h = best, li = holes[h]!, k = HK[h]!, fx = hx(h), fy = headY(h);
    lt.kick(li, STRETCH, 70, 0.3), lt.kick(li, TY, 180);
    if (k === BOMB) {
      // KABOOM: the poster around it is blown about, the mole is sooty, three tickets gone.
      S[BOOMS] = S[BOOMS]! + 1;
      SOOT[h] = 1;
      (HS[h] = HIT), (HT[h] = 0);
      b.say(KABOOM, fx, fy - 8, RED, 13);
      b.spray(SMOKE, fx, fy, 16, 46, CREAM, -1.5708, TAU, 1.6);
      b.spray(CHIP, fx, fy, 10, 90, GOLD);
      b.spray(STAR, fx, fy, 14, 120, GOLD);
      b.spray(CHIP, fx, fy, 14, 110, RED);
      lt.blast(fx, fy, 40, 1.5);
      b.shake(1);
      if (S[MODE] === PLAY) b.tickets = Math.max(0, b.tickets - 3), b.say(MINUS3, 17, 74, RED, 7);
      return;
    }
    if (k === HAT && HP[h]! > 1) {
      // CLANG: the hat flies off, the mole stays up (and is cross about it).
      HP[h] = 1;
      HU[h] = Math.max(HU[h]!, HT[h]! + 0.6);
      (S[HATX] = fx), (S[HATY] = fy - hs(h) * 0.4), (S[HATVX] = (R() - 0.5) * 60), (S[HATVY] = -70), (S[HATT] = 0), (S[HATR] = hs(h));
      b.say(CLANG, fx, fy - 8, GOLD, 8);
      b.spray(STAR, fx, fy - 4, 6, 70, GOLD);
      return;
    }
    S[BONKS] = S[BONKS]! + 1;
    (HS[h] = HIT), (HT[h] = 0);
    const v = k === GILT ? 3 : k === HAT ? 2 : 1;
    b.say(v === 3 ? PLUS3 : v === 2 ? PLUS2 : BONK, fx, fy - 8, v === 3 ? GOLD : v === 2 ? CYAN : PAPER, 8);
    b.spray(STAR, fx, fy - 2, 8, 70, GOLD);
    if (S[MODE] === PLAY) b.ticket(fx, fy, v);
  }

  engine.add({
    read() {
      b.read();
      lt.read();
    },
    step(e, dt) {
      S[T] = S[T]! + dt;
      const mode = S[MODE]!;
      if (S[Q]) {
        S[Q] = 0;
        if (!(mode === DONE && (!S[PRIZED] || b.prizing >= 0))) {
          if (mode !== PLAY) {
            // A round: the clock starts, the moles come out.
            (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[NEXT] = 0.35), (S[BONKS] = 0), (S[BOOMS] = 0), (S[PRIZED] = 0);
            b.tickets = 0;
            for (let h = 0; h < NH; h++) if (HS[h] === UP) HU[h] = Math.min(HU[h]!, HT[h]!);
          }
          land(S[QX]!, S[QY]!);
        }
      }
      if (S[MODE] === INTRO) {
        // Two peek out, look about, one blows a raspberry; then both drop back in.
        const t = S[T]!;
        if (t >= 0.4 && !S[SEEN]) (S[SEEN] = 1), pop(Math.min(1, NH - 1), PLAIN, 2.7);
        if (t >= 1.0 && S[SEEN] === 1) (S[SEEN] = 2), pop(Math.max(0, NH - 3), HAT, 2.2);
        if (t >= 2.2 && S[SEEN] === 2) (S[SEEN] = 3), b.say(PFFT, hx(Math.min(1, NH - 1)), headY(Math.min(1, NH - 1)) - 9, RED, 7);
        if (t > 3.6 && !upCount()) S[MODE] = IDLE;
      } else if (S[MODE] === PLAY) {
        S[LEFT] = Math.max(0, S[LEFT]! - dt);
        const p = 1 - S[LEFT]! / ROUND;
        S[NEXT] = S[NEXT]! - dt;
        if (S[NEXT]! <= 0 && S[LEFT]! > 0.8) {
          S[NEXT] = 0.7 - p * 0.3 + R() * 0.3;
          if (upCount() < 3) {
            let h = (R() * NH) | 0;
            for (let k = 0; k < NH && HS[h]; k++) h = (h + 1) % NH;
            if (!HS[h]) {
              const r = R(), kind = p > 0.15 && r < 0.13 ? BOMB : r < 0.25 ? HAT : r < 0.33 ? GILT : PLAIN;
              pop(h, kind, kind === GILT ? 0.7 : kind === BOMB ? 1.6 : 1.25 - p * 0.45);
            }
          }
        }
        if (S[LEFT] === 0) {
          (S[MODE] = DONE), (S[T] = 0);
          b.say(TIME, 80, 40, RED, 12);
          b.chase(1);
          for (let h = 0; h < NH; h++) if (HS[h] === UP) HU[h] = Math.min(HU[h]!, HT[h]!);
        }
      } else if (S[MODE] === DONE && !S[PRIZED] && S[T]! > 1.1) {
        S[PRIZED] = 1;
        const k = b.tickets;
        b.prize(k >= 12 ? 2 : k >= 6 ? 1 : 0, 80, -20);
      }
      // The moles: up (rise, hold, sink) and bonked (squash, sink with stars).
      let live = 0;
      for (let h = 0; h < NH; h++) {
        if (!HS[h]) continue;
        live++;
        HT[h] = HT[h]! + dt;
        LOOK[h] = LOOK[h]! + dt * 3;
        const t = HT[h]!;
        if (HS[h] === UP) {
          HH[h] = t < 0.14 ? t / 0.14 : t < HU[h]! ? 1 : Math.max(0, 1 - (t - HU[h]!) / 0.16);
          if (t >= HU[h]! + 0.16) (HS[h] = EMPTY), (HH[h] = 0);
        } else {
          HH[h] = t < 0.25 ? 1 - t * 0.6 : Math.max(0, 0.85 - (t - 0.25) / 0.3);
          if (t > 0.6) (HS[h] = EMPTY), (HH[h] = 0);
        }
      }
      // The flying hat, the dents, the mallet.
      if (S[HATT]! < 1.4) {
        S[HATT] = S[HATT]! + dt;
        S[HATVY] = S[HATVY]! + 220 * dt;
        (S[HATX] = S[HATX]! + S[HATVX]! * dt), (S[HATY] = S[HATY]! + S[HATVY]! * dt);
        live++;
      }
      for (let k = 0; k < DN; k++) if (DA[k]! < 1.6) (DA[k] = DA[k]! + dt), live++;
      if (S[SWING]! < 1) (S[SWING] = Math.min(1, S[SWING]! + dt * 4.5)), live++;
      const flying = b.step(dt), moving = lt.step(dt);
      if (live || flying || moving || S[MODE] === PLAY || (S[MODE] === DONE && (!S[PRIZED] || b.prizing >= 0))) e.busy();
    },
    render() {
      lt.render();
      b.begin();
      b.awning(9, 10);
      b.bulbs(8, 152, 17.5, 10);
      // Dents in the poster.
      for (let k = 0; k < DN; k++) {
        if (DA[k]! >= 1.6) continue;
        g.globalAlpha = (1 - DA[k]! / 1.6) * 0.5;
        g.strokeStyle = col[SHADE]!;
        g.lineWidth = 0.7;
        g.beginPath();
        g.ellipse(DX[k]!, DY[k]!, 3 + DA[k]! * 2, 1.6 + DA[k]!, 0, 0, TAU);
        g.stroke();
      }
      g.globalAlpha = 1;
      for (let h = 0; h < NH; h++) hole(h);
      // The flying hat.
      if (S[HATT]! < 1.4) {
        g.save();
        g.translate(S[HATX]!, S[HATY]!);
        g.rotate(S[HATT]! * 9);
        hat(S[HATR]!);
        g.restore();
      }
      const over = S[MODE] === DONE && b.prizing < 0 && S[PRIZED] === 1;
      const left = S[MODE] === PLAY ? S[LEFT]! : S[MODE] === DONE && !over ? 0 : ROUND;
      b.clock(143, 82.5, left, ROUND, left < 4 && S[MODE] === PLAY);
      if (S[MODE] === IDLE || over || (S[MODE] === INTRO && S[T]! > 3)) b.hint(141, 74.6, over ? "AGAIN?" : "BONK TO PLAY");
      b.draw();
      b.drawPrize(PRIZE_COL, "WINNER!");
      mallet();
    },
  });

  const PRIZE_COL = [PURPLE, CYAN, RED];
  /** The hard hat, `s` wide, centred on its brim. */
  function hat(s: number) {
    g.fillStyle = col[GOLD]!;
    g.beginPath();
    g.arc(0, 0, s * 0.42, Math.PI, 0);
    g.fill();
    g.fillRect(-s * 0.56, -s * 0.03, s * 1.12, s * 0.1);
    g.fillStyle = col[PAPER]!;
    g.fillRect(-s * 0.05, -s * 0.42, s * 0.1, s * 0.4);
  }
  /** A hole in an O: the pit, the mole (clipped to come up out of it), the front lip. */
  function hole(h: number) {
    const x = hx(h), y = hy(h), s = hs(h), rx = s * 0.4, ry = s * 0.16, k = HK[h]!, up = HH[h]!;
    g.fillStyle = col[SHADE]!;
    oval(x, y, rx, ry);
    if (up <= 0) return;
    g.save();
    g.beginPath();
    g.rect(x - s, y - s * 2, s * 2, s * 2);
    g.moveTo(x + rx, y);
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI);
    g.clip();
    const top = y - up * s * 0.95 + s * 0.08, w = s * 0.4, hit = HS[h] === HIT, bomb = k === BOMB;
    const sq = hit ? Math.max(0, 1 - HT[h]! * 4) : 0;
    g.translate(x, top);
    g.scale(1 + sq * 0.25, 1 - sq * 0.2);
    // The body: a dome, a lighter face, the nose, two teeth.
    g.fillStyle = col[SOOT[h] ? SHADE : k === GILT ? GOLD : PURPLE]!;
    g.beginPath();
    g.arc(0, w, w, Math.PI, 0);
    g.lineTo(w, s);
    g.lineTo(-w, s);
    g.fill();
    g.fillStyle = col[SOOT[h] ? WOOD2 : CREAM]!;
    oval(0, w * 1.45, w * 0.62, w * 0.5);
    const lx = hit ? 0 : Math.sin(LOOK[h]!) * w * 0.12;
    if (hit || SOOT[h]) {
      // Seeing stars: X eyes.
      g.strokeStyle = col[INK]!;
      g.lineWidth = w * 0.12;
      for (let e2 = -1; e2 <= 1; e2 += 2) {
        const ex = e2 * w * 0.36, ey = w * 0.75, r = w * 0.14;
        g.beginPath();
        g.moveTo(ex - r, ey - r), g.lineTo(ex + r, ey + r), g.moveTo(ex + r, ey - r), g.lineTo(ex - r, ey + r);
        g.stroke();
      }
    } else {
      g.fillStyle = col[INK]!;
      g.beginPath();
      g.arc(-w * 0.36 + lx, w * 0.75, w * 0.15, 0, TAU);
      g.moveTo(w * 0.36 + lx + w * 0.15, w * 0.75);
      g.arc(w * 0.36 + lx, w * 0.75, w * 0.15, 0, TAU);
      g.fill();
      g.fillStyle = col[PAPER]!;
      g.beginPath();
      g.arc(-w * 0.31 + lx, w * 0.69, w * 0.05, 0, TAU);
      g.moveTo(w * 0.41 + lx + w * 0.05, w * 0.69);
      g.arc(w * 0.41 + lx, w * 0.69, w * 0.05, 0, TAU);
      g.fill();
      if (k === HAT && HP[h] === 1) {
        // Cross: brows down.
        g.strokeStyle = col[INK]!;
        g.lineWidth = w * 0.1;
        g.beginPath();
        g.moveTo(-w * 0.55, w * 0.45), g.lineTo(-w * 0.2, w * 0.6), g.moveTo(w * 0.55, w * 0.45), g.lineTo(w * 0.2, w * 0.6);
        g.stroke();
      }
    }
    g.fillStyle = col[RED]!;
    oval(lx * 0.6, w * 1.12, w * 0.24, w * 0.17);
    g.fillStyle = col[PAPER]!;
    g.fillRect(-w * 0.15, w * 1.32, w * 0.14, w * 0.22);
    g.fillRect(w * 0.01, w * 1.32, w * 0.14, w * 0.22);
    if (k === HAT && HP[h]! > 1) g.translate(0, w * 0.15), hat(s * 0.95), g.translate(0, -w * 0.15);
    if (bomb && !SOOT[h]) {
      // The bomb, held up in one paw, its fuse fizzing.
      const bx = w * 1.05, by = w * 1.1, br = w * 0.5;
      g.fillStyle = col[INK]!;
      circ(bx, by, br);
      g.fillRect(bx - br * 0.3, by - br * 1.25, br * 0.6, br * 0.4);
      g.strokeStyle = col[CREAM]!;
      g.lineWidth = w * 0.08;
      g.beginPath();
      g.moveTo(bx, by - br * 1.2);
      g.quadraticCurveTo(bx + br * 0.5, by - br * 1.8, bx + br * 0.9, by - br * 1.6);
      g.stroke();
      const f = (LOOK[h]! * 7) % 1;
      g.fillStyle = col[f < 0.5 ? GOLD : RED]!;
      circ(bx + br * 0.9, by - br * 1.6, w * (0.18 + f * 0.12));
      g.fillStyle = col[PAPER]!;
      g.globalAlpha = 0.5;
      circ(bx - br * 0.35, by - br * 0.35, br * 0.22);
      g.globalAlpha = 1;
      g.fillStyle = col[PURPLE]!;
      circ(bx - br * 0.7, by + br * 0.3, w * 0.22);
    }
    g.restore();
    // Paws on the rim, and the stars circling a bonked one.
    if (up > 0.6 && !hit) {
      g.fillStyle = col[RED]!;
      g.beginPath();
      g.ellipse(x - rx * 0.62, y - ry * 0.3, s * 0.1, s * 0.07, 0, 0, TAU);
      g.moveTo(x + rx * 0.62 + s * 0.1, y - ry * 0.3);
      g.ellipse(x + rx * 0.62, y - ry * 0.3, s * 0.1, s * 0.07, 0, 0, TAU);
      g.fill();
    }
    if (hit) {
      g.fillStyle = col[GOLD]!;
      for (let k2 = 0; k2 < 3; k2++) {
        const a = HT[h]! * 9 + (k2 * TAU) / 3, sx = x + Math.cos(a) * s * 0.45, sy = top - s * 0.05 + Math.sin(a) * s * 0.12;
        circ(sx, sy, s * 0.07);
      }
    }
    // The front lip of the hole, over the mole.
    g.strokeStyle = col[SHADE]!;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0.15, Math.PI - 0.15);
    g.stroke();
  }
  /** The mallet at the pointer: raised, and down for a beat on a bonk. */
  function mallet() {
    const sw = S[SWING]!, u = Math.min(1, Math.max(0, (sw - 0.25) / 0.45)), a = 0.54 + u * u * (3 - 2 * u) * 0.7;
    const x = S[MX]!, y = S[MY]!;
    g.save();
    g.translate(x, y - 4); // the head comes down just above the point, so you see what it hit
    g.scale(0.85, 0.85);
    g.translate(15, 9);
    g.rotate(a);
    // The handle from the grip to the head; the head across the end of it.
    g.fillStyle = col[WOOD2]!;
    g.beginPath();
    g.roundRect(-17, -1, 18, 2, 1);
    g.fill();
    g.fillStyle = col[GOLD]!;
    g.fillRect(-3, -1.2, 3.6, 2.4);
    g.save();
    g.translate(-17.5, 0);
    g.fillStyle = col[RED]!;
    g.beginPath();
    g.roundRect(-3.2, -6.5, 6.4, 13, 1.6);
    g.fill();
    g.fillStyle = col[CREAM]!;
    g.fillRect(-3.2, -4.6, 6.4, 1.1);
    g.fillRect(-3.2, 3.5, 6.4, 1.1);
    g.fillStyle = col[PAPER]!;
    g.globalAlpha = 0.35;
    g.fillRect(-2.2, -5.6, 1.1, 11.2);
    g.restore();
    g.restore();
    g.globalAlpha = 1;
    if (sw < 0.25) {
      g.strokeStyle = col[GOLD]!;
      g.lineWidth = 0.8;
      g.globalAlpha = 1 - sw * 4;
      g.beginPath();
      g.arc(x, y, 3 + sw * 30, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  engine.start();
  if (first) {
    const k = W / (stage.clientWidth || 1);
    bonk(first.x * k, first.y * k);
  }
  return {
    engine,
    bonk,
    /** For tests: the mode (0 intro, 1 idle, 2 a round, 3 the bell), tickets, bonks, bombs set off, moles up, seconds left. */
    get state() {
      return { mode: S[MODE]!, tickets: b.tickets, bonks: S[BONKS]!, booms: S[BOOMS]!, up: upCount(), left: S[LEFT]! };
    },
    /** For tests: the moles up now: hole, kind, where to bonk them (art units). */
    moles() {
      const out: { h: number; kind: number; x: number; y: number; hat: boolean }[] = [];
      for (let h = 0; h < NH; h++) if (HS[h] === UP && HH[h]! > 0.5) out.push({ h, kind: HK[h]!, x: hx(h), y: headY(h), hat: HK[h] === HAT && HP[h]! > 1 });
      return out;
    },
    /** The poster's canvas is drawn smaller (scripts/gallery-posters.mjs). */
    poster: () => b.poster(),
    destroy: () => engine.destroy(),
  } as MolesScene & { moles(): { h: number; kind: number; x: number; y: number; hat: boolean }[] };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => oodlesOMoles(stage, slot, first);
/** The poster: the intro, both moles up and the raspberry blown (scripts/gallery-posters.mjs). */
export const posterAt = 2.4;
