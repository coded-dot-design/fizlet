// "Table for Twelve" (hero, diorama): the long dinner table, seen from above at an angle. Twelve
// guests sit six a side on spindle-back chairs (low-poly figures, each their own shirt, hair and
// colouring), with plates, glasses and cutlery at every place; down the middle a runner, four tall
// candles, gourds and leaves, and the big roast on its platter. The dishes come out of the kitchen
// at the end of the table, steaming; the guest who wants one thinks of it (a bubble over their head,
// a ring round it that runs down as it cools). Pass the dish you hold along the table, seat to seat:
// tap the place next to it (or drag it along), or the arrows (Enter passes it on again, N holds the
// next dish). It slides over; the guest it passes hands it on. It reaches its guest hot: a cheer and
// points (the hotter, the more; a streak adds on). Cold (the steam gone): a grumble. Four courses,
// each quicker than the last; from the third the table passes both ways and the pantry door at the
// far end opens too. When the last dish is down: DINNER IS SERVED, and all twelve raise a glass.
// Dark is the room by candlelight; light, the room by day.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D: shapes resting `on` each other, clusters for the
// guests and dishes in the depth sort, the steam as points, the camera), @fzlt/core/slot,
// @fzlt/core/sound. The dinner is ./model.ts, pure and seeded (tests/table-for-twelve.test.mjs);
// this file is the scene and the controls (tests/table-for-twelve.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import {
  BEANS, BOTH, BREAK, COURSE, COURSES, CRAN, DIR, DONE, D_TABLE, EV_CHILL, EV_COLD, EV_COURSE, EV_DONE, EV_HOT, EV_PASS, EV_REFUSE, EV_SELECT, EV_SPAWN,
  EV_START, EV_TWIST, FOOT, GRAVY, HEAD, HOT, IDLE, LDISH, LPASS, LPTS, LSEAT, MASH, MODE, NAMES, NN, NODE_SEAT, NSEAT, PLAY, ROLLS, RUN_N, SCORE, SEAT_NODE,
  SEL, SERVED, STREAK, YAMS, autopilot, hopsOn, table, BEST, COLD,
} from "./model";

const TAU = 6.283185307179586, HALF_PI = Math.PI / 2;
const LIGHT: Record<string, string> = {
  bg: "#e9dccb", floor: "#c79a6a", floor2: "#b88a5c", wall: "#efe3cf", wall2: "#e2d2b8", trim: "#fbf4e6", rug: "#a8434a", rug2: "#8f3940", sky: "#bfe0ee", sky2: "#fbe6c4", frame: "#fbf4e6",
  door: "#8a5a3c", doorL: "#ffe2a6", cloth: "#fbf6ec", cloth2: "#eee5d4", runner: "#d9963a", wood: "#8a5a3c", wood2: "#6f4730", chair: "#7a4e33", chair2: "#5f3c27",
  plate: "#fffdf8", rim: "#e7dfd0", fork: "#b9bccb", glass: "#e3f1f6", cider: "#e8a33d", brass: "#d9a43b", wax: "#fbf3e1", flame: "#ffcf4d", flame2: "#ff8a2a",
  gourd: "#e0792f", gourd2: "#c9b458", leaf: "#c0563a", leaf2: "#d9a43b", roast: "#b8682f", roast2: "#d48a45", frill: "#fffaf1", platter: "#f4efe6", herb: "#5f9a4f", orange: "#f08e3c",
  bowl: "#5b6bbf", mash: "#fbf0d6", butter: "#ffd84d", cdish: "#2f8f83", bean: "#5f9a4f", onion: "#e3b35d", cran: "#b8233b", basket: "#c98a4b", basket2: "#a86c3a", roll: "#e3a35a",
  napkin: "#e5484d", boat: "#fbfaf6", gravy: "#7b4325", ydish: "#e9dcc3", yam: "#e0792f", mallow: "#fff4dc", shadow: "#3a2d3c",
};
const DARK: Record<string, string> = {
  ...LIGHT, bg: "#14182b", floor: "#4a3428", floor2: "#3f2c22", wall: "#2a2b45", wall2: "#24253c", trim: "#3d3f5e", rug: "#6e2c35", rug2: "#5c242c", sky: "#1d2550", sky2: "#3a3570", frame: "#4a4c6b",
  door: "#4a3426", cloth: "#e6dfd3", cloth2: "#cfc6b6", wood: "#5a3c2a", wood2: "#4a3022", chair: "#5a3a28", chair2: "#45291c", shadow: "#000000",
};
const LIT = { light: [-0.3, 1, 0.65], amb: 0.56 }, NIGHT = { light: [0.1, 0.8, 0.5], amb: 0.4 };
/** The table: its top's height (the cloth), half its length and depth; where the places are. */
const TOPY = 1.52, HL = 9.2, HD = 2.25, PX0 = -6.25, PDX = 2.5, LANE = 0.92, PLZ = 1.6, GZ = 2.72;
/** Guests: shirts, trousers, skin, hair, and a hair style each (12, one per seat). */
const SHIRT = ["#2f8f83", "#d9a43b", "#7b4a8c", "#c0563a", "#34407a", "#8fae84", "#d97a8a", "#4a4f60", "#5b7fb5", "#8a2f45", "#e9dcc3", "#b8682f"];
const TROUS = ["#34384d", "#5a4a3a", "#2a2d3e", "#4a5a6b", "#3d3428", "#2a2d3e", "#4a3f55", "#6b5a45", "#2a2d3e", "#3d4a5a", "#5a4a3a", "#34384d"];
const SKIN = ["#f1d1b5", "#a86b45", "#e0b28e", "#5a3622", "#c68b62", "#f1d1b5", "#7d4b2e", "#e0b28e", "#c68b62", "#f1d1b5", "#a86b45", "#e0b28e"];
const HAIR = ["#2a1d16", "#1d1d22", "#6b4226", "#1d1d22", "#d9d4cc", "#a34a2a", "#2a1d16", "#4a3426", "#1d1d22", "#8a5a32", "#d9d4cc", "#2a1d16"];
const STYLE = [1, 0, 2, 4, 3, 2, 4, 0, 1, 5, 3, 2];
/** Each dish's main colour (its portion on a plate, its bubble). */
const KCOL = ["mash", "bean", "cran", "roll", "gravy", "yam"];
const YUM = ["YUM!", "MMM!", "LOVELY!", "PERFECT!", "SO GOOD!", "HOT ONE!"], GRR = ["HMPH.", "IT'S COLD…", "BRR.", "LUKEWARM."];
const FXN = 200, FS = 9, QN = 8;

export type TableScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly f: ReturnType<typeof table>;
  readonly state: { mode: number; course: number; score: number; hot: number; cold: number; card: boolean; held: number; node: number; served: number };
  /** Where node n is on screen (CSS px in the stage), for the tests. */
  at(n: number): [number, number];
  poster(): void;
  /** The autopilot passes the dishes (the tests, the poster). */
  autoplay(on: boolean): void;
  destroy(): void;
};

/** Node n's place on the table (x, z). */
const NX = new Float64Array(NN), NZ = new Float64Array(NN);
for (let n = 0; n < NN; n++) {
  const s = NODE_SEAT[n]!;
  if (s < 0) (NX[n] = n === HEAD ? -8.1 : 8.1), (NZ[n] = 0);
  else if (s < 6) (NX[n] = PX0 + s * PDX), (NZ[n] = LANE);
  else (NX[n] = -PX0 - (s - 6) * PDX), (NZ[n] = -LANE);
}
/** Seat s: its x, which side (1 near, −1 far). */
const seatX = (s: number) => NX[SEAT_NODE[s]!]!, side = (s: number) => (s < 6 ? 1 : -1);

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): TableScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const coarse = matchMedia("(pointer: coarse)").matches;
  let P = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  void slot;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the stickers,
  // the card and the keys bar. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "tt-play";
  play.setAttribute("aria-label", "Table for Twelve: the arrows pass the dish you hold to the next place that way, Enter passes it on again, N holds the next dish (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "tt-hud";
  hud.innerHTML = `<div class="tt-head"><p class="tt-top"><b class="tt-chip">Score <span>0</span></b><b class="tt-chip tt-n">Course <span>1/${COURSES}</span></b><b class="tt-chip tt-hot">Hot <span>0</span></b></p><p class="tt-hint"></p></div><p class="tt-live" aria-live="polite"></p><div class="tt-card" role="dialog" aria-label="Table for Twelve"><b>Table for Twelve</b><p>Twelve at the table and the dishes are coming out hot. Pass each one along to the guest who's thinking of it, before it goes cold.</p><p class="tt-stats"></p><button type="button" class="bui-key tt-go">SERVE DINNER</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const scoreEl = top.children[0]!.firstElementChild as HTMLElement, courseEl = top.children[1]!.firstElementChild as HTMLElement, hotEl = top.children[2]!.firstElementChild as HTMLElement;
  const cardT = card.children[0] as HTMLElement, cardP = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement, go = card.children[3] as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", pass: "click", out: "fire", hot: "power", cold: "hurt", refuse: "hit", course: "ready", done: "win" }, volume: 0.1 });
  const [muteK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: 0 },
    { label: "NEXT", aria: "Hold the next dish (N)", id: 1 },
    { label: "PASS ▸", aria: "Pass it on (Enter)", id: 2, c: "tt-pass" },
  ], (id, down) => {
    if (!down) return;
    if (!id) return toggle();
    if (f.S[MODE] === IDLE || f.S[MODE] === DONE) return void start();
    id === 1 ? act(f.cycle(1)) : passDir(f.S[DIR]!);
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };
  let f = table(1), seed = 1, auto = false, autoT = 0;

  // ---- the diorama ----
  const dio = diorama(canvas, { light: LIT.light, ambient: LIT.amb, background: () => P.bg!, overlay: drawOverlay, get shadowColor() { return P.shadow!; } });
  const keyed: DioramaObject[] = [], keyName: string[] = [], glow: DioramaObject[] = [];
  const put = (d: DioramaObjectDef & { color?: string; glow?: boolean }) => {
    // A palette role, or a fixed #hex (a guest's own colours stay the same day and night).
    const k = d.color, raw = k && k[0] === "#", ob = dio.add({ ...d, color: k ? (raw ? k : P[k]) : undefined, pick: false });
    if (k && !raw) keyed.push(ob), keyName.push(k);
    if (d.glow) glow.push(ob);
    return ob;
  };
  const recolor = (ob: DioramaObject, k: string) => {
    ob.color = P[k]!;
    const j = keyed.indexOf(ob);
    if (j >= 0) keyName[j] = k;
  };
  // Per dish: its root, its parts, where it is drawn (x, y, z on the cloth), its hop queue.
  const roots: DioramaObject[] = [], parts: DioramaObject[][] = [];
  const VX = new Float64Array(RUN_N), VY = new Float64Array(RUN_N), VZ = new Float64Array(RUN_N), HX = new Float64Array(RUN_N), HZ = new Float64Array(RUN_N), HT = new Float64Array(RUN_N);
  /** The view's stage for each dish: 0 hidden, 1 coming out, 2 on the table, 3 going onto the plate, 4 eaten (on the plate). */
  const VS = new Uint8Array(RUN_N), VT = new Float64Array(RUN_N), STEAM = new Float64Array(RUN_N);
  const Q = new Uint8Array(RUN_N * QN), QH = new Uint8Array(RUN_N), QL = new Uint8Array(RUN_N);
  // Per seat: the upper body, its head, the two arms, the glass, the portions on the plate, the mood clocks.
  const ups: DioramaObject[] = [], heads: DioramaObject[] = [], armL: DioramaObject[] = [], armR: DioramaObject[] = [], glasses: DioramaObject[] = [], food: DioramaObject[] = [];
  /** Mood: 0 none, 1 happy, 2 grumble, 3 handing a dish on; its clock; the word; the bubble's clock. */
  const MK = new Uint8Array(NSEAT), MT = new Float64Array(NSEAT), MW = new Uint8Array(NSEAT), BT = new Float64Array(NSEAT).fill(-1), HAND = new Int8Array(NSEAT);
  const flames: DioramaObject[] = [];
  let kinds = 0, hinge: DioramaObject;
  let steam: DioramaPoints, pantry: DioramaObject, pantryA = 0, pantryTo = 0;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = glow.length = roots.length = parts.length = 0;
    ups.length = heads.length = armL.length = armR.length = glasses.length = food.length = flames.length = 0;
    // Fixed ranks: the room, the rug, the far side's guests, the table. Dishes, candles, the roast,
    // glasses and the near side's guests each sort by their own depth after those.
    ["room", "rug", "far", "table"].forEach((n, i) => dio.cluster(n, { fixed: i }));
    // The room: the floor, the back wall with its windows, the kitchen door (left) and the pantry (right).
    put({ size: [70, 0.5, 50], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
    dio.decal("room", 0.1, floorDecal);
    put({ id: "wall", size: [70, 16, 0.5], pos: [0, -0.5, -7.25], color: "wall", cluster: "room", layer: 0.2 });
    put({ size: [70, 2.6, 0.08], pos: [0, 0, -6.96], color: "wall2", cluster: "room", layer: 0.3 });
    put({ size: [70, 0.14, 0.12], pos: [0, 2.6, -6.94], color: "trim", cluster: "room", layer: 0.35 });
    for (const x of [-3.2, 3.2]) {
      put({ size: [3.4, 4.2, 0.1], pos: [x, 3.4, -6.97], color: "frame", cluster: "room", layer: 0.4 });
      put({ size: [3.0, 3.8, 0.04], pos: [x, 3.6, -6.9], color: "sky", glow: true, cluster: "room", layer: 0.45 });
      put({ size: [0.12, 3.8, 0.06], pos: [x, 3.6, -6.86], color: "frame", cluster: "room", layer: 0.5 });
      put({ size: [3.0, 0.12, 0.06], pos: [x, 5.0, -6.86], color: "frame", cluster: "room", layer: 0.5 });
      put({ size: [3.8, 0.16, 0.4], pos: [x, 3.3, -6.8], color: "trim", cluster: "room", layer: 0.55 });
    }
    dio.decal("room", 0.47, skyDecal);
    // The kitchen door, open, its light spilling out; the pantry door, shut until both ways.
    put({ size: [2.6, 4.6, 0.14], pos: [-10.6, 0, -6.95], color: "trim", cluster: "room", layer: 0.4 });
    put({ size: [2.2, 4.3, 0.05], pos: [-10.6, 0, -6.86], color: "doorL", emissive: true, cluster: "room", layer: 0.45 });
    put({ size: [0.12, 4.3, 1.9], pos: [-11.65, 0, -5.95], rot: [0, -0.35, 0], color: "door", cluster: "room", layer: 0.5 });
    put({ size: [2.6, 4.6, 0.14], pos: [10.6, 0, -6.95], color: "trim", cluster: "room", layer: 0.4 });
    put({ size: [2.2, 4.3, 0.05], pos: [10.6, 0, -6.86], color: "doorL", emissive: true, cluster: "room", layer: 0.45 });
    hinge = put({ id: "hinge", shape: "group", size: [0, 0, 0], pos: [11.7, 0, -6.82], cluster: "room", layer: 0.5 });
    pantry = put({ size: [2.2, 4.3, 0.12], on: "hinge", pos: [-1.1, 0, 0], color: "door", layer: 0.6 });
    put({ shape: "cyl", sides: 6, size: [0.16, 0.16, 0.08], on: "hinge", pos: [-2.0, 2.1, 0.1], rot: [HALF_PI, 0, 0], color: "brass", layer: 0.65 });
    // The sideboard by the kitchen door, a pie and a stack of plates on it.
    put({ id: "side", size: [4.2, 1.7, 1.2], pos: [-6, 0, -6.3], color: "wood", cluster: "room", layer: 0.6 });
    for (let k = 0; k < 3; k++) put({ size: [1.25, 1.3, 0.04], on: "side", pos: [-1.35 + k * 1.35, -1.5, 0.61], color: "wood2", layer: 0.62 });
    put({ shape: "cyl", sides: 12, top: 0.9, size: [1.0, 0.18, 1.0], on: "side", pos: [0.9, 0, 0], color: "roll", layer: 0.65 });
    for (let k = 0; k < 4; k++) put({ shape: "cyl", sides: 12, size: [0.9, 0.06, 0.9], on: "side", pos: [-1.0, k * 0.07, 0], color: "plate", layer: 0.65 + k * 0.01 });
    // The rug.
    put({ size: [24, 0.03, 10.4], pos: [0, 0, 0], color: "rug", cluster: "rug", layer: 0 });
    put({ size: [23, 0.035, 9.4], pos: [0, 0, 0], color: "rug2", cluster: "rug", layer: 0.1 });
    put({ size: [22.4, 0.04, 8.8], pos: [0, 0, 0], color: "rug", cluster: "rug", layer: 0.2 });
    // The table: legs, the top, the cloth and its drape, the runner.
    for (const x of [-HL + 0.6, HL - 0.6]) for (const z of [-HD + 0.4, HD - 0.4]) put({ size: [0.3, 1.28, 0.3], pos: [x, 0, z], color: "wood2", cluster: "table", layer: 0 });
    put({ size: [HL * 2 + 0.2, 0.12, HD * 2], pos: [0, 1.26, 0], color: "wood", cluster: "table", layer: 0.1 });
    put({ size: [HL * 2 + 0.5, 0.42, HD * 2 + 0.3], pos: [0, 1.0, 0], mask: 60, color: "cloth2", cluster: "table", layer: 0.2 });
    put({ id: "cloth", size: [HL * 2 + 0.5, 0.14, HD * 2 + 0.3], pos: [0, TOPY - 0.14, 0], mask: 1, color: "cloth", cluster: "table", layer: 0.3 });
    put({ size: [HL * 2 - 1.4, 0.012, 1.15], on: "cloth", color: "runner", layer: 0.4 });
    dio.decal("table", 0.45, runnerDecal);
    // The places: a plate with its rim, a fork and a knife.
    for (let s = 0; s < NSEAT; s++) {
      const x = seatX(s), z = side(s) * PLZ, id = "pl" + s;
      put({ id, shape: "cyl", sides: 16, size: [0.98, 0.05, 0.98], on: "cloth", pos: [x, 0, z], color: "plate", shadow: 0.25, layer: 0.6 });
      put({ shape: "cyl", sides: 16, size: [0.66, 0.012, 0.66], on: id, color: "rim", layer: 0.61 });
      put({ size: [0.07, 0.02, 0.56], on: "cloth", pos: [x - 0.62, 0, z], color: "fork", layer: 0.6 });
      put({ size: [0.08, 0.02, 0.6], on: "cloth", pos: [x + 0.62, 0, z + side(s) * 0.04], color: "fork", layer: 0.6 });
      // Three portions, hidden until served.
      for (let k = 0; k < 3; k++) food.push(put({ shape: "cyl", sides: 8, top: 0.55, size: [0.3, 0.13, 0.26], on: id, pos: [(k - 1) * 0.22, 0.012, ((k & 1) * 2 - 1) * 0.1], color: "mash", hidden: true, layer: 0.62 + k * 0.01 }));
    }
    // The centre: the roast on its platter, four candles, gourds and leaves.
    put({ id: "platter", shape: "cyl", sides: 16, size: [2.3, 0.07, 1.25], on: "cloth", cluster: "roast", shadow: 0.3, color: "platter", layer: 1 });
    put({ shape: "cyl", sides: 16, size: [1.9, 0.012, 1.0], on: "platter", color: "rim", layer: 1.01 });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + 0.3;
      put({ shape: "cyl", sides: 6, top: 0.6, size: [0.2, 0.08, 0.16], on: "platter", pos: [Math.cos(a) * 0.98, 0.012, Math.sin(a) * 0.5], rot: [0, a, 0], color: k & 1 ? "herb" : "orange", layer: 1.02 });
    }
    put({ id: "bird", shape: "cyl", sides: 12, top: 0.62, size: [1.5, 0.62, 0.98], on: "platter", pos: [0, 0.01, 0], color: "roast", layer: 1.1 });
    put({ shape: "cyl", sides: 10, top: 0.35, size: [0.92, 0.2, 0.6], on: "bird", color: "roast2", layer: 1.15 });
    for (const s of [-1, 1]) {
      const id = "leg" + s;
      put({ id, shape: "cyl", sides: 7, top: 0.5, size: [0.36, 0.62, 0.34], on: "platter", pos: [0.62, 0.22, s * 0.28], rot: [0, 0, -1.25], color: "roast", layer: 1.12 });
      put({ shape: "cyl", sides: 6, top: 0.6, size: [0.15, 0.14, 0.15], on: id, color: "frill", layer: 1.13 });
    }
    for (const x of [-5, -2.5, 2.5, 5]) {
      const id = "cs" + x, cl = "c" + x;
      put({ id, shape: "cyl", sides: 10, top: 0.5, size: [0.42, 0.12, 0.42], on: "cloth", pos: [x, 0, 0], cluster: cl, shadow: 0.25, color: "brass", layer: 1 });
      put({ id: id + "s", shape: "cyl", sides: 8, top: 1.4, size: [0.12, 0.42, 0.12], on: id, color: "brass", layer: 1.01 });
      put({ id: id + "w", shape: "cyl", sides: 8, size: [0.15, 0.95, 0.15], on: id + "s", color: "wax", layer: 1.02 });
      flames.push(put({ shape: "cyl", sides: 6, top: 0, size: [0.12, 0.26, 0.12], on: id + "w", pos: [0, 0.02, 0], color: "flame", emissive: true, layer: 1.03 }));
      dio.decal(cl, 1.04, flameGlow(flames.length - 1));
    }
    for (const x of [-7.4, -3.75, 0, 3.75, 7.4]) {
      if (x) {
        put({ shape: "cyl", sides: 9, top: 0.55, size: [0.5, 0.34, 0.46], on: "cloth", pos: [x - 0.18, 0, 0.05], cluster: "g" + x, shadow: 0.2, color: "gourd", layer: 1 });
        put({ shape: "cyl", sides: 7, top: 0.4, size: [0.36, 0.3, 0.3], on: "cloth", pos: [x + 0.26, 0, -0.12], cluster: "g" + x, color: "gourd2", layer: 1.01 });
      }
      for (let k = 0; k < 3; k++) put({ shape: "prism", outline: [[0, -0.22], [0.16, 0], [0, 0.22], [-0.16, 0]], size: [1, 0.015, 1], on: "cloth", pos: [x + (k - 1) * 0.5 + 0.9, 0.01, (k - 1) * 0.28], rot: [0, k * 1.1 + x, 0], color: k & 1 ? "leaf2" : "leaf", layer: 0.5 });
    }
    // The guests and their chairs.
    for (let s = 0; s < NSEAT; s++) guest(s);
    // The dishes of the dinner: built once, each hidden until it comes out.
    for (let i = 0; i < RUN_N; i++) dish(i);
    steam = dio.points({ cap: FXN, layer: 9, paint: puff });
    VS.fill(0), QL.fill(0), QH.fill(0), MK.fill(0), BT.fill(-1), HAND.fill(0), STEAM.fill(0);
    pantryA = pantryTo = 0;
  }

  /** Guest s and their chair: a seat, spindles and a rail; legs; the upper body (a group that leans)
   *  with the torso, neck, head and hair; two arms that swing from the shoulder; a glass at their place. */
  function guest(s: number) {
    const sd = side(s), near = sd > 0, x = seatX(s), id = "u" + s, cl = near ? "n" + s : "far";
    // Near guests sit with their backs to us: their chair draws over them; far ones, theirs behind.
    const ch = near ? 3 : 1, bd = near ? 1 : 2;
    const r = put({ id: "gr" + s, shape: "group", size: [0, 0, 0], pos: [x, 0, sd * GZ], rot: [0, near ? Math.PI : 0, 0], cluster: cl, layer: ch });
    const on = "gr" + s;
    for (const lx of [-0.4, 0.4]) for (const lz of [-0.38, 0.38]) put({ size: [0.09, 0.86, 0.09], on, pos: [lx, 0, lz], color: "chair2", layer: ch });
    put({ size: [0.96, 0.1, 0.9], on, pos: [0, 0.86, 0], color: "chair", layer: ch + 0.01 });
    for (const lx of [-0.4, 0, 0.4]) put({ size: [lx ? 0.1 : 0.07, 0.9, 0.08], on, pos: [lx, 0.96, -0.42], color: "chair2", layer: ch + 0.02 });
    put({ size: [1.02, 0.12, 0.14], on, pos: [0, 1.82, -0.42], color: "chair", layer: ch + 0.03 });
    // Legs under the table: thighs on the seat, shins down to the floor.
    put({ size: [0.62, 0.24, 0.72], on, pos: [0, 0.96, 0.16], color: TROUS[s], layer: bd });
    put({ size: [0.56, 0.96, 0.2], on, pos: [0, 0, 0.5], color: TROUS[s], layer: bd });
    // The upper body, from the hip.
    const u = put({ id, shape: "group", size: [0, 0, 0], on, pos: [0, 1.08, -0.05], layer: bd });
    put({ id: id + "t", shape: "cyl", sides: 7, top: 1.32, size: [0.6, 0.92, 0.42], on: id, color: SHIRT[s], layer: bd + 0.1 });
    put({ id: id + "n", shape: "cyl", sides: 6, size: [0.2, 0.16, 0.2], on: id + "t", color: s % 3 === 1 ? SHIRT[s] : SKIN[s], layer: bd + 0.2 });
    const h = put({ id: id + "h", shape: "cyl", sides: 8, top: 0.86, size: [0.44, 0.48, 0.44], on: id + "n", color: SKIN[s], layer: bd + 0.3 });
    hair(s, id + "h", near, bd);
    // The arms: a pivot at each shoulder, the sleeve hanging from it, a hand at its end.
    for (const lx of [-1, 1]) {
      const a = put({ id: id + "a" + lx, shape: "group", size: [0, 0, 0], on: id, pos: [lx * 0.43, 0.86, 0], rot: [-0.3, 0, lx * 0.08], layer: bd });
      const al = near ? bd - 0.05 : bd + 0.5;
      put({ size: [0.17, 0.64, 0.2], on: id + "a" + lx, pos: [0, -0.64, 0], color: SHIRT[s], layer: al });
      put({ shape: "cyl", sides: 6, size: [0.15, 0.13, 0.15], on: id + "a" + lx, pos: [0, -0.78, 0], color: SKIN[s], layer: al + 0.01 });
      (lx < 0 ? armL : armR).push(a);
    }
    ups.push(u);
    heads.push(h);
    void r;
    // The glass: on the table at the place, cider in it; it rises at the toast.
    const gid = "gl" + s, g = put({ id: gid, shape: "cyl", sides: 9, top: 1.25, size: [0.24, 0.42, 0.24], pos: [x + 0.74, TOPY, sd * 1.22], color: "glass", alpha: 0.62, cluster: gid, layer: 1 });
    put({ shape: "cyl", sides: 9, top: 1.15, size: [0.2, 0.24, 0.2], on: gid, pos: [0, -0.36, 0], color: "cider", layer: 1.01 });
    glasses.push(g);
  }
  /** Six hair styles: a crop, a bun, a bob, curls, a crown with a beard, a swept top. */
  function hair(s: number, on: string, near: boolean, bd: number) {
    const c = HAIR[s]!, st = STYLE[s]!, l = bd + 0.4;
    if (st === 0 || st === 1) put({ shape: "cyl", sides: 8, top: 0.7, size: [0.47, 0.13, 0.47], on, pos: [0, -0.04, -0.01], color: c, layer: l });
    if (st === 1) put({ shape: "cyl", sides: 7, top: 0.75, size: [0.22, 0.2, 0.22], on, pos: [0, 0.04, -0.14], color: c, layer: l + 0.01 });
    if (st === 2) {
      put({ shape: "cyl", sides: 8, top: 0.72, size: [0.5, 0.14, 0.5], on, pos: [0, -0.05, 0], color: c, layer: l });
      // The bob: a round of hair a little wider than the head, drawn under the face (far side) or over the back of the head (near).
      put({ shape: "cyl", sides: 8, top: 1.06, size: [0.54, 0.36, 0.52], on, pos: [0, -0.48, -0.03], color: c, layer: near ? l + 0.01 : bd + 0.25 });
    }
    if (st === 3) put({ shape: "cyl", sides: 6, top: 0.82, size: [0.58, 0.26, 0.58], on, pos: [0, -0.12, -0.02], color: c, layer: l });
    if (st === 4) {
      put({ size: [0.46, 0.2, 0.12], on, pos: [0, -0.3, -0.2], color: c, layer: near ? l : bd + 0.25 });
      put({ size: [0.34, 0.16, 0.12], on, pos: [0, -0.48, 0.19], color: c, layer: near ? bd + 0.25 : l });
    }
    if (st === 5) put({ size: [0.46, 0.12, 0.5], on, pos: [0.03, -0.03, 0], rot: [0, 0, 0.16], color: c, layer: l });
  }
  /** Dish i (its kind from the dinner): a root on the cloth (its own cluster) and a few blocks. */
  function dish(i: number) {
    const id = "d" + i, list: DioramaObject[] = [];
    const root = put({ id, shape: "group", size: [1, 0, 0.8], on: "cloth", cluster: id, hidden: true, shadow: 0.35, layer: 2 });
    roots[i] = root;
    parts[i] = list;
    dishParts(i, 0);
  }
  /** Dish i's blocks for kind k (built again when the kind is drawn: a new dinner, a new run). */
  function dishParts(i: number, k: number) {
    const id = "d" + i, list = parts[i]!, hid = VS[i]! === 0;
    for (const p of list) p.hidden = true;
    list.length = 0;
    const add = (o: DioramaObjectDef & { color?: string }) => (list.push(put({ on: id, ...o, hidden: hid, layer: 2 + (o.layer ?? 0) })), list[list.length - 1]!);
    const sub = id + "k" + k + "x" + kinds++;
    if (k === MASH) {
      add({ id: sub, shape: "cyl", sides: 12, top: 1.28, size: [0.74, 0.36, 0.74], color: "bowl" });
      add({ id: sub + "m", shape: "cyl", sides: 10, top: 0.38, size: [0.88, 0.24, 0.88], on: sub, color: "mash", layer: 0.01 });
      add({ size: [0.16, 0.07, 0.14], on: sub + "m", rot: [0, 0.5, 0], color: "butter", layer: 0.02 });
    } else if (k === BEANS) {
      add({ id: sub, shape: "cyl", sides: 12, top: 1.08, size: [1.08, 0.26, 0.72], color: "cdish" });
      add({ shape: "cyl", sides: 12, size: [1.02, 0.05, 0.66], on: sub, color: "bean", layer: 0.01 });
      for (let j = 0; j < 5; j++) add({ size: [0.16, 0.05, 0.11], on: sub, pos: [-0.36 + j * 0.18, 0.05, ((j * 5) % 3 - 1) * 0.14], rot: [0, j * 1.3, 0], color: "onion", layer: 0.02 });
      for (const s of [-1, 1]) add({ size: [0.14, 0.07, 0.24], pos: [s * 0.6, 0.16, 0], color: "cdish", layer: 0.03 });
    } else if (k === CRAN) {
      add({ id: sub, shape: "cyl", sides: 12, size: [0.82, 0.05, 0.82], color: "boat" });
      add({ shape: "cyl", sides: 10, size: [0.4, 0.4, 0.4], on: sub, pos: [-0.08, 0, 0], color: "cran", layer: 0.01 });
      add({ shape: "cyl", sides: 10, size: [0.4, 0.08, 0.4], on: sub, pos: [0.2, 0, 0.12], rot: [0, 0, 0.12], color: "cran", layer: 0.02 });
    } else if (k === ROLLS) {
      add({ id: sub, shape: "cyl", sides: 8, top: 1.2, size: [0.9, 0.26, 0.7], color: "basket" });
      add({ shape: "prism", outline: [[-0.5, -0.36], [0.5, -0.36], [0, 0.42]], size: [1, 0.02, 1], on: sub, pos: [0, 0, 0], color: "napkin", layer: 0.01 });
      for (let j = 0; j < 3; j++) add({ shape: "cyl", sides: 8, top: 0.7, size: [0.34, 0.2, 0.3], on: sub, pos: [-0.22 + j * 0.22, 0.02, ((j & 1) * 2 - 1) * 0.08], rot: [0, j, 0], color: "roll", layer: 0.02 + j * 0.001 });
    } else if (k === GRAVY) {
      add({ id: sub, shape: "cyl", sides: 12, size: [0.92, 0.05, 0.64], color: "boat" });
      const out = [[-0.48, 0], [-0.22, -0.2], [0.18, -0.22], [0.36, -0.1], [0.36, 0.1], [0.18, 0.22], [-0.22, 0.2]];
      add({ id: sub + "b", shape: "prism", outline: out, taper: 0.62, size: [1, 0.3, 1], on: sub, color: "boat", layer: 0.01 });
      add({ shape: "prism", outline: [[-0.36, 0], [-0.16, -0.15], [0.16, -0.17], [0.3, 0], [0.16, 0.17], [-0.16, 0.15]], size: [1, 0.01, 1], on: sub + "b", color: "gravy", layer: 0.02 });
      add({ size: [0.1, 0.22, 0.06], on: sub, pos: [0.42, 0.14, 0], color: "boat", layer: 0.03 });
    } else {
      add({ id: sub, size: [0.98, 0.24, 0.72], color: "ydish" });
      add({ size: [0.9, 0.05, 0.64], on: sub, color: "yam", layer: 0.01 });
      for (let j = 0; j < 6; j++) add({ shape: "cyl", sides: 6, size: [0.15, 0.08, 0.15], on: sub, pos: [-0.3 + (j % 3) * 0.3, 0.05, (j < 3 ? -1 : 1) * 0.15], color: "mallow", layer: 0.02 });
    }
  }

  // ---- painters ----
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // Steam and sparkles: x y z, vx vy vz, life, max, kind (0 steam, 1 sparkle, 2 confetti).
  const fx = new Float32Array(FXN * FS), FX_OF = new Int32Array(FXN);
  const SPARK = ["#ffd36b", "#fff4dc", "#f2a541"];
  const puff = (ctx: CanvasRenderingContext2D, j: number, p: DioramaPoints) => {
    const o = FX_OF[j]! * FS, kind = fx[o + 8]!, r = Math.max(1.2, p.sr[j]!), a = p.a[j]!;
    if (kind) {
      ctx.fillStyle = SPARK[FX_OF[j]! % 3]!;
      ctx.beginPath();
      for (let q = 0; q < 8; q++) {
        const an = (q / 8) * TAU + fx[o + 6]! * 4, rr = q & 1 ? r * 0.4 : r;
        ctx.lineTo(p.sx[j]! + Math.cos(an) * rr, p.sy[j]! + Math.sin(an) * rr);
      }
      ctx.fill();
      return;
    }
    // A wisp: three soft discs, rising and widening.
    ctx.fillStyle = P === DARK ? "#e6ecf6" : "#ffffff";
    for (let q = 3; q > 0; q--) (ctx.globalAlpha = a * (0.42 - q * 0.1)), ctx.beginPath(), ctx.ellipse(p.sx[j]! + Math.sin(fx[o + 6]! * 5 + j) * r * 0.3, p.sy[j]!, r * q * 0.32, r * q * 0.45, 0, 0, TAU), ctx.fill();
    ctx.globalAlpha = 1;
  };
  let rnd = seeded(1);
  function spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! > 0) continue;
      (fx[o] = x), (fx[o + 1] = y), (fx[o + 2] = z), (fx[o + 3] = vx), (fx[o + 4] = vy), (fx[o + 5] = vz), (fx[o + 6] = fx[o + 7] = life), (fx[o + 8] = kind);
      return;
    }
  }
  function stepFx(dt: number) {
    let on = false;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! <= 0) continue;
      on = true;
      fx[o + 6] = fx[o + 6]! - dt;
      if (fx[o + 8]) fx[o + 4] = fx[o + 4]! - 5 * dt;
      else (fx[o + 3] = fx[o + 3]! * 0.97), (fx[o + 4] = fx[o + 4]! * 0.985);
      (fx[o] = fx[o]! + fx[o + 3]! * dt), (fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt), (fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt);
    }
    return on;
  }
  function fxPoints() {
    const p = steam;
    p.n = 0;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS, l = fx[o + 6]!;
      if (l <= 0) continue;
      const j = p.n++, u = l / fx[o + 7]!;
      FX_OF[j] = k;
      (p.x[j] = fx[o]!), (p.y[j] = fx[o + 1]!), (p.z[j] = fx[o + 2]!);
      if (fx[o + 8]) (p.r[j] = 0.09), (p.a[j] = Math.min(1, u * 3));
      else (p.r[j] = 0.1 + (1 - u) * 0.22), (p.a[j] = Math.min(1, (1 - u) * 5) * u * (P === DARK ? 0.75 : 0.95));
    }
  }
  /** Steam off the hot dishes: each gives off wisps in proportion to its heat. */
  function steamOn(dt: number) {
    const S = f.S;
    for (let i = 0; i < RUN_N; i++) {
      const vs = VS[i]!;
      if (vs < 1 || vs > 3 || f.DH[i]! <= 0) continue;
      STEAM[i] = STEAM[i]! + dt * 9 * f.DH[i]! ** 0.8;
      while (STEAM[i]! >= 1) {
        STEAM[i] = STEAM[i]! - 1;
        spawn(0, VX[i]! + (rnd() - 0.5) * 0.5, TOPY + VY[i]! + 0.3, VZ[i]! + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.15, 0.55 + rnd() * 0.3, -0.05, 0.9 + rnd() * 0.6);
      }
    }
    void S;
  }

  // ---- decals and the overlay ----
  function quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, y: number) {
    dio.project(x0, y, z0, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y, z0, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y, z1, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x0, y, z1, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.closePath();
  }
  function floorDecal(ctx: CanvasRenderingContext2D) {
    // Boards.
    ctx.strokeStyle = P.floor2!;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = -7; z < 12; z += 1.1) dio.project(-30, 0.01, z, tmp), ctx.moveTo(tmp[0]!, tmp[1]!), dio.project(30, 0.01, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.stroke();
  }
  function skyDecal(ctx: CanvasRenderingContext2D) {
    // A low sun (day) or the moon (night) in the left window, and a line of hills.
    if (!dio.project(-3.9, 4.4, -6.86, tmp)) return;
    const k = dio.focal() / tmp[2]!;
    ctx.fillStyle = P === DARK ? "#f4efe4" : "#ffe2a6";
    ctx.beginPath();
    ctx.arc(tmp[0]!, tmp[1]!, k * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.sky2!;
    ctx.globalAlpha = 0.85;
    for (let q = 0; q < 2; q++) {
      const x = q ? 3.2 : -3.2;
      ctx.beginPath();
      quad(ctx, x - 1.5, -6.86, x + 1.5, -6.86, 1.7);
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      dio.project(x - 1.5, 1.7, -6.86, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
      for (let q = 0; q <= 8; q++) dio.project(x - 1.5 + q * 0.375, 2.35 + Math.sin(q * 1.3 + x) * 0.22, -6.86, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
      dio.project(x + 1.5, 1.7, -6.86, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  const ARROW = new Float64Array(8);
  /** On the cloth: the way the table passes (one way: arrows down each side; both ways: both), the
   *  ring under the dish you hold, and chevrons to the places it can go. Under the dishes. */
  function runnerDecal(ctx: CanvasRenderingContext2D) {
    const S = f.S, m = S[MODE]!;
    if (m !== PLAY && m !== BREAK) return;
    ctx.strokeStyle = P === DARK ? "#3d3f5e" : "#c9b89c";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    for (let c = 0; c < 5; c++) {
      const x = -5 + c * 2.5;
      for (let q = 0; q < 2; q++) {
        const z = q ? -LANE : LANE;
        if (!S[BOTH]) chevron(ctx, x, z, z > 0 ? 1 : -1, 0.16);
        else chevron(ctx, x - 0.18, z, -1, 0.14), chevron(ctx, x + 0.18, z, 1, 0.14);
      }
    }
    ctx.globalAlpha = 1;
    const i = S[SEL]!;
    if (m !== PLAY || i < 0 || VS[i]! < 2 || auto) return;
    // The ring under the dish in hand.
    const t = engine.time;
    ctx.strokeStyle = "#f2a541";
    ctx.lineWidth = 3;
    ctx.setLineDash(DASH);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    for (let q = 0; q <= 20; q++) {
      const a = (q / 20) * TAU;
      dio.project(VX[i]! + Math.cos(a) * 0.72, TOPY + 0.02, VZ[i]! + Math.sin(a) * 0.56, tmp);
      q ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
    }
    ctx.stroke();
    ctx.setLineDash(SOLID);
    // Chevrons to the next places: on (green), back (green once both ways, else none).
    const n = f.DN[i]!;
    for (let d = 1; d >= -1; d -= 2) {
      if (d < 0 && !S[BOTH]) continue;
      // (Math.sqrt, not Math.hypot: hypot boxes its arguments, and this runs every frame.)
      const to = (n + d + NN) % NN, x0 = NX[n]!, z0 = NZ[n]!, x1 = NX[to]!, z1 = NZ[to]!, dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1;
      const mx = x0 + dx * 0.5, mz = z0 + dz * 0.5, ux = dx / l, uz = dz / l, s = 0.26;
      ARROW[0] = mx - ux * s + uz * s, ARROW[1] = mz - uz * s - ux * s, ARROW[2] = mx + ux * s, ARROW[3] = mz + uz * s, ARROW[4] = mx - ux * s - uz * s, ARROW[5] = mz - uz * s + ux * s;
      ctx.fillStyle = "#7fcfa8";
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let q = 0; q < 3; q++) dio.project(ARROW[q * 2]!, TOPY + 0.03, ARROW[q * 2 + 1]!, tmp), q ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  function chevron(ctx: CanvasRenderingContext2D, x: number, z: number, d: number, s: number) {
    ctx.beginPath();
    dio.project(x - d * s, TOPY + 0.02, z - s, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
    dio.project(x + d * s, TOPY + 0.02, z, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x - d * s, TOPY + 0.02, z + s, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.stroke();
  }
  /** A candle's glow, in its own cluster after its flame. */
  function flameGlow(c: number) {
    return (ctx: CanvasRenderingContext2D) => {
      const fl = flames[c]!;
      if (!fl.M || !dio.project(fl.M[9]!, fl.M[10]! + 0.12, fl.M[11]!, tmp)) return;
      const r = (0.55 * dio.focal()) / tmp[2]!, fk = 0.85 + 0.15 * Math.sin(engine.time * 9 + c * 2);
      ctx.fillStyle = "#ffcf4d";
      for (let i = 3; i > 0; i--) (ctx.globalAlpha = (P === DARK ? 0.1 : 0.05) * (4 - i) * fk), ctx.beginPath(), ctx.arc(tmp[0]!, tmp[1]!, r * i * 0.5 * fk, 0, TAU), ctx.fill();
      ctx.globalAlpha = 1;
    };
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
  const DASH = [6, 5], SOLID: number[] = [];
  /** A little picture of dish k, about r px across, at (x, y). */
  function icon(ctx: CanvasRenderingContext2D, k: number, x: number, y: number, r: number, cold: boolean) {
    const C = (n: string) => (cold ? "#9aa6bf" : P[n]!);
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.strokeStyle = "#1f2433";
    const el = (cx: number, cy: number, rx: number, ry: number, col: string, a0 = 0, a1 = TAU) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x + cx * r, y + cy * r, rx * r, ry * r, 0, a0, a1);
      ctx.fill();
      ctx.stroke();
    };
    if (k === MASH) el(0, 0.1, 0.62, 0.5, C("bowl"), 0, Math.PI), el(0, 0.05, 0.6, 0.38, C("mash"), Math.PI, TAU), el(0, 0.1, 0.62, 0.12, C("mash")), el(0.05, -0.14, 0.14, 0.08, C("butter"));
    else if (k === BEANS) {
      el(0, 0.1, 0.7, 0.4, C("cdish"));
      ctx.strokeStyle = C("bean");
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath();
      for (let q = 0; q < 4; q++) ctx.moveTo(x + (-0.42 + q * 0.26) * r, y - 0.05 * r), ctx.lineTo(x + (-0.3 + q * 0.26) * r, y + 0.25 * r);
      ctx.stroke();
    } else if (k === CRAN) {
      el(0, 0.32, 0.66, 0.16, C("boat"));
      ctx.fillStyle = C("cran");
      ctx.fillRect(x - 0.3 * r, y - 0.42 * r, 0.6 * r, 0.72 * r);
      ctx.strokeRect(x - 0.3 * r, y - 0.42 * r, 0.6 * r, 0.72 * r);
      ctx.beginPath();
      for (let q = 1; q < 3; q++) ctx.moveTo(x - 0.3 * r, y + (-0.42 + q * 0.24) * r), ctx.lineTo(x + 0.3 * r, y + (-0.42 + q * 0.24) * r);
      ctx.stroke();
    } else if (k === ROLLS) el(0, 0.2, 0.7, 0.32, C("basket"), 0, Math.PI), el(-0.3, 0.02, 0.26, 0.2, C("roll")), el(0.3, 0.02, 0.26, 0.2, C("roll")), el(0, -0.12, 0.28, 0.22, C("roll")), el(0, 0.2, 0.7, 0.1, C("basket"));
    else if (k === GRAVY) {
      ctx.fillStyle = C("boat");
      ctx.beginPath();
      ctx.moveTo(x - 0.72 * r, y - 0.18 * r);
      ctx.quadraticCurveTo(x - 0.3 * r, y - 0.05 * r, x - 0.2 * r, y - 0.12 * r);
      ctx.lineTo(x + 0.5 * r, y - 0.12 * r);
      ctx.quadraticCurveTo(x + 0.45 * r, y + 0.42 * r, x, y + 0.42 * r);
      ctx.quadraticCurveTo(x - 0.4 * r, y + 0.42 * r, x - 0.72 * r, y - 0.18 * r);
      ctx.fill();
      ctx.stroke();
      el(0.12, -0.12, 0.34, 0.08, C("gravy"));
      ctx.beginPath();
      ctx.arc(x + 0.62 * r, y + 0.08 * r, 0.16 * r, -1.3, 1.6);
      ctx.stroke();
    } else {
      ctx.fillStyle = C("ydish");
      ctx.fillRect(x - 0.66 * r, y - 0.2 * r, 1.32 * r, 0.56 * r);
      ctx.strokeRect(x - 0.66 * r, y - 0.2 * r, 1.32 * r, 0.56 * r);
      ctx.fillStyle = C("yam");
      ctx.fillRect(x - 0.56 * r, y - 0.28 * r, 1.12 * r, 0.2 * r);
      ctx.strokeRect(x - 0.56 * r, y - 0.28 * r, 1.12 * r, 0.2 * r);
      for (let q = 0; q < 4; q++) el(-0.39 + q * 0.26, -0.3, 0.09, 0.07, C("mallow"));
    }
  }
  let toastT = 0, toastS = "", toastK = 0, toastL = 1.4, said = "", hudDirty = true, dirty = true, tAmb = 0, doneT = -1;
  const TOAST = ["#fffaf1", "#ffd36b", "#e5484d", "#7fcfa8"];
  const HEADP = new Float64Array(NSEAT * 3);
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const S = f.S, m = S[MODE]!, W = dio.width;
    // Where each guest's head is now (the hair's top, roughly).
    for (let s = 0; s < NSEAT; s++) {
      const h = heads[s]!;
      if (!h.M || !dio.project(h.M[9]!, h.M[10]! + 0.6, h.M[11]!, tmp)) continue;
      (HEADP[s * 3] = tmp[0]!), (HEADP[s * 3 + 1] = tmp[1]!), (HEADP[s * 3 + 2] = dio.focal() / tmp[2]!);
    }
    // The thought bubbles: what each waiting guest wants, and a ring that runs down as it cools.
    for (let s = 0; s < NSEAT; s++) {
      const k = f.WANT[s]!, b = BT[s]!;
      if (k < 0 || b < 0 || m === DONE) continue;
      const kk = HEADP[s * 3 + 2]!, sc = b < 0.25 ? 0.4 + (b / 0.25) * 0.75 : b < 0.4 ? 1.15 - ((b - 0.25) / 0.15) * 0.15 : 1;
      const r = Math.max(15, Math.min(32, kk * 0.4)) * sc, x = HEADP[s * 3]! + r * 0.55, y = HEADP[s * 3 + 1]! - r * 1.25;
      const i = f.WD[s]!, heat = i >= 0 ? f.DH[i]! : 0, cold = heat <= 0, shake = cold ? Math.sin(tAmb * 30) * 1.5 : 0;
      ctx.fillStyle = "#fffaf1";
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 2;
      // The trail of little puffs down to the head.
      for (let q = 0; q < 2; q++) {
        ctx.beginPath();
        ctx.arc(HEADP[s * 3]! + r * (0.05 + q * 0.18), HEADP[s * 3 + 1]! - r * (0.12 + q * 0.3), r * (0.11 + q * 0.07), 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(x + shake, y, r * 1.12, r * 0.92, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      icon(ctx, k, x + shake, y + r * 0.06, r * 0.86, cold);
      // The heat ring: orange when hot, running down to blue.
      ctx.lineWidth = Math.max(2.5, r * 0.16);
      ctx.strokeStyle = cold ? "#5b6bbf" : heat > 0.35 ? "#f2a541" : "#e5484d";
      ctx.beginPath();
      ctx.ellipse(x + shake, y, r * 1.12 + 3.5, r * 0.92 + 3.5, 0, -HALF_PI, -HALF_PI + TAU * Math.max(cold ? 1 : 0, heat));
      ctx.stroke();
    }
    // Words over the guests: a cheer and the points, or a grumble.
    for (let s = 0; s < NSEAT; s++) {
      const t = MT[s]!, mk = MK[s]!;
      if ((mk !== 1 && mk !== 2) || t > 1.4) continue;
      const u = t / 1.4, px = Math.round(Math.max(11, Math.min(17, HEADP[s * 3 + 2]! * 0.24))), lift = u * 26;
      ctx.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
      const x = HEADP[s * 3]!, y = HEADP[s * 3 + 1]! - 22 - lift;
      if (mk === 1) sticker(ctx, YUM[MW[s]! % YUM.length]!, x, y, px, "#ffd36b", "#1f2433"), MP[s] && sticker(ctx, "+" + MP[s], x, y - px - 14, px - 1, "#7fcfa8", "#1f2433");
      else sticker(ctx, GRR[MW[s]! % GRR.length]!, x, y, px, "#9aa6bf", "#1f2433");
      ctx.globalAlpha = 1;
    }
    // The ends: where the dishes come out.
    if (m === PLAY || m === BREAK) {
      const px = Math.max(10, Math.min(13, Math.round(W / 70)));
      if (dio.project(NX[HEAD]! - 0.6, TOPY + 0.05, 1.7, tmp)) sticker(ctx, "KITCHEN", tmp[0]!, tmp[1]!, px, "#fffaf1", "#1f2433");
      if (S[BOTH] && dio.project(NX[FOOT]! + 0.6, TOPY + 0.05, 1.7, tmp)) sticker(ctx, "PANTRY", tmp[0]!, tmp[1]!, px, "#fffaf1", "#1f2433");
    }
    if (toastT > 0) {
      const u = 1 - toastT / toastL, s = u < 0.12 ? 0.6 + (u / 0.12) * 0.48 : u < 0.22 ? 1.08 - ((u - 0.12) / 0.1) * 0.08 : 1;
      const px = Math.round(Math.max(17, Math.min(30, W / 24)));
      ctx.save();
      ctx.globalAlpha = u < 0.12 ? u / 0.12 : u > 0.82 ? (1 - u) / 0.18 : 1;
      ctx.translate(W / 2, V[3]! + 6 + px);
      ctx.rotate(-0.03);
      ctx.scale(s, s);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, toastK === 2 ? "#ffffff" : "#1f2433");
      ctx.restore();
    }
    if (m === DONE && doneT > 0.4) {
      const u = Math.min(1, (doneT - 0.4) / 0.3), px = Math.round(Math.max(20, Math.min(36, W / 20)));
      ctx.save();
      ctx.globalAlpha = u;
      ctx.translate(W / 2, V[3]! + 10 + px);
      ctx.rotate(-0.035);
      ctx.scale(0.7 + u * 0.3, 0.7 + u * 0.3);
      sticker(ctx, "DINNER IS SERVED", 0, 0, px, "#ffd36b", "#1f2433");
      ctx.restore();
    }
  }
  const MP = new Float64Array(NSEAT);
  function toast(text: string, kind: number, l = 1.4) {
    (toastS = text), (toastK = kind), (toastT = toastL = l);
    say(text);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the camera: framed once for the shape ----
  const FIT = new Float64Array(36);
  let port = false;
  function frame() {
    port = dio.width / dio.height < 1.1;
    const c = dio.cam;
    (c.yaw = port ? -HALF_PI + 0.12 : -0.06), (c.pitch = port ? 0.6 : 0.74), (c.fov = 0.6), (c.tx = 0), (c.ty = TOPY), (c.tz = 0);
    // The table, every guest's head and the bubbles over the far side, the near side's chairs.
    FIT.set([-HL - 0.4, 1.0, HD + 0.3, HL + 0.4, 1.0, HD + 0.3, -HL, TOPY, -HD, HL, TOPY, -HD, -6.4, 4.1, -GZ, 6.4, 4.1, -GZ, -6.4, 3.4, GZ, 6.4, 3.4, GZ, -6.6, 0.4, GZ + 0.5, 6.6, 0.4, GZ + 0.5, -HL - 0.4, 0.4, 0, HL + 0.4, 0.4, 0]);
    dio.fit(c, FIT, { x0: 14, x1: dio.width - 14, y0: V[3]!, y1: Math.max(V[3]! + 80, dio.height - V[4]!) });
  }

  // ---- dishes moving ----
  /** Where dish i rests at its node: the node, shifted when another dish shares it. */
  function restAt(i: number, out: Float64Array) {
    const n = f.DN[i]!;
    let k = 0, c = 0;
    for (let j = 0; j < RUN_N; j++) if (j === i || (f.DS[j] === D_TABLE && VS[j]! >= 1 && VS[j]! <= 2 && f.DN[j] === n && QL[j] === 0)) (c++, j < i && k++);
    const off = (k - (c - 1) / 2) * 0.62, end = NODE_SEAT[n]! < 0;
    out[0] = NX[n]! + (end ? 0 : off);
    out[1] = NZ[n]! + (end ? off : 0);
  }
  const RA = new Float64Array(2);
  function stepDishes(dt: number) {
    let on = false;
    for (let i = 0; i < RUN_N; i++) {
      const vs = VS[i]!;
      if (!vs || vs === 4) continue;
      on = true;
      const ob = roots[i]!;
      VT[i] = VT[i]! + dt;
      if (vs === 1) {
        // Out of the kitchen: it drops onto the end of the table with a little bounce.
        const t = VT[i]!;
        VY[i] = t < 0.22 ? 1.1 * (1 - (t / 0.22) ** 2) : t < 0.42 ? Math.sin(((t - 0.22) / 0.2) * Math.PI) * 0.16 : 0;
        if (t >= 0.42) (VS[i] = 2), (VY[i] = 0);
      }
      if (VS[i] === 2 && QL[i]) {
        // Hop to the next place in its queue: a quick slide.
        const to = Q[i * QN + QH[i]!]!, dur = 0.16 / (1 + (QL[i]! - 1) * 0.5);
        HT[i] = HT[i]! + dt / dur;
        const u = Math.min(1, HT[i]!), e = u * u * (3 - 2 * u);
        VX[i] = HX[i]! + (NX[to]! - HX[i]!) * e;
        VZ[i] = HZ[i]! + (NZ[to]! - HZ[i]!) * e;
        VY[i] = Math.sin(u * Math.PI) * 0.06;
        ob.rot[2] = Math.sin(u * Math.PI) * 0.06 * (NX[to]! > HX[i]! ? -1 : 1);
        if (u >= 1) {
          (QH[i] = (QH[i]! + 1) % QN), (QL[i] = QL[i]! - 1), (HT[i] = 0), (HX[i] = VX[i]!), (HZ[i] = VZ[i]!), (ob.rot[2] = 0);
          const s = NODE_SEAT[to]!;
          // The guest it passes hands it on.
          if (s >= 0 && (QL[i] || f.DS[i] === D_TABLE) && !MK[s]) (MK[s] = 3), (MT[s] = 0), (HAND[s] = NX[(to + 1) % NN]! > NX[to]! ? 1 : -1);
        }
      } else if (VS[i] === 2) {
        if (f.DS[i] !== D_TABLE) {
          // Served: onto the plate.
          (VS[i] = 3), (VT[i] = 0), (HX[i] = VX[i]!), (HZ[i] = VZ[i]!);
        } else {
          restAt(i, RA);
          const k = 1 - Math.exp(-dt * 14);
          VX[i] = VX[i]! + (RA[0]! - VX[i]!) * k;
          VZ[i] = VZ[i]! + (RA[1]! - VZ[i]!) * k;
          VY[i] = VY[i]! * (1 - k);
        }
      }
      if (VS[i] === 3) {
        const s = f.DW[i]!, t = Math.min(1, VT[i]! / 0.3), e = t * t * (3 - 2 * t);
        VX[i] = HX[i]! + (seatX(s) - HX[i]!) * e;
        VZ[i] = HZ[i]! + (side(s) * PLZ - HZ[i]!) * e;
        VY[i] = Math.sin(t * Math.PI) * 0.25;
        if (t >= 1) {
          // Eaten: the dish goes; a portion stays on the plate.
          VS[i] = 4;
          ob.hidden = true;
          for (const p of parts[i]!) p.hidden = true;
          const n = Math.min(3, f.NSERVED[s]!) - 1, fd = food[s * 3 + Math.max(0, n)]!;
          recolor(fd, KCOL[f.DK[i]!]!);
          fd.hidden = false;
          if (f.DS[i] === 2) for (let q = 0; q < 8; q++) spawn(0, seatX(s) + (rnd() - 0.5) * 0.5, TOPY + 0.2, side(s) * PLZ, 0, 0.5 + rnd() * 0.3, 0, 0.8 + rnd() * 0.4);
        }
      }
      (ob.pos[0] = VX[i]!), (ob.pos[1] = VY[i]!), (ob.pos[2] = VZ[i]!);
    }
    return on;
  }
  /** Dish i goes to node n next (after any hops already queued). */
  function queue(i: number, n: number) {
    if (QL[i]! >= QN) {
      // Too far ahead: jump the oldest.
      (QH[i] = (QH[i]! + 1) % QN), (QL[i] = QL[i]! - 1);
    }
    Q[i * QN + ((QH[i]! + QL[i]!) % QN)] = n;
    if (!QL[i]) (HX[i] = VX[i]!), (HZ[i] = VZ[i]!), (HT[i] = 0);
    QL[i] = QL[i]! + 1;
  }
  /** Dish i comes out at its end. */
  function bringOut(i: number) {
    const k = f.DK[i]!, ob = roots[i]!;
    dishParts(i, k);
    restAt(i, RA);
    (VX[i] = RA[0]!), (VZ[i] = RA[1]!), (VY[i] = 1.1), (HX[i] = VX[i]!), (HZ[i] = VZ[i]!);
    (VS[i] = 1), (VT[i] = 0), (QL[i] = 0), (QH[i] = 0), (STEAM[i] = 0);
    ob.hidden = false;
    ob.rot.fill(0);
    for (const p of parts[i]!) p.hidden = false;
    for (let q = 0; q < 10; q++) spawn(0, VX[i]! + (rnd() - 0.5) * 0.8, TOPY + 0.3, VZ[i]! + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, 0.7 + rnd() * 0.4, 0, 0.9 + rnd() * 0.5);
  }

  // ---- the guests ----
  function stepGuests(dt: number) {
    let on = false;
    const m = f.S[MODE]!;
    for (let s = 0; s < NSEAT; s++) {
      if (BT[s]! >= 0) BT[s] = f.WANT[s]! >= 0 ? BT[s]! + dt : -1;
      if (f.WANT[s]! >= 0 && BT[s]! < 0) BT[s] = 0;
      if (BT[s]! >= 0 && BT[s]! < 0.5) on = true;
      const u = ups[s]!, h = heads[s]!, al = armL[s]!, ar = armR[s]!;
      let la = -0.3, ra = -0.3, lean = 0, bob = 0, turn = 0, lz = -0.08, rz = 0.08;
      const mk = MK[s]!, t = Math.max(0, (MT[s] = MT[s]! + dt));
      if (mk === 1) {
        // A cheer: both arms up, a bounce.
        const e = t < 0.2 ? t / 0.2 : t < 1.0 ? 1 : Math.max(0, 1 - (t - 1.0) / 0.35);
        la = ra = -0.3 - 2.35 * e;
        bob = Math.abs(Math.sin(t * 11)) * 0.09 * e;
        (lz = -0.08 - 0.35 * e), (rz = 0.08 + 0.35 * e);
        if (t > 1.35) MK[s] = 0;
      } else if (mk === 2) {
        // A grumble: a slump, the arms down, the head shakes.
        const e = t < 0.2 ? t / 0.2 : t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 0.35);
        lean = 0.2 * e;
        la = ra = -0.05 * e - 0.3 * (1 - e);
        turn = Math.sin(t * 13) * 0.32 * e;
        if (t > 1.45) MK[s] = 0;
      } else if (mk === 3) {
        // Handing a dish on: a quick reach that way.
        const e = Math.sin(Math.min(1, t / 0.32) * Math.PI);
        (HAND[s]! * side(s) > 0 ? (ra = -0.3 - 0.9 * e) : (la = -0.3 - 0.9 * e));
        turn = HAND[s]! * side(s) * 0.25 * e;
        if (t > 0.32) MK[s] = 0;
      }
      if (m === DONE && doneT >= 0) {
        // The toast: the right arm (the glass) up, a little in toward the middle.
        const d = doneT - 0.15 - (s % 6) * 0.06, e = Math.max(0, Math.min(1, d / 0.55));
        ra = -0.3 - 2.25 * (e * e * (3 - 2 * e));
        rz = 0.08 - 0.2 * e;
        if (doneT < 3.2) on = true;
      }
      if (mk) on = true;
      (al.rot[0] = la), (ar.rot[0] = ra), (al.rot[2] = lz), (ar.rot[2] = rz);
      u.rot[0] = lean;
      u.pos[1] = 1.08 + bob;
      h.rot[1] = turn;
      // The glass: on the table, or in the right hand at the toast.
      const g = glasses[s]!;
      if (m === DONE && doneT >= 0 && ar.M && al.M) {
        const d = doneT - 0.15 - (s % 6) * 0.06, e = Math.max(0, Math.min(1, d / 0.55)), M = ar.M;
        // The hand's world spot: 0.8 down the arm from the shoulder (the arm's −y axis).
        const hx = M[9]! - M[1]! * 0.82, hy = M[10]! - M[4]! * 0.82, hz = M[11]! - M[7]! * 0.82;
        const gx = seatX(s) + 0.74, gz = side(s) * 1.22, w = Math.min(1, e * 1.6);
        (g.pos[0] = gx + (hx - gx) * w), (g.pos[1] = TOPY + (hy - 0.1 - TOPY) * w), (g.pos[2] = gz + (hz - gz) * w);
        g.rot[2] = (seatX(s) > 0 ? 0.18 : -0.18) * e;
      } else (g.pos[0] = seatX(s) + 0.74), (g.pos[1] = TOPY), (g.pos[2] = side(s) * 1.22), (g.rot[2] = 0);
    }
    // The pantry door swings open for both ways.
    pantryTo = f.S[BOTH] ? 1.9 : 0;
    if (Math.abs(pantryTo - pantryA) > 0.002) (pantryA += (pantryTo - pantryA) * Math.min(1, dt * 4)), (on = true);
    hinge.rot[1] = pantryA;
    // The candles flicker while anything moves.
    for (let c = 0; c < flames.length; c++) flames[c]!.rot[2] = Math.sin(tAmb * 7 + c * 1.7) * 0.12;
    return on;
  }

  // ---- the frame ----
  function reset(s: number, run: boolean) {
    seed = s >>> 0;
    f = table(seed);
    rnd = seeded(seed * 17 + 5);
    fx.fill(0);
    toastT = 0;
    doneT = -1;
    ended = false;
    buildScene();
    card.hidden = run;
    card.classList.toggle("tt-start", !run);
    if (!run) {
      cardT.textContent = "Table for Twelve";
      cardP.hidden = false;
      cardS.textContent = "";
      go.textContent = "SERVE DINNER";
    }
    V[0] = 1;
    hudDirty = dirty = true;
    engine.wake();
  }
  function start() {
    const m = f.S[MODE]!;
    if (m === PLAY || m === BREAK) return;
    if (m === DONE) reset(seed + 1, true);
    f.start();
    onEvents();
    card.hidden = true;
    play.focus({ preventScroll: true });
  }
  /** What the last model call did: sounds, toasts, the dishes moving along. */
  function onEvents() {
    const ev = f.ev, S = f.S, e = engine.events;
    if (ev[EV_START]) e.emit("start");
    if (ev[EV_COURSE]) {
      const c = S[COURSE]!;
      if (c) e.emit("course");
      toast(ev[EV_TWIST] ? "PASS BOTH WAYS!" : c ? `COURSE ${c + 1} · QUICKER!` : "PASS IT ON!", ev[EV_TWIST] ? 1 : 3, ev[EV_TWIST] ? 1.9 : 1.4);
    }
    if (ev[EV_SPAWN]) e.emit("out"), bringOut(S[LDISH]!);
    if (ev[EV_REFUSE]) e.emit("refuse"), toast("ONE WAY: PASS IT ON!", 2, 1.1);
    if (ev[EV_PASS]) {
      e.emit("pass");
      const i = S[LPASS]!;
      if (i >= 0) queue(i, f.DN[i]!);
    }
    if (ev[EV_HOT] || ev[EV_COLD]) {
      const s = S[LSEAT]!;
      // The guest reacts once the dish has slid all the way over.
      (MK[s] = ev[EV_HOT] ? 1 : 2), (MT[s] = -(QL[Math.max(0, S[LPASS]!)]! * 0.12 + 0.2)), (MW[s] = (S[SERVED]! * 7 + s) % 12), (MP[s] = S[LPTS]!);
      if (ev[EV_HOT]) e.emit("hot"), say(`Hot ${NAMES[lastKind(s)]} for seat ${s + 1}: +${S[LPTS]}`);
      else e.emit("cold"), say(`Cold ${NAMES[lastKind(s)]} for seat ${s + 1}`);
    }
    if (ev[EV_CHILL]) say("A dish went cold");
    if (ev[EV_DONE]) e.emit("done"), (doneT = 0);
    hudDirty = dirty = true;
    engine.wake();
  }
  /** The kind last served at seat s. */
  function lastKind(s: number) {
    let k = 0;
    for (let i = 0; i < RUN_N; i++) if (f.DW[i] === s && f.DS[i]! >= 2) k = f.DK[i]!;
    return k;
  }
  function act(changed: boolean) {
    void changed;
    onEvents();
  }
  /** Pass the held dish on (+1) or back (−1). */
  function passDir(d: number) {
    act(f.pass(d));
  }
  /** An arrow: pass to the neighbour that lies most that way on screen (dx, dy), if any does. */
  function arrow(dx: number, dy: number) {
    const S = f.S, i = S[SEL]!;
    if (S[MODE] !== PLAY || i < 0) return;
    const n = f.DN[i]!;
    let best = 0.35, bd = 0;
    dio.project(NX[n]!, TOPY, NZ[n]!, tmp);
    for (let d = 1; d >= -1; d -= 2) {
      const to = (n + d + NN) % NN;
      dio.project(NX[to]!, TOPY, NZ[to]!, tmp2);
      const ex = tmp2[0]! - tmp[0]!, ey = tmp2[1]! - tmp[1]!, l = Math.sqrt(ex * ex + ey * ey) || 1, dot = (ex * dx + ey * dy) / l;
      if (dot > best) (best = dot), (bd = d);
    }
    if (bd) passDir(bd);
  }
  function showEnd() {
    const S = f.S;
    cardT.textContent = S[HOT] === RUN_N ? "Every dish hot!" : "Seconds, anyone?";
    cardP.hidden = true;
    cardS.textContent = `Hot ${S[HOT]}/${RUN_N} · Cold ${S[COLD]} · Best streak ${S[BEST]} · Score ${S[SCORE]}`;
    go.textContent = "ANOTHER DINNER";
    card.classList.remove("tt-start");
    card.hidden = false;
    say(`Dinner is served. ${S[HOT]} of ${RUN_N} hot. Score ${S[SCORE]}.`);
    go.focus({ preventScroll: true });
  }
  let ended = false;
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
        dirty = true;
      }
      if (first) (first = null), start();
    },
    step(e, dt) {
      tAmb += dt;
      const S = f.S, m = S[MODE]!;
      if (m === PLAY || m === BREAK) {
        f.step(dt);
        onEvents();
        if (auto && (autoT += dt) > 0.3) (autoT = 0), autopilot(f), onEvents();
      }
      if (S[MODE] === DONE && doneT >= 0) {
        const was = doneT;
        doneT += dt;
        if (was < 1.0 && doneT >= 1.0) {
          // The clink: sparkles over every raised glass.
          for (let s = 0; s < NSEAT; s++) {
            const g = glasses[s]!;
            for (let q = 0; q < 5; q++) spawn(1, g.pos[0]!, g.pos[1]! + 0.5, g.pos[2]!, (rnd() - 0.5) * 2, 1.6 + rnd() * 1.4, (rnd() - 0.5) * 2, 0.9 + rnd() * 0.5);
          }
          toast("CHEERS!", 1, 1.2);
        }
        if (was < 2.4 && doneT >= 2.4 && !ended) (ended = true), showEnd();
      }
      let moving = m === PLAY || m === BREAK;
      steamOn(dt);
      if (stepDishes(dt)) moving = true;
      if (stepGuests(dt)) moving = true;
      if (stepFx(dt)) moving = true;
      if (S[MODE] === DONE && doneT >= 0 && doneT < 2.6) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) (dirty = true), e.busy();
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
    const S = f.S, mode = S[MODE]!;
    if (set(0, S[SCORE]!)) scoreEl.textContent = "" + S[SCORE];
    if (set(1, S[COURSE]!)) courseEl.textContent = S[COURSE]! + 1 + "/" + COURSES;
    if (set(2, S[HOT]!)) hotEl.textContent = "" + S[HOT];
    const i = S[SEL]!;
    const hint = mode === PLAY && i >= 0 ? (coarse ? `Tap the place next to the ${NAMES[f.DK[i]!]} (or drag it) to pass it${S[BOTH] ? " either way" : " on"}.` : `${NAMES[f.DK[i]!]![0]!.toUpperCase() + NAMES[f.DK[i]!]!.slice(1)}: arrows or a click pass it${S[BOTH] ? " either way" : " on"}, Enter again, N the next dish.`) : mode === BREAK ? "Next course coming out…" : "";
    if (set(5, hint)) hintEl.textContent = hint;
    if (set(6, said)) live.textContent = said;
    void STREAK;
  }

  // ---- input ----
  /** The node under (x, y): the nearest place on the cloth, or a guest (their seat's place). */
  function nodeAt(x: number, y: number) {
    let best = Infinity, bn = -1;
    for (let n = 0; n < NN; n++) {
      if (dio.project(NX[n]!, TOPY + 0.2, NZ[n]!, tmp)) {
        const d = (tmp[0]! - x) ** 2 + (tmp[1]! - y) ** 2;
        if (d < best) (best = d), (bn = n);
      }
      const s = NODE_SEAT[n]!;
      if (s >= 0 && dio.project(seatX(s), 2.2, side(s) * GZ, tmp)) {
        const d = ((tmp[0]! - x) ** 2 + (tmp[1]! - y) ** 2) * 1.3;
        if (d < best) (best = d), (bn = n);
      }
    }
    const lim = (dio.focal() / dio.cam.dist) * 1.6;
    return best < lim * lim ? bn : -1;
  }
  /** A press or a drag over node n: pass the held dish there if it is next to it; else hold a dish there. */
  function touch(n: number, press: boolean) {
    const S = f.S, i = S[SEL]!;
    if (n < 0 || S[MODE] !== PLAY) return;
    if (i >= 0 && n !== f.DN[i] && (hopsOn(f.DN[i]!, n) === 1 || hopsOn(n, f.DN[i]!) === 1)) return act(f.passTo(n));
    if (!press) return;
    for (let j = 0; j < RUN_N; j++) if (f.DS[j] === D_TABLE && f.DN[j] === n && j !== i) return void act(f.select(j));
  }
  let dragging = false;
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (f.S[MODE] === IDLE) return void start();
    if (f.S[MODE] !== PLAY) return;
    play.setPointerCapture?.(e.pointerId);
    dragging = true;
    touch(nodeAt(e.offsetX, e.offsetY), true);
  }, sig);
  play.addEventListener("pointermove", (e) => dragging && e.isPrimary && touch(nodeAt(e.offsetX, e.offsetY), false), sig);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) play.addEventListener(t, () => (dragging = false), sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code, playing = f.S[MODE] === PLAY;
    if (c === "KeyM") return void (e.preventDefault(), toggle());
    if ((c === "Space" || c === "Enter") && (e.target as Element).closest?.(".gk-bar, .tt-card")) return;
    if (c === "Space" || c === "Enter") !e.repeat && (playing ? passDir(f.S[DIR]!) : f.S[MODE] !== BREAK && start());
    else if (!playing) return;
    else if (c === "ArrowLeft" || c === "KeyA") arrow(-1, 0);
    else if (c === "ArrowRight" || c === "KeyD") arrow(1, 0);
    else if (c === "ArrowUp" || c === "KeyW") arrow(0, -1);
    else if (c === "ArrowDown" || c === "KeyS") arrow(0, 1);
    else if (c === "KeyN") act(f.cycle(e.shiftKey ? -1 : 1));
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

  /** The poster (scripts/gallery-posters.mjs): the autopilot's dinner, into the second course. */
  function poster() {
    V[2] = 0.6;
    reset(20261125, true);
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
      const S = f.S, i = S[SEL]!;
      return { mode: S[MODE]!, course: S[COURSE]!, score: S[SCORE]!, hot: S[HOT]!, cold: S[COLD]!, card: !card.hidden, held: i, node: i >= 0 ? f.DN[i]! : -1, served: f.S[5]! };
    },
    at(n: number) {
      dio.project(NX[n]!, TOPY + 0.2, NZ[n]!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    autoplay(on: boolean) {
      auto = on;
      engine.wake();
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster: the autopilot's dinner, a few dishes out and steaming (scripts/gallery-posters.mjs). */
export const posterAt = 4.6;
