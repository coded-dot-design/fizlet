// "Air Hockey": a top-down air hockey table in the games room, you against a bot, first to 7. Drag
// your mallet (press anywhere on the table and move: it chases your finger), or steer it with the
// arrow keys. The puck glides on air, banks off the rails, cracks off the mallets and drops into a
// goal. The bot defends its mouth, lines up behind a slow puck and strikes it straight or off a
// rail. Light: a bright afternoon; dark: a neon night, the puck aglow.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/flick
// (the physics: the glide, the hits, the rails; a goal is a puck off the table), @fzlt/core/diorama
// (the 3D), @fzlt/core/slot, @fzlt/core/sound. The game is ./model.ts, pure and seeded
// (tests/air-hockey.test.mjs); the room and the stage's parts are ../bar/room.ts (the bar-games
// series); this file is the scene and the controls (tests/air-hockey.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { beats, camTween, effects, font, isLight, kit, looks, outlined, shell, type Look } from "../bar/room";
import { BOT, GOAL, GOALED, L, MH, MR, OVER, PH, PLAY, PR, PUCK, RAIL, W, WIN, YOU, hit, newGame, resetGame, serve, step, type Game } from "./model";

const TAU = 6.283185307179586, D = Math.PI / 180;
/** World units per metre; the table's top in the world. */
const S = 6, BY = 0.8 * S;
const [LIGHT, DARK] = looks(
  { ice: "#eef4fb", ice2: "#dfe9f6", mark: "#6f9fd8", mark2: "#ef8f7a", rail: "#f6f7fb", railT: "#c9ced8", body: "#6f9fd8", body2: "#5a86c0", leg: "#6f86a9", puck: "#ffd23f", knob: "#fff7ef", mouth: "#2b2f45", led: "#1b1d2e", ledOn: "#ff6a4d" },
  { ice: "#141a3a", ice2: "#18204a", mark: "#4ee6ff", mark2: "#ff5fa8", rail: "#262c55", railT: "#3a4277", body: "#2d3170", body2: "#232760", leg: "#2c2f4f", puck: "#ff5fa8", knob: "#e8e4f6", mouth: "#05060d", led: "#0a0b14", ledOn: "#ff5f6d" },
);
const T_SERVE = 1, T_END = 2;
const VIEWS = ["SIDE", "END"];

export type AirHockeyScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly g: Game;
  readonly state: { phase: number; you: number; bot: number; dragging: boolean; card: boolean; view: string; tx: number; tz: number };
  /** The screen point (CSS px, from the stage's top left) of table point (x, z) metres, as of now. */
  screen(x: number, z: number): [number, number];
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): AirHockeyScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let P: Look = isLight() ? LIGHT : DARK;

  const ui = shell(engine, stage, "Air Hockey: press on the table and drag your mallet, or steer it with the arrow keys; first to 7 (V view, M mutes)",
    `<b class="br-chip br-turn">Face-off</b><b class="br-chip br-n"><i class="br-dot"></i>You <span>0</span><i class="br-dot br-foe"></i>Bot <span>0</span><em>to 7</em></b>`);
  const { canvas, play, head, top, hint, card, again } = ui;
  const turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const snd = sound(engine, {
    cues: { crack: "crack", rail: "tick", goal: "power", against: "hurt", win: "win", lose: "end" },
    notes: {
      crack: [[1700, 900, 0.03, 0, "square", 0.08], [600, 380, 0.05, 0, "triangle", 0.18]],
      tick: [[1100, 800, 0.03, 0, "triangle", 0.1]],
    },
    volume: 0.12,
  });
  const K_MUTE = 0, K_VIEW = 1;
  const [muteK, viewK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "VIEW · SIDE", aria: "Camera view (V)", id: K_VIEW },
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

  // ---- the game, the diorama, the room ----
  const events = {
    emit(t: string, a = 0, b = 0, x = 0, y = 0, v = 0) {
      if (t === "flick:hit" && !posing) {
        hit(g, a, b);
        const mallet = (a === PUCK && b <= BOT) || (b === PUCK && a <= BOT);
        if (a === PUCK || b === PUCK) {
          engine.events.emit(mallet ? "crack" : "rail");
          sparks(x * S, BY + 0.15, y * S, mallet ? 7 : 3, mallet ? "#ffffff" : P.c.mark!);
        }
      }
      return engine.events.emit(t, a, b, x, y, v);
    },
  };
  let g: Game = newGame(1, events), seed = 1, botRnd = seeded(1), fxRnd = seeded(1), posing = false;
  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.c.bg!, overlay: drawOverlay, get shadowColor() { return P.c.shadow!; } });
  const K = kit(dio, () => P);
  const put = K.put;
  const bodies: DioramaObject[] = [], AT = new Float64Array(9);
  let fx: ReturnType<typeof effects>;
  const SIGN = { text: "AIR HOCKEY", glyph: "◐", x: -4.2, y: 12.4, size: 1.1 };

  function buildScene() {
    K.clear();
    bodies.length = 0;
    K.room({ w: 46, d: 30, rug: [0, 1, 30, 16], plant: [19, -11.8], sign: SIGN });
    // The table: legs, the body, the top (its air field painted), the rails, the mouths, the corner blocks.
    dio.cluster("board", { fixed: 1 });
    dio.cluster("table", { fixed: 2 });
    const TL = (L + 2 * RAIL) * S, TW = (W + 2 * RAIL) * S;
    for (let i = 0; i < 4; i++) put({ size: [0.5, BY - 1.4, 0.5], on: "floor", pos: [(i & 1 ? 1 : -1) * (TL / 2 - 1), 0, (i & 2 ? 1 : -1) * (TW / 2 - 0.7)], color: "leg", cluster: "table", layer: 0.1, shadow: 0.2 });
    put({ id: "body", size: [TL + 0.6, 1.2, TW + 0.6], pos: [0, BY - 1.4, 0], color: "body", cluster: "table", layer: 0.4, shadow: 0.35 });
    put({ size: [TL + 0.8, 0.2, TW + 0.8], pos: [0, BY - 0.2, 0], color: "body2", cluster: "table", layer: 0.5 });
    put({ id: "ice", size: [L * S, 0.02, W * S], pos: [0, BY - 0.02, 0], color: "ice", cluster: "table", layer: 0.6 });
    dio.decal("table", 0.65, iceArt);
    const rh = 0.06 * S, side = (W / 2 + RAIL / 2) * S, end = (L / 2 + RAIL / 2) * S, seg = ((W - GOAL) / 2 + RAIL) * S;
    for (let s = -1; s <= 1; s += 2) {
      put({ size: [TL, rh, RAIL * S], pos: [0, BY, s * side], color: "rail", cluster: "table", layer: 0.8 });
      put({ size: [RAIL * S, rh, seg], pos: [s * end, BY, -(GOAL * S) / 2 - seg / 2], color: "rail", cluster: "table", layer: 0.8 });
      put({ size: [RAIL * S, rh, seg], pos: [s * end, BY, (GOAL * S) / 2 + seg / 2], color: "rail", cluster: "table", layer: 0.8 });
      // The goal's mouth: a dark slot in the end, and the catch box under it.
      put({ size: [0.9, 0.5, GOAL * S], pos: [s * (end + 0.2), BY - 0.6, 0], color: "mouth", cluster: "table", layer: 0.55 });
    }
    for (let c = 0; c < 4; c++) put({ size: [0.13 * S, rh, 0.13 * S], pos: [(c & 1 ? 1 : -1) * (L / 2) * S, BY, (c & 2 ? 1 : -1) * (W / 2) * S], rot: [0, Math.PI / 4, 0], color: "railT", cluster: "table", layer: 0.85 });
    // The scoreboard on a post at the far side.
    put({ size: [0.3, 3.2, 0.3], on: "floor", pos: [0, 0, -(TW / 2 + 2.2)], color: "leg", cluster: "board", layer: 0.2 });
    put({ id: "sb", size: [4.4, 1.6, 0.4], pos: [0, BY + 0.6 - 0.8 + 2.2, -(TW / 2 + 2.2)], color: "led", cluster: "board", layer: 0.3 });
    dio.decal("board", 0.4, boardArt);
    // The puck and the mallets: each its own cluster (its depth).
    for (let i = 0; i < 3; i++) {
      const cl = "m" + i;
      dio.cluster(cl, { at: AT.subarray(i * 3, i * 3 + 3) });
      if (i === PUCK) bodies.push(put({ id: cl, shape: "cyl", sides: 20, size: [2 * PR * S, PH * S, 2 * PR * S], pos: [0, BY, 0], color: "puck", cluster: cl, layer: 1, shadow: 0.35, emissive: false }));
      else {
        bodies.push(put({ id: cl, shape: "cyl", sides: 20, size: [2 * MR * S, MH * S * 0.45, 2 * MR * S], pos: [0, BY, 0], color: i === YOU ? "you" : "bot", cluster: cl, layer: 1, shadow: 0.4 }));
        put({ id: cl + "r", shape: "cyl", sides: 20, top: 0.7, size: [2 * MR * S * 0.82, MH * S * 0.25, 2 * MR * S * 0.82], on: cl, color: i === YOU ? "you" : "bot", layer: 2 });
        put({ shape: "cyl", sides: 14, top: 1.15, size: [0.36, MH * S * 0.9, 0.36], on: cl + "r", color: "knob", layer: 3 });
      }
    }
    fx = effects(dio, 160, BY + 0.02);
  }
  const tmp = new Float64Array(3);
  /** A circle (or an arc from a0 to a1) in the ice's plane, centre (cx, cz) world, radius r. */
  function arc(ctx: CanvasRenderingContext2D, cx: number, cz: number, r: number, a0: number, a1: number) {
    ctx.beginPath();
    for (let k = 0; k <= 32; k++) {
      const a = a0 + ((a1 - a0) * k) / 32;
      dio.project(cx + Math.cos(a) * r, BY + 0.002, cz + Math.sin(a) * r, tmp);
      k ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
    }
  }
  function iceArt(ctx: CanvasRenderingContext2D) {
    const y = BY + 0.002, hl = (L / 2) * S, hw = (W / 2) * S;
    // The air field: rows of holes (a dotted sheen), then the markings.
    ctx.fillStyle = P.c.ice2!;
    for (let i = 1; i < 24; i++) K.quad(ctx, -hl + (i * 2 * hl) / 24 - 0.02, -hw + 0.1, -hl + (i * 2 * hl) / 24 + 0.02, hw - 0.1, y), ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P.c.mark2!;
    K.quad(ctx, -0.04, -hw, 0.04, hw, y), (ctx.fillStyle = P.c.mark2!), ctx.fill();
    arc(ctx, 0, 0, 0.18 * S, 0, TAU), ctx.stroke();
    ctx.strokeStyle = P.c.mark!;
    for (let s = -1; s <= 1; s += 2) {
      K.quad(ctx, s * hl * 0.5 - 0.03, -hw, s * hl * 0.5 + 0.03, hw, y), (ctx.fillStyle = P.c.mark!), ctx.fill();
      arc(ctx, s * hl, 0, 0.22 * S, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2), ctx.stroke();
    }
    if (P.night) {
      // The neon's glow along the rails.
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = P.c.mark!;
      K.quad(ctx, -hl, -hw, hl, -hw + 0.25, y), ctx.fill();
      K.quad(ctx, -hl, hw - 0.25, hl, hw, y), ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function boardArt(ctx: CanvasRenderingContext2D) {
    const z = -((W + 2 * RAIL) * S) / 2 - 2.2 + 0.21, y = BY + 2.0 + 0.95;
    ctx.font = font(100, 900);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let pass = 0; pass < (P.night ? 2 : 1); pass++) {
      const k = P.night && !pass ? 1.1 : 1;
      ctx.globalAlpha = P.night && !pass ? 0.3 : 1;
      ctx.fillStyle = P.c.you!;
      K.text(ctx, "" + g.score[0], -1.1, y, z, 1.1 * k, 0, 0, 0, -1.1 * k, 0);
      ctx.fillStyle = P.c.bot!;
      K.text(ctx, "" + g.score[1], 1.1, y, z, 1.1 * k, 0, 0, 0, -1.1 * k, 0);
      ctx.fillStyle = P.c.ledOn!;
      K.text(ctx, ":", 0, y, z, 0.8 * k, 0, 0, 0, -0.8 * k, 0);
    }
    ctx.globalAlpha = 1;
  }
  function sparks(x: number, y: number, z: number, n: number, col: string) {
    if (RM || posing) return;
    for (let k = 0; k < n; k++) fx.spawn(1, x, y, z, (fxRnd() - 0.5) * 3, 0.6 + fxRnd() * 1.8, (fxRnd() - 0.5) * 3, 0.25 + fxRnd() * 0.15, 0.04, col);
  }

  // ---- state ----
  const B = beats(engine);
  let view = 0, dragging = false, dirty = true, hudDirty = true, toastT = 0, toastS = "", toastC = "", toastBig = false, trailT = 0;
  let tx = -820, tz = 0; // your mallet's target (mm)
  const KEY = new Uint8Array(4); // ← → ↑ ↓ held
  const g3 = new Float64Array(3), EX = new Float64Array(4);
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  function reset(s: number) {
    seed = s >>> 0;
    resetGame(g, seed);
    botRnd = seeded(seed * 31 + 7);
    fxRnd = seeded(seed * 17 + 3);
    B.clear();
    dragging = false;
    KEY.fill(0);
    toastT = 0;
    tx = -820;
    tz = 0;
    buildScene();
    card.hidden = true;
    hudDirty = dirty = true;
  }
  const toast = (s: string, c: string, big: boolean, t = 1.2) => ((toastS = s), (toastC = c), (toastBig = big), (toastT = t));
  function goal(who: number) {
    engine.events.emit(who ? "against" : "goal");
    toast(who ? "BOT SCORES" : "GOAL!", who ? P.c.bot! : P.c.you!, !who);
    if (!RM && !who) for (let k = 0; k < 40; k++) fx.spawn(3, (L / 2) * S + 0.4, BY + 0.6, 0, -1 - fxRnd() * 3, 1 + fxRnd() * 2.5, (fxRnd() - 0.5) * 4, 1.4 + fxRnd() * 0.6, 0.07, fxRnd() < 0.5 ? P.c.you! : fxRnd() < 0.5 ? P.c.neon2! : "#ffd23f");
    ui.say(`${who ? "The bot scores" : "Goal"}: you ${g.score[0]}, bot ${g.score[1]}`);
    if (g.phase === OVER) B.later(RM ? 0.1 : 1.3, T_END);
    else B.later(RM ? 0.1 : 1.2, T_SERVE);
    hudDirty = dirty = true;
  }
  function showEnd() {
    const won = g.winner === 0;
    ui.end(won ? "You win!" : "The bot wins", `${g.score[0]} to ${g.score[1]} · top puck speed ${g.top.toFixed(1)} m/s`);
    engine.events.emit(won ? "win" : "lose");
    ui.say(won ? `You win, ${g.score[0]} to ${g.score[1]}` : `The bot wins, ${g.score[1]} to ${g.score[0]}`);
    hudDirty = dirty = true;
    again.focus({ preventScroll: true });
  }

  // ---- the camera ----
  const cam = camTween(dio);
  const portrait = () => dio.width / Math.max(1, dio.height) < 1.2;
  const FR = new Float64Array(15);
  function setView(v: number, snap: boolean) {
    if (v >= 0) view = v;
    const c = cam.goal, Wd = dio.width, H = dio.height, end = (view === 1) !== portrait();
    c.fov = 0.42;
    c.yaw = end ? -90 * D : 0;
    c.pitch = end ? 56 * D : 50 * D;
    c.tx = 0;
    c.ty = BY;
    c.tz = 0;
    const hl = (L / 2 + RAIL) * S + 0.3, hw = (W / 2 + RAIL) * S + 0.3;
    FR.set([-hl, BY, -hw, hl, BY, -hw, -hl, BY, hw, hl, BY, hw, 0, BY + (end ? 0 : 3.6), end ? 0 : -hw - 2.2]);
    dio.fit(c, FR, { x0: 10, x1: Wd - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) });
    cam.go(snap || RM);
    SIGN.size = portrait() ? 0 : 1.1;
    hudDirty = dirty = true;
    engine.wake();
  }
  const cycleView = () => setView((view + 1) % 2, false);

  // ---- the overlay: your mallet's target ring while you steer, the toast ----
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if ((dragging || KEY[0]! | KEY[1]! | KEY[2]! | KEY[3]!) && g.phase !== OVER) {
      dio.project((g.tx[YOU]!) * S, BY + 0.01, g.tz[YOU]! * S, tmp);
      ctx.strokeStyle = P.c.you!;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(tmp[0]!, tmp[1]!, 14, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (toastT > 0) {
      ctx.globalAlpha = Math.min(1, toastT * 3);
      outlined(ctx, toastS, dio.width / 2, V[3]! + 32, toastBig ? 40 : 32, toastC);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the HUD ----
  function hudWrite() {
    const t = g.phase === OVER ? "Game over" : g.phase === GOALED ? (g.last ? "Bot scores" : "Goal!") : g.hits[YOU]! + g.hits[BOT]! === 0 ? "Face-off" : "Play";
    if (ui.set(0, t)) (turnEl.textContent = t), turnEl.classList.toggle("br-them", g.phase === GOALED && g.last === 1);
    if (ui.set(1, g.score[0])) nums[0]!.textContent = "" + g.score[0];
    if (ui.set(2, g.score[1])) nums[1]!.textContent = "" + g.score[1];
    const h = g.phase === OVER ? "" : "Drag your mallet (or the arrow keys) · first to 7";
    if (ui.set(4, h)) hint.textContent = h;
    const v = VIEWS[(view + (portrait() ? 1 : 0)) % 2]!;
    if (ui.set(5, v)) (viewK!.textContent = "VIEW · " + v), viewK!.setAttribute("aria-label", `Camera view: ${v.toLowerCase()} (V)`);
  }

  // ---- the frame ----
  function pose() {
    const w = g.w;
    for (let i = 0; i < 3; i++) {
      const ob = bodies[i]!;
      ob.pos[0] = w.x[i]! * S; ob.pos[1] = BY + Math.min(0, w.y[i]!) * S; ob.pos[2] = w.z[i]! * S;
      AT[i * 3] = ob.pos[0]; AT[i * 3 + 1] = BY + 0.3; AT[i * 3 + 2] = ob.pos[2];
      // Off the table (in the mouth): out of sight.
      ob.alpha = w.off[i] || w.x[i]! > L / 2 + RAIL || w.x[i]! < -L / 2 - RAIL ? 0 : 1;
    }
  }
  /** Keys move the target across the screen: EX = the screen directions of world +x and +z (CSS px per metre). */
  function keyAxes() {
    dio.project(0, BY, 0, tmp);
    const ox = tmp[0]!, oy = tmp[1]!;
    dio.project(S, BY, 0, tmp);
    EX[0] = tmp[0]! - ox; EX[1] = tmp[1]! - oy;
    dio.project(0, BY, S, tmp);
    EX[2] = tmp[0]! - ox; EX[3] = tmp[1]! - oy;
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
        if (w === T_SERVE) serve(g, g.last === 0 ? 1 : 0), (tx = -820), (tz = 0), (hudDirty = true);
        else if (w === T_END) showEnd();
      }
      // The keys: the target moves across the screen at 1.6 m/s.
      const kx = KEY[1]! - KEY[0]!, ky = KEY[3]! - KEY[2]!;
      if (kx || ky) {
        keyAxes();
        // Solve screen (kx, ky) = a·EX(x) + b·EX(z) for the world step (a, b), then scale to 1.6 m/s.
        const det = EX[0]! * EX[3]! - EX[1]! * EX[2]!, a = (kx * EX[3]! - ky * EX[2]!) / det, b = (ky * EX[0]! - kx * EX[1]!) / det, l = Math.hypot(a, b) || 1;
        tx = Math.round(Math.max(-1000, Math.min(0, tx + ((a / l) * 1600 * dt))));
        tz = Math.round(Math.max(-500, Math.min(500, tz + ((b / l) * 1600 * dt))));
        moving = true;
      }
      if (g.phase !== OVER) {
        const was = g.phase, r = step(g, tx, tz, botRnd);
        if (r && was === PLAY) goal(r - 1);
        if (g.w.busy) moving = true;
        // A trail behind a fast puck.
        const pv = g.w.vx[PUCK]! * g.w.vx[PUCK]! + g.w.vz[PUCK]! * g.w.vz[PUCK]!;
        if (!RM && pv > 1.5 && (trailT += dt) > 1 / 40) (trailT = 0), fx.spawn(0, g.w.x[PUCK]! * S, BY + 0.05, g.w.z[PUCK]! * S, 0, 0, 0, 0.35, PR * S * 0.9, P.c.puck!);
      }
      if (fx.step(dt)) moving = true;
      if (cam.step(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), pose(), fx.draw(), dio.draw();
    },
  });

  // ---- input: press on the table and drag; the arrow keys steer ----
  let ox = 0, oy = 0;
  const aimAt = (cx: number, cy: number) => {
    if (!dio.ground(cx - ox, cy - oy, BY, g3)) return;
    tx = Math.round(Math.max(-1000, Math.min(0, (g3[0]! / S) * 1000)));
    tz = Math.round(Math.max(-500, Math.min(500, (g3[2]! / S) * 1000)));
  };
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (!card.hidden || g.phase === OVER) return;
    const r = play.getBoundingClientRect();
    (ox = r.left), (oy = r.top);
    play.setPointerCapture(e.pointerId);
    dragging = true;
    aimAt(e.clientX, e.clientY);
    play.classList.add("br-drag");
    dirty = true;
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    aimAt(e.clientX, e.clientY);
    dirty = true;
    engine.busy();
    engine.wake();
  }, sig);
  const end = () => {
    if (!dragging) return;
    dragging = false;
    play.classList.remove("br-drag");
    dirty = true;
    engine.wake();
  };
  play.addEventListener("pointerup", end, sig);
  play.addEventListener("pointercancel", end, sig);
  const AK = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !card.hidden) return;
    const k = e.key.toLowerCase();
    if (k === "m") return void (e.preventDefault(), toggle());
    if (k === "v") return void (e.preventDefault(), cycleView());
    const i = AK.indexOf(e.key);
    if (i >= 0) e.preventDefault(), (KEY[i] = 1), (dirty = true), engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const i = AK.indexOf(e.key);
    if (i >= 0) (KEY[i] = 0), (dirty = true), engine.wake();
  }, sig);
  stage.addEventListener("focusout", () => KEY.fill(0), sig);
  again.addEventListener("click", () => (reset(seed + 1), play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): 4–3, the puck flying off your mallet toward the bot's mouth.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    reset(20261117);
    posing = true;
    g.score[0] = 4;
    g.score[1] = 3;
    g.tick = 600;
    const w = g.w;
    w.place(PUCK, -0.45, 0.12);
    w.place(YOU, -0.6, 0.2);
    w.place(BOT, 0.8, -0.1);
    w.run();
    w.flick(PUCK, 3.2, -1.5);
    tx = -560;
    tz = 180;
    posing = false;
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
      return { phase: g.phase, you: g.score[0]!, bot: g.score[1]!, dragging, card: !card.hidden, view: VIEWS[(view + (portrait() ? 1 : 0)) % 2]!, tx, tz };
    },
    screen(x: number, z: number) {
      dio.project(x * S, BY, z * S, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: a hard shot off your mallet (scripts/gallery-posters.mjs). */
export const posterAt = 0.35;
