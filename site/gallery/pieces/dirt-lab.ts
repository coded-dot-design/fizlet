// "Dirt Lab": build a short motocross track, then ride it. Eight slots between the start gate and
// the flag; the palette has a RAMP, a BUMP, a GAP and FLAT (to clear one). Tap a slot to drop the
// picked piece there (or drag a piece from the palette onto a slot), then RACE: hold GAS, and in the
// air lean back or forward so the bike lands flat. Land crooked or short of a gap's far lip and the
// rider goes over the bars. The track lives in the page only: RACE writes it into the address as
// #t=<8 letters> (no server, no account), and a #t= in the address on load is read back, checked
// letter by letter (eight known pieces or nothing).
// Keys (focus in the stage): ← → pick a slot, 1-4 pick a piece, Enter drops it, R races; racing,
// Space or ↑ is gas, ← leans back, → leans forward, Esc goes back to the builder; M mutes.
// Bricks: the kernel (fixed step, settle: asleep in the builder; its ledger for the canvas and the
// controls), @fzlt/core/sound and @fzlt/core/slot. The sim (`lab`) is plain numbers: no DOM, no allocation a step.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { keys } from "./keys";
import { rig, BIKE, CMD, DIRT, DIRT2, GO, GOLD, H, HOT, INK, PAPER, W } from "./moto-kit";

/** Piece letters, by id: flat, ramp, bump, gap. A track is eight of them. */
export const PIECES = "-rbg", SLOTS = 8;
export const FLAT = 0, RAMP = 1, BUMP = 2, GAP = 3;
const X0 = 16, SW = 16, GY = 66, END = X0 + SLOTS * SW, FINISH = END + 6, G = 120, CAP = 15;
/** Modes: building, racing, crashed (the rider tumbles), finished (coasting under the flag). */
export const BUILD = 0, RACE = 1, CRASH = 2, DONE = 3;
// State slots.
const MODE = 0, T = 1, X = 2, Y = 3, VX = 4, VY = 5, A = 6, AV = 7, AIR = 8, SPD = 9, GAS = 10, LEAN = 11, CUR = 12, PICK = 13;
const CLOCK = 14, AIRT = 15, BX = 17, BY = 18, BVX = 19, BVY = 20, BA = 21, SPIN = 22, BOT = 23, BEST = 24, CRASHES = 26, FINISHES = 27, LAND = 28, LANDT = 29;

/** The track as its hash value: eight letters. */
export function encodeTrack(t: ArrayLike<number>) {
  let s = "";
  for (let i = 0; i < SLOTS; i++) s += PIECES[t[i]!] ?? "-";
  return s;
}
/** Read `#t=<8 letters>` (or `…&t=…`) into `out`. Anything else (too long, unknown letters, a wrong
 *  count) is refused whole: false, and `out` is left as it was. */
export function decodeTrack(hash: string, out: Uint8Array) {
  const m = typeof hash == "string" && hash.length <= 64 && /(?:^#?|&)t=([-rbg]{8})(?:&|$)/.exec(hash); // PIECES' letters
  if (!m) return false;
  for (let i = 0; i < SLOTS; i++) out[i] = PIECES.indexOf(m[1]![i]!);
  return true;
}

/** The sim: the track, the bike and the rider, on plain numbers. `emit(type)` names what happened. */
export function lab(emit: (type: string, v: number) => void) {
  const S = new Float64Array(32), track = new Uint8Array(SLOTS);
  track.set([FLAT, RAMP, GAP, FLAT, FLAT, BUMP, RAMP, FLAT]);
  // Results go through Z (a double returned from a call that isn't inlined is a new heap number).
  const Z = new Float64Array(2);
  /** Z[0]: the height of the track at x (up is +); a gap is a pit (-99). */
  function hz(x: number) {
    if (x < X0 || x >= END) return void (Z[0] = 0);
    const s = ((x - X0) / SW) | 0, u = (x - X0 - s * SW) / SW, p = track[s]!;
    Z[0] = p === RAMP ? 3.5 * u + 6 * u * u : p === BUMP ? 2.6 * (1 - Math.cos(u * 6.2832)) : p === GAP ? -99 : 0;
  }
  /** Z[1]: the slope under x (screen radians: up a ramp is negative), from just behind it. */
  function sz(x: number) {
    hz(x - 0.6);
    const h0 = Z[0]!;
    hz(x);
    const h1 = Z[0]!;
    Z[1] = h0 < -50 || h1 < -50 ? 0 : Math.atan2(h0 - h1, 0.6);
  }
  const height = (x: number) => (hz(x), Z[0]!);
  const reset = () => {
    (S[X] = 7), (S[Y] = GY), (S[VX] = S[VY] = S[A] = S[AV] = S[AIR] = S[SPD] = 0), (S[CLOCK] = S[AIRT] = 0);
  };
  reset();
  S[PICK] = RAMP;
  S[LANDT] = 9;

  function crash() {
    S[MODE] = CRASH;
    S[T] = 0;
    (S[BX] = S[X]!), (S[BY] = S[Y]! - 12), (S[BVX] = S[VX]! * 0.8 + 6), (S[BVY] = Math.min(S[VY]!, 0) - 34), (S[BA] = S[A]!);
    S[CRASHES] = S[CRASHES]! + 1;
    emit("crash", 1);
  }
  function step(dt: number) {
    const mode = S[MODE]!;
    S[T] = S[T]! + dt;
    S[LANDT] = S[LANDT]! + dt;
    if (mode === BUILD) return false;
    if (mode === RACE) {
      S[CLOCK] = S[CLOCK]! + dt;
      if (S[BOT]) {
        // The intro's rider: full gas, and in the air he levels the bike.
        S[GAS] = 1;
        S[LEAN] = S[AIR] ? Math.max(-1, Math.min(1, (0.06 - S[A]!) * 4 - S[AV]! * 0.6)) : 0;
      }
      if (!S[AIR]) {
        sz(S[X]!);
        const th = Z[1]!;
        let sp = S[SPD]!;
        // Gas pulls; off it, rolling resistance takes the bike toward a stop (never past it).
        sp = S[GAS] ? sp + 90 * dt : sp > 0 ? Math.max(0, sp - 14 * dt) : Math.min(0, sp + 14 * dt);
        sp += G * Math.sin(th) * dt;
        sp = sp > 66 ? 66 : sp < -20 ? -20 : sp;
        S[SPD] = sp;
        S[VX] = sp * Math.cos(th);
        S[VY] = sp * Math.sin(th);
        const nx = S[X]! + S[VX]! * dt, ny = S[Y]! + S[VY]! * dt;
        hz(nx);
        const gy = GY - Z[0]!;
        S[X] = nx < 2 ? ((S[SPD] = 0), 2) : nx;
        if (gy > ny + 0.7) {
          // The ground falls away faster than the bike: it flies.
          S[AIR] = 1;
          S[Y] = ny;
          S[AIRT] = 0;
          S[AV] = 0;
          if (S[VY]! < -8) emit("launch", 1);
        } else {
          S[Y] = gy;
          sz(nx);
          const to = Z[1]!;
          S[A] = S[A]! + (to - S[A]!) * Math.min(1, dt * 22);
        }
      } else {
        S[VY] = S[VY]! + G * dt;
        S[X] = S[X]! + S[VX]! * dt;
        S[Y] = S[Y]! + S[VY]! * dt;
        S[AV] = (S[AV]! + S[LEAN]! * 12 * dt) * (1 - dt * 1.2);
        S[A] = S[A]! + S[AV]! * dt;
        S[AIRT] = S[AIRT]! + dt;
        hz(S[X]!);
        const h = Z[0]!;
        if (h < -50) {
          if (S[Y]! > GY + 3) crash(); // short of the far lip: into the pit
        } else if (S[Y]! >= GY - h) {
          sz(S[X]!);
          const th = Z[1]!, d = Math.abs(S[A]! - th);
          if (d > 0.6 || (S[Y]! > GY - h + 4 && S[VY]! > 0 && S[AIRT]! < 0.05)) crash();
          else {
            S[AIR] = 0;
            S[Y] = GY - h;
            S[SPD] = (S[VX]! * Math.cos(th) + S[VY]! * Math.sin(th)) * (1 - d * 0.7);
            S[A] = th;
            S[AV] = 0;
            S[LAND] = d < 0.25 ? 2 : 1;
            S[LANDT] = 0;
            emit(d < 0.25 ? "land" : "sketch", Math.min(1.5, S[AIRT]! * 2));
          }
        }
      }
      S[SPIN] = S[SPIN]! + S[VX]! * dt * 0.4;
      if (S[MODE] === RACE) {
        if (S[X]! >= FINISH) {
          S[MODE] = DONE;
          S[T] = 0;
          S[FINISHES] = S[FINISHES]! + 1;
          if (!S[BOT] && (!S[BEST] || S[CLOCK]! < S[BEST]!)) S[BEST] = S[CLOCK]!;
          emit("finish", 1);
        } else if (S[CLOCK]! > CAP) {
          S[MODE] = DONE;
          S[T] = 0;
        }
      }
      return true;
    }
    if (mode === CRASH) {
      // The bike skids and tumbles to a stop; the rider flies on and rolls.
      S[VX] = S[VX]! * (1 - dt * 2.4);
      S[X] = S[X]! + S[VX]! * dt;
      hz(S[X]!);
      const h = Z[0]!, gy = h < -50 ? GY + 14 : GY - h;
      S[Y] = S[Y]! + (gy - S[Y]!) * Math.min(1, dt * 12);
      S[A] = S[A]! + S[VX]! * dt * 0.12;
      S[BVY] = S[BVY]! + G * dt;
      S[BX] = S[BX]! + S[BVX]! * dt;
      S[BY] = S[BY]! + S[BVY]! * dt;
      S[BA] = S[BA]! + S[BVX]! * dt * 0.3;
      hz(S[BX]!);
      const bh = Z[0]!, bg = (bh < -50 ? GY + 16 : GY - bh) - 2;
      if (S[BY]! > bg) (S[BY] = bg), (S[BVY] = -Math.abs(S[BVY]!) * 0.35), (S[BVX] = S[BVX]! * 0.6);
      if (S[T]! > 2) back();
      return true;
    }
    // DONE: coast to a stop under the flag, then back to the builder.
    S[SPD] = Math.max(0, S[SPD]! - 60 * dt);
    S[X] = Math.min(W - 6, S[X]! + S[SPD]! * dt);
    if (S[AIR]) {
      S[VY] = S[VY]! + G * dt;
      S[Y] = Math.min(GY, S[Y]! + S[VY]! * dt);
      S[A] = S[A]! * (1 - dt * 6);
      if (S[Y] === GY) S[AIR] = 0;
    }
    S[SPIN] = S[SPIN]! + S[SPD]! * dt * 0.4;
    if (S[T]! > 2.2) back();
    return true;
  }
  function back() {
    S[MODE] = BUILD;
    S[T] = 0;
    S[BOT] = 0;
    S[GAS] = S[LEAN] = 0;
    reset();
  }

  return {
    S, track, height, step,
    /** Drop `piece` (or the picked one) into slot i. */
    place(i: number, piece = S[PICK]!) {
      if (S[MODE] !== BUILD || i < 0 || i >= SLOTS) return false;
      track[i] = piece;
      S[CUR] = i;
      emit("place", 1);
      return true;
    },
    pick(p: number) {
      S[PICK] = p;
      emit("pick", 1);
    },
    cursor(d: number) {
      S[CUR] = (S[CUR]! + d + SLOTS) % SLOTS;
    },
    race(bot = false) {
      if (S[MODE] !== BUILD) return false;
      reset();
      S[MODE] = RACE;
      S[T] = 0;
      S[BOT] = bot ? 1 : 0;
      emit("go", 1);
      return true;
    },
    stop: back,
    /** The slot under art x, or -1. */
    slotAt: (x: number) => (x >= X0 && x < END ? ((x - X0) / SW) | 0 : -1),
  };
}

export type LabScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof lab> };


export function dirtLab(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): LabScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const sim = lab((type, v) => engine.events.emit(type, 0, 0, 0, 0, v));
  const S = sim.S, track = sim.track;
  const skin = slot.querySelector<HTMLElement>("[data-mx]") ?? stage;
  const k = rig(engine, stage, skin, { launch: "power", land: "hit", sketch: "hurt", crash: "boom", finish: "win", place: "click", pick: "click", go: "ready" });
  const g = k.g, col = k.col;
  // The address as the page had it: Recall puts it back.
  const was = location.href, shared = decodeTrack(location.hash, track);
  engine.signal.addEventListener("abort", () => location.href !== was && history.replaceState(history.state, "", was), { once: true });
  const writeHash = () => {
    try {
      history.replaceState(history.state, "", "#t=" + encodeTrack(track));
    } catch {}
  };
  // Words that pop: index, age, x, y.
  const WORDS = ["CLEAN!", "SKETCHY", "BAIL!", "FINISH!", "GO!", "SENT IT"], WD = new Float64Array(4);
  WD[1] = 9;
  const say = (w: number, x: number, y: number) => ((WD[0] = w), (WD[1] = 0), (WD[2] = x), (WD[3] = y));

  // Controls (keys.ts): the palette row and RACE while building; LEAN, LEAN and GAS while racing; mute.
  const B = keys(engine, stage, [
    { id: 0, label: "FLAT" },
    { id: 1, label: "RAMP" },
    { id: 2, label: "BUMP" },
    { id: 3, label: "GAP" },
    { id: 4, label: "RACE", c: "bui-arcade bui-fire" },
    { id: 5, label: "◀ LEAN", aria: "Lean back", hold: true },
    { id: 6, label: "LEAN ▶", aria: "Lean forward", hold: true },
    { id: 7, label: "GAS", hold: true, c: "bui-arcade bui-go" },
    { id: 8, label: "♪", aria: "Mute" },
  ], (id, down) => {
    if (id < 4) (S[BOT] && sim.stop(), sim.pick(id), showBar());
    else if (id === 4) go();
    else if (id === 5) S[LEAN] = down ? -1 : S[LEAN] === -1 ? 0 : S[LEAN]!;
    else if (id === 6) S[LEAN] = down ? 1 : S[LEAN] === 1 ? 0 : S[LEAN]!;
    else if (id === 7) S[GAS] = down ? 1 : 0;
    else mute();
    engine.wake();
  });
  const mute = () => {
    k.snd.on = !k.snd.on;
    B[8]!.textContent = k.snd.on ? "♪" : "✕";
    B[8]!.setAttribute("aria-pressed", k.snd.on ? "false" : "true");
  };
  const go = () => {
    if (S[BOT]) sim.stop();
    if (sim.race()) (writeHash(), say(4, 80, 30));
    showBar();
    stage.focus({ preventScroll: true }); // racing keys (gas, lean) work straight away
  };
  const showBar = () => {
    const racing = S[MODE] !== BUILD && !S[BOT];
    for (let i = 0; i < 8; i++) B[i]!.hidden = (i < 5) === racing;
    for (let i = 0; i < 4; i++) B[i]!.setAttribute("aria-pressed", S[PICK] === i ? "true" : "false");
    // A key that just hid itself (RACE, the palette) hands the focus to the stage, so keys keep working.
    if ((document.activeElement as HTMLElement | null)?.hidden) stage.focus({ preventScroll: true });
  };
  showBar();
  // The stage is the game: focusable, labelled, it takes the keys while focus is in it.
  engine.ledger.attr(stage, "tabindex", "0");
  engine.ledger.attr(stage, "role", "application");
  engine.ledger.attr(stage, "aria-label", "Dirt Lab. Arrows: slot. 1-4: piece. Enter: place. R: race. Space: gas. Left, right: lean. M: mute.");
  engine.ledger.style(stage, "touch-action", "manipulation");
  const key = (e: KeyboardEvent, down: boolean) => {
    const c = e.code, m = S[MODE]!;
    let used = true;
    if (c === "KeyM") down && !e.repeat && mute();
    else if (m === BUILD || S[BOT]) {
      if (!down) return;
      if (S[BOT]) sim.stop(), showBar();
      if (c === "ArrowLeft") sim.cursor(-1);
      else if (c === "ArrowRight") sim.cursor(1);
      else if (c >= "Digit1" && c <= "Digit4") sim.pick(+c[5]! - 1);
      else if (c === "ArrowUp" || c === "ArrowDown") sim.pick((S[PICK]! + (c === "ArrowUp" ? 1 : 3)) % 4);
      else if ((c === "Enter" || c === "Space") && e.target === stage) sim.place(S[CUR]!);
      else if (c === "KeyR") go();
      else used = false;
    } else if (m === RACE) {
      if (c === "Space" || c === "ArrowUp" || c === "KeyW") S[GAS] = down ? 1 : 0;
      else if (c === "ArrowLeft" || c === "KeyA") S[LEAN] = down ? -1 : S[LEAN] === -1 ? 0 : S[LEAN]!;
      else if (c === "ArrowRight" || c === "KeyD") S[LEAN] = down ? 1 : S[LEAN] === 1 ? 0 : S[LEAN]!;
      else if (c === "Escape" && down) sim.stop();
      else used = false;
    } else used = false;
    if (used) (e.preventDefault(), engine.wake());
  };
  stage.addEventListener("keydown", (e) => key(e, true), { signal: engine.signal });
  stage.addEventListener("keyup", (e) => key(e, false), { signal: engine.signal });
  // Taps and drags: a tap on a slot drops the picked piece; a drag from the palette drops it where
  // the finger lets go.
  const P = new Float64Array(2);
  const drop = (e: PointerEvent) => {
    if (S[BOT]) sim.stop(), showBar();
    if (S[MODE] !== BUILD) return;
    k.at(e, P);
    const s = sim.slotAt(P[0]!);
    if (s >= 0 && P[1]! > 30 && P[1]! < GY + 10) sim.place(s);
    engine.wake();
  };
  stage.addEventListener("pointerup", (e) => e.isPrimary && drop(e), { signal: engine.signal });

  // The intro: a bot rides the default track once (unless a tap or a shared track started it).
  if (!first && !shared) (sim.race(true), engine.busy(4));

  engine.add({
    read() {
      k.read();
    },
    step(e, dt) {
      const m = S[MODE]!;
      const moving = sim.step(dt);
      // Dust from the back wheel, puffs on landing, debris on a crash.
      if (S[MODE] === RACE && !S[AIR] && (S[GAS] || S[SPD]! > 20)) k.dust(S[X]! - 4, S[Y]! - 0.5, 1, -S[VX]! * 0.3 - 8, -6, 8, S[GAS] ? DIRT : DIRT2, 1.1);
      if (S[LANDT] === 0) {
        k.dust(S[X]!, S[Y]!, 10, S[VX]! * 0.2, -14, 26, DIRT2, 1.4);
        k.shake(S[LAND] === 2 ? 0.25 : 0.6);
        say(S[LAND] === 2 ? (S[AIRT]! > 0.6 ? 5 : 0) : 1, S[X]!, S[Y]! - 20);
      }
      if (m !== S[MODE]) {
        if (S[MODE] === CRASH) (k.dust(S[X]!, S[Y]! - 2, 22, S[VX]! * 0.4, -30, 50, DIRT, 1.6), k.shake(1), say(2, S[X]!, S[Y]! - 22));
        if (S[MODE] === DONE && S[X]! >= FINISH) say(3, 80, 28);
        showBar();
      }
      WD[1] = WD[1]! + dt;
      const flying = k.step(dt);
      if (moving || flying || WD[1]! < 1.2) e.busy();
    },
    render() {
      k.begin();
      const m = S[MODE]!;
      k.sky(S[X]!);
      // The ground, piece by piece, as one dirt shape; the pits; the start pad and the finish.
      g.fillStyle = col[DIRT]!;
      g.beginPath();
      g.moveTo(-4, H + 4);
      g.lineTo(-4, GY);
      for (let x = 0; x <= W; x += 1) {
        const h = sim.height(x);
        g.lineTo(x, h < -50 ? H + 4 : GY - h);
      }
      g.lineTo(W + 4, GY);
      g.lineTo(W + 4, H + 4);
      g.fill();
      // The pits: dark, with a lip of roots.
      for (let s = 0; s < SLOTS; s++) if (track[s] === GAP) {
        g.fillStyle = col[INK]!;
        g.globalAlpha = 0.75;
        g.fillRect(X0 + s * SW, GY, SW, H - GY + 4);
        g.globalAlpha = 1;
        g.fillStyle = col[DIRT2]!;
        for (let j = 0; j < 4; j++) g.fillRect(X0 + s * SW + (j & 1 ? SW - 1.2 : 0), GY + 2 + j * 4, 1.2, 2);
      }
      // A top lip of lighter dirt, stripes of packed dirt below.
      g.strokeStyle = col[DIRT2]!;
      g.lineWidth = 1.4;
      g.beginPath();
      let pen = 0;
      for (let x = 0; x <= W; x += 1) {
        const h = sim.height(x);
        if (h < -50) (pen = 0);
        else if (!pen) (g.moveTo(x, GY - h + 0.7), (pen = 1));
        else g.lineTo(x, GY - h + 0.7);
      }
      g.stroke();
      g.fillStyle = col[DIRT2]!;
      for (let i = 0; i < 26; i++) {
        const x = (i * 37.1) % W, y = GY + 5 + ((i * 13.3) % 18);
        if (sim.height(x) > -50) g.fillRect(x, y, 2.2, 0.8);
      }
      // Start gate and the finish flag (checkered).
      g.fillStyle = col[CMD]!;
      g.fillRect(2, GY - 9, 1.2, 9);
      g.fillRect(12, GY - 9, 1.2, 9);
      g.fillRect(2, GY - 9.6, 11.2, 1.4);
      g.fillStyle = col[PAPER]!;
      g.fillRect(FINISH, GY - 22, 0.8, 22);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = col[(r + c) & 1 ? INK : PAPER]!;
        g.fillRect(FINISH + 0.8 + c * 2.2, GY - 22 + r * 2.2 + Math.sin(k.V[7]! * 6 + c) * 0.3 * c, 2.2, 2.2);
      }
      // The builder: slot frames, the cursor, ghost of the picked piece.
      if (m === BUILD) {
        for (let s = 0; s < SLOTS; s++) {
          const x = X0 + s * SW, on = s === S[CUR];
          g.strokeStyle = col[on ? GO : PAPER]!;
          g.globalAlpha = on ? 0.95 : 0.28;
          g.lineWidth = on ? 0.8 : 0.4;
          g.setLineDash(on ? [] : [1.2, 1.2]);
          g.strokeRect(x + 0.6, GY - 24, SW - 1.2, 34);
          g.setLineDash([]);
          if (on) {
            g.globalAlpha = 0.9;
            k.word(B[S[PICK]!]!.textContent!, x + SW / 2, GY - 28, 4, GO);
          }
        }
        g.globalAlpha = 1;
      }
      // Bike or crash.
      if (m === CRASH) {
        k.bike(S[X]!, S[Y]!, S[A]! + 1.2, S[SPIN]!, 0, 0);
        k.body(S[BX]!, S[BY]!, S[BA]!);
      } else k.bike(S[X]!, S[Y]!, S[A]!, S[SPIN]!, S[LEAN]!, 1);
      k.drawDust();
      // HUD: the clock while racing, the best time, the share code, the hint.
      if (m !== BUILD) k.word(S[CLOCK]!.toFixed(2) + "s", 146, 9, 6, S[BOT] ? PAPER : GOLD);
      if (S[BEST]) k.word("BEST " + S[BEST]!.toFixed(2), 146, m === BUILD ? 9 : 17, 4, GOLD);
      if (m === BUILD) k.word("PICK · TAP A SLOT · RACE", 80, 9, 4, PAPER, 0.85);
      if (m === RACE && S[BOT]) k.word("DEMO · TAP TO BUILD", 80, 9, 4, PAPER, 0.85);
      if (WD[1]! < 1.2) {
        const u = WD[1]!, w = WD[0]!;
        k.word(WORDS[w]!, Math.max(18, Math.min(142, WD[2]!)), WD[3]! - u * 6, 8, w === 2 ? BIKE : w === 1 ? HOT : w === 3 ? GO : GOLD, Math.min(1, (1.2 - u) * 3), Math.sin(w * 2.1) * 0.12);
      }
    },
  });

  engine.start();
  if (first) {
    k.at({ clientX: first.x + stage.getBoundingClientRect().left, clientY: first.y + stage.getBoundingClientRect().top }, P);
    const s = sim.slotAt(P[0]!);
    if (s >= 0) sim.place(s);
  }
  return {
    engine, sim, accessible: true,
    poster: () => k.poster(),
    destroy: () => engine.destroy(),
  } as LabScene & { poster(): void };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => dirtLab(stage, slot, first);
/** The poster: the demo rider in the air over the gap. */
export const posterAt = 1.2;
