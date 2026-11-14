// "Darts": a dartboard in its cabinet on the wall of the games room (Shuffle Shot's room, next door),
// 501 down to zero against a bot, double out. Press to steady the reticle (it sways, and settles the
// longer you hold still), drag to aim, flick up to throw: the flick's speed is the power (soft lands
// low, hard lands high) and a crooked flick pulls the dart sideways. Or the arrow keys aim and Space
// throws. Real board scoring (singles, doubles, trebles, 25 and the bull), busts, a dart on a wire
// bounces out, the cabinet's doors keep the chalk score, and a checkout hint shows the way home.
// Light: a bright afternoon; dark: a neon night under the board's lamp.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/diorama
// (the 3D), @fzlt/core/slot, @fzlt/core/sound. The game is ./model.ts, pure and seeded
// (tests/darts.test.mjs); the room and the stage's parts are ../bar/room.ts (the bar-games series);
// this file is the scene and the controls (tests/darts.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { beats, camTween, effects, font, isLight, kit, looks, outlined, shell, type Look } from "../bar/room";
import { AIM, DARTS, IDEAL, OVER, R_BULL, R_D0, R_D1, R_FACE, R_IN, R_T0, R_T1, ORDER, REACH, START, STEPS, VISIT, bedName, botAim, checkout, endVisit, newGame, resetGame, throwDart, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180, MM = 1 / 150; // a world unit is 15 cm
const [LIGHT, DARK] = looks(
  { cab: "#b9805a", cab2: "#9a6646", slate: "#33413d", chalk: "#f4f1e6", face: "#1d1d24", cream: "#f3e6c8", red: "#e2483d", green: "#2f9e62", wire: "#c9ced8", lamp: "#2f3550", shadeIn: "#fff3c8", shadeC: "#2f9e62", oche: "#c9a24a", seat: "#e9b16a", leg2: "#6f86a9" },
  { cab: "#6b4a3a", cab2: "#55392d", slate: "#1f2a28", chalk: "#e8e4d6", cream: "#e4d5b3", red: "#d23c35", green: "#278a55", lamp: "#151a2e", shadeC: "#27774c", oche: "#9a7c3a", seat: "#7a5a3f", leg2: "#2c2f4f" },
);
/** The room: 46 × 30, the back wall at z = −15. The board's bull, its face plane and the oche. */
const WALL = -15, BXc = -1.2, BYc = 11.5, ZF = WALL + 0.62, OCHE = WALL + 2370 * MM;
/** Where a dart leaves the hand (in front of the camera, low and to the right). */
const HX = 1.6, HY = 9.2, HZ = OCHE - 3.2;
const T_UP = 1, T_BOTGO = 2, T_LANDED = 3, T_VISIT = 4, T_PULL = 5, T_NEXT = 6, T_END = 7, T_POSTER = 8;
const VIEWS = ["OCHE", "BOARD"];
/** Dart rigs: 0..2 yours, 3..5 the bot's. */
const RIGS = 6;

export type DartsScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { phase: number; turn: number; dart: number; you: number; bot: number; ready: boolean; flying: boolean; card: boolean; view: string; aimX: number; aimY: number };
  /** The screen point (CSS px, from the stage's top left) of board point (x, y) mm, as of now. */
  screen(x: number, y: number): [number, number];
  /** The board point (mm) under the screen point (sx, sy). */
  board(sx: number, sy: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): DartsScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Look = isLight() ? LIGHT : DARK;

  const ui = shell(engine, stage, "Darts: press and hold to steady the reticle, drag to aim, flick up to throw; or the arrow keys aim and Space throws (V view, M mutes)",
    `<b class="br-chip br-turn">Your throw</b><b class="br-chip br-n"><i class="br-dot"></i>You <span>501</span><i class="br-dot br-foe"></i>Bot <span>501</span></b><b class="br-chip br-r">Darts <span class="br-pips">●●●</span></b>`);
  const { canvas, play, head, top, hint, card, again } = ui;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const snd = sound(engine, {
    cues: { throw: "whoosh", thunk: "thunk", wire: "tink", score: "power", bust: "hurt", big: "win", win: "win", lose: "end", pull: "click" },
    notes: {
      whoosh: [[900, 300, 0.12, 0, "sawtooth", 0.02], [500, 200, 0.14, 0, "triangle", 0.05]],
      thunk: [[260, 90, 0.07, 0, "triangle", 0.25], [1400, 700, 0.02, 0, "square", 0.05]],
      tink: [[2600, 2400, 0.08, 0, "triangle", 0.12], [3300, 3000, 0.06, 0.03, "triangle", 0.08], [180, 60, 0.1, 0.18, "triangle", 0.15]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_VIEW = 1;
  const [muteK, viewK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "VIEW · OCHE", aria: "Camera view (V)", id: K_VIEW },
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
  let g: Game = newGame(1), seed = 1, botRnd = seeded(1), fxRnd = seeded(1);
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.c.bg!, overlay: drawOverlay, get shadowColor() { return P.c.shadow!; } });
  const K = kit(dio, () => P);
  const put = K.put;
  const rigs: DioramaObject[] = [], AT = new Float64Array(RIGS * 3);
  // The neon sign over the left door (a tall stage frames the board alone: no sign).
  const SIGN = { text: "DARTS", glyph: "◎", x: BXc - 3.75, y: BYc + 3.55, size: 0.82 };
  let fx: ReturnType<typeof effects>;

  function buildScene() {
    K.clear();
    rigs.length = 0;
    K.room({ w: 46, d: 30, h: 26, rug: [0, 3, 22, 14], plant: [18.5, -11.8], sign: SIGN });
    // The cabinet: its back, the rims, the doors open flat against the wall with a slate on each.
    dio.cluster("cab", { fixed: 1 });
    const cw = 4.6, chh = 4.6, cz = WALL + 0.2;
    put({ id: "cabB", size: [cw, chh, 0.4], pos: [BXc, BYc - chh / 2, cz], color: "cab", cluster: "cab", layer: 0 });
    put({ size: [cw + 0.24, 0.24, 0.62], pos: [BXc, BYc + chh / 2 - 0.12, cz + 0.11], color: "cab2", cluster: "cab", layer: 0.4 });
    put({ size: [cw + 0.24, 0.24, 0.62], pos: [BXc, BYc - chh / 2 - 0.12, cz + 0.11], color: "cab2", cluster: "cab", layer: 0.4 });
    put({ size: [0.24, chh, 0.62], pos: [BXc - cw / 2, BYc - chh / 2, cz + 0.11], color: "cab2", cluster: "cab", layer: 0.4 });
    put({ size: [0.24, chh, 0.62], pos: [BXc + cw / 2, BYc - chh / 2, cz + 0.11], color: "cab2", cluster: "cab", layer: 0.4 });
    for (let s = 0; s < 2; s++) {
      const x = BXc + (s ? 1 : -1) * (cw / 2 + 0.2 + cw / 4);
      put({ size: [cw / 2, chh, 0.16], pos: [x, BYc - chh / 2, WALL + 0.08], color: "cab", cluster: "cab", layer: 0.2 });
      put({ size: [cw / 2 - 0.4, chh - 0.5, 0.04], pos: [x, BYc - chh / 2 + 0.25, WALL + 0.18], color: "slate", cluster: "cab", layer: 0.3 });
      // A chalk ledge under each slate, a stick of chalk on it.
      put({ size: [cw / 2 - 0.2, 0.12, 0.42], pos: [x, BYc - chh / 2 - 0.12, WALL + 0.21], color: "cab2", cluster: "cab", layer: 0.45 });
      put({ size: [0.42, 0.09, 0.09], pos: [x + (s ? -0.5 : 0.4), BYc - chh / 2, WALL + 0.3], rot: [0, s ? 0.4 : -0.3, 0], color: "chalk", cluster: "cab", layer: 0.46 });
    }
    dio.decal("cab", 0.35, chalk);
    // The board: its black face (a drum turned to the room), the art, the number ring.
    dio.cluster("board", { fixed: 2 });
    put({ id: "board", shape: "cyl", sides: 32, size: [2 * R_FACE * MM, ZF - cz - 0.2, 2 * R_FACE * MM], pos: [BXc, BYc, cz + 0.2], rot: [Math.PI / 2, 0, 0], color: "face", cluster: "board", layer: 0 });
    dio.decal("board", 1, boardArt);
    // The lamp: an arm off the wall above the cabinet and its shade.
    put({ size: [0.34, 0.34, 0.14], pos: [BXc, BYc + chh / 2 + 1.8, WALL + 0.07], color: "lamp", cluster: "cab", layer: 0.5 });
    put({ size: [0.14, 0.14, 2.2], pos: [BXc, BYc + chh / 2 + 1.9, WALL + 1.2], color: "lamp", cluster: "cab", layer: 0.5 });
    put({ size: [0.1, 0.5, 0.1], pos: [BXc, BYc + chh / 2 + 1.5, WALL + 2.25], color: "lamp", cluster: "cab", layer: 0.55 });
    put({ id: "bulb", shape: "cyl", sides: 10, size: [0.5, 0.28, 0.5], pos: [BXc, BYc + chh / 2 + 1.0, WALL + 2.25], color: "shadeIn", emissive: true, cluster: "cab", layer: 0.58 });
    put({ id: "shade", shape: "cyl", sides: 16, top: 0.3, size: [1.7, 0.75, 1.7], pos: [BXc, BYc + chh / 2 + 0.85, WALL + 2.25], color: "shadeC", cluster: "cab", layer: 0.6 });
    dio.decal("room", 0.6, lampGlow);
    // The oche on the floor, and a stool by the wall.
    put({ size: [7, 0.06, 0.3], on: "floor", pos: [BXc, 0, OCHE], color: "oche", layer: 0.3 });
    put({ id: "stool", shape: "cyl", sides: 14, size: [2.1, 0.3, 2.1], pos: [12.5, 4.6, -8.5], color: "seat", cluster: "stool", layer: 1, shadow: 0.25 });
    for (let i = 0; i < 4; i++) put({ size: [0.16, 4.6, 0.16], pos: [12.5 + (i & 1 ? 0.7 : -0.7), 0, -8.5 + (i & 2 ? 0.7 : -0.7)], color: "leg2", cluster: "stool", layer: 0.5 });
    put({ size: [1.7, 0.1, 0.1], pos: [12.5, 1.6, -7.8], color: "leg2", cluster: "stool", layer: 0.6 });
    // The darts: a needle, the barrel, the shaft and two flights; each its own cluster (its depth).
    for (let i = 0; i < RIGS; i++) {
      const cl = "d" + i, id = cl + "p";
      dio.cluster(cl, { at: AT.subarray(i * 3, i * 3 + 3) });
      rigs.push(put({ id, shape: "cyl", sides: 6, top: 0.3, size: [0.04, 0.26, 0.04], pos: [0, -50, 0], color: "steel", cluster: cl, layer: 1, alpha: 0, tag: { dart: i } }));
      put({ id: id + "b", shape: "cyl", sides: 8, size: [0.1, 0.42, 0.1], on: id, color: "steel", layer: 2 });
      put({ id: id + "s", shape: "cyl", sides: 6, top: 0.8, size: [0.06, 0.36, 0.06], on: id + "b", color: "ink", layer: 3 });
      put({ size: [0.36, 0.34, 0.012], on: id + "s", pos: [0, -0.06, 0], color: i < 3 ? "you" : "bot", layer: 4 });
      put({ size: [0.012, 0.34, 0.36], on: id + "s", pos: [0, -0.06, 0], color: i < 3 ? "you" : "bot", layer: 4 });
    }
    fx = effects(dio, 120, 0.02);
  }

  // ---- the board's art: painted once per theme on its own canvas, drawn in the face's plane ----
  const ART = 640, PXMM = ART / (2 * R_FACE), art = document.createElement("canvas");
  art.width = art.height = ART;
  let artFor: Look | null = null;
  function paintArt() {
    artFor = P;
    const c = art.getContext("2d")!, o = ART / 2, cl = P.c;
    c.clearRect(0, 0, ART, ART);
    const ring = (r0: number, r1: number, a0: number, a1: number, col: string) => {
      c.beginPath();
      c.arc(o, o, r1 * PXMM, a0, a1);
      c.arc(o, o, r0 * PXMM, a1, a0, true);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    };
    c.fillStyle = cl.face!;
    c.beginPath();
    c.arc(o, o, R_FACE * PXMM, 0, TAU);
    c.fill();
    for (let k = 0; k < 20; k++) {
      // Canvas angles run clockwise from +x; the bed k is centred 18°·k clockwise from the top.
      const a0 = (-90 - 9 + 18 * k) * D, a1 = a0 + 18 * D, even = (k & 1) === 0;
      ring(R_BULL, R_T0, a0, a1, even ? cl.face! : cl.cream!);
      ring(R_T0, R_T1, a0, a1, even ? cl.red! : cl.green!);
      ring(R_T1, R_D0, a0, a1, even ? cl.face! : cl.cream!);
      ring(R_D0, R_D1, a0, a1, even ? cl.red! : cl.green!);
    }
    ring(R_IN, R_BULL, 0, TAU, cl.green!);
    ring(0, R_IN, 0, TAU, cl.red!);
    // The wires: the rings and the radial spider.
    c.strokeStyle = cl.wire!;
    c.lineWidth = 1.4;
    for (const r of [R_IN, R_BULL, R_T0, R_T1, R_D0, R_D1]) c.beginPath(), c.arc(o, o, r * PXMM, 0, TAU), c.stroke();
    for (let k = 0; k < 20; k++) {
      const a = (-90 - 9 + 18 * k) * D;
      c.beginPath();
      c.moveTo(o + Math.cos(a) * R_BULL * PXMM, o + Math.sin(a) * R_BULL * PXMM);
      c.lineTo(o + Math.cos(a) * R_D1 * PXMM, o + Math.sin(a) * R_D1 * PXMM);
      c.stroke();
    }
    // The numbers round the outside.
    c.fillStyle = "#f6f2e8";
    c.font = font(34, 800);
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let k = 0; k < 20; k++) {
      const a = (-90 + 18 * k) * D, r = ((R_D1 + R_FACE) / 2 + 3) * PXMM;
      c.save();
      c.translate(o + Math.cos(a) * r, o + Math.sin(a) * r);
      c.rotate(a + Math.PI / 2 + (Math.sin(a) > 0.2 ? Math.PI : 0));
      c.fillText("" + ORDER[k], 0, 0);
      c.restore();
    }
    // A bold rim round the face.
    c.strokeStyle = "#0b0b10";
    c.lineWidth = 6;
    c.beginPath();
    c.arc(o, o, R_FACE * PXMM - 3, 0, TAU);
    c.stroke();
  }
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), AF = new Float64Array(6);
  /** AF = the affine map from board mm (x right, y up) to screen CSS px about the bull: e, f, a, b, c, d. */
  function boardAffine() {
    dio.project(BXc, BYc, ZF, tmp);
    AF[0] = tmp[0]!; AF[1] = tmp[1]!;
    dio.project(BXc + 100 * MM, BYc, ZF, tmp2);
    AF[2] = (tmp2[0]! - AF[0]!) / 100; AF[3] = (tmp2[1]! - AF[1]!) / 100;
    dio.project(BXc, BYc + 100 * MM, ZF, tmp2);
    AF[4] = (tmp2[0]! - AF[0]!) / 100; AF[5] = (tmp2[1]! - AF[1]!) / 100;
  }
  function boardArt(ctx: CanvasRenderingContext2D) {
    if (artFor !== P) paintArt();
    boardAffine();
    const r = dio.dpr, s = 1 / PXMM;
    // Image px (i, j) → mm (i/PX − R, R − j/PX) → screen.
    ctx.setTransform(r * AF[2]! * s, r * AF[3]! * s, -r * AF[4]! * s, -r * AF[5]! * s, r * (AF[0]! - R_FACE * AF[2]! + R_FACE * AF[4]!), r * (AF[1]! - R_FACE * AF[3]! + R_FACE * AF[5]!));
    ctx.drawImage(art, 0, 0);
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  /** Screen (sx, sy) CSS px → board mm into out (the affine's inverse, then two Newton steps on the true projection). */
  function toBoard(sx: number, sy: number, out: Float64Array) {
    boardAffine();
    const a = AF[2]!, b = AF[3]!, c = AF[4]!, d = AF[5]!, det = a * d - b * c;
    let x = (d * (sx - AF[0]!) - c * (sy - AF[1]!)) / det, y = (a * (sy - AF[1]!) - b * (sx - AF[0]!)) / det;
    for (let it = 0; it < 2; it++) {
      dio.project(BXc + x * MM, BYc + y * MM, ZF, tmp);
      const ex = sx - tmp[0]!, ey = sy - tmp[1]!;
      x += (d * ex - c * ey) / det;
      y += (a * ey - b * ex) / det;
    }
    out[0] = x;
    out[1] = y;
    return out;
  }
  const VALS = new Int16Array(9);
  function chalk(ctx: CanvasRenderingContext2D) {
    // Each door's slate: YOU and BOT, what was left after each visit (old ones struck), the last big.
    const cw = 4.6, chh = 4.6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let s = 0; s < 2; s++) {
      const x = BXc + (s ? 1 : -1) * (cw / 2 + 0.2 + cw / 4), z = WALL + 0.21, yTop = BYc + chh / 2 - 0.55;
      ctx.fillStyle = P.c.chalk!;
      ctx.globalAlpha = 0.95;
      ctx.font = font(100, 800);
      K.text(ctx, s ? "BOT" : "YOU", x, yTop, z, 0.5, 0, 0, 0, -0.5, 0);
      ctx.globalAlpha = 0.7;
      K.wquad(ctx, x - 0.8, yTop - 0.34, x + 0.8, yTop - 0.37, z), ctx.fill();
      // Back from the score now (as of the visit's start) through the logged visits (a bust adds nothing).
      const n = Math.min(8, g.visits[s]!);
      VALS[0] = g.turn === s && g.phase !== OVER ? g.from[s]! : g.rem[s]!;
      for (let k = 0; k < n; k++) VALS[k + 1] = VALS[k]! + Math.max(0, g.log[s * 8 + 7 - k]!);
      const rows = Math.min(5, n + 1);
      for (let r = 0; r < rows; r++) {
        const back = rows - 1 - r, y = yTop - 0.75 - r * 0.66, last = back === 0, sz = last ? 0.5 : 0.36;
        ctx.globalAlpha = last ? 1 : 0.55;
        ctx.font = font(100, last ? 900 : 700);
        K.text(ctx, "" + VALS[back], x, y, z, sz, 0, 0, 0, -sz, 0);
        if (!last) (ctx.globalAlpha = 0.5), K.wquad(ctx, x - 0.5, y + 0.02, x + 0.5, y - 0.02, z), ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function lampGlow(ctx: CanvasRenderingContext2D) {
    // The lamp's warm pool on the wall at night: soft rings, brightest under the shade.
    if (!P.night) return;
    ctx.fillStyle = P.c.glow!;
    for (let k = 0; k < 6; k++) {
      const rx = 7.2 - k * 1.05, ry = 5.4 - k * 0.8, cy = BYc + 2.2 - k * 0.12;
      ctx.globalAlpha = 0.045;
      ctx.beginPath();
      for (let q = 0; q <= 28; q++) {
        const a = (q / 28) * TAU;
        dio.project(BXc + Math.cos(a) * rx, cy + Math.sin(a) * ry, WALL + 0.02, tmp);
        q ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- state ----
  const B = beats(engine);
  // Per rig: shown, where its tip is (world), its direction (tail), and the motion it is in:
  // 0 still, 1 flying to the board, 2 bouncing out (falling), 3 pulled (flying home).
  const RX = new Float64Array(RIGS), RY = new Float64Array(RIGS), RZ = new Float64Array(RIGS);
  const RA = new Float64Array(RIGS), RYW = new Float64Array(RIGS), MO = new Uint8Array(RIGS), M0 = new Float64Array(RIGS), MD = new Float64Array(RIGS);
  const F0 = new Float64Array(RIGS * 3), F1 = new Float64Array(RIGS * 3), FV = new Float64Array(RIGS * 3);
  const pops = new Float64Array(RIGS); // when a dart's bed pops up (0: none)
  const popTx: string[] = new Array(RIGS).fill("");
  let view = 0, ready = false, dragging = false, flying = false, dirty = true, hudDirty = true, kbd = 0;
  // The aim (mm), the sway's size (mm) and phase, its clock; the bot's aim on its way.
  let aimX = 0, aimY = 103, sway = 0, swayT = 0, holdT = 0, botFromX = 0, botFromY = 0, botT = 0;
  const botShot = new Float64Array(4), CO = new Int16Array(3), PT = new Float64Array(2);
  let toastT = 0, toastS = "", toastC = "", toastBig = false;
  // Pointer samples: time, x, y (a ring of 8), for the flick.
  const PS = new Float64Array(24);
  let psN = 0, lastX = 0, lastY = 0, ox = 0, oy = 0;
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset.
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** The reticle's sway now (mm) into PT: a slow figure-of-eight scaled by how unsteady you are. */
  function swayAt(t: number, out: Float64Array) {
    const a = sway;
    out[0] = a * (0.72 * Math.sin(1.13 * t + 0.6) + 0.28 * Math.sin(2.71 * t));
    out[1] = a * (0.7 * Math.sin(1.57 * t) + 0.3 * Math.sin(3.07 * t + 1.1));
    return out;
  }
  function reset(s: number) {
    seed = s >>> 0;
    resetGame(g, seed);
    botRnd = seeded(seed * 31 + 7);
    fxRnd = seeded(seed * 17 + 3);
    B.clear();
    pops.fill(0), MO.fill(0);
    ready = dragging = flying = false;
    toastT = 0;
    aimX = 0, aimY = 103, sway = 0;
    buildScene();
    for (let i = 0; i < RIGS; i++) rigs[i]!.alpha = 0;
    card.hidden = true;
    up();
  }
  /** A dart is up: yours waits for you; the bot lines up, then throws. */
  function up() {
    if (g.phase !== AIM) return;
    ready = false;
    B.later(RM ? 0.05 : 0.35, T_UP);
    hudDirty = dirty = true;
  }
  function setReady() {
    ready = true;
    if (g.turn === 1) {
      botAim(g, botRnd, botShot);
      (botFromX = aimX), (botFromY = aimY), (botT = engine.time);
      sway = 9;
      B.later(RM ? 0.05 : 1.0, T_BOTGO);
    }
    hudDirty = dirty = true;
  }
  const rigOf = () => g.turn * 3 + g.dart;
  /** Throw at the reticle (mm, with its sway), at this level and crook. */
  function fire(ax: number, ay: number, level: number, crook: number) {
    if (!ready || g.phase !== AIM) return false;
    const i = rigOf(), k = g.dart;
    const tx = Math.round(Math.max(-REACH, Math.min(REACH, ax)) * 10), ty = Math.round(Math.max(-REACH, Math.min(REACH, ay)) * 10);
    if (!throwDart(g, tx, ty, Math.max(0, Math.min(STEPS, level)), crook)) return false;
    ready = false;
    dragging = false;
    // The flight: from the hand to where it lands, in an arc.
    const lx = BXc + g.dx[k]! * MM, ly = BYc + g.dy[k]! * MM;
    F0[i * 3] = HX + (g.turn ? -3.2 : 0); F0[i * 3 + 1] = HY; F0[i * 3 + 2] = HZ;
    F1[i * 3] = lx; F1[i * 3 + 1] = ly; F1[i * 3 + 2] = ZF - 0.05;
    MO[i] = 1;
    M0[i] = engine.time;
    MD[i] = RM ? 0.001 : 0.34;
    rigs[i]!.alpha = 1;
    flying = true;
    engine.events.emit("throw");
    B.later(MD[i]! + 0.01, T_LANDED);
    hudDirty = dirty = true;
    engine.wake();
    return true;
  }
  /** The dart hit the board (or a wire, or the wall). */
  function landed() {
    flying = false;
    const k = g.dart - 1, i = g.turn * 3 + k;
    MO[i] = 0;
    RX[i] = F1[i * 3]!; RY[i] = F1[i * 3 + 1]!; RZ[i] = F1[i * 3 + 2]!;
    // Stuck: tail a little up and to the side, as darts sit.
    RA[i] = (10 + fxRnd() * 12) * D;
    RYW[i] = (fxRnd() - 0.5) * 16 * D;
    const bed = g.bed[k]!, pts = g.pts[k]!;
    if (g.out[k]) {
      // Off the wire: it springs back and drops to the floor.
      MO[i] = 2;
      M0[i] = engine.time;
      FV[i * 3] = (fxRnd() - 0.5) * 1.2; FV[i * 3 + 1] = 1.2; FV[i * 3 + 2] = 2.4;
      popTx[i] = "BOUNCE OUT";
      engine.events.emit("wire");
      for (let n = 0; n < 6; n++) fx.spawn(1, RX[i]!, RY[i]!, RZ[i]! + 0.1, (fxRnd() - 0.5) * 2, fxRnd() * 2, 1 + fxRnd(), 0.3, 0.035, "#ffffff");
    } else {
      popTx[i] = (bed & 3) === 0 ? "MISS" : bedName(bed) === "BULL" || bedName(bed) === "25" ? bedName(bed) : (bed & 3) === 1 ? "" + pts : bedName(bed);
      engine.events.emit("thunk");
      for (let n = 0; n < 7; n++) fx.spawn(2, RX[i]!, RY[i]!, ZF + 0.05, (fxRnd() - 0.5) * 0.8, (fxRnd() - 0.2) * 0.8, 0.4 + fxRnd() * 0.6, 0.45, 0.045, P.c.cream!);
    }
    pops[i] = engine.time;
    if (g.phase === AIM) up();
    else B.later(RM ? 0.1 : 0.75, T_VISIT);
    hudDirty = dirty = true;
  }
  /** The visit is done: say the score (or the bust), then pull the darts. */
  function visitDone() {
    const s = g.turn, sc = g.from[s]! - g.rem[s]!;
    if (g.winner >= 0) (toastS = "GAME SHOT!"), (toastC = s ? P.c.bot! : P.c.you!), (toastBig = true), engine.events.emit("big");
    else if (g.bust) (toastS = "BUST"), (toastC = "#ff5d5d"), (toastBig = false), engine.events.emit("bust");
    else (toastS = sc === 180 ? "180!" : (s ? "BOT " : "YOU ") + sc), (toastC = s ? P.c.bot! : P.c.you!), (toastBig = sc >= 100), engine.events.emit(sc >= 100 ? "big" : "score");
    if (toastBig && !RM) for (let n = 0; n < 40; n++) fx.spawn(3, BXc + (fxRnd() - 0.5) * 4, BYc + 2 + fxRnd(), ZF + 1 + fxRnd() * 2, (fxRnd() - 0.5) * 3, 1 + fxRnd() * 2, (fxRnd() - 0.5) * 2, 1.6 + fxRnd(), 0.07, fxRnd() < 0.5 ? P.c.you! : fxRnd() < 0.5 ? P.c.neon2! : "#ffd23f");
    toastT = 1.8;
    ui.say(g.winner >= 0 ? (s ? "The bot checks out" : "Game shot! You check out") : g.bust ? (s ? "The bot busts" : "Bust") : `${s ? "Bot" : "You"} scored ${sc}, ${g.rem[s]} left`);
    B.later(RM ? 0.1 : 1.3, g.winner >= 0 ? T_END : T_PULL);
    hudDirty = dirty = true;
  }
  /** Pull the visit's darts out of the board (they fly home), then the next visit. */
  function pull() {
    const s = g.turn;
    for (let k = 0; k < DARTS; k++) {
      const i = s * 3 + k;
      if (!rigs[i]!.alpha) continue;
      F0[i * 3] = RX[i]!; F0[i * 3 + 1] = RY[i]!; F0[i * 3 + 2] = RZ[i]!;
      F1[i * 3] = HX + (s ? -3.2 : 0) + (k - 1) * 0.4; F1[i * 3 + 1] = HY - 1; F1[i * 3 + 2] = HZ;
      MO[i] = 3;
      M0[i] = engine.time + k * 0.08;
      MD[i] = RM ? 0.001 : 0.45;
    }
    pops.fill(0);
    engine.events.emit("pull");
    B.later(RM ? 0.05 : 0.7, T_NEXT);
    hudDirty = dirty = true;
  }
  function nextVisit() {
    for (let k = 0; k < DARTS; k++) (rigs[g.turn * 3 + k]!.alpha = 0), (MO[g.turn * 3 + k] = 0);
    endVisit(g);
    if (g.phase === AIM) up();
  }
  function showEnd() {
    endVisit(g);
    const won = g.winner === 0;
    ui.end(won ? "Game shot! You win" : "The bot wins", `${g.thrown[g.winner]} darts to check out · ${won ? "bot" : "you"} on ${g.rem[1 - g.winner]}`);
    hudDirty = dirty = true;
    engine.events.emit(won ? "win" : "lose");
    ui.say(won ? `You win in ${g.thrown[0]} darts` : `The bot wins; you had ${g.rem[0]} left`);
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const cam = camTween(dio);
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.2;
  const FR = new Float64Array(18);
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const c = cam.goal, W = dio.width, H = dio.height, close = view === 1, tall = portrait();
    c.fov = 0.42;
    SIGN.size = tall ? 0 : 0.82;
    c.yaw = close ? -6 * D : tall ? -10 * D : -20 * D;
    c.pitch = close ? 3 * D : 9 * D;
    c.tx = BXc;
    c.ty = BYc;
    c.tz = ZF;
    // Frame the board (close), else the cabinet with its doors, the sign and the lamp over it.
    const ex = close ? 1.65 : tall ? 2.7 : 5.3, ey0 = close ? 1.65 : tall ? 2.7 : 3.0, ey1 = close ? 1.65 : tall ? 3.2 : 4.3;
    FR[0] = BXc - ex; FR[1] = BYc + ey1; FR[2] = ZF;
    FR[3] = BXc + ex; FR[4] = BYc + ey1; FR[5] = ZF;
    FR[6] = BXc - ex; FR[7] = BYc - ey0; FR[8] = ZF;
    FR[9] = BXc + ex; FR[10] = BYc - ey0; FR[11] = ZF;
    FR[12] = FR[15] = BXc; FR[13] = FR[16] = BYc; FR[14] = FR[17] = ZF;
    dio.fit(c, FR, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    cam.go(snap || RM);
    hudDirty = dirty = true;
    engine.wake();
  }
  const cycleView = () => setView((view + 1) % 2, false);

  // ---- the overlay: the reticle, the beds popping, the toast ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const me = g.turn === 0;
    if (g.phase === AIM && ready && card.hidden) {
      let x = aimX, y = aimY;
      if (!me) {
        const u = Math.min(1, (engine.time - botT) / 0.8), e = u * u * (3 - 2 * u);
        PT[0] = botShot[0]! / 10;
        PT[1] = botShot[1]! / 10;
        x = botFromX + (PT[0]! - botFromX) * e;
        y = botFromY + (PT[1]! - botFromY) * e;
      }
      swayAt(swayT, PT);
      x += PT[0]!;
      y += PT[1]!;
      boardAffine();
      dio.project(BXc + x * MM, BYc + y * MM, ZF, tmp);
      const sx = tmp[0]!, sy = tmp[1]!, rr = Math.max(9, 12 * Math.hypot(AF[2]!, AF[3]!)), col = me ? P.c.you! : P.c.bot!;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, TAU);
      ctx.stroke();
      for (let q = 0; q < 4; q++) {
        const dx = q === 0 ? 1 : q === 1 ? -1 : 0, dy = q === 2 ? 1 : q === 3 ? -1 : 0;
        ctx.strokeStyle = "#1f2433";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx + dx * (rr + 3), sy + dy * (rr + 3));
        ctx.lineTo(sx + dx * (rr + 10), sy + dy * (rr + 10));
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, TAU);
      ctx.fill();
    }
    // Each dart's bed rises off it.
    for (let i = 0; i < RIGS; i++) {
      const t0 = pops[i]!;
      if (!t0 || engine.time < t0) continue;
      const age = engine.time - t0, u = Math.min(1, age / 0.45);
      if (age > 1.6) continue;
      dio.project(RX[i]!, RY[i]!, ZF, tmp);
      const s = popTx[i]!;
      ctx.globalAlpha = Math.min(1, (1.6 - age) * 4);
      outlined(ctx, s, tmp[0]!, tmp[1]! - 16 - 18 * u, s.length > 4 ? 15 : 19, i < 3 ? P.c.you! : P.c.bot!);
      ctx.globalAlpha = 1;
    }
    if (toastT > 0) {
      const a = Math.min(1, toastT * 3), y = V[3]! + 30;
      ctx.globalAlpha = a;
      outlined(ctx, toastS, dio.width / 2, y, toastBig ? 40 : 32, toastC);
      ctx.globalAlpha = 1;
    }
  }
  // ---- the HUD (DOM, written only when it changes) ----
  function hudWrite() {
    const me = g.turn === 0, ph = g.phase;
    const t = ph === OVER ? "Game over" : flying ? (me ? "In flight…" : "Bot throws…") : ph === VISIT ? (g.bust ? "Bust" : "The count") : me ? "Your throw" : "Bot's throw";
    if (ui.set(0, t)) (turnEl.textContent = t), turnEl.classList.toggle("br-them", !me && ph !== OVER);
    if (ui.set(1, g.rem[0])) nums[0]!.textContent = "" + g.rem[0];
    if (ui.set(2, g.rem[1])) nums[1]!.textContent = "" + g.rem[1];
    const left = ph === AIM ? DARTS - g.dart : 0, pips = "●".repeat(left) + "○".repeat(DARTS - left);
    if (ui.set(3, pips)) nums[2]!.textContent = pips;
    const n = ph === AIM ? checkout(g.rem[g.turn]!, DARTS - g.dart, CO) : 0;
    let h = "";
    if (ph === OVER) h = "";
    else if (n) h = `${me ? "Checkout" : "Bot's out"}: ${bedName(CO[0]!)}${n > 1 ? " · " + bedName(CO[1]!) : ""}${n > 2 ? " · " + bedName(CO[2]!) : ""}`;
    else if (ph === AIM && me) h = g.rem[0]! < START ? `Flick up to throw · drag to aim · ${g.rem[0]} left` : "Hold to steady · drag to aim · flick up to throw";
    else if (ph === AIM) h = "The bot steadies its arm";
    else h = "Double out: the last dart must land in a double (or the bull)";
    if (ui.set(4, h)) hint.textContent = h;
    const v = VIEWS[view]!;
    if (ui.set(5, v)) (viewK!.textContent = "VIEW · " + v), viewK!.setAttribute("aria-label", `Camera view: ${v.toLowerCase()} (V)`);
    if (ph === AIM && me && ready) ui.say(n ? `Your throw, ${g.rem[0]} left. Checkout ${h.slice(10)}` : `Your throw, ${g.rem[0]} left`);
  }

  // ---- the frame ----
  /** Pose rig i: tip at (x, y, z), tail along (dx, dy, dz) (unit). */
  function pose(i: number, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
    const ob = rigs[i]!, a = Math.asin(Math.max(-1, Math.min(1, dy)));
    ob.pos[0] = x; ob.pos[1] = y; ob.pos[2] = z;
    ob.rot[0] = a - Math.PI / 2;
    ob.rot[1] = Math.atan2(dx, dz);
    ob.rot[2] = 0;
    AT[i * 3] = x; AT[i * 3 + 1] = y; AT[i * 3 + 2] = z + 0.5;
  }
  function poseRigs(dt: number) {
    const t = engine.time;
    let moving = false;
    for (let i = 0; i < RIGS; i++) {
      if (!rigs[i]!.alpha) continue;
      const m = MO[i]!, o = i * 3;
      if (m === 0) {
        const ca = Math.cos(RA[i]!);
        pose(i, RX[i]!, RY[i]!, RZ[i]!, Math.sin(RYW[i]!) * ca, Math.sin(RA[i]!), Math.cos(RYW[i]!) * ca);
        continue;
      }
      if (m === 2) {
        // Falling off the wire, tumbling, to rest on the floor.
        moving = true;
        FV[o + 1] = FV[o + 1]! - 9.8 * 2.2 * dt;
        RX[i] = RX[i]! + FV[o]! * dt; RY[i] = RY[i]! + FV[o + 1]! * dt; RZ[i] = Math.min(OCHE - 6, RZ[i]! + FV[o + 2]! * dt);
        RA[i] = RA[i]! - dt * 5;
        if (RY[i]! <= 0.04) (RY[i] = 0.04), (RA[i] = 0), (MO[i] = 0), (FV[o] = FV[o + 2] = 0), (RYW[i] = 1.1);
        const ca = Math.cos(RA[i]!);
        pose(i, RX[i]!, RY[i]!, RZ[i]!, Math.sin(RYW[i]!) * ca, Math.sin(RA[i]!), Math.cos(RYW[i]!) * ca);
        continue;
      }
      const u = Math.max(0, Math.min(1, (t - M0[i]!) / MD[i]!)), e = m === 3 ? u * u * (3 - 2 * u) : u;
      const arc = m === 1 ? 0.9 : 0.6;
      const x = F0[o]! + (F1[o]! - F0[o]!) * e, y = F0[o + 1]! + (F1[o + 1]! - F0[o + 1]!) * e + 4 * arc * e * (1 - e), z = F0[o + 2]! + (F1[o + 2]! - F0[o + 2]!) * e;
      // The tail points back along the path (with a little wobble in flight).
      let dx = F0[o]! - F1[o]!, dy = F0[o + 1]! - F1[o + 1]! - 4 * arc * (1 - 2 * e), dz = F0[o + 2]! - F1[o + 2]!;
      const l = Math.hypot(dx, dy, dz) || 1;
      (dx /= l), (dy /= l), (dz /= l);
      if (m === 1) dx += Math.sin(t * 40) * 0.03 * (1 - e);
      pose(i, x, y, z, dx, dy, dz);
      if (u < 1) moving = true;
      else if (m === 3) (rigs[i]!.alpha = 0), (MO[i] = 0);
      else MO[i] = 0;
    }
    return moving;
  }
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
        if (w === T_UP) setReady();
        else if (w === T_BOTGO) {
          swayAt(swayT, PT);
          fire(botShot[0]! / 10 + PT[0]!, botShot[1]! / 10 + PT[1]!, botShot[2]!, botShot[3]!);
        } else if (w === T_LANDED) landed();
        else if (w === T_VISIT) visitDone();
        else if (w === T_PULL) pull();
        else if (w === T_NEXT) nextVisit();
        else if (w === T_END) showEnd();
        else if (w === T_POSTER) fire(4, 106, IDEAL, 0);
      }
      // The sway: it grows as you move and steadies as you hold still; with nobody aiming it fades out.
      const aiming = g.phase === AIM && ready && (g.turn === 1 || dragging || e.time < kbd);
      if (sway > 0.01 || aiming) {
        swayT += dt;
        holdT += dt;
        const floor = aiming ? (g.turn === 1 ? 2.2 : 2.6) : 0, k = aiming ? 0.9 : 3;
        sway = floor + (sway - floor) * Math.exp(-dt * k);
        if (!aiming && sway < 0.05) sway = 0;
        moving = true;
      }
      if (fx.step(dt)) moving = true;
      if (cam.step(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      for (let i = 0; i < RIGS; i++) if (pops[i]! && e.time < pops[i]! + 1.7) moving = true;
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (poseRigs(1 / 60)) engine.busy(), (dirty = true);
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fx.draw(), dio.draw();
    },
  });

  // ---- input: press to steady, drag to aim, flick up to throw; arrows aim, Space throws ----
  const mine = () => g.phase === AIM && ready && g.turn === 0 && card.hidden;
  const pxPerMm = () => (boardAffine(), Math.hypot(AF[4]!, AF[5]!) || 1);
  const sample = (t: number, x: number, y: number) => {
    const o = (psN++ & 7) * 3;
    PS[o] = t; PS[o + 1] = x; PS[o + 2] = y;
  };
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!mine()) return;
    play.setPointerCapture(e.pointerId);
    dragging = true;
    // A press on the board puts the reticle there; anywhere else it stays where it was.
    // Where on the stage (client minus the key's box: a button's offsetY is not its border box's).
    const r = play.getBoundingClientRect();
    (ox = r.left), (oy = r.top);
    toBoard(e.clientX - ox, e.clientY - oy, tmp);
    // (On a touch screen it sits a finger's width above the press, where you can see it.)
    if (tmp[0]! * tmp[0]! + tmp[1]! * tmp[1]! < R_FACE * R_FACE) (aimX = tmp[0]!), (aimY = tmp[1]! + (e.pointerType === "touch" ? 46 / pxPerMm() : 0));
    sway = Math.max(sway, 11);
    holdT = 0;
    (lastX = e.clientX), (lastY = e.clientY);
    psN = 0;
    sample(e.timeStamp, e.clientX, e.clientY);
    play.classList.add("br-drag");
    dirty = true;
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY, o = ((psN - 1) & 7) * 3, dtm = Math.max(1, Math.min(16, e.timeStamp - PS[o]!));
    sample(e.timeStamp, e.clientX, e.clientY);
    (lastX = e.clientX), (lastY = e.clientY);
    // A fast move up is the flick starting: the reticle holds still for it. Else the drag aims (finer than the
    // finger). The first move after a hold is timed as one event's worth (16 ms), not the whole hold.
    if (-dy / dtm > 0.7) return;
    const k = 0.55 / pxPerMm();
    aimX = Math.max(-REACH, Math.min(REACH, aimX + dx * k));
    aimY = Math.max(-REACH, Math.min(REACH, aimY - dy * k));
    sway = Math.min(18, sway + Math.hypot(dx, dy) * 0.12);
    dirty = true;
    engine.busy();
    engine.wake();
  }, sig);
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    play.classList.remove("br-drag");
    if (e.type !== "pointerup") return;
    sample(e.timeStamp, e.clientX, e.clientY);
    // The flick: the last 110 ms of the press, its speed up (CSS px a second) and its slant.
    const n = Math.min(psN, 8), lo = ((psN - 1) & 7) * 3;
    let fo = lo;
    for (let k = 1; k < n; k++) {
      const o = ((psN - 1 - k) & 7) * 3;
      if (PS[lo]! - PS[o]! > 110) break;
      fo = o;
    }
    const dtm = Math.max(16, PS[lo]! - PS[fo]!), up = PS[fo + 2]! - PS[lo + 2]!, side = PS[lo + 1]! - PS[fo + 1]!;
    const speed = (up / dtm) * 1000;
    if (up > 24 && speed > 450) {
      swayAt(swayT, PT);
      fire(aimX + PT[0]!, aimY + PT[1]!, IDEAL + (speed - 1700) / 70, Math.round((side / up) * 100));
    }
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
    if (!mine()) return;
    const ky = e.key, x = ky === "ArrowLeft" ? -1 : ky === "ArrowRight" ? 1 : 0, y = ky === "ArrowUp" ? 1 : ky === "ArrowDown" ? -1 : 0;
    if (x || y) {
      e.preventDefault();
      const st = e.shiftKey ? 1.5 : 6;
      aimX = Math.max(-REACH, Math.min(REACH, aimX + x * st));
      aimY = Math.max(-REACH, Math.min(REACH, aimY + y * st));
      sway = Math.min(14, Math.max(sway, 5) + 1.2);
      kbd = engine.time + 2.5;
      dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      swayAt(swayT, PT);
      fire(aimX + PT[0]!, aimY + PT[1]!, IDEAL, 0);
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): your visit, two darts in, the third on its way to T20.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261114);
    g.rem[0] = 301; g.from[0] = 301; g.rem[1] = 285; g.from[1] = 285;
    g.visits[0] = g.visits[1] = 3;
    g.log.set([0, 0, 0, 0, 0, 60, 81, 59, 0, 0, 0, 0, 0, 100, 45, 71]);
    throwDart(g, 20, 1040, IDEAL, 0);
    throwDart(g, -60, 1300, IDEAL, 0);
    for (let k = 0; k < 2; k++) {
      const i = k;
      rigs[i]!.alpha = 1;
      RX[i] = BXc + g.dx[k]! * MM; RY[i] = BYc + g.dy[k]! * MM; RZ[i] = ZF - 0.05;
      RA[i] = (13 + k * 6) * D;
      RYW[i] = (k ? -6 : 5) * D;
    }
    B.clear();
    ready = true;
    aimX = 3;
    aimY = 104;
    B.later(0.15, T_POSTER);
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
      return { phase: g.phase, turn: g.turn, dart: g.dart, you: g.rem[0]!, bot: g.rem[1]!, ready, flying, card: !card.hidden, view: VIEWS[view]!, aimX, aimY };
    },
    screen(x: number, y: number) {
      dio.project(BXc + x * MM, BYc + y * MM, ZF, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    board(sx: number, sy: number) {
      toBoard(sx, sy, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: your third dart on its way to the treble 20 (scripts/gallery-posters.mjs). */
export const posterAt = 0.42;
