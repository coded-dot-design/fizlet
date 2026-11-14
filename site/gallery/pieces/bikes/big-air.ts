// "Big Air" (hero): a freestyle motocross show on a tabletop. An oval of packed dirt in a little
// arena: two big steel kickers, each throwing you over a gap onto a dirt landing, a crowd stand along
// the far side; at night (dark) the steel glows with neon and the stand twinkles, by day (light) it
// is pastel low-poly. Pick the bike (the 2-STROKE is light and turns over quickly in the air, the
// 4-STROKE heavy and steady: slow to flip), then a minute: gas starts the clock. In the air hold TRICK
// (L or E) and the stick picks a trick (none: SKY PLANK, forward: LANTERN, back: CANNONBALL, side:
// PIXEL SPLIT); with no trick the stick pitches the bike (weight back all the way: a flip). Put the
// trick away and land on the down ramp, clean, to score; clean landings in a row build the combo; land
// with the trick out and it is a bail. At the end five judges score the run.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama, @fzlt/core/terrain, @fzlt/core/drive (its `chase` camera),
// @fzlt/core/input + @fzlt/core/pad, @fzlt/core/slot, @fzlt/core/sound. The bike is ./bike.ts, drawn
// by ./rig.ts; the tricks are ./tricks.ts (a brick candidate); the run is ./air-show.ts, headless
// (tests/big-air.test.mjs); this file is the scene (tests/big-air.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama } from "../../../../src/diorama";
import { terrainView, type TerrainView } from "../../../../src/terrain";
import { chase } from "../../../../src/drive";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { FOUR_STROKE, TWO_STROKE, LOOP, ENDO, CASE, BAIL, type Power } from "./bike";
import { rig, type Rig, type RigColors } from "./rig";
import { pool, voice, gamepad, type Pool } from "./kit";
import { TRICKS, CLEAN, SC, CB, PTS, LFLIPS, AIRT, BEST, FLIPS, CLEANS, CRASHES, JUMPS, SEEN } from "./tricks";
import { DONE, E_CRASH, E_END, E_LAND, E_RESPAWN, E_START, E_TRICK, HX, HZ, KICK, KICK_L, LAP, NT, PICK, READY, RUN, RUN_T, TRACK, TRACK_W, TURN, YAW, airShow, trackEdges } from "./air-show";

const TAU = 6.283185307179586;
type Kit = Omit<RigColors, "plastic" | "plastic2" | "jersey" | "pants" | "helmet" | "stripe" | "plate" | "ink">;
// The palettes by role: a neon night show (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.4, 1, 0.55], amb: 0.44,
  sky0: "#05061a", sky1: "#170c38", sky2: "#3b1258", star: "#cfd8ff", grid: "#3b2a7a",
  ground: ["#0d1530", "#111b3b", "#152046"], crest: "#1a2a58", steep: "#0a1128", track: "#33244b", steel: "#5b6a9a", land: "#3d2a5a", edge: "#22e6ff", edge2: "#ff4fa8",
  plinth: "#120f26", rim: "#ff4fa8", table: "#0a0918", stand: "#1c1838", seat: "#2a2550", fans: ["#22e6ff", "#ff4fa8", "#ffd166", "#b6ff3b"], tower: "#24203f", lamp: "#fff2c2",
  ink: "#0b0a14", dust: "#7c68c4", spark: "#ffd166", shadow: "#000000", hot: "#ff4fa8", ok: "#22e6ff", meter: "#16132b",
  kit: { seat: "#14121f", frame: "#2b2a3d", tyre: "#0f0f16", rim: "#9aa0c8", metal: "#c9cde6", pipe: "#7e86a8", visor: "#0a0c16", boots: "#e9ecff", gloves: "#14121f", glow: "#ff2e88" } as Kit,
  team: { plastic: "#ff4fa8", plastic2: "#eef0ff", jersey: "#ff4fa8", pants: "#1b1a2c", helmet: "#eef0ff", stripe: "#22e6ff", plate: "#eef0ff", ink: "#0b0a14" },
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.6, 1, 0.45], amb: 0.54,
  sky0: "#ffd7c2", sky1: "#ffe8d6", sky2: "#fff6e8", star: "#ffffff", grid: "#ffffff",
  ground: ["#b8e2c4", "#a9d8b6", "#9ccfab"], crest: "#c6ebd0", steep: "#8dc39d", track: "#ddb184", steel: "#b9c3dc", land: "#e8c398", edge: "#fff5e6", edge2: "#ff7a59",
  plinth: "#c98f6a", rim: "#fff0dc", table: "#f0d2b4", stand: "#e9e2f5", seat: "#cfc4e6", fans: ["#13a9bb", "#ff7a59", "#f2b33d", "#7cc93a"], tower: "#8a8fb0", lamp: "#ffe9a8",
  ink: "#1b1420", dust: "#e9c39a", spark: "#fff1a8", shadow: "#5a3a2a", hot: "#ff4f6d", ok: "#13a9bb", meter: "#ffffff",
  kit: { seat: "#2a2833", frame: "#3a3a4c", tyre: "#24232b", rim: "#d9dbe6", metal: "#eceef7", pipe: "#9aa0b8", visor: "#1b1d2a", boots: "#ffffff", gloves: "#2a2833", glow: "#ff3b30" },
  team: { plastic: "#ff7a59", plastic2: "#ffffff", jersey: "#ff7a59", pants: "#2c3550", helmet: "#ffffff", stripe: "#13a9bb", plate: "#ffffff", ink: "#1b1420" },
};
const DUST = 120, SPARK = 60, FANS = 160;
const BIKES: Power[] = [TWO_STROKE, FOUR_STROKE];
const CRASH_NAME: Record<number, string> = { [LOOP]: "LOOPED IT!", [ENDO]: "NOSED IN!", [CASE]: "CASED IT!", [BAIL]: "BAILED!", 5: "WIPEOUT!" };
const KEYS_HINT = "In the air: L + stick for a trick · S held for a flip";

export type AirScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; clock: number; score: number; combo: number; trick: number; air: number; crashes: number; jumps: number; bike: string; card: boolean; pick: boolean; view: string; judges: number };
  auto: boolean;
  pick(i: number): void;
  readonly show: ReturnType<typeof airShow>;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): AirScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 20261120 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  void slot;

  // ---- the page ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ba-play";
  play.setAttribute("aria-label", "Big Air: Space or J for gas, K or Shift to brake, W and S (or up and down) shift your weight (in the air: pitch, all the way back for a flip), A and D steer; in the air hold L or E for a trick, the stick picks which. V changes the view, M mutes, R restarts");
  const hud = L.add(document.createElement("div"));
  hud.className = "ba-hud";
  const bikeBtn = (i: number, name: string, blurb: string, s: number[]) =>
    `<button type="button" class="ba-bike" data-b="${i}" aria-label="${name}: ${blurb} (${i + 1})"><b>${name}</b><small>${blurb}</small><span class="ba-stats">${["FLIP SPEED", "HANG", "WEIGHT", "STABILITY"].map((l, k) => `<i style="--v:${s[k]}"><em>${l}</em></i>`).join("")}</span><kbd>${i + 1}</kbd></button>`;
  hud.innerHTML = `<div class="ba-head"><p class="ba-top"><b class="ba-chip ba-score"><span>0</span><i>×1</i></b><b class="ba-chip ba-time"><span>1:00</span></b><b class="ba-chip ba-ride"><span>2-STROKE</span></b></p><p class="ba-hint"></p></div><p class="ba-toast" hidden></p><p class="ba-live" aria-live="polite"></p><p class="ba-keys"><button type="button" class="ba-key ba-view" aria-label="Camera view (V)">VIEW</button><button type="button" class="ba-key ba-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="ba-pick" role="dialog" aria-label="Pick your bike"><b>BIG AIR · PICK YOUR BIKE</b><div class="ba-bikes">${bikeBtn(0, "2-STROKE", "Light: turns over quickly in the air. Flips come easy, landings come fast.", [5, 3, 1, 2])}${bikeBtn(1, "4-STROKE", "Heavy: steady in the air, slow to rotate. Clean landings, hard flips.", [2, 4, 4, 5])}</div><p class="ba-howto">In the air: hold TRICK and the stick picks one · weight all the way back for a flip · put it away and land on the down ramp</p></div><div class="ba-card" role="dialog" aria-label="Run finished" hidden><b>JUDGES</b><p class="ba-judges"></p><p class="ba-t"></p><p class="ba-stats2"></p><p class="ba-again"><button type="button" class="bui-key ba-re">RIDE AGAIN</button><button type="button" class="bui-key ba-swap">SWAP BIKE</button></p></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, pickEl = hud.children[4] as HTMLElement, card = hud.children[5] as HTMLElement;
  const scoreEl = top.children[0]!.firstChild as HTMLElement, comboEl = top.children[0]!.lastChild as HTMLElement, timeEl = top.children[1]!.firstChild as HTMLElement, rideEl = top.children[2]!.firstChild as HTMLElement;
  const viewK = keysEl.children[0] as HTMLButtonElement, muteK = keysEl.children[1] as HTMLButtonElement;
  const pickBtns = pickEl.querySelectorAll<HTMLButtonElement>(".ba-bike");
  const judgesEl = card.children[1] as HTMLElement, cardT = card.children[2] as HTMLElement, cardS = card.children[3] as HTMLElement;
  const reBtn = card.querySelector<HTMLButtonElement>(".ba-re")!, swapBtn = card.querySelector<HTMLButtonElement>(".ba-swap")!;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", trick: "click", clean: "power", sketchy: "click", crash: "boom", end: "win" }, volume: 0.1 });
  const vox = voice();
  const c = controls(engine, { keys: { left: [], right: [], fwd: [], back: [], gas: [], brake: [], trick: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FWD = c.id("fwd"), BACK = c.id("back"), TRICK = c.id("trick");
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "gas", label: "GAS", name: "Gas (Space)", key: "SPACE", role: "go", hold: true },
      { intent: "trick", label: "TRICK", name: "Trick (L)", key: "L", role: "flag", hold: true },
      { intent: "brake", label: "BRAKE", name: "Brake (K)", key: "K", role: "attack", hold: true },
    ],
    host: stage,
  });
  thePad.el.classList.add("ba-pad");
  const toggle = () => {
    snd.on = vox.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the run and the diorama ----
  const show = airShow(), t = show.t, me = show.b, sc = show.sc;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  let tv: TerrainView, dust: Pool, spark: Pool, fans: Pool, g: Rig;
  const EDGE = trackEdges(t);
  const rnd = seeded(20261120);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(120);
  for (let i = 0; i < 120; i++) STARS[i] = rnd();
  // The crowd: where each fan's light sits (x, y, z), its colour slot.
  const FAN = new Float64Array(FANS * 3);

  function buildScene() {
    dio.clear();
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("table", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    dio.add({ id: "table", size: [HX * 2 + 8, 0.5, HZ * 2 + 9], pos: [0, -1.55, 0.2], color: P.table, cluster: "table", layer: 0, pick: false });
    dio.add({ id: "plinth", size: [HX * 2 + 0.5, 1.05, HZ * 2 + 0.5], pos: [0, -1.05, 0], color: P.plinth, cluster: "table", layer: 1, pick: false });
    dio.add({ id: "rim", size: [HX * 2 + 0.7, 0.12, HZ * 2 + 0.7], pos: [0, -0.2, 0], color: P.rim, cluster: "table", layer: 2, emissive: true, pick: false });
    tv = terrainView(dio, t, {
      bands: [[0.3, P.ground[0]!], [0.5, P.ground[1]!], [0.8, P.ground[2]!], [99, P.crest]], steep: 0.6, steepColor: P.steep, kinds: [P.track, P.steel, P.land],
      light: P.light, ambient: P.amb, lod: [26, 46], shadows: 2, shadowColor: P.shadow,
    });
    dio.decal("terrain", 1, paintLines);
    // The crowd stand along the far side: three stepped rows, the fans' lights over them.
    for (let k = 0; k < 3; k++) dio.add({ size: [HX * 1.5, 0.45 + k * 0.45, 1.1], pos: [0, -0.2, -HZ + 0.75 - k * 0.32], color: k & 1 ? P.seat : P.stand, pick: false, layer: 1 + k, cluster: "stand" });
    for (let k = 0; k < 3; k++) dio.add({ size: [HX * 1.5, 0.08, 0.3], pos: [0, 0.25 + k * 0.45, -HZ + 1.15 - k * 0.32], color: P.fans[k]!, emissive: P.night, pick: false, layer: 4 + k, cluster: "stand" });
    for (let i = 0; i < FANS; i++) {
      const row = i % 3;
      FAN[i * 3] = -HX * 0.74 + ((i / 3) | 0) * ((HX * 1.48) / (FANS / 3));
      FAN[i * 3 + 1] = 0.45 + row * 0.45;
      FAN[i * 3 + 2] = -HZ + 1.1 - row * 0.32;
    }
    // Light towers at the corners.
    for (const [x, z] of [[-HX + 1.2, -HZ + 1.6], [HX - 1.2, -HZ + 1.6], [-HX + 1.2, HZ - 1.2], [HX - 1.2, HZ - 1.2]] as const) {
      const id = "tw" + x + z;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.3, 4.6, 0.3], pos: [x, t.height(x, z) - 0.1, z], color: P.tower, pick: false });
      dio.add({ size: [1.3, 0.5, 0.25], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.tower, pick: false });
      dio.add({ size: [1.1, 0.34, 0.27], pos: [0, 0.08, 0], rot: [0, Math.atan2(-z, x) + Math.PI / 2, 0], on: id, color: P.lamp, emissive: true, pick: false, layer: 9 });
    }
    // The kickers' posts and neon lights at the lip; flags at the landings.
    for (let k = 0; k < 2; k++) {
      const s0 = KICK[k]!, i0 = Math.round(s0 / (LAP / NT)) % NT, i1 = Math.round((s0 + KICK_L) / (LAP / NT)) % NT, yaw = YAW[i0]!;
      for (const side of [-1, 1]) {
        const x = TRACK[i1 * 2]! + Math.sin(yaw) * side * (TRACK_W / 2 + 0.08), z = TRACK[i1 * 2 + 1]! + Math.cos(yaw) * side * (TRACK_W / 2 + 0.08);
        dio.add({ shape: "cyl", sides: 6, size: [0.18, 2.9, 0.18], pos: [x, 0.2, z], color: P.tower, pick: false });
        dio.add({ size: [0.24, 0.24, 0.24], pos: [x, 3.0, z], color: side > 0 ? P.edge : P.edge2, emissive: true, pick: false });
      }
      const il = Math.round((s0 + KICK_L + 6.4 + 1.5) / (LAP / NT)) % NT;
      for (const side of [-1, 1]) {
        const x = TRACK[il * 2]! + Math.sin(YAW[il]!) * side * (TRACK_W / 2 + 0.5), z = TRACK[il * 2 + 1]! + Math.cos(YAW[il]!) * side * (TRACK_W / 2 + 0.5), id = "fl" + k + side;
        dio.add({ id, shape: "cyl", sides: 5, size: [0.08, 3.2, 0.08], pos: [x, t.height(x, z), z], color: P.tower, pick: false });
        dio.add({ shape: "wedge", size: [0.7, 0.45, 0.04], pos: [0.35, 2.7, 0], on: id, color: side > 0 ? P.edge : P.edge2, emissive: P.night, pick: false });
      }
    }
    g = rig(dio, "rider", { ...P.kit, ...P.team }, show.b.power.gyr < 0.6 ? "2t" : "4t");
    dust = pool(dio, DUST, P.dust, 4);
    spark = pool(dio, SPARK, P.spark, 6);
    fans = pool(dio, FANS, P.fans[0]!, 7);
    fans.P.n = FANS;
    for (let i = 0; i < FANS; i++) (fans.P.x[i] = FAN[i * 3]!), (fans.P.y[i] = FAN[i * 3 + 1]!), (fans.P.z[i] = FAN[i * 3 + 2]!), (fans.P.r[i] = 0.07), (fans.P.a[i] = P.night ? 0.8 : 0.9);
    sky = null;
    pose();
  }

  // ---- state ----
  const I = new Float64Array(6), GP = new Float64Array(6), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  const PD = new Float64Array(6);
  PD[5] = -1;
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let view = 0, auto = false, dirty = true, hudDirty = true, shake = 0, toastT = 0, choice = 0, cardAt = -1, emitK = 0, best = 0, cheer = 0;
  const was = new Float64Array(8).fill(-1);
  const TABLE = { yaw: 0, pitch: 0.78, dist: 40, tx: 0, ty: 0, tz: 0.6, ox: 0, oy: 0, fov: 0.62 };
  const chaseO = { dist: 11, pitch: 0.3, lift: 1.2, ahead: 0.35, rate: 3.2, turn: 2.4, side: 1.05 };
  const VEL = new Float64Array(3), CTP = new Float64Array(3), target = { pos: CTP, yaw: 0, vel: VEL };
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), vox.close()), { once: true });

  /** The rider's trick pose from the trick out and how far (see rig's TRICK_POSE). */
  function pose() {
    const T = g.T, a = show.trickAmount, id = show.trick;
    T.fill(0);
    if (id === 0) (T[1] = a), (T[3] = 0.55 * a), (T[4] = 0.35 * a);
    else if (id === 1) (T[0] = a), (T[6] = 1), (T[4] = 0.5 * a);
    else if (id === 2) (T[2] = a), (T[1] = 0.25 * a), (T[4] = 0.45 * a);
    else if (id === 3) (T[7] = a), (T[4] = 0.15 * a);
    g.pose(me, me.air > 0 || Math.abs(me.speed) > 4 ? 0.9 : 0.4);
    const x = me.pos[0]!, z = me.pos[2]!, inside = Math.abs(x) < HX && Math.abs(z) < HZ, lift = inside ? me.pos[1]! - t.height(x, z) : 9;
    tv.shadow(0, x, z, 1.0, inside ? Math.max(0, 0.38 - lift * 0.06) : 0);
  }

  function stepFx(dt: number) {
    let any = false;
    if (!me.crashed && me.contact[0]) {
      emitK += me.dust * 55 * dt;
      while (emitK >= 1) {
        emitK -= 1;
        dust.puff(me.wheel[0]! + (rnd() - 0.5) * 0.3, me.wheel[1]! - 0.25, me.wheel[2]! + (rnd() - 0.5) * 0.3, -me.cy * me.speed * 0.12 + (rnd() - 0.5), 0.4 + rnd() * 0.6, me.sy * me.speed * 0.12 + (rnd() - 0.5), 0.6 + rnd() * 0.5, 0.11, 0.4);
      }
    }
    if (dust.step(dt, -0.4, 0.22, 0.32)) any = true;
    if (spark.step(dt, 12, -0.05, 1)) any = true;
    // The crowd: lights bob and flash after a big landing.
    if (cheer > 0) {
      cheer = Math.max(0, cheer - dt);
      for (let i = 0; i < FANS; i++) (fans.P.y[i] = FAN[i * 3 + 1]! + (Math.sin(engine.time * 18 + i * 1.7) > 0.3 ? 0.08 * cheer : 0)), (fans.P.a[i] = 0.5 + 0.5 * (Math.sin(engine.time * 9 + i) > 0 ? 1 : 0.4));
      any = true;
    }
    return any;
  }

  function events() {
    for (let k = 0; k < show.n; k++) {
      const type = show.ev[k * 2]!, val = show.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast("GO! 1:00 ON THE CLOCK", "go"), say("Go");
      else if (type === E_TRICK) engine.events.emit("trick"), toast(TRICKS[val]!, "trick");
      else if (type === E_LAND) {
        const S = sc.S, clean = val === CLEAN, flips = S[LFLIPS]!;
        engine.events.emit(clean ? "clean" : "sketchy");
        const what = flips ? (flips > 1 ? `${flips}× BACKFLIP` : me.airSpin < 0 ? "FRONTFLIP" : "BACKFLIP") + " · " : "";
        toast(`${what}+${S[PTS]!.toLocaleString("en-US")}${clean ? (S[CB]! > 1 ? ` · COMBO ×${S[CB]}` : " · CLEAN") : " · SKETCHY"}`, clean ? "clean" : "meh");
        if (S[PTS]! > 600) cheer = 1.6;
        say(`${what}${S[PTS]} points`);
        dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.6, me.pos[2]!, clean ? 10 : 16, 2.4, 1, 0.8, 0.2, 0.55);
      } else if (type === E_CRASH) {
        shake = 0.5;
        engine.events.emit("crash");
        toast(CRASH_NAME[val] || "WIPEOUT!", "bad");
        say(CRASH_NAME[val] || "Wipeout");
        for (let q = 0; q < 24; q++) {
          const a = rnd() * TAU, u = 0.4 + rnd();
          spark.puff(me.pos[0]!, me.pos[1]!, me.pos[2]!, Math.cos(a) * 4 * u, 2 + rnd() * 4, Math.sin(a) * 4 * u, 0.5 + rnd() * 0.5, 0.07, 1);
        }
        dust.ring(rnd, me.pos[0]!, me.pos[1]! - 0.4, me.pos[2]!, 18, 3, 1.2, 1, 0.24, 0.6);
      } else if (type === E_RESPAWN) {
        CTP.set(me.pos);
        chase(dio.cam, target, { ...chaseO, snap: view === 1 }, 1 / 60);
      } else if (type === E_END) {
        engine.events.emit("end");
        toast("TIME!", "go");
        cardAt = engine.time + 1.4;
        engine.busy(1.5);
      }
    }
    show.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "ba-toast ba-" + kind;
    toastEl.hidden = false;
    toastT = 1.5;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const S = sc.S, ph = show.phase;
    if (was[0] !== S[SC]) (was[0] = S[SC]!), (scoreEl.textContent = S[SC]!.toLocaleString("en-US"));
    if (was[1] !== S[CB]) (was[1] = S[CB]!), (comboEl.textContent = "×" + (1 + S[CB]!)), comboEl.classList.toggle("ba-hot", S[CB]! > 0);
    const secs = Math.ceil(show.clock);
    if (was[2] !== secs) (was[2] = secs), (timeEl.textContent = `${(secs / 60) | 0}:${("" + (secs % 60)).padStart(2, "0")}`), timeEl.parentElement!.classList.toggle("ba-low", secs <= 10 && ph === RUN);
    if (was[3] !== choice) (was[3] = choice), (rideEl.textContent = BIKES[choice]!.name);
    const touch = !!thePad.el.offsetParent;
    const hint = ph === READY ? (touch ? "Hold GAS to start the clock" : "Space to go · " + KEYS_HINT) : ph === RUN && show.clock > RUN_T - 8 ? (touch ? "In the air: TRICK + stick · stick back for a flip" : KEYS_HINT) : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function showEnd() {
    cardAt = -1;
    const S = sc.S, JD = sc.JD, total = JD[5]!, isBest = !best || total > best;
    if (isBest) best = total;
    judgesEl.innerHTML = "";
    for (let k = 0; k < 5; k++) {
      const s = judgesEl.appendChild(document.createElement("span"));
      s.textContent = JD[k]!.toFixed(1);
    }
    let seen = 0;
    for (let i = 0; i < TRICKS.length; i++) seen += ((S[SEEN]! >> i) & 1);
    cardT.textContent = `${total.toFixed(1)}${isBest ? " · BEST" : ` · best ${best.toFixed(1)}`}`;
    cardS.textContent = `${S[SC]!.toLocaleString("en-US")} pts · best jump ${S[BEST]!.toLocaleString("en-US")} · ${seen}/${TRICKS.length} tricks · ${S[FLIPS]} ${S[FLIPS] === 1 ? "flip" : "flips"} · ${S[CLEANS]}/${S[JUMPS]} clean · ${S[CRASHES]} ${S[CRASHES] === 1 ? "crash" : "crashes"}`;
    card.hidden = false;
    setView(0);
    say(`Judges: ${total.toFixed(1)}`);
    reBtn.focus({ preventScroll: true });
  }
  function choose(i: number) {
    choice = i;
    pickEl.hidden = true;
    card.hidden = true;
    show.go(BIKES[i]!);
    buildScene();
    was.fill(-1);
    vox.use(BIKES[i]!);
    setView(1);
    CTP.set(me.pos);
    target.yaw = me.yaw;
    chase(dio.cam, target, { ...chaseO, snap: true });
    hudDirty = dirty = true;
    engine.busy(2);
    play.focus({ preventScroll: true });
  }
  function toPick() {
    show.reset();
    card.hidden = true;
    pickEl.hidden = false;
    setView(0);
    was.fill(-1);
    dust.clear();
    spark.clear();
    hudDirty = dirty = true;
    pose();
    pickBtns[choice]!.focus({ preventScroll: true });
  }

  function frameTable() {
    const pts = [-HX - 0.4, -1.1, -HZ - 0.4, HX + 0.4, -1.1, -HZ - 0.4, -HX - 0.4, -1.1, HZ + 0.4, HX + 0.4, -1.1, HZ + 0.4, -HX, 3.4, -HZ, HX, 3.4, -HZ];
    const W = dio.width, H = dio.height, tall = H / W > 0.75;
    TABLE.yaw = tall ? -0.5 : 0;
    TABLE.pitch = tall ? 0.95 : 0.74;
    TABLE.dist = 40;
    TABLE.tx = TABLE.ty = TABLE.ox = TABLE.oy = 0;
    TABLE.tz = 0.6;
    dio.fit(TABLE, pts, { x0: 8, y0: V[3]!, x1: W - 8, y1: H - V[4]! });
    chaseO.dist = tall ? 12.5 : 11;
    chaseO.pitch = tall ? 0.42 : 0.3;
  }
  function stepCam(dt: number) {
    const cam = dio.cam;
    if (!me.crashed) target.yaw = me.yaw;
    const src = me.crashed ? me.rider : me.pos;
    CTP[0] = Math.max(-HX - 1, Math.min(HX + 1, src[0]!));
    CTP[1] = Math.max(-1, src[1]! * 0.85);
    CTP[2] = Math.max(-HZ - 1, Math.min(HZ + 1, src[2]!));
    VEL[0] = me.cy * me.speed; VEL[1] = 0; VEL[2] = -me.sy * me.speed;
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
    viewK.textContent = n ? "VIEW · CHASE" : "VIEW · ARENA";
    dirty = true;
    engine.busy(2.5);
    engine.wake();
  }

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
      // Two searchlights sweeping the night.
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) {
        const a = Math.sin(engine.time * 0.4 + k * 2.1) * 0.5 + (k ? 0.35 : -0.35), x = W * (k ? 0.8 : 0.2);
        ctx.fillStyle = k ? P.edge : P.edge2;
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.62);
        ctx.lineTo(x + Math.sin(a - 0.06) * H, H * 0.62 - Math.cos(a - 0.06) * H);
        ctx.lineTo(x + Math.sin(a + 0.06) * H, H * 0.62 - Math.cos(a + 0.06) * H);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      for (let k = 0; k < 3; k++) {
        const x = W * (0.15 + k * 0.33), y = H * (0.12 + (k & 1) * 0.07), r = Math.min(W, H) * 0.045;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, TAU);
        ctx.arc(x - r, y + r * 0.3, r * 0.7, 0, TAU);
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
  /** The jump sticker: air time, the trick out and its hold, the flip so far (a dial). */
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (show.phase !== RUN || !(me.air > 0.12) || me.crashed) return;
    const W = dio.width, H = dio.height, s = Math.max(0.8, Math.min(1.2, W / 720)), w = 176 * s, h = 52 * s, x = 10, y = H - V[4]! - h - 6;
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
    // The flip dial: the pitch turned this jump, a full turn round the ring.
    const cx = x + h / 2, cy = y + h / 2, r = h * 0.32, turned = me.airSpin;
    ctx.lineWidth = 5 * s;
    ctx.strokeStyle = P.night ? "#2a2545" : "#e8e4f0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = Math.abs(turned) > TAU - 0.8 ? P.hot : P.ok;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 - Math.max(-TAU, Math.min(TAU, turned)), turned > 0);
    ctx.stroke();
    ctx.fillStyle = P.night ? "#e9e6ff" : "#1b1420";
    ctx.font = `900 ${Math.round(11 * s)}px ui-rounded, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const id = show.trick;
    ctx.fillText(id >= 0 ? TRICKS[id]! : `AIR ${me.air.toFixed(1)}s`, x + h + 2, y + h * 0.36);
    // The trick's hold: how long it has been all the way out this jump.
    if (id >= 0) {
      const held = sc.J[id]!, bw = w - h - 12 * s;
      ctx.fillStyle = P.night ? "#2a2545" : "#e8e4f0";
      ctx.fillRect(x + h + 2, y + h * 0.62, bw, 8 * s);
      ctx.fillStyle = show.trickAmount > 0.85 ? P.hot : P.ok;
      ctx.fillRect(x + h + 2, y + h * 0.62, bw * Math.min(1, held / 1.2), 8 * s);
    } else ctx.fillText(Math.abs(turned) > 1 ? `${((Math.abs(turned) / TAU) * 360) | 0}°` : "", x + h + 2, y + h * 0.7);
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
      if (V[6] && !gamepad(GP)) GP.fill(0);
      if (first && V[5]) (first = null), (pickEl.hidden ? play : pickBtns[0]!).focus({ preventScroll: true });
    },
    step(e, dt) {
      if (cardAt > 0 && e.time >= cardAt) showEnd();
      const drag = PD[0] ? Math.max(40, dio.width * 0.12) : 1;
      I[0] = c.down(GAS) || PD[0] ? 1 : GP[2]! > 0.2 ? GP[2]! : 0;
      I[1] = c.down(BRAKE) || GP[3]! > 0.2 ? 1 : 0;
      I[2] = (+c.down(BACK) - +c.down(FWD)) || (c.stick.active ? c.stick.y : 0) || GP[1]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[4]! - PD[2]!) / drag)) : 0);
      I[3] = (+c.down(RIGHT) - +c.down(LEFT)) || (c.stick.active ? c.stick.x : 0) || GP[0]! || (PD[0] ? Math.max(-1, Math.min(1, (PD[3]! - PD[1]!) / drag)) : 0);
      I[4] = c.down(TRICK) || GP[4]! > 0.5 ? 1 : 0;
      if (V[6] && show.phase === PICK && GP[2]! > 0.5) choose(choice);
      if (!card.hidden) I.fill(0);
      let moving = show.step(dt, I, auto);
      if (show.n) events(), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      vox.set(me.rpm, me.throttle, (show.phase === RUN || show.phase === READY) && !me.crashed && !!card.hidden);
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = shake * shake * 10, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });

  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", Space: "gas", KeyJ: "gas", KeyK: "brake", ShiftLeft: "brake", ShiftRight: "brake", KeyL: "trick", KeyE: "trick" };
  const wake = () => vox.wake(BIKES[choice]!);
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

  // The poster: a sky plank over the first gap.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    choose(0);
    auto = true;
    show.S[0] = RUN;
    const i = Math.round((KICK[0]! - 9) / (LAP / NT));
    me.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, YAW[i]!, 15);
    show.S[3] = i;
    target.yaw = me.yaw;
    CTP.set(me.pos);
    chase(dio.cam, target, { ...chaseO, snap: true });
  }

  buildScene();
  setView(0);
  engine.start();
  void TURN;
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
      const S = sc.S;
      return { phase: show.phase, clock: show.clock, score: S[SC]!, combo: S[CB]!, trick: show.trick, air: me.air, crashes: S[CRASHES]!, jumps: S[JUMPS]!, bike: BIKES[choice]!.name, card: !card.hidden, pick: !pickEl.hidden, view: view ? "chase" : "arena", judges: sc.JD[5]! };
    },
    pick(i: number) {
      wake();
      choose(i);
    },
    poster,
    show,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a sky plank over the first gap (scripts/gallery-posters.mjs). */
export const posterAt = 1.25;
void AIRT;
