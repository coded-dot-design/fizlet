// "Dune Hop" (hero): a short cyberpunk-desert run on a tabletop. A slab of ridged dunes sits on a
// plinth: at night (dark) the crests glow pink over violet sand under a striped neon sun, the track
// has a cyan shoulder and neon pylons; in light it is a hot sunset. Eight checkpoint gates, two laps:
// throttle and steer a small buggy round (↑ ↓ ← → or WASD, the on-screen pad, or hold and drag),
// kick off the jumps for airtime, land clean for a combo, nose in or roll it and it tumbles, then
// drops back in at the last gate. In the air the gas lifts the nose and the brake dips it. The clock
// runs from the first press to the last gate; the card has the time, the score and the best air.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/terrain (the dunes, the carved track,
// the kickers, whoops and berm, drawn in chunks with level of detail), @fzlt/core/drive (the buggy's
// springs, grip, air and landing, and its `chase` camera), @fzlt/core/input + @fzlt/core/pad (keys
// and touch), @fzlt/core/slot, @fzlt/core/sound. The run is ./course.ts and the air scorer
// ./stunt.ts, both headless (tests/dune-hop.test.mjs); this file is the scene (tests/dune-hop.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { terrainView, type TerrainView } from "../../../../src/terrain";
import { chase } from "../../../../src/drive";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { CRASH, DONE, E_CRASH, E_FINISH, E_GATE, E_LAND, E_RESPAWN, E_START, GATE_AT, GATES, HX, HZ, LAPS, READY, RUN, TRACK, TRACK_W, NT, contours, duneRun, trackDist, trackEdges, trackYaw } from "./course";
import { CLEAN, SC, CB, BEST, CLEANS, PTS, AIR, TOP } from "./stunt";

const TAU = 6.283185307179586;
// The palettes by role: night (dark) and a hot sunset (light).
const DARK = {
  night: true, light: [-0.35, 1, 0.55], amb: 0.46,
  sky0: "#07061a", sky1: "#2a0f4a", sky2: "#6a1d6e", sun0: "#ffcf5a", sun1: "#ff2e88", star: "#cfd8ff",
  sand: ["#221c46", "#2c245a", "#382d6c"], crest: "#463680", steep: "#1a1536", track: "#16122c", edge: "#22e6ff", lines: ["#5a3fb0", "#b83fd0", "#ff4fa8"], lineA: [0.55, 0.7, 0.95],
  plinth: "#16122b", rim: "#22e6ff", table: "#0d0b1c", rock: "#2c2550", pylon: "#2a2445", tip: "#22e6ff", tip2: "#ff4fa8",
  body: "#eef0ff", accent: "#22e6ff", chassis: "#22212f", cage: "#b9bdd8", tyre: "#121219", hub: "#8d92b4", helmet: "#ff4fa8", visor: "#0a0c16", lamp: "#fff7d6", tail: "#ff2e88",
  gNext: "#ff4fa8", gDone: "#22e6ff", gIdle: "#5a4a9c", gPost: "#2b2546", check: "#f4f1ff", ink: "#0b0a14",
  dust: "#8a78c8", trail: "#ff2e88", spark: "#ffd166", shadow: "#000000",
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.75, 0.75, 0.35], amb: 0.52,
  sky0: "#ffb36b", sky1: "#ff8a6a", sky2: "#ffd29a", sun0: "#fff4c2", sun1: "#ffb35c", star: "#ffffff",
  sand: ["#f0aa72", "#e99a63", "#df8a57"], crest: "#f6be86", steep: "#c56e4b", track: "#c9794f", edge: "#fff1dc", lines: ["#c8643f", "#c8643f", "#b85434"], lineA: [0.28, 0.32, 0.38],
  plinth: "#7a4634", rim: "#ffe0b0", table: "#9c5f45", rock: "#a65b40", pylon: "#5b3a33", tip: "#ff5a3c", tip2: "#ffd25a",
  body: "#1c2a3c", accent: "#14b8c8", chassis: "#2a2a33", cage: "#2f3d50", tyre: "#1a1a20", hub: "#d9dbe6", helmet: "#ff5a3c", visor: "#11131c", lamp: "#fff7d6", tail: "#ff3b30",
  gNext: "#ff3d7f", gDone: "#13a9bb", gIdle: "#c79a82", gPost: "#5e3d36", check: "#fffaf0", ink: "#1b1420",
  dust: "#f7d6ae", trail: "#ff6a4d", spark: "#fff1a8", shadow: "#5a2a24",
};
// FX particles: x y z (in the pools), vx vy vz, life, max life, per pool.
const DUST = 90, TRAIL = 40, SPARK = 48;
const T_CARD = 1;

export type DuneScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; gate: number; lap: number; clock: number; crashes: number; score: number; combo: number; best: number; cleans: number; card: boolean; view: string; speed: number; air: number };
  /** Drive by itself (the poster, the tests). */
  auto: boolean;
  /** The buggy's screen point (CSS px from the stage's top left), as of the last draw. */
  carScreen(): [number, number];
  /** The run (the tests read it). */
  readonly run: ReturnType<typeof duneRun>;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): DuneScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: the canvas, the play surface over it (pointer + keyboard focus), the stickers, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "dh-play";
  play.setAttribute("aria-label", "Dune Hop: up or W for gas, down or S to brake, left and right to steer; in the air gas lifts the nose and brake dips it. R restarts, V changes the view, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "dh-hud";
  hud.innerHTML = `<div class="dh-head"><p class="dh-top"><b class="dh-chip dh-gate"><span>GATE 1/${GATES} · LAP 1/${LAPS}</span></b><b class="dh-chip dh-time"><span>0:00.0</span></b><b class="dh-chip dh-score"><span>0</span><i>×1</i></b></p><p class="dh-hint"></p></div><p class="dh-toast" hidden></p><p class="dh-live" aria-live="polite"></p><p class="dh-keys"><button type="button" class="dh-key dh-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="dh-key dh-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="dh-card" role="dialog" aria-label="Run finished" hidden><b>FINISH</b><p class="dh-t"></p><p class="dh-stats"></p><button type="button" class="bui-key dh-again">RUN AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, card = hud.children[4] as HTMLElement;
  const gateEl = top.children[0]!.firstChild as HTMLElement, timeEl = top.children[1]!.firstChild as HTMLElement;
  const scoreEl = top.children[2]!.firstChild as HTMLElement, comboEl = top.children[2]!.lastChild as HTMLElement;
  const viewK = keysEl.children[0] as HTMLButtonElement, muteK = keysEl.children[1] as HTMLButtonElement;
  const cardT = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement, again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", gate: "power", clean: "power", sketchy: "click", crash: "boom", respawn: "ready", finish: "win" }, volume: 0.1 });
  const c = controls(engine, { keys: { left: [], right: [], gas: [], brake: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake");
  const thePad = pad(engine, c, {
    scheme: "buttons",
    move: ["", "", "left", "right"],
    actions: [
      { intent: "gas", label: "GAS", name: "Gas (up arrow)", key: "↑", role: "go", hold: true },
      { intent: "brake", label: "BRAKE", name: "Brake (down arrow)", key: "↓", role: "attack", hold: true },
    ],
    host: stage,
  });
  thePad.el.classList.add("dh-pad");
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the run and the diorama ----
  const run = duneRun(), v = run.v, t = run.t;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  let tv: TerrainView, car: DioramaObject, dust: DioramaPoints, spark: DioramaPoints;
  const hubs: DioramaObject[] = [], gates: DioramaObject[][] = [], tails: DioramaObject[] = [];
  // Particle velocities and lives, per pool: vx vy vz life max.
  const DV = new Float64Array(DUST * 5), SV = new Float64Array(SPARK * 5);
  // The tail lights' trail: the last TRAIL positions of each light (a ring), and its head and length.
  const TR = new Float64Array(TRAIL * 6), TRN = new Int32Array(2);
  const EDGE = trackEdges(t), LINES = contours(t, [0.95, 1.5, 2.0]);
  const rnd = seeded(20261109);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS[i] = rnd();

  function buildScene() {
    dio.clear();
    hubs.length = gates.length = tails.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("table", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    // The table and the plinth the course sits on, a bright rim round its top.
    dio.add({ id: "table", size: [HX * 2 + 7, 0.5, HZ * 2 + 6], pos: [0, -1.55, 0.6], color: P.table, cluster: "table", layer: 0, pick: false });
    dio.add({ id: "plinth", size: [HX * 2 + 0.5, 1.05, HZ * 2 + 0.5], pos: [0, -1.05, 0], color: P.plinth, cluster: "table", layer: 1, pick: false });
    dio.add({ id: "rim", size: [HX * 2 + 0.7, 0.12, HZ * 2 + 0.7], pos: [0, -0.2, 0], color: P.rim, cluster: "table", layer: 2, emissive: true, pick: false });
    tv = terrainView(dio, t, {
      bands: [[0.55, P.sand[0]!], [1.15, P.sand[1]!], [1.85, P.sand[2]!], [99, P.crest]], steep: 0.42, steepColor: P.steep, kinds: [P.track],
      light: P.light, ambient: P.amb, lod: [26, 46], shadows: 2, shadowColor: P.shadow,
    });
    // Over the sand: the dunes' contour lines (neon at night), then the track's two edges.
    dio.decal("terrain", 1, paintLines);
    // Rocks off the track and neon pylons along it.
    const r = seeded(7);
    for (let k = 0, n = 0; k < 200 && n < 16; k++) {
      const x = (r() * 2 - 1) * (HX - 1.2), z = (r() * 2 - 1) * (HZ - 1.2);
      if (trackDist(x, z) < TRACK_W + 1.2) continue;
      const s = 0.35 + r() * 0.5;
      dio.add({ shape: "cyl", sides: 5 + (n % 3), top: 0.45, size: [s * 1.6, s, s * 1.3], pos: [x, t.height(x, z) - 0.05, z], rot: [0, r() * TAU, 0], color: P.rock, pick: false });
      n++;
    }
    for (let i = 3; i < NT; i += 8) {
      const yaw = trackYaw(i), side = (i >> 3) & 1 ? 1 : -1, nx = Math.sin(yaw) * side, nz = Math.cos(yaw) * side;
      const x = TRACK[i * 2]! + nx * (TRACK_W / 2 + 0.75), z = TRACK[i * 2 + 1]! + nz * (TRACK_W / 2 + 0.75), id = "py" + i;
      dio.add({ id, shape: "group", size: [0.3, 0, 0.3], pos: [x, t.height(x, z), z], pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.16, 0.9, 0.16], on: id, color: P.pylon, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.22, 0.16, 0.22], pos: [0, 0.9, 0], on: id, color: side > 0 ? P.tip : P.tip2, emissive: true, pick: false });
    }
    // The gates: two posts and a bar across the track; gate 0 is the chequered start and finish.
    for (let g = 0; g < GATES; g++) {
      const i = GATE_AT[g]!, x = TRACK[i * 2]!, z = TRACK[i * 2 + 1]!, id = "gate" + g, w = TRACK_W + 1.1;
      dio.add({ id, shape: "group", size: [0.6, 0, w], pos: [x, t.height(x, z), z], rot: [0, trackYaw(i), 0], pick: false });
      const a = dio.add({ shape: "cyl", sides: 8, size: [0.24, 2.5, 0.24], pos: [0, 0, -w / 2], on: id, color: P.gIdle, emissive: true, pick: false });
      const b = dio.add({ shape: "cyl", sides: 8, size: [0.24, 2.5, 0.24], pos: [0, 0, w / 2], on: id, color: P.gIdle, emissive: true, pick: false });
      const bar = dio.add({ size: [0.3, 0.32, w + 0.24], pos: [0, 2.5, 0], on: id, color: P.gIdle, emissive: true, pick: false });
      for (const zz of [-w / 2, w / 2]) dio.add({ shape: "cyl", sides: 8, size: [0.5, 0.14, 0.5], pos: [0, -0.02, zz], on: id, color: P.gPost, pick: false });
      gates.push([a, b, bar]);
      if (!g) for (let k = 0; k < 8; k++) dio.add({ size: [0.32, 0.16, w / 8], pos: [0, 2.5 + (k & 1 ? 0 : 0.16), -w / 2 + (k + 0.5) * (w / 8)], on: id, color: k & 1 ? P.ink : P.check, pick: false, layer: 9 });
      dio.decal(id, 20, (ctx) => glow(ctx, g));
    }
    // The buggy: a group the run drives; tub, nose, cage, driver, engine, lights; four wheels on hubs.
    car = dio.add({ id: "car", shape: "group", size: [2.0, 0, 1.3], tag: { car: 1 } });
    const part = (size: number[], pos: number[], color: string, o: { shape?: "box" | "wedge" | "cyl"; emissive?: boolean; sides?: number; top?: number; rot?: number[] } = {}) =>
      dio.add({ shape: o.shape || "box", size, pos, rot: o.rot, on: "car", color, emissive: o.emissive, sides: o.sides, top: o.top, pick: false });
    part([1.8, 0.16, 0.8], [0, -0.24, 0], P.chassis);
    part([1.12, 0.32, 0.84], [-0.14, -0.08, 0], P.body);
    part([0.66, 0.28, 0.8], [0.74, -0.1, 0], P.body, { shape: "wedge" });
    part([1.16, 0.07, 0.88], [-0.14, 0.22, 0], P.accent);
    part([0.44, 0.36, 0.62], [-0.82, -0.06, 0], P.chassis);
    part([0.12, 0.34, 0.12], [-0.94, 0.3, 0.2], P.hub, { shape: "cyl", sides: 6 });
    part([0.1, 0.22, 0.42], [-0.44, 0.24, 0], P.accent);
    part([0.32, 0.3, 0.32], [-0.22, 0.26, 0], P.helmet, { shape: "cyl", sides: 8, top: 0.75 });
    part([0.06, 0.1, 0.24], [-0.07, 0.34, 0], P.visor);
    for (const x of [-0.52, 0.12]) for (const zz of [-0.37, 0.37]) part([0.06, 0.62, 0.06], [x, 0.24, zz], P.cage);
    for (const zz of [-0.37, 0.37]) part([0.7, 0.06, 0.06], [-0.2, 0.86, zz], P.cage);
    part([0.06, 0.06, 0.8], [-0.52, 0.86, 0], P.cage);
    part([0.12, 0.09, 0.62], [0.12, 0.88, 0], P.lamp, { emissive: true });
    for (const zz of [-0.26, 0.26]) part([0.04, 0.07, 0.18], [1.08, -0.04, zz], P.lamp, { emissive: true });
    for (const zz of [-0.25, 0.25]) tails.push(part([0.05, 0.09, 0.16], [-1.05, 0.1, zz], P.tail, { emissive: true }));
    for (let i = 0; i < 4; i++) {
      const hub = dio.add({ id: "hub" + i, shape: "group", size: [0.6, 0, 0.6], on: "car" }), side = v.wheels[i * 2 + 1]! > 0 ? 1 : -1;
      dio.add({ shape: "cyl", sides: 12, size: [0.68, 0.3, 0.68], pos: [0, 0, -0.15], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: P.tyre, pick: false });
      dio.add({ shape: "cyl", sides: 8, size: [0.38, 0.04, 0.38], pos: [0, 0, side > 0 ? 0.15 : -0.19], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: P.hub, pick: false });
      dio.add({ size: [0.36, 0.06, 0.06], pos: [0, -0.03, side > 0 ? 0.19 : -0.2], on: "hub" + i, color: P.chassis, pick: false });
      hubs.push(hub);
    }
    dust = dio.points({ cap: DUST, color: P.dust, layer: 4 });
    dio.decal("car", 4, paintTrail);
    spark = dio.points({ cap: SPARK, color: P.spark, layer: 6 });
    sky = null;
    paintGates();
    pose();
  }

  // ---- state ----
  const I = new Float64Array(3), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // Pointer drive: down, start x, current x, id.
  const PD = new Float64Array(4);
  PD[3] = -1;
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once.
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  let view = 1, auto = false, dirty = true, hudDirty = true, shake = 0, flash = -1, flashT = 0, dropT = 0, toastT = 0, bestTime = 0, emitK = 0, cardAt = -1, pulse = 0;
  const TT = new Float64Array(4), TF = new Uint8Array(4);
  const was = new Float64Array(8).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.82, dist: 34, tx: 0, ty: 0, tz: 0.4, ox: 0, oy: 0, fov: 0.62 };
  const chaseO = { dist: 12.5, pitch: 0.55, lift: 0.9, ahead: 0.22, rate: 3.2, turn: 2.6 };
  const CTP = new Float64Array(3), carTarget = { pos: CTP, yaw: 0, vel: v.vel };
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  function later(sec: number, what: number) {
    for (let k = 0; k < 4; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05));
  }

  function pose() {
    car.pos.set(run.pos);
    car.rot.set(run.rot);
    if (dropT > 0) car.pos[1] = car.pos[1]! + dropT * dropT * 3;
    const tum = run.S[0] === CRASH;
    for (let i = 0; i < 4; i++) {
      const h = hubs[i]!;
      h.pos[0] = v.wheels[i * 2]!;
      h.pos[1] = tum ? -0.2 : -(v.rest - v.comp[i]!);
      h.pos[2] = v.wheels[i * 2 + 1]!;
      h.rot[1] = i < 2 && !tum ? -v.steerAngle : 0;
      h.rot[2] = -v.spin[i]!;
    }
    const x = run.pos[0]!, z = run.pos[2]!, inside = Math.abs(x) < HX && Math.abs(z) < HZ, lift = inside ? run.pos[1]! - t.height(x, z) : 9;
    tv.shadow(0, x, z, 1.25, inside ? Math.max(0, 0.34 - lift * 0.1) : 0);
  }
  function paintGates() {
    const next = run.S[2]! % GATES, ph = run.S[0]!;
    for (let g = 0; g < GATES; g++) {
      const parts = gates[g]!, on = ph !== DONE && g === next, col = flash === g ? P.check : on ? P.gNext : run.passed[g] && ph !== READY ? P.gDone : P.gIdle;
      for (let k = 0; k < 3; k++) (parts[k]!.color = col), (parts[k]!.emissive = P.night || on || flash === g);
    }
  }

  // ---- FX ----
  function puff(pool: DioramaPoints, VV: Float64Array, cap: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, a: number) {
    let j = pool.n < cap ? pool.n++ : -1;
    if (j < 0) {
      // The oldest (least life left) makes room.
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
      pool.y[i] = pool.y[i]! + VV[i * 5 + 1]! * dt;
      pool.z[i] = pool.z[i]! + VV[i * 5 + 2]! * dt;
      VV[i * 5] = VV[i * 5]! * (1 - 1.6 * dt);
      VV[i * 5 + 2] = VV[i * 5 + 2]! * (1 - 1.6 * dt);
      pool.r[i] = pool.r[i]! + grow * dt;
      pool.a[i] = nl > 0 ? a0 * (nl / VV[i * 5 + 4]!) : 0;
      if (nl > 0) live++;
    }
    return live > 0;
  }
  function burst(x: number, y: number, z: number, n: number, sp: number) {
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, u = 0.4 + rnd();
      puff(spark, SV, SPARK, x, y, z, Math.cos(a) * sp * u, 2 + rnd() * sp, Math.sin(a) * sp * u, 0.5 + rnd() * 0.5, 0.07, 1);
    }
  }
  function dustBurst(x: number, y: number, z: number, n: number) {
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU;
      puff(dust, DV, DUST, x + Math.cos(a) * 0.6, y, z + Math.sin(a) * 0.6, Math.cos(a) * 2.2, 0.6 + rnd(), Math.sin(a) * 2.2, 0.7 + rnd() * 0.5, 0.22, 0.6);
    }
  }
  function stepFx(dt: number) {
    const ph = run.S[0]!;
    // Dust from the rear wheels by how hard they dig; the tail lights leave a trail while it moves.
    if (ph !== CRASH) {
      const d = v.dust;
      emitK += d * 70 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        const w = 2 + (rnd() < 0.5 ? 1 : 0);
        puff(dust, DV, DUST, v.wheel[w * 3]! + (rnd() - 0.5) * 0.3, v.wheel[w * 3 + 1]! - 0.2, v.wheel[w * 3 + 2]! + (rnd() - 0.5) * 0.3, -v.vel[0]! * 0.15 + (rnd() - 0.5), 0.5 + rnd() * 0.6, -v.vel[2]! * 0.15 + (rnd() - 0.5), 0.6 + rnd() * 0.5, 0.1, 0.42);
      }
    }
    // The trail: each step, the lights' newest point in; it shortens to nothing when the buggy stops.
    const go = ph !== CRASH && (v.groundSpeed > 1.2 || v.air > 0);
    if (go) {
      const h = (TRN[0] = (TRN[0]! + 1) % TRAIL);
      for (let k = 0; k < 2; k++) {
        const m = tails[k]!.M, o = h * 6 + k * 3;
        TR[o] = m[9]! - m[0]! * 0.03; TR[o + 1] = m[10]! + 0.03; TR[o + 2] = m[11]! - m[6]! * 0.03;
      }
      TRN[1] = Math.min(TRAIL, TRN[1]! + 1);
    } else if (TRN[1]! > 0) TRN[1] = TRN[1]! - 1;
    let any = stepPool(dust, DV, dt, -0.4, 0.22, 0.3);
    if (TRN[1]! > 0) any = true;
    if (stepPool(spark, SV, dt, 14, -0.05, 1)) any = true;
    return any;
  }

  // ---- events from the run: stickers, sound, FX ----
  const CUE = ["", "gate", "", "crash", "respawn", "finish", "", "start"];
  function events() {
    for (let k = 0; k < run.n; k++) {
      const type = run.ev[k * 2]!, val = run.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) setView(1), engine.events.emit("start"), toast("GO!", "go");
      else if (type === E_GATE) {
        engine.events.emit("gate");
        flash = val;
        flashT = 0.25;
        const parts = gates[val]!, m = parts[2]!.M;
        burst(m[9]!, m[10]! + 0.2, m[11]!, 14, 3);
        if (!val) toast(`LAP ${run.S[11]! + 1} OF ${LAPS}`, "go"), say(`Lap ${run.S[11]! + 1}`);
      } else if (type === E_LAND) {
        const S = run.sc.S, clean = val === CLEAN;
        engine.events.emit(clean ? "clean" : "sketchy");
        toast(`${S[AIR]!.toFixed(2)}s AIR · ${clean ? "CLEAN" : "SKETCHY"} +${S[PTS]}${clean && S[CB]! > 1 ? ` · COMBO ×${S[CB]}` : ""}`, clean ? "clean" : "meh");
        dustBurst(run.pos[0]!, run.pos[1]! - 0.5, run.pos[2]!, clean ? 8 : 14);
      } else if (type === E_CRASH) {
        engine.events.emit("crash");
        shake = 0.5;
        burst(run.pos[0]!, run.pos[1]!, run.pos[2]!, 26, 5);
        dustBurst(run.pos[0]!, run.pos[1]! - 0.4, run.pos[2]!, 20);
        toast(val ? "OFF THE TABLE!" : "WIPEOUT", "bad");
        say(val ? "Off the table" : "Wipeout");
      } else if (type === E_RESPAWN) {
        engine.events.emit("respawn");
        dropT = 0.45;
        CTP.set(run.pos);
        chase(dio.cam, carTarget, { ...chaseO, snap: view === 1 }, 1 / 60);
        toast(val ? `BACK AT GATE ${val}` : "BACK AT THE START", "go");
      } else if (type === E_FINISH) {
        engine.events.emit("finish");
        burst(run.pos[0]!, run.pos[1]! + 1, run.pos[2]!, 30, 4);
        later(1.1, T_CARD);
        say("Finish");
      }
    }
    run.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "dh-toast dh-" + kind;
    toastEl.hidden = false;
    toastT = 1.6;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  const clock = (s: number) => `${(s / 60) | 0}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  function hudWrite() {
    const S = run.S, ph = S[0]!, g = Math.min(GATES, (S[2]! - 1) % GATES + 1), lap = Math.min(LAPS, S[11]! + 1);
    const nextG = ph === DONE ? GATES : S[2]! % GATES === 0 ? GATES : S[2]! % GATES;
    if (was[0] !== nextG || was[1] !== lap) (was[0] = nextG), (was[1] = lap), (gateEl.textContent = ph === DONE ? "FINISHED" : nextG === GATES ? `FINISH · LAP ${lap}/${LAPS}` : `GATE ${nextG}/${GATES} · LAP ${lap}/${LAPS}`);
    const tenths = Math.floor(S[1]! * 10);
    if (was[2] !== tenths) (was[2] = tenths), (timeEl.textContent = clock(tenths / 10));
    const sc = run.sc.S[SC]!;
    if (was[3] !== sc) (was[3] = sc), (scoreEl.textContent = sc.toLocaleString("en-US"));
    const cb = run.sc.S[CB]!;
    if (was[4] !== cb) (was[4] = cb), (comboEl.textContent = "×" + (1 + cb)), comboEl.classList.toggle("dh-hot", cb > 0);
    const hint = ph === READY ? (thePad.el.offsetParent ? "Hold GAS to go · ◀ ▶ steer · in the air GAS lifts the nose" : "↑ gas · ← → steer · ↓ brake · in the air ↑ lifts the nose, ↓ dips it") : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
    void g;
  }
  function showEnd() {
    const S = run.S, sc = run.sc.S, time = S[1]!, best = !bestTime || time < bestTime;
    if (best) bestTime = time;
    cardT.textContent = clock(time) + (best ? " · BEST" : ` · best ${clock(bestTime)}`);
    cardS.textContent = `${sc[SC]!.toLocaleString("en-US")} pts · best air ${sc[BEST]!.toFixed(2)}s · ${sc[CLEANS]} clean · top combo ×${1 + sc[TOP]!} · ${S[4]} ${S[4] === 1 ? "crash" : "crashes"}`;
    card.hidden = false;
    setView(0);
    say(`Finished in ${clock(time)}, ${sc[SC]} points`);
    again.focus({ preventScroll: true });
  }
  function restart() {
    run.reset();
    card.hidden = true;
    PD[0] = 0;
    shake = dropT = 0;
    flash = -1;
    dust.n = spark.n = TRN[1] = 0;
    setView(0);
    was.fill(-1);
    hudDirty = dirty = true;
    paintGates();
    pose();
    engine.busy(2);
    play.focus({ preventScroll: true });
  }

  // ---- camera: the table view (the whole course framed) or the chase view behind the buggy ----
  function frameTable() {
    const pts = [-HX - 0.4, -1.1, -HZ - 0.4, HX + 0.4, -1.1, -HZ - 0.4, -HX - 0.4, -1.1, HZ + 0.4, HX + 0.4, -1.1, HZ + 0.4, -HX, 2.6, -HZ, HX, 2.6, -HZ];
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.5 : 0;
    TABLE.pitch = tall ? 0.95 : 0.8;
    TABLE.dist = 30;
    TABLE.tx = TABLE.ty = TABLE.ox = TABLE.oy = 0;
    TABLE.tz = 0.4;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
    chaseO.dist = tall ? 15 : 12.5;
    chaseO.pitch = tall ? 0.66 : 0.55;
  }
  function stepCam(dt: number) {
    const cam = dio.cam;
    carTarget.yaw = v.yaw;
    // Off the table: the camera stays at its edge and watches it go.
    CTP[0] = Math.max(-HX - 1, Math.min(HX + 1, run.pos[0]!));
    CTP[1] = Math.max(-1, run.pos[1]!);
    CTP[2] = Math.max(-HZ - 1, Math.min(HZ + 1, run.pos[2]!));
    if (view) {
      const m = chase(cam, carTarget, chaseO, dt), k = 1 - Math.exp(-4 * dt);
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

  // ---- drawing extras: the sky (a backdrop behind the table), gate glows, the next gate's marker ----
  function paintSky(ctx: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height;
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.55, P.sky1);
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
    // The sun, low over the far edge, cut by bands (night: a neon one).
    const r = Math.min(W, H) * 0.16, x = W * 0.74, y = H * 0.3;
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, P.sun0);
    g.addColorStop(1, P.sun1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = P.sky1;
    for (let k = 0; k < 5; k++) ctx.fillRect(x - r, y + r * (0.1 + k * 0.19), r * 2, r * (0.03 + k * 0.025));
    ctx.restore();
  }
  /** The contour lines (one path per level, a thin line), then the track's edges, wider near. */
  function paintLines(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    ctx.lineWidth = P.night ? 1.3 : 1;
    for (let l = 0; l < LINES.length; l++) {
      const S = LINES[l]!;
      ctx.beginPath();
      for (let k = 0; k < S.length; k += 6) {
        if (!dio.project(S[k]!, S[k + 1]!, S[k + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(S[k + 3]!, S[k + 4]!, S[k + 5]!, tmp2) || tmp2[2]! < 0.5) continue;
        ctx.moveTo(tmp[0]!, tmp[1]!);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
      }
      ctx.strokeStyle = P.lines[l]!;
      ctx.globalAlpha = P.lineA[l]!;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.edge;
    const f = dio.focal();
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < NT; i++) {
        const a = side * NT * 3 + i * 3, b = side * NT * 3 + ((i + 1) % NT) * 3;
        if (!dio.project(EDGE[a]!, EDGE[a + 1]!, EDGE[a + 2]!, tmp) || tmp[2]! < 0.5 || !dio.project(EDGE[b]!, EDGE[b + 1]!, EDGE[b + 2]!, tmp2) || tmp2[2]! < 0.5) continue;
        ctx.lineWidth = Math.max(1, (f * 0.2) / tmp[2]!);
        ctx.beginPath();
        ctx.moveTo(tmp[0]!, tmp[1]!);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
      }
  }
  /** The tail lights' trail: two lines, fading toward the tail end. */
  function paintTrail(ctx: CanvasRenderingContext2D) {
    const n = TRN[1]!;
    if (n < 2) return;
    ctx.strokeStyle = P.trail;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    if (P.night) ctx.globalCompositeOperation = "lighter";
    const f = dio.focal(), C = 5;
    // In C runs, each one polyline with its own alpha and width (fading and thinning to the tail end).
    for (let k = 0; k < 2; k++)
      for (let c = 0; c < C; c++) {
        const s0 = Math.floor(((n - 1) * c) / C), s1 = Math.floor(((n - 1) * (c + 1)) / C);
        let started = false, w = 0;
        ctx.beginPath();
        for (let s = s0; s <= s1; s++) {
          const a = ((TRN[0]! - s + TRAIL) % TRAIL) * 6 + k * 3;
          if (!dio.project(TR[a]!, TR[a + 1]!, TR[a + 2]!, tmp) || tmp[2]! < 0.5) continue;
          if (!started) (w = Math.max(1, (f * 0.09) / tmp[2]!)), ctx.moveTo(tmp[0]!, tmp[1]!), (started = true);
          else ctx.lineTo(tmp[0]!, tmp[1]!);
        }
        ctx.globalAlpha = 0.95 * (1 - c / C);
        ctx.lineWidth = w * (1 - (c / C) * 0.6);
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function glow(ctx: CanvasRenderingContext2D, g: number) {
    if (!P.night) return;
    const next = run.S[2]! % GATES, on = run.S[0] !== DONE && g === next;
    if (!on && flash !== g) return;
    const m = gates[g]![2]!.M, w = (TRACK_W + 1.1) / 2;
    // The frame's three lines, from the bar's ends down the posts.
    const ax = m[9]! - m[2]! * w, az = m[11]! - m[8]! * w, bx = m[9]! + m[2]! * w, bz = m[11]! + m[8]! * w, y0 = m[10]! - 2.5, y1 = m[10]! + 0.16;
    if (!dio.project(ax, y0, az, tmp) || !dio.project(bx, y0, bz, tmp2)) return;
    ctx.beginPath();
    ctx.moveTo(tmp[0]!, tmp[1]!);
    dio.project(ax, y1, az, tmp);
    ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(bx, y1, bz, tmp);
    ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.lineTo(tmp2[0]!, tmp2[1]!);
    const k = dio.focal() / Math.max(1, tmp2[2]!), a = on ? 0.5 + 0.25 * Math.sin(pulse * 6) : 0.8;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = flash === g ? P.check : P.gNext;
    ctx.lineJoin = "round";
    ctx.globalAlpha = a * 0.22;
    ctx.lineWidth = k * 0.55;
    ctx.stroke();
    ctx.globalAlpha = a * 0.35;
    ctx.lineWidth = k * 0.26;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const ph = run.S[0]!;
    if (ph === DONE) return;
    const g = run.S[2]! % GATES, m = gates[g]![2]!.M;
    if (!dio.project(m[9]!, m[10]! + 1.05, m[11]!, tmp) || tmp[1]! < V[3]! - 4) return;
    const x = tmp[0]!, y = tmp[1]!, s = Math.max(0.7, Math.min(1.25, dio.focal() / Math.max(1, tmp[2]!) / 30)), label = g ? "" + g : run.S[2]! >= GATES * LAPS ? "★" : "0";
    // A Board UI sticker: rounded plate, ink rim, hard shadow, a point under it.
    const w = 26 * s, h = 22 * s;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 3 * s, y - h + 3 * s, w, h, 6 * s);
    ctx.fill();
    ctx.fillStyle = P.gNext;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h, w, h, 6 * s);
    ctx.moveTo(x - 5 * s, y);
    ctx.lineTo(x, y + 6 * s);
    ctx.lineTo(x + 5 * s, y);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.night ? P.ink : "#ffffff";
    ctx.font = `900 ${Math.round(13 * s)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y - h / 2 + 0.5);
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
        // The canvas's box from the stage's sheet (shorter on a tall stage, over the pad); bare, the stage.
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        dio.resize(cr.width || 1, cr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = Math.max(8, hr.bottom - sr.top + 8);
        V[4] = 10;
        sky = null;
        frameTable();
        if (!view) Object.assign(dio.cam, TABLE);
        hudDirty = dirty = true;
      }
      if (first && V[5]) (first = null), play.focus({ preventScroll: true });
    },
    step(e, dt) {
      if (TF[0] && e.time >= TT[0]!) (TF[0] = 0), showEnd();
      // Inputs: keys and pad (controls), the pointer (hold for gas, drag to steer), or the autopilot.
      if (auto) run.autopilot(I);
      else {
        I[0] = c.down(GAS) || PD[0] ? 1 : 0;
        I[1] = c.down(BRAKE) ? 1 : 0;
        I[2] = PD[0] ? Math.max(-1, Math.min(1, (PD[2]! - PD[1]!) / Math.max(40, dio.width * 0.1))) : c.axis("left", "right");
      }
      if (!card.hidden) I[0] = I[1] = I[2] = 0;
      let moving = run.step(dt, I[0]!, I[1]!, I[2]!);
      if (run.n) events(), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (dropT > 0) (dropT = Math.max(0, dropT - dt)), (moving = true);
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (flashT > 0 && (flashT -= dt) <= 0) (flash = -1), paintGates(), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      // The next gate breathes while anything moves.
      if (moving) (pulse += dt), e.busy(), (dirty = true);
      if (hudDirty || moving) hudDirty = true;
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite(), paintGates();
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
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyV") return void (e.preventDefault(), setView(view ? 0 : 1));
    if (e.code === "KeyR") return void (e.preventDefault(), restart());
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
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
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!card.hidden) return;
    play.setPointerCapture(e.pointerId);
    auto = false;
    (PD[0] = 1), (PD[1] = PD[2] = e.offsetX), (PD[3] = e.pointerId);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => void (e.pointerId === PD[3] && (PD[2] = e.offsetX)), sig);
  const up = (e: PointerEvent) => void (e.pointerId === PD[3] && ((PD[0] = 0), (PD[3] = -1)));
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  muteK.addEventListener("click", toggle, sig);
  viewK.addEventListener("click", () => setView(view ? 0 : 1), sig);
  again.addEventListener("click", restart, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  // The poster (scripts/gallery-posters.mjs): mid-air off the first kicker, the trail behind it.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    auto = true;
    const i = 10, yaw = trackYaw(i);
    v.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, yaw);
    v.vel[0] = Math.cos(yaw) * 9.6;
    v.vel[2] = -Math.sin(yaw) * 9.6;
    run.S[0] = RUN;
    run.S[2] = 2;
    run.S[3] = 1;
    run.S[7] = i;
    run.passed[1] = 1;
    run.pos.set(v.pos);
    run.rot.set(v.rot);
    view = 1;
    carTarget.yaw = yaw;
    CTP.set(run.pos);
    chase(dio.cam, carTarget, { ...chaseO, snap: true });
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
      const S = run.S, sc = run.sc.S;
      return { phase: S[0]!, gate: S[2]!, lap: S[11]!, clock: S[1]!, crashes: S[4]!, score: sc[SC]!, combo: sc[CB]!, best: sc[BEST]!, cleans: sc[CLEANS]!, card: !card.hidden, view: view ? "chase" : "table", speed: v.speed, air: v.air };
    },
    carScreen() {
      dio.project(run.pos[0]!, run.pos[1]!, run.pos[2]!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    run,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the buggy in the air off the first kicker (scripts/gallery-posters.mjs). */
export const posterAt = 1.05;
