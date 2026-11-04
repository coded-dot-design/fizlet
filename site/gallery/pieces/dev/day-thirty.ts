// "Day 1 → Day 30" (dev-humor): the Origin desk, seen from above, as a project ages. Tap for the
// next day, hold to fast-forward. Day 1 is new-project energy: a tidy desk, an upright chair, an
// all-green screen, one coffee. Then the cups land and knock each other across the desk (each
// leaves a ring), red lines creep up the screen, sticky notes slap onto the lid, the plant wilts,
// the chair turns into a beanbag and he slumps, and our own status sticker reads the mood. Day 30
// holds (a candle is lit); a tap ships it (confetti) and it is Day 1 again.
// Art: the Origin scene's own shapes and 2015 palette (site/demos/origin/shapes.ts: the torso, chair,
// cap, two-bone arms, laptop lid and screen code, plant, cup and notebook), drawn on one canvas.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back byte for byte),
// @fzlt/core/slot, @fzlt/core/sound; the rig is the surf minis' kit (../surf/kit.ts). The days are
// `deskRot()`: plain numbers, no DOM (tests/dev-humor.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C as O, CAP, CHAIR, CODE, LIDP, SCR, TORSO, armD, brew, hands, head, neck } from "../../../demos/origin/shapes";
import { C, caption, drawWords, DEMO, DONE, FONT, IDLE, NUM, PLAY, rig, spray, TAU, words, type Pad } from "../surf/kit";

export const LAST = 30;
/** Cups and notes the desk can hold; rings it remembers. */
export const CUPN = 16, NOTEN = 14, RINGN = 24, CR = 26;
// State slots.
const MODE = 0, T = 1, DAY = 2, GOAL = 3, HOLD = 4, AT = 5, CARD = 6, CUPS = 7, NOTES = 8, RINGS = 9, LIT = 10, SHIPS = 11;
/** Events this step: a new day, a cup lands, a note slaps on, day 30, shipped, a fresh start. */
export const EV_DAY = 0, EV_CUP = 1, EV_NOTE = 2, EV_LAST = 3, EV_SHIP = 4, EV_FRESH = 5;
const WORDS = ["SHIPPED!", "NEW PROJECT!", "DAY 30"];
/** How many cups and notes a day has earned. */
export const cupsFor = (d: number) => Math.min(CUPN, 1 + Math.floor((d - 1) * 0.55));
export const notesFor = (d: number) => Math.min(NOTEN, Math.max(0, Math.floor((d - 2) / 2)));
/** Where the laptop is (its base and lid, Origin art units): cups slide off it. */
const LAP = [281, 156, 519, 386] as const, BODY = [290, 392, 510, 560] as const, DESK = [52, 140, 748, 494] as const;
/** The first cup: Origin's own, on its saucer. */
export const HOME = [246, 326] as const;
/** Where the candle goes on day 30 (cups keep clear of it). */
const CANDLE = [205, 266] as const;

export function deskRot(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(16), ev = new Uint8Array(6);
  // Cups: position, velocity, height (z) and its speed, handle angle, age.
  const X = new Float64Array(CUPN), Y = new Float64Array(CUPN), VX = new Float64Array(CUPN), VY = new Float64Array(CUPN), Z = new Float64Array(CUPN), VZ = new Float64Array(CUPN), A = new Float64Array(CUPN), AGE = new Float64Array(CUPN);
  const NAGE = new Float64Array(NOTEN), RX = new Float64Array(RINGN), RY = new Float64Array(RINGN), RA = new Float64Array(RINGN);
  const sp = spray(160, R), wd = words(WORDS);
  function fresh() {
    (S[DAY] = 1), (S[GOAL] = 1), (S[NOTES] = 0), (S[RINGS] = 0), (S[CUPS] = 1), (S[LIT] = 0), (S[AT] = 0);
    (X[0] = HOME[0]), (Y[0] = HOME[1]), (VX[0] = VY[0] = Z[0] = VZ[0] = 0), (A[0] = Math.PI), (AGE[0] = 9);
    RA.fill(0), NAGE.fill(9);
  }
  fresh();
  S[MODE] = demo ? DEMO : IDLE;
  /** A new cup drops in from above, somewhere on the desk that isn't the laptop or him. */
  function addCup() {
    const i = S[CUPS]! | 0;
    let x = 0, y = 0;
    for (let k = 0; k < 12; k++) {
      (x = DESK[0] + CR + R() * (DESK[2] - DESK[0] - CR * 2)), (y = DESK[1] + 40 + R() * (DESK[3] - DESK[1] - 40 - CR));
      if (!(x > LAP[0] - CR && x < LAP[2] + CR && y < LAP[3] + CR) && !(x > BODY[0] - CR && x < BODY[2] + CR && y > BODY[1] - CR) && Math.hypot(x - CANDLE[0], y - CANDLE[1]) > CR + 24) break;
    }
    (X[i] = x), (Y[i] = y), (VX[i] = (R() - 0.5) * 40), (VY[i] = 0), (Z[i] = 1), (VZ[i] = 0), (A[i] = R() * TAU), (AGE[i] = 0);
    S[CUPS] = i + 1;
  }
  /** It lands: a ring where it stands, a clink, and everything it hits gets shoved. */
  function land(i: number) {
    const r = S[RINGS]! % RINGN;
    (RX[r] = X[i]!), (RY[r] = Y[i]!), (RA[r] = 1), (S[RINGS] = S[RINGS]! + 1);
    for (let j = 0; j < S[CUPS]!; j++) {
      if (j === i) continue;
      const dx = X[j]! - X[i]!, dy = Y[j]! - Y[i]!, d = Math.hypot(dx, dy) || 1;
      if (d < CR * 2.6) (VX[j] = VX[j]! + (dx / d) * 260 * (1 - d / (CR * 2.6) + 0.3)), (VY[j] = VY[j]! + (dy / d) * 260 * (1 - d / (CR * 2.6) + 0.3));
    }
    sp.burst(X[i]! * 0.2, Y[i]! * 0.2 - 12, 6, 30, -1.5708, 3, 1.2, 2);
    ev[EV_CUP] = 1;
  }
  function ship() {
    (S[MODE] = DONE), (S[CARD] = 0), (S[SHIPS] = S[SHIPS]! + 1);
    for (let k = 0; k < 5; k++) sp.burst(40 + k * 20, 40, 22, 120, -1.5708, 1.6, 2.4, k);
    wd.say(0, 80, 40, 0);
    ev[EV_SHIP] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    const at30 = S[GOAL]! >= LAST && S[DAY]! >= LAST - 0.02;
    if (presses > 0 && mode !== DONE) {
      if (mode === DEMO) fresh(), (mode = S[MODE] = PLAY), (S[HOLD] = 0), (S[GOAL] = 2);
      else if (at30) S[AT]! > 0.5 && ship(), (mode = S[MODE]!);
      else (mode = S[MODE] = PLAY), (S[GOAL] = Math.min(LAST, Math.floor(S[GOAL]!) + 1));
    }
    // Hold: fast-forward (after a beat, so a tap is one day).
    S[HOLD] = pad[0]! > 0 && mode === PLAY ? S[HOLD]! + dt : 0;
    if (S[HOLD]! > 0.3) S[GOAL] = Math.min(LAST, S[GOAL]! + dt * 7);
    // The attract run: two weeks in a blur, a beat, then back to day one.
    if (mode === DEMO) {
      const t = S[T]!;
      if (t > 0.5 && t < 3.3) S[GOAL] = Math.min(13, 1 + (t - 0.5) * 4.5);
      if (t > 4.2) fresh(), (S[MODE] = mode = IDLE), wd.say(1, 80, 50, 1), (ev[EV_FRESH] = 1);
    }
    // The day walks to the goal (fast when far behind), one day's work at a time.
    const day0 = S[DAY]!;
    if (S[DAY]! < S[GOAL]!) S[DAY] = Math.min(S[GOAL]!, S[DAY]! + dt * Math.max(4, (S[GOAL]! - S[DAY]!) * 8));
    if ((S[DAY]! | 0) > (day0 | 0)) {
      const d = S[DAY]! | 0;
      ev[EV_DAY] = 1;
      while (S[CUPS]! < cupsFor(d)) addCup();
      for (let n = S[NOTES]! | 0; n < notesFor(d); n++) (NAGE[n] = 0), (ev[EV_NOTE] = 1);
      S[NOTES] = Math.max(S[NOTES]!, notesFor(d));
      if (d === LAST) (S[LIT] = 0.001), (ev[EV_LAST] = 1), wd.say(2, 80, 46, 2);
    }
    S[AT] = S[GOAL]! >= LAST && S[DAY]! >= LAST - 0.02 ? S[AT]! + dt : 0;
    if (S[LIT]! > 0) S[LIT] = S[LIT]! + dt;
    // Cups: fall, land, slide, knock into each other, and never onto the laptop or off the desk.
    let moving = 0;
    const n = S[CUPS]! | 0;
    for (let i = 0; i < n; i++) {
      AGE[i] = AGE[i]! + dt;
      if (Z[i]! > 0) {
        (VZ[i] = VZ[i]! - 7 * dt), (Z[i] = Z[i]! + VZ[i]! * dt), moving++;
        if (Z[i]! <= 0) (Z[i] = 0), land(i);
      }
      if (VX[i] === 0 && VY[i] === 0) continue;
      moving++;
      (X[i] = X[i]! + VX[i]! * dt), (Y[i] = Y[i]! + VY[i]! * dt);
      const f = Math.max(0, 1 - 4 * dt);
      (VX[i] = VX[i]! * f), (VY[i] = VY[i]! * f);
      if (Math.abs(VX[i]!) + Math.abs(VY[i]!) < 4) VX[i] = VY[i] = 0;
      // The desk's edges.
      if (X[i]! < DESK[0] + CR) (X[i] = DESK[0] + CR), (VX[i] = Math.abs(VX[i]!) * 0.5);
      if (X[i]! > DESK[2] - CR) (X[i] = DESK[2] - CR), (VX[i] = -Math.abs(VX[i]!) * 0.5);
      if (Y[i]! < DESK[1] + CR) (Y[i] = DESK[1] + CR), (VY[i] = Math.abs(VY[i]!) * 0.5);
      if (Y[i]! > DESK[3] - CR) (Y[i] = DESK[3] - CR), (VY[i] = -Math.abs(VY[i]!) * 0.5);
    }
    // Pairs (and the laptop): pushed apart, the faster one hands on its speed.
    for (let i = 0; i < n; i++) {
      if (Z[i]! > 0.2) continue;
      for (let j = i + 1; j < n; j++) {
        if (Z[j]! > 0.2) continue;
        const dx = X[j]! - X[i]!, dy = Y[j]! - Y[i]!, d2 = dx * dx + dy * dy;
        if (d2 >= CR * CR * 4 || d2 === 0) continue;
        const d = Math.sqrt(d2), o = (CR * 2 - d) / 2, nx = dx / d, ny = dy / d;
        (X[i] = X[i]! - nx * o), (Y[i] = Y[i]! - ny * o), (X[j] = X[j]! + nx * o), (Y[j] = Y[j]! + ny * o);
        const rv = (VX[j]! - VX[i]!) * nx + (VY[j]! - VY[i]!) * ny;
        if (rv < 0) (VX[i] = VX[i]! + nx * rv * 0.9), (VY[i] = VY[i]! + ny * rv * 0.9), (VX[j] = VX[j]! - nx * rv * 0.9), (VY[j] = VY[j]! - ny * rv * 0.9);
        if (o > 0.5 && VX[i] === 0 && VY[i] === 0) VX[i] = -nx * 1e-3;
      }
      // Out of the laptop's box along the shallowest side.
      if (X[i]! > LAP[0] - CR && X[i]! < LAP[2] + CR && Y[i]! > LAP[1] - CR && Y[i]! < LAP[3] + CR) {
        const l = X[i]! - (LAP[0] - CR), r = LAP[2] + CR - X[i]!, t = Y[i]! - (LAP[1] - CR), b = LAP[3] + CR - Y[i]!, m = Math.min(l, r, t, b);
        if (m === l) (X[i] = LAP[0] - CR), (VX[i] = -Math.abs(VX[i]!) - 1);
        else if (m === r) (X[i] = LAP[2] + CR), (VX[i] = Math.abs(VX[i]!) + 1);
        else if (m === t) (Y[i] = LAP[1] - CR), (VY[i] = -Math.abs(VY[i]!) - 1);
        else (Y[i] = LAP[3] + CR), (VY[i] = Math.abs(VY[i]!) + 1);
      }
    }
    for (let k = 0; k < NOTEN; k++) if (NAGE[k]! < 1) (NAGE[k] = NAGE[k]! + dt), moving++;
    if (mode === DONE) {
      S[CARD] = S[CARD]! + dt;
      if (S[CARD]! > 2.2) fresh(), (S[MODE] = mode = IDLE), wd.say(1, 80, 50, 1), (ev[EV_FRESH] = 1);
    }
    const busy = sp.step(dt, 90) + wd.step(dt);
    return mode === DEMO || mode === DONE || moving > 0 || busy > 0 || S[DAY]! < S[GOAL]! || S[HOLD]! > 0 || (S[AT]! > 0 && S[AT]! < 0.6) || (S[LIT]! > 0 && S[LIT]! < 2.5);
  }
  return { S, ev, sp, wd, step, cups: { X, Y, Z, A, AGE }, NAGE, rings: { X: RX, Y: RY, A: RA } };
}
export type DeskRot = ReturnType<typeof deskRot>;

// ---------- the drawing (Origin art units; the view shows x -44..844, y 66..566: his back and seat) ----------
const K = 0.18, TOP = 66, LEFT = 44;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const DAYS = /* @__PURE__ */ Array.from({ length: LAST + 1 }, (_, i) => `DAY ${i}`);
/** Our own status sticker: what it says from that day on, and its colour. */
const STATUS: readonly (readonly [number, string, string])[] = [
  [1, "STATUS: ON TRACK", C.go], [7, "STATUS: ON TRACK*", C.go], [11, "STATUS: MOSTLY ON TRACK", C.hurt], [16, "STATUS: SLIGHTLY BEHIND", C.advance],
  [21, "STATUS: AT RISK", C.attack], [26, "STATUS: RE-PLANNING", C.attack], [30, "STATUS: IT'S FINE", C.attack],
];
// Sticky notes on the lid and around the desk (x, y, turn), coloured from Origin's palette.
const NOTE = [300, 168, -0.2, 344, 160, 0.15, 470, 164, -0.12, 506, 182, 0.25, 396, 154, -0.05, 252, 150, 0.3, 534, 226, -0.25, 432, 176, 0.1, 230, 300, -0.3, 566, 168, 0.22, 196, 446, 0.18, 586, 446, -0.2, 640, 236, 0.12, 360, 186, -0.18];
const NOTEC = [O.sun, "#ff7389", O.tealL, O.sun, "#ffc21a", O.sun, O.tealL, "#ff7389", O.sun, O.tealL, "#ffc21a", O.sun, "#ff7389", O.sun];
/** Code lines turn red in this order. */
const REDS = [9, 4, 1, 7, 10, 2, 6, 0, 11, 3, 8, 5];
const LEVELS = 32;
/** A colour between two (r, g, b), quantised to LEVELS steps, made once. */
const ramp = (a: readonly number[], b: readonly number[]) => Array.from({ length: LEVELS }, (_, i) => `rgb(${a.map((v, k) => Math.round(v + (b[k]! - v) * (i / (LEVELS - 1)))).join(",")})`);
const LEAF = [ramp([63, 143, 111], [140, 112, 70]), ramp([78, 162, 125], [165, 132, 82]), ramp([95, 180, 140], [184, 150, 96])];

export type DeskScene = SlotScene & { engine: ReturnType<typeof createEngine>; desk: DeskRot; poster(): void; readonly state: { mode: number; day: number; goal: number; cups: number; notes: number; ships: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): DeskScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Next day; hold to fast-forward", { day: "click", cup: "hit", last: "hurt", ship: "win", fresh: "ready" });
  const g = r.g;
  const desk = deskRot((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = desk.S, cups = desk.cups;
  if (first) r.pad[1] = 1;
  // Origin's shapes, once: the torso, chair, cap, lid and screen; then his posture for every half
  // day (arms are two-bone paths, so each pose is made here, never in a frame).
  const P = (d: string) => new Path2D(d);
  const torso = P(TORSO), chair = P(CHAIR), foam = P(CAP.foam), bill = P(CAP.bill), edge = P(CAP.edge), lid = P(LIDP), scr = P(SCR);
  const POSES = (LAST - 1) * 2 + 1;
  const pose = Array.from({ length: POSES }, (_, i) => {
    const rot = smooth(i / (POSES - 1)), aw = 1 - 0.72 * rot, hn = hands(aw, 1 - 0.5 * rot), h = head(aw, 0), nk = neck(aw, 0);
    const arm = (s: number, x: number, y: number) => {
      const a = armD(s, x, y);
      return { skin: P(a.skin), sleeve: P(a.sleeve), hem: P(a.hem), x: a.k.hx, y: a.k.hy, deg: (a.k.deg * Math.PI) / 180 };
    };
    return { l: arm(-1, hn.lx, hn.ly), r: arm(1, hn.rx, hn.ry), hx: h.x, hy: h.y, ha: (h.a * Math.PI) / 180, ny: nk.cy, nry: nk.ry };
  });
  const CONF = [C.go, C.attack, C.sys, C.hurt, C.cmd, "rgba(246,243,255,.7)"];
  const WCOL = [C.go, C.sys, C.hurt];
  // The status sticker's width for each line, measured once.
  g.font = FONT[4]!;
  const SHIPPED = "STATUS: SHIPPED", SW = [...STATUS.map((x) => x[1]), SHIPPED].map((x) => Math.ceil(g.measureText(x).width) + 7);
  const brewHot = brew(false, 1), ring = "rgba(90,53,38,.32)", dusk = "#1d1a3c";
  // The candle's glow: warm and soft, fading to nothing (made once).
  const glow = g.createRadialGradient(CANDLE[0], CANDLE[1] - 30, 4, CANDLE[0], CANDLE[1] - 30, 56);
  glow.addColorStop(0, "rgba(255,200,120,.75)"), glow.addColorStop(0.35, "rgba(255,170,80,.28)"), glow.addColorStop(1, "rgba(255,170,80,0)");
  // The mute key goes bottom right, clear of the plant (top right).
  (r.mute.style.top = "auto"), (r.mute.style.bottom = "4px");

  const round = (x: number, y: number, w: number, h: number, rr: number) => (g.beginPath(), g.roundRect(x, y, w, h, rr), g.fill());
  const disc = (x: number, y: number, rr: number) => (g.beginPath(), g.arc(x, y, rr, 0, TAU), g.fill());
  function hand(a: (typeof pose)[number]["l"], s: number) {
    g.save();
    g.translate(a.x, a.y);
    g.rotate(a.deg);
    g.scale(1, s);
    g.fillStyle = O.skin;
    round(-13, -12, 26, 24, 9);
    round(3, -11.5, 20, 23, 7);
    g.restore();
  }
  function arm(a: (typeof pose)[number]["l"], s: number) {
    g.fillStyle = O.skin;
    g.fill(a.skin);
    g.fillStyle = O.red;
    g.fill(a.sleeve);
    g.strokeStyle = O.redD;
    g.lineWidth = 3;
    g.stroke(a.hem);
    hand(a, s);
  }
  function cup(i: number, newest: boolean) {
    const x = cups.X[i]!, y = cups.Y[i]!, z = cups.Z[i]!, s = (CR / 39) * (1 + z * 0.7), sh = 4 + z * 30;
    g.globalAlpha = 0.16 * (1 - z * 0.6);
    g.fillStyle = O.ink;
    disc(x + sh, y + sh, 30 * s);
    g.globalAlpha = 1;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    if (i === 0) (g.fillStyle = "#d9d1b3"), disc(2, 2, 40), (g.fillStyle = O.cream), disc(0, 0, 40);
    // The handle (turned), the rim, the coffee (the newest is hot; the rest dried rings).
    g.save();
    g.rotate(cups.A[i]!);
    g.fillStyle = O.creamD;
    round(22, -7, 20, 14, 7);
    g.restore();
    g.fillStyle = O.cream;
    disc(0, 0, 28);
    g.strokeStyle = O.creamD;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = newest ? brewHot : "#efe6c8";
    disc(0, 1, 22);
    if (!newest) (g.strokeStyle = "rgba(90,53,38,.55)"), (g.lineWidth = 2.4), g.beginPath(), g.arc(0, 1, 18, 0, TAU), g.stroke();
    g.restore();
  }
  engine.add({
    read: () => r.read(),
    step(e, dt) {
      if (desk.step(dt)) e.busy();
      const ev = desk.ev;
      if (ev[EV_DAY]) e.events.emit("day");
      if (ev[EV_CUP]) e.events.emit("cup");
      if (ev[EV_LAST]) e.events.emit("last");
      if (ev[EV_SHIP]) e.events.emit("ship");
      if (ev[EV_FRESH]) e.events.emit("fresh");
    },
    render() {
      r.begin();
      const day = S[DAY]!, d = day | 0, rot = (day - 1) / (LAST - 1), mode = S[MODE]!;
      const p = pose[Math.round((day - 1) * 2)]!, slump = smooth((day - 15) / 9), wilt = smooth((day - 4) / 22);
      g.save();
      g.scale(K, K);
      g.translate(LEFT, -TOP);
      // The window (a night strip) and the desk.
      g.fillStyle = O.code;
      g.fillRect(-60, 0, 920, 102);
      g.fillStyle = O.cream;
      g.fillRect(-60, 88, 920, 14);
      g.fillStyle = O.teal;
      g.fillRect(-60, 102, 920, 480);
      g.fillStyle = O.tealD;
      g.fillRect(-60, 102, 920, 10);
      // Coffee rings, oldest faintest.
      g.strokeStyle = ring;
      g.lineWidth = 4;
      for (let k = 0; k < RINGN; k++) if (desk.rings.A[k]) g.beginPath(), g.arc(desk.rings.X[k]!, desk.rings.Y[k]! + 3, CR * 0.82, 0.3, TAU - 0.4), g.stroke();
      // The lamp, the notebook and the phone (its badge counts what he hasn't read).
      g.fillStyle = O.cream;
      disc(100, 172, 32);
      g.fillStyle = O.red;
      disc(136, 218, 22);
      g.save();
      g.translate(155, 416), g.rotate(-0.157);
      g.fillStyle = O.cream;
      round(-59, -66, 118, 132, 4);
      g.fillStyle = O.creamD;
      g.fillRect(-59, -66, 12, 132);
      g.restore();
      g.save();
      g.translate(607, 306), g.rotate(0.14);
      g.fillStyle = O.cream;
      round(-34, -62, 68, 124, 10);
      g.fillStyle = O.code;
      round(-26, -44, 52, 86, 3);
      if (d > 2) (g.fillStyle = O.red), disc(24, -52, 9 + Math.min(d, 14) * 0.4);
      g.restore();
      // The plant, wilting: leaves droop, shrink and brown; one falls.
      const lv = Math.round(wilt * (LEVELS - 1));
      g.save();
      g.translate(702, 152);
      g.fillStyle = O.cream;
      disc(0, 0, 30);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = LEAF[k]![lv]!;
        g.beginPath();
        g.ellipse(0, wilt * 8, (k === 2 ? 30 : 34) * (1 - wilt * 0.3), (k === 2 ? 11 : 13) * (1 - wilt * 0.55), (k === 0 ? 0.52 : k === 1 ? -0.7 : 1.66) + wilt * (k === 1 ? -0.5 : 0.45), 0, TAU);
        g.fill();
      }
      g.restore();
      // The laptop: the base and keys, the lid, the screen going red line by line.
      g.fillStyle = O.ink;
      g.globalAlpha = 0.16;
      round(290, 252, 228, 134, 10);
      g.globalAlpha = 1;
      g.fillStyle = O.cream;
      round(286, 248, 228, 134, 10);
      g.fillStyle = O.creamD;
      for (let row = 0; row < 5; row++)
        for (let c = 0; c < 12; c++) {
          if (row === 4 && c > 4 && c < 8) continue;
          round(302 + c * 16.4, 262 + row * 15, row === 4 && c === 4 ? 16.4 * 4 - 3 : 13, 11, 2);
        }
      round(366, 344, 68, 30, 5);
      g.fillStyle = O.ink;
      g.fill(lid);
      g.fillStyle = O.code;
      g.fill(scr);
      g.save();
      g.clip(scr);
      const reds = Math.round(Math.min(1, rot * 1.08) * 11);
      for (let i = 0; i < CODE.length; i++) {
        const c = CODE[i]!, w = c[1]!;
        if (!w) continue;
        let red = false;
        for (let k = 0; k < reds; k++) if (REDS[k] === i) red = true;
        g.fillStyle = red ? O.red : C.go;
        round(300 + (316 + c[0]! - 304) * 1.0417, 169 + (158 + i * 7 - 140) * 0.72, w * 1.7 * 1.0417, 2.6, 1.3);
      }
      g.restore();
      // Cups: all but the airborne ones, in order (the newest steams hot).
      const n = S[CUPS]! | 0;
      for (let i = 0; i < n; i++) if (cups.Z[i]! <= 0) cup(i, i === n - 1);
      // Him: the chair turns into a beanbag and he sinks into it, head drooping toward the screen.
      g.save();
      g.translate(0, slump * 16);
      if (slump > 0) {
        g.globalAlpha = slump;
        g.fillStyle = O.inkL;
        g.beginPath();
        g.ellipse(400, 548, 190 * (0.75 + 0.25 * slump), 96 + 20 * slump, 0, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = O.ink;
      g.globalAlpha = 0.16;
      g.save(), g.translate(4, 4), g.fill(torso), g.restore();
      g.globalAlpha = 1;
      g.fillStyle = O.red;
      g.fill(torso);
      g.beginPath();
      g.ellipse(400, p.ny, 80, p.nry, 0, 0, TAU);
      g.fill();
      if (slump < 1) {
        g.globalAlpha = 1 - slump;
        g.fillStyle = O.ink;
        g.fill(chair);
        g.globalAlpha = 1;
      }
      g.restore();
      arm(p.l, 1);
      arm(p.r, -1);
      g.save();
      g.translate(p.hx, p.hy + slump * 10);
      g.rotate(p.ha);
      g.fillStyle = O.ink;
      disc(0, 0, 44);
      g.fillStyle = O.inkL;
      disc(0, -2, 41);
      g.fillStyle = O.cream;
      g.fill(foam);
      g.strokeStyle = O.ink;
      g.fillStyle = O.red;
      disc(0, -2, 4.5);
      g.fillStyle = O.tealD;
      g.fill(bill);
      g.lineWidth = 2.4;
      g.stroke(edge);
      g.restore();
      // Sticky notes slap on (big, then flat), over everything on the desk.
      for (let k = 0; k < NOTEN; k++) {
        const age = desk.NAGE[k]!;
        if (k >= S[NOTES]! || age >= 9) continue;
        const s = age < 0.14 ? 1.7 - (age / 0.14) * 0.7 : 1;
        g.save();
        g.translate(NOTE[k * 3]!, NOTE[k * 3 + 1]!);
        g.rotate(NOTE[k * 3 + 2]!);
        g.scale(s, s);
        g.fillStyle = "rgba(7,6,15,.25)";
        g.fillRect(-13, -11, 30, 30);
        g.fillStyle = NOTEC[k]!;
        g.fillRect(-15, -15, 30, 30);
        g.fillStyle = O.ink;
        g.fillRect(-10, -8, 18, 2.2), g.fillRect(-10, -2, 12, 2.2), g.fillRect(-10, 4, 15, 2.2);
        g.restore();
      }
      // Airborne cups last, over him, the notes and the desk.
      for (let i = 0; i < n; i++) if (cups.Z[i]! > 0) cup(i, i === n - 1);
      // Late nights: the room darkens; the candle (day 30) and the screen keep a pool of light.
      if (rot > 0.2) (g.globalAlpha = (rot - 0.2) * 0.45), (g.fillStyle = dusk), g.fillRect(-60, 0, 920, 600), (g.globalAlpha = 1);
      if (S[LIT]! > 0) {
        // A candle: a soft warm glow, its shadow, a cream stick with a wax drip, the wick and a flame.
        const fl = S[LIT]! < 2.5 ? Math.sin(S[T]! * 31) * 0.15 : 0, x = CANDLE[0], y = CANDLE[1];
        g.fillStyle = glow;
        disc(x, y - 30, 56);
        g.fillStyle = O.ink;
        g.globalAlpha = 0.25;
        round(x - 6, y - 16, 22, 44, 8);
        g.globalAlpha = 1;
        g.fillStyle = O.cream;
        round(x - 10, y - 20, 20, 44, 6);
        round(x + 5, y - 20, 7, 18, 3.5);
        g.fillStyle = O.creamD;
        g.fillRect(x - 10, y + 14, 20, 4);
        g.fillStyle = O.ink;
        g.fillRect(x - 1, y - 26, 2, 7);
        g.fillStyle = C.advance;
        g.beginPath(), g.ellipse(x, y - 33 - fl * 3, 6, 10 + fl * 5, 0, 0, TAU), g.fill();
        g.fillStyle = C.hurt;
        g.beginPath(), g.ellipse(x, y - 30, 3, 5.5, 0, 0, TAU), g.fill();
      }
      g.restore();
      // Our stickers: the day, and the status it reads.
      let st = 0;
      for (let k = 0; k < STATUS.length; k++) if (d >= STATUS[k]![0]) st = k;
      sticker(4, 4, 30, 11, DAYS[Math.min(LAST, d)]!, C.ink, 7, mode === DONE ? C.go : STATUS[st]![2]);
      sticker(4, 17, mode === DONE ? SW[STATUS.length]! : SW[st]!, 8, mode === DONE ? SHIPPED : STATUS[st]![1], C.rim, 4.4, mode === DONE ? C.go : STATUS[st]![2]);
      r.drawSpray(desk.sp, CONF);
      drawWords(r, desk.wd, WCOL);
      if (mode === IDLE && d === 1) caption(r, "TAP: NEXT DAY · HOLD: FAST-FORWARD", 84, 5, C.ink);
      if (S[AT]! > 0.5 && mode !== DONE) caption(r, "TAP TO SHIP IT", 84, 6, C.go);
    },
  });
  /** A Board UI sticker: flat face, bold rim, hard shadow. */
  function sticker(x: number, y: number, w: number, h: number, s: string, ink: string, size: number, face: string) {
    g.fillStyle = C.rim;
    g.beginPath(), g.roundRect(x, y + 1.2, w, h, 2.5), g.fill();
    g.fillStyle = face;
    g.beginPath(), g.roundRect(x, y, w, h, 2.5), g.fill();
    g.strokeStyle = C.rim;
    g.lineWidth = 0.9;
    g.stroke();
    g.fillStyle = ink;
    g.font = FONT[Math.round(size)]!;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(s, x + 3, y + h / 2 + 0.4, w - 6);
  }

  engine.start();
  return {
    engine,
    desk,
    get state() {
      return { mode: S[MODE]!, day: S[DAY]!, goal: S[GOAL]!, cups: S[CUPS]!, notes: S[NOTES]!, ships: S[SHIPS]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, two weeks in (scripts/gallery-posters.mjs). */
export const posterAt = 3.6;
