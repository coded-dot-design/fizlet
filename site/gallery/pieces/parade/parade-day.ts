// "Parade Day" (hero, diorama): a small city street on a tabletop, on a parade morning. Low-poly shops
// and flats line both sides, the crowd packs the sidewalks, lampposts lean their arms and banners out
// over the street, and confetti flies. You steer the giant turkey balloon (ours: a plump bird with a
// fan of a tail) held by six handlers walking down the middle: ← → (or drag) leans their lines, the
// team walks over and the balloon swings after it. Gusts push it sideways; the drifting leaves and
// the wind sock in the corner give each one away a beat early. Bump an arm or a banner and the
// balloon squashes (a patch goes on); the third bump lets the air out. Reach the grandstand for the
// score: distance, the bumps, the finish and the Perfect float bonus. The camera follows the float
// down the table. Dark is an evening parade under the street lamps.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D: shapes, the depth sort with the crowd and the
// confetti in it, the follow camera), @fzlt/core/slot, @fzlt/core/sound. The float is ./model.ts,
// pure and seeded (tests/parade-day.test.mjs); this file is the scene and the controls
// (tests/parade-day.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { BR, DEFLATE, DONE, EV_BUMP, EV_DEFLATE, EV_FINISH, EV_FLAT, EV_GUST, EV_START, HALF, IDLE, LEN, RUN, autopilot, float } from "./model";

const TAU = 6.283185307179586;
const LIGHT: Record<string, string> = {
  bg: "#efe6da", floor: "#dccbb3", wall: "#f3e2cf", table: "#b9835a", top: "#d9a877", street: "#767a88", walk: "#ece1d1", dash: "#ffd166", line: "#fffaf1",
  bld0: "#ee8f73", bld1: "#f2c46b", bld2: "#93cbae", bld3: "#aebbe2", bld4: "#f3e3c8", bld5: "#d39b7a", awn0: "#e5484d", awn1: "#2f8f83", awn2: "#f2a541", awn3: "#5b6bbf",
  win: "#46526e", trim: "#fbf5ea", pole: "#3d4255", lamp: "#ffe7a0", ban0: "#e5484d", ban1: "#f2a541", ban2: "#2f8f83", ban3: "#5b6bbf", banS: "#fff6e6",
  stand: "#cfc6d6", stand2: "#e6ddea", roof: "#e5484d", body: "#a1603e", body2: "#b86f48", head: "#f4dcb5", wing: "#7f4a32", foot: "#f2a541",
  fe0: "#c4553b", fe1: "#e88a3c", fe2: "#f2c450", jacket: "#2f8f83", pants: "#2b3350", skin: "#f1c7a3", cap: "#fff6e6", tank: "#9aa0b4", shadow: "#3a2d3c",
};
const DARK: Record<string, string> = {
  ...LIGHT, bg: "#141a2c", floor: "#262b42", wall: "#2c3250", table: "#6f4f3a", top: "#8b6446", street: "#3e4254", walk: "#66637c", dash: "#e9b949", line: "#d9d4e4",
  bld0: "#a85f56", bld1: "#a98a50", bld2: "#5d8a7a", bld3: "#6a76a3", bld4: "#a79c8e", bld5: "#8c6553", win: "#ffd47a", trim: "#c9c4d4", lamp: "#fff1b0",
  stand: "#7d7590", stand2: "#958ca6", body: "#8a5236", body2: "#9c5e3e", head: "#dcc39f", jacket: "#2a7a70", shadow: "#000000", cap: "#e8e0d0",
};
const LIT = { light: [0.45, 1, 0.55], amb: 0.52 }, NIGHT = { light: [0.3, 1, 0.6], amb: 0.42 };
const SHIRTS = ["#e5484d", "#f2a541", "#2f8f83", "#5b6bbf", "#fff6e6", "#a99be0", "#7fcfa8", "#f08e6f", "#3d4255"];
const SKINS = ["#f1c7a3", "#d9a37a", "#a8714f", "#7a4f36"];
const CONF = ["#e5484d", "#f2c450", "#2f8f83", "#5b6bbf", "#fffaf1", "#f08e6f", "#7fcfa8"];
const LEAF = ["#d9682b", "#e89a2c", "#b8452f", "#c9a03a"];
/** The balloon's bottom over the street; its body's rings (height, radius); the squash variants. */
const BY = 2.45, RINGS = [0, 0.62, 0.42, 1.05, 1.0, 1.22, 1.65, 1.14, 2.1, 0.66], VH = [1, 0.8, 0.62, 0.44, 0.28, 0.14], VW = [1, 1.1, 1.2, 1.28, 1.34, 1.4];
const ALIVE = 5, FXN = 300, FS = 11;
/** A feather (up is −z) and a wing (it hangs: +z), as unit outlines. */
const FEATHER = [[0, 0], [0.75, -0.45], [1, -0.68], [0.72, -0.9], [0, -1], [-0.72, -0.9], [-1, -0.68], [-0.75, -0.45]];
const WING = [[0, 0], [0.4, 0.15], [0.55, 0.65], [0.3, 1.05], [0.02, 0.75]];
/** An outline scaled (sx across, sz along) and turned by a in its own plane. */
const spin = (o: number[][], a: number, sx: number, sz: number) => o.map(([x, z]) => [x! * sx * Math.cos(a) - z! * sz * Math.sin(a), x! * sx * Math.sin(a) + z! * sz * Math.cos(a)]);

export type ParadeScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly f: ReturnType<typeof float>;
  readonly state: { mode: number; z: number; bx: number; bumps: number; card: boolean; score: number; variant: number };
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): ParadeScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;

  // The page: the canvas, a key over it (the pointer surface and the keyboard's focus), the stickers,
  // the card and the keys bar. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "pd-play";
  play.setAttribute("aria-label", "Parade Day: left and right arrows lean the handlers' lines to steer the balloon; Space or Enter starts (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "pd-hud";
  hud.innerHTML = `<div class="pd-head"><p class="pd-top"><b class="pd-chip">Distance <span>0</span> m</b><b class="pd-chip pd-air">Air <i></i><i></i><i></i></b></p><p class="pd-hint"></p></div><p class="pd-live" aria-live="polite"></p><div class="pd-card" role="dialog" aria-label="Parade Day"><b>Parade Day</b><p>Lean the handlers' lines into the wind and keep the turkey clear of the lampposts and banners, all the way to the grandstand.</p><p class="pd-stats"></p><button type="button" class="bui-key pd-go">START THE PARADE</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const dist = top.children[0]!.firstElementChild as HTMLElement, airs = top.children[1]!.querySelectorAll("i");
  const cardT = card.children[0] as HTMLElement, cardP = card.children[1] as HTMLElement, cardS = card.children[2] as HTMLElement, go = card.children[3] as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", bump: "hit", gust: "click", deflate: "hurt", flat: "end", finish: "win" }, volume: 0.1 });
  // The keys: mute, then ← and → (held).
  const K = new Float64Array(3); // left held, right held, the pointer's lean (NaN: none)
  K[2] = NaN;
  const [muteK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: 0 },
    { label: "◀", aria: "Lean left (←)", id: 1, hold: true },
    { label: "▶", aria: "Lean right (→)", id: 2, hold: true },
  ], (id, down) => {
    if (!id) return void (down && toggle());
    K[id - 1] = down ? 1 : 0;
    if (down && f.S[0] === IDLE) start();
    lean();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };
  const I = new Float64Array(2);
  let f = float(1, I), auto = false, seed = 1;
  const lean = () => ((I[0] = K[2] === K[2] ? K[2]! : K[1]! - K[0]!), alive());

  // ---- the diorama ----
  const dio = diorama(canvas, { light: LIT.light, ambient: LIT.amb, background: () => P.bg!, overlay: drawOverlay, get shadowColor() { return P.shadow!; } });
  const keyed: DioramaObject[] = [], keyName: string[] = [], glow: DioramaObject[] = [];
  const put = (d: DioramaObjectDef & { color?: string; glow?: boolean }) => {
    const k = d.color, ob = dio.add({ ...d, color: k ? P[k] : undefined, pick: false });
    if (k) keyed.push(ob), keyName.push(k);
    if (d.glow) glow.push(ob);
    return ob;
  };
  // The balloon: one root (moves, sways, spins as it deflates) and a set of parts per squash variant.
  let bal: DioramaObject, vparts: DioramaObject[][] = [], heads: DioramaObject[] = [], variant = 0;
  const posts: DioramaObject[] = [], lamps: DioramaObject[] = [], hand: DioramaObject[][] = [];
  type Crowd = { p: DioramaPoints; z0: number; y: Float64Array; side: number; hot: boolean };
  const crowd: Crowd[] = [];
  /** A pool of people (heads in the depth sort; bodies and arms painted under them). */
  const people = (cap: number, cl: string, z0: number, side: number) => {
    const c: Crowd = { p: null!, z0, y: new Float64Array(cap), side, hot: false };
    c.p = dio.points({ cap, cluster: cl, layer: 9, paint: (ctx, i, p) => person(ctx, i, p, c.hot) });
    crowd.push(c);
    return c;
  };
  let fxB: DioramaPoints, fxF: DioramaPoints;
  const FAN = 7;

  function buildScene() {
    dio.clear();
    keyed.length = keyName.length = glow.length = posts.length = lamps.length = hand.length = crowd.length = 0;
    vparts = [];
    heads = [];
    const R = seeded(seed * 7 + 3), zMid = -LEN / 2 - 1, zLen = LEN + 16;
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    put({ size: [140, 0.5, 220], pos: [0, -4.7, -40], color: "floor", cluster: "room", layer: 0 });
    put({ size: [140, 26, 0.5], pos: [0, -4.4, -98], color: "wall", cluster: "room", layer: 0.3 });
    // The table and the street on it: asphalt, two raised sidewalks.
    put({ id: "table", size: [18.4, 4, zLen], pos: [0, -4.2, zMid], color: "table", cluster: "table", layer: 0 });
    put({ id: "tt", size: [18.8, 0.2, zLen + 0.4], on: "table", color: "top", layer: 0.2 });
    put({ id: "street", size: [HALF * 2, 0.02, zLen - 2], on: "tt", color: "street", layer: 0.4 });
    for (const s of [-1, 1]) put({ size: [1.6, 0.16, zLen - 2], on: "tt", pos: [s * 3.8, 0, 0], color: "walk", layer: 0.5 });
    dio.decal("table", 1, streetDecal);
    // The blocks: shops and flats on both sides, the crowd on the sidewalk in front of each.
    let n = 0;
    for (const s of [-1, 1]) {
      let z = 6;
      while (z > -LEN - 1) {
        const w = Math.min(z + LEN + 1, 3 + R() * 2.2), h = 2.4 + R() * 3.8, d = 2.8 + R() * 0.7, cz = z - w / 2, id = "b" + n++, bx = s * (4.6 + d / 2);
        put({ id, size: [d, h, w - 0.05], pos: [bx, 0, cz], color: "bld" + ((R() * 6) | 0), cluster: id, layer: 1 });
        put({ size: [d + 0.16, 0.16, w + 0.1], on: id, color: "trim", layer: 1.2 });
        if (R() < 0.35) put({ shape: "cyl", sides: 8, size: [0.7, 0.8, 0.7], on: id, pos: [s * 0.4, 0.16, (R() - 0.5) * (w - 1.4)], color: "tank", layer: 1.3 });
        // The street face: a shop window and an awning, then a strip of windows on every floor.
        const fx = -s * (d / 2 + 0.02);
        put({ size: [0.05, 0.75, w - 0.9], on: id, pos: [fx, -h + 0.2, 0], color: "win", glow: true, layer: 1.4 });
        put({ shape: "wedge", size: [0.7, 0.32, w - 0.7], on: id, pos: [fx - s * 0.35, -h + 1.0, 0], rot: [0, s > 0 ? 0 : Math.PI, 0], color: "awn" + ((R() * 4) | 0), layer: 1.5 });
        for (let y = 1.55; y < h - 0.6; y += 1.15) put({ size: [0.05, 0.5, w - 1.1], on: id, pos: [fx, -h + y, 0], color: "win", glow: true, layer: 1.4 });
        // The crowd: two rows, a gap at each lamppost.
        const cap = Math.ceil(w / 0.5) * 2, cr = people(cap, id, z - w / 2, s), p = cr.p, y = cr.y;
        for (let row = 0; row < 2; row++)
          for (let k = 0; k < cap / 2; k++) {
            const pz = z - 0.25 - k * 0.5 + (R() - 0.5) * 0.12;
            if (pz < z - w + 0.1 || pz < -LEN - 0.5 || pz > 5.5 || nearPost(s, pz)) continue;
            const j = p.n++;
            (p.x[j] = s * (row ? 4.1 : 3.5) + (R() - 0.5) * 0.1), (p.z[j] = pz), (p.r[j] = 0.13), (y[j] = p.y[j] = 0.42 + row * 0.04 + R() * 0.05);
            p.color[j] = SHIRTS[(R() * SHIRTS.length) | 0];
          }
        z -= w;
      }
    }
    // The lampposts: a pole on the curb, an arm out over the street, a lamp at its tip and a banner
    // that swings when the balloon bumps it.
    for (let i = 0; i < f.np; i++) {
      const s = f.PS[i]!, r = f.PR[i]!, id = "p" + i, al = r + 0.25;
      put({ id, shape: "cyl", sides: 8, size: [0.34, 0.2, 0.34], pos: [s * 3.25, 0.14, f.PZ[i]!], color: "pole", cluster: id, layer: 2, shadow: 0.25 });
      put({ id: id + "p", shape: "cyl", sides: 8, size: [0.14, 4.55, 0.14], on: id, color: "pole" });
      put({ id: id + "a", size: [al, 0.1, 0.1], on: id + "p", pos: [-s * al / 2, -0.2, 0], color: "pole" });
      lamps.push(put({ shape: "cyl", sides: 8, top: 0.6, size: [0.34, 0.24, 0.34], on: id + "a", pos: [-s * (al / 2 - 0.05), -0.36, 0], color: "lamp", emissive: true }));
      posts.push(put({ id: id + "g", shape: "group", size: [0, 0, 0], on: id + "a", pos: [-s * (al * 0.42), -0.1, 0] }));
      const bw = Math.min(1.1, r * 0.75), c = i & 3;
      put({ id: id + "b", size: [bw, 1.35, 0.05], on: id + "g", pos: [0, -1.4, 0], color: "ban" + c });
      put({ size: [bw * 0.62, 0.36, 0.03], on: id + "b", pos: [0, -0.86, 0.035], color: "banS" });
    }
    // The finish: an arch over the street, and the grandstand at the end of the table, full.
    dio.cluster("arch", { at: [0, 3, -LEN] });
    for (const s of [-1, 1]) put({ id: "ap" + s, shape: "cyl", sides: 8, size: [0.24, 6.9, 0.24], pos: [s * 3.25, 0.16, -LEN], color: "pole", cluster: "arch", layer: 2 });
    put({ size: [6.9, 0.8, 0.12], on: "ap1", pos: [-3.25, -0.95, 0], color: "roof", cluster: "arch", layer: 3 });
    dio.cluster("stand", { at: [0, 1, -LEN - 4] });
    const st = people(120, "stand", -LEN - 4, 0), sp = st.p, sy = st.y;
    for (let t = 0; t < 3; t++) {
      put({ id: "st" + t, size: [13, 0.55 + t * 0.55, 1.4], pos: [0, 0, -LEN - 2.6 - t * 1.4], color: t & 1 ? "stand2" : "stand", cluster: "stand", layer: 1 + t * 0.1 });
      for (let k = 0; k < 34; k++) {
        const j = sp.n++;
        (sp.x[j] = -6.1 + k * 0.37 + (R() - 0.5) * 0.08), (sp.z[j] = -LEN - 2.5 - t * 1.4), (sp.r[j] = 0.14), (sy[j] = sp.y[j] = 0.75 + t * 0.55);
        sp.color[j] = SHIRTS[(R() * SHIRTS.length) | 0];
      }
    }
    // Its back: a board in the parade's red, and a flag pole at each end.
    put({ size: [13.4, 3, 0.2], pos: [0, 0, -LEN - 6.6], color: "roof", cluster: "stand", layer: 0.5 });
    for (const s of [-1, 1]) {
      put({ id: "fp" + s, shape: "cyl", sides: 6, size: [0.12, 4.6, 0.12], pos: [s * 6.5, 0, -LEN - 6.4], color: "pole", cluster: "stand", layer: 1.5 });
      put({ size: [0.9, 0.55, 0.04], on: "fp" + s, pos: [s * -0.45, -0.6, 0], color: s < 0 ? "ban2" : "ban1", layer: 1.6 });
    }
    // The balloon (its cluster follows it), then the handlers: six in teal, under it.
    bal = put({ id: "bal", shape: "group", size: [2.4, 0, 2], cluster: "parade", layer: 4 });
    for (let v = 0; v < VH.length; v++) vparts.push(turkey(v));
    dio.decal("parade", 20, face);

    for (let i = 0; i < 6; i++) {
      const id = "h" + i, parts: DioramaObject[] = [];
      parts.push(put({ id, shape: "group", size: [0.36, 0, 0.3], cluster: "parade", layer: 1 }));
      for (const s of [-1, 1]) {
        parts.push(put({ id: id + "l" + s, shape: "group", size: [0, 0, 0], on: id, pos: [s * 0.07, 0.34, 0], layer: 1.1 }));
        put({ size: [0.09, 0.34, 0.1], on: id + "l" + s, pos: [0, -0.34, 0], color: "pants", layer: 1.1 });
      }
      put({ id: id + "b", shape: "cyl", sides: 8, top: 0.82, size: [0.3, 0.36, 0.24], on: id, pos: [0, 0.32, 0], color: "jacket", layer: 1.2 });
      put({ id: id + "h", shape: "cyl", sides: 8, size: [0.19, 0.19, 0.19], on: id + "b", color: "skin", layer: 1.3 });
      put({ shape: "cyl", sides: 8, size: [0.22, 0.06, 0.22], on: id + "h", color: "cap", layer: 1.4 });
      hand.push(parts);
    }
    dio.decal("parade", 0.6, lines);
    // Confetti, leaves and puffs, in the parade's cluster so they depth-sort with the balloon: each
    // frame a bit goes in the pool behind it (under the handlers and the balloon) or the one in front.
    fxB = dio.points({ cap: FXN, cluster: "parade", layer: 0.5, paint: bit });
    fxF = dio.points({ cap: FXN, cluster: "parade", layer: 9.5, paint: bit });
    showVariant(0);
  }
  function nearPost(s: number, z: number) {
    for (let i = 0; i < f.np; i++) if (f.PS[i] === s && Math.abs(f.PZ[i]! - z) < 0.4) return true;
    return Math.abs(z + LEN) < 0.35;
  }
  /** One squash variant of the turkey: the tail fan, the body's rings, the head, the wings, the feet. */
  function turkey(v: number) {
    const h = VH[v]!, w = VW[v]!, id = "v" + v, list: DioramaObject[] = [];
    const add = (d: DioramaObjectDef & { color?: string }) => (list.push(put({ ...d, hidden: true })), list[list.length - 1]!);
    add({ id, shape: "group", size: [0, 0, 0], on: "bal", layer: 4 });
    // The fan: seven feathers in three warm colours, behind the body; it droops as the air goes.
    const droop = 1 - h;
    for (let k = 0; k < FAN; k++) {
      const a0 = (k / (FAN - 1) - 0.5) * (2.6 + droop * 0.9), a = a0 + Math.sign(a0) * droop * 0.5, len = (2.75 - Math.abs(k - 3) * 0.12) * (0.55 + h * 0.45);
      // The outline is turned in its own plane, then stood up (rot x): z up the feather.
      add({ shape: "prism", outline: spin(FEATHER, a, 0.42 * w, len), size: [1, 0.12, 1], on: id, pos: [0, 0.95 * h, -0.7 * w], rot: [Math.PI / 2, 0, 0], color: "fe" + (Math.abs(k - 3) % 3), layer: 5 - Math.abs(k - 3) * 0.01 });
    }
    // The body: stacked rings, round and plump.
    let prev = id;
    for (let i = 0; i < RINGS.length - 2; i += 2) {
      const y0 = RINGS[i]!, r0 = RINGS[i + 1]!, y1 = RINGS[i + 2]!, r1 = RINGS[i + 3]!, rid = id + "r" + i;
      add({ id: rid, shape: "cyl", sides: 12, top: r1 / r0, size: [2 * r0 * w, (y1 - y0) * h, 1.8 * r0 * w], on: prev, color: i === 4 ? "body2" : "body", layer: 6 + i * 0.01 });
      prev = rid;
    }
    add({ shape: "cyl", sides: 12, top: 0.35, size: [1.32 * w, 0.32 * h, 1.2 * w], on: prev, color: "body", layer: 6.1 });
    // The head: up and forward, cream; the wings at the sides; little feet that dangle.
    add({ id: id + "n", shape: "cyl", sides: 10, top: 1.2, size: [0.56 * w, 0.28 * h, 0.56 * w], on: id, pos: [0, 2.12 * h, 0.5 * w], color: "head", layer: 7 });
    heads.push(add({ id: id + "n2", shape: "cyl", sides: 10, top: 0.62, size: [0.67 * w, 0.42 * h, 0.67 * w], on: id + "n", color: "head", layer: 7.01 }));
    for (const s of [-1, 1]) {
      add({ shape: "prism", outline: spin(WING, s * 0.35, s * w, h), size: [1, 0.14, 1], on: id, pos: [s * 1.02 * w, 1.45 * h, 0.35 * w], rot: [Math.PI / 2, 0, 0], color: "wing", layer: 6.5 });
      add({ shape: "cyl", sides: 6, top: 1.6, size: [0.12, 0.34 * h, 0.12], on: id, pos: [s * 0.32, -0.32 * h, 0.2], color: "foot", layer: 5.5 });
    }
    return list;
  }
  function showVariant(v: number) {
    if (v === variant && vparts[v]![1]!.hidden === false) return;
    for (let k = 0; k < vparts.length; k++) for (const ob of vparts[k]!) ob.hidden = k !== v || ob.shape === "group";
    variant = v;
  }

  // ---- painters ----
  const person = (ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints, c: boolean) => {
    const x = p.sx[i]!, y = p.sy[i]!, r = p.sr[i]!;
    if (r < 1.1) return void ((ctx.fillStyle = p.color[i]!), ctx.fillRect(x - 1, y - 1, 2, 3));
    ctx.fillStyle = p.color[i]!;
    ctx.beginPath();
    ctx.roundRect(x - r * 0.95, y + r * 0.35, r * 1.9, r * 2.4, r * 0.6);
    ctx.fill();
    if (c) {
      // Arms up: they're cheering.
      ctx.strokeStyle = p.color[i]!;
      ctx.lineWidth = Math.max(1, r * 0.45);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y + r * 0.8), ctx.lineTo(x - r * 1.3, y - r * 0.6), ctx.moveTo(x + r * 0.7, y + r * 0.8), ctx.lineTo(x + r * 1.3, y - r * 0.6);
      ctx.stroke();
    }
    ctx.fillStyle = SKINS[i & 3]!;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.72, 0, TAU);
    ctx.fill();
  };
  // Effects: x y z, vx vy vz, life, max, type (0 confetti, 1 leaf, 2 puff), spin, colour.
  const fx = new Float32Array(FXN * FS);
  const bit = (ctx: CanvasRenderingContext2D, j: number, p: DioramaPoints) => {
    const o = (p === fxF ? FX_F : FX_B)[j]! * FS, ty = fx[o + 8]!, x = p.sx[j]!, y = p.sy[j]!, r = Math.max(1.2, p.sr[j]!), sp = fx[o + 9]!;
    ctx.globalAlpha = p.a[j]!;
    if (ty === 2) {
      ctx.fillStyle = P === DARK ? "#d9d4e4" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = (ty ? LEAF : CONF)[fx[o + 10]!]!;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sp);
      if (ty) ctx.beginPath(), ctx.ellipse(0, 0, r * 1.5, r * 0.75 * Math.abs(Math.cos(sp * 1.7)) + 0.4, 0, 0, TAU), ctx.fill();
      else ctx.fillRect(-r, -r * 0.6 * Math.abs(Math.cos(sp * 2.3)) - 0.3, r * 2, r * 1.2 * Math.abs(Math.cos(sp * 2.3)) + 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };
  const FX_B = new Int32Array(FXN), FX_F = new Int32Array(FXN);
  function spawn(ty: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) {
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! > 0) continue;
      (fx[o] = x), (fx[o + 1] = y), (fx[o + 2] = z), (fx[o + 3] = vx), (fx[o + 4] = vy), (fx[o + 5] = vz);
      (fx[o + 6] = fx[o + 7] = life), (fx[o + 8] = ty), (fx[o + 9] = rnd() * TAU), (fx[o + 10] = (rnd() * (ty ? LEAF.length : CONF.length)) | 0);
      return;
    }
  }
  let rnd = seeded(1);
  function stepFx(dt: number) {
    let on = false;
    const wind = f.S[9]!;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS;
      if (fx[o + 6]! <= 0) continue;
      on = true;
      const ty = fx[o + 8]!;
      fx[o + 6] = fx[o + 6]! - dt;
      if (ty === 2) (fx[o + 3] = fx[o + 3]! * 0.94), (fx[o + 4] = fx[o + 4]! * 0.94), (fx[o + 5] = fx[o + 5]! * 0.94);
      else {
        // Flutter down: drag, a sway, the wind.
        fx[o + 4] = Math.max(ty ? -1.2 : -0.9, fx[o + 4]! - 6 * dt);
        fx[o + 3] = fx[o + 3]! + (wind * 0.5 - fx[o + 3]!) * dt * (ty ? 0.4 : 1.2) + Math.sin(fx[o + 9]! * 3) * dt * 1.5;
        fx[o + 9] = fx[o + 9]! + dt * (ty ? 3 : 7);
      }
      (fx[o] = fx[o]! + fx[o + 3]! * dt), (fx[o + 1] = fx[o + 1]! + fx[o + 4]! * dt), (fx[o + 2] = fx[o + 2]! + fx[o + 5]! * dt);
      if (fx[o + 1]! < 0.03) (fx[o + 1] = 0.03), (fx[o + 3] = fx[o + 4] = fx[o + 5] = 0);
    }
    return on;
  }
  function fxPoints() {
    // The balloon's view depth (its middle): a bit farther than that draws behind it, nearer in front.
    const M = bal.M, bd = dio.project(M[9]!, M[10]! + 1.4 * VH[variant]!, M[11]!, tmp2) ? tmp2[2]! : 0;
    fxB.n = fxF.n = 0;
    for (let k = 0; k < FXN; k++) {
      const o = k * FS, l = fx[o + 6]!;
      if (l <= 0) continue;
      const front = dio.project(fx[o]!, fx[o + 1]!, fx[o + 2]!, tmp2) && tmp2[2]! < bd, p = front ? fxF : fxB;
      const j = p.n++, u = l / fx[o + 7]!, ty = fx[o + 8]!;
      (front ? FX_F : FX_B)[j] = k;
      (p.x[j] = fx[o]!), (p.y[j] = fx[o + 1]!), (p.z[j] = fx[o + 2]!);
      p.r[j] = ty === 2 ? 0.18 + (1 - u) * 0.5 : ty ? 0.09 : 0.06;
      p.a[j] = ty === 2 ? u * 0.75 : Math.min(1, u * 4);
    }
  }
  /** Confetti from the crowd beside the balloon (a handful), or a big burst at the finish. */
  function confetti(n: number, z: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const s = rnd() < 0.5 ? -1 : 1;
      spawn(0, s * (3.6 + rnd() * 0.6), 0.8, z + (rnd() - 0.5) * spread, -s * (1.2 + rnd() * 2.2), 3.5 + rnd() * 3.5, (rnd() - 0.5) * 1.2, 2.2 + rnd() * 1.6);
    }
  }

  // ---- the street's paint, the shadows and the lines ----
  const tmp = new Float64Array(3), tmp2 = new Float64Array(3);
  function quad(ctx: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, y: number) {
    dio.project(x0, y, z0, tmp), ctx.moveTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y, z0, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x1, y, z1, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    dio.project(x0, y, z1, tmp), ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.closePath();
  }
  function ellipse(ctx: CanvasRenderingContext2D, x: number, z: number, rx: number, rz: number) {
    if (!dio.project(x, 0.01, z, tmp)) return;
    const k = dio.focal() / tmp[2]!;
    ctx.beginPath();
    ctx.ellipse(tmp[0]!, tmp[1]!, rx * k, rz * k * 0.62, 0, 0, TAU);
    ctx.fill();
  }
  function streetDecal(ctx: CanvasRenderingContext2D) {
    const z = f.S[2]!, y = 0.005;
    ctx.fillStyle = P.dash!;
    ctx.beginPath();
    for (let d = 4; d > -LEN; d -= 2.4) if (d < z + 14 && d > z - 40) quad(ctx, -0.07, d, 0.07, d - 1.2, y);
    ctx.fill();
    // The start line, and the finish line's checks.
    ctx.fillStyle = P.line!;
    ctx.beginPath();
    quad(ctx, -HALF, 0.2, HALF, -0.2, y);
    ctx.fill();
    if (z < 40 - LEN) {
      ctx.fillStyle = "#1f2433";
      ctx.beginPath();
      quad(ctx, -HALF, -LEN + 0.45, HALF, -LEN - 0.45, y);
      ctx.fill();
      ctx.fillStyle = "#fffaf1";
      ctx.beginPath();
      for (let i = 0; i < 20; i++) for (let k = 0; k < 3; k++) if ((i + k) & 1) quad(ctx, -HALF + i * 0.3, -LEN + 0.45 - k * 0.3, -HALF + i * 0.3 + 0.3, -LEN + 0.15 - k * 0.3, y);
      ctx.fill();
    }
    // Shadows: the balloon's (it floats), then the handlers'.
    ctx.fillStyle = P === DARK ? "rgba(0,0,0,0.32)" : "rgba(58,45,60,0.2)";
    const sq = VW[variant]!;
    ellipse(ctx, bal.M[9]! + 0.4, z - 0.3, 1.25 * sq, 1.05 * sq);
    for (let i = 0; i < 6; i++) ellipse(ctx, hand[i]![0]!.pos[0]!, hand[i]![0]!.pos[2]!, 0.22, 0.2);
  }
  const ATT = [-0.5, 0.75, 0.5, 0.75, -0.9, 0.05, 0.9, 0.05, -0.5, -0.6, 0.5, -0.6];
  function lines(ctx: CanvasRenderingContext2D) {
    const M = bal.M, k = VW[variant]!;
    ctx.strokeStyle = P === DARK ? "#d9d4e4" : "#2b3350";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const h = hand[i]![0]!;
      if (!dio.project(h.pos[0]!, 0.58, h.pos[2]!, tmp)) continue;
      // To a point on the balloon's bottom ring, as of the last draw.
      const ax = ATT[i * 2]! * k, az = ATT[i * 2 + 1]! * k;
      if (!dio.project(M[9]! + M[0]! * ax + M[2]! * az, M[10]! + M[3]! * ax + M[5]! * az + 0.15, M[11]! + M[6]! * ax + M[8]! * az, tmp2)) continue;
      ctx.moveTo(tmp[0]!, tmp[1]!), ctx.lineTo(tmp2[0]!, tmp2[1]!);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /** The face on the head: eyes that look where it drifts (shut tight in a bump), the beak, the
   *  wattle; a patch on the body for each bump. */
  /** World point of `ob`'s local (x, y, z) as of the last draw, projected into tmp. */
  function at(ob: DioramaObject, x: number, y: number, z: number) {
    const M = ob.M;
    return dio.project(M[9]! + M[0]! * x + M[1]! * y + M[2]! * z, M[10]! + M[3]! * x + M[4]! * y + M[5]! * z, M[11]! + M[6]! * x + M[7]! * y + M[8]! * z, tmp);
  }
  function face(ctx: CanvasRenderingContext2D) {
    const h = VH[variant]!, w = VW[variant]!, n = heads[variant]!, S = f.S;
    if (!at(n, 0, 0.2 * h, 0.36 * w)) return;
    const k = dio.focal() / tmp[2]!, x = tmp[0]!, y = tmp[1]!, sq = S[7]! > 0.05 || S[0] === DEFLATE || (S[0] === DONE && S[6]! >= 3), look = Math.max(-1, Math.min(1, S[5]! * 0.4)) * 0.07 * k;
    ctx.lineWidth = Math.max(1, k * 0.03);
    ctx.strokeStyle = "#1f2433";
    // Eyes: they look where it drifts; shut tight in a bump.
    for (const s of [-1, 1]) {
      const ex = x + s * 0.16 * k * w, ey = y - 0.06 * k * h;
      ctx.beginPath();
      if (sq) {
        ctx.moveTo(ex + s * 0.08 * k, ey - 0.06 * k), ctx.lineTo(ex - s * 0.06 * k, ey), ctx.lineTo(ex + s * 0.08 * k, ey + 0.06 * k);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = "#ffffff";
      ctx.ellipse(ex, ey, 0.1 * k, 0.13 * k * Math.max(0.5, h), 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1f2433";
      ctx.beginPath();
      ctx.arc(ex + look, ey + 0.02 * k, 0.05 * k, 0, TAU);
      ctx.fill();
    }
    // Brows up when a gust is coming.
    if (!sq && Math.abs(S[10]!) > 2.5) {
      ctx.beginPath();
      for (const s of [-1, 1]) ctx.moveTo(x + s * 0.07 * k, y - 0.27 * k * h), ctx.lineTo(x + s * 0.25 * k, y - 0.22 * k * h);
      ctx.stroke();
    }
    // Beak and wattle.
    const bh = Math.max(0.6, h);
    ctx.fillStyle = P.foot!;
    ctx.beginPath();
    ctx.moveTo(x - 0.09 * k, y + 0.06 * k), ctx.lineTo(x + 0.09 * k, y + 0.06 * k), ctx.lineTo(x, y + 0.22 * k * bh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e5484d";
    ctx.beginPath();
    ctx.ellipse(x + 0.07 * k, y + 0.27 * k * bh, 0.045 * k, 0.1 * k, 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Patches: a cross of tape on the belly for each bump.
    ctx.fillStyle = "#fff6e6";
    for (let i = 0, b = Math.min(3, S[6]!); i < b; i++) {
      if (!at(bal, (i - 1) * 0.5 * w, (0.75 + (i & 1) * 0.4) * h, 1.02 * w)) continue;
      const q = dio.focal() / tmp[2]!;
      ctx.save();
      ctx.translate(tmp[0]!, tmp[1]!);
      for (let r = 0; r < 2; r++) ctx.rotate(r ? 1.4 : 0.5 + i), ctx.fillRect(-0.19 * q, -0.055 * q, 0.38 * q, 0.11 * q), ctx.strokeRect(-0.19 * q, -0.055 * q, 0.38 * q, 0.11 * q);
      ctx.restore();
    }
  }

  // ---- the overlay: lamp glow at night, the finish label, the wind sock, the toast ----
  const FONT = "ui-rounded, \"SF Pro Rounded\", Nunito, system-ui, sans-serif", FONTS: string[] = [];
  const font = (px: number) => FONTS[px] || (FONTS[px] = `800 ${px}px ${FONT}`);
  function sticker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, bg: string, fg: string) {
    ctx.font = font(px);
    const w = ctx.measureText(text).width + px, h = px + 10, lx = x - w / 2, ly = y - h / 2;
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
  let toastT = 0, toastS = "", toastK = 0, said = "", hudDirty = true, dirty = true, tAmb = 0;
  const TOAST = ["#fffaf1", "#ffd36b", "#e5484d", "#7fcfa8"];
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const z = f.S[2]!;
    if (P === DARK) {
      ctx.fillStyle = "#ffe9a0";
      for (const l of lamps) {
        if (l.M[11]! > z + 6 || l.M[11]! < z - 30 || !dio.project(l.M[9]!, l.M[10]!, l.M[11]!, tmp)) continue;
        const r = (0.9 * dio.focal()) / tmp[2]!;
        for (let i = 2; i > 0; i--) (ctx.globalAlpha = 0.06 * (3 - i)), ctx.beginPath(), ctx.arc(tmp[0]!, tmp[1]!, r * i * 0.45, 0, TAU), ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (z < 34 - LEN && toastT <= 0 && dio.project(0, 6.8, -LEN, tmp)) sticker(ctx, "FINISH", tmp[0]!, tmp[1]!, Math.max(12, Math.min(18, Math.round((0.5 * dio.focal()) / tmp[2]!))), "#ffd36b", "#1f2433");
    // The wind sock: on a short pole under the mute key's corner; it fills and swings the way the
    // next gust will blow, a beat before it does.
    const W = dio.width, port = W / dio.height < 1.2, sx = W - (port ? 34 : 50), sy = Math.max(V[3]! - 34, port ? 64 : 14), wv = f.S[10]!, a = Math.min(1, Math.abs(wv) / 6), dir = wv < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "#1f2433";
    ctx.fillRect(-2, 0, 4, 58);
    ctx.fillRect(-9, 56, 18, 4);
    // Hanging when calm (down), straight out in a full gust; it points downwind.
    const hang = (Math.PI / 2) * (1 - a * 0.95);
    ctx.rotate(dir > 0 ? hang : Math.PI - hang);
    ctx.rotate(Math.sin(tAmb * 13) * 0.07 * a);
    for (let b = 0; b < 4; b++) {
      const x0 = b * 10, x1 = x0 + 10, h0 = 10 - b * 1.6, h1 = 10 - (b + 1) * 1.6;
      ctx.fillStyle = b & 1 ? "#fffaf1" : "#e5484d";
      ctx.beginPath();
      ctx.moveTo(x0, -h0), ctx.lineTo(x1, -h1), ctx.lineTo(x1, h1), ctx.lineTo(x0, h0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#1f2433";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -10), ctx.lineTo(40, -3.6), ctx.lineTo(40, 3.6), ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    sticker(ctx, "WIND", sx, sy + 70, 11, a > 0.4 ? "#ffd36b" : "#fffaf1", "#1f2433");
    if (toastT > 0) {
      const u = 1 - toastT / 1.1, s = u < 0.18 ? 0.6 + (u / 0.18) * 0.48 : u < 0.3 ? 1.08 - ((u - 0.18) / 0.12) * 0.08 : 1;
      const px = Math.round(Math.max(18, Math.min(28, W / 26)));
      ctx.save();
      ctx.globalAlpha = u < 0.18 ? u / 0.18 : u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.translate(W / 2, V[3]! + (dio.height - V[3]! - V[4]!) * 0.16 - (u > 0.8 ? (u - 0.8) * 50 : 0));
      ctx.scale(s, s);
      sticker(ctx, toastS, 0, 0, px, TOAST[toastK]!, toastK === 2 ? "#ffffff" : "#1f2433");
      ctx.restore();
    }
  }
  function toast(text: string, kind: number) {
    (toastS = text), (toastK = kind), (toastT = 1.1);
    say(text);
  }
  function say(t: string) {
    said = t;
    hudDirty = true;
  }

  // ---- the camera: framed once for the shape, then it follows the float down the table ----
  const FIT = new Float64Array(24);
  function frame() {
    const port = dio.width / dio.height < 1.1, c = dio.cam;
    (c.yaw = port ? -0.22 : -0.34), (c.pitch = port ? 0.6 : 0.5), (c.fov = 0.62), (c.tx = 0), (c.ty = 2.6), (c.tz = -3);
    const near = port ? 2.2 : 2.6, far = port ? -11 : -10, wx = port ? 3.7 : 6.2;
    FIT.set([-wx, 0, near, wx, 0, near, -wx, 0, far, wx, 0, far, -wx * 0.85, 5.6, far, wx * 0.85, 5.6, far, -3, 6.2, -1, 3, 6.2, -1]);
    dio.fit(c, FIT, { x0: 6, x1: dio.width - 6, y0: V[3]!, y1: Math.max(V[3]! + 80, dio.height - V[4]!) });
    E[0] = c.oy;
  }
  function follow(dt: number) {
    const c = dio.cam, want = f.S[2]! - 3, k = dt ? 1 - Math.exp(-dt * 4) : 1;
    c.tz += (want - c.tz) * k;
    c.tx += (f.S[3]! * 0.3 - c.tx) * k;
    c.oy += (endOy() - c.oy) * k;
  }
  // The end card sits up top, under the stickers; the camera lowers the picture until the float (the
  // balloon, or the flat pile it left) is clear of the card. E: [0] the framed oy, [1] where the card
  // goes (px from the stage's top), [2] the card's bottom once measured (0: not yet), [3] measure it.
  const E = new Float64Array(4);
  function endOy() {
    const c = dio.cam, M = bal.M;
    if (!E[2] || card.hidden || f.S[0] !== DONE || !dio.project(M[9]!, M[10]! + 3.5 * VH[variant]!, M[11]!, tmp)) return E[0]!;
    const top = tmp[1]! - c.oy + E[0]!;
    return E[0]! + Math.max(0, Math.min(dio.height * 0.4, E[2]! + 14 - top));
  }

  // ---- the frame ----
  let aliveT = 0, later = 0;
  function alive() {
    aliveT = Math.max(aliveT, engine.time + ALIVE);
    engine.busy(ALIVE);
    engine.wake();
  }
  function reset(s: number, run: boolean) {
    seed = s >>> 0;
    f = float(seed, I);
    rnd = seeded(seed * 17 + 5);
    fx.fill(0);
    toastT = 0;
    buildScene();
    syncCrew(0);
    card.hidden = run;
    card.classList.toggle("pd-start", !run);
    card.classList.remove("pd-end");
    E[2] = E[3] = 0;
    if (!run) {
      cardT.textContent = "Parade Day";
      cardP.hidden = false;
      cardS.textContent = "";
      go.textContent = "START THE PARADE";
    }
    V[0] = 1;
    hudDirty = dirty = true;
    alive();
  }
  function start() {
    if (f.S[0] === RUN || f.S[0] === DEFLATE) return;
    if (f.S[0] === DONE) reset(seed + 1, true);
    I[1] = 1;
    card.hidden = true;
    play.focus({ preventScroll: true });
    alive();
  }
  function showEnd() {
    const b = f.S[6]!, fin = f.finished();
    cardT.textContent = !fin ? "Deflated!" : b ? "Made it!" : "Perfect float!";
    cardP.hidden = true;
    cardS.textContent = `Distance ${f.metres()} m · Bumps ${b}${fin ? " · Finish +200" : ""}${fin && !b ? " · Perfect float +500" : ""} · Score ${f.score()}`;
    go.textContent = "PLAY AGAIN";
    card.classList.remove("pd-start");
    card.classList.add("pd-end");
    card.style.setProperty("--pd-top", E[1] + "px");
    card.hidden = false;
    E[3] = 1;
    alive();
    say(`${cardT.textContent} Score ${f.score()}.`);
    go.focus({ preventScroll: true });
  }
  /** The crew and the balloon where the float has them. */
  function syncCrew(dt: number) {
    const S = f.S, z = S[2]!, hx = S[3]!, bx = S[4]!, mode = S[0]!, walk = mode === RUN || (mode === DEFLATE && S[13]! > 0.2);
    for (let i = 0; i < 6; i++) {
      const parts = hand[i]!, r = parts[0]!, ox = ATT[i * 2]! * 1.5, oz = ATT[i * 2 + 1]! * 1.7;
      (r.pos[0] = Math.max(-2.85, Math.min(2.85, hx + ox))), (r.pos[1] = 0.02), (r.pos[2] = z + oz);
      // They lean back against the pull, and their legs walk.
      r.rot[2] = Math.max(-0.35, Math.min(0.35, (r.pos[0]! - bx - ox * 0.6) * 0.22));
      r.rot[0] = walk ? -0.12 : 0;
      const ph = walk ? Math.sin(-z * 4.2 + i * 1.3) * 0.55 : 0;
      (parts[1]!.rot[0] = ph), (parts[2]!.rot[0] = -ph);
    }
    let v = 0;
    if (mode === DEFLATE || (mode === DONE && S[6]! >= 3)) v = Math.min(VH.length - 1, Math.round(S[8]! * (VH.length - 1)));
    else if (S[7]! > 0) {
      const u = 1 - S[7]! / 0.5;
      v = u < 0.25 ? 2 : u < 0.5 ? 1 : 0;
    }
    showVariant(v);
    const df = mode === DEFLATE || (mode === DONE && S[6]! >= 3) ? S[8]! : 0, bob = RM ? 0 : Math.sin(tAmb * 1.7) * 0.12 * (1 - df);
    (bal.pos[0] = bx), (bal.pos[1] = BY * (1 - df * df) + 0.05 + bob), (bal.pos[2] = z - 0.2);
    bal.rot[2] = Math.max(-0.3, Math.min(0.3, -S[5]! * 0.05 - S[9]! * 0.012)) + Math.sin(tAmb * 1.3) * 0.03;
    bal.rot[0] = 0.06 + Math.sin(tAmb * 1.1) * 0.03;
    bal.rot[1] = df ? df * TAU * 2.2 * (1 - df * 0.4) : Math.sin(tAmb * 0.7) * 0.08;
    // The banners swing after a bump.
    for (let i = 0; i < posts.length; i++) {
      const t = f.PH[i]!, g = posts[i]!;
      g.rot[0] = t >= 0 ? Math.sin(t * 9) * 0.7 * Math.exp(-t * 1.8) : 0;
      g.rot[2] = t >= 0 ? Math.sin(t * 6) * 0.25 * Math.exp(-t * 2) * f.PS[i]! : 0;
    }
    // The crowd beside the balloon jumps and cheers.
    for (const c of crowd) {
      const near = mode !== IDLE && (c.side ? Math.abs(c.z0 - z) < 6 : z < 12 - LEN), p = c.p;
      if (!near && !c.hot) continue;
      c.hot = near;
      for (let j = 0; j < p.n; j++) p.y[j] = c.y[j]! + (near ? Math.abs(Math.sin(tAmb * 8 + j * 1.9)) * 0.16 : 0);
    }
    if (dt) follow(dt);
  }
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
        if (next !== P) {
          P = next;
          const l = P === DARK ? NIGHT : LIT;
          dio.setLight(l.light, l.amb);
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!]!;
          for (const g of glow) g.emissive = P === DARK;
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = muteK!.parentElement!.lastElementChild!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        const mr = muteK!.getBoundingClientRect();
        E[1] = Math.max(V[3]!, mr.top < sr.top + sr.height / 2 ? mr.bottom - sr.top + 6 : 0);
        if (!card.hidden && f.S[0] === DONE) E[3] = 1;
        frame();
        follow(0);
        dirty = true;
      }
      if (E[3]) {
        E[3] = 0;
        const sr = stage.getBoundingClientRect(), cr = card.getBoundingClientRect();
        E[2] = cr.bottom - sr.top;
      }
      if (first) (first = null), start();
    },
    step(e, dt) {
      tAmb += dt;
      if (auto) autopilot(f, I);
      const z0 = f.S[2]!, busy = f.step(dt), ev = f.ev, z = f.S[2]!;
      if (ev[EV_START]) e.events.emit("start"), toast("The parade is off!", 3);
      if (ev[EV_BUMP]) {
        e.events.emit("bump");
        const left = 3 - f.S[6]!;
        if (!ev[EV_DEFLATE]) toast(left > 1 ? "BONK! Patched up" : "BONK! One more and it's flat", left > 1 ? 1 : 2);
        for (let i = 0; i < (RM ? 3 : 10); i++) spawn(2, f.S[4]! + (rnd() - 0.5) * 2, BY + 1 + rnd() * 1.5, z + (rnd() - 0.5), (rnd() - 0.5) * 3, rnd() * 2, (rnd() - 0.5) * 2, 0.6 + rnd() * 0.4);
      }
      if (ev[EV_DEFLATE]) e.events.emit("deflate"), toast("PSSSSHHHH…", 2);
      if (ev[EV_GUST]) e.events.emit("gust");
      if (ev[EV_FINISH]) {
        e.events.emit("finish");
        toast(f.S[6] ? "Made it to the grandstand!" : "PERFECT FLOAT!", 3);
        confetti(RM ? 20 : 90, -LEN - 1, 6);
        later = 1.4;
      }
      if (ev[EV_FLAT]) e.events.emit("flat"), (later = 1);
      const mode = f.S[0]!;
      // While it runs: confetti from the crowd as it passes, leaves on the gusts, air from a leak.
      if (!RM && mode === RUN && (engine.steps & 7) === 0) confetti(2, z - 2, 6);
      if (!RM && Math.abs(f.S[10]!) > 1.5 && (engine.steps & 3) === 0 && mode !== IDLE) {
        const s = f.S[10]! > 0 ? 1 : -1;
        spawn(1, -s * (5 + rnd() * 3), 1 + rnd() * 4.5, z - 8 + rnd() * 9, s * (2.5 + rnd() * 2), (rnd() - 0.3) * 1.2, (rnd() - 0.5) * 0.5, 3 + rnd());
      }
      if (mode === DEFLATE && (engine.steps & 1) === 0) spawn(2, bal.M[9]! + (rnd() - 0.5), bal.M[10]! + 1.5 * VH[variant]!, bal.M[11]! + 0.6, (rnd() - 0.5) * 4, 1 + rnd() * 2, 1 + rnd() * 2, 0.7);
      let moving = busy || z !== z0;
      if (later > 0 && (later -= dt) <= 0) showEnd(), (hudDirty = true);
      if (later > 0) moving = true;
      if (stepFx(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true);
      const c = dio.cam;
      if (Math.abs(c.tz - (z - 3)) > 0.01 || Math.abs(c.oy - endOy()) > 0.5) moving = true;
      if (moving || e.time < aliveT) syncCrew(dt), (dirty = true);
      if (moving) e.busy();
      if (z !== z0 || ev[EV_BUMP]) hudDirty = true;
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (dirty) (dirty = false), fxPoints(), dio.draw();
    },
  });
  // ---- the HUD (DOM writes in render, change-only) ----
  const was: (string | number | boolean)[] = [];
  const set = (i: number, v: string | number | boolean) => (was[i] === v ? false : ((was[i] = v), true));
  function hudWrite() {
    const m = f.metres(), b = f.S[6]!, mode = f.S[0]!;
    if (set(0, m)) dist.textContent = "" + m;
    for (let i = 0; i < 3; i++) if (set(1 + i, i < 3 - b)) airs[i]!.classList.toggle("pd-out", i >= 3 - b);
    const hint = mode === RUN ? `${coarse ? "Drag" : "← → or drag"} to steer. Watch the wind sock.` : mode === IDLE ? "" : mode === DEFLATE ? "Oh no…" : "";
    if (set(5, hint)) hintEl.textContent = hint;
    if (set(6, said)) live.textContent = said;
  }

  // ---- input ----
  const MOVE = (x: number) => {
    const w = stage.getBoundingClientRect().width || 1;
    K[2] = Math.max(-1, Math.min(1, (x / w - 0.5) * 2.6));
    lean();
  };
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture?.(e.pointerId);
    if (f.S[0] === IDLE) return void start();
    if (f.S[0] === DONE) return;
    MOVE(e.offsetX);
  }, sig);
  play.addEventListener("pointermove", (e) => K[2] === K[2] && e.isPrimary && MOVE(e.offsetX), sig);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) play.addEventListener(t, () => ((K[2] = NaN), lean()), sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (c === "KeyM") return void (e.preventDefault(), toggle());
    if (c === "ArrowLeft" || c === "KeyA") K[0] = 1;
    else if (c === "ArrowRight" || c === "KeyD") K[1] = 1;
    else if ((c === "Space" || c === "Enter") && !(e.target as Element).closest?.(".gk-bar, .pd-card")) !e.repeat && start();
    else return;
    e.preventDefault();
    lean();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const c = e.code;
    if (c === "ArrowLeft" || c === "KeyA") K[0] = 0;
    else if (c === "ArrowRight" || c === "KeyD") K[1] = 0;
    lean();
  }, sig);
  go.addEventListener("click", () => start(), sig);

  // [0] measure, [1] theme, [2] poster resolution, [3] safe top, [4] safe bottom inset.
  const V = new Float64Array(5);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  /** The poster (scripts/gallery-posters.mjs): the autopilot's run, a third of the way down the street. */
  function poster() {
    V[2] = 0.6;
    reset(20261123, true);
    auto = true;
    I[1] = 1;
  }

  reset((engine.random() * 100000) | 0, false);
  engine.start();
  return {
    engine,
    accessible: true,
    get f() {
      return f;
    },
    get state() {
      return { mode: f.S[0]!, z: f.S[2]!, bx: f.S[4]!, bumps: f.S[6]!, card: !card.hidden, score: f.score(), variant };
    },
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: the autopilot's float, a third of the way down the street (scripts/gallery-posters.mjs). */
export const posterAt = 7.5;
