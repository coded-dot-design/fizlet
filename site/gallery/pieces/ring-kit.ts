// Shared by the boxing minis: the ring. One canvas over the stage (art units: 160 across, 90 down),
// colours from the stage's own wrapper (light and dark), the crowd and the ropes, hit sparks and
// sweat, pop words, and the controls: real <button>s (44 px or more) and keys while focus is in the
// stage, M to mute. Sound is fizlet/sound: silent until a gesture. Nothing here writes the page
// outside the slot's stage (the canvas and the buttons go through the engine's ledger), so Recall
// gives the page back exactly. Steps allocate nothing.
import type { Engine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { Cue } from "../../../src/sound";

export const W = 160, H = 90, TAU = Math.PI * 2;
// Colour slots, read from the skin's --rg-* variables.
export const BACK = 0, CROWD = 1, MAT = 2, ROPE = 3, INK = 4, PAPER = 5, RED = 6, CYAN = 7, GOLD = 8, GO = 9, PURPLE = 10, PINK = 11, STEEL = 12;
const VARS = ["--rg-back", "--rg-crowd", "--rg-mat", "--rg-rope", "--rg-ink", "--rg-paper", "--rg-red", "--rg-cyan", "--rg-gold", "--rg-go", "--rg-purple", "--rg-pink", "--rg-steel"];

/** The canvas on `stage` with colours from `skin`; sparks; sound with `cues`. */
export function ring(engine: Engine, stage: HTMLElement, skin: HTMLElement, cues: Record<string, Cue>) {
  const R = engine.random;
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  // [0] w px, [1] h px, [2] dpr, [3] measure, [4] px per unit, [5] dark, [6] shake, [7] time, [8] resolution, [9] flash
  const V = new Float64Array(10);
  V[3] = 1;
  const col = ["#0c0a1c", "#2a1c4a", "#3f296a", "#ff2e88", "#07060f", "#f6f3ff", "#ff2b4e", "#19f0ff", "#ffc21a", "#39ffb0", "#9a63ff", "#ff7389", "#b9b4d6"];
  const ro = new ResizeObserver(() => ((V[3] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[3] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const snd = sound(engine, { cues, volume: 0.1 });
  // Sparks and sweat (a ring buffer): position, velocity, life left, life, size, colour.
  const P = 96;
  const PX = new Float32Array(P), PY = new Float32Array(P), PVX = new Float32Array(P), PVY = new Float32Array(P), PL = new Float32Array(P), PM = new Float32Array(P), PS = new Float32Array(P), PC = new Uint8Array(P);
  const n = new Uint32Array(1);
  const circ = (x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());
  const rr = (x: number, y: number, w: number, h: number, r: number) => (g.beginPath(), g.roundRect(x, y, w, h, r), g.fill());

  const k = {
    g, col, V, circ, rr, snd,
    read() {
      if (!V[3]) return false;
      V[3] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[8] || 1);
      (V[0] = r.width), (V[1] = r.height), (V[2] = dpr), (V[4] = r.width / W);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue(VARS[i]!).trim() || col[i]!;
      V[5] = cs.getPropertyValue("--rg-dark").trim() === "1" ? 1 : 0;
      return true;
    },
    poster() {
      (V[8] = 0.6), (V[3] = 1);
    },
    burst(x: number, y: number, count: number, speed: number, c: number, size = 1) {
      for (let j = 0; j < count; j++) {
        const i = n[0]! % P, a = R() * TAU, v = speed * (0.4 + R() * 0.6);
        n[0] = i + 1;
        (PX[i] = x), (PY[i] = y), (PVX[i] = Math.cos(a) * v), (PVY[i] = Math.sin(a) * v - speed * 0.3);
        PM[i] = PL[i] = 0.3 + R() * 0.35;
        (PS[i] = size * (0.6 + R() * 0.8)), (PC[i] = c);
      }
    },
    /** Sparks fly, the shake and the flash fade; true while any of it is alive. */
    step(dt: number) {
      V[7] = V[7]! + dt;
      V[6] = Math.max(0, V[6]! - dt * 3);
      V[9] = Math.max(0, V[9]! - dt * 4);
      let live = 0;
      for (let i = 0; i < P; i++) {
        if (PL[i]! <= 0) continue;
        PL[i] = PL[i]! - dt;
        PVY[i] = PVY[i]! + 50 * dt;
        PX[i] = PX[i]! + PVX[i]! * dt;
        PY[i] = PY[i]! + PVY[i]! * dt;
        live++;
      }
      return live > 0 || V[6]! > 0 || V[9]! > 0;
    },
    shake(s: number) {
      V[6] = Math.max(V[6]!, s);
    },
    flash(s: number) {
      V[9] = Math.max(V[9]!, s);
    },
    begin() {
      const s = V[4]! * V[2]!, sh = V[6]!;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.globalAlpha = 1;
      if (sh > 0) g.translate(Math.sin(V[7]! * 83) * sh * 1.4, Math.cos(V[7]! * 71) * sh);
    },
    /** The hall: the dark back, the crowd (camera flashes on a big hit), the mat, the back rope. */
    hall(cheer: number) {
      g.fillStyle = col[BACK]!;
      g.fillRect(-4, -4, W + 8, H + 8);
      for (let i = 0; i < 44; i++) {
        const x = (i * 23.7) % W, y = 12 + ((i * 7.3) % 12), bob = cheer > 0 ? Math.abs(Math.sin(V[7]! * 9 + i)) * cheer * 2 : 0;
        g.fillStyle = col[CROWD]!;
        circ(x, y - bob, 2.6);
        g.fillRect(x - 3, y + 1.6 - bob, 6, 6);
        if (cheer > 0.5 && (i * 7 + ((V[7]! * 12) | 0)) % 23 === 0) {
          g.fillStyle = col[PAPER]!;
          circ(x + 1.5, y - 1 - bob, 1.3);
        }
      }
      g.fillStyle = col[MAT]!;
      g.beginPath();
      g.moveTo(-4, 48), g.lineTo(W + 4, 48), g.lineTo(W + 4, H + 4), g.lineTo(-4, H + 4);
      g.fill();
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.25;
      g.fillRect(-4, 48, W + 8, 2);
      g.globalAlpha = 1;
      // Posts and the back ropes.
      g.fillStyle = col[STEEL]!;
      g.fillRect(6, 19, 3, 31);
      g.fillRect(151, 19, 3, 31);
      for (let r = 0; r < 3; r++) {
        g.fillStyle = col[r === 1 ? PAPER : ROPE]!;
        g.fillRect(8, 22 + r * 7, 144, 1.1);
      }
    },
    /** The front rope (over the fighters' feet). */
    front() {
      g.fillStyle = col[ROPE]!;
      g.fillRect(-4, 71, W + 8, 1.4);
      g.fillStyle = col[STEEL]!;
      g.fillRect(0, 54, 4, 36);
      g.fillRect(156, 54, 4, 36);
    },
    drawSparks() {
      for (let i = 0; i < P; i++) {
        if (PL[i]! <= 0) continue;
        g.globalAlpha = Math.min(1, (PL[i]! / PM[i]!) * 1.5);
        g.fillStyle = col[PC[i]!]!;
        g.fillRect(PX[i]! - PS[i]! / 2, PY[i]! - PS[i]! / 2, PS[i]!, PS[i]!);
      }
      g.globalAlpha = 1;
      if (V[9]! > 0) {
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = V[9]! * 0.35;
        g.fillRect(-4, -4, W + 8, H + 8);
        g.globalAlpha = 1;
      }
    },
    /** A word in a sticker, centred at x. */
    word(s: string, x: number, y: number, size: number, c: number, alpha = 1, tilt = 0) {
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      g.rotate(tilt);
      g.font = `900 ${size}px system-ui`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = size * 0.28;
      g.strokeStyle = col[INK]!;
      g.strokeText(s, 0, 0);
      g.fillStyle = col[c]!;
      g.fillText(s, 0, 0);
      g.restore();
    },
    /** Dizzy stars circling a head at (x, y). */
    stars(x: number, y: number, n: number) {
      g.fillStyle = col[GOLD]!;
      for (let i = 0; i < n; i++) {
        const a = V[7]! * 6 + (i * TAU) / n;
        circ(x + Math.cos(a) * 7, y + Math.sin(a) * 2, 1.1);
      }
    },
  };
  return k;
}

/** A tiny control bar: real buttons in the stage, styled by the stage's sheet (.rg-b). Each reports a press. */
export function controls(engine: Engine, stage: HTMLElement, defs: { label: string; aria: string; id: number }[], on: (id: number) => void) {
  const bar = engine.ledger.add(document.createElement("div"));
  bar.className = "rg-bar";
  const out: HTMLButtonElement[] = [];
  for (const d of defs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rg-b";
    b.textContent = d.label;
    b.setAttribute("aria-label", d.aria);
    b.dataset.id = String(d.id);
    // Down, not click: a dodge is about timing.
    b.addEventListener("pointerdown", (e) => (e.preventDefault(), on(d.id)), { signal: engine.signal });
    b.addEventListener("click", (e) => e.detail === 0 && on(d.id), { signal: engine.signal });
    bar.append(b);
    out.push(b);
  }
  stage.append(bar);
  return out;
}
