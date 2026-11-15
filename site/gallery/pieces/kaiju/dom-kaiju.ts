// "DOM Kaiju" (hero, Hi-Fi): a giant monster on a tabletop city block, seen side-on. Build your
// monster first (three bodies, four heads, two tones, a pattern; it gets its own name), then wreck
// the block: walk the street, jump, climb a building's face, punch the windows (every punch a hole;
// enough holes and it shakes, then pancakes down floor by floor in a cloud of dust and you drop
// off), swat the helicopter out of the air, flick the soldiers away (they float off on little
// parachutes, grumpy), and grab people from the windows for a snack ("nom": health back). The round
// ends when the block is flat or your health is out.
// Bricks: the kernel (fixed step, settle, the ledger for every page write so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/fx (the blasts and the pop words),
// @fzlt/core/input + @fzlt/core/pad (keys, the touch stick and the PUNCH, JUMP and GRAB keys),
// @fzlt/core/slot, @fzlt/core/sound; the Bikes series' particle pool and its gamepad read
// (../bikes/kit.ts). The block and the round are ./block.ts (headless, tests/dom-kaiju.test.mjs),
// the monster and its parts ./monster.ts; this file is the scene (tests/dom-kaiju.mjs).
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
  blockRun, BLD, NB, C0, NC, NS, NP, NCH, NEED, DEPTH, SX, STREET0, STREET1, TOTAL_FLOORS, MAX_HP, READY, RUN, DONE, WALK, CLIMB, ROOF, KO,
  INTACT, CRACKED, HOLE, STAND, SHAKE, FALL, RUBBLE,
  E_START, E_PUNCH, E_HOLE, E_SHAKE, E_FLOOR, E_FLAT, E_HELI, E_HELI_CRASH, E_NOM, E_HURT, E_FLING, E_DROP, E_KO, E_END, E_STOMP, E_JUMP, E_LAND, E_CLIMB,
} from "./block";
import { buildMonster, monsterName, BODIES, HEADS, PATTERNS, TONES, type Look, type Monster } from "./monster";

const TAU = 6.283185307179586;
// Palettes by role: a neon night (dark) and a pastel day (light).
const DARK = {
  night: true, light: [-0.45, 1, 0.6], amb: 0.52,
  sky0: "#07051c", sky1: "#1d0d3d", sky2: "#45145e", star: "#cfd8ff", moon: "#efe9ff",
  table: "#0c0a1a", plinth: "#15122b", rim: "#22e6ff", street: "#1b1932", walk: "#2b2847", curb: "#22e6ff", dash: "#ffd166",
  walls: ["#3b3466", "#2c3f6a", "#4a2f5e", "#2a4a58", "#3a2c52"], ledge: ["#4e4680", "#3b5486", "#623f7c", "#3a6272", "#4c3b6c"], roof: "#1c1934",
  win: "#ffd27a", win2: "#7cf6ff", crack: "#c99a5a", hole: "#07060f", holeRim: "#ff4fa8", door: "#120f22", awning: ["#ff4fa8", "#22e6ff", "#ffd166", "#9d7bff", "#39ffb0"],
  rubble: ["#3b3466", "#2c2650", "#4b426e"], tank: "#5a5480", pole: "#3a3658", lamp: "#fff1c2", glow: "#ffcf7a", antenna: "#ff2e55",
  heli: "#5d6b4a", heli2: "#3e4a32", glass: "#7cf6ff", rotor: "#1a1a26",
  soldier: "#7d8b52", helmet: "#4e5a30", skin: "#e8b48f", people: ["#ff8fb8", "#6fd3ff", "#ffd166", "#7ee0a8", "#c0c6ff", "#ff9e6b"], chute: ["#ff4fa8", "#ffffff", "#22e6ff", "#ffd166"],
  pebble: "#ffe066", dust: "#8a84b8", shard: "#bff6ff", smoke: "#a39fc4", shadow: "#000000",
  ink: "#0b0a14", paper: "#f6f3ff", good: "#39ffb0", warn: "#ffd166", bad: "#ff4f5e", eye: "#fff6c9", pupil: "#0b0a14", teeth: "#f6f3ff",
};
type Pal = typeof DARK;
const LIGHT: Pal = {
  ...DARK, night: false, light: [0.55, 1, 0.7], amb: 0.6,
  sky0: "#bfe6ff", sky1: "#e4f4ff", sky2: "#fff1dc", star: "#ffffff", moon: "#fff6cc",
  table: "#c9a585", plinth: "#8a6448", rim: "#fff3dc", street: "#6b7088", walk: "#dcd6cc", curb: "#f4efe6", dash: "#fff3b0",
  walls: ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#e9d8ff"], ledge: ["#f4b87a", "#94c4f0", "#f5a3c0", "#a7e39a", "#cdb6f5"], roof: "#7d6b9e",
  win: "#e8f6ff", win2: "#cfeeff", crack: "#b9c6d6", hole: "#2a2236", holeRim: "#ef476f", door: "#6d4c41", awning: ["#ef476f", "#118ab2", "#ffd166", "#8e7dbe", "#06d6a0"],
  rubble: ["#d9c2a5", "#bfa88c", "#e8d6be"], tank: "#9aa0b8", pole: "#7b8094", lamp: "#fff6cc", glow: "#fff6cc", antenna: "#e63946",
  heli: "#6f8a5a", heli2: "#4f6642", glass: "#cfe8ff", rotor: "#2a2a33",
  soldier: "#6f8a4a", helmet: "#4f6634", skin: "#e8b48f", chute: ["#ef476f", "#ffffff", "#118ab2", "#ffd166"],
  pebble: "#ff9f1c", dust: "#d9d2c3", shard: "#ffffff", smoke: "#eeeeee", shadow: "#3a2a24",
  ink: "#1b1420", paper: "#ffffff", good: "#06a77d", warn: "#f4a261", bad: "#e63946", eye: "#ffffff", pupil: "#1b1420", teeth: "#ffffff",
};
const WORDS = ["CRUNCH!", "KRAK!", "SMASH!", "TIMBER!", "FLAT!", "SWAT!", "KA-BLAM!", "NOM!", "BOINK!", "STOMP!", "OOF!"];
const W_CRUNCH = 0, W_TIMBER = 3, W_FLAT = 4, W_SWAT = 5, W_BLAM = 6, W_NOM = 7, W_BOINK = 8, W_STOMP = 9, W_OOF = 10;
const DUST = 120, SHARD = 60, SMOKE = 40;

export type KaijuScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { phase: number; mode: number; hp: number; score: number; flat: number; holes: number; helis: number; snacks: number; making: boolean; card: boolean; name: string; x: number; y: number };
  /** Play by itself (the poster, the tests). */
  auto: boolean;
  /** The round (the tests read it). */
  readonly run: ReturnType<typeof blockRun>;
  /** The monster's parts. */
  readonly look: Look;
  /** Set a part (the customiser's keys): body, head, main, accent, pattern. */
  set(k: keyof Look, v: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): KaijuScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 20261115 });
  const L = engine.ledger, sig = { signal: engine.signal };
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
  const look: Look = { body: 0, head: 0, main: 0, accent: 5, pattern: 0 };

  // ---- the page: the canvas, the play surface (pointer + keyboard focus), the stickers, the cards, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "kj-play";
  play.setAttribute("aria-label", "DOM Kaiju: A and D (or left and right) walk, W and S (or up and down) climb, Space or J punches, K jumps, L grabs. C builds a new monster, R restarts, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "kj-hud";
  const row = (k: string, label: string, items: string[], swatch = false) =>
    `<div class="kj-row" data-k="${k}"><i>${label}</i><p>${items.map((t, i) => `<button type="button" class="kj-opt${swatch ? " kj-sw" : ""}" data-k="${k}" data-i="${i}" aria-pressed="false"${swatch ? ` style="--c:${t}" aria-label="${label.toLowerCase()} ${TONES[i]!.name}"` : ""}>${swatch ? "" : t}</button>`).join("")}</p></div>`;
  hud.innerHTML = `<div class="kj-head"><p class="kj-top"><b class="kj-chip kj-name"><span></span></b><b class="kj-chip kj-hp"><em>HP</em><u><s></s></u></b><b class="kj-chip kj-score"><span>0</span></b><b class="kj-chip kj-flat"><span>0%</span><em>FLAT</em></b></p><p class="kj-hint"></p></div><p class="kj-toast" hidden></p><p class="kj-live" aria-live="polite"></p><p class="kj-keys"><button type="button" class="kj-key kj-make-k" aria-label="Build a monster (C)">MONSTER</button><button type="button" class="kj-key kj-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p>`
    + `<div class="kj-make" role="dialog" aria-label="Build your monster" data-tab="body"><b class="kj-mname"></b><p class="kj-tabs">${["body", "head", "main", "accent", "pattern"].map((k, i) => `<button type="button" class="kj-tab" data-tab="${k}" aria-pressed="${!i}">${["BODY", "HEAD", "TONE", "TONE 2", "PATTERN"][i]}</button>`).join("")}</p>${row("body", "BODY", BODIES.map((b) => b.name))}${row("head", "HEAD", HEADS.map((h) => h.name))}${row("main", "TONE", TONES.map((t) => t.c), true)}${row("accent", "TONE 2", TONES.map((t) => t.c), true)}${row("pattern", "PATTERN", PATTERNS.map((p) => p.name))}<p class="kj-go-row"><button type="button" class="bui-key kj-rand">RANDOM</button><button type="button" class="bui-key kj-go">SMASH!</button></p></div>`
    + `<div class="kj-card" role="dialog" aria-label="Round over" hidden><b></b><p class="kj-t"></p><p class="kj-stats"></p><p class="kj-again-row"><button type="button" class="bui-key kj-again">SMASH AGAIN</button><button type="button" class="bui-key kj-change">NEW MONSTER</button></p></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement;
  const toastEl = hud.children[1] as HTMLElement, live = hud.children[2] as HTMLElement, keysEl = hud.children[3] as HTMLElement, make = hud.children[4] as HTMLElement, card = hud.children[5] as HTMLElement;
  const nameEl = top.children[0]!.firstChild as HTMLElement, hpBar = top.children[1]!.querySelector("s") as HTMLElement, hpChip = top.children[1] as HTMLElement;
  const scoreEl = top.children[2]!.firstChild as HTMLElement, flatEl = top.children[3]!.firstChild as HTMLElement;
  const makeK = keysEl.children[0] as HTMLButtonElement, muteK = keysEl.children[1] as HTMLButtonElement;
  const mname = make.querySelector(".kj-mname") as HTMLElement, opts = [...make.querySelectorAll<HTMLButtonElement>(".kj-opt")];
  const tabs = [...make.querySelectorAll<HTMLButtonElement>(".kj-tab")];
  const go = make.querySelector(".kj-go") as HTMLButtonElement, rand = make.querySelector(".kj-rand") as HTMLButtonElement;
  const cardH = card.children[0] as HTMLElement, cardT = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement;
  const again = card.querySelector(".kj-again") as HTMLButtonElement, change = card.querySelector(".kj-change") as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "roar", punch: "punch", hole: "glass", floor: "thud", flat: "boom", heli: "hit", crash: "boom", nom: "nom", hurt: "hurt", fling: "click", ko: "end", end: "win", jump: "click", climb: "click" },
    notes: {
      roar: [[150, 70, 0.5, 0, "sawtooth", 0.12], [110, 55, 0.55, 0.05, "square", 0.06]],
      punch: [[160, 60, 0.09, 0, "square", 0.1]],
      glass: [[2400, 1300, 0.07, 0, "triangle", 0.06], [3100, 1800, 0.06, 0.03, "triangle", 0.04]],
      thud: [[90, 40, 0.22, 0, "sawtooth", 0.1]],
      nom: [[420, 300, 0.07, 0, "square", 0.07], [380, 260, 0.07, 0.1, "square", 0.07]],
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
  const run = blockRun(), S = run.S, M = run.M;
  const fx = effects({ cap: 260, scorch: 0, words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"] });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.table, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const groups: DioramaObject[] = [], floors: DioramaObject[][] = [], wins: DioramaObject[] = new Array(NC), rubble: DioramaObject[] = [], roofs: DioramaObject[] = [];
  let mon: Monster, heli: DioramaObject, rotor: DioramaObject, tailRotor: DioramaObject;
  let soldiers: DioramaPoints, pebbles: DioramaPoints, chutes: DioramaPoints, dust: Pool, shard: Pool, smoke: Pool;
  const folk: DioramaPoints[] = [];
  const rnd = seeded(20261115);
  let sky: CanvasGradient | null = null;
  const STARS = new Float32Array(90);
  for (let i = 0; i < 90; i++) STARS[i] = rnd();
  const LAMPS = [-14.4, -8.2, -2.6, 2.4, 7.4, 13.2];

  function buildScene() {
    dio.clear();
    groups.length = floors.length = rubble.length = roofs.length = folk.length = 0;
    dio.setLight(P.light, P.amb);
    dio.cluster("sky", { fixed: -10 });
    dio.cluster("ground", { fixed: -5 });
    dio.decal("sky", 0, paintSky);
    const G = (size: number[], pos: number[], color: string, layer: number, emissive = false) => dio.add({ size, pos, color, cluster: "ground", layer, emissive, pick: false });
    // The table, the plinth with its neon rim, the lot behind, the sidewalk and the street.
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
    // Street lamps along the curb.
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
      const g = dio.add({ id, shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false });
      groups.push(g);
      const fs: DioramaObject[] = [];
      for (let fl = 0; fl < f; fl++) {
        const fid = id + "f" + fl;
        fs.push(dio.add({ id: fid, size: [w, 1, DEPTH], pos: [0, fl, 0], on: id, color: P.walls[lk]!, pick: false, layer: 5 }));
        dio.add({ size: [w + 0.12, 0.09, DEPTH + 0.12], pos: [0, -0.09, 0], on: fid, color: P.ledge[lk]!, pick: false, layer: 6 });
        for (let col = 0; col < w; col++) {
          const i = C0[b]! + fl * w + col, gf = fl === 0;
          // The ground floor: shop windows and a door; above, rows of windows.
          if (gf && col === ((w / 2) | 0)) {
            dio.add({ size: [0.5, 0.78, 0.05], pos: [col - w / 2 + 0.5, -1, DEPTH / 2 + 0.01], on: fid, color: P.door, pick: false, layer: 7 });
          }
          // (The door's cell keeps a small window over the door.)
          const door = gf && col === ((w / 2) | 0);
          wins[i] = dio.add({ size: door ? [0.5, 0.18, 0.05] : gf ? [0.74, 0.5, 0.05] : [0.58, 0.54, 0.05], pos: [col - w / 2 + 0.5, door ? -0.2 : gf ? -0.84 : -0.78, DEPTH / 2 + 0.01], on: fid, color: P.win, emissive: P.night, pick: false, layer: 7 });
        }
        if (fl === 0) for (let k = 0; k < w * 2; k++) dio.add({ size: [0.5, 0.06, 0.5], pos: [-w / 2 + 0.25 + k * 0.5, -0.12, DEPTH / 2 + 0.25], rot: [-0.35, 0, 0], on: fid, color: P.awning[(k + lk) & 1 ? lk : (lk + 2) % 5]!, pick: false, layer: 8 });
      }
      floors.push(fs);
      // The roof: a parapet, a water tank or an antenna, a vent.
      const rid = id + "r";
      roofs.push(dio.add({ id: rid, shape: "group", size: [w, 0, DEPTH], pos: [0, f, 0], on: id, pick: false }));
      dio.add({ size: [w + 0.16, 0.22, DEPTH + 0.16], pos: [0, 0, 0], on: rid, color: P.roof, pick: false, layer: 6 });
      if (lk % 2 === 0) {
        dio.add({ shape: "cyl", sides: 8, size: [0.9, 0.9, 0.9], pos: [-w / 2 + 1, 0.55, -0.4], on: rid, color: P.tank, pick: false, layer: 7 });
        for (const lx of [-0.3, 0.3]) dio.add({ size: [0.06, 0.4, 0.06], pos: [-w / 2 + 1 + lx, 0.18, -0.4], on: rid, color: P.pole, pick: false, layer: 7 });
      } else {
        dio.add({ size: [0.08, 1.6, 0.08], pos: [w / 2 - 0.8, 0.2, -0.5], on: rid, color: P.pole, pick: false, layer: 7 });
        dio.add({ shape: "cyl", sides: 6, size: [0.16, 0.16, 0.16], pos: [w / 2 - 0.8, 1.78, -0.5], on: rid, color: P.antenna, emissive: true, pick: false, layer: 7 });
      }
      dio.add({ size: [0.7, 0.35, 0.5], pos: [0.6, 0.2, 0.5], on: rid, color: P.ledge[lk]!, pick: false, layer: 7 });
      // The rubble it leaves.
      const rb = dio.add({ id: id + "x", shape: "group", size: [w, 0, DEPTH], pos: [x0 + w / 2, 0, -DEPTH / 2], cluster: cl, pick: false, alpha: 0 });
      // A heap: slabs of its walls and ledges, broken concrete, a window frame on top.
      for (let k = 0; k < 11; k++) {
        const s = 0.6 + ((k * 37) % 5) * 0.16, u = ((k * 0.618) % 1), v = ((k * 0.414) % 1), hgt = k < 5 ? 0 : k < 9 ? 0.35 : 0.7;
        const col = k % 3 === 0 ? P.walls[lk]! : k % 3 === 1 ? P.ledge[lk]! : P.rubble[k % 3]!;
        dio.add({ shape: k % 4 === 1 ? "wedge" : "box", size: [s * 1.5, s * 0.5, s * 0.9], pos: [-w / 2 + 0.6 + u * (w - 1.2), hgt, -1 + v * 2], rot: [0, k * 0.9, ((k % 3) - 1) * 0.22], on: id + "x", color: col, pick: false });
      }
      rubble.push(rb);
      dio.decal(cl, 7.5, paintHoles(b));
      folk.push(dio.points({ cap: w * f, cluster: cl, layer: 7.6, paint: paintFolk }));
    }
    // The monster (its own cluster, by its feet).
    mon = buildMonster(dio, look, { ink: P.ink, eye: P.eye, pupil: P.pupil, teeth: P.teeth, night: P.night });
    // The helicopter: a cabin, a tail boom and fin, skids, the rotors.
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
    // The street's little people, the pebbles, the parachutes, the dust.
    soldiers = dio.points({ cap: NS, paint: paintSoldier });
    chutes = dio.points({ cap: NCH, paint: paintChute });
    pebbles = dio.points({ cap: NP, color: P.pebble });
    dust = pool(dio, DUST, P.dust, 6);
    shard = pool(dio, SHARD, P.shard, 6);
    smoke = pool(dio, SMOKE, P.smoke, 6);
    sky = null;
    pose(0);
  }

  // ---- state ----
  const I = new Float64Array(5), tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom, [5] drawn once, [6] gamepad on, [7] tall.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let auto = false, dirty = true, hudDirty = true, shake = 0, toastT = 0, endT = -1, flatSaid = -1;
  const was = new Float64Array(6).fill(-1);
  // One camera per stage shape: side-on, a little above the street; a resize changes the field of view only.
  const CAM = { yaw: 0, pitch: 0.2, dist: 36, tx: 0, ty: 4.2, tz: 0.2, ox: 0, oy: 0, fov: 0.6 };
  const HF = new Float64Array(2); // the horizontal half-width the stage shows at the target, wide and tall
  HF[0] = 15.6; HF[1] = 7.6;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  addEventListener("gamepadconnected", () => ((V[6] = 1), engine.wake()), sig);

  function frame() {
    const W = dio.width, H = dio.height, tall = W / H < 1.25;
    V[7] = tall ? 1 : 0;
    const cam = dio.cam;
    cam.yaw = 0;
    cam.pitch = tall ? 0.18 : 0.2;
    cam.dist = tall ? 24 : 36;
    cam.ty = tall ? 4.0 : 4.4;
    cam.tz = 0.2;
    // The field of view that shows HF units either side of the target.
    const hf = HF[V[7]!]!;
    cam.fov = 2 * Math.atan((hf / cam.dist) * (H / W));
    cam.ox = 0;
    // Room for the stickers on top: shift the picture down a little.
    cam.oy = V[4] = tall ? H * 0.04 : Math.min(H * 0.12, V[3]! * 0.5);
    if (!tall) cam.tx = -0.4;
  }
  function stepCam(dt: number) {
    if (!V[7]) return false;
    // Tall: the camera walks along the street with the monster (it never zooms); while the customiser
    // covers the bottom, the picture slides up so the monster stands just over it.
    const cam = dio.cam, want = Math.max(-SX + 6.5, Math.min(SX - 6.5, M[0]!)), d = want - cam.tx;
    let moving = false;
    if (Math.abs(d) > 0.005) (cam.tx += d * Math.min(1, dt * 3)), (moving = true);
    let oy = V[4]!;
    if (!make.hidden && V[3] && dio.project(M[0]!, 0, M[2]!, tmp)) oy = cam.oy + (makeTop - 14 - tmp[1]!);
    const e = oy - cam.oy;
    if (Math.abs(e) > 0.3) (cam.oy += e * Math.min(1, dt * 6)), (moving = true);
    return moving;
  }
  let makeTop = 0;

  function pose(dt: number) {
    mon.pose(M, engine.time, dt);
    for (let b = 0; b < NB; b++) {
      const st = run.B[b * 6]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, fs = floors[b]!, sh = run.B[b * 6 + 5]!;
      g.pos[1] = run.yOff(b);
      g.pos[0] = BLD[b * 4]! + BLD[b * 4 + 1]! / 2 + (sh ? Math.sin(engine.time * 47 + b) * 0.06 * sh : 0);
      g.rot[2] = sh ? Math.sin(engine.time * 31 + b * 2) * 0.012 * sh : 0;
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
      // The people at the windows (a point each, painted by paintFolk).
      const pts = folk[b]!;
      pts.n = w * f;
      const yo = run.yOff(b);
      for (let k = 0; k < w * f; k++) {
        const i = C0[b]! + k, fl = (k / w) | 0, col = k - fl * w;
        pts.a[k] = run.occ[i] && fl >= rem && st !== RUBBLE ? 1 : 0;
        pts.x[k] = g.pos[0]! - w / 2 + col + 0.5;
        pts.y[k] = yo + fl + (fl === 0 ? 0.25 : 0.3);
        pts.z[k] = 0.04;
        pts.r[k] = 0.26;
      }
    }
    // The helicopter.
    const HE = run.HE, he = HE[0]!;
    heli.hidden = he === 0;
    heli.pos[0] = HE[1]!; heli.pos[1] = he ? HE[2]! : -20; heli.pos[2] = HE[3]!;
    heli.rot[1] = he === 2 ? HE[9]! : HE[1]! < M[0]! ? 0.25 : Math.PI - 0.25;
    heli.rot[2] = he === 2 ? 0.5 : HE[1]! < M[0]! ? -HE[11]! - 0.08 : HE[11]! - 0.08;
    rotor.rot[1] = engine.time * (he === 2 ? 9 : 26);
    tailRotor.rot[2] = engine.time * 30;
    // Soldiers, pebbles, parachutes.
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
      pebbles.x[k] = run.PB[o + 1]!; pebbles.y[k] = run.PB[o + 2]!; pebbles.z[k] = run.PB[o + 3]!; pebbles.r[k] = run.PB[o + 7] ? 0.13 : 0.1;
    }
    chutes.n = NCH;
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      chutes.a[k] = run.CH[o]! > 0 ? 1 : 0;
      chutes.x[k] = run.CH[o + 1]!; chutes.y[k] = run.CH[o + 2]! + 0.3; chutes.z[k] = run.CH[o + 3]!; chutes.r[k] = 0.3;
    }
  }

  // ---- FX ----
  function stepFx(dt: number) {
    let any = dust.step(dt, -0.25, 0.5, 0.55, 1.2);
    for (let i = 0; i < NC; i++) if (run.crackT[i]! > 0) (run.crackT[i] = Math.max(0, run.crackT[i]! - dt)), (any = true);
    if (shard.step(dt, 16, -0.05, 1, 0.6)) any = true;
    // The falling helicopter smokes; a building going down breathes dust at its feet.
    if (run.HE[0] === 2 && rnd() < dt * 40) smoke.puff(run.HE[1]!, run.HE[2]!, run.HE[3]!, (rnd() - 0.5), 1 + rnd(), (rnd() - 0.5), 0.9, 0.22, 0.6);
    for (let b = 0; b < NB; b++) {
      const st = run.B[b * 6]!;
      if ((st === SHAKE && rnd() < dt * 10) || (st === FALL && rnd() < dt * 30)) {
        const x = BLD[b * 4]! + rnd() * BLD[b * 4 + 1]!;
        dust.puff(x, 0.2, 0.3 + rnd() * 0.6, (rnd() - 0.5) * 1.5, 0.6 + rnd() * 0.8, 0.6 + rnd(), 1.1, 0.35, 0.5);
      }
    }
    if (smoke.step(dt, -0.4, 0.45, 0.6, 1)) any = true;
    if (fx.live || fx.shake > 0) any = true;
    fx.step(dt);
    return any;
  }
  /** World (x, y, z) to the screen, into tmp; false off the camera. */
  const at = (x: number, y: number, z: number) => dio.project(x, y, z, tmp) && tmp[2]! > 0.5;

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
        const i = val | 0;
        let b = 0;
        while (C0[b + 1]! <= i) b++;
        const w = BLD[b * 4 + 1]!, r = i - C0[b]!, fl = (r / w) | 0, x = BLD[b * 4]! + (r - fl * w) + 0.5, y = run.yOff(b) + fl + 0.5;
        for (let n = 0; n < 9; n++) shard.puff(x + (rnd() - 0.5) * 0.4, y, 0.2, (rnd() - 0.5) * 4, 1 + rnd() * 3, 1 + rnd() * 2.5, 0.7, 0.07, 1);
        dust.puff(x, y, 0.3, 0, 0.3, 0.6, 0.6, 0.3, 0.45);
        if (at(x, y, 0.3)) fx.word(tmp[0]!, tmp[1]! - 10, W_CRUNCH + (wordK++ % 3), 1, 15);
        shake = Math.max(shake, 0.12);
      } else if (type === E_SHAKE) toast(`IT'S GOING!`, "meh"), say("The building shakes");
      else if (type === E_DROP) {
        if (at(BLD[val * 4]! + BLD[val * 4 + 1]! / 2, BLD[val * 4 + 2]! + 0.5, 0)) fx.word(tmp[0]!, tmp[1]!, W_TIMBER, 2, 24);
        say("Timber");
      } else if (type === E_FLOOR) {
        engine.events.emit("floor");
        const b = val | 0, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
        for (let n = 0; n < 12; n++) dust.puff(x0 - 0.3 + rnd() * (w + 0.6), 0.3, -0.2 + rnd() * 1.4, (rnd() - 0.5) * 3, 0.5 + rnd() * 1.6, 0.8 + rnd() * 1.6, 1.3 + rnd() * 0.6, 0.45, 0.55);
        shake = Math.max(shake, 0.28);
        fx.kick(3);
      } else if (type === E_FLAT) {
        engine.events.emit("flat");
        const b = val | 0, x = BLD[b * 4]! + BLD[b * 4 + 1]! / 2;
        if (at(x, 0.4, 0.5)) fx.blast(tmp[0]!, tmp[1]!, 0.8, 1), fx.word(tmp[0]!, tmp[1]! - 40, W_FLAT, 4, 26);
        dust.ring(rnd, x, 0.3, 0.4, 18, 3.4, 1.2, 1.5, 0.5, 0.6);
        shake = 0.5;
        toast(S[4] === NB ? "THE WHOLE BLOCK!" : `${S[4]} OF ${NB} FLAT`, "go");
      } else if (type === E_HELI) {
        engine.events.emit("heli");
        if (at(run.HE[1]!, run.HE[2]!, run.HE[3]!)) fx.word(tmp[0]!, tmp[1]! - 20, W_SWAT, 5, 22), fx.blast(tmp[0]!, tmp[1]!, 0.35, 4);
        toast("SWATTED!", "clean");
        say("Helicopter swatted");
      } else if (type === E_HELI_CRASH) {
        engine.events.emit("crash");
        if (at(val, 0.4, run.HE[3]!)) fx.blast(tmp[0]!, tmp[1]!, 1.1, 2), fx.word(tmp[0]!, tmp[1]! - 34, W_BLAM, 2, 24);
        dust.ring(rnd, val, 0.3, run.HE[3]!, 14, 3, 1.5, 1.1, 0.4, 0.6);
        shake = 0.45;
      } else if (type === E_NOM) {
        engine.events.emit("nom");
        mouth();
        if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) fx.word(tmp[0]!, tmp[1]! - 16, W_NOM, 5, 20);
        toast(`NOM! +${val} HP`, "clean");
        say(`Snack: plus ${val} health`);
      } else if (type === E_HURT) {
        engine.events.emit("hurt");
        if (rnd() < 0.3 && at(M[0]!, M[1]! + mon.height + 0.3, M[2]!)) fx.word(tmp[0]!, tmp[1]!, W_OOF, 3, 14);
      } else if (type === E_FLING || type === E_STOMP) {
        engine.events.emit("fling");
        const s = val | 0;
        if (at(run.SO[s * 8 + 1]!, 1, run.SO[s * 8 + 2]!)) fx.word(tmp[0]!, tmp[1]! - 12, type === E_STOMP ? W_STOMP : W_BOINK, 1, 15);
        if (type === E_STOMP) dust.ring(rnd, M[0]!, 0.2, M[2]!, 10, 2.4, 0.8, 0.7, 0.3, 0.55);
      } else if (type === E_KO) engine.events.emit("ko"), toast("KNOCKED OUT!", "bad"), say("Knocked out");
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
  /** The monster's mouth, in the world, into tmp2. */
  function mouth() {
    const f = M[6]!;
    tmp2[0] = M[0]! + f * 0.9;
    tmp2[1] = M[1]! + mon.height - 0.4;
    tmp2[2] = M[2]! + 0.3;
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
    const s = S[2]!;
    if (was[1] !== s) (was[1] = s), (scoreEl.textContent = s.toLocaleString("en-US"));
    const fl = Math.round((S[8]! / TOTAL_FLOORS) * 100);
    if (was[2] !== fl) (was[2] = fl), (flatEl.textContent = fl + "%");
    const ph = S[0]!, mk = make.hidden ? 0 : 1;
    if (was[3] !== ph * 10 + mk) {
      was[3] = ph * 10 + mk;
      thePad.el.style.visibility = mk ? "hidden" : ""; // (the customiser covers it on a phone)
      const touch = !!thePad.el.offsetParent;
      hintEl.textContent = ph === READY && !mk ? (touch ? "stick: walk and climb · ✊ punch · ↑ jump · ✋ grab a snack" : "A/D walk · W/S climb · Space punch · K jump · L grab a snack") : "";
    }
    void flatSaid;
  }
  function showEnd() {
    const won = S[4] === NB, sNow = S[2]!;
    cardH.textContent = won ? "BLOCK FLATTENED!" : "KNOCKED OUT!";
    cardT.textContent = `${sNow.toLocaleString("en-US")} pts` + (sNow >= S[10]! ? " · BEST" : ` · best ${S[10]!.toLocaleString("en-US")}`);
    cardS.textContent = `${monsterName(look.body, look.head)} · ${Math.round((S[8]! / TOTAL_FLOORS) * 100)}% flat in ${Math.round(S[1]!)} s · ${S[3]} windows · ${S[4]} of ${NB} buildings · ${S[5]} ${S[5] === 1 ? "helicopter" : "helicopters"} swatted · ${S[6]} snacks · ${S[7]} soldiers sent packing`;
    card.hidden = false;
    say(`${won ? "Block flattened" : "Knocked out"}. ${sNow} points`);
    again.focus({ preventScroll: true });
  }
  function restart() {
    const best = S[10]!;
    run.reset();
    S[10] = best;
    card.hidden = true;
    shake = toastT = 0;
    endT = -1;
    toastEl.hidden = true;
    dust.clear(), shard.clear(), smoke.clear(), fx.clear();
    was.fill(-1);
    hudDirty = dirty = true;
    pose(1);
    engine.busy(1);
    play.focus({ preventScroll: true });
  }
  // ---- the customiser ----
  function syncMake() {
    const nm = monsterName(look.body, look.head);
    mname.textContent = nm;
    nameEl.textContent = nm;
    for (const o of opts) o.setAttribute("aria-pressed", "" + (look[o.dataset.k as keyof Look] === +o.dataset.i!));
  }
  function set(k: keyof Look, v: number) {
    look[k] = v;
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
    toast(`${monsterName(look.body, look.head)} WAKES UP`, "go");
    say(`${monsterName(look.body, look.head)}: walk or punch to start`);
    engine.busy(1.7);
    play.focus({ preventScroll: true });
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
  /** The curb: a neon line at night, a light line by day; the plinth's top edge too. */
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
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.ellipse(tmp[0]!, tmp[1]!, r * 0.8, r * 0.22, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  /** The monster's shadow on the street or the roof, and the helicopter's. */
  function paintShadow(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    ctx.fillStyle = P.shadow;
    if (M[5] !== CLIMB && M[5] !== ROOF) {
      const lift = M[1]!;
      if (at(M[0]!, 0.03, M[2]!)) {
        const r = (f * 1.25) / tmp[2]!;
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
  /** The holes punched in building b's face: a jagged dark star round each, cracks round the cracked ones. */
  function paintHoles(b: number) {
    return (ctx: CanvasRenderingContext2D) => {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, rem = run.B[b * 6 + 3]!, g = groups[b]!, yo = run.yOff(b), fc = dio.focal();
      if (run.B[b * 6] === RUBBLE) return;
      for (let fl = rem; fl < f; fl++) for (let col = 0; col < w; col++) {
        const i = C0[b]! + fl * w + col, cs = run.cell[i]!;
        if (cs === INTACT) continue;
        const x = g.pos[0]! - w / 2 + col + 0.5, y = yo + fl + (fl === 0 ? 0.45 : 0.5);
        if (!at(x, y, 0.06)) continue;
        const s = fc / tmp[2]!, cx = tmp[0]!, cy = tmp[1]!, seed = (i * 7919) % 97;
        if (cs === HOLE) {
          // A jagged hole a bit bigger than the window, broken glass in its corners.
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
        } else {
          // Cracks: a few lines out of a point.
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
  /** A person at a window (waving, mouth open) or a sniper (a helmet, a slingshot up). */
  function paintFolk(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    let b = 0;
    while (folk[b] !== p) b++;
    const i = C0[b]! + k, kind = run.occ[i]!, x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!;
    if (r < 1.5) return;
    const t = engine.time * 6 + k, lw = Math.max(1, r * 0.12);
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.ink;
    // Shoulders, then the head.
    ctx.fillStyle = kind === 2 ? P.soldier : P.people[(i * 5) % 6]!;
    ctx.beginPath();
    ctx.roundRect(x - r * 0.55, y + r * 0.15, r * 1.1, r * 0.75, r * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r * 0.38, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (kind === 2) {
      ctx.fillStyle = P.helmet;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.18, r * 0.42, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      // The slingshot, up.
      ctx.beginPath();
      ctx.moveTo(x + r * 0.45, y + r * 0.2);
      ctx.lineTo(x + r * 0.7, y - r * 0.55);
      ctx.stroke();
    } else {
      // An arm waving for help, a little "o" mouth.
      ctx.beginPath();
      const wv = Math.sin(t) * r * 0.25;
      ctx.moveTo(x - r * 0.45, y + r * 0.25);
      ctx.lineTo(x - r * 0.75 + wv, y - r * 0.6);
      ctx.stroke();
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.02, r * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = P.ink;
    ctx.fillRect(x - r * 0.17, y - r * 0.2, lw, lw);
    ctx.fillRect(x + r * 0.12, y - r * 0.2, lw, lw);
  }
  /** A soldier on the street: legs, a body, a helmet; walking, or winding up a throw. */
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
    // The throwing arm: back when winding up.
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
  /** A parachute (a striped canopy, the strings, a little grumpy person), or a person running off. */
  function paintChute(ctx: CanvasRenderingContext2D, k: number, p: DioramaPoints) {
    const x = p.sx[k]!, y = p.sy[k]!, r = p.sr[k]!, o = k * 9, landed = run.CH[o + 7]!, kind = run.CH[o + 6]!, t = run.CH[o + 8]!;
    if (r < 1.5) return;
    const lw = Math.max(1, r * 0.11), sway = landed ? 0 : Math.sin(t * 2.2 + k) * 0.18;
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.ink;
    const by = landed ? y + r * 0.2 : y + r * 0.9;
    if (!landed) {
      // The canopy opens over a quarter second.
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
    // The little person: a body, a head, a sad face (or running legs once down).
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
    // A frown.
    ctx.beginPath();
    ctx.arc(x, by - r * 0.47, r * 0.1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (fx.live) fx.draw(ctx, !P.night);
    // The grab: a "nom" puff by the mouth.
    if (M[18]! > 0) {
      mouth();
      if (at(tmp2[0]!, tmp2[1]!, tmp2[2]!)) {
        const k = M[18]! / 0.6, r = (dio.focal() * (0.3 + (1 - k) * 0.5)) / tmp[2]!;
        ctx.globalAlpha = k * 0.8;
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

  // ---- the loop ----
  const GP = new Float64Array(6);
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
      if (auto) run.autopilot(I);
      else {
        const stick = c.stick.active;
        I[0] = GP[0]! || (stick ? c.stick.x : c.axis("left", "right"));
        I[1] = -GP[1]! || (stick ? -c.stick.y : c.axis("down", "up"));
        I[2] = c.hit(PUNCH) || GP[2]! ? 1 : 0;
        I[3] = c.hit(JUMP) || GP[3]! ? 1 : 0;
        I[4] = c.hit(GRAB) || GP[4]! ? 1 : 0;
        GP[2] = GP[3] = GP[4] = 0;
      }
      if (!card.hidden || !make.hidden) I[0] = I[1] = I[2] = I[3] = I[4] = 0;
      let moving = run.step(dt, I[0]!, I[1]!, I[2]!, I[3]!, I[4]!);
      if (run.n) events(), (moving = true);
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (shake > 0) (shake = Math.max(0, shake - dt)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (S[0] === RUN) moving = true;
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
      lastDt = dt;
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose(lastDt);
      const cam = dio.cam, k = (shake * shake * 14) + fx.shake * 0.5, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      dio.draw();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });
  let lastDt = 1 / 60;
  // The gamepad: the left stick moves and climbs; A jumps, X or RT punches, B or Y grabs (on the press).
  const GB = new Uint8Array(3);
  function gamepadRead() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    GP[0] = GP[1] = 0;
    if (!pads) return;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      const ax = p.axes, bt = p.buttons, v = (k: number) => (bt[k] && bt[k]!.pressed ? 1 : 0);
      const dz = (a: number) => (a > 0.2 ? (a - 0.2) / 0.8 : a < -0.2 ? (a + 0.2) / 0.8 : 0);
      GP[0] = dz(ax[0] ?? 0) || v(15) - v(14);
      GP[1] = dz(ax[1] ?? 0) || v(13) - v(12);
      const now0 = v(2) || v(7), now1 = v(0), now2 = v(1) || v(3);
      if (now0 && !GB[0]) GP[2] = 1;
      if (now1 && !GB[1]) GP[3] = 1;
      if (now2 && !GB[2]) GP[4] = 1;
      GB[0] = now0; GB[1] = now1; GB[2] = now2;
      if (GP[0] || GP[1] || now0 || now1 || now2) auto = false, engine.wake();
      return;
    }
  }

  // ---- input: keys on the stage, a tap on the street punches, the stickers and the customiser ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "punch", KeyJ: "punch", KeyK: "jump", KeyL: "grab" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!make.hidden) {
      if (e.code === "Enter" && !(e.target as Element).closest?.("button")) return void (e.preventDefault(), closeMake());
      return;
    }
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "KeyR") return void (e.preventDefault(), restart());
    if (e.code === "KeyC") return void (e.preventDefault(), openMake());
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad")) return;
    if ((e.target as Element).closest?.(".kj-card") && (e.code === "Space" || e.code === "Enter")) return;
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
    if (!card.hidden || !make.hidden) return;
    auto = false;
    c.press("punch");
    c.press("punch", false);
    engine.wake();
  }, sig);
  muteK.addEventListener("click", toggle, sig);
  makeK.addEventListener("click", openMake, sig);
  again.addEventListener("click", () => restart(), sig);
  change.addEventListener("click", openMake, sig);
  go.addEventListener("click", closeMake, sig);
  rand.addEventListener("click", () => {
    look.body = (rnd() * 3) | 0; look.head = (rnd() * 4) | 0; look.main = (rnd() * 6) | 0; look.accent = (look.main + 1 + ((rnd() * 5) | 0)) % 6; look.pattern = (rnd() * 3) | 0;
    set("body", look.body);
  }, sig);
  for (const o of opts) o.addEventListener("click", () => set(o.dataset.k as keyof Look, +o.dataset.i!), sig);
  // On a phone the customiser shows one part at a time: the tabs pick it.
  for (const t of tabs) t.addEventListener("click", () => {
    make.dataset.tab = t.dataset.tab!;
    for (const u of tabs) u.setAttribute("aria-pressed", "" + (u === t));
  }, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  // The poster (scripts/gallery-posters.mjs): the monster up the tall building's face, punching, the helicopter in.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    make.hidden = true;
    look.body = 0; look.head = 0; look.main = 0; look.accent = 5; look.pattern = 2;
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
      return { phase: S[0]!, mode: M[5]!, hp: M[7]!, score: S[2]!, flat: Math.round((S[8]! / TOTAL_FLOORS) * 100), holes: S[3]!, helis: S[5]!, snacks: S[6]!, making: !make.hidden, card: !card.hidden, name: monsterName(look.body, look.head), x: M[0]!, y: M[1]! };
    },
    run,
    look,
    set,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the monster up the tall building, the helicopter it just swatted going up in the street (scripts/gallery-posters.mjs). */
export const posterAt = 9;
void [STAND, WALK, KO, DONE, RUN, NEED, MAX_HP, E_PUNCH];
