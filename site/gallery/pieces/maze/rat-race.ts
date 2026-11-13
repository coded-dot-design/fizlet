// "Rat Race" (hero): a top-down cardboard maze on a tabletop diorama, your mouse against a rival
// mouse to the cheese in the middle. Every round is a new seeded maze (a perfect maze, so always
// solvable, with a few loops), and two red doors on two of the loops swap every few seconds: one
// opens as the other shuts, and a door that shuts in a mouse's face bonks it back. Steer with the
// arrows (hold one: the mouse runs that way and turns at the next opening), swipe, or tap a room and
// your mouse finds its own way there. The rival knows where the cheese is but not the maze: it stops
// to sniff at forks and now and then follows its nose into a dead end. First to two cheeses wins.
// Dark is a neon night; light a pastel afternoon.
// Bricks: the kernel (fixed step, settle, its ledger for every page write: Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D, the crumbs and the bonk stars as points, the
// tails as decals), @fzlt/core/grid (the maze's board and every A*), @fzlt/core/slot,
// @fzlt/core/sound. The race is ./rat.ts on ./carve.ts, pure (tests/rat-race.test.mjs: every maze
// solvable from both corners with the doors either way, the rival always gets there, zero
// allocation); this file is the scene and the controls (tests/rat-race.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { BLOCKED } from "../../../../src/grid";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { isRoom } from "./carve";
import { CH, CW, EV_BONK0, EV_BONK1, EV_SNIFF, EV_SWAP, EV_WON, RACING, READY, RIV, RS, WON, WT, YOU, go, hold, load, newRace, pos, roomAt, span, step, tapTo, where, type Race } from "./rat";

const TAU = 6.283185307179586, D = Math.PI / 180;
// Palettes by role: a pastel afternoon (light) and a neon night (dark).
const LIGHT = {
  bg: "#ece6dc", floor: "#dcd3c6", wallB: "#efe0d0", wallR: "#d6e2dc", base: "#9fb7c9", top: "#c9dbe6",
  tray: "#c99a6b", felt: "#ead9bf", wall: "#d2a473", wallTop: "#f0d2a8", door: "#ff8a6b", doorTop: "#ffb59a",
  cheese: "#ffd36b", cheese2: "#ffe7a3", hole: "#d9a93a",
  you: "#cfd3dd", you2: "#a9aebd", youBib: "#5fd3a8", riv: "#c88a5f", riv2: "#a86e48", rivBib: "#ff8a6b",
  pink: "#ff9fb0", eye: "#1f2433", tail: "#e6a0a8", star: "#ffd36b", crumb: "#ffd36b", flag: "#5fd3a8",
  lamp: "#f6efe2", lamp2: "#ff8a6b", box: "#d9b48a", box2: "#c49766",
  shadow: "#3a2d3c", light: [0.35, 1, 0.45], amb: 0.58, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#0f1229", floor: "#22274a", wallB: "#292e55", wallR: "#20364a", base: "#2b3160", top: "#373e72",
  tray: "#3a2f52", felt: "#1d2144", wall: "#3e3566", wallTop: "#7ffcff", door: "#ff3fa4", doorTop: "#ff8ad0",
  cheese: "#ffcf4a", cheese2: "#ffe28a", hole: "#b88a1e",
  you: "#c9cde0", you2: "#8d92b8", youBib: "#7ffcff", riv: "#c07a52", riv2: "#94573a", rivBib: "#ff3fa4",
  pink: "#ff8fb0", eye: "#0b0d1c", tail: "#ff8fb0", star: "#7ffcff", crumb: "#ffcf4a", flag: "#7ffcff",
  lamp: "#3b4377", lamp2: "#ff3fa4", box: "#4b3f6e", box2: "#3b315a",
  shadow: "#000000", light: [0.3, 1, 0.55], amb: 0.46, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night">;

// The table top (TT), the tray's floor height (FY), the walls' height.
const TT = 1.24, TRAY = 0.3, FY = TT + TRAY, WH = 0.62;
// Phases: waiting for a go, the count, the race, the munch, the next maze dropping in, all done.
const P_READY = 0, P_COUNT = 1, P_RACE = 2, P_END = 3, P_NEXT = 4, P_DONE = 5;
const MW = CW * (RS + WT) + WT, MD = CH * (RS + WT) + WT;

export type RatScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly race: Race;
  readonly state: { round: number; phase: number; you: number; rival: number; winner: number; card: boolean; open: number };
  /** Room cell i's screen point (CSS px from the stage's top left), as of the last draw. */
  roomScreen(i: number): [number, number];
  /** Start round n with seed s (tests). */
  round(n: number, s?: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RatScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // ---- the page: canvas, a key over it, stickers, end card, keys ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "rr-play";
  play.setAttribute("aria-label", "Rat Race: race the rival mouse to the cheese. Hold an arrow to run, your mouse turns at the next opening; first to two cheeses wins. M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "rr-hud";
  hud.innerHTML = `<div class="rr-head"><p class="rr-top"><b class="rr-chip rr-lvl">Round 1</b><b class="rr-chip rr-score"><i class="rr-dot rr-you"></i>You <span>0</span> · <i class="rr-dot rr-riv"></i>Rival <span>0</span></b></p><p class="rr-hint"></p></div><p class="rr-live" aria-live="polite"></p><div class="rr-card" role="dialog" aria-label="Race over" hidden><b></b><p></p><button type="button" class="bui-key rr-again">RACE AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const lvlEl = top.children[0] as HTMLElement, nums = top.children[1]!.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { step: "tick", go: "go", count: "beep", door: "clack", bonk: "bonk", sniff: "sniff", win: "win", lose: "lose", drop: "whoosh", done: "win", tap: "tick" },
    notes: {
      tick: [[1500, 1100, 0.025, 0, "triangle", 0.04]],
      beep: [[660, 660, 0.09, 0, "square", 0.05]],
      go: [[990, 990, 0.16, 0, "square", 0.06], [1320, 1320, 0.12, 0.05, "triangle", 0.05]],
      clack: [[260, 120, 0.07, 0, "square", 0.06], [900, 500, 0.03, 0.02, "triangle", 0.05]],
      bonk: [[420, 140, 0.16, 0, "triangle", 0.12], [1800, 2400, 0.08, 0.08, "sine", 0.05]],
      sniff: [[2400, 2600, 0.03, 0, "sine", 0.03], [2400, 2600, 0.03, 0.08, "sine", 0.03]],
      lose: [[520, 300, 0.25, 0, "triangle", 0.08], [300, 200, 0.3, 0.22, "triangle", 0.07]],
      whoosh: [[260, 820, 0.35, 0, "triangle", 0.05]],
    },
    volume: 0.1,
  });
  const K_MUTE = 0, K_NEW = 1;
  const [muteK, newK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "NEW RACE", aria: "Start a new race (N)", id: K_NEW },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else restart();
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
  const race = newRace();
  let round = 0, phase = P_READY, T = 0, score0 = 0, score1 = 0, seed0 = 1;
  // The walls (each with its drop-in delay), the doors, the cheese, the mice's groups and parts.
  const walls: DioramaObject[] = [], wallD: number[] = [], doorOb: DioramaObject[] = [], doorY = new Float64Array(2);
  const mice: DioramaObject[] = [], body: DioramaObject[] = [], heading = new Float64Array(2), bob = new Float64Array(2);
  let cheese: DioramaObject | null = null, flag: DioramaObject | null = null;
  let crumbs: DioramaPoints, stars: DioramaPoints;
  const CR = 28, crumbV = new Float64Array(CR * 3), crumbT = new Float64Array(CR);
  let dropT = 0, munch = 0, flagRoom = -1, flagT = 0;
  const cx = (c: number) => pos(c, CW), cz = (r: number) => pos(r, CH);

  function buildScene() {
    const g = race.g;
    dio.clear();
    keyed.length = keyName.length = walls.length = wallD.length = doorOb.length = mice.length = body.length = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    dio.cluster("maze", { fixed: 2 });
    put({ id: "floor", size: [44, 0.5, 32], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [44.6, 12, 0.5], pos: [0, -0.5, -16.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "wallR", size: [0.5, 12, 32], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3, pick: false });
    put({ id: "plinth", size: [MW + 9, TT - 0.14, MD + 5], on: "floor", color: "base", cluster: "table", layer: 0, shadow: 0.2, pick: false });
    put({ id: "top", size: [MW + 9.6, 0.14, MD + 5.6], on: "plinth", color: "top", layer: 0.4, pick: false });
    // On the table: a stack of moving boxes the maze was cut from, a desk lamp.
    put({ id: "bx0", size: [2.6, 1.6, 2.2], on: "top", pos: [-(MW / 2 + 2.5), 0, -MD / 2 + 1.6], rot: [0, 0.15, 0], color: "box", layer: 1, shadow: 0.25, pick: false });
    put({ size: [2.2, 1.2, 1.9], on: "bx0", rot: [0, -0.35, 0], color: "box2", layer: 1.2, pick: false });
    put({ id: "mug", shape: "cyl", sides: 14, size: [1.4, 1.5, 1.4], on: "top", pos: [MW / 2 + 2.4, 0, -MD / 2 + 1.4], color: "lamp2", layer: 1, shadow: 0.25, pick: false });
    put({ shape: "cyl", sides: 14, size: [1.15, 0.02, 1.15], on: "mug", pos: [0, -0.12, 0], color: "lamp", layer: 1.1, pick: false });
    // The tray (a box lid), its felt, the walls.
    put({ id: "tray", size: [MW + 0.8, TRAY, MD + 0.8], on: "top", color: "tray", cluster: "maze", layer: 0, shadow: 0.3, pick: false });
    put({ id: "felt", size: [MW, 0.02, MD], on: "tray", color: "felt", layer: 0.5, pick: false });
    const wall = (x: number, z: number, w: number, d: number, i: number) => {
      const id = "w" + i, ob = put({ id, size: [w, WH, d], on: "felt", pos: [x, 0, z], color: "wall", layer: 5, pick: false });
      put({ size: [w, 0.04, d], on: id, color: "wallTop", layer: 5, pick: false });
      walls.push(ob);
      // Drop in from the middle out.
      wallD.push(Math.hypot(x / MW, z / MD) * 0.5 + (i % 3) * 0.03);
    };
    let n = 0;
    // Rows of walls (even rows): runs of blocked cells, at most three rooms long.
    for (let r = 0; r < g.rows; r += 2) {
      let c0 = -1;
      for (let c = 0; c <= g.cols; c++) {
        const b = c < g.cols && g.flags[r * g.cols + c]! & BLOCKED && !isDoor(r * g.cols + c) && !lonely(c, r);
        if (b && c0 < 0) c0 = c;
        if ((!b || c - c0 >= 6) && c0 >= 0) {
          const c1 = c - 1, x0 = cx(c0) - span(c0) / 2, x1 = cx(c1) + span(c1) / 2;
          wall((x0 + x1) / 2, cz(r), x1 - x0, WT, n++);
          c0 = b ? c : -1;
        }
      }
    }
    // Single wall pieces between rooms in a row (odd rows, even columns).
    for (let r = 1; r < g.rows; r += 2) for (let c = 0; c < g.cols; c += 2) if (g.flags[r * g.cols + c]! & BLOCKED && !isDoor(r * g.cols + c)) wall(cx(c), cz(r), WT, RS, n++);
    // The doors: red flaps that rise and sink.
    for (let k = 0; k < 2; k++) {
      const d = race.doors[k]!, c = d % g.cols, r = (d / g.cols) | 0, along = (r & 1) === 0;
      const ob = put({ id: "door" + k, size: along ? [RS, WH * 0.96, WT * 0.8] : [WT * 0.8, WH * 0.96, RS], on: "felt", pos: [cx(c), 0, cz(r)], color: "door", layer: 5, pick: false });
      put({ size: along ? [RS, 0.04, WT * 0.8] : [WT * 0.8, 0.04, RS], on: "door" + k, color: "doorTop", layer: 5, pick: false });
      doorOb.push(ob);
      doorY[k] = k === race.open ? 1 : 0;
    }
    // The cheese: a wedge with holes.
    const ch = race.cheese, chc = ch % g.cols, chr = (ch / g.cols) | 0;
    cheese = put({ id: "cheese", shape: "wedge", size: [1.05, 0.62, 0.8], on: "felt", pos: [cx(chc), 0, cz(chr)], rot: [0, 0.5, 0], color: "cheese", layer: 5, shadow: 0.35, pick: false });
    for (const [x, z, s] of [[-0.2, 0.401, 0.18], [0.15, 0.401, 0.12], [0.3, -0.401, 0.14]]) put({ shape: "cyl", sides: 8, size: [s!, 0.02, s!], on: "cheese", pos: [x!, -0.5 + Math.abs(x!) * 0.3, z!], rot: [Math.PI / 2, 0, 0], color: "hole", layer: 5.1, pick: false });
    // The tapped room's flag.
    flag = put({ id: "flag", shape: "group", size: [0.1, 0, 0.1], on: "felt", pos: [0, 0, 0], layer: 5, hidden: true, pick: false });
    put({ size: [0.06, 0.9, 0.06], on: "flag", color: "eye", layer: 5, pick: false });
    put({ size: [0.5, 0.3, 0.04], on: "flag", pos: [0.25, 0.55, 0], color: "flag", layer: 5, pick: false });
    // The mice: a teardrop body, a pointed head, two round ears, eyes and a nose, a number bib.
    for (let k = 0; k < 2; k++) {
      const pre = k ? "r" : "y", c1: Key = k ? "riv" : "you", c2: Key = k ? "riv2" : "you2", bib: Key = k ? "rivBib" : "youBib";
      const m = put({ id: pre + "m", shape: "group", size: [0.81, 0, 0.81], on: "felt", layer: 6, shadow: 0.45, pick: false });
      const b = put({ id: pre + "b", shape: "prism", outline: [[-0.567, 0], [-0.405, 0.338], [0, 0.432], [0.378, 0.324], [0.567, 0], [0.378, -0.324], [0, -0.432], [-0.405, -0.338]], taper: 0.75, size: [1.35, 0.486, 1.35], on: pre + "m", color: c1, layer: 6, pick: false });
      put({ shape: "prism", outline: [[-0.405, 0], [-0.243, 0.27], [0.162, 0.27], [0.324, 0], [0.162, -0.27], [-0.243, -0.27]], size: [1.35, 0.081, 1.35], on: pre + "b", pos: [-0.054, 0, 0], color: bib, layer: 6.1, pick: false });
      put({ id: pre + "h", shape: "cyl", sides: 8, top: 0, size: [0.567, 0.621, 0.54], on: pre + "m", pos: [0.648, 0.23, 0], rot: [0, 0, -Math.PI / 2], color: c2, layer: 6.2, pick: false });
      put({ shape: "cyl", sides: 6, size: [0.121, 0.108, 0.121], on: pre + "h", pos: [0, 0.567, 0], color: "pink", layer: 6.3, pick: false });
      for (const s of [-1.35, 1.35]) {
        put({ shape: "cyl", sides: 10, size: [0.459, 0.068, 0.459], on: pre + "m", pos: [0.49, 0.43, s * 0.27], rot: [0, 0, 1.2], color: c2, layer: 6.3, pick: false });
        put({ shape: "cyl", sides: 10, size: [0.297, 0.027, 0.297], on: pre + "m", pos: [0.5, 0.475, s * 0.27], rot: [0, 0, 1.2], color: "pink", layer: 6.35, pick: false });
        put({ size: [0.095, 0.095, 0.095], on: pre + "m", pos: [0.81, 0.36, s * 0.12], color: "eye", layer: 6.4, pick: false });
      }
      mice.push(m), body.push(b);
    }
    dio.decal("maze", 5.9, drawTails);
    crumbs = dio.points({ cap: CR, cluster: "maze", layer: 6.5, color: P.crumb });
    stars = dio.points({ cap: 6, cluster: "maze", layer: 7, paint: paintStar });
    dirty = true;
  }
  /** A post (even, even) with no wall on any side: left out (a lone pillar reads as a crumb). */
  function lonely(c: number, r: number) {
    const g = race.g, w = (cc: number, rr: number) => cc >= 0 && rr >= 0 && cc < g.cols && rr < g.rows && g.flags[rr * g.cols + cc]! & BLOCKED && !isDoor(rr * g.cols + cc);
    return (c & 1) === 0 && (r & 1) === 0 && !w(c + 1, r) && !w(c - 1, r) && !w(c, r + 1) && !w(c, r - 1);
  }
  function isDoor(i: number) {
    return i === race.doors[0] || i === race.doors[1];
  }

  // ---- state and flow ----
  let hudDirty = true, dirty = true, toastT = 0, toastK = 0, toastS = "", said = "", countN = 0, stepT = 0;
  const tmp = new Float64Array(3), W3 = new Float64Array(4);
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const cue = (t: string) => engine.events.emit(t);
  /** Round n on seed s: a new maze, the mice on their corners; it drops in. */
  function startRound(n: number, s = seed0 + n * 7) {
    round = n;
    load(s, race);
    buildScene();
    heading[0] = race.mice[0]!.dir === 0 ? 0 : Math.PI;
    heading[1] = race.mice[1]!.dir === 0 ? 0 : Math.PI;
    crumbs.n = 0;
    munch = 0;
    flagRoom = -1;
    setView(true);
    phase = P_NEXT;
    dropT = RM ? 2 : 0;
    cue("drop");
    say(`Round ${n + 1}: a new maze. Your mouse is in the ${corner(race.start[YOU]!)} corner, the cheese in the middle.`);
    hudDirty = true;
    engine.busy(1.6);
    engine.wake();
  }
  const corner = (i: number) => {
    const c = i % race.g.cols, r = (i / race.g.cols) | 0, port = portrait();
    // Named as you see it: in the tall shape the camera looks along x.
    const right = port ? r > race.g.rows / 2 : c > race.g.cols / 2, near = port ? c < race.g.cols / 2 : r > race.g.rows / 2;
    return `${near ? "near" : "far"} ${right ? "right" : "left"}`;
  };
  function restart() {
    score0 = score1 = 0;
    card.hidden = true;
    seed0 = 1 + ((seed0 * 48271) % 9973);
    startRound(0);
  }
  function begin() {
    if (phase !== P_READY) return;
    phase = P_COUNT;
    T = 0;
    countN = 3;
    toast("3", 0);
    cue("count");
    engine.busy(1.2);
    engine.wake();
  }
  function finish() {
    const w = race.winner;
    w === YOU ? score0++ : score1++;
    phase = P_END;
    T = 0;
    munch = 0;
    cue(w === YOU ? "win" : "lose");
    toast(w === YOU ? "CHEESE! YOURS" : "THE RIVAL GOT IT", w === YOU ? 1 : 2);
    say(w === YOU ? `You got the cheese in ${race.t.toFixed(1)} seconds.` : `The rival got the cheese in ${race.t.toFixed(1)} seconds.`);
    // Crumbs fly from the cheese.
    const ch = race.cheese, x = cx(ch % race.g.cols), z = cz((ch / race.g.cols) | 0);
    for (let i = 0; i < CR; i++) {
      const a = engine.random() * TAU, s = 0.6 + engine.random() * 1.6;
      (crumbs.x[i] = x), (crumbs.y[i] = FY + 0.4), (crumbs.z[i] = z), (crumbs.r[i] = 0.035 + engine.random() * 0.04), (crumbs.a[i] = 1);
      (crumbV[i * 3] = Math.cos(a) * s), (crumbV[i * 3 + 1] = 1.5 + engine.random() * 2.2), (crumbV[i * 3 + 2] = Math.sin(a) * s), (crumbT[i] = 0);
    }
    crumbs.n = RM ? 0 : CR;
    engine.busy(2.6);
    hudDirty = true;
  }
  function afterEnd() {
    if (score0 >= 2 || score1 >= 2) return showEnd();
    startRound(round + 1);
  }
  function showEnd() {
    const you = score0 >= 2;
    (card.children[0] as HTMLElement).textContent = you ? "Big cheese" : "Out-sniffed";
    (card.children[1] as HTMLElement).textContent = you ? `You won the race ${score0}–${score1}.` : `The rival won ${score1}–${score0}. It does not even know the maze.`;
    card.hidden = false;
    phase = P_DONE;
    cue(you ? "done" : "lose");
    say(you ? `You won the race ${score0} to ${score1}.` : `The rival won ${score1} to ${score0}.`);
    hudDirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 };
  const portrait = () => dio.width / dio.height < 1.05;
  function setView(snap: boolean) {
    const port = portrait(), g = goal, W = dio.width, H = dio.height, hw = MW / 2 + 0.5, hh = MD / 2 + 0.5;
    (g.yaw = (port ? -90 : -6) * D), (g.pitch = (port ? 66 : 62) * D), (g.tx = 0), (g.ty = FY), (g.tz = 0), (g.fov = 0.6);
    const pts = [-hw, FY + WH, -hh, hw, FY + WH, -hh, -hw, TT, hh, hw, TT, hh];
    dio.fit(g, pts, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    if (snap || RM) Object.assign(dio.cam, g);
    dirty = true;
    engine.wake();
  }

  // ---- input: arrows, swipes, taps ----
  const held = new Int8Array(4); // world directions held (0 +x, 1 −x, 2 +z, 3 −z) by the arrows, in order
  let heldN = 0;
  /** A screen direction (0 right, 1 left, 2 down, 3 up) to the world direction under the camera. */
  function worldDir(s: number) {
    const y = dio.cam.yaw, cy = Math.cos(y), sy = Math.sin(y);
    // Screen right is (cos yaw, −sin yaw) on the table; screen down is (sin yaw, cos yaw).
    const vx = s === 0 ? cy : s === 1 ? -cy : s === 2 ? sy : -sy, vz = s === 0 ? -sy : s === 1 ? sy : s === 2 ? cy : -cy;
    return Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 0 : 1) : vz > 0 ? 2 : 3;
  }
  function wish(d: number) {
    if (phase === P_READY) begin();
    hold(race, d);
    flagRoom = -1;
    engine.wake();
  }
  const ARROWS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"], WASD = ["d", "a", "s", "w"];
  const arrow = (e: KeyboardEvent) => {
    const i = ARROWS.indexOf(e.key);
    return i >= 0 ? i : WASD.indexOf(e.key.toLowerCase());
  };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase();
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "n") return void (e.preventDefault(), restart());
    const i = arrow(e);
    if (i < 0 || (e.target as Element).closest?.(".gk-bar")) {
      if ((e.key === " " || e.key === "Enter") && phase === P_READY && !(e.target as Element).closest?.(".gk-bar")) e.preventDefault(), begin();
      return;
    }
    e.preventDefault();
    if (e.repeat) return;
    const d = worldDir(i);
    held[heldN++ & 3] = d;
    wish(d);
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const i = arrow(e);
    if (i < 0) return;
    const d = worldDir(i);
    // Let go of this one: back to another still held, or stop at the next room.
    let w = -1;
    for (let k = 0; k < heldN && k < 4; k++) if (held[k] === d) held[k] = -1;
    for (let k = 0; k < heldN && k < 4; k++) if (held[k]! >= 0) w = held[k]!;
    if (w < 0) heldN = 0;
    hold(race, w);
    engine.wake();
  }, sig);
  play.addEventListener("blur", () => (heldN = 0, hold(race, -1)), sig);
  let downX = 0, downY = 0, downId = -1;
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture(e.pointerId);
    (downId = e.pointerId), (downX = e.offsetX), (downY = e.offsetY);
    engine.wake();
  }, sig);
  const up = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    downId = -1;
    if (e.type !== "pointerup") return;
    const dx = e.offsetX - downX, dy = e.offsetY - downY;
    if (Math.hypot(dx, dy) > 24) wish(worldDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 1) : dy > 0 ? 2 : 3));
    else tap(e.offsetX, e.offsetY);
  };
  play.addEventListener("pointerup", up, sig);
  play.addEventListener("pointercancel", up, sig);
  function tap(x: number, y: number) {
    if (phase === P_READY) begin();
    if (phase !== P_COUNT && phase !== P_RACE) return;
    if (!dio.ground(x, y, FY, tmp)) return;
    const rm = roomAt(race, tmp[0]!, tmp[2]!);
    if (tapTo(race, rm)) (flagRoom = rm), (flagT = 0), cue("tap"), engine.wake();
  }
  again.addEventListener("click", () => (restart(), play.focus({ preventScroll: true })), sig);

  // ---- the frame ----
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!] as string;
          crumbs.colorAll = P.crumb;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = newK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(true);
      }
      if (first && V[5]) {
        const f = first;
        first = null;
        tap(f.x, f.y);
      }
    },
    step(e, dt) {
      let moving = false;
      if (phase === P_NEXT) {
        dropT += dt;
        if (dropT >= 1.3) (phase = P_READY), toast(`ROUND ${round + 1}`, 0), (hudDirty = true);
        moving = true;
      } else if (phase === P_COUNT) {
        T += dt;
        const n = 3 - Math.floor(T / 0.38);
        if (n !== countN && n > 0) (countN = n), toast("" + n, 0), cue("count");
        if (T >= 1.14) (phase = P_RACE), go(race), toast("GO!", 1), cue("go"), (hudDirty = true);
        moving = true;
      } else if (phase === P_RACE) {
        step(race, dt);
        const ev = race.ev;
        race.ev = 0;
        if (ev & EV_SWAP) cue("door");
        if (ev & EV_BONK0) cue("bonk"), say("Bonk! A door shut in your face."), (flagRoom = -1);
        if (ev & EV_BONK1) cue("bonk");
        if (ev & EV_SNIFF) cue("sniff");
        stepT += dt;
        if (stepT > 0.16) (stepT = 0), (race.mice[YOU]!.to !== race.mice[YOU]!.at) && cue("step");
        if (ev & EV_WON || race.state === WON) finish();
        moving = true;
      } else if (phase === P_END) {
        T += dt;
        munch += dt;
        if (T >= 2.4) afterEnd();
        moving = true;
      }
      // The doors rise and sink toward their state.
      for (let k = 0; k < 2; k++) {
        const want = k === race.open ? 1 : 0, y = doorY[k]!;
        if (y !== want) (doorY[k] = RM || Math.abs(want - y) < 0.01 ? want : y + (want - y) * Math.min(1, dt * 14)), (moving = true);
      }
      // The mice turn toward their heading.
      for (let k = 0; k < 2; k++) {
        const M = race.mice[k]!, want = M.dir === 0 ? 0 : M.dir === 1 ? Math.PI : M.dir === 2 ? -Math.PI / 2 : Math.PI / 2;
        let d = want - heading[k]!;
        d -= Math.round(d / TAU) * TAU;
        if (Math.abs(d) > 0.002) (heading[k] = heading[k]! + (RM ? d : d * Math.min(1, dt * 16))), (moving = true);
        const run = M.to !== M.at && phase === P_RACE && M.wait <= 0;
        bob[k] = run ? bob[k]! + dt * 18 : 0;
      }
      // Crumbs.
      if (crumbs.n) {
        let alive = 0;
        for (let i = 0; i < crumbs.n; i++) {
          if (crumbs.a[i]! <= 0) continue;
          crumbT[i] = crumbT[i]! + dt;
          crumbV[i * 3 + 1] = crumbV[i * 3 + 1]! - 9 * dt;
          crumbs.x[i] = crumbs.x[i]! + crumbV[i * 3]! * dt;
          crumbs.z[i] = crumbs.z[i]! + crumbV[i * 3 + 2]! * dt;
          crumbs.y[i] = Math.max(FY + 0.03, crumbs.y[i]! + crumbV[i * 3 + 1]! * dt);
          if (crumbs.y[i] === FY + 0.03) (crumbV[i * 3]! *= 0.8), (crumbV[i * 3 + 2]! *= 0.8);
          if (crumbT[i]! > 1.6) crumbs.a[i] = Math.max(0, 1 - (crumbT[i]! - 1.6) / 0.6);
          if (crumbs.a[i]! > 0) alive++;
        }
        if (alive) moving = true;
        else crumbs.n = 0;
      }
      if (flagRoom >= 0 && flagT < 1) (flagT = Math.min(1, flagT + dt * 4)), (moving = true);
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) {
        dirty = false;
        place();
        dio.draw();
        V[5] = 1;
      }
    },
  });
  /** Everything that moves, from the model: walls dropping in, doors, mice, cheese, flag, stars. */
  function place() {
    const g = race.g, u = phase === P_NEXT ? dropT : 9;
    for (let i = 0; i < walls.length; i++) {
      const t = Math.max(0, Math.min(1, (u - wallD[i]!) / 0.45)), e = t < 1 ? 1 - (1 - t) * (1 - t) : 1;
      walls[i]!.pos[1] = (1 - e) * 2.4;
      walls[i]!.alpha = Math.min(1, t * 3);
    }
    for (let k = 0; k < doorOb.length; k++) {
      // Open: sunk into the floor (and faded); shut: standing.
      const y = doorY[k]!;
      doorOb[k]!.pos[1] = -y * WH * 0.9;
      doorOb[k]!.alpha = phase === P_NEXT ? Math.min(1, Math.max(0, u - 0.6) * 3) : 1 - y * 0.85;
    }
    for (let k = 0; k < 2; k++) {
      where(race, k, W3);
      const m = mice[k]!, M = race.mice[k]!, run = bob[k]!;
      (m.pos[0] = W3[0]!), (m.pos[2] = W3[1]!), (m.pos[1] = Math.abs(Math.sin(run)) * 0.07 + (M.bonk > 0 ? Math.sin(M.bonk * 16) * 0.05 : 0));
      m.rot[1] = heading[k]!;
      m.rot[2] = M.wait > 0 ? 0.18 * Math.sin(M.wait * 30) : 0; // sniffing: the nose up and down
      m.alpha = phase === P_NEXT ? Math.min(1, Math.max(0, u - 0.8) * 3) : 1;
      body[k]!.rot[0] = run ? Math.sin(run) * 0.05 : 0;
    }
    if (cheese) {
      // Munched: the winner nibbles it down.
      const s = phase === P_END ? Math.max(0.35, 1 - munch * 0.35) : 1;
      cheese.alpha = phase === P_NEXT ? Math.min(1, Math.max(0, u - 0.5) * 3) : 1;
      cheese.rot[1] = 0.5 + (phase === P_END ? Math.sin(munch * 30) * 0.06 * s : 0);
      cheese.pos[1] = phase === P_END ? -(1 - s) * 0.4 : 0;
    }
    if (flag) {
      flag.hidden = flagRoom < 0 || phase !== P_RACE;
      if (flagRoom >= 0) (flag.pos[0] = cx(flagRoom % g.cols) + 0.35), (flag.pos[2] = cz((flagRoom / g.cols) | 0) - 0.35), (flag.pos[1] = (1 - flagT) * 0.8), (flag.alpha = flagT);
      if (flagRoom >= 0 && race.mice[YOU]!.at === flagRoom) flagRoom = -1;
    }
    // Bonk stars over a bonked mouse.
    stars.n = 0;
    for (let k = 0; k < 2; k++) {
      const M = race.mice[k]!;
      if (M.bonk <= 0) continue;
      where(race, k, W3);
      for (let i = 0; i < 3; i++) {
        const a = M.bonk * 9 + (i * TAU) / 3, j = stars.n++;
        (stars.x[j] = W3[0]! + Math.cos(a) * 0.35), (stars.y[j] = FY + 0.75), (stars.z[j] = W3[1]! + Math.sin(a) * 0.35), (stars.r[j] = 0.12), (stars.a[j] = Math.min(1, M.bonk * 3));
      }
    }
  }
  function paintStar(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = p.sr[i]!;
    ctx.globalAlpha = p.a[i]!;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU - Math.PI / 2, q = k & 1 ? r * 0.45 : r;
      k ? ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    ctx.closePath();
    ctx.fillStyle = P.star;
    ctx.fill();
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /** The tails: a curve from the rump, swinging as the mouse runs. */
  function drawTails(ctx: CanvasRenderingContext2D) {
    const f = dio.focal();
    for (let k = 0; k < 2; k++) {
      const m = mice[k]!;
      if (m.alpha < 0.2) continue;
      const h = heading[k]!, c = Math.cos(h), s = Math.sin(h), x = m.pos[0]!, z = m.pos[2]!, sw = Math.sin(bob[k]! * 0.7) * 0.25;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, back = 0.54 + t * 1, side = Math.sin(t * 3 + sw * 4) * (0.15 + t * 0.15) + sw * t;
        dio.project(x - c * back + s * side, FY + 0.06 + (1 - t) * 0.08, z + s * back + c * side, tmp);
        i ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
      }
      ctx.globalAlpha = m.alpha;
      ctx.lineCap = "round";
      ctx.strokeStyle = P.tail;
      ctx.lineWidth = Math.max(1.5, (0.07 * f) / tmp[2]!);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---- overlay: name tags at the start, the toast ----
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
  const TOAST = ["#fffaf1", "#ffd36b", "#ffe1d6"], TOAST_T = 1.4;
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (phase === P_READY || phase === P_COUNT) {
      const px = Math.round(Math.max(11, Math.min(15, dio.width / 60)));
      for (let k = 0; k < 2; k++) {
        where(race, k, W3);
        if (!dio.project(W3[0]!, FY + 1.1, W3[1]!, tmp)) continue;
        sticker(ctx, k ? "RIVAL" : "YOU", tmp[0]!, tmp[1]!, px, k ? P.rivBib : P.youBib, "#1f2433");
      }
    }
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
    (toastS = text), (toastK = kind), (toastT = RM ? 0.9 : TOAST_T);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the HUD ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const l = `Round ${round + 1}`;
    if (set(0, l)) lvlEl.textContent = l;
    if (set(1, score0)) nums[0]!.textContent = "" + score0;
    if (set(2, score1)) nums[1]!.textContent = "" + score1;
    const hint = phase === P_READY ? (coarse ? "Tap a room to run there, or swipe. First to the cheese." : "Hold an arrow to run, or click a room. First to the cheese.") : "";
    if (set(3, hint)) hintEl.textContent = hint;
    if (set(4, said)) live.textContent = said;
  }

  // The poster (scripts/gallery-posters.mjs): mid-race, both mice on their way, a door half shut.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    startRound(0, 3);
    dropT = 2;
    phase = P_RACE;
    go(race);
    tapTo(race, race.cheese);
    for (let i = 0; i < 60 * 2.2; i++) step(race, 1 / 60);
    race.ev = 0;
    toastT = 0;
    for (let k = 0; k < 2; k++) {
      const M = race.mice[k]!;
      heading[k] = M.dir === 0 ? 0 : M.dir === 1 ? Math.PI : M.dir === 2 ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  // The maze waits: it starts on a tap or an arrow.
  restart();
  dropT = 2;
  phase = P_READY;
  toastT = 0;
  engine.start();
  return {
    engine,
    accessible: true,
    get race() {
      return race;
    },
    get state() {
      return { round, phase, you: score0, rival: score1, winner: race.winner, card: !card.hidden, open: race.open };
    },
    roomScreen(i: number) {
      const g = race.g;
      dio.project(cx(i % g.cols), FY, cz((i / g.cols) | 0), tmp);
      return [tmp[0]!, tmp[1]!];
    },
    round(n: number, s?: number) {
      startRound(n, s);
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: mid-race (scripts/gallery-posters.mjs). */
export const posterAt = 0.3;
// Exported for the tests' bundle.
export { RACING, READY };
