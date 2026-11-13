// "Flip Match": a memory game on a felt card table in the corner of a room. Sixteen cards are dealt
// in arcs from the deck into a four by four grid, face down. Turn two over (tap, or arrows and
// Enter): a pair lifts and flies to your pile with a sparkle, two that differ turn back down. Moves
// and time; find all eight pairs. The faces are painted by the piece (a die, a ship, a lighthouse, a
// cactus, a puck, a pie, a star, a wave: the other tabletop pieces' worlds). Light: a bright
// afternoon; dark: a lamp-lit night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/cards
// (the deck, the seeded shuffle, the deal, flips and moves in arcs, picking), @fzlt/core/diorama (the
// 3D), @fzlt/core/slot, @fzlt/core/sound. The game is ./model.ts, pure and seeded
// (tests/flip-match.test.mjs); this file is the scene and the controls (tests/flip-match.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { dioramaCards, type DioramaCards, type PileLayout } from "../../../../src/cards";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { CARDS, COLS, DECK, MISS, NO, PAIR, PAIRS, PILE, cardAt, cellOf, done, face, flip, newGame, newRound, settle, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
const LIGHT = {
  bg: "#f1e9df", floor: "#ddd4c8", rug: "#f3cdbf", rug2: "#f7dccf", wallB: "#d8e4f0", wallR: "#f6dcd2", wood: "#c69a6f", top: "#e0b88c", felt: "#8fd3b0", felt2: "#9bd9b9",
  lamp: "#7fcfa8", brass: "#e8c26a", bulb: "#fff3c8", mug: "#f08e6f", tea: "#9a6a4a", pot: "#e8a27f", leaf: "#93cf9f", leaf2: "#b6e0a9", shadow: "#3a2d3c",
  light: [0.5, 1, 0.45], amb: 0.54, glow: 0.1, night: false,
};
type Pal = typeof LIGHT;
const DARK: Pal = {
  ...LIGHT, bg: "#110e1c", floor: "#221d33", rug: "#33284a", rug2: "#3b2f55", wallB: "#1b2238", wallR: "#1e1a33", wood: "#6b4a3a", top: "#7d5a44", felt: "#1d5a55", felt2: "#22665f",
  lamp: "#2f8a72", brass: "#b48d3e", mug: "#a9505a", tea: "#4a3226", pot: "#7a4a52", leaf: "#3f6f63", leaf2: "#4e8473", shadow: "#000000",
  light: [0.35, 1, 0.55], amb: 0.42, glow: 0.26, night: true,
};
type Key = Exclude<keyof Pal, "light" | "amb" | "night" | "glow">;
/** The faces: name, the medallion's colour. */
const FACES: [string, string][] = [["DIE", "#f7c873"], ["SHIP", "#9fd3ec"], ["LIGHT", "#c9c3f0"], ["CACTUS", "#b6e0a9"], ["PUCK", "#d9dde8"], ["PIE", "#f0c3d8"], ["STAR", "#2f3a66"], ["WAVE", "#7fd0c9"]];
const INK = "#1f2433";
/** The table's top (the plinth) and the felt on it; the grid's cell pitch. */
const PT = 1.4, FH = 0.08, GX = 1.24, GZ = 1.64;
const PART = 160, PS = 9;
const T_SETTLE = 1, T_END = 2, T_POSTER = 3;

export type FlipScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { moves: number; found: number; up: number; busy: boolean; card: boolean; cursor: number };
  /** Cell i's centre on screen (CSS px from the stage's top left), as of the last draw. */
  cellScreen(i: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): FlipScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "fm-play";
  play.setAttribute("aria-label", "Flip Match: tap two cards to turn them over; or the arrow keys pick a card and Enter turns it (N new deal, M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "fm-hud";
  hud.innerHTML = `<div class="fm-head"><p class="fm-top"><b class="fm-chip fm-turn">Find the pairs</b><b class="fm-chip">Moves <span>0</span></b><b class="fm-chip">Pairs <span>0/8</span></b><b class="fm-chip fm-t">Time <span>0:00</span></b></p><p class="fm-hint"></p></div><p class="fm-live" aria-live="polite"></p><div class="fm-card" role="dialog" aria-label="All pairs found" hidden><b>All pairs!</b><p></p><button type="button" class="bui-key fm-again">DEAL AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, liveEl = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { flip: "flick", pair: "pair", miss: "miss", deal: "deal", win: "win" },
    notes: {
      flick: [[1500, 900, 0.035, 0, "triangle", 0.12]],
      deal: [[900, 500, 0.03, 0, "triangle", 0.06]],
      pair: [[660, 660, 0.07, 0, "triangle", 0.18], [990, 1320, 0.14, 0.06, "triangle", 0.16]],
      miss: [[300, 220, 0.12, 0, "triangle", 0.12]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_NEW = 1;
  const [muteK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "NEW DEAL", aria: "New deal (N)", id: K_NEW },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else deal(seed + 1);
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the game and the diorama ----
  const g: Game = newGame(1);
  let seed = 1, fxRnd = seeded(1), tall = false, feltZ = 0, lampX = 0, lampZ = 0, feltW = 1, feltD = 1;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, overlay: drawOverlay, get shadowColor() { return P.shadow; } });
  const keyed: DioramaObject[] = [], keyName: Key[] = [];
  const put = (d: DioramaObjectDef & { color?: Key }) => {
    const k = d.color as Key | undefined, ob = dio.add({ pick: false, ...d, color: k ? P[k] : undefined });
    if (k) keyed.push(ob), keyName.push(k);
    return ob;
  };
  // The piles: the deck, the sixteen cells, your pile. Their places change with the stage's shape.
  const lay: PileLayout[] = [];
  for (let p = 0; p <= PILE; p++) lay.push({ type: "stack", x: 0, z: 0 });
  let dc!: DioramaCards, sparks!: DioramaPoints;
  const fx = new Float64Array(PART * PS);

  function layout() {
    // The grid, centred (wide) or nudged up (tall); the deck and your pile at its sides, or under it.
    const oz = tall ? -0.9 : 0;
    for (let i = 0; i < CARDS; i++) {
      const L = lay[i + 1]!;
      L.x = ((i % COLS) - 1.5) * GX;
      L.z = ((i / COLS) | 0) * GZ - 1.5 * GZ + oz;
    }
    Object.assign(lay[DECK]!, tall ? { x: -1.6, z: 3.75, a: -0.08 } : { x: -4.2, z: 0.4, a: -0.12 });
    Object.assign(lay[PILE]!, tall ? { x: 1.6, z: 3.75, a: 0.1 } : { x: 4.2, z: 0.4, a: 0.1 });
  }

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = 0;
    layout();
    const fw = tall ? 6.8 : 11.4, fd = tall ? 10.2 : 7.8;
    feltZ = tall ? 0.15 : 0;
    (feltW = fw), (feltD = fd);
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    put({ id: "floor", size: [44, 0.5, 30], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
    put({ size: [44.6, 12, 0.5], pos: [0, -0.5, -15.25], color: "wallB", cluster: "room", layer: 0.3 });
    put({ size: [0.5, 12, 30], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3 });
    put({ id: "rug", size: [fw + 9, 0.05, fd + 8], on: "floor", pos: [0, 0, feltZ], color: "rug", layer: 0.2 });
    put({ size: [fw + 7.6, 0.02, fd + 6.6], on: "rug", color: "rug2", layer: 0.21 });
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.25, size: [2, 1.7, 2], pos: [16, 0, -11], color: "pot", cluster: "room", layer: 1, shadow: 0.2, on: "floor" });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.4, size: [3.4, 2.6, 3.4], on: "pot", color: "leaf", layer: 1 });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [2.4, 2.4, 2.4], on: "leaf", color: "leaf2", layer: 1 });
    // The table: a wooden plinth, its top, a padded rail, the felt.
    put({ id: "plinth", size: [fw + 1.4, PT - 0.16, fd + 1.4], on: "floor", pos: [0, 0, feltZ], color: "wood", cluster: "table", layer: 0, shadow: 0.24 });
    put({ id: "top", size: [fw + 1.8, 0.16, fd + 1.8], on: "plinth", color: "top", layer: 0.4 });
    put({ id: "felt", size: [fw, FH, fd], on: "top", color: "felt", layer: 1 });
    dio.decal("table", 1.5, feltArt);
    // A lamp on the far corner (its shade glows at night) and a mug by your pile.
    const lx = tall ? fw / 2 + 0.25 : -fw / 2 - 0.45, lz = tall ? -fd / 2 - 0.25 : -fd / 2 + 1.2;
    (lampX = lx), (lampZ = lz);
    dio.cluster("lamp", { at: [lx, PT + 1, feltZ + lz] });
    put({ id: "lb", shape: "cyl", sides: 10, size: [1, 0.16, 1], on: "top", pos: [lx, 0, lz], color: "brass", cluster: "lamp", shadow: 0.25 });
    put({ id: "ls", size: [0.12, 1.5, 0.12], on: "lb", color: "brass" });
    put({ id: "lh", shape: "cyl", sides: 12, top: 0.55, size: [1.5, 0.55, 0.8], on: "ls", pos: [0, -0.1, 0], rot: [0, 0.6, 0], color: "lamp" });
    put({ shape: "cyl", sides: 10, size: [0.5, 0.06, 0.3], on: "lh", pos: [0, -0.62, 0], rot: [0, 0.6, 0], color: "bulb", emissive: true });
    const mx = tall ? fw / 2 - 0.6 : fw / 2 + 0.35, mz = tall ? fd / 2 + 0.45 : fd / 2 - 0.4;
    dio.cluster("mug", { at: [mx, PT + 0.4, feltZ + mz] });
    put({ id: "mug", shape: "cyl", sides: 12, size: [0.6, 0.7, 0.6], on: "top", pos: [mx, 0, mz], color: "mug", cluster: "mug", shadow: 0.25 });
    put({ shape: "cyl", sides: 12, size: [0.48, 0.02, 0.48], on: "mug", pos: [0, -0.1, 0], color: "tea" });
    put({ size: [0.1, 0.36, 0.3], on: "mug", pos: [0.34, -0.55, 0], color: "mug" });
    // The cards, on the felt, and the sparkles over everything.
    dc = dioramaCards(dio, g.k, { on: "felt", size: [1, 1.4], thick: 0.02, piles: lay, face: paintFace, back: paintBack, color: "#f6efe0", dur: 0.42, stagger: 0.08, arc: 1.1, motion: !RM });
    sparks = dio.points({ cap: PART, paint: star });
  }

  // ---- the art: faces, back, felt ----
  function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function stroke(ctx: CanvasRenderingContext2D) {
    ctx.fill();
    ctx.stroke();
  }
  function paintFace(ctx: CanvasRenderingContext2D, c: number) {
    const f = face(c), [name, tint] = FACES[f]!;
    ctx.fillStyle = "#fbf5e9";
    ctx.fillRect(0, 0, 100, 140);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // The medallion.
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(50, 60, 36, 0, TAU);
    stroke(ctx);
    ctx.save();
    ctx.translate(50, 60);
    icon(ctx, f);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = "800 13px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, 50, 122);
    ctx.lineWidth = 2;
    rr(ctx, 6, 6, 88, 128, 8);
    ctx.stroke();
  }
  function poly(ctx: CanvasRenderingContext2D, pts: number[], fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i]!, pts[i + 1]!) : ctx.moveTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    stroke(ctx);
  }
  function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    stroke(ctx);
  }
  /** Face f's icon, about 50 px across, centred on the origin. */
  function icon(ctx: CanvasRenderingContext2D, f: number) {
    switch (f) {
      case 0: // a die, a little turned, showing five
        ctx.rotate(-0.2);
        ctx.fillStyle = "#ffffff";
        rr(ctx, -20, -20, 40, 40, 8);
        stroke(ctx);
        ctx.fillStyle = INK;
        for (const [x, y] of [[-10, -10], [10, -10], [0, 0], [-10, 10], [10, 10]]) ctx.beginPath(), ctx.arc(x!, y!, 3.6, 0, TAU), ctx.fill();
        break;
      case 1: // a ship on a wave
        poly(ctx, [-6, -26, -6, -6, 12, -6], "#ffffff");
        poly(ctx, [-24, 0, 24, 0, 16, 12, -18, 12], "#f08e6f");
        ctx.fillStyle = "#ffffff";
        rr(ctx, -12, -8, 14, 8, 2);
        stroke(ctx);
        ctx.beginPath();
        ctx.moveTo(-28, 20);
        ctx.quadraticCurveTo(-14, 13, 0, 20);
        ctx.quadraticCurveTo(14, 27, 28, 20);
        ctx.stroke();
        break;
      case 2: // a lighthouse
        poly(ctx, [-11, 26, 11, 26, 7, -12, -7, -12], "#ffffff");
        ctx.fillStyle = "#ee8270";
        ctx.beginPath();
        ctx.moveTo(-9.5, 14), ctx.lineTo(9.5, 14), ctx.lineTo(8.5, 4), ctx.lineTo(-8.5, 4), ctx.closePath(), ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7.8, -2), ctx.lineTo(7.8, -2), ctx.lineTo(7.2, -8), ctx.lineTo(-7.2, -8), ctx.closePath(), ctx.fill();
        poly(ctx, [-11, 26, 11, 26, 7, -12, -7, -12], "rgba(0,0,0,0)");
        ctx.fillStyle = "#ffe7a0";
        rr(ctx, -6, -21, 12, 9, 2);
        stroke(ctx);
        poly(ctx, [-9, -21, 9, -21, 0, -30], "#ee8270");
        ctx.globalAlpha = 0.55;
        poly(ctx, [7, -18, 30, -26, 30, -10], "#fff3c4");
        ctx.globalAlpha = 1;
        break;
      case 3: // a cactus in a pot
        ctx.fillStyle = "#6fbf7a";
        rr(ctx, -7, -26, 14, 40, 7);
        stroke(ctx);
        rr(ctx, -21, -12, 10, 18, 5);
        stroke(ctx);
        rr(ctx, 11, -18, 10, 16, 5);
        stroke(ctx);
        ctx.beginPath();
        ctx.moveTo(-11, 2), ctx.lineTo(-7, 2), ctx.moveTo(11, -6), ctx.lineTo(7, -6);
        ctx.stroke();
        poly(ctx, [-14, 12, 14, 12, 10, 28, -10, 28], "#e39a74");
        break;
      case 4: // a puck, side on
        ctx.fillStyle = "#c8ccd8";
        ctx.beginPath();
        ctx.ellipse(0, 8, 24, 10, 0, 0, Math.PI);
        ctx.lineTo(-24, -2);
        ctx.ellipse(0, -2, 24, 10, 0, Math.PI, 0, true);
        ctx.closePath();
        stroke(ctx);
        ctx.fillStyle = "#e4e7ee";
        ctx.beginPath();
        ctx.ellipse(0, -2, 24, 10, 0, 0, TAU);
        stroke(ctx);
        ctx.fillStyle = "#f07f68";
        ctx.beginPath();
        ctx.ellipse(0, -2, 17, 7, 0, 0, TAU);
        stroke(ctx);
        break;
      case 5: // a pie with a slice out
        ctx.fillStyle = "#e7b06a";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 25, -0.3, Math.PI * 1.65);
        ctx.closePath();
        stroke(ctx);
        ctx.fillStyle = "#c2563f";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 18, -0.3, Math.PI * 1.65);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#f2cf8f";
        for (let k = -12; k <= 12; k += 8) ctx.beginPath(), ctx.moveTo(k, -15), ctx.lineTo(k + 4, 15), ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.5;
        poly(ctx, [6, -4, 30, -14, 30, 4], "#e7b06a");
        break;
      case 6: // a star in the night
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU - Math.PI / 2, r = k & 1 ? 10 : 24;
          k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = "#ffd36b";
        stroke(ctx);
        ctx.fillStyle = "#ffffff";
        for (const [x, y] of [[-24, -18], [22, 16], [20, -22]]) ctx.beginPath(), ctx.arc(x!, y!, 2, 0, TAU), ctx.fill();
        break;
      default: // a curling wave
        ctx.fillStyle = "#3f8aac";
        ctx.beginPath();
        ctx.moveTo(-28, 22);
        ctx.bezierCurveTo(-24, -6, -6, -26, 14, -20);
        ctx.bezierCurveTo(26, -16, 26, -2, 16, -2);
        ctx.bezierCurveTo(8, -2, 6, -10, 12, -12);
        ctx.bezierCurveTo(-4, -12, -6, 10, 28, 22);
        ctx.closePath();
        stroke(ctx);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-18, 10);
        ctx.quadraticCurveTo(-12, -8, 4, -14);
        ctx.stroke();
    }
  }
  function paintBack(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#3b4a8f";
    ctx.fillRect(0, 0, 100, 140);
    ctx.strokeStyle = "#f6e7c4";
    ctx.lineWidth = 3;
    rr(ctx, 8, 8, 84, 124, 7);
    ctx.stroke();
    // A lattice of diamonds, then a medallion: two little cards, one face up.
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = -140; k < 140; k += 16) ctx.moveTo(k, 0), ctx.lineTo(k + 140, 140), ctx.moveTo(k + 140, 0), ctx.lineTo(k, 140);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f6e7c4";
    ctx.beginPath();
    ctx.arc(50, 70, 21, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.save();
    ctx.translate(50, 70);
    ctx.rotate(-0.25);
    ctx.fillStyle = "#3b4a8f";
    rr(ctx, -13, -11, 13, 19, 2.5);
    stroke(ctx);
    ctx.rotate(0.5);
    ctx.fillStyle = "#ffffff";
    rr(ctx, 0, -11, 13, 19, 2.5);
    stroke(ctx);
    ctx.fillStyle = "#f08e6f";
    ctx.beginPath();
    ctx.arc(6.5, -1.5, 3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const tmp = new Float64Array(3), S = new Float64Array(8);
  /** The felt's quad from (x0, z0) to (x1, z1) (felt coordinates) as a path. */
  function quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number) {
    const y = PT + FH + 0.002;
    dio.project(x0, y, z0 + feltZ, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
    dio.project(x1, y, z0 + feltZ, tmp), (S[2] = tmp[0]!), (S[3] = tmp[1]!);
    dio.project(x1, y, z1 + feltZ, tmp), (S[4] = tmp[0]!), (S[5] = tmp[1]!);
    dio.project(x0, y, z1 + feltZ, tmp), (S[6] = tmp[0]!), (S[7] = tmp[1]!);
    ctx.beginPath();
    ctx.moveTo(S[0]!, S[1]!);
    for (let k = 2; k < 8; k += 2) ctx.lineTo(S[k]!, S[k + 1]!);
    ctx.closePath();
  }
  /** A 20-sided ring of radius r round (x, z) on the felt, clipped to the felt by the caller's eye. */
  function ring(ctx: CanvasRenderingContext2D, x: number, z: number, r: number) {
    const y = PT + FH + 0.002;
    ctx.beginPath();
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU;
      dio.project(x + Math.cos(a) * r, y, z + feltZ + Math.sin(a) * r * 0.9, tmp);
      k ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
    }
    ctx.closePath();
  }
  function feltArt(ctx: CanvasRenderingContext2D) {
    // Chalk-thin outlines where the cells, the deck and your pile go; the lamp's pool at night.
    ctx.strokeStyle = P.night ? "rgba(190,255,235,0.22)" : "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    for (let p = 0; p <= PILE; p++) {
      const l = lay[p]!, x = l.x!, z = l.z!;
      quad(ctx, x - 0.56, z - 0.76, x + 0.56, z + 0.76);
      ctx.stroke();
    }
    if (P.night) {
      ctx.fillStyle = "#ffe2a8";
      ctx.globalAlpha = P.glow * 0.5;
      // Soft rings of light under the lamp, fading out across the felt.
      ctx.save();
      quad(ctx, -feltW / 2, -feltD / 2, feltW / 2, feltD / 2);
      ctx.clip();
      for (let k = 0; k < 4; k++) ring(ctx, lampX, lampZ, 2.2 + k * 1.5), ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  const star = (ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) => {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(1.5, p.sr[i]!), q = r * 0.28;
    ctx.fillStyle = p.color[i] || "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y - r), ctx.lineTo(x + q, y - q), ctx.lineTo(x + r, y), ctx.lineTo(x + q, y + q);
    ctx.lineTo(x, y + r), ctx.lineTo(x - q, y + q), ctx.lineTo(x - r, y), ctx.lineTo(x - q, y - q);
    ctx.fill();
  };

  // ---- sparkles ----
  const SPK = ["#ffffff", "#ffd36b", "#9fe7ff", "#ffb3c7"];
  function burst(x: number, z: number, n: number, up: number) {
    for (let j = 0; j < n; j++)
      for (let k = 0; k < PART; k++) {
        const o = k * PS;
        if (fx[o + 6]! > 0) continue;
        const a = fxRnd() * TAU, s = 0.6 + fxRnd() * 1.8;
        fx[o] = x; fx[o + 1] = PT + 0.3 + fxRnd() * 0.4; fx[o + 2] = z + feltZ;
        fx[o + 3] = Math.cos(a) * s; fx[o + 4] = up + fxRnd() * 2; fx[o + 5] = Math.sin(a) * s;
        fx[o + 6] = fx[o + 7] = 0.6 + fxRnd() * 0.5; fx[o + 8] = (fxRnd() * 4) | 0;
        break;
      }
    engine.busy(1.2);
  }
  function stepFx(dt: number) {
    let any = false;
    for (let k = 0; k < PART; k++) {
      const o = k * PS;
      if (fx[o + 6]! <= 0) continue;
      any = true;
      fx[o + 6] = fx[o + 6]! - dt;
      fx[o] = fx[o]! + fx[o + 3]! * dt; fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt; fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt;
      fx[o + 4] = fx[o + 4]! - dt * 4;
      fx[o + 3] = fx[o + 3]! * 0.97; fx[o + 5] = fx[o + 5]! * 0.97;
    }
    return any;
  }
  function fxPoints() {
    let n = 0;
    for (let k = 0; k < PART; k++) {
      const o = k * PS, life = fx[o + 6]!;
      if (life <= 0) continue;
      const u = life / fx[o + 7]!;
      sparks.x[n] = fx[o]!; sparks.y[n] = fx[o + 1]!; sparks.z[n] = fx[o + 2]!;
      sparks.r[n] = 0.11 * (0.4 + Math.sin(u * Math.PI) * 0.8);
      sparks.a[n] = Math.min(1, u * 2);
      sparks.color[n] = SPK[fx[o + 8]!]!;
      n++;
    }
    sparks.n = n;
  }

  // ---- state ----
  const TT = new Float64Array(4), TF = new Uint8Array(4);
  let cursor = 5, kbd = false, t0 = -1, tEnd = 0, toastT = 0, toastS = "", toastX = 0, toastY = 0, dirty = true, hudDirty = true, said = "";
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
    for (let k = 0; k < 4; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05), engine.wake());
  }
  /** A new deal from seed `s`: the cards come back to the deck if they are out, shuffle, deal in arcs. */
  function deal(s: number) {
    seed = s >>> 0;
    fxRnd = seeded(seed * 17 + 3);
    TF.fill(0);
    newRound(g, seed);
    t0 = -1;
    tEnd = 0;
    toastT = 0;
    card.hidden = true;
    engine.events.emit("deal");
    engine.busy(2.4);
    hudDirty = dirty = true;
    engine.wake();
  }
  const mmss = (s: number) => `${(s / 60) | 0}:${("0" + ((s | 0) % 60)).slice(-2)}`;
  const elapsed = () => (t0 < 0 ? 0 : (tEnd || engine.time) - t0);
  function turn(i: number) {
    if (!card.hidden) return;
    const r = flip(g, i);
    if (r === NO) return;
    if (t0 < 0) t0 = engine.time;
    engine.events.emit("flip");
    if (r === PAIR || r === MISS) later(r === PAIR ? 0.6 : 1.05, T_SETTLE);
    hudDirty = dirty = true;
    engine.busy(0.6);
    engine.wake();
  }
  function resolve() {
    const a = g.a, b = g.b, r = settle(g);
    if (r === PAIR) {
      for (const c of [a, b]) {
        dc.pose(c, tmp);
        burst(tmp[0]!, tmp[2]!, 14, 1.6);
      }
      dc.pose(a, tmp);
      dio.project(tmp[0]!, PT + 0.6, tmp[2]! + feltZ, tmp);
      (toastS = FACES[face(a)]![0] + "!"), (toastX = tmp[0]!), (toastY = tmp[1]!), (toastT = 0.9);
      engine.events.emit("pair");
      if (done(g)) later(0.55, T_END);
    } else engine.events.emit("miss");
    hudDirty = dirty = true;
    engine.busy(0.8);
  }
  function showEnd() {
    tEnd = engine.time;
    (card.children[1] as HTMLElement).textContent = `${PAIRS} pairs in ${g.moves} moves · ${mmss(elapsed())}`;
    card.hidden = false;
    for (let k = 0; k < 4; k++) burst(lay[PILE]!.x!, lay[PILE]!.z!, 12, 2.6 + k * 0.4);
    engine.events.emit("win");
    say(`All pairs found in ${g.moves} moves`);
    hudDirty = true;
    again.focus({ preventScroll: true });
  }
  const say = (s: string) => s !== said && ((said = s), (liveEl.textContent = s));

  // ---- the camera ----
  const goal = { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: PT, tz: 0, ox: 0, oy: 0, fov: 0.42 };
  function setView() {
    const c = goal, W = dio.width, H = dio.height;
    (c.yaw = (tall ? -10 : -18) * D), (c.pitch = (tall ? 58 : 50) * D), (c.tx = 0), (c.ty = PT), (c.tz = feltZ);
    const pts: number[] = [];
    const ex = tall ? 3.1 : 4.95, z0 = tall ? -4.25 : -3.35, z1 = tall ? 4.6 : 3.35;
    for (const x of [-ex, ex]) for (const z of [z0, z1]) pts.push(x, PT + 0.1, z + feltZ);
    pts.push(0, PT + 1.4, z0 + feltZ);
    dio.fit(c, pts, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    Object.assign(dio.cam, c);
    hudDirty = dirty = true;
  }

  // ---- the overlay: the keyboard's cursor, the pair's name, a hint of the time ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (kbd && card.hidden) {
      const l = lay[cursor + 1]!;
      quad(ctx, l.x! - 0.62, l.z! - 0.82, l.x! + 0.62, l.z! + 0.82);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    if (toastT > 0) {
      const u = 1 - toastT / 0.9;
      ctx.globalAlpha = Math.min(1, toastT * 4);
      ctx.font = "900 26px ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 7;
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.fillStyle = "#ffd36b";
      ctx.strokeText(toastS, toastX, toastY - u * 26);
      ctx.fillText(toastS, toastX, toastY - u * 26);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the HUD ----
  const last: unknown[] = [];
  const set = (i: number, v: unknown) => (last[i] === v ? false : ((last[i] = v), true));
  function hudWrite() {
    const t = !card.hidden ? "All pairs!" : g.b >= 0 ? (face(g.a) === face(g.b) ? "A pair!" : "No match") : g.a >= 0 ? "And its pair?" : "Find the pairs";
    if (set(0, t)) turnEl.textContent = t;
    if (set(1, g.moves)) nums[0]!.textContent = "" + g.moves;
    if (set(2, g.found)) nums[1]!.textContent = g.found + "/8";
    const tm = mmss(elapsed());
    if (set(3, tm)) nums[2]!.textContent = tm;
    const h = g.moves ? "Remember where they were: two that differ turn back" : "Tap two cards to turn them over";
    if (set(4, h)) hintEl.textContent = h;
    if (g.b >= 0) say(face(g.a) === face(g.b) ? `A pair: ${FACES[face(g.a)]![0].toLowerCase()}. ${g.found + 1} of 8` : `${FACES[face(g.a)]![0].toLowerCase()} and ${FACES[face(g.b)]![0].toLowerCase()}: no match`);
    else if (g.a >= 0) say(`${FACES[face(g.a)]![0].toLowerCase()}`);
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
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!];
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kb = stage.querySelector(".gk-bar .gk:last-child")!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kb.bottom > sr.bottom - 24 ? sr.bottom - kb.top + 6 : 6;
        const t = sr.width / Math.max(1, sr.height) < 1.2;
        if (t !== tall) (tall = t), buildScene(), dc.show(engine.time);
        setView();
      }
    },
    step(e, dt) {
      let moving = false;
      for (let k = 0; k < 4; k++) {
        if (!TF[k] || e.time < TT[k]!) continue;
        const w = TF[k];
        TF[k] = 0;
        moving = true;
        if (w === T_SETTLE) resolve();
        else if (w === T_END) showEnd();
        else if (w === T_POSTER) turn(posterCell);
      }
      if (stepFx(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (dc.show(engine.time)) engine.busy(), (dirty = true);
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fxPoints(), dio.draw();
    },
  });

  // ---- input: tap a card; arrows and Enter ----
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
  }, sig);
  play.addEventListener("pointerup", (e) => {
    const c = dc.pick(e.offsetX, e.offsetY), i = c < 0 ? -1 : cellOf(g, c);
    kbd = false;
    if (i >= 0) (cursor = i), turn(i);
    else if (g.b >= 0) resolveNow();
    dirty = true;
    engine.wake();
  }, sig);
  /** Two up and a tap elsewhere (or a third card): settle the go now. */
  function resolveNow() {
    for (let k = 0; k < 4; k++) if (TF[k] === T_SETTLE) TF[k] = 0;
    resolve();
  }
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "n") return void (e.preventDefault(), deal(seed + 1));
    if (!card.hidden) return;
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, dz = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (dx || dz) {
      e.preventDefault();
      kbd = true;
      const x = Math.max(0, Math.min(COLS - 1, (cursor % COLS) + dx)), z = Math.max(0, Math.min(3, ((cursor / COLS) | 0) + dz));
      cursor = z * COLS + x;
      dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      if (!kbd) return void ((kbd = true), (dirty = true), engine.wake());
      if (g.b >= 0) resolveNow();
      if (cardAt(g, cursor) >= 0) turn(cursor);
    }
  }, sig);
  again.addEventListener("click", () => (deal(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): a few pairs found, one card up, its pair turning over.
  let posterCell = -1;
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    newRound(g, 20261110);
    // Find three pairs, then turn one card and send its pair over.
    let n = 0;
    for (let f = 0; f < PAIRS && n < 4; f++) {
      const a = cellOf(g, f * 2), b = cellOf(g, f * 2 + 1);
      if (n < 3) flip(g, a), flip(g, b), settle(g);
      else flip(g, a), (posterCell = b);
      n++;
    }
    g.moves = 5;
    t0 = engine.time - 47;
    buildScene();
    dc.show(engine.time);
    later(0.3, T_POSTER);
    hudDirty = dirty = true;
  }

  // The first deal: every card in the deck (laid there at once), then shuffled and dealt in arcs.
  const r0 = stage.getBoundingClientRect();
  tall = r0.width / Math.max(1, r0.height) < 1.2;
  g.k.reset();
  buildScene();
  dc.show(0);
  deal((engine.random() * 100000) | 0);
  engine.start();
  return {
    engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      let busy = false;
      for (let k = 0; k < 4; k++) if (TF[k]) busy = true;
      return { moves: g.moves, found: g.found, up: (g.a >= 0 ? 1 : 0) + (g.b >= 0 ? 1 : 0), busy, card: !card.hidden, cursor };
    },
    cellScreen(i: number) {
      const l = lay[i + 1]!;
      dio.project(l.x!, PT + FH + 0.03, l.z! + feltZ, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: three pairs in your pile, a card up and its pair turning (scripts/gallery-posters.mjs). */
export const posterAt = 0.55;
