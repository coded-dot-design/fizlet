// "Moon Rover" (hero, Hi-Fi): a little lunar rover on a small round moon that turns under it as it
// drives. The rover stays at the top of the picture; the moon rolls beneath it and its horizon
// curves away on every side. A relay of eight beacons runs on a seam round the whole moon (a lap),
// through the day and the night: on the light side little friends by their domes wave and beep and
// hand over a boost, crystals or a shield; past the terminator the night side is dark and chasers
// come over the horizon to ram you (FIRE shoots them; they burn up if they follow you into the sun).
// Crystals, crates to smash, rocks, craters and ramps all over. Three shields, two and a half
// minutes from the first press. Keys: ↑ ↓ ← → or WASD, Space fires, Shift boosts, J jumps, M mutes,
// R restarts; a phone has a stick (steer, up for gas, down to brake) and FIRE, BOOST and JUMP; a
// gamepad works too.
// The orb (./orb.ts) is the reusable part: the seeded surface, the geodesic tiles, the drive ground
// on the curved surface and the camera rule (a brick candidate). The run is ./moon-run.ts,
// headless (tests/moon-rover.test.mjs); this file is the scene (tests/moon-rover.mjs).
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back byte for byte),
// @fzlt/core/diorama (the 3D), @fzlt/core/drive (the rover, through the orb's chart),
// @fzlt/core/input + @fzlt/core/pad (keys, stick, touch keys), @fzlt/core/fx (the blasts),
// @fzlt/core/slot, @fzlt/core/sound.
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { effects } from "../../../../src/fx";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { euler, mul3, columns } from "./orb";
import {
  moonRun, R, SUN, READY, RUN, DONE, BEACONS, CRYSTALS, ROCKS, CRATES, FRIENDS, BASES, RAMPS, SHIPS, BOLTS, TIME, SHIELDS,
  E_START, E_CRYSTAL, E_BEACON, E_LAP, E_FRIEND, E_SHOT, E_KILL, E_HIT, E_CRATE, E_DARK, E_JUMP, E_CRASH, E_RIGHT, E_DOWN, E_TIME, E_BUMP, E_BURN, E_LAND,
  G_BOOST, G_CRYSTALS, PH, CLK, SCORE, CRY, NEXT, LAPS, SHD, BOOST, HURT, DARK as DK, KILLS, MET,
  IN_GAS, IN_BRAKE, IN_STEER, IN_FIRE, IN_BOOST, IN_JUMP,
} from "./moon-run";

const TAU = 6.283185307179586, FREQ = 13;
// The palettes by role: a neon night (dark) and a pastel day (light). The moon has its own day and
// night in both: `day*` faces the sun, `dusk` is the terminator band, `night*` the far side.
const DARK = {
  night: true, amb: 0.36,
  sky0: "#03041a", sky1: "#0b0a2e", sky2: "#1d0f45", star: "#d8e2ff", sun0: "#fff6d6", sun1: "#ff9a3c", glow: "#22e6ff",
  planet: "#4b34b8", band: "#7d5cff", band2: "#2fd6ff", ring: "#ff4fa8",
  day: ["#9da3cc", "#a8add6", "#b4b9df"], floor: "#7f85b2", rim: "#cdd1ef", dusk: ["#b07fb8", "#c48ab4"], nite: ["#24224f", "#2a275c", "#211e48"], nfloor: "#1a1840", nrim: "#3a3678",
  body: "#eef0ff", accent: "#22e6ff", chassis: "#26253a", panel: "#2b3c8f", panel2: "#5a7bff", tyre: "#121219", hub: "#9aa0c0", lamp: "#fff7d6", tail: "#ff2e88", flame: "#ffb35c", visor: "#0a0c16",
  bIdle: "#4a3f86", bNext: "#ff4fa8", bLit: "#22e6ff", bPost: "#2a2548",
  crys: ["#ff4fd8", "#22e6ff", "#b18cff"], crate: "#f2a03d", strap: "#2a2445", rock: "#4f5384", nrock: "#1c1a3e",
  dome: "#e8ecff", domeWin: "#22e6ff", padC: "#3a3668", friend: "#7ff0b8", friend2: "#4fd39c", eye: "#ffffff", ink: "#0b0a14", tip: "#ffd166",
  hull: "#4a3f7e", hull2: "#6a5bb0", sglow: "#ff2e5e", bolt: "#7ff6ff", spark: "#ffd166", dust: "#9a9ccc", shadow: "#000000",
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, amb: 0.5,
  sky0: "#b9c3f5", sky1: "#dcd2fa", sky2: "#ffe6d8", star: "#ffffff", sun0: "#fffbe8", sun1: "#ffc36b", glow: "#ff7a59",
  planet: "#7f6ad8", band: "#a593ff", band2: "#6fd9e8", ring: "#ff7aa8",
  day: ["#f1e7d6", "#eadfca", "#e3d5bd"], floor: "#d6c4a8", rim: "#fbf6ec", dusk: ["#f1a98e", "#e99a8a"], nite: ["#8a84bd", "#938dc6", "#7f79b1"], nfloor: "#726ca4", nrim: "#a7a1d6",
  body: "#253150", accent: "#13a9bb", chassis: "#2a2a36", panel: "#2f4aa8", panel2: "#6d8bff", tyre: "#1a1a22", hub: "#d9dbe6", lamp: "#fff7d6", tail: "#ff3b30", flame: "#ff8a3d", visor: "#11131c",
  bIdle: "#b4a6d8", bNext: "#ff3d7f", bLit: "#13a9bb", bPost: "#5e5486",
  crys: ["#ff4fb0", "#13a9bb", "#8f6bff"], crate: "#ff8a3d", strap: "#3b3358", rock: "#c4b298", nrock: "#6e68a0",
  dome: "#fffaf0", domeWin: "#13a9bb", padC: "#cdbfa6", friend: "#5fd39c", friend2: "#3fb47f", eye: "#ffffff", ink: "#1b1420", tip: "#ff7a59",
  hull: "#3b3358", hull2: "#6a5bb0", sglow: "#ff2e5e", bolt: "#13c9e0", spark: "#ffb347", dust: "#d9c8ad", shadow: "#4a3a5a",
};
const DUST = 90, DEBRIS = 90;
const LABELS = ["★", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const WORDS = ["ZAP!", "KA-BLAM", "+50", "+200", "LAP!", "BEEP!", "BOOST!", "SHIELD!", "+3", "CRUNCH", "OUCH", "+25"];

export type MoonScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; clock: number; score: number; crystals: number; next: number; laps: number; shields: number; dark: boolean; kills: number; met: number; ships: number; speed: number; air: number; card: boolean; lat: number; lon: number; tiles: number };
  /** Drive by itself (the poster, the tests). */
  auto: boolean;
  /** The run (the tests read it). */
  readonly run: ReturnType<typeof moonRun>;
  /** Put the rover `back` units behind orb point u (unit), facing it (tests). */
  near(u: ArrayLike<number>, back: number): void;
  /** The rover's screen point (CSS px), as of the last draw. */
  roverScreen(): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): MoonScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 20261123 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  void slot;

  // ---- the page: the canvas, the play surface over it, the stickers, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "mr-play";
  play.setAttribute("aria-label", "Moon Rover: up or W for gas, down or S to brake, left and right to steer, Space fires, Shift boosts, J jumps. Light the eight beacons round the moon. M mutes, R restarts");
  const hud = L.add(document.createElement("div"));
  hud.className = "mr-hud";
  hud.innerHTML = `<div class="mr-head"><p class="mr-top"><b class="mr-chip mr-time"><span>2:30</span></b><b class="mr-chip mr-bea"><span>BEACON 1/${BEACONS}</span></b><b class="mr-chip mr-cry"><i>✦</i><span>0</span></b><b class="mr-chip mr-score"><span>0</span></b></p><p class="mr-sub"><b class="mr-chip mr-shd" aria-label="Shields"><i></i><i></i><i></i></b><b class="mr-chip mr-boost" aria-label="Boost"><em>BOOST</em><u><s></s></u></b></p><p class="mr-hint"></p></div><p class="mr-toast" hidden></p><p class="mr-live" aria-live="polite"></p><p class="mr-keys"><button type="button" class="mr-key mr-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="mr-card" role="dialog" aria-label="Run over" hidden><b>TIME UP</b><p class="mr-t"></p><p class="mr-stats"></p><button type="button" class="bui-key mr-again">DRIVE AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, sub = head.children[1] as HTMLElement, hintEl = head.children[2] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, card = hud.children[4] as HTMLElement;
  const timeEl = top.children[0]!.firstChild as HTMLElement, beaEl = top.children[1]!.firstChild as HTMLElement, cryEl = top.children[2]!.lastChild as HTMLElement, scoreEl = top.children[3]!.firstChild as HTMLElement;
  const shdEls = sub.children[0]!.children, boostEl = sub.children[1]!.querySelector("s") as HTMLElement, boostChip = sub.children[1] as HTMLElement;
  const muteK = keysEl.children[0] as HTMLButtonElement;
  const cardH = card.children[0] as HTMLElement, cardT = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement, again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "ready", crystal: "click", beacon: "power", lap: "win", friend: "beep", shot: "fire", kill: "boom", hit: "hurt", crate: "hit", jump: "click", over: "end", right: "ready", dark: "dark" },
    notes: { beep: [[880, 1320, 0.06, 0, "square", 0.07], [1320, 990, 0.07, 0.08, "square", 0.07], [990, 1480, 0.06, 0.17, "square", 0.06]], dark: [[300, 150, 0.4, 0, "triangle", 0.12]] },
    volume: 0.1,
  });
  const c = controls(engine, { keys: { left: [], right: [], gas: [], brake: [], fire: [], boost: [], jump: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FIRE = c.id("fire"), BOOSTK = c.id("boost"), JUMP = c.id("jump");
  const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l2.3 5.2 5.7.5-4.3 3.8 1.3 5.6L10 14.2 5 17.1l1.3-5.6L2 7.7l5.7-.5z"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "fire", label: "FIRE", name: "Fire (Space)", key: "SPACE", role: "fire", hold: true, icon: STAR },
      { intent: "boost", label: "BOOST", name: "Boost (Shift)", key: "SHIFT", role: "go", hold: true },
      { intent: "jump", label: "JUMP", name: "Jump (J)", key: "J", role: "sys" },
    ],
    host: stage,
  });
  thePad.el.classList.add("mr-pad");
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the run, the view and the diorama ----
  const run = moonRun(), o = run.orb, v = run.car, view = o.view(), T = o.tiles(FREQ);
  const fx = effects({ cap: 260, scorch: 0, words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"] });
  const dio = diorama(canvas, { light: [0, 1, 0], ambient: P.amb, background: () => P.sky0, overlay: drawOverlay, maxVerts: 60000, maxFaces: 9000, maxShadows: 64, get shadowColor() { return P.shadow; } });
  const NP = BEACONS + CRYSTALS + ROCKS + CRATES + BASES + FRIENDS + RAMPS;
  // Props: orb point (surface), cull radius, sort nudge; their anchors (world) for the depth sort.
  const PU = new Float64Array(NP * 3), PR = new Float64Array(NP), PN = new Float64Array(NP), AN = new Float64Array((NP + SHIPS + 1) * 3);
  const props: DioramaObject[] = [], tiles: DioramaObject[] = [];
  const crystals: DioramaObject[] = [], crates: DioramaObject[] = [], beacons: DioramaObject[][] = [], friends: DioramaObject[][] = [], ships: DioramaObject[] = [], flames: DioramaObject[] = [];
  const hubs: DioramaObject[] = [];
  let moon: DioramaObject, padO: DioramaObject, body: DioramaObject, dust: DioramaPoints, debris: DioramaPoints, bolts: DioramaPoints;
  // Particles in orb space: x y z, vx vy vz, life, max (per pool).
  const DO = new Float64Array(DUST * 8), BR = new Float64Array(DEBRIS * 8);
  // Sky: stars (orb-space directions + brightness), the ringed planet's direction.
  const rnd = engine.random;
  const STARS = new Float64Array(180 * 4);
  for (let i = 0; i < 180; i++) {
    let x = 0, y = 0, z = 0, d = 2;
    while (d > 1 || d < 0.01) (x = rnd() * 2 - 1), (y = rnd() * 2 - 1), (z = rnd() * 2 - 1), (d = x * x + y * y + z * z);
    d = Math.sqrt(d);
    STARS.set([x / d, y / d, z / d, rnd()], i * 4);
  }
  const PLANET = [-0.45, 0.62, 0.64], SUNV = SUN as number[];
  { const l = Math.hypot(...PLANET); for (let k = 0; k < 3; k++) PLANET[k] = PLANET[k]! / l; }
  const SV3 = new Float64Array(3), FF = new Float64Array(FRIENDS * 9), M9 = new Float64Array(9), M9b = new Float64Array(9), E3 = new Float64Array(3), F9 = new Float64Array(9), tmp = new Float64Array(3);

  /** Pose a diorama object: orb frame rows F (e1, up, e2) → its rot in world (root) or under the moon. */
  function rotOf(F: ArrayLike<number>, root: boolean, out: Float64Array) {
    columns(F, M9);
    if (root) mul3(view.Q, M9, M9b), euler(M9b, out);
    else euler(M9, out);
  }
  function tileColor(i: number) {
    const cx = T.centre[i * 3]!, cy = T.centre[i * 3 + 1]!, cz = T.centre[i * 3 + 2]!, l = Math.hypot(cx, cy, cz), d = run.day(cx / l, cy / l, cz / l), h = T.height[i]!;
    const k = (i * 7 + ((i / 3) | 0)) % 3;
    if (d > 0.1) return h < -0.35 ? P.floor : h > 0.32 ? P.rim : P.day[k]!;
    if (d > -0.05) return P.dusk[k & 1]!;
    return h < -0.35 ? P.nfloor : h > 0.32 ? P.nrim : P.nite[k]!;
  }
  function buildScene() {
    dio.clear();
    props.length = tiles.length = crystals.length = crates.length = beacons.length = friends.length = ships.length = flames.length = hubs.length = 0;
    dio.cluster("sky", { fixed: -10 });
    dio.decal("sky", 0, paintSky);
    moon = dio.add({ id: "moon", shape: "group", size: [0, 0, 0], pos: [0, -R, 0], pick: false });
    // The tiles: one face each (a flat cap on a point: the sides face down and drop out), its own
    // cluster so the sort runs far to near across the moon.
    const C = T.corners, M = T.centre, N = T.normal, th = 0.06;
    for (let i = 0; i < T.n; i++) {
      const mx = M[i * 3]!, my = M[i * 3 + 1]!, mz = M[i * 3 + 2]!, nx = N[i * 3]!, ny = N[i * 3 + 1]!, nz = N[i * 3 + 2]!;
      let ax = C[i * 9]! - mx, ay = C[i * 9 + 1]! - my, az = C[i * 9 + 2]! - mz;
      const d = ax * nx + ay * ny + az * nz;
      ax -= d * nx; ay -= d * ny; az -= d * nz;
      const al = Math.hypot(ax, ay, az);
      ax /= al; ay /= al; az /= al;
      const zx = ay * nz - az * ny, zy = az * nx - ax * nz, zz = ax * ny - ay * nx;
      F9.set([ax, ay, az, nx, ny, nz, zx, zy, zz]);
      const outline: number[][] = [];
      for (let k = 0; k < 3; k++) {
        const px = C[i * 9 + k * 3]! - mx, py = C[i * 9 + k * 3 + 1]! - my, pz = C[i * 9 + k * 3 + 2]! - mz;
        outline.push([px * ax + py * ay + pz * az, px * zx + py * zy + pz * zz]);
      }
      rotOf(F9, false, E3);
      tiles.push(dio.add({ shape: "prism", outline, taper: 0, size: [1, th, 1], pos: [mx - nx * th, my - ny * th, mz - nz * th], rot: E3, on: "moon", cluster: "t" + i, color: tileColor(i), pick: false, layer: 2 }));
    }
    let np = 0;
    /** A prop's group on the moon at unit u facing f, sorted by its own anchor. */
    const prop = (u: ArrayLike<number>, f: ArrayLike<number>, r: number, nudge: number, lift = 0) => {
      const k = np++, g = R + o.height(u[0]!, u[1]!, u[2]!) + lift, id = "p" + k;
      PU[k * 3] = u[0]! * g; PU[k * 3 + 1] = u[1]! * g; PU[k * 3 + 2] = u[2]! * g; PR[k] = r; PN[k] = nudge;
      dio.cluster(id, { at: AN.subarray(k * 3, k * 3 + 3) });
      o.frame(u[0]!, u[1]!, u[2]!, f[0]!, f[1]!, f[2]!, F9);
      rotOf(F9, false, E3);
      const ob = dio.add({ id, shape: "group", size: [r, 0, r], pos: [PU[k * 3]!, PU[k * 3 + 1]!, PU[k * 3 + 2]!], rot: E3, on: "moon", cluster: id, pick: false });
      props.push(ob);
      return id;
    };
    const part = (on: string, shape: "box" | "cyl" | "wedge" | "prism", size: number[], pos: number[], color: string, x: { rot?: number[]; emissive?: boolean; sides?: number; top?: number; layer?: number; shadow?: number; id?: string } = {}) =>
      dio.add({ id: x.id, shape, size, pos, rot: x.rot, on, color, emissive: x.emissive, sides: x.sides, top: x.top, layer: x.layer, shadow: x.shadow, pick: false });
    const nightAt = (u: ArrayLike<number>) => run.day(u[0]!, u[1]!, u[2]!) < -0.05;
    const any = [0.3, 1, 0.2];
    // Beacons: a footing, a mast, a ring that lights.
    for (let k = 0; k < BEACONS; k++) {
      const u = run.beacon.subarray(k * 3, k * 3 + 3), id = prop(u, any, 3.2, 1.6);
      part(id, "cyl", [1.5, 0.3, 1.5], [0, -0.05, 0], P.bPost, { sides: 8, top: 0.8 });
      part(id, "cyl", [0.24, 3.2, 0.24], [0, 0, 0], P.bPost, { sides: 6 });
      const a = part(id, "cyl", [0.9, 0.3, 0.9], [0, 3.2, 0], P.bIdle, { sides: 10, emissive: true });
      const b = part(id, "cyl", [0.5, 0.5, 0.5], [0, 3.5, 0], P.bIdle, { sides: 8, top: 0, emissive: true });
      const s = part(id, "cyl", [1.0, 0.08, 1.0], [0, 0.26, 0], P.bIdle, { sides: 10, emissive: true });
      beacons.push([a, b, s]);
    }
    for (let i = 0; i < CRYSTALS; i++) {
      const u = run.crystal.subarray(i * 3, i * 3 + 3), id = prop(u, any, 1.2, 0.9), col = P.crys[i % 3]!;
      const g = dio.add({ id: id + "c", shape: "group", size: [0.6, 0, 0.6], pos: [0, 0.25, 0], on: id, pick: false });
      part(id + "c", "cyl", [0.62, 0.62, 0.62], [0, 0.0, 0], col, { sides: 5, top: 0, emissive: P.night });
      part(id + "c", "cyl", [0.62, 0.42, 0.62], [0, 0.02, 0], col, { sides: 5, top: 0, rot: [Math.PI, 0, 0], emissive: P.night });
      part(id, "cyl", [0.5, 0.06, 0.5], [0, 0, 0], nightAt(u) ? P.nrock : P.floor, { sides: 6 });
      crystals.push(g);
    }
    for (let i = 0; i < ROCKS; i++) {
      const u = run.rock.subarray(i * 4, i * 4 + 3), r = run.rock[i * 4 + 3]!, id = prop(u, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], r * 1.3, r * 0.9);
      const col = nightAt(u) ? P.nrock : P.rock;
      part(id, "cyl", [r * 1.9, r * 1.05, r * 1.6], [0, -0.12, 0], col, { sides: 5 + (i % 3), top: 0.42 + (i % 4) * 0.08, rot: [0, rnd() * TAU, (rnd() - 0.5) * 0.3] });
      if (i % 3 === 0) part(id, "cyl", [r * 0.9, r * 0.55, r * 0.8], [r * 0.95, -0.1, r * 0.3], col, { sides: 5, top: 0.4, rot: [0, rnd() * TAU, 0] });
    }
    for (let i = 0; i < CRATES; i++) {
      const u = run.crate.subarray(i * 3, i * 3 + 3), id = prop(u, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], 1.0, 0.9);
      part(id, "box", [0.95, 0.85, 0.95], [0, 0, 0], P.crate, { shadow: 0 });
      part(id, "box", [0.97, 0.16, 0.97], [0, 0.34, 0], P.strap);
      part(id, "box", [0.2, 0.87, 0.97], [0, 0, 0], P.strap);
      crates.push(props[props.length - 1]!);
    }
    for (let b = 0; b < BASES; b++) {
      const u = run.base.subarray(b * 3, b * 3 + 3), id = prop(u, any, 2.6, 2.0);
      part(id, "cyl", [4.0, 0.12, 4.0], [0, -0.04, 0], P.padC, { sides: 12 });
      part(id, "cyl", [3.0, 1.0, 3.0], [0, 0.05, 0], P.dome, { sides: 12, top: 0.78 });
      part(id, "cyl", [2.34, 0.7, 2.34], [0, 1.05, 0], P.dome, { sides: 12, top: 0.45 });
      part(id, "cyl", [3.04, 0.14, 3.04], [0, 0.5, 0], P.domeWin, { sides: 12, top: 0.98, emissive: true });
      part(id, "cyl", [0.1, 1.3, 0.1], [0.3, 1.6, 0], P.hub, { sides: 5 });
      part(id, "cyl", [0.5, 0.18, 0.5], [0.3, 2.85, 0], P.hub, { sides: 8, top: 1.4, rot: [0.5, 0, 0] });
      part(id, "box", [0.9, 0.55, 0.12], [0, 0.05, 1.42], P.chassis);
    }
    for (let i = 0; i < FRIENDS; i++) {
      const u = run.friend.subarray(i * 3, i * 3 + 3), id = prop(u, any, 1.0, 0.8), col = i & 1 ? P.friend2 : P.friend;
      FF.set(F9, i * 9);
      const g = dio.add({ id: id + "b", shape: "group", size: [0.5, 0, 0.5], on: id, pick: false });
      const b = id + "b";
      part(b, "cyl", [0.5, 0.42, 0.44], [0, 0, 0], col, { sides: 8, top: 0.72, shadow: 0.5 });
      part(b, "cyl", [0.46, 0.22, 0.42], [0, 0.42, 0], col, { sides: 8, top: 0.55 });
      part(b, "box", [0.1, 0.13, 0.2], [0.21, 0.4, 0], P.eye, { emissive: true });
      part(b, "box", [0.05, 0.07, 0.08], [0.255, 0.42, 0.03], P.ink);
      part(b, "cyl", [0.04, 0.3, 0.04], [0, 0.6, 0], col, { sides: 4 });
      part(b, "cyl", [0.12, 0.12, 0.12], [0, 0.88, 0], P.tip, { sides: 6, emissive: true });
      const al = dio.add({ id: b + "l", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.32, -0.24], on: b, pick: false });
      const ar = dio.add({ id: b + "r", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.32, 0.24], on: b, pick: false });
      part(b + "l", "box", [0.08, 0.3, 0.08], [0, -0.04, 0], col);
      part(b + "r", "box", [0.08, 0.3, 0.08], [0, -0.04, 0], col);
      friends.push([g, al, ar, props[props.length - 1]!]);
    }
    for (let k = 0; k < RAMPS; k++) {
      const u = run.ramp.subarray(k * 6, k * 6 + 3), f = run.ramp.subarray(k * 6 + 3, k * 6 + 6);
      if (!f[0] && !f[1] && !f[2]) continue;
      // The wedge is tall at −x: its −x is the lip, along f.
      const id = prop(u, [-f[0]!, -f[1]!, -f[2]!], 2.4, 2.2, -o.height(u[0]!, u[1]!, u[2]!) + o.terrain(u[0]!, u[1]!, u[2]!));
      part(id, "wedge", [3.6, 0.95, 2.4], [0, 0, 0], P.night ? "#3a3668" : "#d9c8ad");
      part(id, "box", [0.14, 0.97, 2.44], [-1.8, 0, 0], P.accent, { emissive: true });
    }
    // The rover: a pad on the ground under it (the chart's plane: it carries the blob shadow) and the
    // body on its springs: deck, cab, solar wing, mast and dish, lights, a thruster; four wheels.
    dio.cluster("rover", { at: AN.subarray(NP * 3, NP * 3 + 3) });
    padO = dio.add({ id: "pad", shape: "group", size: [2.2, 0, 1.6], cluster: "rover", pick: false });
    body = dio.add({ id: "rv", shape: "group", size: [1.9, 0, 1.3], on: "pad", shadow: 0.42, pick: false, layer: 5 });
    const rp = (size: number[], pos: number[], color: string, x: { shape?: "box" | "wedge" | "cyl"; emissive?: boolean; sides?: number; top?: number; rot?: number[] } = {}) =>
      dio.add({ shape: x.shape || "box", size, pos, rot: x.rot, on: "rv", color, emissive: x.emissive, sides: x.sides, top: x.top, pick: false });
    rp([1.7, 0.16, 1.0], [0, -0.2, 0], P.chassis);
    rp([1.3, 0.26, 0.96], [-0.1, -0.06, 0], P.body);
    rp([0.5, 0.26, 0.96], [0.82, -0.06, 0], P.body, { shape: "wedge", rot: [0, Math.PI, 0] });
    rp([0.62, 0.36, 0.7], [0.18, 0.2, 0], P.body);
    rp([0.12, 0.24, 0.62], [0.5, 0.24, 0], P.visor, { rot: [0, 0, -0.35] });
    rp([1.32, 0.05, 0.98], [-0.1, 0.2, 0], P.accent);
    rp([0.46, 0.035, 1.24], [-0.56, 0.5, 0], P.panel, { rot: [0, 0, 0.42] });
    for (const zz of [-0.31, 0, 0.31]) rp([0.44, 0.04, 0.02], [-0.56, 0.51, zz], P.panel2, { rot: [0, 0, 0.42] });
    rp([0.06, 0.3, 0.06], [-0.56, 0.22, 0], P.hub);
    rp([0.05, 0.62, 0.05], [0.0, 0.5, -0.32], P.hub, { shape: "cyl", sides: 5 });
    rp([0.22, 0.07, 0.22], [0.0, 1.1, -0.32], P.body, { shape: "cyl", sides: 8, top: 1.5, rot: [0, 0, 0.6] });
    rp([0.06, 0.06, 0.06], [0.04, 1.16, -0.32], P.tail, { emissive: true });
    for (const zz of [-0.3, 0.3]) rp([0.04, 0.08, 0.16], [1.04, -0.02, zz], P.lamp, { emissive: true });
    for (const zz of [-0.32, 0.32]) rp([0.04, 0.08, 0.14], [-0.76, -0.02, zz], P.tail, { emissive: true });
    rp([0.22, 0.22, 0.34], [-0.82, -0.08, 0], P.chassis, { shape: "cyl", sides: 8, rot: [0, 0, Math.PI / 2] });
    flames.push(rp([0.5, 0.3, 0.3], [-0.94, -0.08, 0], P.flame, { shape: "cyl", sides: 6, top: 0, rot: [0, 0, Math.PI / 2], emissive: true }));
    for (let i = 0; i < 4; i++) {
      const hub = dio.add({ id: "hub" + i, shape: "group", size: [0.6, 0, 0.6], on: "rv", layer: 6, behind: 1.5 }), side = v.wheels[i * 2 + 1]! > 0 ? 1 : -1;
      dio.add({ shape: "cyl", sides: 12, size: [0.64, 0.26, 0.64], pos: [0, 0, -0.13], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: P.tyre, pick: false });
      dio.add({ shape: "cyl", sides: 8, size: [0.36, 0.04, 0.36], pos: [0, 0, side > 0 ? 0.13 : -0.17], rot: [Math.PI / 2, 0, 0], on: "hub" + i, color: P.hub, pick: false });
      dio.add({ size: [0.34, 0.06, 0.06], pos: [0, -0.03, side > 0 ? 0.17 : -0.18], on: "hub" + i, color: P.accent, pick: false });
      hubs.push(hub);
    }
    // Chasers: a dart hull, a canopy, two fins and a red underglow.
    for (let s = 0; s < SHIPS; s++) {
      const id = "s" + s, k = NP + 1 + s;
      dio.cluster(id, { at: AN.subarray(k * 3, k * 3 + 3) });
      const g = dio.add({ id, shape: "group", size: [1.6, 0, 1.2], cluster: id, pick: false, alpha: 0 });
      const sid = id + "x";
      dio.add({ id: sid, shape: "group", size: [1.6, 0, 1.2], on: id, pick: false });
      const sp = (size: number[], pos: number[], color: string, x: { shape?: "box" | "prism" | "cyl" | "wedge"; emissive?: boolean; outline?: number[][]; rot?: number[]; sides?: number; top?: number; taper?: number } = {}) =>
        dio.add({ shape: x.shape || "box", size: size.map((n) => n * 1.4), pos: pos.map((n) => n * 1.4), rot: x.rot, on: sid, color, emissive: x.emissive, outline: x.outline?.map((q) => q.map((n) => n * 1.4)), sides: x.sides, top: x.top, taper: x.taper, pick: false });
      sp([1, 0.22, 1], [0, 0, 0], P.hull, { shape: "prism", outline: [[0.95, 0], [-0.55, 0.62], [-0.32, 0], [-0.55, -0.62]], taper: 0.7 });
      sp([1, 0.12, 1], [0, 0.22, 0], P.hull2, { shape: "prism", outline: [[0.7, 0], [-0.4, 0.34], [-0.25, 0], [-0.4, -0.34]], taper: 1 });
      sp([0.42, 0.2, 0.26], [0.1, 0.3, 0], P.sglow, { shape: "cyl", sides: 6, top: 0.4, emissive: true });
      for (const zz of [-0.42, 0.42]) sp([0.36, 0.3, 0.05], [-0.38, 0.2, zz], P.hull2, { rot: [zz > 0 ? 0.4 : -0.4, 0, 0] });
      sp([0.12, 0.1, 0.62], [-0.5, 0.08, 0], P.sglow, { emissive: true });
      sp([0.9, 0.04, 0.9], [-0.05, -0.04, 0], P.sglow, { shape: "cyl", sides: 6, emissive: true });
      ships.push(g);
    }
    dust = dio.points({ cap: DUST, color: P.dust, layer: 4 });
    debris = dio.points({ cap: DEBRIS, color: P.spark, layer: 6 });
    bolts = dio.points({ cap: BOLTS, color: P.bolt, layer: 7, paint: paintBolt });
    dio.decal("rover", 3, paintBeam);
    sky = null;
    paintBeacons();
  }

  // ---- state ----
  const I = new Float64Array(6), GP = new Float64Array(6);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] gamepad, [5] drawn once, [6] width at the last framing.
  const V = new Float64Array(7);
  V[0] = V[1] = 1;
  let auto = false, dirty = true, hudDirty = true, toastT = 0, cardAt = -1, pulse = 0, spin = 0, tall = false, best = 0, said = "", sky: CanvasGradient | null = null;
  const was = new Float64Array(10).fill(-1);
  // The blast anchor (fx is screen space): the orb point of the newest blast and where it was drawn.
  const FXA = new Float64Array(5);
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const padHello = () => ((V[4] = 1), engine.wake());
  addEventListener("gamepadconnected", padHello, sig);
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** The camera: steady. One framing per stage shape (wide or tall), set when the width changes. */
  function frame() {
    const cam = dio.cam, W = dio.width, H = dio.height;
    tall = H / W > 0.9;
    cam.yaw = 0;
    cam.pitch = tall ? 0.62 : 0.54;
    cam.dist = tall ? 22 : 19;
    cam.fov = tall ? 0.74 : 0.6;
    cam.tx = 0; cam.ty = 0.6; cam.tz = tall ? -2.4 : -2;
    cam.ox = 0; cam.oy = tall ? 14 : 20;
    V[6] = W;
  }
  function eye() {
    const cam = dio.cam, cp = Math.cos(cam.pitch);
    view.eye(cam.tx + cam.dist * Math.sin(cam.yaw) * cp, cam.ty + cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * Math.cos(cam.yaw) * cp);
  }

  // Per-frame maths takes its inputs from typed arrays (a double passed to or returned from a call the
  // JIT does not inline is boxed): OQ = orb point in [0..2] → world [3..5], facing [6]; PQ = world
  // [0..2] → screen x, y, depth [3..5]; CB = the camera's basis (as diorama makes it).
  const OQ = new Float64Array(7), PQ = new Float64Array(6), CB = new Float64Array(14), HQ = o.HQ, LIGHTV = new Float64Array(3);
  /** OQ[3..5] = world of orb point OQ[0..2]; OQ[6] = how far the eye is over its tangent plane. */
  function ow() {
    const Q = view.Q, E = view.E, x = OQ[0]!, y = OQ[1]!, z = OQ[2]!, l = Math.sqrt(x * x + y * y + z * z) || 1;
    OQ[3] = Q[0]! * x + Q[1]! * y + Q[2]! * z;
    OQ[4] = Q[3]! * x + Q[4]! * y + Q[5]! * z - R;
    OQ[5] = Q[6]! * x + Q[7]! * y + Q[8]! * z;
    OQ[6] = (E[0]! * x + E[1]! * y + E[2]! * z) / l - l;
  }
  /** The camera basis for `pq` (call after the camera last changed). */
  function camBasis() {
    const c = dio.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    CB[0] = c.tx + c.dist * sy * cp; CB[1] = c.ty + c.dist * sp; CB[2] = c.tz + c.dist * cy * cp;
    const fx = -sy * cp, fy = -sp, fz = -cy * cp, rx = cy, rz = -sy;
    CB[3] = rx; CB[4] = 0; CB[5] = rz;
    CB[6] = -rz * fy; CB[7] = rz * fx - rx * fz; CB[8] = rx * fy;
    CB[9] = fx; CB[10] = fy; CB[11] = fz;
    CB[12] = dio.height / 2 / Math.tan(c.fov / 2);
    CB[13] = 0;
  }
  /** PQ[3..5] = screen x, y and depth of world PQ[0..2]; false behind the camera. */
  function pq() {
    const c = dio.cam, dx = PQ[0]! - CB[0]!, dy = PQ[1]! - CB[1]!, dz = PQ[2]! - CB[2]!, zz = dx * CB[9]! + dy * CB[10]! + dz * CB[11]!, k = CB[12]! / Math.max(zz, 0.05);
    PQ[3] = dio.width / 2 + c.ox + (dx * CB[3]! + dy * CB[4]! + dz * CB[5]!) * k;
    PQ[4] = dio.height / 2 + c.oy - (dx * CB[6]! + dy * CB[7]! + dz * CB[8]!) * k;
    PQ[5] = zz;
    return zz > 0.05;
  }
  /** Orb point OQ[0..2] to the screen (PQ[3..5]); false behind the camera. */
  function opq() {
    ow();
    PQ[0] = OQ[3]!; PQ[1] = OQ[4]!; PQ[2] = OQ[5]!;
    return pq();
  }

  /** Everything into world for this frame: the moon's turn, culling, anchors, the rover, the ships. */
  function pose() {
    euler(view.Q, moon.rot);
    eye();
    camBasis();
    cullTiles();
    poseProps();
    poseRover();
    poseShips();
    toWorld(dust, DO);
    toWorld(debris, BR);
    poseBolts();
    // The sun, turned with the moon.
    const Q = view.Q;
    LIGHTV[0] = Q[0]! * SUNV[0]! + Q[1]! * SUNV[1]! + Q[2]! * SUNV[2]!;
    LIGHTV[1] = Q[3]! * SUNV[0]! + Q[4]! * SUNV[1]! + Q[5]! * SUNV[2]!;
    LIGHTV[2] = Q[6]! * SUNV[0]! + Q[7]! * SUNV[1]! + Q[8]! * SUNV[2]!;
    dio.setLight(LIGHTV, P.amb);
  }
  /** Tiles past the horizon or off the picture are hidden (most of the moon, every frame). */
  function cullTiles() {
    const W = dio.width, H = dio.height, f = CB[12]!, C = T.centre;
    let shown = 0;
    for (let i = 0; i < T.n; i++) {
      OQ[0] = C[i * 3]!; OQ[1] = C[i * 3 + 1]!; OQ[2] = C[i * 3 + 2]!;
      ow();
      let vis = OQ[6]! > -0.9;
      if (vis) {
        PQ[0] = OQ[3]!; PQ[1] = OQ[4]!; PQ[2] = OQ[5]!;
        if (!pq()) vis = false;
        else { const m = (2.6 * f) / Math.max(1, PQ[5]!); vis = PQ[3]! > -m && PQ[3]! < W + m && PQ[4]! > -m && PQ[4]! < H + m; }
      }
      tiles[i]!.hidden = !vis;
      if (vis) shown++;
    }
    V[3] = shown;
  }
  /** Props: their alpha (past the horizon, picked up, smashed) and their sort anchors; the friends. */
  function poseProps() {
    const Q = view.Q, E = view.E;
    for (let k = 0; k < props.length; k++) {
      OQ[0] = PU[k * 3]!; OQ[1] = PU[k * 3 + 1]!; OQ[2] = PU[k * 3 + 2]!;
      ow();
      const vis = OQ[6]! > -PR[k]! - 0.6, p = props[k]!;
      p.alpha = vis ? 1 : 0;
      if (!vis) continue;
      // The anchor: the point moved PN toward the eye, in world.
      const x = OQ[0]!, y = OQ[1]!, z = OQ[2]!;
      let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
      const l = PN[k]! / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
      AN[k * 3] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
      AN[k * 3 + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
      AN[k * 3 + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
    }
    for (let i = 0; i < CRYSTALS; i++) {
      if (run.got[i]) crystals[i]!.alpha = 0;
      crystals[i]!.rot[1] = spin + i;
    }
    for (let i = 0; i < CRATES; i++) if (run.smashed[i]) crates[i]!.alpha = 0;
    // Friends: face the rover; a hop and a wave while they react.
    for (let i = 0; i < FRIENDS; i++) {
      const fr = friends[i]!, g = fr[0]!, al = fr[1]!, ar = fr[2]!, r = run.fReact[i]!, k = r > 0 ? Math.abs(Math.sin(r * 9)) : 0;
      g.pos[1] = r > 0 ? Math.abs(Math.sin(r * 7)) * 0.35 : 0;
      al.rot[0] = -0.12 - k * 2.4;
      ar.rot[0] = 0.12 + (r > 0 ? Math.abs(Math.sin(r * 9 + 1.3)) * 2.4 : 0);
      const F = FF.subarray(i * 9, i * 9 + 9), dx = run.P[0]! - run.friend[i * 3]! * R, dy = run.P[1]! - run.friend[i * 3 + 1]! * R, dz = run.P[2]! - run.friend[i * 3 + 2]! * R;
      g.rot[1] = Math.atan2(-(dx * F[6]! + dy * F[7]! + dz * F[8]!), dx * F[0]! + dy * F[1]! + dz * F[2]!);
    }
  }
  /** The rover: the pad is the chart (orb → world), the body rides on it at drive's pose. */
  function poseRover() {
    const F = run.chart.F, g = R + run.chart.ground();
    OQ[0] = F[3]! * g; OQ[1] = F[4]! * g; OQ[2] = F[5]! * g;
    ow();
    padO.pos[0] = OQ[3]!; padO.pos[1] = OQ[4]!; padO.pos[2] = OQ[5]!;
    rotOf(F, true, padO.rot);
    body.pos[0] = v.pos[0]!; body.pos[1] = v.pos[1]! - (g - R); body.pos[2] = v.pos[2]!;
    body.rot.set(v.rot);
    const crashed = v.crashed, hurt = run.S[HURT]!;
    body.alpha = hurt > 0 && !crashed && ((hurt * 10) | 0) % 2 ? 0.35 : 1;
    for (let i = 0; i < 4; i++) {
      const h = hubs[i]!;
      h.pos[0] = v.wheels[i * 2]!;
      h.pos[1] = crashed ? -0.2 : -(v.rest - v.comp[i]!);
      h.pos[2] = v.wheels[i * 2 + 1]!;
      h.rot[1] = i < 2 && !crashed ? -v.steerAngle : 0;
      h.rot[2] = -v.spin[i]!;
    }
    flames[0]!.alpha = I[IN_BOOST]! > 0 && run.S[BOOST]! > 0.02 && v.air === 0 ? 1 : 0;
    // Its sort anchor: nudged toward the eye past the tiles under it.
    const Q = view.Q, E = view.E, x = run.P[0]!, y = run.P[1]!, z = run.P[2]!;
    let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
    const l = 2.2 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
    dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
    AN[NP * 3] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
    AN[NP * 3 + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
    AN[NP * 3 + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
  }
  /** Ships: hover over the ground, nose along their travel, glow red as they burn up in the sun. */
  function poseShips() {
    const SH = run.SH;
    for (let s = 0; s < SHIPS; s++) {
      const q = s * 9, g2 = ships[s]!;
      if (!SH[q]) { g2.alpha = 0; continue; }
      HQ[0] = SH[q + 1]!; HQ[1] = SH[q + 2]!; HQ[2] = SH[q + 3]!;
      o.hq();
      const h = R + HQ[3]! + 1.5 + Math.sin(engine.time * 3 + s) * 0.18;
      OQ[0] = SH[q + 1]! * h; OQ[1] = SH[q + 2]! * h; OQ[2] = SH[q + 3]! * h;
      ow();
      const fade = SH[q + 8]! > 0 ? Math.max(0, 1 - SH[q + 8]! / 1.4) : Math.min(1, SH[q + 7]! * 3);
      g2.alpha = OQ[6]! > -1.5 ? fade : 0;
      g2.pos[0] = OQ[3]!; g2.pos[1] = OQ[4]!; g2.pos[2] = OQ[5]!;
      const vx = SH[q + 4]!, vy = SH[q + 5]!, vz = SH[q + 6]!;
      if (vx * vx + vy * vy + vz * vz > 0.04) o.frameA(SH, q + 1, SH, q + 4, F9);
      else (SV3[0] = run.P[0]! - SH[q + 1]! * R), (SV3[1] = run.P[1]! - SH[q + 2]! * R), (SV3[2] = run.P[2]! - SH[q + 3]! * R), o.frameA(SH, q + 1, SV3, 0, F9);
      rotOf(F9, true, g2.rot);
      g2.rot[0] = g2.rot[0]! + Math.sin(engine.time * 2 + s) * 0.12;
      const k = (NP + 1 + s) * 3, E = view.E, Q = view.Q, x = OQ[0]!, y = OQ[1]!, z = OQ[2]!;
      let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
      const l = 1.2 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
      AN[k] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
      AN[k + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
      AN[k + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
      g2.tint = SH[q + 8]! > 0 ? P.sun1 : null;
    }
  }
  function poseBolts() {
    const BO = run.BO;
    for (let b = 0; b < BOLTS; b++) {
      const k = b * 7;
      if (BO[k]! <= 0) { bolts.a[b] = 0; continue; }
      HQ[0] = BO[k + 1]!; HQ[1] = BO[k + 2]!; HQ[2] = BO[k + 3]!;
      o.hq();
      const h = R + HQ[3]! + 0.75;
      OQ[0] = BO[k + 1]! * h; OQ[1] = BO[k + 2]! * h; OQ[2] = BO[k + 3]! * h;
      ow();
      bolts.x[b] = OQ[3]!; bolts.y[b] = OQ[4]!; bolts.z[b] = OQ[5]!; bolts.r[b] = 0.1; bolts.a[b] = OQ[6]! > -0.5 ? 1 : 0;
    }
    bolts.n = BOLTS;
  }
  function toWorld(pool: DioramaPoints, A: Float64Array) {
    for (let i = 0; i < pool.n; i++) {
      const k = i * 8;
      if (A[k + 6]! <= 0) { pool.a[i] = 0; continue; }
      OQ[0] = A[k]!; OQ[1] = A[k + 1]!; OQ[2] = A[k + 2]!;
      ow();
      pool.x[i] = OQ[3]!; pool.y[i] = OQ[4]!; pool.z[i] = OQ[5]!;
      if (OQ[6]! < -0.8) pool.a[i] = 0;
    }
  }
  function paintBeacons() {
    const nx = run.S[NEXT]!;
    for (let k = 0; k < BEACONS; k++) {
      const col = run.S[PH] !== DONE && k === nx ? P.bNext : run.lit[k] && run.S[PH] !== READY ? P.bLit : P.bIdle;
      for (const p of beacons[k]!) p.color = col;
    }
  }

  // ---- FX: dust and debris (orb space, gravity to the centre), bolts, blasts ----
  function puff(pool: DioramaPoints, A: Float64Array, cap: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number) {
    let j = pool.n < cap ? pool.n++ : -1;
    if (j < 0) { let lo = Infinity; for (let i = 0; i < cap; i++) if (A[i * 8 + 6]! < lo) (lo = A[i * 8 + 6]!), (j = i); }
    const k = j * 8;
    A[k] = x; A[k + 1] = y; A[k + 2] = z; A[k + 3] = vx; A[k + 4] = vy; A[k + 5] = vz; A[k + 6] = life; A[k + 7] = life;
    pool.r[j] = r; pool.a[j] = 1;
  }
  function stepPool(pool: DioramaPoints, A: Float64Array, dt: number, g: number, grow: number, a0: number, drag: number) {
    let live = 0;
    for (let i = 0; i < pool.n; i++) {
      const k = i * 8, l = A[k + 6]!;
      if (l <= 0) continue;
      const nl = l - dt, x = A[k]!, y = A[k + 1]!, z = A[k + 2]!, d = Math.sqrt(x * x + y * y + z * z);
      A[k + 6] = nl;
      A[k + 3] = A[k + 3]! * (1 - drag * dt) - (x / d) * g * dt;
      A[k + 4] = A[k + 4]! * (1 - drag * dt) - (y / d) * g * dt;
      A[k + 5] = A[k + 5]! * (1 - drag * dt) - (z / d) * g * dt;
      A[k] = x + A[k + 3]! * dt; A[k + 1] = y + A[k + 4]! * dt; A[k + 2] = z + A[k + 5]! * dt;
      pool.r[i] = pool.r[i]! + grow * dt;
      pool.a[i] = nl > 0 ? a0 * (nl / A[k + 7]!) : 0;
      if (nl > 0) live++;
    }
    if (!live) pool.n = 0;
    return live > 0;
  }
  /** A spray from orb point (x, y, z): out and up (along its radius). */
  function spray(pool: DioramaPoints, A: Float64Array, cap: number, x: number, y: number, z: number, n: number, sp: number, up: number, life: number, r: number) {
    const l = Math.sqrt(x * x + y * y + z * z), ux = x / l, uy = y / l, uz = z / l;
    for (let k = 0; k < n; k++) {
      let ax = rnd() * 2 - 1, ay = rnd() * 2 - 1, az = rnd() * 2 - 1;
      const d = ax * ux + ay * uy + az * uz;
      ax -= d * ux; ay -= d * uy; az -= d * uz;
      const s = sp * (0.4 + rnd()), u2 = up * (0.4 + rnd());
      puff(pool, A, cap, x, y, z, ax * s + ux * u2, ay * s + uy * u2, az * s + uz * u2, life * (0.6 + rnd() * 0.6), r);
    }
  }
  function blast(x: number, y: number, z: number, power: number, word: number, col: number) {
    OQ[0] = x; OQ[1] = y; OQ[2] = z;
    if (!opq() || OQ[6]! < -1) return;
    FXA[0] = x; FXA[1] = y; FXA[2] = z; FXA[3] = PQ[3]!; FXA[4] = PQ[4]!;
    if (power > 0) fx.blast(PQ[3]!, PQ[4]!, power, col);
    if (word >= 0) fx.word(PQ[3]!, PQ[4]! - 18, word, col, 18);
  }
  let emitK = 0;
  function stepFx(dt: number) {
    if (run.S[PH] === RUN && !v.crashed) {
      emitK += v.dust * 60 * dt + (Math.abs(v.speed) > 4 && v.air === 0 ? Math.abs(v.speed) * 0.6 * dt : 0);
      while (emitK >= 1) {
        emitK -= 1;
        const w = 2 + (rnd() < 0.5 ? 1 : 0);
        const F = run.chart.F, x = v.wheel[w * 3]!, y = R + v.wheel[w * 3 + 1]! - 0.25, z = v.wheel[w * 3 + 2]!;
        tmp[0] = y * F[3]! + x * F[0]! + z * F[6]!; tmp[1] = y * F[4]! + x * F[1]! + z * F[7]!; tmp[2] = y * F[5]! + x * F[2]! + z * F[8]!;
        const l = Math.sqrt(tmp[0]! * tmp[0]! + tmp[1]! * tmp[1]! + tmp[2]! * tmp[2]!);
        puff(dust, DO, DUST, tmp[0]!, tmp[1]!, tmp[2]!, -run.Fw[0]! * 1.2 + (rnd() - 0.5) + (tmp[0]! / l) * 1.2, -run.Fw[1]! * 1.2 + (rnd() - 0.5) + (tmp[1]! / l) * 1.2, -run.Fw[2]! * 1.2 + (rnd() - 0.5) + (tmp[2]! / l) * 1.2, 0.6 + rnd() * 0.5, 0.12);
      }
    }
    let any = stepPool(dust, DO, dt, 1.2, 0.3, 0.42, 1.2);
    if (stepPool(debris, BR, dt, 9, -0.02, 1, 0.6)) any = true;
    fx.step(dt);
    if (fx.live || fx.shake > 0) any = true;
    return any;
  }

  // ---- events from the run: stickers, sound, FX ----
  function events() {
    const S = run.S;
    for (let k = 0; k < run.n; k++) {
      const e = k * 5, type = run.ev[e]!, val = run.ev[e + 1]!, x = run.ev[e + 2]!, y = run.ev[e + 3]!, z = run.ev[e + 4]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast("GO! LIGHT THE BEACONS", "go"), paintBeacons();
      else if (type === E_CRYSTAL) engine.events.emit("crystal"), spray(debris, BR, DEBRIS, x, y, z, 10, 3, 4, 0.6, 0.08), blast(x, y, z, 0, 2, 4);
      else if (type === E_BEACON || type === E_LAP) {
        engine.events.emit(type === E_LAP ? "lap" : "beacon");
        spray(debris, BR, DEBRIS, x * 1.12, y * 1.12, z * 1.12, 18, 4, 5, 0.8, 0.1);
        blast(x, y, z, 0, type === E_LAP ? 4 : 3, 4);
        if (type === E_LAP) toast(`LAP ${val} · +1500`, "go"), say(`Lap ${val} of the moon`);
        else toast(`BEACON ${val}/${BEACONS - 1} LIT`, "clean"), say(`Beacon ${val} lit`);
        paintBeacons();
      } else if (type === E_FRIEND) {
        engine.events.emit("friend");
        const g = val & 3;
        toast(g === G_BOOST ? "A FRIEND! BOOST REFILLED" : g === G_CRYSTALS ? "A FRIEND! +3 CRYSTALS" : S[SHD]! >= SHIELDS ? "A FRIEND! SHIELDS FULL +100" : "A FRIEND! +1 SHIELD", "clean");
        blast(x, y, z, 0, g === G_BOOST ? 6 : g === G_CRYSTALS ? 8 : 7, 5);
        spray(debris, BR, DEBRIS, x * 1.03, y * 1.03, z * 1.03, 12, 2, 5, 0.9, 0.08);
      } else if (type === E_SHOT) engine.events.emit("shot");
      else if (type === E_KILL) {
        engine.events.emit("kill");
        blast(x, y, z, 1.15, val & 1 ? 0 : 1, 4);
        spray(debris, BR, DEBRIS, x, y, z, 22, 6, 3, 1.1, 0.1);
        fx.kick(4);
      } else if (type === E_HIT) {
        engine.events.emit("hit");
        blast(x, y, z, 1.3, 10, 3);
        spray(debris, BR, DEBRIS, x, y, z, 20, 5, 4, 1, 0.1);
        toast(val > 0 ? `RAMMED! ${val} SHIELD${val > 1 ? "S" : ""} LEFT` : "RAMMED!", "bad");
        say(`Rammed, ${val} shields left`);
      } else if (type === E_CRATE) engine.events.emit("crate"), spray(debris, BR, DEBRIS, x, y, z, 16, 4, 5, 0.9, 0.12), blast(x, y, z, 0, 11, 1);
      else if (type === E_DARK) {
        engine.events.emit(val ? "dark" : "right");
        toast(val ? "NIGHT SIDE · CHASERS INCOMING" : "BACK IN THE SUN", val ? "bad" : "go");
        say(val ? "Night side. Chasers incoming" : "Back in the sun");
      } else if (type === E_JUMP) engine.events.emit("jump"), spray(dust, DO, DUST, x, y, z, 8, 2.5, 0.8, 0.6, 0.16);
      else if (type === E_LAND) spray(dust, DO, DUST, x, y, z, 10, 3, 0.6, 0.7, 0.18);
      else if (type === E_CRASH) engine.events.emit("hit"), toast("FLIPPED IT", "meh"), spray(dust, DO, DUST, x, y, z, 14, 3, 1.2, 0.8, 0.2);
      else if (type === E_RIGHT) engine.events.emit("right");
      else if (type === E_BUMP) engine.events.emit("crate");
      else if (type === E_BURN) spray(debris, BR, DEBRIS, x, y, z, 10, 3, 3, 0.7, 0.08);
      else if (type === E_DOWN || type === E_TIME) {
        engine.events.emit("over");
        if (type === E_DOWN) blast(x, y, z, 1.4, -1, 3);
        cardAt = engine.time + 1.2;
        engine.busy(1.4);
        paintBeacons();
      }
    }
    run.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "mr-toast mr-" + kind;
    toastEl.hidden = false;
    toastT = 1.7;
  }
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  const clock = (s: number) => `${(s / 60) | 0}:${String(Math.ceil(s) % 60 === 0 && s % 60 > 59 ? 0 : Math.floor(s % 60)).padStart(2, "0")}`;
  function hudWrite() {
    const S = run.S, sec = Math.ceil(S[CLK]!);
    if (was[0] !== sec) (was[0] = sec), (timeEl.textContent = clock(sec)), timeEl.parentElement!.classList.toggle("mr-low", sec <= 20 && S[PH] === RUN);
    const nx = S[NEXT]!, lp = S[LAPS]!;
    if (was[1] !== nx || was[2] !== lp) (was[1] = nx), (was[2] = lp), (beaEl.textContent = nx === 0 ? `FINISH LAP ${lp + 1}` : `BEACON ${nx}/${BEACONS - 1}${lp ? ` · LAP ${lp + 1}` : ""}`);
    if (was[3] !== S[CRY]) (was[3] = S[CRY]!), (cryEl.textContent = "" + S[CRY]);
    if (was[4] !== S[SCORE]) (was[4] = S[SCORE]!), (scoreEl.textContent = S[SCORE]!.toLocaleString("en-US"));
    if (was[5] !== S[SHD]) { was[5] = S[SHD]!; for (let i = 0; i < SHIELDS; i++) shdEls[i]!.classList.toggle("mr-off", i >= S[SHD]!); }
    const b = Math.round(S[BOOST]! * 20);
    if (was[6] !== b) (was[6] = b), (boostEl.style.width = b * 5 + "%"), boostChip.classList.toggle("mr-full", b >= 20);
    const hint = S[PH] === READY ? (thePad.el.offsetParent ? "Stick to drive (up: gas) · ★ FIRE · BOOST · JUMP" : "↑ W drive · ← → steer · Space fire · Shift boost · J jump") : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function showEnd() {
    cardAt = -1;
    const S = run.S, down = S[SHD]! <= 0, score = S[SCORE]!, isBest = score > best;
    if (isBest) best = score;
    cardH.textContent = down ? "ROVER DOWN" : "TIME UP";
    cardT.textContent = `${score.toLocaleString("en-US")} pts${isBest ? " · BEST" : ` · best ${best.toLocaleString("en-US")}`}`;
    let lit = 0;
    for (let k = 1; k < BEACONS; k++) lit += run.lit[k] ? 1 : 0;
    cardS.textContent = `${S[LAPS]} ${S[LAPS] === 1 ? "lap" : "laps"} of the moon · ${S[LAPS]! * (BEACONS - 1) + lit} beacons · ${S[CRY]} crystals · ${S[KILLS]} chasers · ${S[MET]} friends`;
    card.hidden = false;
    say(`${down ? "Rover down" : "Time up"}: ${score} points`);
    again.focus({ preventScroll: true });
    hudDirty = dirty = true;
  }
  function restart() {
    run.reset();
    card.hidden = true;
    cardAt = -1;
    dust.n = debris.n = 0;
    fx.clear();
    view.follow(run.U, run.Fw, 1);
    was.fill(-1);
    hudDirty = dirty = true;
    paintBeacons();
    engine.busy(1);
    play.focus({ preventScroll: true });
  }

  // ---- drawing extras: the sky, the moon's rim glow, the headlight beam, bolts, the beacon marker ----
  /** A direction in the sky (orb space, D[i..i+2]) on the screen: tmp = [x, y, depth]. */
  function skyAt(D: ArrayLike<number>, i: number) {
    const Q = view.Q, x = D[i]!, y = D[i + 1]!, z = D[i + 2]!;
    PQ[0] = CB[0]! + (Q[0]! * x + Q[1]! * y + Q[2]! * z) * 900;
    PQ[1] = CB[1]! + (Q[3]! * x + Q[4]! * y + Q[5]! * z) * 900;
    PQ[2] = CB[2]! + (Q[6]! * x + Q[7]! * y + Q[8]! * z) * 900;
    const ok = pq();
    tmp[0] = PQ[3]!; tmp[1] = PQ[4]!; tmp[2] = PQ[5]!;
    return ok;
  }
  function paintSky(ctx: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height, cam = dio.cam, f = dio.focal();
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    void cam;
    const ex = CB[0]!, ey = CB[1]!, ez = CB[2]!;
    ctx.fillStyle = P.star;
    for (let i = 0; i < 180; i++) {
      if (!skyAt(STARS, i * 4) || tmp[0]! < -2 || tmp[0]! > W + 2 || tmp[1]! < -2 || tmp[1]! > H + 2) continue;
      const b = STARS[i * 4 + 3]!;
      ctx.globalAlpha = P.night ? 0.3 + b * 0.7 : 0.35 + b * 0.5;
      const s = b > 0.92 ? 2.4 : 1.4;
      ctx.fillRect(tmp[0]! - s / 2, tmp[1]! - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    // The ringed planet: banded, a ring tilted across it (back half, planet, front half).
    if (skyAt(PLANET, 0)) {
      const x = tmp[0]!, y = tmp[1]!, r = f * 0.13;
      if (x > -r * 3 && x < W + r * 3 && y > -r * 3 && y < H + r * 3) {
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.strokeStyle = P.ring;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2, r * 0.5, -0.3, Math.PI, TAU);
        ctx.stroke();
        ctx.fillStyle = P.planet;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.translate(x, y);
        ctx.rotate(-0.3);
        ctx.fillStyle = P.band;
        ctx.fillRect(-r, -r * 0.42, r * 2, r * 0.22);
        ctx.fillRect(-r, r * 0.18, r * 2, r * 0.14);
        ctx.fillStyle = P.band2;
        ctx.fillRect(-r, -r * 0.08, r * 2, r * 0.1);
        ctx.fillStyle = P.sky0;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(r * 0.35, -r * 0.3, r * 1.05, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.strokeStyle = P.ring;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2, r * 0.5, -0.3, 0, Math.PI);
        ctx.stroke();
      }
    }
    // The sun, when it is up.
    if (skyAt(SUNV, 0) && tmp[2]! > 0) {
      const x = tmp[0]!, y = tmp[1]!, r = f * 0.06;
      if (x > -r * 4 && x < W + r * 4 && y > -r * 4 && y < H + r * 4) {
        const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.4);
        g.addColorStop(0, P.sun1);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = P.night ? 0.5 : 0.4;
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.sun0;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    // The moon's limb: the circle where the eye's rays graze the sphere, a neon rim behind it.
    {
      const cx = 0, cy = -R, cz = 0, dx = ex - cx, dy = ey - cy, dz = ez - cz, d2 = dx * dx + dy * dy + dz * dz, k = (R * R) / d2, rr = R * Math.sqrt(1 - k);
      const ox = cx + dx * k, oy = cy + dy * k, oz = cz + dz * k, dl = Math.sqrt(d2), ax = dx / dl, ay = dy / dl, az = dz / dl;
      // Two axes square to the eye ray.
      let bx = -az, by = 0, bz = ax;
      const bl = Math.hypot(bx, bz) || 1;
      bx /= bl; bz /= bl;
      const qx = ay * bz - az * by, qy = az * bx - ax * bz, qz = ax * by - ay * bx;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * TAU, c0 = Math.cos(t) * rr, s0 = Math.sin(t) * rr;
        PQ[0] = ox + bx * c0 + qx * s0; PQ[1] = oy + by * c0 + qy * s0; PQ[2] = oz + bz * c0 + qz * s0;
        if (!pq()) { started = false; continue; }
        if (!started) ctx.moveTo(PQ[3]!, PQ[4]!), (started = true);
        else ctx.lineTo(PQ[3]!, PQ[4]!);
      }
      ctx.strokeStyle = P.glow;
      ctx.lineJoin = "round";
      if (P.night) ctx.globalCompositeOperation = "lighter";
      for (const [w, a] of [[16, 0.08], [8, 0.16], [3, 0.5]] as const) (ctx.lineWidth = w), (ctx.globalAlpha = a), ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
  /** A point on the ground `fw` ahead and `sd` to the right of the rover, on the screen (tmp). */
  function beamAt(fw: number, sd: number) {
    const F = run.chart.F, cy = v._s[20]!, sy = v._s[21]!, x = cy * fw + sy * sd, z = -sy * fw + cy * sd;
    const px = R * F[3]! + x * F[0]! + z * F[6]!, py = R * F[4]! + x * F[1]! + z * F[7]!, pz = R * F[5]! + x * F[2]! + z * F[8]!, l = Math.sqrt(px * px + py * py + pz * pz);
    HQ[0] = px / l; HQ[1] = py / l; HQ[2] = pz / l;
    o.hq();
    const r = R + HQ[3]! + 0.05;
    OQ[0] = HQ[0]! * r; OQ[1] = HQ[1]! * r; OQ[2] = HQ[2]! * r;
    const ok = opq();
    tmp[0] = PQ[3]!; tmp[1] = PQ[4]!;
    return ok;
  }
  /** The headlights on the ground ahead, on the night side. */
  function paintBeam(ctx: CanvasRenderingContext2D) {
    if (!run.S[DK] || v.crashed) return;
    if (!beamAt(1.0, -0.35)) return;
    ctx.beginPath();
    ctx.moveTo(tmp[0]!, tmp[1]!);
    if (!beamAt(6.6, -2.4)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(7.2, 0)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(6.6, 2.4)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(1.0, 0.35)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.closePath();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.lamp;
    ctx.globalAlpha = P.night ? 0.13 : 0.07;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintBolt(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(1.6, p.sr[i]!);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.bolt;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.8, r * 1.5, r * 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    // The blasts (screen space), carried with the ground they went off on.
    if (fx.live) {
      OQ[0] = FXA[0]!; OQ[1] = FXA[1]!; OQ[2] = FXA[2]!;
      const ok = opq(), dx = ok ? PQ[3]! - FXA[3]! : 0, dy = ok ? PQ[4]! - FXA[4]! : 0;
      ctx.save();
      ctx.translate(dx, dy);
      fx.draw(ctx, !P.night);
      ctx.restore();
    }
    const S = run.S;
    if (S[PH] === DONE) return;
    // The next beacon: a sticker over it, or an arrow at the edge of the picture toward it.
    const nx = S[NEXT]!, ux = run.beacon[nx * 3]!, uy = run.beacon[nx * 3 + 1]!, uz = run.beacon[nx * 3 + 2]!;
    HQ[0] = ux; HQ[1] = uy; HQ[2] = uz;
    o.hq();
    const g0 = R + HQ[3]!, h = g0 + 4.4, W = dio.width, H = dio.height, label = LABELS[nx]!;
    OQ[0] = ux * g0; OQ[1] = uy * g0; OQ[2] = uz * g0;
    let seen = opq() && OQ[6]! > -2.5 && PQ[3]! > 16 && PQ[3]! < W - 16 && PQ[4]! < H - 16;
    if (seen) {
      OQ[0] = ux * h; OQ[1] = uy * h; OQ[2] = uz * h;
      seen = opq();
      tmp[0] = PQ[3]!; tmp[1] = Math.max(PQ[4]!, tall ? 116 : 100);
    }
    ctx.font = "900 13px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (seen) {
      const x = tmp[0]!, y = tmp[1]!, w = 26, hh = 22;
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.roundRect(x - w / 2 + 3, y - hh + 3, w, hh, 6);
      ctx.fill();
      ctx.fillStyle = P.bNext;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - hh, w, hh, 6);
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x + 5, y);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x, y - hh / 2 + 0.5);
      return;
    }
    // Off the picture: the beacon's bearing from the rover (in the view: right is +x, ahead is −z).
    const Q = view.Q, bx = ux - view.up[0]!, by = uy - view.up[1]!, bz = uz - view.up[2]!;
    const rx = Q[0]! * bx + Q[1]! * by + Q[2]! * bz, rz = Q[6]! * bx + Q[7]! * by + Q[8]! * bz, a = Math.atan2(rx, -rz);
    PQ[0] = padO.pos[0]!; PQ[1] = padO.pos[1]! + 0.6; PQ[2] = padO.pos[2]!;
    pq();
    const cx = PQ[3]!, cy = PQ[4]!, rad = Math.max(70, Math.min(W, H) * 0.2), px = cx + Math.sin(a) * rad, py = cy - Math.cos(a) * rad * 0.8;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.moveTo(3, -13 + 3); ctx.lineTo(13 + 3, 8 + 3); ctx.lineTo(3, 3 + 3); ctx.lineTo(-10 + 3, 8 + 3); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.bNext;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -13); ctx.lineTo(13, 8); ctx.lineTo(0, 3); ctx.lineTo(-13, 8); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = P.night ? "#ffffff" : P.ink;
    ctx.fillText(label, px, py + 20);
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
        const sr = stage.getBoundingClientRect(), cr = getComputedStyle(canvas).position === "absolute" ? canvas.getBoundingClientRect() : sr;
        const w = cr.width || 1, h = cr.height || 1;
        dio.resize(w, h, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        sky = null;
        // Steady framing: only a new width (or shape) frames again; a phone's URL bar changing the
        // height alone does not.
        if (V[6] !== w || tall !== h / w > 0.9) frame();
        hudDirty = dirty = true;
      }
      if (V[4] && !readPad()) GP.fill(0);
      if (first && V[5]) (first = null), play.focus({ preventScroll: true });
    },
    step(e, dt) {
      if (cardAt > 0 && e.time >= cardAt) showEnd();
      // Inputs: keys and the pad (controls), the stick, a gamepad, or the autopilot.
      if (auto) run.autopilot(I);
      else {
        const sx = c.stick.active ? c.stick.x : 0, sy = c.stick.active ? c.stick.y : 0;
        I[IN_GAS] = c.down(GAS) || sy < -0.25 || GP[1]! < -0.3 ? 1 : Math.max(GP[2]!, 0);
        I[IN_BRAKE] = c.down(BRAKE) || sy > 0.35 || GP[1]! > 0.4 ? 1 : GP[3]!;
        I[IN_STEER] = (+c.down(RIGHT) - +c.down(LEFT)) || sx || GP[0]!;
        I[IN_FIRE] = c.down(FIRE) || GP[4]! > 0.5 ? 1 : 0;
        I[IN_BOOST] = c.down(BOOSTK) || GP[5]! > 0.5 ? 1 : 0;
        I[IN_JUMP] = c.hit(JUMP) ? 1 : 0;
      }
      if (!card.hidden || cardAt > 0) I.fill(0);
      const ph0 = run.S[PH]!;
      let moving = run.step(dt, I);
      if (run.n) events(), (moving = true);
      // The view: up snaps to the rover's ground, forward eases after its heading.
      const gap = view.follow(run.U, run.Fw, Math.min(1, 2.4 * dt), 1);
      if (gap > 1e-6) moving = true;
      if (stepFx(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (ph0 === RUN || run.S[PH] === RUN) moving = true;
      if (moving) (pulse += dt), (spin += dt * 1.6), e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      const nx = run.S[NEXT]!;
      const bk = beacons[nx]!, col = run.S[PH] === DONE ? P.bIdle : Math.sin(pulse * 6) > -0.3 ? P.bNext : P.bIdle;
      for (let k = 0; k < bk.length; k++) bk[k]!.color = col;
      pose();
      const cam = dio.cam, k = fx.shake * 0.6, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      camBasis();
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });
  /** The first gamepad: left stick steer (and up for gas), RT gas, LT brake, A fire, X / RB boost, B jump. */
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return false;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      const ax = p.axes, b = p.buttons, bv = (k: number) => (b[k] ? b[k]!.value || (b[k]!.pressed ? 1 : 0) : 0);
      const dz = (a: number) => (a > 0.15 ? (a - 0.15) / 0.85 : a < -0.15 ? (a + 0.15) / 0.85 : 0);
      GP[0] = dz(ax[0] ?? 0); GP[1] = dz(ax[1] ?? 0); GP[2] = bv(7); GP[3] = bv(6); GP[4] = bv(0); GP[5] = Math.max(bv(2), bv(5));
      if (bv(1) > 0.5 && !was[9]) c.press("jump"), (was[9] = 1);
      else if (bv(1) <= 0.5 && was[9] === 1) c.press("jump", false), (was[9] = 0);
      if (GP[0] || GP[1] || GP[2] || GP[3] || GP[4] || GP[5]) (auto = false), engine.wake();
      return true;
    }
    return false;
  }

  // ---- input: keys on the stage, the pad, the card ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", Space: "fire", KeyF: "fire", ShiftLeft: "boost", ShiftRight: "boost", KeyJ: "jump", KeyE: "jump" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyR") return void (e.preventDefault(), restart());
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad") || (e.target as Element).closest?.(".mr-card")) return;
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
  }, sig);
  muteK.addEventListener("click", toggle, sig);
  again.addEventListener("click", restart, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  /** Put the rover `back` units short of orb point u, facing it (still, on the ground). */
  function near(u: ArrayLike<number>, back: number) {
    const ux = u[0]!, uy = u[1]!, uz = u[2]!, F = run.chart.F;
    // Along the great circle from the rover's ground point: a point `back` units before u.
    let dx = F[3]! - ux, dy = F[4]! - uy, dz = F[5]! - uz;
    const dd = dx * ux + dy * uy + dz * uz;
    dx -= dd * ux; dy -= dd * uy; dz -= dd * uz;
    const dl = Math.hypot(dx, dy, dz) || 1, a = back / R;
    const px = ux + (dx / dl) * a, py = uy + (dy / dl) * a, pz = uz + (dz / dl) * a, pl = Math.hypot(px, py, pz);
    tmp[0] = px / pl; tmp[1] = py / pl; tmp[2] = pz / pl;
    run.chart.at(tmp, [ux - tmp[0]!, uy - tmp[1]!, uz - tmp[2]!]);
    v.reset(0, 0, 0);
    run.sync();
    view.follow(run.U, run.Fw, 1);
    dirty = true;
    engine.wake();
  }
  // The poster (scripts/gallery-posters.mjs): at dusk on the terminator, the night side ahead, a
  // chaser coming over the horizon and the rover's bolts on their way.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    auto = true;
    const th = 1.42, a = run.seam(th), b = run.seam(th + 0.02);
    run.chart.at(a, [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]);
    v.reset(0, 0, 0);
    v.vel[0] = 11;
    run.S[PH] = RUN;
    run.S[NEXT] = 3;
    run.lit[1] = run.lit[2] = 1;
    run.sync();
    const c2 = run.seam(th + 0.3), q = 0;
    run.SH[q] = 1; run.SH[q + 1] = c2[0]!; run.SH[q + 2] = c2[1]!; run.SH[q + 3] = c2[2]!; run.SH[q + 7] = 1;
    view.follow(run.U, run.Fw, 1);
  }

  buildScene();
  view.follow(run.U, run.Fw, 1);
  engine.start();
  return {
    engine,
    accessible: true,
    get auto() { return auto; },
    set auto(on: boolean) { auto = on; engine.wake(); },
    get state() {
      const S = run.S, u = run.U;
      let ships2 = 0;
      for (let s = 0; s < SHIPS; s++) ships2 += run.SH[s * 9] ? 1 : 0;
      return {
        phase: S[PH]!, clock: S[CLK]!, score: S[SCORE]!, crystals: S[CRY]!, next: S[NEXT]!, laps: S[LAPS]!, shields: S[SHD]!, dark: !!S[DK], kills: S[KILLS]!, met: S[MET]!, ships: ships2,
        speed: v.speed, air: v.air, card: !card.hidden, lat: (Math.asin(u[1]!) * 180) / Math.PI, lon: (Math.atan2(u[2]!, u[0]!) * 180) / Math.PI, tiles: V[3]!,
      };
    },
    run,
    near,
    roverScreen() {
      dio.project(padO.pos[0]!, padO.pos[1]! + 0.5, padO.pos[2]!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a moment after the setup in `poster()` (scripts/gallery-posters.mjs). */
export const posterAt = 0.9;
void [CRY, DONE, TIME, ROCKS, BASES, RAMPS];
