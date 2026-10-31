// "Bag Beat": a speed bag on a swivel, ten seconds on the clock. Punch and the bag flies back, slaps
// the board and swings back at you: punch again just as it comes back (the ring closing on it shows
// when) and it goes again, a little faster each time you nail it. PERFECT, GOOD; too early or too late
// is a CLUNK (the bag wobbles, the streak is gone); let it come back with no punch and it dangles.
// At the bell: hits and your best streak. Gloves swap hands every punch.
// Keys (focus in the stage): Space, J or F punches; M mutes.
// Bricks: the kernel (fixed step, settle: a hanging bag is still and it sleeps; its ledger for the
// canvas and the controls), @fzlt/core/sound and @fzlt/core/slot. The bag (`bag`) is plain numbers: no DOM,
// no allocation a step.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { controls, ring, CYAN, GO, GOLD, INK, PAPER, PINK, PURPLE, RED, STEEL } from "./ring-kit";

/** Modes: waiting, the round, the bell. */
export const WAIT = 0, PLAY = 1, DONE = 2;
const ROUND = 10, START = 0.62, FASTEST = 0.3;
// State slots.
const MODE = 0, T = 1, PH = 2, PER = 3, LIVE = 4, STREAK = 5, BEST = 6, HITS = 7, CLUNKS = 8, WOB = 9, LEFT = 10, FIST = 11, PUNCHT = 12, LAST = 13, BOT = 14, ROUNDS = 15;

/** The bag on plain numbers. `emit(type, v)` names what happened. */
export function bag(emit: (type: string, v: number) => void) {
  const S = new Float64Array(16);
  S[PER] = START;
  S[PUNCHT] = 9;
  S[LAST] = -1;
  /** A punch. Starts a round if none is on. 0 clunk, 1 good, 2 perfect (S[LAST]). */
  function punch() {
    if (S[MODE] === DONE) return false;
    if (S[MODE] === WAIT) (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[STREAK] = S[BEST] = S[HITS] = S[CLUNKS] = 0), (S[LIVE] = 0), (S[PER] = START), emit("bell", 1);
    S[FIST] = 1 - S[FIST]!;
    S[PUNCHT] = 0;
    // The window: the bag on its way back to you (phase near 1), or a dangling bag (any time).
    const err = S[LIVE] ? Math.abs(1 - S[PH]!) * S[PER]! : 0;
    if (!S[LIVE] || err < 0.11) {
      const perfect = S[LIVE] && err < 0.045 ? 1 : 0;
      S[LAST] = S[LIVE] ? 1 + perfect : 1;
      if (S[LIVE]) (S[STREAK] = S[STREAK]! + 1), (S[BEST] = Math.max(S[BEST]!, S[STREAK]!));
      S[HITS] = S[HITS]! + 1;
      S[PER] = Math.max(FASTEST, S[PER]! * (perfect ? 0.94 : 0.98));
      (S[LIVE] = 1), (S[PH] = 0);
      emit(perfect ? "perfect" : "hit", 1);
    } else {
      S[LAST] = 0;
      (S[STREAK] = 0), (S[WOB] = 1), (S[CLUNKS] = S[CLUNKS]! + 1);
      S[PER] = Math.min(START, S[PER]! * 1.08);
      emit("clunk", 1);
    }
    return true;
  }
  function step(dt: number) {
    S[T] = S[T]! + dt;
    S[PUNCHT] = S[PUNCHT]! + dt;
    S[WOB] = Math.max(0, S[WOB]! - dt * 1.6);
    if (S[MODE] === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[BOT] && S[LIVE] && S[PH]! > 0.985) punch();
      if (S[BOT] && S[HITS]! >= 6) (S[BOT] = 0), (S[MODE] = DONE), (S[T] = 0), (S[LEFT] = 0), emit("turn", 1);
      if (S[LEFT] === 0 && S[MODE] === PLAY) (S[MODE] = DONE), (S[T] = 0), (S[ROUNDS] = S[ROUNDS]! + 1), emit("ding", 1);
    } else if (S[MODE] === DONE && S[T]! > 2.5) S[MODE] = WAIT;
    if (S[LIVE]) {
      const was = S[PH]!;
      S[PH] = was + dt / S[PER]!;
      if (was < 0.5 && S[PH]! >= 0.5) emit("slap", 1);
      // Back with no punch: it swings past and dangles.
      if (S[PH]! > 1.15) (S[LIVE] = 0), (S[STREAK] = 0), (S[WOB] = 0.8), emit("miss", 1);
    }
    return S[MODE] !== WAIT || S[LIVE] === 1 || S[WOB]! > 0 || S[PUNCHT]! < 0.3;
  }
  return {
    S, step, punch,
    demo() {
      S[BOT] = 1;
      punch();
    },
  };
}

export type BagScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof bag> };

const BX = 80, BY = 18;

export function bagBeat(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BagScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const sim = bag((type, v) => engine.events.emit(type, 0, 0, 0, 0, v));
  const S = sim.S;
  const skin = slot.querySelector<HTMLElement>("[data-rg]") ?? stage;
  const k = ring(engine, stage, skin, { bell: "ready", perfect: "power", hit: "hit", clunk: "hurt", slap: "click", miss: "end", ding: "win" });
  const g = k.g, col = k.col, { circ, rr } = k;
  const WORDS = ["CLUNK", "GOOD", "PERFECT!"], WD = new Float64Array(3);
  WD[1] = 9;
  const B = controls(engine, stage, [
    { id: 1, label: "PUNCH", aria: "Punch (space)" },
    { id: 9, label: "♪", aria: "Mute (M)" },
  ], (id) => (id === 9 ? mute() : hit(), engine.wake()));
  const mute = () => {
    k.snd.on = !k.snd.on;
    B[1]!.textContent = k.snd.on ? "♪" : "✕";
    B[1]!.setAttribute("aria-pressed", k.snd.on ? "false" : "true");
  };
  const hit = () => {
    if (S[BOT]) (S[BOT] = 0), (S[MODE] = WAIT), (S[LIVE] = 0);
    if (sim.punch()) {
      (WD[0] = S[LAST]!), (WD[1] = 0), (WD[2] = S[STREAK]!);
      if (S[LAST]) k.burst(BX - 7, BY + 21, S[LAST] === 2 ? 12 : 6, 40, S[LAST] === 2 ? GOLD : PAPER);
      else k.shake(0.5);
    }
  };
  engine.ledger.attr(stage, "tabindex", "0");
  engine.ledger.attr(stage, "role", "application");
  engine.ledger.attr(stage, "aria-label", "Bag Beat. Punch (space) as the bag swings back to you. M: mute.");
  engine.ledger.style(stage, "touch-action", "manipulation");
  stage.addEventListener("keydown", (e) => {
    const c = e.code, m = c === "Space" || c === "KeyJ" || c === "KeyF" ? 1 : c === "KeyM" ? 9 : 0;
    if (!m || e.target !== stage) return;
    e.preventDefault();
    if (e.repeat) return;
    m === 9 ? mute() : hit();
    engine.wake();
  }, { signal: engine.signal });
  if (!first) sim.demo(), engine.busy(4);

  engine.add({
    read() {
      k.read();
    },
    step(e, dt) {
      const moving = sim.step(dt);
      WD[1] = WD[1]! + dt;
      const sparks = k.step(dt);
      if (moving || sparks || WD[1]! < 1) e.busy();
    },
    render() {
      k.begin();
      const m = S[MODE]!, ph = S[PH]!, live = S[LIVE]!, t = S[T]!;
      // The gym: the back wall (the crowd's hall without the ring), the board, the swivel.
      k.hall(m === DONE ? 0.8 : S[STREAK]! >= 5 ? 0.4 : 0);
      g.fillStyle = col[PURPLE]!;
      rr(BX - 30, BY - 8, 60, 7, 2);
      g.fillStyle = col[INK]!;
      g.fillRect(BX - 30, BY - 2, 60, 1.4);
      g.fillStyle = col[STEEL]!;
      circ(BX, BY, 2);
      // The bag: out and back on the swivel (it slaps the board at half way), a wobble after a clunk.
      const a = live ? -Math.sin(Math.min(1, ph) * Math.PI) * 1.25 : Math.sin(t * 9) * S[WOB]! * 0.4, sq = live && Math.abs(ph - 0.5) < 0.06 ? 0.8 : 1;
      g.save();
      g.translate(BX, BY);
      g.rotate(a);
      g.strokeStyle = col[STEEL]!;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, 0), g.lineTo(0, 6);
      g.stroke();
      g.scale(sq, 1);
      g.fillStyle = col[RED]!;
      g.beginPath();
      g.moveTo(0, 5);
      g.bezierCurveTo(10, 8, 10, 28, 0, 30);
      g.bezierCurveTo(-10, 28, -10, 8, 0, 5);
      g.fill();
      g.fillStyle = col[PAPER]!;
      g.globalAlpha = 0.45;
      g.fillRect(-4.5, 12, 2, 10);
      g.globalAlpha = 1;
      g.fillStyle = col[INK]!;
      g.fillRect(-6, 9, 12, 1.4);
      g.restore();
      if (live && Math.abs(ph - 0.5) < 0.08) k.word("SLAP", BX, BY - 12, 5, PAPER, 0.8);
      // The timing ring: it closes on the bag as it comes back; gold inside the window.
      if (live && ph > 0.55 && ph < 1.15) {
        const u = Math.max(0, 1 - ph), inwin = Math.abs(1 - ph) * S[PER]! < 0.11;
        g.strokeStyle = col[inwin ? GOLD : CYAN]!;
        g.lineWidth = inwin ? 1.4 : 0.8;
        g.beginPath();
        g.arc(BX, BY + 22, 8 + u * 30, 0, 6.3);
        g.stroke();
      }
      // Gloves from the left (side on): the one that just punched is out at the bag.
      for (let i = 0; i < 2; i++) {
        const up = S[FIST] === i ? Math.max(0, 1 - S[PUNCHT]! * 5) : 0, bx = BX - (i ? 44 : 38), by = BY + (i ? 30 : 42);
        const x = bx + (BX - 11 - bx) * up, y = by + (BY + 21 - by) * up;
        g.strokeStyle = col[i ? GOLD : CYAN]!;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(-6, by + 8), g.lineTo(x - 4, y + 1);
        g.stroke();
        g.fillStyle = col[PINK]!;
        g.fillRect(x - 9, y - 4, 3, 8);
        g.fillStyle = col[i ? GOLD : CYAN]!;
        g.beginPath();
        g.ellipse(x, y, 7, 6, 0, 0, 6.3);
        g.fill();
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = 0.4;
        g.beginPath();
        g.ellipse(x + 1, y - 3, 3, 1.4, 0, 0, 6.3);
        g.fill();
        g.globalAlpha = 1;
        if (up > 0.6 && S[LAST]) {
          g.fillStyle = col[PAPER]!;
          g.fillRect(x - 18, y - 0.4, 8, 0.8), g.fillRect(x - 16, y - 3.4, 6, 0.6), g.fillRect(x - 16, y + 2.8, 6, 0.6);
        }
      }
      k.drawSparks();
      // HUD: the clock, hits, streak; the word for the last punch; the result at the bell.
      k.word(m === PLAY ? Math.ceil(S[LEFT]!) + "s" : "10s", 146, 8, 6, m === PLAY && S[LEFT]! < 3 ? RED : PAPER);
      k.word("HITS " + S[HITS], 22, 8, 5, CYAN);
      if (S[STREAK]! >= 2) k.word("×" + S[STREAK], BX + 34, BY + 30, 7 + Math.min(4, S[STREAK]! / 4), S[STREAK]! >= 8 ? GOLD : GO);
      if (WD[1]! < 1) k.word(WORDS[WD[0]!]!, BX - 26, BY + 2 - WD[1]! * 5, WD[0] === 2 ? 8 : 6, WD[0] === 2 ? GOLD : WD[0] ? GO : RED, Math.min(1, (1 - WD[1]!) * 3), -0.1);
      if (m === DONE) k.word(S[ROUNDS] ? "DING! " + S[HITS] + " HITS · BEST ×" + S[BEST] : "YOUR TURN", BX, 44, 7, GOLD);
      if (m === WAIT && !live) k.word(S[ROUNDS] ? "AGAIN? PUNCH" : "PUNCH TO START", BX, 50, 5, PAPER, 0.9);
      if (S[BOT] && m === PLAY) k.word("ON THE BEAT…", BX, 8, 5, PAPER, 0.9);
    },
  });

  engine.start();
  if (first) hit();
  return {
    engine, sim, accessible: true,
    poster: () => k.poster(),
    destroy: () => engine.destroy(),
  } as BagScene & { poster(): void };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bagBeat(stage, slot, first);
/** The poster: the demo mid-streak. */
export const posterAt = 2.3;
