// "Salvo Bay" (hero): a ship-hunting duel on a cutaway tabletop diorama. Two glass trays of water sit
// on a wooden plinth in the corner of a room: your bay and the enemy's, with a dock, a fort on the
// enemy shore and a lighthouse. Place your four ships (pick one on the dock, then a cell; R turns it;
// RANDOM; START), then trade shells with the bot: a shell arcs over the table, a miss splashes and
// leaves a white peg, a hit bursts into fire and smoke and leaves a red one, a sunk ship rolls over
// and settles to the bottom, seen faintly through the water. Views: AUTO follows the turn, or both
// bays, yours or theirs; drag orbits. Dark is the bay at night under the lighthouse's sweeping beam.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D: shapes, the depth sort with the effects in it,
// shadows, picking), @fzlt/core/slot, @fzlt/core/sound. The game is ./model.ts, pure and seeded
// (tests/salvo-bay.test.mjs); this file is the scene and the controls (tests/salvo-bay.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { BATTLE, FLEET, HIT, MISS, N, NAMES, OVER, PLACE, SUNK, begin, botPick, canPlace, fire, newMatch, place, randomFleet, ready, shipsLeft, unplace, type Match } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
// The palettes: day (light) and night (dark), by role.
const LIGHT = {
  bg: "#efe8de", floor: "#d9d3ca", rug: "#f3cdbf", rug2: "#f7dccf", wallB: "#f2ddd0", wallR: "#d3e5dd", base: "#c69a6f", top: "#e4c196", bed1: "#4f8fb5", bed2: "#6db0cf", water: "#a8def0",
  rim: "#f7f2e8", glass: "#e3f4fb", dock: "#ddb689", plank: "#b98f63", bollard: "#6f6a78", lhBase: "#aeb0bd", lhW: "#faf6ee", lhR: "#ee8270", lhDark: "#5f6678", lamp: "#ffe7a0", roof: "#e66d5f",
  basin: "#a3dcee", buoyR: "#ef7d6a", buoyW: "#fbf7f0", fort: "#cfc9d6", fortTop: "#bdb6c6", crate: "#dcab72", pot: "#e39a74", leaf: "#8fcf9b", leaf2: "#b0dfa8", pole: "#6e6878",
  frame: "#f8f4eb", pic: "#a6d6ea", sun: "#f7d27a", blind: "#ef9f98",
  you0: "#f08e6f", you1: "#7fcfa8", you2: "#a99be0", you3: "#f2c96b", foe: "#8f9dc6", deck: "#fbf4e6", cabin: "#ffffff", foeDeck: "#e7e4f0", funnel: "#5f6b8a", foeFunnel: "#e2675c", cap: "#3d4255",
  flagYou: "#f08e6f", flagFoe: "#e2675c", pegHit: "#e5484d", pegMiss: "#ffffff", bad: "#ef6b6b", shadow: "#3a2d3c",
  grid: "rgba(255,255,255,0.6)", gridShade: "rgba(40,90,120,0.18)", light: [0.55, 1, 0.42], amb: 0.5, smoke: "#9d98a6", drop: "#ffffff", night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#141a2c", floor: "#2b3047", rug: "#3c3658", rug2: "#463f66", wallB: "#2f3654", wallR: "#283f47", base: "#7d5c45", top: "#987452", bed1: "#14385a", bed2: "#1d5275", water: "#3f8aac",
  rim: "#cfcadb", glass: "#9cc6d9", dock: "#94724f", plank: "#6d5139", lhW: "#dfdae6", lhR: "#c9615a", lamp: "#fff4b8", basin: "#3b7f9c", frame: "#c9c4d4", pic: "#41708a", sun: "#f0e2a4", blind: "#a96a72",
  shadow: "#000000", grid: "rgba(200,235,255,0.42)", gridShade: "rgba(0,0,0,0.2)", light: [0.4, 1, 0.55], amb: 0.44, smoke: "#6f7384", drop: "#d9f1ff", night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night">;

// The table: plinth top PT, three water bands to the surface WY, the trays' centres (TX, TZ); hulls
// under the water line draw on their own layer, under the water (seen faintly through it).
const PT = 1.24, BED1 = 0.3, BED2 = 0.22, WTR = 0.25, WY = PT + BED1 + BED2 + WTR, TZ = -1.6, TX = [-5, 5];
const BELOW = { y: WY - 0.02, layer: 2 };
const DOCK = { x: -5, z: 5.1 }, SLOTS = [-2.3, -0.68, 2.15, -0.68, -2.75, 0.72, 1.35, 0.72], FORT = { x: 9, z: 5 }, LH = { x: 10.2, z: -4.7 };
/** Seconds the water keeps bobbing after the last thing that happened; then it settles. */
const ALIVE = 6;
// Particles: x y z, vx vy vz, life, max life, type (0 drop, 1 spark, 2 fire, 3 smoke, 4 flash), size.
const PART = 260, PS = 10;
// Timed beats (a fixed table, no closures): what runs, and when.
const T_VIEW = 1, T_BOT = 2, T_TURN = 3, T_END = 4, T_POSTER = 5;
const VIEWS = ["auto", "both", "mine", "enemy"];

export type SalvoScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly m: Match;
  readonly state: { phase: number; turn: number; anim: number; shell: boolean; view: string; sel: number; cursor: number; sinking: number; card: boolean; tween: boolean };
  /** The screen point of cell c on side s's bay (CSS px from the stage's top left), as of the last draw. */
  cellScreen(s: number, c: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SalvoScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the HUD
  // stickers, the end card and the keys bar. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "sb-play";
  play.setAttribute("aria-label", "Salvo Bay: arrows move the cursor, Enter or Space places or fires, R turns a ship, 1 to 4 pick one, X random fleet, S start, V view (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "sb-hud";
  hud.innerHTML = `<div class="sb-head"><p class="sb-top"><b class="sb-chip sb-turn">Place your fleet</b><b class="sb-chip sb-n"><i class="sb-dot"></i>You <span>4</span><i class="sb-dot sb-foe"></i>Enemy <span>4</span> · Shots <span>0</span></b></p><p class="sb-hint"></p></div><p class="sb-live" aria-live="polite"></p><div class="sb-card" role="dialog" aria-label="Game over" hidden><b></b><p></p><p class="sb-stats"></p><button type="button" class="bui-key sb-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const turnEl = top.children[0] as HTMLElement, nums = top.children[1]!.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { fire: "fire", splash: "click", hit: "hit", sunk: "boom", place: "click", bad: "hurt", start: "ready", win: "win", lose: "end" }, volume: 0.1 });
  // The keys: mute, then the placement keys and the view.
  const K_MUTE = 0, K_ROT = 1, K_RND = 2, K_GO = 3, K_VIEW = 4;
  const [muteK, rotK, rndK, goK, viewK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "ROTATE", aria: "Rotate the ship (R)", id: K_ROT },
    { label: "RANDOM", aria: "Random fleet (X)", id: K_RND },
    { label: "START", aria: "Start the battle (S)", id: K_GO, c: "sb-go" },
    { label: "VIEW · AUTO", aria: "Camera view (V)", id: K_VIEW },
  ], (id, down) => {
    if (!down) return;
    alive();
    if (id === K_MUTE) toggle();
    else if (id === K_ROT) rotate();
    else if (id === K_RND) randomize();
    else if (id === K_GO) startBattle();
    else cycleView();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  // The view key: "VIEW ·" on a wide stage, the view's name alone on a narrow one.
  viewK!.innerHTML = `<span class="sb-vl">VIEW ·&nbsp;</span><b>AUTO</b>`;
  const viewName = viewK!.lastChild as HTMLElement;
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
  let m: Match = newMatch(1), seed = 1, botRnd = seeded(1), fxRnd = seeded(1), pegN = 0, randN = 0;
  // Per ship (side * 4 + i): its root, its parts, the drop-in (own ships), its sink time (−1: afloat).
  const ships: DioramaObject[] = [], parts: DioramaObject[][] = [], drops = new Float64Array(8), sinkT = new Float64Array(8).fill(-1);
  let fx0: DioramaPoints, fx1: DioramaPoints, shellPts: DioramaPoints;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = pegN = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("base", { fixed: 1 });
    // The room: floor slab, two backdrop walls, rug, a picture, a blind, a plant (the cutaway corner).
    put({ id: "floor", size: [40, 0.5, 30], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [40.6, 11, 0.5], pos: [0, -0.5, -15.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "wallR", size: [0.5, 11, 30], pos: [20.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3, pick: false });
    put({ id: "rug", size: [29, 0.05, 20], on: "floor", pos: [0, 0, 1], color: "rug", layer: 0.2, pick: false });
    put({ id: "rug2", size: [27, 0.02, 18], on: "rug", color: "rug2", layer: 0.21, pick: false });
    put({ id: "pic", size: [6, 3.6, 0.16], pos: [-6, 5.2, -15], color: "frame", cluster: "room", layer: 0.6, pick: false });
    put({ id: "picIn", size: [5.2, 2.8, 0.06], on: "pic", pos: [0, -3.2, 0.1], color: "pic", layer: 0.7, pick: false });
    put({ id: "picSun", shape: "cyl", sides: 10, size: [1, 0.05, 1], rot: [Math.PI / 2, 0, 0], on: "picIn", pos: [1.3, -1.2, 0.05], color: "sun", layer: 0.8, pick: false });
    for (let i = 0; i < 7; i++) put({ size: [0.12, 0.5, 5], pos: [20, 3.4 + i * 0.6, -6], color: "blind", cluster: "room", layer: 0.6, pick: false });
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.2, size: [1.8, 1.5, 1.8], pos: [-15.5, 0, -11.5], color: "pot", cluster: "room", layer: 1, shadow: 0.2, on: "floor", pick: false });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.45, size: [3, 2, 3], on: "pot", color: "leaf", layer: 1, pick: false });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [2.1, 1.8, 2.1], on: "leaf", color: "leaf2", layer: 1, pick: false });
    // The plinth: a wooden tabletop the bay sits on.
    put({ id: "plinth", size: [23.2, PT - 0.14, 13.6], on: "floor", color: "base", cluster: "base", layer: 0, shadow: 0.22, pick: false });
    put({ id: "top", size: [23.8, 0.14, 14.2], on: "plinth", color: "top", layer: 0.4, pick: false });
    // Two trays: three water bands, opaque rims behind, glass in front.
    for (let s = 0; s < 2; s++) {
      const x = TX[s]!, cl = "tray" + s, rh = WY - PT + 0.1;
      dio.cluster(cl, { at: [x, WY, TZ] });
      put({ id: "bed1" + s, size: [8, BED1, 8], on: "top", pos: [x, 0, TZ], color: "bed1", cluster: cl, layer: 1, mask: 62, pick: false });
      put({ id: "bed2" + s, size: [8, BED2, 8], on: "bed1" + s, color: "bed2", layer: 1, pick: false });
      put({ id: "water" + s, size: [8, WTR, 8], on: "bed2" + s, color: "water", layer: 3, alpha: 0.84, pick: false });
      put({ size: [8.8, rh, 0.4], on: "top", pos: [x, 0, TZ - 4.2], color: "rim", cluster: cl, layer: 4, pick: false });
      put({ size: [0.4, rh, 8], on: "top", pos: [x + 4.2, 0, TZ], color: "rim", cluster: cl, layer: 4, pick: false });
      put({ size: [8.8, rh, 0.4], on: "top", pos: [x, 0, TZ + 4.2], color: "glass", alpha: 0.32, cluster: cl, layer: 6, pick: false });
      put({ size: [0.4, rh, 8], on: "top", pos: [x - 4.2, 0, TZ], color: "glass", alpha: 0.32, cluster: cl, layer: 6, pick: false });
      put({ size: [8.8, 0.12, 0.42], on: "top", pos: [x, 0, TZ + 4.2], color: "rim", cluster: cl, layer: 6.5, pick: false });
      put({ size: [0.42, 0.12, 8], on: "top", pos: [x - 4.2, 0, TZ], color: "rim", cluster: cl, layer: 6.5, pick: false });
      dio.decal(cl, 3.6, (ctx) => trayDecals(ctx, s));
    }
    // The dock (the fleet starts here), its planks and bollards; crates by it.
    dio.cluster("dock", { at: [DOCK.x, PT, DOCK.z] });
    put({ id: "dock", size: [9.4, 0.2, 3.1], on: "top", pos: [DOCK.x, 0, DOCK.z], color: "dock", cluster: "dock", layer: 1, shadow: 0.18, pick: false });
    for (let i = 0; i < 5; i++) put({ size: [9.4, 0.012, 0.05], on: "dock", pos: [0, 0, -1.25 + i * 0.62], color: "plank", layer: 1.2, pick: false });
    for (let i = 0; i < 4; i++) put({ shape: "cyl", sides: 8, size: [0.28, 0.32, 0.28], on: "dock", pos: [i & 1 ? 4.5 : -4.5, 0, i & 2 ? 1.35 : -1.35], color: "bollard", layer: 3, shadow: 0.2, pick: false });
    put({ id: "crate0", size: [1, 0.9, 1], on: "top", pos: [-10.6, 0, 5.3], rot: [0, 0.2, 0], color: "crate", shadow: 0.2, cluster: "crates", pick: false });
    put({ size: [0.8, 0.7, 0.8], on: "crate0", rot: [0, -0.5, 0], color: "crate", pick: false });
    put({ size: [0.9, 0.8, 0.9], on: "top", pos: [-10.5, 0, 3.9], rot: [0, -0.15, 0], color: "crate", shadow: 0.2, cluster: "crates2", pick: false });
    // The enemy shore: a small basin with buoys, and the fort they fire from.
    dio.cluster("shore", { at: [5, PT, 5] });
    put({ id: "basin", size: [6.6, 0.1, 2.6], on: "top", pos: [3.9, 0, 5.1], color: "basin", cluster: "shore", layer: 1, pick: false });
    for (let i = 0; i < 3; i++) {
      put({ id: "buoy" + i, shape: "cyl", sides: 8, top: 0.8, size: [0.5, 0.36, 0.5], on: "basin", pos: [[1.5, 3.6, 5.4][i]! - 3.9, 0, [-0.4, 0.5, -0.3][i]!], color: "buoyR", layer: 3, shadow: 0.18, pick: false });
      put({ id: "buoyW" + i, shape: "cyl", sides: 8, top: 0.7, size: [0.4, 0.24, 0.4], on: "buoy" + i, color: "buoyW", layer: 3, pick: false });
      put({ shape: "cyl", sides: 8, top: 0, size: [0.28, 0.3, 0.28], on: "buoyW" + i, color: "buoyR", layer: 3, pick: false });
    }
    put({ id: "fort", size: [1.8, 1, 1.6], on: "top", pos: [FORT.x, 0, FORT.z], color: "fort", cluster: "shore", layer: 3, shadow: 0.2, pick: false });
    for (let i = 0; i < 4; i++) put({ size: [0.4, 0.3, 0.4], on: "fort", pos: [i & 1 ? 0.65 : -0.65, 0, i & 2 ? 0.55 : -0.55], color: "fortTop", layer: 3, pick: false });
    put({ id: "fmast", shape: "cyl", sides: 6, size: [0.07, 1.2, 0.07], on: "fort", color: "pole", layer: 3, pick: false });
    put({ size: [0.6, 0.36, 0.04], on: "fmast", pos: [0.32, -0.42, 0], color: "flagFoe", layer: 3, pick: false });
    // The lighthouse: a stack of red and white rings, the gallery, the lamp (unshaded), the roof.
    dio.cluster("lh", { at: [LH.x, PT + 2, LH.z] });
    put({ id: "lh0", shape: "cyl", sides: 9, top: 0.85, size: [2.2, 0.45, 2.2], on: "top", pos: [LH.x, 0, LH.z], color: "lhBase", shadow: 0.25, cluster: "lh", pick: false });
    let w = 1.3, prev = "lh0";
    for (let i = 0; i < 4; i++) put({ id: "lt" + i, shape: "cyl", sides: 12, top: 0.87, size: [w, 0.7, w], on: prev, color: i & 1 ? "lhR" : "lhW", pick: false }), (prev = "lt" + i), (w *= 0.87);
    put({ id: "lgal", shape: "cyl", sides: 12, size: [1.3, 0.12, 1.3], on: prev, color: "lhDark", pick: false });
    put({ id: "lamp", shape: "cyl", sides: 12, size: [0.66, 0.55, 0.66], on: "lgal", color: "lamp", emissive: true, pick: false });
    put({ id: "lroof", shape: "cyl", sides: 12, top: 0, size: [1, 0.55, 1], on: "lamp", color: "roof", pick: false });
    put({ shape: "cyl", sides: 6, top: 0.3, size: [0.12, 0.3, 0.12], on: "lroof", color: "lhDark", pick: false });
    // The fleets.
    for (let s = 0; s < 2; s++) for (let i = 0; i < 4; i++) addShip(s, i);
    // The effects, in the depth sort: per tray (in its cluster, on the ships' layer, so smoke and
    // sparks sit between the hulls they rise from), and the shell with its trail over everything.
    const fxOpt = (cl: string) => ({ cap: PART, cluster: cl, layer: 4, paint: dot });
    fx0 = dio.points(fxOpt("tray0"));
    fx1 = dio.points(fxOpt("tray1"));
    shellPts = dio.points({ cap: 15, paint: shellDot });
  }
  const dot = (ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) => {
    ctx.fillStyle = p.color[i]!;
    ctx.beginPath();
    ctx.arc(p.sx[i]!, p.sy[i]!, Math.max(0.8, p.sr[i]!), 0, TAU);
    ctx.fill();
  };
  const shellDot = (ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) => {
    const x = p.sx[i]!, y = p.sy[i]!;
    if (i) return dot(ctx, i, p);
    const r = Math.max(2.5, p.sr[0]!);
    ctx.fillStyle = "#3a3f52";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, TAU);
    ctx.fill();
  };
  function hullOutline(L: number) {
    const hl = L / 2 - 0.1, hw = 0.33, b = Math.min(0.55, L * 0.18);
    return [[-hl, -hw * 0.8], [-hl + 0.12, -hw], [hl - b, -hw], [hl, 0], [hl - b, hw], [-hl + 0.12, hw], [-hl, hw * 0.8]];
  }
  /** One ship: a group (the root you pick, which moves, bobs and sinks) and its parts. The enemy's
   *  parts stay hidden until it sinks. */
  function addShip(side: number, i: number) {
    const L = FLEET[i]!, id = (side ? "f" : "y") + i, hull: Key = side ? "foe" : (("you" + i) as Key), deck: Key = side ? "foeDeck" : "deck", fun: Key = side ? "foeFunnel" : "funnel", flag: Key = side ? "flagFoe" : "flagYou";
    const root = put({ id, shape: "group", size: [L - 0.3, 0, 0.66], on: side ? "water1" : "dock", shadow: side ? 0 : 0.22, tag: { side, ship: i }, layer: 4, below: BELOW });
    const list: DioramaObject[] = [];
    const part = (sfx: string, d: DioramaObjectDef & { color?: Key }) => {
      const ob = put({ below: BELOW, hidden: side === 1, layer: 4, ...d, id: id + sfx });
      list.push(ob);
      return ob;
    };
    part("h", { shape: "prism", outline: hullOutline(L), size: [L, 0.42, 0.7], taper: 0.72, on: id, pos: [0, -0.16, 0], color: hull });
    part("d", { size: [L - 0.75, 0.05, 0.52], on: id + "h", pos: [-0.14, 0, 0], color: deck });
    const funnel = (on: string, x: number, h = 0.42) => {
      part("fu" + on + x, { shape: "cyl", sides: 9, size: [0.3, h, 0.3], on, pos: [x, 0, 0], color: fun });
      part("fc" + on + x, { shape: "cyl", sides: 9, size: [0.32, 0.06, 0.32], on: id + "fu" + on + x, color: "cap" });
    };
    const turret = (on: string, x: number, back?: boolean) => {
      part("t" + x, { shape: "cyl", sides: 9, size: [0.38, 0.14, 0.38], on, pos: [x, 0, 0], color: hull });
      part("g" + x, { size: [0.4, 0.06, 0.07], on: id + "t" + x, pos: [back ? -0.2 : 0.2, -0.02, 0], color: "cap" });
    };
    if (i === 0) {
      part("c", { size: [1.75, 0.34, 0.46], on: id + "d", pos: [-0.35, 0, 0], color: "cabin" });
      part("b", { size: [0.6, 0.26, 0.42], on: id + "c", pos: [0.42, 0, 0], color: "cabin" });
      funnel(id + "c", -0.45), funnel(id + "c", -0.02, 0.3);
      part("m", { size: [0.05, 0.5, 0.05], on: id + "b", pos: [0.1, 0, 0], color: "cap" });
      turret(id + "d", 1.25);
    } else if (i === 1) {
      part("c", { size: [0.82, 0.42, 0.46], on: id + "d", pos: [-0.45, 0, 0], color: "cabin" });
      part("w", { shape: "wedge", size: [0.28, 0.42, 0.46], rot: [0, Math.PI, 0], on: id + "d", pos: [0.1, 0, 0], color: "cabin" });
      funnel(id + "c", -0.15);
      part("m", { size: [0.05, 0.42, 0.05], on: id + "c", pos: [0.22, 0, 0], color: "cap" });
      part("r", { size: [0.05, 0.05, 0.34], on: id + "m", color: "cap" });
      turret(id + "d", 0.75);
    } else if (i === 2) {
      part("c", { size: [0.7, 0.3, 0.44], on: id + "d", pos: [-0.1, 0, 0], color: "cabin" });
      funnel(id + "c", -0.08, 0.3);
      turret(id + "d", 0.68), turret(id + "d", -0.92, true);
    } else {
      part("c", { size: [0.6, 0.3, 0.42], on: id + "d", pos: [-0.15, 0, 0], color: "cabin" });
      part("m", { shape: "cyl", sides: 6, size: [0.05, 0.62, 0.05], on: id + "c", pos: [0.05, 0, 0], color: "cap" });
      part("fl", { size: [0.3, 0.17, 0.03], on: id + "m", pos: [0.16, -0.2, 0], color: flag });
    }
    ships[side * 4 + i] = root;
    parts[side * 4 + i] = list;
  }

  // ---- controller state ----
  // sel: the ship being placed (−1 none); hover / cursor: the cell under the pointer / the keyboard's.
  let sel = -1, hover = -1, cursor = 27, view = 0, anim = 0, picked = false, kbd = false, flash = 0, flashCell = -1, tAmb = 0, hudDirty = true, dirty = true;
  const pdir = new Uint8Array(4), ghost = { show: false, ok: true, x: 0, y: 0, dir: 0, i: -1 };
  const shell = { on: false, t: 0, dur: 1, by: 0, cell: 0, res: 0, ship: -1, a: new Float64Array(3), b: new Float64Array(3), h: 3, pos: new Float64Array(3), trail: new Float64Array(42), tn: 0 };
  const fx = new Float32Array(PART * PS), rings = new Float32Array(12 * 5), burning = new Uint8Array(128);
  const TT = new Float64Array(8), TF = new Uint8Array(8);
  const cues = new Uint8Array(8);
  let ncue = 0, toastT = 0, toastK = 0, toastS = "", said = "";
  const CUES = ["", "fire", "splash", "hit", "sunk", "place", "bad", "start", "win", "lose"];
  const cue = (k: number) => ncue < 8 && (cues[ncue++] = k);
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), hit3 = new Float64Array(3), A2 = new Int8Array(2);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset, [5] drawn once.
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** Something happened: keep the water moving a while (a scheduled hold, so settle waits). */
  let aliveT = 0;
  function alive() {
    aliveT = Math.max(aliveT, engine.time + ALIVE);
    engine.busy(ALIVE);
    engine.wake();
  }
  function later(sec: number, what: number) {
    for (let k = 0; k < 8; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05));
  }
  function reset(s: number) {
    seed = s >>> 0;
    m = newMatch(seed);
    botRnd = seeded(seed * 31 + 7);
    fxRnd = seeded(seed * 17 + 3);
    randomFleet(m, 1, seeded(seed * 7 + 1));
    sel = 0, hover = -1, cursor = 27, anim = 0, flash = 0, toastT = 0;
    pdir.fill(0), drops.fill(0), sinkT.fill(-1), burning.fill(0), fx.fill(0), rings.fill(0), TF.fill(0);
    shell.on = false;
    buildScene();
    for (let i = 0; i < 4; i++) syncShip(0, i), syncShip(1, i);
    card.hidden = true;
    setView(-1, true);
    refresh();
    alive();
  }
  const cellLocal = (gx: number, gz: number, out: Float64Array) => ((out[0] = -3.5 + gx), (out[2] = -3.5 + gz), out);
  const cellWorld = (side: number, c: number, out: Float64Array) => ((out[0] = TX[side]! - 3.5 + (c & 7)), (out[1] = WY), (out[2] = TZ - 3.5 + (c >> 3)), out);
  /** The ship's first cell for a pointer on cell c (the ship centred on it, kept in the bay), in A2. */
  function anchorFor(i: number, c: number, dir: number) {
    const L = FLEET[i]!, hx = c & 7, hy = c >> 3, off = (L - 1) >> 1;
    if (dir) (A2[0] = hx), (A2[1] = Math.max(0, Math.min(N - L, hy - off)));
    else (A2[0] = Math.max(0, Math.min(N - L, hx - off))), (A2[1] = hy);
    return A2;
  }
  function rest(ob: DioramaObject, on: string) {
    if (ob.on !== on) dio.on(ob, on);
  }
  function setShipAt(root: DioramaObject, side: number, x: number, y: number, dir: number, L: number) {
    rest(root, "water" + side);
    cellLocal(x + (dir ? 0 : (L - 1) / 2), y + (dir ? (L - 1) / 2 : 0), tmp);
    (root.pos[0] = tmp[0]!), (root.pos[1] = 0), (root.pos[2] = tmp[2]!);
    (root.rot[0] = root.rot[2] = 0), (root.rot[1] = dir ? -Math.PI / 2 : 0);
  }
  /** Ship i of a side where the model has it: in the bay, a ghost over the hovered cell, or on the dock. */
  function syncShip(side: number, i: number) {
    const root = ships[side * 4 + i]!, s = m.sides[side]!;
    root.tint = null;
    if (sinkT[side * 4 + i]! >= 0) return;
    if (side === 1) return void (s.sx[i]! >= 0 && setShipAt(root, 1, s.sx[i]!, s.sy[i]!, s.dir[i]!, FLEET[i]!));
    root.alpha = 1;
    if (s.sx[i]! >= 0) return setShipAt(root, 0, s.sx[i]!, s.sy[i]!, s.dir[i]!, FLEET[i]!);
    if (m.phase === PLACE && i === sel && hover >= 0) {
      const a = anchorFor(i, hover, pdir[i]!), ok = canPlace(m, 0, i, a[0]!, a[1]!, pdir[i]!);
      setShipAt(root, 0, a[0]!, a[1]!, pdir[i]!, FLEET[i]!);
      (root.pos[1] = 0.22), (root.alpha = 0.6), (root.tint = ok ? null : P.bad);
      (ghost.show = true), (ghost.ok = ok), (ghost.x = a[0]!), (ghost.y = a[1]!), (ghost.dir = pdir[i]!), (ghost.i = i);
      return;
    }
    rest(root, "dock");
    (root.pos[0] = SLOTS[i * 2]!), (root.pos[1] = 0.16 + (i === sel ? 0.3 : 0)), (root.pos[2] = SLOTS[i * 2 + 1]!);
    root.rot[0] = root.rot[1] = root.rot[2] = 0;
  }
  function syncGhost() {
    ghost.show = false;
    for (let i = 0; i < 4; i++) syncShip(0, i);
    refresh();
  }
  function refresh() {
    hudDirty = dirty = true;
    engine.wake();
  }

  // ---- effects ----
  function spawn(type: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    for (let k = 0; k < PART; k++) {
      const o = k * PS;
      if (fx[o + 6]! > 0) continue;
      (fx[o] = x), (fx[o + 1] = y), (fx[o + 2] = z), (fx[o + 3] = vx), (fx[o + 4] = vy), (fx[o + 5] = vz);
      (fx[o + 6] = fx[o + 7] = life), (fx[o + 8] = type), (fx[o + 9] = size);
      return;
    }
  }
  const R = () => fxRnd();
  function ring(x: number, z: number, life: number) {
    for (let i = 0; i < 12; i++) if (rings[i * 5 + 4]! <= 0) return void ((rings[i * 5] = x), (rings[i * 5 + 1] = z), (rings[i * 5 + 3] = 0), (rings[i * 5 + 4] = life));
  }
  function splash(x: number, z: number) {
    const n = RM ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, sp = 0.5 + R() * 1.3;
      spawn(0, x, WY + 0.05, z, Math.cos(a) * sp, 2.6 + R() * 2.4, Math.sin(a) * sp, RM ? 0.45 : 0.7 + R() * 0.4, 0.06 + R() * 0.06);
    }
    ring(x, z, RM ? 0.5 : 1.1);
  }
  function burst(x: number, y: number, z: number, big: boolean) {
    spawn(4, x, y + 0.1, z, 0, 0, 0, RM ? 0.12 : 0.22, big ? 1 : 0.75);
    for (let i = 0, n = RM ? 8 : big ? 34 : 24; i < n; i++) {
      const a = R() * TAU, sp = 1 + R() * 2.6;
      spawn(1, x, y, z, Math.cos(a) * sp, 2 + R() * 3.2, Math.sin(a) * sp, 0.4 + R() * 0.35, 0.07 + R() * 0.06);
    }
    if (!RM) {
      for (let i = 0; i < 14; i++) spawn(2, x + (R() - 0.5) * 0.4, y + 0.05, z + (R() - 0.5) * 0.4, (R() - 0.5) * 0.4, 0.6 + R() * 0.8, (R() - 0.5) * 0.4, 0.7 + R() * 0.9, 0.2 + R() * 0.14);
      for (let i = 0, n = big ? 18 : 11; i < n; i++) spawn(3, x + (R() - 0.5) * 0.5, y + 0.25, z + (R() - 0.5) * 0.5, (R() - 0.5) * 0.3 + 0.18, 0.7 + R() * 0.6, (R() - 0.5) * 0.3 - 0.1, 1.8 + R() * 1.4, 0.22 + R() * 0.14);
    }
    ring(x, z, RM ? 0.4 : 0.8);
  }
  function stepFx(dt: number) {
    let on = false;
    for (let i = 0; i < PART; i++) {
      const o = i * PS;
      if (fx[o + 6]! <= 0) continue;
      on = true;
      const ty = fx[o + 8]!;
      fx[o + 6] = fx[o + 6]! - dt;
      if (ty <= 1) fx[o + 4] = fx[o + 4]! - 9.8 * dt;
      else if (ty === 4) fx[o + 9] = fx[o + 9]! + dt * 2;
      else (fx[o + 3] = fx[o + 3]! * 0.985), (fx[o + 5] = fx[o + 5]! * 0.985), (fx[o + 9] = fx[o + 9]! + dt * (ty === 3 ? 0.22 : -0.12));
      (fx[o] = fx[o]! + fx[o + 3]! * dt), (fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt), (fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt);
      if (ty === 0 && fx[o + 1]! < WY && fx[o + 4]! < 0) fx[o + 6] = 0;
    }
    for (let i = 0; i < 12; i++) {
      const o = i * 5;
      if (rings[o + 4]! <= 0) continue;
      on = true;
      rings[o + 3] = rings[o + 3]! + dt;
      if (rings[o + 3]! >= rings[o + 4]!) rings[o + 4] = 0;
    }
    return on;
  }
  /** The particles into the diorama's point pools (by tray), alpha and colour by type and age. */
  const FIRE = ["#ffd36b", "#ff7a3c"];
  function fxPoints() {
    fx0.n = fx1.n = 0;
    for (let i = 0; i < PART; i++) {
      const o = i * PS, l = fx[o + 6]!;
      if (l <= 0) continue;
      const p = fx[o]! > 0 ? fx1 : fx0, j = p.n++, u = l / fx[o + 7]!, ty = fx[o + 8]!;
      (p.x[j] = fx[o]!), (p.y[j] = fx[o + 1]!), (p.z[j] = fx[o + 2]!), (p.r[j] = fx[o + 9]!);
      p.a[j] = ty === 3 ? Math.min(1, (1 - u) * 6) * u * 0.55 : ty === 2 ? Math.min(1, u * 1.5) : ty === 4 ? u * 0.9 : Math.min(1, u * 2);
      p.color[j] = ty === 3 ? P.smoke : ty === 0 ? P.drop : ty === 2 ? FIRE[u > 0.55 ? 0 : 1] : ty === 4 ? "#fff3c4" : "#ffd36b";
    }
    const s = shellPts;
    s.n = 0;
    if (!shell.on) return;
    (s.x[0] = shell.pos[0]!), (s.y[0] = shell.pos[1]!), (s.z[0] = shell.pos[2]!), (s.r[0] = 0.15), (s.a[0] = 1);
    for (let k = 1; k < shell.tn; k++) {
      (s.x[k] = shell.trail[k * 3]!), (s.y[k] = shell.trail[k * 3 + 1]!), (s.z[k] = shell.trail[k * 3 + 2]!);
      (s.r[k] = 0.09 * (1 - k / 16)), (s.a[k] = (1 - k / 14) * 0.5), (s.color[k] = P.night ? "#ffe9a0" : "#ffffff");
    }
    s.n = shell.tn || 1;
  }
  function launch(by: number, cell: number, res: number, ship: number) {
    (shell.on = true), (shell.t = 0), (shell.by = by), (shell.cell = cell), (shell.res = res), (shell.ship = ship), (shell.tn = 0);
    if (by === 0) {
      // From one of your ships still afloat (picked at random), else the dock.
      const s = m.sides[0]!;
      let n = 0;
      for (let i = 0; i < 4; i++) n += s.sunk[i] ? 0 : 1;
      let k = (R() * n) | 0, r = ships[0]!;
      for (let i = 0; i < 4; i++) if (!s.sunk[i] && k-- === 0) r = ships[i]!;
      (shell.a[0] = r.M[9]!), (shell.a[1] = r.M[10]! + 0.75), (shell.a[2] = r.M[11]!);
    } else (shell.a[0] = FORT.x), (shell.a[1] = PT + 1.3), (shell.a[2] = FORT.z);
    cellWorld(1 - by, cell, shell.b);
    const d = Math.hypot(shell.b[0]! - shell.a[0]!, shell.b[2]! - shell.a[2]!);
    shell.dur = RM ? 0.5 : 0.75 + d * 0.035;
    shell.h = 2 + d * 0.22;
    anim = 1;
    cue(1);
    alive();
  }
  function stepShell(dt: number) {
    if (!shell.on) return false;
    shell.t += dt / shell.dur;
    const t = Math.min(1, shell.t), a = shell.a, b = shell.b;
    shell.pos[0] = a[0]! + (b[0]! - a[0]!) * t;
    shell.pos[2] = a[2]! + (b[2]! - a[2]!) * t;
    shell.pos[1] = a[1]! + (b[1]! - a[1]!) * t + 4 * shell.h * t * (1 - t);
    shell.trail.copyWithin(3, 0, 39);
    (shell.trail[0] = shell.pos[0]!), (shell.trail[1] = shell.pos[1]!), (shell.trail[2] = shell.pos[2]!);
    shell.tn = Math.min(14, shell.tn + 1);
    if (!RM && engine.steps & 1) spawn(3, shell.pos[0]!, shell.pos[1]!, shell.pos[2]!, 0, 0.1, 0, 0.45, 0.05);
    if (shell.t >= 1) (shell.on = false), impact(shell.by, shell.cell, shell.res, shell.ship, false);
    return true;
  }
  const CELL = (c: number) => "ABCDEFGH"[c >> 3]! + ((c & 7) + 1);
  /** A shot lands: the splash or the burst, its peg, a sinking; then the next beat. `quick`: no
   *  beats, no words (the poster's set-up). */
  function impact(by: number, c: number, res: number, ship: number, quick: boolean) {
    const side = 1 - by;
    cellWorld(side, c, tmp);
    if (res === MISS) {
      quick || (splash(tmp[0]!, tmp[2]!), cue(2), toast("Splash! Miss", 0));
      addPeg(side, c, false, -1);
    } else {
      quick || (burst(tmp[0]!, WY + 0.35, tmp[2]!, res === SUNK), cue(res === SUNK ? 4 : 3));
      addPeg(side, c, true, ship);
      if (res === SUNK) {
        sink(side, ship, quick);
        quick || toast(by === 0 ? `Sunk their ${NAMES[ship]}!` : `They sank your ${NAMES[ship]}`, 2);
        const s = m.sides[side]!;
        for (let k = 0; k < FLEET[ship]!; k++) burning[side * 64 + (s.sy[ship]! + (s.dir[ship] ? k : 0)) * N + s.sx[ship]! + (s.dir[ship] ? 0 : k)] = 0;
      } else (burning[side * 64 + c] = 1), quick || toast(by === 0 ? "Hit!" : "You're hit!", 1);
    }
    hudDirty = dirty = true;
    if (quick) return;
    say(`${by ? "Enemy" : "You"} fired at ${CELL(c)}: ${res === MISS ? "miss" : res === HIT ? "hit" : "sunk " + NAMES[ship]}.`);
    alive();
    if (m.phase === OVER) later(RM ? 1 : 2.4, T_END);
    else if (m.turn === 1) later(RM ? 0.5 : 0.6, T_VIEW), later(RM ? 0.8 : 1.35, T_BOT);
    else later(RM ? 0.25 : 0.45, T_TURN);
  }
  function addPeg(side: number, c: number, hit: boolean, ship: number) {
    const id = "peg" + pegN++;
    if (hit) {
      const s = m.sides[side]!, k = s.dir[ship] ? (c >> 3) - s.sy[ship]! : (c & 7) - s.sx[ship]!;
      put({ id, shape: "cyl", sides: 6, size: [0.12, 0.42, 0.12], on: ships[side * 4 + ship]!.id!, pos: [k - (FLEET[ship]! - 1) / 2, 0.26, 0], color: "pegHit", layer: 5, below: BELOW, pick: false });
    } else {
      cellLocal(c & 7, c >> 3, tmp2);
      put({ id, shape: "cyl", sides: 6, size: [0.12, 0.3, 0.12], on: "water" + side, pos: [tmp2[0]!, 0, tmp2[2]!], color: "pegMiss", layer: 5, pick: false });
    }
    put({ shape: "cyl", sides: 8, size: [0.24, 0.16, 0.24], on: id, color: hit ? "pegHit" : "pegMiss", layer: 5, below: BELOW, pick: false });
  }
  /** Roll it over and down to the bottom (an enemy ship shows itself as it goes). */
  function sink(side: number, i: number, quick: boolean) {
    const k = side * 4 + i, root = ships[k]!;
    if (side === 1) {
      for (const ob of parts[k]!) ob.hidden = false;
      root.alpha = 0;
      root.shadow = 0.22;
    }
    sinkT[k] = quick ? 99 : 0;
    if (quick) sinkPose(k, 1);
  }
  const SINK = RM ? 1 : 2.6;
  function sinkPose(k: number, u: number) {
    const r = ships[k]!, e = u * u * (3 - 2 * u);
    if (k >= 4) r.alpha = Math.min(1, (sinkT[k]! / 0.35));
    r.rot[0] = 0.55 * e;
    r.rot[2] = 0.28 * Math.min(1, u * 1.6);
    r.pos[1] = -0.55 * e * e;
  }
  function stepSink(dt: number) {
    let on = false;
    for (let k = 0; k < 8; k++) {
      if (sinkT[k]! < 0 || sinkT[k]! >= SINK) continue;
      sinkT[k] = Math.min(SINK, sinkT[k]! + dt);
      const u = sinkT[k]! / SINK, r = ships[k]!;
      sinkPose(k, u);
      if (!RM && u < 0.85 && fxRnd() < 0.3) spawn(0, r.M[9]! + (fxRnd() - 0.5) * 1.6, WY + 0.02, r.M[11]! + (fxRnd() - 0.5), 0, 0.9 + fxRnd(), 0, 0.3, 0.05);
      if (u >= 1) r.alpha = 1;
      on = true;
    }
    return on;
  }
  function botFire() {
    if (m.phase !== BATTLE || m.turn !== 1) return;
    const c = botPick(m, 1, botRnd), res = fire(m, 1, c & 7, c >> 3);
    launch(1, c, res, m.ship);
    hudDirty = true;
  }
  function playerFire(c: number) {
    if (m.phase !== BATTLE || m.turn !== 0 || anim) return;
    if (m.sides[1]!.shots[c]) return void ((flash = 0.5), (flashCell = 64 + c), cue(6), refresh());
    const res = fire(m, 0, c & 7, c >> 3);
    if (res) launch(0, c, res, m.ship), (hudDirty = true);
  }

  // ---- placement ----
  function selectShip(i: number) {
    if (m.phase !== PLACE) return;
    const s = m.sides[0]!;
    if (s.sx[i]! >= 0) (pdir[i] = s.dir[i]!), unplace(m, 0, i);
    sel = i;
    syncGhost();
  }
  function tryPlace(c: number) {
    if (sel < 0 || m.phase !== PLACE) return;
    const a = anchorFor(sel, c, pdir[sel]!);
    if (place(m, 0, sel, a[0]!, a[1]!, pdir[sel]!)) {
      drops[sel] = RM ? 0 : 1;
      cue(5);
      let nxt = -1;
      for (let i = 3; i >= 0; i--) if (m.sides[0]!.sx[i]! < 0) nxt = i;
      sel = nxt;
      if (!picked) hover = -1;
      syncGhost();
    } else (flash = 0.6), (flashCell = c), (hover = c), cue(6), syncGhost();
  }
  function rotate() {
    if (m.phase !== PLACE || sel < 0) return;
    pdir[sel] = pdir[sel]! ^ 1;
    syncGhost();
  }
  function randomize() {
    if (m.phase !== PLACE) return;
    randomFleet(m, 0, seeded(seed * 13 + ++randN));
    sel = hover = -1;
    for (let i = 0; i < 4; i++) drops[i] = RM ? 0 : 1 + i * 0.25;
    cue(5);
    syncGhost();
  }
  function startBattle() {
    if (!begin(m)) return;
    sel = hover = -1;
    cursor = 27;
    syncGhost();
    setView(-1, false);
    cue(7);
    toast("Battle stations!", 1);
  }
  function showEnd() {
    const win = m.winner === 0, s = m.sides[0]!;
    card.firstChild!.textContent = win ? "You win!" : "The bay is theirs";
    card.children[1]!.textContent = win ? "Every enemy ship is resting on the bottom." : `They sank your fleet. ${shipsLeft(m, 1)} of theirs still afloat.`;
    card.children[2]!.textContent = `Shots ${s.n[0]} · Accuracy ${s.n[0] ? Math.round((s.n[1]! / s.n[0]!) * 100) : 0}%`;
    // A loss shows where their fleet was.
    if (!win) for (let i = 0; i < 4; i++) if (!m.sides[1]!.sunk[i]) { for (const ob of parts[4 + i]!) ob.hidden = false; ships[4 + i]!.alpha = 0.75; }
    card.hidden = false;
    anim = 0;
    cue(win ? 8 : 9);
    setView(-1, false);
    refresh();
    again.focus({ preventScroll: true });
  }

  // ---- views ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.62 };
  let limits = { yaw: [-2, 2], pitch: [25 * D, 65 * D], dist: [5, 200] }, tweening = false;
  const portrait = () => dio.width / dio.height < 0.95;
  function effView() {
    if (view) return view;
    if (!portrait() || RM) return m.phase === PLACE && portrait() ? 2 : 1;
    if (m.phase === PLACE) return 2;
    if (m.phase === OVER) return 1;
    return m.turn === 0 && !shell.on ? 3 : 2;
  }
  /** Aim the camera for the view (v ≥ 0 picks one; −1 keeps it): framed inside the safe area (under
   *  the stickers, over the keys), then tweened there (snap: at once). */
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const ev = effView(), port = portrait(), g = goal, W = dio.width, H = dio.height;
    let pts: number[];
    if (ev === 1) {
      (g.yaw = (port ? -58 : -24) * D), (g.pitch = (port ? 52 : 50) * D), (g.tx = 0), (g.ty = PT), (g.tz = port ? 0 : 0.4);
      pts = port ? [-9.6, WY, -6.2, 9.6, WY, -6.2, -9.6, PT, 6.6, 9.6, PT, 6.6, -9.6, WY, 2.9, 9.6, WY + 0.6, -6.2] : [-9.8, WY + 0.4, -6.3, 9.8, WY + 0.4, -6.3, -9.8, PT, 6.7, 9.9, PT, 6.7, LH.x, PT + 4.6, LH.z];
    } else {
      const s = ev === 2 ? 0 : 1, x = TX[s]!, dock = s === 0 && m.phase === PLACE;
      (g.yaw = (port ? -20 : -24) * D), (g.pitch = (port ? 58 : 54) * D), (g.tx = x), (g.ty = WY), (g.tz = TZ + (dock ? 2.6 : 0));
      pts = [x - 4.4, PT, TZ - 4.4, x + 4.4, PT, TZ - 4.4, x - 4.4, PT, TZ + 4.4, x + 4.4, PT, TZ + 4.4, x - 4.4, WY + 0.8, TZ - 4.4, x + 4.4, WY + 0.8, TZ - 4.4];
      if (dock) pts.push(DOCK.x - 4.8, PT, DOCK.z + 1.6, DOCK.x + 4.8, PT, DOCK.z + 1.6);
    }
    dio.fit(g, pts, { x0: 8, x1: W - 8, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    limits = { yaw: [g.yaw - 50 * D, g.yaw + 50 * D], pitch: [25 * D, 65 * D], dist: [g.dist * 0.55, g.dist * 1.6] };
    if (snap || RM) Object.assign(dio.cam, g), (tweening = false);
    else tweening = true;
    hudDirty = dirty = true;
    engine.wake();
  }
  function cycleView() {
    setView((view + 1) % 4, false);
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  function stepCam(dt: number) {
    if (!tweening) return false;
    const c = dio.cam, k = 1 - Math.exp(-dt * 5.5);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const f = CAMF[i]!;
      c[f] += (goal[f] - c[f]) * k;
      d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 40 : i < 2 ? 0.05 : 1));
    }
    if (d < 0.01) Object.assign(c, goal), (tweening = false);
    return true;
  }

  // ---- decals (inside a tray, just over the water) and the overlay (labels, toast, the night) ----
  const Q = new Float64Array(8);
  function quad(ctx: CanvasRenderingContext2D, side: number, gx: number, gz: number, inset: number) {
    const x0 = TX[side]! - 4 + gx + inset, z0 = TZ - 4 + gz + inset, x1 = x0 + 1 - inset * 2, z1 = z0 + 1 - inset * 2, y = WY + 0.006;
    dio.project(x0, y, z0, tmp), (Q[0] = tmp[0]!), (Q[1] = tmp[1]!);
    dio.project(x1, y, z0, tmp), (Q[2] = tmp[0]!), (Q[3] = tmp[1]!);
    dio.project(x1, y, z1, tmp), (Q[4] = tmp[0]!), (Q[5] = tmp[1]!);
    dio.project(x0, y, z1, tmp), (Q[6] = tmp[0]!), (Q[7] = tmp[1]!);
    ctx.beginPath();
    ctx.moveTo(Q[0]!, Q[1]!), ctx.lineTo(Q[2]!, Q[3]!), ctx.lineTo(Q[4]!, Q[5]!), ctx.lineTo(Q[6]!, Q[7]!);
    ctx.closePath();
  }
  const FLASH = ["rgba(239,80,80,0.1)", "rgba(239,80,80,0.2)", "rgba(239,80,80,0.3)", "rgba(239,80,80,0.4)", "rgba(239,80,80,0.5)", "rgba(239,80,80,0.6)"];
  function trayDecals(ctx: CanvasRenderingContext2D, side: number) {
    const y = WY + 0.004, x0 = TX[side]! - 4, z0 = TZ - 4, sh = m.sides[side]!.shots;
    // A checkerboard for reading the cells, then the grid lines.
    ctx.fillStyle = P.gridShade;
    for (let c = 0; c < 64; c++) if (((c & 7) + (c >> 3)) & 1) quad(ctx, side, c & 7, c >> 3, 0), ctx.fill();
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      dio.project(x0 + i, y, z0, tmp), ctx.moveTo(tmp[0]!, tmp[1]!), dio.project(x0 + i, y, z0 + 8, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
      dio.project(x0, y, z0 + i, tmp), ctx.moveTo(tmp[0]!, tmp[1]!), dio.project(x0 + 8, y, z0 + i, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    }
    ctx.stroke();
    // A sunk ship's cells get a dark wash, a hit a warm glow.
    for (let c = 0; c < 64; c++) if (sh[c]! >= HIT) (ctx.fillStyle = sh[c] === SUNK ? "rgba(30,40,70,0.22)" : "rgba(255,120,80,0.28)"), quad(ctx, side, c & 7, c >> 3, 0.06), ctx.fill();
    // The placement ghost's cells.
    if (side === 0 && m.phase === PLACE && ghost.show) {
      ctx.fillStyle = ghost.ok ? "rgba(255,255,255,0.45)" : "rgba(239,80,80,0.5)";
      for (let k = 0; k < FLEET[ghost.i]!; k++) quad(ctx, 0, ghost.x + (ghost.dir ? 0 : k), ghost.y + (ghost.dir ? k : 0), 0.05), ctx.fill();
    }
    if (flash > 0 && flashCell >= 64 === (side === 1)) {
      ctx.fillStyle = FLASH[Math.min(5, (flash * 10) | 0)]!;
      quad(ctx, side, flashCell & 7, (flashCell & 63) >> 3, 0.04);
      ctx.fill();
    }
    // The target reticle (or the keyboard's cursor).
    const aim = m.phase === PLACE ? 0 : 1, cur = hover >= 0 ? hover : kbd ? cursor : -1;
    if (side === aim && cur >= 0 && (m.phase === BATTLE ? m.turn === 0 && !anim : m.phase === PLACE)) {
      const bad = m.phase === BATTLE && sh[cur];
      ctx.lineWidth = 3;
      ctx.strokeStyle = bad ? "rgba(120,120,140,0.9)" : m.phase === BATTLE ? "#e5484d" : "#ffffff";
      quad(ctx, side, cur & 7, cur >> 3, 0.08);
      ctx.stroke();
      if (m.phase === BATTLE && !bad) {
        cellWorld(1, cur, tmp2);
        dio.project(tmp2[0]!, WY, tmp2[2]!, tmp);
        const r = (0.22 * dio.focal()) / tmp[2]!, x = tmp[0]!, yy = tmp[1]!;
        ctx.beginPath();
        ctx.arc(x, yy, r, 0, TAU);
        ctx.moveTo(x - r * 1.6, yy), ctx.lineTo(x + r * 1.6, yy), ctx.moveTo(x, yy - r * 1.6), ctx.lineTo(x, yy + r * 1.6);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // The incoming shell's shadow on this bay's water.
    if (shell.on && side === 1 - shell.by && dio.project(shell.pos[0]!, WY, shell.pos[2]!, tmp)) {
      const f = dio.focal() / tmp[2]!;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, 0.16 * f, 0.08 * f, 0, 0, TAU);
      ctx.fill();
    }
    // Splash rings.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const o = i * 5;
      if (rings[o + 4]! <= 0 || rings[o]! > 0 !== (side === 1)) continue;
      const u = rings[o + 3]! / rings[o + 4]!, r = 0.15 + u * 0.75, rx = rings[o]!, rz = rings[o + 1]!;
      ctx.globalAlpha = 1 - u;
      ctx.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = (k / 18) * TAU;
        dio.project(rx + Math.cos(a) * r, WY + 0.01, rz + Math.sin(a) * r, tmp);
        k ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const FONT = "ui-rounded, \"SF Pro Rounded\", Nunito, system-ui, sans-serif", FONTS: string[] = [], WIDTHS = new Map<string, number>();
  const font = (px: number) => FONTS[px] || (FONTS[px] = `800 ${px}px ${FONT}`);
  const width = (ctx: CanvasRenderingContext2D, text: string, px: number) => {
    const k = text + px;
    let w = WIDTHS.get(k);
    if (w === undefined) WIDTHS.set(k, (w = ctx.measureText(text).width));
    return w;
  };
  /** A sticker label at a point: ink shadow, fill, ink rim, ink text. */
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
  function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, z: number, bg: string) {
    if (!dio.project(x, y, z, tmp)) return;
    const px = Math.max(11, Math.min(14, Math.round(((0.5 * dio.focal()) / tmp[2]!) * 1.4)));
    sticker(ctx, text, tmp[0]!, tmp[1]! - (px + 10) / 2, px, bg, "#1f2433");
  }
  const TOAST = ["#fffaf1", "#ffd36b", "#e5484d"];
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    if (P.night) {
      // The lighthouse: a glow, and a slow sweeping beam.
      const lamp = dio.get("lamp");
      if (lamp && dio.project(lamp.M[9]!, lamp.M[10]! + 0.28, lamp.M[11]!, tmp)) {
        const lx = tmp[0]!, ly = tmp[1]!, r0 = (1.2 * f) / tmp[2]!;
        ctx.fillStyle = "#ffe9a0";
        for (let i = 3; i > 0; i--) (ctx.globalAlpha = 0.07 * (4 - i)), ctx.beginPath(), ctx.arc(lx, ly, r0 * i * 0.7, 0, TAU), ctx.fill();
        const a = RM ? 2.3 : tAmb * 0.7;
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = "#ffe27a";
        for (let b = 0; b < 2; b++) {
          const ang = a + b * Math.PI;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          for (let s = -0.09; s < 0.1; s += 0.18) dio.project(lamp.M[9]! + Math.cos(ang + s) * 10, lamp.M[10]! - 0.4, lamp.M[11]! + Math.sin(ang + s) * 10, tmp2), ctx.lineTo(tmp2[0]!, tmp2[1]!);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    label(ctx, "YOUR BAY", TX[0]!, WY + 0.5, TZ - 4.4, "#f08e6f");
    label(ctx, "ENEMY BAY", TX[1]!, WY + 0.5, TZ - 4.4, "#8f9dc6");
    // The toast: pops in, holds, drifts up and fades (over the bays, under the stickers).
    if (toastT > 0) {
      const u = 1 - toastT / TOAST_T, s = u < 0.18 ? 0.6 + (u / 0.18) * 0.48 : u < 0.3 ? 1.08 - ((u - 0.18) / 0.12) * 0.08 : 1;
      const px = Math.round(Math.max(20, Math.min(30, dio.width / 26)));
      ctx.save();
      ctx.globalAlpha = u < 0.18 ? u / 0.18 : u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.translate(dio.width / 2, V[3]! + (dio.height - V[3]! - V[4]!) * 0.28 - (u > 0.8 ? (u - 0.8) * 60 : 0));
      ctx.scale(s, s);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, toastK === 2 ? "#ffffff" : "#1f2433");
      ctx.restore();
    }
  }
  const TOAST_T = RM ? 0.9 : 1;
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = TOAST_T);
    say(text);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the HUD (DOM writes in render, change-only) ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const ph = m.phase, yt = ph === BATTLE && m.turn === 0 && !anim;
    const t = ph === PLACE ? "Place your fleet" : ph === OVER ? (m.winner === 0 ? "Victory" : "Defeat") : yt ? "Your turn" : shell.on && shell.by === 0 ? "Shell away…" : "Enemy is aiming…";
    if (set(0, t)) turnEl.textContent = t;
    const cls = ph === PLACE ? "sb-chip sb-turn sb-place" : yt || (shell.on && shell.by === 0) ? "sb-chip sb-turn sb-you" : "sb-chip sb-turn sb-them";
    if (set(1, cls)) turnEl.className = cls;
    const a = shipsLeft(m, 0), b = shipsLeft(m, 1), n = m.sides[0]!.n[0]!;
    if (set(2, a)) nums[0]!.textContent = "" + a;
    if (set(3, b)) nums[1]!.textContent = "" + b;
    if (set(4, n)) nums[2]!.textContent = "" + n;
    const tap = coarse ? "Tap" : "Click";
    const hint = ph === PLACE
      ? sel >= 0 ? `${tap} a cell in your bay for the ${NAMES[sel]} (${FLEET[sel]}). R turns it.` : ready(m, 0) ? "Fleet ready: START, or pick a ship to move it." : `${tap} a ship on the dock.`
      : ph === BATTLE ? (yt ? `${tap} a cell in the enemy bay to fire. Drag to look around.` : "Hold tight…") : "";
    if (set(5, hint)) hintEl.textContent = hint;
    if (set(6, said)) live.textContent = said;
    const pl = ph === PLACE;
    if (set(7, pl)) rotK!.hidden = rndK!.hidden = goK!.hidden = !pl;
    if (set(8, ready(m, 0))) goK!.disabled = !ready(m, 0);
    if (set(9, sel < 0)) rotK!.disabled = sel < 0;
    const vl = VIEWS[view]!.toUpperCase();
    if (set(10, vl)) (viewName.textContent = vl), viewK!.setAttribute("aria-label", `Camera view: ${VIEWS[view]} (V)`);
    if (set(11, yt)) play.classList.toggle("sb-aim", yt);
  }

  // ---- the frame ----
  // Bob: each ship afloat rocks on its own phase; the selected ship on the dock lifts and floats.
  function bob(dt: number) {
    tAmb += dt;
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < 4; i++) {
        const r = ships[s * 4 + i]!, k = s * 4 + i;
        if (sinkT[k]! >= 0 || r.on !== "water" + s || (s === 0 && drops[i]! > 0)) continue;
        const ph = i * 1.7 + s * 0.9;
        r.rot[0] = Math.sin(tAmb * 1.6 + ph) * 0.035;
        r.rot[2] = Math.sin(tAmb * 1.1 + ph) * 0.02;
        if (!(m.phase === PLACE && ghost.show && ghost.i === i && s === 0)) r.pos[1] = Math.sin(tAmb * 1.3 + ph) * 0.025;
      }
    const lead = sel >= 0 ? ships[sel]! : null;
    if (m.phase === PLACE && lead && lead.on === "dock") lead.pos[1] = 0.46 + Math.sin(tAmb * 3) * 0.05;
    // Fires smoulder on the hit cells.
    if (!RM && engine.steps % 7 === 0)
      for (let k = 0; k < 128; k++) if (burning[k] && fxRnd() < 0.35) cellWorld(k >> 6, k & 63, tmp), spawn(3, tmp[0]! + (fxRnd() - 0.5) * 0.3, WY + 0.55, tmp[2]! + (fxRnd() - 0.5) * 0.3, 0.12, 0.45 + fxRnd() * 0.3, -0.06, 1.6, 0.07);
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (next !== P) {
          P = next;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!];
          for (let i = 0; i < 4; i++) syncShip(0, i);
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = viewK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        // The keys' strip at the bottom (the view key is always there), when the site's sheet has it there.
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(-1, true);
      }
      // The tap that woke the piece acts once there is a frame to pick from.
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y, "touch");
      }
    },
    step(e, dt) {
      for (let i = 0; i < ncue; i++) e.events.emit(CUES[cues[i]!]!);
      ncue = 0;
      let moving = false;
      for (let k = 0; k < 8; k++) {
        if (!TF[k] || e.time < TT[k]!) continue;
        const w = TF[k];
        TF[k] = 0;
        moving = true;
        if (w === T_VIEW) view || setView(-1, false);
        else if (w === T_BOT) botFire();
        else if (w === T_TURN) (anim = 0), (hudDirty = true), view || setView(-1, false);
        else if (w === T_END) showEnd();
        else if (w === T_POSTER) playerFire(posterCell);
      }
      if (stepShell(dt)) moving = true;
      if (stepFx(dt)) moving = true;
      if (stepSink(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      for (let i = 0; i < 4; i++) if (drops[i]! > 0) (drops[i] = Math.max(0, drops[i]! - dt * 2.6)), (moving = true);
      if (flash > 0) (flash -= dt), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      // The water moves only while the scene is alive (a hold from the last thing that happened).
      if (!RM && e.time < aliveT) bob(dt), (dirty = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      for (let i = 0; i < 4; i++) {
        const r = ships[i]!;
        if (drops[i]! > 0 && r.on === "water0") r.pos[1] = Math.min(1, drops[i]!) ** 2 * 1.6;
      }
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fxPoints(), dio.draw(), (V[5] = 1);
    },
  });

  // ---- input: tap acts, drag orbits, pinch zooms, keys move a cursor ----
  const ptrs = new Map<number, Float64Array>();
  let downX = 0, downY = 0, dragging = false, pinch0 = 0, dist0 = 0;
  const pinch = () => {
    let a: Float64Array | null = null, d = 0;
    for (const p of ptrs.values()) a ? (d = Math.hypot(a[0]! - p[0]!, a[1]! - p[1]!)) : (a = p);
    return d;
  };
  function cellAt(x: number, y: number, side: number) {
    if (!dio.ground(x, y, WY, hit3)) return -1;
    const gx = Math.floor(hit3[0]! - (TX[side]! - 4)), gz = Math.floor(hit3[2]! - (TZ - 4));
    return gx < 0 || gz < 0 || gx >= N || gz >= N ? -1 : gz * N + gx;
  }
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, Float64Array.of(e.offsetX, e.offsetY));
    if (ptrs.size === 1) (downX = e.offsetX), (downY = e.offsetY), (dragging = false);
    else if (ptrs.size === 2) (pinch0 = pinch()), (dist0 = dio.cam.dist), (dragging = true);
    alive();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    const x = e.offsetX, y = e.offsetY, p = ptrs.get(e.pointerId);
    if (!p) return void (e.pointerType === "mouse" && hoverAt(x, y));
    if (ptrs.size === 2) {
      (p[0] = x), (p[1] = y);
      const d = pinch();
      if (pinch0 > 0 && d > 0) (dio.cam.dist = (dist0 * pinch0) / d), dio.clamp(limits), (tweening = false), alive(), refresh();
      return;
    }
    const dx = x - p[0]!, dy = y - p[1]!;
    if (!dragging && Math.hypot(x - downX, y - downY) > 7) (dragging = true), play.classList.add("sb-drag");
    if (dragging) (dio.cam.yaw -= dx * 0.006), (dio.cam.pitch += dy * 0.005), dio.clamp(limits), (tweening = false), alive(), refresh();
    (p[0] = x), (p[1] = y);
  }, sig);
  const end = (e: PointerEvent) => {
    const had = ptrs.delete(e.pointerId);
    play.classList.remove("sb-drag");
    if (!had) return;
    if (!dragging && !ptrs.size && e.type === "pointerup") tap(e.offsetX, e.offsetY, e.pointerType);
    if (!ptrs.size) dragging = false;
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  play.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && hover >= 0) (hover = -1), (picked = false), m.phase === PLACE ? syncGhost() : refresh();
  }, sig);
  function hoverAt(x: number, y: number) {
    if (m.phase === OVER) return;
    kbd = false;
    const c = cellAt(x, y, m.phase === PLACE ? 0 : 1);
    picked = c >= 0;
    if (c !== hover) (hover = c), m.phase === PLACE ? syncGhost() : refresh();
    alive();
  }
  function tap(x: number, y: number, type: string) {
    if (m.phase === OVER) return;
    kbd = false;
    alive();
    if (m.phase === PLACE) {
      const ob = dio.root(dio.pick(x, y)), tag = ob?.tag as { side: number; ship: number } | null | undefined;
      if (tag && tag.side === 0 && !(sel === tag.ship && hover >= 0 && cellAt(x, y, 0) >= 0)) {
        selectShip(tag.ship);
        if (type !== "mouse") (hover = -1), syncGhost();
        return;
      }
      const c = cellAt(x, y, 0);
      if (c >= 0 && sel >= 0) (picked = type === "mouse"), tryPlace(c);
      return;
    }
    const c = cellAt(x, y, 1);
    if (c >= 0) playerFire(c);
  }
  const MOVE: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    alive();
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "r") return void (e.preventDefault(), rotate());
    if (k === "x") return void (e.preventDefault(), randomize());
    if (k === "s") return void (e.preventDefault(), startBattle());
    if (k === "v") return void (e.preventDefault(), cycleView());
    if (m.phase === PLACE && k >= "1" && k <= "4") return void (e.preventDefault(), selectShip(+k - 1));
    const mv = MOVE[e.key];
    if (mv) {
      e.preventDefault();
      kbd = true;
      const x = Math.max(0, Math.min(7, (cursor & 7) + (mv === 1 || mv === -1 ? mv : 0))), y = Math.max(0, Math.min(7, (cursor >> 3) + (mv === N ? 1 : mv === -N ? -1 : 0)));
      cursor = hover = y * N + x;
      return void (m.phase === PLACE ? syncGhost() : refresh());
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      const c = hover >= 0 ? hover : cursor;
      m.phase === PLACE ? tryPlace(c) : playerFire(c);
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster's battle (scripts/gallery-posters.mjs): a few turns in, a ship of theirs gone, one of
  // yours burning, a shell on its way.
  let posterCell = -1;
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261113);
    randomizeQuiet();
    begin(m);
    sel = hover = -1;
    view = 1;
    const s1 = m.sides[1]!, s0 = m.sides[0]!;
    // Sink their Minnow and hit their Whale; the bot hits your Heron first, then hunts on its own.
    const mine = [cellAt1(s1, 3, 0), cellAt1(s1, 3, 1), cellAt1(s1, 0, 1), 9, 50, 22];
    for (let k = 0; k < 6; k++) shot(0, mine[k]!), shot(1, k ? botPick(m, 1, botRnd) : cellAt1(s0, 1, 0));
    posterCell = cellAt1(s1, 0, 2);
    while (s1.shots[posterCell]) posterCell = (posterCell + 1) & 63;
    later(1.1, T_POSTER);
    for (let i = 0; i < 8; i++) syncShip(i >> 2, i & 3);
    setView(-1, true);
    refresh();
  }
  const cellAt1 = (s: { sx: Int8Array; sy: Int8Array; dir: Uint8Array }, i: number, k: number) => (s.sy[i]! + (s.dir[i] ? k : 0)) * N + s.sx[i]! + (s.dir[i] ? 0 : k);
  function shot(by: number, c: number) {
    // A cell already fired at: the next one free (so the turns keep alternating).
    while (m.sides[1 - by]!.shots[c]) c = (c + 1) & 63;
    const r = fire(m, by, c & 7, c >> 3);
    if (r) impact(by, c, r, m.ship, true);
  }
  function randomizeQuiet() {
    randomFleet(m, 0, seeded(seed * 13 + 1));
    for (let i = 0; i < 4; i++) syncShip(0, i);
  }

  reset((engine.random() * 100000) | 0);
  engine.start();
  return {
    engine,
    accessible: true,
    get m() {
      return m;
    },
    get state() {
      let sinking = 0;
      for (let k = 0; k < 8; k++) if (sinkT[k]! >= 0 && sinkT[k]! < SINK) sinking++;
      return { phase: m.phase, turn: m.turn, anim, shell: shell.on, view: VIEWS[view]!, sel, cursor, sinking, card: !card.hidden, tween: tweening };
    },
    cellScreen(s: number, c: number) {
      cellWorld(s, c, tmp2);
      dio.project(tmp2[0]!, WY, tmp2[2]!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the staged battle, its shell in the air (scripts/gallery-posters.mjs). */
export const posterAt = 1.7;
