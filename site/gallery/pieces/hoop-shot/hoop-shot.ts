// "Hoop Shot": the arcade basketball cabinet in the corner of the games room. Four balls on a ramp
// that rolls them back to you, a hoop on a backboard under a glowing scoreboard, 45 seconds on the
// clock (it starts with your first shot). Drag back from the ball (or swipe) to aim and set the power,
// let go to shoot; fire as fast as the balls come back. After 15 seconds the hoop starts to slide; in
// the last 10 a basket is worth 3. A swish (no rim) adds 1; the rim rattles, the board banks.
// Light: a bright afternoon; dark: a neon night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/flick
// (`sling`: the drag's aim and power as two integers), @fzlt/core/diorama (the 3D), @fzlt/core/slot,
// @fzlt/core/sound. The game is ./model.ts on ../bar/toss.ts (ball flight), pure and seeded
// (tests/hoop-shot.test.mjs); the room and the stage's parts are ../bar/room.ts (the bar-games
// series); this file is the scene and the controls (tests/hoop-shot.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaPoints } from "../../../../src/diorama";
import { sling } from "../../../../src/flick";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { beats, camTween, effects, font, isLight, kit, looks, outlined, shell, type Look } from "../bar/room";
import { OUT } from "../bar/toss";
import { AIMS, BALLS, BONUS_AT, BR, BX, HW, HX, HY, LEN, MOVE_AT, ON, OVER, RAMP0, READY, RISE, ROUND, RR, RX, RY, STEPS, T_BOARD, T_RIM, clock, inHand, launchOf, newGame, resetGame, shoot, tick, touched, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
/** World units per metre; the lane's floor in the world; where the cabinet's front sits along x. */
const S = 6, BY = 0.8 * S, OX = -8;
const wx = (x: number) => OX + x * S, wy = (y: number) => BY + y * S, wz = (z: number) => z * S;
const [LIGHT, DARK] = looks(
  { cab: "#6f9fd8", cab2: "#5a86c0", trim: "#f2c46d", lane: "#3a3f5c", lane2: "#4a5072", net: "#ffffff", board: "#fbfaf6", boardL: "#ef8f7a", rimC: "#ff7a2f", ball: "#f08a3c", seam: "#5a2a12", led: "#1b1d2e", ledOn: "#ff6a4d", glass: "#cfe8ff" },
  { cab: "#3b3f88", cab2: "#2d3170", trim: "#c79a3f", lane: "#1c1f33", lane2: "#262a44", net: "#cfd6ff", board: "#e8e6f0", boardL: "#ff5fa8", rimC: "#ff8a3d", ball: "#ec7d32", led: "#0a0b14", ledOn: "#ff5f6d", glass: "#7fb4ff" },
);
const T_GO = 1, T_END = 2, T_POSTER = 3;
const VIEWS = ["SHOOT", "SIDE"];

export type HoopShotScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { phase: number; score: number; made: number; shots: number; clock: number; hand: number; aim: boolean; card: boolean; view: string };
  /** The screen point (CSS px, from the stage's top left) of lane point (x, z) metres (on the lane's floor plane). */
  screen(x: number, z: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): HoopShotScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Look = isLight() ? LIGHT : DARK;

  const ui = shell(engine, stage, "Hoop Shot: drag back from the ball to aim and set the power, let go to shoot; or the arrow keys aim and set the power and Space shoots (V view, M mutes)",
    `<b class="br-chip br-turn">0:45</b><b class="br-chip br-n">Score <span>0</span></b><b class="br-chip br-r">Best <span>0</span></b>`);
  const { canvas, play, head, top, hint, card, again } = ui;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const snd = sound(engine, {
    cues: { shoot: "shoot", rim: "clang", board: "bank", cage: "thud", net: "swish", score: "power", bonus: "ready", buzzer: "buzz", win: "win" },
    notes: {
      shoot: [[300, 520, 0.08, 0, "triangle", 0.08]],
      clang: [[1250, 1150, 0.12, 0, "square", 0.05], [620, 560, 0.18, 0, "triangle", 0.14]],
      bank: [[180, 120, 0.08, 0, "square", 0.09]],
      thud: [[140, 70, 0.1, 0, "triangle", 0.18]],
      swish: [[1800, 600, 0.2, 0, "sawtooth", 0.03], [900, 400, 0.18, 0.02, "triangle", 0.06]],
      buzz: [[110, 108, 0.7, 0, "sawtooth", 0.12], [220, 218, 0.7, 0, "square", 0.05]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_VIEW = 1;
  const [muteK, viewK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "VIEW · SHOOT", aria: "Camera view (V)", id: K_VIEW },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else cycleView();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the game, the diorama, the room ----
  const events = {
    emit(t: string, a = 0, b = 0, x = 0, y = 0, v = 0) {
      if (t === "toss:hit" && !posing) {
        touched(g, a, b);
        const bx = wx(g.w.x[a]!), by = wy(g.w.y[a]!), bz = wz(g.w.z[a]!);
        if (b === T_RIM) engine.events.emit("rim"), sparks(bx, by, bz, 6), (rimFlash = engine.time);
        else if (b === T_BOARD) engine.events.emit("board"), (boardFlash = engine.time);
        else if (v > 1.2) engine.events.emit("cage");
      }
      return engine.events.emit(t, a, b, x, y, v);
    },
  };
  let g: Game = newGame(1, events), seed = 1, fxRnd = seeded(1), posing = false, best = 0;
  const aim = sling({ pull: 0.8 * S, max: 1, steps: STEPS, turns: 4096, min: 0.04 });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.c.bg!, overlay: drawOverlay, get shadowColor() { return P.c.shadow!; } });
  const K = kit(dio, () => P);
  const put = K.put;
  const BA = new Float64Array(BALLS * 3), HA = new Float64Array(3);
  let fx: ReturnType<typeof effects>;
  const balls: DioramaPoints[] = [];
  let shadows: DioramaPoints;
  const SIGN = { text: "HOOPS", glyph: "◍", x: 6, y: 13.2, size: 1.3 };

  function buildScene() {
    K.clear();
    balls.length = 0;
    K.room({ w: 46, d: 30, rug: [-1, 2, 28, 14], plant: [19, -11.8], sign: SIGN });
    dio.cluster("cab", { fixed: 1 });
    const x0 = wx(-0.08), x1 = wx(LEN + 0.12), L = x1 - x0, W = 2 * HW * S + 0.5;
    // The cabinet: its body under the lane, the front with its coin panel, the rails, the back tower.
    put({ id: "body", size: [L, BY - 0.4, W], pos: [(x0 + x1) / 2, 0.4, 0], color: "cab", cluster: "cab", layer: 0.2, shadow: 0.3 });
    put({ size: [L + 0.2, 0.4, W + 0.2], pos: [(x0 + x1) / 2, 0, 0], color: "cab2", cluster: "cab", layer: 0.1 });
    put({ size: [0.2, 0.9, W], pos: [x0 + 0.1, BY - 0.95, 0], color: "trim", cluster: "cab", layer: 0.5 });
    for (let s = -1; s <= 1; s += 2) put({ size: [L, 0.75, 0.25], pos: [(x0 + x1) / 2, BY - 0.2, s * (W / 2 - 0.12)], color: "cab2", cluster: "cab", layer: 0.6 });
    // The lane: the tray at your end and the ramp up to the back (a wedge, tall at the back).
    put({ size: [RAMP0 * S, 0.1, 2 * HW * S], pos: [wx(RAMP0 / 2), BY - 0.1, 0], color: "lane", cluster: "cab", layer: 0.7 });
    put({ shape: "wedge", size: [(LEN - RAMP0) * S, RISE * S, 2 * HW * S], pos: [wx((RAMP0 + LEN) / 2), BY, 0], rot: [0, Math.PI, 0], color: "lane2", cluster: "cab", layer: 0.7 });
    dio.decal("cab", 0.75, laneArt);
    // The back tower: its posts, the scoreboard over the board, the board, the cage's glass.
    put({ size: [0.3, 3.0 * S - BY + 0.2, W], pos: [wx(LEN) + 0.4, BY, 0], color: "cab", cluster: "cab", layer: 0.3 });
    put({ id: "marq", size: [0.7, 0.75 * S, W + 0.3], pos: [wx(LEN) - 0.6, wy(2.48), 0], color: "cab2", cluster: "cab", layer: 0.35 });
    put({ size: [0.12, 0.62 * S, W - 0.4], pos: [wx(LEN) - 0.98, wy(2.54), 0], color: "led", cluster: "cab", layer: 0.4 });
    dio.decal("cab", 0.45, marquee);
    for (let s = -1; s <= 1; s += 2) put({ size: [L - 0.4, 1.65 * S, 0.04], pos: [(x0 + x1) / 2 + 0.2, BY + 0.9, s * HW * S], color: "glass", alpha: 0.13, cluster: "cab", layer: 0.9 });
    dio.decal("cab", 0.95, cageArt);
    // The board (slides with the hoop): a group in its own cluster, the hoop's rim and net as decals.
    dio.cluster("board", { fixed: 2 });
    put({ id: "bd", size: [0.08, 0.92 * S, 0.64 * S], pos: [wx(BX) + 0.04, wy(RY - 0.28), 0], color: "board", cluster: "board", layer: 0 });
    put({ size: [0.14, 0.12, 0.3], pos: [wx(BX) - 0.07, wy(RY - 0.06), 0], color: "rimC", cluster: "board", layer: 0.5 });
    dio.decal("board", 0.3, boardArt);
    dio.decal("board", 0.6, (ctx) => hoopArt(ctx, false));
    dio.cluster("hoopF", { at: HA });
    dio.decal("hoopF", 1, (ctx) => hoopArt(ctx, true));
    // The balls: each its own points pool and cluster (so it sorts against the hoop's front), shadows on the lane.
    shadows = dio.points({ cap: BALLS, cluster: "cab", layer: 0.8, paint: paintShadow });
    for (let i = 0; i < BALLS; i++) {
      const cl = "b" + i;
      dio.cluster(cl, { at: BA.subarray(i * 3, i * 3 + 3) });
      balls.push(dio.points({ cap: 1, cluster: cl, layer: 1, paint: (ctx, _j, p) => paintBall(ctx, p, i) }));
    }
    fx = effects(dio, 140, 0.05);
  }
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  function laneArt(ctx: CanvasRenderingContext2D) {
    // Stripes up the ramp, a line at the foul edge.
    ctx.fillStyle = P.c.trim!;
    ctx.globalAlpha = 0.85;
    const w = HW * S;
    K.quad(ctx, wx(RAMP0) - 0.06, -w, wx(RAMP0) + 0.06, w, BY + 0.01), ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < 6; k++) {
      const a = RAMP0 + 0.15 + k * 0.38, ya = (a - RAMP0) / (LEN - RAMP0) * RISE, yb = (a + 0.16 - RAMP0) / (LEN - RAMP0) * RISE;
      K.poly(ctx, wx(a), wy(ya) + 0.01, -w, wx(a + 0.16), wy(yb) + 0.01, -w, wx(a + 0.16), wy(yb) + 0.01, w, wx(a), wy(ya) + 0.01, w), ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function cageArt(ctx: CanvasRenderingContext2D) {
    // The cage's net on both sides: a diamond mesh, faint.
    ctx.strokeStyle = P.c.net!;
    ctx.globalAlpha = P.night ? 0.16 : 0.22;
    ctx.lineWidth = 1;
    for (let s = -1; s <= 1; s += 2) {
      const z = s * HW * S, y0 = BY + 0.9, y1 = BY + 0.9 + 1.65 * S;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const x = wx(0.35) + k * ((LEN - 0.35) * S) / 16;
        dio.project(x, y0, z, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
        dio.project(x + 1.2, y1, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
        dio.project(x, y0, z, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
        dio.project(x - 1.2, y1, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function boardArt(ctx: CanvasRenderingContext2D) {
    // The shooter's square over the hoop, a lit edge when a ball bangs it.
    const x = wx(BX) - 0.002, z = wz(g.hz), y = wy(RY);
    ctx.strokeStyle = P.c.boardL!;
    ctx.lineWidth = 3;
    K.poly(ctx, x, y + 0.05, z - 0.95, x, y + 0.05, z + 0.95, x, y + 1.3, z + 0.95, x, y + 1.3, z - 0.95), ctx.stroke();
    ctx.lineWidth = 4;
    K.poly(ctx, x, y - 1.6, z - 1.86, x, y - 1.6, z + 1.86, x, y + 3.88, z + 1.86, x, y + 3.88, z - 1.86), ctx.stroke();
    const fl = engine.time - boardFlash;
    if (fl < 0.25) {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = (0.25 - fl) * 2;
      K.poly(ctx, x, y - 1.6, z - 1.86, x, y - 1.6, z + 1.86, x, y + 3.88, z + 1.86, x, y + 3.88, z - 1.86), ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  /** The hoop: the back half of the rim and net (behind a ball inside it) or the front half. */
  function hoopArt(ctx: CanvasRenderingContext2D, front: boolean) {
    const c = dio.cam, ex = Math.sin(c.yaw), ez = Math.cos(c.yaw), cx = wx(RX), cy = wy(RY), cz = wz(g.hz), R = RR * S, n = 28;
    const hot = engine.time - rimFlash < 0.15;
    // The net: strings from the rim down to a narrower ring, swaying after a basket.
    const sway = Math.max(0, 1 - (engine.time - netT) * 2), sw = Math.sin((engine.time - netT) * 24) * 0.25 * sway;
    ctx.strokeStyle = P.c.net!;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let k = 0; k < n; k += 2) {
      const a = (k / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      if ((ca * ex + sa * ez > 0) !== front) continue;
      const b = a + 0.5;
      dio.project(cx + ca * R, cy, cz + sa * R, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
      dio.project(cx + Math.cos(b) * R * 0.62 + sw, cy - 2.4 + sway * 0.5, cz + Math.sin(b) * R * 0.62, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
      dio.project(cx + ca * R, cy, cz + sa * R, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
      dio.project(cx + Math.cos(a - 0.5) * R * 0.62 + sw, cy - 2.4 + sway * 0.5, cz + Math.sin(a - 0.5) * R * 0.62, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The rim: a thick orange ring, outlined.
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? (hot ? "#ffffff" : P.c.rimC!) : "#1f2433";
      ctx.lineWidth = pass ? 3.5 : 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      let on = false;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * TAU, ca = Math.cos(a), sa = Math.sin(a), f = ca * ex + sa * ez > 0;
        dio.project(cx + ca * R, cy, cz + sa * R, tmp);
        if (f === front) on ? ctx.lineTo(tmp[0]!, tmp[1]!) : (ctx.moveTo(tmp[0]!, tmp[1]!), (on = true));
        else on = false;
      }
      ctx.stroke();
    }
  }
  function marquee(ctx: CanvasRenderingContext2D) {
    // The scoreboard: the clock and the score in LED digits, HOOP SHOT along the top.
    const x = wx(LEN) - 1.05, y = wy(2.54) + 0.62 * S * 0.5, z0 = -(HW * S), sz = 0.62 * S * 0.34;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = font(100, 900);
    const t = Math.max(0, Math.ceil(clock(g))), bonus = g.tick >= BONUS_AT && g.phase === ON;
    for (let pass = 0; pass < (P.night ? 2 : 1); pass++) {
      ctx.globalAlpha = P.night && !pass ? 0.3 : 1;
      const k = P.night && !pass ? 1.08 : 1;
      ctx.fillStyle = bonus && (engine.time * 4) % 2 < 1 ? "#ffd23f" : P.c.ledOn!;
      K.text(ctx, (t < 10 ? "0:0" : "0:") + t, x, y + 0.5, z0 * 0.5, 0, 0, sz * k, 0, -sz * k, 0);
      ctx.fillStyle = "#ffd23f";
      K.text(ctx, "" + g.score, x, y + 0.5, -z0 * 0.5, 0, 0, sz * k, 0, -sz * k, 0);
      ctx.fillStyle = P.c.neon!;
      K.text(ctx, "HOOP SHOT", x, y + 2.1, 0, 0, 0, sz * 0.55 * k, 0, -sz * 0.55 * k, 0);
    }
    ctx.globalAlpha = 1;
  }
  function paintBall(ctx: CanvasRenderingContext2D, p: DioramaPoints, i: number) {
    const x = p.sx[0]!, y = p.sy[0]!, r = Math.max(3, p.sr[0]!), a = ROLL[i]!;
    ctx.fillStyle = P.c.ball!;
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Seams, turned by the ball's roll.
    ctx.strokeStyle = P.c.seam!;
    ctx.lineWidth = Math.max(1, r * 0.09);
    const c = Math.cos(a), s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x - c * r, y - s * r);
    ctx.lineTo(x + c * r, y + s * r);
    ctx.moveTo(x + s * r, y - c * r);
    ctx.lineTo(x - s * r, y + c * r);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.45, a + 0.785, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.25, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function paintShadow(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    if (p.a[i]! <= 0) return;
    ctx.fillStyle = P.c.shadow!;
    ctx.globalAlpha = p.a[i]! * 0.35;
    ctx.beginPath();
    ctx.ellipse(p.sx[i]!, p.sy[i]!, p.sr[i]! * 1.1, p.sr[i]! * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function sparks(x: number, y: number, z: number, n: number) {
    if (RM) return;
    for (let k = 0; k < n; k++) fx.spawn(1, x, y, z, (fxRnd() - 0.5) * 3, fxRnd() * 2.5, (fxRnd() - 0.5) * 3, 0.3, 0.05, "#ffffff");
  }

  // ---- state ----
  const B = beats(engine);
  const ROLL = new Float64Array(BALLS);
  let view = 0, dragging = false, kbd = false, kAim = 0, kLevel = 58, dirty = true, hudDirty = true, rimFlash = -9, boardFlash = -9, netT = -9;
  let toastT = 0, toastS = "", toastC = "", toastBig = false, said15 = false, said35 = false;
  const press3 = new Float64Array(3), hit3 = new Float64Array(3), LV = new Float64Array(6);
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  function reset(s: number) {
    seed = s >>> 0;
    resetGame(g, seed);
    fxRnd = seeded(seed * 17 + 3);
    B.clear();
    dragging = kbd = false;
    toastT = 0;
    said15 = said35 = false;
    buildScene();
    card.hidden = true;
    hudDirty = dirty = true;
  }
  const toast = (s: string, c: string, big: boolean, t = 1.1) => ((toastS = s), (toastC = c), (toastBig = big), (toastT = t));
  function fire(a: number, level: number) {
    if (g.phase === OVER || inHand(g) < 0 || !card.hidden) return false;
    const first = g.phase === READY;
    if (!shoot(g, a, level)) return false;
    engine.events.emit("shoot");
    if (first) toast("GO!", P.c.neon2!, false, 0.8);
    hudDirty = dirty = true;
    engine.wake();
    return true;
  }
  function onScored() {
    for (let i = 0; i < BALLS; i++) {
      if (!((g.scored >> i) & 1)) continue;
      netT = engine.time;
      engine.events.emit(g.lastSwish ? "net" : "score");
      toast(g.lastSwish ? `SWISH +${g.lastPts}` : `+${g.lastPts}`, g.lastSwish ? P.c.neon2! : P.c.rimC!, g.lastSwish === 1);
      if (!RM) for (let k = 0; k < (g.lastSwish ? 30 : 16); k++) fx.spawn(3, wx(RX), wy(RY) - 1, wz(g.hz), (fxRnd() - 0.5) * 4, 1 + fxRnd() * 3, (fxRnd() - 0.5) * 4, 1 + fxRnd() * 0.6, 0.07, fxRnd() < 0.5 ? P.c.rimC! : fxRnd() < 0.5 ? P.c.neon2! : "#ffd23f");
      ui.say(`${g.lastSwish ? "Swish! " : ""}+${g.lastPts}: ${g.score} points`);
    }
  }
  function showEnd() {
    const nb = g.score > best;
    if (nb) best = g.score;
    ui.end(nb && g.score > 0 ? `New best: ${g.score}!` : `${g.score} points`, `${g.made} of ${g.shots} in · ${g.swish} swish${g.swish === 1 ? "" : "es"} · best ${best}`);
    engine.events.emit(nb ? "win" : "buzzer");
    ui.say(`Time! ${g.score} points, ${g.made} of ${g.shots}. Best ${best}`);
    hudDirty = dirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const cam = camTween(dio);
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.2;
  const FR = new Float64Array(15);
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const c = cam.goal, W = dio.width, H = dio.height, side = view === 1, tall = portrait();
    c.fov = 0.44;
    c.yaw = side ? (tall ? -48 * D : -30 * D) : tall ? -90 * D : -60 * D;
    c.pitch = side ? 16 * D : tall ? 13 * D : 15 * D;
    c.tx = wx(1.4);
    c.ty = wy(1.0);
    c.tz = 0;
    const w = HW * S + 0.3;
    FR.set([wx(-0.1), BY, -w, wx(-0.1), BY, w, wx(LEN), wy(3.05), -w, wx(LEN), wy(3.05), w, wx(LEN), BY - 0.2, 0]);
    dio.fit(c, FR, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    cam.go(snap || RM);
    SIGN.size = tall ? 0 : 1.3;
    hudDirty = dirty = true;
    engine.wake();
  }
  const cycleView = () => setView((view + 1) % 2, false);

  // ---- the overlay: the aim, the toast ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (inHand(g) >= 0 && g.phase !== OVER && card.hidden && (aim.active || kbd)) {
      let a: number, lv: number;
      if (aim.active) (a = aimOf(aim.angle)), (lv = aim.level);
      else (a = kAim), (lv = kLevel);
      dio.project(wx(HX), wy(HY), 0, tmp);
      const sx = tmp[0]!, sy = tmp[1]!, pw = lv / STEPS, col = pw > 0.8 ? "#ff5d5d" : pw > 0.5 ? "#ffd23f" : "#ffffff";
      if (aim.active) {
        dio.project(wx(HX) - aim.dx * aim.power * 0.8 * S, wy(HY), -aim.dz * aim.power * 0.8 * S, tmp2);
        ctx.strokeStyle = P.c.rimC!;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(tmp2[0]!, tmp2[1]!, 6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      // The arc: the first 0.4 s of the flight.
      launchOf(a, lv, LV);
      let x = HX, y = HY, z = 0, vx = LV[0]!, vy = LV[1]!;
      const vz = LV[2]!, h = 1 / 120;
      ctx.fillStyle = col;
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 2;
      for (let k = 1; k <= 48; k++) {
        vx *= 1 - 0.02 * h * 6;
        vy -= 9.8 * h;
        x += vx * h; y += vy * h; z += vz * h;
        if (k % 4) continue;
        dio.project(wx(x), wy(y), wz(z), tmp);
        ctx.globalAlpha = 1 - k / 60;
        ctx.beginPath();
        ctx.arc(tmp[0]!, tmp[1]!, 3.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const rr = 28;
      ctx.lineWidth = 6;
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(20,22,36,0.55)";
      ctx.beginPath();
      ctx.arc(sx, sy, rr, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * pw));
      ctx.stroke();
    }
    if (toastT > 0) {
      ctx.globalAlpha = Math.min(1, toastT * 3);
      outlined(ctx, toastS, dio.width / 2, V[3]! + 32, toastBig ? 40 : 32, toastC);
      ctx.globalAlpha = 1;
    }
  }
  const aimOf = (angle: number) => Math.max(-AIMS, Math.min(AIMS, Math.round(((((angle + 2048) % 4096) - 2048) / 4096) * TAU / 0.35 * AIMS)));

  // ---- the HUD ----
  function hudWrite() {
    const t = Math.max(0, Math.ceil(clock(g))), ts = g.phase === OVER ? "Time!" : `0:${t < 10 ? "0" : ""}${t}`;
    if (ui.set(0, ts)) (turnEl.textContent = ts), turnEl.classList.toggle("br-them", g.phase === ON && g.tick >= BONUS_AT);
    if (ui.set(1, g.score)) nums[0]!.textContent = "" + g.score;
    if (ui.set(2, best)) nums[1]!.textContent = "" + best;
    const h = g.phase === READY ? (kbd ? "←/→ aim · ↑/↓ power · Space shoots: the clock starts" : "Drag back from the ball and let go to shoot: the clock starts") : g.phase === OVER ? "" : g.tick >= BONUS_AT ? "Bonus time: 3 a basket" : g.tick >= MOVE_AT ? "The hoop is moving" : "Fire as fast as the balls come back · a swish adds 1";
    if (ui.set(4, h)) hint.textContent = h;
    const v = VIEWS[view]!;
    if (ui.set(5, v)) (viewK!.textContent = "VIEW · " + v), viewK!.setAttribute("aria-label", `Camera view: ${v.toLowerCase()} (V)`);
  }

  // ---- the frame ----
  function poseBalls(dt: number) {
    const w = g.w;
    for (let i = 0; i < BALLS; i++) {
      const p = balls[i]!, hand = g.hand[i] === 1;
      const x = hand ? HX : w.x[i]!, y = hand ? HY : w.y[i]!, z = hand ? 0 : w.z[i]!;
      p.n = hand || w.state[i] !== OUT ? 1 : 0;
      p.x[0] = wx(x); p.y[0] = wy(y); p.z[0] = wz(z); p.r[0] = BR * S;
      // The seams turn with the ball's speed along the lane.
      if (!hand) ROLL[i] = ROLL[i]! + (w.vx[i]! * dt) / BR * 0.5;
      BA[i * 3] = p.x[0]!; BA[i * 3 + 1] = p.y[0]!; BA[i * 3 + 2] = p.z[0]!;
      // Its shadow on the lane (the ramp's height under it).
      const gy = x > RAMP0 ? ((x - RAMP0) / (LEN - RAMP0)) * RISE : 0;
      shadows.x[i] = wx(x); shadows.y[i] = wy(gy) + 0.02; shadows.z[i] = wz(z); shadows.r[i] = BR * S;
      shadows.a[i] = p.n && !hand && x > -0.05 && x < LEN && y - gy < 1.5 ? 1 - (y - gy) / 1.6 : 0;
    }
    shadows.n = BALLS;
    HA[0] = wx(RX) - Math.cos(dio.cam.yaw + Math.PI / 2) * 0; HA[1] = wy(RY); HA[2] = wz(g.hz);
    // The hoop's front anchor: toward the camera from its centre.
    HA[0] = wx(RX) + Math.sin(dio.cam.yaw) * RR * S; HA[2] = wz(g.hz) + Math.cos(dio.cam.yaw) * RR * S;
  }
  let last = 0;
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = isLight() ? LIGHT : DARK;
        if (nx !== P) (P = nx), dio.setLight(P.light, P.amb), K.recolor(), (dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = viewK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(-1, true);
      }
    },
    step(e, dt) {
      let moving = false;
      for (let w = B.due(e.time); w; w = B.due(e.time)) {
        moving = true;
        if (w === T_END) showEnd();
        else if (w === T_POSTER) fire(0, 62);
        else if (w === T_GO) void 0;
      }
      if (g.phase !== READY || g.w.busy) {
        const was = g.phase;
        tick(g);
        if (g.scored) onScored();
        if (g.phase === ON && !said15 && g.tick >= MOVE_AT) (said15 = true), toast("HOOP ON THE MOVE", P.c.neon2!, false, 1.4), (hudDirty = true);
        if (g.phase === ON && !said35 && g.tick >= BONUS_AT) (said35 = true), toast("BONUS TIME · 3 A BASKET", "#ffd23f", true, 1.6), engine.events.emit("bonus"), (hudDirty = true);
        if (was === ON && g.phase === OVER) toast("TIME!", "#ff5d5d", true, 1.4), engine.events.emit("buzzer"), B.later(RM ? 0.1 : 1.3, T_END);
        if (g.phase === ON || g.w.busy) moving = true;
        const sec = Math.ceil(clock(g));
        if (sec !== last) (last = sec), (hudDirty = true);
      }
      if (fx.step(dt)) moving = true;
      if (cam.step(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (e.time - netT < 0.6 || e.time - rimFlash < 0.2 || e.time - boardFlash < 0.3) moving = true;
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), poseBalls(1 / 60), fx.draw(), dio.draw();
    },
  });

  // ---- input ----
  const ground = (x: number, y: number, out: Float64Array) => dio.ground(x, y, BY, out);
  const can = () => g.phase !== OVER && inHand(g) >= 0 && card.hidden;
  let ox = 0, oy = 0;
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    const r = play.getBoundingClientRect();
    (ox = r.left), (oy = r.top);
    if (g.phase === OVER || !card.hidden || !ground(e.clientX - ox, e.clientY - oy, press3)) return;
    play.setPointerCapture(e.pointerId);
    dragging = true;
    kbd = false;
    aim.begin(wx(HX), 0, wx(HX), 0);
    play.classList.add("br-drag");
    hudDirty = dirty = true;
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!dragging || !ground(e.clientX - ox, e.clientY - oy, hit3)) return;
    aim.move(wx(HX) + hit3[0]! - press3[0]!, hit3[2]! - press3[2]!);
    dirty = true;
    engine.busy();
    engine.wake();
  }, sig);
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    play.classList.remove("br-drag");
    if (e.type === "pointerup" && aim.end()) (kAim = aimOf(aim.angle)), (kLevel = aim.level), fire(kAim, kLevel);
    else aim.cancel();
    dirty = true;
    engine.wake();
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "v") return void (e.preventDefault(), cycleView());
    if (g.phase === OVER) return;
    const ky = e.key, x = ky === "ArrowLeft" ? -1 : ky === "ArrowRight" ? 1 : 0, y = ky === "ArrowUp" ? 1 : ky === "ArrowDown" ? -1 : 0;
    if (x || y) {
      e.preventDefault();
      kbd = true;
      kAim = Math.max(-AIMS, Math.min(AIMS, kAim - x * 2));
      kLevel = Math.max(0, Math.min(STEPS, kLevel + y));
      hudDirty = dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      if (!can()) return;
      kbd ? fire(kAim, kLevel) : ((kbd = true), (hudDirty = dirty = true), engine.wake());
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): mid-round, 18 points, a ball on its way to the hoop.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261116);
    posing = true;
    g.phase = ON;
    g.tick = 21 * 60;
    g.score = 18;
    best = 24;
    posing = false;
    B.clear();
    B.later(0.1, T_POSTER);
    hudDirty = dirty = true;
  }

  reset((engine.random() * 100000) | 0);
  engine.start();
  return {
    engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      return { phase: g.phase, score: g.score, made: g.made, shots: g.shots, clock: clock(g), hand: inHand(g), aim: aim.active || kbd, card: !card.hidden, view: VIEWS[view]! };
    },
    screen(x: number, z: number) {
      dio.project(wx(x), BY, wz(z), tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a shot on its way to the hoop (scripts/gallery-posters.mjs). */
export const posterAt = 0.45;
