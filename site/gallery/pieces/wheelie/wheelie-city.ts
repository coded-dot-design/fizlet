// "Wheelie City" (hero, Hi-Fi): electric bikes on a tabletop neighbourhood. A city block sits on a
// plinth: a ring of streets with a cross street, houses with lawns and driveways, an apartment
// building and a corner store, parked cars, two crosswalks, a speed bump, a plywood kicker, trees and
// streetlights; at night (dark) the curbs glow cyan and the windows warm, by day (light) a pastel
// suburb. Pick a ride in the garage (VOLT the e-bike, JOLT the electric dirt bike, STUBBY the fat-tyre
// mini), then one minute from the first touch of the gas: lift the front with the gas, balance it
// with your weight (stick or W/S: lean forward and back), save it with the brake, and score
// wheelies and manuals (distance, time, and the time held at the balance point) and hops. A trick
// across a crosswalk, through a sprinkler or past a neighbour who came out to shake a fist pays a
// bonus. Loop it out and it is a crash: the trick and the combo are gone.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), the Bikes series' shared bike (../bikes/bike.ts,
// through ./ride.ts), @fzlt/core/drive (its `chase` camera), @fzlt/core/input + @fzlt/core/pad (keys, the
// touch stick and keys), @fzlt/core/slot, @fzlt/core/sound. The block and the session are ./city.ts,
// the scorer ./tricks.ts, both headless (tests/wheelie-city.test.mjs); this file is the scene
// (tests/wheelie-city.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { chase } from "../../../../src/drive";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import {
  BLOCKS, BUMP, CARS, CAR_L, CAR_W, CROSS, DOG, DONE, DRIVES, E_AIR, E_BARK, E_BONUS, E_CRASH, E_END, E_GRUMP, E_HOP, E_RESPAWN, E_SPLASH, E_START, E_TRICK,
  FENCE, HOUSES, HX, HZ, KICK, LAMPS, LINES, NCARS, NEIGH, NH, NN, NSP, READY, RIDES, ROADS, RUN, CRASH, SESSION, SPRINK, SP_REACH, TREES, CURB, E_BONK, cityRun,
} from "./city";
import { LOOP, ENDO, CASE, BAIL } from "../bikes/bike";
import { SC, CB, ON, DIST, TIME, SWEET, PTS, KIND, BEST_W, BEST_WS, BEST_M, HOPS, TOP, MANUAL, HOP, F_CROSS, F_SPRINK, F_GRUMP } from "./tricks";

const TAU = 6.283185307179586;
// Palettes by role: a neon night (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.4, 1, 0.5], amb: 0.5,
  sky0: "#06051a", sky1: "#1c0f3e", sky2: "#3b1660", star: "#cfd8ff", moon: "#e9e4ff",
  table: "#0c0b1a", plinth: "#15132a", rim: "#22e6ff", road: "#1a1930", walk: "#2b2848", lawn: "#18373a", drive: "#2f2b4c", curb: "#22e6ff", dash: "#ffd166", zebra: "#d8dcff", bump: "#ffd166", ply: "#8a6a4a",
  walls: ["#3b3466", "#2c3f6a", "#43305e", "#2a4058", "#2b2950", "#33284a"], roofs: ["#1e1a36", "#241c3c", "#1b2340", "#2a1838", "#191830", "#2b1a3a"], trim: "#ff4fa8",
  win: "#ffd27a", win2: "#7cf6ff", door: "#141226", garage: "#272444", awning: ["#ff4fa8", "#22e6ff"], sign: "#ff4fa8",
  trunk: "#2a2033", leaf: ["#1d5148", "#21604f", "#174039"], pole: "#3a3658", lampOn: "#fff1c2", glow: "#ffcf7a",
  cars: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff"], glass: "#0d1022", tyre: "#0e0e16", hub: "#8d92b4", tail: "#ff2e55", head: "#fff7d6",
  frame: ["#e8ecff", "#ff4fa8", "#ffd166"], accent: "#22e6ff", seat: "#141420", fork: "#9aa0c4",
  jacket: "#22e6ff", pants: "#2a2a3e", shoe: "#f4f1ff", helmet: "#ff4fa8", visor: "#0a0c16", skin: ["#f1c7a5", "#c98e67", "#8d5a3b", "#e8b48f"],
  robes: ["#9d7bff", "#ff8fb8", "#6fd3ff", "#ffd166", "#7ee0a8", "#ff9e6b", "#c0c6ff"], hair: ["#e7e7ef", "#3a2a22", "#8a8a96", "#c06a3a"],
  dog: "#c98e5a", dog2: "#6b4a2e", water: "#8fe8ff", dust: "#8a84b8", spark: "#ffd166", smoke: "#c9c4e8", shadow: "#000000",
  ink: "#0b0a14", paper: "#f6f3ff", good: "#22e6ff", warn: "#ffd166", bad: "#ff4f5e", line: "#22e6ff",
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.58,
  sky0: "#bfe6ff", sky1: "#e4f4ff", sky2: "#fff3dc", star: "#ffffff", moon: "#fff6cc",
  table: "#c9a585", plinth: "#8a6448", rim: "#fff3dc", road: "#6b7088", walk: "#dcd6cc", lawn: "#8fd18a", drive: "#c8c0b4", curb: "#f4efe6", dash: "#fff3b0", zebra: "#ffffff", bump: "#ffd166", ply: "#d9a86c",
  walls: ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#e9d8ff", "#ffe5b4"], roofs: ["#e76f51", "#577590", "#b5838d", "#6a994e", "#7d6b9e", "#d1495b"], trim: "#ffffff",
  win: "#e8f6ff", win2: "#d7f3ff", door: "#6d4c41", garage: "#f1ece4", awning: ["#ef476f", "#ffffff"], sign: "#ef476f",
  trunk: "#8d6748", leaf: ["#52b788", "#74c69d", "#40916c"], pole: "#7b8094", lampOn: "#fff6cc", glow: "#fff6cc",
  cars: ["#ef476f", "#118ab2", "#ffd166", "#8e7dbe"], glass: "#cfe8ff", tyre: "#26262e", hub: "#d9dbe6", tail: "#e63946", head: "#fffbe6",
  frame: ["#1c2a3c", "#ef476f", "#118ab2"], accent: "#06d6a0", seat: "#26262e", fork: "#4a5468",
  jacket: "#118ab2", pants: "#33334a", shoe: "#ffffff", helmet: "#ef476f", visor: "#11131c",
  dog: "#c98e5a", dog2: "#6b4a2e", water: "#4cc9f0", dust: "#d9d2c3", spark: "#ffb703", smoke: "#ffffff", shadow: "#3a2a24",
  ink: "#1b1420", paper: "#ffffff", good: "#06a77d", warn: "#f4a261", bad: "#e63946", line: "#ffffff",
};
// FX pools: dust and tyre smoke, sparks, sprinkler water (per sprinkler DROPS), splashes.
const DUST = 70, SPARK = 40, DROPS = 18, WATER = NSP * DROPS, SPLASH = 40;
const T_CARD = 1;

export type WheelieScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; clock: number; score: number; combo: number; trick: boolean; nose: number; ride: string; garage: boolean; card: boolean; view: string; speed: number; crashes: number; grumps: number; best: number };
  /** Ride by itself (the poster, the tests). */
  auto: boolean;
  /** The run (the tests read it). */
  readonly run: ReturnType<typeof cityRun>;
  /** Pick a ride, 0..2 (the garage's keys). */
  pick(i: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): WheelieScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: the canvas, the play surface (pointer + keyboard focus), the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "wc-play";
  play.setAttribute("aria-label", "Wheelie City: Space or J for gas, K or Shift to brake, W and S (or up and down) lean forward and back, A and D (or left and right) steer, L hops. B opens the garage, R restarts, V changes the view, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "wc-hud";
  const rideKeys = RIDES.map((r, i) => `<button type="button" class="wc-ride" data-i="${i}" aria-label="${r.name}, ${r.kind.toLowerCase()}: ${r.blurb} (${i + 1})"><b>${r.name}</b><i>${r.kind}</i><span>${r.blurb}</span>${["POWER", "SPEED", "BALANCE"].map((s, k) => `<em>${s}<u style="--n:${r.bars[k]}"></u></em>`).join("")}<kbd>${i + 1}</kbd></button>`).join("");
  hud.innerHTML = `<div class="wc-head"><p class="wc-top"><b class="wc-chip wc-time"><span>1:00</span></b><b class="wc-chip wc-score"><span>0</span><i>×1</i></b><b class="wc-chip wc-trick" hidden><span></span></b></p><p class="wc-hint"></p></div><p class="wc-toast" hidden></p><p class="wc-live" aria-live="polite"></p><p class="wc-keys"><button type="button" class="wc-key wc-garage-k" aria-label="Garage: pick a ride (B)">RIDE</button><button type="button" class="wc-key wc-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="wc-key wc-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="wc-garage" role="dialog" aria-label="Pick a ride"><b>PICK A RIDE</b><div class="wc-rides">${rideKeys}</div><p>Gas lifts the front · lean back to hold it · brake saves it</p></div><div class="wc-card" role="dialog" aria-label="Session over" hidden><b>TIME!</b><p class="wc-t"></p><p class="wc-stats"></p><p class="wc-again-row"><button type="button" class="bui-key wc-again">RIDE AGAIN</button><button type="button" class="bui-key wc-change">CHANGE RIDE</button></p></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, garage = hud.children[4] as HTMLElement, card = hud.children[5] as HTMLElement;
  const timeEl = top.children[0]!.firstChild as HTMLElement, scoreEl = top.children[1]!.firstChild as HTMLElement, comboEl = top.children[1]!.lastChild as HTMLElement;
  const trickChip = top.children[2] as HTMLElement, trickEl = trickChip.firstChild as HTMLElement;
  const garageK = keysEl.children[0] as HTMLButtonElement, viewK = keysEl.children[1] as HTMLButtonElement, muteK = keysEl.children[2] as HTMLButtonElement;
  const rideBtns = [...garage.querySelectorAll<HTMLButtonElement>(".wc-ride")];
  const cardT = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement;
  const again = card.querySelector(".wc-again") as HTMLButtonElement, change = card.querySelector(".wc-change") as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "ready", trick: "power", hop: "click", crash: "boom", respawn: "ready", grump: "hurt", bark: "bark", splash: "splash", bonus: "click", end: "win" },
    notes: { bark: [[520, 300, 0.07, 0, "square", 0.08], [560, 320, 0.07, 0.11, "square", 0.07]], splash: [[1800, 700, 0.12, 0, "sine", 0.05]] },
    volume: 0.1,
  });
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], hop: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), HOPK = c.id("hop");
  const ICON_GAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>';
  const ICON_BRAKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
  const ICON_HOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 5 12h4v6h6v-6h4z" fill="currentColor"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "gas", label: "", icon: ICON_GAS, name: "Gas (Space or J)", key: "J", role: "go", hold: true },
      { intent: "brake", label: "", icon: ICON_BRAKE, name: "Brake (K)", key: "K", role: "attack", hold: true },
      { intent: "hop", label: "", icon: ICON_HOP, name: "Hop (L)", key: "L", role: "aim" },
    ],
    host: stage,
  });
  thePad.el.classList.add("wc-pad");
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the run and the diorama ----
  const run = cityRun(), bike = run.bike, S = run.S, sc = run.sc.S;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const bikes: DioramaObject[] = [], hubs: DioramaObject[][] = [], riders: DioramaObject[] = [], torsos: DioramaObject[] = [], tails: DioramaObject[] = [];
  let thrown: DioramaObject;
  const nbs: DioramaObject[] = [], arms: DioramaObject[] = [], sprHeads: DioramaObject[] = [];
  let dog: DioramaObject, dogTail: DioramaObject, dust: DioramaPoints, spark: DioramaPoints, water: DioramaPoints, splash: DioramaPoints;
  const DV = new Float64Array(DUST * 5), SV = new Float64Array(SPARK * 5), PV = new Float64Array(SPLASH * 5);
  const rnd = seeded(20261122);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS[i] = rnd();
  // Bubble text widths, measured when a bubble appears (never in a frame): per neighbour, the dog.
  const BW = new Float64Array(NN + 1);

  function buildScene() {
    dio.clear();
    bikes.length = hubs.length = riders.length = torsos.length = tails.length = nbs.length = arms.length = sprHeads.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("ground", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    const G = (size: number[], pos: number[], color: string, layer: number, emissive = false) => dio.add({ size, pos, color, cluster: "ground", layer, emissive, pick: false });
    G([HX * 2 + 7, 0.5, HZ * 2 + 6], [0, -1.55, 0.6], P.table, 0);
    G([HX * 2 + 0.5, 1.05, HZ * 2 + 0.5], [0, -1.05, 0], P.plinth, 1);
    G([HX * 2 + 0.7, 0.1, HZ * 2 + 0.7], [0, -0.16, 0], P.rim, 2, true);
    // The base (sidewalk height), the lawns of the blocks and the verge, the roads cut in, driveways.
    G([HX * 2, CURB, HZ * 2], [0, 0, 0], P.lawn, 3);
    for (let o = 0; o < BLOCKS.length; o += 4) {
      const x0 = BLOCKS[o]!, z0 = BLOCKS[o + 1]!, x1 = BLOCKS[o + 2]!, z1 = BLOCKS[o + 3]!;
      for (const [a, b, cc, d] of [[x0, z0, x1, z0 + 1], [x0, z1 - 1, x1, z1], [x0, z0, x0 + 1, z1], [x1 - 1, z0, x1, z1]]) G([cc! - a!, CURB + 0.01, d! - b!], [(a! + cc!) / 2, 0, (b! + d!) / 2], P.walk, 4);
    }
    // The outer sidewalks, along the ring's outside edges.
    G([36.4, CURB + 0.01, 1.2], [0, 0, -11.1], P.walk, 4); G([36.4, CURB + 0.01, 1.2], [0, 0, 11.1], P.walk, 4);
    G([1.2, CURB + 0.01, 21], [-17.6, 0, 0], P.walk, 4); G([1.2, CURB + 0.01, 21], [17.6, 0, 0], P.walk, 4);
    for (let o = 0; o < ROADS.length; o += 4) G([ROADS[o + 2]! - ROADS[o]!, 0.01, ROADS[o + 3]! - ROADS[o + 1]!], [(ROADS[o]! + ROADS[o + 2]!) / 2, -0.01, (ROADS[o + 1]! + ROADS[o + 3]!) / 2], P.road, 5);
    for (let o = 0; o < DRIVES.length; o += 4) G([DRIVES[o + 2]! - DRIVES[o]!, 0.03, DRIVES[o + 3]! - DRIVES[o + 1]!], [(DRIVES[o]! + DRIVES[o + 2]!) / 2, CURB, (DRIVES[o + 1]! + DRIVES[o + 3]!) / 2], P.drive, 6);
    // Road markings: dashes down the middle of each street, zebra crossings, the bump, the kicker.
    for (let x = -11; x <= 11; x += 2.2) if (Math.abs(x) > 2.6) for (const z of [-8.5, 8.5]) G([1, 0.01, 0.12], [x, 0.002, z], P.dash, 7, P.night);
    for (let z = -5; z <= 5; z += 2.2) for (const x of [-15, 15]) G([0.12, 0.01, 1], [x, 0.002, z], P.dash, 7, P.night);
    for (let o = 0; o < CROSS.length; o += 4) {
      const x0 = CROSS[o]!, z0 = CROSS[o + 1]!, x1 = CROSS[o + 2]!, z1 = CROSS[o + 3]!, along = x1 - x0 > z1 - z0;
      for (let k = 0; k < 6; k++) {
        const u = (k + 0.5) / 6;
        if (along) G([(x1 - x0) / 10, 0.01, z1 - z0], [x0 + (x1 - x0) * u, 0.003, (z0 + z1) / 2], P.zebra, 7);
        else G([x1 - x0, 0.01, (z1 - z0) / 10], [(x0 + x1) / 2, 0.003, z0 + (z1 - z0) * u], P.zebra, 7);
      }
    }
    dio.add({ size: [BUMP[1]! * 1.4, BUMP[2]!, 4], pos: [BUMP[0]!, 0, -8.5], color: P.bump, cluster: "ground", layer: 8, pick: false });
    dio.add({ shape: "wedge", size: [KICK[1]! - KICK[0]!, KICK[4]!, KICK[3]! - KICK[2]!], pos: [(KICK[2]! + KICK[3]!) / 2, 0, (KICK[0]! + KICK[1]!) / 2], rot: [0, Math.PI / 2, 0], color: P.ply, cluster: "ground", layer: 8, pick: false });
    dio.decal("ground", 9, paintLines);
    dio.decal("ground", 9.5, paintShadow);
    // Houses: walls, a roof (a prism ridge), windows, a door, a garage door; the flats and the store.
    for (let h = 0; h < NH; h++) {
      const o = h * 7, x = HOUSES[o]!, z = HOUSES[o + 1]!, w = HOUSES[o + 2]!, d = HOUSES[o + 3]!, ht = HOUSES[o + 4]!, f = HOUSES[o + 5]!, look = HOUSES[o + 6]!, id = "h" + h;
      const wall = P.walls[look]!, roof = P.roofs[look]!;
      dio.add({ id, size: [w, ht, d], pos: [x, CURB, z], color: wall, pick: false });
      const fz = (f * d) / 2 + f * 0.01, part = (size: number[], pos: number[], color: string, emissive = false) => dio.add({ size, pos, color, on: id, emissive, pick: false, layer: 6 });
      if (look < 4) {
        // A gable roof: two wedges back to back, the ridge along the street.
        for (const s2 of [-1, 1]) dio.add({ shape: "wedge", size: [d / 2 + 0.25, 0.85, w + 0.3], pos: [0, 0, s2 * (d / 4 + 0.06)], rot: [0, s2 < 0 ? Math.PI / 2 : -Math.PI / 2, 0], on: id, color: roof, pick: false, layer: 5 });
        part([0.56, 1.0, 0.04], [-0.5, -ht, fz], P.door);
        part([0.7, 0.5, 0.04], [0.7, -ht + 0.85, fz], P.win, P.night);
        part([0.5, 0.42, 0.04], [-0.5, -ht + 1.3, fz], P.win2, P.night);
        part([w + 0.02, 0.06, 0.04], [0, -0.06, fz], P.trim, P.night);
      } else if (look === 4) {
        // The flats: three floors of windows, a flat roof with a rim.
        part([w + 0.2, 0.14, d + 0.2], [0, 0, 0], P.roofs[4]!);
        for (let fl = 0; fl < 3; fl++) for (let k = 0; k < 4; k++) part([0.55, 0.6, 0.04], [-1.5 + k, -ht + 0.9 + fl * 1.15, fz], (fl + k) % 3 ? P.win : P.win2, P.night && (fl + k) % 4 !== 1);
        part([0.8, 0.8, 0.04], [0, -ht, fz], P.door);
      } else {
        // The corner store: a big window, a striped awning, a sign.
        part([w + 0.16, 0.12, d + 0.16], [0, 0, 0], P.roofs[5]!);
        part([2.0, 0.9, 0.04], [-0.5, -ht + 0.35, fz], P.win, P.night);
        part([0.6, 1.1, 0.04], [1.2, -ht, fz], P.door);
        for (let k = 0; k < 6; k++) dio.add({ size: [w / 6, 0.06, 0.8], pos: [-w / 2 + (k + 0.5) * (w / 6), -ht + 1.55, f * (d / 2 + 0.38)], rot: [f * -0.35, 0, 0], color: P.awning[k & 1]!, on: id, pick: false, layer: 7 });
        part([2.4, 0.42, 0.06], [0, -0.42, fz + f * 0.02], P.sign, true);
        dio.decal(id, 9, paintSign);
      }
    }
    // Parked cars: body, cabin, glass, wheels, lights.
    for (let k = 0; k < NCARS; k++) {
      const o = k * 4, id = "car" + k, col = P.cars[CARS[o + 3]!]!;
      dio.add({ id, shape: "group", size: [CAR_L, 0, CAR_W], pos: [CARS[o]!, Math.abs(CARS[o + 1]!) < 6.5 && Math.abs(CARS[o]!) < 13 ? CURB : 0, CARS[o + 1]!], rot: [0, CARS[o + 2]!, 0], pick: false });
      const p = (size: number[], pos: number[], color: string, o2: { shape?: "box" | "wedge" | "cyl"; rot?: number[]; emissive?: boolean; sides?: number } = {}) => dio.add({ shape: o2.shape || "box", size, pos, rot: o2.rot, sides: o2.sides, on: id, color, emissive: o2.emissive, pick: false });
      p([CAR_L, 0.42, CAR_W], [0, 0.16, 0], col);
      p([CAR_L * 0.5, 0.36, CAR_W * 0.86], [-0.15, 0.58, 0], col);
      p([CAR_L * 0.5 + 0.02, 0.24, CAR_W * 0.88], [-0.15, 0.64, 0], P.glass);
      for (const wx of [-0.72, 0.72]) for (const wz of [-0.48, 0.48]) p([0.4, 0.16, 0.4], [wx, 0.2, wz], P.tyre, { shape: "cyl", sides: 10, rot: [Math.PI / 2, 0, 0] });
      for (const wz of [-0.35, 0.35]) p([0.04, 0.1, 0.2], [CAR_L / 2, 0.42, wz], P.head, { emissive: true }), p([0.04, 0.1, 0.2], [-CAR_L / 2, 0.42, wz], P.tail, { emissive: true });
    }
    // Trees and streetlights.
    for (let k = 0; k < TREES.length; k += 2) {
      const id = "t" + k, s = 0.85 + ((k * 7) % 5) * 0.08;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.24, 0.7 * s, 0.24], pos: [TREES[k]!, CURB, TREES[k + 1]!], color: P.trunk, pick: false });
      dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.5 * s, 1.5 * s, 1.5 * s], pos: [0, -0.05, 0], on: id, color: P.leaf[k % 3]!, pick: false });
      dio.add({ shape: "cyl", sides: 7, top: 0, size: [1.1 * s, 1.1 * s, 1.1 * s], pos: [0, -0.6 * s, 0], on: id, color: P.leaf[(k + 1) % 3]!, pick: false });
    }
    for (let k = 0; k < LAMPS.length; k += 2) {
      const id = "l" + k;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.12, 2.6, 0.12], pos: [LAMPS[k]!, CURB, LAMPS[k + 1]!], color: P.pole, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.36, 0.14, 0.36], pos: [0, 0, 0], on: id, color: P.lampOn, emissive: true, pick: false });
    }
    dio.decal("ground", 9.2, paintPools);
    // The dog's fence and the dog.
    const fh = 0.5, fx0 = FENCE[0]!, fz0 = FENCE[1]!, fx1 = FENCE[2]!, fz1 = FENCE[3]!;
    for (let x = fx0; x <= fx1 + 0.01; x += 0.4) dio.add({ size: [0.08, fh, 0.08], pos: [x, CURB, fz1], color: P.paper, pick: false });
    for (let z = fz0 + 0.4; z < fz1; z += 0.4) for (const x of [fx0, fx1]) dio.add({ size: [0.08, fh, 0.08], pos: [x, CURB, z], color: P.paper, pick: false });
    dio.add({ size: [fx1 - fx0, 0.06, 0.06], pos: [(fx0 + fx1) / 2, CURB + fh - 0.12, fz1], color: P.paper, pick: false });
    dog = dio.add({ id: "dog", shape: "group", size: [0.6, 0, 0.3], pos: [run.DG[0]!, CURB, DOG[2]!], pick: false });
    dio.add({ size: [0.56, 0.26, 0.26], pos: [0, 0.18, 0], on: "dog", color: P.dog, pick: false });
    for (const lx of [-0.2, 0.2]) for (const lz of [-0.09, 0.09]) dio.add({ size: [0.07, 0.2, 0.07], pos: [lx, 0, lz], on: "dog", color: P.dog2, pick: false });
    dio.add({ size: [0.26, 0.24, 0.24], pos: [0.36, 0.3, 0], on: "dog", color: P.dog, pick: false });
    dio.add({ size: [0.12, 0.1, 0.16], pos: [0.52, 0.34, 0], on: "dog", color: P.dog2, pick: false });
    for (const ez of [-0.09, 0.09]) dio.add({ size: [0.06, 0.12, 0.08], pos: [0.32, 0.54, ez], on: "dog", color: P.dog2, pick: false });
    dogTail = dio.add({ size: [0.24, 0.06, 0.06], pos: [-0.36, 0.38, 0], rot: [0, 0, 0.7], on: "dog", color: P.dog2, pick: false });
    // Sprinkler heads.
    for (let i = 0; i < NSP; i++) sprHeads.push(dio.add({ shape: "cyl", sides: 6, size: [0.16, 0.14, 0.16], pos: [SPRINK[i * 4]!, CURB, SPRINK[i * 4 + 1]!], color: P.hub, pick: false }));
    // Neighbours: a body, legs, a head (hair or a hat), one arm up with a fist that shakes.
    for (let i = 0; i < NN; i++) {
      const id = "nb" + i, look = i % 7;
      const nb = dio.add({ id, shape: "group", size: [0.4, 0, 0.3], pos: [NEIGH[i * 8 + 1]!, CURB, NEIGH[i * 8 + 2]!], rot: [0, NEIGH[i * 8 + 3]! < 0 ? Math.PI / 2 : -Math.PI / 2, 0], alpha: 0, pick: false });
      const pp = (size: number[], pos: number[], color: string, on = id, rot?: number[]) => dio.add({ size, pos, rot, on, color, pick: false });
      if (NEIGH[i * 8]! !== 4) pp([0.16, 0.42, 0.26], [0, 0, 0], P.pants);
      pp([0.24, 0.5, 0.36], [0, 0.42, 0], P.robes[look]!);
      pp([0.22, 0.24, 0.22], [0, 0.92, 0], P.skin[look % 4]!);
      if (look % 3 === 0) pp([0.4, 0.04, 0.4], [0, 1.16, 0], P.awning[1]!), pp([0.22, 0.1, 0.22], [0, 1.18, 0], P.awning[1]!);
      else pp([0.24, 0.08, 0.24], [0, 1.16, 0], P.hair[look % 4]!);
      pp([0.04, 0.05, 0.16], [0.11, 1.04, 0], P.ink);
      const arm = dio.add({ id: id + "a", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.86, 0.2], on: id, pick: false });
      pp([0.09, 0.42, 0.09], [0, 0, 0], P.robes[look]!, id + "a");
      pp([0.13, 0.13, 0.13], [0, 0.42, 0], P.skin[look % 4]!, id + "a");
      pp([0.09, 0.36, 0.09], [0.0, 0.48, -0.2], P.robes[look]!, id, [0, 0, 0]);
      nbs.push(nb);
      arms.push(arm);
    }
    // The bikes (one shown: the ride picked), each with wheels on hubs and the rider.
    for (let r = 0; r < 3; r++) {
      const id = "bike" + r, b = dio.add({ id, shape: "group", size: [1.6, 0, 0.5], alpha: r === S[2] ? 1 : 0, tag: { bike: 1 } });
      const bp = (size: number[], pos: number[], color: string, o: { shape?: "box" | "wedge" | "cyl"; rot?: number[]; emissive?: boolean; sides?: number; top?: number } = {}) =>
        dio.add({ shape: o.shape || "box", size, pos, rot: o.rot, sides: o.sides, top: o.top, on: id, color, emissive: o.emissive, pick: false });
      const fr = P.frame[r]!;
      if (r === 0) {
        // VOLT: an e-bike: a light frame, a battery on the down tube, a rack.
        bp([0.66, 0.06, 0.06], [0.12, 0.2, 0], fr, { rot: [0, 0, -0.08] });
        bp([0.62, 0.13, 0.12], [0.16, -0.12, 0], fr, { rot: [0, 0, 0.62] });
        bp([0.5, 0.09, 0.11], [0.12, -0.1, 0], P.accent, { rot: [0, 0, 0.62], emissive: P.night });
        bp([0.07, 0.48, 0.07], [-0.2, -0.2, 0], fr, { rot: [0, 0, 0.3] });
        bp([0.62, 0.05, 0.05], [-0.32, -0.3, 0.07], fr, { rot: [0, 0, 0.1] });
        bp([0.07, 0.62, 0.07], [0.52, -0.42, 0], P.fork, { rot: [0, 0, -0.32] });
        bp([0.3, 0.06, 0.14], [-0.24, 0.27, 0], P.seat);
        bp([0.06, 0.06, 0.62], [0.44, 0.38, 0], P.seat);
        bp([0.12, 0.12, 0.08], [0.0, -0.32, 0.12], P.hub, { shape: "cyl", sides: 8, rot: [Math.PI / 2, 0, 0] });
      } else if (r === 1) {
        // JOLT: an electric dirt bike: a tall seat and tank, a glowing battery block, plates, fenders.
        bp([0.86, 0.16, 0.28], [-0.08, 0.12, 0], fr);
        bp([0.44, 0.3, 0.26], [0.06, -0.18, 0], P.seat);
        bp([0.42, 0.05, 0.27], [0.06, -0.02, 0], P.accent, { emissive: P.night });
        bp([0.12, 0.3, 0.32], [0.5, 0.2, 0], fr, { rot: [0, 0, -0.3] });
        bp([0.44, 0.04, 0.18], [0.62, 0.04, 0], fr, { rot: [0, 0, -0.1] });
        bp([0.5, 0.05, 0.2], [-0.62, 0.18, 0], fr, { rot: [0, 0, 0.4] });
        bp([0.07, 0.66, 0.07], [0.55, -0.4, 0.1], P.fork, { rot: [0, 0, -0.3] });
        bp([0.07, 0.66, 0.07], [0.55, -0.4, -0.1], P.fork, { rot: [0, 0, -0.3] });
        bp([0.6, 0.06, 0.06], [-0.32, -0.28, 0.09], P.fork, { rot: [0, 0, 0.12] });
        bp([0.06, 0.06, 0.66], [0.44, 0.42, 0], P.seat);
      } else {
        // STUBBY: a fat-tyre mini: a chunky low body, a long seat, tall bars.
        bp([0.86, 0.26, 0.4], [-0.02, -0.12, 0], fr);
        bp([0.86, 0.05, 0.41], [-0.02, -0.02, 0], P.accent, { emissive: P.night });
        bp([0.56, 0.1, 0.34], [-0.14, 0.14, 0], P.seat);
        bp([0.08, 0.56, 0.08], [0.48, -0.1, 0], P.fork, { rot: [0, 0, -0.2] });
        bp([0.06, 0.06, 0.7], [0.5, 0.36, 0], P.seat);
        bp([0.3, 0.16, 0.36], [0.38, 0.02, 0], fr, { rot: [0, 0, -0.2] });
      }
      tails.push(bp([0.04, 0.07, 0.14], [-0.66, 0.08, 0], P.tail, { emissive: true }));
      bp([0.04, 0.08, 0.14], [0.6, 0.3, 0], P.head, { emissive: true });
      const hs: DioramaObject[] = [];
      for (let i = 0; i < 2; i++) {
        const hub = dio.add({ id: id + "w" + i, shape: "group", size: [0.6, 0, 0.6], on: id, pick: false });
        const rr = RIDES[r]!.shape.radius!, wide = r === 2 ? 0.3 : r === 1 ? 0.16 : 0.09;
        dio.add({ shape: "cyl", sides: 14, size: [rr * 2, wide, rr * 2], pos: [0, 0, -wide / 2], rot: [Math.PI / 2, 0, 0], on: id + "w" + i, color: P.tyre, pick: false });
        dio.add({ shape: "cyl", sides: 8, size: [rr * (r === 0 ? 1.5 : 1.1), 0.02, rr * (r === 0 ? 1.5 : 1.1)], pos: [0, 0, wide / 2 + 0.005], rot: [Math.PI / 2, 0, 0], on: id + "w" + i, color: P.hub, pick: false });
        dio.add({ size: [rr * 1.5, 0.05, 0.03], pos: [0, -0.025, wide / 2 + 0.02], on: id + "w" + i, color: P.night ? P.accent : P.tyre, emissive: P.night, pick: false });
        hs.push(hub);
      }
      // The rider: legs to the pegs, a torso that leans with the weight shift, arms to the bars, a helmet.
      const rid = id + "r", rider = dio.add({ id: rid, shape: "group", size: [0.3, 0, 0.3], pos: [-0.12, 0.18, 0], on: id, pick: false });
      torsos.push(riderParts(rid));
      bikes.push(b);
      hubs.push(hs);
      riders.push(rider);
    }
    // The rider thrown clear in a crash (the bike's own rider hides).
    thrown = dio.add({ id: "thrown", shape: "group", size: [0.3, 0, 0.3], alpha: 0, pick: false });
    riderParts("thrown");
    dust = dio.points({ cap: DUST, color: P.smoke, layer: 4 });
    spark = dio.points({ cap: SPARK, color: P.spark, layer: 6 });
    water = dio.points({ cap: WATER, color: P.water, layer: 6 });
    splash = dio.points({ cap: SPLASH, color: P.water, layer: 6 });
    sky = null;
    pose();
  }
  /** A rider's parts on group `rid`; returns the torso (it leans). */
  function riderParts(rid: string) {
      for (const z of [-0.12, 0.12]) dio.add({ size: [0.36, 0.11, 0.11], pos: [0.08, -0.12, z], rot: [0, 0, -0.5], on: rid, color: P.pants, pick: false }), dio.add({ size: [0.1, 0.36, 0.1], pos: [0.18, -0.46, z], rot: [0, 0, 0.25], on: rid, color: P.pants, pick: false }), dio.add({ size: [0.2, 0.08, 0.12], pos: [0.24, -0.5, z], on: rid, color: P.shoe, pick: false });
      const tid = rid + "t", torso = dio.add({ id: tid, shape: "group", size: [0.2, 0, 0.3], pos: [0, 0, 0], on: rid, pick: false });
      dio.add({ size: [0.22, 0.5, 0.32], pos: [0, 0, 0], on: tid, color: P.jacket, pick: false });
      dio.add({ size: [0.23, 0.06, 0.33], pos: [0, 0.3, 0], on: tid, color: P.night ? P.accent : P.paper, emissive: P.night, pick: false });
      dio.add({ shape: "cyl", sides: 9, top: 0.8, size: [0.3, 0.3, 0.3], pos: [0.02, 0.52, 0], on: tid, color: P.helmet, pick: false });
      dio.add({ size: [0.06, 0.1, 0.22], pos: [0.16, 0.6, 0], on: tid, color: P.visor, pick: false });
      for (const z of [-0.16, 0.16]) dio.add({ size: [0.46, 0.09, 0.09], pos: [0.22, 0.34, z], rot: [0, 0, -0.45], on: tid, color: P.jacket, pick: false });
      return torso;
  }

  // ---- state ----
  const I = new Float64Array(5), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once, [6] gamepad on.
  const V = new Float64Array(7);
  V[0] = V[1] = 1;
  let view = 0, auto = false, dirty = true, hudDirty = true, shake = 0, toastT = 0, emitK = 0, crashT = 0, best = 0, barkT = 0, crashes = 0, spin = 0;
  const TT = new Float64Array(4), TF = new Uint8Array(4);
  const was = new Float64Array(8).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.86, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  const chaseO = { dist: 10.5, pitch: 0.6, lift: 0.8, ahead: 0.35, side: 0.8, rate: 3.4, turn: 2.4 };
  const CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: bike.vel };
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);
  function later(sec: number, what: number) {
    for (let k = 0; k < 4; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05));
  }

  function pose() {
    const r = S[2]!, b = bikes[r]!, d = bike.b, tum = d.crashed;
    // (A group has no faces of its own: alpha 0 hides its parts.)
    for (let k = 0; k < 3; k++) bikes[k]!.alpha = k === r ? 1 : 0;
    // The shared bike draws from its centre of mass (it tumbles on its own in a crash).
    b.pos.set(d.pos);
    b.rot.set(d.rot);
    const hs = hubs[r]!;
    for (let i = 0; i < 2; i++) {
      // Our hubs are front (0) then rear (1); the shared bike's wheels are rear (0) then front (1).
      const h = hs[i]!, j = 1 - i;
      h.pos[0] = i ? d.rear : d.front;
      h.pos[1] = -d.drop + d.comp[j]!;
      h.pos[2] = 0;
      h.rot[1] = i === 0 && !tum ? -d.steerAngle : 0;
      h.rot[2] = -d.spin[j]!;
    }
    // The rider's weight: forward and back with the lean (the shared bike's lean is + back), back in a wheelie.
    const rd = riders[r]!, ln = -d.lean, nose = bike.nose;
    rd.alpha = tum ? 0 : 1;
    rd.pos[0] = -0.12 + ln * 0.1;
    rd.rot[2] = -nose * 0.35;
    torsos[r]!.rot[2] = -0.45 - ln * 0.3 + nose * 0.25;
    thrown.alpha = tum ? 1 : 0;
    if (tum) (thrown.pos[0] = d.rider[0]!), (thrown.pos[1] = d.rider[1]! - 0.3), (thrown.pos[2] = d.rider[2]!), thrown.rot.set(d.riderRot);
    tails[r]!.color = P.tail;
    // The dog: along its fence; a hop when it barks.
    dog.pos[0] = run.DG[0]!;
    dog.pos[1] = CURB + (run.DG[2]! > 0 ? Math.abs(Math.sin(run.DG[2]! * 10)) * 0.12 : 0);
    dog.rot[1] = run.DG[0]! < d.pos[0]! - 0.3 ? 0 : run.DG[0]! > d.pos[0]! + 0.3 ? Math.PI : dog.rot[1]!;
    dogTail.rot[2] = 0.7 + Math.sin(engine.time * 16) * (S[0] === RUN ? 0.4 : 0);
    // Neighbours: out of the door, a fist shaken, back in.
    for (let i = 0; i < NN; i++) {
      const t = run.NB[i * 3]!, nb = nbs[i]!, f = NEIGH[i * 8 + 3]!, apt = NEIGH[i * 8]! === 4;
      nb.alpha = t > 0 ? 1 : 0;
      if (t <= 0) continue;
      const out = t > 2.25 ? (2.6 - t) / 0.35 : t < 0.35 ? t / 0.35 : 1, step = apt ? 0.12 : 0.75;
      nb.pos[2] = NEIGH[i * 8 + 2]! + f * out * step;
      nb.pos[1] = apt ? CURB + 1.65 : CURB;
      arms[i]!.rot[2] = -0.35 + Math.sin(t * 22) * 0.3;
    }
    // Sprinklers: the heads turn with the aim; the water is drawn from the run's clock.
    for (let i = 0; i < NSP; i++) sprHeads[i]!.rot[1] = run.sprinklerAim(i);
  }

  // ---- FX ----
  function puff(pool: DioramaPoints, VV: Float64Array, cap: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, a: number) {
    let j = pool.n < cap ? pool.n++ : -1;
    if (j < 0) {
      let lo = Infinity;
      for (let i = 0; i < cap; i++) if (VV[i * 5 + 3]! < lo) (lo = VV[i * 5 + 3]!), (j = i);
    }
    pool.x[j] = x; pool.y[j] = y; pool.z[j] = z; pool.r[j] = r; pool.a[j] = a;
    VV[j * 5] = vx; VV[j * 5 + 1] = vy; VV[j * 5 + 2] = vz; VV[j * 5 + 3] = life; VV[j * 5 + 4] = life;
  }
  function stepPool(pool: DioramaPoints, VV: Float64Array, dt: number, grav: number, grow: number, a0: number) {
    let live = 0;
    for (let i = 0; i < pool.n; i++) {
      const l = VV[i * 5 + 3]!;
      if (l <= 0) continue;
      const nl = l - dt;
      VV[i * 5 + 3] = nl;
      VV[i * 5 + 1] = VV[i * 5 + 1]! - grav * dt;
      pool.x[i] = pool.x[i]! + VV[i * 5]! * dt;
      pool.y[i] = Math.max(0.1, pool.y[i]! + VV[i * 5 + 1]! * dt);
      pool.z[i] = pool.z[i]! + VV[i * 5 + 2]! * dt;
      VV[i * 5] = VV[i * 5]! * (1 - 1.6 * dt);
      VV[i * 5 + 2] = VV[i * 5 + 2]! * (1 - 1.6 * dt);
      pool.r[i] = pool.r[i]! + grow * dt;
      pool.a[i] = nl > 0 ? a0 * (nl / VV[i * 5 + 4]!) : 0;
      if (nl > 0) live++;
    }
    return live > 0;
  }
  function burst(pool: DioramaPoints, VV: Float64Array, cap: number, x: number, y: number, z: number, n: number, sp: number, r: number) {
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, u = 0.4 + rnd();
      puff(pool, VV, cap, x, y, z, Math.cos(a) * sp * u, 2 + rnd() * sp, Math.sin(a) * sp * u, 0.45 + rnd() * 0.5, r, 1);
    }
  }
  function stepFx(dt: number) {
    const d = bike.b, v = bike.vel, ph = S[0]!;
    // Tyre smoke off the back wheel: on the gas in a wheelie, or spinning up from a stop.
    if (ph === RUN && !bike.air) {
      const k = d.throttle * (bike.nose > 0.1 ? 1 : Math.max(0, 1 - d.speed / 3)) + d.dust * 0.3, w = d.wheel;
      emitK += k * 28 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        puff(dust, DV, DUST, w[0]! + (rnd() - 0.5) * 0.2, w[1]! - 0.2, w[2]! + (rnd() - 0.5) * 0.2, -v[0]! * 0.2 + (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.5, -v[2]! * 0.2 + (rnd() - 0.5) * 0.6, 0.6 + rnd() * 0.4, 0.1, 0.45);
      }
    }
    // Sprinkler water: each head throws an arc of drops along its aim.
    const on = ph === RUN || ph === CRASH;
    water.n = on ? WATER : 0;
    if (on) {
      spin += dt;
      for (let i = 0; i < NSP; i++) {
        const a = run.sprinklerAim(i), ca = Math.cos(a), sa = Math.sin(a);
        for (let k = 0; k < DROPS; k++) {
          const u = ((k / DROPS + spin * 0.9) % 1), j = i * DROPS + k, rr = u * SP_REACH;
          water.x[j] = SPRINK[i * 4]! + ca * rr;
          water.z[j] = SPRINK[i * 4 + 1]! - sa * rr;
          water.y[j] = CURB + 0.15 + u * (1 - u) * 2.4;
          water.r[j] = 0.035 + u * 0.03;
          water.a[j] = 0.85 - u * 0.5;
        }
      }
    }
    let any = stepPool(dust, DV, dt, -0.3, 0.3, 0.45);
    if (stepPool(spark, SV, dt, 14, -0.05, 1)) any = true;
    if (stepPool(splash, PV, dt, 9, -0.02, 0.9)) any = true;
    return any || on;
  }

  // ---- events: stickers, sound, FX ----
  const TRICK = ["", "WHEELIE", "MANUAL", "HOP"];
  function events() {
    const d = bike.b;
    for (let k = 0; k < run.n; k++) {
      const type = run.ev[k * 2]!, val = run.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) setView(1), engine.events.emit("start"), toast("GO! ONE MINUTE", "go"), say("Go: one minute");
      else if (type === E_TRICK) {
        engine.events.emit("trick");
        const kind = sc[KIND]!, bonus = sc[16]!;
        toast(`${TRICK[kind]} ${sc[DIST]!.toFixed(1)} m · ${sc[TIME]!.toFixed(1)}s${sc[SWEET]! > 0.3 ? ` · SWEET ${sc[SWEET]!.toFixed(1)}s` : ""}${bonus ? " · BONUS" : ""} +${sc[PTS]!.toLocaleString("en-US")}${sc[CB]! > 0 ? ` ×${1 + sc[CB]!}` : ""}`, kind === MANUAL ? "clean" : "go");
        say(`${TRICK[kind]}, ${sc[PTS]} points`);
        void val;
      } else if (type === E_HOP) {
        engine.events.emit("hop");
        toast(`HOP +${sc[PTS]}${sc[CB]! > 0 ? ` ×${1 + sc[CB]!}` : ""}`, "meh");
        burst(dust, DV, DUST, d.pos[0]!, d.pos[1]! - 0.4, d.pos[2]!, 6, 1.4, 0.16);
      } else if (type === E_AIR) {
        // (nothing to call yet: the landing says it)
      } else if (type === E_CRASH) {
        engine.events.emit("crash");
        crashes++;
        crashT = 0;
        shake = 0.45;
        burst(spark, SV, SPARK, d.pos[0]!, d.pos[1]!, d.pos[2]!, 22, 4, 0.06);
        burst(dust, DV, DUST, d.pos[0]!, d.pos[1]! - 0.3, d.pos[2]!, 12, 2, 0.2);
        const what = val === LOOP ? "LOOPED OUT!" : val === ENDO ? "OVER THE BARS!" : val === CASE ? "CASED IT!" : val === BAIL ? "BAILED!" : "BOTTOMED OUT!";
        toast(what, "bad");
        say(what);
      } else if (type === E_BONK) {
        shake = 0.3;
        burst(spark, SV, SPARK, d.pos[0]!, d.pos[1]!, d.pos[2]!, 10, 3, 0.05);
        toast("BONK!", "bad");
        say("Bonk");
        engine.events.emit("crash");
      } else if (type === E_RESPAWN) {
        engine.events.emit("respawn");
      } else if (type === E_GRUMP) {
        engine.events.emit("grump");
        const ctx = canvas.getContext("2d")!;
        ctx.font = BFONT;
        BW[val] = ctx.measureText(LINES[run.NB[val * 3 + 2]!]!).width;
      } else if (type === E_BARK) {
        engine.events.emit("bark");
        barkT = 0.7;
        const ctx = canvas.getContext("2d")!;
        ctx.font = BFONT;
        BW[NN] = ctx.measureText("WOOF!").width;
      } else if (type === E_SPLASH) {
        engine.events.emit("splash");
        burst(splash, PV, SPLASH, d.pos[0]!, d.pos[1]! + 0.4, d.pos[2]!, 14, 2.2, 0.05);
      } else if (type === E_BONUS) {
        engine.events.emit("bonus");
        toast(val === F_CROSS ? "CROSSWALK WHEELIE!" : val === F_SPRINK ? "SPRINKLER RUN!" : "GRUMPY BONUS!", "meh");
        void F_GRUMP;
      } else if (type === E_END) {
        engine.events.emit("end");
        later(1.2, T_CARD);
        say("Time");
      }
    }
    run.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "wc-toast wc-" + kind;
    toastEl.hidden = false;
    toastT = 1.8;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const ph = S[0]!, secs = ph === READY ? SESSION : Math.ceil(S[1]!);
    if (was[0] !== secs) (was[0] = secs), (timeEl.textContent = `${(secs / 60) | 0}:${("" + (secs % 60)).padStart(2, "0")}`), timeEl.parentElement!.classList.toggle("wc-hot", secs <= 10 && ph !== READY);
    const s = sc[SC]!;
    if (was[1] !== s) (was[1] = s), (scoreEl.textContent = s.toLocaleString("en-US"));
    const cb = sc[CB]!;
    if (was[2] !== cb) (was[2] = cb), (comboEl.textContent = "×" + (1 + cb)), comboEl.classList.toggle("wc-hot", cb > 0);
    // The trick in progress: its distance, in tenths.
    const on = sc[ON] === 1 && ph === RUN, m = on ? Math.floor(sc[DIST]! * 10) : -1;
    if (was[3] !== m) {
      was[3] = m;
      trickChip.hidden = !on;
      if (on) trickEl.textContent = `${run.sc.S[6]! < sc[TIME]! * 0.3 ? "MANUAL" : "WHEELIE"} ${(m / 10).toFixed(1)} m`;
    }
    const g = !garage.hidden ? 1 : 0, rideN = S[2]!;
    if (was[4] !== ph * 10 + g + rideN * 100) {
      was[4] = ph * 10 + g + rideN * 100;
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY && !g ? (touch ? `${RIDES[rideN]!.name} · hold ⚡ to go · stick back to lean back` : `${RIDES[rideN]!.name} · Space gas · K brake · W/S lean · A/D steer · L hop`) : "";
    }
  }
  function showEnd() {
    const sNow = sc[SC]!, isBest = sNow > best;
    if (isBest) best = sNow;
    cardT.textContent = `${sNow.toLocaleString("en-US")} pts` + (isBest ? " · BEST" : ` · best ${best.toLocaleString("en-US")}`);
    cardS.textContent = `${RIDES[S[2]!]!.name} · longest wheelie ${sc[BEST_W]!.toFixed(1)} m (${sc[BEST_WS]!.toFixed(1)}s) · longest manual ${sc[BEST_M]!.toFixed(1)} m · ${sc[HOPS]} hops · top combo ×${1 + sc[TOP]!} · ${S[4]} grumpy neighbours · ${crashes} ${crashes === 1 ? "crash" : "crashes"}`;
    card.hidden = false;
    setView(0);
    say(`Time. ${sNow} points`);
    again.focus({ preventScroll: true });
  }
  function restart(which = S[2]!) {
    run.reset(which);
    card.hidden = true;
    crashes = 0;
    shake = crashT = 0;
    dust.n = spark.n = splash.n = water.n = 0;
    TF.fill(0);
    setView(0);
    was.fill(-1);
    hudDirty = dirty = true;
    pose();
    engine.busy(2);
    play.focus({ preventScroll: true });
  }
  function openGarage() {
    restart();
    garage.hidden = false;
    hudDirty = true;
    rideBtns[S[2]!]!.focus({ preventScroll: true });
  }
  function pick(i: number) {
    restart(i);
    garage.hidden = true;
    for (let k = 0; k < 3; k++) rideBtns[k]!.setAttribute("aria-pressed", "" + (k === i));
    toast(`${RIDES[i]!.name} · ${RIDES[i]!.kind}`, "go");
    hudDirty = true;
    play.focus({ preventScroll: true });
  }

  // ---- camera: the table view (the whole block) or the chase view, a three-quarter view of the bike ----
  function frameTable() {
    const pts = [-HX - 0.4, -1.1, -HZ - 0.4, HX + 0.4, -1.1, -HZ - 0.4, -HX - 0.4, -1.1, HZ + 0.4, HX + 0.4, -1.1, HZ + 0.4, -HX, 2.4, -HZ, HX, 2.4, -HZ, 5.4, 4.5, -2.3];
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.55 : 0;
    TABLE.pitch = tall ? 0.98 : 0.86;
    TABLE.dist = 40;
    TABLE.tx = TABLE.ty = TABLE.ox = TABLE.oy = 0;
    TABLE.tz = 0.6;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
    chaseO.dist = tall ? 12.5 : 10.5;
    chaseO.pitch = tall ? 0.7 : 0.6;
  }
  function stepCam(dt: number) {
    const cam = dio.cam, d = bike.b;
    target.yaw = d.yaw;
    CTP[0] = d.pos[0]!; CTP[1] = Math.max(0, d.pos[1]!); CTP[2] = d.pos[2]!;
    if (view) {
      const m = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return m || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    const k = 1 - Math.exp(-2.6 * dt);
    let moving = false;
    for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const) {
      let dd = TABLE[key] - cam[key];
      if (key === "yaw") dd -= TAU * Math.floor(dd / TAU + 0.5);
      if (Math.abs(dd) > 1e-3) (cam[key] += dd * k), (moving = true);
      else cam[key] = TABLE[key];
    }
    return moving;
  }
  function setView(n: number) {
    view = n;
    viewK.textContent = n ? "VIEW · CHASE" : "VIEW · TABLE";
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

  // ---- drawing extras ----
  function paintSky(ctx: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height;
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    if (P.night) {
      ctx.fillStyle = P.star;
      for (let i = 0; i < 90; i += 3) {
        ctx.globalAlpha = 0.25 + STARS[i + 2]! * 0.6;
        ctx.fillRect(STARS[i]! * W, STARS[i + 1]! * H * 0.6, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    // A moon (night) or a soft sun (day), up and to the left.
    const r = Math.min(W, H) * 0.08;
    ctx.fillStyle = P.moon;
    ctx.beginPath();
    ctx.arc(W * 0.2, H * 0.17, r, 0, TAU);
    ctx.fill();
    if (P.night) {
      ctx.fillStyle = P.sky0;
      ctx.beginPath();
      ctx.arc(W * 0.2 + r * 0.42, H * 0.17 - r * 0.2, r * 0.86, 0, TAU);
      ctx.fill();
    }
  }
  /** One projected segment (skipped when either end is behind the camera). */
  function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    if (!dio.project(x0, y0, z0, tmp) || tmp[2]! < 0.5 || !dio.project(x1, y1, z1, tmp2) || tmp2[2]! < 0.5) return;
    ctx.moveTo(tmp[0]!, tmp[1]!);
    ctx.lineTo(tmp2[0]!, tmp2[1]!);
  }
  /** The curbs: every road's edge, a neon line at night (a light line by day). */
  function paintLines(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = P.curb;
    ctx.lineWidth = P.night ? 1.6 : 1.2;
    ctx.globalAlpha = P.night ? 0.9 : 0.8;
    if (P.night) ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    const y = CURB + 0.005;
    for (let o = 0; o < BLOCKS.length; o += 4) {
      const x0 = BLOCKS[o]!, z0 = BLOCKS[o + 1]!, x1 = BLOCKS[o + 2]!, z1 = BLOCKS[o + 3]!;
      seg(ctx, x0, y, z0, x1, y, z0); seg(ctx, x1, y, z0, x1, y, z1); seg(ctx, x1, y, z1, x0, y, z1); seg(ctx, x0, y, z1, x0, y, z0);
    }
    seg(ctx, -17, y, -10.5, 17, y, -10.5); seg(ctx, 17, y, -10.5, 17, y, 10.5); seg(ctx, 17, y, 10.5, -17, y, 10.5); seg(ctx, -17, y, 10.5, -17, y, -10.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  /** Pools of light under the streetlamps (night only). */
  function paintPools(ctx: CanvasRenderingContext2D) {
    if (!P.night) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    const f = dio.focal();
    for (let k = 0; k < LAMPS.length; k += 2) {
      if (!dio.project(LAMPS[k]!, 0.13, LAMPS[k + 1]!, tmp) || tmp[2]! < 0.5) continue;
      const r = (f * 2.2) / tmp[2]!;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r, r * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r * 0.55, r * 0.28, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  /** The bike's shadow on the ground: an ellipse under it, smaller and fainter the higher it is. */
  function paintShadow(ctx: CanvasRenderingContext2D) {
    const d = bike.b, x = d.pos[0]!, z = d.pos[2]!, lift = Math.max(0, d.pos[1]! - d.drop - d.radius - 0.3);
    if (!dio.project(x, 0.13, z, tmp) || tmp[2]! < 0.5) return;
    const f = dio.focal(), r = (f * 0.85) / tmp[2]!;
    ctx.fillStyle = P.shadow;
    ctx.globalAlpha = Math.max(0.08, 0.32 - lift * 0.15);
    ctx.beginPath();
    ctx.ellipse(tmp[0]!, tmp[1]!, r, r * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function paintSign(ctx: CanvasRenderingContext2D) {
    // The store's sign: one word, on the sign's face.
    const o = 5 * 7, f = HOUSES[o + 5]!;
    if (!dio.project(HOUSES[o]!, CURB + HOUSES[o + 4]! - 0.21, HOUSES[o + 1]! + (f * HOUSES[o + 3]!) / 2 + f * 0.08, tmp) || tmp[2]! < 0.5) return;
    const s = dio.focal() / tmp[2]!;
    if (s < 6) return;
    ctx.font = `900 ${Math.round(s * 0.28)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = P.night ? P.ink : "#ffffff";
    ctx.fillText("CORNER STORE", tmp[0]!, tmp[1]!);
  }
  const BFONT = "900 13px ui-rounded, system-ui, sans-serif";
  /** A Board UI speech bubble over a world point. */
  function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, text: string, w: number, fill: string) {
    if (!dio.project(x, y, z, tmp) || tmp[2]! < 0.5 || tmp[0]! < 0 || tmp[0]! > dio.width) return;
    const bw = w + 18, bh = 24, bx = Math.max(bw / 2 + 6, Math.min(dio.width - bw / 2 - 6, tmp[0]!)), by = tmp[1]! - 10, tx = tmp[0]!;
    if (by - bh < V[3]! - 6) return;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2 + 3, by - bh + 3, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2, by - bh, bw, bh, 8);
    const px = Math.max(bx - bw / 2 + 10, Math.min(bx + bw / 2 - 10, tx));
    ctx.moveTo(px - 5, by);
    ctx.lineTo(px - 2, by + 8);
    ctx.lineTo(px + 5, by);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.ink;
    ctx.font = BFONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx, by - bh / 2 + 0.5);
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    // Neighbours' shouts and the dog's bark.
    for (let i = 0; i < NN; i++) {
      const t = run.NB[i * 3]!;
      if (t <= 0 || t > 2.3) continue;
      const nb = nbs[i]!;
      bubble(ctx, nb.pos[0]!, nb.pos[1]! + 1.5, nb.pos[2]!, LINES[run.NB[i * 3 + 2]!]!, BW[i]!, P.paper);
    }
    if (barkT > 0) bubble(ctx, dog.pos[0]!, dog.pos[1]! + 0.7, dog.pos[2]!, "WOOF!", BW[NN]!, P.warn);
    // The balance gauge over the rider while the front is up: the arc from flat to looping out, the
    // sweet spot round the balance point, the needle at the nose.
    const nose = bike.nose, ph = S[0]!;
    if ((ph !== RUN && ph !== READY) || nose < 0.03) return;
    const d = bike.b;
    if (!dio.project(d.pos[0]!, d.pos[1]! + 1.55, d.pos[2]!, tmp) || tmp[2]! < 0.5) return;
    // (The shared bike loops out 0.62 past its balance point.)
    const sp = bike.spec, lim = bike.balance + 0.62, cx = tmp[0]!, cy = tmp[1]! - 18, r = 26;
    if (cy - r < V[3]! - 4) return;
    const ang = (a: number) => Math.PI + (Math.min(lim, Math.max(0, a)) / lim) * Math.PI;
    ctx.lineCap = "butt";
    ctx.fillStyle = P.ink;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 7, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 7;
    ctx.strokeStyle = P.paper;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, ang(bike.balance - sp.sweet));
    ctx.stroke();
    ctx.strokeStyle = P.good;
    ctx.beginPath();
    ctx.arc(cx, cy, r, ang(bike.balance - sp.sweet), ang(bike.balance + sp.sweet));
    ctx.stroke();
    ctx.strokeStyle = P.bad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, ang(bike.balance + sp.sweet), TAU);
    ctx.stroke();
    const a = ang(nose);
    ctx.strokeStyle = P.warn;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    ctx.stroke();
  }

  // ---- the loop ----
  const PAD = new Float64Array(5);
  function readPad() {
    PAD.fill(0);
    if (!V[6]) return;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) return;
    const ax = gp.axes, bt = gp.buttons, dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    PAD[0] = bt[7] ? bt[7].value : 0;
    PAD[1] = bt[6] ? bt[6].value : 0;
    PAD[2] = -dz(ax[1] || 0);
    PAD[3] = dz(ax[0] || 0);
    PAD[4] = bt[0] && bt[0].pressed ? 1 : 0;
    if (PAD[0] || PAD[1] || PAD[2] || PAD[3] || PAD[4]) auto = false;
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (next !== P) (P = next), buildScene(), (dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        dio.resize(cr.width || 1, cr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = Math.max(8, hr.bottom - sr.top + 8);
        V[4] = 10;
        sky = null;
        frameTable();
        if (!view) Object.assign(dio.cam, TABLE);
        hudDirty = dirty = true;
      }
      readPad();
      if (first && V[5]) (first = null), (garage.hidden ? play : rideBtns[S[2]!]!).focus({ preventScroll: true });
    },
    step(e, dt) {
      if (TF[0] && e.time >= TT[0]!) (TF[0] = 0), showEnd();
      if (auto) run.autopilot(I);
      else {
        const stick = c.stick.active;
        I[0] = Math.max(c.down(GAS) ? 1 : 0, PAD[0]!);
        I[1] = Math.max(c.down(BRAKE) ? 1 : 0, PAD[1]!);
        I[2] = PAD[2] || (stick ? -c.stick.y : c.axis("back", "fwd"));
        I[3] = PAD[3] || (stick ? c.stick.x : c.axis("left", "right"));
        I[4] = c.hit(HOPK) || PAD[4] ? 1 : 0;
      }
      if (!card.hidden || !garage.hidden) I[0] = I[1] = I[2] = I[3] = I[4] = 0;
      let moving = run.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!);
      if (run.n) events(), (moving = true);
      if (S[0] === CRASH) crashT += dt;
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (barkT > 0) (barkT = Math.max(0, barkT - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });

  // ---- input: keys on the stage, hold-to-gas on the play surface, the stickers and the garage ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake", KeyL: "hop" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!garage.hidden) {
      const n = e.code === "Digit1" ? 0 : e.code === "Digit2" ? 1 : e.code === "Digit3" ? 2 : -1;
      if (n >= 0) return void (e.preventDefault(), pick(n));
      return;
    }
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    if (e.code === "KeyR") return void (e.preventDefault(), restart());
    if (e.code === "KeyB") return void (e.preventDefault(), openGarage());
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
    if ((e.target as Element).closest?.(".wc-card") && (e.code === "Space" || e.code === "Enter")) return;
    e.preventDefault();
    if (!card.hidden) return;
    auto = false;
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const k = MAP[e.code];
    if (k) c.press(k, false);
  }, sig);
  // The play surface: hold for gas (a mouse or a finger off the pad).
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!card.hidden || !garage.hidden) return;
    play.setPointerCapture(e.pointerId);
    auto = false;
    c.press("gas");
    engine.wake();
  }, sig);
  const up = () => c.press("gas", false);
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  muteK.addEventListener("click", toggle, sig);
  viewK.addEventListener("click", () => setView(view ? 0 : 1), sig);
  garageK.addEventListener("click", openGarage, sig);
  again.addEventListener("click", () => restart(), sig);
  change.addEventListener("click", openGarage, sig);
  for (let i = 0; i < 3; i++) rideBtns[i]!.addEventListener("click", () => pick(i), sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  // The poster (scripts/gallery-posters.mjs): JOLT up on the back wheel on the south street, by the crosswalk.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    garage.hidden = true;
    run.reset(1);
    auto = true;
    const d = bike.b;
    d.reset(5.2, 8.7, 0, 6.5);
    S[0] = RUN;
    view = 1;
    target.yaw = 0;
    CTP.set(d.pos);
    chase(dio.cam, target, { ...chaseO, snap: true });
  }

  buildScene();
  setView(0);
  engine.start();
  return {
    engine,
    accessible: true,
    get auto() {
      return auto;
    },
    set auto(on: boolean) {
      auto = on;
      engine.wake();
    },
    get state() {
      return { phase: S[0]!, clock: S[1]!, score: sc[SC]!, combo: sc[CB]!, trick: sc[ON] === 1, nose: bike.nose, ride: RIDES[S[2]!]!.id, garage: !garage.hidden, card: !card.hidden, view: view ? "chase" : "table", speed: bike.b.speed, crashes, grumps: S[4]!, best: sc[BEST_W]! };
    },
    run,
    pick,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: JOLT in a wheelie on the south street (scripts/gallery-posters.mjs). */
export const posterAt = 1.6;
void HOP;
void F_SPRINK;
