// "Mirror Maze" (hero): five little laser puzzles on a tabletop diorama. A tray on a table holds a
// grid: a laser emitter, stone posts that stop the light, two to four mirrors you turn (tap one, or
// pick it with the arrows and press Space: it turns 45°) and, on the later boards, a fixed glass
// splitter that sends the light two ways. Light every crystal (each one chimes as the beam reaches
// it) to clear the board; the next one slides in. Every board has a par, the fewest turns that solve
// it; the moves counter keeps score. Dark is a neon night; light a pastel afternoon.
// Bricks: the kernel (fixed step, settle, its ledger for every page write: Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D), @fzlt/core/beam (the light: reflection,
// splitting, hits; `dioramaBeam` draws it with the pulse and the sparks), @fzlt/core/slot,
// @fzlt/core/sound. The puzzles are ./model.ts, pure (tests/mirror-maze.test.mjs proves each one
// solvable at its par); this file is the scene and the controls (tests/mirror-maze.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaObjectDef } from "../../../../src/diorama";
import { dioramaBeam, TARGET, type DioramaBeam } from "../../../../src/beam";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { CELL, LEVELS, PARS, counts, load, newBoard, setLook, solved, turn, type Board } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180, Q = Math.PI / 4;
// Palettes by role: a pastel afternoon (light) and a neon night (dark).
const LIGHT = {
  bg: "#eee8e0", floor: "#dcd4cb", wallB: "#f1dfd4", wallR: "#d4e3e3", base: "#c99d72", top: "#e6c49a",
  tray: "#f6f0e6", rim: "#e9dccb", tile0: "#d9e4ee", tile1: "#cbd9e6",
  emit: "#4b5368", emit2: "#6c7590", lens: "#ff8a6b", stone: "#b9b3c4", stone2: "#d2cddb",
  base0: "#ffd36b", base1: "#c9c2d6", post: "#7c7790", glass: "#f3fbff", frame: "#8a86a0", split: "#bfe9ff",
  crystal: "#bfaee8", crystalOn: "#fff1a8", cup: "#a99be0",
  mug: "#f08e6f", tea: "#9c6a45", book: "#7fcfa8", book2: "#f2c96b", pot: "#e39a74", leaf: "#8fcf9b", leaf2: "#b0dfa8",
  shadow: "#3a2d3c", beam: "#ff4b3e", core: "#fff4ea", spark: "#ffd36b", sel: "#ffd36b", light: [0.5, 1, 0.45], amb: 0.54, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#10132a", floor: "#23284a", wallB: "#2a2f55", wallR: "#21384c", base: "#6a4d3d", top: "#84644b",
  tray: "#252a4c", rim: "#323862", tile0: "#1d2346", tile1: "#232a52",
  emit: "#3b4262", emit2: "#545d86", lens: "#ff3fa4", stone: "#575c80", stone2: "#6b7198",
  base0: "#ffcf4a", base1: "#4b507a", post: "#8d92b8", glass: "#d9f4ff", frame: "#9aa0c8", split: "#7fe0ff",
  crystal: "#6a5aa8", crystalOn: "#7ffcff", cup: "#4f4690",
  mug: "#c95a4e", tea: "#6b4a33", book: "#3fa08a", book2: "#c9a14a", pot: "#a8644c", leaf: "#3f8f6a", leaf2: "#57a77d",
  shadow: "#000000", beam: "#ff3fa4", core: "#fff0fb", spark: "#7ffcff", sel: "#ffd36b", light: [0.38, 1, 0.55], amb: 0.44, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night">;

// The table top (TT), the tray's height (TH) and lip, the slide's distance.
const TT = 1.24, TH = 0.4, SLIDE = 26;
// Phases: playing, cleared (a beat to enjoy it), sliding out, sliding in, all done.
const P_PLAY = 0, P_CLEAR = 1, P_OUT = 2, P_IN = 3, P_DONE = 4;

export type MazeScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly bd: Board;
  readonly state: { level: number; phase: number; moves: number; total: number; sel: number; lit: number; card: boolean };
  /** Mirror i's screen point (CSS px from the stage's top left), as of the last draw. */
  mirrorScreen(i: number): [number, number];
  /** Go to board l (tests). */
  goto(l: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): MazeScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: canvas, a key over it, stickers, end card, keys ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "mm-play";
  play.setAttribute("aria-label", "Mirror Maze: the arrows pick a mirror, Space or Enter turns it 45 degrees, R resets the board, M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "mm-hud";
  hud.innerHTML = `<div class="mm-head"><p class="mm-top"><b class="mm-chip mm-lvl">Board 1/5</b><b class="mm-chip mm-n">Moves <span>0</span> · Par <span>1</span></b></p><p class="mm-hint"></p></div><p class="mm-live" aria-live="polite"></p><div class="mm-card" role="dialog" aria-label="Maze cleared" hidden><b>Maze cleared</b><p></p><p class="mm-stats"></p><button type="button" class="bui-key mm-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const lvlEl = top.children[0] as HTMLElement, nums = top.children[1]!.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { turn: "tick", chime0: "c0", chime1: "c1", chime2: "c2", clear: "win", slide: "whoosh", reset: "click", done: "win" },
    notes: {
      tick: [[1400, 900, 0.03, 0, "triangle", 0.09], [500, 420, 0.05, 0.02, "square", 0.03]],
      c0: [[1047, 1047, 0.35, 0, "sine", 0.16], [2093, 2093, 0.25, 0, "sine", 0.05]],
      c1: [[1319, 1319, 0.35, 0, "sine", 0.16], [2637, 2637, 0.25, 0, "sine", 0.05]],
      c2: [[1568, 1568, 0.4, 0, "sine", 0.16], [3136, 3136, 0.25, 0, "sine", 0.05]],
      whoosh: [[300, 900, 0.35, 0, "triangle", 0.05]],
    },
    volume: 0.1,
  });
  const K_MUTE = 0, K_RESET = 1;
  const [muteK, resetK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "RESET", aria: "Reset the board (R)", id: K_RESET },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else resetBoard();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
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
  let bd: Board = newBoard(), db: DioramaBeam, level = 0, phase = P_PLAY, T = 0, tB = 0, sel = 0, total = 0, kbd = false, hover = -1;
  // Per mirror: its group (turned), the angle drawn, the angle it turns to.
  const mir: DioramaObject[] = [], ang = new Float64Array(8), goalA = new Float64Array(8), crys: DioramaObject[] = [], crysPart = new Int16Array(8);
  let tray: DioramaObject | null = null;
  const glow = new Float64Array(8); // per crystal: the lit glow, 0..1

  /** Board point (col, row) of level l's grid: the cell's centre, tray coordinates. */
  const cx = (c: number) => (c + 0.5 - LEVELS[level]!.w / 2) * CELL, cz = (r: number) => (r + 0.5 - LEVELS[level]!.h / 2) * CELL;
  function buildScene() {
    const Lv = LEVELS[level]!, gw = Lv.w * CELL, gh = Lv.h * CELL;
    dio.clear();
    keyed.length = keyName.length = mir.length = crys.length = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    dio.cluster("tray", { fixed: 2 });
    put({ id: "floor", size: [44, 0.5, 32], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [44.6, 12, 0.5], pos: [0, -0.5, -16.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "wallR", size: [0.5, 12, 32], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3, pick: false });
    put({ id: "plinth", size: [24, TT - 0.14, 15], on: "floor", color: "base", cluster: "table", layer: 0, shadow: 0.2, pick: false });
    put({ id: "top", size: [24.6, 0.14, 15.6], on: "plinth", color: "top", layer: 0.4, pick: false });
    // Things on the table, left and right of the tray: a mug, a stack of books, a plant.
    put({ id: "mug", shape: "cyl", sides: 14, size: [1.2, 1.3, 1.2], on: "top", pos: [-10.3, 0, -4.8], color: "mug", layer: 1, shadow: 0.25, pick: false });
    put({ shape: "cyl", sides: 14, size: [1, 0.02, 1], on: "mug", pos: [0, -0.13, 0], color: "tea", layer: 1.1, pick: false });
    put({ id: "bk0", size: [2.4, 0.4, 3.2], on: "top", pos: [10.3, 0, 4.4], rot: [0, 0.2, 0], color: "book", layer: 1, shadow: 0.2, pick: false });
    put({ id: "bk1", size: [2.2, 0.36, 3], on: "bk0", rot: [0, -0.3, 0], color: "book2", layer: 1.1, pick: false });
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.2, size: [1.4, 1.2, 1.4], on: "top", pos: [10.4, 0, -5], color: "pot", layer: 1, shadow: 0.2, pick: false });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.45, size: [2.2, 1.5, 2.2], on: "pot", color: "leaf", layer: 1.1, pick: false });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [1.6, 1.4, 1.6], on: "leaf", color: "leaf2", layer: 1.2, pick: false });
    // The tray (it slides between boards), its lip, the grid's tiles.
    tray = put({ id: "tray", size: [gw + 1.2, TH, gh + 1.2], on: "top", color: "tray", cluster: "tray", layer: 0, shadow: 0.25, pick: false });
    put({ id: "felt", shape: "group", size: [gw, 0, gh], on: "tray", layer: 1, pick: false });
    const lip = (x: number, z: number, w: number, d: number) => put({ size: [w, 0.28, d], on: "tray", pos: [x, 0, z], color: "rim", layer: 1, pick: false });
    lip(0, -(gh + 0.9) / 2, gw + 1.2, 0.3), lip(0, (gh + 0.9) / 2, gw + 1.2, 0.3), lip(-(gw + 0.9) / 2, 0, 0.3, gh + 0.6), lip((gw + 0.9) / 2, 0, 0.3, gh + 0.6);
    for (let r = 0; r < Lv.h; r++) for (let c = 0; c < Lv.w; c++) put({ size: [CELL - 0.08, 0.04, CELL - 0.08], on: "tray", pos: [cx(c), 0, cz(r)], color: (r + c) & 1 ? "tile1" : "tile0", layer: 0.5, pick: false });
    const b = bd.b;
    for (let i = 0; i < b.parts; i++) {
      const kd = b.kind[i]!, x = b.x[i]!, z = b.z[i]!, tag = b.tag[i];
      if (tag === "emit") {
        put({ id: "emit", shape: "group", size: [1.1, 0, 1.1], on: "felt", pos: [x, 0, z], rot: [0, -b.a[i]!, 0], shadow: 0.35, layer: 5, pick: false });
        put({ id: "emB", size: [1.0, 0.62, 0.9], on: "emit", pos: [-0.12, 0, 0], color: "emit", layer: 5, pick: false });
        put({ id: "emT", size: [0.8, 0.12, 0.7], on: "emB", color: "emit2", layer: 5, pick: false });
        put({ id: "emG", size: [0.5, 0.26, 0.3], on: "emit", pos: [0.5, 0.3, 0], color: "emit2", layer: 5, pick: false });
        put({ size: [0.08, 0.2, 0.22], on: "emit", pos: [0.78, 0.33, 0], color: "lens", emissive: true, layer: 5, pick: false });
      } else if (tag === "block") {
        const id = "blk" + i;
        put({ id, shape: "cyl", sides: 8, top: 0.88, size: [1.08, 1.0, 1.08], on: "felt", pos: [x, 0, z], color: "stone", shadow: 0.3, layer: 5, pick: false });
        put({ shape: "cyl", sides: 8, size: [1.18, 0.16, 1.18], on: id, color: "stone2", layer: 5, pick: false });
      } else if (kd === TARGET) {
        const id = "cr" + i;
        put({ id: id + "c", shape: "cyl", sides: 10, top: 0.8, size: [0.9, 0.22, 0.9], on: "felt", pos: [x, 0, z], color: "cup", shadow: 0.3, layer: 5, pick: false });
        const cr = put({ id, shape: "cyl", sides: 6, top: 0.7, size: [0.62, 0.6, 0.62], on: id + "c", color: "crystal", layer: 5, pick: false });
        put({ shape: "cyl", sides: 6, top: 0, size: [0.44, 0.5, 0.44], on: id, color: "crystal", layer: 5, pick: false });
        crysPart[crys.length] = i;
        crys.push(cr);
      } else {
        // A mirror (turnable: a gold base you can tap) or a splitter (fixed: a glass pane on grey).
        const turnable = typeof tag === "number", id = "m" + i;
        const g = put({ id, shape: "group", size: [1.2, 0, 1.2], on: "felt", pos: [x, 0, z], rot: [0, -b.a[i]!, 0], shadow: 0.3, tag: turnable ? { m: tag } : null, layer: 5, pick: turnable });
        put({ id: id + "b", shape: "cyl", sides: 12, top: 0.86, size: [1.16, 0.18, 1.16], on: id, color: turnable ? "base0" : "base1", layer: 5, pick: turnable });
        if (turnable) {
          put({ id: id + "f", size: [1.3, 1.02, 0.16], on: id + "b", color: "frame", layer: 5 });
          put({ size: [1.18, 0.86, 0.18], on: id + "b", pos: [0, 0.08, 0], color: "glass", layer: 5 });
        } else {
          // The splitter: a clear pane on two little clamps.
          for (const x of [-0.5, 0.5]) put({ size: [0.16, 0.22, 0.26], on: id + "b", pos: [x, 0, 0], color: "frame", layer: 5, pick: false });
          put({ size: [1.22, 0.94, 0.08], on: id + "b", color: "split", alpha: 0.55, layer: 5, pick: false });
        }
        if (turnable) (mir[tag as number] = g), (ang[tag as number] = goalA[tag as number] = -b.a[i]!);
      }
    }
    db = dioramaBeam(dio, b, { on: "felt", y: 0.55, cluster: "tray", layer: 5, color: P.beam, core: P.core, spark: P.spark, width: 0.13, piece: 0.8, motion: !RM, light: lightCrystal });
    tB = 0;
    glow.fill(0);
    hudDirty = dirty = true;
  }
  function lightCrystal(part: number, on: boolean) {
    for (let k = 0; k < crys.length; k++)
      if (crysPart[k] === part) {
        crys[k]!.tint = on ? P.crystalOn : null;
        crys[k]!.emissive = on;
        if (on && phase === P_PLAY) cue("chime" + Math.min(2, k)), say(`Crystal ${k + 1} lit.`);
      }
  }

  // ---- state and flow ----
  let hudDirty = true, dirty = true, toastT = 0, toastK = 0, toastS = "", said = "";
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3), W3 = new Float64Array(3);
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const cue = (t: string) => engine.events.emit(t);
  function goto(l: number) {
    level = l;
    load(l, bd);
    sel = 0;
    phase = P_PLAY;
    buildScene();
    setView(true);
    toast(`BOARD ${l + 1} · ${LEVELS[l]!.name.toUpperCase()}`, 0);
    say(`Board ${l + 1} of ${LEVELS.length}: ${LEVELS[l]!.name}. Par ${PARS[l]}.`);
    engine.wake();
  }
  function restart() {
    total = 0;
    card.hidden = true;
    goto(0);
  }
  function turnMirror(i: number) {
    if (phase !== P_PLAY || i < 0 || i >= counts(level)[0]) return;
    sel = i;
    turn(bd, i);
    goalA[i] = goalA[i]! - Q;
    cue("turn");
    hudDirty = dirty = true;
    if (solved(bd)) (phase = P_CLEAR), (T = 0), engine.busy(2);
    engine.wake();
  }
  function resetBoard() {
    if (phase !== P_PLAY) return;
    const Lv = LEVELS[level]!;
    for (let i = 0; i < Lv.mirror.length; i++) {
      // Turn back the short way to the starting look.
      const want = Lv.mirror[i]![2], k = bd.look[i]!, back = (k - want + 4) & 3;
      goalA[i] = goalA[i]! + back * Q;
      setLook(bd, i, want);
    }
    bd.moves = 0;
    cue("reset");
    say("Board reset.");
    hudDirty = dirty = true;
    engine.wake();
  }
  /** The board is lit: score it, then slide the next one in (or show the card after the last). */
  function cleared() {
    const p = PARS[level]!, mv = bd.moves;
    total += mv;
    cue("clear");
    toast(mv <= p ? `CLEAR · PAR ${p}!` : `CLEAR · ${mv - p} OVER PAR`, 1);
    say(`Board cleared in ${mv} moves; par ${p}.`);
  }
  function showEnd() {
    const par = PARS.reduce((a, b) => a + b, 0);
    (card.children[1] as HTMLElement).textContent = total <= par ? "Every board at par. Spotless." : "All five boards lit.";
    (card.children[2] as HTMLElement).textContent = `Moves ${total} · Par ${par}`;
    card.hidden = false;
    phase = P_DONE;
    cue("done");
    say(`Maze cleared: ${total} moves, par ${par}.`);
    hudDirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 };
  let limits = { yaw: [-2, 2], pitch: [30 * D, 75 * D], dist: [5, 200] }, user = false;
  const portrait = () => dio.width / dio.height < 1.05;
  function setView(snap: boolean) {
    const port = portrait(), g = goal, W = dio.width, H = dio.height, Lv = LEVELS[level]!, hw = (Lv.w * CELL) / 2 + 0.8, hh = (Lv.h * CELL) / 2 + 0.8, y = TT + TH;
    (g.yaw = (port ? -90 : -12) * D), (g.pitch = (port ? 62 : 54) * D), (g.tx = 0), (g.ty = y), (g.tz = port ? 0 : 0.5), (g.fov = 0.6);
    const pts = [-hw, y, -hh, hw, y, -hh, -hw, TT, hh, hw, TT, hh, -hw, y + 1.4, -hh, hw, y + 1.4, -hh];
    dio.fit(g, pts, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    limits = { yaw: [g.yaw - 45 * D, g.yaw + 45 * D], pitch: [32 * D, 80 * D], dist: [g.dist * 0.7, g.dist * 1.4] };
    if (snap || RM) Object.assign(dio.cam, g), (user = false);
    dirty = true;
    engine.wake();
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  function stepCam(dt: number) {
    if (user) return false;
    const c = dio.cam, k = 1 - Math.exp(-dt * 4);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const f = CAMF[i]!;
      c[f] += (goal[f] - c[f]) * k;
      d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 30 : i < 2 ? 0.03 : 0.6));
    }
    if (d < 0.01) {
      for (let i = 0; i < 8; i++) c[CAMF[i]!] = goal[CAMF[i]!];
      return false;
    }
    return true;
  }

  // ---- the frame ----
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          // The beam's colours are set when it is built: build the board again, as it stands.
          const keep = tray ? tray.pos[0]! : 0, a = ang.slice(), g = goalA.slice();
          buildScene();
          tray!.pos[0] = keep;
          ang.set(a), goalA.set(g);
          for (let i = 0; i < mir.length; i++) mir[i]!.rot[1] = ang[i]!;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = resetK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(!V[5]);
      }
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y);
      }
    },
    step(e, dt) {
      let moving = false;
      tB += dt;
      // Mirrors turn to their new look.
      for (let i = 0; i < mir.length; i++) {
        const a = ang[i]!, g = goalA[i]!;
        if (a !== g) (ang[i] = Math.abs(g - a) < 0.002 || RM ? g : a + (g - a) * Math.min(1, dt * 16)), (mir[i]!.rot[1] = ang[i]!), (moving = true);
      }
      if (phase === P_CLEAR) {
        const t0 = T;
        T += dt;
        if (t0 < 0.45 && T >= 0.45) cleared();
        if (T >= 2.1) (phase = level + 1 < LEVELS.length ? P_OUT : P_DONE), (T = 0), phase === P_DONE ? showEnd() : (cue("slide"), engine.busy(1.4));
        moving = true;
      } else if (phase === P_OUT) {
        T += dt;
        const u = Math.min(1, T / 0.6);
        tray!.pos[0] = -SLIDE * u * u;
        if (u >= 1) (level = level + 1), load(level, bd), (sel = 0), buildScene(), setView(false), (tray!.pos[0] = SLIDE), (phase = P_IN), (T = 0);
        moving = true;
      } else if (phase === P_IN) {
        T += dt;
        const u = Math.min(1, T / 0.7), e = 1 - (1 - u) ** 3;
        tray!.pos[0] = SLIDE * (1 - e);
        if (u >= 1) {
          tray!.pos[0] = 0;
          phase = P_PLAY;
          toast(`BOARD ${level + 1} · ${LEVELS[level]!.name.toUpperCase()}`, 0);
          say(`Board ${level + 1} of ${LEVELS.length}: ${LEVELS[level]!.name}. Par ${PARS[level]}.`);
        }
        moving = true;
      }
      // The crystals' glow follows the drawn beam.
      for (let k = 0; k < crys.length; k++) {
        const want = db.on[crysPart[k]!] ? 1 : 0, g = glow[k]!;
        if (g !== want) (glow[k] = Math.abs(want - g) < 0.01 ? want : g + (want - g) * Math.min(1, dt * 6)), (moving = true);
      }
      if (db.show(tB)) moving = true;
      if (stepCam(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) {
        dirty = false;
        dio.draw();
        V[5] = 1;
      }
    },
  });

  // ---- overlay: the glow of lit crystals, the selection ring, the toast ----
  const WIDTHS = new Map<string, number>();
  const font = (px: number) => `800 ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;
  const width = (ctx: CanvasRenderingContext2D, text: string, px: number) => {
    const k = text + px;
    let w = WIDTHS.get(k);
    if (w === undefined) WIDTHS.set(k, (w = ctx.measureText(text).width));
    return w;
  };
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
  /** The tray point (x, z) at height y, in the world (the tray slides along x). */
  const wx = (x: number) => x + (tray ? tray.pos[0]! : 0), TY = TT + TH;
  function ringAt(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, col: string, w: number) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      dio.project(wx(x) + Math.cos(a) * r, TY + 0.06, z + Math.sin(a) * r, tmp2);
      i ? ctx.lineTo(tmp2[0]!, tmp2[1]!) : ctx.moveTo(tmp2[0]!, tmp2[1]!);
    }
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = w + 3;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  const TOAST = ["#fffaf1", "#ffd36b"];
  const TOAST_T = 1.6;
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const b = bd.b, f = dio.focal();
    // Lit crystals: a soft halo (stronger at night).
    for (let k = 0; k < crys.length; k++) {
      const g = glow[k]!, p = crysPart[k]!;
      if (g <= 0.01 || !dio.project(wx(b.x[p]!), TY + 0.75, b.z[p]!, tmp)) continue;
      const r = (1.1 * f) / tmp[2]!;
      ctx.fillStyle = P.crystalOn;
      for (let i = 3; i > 0; i--) (ctx.globalAlpha = g * (P.night ? 0.12 : 0.09) * (4 - i)), ctx.beginPath(), ctx.arc(tmp[0]!, tmp[1]!, r * i * 0.55, 0, TAU), ctx.fill();
      ctx.globalAlpha = 1;
    }
    // The keyboard's (or the pointer's) mirror.
    const s = kbd ? sel : hover;
    if (phase === P_PLAY && s >= 0 && s < mir.length) ringAt(ctx, b.x[bd.mirrors[s]!]!, b.z[bd.mirrors[s]!]!, CELL * 0.47, P.sel, 3);
    if (toastT > 0) {
      const u = 1 - toastT / TOAST_T, sc = u < 0.12 ? 0.6 + (u / 0.12) * 0.48 : u < 0.2 ? 1.08 - ((u - 0.12) / 0.08) * 0.08 : 1;
      const px = Math.round(Math.max(16, Math.min(26, dio.width / 30)));
      ctx.save();
      ctx.globalAlpha = u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1;
      ctx.translate(dio.width / 2, V[3]! + 22 + px / 2);
      ctx.scale(sc, sc);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, "#1f2433");
      ctx.restore();
    }
  }
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = RM ? 1 : TOAST_T);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the HUD ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const l = `Board ${level + 1}/${LEVELS.length}`;
    if (set(0, l)) lvlEl.textContent = l;
    if (set(1, bd.moves)) nums[0]!.textContent = "" + bd.moves;
    if (set(2, PARS[level]!)) nums[1]!.textContent = "" + PARS[level];
    const over = bd.moves > PARS[level]! && phase === P_PLAY;
    if (set(3, over)) top.children[1]!.classList.toggle("mm-over", over);
    const hint = phase !== P_PLAY ? "" : `${coarse ? "Tap" : "Click"} a gold mirror to turn it. Light every crystal.`;
    if (set(4, hint)) hintEl.textContent = hint;
    if (set(5, said)) live.textContent = said;
    if (set(6, phase === P_PLAY)) resetK!.disabled = phase !== P_PLAY;
  }

  // ---- input: a tap turns a mirror, a drag orbits, keys pick and turn ----
  const ptrs = new Map<number, Float64Array>();
  let downX = 0, downY = 0, dragging = false;
  /** The turnable mirror under (x, y): picked, or the nearest within reach. */
  function mirrorAt(x: number, y: number) {
    const ob = dio.root(dio.pick(x, y)), tag = ob?.tag as { m?: number } | null | undefined;
    if (tag && tag.m !== undefined) return tag.m;
    let best = -1, bdist = coarse ? 40 : 26;
    for (let i = 0; i < mir.length; i++) {
      const p = bd.mirrors[i]!;
      dio.project(wx(bd.b.x[p]!), TY + 0.5, bd.b.z[p]!, tmp);
      const d = Math.hypot(tmp[0]! - x, tmp[1]! - y);
      if (d < bdist) (bdist = d), (best = i);
    }
    return best;
  }
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, Float64Array.of(e.offsetX, e.offsetY));
    if (ptrs.size === 1) (downX = e.offsetX), (downY = e.offsetY), (dragging = false);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    const x = e.offsetX, y = e.offsetY, p = ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === "mouse") {
        const h = phase === P_PLAY ? mirrorAt(x, y) : -1;
        if (h !== hover || kbd) (hover = h), (kbd = false), play.classList.toggle("mm-aim", h >= 0), (dirty = true), engine.wake();
      }
      return;
    }
    if (!dragging && Math.hypot(x - downX, y - downY) > 8) (dragging = true), play.classList.add("mm-drag");
    if (dragging) {
      const c = dio.cam;
      (c.yaw -= (x - p[0]!) * 0.006), (c.pitch += (y - p[1]!) * 0.005), dio.clamp(limits), (user = true), (dirty = true), engine.wake();
    }
    (p[0] = x), (p[1] = y);
  }, sig);
  const end = (e: PointerEvent) => {
    const had = ptrs.delete(e.pointerId);
    play.classList.remove("mm-drag");
    if (!had) return;
    if (!dragging && !ptrs.size && e.type === "pointerup") tap(e.offsetX, e.offsetY);
    if (!ptrs.size) dragging = false;
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  play.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hover >= 0 && ((hover = -1), (dirty = true), engine.wake()), sig);
  function tap(x: number, y: number) {
    if (phase !== P_PLAY) return;
    const i = mirrorAt(x, y);
    if (i >= 0) (kbd = false), turnMirror(i);
  }
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "r") return void (e.preventDefault(), resetBoard());
    const n = mir.length, mv = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (mv && phase === P_PLAY && n) {
      e.preventDefault();
      sel = kbd ? (sel + mv + n) % n : sel;
      kbd = true;
      dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey && phase === P_PLAY) {
      e.preventDefault();
      kbd = true;
      turnMirror(sel);
    }
  }, sig);
  again.addEventListener("click", () => (restart(), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): board 5 half solved, the beam split and one crystal lit.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    goto(4);
    toastT = 0;
    setLook(bd, 0, 3);
    setLook(bd, 1, 0);
    for (let i = 0; i < 2; i++) goalA[i] = ang[i] = -bd.look[i]! * Q;
  }

  restart();
  engine.start();
  return {
    engine,
    accessible: true,
    get bd() {
      return bd;
    },
    get state() {
      return { level, phase, moves: bd.moves, total, sel, lit: db.lit, card: !card.hidden };
    },
    mirrorScreen(i: number) {
      const p = bd.mirrors[i]!;
      dio.project(wx(bd.b.x[p]!), TY + 0.5, bd.b.z[p]!, W3);
      return [W3[0]!, W3[1]!];
    },
    goto,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the last board, half solved (scripts/gallery-posters.mjs). */
export const posterAt = 1.2;
