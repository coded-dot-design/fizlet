// Rubbleton: the stone-age cartoon town of the gallery's Saturday-morning pieces (an original family,
// the Cobbleworths: Bonk the dad, Opal the mum, Pip the kid, and Stretch the long-neck crane dino).
// Shared by every piece in the series: the cartoon look (bold ink outlines, flat colours, stone and
// wood), the canvas over the stage in a fixed 640 × 360 art space, the page's real elements as
// bodies (they spring, crack, come loose, fall and fly home, written only through the ledger), dust
// and rock chips, and the pop words. Nothing allocates in a step: everything is made at mount.
import { createEngine } from "../../../src/kernel/index";

export type Engine = ReturnType<typeof createEngine>;
/** The art space: every piece draws and collides in these units; the canvas scales them to the stage. */
export const W = 640, H = 360;
const { abs, cos, sin, max, min, round, PI } = Math;
export const TAU = PI * 2;

/** The Rubbleton palette: flat cartoon colours under one warm ink. */
export const INK = "#2a1a0e", STONE = "#b9ad9b", STONE_L = "#e2d8c6", STONE_D = "#857866", DUST = "#f6e7c4", WOOD = "#c27a3a", LEAF = "#5fae3e", LEAF_D = "#3a7d27", SKIN = "#f7bd8f", SKIN_D = "#de9466", BEARD = "#c8432a", HAIR = "#3b2416", TUNIC = "#f2b632", TUNIC_D = "#b97b12", DINO = "#58c3a2", DINO_D = "#2f8f78", BELLY = "#f7ecc4", HAT = "#ffd23f", RED = "#e2452f", CORAL = "#ff7a5c", PLUM = "#7b3fa0", WHITE = "#fffaf0", SKY = "#9fe0f0";

/** The canvas over the stage, sized to it (device pixels, up to 2×) and scaled to the art space.
 *  `fit()` runs in a read: true when the stage was (re)measured this frame. */
export function view(engine: Engine, stage: HTMLElement) {
  const c = engine.ledger.add(document.createElement("canvas"));
  c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  stage.append(c);
  const g = c.getContext("2d")!, dirty = new Uint8Array([1]);
  const ro = new ResizeObserver(() => ((dirty[0] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  return {
    g,
    fit() {
      if (!dirty[0]) return false;
      dirty[0] = 0;
      const d = min(2, devicePixelRatio || 1), w = stage.clientWidth || W, h = stage.clientHeight || H;
      c.width = round(w * d);
      c.height = round(h * d);
      return true;
    },
    /** Start a frame: clear, scale to the art space, and the shake offset. */
    clear(sx: number, sy: number) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(c.width / W, 0, 0, c.height / H, (sx * c.width) / W, (sy * c.height) / H);
      g.lineJoin = g.lineCap = "round";
    },
  };
}

/** Taps on the stage, in art units, handed to `on` (plus the slot's first tap, if any). */
export function taps(engine: Engine, stage: HTMLElement, first: { x: number; y: number } | null, on: (x: number, y: number) => void) {
  if (first) on((first.x / (stage.clientWidth || W)) * W, (first.y / (stage.clientHeight || H)) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    on(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
    engine.wake();
  }, { signal: engine.signal });
}

// ---------- Drawing: ink first, flat fill, bold outline ----------

/** Fill the current path, then outline it in ink. */
export function ink(g: CanvasRenderingContext2D, fill: string, lw = 2.4) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = INK;
  g.stroke();
}
/** An outlined ellipse. */
export function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, a = 0, lw = 2.4) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, a, 0, TAU);
  ink(g, fill, lw);
}
/** A flat dot (no outline). */
export function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}
/** A thick outlined stroke along the current path: ink under, colour over (necks, tails, limbs). */
export function limb(g: CanvasRenderingContext2D, w: number, fill: string) {
  g.lineWidth = w + 5;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = w;
  g.strokeStyle = fill;
  g.stroke();
}
/** A little hash in [0, 1) for lumpy shapes that stay the same every frame. */
export const hash = (n: number) => {
  const s = sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** A boulder: a lumpy outlined stone with a lit side, a shadow side and a few pits. */
export function rock(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, seed: number, fill = STONE, lw = 2.6) {
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const t = a + (i / 9) * TAU, k = r * (0.84 + hash(seed + i) * 0.2);
    i ? g.lineTo(x + cos(t) * k, y + sin(t) * k) : g.moveTo(x + cos(t) * k, y + sin(t) * k);
  }
  g.closePath();
  ink(g, fill, lw);
  g.save();
  g.clip();
  dot(g, x + r * 0.35, y + r * 0.45, r * 0.8, STONE_D);
  dot(g, x - r * 0.3, y - r * 0.35, r * 0.38, STONE_L);
  for (let i = 0; i < 3; i++) {
    const t = a + hash(seed * 3 + i) * TAU, d = r * 0.55 * hash(seed + i * 7);
    dot(g, x + cos(t) * d, y + sin(t) * d, max(1, r * 0.09), STONE_D);
  }
  g.restore();
}

// ---------- Pop words: KRAK!, SKREEEE!, STRIKE! ----------

const FONTS: string[] = [];
const font = (px: number) => (FONTS[px] ??= `900 ${px}px "Arial Black","Arial Bold",Impact,system-ui,sans-serif`);
for (let px = 6; px <= 72; px++) font(px);

/** Up to `cap` words at once: each pops in big, settles, hangs, shrinks away (canvas only). */
export function words(list: string[], cap = 4) {
  const X = new Float32Array(cap), Y = new Float32Array(cap), T = new Float32Array(cap).fill(9), S = new Float32Array(cap), Wd = new Uint8Array(cap), A = new Float32Array(cap);
  let next = 0;
  return {
    /** Pop word `w` at (x, y). A smaller word right after a bigger one waits its turn (it's dropped). */
    say(w: number, x: number, y: number, size = 24, tilt = 0) {
      const j = (next + cap - 1) % cap;
      if (T[j]! < 0.18 && size <= S[j]! && next) return;
      const i = next++ % cap;
      Wd[i] = w;
      T[i] = 0;
      S[i] = size;
      A[i] = tilt;
      X[i] = max(size * list[w]!.length * 0.33 + 4, min(W - size * list[w]!.length * 0.33 - 4, x));
      Y[i] = max(size * 0.6 + 2, min(H - 8, y));
    },
    step(dt: number) {
      let busy = false;
      for (let i = 0; i < cap; i++) if (T[i]! < 1) (T[i] = T[i]! + dt), (busy = true);
      return busy;
    },
    draw(g: CanvasRenderingContext2D) {
      for (let i = 0; i < cap; i++) {
        const t = T[i]!;
        const k = t < 0.07 ? 1.5 - t * 7 : t > 0.82 ? 1 - (t - 0.82) * 5.5 : 1, px = min(72, round(S[i]! * k));
        if (t >= 1 || px < 7) continue;
        g.save();
        g.translate(X[i]!, Y[i]! - (t < 0.07 ? 0 : t * 6));
        g.rotate(A[i]!);
        g.font = font(px);
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = px * 0.32;
        g.strokeStyle = INK;
        g.strokeText(list[Wd[i]!]!, 0, 0);
        g.fillStyle = HAT;
        g.fillText(list[Wd[i]!]!, 0, 0);
        g.restore();
      }
    },
  };
}

// ---------- Dust and chips ----------

export const PUFF = 0, CHIP = 1, STARS = 2;
/** Particles: cartoon dust puffs (grow, drift, shrink), rock chips (fall, bounce) and stars. */
export function bits(rnd: () => number, cap = 180) {
  const X = new Float32Array(cap), Y = new Float32Array(cap), VX = new Float32Array(cap), VY = new Float32Array(cap);
  const L = new Float32Array(cap), M = new Float32Array(cap), S = new Float32Array(cap), K = new Uint8Array(cap), A = new Float32Array(cap);
  let n = 0;
  const api = {
    add(k: number, x: number, y: number, vx: number, vy: number, s: number, life: number) {
      const i = n < cap ? n++ : (rnd() * cap) | 0;
      (X[i] = x), (Y[i] = y), (VX[i] = vx), (VY[i] = vy), (S[i] = s), (L[i] = M[i] = life), (K[i] = k), (A[i] = rnd() * 6);
    },
    /** A ring of dust at (x, y): `k` puffs, spread `sp`. */
    puff(x: number, y: number, k: number, sp: number, s = 9) {
      for (let j = 0; j < k; j++) {
        const t = (j / k) * PI + rnd() * 0.4 - PI;
        api.add(PUFF, x + cos(t) * sp * 0.15, y, cos(t) * sp * (0.5 + rnd() * 0.8), sin(t) * sp * 0.6 - rnd() * 14, s * (0.6 + rnd() * 0.7), 0.45 + rnd() * 0.35);
      }
    },
    chips(x: number, y: number, k: number, sp: number) {
      for (let j = 0; j < k; j++) api.add(CHIP, x, y, (rnd() - 0.5) * sp * 2, -rnd() * sp * 1.4 - 40, 2 + rnd() * 2.5, 0.9 + rnd() * 0.5);
    },
    step(dt: number, floor: number) {
      for (let i = n - 1; i >= 0; i--) {
        if ((L[i] = L[i]! - dt) <= 0) {
          n--;
          (X[i] = X[n]!), (Y[i] = Y[n]!), (VX[i] = VX[n]!), (VY[i] = VY[n]!), (S[i] = S[n]!), (L[i] = L[n]!), (M[i] = M[n]!), (K[i] = K[n]!), (A[i] = A[n]!);
          continue;
        }
        if (K[i] === CHIP) {
          VY[i] = VY[i]! + 900 * dt;
          A[i] = A[i]! + VX[i]! * dt * 0.2;
          if (Y[i]! > floor && VY[i]! > 0) (Y[i] = floor), (VY[i] = -VY[i]! * 0.35), (VX[i] = VX[i]! * 0.6);
        } else {
          const d = 1 - 3 * dt;
          (VX[i] = VX[i]! * d), (VY[i] = VY[i]! * d - (K[i] === PUFF ? 10 * dt : 0));
        }
        X[i] = X[i]! + VX[i]! * dt;
        Y[i] = Y[i]! + VY[i]! * dt;
      }
      return n > 0;
    },
    draw(g: CanvasRenderingContext2D) {
      for (let i = 0; i < n; i++) {
        const u = 1 - L[i]! / M[i]!, x = X[i]!, y = Y[i]!;
        if (K[i] === PUFF) {
          const r = S[i]! * (u < 0.25 ? 0.5 + u * 2 : 1 - (u - 0.25) * 1.2);
          if (r > 1.5) {
            // A little cloud: three puffs under one outline.
            g.beginPath();
            g.arc(x, y, r, 0, TAU);
            g.moveTo(x + r * 1.35, y + r * 0.3);
            g.arc(x + r * 0.7, y + r * 0.3, r * 0.65, 0, TAU);
            g.moveTo(x - r * 0.1, y + r * 0.35);
            g.arc(x - r * 0.7, y + r * 0.35, r * 0.6, 0, TAU);
            g.lineWidth = 2.8;
            g.strokeStyle = INK;
            g.stroke();
            g.fillStyle = DUST;
            g.fill();
          }
        } else if (K[i] === CHIP) {
          const s = S[i]!, a = A[i]!;
          g.beginPath();
          g.moveTo(x + cos(a) * s, y + sin(a) * s);
          g.lineTo(x + cos(a + 2.2) * s, y + sin(a + 2.2) * s);
          g.lineTo(x + cos(a + 4) * s * 0.8, y + sin(a + 4) * s * 0.8);
          g.closePath();
          ink(g, STONE, 1.2);
        } else star(g, x, y, S[i]! * (1 - u * 0.5), A[i]! + u * 4);
      }
    },
    get size() {
      return n;
    },
    clear() {
      n = 0;
    },
  };
  return api;
}

/** A five-point cartoon star (dizzy heads, a strike). */
export function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const t = a + (i * PI) / 5, k = i & 1 ? r * 0.45 : r;
    i ? g.lineTo(x + cos(t) * k, y + sin(t) * k) : g.moveTo(x + cos(t) * k, y + sin(t) * k);
  }
  g.closePath();
  ink(g, HAT, 1.4);
}

// ---------- The page's own elements, as bodies ----------

/** Offsets as page values, made once (art units → cqw: the stage is a size container; degrees). */
const U = Array.from({ length: 1281 }, (_, i) => `${((i - 640) * 100) / W}cqw`);
const DEG = Array.from({ length: 361 }, (_, i) => `${i - 180}deg`);
export const HOME = 0, LOOSE = 1, BACK = 2;

/**
 * The page's real elements (`els`, inside `wrap`) as bodies in the art space. At home each sits
 * where the page put it and springs back from a knock; LOOSE it falls, tumbles and lands on the
 * floor (lying flat); BACK it arcs home. Cracks are a data attribute the stage's CSS draws. Every
 * write goes through the ledger in render, only on change, so Recall gives the page back exactly.
 */
export function bodies(engine: Engine, wrap: HTMLElement, els: HTMLElement[]) {
  const n = els.length, L = engine.ledger;
  const B = els.map(() => ({ x: 0, y: 0, w: 0, h: 0, dx: 0, dy: 0, vx: 0, vy: 0, r: 0, vr: 0, md: HOME, t: 0, ax: 0, ay: 0, ar: 0, wait: 0, crack: 0, rest: 0 }));
  const LX = new Int16Array(n), LY = new Int16Array(n), LR = new Int16Array(n), LC = new Int8Array(n);
  const api = {
    B,
    n,
    /** Home boxes, in art units (offsets ignore transforms, so a knocked element measures home). */
    measure() {
      const k = W / (wrap.clientWidth || W);
      for (let i = 0; i < n; i++) {
        const el = els[i]!, b = B[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        b.x = x * k;
        b.y = y * k;
        b.w = el.offsetWidth * k;
        b.h = el.offsetHeight * k;
      }
    },
    /** A knock at home: it jumps by (vx, vy) and spins by vr, then springs back. */
    kick(i: number, vx: number, vy: number, vr: number) {
      const b = B[i]!;
      if (b.md !== HOME) return;
      b.vx += vx;
      b.vy += vy;
      b.vr += vr;
    },
    loosen(i: number, vx: number, vy: number, vr: number) {
      const b = B[i]!;
      if (b.md === LOOSE) return;
      b.md = LOOSE;
      b.vx = vx;
      b.vy = vy;
      b.vr = vr;
      b.rest = 0;
      b.wait = 0;
    },
    /** Send element i home after `wait` s (from wherever it lies). */
    home(i: number, wait: number) {
      const b = B[i]!;
      if (b.md === LOOSE) b.wait = wait;
    },
    /** The element's centre now (art units). */
    cx: (i: number) => B[i]!.x + B[i]!.w / 2 + B[i]!.dx,
    cy: (i: number) => B[i]!.y + B[i]!.h / 2 + B[i]!.dy,
    /** Steps every body; `floor` is the ground line (0: seen from above, where the piece moves loose
     *  bodies itself); true while anything moves. */
    step(dt: number, floor: number) {
      let busy = false;
      for (let i = 0; i < n; i++) {
        const b = B[i]!;
        if (b.md === HOME) {
          if (b.dx || b.dy || b.r || b.vx || b.vy || b.vr) {
            b.vx += (-320 * b.dx - 16 * b.vx) * dt;
            b.vy += (-320 * b.dy - 16 * b.vy) * dt;
            b.vr += (-260 * b.r - 14 * b.vr) * dt;
            b.dx += b.vx * dt;
            b.dy += b.vy * dt;
            b.r += b.vr * dt;
            if (abs(b.dx) + abs(b.dy) + abs(b.r) < 0.3 && abs(b.vx) + abs(b.vy) + abs(b.vr) < 3) b.dx = b.dy = b.r = b.vx = b.vy = b.vr = 0;
            busy = true;
          }
        } else if (b.md === LOOSE) {
          if (b.wait > 0 && (b.wait -= dt) <= 0) {
            (b.md = BACK), (b.t = 0), (b.ax = b.dx), (b.ay = b.dy), (b.ar = b.r % 360);
            busy = true;
            continue;
          }
          if (b.wait > 0) busy = true;
          // Resting, or seen from above (no gravity: the piece slides it itself).
          if (b.rest || !floor) continue;
          b.vy += 1100 * dt;
          b.dx += b.vx * dt;
          b.dy += b.vy * dt;
          b.r += b.vr * dt;
          const a = (b.r * PI) / 180, hh = abs(cos(a)) * b.h * 0.5 + abs(sin(a)) * b.w * 0.5, hw = abs(cos(a)) * b.w * 0.5 + abs(sin(a)) * b.h * 0.5;
          const cx = b.x + b.w / 2 + b.dx, cy = b.y + b.h / 2 + b.dy;
          if (cx - hw < 0 && b.vx < 0) (b.dx -= cx - hw), (b.vx = -b.vx * 0.5);
          if (cx + hw > W && b.vx > 0) (b.dx -= cx + hw - W), (b.vx = -b.vx * 0.5);
          if (cy + hh >= floor) {
            b.dy -= cy + hh - floor;
            if (b.vy > 140) (b.vy = -b.vy * 0.32), (b.vx *= 0.7), (b.vr *= 0.6);
            else {
              b.vy = 0;
              b.vx *= 1 - min(1, 8 * dt);
              // Lie flat: the nearest quarter turn.
              const q = round(b.r / 90) * 90;
              b.vr = (q - b.r) * 12;
              if (abs(b.vx) < 4 && abs(q - b.r) < 1) (b.r = q), (b.vx = b.vr = 0), (b.rest = 1);
            }
          }
          busy = true;
        } else {
          // BACK: an arc home, a little hop on arrival.
          const u = min(1, (b.t += dt / 0.55)), q = u * u * (3 - 2 * u);
          b.dx = b.ax * (1 - q);
          b.dy = b.ay * (1 - q) - sin(u * PI) * (floor ? 46 : 0);
          b.r = b.ar * (1 - q);
          if (u >= 1) (b.md = HOME), (b.dx = b.dy = b.r = b.vx = b.vr = 0), (b.vy = floor ? -90 : 0), (b.crack = 0);
          busy = true;
        }
      }
      return busy;
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, b = B[i]!;
        const x = max(-640, min(640, round(b.dx))), y = max(-640, min(640, round(b.dy))), r = max(-180, min(180, round(((b.r % 360) + 540) % 360 - 180))), c = b.crack;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--x", U[x + 640]!) : L.unstyle(el, "--x");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", U[y + 640]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", DEG[r + 180]!) : L.unstyle(el, "--r");
        if (c !== LC[i]) (LC[i] = c), L.attr(el, "data-crack", c ? (c > 1 ? "2" : "1") : null);
      }
    },
  };
  return api;
}

/** Circle (x, y, r) against box b at its current offset: the push-out normal and depth, or 0. */
export function hitBox(x: number, y: number, r: number, bx: number, by: number, bw: number, bh: number, out: Float64Array) {
  const nx = max(bx, min(bx + bw, x)), ny = max(by, min(by + bh, y));
  const dx = x - nx, dy = y - ny, d = Math.hypot(dx, dy) || 0.01;
  if (d >= r) return 0;
  out[0] = dx / d;
  out[1] = dy / d;
  out[2] = r - d;
  return 1;
}

// ---------- The Cobbleworths ----------

export const FACE = 0, SHOUT = 1, DIZZY = 2, WHISTLE = 3, GLUM = 4;
/**
 * Bonk Cobbleworth from the waist up: mustard tunic with a zigzag, red beard, a big nose, spiky
 * hair. (x, y) is the middle of his shoulders; his hands go to (ax, ay) and (bx, by), relative.
 */
export function bonk(g: CanvasRenderingContext2D, x: number, y: number, face: number, ax: number, ay: number, bx: number, by: number, now: number) {
  g.beginPath();
  g.moveTo(x - 12, y + 20);
  g.lineTo(x - 8, y);
  g.lineTo(x + 8, y);
  g.lineTo(x + 12, y + 20);
  g.closePath();
  ink(g, TUNIC);
  g.beginPath();
  for (let i = 0; i < 5; i++) g.lineTo(x - 10 + i * 5, y + 10 + (i & 1) * 4);
  g.lineWidth = 2;
  g.strokeStyle = TUNIC_D;
  g.stroke();
  g.beginPath();
  g.moveTo(x - 7, y + 4);
  g.lineTo(x + ax, y + ay);
  g.moveTo(x + 7, y + 4);
  g.lineTo(x + bx, y + by);
  limb(g, 4, SKIN);
  const hy = y - 12;
  g.beginPath();
  for (let i = 0; i < 7; i++) g.lineTo(x - 11 + i * 3.6, hy - 7 - (i & 1 ? 7 : 2));
  g.lineTo(x + 11, hy);
  g.lineTo(x - 11, hy);
  g.closePath();
  ink(g, HAIR, 2);
  oval(g, x, hy, 10, 10, SKIN);
  g.beginPath();
  g.moveTo(x - 10, hy + 1);
  g.quadraticCurveTo(x - 9, hy + 16, x + 1, hy + 15);
  g.quadraticCurveTo(x + 10, hy + 14, x + 10, hy + 1);
  g.quadraticCurveTo(x + 3, hy + 7, x - 10, hy + 1);
  ink(g, BEARD, 2);
  if (face === WHISTLE) (g.beginPath(), g.roundRect(x + 6, hy + 4, 9, 4, 2), ink(g, STONE_L, 1.5));
  else if (face === SHOUT) oval(g, x + 3, hy + 7, 3.5, 3.5, INK, 0, 0.01);
  oval(g, x + 6, hy + 1, 4.5, 3.5, SKIN_D, 0, 1.8);
  g.strokeStyle = INK;
  g.lineWidth = 1.4;
  if (face === DIZZY) {
    for (let s = 0; s < 2; s++) g.beginPath(), g.moveTo(x - 2 + s * 6, hy - 5), g.lineTo(x + 2 + s * 6, hy - 1), g.moveTo(x + 2 + s * 6, hy - 5), g.lineTo(x - 2 + s * 6, hy - 1), g.stroke();
    for (let s = 0; s < 3; s++) star(g, x + cos(now * 7 + s * 2.1) * 14, hy - 16 + sin(now * 7 + s * 2.1) * 3, 4, now * 3);
  } else if (face === GLUM) for (let s = 0; s < 2; s++) g.beginPath(), g.moveTo(x - 2 + s * 6, hy - 3), g.lineTo(x + 2 + s * 6, hy - 4), g.stroke();
  else (dot(g, x, hy - 3, 1.6, INK), dot(g, x + 6, hy - 3, 1.6, INK));
  if (face === WHISTLE) for (let s = 0; s < 2; s++) star(g, x + 22 + s * 10, hy - 6 - s * 8, 4, now * 5);
}

/** Pip Cobbleworth, the kid: an orange top-knot tied with a bone, a leaf-green tunic, big eyes. */
export function pip(g: CanvasRenderingContext2D, x: number, y: number, up: boolean) {
  g.beginPath();
  g.moveTo(x - 8, y + 14);
  g.lineTo(x - 5, y);
  g.lineTo(x + 5, y);
  g.lineTo(x + 8, y + 14);
  g.closePath();
  ink(g, LEAF, 2);
  g.beginPath();
  g.moveTo(x - 5, y + 3);
  g.lineTo(x - (up ? 10 : 9), y + (up ? -12 : 10));
  g.moveTo(x + 5, y + 3);
  g.lineTo(x + (up ? 10 : 9), y + (up ? -12 : 10));
  limb(g, 3, SKIN);
  oval(g, x, y - 8, 8, 8, SKIN, 0, 2);
  oval(g, x, y - 18, 5, 4, CORAL, 0, 2);
  g.beginPath();
  g.moveTo(x - 5, y - 15);
  g.lineTo(x + 5, y - 15);
  limb(g, 2, WHITE);
  oval(g, x - 3, y - 9, 2.4, 2.8, WHITE, 0, 1.2);
  oval(g, x + 3, y - 9, 2.4, 2.8, WHITE, 0, 1.2);
  dot(g, x - 3, y - 8.5, 1.1, INK);
  dot(g, x + 3, y - 8.5, 1.1, INK);
  g.beginPath();
  up ? g.arc(x, y - 4, 2.5, 0, PI) : g.arc(x, y - 4.5, 2, 0.3, PI - 0.3);
  g.lineWidth = 1.3;
  g.strokeStyle = INK;
  up ? (g.fillStyle = INK, g.fill()) : g.stroke();
}
