// "Cup Toss": a games-room table with a triangle of ten cups at the far end and twenty ping-pong
// balls. Drag back from the ball to aim and set the power (a dotted arc shows the toss), pick a spin
// (the ↺ key, or A and D) to curve it, and let go: it flies, bounces off the table, rattles round a
// rim or drops in. A cup clears when a ball lands in it (it hops off to the stack by the tee); at six
// cups and at three the rack is pulled in tight. Clear the rack in as few balls as you can. Family
// friendly: the cups hold nothing. Light: a bright afternoon; dark: a neon night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/flick
// (`sling`: the drag's aim and power as two integers), @fzlt/core/diorama (the 3D), @fzlt/core/slot,
// @fzlt/core/sound. The game is ./model.ts on ../bar/toss.ts (ball flight), pure and seeded
// (tests/cup-toss.test.mjs); the room and the stage's parts are ../bar/room.ts (the bar-games
// series); this file is the scene and the controls (tests/cup-toss.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaPoints } from "../../../../src/diorama";
import { sling } from "../../../../src/flick";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { beats, camTween, effects, isLight, kit, looks, outlined, shell, type Look } from "../bar/room";
import { AIM, AIMS, APEX, BALLS, BR, CH, CUPS, FLY_, HX, HY, OVER, RB, RC, SHOWN, SPINS, STEPS, TW, TX0, TX1, launchOf, left, newGame, next, reracks, resetGame, shoot, stars, step, touched, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
/** World units per metre; the table's top in the world; where the table sits along x. */
const S = 6, BY = 0.76 * S, OX = -6;
const wx = (x: number) => OX + x * S, wy = (y: number) => BY + y * S, wz = (z: number) => z * S;
const [LIGHT, DARK] = looks(
  { top: "#2f8f83", top2: "#3aa294", line: "#f4f1e6", apron: "#2a6f69", leg: "#6f86a9", cup: "#f07f68", cup2: "#e8604a", rimC: "#fff7ef", inside: "#7a2f26", tee: "#c9ced8", tray: "#c48d63", ball: "#ffffff", ballS: "#f2c46d" },
  { top: "#1f5f5a", top2: "#256b65", line: "#d9d4c4", apron: "#173f3c", leg: "#2c2f4f", cup: "#ff5f7a", cup2: "#d8455f", rimC: "#ffe1ee", inside: "#3a1220", tee: "#8f96a8", tray: "#6b4a3a", ball: "#fdfbf4" },
);
const T_READY = 1, T_RESULT = 2, T_NEXT = 3, T_RACKED = 4, T_END = 5, T_POSTER = 6;
const VIEWS = ["THROW", "CUPS"];
const SPIN_LABEL = ["↺ SPIN · NONE", "↺ SPIN · LEFT", "↻ SPIN · RIGHT"];

export type CupTossScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { phase: number; thrown: number; made: number; left: number; ready: boolean; aim: boolean; card: boolean; view: string; spin: number };
  /** The screen point (CSS px, from the stage's top left) of table point (x, z) metres, as of now. */
  screen(x: number, z: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): CupTossScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Look = isLight() ? LIGHT : DARK;

  const ui = shell(engine, stage, "Cup Toss: drag back from the ball to aim and set the power, let go to toss it; or the arrow keys aim and set the power, A and D pick a spin, Space tosses (V view, M mutes)",
    `<b class="br-chip br-turn">Your toss</b><b class="br-chip br-n">Cups <span>10</span> · Balls <span>20</span></b><b class="br-chip br-r">Run <span>0</span></b>`);
  const { canvas, play, head, top, hint, card, again } = ui;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const snd = sound(engine, {
    cues: { toss: "toss", table: "tock", rim: "tink", cup: "plonk", made: "power", miss: "click", rack: "ready", win: "win", lose: "end" },
    notes: {
      toss: [[700, 1100, 0.06, 0, "triangle", 0.06]],
      tock: [[1500, 1100, 0.025, 0, "square", 0.05], [900, 600, 0.04, 0, "triangle", 0.14]],
      tink: [[2400, 2200, 0.05, 0, "triangle", 0.1], [3100, 2900, 0.04, 0.02, "triangle", 0.06]],
      plonk: [[420, 180, 0.12, 0, "triangle", 0.22], [900, 500, 0.05, 0.04, "triangle", 0.1]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_VIEW = 1, K_SPIN = 2;
  const [muteK, viewK, spinK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "VIEW · THROW", aria: "Camera view (V)", id: K_VIEW },
    { label: SPIN_LABEL[0]!, aria: "Spin: none (A, D)", id: K_SPIN },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else if (id === K_VIEW) cycleView();
    else setSpin(spinMode === 0 ? -1 : spinMode === -1 ? 1 : 0);
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the game, the diorama, the room ----
  let lastHitT = 0;
  const events = {
    emit(t: string, a = 0, b = 0, x = 0, y = 0, v = 0) {
      if (t === "toss:hit" && !posing) {
        touched(g, b);
        const sx = wx(g.w.x[0]!), sy = wy(g.w.y[0]!), sz = wz(g.w.z[0]!);
        if (b === 1 && v > 0.6) engine.events.emit("table"), puff(sx, sy, sz, 3, P.c.line!);
        else if (b >= 10 && b < 30) engine.events.emit("rim"), puff(sx, sy, sz, 5, "#ffffff"), (lastHitT = engine.time);
        else if (b >= 30) engine.events.emit("table");
      }
      return engine.events.emit(t, a, b, x, y, v);
    },
  };
  let g: Game = newGame(1, events), seed = 1, fxRnd = seeded(1), posing = false;
  const aim = sling({ pull: 0.9 * S, max: 1, steps: STEPS, turns: 4096, min: 0.04 });
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.c.bg!, overlay: drawOverlay, get shadowColor() { return P.c.shadow!; } });
  const K = kit(dio, () => P);
  const put = K.put;
  const cups: DioramaObject[] = [], CAT = new Float64Array(CUPS * 3);
  let fx: ReturnType<typeof effects>, ballPts: DioramaPoints, shadowPts: DioramaPoints, trayPts: DioramaPoints;
  const SIGN = { text: "CUP TOSS", glyph: "◉", x: -5.6, y: 6.9, size: 1.0 };

  function buildScene() {
    K.clear();
    cups.length = 0;
    K.room({ w: 46, d: 30, rug: [0, 0.5, 30, 13], plant: [19, -11.8], sign: SIGN });
    // The table: legs, an apron, the top with its white border and centre line.
    dio.cluster("table", { fixed: 1 });
    const x0 = wx(TX0), x1 = wx(TX1), cx = (x0 + x1) / 2, L = x1 - x0, W = 2 * TW * S;
    for (let i = 0; i < 4; i++) put({ size: [0.42, BY - 0.5, 0.42], on: "floor", pos: [i & 1 ? x1 - 0.8 : x0 + 0.8, 0, i & 2 ? W / 2 - 0.5 : 0.5 - W / 2], color: "leg", cluster: "table", layer: 0.1, shadow: 0.2 });
    put({ id: "apron", size: [L - 0.6, 0.5, W - 0.6], on: "floor", pos: [cx, BY - 1, 0], color: "apron", cluster: "table", layer: 0.4, shadow: 0.35 });
    put({ id: "top", size: [L, 0.24, W], pos: [cx, BY - 0.24, 0], color: "top", cluster: "table", layer: 1 });
    dio.decal("table", 1.5, tableArt);
    // The tee at your end (the ball waits on it), the tray of balls beside it and the stack of cleared cups.
    put({ id: "teeB", shape: "cyl", sides: 12, size: [0.5, 0.06, 0.5], pos: [wx(HX), BY, 0], color: "tee", cluster: "table", layer: 2, shadow: 0.2 });
    put({ id: "tee", shape: "cyl", sides: 8, size: [0.08, (HY - BR) * S - 0.16, 0.08], on: "teeB", color: "tee", layer: 3 });
    put({ shape: "cyl", sides: 12, top: 1.5, size: [0.16, 0.1, 0.16], on: "tee", color: "tee", layer: 4 });
    put({ id: "tray", size: [1.25, 0.16, 1.55], pos: [wx(0.02), BY, 1.75], color: "tray", cluster: "tray", layer: 1, shadow: 0.25 });
    // The cups: a frustum, the rim's band, the dark inside; each its own cluster (its depth).
    for (let c = 0; c < CUPS; c++) {
      const id = "c" + c;
      dio.cluster(id, { at: CAT.subarray(c * 3, c * 3 + 3) });
      cups.push(put({ id, shape: "cyl", sides: 16, top: RC / RB, size: [2 * RB * S, CH * S - 0.08, 2 * RB * S], pos: [0, BY, 0], color: c & 1 ? "cup2" : "cup", cluster: id, layer: 1, shadow: 0.3, tag: { cup: c } }));
      put({ id: id + "r", shape: "cyl", sides: 16, size: [2 * RC * S, 0.08, 2 * RC * S], on: id, color: "rimC", layer: 2 });
      put({ shape: "cyl", sides: 16, size: [2 * RC * S - 0.12, 0.004, 2 * RC * S - 0.12], on: id + "r", color: "inside", layer: 3 });
    }
    // The ball (painted: shading and a highlight), its shadow on the table, the balls in the tray.
    shadowPts = dio.points({ cap: 1, cluster: "table", layer: 1.6, paint: paintShadow });
    ballPts = dio.points({ cap: 1, paint: paintBall });
    trayPts = dio.points({ cap: BALLS, cluster: "tray", layer: 2, paint: paintBall });
    fx = effects(dio, 140, 0.05);
  }
  function tableArt(ctx: CanvasRenderingContext2D) {
    const y = BY + 0.002, x0 = wx(TX0), x1 = wx(TX1), w = TW * S;
    ctx.fillStyle = P.c.top2!;
    K.quad(ctx, wx(APEX) - 1.3, -w, x1, w, y), ctx.fill();
    ctx.fillStyle = P.c.line!;
    ctx.globalAlpha = 0.95;
    K.quad(ctx, x0, -w, x1, -w + 0.1, y), ctx.fill();
    K.quad(ctx, x0, w - 0.1, x1, w, y), ctx.fill();
    K.quad(ctx, x0, -w, x0 + 0.1, w, y), ctx.fill();
    K.quad(ctx, x1 - 0.1, -w, x1, w, y), ctx.fill();
    ctx.globalAlpha = 0.6;
    K.quad(ctx, x0, -0.03, x1, 0.03, y), ctx.fill();
    // The throw line, a little past the tee.
    K.quad(ctx, wx(HX) + 0.6, -w, wx(HX) + 0.66, w, y), ctx.fill();
    // The polish: a long soft band.
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = P.sheen * 0.35;
    K.poly(ctx, x0 + 2, y, w, x0 + 4.4, y, w, x0 + 6.2, y, -w, x0 + 3.8, y, -w), ctx.fill();
    if (P.night) {
      ctx.fillStyle = P.c.neon!;
      ctx.globalAlpha = 0.12;
      K.quad(ctx, x0, -w, x1, -w + 0.5, y), ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  function paintBall(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(2.5, p.sr[i]!);
    ctx.fillStyle = P.c.ball!;
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = Math.max(1.2, r * 0.22);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.c.ballS!;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.62, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU);
    ctx.fill();
  }
  function paintShadow(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    ctx.fillStyle = P.c.shadow!;
    ctx.globalAlpha = p.a[i]! * 0.35;
    ctx.beginPath();
    ctx.ellipse(p.sx[i]!, p.sy[i]!, p.sr[i]! * 1.2, p.sr[i]! * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function puff(x: number, y: number, z: number, n: number, col: string) {
    if (RM || posing) return;
    for (let k = 0; k < n; k++) fx.spawn(1, x, y, z, (fxRnd() - 0.5) * 2, 0.8 + fxRnd() * 1.6, (fxRnd() - 0.5) * 2, 0.3 + fxRnd() * 0.2, 0.05, col);
  }

  // ---- state ----
  const B = beats(engine);
  // Per cup: where it is drawn (world), where it is going; its motion (0 still, 1 sliding in a
  // re-rack, 2 hopping off to the stack) and when it started; the stack slot of a cleared cup.
  const CP = new Float64Array(CUPS * 3), CF = new Float64Array(CUPS * 3), CT = new Float64Array(CUPS * 3), CM = new Uint8Array(CUPS), C0 = new Float64Array(CUPS);
  const SLOT = new Int8Array(CUPS).fill(-1);
  let view = 0, ready = false, dragging = false, kbd = false, kAim = 0, kLevel = 52, spinMode = 0, dirty = true, hudDirty = true, stacked = 0;
  let toastT = 0, toastS = "", toastC = "", toastBig = false, flightT = 0;
  const press3 = new Float64Array(3), hit3 = new Float64Array(3), LV = new Float64Array(6);
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** Cup c's spot in the world now (its model x, z) into out. */
  const cupSpot = (c: number, out: Float64Array, o = 0) => ((out[o] = wx(g.cx[c]!)), (out[o + 1] = BY), (out[o + 2] = wz(g.cz[c]!)), out);
  /** The stack of cleared cups (nested, by the tray): slot k. */
  const stackSpot = (k: number, out: Float64Array, o = 0) => ((out[o] = wx(-0.05) - (k % 2) * 1.0 + 0.5), (out[o + 1] = BY + Math.floor(k / 2) * 0.18), (out[o + 2] = -1.6), out);
  function reset(s: number) {
    seed = s >>> 0;
    resetGame(g, seed);
    fxRnd = seeded(seed * 17 + 3);
    B.clear();
    CM.fill(0), SLOT.fill(-1);
    stacked = 0;
    ready = dragging = kbd = false;
    toastT = 0;
    buildScene();
    for (let c = 0; c < CUPS; c++) cupSpot(c, CP, c * 3);
    card.hidden = true;
    up();
  }
  function setSpin(m: number) {
    spinMode = m;
    const i = m === 0 ? 0 : m < 0 ? 1 : 2;
    spinK!.textContent = SPIN_LABEL[i]!;
    spinK!.setAttribute("aria-label", `Spin: ${["none", "left", "right"][i]} (A, D)`);
    dirty = true;
    engine.wake();
  }
  /** The next ball pops from the tray onto the tee. */
  function up() {
    if (g.phase !== AIM) return;
    ready = false;
    B.later(RM ? 0.05 : 0.45, T_READY);
    hudDirty = dirty = true;
  }
  function fire(aimSteps: number, level: number) {
    if (!ready || g.phase !== AIM) return false;
    if (!shoot(g, aimSteps, level, spinMode * SPINS)) return false;
    ready = dragging = false;
    flightT = 0;
    engine.events.emit("toss");
    if (RM) runFlight();
    hudDirty = dirty = true;
    engine.wake();
    return true;
  }
  function runFlight() {
    while (g.phase === FLY_) step(g, 1 / 60);
  }
  /** The toss is decided: a cup cleared (it hops off), or a miss. */
  function result() {
    const c = g.hit;
    if (c >= 0) {
      CM[c] = 2;
      C0[c] = engine.time;
      SLOT[c] = stacked++;
      for (let k = 0; k < 3; k++) CF[c * 3 + k] = CP[c * 3 + k]!;
      stackSpot(SLOT[c]!, CT, c * 3);
      toastS = g.bounced ? "BOUNCE IN!" : g.rims > 0 ? "RATTLED IN!" : g.streak >= 3 ? "ON FIRE!" : g.streak === 2 ? "HEATING UP" : "IN!";
      toastC = P.c.cup!;
      toastBig = g.streak >= 3 || g.bounced === 1;
      engine.events.emit("cup"), engine.events.emit("made");
      if (!RM) for (let k = 0; k < 26; k++) fx.spawn(3, CP[c * 3]!, CP[c * 3 + 1]! + CH * S, CP[c * 3 + 2]!, (fxRnd() - 0.5) * 3, 2 + fxRnd() * 2, (fxRnd() - 0.5) * 3, 1.2 + fxRnd() * 0.6, 0.06, fxRnd() < 0.4 ? P.c.cup! : fxRnd() < 0.5 ? P.c.neon2! : "#ffd23f");
    } else {
      toastS = g.rims > 0 ? "RIM OUT" : "MISS";
      toastC = "#ffffff";
      toastBig = false;
      engine.events.emit("miss");
    }
    toastT = 1.3;
    ui.say(c >= 0 ? `${toastS} ${left(g)} cups left, ${20 - g.thrown} balls` : `${toastS}. ${left(g)} cups left, ${20 - g.thrown} balls`);
    B.later(RM ? 0.1 : 1.1, T_NEXT);
    hudDirty = dirty = true;
  }
  function nextBall() {
    if (reracks(g)) {
      // The cups slide into their tighter rack, then the next ball.
      next(g);
      for (let c = 0; c < CUPS; c++) {
        if (!g.cup[c]) continue;
        for (let k = 0; k < 3; k++) CF[c * 3 + k] = CP[c * 3 + k]!;
        cupSpot(c, CT, c * 3);
        CM[c] = 1;
        C0[c] = engine.time + (c % 4) * 0.06;
      }
      toastS = "RE-RACK";
      toastC = P.c.neon2!;
      toastBig = false;
      toastT = 1.1;
      engine.events.emit("rack");
      ready = false;
      B.later(RM ? 0.05 : 0.9, T_RACKED);
      hudDirty = dirty = true;
      return;
    }
    next(g);
    if (g.phase === OVER) return B.later(0.1, T_END);
    up();
  }
  function showEnd() {
    const st = stars(g), n = left(g);
    ui.end(n ? `${CUPS - n} of 10 cups` : `Cleared in ${g.thrown}!`, n ? "Out of balls. Another rack?" : `${"★".repeat(st)}${"☆".repeat(3 - st)} · best run ${g.best}`);
    hudDirty = dirty = true;
    engine.events.emit(n ? "lose" : "win");
    ui.say(n ? `Out of balls: ${CUPS - n} of 10 cups` : `Cleared the rack in ${g.thrown} balls, ${st} stars`);
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const cam = camTween(dio);
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.2;
  const FR = new Float64Array(15);
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const c = cam.goal, W = dio.width, H = dio.height, cupsV = view === 1, tall = portrait();
    c.fov = 0.42;
    c.yaw = cupsV ? -58 * D : tall ? -90 * D : -24 * D;
    c.pitch = cupsV ? 34 * D : tall ? 24 * D : 30 * D;
    c.tx = cupsV ? wx(APEX + 0.12) : wx(1.0);
    c.ty = BY;
    c.tz = 0;
    const w = TW * S;
    if (cupsV) {
      const a = wx(APEX - 0.15), b = wx(APEX + 0.35);
      FR.set([a, BY, -1.2, a, BY, 1.2, b, BY + 1, -1.2, b, BY + 1, 1.2, (a + b) / 2, BY + 1.6, 0]);
    } else if (tall) FR.set([wx(HX) - 0.4, BY, -w, wx(HX) - 0.4, BY, w + 0.6, wx(TX1), BY, -w, wx(TX1), BY, w, wx(APEX + 0.2), BY + 2.2, 0]);
    // From the side: the whole table, the pull behind the tee and the top of a toss's arc.
    else FR.set([wx(-0.75), BY, -w, wx(-0.75), BY, w + 0.6, wx(TX1), BY, -w, wx(TX1), BY, w, wx(0.95), BY + 4.4, 0]);
    dio.fit(c, FR, { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    cam.go(snap || RM);
    SIGN.size = tall ? 0 : 1.0;
    hudDirty = dirty = true;
    engine.wake();
  }
  const cycleView = () => setView((view + 1) % 2, false);

  // ---- the overlay: the aim (the band, the arc, the power), the toast ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (g.phase === AIM && ready && card.hidden && (aim.active || kbd)) {
      let a: number, lv: number;
      if (aim.active) (a = aimOf(aim.angle)), (lv = aim.level);
      else (a = kAim), (lv = kLevel);
      dio.project(wx(HX), wy(HY), 0, tmp);
      const sx = tmp[0]!, sy = tmp[1]!, pw = lv / STEPS, col = pw > 0.8 ? "#ff5d5d" : pw > 0.55 ? "#ffd23f" : "#ffffff";
      if (aim.active) {
        dio.project(wx(HX) - aim.dx * aim.power * 0.9 * S, wy(HY), -aim.dz * aim.power * 0.9 * S, tmp2);
        ctx.strokeStyle = P.c.you!;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tmp2[0]!, tmp2[1]!);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(tmp2[0]!, tmp2[1]!, 6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      // The arc: the first part of the flight, dots that shrink with distance.
      launchOf(a, lv, spinMode * SPINS, LV);
      let x = HX, y = HY, z = 0, vx = LV[0]!, vy = LV[1]!, vz = LV[2]!;
      const h = 1 / 120;
      ctx.fillStyle = col;
      ctx.strokeStyle = "#1f2433";
      ctx.lineWidth = 2;
      for (let k = 1; k <= 60; k++) {
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz), dr = 1 - 0.09 * sp * h;
        const ax = 0.0032 * (LV[4]! * vz - LV[5]! * vy), ay = 0.0032 * (LV[5]! * vx - LV[3]! * vz), az = 0.0032 * (LV[3]! * vy - LV[4]! * vx);
        vx = vx * dr + ax * h; vy = vy * dr - 9.8 * h + ay * h; vz = vz * dr + az * h;
        x += vx * h; y += vy * h; z += vz * h;
        if (y < 0.01) break;
        if (k % 4) continue;
        dio.project(wx(x), wy(y), wz(z), tmp);
        ctx.globalAlpha = 1 - k / 75;
        ctx.beginPath();
        ctx.arc(tmp[0]!, tmp[1]!, k === 60 ? 5 : 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // The power meter round the ball.
      const rr = 24;
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
    if (toastT > 0) {
      ctx.globalAlpha = Math.min(1, toastT * 3);
      outlined(ctx, toastS, dio.width / 2, V[3]! + 32, toastBig ? 40 : 32, toastC);
      ctx.globalAlpha = 1;
    }
  }
  /** Sling's angle (0..4095) as the model's aim steps. */
  const aimOf = (angle: number) => Math.max(-AIMS, Math.min(AIMS, Math.round(((((angle + 2048) % 4096) - 2048) / 4096) * TAU / 0.5 * AIMS)));

  // ---- the HUD ----
  function hudWrite() {
    const ph = g.phase;
    const t = ph === OVER ? "Game over" : ph === FLY_ ? "In the air…" : ph === SHOWN ? (g.hit >= 0 ? "In!" : "Missed") : "Your toss";
    if (ui.set(0, t)) turnEl.textContent = t;
    if (ui.set(1, left(g))) nums[0]!.textContent = "" + left(g);
    if (ui.set(2, BALLS - g.thrown)) nums[1]!.textContent = "" + (BALLS - g.thrown);
    if (ui.set(3, g.streak)) nums[2]!.textContent = "" + g.streak;
    const h = ph === AIM ? (kbd ? "←/→ aim · ↑/↓ power · A/D spin · Space tosses" : "Drag back from the ball, let go to toss · ↺ curves it") : ph === OVER ? "" : g.thrown === 0 ? "" : "Land it in a cup to clear it · re-racks at six and three";
    if (ui.set(4, h)) hint.textContent = h;
    const v = VIEWS[view]!;
    if (ui.set(5, v)) (viewK!.textContent = "VIEW · " + v), viewK!.setAttribute("aria-label", `Camera view: ${v.toLowerCase()} (V)`);
    if (ph === AIM && ready) ui.say(`Your toss: ${left(g)} cups, ${BALLS - g.thrown} balls left`);
  }

  // ---- the frame ----
  function poseCups() {
    const t = engine.time;
    let moving = false;
    for (let c = 0; c < CUPS; c++) {
      const ob = cups[c]!, o = c * 3, m = CM[c]!;
      if (m) {
        const dur = m === 2 ? 0.75 : 0.5, u = Math.max(0, Math.min(1, (t - C0[c]!) / (RM ? 0.001 : dur))), e = u * u * (3 - 2 * u);
        for (let k = 0; k < 3; k++) CP[o + k] = CF[o + k]! + (CT[o + k]! - CF[o + k]!) * e;
        if (m === 2) CP[o + 1] = CP[o + 1]! + Math.sin(Math.PI * u) * 3.2;
        if (m === 1) CP[o + 1] = CP[o + 1]! + Math.sin(Math.PI * u) * 0.6;
        ob.rot[2] = m === 2 ? Math.sin(Math.PI * u) * 0.9 : 0;
        if (u >= 1) CM[c] = 0;
        else moving = true;
      }
      ob.pos[0] = CP[o]!; ob.pos[1] = CP[o + 1]!; ob.pos[2] = CP[o + 2]!;
      CAT[o] = CP[o]!; CAT[o + 1] = CP[o + 1]! + 0.2; CAT[o + 2] = CP[o + 2]!;
    }
    return moving;
  }
  function poseBall() {
    // In the air (or rolling): the model's ball. On the tee: waiting. Else none (in a cup, gone).
    const inPlay = g.phase === FLY_, onTee = g.phase === AIM && ready;
    ballPts.n = inPlay || onTee ? 1 : 0;
    shadowPts.n = ballPts.n;
    if (ballPts.n) {
      const x = inPlay ? g.w.x[0]! : HX, y = inPlay ? g.w.y[0]! : HY, z = inPlay ? g.w.z[0]! : 0;
      ballPts.x[0] = wx(x); ballPts.y[0] = wy(y); ballPts.z[0] = wz(z); ballPts.r[0] = BR * S;
      // Its shadow on the table (or none once it is off the table).
      const onTable = x > TX0 && x < TX1 && z > -TW && z < TW;
      shadowPts.x[0] = wx(x); shadowPts.y[0] = BY + 0.01; shadowPts.z[0] = wz(z); shadowPts.r[0] = BR * S;
      shadowPts.a[0] = onTable && y > -0.01 ? Math.max(0.15, 1 - y * 2) : 0;
    }
    // The tray: the balls still to toss, in rows.
    const n = BALLS - g.thrown - (ballPts.n && !inPlay ? 1 : 0) - (inPlay ? 0 : 0);
    trayPts.n = Math.max(0, n);
    for (let k = 0; k < trayPts.n; k++) {
      trayPts.x[k] = wx(0.02) - 0.42 + (k % 4) * 0.28; trayPts.y[k] = BY + 0.16 + BR * S; trayPts.z[k] = 1.75 - 0.58 + Math.floor(k / 4) * 0.29; trayPts.r[k] = BR * S;
      trayPts.a[k] = 1;
    }
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = isLight() ? LIGHT : DARK;
        if (nx !== P) (P = nx), dio.setLight(P.light, P.amb), K.recolor(), (dirty = true);
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
      for (let w = B.due(e.time); w; w = B.due(e.time)) {
        moving = true;
        if (w === T_READY) (ready = true), (hudDirty = true);
        else if (w === T_RESULT) result();
        else if (w === T_NEXT) nextBall();
        else if (w === T_RACKED) up();
        else if (w === T_END) showEnd();
        else if (w === T_POSTER) fire(4, 58);
      }
      if (g.phase === FLY_) {
        moving = true;
        flightT += dt;
        if (step(g, dt) === SHOWN) B.later(RM ? 0.05 : 0.25, T_RESULT);
        else if (!RM && (flightT * 60) % 2 < 1) fx.spawn(0, wx(g.w.x[0]!), wy(g.w.y[0]!), wz(g.w.z[0]!), 0, 0, 0, 0.35, BR * S * 0.8, g.streak >= 2 ? "#ff9b3f" : P.c.ball!);
      } else if (g.phase === SHOWN && g.hit < 0 && RM) void 0;
      if (fx.step(dt)) moving = true;
      if (cam.step(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (dirty = true);
    },
    render() {
      if (poseCups()) engine.busy(), (dirty = true);
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), poseBall(), fx.draw(), dio.draw();
    },
  });

  // ---- input: drag back from the ball (press anywhere, pull), keys aim, power, spin and toss ----
  const ground = (x: number, y: number, out: Float64Array) => dio.ground(x, y, BY, out);
  const mine = () => g.phase === AIM && ready && card.hidden;
  let ox = 0, oy = 0;
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    const r = play.getBoundingClientRect();
    (ox = r.left), (oy = r.top);
    if (!mine() || !ground(e.clientX - ox, e.clientY - oy, press3)) return;
    play.setPointerCapture(e.pointerId);
    dragging = true;
    kbd = false;
    aim.begin(wx(HX), 0, wx(HX), 0);
    play.classList.add("br-drag");
    hudDirty = dirty = true;
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!dragging || !ground(e.clientX - ox, e.clientY - oy, hit3)) return;
    aim.move(wx(HX) + hit3[0]! - press3[0]!, hit3[2]! - press3[2]!);
    dirty = true;
    engine.busy();
    engine.wake();
  }, sig);
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    play.classList.remove("br-drag");
    if (e.type === "pointerup" && aim.end()) (kAim = aimOf(aim.angle)), (kLevel = aim.level), fire(kAim, kLevel);
    else aim.cancel();
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
    if (k === "a" || k === "d") return void (e.preventDefault(), setSpin(Math.max(-1, Math.min(1, spinMode + (k === "a" ? -1 : 1)))));
    if (!mine()) return;
    const ky = e.key, x = ky === "ArrowLeft" ? -1 : ky === "ArrowRight" ? 1 : 0, y = ky === "ArrowUp" ? 1 : ky === "ArrowDown" ? -1 : 0;
    if (x || y) {
      e.preventDefault();
      kbd = true;
      // Down the table, left on screen is −z: ← aims left.
      kAim = Math.max(-AIMS, Math.min(AIMS, kAim - x * 2));
      kLevel = Math.max(0, Math.min(STEPS, kLevel + y));
      hudDirty = dirty = true;
      return void engine.wake();
    }
    if ((e.key === "Enter" || e.key === " ") && !onKey) {
      e.preventDefault();
      kbd ? fire(kAim, kLevel) : ((kbd = true), (hudDirty = dirty = true), engine.wake());
    }
  }, sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): three cups already cleared, a ball on its way in.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261115);
    posing = true;
    for (const c of [0, 2, 5]) (g.cup[c] = 0), (g.w.on[g.rim[c]!] = g.w.on[g.wall[c]!] = 0), SLOT[c] = stacked++, stackSpot(SLOT[c]!, CP, c * 3);
    g.thrown = 5;
    g.made = 3;
    g.streak = 2;
    posing = false;
    B.clear();
    ready = true;
    B.later(0.12, T_POSTER);
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
      return { phase: g.phase, thrown: g.thrown, made: g.made, left: left(g), ready, aim: aim.active || kbd, card: !card.hidden, view: VIEWS[view]!, spin: spinMode };
    },
    screen(x: number, z: number) {
      dio.project(wx(x), BY, wz(z), tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a ball on its way into the rack (scripts/gallery-posters.mjs). */
export const posterAt = 0.5;
