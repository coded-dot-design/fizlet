// The card table series' table (Blackjack, Solitaire, Gin Rummy, Hold'em): Flip Match's room, felt
// table, lamp and mug, the HUD stickers, the keys strip, sound, sparkles and the camera fit, once, so
// each game is only its rules (a pure model on @fzlt/core/cards) and its own scene and controls.
// `cardTable(stage, spec)` makes the engine, the canvas, the transparent play key, the HUD and the
// diorama; the game's spec says how big the felt is, what lies on it, what the camera frames and
// what to do on each key, tap and timer. The light: a bright afternoon; dark: a lamp-lit night.
// Felt coordinates: x right, z toward you, from the felt's centre; its top is at y = PT + FH.
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound, type Note } from "../../../../src/sound";
import { keys, type Key } from "../keys";

export const TAU = 6.283185307179586, D = Math.PI / 180;
/** The table's top (the plinth) and the felt on it. */
export const PT = 1.4, FH = 0.08, TOP = PT + FH;
export const LIGHT = {
  bg: "#f1e9df", floor: "#ddd4c8", rug: "#f3cdbf", rug2: "#f7dccf", wallB: "#d8e4f0", wallR: "#f6dcd2", wood: "#c69a6f", top: "#e0b88c", felt: "#8fd3b0", felt2: "#9bd9b9",
  lamp: "#7fcfa8", brass: "#e8c26a", bulb: "#fff3c8", mug: "#f08e6f", tea: "#9a6a4a", pot: "#e8a27f", leaf: "#93cf9f", leaf2: "#b6e0a9", shadow: "#3a2d3c", rail: "#7a4f3a",
  light: [0.5, 1, 0.45], amb: 0.54, glow: 0.1, night: false, chalk: "rgba(255,255,255,0.6)", print: "rgba(31,36,51,0.55)",
};
export type Pal = typeof LIGHT;
export const DARK: Pal = {
  ...LIGHT, bg: "#110e1c", floor: "#221d33", rug: "#33284a", rug2: "#3b2f55", wallB: "#1b2238", wallR: "#1e1a33", wood: "#6b4a3a", top: "#7d5a44", felt: "#1d5a55", felt2: "#22665f",
  lamp: "#2f8a72", brass: "#b48d3e", mug: "#a9505a", tea: "#4a3226", pot: "#7a4a52", leaf: "#3f6f63", leaf2: "#4e8473", shadow: "#000000", rail: "#3e2a26",
  light: [0.35, 1, 0.55], amb: 0.42, glow: 0.26, night: true, chalk: "rgba(190,255,235,0.26)", print: "rgba(214,255,240,0.42)",
};
type ColorKey = Exclude<keyof Pal, "light" | "amb" | "night" | "glow" | "chalk" | "print">;
export const FONT = "ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
const PART = 200, PS = 9, NT = 8;

/** What a game tells its table. Every callback runs after the game's mount has defined what it uses. */
export interface TableSpec {
  /** The play key's accessible name (how to play with the pointer and the keys). */
  label: string;
  /** The HUD's inner HTML: a `.ct-head` (the stickers and the hint), then whatever else the game needs. */
  hud: string;
  /** The keys strip (mute first) and what a press does. */
  keys: Key[];
  onKey(id: number, down: boolean): void;
  /** Sound: event → note name, and the notes. */
  cues: Record<string, string>;
  notes: Record<string, Note[]>;
  /** The felt's width and depth, and how far it sits toward you, for a wide or a tall stage. */
  felt(tall: boolean): [w: number, d: number, z: number];
  /** After the room is built: add the cards, chips and the rest (the scene is rebuilt on a shape change). */
  build(tall: boolean): void;
  /** The camera's yaw and pitch (degrees) and the felt points (x, y above the felt, z, …) it must frame. */
  view(tall: boolean, pts: number[]): [yaw: number, pitch: number];
  /** Paint on the felt (chalk outlines, printed rules), in felt coordinates with `T.quad`, `T.text`. */
  feltArt?(ctx: CanvasRenderingContext2D): void;
  /** Paint over the frame (cursors, highlights). */
  overlay?(ctx: CanvasRenderingContext2D): void;
  /** A timer set with `T.later` has come due. */
  timer(what: number): void;
  /** Each fixed step: true while something of the game's own still moves. */
  step?(dt: number): boolean;
  /** Before each draw (pose the cards: `dc.show`): true while something still moves. */
  pose?(t: number): boolean;
  /** Write the HUD (when `T.hudDirty` was set). */
  write(): void;
  /** The theme changed (recolour what the game coloured itself). */
  theme?(): void;
}

export function cardTable(stage: HTMLElement, spec: TableSpec) {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isLight = () => document.documentElement.dataset.theme === "light";
  let P: Pal = isLight() ? LIGHT : DARK;

  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ct-play";
  play.setAttribute("aria-label", spec.label);
  const hudEl = L.add(document.createElement("div"));
  hudEl.className = "ct-hud";
  hudEl.innerHTML = spec.hud + `<p class="ct-live" aria-live="polite"></p>`;
  const head = hudEl.querySelector(".ct-head") as HTMLElement, liveEl = hudEl.querySelector(".ct-live") as HTMLElement;
  stage.append(canvas, play, hudEl);
  const snd = sound(engine, { cues: spec.cues, notes: spec.notes, volume: 0.12 });
  const keyEls = keys(engine, stage, spec.keys, (id, down) => spec.onKey(id, down)) as HTMLButtonElement[];
  const muteK = keyEls[0]!;
  muteK.setAttribute("aria-pressed", "true");

  const dio = diorama(canvas, { light: P.light, ambient: P.amb, background: () => P.bg, overlay: (ctx) => (spec.overlay?.(ctx), drawToast(ctx)), get shadowColor() { return P.shadow; } });
  const keyed: DioramaObject[] = [], keyName: ColorKey[] = [];
  const tmp = new Float64Array(3), S = new Float64Array(8), V = new Float64Array(5), TT = new Float64Array(NT), TF = new Uint8Array(NT);
  const fx = new Float64Array(PART * PS);
  let sparks!: DioramaPoints, fxRnd = seeded(1), said = "", toastT = 0, toastS = "", toastX = 0, toastZ = 0, toastC = "#ffd36b";
  V[0] = V[1] = 1;

  const T = {
    engine, dio, stage, play, hudEl, head, keys: keyEls, snd, RM,
    /** The palette now. */
    get P() { return P; },
    /** A wide stage (false) or a square/tall one (true). */
    tall: false,
    /** The felt: width, depth, its centre's z on the table; the lamp's place on the felt. */
    fw: 1, fd: 1, fz: 0, lampX: 0, lampZ: 0,
    /** Ask for a redraw / a HUD write. */
    dirty: true, hudDirty: true,
    /** [2] the poster's resolution scale. */
    V,
    /** Add a scene object; a `color` that names a palette key follows the theme. */
    put(d: DioramaObjectDef & { color?: string }) {
      const k = d.color as ColorKey | undefined, own = k && k in P, ob = dio.add({ pick: false, ...d, color: own ? (P[k] as string) : d.color });
      if (own) keyed.push(ob), keyName.push(k);
      return ob;
    },
    /** World point of felt point (x, y above the felt, z) on screen, into `out` (CSS px). */
    screen(x: number, y: number, z: number, out: { [i: number]: number }) {
      return dio.project(x, TOP + y, z + T.fz, out);
    },
    /** The felt point (x, z) under screen point (sx, sy) (CSS px), on the plane `y` above the felt,
     *  into `out`; false if the ray misses it. */
    toFelt(sx: number, sy: number, out: { [i: number]: number }, y = 0) {
      const c = dio.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy0 = Math.sin(c.yaw);
      const ex = c.tx + c.dist * sy0 * cp, ey = c.ty + c.dist * sp, ez = c.tz + c.dist * cy * cp;
      const f = dio.height / 2 / Math.tan(c.fov / 2), u = sx - (dio.width / 2 + c.ox), v = sy - (dio.height / 2 + c.oy);
      // forward · f + right · u − up · v
      const dx = -sy0 * cp * f + cy * u + sy0 * sp * v, dy = -sp * f - cp * v, dz = -cy * cp * f - sy0 * u + cy * sp * v;
      if (dy > -1e-6) return false;
      const t = (TOP + y - ey) / dy;
      out[0] = ex + dx * t;
      out[1] = ez + dz * t - T.fz;
      return true;
    },
    /** The felt quad (x0, z0)–(x1, z1) as a path. */
    quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, y = 0.002) {
      const yy = TOP + y, f = T.fz;
      dio.project(x0, yy, z0 + f, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
      dio.project(x1, yy, z0 + f, tmp), (S[2] = tmp[0]!), (S[3] = tmp[1]!);
      dio.project(x1, yy, z1 + f, tmp), (S[4] = tmp[0]!), (S[5] = tmp[1]!);
      dio.project(x0, yy, z1 + f, tmp), (S[6] = tmp[0]!), (S[7] = tmp[1]!);
      ctx.beginPath();
      ctx.moveTo(S[0]!, S[1]!);
      for (let k = 2; k < 8; k += 2) ctx.lineTo(S[k]!, S[k + 1]!);
      ctx.closePath();
    },
    /** A ring of radius r round (x, z) on the felt as a path (`sq` < 1 squashes it in z). */
    ring(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, sq = 1) {
      ctx.beginPath();
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        dio.project(x + Math.cos(a) * r, TOP + 0.002, z + T.fz + Math.sin(a) * r * sq, tmp);
        k ? ctx.lineTo(tmp[0]!, tmp[1]!) : ctx.moveTo(tmp[0]!, tmp[1]!);
      }
      ctx.closePath();
    },
    /** Set ctx to draw in the felt's plane at (x, z): 100 units a world unit, x right, y toward you. */
    plane(ctx: CanvasRenderingContext2D, x: number, z: number, y = 0.003) {
      const r = dio.dpr, yy = TOP + y, f = T.fz;
      dio.project(x, yy, z + f, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
      dio.project(x + 1, yy, z + f, tmp), (S[2] = tmp[0]! - S[0]!), (S[3] = tmp[1]! - S[1]!);
      dio.project(x, yy, z + f + 1, tmp), (S[4] = tmp[0]! - S[0]!), (S[5] = tmp[1]! - S[1]!);
      ctx.setTransform((r * S[2]!) / 100, (r * S[3]!) / 100, (r * S[4]!) / 100, (r * S[5]!) / 100, r * S[0]!, r * S[1]!);
    },
    /** Back to CSS px. */
    flat(ctx: CanvasRenderingContext2D) {
      const r = dio.dpr;
      ctx.setTransform(r, 0, 0, r, 0, 0);
    },
    /** Text printed on the felt, centred at (x, z), `px` high (in felt hundredths). */
    text(ctx: CanvasRenderingContext2D, s: string, x: number, z: number, px: number, color: string, weight = 800) {
      T.plane(ctx, x, z);
      ctx.fillStyle = color;
      ctx.font = `${weight} ${px}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s, 0, 0);
      T.flat(ctx);
    },
    /** A timer: `spec.timer(what)` in `sec` seconds (holds the engine awake till then). */
    later(sec: number, what: number) {
      for (let k = 0; k < NT; k++) if (!TF[k]) return void ((TT[k] = engine.time + sec), (TF[k] = what), engine.busy(sec + 0.05), engine.wake());
    },
    /** Cancel every timer (or only those for `what`). */
    cancel(what = 0) {
      for (let k = 0; k < NT; k++) if (!what || TF[k] === what) TF[k] = 0;
    },
    /** A timer is waiting (for `what`, or any). */
    pending(what = 0) {
      for (let k = 0; k < NT; k++) if (TF[k] && (!what || TF[k] === what)) return true;
      return false;
    },
    /** Sparkles from felt point (x, z). */
    burst(x: number, z: number, n: number, up: number, y = 0.3) {
      for (let j = 0; j < n; j++)
        for (let k = 0; k < PART; k++) {
          const o = k * PS;
          if (fx[o + 6]! > 0) continue;
          const a = fxRnd() * TAU, s = 0.6 + fxRnd() * 1.8;
          fx[o] = x; fx[o + 1] = TOP + y + fxRnd() * 0.4; fx[o + 2] = z + T.fz;
          fx[o + 3] = Math.cos(a) * s; fx[o + 4] = up + fxRnd() * 2; fx[o + 5] = Math.sin(a) * s;
          fx[o + 6] = fx[o + 7] = 0.6 + fxRnd() * 0.5; fx[o + 8] = (fxRnd() * 4) | 0;
          break;
        }
      engine.busy(1.2);
      engine.wake();
    },
    /** A word that pops up over felt point (x, z) and floats away. */
    toast(s: string, x: number, z: number, color = "#ffd36b") {
      (toastS = s), (toastX = x), (toastZ = z), (toastT = 1), (toastC = color);
      T.dirty = true;
      engine.busy(1.05);
      engine.wake();
    },
    /** Say it in the live region (once). */
    say(s: string) {
      if (s !== said) (said = s), (liveEl.textContent = s);
    },
    /** Mute / unmute. */
    toggleMute() {
      snd.on = !snd.on;
      muteK.textContent = snd.on ? "♪" : "×";
      muteK.setAttribute("aria-pressed", "" + snd.on);
    },
    /** Ask for a redraw now. */
    wake() {
      T.dirty = true;
      engine.wake();
    },
    /** Rebuild the scene (the room, then the game's `build`). */
    rebuild,
    /** Start the engine: call once, at the end of the game's mount. */
    start() {
      const r0 = stage.getBoundingClientRect();
      T.tall = r0.width / Math.max(1, r0.height) < 1.2;
      rebuild();
      engine.start();
    },
    /** Re-seed the sparkles (a new deal). */
    reseed(s: number) {
      fxRnd = seeded(s);
    },
  };

  function rebuild() {
    dio.clear();
    keyed.length = keyName.length = 0;
    const [fw, fd, fz] = spec.felt(T.tall);
    (T.fw = fw), (T.fd = fd), (T.fz = fz);
    const put = T.put;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    put({ id: "floor", size: [44, 0.5, 30], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
    put({ size: [44.6, 12, 0.5], pos: [0, -0.5, -15.25], color: "wallB", cluster: "room", layer: 0.3 });
    put({ size: [0.5, 12, 30], pos: [22.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3 });
    put({ id: "rug", size: [fw + 9, 0.05, fd + 8], on: "floor", pos: [0, 0, fz], color: "rug", layer: 0.2 });
    put({ size: [fw + 7.6, 0.02, fd + 6.6], on: "rug", color: "rug2", layer: 0.21 });
    put({ id: "pot", shape: "cyl", sides: 10, top: 1.25, size: [2, 1.7, 2], pos: [16, 0, -11], color: "pot", cluster: "room", layer: 1, shadow: 0.2, on: "floor" });
    put({ id: "leaf", shape: "cyl", sides: 7, top: 0.4, size: [3.4, 2.6, 3.4], on: "pot", color: "leaf", layer: 1 });
    put({ shape: "cyl", sides: 7, top: 0.05, size: [2.4, 2.4, 2.4], on: "leaf", color: "leaf2", layer: 1 });
    // The table: a wooden plinth, its top, the felt.
    put({ id: "plinth", size: [fw + 1.4, PT - 0.16, fd + 1.4], on: "floor", pos: [0, 0, fz], color: "wood", cluster: "table", layer: 0, shadow: 0.24 });
    put({ id: "top", size: [fw + 1.8, 0.16, fd + 1.8], on: "plinth", color: "top", layer: 0.4 });
    put({ id: "felt", size: [fw, FH, fd], on: "top", color: "felt", layer: 1 });
    dio.decal("table", 1.5, feltArt);
    // A lamp on the far corner (its shade glows at night) and a mug.
    const lx = T.tall ? fw / 2 + 0.25 : -fw / 2 - 0.45, lz = T.tall ? -fd / 2 - 0.25 : -fd / 2 + 1.2;
    (T.lampX = lx), (T.lampZ = lz);
    dio.cluster("lamp", { at: [lx, PT + 1, fz + lz] });
    put({ id: "lb", shape: "cyl", sides: 10, size: [1, 0.16, 1], on: "top", pos: [lx, 0, lz], color: "brass", cluster: "lamp", shadow: 0.25 });
    put({ id: "ls", size: [0.12, 1.5, 0.12], on: "lb", color: "brass" });
    put({ id: "lh", shape: "cyl", sides: 12, top: 0.55, size: [1.5, 0.55, 0.8], on: "ls", pos: [0, -0.1, 0], rot: [0, 0.6, 0], color: "lamp" });
    put({ shape: "cyl", sides: 10, size: [0.5, 0.06, 0.3], on: "lh", pos: [0, -0.62, 0], rot: [0, 0.6, 0], color: "bulb", emissive: true });
    const mx = T.tall ? -fw / 2 - 0.35 : fw / 2 + 0.35, mz = T.tall ? fd / 2 - 0.5 : -fd / 2 + 0.6;
    dio.cluster("mug", { at: [mx, PT + 0.4, fz + mz] });
    put({ id: "mug", shape: "cyl", sides: 12, size: [0.6, 0.7, 0.6], on: "top", pos: [mx, 0, mz], color: "mug", cluster: "mug", shadow: 0.25 });
    put({ shape: "cyl", sides: 12, size: [0.48, 0.02, 0.48], on: "mug", pos: [0, -0.1, 0], color: "tea" });
    put({ size: [0.1, 0.36, 0.3], on: "mug", pos: [0.34, -0.55, 0], color: "mug" });
    spec.build(T.tall);
    sparks = dio.points({ cap: PART, paint: star });
    T.hudDirty = T.dirty = true;
  }

  function feltArt(ctx: CanvasRenderingContext2D) {
    spec.feltArt?.(ctx);
    if (P.night) {
      // Soft rings of light under the lamp, fading out across the felt.
      ctx.fillStyle = "#ffe2a8";
      ctx.globalAlpha = P.glow * 0.5;
      ctx.save();
      T.quad(ctx, -T.fw / 2, -T.fd / 2, T.fw / 2, T.fd / 2);
      ctx.clip();
      for (let k = 0; k < 4; k++) T.ring(ctx, T.lampX, T.lampZ, 2.2 + k * 1.5, 0.9), ctx.fill();
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
  const SPK = ["#ffffff", "#ffd36b", "#9fe7ff", "#ffb3c7"];
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
  function drawToast(ctx: CanvasRenderingContext2D) {
    if (toastT <= 0) return;
    const u = 1 - toastT;
    T.screen(toastX, 0.9, toastZ, tmp);
    ctx.globalAlpha = Math.min(1, toastT * 4);
    ctx.font = `900 ${T.tall ? 22 : 26}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2433";
    ctx.fillStyle = toastC;
    ctx.strokeText(toastS, tmp[0]!, tmp[1]! - u * 26);
    ctx.fillText(toastS, tmp[0]!, tmp[1]! - u * 26);
    ctx.globalAlpha = 1;
  }

  // ---- the camera: the game's yaw and pitch, fitted to the points it names, under the HUD ----
  const goal = { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: PT, tz: 0, ox: 0, oy: 0, fov: 0.42 }, pts: number[] = [];
  function setView() {
    const c = goal;
    pts.length = 0;
    const [yaw, pitch] = spec.view(T.tall, pts);
    for (let i = 0; i < pts.length; i += 3) (pts[i + 1] = pts[i + 1]! + TOP), (pts[i + 2] = pts[i + 2]! + T.fz);
    (c.yaw = yaw * D), (c.pitch = pitch * D), (c.tx = 0), (c.ty = PT), (c.tz = T.fz);
    dio.fit(c, pts, { x0: 8, x1: dio.width - 8, y0: V[3]!, y1: Math.max(V[3]! + 80, dio.height - V[4]!) });
    Object.assign(dio.cam, c);
    T.hudDirty = T.dirty = true;
  }

  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  ro.observe(head);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = isLight() ? LIGHT : DARK;
        if (nx !== P) {
          P = nx;
          dio.setLight(P.light, P.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!] as string;
          spec.theme?.();
          T.dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kb = stage.querySelector('.gk-bar .gk:not([hidden]):not([aria-label^="Mute"])')!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kb.bottom > sr.bottom - 24 ? sr.bottom - kb.top + 6 : 6;
        const t = sr.width / Math.max(1, sr.height) < 1.2;
        if (t !== T.tall) (T.tall = t), rebuild();
        setView();
      }
    },
    step(e, dt) {
      let moving = false;
      for (let k = 0; k < NT; k++) {
        if (!TF[k] || e.time < TT[k]!) continue;
        const w = TF[k]!;
        TF[k] = 0;
        moving = true;
        spec.timer(w);
      }
      if (spec.step?.(dt)) moving = true;
      if (stepFx(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      if (moving) e.busy(), (T.dirty = true);
    },
    render() {
      if (spec.pose?.(engine.time)) engine.busy(), (T.dirty = true);
      if (T.hudDirty) (T.hudDirty = false), spec.write();
      if (T.dirty) (T.dirty = false), fxPoints(), dio.draw();
    },
  });

  // The play key takes the focus on a press (so the keys work after a tap).
  play.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    play.focus({ preventScroll: true });
  }, sig);
  return T;
}
export type Table = ReturnType<typeof cardTable>;

/** A HUD writer that only touches the DOM when a value changes. */
export function differ() {
  const last: unknown[] = [];
  return (i: number, v: unknown) => (last[i] === v ? false : ((last[i] = v), true));
}
/** m:ss. */
export const mmss = (s: number) => `${(s / 60) | 0}:${("0" + ((s | 0) % 60)).slice(-2)}`;
/** 1,250. */
export const num = (n: number) => {
  const s = "" + Math.abs(n), out = s.length > 3 ? s.slice(0, -3) + "," + s.slice(-3) : s;
  return n < 0 ? "−" + out : out;
};
