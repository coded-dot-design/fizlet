// "Pocket Harbour" (hero): a tiny seaside town on a tabletop, built from the @fzlt/core/props kit,
// that you poke to life. Tap a lamp and it lights; a house and its window glows (by day its chimney
// puffs); the lighthouse sweeps its beam; the fishing boat casts off, loops the bay and moors again;
// the truck drives the harbour road; the gulls lift off the roofs, circle and land. DAY / NIGHT (or
// N) turns dusk on: the lamps come on one by one along the quay and the beam starts to turn. And a
// cat is hiding: find it in five spots (tap it, or what it hides in). Drag to turn the table; the
// arrows walk a cursor over the town and Enter pokes what it is on.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D, picking, the depth sort with the effects in it),
// @fzlt/core/props (every building, lamp, tree, the lighthouse, the dock, the truck, the crates and
// the bench), @fzlt/core/slot, @fzlt/core/sound. The town's toys and the hunt are ./town.ts,
// headless (tests/pocket-harbour.test.mjs); this file is the scene (tests/pocket-harbour.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { bench, bush, car, crates, dock, house, lamppost, lighthouse, pineTree, rocks, roundTree, shop, buoy, truck, trafficCone, DOCK_STEP } from "../../../../src/props";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { BEAM, BOAT, E_END, E_FOUND, E_HUNT, E_LAMP, E_MISS, E_NIGHT, E_START, E_WINDOW, GULLS, GULL_N, LAMPS, ROAD_LOOP, SPOTS, SPOT_NAMES, TRUCK, town } from "./town";

const TAU = 6.283185307179586;
// The table: plinth half sizes; the land's top LY (the quay and the town), the water's WY.
const PX = 14, PZ = 9.2, LY = 1.0, WY = 0.62, ALIVE = 5;
const LH = { x: 10.2, z: 5.0, y: 0.95, s: 0.9 };
/** Lamp positions along the quay (x), the front row of buildings (x, kind 0 house 1 shop, seed). */
const LAMP_X = [-11, -7.6, -4.6, 0.6, 4.4, 7.9];
const ROW = [-9.6, 1, 3, -6.6, 0, 1, -3.6, 0, 2, -0.6, 1, 4, 2.4, 0, 5, 5.4, 0, 6];
// Palettes by role: an afternoon (day) and the harbour at night; props colours are overrides.
const DAY = {
  night: false, light: [0.5, 1, 0.45], amb: 0.56, bg: "#efe6da", sky: "#cfe8f2",
  table: "#c79c74", plinth: "#a8805c", land: "#cfe3b4", quay: "#e3d8c6", road: "#9d97a8", line: "#f7f2e8", sea: "#7fc8de", seaD: "#5aa9c6", wall: "#b8b2a6", floor: "#e9dcc4",
  hull: "#ef7d6a", hull2: "#fbf7f0", cabin: "#ffffff", dinghy: "#7fcfa8", cat: "#e8894a", catD: "#b9622f", eye: "#2b2833", gull: "#fbf7f0", gullW: "#c9c4d4", beak: "#f2c96b",
  glass: "#bfe3f2", lit: "#ffd27a", lampOff: "#d8d2c4", lampOn: "#ffe7a0", foam: "#ffffff", smoke: "#e9e4ee", beam: "#fff6c8", halo: "#ffe7a0", ripple: "rgba(255,255,255,0.55)",
  props: {} as Record<string, string>, shadow: "#3a2d3c",
};
type Pal = typeof DAY;
const NIGHT: Pal = {
  ...DAY, night: true, light: [-0.3, 1, 0.6], amb: 0.42, bg: "#121a2e", sky: "#1b2540",
  table: "#4a3a33", plinth: "#3a2d29", land: "#3d4a52", quay: "#5a5868", road: "#2a2d3c", line: "#8c88a0", sea: "#1f4e6e", seaD: "#173c58", wall: "#4b4a5c", floor: "#2a2f40",
  hull: "#c9615a", hull2: "#cfcadb", cabin: "#d9d6e4", dinghy: "#4f8f78", cat: "#2a2833", catD: "#1c1b23", eye: "#d6ff5a", gull: "#d9d6e4", gullW: "#8c88a0", beak: "#c9a34f",
  glass: "#2d3450", lit: "#ffcf6e", lampOff: "#4a4660", lampOn: "#ffe08a", foam: "#bfe6ff", smoke: "#7e7a92", beam: "#fff2b0", halo: "#ffd27a", ripple: "rgba(190,230,255,0.4)",
  props: { wall: "#7c7896", roof: "#8a4f6a", trim: "#9b97b0", door: "#4b4560", brick: "#7a4b52", awning: "#a8586a", awning2: "#bdb8cc", leaf: "#2f5d4f", leaf2: "#3d7060", trunk: "#5a4438", stone: "#6f7184", stripe: "#a9524c", metal: "#3b3f52", deck: "#6d5a48", plank: "#54443a", post: "#4a3c33", wood: "#7a5a3e", wood2: "#634831", body: "#bdb8cc", tire: "#25232e", rock: "#5a5870", rock2: "#6c6a84", buoy: "#b55a50", buoy2: "#cfcadb", cone: "#b8653f", cone2: "#cfcadb" },
  shadow: "#000000",
};

export type HarbourScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly town: ReturnType<typeof town>;
  readonly state: { night: boolean; found: number; spot: number; busy: number; cursor: string; card: boolean };
  /** The screen point of a thing by name ("lamp2", "lighthouse", "boat", "cat", …), as of the last draw. */
  screen(name: string): [number, number];
  poster(): void;
  destroy(): void;
};

type Tag = { k: string; i: number };

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): HarbourScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const themeNight = () => document.documentElement.dataset.theme !== "light";
  const tw = town(20261111);
  tw.setNight(themeNight());
  tw.reset();
  tw.T[BEAM] = -1;
  let P: Pal = tw.night ? NIGHT : DAY;

  // ---- the page: canvas, the play surface (pointer + keyboard), stickers, the keys strip ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ph-play";
  play.setAttribute("aria-label", "Pocket Harbour: tap things to bring the town to life and find the hidden cat. Arrows move the cursor, Enter pokes, N day or night, M mutes; drag to turn the table");
  const hud = L.add(document.createElement("div"));
  hud.className = "ph-hud";
  hud.innerHTML = `<div class="ph-head"><p class="ph-top"><b class="ph-chip ph-cat"><i class="ph-paw"></i><span>CAT 0/${SPOTS}</span></b></p><p class="ph-hint">Tap the town to wake it up. A cat is hiding somewhere.</p></div><p class="ph-toast" hidden></p><p class="ph-live" aria-live="polite"></p><div class="ph-card" role="dialog" aria-label="All found" hidden><b>ALL FIVE!</b><p>The harbour cat has had enough attention for one day.</p><button type="button" class="bui-key ph-again">HIDE AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, catN = head.querySelector("span") as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, card = hud.children[3] as HTMLElement, again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { lamp: "click", window: "click", boat: "ready", truck: "fire", gulls: "power", beam: "power", found: "win", miss: "hurt", night: "end", day: "ready", splash: "click", hide: "click" }, volume: 0.1 });
  const K_MUTE = 0, K_NIGHT = 1;
  const [muteK, nightK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "NIGHT", aria: "Day or night (N)", id: K_NIGHT, c: "ph-nk" },
  ], (id, down) => {
    if (!down) return;
    alive();
    id === K_MUTE ? toggle() : setNight(!tw.night);
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the diorama ----
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  // Handles: lamps (root, lantern part), windows per building, the movers, gulls (root, wings), the cat.
  const lamps: DioramaObject[] = [], lanterns: DioramaObject[] = [], windows: DioramaObject[][] = [], builds: DioramaObject[] = [];
  const gulls: DioramaObject[] = [], wings: DioramaObject[] = [], trees: DioramaObject[] = [];
  let boat: DioramaObject, dinghy: DioramaObject, lorry: DioramaObject, cat: DioramaObject, lhouse: DioramaObject, crateR: DioramaObject, benchR: DioramaObject;
  let foam: DioramaPoints, smoke: DioramaPoints;
  const FV = new Float64Array(60 * 4), SMV = new Float64Array(40 * 4); // vx vy vz life (max life fixed)
  const GULL_AT = [-9.6, LY + 2.12, -3.7, -2.7, LY + 0.02, 5.9, LH.x, LH.y + 3.8 * LH.s, LH.z];
  // The cat's spots: [x, y, z, yaw, how it sits (0 crouched: only ears and tail show, 1 lying, 2 sat up)].
  const SPOT = [-5.2, LY, -1.0, 0.3, 0, 2.4, LY + 2.36, -3.75, 0, 1, -4.5, WY - 0.02, 3.5, -1.2, 0, 2.4, LY, -0.55, 0, 1, LH.x + 0.35, LH.y + 0.4, LH.z + 1.05, -1.4, 2];
  const wobble = new Float64Array(24);

  function build() {
    dio.clear();
    lamps.length = lanterns.length = windows.length = builds.length = gulls.length = wings.length = trees.length = 0;
    dio.setLight(P.light, P.amb);
    const C = P.props;
    dio.cluster("table", { fixed: -6 });
    dio.cluster("sea", { fixed: -4 });
    dio.cluster("land", { fixed: -3 });
    dio.add({ id: "table", size: [PX * 2 + 6, 0.5, PZ * 2 + 5], pos: [0, -1.6, 0.5], color: P.table, cluster: "table", layer: 0, pick: false });
    dio.add({ id: "plinth", size: [PX * 2 + 0.6, 1.1, PZ * 2 + 0.6], pos: [0, -1.1, 0], color: P.plinth, cluster: "table", layer: 1, pick: false });
    // The basin: its floor, the water (a cutaway slab: you see into it at the front), ripples over it.
    dio.add({ id: "floor", size: [PX * 2, 0.1, PZ], pos: [0, 0, PZ / 2], color: P.floor, cluster: "sea", layer: 0, pick: false });
    dio.add({ id: "water", size: [PX * 2, WY - 0.1, PZ], pos: [0, 0.1, PZ / 2], color: P.sea, alpha: 0.9, cluster: "sea", layer: 1, tag: { k: "water", i: 0 } });
    dio.decal("sea", 2, paintSea);
    // The land: the quay wall, the ground, the road (a smooth decal), the quay's edge stones.
    dio.add({ id: "land", size: [PX * 2, LY, PZ], pos: [0, 0, -PZ / 2], color: P.land, cluster: "land", layer: 0, pick: false });
    dio.add({ id: "quay", size: [PX * 2, 0.04, 1.0], pos: [0, LY, -0.5], color: P.quay, cluster: "land", layer: 1, pick: false });
    dio.add({ id: "wall", size: [PX * 2, LY - 0.05, 0.08], pos: [0, 0.05, 0.02], color: P.wall, cluster: "land", layer: 1, pick: false });
    dio.decal("land", 2, paintRoad);
    // The breakwater and the lighthouse on it.
    dio.add({ id: "isle", shape: "cyl", sides: 9, top: 0.8, size: [3.4, LH.y - 0.1, 3.0], pos: [LH.x, 0.1, LH.z], color: C.stone || "#b9b5c6", pick: false });
    rocks(dio, { id: "rk1", pos: [LH.x - 1.8, 0.1, LH.z + 0.6], scale: 0.9, seed: 3, colors: C, pick: false });
    lhouse = lighthouse(dio, { id: "lighthouse", pos: [LH.x, LH.y, LH.z], scale: LH.s, colors: C, tag: { k: "lighthouse", i: 0 } });
    dio.decal("lighthouse", 30, paintBeam);
    // The pier, the boat and the dinghy (the props kit has no boat: these are shapes of our own).
    for (let k = 0; k < 2; k++) dock(dio, { id: "dock" + k, pos: [-3, LY - 0.66, 1.5 + k * DOCK_STEP], rot: -Math.PI / 2, seed: k, colors: C, pick: false });
    boat = hull("boat", 1, P.hull, true);
    dinghy = hull("dinghy", 0.55, P.dinghy, false);
    dinghy.pos[0] = -4.5; dinghy.pos[2] = 3.5; dinghy.rot[1] = -1.2;
    buoy(dio, { id: "by1", pos: [3.2, WY - 0.25, 5.4], colors: C, pick: false });
    buoy(dio, { id: "by2", pos: [-8.5, WY - 0.25, 6.2], seed: 1, colors: C, pick: false });
    // The town: the front row on the quay road, a back row, trees; lamps along the quay; crates, a bench.
    for (let k = 0; k < 6; k++) {
      const x = ROW[k * 3]!, o = { id: "b" + k, pos: [x, LY, -3.7], seed: ROW[k * 3 + 2]!, colors: C, tag: { k: "build", i: k } };
      builds.push(ROW[k * 3 + 1] ? shop(dio, o) : house(dio, o));
    }
    for (let k = 0; k < 5; k++) house(dio, { id: "bb" + k, pos: [-9.5 + k * 3.6, LY, -8.0], seed: 10 + k, scale: 0.85, colors: C, pick: false });
    const T = [-12.6, -2.6, 0, 8.6, -4.4, 1, 12.6, -6.8, 0, -12.4, -7.6, 1, 11.2, -2.4, 2, 9.4, -8.2, 0];
    for (let k = 0; k < 6; k++) {
      const o = { id: "tr" + k, pos: [T[k * 3]!, LY, T[k * 3 + 1]!], seed: k, scale: 0.85, colors: C, tag: { k: "tree", i: k } };
      trees.push(T[k * 3 + 2] === 1 ? roundTree(dio, o) : T[k * 3 + 2] === 2 ? bush(dio, o) : pineTree(dio, o));
    }
    for (let i = 0; i < LAMPS; i++) {
      const r = lamppost(dio, { id: "lamp" + i, pos: [LAMP_X[i]!, LY, -0.38], scale: 0.8, colors: { ...C, lamp: P.lampOff }, tag: { k: "lamp", i } });
      lamps.push(r);
      dio.decal("lamp" + i, 20, (ctx) => halo(ctx, i));
    }
    crateR = crates(dio, { id: "crates", pos: [-5.2, LY, -0.45], seed: 2, colors: C, tag: { k: "crates", i: 0 } });
    benchR = bench(dio, { id: "bench", pos: [2.4, LY, -0.5], colors: C, tag: { k: "bench", i: 0 } });
    lorry = truck(dio, { id: "truck", pos: [-7, LY, -1.45], colors: { ...C, paint: P.night ? "#4f8fb5" : "#6db0cf" }, tag: { k: "truck", i: 0 } });
    car(dio, { id: "car", pos: [4.6, LY, -6.2], seed: 1, colors: C, pick: false });
    trafficCone(dio, { id: "cone", pos: [-10.6, LY, -0.45], colors: C, pick: false });
    // The lanterns and windows, by their colours (each prop's parts are anonymous).
    dio.recolor((ob) => {
      const r = dio.root(ob), tag = r?.tag as Tag | undefined;
      if (!tag || ob === r) return;
      if (tag.k === "lamp" && ob.emissive) lanterns[tag.i] = ob;
      if (tag.k === "build" && ob.color === (C.glass || DAY.glass)) (windows[tag.i] ||= []).push(ob);
    });
    // Gulls: a body, a head and beak, two wings on hinges.
    for (let i = 0; i < GULL_N; i++) {
      const id = "gull" + i, g = dio.add({ id, shape: "group", size: [0.5, 0, 0.4], tag: { k: "gull", i } });
      dio.add({ size: [0.42, 0.16, 0.16], pos: [0, 0.06, 0], on: id, color: P.gull });
      dio.add({ size: [0.14, 0.13, 0.12], pos: [0.24, 0.16, 0], on: id, color: P.gull });
      dio.add({ size: [0.1, 0.04, 0.05], pos: [0.35, 0.2, 0], on: id, color: P.beak });
      dio.add({ size: [0.14, 0.03, 0.12], pos: [-0.26, 0.14, 0], on: id, color: P.gullW });
      for (let s = -1; s <= 1; s += 2) {
        const w = dio.add({ id: id + "w" + s, shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.18, s * 0.06], on: id });
        dio.add({ size: [0.2, 0.03, 0.46], pos: [0, 0, s * 0.24], on: id + "w" + s, color: P.gullW });
        wings.push(w);
      }
      gulls.push(g);
    }
    // The cat: low and sleek, ears up, tail up; at night its eyes catch the light.
    cat = dio.add({ id: "cat", shape: "group", size: [0.6, 0, 0.3], tag: { k: "cat", i: 0 }, shadow: 0.2 });
    dio.add({ size: [0.46, 0.2, 0.2], pos: [0, 0.08, 0], on: "cat", color: P.cat });
    for (const x of [-0.17, 0.17]) for (const z of [-0.07, 0.07]) dio.add({ size: [0.06, 0.1, 0.06], pos: [x, 0, z], on: "cat", color: P.catD });
    dio.add({ size: [0.2, 0.18, 0.2], pos: [0.27, 0.18, 0], on: "cat", color: P.cat });
    for (const z of [-0.06, 0.06]) dio.add({ shape: "cyl", sides: 4, top: 0, size: [0.09, 0.12, 0.07], pos: [0.27, 0.36, z], on: "cat", color: P.catD });
    for (const z of [-0.05, 0.05]) dio.add({ size: [0.02, 0.04, 0.04], pos: [0.375, 0.27, z], on: "cat", color: P.eye, emissive: P.night });
    dio.add({ size: [0.05, 0.36, 0.05], pos: [-0.25, 0.18, 0], rot: [0, 0, 0.5], on: "cat", color: P.catD });
    foam = dio.points({ cap: 60, color: P.foam, layer: 3 });
    smoke = dio.points({ cap: 40, color: P.smoke, layer: 6 });
    paintLights();
  }
  /** A boat of our own: a pointed hull, a deck stripe, (a cabin and a mast), resting on the water. */
  function hull(id: string, s: number, col: string, big: boolean) {
    const outline = [[1.1, 0], [0.62, 0.46], [-0.88, 0.46], [-1.0, 0.3], [-1.0, -0.3], [-0.88, -0.46], [0.62, -0.46]].map(([x, z]) => [x! * s, z! * s]);
    const r = dio.add({ id, shape: "group", size: [2.1 * s, 0, 1 * s], pos: [-1.7, WY - 0.22 * s, 2.2], rot: [0, -Math.PI / 2, 0], tag: { k: id, i: 0 } });
    dio.add({ shape: "prism", outline, taper: 0.7, size: [1, 0.46 * s, 1], on: id, color: col });
    dio.add({ shape: "prism", outline: outline.map(([x, z]) => [x! * 0.97, z! * 0.97]), size: [1, 0.06 * s, 1], pos: [0, 0.4 * s, 0], on: id, color: P.hull2 });
    if (big) {
      dio.add({ size: [0.7, 0.5, 0.62], pos: [-0.25, 0.46, 0], on: id, color: P.cabin });
      dio.add({ size: [0.72, 0.16, 0.64], pos: [-0.25, 0.68, 0], on: id, color: P.glass });
      dio.add({ size: [0.82, 0.07, 0.72], pos: [-0.25, 0.96, 0], on: id, color: P.hull });
      dio.add({ shape: "cyl", sides: 6, size: [0.07, 1.3, 0.07], pos: [0.3, 0.46, 0], on: id, color: P.props.metal || "#6e6878" });
      dio.add({ size: [0.3, 0.18, 0.02], pos: [0.45, 1.5, 0], on: id, color: P.hull });
    } else dio.add({ size: [0.1, 0.04, 0.9 * s], pos: [-0.1, 0.4 * s, 0], on: id, color: P.props.wood || "#d9a46c" });
    return r;
  }
  /** Lamps and windows to the town's state. */
  function paintLights() {
    for (let i = 0; i < LAMPS; i++) {
      const l = lanterns[i];
      if (l) (l.color = tw.lamp[i] ? P.lampOn : P.lampOff), (l.emissive = !!tw.lamp[i]);
    }
    for (let k = 0; k < windows.length; k++) for (const w of windows[k] || []) (w.color = tw.win[k] ? P.lit : P.props.glass || P.glass), (w.emissive = !!tw.win[k]);
  }

  // ---- state ----
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), tmp3 = new Float64Array(3), B = new Float64Array(3), G3 = new Float64Array(3), hit3 = new Float64Array(3);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once.
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  let dirty = true, hudDirty = true, aliveT = 0, toastT = 0, said = "", wave = 0, cursor = -1, kbd = false;
  const RIP = new Float64Array(16 * 3), rr = seeded(5);
  for (let i = 0; i < 16; i++) (RIP[i * 3] = (rr() * 2 - 1) * (PX - 1.5)), (RIP[i * 3 + 1] = 0.8 + rr() * (PZ - 1.6)), (RIP[i * 3 + 2] = rr() * TAU);
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  /** Something happened: the water keeps moving a while (a scheduled hold, so settle waits). */
  function alive() {
    aliveT = Math.max(aliveT, engine.time + ALIVE);
    engine.busy(ALIVE);
    engine.wake();
  }
  function setNight(on: boolean) {
    tw.setNight(on);
    if (tw.n) events();
  }
  const limits = { yaw: [-0.85, 0.85], pitch: [0.42, 1.2], dist: [10, 120] };
  const HOME = { yaw: -0.28, pitch: 0.78 };

  // ---- the toys, drawn from the town ----
  function pose() {
    const t = engine.time, bob = t < aliveT ? Math.sin(t * 2.2) * 0.03 : 0;
    const sp = tw.boat(B);
    boat.pos[0] = B[0]!; boat.pos[2] = B[1]!; boat.rot[1] = B[2]!;
    boat.pos[1] = WY - 0.22 + bob;
    boat.rot[0] = Math.sin(t * 1.7) * 0.03 * (t < aliveT ? 1 : 0) + sp * 0.04;
    dinghy.pos[1] = WY - 0.12 - bob * 0.8;
    tw.truck(B);
    lorry.pos[0] = B[0]!; lorry.pos[2] = B[1]!; lorry.rot[1] = B[2]!;
    // Gulls: perched, or up on a circle over the bay, wings beating.
    for (let i = 0; i < GULL_N; i++) {
      tw.gull(i, G3);
      const g = gulls[i]!, up = G3[0]!, a = G3[1]!, cx = -1 + Math.cos(a) * 4.2, cz = 4 + Math.sin(a) * 2.6, cy = 4.6 + Math.sin(a * 2) * 0.3;
      g.pos[0] = GULL_AT[i * 3]! + (cx - GULL_AT[i * 3]!) * up;
      g.pos[1] = GULL_AT[i * 3 + 1]! + (cy - GULL_AT[i * 3 + 1]!) * up;
      g.pos[2] = GULL_AT[i * 3 + 2]! + (cz - GULL_AT[i * 3 + 2]!) * up;
      g.rot[1] = up > 0.02 ? -a - Math.PI / 2 : 0.4 + i;
      g.rot[0] = up * 0.35;
      // Perched, the wings fold back along the body; flying, they spread and beat.
      wings[i * 2]!.rot[0] = -G3[2]! * 0.9;
      wings[i * 2 + 1]!.rot[0] = G3[2]! * 0.9;
      wings[i * 2]!.rot[1] = -(1 - up) * 1.3;
      wings[i * 2 + 1]!.rot[1] = (1 - up) * 1.3;
    }
    // Trees and things you poke wobble back still.
    for (let k = 0; k < trees.length; k++) trees[k]!.rot[2] = Math.sin(wobble[k]! * 18) * wobble[k]! * 0.25;
    crateR.rot[2] = Math.sin(wobble[8]! * 22) * wobble[8]! * 0.12;
    benchR.rot[2] = Math.sin(wobble[9]! * 22) * wobble[9]! * 0.1;
    // The cat: in its spot; just found, it hops out and slips away, then shows in the next.
    const s = tw.spot(), h = tw.H[2]!;
    cat.pos[0] = SPOT[s * 5]!; cat.pos[1] = SPOT[s * 5 + 1]!; cat.pos[2] = SPOT[s * 5 + 2]!; cat.rot[1] = SPOT[s * 5 + 3]!;
    let a = 1, sit = SPOT[s * 5 + 4]!, hop = 0;
    if (h >= 0 && h < 0.8) (hop = Math.sin((h / 0.8) * Math.PI) * 0.7), (sit = 2);
    else if (h >= 0.8 && h < 1.6) (a = 1 - (h - 0.8) / 0.8), (sit = 2);
    else if (h >= 1.6) a = (h - 1.6) / 0.6;
    cat.pos[1] = cat.pos[1]! + hop + (sit === 0 ? -0.16 : 0);
    cat.rot[2] = sit === 2 ? 0.35 : 0;
    cat.alpha = Math.max(0, Math.min(1, a));
  }

  // ---- FX: foam behind the boat and where you tap the water, smoke from chimneys and the truck ----
  function puff(pool: DioramaPoints, VV: Float64Array, cap: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number) {
    let j = pool.n < cap ? pool.n++ : -1;
    if (j < 0) {
      let lo = Infinity;
      for (let i = 0; i < cap; i++) if (VV[i * 4 + 3]! < lo) (lo = VV[i * 4 + 3]!), (j = i);
    }
    pool.x[j] = x; pool.y[j] = y; pool.z[j] = z; pool.r[j] = r; pool.a[j] = 0.8;
    VV[j * 4] = vx; VV[j * 4 + 1] = vy; VV[j * 4 + 2] = vz; VV[j * 4 + 3] = life;
  }
  function stepPool(pool: DioramaPoints, VV: Float64Array, dt: number, grow: number, life: number) {
    let any = false;
    for (let i = 0; i < pool.n; i++) {
      const l = VV[i * 4 + 3]!;
      if (l <= 0) continue;
      VV[i * 4 + 3] = l - dt;
      pool.x[i] = pool.x[i]! + VV[i * 4]! * dt;
      pool.y[i] = pool.y[i]! + VV[i * 4 + 1]! * dt;
      pool.z[i] = pool.z[i]! + VV[i * 4 + 2]! * dt;
      pool.r[i] = pool.r[i]! + grow * dt;
      pool.a[i] = l - dt > 0 ? 0.8 * Math.min(1, (l - dt) / life) : 0;
      any = true;
    }
    return any;
  }
  let foamK = 0;
  function stepFx(dt: number) {
    const sp = tw.boat(B);
    if (sp > 0.05) {
      foamK += sp * 40 * dt;
      while (foamK >= 1) {
        foamK -= 1;
        const c = Math.cos(B[2]!), s = -Math.sin(B[2]!), side = foamK * 10 % 2 < 1 ? 1 : -1;
        puff(foam, FV, 60, B[0]! - c * 1.0 + s * 0.3 * side, WY + 0.02, B[1]! - s * 1.0 - c * 0.3 * side, -s * side * 0.5, 0, c * side * 0.5, 1.6, 0.1);
      }
    }
    const tsp = tw.truck(B);
    if (tsp > 0.1 && engine.time % 0.2 < dt) puff(smoke, SMV, 40, B[0]! - Math.cos(B[2]!) * 1.6, LY + 0.3, B[1]! + Math.sin(B[2]!) * 1.6, 0, 0.5, 0, 1, 0.08);
    let any = stepPool(foam, FV, dt, 0.25, 1.6);
    if (stepPool(smoke, SMV, dt, 0.35, 1.4)) any = true;
    return any;
  }
  function splash(x: number, z: number) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      puff(foam, FV, 60, x, WY + 0.02, z, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2, 1.1, 0.08);
    }
  }

  // ---- taps ----
  const NAME: Record<string, string> = { lighthouse: "the lighthouse", boat: "the boat", dinghy: "the dinghy", truck: "the truck", crates: "the crates", bench: "the bench", gull: "the gulls" };
  /** Poke a thing (tag) — what a tap or Enter does. Returns true when something happened. */
  function poke(tag: Tag | null, x = 0, z = 0) {
    alive();
    if (!tag) return false;
    const k = tag.k, i = tag.i, s = tw.spot();
    const at = (spot: number) => (tw.H[2]! < 0 && s === spot ? tw.look(spot) : false);
    if (k === "cat") tw.look(s);
    else if (k === "lamp") tw.toggleLamp(i);
    else if (k === "build") {
      if (i === 4 && at(1)) {} else if (tw.night) tw.toggleWindow(i);
      else {
        const r = builds[i]!;
        for (let n = 0; n < 6; n++) puff(smoke, SMV, 40, r.pos[0]! + (i % 2 ? -0.6 : 0.6), LY + 2.6, r.pos[2]! - 0.4, 0.1 + n * 0.02, 0.6 + n * 0.08, 0, 1.4, 0.1 + n * 0.02);
        tw.toggleWindow(i);
      }
    } else if (k === "lighthouse") at(4) || tw.start(BEAM);
    else if (k === "boat") tw.start(BOAT);
    else if (k === "dinghy") at(2) || (splash(dinghy.pos[0]!, dinghy.pos[2]!), tw.look(2));
    else if (k === "truck") tw.start(TRUCK);
    else if (k === "gull") tw.start(GULLS);
    else if (k === "crates") at(0) || ((wobble[8] = 1), tw.look(0));
    else if (k === "bench") at(3) || ((wobble[9] = 1), tw.look(3));
    else if (k === "tree") wobble[i] = 1;
    else if (k === "water") splash(x, z), engine.events.emit("splash");
    if (tw.n) events();
    dirty = true;
    return true;
  }
  function events() {
    for (let n = 0; n < tw.n; n++) {
      const type = tw.ev[n * 2]!, v = tw.ev[n * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit(["boat", "truck", "gulls", "beam"][v]!), v === BOAT && say("The boat casts off"), v === TRUCK && say("The truck sets off round the harbour");
      else if (type === E_LAMP || type === E_WINDOW) engine.events.emit(type === E_LAMP ? "lamp" : "window");
      else if (type === E_NIGHT) engine.events.emit(v ? "night" : "day"), (V[1] = 2), say(v ? "Dusk: the lamps come on" : "Morning");
      else if (type === E_FOUND) {
        engine.events.emit("found");
        const f = tw.H[0]!;
        toast(f >= SPOTS ? "MEOW! ALL FIVE" : `MEOW! ${f} OF ${SPOTS}`, "found");
        say(`Found the cat ${SPOT_NAMES[v]}: ${f} of ${SPOTS}`);
        for (let k = 0; k < 8; k++) puff(foam, FV, 60, cat.pos[0]!, cat.pos[1]! + 0.4, cat.pos[2]!, Math.cos(k) * 1.4, 1.6, Math.sin(k) * 1.4, 0.7, 0.07);
      } else if (type === E_MISS) engine.events.emit("miss"), toast("NOT HERE…", "miss");
      else if (type === E_HUNT) {
        engine.events.emit("hide");
        if (v >= SPOTS) (card.hidden = false), again.focus({ preventScroll: true });
      } else if (type === E_END && v === BOAT) say("The boat is back at the pier");
    }
    tw.clear();
    paintLights();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "ph-toast ph-" + kind;
    toastEl.hidden = false;
    toastT = 1.5;
  }
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    catN.textContent = `CAT ${tw.H[0]}/${SPOTS}`;
    nightK!.textContent = tw.night ? "☀ DAY" : "☾ NIGHT";
    nightK!.setAttribute("aria-pressed", "" + tw.night);
    hud.classList.toggle("ph-night", tw.night);
  }

  // ---- drawing extras ----
  function paintRoad(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? P.line : P.road;
      if (pass) ctx.setLineDash([6, 8]);
      for (let k = 0; k < 64; k++) {
        ROAD_LOOP.at(k / 64, tmp3);
        const x0 = tmp3[0]!, z0 = tmp3[1]!;
        ROAD_LOOP.at((k + 1) / 64, tmp3);
        if (!dio.project(x0, LY + 0.02, z0, tmp) || !dio.project(tmp3[0]!, LY + 0.02, tmp3[1]!, tmp2)) continue;
        ctx.lineWidth = pass ? Math.max(1, (f * 0.07) / tmp[2]!) : (f * 1.3) / tmp[2]!;
        ctx.beginPath();
        ctx.moveTo(tmp[0]!, tmp[1]!);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  function paintSea(ctx: CanvasRenderingContext2D) {
    // Short ripple strokes on the surface; they drift while the scene is alive.
    ctx.strokeStyle = P.ripple;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = RIP[i * 3]! + Math.sin(wave * 0.6 + RIP[i * 3 + 2]!) * 0.4, z = RIP[i * 3 + 1]!, w = 0.5 + 0.25 * Math.sin(wave + RIP[i * 3 + 2]!);
      if (x > LH.x - 2.2 && x < LH.x + 2.2 && Math.abs(z - LH.z) < 2) continue;
      if (!dio.project(x - w, WY + 0.01, z, tmp) || !dio.project(x + w, WY + 0.01, z, tmp2)) continue;
      ctx.moveTo(tmp[0]!, tmp[1]!);
      ctx.quadraticCurveTo((tmp[0]! + tmp2[0]!) / 2, (tmp[1]! + tmp2[1]!) / 2 - 2, tmp2[0]!, tmp2[1]!);
    }
    ctx.stroke();
  }
  function halo(ctx: CanvasRenderingContext2D, i: number) {
    if (!tw.lamp[i] || !P.night) return;
    const l = lanterns[i];
    if (!l || !dio.project(l.M[9]!, l.M[10]! + 0.12, l.M[11]!, tmp)) return;
    const r = (dio.focal() * 0.6) / tmp[2]!;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.halo;
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, r * k * 0.5, 0, TAU);
      ctx.fill();
    }
    // Its pool of light on the quay.
    if (dio.project(l.M[9]!, LY + 0.03, l.M[11]!, tmp2)) {
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.ellipse(tmp2[0]!, tmp2[1]!, r * 1.6, r * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintBeam(ctx: CanvasRenderingContext2D) {
    tw.beam(B);
    const str = B[1]!;
    if (str <= 0.01) return;
    const cx = LH.x, cy = LH.y + 4.05 * LH.s, cz = LH.z;
    ctx.globalCompositeOperation = P.night ? "lighter" : "source-over";
    ctx.fillStyle = P.beam;
    for (let k = 0; k < 2; k++) {
      const a = B[0]! + k * Math.PI, c = Math.cos(a), s = Math.sin(a), len = 11, w = 1.5;
      if (!dio.project(cx, cy, cz, tmp)) return;
      ctx.beginPath();
      ctx.moveTo(tmp[0]!, tmp[1]!);
      if (!dio.project(cx + c * len - s * w, cy - 1.4, cz + s * len + c * w, tmp2)) continue;
      ctx.lineTo(tmp2[0]!, tmp2[1]!);
      if (!dio.project(cx + c * len + s * w, cy - 1.4, cz + s * len - c * w, tmp2)) continue;
      ctx.lineTo(tmp2[0]!, tmp2[1]!);
      ctx.closePath();
      ctx.globalAlpha = str * (P.night ? 0.3 : 0.16);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  // The keyboard's cursor: a ring and a name sticker over the thing it is on.
  const TARGETS: [string, string, number][] = [["lamp", "LAMP", 0], ["lamp", "LAMP", 1], ["crates", "CRATES", 0], ["lamp", "LAMP", 2], ["truck", "TRUCK", 0], ["build", "SHOP", 0], ["build", "HOUSE", 1], ["build", "HOUSE", 2], ["dinghy", "DINGHY", 0], ["boat", "BOAT", 0], ["build", "SHOP", 3], ["lamp", "LAMP", 3], ["bench", "BENCH", 0], ["build", "HOUSE", 4], ["gull", "GULLS", 0], ["lamp", "LAMP", 4], ["build", "HOUSE", 5], ["lamp", "LAMP", 5], ["lighthouse", "LIGHTHOUSE", 0]];
  function targetObj(n: number): DioramaObject {
    const [k, , i] = TARGETS[n]!;
    return k === "lamp" ? lamps[i]! : k === "build" ? builds[i]! : k === "gull" ? gulls[0]! : k === "boat" ? boat : k === "dinghy" ? dinghy : k === "truck" ? lorry : k === "crates" ? crateR : k === "bench" ? benchR : lhouse;
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (!kbd || cursor < 0) return;
    const o = targetObj(cursor), h = o === lhouse ? 4.6 : o === boat ? 1.8 : o.size[1]! || 1;
    if (!dio.project(o.M[9]!, o.M[10]! + h + 0.4, o.M[11]!, tmp)) return;
    const x = tmp[0]!, y = tmp[1]!, label = TARGETS[cursor]![1];
    ctx.font = "800 12px ui-rounded, system-ui, sans-serif";
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = "#1f2433";
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 3, y - 26 + 3, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 26, w, 22, 6);
    ctx.moveTo(x - 5, y - 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 5, y - 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f2433";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y - 15);
  }

  // ---- camera ----
  function frame() {
    const W = dio.width, H = dio.height, c = dio.cam, tall = H / W > 0.75;
    c.yaw = HOME.yaw; c.pitch = tall ? 0.95 : HOME.pitch; c.tx = 0; c.ty = 1; c.tz = 0;
    dio.fit(c, [-PX, -1.1, -PZ, PX, -1.1, -PZ, -PX, -1.1, PZ, PX, -1.1, PZ, -PX, 3.4, -PZ, PX, 3.4, -PZ, LH.x, 5.6, LH.z], { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
  }

  // ---- the loop ----
  engine.add({
    read() {
      if (V[1]) {
        // The site's theme sets day or night; the key flips it (V[1] = 2: rebuild only).
        if (V[1] === 1 && themeNight() !== tw.night) tw.setNight(themeNight()), tw.n && events();
        V[1] = 0;
        const next = tw.night ? NIGHT : DAY;
        if (next !== P) (P = next), build(), (hudDirty = dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), bar = stage.querySelector(".gk-bar")?.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = Math.max(8, hr.bottom - sr.top + 6);
        V[4] = bar && bar.top > sr.top + sr.height / 2 ? sr.bottom - bar.top + 6 : 8;
        frame();
        dirty = hudDirty = true;
      }
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y);
      }
    },
    step(e, dt) {
      let moving = tw.step(dt);
      if (tw.n) events();
      if (stepFx(dt)) moving = true;
      for (let k = 0; k < wobble.length; k++) if (wobble[k]! > 0) (wobble[k] = Math.max(0, wobble[k]! - dt * 1.4)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (e.time < aliveT) (wave += dt), (moving = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose();
      dio.draw();
      V[5] = 1;
    },
  });

  // ---- input: tap pokes, drag turns the table, arrows walk the cursor, Enter pokes ----
  let downX = 0, downY = 0, dragging = false, pid = -1, lx = 0, ly = 0;
  function tap(x: number, y: number) {
    kbd = false;
    const ob = dio.root(dio.pick(x, y)), tag = (ob?.tag ?? null) as Tag | null;
    let wx = 0, wz = 0;
    if (tag?.k === "water" && dio.ground(x, y, WY, hit3)) (wx = hit3[0]!), (wz = hit3[2]!);
    poke(tag, wx, wz);
  }
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (pid >= 0) return;
    play.setPointerCapture(e.pointerId);
    pid = e.pointerId;
    downX = lx = e.offsetX; downY = ly = e.offsetY;
    dragging = false;
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    const x = e.offsetX, y = e.offsetY;
    if (!dragging && Math.hypot(x - downX, y - downY) > 7) (dragging = true), play.classList.add("ph-drag");
    if (dragging) {
      const c = dio.cam;
      c.yaw -= (x - lx) * 0.006;
      c.pitch += (y - ly) * 0.005;
      dio.clamp(limits);
      dirty = true;
      alive();
    }
    lx = x; ly = y;
  }, sig);
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    play.classList.remove("ph-drag");
    if (!dragging && e.type === "pointerup") tap(e.offsetX, e.offsetY);
    dragging = false;
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "n") return void (e.preventDefault(), alive(), setNight(!tw.night));
    const mv = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (mv) {
      e.preventDefault();
      kbd = true;
      cursor = cursor < 0 ? (mv > 0 ? 0 : TARGETS.length - 1) : (cursor + mv + TARGETS.length) % TARGETS.length;
      dirty = true;
      alive();
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey && cursor >= 0) {
      e.preventDefault();
      kbd = true;
      const [kk, , i] = TARGETS[cursor]!;
      poke({ k: kk, i });
    }
  }, sig);
  again.addEventListener("click", () => {
    tw.reset(((engine.random() * 1e6) | 0) + 1);
    card.hidden = true;
    hudDirty = dirty = true;
    alive();
    play.focus({ preventScroll: true });
  }, sig);

  // The poster (scripts/gallery-posters.mjs): dusk, lamps lit, the beam turning, the boat heading out.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    tw.reset(20261111);
    tw.lamp.fill(1);
    tw.win[1] = tw.win[4] = tw.win[5] = 1;
    tw.start(BOAT);
    tw.start(BEAM);
    tw.start(GULLS);
    tw.clear();
    paintLights();
    alive();
  }

  build();
  engine.start();
  return {
    engine,
    accessible: true,
    get town() {
      return tw;
    },
    get state() {
      return { night: tw.night, found: tw.H[0]!, spot: tw.spot(), busy: tw.idle() ? 0 : 1, cursor: cursor >= 0 ? TARGETS[cursor]![1] + TARGETS[cursor]![2] : "", card: !card.hidden };
    },
    screen(name: string) {
      const o = name === "cat" ? cat : name === "boat" ? boat : name === "truck" ? lorry : name === "lighthouse" ? lhouse : name === "dinghy" ? dinghy : name === "crates" ? crateR : name === "bench" ? benchR : name.startsWith("lamp") ? lamps[+name.slice(4)]! : name.startsWith("build") ? builds[+name.slice(5)]! : gulls[0]!;
      const up = name === "lighthouse" ? 2.4 : name === "cat" ? 0.18 : name.startsWith("lamp") ? 1.9 : name.startsWith("build") ? 1.0 : 0.4;
      dio.project(o.M[9]!, o.M[10]! + up, o.M[11]!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: dusk at the harbour, the boat on its way out (scripts/gallery-posters.mjs). */
export const posterAt = 2.6;
