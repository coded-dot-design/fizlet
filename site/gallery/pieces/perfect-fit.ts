// "Perfect Fit" (dev-humor, micro): the team's best developer holds up one box of work, and the chores
// keep coming. Tickets and boxes (HOTFIX, LEGACY, QUICK ONE, ON-CALL …) drop onto the stack one at a
// time; lean ← → (arrow keys, A D, or press and drag on the stage) to keep the swaying tower over the
// developer's hands and to catch the next one on top. Each piece that lands off centre leaves the
// tower leaning, the sway grows with its height and the developer's knees shake harder; a drop that
// misses the top bounces off. Lean too far and it all comes down: a crash, a REASSIGNED TO YOU stamp,
// a press to start over. Height and best on the stickers; behind, two teammates play table tennis.
// Bricks: the kernel (fixed step; settle; its ledger for the canvas and the play key, so Recall gives
// the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The game is `perfectFit()`, plain
// numbers, no DOM (tests/perfect-fit.test.mjs: it stands under a steady hand, falls with none, and
// steps allocate nothing).
import { createEngine } from "../../../src/kernel/index";
import { seeded } from "../../../src/kernel/random";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

/** What lands on the stack (ours). Even ids are tickets, odd ones boxes. */
export const LABELS = ["HOTFIX", "LEGACY", "URGENT", "QUICK ONE", "MEETING", "ON-CALL", "TECH DEBT", "PROD DOWN", "SCOPE CREEP", "MIGRATION", "FLAKY TEST", "RE-ORG", "ASAP", "SMALL TWEAK", "1:1", "AUDIT", "PIXEL NUDGE", "REWRITE IT"];
export const IDLE = 0, PLAY = 1, CRASH = 2;
/** The hands (the stack's pivot): height above the floor; the most items; the fall angle. */
export const HANDS = 33, MAX = 40, TIP = 0.55;
const TAU = 6.2832, BASE_W = 17, BASE_H = 7, G = 70, N_DEB = MAX + 8;
// State slots.
const MODE = 0, T = 1, TH = 2, OM = 3, LEAN = 4, N = 5, HT = 6, NEXT = 7, FX = 8, FY = 9, FVX = 10, FVY = 11, FW = 12, FH = 13, FL = 14, FALL = 15, BEST = 16, CRT = 17, COMX = 18, COMH = 19, ROLL = 20, PX = 21, NEWB = 22;
/** Events this step: start, land, miss, crash, a new best. */
export const EV_START = 0, EV_LAND = 1, EV_MISS = 2, EV_CRASH = 3, EV_BEST = 4;
/** Inputs: [0] lean target −1..1, [1] presses since the last step. */
export type Inputs = Float64Array;

export function perfectFit(seed: number, I: Inputs) {
  const R = seeded(seed);
  const S = new Float64Array(24), ev = new Uint8Array(5);
  // The stack: width, height, offset across the tower, bottom along it, label.
  const W_ = new Float64Array(MAX), H_ = new Float64Array(MAX), OX = new Float64Array(MAX), SB = new Float64Array(MAX), LB = new Uint8Array(MAX);
  // Loose pieces (misses, the crash): x, y (centre), vx, vy, angle, spin, w, h, label, alive, resting.
  const DX = new Float64Array(N_DEB), DY = new Float64Array(N_DEB), DVX = new Float64Array(N_DEB), DVY = new Float64Array(N_DEB), DA = new Float64Array(N_DEB), DVA = new Float64Array(N_DEB), DW = new Float64Array(N_DEB), DH = new Float64Array(N_DEB), DL = new Uint8Array(N_DEB), DON = new Uint8Array(N_DEB), DREST = new Uint8Array(N_DEB);
  const nd = new Uint32Array(1);
  function reset() {
    (S[TH] = 0), (S[OM] = 0), (S[N] = 0), (S[HT] = BASE_H), (S[NEXT] = 0.6), (S[FALL] = 0), (S[CRT] = 0), (S[COMX] = 0), (S[COMH] = BASE_H / 2), (S[LEAN] = 0), (S[ROLL] = R() * 18), (S[NEWB] = 0);
    DON.fill(0);
    nd[0] = 0;
  }
  reset();
  // Before the first press: a few already on the stack (the poster's story).
  for (let i = 0; i < 4; i++) (W_[i] = 15 - i), (H_[i] = i & 1 ? 7 : 4), (OX[i] = (i & 1 ? 1.5 : -1) * (i * 0.6)), (SB[i] = S[HT]!), (LB[i] = [0, 3, 6, 5][i]!), (S[HT] = S[HT]! + H_[i]!);
  S[N] = 4;
  function loose(x: number, y: number, vx: number, vy: number, a: number, va: number, w: number, h: number, l: number) {
    const i = nd[0]! % N_DEB;
    nd[0] = nd[0]! + 1;
    (DX[i] = x), (DY[i] = y), (DVX[i] = vx), (DVY[i] = vy), (DA[i] = a), (DVA[i] = va), (DW[i] = w), (DH[i] = h), (DL[i] = l), (DON[i] = 1), (DREST[i] = 0);
  }
  /** Where along the tower point (u across, v up) is, in the world: into S[PX] and the return (y). */
  function at(u: number, v: number) {
    const c = Math.cos(S[TH]!), s = Math.sin(S[TH]!), hx = S[LEAN]! * 6;
    S[PX] = hx + u * c + v * s;
    return HANDS - u * s + v * c;
  }
  function spawn() {
    const k = (S[ROLL] = (S[ROLL]! + 1 + ((R() * 3) | 0)) % LABELS.length) | 0, box = k & 1;
    const n = S[N]!, top = n ? OX[n - 1]! : 0;
    const y = at(top, S[HT]!);
    (S[FW] = box ? 11 + R() * 6 : 14 + R() * 6), (S[FH] = box ? 6 + R() * 2 : 4), (S[FL] = k);
    (S[FX] = S[PX]! + (R() - 0.5) * 16), (S[FY] = y + 46), (S[FVX] = 0), (S[FVY] = -8), (S[FALL] = 1);
  }
  function crash() {
    (S[MODE] = CRASH), (S[CRT] = 0), (S[FALL] = 0);
    ev[EV_CRASH] = 1;
    const om = S[OM]!, th = S[TH]!;
    for (let i = -1; i < S[N]!; i++) {
      const w = i < 0 ? BASE_W : W_[i]!, h = i < 0 ? BASE_H : H_[i]!, u = i < 0 ? 0 : OX[i]!, v = (i < 0 ? 0 : SB[i]!) + h / 2;
      const y = at(u, v);
      loose(S[PX]!, y, om * v * Math.cos(th) * 1.4 + (R() - 0.5) * 14, -om * v * Math.sin(th) + R() * 10, th, (R() - 0.5) * 6 + om * 2, w, h, i < 0 ? 255 : LB[i]!);
    }
    S[N] = -1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = I[1]!;
    I[1] = 0;
    const mode = S[MODE]!;
    if (presses && (mode === IDLE || (mode === CRASH && S[CRT]! > 1))) {
      reset();
      S[MODE] = PLAY;
      ev[EV_START] = 1;
      return true;
    }
    let busy = mode === PLAY;
    if (mode === CRASH) S[CRT] = S[CRT]! + dt;
    // The lean follows the hand; on the stack it is a push.
    S[LEAN] = S[LEAN]! + ((mode === PLAY ? I[0]! : 0) - S[LEAN]!) * (1 - Math.exp(-8 * dt));
    if (mode === PLAY) {
      // An inverted stack on the hands: it falls the way it leans (faster as it grows), the
      // off-centre load pulls it over, the breeze sways it, and the lean pushes it back.
      const n = S[N]!, k = 2 + n * 0.18, th = S[TH]!;
      const a = k * (Math.sin(th) + S[COMX]! / (S[COMH]! + 6)) - 1.6 * S[OM]! + S[LEAN]! * (3.2 + n * 0.16) + Math.sin(S[T]! * 1.9) * 0.05 * n;
      S[OM] = S[OM]! + a * dt;
      S[TH] = th + S[OM]! * dt;
      if (S[TH]! > TIP || S[TH]! < -TIP) crash();
      // The next one.
      else if (!S[FALL]) {
        if ((S[NEXT] = S[NEXT]! - dt) <= 0 && n < MAX) spawn();
      } else {
        S[FVY] = S[FVY]! - G * dt;
        const y0 = S[FY]!;
        S[FY] = y0 + S[FVY]! * dt;
        const top = n ? OX[n - 1]! : 0, tw = n ? W_[n - 1]! : BASE_W, ty = at(top, S[HT]!), tx = S[PX]!;
        if (y0 >= ty && S[FY]! < ty) {
          const d = (S[FX]! - tx) / Math.cos(S[TH]!);
          if (d < (tw + S[FW]!) * 0.38 && d > -(tw + S[FW]!) * 0.38) {
            // It lands: on the stack, where it hit.
            (W_[n] = S[FW]!), (H_[n] = S[FH]!), (OX[n] = top + d), (SB[n] = S[HT]!), (LB[n] = S[FL]!);
            S[HT] = S[HT]! + S[FH]!;
            S[N] = n + 1;
            let m = BASE_W * BASE_H, mx = 0, mh = (BASE_W * BASE_H * BASE_H) / 2;
            for (let i = 0; i <= n; i++) {
              const q = W_[i]! * H_[i]!;
              (m += q), (mx += q * OX[i]!), (mh += q * (SB[i]! + H_[i]! / 2));
            }
            (S[COMX] = mx / m), (S[COMH] = mh / m);
            S[OM] = S[OM]! + d * 0.03 + S[FVY]! * 0.0005 * (d < 0 ? -1 : 1);
            (S[FALL] = 0), (S[NEXT] = Math.max(0.45, 1.1 - n * 0.02));
            ev[EV_LAND] = 1;
            if (n + 1 > S[BEST]!) (S[BEST] = n + 1), S[NEWB] || ((S[NEWB] = 1), (ev[EV_BEST] = 1));
          } else {
            // A miss: it clips the top corner and tumbles off.
            const side = d < 0 ? -1 : 1;
            loose(S[FX]!, S[FY]! + S[FH]! / 2, side * (14 + R() * 10), 12, 0, side * 5, S[FW]!, S[FH]!, S[FL]!);
            S[OM] = S[OM]! - side * 0.05;
            (S[FALL] = 0), (S[NEXT] = 0.5);
            ev[EV_MISS] = 1;
          }
        }
      }
    }
    // Loose pieces: fall, bounce, come to rest on the floor or on each other.
    for (let i = 0; i < N_DEB; i++) {
      if (!DON[i] || DREST[i]) continue;
      busy = true;
      DVY[i] = DVY[i]! - G * dt;
      DX[i] = DX[i]! + DVX[i]! * dt;
      DY[i] = DY[i]! + DVY[i]! * dt;
      DA[i] = DA[i]! + DVA[i]! * dt;
      let floor = 0;
      for (let j = 0; j < N_DEB; j++) {
        if (j === i || !DON[j] || !DREST[j]) continue;
        if (DX[i]! + DW[i]! / 2 > DX[j]! - DW[j]! / 2 && DX[i]! - DW[i]! / 2 < DX[j]! + DW[j]! / 2) {
          const tp = DY[j]! + DH[j]! / 2;
          if (tp > floor) floor = tp;
        }
      }
      if (DY[i]! - DH[i]! / 2 <= floor) {
        DY[i] = floor + DH[i]! / 2;
        if (DVY[i]! < -18) (DVY[i] = -DVY[i]! * 0.3), (DVX[i] = DVX[i]! * 0.6), (DVA[i] = DVA[i]! * -0.5);
        else {
          // Settle flat (a half turn either way).
          const flat = Math.round(DA[i]! / Math.PI) * Math.PI;
          (DA[i] = flat), (DVX[i] = 0), (DVY[i] = 0), (DVA[i] = 0), (DREST[i] = 1);
        }
      }
    }
    return busy || (mode === CRASH && S[CRT]! < 1.2);
  }
  return { S, I, ev, step, W: W_, H: H_, OX, SB, LB, DX, DY, DA, DW, DH, DL, DON, at };
}
export type PerfectFit = ReturnType<typeof perfectFit>;

export type FitScene = SlotScene & { engine: ReturnType<typeof createEngine>; run: PerfectFit; poster(): void; readonly state: { mode: number; height: number; best: number; tilt: number } };

// Colour slots (--pf-*): light and dark.
const WALL = 0, FLOOR = 1, INK = 2, PAPER = 3, CARD = 4, TAPE = 5, TABLE = 6, HOT = 7, GOLD = 8, SYS = 9, SHADE = 10, STAMP = 11, SKIN = 12, SHIRT = 13, MUTED = 14;
const VARS = ["wall", "floor", "ink", "paper", "card", "tape", "table", "hot", "gold", "sys", "shade", "stamp", "skin", "shirt", "muted"];
const STRIPE = ["#ff2e88", "#ff8a1f", "#ffc21a", "#19f0ff", "#9a63ff", "#39ffb0"];
const NUMS = Array.from({ length: MAX + 1 }, (_, i) => String(i));
const FONT = Array.from({ length: 14 }, (_, i) => `900 ${i}px ui-monospace, SFMono-Regular, Menlo, monospace`);

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FitScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const skin = slot.querySelector<HTMLElement>("[data-pf]") ?? stage;
  const col = ["#1d1738", "#3b3170", "#07060f", "#f6f3ff", "#c8894a", "#e0b070", "#39ffb0", "#ff2e88", "#ffc21a", "#19f0ff", "rgba(7,6,15,.4)", "#ff2e88", "#ffd2a8", "#9a63ff", "#aea4d6"];
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.setAttribute("aria-label", "Perfect Fit: ← → lean to keep the stack balanced; Space or Enter starts (M mutes)");
  play.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;outline-offset:-4px";
  stage.append(canvas, play);
  const snd = sound(engine, { cues: { start: "ready", land: "click", miss: "hurt", crash: "end", best: "win" }, volume: 0.1 });
  const I: Inputs = new Float64Array(2);
  const run = perfectFit((engine.random() * 2147483647) | 0, I);
  const S = run.S;
  if (first) I[1] = 1;
  // Keys: ← → (A D) lean, Space / Enter starts, M mutes. A press and drag leans toward the finger.
  const K = new Float64Array(3); // left held, right held, pointer lean (NaN off)
  K[2] = NaN;
  const lean = () => ((I[0] = K[2] === K[2] ? K[2]! : K[1]! - K[0]!), engine.wake());
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (c === "KeyM") return void (e.preventDefault(), (snd.on = !snd.on));
    if (c === "ArrowLeft" || c === "KeyA") K[0] = 1;
    else if (c === "ArrowRight" || c === "KeyD") K[1] = 1;
    else if (c === "Space" || c === "Enter") !e.repeat && (I[1] = I[1]! + 1);
    else return;
    e.preventDefault();
    lean();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const c = e.code;
    if (c === "ArrowLeft" || c === "KeyA") K[0] = 0;
    else if (c === "ArrowRight" || c === "KeyD") K[1] = 0;
    lean();
  }, sig);
  const drag = (e: PointerEvent) => {
    const r = play.getBoundingClientRect();
    const v = ((e.clientX - r.left) / r.width - 0.5) * 4;
    K[2] = v > 1 ? 1 : v < -1 ? -1 : v;
    lean();
  };
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture?.(e.pointerId);
    if (S[0] !== PLAY) I[1] = I[1]! + 1;
    else drag(e);
  }, sig);
  play.addEventListener("pointermove", (e) => K[2] === K[2] && e.isPrimary && drag(e), sig);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) play.addEventListener(t, () => ((K[2] = NaN), lean()), sig);

  // [0] measure, [1] px per unit, [2] poster resolution, [3] view height (units), [4] css aspect.
  const V = new Float64Array(5);
  V[0] = 1;
  V[3] = 100;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  engine.add({
    read() {
      if (!V[0]) return;
      V[0] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[4] = r.width / Math.max(1, r.height);
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue("--pf-" + VARS[i]).trim() || col[i]!;
    },
    step(e, dt) {
      if (run.step(dt)) e.busy();
      // The camera pulls back as the stack grows.
      const want = Math.max(100, HANDS + S[6]! + 40);
      if (Math.abs(want - V[3]!) > 0.05) (V[3] = V[3]! + (want - V[3]!) * (1 - Math.exp(-3 * dt))), e.busy();
      const ev = run.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_CRASH]) e.events.emit("crash");
      else if (ev[EV_BEST]) e.events.emit("best");
      else if (ev[EV_MISS]) e.events.emit("miss");
      else if (ev[EV_LAND]) e.events.emit("land");
    },
    render() {
      const vh = V[3]!, k = canvas.height / vh, vw = canvas.width / k, t = S[1]!, mode = S[0]!;
      // World units: x from the centre, y up from the floor (the floor sits 8% up the stage).
      g.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height - vh * 0.08 * k);
      g.lineJoin = g.lineCap = "round";
      g.fillStyle = col[WALL]!;
      g.fillRect(-vw / 2, -vh, vw, vh * 1.1);
      g.fillStyle = col[FLOOR]!;
      g.fillRect(-vw / 2, -14, vw, vh);
      g.fillStyle = col[SHADE]!;
      g.fillRect(-vw / 2, -14, vw, 0.8);
      // The sprint board on the wall: three columns of stickies, every one of them in DONE but one.
      const bx = vw * 0.3 - 15;
      if (vw > 120) {
      g.fillStyle = col[PAPER]!;
      g.fillRect(bx, -62, 30, 20);
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.5;
      g.strokeRect(bx, -62, 30, 20);
      g.fillStyle = col[MUTED]!;
      g.fillRect(bx + 10, -60, 0.3, 16), g.fillRect(bx + 20, -60, 0.3, 16);
      g.font = FONT[2]!;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = col[INK]!;
      g.fillText("TODO", bx + 5, -59.6), g.fillText("DOING", bx + 15, -59.6), g.fillText("DONE", bx + 25, -59.6);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = STRIPE[i % 6]!;
        g.fillRect(i ? bx + 21.5 + (i % 2) * 4 : bx + 2.5, -57 + (i ? ((i - 1) >> 1) * 3.6 : 0), 3, 2.6);
      }
      }
      // Behind: two teammates and a table-tennis table, a rally that never ends (while anything moves).
      const ps = vw < 120 ? vw / 120 : 1;
      g.save();
      g.translate(-vw * 0.3, -14);
      g.scale(ps, ps);
      pong(0, t);
      g.restore();
      // The developer, and the stack in his hands.
      const th = S[2]!, n = S[5]!, hx = S[4]! * 6, wob = mode === PLAY ? Math.min(2.2, n * 0.12) * Math.sin(t * (14 + n)) : 0;
      dev(hx, wob, mode === CRASH);
      if (n >= 0) {
        g.save();
        g.translate(hx, -HANDS);
        g.rotate(th);
        item(0, -BASE_H / 2, BASE_W, BASE_H, 255);
        for (let i = 0; i < n; i++) item(run.OX[i]!, -(run.SB[i]! + run.H[i]! / 2), run.W[i]!, run.H[i]!, run.LB[i]!);
        g.restore();
      }
      // The falling one, and every loose piece.
      if (S[15]) item(S[8]!, -(S[9]! + S[13]! / 2), S[12]!, S[13]!, S[14]!);
      for (let i = 0; i < run.DON.length; i++) {
        if (!run.DON[i]) continue;
        g.save();
        g.translate(run.DX[i]!, -run.DY[i]!);
        g.rotate(run.DA[i]!);
        item(0, 0, run.DW[i]!, run.DH[i]!, run.DL[i]!);
        g.restore();
      }
      // Stickers: height and best (top left, in stage space).
      g.setTransform(canvas.height / 100, 0, 0, canvas.height / 100, 0, 0);
      chip(3, 3, "HEIGHT", NUMS[n > 0 ? n : 0]!, col[SYS]!);
      chip(3, 12.5, "BEST", NUMS[S[16]!]!, col[GOLD]!);
      const cx = (V[4]! * 100) / 2;
      if (mode === IDLE) {
        caption("PERFECT FIT", cx, 30, 9, col[PAPER]!);
        caption("← → OR DRAG TO BALANCE · TAP TO START", cx, 38, 3, col[GOLD]!);
      }
      if (mode === CRASH && S[17]! > 0.35) {
        // The stamp slams in.
        const s = S[17]! < 0.5 ? 2.2 - (S[17]! - 0.35) * 8 : 1;
        g.save();
        g.translate(cx, 34);
        g.rotate(-0.16);
        g.scale(s, s);
        g.font = FONT[7]!;
        g.textAlign = "center";
        g.textBaseline = "middle";
        const w = g.measureText("REASSIGNED TO YOU").width + 8, fit = (cx * 1.8) / w;
        if (fit < 1) g.scale(fit, fit);
        g.globalAlpha = 0.92;
        g.fillStyle = col[PAPER]!;
        g.fillRect(-w / 2, -6.5, w, 13);
        g.strokeStyle = col[STAMP]!;
        g.lineWidth = 1.4;
        g.strokeRect(-w / 2, -6.5, w, 13);
        g.strokeRect(-w / 2 + 1.6, -4.9, w - 3.2, 9.8);
        g.fillStyle = col[STAMP]!;
        g.fillText("REASSIGNED TO YOU", 0, 0.5);
        g.restore();
        g.globalAlpha = 1;
        if (S[17]! > 1) caption("TAP TO START OVER", cx, 48, 4, col[PAPER]!);
      }
    },
  });
  function caption(s: string, x: number, y: number, size: number, fill: string) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = FONT[size]!;
    g.lineWidth = size / 3;
    g.strokeStyle = col[INK]!;
    g.strokeText(s, x, y);
    g.fillStyle = fill;
    g.fillText(s, x, y);
  }
  function chip(x: number, y: number, label: string, v: string, c: string) {
    g.font = FONT[3]!;
    const w = 7 + g.measureText(label).width + 2 + v.length * 4.4;
    g.fillStyle = col[INK]!;
    g.fillRect(x + 0.8, y + 0.8, w, 8);
    g.fillStyle = col[PAPER]!;
    g.fillRect(x, y, w, 8);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.6;
    g.strokeRect(x, y, w, 8);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = col[INK]!;
    g.fillText(label, x + 2.4, y + 4.3);
    g.font = FONT[6]!;
    g.fillStyle = c;
    g.strokeText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
    g.fillText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
  }
  /** A ticket (paper, a priority stripe, a folded corner) or a box (cardboard, tape, a label). 255: his box. */
  function item(x: number, y: number, w: number, h: number, l: number) {
    const box = l === 255 || (l & 1) === 1;
    g.fillStyle = col[SHADE]!;
    g.fillRect(x - w / 2 + 0.7, y - h / 2 + 0.7, w, h);
    g.fillStyle = box ? col[CARD]! : col[PAPER]!;
    g.fillRect(x - w / 2, y - h / 2, w, h);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.5;
    g.strokeRect(x - w / 2, y - h / 2, w, h);
    if (box) {
      g.fillStyle = col[TAPE]!;
      g.fillRect(x - 1, y - h / 2, 2, h);
    } else {
      g.fillStyle = STRIPE[l % 6]!;
      g.fillRect(x - w / 2, y - h / 2, 1.4, h);
      g.fillStyle = col[MUTED]!;
      g.beginPath();
      g.moveTo(x + w / 2 - 2, y - h / 2), g.lineTo(x + w / 2, y - h / 2 + 2), g.lineTo(x + w / 2 - 2, y - h / 2 + 2);
      g.fill();
    }
    const s = l === 255 ? "MY TASK" : LABELS[l]!;
    g.font = FONT[box ? 2 : 2]!;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const tw = g.measureText(s).width;
    if (box) {
      g.fillStyle = col[PAPER]!;
      g.fillRect(x - tw / 2 - 0.8, y - 1.5, tw + 1.6, 3);
    }
    g.fillStyle = l === 255 ? col[HOT]! : col[INK]!;
    g.save();
    g.translate(x + (box ? 0 : 0.6), y + 0.2);
    if (tw > w - 3) g.scale((w - 3) / tw, 1);
    g.fillText(s, 0, 0);
    g.restore();
  }
  /** The best developer: a stick figure, arms up under the stack; the knees shake as it grows. */
  function dev(hx: number, wob: number, down: boolean) {
    g.strokeStyle = col[INK]!;
    g.fillStyle = col[SHADE]!;
    g.beginPath();
    g.ellipse(hx * 0.4, 0, 9, 1.4, 0, 0, TAU);
    g.fill();
    const lean = hx * 0.5;
    g.lineWidth = 1.5;
    g.beginPath();
    // Legs: knees out, shaking.
    g.moveTo(-4, 0), g.quadraticCurveTo(-4.5 + wob, -7, lean * 0.4 - 1.5, -13);
    g.moveTo(4, 0), g.quadraticCurveTo(4.5 - wob, -7, lean * 0.4 + 1.5, -13);
    // Arms: up to the hands, or flung out in the crash.
    if (down) g.moveTo(lean - 1.5, -22), g.lineTo(lean - 9, -28), g.moveTo(lean + 1.5, -22), g.lineTo(lean + 9, -28);
    else g.moveTo(lean - 1.5, -22), g.lineTo(hx - 7, -HANDS + 0.5), g.moveTo(lean + 1.5, -22), g.lineTo(hx + 7, -HANDS + 0.5);
    g.stroke();
    // A plain shirt with a lanyard badge.
    g.fillStyle = col[SHIRT]!;
    g.lineWidth = 0.6;
    g.beginPath();
    g.roundRect(lean * 0.7 - 3.2, -24, 6.4, 11.5, 2);
    g.fill();
    g.stroke();
    g.fillStyle = col[PAPER]!;
    g.fillRect(lean * 0.7 - 0.2, -19, 2.6, 3);
    g.strokeRect(lean * 0.7 - 0.2, -19, 2.6, 3);
    g.fillStyle = col[GOLD]!;
    g.fillRect(lean * 0.7 + 0.4, -18.2, 1.4, 1.2);
    // Head, eyes up at the stack (or shut tight in the crash), and sweat once it's tall.
    const hy = -27.5;
    g.fillStyle = col[SKIN]!;
    g.beginPath();
    g.arc(lean, hy, 3.4, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = col[INK]!;
    if (down) g.fillRect(lean - 1.9, hy - 0.6, 1.4, 0.5), g.fillRect(lean + 0.5, hy - 0.6, 1.4, 0.5);
    else g.fillRect(lean - 1.5, hy - 1.6, 0.8, 0.9), g.fillRect(lean + 0.8, hy - 1.6, 0.8, 0.9);
    g.beginPath();
    if (down) g.arc(lean, hy + 1.6, 0.9, 0, TAU);
    else g.moveTo(lean - 1, hy + 1.4), g.lineTo(lean + 1, hy + 1.2 + wob * 0.15);
    g.lineWidth = 0.5;
    down ? g.fill() : g.stroke();
    if (S[5]! > 6 && !down) {
      g.fillStyle = col[SYS]!;
      g.beginPath();
      g.arc(lean + 4.2, hy - 1 + ((S[1]! * 6) % 4), 0.7, 0, TAU);
      g.fill();
    }
  }
  /** Two tiny teammates and a table: the ball pings across forever (it only moves while the piece does). */
  function pong(x: number, t: number) {
    const s = 0.42, y = -2, ph = (t * 1.1) % 2, u = ph < 1 ? ph : 2 - ph, bx = x - 11 + u * 22, by = y - 12 - Math.abs(Math.sin(u * Math.PI)) * 6;
    g.fillStyle = col[TABLE]!;
    g.fillRect(x - 12, y - 8, 24, 1.6);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.4;
    g.strokeRect(x - 12, y - 8, 24, 1.6);
    g.fillStyle = col[INK]!;
    g.fillRect(x - 10, y - 6.4, 0.6, 6.4), g.fillRect(x + 9.4, y - 6.4, 0.6, 6.4), g.fillRect(x - 0.2, y - 10.4, 0.4, 2.4);
    for (let p = -1; p <= 1; p += 2) {
      const px = x + p * 16, sw = (p < 0 ? u < 0.15 : u > 0.85) ? -p * 2.4 : 0;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(px - 1.2, y), g.lineTo(px, y - 8 * s * 2), g.lineTo(px + 1.2, y);
      g.moveTo(px, y - 8 * s * 2), g.lineTo(px, y - 13);
      g.moveTo(px, y - 11), g.lineTo(px - p * 2.4 + sw, y - 10.2);
      g.stroke();
      g.fillStyle = col[MUTED]!;
      g.beginPath();
      g.arc(px, y - 14.4, 1.5, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = col[HOT]!;
      g.beginPath();
      g.arc(px - p * 3 + sw, y - 10.4, 0.9, 0, TAU);
      g.fill();
    }
    g.fillStyle = col[PAPER]!;
    g.beginPath();
    g.arc(bx, by, 0.55, 0, TAU);
    g.fill();
  }

  engine.start();
  return {
    engine,
    accessible: true,
    run,
    get state() {
      return { mode: S[0]!, height: S[5]! < 0 ? 0 : S[5]!, best: S[16]!, tilt: S[2]! };
    },
    poster: () => ((V[2] = 0.6), (V[0] = 1)),
    destroy: () => engine.destroy(),
  };
}
/** The poster: the empty-handed start (scripts/gallery-posters.mjs). */
export const posterAt = 0.5;
