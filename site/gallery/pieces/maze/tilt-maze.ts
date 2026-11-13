// "Tilt Maze" (hero): the classic wooden labyrinth box on a tabletop diorama. Tilt the board (drag
// anywhere: the further you pull, the more it leans; the arrows; or, on a phone, TILT and the phone
// itself) to roll a steel ball along the numbered line, past the holes. Drop into one and the ball
// falls through and comes back to the start; reach the cup and the next board drops in. Three
// boards of rising difficulty, a timer (it runs while the ball rolls) and a best time per board.
// The board leans on its gimbal inside the box, the two knobs turn with it, the ball rolls with its
// shadow and its highlight. Dark is a neon night; light a pastel afternoon.
// Bricks: the kernel (fixed step, settle, its ledger for every page write: Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D, the depth-sorted ball and shadow points, the
// board's decals), @fzlt/core/slot, @fzlt/core/sound. The physics is ./tilt.ts, pure and
// allocation-free (tests/tilt-maze.test.mjs: every board cleared by a steady hand, zero
// allocation); this file is the scene and the controls (tests/tilt-maze.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { BALL, CUP, FALLING, HD, HOLE, HOME, HW, LEVELS, MAX_TILT, WALL, load, newBoard, pilot, respawn, step, tilt, type Board } from "./tilt";

const TAU = 6.283185307179586, D = Math.PI / 180;
// Palettes by role: a pastel afternoon (light) and a neon night (dark).
const LIGHT = {
  bg: "#ece6dc", floor: "#dcd3c6", wallB: "#efe0d0", wallR: "#d6e2dc", base: "#b98d68", top: "#e2c29c",
  case: "#c98f5c", case2: "#dba878", slab: "#f1dcb8", rim: "#d79f6a", wall: "#c4844f", wall2: "#d69a63", knob: "#8b5a3c", grip: "#f1dcb8",
  hole: "#3b2a26", holeIn: "#1d1514", holeRim: "#a8754e", line: "#3b2f3f", dot: "#fff6e6", done: "#ff8a6b", cup: "#ffd36b", cupIn: "#6b4a2e",
  ball: "#8d93a3", ball2: "#c3c8d3", spec: "#ffffff", glint: "#ffd8b8",
  map: "#f6efdf", map2: "#cfe3d6", pen: "#ff8a6b", dish: "#b9c7e6", cupMug: "#7fcfa8",
  shadow: "#3a2d3c", ring: "#ffd36b", light: [-0.45, 1, 0.5], amb: 0.56, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#0f1229", floor: "#22274a", wallB: "#292e55", wallR: "#20364a", base: "#5e4536", top: "#7a5c46",
  case: "#5a3d30", case2: "#6e4c3a", slab: "#2c2a4a", rim: "#47355a", wall: "#5b3f72", wall2: "#6f4e8a", knob: "#3b2a3a", grip: "#7ffcff",
  hole: "#07060d", holeIn: "#000000", holeRim: "#ff3fa4", line: "#7ffcff", dot: "#1a1c38", done: "#ff3fa4", cup: "#ffcf4a", cupIn: "#2a1a10",
  ball: "#6d7390", ball2: "#b2b8d6", spec: "#ffffff", glint: "#7ffcff",
  map: "#2f3360", map2: "#2b4b5e", pen: "#ff3fa4", dish: "#3b4377", cupMug: "#3fa08a",
  shadow: "#000000", ring: "#ffd36b", light: [-0.4, 1, 0.55], amb: 0.46, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night">;

// The table top (TT), the case's base, where the board's gimbal sits (PIV), the slab's thickness,
// the walls' height.
const TT = 1.24, CASE_H = 0.6, PIV = TT + CASE_H + 0.25, SLAB = 0.3, WH = 0.62, BW = HW + WALL, BD = HD + WALL;
// Phases: playing, cleared (a beat), swapping the board (lift out, drop in), all done.
const P_PLAY = 0, P_CLEAR = 1, P_SWAP = 2, P_DONE = 3;
const FALL_T = 0.7;

export type TiltScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly bd: Board;
  readonly state: { level: number; phase: number; t: number; falls: number; far: number; ball: number; card: boolean; times: number[]; tiltOn: boolean; tx: number; tz: number };
  /** The stage point (CSS px) a drag starting at the board's centre should end at to lean the
   *  board toward world direction (dx, dz) by the full tilt. */
  dragFor(dx: number, dz: number): [number, number, number, number];
  /** Go to board l (tests). */
  goto(l: number): void;
  /** A steady hand takes over until the ball is home or a fall (tests, the poster). */
  autopilot(on: boolean): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): TiltScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: canvas, a key over it, stickers, end card, keys ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "tm-play";
  play.setAttribute("aria-label", "Tilt Maze: hold the arrows to tilt the board and roll the ball along the numbered line, past the holes, to the cup. R resets the ball, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "tm-hud";
  hud.innerHTML = `<div class="tm-head"><p class="tm-top"><b class="tm-chip tm-lvl">Board 1/3</b><b class="tm-chip tm-time">Time <span>0.0</span> · Best <span>—</span></b><b class="tm-chip tm-pt">Point <span>0/0</span> · Falls <span>0</span></b></p><p class="tm-hint"></p></div><p class="tm-live" aria-live="polite"></p><div class="tm-card" role="dialog" aria-label="Every board cleared" hidden><b>All three boards</b><p></p><p class="tm-stats"></p><button type="button" class="bui-key tm-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const lvlEl = top.children[0] as HTMLElement, tNums = top.children[1]!.querySelectorAll("span"), pNums = top.children[2]!.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { knock: "tock", knock2: "tick", drop: "drop", back: "pop", point: "pip", cup: "win", swap: "whoosh", reset: "click", done: "win", tilt: "click" },
    notes: {
      tock: [[520, 380, 0.05, 0, "triangle", 0.12], [190, 140, 0.06, 0, "sine", 0.08]],
      tick: [[900, 700, 0.03, 0, "triangle", 0.06]],
      drop: [[700, 160, 0.32, 0, "sine", 0.12], [130, 70, 0.12, 0.3, "square", 0.05], [240, 180, 0.05, 0.42, "triangle", 0.08]],
      pop: [[420, 760, 0.08, 0, "sine", 0.08]],
      pip: [[1760, 1760, 0.05, 0, "sine", 0.04]],
      whoosh: [[260, 820, 0.35, 0, "triangle", 0.05]],
    },
    volume: 0.1,
  });
  const K_MUTE = 0, K_RESET = 1, K_TILT = 2;
  const canTilt = coarse && typeof DeviceOrientationEvent !== "undefined";
  const [muteK, resetK, tiltK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "RESET", aria: "Ball back to the start (R)", id: K_RESET },
    { label: "TILT", aria: "Tilt the phone to tilt the board", id: K_TILT },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else if (id === K_RESET) resetBall();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  tiltK!.setAttribute("aria-pressed", "false");
  tiltK!.hidden = !canTilt;
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the diorama ----
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const keyed: DioramaObject[] = [], keyName: Key[] = [];
  const put = (d: DioramaObjectDef & { color?: Key }) => {
    const k = d.color as Key | undefined, ob = dio.add({ ...d, color: k ? P[k] : undefined });
    if (k) keyed.push(ob), keyName.push(k);
    return ob;
  };
  let bd: Board = newBoard(), level = 0, phase = P_PLAY, T = 0, auto = false, deckY = 0, deckA = 1;
  let deck: DioramaObject | null = null, knobF: DioramaObject | null = null, knobS: DioramaObject | null = null;
  let ballP: DioramaPoints, shadP: DioramaPoints;
  // The board's world matrix (rotation rows, then the pivot), from the drawn tilt.
  const R = new Float64Array(12);
  let dtx = 0, dtz = 0; // the drawn tilt (eases after the physics' tilt)
  function matrix() {
    const sx = Math.sin(dtz), cx = Math.cos(dtz), sz = Math.sin(-dtx), cz = Math.cos(-dtx);
    (R[0] = cz), (R[1] = -sz), (R[2] = 0), (R[3] = sz * cx), (R[4] = cz * cx), (R[5] = -sx), (R[6] = sz * sx), (R[7] = cz * sx), (R[8] = cx);
    (R[9] = 0), (R[10] = PIV + deckY), (R[11] = 0);
  }
  /** Board point (x, y above the slab, z) to the screen (out[0..2]); false if behind the camera. */
  function proj(x: number, y: number, z: number, out: Float64Array) {
    const yy = y + SLAB;
    return dio.project(R[0]! * x + R[1]! * yy + R[2]! * z + R[9]!, R[3]! * x + R[4]! * yy + R[5]! * z + R[10]!, R[6]! * x + R[7]! * yy + R[8]! * z + R[11]!, out);
  }
  /** Board point to world (out[0..2]). */
  function world(x: number, y: number, z: number, out: Float64Array, k = 0) {
    const yy = y + SLAB;
    out[k] = R[0]! * x + R[1]! * yy + R[2]! * z + R[9]!;
    out[k + 1] = R[3]! * x + R[4]! * yy + R[5]! * z + R[10]!;
    out[k + 2] = R[6]! * x + R[7]! * yy + R[8]! * z + R[11]!;
  }

  function buildScene() {
    const Lv = LEVELS[level]!;
    dio.clear();
    keyed.length = keyName.length = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    put({ id: "floor", size: [44, 0.5, 32], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [44.6, 12, 0.5], pos: [0, -0.5, -16.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "wallR", size: [0.5, 12, 32], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3, pick: false });
    put({ id: "plinth", size: [27, TT - 0.14, 17], on: "floor", color: "base", cluster: "table", layer: 0, shadow: 0.2, pick: false });
    put({ id: "top", size: [27.6, 0.14, 17.6], on: "plinth", color: "top", layer: 0.4, pick: false });
    // On the table: a folded map with a pencil, a dish with two spare balls (drawn as points), a mug.
    put({ id: "map", size: [3.6, 0.05, 2.6], on: "top", pos: [-11.2, 0, 4.6], rot: [0, 0.25, 0], color: "map", layer: 1, shadow: 0.1, pick: false });
    put({ size: [1.7, 0.02, 2.5], on: "map", pos: [0.85, 0, 0], color: "map2", layer: 1.1, pick: false });
    put({ size: [3.2, 0.16, 0.16], on: "top", pos: [-10.6, 0, 6.3], rot: [0, -0.35, 0], color: "pen", layer: 1.2, shadow: 0.2, pick: false });
    put({ id: "dish", shape: "cyl", sides: 16, top: 1.25, size: [2.2, 0.3, 2.2], on: "top", pos: [11.3, 0, 5], color: "dish", layer: 1, shadow: 0.25, pick: false });
    put({ id: "mug", shape: "cyl", sides: 14, size: [1.4, 1.5, 1.4], on: "top", pos: [11.2, 0, -5.2], color: "cupMug", layer: 1, shadow: 0.25, pick: false });
    // The box: a base and four rims (each its own cluster, anchored on itself, so the near one draws
    // over the board and the far ones under it, from any side), two knobs.
    put({ id: "case", size: [BW * 2 + 2.6, CASE_H, BD * 2 + 2.6], on: "top", color: "case", cluster: "table", layer: 2, shadow: 0.3, pick: false });
    const rim = (id: string, x: number, z: number, w: number, d: number) => {
      dio.cluster(id, { at: [x, TT + CASE_H + 0.5, z] });
      return put({ id, size: [w, 1.05, d], on: "case", pos: [x, 0, z], color: "case2", cluster: id, layer: 0, pick: false });
    };
    const ox = BW + 0.95, oz = BD + 0.95;
    rim("rimB", 0, -oz, ox * 2 + 0.7, 0.7), rim("rimF", 0, oz, ox * 2 + 0.7, 0.7), rim("rimL", -ox, 0, 0.7, oz * 2 - 0.7), rim("rimR", ox, 0, 0.7, oz * 2 - 0.7);
    knobF = put({ id: "kF", shape: "cyl", sides: 12, size: [1.3, 0.5, 1.3], on: "rimF", pos: [0, -0.62, 0.35], rot: [Math.PI / 2, 0, 0], color: "knob", layer: 1, pick: false });
    put({ size: [0.22, 0.12, 1.2], on: "kF", color: "grip", layer: 1.1, pick: false });
    knobS = put({ id: "kS", shape: "cyl", sides: 12, size: [1.3, 0.5, 1.3], on: "rimL", pos: [-0.35, -0.62, 0], rot: [0, 0, Math.PI / 2], color: "knob", layer: 1, pick: false });
    put({ size: [0.22, 0.12, 1.2], on: "kS", color: "grip", layer: 1.1, pick: false });
    // The board on its gimbal: the slab, its frame, the walls; the holes, the line and the cup are
    // decals on it, the ball and its shadow points.
    dio.cluster("board", { at: [0, PIV, 0] });
    deck = put({ id: "deck", shape: "group", size: [BW * 2, 0, BD * 2], on: "case", pos: [0, 0.25, 0], cluster: "board", layer: 0, pick: false });
    put({ id: "slab", size: [BW * 2, SLAB, BD * 2], on: "deck", color: "slab", layer: 0, pick: false });
    const wall = (x0: number, z0: number, x1: number, z1: number, k: Key) => {
      // Long walls in pieces (about 2 units), so the ball sorts right against each.
      const w = x1 - x0, d = z1 - z0, n = Math.max(1, Math.round(Math.max(w, d) / 2.2)), along = w > d;
      for (let i = 0; i < n; i++) {
        const a = along ? x0 + (w * i) / n : x0, b = along ? z0 : z0 + (d * i) / n, pw = along ? w / n : w, pd = along ? d : d / n;
        put({ size: [pw, WH, pd], on: "slab", pos: [a + pw / 2, 0, b + pd / 2], color: k, layer: 5, pick: false });
      }
    };
    wall(-BW, -BD, BW, -HD, "rim"), wall(-BW, HD, BW, BD, "rim"), wall(-BW, -HD, -HW, HD, "rim"), wall(HW, -HD, BW, HD, "rim");
    for (const w of Lv.walls) wall(w[0]!, w[1]!, w[2]!, w[3]!, "wall");
    dio.decal("board", 1, drawBoard);
    shadP = dio.points({ cap: 1, cluster: "board", layer: 2, paint: paintShadow });
    ballP = dio.points({ cap: 1, cluster: "board", layer: 5, paint: paintBall });
    // The spare balls in the dish.
    const spare = dio.points({ cap: 2, cluster: "table", layer: 3, paint: paintBall });
    for (let i = 0; i < 2; i++) (spare.x[i] = 11.3 + (i ? 0.45 : -0.4)), (spare.y[i] = TT + 0.3 + BALL), (spare.z[i] = 5 + (i ? 0.3 : -0.1)), (spare.r[i] = BALL);
    spare.n = 2;
    dirty = true;
  }

  // ---- the board's drawing: the holes, the numbered line, the cup ----
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), W3 = new Float64Array(3);
  function ellipse(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, n = 18) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      proj(x + Math.cos(a) * r, 0.005, z + Math.sin(a) * r, tmp2);
      i ? ctx.lineTo(tmp2[0]!, tmp2[1]!) : ctx.moveTo(tmp2[0]!, tmp2[1]!);
    }
  }
  const font = (px: number, w = 800) => `${w} ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;
  const NUM: string[] = [];
  for (let i = 0; i < 40; i++) NUM.push("" + i);
  function drawBoard(ctx: CanvasRenderingContext2D) {
    const Lv = LEVELS[level]!, f = dio.focal();
    ctx.globalAlpha = deckA;
    // The line, under everything else on the slab.
    const Pp = Lv.path;
    ctx.beginPath();
    for (let i = 0; i < Pp.length; i++) proj(Pp[i]![0]!, 0.004, Pp[i]![1]!, tmp), i ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
    proj(0, 0, 0, tmp);
    const u = Math.max(1.2, (0.09 * f) / tmp[2]!);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = P.line;
    ctx.lineWidth = u;
    ctx.setLineDash(P.night ? DASH0 : DASH1);
    ctx.stroke();
    ctx.setLineDash(DASH0);
    // The holes: a rim, the dark, a darker throat toward the far side.
    for (let i = 0; i < Lv.holes.length; i++) {
      const H = Lv.holes[i]!;
      ellipse(ctx, H[0]!, H[1]!, HOLE + 0.07);
      ctx.fillStyle = P.holeRim;
      ctx.fill();
      ellipse(ctx, H[0]!, H[1]!, HOLE);
      ctx.fillStyle = P.hole;
      ctx.fill();
      ellipse(ctx, H[0]!, H[1]! - 0.12, HOLE * 0.72, 14);
      ctx.fillStyle = P.holeIn;
      ctx.fill();
    }
    // The cup at the end.
    const E = Pp[Pp.length - 1]!;
    ellipse(ctx, E[0]!, E[1]!, CUP + 0.14);
    ctx.fillStyle = P.cup;
    ctx.fill();
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ellipse(ctx, E[0]!, E[1]!, CUP - 0.06);
    ctx.fillStyle = P.cupIn;
    ctx.fill();
    // The numbers: a disc each, the ones passed filled.
    const px = Math.max(8, Math.min(13, (0.42 * f) / tmp[2]!));
    ctx.font = font(px);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i < Pp.length - 1; i++) {
      if (!proj(Pp[i]![0]!, 0.01, Pp[i]![1]!, tmp)) continue;
      const r = px * 0.78, on = i <= bd.far;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, r, 0, TAU);
      ctx.fillStyle = on ? P.done : P.dot;
      ctx.fill();
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = on ? "#1f2433" : P.night ? "#7ffcff" : "#3b2f3f";
      ctx.fillText(NUM[i]!, tmp[0]!, tmp[1]! + 0.5);
    }
    // START at the first point.
    const S = Pp[0]!;
    if (proj(S[0]!, 0.01, S[1]!, tmp)) {
      ctx.font = font(Math.max(8, px * 0.82));
      ctx.fillStyle = P.night ? "#7ffcff" : "#3b2f3f";
      ctx.fillText("START", tmp[0]!, tmp[1]! + px * 1.5);
    }
    ctx.globalAlpha = 1;
  }
  const DASH0: number[] = [], DASH1: number[] = [];
  function paintShadow(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    if (p.a[i]! <= 0) return;
    ctx.globalAlpha = p.a[i]! * deckA;
    ctx.fillStyle = P.shadow;
    ctx.beginPath();
    ctx.ellipse(p.sx[i]!, p.sy[i]!, p.sr[i]! * 1.05, p.sr[i]! * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  /** A steel ball: a dark body, a lit side, a bright highlight and a glint of the room on its rim. */
  function paintBall(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const a = p.a[i]!;
    if (a <= 0) return;
    const x = p.sx[i]!, y = p.sy[i]!, r = p.sr[i]!;
    ctx.globalAlpha = a * (p === ballP ? deckA : 1);
    ctx.fillStyle = "#1f2433";
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.ball;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.ball2;
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y - r * 0.2, r * 0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.glint;
    ctx.globalAlpha = a * 0.75;
    ctx.beginPath();
    ctx.arc(x + r * 0.2, y + r * 0.42, r * 0.38, 0.2, 2.6);
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.strokeStyle = P.glint;
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.fillStyle = P.spec;
    ctx.beginPath();
    ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.24, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- state and flow ----
  let hudDirty = true, dirty = true, toastT = 0, toastK = 0, toastS = "", said = "", knockT = 0, swapT = 0, backT = 0, lastFar = 0;
  const times = [0, 0, 0], best = [0, 0, 0];
  try {
    const s = localStorage.getItem("fizlet-tilt-maze");
    if (s) s.split(",").forEach((v, i) => i < 3 && (best[i] = +v || 0));
  } catch {
    /* no storage: bests last the visit */
  }
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const cue = (t: string) => engine.events.emit(t);
  function goto(l: number) {
    level = l;
    load(l, bd);
    phase = P_PLAY;
    lastFar = 0;
    deckY = 0;
    deckA = 1;
    buildScene();
    setView(true);
    toast(`BOARD ${l + 1} · ${LEVELS[l]!.name.toUpperCase()}`, 0);
    say(`Board ${l + 1} of ${LEVELS.length}: ${LEVELS[l]!.name}. ${LEVELS[l]!.path.length - 2} numbers to the cup.`);
    hudDirty = true;
    engine.wake();
  }
  function restart() {
    times.fill(0);
    card.hidden = true;
    goto(0);
  }
  function resetBall() {
    if (phase !== P_PLAY) return;
    load(level, bd);
    (lastFar = 0), (backT = 0.4);
    cue("reset");
    say("The ball is back on the start.");
    hudDirty = dirty = true;
    engine.wake();
  }
  function cleared() {
    const t = bd.t, b = best[level]!, nb = !b || t < b;
    times[level] = t;
    if (nb) best[level] = t;
    try {
      localStorage.setItem("fizlet-tilt-maze", best.join(","));
    } catch {
      /* no storage */
    }
    cue("cup");
    toast(nb && b ? `NEW BEST · ${t.toFixed(1)} S` : `IN THE CUP · ${t.toFixed(1)} S`, 1);
    say(`In the cup in ${t.toFixed(1)} seconds${nb && b ? ", a new best" : ""}, ${bd.falls} ${bd.falls === 1 ? "fall" : "falls"}.`);
    hudDirty = true;
  }
  function showEnd() {
    const tot = times[0]! + times[1]! + times[2]!;
    (card.children[1] as HTMLElement).textContent = `${times.map((t, i) => `${LEVELS[i]!.name} ${t.toFixed(1)} s`).join(" · ")}`;
    (card.children[2] as HTMLElement).textContent = `Total ${tot.toFixed(1)} s`;
    card.hidden = false;
    phase = P_DONE;
    cue("done");
    say(`Every board cleared in ${tot.toFixed(1)} seconds.`);
    hudDirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 };
  const portrait = () => dio.width / dio.height < 1.05;
  function setView(snap: boolean) {
    const port = portrait(), g = goal, W = dio.width, H = dio.height, hw = BW + 1.4, hh = BD + 1.4, y = PIV + SLAB;
    (g.yaw = (port ? -90 : -10) * D), (g.pitch = (port ? 60 : 52) * D), (g.tx = 0), (g.ty = y), (g.tz = 0), (g.fov = 0.6);
    const pts = [-hw, y, -hh, hw, y, -hh, -hw, TT + 0.2, hh, hw, TT + 0.2, hh, -hw, y + 1, -hh, hw, y + 1, -hh];
    dio.fit(g, pts, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    Object.assign(dio.cam, g);
    dirty = true;
    engine.wake();
  }

  // ---- input: the tilt the player asks for ----
  const want = new Float64Array(2), auto2 = new Float64Array(2);
  const held = new Uint8Array(4); // left, right, up, down
  let dragOn = false, dragX = 0, dragY = 0, dragNX = 0, dragNY = 0, devOn = false, devX = 0, devY = 0, beta0 = NaN;
  /** Screen direction (sx right, sy down; −1..1) to the board tilt, through the camera's yaw. */
  function screenTilt(sx: number, sy: number) {
    const y = dio.cam.yaw, cy = Math.cos(y), syw = Math.sin(y);
    // Screen right is (cos yaw, −sin yaw) on the board; screen down (toward you) is (sin yaw, cos yaw).
    want[0] = (sx * cy + sy * syw) * MAX_TILT;
    want[1] = (-sx * syw + sy * cy) * MAX_TILT;
  }
  function inputTilt() {
    let sx = 0, sy = 0;
    if (dragOn) {
      const reach = Math.max(60, Math.min(dio.width, dio.height) * 0.22);
      (sx = (dragNX - dragX) / reach), (sy = (dragNY - dragY) / reach);
    } else if (devOn) (sx = devX), (sy = devY);
    sx += held[1]! - held[0]!;
    sy += held[3]! - held[2]!;
    const m = Math.hypot(sx, sy);
    if (m > 1) (sx /= m), (sy /= m);
    screenTilt(sx, sy);
    return m > 0.02;
  }
  const ptrs = new Set<number>();
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture(e.pointerId);
    ptrs.add(e.pointerId);
    if (ptrs.size === 1) (dragOn = true), (dragX = dragNX = e.offsetX), (dragY = dragNY = e.offsetY), play.classList.add("tm-drag");
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId) || !dragOn) return;
    (dragNX = e.offsetX), (dragNY = e.offsetY);
    engine.wake();
  }, sig);
  const end = (e: PointerEvent) => {
    if (!ptrs.delete(e.pointerId)) return;
    if (!ptrs.size) (dragOn = false), play.classList.remove("tm-drag"), engine.wake();
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], WASD = ["a", "d", "w", "s"];
  const arrow = (e: KeyboardEvent) => {
    const i = ARROWS.indexOf(e.key);
    return i >= 0 ? i : WASD.indexOf(e.key.toLowerCase());
  };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase();
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "r") return void (e.preventDefault(), resetBall());
    const i = arrow(e);
    if (i >= 0 && (e.target as Element).closest?.(".gk-bar") === null) (e.preventDefault(), (held[i] = 1), engine.wake());
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const i = arrow(e);
    if (i >= 0) (held[i] = 0), engine.wake();
  }, sig);
  play.addEventListener("blur", () => (held.fill(0), engine.wake()), sig);
  // The phone's own tilt (after TILT; iOS asks first).
  const orient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (beta0 !== beta0) beta0 = e.beta;
    const ang = (screen.orientation && screen.orientation.angle) || 0, g = e.gamma / 22, b = (e.beta - beta0) / 22;
    // Turned sideways, the axes swap.
    (devX = ang === 90 ? b : ang === 270 || ang === -90 ? -b : g), (devY = ang === 90 ? -g : ang === 270 || ang === -90 ? g : b);
    engine.wake();
  };
  tiltK!.addEventListener("click", async () => {
    if (devOn) {
      devOn = false;
      removeEventListener("deviceorientation", orient);
      tiltK!.setAttribute("aria-pressed", "false");
      return void engine.wake();
    }
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      if (DOE.requestPermission && (await DOE.requestPermission()) !== "granted") return void say("Tilt was not allowed: drag the board instead.");
    } catch {
      return void say("Tilt was not allowed: drag the board instead.");
    }
    if (engine.signal.aborted) return;
    devOn = true;
    beta0 = NaN;
    addEventListener("deviceorientation", orient, sig);
    tiltK!.setAttribute("aria-pressed", "true");
    cue("tilt");
    say("Tilt the phone to tilt the board.");
  }, sig);
  again.addEventListener("click", () => (restart(), play.focus({ preventScroll: true })), sig);

  // ---- the frame ----
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!] as string;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = resetK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(true);
      }
      if (first && V[5]) first = null; // a first tap only wakes it: the board waits for a drag
    },
    step(e, dt) {
      let moving = false;
      if (phase === P_PLAY) {
        const asked = auto ? (pilot(bd, auto2), (want[0] = auto2[0]!), (want[1] = auto2[1]!), true) : inputTilt();
        if (!asked) (want[0] = 0), (want[1] = 0);
        // The knobs ease the board toward the tilt asked (spring-loaded: it levels off on its own).
        const k = Math.min(1, dt * (asked ? 9 : 4));
        tilt(bd, bd.tx + (want[0]! - bd.tx) * k, bd.tz + (want[1]! - bd.tz) * k);
        if (Math.abs(bd.tx) < 0.0005 && !asked) bd.tx = 0;
        if (Math.abs(bd.tz) < 0.0005 && !asked) bd.tz = 0;
        const fell = bd.state;
        const rolling = step(bd, dt);
        if (rolling || asked || bd.tx || bd.tz) moving = true;
        else bd.t -= dt; // the clock runs while the ball rolls
        if (bd.knock > 0) {
          if (bd.knock > 0.9 && knockT <= 0) cue(bd.knock > 3 ? "knock" : "knock2"), (knockT = 0.08);
          bd.knock = 0;
        }
        if (bd.far > lastFar) (lastFar = bd.far), cue("point"), (hudDirty = true);
        if (fell !== FALLING && bd.state === FALLING) cue("drop"), say(`Down hole ${bd.hole + 1}. Back to the start.`), (hudDirty = true), (auto = false);
        if (bd.state === FALLING && bd.fall >= FALL_T) respawn(bd), (lastFar = 0), (backT = 0.4), cue("back"), (hudDirty = true);
        if (bd.state === HOME) (phase = P_CLEAR), (T = 0), (auto = false), engine.busy(3), cleared();
      } else if (phase === P_CLEAR) {
        T += dt;
        // The board levels off; the ball sits in the cup.
        tilt(bd, bd.tx * (1 - Math.min(1, dt * 4)), bd.tz * (1 - Math.min(1, dt * 4)));
        if (T >= 1.9) {
          if (level + 1 < LEVELS.length) (phase = P_SWAP), (swapT = 0), cue("swap"), engine.busy(1.6);
          else showEnd();
        }
        moving = true;
      } else if (phase === P_SWAP) {
        const s0 = swapT;
        swapT += dt;
        // Lift out (0.5 s), the next board drops in and settles with a little bounce (0.8 s).
        if (s0 < 0.5 && swapT >= 0.5) (level = level + 1), load(level, bd), (lastFar = 0), (hudDirty = true), buildScene();
        if (swapT < 0.5) {
          const u = swapT / 0.5;
          (deckY = 7 * u * u), (deckA = 1 - u);
        } else {
          const u = Math.min(1, (swapT - 0.5) / 0.8), b = u < 0.6 ? 1 - (u / 0.6) ** 2 : -Math.sin(((u - 0.6) / 0.4) * Math.PI) * 0.08;
          (deckY = 6 * b), (deckA = Math.min(1, u * 2.5));
          if (u >= 1) {
            (deckY = 0), (deckA = 1), (phase = P_PLAY);
            toast(`BOARD ${level + 1} · ${LEVELS[level]!.name.toUpperCase()}`, 0);
            say(`Board ${level + 1} of ${LEVELS.length}: ${LEVELS[level]!.name}.`);
            hudDirty = true;
          }
        }
        moving = true;
      }
      if (RM) (dtx = bd.tx), (dtz = bd.tz);
      else (dtx += (bd.tx - dtx) * Math.min(1, dt * 18)), (dtz += (bd.tz - dtz) * Math.min(1, dt * 18));
      if (Math.abs(dtx - bd.tx) > 1e-5 || Math.abs(dtz - bd.tz) > 1e-5) moving = true;
      else (dtx = bd.tx), (dtz = bd.tz);
      if (knockT > 0) knockT -= dt;
      if (backT > 0) (backT = Math.max(0, backT - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (phase === P_PLAY && bd.t > 0 && moving) hudDirty = true;
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) {
        dirty = false;
        placeBall();
        dio.draw();
        V[5] = 1;
      }
    },
  });
  /** The board's matrix, the knobs, the ball and its shadow, from the model. */
  function placeBall() {
    matrix();
    if (deck) (deck.rot[0] = dtz), (deck.rot[2] = -dtx), (deck.pos[1] = 0.25 + deckY);
    if (knobF) knobF.rot[1] = dtx * 14;
    if (knobS) knobS.rot[1] = -dtz * 14;
    let y = BALL, r = BALL, a = 1;
    if (bd.state === FALLING) {
      const u = Math.min(1, bd.fall / FALL_T);
      (y = BALL - u * u * 1.6), (r = BALL * (1 - 0.35 * u)), (a = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45);
    } else if (backT > 0) {
      // Back on the start: it drops in from a little above.
      const u = 1 - backT / 0.4;
      (y = BALL + (1 - u) * (1 - u) * 2.2), (a = Math.min(1, u * 3));
    } else if (bd.state === HOME) (y = BALL - 0.22);
    world(bd.x, y, bd.z, W3);
    (ballP.x[0] = W3[0]!), (ballP.y[0] = W3[1]!), (ballP.z[0] = W3[2]!), (ballP.r[0] = r), (ballP.a[0] = a), (ballP.n = 1);
    // The shadow: on the slab, nudged away from the light, fainter as the ball rises.
    const lift = Math.max(0, y - BALL);
    world(bd.x + 0.18 + lift * 0.3, 0.01, bd.z - 0.12 - lift * 0.2, W3);
    (shadP.x[0] = W3[0]!), (shadP.y[0] = W3[1]!), (shadP.z[0] = W3[2]!), (shadP.r[0] = BALL * (1 + lift * 0.3)), (shadP.a[0] = bd.state === FALLING ? 0 : (P.night ? 0.5 : 0.28) * a / (1 + lift)), (shadP.n = 1);
  }

  // ---- overlay: the drag's joystick, the toast ----
  const WIDTHS = new Map<string, number>();
  const width = (ctx: CanvasRenderingContext2D, text: string, px: number) => {
    const k = text + px;
    let w = WIDTHS.get(k);
    if (w === undefined) WIDTHS.set(k, (w = ctx.measureText(text).width));
    return w;
  };
  function sticker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, bg: string, fg: string) {
    ctx.font = font(px);
    const w = width(ctx, text, px) + px, h = px + 10, lx = x - w / 2, ly = y - h / 2;
    ctx.fillStyle = "#1f2433";
    ctx.fillRect(lx + 2, ly + 2, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(lx, ly, w, h);
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = 2;
    ctx.strokeRect(lx, ly, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, ly + h / 2 + 0.5);
  }
  const TOAST = ["#fffaf1", "#ffd36b"], TOAST_T = 1.6;
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (dragOn && phase === P_PLAY) {
      const reach = Math.max(60, Math.min(dio.width, dio.height) * 0.22), dx = dragNX - dragX, dy = dragNY - dragY, m = Math.hypot(dx, dy), k = m > reach ? reach / m : 1;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1f2433";
      ctx.fillStyle = P.night ? "rgba(127,252,255,0.12)" : "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(dragX, dragY, reach * 0.42, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(dragX, dragY);
      ctx.lineTo(dragX + dx * k * 0.42, dragY + dy * k * 0.42);
      ctx.stroke();
      ctx.fillStyle = P.ring;
      ctx.beginPath();
      ctx.arc(dragX + dx * k * 0.42, dragY + dy * k * 0.42, 9, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (toastT > 0) {
      const u = 1 - toastT / TOAST_T, sc = u < 0.12 ? 0.6 + (u / 0.12) * 0.48 : u < 0.2 ? 1.08 - ((u - 0.12) / 0.08) * 0.08 : 1;
      const px = Math.round(Math.max(16, Math.min(26, dio.width / 30)));
      ctx.save();
      ctx.globalAlpha = u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1;
      ctx.translate(dio.width / 2, V[3]! + 22 + px / 2);
      ctx.scale(sc, sc);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, "#1f2433");
      ctx.restore();
    }
  }
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = RM ? 1 : TOAST_T);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the HUD ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  const secs = (t: number) => (t > 0 ? t.toFixed(1) : "—");
  function hudWrite() {
    const l = `Board ${level + 1}/${LEVELS.length}`;
    if (set(0, l)) lvlEl.textContent = l;
    const t = phase === P_SWAP ? "0.0" : bd.t.toFixed(1);
    if (set(1, t)) tNums[0]!.textContent = t;
    const b = secs(best[level]!);
    if (set(2, b)) tNums[1]!.textContent = b;
    const pt = `${Math.min(bd.far, LEVELS[level]!.path.length - 2)}/${LEVELS[level]!.path.length - 2}`;
    if (set(3, pt)) pNums[0]!.textContent = pt;
    if (set(4, bd.falls)) pNums[1]!.textContent = "" + bd.falls;
    const hint = phase !== P_PLAY ? "" : bd.t > 0 ? "" : coarse ? (canTilt ? "Drag to tilt the board, or press TILT and tilt the phone." : "Drag to tilt the board.") : "Drag to tilt the board, or hold the arrows. Follow the numbers to the cup.";
    if (set(5, hint)) hintEl.textContent = hint;
    if (set(6, said)) live.textContent = said;
    if (set(7, phase === P_PLAY)) resetK!.disabled = phase !== P_PLAY;
  }

  // The poster (scripts/gallery-posters.mjs): board 2, the ball a third of the way, the board leaning.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    goto(1);
    toastT = 0;
    auto = true;
    for (let i = 0; i < 60 * 9 && bd.far < 6; i++) pilot(bd, auto2), tilt(bd, auto2[0]!, auto2[1]!), step(bd, 1 / 60);
    auto = false;
    tilt(bd, MAX_TILT * 0.8, -MAX_TILT * 0.5);
    (dtx = bd.tx), (dtz = bd.tz), (lastFar = bd.far);
  }

  restart();
  engine.start();
  return {
    engine,
    accessible: true,
    get bd() {
      return bd;
    },
    get state() {
      return { level, phase, t: bd.t, falls: bd.falls, far: bd.far, ball: bd.state, card: !card.hidden, times: times.slice(), tiltOn: devOn, tx: bd.tx, tz: bd.tz };
    },
    dragFor(dx: number, dz: number) {
      // Invert screenTilt: the screen direction whose tilt is (dx, dz).
      const y = dio.cam.yaw, cy = Math.cos(y), syw = Math.sin(y), sx = dx * cy - dz * syw, sy = dx * syw + dz * cy;
      const reach = Math.max(60, Math.min(dio.width, dio.height) * 0.22), x0 = dio.width / 2, y0 = dio.height / 2;
      return [x0, y0, x0 + sx * reach * 1.2, y0 + sy * reach * 1.2];
    },
    goto,
    autopilot(on: boolean) {
      auto = on;
      engine.wake();
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: board 2, the ball partway round, the board leaning (scripts/gallery-posters.mjs). */
export const posterAt = 0.6;
