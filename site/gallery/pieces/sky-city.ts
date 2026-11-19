// The sky city of the space-age pieces (the bubble-top car, rush hour): one atomic-age look shared
// by both. A pastel palette (teal, coral, cream, mustard over a starry dusk), cartoon vector art drawn
// with an ink outline (bubble-top cars, houses on stilts, Googie starbursts, smoke rings, cloud
// puffs) and a canvas that keeps it crisp at any size. The art is in world units: 160 × 90 over the
// 16:9 stage, the same grid ./letters.ts measures the page's real letters in, so a hit is box on box.
// Nothing here writes the page except the canvas, which goes on through the engine's ledger.
import type { Engine } from "../../../src/kernel/index";

export const W = 160, H = 90;
const { PI, cos, sin, min, round } = Math;

/** The palette: atomic-age pastels with one ink for every outline. */
export const K = {
  ink: "#231a45",
  cream: "#fff4dc",
  teal: "#3fc8b6",
  tealD: "#23908f",
  coral: "#ff7b5f",
  coralD: "#d9533f",
  mustard: "#ffc84a",
  lilac: "#b8a3ff",
  mint: "#a8f0dc",
  glass: "rgba(205,250,244,.55)",
  skin: "#ffd6ae",
  lit: "#ffe68a",
  smoke: "#f6f0ff",
  haze: "#a99bd6",
  cloud: "#fff0ea",
};
/** Body and trim pairs for cars and houses. */
export const PAINT = [K.coral, K.teal, K.mustard, K.lilac, K.mint, K.cream];
export const TRIM = [K.teal, K.coral, K.coralD, K.mustard, K.coral, K.teal];

/** A canvas over the stage at device resolution (DPR at most 2), in world units, through the ledger. */
export function skyCanvas(engine: Engine, stage: HTMLElement) {
  const c = engine.ledger.add(document.createElement("canvas"));
  c.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  stage.append(c);
  const g = c.getContext("2d")!;
  const sz = new Float64Array(3); // resized, width, height (device px)
  sz[0] = 1;
  const ro = new ResizeObserver(() => ((sz[0] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  g.lineJoin = g.lineCap = "round";
  return {
    g,
    /** In read: measure after a resize. True when the canvas needs a redraw. */
    read() {
      if (!sz[0]) return false;
      sz[0] = 0;
      const d = min(2, devicePixelRatio || 1);
      sz[1] = round(stage.clientWidth * d) || W * 4;
      sz[2] = round(stage.clientHeight * d) || H * 4;
      return true;
    },
    /** In render: size (only when changed), clear, world transform. */
    begin() {
      if (c.width !== sz[1]) c.width = sz[1]!;
      if (c.height !== sz[2]) c.height = sz[2]!;
      g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineJoin = g.lineCap = "round";
    },
  };
}

type G = CanvasRenderingContext2D;

/** Fill and ink-outline the current path. */
export function inked(g: G, fill: string, lw: number) {
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = K.ink;
  g.lineWidth = lw;
  g.stroke();
}

/** A Googie starburst: `n` points, inner radius `k` of the outer. */
export function star(g: G, x: number, y: number, r: number, n: number, k: number, spin: number) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = spin + (i * PI) / n, q = i & 1 ? r * k : r;
    g.lineTo(x + cos(a) * q, y + sin(a) * q);
  }
  g.closePath();
}

const FONT = Array.from({ length: 16 }, (_, i) => `italic 900 ${i + 3}px system-ui,-apple-system,"Segoe UI",sans-serif`);
/** A cartoon sound word on a starburst: pops in (t from 0), holds, shrinks away at `end`. */
export function shout(g: G, text: string, x: number, y: number, size: number, t: number, end: number, burst: string) {
  const s = t < 0.1 ? 0.4 + t * 8 : t > end - 0.15 ? Math.max(0, (end - t) / 0.15) : 1 + sin(t * 30) * 0.03 * (t < 0.4 ? 1 : 0);
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  g.scale(s, s);
  star(g, 0, 0, size * (text.length * 0.42 + 0.4), 12, 0.72, t * 0.8);
  inked(g, burst, 0.5);
  g.font = FONT[min(15, round(size) - 3)]!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 0.9;
  g.strokeStyle = K.ink;
  g.strokeText(text, 0, 0.3);
  g.fillStyle = K.cream;
  g.fillText(text, 0, 0.3);
  g.restore();
}

/**
 * A bubble-top flying car, facing right at `face` 1 (−1 left; between them it squashes through the
 * turn), `s` world units per half length, tilted `tilt` rad, squashed by `sq` (−1…1).
 * `mood`: 0 cruising, 1 a grin (honk), 2 dizzy (knocked about).
 */
export function car(g: G, x: number, y: number, s: number, face: number, tilt: number, sq: number, body: string, trim: string, mood: number) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(s * face * (1 + sq * 0.22), s * (1 - sq * 0.22));
  const lw = 0.55 / s;
  // The jet pod under the tail, then the hull with its boomerang fin.
  g.beginPath();
  g.ellipse(-0.62, 0.36, 0.3, 0.13, 0, 0, PI * 2);
  inked(g, trim, lw);
  g.beginPath();
  g.moveTo(1.02, 0.02);
  g.quadraticCurveTo(0.98, 0.34, 0.42, 0.36);
  g.lineTo(-0.72, 0.32);
  g.quadraticCurveTo(-1.02, 0.3, -1.06, 0.06);
  g.lineTo(-1.42, -0.48);
  g.quadraticCurveTo(-1.08, -0.46, -0.76, -0.1);
  g.lineTo(0.6, -0.1);
  g.quadraticCurveTo(0.98, -0.1, 1.02, 0.02);
  inked(g, body, lw);
  g.beginPath();
  g.moveTo(-0.86, 0.14);
  g.lineTo(0.86, 0.14);
  g.strokeStyle = K.cream;
  g.lineWidth = 0.08;
  g.stroke();
  g.beginPath();
  g.arc(-1.38, -0.5, 0.13, 0, PI * 2);
  inked(g, K.mustard, lw * 0.8);
  // The driver under the bubble: round head, a tuft, one eye; a grin when honking.
  g.beginPath();
  g.arc(0.12, -0.32, 0.19, 0, PI * 2);
  inked(g, K.skin, lw * 0.7);
  g.beginPath();
  g.arc(0.08, -0.46, 0.1, PI, PI * 2.2);
  g.strokeStyle = K.ink;
  g.lineWidth = 0.08;
  g.stroke();
  g.fillStyle = K.ink;
  if (mood === 2) {
    g.beginPath();
    g.arc(0.22, -0.34, 0.05, 0, PI * 1.6);
    g.lineWidth = 0.03;
    g.stroke();
  } else g.fillRect(0.2, -0.38, 0.05, 0.08);
  if (mood === 1) g.beginPath(), g.arc(0.22, -0.24, 0.07, 0, PI * 2), g.fill();
  // The bubble.
  g.beginPath();
  g.arc(0.02, -0.1, 0.52, PI, 0);
  g.closePath();
  inked(g, K.glass, lw);
  g.beginPath();
  g.arc(0.02, -0.1, 0.4, PI * 1.15, PI * 1.38);
  g.strokeStyle = "#fff";
  g.lineWidth = 0.07;
  g.stroke();
  g.restore();
}

/** A smoke ring (radius r, alpha a): a cream donut with a soft lilac rim. */
export function ring(g: G, x: number, y: number, r: number, a: number) {
  g.globalAlpha = a;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.8, 0, 0, PI * 2);
  g.strokeStyle = K.haze;
  g.lineWidth = r * 0.5 + 0.5;
  g.stroke();
  g.strokeStyle = K.smoke;
  g.lineWidth = r * 0.5;
  g.stroke();
  g.globalAlpha = 1;
}

/** A row of cloud puffs along the bottom (in front of everything that rises out of the clouds). */
export function cloudBank(g: G, y: number, fill: string) {
  g.beginPath();
  for (let x = -4; x < W + 8; x += 9) {
    const r = 6 + ((x * 7) % 5);
    g.moveTo(x + r, y + 4);
    g.arc(x, y + 4 - ((x * 3) % 4), r, 0, PI * 2);
  }
  g.rect(0, y + 4, W, H - y);
  g.fillStyle = fill;
  g.fill();
}

/** A pool of soft puffs: x, y, vx, vy, radius, life. */
export function puffs(n: number) {
  const P = new Float32Array(n * 6);
  let k = 0;
  return {
    get n() {
      return k;
    },
    add(x: number, y: number, vx: number, vy: number, r: number, life: number) {
      if (k === n) return;
      const o = k++ * 6;
      (P[o] = x), (P[o + 1] = y), (P[o + 2] = vx), (P[o + 3] = vy), (P[o + 4] = r), (P[o + 5] = life);
    },
    /** Returns how many were alive coming in (so the frame that removes the last one still redraws). */
    step(dt: number) {
      const was = k;
      for (let i = k - 1; i >= 0; i--) {
        const o = i * 6;
        if ((P[o + 5] = P[o + 5]! - dt) <= 0) {
          k--;
          P.copyWithin(o, k * 6, k * 6 + 6);
          continue;
        }
        P[o] = P[o]! + P[o + 2]! * dt;
        P[o + 1] = P[o + 1]! + P[o + 3]! * dt;
        P[o + 2] = P[o + 2]! * (1 - dt * 2.5);
        P[o + 3] = P[o + 3]! * (1 - dt * 2.5) - dt * 6;
      }
      return was;
    },
    draw(g: G, fill: string) {
      g.fillStyle = fill;
      for (let i = 0; i < k; i++) {
        const o = i * 6, l = P[o + 5]!;
        g.globalAlpha = min(1, l * 3);
        g.beginPath();
        g.arc(P[o]!, P[o + 1]!, P[o + 4]! * (1.4 - min(1, l * 2) * 0.4), 0, PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    },
  };
}
