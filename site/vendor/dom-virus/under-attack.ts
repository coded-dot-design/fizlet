/* Vendored from https://github.com/coded-dot-design/dom-virus @ 248d1e9 by scripts/vendor-dom-virus.mjs: site-kit/hero-scene.ts. Do not edit; change it in dom-virus and vendor again. */
/**
 * The home hero on Fizlet: one scene for the scripted crossover (intro, then the 8 s loop) and the
 * mini-game the first tap starts. It moves the poster's own SVG (HeroScene.astro), so the look is
 * the markup's; hero-data.ts is the script both read.
 *
 * - Kernel clock: fixed steps at 60 fps (capped). The intro and loop are keyframe tracks evaluated
 *   at the scene time (state in typed arrays); the game is a small simulation. A step never
 *   allocates, reads layout or writes the DOM.
 * - Every page write goes through the engine's ledger (change-only), nodes it adds included, so
 *   destroy() (Recall) gives the poster back byte for byte.
 * - Calm: paused by the scene's pause key, off screen or in a hidden tab (no frames at all). The loop
 *   rests on its first frame after LOOPS cycles nobody touched and the engine settles; coming back
 *   into view or a pointer over the card plays it again. Mounted by fizlet/slot, so reduced motion
 *   keeps the still poster and the scene never loads.
 * Play: bad guys keep spawning and self-destruct after a few seconds; both shooters auto-aim and
 * auto-fire (spread makes some miss); tap a bad guy to squash it; drag the tank; tap the tank to
 * spin its turret in a 360 spray; tap the plane to spin it and fire a burst (tap faster for more);
 * every two minutes an alarm counts down and a nuke resets the round (BUTTON_01 nukes at once).
 */
import { createEngine } from "../../../src/kernel/engine";
import type { SlotMount, SlotTap } from "../../../src/slot";
import { FOES, KILLS, MISSES, SHARDS, TONES, PLANE, TANK, INTRO, LOOP, aimStart, foeColor } from "./hero-data";

type El = HTMLElement | SVGElement;
const NS = "http://www.w3.org/2000/svg";
/** Cycles the loop plays before it rests (and the engine settles) when nobody touches the card. */
const LOOPS = 3;
const ROUND = 120, ALARM = 10, FOE_CAP = 26, SHOT_CAP = 60, BOOM_CAP = 14, SHOT_SPEED = 620;

// ---------- keyframes ----------
// Channels of one element's row: translate x, y (px), rotate (deg), scale, opacity, brightness, shown.
const TX = 0, TY = 1, ROT = 2, SC = 3, OP = 4, BR = 5, SHOW = 6, ROW = 7;
// Timing functions, as CSS applies them (per keyframe interval). 0 linear, n > 0 cubic-bezier row
// n of BZ, n < 0 steps(-n).
const EASE = 1, IN_OUT = 2, OUT = 3, POP = 4, FLY = 5, DRIVE = 6, TURN = 7, BURST = 8;
const BZ = [0, 0, 1, 1, 0.25, 0.1, 0.25, 1, 0.42, 0, 0.58, 1, 0, 0, 0.58, 1, 0.3, 1.6, 0.5, 1, 0.2, 0.8, 0.3, 1, 0.25, 1.3, 0.5, 1, 0.3, 0.8, 0.3, 1, 0.15, 0.8, 0.3, 1];
function ease(e: number, x: number) {
  if (e < 0) return Math.floor(x * -e) / -e;
  if (!e) return x;
  const x1 = BZ[e * 4]!, y1 = BZ[e * 4 + 1]!, x2 = BZ[e * 4 + 2]!, y2 = BZ[e * 4 + 3]!;
  let lo = 0, hi = 1, t = x;
  for (let k = 0; k < 18; k++) {
    const u = 1 - t, bx = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
    if (bx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  const u = 1 - t;
  return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
}
/** One channel's keyframes as [offset, value, offset, value, …], first offset 0, last 1. */
function sample(k: Float64Array, x: number, e: number) {
  const n = k.length - 2;
  let i = 0;
  while (i < n && x >= k[i + 2]!) i += 2;
  if (i >= n) return k[n + 1]!;
  return k[i + 1]! + (k[i + 3]! - k[i + 1]!) * ease(e, (x - k[i]!) / (k[i + 2]! - k[i]!));
}
/** An animation: timing function and channels (channel id, keys). */
interface Def {
  e: number;
  c: [number, Float64Array][];
  m: number;
}
const def = (e: number, ch: Record<number, number[]>): Def => {
  const c = Object.entries(ch).map(([k, v]) => [+k, Float64Array.from(v)] as [number, Float64Array]);
  return { e, c, m: c.reduce((m, [k]) => m | (1 << k), 0) };
};
/** Keys from (seconds into an 8 s loop, value) pairs: sorted, the later of two equal offsets wins. */
const keys = (pairs: [number, number][], at0: number, at1 = at0) => {
  const m = new Map<number, number>([[0, at0], [1, at1]]);
  for (const [t, v] of pairs) m.set(t / LOOP, v);
  return [...m].sort((a, b) => a[0] - b[0]).flat();
};
// The blast (fractions of the 8 s loop): flash, core, ring, square ring, ten shards.
const BOOM: Def[] = [
  def(EASE, { [SC]: [0, 0.3, 0.015, 3.2, 0.04, 4, 1, 4], [OP]: [0, 1, 0.015, 1, 0.04, 0, 1, 0] }),
  def(EASE, { [SC]: [0, 0.4, 0.025, 2.6, 0.06, 0.2, 1, 0.2], [OP]: [0, 1, 0.025, 1, 0.06, 0, 1, 0] }),
  def(EASE, { [SC]: [0, 0.5, 0.06, 6, 1, 6], [OP]: [0, 1, 0.06, 0, 1, 0] }),
  def(EASE, { [SC]: [0, 0.4, 0.08, 4.6, 1, 4.6], [ROT]: [0, 0, 0.08, 90, 1, 90], [OP]: [0, 1, 0.08, 0, 1, 0] }),
  ...SHARDS.map((s) =>
    def(BURST, { [TX]: [0, 0, 0.07, s.dx, 1, s.dx], [TY]: [0, 0, 0.07, s.dy, 0.09, s.dy + 14, 1, s.dy + 14], [ROT]: [0, 0, 0.07, s.r, 1, s.r], [OP]: [0, 1, 0.07, 1, 0.09, 0, 1, 0] }),
  ),
];
const BOOM_END = 0.72, PARTS = BOOM.length;
const boomMarkup = (c: string) =>
  `<circle class="promo-motion boom-flash" r="16" fill="#fff4ff"/><circle class="promo-motion" r="12" fill="#ffe14d"/><circle class="promo-motion" r="14" stroke="${c}" stroke-width="4"/><rect class="promo-motion" x="-14" y="-14" width="28" height="28" stroke="#f4457a" stroke-width="3"/>` +
  SHARDS.map((s, j) => `<rect class="promo-motion" x="${-s.s / 2}" y="${-s.s / 2}" width="${s.s}" height="${s.s}" fill="${j % 3 ? TONES[j % 4] : c}"/>`).join("");
// A bad guy popping in, and the game's screen shake (amplitude 1 = 3 px).
const SPAWN = def(POP, { [SC]: [0, 0, 0.6, 1.3, 1, 1], [ROT]: [0, -40, 0.6, 6, 1, 0], [OP]: [0, 0, 0.6, 1, 1, 1] });
const SHAKE = def(0, { [TX]: [0, 0, 1 / 3, -3, 2 / 3, 3, 1, 0], [TY]: [0, 0, 1 / 3, 2, 2 / 3, -2, 1, 0] });

/** A track plays `def` on element `i` like a CSS animation: delay, duration, iterations and fill
 *  (1 backwards, 2 forwards). Not playing, the element shows its row's base. */
interface Track {
  i: number;
  d: number;
  D: number;
  n: number;
  f: number;
  def: Def;
}

export function mount(promo: HTMLElement, first: SlotTap | null = null) {
  const hero = promo.closest<HTMLElement>(".hero-crossover")!;
  const svg = promo.querySelector<SVGSVGElement>(".promo-action")!;
  const statusText = promo.querySelector(".promo-status")!.lastChild as Text;
  const q = <T extends Element = SVGGElement>(s: string) => svg.querySelector<T>(s)!;
  const engine = createEngine({ root: hero, fps: 60, settle: 0.5 });
  const L = engine.ledger, rand = engine.random;
  const scale = 500 / promo.clientWidth; // one layout read, at mount: the first tap's scene units

  // ---------- elements: one row each ----------
  const els: El[] = [], tracks: Track[] = [];
  const CAP = 512, V = new Float32Array(CAP * ROW), P = new Float32Array(CAP * ROW).fill(NaN), M = new Uint8Array(CAP), B = new Float32Array(CAP).fill(1);
  const reg = (el: El, m: number, b = 1) => ((M[els.length] = m), (B[els.length] = b), els.push(el) - 1);
  const play = (el: El, d: number, D: number, n: number, f: number, dd: Def, b = 1) => {
    const i = reg(el, dd.m, b);
    tracks.push({ i, d, D, n, f, def: dd });
    return i;
  };
  const loop = (el: El, d: number, dd: Def, b = 1) => play(el, d, LOOP, Infinity, 0, dd, b);
  // Loop keyframes from the kill schedule.
  const aim = (by: string) => {
    const list = KILLS.filter((k) => k.by === by), off = by === "plane" ? 90 : 0, pairs: [number, number][] = [];
    let prev = aimStart(by);
    const start = prev;
    for (const k of list) {
      let next = (k.a * 180) / Math.PI + off;
      while (next - prev > 180) next -= 360;
      while (next - prev < -180) next += 360;
      pairs.push([k.t - 0.5, prev], [k.t - 0.12, next]);
      prev = next;
    }
    return def(IN_OUT, { [ROT]: keys(pairs, start, prev) });
  };
  const recoil = (by: string, ch: number, v: number) =>
    def(EASE, { [ch]: keys(KILLS.filter((k) => k.by === by).flatMap((k): [number, number][] => [[k.t, 0], [k.t + 0.05, v], [k.t + 0.28, 0]]), 0) });
  // Each hit shakes the card: there, back, still, within 0.1 s.
  const shakeKeys = (a: number, b: number) => keys(KILLS.flatMap((k): [number, number][] => [[k.hit, 0], [k.hit + 0.03, a], [k.hit + 0.06, b], [k.hit + 0.1, 0]]), 0);
  const STAGE = loop(promo, INTRO, def(EASE, { [TX]: shakeKeys(-5, 4), [TY]: shakeKeys(3, -3), [ROT]: shakeKeys(-0.5, 0.4) }));
  const PLANE_IN = play(q(".plane-in"), 1.6, 1.1, 1, 3, def(FLY, { [TX]: [0, 260, 1, 0], [TY]: [0, -240, 1, 0], [ROT]: [0, -320, 1, 0], [SC]: [0, 0.6, 1, 1], [OP]: [0, 0, 0.15, 1, 1, 1] }));
  const PLANE_AIM = play(q(".plane-aim"), INTRO, LOOP, Infinity, 1, aim("plane"));
  const PLANE_KICK = loop(q(".plane-kick"), INTRO, recoil("plane", TY, 9));
  const TANK_IN = play(q(".tank-in"), 2.1, 1, 1, 3, def(DRIVE, { [TY]: [0, 230, 1, 0], [OP]: [0, 0, 0.35, 1, 1, 1] }));
  const RUMBLE = play(q(".tank-rumble"), 3.1, 0.18, Infinity, 0, def(-2, { [TY]: [0, 0, 0.5, 1, 1, 0] }));
  // The tank drives up nose first, treads rolling, then pivots to face across the card.
  play(q(".tank-hull"), 3.1, 0.42, 1, 3, def(TURN, { [ROT]: [0, -90, 1, 0] }));
  const TREADS = play(q(".tank-hull path"), 2.1, 0.14, 8, 0, def(0, { [TX]: [0, 10, 1, -4] }));
  const TURRET = play(q(".turret-aim"), INTRO, LOOP, Infinity, 1, aim("tank"));
  const TURRET_KICK = loop(q(".turret-kick"), INTRO, recoil("tank", TX, -10));
  const IDLE = {
    dodge: [1.4, def(-4, { [TX]: [0, 0, 0.5, 9, 1, 0], [TY]: [0, 0, 0.5, -7, 1, 0] })],
    step: [1.2, def(-3, { [TX]: [0, 0, 0.5, -8, 1, 0] })],
    skitter: [1, def(-4, { [TY]: [0, 0, 0.5, -10, 1, 0] })],
  } as const;
  const RING = def(OUT, { [SC]: [0, 0.2, 1, 2.4], [OP]: [0, 0, 0.08, 1, 1, 0] });
  const DIE = def(EASE, {
    [SC]: [0, 1, 0.006, 1.45, 0.02, 0.1, 0.29, 0.1, 0.32, 1.3, 0.35, 1, 1, 1],
    [ROT]: [0, 0, 0.006, 8, 0.02, -30, 0.29, 0, 1, 0],
    [OP]: [0, 1, 0.02, 0, 0.29, 0, 0.32, 1, 1, 1],
    [BR]: [0, 1, 0.006, 4, 0.29, 1, 1, 1],
  });
  const foeEls = [...svg.querySelectorAll<SVGGElement>(".foe-css")];
  const FOE_ROW = foeEls.map((g, j) => {
    const f = FOES[j]!, k = KILLS.find((k) => k.foe === f.id), [spawn, die, idle] = g.querySelectorAll("g");
    play(g.querySelector("circle")!, f.spawn, 0.6, 1, 3, RING, 0);
    play(spawn!, f.spawn, 0.5, 1, 3, SPAWN);
    if (k) loop(die!, INTRO + k.hit, DIE);
    if (f.idle) play(idle!, 0, IDLE[f.idle][0], Infinity, 0, IDLE[f.idle][1]);
    return reg(g, 1 << SHOW);
  });
  // Shots and blasts of the loop: added nodes (ledger), on top of everything, like the poster's order.
  const mk = (tag: string, parent: Element, html = "") => {
    const n = parent.appendChild(document.createElementNS(NS, tag) as SVGElement);
    n.innerHTML = html;
    return n;
  };
  const loopLayer = L.add(mk("g", svg));
  const LOOP_LAYER = reg(loopLayer, 1 << SHOW);
  const line = (x: number, y: number, a: number, len: number, w: number, c: string, cls: string) =>
    `<line class="${cls}" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(a) * len).toFixed(1)}" y2="${(y + Math.sin(a) * len).toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="square"/>`;
  loopLayer.innerHTML =
    KILLS.map((k) => line(k.mx, k.my, k.a, 18, 5, k.by === "plane" ? "#06c4ff" : "#4bce82", "shot")).join("") +
    MISSES.map((m) => line(m.mx, m.my, m.a, 14, 4, m.by === "plane" ? "#7fe3ff" : "#9ff0bf", "shot miss")).join("") +
    KILLS.map((k) => `<g class="boom" transform="translate(${k.f.x} ${k.f.y})">${boomMarkup(foeColor(k.f))}</g>`).join("");
  const loopEls = loopLayer.children;
  KILLS.forEach((k, j) => loop(loopEls[j] as El, INTRO + k.t, def(0, { [TX]: [0, 0, 0.03, k.tx, 1, k.tx], [TY]: [0, 0, 0.03, k.ty, 1, k.ty], [OP]: [0, 1, 0.03, 1, 0.031, 0, 1, 0] }), 0));
  MISSES.forEach((m, j) => loop(loopEls[KILLS.length + j] as El, INTRO + m.t, def(0, { [TX]: [0, 0, 0.08, m.tx, 1, m.tx], [TY]: [0, 0, 0.08, m.ty, 1, m.ty], [OP]: [0, 1, 0.06, 1, 0.08, 0, 1, 0] }), 0));
  KILLS.forEach((k, j) => {
    const parts = loopEls[KILLS.length + MISSES.length + j]!.children;
    BOOM.forEach((dd, p) => loop(parts[p] as El, INTRO + k.hit, dd, 0));
  });

  // ---------- state (typed arrays) ----------
  // Scene clock: time (s), time the loop rests at, held by seek(), playing.
  const T = new Float64Array([0, INTRO + LOOP * LOOPS, 0, 0]);
  // Game: round, score, spawn timer, nuked, nuke time, resets, shake age, shake amp, pending spawns.
  const G = new Float64Array(9).fill(0);
  G[6] = 9;
  const PL = new Float64Array([(aimStart("plane") * Math.PI) / 180, 0, 0, 0.6, 0]); // angle, spin, burst, cool, kick
  const TK = new Float64Array([TANK.x, (aimStart("tank") * Math.PI) / 180, 0, 0.9, 0, 0]); // x, angle, spin, cool, kick, tread
  const FX = new Float64Array(FOE_CAP), FY = new Float64Array(FOE_CAP), FR = new Float64Array(FOE_CAP), FD = new Float64Array(FOE_CAP), FS = new Float64Array(FOE_CAP), FK = new Float64Array(FOE_CAP);
  const FA = new Uint8Array(FOE_CAP);
  const SX = new Float64Array(SHOT_CAP), SY = new Float64Array(SHOT_CAP), SVX = new Float64Array(SHOT_CAP), SVY = new Float64Array(SHOT_CAP), SL = new Float64Array(SHOT_CAP), SA = new Float64Array(SHOT_CAP);
  const SN = new Uint8Array(SHOT_CAP);
  const BX = new Float64Array(BOOM_CAP), BY = new Float64Array(BOOM_CAP), BB = new Float64Array(BOOM_CAP), BA = new Float64Array(BOOM_CAP).fill(-1);
  const BC = new Uint8Array(BOOM_CAP), BN = new Uint8Array(BOOM_CAP);
  // Input (listeners only record): taps [x, y, pointer] × 8, count; drag [pointer, dx, moved];
  // last move [pointer, x]; released pointer; inverse screen matrix of the stage.
  const TAP = new Float64Array(25), DRAG = new Float64Array([-1, 0, 0]), MOVE = new Float64Array([-1, 0]), UP = new Float64Array([-1]), CT = new Float64Array(6);
  // Bad-guy art per pool slot (slot k wears poster foe k % 8), and its colour.
  const art = foeEls.map((g) => ({ el: g.querySelector(".foe-art")!, size: +g.dataset.size!, color: g.dataset.color! }));
  let GAME = -1, GLINE = 0, GBOOM = 0, boomEls: Element[] = [], lineEls: SVGLineElement[] = [];

  // ---------- the game (fixed step: numbers only) ----------
  const r2 = (x: number, y: number) => x * x + y * y;
  function spawn() {
    let free = -1;
    for (let k = 0, s = (rand() * FOE_CAP) | 0; k < FOE_CAP; k++) if (!FA[(s + k) % FOE_CAP]) { free = (s + k) % FOE_CAP; break; }
    if (free < 0) return;
    const r = 13 + rand() * 17, edge = rand() < 0.22;
    let x = 0, y = 0;
    // Keep clear of the shooters so every spawn is a fair target.
    for (let tries = 0; tries < 8; tries++) {
      x = edge ? (rand() < 0.5 ? -20 + rand() * 40 : 480 + rand() * 40) : 40 + rand() * 420;
      y = edge ? 10 + rand() * 330 : 30 + rand() * 220;
      if (r2(x - PLANE.x, y - PLANE.y) > 75 * 75 && r2(x - TK[0]!, y - TANK.y) > 85 * 85) break;
    }
    (FX[free] = x), (FY[free] = y), (FR[free] = r), (FD[free] = 5 + rand() * 4), (FS[free] = 0), (FA[free] = 1);
  }
  function boom(x: number, y: number, c: number, big: number) {
    for (let b = 0; b < BOOM_CAP; b++)
      if (BA[b]! < 0) {
        (BX[b] = x), (BY[b] = y), (BB[b] = big), (BA[b] = 0), (BC[b] = c), (BN[b] = 1), (G[6] = 0), (G[7] = big);
        return;
      }
  }
  function kill(i: number, scored: boolean) {
    if (!FA[i]) return;
    FA[i] = 0;
    boom(FX[i]!, FY[i]!, i % art.length, Math.max(0.7, FR[i]! / 24));
    if (scored) G[1]!++;
  }
  function fire(x: number, y: number, a: number) {
    for (let s = 0; s < SHOT_CAP; s++)
      if (SL[s]! <= 0) {
        (SX[s] = x), (SY[s] = y), (SVX[s] = Math.cos(a) * SHOT_SPEED), (SVY[s] = Math.sin(a) * SHOT_SPEED), (SL[s] = 1.4), (SA[s] = a), (SN[s] = 1);
        return;
      }
  }
  /** Nearest live bad guy, or -1. */
  function target(x: number, y: number) {
    let best = -1, d = Infinity;
    for (let i = 0; i < FOE_CAP; i++) if (FA[i] && r2(FX[i]! - x, FY[i]! - y) < d) (d = r2(FX[i]! - x, FY[i]! - y)), (best = i);
    return best;
  }
  const wrap = (d: number) => d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  const turn = (from: number, to: number, max: number) => from + Math.max(-max, Math.min(max, wrap(to - from)));
  function tap(x: number, y: number, id: number) {
    for (let i = 0; i < FOE_CAP; i++) if (FA[i] && r2(FX[i]! - x, FY[i]! - y) < (FR[i]! + 12) ** 2) return kill(i, true);
    if (r2(x - PLANE.x, y - PLANE.y) < 56 * 56) {
      // Each tap adds bullets to the spin; tapping fast keeps it spinning and spraying.
      PL[1] = Math.max(PL[1]!, 0.55);
      PL[2] = Math.min(40, PL[2]! + 8);
    } else if (r2(x - TK[0]!, y - TANK.y) < 60 * 60) (DRAG[0] = id), (DRAG[1] = x - TK[0]!), (DRAG[2] = 0);
  }
  const pa = () => PL[0]! - Math.PI / 2; // the plane's nose
  function game(dt: number) {
    if (G[8]) for (; G[8]! > 0; G[8]!--) spawn();
    for (let k = 0; k < TAP[24]!; k++) tap(TAP[k * 3]!, TAP[k * 3 + 1]!, TAP[k * 3 + 2]!);
    TAP[24] = 0;
    if (DRAG[0]! >= 0 && MOVE[0] === DRAG[0]) {
      const x = Math.max(70, Math.min(430, MOVE[1]! - DRAG[1]!));
      if (Math.abs(x - TK[0]!) > 0.5) DRAG[2] = 1;
      TK[5]! += x - TK[0]!;
      TK[0] = x;
    }
    if (UP[0]! >= 0) {
      if (UP[0] === DRAG[0]) (DRAG[2] || (TK[2] = Math.max(TK[2]!, 0.65))), (DRAG[0] = -1);
      UP[0] = -1;
    }
    G[0]! += dt;
    // A crowd builds: fast spawns, faster as the round goes on.
    if ((G[2]! -= dt) <= 0 && !G[3]) spawn(), (G[2] = (0.22 + rand() * 0.28) * (1 - Math.min(0.45, G[0]! / ROUND / 2)));
    for (let i = 0; i < FOE_CAP; i++) if (FA[i]) (FS[i]! += dt), (FD[i]! -= dt) <= 0 && kill(i, false);
    // Interceptor: turns on its centre (sprite faces up, so +90°), fires when lined up.
    PL[3]! -= dt;
    PL[4] = Math.max(0, PL[4]! - dt);
    if (PL[1]! > 0) {
      PL[1]! -= dt;
      PL[0]! += dt * 14;
      if (PL[2]! > 0 && (PL[3]! <= 0 || PL[2]! > 12)) fire(PLANE.x + Math.cos(pa()) * 44, PLANE.y + Math.sin(pa()) * 44, pa()), PL[2]!--, (PL[3] = 0.03);
    } else {
      const t = target(PLANE.x, PLANE.y);
      if (t >= 0) {
        const want = Math.atan2(FY[t]! - PLANE.y, FX[t]! - PLANE.x) + Math.PI / 2;
        PL[0] = turn(PL[0]!, want, dt * 6);
        if (PL[3]! <= 0 && Math.abs(wrap(want - PL[0]!)) < 0.12)
          fire(PLANE.x + Math.cos(pa()) * 44, PLANE.y + Math.sin(pa()) * 44, pa() + (rand() - 0.5) * 0.52), (PL[3] = 0.75), (PL[4] = 0.12);
      }
    }
    // Tank turret: same idea; a tap spins it through a 360 spray.
    TK[3]! -= dt;
    TK[4] = Math.max(0, TK[4]! - dt);
    const tx = TK[0]!, ty = TANK.y;
    if (TK[2]! > 0) {
      TK[2]! -= dt;
      TK[1]! += dt * 10;
      if (TK[3]! <= 0) fire(tx + Math.cos(TK[1]!) * 58, ty + Math.sin(TK[1]!) * 58, TK[1]!), (TK[3] = 0.05);
    } else {
      const t = target(tx, ty);
      if (t >= 0) {
        const want = Math.atan2(FY[t]! - ty, FX[t]! - tx);
        TK[1] = turn(TK[1]!, want, dt * 4.5);
        if (TK[3]! <= 0 && Math.abs(wrap(want - TK[1]!)) < 0.1)
          fire(tx + Math.cos(TK[1]!) * 58, ty + Math.sin(TK[1]!) * 58, TK[1]! + (rand() - 0.5) * 0.44), (TK[3] = 0.95), (TK[4] = 0.12);
      }
    }
    // Shots: straight lines; any bad guy they touch explodes; misses fly off screen.
    for (let s = 0; s < SHOT_CAP; s++) {
      if (SL[s]! <= 0) continue;
      SX[s]! += SVX[s]! * dt;
      SY[s]! += SVY[s]! * dt;
      SL[s]! -= dt;
      for (let i = 0; i < FOE_CAP; i++)
        if (FA[i] && r2(FX[i]! - SX[s]!, FY[i]! - SY[s]!) < (FR[i]! + 4) ** 2) {
          kill(i, true);
          SL[s] = 0;
          break;
        }
      if (SX[s]! < -300 || SX[s]! > 800 || SY[s]! < -300 || SY[s]! > 660) SL[s] = 0;
    }
    for (let b = 0; b < BOOM_CAP; b++) if (BA[b]! >= 0 && (BA[b]! += dt) >= BOOM_END) BA[b] = -1;
    G[6]! += dt;
    // Two-minute round: alarm, blink, nuke (every bad guy goes, 30 ms apart), reset.
    if (ROUND - G[0]! <= 0 && !G[3]) {
      (G[3] = 1), (G[4] = 0);
      for (let i = 0, k = 0; i < FOE_CAP; i++) if (FA[i]) FK[i] = Math.min(0.7, k++ * 0.03);
    }
    if (G[3]) {
      G[4]! += dt;
      for (let i = 0; i < FOE_CAP; i++) if (FA[i] && G[4]! >= FK[i]!) kill(i, false);
      if (G[4]! >= 2.2) (G[3] = 0), (G[0] = 0), (G[1] = 0), G[5]!++;
    }
  }

  // ---------- render: rows → the ledger (change-only) ----------
  const n2 = (v: number) => Math.round(v * 100) / 100;
  function put(i: number) {
    const r = i * ROW, el = els[i]!, m = M[i]!;
    let same = true;
    for (let k = 0; k < ROW; k++) if (V[r + k] !== P[r + k]) (same = false), (P[r + k] = V[r + k]!);
    if (same) return;
    const x = V[r]!, y = V[r + 1]!, a = V[r + 2]!, s = V[r + 3]!;
    if (m & 15) L.style(el, "transform", x || y || a || s !== 1 ? `translate(${n2(x)}px,${n2(y)}px) rotate(${n2(a)}deg) scale(${n2(s)})` : "");
    if (m & 16) L.style(el, "opacity", `${n2(V[r + OP]!)}`);
    if (m & 32) L.style(el, "filter", V[r + BR] === 1 ? "" : `brightness(${n2(V[r + BR]!)})`);
    if (m & 64) L.style(el, "display", V[r + SHOW] ? "" : "none");
  }
  const reset = (i: number) => {
    const r = i * ROW;
    V.fill(0, r, r + ROW);
    V[r + SC] = V[r + BR] = V[r + SHOW] = 1;
    V[r + OP] = B[i]!;
  };
  const apply = (dd: Def, x: number, r: number) => {
    for (let c = 0; c < dd.c.length; c++) V[r + dd.c[c]![0]] = sample(dd.c[c]![1], x, dd.e);
  };
  const deg = (a: number) => (a * 180) / Math.PI;
  let status = -1;
  // Rows the game owns outright in play mode (the loop's tracks step aside).
  let GAME_ROWS: number[] = [];
  function render() {
    const t = T[0]!, playing = T[3]!;
    for (let i = 0; i < els.length; i++) reset(i);
    for (let k = 0; k < tracks.length; k++) {
      const tr = tracks[k]!, l = t - tr.d;
      let x = -1;
      if (l < 0) x = tr.f & 1 ? 0 : -1;
      else if (l >= tr.D * tr.n) x = tr.f & 2 ? 1 : -1;
      else x = (l % tr.D) / tr.D;
      if (x >= 0) apply(tr.def, x, tr.i * ROW);
    }
    if (playing) {
      // Play: the loop steps aside; the game drives the shooters and its own layers.
      for (let k = 0; k < GAME_ROWS.length; k++) reset(GAME_ROWS[k]!);
      for (let k = 0; k < FOE_ROW.length; k++) V[FOE_ROW[k]! * ROW + SHOW] = 0;
      V[LOOP_LAYER * ROW + SHOW] = 0;
      V[PLANE_AIM * ROW + ROT] = deg(PL[0]!);
      V[PLANE_KICK * ROW + TY] = PL[4]! * 70;
      V[TURRET * ROW + ROT] = deg(TK[1]!);
      V[TURRET_KICK * ROW + TX] = -TK[4]! * 80;
      V[TANK_IN * ROW + TX] = TK[0]! - TANK.x;
      // Marks repeat every 14px; offsets in (-4, 10] keep them inside the tread.
      V[TREADS * ROW + TX] = 10 - (((TK[5]! % 14) + 14) % 14);
      if (G[6]! < 0.11) {
        apply(SHAKE, G[6]! / 0.11, STAGE * ROW);
        V[STAGE * ROW] = V[STAGE * ROW]! * G[7]!;
        V[STAGE * ROW + 1] = V[STAGE * ROW + 1]! * G[7]!;
      }
      for (let i = 0; i < FOE_CAP; i++) {
        const o = (GAME + i * 2) * ROW, a = art[i % art.length]!;
        V[o + SHOW] = FA[i]!;
        V[o] = FX[i]!;
        V[o + 1] = FY[i]!;
        V[o + SC] = (FR[i]! * 2) / a.size;
        if (FS[i]! < 0.45) apply(SPAWN, FS[i]! / 0.45, o + ROW);
      }
      for (let s = 0; s < SHOT_CAP; s++) {
        const o = (GLINE + s) * ROW;
        V[o + SHOW] = SL[s]! > 0 ? 1 : 0;
        V[o] = SX[s]!;
        V[o + 1] = SY[s]!;
        if (SN[s]) {
          const el = lineEls[s]!;
          SN[s] = 0;
          L.attr(el, "x2", `${n2(Math.cos(SA[s]!) * 16)}`);
          L.attr(el, "y2", `${n2(Math.sin(SA[s]!) * 16)}`);
          L.attr(el, "stroke", SY[s]! < 200 ? "#06c4ff" : "#4bce82");
        }
      }
      for (let b = 0; b < BOOM_CAP; b++) {
        const g = GBOOM + b * (PARTS + 1), o = g * ROW;
        V[o + SHOW] = BA[b]! >= 0 ? 1 : 0;
        if (BA[b]! < 0) continue;
        V[o] = BX[b]!;
        V[o + 1] = BY[b]!;
        V[o + SC] = BB[b]!;
        for (let p = 0; p < PARTS; p++) apply(BOOM[p]!, BA[b]! / LOOP, (g + 1 + p) * ROW);
        if (BN[b]) {
          BN[b] = 0;
          const c = art[BC[b]!]!.color, parts = boomEls[b]!.children as HTMLCollectionOf<SVGElement>;
          L.attr(parts[2]!, "stroke", c);
          for (let j = 0; j < SHARDS.length; j += 3) L.attr(parts[4 + j]!, "fill", c);
        }
      }
      // Status line and alarm: rebuilt only when what it says changes.
      const left = ROUND - G[0]!, nuked = G[3]!, alarm = !nuked && left <= ALARM;
      const secs = alarm ? Math.ceil(left) : Math.floor(left), key = (nuked ? 2 : alarm ? 1 : 0) * 1e7 + G[1]! * 1e3 + secs;
      if (key !== status) {
        status = key;
        L.text(statusText, nuked ? ` NUKED · ${G[1]} SQUASHED` : alarm ? ` NUKE IN ${secs}…` : ` SQUASHED ${G[1]} · NUKE ${Math.floor(left / 60)}:${String(secs % 60).padStart(2, "0")}`);
      }
      L.cls(hero, "hx-alarm", alarm);
      L.cls(hero, "hx-nuke", !!nuked);
    }
    for (let i = 0; i < els.length; i++) put(i);
  }

  engine.add({
    step(e, dt) {
      if (T[2]) return; // held by seek(): a still frame
      if (T[3]) (T[0]! += dt), game(dt), e.busy();
      else if (T[0]! < T[1]!) (T[0] = Math.min(T[0]! + dt, T[1]!)), e.busy();
    },
    render,
  });

  // ---------- play mode: built on the first tap ----------
  function startGame() {
    if (T[3]) return;
    const foeLayer = L.add(document.createElementNS(NS, "g")), layer = L.add(document.createElementNS(NS, "g"));
    foeLayer.setAttribute("class", "hx-foes");
    layer.setAttribute("class", "hx-layer");
    // Bad guys sit under the shooters; shots and blasts draw on top.
    svg.insertBefore(foeLayer, q(".plane-in").parentNode);
    svg.append(layer);
    GAME = els.length;
    for (let i = 0; i < FOE_CAP; i++) {
      const a = art[i % art.length]!, g = mk("g", foeLayer, `<g class="promo-motion"></g>`);
      g.firstElementChild!.append(a.el.cloneNode(true));
      reg(g, 1 | 2 | 8 | 64);
      reg(g.firstElementChild as SVGElement, SPAWN.m);
    }
    GLINE = els.length;
    for (let s = 0; s < SHOT_CAP; s++) {
      const l = mk("line", layer) as SVGLineElement;
      for (const [k, v] of [["x1", "0"], ["y1", "0"], ["stroke-width", "5"], ["stroke-linecap", "square"]]) l.setAttribute(k!, v!);
      lineEls.push(l);
      reg(l, 1 | 2 | 64);
    }
    GBOOM = els.length;
    for (let b = 0; b < BOOM_CAP; b++) {
      const g = mk("g", layer, boomMarkup("#06c4ff"));
      boomEls.push(g);
      reg(g, 1 | 2 | 8 | 64);
      for (let p = 0; p < PARTS; p++) reg(g.children[p] as El, BOOM[p]!.m, 0);
    }
    GAME_ROWS = [STAGE, PLANE_IN, PLANE_KICK, TANK_IN, RUMBLE, TURRET_KICK, TREADS];
    L.attr(hero, "data-play", "true");
    T[3] = 1;
    G[8] = 6;
    engine.wake();
  }
  // Pointer: listeners only record. The stage's screen matrix is read once per press.
  const local = (cx: number, cy: number, k: number) => (k ? CT[1]! * cx + CT[3]! * cy + CT[5]! : CT[0]! * cx + CT[2]! * cy + CT[4]!);
  const on = { signal: engine.signal };
  promo.addEventListener("pointerdown", (ev) => {
    startGame();
    if ((ev.target as Element).closest("button,a")) return;
    const m = svg.getScreenCTM()?.inverse();
    if (!m) return;
    CT.set([m.a, m.b, m.c, m.d, m.e, m.f]);
    const x = local(ev.clientX, ev.clientY, 0), y = local(ev.clientX, ev.clientY, 1), n = TAP[24]!;
    (MOVE[0] = ev.pointerId), (MOVE[1] = x); // a drag starts from here, not from an old hover
    if (n < 8) (TAP[n * 3] = x), (TAP[n * 3 + 1] = y), (TAP[n * 3 + 2] = ev.pointerId), (TAP[24] = n + 1);
    if (r2(x - TK[0]!, y - TANK.y) < 60 * 60)
      try {
        promo.setPointerCapture(ev.pointerId);
      } catch {}
  }, on);
  promo.addEventListener("pointermove", (ev) => {
    (MOVE[0] = ev.pointerId), (MOVE[1] = local(ev.clientX, ev.clientY, 0));
    if (DRAG[0] === ev.pointerId) engine.wake();
  }, on);
  promo.addEventListener("pointerup", (ev) => (UP[0] = ev.pointerId), on);
  promo.addEventListener("pointercancel", () => (DRAG[0] = -1), on);
  // BUTTON_01 is the big red button: it nukes every bad guy and resets the round.
  const nuke = () => !G[3] && (G[0] = ROUND);
  promo.querySelector(".promo-button")!.addEventListener("click", () => (startGame(), nuke(), engine.wake()), on);
  // The loop plays LOOPS more cycles after a pointer over the card or coming back into view.
  const again = () => {
    if (!T[3] && T[0]! >= INTRO) T[1] = T[0]! + LOOP * LOOPS - ((T[0]! - INTRO) % LOOP);
    engine.wake();
  };
  promo.addEventListener("pointerenter", again, on);
  // The scene's pause key and the page's visibility land on data-motion (client.ts).
  const motion = () => (hero.dataset.motion === "true" ? (again(), engine.start()) : engine.stop());
  const watch = new MutationObserver(motion);
  watch.observe(hero, { attributes: true, attributeFilter: ["data-motion"] });
  engine.signal.addEventListener("abort", () => watch.disconnect(), { once: true });

  // A diagnostic handle for the site's browser tests and screenshots.
  const h = hero as HTMLElement & { heroScene?: object };
  h.heroScene = {
    engine,
    /** Hold the scene at `t` seconds (a still frame); seek(-1) lets it run again. */
    seek(t: number) {
      T[2] = t >= 0 ? 1 : 0;
      if (t >= 0) T[0] = t;
      engine.advance(0);
      engine.wake();
    },
    nuke,
    /** Scene time the loop rests at (unless something wakes it first). */
    get rest() {
      return T[1];
    },
    get playing() {
      return !!T[3];
    },
    get score() {
      return G[1];
    },
    get resets() {
      return G[5];
    },
    get foes() {
      return FA.reduce((n, a) => n + a, 0);
    },
  };
  engine.signal.addEventListener("abort", () => delete h.heroScene, { once: true });

  engine.advance(0); // the intro's first frame, before the browser paints the uncovered card
  // A tap that came before the scene was up starts the game and lands where it was aimed.
  if (first) startGame(), (TAP[0] = first.x * scale), (TAP[1] = first.y * scale), (TAP[2] = -1), (TAP[24] = 1);
  if (hero.dataset.motion === "true") engine.start();
  return { destroy: () => engine.destroy() };
}

/** For fizlet/slot: the slot is the card's stage. */
export const mountHero: SlotMount = (_stage, slotEl, first) => mount(slotEl, first);
