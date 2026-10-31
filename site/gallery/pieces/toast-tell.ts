// "Toast Tell": a three-punch bout with Crumbtron, a boxing toaster. He always tells you what's
// coming: toast pops up out of his slots before a big hook (DUCK), his dial eyes go red before a
// jab (SLIP). Dodge the right way and he overswings, dizzy, wide open: PUNCH then for a counter.
// Wrong dodge, or none, and you eat it. Three counters and he goes down for the count (1, 2, 3, KO);
// three hits and it's you on the mat. His pattern repeats, a little faster each time you land one.
// Keys (focus in the stage): ← or A slips, ↓ or S ducks, Space, → or D punches; M mutes.
// Bricks: the kernel (fixed step, settle: between bouts both fighters stand still and it sleeps; its
// ledger for the canvas and the controls), fizlet/sound and fizlet/slot. The bout (`bout`) is plain
// numbers: no DOM, no allocation a step.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { controls, ring, CYAN, GO, GOLD, INK, PAPER, PINK, PURPLE, RED, STEEL } from "./ring-kit";

/** Modes: waiting (no bout), the bout, his count (he's down), your count. */
export const WAIT = 0, FIGHT = 1, KO = 2, DOWN = 3;
/** His phases: idle, the tell, the swing, recovering, open (overswung), hurt. */
export const IDLE = 0, TELL = 1, SWING = 2, RECOVER = 3, OPEN = 4, HURT = 5;
/** Your moves: guard, slip, duck, punch, stunned. */
export const GUARD = 0, SLIP = 1, DUCK = 2, PUNCH = 3, STUN = 4;
/** His punches: a jab (slip it), a hook (duck it). */
export const JAB = 0, HOOK = 1;
const PATTERN = [HOOK, JAB, JAB, HOOK, JAB, HOOK, HOOK, JAB];
const TELL_T = 0.55, SWING_T = 0.16, DODGE_T = 0.42, OPEN_T = 0.8, CAP = 30;
// State slots.
const MODE = 0, T = 1, OP = 2, OT = 3, KIND = 4, PAT = 5, PL = 6, PT = 7, CD = 8, OHP = 9, YHP = 10, BOT = 11;
const COUNTERS = 12, DODGES = 13, TAKEN = 14, KOS = 15, BLOCKS = 16, DOWNS = 17, ROUND = 18;

/** The bout on plain numbers. `emit(type)` names what happened. */
export function bout(emit: (type: string, v: number) => void) {
  const S = new Float64Array(20);
  const reset = () => {
    (S[OP] = IDLE), (S[OT] = 0), (S[PL] = GUARD), (S[PT] = 0), (S[CD] = 0), (S[OHP] = 3), (S[YHP] = 3), (S[PAT] = 0), (S[ROUND] = 0);
  };
  reset();
  const start = (bot: boolean) => {
    reset();
    (S[MODE] = FIGHT), (S[T] = 0), (S[BOT] = bot ? 1 : 0), (S[OT] = -0.4);
    emit("bell", 1);
  };
  const to = (mode: number) => ((S[MODE] = mode), (S[T] = 0));
  /** Your move: SLIP, DUCK or PUNCH. Starts a bout if none is on. */
  function act(m: number) {
    if (S[MODE] === WAIT) return start(false), true;
    if (S[MODE] !== FIGHT || S[PL] !== GUARD || S[CD]! > 0) return false;
    (S[PL] = m), (S[PT] = 0);
    if (m !== PUNCH) emit("dodge", 1);
    return true;
  }
  function step(dt: number) {
    const mode = S[MODE]!;
    S[T] = S[T]! + dt;
    if (mode === WAIT) return false;
    if (mode === KO || mode === DOWN) {
      // The count: 1, 2, 3 a second apart, then the bout is over.
      const was = Math.floor(S[T]! - dt), now = Math.floor(S[T]!);
      if (now !== was && now >= 1 && now <= 3) emit("count", now);
      if (S[T]! > 4.4) to(WAIT), reset();
      return true;
    }
    // The bout.
    S[OT] = S[OT]! + dt;
    S[PT] = S[PT]! + dt;
    S[CD] = Math.max(0, S[CD]! - dt);
    const op = S[OP]!, ot = S[OT]!, speed = 1 + S[ROUND]! * 0.12;
    if (S[BOT]) {
      // The intro's boxer reads the tell and counters once, then it's your turn.
      if (op === TELL && ot > TELL_T * 0.55 && S[PL] === GUARD) act(S[KIND] === HOOK ? DUCK : SLIP);
      if (op === OPEN && ot > 0.2 && S[PL] === GUARD) act(PUNCH);
      if (S[COUNTERS]! >= 1 && op === IDLE) return to(WAIT), reset(), (S[BOT] = 0), emit("turn", 1), true;
    }
    if (op === IDLE && ot > 0.75 / speed) {
      (S[OP] = TELL), (S[OT] = 0), (S[KIND] = PATTERN[S[PAT]! % PATTERN.length]!), (S[PAT] = S[PAT]! + 1);
      emit(S[KIND] === HOOK ? "pop" : "tell", 1);
    } else if (op === TELL && ot > TELL_T / speed) {
      (S[OP] = SWING), (S[OT] = 0);
      emit("swing", 1);
    } else if (op === SWING && ot > SWING_T) {
      const need = S[KIND] === HOOK ? DUCK : SLIP;
      if (S[PL] === need && S[PT]! < DODGE_T + 0.05) {
        (S[OP] = OPEN), (S[OT] = 0);
        S[DODGES] = S[DODGES]! + 1;
        emit("whiff", 1);
      } else {
        (S[OP] = RECOVER), (S[OT] = 0);
        (S[PL] = STUN), (S[PT] = 0);
        S[YHP] = S[YHP]! - 1;
        S[TAKEN] = S[TAKEN]! + 1;
        emit("hit", 1);
        if (S[YHP]! <= 0) (S[DOWNS] = S[DOWNS]! + 1), to(DOWN), emit("down", 1);
      }
    } else if ((op === RECOVER && ot > 0.45) || (op === OPEN && ot > OPEN_T) || (op === HURT && ot > 0.5)) (S[OP] = IDLE), (S[OT] = 0);
    // Your moves run out.
    const pl = S[PL]!, pt = S[PT]!;
    if (pl === PUNCH && pt >= 0.08 && pt - dt < 0.08) {
      if (S[OP] === OPEN) {
        (S[OP] = HURT), (S[OT] = 0);
        S[OHP] = S[OHP]! - 1;
        S[COUNTERS] = S[COUNTERS]! + 1;
        S[ROUND] = S[ROUND]! + 1;
        emit("counter", 1);
        if (S[OHP]! <= 0 && !S[BOT]) (S[KOS] = S[KOS]! + 1), to(KO), emit("ko", 1);
      } else {
        S[BLOCKS] = S[BLOCKS]! + 1;
        emit("block", 1);
      }
    }
    if ((pl === PUNCH && pt > 0.24) || ((pl === SLIP || pl === DUCK) && pt > DODGE_T) || (pl === STUN && pt > 0.55)) {
      S[CD] = pl === STUN ? 0 : 0.18;
      (S[PL] = GUARD), (S[PT] = 0);
    }
    if (S[MODE] === FIGHT && S[T]! > CAP) to(WAIT), reset();
    return true;
  }
  return { S, step, act, start };
}

export type ToastScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof bout> };

const PX = 52, OX = 110, FY = 66;

export function toastTell(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): ToastScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const sim = bout((type, v) => engine.events.emit(type, 0, 0, 0, 0, v));
  const S = sim.S;
  const skin = slot.querySelector<HTMLElement>("[data-rg]") ?? stage;
  const k = ring(engine, stage, skin, { bell: "ready", tell: "click", pop: "power", swing: "fire", whiff: "click", hit: "hurt", counter: "hit", block: "click", ko: "win", down: "end", count: "click" });
  const g = k.g, col = k.col, { circ, rr } = k;
  // Words that pop: which, age, x, y.
  const WORDS = ["SLIPPED!", "DUCKED!", "COUNTER!", "BLOCKED", "OOF!", "KO!", "DOWN!", "YOUR TURN", "FIGHT!"], WD = new Float64Array(4);
  WD[1] = 9;
  const say = (w: number, x: number, y: number) => ((WD[0] = w), (WD[1] = 0), (WD[2] = x), (WD[3] = y));

  const B = controls(engine, stage, [
    { id: SLIP, label: "◀ SLIP", aria: "Slip (left arrow)" },
    { id: DUCK, label: "▼ DUCK", aria: "Duck (down arrow)" },
    { id: PUNCH, label: "PUNCH ▶", aria: "Punch (space)" },
    { id: 9, label: "♪", aria: "Mute (M)" },
  ], (id) => (id === 9 ? mute() : move(id), engine.wake()));
  const mute = () => {
    k.snd.on = !k.snd.on;
    B[3]!.textContent = k.snd.on ? "♪" : "✕";
    B[3]!.setAttribute("aria-pressed", k.snd.on ? "false" : "true");
  };
  const move = (m: number) => {
    if (S[BOT]) S[BOT] = 0;
    const was = S[MODE];
    if (sim.act(m) && was === WAIT) say(8, 80, 40);
  };
  engine.ledger.attr(stage, "tabindex", "0");
  engine.ledger.attr(stage, "role", "application");
  engine.ledger.attr(stage, "aria-label", "Toast Tell. Toast up: duck (down). Red eyes: slip (left). Then punch (space). M: mute.");
  engine.ledger.style(stage, "touch-action", "manipulation");
  stage.addEventListener("keydown", (e) => {
    const c = e.code;
    const m = c === "ArrowLeft" || c === "KeyA" ? SLIP : c === "ArrowDown" || c === "KeyS" ? DUCK : c === "Space" || c === "ArrowRight" || c === "KeyD" || c === "ArrowUp" ? PUNCH : c === "KeyM" ? 9 : -1;
    if (m < 0 || e.target !== stage) return;
    e.preventDefault();
    if (e.repeat) return;
    m === 9 ? mute() : move(m);
    engine.wake();
  }, { signal: engine.signal });

  if (!first) sim.start(true), engine.busy(4);

  engine.add({
    read() {
      k.read();
    },
    step(e, dt) {
      const m = S[MODE]!, op = S[OP]!, pl = S[PL]!, c = S[COUNTERS]!, h = S[TAKEN]!, bl = S[BLOCKS]!;
      const moving = sim.step(dt);
      if (S[COUNTERS] !== c) (k.burst(OX - 12, FY - 32, 16, 50, GOLD, 1.3), k.burst(OX - 10, FY - 30, 6, 30, PAPER), k.shake(0.8), k.flash(0.6), say(2, OX - 6, FY - 50));
      if (S[TAKEN] !== h) (k.burst(PX + 4, FY - 30, 10, 40, RED), k.shake(1), say(4, PX, FY - 48));
      if (S[BLOCKS] !== bl) (k.burst(OX - 16, FY - 26, 4, 20, STEEL), say(3, OX - 8, FY - 46));
      if (op === SWING && S[OP] === OPEN) say(S[KIND] === HOOK ? 1 : 0, PX, FY - 50);
      if (m === FIGHT && S[MODE] === KO) say(5, OX, FY - 52);
      if (m === FIGHT && S[MODE] === DOWN) say(6, PX, FY - 48);
      if (m === FIGHT && S[MODE] === WAIT && S[COUNTERS]! >= 1 && !S[KOS]) say(7, 80, 40);
      void pl;
      WD[1] = WD[1]! + dt;
      const sparks = k.step(dt);
      if (moving || sparks || WD[1]! < 1.3) e.busy();
    },
    render() {
      k.begin();
      const m = S[MODE]!, t = S[T]!, cheer = m === KO ? 1 : S[OP] === HURT ? 0.7 : 0;
      k.hall(cheer);
      // Shadows on the mat.
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.3;
      g.beginPath();
      g.ellipse(PX, FY + 1, 11, 2.2, 0, 0, 6.3);
      g.ellipse(OX, FY + 1, 15, 2.6, 0, 0, 6.3);
      g.fill();
      g.globalAlpha = 1;
      crumbtron(t);
      byte(t);
      k.front();
      k.drawSparks();
      // The count over whoever is down.
      if (m === KO || m === DOWN) {
        const n = Math.floor(t);
        if (n >= 1 && n <= 3) k.word(String(n), m === KO ? OX : PX, 28, 14, GOLD, 1 - (t - n) * 0.6);
        if (t > 3.6) k.word(m === KO ? "KO!" : "GET UP!", 80, 30, 14, m === KO ? GO : RED);
      }
      // HUD: health pips, the hint while waiting.
      k.word("YOU", 14, 7, 4, CYAN);
      k.word("CRUMBTRON", 140, 7, 4, RED);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = col[i < S[YHP]! ? CYAN : INK]!;
        rr(24 + i * 7, 4.6, 5.6, 4, 1);
        g.fillStyle = col[i < S[OHP]! ? RED : INK]!;
        rr(117 - i * 7, 4.6, 5.6, 4, 1);
      }
      if (m === WAIT) {
        k.word("TOAST UP → DUCK · RED EYES → SLIP · THEN PUNCH", 80, 16, 3.6, PAPER, 0.92);
        if (S[KOS]) k.word("KOs " + S[KOS], 80, 22, 4, GOLD);
      }
      if (S[BOT] && m === FIGHT) k.word("WATCH HIS TELL", 80, 16, 4, PAPER, 0.9);
      if (WD[1]! < 1.3) {
        const u = WD[1]!, w = WD[0]!;
        k.word(WORDS[w]!, Math.max(22, Math.min(138, WD[2]!)), WD[3]! - u * 5, w === 5 || w === 2 ? 10 : 7, w === 4 || w === 6 ? RED : w === 2 || w === 5 ? GOLD : w < 2 ? GO : PAPER, Math.min(1, (1.3 - u) * 3), Math.sin(w * 1.7) * 0.1);
      }
    },
  });

  /** Byte, you: a cyan bot with a pink headband and gold gloves, facing right. */
  function byte(t: number) {
    const pl = S[PL]!, pt = S[PT]!, m = S[MODE]!;
    let x = PX, lean = 0, sq = 1, gx = 0, gy = 0, reach = 0;
    if (m === DOWN) lean = -Math.min(1.45, S[T]! * 4);
    else if (pl === SLIP) (x -= 8 * Math.min(1, pt * 14)), (lean = -0.3);
    else if (pl === DUCK) (sq = 0.62), (gy = 7);
    else if (pl === PUNCH) reach = Math.sin(Math.min(1, pt / 0.24) * Math.PI);
    else if (pl === STUN) (x -= 4), (lean = -0.35 + Math.sin(pt * 30) * 0.08);
    else if (m === FIGHT) gy = Math.sin(t * 5) * 0.8;
    g.save();
    g.translate(x, FY);
    g.rotate(lean);
    g.scale(1, sq);
    // Legs, body, the visor, the headband and its tails.
    g.fillStyle = col[INK]!;
    g.fillRect(-5, -8, 3.4, 8);
    g.fillRect(1.6, -8, 3.4, 8);
    g.fillStyle = col[CYAN]!;
    rr(-8, -32, 16, 25, 6);
    g.fillStyle = col[INK]!;
    rr(-1, -28, 9, 5, 2.4);
    g.fillStyle = col[GO]!;
    g.fillRect(3 + Math.sin(t * 3) * 0.5, -26.6, 2.6, 1.4);
    g.fillStyle = col[PINK]!;
    g.fillRect(-8, -31, 16, 2.4);
    g.fillRect(-11.5, -30 + Math.sin(t * 7) * 0.6, 4, 1.2);
    g.fillRect(-12, -27.6 + Math.sin(t * 7 + 1) * 0.6, 4, 1.2);
    g.restore();
    // Gloves: the back one by the chin; the front one guards or flies out to his face.
    const hy = FY - (pl === DUCK ? 18 : 24) * 1 + gy * 0.4;
    g.fillStyle = col[GOLD]!;
    if (m === DOWN) {
      circ(x - 6, FY - 4, 3.2);
      circ(x + 2, FY - 2, 3.2);
    } else {
      circ(x + 6 + gx, hy + 3, 3.4);
      const fx = x + 10 + reach * (OX - 26 - x), fy = hy - reach * 4;
      g.strokeStyle = col[CYAN]!;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 4, hy + 2), g.lineTo(fx, fy);
      g.stroke();
      if (reach > 0.4) {
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = reach * 0.6;
        g.fillRect(fx - 10, fy - 0.4, 7, 0.8), g.fillRect(fx - 8, fy - 2.6, 5, 0.6), g.fillRect(fx - 8, fy + 2, 5, 0.6);
        g.globalAlpha = 1;
      }
      g.fillStyle = col[GOLD]!;
      circ(fx, fy, 3.8);
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.25;
      g.fillRect(fx - 2, fy + 1.4, 4, 1);
      g.globalAlpha = 1;
    }
    if (pl === STUN || (m === DOWN && S[T]! > 0.4)) k.stars(x - (m === DOWN ? 12 : 0), FY - (m === DOWN ? 8 : 34), 3);
  }

  /** Crumbtron: a chrome toaster on short legs, red gloves, two dial eyes, facing left. */
  function crumbtron(t: number) {
    const op = S[OP]!, ot = S[OT]!, m = S[MODE]!, kind = S[KIND]!;
    let x = OX, lean = 0, gfx = -16, gfy = -24, toast = 0, eye = 0;
    if (m === KO) lean = Math.min(1.5, S[T]! * 3.5);
    else if (op === TELL) {
      const u = Math.min(1, ot / 0.25);
      if (kind === HOOK) (toast = u), (lean = 0.14 * u), (gfx = -6 + u * 8), (gfy = -24 - u * 14);
      else (eye = u), (lean = 0.08 * u), (gfx = -16 + u * 12), (gfy = -21);
    } else if (op === SWING) {
      const u = Math.min(1, ot / SWING_T);
      lean = -0.18 * u;
      if (kind === HOOK) (toast = 1 - u * 0.5), (gfx = 2 - u * (OX - PX - 8)), (gfy = -38 + u * 12 - Math.sin(u * 3.1) * 8);
      else (eye = 1), (gfx = -4 - u * (OX - PX - 10)), (gfy = -23);
    } else if (op === OPEN) (lean = -0.3 + Math.sin(ot * 9) * 0.06), (x -= 5), (gfx = -30), (gfy = -10), (toast = 0.35);
    else if (op === HURT) (lean = 0.32 * (1 - ot * 2)), (x += 6 * (1 - ot * 2)), (gfx = -12), (gfy = -16);
    else if (op === RECOVER) (gfx = -16 + (1 - Math.min(1, ot * 3)) * -20), (gfy = -24);
    const bob = m === FIGHT && op === IDLE ? Math.sin(t * 5) * 0.8 : 0;
    g.save();
    g.translate(x, FY);
    g.rotate(lean);
    // Legs; toast in the slots (rising on a hook's tell); the body; the slots; the lever; the face.
    g.fillStyle = col[INK]!;
    g.fillRect(-7, -6, 4, 6);
    g.fillRect(4, -6, 4, 6);
    g.fillStyle = col[GOLD]!;
    if (toast > 0 || m === KO) {
      const up = m === KO ? 0 : toast * 11;
      rr(-9, -36 - up + bob, 7, 10, 2);
      rr(2, -37 - up + bob, 7, 10, 2);
      g.fillStyle = col[PAPER]!;
      g.globalAlpha = 0.5;
      g.fillRect(-8, -35 - up + bob, 5, 1), g.fillRect(3, -36 - up + bob, 5, 1);
      g.globalAlpha = 1;
    }
    g.fillStyle = col[STEEL]!;
    rr(-14, -30 + bob, 28, 25, 6);
    g.fillStyle = col[PAPER]!;
    g.globalAlpha = 0.55;
    g.fillRect(-11, -27 + bob, 3, 18);
    g.globalAlpha = 1;
    g.fillStyle = col[PURPLE]!;
    g.fillRect(-14, -10 + bob, 28, 4);
    g.fillStyle = col[INK]!;
    g.fillRect(-9.5, -31 + bob, 8, 2.4);
    g.fillRect(1.5, -31 + bob, 8, 2.4);
    g.fillRect(12, -24 + bob + (op === TELL && kind === HOOK ? -4 : 0), 4, 2);
    // Eyes: two dials; red and spinning before a jab, X'd on the count, spirals when dizzy.
    for (let i = 0; i < 2; i++) {
      const ex = -8 + i * 8, ey = -20 + bob;
      g.fillStyle = col[INK]!;
      circ(ex, ey, 3.2);
      g.fillStyle = col[eye > 0.3 ? RED : PAPER]!;
      circ(ex, ey, 2.2);
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.8;
      g.beginPath();
      if (m === KO) g.moveTo(ex - 1.6, ey - 1.6), g.lineTo(ex + 1.6, ey + 1.6), g.moveTo(ex + 1.6, ey - 1.6), g.lineTo(ex - 1.6, ey + 1.6);
      else {
        const a = op === OPEN ? t * 14 : eye > 0 ? t * 20 : -2.4;
        g.moveTo(ex, ey), g.lineTo(ex + Math.cos(a) * 2, ey + Math.sin(a) * 2);
      }
      g.stroke();
      if (eye > 0.3) {
        g.fillStyle = col[RED]!;
        g.globalAlpha = 0.3 * eye;
        circ(ex, ey, 5);
        g.globalAlpha = 1;
      }
    }
    // The grille mouth.
    g.fillStyle = col[INK]!;
    for (let i = 0; i < 4; i++) g.fillRect(-10 + i * 3, -14 + bob, 1.6, op === HURT || op === OPEN ? 3.4 : 2);
    g.restore();
    // Gloves (red), on chrome arms.
    if (m === KO) {
      g.fillStyle = col[RED]!;
      circ(OX + 8, FY - 4, 4);
      circ(OX + 18, FY - 2, 4);
    } else {
      const fx = x + gfx, fy = FY + gfy + bob;
      g.strokeStyle = col[STEEL]!;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 10, FY - 18 + bob), g.lineTo(fx, fy);
      g.moveTo(x + 4, FY - 18 + bob), g.lineTo(x - 13, FY - 13 + bob);
      g.stroke();
      g.fillStyle = col[RED]!;
      circ(x - 13, FY - 13 + bob, 3.8);
      circ(fx, fy, 4.4);
      if (op === SWING) {
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = 0.5;
        g.fillRect(fx + 5, fy - 0.4, 9, 0.8), g.fillRect(fx + 6, fy - 3, 6, 0.6);
        g.globalAlpha = 1;
      }
      if (op === TELL) k.word("!", x + (kind === HOOK ? 0 : -8), FY - 50 + Math.sin(ot * 30) * 0.8, 9, kind === HOOK ? GOLD : RED);
    }
    if (op === OPEN) k.stars(x - 2, FY - 36, 4);
  }

  engine.start();
  if (first) move(PUNCH);
  return {
    engine, sim, accessible: true,
    poster: () => k.poster(),
    destroy: () => engine.destroy(),
  } as ToastScene & { poster(): void };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => toastTell(stage, slot, first);
/** The poster: the demo's first tell (toast up, the hook coming). */
export const posterAt = 1.45;
