// #23 "A red cape whooshes across the top": a night-patrol toy. The city sleeps under pennants that
// say ALL QUIET. The hero whooshes in under them (the gust swings each pennant only as he passes
// it), crosses the full moon as a silhouette and pulls up into a fist-up hover. Then he is yours:
// tap anywhere and he dashes there, WHOOSH trailing him (tap fast for a longer WHOOOOSH). He really
// collides with his city: the walls, the roofs (BONK, a dizzy spin, and the windows of the building
// he hit light up as the neighbours wake) and the mast; aim him at the water tower and he hits it
// (it rocks; three times and it springs a leak), aim him at the moon and he hits that (it rocks;
// keep at it and the moon gets cross). Everything settles to no frames until the next tap.
// Bricks: the kernel (fixed step, settle), fzlt/sprite (the hero, baked once; a silhouette
// palette), fzlt/fx (puffs, crumbs, the leak: kinds as data). The pennants, windows, tower and
// moon are the stage's own elements (site/gallery/stages/red-cape-whooshes-top.html), changed only
// through the engine's ledger in render, so Recall gives the page back exactly.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, HERO, NECK, cape, drawCape } from "./hero";
import { drawWord, word } from "./comic";

export type WhooshScene = SlotScene & { engine: ReturnType<typeof createEngine>; dash(x: number, y: number): void };

// The city, in design units (the stage art is 320 × 180).
const DW = 320, MX = 252, MY = 58, MR = 25, HOVER_X = 300, HOVER_Y = 74;
/** Roofs: x, width, top. */
const ROOFS = [0, 44, 118, 44, 30, 138, 74, 36, 124, 110, 26, 146, 136, 40, 130, 176, 58, 96, 234, 28, 140, 262, 58, 128];
/** Solid boxes (x0, y0, x1, y1): the mast, the water tower. */
const MAST = [19, 20, 25, 118], TOWER = [191, 36, 219, 96];
const FLY_T = 1.55, R = 6;
const sq = "square" as const;
const INK = 0, MUTED = 1, HURT = 2, SYS = 4;
// Kinds of things he can hit.
const WALL = 0, ROOF = 1, POLE = 2, TANK = 3, MOON = 4;
// Modes: waiting to start, the intro flight, a dash, hovering, tumbling after a bonk, still.
const WAITING = 0, INTRO = 1, DASH = 2, HOVER = 3, TUMBLE = 4, STILL = 5;
// Custom property values, made once: a frame only picks one (no string building per frame).
const HALF: string[] = Array.from({ length: 81 }, (_, i) => `${(i - 40) / 2}deg`);
const DEG: string[] = Array.from({ length: 181 }, (_, i) => `${i - 90}deg`);
const PXS: string[] = Array.from({ length: 41 }, (_, i) => `${i - 20}px`);
const WORDS = [word("WHOOSH"), word("WHOOOSH"), word("WHOOOOSH")], BONK = word("BONK!");

// State slots (one typed array: writing a slot never boxes a number).
const MODE = 0, T = 1, WAIT = 2, HX = 3, HY = 4, VX = 5, VY = 6, ANG = 7, SPIN = 8, DIZ = 9, COMBO = 10, SINCE = 11, TX = 12, TY = 13;
const W = 14, H = 15, P = 16, F = 17, RES = 18, DIRTY = 19, PUFF = 20, PREVX = 21, WT = 22, WX = 23, WY = 24, WN = 25, WD = 26;
const BT = 27, BX = 28, BY = 29, TR = 30, TV = 31, MDX = 32, MVX = 33, MDY = 34, MVY = 35, TOWER_HITS = 36, MOON_HITS = 37;
const LEAK = 38, PUD = 39, PUDL = 40, FACE = 41, POSE = 42, BOB = 43, QUEUE = 44;

export function whoosh(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): WhooshScene {
  const engine = createEngine({ root: stage, settle: 0.6 });
  const L = engine.ledger;
  const S = new Float64Array(48);
  // The intro waits 0.5 s: held awake that long (settle is 0.6 s, and on a slow page wall time outruns it).
  engine.busy((S[WAIT] = first ? 0 : 0.5));
  S[RES] = S[DIRTY] = 1;
  S[P] = 3;
  S[WT] = S[BT] = -1;
  const art = sprites(HERO, { palettes: [{}, { "*": C.rim }] });
  const fx = effects({ cap: 420, colors: [C.ink, C.muted, C.hurt, C.red, C.sys], scorch: 0, gravity: 90 });
  const { ids: { puff, crumb, dust, leak }, emit } = emitter(fx, {
    puff: { shape: sq, drag: 2.4, gravity: 0, angle: Math.PI, spread: 0.9, speed: [12, 48], size: [1, 2], life: [0.25, 0.6] },
    crumb: { shape: sq, drag: 0.8, gravity: 1, angle: -1.5708, spread: 2.2, speed: [18, 60], size: [1, 2], life: [0.5, 1] },
    dust: { shape: sq, drag: 3, gravity: -0.2, angle: -1.5708, spread: 6.2832, speed: [20, 70], size: [1, 2.5], life: [0.3, 0.8] },
    leak: { shape: sq, drag: 0, gravity: 1, angle: 0.2, spread: 0.25, speed: [26, 38], size: [1, 1.5], life: [0.6, 0.9] },
  });
  const cloth = cape(11, 1.9);

  // The stage's own elements.
  const flags = [...slot.querySelectorAll<HTMLElement>(".rc23-flag")];
  const n = flags.length;
  const FXa = new Float64Array(n), FYt = new Float64Array(n), FYb = new Float64Array(n), TH = new Float64Array(n), OM = new Float64Array(n), SK = new Float64Array(n), SV = new Float64Array(n), CD = new Float64Array(n);
  const LR = new Int16Array(n), LS = new Int16Array(n);
  // Windows (dark until something wakes the building; lit a while, then out). Seconds per window:
  // < 0 waiting to come on, > 0 lit, -9 done.
  const wins = [...slot.querySelectorAll<SVGRectElement>(".rc23-win")];
  const nw = wins.length, WXs = new Float64Array(nw), WL = new Float64Array(nw), WON = new Uint8Array(nw);
  for (let i = 0; i < nw; i++) WXs[i] = Number(wins[i]!.getAttribute("x"));
  const tower = slot.querySelector<SVGGElement>(".rc23-tower"), moon = slot.querySelector<SVGGElement>(".rc23-moon");
  const last = new Int16Array(3); // tower angle (half degrees), moon x, moon y: as last written
  // The moon as pixel rows at art scale (the silhouette clip): rows, top.
  const MOX = new Int16Array(80), MOW = new Int16Array(80), moonAt = new Int16Array(2);

  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;image-rendering:pixelated;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const ro = new ResizeObserver(() => ((S[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  /** A tap at (x, y) CSS px in the stage: he dashes there (faster on quick taps). */
  const dash = (x: number, y: number) => {
    S[TX] = x / S[P]!;
    S[TY] = y / S[P]!;
    if (S[MODE] === WAITING) S[WAIT] = 0;
    else S[QUEUE] = 1; // the next step starts it
    engine.wake();
  };
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    dash(e.clientX - r.left, e.clientY - r.top);
  }, { signal: engine.signal });

  const smooth = (a: number, b: number, x: number) => {
    const u = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
    return u * u * (3 - 2 * u);
  };
  /** The roof under x (art px), in art px. */
  const roofAt = (x: number) => {
    const xd = x / S[F]!;
    for (let i = 0; i < ROOFS.length; i += 3) if (xd >= ROOFS[i]! && xd < ROOFS[i]! + ROOFS[i + 1]!) return ROOFS[i + 2]! * S[F]!;
    return 180 * S[F]!;
  };
  /** Wake the windows of the building under x (design units), one after another, after `delay` s. */
  const wake = (xd: number, delay: number) => {
    for (let i = 0; i < ROOFS.length; i += 3)
      if (xd >= ROOFS[i]! && xd < ROOFS[i]! + ROOFS[i + 1]!)
        for (let k = 0; k < nw; k++) if (WXs[k]! >= ROOFS[i]! && WXs[k]! < ROOFS[i]! + ROOFS[i + 1]! && WL[k] === 0) WL[k] = -delay - (k % 3) * 0.15;
  };

  /** He hits something: bounce off the surface (normal nx, ny), and the thing he hit answers. */
  function bonk(nx: number, ny: number, kind: number) {
    const vn = S[VX]! * nx + S[VY]! * ny;
    if (vn >= 0) return;
    S[VX] = S[VX]! - 1.55 * vn * nx;
    S[VY] = S[VY]! - 1.55 * vn * ny;
    const hard = -vn;
    if (hard < 45) return;
    S[MODE] = TUMBLE;
    S[T] = 0;
    S[SPIN] = (S[VX]! >= 0 ? 1 : -1) * Math.min(16, 6 + hard * 0.05);
    S[DIZ] = 1.7;
    S[BT] = 0;
    if (S[WT]! >= 0) S[WT] = 1.2; // the WHOOSH breaks up on the bonk
    S[BX] = S[HX]! - nx * R;
    S[BY] = S[HY]! - ny * R;
    emit(dust, S[BX]!, S[BY]!, 10, INK, 2, 1);
    const k = Math.min(1.6, hard / 160);
    if (kind === TANK) {
      S[TV] = S[TV]! - nx * 30 * k;
      if ((S[TOWER_HITS] = S[TOWER_HITS]! + 1) === 3) S[LEAK] = 4.5;
    } else if (kind === MOON) {
      S[MVX] = S[MVX]! - nx * 40 * k;
      S[MVY] = S[MVY]! - ny * 40 * k;
      if ((S[MOON_HITS] = S[MOON_HITS]! + 1) >= 3) S[FACE] = 2.6;
    } else if (kind === ROOF) {
      wake(S[HX]! / S[F]!, 0.35);
      emit(dust, S[BX]!, S[BY]!, 8, MUTED, 1, 1);
    }
  }
  /** Push him out of the box (x0, y0, x1, y1 in design units), bonking it. */
  function box(b: number[], kind: number) {
    const f = S[F]!, cx = Math.max(b[0]! * f, Math.min(b[2]! * f, S[HX]!)), cy = Math.max(b[1]! * f, Math.min(b[3]! * f, S[HY]!));
    const dx = S[HX]! - cx, dy = S[HY]! - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= R) return;
    const nx = d > 0 ? dx / d : S[VX]! > 0 ? -1 : 1, ny = d > 0 ? dy / d : 0;
    S[HX] = cx + nx * R;
    S[HY] = cy + ny * R;
    bonk(nx, ny, kind);
  }
  /** Every solid thing, once per step. */
  function collide() {
    const f = S[F]!, w = S[W]!;
    if (S[HX]! < R) (S[HX] = R), bonk(1, 0, WALL);
    if (S[HX]! > w - R) (S[HX] = w - R), bonk(-1, 0, WALL);
    if (S[HY]! < R) (S[HY] = R), bonk(0, 1, WALL);
    const ry = roofAt(S[HX]!) - (S[POSE] ? 14 : R); // standing, his boots meet the roof
    if (S[HY]! > ry) (S[HY] = ry), bonk(0, -1, ROOF);
    box(MAST, POLE);
    // The tower and the moon stand back from his flight line: he hits them when you aim him at them.
    const tx = S[TX]! / f, ty = S[TY]! / f;
    if (tx > TOWER[0]! - 4 && tx < TOWER[2]! + 4 && ty > TOWER[1]! - 4 && ty < TOWER[3]!) box(TOWER, TANK);
    const mx = (MX + S[MDX]!) * f, my = (MY + S[MDY]!) * f, dx = S[HX]! - mx, dy = S[HY]! - my, d = Math.sqrt(dx * dx + dy * dy), r = MR * f + R;
    if (d < r && d > 0 && (tx - MX) ** 2 + (ty - MY) ** 2 < (MR + 4) ** 2) (S[HX] = mx + (dx / d) * r), (S[HY] = my + (dy / d) * r), bonk(dx / d, dy / d, MOON);
  }

  /** Start the intro: the hero off the left edge, the cape trailing. */
  function intro() {
    S[MODE] = INTRO;
    S[T] = 0;
    S[HX] = S[PREVX] = -30 * S[F]!;
    S[HY] = 88 * S[F]!;
    S[ANG] = 0;
    S[POSE] = 0;
    cloth.reset(S[HX]! - 10, S[HY]!);
    for (let i = 0; i < 40; i++) cloth.step(S[HX]! - 10 + i * 0.5, S[HY]!, 1 / 60);
  }
  /** Start a dash at the queued target. */
  function go() {
    S[QUEUE] = 0;
    S[COMBO] = S[SINCE]! < 1.3 && S[MODE] !== STILL ? Math.min(3, S[COMBO]! + 1) : 1;
    S[SINCE] = 0;
    // Aim at the sky over the tap: never into a roof.
    S[TY] = Math.min(S[TY]!, roofAt(S[TX]!) - R - 2);
    const dx = S[TX]! - S[HX]!, dy = S[TY]! - S[HY]!, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 190 + 80 * (S[COMBO]! - 1);
    S[VX] = (dx / d) * sp;
    S[VY] = (dy / d) * sp;
    S[MODE] = DASH;
    S[T] = 0;
    S[POSE] = 0;
    S[WT] = 0;
    S[WN] = S[COMBO]! - 1;
    S[WD] = dx >= 0 ? 1 : -1;
    S[WX] = S[HX]!;
    S[WY] = S[HY]! + 9;
    emit(puff, S[HX]!, S[HY]!, 10, INK, 2, 1.4);
  }

  /** The hero and his cape; `dark`: as a silhouette (the cape stays red against the moon). */
  function hero(dark: boolean, y: number) {
    const pose = S[POSE]!, a = S[ANG]!, x = S[HX]!, pal = dark ? 1 : 0;
    if (!dark) drawCape(ctx, cloth, pose ? 3 : 2, pose ? 8 : 5, false, pose ? 8 : 11);
    if (pose === 2) art.draw(ctx, "fist", 0, x, y + 16, 0, 1, pal);
    else if (pose === 1) art.draw(ctx, "stand", 0, x, y + 13, 0, 1, pal);
    else if (Math.cos(a) >= 0) art.draw(ctx, "fly", 0, x, y, a, 1, pal);
    else art.draw(ctx, "flyL", 0, x, y, a - Math.PI, 1, pal);
  }
  /** Where the WHOOSH starts: behind where the dash began, inside the card. */
  function wordX() {
    const wd = WORDS[S[WN]!]!, x = S[WD]! > 0 ? S[WX]! - wd.w - 10 : S[WX]! + 10;
    return Math.max(3, Math.min(S[W]! - wd.w - 6, x));
  }

  engine.add({
    read() {
      if (!S[RES]) return;
      S[RES] = 0;
      const q = stage.getBoundingClientRect(), old = S[F]!;
      const p = Math.max(1, Math.round(q.width / 180));
      S[P] = p;
      canvas.style.width = (S[W] = canvas.width = Math.ceil(q.width / p)) * p + "px";
      canvas.style.height = (S[H] = canvas.height = Math.ceil(q.height / p)) * p + "px";
      const f = (S[F] = S[W]! / DW);
      if (old && old !== f && S[MODE] !== WAITING) (S[HX] = (S[HX]! / old) * f), (S[HY] = (S[HY]! / old) * f);
      for (let i = 0; i < n; i++) {
        const el = flags[i]!; // layout box (offset*): transforms never move these numbers
        FXa[i] = (el.offsetLeft + el.offsetWidth / 2) / p;
        FYt[i] = el.offsetTop / p;
        FYb[i] = (el.offsetTop + el.offsetHeight) / p;
      }
      const r = MR * f, cy = MY * f, cx = MX * f;
      moonAt[1] = Math.round(cy - r);
      moonAt[0] = Math.min(80, Math.round(r * 2) + 1);
      for (let y = 0; y < moonAt[0]; y++) {
        const dy = moonAt[1] + y + 0.5 - cy, half = Math.sqrt(Math.max(0, r * r - dy * dy));
        MOX[y] = Math.round(cx - half);
        MOW[y] = Math.round(cx + half) - MOX[y]!;
      }
      S[DIRTY] = 1;
    },
    step(e, dt) {
      const f = S[F]!, mode = S[MODE]!;
      let busy = mode === INTRO || mode === DASH || mode === TUMBLE || mode === HOVER;
      S[SINCE] = S[SINCE]! + dt;
      if (mode === WAITING) (S[WAIT] = S[WAIT]! - dt) < 0 && intro();
      else if (S[QUEUE]) go();
      const t = (S[T] = S[T]! + dt);
      S[PREVX] = S[HX]!;
      if (S[MODE] === INTRO) {
        if (t <= FLY_T) {
          // In fast, slowing all the way: under the pennants at full speed, over the moon slower,
          // then nose up into the hover.
          const u = t / FLY_T, xd = -30 + (HOVER_X + 30) * (1 - (1 - u) ** 2.2);
          S[HX] = xd * f;
          S[HY] = (88 - 26 * smooth(140, MX, xd) + (HOVER_Y - 62) * smooth(MX, HOVER_X, xd)) * f;
          S[ANG] = -1.5708 * smooth(0.86, 1, u);
          S[VX] = (S[HX]! - S[PREVX]!) / dt;
          S[VY] = 0;
          if (u > 0.15 && u < 0.6) wake(xd - 24, 0.3);
          // WHOOSH, slammed down behind him as he passes the middle of the pennants.
          if (t - dt < 0.32 && t >= 0.32) (S[WT] = 0), (S[WN] = 0), (S[WD] = 1), (S[WX] = S[HX]! - 4), (S[WY] = S[HY]! + 12);
          cloth.wind(0, 0, 2600);
        } else {
          S[MODE] = HOVER;
          S[POSE] = 2;
          S[T] = 0;
          S[VX] = S[VY] = 0;
          S[BOB] = 1;
        }
      } else if (S[MODE] === DASH) {
        // Steer for the target; close enough (or long enough), coast into a hover.
        const dx = S[TX]! - S[HX]!, dy = S[TY]! - S[HY]!, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 190 + 80 * (S[COMBO]! - 1), k = Math.min(1, 10 * dt);
        S[VX] = S[VX]! + ((dx / d) * sp - S[VX]!) * k;
        S[VY] = S[VY]! + ((dy / d) * sp - S[VY]!) * k;
        S[ANG] = Math.atan2(S[VY]!, S[VX]!);
        if (d < 8 || t > 1.4) (S[MODE] = HOVER), (S[BOB] = 1);
        cloth.wind(0, 0, 2600);
      } else if (S[MODE] === HOVER) {
        S[VX] = S[VX]! - S[VX]! * 4.5 * dt;
        S[VY] = S[VY]! - S[VY]! * 4.5 * dt;
        const sp = Math.abs(S[VX]!) + Math.abs(S[VY]!);
        if (sp < 70 && S[POSE] === 0) S[POSE] = 1;
        if (S[POSE] === 0) S[ANG] = Math.atan2(S[VY]!, S[VX]!);
        S[BOB] = Math.max(0, S[BOB]! - dt * 0.7);
        cloth.wind(0, 0, 900 * S[BOB]! * S[BOB]!);
        if (sp < 2 && S[BOB] === 0) S[MODE] = STILL;
      } else if (S[MODE] === TUMBLE) {
        S[VX] = S[VX]! - S[VX]! * 2.5 * dt;
        S[VY] = S[VY]! - S[VY]! * 2.5 * dt;
        S[ANG] = S[ANG]! + S[SPIN]! * dt;
        S[POSE] = 0;
        cloth.wind(0, 0, 1200);
        if (t > 0.7) (S[MODE] = HOVER), (S[POSE] = 1), (S[BOB] = 0.8);
      }
      const m = S[MODE]!;
      if (m === DASH || m === HOVER || m === TUMBLE) {
        S[HX] = S[HX]! + S[VX]! * dt;
        S[HY] = S[HY]! + S[VY]! * dt;
        collide();
      }
      // The gust: pennants near him swing the way he's going; one he flies through flips.
      const vx = S[VX]!;
      for (let i = 0; i < n; i++) {
        CD[i] = Math.max(0, CD[i]! - dt);
        if (m === WAITING || m === STILL) continue;
        const dx = S[HX]! - FXa[i]!, dy = S[HY]! - Math.min(Math.max(S[HY]!, FYt[i]!), FYb[i]!), d = Math.sqrt(dx * dx + dy * dy);
        if (d < 24) (OM[i] = OM[i]! - vx * 6 * dt * (1 - d / 24)), (SV[i] = SV[i]! + Math.abs(vx) * 2 * dt * (1 - d / 24));
        if (d < R + 2 && !CD[i] && Math.abs(vx) > 40) (CD[i] = 0.4), (OM[i] = OM[i]! - Math.sign(vx) * Math.min(420, Math.abs(vx) * 1.8)), (SV[i] = SV[i]! + 160);
      }
      // Puffs off his back, as many as his speed.
      if (m === INTRO || m === DASH) {
        const sp = Math.sqrt(S[VX]! * S[VX]! + S[VY]! * S[VY]!);
        S[PUFF] = S[PUFF]! + sp * dt * 0.08;
        const k = Math.floor(S[PUFF]!), c = Math.cos(S[ANG]!), s = Math.sin(S[ANG]!);
        if (k > 0 && S[ANG]! > -1) emit(puff, S[HX]! - c * 14, S[HY]! - s * 14, k, INK, 2, 1);
        S[PUFF] = S[PUFF]! - k;
      }
      // The cape follows the neck: the pose's tie point, turned with the body.
      const pose = S[POSE]!, a = S[ANG]!, left = Math.cos(a) < 0, b = left ? a - Math.PI : a, c = Math.cos(b), s = Math.sin(b);
      const nx = pose ? -1 : left ? NECK.flyL[0] : NECK.fly[0], ny = pose === 2 ? -3 : pose === 1 ? -7 : NECK.fly[1];
      const bob = pose ? Math.round(Math.sin(t * 5) * 2 * S[BOB]!) : 0;
      const mv = cloth.step(S[HX]! + (pose ? nx : c * nx - s * ny), S[HY]! + bob + (pose ? ny : s * nx + c * ny), dt);
      if (m !== WAITING && mv > 0.02) busy = true;
      // The pennants (damped pendulums, degrees, plus a quicker ripple), the tower, the moon.
      for (let i = 0; i < n; i++) {
        OM[i] = OM[i]! + (-20 * TH[i]! - 2.2 * OM[i]!) * dt;
        TH[i] = TH[i]! + OM[i]! * dt;
        SV[i] = SV[i]! + (-110 * SK[i]! - 6 * SV[i]!) * dt;
        SK[i] = SK[i]! + SV[i]! * dt;
        if (Math.abs(TH[i]!) < 0.4 && Math.abs(OM[i]!) < 2 && Math.abs(SK[i]!) < 0.4 && Math.abs(SV[i]!) < 2) TH[i] = OM[i] = SK[i] = SV[i] = 0;
        else busy = true;
      }
      S[TV] = S[TV]! + (-90 * S[TR]! - 3 * S[TV]!) * dt;
      S[TR] = S[TR]! + S[TV]! * dt;
      S[MVX] = S[MVX]! + (-70 * S[MDX]! - 5 * S[MVX]!) * dt;
      S[MDX] = S[MDX]! + S[MVX]! * dt;
      S[MVY] = S[MVY]! + (-70 * S[MDY]! - 5 * S[MVY]!) * dt;
      S[MDY] = S[MDY]! + S[MVY]! * dt;
      if (Math.abs(S[TR]!) + Math.abs(S[TV]!) < 0.05) S[TR] = S[TV] = 0;
      else busy = true;
      if (Math.abs(S[MDX]!) + Math.abs(S[MVX]!) + Math.abs(S[MDY]!) + Math.abs(S[MVY]!) < 0.05) S[MDX] = S[MVX] = S[MDY] = S[MVY] = 0;
      else busy = true;
      // Windows: wait, come on, stay a while, go out (then they can be woken again).
      for (let i = 0; i < nw; i++) {
        const v = WL[i]!;
        if (v < 0) ((WL[i] = v + dt) >= 0 && (WL[i] = 2.4 + (i % 5) * 0.5), (busy = true));
        else if (v > 0) ((WL[i] = v - dt) <= 0 && (WL[i] = 0), (busy = true));
      }
      // The leak: a stream off the tank, a puddle on the roof that dries up after.
      if (S[LEAK]! > 0) {
        S[LEAK] = S[LEAK]! - dt;
        emit(leak, (TOWER[2]! - 1) * f, 60 * f, 1, SYS, 1, 1);
        S[PUD] = Math.min(13, S[PUD]! + dt * 4);
        S[PUDL] = 6;
        busy = true;
      } else if (S[PUDL]! > 0) ((S[PUDL] = S[PUDL]! - dt) <= 0 && (S[PUD] = 0), (busy = true));
      if (S[FACE]! > 0) (S[FACE] = S[FACE]! - dt), (busy = true);
      if (S[DIZ]! > 0) (S[DIZ] = S[DIZ]! - dt), (busy = true);
      if (S[BT]! >= 0) ((S[BT] = S[BT]! + dt) > 0.75 && (S[BT] = -1), (busy = true));
      if (S[WT]! >= 0) {
        // The WHOOSH stays a beat, then crumbles.
        if ((S[WT] = S[WT]! + dt) > 1.1) emit(crumb, wordX() + WORDS[S[WN]!]!.w / 2, S[WY]! + 3, 26, HURT, 2, 1), (S[WT] = -1);
        busy = true;
      }
      fx.step(dt);
      if (fx.live) busy = true;
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      // The page: pennants, windows, the tower and the moon; only what changed, through the ledger.
      for (let i = 0; i < n; i++) {
        const r = Math.max(-90, Math.min(90, Math.round(TH[i]!))), k = Math.max(-40, Math.min(40, Math.round(SK[i]!)));
        if (r !== LR[i]) (LR[i] = r), r ? L.style(flags[i]!, "--r", DEG[r + 90]!) : L.unstyle(flags[i]!, "--r");
        if (k !== LS[i]) (LS[i] = k), k ? L.style(flags[i]!, "--sk", DEG[k + 90]!) : L.unstyle(flags[i]!, "--sk");
      }
      for (let i = 0; i < nw; i++) {
        const on = WL[i]! > 0 ? 1 : 0;
        if (on !== WON[i]) (WON[i] = on), L.attr(wins[i]!, "data-on", on ? "" : null);
      }
      const tr = Math.max(-40, Math.min(40, Math.round(S[TR]! * 2))), mx = Math.max(-20, Math.min(20, Math.round(S[MDX]!))), my = Math.max(-20, Math.min(20, Math.round(S[MDY]!)));
      if (tower && tr !== last[0]) (last[0] = tr), tr ? L.style(tower, "--r", HALF[tr + 40]!) : L.unstyle(tower, "--r");
      if (moon && mx !== last[1]) (last[1] = mx), mx ? L.style(moon, "--mx", PXS[mx + 20]!) : L.unstyle(moon, "--mx");
      if (moon && my !== last[2]) (last[2] = my), my ? L.style(moon, "--my", PXS[my + 20]!) : L.unstyle(moon, "--my");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      const w = S[W]!, h = S[H]!, f = S[F]!;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      if (S[MODE] === WAITING) return;
      // The puddle on the tower's roof (it dries from the ends).
      if (S[PUD]! > 0) {
        ctx.fillStyle = C.sys;
        ctx.fillRect(Math.round(TOWER[2]! * f + 2), Math.round(96 * f) - 1, Math.round(S[PUD]! * Math.min(1, S[PUDL]! / 3)), 1);
      }
      // The moon gets cross: brows, eyes and a frown, on the moon (it rocks with it).
      if (S[FACE]! > 0) {
        const cx = Math.round((MX + S[MDX]!) * f), cy = Math.round((MY + S[MDY]!) * f);
        ctx.fillStyle = C.line;
        ctx.fillRect(cx - 6, cy - 3, 3, 2);
        ctx.fillRect(cx + 3, cy - 3, 3, 2);
        ctx.fillRect(cx - 7, cy - 6, 2, 1);
        ctx.fillRect(cx - 5, cy - 5, 2, 1);
        ctx.fillRect(cx + 5, cy - 6, 2, 1);
        ctx.fillRect(cx + 3, cy - 5, 2, 1);
        ctx.fillRect(cx - 3, cy + 4, 6, 1);
        ctx.fillRect(cx - 4, cy + 5, 1, 1);
        ctx.fillRect(cx + 3, cy + 5, 1, 1);
      }
      // WHOOSH: the letters slam in one by one behind him.
      if (S[WT]! >= 0) {
        const wd = WORDS[S[WN]!]!, shown = Math.min(wd.n, Math.floor(S[WT]! / 0.045) + 1);
        drawWord(ctx, wd, wordX(), S[WY]!, shown, shown < wd.n ? 1 : 0, C.hurt, C.red, C.rim, C.ink);
      }
      const y = S[HY]! + (S[POSE] ? Math.round(Math.sin(S[T]! * 5) * 2 * S[BOB]!) : 0);
      hero(false, y);
      // Against the moon he is a silhouette: the same drawing again, clipped to the moon's pixels.
      const mxa = Math.round(S[MDX]! * f), mya = Math.round(S[MDY]! * f), dx = S[HX]! - MX * f - mxa, dy = y - MY * f - mya;
      if (dx * dx + dy * dy < (MR * f + 24) ** 2) {
        ctx.save();
        ctx.beginPath();
        for (let r = 0; r < moonAt[0]!; r++) ctx.rect(MOX[r]! + mxa, moonAt[1]! + r + mya, MOW[r]!, 1);
        ctx.clip();
        hero(true, y);
        ctx.restore();
      }
      // Dizzy: three stars round his head.
      if (S[DIZ]! > 0) {
        const hx = Math.round(S[HX]!), hy = Math.round(y - (S[POSE] ? 25 : 9));
        for (let i = 0; i < 3; i++) {
          const a = S[DIZ]! * 7 + i * 2.094, x = hx + Math.round(Math.cos(a) * 7), sy = hy + Math.round(Math.sin(a) * 2);
          ctx.fillStyle = C.rim;
          ctx.fillRect(x - 2, sy - 1, 5, 3);
          ctx.fillRect(x - 1, sy - 2, 3, 5);
          ctx.fillStyle = C.hurt;
          ctx.fillRect(x - 1, sy, 3, 1);
          ctx.fillRect(x, sy - 1, 1, 3);
        }
      }
      // A glint off the raised fist as he settles into the first hover.
      const g = S[T]! - 0.12;
      if (S[POSE] === 2 && S[MODE] === HOVER && g > 0 && g < 0.45) {
        const r = g < 0.1 || g > 0.35 ? 1 : g < 0.2 || g > 0.27 ? 2 : 3, gx = Math.round(S[HX]! + 4), gy = Math.round(y + 16 - 35);
        ctx.fillStyle = C.ink;
        ctx.fillRect(gx - r, gy, r * 2 + 1, 1);
        ctx.fillRect(gx, gy - r, 1, r * 2 + 1);
      }
      // BONK!, where he hit.
      if (S[BT]! >= 0) {
        const pop = S[BT]! < 0.06 ? 2 : S[BT]! < 0.12 ? 1 : 0;
        drawWord(ctx, BONK, Math.max(2, Math.min(w - BONK.w - 6, S[BX]! - BONK.w / 2)), Math.max(3, S[BY]! - 12), BONK.n, pop, C.sys, C.attack, C.rim, C.ink);
      }
      fx.draw(ctx);
    },
  });
  engine.start();
  return { engine, dash, destroy: () => engine.destroy() };
}

/** For `slot(target, () => import("./red-cape-whooshes-top").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => whoosh(stage, slot, first);
