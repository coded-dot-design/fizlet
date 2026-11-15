// "DOM Kaiju" (hero, Hi-Fi): a giant cyber ape against a tabletop city block, side-on. Dress him in
// the customiser (fur colour and pattern, a brow, a crest or tusks, and gear: a cyber arm, a visor, a
// chest plate, tail spikes, in a neon trim), then wreck the block. Jump at a building's side wall (the
// jump grabs it), hang on and climb; from the wall, punch the face next to you (left or right by where
// you face, up or down with the stick): glass and chunks blow out, sparks, smoke, a hole; enough holes
// and the building shakes, then pancakes floor by floor in a big dust cloud. Power boxes, neon signs
// and roof antennas are live (they spark and glow): touch one and you get a shock and drop. People
// wave and panic at the windows: GRAB one next to you and eat it (a "nom" puff: health back); a pot
// on a stove burns; some windows hold a sniper. Soldiers, a tank and a helicopter fight back (both
// vehicles blow up properly). Two rivals, our own creatures (SHARDCLAW the crystal crab-beast, GLOOPMAW
// the tentacle blob), wreck the same block: they steal your snacks and punch you off walls, and you
// punch back. Player two can take SHARDCLAW (the arrow keys with , . / or a second gamepad): a shared
// score and one score each. Out of health, a monster shrinks to a tiny figure and runs off the table;
// the block ends when every building is down (or nobody is left), with a score card per player.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/fx (the blasts and the pop words),
// @fzlt/core/input + @fzlt/core/pad (keys, the touch stick and the PUNCH, JUMP and GRAB keys),
// @fzlt/core/slot, @fzlt/core/sound; the Bikes series' particle pool (../bikes/kit.ts). The block and
// the round are ./block.ts (headless, tests/dom-kaiju.test.mjs), the monsters ./monster.ts; this file is
// the scene (tests/dom-kaiju.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { effects } from "../../../../src/fx";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { pool, type Pool } from "../bikes/kit";
import {
  blockRun, BLD, NB, C0, NC, NS, NP, NCH, NM, DEPTH, SX, STREET0, STREET1, TOTAL_FLOORS, READY, DONE, CLIMB, ROOF, KO, HERO, CRAB, BLOB, P2, AI, IN,
  INTACT, CRACKED, HOLE, SHAKE, FALL, RUBBLE, LIVE, LIVE_CELL, ANT,
  E_START, E_PUNCH, E_HOLE, E_SHAKE, E_FLOOR, E_FLAT, E_HELI, E_HELI_CRASH, E_NOM, E_HURT, E_FLING, E_DROP, E_KO, E_END, E_STOMP, E_JUMP, E_LAND, E_CLIMB,
  E_SHOCK, E_TANK, E_BONK, E_OUT, E_BURN, E_JOIN,
} from "./block";
import { buildMonster, heroName, FURS, TRIMS, PATTERNS, FACES, GEAR, RIVALS, type Look, type Monster } from "./monster";

const TAU = 6.283185307179586;
// Palettes by role: a neon night (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.45, 1, 0.6], amb: 0.52,
  sky0: "#07051c", sky1: "#1d0d3d", sky2: "#45145e", star: "#cfd8ff", moon: "#efe9ff",
  table: "#0c0a1a", plinth: "#15122b", rim: "#22e6ff", street: "#1b1932", walk: "#2b2847", curb: "#22e6ff", dash: "#ffd166",
  walls: ["#3b3466", "#2c3f6a", "#4a2f5e", "#2a4a58", "#3a2c52"], ledge: ["#4e4680", "#3b5486", "#623f7c", "#3a6272", "#4c3b6c"], roof: "#1c1934",
  win: "#ffd27a", win2: "#7cf6ff", crack: "#c99a5a", hole: "#07060f", holeRim: "#ff4fa8", door: "#120f22", awning: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff", "#39ffb0"],
  rubble: ["#3b3466", "#2c2650", "#4b426e"], tank: "#5a5480", pole: "#3a3658", lamp: "#fff1c2", glow: "#ffcf7a", antenna: "#ff2e55",
  heli: "#5d6b4a", heli2: "#3e4a32", glass: "#7cf6ff", rotor: "#1a1a26", army: "#55613e", army2: "#3b442b", wreck: "#2a2630",
  box: "#5b5f78", hazard: "#ffd23f", neon: "#ff4fa8", zap: "#fff36b",
  soldier: "#7d8b52", helmet: "#4e5a30", skin: "#e8b48f", people: ["#ff8fb8", "#6fd3ff", "#ffd166", "#7ee0a8", "#c0c6ff", "#ff9e6b"], chute: ["#ff4fa8", "#ffffff", "#22e6ff", "#ffd166"],
  pebble: "#ffe066", shell: "#ff8a1f", dust: "#8a84b8", shard: "#bff6ff", smoke: "#a39fc4", spark: "#ffd166", fire: "#ff6a2a", shadow: "#000000",
  ink: "#0b0a14", paper: "#f6f3ff", good: "#39ffb0", warn: "#ffd166", bad: "#ff4f5e", eye: "#fff6c9", pupil: "#0b0a14", teeth: "#f6f3ff", metal: "#9aa3c8",
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.55, 1, 0.7], amb: 0.6,
  sky0: "#bfe6ff", sky1: "#e4f4ff", sky2: "#fff1dc", star: "#ffffff", moon: "#fff6cc",
  table: "#c9a585", plinth: "#8a6448", rim: "#fff3dc", street: "#6b7088", walk: "#dcd6cc", curb: "#f4efe6", dash: "#fff3b0",
  walls: ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#e9d8ff"], ledge: ["#f4b87a", "#94c4f0", "#f5a3c0", "#a7e39a", "#cdb6f5"], roof: "#7d6b9e",
  win: "#e8f6ff", win2: "#cfeeff", crack: "#b9c6d6", hole: "#2a2236", holeRim: "#ef476f", door: "#6d4c41", awning: ["#ef476f", "#118ab2", "#ffd166", "#8e7dbe", "#06d6a0"],
  rubble: ["#d9c2a5", "#bfa88c", "#e8d6be"], tank: "#9aa0b8", pole: "#7b8094", lamp: "#fff6cc", glow: "#fff6cc", antenna: "#e63946",
  heli: "#6f8a5a", heli2: "#4f6642", glass: "#cfe8ff", rotor: "#2a2a33", army: "#6f8a4a", army2: "#4f6634", wreck: "#4a4048",
  box: "#8d93ab", hazard: "#ffb703", neon: "#ef476f", zap: "#ffe14d",
  soldier: "#6f8a4a", helmet: "#4f6634", skin: "#e8b48f", chute: ["#ef476f", "#ffffff", "#118ab2", "#ffd166"],
  pebble: "#ff9f1c", shell: "#e85d04", dust: "#d9d2c3", shard: "#ffffff", smoke: "#eeeeee", spark: "#ffb703", fire: "#ff5a1f", shadow: "#3a2a24",
  ink: "#1b1420", paper: "#ffffff", good: "#06a77d", warn: "#f4a261", bad: "#e63946", eye: "#ffffff", pupil: "#1b1420", teeth: "#ffffff", metal: "#b8bfd8",
};
const WORDS = ["CRUNCH!", "KRAK!", "SMASH!", "TIMBER!", "FLAT!", "SWAT!", "KA-BLAM!", "NOM!", "BOINK!", "STOMP!", "OOF!", "ZZAP!", "BONK!", "KER-THOOM!", "OUCH! HOT!", "POOF!"];
const W_CRUNCH = 0, W_TIMBER = 3, W_FLAT = 4, W_SWAT = 5, W_BLAM = 6, W_NOM = 7, W_BOINK = 8, W_STOMP = 9, W_OOF = 10, W_ZAP = 11, W_BONK = 12, W_THOOM = 13, W_HOT = 14, W_POOF = 15;
const DUST = 160, SHARD = 80, CHUNK = 70, SPARK = 70, SMOKE = 60;

export type KaijuScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; mode: number; hp: number; score: number; mine: number; flat: number; holes: number; helis: number; tanks: number; snacks: number; shocks: number; making: boolean; card: boolean; name: string; x: number; y: number; p2: boolean };
  /** Play by itself (the poster, the tests). */
  auto: boolean;
  /** The round (the tests read it). */
  readonly run: ReturnType<typeof blockRun>;
  /** The hero's look. */
  readonly look: Look;
  /** Set a part (the customiser's keys): fur, trim, pattern, face; gear toggles a bit. */
  set(k: keyof Look, v: number): void;
  /** Player two in (true) or out. */
  join(on: boolean): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): KaijuScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 20261115 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  const look: Look = { fur: 1, trim: 0, pattern: 1, face: 0, gear: 3 };
  // The camera never shakes for anyone who asked for less motion.
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;

  // ---- the page: the canvas, the play surface (pointer + keyboard focus), the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "kj-play";
  play.setAttribute("aria-label", "DOM Kaiju: A and D walk, W and S climb, K jumps (a jump at a wall grabs it), Space or J punches (with W or S held, up or down), L grabs. Player two: the arrow keys, comma punches, period jumps, slash grabs. C dresses the ape, R restarts, M mutes, 2 adds or drops player two");
  const hud = L.add(document.createElement("div"));
  hud.className = "kj-hud";
  const row = (k: string, label: string, items: string[], swatch = false, names: string[] = items) =>
    `<div class="kj-row" data-k="${k}"><i>${label}</i><p>${items.map((t, i) => `<button type="button" class="kj-opt${swatch ? " kj-sw" : ""}" data-k="${k}" data-i="${i}" aria-pressed="false"${swatch ? ` style="--c:${t}" aria-label="${label.toLowerCase()} ${names[i]}"` : ""}>${swatch ? "" : t}</button>`).join("")}</p></div>`;
  const TABS = ["fur", "trim", "pattern", "face", "gear"], TAB_NAMES = ["FUR", "TRIM", "PATTERN", "FACE", "GEAR"];
  hud.innerHTML = `<div class="kj-head"><p class="kj-top"><b class="kj-chip kj-name"><span></span></b><b class="kj-chip kj-hp"><em>HP</em><u><s></s></u></b><b class="kj-chip kj-score"><span>0</span></b><b class="kj-chip kj-flat"><span>0%</span><em>FLAT</em></b></p><p class="kj-rivals">${RIVALS.map((r, i) => `<b class="kj-chip kj-rival kj-r${i}" hidden><em>${r}</em><i></i><u><s></s></u><span>0</span></b>`).join("")}</p><p class="kj-hint"></p></div><p class="kj-toast" hidden></p><p class="kj-live" aria-live="polite"></p><p class="kj-keys"><button type="button" class="kj-key kj-p2-k" aria-label="Player two (2)" aria-pressed="false">2P</button><button type="button" class="kj-key kj-make-k" aria-label="Dress the ape (C)">APE</button><button type="button" class="kj-key kj-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p>`
    + `<div class="kj-make" role="dialog" aria-label="Dress your ape" data-tab="fur"><b class="kj-mname"></b><p class="kj-tabs">${TABS.map((k, i) => `<button type="button" class="kj-tab" data-tab="${k}" aria-pressed="${!i}">${TAB_NAMES[i]}</button>`).join("")}</p>${row("fur", "FUR", FURS.map((t) => t.c), true, FURS.map((t) => t.name))}${row("trim", "TRIM", TRIMS.map((t) => t.c), true, TRIMS.map((t) => t.name))}${row("pattern", "PATTERN", PATTERNS.map((p) => p.name))}${row("face", "FACE", FACES.map((p) => p.name))}${row("gear", "GEAR", GEAR.map((p) => p.name))}<p class="kj-go-row"><button type="button" class="bui-key kj-rand">RANDOM</button><button type="button" class="bui-key kj-go">SMASH!</button></p></div>`
    + `<div class="kj-card" role="dialog" aria-label="Round over" hidden><b></b><p class="kj-t"></p><ol class="kj-board"></ol><p class="kj-stats"></p><p class="kj-again-row"><button type="button" class="bui-key kj-again">SMASH AGAIN</button><button type="button" class="bui-key kj-change">DRESS THE APE</button></p></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, rivalsEl = head.children[1] as HTMLElement, hintEl = head.children[2] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, make = hud.children[4] as HTMLElement, card = hud.children[5] as HTMLElement;
  const nameEl = top.children[0]!.firstChild as HTMLElement, hpBar = top.children[1]!.querySelector("s") as HTMLElement, hpChip = top.children[1] as HTMLElement;
  const scoreEl = top.children[2]!.firstChild as HTMLElement, flatEl = top.children[3]!.firstChild as HTMLElement;
  const rivalChips = [...rivalsEl.children] as HTMLElement[];
  const p2K = keysEl.children[0] as HTMLButtonElement, makeK = keysEl.children[1] as HTMLButtonElement, muteK = keysEl.children[2] as HTMLButtonElement;
  const mname = make.querySelector(".kj-mname") as HTMLElement, opts = [...make.querySelectorAll<HTMLButtonElement>(".kj-opt")];
  const tabs = [...make.querySelectorAll<HTMLButtonElement>(".kj-tab")];
  const go = make.querySelector(".kj-go") as HTMLButtonElement, rand = make.querySelector(".kj-rand") as HTMLButtonElement;
  const cardH = card.children[0] as HTMLElement, cardT = card.children[1] as HTMLElement, board = card.children[2] as HTMLElement, cardS = card.children[3] as HTMLElement;
  const again = card.querySelector(".kj-again") as HTMLButtonElement, change = card.querySelector(".kj-change") as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "roar", punch: "punch", hole: "glass", floor: "thud", flat: "boom", heli: "hit", crash: "boom", tank: "boom", nom: "nom", hurt: "hurt", fling: "click", bonk: "hit", shock: "zap", burn: "hurt", ko: "end", end: "win", jump: "click", climb: "click", join: "ready" },
    notes: {
      roar: [[150, 70, 0.5, 0, "sawtooth", 0.12], [110, 55, 0.55, 0.05, "square", 0.06]],
      punch: [[160, 60, 0.09, 0, "square", 0.1]],
      glass: [[2400, 1300, 0.07, 0, "triangle", 0.06], [3100, 1800, 0.06, 0.03, "triangle", 0.04]],
      thud: [[90, 40, 0.22, 0, "sawtooth", 0.1]],
      nom: [[420, 300, 0.07, 0, "square", 0.07], [380, 260, 0.07, 0.1, "square", 0.07]],
      zap: [[1800, 300, 0.05, 0, "sawtooth", 0.08], [2200, 400, 0.05, 0.06, "sawtooth", 0.08], [1600, 200, 0.08, 0.12, "square", 0.06]],
    },
    volume: 0.1,
  });
  const c = controls(engine, { keys: { left: [], right: [], up: [], down: [], punch: [], jump: [], grab: [] }, target: play });
  const PUNCH = c.id("punch"), JUMP = c.id("jump"), GRAB = c.id("grab");
  const ICON_PUNCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="15" height="11" rx="3.5"/><rect x="4" y="4.5" width="4.2" height="7" rx="2.1"/><rect x="8.6" y="3.5" width="4.2" height="8" rx="2.1"/><rect x="13.2" y="4.5" width="4.2" height="7" rx="2.1"/><rect x="15" y="10" width="6" height="4.5" rx="2.2"/></svg>';
  const ICON_JUMP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 12h5v8h6v-8h5z" fill="currentColor"/></svg>';
  const ICON_GRAB = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="13" height="10" rx="4"/><rect x="6" y="3.5" width="3" height="10" rx="1.5"/><rect x="10" y="2" width="3" height="11" rx="1.5"/><rect x="14" y="3" width="3" height="10" rx="1.5"/><rect x="2.2" y="10" width="3" height="7.5" rx="1.5" transform="rotate(-30 3.7 13.7)"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    move: ["up", "down", "left", "right"],
    actions: [
      { intent: "punch", label: "", icon: ICON_PUNCH, name: "Punch (Space or J)", key: "J", role: "fire" },
      { intent: "jump", label: "", icon: ICON_JUMP, name: "Jump (K)", key: "K", role: "go" },
      { intent: "grab", label: "", icon: ICON_GRAB, name: "Grab (L)", key: "L", role: "aim" },
    ],
    host: stage,
  });
  thePad.el.classList.add("kj-pad");
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the round and the diorama ----
  const run = blockRun(), S = run.S, M = run.M, MV = run.MV;
  const fx = effects({ cap: 320, scorch: 0, words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"] });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const groups: DioramaObject[] = [], floors: DioramaObject[][] = [], wins: DioramaObject[] = new Array(NC), rubble: DioramaObject[] = [], roofs: DioramaObject[] = [], lives: DioramaObject[] = [];
  const mons: Monster[] = [];
  let heli: DioramaObject, rotor: DioramaObject, tailRotor: DioramaObject, tank: DioramaObject, turret: DioramaObject;
  let soldiers: DioramaPoints, pebbles: DioramaPoints, chutes: DioramaPoints, runners: DioramaPoints, dust: Pool, shard: Pool, chunk: Pool, spark: Pool, smoke: Pool;
  const folk: DioramaPoints[] = [];
  const rnd = seeded(20261115);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS[i] = rnd();
  const LAMPS = [-16.6, -10, -2.3, 3.4, 10, 16.4];
  const INK: { ink: string; eye: string; pupil: string; teeth: string; night: boolean; metal: string } = { ink: "", eye: "", pupil: "", teeth: "", night: true, metal: "" };

  function buildScene() {
    dio.clear();
    groups.length = floors.length = rubble.length = roofs.length = folk.length = lives.length = mons.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("ground", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    const G = (size: number[], pos: number[], color: string, layer: number, emissive = false) => dio.add({ size, pos, color, cluster: "ground", layer, emissive, pick: false });
    G([SX * 2 + 9, 0.5, DEPTH + STREET1 + 8], [0, -1.55, 1.2], P.table, 0);
    G([SX * 2 + 2, 1.05, DEPTH + STREET1 + 1.6], [0, -1.05, (STREET1 - DEPTH) / 2], P.plinth, 1);
    G([SX * 2 + 2.2, 0.1, DEPTH + STREET1 + 1.8], [0, -0.16, (STREET1 - DEPTH) / 2], P.rim, 2, true);
    G([SX * 2 + 1.6, 0.02, DEPTH + 0.8], [0, -0.02, -DEPTH / 2 + 0.2], P.walk, 3);
    G([SX * 2 + 1.6, 0.06, STREET0 + 0.1], [0, -0.02, STREET0 / 2], P.walk, 4);
    G([SX * 2 + 1.6, 0.02, STREET1 - STREET0], [0, -0.04, (STREET0 + STREET1) / 2], P.street, 3);
    for (let x = -SX + 0.6; x < SX; x += 2.4) G([1.2, 0.01, 0.14], [x, -0.02, (STREET0 + STREET1) / 2 + 0.3], P.dash, 5, P.night);
    dio.decal("ground", 9, paintCurb);
    dio.decal("ground", 9.2, paintPools);
    dio.decal("ground", 9.5, paintShadow);
    for (let k = 0; k < LAMPS.length; k++) {
      const id = "lp" + k;
      dio.add({ id, shape: "cyl", sides: 6, size: [0.12, 2.3, 0.12], pos: [LAMPS[k]!, 0, STREET0 - 0.25], color: P.pole, cluster: "ground", layer: 6, pick: false });
      dio.add({ size: [0.5, 0.08, 0.14], pos: [0.18, 0, 0], on: id, color: P.pole, pick: false });
      dio.add({ shape: "cyl", sides: 6, size: [0.26, 0.12, 0.26], pos: [0.38, -0.12, 0], on: id, color: P.lamp, emissive: true, pick: false });
    }
    // The buildings: a group per building that sinks as it pancakes; a box per floor with a ledge, a
    // window per cell (recoloured as it cracks and goes), a door and an awning on the ground floor, a roof.
    for (let b = 0; b < NB; b++) {
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, lk = BLD[b * 4 + 3]!, id = "bg" + b, cl = "b" + b;
      dio.cluster(cl, { at: [x0 + w / 2, 0, -DEPTH] });
      groups.push(dio.add({ id, shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false }));
      const fs: DioramaObject[] = [];
      for (let fl = 0; fl < f; fl++) {
        const fid = id + "f" + fl;
        fs.push(dio.add({ id: fid, size: [w, 1, DEPTH], pos: [0, fl, 0], on: id, color: P.walls[lk]!, pick: false, layer: 5 }));
        dio.add({ size: [w + 0.12, 0.09, DEPTH + 0.12], pos: [0, -0.09, 0], on: fid, color: P.ledge[lk]!, pick: false, layer: 6 });
        for (let col = 0; col < w; col++) {
          const i = C0[b]! + fl * w + col, gf = fl === 0, door = gf && col === ((w / 2) | 0);
          if (door) dio.add({ size: [0.5, 0.78, 0.05], pos: [col - w / 2 + 0.5, -1, DEPTH / 2 + 0.01], on: fid, color: P.door, pick: false, layer: 7 });
          wins[i] = dio.add({ size: door ? [0.5, 0.18, 0.05] : gf ? [0.74, 0.5, 0.05] : [0.58, 0.54, 0.05], pos: [col - w / 2 + 0.5, door ? -0.2 : gf ? -0.84 : -0.78, DEPTH / 2 + 0.01], on: fid, color: P.win, emissive: P.night, pick: false, layer: 7 });
        }
        if (fl === 0) for (let k = 0; k < w * 2; k++) dio.add({ size: [0.5, 0.06, 0.5], pos: [-w / 2 + 0.25 + k * 0.5, -0.12, DEPTH / 2 + 0.25], rot: [-0.35, 0, 0], on: fid, color: P.awning[(k + lk) & 1 ? lk : (lk + 2) % 5]!, pick: false, layer: 8 });
      }
      floors.push(fs);
      // The roof: a parapet, a water tank or a live antenna (it sparks), a vent.
      const rid = id + "r";
      roofs.push(dio.add({ id: rid, shape: "group", size: [w, 0, DEPTH], pos: [0, f, 0], on: id, pick: false }));
      dio.add({ size: [w + 0.16, 0.22, DEPTH + 0.16], pos: [0, 0, 0], on: rid, color: P.roof, pick: false, layer: 6 });
      if (lk % 2 === 0) {
        dio.add({ shape: "cyl", sides: 8, size: [0.9, 0.9, 0.9], pos: [-w / 2 + 1, 0.55, -0.4], on: rid, color: P.tank, pick: false, layer: 7 });
        for (const lx of [-0.3, 0.3]) dio.add({ size: [0.06, 0.4, 0.06], pos: [-w / 2 + 1 + lx, 0.18, -0.4], on: rid, color: P.pole, pick: false, layer: 7 });
      } else {
        dio.add({ size: [0.1, 1.7, 0.1], pos: [w / 2 - 0.8, 0.2, 0], on: rid, color: P.pole, pick: false, layer: 7 });
        for (let k = 0; k < 3; k++) dio.add({ size: [0.6 - k * 0.15, 0.05, 0.05], pos: [w / 2 - 0.8, 0.8 + k * 0.4, 0], on: rid, color: P.pole, pick: false, layer: 7 });
        dio.add({ shape: "cyl", sides: 6, size: [0.2, 0.2, 0.2], pos: [w / 2 - 0.8, 1.9, 0], on: rid, color: P.zap, emissive: true, pick: false, layer: 7 });
      }
      dio.add({ size: [0.7, 0.35, 0.5], pos: [0.6, 0.2, 0.5], on: rid, color: P.ledge[lk]!, pick: false, layer: 7 });
      const rb = dio.add({ id: id + "x", shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false, alpha: 0 });
      for (let k = 0; k < 13; k++) {
        const s = 0.6 + ((k * 37) % 5) * 0.17, u = (k * 0.618) % 1, v = (k * 0.414) % 1, hgt = k < 6 ? 0 : k < 10 ? 0.35 : 0.7;
        const col = k % 3 === 0 ? P.walls[lk]! : k % 3 === 1 ? P.ledge[lk]! : P.rubble[k % 3]!;
        dio.add({ shape: k % 4 === 1 ? "wedge" : "box", size: [s * 1.5, s * 0.5, s * 0.9], pos: [-w / 2 + 0.6 + u * (w - 1.2), hgt, -1 + v * 2], rot: [0, k * 0.9, ((k % 3) - 1) * 0.22], on: id + "x", color: col, pick: false });
      }
      rubble.push(rb);
      dio.decal(cl, 7.5, paintHoles(b));
      folk.push(dio.points({ cap: w * f, cluster: cl, layer: 7.6, paint: paintFolk }));
    }
    // The live parts: power boxes (a hazard stripe) and neon signs (a bolt) over their windows.
    for (let k = 0; k < LIVE.length; k += 4) {
      const b = LIVE[k]!, fl = LIVE[k + 1]!, col = LIVE[k + 2]!, w = BLD[b * 4 + 1]!, kind = LIVE[k + 3]!, fid = "bg" + b + "f" + fl;
      const box = dio.add({ size: kind ? [0.82, 0.62, 0.12] : [0.62, 0.66, 0.2], pos: [col - w / 2 + 0.5, -0.82, DEPTH / 2 + 0.02], on: fid, color: kind ? P.neon : P.box, emissive: !!kind, pick: false, layer: 7.2 });
      if (!kind) dio.add({ size: [0.64, 0.12, 0.04], pos: [0, 0.42, 0.11], on: fid, color: P.hazard, emissive: true, pick: false, layer: 7.3 }), (box.pos[1] = -0.85);
      lives.push(box);
    }
    dio.decal("ground", 9.8, paintLive);
    // The monsters: the hero (dressed), the rivals.
    INK.ink = P.ink; INK.eye = P.eye; INK.pupil = P.pupil; INK.teeth = P.teeth; INK.night = P.night; INK.metal = P.metal;
    for (let k = 0; k < NM; k++) mons.push(buildMonster(dio, k === 0 ? HERO : k === 1 ? CRAB : BLOB, look, INK, "mon" + k));
    // The helicopter.
    heli = dio.add({ id: "heli", shape: "group", size: [2, 0, 1], pos: [0, -20, 2.6], pick: false });
    const hp = (size: number[], pos: number[], color: string, o: { shape?: "box" | "cyl" | "wedge"; rot?: number[]; emissive?: boolean; on?: string } = {}) =>
      dio.add({ shape: o.shape || "box", size, pos, rot: o.rot, color, on: o.on || "heli", emissive: o.emissive, pick: false });
    hp([1.3, 0.75, 0.8], [0, 0, 0], P.heli);
    hp([0.6, 0.5, 0.7], [0.55, 0.12, 0], P.glass, { emissive: P.night });
    hp([1.5, 0.22, 0.22], [-1.25, 0.38, 0], P.heli2);
    hp([0.4, 0.55, 0.08], [-1.95, 0.4, 0], P.heli2, { shape: "wedge" });
    for (const z of [-0.36, 0.36]) hp([1.4, 0.06, 0.06], [0, -0.32, z], P.rotor), hp([0.06, 0.3, 0.06], [0.3, -0.3, z], P.rotor), hp([0.06, 0.3, 0.06], [-0.3, -0.3, z], P.rotor);
    hp([0.12, 0.2, 0.12], [0, 0.75, 0], P.rotor, { shape: "cyl" });
    rotor = dio.add({ id: "rot", shape: "group", size: [0.2, 0, 0.2], pos: [0, 0.95, 0], on: "heli", pick: false });
    hp([3.0, 0.05, 0.22], [0, 0, 0], P.rotor, { on: "rot" });
    hp([0.22, 0.05, 3.0], [0, 0, 0], P.rotor, { on: "rot" });
    tailRotor = dio.add({ id: "trot", shape: "group", size: [0.1, 0, 0.1], pos: [-1.95, 0.75, 0.08], on: "heli", pick: false });
    hp([0.06, 0.9, 0.12], [0, -0.45, 0], P.rotor, { on: "trot" });
    hp([0.16, 0.06, 0.1], [0, -0.03, 0.4], P.antenna, { on: "heli", emissive: true });
    // The tank: tracks, a hull, a turret and its gun.
    tank = dio.add({ id: "tank", shape: "group", size: [2.6, 0, 1.4], pos: [0, 0, 4], pick: false });
    const tp = (size: number[], pos: number[], color: string, on = "tank", shape: "box" | "cyl" | "wedge" = "box", rot?: number[]) => dio.add({ shape, size, pos, rot, color, on, pick: false });
    for (const z of [-0.55, 0.55]) tp([2.6, 0.45, 0.36], [0, 0, z], P.army2);
    tp([2.2, 0.45, 1.2], [0, 0.35, 0], P.army);
    turret = dio.add({ id: "tur", shape: "group", size: [1, 0, 1], pos: [0, 0.8, 0], on: "tank", pick: false });
    tp([1.1, 0.45, 0.9], [-0.1, 0, 0], P.army, "tur");
    tp([1.2, 0.14, 0.14], [0.95, 0.18, 0], P.army2, "tur");
    tp([0.1, 0.08, 0.3], [0.2, 0.46, 0], P.antenna, "tur");
    // The street's little people, the pebbles and shells, the parachutes, a knocked-out monster running, the debris.
    soldiers = dio.points({ cap: NS, paint: paintSoldier });
    chutes = dio.points({ cap: NCH, paint: paintChute });
    runners = dio.points({ cap: NM, paint: paintRunner });
    pebbles = dio.points({ cap: NP, paint: paintPebble });
    dust = pool(dio, DUST, P.dust, 6);
    smoke = pool(dio, SMOKE, P.smoke, 6);
    chunk = pool(dio, CHUNK, P.rubble[1]!, 6);
    shard = pool(dio, SHARD, P.shard, 6);
    spark = pool(dio, SPARK, P.spark, 6);
    sky = null;
    pose(0);
  }

  // ---- state ----
  const I = new Float64Array(5), I2 = new Float64Array(5), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] base oy, [5] drawn once, [6] gamepad on, [7] tall.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let auto = false, dirty = true, hudDirty = true, shake = 0, toastT = 0, endT = -1, flash = 0, makeTop = 0, lastDt = 1 / 60;
  const was = new Float64Array(16).fill(-1);
  const HF = new Float64Array(2); // the horizontal half-width the stage shows at the target, wide and tall
  HF[0] = 18.4; HF[1] = 7.8;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);

  // One camera per stage shape: side-on, a little above the street; a resize changes the field of view only.
  function frame() {
    const W = dio.width, H = dio.height, tall = W / H < 1.25;
    V[7] = tall ? 1 : 0;
    const cam = dio.cam;
    cam.yaw = 0;
    cam.pitch = tall ? 0.18 : 0.2;
    cam.dist = tall ? 24 : 38;
    cam.ty = tall ? 4.0 : 4.4;
    cam.tz = 0.2;
    cam.fov = 2 * Math.atan((HF[V[7]!]! / cam.dist) * (H / W));
    cam.ox = 0;
    cam.oy = V[4] = tall ? H * 0.06 : Math.min(H * 0.12, V[3]! * 0.5);
    if (!tall) cam.tx = 0;
  }
  function stepCam(dt: number) {
    if (!V[7]) return false;
    // Tall: the camera walks along the street with the hero (it never zooms); while the customiser
    // covers the bottom, the picture slides up so the ape stands just over it.
    const cam = dio.cam, want = Math.max(-SX + 6.5, Math.min(SX - 6.5, M[0]!)), d = want - cam.tx;
    let moving = false;
    if (Math.abs(d) > 0.005) (cam.tx += d * Math.min(1, dt * 3)), (moving = true);
    let oy = V[4]!;
    if (!make.hidden && V[3] && dio.project(M[0]!, 0, M[2]!, tmp)) oy = cam.oy + (makeTop - 14 - tmp[1]!);
    const e = oy - cam.oy;
    if (Math.abs(e) > 0.3) (cam.oy += e * Math.min(1, dt * 6)), (moving = true);
    return moving;
  }

  function pose(dt: number) {
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!, m = mons[k]!, inPlay = O[24] === IN, small = O[29] && O[1]! <= 0.01;
      m.root.alpha = inPlay && !small ? 1 : 0;
      if (inPlay) m.pose(O, engine.time + k * 1.7, dt);
      runners.a[k] = inPlay && small ? 1 : 0;
      runners.x[k] = O[0]!; runners.y[k] = 0.35; runners.z[k] = O[2]!; runners.r[k] = 0.5;
    }
    runners.n = NM;
    for (let b = 0; b < NB; b++) {
      const st = run.B[b * 6]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, fs = floors[b]!, sh = run.B[b * 6 + 5]!;
      g.pos[1] = run.yOff(b);
      g.pos[0] = BLD[b * 4]! + BLD[b * 4 + 1]! / 2 + (sh ? Math.sin(engine.time * 47 + b) * 0.07 * sh * calm : 0);
      g.rot[2] = sh ? Math.sin(engine.time * 31 + b * 2) * 0.014 * sh * calm : 0;
      // (alpha, not hidden: a floor's ledge, windows and awning go with it)
      for (let fl = 0; fl < fs.length; fl++) fs[fl]!.alpha = fl < rem ? 0 : 1;
      roofs[b]!.alpha = st === RUBBLE ? 0 : 1;
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, cs = run.cell[i]!, o = wins[i]!;
        const want = cs === INTACT ? ((fl + col * 3 + b) % 5 === 1 ? P.win2 : P.win) : cs === CRACKED ? P.crack : P.hole;
        if (o.color !== want) (o.color = want), (o.emissive = P.night && cs !== HOLE);
      }
      rubble[b]!.alpha = st === RUBBLE ? 1 : 0;
      const pts = folk[b]!;
      pts.n = w * f;
      const yo = run.yOff(b);
      for (let k = 0; k < w * f; k++) {
        const i = C0[b]! + k, fl = (k / w) | 0, col = k - fl * w;
        pts.a[k] = run.occ[i] && fl >= rem && st !== RUBBLE ? 1 : 0;
        pts.x[k] = g.pos[0]! - w / 2 + col + 0.5;
        pts.y[k] = yo + fl + (fl === 0 ? 0.25 : 0.3);
        pts.z[k] = 0.04;
        pts.r[k] = 0.27;
      }
    }
    for (let k = 0; k < lives.length; k++) {
      const b = LIVE[k * 4]!;
      lives[k]!.alpha = run.B[b * 6]! >= FALL && run.B[b * 6 + 3]! > LIVE[k * 4 + 1]! ? 0 : 1;
      if (LIVE[k * 4 + 3]) lives[k]!.color = ((engine.time * 5 + k) | 0) % 5 ? P.neon : P.paper;
    }
    // The helicopter and the tank.
    const HE = run.HE, he = HE[0]!, TK = run.TK;
    heli.hidden = he === 0;
    heli.pos[0] = HE[1]!; heli.pos[1] = he ? HE[2]! : -20; heli.pos[2] = HE[3]!;
    heli.rot[1] = he === 2 ? HE[9]! : HE[1]! < M[0]! ? 0.25 : Math.PI - 0.25;
    heli.rot[2] = he === 2 ? 0.5 : HE[1]! < M[0]! ? -HE[11]! - 0.08 : HE[11]! - 0.08;
    heli.tint = he === 2 ? P.wreck : null;
    rotor.rot[1] = engine.time * (he === 2 ? 9 : 26);
    tailRotor.rot[2] = engine.time * 30;
    tank.alpha = TK[0] ? 1 : 0;
    tank.pos[0] = TK[1]!; tank.pos[2] = TK[7]! || 4;
    tank.rot[1] = TK[2]! > 0 ? 0 : Math.PI;
    tank.tint = TK[0] === 2 ? P.wreck : null;
    turret.pos[0] = -TK[6]! * 0.25;
    turret.rot[2] = TK[0] === 2 ? 0.35 : 0.05;
    soldiers.n = NS;
    for (let s = 0; s < NS; s++) {
      const o = s * 8;
      soldiers.a[s] = run.SO[o]! > 0 ? 1 : 0;
      soldiers.x[s] = run.SO[o + 1]!; soldiers.y[s] = 0.32; soldiers.z[s] = run.SO[o + 2]!; soldiers.r[s] = 0.34;
    }
    pebbles.n = NP;
    for (let k = 0; k < NP; k++) {
      const o = k * 8;
      pebbles.a[k] = run.PB[o]! > 0 ? 1 : 0;
      pebbles.x[k] = run.PB[o + 1]!; pebbles.y[k] = run.PB[o + 2]!; pebbles.z[k] = run.PB[o + 3]!; pebbles.r[k] = run.PB[o + 7] === 2 ? 0.2 : run.PB[o + 7] ? 0.13 : 0.1;
    }
    chutes.n = NCH;
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      chutes.a[k] = run.CH[o]! > 0 ? 1 : 0;
      chutes.x[k] = run.CH[o + 1]!; chutes.y[k] = run.CH[o + 2]! + 0.3; chutes.z[k] = run.CH[o + 3]!; chutes.r[k] = 0.3;
    }
  }

  // ---- FX ----
  /** A burst of wreckage at (x, y, z): glass, chunks of wall, sparks and smoke; `big` scales it. */
  function burst(x: number, y: number, z: number, big: number, wall: string) {
    chunk.P.colorAll = wall;
    for (let n = 0; n < 8 * big; n++) shard.puff(x + (rnd() - 0.5) * 0.5, y, z, (rnd() - 0.5) * 5, 1 + rnd() * 3.5, 1.5 + rnd() * 3, 0.8, 0.07, 1);
    for (let n = 0; n < 5 * big; n++) chunk.puff(x + (rnd() - 0.5) * 0.4, y, z, (rnd() - 0.5) * 4.5, 1.5 + rnd() * 3, 1 + rnd() * 3, 1, 0.13 + rnd() * 0.1, 1);
    for (let n = 0; n < 7 * big; n++) spark.puff(x, y, z + 0.1, (rnd() - 0.5) * 7, (rnd() - 0.3) * 6, 1 + rnd() * 3, 0.35, 0.05, 1);
    smoke.puff(x, y, z + 0.2, (rnd() - 0.5) * 0.6, 0.8, 0.5, 1.1 * big, 0.3, 0.5);
  }
  function stepFx(dt: number) {
    let any = dust.step(dt, -0.25, 0.5, 0.55, 1.2);
    for (let i = 0; i < NC; i++) if (run.crackT[i]! > 0) (run.crackT[i] = Math.max(0, run.crackT[i]! - dt)), (any = true);
    if (shard.step(dt, 16, -0.05, 1, 0.6)) any = true;
    if (chunk.step(dt, 18, 0, 1, 0.4)) any = true;
    if (spark.step(dt, 10, -0.08, 1, 1.5)) any = true;
    // The falling helicopter and the burning wreck smoke; a building going down breathes dust at its feet.
    if (run.HE[0] === 2 && rnd() < dt * 40) smoke.puff(run.HE[1]!, run.HE[2]!, run.HE[3]!, rnd() - 0.5, 1 + rnd(), rnd() - 0.5, 0.9, 0.22, 0.6), spark.puff(run.HE[1]!, run.HE[2]!, run.HE[3]!, (rnd() - 0.5) * 3, rnd() * 2, 0, 0.3, 0.06, 1);
    if (run.TK[0] === 2 && rnd() < dt * 18) smoke.puff(run.TK[1]! + (rnd() - 0.5), 1, run.TK[7]!, rnd() - 0.5, 1.2 + rnd(), 0, 1.4, 0.3, 0.5);
    for (let b = 0; b < NB; b++) {
      const st = run.B[b * 6]!;
      if ((st === SHAKE && rnd() < dt * 14) || (st === FALL && rnd() < dt * 40)) {
        const x = BLD[b * 4]! + rnd() * BLD[b * 4 + 1]!;
        dust.puff(x, 0.2, 0.3 + rnd() * 0.6, (rnd() - 0.5) * 2, 0.6 + rnd() * 1.2, 0.6 + rnd(), 1.4, 0.45, 0.55);
        if (st === FALL && rnd() < 0.4) chunk.puff(x, run.top(b) - 0.2, 0.2, (rnd() - 0.5) * 3, 2 + rnd() * 2, 1 + rnd(), 1, 0.15, 1);
      }
    }
    // Live parts spark now and then (the warning); antennas too.
    if (S[0] === 1 && rnd() < dt * 9) {
      const k = (rnd() * (LIVE.length / 4)) | 0, b = LIVE[k * 4]!, fl = LIVE[k * 4 + 1]!;
      if (run.B[b * 6] === 0 || run.B[b * 6 + 3]! <= fl) {
        const x = BLD[b * 4]! + LIVE[k * 4 + 2]! + 0.5, y = run.yOff(b) + fl + 0.5;
        for (let n = 0; n < 3; n++) spark.puff(x + (rnd() - 0.5) * 0.4, y + (rnd() - 0.2) * 0.4, 0.15, (rnd() - 0.5) * 3, rnd() * 2.5, 0.8, 0.25, 0.045, 1);
      }
    }
    if (smoke.step(dt, -0.4, 0.45, 0.6, 1)) any = true;
    if (fx.live || fx.shake > 0) any = true;
    fx.step(dt);
    if (flash > 0) (flash = Math.max(0, flash - dt)), (any = true);
    return any;
  }
  /** World (x, y, z) to the screen, into tmp; false off the camera. */
  const at = (x: number, y: number, z: number) => dio.project(x, y, z, tmp) && tmp[2]! > 0.5;
  const cellPos = (i: number) => {
    let b = 0;
    while (C0[b + 1]! <= i) b++;
    const w = BLD[b * 4 + 1]!, r = i - C0[b]!, fl = (r / w) | 0;
    tmp2[0] = BLD[b * 4]! + (r - fl * w) + 0.5;
    tmp2[1] = run.yOff(b) + fl + 0.5;
    tmp2[2] = 0.2;
    return b;
  };

  // ---- events: stickers, sound, FX ----
  let wordK = 0;
  function events() {
    for (let k = 0; k < run.n; k++) {
      const type = run.ev[k * 2]!, val = run.ev[k * 2 + 1]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast("SMASH THE BLOCK!", "go"), say("Go: smash the block");
      else if (type === E_PUNCH) engine.events.emit("punch");
      else if (type === E_HOLE) {
        engine.events.emit("hole");
        const b = cellPos(val | 0);
        burst(tmp2[0]!, tmp2[1]!, tmp2[2]!, 1, P.walls[BLD[b * 4 + 3]!]!);
        if (at(tmp2[0]!, tmp2[1]!, 0.3)) fx.blast(tmp[0]!, tmp[1]!, 0.22, 1), fx.word(tmp[0]!, tmp[1]! - 10, W_CRUNCH + (wordK++ % 3), 1, 15);
        shake = Math.max(shake, 0.16);
      } else if (type === E_SHAKE) toast(`IT'S GOING!`, "meh"), say("The building shakes");
      else if (type === E_DROP) {
        if (at(BLD[val * 4]! + BLD[val * 4 + 1]! / 2, BLD[val * 4 + 2]! + 0.5, 0)) fx.word(tmp[0]!, tmp[1]!, W_TIMBER, 2, 24);
        say("Timber");
      } else if (type === E_FLOOR) {
        engine.events.emit("floor");
        const b = val | 0, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
        for (let n = 0; n < 18; n++) dust.puff(x0 - 0.5 + rnd() * (w + 1), 0.3, -0.4 + rnd() * 1.8, (rnd() - 0.5) * 4, 0.5 + rnd() * 2, 0.8 + rnd() * 2, 1.5 + rnd() * 0.7, 0.55, 0.6);
        chunk.P.colorAll = P.walls[BLD[b * 4 + 3]!]!;
        for (let n = 0; n < 8; n++) chunk.puff(x0 + rnd() * w, 0.5, 0.3, (rnd() - 0.5) * 6, 2 + rnd() * 3, 1 + rnd() * 3, 1.1, 0.16 + rnd() * 0.1, 1);
        shake = Math.max(shake, 0.32);
        fx.kick(3 * calm);
      } else if (type === E_FLAT) {
        engine.events.emit("flat");
        const b = val | 0, x = BLD[b * 4]! + BLD[b * 4 + 1]! / 2;
        if (at(x, 0.4, 0.5)) fx.blast(tmp[0]!, tmp[1]!, 1, 1), fx.word(tmp[0]!, tmp[1]! - 44, W_FLAT, 4, 28);
        dust.ring(rnd, x, 0.3, 0.4, 30, 4.4, 1.6, 1.8, 0.65, 0.65);
        burst(x, 0.8, 0.4, 2, P.walls[BLD[b * 4 + 3]!]!);
        shake = 0.6;
        toast(S[4] === NB ? "THE WHOLE BLOCK!" : `${S[4]} OF ${NB} FLAT`, "go");
      } else if (type === E_HELI) {
        engine.events.emit("heli");
        if (at(run.HE[1]!, run.HE[2]!, run.HE[3]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_SWAT, 5, 22), fx.blast(tmp[0]!, tmp[1]!, 0.45, 4);
        burst(run.HE[1]!, run.HE[2]!, run.HE[3]!, 1, P.heli);
        toast("SWATTED!", "clean");
        say("Helicopter swatted");
      } else if (type === E_HELI_CRASH || type === E_TANK) {
        engine.events.emit(type === E_TANK ? "tank" : "crash");
        const z = type === E_TANK ? run.TK[7]! : run.HE[3]!;
        if (at(val, 0.6, z)) fx.blast(tmp[0]!, tmp[1]!, 1.3, 2), fx.word(tmp[0]!, tmp[1]! - 40, type === E_TANK ? W_THOOM : W_BLAM, 2, 26);
        dust.ring(rnd, val, 0.3, z, 18, 3.5, 1.8, 1.2, 0.45, 0.6);
        burst(val, 0.8, z, 3, type === E_TANK ? P.army : P.heli);
        for (let n = 0; n < 10; n++) smoke.puff(val + (rnd() - 0.5) * 1.5, 0.6 + rnd(), z, (rnd() - 0.5) * 1.5, 1.5 + rnd() * 1.5, 0, 1.6, 0.4, 0.6);
        shake = 0.55;
        if (type === E_TANK) toast("TANK BUSTED!", "clean"), say("Tank busted");
      } else if (type === E_NOM) {
        engine.events.emit("nom");
        mouth(S[15]!);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) fx.word(tmp[0]!, tmp[1]! - 16, W_NOM, 5, 20);
        if (S[15] === 0) toast("NOM! +HP", "clean"), say("Snack: health back");
        else toast(`${who(S[15]!)} ATE ONE!`, "meh");
      } else if (type === E_BURN) {
        engine.events.emit("burn");
        cellPos(val | 0);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) fx.word(tmp[0]!, tmp[1]! - 14, W_HOT, 2, 16);
        for (let n = 0; n < 6; n++) smoke.puff(tmp2[0]!, tmp2[1]!, 0.3, (rnd() - 0.5), 1.4, 0.4, 0.7, 0.18, 0.6);
      } else if (type === E_HURT) {
        engine.events.emit("hurt");
        if (rnd() < 0.25 && at(M[0]!, M[1]! + mons[0]!.height + 0.3, M[2]!)) fx.word(tmp[0]!, tmp[1]!, W_OOF, 3, 14);
      } else if (type === E_SHOCK) {
        engine.events.emit("shock");
        flash = 0.25;
        shake = Math.max(shake, 0.3);
        const v = val | 0;
        if (v >= 0) cellPos(v);
        else (tmp2[0] = ANT[-1 - v]!), (tmp2[1] = run.top(-1 - v) + 1.6), (tmp2[2] = 0);
        for (let n = 0; n < 16; n++) spark.puff(tmp2[0]!, tmp2[1]!, 0.3, (rnd() - 0.5) * 8, (rnd() - 0.4) * 7, 1 + rnd() * 2, 0.4, 0.06, 1);
        if (at(tmp2[0]!, tmp2[1]!, 0.3)) fx.word(tmp[0]!, tmp[1]! - 18, W_ZAP, 1, 22);
        toast("ZAPPED! LIVE WIRE", "bad");
        say("Shocked: a live part");
      } else if (type === E_BONK) {
        engine.events.emit("bonk");
        const O = MV[val | 0]!;
        if (at(O[0]!, O[1]! + 2.6, O[2]!)) fx.word(tmp[0]!, tmp[1]! - 10, W_BONK, 3, 18), fx.blast(tmp[0]!, tmp[1]!, 0.25, 3);
        if (val === 0) toast("BONKED OFF THE WALL!", "bad");
      } else if (type === E_FLING || type === E_STOMP) {
        engine.events.emit("fling");
        const s = val | 0;
        if (at(run.SO[s * 8 + 1]!, 1, run.SO[s * 8 + 2]!)) fx.word(tmp[0]!, tmp[1]! - 12, type === E_STOMP ? W_STOMP : W_BOINK, 1, 15);
        if (type === E_STOMP) dust.ring(rnd, M[0]!, 0.2, M[2]!, 10, 2.4, 0.8, 0.7, 0.3, 0.55);
      } else if (type === E_KO) {
        engine.events.emit("ko");
        const O = MV[val | 0]!;
        smoke.ring(rnd, O[0]!, O[1]! + 1.5, O[2]!, 14, 2.5, 1, 0.9, 0.5, 0.7);
        if (at(O[0]!, O[1]! + 2, O[2]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_POOF, 4, 22);
        toast(`${who(val)} SHRINKS!`, val === 0 || O[28] === P2 ? "bad" : "go");
        say(`${who(val)} is out`);
      } else if (type === E_OUT) hudDirty = true;
      else if (type === E_JOIN) engine.events.emit("join"), toast(val ? "PLAYER 2 IS SHARDCLAW!" : "SHARDCLAW GOES BACK TO THE AI", "go");
      else if (type === E_END) engine.events.emit("end"), (endT = 1.1), engine.busy(1.2);
      else if (type === E_JUMP) engine.events.emit("jump");
      else if (type === E_CLIMB) engine.events.emit("climb");
      else if (type === E_LAND && M[19]! > 0.5) {
        dust.ring(rnd, M[0]!, M[1]! + 0.1, M[2]!, 8, 2, 0.6, 0.6, 0.28, 0.5);
        shake = Math.max(shake, 0.18);
      }
    }
    run.clear();
  }
  const who = (k: number) => (k === 0 ? heroName(look.fur, look.face) : RIVALS[k - 1]!);
  /** Monster k's mouth, in the world, into tmp2. */
  function mouth(k: number) {
    const O = MV[k]!;
    tmp2[0] = O[0]! + O[6]! * 0.9;
    tmp2[1] = O[1]! + mons[k]!.height - 0.5;
    tmp2[2] = O[2]! + 0.3;
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "kj-toast kj-" + kind;
    toastEl.hidden = false;
    toastT = 1.6;
  }
  let said = "";
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const hp = Math.round(M[7]!);
    if (was[0] !== hp) (was[0] = hp), (hpBar.style.width = `${hp}%`), hpChip.classList.toggle("kj-low", hp <= 30);
    const s = M[25]!;
    if (was[1] !== s) (was[1] = s), (scoreEl.textContent = s.toLocaleString("en-US"));
    const fl = Math.round((S[8]! / TOTAL_FLOORS) * 100);
    if (was[2] !== fl) (was[2] = fl), (flatEl.textContent = fl + "%");
    for (let r = 0; r < 2; r++) {
      const O = MV[r + 1]!, chip = rivalChips[r]!, shown = O[24] === IN || O[25]! > 0 || (r === 0 && O[28] === P2), key = (shown ? 1 : 0) + O[28]! * 2 + Math.round(O[7]!) * 8 + O[25]! * 1024 + O[24]! * 7;
      if (was[3 + r] === key) continue;
      was[3 + r] = key;
      chip.hidden = !shown;
      chip.classList.toggle("kj-p2", O[28] === P2);
      chip.classList.toggle("kj-out", O[24] !== IN);
      (chip.children[1] as HTMLElement).textContent = O[28] === P2 ? "P2" : O[24] === IN ? "" : "OUT";
      (chip.querySelector("s") as HTMLElement).style.width = `${Math.round(O[7]!)}%`;
      (chip.lastChild as HTMLElement).textContent = O[25]!.toLocaleString("en-US");
    }
    const ph = S[0]!, mk = make.hidden ? 0 : 1;
    if (was[6] !== ph * 10 + mk) {
      was[6] = ph * 10 + mk;
      thePad.el.style.visibility = mk ? "hidden" : ""; // (the customiser covers it on a phone)
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY && !mk ? (touch ? "↑ at a wall grabs it · ✊ punches the face next to you · ✋ eat a snack · sparks bite" : "A/D walk · K jump at a wall to grab it · W/S climb · Space punch (hold W/S: up, down) · L eat · sparks bite") : "";
    }
  }
  function showEnd() {
    const won = S[4] === NB;
    cardH.textContent = won ? "BLOCK FLATTENED!" : "EVERYONE SHRANK!";
    cardT.textContent = `${S[2]!.toLocaleString("en-US")} pts together` + (S[2]! >= S[10]! ? " · BEST" : ` · best ${S[10]!.toLocaleString("en-US")}`);
    // One line per monster in the round, highest first.
    let html = "";
    const order = [0, 1, 2].filter((k) => MV[k]![24] !== 0 || MV[k]![25]! > 0 || k === 0).sort((a, b) => MV[b]![25]! - MV[a]![25]!);
    for (const k of order) {
      const O = MV[k]!, tag = k === 0 ? "P1" : O[28] === P2 ? "P2" : "CPU";
      html += `<li><i>${tag}</i><b>${who(k)}</b><span>${O[25]!.toLocaleString("en-US")}</span><em>${O[27]} holes · ${O[26]} snacks${O[29] ? " · shrank" : ""}</em></li>`;
    }
    board.innerHTML = html;
    cardS.textContent = `${Math.round((S[8]! / TOTAL_FLOORS) * 100)}% flat in ${Math.round(S[1]!)} s · ${S[4]} of ${NB} buildings · ${S[5]} ${S[5] === 1 ? "helicopter" : "helicopters"} · ${S[11]} ${S[11] === 1 ? "tank" : "tanks"} · ${S[12]} shocks`;
    card.hidden = false;
    say(`${won ? "Block flattened" : "Everyone shrank"}. ${M[25]} points for you, ${S[2]} together`);
    again.focus({ preventScroll: true });
  }
  function restart() {
    const best = S[10]!;
    run.reset();
    S[10] = best;
    card.hidden = true;
    shake = toastT = flash = 0;
    endT = -1;
    toastEl.hidden = true;
    dust.clear(), shard.clear(), smoke.clear(), chunk.clear(), spark.clear(), fx.clear();
    was.fill(-1);
    hudDirty = dirty = true;
    pose(1);
    engine.busy(1);
    play.focus({ preventScroll: true });
  }
  // ---- the customiser ----
  function syncMake() {
    const nm = heroName(look.fur, look.face);
    mname.textContent = nm;
    nameEl.textContent = nm;
    for (const o of opts) {
      const k = o.dataset.k as keyof Look, i = +o.dataset.i!;
      o.setAttribute("aria-pressed", "" + (k === "gear" ? (look.gear & (1 << i)) > 0 : look[k] === i));
    }
  }
  function set(k: keyof Look, v: number) {
    if (k === "gear") look.gear ^= 1 << v;
    else look[k] = v;
    syncMake();
    buildScene();
    dirty = true;
    engine.busy(0.6);
    engine.wake();
  }
  function openMake() {
    restart();
    make.hidden = false;
    makeTop = make.getBoundingClientRect().top - canvas.getBoundingClientRect().top;
    hudDirty = true;
    (make.querySelector('.kj-opt[aria-pressed="true"]') as HTMLElement | null)?.focus({ preventScroll: true });
  }
  function closeMake() {
    make.hidden = true;
    thePad.el.style.visibility = "";
    hudDirty = true;
    toast(`${heroName(look.fur, look.face)} WAKES UP`, "go");
    say(`${heroName(look.fur, look.face)}: walk or punch to start`);
    engine.busy(1.7);
    play.focus({ preventScroll: true });
  }
  function join(on: boolean) {
    run.join(on);
    p2K.setAttribute("aria-pressed", "" + on);
    hudDirty = true;
    engine.busy(1);
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
        ctx.fillRect(STARS[i]! * W, STARS[i + 1]! * H * 0.55, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    const r = Math.min(W, H) * 0.075;
    ctx.fillStyle = P.moon;
    ctx.beginPath();
    ctx.arc(W * 0.83, H * 0.2, r, 0, TAU);
    ctx.fill();
    if (P.night) {
      ctx.fillStyle = P.sky0;
      ctx.beginPath();
      ctx.arc(W * 0.83 - r * 0.42, H * 0.2 - r * 0.2, r * 0.86, 0, TAU);
      ctx.fill();
    }
  }
  function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    if (!dio.project(x0, y0, z0, tmp) || tmp[2]! < 0.5 || !dio.project(x1, y1, z1, tmp2) || tmp2[2]! < 0.5) return;
    ctx.moveTo(tmp[0]!, tmp[1]!);
    ctx.lineTo(tmp2[0]!, tmp2[1]!);
  }
  function paintCurb(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = P.curb;
    ctx.lineWidth = P.night ? 1.8 : 1.3;
    ctx.globalAlpha = P.night ? 0.9 : 0.8;
    if (P.night) ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    seg(ctx, -SX - 0.8, 0.045, STREET0, SX + 0.8, 0.045, STREET0);
    seg(ctx, -SX - 0.8, 0.005, STREET1, SX + 0.8, 0.005, STREET1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintPools(ctx: CanvasRenderingContext2D) {
    if (!P.night) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.glow;
    const f = dio.focal();
    for (let k = 0; k < LAMPS.length; k++) {
      if (!at(LAMPS[k]! + 0.38, 0, STREET0 + 0.4)) continue;
      const r = (f * 1.8) / tmp[2]!;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r * 0.8, r * 0.22, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintShadow(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    ctx.fillStyle = P.shadow;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[5] === CLIMB || O[5] === ROOF || (O[29] && O[1]! <= 0.01)) continue;
      if (at(O[0]!, 0.03, O[2]!)) {
        const r = (f * 1.25) / tmp[2]!, lift = O[1]!;
        ctx.globalAlpha = Math.max(0.08, 0.34 - lift * 0.05);
        ctx.beginPath();
        ctx.ellipse(tmp[0]!, tmp[1]!, r * (1 - Math.min(0.5, lift * 0.06)), r * 0.28, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (run.HE[0]! && at(run.HE[1]!, 0.03, run.HE[3]!)) {
      const r = (f * 1.1) / tmp[2]!;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r, r * 0.25, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /** The live parts' warning: a pulsing glow and a bolt; the antennas too. */
  function paintLive(ctx: CanvasRenderingContext2D) {
    const fc = dio.focal(), pulse = 0.5 + 0.5 * Math.sin(engine.time * 9);
    ctx.globalCompositeOperation = P.night ? "lighter" : "source-over";
    for (let k = 0; k < LIVE.length; k += 4) {
      const b = LIVE[k]!, fl = LIVE[k + 1]!;
      if (run.B[b * 6]! >= FALL || run.B[b * 6 + 3]! > fl) continue;
      const x = BLD[b * 4]! + LIVE[k + 2]! + 0.5, y = run.yOff(b) + fl + 0.45;
      if (!at(x, y, 0.2)) continue;
      const s = fc / tmp[2]!;
      ctx.globalAlpha = 0.18 + pulse * 0.25;
      ctx.fillStyle = P.zap;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, s * (0.55 + pulse * 0.15), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      bolt(ctx, tmp[0]!, tmp[1]!, s * 0.42);
    }
    for (let b = 0; b < NB; b++) {
      if (ANT[b] !== ANT[b] || run.B[b * 6] === RUBBLE) continue;
      if (!at(ANT[b]!, run.top(b) + 2.1, -DEPTH / 2)) continue;
      const s = fc / tmp[2]!;
      ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.fillStyle = P.zap;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, s * (0.3 + pulse * 0.2), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  /** A small lightning bolt (the live sign). */
  function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    if (r < 3) return;
    ctx.fillStyle = P.zap;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r);
    ctx.lineTo(x - r * 0.45, y + r * 0.1);
    ctx.lineTo(x - r * 0.02, y + r * 0.1);
    ctx.lineTo(x - r * 0.2, y + r);
    ctx.lineTo(x + r * 0.45, y - r * 0.15);
    ctx.lineTo(x + r * 0.02, y - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  function paintHoles(b: number) {
    return (ctx: CanvasRenderingContext2D) => {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, yo = run.yOff(b), fc = dio.focal();
      if (run.B[b * 6] === RUBBLE) return;
      for (let fl = rem; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, cs = run.cell[i]!;
        if (cs === INTACT || LIVE_CELL[i]) continue;
        const x = g.pos[0]! - w / 2 + col + 0.5, y = yo + fl + (fl === 0 ? 0.45 : 0.5);
        if (!at(x, y, 0.06)) continue;
        const s = fc / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, seed = (i * 7919) % 97;
        if (cs === HOLE) {
          const pop = 1 + run.crackT[i]! * 1.2;
          ctx.fillStyle = P.hole;
          ctx.strokeStyle = P.night ? P.holeRim : P.ink;
          ctx.lineWidth = Math.max(1, s * 0.035);
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU + seed * 0.05, rr = (k & 1 ? 0.17 : 0.3 + ((seed + k * 13) % 7) * 0.015) * s * pop;
            const px = cx + Math.cos(a) * rr * 1.05, py = cy + Math.sin(a) * rr * 0.95;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // A fresh hole glows inside for a moment (the fire behind the glass).
          if (run.crackT[i]! > 0) {
            ctx.globalAlpha = run.crackT[i]! * 2;
            ctx.fillStyle = P.fire;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.14, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.strokeStyle = P.ink;
          ctx.lineWidth = Math.max(1, s * 0.025);
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const a = k * 1.7 + seed, rr = s * 0.24;
            ctx.moveTo(cx - s * 0.05, cy - s * 0.04);
            ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    };
  }
  /** A person at a window (waving; panicking with both arms up when a monster is near), a sniper, or a hot pot. */
  function paintFolk(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    let b = 0;
    while (folk[b] !== p) b++;
    const i = C0[b]! + k, kind = run.occ[i]!, x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!;
    if (r < 1.5) return;
    const t = engine.time * 6 + k, lw = Math.max(1, r * 0.12);
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.ink;
    if (kind === 3) {
      // A pot on a stove, glowing hot, steam over it.
      ctx.fillStyle = P.fire;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.2, r * 0.9, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.75, r * 0.15);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.75, y);
      ctx.lineTo(x + r * 0.75, y);
      ctx.stroke();
      ctx.strokeStyle = P.paper;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let n = -1; n <= 1; n++) {
        const sx = x + n * r * 0.3, ph = Math.sin(t + n) * r * 0.12;
        ctx.moveTo(sx, y - r * 0.3);
        ctx.quadraticCurveTo(sx + r * 0.2 + ph, y - r * 0.6, sx - ph, y - r);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    // A monster near: panic.
    let panic = false;
    for (let m = 0; m < NM; m++) if (MV[m]![24] === IN && Math.abs(MV[m]![0]! - p.x[k]!) < 3.2) panic = true;
    const jx = panic ? Math.sin(t * 5) * r * 0.08 : 0;
    ctx.fillStyle = kind === 2 ? P.soldier : P.people[(i * 5) % 6]!;
    ctx.beginPath();
    ctx.roundRect(x + jx - r * 0.55, y + r * 0.15, r * 1.1, r * 0.75, r * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.arc(x + jx, y - r * 0.1, r * 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (kind === 2) {
      ctx.fillStyle = P.helmet;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.18, r * 0.42, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.45, y + r * 0.2);
      ctx.lineTo(x + r * 0.7, y - r * 0.55);
      ctx.stroke();
    } else {
      ctx.beginPath();
      const wv = Math.sin(t) * r * 0.25;
      ctx.moveTo(x + jx - r * 0.45, y + r * 0.25);
      ctx.lineTo(x + jx - r * 0.75 + wv, y - r * 0.6);
      if (panic) ctx.moveTo(x + jx + r * 0.45, y + r * 0.25), ctx.lineTo(x + jx + r * 0.75 - wv, y - r * 0.6);
      ctx.stroke();
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(x + jx, y + r * 0.02, r * (panic ? 0.13 : 0.09), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + jx - r * 0.17, y - r * 0.2, lw, lw);
    ctx.fillRect(x + jx + r * 0.12, y - r * 0.2, lw, lw);
  }
  function paintSoldier(ctx: CanvasRenderingContext2D, s: number, p: DioramaPoints) {
    const x = p.sx[s]!, y = p.sy[s]!, r = p.sr[s]!, o = s * 8, dir = run.SO[o + 3]!, aim = run.SO[o + 4]!, st = Math.sin(run.SO[o + 7]!) * (aim ? 0 : 1);
    if (r < 1.5) return;
    const lw = Math.max(1, r * 0.13);
    ctx.lineWidth = lw * 1.6;
    ctx.strokeStyle = P.ink;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x - r * 0.25 + st * r * 0.25, y + r);
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x + r * 0.25 - st * r * 0.25, y + r);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.fillStyle = P.soldier;
    ctx.beginPath();
    ctx.roundRect(x - r * 0.32, y - r * 0.45, r * 0.64, r * 0.85, r * 0.15);
    ctx.fill();
    ctx.stroke();
    const wind = aim ? Math.max(0, 1 - run.SO[o + 5]! * 2) : 0;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(x + dir * r * 0.2, y - r * 0.3);
    ctx.lineTo(x + dir * r * (0.5 - wind * 0.9), y - r * (0.5 + wind * 0.4));
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.68, r * 0.27, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.helmet;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.74, r * 0.32, Math.PI, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  /** A pebble (a dot), or a tank shell (a bigger round with a trail of sparks). */
  function paintPebble(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = Math.max(1.5, p.sr[k]!), kind = run.PB[k * 8 + 7]!;
    ctx.fillStyle = kind === 2 ? P.shell : P.pebble;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    if (kind === 2) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x - run.PB[k * 8 + 4]! * 1.2, y + run.PB[k * 8 + 5]! * 1.2, r * 0.7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (kind === 2) ctx.stroke();
  }
  function paintChute(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, o = k * 9, landed = run.CH[o + 7]!, kind = run.CH[o + 6]!, t = run.CH[o + 8]!;
    if (r < 1.5) return;
    const lw = Math.max(1, r * 0.11), sway = landed ? 0 : Math.sin(t * 2.2 + k) * 0.18;
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.ink;
    const by = landed ? y + r * 0.2 : y + r * 0.9;
    if (!landed) {
      const open = Math.min(1, t * 4), cx = x + sway * r * 2, cy = y - r * 0.9, cw = r * (0.6 + open * 0.9);
      ctx.fillStyle = P.chute[k % 4]!;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, r * 0.7 * open + r * 0.2, sway, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = P.chute[(k + 1) % 4]!;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.36, r * 0.7 * open + r * 0.2, sway, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - cw, cy);
      ctx.lineTo(x - r * 0.2, by - r * 0.45);
      ctx.moveTo(cx + cw, cy);
      ctx.lineTo(x + r * 0.2, by - r * 0.45);
      ctx.stroke();
    }
    ctx.fillStyle = kind === 2 ? P.soldier : P.people[k % 6]!;
    ctx.beginPath();
    ctx.roundRect(x - r * 0.26, by - r * 0.4, r * 0.52, r * 0.6, r * 0.12);
    ctx.fill();
    ctx.stroke();
    if (landed) {
      const st = Math.sin(t * 20) * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, by + r * 0.2);
      ctx.lineTo(x - st, by + r * 0.55);
      ctx.moveTo(x, by + r * 0.2);
      ctx.lineTo(x + st, by + r * 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.arc(x, by - r * 0.62, r * 0.27, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (kind === 2) {
      ctx.fillStyle = P.helmet;
      ctx.beginPath();
      ctx.arc(x, by - r * 0.68, r * 0.3, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, by - r * 0.47, r * 0.1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  /** A knocked-out monster, shrunk to a tiny comic figure in its own colours, running off the table. */
  function paintRunner(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, O = MV[k]!, m = mons[k]!, st = Math.sin(O[13]! * 2) * r * 0.4, d = O[3]! > 0 ? 1 : -1;
    if (r < 2) return;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = P.ink;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x - st, y + r);
    ctx.moveTo(x, y + r * 0.3);
    ctx.lineTo(x + st, y + r);
    ctx.moveTo(x, y - r * 0.2);
    ctx.lineTo(x - d * r * 0.6, y - r * 0.9 - st * 0.3);
    ctx.moveTo(x, y - r * 0.2);
    ctx.lineTo(x + d * r * 0.5, y - r * 0.8 + st * 0.3);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = m.main;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + d * r * 0.1, y - r * 0.75, r * 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Big worried eyes and sweat drops.
    ctx.fillStyle = P.paper;
    ctx.beginPath();
    ctx.arc(x + d * r * 0.24, y - r * 0.8, r * 0.13, 0, TAU);
    ctx.arc(x + d * r * 0.0, y - r * 0.8, r * 0.13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = m.acc;
    ctx.beginPath();
    ctx.arc(x - d * r * 0.45, y - r * 1.15, r * 0.09, 0, TAU);
    ctx.fill();
  }
  /** A shocked monster: bolts round it, and every other flicker its bones show (an x-ray gag). */
  function paintZap(ctx: CanvasRenderingContext2D, k: number) {
    const O = MV[k]!, zap = O[23]!;
    if (zap <= 0 || O[24] !== IN || !at(O[0]!, O[1]! + mons[k]!.height * 0.55, O[2]!)) return;
    const s = dio.focal() / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, h = mons[k]!.height * s;
    ctx.strokeStyle = P.zap;
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.globalCompositeOperation = P.night ? "lighter" : "source-over";
    ctx.beginPath();
    for (let n = 0; n < 6; n++) {
      const a = n * 1.05 + engine.time * 30, r0 = h * 0.35, r1 = h * 0.62;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + 0.25) * (r0 + r1) * 0.5, cy + Math.sin(a - 0.2) * (r0 + r1) * 0.5);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    if (((engine.time * 16) | 0) & 1) return;
    // The x-ray: a skull, a spine, ribs, in light lines over the dark flicker.
    ctx.strokeStyle = P.paper;
    ctx.fillStyle = P.paper;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath();
    ctx.arc(cx + O[6]! * h * 0.12, cy - h * 0.36, h * 0.1, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.25);
    ctx.lineTo(cx, cy + h * 0.3);
    for (let n = 0; n < 4; n++) {
      const yy = cy - h * 0.18 + n * h * 0.08, ww = h * (0.16 - n * 0.02);
      ctx.moveTo(cx - ww, yy + h * 0.03);
      ctx.quadraticCurveTo(cx, yy - h * 0.03, cx + ww, yy + h * 0.03);
    }
    ctx.moveTo(cx - h * 0.12, cy + h * 0.32);
    ctx.lineTo(cx + h * 0.12, cy + h * 0.32);
    ctx.stroke();
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (fx.live) fx.draw(ctx, !P.night);
    for (let k = 0; k < NM; k++) {
      paintZap(ctx, k);
      // The nom puff by a mouth.
      const O = MV[k]!;
      if (O[18]! > 0 && O[24] === IN) {
        mouth(k);
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) {
          const q = O[18]! / 0.6, r = (dio.focal() * (0.3 + (1 - q) * 0.5)) / tmp[2]!;
          ctx.globalAlpha = q * 0.8;
          ctx.fillStyle = P.paper;
          ctx.strokeStyle = P.ink;
          ctx.lineWidth = 2;
          for (let n = 0; n < 3; n++) {
            ctx.beginPath();
            ctx.arc(tmp[0]! + (n - 1) * r * 0.8, tmp[1]! - r * (0.4 + (n & 1) * 0.5), r * 0.5, 0, TAU);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
    }
    // A shock's flash over everything (none for reduced motion).
    if (flash > 0 && calm) {
      ctx.globalAlpha = flash * 1.4;
      ctx.fillStyle = P.zap;
      ctx.fillRect(0, 0, dio.width, dio.height);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the loop ----
  const GP = new Float64Array(12), GB = new Uint8Array(6);
  // Player two's keys: [left, right, up, down] held, and the presses (punch, jump, grab).
  const K2 = new Float64Array(4), K2P = new Uint8Array(3);
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
        sky = null;
        frame();
        makeTop = make.getBoundingClientRect().top - cr.top;
        if (V[7]) dio.cam.tx = Math.max(-SX + 6.5, Math.min(SX - 6.5, M[0]!));
        hudDirty = dirty = true;
      }
      if (V[6]) gamepadRead();
      if (first && V[5]) (first = null), (make.hidden ? play : (make.querySelector(".kj-go") as HTMLElement)).focus({ preventScroll: true });
    },
    step(e, dt) {
      if (endT > 0 && (endT -= dt) <= 0) showEnd();
      if (auto) run.autopilot(I, 0);
      else {
        const stick = c.stick.active;
        I[0] = GP[0]! || (stick ? c.stick.x : c.axis("left", "right"));
        I[1] = -GP[1]! || (stick ? -c.stick.y : c.axis("down", "up"));
        I[2] = c.hit(PUNCH) || GP[2]! ? 1 : 0;
        I[3] = c.hit(JUMP) || GP[3]! ? 1 : 0;
        I[4] = c.hit(GRAB) || GP[4]! ? 1 : 0;
        GP[2] = GP[3] = GP[4] = 0;
      }
      I2[0] = GP[6]! || K2[1]! - K2[0]!;
      I2[1] = -GP[7]! || K2[2]! - K2[3]!;
      I2[2] = K2P[0] || GP[8]! ? 1 : 0;
      I2[3] = K2P[1] || GP[9]! ? 1 : 0;
      I2[4] = K2P[2] || GP[10]! ? 1 : 0;
      K2P.fill(0);
      GP[8] = GP[9] = GP[10] = 0;
      if (!card.hidden || !make.hidden) I.fill(0), I2.fill(0);
      let moving = run.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!, I2[0]!, I2[1]!, I2[2]!, I2[3]!, I2[4]!);
      if (run.n) events(), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (S[0] === 1) moving = true;
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
      lastDt = dt;
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose(lastDt);
      const cam = dio.cam, k = (shake * shake * 16 + fx.shake * 0.5) * calm, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });
  // Gamepads: the first is player one, the second player two (it joins on its first press). The left
  // stick (or the d-pad) moves and climbs; A jumps, X or RT punches, B or Y grabs.
  function gamepadRead() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    GP[0] = GP[1] = GP[6] = GP[7] = 0;
    if (!pads) return;
    let n = 0;
    for (let i = 0; i < pads.length && n < 2; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      const o = n * 6, ax = p.axes, bt = p.buttons, v = (k: number) => (bt[k] && bt[k]!.pressed ? 1 : 0);
      const dz = (a: number) => (a > 0.2 ? (a - 0.2) / 0.8 : a < -0.2 ? (a + 0.2) / 0.8 : 0);
      GP[o] = dz(ax[0] ?? 0) || v(15) - v(14);
      GP[o + 1] = dz(ax[1] ?? 0) || v(13) - v(12);
      const now0 = v(2) || v(7), now1 = v(0), now2 = v(1) || v(3), g = n * 3;
      if (now0 && !GB[g]) GP[o + 2] = 1;
      if (now1 && !GB[g + 1]) GP[o + 3] = 1;
      if (now2 && !GB[g + 2]) GP[o + 4] = 1;
      GB[g] = now0; GB[g + 1] = now1; GB[g + 2] = now2;
      const any = GP[o] || GP[o + 1] || now0 || now1 || now2;
      if (any && n === 0) (auto = false), engine.wake();
      if (any && n === 1 && run.MV[CRAB]![28] === AI) join(true);
      n++;
    }
  }

  // ---- input: keys on the stage, a tap on the street punches, the stickers and the customiser ----
  const MAP: Record<string, string> = { KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down", Space: "punch", KeyJ: "punch", KeyK: "jump", KeyL: "grab" };
  const ARROWS: Record<string, string> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  const P2KEYS: Record<string, number> = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }, P2ACT: Record<string, number> = { Comma: 0, Period: 1, Slash: 2 };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!make.hidden) {
      if (e.code === "Enter" && !(e.target as Element).closest?.("button")) return void (e.preventDefault(), closeMake());
      return;
    }
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyR") return void (e.preventDefault(), restart());
    if (e.code === "KeyC") return void (e.preventDefault(), openMake());
    if (e.code === "Digit2") return void (e.preventDefault(), join(run.MV[CRAB]![28] !== P2));
    const p2 = run.MV[CRAB]![28] === P2;
    // Player two: the arrows (once in) and , . / (which also bring player two in).
    if (P2ACT[e.code] !== undefined) {
      e.preventDefault();
      if (!p2) join(true);
      if (!e.repeat) K2P[P2ACT[e.code]!] = 1;
      return void engine.wake();
    }
    if (p2 && P2KEYS[e.code] !== undefined) return void (e.preventDefault(), (K2[P2KEYS[e.code]!] = 1), engine.wake());
    const k = MAP[e.code] ?? ARROWS[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
    if ((e.target as Element).closest?.(".kj-card") && (e.code === "Space" || e.code === "Enter")) return;
    e.preventDefault();
    if (!card.hidden) return;
    auto = false;
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    if (P2KEYS[e.code] !== undefined) K2[P2KEYS[e.code]!] = 0;
    const k = MAP[e.code] ?? ARROWS[e.code];
    if (k) c.press(k, false);
  }, sig);
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!card.hidden || !make.hidden) return;
    auto = false;
    c.press("punch");
    c.press("punch", false);
    engine.wake();
  }, sig);
  muteK.addEventListener("click", toggle, sig);
  makeK.addEventListener("click", openMake, sig);
  p2K.addEventListener("click", () => join(run.MV[CRAB]![28] !== P2), sig);
  again.addEventListener("click", () => restart(), sig);
  change.addEventListener("click", openMake, sig);
  go.addEventListener("click", closeMake, sig);
  rand.addEventListener("click", () => {
    look.fur = (rnd() * 6) | 0; look.trim = (rnd() * 6) | 0; look.pattern = (rnd() * 3) | 0; look.face = (rnd() * 3) | 0; look.gear = (rnd() * 16) | 0;
    set("fur", look.fur);
  }, sig);
  for (const o of opts) o.addEventListener("click", () => set(o.dataset.k as keyof Look, +o.dataset.i!), sig);
  for (const t of tabs) t.addEventListener("click", () => {
    make.dataset.tab = t.dataset.tab!;
    for (const u of tabs) u.setAttribute("aria-pressed", "" + (u === t));
  }, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  // The poster (scripts/gallery-posters.mjs): the ape hanging on a side wall punching windows out, a rival on the block.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    make.hidden = true;
    look.fur = 1; look.trim = 0; look.pattern = 1; look.face = 0; look.gear = 3;
    syncMake();
    buildScene();
    run.reset();
    run.HE[8] = 4;
    auto = true;
  }

  syncMake();
  buildScene();
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
      return {
        phase: S[0]!, mode: M[5]!, hp: M[7]!, score: S[2]!, mine: M[25]!, flat: Math.round((S[8]! / TOTAL_FLOORS) * 100), holes: S[3]!, helis: S[5]!, tanks: S[11]!, snacks: S[6]!, shocks: S[12]!,
        making: !make.hidden, card: !card.hidden, name: heroName(look.fur, look.face), x: M[0]!, y: M[1]!, p2: run.MV[CRAB]![28] === P2,
      };
    },
    run,
    look,
    set,
    join,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the ape on a side wall, windows blown out, a rival at work (scripts/gallery-posters.mjs). */
export const posterAt = 4;
void [DONE, KO, E_PUNCH, E_FLOOR, CRACKED];
