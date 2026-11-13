// "Roll Home" (hero): a tiny roll-and-move board on a tabletop diorama. A winding loop of 24 spaces
// on a felt board, two ladders (arched wooden bridges) and two chutes (slides off a little tower),
// you against one bot, two pawns each. Press the pop dome (tap it, Space or ROLL): the die jumps,
// tumbles and lands; pick a pawn (tap it, or 1 / 2) when both could go; it hops space by space,
// climbs a ladder or rides a chute where it lands, and bumps an opponent it lands on back to the
// porch. A 6 rolls again. First with both pawns home wins. The camera eases after the moving pawn.
// Bricks: the kernel (fixed step, settle, its ledger for every page write: Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/dice (the pop dome and the seeded
// die), @fzlt/core/track (the loop, its jumps, the hops), @fzlt/core/slot, @fzlt/core/sound. The
// game is ./model.ts, pure and seeded (tests/roll-home.test.mjs); this file is the scene and the
// controls (tests/roll-home.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef } from "../../../../src/diorama";
import { dice, popDome } from "../../../../src/dice";
import { track, HOP } from "../../../../src/track";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { AGAIN, CAPTURE, CHUTE, FINISH, HOME, JUMPS, LADDER, OVER, PICK, ROLL, SPACES, WIN, botPick, canMove, choice, homeCount, move, newMatch, plan, reset as resetMatch, rollDie, rollSeed, type Match } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
// Palettes by role: a pastel afternoon (light) and a neon night (dark).
const LIGHT = {
  bg: "#f1e9df", floor: "#ddd5cb", wallB: "#f3ddd2", wallR: "#d6e6df", base: "#c99d72", top: "#e6c49a",
  board: "#f7f1e6", felt: "#a9d8c3", felt2: "#bfe3d2", tile0: "#fbf6ec", tile1: "#f6d7c7", tile2: "#d9d3f0", tile3: "#fbe3a8",
  porch: "#ffffff", lad: "#c58d5d", rung: "#e0b07c", chute: "#f08e6f", lip: "#f7b49c", post: "#8e8aa0",
  you: "#f0735a", youTop: "#ffb59f", bot: "#5f7fc4", botTop: "#a9bdf0", houseY: "#ffe2d6", houseB: "#dfe7fb", roofY: "#ee8270", roofB: "#7f97d6", door: "#5b5468", pad: "#fffaf0",
  dome: "#e45d4b", glass: "#dff3ff", die: "#fbf7f0", pip: "#25222d",
  mug: "#7fcfa8", tea: "#9c6a45", pot: "#e39a74", leaf: "#8fcf9b", leaf2: "#b0dfa8", pad2: "#fff8e8", pencil: "#f2c96b", lead: "#3d4255",
  shadow: "#3a2d3c", ring: "#ffffff", ringGo: "#ffd36b", light: [0.5, 1, 0.42], amb: 0.52, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#12152a", floor: "#262a44", wallB: "#2c3152", wallR: "#24394a", base: "#6c4f3e", top: "#86664c",
  board: "#2a2f4d", felt: "#1d4a4f", felt2: "#24595c", tile0: "#3b4a8a", tile1: "#7a3f8c", tile2: "#2d6f9a", tile3: "#2b8577",
  porch: "#e9f6ff", lad: "#b07a4c", rung: "#d9a46d", chute: "#ff5f8f", lip: "#ff9ab8", post: "#5c6180",
  you: "#ff6f61", youTop: "#ffb1a6", bot: "#4fd1ff", botTop: "#b6efff", houseY: "#f4c9bd", houseB: "#bfd8f3", roofY: "#e2574e", roofB: "#3f7fc8", door: "#ffe7a0", pad: "#3a3f63",
  dome: "#ff4f7b", glass: "#8fe4ff", die: "#f4f1ff", pip: "#1a1830",
  mug: "#3fa08a", tea: "#6b4a33", pot: "#a8644c", leaf: "#3f8f6a", leaf2: "#57a77d", pad2: "#d8d4e6", pencil: "#d9a94a", lead: "#20233a",
  shadow: "#000000", ring: "#e9f6ff", ringGo: "#ffd36b", light: [0.38, 1, 0.55], amb: 0.46, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night">;

// The table top (TT), the board (BX: its centre's x), the felt's top (BY) where every token stands.
const TT = 1.24, BH = 0.34, FH = 0.03, BX = -1.6, BY = TT + BH + FH;
// The loop, in the felt's coordinates: a bean with a waist (the track brick lays 24 spaces on it).
const PATH = [-7, -3.6, -3, -4.4, 0.5, -2.6, 4, -4.4, 7.4, -3.4, 7.8, 0, 7, 3.7, 3.2, 4.4, 0.4, 2.2, -2.6, 4.3, -6.9, 3.8, -7.8, 0.1];
const DOME = [3.55, -0.25], HOUSE = [-5.6, -0.85, -3.25, -0.85];
/** Seconds the bot waits before it rolls and before it picks. */
const BOT_ROLL = 0.75, BOT_PICK = 0.5;
// Animation states: waiting for a press, the die popping, a pawn moving, bumped pawns flying back, a pawn going in its house.
const A_IDLE = 0, A_POP = 1, A_MOVE = 2, A_SEND = 3, A_HOME = 4;
// Timed beats (a fixed table): what runs, and when.
const T_BOTROLL = 1, T_BOTPICK = 2, T_AUTO = 3, T_END = 4;
const NAMES = ["You", "Bot"];

export type RollScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly m: Match;
  readonly state: { phase: number; turn: number; anim: number; die: number; sel: number; card: boolean; at: number[] };
  /** Token k's screen point (CSS px from the stage's top left), as of the last draw. */
  tokenScreen(k: number): [number, number];
  /** The dome's screen point. */
  domeScreen(): [number, number];
  /** Start a match from this seed (tests). */
  reset(seed: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RollScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: canvas, a key over it (pointer surface and keyboard focus), stickers, end card, keys ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "rh-play";
  play.setAttribute("aria-label", "Roll Home: Space or Enter rolls the die, 1 or 2 (or the arrows and Enter) picks a pawn, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "rh-hud";
  hud.innerHTML = `<div class="rh-head"><p class="rh-top"><b class="rh-chip rh-turn">Your roll</b><b class="rh-chip rh-n"><i class="rh-dot"></i>You <span>0/2</span><i class="rh-dot rh-bot"></i>Bot <span>0/2</span></b></p><p class="rh-hint"></p></div><p class="rh-live" aria-live="polite"></p><div class="rh-card" role="dialog" aria-label="Game over" hidden><b></b><p></p><p class="rh-stats"></p><button type="button" class="bui-key rh-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const turnEl = top.children[0] as HTMLElement, nums = top.children[1]!.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { pop: "pop", hop: "tick", ladder: "power", chute: "slide", bump: "boom", home: "home", again: "ready", win: "win", lose: "end", pick: "click" },
    notes: {
      pop: [[260, 520, 0.06, 0, "triangle", 0.16], [900, 700, 0.05, 0.05, "square", 0.05]],
      tick: [[720, 520, 0.035, 0, "triangle", 0.1]],
      slide: [[900, 180, 0.5, 0, "triangle", 0.12]],
      home: [[784, 784, 0.1, 0, "triangle", 0.18], [1175, 1175, 0.22, 0.09, "sine", 0.16]],
    },
    volume: 0.1,
  });
  const K_MUTE = 0, K_ROLL = 1, K_T1 = 2, K_T2 = 3;
  const [muteK, t1K, t2K, rollK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "PAWN 1", aria: "Move pawn 1 (1)", id: K_T1 },
    { label: "PAWN 2", aria: "Move pawn 2 (2)", id: K_T2 },
    { label: "ROLL", aria: "Roll the die (Space)", id: K_ROLL, c: "rh-go" },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else if (id === K_ROLL) pressRoll();
    else pickToken(id === K_T1 ? 0 : 1);
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
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
  const tr = track({ points: PATH, closed: true, smooth: true, spaces: SPACES, jumps: JUMPS, tokens: 4, cap: 4, spacing: 0.44, hop: 0.8, hopTime: 0.2, jumpSpeed: 4.6 });
  const dc = dice({ count: 1, size: 0.78, duration: 1.15 });
  // The jumps' curves (felt coordinates): per jump, its ends, the bow across, the height.
  const JN = JUMPS.length, JA = new Float64Array(JN * 6);
  for (let j = 0; j < JN; j++) {
    const a = JUMPS[j]![0], b = JUMPS[j]![1], ax = tr.x[a]!, az = tr.z[a]!, bx = tr.x[b]!, bz = tr.z[b]!, len = Math.hypot(bx - ax, bz - az);
    JA[j * 6] = ax; JA[j * 6 + 1] = az; JA[j * 6 + 2] = bx; JA[j * 6 + 3] = bz;
    JA[j * 6 + 4] = (j & 1 ? -1 : 1) * 0.55; // bow
    JA[j * 6 + 5] = b > a ? 0.2 * len + 0.6 : 0.2 * len + 1.1; // height
  }
  const jumpOf = (from: number) => {
    for (let j = 0; j < JN; j++) if (JUMPS[j]![0] === from) return j;
    return -1;
  };
  /** Point u (0..1) along jump j, felt coordinates, into out [x, y, z]: a ladder arcs over; a chute
   *  climbs its tower (u < CL), then slides down. */
  const CL = 0.22;
  function jumpPoint(j: number, u: number, out: Float64Array, rail = 0) {
    const ax = JA[j * 6]!, az = JA[j * 6 + 1]!, bx = JA[j * 6 + 2]!, bz = JA[j * 6 + 3]!, bow = JA[j * 6 + 4]!, H = JA[j * 6 + 5]!;
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l, ladder = JUMPS[j]![1] > JUMPS[j]![0];
    let s = u, y: number;
    if (ladder) y = H * Math.sin(Math.PI * s);
    else {
      // The tower stands just past the top space; the slide runs from it to the bottom space.
      if (u < CL) s = 0, (y = H * (u / CL));
      else (s = (u - CL) / (1 - CL)), (y = H * (1 - s) ** 1.2 * (1 + 0.25 * s));
    }
    const b = bow * Math.sin(Math.PI * s) + rail;
    out[0] = ax + dx * s + px * b;
    out[1] = y;
    out[2] = az + dz * s + pz * b;
    return out;
  }
  // Tokens: each a group (picked, moved) holding a low-poly pawn.
  const toks: DioramaObject[] = [], tokBody: DioramaObject[] = [];
  // Pawn k's place: where it stands (felt coords) and where it eases to.
  const tp = new Float64Array(12), tg = new Float64Array(12), spin = new Float64Array(4);
  let dome: ReturnType<typeof popDome>;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("base", { fixed: 1 });
    // The room's corner: floor, two walls, a framed print.
    put({ id: "floor", size: [44, 0.5, 32], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [44.6, 12, 0.5], pos: [0, -0.5, -16.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "wallR", size: [0.5, 12, 32], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3, pick: false });
    // The table, and the board on it: a cream board, a felt inset.
    put({ id: "plinth", size: [28, TT - 0.14, 16.4], on: "floor", color: "base", cluster: "base", layer: 0, shadow: 0.2, pick: false });
    put({ id: "top", size: [28.6, 0.14, 17], on: "plinth", color: "top", layer: 0.4, pick: false });
    put({ id: "board", size: [19.4, BH, 12.6], on: "top", pos: [BX, 0, 0], color: "board", layer: 1, shadow: 0.25, pick: false });
    put({ id: "felt", size: [18.4, FH, 11.6], on: "board", color: "felt", layer: 1.2, pick: false });
    // The spaces: square tiles turned along the path; the porch is big and white, the foot of a
    // ladder and the top of a chute wear their colour.
    for (let i = 0; i < SPACES; i++) {
      const j = jumpOf(i), w = i ? 1.2 : 1.75, c: Key = i === 0 ? "porch" : j >= 0 ? (JUMPS[j]![1] > i ? "rung" : "lip") : (["tile0", "tile1", "tile2", "tile3"] as const)[i & 3]!;
      put({ id: "s" + i, size: [w, 0.07, w], on: "felt", pos: [tr.x[i]!, 0, tr.z[i]!], rot: [0, tr.a[i]!, 0], color: c, layer: 1.4, pick: false });
    }
    // Ladders: two rails of short tilted pieces over an arc, rungs across; chutes: a tower of two
    // posts, then a trough with lips down to the bottom space.
    const A = new Float64Array(3), B = new Float64Array(3);
    for (let j = 0; j < JN; j++) {
      const ladder = JUMPS[j]![1] > JUMPS[j]![0], N = ladder ? 12 : 11;
      for (let k = 0; k < N; k++) {
        const u0 = ladder ? k / N : CL + ((1 - CL) * k) / N, u1 = ladder ? (k + 1) / N : CL + ((1 - CL) * (k + 1)) / N;
        if (ladder) for (const r of [-0.27, 0.27]) seg(j, u0, u1, r, 0.09, 0.09, "lad", A, B);
        else seg(j, u0, u1, 0, 0.62, 0.07, "chute", A, B), seg(j, u0, u1, -0.31, 0.06, 0.18, "lip", A, B), seg(j, u0, u1, 0.31, 0.06, 0.18, "lip", A, B);
      }
      if (ladder) {
        const R = 9;
        for (let k = 1; k < R; k++) {
          jumpPoint(j, k / R, A), jumpPoint(j, k / R + 0.01, B);
          put({ size: [0.07, 0.06, 0.6], on: "felt", pos: [A[0]!, A[1]! + 0.02, A[2]!], rot: [0, Math.atan2(-(B[2]! - A[2]!), B[0]! - A[0]!), 0], color: "rung", layer: 3, pick: false });
        }
      } else {
        // The tower at the top space: two posts, a deck, a rail.
        jumpPoint(j, CL, A);
        jumpPoint(j, CL + 0.03, B);
        const H = JA[j * 6 + 5]!, yaw = Math.atan2(-(B[2]! - A[2]!), B[0]! - A[0]!), px = -(B[2]! - A[2]!), pz = B[0]! - A[0]!, pl = Math.hypot(px, pz) || 1;
        for (const r of [-0.3, 0.3]) put({ size: [0.1, H + 0.35, 0.1], on: "felt", pos: [A[0]! + (px / pl) * r, 0, A[2]! + (pz / pl) * r], rot: [0, yaw, 0], color: "post", layer: 3, pick: false });
        put({ size: [0.5, 0.08, 0.7], on: "felt", pos: [A[0]!, H - 0.04, A[2]!], rot: [0, yaw, 0], color: "lip", layer: 3, pick: false });
        for (let k = 1; k < 4; k++) put({ size: [0.05, 0.05, 0.62], on: "felt", pos: [A[0]!, (H * k) / 4, A[2]!], rot: [0, yaw, 0], color: "post", layer: 3, pick: false });
      }
    }
    // The houses (yours, the bot's) with a doorstep pad for each pawn that gets in.
    for (let p = 0; p < 2; p++) {
      const x = HOUSE[p * 2]!, z = HOUSE[p * 2 + 1]!, id = "house" + p;
      put({ id, size: [1.5, 1.05, 1.2], on: "felt", pos: [x, 0, z], color: p ? "houseB" : "houseY", layer: 3, shadow: 0.25, pick: false });
      put({ shape: "wedge", size: [0.8, 0.6, 1.34], on: id, pos: [0.4, 0, 0], rot: [0, Math.PI, 0], color: p ? "roofB" : "roofY", layer: 3, pick: false });
      put({ shape: "wedge", size: [0.8, 0.6, 1.34], on: id, pos: [-0.4, 0, 0], color: p ? "roofB" : "roofY", layer: 3, pick: false });
      put({ size: [0.2, 0.36, 0.2], on: id, pos: [0.42, 0.05, -0.25], color: "post", layer: 3, pick: false });
      put({ size: [0.38, 0.6, 0.04], on: "felt", pos: [x, 0, z + 0.61], color: "door", layer: 3, pick: false });
      for (let t = 0; t < 2; t++) put({ shape: "cyl", sides: 14, size: [0.95, 0.04, 0.95], on: "felt", pos: [x + (t ? 0.5 : -0.5), 0, z + 1.25], color: "pad", layer: 1.5, pick: false });
    }
    // Things on the table: a mug of tea, a score pad and a pencil, a little plant.
    put({ id: "mug", shape: "cyl", sides: 14, size: [1.3, 1.4, 1.3], on: "top", pos: [11, 0, -4.6], color: "mug", layer: 3, shadow: 0.25, cluster: "mug", pick: false });
    put({ shape: "cyl", sides: 14, size: [1.08, 0.02, 1.08], on: "mug", pos: [0, -0.14, 0], color: "tea", layer: 3.1, pick: false });
    put({ size: [0.5, 0.75, 0.16], on: "top", pos: [11.82, 0.3, -4.6], color: "mug", cluster: "mug", layer: 3, pick: false });
    put({ id: "pad", size: [3, 0.08, 3.8], on: "top", pos: [11.2, 0, 2.2], rot: [0, 0.18, 0], color: "pad2", layer: 1, shadow: 0.15, cluster: "padc", pick: false });
    put({ shape: "cyl", sides: 6, size: [0.16, 3.2, 0.16], on: "pad", pos: [0.6, 0.1, 0.1], rot: [Math.PI / 2, -0.6, 0], color: "pencil", layer: 2, pick: false });
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.2, size: [1.5, 1.3, 1.5], on: "top", pos: [11.6, 0, 6.4], color: "pot", layer: 3, shadow: 0.2, cluster: "plant", pick: false });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.45, size: [2.4, 1.6, 2.4], on: "pot", color: "leaf", layer: 3, pick: false });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [1.7, 1.5, 1.7], on: "leaf", color: "leaf2", layer: 3, pick: false });
    // The pawns.
    for (let k = 0; k < 4; k++) {
      const p = k >> 1, c: Key = p ? "bot" : "you", ct: Key = p ? "botTop" : "youTop", id = "tok" + k;
      const g = put({ id, shape: "group", size: [0.9, 0, 0.9], on: "felt", shadow: 0.4, tag: { tok: k }, layer: 3 });
      const b = put({ id: id + "b", shape: "cyl", sides: 14, top: 0.86, size: [0.9, 0.2, 0.9], on: id, color: c, layer: 3 });
      put({ id: id + "c", shape: "cyl", sides: 14, top: 0.5, size: [0.7, 0.78, 0.7], on: id + "b", color: c, layer: 3 });
      put({ id: id + "n", shape: "cyl", sides: 14, size: [0.52, 0.07, 0.52], on: id + "c", color: ct, layer: 3 });
      put({ id: id + "h", shape: "cyl", sides: 14, top: 1.3, size: [0.44, 0.15, 0.44], on: id + "n", color: c, layer: 3 });
      put({ id: id + "i", shape: "cyl", sides: 14, top: 0.55, size: [0.58, 0.3, 0.58], on: id + "h", color: c, layer: 3 });
      toks.push(g);
      tokBody.push(b);
    }
    // The pop dome, on the board's right half.
    dome = popDome(dio, dc, { on: "felt", at: DOME, radius: 1.15, color: P.dome, glass: P.glass, cluster: "base", dice: { color: P.die, pip: "#25222d", shadow: 0.35 } });
  }
  /** One straight piece of a jump's rail or trough, from u0 to u1, `rail` across. */
  function seg(j: number, u0: number, u1: number, rail: number, w: number, h: number, c: Key, A: Float64Array, B: Float64Array) {
    jumpPoint(j, u0, A, rail);
    jumpPoint(j, u1, B, rail);
    const dx = B[0]! - A[0]!, dy = B[1]! - A[1]!, dz = B[2]! - A[2]!, hl = Math.hypot(dx, dz), id = "j" + j + "_" + u0.toFixed(3) + "_" + rail;
    put({ id, shape: "group", size: [0.1, 0, 0.1], on: "felt", pos: [(A[0]! + B[0]!) / 2, (A[1]! + B[1]!) / 2, (A[2]! + B[2]!) / 2], rot: [0, Math.atan2(-dz, dx), 0], layer: 3, pick: false });
    put({ size: [Math.hypot(hl, dy) + 0.06, h, w], on: id, pos: [0, -h / 2, 0], rot: [0, 0, Math.atan2(dy, hl)], color: c, layer: 3, pick: false });
  }

  // ---- state ----
  let m: Match = newMatch(1), seed = 1, botRnd = seeded(1), anim = A_IDLE, sel = 0, T = 0, mover = -1, did = 0, sent = 0, lastHop = -1;
  let tAmb = 0, hudDirty = true, dirty = true, toastT = 0, toastK = 0, toastS = "", said = "";
  const TT_ = new Float64Array(8), TF = new Uint8Array(8);
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), W3 = new Float64Array(3);
  // Bumped pawns' flights: start [x, y, z] per pawn.
  const fly = new Float64Array(12);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset, [5] drawn once.
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const cue = (t: string) => engine.events.emit(t);
  function later(sec: number, what: number) {
    for (let k = 0; k < 8; k++) if (!TF[k]) return void ((TT_[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05));
  }
  /** Pawn k's resting place (felt coords) into tg: its share of its space, or its doorstep. */
  function restOf(k: number) {
    const j = k * 3;
    if (m.pos[k] === HOME) {
      const p = k >> 1;
      tg[j] = HOUSE[p * 2]! + (k & 1 ? 0.5 : -0.5); tg[j + 1] = 0.04; tg[j + 2] = HOUSE[p * 2 + 1]! + 1.25;
    } else tr.slot(k, tmp), (tg[j] = tmp[0]!), (tg[j + 1] = tmp[1]! + 0.07), (tg[j + 2] = tmp[2]!);
  }
  function placeAll(snap: boolean) {
    for (let k = 0; k < 4; k++) tr.place(k, m.pos[k] === HOME ? -1 : m.pos[k]!);
    for (let k = 0; k < 4; k++) {
      restOf(k);
      if (snap) for (let c = 0; c < 3; c++) tp[k * 3 + c] = tg[k * 3 + c]!;
    }
  }
  function syncToks() {
    for (let k = 0; k < 4; k++) {
      const g = toks[k]!;
      g.pos[0] = tp[k * 3]!; g.pos[1] = tp[k * 3 + 1]!; g.pos[2] = tp[k * 3 + 2]!;
      g.rot[1] = spin[k]!;
    }
  }
  function reset(s: number) {
    seed = s >>> 0;
    resetMatch(m, seed);
    botRnd = seeded(seed * 7 + 3);
    anim = A_IDLE;
    mover = -1;
    sel = 0;
    TF.fill(0);
    toastT = 0;
    spin.fill(0);
    placeAll(true);
    syncToks();
    card.hidden = true;
    say("Your roll: press the dome.");
    setView(true);
    hudDirty = dirty = true;
    engine.wake();
  }

  // ---- turns ----
  function pressRoll() {
    if (m.phase !== ROLL || anim !== A_IDLE || m.turn !== 0) return;
    roll();
  }
  function roll() {
    const sd = rollSeed(m), v = rollDie(m);
    dome.press(sd);
    anim = A_POP;
    T = 0;
    cue("pop");
    say(`${NAMES[m.turn]} rolled… `);
    hudDirty = dirty = true;
    engine.wake();
    return v;
  }
  /** The pop is over: the value is up. Your turn asks for a pawn if it matters; the bot thinks. */
  function popped() {
    anim = A_IDLE;
    say(`${NAMES[m.turn]} rolled a ${m.die}.`);
    if (m.turn === 1) return later(BOT_PICK, T_BOTPICK);
    if (choice(m)) {
      sel = m.pos[0] === HOME ? 1 : m.pos[1] === HOME ? 0 : sel;
      say(`You rolled a ${m.die}: pick a pawn.`);
    } else later(0.3, T_AUTO);
    hudDirty = dirty = true;
  }
  function pickToken(t: number) {
    if (m.turn !== 0 || anim !== A_IDLE || m.phase !== PICK) return;
    const k = t;
    if (!canMove(m, k)) return;
    cue("pick");
    go(k);
  }
  function autoPick() {
    const a = m.turn * 2;
    go(m.pos[a] === HOME ? a + 1 : a);
  }
  /** Move pawn k: the model plays it now; the scene plays it out. */
  function go(k: number) {
    const from = m.pos[k]!;
    did = move(m, k);
    if (did < 0) return;
    sent = m.last.sent;
    mover = k;
    tr.place(k, from);
    tr.move(k, did & FINISH ? SPACES - from : m.last.stop - from);
    for (let c = 0; c < 3; c++) tp[k * 3 + c] = tg[k * 3 + c]!;
    anim = A_MOVE;
    T = 0;
    lastHop = -1;
    hudDirty = dirty = true;
    engine.wake();
  }
  /** The mover has landed: bump, go home, or hand the turn over. */
  function landed() {
    const k = mover;
    if (did & LADDER) toast("LADDER!", 1);
    else if (did & CHUTE) toast("CHUTE!", 2);
    if (sent) {
      anim = A_SEND;
      T = 0;
      for (let o = 0; o < 4; o++)
        if (sent & (1 << o)) {
          for (let c = 0; c < 3; c++) fly[o * 3 + c] = tp[o * 3 + c]!;
          tr.place(o, 0);
        }
      cue("bump");
      toast("BUMP!", 2);
      say(k >> 1 ? "The bot bumped your pawn back to the porch." : "Bump! Their pawn goes back to the porch.");
      return;
    }
    if (did & FINISH) {
      anim = A_HOME;
      T = 0;
      tr.place(k, -1);
      for (let c = 0; c < 3; c++) fly[k * 3 + c] = tp[k * 3 + c]!;
      cue("home");
      toast("HOME!", 1);
      say(`${NAMES[k >> 1]}: a pawn is home.`);
      return;
    }
    next();
  }
  function next() {
    anim = A_IDLE;
    mover = -1;
    placeAll(false);
    if (did & WIN) {
      cue(m.winner === 0 ? "win" : "lose");
      later(0.6, T_END);
    } else {
      if (did & AGAIN) toast("ROLL AGAIN", 0), cue("again");
      if (m.turn === 1) later(BOT_ROLL, T_BOTROLL);
      else say(did & AGAIN ? "A 6: roll again." : "Your roll: press the dome.");
    }
    hudDirty = dirty = true;
  }
  function showEnd() {
    const won = m.winner === 0, s = m.stats;
    (card.children[0] as HTMLElement).textContent = won ? "Home first!" : "The bot got home";
    (card.children[1] as HTMLElement).textContent = won ? "Both your pawns are in. Nicely rolled." : `It took ${s[4]} moves. Yours: ${homeCount(m, 0)} of 2 home.`;
    (card.children[2] as HTMLElement).textContent = `Moves ${s[0]} · Bumps ${s[1]} · Ladders ${s[2]} · Chutes ${s[3]}`;
    card.hidden = false;
    say(won ? "You win: both pawns home." : "The bot wins.");
    hudDirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera: framed on the board, easing after the moving pawn ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 }, base = { ...goal };
  let limits = { yaw: [-2, 2], pitch: [30 * D, 70 * D], dist: [5, 200] }, user = false;
  const portrait = () => dio.width / dio.height < 1.05;
  function setView(snap: boolean) {
    const port = portrait(), g = base, Wd = dio.width, H = dio.height;
    (g.yaw = (port ? -62 : -16) * D), (g.pitch = (port ? 56 : 50) * D), (g.tx = BX + (port ? 0.4 : 0.6)), (g.ty = BY), (g.tz = port ? 0.3 : 0.6), (g.fov = 0.6);
    const x0 = BX - 9.7, x1 = BX + 9.7, z0 = -6.3, z1 = 6.3;
    const pts = [x0, TT, z0, x1, TT, z0, x0, TT, z1, x1, TT, z1, x0, BY + 1.2, z0, x1, BY + 1.6, z0, BX + DOME[0]!, BY + 2.4, DOME[1]!];
    dio.fit(g, pts, { x0: 8, x1: Wd - 8, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    limits = { yaw: [g.yaw - 55 * D, g.yaw + 55 * D], pitch: [28 * D, 72 * D], dist: [g.dist * 0.6, g.dist * 1.5] };
    Object.assign(goal, g);
    if (snap || RM) Object.assign(dio.cam, g), (user = false);
    dirty = true;
    engine.wake();
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  /** Ease the camera toward the goal: the board's frame, pulled toward the moving pawn. */
  function stepCam(dt: number) {
    const c = dio.cam, chase = mover >= 0 && !RM, k = 1 - Math.exp(-dt * (chase ? 2.6 : 3.4));
    if (chase) {
      const j = mover * 3, f = 0.42;
      goal.tx = base.tx + (BX + tp[j]! - base.tx) * f;
      goal.tz = base.tz + (tp[j + 2]! - base.tz) * f;
      goal.ty = base.ty + tp[j + 1]! * 0.3;
      goal.dist = base.dist * 0.8;
    } else (goal.tx = base.tx), (goal.tz = base.tz), (goal.ty = base.ty), (goal.dist = user ? c.dist : base.dist);
    if (user && !chase) {
      // After a drag the camera stays where you left it; only the target settles back.
      goal.yaw = c.yaw;
      goal.pitch = c.pitch;
    } else (goal.yaw = base.yaw), (goal.pitch = base.pitch);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const f = CAMF[i]!, a = c[f];
      c[f] = a + (goal[f] - a) * k;
      d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 30 : i < 2 ? 0.03 : 0.6));
    }
    if (d < 0.01) {
      for (let i = 0; i < 8; i++) c[CAMF[i]!] = goal[CAMF[i]!];
      return false;
    }
    return true;
  }

  // ---- the frame ----
  function sampleMover(t: number) {
    const k = mover, j = k * 3, more = tr.sample(t, tmp);
    // The hop under way: a jump rides our ladder or chute instead of the track's straight slide.
    const H = tr.hops;
    let h = 0;
    while (h < H.n - 1 && t >= H.t1[h]!) h++;
    if (h !== lastHop && t < H.t1[h]!) {
      lastHop = h;
      if (H.kind[h] === HOP.jump) cue(H.to[h]! > H.from[h]! ? "ladder" : "chute");
      else cue("hop");
    }
    if (H.kind[h] === HOP.jump && t < H.t1[h]!) {
      const u = Math.max(0, Math.min(1, (t - H.t0[h]!) / (H.t1[h]! - H.t0[h]!))), jj = jumpOf(H.from[h]!), lad = H.to[h]! > H.from[h]!;
      // A ladder climbs at an even pace with a bob per rung; a chute climbs its tower, then speeds up.
      const e = lad ? u : u < 0.4 ? (u / 0.4) * CL : CL + (1 - CL) * ((u - 0.4) / 0.6) ** 1.5;
      jumpPoint(jj, e, tmp2);
      tp[j] = tmp2[0]!; tp[j + 1] = tmp2[1]! + 0.09 + (lad ? 0.05 * Math.abs(Math.sin(u * 9 * Math.PI)) : 0.04); tp[j + 2] = tmp2[2]!;
      if (!lad && e > CL) spin[k] = spin[k]! + 0.25;
      return true;
    }
    tp[j] = tmp[0]!; tp[j + 1] = tmp[1]! + 0.07; tp[j + 2] = tmp[2]!;
    return more;
  }
  /** Arc from fly[] to the resting place, u 0..1. */
  function arc(k: number, u: number, hgt: number) {
    const j = k * 3, e = u * u * (3 - 2 * u);
    for (let c = 0; c < 3; c++) tp[j + c] = fly[j + c]! + (tg[j + c]! - fly[j + c]!) * e;
    tp[j + 1] = tp[j + 1]! + hgt * 4 * u * (1 - u);
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!];
          dome.plinth.color = P.dome;
          dome.view.bodies[0]!.color = P.die;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = rollK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(!V[5]);
      }
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y);
      }
    },
    step(e, dt) {
      let moving = false;
      for (let k = 0; k < 8; k++) {
        if (!TF[k] || e.time < TT_[k]!) continue;
        const w = TF[k];
        TF[k] = 0;
        moving = true;
        if (w === T_BOTROLL) m.phase === ROLL && m.turn === 1 && anim === A_IDLE && roll();
        else if (w === T_BOTPICK) m.phase === PICK && go(botPick(m, botRnd));
        else if (w === T_AUTO) m.phase === PICK && m.turn === 0 && autoPick();
        else if (w === T_END) showEnd();
      }
      if (anim === A_POP) {
        T += dt;
        if (!dome.show(T)) popped();
        moving = true;
      } else if (anim === A_MOVE) {
        T += dt;
        // The last sample is the landing place (its share of the space).
        if (!sampleMover(T)) landed();
        moving = true;
      } else if (anim === A_SEND) {
        T += dt;
        const u = Math.min(1, T / 0.85);
        for (let o = 0; o < 4; o++) if (sent & (1 << o)) restOf(o), arc(o, u, 2.6), (spin[o] = spin[o]! + dt * 14 * (1 - u));
        if (u >= 1) next();
        moving = true;
      } else if (anim === A_HOME) {
        T += dt;
        const u = Math.min(1, T / 0.7);
        restOf(mover), arc(mover, u, 1.8);
        if (u >= 1) next();
        moving = true;
      }
      // Pawns sharing a space shuffle to their spots.
      for (let k = 0; k < 4; k++) {
        if (k === mover || (anim === A_SEND && sent & (1 << k))) continue;
        restOf(k);
        const j = k * 3;
        let d = 0;
        for (let c = 0; c < 3; c++) {
          const a = tp[j + c]!, b = tg[j + c]!;
          tp[j + c] = Math.abs(b - a) < 0.002 ? b : a + (b - a) * Math.min(1, dt * 9);
          d += Math.abs(b - a);
        }
        if (d > 0.002) moving = true;
        const s = spin[k]!, r = Math.round(s / TAU) * TAU;
        if (Math.abs(s - r) > 0.002) (spin[k] = s + (r - s) * Math.min(1, dt * 8)), (moving = true);
      }
      if (stepCam(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      tAmb += dt;
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) {
        dirty = false;
        syncToks();
        if (anim !== A_POP) dome.show(9);
        dio.draw();
        V[5] = 1;
      }
    },
  });

  // ---- the overlay: the porch and house signs, the pick markers, the toast ----
  const WIDTHS = new Map<string, number>();
  const font = (px: number) => `800 ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;
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
  function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, z: number, bg: string, fg = "#1f2433") {
    if (!dio.project(x, y, z, tmp)) return;
    const px = Math.max(11, Math.min(15, Math.round(((0.55 * dio.focal()) / tmp[2]!) * 1.4)));
    sticker(ctx, text, tmp[0]!, tmp[1]! - (px + 10) / 2, px, bg, fg);
  }
  /** A ring on the felt round space s (where a pawn would land). */
  function ringAt(ctx: CanvasRenderingContext2D, s: number, r: number, col: string, w: number) {
    const x = s === HOME ? 0 : tr.x[s]!, z = s === HOME ? 0 : tr.z[s]!;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * TAU;
      dio.project(BX + x + Math.cos(a) * r, BY + 0.09, z + Math.sin(a) * r, tmp2);
      i ? ctx.lineTo(tmp2[0]!, tmp2[1]!) : ctx.moveTo(tmp2[0]!, tmp2[1]!);
    }
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = w + 3;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  const TOAST = ["#fffaf1", "#ffd36b", "#f08e6f"];
  const TOAST_T = 1;
  const PL = new Int8Array(2);
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    // Your pick: a ring where each pawn would land, and its number over it (the signs step aside).
    const picking = m.phase === PICK && m.turn === 0 && anim === A_IDLE && choice(m);
    if (!picking) {
      label(ctx, "PORCH", BX + tr.x[0]!, BY + 0.1, tr.z[0]! - 0.9, P.porch);
      for (let p = 0; p < 2; p++) label(ctx, p ? "BOT" : "YOU", BX + HOUSE[p * 2]!, BY + 1.9, HOUSE[p * 2 + 1]!, p ? P.botTop : P.youTop);
    }
    if (picking)
      for (let t = 0; t < 2; t++) {
        const k = t, s = plan(m, k, m.die, PL), on = t === sel, j = k * 3;
        if (s === HOME) label(ctx, "HOME", BX + HOUSE[0]! + (t ? 0.5 : -0.5), BY + 0.4, HOUSE[1]! + 1.25, on ? P.ringGo : "#ffffff");
        else ringAt(ctx, PL[1]!, 0.78, on ? P.ringGo : P.ring, on ? 4 : 2.5);
        label(ctx, "" + (t + 1), BX + tp[j]!, BY + tp[j + 1]! + 1.85, tp[j + 2]!, on ? P.ringGo : "#ffffff");
      }
    if (toastT > 0) {
      const u = 1 - toastT / TOAST_T, s = u < 0.18 ? 0.6 + (u / 0.18) * 0.48 : u < 0.3 ? 1.08 - ((u - 0.18) / 0.12) * 0.08 : 1;
      const px = Math.round(Math.max(20, Math.min(30, dio.width / 26)));
      ctx.font = font(px);
      ctx.save();
      ctx.globalAlpha = u < 0.18 ? u / 0.18 : u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.translate(dio.width / 2, V[3]! + (dio.height - V[3]! - V[4]!) * 0.22 - (u > 0.8 ? (u - 0.8) * 60 : 0));
      ctx.scale(s, s);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, "#1f2433");
      ctx.restore();
    }
  }
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = TOAST_T);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the HUD (DOM writes in render, change-only) ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const mine = m.turn === 0, ph = m.phase, pick = ph === PICK && mine && anim === A_IDLE && choice(m), rollable = ph === ROLL && mine && anim === A_IDLE;
    const t = ph === OVER ? (m.winner === 0 ? "You win" : "Bot wins") : !mine ? "Bot's turn" : anim === A_POP ? "Rolling…" : pick ? `You rolled ${m.die}: pick` : anim !== A_IDLE || ph === PICK ? "Moving…" : "Your roll";
    if (set(0, t)) turnEl.textContent = t;
    const cls = (ph === OVER ? m.winner === 0 : mine) ? "rh-chip rh-turn rh-you" : "rh-chip rh-turn rh-them";
    if (set(1, cls)) turnEl.className = cls;
    const a = homeCount(m, 0), b = homeCount(m, 1);
    if (set(2, a)) nums[0]!.textContent = a + "/2";
    if (set(3, b)) nums[1]!.textContent = b + "/2";
    const tp_ = coarse ? "Tap" : "Click";
    const hint = rollable ? `${tp_} the dome (or Space) to roll.` : pick ? `${tp_} a pawn, or press 1 or 2.` : "";
    if (set(4, hint)) hintEl.textContent = hint;
    if (set(5, said)) live.textContent = said;
    if (set(6, pick)) t1K!.hidden = t2K!.hidden = !pick;
    if (set(7, rollable)) rollK!.disabled = !rollable;
    const s1 = pick && canMove(m, 0), s2 = pick && canMove(m, 1);
    if (set(8, s1)) t1K!.disabled = !s1;
    if (set(9, s2)) t2K!.disabled = !s2;
    if (set(10, pick ? sel : -1)) t1K!.setAttribute("aria-pressed", "" + (pick && sel === 0)), t2K!.setAttribute("aria-pressed", "" + (pick && sel === 1));
    if (set(11, rollable)) play.classList.toggle("rh-aim", rollable);
  }

  // ---- input: a tap acts, a drag orbits, keys roll and pick ----
  const ptrs = new Map<number, Float64Array>();
  let downX = 0, downY = 0, dragging = false;
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, Float64Array.of(e.offsetX, e.offsetY));
    if (ptrs.size === 1) (downX = e.offsetX), (downY = e.offsetY), (dragging = false);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    const x = e.offsetX, y = e.offsetY, p = ptrs.get(e.pointerId);
    if (!p) return;
    if (!dragging && Math.hypot(x - downX, y - downY) > 8) (dragging = true), play.classList.add("rh-drag");
    if (dragging) {
      const c = dio.cam;
      (c.yaw -= (x - p[0]!) * 0.006), (c.pitch += (y - p[1]!) * 0.005), dio.clamp(limits), (user = true), (dirty = true), engine.wake();
    }
    (p[0] = x), (p[1] = y);
  }, sig);
  const end = (e: PointerEvent) => {
    const had = ptrs.delete(e.pointerId);
    play.classList.remove("rh-drag");
    if (!had) return;
    if (!dragging && !ptrs.size && e.type === "pointerup") tap(e.offsetX, e.offsetY);
    if (!ptrs.size) dragging = false;
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  /** Your pawn under (x, y): picked, or the nearest pawn or landing ring within reach. */
  function tokenAt(x: number, y: number) {
    const ob = dio.root(dio.pick(x, y)), tag = ob?.tag as { tok?: number } | null | undefined;
    if (tag && tag.tok !== undefined && tag.tok >> 1 === 0) return tag.tok;
    let best = -1, bd = coarse ? 54 : 40;
    for (let k = 0; k < 2; k++) {
      if (!canMove(m, k)) continue;
      const j = k * 3, s = plan(m, k, m.die, PL);
      dio.project(BX + tp[j]!, BY + tp[j + 1]! + 0.7, tp[j + 2]!, tmp);
      let d = Math.hypot(tmp[0]! - x, tmp[1]! - y);
      if (s !== HOME) dio.project(BX + tr.x[PL[1]!]!, BY, tr.z[PL[1]!]!, tmp), (d = Math.min(d, Math.hypot(tmp[0]! - x, tmp[1]! - y)));
      if (d < bd) (bd = d), (best = k);
    }
    return best;
  }
  function tap(x: number, y: number) {
    if (m.phase === OVER || m.turn !== 0 || anim !== A_IDLE) return;
    if (m.phase === ROLL) return pressRoll();
    if (m.phase === PICK && choice(m)) {
      const k = tokenAt(x, y);
      if (k >= 0) pickToken(k);
    }
  }
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "1" || k === "2") return void (e.preventDefault(), pickToken(+k - 1));
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && m.phase === PICK && choice(m)) {
      e.preventDefault();
      sel = 1 - sel;
      hudDirty = dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      if (m.phase === ROLL) pressRoll();
      else if (m.phase === PICK && choice(m)) pickToken(sel);
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): mid-game, pawns on the loop and one in a house, the
  // die in the air.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261106);
    m.pos[0] = 11; m.pos[1] = 3; m.pos[2] = HOME; m.pos[3] = 18;
    m.rolls = 9;
    placeAll(true);
    syncToks();
    roll();
  }

  buildScene();
  reset((engine.random() * 100000) | 0);
  engine.start();
  return {
    engine,
    accessible: true,
    get m() {
      return m;
    },
    get state() {
      return { phase: m.phase, turn: m.turn, anim, die: m.die, sel, card: !card.hidden, at: Array.from(tr.at) };
    },
    tokenScreen(k: number) {
      const j = k * 3;
      dio.project(BX + tp[j]!, BY + tp[j + 1]! + 0.6, tp[j + 2]!, W3);
      return [W3[0]!, W3[1]!];
    },
    domeScreen() {
      dio.project(BX + DOME[0]!, BY + 0.2, DOME[1]! + 1.2, W3);
      return [W3[0]!, W3[1]!];
    },
    reset,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the die in the air over a game half played (scripts/gallery-posters.mjs). */
export const posterAt = 0.5;
