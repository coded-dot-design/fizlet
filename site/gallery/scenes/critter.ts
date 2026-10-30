// The critter scene: the third scene type. Pixel sprites (fizlet/sprite: pixel art baked once, one
// drawImage each) that move by one motion. A motion is a few small functions the entry imports by
// name (`scene(scatter, {...})`), so an animation ships only its own motion:
//   scatter  out from a point (the tap, a hover, the centre), flapping or tumbling
//   float    up from the bottom edge, swaying        shower  down from the top edge, spinning
//   dangle   down on a thread, hang, climb back       follow  a trail behind the pointer (or a ghost path)
//   watch    eyes whose pupils follow the pointer     march   prints that step across, then fade
//   emerge   up out of the ground, then stay          drift   across, slowly (fog)
//   weave    into the corners, growing (webs)         dance   a row that dances while you scroll
//   ooze     drips that grow from the top edge, then drop
// Bricks: the kernel (settle + fps cap: it sleeps once still) and fizlet/sprite (a bounded tile
// cache; no allocation once baked). Mounted through fizlet/slot, so it loads near the viewport,
// never under reduced motion, and destroy() gives the page back (the canvas goes through the ledger).
import { createEngine, type Engine } from "../../../src/kernel/index";
import { sprites, type SpriteDef } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";

export interface Critters {
  /** The pixel art: frames, and each character's palette slot (a, b, c). */
  sprite: SpriteDef;
  /** Hex colours: `bodies` body colours (slot a, one per critter, picked at random), then slots b, c. */
  colors: string[];
  bodies: number;
  /** Critters a wave (dance, watch, emerge, weave: how many stay on the stage). */
  count: number;
  /** Seconds a critter lives (dangle: hangs; follow, watch: the ghost path; dance: how long it dances). */
  seconds: number;
  /** Speed in px/s (each motion takes it its own way). */
  speed: number;
  /** Gravity in px/s² (heavy critters tumble). */
  gravity: number;
  /** Spin in rad/s at most (0: upright). */
  spin: number;
  /** Animation frames a second (0: the first frame only). */
  fps: number;
  /** Seconds between automatic waves while visible; 0: on mount and on input only (then it sleeps). */
  loop: number;
  /** Pixels per sprite pixel. */
  scale: number;
  /** A hover starts a wave where the pointer comes in (as a tap does). */
  hover: boolean;
}

const CAP = 64, TAU = 6.2832;
// Scene state slots (s): width, height, dpr, resized, trigger pending, trigger x, trigger y, loop
// timer, pointer x, pointer y, pointer moved, five for the motion (m0-m4), next free critter, and
// the tap that loaded the scene (pending, x, y), and this step's dt (read from here: a double passed
// to a call that is not inlined is boxed, one object per critter per frame); then where `add` puts
// the next critter (x, y, vx, vy, life), written by the caller for the same reason.
const SX = 21, SY = 22, SVX = 23, SVY = 24, SL = 25;
const W = 0, H = 1, DPR = 2, RS = 3, TP = 4, TX = 5, TY = 6, LT = 7, PX = 8, PY = 9, PM = 10, M0 = 11, M1 = 12, M2 = 13, M3 = 14, M4 = 15, NX = 16, FT = 17, FX = 18, FY = 19, DT = 20;

/** The critters, struct of arrays: no object a frame. */
export interface C {
  p: Critters;
  s: Float64Array;
  on: Uint8Array;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; r: Float32Array; vr: Float32Array;
  age: Float32Array; life: Float32Array; ph: Float32Array; pal: Uint8Array; aux: Float32Array; sc: Float32Array; a: Float32Array;
  /** Sprite size in sprite pixels. */
  sw: number; sh: number;
  ctx: CanvasRenderingContext2D;
}

/**
 * A motion: `start` a wave from (x, y) (-1: its own place), `move` critter i by this step's `c.s[DT]` (0 done,
 * 1 moving, 2 at rest: drawn, no frame needed), and optional hooks: `tick` once a step (true: still busy),
 * `point` when the pointer moves, `back`/`front` paint under/over every critter, `under`/`over`
 * paint under/over one critter.
 */
export interface Motion {
  start(c: C, e: Engine, x: number, y: number): void;
  move(c: C, e: Engine, i: number): number;
  tick?(c: C, e: Engine): boolean;
  point?(c: C, x: number, y: number): void;
  back?(c: C): void;
  under?(c: C, i: number): void;
  over?(c: C, i: number): void;
  front?(c: C): void;
  /** The page's scroll starts a wave too (dance). */
  scroll?: boolean;
  /** Critters stay once at rest: a new wave keeps them (placed once). */
  keep?: boolean;
}

/** A free critter at s[SX], s[SY], moving (s[SVX], s[SVY]), living s[SL] s (Infinity: until its motion ends it); its index or -1. */
export function add(c: C, e: Engine) {
  const x = c.s[SX]!, y = c.s[SY]!, vx = c.s[SVX]!, vy = c.s[SVY]!, life = c.s[SL]!;
  let i = c.s[NX]!;
  for (let k = 0; k < CAP && c.on[i]; k++) i = (i + 1) % CAP;
  if (c.on[i]) return -1;
  c.s[NX] = (i + 1) % CAP;
  c.on[i] = 1;
  c.x[i] = x; c.y[i] = y; c.vx[i] = vx; c.vy[i] = vy; c.r[i] = 0; c.vr[i] = (e.random() - 0.5) * 2 * c.p.spin;
  c.age[i] = 0; c.life[i] = life; c.ph[i] = e.random(); c.pal[i] = (e.random() * c.p.bodies) | 0; c.aux[i] = 0; c.sc[i] = 1; c.a[i] = 1;
  return i;
}
/** Fade the last 0.4 s of a critter's life; 0 once it is over. */
const fade = (c: C, i: number) => {
  const left = c.life[i]! - c.age[i]!;
  c.a[i] = left < 0.4 ? (left > 0 ? left / 0.4 : 0) : 1;
  return left > 0 ? 1 : 0;
};
const ease = (t: number) => (t >= 1 ? 1 : 1 - (1 - t) * (1 - t) * (1 - t));
/** Sprite pixels → stage px for critter i: whole pixels (crisp pixel art; at least 1 once it shows). */
const px = (c: C, i: number) => {
  const v = c.p.scale * c.sc[i]!;
  return v < 0.5 ? v : Math.round(v);
};

// ---------- motions ----------

export const scatter: Motion = {
  start(c, e, x, y) {
    const w = c.s[W]!, h = c.s[H]!, X = x >= 0 ? x : w / 2, Y = x >= 0 ? y : h / 2, v = c.p.speed;
    for (let k = 0; k < c.p.count; k++) {
      const a = e.random() * TAU, s = v * (0.45 + e.random() * 0.75);
      ((c.s[SX] = X), (c.s[SY] = Y), (c.s[SVX] = Math.cos(a) * s), (c.s[SVY] = Math.sin(a) * s - v * 0.35), (c.s[SL] = c.p.seconds * (0.7 + e.random() * 0.6)), add(c, e));
    }
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    const d = 1 - Math.min(1, dt * 1.2);
    c.vy[i] = c.vy[i]! + c.p.gravity * dt;
    c.vx[i] = c.vx[i]! * d;
    c.x[i] = c.x[i]! + c.vx[i]! * dt + Math.sin(c.age[i]! * 7 + c.ph[i]! * TAU) * 22 * dt;
    c.y[i] = c.y[i]! + c.vy[i]! * dt;
    c.r[i] = c.r[i]! + c.vr[i]! * dt;
    return fade(c, i);
  },
};

export const float: Motion = {
  start(c, e, x) {
    const w = c.s[W]!, h = c.s[H]!;
    for (let k = 0; k < c.p.count; k++)
      ((c.s[SX] = x >= 0 ? x + (e.random() - 0.5) * w * 0.3 : e.random() * w), (c.s[SY] = h + 12 + e.random() * h * 0.25), (c.s[SVX] = 0), (c.s[SVY] = -c.p.speed * (0.6 + e.random() * 0.8)), (c.s[SL] = c.p.seconds), add(c, e));
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    c.x[i] = c.x[i]! + Math.sin(c.age[i]! * 2.2 + c.ph[i]! * TAU) * c.p.speed * 0.5 * dt;
    c.vy[i] = c.vy[i]! + c.p.gravity * dt;
    c.y[i] = c.y[i]! + c.vy[i]! * dt;
    c.r[i] = c.r[i]! + c.vr[i]! * dt;
    return c.y[i]! < -c.sh * px(c, i) ? 0 : fade(c, i);
  },
};

export const shower: Motion = {
  start(c, e, x) {
    const w = c.s[W]!, h = c.s[H]!;
    for (let k = 0; k < c.p.count; k++)
      ((c.s[SX] = x >= 0 ? x + (e.random() - 0.5) * w * 0.3 : e.random() * w), (c.s[SY] = -12 - e.random() * h * 0.6), (c.s[SVX] = 0), (c.s[SVY] = c.p.speed * (0.6 + e.random() * 0.8)), (c.s[SL] = c.p.seconds), add(c, e));
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    c.vy[i] = c.vy[i]! + c.p.gravity * dt;
    c.y[i] = c.y[i]! + c.vy[i]! * dt;
    c.x[i] = c.x[i]! + Math.sin(c.age[i]! * 3 + c.ph[i]! * TAU) * 14 * dt;
    c.r[i] = c.r[i]! + c.vr[i]! * dt;
    return c.y[i]! > c.s[H]! + c.sh * px(c, i) ? 0 : fade(c, i);
  },
};

/** Down on a thread (1 s), hang `seconds`, back up (1 s). aux: how far down. */
export const dangle: Motion = {
  start(c, e, x, y) {
    const w = c.s[W]!, h = c.s[H]!, n = x >= 0 ? 1 : c.p.count;
    for (let k = 0; k < n; k++) {
      const i = ((c.s[SX] = x >= 0 ? x : ((k + 0.5 + (e.random() - 0.5) * 0.6) / n) * w), (c.s[SY] = -20), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = c.p.seconds + 2), add(c, e));
      if (i < 0) return;
      c.aux[i] = x >= 0 ? Math.max(20, y) : h * (0.25 + e.random() * 0.45);
      c.age[i] = x >= 0 ? 0 : -e.random() * 0.5;
    }
  },
  move(c, _e, i) {
    const t = c.age[i]!, d = c.aux[i]!, top = -c.sh * px(c, i);
    if (t < 0) c.y[i] = top;
    else if (t < 1) c.y[i] = top + (d - top) * ease(t);
    else if (t < 1 + c.p.seconds) c.y[i] = d + Math.sin((t - 1) * 2.5 + c.ph[i]! * TAU) * 4 * c.p.scale;
    else c.y[i] = d + (top - d) * Math.min(1, (t - 1 - c.p.seconds) ** 2);
    return t < c.life[i]! ? 1 : 0;
  },
  under(c, i) {
    // The thread: from the top edge to the critter, in slot c (else b).
    const { ctx, p } = c;
    ctx.fillStyle = p.colors[p.colors.length - 1]!;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(Math.round(c.x[i]!), 0, Math.max(1, p.scale / 2), Math.max(0, c.y[i]! - (c.sh / 2) * px(c, i)));
  },
};

/** Behind the pointer: a critter every 14 px it moves; with no pointer, a ghost path for `seconds`. m0: path time left, m1: path clock, m2: emit clock. */
export const follow: Motion = {
  start(c, _e, x, y) {
    if (x >= 0) (c.s[PX] = x), (c.s[PY] = y), (c.s[PM] = 1);
    else c.s[M0] = c.p.seconds;
  },
  tick(c, e) {
    const dt = c.s[DT]!;
    if (c.s[PM]) (c.s[PM] = 0), ((c.s[SX] = c.s[PX]!), (c.s[SY] = c.s[PY]!), (c.s[SVX] = 0), (c.s[SVY] = -12), (c.s[SL] = 0.9), add(c, e));
    if (c.s[M0]! <= 0) return false;
    c.s[M0] = c.s[M0]! - dt;
    const t = (c.s[M1] = c.s[M1]! + dt), w = c.s[W]!, h = c.s[H]!;
    if ((c.s[M2] = c.s[M2]! + dt) >= 0.06) {
      c.s[M2] = 0;
      ((c.s[SX] = w * (0.5 + 0.38 * Math.sin(t * 1.7))), (c.s[SY] = h * (0.5 + 0.32 * Math.sin(t * 2.9))), (c.s[SVX] = 0), (c.s[SVY] = -12), (c.s[SL] = 0.9), add(c, e));
    }
    return true;
  },
  point(c, x, y) {
    const dx = x - c.s[PX]!, dy = y - c.s[PY]!;
    if (dx * dx + dy * dy < 196 * c.p.scale) return;
    c.s[PX] = x; c.s[PY] = y; c.s[PM] = 1;
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    c.y[i] = c.y[i]! + c.vy[i]! * dt;
    c.x[i] = c.x[i]! + Math.sin(c.age[i]! * 5 + c.ph[i]! * TAU) * 10 * dt;
    c.sc[i] = 1 - (c.age[i]! / c.life[i]!) * 0.5;
    c.a[i] = 0.85 * (1 - c.age[i]! / c.life[i]!);
    return c.age[i]! < c.life[i]! ? 1 : 0;
  },
};

/** Eyes on a grid that stay; the pupils turn to the pointer (or a look-around for `seconds`). m0: look-around left, m1: placed. vx, vy: pupil offset. */
export const watch: Motion = {
  keep: true,
  start(c, e, x, y) {
    const w = c.s[W]!, h = c.s[H]!, n = c.p.count;
    if (!c.s[M1]) {
      c.s[M1] = 1;
      const cols = Math.max(1, Math.round(Math.sqrt((n * w) / Math.max(1, h)))), rows = Math.ceil(n / cols);
      for (let k = 0; k < n; k++) {
        const i = ((c.s[SX] = ((k % cols) + 0.5 + (e.random() - 0.5) * 0.4) / cols * w), (c.s[SY] = (((k / cols) | 0) + 0.5 + (e.random() - 0.5) * 0.3) / rows * h), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
        if (i >= 0) c.sc[i] = 0.7 + e.random() * 0.6;
      }
    }
    if (x >= 0) watch.point!(c, x, y);
    else c.s[M0] = c.p.seconds;
  },
  tick(c, _e) {
    const dt = c.s[DT]!;
    if (c.s[M0]! <= 0) return false;
    const t = (c.s[M0] = c.s[M0]! - dt), w = c.s[W]!, h = c.s[H]!;
    c.s[PX] = t > 0 ? w * (0.5 + 0.6 * Math.sin(t * 2.1)) : w / 2;
    c.s[PY] = t > 0 ? h * (0.5 + 0.5 * Math.cos(t * 1.3)) : h / 2;
    return true;
  },
  point(c, x, y) {
    c.s[PX] = x; c.s[PY] = y; c.s[M0] = 0;
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    const dx = c.s[PX]! - c.x[i]!, dy = c.s[PY]! - c.y[i]!, d = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(d / 40, 1) * 2.2 * px(c, i);
    const tx = (dx / d) * m - c.vx[i]!, ty = (dy / d) * m - c.vy[i]!, k = Math.min(1, dt * 12);
    c.vx[i] = c.vx[i]! + tx * k;
    c.vy[i] = c.vy[i]! + ty * k;
    return tx * tx + ty * ty > 0.04 ? 1 : 2;
  },
  over(c, i) {
    // The pupil: slot c, with a dark core (slot b's darker twin is not a token: the canvas shows through).
    const { ctx, p } = c, s = px(c, i), x = c.x[i]! + c.vx[i]!, y = c.y[i]! + c.vy[i]!;
    ctx.fillStyle = p.colors[p.colors.length - 1]!;
    ctx.fillRect(Math.round(x - 1.5 * s), Math.round(y - 1.5 * s), Math.ceil(3 * s), Math.ceil(3 * s));
    ctx.clearRect(Math.round(x - 0.5 * s), Math.round(y - 0.5 * s), Math.ceil(s), Math.ceil(s));
  },
};

/** Prints stepping across (from the left edge, or from a tap): a walker leaves one every 1/fps s, left foot then right; each fades. m0: walking, m1: x, m2: y, m3: steps, m4: step clock. */
export const march: Motion = {
  start(c, e, x, y) {
    c.s[M0] = 1; c.s[M1] = x >= 0 ? x : -8; c.s[M2] = y >= 0 ? y : c.s[H]! * (0.3 + e.random() * 0.4); c.s[M3] = 0; c.s[M4] = 1;
  },
  tick(c, e) {
    const dt = c.s[DT]!;
    if (!c.s[M0]) return false;
    if ((c.s[M4] = c.s[M4]! + dt) < 1 / c.p.fps) return true;
    c.s[M4] = 0;
    const n = c.s[M3]!, side = n % 2 ? 1 : -1, s = c.p.scale, a = Math.sin(n * 0.5) * 0.25;
    const i = ((c.s[SX] = c.s[M1]!), (c.s[SY] = c.s[M2]! + side * 5 * s), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = c.p.seconds), add(c, e));
    if (i >= 0) c.r[i] = a + 1.5708;
    c.s[M1] = c.s[M1]! + Math.cos(a) * 12 * s;
    c.s[M2] = c.s[M2]! + Math.sin(a) * 12 * s;
    c.s[M3] = n + 1;
    if (c.s[M1]! > c.s[W]! + 8 || n + 1 >= c.p.count) c.s[M0] = 0;
    return true;
  },
  move: (c, _e, i) => fade(c, i),
};

/** Up out of the ground (a band along the bottom), then they stay. aux: rest y. */
export const emerge: Motion = {
  keep: true,
  start(c, e, x) {
    const w = c.s[W]!, h = c.s[H]!, n = x >= 0 ? 1 : c.p.count;
    // A new wave raises them again: the old ones go (a tap adds one where it lands).
    if (x < 0) c.on.fill(0);
    for (let k = 0; k < n; k++) {
      const i = ((c.s[SX] = x >= 0 ? x : ((k + 0.5 + (e.random() - 0.5) * 0.5) / n) * w), (c.s[SY] = h + 40), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
      if (i < 0) return;
      c.sc[i] = 0.8 + e.random() * 0.4;
      c.aux[i] = h * 0.9 - (c.sh / 2) * px(c, i);
      c.age[i] = x >= 0 ? 0 : -k * 0.18;
    }
  },
  move(c, _e, i) {
    const t = c.age[i]! / 0.7, g = c.s[H]! * 0.9 + (c.sh / 2) * px(c, i);
    if (t >= 1) return (c.y[i] = c.aux[i]!), 2;
    const u = t < 0 ? 0 : t, b = 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2; // ease out, a little overshoot
    c.y[i] = g + (c.aux[i]! - g) * b;
    c.r[i] = Math.sin(u * 14) * 0.08 * (1 - u);
    return 1;
  },
  front(c) {
    // The ground: hides what has not come up yet.
    const { ctx, p } = c, h = c.s[H]!;
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.colors[p.colors.length - 1]!;
    ctx.fillRect(0, Math.round(h * 0.9), c.s[W]!, 2 * p.scale);
    ctx.clearRect(0, Math.round(h * 0.9) + 2 * p.scale, c.s[W]!, h);
  },
};

/** Across, slowly, see-through (fog): each lives `seconds` (fading in and out), so it settles. */
export const drift: Motion = {
  start(c, e, x, y) {
    const w = c.s[W]!, h = c.s[H]!, n = x >= 0 ? 2 : c.p.count;
    for (let k = 0; k < n; k++) {
      const i = ((c.s[SX] = x >= 0 ? x + (k - 0.5) * 30 : (e.random() * 1.3 - 0.6) * w), (c.s[SY] = x >= 0 ? y + (e.random() - 0.5) * 20 : h * (0.25 + e.random() * 0.7)), (c.s[SVX] = c.p.speed * (0.5 + e.random())), (c.s[SVY] = 0), (c.s[SL] = c.p.seconds * (0.8 + e.random() * 0.4)), add(c, e));
      if (i >= 0) c.sc[i] = 0.8 + e.random() * 0.9;
    }
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    c.x[i] = c.x[i]! + c.vx[i]! * dt;
    c.y[i] = c.y[i]! + Math.sin(c.age[i]! * 0.9 + c.ph[i]! * TAU) * 4 * dt;
    c.a[i] = Math.max(0, Math.min(0.55, c.age[i]! * 1.5, (c.life[i]! - c.age[i]!) * 0.6));
    return c.age[i]! < c.life[i]! && c.x[i]! - (c.sw / 2) * px(c, i) < c.s[W]! ? 1 : 0;
  },
};

/** Into the corners, growing and turning in; they stay (a tap spins one where it lands). */
export const weave: Motion = {
  keep: true,
  start(c, e, x, y) {
    const w = c.s[W]!, h = c.s[H]!;
    if (x >= 0) {
      const i = ((c.s[SX] = x), (c.s[SY] = y), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
      if (i >= 0) (c.aux[i] = e.random() * TAU), (c.sc[i] = 0);
      return;
    }
    c.on.fill(0);
    for (let k = 0; k < Math.min(4, c.p.count); k++) {
      const i = ((c.s[SX] = k === 1 || k === 2 ? w : 0), (c.s[SY] = k >= 2 ? h : 0), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
      if (i < 0) return;
      c.aux[i] = k * 1.5708;
      c.age[i] = -k * 0.25;
      c.sc[i] = 0;
    }
  },
  move(c, _e, i) {
    const t = Math.max(0, c.age[i]! / c.p.seconds), u = ease(t);
    c.sc[i] = u;
    c.r[i] = c.aux[i]! - (1 - u) * 1.2;
    return t >= 1 ? 2 : 1;
  },
};

/** A row along the bottom that dances while you scroll (or tap), then stands still. m0: energy, m1: placed. aux: rest y. */
export const dance: Motion = {
  keep: true,
  scroll: true,
  start(c, e) {
    const w = c.s[W]!, h = c.s[H]!, n = c.p.count;
    if (!c.s[M1]) {
      c.s[M1] = 1;
      for (let k = 0; k < n; k++) {
        const i = ((c.s[SX] = ((k + 0.5) / n) * w), (c.s[SY] = 0), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
        if (i >= 0) c.aux[i] = h * 0.88 - (c.sh / 2) * px(c, i);
      }
    }
    c.s[M0] = 1;
  },
  tick(c, _e) {
    const dt = c.s[DT]!;
    if (c.s[M0]! <= 0) return false;
    c.s[M0] = c.s[M0]! - dt / c.p.seconds;
    return true;
  },
  move(c, _e, i) {
    const en = c.s[M0]!;
    if (en <= 0) return (c.age[i] = 0), (c.y[i] = c.aux[i]!), (c.r[i] = 0), 2;
    const t = c.age[i]! * c.p.fps + c.ph[i]!;
    c.y[i] = c.aux[i]! - Math.abs(Math.sin(t * 1.5708)) * 8 * c.p.scale * Math.min(1, en * 3);
    c.r[i] = Math.sin(t * 1.5708 + c.ph[i]! * 3) * 0.15 * Math.min(1, en * 3);
    return 1;
  },
};

/** Drips that grow down from the top edge, then let go and fall. aux: drip length; vx: the stem left; vr: 0 growing, 1 falling. */
export const ooze: Motion = {
  start(c, e, x) {
    const w = c.s[W]!, h = c.s[H]!, n = x >= 0 ? 1 : c.p.count;
    for (let k = 0; k < n; k++) {
      const i = ((c.s[SX] = x >= 0 ? x : e.random() * w), (c.s[SY] = 0), (c.s[SVX] = 0), (c.s[SVY] = 0), (c.s[SL] = Infinity), add(c, e));
      if (i < 0) return;
      c.aux[i] = h * (0.1 + e.random() * 0.3);
      c.vy[i] = (c.aux[i]! / c.p.seconds) * (0.6 + e.random() * 0.8);
      c.age[i] = x >= 0 ? 0 : -e.random() * c.p.seconds * 0.6;
      c.vr[i] = 0;
      c.r[i] = 0;
    }
  },
  move(c, _e, i) {
    const dt = c.s[DT]!;
    if (c.age[i]! < 0) return 1;
    if (!c.vr[i]) {
      c.y[i] = c.y[i]! + c.vy[i]! * dt;
      c.vx[i] = c.y[i]!;
      if (c.y[i]! >= c.aux[i]!) (c.vr[i] = 1), (c.vy[i] = 0);
      return 1;
    }
    c.vy[i] = c.vy[i]! + c.p.gravity * dt;
    c.y[i] = c.y[i]! + c.vy[i]! * dt;
    c.vx[i] = Math.max(0, c.vx[i]! - c.aux[i]! * 2 * dt);
    return c.y[i]! > c.s[H]! + 20 && c.vx[i]! <= 0 ? 0 : 1;
  },
  back(c) {
    // The ooze along the top edge it drips from.
    const { ctx, p } = c;
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.colors[0]!;
    ctx.fillRect(0, 0, c.s[W]!, 2 * p.scale);
  },
  under(c, i) {
    const { ctx, p } = c, s = p.scale;
    ctx.fillStyle = p.colors[c.pal[i]!]!;
    ctx.fillRect(Math.round(c.x[i]! - s), 0, Math.ceil(2 * s), Math.round(c.vx[i]!));
  },
};

// ---------- the scene ----------

export type CritterScene = SlotScene & { engine: Engine; play(x?: number, y?: number): void };

export function critters(stage: HTMLElement, m: Motion, p: Critters, first: SlotTap | null = null): CritterScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  // One palette per body colour; slots b and c are shared.
  const pals: Record<string, string>[] = [];
  for (let b = 0; b < p.bodies; b++) pals.push({ a: p.colors[b]!, b: p.colors[p.bodies] ?? p.colors[0]!, c: p.colors[p.bodies + 1] ?? p.colors[p.bodies] ?? p.colors[0]! });
  const art = sprites({ s: p.sprite }, { palettes: pals, cap: 64 });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
  stage.append(canvas);
  const f32 = () => new Float32Array(CAP);
  const c: C = {
    p, s: new Float64Array(SL + 1), on: new Uint8Array(CAP), pal: new Uint8Array(CAP),
    x: f32(), y: f32(), vx: f32(), vy: f32(), r: f32(), vr: f32(), age: f32(), life: f32(), ph: f32(), aux: f32(), sc: f32(), a: f32(),
    sw: art.w[0]!, sh: art.h[0]!, ctx: canvas.getContext("2d")!,
  };
  const s = c.s, ctx = c.ctx, ax = p.sprite.ax ?? c.sw / 2, ay = p.sprite.ay ?? c.sh / 2;
  ctx.imageSmoothingEnabled = false;
  s[DPR] = 1; s[RS] = 1; s[TP] = 1; s[TX] = -1; s[TY] = -1; s[PX] = -1e4; s[PY] = -1e4;
  const ro = new ResizeObserver(() => ((s[RS] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = (x = -1, y = -1) => ((s[TX] = x), (s[TY] = y), (s[TP] = 1), engine.wake());
  // The tap that loaded the scene: honoured after the mount wave, once the stage has a size.
  if (first) (s[FT] = 1), (s[FX] = first.x), (s[FY] = first.y);
  const at = (ev: PointerEvent, f: (x: number, y: number) => void) => {
    const r = stage.getBoundingClientRect(); // one read per input, outside any frame
    f(ev.clientX - r.left, ev.clientY - r.top);
  };
  const o = { signal: engine.signal };
  stage.addEventListener("pointerdown", (ev) => at(ev, play), o);
  if (p.hover) stage.addEventListener("pointerenter", (ev) => at(ev, play), o);
  if (m.point) stage.addEventListener("pointermove", (ev) => at(ev, (x, y) => (m.point!(c, x, y), engine.wake())), o);
  if (m.scroll) addEventListener("scroll", () => play(), { signal: engine.signal, passive: true, capture: true });

  function paint() {
    const w = s[W]!, h = s[H]!, d = s[DPR]!;
    // A new size resets the context: scale it once then (a per-frame setTransform with a double boxes it).
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) (canvas.width = Math.round(w * d)), (canvas.height = Math.round(h * d)), ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (m.back) m.back(c);
    for (let i = 0; i < CAP; i++) {
      if (!c.on[i] || c.age[i]! < 0) continue;
      ctx.globalAlpha = c.a[i]!;
      if (m.under) m.under(c, i), (ctx.globalAlpha = c.a[i]!);
      // The baked tile (whole-number arguments: nothing boxes), drawn here with the canvas API.
      const k = px(c, i), t = art.tile(0, p.fps > 0 ? (c.age[i]! * p.fps + c.ph[i]! * 4) | 0 : 0, k < 1 ? 1 : k, c.pal[i]!), r = c.r[i]!;
      // Whole numbers only: drawImage has overloads (no fast call), so a fractional argument is boxed.
      const dw = Math.round(c.sw * k), dh = Math.round(c.sh * k), ox = 0 - Math.round(ax * k), oy = 0 - Math.round(ay * k); // 0 - n: never -0 (a -0 is boxed)
      if (r) ctx.save(), ctx.translate(Math.round(c.x[i]!), Math.round(c.y[i]!)), ctx.rotate(r), ctx.drawImage(t, ox, oy, dw, dh), ctx.restore();
      else ctx.drawImage(t, Math.round(c.x[i]!) + ox, Math.round(c.y[i]!) + oy, dw, dh);
      if (m.over) m.over(c, i);
    }
    ctx.globalAlpha = 1;
    if (m.front) m.front(c);
  }
  engine.add({
    read() {
      if (!s[RS]) return;
      s[RS] = 0;
      s[W] = stage.clientWidth;
      s[H] = stage.clientHeight;
      s[DPR] = Math.min(2, devicePixelRatio || 1);
    },
    step(e, dt) {
      if (!s[W]) return;
      if (s[TP]) {
        s[TP] = 0;
        m.start(c, e, s[TX]!, s[TY]!);
      }
      if (s[FT]) (s[FT] = 0), m.start(c, e, s[FX]!, s[FY]!);
      if (p.loop > 0 && (s[LT] = s[LT]! + dt) >= p.loop) (s[LT] = 0), m.start(c, e, -1, -1);
      s[DT] = dt;
      let busy = m.tick ? m.tick(c, e) : false;
      for (let i = 0; i < CAP; i++) {
        if (!c.on[i]) continue;
        c.age[i] = c.age[i]! + dt;
        const r = m.move(c, e, i);
        if (!r) c.on[i] = 0;
        if (r === 1) busy = true;
      }
      if (busy || p.loop > 0) e.busy();
    },
    // A tiny hook V8 inlines: the frame's alpha (a double) is never boxed to call it.
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for this motion and these params: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export const scene = (m: Motion, p: Critters) => (stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null) => critters(stage, m, p, first);
