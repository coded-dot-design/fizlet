// "Leftover Stack" (hero, diorama): the kitchen, the night after the feast. The fridge stands open
// beside the counter: three glass shelves, the door swung wide with its bins of bottles, the light on
// inside and a cold mist rolling out over the floor. The leftovers come off the counter one at a time
// (a pie half, a tray of stuffing, a gravy jar, the foil-wrapped turkey, a cranberry tub, a casserole,
// a stack of rolls, the mashed potatoes), each a little low-poly dish of a few blocks. Aim the next
// one with the arrows (← → a column, ↑ ↓ a shelf) or a drag, turn it with R or the ↻ key, and drop
// it: it slides as far back as it goes and rests on what is under it. Cover a shelf and it glows (the
// dishes settle with a little bounce). Anything that only goes in sticking out past the door line
// gets bumped: the door swings in, thunks it and it wobbles; the third bump and the door won't close:
// THE FRIDGE WINS. Pack the whole night and the door swings shut. The camera looks in from the left,
// a little above, and drifts with the dish you aim. Dark is the kitchen with the lights off.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D: shapes resting `on` each other, the depth sort
// with the mist in it, the camera), @fzlt/core/slot, @fzlt/core/sound. The fridge is ./model.ts,
// pure and seeded (tests/leftover-stack.test.mjs); this file is the scene and the controls
// (tests/leftover-stack.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import {
  CASS, CLEAR, COLS, DEPTH, EV_BUMP, EV_DROP, EV_FULL, EV_MOVE, EV_OVER, EV_PACKED, EV_REFUSE, EV_START, EV_TURN, IDLE, JAR, KIND_D, KIND_H, KIND_W, MASH, NAMES, NS,
  OVER, PACKED, PIE, PLAY, ROLLS, RUN_N, TRAY, TUB, TURKEY, WHY_ROOM, autopilot, fridge,
} from "./model";

const TAU = 6.283185307179586, HALF_PI = Math.PI / 2;
const LIGHT: Record<string, string> = {
  bg: "#e9dfd3", floor: "#d8c7b2", tile: "#cdb9a1", wall: "#f1e4d2", wall2: "#e8d7c2", cab: "#9fc3b5", cabD: "#86ad9f", ctop: "#e9d7bb", knob: "#3d4255",
  body: "#f4efe6", body2: "#e3dccf", inner: "#fbfdff", inner2: "#e3eef4", back: "#f4fbff", strip: "#fffbe8", glass: "#cfe9f2", lip: "#ffffff", lipFull: "#ffd36b",
  crisp: "#d9eef3", lettuce: "#7fcf8f", carrot: "#f08e3c", gasket: "#c9c3bb", handle: "#9aa0b4", bin: "#eef4f7",
  b0: "#e5484d", b1: "#f2c450", b2: "#fffaf1", b3: "#7fcfa8", egg: "#fbf3e4", note: "#fffdf6", mag0: "#e5484d", mag1: "#5b6bbf", mag2: "#2f8f83",
  tin: "#c9ccd6", crust: "#e7b36a", pump: "#e0792f", cream: "#fffaf1", dish: "#f6f1e6", dishR: "#d9603f", stuff: "#c98a4b", stuff2: "#9c6236", herb: "#5f9a4f",
  gravy: "#8a4f2e", lid: "#e5484d", label: "#fbf3e1", foil: "#cfd4de", foil2: "#e7ebf1", plate: "#fffdf8", cran: "#b8233b", tubL: "#f6f3f3",
  cdish: "#2f8f83", bean: "#6aa84f", onion: "#e3b35d", roll: "#e3a35a", roll2: "#c98545", napkin: "#f2a541", bowl: "#5b6bbf", mash: "#fbf0d6", butter: "#ffd84d",
  plates: "#fffaf1", towel: "#e5484d", clock: "#fffaf1", shadow: "#3a2d3c",
};
const DARK: Record<string, string> = {
  ...LIGHT, bg: "#121628", floor: "#1f2338", tile: "#262a42", wall: "#262b45", wall2: "#22263e", cab: "#3d5a57", cabD: "#33504d", ctop: "#5a5266", knob: "#8a8fa3",
  body: "#b9b8c6", body2: "#9e9db0", plates: "#c9c4d4", towel: "#a8434a", clock: "#cfc9d6", shadow: "#000000",
};
const LIT = { light: [-0.35, 1, 0.75], amb: 0.55 }, NIGHT = { light: [-0.2, 0.6, 1], amb: 0.4 };
/** The cells: across, deep, a level's height; the interior's left and back; each shelf's floor. */
/** The freezer drawer under it all (the fridge stands on it) and the fridge section's height. */
const CW = 1, LV = 0.55, X0 = -3, Z0 = -2, FB = 2.2, HF = 5.75, YS = [FB + 1.05, FB + 2.9, FB + 4.2], TOPY = FB + HF, DOOR_OPEN = 1.95;
const ALIVE = 4, FXN = 160, FS = 8;
const CAPS = NAMES.map((n) => n[0]!.toUpperCase() + n.slice(1));

export type StackScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly f: ReturnType<typeof fridge>;
  readonly state: { mode: number; idx: number; bumps: number; score: number; card: boolean; door: number; shelf: number; col: number };
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): StackScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const coarse = matchMedia("(pointer: coarse)").matches, RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the stickers,
  // the card and the keys bar. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ls-play";
  play.setAttribute("aria-label", "Leftover Stack: arrows aim the next dish (left and right a column, up and down a shelf), R turns it, Space or Enter drops it (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "ls-hud";
  hud.innerHTML = `<div class="ls-head"><p class="ls-top"><b class="ls-chip">Score <span>0</span></b><b class="ls-chip ls-n">Dish <span>1/${RUN_N}</span></b><b class="ls-chip ls-door">Door <i></i><i></i><i></i></b></p><p class="ls-hint"></p></div><p class="ls-live" aria-live="polite"></p><div class="ls-card" role="dialog" aria-label="Leftover Stack"><b>Leftover Stack</b><p>The feast is over. Fit every leftover in the fridge: aim it, turn it, drop it. Anything past the door line gets bumped, and three bumps keep the door from closing.</p><p class="ls-stats"></p><button type="button" class="bui-key ls-go">OPEN THE FRIDGE</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const scoreEl = top.children[0]!.firstElementChild as HTMLElement, dishEl = top.children[1]!.firstElementChild as HTMLElement, doors = top.children[2]!.querySelectorAll("i");
  const cardT = card.children[0] as HTMLElement, cardP = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement, go = card.children[3] as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", move: "click", turn: "click", drop: "fire", bump: "hit", full: "power", refuse: "hurt", over: "end", packed: "win" }, volume: 0.1 });
  const [muteK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: 0 },
    { label: "↻", aria: "Turn the dish (R)", id: 1 },
    { label: "DROP", aria: "Drop the dish (Space)", id: 2, c: "ls-drop" },
  ], (id, down) => {
    if (!down) return;
    if (!id) return toggle();
    if (f.S[0] !== PLAY) return void start();
    id === 1 ? act(f.turn()) : act(f.drop());
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };
  let f = fridge(1), seed = 1, auto = false, autoT = 0;

  // ---- the diorama ----
  const dio = diorama(canvas, { light: LIT.light, ambient: LIT.amb, background: () => P.bg!, overlay: drawOverlay, get shadowColor() { return P.shadow!; } });
  const keyed: DioramaObject[] = [], keyName: string[] = [], glow: DioramaObject[] = [];
  const put = (d: DioramaObjectDef & { color?: string; glow?: boolean }) => {
    const k = d.color, ob = dio.add({ ...d, color: k ? P[k] : undefined, pick: false });
    if (k) keyed.push(ob), keyName.push(k);
    if (d.glow) glow.push(ob);
    return ob;
  };
  // Per dish: its root, its world position (where it is drawn), its wobble and settle clocks.
  const roots: DioramaObject[] = [], parts: DioramaObject[][] = [];
  const WX = new Float64Array(RUN_N), WY = new Float64Array(RUN_N), WZ = new Float64Array(RUN_N), WR = new Float64Array(RUN_N), WOB = new Float64Array(RUN_N).fill(-1), LAND = new Float64Array(RUN_N).fill(-1);
  /** Where each dish is: 0 waiting, 1 on the counter, 2 in hand, 3 on a shelf. */
  const AT = new Uint8Array(RUN_N);
  const lips: DioramaObject[] = [], FULLT = new Float64Array(NS).fill(-1);
  let door: DioramaObject, panel: DioramaObject, doorA = DOOR_OPEN, doorV = 0, doorT = -1, doorTo = DOOR_OPEN, flick = 0;
  let mist: DioramaPoints;
  let handX = 0, handY = 3, handZ = 1, handR = 0;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = glow.length = roots.length = parts.length = lips.length = 0;
    const R = seeded(seed * 5 + 1);
    // Fixed ranks: the room, the fridge's body, the counter, the shelves bottom to top, the frame,
    // dishes sticking out, the dish in hand, the mist, the door.
    ["room", "body", "counter", "s0", "s1", "s2", "frame", "out", "hand", "mist", "door"].forEach((n, i) => dio.cluster(n, { fixed: i }));
    // The room: the floor, the tiled wall, a clock at a quarter to midnight.
    put({ size: [60, 0.5, 40], pos: [0, -0.5, -4], color: "floor", cluster: "room", layer: 0 });
    put({ id: "wall", size: [60, 20, 0.5], pos: [0, -0.5, -3], color: "wall", cluster: "room", layer: 0.2 });
    dio.decal("room", 0.3, wallDecal);
    put({ id: "clock", shape: "cyl", sides: 16, size: [1.3, 0.12, 1.3], pos: [-5.4, 6.6, -2.7], rot: [HALF_PI, 0, 0], color: "clock", cluster: "room", layer: 0.5 });
    dio.decal("room", 0.6, clockDecal);
    // The counter on the left: cabinets, a top, the stack of plates and a towel.
    put({ id: "cab", size: [4.6, 2.75, 2.1], pos: [-6.05, 0, -1.55], color: "cab", cluster: "counter", layer: 1 });
    for (let k = 0; k < 2; k++) {
      put({ size: [2.1, 2.2, 0.05], on: "cab", pos: [-1.1 + k * 2.2, -2.5, 1.06], color: "cabD", layer: 1.1 });
      put({ shape: "cyl", sides: 6, size: [0.12, 0.12, 0.12], on: "cab", pos: [-0.25 + k * 0.5, -1.2, 1.1], rot: [HALF_PI, 0, 0], color: "knob", layer: 1.2 });
    }
    put({ id: "ctop", size: [4.9, 0.22, 2.35], on: "cab", color: "ctop", layer: 1.3 });
    put({ id: "ctr", shape: "group", size: [0, 0, 0], on: "ctop", pos: [0.55, 0, 0.1], layer: 2 });
    for (let k = 0; k < 4; k++) put({ shape: "cyl", sides: 12, top: 1.15, size: [1.05, 0.09, 1.05], on: "ctop", pos: [-1.65, k * 0.1, -0.35], color: "plates", layer: 1.5 + k * 0.01 });
    put({ size: [0.7, 0.08, 1.1], on: "ctop", pos: [1.85, 0, 0.35], rot: [0, 0.25, 0], color: "towel", layer: 1.5 });
    // The fridge's body: the walls, the lit back panel with its light strip, the crisper drawers.
    const zb = Z0 - 0.25, zm = (zb + 0.05) / 2, dz = 0.05 - zb;
    put({ size: [6.5, FB + 0.3, dz], pos: [0, 0, zm], color: "body2", cluster: "body", layer: 0 });
    put({ size: [6.5, HF, 0.25], pos: [0, FB, zb + 0.125], color: "body2", cluster: "body", layer: 0 });
    put({ size: [6, HF - 0.6, 0.02], pos: [0, FB + 0.3, Z0 - 0.01], color: "back", glow: true, cluster: "body", layer: 0.5 });
    put({ size: [4.6, 0.16, 0.05], pos: [0, FB + 5.1, Z0 + 0.03], color: "strip", emissive: true, cluster: "body", layer: 0.6 });
    dio.decal("body", 0.55, bloom);
    for (const s of [-1, 1]) put({ size: [0.25, HF, dz], pos: [s * 3.125, FB, zm], color: s < 0 ? "body" : "inner2", cluster: "body", layer: 0.4 });
    put({ size: [6.5, 0.3, dz], pos: [0, FB + HF - 0.3, zm], color: "body", cluster: "body", layer: 0.4 });
    put({ size: [6, 0.05, 2], pos: [0, FB + 0.3, -1], color: "inner2", cluster: "body", layer: 0.7 });
    for (let k = 0; k < 2; k++) {
      const x = -1.5 + k * 3;
      put({ shape: "cyl", sides: 7, top: 0.6, size: [1.2, 0.45, 0.9], pos: [x - 0.4, FB + 0.35, -1.2], color: k ? "carrot" : "lettuce", cluster: "body", layer: 0.8 });
      put({ shape: "cyl", sides: 7, top: 0.5, size: [0.9, 0.4, 0.8], pos: [x + 0.6, FB + 0.35, -0.9], color: "lettuce", cluster: "body", layer: 0.8 });
      put({ size: [2.85, 0.62, 0.06], pos: [x, FB + 0.33, -0.02], color: "crisp", alpha: 0.72, cluster: "body", layer: 0.9 });
      put({ size: [1.2, 0.08, 0.08], pos: [x, FB + 0.76, 0.03], color: "lip", cluster: "body", layer: 0.95 });
    }
    // The shelves: glass, a white lip on the front edge (it glows gold when the shelf is full).
    for (let s = 0; s < NS; s++) {
      // The glass, and the anchor its dishes rest on (a child inherits its parent's alpha, so not the glass).
      put({ size: [6, 0.08, 2], pos: [0, YS[s]! - 0.08, -1], color: "glass", alpha: 0.3, cluster: "s" + s, layer: 1 });
      put({ id: "slab" + s, shape: "group", size: [0, 0, 0], pos: [0, YS[s]!, -1], cluster: "s" + s, layer: 1 });
      lips.push(put({ size: [6, 0.14, 0.07], on: "slab" + s, pos: [0, -0.14, 0.98], color: "lip", layer: 9 }));
      // The anchor a dish sticking out hangs on: the same place, drawn after the frame.
      put({ id: "out" + s, shape: "group", size: [0, 0, 0], pos: [0, YS[s]!, -1], cluster: "out", layer: 1 });
    }
    // The frame: the front edges of the walls and the top, over everything inside.
    for (const s of [-1, 1]) put({ size: [0.25, HF - 0.3, 0.1], pos: [s * 3.125, FB + 0.3, 0.02], color: "body", cluster: "frame", layer: 1 });
    put({ size: [6.5, 0.3, 0.1], pos: [0, FB + HF - 0.3, 0.02], color: "body", cluster: "frame", layer: 1 });
    put({ size: [6.5, 0.3, 0.1], pos: [0, FB, 0.02], color: "body2", cluster: "frame", layer: 1 });
    // The fridge's outer left side and its top again, over the dishes (they sit behind both).
    put({ size: [0.04, HF, dz], pos: [-3.23, FB, zm], mask: 8, color: "body", cluster: "frame", layer: 0.5 });
    put({ size: [6.5, 0.02, dz], pos: [0, TOPY - 0.02, zm], mask: 1, color: "body", cluster: "frame", layer: 0.5 });
    // The freezer drawer the fridge stands on: its front, a long handle, the kick plate.
    put({ size: [6.3, 0.22, 0.12], pos: [0, 0, 0.0], color: "knob", cluster: "frame", layer: 1 });
    put({ size: [6.5, FB - 0.3, 0.38], pos: [0, 0.22, 0.2], color: "body", cluster: "frame", layer: 1.2 });
    put({ shape: "cyl", sides: 8, size: [0.18, 4.2, 0.18], pos: [2.1, FB - 0.62, 0.5], rot: [0, 0, HALF_PI], color: "handle", cluster: "frame", layer: 1.3 });
    // The door, on its hinge at the right front corner: the panel, the gasket, three bins of bottles
    // on its inside, the handle and a note on its outside.
    door = put({ id: "door", shape: "group", size: [0, 0, 0], pos: [3.25, FB + 0.3, 0.225], cluster: "door", layer: 1 });
    panel = put({ id: "panel", size: [6.5, HF - 0.3, 0.35], on: "door", pos: [-3.25, 0, 0], color: "body", layer: 1 });
    put({ size: [6.0, HF - 0.8, 0.04], on: "door", pos: [-3.25, 0.25, -0.195], color: "gasket", layer: 2 });
    const BIN = [0.75, 2.35, 3.85];
    for (let b = 0; b < 3; b++) {
      const id = "bin" + b;
      put({ id, size: [5.3, 0.06, 0.62], on: "door", pos: [-3.25, BIN[b]!, -0.53], color: "bin", layer: 2.1 });
      // What lives in the door: bottles and a jug below, sauces in the middle, eggs at the top.
      if (b === 0) {
        put({ size: [0.75, 1.0, 0.5], on: id, pos: [-1.8, 0, 0], color: "b2", layer: 2.3 });
        put({ shape: "cyl", sides: 8, size: [0.22, 0.12, 0.22], on: id, pos: [-1.8, 1.0, 0], color: "b3", layer: 2.4 });
        for (let k = 0; k < 3; k++) bottle(id, -0.6 + k * 0.62, 0.62 - k * 0.08, 0.44, k & 1 ? "b0" : "b3");
        put({ size: [0.9, 0.72, 0.5], on: id, pos: [1.7, 0, 0], color: "b3", layer: 2.3 });
      } else if (b === 1) {
        for (let k = 0; k < 5; k++) bottle(id, -2 + k * 0.95, 0.4 + ((k * 7) % 3) * 0.08, 0.36, ["b1", "b0", "b3", "b2", "b1"][k]!);
      } else {
        put({ size: [3.6, 0.12, 0.5], on: id, pos: [-0.4, 0, 0], color: "b2", layer: 2.25 });
        for (let k = 0; k < 6; k++) put({ shape: "cyl", sides: 8, top: 0.6, size: [0.34, 0.36, 0.3], on: id, pos: [-2 + k * 0.6, 0.1, 0], color: "egg", layer: 2.3 });
        put({ size: [0.8, 0.3, 0.45], on: id, pos: [2.1, 0, 0], color: "butter", layer: 2.3 });
      }
      put({ size: [5.3, 0.3, 0.06], on: id, pos: [0, 0, -0.3], color: "bin", alpha: 0.55, layer: 2.6 });
    }
    put({ shape: "cyl", sides: 8, size: [0.16, 2.4, 0.16], on: "door", pos: [-6.05, 1.6, 0.32], color: "handle", layer: 0.5 });
    put({ size: [1.5, 1.8, 0.02], on: "door", pos: [-2.2, 2.8, 0.185], rot: [0, 0, 0.06], color: "note", layer: 0.6 });
    for (let k = 0; k < 3; k++) put({ shape: "cyl", sides: 8, size: [0.28, 0.08, 0.28], on: "door", pos: [-2.85 + k * 1.15, 4.45 - (k & 1) * 0.12, 0.2], rot: [HALF_PI, 0, 0], color: "mag" + k, layer: 0.7 });
    // The dishes of the night: built once, each hidden until it comes off the counter.
    for (let i = 0; i < RUN_N; i++) dish(i, f.SEQ[i]!);
    // The dish in hand hangs on this anchor (world space, the hand cluster).
    put({ id: "hand", shape: "group", size: [0, 0, 0], cluster: "hand", layer: 1 });
    mist = dio.points({ cap: FXN, cluster: "mist", layer: 1, paint: puff });
    AT.fill(0);
    WOB.fill(-1);
    LAND.fill(-1);
    FULLT.fill(-1);
  }

  /** A bottle standing in a door bin: a body, a shoulder, a neck and a cap. */
  function bottle(on: string, x: number, h: number, r: number, col: string) {
    const id = on + "b" + x;
    put({ id, shape: "cyl", sides: 8, size: [r, h, r], on, pos: [x, 0, 0], color: col, layer: 2.3 });
    put({ id: id + "s", shape: "cyl", sides: 8, top: 0.45, size: [r, r * 0.45, r], on: id, color: col, layer: 2.31 });
    put({ shape: "cyl", sides: 6, size: [r * 0.42, r * 0.36, r * 0.42], on: id + "s", color: "b2", layer: 2.32 });
  }
  /** Dish i of kind k: a root (its footprint w × d, centred; y from its bottom) and a few blocks. */
  function dish(i: number, k: number) {
    const w = KIND_W[k]! * CW, d = KIND_D[k]! * CW, h = KIND_H[k]! * LV, id = "d" + i, list: DioramaObject[] = [];
    const root = put({ id, shape: "group", size: [w, 0, d], on: "ctr", hidden: true, layer: 2 });
    const add = (o: DioramaObjectDef & { color?: string }) => (list.push(put({ on: id, ...o, hidden: true, layer: 2 + (o.layer ?? 0) })), list[list.length - 1]!);
    const half = (rx: number, rz: number, n: number) => {
      const o: number[][] = [];
      for (let j = 0; j <= n; j++) {
        const a = Math.PI * (j / n);
        o.push([Math.cos(a) * rx, -rz / 2 + Math.sin(a) * rz]);
      }
      return o;
    };
    if (k === PIE) {
      add({ shape: "prism", outline: half(0.92, 0.9, 8), taper: 0.86, size: [1, 0.16, 1], color: "tin" });
      add({ id: id + "c", shape: "prism", outline: half(0.86, 0.84, 8), size: [1, 0.22, 1], pos: [0, 0.16, 0], color: "crust", layer: 0.01 });
      add({ shape: "prism", outline: half(0.74, 0.72, 8), size: [1, 0.03, 1], pos: [0, 0.38, -0.02], color: "pump", layer: 0.02 });
      add({ shape: "cyl", sides: 7, top: 0.2, size: [0.32, 0.18, 0.32], pos: [0.15, 0.41, 0.05], color: "cream", layer: 0.03 });
    } else if (k === TRAY) {
      add({ id: id + "b", size: [1.86, 0.36, 1.8], color: "dishR" });
      for (const s of [-1, 1]) add({ size: [0.12, 0.08, 0.6], pos: [s * 0.99, 0.22, 0], color: "dishR", layer: 0.01 });
      add({ size: [1.66, 0.14, 1.6], pos: [0, 0.3, 0], color: "stuff", layer: 0.02 });
      for (let j = 0; j < 6; j++) add({ size: [0.24, 0.1, 0.24], pos: [-0.55 + (j % 3) * 0.55, 0.44, -0.4 + ((j / 3) | 0) * 0.75], rot: [0, j * 0.7, 0], color: j & 1 ? "stuff2" : "herb", layer: 0.03 });
      add({ size: [0.9, 0.04, 1.7], pos: [0.46, 0.44, 0], rot: [0, 0, -0.08], color: "foil", alpha: 0.95, layer: 0.04 });
    } else if (k === JAR) {
      add({ shape: "cyl", sides: 10, size: [0.66, 0.78, 0.66], color: "gravy" });
      add({ shape: "cyl", sides: 10, size: [0.7, 0.3, 0.7], pos: [0, 0.22, 0], color: "label", layer: 0.01 });
      add({ shape: "cyl", sides: 10, top: 0.85, size: [0.5, 0.08, 0.5], pos: [0, 0.78, 0], color: "gravy", layer: 0.02 });
      add({ shape: "cyl", sides: 10, size: [0.58, 0.18, 0.58], pos: [0, 0.86, 0], color: "lid", layer: 0.03 });
    } else if (k === TURKEY) {
      add({ shape: "cyl", sides: 14, size: [2.9, 0.08, 1.86], color: "plate" });
      add({ id: id + "t", shape: "cyl", sides: 9, top: 0.55, size: [2.0, 0.42, 1.4], pos: [0.1, 0.08, 0], color: "foil", layer: 0.01 });
      add({ shape: "cyl", sides: 7, top: 0.4, size: [1.1, 0.14, 0.8], pos: [0.1, 0.5, 0], color: "foil2", layer: 0.02 });
      for (const s of [-1, 1]) add({ shape: "cyl", sides: 6, top: 0.5, size: [0.36, 0.62, 0.36], pos: [-0.95, 0.2, s * 0.38], rot: [0, 0, HALF_PI + 0.3], color: "foil2", layer: 0.015 });
    } else if (k === TUB) {
      add({ shape: "cyl", sides: 10, top: 1.1, size: [0.7, 0.4, 0.7], color: "cran" });
      add({ shape: "cyl", sides: 10, size: [0.8, 0.08, 0.8], pos: [0, 0.4, 0], color: "tubL", alpha: 0.9, layer: 0.01 });
      add({ size: [0.16, 0.06, 0.12], pos: [0.38, 0.42, 0], color: "tubL", layer: 0.02 });
    } else if (k === CASS) {
      add({ shape: "cyl", sides: 12, top: 1.08, size: [2.7, 0.34, 0.88], color: "cdish" });
      for (const s of [-1, 1]) add({ size: [0.24, 0.08, 0.4], pos: [s * 1.42, 0.24, 0], color: "cdish", layer: 0.01 });
      add({ shape: "cyl", sides: 12, size: [2.55, 0.06, 0.76], pos: [0, 0.34, 0], color: "bean", layer: 0.02 });
      for (let j = 0; j < 7; j++) add({ size: [0.2, 0.06, 0.13], pos: [-1 + j * 0.33, 0.4, ((j * 5) % 3 - 1) * 0.18], rot: [0, j * 1.3, 0], color: "onion", layer: 0.03 });
    } else if (k === ROLLS) {
      add({ shape: "cyl", sides: 8, size: [0.86, 0.06, 0.86], rot: [0, 0.4, 0], color: "napkin" });
      for (let j = 0; j < 3; j++) add({ shape: "cyl", sides: 9, top: 0.72, size: [0.72 - j * 0.04, 0.3, 0.66 - j * 0.04], pos: [(j & 1) * 0.06 - 0.03, 0.06 + j * 0.32, 0], rot: [0, j * 0.9, 0], color: j & 1 ? "roll2" : "roll", layer: 0.01 + j * 0.01 });
    } else if (k === MASH) {
      add({ shape: "cyl", sides: 12, top: 1.3, size: [1.45, 0.72, 1.45], color: "bowl" });
      add({ shape: "cyl", sides: 12, top: 0.35, size: [1.7, 0.3, 1.7], pos: [0, 0.72, 0], color: "mash", layer: 0.01 });
      add({ size: [0.3, 0.08, 0.24], pos: [0.05, 0.98, 0.02], rot: [0, 0.5, 0], color: "butter", layer: 0.02 });
    }
    roots[i] = root;
    parts[i] = list;
    return h;
  }

  // ---- painters ----
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // Mist: x y z, vx vy vz, life, max.
  const fx = new Float32Array(FXN * FS), FX_OF = new Int32Array(FXN);
  const puff = (ctx: CanvasRenderingContext2D, j: number, p: DioramaPoints) => {
    // Soft: three discs, wide and faint to small and less faint.
    const r = Math.max(1.5, p.sr[j]!), a = p.a[j]!;
    ctx.fillStyle = P === DARK ? "#dfe9f6" : "#ffffff";
    for (let q = 3; q > 0; q--) (ctx.globalAlpha = a * (0.45 - q * 0.1)), ctx.beginPath(), ctx.ellipse(p.sx[j]!, p.sy[j]!, r * q * 0.45, r * q * 0.3, 0, 0, TAU), ctx.fill();
    ctx.globalAlpha = 1;
  };
  let rnd = seeded(1);
  function spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! > 0) continue;
      (fx[o] = x), (fx[o + 1] = y), (fx[o + 2] = z), (fx[o + 3] = vx), (fx[o + 4] = vy), (fx[o + 5] = vz), (fx[o + 6] = fx[o + 7] = life);
      return;
    }
  }
  /** Cold air rolling out along the shelves' fronts and over the floor (n puffs). */
  function mistOut(n: number, y0: number, spread: number) {
    for (let i = 0; i < n; i++) spawn((rnd() - 0.5) * spread, y0 + rnd() * 0.3, 0.2 + rnd() * 0.3, (rnd() - 0.5) * 0.8, -0.4 - rnd() * 0.5, 0.6 + rnd() * 0.9, 1.2 + rnd() * 1.2);
  }
  function stepFx(dt: number) {
    let on = false;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! <= 0) continue;
      on = true;
      fx[o + 6] = fx[o + 6]! - dt;
      // Cold air sinks and spreads along the floor.
      fx[o + 4] = fx[o + 4]! - 0.6 * dt;
      (fx[o + 3] = fx[o + 3]! * 0.985), (fx[o + 5] = fx[o + 5]! * 0.985);
      (fx[o] = fx[o]! + fx[o + 3]! * dt), (fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt), (fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt);
      if (fx[o + 1]! < 0.15) (fx[o + 1] = 0.15), (fx[o + 4] = 0), (fx[o + 3] = fx[o + 3]! * 1.02), (fx[o + 5] = fx[o + 5]! + dt * 0.4);
    }
    return on;
  }
  function fxPoints() {
    const p = mist;
    p.n = 0;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS, l = fx[o + 6]!;
      if (l <= 0) continue;
      const j = p.n++, u = l / fx[o + 7]!;
      FX_OF[j] = k;
      (p.x[j] = fx[o]!), (p.y[j] = fx[o + 1]!), (p.z[j] = fx[o + 2]!);
      p.r[j] = 0.22 + (1 - u) * 0.6;
      p.a[j] = Math.min(1, (1 - u) * 6) * u * (P === DARK ? 0.8 : 1);
    }
  }

  // ---- the wall, the clock, the ghost, the glow, the toasts ----
  function quadY(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, z: number) {
    dio.project(x0, y0, z, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y0, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y1, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x0, y1, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.closePath();
  }
  /** The light inside: a soft bloom on the back panel under the strip (behind the shelves). */
  function bloom(ctx: CanvasRenderingContext2D) {
    if (doorA < 0.3 || !dio.project(0, FB + 4.6, Z0 + 0.02, tmp)) return;
    const r = (2.4 * dio.focal()) / tmp[2]!, a = (P === DARK ? 0.12 : 0.07) * (flick > 0 ? 0.3 + 0.7 * Math.abs(Math.sin(flick * 40)) : 1), x = tmp[0]!, y = tmp[1]!;
    // Only on the back panel.
    ctx.save();
    ctx.beginPath();
    quadY(ctx, X0, FB + 0.3, -X0, TOPY - 0.3, Z0);
    ctx.clip();
    ctx.fillStyle = "#fff3c4";
    for (let i = 3; i > 0; i--) (ctx.globalAlpha = a * (4 - i)), ctx.beginPath(), ctx.ellipse(x, y, r * i * 0.55, r * i * 0.4, 0, 0, TAU), ctx.fill();
    ctx.restore();
  }
  function wallDecal(ctx: CanvasRenderingContext2D) {
    // A band of tiles behind the counter, a rail of hooks.
    ctx.fillStyle = P.wall2!;
    ctx.beginPath();
    quadY(ctx, -30, 2.75, -3.4, 4.6, -2.74);
    ctx.fill();
    ctx.strokeStyle = P.tile!;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 3.1; y < 4.6; y += 0.36) dio.project(-12, y, -2.74, tmp), ctx.moveTo(tmp[0]!, tmp[1]!), dio.project(-3.4, y, -2.74, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    for (let x = -11.6; x < -3.4; x += 0.36) dio.project(x, 2.75, -2.74, tmp), ctx.moveTo(tmp[0]!, tmp[1]!), dio.project(x, 4.6, -2.74, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.stroke();
  }
  function clockDecal(ctx: CanvasRenderingContext2D) {
    if (!dio.project(-5.4, 6.6, -2.57, tmp)) return;
    const k = dio.focal() / tmp[2]!, x = tmp[0]!, y = tmp[1]!;
    ctx.strokeStyle = "#1f2433";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, k * 0.07);
    ctx.beginPath();
    // 11:48: the hour hand nearly at twelve, the minute hand at the 48.
    const hA = ((11 + 48 / 60) / 12) * TAU, mA = (48 / 60) * TAU;
    ctx.moveTo(x, y), ctx.lineTo(x + Math.sin(hA) * k * 0.3, y - Math.cos(hA) * k * 0.3);
    ctx.moveTo(x, y), ctx.lineTo(x + Math.sin(mA) * k * 0.46, y - Math.cos(mA) * k * 0.46);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, k * 0.04);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.moveTo(x + Math.sin(a) * k * 0.5, y - Math.cos(a) * k * 0.5), ctx.lineTo(x + Math.sin(a) * k * 0.56, y - Math.cos(a) * k * 0.56);
    }
    ctx.stroke();
  }
  const FONT = "ui-rounded, \"SF Pro Rounded\", Nunito, system-ui, sans-serif", FONTS: string[] = [];
  const font = (px: number) => FONTS[px] || (FONTS[px] = `800 ${px}px ${FONT}`);
  function sticker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, bg: string, fg: string) {
    ctx.font = font(px);
    const w = ctx.measureText(text).width + px, h = px + 10, lx = x - w / 2, ly = y - h / 2;
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
  const DASH = [5, 4], SOLID: number[] = [];
  // The ghost box's corners (x, y, z) and its edges.
  const GS = new Float64Array(16), EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  let toastT = 0, toastS = "", toastK = 0, said = "", hudDirty = true, dirty = true, tAmb = 0;
  const TOAST = ["#fffaf1", "#ffd36b", "#e5484d", "#7fcfa8"];
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const S = f.S;
    // The ghost: where the dish in hand goes (green), sticking out (orange), or no room (red).
    if (S[0] === PLAY && AT[S[2]!] === 2 && !auto) {
      const k = S[3]!, r = S[4]!, s = S[5]!, c = S[6]!, ok = f.fit(k, r, s, c), z0 = f.F[1]!, rest = f.F[2]!, out = f.F[3]!;
      const w = f.w(k, r), d = f.d(k, r), h = KIND_H[k]!, x0 = X0 + c, x1 = x0 + w, za = ok ? Z0 + z0 : Z0, zb = za + (ok ? d : Math.min(d, DEPTH)), y0 = YS[s]! + (ok ? rest : 0) * LV, y1 = y0 + h * LV;
      // Corners in ring order: 0 (x0 za) 1 (x1 za) 2 (x1 zb) 3 (x0 zb), top ring the same.
      for (let q = 0; q < 8; q++) {
        const ring = q & 3, top = q >> 2;
        dio.project(ring === 1 || ring === 2 ? x1 : x0, top ? y1 : y0, ring < 2 ? za : zb, tmp);
        (GS[q * 2] = tmp[0]!), (GS[q * 2 + 1] = tmp[1]!);
      }
      const col = !ok ? "#e5484d" : out ? "#f2a541" : "#7fcfa8";
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(GS[8]!, GS[9]!), ctx.lineTo(GS[10]!, GS[11]!), ctx.lineTo(GS[12]!, GS[13]!), ctx.lineTo(GS[14]!, GS[15]!);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash(DASH);
      ctx.beginPath();
      for (let e = 0; e < 24; e += 2) ctx.moveTo(GS[EDGES[e]! * 2]!, GS[EDGES[e]! * 2 + 1]!), ctx.lineTo(GS[EDGES[e + 1]! * 2]!, GS[EDGES[e + 1]! * 2 + 1]!);
      ctx.stroke();
      ctx.setLineDash(SOLID);
      // The door line on that shelf, when the dish would cross it.
      if (ok && out && dio.project(X0, YS[s]! + 0.02, 0.06, tmp) && dio.project(-X0, YS[s]! + 0.02, 0.06, tmp2)) {
        ctx.strokeStyle = "#f2a541";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tmp[0]!, tmp[1]!), ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
      }
    }
    // A shelf that just filled: a gold flash along its lip.
    for (let s = 0; s < NS; s++) {
      const t = FULLT[s]!;
      if (t < 0 || !dio.project(X0, YS[s]! - 0.04, 0.05, tmp) || !dio.project(-X0, YS[s]! - 0.04, 0.05, tmp2)) continue;
      ctx.strokeStyle = "#ffd36b";
      ctx.globalAlpha = Math.max(0, 1 - t / 1.2) * 0.8;
      ctx.lineWidth = 10 * (1 - t / 1.4) + 2;
      ctx.beginPath();
      ctx.moveTo(tmp[0]!, tmp[1]!), ctx.lineTo(tmp2[0]!, tmp2[1]!);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const W = dio.width;
    // On the counter: what comes next.
    const nx = S[2]! + 1;
    if (S[0] === PLAY && nx < RUN_N && AT[nx] === 1 && dio.project(-5.5, 4.7, -1.2, tmp)) sticker(ctx, "NEXT", tmp[0]!, tmp[1]!, 11, "#fffaf1", "#1f2433");
    if (S[0] === PACKED && doorA < 0.08 && dio.project(0.95, 3.5, 0.45, tmp)) sticker(ctx, "GOOD NIGHT", tmp[0]!, tmp[1]!, Math.max(12, Math.min(18, Math.round(W / 40))), "#ffd36b", "#1f2433");
    if (toastT > 0) {
      const u = 1 - toastT / 1.2, s = u < 0.16 ? 0.6 + (u / 0.16) * 0.48 : u < 0.28 ? 1.08 - ((u - 0.16) / 0.12) * 0.08 : 1;
      const px = Math.round(Math.max(17, Math.min(28, W / 26)));
      ctx.save();
      ctx.globalAlpha = u < 0.16 ? u / 0.16 : u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.translate(W / 2, V[3]! + (dio.height - V[3]! - V[4]!) * 0.12 - (u > 0.8 ? (u - 0.8) * 50 : 0));
      ctx.scale(s, s);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, toastK === 2 ? "#ffffff" : "#1f2433");
      ctx.restore();
    }
  }
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = 1.2);
    say(text);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the camera: framed once for the shape; it drifts with the dish you aim ----
  const FIT = new Float64Array(30);
  let baseYaw = -0.3, basePitch = 0.24;
  function frame() {
    const port = dio.width / dio.height < 1.1, c = dio.cam;
    (baseYaw = port ? -0.2 : -0.32), (basePitch = port ? 0.2 : 0.24);
    (c.yaw = baseYaw), (c.pitch = basePitch), (c.fov = 0.6), (c.tx = port ? 0.4 : -0.6), (c.ty = FB + 2.9), (c.tz = -1);
    // The fridge, its open door, and (wide) the counter with the next dish on it.
    const xl = port ? -3.5 : -7.4, xr = port ? 4.4 : 7.6;
    const yb = FB - 0.7;
    FIT.set([xl, yb, 0.6, xl, FB + 4.2, -0.5, -3.3, TOPY, 0.1, 3.3, TOPY, 0.1, xr, TOPY, 4, xr, yb, 4.5, -3.3, yb, 1.2, 3.3, yb, 1.6, 0, TOPY + 0.4, -2, 0, yb, 2.4]);
    dio.fit(c, FIT, { x0: 6, x1: dio.width - 6, y0: V[3]!, y1: Math.max(V[3]! + 80, dio.height - V[4]!) });
  }
  function follow(dt: number) {
    const c = dio.cam, k = dt ? 1 - Math.exp(-dt * 3) : 1, S = f.S;
    const aim = S[0] === PLAY ? (X0 + S[6]! + f.w(S[3]!, S[4]!) / 2) * 0.022 : 0, lift = S[0] === PLAY ? (1 - S[5]!) * 0.025 : 0;
    c.yaw += (baseYaw + aim - c.yaw) * k;
    c.pitch += (basePitch + lift - c.pitch) * k;
    return Math.abs(baseYaw + aim - c.yaw) + Math.abs(basePitch + lift - c.pitch) > 0.0005;
  }

  // ---- placing the dishes ----
  /** The world centre of a dish's footprint: kind k, turned r, at shelf s, column c, row z0, rest. */
  function worldOf(i: number, k: number, r: number, s: number, c: number, z0: number, rest: number) {
    (WX[i] = X0 + c + f.w(k, r) / 2), (WZ[i] = Z0 + z0 + f.d(k, r) / 2), (WY[i] = YS[s]! + rest * LV), (WR[i] = r ? HALF_PI : 0);
  }
  /** Rest dish i on what is under it (a dish or the shelf; a dish sticking out hangs on the `out` anchor). */
  function land(i: number) {
    const u = f.PU[i]!, s = f.PS[i]!, ob = roots[i]!;
    if (u >= 0) {
      // In its parent's frame: the offset turned back by the parent's turn.
      const th = WR[u]!, dx = WX[i]! - WX[u]!, dz = WZ[i]! - WZ[u]!, cs = Math.cos(th), sn = Math.sin(th);
      dio.on(ob, "d" + u);
      (ob.pos[0] = cs * dx - sn * dz), (ob.pos[1] = WY[i]! - WY[u]!), (ob.pos[2] = sn * dx + cs * dz), (ob.rot[1] = WR[i]! - th);
    } else {
      dio.on(ob, f.PO[i] ? "out" + s : "slab" + s);
      (ob.pos[0] = WX[i]!), (ob.pos[1] = WY[i]! - YS[s]!), (ob.pos[2] = WZ[i]! + 1), (ob.rot[1] = WR[i]!);
    }
    (ob.rot[0] = 0), (ob.rot[2] = 0);
    layer(i, 2 + f.PY[i]!);
    AT[i] = 3;
    LAND[i] = 0;
  }
  /** Dish i and its parts drawn at layer l in their cluster (a stacked dish after the one under it). */
  function layer(i: number, l: number) {
    const ob = roots[i]!, d = l - ob.layer;
    ob.layer = l;
    for (const p of parts[i]!) p.layer += d;
  }
  /** Dish i onto the counter (it pops up there). */
  function toCounter(i: number) {
    if (i >= RUN_N) return;
    const ob = roots[i]!;
    dio.on(ob, "ctr");
    ob.pos.fill(0);
    (ob.rot[0] = ob.rot[2] = 0), (ob.rot[1] = 0.25);
    ob.hidden = false;
    for (const p of parts[i]!) p.hidden = false;
    AT[i] = 1;
    LAND[i] = 0;
  }
  /** Dish i into your hand: it lifts off the counter and floats to the fridge. */
  function toHand(i: number) {
    if (i >= RUN_N) return;
    const ob = roots[i]!;
    // It lifts off the counter (the counter's top, in the world) and floats over.
    (handX = -5.5), (handY = 3.1), (handZ = -1.45), (handR = 0.25);
    dio.on(ob, "hand");
    ob.rot.fill(0);
    (ob.pos[0] = handX), (ob.pos[1] = handY), (ob.pos[2] = handZ), (ob.rot[1] = handR);
    layer(i, 2);
    AT[i] = 2;
  }
  /** The dish in hand floats in front of where it would go, just outside the door line. */
  function stepHand(dt: number) {
    const S = f.S, i = S[2]!;
    if (S[0] !== PLAY || AT[i] !== 2) return false;
    const k = S[3]!, r = S[4]!, s = S[5]!, c = S[6]!, ok = f.fit(k, r, s, c);
    const tx = X0 + c + f.w(k, r) / 2, ty = YS[s]! + (ok ? f.F[2]! : CLEAR[s]! - KIND_H[k]!) * LV + 0.12, tz = 0.25 + f.d(k, r) / 2, tr = r ? HALF_PI : 0;
    const e = 1 - Math.exp(-dt * 14), ob = roots[i]!;
    handX += (tx - handX) * e;
    handY += (ty - handY) * e;
    handZ += (tz - handZ) * e;
    handR += (tr - handR) * e;
    const bob = RM ? 0 : Math.sin(tAmb * 3) * 0.03;
    (ob.pos[0] = handX), (ob.pos[1] = handY + bob), (ob.pos[2] = handZ), (ob.rot[1] = handR);
    ob.rot[2] = (tx - handX) * -0.08;
    return Math.abs(tx - handX) + Math.abs(ty - handY) + Math.abs(tz - handZ) + Math.abs(tr - handR) > 0.002;
  }
  /** The dishes' little motions: landing (a squash and settle), wobbles, the full-shelf bounce. */
  function stepDishes(dt: number) {
    let on = false;
    for (let i = 0; i < RUN_N; i++) {
      const ob = roots[i]!;
      if (LAND[i]! >= 0) {
        const t = (LAND[i] = LAND[i]! + dt);
        if (AT[i] === 1) ob.pos[1] = Math.max(0, Math.sin(Math.min(1, t / 0.35) * Math.PI) * 0.5 * (1 - t / 0.35));
        else if (AT[i] === 3) ob.rot[0] = Math.sin(t * 22) * 0.05 * Math.exp(-t * 9);
        if (t > 0.5) (LAND[i] = -1), AT[i] === 3 && (ob.rot[0] = 0);
        on = true;
      }
      if (WOB[i]! >= 0) {
        const t = (WOB[i] = WOB[i]! + dt);
        ob.rot[2] = Math.sin(t * 15) * 0.16 * Math.exp(-t * 2.2);
        ob.rot[0] = Math.sin(t * 11 + 1) * 0.08 * Math.exp(-t * 2.2);
        if (t > 2.6) (WOB[i] = -1), (ob.rot[0] = ob.rot[2] = 0);
        on = true;
      }
    }
    for (let s = 0; s < NS; s++) {
      if (FULLT[s]! < 0) continue;
      const t = (FULLT[s] = FULLT[s]! + dt), dy = -Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.08;
      for (let i = 0; i < RUN_N; i++) if (AT[i] === 3 && f.PS[i] === s && f.PU[i]! < 0) roots[i]!.pos[1] = WY[i]! - YS[s]! + dy;
      if (t > 1.4) FULLT[s] = -1;
      on = true;
    }
    return on;
  }
  /** The door: swing toward a target on a spring; a bump swing goes in to where it hits and back. */
  function stepDoor(dt: number) {
    if (doorT >= 0) {
      doorT += dt;
      if (doorT > 0.55) (doorT = -1), (doorTo = f.S[0] === OVER ? DOOR_OPEN * 0.7 : DOOR_OPEN);
    }
    const want = doorT >= 0 ? hitA : doorTo, acc = (want - doorA) * (doorT >= 0 ? 90 : 26) - doorV * (doorT >= 0 ? 9 : 7);
    doorV += acc * dt;
    doorA += doorV * dt;
    // It stops dead on the dish it bumps.
    if (doorT >= 0 && doorA < hitA) {
      doorA = hitA;
      if (doorV < -0.5) thunk();
      doorV = Math.abs(doorV) * 0.25;
    }
    if (doorA < 0) (doorA = 0), (doorV = 0);
    door.rot[1] = doorA;
    // Inside faces the camera while the door is open: its bins draw over the panel; shut, the panel over them.
    panel.layer = doorA > 0.25 ? 1 : 6;
    if (flick > 0) flick = Math.max(0, flick - dt);
    return Math.abs(want - doorA) > 0.002 || Math.abs(doorV) > 0.01 || flick > 0;
  }
  let hitA = 0.4, bumped = -1;
  /** The door swings in at the dish that sticks out (i). */
  function bump(i: number) {
    bumped = i;
    // The angle where the door's bins meet the dish's front corner (from the hinge).
    const k = f.PK[i]!, r = f.PR[i]!, xr = X0 + f.PC[i]! + f.w(k, r), fz = Z0 + f.PZ[i]! + f.d(k, r);
    const dx = xr - 3.25, dz = fz - 0.225, l = Math.hypot(dx, dz);
    hitA = Math.max(0.14, Math.min(DOOR_OPEN - 0.45, Math.atan2(dz, -dx) + Math.asin(Math.min(0.9, 0.8 / l))));
    doorT = 0;
    doorV = -9;
  }
  function thunk() {
    if (bumped < 0) return;
    engine.events.emit("bump");
    // The dish and everything resting on it wobble; cold air puffs out.
    for (let i = 0; i < RUN_N; i++) if (AT[i] === 3 && (i === bumped || above(i, bumped))) WOB[i] = 0;
    if (!RM) mistOut(16, YS[f.PS[bumped]!]!, 6);
    if (f.S[0] === OVER) flick = 0.8;
    bumped = -1;
  }
  const above = (i: number, j: number): boolean => {
    for (let u = f.PU[i]!, n = 0; u >= 0 && n < RUN_N; u = f.PU[u]!, n++) if (u === j) return true;
    return false;
  };

  // ---- the frame ----
  let aliveT = 0, later = 0;
  function alive() {
    aliveT = Math.max(aliveT, engine.time + ALIVE);
    engine.busy(ALIVE);
    engine.wake();
  }
  function reset(s: number, run: boolean) {
    seed = s >>> 0;
    f = fridge(seed);
    rnd = seeded(seed * 17 + 5);
    fx.fill(0);
    toastT = later = 0;
    doorA = DOOR_OPEN;
    doorV = 0;
    doorT = -1;
    doorTo = DOOR_OPEN;
    flick = 0;
    buildScene();
    toCounter(0);
    card.hidden = run;
    card.classList.toggle("ls-start", !run);
    if (!run) {
      cardT.textContent = "Leftover Stack";
      cardP.hidden = false;
      cardS.textContent = "";
      go.textContent = "OPEN THE FRIDGE";
    }
    V[0] = 1;
    hudDirty = dirty = true;
    alive();
  }
  function start() {
    const m = f.S[0]!;
    if (m === PLAY) return;
    if (m === OVER || m === PACKED) reset(seed + 1, true);
    f.start();
    onEvents();
    card.hidden = true;
    play.focus({ preventScroll: true });
    alive();
  }
  /** What the last model call did: sounds, toasts, the dishes moving along. */
  function onEvents() {
    const ev = f.ev, S = f.S, e = engine.events;
    if (ev[EV_START]) {
      e.emit("start");
      toast("Fit it all in!", 3);
      toHand(0);
      toCounter(1);
      if (!RM) mistOut(26, FB + 0.4, 6);
    }
    if (ev[EV_MOVE]) e.emit("move");
    if (ev[EV_TURN]) e.emit("turn");
    if (ev[EV_REFUSE]) e.emit("refuse"), toast("Won't fit there", 2);
    if (ev[EV_DROP]) {
      const i = S[2]! - 1;
      e.emit("drop");
      worldOf(i, f.PK[i]!, f.PR[i]!, f.PS[i]!, f.PC[i]!, f.PZ[i]!, f.PY[i]!);
      land(i);
      if (!RM) mistOut(5, YS[f.PS[i]!]!, 2);
      if (ev[EV_BUMP]) bump(i), toast(S[7]! < 3 ? (S[7]! < 2 ? "BUMP! It sticks out" : "BUMP! One more…") : "BUMP!", S[7]! < 2 ? 1 : 2);
      if (ev[EV_FULL]) {
        e.emit("full");
        for (let s = 0; s < NS; s++) if ((S[9]! >> s) & 1 && FULLT[s]! < 0 && lips[s]!.color !== P.lipFull) (FULLT[s] = 0), (lips[s]!.color = P.lipFull!), (keyName[keyed.indexOf(lips[s]!)] = "lipFull");
        if (!ev[EV_BUMP]) toast("SHELF FULL! +150", 3);
      }
      if (S[0] === PLAY) toHand(S[2]!), toCounter(S[2]! + 1);
    }
    if (ev[EV_OVER]) {
      e.emit("over");
      later = S[1] === WHY_ROOM ? 1.1 : 1.7;
      if (S[1] === WHY_ROOM) toast(`No room for the ${NAMES[S[3]!]}!`, 2), (flick = 0.6);
    }
    if (ev[EV_PACKED]) e.emit("packed"), (later = 1.6), (doorTo = 0), toast(S[7] ? "ALL PACKED!" : "PERFECT PACK!", 3);
    hudDirty = dirty = true;
    alive();
  }
  function act(changed: boolean) {
    void changed;
    onEvents();
  }
  function showEnd() {
    const S = f.S, packed = S[0] === PACKED;
    cardT.textContent = packed ? (S[7] ? "All packed!" : "Perfect pack!") : "THE FRIDGE WINS";
    cardP.hidden = true;
    const full = ((S[9]! & 1) + ((S[9]! >> 1) & 1) + ((S[9]! >> 2) & 1)) | 0;
    cardS.textContent = `${packed ? "Every dish in" : S[1] === WHY_ROOM ? `No room for the ${NAMES[S[3]!]}` : "The door won't close"} · Dishes ${S[2]}/${RUN_N} · Full shelves ${full} · Score ${S[8]}`;
    go.textContent = "PLAY AGAIN";
    card.classList.remove("ls-start");
    card.hidden = false;
    say(`${cardT.textContent} Score ${S[8]}.`);
    go.focus({ preventScroll: true });
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (next !== P) {
          P = next;
          const l = P === DARK ? NIGHT : LIT;
          dio.setLight(l.light, l.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!]!;
          for (const g of glow) g.emissive = P === DARK;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = muteK!.parentElement!.lastElementChild!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        frame();
        follow(0);
        dirty = true;
      }
      if (first) (first = null), start();
    },
    step(e, dt) {
      tAmb += dt;
      const S = f.S;
      if (auto && S[0] === PLAY && AT[S[2]!] === 2 && (autoT += dt) > 0.42) (autoT = 0), autopilot(f), f.drop(), onEvents();
      let moving = false;
      if (stepHand(dt)) moving = true;
      if (stepDishes(dt)) moving = true;
      if (stepDoor(dt)) moving = true;
      if (stepFx(dt)) moving = true;
      if (follow(dt)) moving = true;
      if (later > 0 && (later -= dt) <= 0) showEnd(), (hudDirty = true);
      if (later > 0) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving || e.time < aliveT) dirty = true;
      if (moving) e.busy();
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fxPoints(), dio.draw();
    },
  });
  // ---- the HUD (DOM writes in render, change-only) ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const S = f.S, mode = S[0]!, b = S[7]!;
    if (set(0, S[8]!)) scoreEl.textContent = "" + S[8];
    const n = Math.min(RUN_N, S[2]! + (mode === PLAY ? 1 : 0));
    if (set(1, n)) dishEl.textContent = Math.max(1, n) + "/" + RUN_N;
    for (let i = 0; i < 3; i++) if (set(2 + i, i < 3 - b)) doors[i]!.classList.toggle("ls-out", i >= 3 - b);
    const hint = mode === PLAY ? (coarse ? `Drag to aim the ${NAMES[S[3]!]}; let go to drop. ↻ turns it.` : `${CAPS[S[3]!]}: ← → ↑ ↓ or drag to aim, R turns, Space drops.`) : "";
    if (set(5, hint)) hintEl.textContent = hint;
    if (set(6, said)) live.textContent = said;
  }

  // ---- input ----
  /** The shelf and column under the pointer: the nearest cell front (projected), centred on the dish. */
  function aimAt(x: number, y: number) {
    const S = f.S;
    let best = Infinity, bs = 0, bc = 0;
    for (let s = 0; s < NS; s++)
      for (let c = 0; c < COLS; c++) {
        if (!dio.project(X0 + c + 0.5, YS[s]! + 0.45, 0.1, tmp)) continue;
        const d = (tmp[0]! - x) ** 2 + (tmp[1]! - y) ** 2 * 1.6;
        if (d < best) (best = d), (bs = s), (bc = c);
      }
    const w = f.w(S[3]!, S[4]!);
    f.moveTo(bs, Math.max(0, Math.min(COLS - w, bc - ((w - 1) >> 1))));
    if (f.ev[EV_MOVE]) onEvents();
  }
  let dragging = false;
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (f.S[0] !== PLAY) return void (f.S[0] === IDLE && start());
    play.setPointerCapture?.(e.pointerId);
    dragging = true;
    aimAt(e.offsetX, e.offsetY);
  }, sig);
  play.addEventListener("pointermove", (e) => dragging && e.isPrimary && aimAt(e.offsetX, e.offsetY), sig);
  play.addEventListener("pointerup", (e) => {
    if (!dragging || !e.isPrimary) return;
    dragging = false;
    if (f.S[0] === PLAY && AT[f.S[2]!] === 2) act(f.drop());
  }, sig);
  for (const t of ["pointercancel", "lostpointercapture"]) play.addEventListener(t, () => (dragging = false), sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code, playing = f.S[0] === PLAY;
    if (c === "KeyM") return void (e.preventDefault(), toggle());
    if ((c === "Space" || c === "Enter") && (e.target as Element).closest?.(".gk-bar, .ls-card")) return;
    if (c === "Space" || c === "Enter") playing ? !e.repeat && act(f.drop()) : !e.repeat && start();
    else if (!playing) return;
    else if (c === "ArrowLeft" || c === "KeyA") act(f.move(-1, 0));
    else if (c === "ArrowRight" || c === "KeyD") act(f.move(1, 0));
    else if (c === "ArrowUp" || c === "KeyW") act(f.move(0, 1));
    else if (c === "ArrowDown" || c === "KeyS") act(f.move(0, -1));
    else if (c === "KeyR") !e.repeat && act(f.turn());
    else return;
    e.preventDefault();
  }, sig);
  go.addEventListener("click", () => start(), sig);

  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset.
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** The poster (scripts/gallery-posters.mjs): the autopilot's night, about half packed. */
  function poster() {
    V[2] = 0.6;
    reset(20261124, true);
    auto = true;
    start();
  }

  reset((engine.random() * 100000) | 0, false);
  engine.start();
  return {
    engine,
    accessible: true,
    get f() {
      return f;
    },
    get state() {
      const S = f.S;
      return { mode: S[0]!, idx: S[2]!, bumps: S[7]!, score: S[8]!, card: !card.hidden, door: doorA, shelf: S[5]!, col: S[6]! };
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the autopilot's night, about half packed (scripts/gallery-posters.mjs). */
export const posterAt = 3.4;
