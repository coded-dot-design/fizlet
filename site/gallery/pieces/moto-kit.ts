// Shared by the motocross minis (Dirt Lab, Redline): the side-on dirt world. One canvas over the
// stage (art units: 160 across, 90 down), its colours read from the stage's own wrapper (light and
// dark), dust and clods, the bike and its rider, and the controls: real <button>s (44 px or more)
// and keys while focus is in the stage, with M for mute. Sound is fzlt/sound: silent until a
// gesture. Nothing here writes the page outside the slot's stage; the canvas and the buttons go
// through the engine's ledger, so Recall gives the page back exactly. Steps allocate nothing.
import type { Engine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { Cue } from "../../../src/sound";

export const W = 160, H = 90, TAU = Math.PI * 2;
// Colour slots, read from the skin's --mx-* variables.
export const SKY = 0, SKY2 = 1, HILL = 2, DIRT = 3, DIRT2 = 4, INK = 5, PAPER = 6, BIKE = 7, RIDER = 8, GOLD = 9, GO = 10, CMD = 11, HOT = 12;
const VARS = ["--mx-sky", "--mx-sky2", "--mx-hill", "--mx-dirt", "--mx-dirt2", "--mx-ink", "--mx-paper", "--mx-bike", "--mx-rider", "--mx-gold", "--mx-go", "--mx-cmd", "--mx-hot"];

export type Rig = ReturnType<typeof rig>;

/** The canvas on `stage` with colours from `skin`; dust; the bike; sound with `cues`. */
export function rig(engine: Engine, stage: HTMLElement, skin: HTMLElement, cues: Record<string, Cue>) {
  const L = engine.ledger, R = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  // [0] w px, [1] h px, [2] dpr, [3] measure, [4] px per unit, [5] dark, [6] shake, [7] time, [8] resolution
  const V = new Float64Array(9);
  V[3] = 1;
  const col = ["#0c0a1c", "#1d1640", "#2a1c4a", "#7a4a2a", "#5a341c", "#07060f", "#f6f3ff", "#ff2b4e", "#19f0ff", "#ffc21a", "#39ffb0", "#9a63ff", "#ff8a1f"];
  const ro = new ResizeObserver(() => ((V[3] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[3] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const snd = sound(engine, { cues, volume: 0.1 });

  // Dust and clods: position, velocity, life left, life, size, colour.
  const P = 160;
  const PX = new Float32Array(P), PY = new Float32Array(P), PVX = new Float32Array(P), PVY = new Float32Array(P), PL = new Float32Array(P), PM = new Float32Array(P), PS = new Float32Array(P), PC = new Uint8Array(P);
  const n = new Uint32Array(1);
  let sk: CanvasGradient | null = null;
  const circ = (x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());

  const k = {
    g, col, V, canvas, circ, snd,
    /** In a read hook: size the canvas after a resize, read the colours. */
    read() {
      if (!V[3]) return false;
      V[3] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[8] || 1);
      (V[0] = r.width), (V[1] = r.height), (V[2] = dpr), (V[4] = r.width / W);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue(VARS[i]!).trim() || col[i]!;
      V[5] = cs.getPropertyValue("--mx-dark").trim() === "1" ? 1 : 0;
      sk = g.createLinearGradient(0, 0, 0, H);
      sk.addColorStop(0, col[SKY]!);
      sk.addColorStop(1, col[SKY2]!);
      return true;
    },
    /** A pointer's position in art units (one layout read, outside any frame). */
    at(e: { clientX: number; clientY: number }, out: Float64Array) {
      const r = stage.getBoundingClientRect();
      out[0] = ((e.clientX - r.left) / (r.width || 1)) * W;
      out[1] = ((e.clientY - r.top) / (r.height || 1)) * H;
    },
    poster() {
      (V[8] = 0.6), (V[3] = 1);
    },
    dust(x: number, y: number, count: number, vx: number, vy: number, spread: number, c: number, size = 1) {
      for (let j = 0; j < count; j++) {
        const i = n[0]! % P;
        n[0] = i + 1;
        (PX[i] = x), (PY[i] = y), (PVX[i] = vx + (R() - 0.5) * spread), (PVY[i] = vy + (R() - 0.7) * spread);
        PM[i] = PL[i] = 0.4 + R() * 0.5;
        (PS[i] = size * (0.6 + R() * 0.9)), (PC[i] = c);
      }
    },
    /** Move the dust (a ring: the oldest goes first); true while any is alive. */
    step(dt: number) {
      V[7] = V[7]! + dt;
      V[6] = Math.max(0, V[6]! - dt * 3);
      let live = 0;
      for (let i = 0; i < P; i++) {
        if (PL[i]! <= 0) continue;
        PL[i] = PL[i]! - dt;
        PVY[i] = PVY[i]! + 60 * dt;
        PX[i] = PX[i]! + PVX[i]! * dt;
        PY[i] = PY[i]! + PVY[i]! * dt;
        live++;
      }
      return live > 0 || V[6]! > 0;
    },
    shake(s: number) {
      V[6] = Math.max(V[6]!, s);
    },
    begin() {
      const s = V[4]! * V[2]!, sh = V[6]!;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.globalAlpha = 1;
      if (sh > 0) g.translate(Math.sin(V[7]! * 83) * sh * 1.4, Math.cos(V[7]! * 71) * sh);
    },
    drawDust() {
      for (let i = 0; i < P; i++) {
        if (PL[i]! <= 0) continue;
        g.globalAlpha = Math.min(1, (PL[i]! / PM[i]!) * 1.4);
        g.fillStyle = col[PC[i]!]!;
        g.fillRect(PX[i]! - PS[i]! / 2, PY[i]! - PS[i]! / 2, PS[i]!, PS[i]!);
      }
      g.globalAlpha = 1;
    },
    /** The sky: two bands, a few stars at night, the hills behind (parallax by `cam`). */
    sky(cam: number) {
      g.fillStyle = sk ?? col[SKY]!;
      g.fillRect(-4, -4, W + 8, H + 8);
      if (V[5]) {
        g.fillStyle = col[PAPER]!;
        for (let i = 0; i < 18; i++) g.fillRect((i * 53.3 + 11) % W, (i * 17.7) % 34 + 2, 0.5, 0.5);
      }
      g.fillStyle = col[HILL]!;
      g.beginPath();
      g.moveTo(-4, H);
      for (let x = -4; x <= W + 4; x += 4) g.lineTo(x, 44 + Math.sin((x + cam * 0.3) * 0.045) * 6);
      g.lineTo(W + 4, H);
      g.fill();
    },
    /**
     * The bike at (x, y) (between the wheels' contact points), tilted `a` (screen radians, + is nose
     * down), wheels turned `spin`; `lean` -1..1 moves the rider back or forward; `rider` 0 when he
     * has been thrown.
     */
    bike(x: number, y: number, a: number, spin: number, lean: number, rider: number) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      // Wheels: tyre, rim, two spokes that turn.
      for (let w = -1; w <= 1; w += 2) {
        const wx = w * 4.6;
        g.fillStyle = col[INK]!;
        circ(wx, -2.4, 2.6);
        g.strokeStyle = col[PAPER]!;
        g.lineWidth = 0.35;
        g.beginPath();
        g.arc(wx, -2.4, 1.6, 0, TAU);
        g.moveTo(wx + Math.cos(spin) * 1.6, -2.4 + Math.sin(spin) * 1.6);
        g.lineTo(wx - Math.cos(spin) * 1.6, -2.4 - Math.sin(spin) * 1.6);
        g.moveTo(wx + Math.cos(spin + 1.57) * 1.6, -2.4 + Math.sin(spin + 1.57) * 1.6);
        g.lineTo(wx - Math.cos(spin + 1.57) * 1.6, -2.4 - Math.sin(spin + 1.57) * 1.6);
        g.stroke();
      }
      // Forks, frame, tank and seat, the number plate.
      g.strokeStyle = col[PAPER]!;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(4.6, -2.4), g.lineTo(2.6, -7);
      g.moveTo(-4.6, -2.4), g.lineTo(-0.6, -4.2);
      g.stroke();
      g.fillStyle = col[BIKE]!;
      g.beginPath();
      g.moveTo(-5.4, -5.4), g.lineTo(3.6, -6.6), g.lineTo(2.2, -4), g.lineTo(-2.2, -3.4);
      g.fill();
      g.beginPath();
      g.moveTo(3.2, -6.8), g.lineTo(6.4, -5.2), g.lineTo(5.4, -4.4);
      g.fill();
      g.fillStyle = col[INK]!;
      g.fillRect(-1.6, -4.4, 3.4, 1.6);
      g.fillStyle = col[GOLD]!;
      g.fillRect(-4.8, -5.6, 2.2, 1.1);
      if (rider) k.rider(lean * 1.6);
      g.restore();
    },
    /** The rider in the bike's frame, leaning `lx` (back -, forward +): legs, body, arms, helmet. */
    rider(lx: number) {
      g.strokeStyle = col[INK]!;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-0.4, -3.4), g.lineTo(0.6 + lx * 0.3, -6.2), g.lineTo(-1.4 + lx, -8.2);
      g.stroke();
      g.strokeStyle = col[RIDER]!;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-1.4 + lx, -8.2), g.lineTo(0.2 + lx * 1.3, -12);
      g.stroke();
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0.4 + lx * 1.3, -11.2), g.lineTo(2.8, -7.4);
      g.stroke();
      g.fillStyle = col[RIDER]!;
      circ(0.8 + lx * 1.4, -13.6, 1.9);
      g.fillStyle = col[INK]!;
      g.fillRect(1.4 + lx * 1.4, -14.2, 1.6, 0.9);
      g.fillStyle = col[BIKE]!;
      g.fillRect(-1.1 + lx * 1.4, -15.4, 3.2, 0.7);
    },
    /** A thrown rider tumbling at (x, y), turned `a`. */
    body(x: number, y: number, a: number) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.translate(0, 8);
      k.rider(0);
      g.restore();
    },
    /** A word in a sticker (pop words, the clock), centred at x. */
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
  };
  return k;
}

/** A tiny control bar: real buttons in the stage, styled by the stage's sheet (.mx-b). `hold` buttons
 *  report press and release (gas, lean); the others a press. Returns the buttons in order. */
export function controls(engine: Engine, stage: HTMLElement, defs: { label: string; aria: string; id: number; hold?: boolean }[], on: (id: number, down: boolean) => void) {
  const bar = engine.ledger.add(document.createElement("div"));
  bar.className = "mx-bar";
  const out: HTMLButtonElement[] = [];
  for (const d of defs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mx-b";
    b.textContent = d.label;
    b.setAttribute("aria-label", d.aria);
    b.dataset.id = String(d.id);
    if (d.hold) {
      b.addEventListener("pointerdown", (e) => (e.preventDefault(), b.setPointerCapture?.(e.pointerId), on(d.id, true)), { signal: engine.signal });
      for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(t, () => on(d.id, false), { signal: engine.signal });
    } else b.addEventListener("click", () => on(d.id, true), { signal: engine.signal });
    bar.append(b);
    out.push(b);
  }
  stage.append(bar);
  return out;
}
