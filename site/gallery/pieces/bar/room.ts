// The bar-games series' games room (Darts, Cup Toss, Hoop Shot, Air Hockey), after Shuffle Shot's:
// a floor, two walls, a rug, a plant in the corner and a neon sign on the back wall; a bright
// afternoon in light mode, a neon night in dark mode. Also the parts every piece in the series
// shares: colour keys that follow the theme (`put`, `recolor`), painting in a plane (`quad`,
// `text`), the stage's page parts (canvas, play surface, HUD stickers, end card: `shell`), timed
// beats that hold the engine awake (`beats`), a camera tween (`camTween`) and a pooled effects
// layer (`effects`). No allocation in a frame. A candidate for a Fizlet brick (a tabletop game shell).
import type { Diorama, DioramaObject, DioramaObjectDef, DioramaPoints } from "../../../../src/diorama";
import type { Engine } from "../../../../src/kernel/index";

/** A theme's look: colours by key, the light, ambient, how glossy the polish is, night or day. */
export type Look = { c: Record<string, string>; light: [number, number, number]; amb: number; sheen: number; night: boolean };

const DAY: Record<string, string> = {
  bg: "#f1e9df", floor: "#ddd4c8", rug: "#bfe0d6", rug2: "#cfe8df", wallB: "#f6dcd2", wallR: "#d8e4f0", trim: "#e8c9bb",
  pot: "#e8a27f", leaf: "#93cf9f", leaf2: "#b6e0a9", shadow: "#3a2d3c", neon: "#ef8f7a", neon2: "#6f9fd8",
  you: "#f07f68", bot: "#6f9fd8", steel: "#e4e7ee", ink: "#1f2433", wood: "#c48d63", wood2: "#a8744f", glow: "#ffd9a0",
};
const NIGHT: Record<string, string> = {
  ...DAY, bg: "#120f1f", floor: "#231e36", rug: "#2d2546", rug2: "#352c52", wallB: "#1d1a33", wallR: "#1b2438", trim: "#2a2546",
  pot: "#7a4a52", leaf: "#3f6f63", leaf2: "#4e8473", shadow: "#000000", neon: "#ff5fa8", neon2: "#4ee6ff", steel: "#b7bccb",
  wood: "#6b4a3a", wood2: "#55392d",
};
/** The two looks for a piece: the room's colours with the piece's own on top. */
export function looks(day: Record<string, string>, night: Record<string, string>): [Look, Look] {
  return [
    { c: { ...DAY, ...day }, light: [0.5, 1, 0.55], amb: 0.52, sheen: 0.32, night: false },
    { c: { ...NIGHT, ...day, ...night }, light: [0.35, 1, 0.6], amb: 0.4, sheen: 0.22, night: true },
  ];
}
/** Light mode is on (the site's `data-theme`). */
export const isLight = () => document.documentElement.dataset.theme === "light";

/** An object whose `color` is a colour key: it follows the theme. */
export type Def = Omit<DioramaObjectDef, "color"> & { color?: string };
/** The neon sign on the back wall: its word, a glyph before it, where, and how big. */
export type Sign = { text: string; glyph: string; x: number; y: number; size: number };

const FONT = "ui-rounded,'SF Pro Rounded',Nunito,system-ui,sans-serif";
/** The series' font at `px` (weight 900 unless given). */
export const font = (px: number, w = 900) => `${w} ${px}px ${FONT}`;

/** The room kit on `dio`; `L()` is the current look. */
export function kit(dio: Diorama, L: () => Look) {
  const keyed: DioramaObject[] = [], names: string[] = [], tmp = new Float64Array(3), S = new Float64Array(8);
  const k = {
    /** Add an object; a `color` is a key into the look. */
    put(d: Def) {
      const c = d.color, ob = dio.add({ pick: false, ...d, color: c ? L().c[c] : undefined });
      if (c) keyed.push(ob), names.push(c);
      return ob;
    },
    /** The theme changed: every keyed object takes its new colour. */
    recolor() {
      const c = L().c;
      for (let i = 0; i < keyed.length; i++) keyed[i]!.color = c[names[i]!]!;
    },
    /** Forget the keyed objects (before `dio.clear()` and a rebuild). */
    clear() {
      dio.clear();
      keyed.length = names.length = 0;
    },
    /** Path a quad in the plane y from (x0, z0) to (x1, z1). */
    quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, y: number) {
      k.poly(ctx, x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    },
    /** Path a quad upright in the plane z from (x0, y0) to (x1, y1). */
    wquad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, z: number) {
      k.poly(ctx, x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
    },
    /** Path the four world points a, b, c, d. */
    poly(ctx: CanvasRenderingContext2D, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number) {
      dio.project(ax, ay, az, tmp), (S[0] = tmp[0]!), (S[1] = tmp[1]!);
      dio.project(bx, by, bz, tmp), (S[2] = tmp[0]!), (S[3] = tmp[1]!);
      dio.project(cx, cy, cz, tmp), (S[4] = tmp[0]!), (S[5] = tmp[1]!);
      dio.project(dx, dy, dz, tmp), (S[6] = tmp[0]!), (S[7] = tmp[1]!);
      ctx.beginPath();
      ctx.moveTo(S[0]!, S[1]!);
      ctx.lineTo(S[2]!, S[3]!);
      ctx.lineTo(S[4]!, S[5]!);
      ctx.lineTo(S[6]!, S[7]!);
      ctx.closePath();
    },
    /** Text in a plane: origin (x, y, z), its right along u and its down along v, per 100 px of art. */
    text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, z: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) {
      const r = dio.dpr;
      dio.project(x, y, z, tmp);
      const ax = tmp[0]!, ay = tmp[1]!;
      dio.project(x + ux, y + uy, z + uz, tmp);
      const bx = tmp[0]! - ax, by = tmp[1]! - ay;
      dio.project(x + vx, y + vy, z + vz, tmp);
      ctx.setTransform((r * bx) / 100, (r * by) / 100, (r * (tmp[0]! - ax)) / 100, (r * (tmp[1]! - ay)) / 100, r * ax, r * ay);
      ctx.fillText(s, 0, 0);
      ctx.setTransform(r, 0, 0, r, 0, 0);
    },
    /** The room: floor, back wall (at z = −d/2), right wall (x = w/2), a rug, a plant and the sign. */
    room(o: { w: number; d: number; h?: number; rug: [number, number, number, number]; plant: [number, number]; sign: Sign }) {
      const { w, d } = o, h = o.h ?? 13;
      dio.cluster("room", { fixed: 0 });
      k.put({ id: "floor", size: [w, 0.5, d], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0 });
      k.put({ id: "wallB", size: [w + 0.6, h, 0.5], pos: [0, -0.5, -d / 2 - 0.25], color: "wallB", cluster: "room", layer: 0.3 });
      k.put({ size: [0.5, h, d], pos: [w / 2 + 0.25, -0.5, 0], color: "wallR", cluster: "room", layer: 0.3 });
      // A skirting board along both walls.
      k.put({ size: [w + 0.6, 0.6, 0.12], pos: [0, 0, -d / 2 + 0.06], color: "trim", cluster: "room", layer: 0.31 });
      k.put({ size: [0.12, 0.6, d], pos: [w / 2 - 0.06, 0, 0], color: "trim", cluster: "room", layer: 0.31 });
      const [rx, rz, rw, rd] = o.rug;
      k.put({ id: "rug", size: [rw, 0.05, rd], on: "floor", pos: [rx, 0, rz], color: "rug", layer: 0.2 });
      k.put({ size: [rw - 1.6, 0.02, rd - 1.6], on: "rug", color: "rug2", layer: 0.21 });
      const s = o.sign, z = -d / 2 + 0.01;
      dio.decal("room", 0.5, (ctx) => k.neon(ctx, s, z));
      k.put({ id: "pot", shape: "cyl", sides: 10, top: 1.25, size: [2, 1.7, 2], pos: [o.plant[0], 0, o.plant[1]], color: "pot", cluster: "room", layer: 1, shadow: 0.2, on: "floor" });
      k.put({ id: "leaf", shape: "cyl", sides: 7, top: 0.4, size: [3.4, 2.6, 3.4], on: "pot", color: "leaf", layer: 1 });
      k.put({ shape: "cyl", sides: 7, top: 0.05, size: [2.4, 2.4, 2.4], on: "leaf", color: "leaf2", layer: 1 });
    },
    /** The neon sign: lit (three passes of glow) at night, painted by day. */
    neon(ctx: CanvasRenderingContext2D, s: Sign, z: number) {
      const P = L();
      ctx.font = font(100, 800);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let pass = 0; pass < (P.night ? 3 : 1); pass++) {
        ctx.globalAlpha = P.night ? [0.18, 0.35, 1][pass]! : 0.9;
        const big = (P.night ? [1.06, 1.02, 1][pass]! : 1) * s.size;
        ctx.fillStyle = P.c.neon!;
        k.text(ctx, s.text, s.x, s.y, z, big, 0, 0, 0, -big, 0);
        ctx.fillStyle = P.c.neon2!;
        k.text(ctx, s.glyph, s.x - 1.8 * s.size, s.y, z, 1.08 * big, 0, 0, 0, -1.08 * big, 0);
      }
      ctx.globalAlpha = 1;
    },
  };
  return k;
}

/** Text with the series' dark outline, centred at (x, y). */
export function outlined(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, fill: string) {
  ctx.font = font(px);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, px * 0.24);
  ctx.strokeStyle = "#1f2433";
  ctx.fillStyle = fill;
  ctx.strokeText(s, x, y);
  ctx.fillText(s, x, y);
}

/** The stage's page parts, all through the ledger: the canvas, a transparent key over it (the
 *  pointer surface and the keyboard's focus), the HUD (a row of stickers, a line of help, a live
 *  region) and the end card with its PLAY AGAIN key. `chips` is the row's markup. */
export function shell(engine: Engine, stage: HTMLElement, aria: string, chips: string) {
  const L = engine.ledger;
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "br-play";
  play.setAttribute("aria-label", aria);
  const hud = L.add(document.createElement("div"));
  hud.className = "br-hud";
  hud.innerHTML = `<div class="br-head"><p class="br-top">${chips}</p><p class="br-hint"></p></div><p class="br-live" aria-live="polite"></p><div class="br-card" role="dialog" aria-label="Game over" hidden><b></b><p></p><button type="button" class="bui-key br-again">PLAY AGAIN</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hint = head.children[1] as HTMLElement;
  const live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  stage.append(canvas, play, hud);
  let said = "";
  const last: unknown[] = [];
  return {
    canvas, play, hud, head, top, hint, card, again: card.lastElementChild as HTMLButtonElement,
    /** Say it in the live region (once per change). */
    say(s: string) {
      if (s !== said) (said = s), (live.textContent = s);
    },
    /** true (and remember v) when slot i changed: write the DOM only then. */
    set(i: number, v: unknown) {
      return last[i] === v ? false : ((last[i] = v), true);
    },
    /** Show the end card. */
    end(title: string, line: string) {
      (card.children[0] as HTMLElement).textContent = title;
      (card.children[1] as HTMLElement).textContent = line;
      card.hidden = false;
    },
  };
}

/** Timed beats: `later(sec, what)` runs `what` (a number > 0) after sec of engine time and holds the
 *  engine awake till then; `due(time)` returns the next beat that is due, or 0. Eight at a time. */
export function beats(engine: Engine) {
  const T = new Float64Array(8), F = new Uint8Array(8);
  return {
    later(sec: number, what: number) {
      for (let k = 0; k < 8; k++) if (!F[k]) return void ((T[k] = engine.time + sec), (F[k] = what), engine.busy(sec + 0.05), engine.wake());
    },
    due(time: number) {
      for (let k = 0; k < 8; k++) {
        const w = F[k]!;
        if (w && time >= T[k]!) return (F[k] = 0), w;
      }
      return 0;
    },
    clear() {
      F.fill(0);
    },
  };
}

/** The camera's goal and a tween toward it (snap: at once). `step` returns true while it moves. */
export function camTween(dio: Diorama) {
  const goal = { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.4 };
  const F = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  let on = false;
  return {
    goal,
    go(snap: boolean) {
      if (snap) Object.assign(dio.cam, goal), (on = false);
      else on = true;
    },
    step(dt: number) {
      if (!on) return false;
      const c = dio.cam, k = 1 - Math.exp(-dt * 5);
      let d = 0;
      for (let i = 0; i < 8; i++) {
        const f = F[i]!;
        c[f] += (goal[f] - c[f]) * k;
        d = Math.max(d, Math.abs(goal[f] - c[f]) / (i > 5 ? 40 : i < 2 ? 0.05 : 1));
      }
      if (d < 0.01) Object.assign(c, goal), (on = false);
      return true;
    },
  };
}

/** A pooled effects layer: `spawn` a particle (x y z, v, life, size, its kind and colour), `step`
 *  moves them (kind 0 stays put and fades, 1 falls fast: a spark, 2 drifts down: dust, 3 flutters:
 *  confetti) and `draw` writes them into a diorama points pool. Nothing allocates. */
export function effects(dio: Diorama, cap: number, floor: number, o: { cluster?: string; layer?: number } = {}) {
  const PS = 10, fx = new Float64Array(cap * PS), cols: string[] = new Array(cap).fill("#ffffff");
  const pts: DioramaPoints = dio.points({ cap, ...o });
  return {
    pts,
    spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string) {
      for (let k = 0; k < cap; k++) {
        const q = k * PS;
        if (fx[q + 6]! > 0) continue;
        fx[q] = x; fx[q + 1] = y; fx[q + 2] = z; fx[q + 3] = vx; fx[q + 4] = vy; fx[q + 5] = vz;
        fx[q + 6] = fx[q + 7] = life; fx[q + 8] = kind; fx[q + 9] = size;
        cols[k] = color;
        return;
      }
    },
    step(dt: number) {
      let any = false;
      for (let k = 0; k < cap; k++) {
        const q = k * PS;
        if (fx[q + 6]! <= 0) continue;
        any = true;
        fx[q + 6] = fx[q + 6]! - dt;
        const kind = fx[q + 8]!;
        if (kind === 0) continue;
        if (kind === 3) (fx[q + 3] = fx[q + 3]! * (1 - dt * 2)), (fx[q + 5] = fx[q + 5]! * (1 - dt * 2));
        fx[q] = fx[q]! + fx[q + 3]! * dt; fx[q + 1] = fx[q + 1]! + fx[q + 4]! * dt; fx[q + 2] = fx[q + 2]! + fx[q + 5]! * dt;
        fx[q + 4] = kind === 3 ? Math.max(-1.6, fx[q + 4]! - dt * 6) : fx[q + 4]! - dt * (kind === 1 ? 9 : 1.5);
        if (fx[q + 1]! < floor) (fx[q + 1] = floor), (fx[q + 3] = fx[q + 5] = 0);
      }
      return any;
    },
    clear() {
      fx.fill(0);
      pts.n = 0;
    },
    draw() {
      let n = 0;
      for (let k = 0; k < cap; k++) {
        const q = k * PS, life = fx[q + 6]!;
        if (life <= 0) continue;
        const u = life / fx[q + 7]!, kind = fx[q + 8]!;
        pts.x[n] = fx[q]!; pts.y[n] = fx[q + 1]!; pts.z[n] = fx[q + 2]!;
        pts.r[n] = fx[q + 9]! * (kind === 0 ? 0.4 + u * 0.6 : kind === 2 ? 2 - u : 1);
        pts.a[n] = kind === 0 || kind === 2 ? u * 0.5 : Math.min(1, u * 2);
        pts.color[n] = kind === 1 && u < 0.5 ? "#ffd36b" : cols[k]!;
        n++;
      }
      pts.n = n;
    },
  };
}
