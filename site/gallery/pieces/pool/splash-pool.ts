// "Splash Pool": a backyard pool on a tabletop diorama. A raised garden on a wooden plinth, cut away
// at the front and left so you see the soil under the lawn; in it a tiled pool with a ladder, a
// diving board, a deck chair, an umbrella over the far corner and a float ring drifting. Tap the
// water to drop the item you hold (a beach ball, a cannonball rock, a rubber duck, a pebble; C or
// 1-4 changes it): a column of water, a crown of drops, then ripples that run out, cross each other
// and bounce off the walls, with foam where they slap the tiles. Whatever floats rides them: it bobs
// on the crests, gets pushed by the fronts, leaves a wake. DRAIN pulls the plug: a whirlpool takes
// everything afloat down, then the return jet refills the pool and spits it all back out. The goal:
// get the duck (in shades) to the flag in the far corner using only ripples; hit it and it's a foul.
// Tap the diving board and it twangs and flips your item in. Drag orbits. Dark: a night swim, the
// pool lit from below under a string of bulbs. Light: a pastel afternoon.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back byte for byte),
// @fzlt/core/diorama (the 3D, the depth sort with the effects in it, picking), @fzlt/core/water
// (the surface's roll, sheen and foam, the splash columns and crowns, rings, bubbles, the whirlpool,
// wakes), @fzlt/core/slot, @fzlt/core/sound. The water's physics (reflecting ripples, floaters,
// drops, the drain) is ./model.ts, pure (tests/splash-pool.test.mjs); this file is the scene and
// the controls (tests/splash-pool.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { water } from "../../../../src/water";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import {
  BALL, C, CREST, D_FALL, D_REST, D_SINK, DRAIN, DS, DUCK, DUCKY, E_BACK, E_BONK, E_FOUL, E_GULP, E_HOME, E_KNOCK, E_LAND, E_POP, E_SPLASH, F_AFLOAT, F_DOWN, F_FLY, F_HOME, FLOOR, FS,
  GOAL, GOAL_R, ITEMS, JET, ND, NF, NP, PEBBLE, PULL, RAD, RING, ROCK, SIG, X0, X1, Z0, Z1, BOUNCE, drainPool, draining, drop, fade, field, flight, images, newPool, reset, step,
} from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
// The palettes: a pastel afternoon (light) and a night swim (dark), by role.
const LIGHT = {
  bg: "#f1e9df", floor: "#e2d9cc", wall: "#f3dfd2", rug: "#f6d3c4", base: "#c69a6f", top: "#e4c196", soil: "#d4a07a", soil2: "#bf8c68", grass: "#a9dca0", grass2: "#93cf8f",
  deck: "#f6e8d2", cope: "#fffaf1", tile: "#a7e0ee", band: "#4fa6cf", pfloor: "#bdeef7", water: "#8fd8ee", lamp: "#fff4c2",
  board: "#ffffff", boardB: "#f08e6f", stand: "#c9c2d2", rail: "#d9dde6", chair: "#ffffff", cushion: "#7fcfb8", towel: "#f2c96b", pole: "#8a8597", shade: "#f59a8b", shade2: "#fff3dc",
  bush: "#8fcf9b", bush2: "#b0dfa8", flag: "#f2c96b", ringA: "#f08e6f", ringB: "#fff7ee", duck: "#f9d45c", beak: "#f28c3a", eye: "#2a2633", glass: "#1f2433",
  ballA: "#f08e6f", ballB: "#7fc7e8", ballC: "#f2c96b", ballW: "#fffaf2", rock: "#a49fae", rock2: "#c7c2cf", ink: "#2a2633", shadow: "#3a2d3c",
  foam: "#ffffff", trough: "#2f7fa6", caustic: "#ffffff", glow: "#ffffff", bulb: "#fff1c9",
  light: [0.5, 1, 0.45], amb: 0.55, wa: [0.12, 0.7, 0.1], night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#121626", floor: "#22283d", wall: "#272e4a", rug: "#352f50", base: "#6f523e", top: "#8a6a4f", soil: "#5a4038", soil2: "#4a352f", grass: "#2f5a4f", grass2: "#28504a",
  deck: "#4c5068", cope: "#8d92ab", tile: "#2fa9c9", band: "#1d6f99", pfloor: "#49d4ea", water: "#1f97bf", lamp: "#e9fbff",
  board: "#cfd6e6", boardB: "#ff5fa8", stand: "#6a6f86", rail: "#a8b0c4", chair: "#b9bfd4", cushion: "#ff5fa8", towel: "#7a5cff", pole: "#5f6478", shade: "#ff4f9a", shade2: "#4fe6ff",
  bush: "#2f6a55", bush2: "#3d7c62", flag: "#b8ff5c", ringA: "#ff5fa8", ringB: "#e9f0ff", duck: "#ffd84a", beak: "#ff8a3d",
  ballA: "#ff5fa8", ballB: "#4fe6ff", ballC: "#b8ff5c", ballW: "#e9f0ff", rock: "#5e6074", rock2: "#7c7f96", shadow: "#000000",
  foam: "#d6fbff", trough: "#07344d", caustic: "#e6fdff", glow: "#4fe6ff", bulb: "#ffd98a",
  light: [0.35, 1, 0.6], amb: 0.42, wa: [0.1, 0.55, 0.08], night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night" | "wa">;

// Heights: the plinth's top, the lawn, the deck, the coping, the water; the pool floor's top.
const PT = 0.9, GT = PT + 1, DT = GT + 0.1, CT = DT + 0.05, WY = DT - 0.16, FT = WY + FLOOR - 0.06;
// The yard (half extents), the deck's outer edge, the board's pivot and the flag.
const GX = 8, GZ = 5, DX = 6, DZ = 4.2, BOARD = { x: -5.5, z: -0.7, len: 3, y: DT + 0.42 }, FLAG = [X1 + 0.15, Z0 - 0.15];
// Things under the water line draw on their own layer, under the surface (seen through it).
const BELOW = { y: WY - 0.01, layer: 2.9 };
const ITEM_KEY = ["BALL", "ROCK", "DUCK", "PEBBLE"], ITEM_NAME = ["beach ball", "cannonball", "rubber duck", "pebble"];
const CUES = ["", "drip", "plunk", "bonk", "foul", "home", "gulp", "pop", "drain", "refill"];

export type PoolScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly pool: ReturnType<typeof newPool>;
  readonly state: { item: number; drops: number; best: number; homes: number; drain: boolean; duck: number; floaters: number; tween: boolean };
  /** The screen point (CSS px from the stage's top left) of the water at (x, z), as of the last draw. */
  screen(x: number, z: number): [number, number];
  /** The diving board's tip on screen. */
  boardTip(): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): PoolScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the HUD
  // stickers and the keys strip. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "sp-play";
  play.setAttribute("aria-label", "Splash Pool: arrows aim, Enter or Space drops, C or 1 to 4 picks what you drop, D drains the pool (M mutes). Get the duck to the flag with ripples only.");
  const hud = L.add(document.createElement("div"));
  hud.className = "sp-hud";
  hud.innerHTML = `<div class="sp-head"><p class="sp-top"><b class="sp-chip sp-goal">Duck → flag</b><b class="sp-chip sp-n">Drops <span>0</span> · Best <span>–</span></b></p><p class="sp-hint">Tap the water to drop a beach ball. Ripples only: nudge the duck to the flag.</p></div><b class="sp-chip sp-toast" hidden></b><p class="sp-live" aria-live="polite"></p>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, nums = top.children[1]!.querySelectorAll("span");
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { drip: "click", plunk: "boom", bonk: "hit", foul: "hurt", home: "win", gulp: "power", pop: "click", drain: "end", refill: "ready" }, volume: 0.1 });
  const K_MUTE = 0, K_ITEM = 1, K_DRAIN = 2;
  const [muteK, itemK, drainK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "BALL", aria: "What you drop: beach ball (C)", id: K_ITEM },
    { label: "DRAIN", aria: "Drain the pool (D)", id: K_DRAIN, c: "sp-drain" },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else if (id === K_ITEM) pickItem((item + 1) % 4);
    else pullPlug();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the diorama ----
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, get shadowColor() { return P.shadow; } });
  const keyed: DioramaObject[] = [], keyName: Key[] = [];
  const put = (d: DioramaObjectDef & { color?: Key }) => {
    const k = d.color as Key | undefined, ob = dio.add({ pick: false, ...d, color: k ? P[k] : undefined });
    if (k) keyed.push(ob), keyName.push(k);
    return ob;
  };
  const pool = newPool();
  const box = (id: string | undefined, x0: number, z0: number, x1: number, z1: number, y: number, h: number, color: Key, cluster: string, layer: number, mask = 63) =>
    put({ id, size: [x1 - x0, h, z1 - z0], pos: [(x0 + x1) / 2, y, (z0 + z1) / 2], color, cluster, layer, mask });

  // The room and the plinth.
  dio.cluster("room", { fixed: 0 });
  dio.cluster("base", { fixed: 1 });
  dio.cluster("yard", { fixed: 2 });
  dio.cluster("pool", { fixed: 3 });
  dio.cluster("front", { fixed: 4 });
  put({ size: [60, 0.5, 44], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
  put({ size: [60, 16, 0.5], pos: [0, -0.5, -16], color: "wall", cluster: "room", layer: 0.3 });
  put({ size: [30, 0.04, 21], pos: [0, 0, 1.5], color: "rug", cluster: "room", layer: 0.2 });
  put({ size: [2 * GX + 0.8, PT - 0.14, 2 * GZ + 0.8], pos: [0, 0, 0], color: "base", cluster: "base", layer: 0, shadow: 0.25, id: "plinth" });
  put({ size: [2 * GX + 1.2, 0.14, 2 * GZ + 1.2], on: "plinth", color: "top", layer: 0.4 });
  // The yard: soil blocks round the pool (a lawn on each), the deck ring and the coping. The near
  // block draws last (it hides the water's front edge); the others before the pool.
  const ground = (x0: number, z0: number, x1: number, z1: number, cl: string, ly: number) => {
    box(undefined, x0, z0, x1, z1, PT, GT - PT - 0.12, "soil", cl, ly);
    box(undefined, x0, z0, x1, z1, GT - 0.12, 0.12, "grass", cl, ly + 0.05);
  };
  ground(-GX, -GZ, GX, Z0, "yard", 0.2), ground(-GX, Z0, X0, Z1, "yard", 0.2), ground(X1, Z0, GX, Z1, "yard", 0.2), ground(-GX, Z1, GX, GZ, "front", 0.2);
  // A darker seam of soil on the cut faces.
  box(undefined, -GX - 0.01, Z1 + 0.01, GX + 0.01, GZ + 0.01, PT + 0.18, 0.2, "soil2", "front", 0.21, 4 | 8 | 16);
  box(undefined, -GX - 0.01, -GZ - 0.01, -GX + 0.01, Z1, PT + 0.18, 0.2, "soil2", "yard", 0.21, 8);
  const deck = (x0: number, z0: number, x1: number, z1: number, cl: string) => box(undefined, x0, z0, x1, z1, GT, DT - GT, "deck", cl, 0.4);
  deck(-DX, -DZ, DX, Z0, "yard"), deck(-DX, Z0, X0, Z1, "yard"), deck(X1, Z0, DX, Z1, "yard"), deck(-DX, Z1, DX, DZ, "front");
  const cope = (x0: number, z0: number, x1: number, z1: number, cl: string) => box(undefined, x0, z0, x1, z1, DT, CT - DT, "cope", cl, 0.6);
  cope(X0 - 0.32, Z0 - 0.32, X1 + 0.32, Z0, "yard"), cope(X0 - 0.32, Z0, X0, Z1, "yard"), cope(X1, Z0, X1 + 0.32, Z1, "yard"), cope(X0 - 0.32, Z1, X1 + 0.32, Z1 + 0.32, "front");
  // The pool's inside: the floor, tiled walls (only their inner faces), the mosaic band at the water line.
  const floorOb = box("pfloor", X0, Z0, X1, Z1, PT, FT - PT, "pfloor", "yard", 1, 1);
  const wallIn = (x0: number, z0: number, x1: number, z1: number, mask: number) => {
    box(undefined, x0, z0, x1, z1, FT, WY - 0.12 - FT, "tile", "yard", 1.2, mask);
    box(undefined, x0, z0, x1, z1, WY - 0.12, DT - WY + 0.12, "band", "yard", 1.3, mask);
  };
  wallIn(X0, Z0 - 0.05, X1, Z0, 16), wallIn(X1, Z0, X1 + 0.05, Z1, 8), wallIn(X0 - 0.05, Z0, X0, Z1, 4), wallIn(X0, Z1, X1, Z1 + 0.05, 32);
  dio.decal("yard", 1.1, floorDecal);
  // The pool light on the far wall (it lights the water at night).
  const lampOb = put({ shape: "cyl", sides: 10, size: [0.5, 0.04, 0.5], rot: [Math.PI / 2, 0, 0], pos: [-1.6, WY - 0.45, Z0 + 0.01], color: "lamp", cluster: "yard", layer: 1.4, emissive: true });
  // The ladder: steps under the water (seen through it), rails rising over the coping.
  for (let i = 0; i < 3; i++) put({ size: [0.6, 0.04, 0.16], pos: [2.6, WY - 0.24 - i * 0.24, Z0 + 0.14], color: "rail", cluster: "yard", layer: 9 });
  for (let s = -1; s <= 1; s += 2) {
    const x = 2.6 + s * 0.32;
    put({ shape: "cyl", sides: 6, size: [0.07, DT + 0.5 - (FT + 0.1), 0.07], pos: [x, FT + 0.1, Z0 + 0.16], color: "rail", cluster: "pool", layer: 3.9, below: BELOW });
    put({ size: [0.07, 0.07, 0.62], pos: [x, DT + 0.46, Z0 - 0.13], color: "rail", cluster: "pool", layer: 3.9 });
    put({ shape: "cyl", sides: 6, size: [0.07, 0.5, 0.07], pos: [x, DT, Z0 - 0.42], color: "rail", cluster: "yard", layer: 8 });
  }
  // The diving board: a stand on the left deck, the board (it twangs) reaching out over the water.
  put({ size: [0.7, BOARD.y - DT, 0.8], pos: [BOARD.x - 0.2, DT, BOARD.z], color: "stand", cluster: "yard", layer: 8, shadow: 0.2 });
  const boardRoot = put({ id: "board", shape: "group", size: [0, 0, 0], pos: [BOARD.x, BOARD.y, BOARD.z], cluster: "pool", layer: 7, tag: "board", pick: true });
  put({ id: "boardP", size: [BOARD.len, 0.08, 0.66], on: "board", pos: [BOARD.len / 2 - 0.4, 0, 0], color: "board", layer: 7, pick: true });
  put({ size: [BOARD.len - 0.5, 0.012, 0.36], on: "boardP", pos: [0.25, 0, 0], color: "boardB", layer: 7.1, pick: true });
  // The deck chair on the right deck, a towel, the umbrella over the far corner, bushes, the flag.
  put({ id: "chair", size: [0.9, 0.22, 1.9], pos: [5.25, DT, 0.7], color: "chair", cluster: "yard", layer: 8, shadow: 0.25 });
  put({ id: "cush", size: [0.78, 0.07, 1.25], on: "chair", pos: [0, 0, 0.3], color: "cushion", layer: 8.1 });
  put({ id: "back", size: [0.78, 0.07, 0.8], on: "chair", pos: [0, 0.18, -0.6], rot: [-0.85, 0, 0], color: "cushion", layer: 8.1 });
  put({ size: [1.5, 0.02, 0.8], pos: [-2.6, DT, Z1 + 0.95], rot: [0, 0.12, 0], color: "towel", cluster: "front", layer: 1 });
  put({ id: "upole", shape: "cyl", sides: 6, size: [0.09, 2.6, 0.09], pos: [6.8, GT, -4.1], color: "pole", cluster: "yard", layer: 8, shadow: 0.2 });
  put({ id: "ushade", shape: "cyl", sides: 8, top: 0, size: [3.2, 0.7, 3.2], on: "upole", pos: [0, -0.55, 0], color: "shade", layer: 8.2 });
  put({ shape: "cyl", sides: 8, top: 0, size: [1.5, 0.34, 1.5], on: "ushade", pos: [0, -0.32, 0], color: "shade2", layer: 8.3 });
  let nb = 0;
  const bush = (x: number, z: number, s: number, cl: string) => {
    const id = "bush" + nb++;
    put({ id, shape: "cyl", sides: 7, top: 0.4, size: [1.3 * s, 0.9 * s, 1.3 * s], pos: [x, GT, z], color: "bush", cluster: cl, layer: 8.4, shadow: 0.2 });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [0.9 * s, 0.8 * s, 0.9 * s], on: id, color: "bush2", layer: 8.5 });
  };
  bush(-7.1, -4.3, 1, "yard"), bush(-6.4, -4.5, 0.7, "yard"), bush(-7.2, 4.25, 0.9, "front"), bush(7.2, 4.2, 0.8, "front");
  put({ id: "fpole", shape: "cyl", sides: 6, size: [0.06, 1.15, 0.06], pos: [FLAG[0]!, CT, FLAG[1]!], color: "pole", cluster: "yard", layer: 8 });
  const flagOb = put({ size: [0.5, 0.3, 0.03], on: "fpole", pos: [0.26, -0.32, 0], color: "flag", layer: 8.1 });
  // The string of bulbs along the far side: two posts, the bulbs (points over everything).
  for (let s = -1; s <= 1; s += 2) put({ shape: "cyl", sides: 6, size: [0.12, 3, 0.12], pos: [s * 7.5, GT, -4.6], color: "pole", cluster: "yard", layer: 8, shadow: 0.15 });
  const NB = 15, bulbs = dio.points({ cap: NB, paint: bulbDot });
  for (let i = 0; i < NB; i++) {
    const u = i / (NB - 1);
    (bulbs.x[i] = -7.5 + 15 * u), (bulbs.y[i] = GT + 2.95 - 0.9 * Math.sin(Math.PI * u)), (bulbs.z[i] = -4.6), (bulbs.r[i] = 0.09);
  }
  bulbs.n = NB;

  // The water: @fzlt/core/water paints the surface (its roll, sheen, foam on every wall, splashes,
  // rings, bubbles, the whirlpool, wakes) in the pool's cluster; the surface itself is one face (the
  // tiles show through it) so no side of the water ever draws over the yard.
  const surf = put({ size: [X1 - X0, 0.01, Z1 - Z0], pos: [0, WY - 0.01, 0], color: "water", alpha: 0.6, cluster: "pool", layer: 3, mask: 1 });
  const wtr = water(dio, { rect: [X0, Z0, X1, Z1], level: WY, cluster: "pool", layer: 3, body: false, light: P.foam, wave: { amp: 0.02, len: 1.6, speed: 0.25, dir: [0.4, 1], alpha: P.wa[0] }, foam: { alpha: P.wa[1], width: 0.13 }, sheen: P.wa[2], idle: 3, cap: 360, rings: 32, seed: 7 });
  dio.decal("pool", 3.7, ripplesDecal);

  // What floats: the duck (in shades), six more ducks to drop, the float ring; balls and stones are
  // points in the sort (balls over the water, stones under it once they sink).
  /** Every object's parts (a group's `hidden` hides only itself). */
  const kids = new Map<DioramaObject, DioramaObject[]>();
  const show = (ob: DioramaObject, on: boolean) => {
    if (ob.hidden === !on) return;
    ob.hidden = !on;
    const k = kids.get(ob)!;
    for (let i = 0; i < k.length; i++) k[i]!.hidden = !on;
  };
  function duckOb(id: string, hero: boolean) {
    const S = 1.3, list: DioramaObject[] = [];
    const root = put({ id, shape: "group", size: [0.6 * S, 0, 0.44 * S], pos: [0, WY, 0], cluster: "pool", layer: 4.5, below: BELOW, tag: id });
    kids.set(root, list);
    const part = (sfx: string, d: DioramaObjectDef & { color?: Key }) => {
      const sz = d.size!, ps = d.pos!, ol = d.outline;
      const ob = put({ below: BELOW, layer: 4.5, ...d, id: id + sfx, size: [sz[0]! * S, sz[1]! * S, sz[2]! * S], pos: [ps[0]! * S, ps[1]! * S, ps[2]! * S], outline: ol ? Array.from(ol, (p) => [p[0]! * S, p[1]! * S]) : undefined });
      list.push(ob);
      return ob;
    };
    part("b", { shape: "prism", outline: [[-0.32, -0.15], [-0.18, -0.21], [0.12, -0.2], [0.27, -0.11], [0.3, 0], [0.27, 0.11], [0.12, 0.2], [-0.18, 0.21], [-0.32, 0.15], [-0.37, 0]], taper: 0.72, size: [0.6, 0.24, 0.42], on: id, pos: [0, -0.09, 0], color: "duck" });
    part("t", { shape: "wedge", size: [0.16, 0.14, 0.22], on: id + "b", pos: [-0.27, 0, 0], color: "duck" });
    part("h", { shape: "cyl", sides: 8, top: 0.86, size: [0.27, 0.25, 0.27], on: id + "b", pos: [0.13, 0, 0], color: "duck" });
    part("k", { size: [0.15, 0.06, 0.13], on: id + "h", pos: [0.15, -0.15, 0], color: "beak" });
    if (hero) part("g", { size: [0.06, 0.07, 0.3], on: id + "h", pos: [0.11, -0.12, 0], color: "glass" }), part("gb", { size: [0.14, 0.02, 0.3], on: id + "h", pos: [0.05, -0.07, 0], color: "glass" });
    else for (let s = -1; s <= 1; s += 2) part("e" + s, { size: [0.03, 0.05, 0.04], on: id + "h", pos: [0.11, -0.1, s * 0.09], color: "eye" });
    return root;
  }
  const hero = duckOb("duck", true), ducks: DioramaObject[] = [];
  for (let i = 0; i < 6; i++) ducks.push(duckOb("dk" + i, false));
  const ringOb = put({ id: "ring", shape: "group", size: [1.5, 0, 1.5], pos: [0, WY, 0], cluster: "pool", layer: 4.5, below: BELOW, tag: "ring" }), ringParts: DioramaObject[] = [];
  kids.set(ringOb, ringParts);
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * TAU;
    ringParts.push(put({ size: [0.36, 0.2, 0.27], on: "ring", pos: [Math.cos(a) * 0.6, -0.08, Math.sin(a) * 0.6], rot: [0, -a + Math.PI / 2, 0], color: i & 1 ? "ringB" : "ringA", layer: 4.5, below: BELOW }));
  }
  const heroWake = wtr.wake(hero, { size: 0.32, width: 0.2, rest: 0.25 }), ringWake = wtr.wake(ringOb, { size: 0.75, width: 0.7, rest: 0.2 });
  void heroWake, ringWake;
  // Points: [0, NF) floating balls by floater, [NF, NF + ND) drops in the air; stones under water.
  const air = dio.points({ cap: NF + ND, cluster: "pool", layer: 4.6, paint: itemDot });
  const deep = dio.points({ cap: ND, cluster: "yard", layer: 9.5, paint: itemDot });
  const AK = new Uint8Array(NF + ND), AR = new Float64Array(NF + ND), AW = new Float64Array(NF + ND), DK = new Uint8Array(ND);

  // ---- state ----
  let item = 0, hoverOn = false, kbd = false, dirty = true, hudDirty = true, toastT = 0, tweening = false, twang = 0, twangV = 0, jetT = 0, said = "";
  const aim = new Float64Array(2), cur = Float64Array.of(-1.5, 0.8), hit3 = new Float64Array(3), tmp = new Float64Array(3), FV = new Float64Array(3), SL = new Float64Array(2);
  const HD = new Float64Array(NF), cues = new Uint8Array(12);
  let ncue = 0;
  const cue = (k: number) => ncue < 12 && (cues[ncue++] = k);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset, [5] drawn once.
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  function pickItem(i: number) {
    item = i;
    itemK!.textContent = ITEM_KEY[i]!;
    itemK!.setAttribute("aria-label", `What you drop: ${ITEM_NAME[i]} (C)`);
    hint(`Tap the water to drop a ${ITEM_NAME[i]}.`);
    dirty = true;
    engine.wake();
  }
  function hint(s: string) {
    if (s !== said) (said = s), (hintEl.textContent = s);
  }
  function toast(s: string, sec = 1.8) {
    toastEl.textContent = s;
    toastEl.hidden = false;
    live.textContent = s;
    toastT = sec;
    engine.busy(sec);
  }
  function dropAt(x: number, z: number) {
    if (x < X0 || x > X1 || z < Z0 || z > Z1) return false;
    drop(pool, ITEMS[item]!, x, z);
    hudDirty = true;
    engine.wake();
    return true;
  }
  function pullPlug() {
    if (!drainPool(pool)) return;
    wtr.whirl(DRAIN[0]!, DRAIN[1]!, 2.8, PULL + 0.5);
    wtr.bubbles(DRAIN[0]!, DRAIN[1]!, PULL, 1.1);
    cue(8);
    toast("Glug… the drain's open", PULL - 0.4);
    drainK!.disabled = true;
    engine.wake();
  }
  function springboard() {
    // The board dips and flings what you hold off its tip, in an arc out over the water.
    twangV -= 2.6;
    const tip = BOARD.x + BOARD.len - 0.5;
    const k = drop(pool, ITEMS[item]!, tip, BOARD.z, BOARD.y - WY + 0.3, 2.2, 0.15);
    if (k >= 0) pool.D[k * DS + 5] = 3.4;
    cue(1);
    hudDirty = true;
    engine.wake();
  }

  // ---- the camera: framed in the safe area (under the stickers, over the keys), drag orbits ----
  const goal = { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.62 };
  let limits = { yaw: [-1, 1], pitch: [0.5, 1.3], dist: [5, 60] };
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.15;
  function setView(snap: boolean) {
    const port = portrait(), g = goal, W = dio.width, H = dio.height;
    (g.yaw = (port ? -10 : -22) * D), (g.pitch = (port ? 68 : 47) * D), (g.tx = 0), (g.ty = WY), (g.tz = port ? 0.4 : 0.2), (g.fov = 0.62);
    const pts = port
      ? [-DX, DT, -DZ, DX, DT, -DZ, -DX, DT, DZ, DX, DT, DZ]
      : [-GX, GT, -GZ, GX, GT, -GZ, -GX, 0, GZ + 0.4, GX, 0, GZ + 0.4, -GX, GT, GZ, GX, GT, GZ, -7.5, GT + 3, -4.6, 7.5, GT + 3, -4.6, 6.8, GT + 2.7, -4.1];
    dio.fit(g, pts, { x0: 8, x1: W - 8, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    limits = { yaw: [g.yaw - 42 * D, g.yaw + 42 * D], pitch: [30 * D, 74 * D], dist: [g.dist * 0.6, g.dist * 1.5] };
    if (snap || RM) Object.assign(dio.cam, g), (tweening = false);
    else tweening = true;
    dirty = true;
    engine.wake();
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  function stepCam(dt: number) {
    if (!tweening) return false;
    const c = dio.cam, k = 1 - Math.exp(-dt * 5);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const f = CAMF[i]!;
      c[f] += (goal[f] - c[f]) * k;
      d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 40 : i < 2 ? 0.05 : 1));
    }
    if (d < 0.01) Object.assign(c, goal), (tweening = false);
    return true;
  }

  // ---- painting: the floor (tiles, lane, drain, caustics), the ripples, the night, the items ----
  const PQ = new Float64Array(8);
  function wpt(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, first: boolean) {
    dio.project(x, y, z, tmp);
    first ? ctx.moveTo(tmp[0]!, tmp[1]!) : ctx.lineTo(tmp[0]!, tmp[1]!);
  }
  function clipRect(ctx: CanvasRenderingContext2D, y: number) {
    dio.project(X0, y, Z0, tmp), (PQ[0] = tmp[0]!), (PQ[1] = tmp[1]!);
    dio.project(X1, y, Z0, tmp), (PQ[2] = tmp[0]!), (PQ[3] = tmp[1]!);
    dio.project(X1, y, Z1, tmp), (PQ[4] = tmp[0]!), (PQ[5] = tmp[1]!);
    dio.project(X0, y, Z1, tmp), (PQ[6] = tmp[0]!), (PQ[7] = tmp[1]!);
    ctx.beginPath();
    ctx.moveTo(PQ[0]!, PQ[1]!), ctx.lineTo(PQ[2]!, PQ[3]!), ctx.lineTo(PQ[4]!, PQ[5]!), ctx.lineTo(PQ[6]!, PQ[7]!);
    ctx.closePath();
    ctx.clip();
  }
  function floorDecal(ctx: CanvasRenderingContext2D) {
    const a0 = ctx.globalAlpha, t = wtr.time, y = FT + 0.004;
    ctx.save();
    clipRect(ctx, y);
    // Tile joints.
    ctx.strokeStyle = P.night ? "rgba(10,60,90,0.35)" : "rgba(40,110,140,0.22)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = X0 + 0.5; x < X1; x += 0.5) wpt(ctx, x, y, Z0, true), wpt(ctx, x, y, Z1, false);
    for (let z = Z0 + 0.5; z < Z1; z += 0.5) wpt(ctx, X0, y, z, true), wpt(ctx, X1, y, z, false);
    ctx.stroke();
    // The lane line and its T, the drain's grate.
    ctx.fillStyle = P.band;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    wpt(ctx, X0 + 1, y, -0.09, true), wpt(ctx, X1 - 1, y, -0.09, false), wpt(ctx, X1 - 1, y, 0.09, false), wpt(ctx, X0 + 1, y, 0.09, false);
    ctx.fill();
    ctx.beginPath();
    wpt(ctx, X1 - 1.1, y, -0.6, true), wpt(ctx, X1 - 0.92, y, -0.6, false), wpt(ctx, X1 - 0.92, y, 0.6, false), wpt(ctx, X1 - 1.1, y, 0.6, false);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.night ? "#123a52" : "#6b7f93";
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) wpt(ctx, DRAIN[0]! + Math.cos((k / 16) * TAU) * 0.32, y, DRAIN[1]! + Math.sin((k / 16) * TAU) * 0.32, !k);
    ctx.fill();
    ctx.strokeStyle = P.night ? "#49d4ea" : "#c4d3df";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) wpt(ctx, DRAIN[0]! + k * 0.1, y, DRAIN[1]! - 0.26, true), wpt(ctx, DRAIN[0]! + k * 0.1, y, DRAIN[1]! + 0.26, false);
    ctx.stroke();
    // Caustics: two sets of wavy bright lines, drifting with the surface's clock (still when it rests).
    ctx.strokeStyle = P.caustic;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = P.night ? 0.24 : 0.3;
    ctx.beginPath();
    for (let j = 0; j < 12; j++) {
      const z0 = Z0 + 0.25 + j * 0.46;
      for (let k = 0; k <= 30; k++) {
        const x = X0 + (k / 30) * (X1 - X0);
        wpt(ctx, x, y, z0 + 0.13 * Math.sin(x * 2.3 + t * 1.6 + j * 1.7) + 0.06 * Math.sin(x * 5.1 - t * 2.3 + j), !k);
      }
    }
    for (let j = 0; j < 20; j++) {
      const x0 = X0 + 0.2 + j * 0.46;
      for (let k = 0; k <= 16; k++) {
        const z = Z0 + (k / 16) * (Z1 - Z0);
        wpt(ctx, x0 + 0.14 * Math.sin(z * 2.6 - t * 1.4 + j * 2.1) + 0.05 * Math.sin(z * 6 + t * 2 + j), y, z, !k);
      }
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = a0;
  }
  // The ripples: every pulse and its mirror images (each up to three bounces), clipped to the pool:
  // a bright crest, a shaded trough just behind it and a fainter second crest; foam where a front
  // meets a wall. Then the shadows of what is falling, the goal's corner and the aim.
  const IMG = new Float64Array(36 * 3);
  function ring(ctx: CanvasRenderingContext2D, cx: number, cz: number, r: number) {
    if (r <= 0.02) return;
    const n = Math.max(20, Math.min(64, Math.ceil(r * 10)));
    for (let k = 0; k <= n; k++) wpt(ctx, cx + Math.cos((k / n) * TAU) * r, WY + 0.012, cz + Math.sin((k / n) * TAU) * r, !k);
  }
  function ripplesDecal(ctx: CanvasRenderingContext2D) {
    const a0 = ctx.globalAlpha, Pp = pool.P, s = Math.min(2.2, dio.focal() / Math.max(1, dio.cam.dist) / 40);
    ctx.save();
    clipRect(ctx, WY + 0.012);
    // Night: the pool's glow over the water, brightest by the lamp.
    if (P.night) {
      ctx.fillStyle = P.glow;
      ctx.globalAlpha = 0.08;
      ctx.fill();
    }
    for (let i = 0; i < NP; i++) {
      const q = i * 4;
      if (!Pp[q + 3]) continue;
      const age = Pp[q + 2]!, A = Pp[q + 3]! * fade(age), r = C * age;
      if (A < 0.01) continue;
      const n = images(Pp[q]!, Pp[q + 1]!, IMG);
      for (let j = 0; j < n; j++) {
        const cx = IMG[j * 3]!, cz = IMG[j * 3 + 1]!, a = Math.min(0.95, 2.1 * Math.sqrt(A * Math.pow(BOUNCE, IMG[j * 3 + 2]!)));
        // Skip a ring that never crosses the pool.
        const nx = Math.max(X0, Math.min(X1, cx)) - cx, nz = Math.max(Z0, Math.min(Z1, cz)) - cz, fx = Math.max(Math.abs(X0 - cx), Math.abs(X1 - cx)), fz = Math.max(Math.abs(Z0 - cz), Math.abs(Z1 - cz));
        if (a < 0.06 || Math.sqrt(nx * nx + nz * nz) > r + SIG || fx * fx + fz * fz < (r - 3 * SIG) * (r - 3 * SIG)) continue;
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = P.foam;
        ctx.lineWidth = (1.5 + a * 2.6) * s;
        ctx.beginPath();
        ring(ctx, cx, cz, r);
        ctx.stroke();
        ctx.globalAlpha = a * 0.42;
        ctx.strokeStyle = P.trough;
        ctx.lineWidth = (2 + a * 2.4) * s;
        ctx.beginPath();
        ring(ctx, cx, cz, r - CREST * 0.45);
        ctx.stroke();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = P.foam;
        ctx.lineWidth = (1 + a * 1.4) * s;
        ctx.beginPath();
        ring(ctx, cx, cz, r - CREST);
        ctx.stroke();
        // Foam where the front slaps a wall (only the ring that is about to bounce: the direct one or
        // a lower image).
        if (IMG[j * 3 + 2]! < 2) slap(ctx, cx, cz, r, a);
      }
    }
    // A falling thing's shadow on the water: smaller and darker as it comes down.
    const Dd = pool.D;
    for (let i = 0; i < ND; i++) {
      const q = i * DS;
      if (Dd[q + 7] !== D_FALL) continue;
      const h = Dd[q + 2]!, rr = RAD[Dd[q + 6]!]! * (1 + Math.min(1.5, h * 0.25));
      ctx.globalAlpha = Math.max(0.08, 0.32 - h * 0.05);
      ctx.fillStyle = P.trough;
      ctx.beginPath();
      ring(ctx, Dd[q]!, Dd[q + 1]!, rr);
      ctx.fill();
    }
    ctx.restore();
    // The goal: a dashed quarter ring round the far corner, brighter as the duck comes near.
    const dx = pool.F[0]! - GOAL[0]!, dz = pool.F[1]! - GOAL[1]!, near = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 4);
    const gr = GOAL_R + 0.62, pulseA = 0.5 + 0.5 * Math.sin(engine.time * 5);
    ctx.globalAlpha = (0.3 + 0.25 * near) * (pool.F[7] === F_HOME ? 0.6 + 0.4 * pulseA : 1);
    ctx.fillStyle = P.flag;
    ctx.beginPath();
    wpt(ctx, X1, WY + 0.014, Z0, true);
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI / 2 + (k / 12) * (Math.PI / 2);
      wpt(ctx, X1 + Math.cos(a) * gr, WY + 0.014, Z0 + Math.sin(a) * gr, false);
    }
    ctx.fill();
    ctx.globalAlpha = 0.65 + 0.35 * near;
    ctx.strokeStyle = P.flag;
    ctx.lineWidth = 3 * s;
    ctx.setLineDash([6 * s, 5 * s]);
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI / 2 + (k / 12) * (Math.PI / 2);
      wpt(ctx, X1 + Math.cos(a) * gr, WY + 0.014, Z0 + Math.sin(a) * gr, !k);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // The aim: where a drop would land (the pointer's, or the keyboard's cursor).
    if (hoverOn || kbd) {
      const ax = kbd ? cur[0]! : aim[0]!, az = kbd ? cur[1]! : aim[1]!, rr = RAD[ITEMS[item]!]! + 0.1;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = P.night ? "#ffffff" : P.ink;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ring(ctx, ax, az, rr);
      ctx.stroke();
      ctx.beginPath();
      wpt(ctx, ax - rr - 0.18, WY + 0.014, az, true), wpt(ctx, ax - rr + 0.06, WY + 0.014, az, false);
      wpt(ctx, ax + rr + 0.18, WY + 0.014, az, true), wpt(ctx, ax + rr - 0.06, WY + 0.014, az, false);
      ctx.stroke();
    }
    ctx.globalAlpha = a0;
  }
  /** Foam dabs where a ring of radius r about (cx, cz) meets the pool's walls. */
  function slap(ctx: CanvasRenderingContext2D, cx: number, cz: number, r: number, a: number) {
    ctx.fillStyle = P.foam;
    for (let w = 0; w < 4; w++) {
      const vert = w < 2, at = w === 0 ? X0 : w === 1 ? X1 : w === 2 ? Z0 : Z1, d = vert ? at - cx : at - cz;
      if (Math.abs(d) >= r) continue;
      const h = Math.sqrt(r * r - d * d), fade2 = Math.min(1, (r - Math.abs(d)) * 3) * Math.max(0, 1 - (r - Math.abs(d)) * 0.8);
      if (fade2 <= 0.02) continue;
      ctx.globalAlpha = a * fade2;
      for (let sg = -1; sg <= 1; sg += 2) {
        const u = (vert ? cz : cx) + sg * h;
        if (vert ? u < Z0 || u > Z1 : u < X0 || u > X1) continue;
        const ix = vert ? at + (w === 0 ? 0.12 : -0.12) : u, iz = vert ? u : at + (w === 2 ? 0.12 : -0.12);
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const e = (k / 10) * TAU;
          wpt(ctx, ix + Math.cos(e) * (vert ? 0.12 : 0.38), WY + 0.013, iz + Math.sin(e) * (vert ? 0.38 : 0.12), !k);
        }
        ctx.fill();
      }
    }
  }
  function bulbDot(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(1.5, p.sr[i]!), a = ctx.globalAlpha;
    if (P.night) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = P.bulb;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a;
    }
    ctx.fillStyle = P.bulb;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  const BALLC: Key[] = ["ballA", "ballW", "ballB", "ballW", "ballC", "ballW"];
  /** A beach ball (six panels turning as it rolls, a white cap), a rock (faceted, a lit top), a pebble. */
  function itemDot(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(2, p.sr[i]!), deepOne = p === deep, k = deepOne ? DK[i]! : AK[i]!, a = ctx.globalAlpha;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = P.ink;
    if (k === BALL) {
      const rot = AR[i]!;
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = P[BALLC[s]!];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, rot + (s / 6) * TAU, rot + ((s + 1) / 6) * TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = P.ballW;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.24, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - r * 0.38, y - r * 0.4, r * 0.2, 0, TAU);
      ctx.fill();
      // Afloat: the water line across its lower half.
      if (AW[i]! > 0) {
        ctx.globalAlpha = a * 0.5 * AW[i]!;
        ctx.fillStyle = P.water;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.55, r * 1.02, r * 0.5, 0, 0, Math.PI);
        ctx.fill();
      }
    } else {
      const big = k === ROCK, n = big ? 7 : 6;
      ctx.fillStyle = P.rock;
      ctx.beginPath();
      for (let s = 0; s < n; s++) {
        const e = (s / n) * TAU + i, rr = r * (s & 1 ? 0.88 : 1.02);
        s ? ctx.lineTo(x + Math.cos(e) * rr, y + Math.sin(e) * rr * 0.86) : ctx.moveTo(x + Math.cos(e) * rr, y + Math.sin(e) * rr * 0.86);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = P.rock2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.62, y - r * 0.18), ctx.lineTo(x - r * 0.2, y - r * 0.68), ctx.lineTo(x + r * 0.42, y - r * 0.5), ctx.lineTo(x + r * 0.1, y - r * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = a;
  }

  // ---- the model into the scene, each frame it moves ----
  function sync() {
    const F = pool.F, Dd = pool.D;
    let nd = 0, na = 0;
    for (let i = 0; i < 6; i++) show(ducks[i]!, false);
    for (let i = 0; i < NF; i++) {
      const q = i * FS, st = F[q + 7]!, kind = F[q + 6]!;
      const ob = i === 0 ? hero : i === 1 ? ringOb : kind === DUCKY ? ducks[nd++] : null;
      const vis = st === F_AFLOAT || st === F_HOME || st === F_DOWN || st === F_FLY;
      if (ob) show(ob, vis);
      if (!vis) continue;
      let x = F[q]!, z = F[q + 1]!, y = WY + F[q + 4]! + wtr.height(x, z), sink = 0;
      if (st === F_DOWN) sink = F[q + 8]!;
      if (st === F_FLY) flight(x, z, F[q + 8]!, tmp), (x = tmp[0]!), (y = WY + tmp[1]!), (z = tmp[2]!);
      // Facing: where it is going (smoothed), plus its spin.
      const vx = F[q + 2]!, vz = F[q + 3]!, sp = vx * vx + vz * vz;
      if (sp > 0.01 && kind !== RING) {
        let dh = Math.atan2(-vz, vx) - HD[i]!;
        dh -= Math.round(dh / TAU) * TAU;
        HD[i] = HD[i]! + dh * 0.08;
      }
      if (kind === BALL) {
        const k = na++;
        (air.x[k] = x), (air.y[k] = y + RAD[BALL]! * 0.55 * (1 - sink)), (air.z[k] = z), (air.r[k] = RAD[BALL]! * (1 - sink * 0.8)), (air.a[k] = 1 - sink * 0.6);
        (AK[k] = BALL), (AR[k] = F[q + 10]! + x * 1.7), (AW[k] = 1);
        continue;
      }
      if (!ob) continue;
      wtr.slope(x, z, SL);
      field(pool, x, z, FV);
      const tilt = st === F_FLY ? 0 : 1;
      ob.pos[0] = x, ob.pos[1] = y - sink * 0.6, ob.pos[2] = z;
      ob.rot[1] = (kind === RING ? F[q + 10]! : HD[i]! + F[q + 10]! * 0.3) + (st === F_FLY ? F[q + 8]! * TAU : 0) + sink * 6;
      ob.rot[0] = tilt * (SL[1]! * 2 + FV[2]! * 0.08);
      ob.rot[2] = -tilt * (SL[0]! * 2 + FV[1]! * 0.08) + (st === F_HOME ? Math.sin(F[q + 8]! * 18) * 0.25 : 0);
      ob.alpha = 1 - sink * 0.85;
    }
    // Drops: in the air (points over the water, ducks as ducks), sinking or resting (points under it).
    let nn = 0;
    for (let i = 0; i < ND; i++) {
      const q = i * DS, st = Dd[q + 7]!, kind = Dd[q + 6]!;
      if (!st) continue;
      const x = Dd[q]!, z = Dd[q + 1]!, y = WY + Dd[q + 2]!;
      if (st === D_FALL && kind === DUCKY && nd < 6) {
        const ob = ducks[nd++]!;
        show(ob, true), (ob.pos[0] = x), (ob.pos[1] = y), (ob.pos[2] = z), (ob.rot[2] = Dd[q + 5]! * 0.08), (ob.alpha = 1);
        continue;
      }
      if (st === D_FALL) {
        const k = na++;
        (air.x[k] = x), (air.y[k] = y), (air.z[k] = z), (air.r[k] = RAD[kind]!), (air.a[k] = 1), (AK[k] = kind), (AR[k] = y * 2.2), (AW[k] = 0);
      } else if (st === D_SINK || st === D_REST) {
        const k = nn++;
        (deep.x[k] = x), (deep.y[k] = y), (deep.z[k] = z), (deep.r[k] = RAD[kind]!), (deep.a[k] = 0.92), (DK[k] = kind);
      }
    }
    air.n = na;
    deep.n = nn;
    // The board's twang; the flag stirs while the duck is home.
    boardRoot.rot[2] = twang;
    flagOb.rot[1] = pool.F[7] === F_HOME ? Math.sin(engine.time * 12) * 0.4 : 0;
  }
  function hudWrite() {
    nums[0]!.textContent = "" + pool.drops;
    nums[1]!.textContent = pool.best ? "" + pool.best : "–";
    drainK!.disabled = draining(pool) >= 0;
  }

  // ---- events from the model: splashes, sound, toasts ----
  function events() {
    const E = pool.E;
    for (let k = 0; k < pool.ne; k++) {
      const q = k * 5, ty = E[q]!, x = E[q + 1]!, z = E[q + 2]!, a = E[q + 3]!, b = E[q + 4]!;
      if (ty === E_SPLASH) {
        wtr.splash(x, z, a);
        cue(b === ROCK ? 2 : 1);
        if (b === ROCK || b === PEBBLE) wtr.bubbles(x, z, b === ROCK ? 1.4 : 0.6, b === ROCK ? 0.7 : 0.3);
      } else if (ty === E_BONK) wtr.ripple(x, z, 0.5), cue(3);
      else if (ty === E_FOUL) toast("Ripples only! Back to the start"), cue(4);
      else if (ty === E_HOME) toast(a ? `Corner pocket! ${a} drop${a === 1 ? "" : "s"}` : "Corner pocket!", 2.4), cue(5), wtr.splash(x, z, 0.55);
      else if (ty === E_GULP) b ? wtr.ripple(x, z, 0.6) : (wtr.bubbles(x, z, 0.8, 0.5), cue(6));
      else if (ty === E_POP) wtr.splash(x, z, 0.34), cue(7), a === 1 && toast("Refill!", 1.2);
      else if (ty === E_LAND) wtr.bubbles(x, z, 0.5, 0.3);
      else if (ty === E_KNOCK) wtr.ripple(x, z, 0.35);
      else if (ty === E_BACK) cue(9);
      hudDirty = true;
    }
    pool.ne = 0;
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
          dirty = true;
        }
        floorOb.emissive = lampOb.emissive = P.night;
        surf.alpha = P.night ? 0.55 : 0.6;
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = drainK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 4;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 4 : 6;
        setView(true);
      }
      // The tap that woke the piece drops something once there is a frame to aim from.
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y);
      }
    },
    step(e, dt) {
      for (let i = 0; i < ncue; i++) e.events.emit(CUES[cues[i]!]!);
      ncue = 0;
      let moving = step(pool, dt);
      events();
      // The refill: the return jet burbles while the pool fills.
      if (draining(pool) >= PULL && (jetT -= dt) <= 0) (jetT = 0.22), wtr.splash(JET[0]! + 0.2, JET[1]!, 0.26);
      if (wtr.step(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (twang || twangV) {
        twangV += (-twang * 140 - twangV * 5) * dt;
        twang += twangV * dt * 0.06;
        if (Math.abs(twang) < 0.0005 && Math.abs(twangV) < 0.01) twang = twangV = 0;
        moving = true;
      }
      if (toastT > 0 && (toastT -= dt) <= 0) (toastEl.hidden = true), (toastT = 0);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) {
        dirty = false;
        sync();
        dio.draw();
        V[5] = 1;
      }
    },
  });

  // ---- input: tap drops, drag orbits, keys aim and drop ----
  let downX = 0, downY = 0, dragging = false, down = -1, lx = 0, ly = 0;
  function waterAt(x: number, y: number, out: Float64Array) {
    return dio.ground(x, y, WY, out) && out[0]! >= X0 && out[0]! <= X1 && out[2]! >= Z0 && out[2]! <= Z1;
  }
  function tap(x: number, y: number) {
    kbd = false;
    const ob = dio.root(dio.pick(x, y));
    if (ob && ob.tag === "board") return springboard();
    if (waterAt(x, y, hit3)) dropAt(hit3[0]!, hit3[2]!);
  }
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (down >= 0) return;
    play.setPointerCapture(e.pointerId);
    (down = e.pointerId), (downX = lx = e.offsetX), (downY = ly = e.offsetY), (dragging = false);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    const x = e.offsetX, y = e.offsetY;
    if (e.pointerId !== down) {
      if (e.pointerType !== "mouse") return;
      const on = waterAt(x, y, hit3);
      if (on) (aim[0] = hit3[0]!), (aim[1] = hit3[2]!);
      if (on || hoverOn) (hoverOn = on), (kbd = false), (dirty = true), engine.wake();
      return;
    }
    if (!dragging && Math.hypot(x - downX, y - downY) > 8) (dragging = true), play.classList.add("sp-drag");
    if (dragging) (dio.cam.yaw -= (x - lx) * 0.006), (dio.cam.pitch += (y - ly) * 0.005), dio.clamp(limits), (tweening = false), (dirty = true), engine.wake();
    (lx = x), (ly = y);
  }, sig);
  const end = (e: PointerEvent) => {
    if (e.pointerId !== down) return;
    down = -1;
    play.classList.remove("sp-drag");
    if (!dragging && e.type === "pointerup") tap(e.offsetX, e.offsetY);
    dragging = false;
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  play.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && hoverOn) (hoverOn = false), (dirty = true), engine.wake();
  }, sig);
  const MOVE: Record<string, number[]> = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "c") return void (e.preventDefault(), pickItem((item + 1) % 4));
    if (k === "d") return void (e.preventDefault(), pullPlug());
    if (k >= "1" && k <= "4") return void (e.preventDefault(), pickItem(+k - 1));
    const mv = MOVE[e.key];
    if (mv) {
      e.preventDefault();
      kbd = true;
      (cur[0] = Math.max(X0 + 0.3, Math.min(X1 - 0.3, cur[0]! + mv[0]!))), (cur[1] = Math.max(Z0 + 0.3, Math.min(Z1 - 0.3, cur[1]! + mv[1]!)));
      dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) e.preventDefault(), (kbd = true), dropAt(cur[0]!, cur[1]!);
  }, sig);

  // The poster (scripts/gallery-posters.mjs): a cannonball just in, its column up and its ripples
  // running out; an older ring bouncing off the far wall; a beach ball on its way down.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(pool);
    pool.F[0] = -2.2, pool.F[1] = 1.1;
    pool.F[FS] = 1.6, pool.F[FS + 1] = 0.4;
    drop(pool, ROCK, -0.6, 0.6, 0.9);
    drop(pool, BALL, 2.3, -0.9, 2.4);
    drop(pool, PEBBLE, -3.4, -1.6, 0.2);
    for (let i = 0; i < 3; i++) pool.F[(2 + i) * FS + 7] = 0;
    // An earlier drop's ring, a second in: already bounced off the near wall.
    pool.P[0] = 2.8, pool.P[1] = 1.4, pool.P[2] = 1.1, pool.P[3] = 0.9;
    pool.drops = 3;
    hudDirty = dirty = true;
  }

  pickItem(0);
  engine.start();
  return {
    engine,
    accessible: true,
    get pool() {
      return pool;
    },
    get state() {
      let n = 0;
      for (let i = 0; i < NF; i++) if (pool.F[i * FS + 7] === F_AFLOAT) n++;
      return { item, drops: pool.drops, best: pool.best, homes: pool.homes, drain: draining(pool) >= 0, duck: pool.F[7]!, floaters: n, tween: tweening };
    },
    screen(x: number, z: number) {
      dio.project(x, WY, z, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    boardTip() {
      dio.project(BOARD.x + BOARD.len - 0.8, BOARD.y + 0.08, BOARD.z, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the cannonball's column at its height (scripts/gallery-posters.mjs). */
export const posterAt = 0.55;
