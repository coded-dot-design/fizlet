// Shared by the surf-sesh minis (Lip Line, Tube Time): the rig every one of them stands on. One
// smooth canvas over the stage (art units: 160 × 90, scaled to the stage at the device's pixel
// ratio), one hold-to-ride input (a press anywhere on the stage, or Space / Enter / ↑ on its ride
// key), a mute key (M, or the ♪ key), the fizlet/sound synth (silent until a gesture), a spray pool
// and pop words. Every colour is a Board UI token (fizlet src/ui/tokens.json).
// Nothing here writes the page except what it adds through the engine's ledger (the canvas and two
// 44 px keys), so Recall gives the page back byte for byte. Steps allocate nothing: every string is
// made once; the pools are typed arrays.
import type { Engine } from "../../../../src/kernel/index";
import { sound, type Cue } from "../../../../src/sound";

export const W = 160, H = 90, TAU = 6.2832;
/** Board UI tokens (dark roles; the sea reads the same in both themes). */
export const C = {
  rim: "#07060f", bg: "#07060f", surface: "#110d22", raised: "#1d1738", line: "#3b3170", ink: "#f6f3ff", muted: "#aea4d6",
  sys: "#19f0ff", cmd: "#9a63ff", attack: "#ff2e88", aim: "#ff7389", advance: "#ff8a1f", go: "#39ffb0", hurt: "#ffc21a", fallin: "#a8ff3e",
};
/** Score digits, made once. */
export const NUM = Array.from({ length: 1000 }, (_, i) => String(i));
export const FONT = Array.from({ length: 25 }, (_, i) => `900 ${i}px system-ui, sans-serif`);

/** A hold-to-ride round's modes: the attract run, waiting, a ride, the score card. */
export const DEMO = 0, IDLE = 1, PLAY = 2, DONE = 3;

/** The spray pool (white water, mist, foam): position, velocity, life, size, colour. Steps only. */
export function spray(n: number, random: () => number) {
  const X = new Float32Array(n), Y = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), L = new Float32Array(n), M = new Float32Array(n), S = new Float32Array(n), K = new Uint8Array(n);
  const c = new Uint32Array(1);
  return {
    X, Y, L, M, S, K,
    get n() {
      return n;
    },
    /** `count` drops from (x, y) toward angle `a` ± spread/2, at up to `speed`, colour slot `k`. */
    burst(x: number, y: number, count: number, speed: number, a: number, spread: number, size: number, k: number) {
      for (let j = 0; j < count; j++) {
        const i = c[0]!;
        c[0] = (i + 1) % n;
        const an = a + (random() - 0.5) * spread, v = speed * (0.35 + random() * 0.65);
        (X[i] = x), (Y[i] = y), (VX[i] = Math.cos(an) * v), (VY[i] = Math.sin(an) * v);
        M[i] = L[i] = 0.45 + random() * 0.6;
        (S[i] = size * (0.5 + random())), (K[i] = k);
      }
    },
    /** Advance; gravity g; returns how many are alive. */
    step(dt: number, g: number) {
      let alive = 0;
      for (let i = 0; i < n; i++) {
        if (L[i]! <= 0) continue;
        L[i] = L[i]! - dt;
        VY[i] = VY[i]! + g * dt;
        VX[i] = VX[i]! * (1 - dt * 1.2);
        X[i] = X[i]! + VX[i]! * dt;
        Y[i] = Y[i]! + VY[i]! * dt;
        alive++;
      }
      return alive;
    },
    clear() {
      L.fill(0);
    },
  };
}
export type Spray = ReturnType<typeof spray>;

/** Pop words: up to 4 at once (which, where, age, colour slot). */
export function words(list: readonly string[]) {
  const N = 4, I = new Uint8Array(N), X = new Float32Array(N), Y = new Float32Array(N), T = new Float32Array(N).fill(9), K = new Uint8Array(N), c = new Uint32Array(1);
  return {
    list, I, X, Y, T, K, N,
    say(w: number, x: number, y: number, k: number) {
      const i = c[0]! % N;
      c[0] = c[0]! + 1;
      (I[i] = w), (X[i] = x), (Y[i] = y), (T[i] = 0), (K[i] = k);
    },
    step(dt: number) {
      let alive = 0;
      for (let i = 0; i < N; i++) if (T[i]! < 1.1) (T[i] = T[i]! + dt), alive++;
      return alive;
    },
  };
}
export type Words = ReturnType<typeof words>;

/** Input state the sims read (typed: the step reads it, never allocates). [0] held, [1] presses since last step, [2] muted. */
export type Pad = Float64Array;

/**
 * The rig on `stage`: canvas, colours, the hold input and keys, the synth. `label` names the ride
 * key for screen readers ("Hold to carve").
 */
export function rig(engine: Engine, stage: HTMLElement, label: string, cues: Record<string, Cue>) {
  const L = engine.ledger;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const pad: Pad = new Float64Array(3);
  // [0] css width, [1] dpr scale (px per art unit), [2] measure, [3] poster resolution.
  const V = new Float64Array(4);
  V[2] = 1;
  const ro = new ResizeObserver(() => ((V[2] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const snd = sound(engine, { cues, volume: 0.1 });

  // The keys: a ride key over the whole stage (so a press anywhere rides, and it takes focus for
  // the keyboard), and a 44 px mute key in the corner.
  const key = "position:absolute;border:0;margin:0;padding:0;font:900 14px/1 system-ui,sans-serif;color:#f6f3ff;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:none;";
  const ride = L.add(document.createElement("button"));
  ride.type = "button";
  ride.setAttribute("aria-label", `${label} (Space)`);
  ride.style.cssText = key + "inset:0;width:100%;height:100%;background:transparent;outline-offset:-4px;user-select:none";
  const mute = L.add(document.createElement("button"));
  mute.type = "button";
  mute.setAttribute("aria-label", "Sound (M)");
  mute.setAttribute("aria-pressed", "true");
  mute.textContent = "♪";
  mute.style.cssText = key + "right:4px;top:4px;width:44px;height:44px;border-radius:22px;background:rgba(7,6,15,.55);z-index:1";
  stage.append(ride, mute);

  const down = () => {
    if (!pad[0]) pad[1] = pad[1]! + 1;
    pad[0] = 1;
    engine.wake();
  };
  const up = () => {
    pad[0] = 0;
    engine.wake();
  };
  const toggle = () => {
    pad[2] = pad[2] ? 0 : 1;
    snd.on = !pad[2];
    mute.textContent = pad[2] ? "×" : "♪";
    mute.setAttribute("aria-pressed", pad[2] ? "false" : "true");
  };
  const sig = { signal: engine.signal };
  ride.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    ride.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    down();
  }, sig);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) ride.addEventListener(t, up, sig);
  ride.addEventListener("contextmenu", (e) => e.preventDefault(), sig);
  mute.addEventListener("click", toggle, sig);
  const isRide = (k: string) => k === " " || k === "Enter" || k === "ArrowUp";
  stage.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") return void (e.preventDefault(), toggle());
    if (!isRide(e.key) || e.target !== ride) return;
    e.preventDefault();
    if (!e.repeat) down();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    if (isRide(e.key) && e.target === ride) (e.preventDefault(), up());
  }, sig);

  return {
    g,
    canvas,
    pad,
    snd,
    ride,
    mute,
    /** In a read hook: size the canvas after a resize. */
    read() {
      if (!V[2]) return;
      V[2] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[3] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[0] = r.width;
      V[1] = (r.width * dpr) / W;
    },
    /** Start a frame: art units, cleared. */
    begin() {
      g.setTransform(V[1]!, 0, 0, V[1]!, 0, 0);
      g.clearRect(0, 0, W, H);
    },
    /** The poster draws a smaller canvas (scripts/gallery-posters.mjs). */
    poster() {
      (V[3] = 0.6), (V[2] = 1);
    },
    /** Draw the spray pool; `cols` maps its colour slots. */
    drawSpray(p: Spray, cols: readonly string[]) {
      for (let i = 0; i < p.n; i++) {
        const l = p.L[i]!;
        if (l <= 0) continue;
        g.globalAlpha = Math.min(1, (l / p.M[i]!) * 1.6);
        g.fillStyle = cols[p.K[i]!]!;
        const s = p.S[i]! * (0.6 + 0.4 * (l / p.M[i]!));
        g.fillRect(p.X[i]! - s / 2, p.Y[i]! - s / 2, s, s);
      }
      g.globalAlpha = 1;
    },
    /** Draw the pop words; `cols` maps their colour slots. */
    drawWords(w: Words, cols: readonly string[]) {
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let i = 0; i < w.N; i++) {
        const t = w.T[i]!;
        if (t >= 1.1) continue;
        const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.6 : t < 0.2 ? 1.2 - ((t - 0.12) / 0.08) * 0.2 : 1;
        g.globalAlpha = t > 0.8 ? (1.1 - t) / 0.3 : 1;
        g.save();
        g.translate(w.X[i]!, w.Y[i]! - t * 8);
        g.scale(pop, pop);
        g.rotate(-0.08);
        g.font = FONT[10]!;
        g.lineWidth = 3;
        g.strokeStyle = C.rim;
        g.lineJoin = "round";
        g.strokeText(w.list[w.I[i]!]!, 0, 0);
        g.fillStyle = cols[w.K[i]!]!;
        g.fillText(w.list[w.I[i]!]!, 0, 0);
        g.restore();
      }
      g.globalAlpha = 1;
    },
    /** The score and the clock (top left), in the theme's chip. */
    hud(score: number, left: number, round: number, playing: boolean, accent: string) {
      g.fillStyle = "rgba(7,6,15,.55)";
      g.beginPath();
      g.roundRect(4, 4, 38, 11, 5.5);
      g.fill();
      g.fillStyle = accent;
      g.font = FONT[8]!;
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillText(NUM[Math.min(999, score | 0)]!, 15, 9.8);
      // The clock: a ring that empties over the ride.
      const f = playing ? left / round : 1;
      g.strokeStyle = C.line;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(9.5, 9.5, 3.2, 0, TAU);
      g.stroke();
      g.strokeStyle = playing && left < 3 ? C.attack : accent;
      g.beginPath();
      g.arc(9.5, 9.5, 3.2, -1.5708, -1.5708 + TAU * f);
      g.stroke();
    },
    /** A centred caption (the hint, the card). */
    caption(s: string, y: number, size: number, fill: string) {
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = FONT[size]!;
      g.lineWidth = 3;
      g.lineJoin = "round";
      g.strokeStyle = C.rim;
      g.strokeText(s, W / 2, y);
      g.fillStyle = fill;
      g.fillText(s, W / 2, y);
    },
  };
}
export type Rig = ReturnType<typeof rig>;
