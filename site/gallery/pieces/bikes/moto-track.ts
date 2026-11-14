// "Moto Track" (hero): a motocross race on a tabletop. A loop of dirt sits on a plinth: four bermed
// turns, a rhythm section of doubles, the whoops, a big triple and the finish tabletop; at night
// (dark) the track glows with neon edges and light towers, by day (light) it is pastel low-poly.
// Pick the bike first: the 2-STROKE is light and peaky (little down low, a hard hit high in the revs:
// it wheelies and loops out easily), the 4-STROKE heavy and torquey (a smooth pull, slow to rotate:
// stable). Then the gate: hold the gas to rev, it drops on GO, three laps against three rivals. The
// stick (W/S, ↑/↓) is the rider's weight: back lifts the front, forward keeps it down, and in the air
// it pitches the bike; A/D (←/→) steer; Space or J is the gas, K or Shift the brake (the rear brake
// brings a wheelie down). Land on the down ramps; case it, loop it or nose it in and you go down.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/terrain (the track and its features,
// drawn in chunks with level of detail), @fzlt/core/drive (its `chase` camera), @fzlt/core/input +
// @fzlt/core/pad (keys, the touch stick and keys), @fzlt/core/slot, @fzlt/core/sound. The bike is
// ./bike.ts (wheelie torque, balance point, loop-out: a brick candidate), drawn by ./rig.ts; the race
// is ./moto-course.ts, headless (tests/moto-track.test.mjs); this file is the scene (tests/moto-track.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject } from "../../../../src/diorama";
import { terrainView, type TerrainView } from "../../../../src/terrain";
import { chase } from "../../../../src/drive";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { FOUR_STROKE, TWO_STROKE, LOOP, ENDO, CASE, BAIL, type Power } from "./bike";
import { rig, type Rig, type RigColors } from "./rig";
import { pool, voice, gamepad, type Pool } from "./kit";
import {
  DONE, E_CRASH, E_FINISH, E_GATE, E_LAND, E_LAP, E_PLACE, E_RESPAWN, E_WHEELIE, E_COUNT, FEATURE_NAMES, GATE_S, GRID, HX, HZ, LAPS, LINE_S, NT, PICK, RACE, RIDERS,
  TRACK, TRACK_W, TURN, YAW, LAP, motoRace, sAt, trackEdges,
} from "./moto-course";

const TAU = 6.283185307179586;
type Kit = Omit<RigColors, "plastic" | "plastic2" | "jersey" | "pants" | "helmet" | "stripe" | "plate" | "ink">;
const TEAM = (plastic: string, plastic2: string, jersey: string, pants: string, helmet: string, stripe: string, plate: string, ink: string) => ({ plastic, plastic2, jersey, pants, helmet, stripe, plate, ink });
// The palettes by role: a neon night (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.4, 1, 0.5], amb: 0.44,
  sky0: "#05061a", sky1: "#1a0f3e", sky2: "#3a1460", star: "#cfd8ff", grid: "#3b2a7a",
  ground: ["#0c1530", "#101b3a", "#142045"], crest: "#1a2a58", steep: "#0a1128", track: "#3a2650", face: "#55356f", edge: "#22e6ff", edge2: "#ff4fa8",
  plinth: "#120f26", rim: "#22e6ff", table: "#0a0918", tuff: "#1d1838", tuffTop: "#ff4fa8", tower: "#24203f", lamp: "#fff2c2", beam: "#22e6ff",
  gate: "#cfd6ff", gateBar: "#ff4fa8", gatePost: "#2a2548", check: "#f4f1ff", ink: "#0b0a14", banner: "#22e6ff",
  dust: "#7c68c4", spark: "#ffd166", shadow: "#000000", hot: "#ff4fa8", ok: "#22e6ff", meter: "#16132b",
  kit: { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", visor: "#0a0c16", boots: "#e9ecff", gloves: "#14121f", glow: "#ff2e88" } as Kit,
  teams: [
    TEAM("#22e6ff", "#eef0ff", "#22e6ff", "#1b1a2c", "#eef0ff", "#ff4fa8", "#eef0ff", "#0b0a14"),
    TEAM("#b6ff3b", "#1b1a2c", "#b6ff3b", "#2a2a3a", "#1b1a2c", "#b6ff3b", "#b6ff3b", "#0b0a14"),
    TEAM("#ff8a3d", "#eef0ff", "#ff8a3d", "#2a2238", "#ff8a3d", "#eef0ff", "#eef0ff", "#0b0a14"),
    TEAM("#b18cff", "#1b1a2c", "#b18cff", "#1b1a2c", "#eef0ff", "#b18cff", "#ffd166", "#0b0a14"),
  ],
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.54,
  sky0: "#bfe6ff", sky1: "#d9f0ff", sky2: "#fff1dc", star: "#ffffff", grid: "#ffffff",
  ground: ["#a8dcb4", "#9ad2a9", "#8cc79d"], crest: "#b9e6c2", steep: "#7fb98f", track: "#d9a774", face: "#e8bf8f", edge: "#fff5e6", edge2: "#ff7a59",
  plinth: "#c98f6a", rim: "#fff0dc", table: "#e8c7a6", tuff: "#fff3e3", tuffTop: "#ff7a59", tower: "#8a8fb0", lamp: "#ffe9a8", beam: "#ffffff",
  gate: "#ffffff", gateBar: "#ff7a59", gatePost: "#6f6a8a", check: "#ffffff", ink: "#1b1420", banner: "#13a9bb",
  dust: "#e9c39a", spark: "#fff1a8", shadow: "#5a3a2a", hot: "#ff4f6d", ok: "#13a9bb", meter: "#ffffff",
  kit: { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", visor: "#1b1d2a", boots: "#ffffff", gloves: "#2a2833", glow: "#ff3b30" },
  teams: [
    TEAM("#13a9bb", "#ffffff", "#13a9bb", "#2c3550", "#ffffff", "#ff7a59", "#ffffff", "#1b1420"),
    TEAM("#7cc93a", "#2c3550", "#7cc93a", "#3a3a4c", "#2c3550", "#7cc93a", "#7cc93a", "#1b1420"),
    TEAM("#ff8a3d", "#ffffff", "#ff8a3d", "#3d3550", "#ff8a3d", "#ffffff", "#ffffff", "#1b1420"),
    TEAM("#8f6bff", "#2c3550", "#8f6bff", "#2c3550", "#ffffff", "#8f6bff", "#ffd166", "#1b1420"),
  ],
};
const DUST = 120, SPARK = 48, ROOST = 60;
const BIKES: Power[] = [TWO_STROKE, FOUR_STROKE];
const ORD = ["1ST", "2ND", "3RD", "4TH"];
const CRASH_NAME: Record<number, string> = { [LOOP]: "LOOPED OUT!", [ENDO]: "OVER THE BARS!", [CASE]: "CASED IT!", [BAIL]: "BAILED!", 5: "WIPEOUT!", 9: "OFF THE TABLE!" };

export type MotoScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; lap: number; place: number; clock: number; crashes: number; speed: number; air: number; wheelie: number; bike: string; card: boolean; pick: boolean; view: string; count: number };
  /** Ride by itself (the poster, the tests). */
  auto: boolean;
  /** Pick a bike (0: 2-stroke, 1: 4-stroke) and go to the gate. */
  pick(i: number): void;
  readonly race: ReturnType<typeof motoRace>;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): MotoScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 20261118 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  void slot;

  // ---- the page: the canvas, the play surface over it, the stickers, the pick card, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "mt-play";
  play.setAttribute("aria-label", "Moto Track: Space or J for gas, K or Shift to brake, W and S (or up and down) shift your weight forward and back (back lifts the front; in the air it pitches the bike), A and D (or left and right) steer. V changes the view, M mutes, R restarts");
  const hud = L.add(document.createElement("div"));
  hud.className = "mt-hud";
  const bikeBtn = (i: number, name: string, blurb: string, s: number[]) =>
    `<button type="button" class="mt-bike" data-b="${i}" aria-label="${name}: ${blurb} (${i + 1})"><b>${name}</b><small>${blurb}</small><span class="mt-stats">${["LOW-END PULL", "TOP-END HIT", "WEIGHT", "STABILITY"].map((l, k) => `<i style="--v:${s[k]}"><em>${l}</em></i>`).join("")}</span><kbd>${i + 1}</kbd></button>`;
  hud.innerHTML = `<div class="mt-head"><p class="mt-top"><b class="mt-chip mt-pos"><span>1ST</span><i>/${RIDERS}</i></b><b class="mt-chip mt-lap"><span>LAP 1/${LAPS}</span></b><b class="mt-chip mt-time"><span>0:00.0</span></b><b class="mt-chip mt-ride"><span>2-STROKE</span></b></p><p class="mt-hint"></p></div><p class="mt-toast" hidden></p><p class="mt-live" aria-live="polite"></p><p class="mt-keys"><button type="button" class="mt-key mt-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="mt-key mt-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="mt-pick" role="dialog" aria-label="Pick your bike"><b>PICK YOUR BIKE</b><div class="mt-bikes">${bikeBtn(0, "2-STROKE", "Light and peaky: little down low, then it hits hard. Wheelies and loops out easily.", [1, 5, 1, 2])}${bikeBtn(1, "4-STROKE", "Heavy and torquey: a smooth pull from the bottom. Slow to rotate, stable.", [5, 3, 4, 5])}</div><p class="mt-howto">Weight back lifts the front · weight forward keeps it down · the brake brings a wheelie down</p></div><div class="mt-card" role="dialog" aria-label="Race finished" hidden><b>1ST</b><p class="mt-t"></p><p class="mt-stats2"></p><p class="mt-again"><button type="button" class="bui-key mt-re">RACE AGAIN</button><button type="button" class="bui-key mt-swap">SWAP BIKE</button></p></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, pickEl = hud.children[4] as HTMLElement, card = hud.children[5] as HTMLElement;
  const posEl = top.children[0]!.firstChild as HTMLElement, lapEl = top.children[1]!.firstChild as HTMLElement, timeEl = top.children[2]!.firstChild as HTMLElement, rideEl = top.children[3]!.firstChild as HTMLElement;
  const viewK = keysEl.children[0] as HTMLButtonElement, muteK = keysEl.children[1] as HTMLButtonElement;
  const pickBtns = pickEl.querySelectorAll<HTMLButtonElement>(".mt-bike");
  const cardP = card.children[0] as HTMLElement, cardT = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement;
  const reBtn = card.querySelector<HTMLButtonElement>(".mt-re")!, swapBtn = card.querySelector<HTMLButtonElement>(".mt-swap")!;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { count: "click", gate: "power", lap: "ready", crash: "boom", land: "click", wheelie: "power", finish: "win", pass: "click" }, volume: 0.1 });
  const vox = voice();
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FWD = c.id("fwd"), BACK = c.id("back");
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "gas", label: "GAS", name: "Gas (Space)", key: "SPACE", role: "go", hold: true },
      { intent: "brake", label: "BRAKE", name: "Brake (K)", key: "K", role: "attack", hold: true },
    ],
    host: stage,
  });
  thePad.el.classList.add("mt-pad");
  const toggle = () => {
    snd.on = vox.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the race and the diorama ----
  const race = motoRace(), t = race.t, me = race.riders[0]!;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  let tv: TerrainView, dust: Pool, spark: Pool, roost: Pool;
  const rigs: Rig[] = [], gateBars: DioramaObject[] = [];
  const EDGE = trackEdges(t);
  const rnd = seeded(20261118);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(120);
  for (let i = 0; i < 120; i++) STARS[i] = rnd();

  function buildScene() {
    dio.clear();
    rigs.length = gateBars.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("table", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    dio.add({ id: "table", size: [HX * 2 + 8, 0.5, HZ * 2 + 7], pos: [0, -1.55, 0.6], color: P.table, cluster: "table", layer: 0, pick: false });
    dio.add({ id: "plinth", size: [HX * 2 + 0.5, 1.05, HZ * 2 + 0.5], pos: [0, -1.05, 0], color: P.plinth, cluster: "table", layer: 1, pick: false });
    dio.add({ id: "rim", size: [HX * 2 + 0.7, 0.12, HZ * 2 + 0.7], pos: [0, -0.2, 0], color: P.rim, cluster: "table", layer: 2, emissive: true, pick: false });
    tv = terrainView(dio, t, {
      bands: [[0.45, P.ground[0]!], [0.85, P.ground[1]!], [1.25, P.ground[2]!], [99, P.crest]], steep: 0.5, steepColor: P.steep, kinds: [P.track, P.face],
      light: P.light, ambient: P.amb, lod: [24, 44], shadows: RIDERS + 1, shadowColor: P.shadow,
    });
    dio.decal("terrain", 1, paintLines);
    // Tuff blocks round the outside of each turn, glowing at night.
    for (let i = 0; i < NT; i += 3) {
      if (!TURN[i]) continue;
      const yaw = YAW[i]!, nx = Math.sin(yaw), nz = Math.cos(yaw), d = TRACK_W / 2 + 1.5, x = TRACK[i * 2]! + nx * d, z = TRACK[i * 2 + 1]! + nz * d, id = "tf" + i;
      dio.add({ id, size: [0.55, 0.32, 0.36], pos: [x, t.height(x, z) - 0.05, z], rot: [0, yaw, 0], color: P.tuff, pick: false });
      dio.add({ size: [0.57, 0.07, 0.38], on: id, color: P.tuffTop, emissive: P.night, pick: false });
    }
    // Light towers at the corners, their lamps aimed in.
    for (const [x, z] of [[-HX + 1.4, -HZ + 1.4], [HX - 1.4, -HZ + 1.4], [-HX + 1.4, HZ - 1.4], [HX - 1.4, HZ - 1.4]] as const) {
      const id = "tw" + x + z;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.3, 4.2, 0.3], pos: [x, t.height(x, z) - 0.1, z], color: P.tower, pick: false });
      dio.add({ size: [1.3, 0.5, 0.25], pos: [0, 0, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.tower, pick: false });
      dio.add({ size: [1.1, 0.34, 0.27], pos: [0, 0.08, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.lamp, emissive: true, pick: false, layer: 9 });
    }
    // The start gate: a beam across the track and a drop bar in front of each lane; the lap line's arch.
    {
      const i = Math.round(GATE_S / (LAP / NT)), x = TRACK[i * 2]!, z = TRACK[i * 2 + 1]!, yaw = YAW[i]!, w = TRACK_W + 0.8;
      dio.add({ id: "gate", shape: "group", size: [0.4, 0, w], pos: [x, t.height(x, z), z], rot: [0, yaw, 0], pick: false });
      dio.add({ size: [0.16, 0.12, w], pos: [0.1, 0, 0], on: "gate", color: P.gatePost, pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ shape: "cyl", sides: 6, size: [0.2, 0.7, 0.2], pos: [0.1, 0, zz], on: "gate", color: P.gatePost, pick: false });
      for (let k = 0; k < 4; k++) {
        const gid = "gb" + k, lane = [-0.35, -1.15, 0.45, 1.25][k]!;
        const g = dio.add({ id: gid, shape: "group", size: [0.1, 0, 0.6], pos: [0.18, 0.12, lane], on: "gate", pick: false });
        dio.add({ size: [0.06, 0.5, 0.62], pos: [0, 0, 0], on: gid, color: P.gate, pick: false });
        dio.add({ size: [0.065, 0.12, 0.63], pos: [0, 0.36, 0], on: gid, color: P.gateBar, emissive: P.night, pick: false });
        gateBars.push(g);
      }
    }
    {
      const i = Math.round(LINE_S / (LAP / NT)), x = TRACK[i * 2]!, z = TRACK[i * 2 + 1]!, yaw = YAW[i]!, w = TRACK_W + 1.6;
      dio.add({ id: "arch", shape: "group", size: [0.4, 0, w], pos: [x, t.height(x, z), z], rot: [0, yaw, 0], pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ shape: "cyl", sides: 6, size: [0.22, 3.1, 0.22], pos: [0.6, 0, zz], on: "arch", color: P.gatePost, pick: false });
      dio.add({ size: [0.2, 0.5, w + 0.2], pos: [0.6, 3.1, 0], on: "arch", color: P.banner, emissive: P.night, pick: false });
      for (let k = 0; k < 10; k++) dio.add({ size: [0.22, 0.18, w / 10], pos: [0.6, 2.92 + (k & 1 ? 0 : 0.18), -w / 2 + (k + 0.5) * (w / 10)], on: "arch", color: k & 1 ? P.ink : P.check, pick: false, layer: 9 });
    }
    // Pylons along the straights (neon tips at night).
    for (let i = 8; i < NT; i += 14) {
      if (TURN[i]) continue;
      const yaw = YAW[i]!, side = (i / 14) & 1 ? 1 : -1, d = TRACK_W / 2 + 1.1, x = TRACK[i * 2]! + Math.sin(yaw) * d * side, z = TRACK[i * 2 + 1]! + Math.cos(yaw) * d * side, id = "py" + i;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.14, 0.8, 0.14], pos: [x, t.height(x, z), z], color: P.gatePost, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.22, 0.16, 0.22], pos: [0, 0, 0], on: id, color: side > 0 ? P.edge : P.edge2, emissive: true, pick: false });
    }
    // The riders: the player first.
    for (let r = 0; r < RIDERS; r++) {
      const T = P.teams[r]!, kind = race.powers[r] === TWO_STROKE ? "2t" : "4t";
      rigs.push(rig(dio, "rider" + r, { ...P.kit, ...T }, kind));
    }
    dust = pool(dio, DUST, P.dust, 4);
    roost = pool(dio, ROOST, P.dust, 5);
    spark = pool(dio, SPARK, P.spark, 6);
    sky = null;
    pose();
  }

  // ---- state ----
  const I = new Float64Array(5), GP = new Float64Array(6), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // Pointer: down, start x, start y, x, y, id.
  const PD = new Float64Array(6);
  PD[5] = -1;
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once, [6] a pad seen.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let view = 0, auto = false, dirty = true, hudDirty = true, shake = 0, toastT = 0, gateT = 0, choice = 0, cardAt = -1, emitK = 0, best = 0;
  const was = new Float64Array(8).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.82, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  const chaseO = { dist: 9.5, pitch: 0.36, lift: 0.9, ahead: 0.3, rate: 3.4, turn: 2.6, side: 0.62 };
  const VEL = new Float64Array(3), CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: VEL };
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const padHello = () => ((V[6] = 1), engine.wake());
  addEventListener("gamepadconnected", padHello, sig);
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), vox.close()), { once: true });

  function pose() {
    for (let r = 0; r < RIDERS; r++) {
      const b = race.riders[r]!, g = rigs[r]!;
      g.pose(b, b.air > 0 || Math.abs(b.speed) > 5 ? 0.85 : 0.35);
      const x = b.pos[0]!, z = b.pos[2]!, inside = Math.abs(x) < HX && Math.abs(z) < HZ, lift = inside ? b.pos[1]! - t.height(x, z) : 9;
      tv.shadow(r, x, z, 0.95, inside ? Math.max(0, 0.36 - lift * 0.09) : 0);
    }
    const drop = Math.min(1, gateT / 0.28);
    for (const g of gateBars) g.rot[2] = -1.5 * drop * drop;
  }

  // ---- FX ----
  function stepFx(dt: number) {
    let any = false;
    for (let r = 0; r < RIDERS; r++) {
      const b = race.riders[r]!;
      if (b.crashed || !b.contact[0]) continue;
      // Dust from the rear by how hard it digs; a roost of dirt thrown back when it spins.
      const d = b.dust * (r ? 0.6 : 1);
      emitK += d * 55 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(b.wheel[0]! + (rnd() - 0.5) * 0.3, b.wheel[1]! - 0.25, b.wheel[2]! + (rnd() - 0.5) * 0.3, -b.cy * b.speed * 0.12 + (rnd() - 0.5), 0.4 + rnd() * 0.6, b.sy * b.speed * 0.12 + (rnd() - 0.5), 0.6 + rnd() * 0.5, 0.11, 0.4);
      }
      if (b.slip > 0.1 && rnd() < b.slip) roost.puff(b.wheel[0]!, b.wheel[1]! - 0.2, b.wheel[2]!, -b.cy * (3 + rnd() * 3), 2 + rnd() * 2.5, b.sy * (3 + rnd() * 3), 0.5 + rnd() * 0.3, 0.05, 0.9);
    }
    if (dust.step(dt, -0.4, 0.22, 0.32)) any = true;
    if (roost.step(dt, 14, 0.02, 0.9, 0.4)) any = true;
    if (spark.step(dt, 14, -0.05, 1)) any = true;
    return any;
  }

  // ---- events from the race: stickers, sound, FX ----
  function events() {
    for (let k = 0; k < race.n; k++) {
      const type = race.ev[k * 3]!, r = race.ev[k * 3 + 1]!, val = race.ev[k * 3 + 2]!, b = race.riders[r]!;
      hudDirty = true;
      if (type === E_COUNT) engine.events.emit("count"), toast("" + val, "go");
      else if (type === E_GATE) (gateT = 0.001), engine.events.emit("gate"), toast("GATE DROP!", "go"), say("Go");
      else if (type === E_LAP && !r) engine.events.emit("lap"), toast(val === LAPS - 1 ? "LAST LAP!" : `LAP ${val + 1}/${LAPS}`, "go"), say(`Lap ${val + 1}`);
      else if (type === E_PLACE && race.phase === RACE) toast(ORD[val]!, val < race.place(0) ? "go" : "meh"), engine.events.emit("pass");
      else if (type === E_LAND) {
        if (me.crashed) continue;
        const clean = val < 0.25;
        engine.events.emit("land");
        if (me.landAir > 0.45) toast(`${me.landAir.toFixed(2)}s AIR · ${clean ? "CLEAN" : "SKETCHY"}`, clean ? "clean" : "meh");
        dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.6, me.pos[2]!, clean ? 8 : 14, 2.2, 1, 0.8, 0.2, 0.55);
      } else if (type === E_WHEELIE && val > 0.6) toast(`WHEELIE ${val.toFixed(1)}s`, "clean"), engine.events.emit("wheelie");
      else if (type === E_CRASH) {
        if (!r) shake = 0.5, toast(CRASH_NAME[val] || "WIPEOUT!", "bad"), say(CRASH_NAME[val] || "Wipeout");
        engine.events.emit("crash");
        for (let q = 0; q < 22; q++) {
          const a = rnd() * TAU, u = 0.4 + rnd();
          spark.puff(b.pos[0]!, b.pos[1]!, b.pos[2]!, Math.cos(a) * 4 * u, 2 + rnd() * 4, Math.sin(a) * 4 * u, 0.5 + rnd() * 0.5, 0.07, 1);
        }
        dust.ring(rnd, b.pos[0]!, b.pos[1]! - 0.4, b.pos[2]!, 18, 3, 1.2, 1, 0.24, 0.6);
      } else if (type === E_RESPAWN && !r) {
        CTP.set(me.pos);
        chase(dio.cam, target, { ...chaseO, snap: view === 1 }, 1 / 60);
        toast("BACK ON IT", "go");
      } else if (type === E_FINISH && !r) {
        engine.events.emit("finish");
        toast(`FINISH · ${ORD[val]}`, val ? "go" : "clean");
        say(`Finished ${ORD[val]}`);
        cardAt = engine.time + 1.6;
        engine.busy(1.7);
      }
    }
    race.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "mt-toast mt-" + kind;
    toastEl.hidden = false;
    toastT = 1.4;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  const clock = (s: number) => `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  function hudWrite() {
    const ph = race.phase, pl = race.place(0), lap = race.lap(0);
    if (was[0] !== pl) (was[0] = pl), (posEl.textContent = ORD[pl]!);
    if (was[1] !== lap || was[5] !== ph) (was[1] = lap), (was[5] = ph), (lapEl.textContent = ph === DONE ? "FINISHED" : lap === LAPS ? "LAST LAP" : `LAP ${lap}/${LAPS}`);
    const tenths = Math.floor(race.clock * 10);
    if (was[2] !== tenths) (was[2] = tenths), (timeEl.textContent = clock(tenths / 10));
    if (was[3] !== choice) (was[3] = choice), (rideEl.textContent = BIKES[choice]!.name);
    const touch = !!thePad.el.offsetParent;
    const hint = ph === GRID ? (touch ? "Hold GAS to rev · it drops on GO" : "Hold Space to rev · it drops on GO") : ph === RACE && race.clock < 6 ? (touch ? "Stick: lean and steer · back lifts the front" : "W/S lean · A/D steer · Space gas · K brake") : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function showEnd() {
    cardAt = -1;
    const pl = race.place(0), time = race.finishTime(0), isBest = !best || time < best;
    if (isBest) best = time;
    cardP.textContent = ORD[pl]!;
    cardP.className = pl ? "" : "mt-win";
    cardT.textContent = clock(time) + (isBest ? " · BEST" : ` · best ${clock(best)}`);
    const cr = race.crashes(0);
    cardS.textContent = `${BIKES[choice]!.name} · best lap ${clock(race.bestLap(0))} · ${cr} ${cr === 1 ? "crash" : "crashes"}`;
    card.hidden = false;
    setView(0);
    say(`Finished ${ORD[pl]} in ${clock(time)}`);
    reBtn.focus({ preventScroll: true });
  }
  function choose(i: number) {
    choice = i;
    pickEl.hidden = true;
    card.hidden = true;
    race.go(BIKES[i]!);
    rigs.length && buildScene();
    gateT = 0;
    was.fill(-1);
    vox.use(BIKES[i]!);
    setView(1);
    CTP.set(me.pos);
    target.yaw = me.yaw;
    chase(dio.cam, target, { ...chaseO, snap: true });
    hudDirty = dirty = true;
    engine.busy(4);
    play.focus({ preventScroll: true });
  }
  function toPick() {
    race.reset();
    card.hidden = true;
    pickEl.hidden = false;
    gateT = 0;
    setView(0);
    was.fill(-1);
    dust.clear();
    roost.clear();
    spark.clear();
    hudDirty = dirty = true;
    pose();
    pickBtns[choice]!.focus({ preventScroll: true });
  }

  // ---- camera: the table view (the whole track) or the chase view behind the bike ----
  function frameTable() {
    const pts = [-HX - 0.4, -1.1, -HZ - 0.4, HX + 0.4, -1.1, -HZ - 0.4, -HX - 0.4, -1.1, HZ + 0.4, HX + 0.4, -1.1, HZ + 0.4, -HX, 2.4, -HZ, HX, 2.4, -HZ];
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.55 : 0;
    TABLE.pitch = tall ? 0.98 : 0.8;
    TABLE.dist = 38;
    TABLE.tx = TABLE.ty = TABLE.ox = TABLE.oy = 0;
    TABLE.tz = 0.4;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
    chaseO.dist = tall ? 10.5 : 9;
    chaseO.pitch = tall ? 0.46 : 0.36;
  }
  function stepCam(dt: number) {
    const cam = dio.cam, b = me;
    target.yaw = b.crashed ? target.yaw : b.yaw;
    const src = b.crashed ? b.rider : b.pos;
    CTP[0] = Math.max(-HX - 1, Math.min(HX + 1, src[0]!));
    CTP[1] = Math.max(-1, src[1]!);
    CTP[2] = Math.max(-HZ - 1, Math.min(HZ + 1, src[2]!));
    VEL[0] = b.cy * b.speed; VEL[1] = 0; VEL[2] = -b.sy * b.speed;
    if (view) {
      const m = chase(cam, target, chaseO, dt), k = 1 - Math.exp(-4 * dt);
      cam.ox -= cam.ox * k;
      cam.oy -= cam.oy * k;
      return m || Math.abs(cam.ox) + Math.abs(cam.oy) > 0.2;
    }
    const k = 1 - Math.exp(-2.6 * dt);
    let moving = false;
    for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const) {
      let d = TABLE[key] - cam[key];
      if (key === "yaw") d -= TAU * Math.floor(d / TAU + 0.5);
      if (Math.abs(d) > 1e-3) (cam[key] += d * k), (moving = true);
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

  // ---- drawing: the sky, the track's neon edges, the tach and balance sticker ----
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
      for (let i = 0; i < 120; i += 3) {
        ctx.globalAlpha = 0.2 + STARS[i + 2]! * 0.6;
        ctx.fillRect(STARS[i]! * W, STARS[i + 1]! * H * 0.55, 1.5, 1.5);
      }
      // A neon horizon grid, far behind the table.
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = P.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 1; k < 7; k++) {
        const y = H * (0.5 + k * k * 0.012);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      for (let k = -8; k <= 8; k++) {
        ctx.moveTo(W / 2 + k * W * 0.04, H * 0.5);
        ctx.lineTo(W / 2 + k * W * 0.2, H);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // Two soft clouds.
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      for (let k = 0; k < 2; k++) {
        const x = W * (0.2 + k * 0.55), y = H * (0.14 + k * 0.06), r = Math.min(W, H) * 0.05;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, TAU);
        ctx.arc(x - r * 1.0, y + r * 0.3, r * 0.7, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  function paintLines(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    const f = dio.focal();
    for (let side = 0; side < 2; side++) {
      ctx.strokeStyle = side ? P.edge : P.edge2;
      for (let i = 0; i < NT; i++) {
        const a = side * NT * 3 + i * 3, b = side * NT * 3 + ((i + 1) % NT) * 3;
        if (!dio.project(EDGE[a]!, EDGE[a + 1]!, EDGE[a + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(EDGE[b]!, EDGE[b + 1]!, EDGE[b + 2]!, tmp2) || tmp2[2]! < 0.5) continue;
        ctx.lineWidth = Math.max(1, (f * 0.16) / tmp[2]!);
        ctx.beginPath();
        ctx.moveTo(tmp[0]!, tmp[1]!);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
      }
    }
  }
  /** The tach (revs, the power band lit) and, up on the back wheel, the balance meter: a Board UI sticker. */
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (race.phase !== RACE && race.phase !== GRID) return;
    const W = dio.width, H = dio.height, s = Math.max(0.8, Math.min(1.2, W / 720)), w = 168 * s, h = 46 * s, x = 10, y = H - V[4]! - h - 6;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w, h, 8);
    ctx.fill();
    ctx.fillStyle = P.meter;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    // Revs: 16 segments; the curve's strongest band glows.
    const pw = me.power, n = 16, sw = (w - 20 * s) / n, rpm = me.rpm;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, cv = pw.curve, ci = Math.min(cv.length - 1, Math.round(u * (cv.length - 1))), band = cv[ci]! > 0.85;
      ctx.fillStyle = u <= rpm ? (band ? P.hot : P.ok) : band ? (P.night ? "#3a2240" : "#ffd9d9") : P.night ? "#2a2545" : "#e8e4f0";
      ctx.fillRect(x + 10 * s + k * sw, y + 8 * s, sw - 2, 10 * s);
    }
    ctx.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx.font = `900 ${Math.round(10 * s)}px ui-rounded, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const up = me.contact[0] && !me.contact[1] && me.rel > 0.1;
    if (!up) {
      ctx.fillText(`${pw.name} · GEAR ${me.gear + 1}`, x + 10 * s, y + 32 * s);
      return;
    }
    // Balance: the wheelie's angle on a bar, the balance point marked; past it, red.
    const bal = Math.max(0, Math.min(1.5, me.balance)), bx = x + 10 * s, bw = w - 20 * s, by = y + 26 * s, bh = 12 * s;
    ctx.fillStyle = P.night ? "#2a2545" : "#e8e4f0";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = P.ok;
    ctx.fillRect(bx + bw * (0.7 / 1.5), by, bw * (0.3 / 1.5), bh);
    ctx.fillStyle = bal > 1 ? P.hot : P.ink;
    ctx.fillRect(bx + bw * (bal / 1.5) - 2, by - 3, 4, bh + 6);
    ctx.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx.textAlign = "right";
    ctx.fillText(bal > 1 ? "BRAKE!" : me.wheelie.toFixed(1) + "s", x + w - 10 * s, by - 6 * s);
  }

  // ---- the loop ----
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
      if (V[6] && !gamepad(GP)) GP.fill(0);
      if (first && V[5]) (first = null), (pickEl.hidden ? play : pickBtns[0]!).focus({ preventScroll: true });
    },
    step(e, dt) {
      if (cardAt > 0 && e.time >= cardAt) showEnd();
      // Inputs: keys and pad (controls), a gamepad, the pointer (hold for gas, drag to steer and lean), or the autopilot.
      const drag = PD[0] ? Math.max(40, dio.width * 0.12) : 1;
      I[0] = c.down(GAS) || PD[0] || GP[2]! > 0.2 ? Math.max(c.down(GAS) || PD[0] ? 1 : 0, GP[2]!) : 0;
      I[1] = c.down(BRAKE) || GP[3]! > 0.2 ? 1 : 0;
      I[2] = (+c.down(BACK) - +c.down(FWD)) || (c.stick.active ? c.stick.y : 0) || GP[1]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[4]! - PD[2]!) / drag)) : 0);
      I[3] = (+c.down(RIGHT) - +c.down(LEFT)) || (c.stick.active ? c.stick.x : 0) || GP[0]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[3]! - PD[1]!) / drag)) : 0);
      if (V[6] && race.phase === PICK && GP[2]! > 0.5) choose(choice);
      if (!card.hidden) I.fill(0);
      let moving = race.step(dt, I, auto);
      if (race.n) events(), (moving = true);
      if (gateT > 0 && gateT < 0.3) (gateT += dt), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      vox.set(me.rpm, me.throttle, (race.phase === RACE || race.phase === GRID) && !me.crashed && !!card.hidden);
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });

  // ---- input: keys on the stage, hold-and-drag on the play surface, the stickers ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    if (e.code === "KeyR") return void (e.preventDefault(), toPick());
    if (!pickEl.hidden && (e.code === "Digit1" || e.code === "Digit2")) return void (e.preventDefault(), wake(), choose(e.code === "Digit1" ? 0 : 1));
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
    if (!pickEl.hidden || !card.hidden) return;
    e.preventDefault();
    auto = false;
    wake();
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const k = MAP[e.code];
    if (k) c.press(k, false);
  }, sig);
  const wake = () => vox.wake(BIKES[choice]!);
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!card.hidden || !pickEl.hidden) return;
    play.setPointerCapture(e.pointerId);
    auto = false;
    wake();
    (PD[0] = 1), (PD[1] = PD[3] = e.offsetX), (PD[2] = PD[4] = e.offsetY), (PD[5] = e.pointerId);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => void (e.pointerId === PD[5] && ((PD[3] = e.offsetX), (PD[4] = e.offsetY))), sig);
  const up = (e: PointerEvent) => void (e.pointerId === PD[5] && ((PD[0] = 0), (PD[5] = -1)));
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  pickBtns.forEach((b, i) => b.addEventListener("click", () => (wake(), choose(i)), sig));
  muteK.addEventListener("click", toggle, sig);
  viewK.addEventListener("click", () => setView(view ? 0 : 1), sig);
  reBtn.addEventListener("click", () => choose(choice), sig);
  swapBtn.addEventListener("click", toPick, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), wake(), engine.wake()), sig);

  // The poster (scripts/gallery-posters.mjs): over the triple, the pack behind.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    auto = true;
    choose(0);
    race.S[0] = RACE;
    race.S[2] = 0;
    gateT = 0.3;
    const s0 = 55.3 + 6;
    for (let r = 0; r < RIDERS; r++) {
      const i = Math.round(((s0 - r * 1.6) / LAP) * NT) % NT, yaw = YAW[i]!, lane = [0, -0.9, 0.9, 0.2][r]!;
      race.riders[r]!.reset(TRACK[i * 2]! + Math.sin(yaw) * lane, TRACK[i * 2 + 1]! + Math.cos(yaw) * lane, yaw, 11.2 - r * 0.3);
      race.R[r * 16] = i;
      race.R[r * 16 + 2] = sAt(i) + LAP;
      race.R[r * 16 + 1] = 1;
    }
    view = 1;
    target.yaw = me.yaw;
    CTP.set(me.pos);
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
      return { phase: race.phase, lap: race.lap(0), place: race.place(0), clock: race.clock, crashes: race.crashes(0), speed: me.speed, air: me.air, wheelie: me.wheelie, bike: BIKES[choice]!.name, card: !card.hidden, pick: !pickEl.hidden, view: view ? "chase" : "table", count: race.count };
    },
    pick(i: number) {
      wake();
      choose(i);
    },
    poster,
    race,
    destroy: () => engine.destroy(),
  };
}

/** The poster: over the triple, the pack behind (scripts/gallery-posters.mjs). */
export const posterAt = 1;
