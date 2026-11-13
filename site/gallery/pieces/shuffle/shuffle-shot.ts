// "Shuffle Shot": tabletop shuffleboard on a long polished table in the corner of a games room.
// You and a bot slide four pucks each, turn about: drag back from your puck to aim and set the power
// (or ←/→ aim, ↑/↓ power, Space), let go and it glides down the lane, knocks others aside, drops
// into the gutter or off the far end. Scoring zones 1, 2, 3 and the hanging 4 (a puck over the far
// edge); at the end of a round only the side with the furthest puck scores, for every puck past the
// other side's best. First to 15. Light: a bright afternoon; dark: a neon night under two pendants.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/flick
// (the physics: slides, hits, falls; `sling`'s drag-aim as two integers), @fzlt/core/diorama (the 3D),
// @fzlt/core/slot, @fzlt/core/sound. The game is ./model.ts, pure and seeded (tests/shuffle-shot.test.mjs);
// this file is the scene and the controls (tests/shuffle-shot.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sling } from "../../../../src/flick";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { AIM, EDGE, GUTTER, LEN, OVER, PER, PH, R, ROLL, STEPS, TALLY, TURNS, VMAX, WID, X0, ZONE, botAim, newGame, nextRound, puckOf, rested, resetGame, shoot, shooter, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
const LIGHT = {
  bg: "#f1e9df", floor: "#ddd4c8", rug: "#bfe0d6", rug2: "#cfe8df", wallB: "#f6dcd2", wallR: "#d8e4f0", cab: "#8fa7c9", leg: "#6f86a9", gut: "#5d6b86",
  board: "#f4dfb8", rail: "#c48d63", bump: "#ef8f7a", you: "#f07f68", bot: "#6f9fd8", steel: "#e4e7ee", dot: "#ffffff", shade: "#f2c46d", bulb: "#fff3c8",
  pot: "#e8a27f", leaf: "#93cf9f", leaf2: "#b6e0a9", stool: "#e9b16a", line: "#b0664a", num: "#b0664a", zone: "#efd09d", shadow: "#3a2d3c",
  neon: "#ef8f7a", neon2: "#6f9fd8", light: [0.5, 1, 0.55], amb: 0.52, sheen: 0.32, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#120f1f", floor: "#231e36", rug: "#2d2546", rug2: "#352c52", wallB: "#1d1a33", wallR: "#1b2438", cab: "#3b3f66", leg: "#2c2f4f", gut: "#141526",
  board: "#d2ae7c", rail: "#6b4a3a", bump: "#c8466f", steel: "#b7bccb", pot: "#7a4a52", leaf: "#3f6f63", leaf2: "#4e8473", stool: "#7a5a3f", line: "#7d3f2c", num: "#7d3f2c",
  zone: "#c49d6c", shadow: "#000000", neon: "#ff5fa8", neon2: "#4ee6ff", light: [0.35, 1, 0.6], amb: 0.4, sheen: 0.22, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night" | "sheen">;

/** The board's top in the world (the table's height): flick's table frame is this plane. */
const BY = 3;
const GZ = WID / 2 + 0.62;
// Effects: x y z, vx vy vz, life, max life, type (0 trail, 1 spark, 2 dust), size.
const PART = 180, PS = 10;
// Timed beats: what runs, and when.
const T_TURN = 1, T_BOT = 2, T_BOTGO = 3, T_POP = 4, T_NEXT = 5, T_END = 6, T_POSTER = 7;
const VIEWS = ["TABLE", "LANE"];

export type ShuffleScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { phase: number; turn: number; k: number; round: number; you: number; bot: number; aim: boolean; ready: boolean; card: boolean; view: string };
  /** The screen point (CSS px, from the stage's top left) of world (x, board top, z), as of now. */
  screen(x: number, z: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): ShuffleScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the HUD
  // stickers, the end card and the keys. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ss-play";
  play.setAttribute("aria-label", "Shuffle Shot: drag back from your puck and let go to slide it; or the arrow keys aim and set the power, then Space shoots (V view, M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "ss-hud";
  hud.innerHTML = `<div class="ss-head"><p class="ss-top"><b class="ss-chip ss-turn">Your shot</b><b class="ss-chip ss-n"><i class="ss-dot"></i>You <span>0</span><i class="ss-dot ss-foe"></i>Bot <span>0</span><em>to 15</em></b><b class="ss-chip ss-r">Round <span>1</span></b></p><p class="ss-hint"></p></div><p class="ss-live" aria-live="polite"></p><div class="ss-card" role="dialog" aria-label="Game over" hidden><b></b><p></p><button type="button" class="bui-key ss-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, liveEl = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { "flick:hit": "clack", "flick:fall": "thud", slide: "slide", score: "power", none: "click", win: "win", lose: "end" },
    notes: {
      clack: [[2100, 1300, 0.03, 0, "square", 0.07], [950, 620, 0.06, 0.004, "triangle", 0.16]],
      thud: [[170, 55, 0.14, 0, "triangle", 0.22]],
      slide: [[240, 150, 0.32, 0, "sawtooth", 0.025], [120, 90, 0.35, 0, "triangle", 0.08]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_VIEW = 1;
  const [muteK, viewK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "VIEW · TABLE", aria: "Camera view (V)", id: K_VIEW },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else cycleView();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the game, its effects and the diorama ----
  const fx = new Float64Array(PART * PS);
  /** flick's events: sparks where pucks clack, dust where they drop; then on to the engine's ring (sound). */
  const events = {
    emit(t: string, a = 0, b = 0, x = 0, y = 0, v = 0) {
      if (t === "flick:hit" && !poserRun) for (let k = 0, n = Math.min(9, 3 + v); k < n; k++) spawn(1, x, 0.12, y, (fxRnd() - 0.5) * 3, 0.6 + fxRnd() * 1.6, (fxRnd() - 0.5) * 3, 0.25 + fxRnd() * 0.2, 0.035);
      if (t === "flick:fall" && !poserRun) for (let k = 0; k < 6; k++) spawn(2, g.w.x[a]!, GUTTER + 0.05, g.w.z[a]!, (fxRnd() - 0.5) * 1.2, 0.3 + fxRnd() * 0.4, (fxRnd() - 0.5) * 1.2, 0.5 + fxRnd() * 0.3, 0.06);
      return engine.events.emit(t, a, b, x, y, v);
    },
  };
  let g: Game = newGame(1, events), seed = 1, botRnd = seeded(1), fxRnd = seeded(1), poserRun = false;
  const aim = sling({ pull: 2.6, max: VMAX, steps: STEPS, turns: TURNS, min: 0.04 });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const keyed: DioramaObject[] = [], keyName: Key[] = [];
  const put = (d: DioramaObjectDef & { color?: Key }) => {
    const k = d.color as Key | undefined, ob = dio.add({ pick: false, ...d, color: k ? P[k] : undefined });
    if (k) keyed.push(ob), keyName.push(k);
    return ob;
  };
  const pucks: DioramaObject[] = [], caps: DioramaObject[] = [], AT = new Float64Array(2 * PER * 3);
  let trail: DioramaPoints, sparks: DioramaPoints;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = 0;
    pucks.length = caps.length = 0;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    // The room: a floor, two walls, a rug, the neon sign and a plant in the corner.
    put({ id: "floor", size: [46, 0.5, 30], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
    put({ size: [46.6, 13, 0.5], pos: [0, -0.5, -15.25], color: "wallB", cluster: "room", layer: 0.3 });
    put({ size: [0.5, 13, 30], pos: [23.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3 });
    put({ id: "rug", size: [30, 0.05, 13], on: "floor", pos: [0, 0, 0.5], color: "rug", layer: 0.2 });
    put({ size: [28.4, 0.02, 11.4], on: "rug", color: "rug2", layer: 0.21 });
    dio.decal("room", 0.5, neon);
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.25, size: [2, 1.7, 2], pos: [19, 0, -11.8], color: "pot", cluster: "room", layer: 1, shadow: 0.2, on: "floor" });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.4, size: [3.4, 2.6, 3.4], on: "pot", color: "leaf", layer: 1 });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [2.4, 2.4, 2.4], on: "leaf", color: "leaf2", layer: 1 });
    // The table: legs, the cabinet, the gutter liner, the board; the far rail and bumper behind.
    const LX = LEN / 2 - 0.6, LZ = WID / 2 + 0.45, cabTop = BY + GUTTER;
    for (let i = 0; i < 4; i++) put({ size: [0.42, cabTop - 0.62, 0.42], on: "floor", pos: [i & 1 ? LX : -LX, 0, i & 2 ? LZ : -LZ], color: "leg", cluster: "table", layer: 0.1, shadow: 0.2 });
    put({ size: [LEN - 1.4, 0.18, 0.2], on: "floor", pos: [0, 0.6, 0], color: "leg", cluster: "table", layer: 0.05 });
    put({ id: "cab", size: [LEN + 2.4, 0.6, 2 * GZ + 0.5], on: "floor", pos: [0, cabTop - 0.62, 0], color: "cab", cluster: "table", layer: 0.5, shadow: 0.3 });
    put({ id: "gutter", size: [LEN + 2, 0.02, 2 * GZ], on: "cab", color: "gut", layer: 1 });
    put({ id: "board", size: [LEN, -GUTTER, WID], on: "gutter", color: "board", layer: 2 });
    dio.decal("table", 2.2, boardArt);
    put({ size: [LEN + 2.2, 0.5, 0.3], on: "gutter", pos: [0.1, 0, -GZ], color: "rail", layer: 1.5 });
    put({ id: "bump", size: [0.3, 0.8, 2 * GZ + 0.3], on: "gutter", pos: [EDGE + 0.95, 0, 0], color: "bump", layer: 1.6 });
    dio.decal("table", 1.7, bumpArt);
    put({ size: [0.3, 0.3, 2 * GZ + 0.3], on: "gutter", pos: [-EDGE - 0.95, 0, 0], color: "rail", layer: 1.5 });
    // The near rail in short pieces, each ranked by its own depth (so a puck in the gutter sorts right).
    for (let s = 0; s < 6; s++) {
      const len = (LEN + 2.2) / 6, x = -LEN / 2 - 1 + len * (s + 0.5), cl = "rail" + s;
      dio.cluster(cl, { at: [x, BY + 0.1, GZ + 0.2] });
      put({ size: [len, 0.5, 0.3], on: "gutter", pos: [x, 0, GZ], color: "rail", cluster: cl });
    }
    // The pucks: a steel body, a coloured cap and a bright dot; each its own cluster (its depth).
    for (let i = 0; i < 2 * PER; i++) {
      const id = "p" + i, cl = "pk" + i;
      dio.cluster(cl, { at: AT.subarray(i * 3, i * 3 + 3) });
      pucks.push(put({ id, shape: "cyl", sides: 18, size: [2 * R, PH, 2 * R], on: "board", color: "steel", cluster: cl, layer: 1, shadow: 0.34, tag: { puck: i } }));
      caps.push(put({ id: id + "c", shape: "cyl", sides: 18, size: [2 * R - 0.1, 0.03, 2 * R - 0.1], on: id, color: i < PER ? "you" : "bot", layer: 2 }));
      put({ shape: "cyl", sides: 10, size: [0.15, 0.012, 0.15], on: id + "c", color: "dot", layer: 3 });
    }
    // The effects: the trail on the board (under the pucks), sparks and dust over everything.
    trail = dio.points({ cap: PART, cluster: "table", layer: 2.6 });
    sparks = dio.points({ cap: PART });
  }

  // ---- effects ----
  function spawn(type: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    for (let k = 0; k < PART; k++) {
      const o = k * PS;
      if (fx[o + 6]! > 0) continue;
      fx[o] = x; fx[o + 1] = y; fx[o + 2] = z; fx[o + 3] = vx; fx[o + 4] = vy; fx[o + 5] = vz;
      fx[o + 6] = fx[o + 7] = life; fx[o + 8] = type; fx[o + 9] = size;
      return;
    }
  }
  function stepFx(dt: number) {
    let any = false;
    for (let k = 0; k < PART; k++) {
      const o = k * PS;
      if (fx[o + 6]! <= 0) continue;
      any = true;
      fx[o + 6] = fx[o + 6]! - dt;
      if (fx[o + 8] === 0) continue;
      fx[o] = fx[o]! + fx[o + 3]! * dt; fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt; fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt;
      fx[o + 4] = fx[o + 4]! - dt * (fx[o + 8] === 1 ? 9 : 1.5);
      if (fx[o + 1]! < GUTTER) fx[o + 1] = GUTTER;
    }
    return any;
  }
  function fxPoints() {
    let nt = 0, ns = 0;
    const tint = shooter(g) ? P.bot : P.you;
    for (let k = 0; k < PART; k++) {
      const o = k * PS, life = fx[o + 6]!;
      if (life <= 0) continue;
      const u = life / fx[o + 7]!, t = fx[o + 8]!, p = t === 0 ? trail : sparks, n = t === 0 ? nt++ : ns++;
      p.x[n] = fx[o]!; p.y[n] = BY + fx[o + 1]!; p.z[n] = fx[o + 2]!;
      p.r[n] = fx[o + 9]! * (t === 0 ? 0.4 + u * 0.6 : t === 2 ? 2 - u : 1);
      p.a[n] = t === 0 ? u * 0.5 : t === 2 ? u * 0.5 : u;
      p.color[n] = t === 0 ? tint : t === 1 ? (u > 0.5 ? "#ffffff" : "#ffd36b") : P.steel;
    }
    trail.n = nt;
    sparks.n = ns;
  }

  // ---- state ----
  const TT = new Float64Array(8), TF = new Uint8Array(8);
  // Per puck, off the physics (in a rack, hopping to the line, flying home): where it is drawn, where
  // it came from, when it left, and how long it takes.
  const VP = new Float64Array(2 * PER * 3), VF = new Float64Array(2 * PER * 3), V0 = new Float64Array(2 * PER).fill(-1), VD = new Float64Array(2 * PER);
  const pops = new Float64Array(2 * PER); // per puck: when its points pop up in the tally (0: none)
  let view = 0, ready = false, dragging = false, kbd = false, kAngle = 0, kLevel = 150, botA = 0, botL = 0, botT = 0, dirty = true, hudDirty = true;
  let toastT = 0, toastS = "", toastC = "", said = "";
  const tmp = new Float64Array(3), hit3 = new Float64Array(3), press3 = new Float64Array(3), botShot = new Float64Array(2);
  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset.
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  function later(sec: number, what: number) {
    for (let k = 0; k < 8; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05), engine.wake());
  }
  function reset(s: number) {
    seed = s >>> 0;
    resetGame(g, seed);
    botRnd = seeded(seed * 31 + 7);
    fxRnd = seeded(seed * 17 + 3);
    fx.fill(0), TF.fill(0), pops.fill(0), V0.fill(-1);
    ready = dragging = false;
    aim.cancel();
    toastT = 0;
    buildScene();
    for (let i = 0; i < 2 * PER; i++) rackPos(i, tmp), VP.set(tmp, i * 3);
    card.hidden = true;
    turn();
  }
  /** Where puck i waits: its side's rack (the next one nearest the line), or on the line when it is up. */
  function rackPos(i: number, out: Float64Array) {
    const s = i < PER ? 0 : 1, j = i - s * PER;
    if (g.phase === AIM && i === puckOf(g)) return (out[0] = X0), (out[1] = 0), (out[2] = 0), out;
    // Two by two behind the line: the next one nearest it, on its side of the lane.
    out[0] = -6.98 - (j >> 1) * 0.62;
    out[1] = 0;
    out[2] = (s ? -1 : 1) * (j & 1 ? 0.9 : 0.3);
    return out;
  }
  /** Send puck i (off the physics) toward its rack or line spot, in an arc. */
  function fly(i: number, delay: number, dur: number) {
    for (let k = 0; k < 3; k++) VF[i * 3 + k] = VP[i * 3 + k]!;
    V0[i] = engine.time + delay;
    VD[i] = RM ? 0.001 : dur;
    engine.busy(delay + dur + 0.05);
  }
  /** A shot is up: the next puck hops from its rack to the line; the bot thinks, then shoots. */
  function turn() {
    if (g.phase !== AIM) return;
    const i = puckOf(g);
    fly(i, 0.05, 0.42);
    ready = false;
    later(0.5, T_TURN);
    hudDirty = dirty = true;
  }
  function setTurnReady() {
    ready = true;
    if (shooter(g) === 1) {
      botAim(g, botRnd, botShot);
      (botA = botShot[0]!), (botL = botShot[1]!), (botT = engine.time);
      later(RM ? 0.05 : 0.9, T_BOTGO);
    } else kbd = false;
    hudDirty = dirty = true;
  }
  function fire(angle: number, level: number) {
    if (!ready || g.phase !== AIM) return false;
    const i = puckOf(g);
    if (!shoot(g, angle, level)) return false;
    ready = false;
    V0[i] = -1;
    engine.events.emit("slide");
    if (RM) g.w.run();
    hudDirty = dirty = true;
    engine.wake();
    return true;
  }
  /** A shot came to rest: the next one, or the tally (each scoring puck pops its points in turn). */
  function afterShot() {
    const ph = rested(g);
    if (ph === AIM) return turn();
    if (ph !== TALLY) return;
    let n = 0;
    for (let i = 0; i < 2 * PER; i++) if (g.pts[i]) pops[i] = engine.time + 0.5 + 0.35 * n++;
    later(0.5 + 0.35 * n + 0.2, T_POP);
    later(0.5 + 0.35 * n + 2.2, T_NEXT);
    hudDirty = true;
  }
  function tallyToast() {
    if (g.rs < 0) (toastS = "NO SCORE"), (toastC = P.steel), engine.events.emit("none");
    else (toastS = (g.rs ? "BOT +" : "YOU +") + g.rp), (toastC = g.rs ? P.bot : P.you), engine.events.emit("score");
    toastT = 2;
    hudDirty = true;
  }
  function next() {
    const was = g.phase;
    nextRound(g);
    pops.fill(0);
    if (g.phase === OVER) return was === TALLY && later(0.2, T_END);
    // Every puck flies home to its rack.
    for (let i = 0; i < 2 * PER; i++) {
      const ob = pucks[i]!;
      VP[i * 3] = ob.pos[0]!; VP[i * 3 + 1] = ob.pos[1]! + (ob.on === "gutter" ? GUTTER : 0); VP[i * 3 + 2] = ob.pos[2]!;
      if (ob.on !== "board") dio.on(ob, "board");
      fly(i, (i % PER) * 0.07 + (i < PER ? 0 : 0.03), 0.55);
    }
    for (let i = 0; i < 2 * PER; i++) pucks[i]!.rot.fill(0);
    turn();
  }
  function showEnd() {
    const won = g.winner === 0;
    (card.children[0] as HTMLElement).textContent = won ? "You win!" : "The bot wins";
    (card.children[1] as HTMLElement).textContent = `${g.score[0]} to ${g.score[1]} after ${g.round} round${g.round > 1 ? "s" : ""}`;
    card.hidden = false;
    hudDirty = dirty = true;
    engine.events.emit(won ? "win" : "lose");
    say(won ? `You win, ${g.score[0]} to ${g.score[1]}` : `The bot wins, ${g.score[1]} to ${g.score[0]}`);
    again.focus({ preventScroll: true });
  }
  const say = (s: string) => s !== said && ((said = s), (liveEl.textContent = s));

  // ---- the camera ----
  const goal = { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: BY, tz: 0, ox: 0, oy: 0, fov: 0.4 };
  let tweening = false;
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.2;
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const lane = (view === 1) !== portrait(), c = goal, W = dio.width, H = dio.height;
    if (lane) (c.yaw = -84 * D), (c.pitch = 50 * D), (c.tx = 0.5), (c.tz = 0);
    else (c.yaw = -26 * D), (c.pitch = 38 * D), (c.tx = 0.4), (c.tz = 0.3);
    c.ty = BY;
    const e = EDGE + 1.1, s = GZ + 0.2;
    dio.fit(c, [-e, BY + 0.3, -s, e, BY + 0.3, -s, -e, BY - 0.6, s, e, BY - 0.6, s, -e, BY + 0.9, 0], { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    if (snap || RM) Object.assign(dio.cam, c), (tweening = false);
    else tweening = true;
    hudDirty = dirty = true;
    engine.wake();
  }
  function cycleView() {
    setView((view + 1) % 2, false);
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  function stepCam(dt: number) {
    if (!tweening) return false;
    const c = dio.cam, k = 1 - Math.exp(-dt * 5);
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const f = CAMF[i]!;
      c[f] += (goal[f] - c[f]) * k;
      d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 40 : i < 2 ? 0.05 : 1));
    }
    if (d < 0.01) Object.assign(c, goal), (tweening = false);
    return true;
  }

  // ---- painting on the table: the board's lines, numbers and sheen, the bumper's 4, the neon ----
  const S = new Float64Array(8);
  /** S = the screen points of world (x0, y, z0) and (x1, y, z1)-ish quad corners. */
  function quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, y: number) {
    dio.project(x0, y, z0, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
    dio.project(x1, y, z0, tmp), (S[2] = tmp[0]!), (S[3] = tmp[1]!);
    dio.project(x1, y, z1, tmp), (S[4] = tmp[0]!), (S[5] = tmp[1]!);
    dio.project(x0, y, z1, tmp), (S[6] = tmp[0]!), (S[7] = tmp[1]!);
    ctx.beginPath();
    ctx.moveTo(S[0]!, S[1]!);
    ctx.lineTo(S[2]!, S[3]!);
    ctx.lineTo(S[4]!, S[5]!);
    ctx.lineTo(S[6]!, S[7]!);
    ctx.closePath();
  }
  /** Text in a plane: origin (x, y, z), its right along (ux, uy, uz) and its down along (vx, vy, vz), per 100 px of art. */
  function planeText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, z: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) {
    const r = dio.dpr;
    dio.project(x, y, z, tmp);
    const ax = tmp[0]!, ay = tmp[1]!;
    dio.project(x + ux, y + uy, z + uz, tmp);
    const bx = tmp[0]! - ax, by = tmp[1]! - ay;
    dio.project(x + vx, y + vy, z + vz, tmp);
    const cx = tmp[0]! - ax, cy = tmp[1]! - ay;
    ctx.setTransform((r * bx) / 100, (r * by) / 100, (r * cx) / 100, (r * cy) / 100, r * ax, r * ay);
    ctx.fillText(s, 0, 0);
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  function boardArt(ctx: CanvasRenderingContext2D) {
    const y = BY + 0.002, w = WID / 2;
    // The zones' tints, then the lines (the foul line, the zone lines, the line you shoot from).
    ctx.fillStyle = P.zone;
    quad(ctx, EDGE - 2 * ZONE, -w, EDGE - ZONE, w, y);
    ctx.fill();
    quad(ctx, EDGE - 0.02, -w, EDGE, w, y);
    ctx.fill();
    ctx.fillStyle = P.line;
    for (let k = 0; k < 3; k++) quad(ctx, EDGE - (k + 1) * ZONE - 0.04, -w, EDGE - (k + 1) * ZONE + 0.04, w, y), ctx.fill();
    quad(ctx, X0 + R + 0.12, -w, X0 + R + 0.16, w, y);
    ctx.fill();
    // The numbers, read from the shooter's end.
    ctx.font = "900 100px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = P.num;
    ctx.globalAlpha = 0.85;
    for (let k = 0; k < 3; k++) planeText(ctx, "" + (3 - k), EDGE - (k + 0.5) * ZONE, y, 0, 0, 0, 0.75, -0.75, 0, 0);
    // The sheen: two long soft bands across the polish, and the pendants' pools at night.
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = P.sheen * 0.5;
    sheen(ctx, -4.6, 2.4, y);
    ctx.globalAlpha = P.sheen * 0.3;
    sheen(ctx, 2.2, 0.9, y);
    if (P.night) {
      ctx.fillStyle = "#ffd9a0";
      for (let i = 0; i < 2; i++) (ctx.globalAlpha = 0.12), quad(ctx, (i ? 3.6 : -3.4) - 2.2, -w, (i ? 3.6 : -3.4) + 2.2, w, y), ctx.fill();
      // The neon's glow along the far edge of the polish.
      ctx.fillStyle = P.neon;
      ctx.globalAlpha = 0.16;
      quad(ctx, -6, -w, 2, -w + 0.35, y);
      ctx.fill();
      ctx.fillStyle = P.neon2;
      quad(ctx, 2.5, -w, 7.5, -w + 0.35, y);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function sheen(ctx: CanvasRenderingContext2D, x: number, wd: number, y: number) {
    const w = WID / 2;
    dio.project(x, y, w, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
    dio.project(x + wd, y, w, tmp), (S[2] = tmp[0]!), (S[3] = tmp[1]!);
    dio.project(x + wd + 1.6, y, -w, tmp), (S[4] = tmp[0]!), (S[5] = tmp[1]!);
    dio.project(x + 1.6, y, -w, tmp), (S[6] = tmp[0]!), (S[7] = tmp[1]!);
    ctx.beginPath();
    ctx.moveTo(S[0]!, S[1]!);
    ctx.lineTo(S[2]!, S[3]!);
    ctx.lineTo(S[4]!, S[5]!);
    ctx.lineTo(S[6]!, S[7]!);
    ctx.fill();
  }
  function bumpArt(ctx: CanvasRenderingContext2D) {
    // "4" on the bumper's face, for the hang.
    ctx.font = "900 100px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = P.night ? "#ffe1ee" : "#fff7ef";
    planeText(ctx, "4", EDGE + 0.79, BY + GUTTER + 0.55, 0, 0, 0, 0.42, 0, -0.42, 0);
  }
  function neon(ctx: CanvasRenderingContext2D) {
    // A sign on the back wall: a puck sliding into a star, and the word. Lit at night, painted by day.
    const x = -3.4, y = BY + 4.6, z = -14.99;
    ctx.font = "800 100px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let pass = 0; pass < (P.night ? 3 : 1); pass++) {
      ctx.globalAlpha = P.night ? [0.18, 0.35, 1][pass]! : 0.9;
      const big = P.night ? [1.06, 1.02, 1][pass]! : 1;
      ctx.fillStyle = P.neon;
      planeText(ctx, "SHUFFLE", x, y, z, 1.3 * big, 0, 0, 0, -1.3 * big, 0);
      ctx.fillStyle = P.neon2;
      planeText(ctx, "★", x - 2.2, y, z, 1.4 * big, 0, 0, 0, -1.4 * big, 0);
      planeText(ctx, "●  ·  ·", x - 6.6, y, z, 0.9 * big, 0, 0, 0, -0.9 * big, 0);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the overlay: the aim (the band, the arrow, the power), points popping, the toast ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const me = shooter(g) === 0;
    if (g.phase === AIM && ready && ((me && (aim.active || kbd)) || !me)) {
      let dx: number, dz: number, pw: number;
      if (me && aim.active) (dx = aim.dx), (dz = aim.dz), (pw = aim.power);
      else {
        let a = me ? kAngle : botA, l = me ? kLevel : botL;
        if (!me) {
          const u = Math.min(1, (engine.time - botT) / 0.7), e = u * u * (3 - 2 * u);
          (a *= e), (l *= e);
        }
        aim.set(a, l);
        (dx = aim.dx), (dz = aim.dz), (pw = aim.power);
        if (me) aim.cancel();
      }
      const len = 0.9 + pw * 7.5, x = X0, z = 0, y = BY + PH + 0.02;
      dio.project(x, y, z, tmp);
      const sx = tmp[0]!, sy = tmp[1]!;
      // The pull: a band from the puck back to the pointer.
      if (me && aim.active) {
        dio.project(x - dx * pw * 2.6, y, z - dz * pw * 2.6, hit3);
        ctx.strokeStyle = P.you;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(hit3[0]!, hit3[1]!);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(hit3[0]!, hit3[1]!, 6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      // The shot: dots down the lane as long as the power; their colour heats with it.
      const col = pw > 0.85 ? "#ff5d5d" : pw > 0.55 ? "#ffd23f" : "#ffffff";
      ctx.fillStyle = col;
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 2;
      for (let k = 1; k <= 12; k++) {
        const t = (k / 12) * len;
        dio.project(x + dx * (0.45 + t), y, z + dz * (0.45 + t), tmp);
        ctx.beginPath();
        ctx.arc(tmp[0]!, tmp[1]!, k === 12 ? 6 : 3.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      // The power meter: an arc round the puck.
      const rr = 26;
      ctx.lineWidth = 6;
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(20,22,36,0.55)";
      ctx.beginPath();
      ctx.arc(sx, sy, rr, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, rr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * pw));
      ctx.stroke();
    }
    // The tally: each scoring puck's points rise off it.
    ctx.font = "900 22px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 2 * PER; i++) {
      const t0 = pops[i]!;
      if (!t0 || engine.time < t0) continue;
      const u = Math.min(1, (engine.time - t0) / 0.5);
      dio.project(g.w.x[i]!, BY + PH, g.w.z[i]!, tmp);
      const yy = tmp[1]! - 18 - 22 * u;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#1f2433";
      ctx.fillStyle = i < PER ? P.you : P.bot;
      ctx.strokeText("+" + g.pts[i], tmp[0]!, yy);
      ctx.fillText("+" + g.pts[i], tmp[0]!, yy);
    }
    if (toastT > 0) {
      const W = dio.width, a = Math.min(1, toastT * 3), y = Math.max(V[3]! + 30, dio.height * 0.3);
      ctx.globalAlpha = a;
      ctx.font = "900 34px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
      ctx.lineWidth = 8;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1f2433";
      ctx.fillStyle = toastC;
      ctx.strokeText(toastS, W / 2, y);
      ctx.fillText(toastS, W / 2, y);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the HUD (DOM, written only when it changes) ----
  const last: unknown[] = [];
  const set = (i: number, v: unknown) => (last[i] === v ? false : ((last[i] = v), true));
  function hudWrite() {
    const me = shooter(g) === 0, ph = g.phase;
    const t = ph === OVER ? "Game over" : ph === TALLY ? "The count" : ph === ROLL ? (me ? "Sliding…" : "Bot slides…") : me ? "Your shot" : "Bot's shot";
    if (set(0, t)) (turnEl.textContent = t), turnEl.classList.toggle("ss-them", !me && ph < TALLY);
    if (set(1, g.score[0])) nums[0]!.textContent = "" + g.score[0];
    if (set(2, g.score[1])) nums[1]!.textContent = "" + g.score[1];
    if (set(3, g.round)) nums[2]!.textContent = "" + g.round;
    let left = PER;
    for (let i = 0; i < PER; i++) left -= g.out[i]!;
    const h = ph === AIM && me ? `Drag back from your puck, let go to slide it · ${left} left` : ph === AIM ? "The bot lines up its shot" : ph === TALLY ? "Furthest puck scores: every one past the other side's best" : ph === OVER ? "" : "Zones 1 · 2 · 3, and 4 hanging off the edge";
    if (set(4, h)) hintEl.textContent = h;
    const v = VIEWS[(view + (portrait() ? 1 : 0)) % 2]!;
    if (set(5, v)) (viewK!.textContent = "VIEW · " + v), viewK!.setAttribute("aria-label", `Camera view: ${v.toLowerCase()} (V)`);
    if (ph === TALLY && toastT > 0) say(toastS === "NO SCORE" ? "No score this round" : `${toastS}. You ${g.score[0]}, bot ${g.score[1]}`);
    else if (ph === AIM && me && ready) say(`Your shot, round ${g.round}`);
  }

  // ---- the frame ----
  function posePucks() {
    const t = engine.time;
    let moving = false;
    for (let i = 0; i < 2 * PER; i++) {
      const ob = pucks[i]!, o = i * 3;
      if (g.out[i]) {
        // On the physics: the gutter (and its shadow) once it dropped off the board.
        const down = g.w.y[i]! < -0.05;
        if (down && ob.on !== "gutter") dio.on(ob, "gutter");
        g.w.apply(i, ob, down ? GUTTER : 0);
        AT[o] = g.w.x[i]!; AT[o + 1] = BY + g.w.y[i]! + PH; AT[o + 2] = g.w.z[i]!;
        continue;
      }
      rackPos(i, tmp);
      if (V0[i]! >= 0) {
        const u = Math.max(0, Math.min(1, (t - V0[i]!) / VD[i]!)), e = u * u * (3 - 2 * u);
        for (let k = 0; k < 3; k++) VP[o + k] = VF[o + k]! + (tmp[k]! - VF[o + k]!) * e;
        VP[o + 1] = VP[o + 1]! + Math.sin(Math.PI * u) * 1.1;
        if (u >= 1) V0[i] = -1;
        else moving = true;
      } else VP.set(tmp, o);
      ob.pos[0] = VP[o]!; ob.pos[1] = VP[o + 1]!; ob.pos[2] = VP[o + 2]!;
      AT[o] = VP[o]!; AT[o + 1] = BY + VP[o + 1]! + PH; AT[o + 2] = VP[o + 2]!;
    }
    return moving;
  }
  let trailTick = 0;
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!];
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = viewK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(-1, true);
      }
    },
    step(e, dt) {
      let moving = false;
      for (let k = 0; k < 8; k++) {
        if (!TF[k] || e.time < TT[k]!) continue;
        const w = TF[k];
        TF[k] = 0;
        moving = true;
        if (w === T_TURN) setTurnReady();
        else if (w === T_BOTGO) fire(botA, botL);
        else if (w === T_POP) tallyToast();
        else if (w === T_NEXT) next();
        else if (w === T_END) showEnd();
        else if (w === T_POSTER) fire(32, 168);
      }
      if (g.phase === ROLL) {
        moving = true;
        if (!g.w.step(dt)) afterShot();
        else if (!RM && ++trailTick % 2 === 0)
          for (let i = 0; i < 2 * PER; i++) {
            if (!g.out[i] || g.w.state[i] !== 1) continue;
            const vx = g.w.vx[i]!, vz = g.w.vz[i]!;
            if (vx * vx + vz * vz > 0.5 && g.w.y[i]! > -0.01) spawn(0, g.w.x[i]! - vx * 0.03, 0.01, g.w.z[i]! - vz * 0.03, 0, 0, 0, 0.55, R * 0.85);
          }
      }
      if (stepFx(dt)) moving = true;
      if (stepCam(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      for (let i = 0; i < 2 * PER; i++) if (pops[i]! && e.time < pops[i]! + 0.6) moving = true;
      if (g.phase === AIM && shooter(g) === 1 && ready && e.time < botT + 0.8) moving = true;
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (posePucks()) engine.busy(), (dirty = true);
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fxPoints(), dio.draw();
    },
  });

  // ---- input: drag back from the puck (press anywhere, pull), keys aim and shoot ----
  const ground = (x: number, y: number, out: Float64Array) => dio.ground(x, y, BY, out);
  const mine = () => g.phase === AIM && ready && shooter(g) === 0 && card.hidden;
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!mine() || !ground(e.offsetX, e.offsetY, press3)) return;
    play.setPointerCapture(e.pointerId);
    dragging = true;
    kbd = false;
    // The pull is from where you pressed: press anywhere, drag back.
    aim.begin(X0, 0, X0, 0);
    play.classList.add("ss-drag");
    dirty = true;
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!dragging || !ground(e.offsetX, e.offsetY, hit3)) return;
    aim.move(X0 + hit3[0]! - press3[0]!, hit3[2]! - press3[2]!);
    dirty = true;
    engine.busy();
    engine.wake();
  }, sig);
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    play.classList.remove("ss-drag");
    if (e.type === "pointerup" && aim.end()) {
      (kAngle = aim.angle), (kLevel = aim.level);
      fire(aim.angle, aim.level);
    } else aim.cancel();
    dirty = true;
    engine.wake();
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "v") return void (e.preventDefault(), cycleView());
    if (!mine()) return;
    // Down the lane (the lane runs up the screen): ←/→ aim, ↑/↓ power. From the side (the lane runs
    // left to right): ↑/↓ aim toward the far or near rail, ←/→ power.
    const lane = (view === 1) !== portrait(), ky = e.key, x = ky === "ArrowLeft" ? -1 : ky === "ArrowRight" ? 1 : 0, y = ky === "ArrowUp" ? 1 : ky === "ArrowDown" ? -1 : 0;
    const turnBy = (lane ? x : -y) * 6, powBy = (lane ? y : x) * 2;
    if (turnBy || powBy) {
      e.preventDefault();
      kbd = true;
      kAngle = Math.max(-260, Math.min(260, ((kAngle + 6144) % 4096) - 2048 + turnBy));
      kLevel = Math.max(10, Math.min(STEPS, kLevel + powBy));
      dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      kbd ? fire(kAngle, kLevel) : ((kbd = true), (dirty = true), engine.wake());
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): round 2, pucks on the board, one of yours on its way.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261108);
    poserRun = true;
    const spots = [6.95, 0.35, 5.3, -0.55, 7.55, -0.2, 4.9, 0.62];
    for (let n = 0; n < 4; n++) {
      const i = puckOf(g);
      g.w.place(i, spots[n * 2]!, spots[n * 2 + 1]!);
      g.out[i] = 1;
      V0[i] = -1;
      g.k++;
    }
    g.w.run();
    g.score[0] = 6;
    g.score[1] = 4;
    g.round = 2;
    poserRun = false;
    TF.fill(0);
    ready = true;
    V0.fill(-1);
    later(0.15, T_POSTER);
    hudDirty = dirty = true;
  }

  reset((engine.random() * 100000) | 0);
  engine.start();
  return {
    engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      return { phase: g.phase, turn: shooter(g), k: g.k, round: g.round, you: g.score[0]!, bot: g.score[1]!, aim: aim.active || kbd, ready, card: !card.hidden, view: VIEWS[(view + (portrait() ? 1 : 0)) % 2]! };
    },
    screen(x: number, z: number) {
      dio.project(x, BY, z, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a puck of yours mid-slide (scripts/gallery-posters.mjs). */
export const posterAt = 1.6;
