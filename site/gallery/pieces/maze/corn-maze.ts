// "Corn Maze" (hero, Thanksgiving): a corn field cut into a maze on a tabletop diorama, at dusk. Walk
// in through the gate and find the scarecrow (he stands taller than the corn, in the dead end nearest
// the middle) before the light goes, picking up pumpkins on the way (each one a detour). Lanterns at
// the forks light as you pass, so they mark where you have been; crows on the corn scatter when you
// come near and settle somewhere else later. The sky goes from late afternoon to night as the light
// runs down, and the dark closes in round your own lantern. Hold an arrow (you turn at the next
// opening), swipe, or tap a spot and you find your way there; MAP pulls the camera up over the field.
// Bricks: the kernel (fixed step, settle, its ledger for every page write: Recall gives the page
// back byte for byte), @fzlt/core/diorama (the 3D, the sparkles as points, the dusk as a light that
// moves), @fzlt/core/grid (the field's board and every A*), @fzlt/core/slot, @fzlt/core/sound. The
// field is ./corn.ts on ./carve.ts, pure (tests/corn-maze.test.mjs: everything reachable, every
// pumpkin and the scarecrow before dark, zero allocation); this file is the scene and the controls
// (tests/corn-maze.mjs).
import { createEngine } from "../../../../src/kernel/index";
import { diorama, type DioramaObject, type DioramaObjectDef, type DioramaPoints } from "../../../../src/diorama";
import { BLOCKED } from "../../../../src/grid";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { keys } from "../keys";
import { room } from "./carve";
import { CELL, CH, CROWS, CW, DARK, EV_CROW, EV_DARK, EV_FOUND, EV_LAND, EV_LANTERN, EV_PUMPKIN, FOUND, LIGHT as DAYLIGHT, WALKING, go, hold, load, newField, step, tapTo, where, type Field } from "./corn";

const TAU = 6.283185307179586, D = Math.PI / 180;
// Palettes by role. Light: a late golden afternoon going to dusk. Dark: dusk going to a blue night.
// `sky` runs from the start of the walk to dark.
const LIGHT = {
  sky0: 0xf3c99a, sky1: 0x3a3560, floor: "#d8c8b4", wallB: "#ead6bf", wallR: "#d8d0c0", base: "#9b7653", top: "#c49a6c",
  soil: "#a8794f", path: "#dcc08f", corn: "#9fbf5a", corn2: "#86ab4a", tassel: "#f0cf6a", husk: "#d9b864",
  pump: "#ff8a3d", pump2: "#e9772e", stem: "#5c7a35", bale: "#e8c873", bale2: "#d4ae55", sign: "#f6efe2", post: "#7a5a3c",
  shirt: "#c9584a", shirt2: "#e9a23b", sack: "#e8d3a8", hat: "#7a5a3c", straw: "#f0cf6a",
  jacket: "#3f6f8a", pants: "#3b3f55", skin: "#e2b38f", beanie: "#e9a23b", lamp: "#ffd36b", lampOff: "#6b5a46",
  crow: "#26232e", beak: "#e9a23b", spark: "#ffd36b",
  night: "#141633", shadow: "#3a2d3c", amb0: 0.6, amb1: 0.22, dark: false,
};
type Pal = typeof LIGHT;
const DARKP: Pal = {
  ...LIGHT, sky0: 0x6b4a7a, sky1: 0x0b0d22, floor: "#2a2a48", wallB: "#2c2c52", wallR: "#24344a", base: "#4b3a3a", top: "#5e4a44",
  soil: "#3f3346", path: "#5a4a5e", corn: "#4e7a4a", corn2: "#3f6a40", tassel: "#c9a14a", husk: "#9a8048",
  pump: "#ff7a2e", pump2: "#d4621f", bale: "#b89a50", bale2: "#9c8040", sign: "#d9d2e6", post: "#5a4632",
  jacket: "#3f7fa0", lamp: "#ffcf4a", lampOff: "#4a3e40", night: "#060717", shadow: "#000000", amb0: 0.48, amb1: 0.16, dark: true,
};
type Key = Exclude<keyof Pal, "sky0" | "sky1" | "amb0" | "amb1" | "dark">;

// The table top (TT), the field's soil, its size; the corn's height.
const TT = 1.24, SOIL = 0.3, FY = TT + SOIL, FS = (2 * CW + 1) * CELL, CORN = 1.65;
const P_READY = 0, P_WALK = 1, P_END = 2;
const STEPS = 48; // dusk shades (strings made once)

export type CornScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly field: Field;
  readonly state: { phase: number; state: number; taken: number; pumpkins: number; light: number; lit: number; card: boolean; map: boolean; crowsAway: number };
  /** Cell i's screen point (CSS px from the stage's top left), as of the last draw. */
  cellScreen(i: number): [number, number];
  /** A new field on seed s (tests). */
  field0(s: number): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): CornScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches, coarse = matchMedia("(pointer: coarse)").matches;
  let P: Pal = document.documentElement.dataset.theme === "light" ? LIGHT : DARKP;

  // ---- the page: canvas, a key over it, stickers, end card, keys ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "cm-play";
  play.setAttribute("aria-label", "Corn Maze: find the scarecrow before the light goes, picking up pumpkins. Hold an arrow to walk, you turn at the next opening. Tab to MAP to look over the field. M mutes");
  const hud = L.add(document.createElement("div"));
  hud.className = "cm-hud";
  hud.innerHTML = `<div class="cm-head"><p class="cm-top"><b class="cm-chip cm-lvl">Pumpkins <span>0/4</span></b><b class="cm-chip cm-light">Light <i class="cm-bar"><i></i></i><span>90</span></b></p><p class="cm-hint"></p></div><p class="cm-live" aria-live="polite"></p><div class="cm-card" role="dialog" aria-label="Walk over" hidden><b></b><p></p><button type="button" class="bui-key cm-again">NEW FIELD</button></div>`;
  const head = hud.children[0] as HTMLElement, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, live = hud.children[1] as HTMLElement, card = hud.children[2] as HTMLElement;
  const pumpEl = top.children[0]!.querySelector("span")!, lightEl = top.children[1]!.querySelector("span")!, barEl = top.children[1]!.querySelector("i i") as HTMLElement;
  const again = card.lastElementChild as HTMLButtonElement;
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { step: "step", pumpkin: "pop", lantern: "chime", caw: "caw", land: "flap", found: "win", dark: "end", map: "click", start: "go" },
    notes: {
      step: [[180, 140, 0.04, 0, "triangle", 0.035]],
      pop: [[520, 880, 0.08, 0, "sine", 0.1], [880, 1320, 0.1, 0.06, "sine", 0.08]],
      chime: [[1175, 1175, 0.3, 0, "sine", 0.08], [1760, 1760, 0.25, 0.04, "sine", 0.04]],
      caw: [[620, 420, 0.12, 0, "sawtooth", 0.05], [600, 380, 0.14, 0.16, "sawtooth", 0.05]],
      flap: [[300, 240, 0.05, 0, "triangle", 0.04], [300, 240, 0.05, 0.08, "triangle", 0.04]],
      go: [[660, 990, 0.18, 0, "triangle", 0.06]],
    },
    volume: 0.1,
  });
  const K_MUTE = 0, K_MAP = 1;
  const [muteK, mapK] = keys(engine, stage, [
    { label: "♪", aria: "Mute (M)", id: K_MUTE },
    { label: "MAP", aria: "Look over the field (Tab to it, or press V)", id: K_MAP },
  ], (id, down) => {
    if (!down) return;
    if (id === K_MUTE) toggle();
    else toggleMap();
  }) as HTMLButtonElement[];
  muteK!.setAttribute("aria-pressed", "true");
  mapK!.setAttribute("aria-pressed", "false");
  const toggle = () => {
    snd.on = !snd.on;
    muteK!.textContent = snd.on ? "♪" : "×";
    muteK!.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- dusk: the sky and the light as strings and numbers made once ----
  const SKY: string[] = [], SKYD: string[] = [];
  const mix = (a: number, b: number, t: number) => {
    const r = ((a >> 16) + ((b >> 16) - (a >> 16)) * t) | 0, g = (((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t) | 0, bl = ((a & 255) + ((b & 255) - (a & 255)) * t) | 0;
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  for (let i = 0; i <= STEPS; i++) SKY.push(mix(LIGHT.sky0, LIGHT.sky1, i / STEPS)), SKYD.push(mix(DARKP.sky0, DARKP.sky1, i / STEPS));
  let duskI = 0;
  const sunDir = new Float64Array(3);

  // ---- the diorama ----
  const dio = diorama(canvas, { light: [0.6, 0.7, 0.3], ambient: P.amb0, background: () => (P.dark ? SKYD : SKY)[duskI]!, overlay: drawOverlay, get shadowColor() { return P.shadow; }, maxVerts: 24000, maxFaces: 16000 });
  const keyed: DioramaObject[] = [], keyName: Key[] = [];
  const put = (d: DioramaObjectDef & { color?: Key }) => {
    const k = d.color as Key | undefined, ob = dio.add({ ...d, color: k ? P[k] : undefined });
    if (k) keyed.push(ob), keyName.push(k);
    return ob;
  };
  const f = newField();
  let seed = 1, phase = P_READY, T = 0, map = false, endT = 0;
  const pumpOb: DioramaObject[] = [], pumpT = new Float64Array(8), lampOb: DioramaObject[] = [], crowOb: DioramaObject[] = [], wings: DioramaObject[] = [];
  let me: DioramaObject | null = null, legs: DioramaObject[] = [], sc: DioramaObject | null = null, scHead: DioramaObject | null = null;
  let spark: DioramaPoints;
  const SP = 24, spV = new Float64Array(SP * 3), spT = new Float64Array(SP);
  let spN = 0, heading = 0, walkPh = 0;
  const wx = (c: number) => (c + 0.5) * CELL - FS / 2, wz = (r: number) => (r + 0.5) * CELL - FS / 2;
  const cornH = new Float64Array(15 * 15);

  function buildScene() {
    const g = f.g, n = g.cols * g.rows;
    dio.clear();
    keyed.length = keyName.length = pumpOb.length = lampOb.length = crowOb.length = wings.length = 0;
    legs = [];
    dio.cluster("room", { fixed: 0 });
    dio.cluster("table", { fixed: 1 });
    dio.cluster("field", { fixed: 2 });
    put({ id: "floor", size: [60, 0.5, 44], pos: [0, -0.5, 0], color: "floor", cluster: "room", layer: 0, pick: false });
    put({ id: "wallB", size: [60.6, 14, 0.5], pos: [0, -0.5, -22.25], color: "wallB", cluster: "room", layer: 0.3, pick: false });
    put({ id: "plinth", size: [FS + 6, TT - 0.14, FS + 6], on: "floor", color: "base", cluster: "table", layer: 0, shadow: 0.2, pick: false });
    put({ id: "top", size: [FS + 6.6, 0.14, FS + 6.6], on: "plinth", color: "top", layer: 0.4, pick: false });
    put({ id: "soil", size: [FS + 1, SOIL, FS + 1], on: "top", color: "soil", cluster: "field", layer: 0, shadow: 0.3, pick: false });
    put({ id: "lane", size: [FS - CELL * 2 + 0.2, 0.02, FS - CELL * 2 + 0.2], on: "soil", color: "path", layer: 0.5, pick: false });
    // The corn: a block per cell, a little taller or shorter, a couple of tassels on top. The gate is
    // left open on the near side.
    const gate = (2 * CH) * g.cols + CW;
    for (let i = 0; i < n; i++) {
      if (!(g.flags[i]! & BLOCKED) || i === gate) {
        cornH[i] = 0;
        continue;
      }
      // Four stalk bundles a cell, each its own height, a tassel on each: it reads as a field, not a hedge.
      const c = i % g.cols, r = (i / g.cols) | 0;
      let hi = 0;
      for (let q = 0; q < 4; q++) {
        const h = CORN + (((c * 7 + r * 13 + q * 5 + seed) % 7) - 3) * 0.07, id = "c" + i + "_" + q, qx = q & 1 ? 0.25 : -0.25, qz = q & 2 ? 0.25 : -0.25;
        hi = Math.max(hi, h);
        put({ id, size: [CELL * 0.52, h, CELL * 0.52], on: "soil", pos: [wx(c) + qx * CELL, 0, wz(r) + qz * CELL], color: (c + r + q) & 1 ? "corn" : "corn2", layer: 2, pick: false });
        put({ shape: "cyl", sides: 4, top: 0, size: [0.3, 0.42, 0.3], on: id, pos: [(q & 1 ? -1 : 1) * 0.1, 0, 0], rot: [0, 0.4 * q, 0], color: (c + q) & 1 ? "tassel" : "husk", layer: 2, pick: false });
      }
      cornH[i] = hi;
    }
    // The gate: two bales and a sign.
    const gx = wx(CW), gz = wz(2 * CH) + 0.6;
    for (const s of [-1, 1]) {
      put({ id: "bale" + s, size: [1.3, 0.7, 0.8], on: "top", pos: [gx + s * 1.5, 0, gz + 1.2], rot: [0, s * 0.2, 0], color: "bale", layer: 3, shadow: 0.3, pick: false });
      put({ size: [1.2, 0.04, 0.7], on: "bale" + s, color: "bale2", layer: 3, pick: false });
    }
    put({ id: "sp", size: [0.12, 1.5, 0.12], on: "top", pos: [gx + 2.6, 0, gz + 1.1], color: "post", layer: 3, pick: false });
    put({ id: "sign", size: [1.6, 0.8, 0.08], on: "sp", pos: [0, -0.9, 0.08], color: "sign", layer: 3.1, pick: false });
    dio.decal("table", 3.2, drawSign);
    // The scarecrow: a pole, a crossbar, a shirt, a sack head and a wide hat.
    const s = f.scare, scx = wx(s % g.cols), scz = wz((s / g.cols) | 0);
    sc = put({ id: "sc", shape: "group", size: [1, 0, 1], on: "soil", pos: [scx, 0, scz], layer: 2, shadow: 0.4, pick: false });
    put({ id: "pole", size: [0.14, 2.4, 0.14], on: "sc", color: "post", layer: 2, pick: false });
    put({ size: [2.2, 0.12, 0.12], on: "sc", pos: [0, 1.85, 0], color: "post", layer: 2, pick: false });
    put({ id: "shirt", size: [0.9, 1.0, 0.5], on: "sc", pos: [0, 1.15, 0], color: "shirt", layer: 2, pick: false });
    put({ size: [0.92, 0.12, 0.52], on: "sc", pos: [0, 1.45, 0], color: "shirt2", layer: 2, pick: false });
    for (const x of [-0.8, 0.8]) put({ size: [0.7, 0.36, 0.4], on: "sc", pos: [x, 1.73, 0], color: "shirt", layer: 2, pick: false }), put({ shape: "cyl", sides: 5, top: 0, size: [0.3, 0.36, 0.3], on: "sc", pos: [x * 1.45, 1.73, 0], rot: [0, 0, x > 0 ? -1.57 : 1.57], color: "straw", layer: 2, pick: false });
    scHead = put({ id: "scH", shape: "cyl", sides: 9, top: 0.85, size: [0.62, 0.6, 0.62], on: "sc", pos: [0, 2.15, 0], color: "sack", layer: 2, pick: false });
    put({ shape: "cyl", sides: 12, size: [1.3, 0.06, 1.3], on: "scH", color: "hat", layer: 2, pick: false });
    put({ shape: "cyl", sides: 9, top: 0.25, size: [0.6, 0.5, 0.6], on: "scH", pos: [0, 0.06, 0], color: "hat", layer: 2, pick: false });
    for (const z of [-0.12, 0.12]) put({ size: [0.08, 0.08, 0.08], on: "scH", pos: [0.3, -0.3, z], color: "crow", layer: 2, pick: false });
    // Pumpkins.
    for (let k = 0; k < f.nP; k++) {
      const i = f.pumpkin[k]!, id = "pk" + k;
      pumpOb.push(put({ id, shape: "cyl", sides: 10, top: 0.7, size: [0.78, 0.55, 0.72], on: "soil", pos: [wx(i % g.cols) + 0.2, 0, wz((i / g.cols) | 0) - 0.1], color: "pump", layer: 2, shadow: 0.35, pick: false }));
      put({ shape: "cyl", sides: 10, top: 0.4, size: [0.5, 0.06, 0.46], on: id, color: "pump2", layer: 2, pick: false });
      put({ size: [0.08, 0.18, 0.08], on: id, rot: [0, 0, 0.3], color: "stem", layer: 2, pick: false });
      pumpT[k] = f.got[k] ? 1 : 0;
    }
    // Lanterns on posts at the forks.
    for (let k = 0; k < f.nL; k++) {
      const i = f.lantern[k]!, id = "lp" + k;
      put({ id, size: [0.1, 1.2, 0.1], on: "soil", pos: [wx(i % g.cols) - 0.55, 0, wz((i / g.cols) | 0) - 0.55], color: "post", layer: 2, shadow: 0.3, pick: false });
      lampOb.push(put({ size: [0.26, 0.32, 0.26], on: id, color: f.lit[k] ? "lamp" : "lampOff", emissive: !!f.lit[k], layer: 2, pick: false }));
    }
    // Crows: a body, a head, a beak, two wings.
    for (let k = 0; k < CROWS; k++) {
      const id = "cw" + k, ob = put({ id, shape: "group", size: [0.4, 0, 0.4], on: "soil", layer: 6, pick: false });
      put({ shape: "wedge", size: [0.55, 0.26, 0.24], on: id, rot: [0, Math.PI, 0], color: "crow", layer: 6, pick: false });
      put({ id: id + "h", size: [0.18, 0.18, 0.18], on: id, pos: [0.22, 0.18, 0], color: "crow", layer: 6.1, pick: false });
      put({ shape: "cyl", sides: 4, top: 0, size: [0.08, 0.16, 0.08], on: id + "h", pos: [0.1, -0.12, 0], rot: [0, 0, -1.57], color: "beak", layer: 6.2, pick: false });
      for (const z of [-1, 1]) wings.push(put({ size: [0.34, 0.03, 0.3], on: id, pos: [-0.02, 0.18, z * 0.12], color: "crow", layer: 6.1, pick: false }));
      crowOb.push(ob);
    }
    // You: boots, trousers, a jacket, a beanie, a lantern in your hand.
    me = put({ id: "me", shape: "group", size: [0.5, 0, 0.5], on: "soil", layer: 5, shadow: 0.45, pick: false });
    for (const z of [-0.11, 0.11]) legs.push(put({ size: [0.16, 0.5, 0.18], on: "me", pos: [0, 0, z], color: "pants", layer: 5, pick: false }));
    put({ id: "jk", size: [0.36, 0.62, 0.5], on: "me", pos: [0, 0.48, 0], color: "jacket", layer: 5.1, pick: false });
    put({ id: "hd", shape: "cyl", sides: 9, size: [0.3, 0.3, 0.3], on: "jk", color: "skin", layer: 5.2, pick: false });
    put({ shape: "cyl", sides: 9, top: 0.7, size: [0.33, 0.16, 0.33], on: "hd", color: "beanie", layer: 5.3, pick: false });
    put({ size: [0.08, 0.3, 0.08], on: "me", pos: [0.05, 0.42, 0.33], color: "jacket", layer: 5.1, pick: false });
    put({ size: [0.16, 0.2, 0.16], on: "me", pos: [0.08, 0.26, 0.36], color: "lamp", emissive: true, layer: 5.2, pick: false });
    spark = dio.points({ cap: SP, cluster: "field", layer: 7, color: P.spark });
    dirty = true;
  }
  function drawSign(ctx: CanvasRenderingContext2D) {
    const g = f.g, gx = wx(CW) + 2.6, gz = wz(2 * CH) + 0.6 + 1.1 + 0.13;
    if (!dio.project(gx, TT + 0.65 + 0.4, gz, tmp)) return;
    const k = dio.focal() / tmp[2]!, px = Math.max(7, 0.3 * k);
    ctx.font = font(px);
    ctx.fillStyle = "#3b2f3f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MAZE", tmp[0]!, tmp[1]!);
    void g;
  }

  // ---- state and flow ----
  let hudDirty = true, dirty = true, toastT = 0, toastK = 0, toastS = "", said = "", stepT = 0;
  const tmp = new Float64Array(3), W3 = new Float64Array(4);
  const V = new Float64Array(6);
  V[0] = V[1] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  const cue = (t: string) => engine.events.emit(t);
  function newGame(s: number) {
    seed = s;
    load(s, f);
    buildScene();
    phase = P_READY;
    map = false;
    mapK!.setAttribute("aria-pressed", "false");
    card.hidden = true;
    heading = -Math.PI / 2;
    spN = spark.n = 0;
    dusk();
    setView(true);
    say(`A new corn maze. Find the scarecrow before the light goes; ${f.nP} pumpkins hide in the corners.`);
    hudDirty = true;
    engine.wake();
  }
  function begin() {
    if (phase !== P_READY) return;
    phase = P_WALK;
    go(f);
    cue("start");
    toast("FIND THE SCARECROW", 0);
    hudDirty = true;
    engine.wake();
  }
  function end(found: boolean) {
    phase = P_END;
    endT = 0;
    // Every crow up at once.
    for (let k = 0; k < CROWS; k++) if (f.crowS[k] === 0) (f.crowS[k] = 1), (f.crowT[k] = 0), (f.crowA[k] = (k / CROWS) * TAU);
    cue(found ? "found" : "dark");
    found && cue("caw");
    toast(found ? "FOUND HIM!" : "LIGHTS OUT", found ? 1 : 2);
    const left = Math.ceil(f.light);
    (card.children[0] as HTMLElement).textContent = found ? (f.taken === f.nP ? "Every pumpkin" : "Found him") : "Lights out";
    (card.children[1] as HTMLElement).textContent = found ? `The scarecrow, ${f.taken} of ${f.nP} pumpkins and ${left} s of light to spare.` : `The light is gone and the scarecrow is still out there. ${f.taken} of ${f.nP} pumpkins.`;
    say(found ? `You found the scarecrow with ${f.taken} of ${f.nP} pumpkins and ${left} seconds of light left.` : `Lights out. ${f.taken} of ${f.nP} pumpkins.`);
    engine.busy(2.4);
    hudDirty = true;
  }
  function toggleMap() {
    map = !map;
    mapK!.setAttribute("aria-pressed", "" + map);
    cue("map");
    setView(false);
  }
  /** The dusk: sky shade, the sun lowering and swinging, the ambient falling. */
  function dusk() {
    const u = 1 - f.light / DAYLIGHT, i = Math.round(u * STEPS);
    if (i === duskI && sunDir[1]) return false;
    duskI = i;
    const a = 0.6 - u * 0.9;
    (sunDir[0] = Math.cos(a)), (sunDir[1] = 0.25 + (1 - u) * 0.8), (sunDir[2] = Math.sin(a) * 0.6 + 0.3);
    dio.setLight(sunDir, P.amb0 + (P.amb1 - P.amb0) * (i / STEPS));
    return true;
  }

  // ---- the camera: the whole field (READY, MAP, the end) or following you ----
  const goal = { yaw: 0, pitch: 0, dist: 30, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 };
  const portrait = () => dio.width / dio.height < 1.05;
  let follow = false;
  function setView(snap: boolean) {
    const port = portrait(), g = goal, W = dio.width, H = dio.height;
    follow = phase === P_WALK && !map;
    (g.yaw = (port ? -6 : -10) * D), (g.fov = 0.6);
    const box = { x0: 10, x1: W - 10, y0: V[3]!, y1: Math.max(V[3]! + 80, H - V[4]!) };
    if (!follow) {
      // The far corn and the table's near edge (the plinth, FS + 6 deep), clear of the keys.
      const h = FS / 2 + 0.6, e = FS / 2 + 3;
      (g.pitch = (port ? 62 : 54) * D), (g.tx = 0), (g.ty = FY), (g.tz = 0);
      dio.fit(g, [-h, FY + CORN + 0.6, -h, h, FY + CORN, -h, -h, TT, e, h, TT, e], box);
    } else {
      // About seven cells round you in view, from up behind.
      const h = CELL * (port ? 3.4 : 4.2);
      where(f, W3);
      (g.pitch = 62 * D), (g.tx = W3[0]! - FS / 2), (g.ty = FY), (g.tz = W3[1]! - FS / 2 + 0.6);
      dio.fit(g, [g.tx - h, FY, g.tz - h, g.tx + h, FY, g.tz - h, g.tx - h, FY, g.tz + h, g.tx + h, FY, g.tz + h], box);
    }
    if (snap || RM) Object.assign(dio.cam, g);
    dirty = true;
    engine.wake();
  }
  const CAMF = ["yaw", "pitch", "dist", "tx", "ty", "tz", "ox", "oy"] as const;
  function stepCam(dt: number) {
    if (follow) where(f, W3), (goal.tx = W3[0]! - FS / 2), (goal.tz = W3[1]! - FS / 2 + 0.6);
    const c = dio.cam, k = 1 - Math.exp(-dt * (follow ? 6 : 3.5));
    let d = 0;
    for (let i = 0; i < 8; i++) {
      const q = CAMF[i]!;
      c[q] += (goal[q] - c[q]) * k;
      d = Math.max(d, Math.abs(goal[q] - c[q]) / (i > 5 ? 30 : i < 2 ? 0.03 : 0.6));
    }
    if (d < 0.01) {
      for (let i = 0; i < 8; i++) c[CAMF[i]!] = goal[CAMF[i]!];
      return false;
    }
    return true;
  }

  // ---- input: arrows, swipes, taps ----
  const held = new Int8Array(4);
  let heldN = 0;
  function worldDir(s: number) {
    const y = dio.cam.yaw, cy = Math.cos(y), sy = Math.sin(y);
    const vx = s === 0 ? cy : s === 1 ? -cy : s === 2 ? sy : -sy, vz = s === 0 ? -sy : s === 1 ? sy : s === 2 ? cy : -cy;
    return Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 0 : 1) : vz > 0 ? 2 : 3;
  }
  function wish(d: number) {
    if (phase === P_READY) begin();
    if (phase !== P_WALK) return;
    hold(f, d);
    if (map) toggleMap();
    engine.wake();
  }
  const ARROWS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"], WASD = ["d", "a", "s", "w"];
  const arrow = (e: KeyboardEvent) => {
    const i = ARROWS.indexOf(e.key);
    return i >= 0 ? i : WASD.indexOf(e.key.toLowerCase());
  };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar");
    if (k === "m") return void (e.preventDefault(), toggle());
    if (!card.hidden) return;
    if (k === "v") return void (e.preventDefault(), toggleMap());
    const i = arrow(e);
    if (i < 0 || onKey) {
      if ((e.key === " " || e.key === "Enter") && !onKey && phase === P_READY) e.preventDefault(), begin();
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
    let w = -1;
    for (let k = 0; k < heldN && k < 4; k++) if (held[k] === d) held[k] = -1;
    for (let k = 0; k < heldN && k < 4; k++) if (held[k]! >= 0) w = held[k]!;
    if (w < 0) heldN = 0;
    hold(f, w);
    engine.wake();
  }, sig);
  play.addEventListener("blur", () => ((heldN = 0), hold(f, -1)), sig);
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
  /** The room under a screen point (the soil plane), or −1. */
  function roomUnder(x: number, y: number) {
    if (!dio.ground(x, y, FY, tmp)) return -1;
    const s = 2 * CELL, c = Math.floor((tmp[0]! + FS / 2 - CELL / 2) / s), r = Math.floor((tmp[2]! + FS / 2 - CELL / 2) / s);
    return c < 0 || r < 0 || c >= CW || r >= CH ? -1 : room(f.g, c, r);
  }
  function tap(x: number, y: number) {
    if (phase === P_READY) return begin();
    if (phase !== P_WALK) return;
    const rm = roomUnder(x, y);
    if (rm >= 0 && tapTo(f, rm)) cue("step"), engine.wake();
  }
  again.addEventListener("click", () => (newGame(seed + 1), play.focus({ preventScroll: true })), sig);

  // ---- the frame ----
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const nx = document.documentElement.dataset.theme === "light" ? LIGHT : DARKP;
        if (nx !== P) {
          P = nx;
          for (let i = 0; i < keyed.length; i++) keyed[i]!.color = P[keyName[i]!] as string;
          spark.colorAll = P.spark;
          sunDir[1] = 0;
          dusk();
          dirty = true;
        }
      }
      if (V[0]) {
        V[0] = 0;
        const sr = stage.getBoundingClientRect(), hr = head.getBoundingClientRect(), kr = mapK!.getBoundingClientRect();
        dio.resize(sr.width || 1, sr.height || 1, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        V[3] = hr.bottom - sr.top + 6;
        V[4] = kr.bottom > sr.bottom - 24 ? sr.bottom - kr.top + 6 : 6;
        setView(true);
      }
      if (first && V[5]) {
        first = null;
        begin();
      }
    },
    step(e, dt) {
      let moving = false;
      const was = phase === P_WALK && !map && !follow;
      if (was) setView(false);
      if (step(f, dt)) moving = true;
      const ev = f.ev;
      f.ev = 0;
      if (phase === P_WALK) {
        if (ev & EV_PUMPKIN) {
          cue("pumpkin");
          say(`A pumpkin. ${f.taken} of ${f.nP}.`);
          hudDirty = true;
          // Sparkles from it.
          const i = f.pumpkin[f.evI]!;
          for (let k = 0; k < 12; k++) {
            const j = (spN + k) % SP, a = engine.random() * TAU;
            (spark.x[j] = wx(i % f.g.cols)), (spark.y[j] = FY + 0.5), (spark.z[j] = wz((i / f.g.cols) | 0)), (spark.r[j] = 0.06), (spark.a[j] = 1);
            (spV[j * 3] = Math.cos(a) * 1.4), (spV[j * 3 + 1] = 2 + engine.random() * 1.5), (spV[j * 3 + 2] = Math.sin(a) * 1.4), (spT[j] = 0);
          }
          spN = (spN + 12) % SP;
          spark.n = RM ? 0 : SP;
        }
        if (ev & EV_LANTERN) cue("lantern"), (lampOb[f.evI]!.color = P.lamp), (lampOb[f.evI]!.emissive = true), keyLamp(f.evI);
        if (ev & EV_CROW) cue("caw");
        if (ev & EV_LAND) cue("land");
        if (ev & EV_FOUND || f.state === FOUND) end(true);
        else if (ev & EV_DARK || f.state === DARK) end(false);
        stepT += dt;
        if (stepT > 0.28) (stepT = 0), f.to !== f.at && cue("step");
        if (f.light > 0 && Math.ceil(f.light) !== Math.ceil(f.light + dt)) hudDirty = true;
      } else if (phase === P_END) {
        endT += dt;
        if (endT >= 1.2 && card.hidden) (card.hidden = false), again.focus({ preventScroll: true }), setView(false);
        if (endT < 2.4) moving = true;
      }
      if (dusk()) moving = true;
      // Pumpkins taken: up and gone.
      for (let k = 0; k < f.nP; k++) {
        const want = f.got[k] ? 1 : 0, t = pumpT[k]!;
        if (t < want) (pumpT[k] = RM ? 1 : Math.min(1, t + dt * 2.5)), (moving = true);
      }
      // Sparkles.
      if (spark.n) {
        let alive = 0;
        for (let j = 0; j < SP; j++) {
          if (spark.a[j]! <= 0) continue;
          spT[j] = spT[j]! + dt;
          spV[j * 3 + 1] = spV[j * 3 + 1]! - 6 * dt;
          spark.x[j] = spark.x[j]! + spV[j * 3]! * dt;
          spark.y[j] = spark.y[j]! + spV[j * 3 + 1]! * dt;
          spark.z[j] = spark.z[j]! + spV[j * 3 + 2]! * dt;
          spark.a[j] = Math.max(0, 1 - spT[j]! / 0.9);
          if (spark.a[j]! > 0) alive++;
        }
        if (alive) moving = true;
        else spark.n = 0;
      }
      // You turn toward your heading and swing your legs as you walk.
      const want = f.dir === 0 ? 0 : f.dir === 1 ? Math.PI : f.dir === 2 ? -Math.PI / 2 : Math.PI / 2;
      let dd = want - heading;
      dd -= Math.round(dd / TAU) * TAU;
      if (Math.abs(dd) > 0.002) (heading += RM ? dd : dd * Math.min(1, dt * 14)), (moving = true);
      walkPh = f.to !== f.at && phase === P_WALK ? walkPh + dt * 11 : 0;
      if (stepCam(dt)) moving = true;
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
    /** A lit lantern keeps its colour across a theme change. */
  function keyLamp(k: number) {
    const i = keyed.indexOf(lampOb[k]!);
    if (i >= 0) keyName[i] = "lamp";
  }
  function place() {
    const g = f.g;
    if (me) {
      where(f, W3);
      (me.pos[0] = W3[0]! - FS / 2), (me.pos[2] = W3[1]! - FS / 2), (me.rot[1] = heading), (me.pos[1] = Math.abs(Math.sin(walkPh)) * 0.05);
      for (let k = 0; k < legs.length; k++) legs[k]!.rot[2] = Math.sin(walkPh + k * Math.PI) * 0.45;
    }
    for (let k = 0; k < pumpOb.length; k++) {
      const t = pumpT[k]!;
      pumpOb[k]!.hidden = t >= 1;
      pumpOb[k]!.pos[1] = Math.sin(t * Math.PI) * 0.8;
      pumpOb[k]!.alpha = 1 - t * t;
    }
    if (scHead) scHead.rot[1] = phase === P_END && f.state === FOUND ? Math.sin(Math.min(1, endT * 1.4) * Math.PI) * 0.9 : 0;
    if (sc) sc.rot[2] = phase === P_END && f.state === FOUND ? Math.sin(endT * 9) * 0.05 * Math.max(0, 1 - endT) : 0;
    // Crows: perched on a corn block, or flying off and up, wings beating.
    for (let k = 0; k < crowOb.length; k++) {
      const ob = crowOb[k]!, c = f.crow[k]!, s = f.crowS[k]!, t = f.crowT[k]!;
      if (c < 0 || s === 2) {
        ob.hidden = true;
        continue;
      }
      const x0 = wx(c % g.cols), z0 = wz((c / g.cols) | 0), y0 = cornH[c]! || CORN, a = f.crowA[k]!, u = s === 1 ? Math.min(1, t / 1.4) : 0;
      ob.hidden = false;
      (ob.pos[0] = x0 + Math.cos(a) * u * u * 9), (ob.pos[2] = z0 + Math.sin(a) * u * u * 9), (ob.pos[1] = y0 + u * 5 + (s === 0 ? 0 : 0.1));
      ob.rot[1] = s === 1 ? -a : (k * 1.7) % TAU;
      ob.alpha = s === 1 ? 1 - Math.max(0, u - 0.6) / 0.4 : 1;
      const fl = s === 1 ? Math.sin(t * 40) * 0.9 : 0;
      wings[k * 2]!.rot[0] = fl;
      wings[k * 2 + 1]!.rot[0] = -fl;
    }
  }

  // ---- overlay: the dark closing in round your lantern, lit lanterns' glow, the toast ----
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
  const TOAST = ["#fffaf1", "#ffd36b", "#ffe1d6"], TOAST_T = 1.6;
  function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
    ctx.fillStyle = P.lamp;
    for (let i = 3; i > 0; i--) (ctx.globalAlpha = a * 0.1 * (4 - i)), ctx.beginPath(), ctx.arc(x, y, r * i * 0.5, 0, TAU), ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    const u = 1 - f.light / DAYLIGHT, W = dio.width, H = dio.height, k = dio.focal();
    // The dark: rings of night round your lantern, thicker as the light goes.
    where(f, W3);
    if (u > 0.05 && dio.project(W3[0]! - FS / 2, FY + 0.4, W3[1]! - FS / 2, tmp)) {
      const r0 = Math.max(60, (CELL * 4.2 * k) / tmp[2]!) * (1.25 - u * 0.55), a = Math.min(0.78, (u - 0.05) * 0.95) * (P.dark ? 1.1 : 0.9);
      ctx.fillStyle = P.night;
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = a / 7;
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(tmp[0]!, tmp[1]!, r0 * (0.5 + i * 0.13), 0, TAU, true);
        ctx.fill("evenodd");
      }
      ctx.globalAlpha = 1;
    }
    // Your lantern and the lit ones glow.
    if (dio.project(W3[0]! - FS / 2, FY + 0.35, W3[1]! - FS / 2, tmp)) glow(ctx, tmp[0]!, tmp[1]!, (0.8 * k) / tmp[2]!, u * 0.9);
    for (let i = 0; i < f.nL; i++) {
      if (!f.lit[i]) continue;
      const c = f.lantern[i]!;
      if (dio.project(wx(c % f.g.cols) - 0.55, FY + 1.36, wz((c / f.g.cols) | 0) - 0.55, tmp)) glow(ctx, tmp[0]!, tmp[1]!, (0.7 * k) / tmp[2]!, 0.25 + u * 0.75);
    }
    if (phase === P_READY) {
      const s = f.scare;
      if (dio.project(wx(s % f.g.cols), FY + 3.2, wz((s / f.g.cols) | 0), tmp)) sticker(ctx, "SCARECROW", tmp[0]!, tmp[1]!, Math.round(Math.max(11, Math.min(14, W / 64))), "#ffd36b", "#1f2433");
      if (dio.project(W3[0]! - FS / 2, FY + 1.5, W3[1]! - FS / 2, tmp)) sticker(ctx, "YOU", tmp[0]!, tmp[1]!, Math.round(Math.max(11, Math.min(14, W / 64))), "#fffaf1", "#1f2433");
    }
    if (toastT > 0) {
      const t = 1 - toastT / TOAST_T, sc2 = t < 0.12 ? 0.6 + (t / 0.12) * 0.48 : t < 0.2 ? 1.08 - ((t - 0.12) / 0.08) * 0.08 : 1;
      const px = Math.round(Math.max(16, Math.min(26, W / 30)));
      ctx.save();
      ctx.globalAlpha = t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1;
      ctx.translate(W / 2, V[3]! + 22 + px / 2);
      ctx.scale(sc2, sc2);
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
    const p = `${f.taken}/${f.nP}`;
    if (set(0, p)) pumpEl.textContent = p;
    const l = Math.ceil(f.light);
    if (set(1, l)) (lightEl.textContent = "" + l), (barEl.style.width = `${(100 * f.light) / DAYLIGHT}%`);
    const hint = phase === P_READY ? (coarse ? "Tap to walk in. Then tap a spot or swipe. Find the scarecrow before dark." : "Press an arrow to walk in, or click a spot. Find the scarecrow before dark.") : "";
    if (set(2, hint)) hintEl.textContent = hint;
    if (set(3, said)) live.textContent = said;
    const low = f.light < DAYLIGHT * 0.25;
    if (set(4, low)) top.children[1]!.classList.toggle("cm-low", low);
  }

  // The poster (scripts/gallery-posters.mjs): mid-walk at dusk, two lanterns lit, a crow taking off.
  function poster() {
    V[2] = 0.6;
    V[0] = 1;
    newGame(3);
    begin();
    toastT = 0;
    tapTo(f, f.pumpkin[0]!);
    for (let i = 0; i < 60 * 40 && f.state === WALKING && !(f.taken && f.at === f.to); i++) step(f, 1 / 60), f.ev & EV_LANTERN && ((lampOb[f.evI]!.color = P.lamp), (lampOb[f.evI]!.emissive = true)), (f.ev = 0);
    f.light = DAYLIGHT * 0.45;
    dusk();
    for (let k = 0; k < f.nP; k++) pumpT[k] = f.got[k] ? 1 : 0;
    follow = true;
    setView(true);
  }

  newGame(1);
  engine.start();
  return {
    engine,
    accessible: true,
    get field() {
      return f;
    },
    get state() {
      let away = 0;
      for (let k = 0; k < CROWS; k++) if (f.crowS[k]) away++;
      let lit = 0;
      for (let k = 0; k < f.nL; k++) lit += f.lit[k]!;
      return { phase, state: f.state, taken: f.taken, pumpkins: f.nP, light: f.light, lit, card: !card.hidden, map, crowsAway: away };
    },
    cellScreen(i: number) {
      dio.project(wx(i % f.g.cols), FY, wz((i / f.g.cols) | 0), tmp);
      return [tmp[0]!, tmp[1]!];
    },
    field0: newGame,
    poster,
    destroy: () => engine.destroy(),
  };
}

/** The poster: mid-walk at dusk (scripts/gallery-posters.mjs). */
export const posterAt = 0.4;
