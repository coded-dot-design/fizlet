// "Wishbone" (thanksgiving, micro): two hands, one wishbone. Tap (or Space) and both pinch an end;
// the tension meter sweeps. Tap again at the sweet spot to pull: the bone cracks, chips fly and
// bounce on the table, and whoever holds the bigger half (the one with the knob) gets the wish.
// Dead centre of the sweet spot is a GOLDEN WISH. Miss it and the break comes on your side: NEXT
// YEAR. Wait too long and the other hand pulls first. Each win grows the streak; the sweet spot
// narrows and the needle quickens as it grows.
// Bricks: the kernel (fixed step; settle; its ledger for the canvas and the play key, so Recall
// gives the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The game is `wishbone()`,
// plain numbers, no DOM (tests/wishbone.test.mjs: a pull in the spot wins with the knob, outside
// it loses, waiting loses, chips come to rest on the table, steps allocate nothing).
import { createEngine } from "../../../src/kernel/index";
import { seeded } from "../../../src/kernel/random";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

export const IDLE = 0, SWEEP = 1, SNAP = 2;
/** The table's top (world y; the view is 100 tall, 0 at its middle), the chips, the sweeps allowed. */
export const TABLE = 30, NC = 28, PATIENCE = 6;
export const EV_GRAB = 0, EV_PULL = 1, EV_WIN = 2, EV_LOSE = 3, EV_GOLD = 4;
// State slots.
const MODE = 0, T = 1, P = 2, DIR = 3, SPD = 4, C = 5, W = 6, BOUNCE = 7, UB = 8, WIN = 9, GOLD = 10, RT = 11, STREAK = 12, BEST = 13, HL = 14, HLV = 15, HR = 16, HRV = 17, SLOW = 18;

/** One table. `I[0]`: presses since the last step. */
export function wishbone(seed: number, I: Float64Array) {
  const R = seeded(seed), S = new Float64Array(20), ev = new Uint8Array(5);
  // Chips: x, y, vx, vy, angle, spin, size, on.
  const CX = new Float64Array(NC), CY = new Float64Array(NC), CVX = new Float64Array(NC), CVY = new Float64Array(NC), CA = new Float64Array(NC), CVA = new Float64Array(NC), CS = new Float64Array(NC), CON = new Uint8Array(NC);
  function grab() {
    (S[MODE] = SWEEP), (S[P] = 0), (S[DIR] = 1), (S[BOUNCE] = 0), (S[HL] = S[HLV] = S[HR] = S[HRV] = 0), (S[SLOW] = 0);
    const n = S[STREAK]!;
    (S[SPD] = 0.75 + Math.min(n, 10) * 0.09), (S[W] = Math.max(0.07, 0.18 - n * 0.012)), (S[C] = 0.3 + R() * 0.55);
    CON.fill(0);
    ev[EV_GRAB] = 1;
  }
  /** The pull: how far from the spot's centre (in half-widths) picks where it breaks. */
  function pull(slow: boolean) {
    const d = slow ? 9 : Math.abs(S[P]! - S[C]!) / (S[W]! / 2), win = d <= 1;
    (S[MODE] = SNAP), (S[RT] = 0), (S[WIN] = win ? 1 : 0), (S[GOLD] = d < 0.25 ? 1 : 0), (S[SLOW] = slow ? 1 : 0);
    // −1 is the left (their) tip, 0 the knob, 1 your tip; the half with the knob wins. It breaks near
    // the middle, so both halves read: the winner holds 55% of the bone at the spot's edge, 65% dead
    // centre (u −0.068 to −0.249 along the V); a loss mirrors it, 55% just outside to 65% way off.
    S[UB] = win ? -(0.068 + 0.181 * (1 - d)) : 0.068 + 0.181 * Math.min(1, (d - 1) / 3);
    S[STREAK] = win ? S[STREAK]! + 1 : 0;
    if (S[STREAK]! > S[BEST]!) S[BEST] = S[STREAK]!;
    // The hands fly apart; the winner's further.
    (S[HLV] = -(win ? 70 : 95)), (S[HRV] = win ? 95 : 70);
    const bx = boneX(S[UB]!), by = boneY(S[UB]!);
    for (let i = 0; i < NC; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = 25 + R() * 45;
      (CX[i] = bx), (CY[i] = by), (CVX[i] = Math.cos(a) * v), (CVY[i] = Math.sin(a) * v), (CA[i] = R() * 6), (CVA[i] = (R() - 0.5) * 30), (CS[i] = 0.5 + R() * 1.1), (CON[i] = 1);
    }
    ev[EV_PULL] = 1;
    ev[win ? EV_WIN : EV_LOSE] = 1;
    if (S[GOLD]) ev[EV_GOLD] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const press = I[0]! > 0;
    I[0] = 0;
    const mode = S[MODE]!;
    if (press && (mode === IDLE || (mode === SNAP && S[RT]! > 0.7))) return grab(), true;
    if (press && mode === SWEEP) return pull(false), true;
    let busy = mode === SWEEP;
    if (mode === SWEEP) {
      let p = S[P]! + S[DIR]! * S[SPD]! * dt;
      if (p > 1 || p < 0) (p = p > 1 ? 2 - p : -p), (S[DIR] = -S[DIR]!), (S[BOUNCE] = S[BOUNCE]! + 1);
      S[P] = p;
      if (S[BOUNCE]! >= PATIENCE) pull(true);
    }
    if (mode === SNAP) {
      S[RT] = S[RT]! + dt;
      // The hands spring back after the jolt.
      for (let k = HL; k <= HR; k += 2) {
        S[k + 1] = S[k + 1]! + (-S[k]! * 60 - S[k + 1]! * 9) * dt;
        S[k] = S[k]! + S[k + 1]! * dt;
        if (Math.abs(S[k]!) + Math.abs(S[k + 1]!) > 0.02) busy = true;
        else S[k] = S[k + 1] = 0;
      }
      // Chips: fall, bounce on the table, slide to a stop.
      for (let i = 0; i < NC; i++) {
        if (!CON[i]) continue;
        busy = true;
        CVY[i] = CVY[i]! + 160 * dt;
        CX[i] = CX[i]! + CVX[i]! * dt;
        CY[i] = CY[i]! + CVY[i]! * dt;
        CA[i] = CA[i]! + CVA[i]! * dt;
        if (CY[i]! > TABLE - CS[i]! * 0.5 && CVY[i]! > 0) {
          CY[i] = TABLE - CS[i]! * 0.5;
          CVY[i] = -CVY[i]! * 0.42;
          CVX[i] = CVX[i]! * 0.6;
          CVA[i] = CVA[i]! * 0.5;
          if (CVY[i]! > -8) (CVY[i] = CVX[i] = CVA[i] = 0), (CON[i] = 0);
        }
      }
      if (S[RT]! < 1) busy = true;
    }
    return busy;
  }
  return { S, I, ev, step, CX, CY, CA, CS, CON };
}
export type Wishbone = ReturnType<typeof wishbone>;

/** The bone, at u (−1 their tip, 0 the knob, 1 yours): a wide V, in world units. */
export const boneX = (u: number) => u * 24;
export const boneY = (u: number) => -14 + Math.abs(u) ** 0.8 * 30;

export type WishScene = SlotScene & { engine: ReturnType<typeof createEngine>; run: Wishbone; poster(): void; readonly state: { mode: number; streak: number; best: number; win: number } };

const LIGHT = ["#f6eedf", "#e8a86a", "#d98f55", "#fffaf1", "#1f2433", "#f3e6c8", "#5b6bbf", "#f08e6f", "#c98d6a", "#f1c7a3", "#2f8f83", "#f2c450", "#8a8fa3", "#fbe3cf"];
const DARK = ["#1b1f33", "#7a4a35", "#6a3f2d", "#e9e1d0", "#0c0e18", "#efe0bd", "#5b6bbf", "#f08e6f", "#b07a58", "#e3b58f", "#39c4a8", "#f2c450", "#8a8fa3", "#3a3149"];
const BG = 0, CLOTH = 1, CLOTH2 = 2, PLATE = 3, INK = 4, BONE = 5, THEIRS = 6, YOURS = 7, SKIN0 = 8, SKIN1 = 9, GO = 10, GOLDC = 11, MUTED = 12, WALL2 = 13;
const FONT = Array.from({ length: 16 }, (_, i) => `900 ${i}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`);
const NUMS = Array.from({ length: 100 }, (_, i) => String(i));

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): WishScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.setAttribute("aria-label", "Wishbone: Space or Enter grabs the bone, then pulls at the sweet spot of the tension meter (M mutes)");
  play.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline-offset:-4px";
  stage.append(canvas, play);
  const snd = sound(engine, { cues: { grab: "ready", crack: "hit", win: "win", lose: "end", gold: "power" }, volume: 0.1 });
  const I = new Float64Array(1);
  const run = wishbone((engine.random() * 2147483647) | 0, I), S = run.S;
  if (first) I[0] = 1;
  const press = () => ((I[0] = 1), engine.wake());
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), (snd.on = !snd.on));
    if ((e.code === "Space" || e.code === "Enter") && !e.repeat) e.preventDefault(), press();
  }, sig);
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    press();
  }, sig);

  // [0] measure, [1] theme, [2] poster resolution, [3] css aspect.
  const V = new Float64Array(4);
  V[0] = V[1] = 1;
  let col = DARK;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  engine.add({
    read() {
      if (V[1]) (V[1] = 0), (col = document.documentElement.dataset.theme === "light" ? LIGHT : DARK);
      if (!V[0]) return;
      V[0] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[3] = r.width / Math.max(1, r.height);
    },
    step(e, dt) {
      if (run.step(dt)) e.busy();
      const ev = run.ev;
      if (ev[EV_GRAB]) e.events.emit("grab");
      if (ev[EV_PULL]) e.events.emit("crack");
      if (ev[EV_GOLD]) e.events.emit("gold");
      else if (ev[EV_WIN]) e.events.emit("win");
      else if (ev[EV_LOSE]) e.events.emit("lose");
    },
    render() {
      const k = canvas.height / 100, vw = canvas.width / k, hw = vw / 2, mode = S[MODE]!, t = S[T]!, rt = S[RT]!;
      // World: x from the centre, y down from the middle; the camera kicks on the crack.
      const kick = mode === SNAP && rt < 0.25 ? (0.25 - rt) * 8 * Math.sin(rt * 90) : 0;
      g.setTransform(k, 0, 0, k, canvas.width / 2 + kick * k, canvas.height / 2 + kick * 0.5 * k);
      g.lineJoin = g.lineCap = "round";
      // The wall, a stripe of wallpaper, the table with its cloth and a plate.
      g.fillStyle = col[BG]!;
      g.fillRect(-hw - 4, -54, vw + 8, 110);
      g.fillStyle = col[WALL2]!;
      for (let x = -hw - (hw % 12); x < hw + 6; x += 12) g.fillRect(x, -54, 5, 54 + TABLE - 14);
      g.fillStyle = col[CLOTH]!;
      g.fillRect(-hw - 4, TABLE - 16, vw + 8, 80);
      g.fillStyle = col[CLOTH2]!;
      for (let x = -hw - (hw % 16); x < hw + 8; x += 16) g.fillRect(x, TABLE - 16, 8, 80);
      g.fillStyle = col[INK]!;
      g.fillRect(-hw - 4, TABLE - 16, vw + 8, 1);
      g.globalAlpha = 0.18;
      g.beginPath();
      g.ellipse(0, TABLE + 1, 30, 4.5, 0, 0, 6.3);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = col[PLATE]!;
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.8;
      g.beginPath();
      g.ellipse(0, TABLE - 1, 28, 5, 0, 0, 6.3);
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(0, TABLE - 1, 20, 3.2, 0, 0, 6.3);
      g.stroke();
      // Tension: the bone bends as the needle climbs, the hands shake near the top.
      const ten = mode === SWEEP ? S[P]! : 0, shake = mode === SWEEP ? ten * ten * 0.6 * Math.sin(t * 70) : 0;
      // After the crack the winner holds the big half up; the other hand's stub droops.
      const ub = S[UB]!, up = mode === SNAP ? Math.min(1, rt * 4) : 0, dyL = up * (ub > 0 ? -8 : 5), dyR = up * (ub < 0 ? -8 : 5);
      if (mode !== SNAP) {
        bone(-1, 1, 0, 0, ten * 3, shake, false);
      } else {
        // Two halves, each with its hand: theirs [−1, ub], yours [ub, 1].
        bone(-1, ub, S[HL]!, dyL, 0, 0, true);
        bone(ub, 1, S[HR]!, dyR, 0, 0, true);
        if (rt < 0.16) {
          // The crack: a flash of lines at the break.
          const bx = boneX(ub) + (ub < 0 ? S[HL]! : S[HR]!), by = boneY(ub);
          g.strokeStyle = col[GOLDC]!;
          g.lineWidth = 1.2;
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = i * 0.785 + 0.3;
            g.moveTo(bx + Math.cos(a) * 4, by + Math.sin(a) * 4), g.lineTo(bx + Math.cos(a) * 11, by + Math.sin(a) * 11);
          }
          g.stroke();
        }
      }
      const pull = mode === SNAP ? 0 : ten * 3;
      hand(-1, boneX(-1) - pull + (mode === SNAP ? S[HL]! : -shake), boneY(-1) + dyL, col[THEIRS]!, col[SKIN0]!);
      hand(1, boneX(1) + pull + (mode === SNAP ? S[HR]! : shake), boneY(1) + dyR, col[YOURS]!, col[SKIN1]!);
      // Chips.
      g.fillStyle = col[BONE]!;
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.4;
      for (let i = 0; i < NC; i++) {
        if (mode !== SNAP) break;
        const s = run.CS[i]!;
        g.save();
        g.translate(run.CX[i]!, run.CY[i]!);
        g.rotate(run.CA[i]!);
        g.beginPath();
        g.moveTo(-s, -s * 0.5), g.lineTo(s, -s * 0.7), g.lineTo(s * 0.4, s * 0.7);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      // Stage space: the stickers, the meter, the words.
      const sk = canvas.height / 100;
      g.setTransform(sk, 0, 0, sk, 0, 0);
      // On a narrow stage the words sit under the stickers.
      const W2 = V[3]! * 100, cx = W2 / 2, ty = W2 < 120 ? 31 : 20;
      chip(3, 3, "STREAK", NUMS[Math.min(99, S[STREAK]!)]!, col[GO]!);
      chip(3, 12.5, "BEST", NUMS[Math.min(99, S[BEST]!)]!, col[GOLDC]!);
      if (mode === SWEEP || mode === SNAP) meter(cx, 86, Math.min(56, W2 * 0.7));
      if (mode === IDLE) {
        caption("WISHBONE", cx, ty + 2, Math.min(11, W2 / 7), col[PLATE]!);
        caption("TAP TO GRAB AN END", cx, ty + 11, 4, col[GOLDC]!);
      } else if (mode === SWEEP) caption("PULL IN THE SWEET SPOT", cx, 76, 4, col[PLATE]!);
      else if (rt > 0.12) {
        const s = rt < 0.3 ? 1.35 - (rt - 0.12) * 1.95 : 1, w = S[WIN]!;
        g.save();
        g.translate(cx, ty);
        g.rotate(-0.06);
        g.scale(s, s);
        caption(S[GOLD] ? "GOLDEN WISH!" : w ? "WISH GRANTED" : S[SLOW] ? "TOO SLOW!" : "NEXT YEAR", 0, 0, Math.min(10, W2 / 11.5), w ? col[GOLDC]! : col[PLATE]!);
        g.restore();
        if (rt > 0.7) caption(w ? "TAP FOR ANOTHER" : "TAP TO TRY AGAIN", cx, ty + 10, 3.6, col[PLATE]!);
      }
    },
  });
  /** One stretch of the bone, u0..u1, moved by dx, its tips spread by `spread`; `broken`: jagged ends. */
  function bone(u0: number, u1: number, dx: number, dy: number, spread: number, shake: number, broken: boolean) {
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = u0 + ((u1 - u0) * i) / 24, x = boneX(u) + dx + u * spread + (u > 0 ? shake : -shake) * Math.abs(u), y = boneY(u) + dy;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = col[INK]!;
    g.lineWidth = 5.6;
    g.stroke();
    g.strokeStyle = col[BONE]!;
    g.lineWidth = 3.8;
    g.stroke();
    // The knob, where the two arms meet.
    if (u0 <= 0 && u1 >= 0) {
      g.fillStyle = col[BONE]!;
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.9;
      g.beginPath();
      g.ellipse(dx, boneY(0) - 1.6 + dy, 4.2, 3, 0, 0, 6.3);
      g.fill();
      g.stroke();
    }
    if (broken) {
      const ub = u0 === -1 ? u1 : u0, x = boneX(ub) + dx, y = boneY(ub) + dy, d = u0 === -1 ? 1 : -1;
      g.fillStyle = col[BONE]!;
      g.beginPath();
      g.moveTo(x - d * 0.4, y - 2.2), g.lineTo(x + d * 1.4, y - 0.8), g.lineTo(x, y), g.lineTo(x + d * 1.2, y + 1), g.lineTo(x - d * 0.4, y + 2.2);
      g.fill();
      g.lineWidth = 0.6;
      g.stroke();
    }
  }
  /** A hand from the side: a sleeve to the edge, a cuff, a fist, thumb and finger pinching the tip. */
  function hand(s: number, x: number, y: number, sleeve: string, skin: string) {
    g.save();
    g.translate(x, y);
    g.scale(s, 1);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.9;
    // Sleeve, cuff and a button.
    g.fillStyle = col[INK]!;
    g.fillRect(16, 2.2, 140, 11);
    g.fillStyle = sleeve;
    g.fillRect(15, 1, 140, 11);
    g.strokeRect(15, 1, 140, 11);
    g.fillStyle = col[PLATE]!;
    g.fillRect(12, 0.5, 4.5, 12);
    g.strokeRect(12, 0.5, 4.5, 12);
    // The fist: palm and three curled fingers under the pinch.
    g.fillStyle = skin;
    g.beginPath();
    g.roundRect(2, -1.5, 11, 12, 4);
    g.fill();
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 3; i++) g.moveTo(2.4, 3.6 + i * 2.4), g.lineTo(5.2, 3.6 + i * 2.4);
    g.stroke();
    // Index finger over the tip, thumb under it.
    g.beginPath();
    g.roundRect(-2.4, -3.2, 8.4, 3.4, 1.7);
    g.fill();
    g.stroke();
    g.beginPath();
    g.roundRect(-1.6, 1.4, 7.4, 3, 1.5);
    g.fill();
    g.stroke();
    g.restore();
  }
  /** The tension meter: a track, the sweet spot (the gold centre), the needle. */
  function meter(cx: number, y: number, w: number) {
    const x0 = cx - w / 2, c = S[C]!, sw = S[W]!;
    g.fillStyle = col[INK]!;
    g.fillRect(x0 + 0.8, y + 0.8, w, 5);
    g.fillStyle = col[PLATE]!;
    g.fillRect(x0, y, w, 5);
    g.fillStyle = col[GO]!;
    g.fillRect(x0 + (c - sw / 2) * w, y, sw * w, 5);
    g.fillStyle = col[GOLDC]!;
    g.fillRect(x0 + (c - sw / 8) * w, y, (sw / 4) * w, 5);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.strokeRect(x0, y, w, 5);
    const nx = x0 + S[P]! * w;
    g.fillStyle = col[INK]!;
    g.beginPath();
    g.moveTo(nx - 2, y - 3), g.lineTo(nx + 2, y - 3), g.lineTo(nx + 0.6, y + 6.5), g.lineTo(nx - 0.6, y + 6.5);
    g.fill();
    g.font = FONT[3]!;
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText("TENSION", x0, y + 6.6);
  }
  function caption(s: string, x: number, y: number, size: number, fill: string) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${size}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;
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
    g.fillStyle = col[PLATE]!;
    g.fillRect(x, y, w, 8);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.6;
    g.strokeRect(x, y, w, 8);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = col[INK]!;
    g.fillText(label, x + 2.4, y + 4.3);
    g.font = FONT[6]!;
    g.lineWidth = 1.2;
    g.fillStyle = c;
    g.strokeText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
    g.fillText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
  }

  engine.start();
  return {
    engine,
    accessible: true,
    run,
    get state() {
      return { mode: S[MODE]!, streak: S[STREAK]!, best: S[BEST]!, win: S[WIN]! };
    },
    // The poster: a pull dead in the spot, a beat after the crack (chips in the air, the words up).
    poster: () => {
      (V[2] = 0.6), (V[0] = 1);
      I[0] = 1;
      run.step(1 / 30);
      S[P] = S[C]!;
      I[0] = 1;
    },
    destroy: () => engine.destroy(),
  };
}
/** The poster (scripts/gallery-posters.mjs): see `poster()`. */
export const posterAt = 0.32;
