// Shared by the carnival pieces (Duck Derby, Whack-a-Mole): the midway booth. One smooth canvas
// over the stage's real text (the stage's CSS paints the wall behind the text; this draws the
// awning, the bulbs, the counter and everything that moves, in art units: 160 × 90 like every
// gallery piece, scaled to the stage at the device's pixel ratio), the colours (read from the
// stage's --mw-* custom properties, so dark is a night midway and light a day one), a particle
// pool (confetti, sparkles, smoke, splinters), pop words, flying tickets and the prize moment: a
// plush that comes off the shelf, bounces on the counter and goes home with you.
// Nothing here writes the page except the canvas, added through the engine's ledger. Steps allocate
// nothing: every string is made once.
import type { Engine } from "../../../src/kernel/index";
import { W, H } from "./pix";

export { W, H };
/** Colour slots (the stage's --mw-* properties). */
export const INK = 0, PAPER = 1, RED = 2, CREAM = 3, GOLD = 4, CYAN = 5, PURPLE = 6, WOOD = 7, WOOD2 = 8, SHADE = 9, GREEN = 10, WALL = 11, SKIN = 12;
const VARS = ["--mw-ink", "--mw-paper", "--mw-red", "--mw-cream", "--mw-gold", "--mw-cyan", "--mw-purple", "--mw-wood", "--mw-wood2", "--mw-shade", "--mw-green", "--mw-wall", "--mw-skin"];
const TAU = 6.2832;
/** Particle kinds. */
export const CONF = 0, STAR = 1, SMOKE = 2, CHIP = 3, DROP = 4;
const NUM = Array.from({ length: 1000 }, (_, i) => String(i));
const FONT = Array.from({ length: 25 }, (_, i) => `900 ${i}px system-ui, sans-serif`);

export type Booth = ReturnType<typeof booth>;

/**
 * The booth on `stage`: its canvas, colours from `skin` (the stage's own wrapper), particles, words,
 * tickets and the prize. `hudX`, `hudY`: the ticket stub, where flying tickets land (art units; x < 0: none).
 */
export function booth(engine: Engine, stage: HTMLElement, skin: HTMLElement, hudX: number, hudY: number) {
  const L = engine.ledger, R = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  // [0] width px, [1] height px, [2] dpr, [3] measure, [4] px per art unit, [5] glow (dark), [6] time,
  // [7] tickets, [8] ticket bump, [9] chase (bulbs), [10] shake, [11] resolution (0: full; the poster draws smaller).
  const V = new Float64Array(12);
  V[3] = 1;
  const col = ["#07060f", "#f6f3ff", "#ff2e88", "#f6f3ff", "#ffc21a", "#19f0ff", "#9a63ff", "#3f296a", "#2a1c4a", "#07060f", "#39ffb0", "#120f26", "#ff7389"];
  const ro = new ResizeObserver(() => ((V[3] = 1), engine.wake()));
  ro.observe(stage);
  // The site's theme switch repaints: the colours are read again.
  const mo = new MutationObserver(() => ((V[3] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  // Particles: position, velocity, life left, life, size, turn, spin, kind, colour.
  const P = 320;
  const PX = new Float32Array(P), PY = new Float32Array(P), PVX = new Float32Array(P), PVY = new Float32Array(P), PL = new Float32Array(P), PM = new Float32Array(P);
  const PS = new Float32Array(P), PR = new Float32Array(P), PVR = new Float32Array(P), PK = new Uint8Array(P), PC = new Uint8Array(P);
  // Words: position, age, which, colour, size, tilt.
  const WN = 8, WX = new Float32Array(WN), WY = new Float32Array(WN), WT = new Float32Array(WN).fill(9), WI = new Uint8Array(WN), WC = new Uint8Array(WN), WS = new Float32Array(WN), WR = new Float32Array(WN);
  let words: string[] = [];
  // Flying tickets: from, age, value.
  const TN = 16, TX = new Float32Array(TN), TY = new Float32Array(TN), TT = new Float32Array(TN).fill(9), TV = new Uint8Array(TN);
  // The prize: [0] age (-1 none), [1] tier, [2] from x, [3] from y, [4] tickets shown.
  const Z = new Float64Array(6);
  Z[0] = -1;
  const n = new Uint32Array(2); // particles alive, word cursor

  /** A filled circle, a filled oval (the current fill). */
  const circ = (x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());
  const oval = (x: number, y: number, rx: number, ry: number) => (g.beginPath(), g.ellipse(x, y, rx, ry, 0, 0, TAU), g.fill());
  const b = {
    canvas,
    circ,
    oval,
    g,
    col,
    V,
    /** In a read hook: size the canvas after a resize, read the colours. True when it measured. */
    read() {
      if (!V[3]) return false;
      V[3] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[11] || 1);
      (V[0] = r.width), (V[1] = r.height), (V[2] = dpr), (V[4] = r.width / W);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue(VARS[i]!).trim() || col[i]!;
      V[5] = cs.getPropertyValue("--mw-glow").trim() === "1" ? 1 : 0;
      return true;
    },
    /** A pointer event's position in art units (one layout read, outside any frame). */
    at(e: PointerEvent, out: Float64Array, o: number) {
      const r = stage.getBoundingClientRect();
      out[o] = ((e.clientX - r.left) / (r.width || 1)) * W;
      out[o + 1] = ((e.clientY - r.top) / (r.width || 1)) * W;
    },
    /** The poster (scripts/gallery-posters.mjs): a smaller canvas, so the stage's still stays light. */
    poster() {
      (V[11] = 0.6), (V[3] = 1);
    },
    /** The pop words this piece says (index = word id). */
    words(list: string[]) {
      words = list;
    },
    spray(kind: number, x: number, y: number, count: number, speed: number, c: number, a = -1.5708, spread = TAU, size = 1) {
      for (let k = 0; k < count; k++) {
        const i = n[0]!;
        if (i >= P) return;
        n[0] = i + 1;
        const an = a + (R() - 0.5) * spread, v = speed * (0.35 + R() * 0.65);
        (PX[i] = x), (PY[i] = y), (PVX[i] = Math.cos(an) * v), (PVY[i] = Math.sin(an) * v);
        PM[i] = PL[i] = kind === SMOKE ? 0.7 + R() * 0.5 : kind === CONF ? 1.6 + R() * 1.2 : kind === STAR ? 0.35 + R() * 0.35 : 0.7 + R() * 0.6;
        (PS[i] = size * (kind === SMOKE ? 2 + R() * 2 : kind === CONF ? 0.9 + R() * 0.6 : 0.6 + R() * 0.7)), (PR[i] = R() * TAU), (PVR[i] = (R() - 0.5) * 18), (PK[i] = kind), (PC[i] = c);
      }
    },
    /** Particles of `kind` that `hit(x, y)` claims end there (a water drop landing on a letter). */
    catch(kind: number, hit: (x: number, y: number) => boolean) {
      for (let i = 0; i < n[0]!; i++) if (PK[i] === kind && PL[i]! > 0.01 && hit(PX[i]!, PY[i]!)) PL[i] = 0.01;
    },
    /** A pop word at (x, y), colour slot c, size s (art units). */
    say(w: number, x: number, y: number, c: number, s = 9) {
      const i = n[1]! % WN;
      n[1] = n[1]! + 1;
      (WX[i] = Math.max(12 + s * 1.6, Math.min(148 - s * 1.6, x))), (WY[i] = Math.max(s, y)), (WT[i] = 0), (WI[i] = w), (WC[i] = c), (WS[i] = s), (WR[i] = (R() - 0.5) * 0.35);
    },
    /** A ticket worth v flies from (x, y) to the counter. */
    ticket(x: number, y: number, v: number) {
      for (let i = 0; i < TN; i++) if (TT[i]! >= 1) return void ((TX[i] = x), (TY[i] = y), (TT[i] = 0), (TV[i] = v));
      V[7] = V[7]! + v; // all in the air: count it now
    },
    get tickets() {
      return V[7]!;
    },
    set tickets(v: number) {
      V[7] = v;
    },
    /** The prize: tier 0 small, 1 big, 2 jumbo; it comes off the shelf at (x, y). */
    prize(tier: number, x: number, y: number) {
      (Z[0] = 0), (Z[1] = tier), (Z[2] = x), (Z[3] = y);
      V[9] = 3;
    },
    /** Seconds into the prize moment (-1: none). */
    get prizing() {
      return Z[0]!;
    },
    /** Bulb chase for `sec` seconds. */
    chase(sec: number) {
      V[9] = Math.max(V[9]!, sec);
    },
    shake(a: number) {
      V[10] = Math.max(V[10]!, a);
    },
    /** In a step: everything that flies. True while anything is still moving. */
    step(dt: number) {
      V[6] = V[6]! + dt;
      let live = 0;
      for (let i = 0; i < n[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --n[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PM[i] = PM[j]!);
          (PS[i] = PS[j]!), (PR[i] = PR[j]!), (PVR[i] = PVR[j]!), (PK[i] = PK[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        const k = PK[i]!, drag = Math.pow(k === CONF ? 0.25 : k === STAR ? 0.02 : k === SMOKE ? 0.1 : 0.6, dt);
        (PVX[i] = PVX[i]! * drag), (PVY[i] = PVY[i]! * drag + (k === CONF ? 40 : k === CHIP || k === DROP ? 160 : k === SMOKE ? -8 : 0) * dt);
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt), (PR[i] = PR[i]! + PVR[i]! * dt);
        if ((k === CHIP || k === DROP) && PY[i]! > 86 && PVY[i]! > 0) (PY[i] = 86), (PVY[i] = -PVY[i]! * 0.3), (PVX[i] = PVX[i]! * 0.5);
      }
      live += n[0]!;
      for (let i = 0; i < WN; i++) if (WT[i]! < 1) (WT[i] = WT[i]! + dt * 1.3), live++;
      for (let i = 0; i < TN; i++)
        if (TT[i]! < 1) {
          TT[i] = TT[i]! + dt * 1.6;
          live++;
          if (TT[i]! >= 1) (V[7] = V[7]! + TV[i]!), (V[8] = 1);
        }
      if (V[8]! > 0) (V[8] = Math.max(0, V[8]! - dt * 4)), live++;
      if (V[9]! > 0) (V[9] = Math.max(0, V[9]! - dt)), live++;
      if (V[10]! > 0) (V[10] = Math.max(0, V[10]! - dt * 3)), live++;
      if (Z[0]! >= 0) {
        const was = Z[0]!;
        Z[0] = was + dt;
        if (was < 0.7 && Z[0]! >= 0.7) {
          // It lands: confetti from both ends of the counter, the bulbs chase.
          const c = [RED, GOLD, CYAN, GREEN, PURPLE];
          for (let k = 0; k < 5; k++) b.spray(CONF, 8, 70, 14, 110, c[k]!, -1.1, 0.9), b.spray(CONF, 152, 70, 14, 110, c[k]!, -2.04, 0.9);
          b.spray(STAR, 80, 62, 14, 60, GOLD);
          b.shake(0.6);
        }
        if (Z[0]! > 4.2) Z[0] = -1;
        live++;
      }
      return live > 0;
    },
    /** Start a frame: the transform (art units) and a clear canvas. */
    begin() {
      const k = V[4]! * V[2]!, sh = V[10]!;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, W, H + 40);
      g.globalAlpha = 1;
      if (sh > 0) g.translate(Math.sin(V[6]! * 90) * sh * 1.2, Math.cos(V[6]! * 77) * sh * 0.8);
      return g;
    },
    /** The striped awning across the top: `n` stripes, scalloped hem at `y`. */
    awning(y: number, stripes: number) {
      const w = W / stripes;
      for (let i = 0; i < stripes; i++) {
        g.fillStyle = col[i & 1 ? CREAM : RED]!;
        g.beginPath();
        g.moveTo(i * w, 0);
        g.lineTo(i * w + w, 0);
        g.lineTo(i * w + w, y);
        g.arc(i * w + w / 2, y, w / 2, 0, Math.PI);
        g.closePath();
        g.fill();
      }
      // Fold shading and the top rail.
      g.globalAlpha = 0.18;
      g.fillStyle = col[INK]!;
      for (let i = 0; i < stripes; i++) g.fillRect(i * w + w * 0.72, 0, w * 0.28, y);
      g.globalAlpha = 1;
      g.fillStyle = col[WOOD2]!;
      g.fillRect(0, 0, W, 2.2);
    },
    /** A row of bulbs from x0 to x1 at y; while the chase runs they run in threes. */
    bulbs(x0: number, x1: number, y: number, count: number, r = 1.1) {
      const t = V[6]!, on = V[9]! > 0, step = (x1 - x0) / (count - 1), glow = V[5]!;
      for (let i = 0; i < count; i++) {
        const x = x0 + i * step, lit = !on || (i + Math.floor(t * 9)) % 3 === 0;
        if (glow && lit) {
          g.globalAlpha = 0.22;
          g.fillStyle = col[GOLD]!;
          circ(x, y, r * 2.6);
        }
        g.globalAlpha = 1;
        g.fillStyle = lit ? col[GOLD]! : col[WOOD2]!;
        circ(x, y, r);
        if (lit) {
          g.fillStyle = col[PAPER]!;
          circ(x - r * 0.3, y - r * 0.3, r * 0.35);
        }
      }
    },
    /** A ticket stub centred on (x, y), w × h, turned a, with text t. */
    stub(x: number, y: number, w: number, h: number, a: number, c: number, text: string, fs: number) {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = col[c]!;
      g.beginPath();
      g.moveTo(-w / 2, -h / 2);
      g.lineTo(w / 2, -h / 2);
      g.arc(w / 2, 0, h * 0.22, -Math.PI / 2, Math.PI / 2, true);
      g.lineTo(w / 2, h / 2);
      g.lineTo(-w / 2, h / 2);
      g.arc(-w / 2, 0, h * 0.22, Math.PI / 2, -Math.PI / 2, true);
      g.closePath();
      g.fill();
      g.globalAlpha = 0.55;
      g.fillStyle = col[INK]!;
      for (let k = -2; k <= 2; k++) g.fillRect(-w / 2 + h * 0.5, k * h * 0.18 - h * 0.05, h * 0.08, h * 0.1);
      g.globalAlpha = 1;
      if (text) {
        g.font = FONT[fs]!;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, h * 0.25, h * 0.04);
      }
      g.restore();
    },
    /** The ticket counter: a stub showing the count, bumping as tickets land. */
    hud() {
      if (hudX < 0) return; // this booth keeps no ticket stub
      const bump = V[8]!;
      b.stub(hudX, hudY, 21 + bump * 3, 9 + bump * 1.2, -0.06, GOLD, NUM[Math.min(999, V[7]!)]!, 7);
    },
    /** The round clock at (x, y): a pie of the time left and the seconds; red in the last few. */
    clock(x: number, y: number, left: number, total: number, warn: boolean) {
      g.fillStyle = col[PAPER]!;
      circ(x, y, 5.4);
      g.fillStyle = col[warn ? RED : CYAN]!;
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, 4.6, -1.5708, -1.5708 + (left / total) * TAU);
      g.fill();
      g.font = FONT[5]!;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = col[INK]!;
      g.fillText(NUM[Math.ceil(left)]!, x, y + 0.3);
    },
    /** A hint stuck on at (x, y), slightly turned. */
    hint(x: number, y: number, text: string) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.06);
      g.font = FONT[4]!;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 1.2;
      g.lineJoin = "round";
      g.strokeStyle = col[INK]!;
      g.strokeText(text, 0, 0);
      g.fillStyle = col[GOLD]!;
      g.fillText(text, 0, 0);
      g.restore();
    },
    /** A plush prize: a round bear with a heart, `s` its height, squash > 0 flattens it. */
    plush(x: number, y: number, s: number, c: number, squash: number, wave: number) {
      const sx = s * (1 + squash * 0.25), sy = s * (1 - squash * 0.25);
      g.save();
      g.translate(x, y);
      g.scale(sx / 20, sy / 20);
      g.fillStyle = col[c]!;
      // Feet, body, arms (one waves), ears, head.
      g.beginPath();
      g.ellipse(-4.5, -1.5, 3.5, 2.2, 0, 0, TAU);
      g.moveTo(4.5 + 3.5, -1.5);
      g.ellipse(4.5, -1.5, 3.5, 2.2, 0, 0, TAU);
      g.fill();
      oval(0, -6.5, 7, 6);
      g.beginPath();
      g.ellipse(-7, -8, 2.2, 3.6, -0.6, 0, TAU);
      g.fill();
      g.save();
      g.translate(6, -9);
      g.rotate(0.6 - Math.sin(wave) * 0.7);
      oval(0, -2.5, 2.2, 3.6);
      g.restore();
      g.beginPath();
      g.arc(-5.5, -19, 2.8, 0, TAU);
      g.moveTo(5.5 + 2.8, -19);
      g.arc(5.5, -19, 2.8, 0, TAU);
      g.fill();
      circ(0, -14.5, 6.5);
      // Belly patch, a stitched heart, the muzzle, button eyes, a smile, inner ears.
      g.fillStyle = col[CREAM]!;
      oval(0, -6, 4.2, 3.8);
      g.beginPath();
      g.ellipse(0, -12.6, 3, 2.2, 0, 0, TAU);
      g.moveTo(-5.5 + 1.3, -19);
      g.arc(-5.5, -19, 1.3, 0, TAU);
      g.moveTo(5.5 + 1.3, -19);
      g.arc(5.5, -19, 1.3, 0, TAU);
      g.fill();
      g.fillStyle = col[RED]!;
      g.beginPath();
      g.moveTo(0, -3.6);
      g.bezierCurveTo(-3.4, -6, -1.6, -8.6, 0, -7);
      g.bezierCurveTo(1.6, -8.6, 3.4, -6, 0, -3.6);
      g.fill();
      g.fillStyle = col[INK]!;
      g.beginPath();
      g.arc(-2.4, -15.6, 0.95, 0, TAU);
      g.moveTo(2.4 + 0.95, -15.6);
      g.arc(2.4, -15.6, 0.95, 0, TAU);
      g.fill();
      oval(0, -13.4, 1.1, 0.75);
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.55;
      g.beginPath();
      g.arc(0, -12.4, 1.3, 0.35, Math.PI - 0.35);
      g.stroke();
      g.restore();
    },
    /** In render: particles, flying tickets, the ticket counter, then the words on top. */
    draw() {
      for (let i = 0; i < n[0]!; i++) {
        const k = PK[i]!, life = PL[i]! / PM[i]!, s = PS[i]!;
        g.fillStyle = col[PC[i]!]!;
        g.globalAlpha = k === SMOKE ? life * 0.45 : Math.min(1, life * 3);
        if (k === CONF) {
          // A paper square tumbling: its width flips with the spin.
          const c = Math.cos(PR[i]!);
          g.fillRect(PX[i]! - s * 0.6 * c, PY[i]! - s * 0.4, s * 1.2 * c, s * 0.8);
        } else if (k === STAR) {
          const r = s * 2.4 * (0.5 + life);
          g.beginPath();
          g.moveTo(PX[i]!, PY[i]! - r);
          g.lineTo(PX[i]! + r * 0.25, PY[i]! - r * 0.25);
          g.lineTo(PX[i]! + r, PY[i]!);
          g.lineTo(PX[i]! + r * 0.25, PY[i]! + r * 0.25);
          g.lineTo(PX[i]!, PY[i]! + r);
          g.lineTo(PX[i]! - r * 0.25, PY[i]! + r * 0.25);
          g.lineTo(PX[i]! - r, PY[i]!);
          g.lineTo(PX[i]! - r * 0.25, PY[i]! - r * 0.25);
          g.fill();
        } else if (k === SMOKE) {
          circ(PX[i]!, PY[i]!, s * (1.6 - life * 0.8));
        } else if (k === DROP) {
          circ(PX[i]!, PY[i]!, s * 0.7);
        } else g.fillRect(PX[i]! - s / 2, PY[i]! - s / 2, s, s);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < TN; i++) {
        const t = TT[i]!;
        if (t >= 1) continue;
        const e = t * t * (3 - 2 * t), x = TX[i]! + (hudX - TX[i]!) * e, y = TY[i]! + (hudY - TY[i]!) * e - Math.sin(t * Math.PI) * 18;
        b.stub(x, y, 11, 5, t * 9, TV[i]! > 1 ? RED : GOLD, "", 0);
      }
      b.hud();
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      for (let i = 0; i < WN; i++) {
        const t = WT[i]!;
        if (t >= 1) continue;
        const s = WS[i]! * (t < 0.12 ? 0.4 + (t / 0.12) * 0.8 : t < 0.22 ? 1.2 - (t - 0.12) * 2 : 1);
        g.save();
        g.translate(WX[i]!, WY[i]! - t * 6);
        g.rotate(WR[i]!);
        g.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1;
        g.font = FONT[Math.max(1, Math.min(24, Math.round(s)))]!;
        const w = words[WI[i]!] ?? "";
        g.lineWidth = 2.2;
        g.strokeStyle = col[INK]!;
        g.strokeText(w, 0, 0);
        g.fillStyle = col[WC[i]!]!;
        g.fillText(w, 0, 0);
        g.restore();
      }
      g.globalAlpha = 1;
    },
    /** In render, last: the prize moment (the plush, its banner, the tickets it took). */
    drawPrize(plushCol: number[], label: string) {
      const t = Z[0]!;
      if (t < 0) return;
      const tier = Z[1]!, size = 14 + tier * 7, c = plushCol[tier]!;
      let x = 80, y = 76, sq = 0, rot = 0;
      if (t < 0.7) {
        const u = t / 0.7, e = u * u;
        x = Z[2]! + (80 - Z[2]!) * u;
        y = Z[3]! + (76 - Z[3]!) * e - Math.sin(u * Math.PI) * 26;
        rot = (1 - u) * 6.2832 * (Z[2]! < 80 ? 1 : -1);
      } else if (t < 1.3) sq = Math.sin((t - 0.7) * 16) * Math.exp(-(t - 0.7) * 6) * 1.4;
      else if (t > 3.4) y = 76 + (t - 3.4) * (t - 3.4) * 110; // handed over: it drops off the counter to you
      // Glow ring behind the winner.
      if (t > 0.7 && t < 3.6) {
        g.globalAlpha = Math.min(1, (t - 0.7) * 3) * (t > 3.2 ? (3.6 - t) / 0.4 : 1) * 0.35;
        g.fillStyle = col[GOLD]!;
        g.save();
        g.translate(80, y - size * 0.55);
        g.rotate(t * 0.6);
        for (let k = 0; k < 12; k++) {
          g.rotate(TAU / 12);
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(-3, -60);
          g.lineTo(3, -60);
          g.fill();
        }
        g.restore();
        g.globalAlpha = 1;
      }
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      b.plush(0, 0, size, c, sq, t * 7);
      g.restore();
      // The banner swoops in over the top.
      if (t > 0.7 && t < 3.6) {
        const u = Math.min(1, (t - 0.7) / 0.25), a = t > 3.3 ? (3.6 - t) / 0.3 : 1;
        g.globalAlpha = a;
        g.save();
        g.translate(80, 24);
        g.scale(0.6 + u * 0.4, 0.6 + u * 0.4);
        g.rotate(-0.04);
        g.fillStyle = col[RED]!;
        g.beginPath();
        g.moveTo(-40, -8), g.lineTo(40, -8), g.lineTo(36, 0), g.lineTo(40, 8), g.lineTo(-40, 8), g.lineTo(-36, 0);
        g.fill();
        g.strokeStyle = col[GOLD]!;
        g.lineWidth = 1;
        g.stroke();
        g.font = FONT[11]!;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 2;
        g.strokeStyle = col[INK]!;
        g.strokeText(label, 0, 0.6);
        g.fillStyle = col[PAPER]!;
        g.fillText(label, 0, 0.6);
        g.restore();
        g.font = FONT[5]!;
        g.globalAlpha = a;
        g.fillStyle = col[PAPER]!;
        g.strokeStyle = col[INK]!;
        g.lineWidth = 1.4;
        const sub = tier === 2 ? "JUMBO PRIZE!" : tier === 1 ? "BIG PRIZE!" : "A PRIZE!";
        g.strokeText(sub, 80, 37);
        g.fillText(sub, 80, 37);
        g.globalAlpha = 1;
      }
    },
  };
  return b;
}

export { NUM, FONT, TAU };
