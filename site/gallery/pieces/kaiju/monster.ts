// CitySmash's monsters, all our own designs in flat colours with neon trim: the hero, a giant cyber
// ape the customiser dresses (fur colour and pattern, a face: a heavy brow, a crest or tusks, and gear:
// a cyber arm, a visor, a chest plate, tail spikes, in a trim colour of your pick), and two rivals: a
// crystal crab-beast (SHARDCLAW: a low shell with glowing crystals, six legs, two big claws, eyes on
// stalks) and a tentacle blob (GLOOPMAW: a dome of goo on tentacles, one eye, a wide mouth). The hero's
// name comes from its fur and its face. The rigs are @fzlt/core/diorama parts on a few pivots (hips,
// shoulders, elbows, neck, jaw, tail, legs) posed each frame from a monster's state in ./block.ts:
// walk, hang on a side wall and climb, the punch (sideways, up or down), the grab and the nom, a hit,
// a shock (it flickers dark and light), a landing, the knock-out. Posing allocates nothing.
import type { Diorama, DioramaObject } from "../../../../src/diorama";
import { AIR, CLIMB, ROOF, KO, MK, HERO, CRAB, PUNCH_CD, PUNCH_HIT } from "./block";

/** The hero's fur, with the word its name takes. */
export const FURS = [
  { name: "ash", c: "#6d6a80", word: "ASH" },
  { name: "ember", c: "#c4552e", word: "EMBER" },
  { name: "moss", c: "#4f7f4c", word: "MOSS" },
  { name: "midnight", c: "#2e3266", word: "MIDNIGHT" },
  { name: "frost", c: "#d6dae8", word: "FROST" },
  { name: "dune", c: "#b08a5a", word: "DUNE" },
];
/** The neon trim (eyes, the spine line, the gear's lights). */
export const TRIMS = [
  { name: "cyan", c: "#22e6ff" },
  { name: "pink", c: "#ff4fa8" },
  { name: "lime", c: "#39ffb0" },
  { name: "gold", c: "#ffd23f" },
  { name: "violet", c: "#a98bff" },
  { name: "red", c: "#ff2e55" },
];
export const PATTERNS = [{ id: "plain", name: "PLAIN" }, { id: "stripes", name: "STRIPES" }, { id: "patches", name: "PATCHES" }];
export const FACES = [{ id: "brow", name: "BROW", word: "BROWLER" }, { id: "crest", name: "CREST", word: "CRESTBACK" }, { id: "tusks", name: "TUSKS", word: "TUSKER" }];
/** Gear, one bit each. */
export const GEAR = [{ id: "arm", name: "CYBER ARM" }, { id: "visor", name: "VISOR" }, { id: "plate", name: "CHEST PLATE" }, { id: "spikes", name: "TAIL SPIKES" }];
/** The rivals' names. */
export const RIVALS = ["SHARDCLAW", "GLOOPMAW"];
/** The hero's name: its fur and its face. */
export const heroName = (fur: number, face: number) => FURS[fur]!.word + " " + FACES[face]!.word;

export interface Look { fur: number; trim: number; pattern: number; face: number; gear: number }
export interface RigInk { ink: string; eye: string; pupil: string; teeth: string; night: boolean; metal: string }

/** A rig's holds on a wall (for a monster facing +x, on a building's left side; the other side mirrors):
 *  its turn, how far it sits in towards the building and out towards the camera, which arm grips (0 or 1), the grip arm, the smash
 *  arm at rest, its wind-up and its hit for a punch down, level, up ([swing, splay, elbow] each), the legs
 *  [thigh, knee, splay], the head's turn. Measured per kind (CitySmash's tests/pose.mjs searched them; tests/dom-kaiju.mjs checks them). */
export interface Wall { yaw: number; ox: number; oz: number; gi: number; grip: number[]; rest: number[]; wind: number[]; hit: number[]; leg: number[]; neck: number }
export const WALL: Wall[] = [
  // the ape
  { yaw: -1.382, ox: -0.1, oz: 0.3, gi: 0, grip: [2.315, 1.8, 2.7], rest: [-0.6, 0.949, 1.76], wind: [-0.6, 0.75, 2.152, -0.6, 1.301, 2.429, 1.515, -1.078, 2.492], hit: [0.209, 1.166, 0, 2.912, -1.578, 0, -0.058, 1.645, 0], leg: [1.268, -1.463, -0.01], neck: 0.4 },
  // SHARDCLAW
  { yaw: -1.382, ox: 0.1, oz: 0.3, gi: 0, grip: [3.191, 0.87, 2.54], rest: [2.266, -1.8, 2.28], wind: [2.085, -1.8, 2.7, 2.174, -1.508, 2.7, 2.063, -0.592, 2.597], hit: [0.063, 1.066, 0, -0.129, 1.367, 0, 3.221, -1.087, 0], leg: [1.4, -1.1, 0.4], neck: 0.4 },
  // GLOOPMAW
  { yaw: -1.382, ox: 0.45, oz: 0.3, gi: 0, grip: [1.739, -0.832, 2.561], rest: [-0.483, 1.191, 2.122], wind: [-0.171, 0.956, 2.404, 1.009, -0.808, 2.375, 1.527, -0.366, 2.018], hit: [0.198, 1.217, 0, 2.727, -1.361, 0, 2.965, -1.196, 0], leg: [1.4, -1.1, 0.4], neck: 0.4 },
];

type Shape = "box" | "wedge" | "cyl" | "prism";
interface PartOpts { rot?: number[]; sides?: number; top?: number; emissive?: boolean; mask?: number }

/** A monster on `d`: `kind` HERO (dressed by `look`), CRAB or BLOB; `id` keeps its part names apart. */
export function buildMonster(d: Diorama, kind: number, look: Look, K: RigInk, id: string) {
  const root = d.add({ id, shape: "group", size: [1.6, 0, 1.2], pos: [0, 0, 0], pick: false, tag: id, shadow: 0 });
  const n = (s: string) => id + "-" + s;
  // Every part is drawn at MK times the numbers below (the monster is about four floors tall).
  const k3 = (v: number[]) => [v[0]! * MK, v[1]! * MK, v[2]! * MK];
  const P = (on: string, shape: Shape, size: number[], pos: number[], color: string, o: PartOpts = {}) =>
    d.add({ shape, size: k3(size), pos: k3(pos), rot: o.rot, sides: o.sides, top: o.top, color, on: on === "" ? id : n(on), emissive: o.emissive, mask: o.mask, pick: false });
  const grp = (gid: string, on: string, pos: number[], rot?: number[]) => d.add({ id: n(gid), shape: "group", size: [0.2, 0, 0.2], pos: k3(pos), rot, on: on === "" ? id : n(on), pick: false });
  const legs: DioramaObject[] = [], arms: DioramaObject[] = [], fore: DioramaObject[] = [], tent: DioramaObject[] = [];
  // The hero's arm parts (for the recolour: which arm is the smashing one) and its colours: fur, dark fur, skin, dark metal.
  const kit: { upper: DioramaObject; pad: DioramaObject; fa: DioramaObject; fist: DioramaObject; kn: DioramaObject[]; ln: DioramaObject[] }[] = [];
  const furs = ["", "", "", ""];
  /** Where it touches a wall: its hands (fists, claws, tentacle ends) and its feet. */
  const hands: DioramaObject[] = [], feet: DioramaObject[] = [], knees: DioramaObject[] = [];
  let cyberOn = false;
  let tail: DioramaObject | null = null, hipY = 1, height = 3;
  let main: string, acc: string;
  const trim = TRIMS[look.trim]!.c;

  if (kind === HERO) {
    // ---- the cyber ape ----
    main = FURS[look.fur]!.c;
    acc = trim;
    const dark = shade(main, 0.6), skin = look.fur === 4 ? "#7a7690" : "#3a2f40", g = look.gear;
    hipY = 0.95;
    height = 3.3;
    grp("body", "", [0, hipY, 0]);
    grp("tor", "body", [0, 0, 0], [0, 0, -0.28]);
    P("tor", "box", [1.15, 1.25, 1.2], [0, 0, 0], main);
    P("tor", "box", [1.0, 0.55, 1.35], [0.15, 0.85, 0], main); // the shoulders' bulk
    P("tor", "box", [0.2, 0.9, 0.8], [0.6, 0.15, 0], g & 4 ? K.metal : skin); // chest (or the plate)
    if (g & 4) P("tor", "box", [0.06, 0.08, 0.86], [0.71, 0.95, 0], trim, { emissive: true });
    P("tor", "box", [1.18, 0.07, 0.08], [-0.05, 1.33, 0], trim, { emissive: true }); // the neon spine line
    if (look.pattern === 1) for (let k = 0; k < 3; k++) P("tor", "box", [0.16, 0.95, 1.26], [-0.4 + k * 0.32, 0.18, 0], dark);
    else if (look.pattern === 2) for (let k = 0; k < 4; k++) for (const s of [-1, 1]) P("tor", "cyl", [0.3 + (k % 2) * 0.12, 0.05, 0.3 + (k % 2) * 0.12], [-0.35 + k * 0.22, 0.25 + ((k * 3) % 4) * 0.2, s * 0.61], shade(main, 1.35), { sides: 8, rot: [(s * Math.PI) / 2, 0, 0] });
    // Legs: short and thick, a knee to bend (on a wall the feet plant on it).
    for (const s of [-1, 1]) {
      const h = grp("hip" + s, "body", [-0.25, 0.05, s * 0.38]);
      P("hip" + s, "box", [0.52, 0.46, 0.5], [0, -0.46, 0], s < 0 ? dark : main);
      const kn = grp("kn" + s, "hip" + s, [0, -0.44, 0]);
      P("kn" + s, "box", [0.48, 0.42, 0.48], [0, -0.42, 0], s < 0 ? dark : main);
      feet.push(P("kn" + s, "box", [0.72, 0.18, 0.55], [0.12, -0.56, 0], skin));
      legs.push(h);
      knees.push(kn);
    }
    // Arms: long, furry, a knuckle fist. Both carry the cyber arm's parts; only the smashing arm (which
    // one turns with the way it faces) shows them, and only with the gear on (recoloured in the pose).
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "tor", [0.3, 1.0, s * 0.78]);
      const upper = P("sh" + s, "box", [0.5, 1.0, 0.48], [0, -1.0, 0], main);
      const pad = P("sh" + s, "box", [0.62, 0.34, 0.6], [0, -0.3, 0], K.metal);
      const el = grp("el" + s, "sh" + s, [0, -1.0, 0]);
      const fa = P("el" + s, "box", [0.52, 0.95, 0.5], [0, -0.95, 0], main);
      const fist = P("el" + s, "box", [0.64, 0.44, 0.6], [0.04, -1.32, 0], skin); // the fist
      const kn: DioramaObject[] = [];
      for (let k = 0; k < 4; k++) kn.push(P("el" + s, "box", [0.14, 0.14, 0.13], [0.36, -1.24, -0.22 + k * 0.147], skin)); // the knuckles
      P("el" + s, "box", [0.56, 0.07, 0.54], [0, -0.35, 0], trim, { emissive: true }); // a wrist band
      const ln: DioramaObject[] = [];
      for (let k = 0; k < 2; k++) ln.push(P("el" + s, "box", [0.06, 0.7, 0.06], [0.27, -0.85 + k * 0.05, -0.12 + k * 0.24], trim, { emissive: true }));
      kit.push({ upper, pad, fa, fist, kn, ln });
      hands.push(fist);
      arms.push(sh);
      fore.push(el);
    }
    furs[0] = main;
    furs[1] = dark;
    furs[2] = skin;
    furs[3] = shade(K.metal, 0.75);
    cyberOn = (g & 1) > 0;
    if (g & 8) {
      tail = grp("tail", "body", [-0.62, 0.3, 0], [0, 0, -0.9]);
      P("tail", "box", [0.9, 0.22, 0.22], [-0.45, -0.1, 0], main);
      for (let k = 0; k < 3; k++) P("tail", "cyl", [0.14, 0.3, 0.14], [-0.2 - k * 0.28, 0.1, 0], trim, { sides: 5, top: 0, emissive: K.night });
    }
    // The head: a block, a muzzle, the face's part, eyes in the trim colour.
    grp("neck", "tor", [0.55, 1.15, 0]);
    P("neck", "box", [0.82, 0.74, 0.82], [0.05, 0, 0], main);
    P("neck", "box", [0.42, 0.34, 0.6], [0.45, 0.04, 0], skin);
    grp("jaw", "neck", [0.35, 0.05, 0]);
    P("jaw", "box", [0.5, 0.18, 0.56], [0.12, -0.18, 0], skin);
    for (let t = 0; t < 3; t++) P("jaw", "box", [0.08, 0.1, 0.08], [0.33, 0, -0.16 + t * 0.16], K.teeth);
    for (const s of [-1, 1]) P("neck", "box", [0.06, 0.13, 0.15], [0.47, 0.42, s * 0.2], trim, { emissive: true });
    const face = look.face;
    P("neck", "box", [0.34, face === 0 ? 0.2 : 0.12, 0.88], [0.32, 0.55, 0], face === 0 ? dark : main, { rot: [0, 0, face === 0 ? -0.15 : 0] }); // the brow
    if (face === 1) for (let k = 0; k < 3; k++) P("neck", "wedge", [0.38, 0.32 - k * 0.06, 0.12], [-0.05 - k * 0.2, 0.74, 0], trim, { emissive: K.night });
    if (face === 2) for (const s of [-1, 1]) P("jaw", "cyl", [0.13, 0.38, 0.13], [0.32, -0.08, s * 0.24], K.teeth, { sides: 6, top: 0, rot: [s * 0.25, 0, -0.35] });
    if (g & 2) P("neck", "box", [0.1, 0.13, 0.9], [0.48, 0.42, 0], trim, { emissive: true }); // the visor
    for (const s of [-1, 1]) P("neck", "box", [0.16, 0.2, 0.08], [0, 0.45, s * 0.44], skin); // ears
  } else if (kind === CRAB) {
    // ---- SHARDCLAW, the crystal crab-beast ----
    main = "#3d3378";
    acc = "#7cf6ff";
    const dark = "#262054", claw = "#6a58c8";
    hipY = 1.1;
    height = 2.6;
    grp("body", "", [0, hipY, 0]);
    P("body", "box", [2.0, 0.8, 1.6], [0, 0, 0], main);
    P("body", "box", [1.6, 0.3, 1.3], [-0.1, 0.8, 0], dark);
    P("body", "box", [2.05, 0.08, 1.65], [0, 0.38, 0], acc, { emissive: true });
    for (let k = 0; k < 5; k++) P("body", "cyl", [0.3, 0.7 + (k % 2) * 0.35, 0.3], [-0.65 + k * 0.32, 1.05, ((k * 7) % 3 - 1) * 0.3], k % 2 ? acc : "#c9a6ff", { sides: 5, top: 0, emissive: true, rot: [0, 0, 0.3 - k * 0.15] });
    // Six legs.
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, x = -0.65 + (k % 3) * 0.6, h = grp("hip" + k, "body", [x, 0.2, s * 0.8], [s * 0.6, 0, 0]);
      void h;
      const lg = P("hip" + k, "box", [0.18, 1.3, 0.18], [0, -1.3, 0], dark);
      if (k === 2 || k === 5) feet.push(lg);
      legs.push(h);
    }
    // Two claws on the arms.
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.9, 0.5, s * 0.7]);
      P("sh" + s, "box", [0.32, 0.9, 0.32], [0, -0.9, 0], claw);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.55, 0.6, 0.5], [0, -0.6, 0], claw);
      hands.push(P("el" + s, "wedge", [0.7, 0.3, 0.42], [0.05, -0.95, 0], acc, { emissive: K.night, rot: [0, 0, Math.PI / 2] }));
      P("el" + s, "wedge", [0.5, 0.22, 0.4], [0.3, -0.95, 0], claw, { rot: [0, 0, Math.PI / 2] });
      arms.push(sh);
      fore.push(el);
    }
    grp("neck", "body", [0.95, 0.75, 0]);
    for (const s of [-1, 1]) {
      P("neck", "box", [0.1, 0.55, 0.1], [0, 0, s * 0.3], dark);
      P("neck", "cyl", [0.22, 0.22, 0.22], [0, 0.55, s * 0.3], K.eye, { sides: 8, emissive: true });
    }
    grp("jaw", "body", [1.0, 0.1, 0]);
    P("jaw", "box", [0.3, 0.2, 0.8], [0.05, -0.1, 0], dark);
    for (let t = 0; t < 4; t++) P("jaw", "box", [0.08, 0.1, 0.08], [0.2, 0, -0.27 + t * 0.18], K.teeth);
  } else {
    // ---- GLOOPMAW, the tentacle blob ----
    main = "#b23a9e";
    acc = "#b6ff3a";
    const dark = "#7a2470";
    hipY = 0.35;
    height = 2.9;
    grp("body", "", [0, hipY, 0]);
    P("body", "cyl", [1.8, 1.7, 1.6], [0, 0, 0], main, { sides: 12, top: 0.62 });
    P("body", "cyl", [1.1, 0.18, 1.0], [0, 1.7, 0], main, { sides: 12, top: 0.55 });
    for (let k = 0; k < 4; k++) P("body", "cyl", [0.3, 0.06, 0.3], [-0.5 + k * 0.3, 0.5 + (k % 2) * 0.5, 0.76], acc, { sides: 8, rot: [Math.PI / 2, 0, 0], emissive: K.night });
    for (let k = 0; k < 5; k++) {
      const a = -1.2 + k * 0.6, tg = grp("tn" + k, "body", [Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.6], [Math.sin(a) * 0.5, -a, 0]);
      P("tn" + k, "box", [0.75, 0.22, 0.24], [0.35, -0.24, 0], k % 2 ? dark : main);
      const tip = grp("tn" + k + "t", "tn" + k, [0.7, -0.24, 0]);
      const tp = P("tn" + k + "t", "box", [0.5, 0.15, 0.17], [0.22, 0, 0], acc);
      if (k === 1 || k === 3) feet.push(tp);
      tent.push(tg, tip);
    }
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.15, 1.0, s * 0.92]);
      P("sh" + s, "box", [0.32, 0.9, 0.3], [0, -0.9, 0], main);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.26, 0.8, 0.26], [0, -0.8, 0], acc);
      hands.push(P("el" + s, "cyl", [0.42, 0.22, 0.42], [0, -1.0, 0], acc, { sides: 8 }));
      arms.push(sh);
      fore.push(el);
    }
    grp("neck", "body", [0.05, 1.62, 0]);
    P("neck", "box", [0.08, 0.5, 0.5], [0.77, 0.5, 0], K.eye, { emissive: true });
    P("neck", "box", [0.06, 0.24, 0.24], [0.82, 0.62, 0.03], K.pupil, { emissive: true });
    grp("jaw", "neck", [0.7, 0.3, 0]);
    P("jaw", "box", [0.55, 0.2, 0.9], [0.2, -0.2, 0], dark);
    for (let t = 0; t < 5; t++) P("jaw", "box", [0.09, 0.12, 0.09], [0.4, 0, -0.32 + t * 0.16], K.teeth);
  }
  const body = d.get(n("body"))!, neck = d.get(n("neck"))!, jaw = d.get(n("jaw"))!;

  // ---- the pose ----
  // On a wall (measured per kind so the hands and feet land where they should: tests/dom-kaiju.mjs): the body
  // beside the building, seen from the front; the grip arm (the one by the building) clamps its side edge at
  // the front corner, the feet clamp the edge under it; the smash arm swings across into the front face's
  // windows next to the edge (the fist lands on the face, in front of the body, always in sight).
  const W = WALL[kind]!;
  let yaw = -0.35;
  function pose(M: Float64Array, t: number, dt: number) {
    const md = M[5]!, f = M[6]!, ph = M[13]!, ga = M[10]!, nom = M[18]!, squash = M[19]!, zap = M[23]!;
    const wall = md === CLIMB, pt = PUNCH_CD - M[8]!, punching = M[8]! > 0 && zap <= 0;
    // On the street: three quarters to the camera. On a wall: beside the building, turned to the camera.
    const want = wall ? (f > 0 ? W.yaw : Math.PI - W.yaw) : f > 0 ? -0.35 : Math.PI + 0.35;
    let dy = want - yaw;
    dy -= 6.283185307179586 * Math.floor(dy / 6.283185307179586 + 0.5);
    yaw += dy * Math.min(1, dt * 14);
    // The climb's cycle (it runs only while it moves up or down) and the idle breath.
    const moving = Math.abs(M[3]!) > 0.3 || (wall && Math.abs(M[33]!) > 0.3), cyc = Math.sin(ph * 2.4), br = Math.sin(t * 1.9);
    root.pos[0] = M[0]! + (wall ? f * W.ox : 0);
    root.pos[1] = M[1]! + (wall ? (moving ? Math.abs(Math.cos(ph * 2.4)) * 0.12 : br * 0.03) * MK : 0);
    root.pos[2] = M[2]! + (wall ? W.oz : 0);
    root.rot[1] = yaw;
    root.rot[2] = md === KO ? -1.35 : zap > 0 ? Math.sin(t * 60) * 0.06 : 0;
    // A shock flickers it light and dark; a hit flashes it white.
    root.tint = zap > 0 ? ((t * 16) | 0) & 1 ? "#ffffff" : K.ink : M[11]! > 0.18 ? "#ffffff" : null;
    const walking = md === 0 || md === ROOF, sw = walking ? Math.sin(ph * 3.2) : 0;
    const bob = walking && moving ? Math.abs(Math.cos(ph * 3.2)) * 0.1 : 0;
    body.pos[1] = (hipY + bob - squash * 0.25) * MK;
    // Legs. On a wall both feet plant on it: thighs up, knees bent and splayed, pushing in turn as it climbs.
    for (let i = 0; i < legs.length; i++) {
      const s = i & 1 ? 1 : -1, lg = legs[i]!, push = i & 1 ? -cyc : cyc;
      if (kind === CRAB) (lg.rot[2] = wall ? 0.5 + push * (moving ? 0.35 : 0.04) : Math.sin(ph * 6 + i * 2.1) * (moving ? 0.35 : 0.04));
      else if (wall) (lg.rot[2] = W.leg[0]! + (moving ? push * 0.35 : br * 0.03)), (lg.rot[0] = (f > 0 ? -s : s) * W.leg[2]!);
      else (lg.rot[2] = md === AIR ? (i ? 0.6 : -0.1) : moving ? sw * 0.6 * s : 0), (lg.rot[0] = 0);
    }
    for (let i = 0; i < knees.length; i++) {
      const push = i & 1 ? -cyc : cyc;
      knees[i]!.rot[2] = wall ? W.leg[1]! - (moving ? push * 0.3 : 0) : md === AIR ? -0.5 : walking && moving ? -Math.max(0, Math.sin(ph * 3.2 + i * Math.PI)) * 0.5 : 0;
    }
    for (let k = 0; k < tent.length; k += 2) {
      const w = Math.sin(t * 4 + k + ph * 3);
      tent[k]!.rot[2] = (md === AIR ? 0.4 : wall ? 0.9 : 0) + w * (moving ? 0.25 : 0.06);
      tent[k + 1]!.rot[2] = w * 0.35 + (wall ? 0.6 : 0);
    }
    if (tail) (tail.rot[2] = -0.9 + Math.sin(t * 2 + ph) * 0.15), (tail.rot[1] = Math.sin(t * 1.7 + ph * 2) * 0.25);
    // Arms. Angles swing forward from hanging straight down (0: down, π/2: straight ahead, π: overhead), elbows
    // bend the forearm forward, a splay (about the arm's own x) takes a hand in or out. On a wall the grip arm
    // (the one by the building) clamps the side edge at the front corner, hand over hand as it climbs, and never
    // lets go; the smash arm rests cocked in front of the chest and does the smashing (and the grabbing): it
    // swings across into the front face. On the street the smashing arm is the one nearer the camera. The punch
    // keeps the round's fixed timing (./block.ts PUNCH_CD, PUNCH_HIT): the wind-up, the hit frame (the fist on
    // the window the round hits: the one level with the hand, above or below), a short hold, the recovery.
    const grip = wall ? (f > 0 ? W.gi : 1 - W.gi) : -1, out = wall ? 1 - grip : f > 0 ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, a = arms[i]!, e = fore[i]!, outside = i === out;
      let r = 0, er = 0, sp = s * 0.08;
      if (zap > 0) (r = 2.6 + Math.sin(t * 50 + i) * 0.3), (er = 0.3), (sp = s * 0.5);
      else if (wall && i === grip) (r = W.grip[0]! + (moving ? cyc * 0.25 : br * 0.03)), (sp = s * W.grip[1]!), (er = W.grip[2]! - (moving ? cyc * 0.25 : 0));
      else if (wall) (r = W.rest[0]! + br * 0.04), (sp = s * W.rest[1]!), (er = W.rest[2]!);
      else if (md === AIR) (r = 2.3 - i * 0.4), (er = 0.3);
      else if (md === KO) (r = 0.6), (er = 0.2);
      else if (moving && walking) (r = (kind === HERO ? 0.3 : 0.15) + sw * 0.5 * s), (er = 0.35);
      else (r = 0.22 + Math.sin(t * 1.6 + i) * 0.04), (er = 0.3);
      if (punching && outside) {
        const d = M[32]!, j = (d > 0 ? 2 : d < 0 ? 0 : 1) * 3;
        // On a wall the hit and the wind-up come from the table; on the street, a slam by the direction.
        const wr = wall ? W.wind[j]! : d > 0 ? 3.3 : d < 0 ? 1.45 : 0.6, ws = wall ? s * W.wind[j + 1]! : sp, we = wall ? W.wind[j + 2]! : d > 0 ? 1.3 : d < 0 ? 1.1 : 1.7;
        const hr = wall ? W.hit[j]! : d > 0 ? 2.55 : d < 0 ? 0.8 : 1.6, hs = wall ? s * W.hit[j + 1]! : sp, he = wall ? W.hit[j + 2]! : d !== 0 ? 0.15 : 0;
        // (The round's hit frame is when its countdown M[34] runs out: until then the wind-up.)
        if (M[34]! > 0) {
          const k = Math.min(1, pt / PUNCH_HIT);
          (r += (wr - r) * k), (sp += (ws - sp) * k), (er += (we - er) * k);
        } else {
          const k = Math.max(0, (pt - PUNCH_HIT) / (PUNCH_CD - PUNCH_HIT) - 0.3) / 0.7;
          (r = hr + (r - hr) * k * k), (er = he + (er - he) * k * k), (sp = hs + (sp - hs) * k * k);
        }
      }
      if (ga > 0 && outside && zap <= 0) {
        // The grab: out to the window, then back to the mouth.
        const k = ga > 0.5 ? (1 - ga) * 2 : 1;
        const gr = wall ? W.hit[3]! : 1.9, gs = wall ? s * W.hit[4]! : sp, ge = wall ? W.hit[5]! : 0.2;
        r = r + (gr - r) * k;
        sp = sp + (gs - sp) * (ga > 0.5 ? k : 1 - (1 - ga * 2));
        er = ga > 0.5 ? er + (ge - er) * k : er + (2.1 - er) * (1 - ga * 2);
      }
      a.rot[2] = r;
      a.rot[0] = sp;
      e.rot[2] = er;
    }
    // The hero's colours follow the smashing arm: fur near, darker fur far; the cyber arm (with the gear on)
    // on the smashing arm only.
    for (let i = 0; i < kit.length; i++) {
      const p = kit[i]!, cy = cyberOn && i === out, fur = i === out ? furs[0]! : furs[1]!;
      if (p.upper.color !== fur) p.upper.color = fur;
      const fa = cy ? K.metal : fur, fs = cy ? furs[3]! : furs[2]!;
      if (p.fa.color !== fa) p.fa.color = fa;
      if (p.fist.color !== fs) {
        p.fist.color = fs;
        for (let k = 0; k < p.kn.length; k++) p.kn[k]!.color = fs;
      }
      const la = cy ? 1 : 0;
      if (p.pad.alpha !== la) (p.pad.alpha = la), (p.ln[0]!.alpha = la), (p.ln[1]!.alpha = la);
    }
    // The head turns to the camera on a wall.
    neck.rot[1] = wall ? (f > 0 ? W.neck : -W.neck) : 0;
    neck.rot[2] = md === KO ? 0.4 : zap > 0 ? 0.3 : wall ? 0.25 : Math.sin(t * 1.3) * 0.04 - (nom > 0 ? 0.25 : 0);
    jaw.rot[2] = nom > 0 ? -Math.abs(Math.sin(nom * 18)) * 0.6 : zap > 0 || M[11]! > 0 ? -0.5 : M[8]! > 0 ? -0.35 : -0.05;
  }
  return { root, pose, height: height * MK, main, acc, hands, feet };
}
export type Monster = ReturnType<typeof buildMonster>;

/** `#rrggbb` darker (k < 1) or lighter (k > 1). */
export function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}
