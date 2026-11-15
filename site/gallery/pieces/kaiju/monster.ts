// DOM Kaiju's monsters, all our own designs in flat colours with neon trim: the hero, a giant cyber
// ape the customiser dresses (fur colour and pattern, a face: a heavy brow, a crest or tusks, and gear:
// a cyber arm, a visor, a chest plate, tail spikes, in a trim colour of your pick), and two rivals: a
// crystal crab-beast (SHARDCLAW: a low shell with glowing crystals, six legs, two big claws, eyes on
// stalks) and a tentacle blob (GLOOPMAW: a dome of goo on tentacles, one eye, a wide mouth). The hero's
// name comes from its fur and its face. The rigs are @fzlt/core/diorama parts on a few pivots (hips,
// shoulders, elbows, neck, jaw, tail, legs) posed each frame from a monster's state in ./block.ts:
// walk, hang on a side wall and climb, the punch (sideways, up or down), the grab and the nom, a hit,
// a shock (it flickers dark and light), a landing, the knock-out. Posing allocates nothing.
import type { Diorama, DioramaObject } from "../../../../src/diorama";
import { AIR, CLIMB, ROOF, KO, MK, HERO, CRAB } from "./block";

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
    // Legs: short and thick.
    for (const s of [-1, 1]) {
      const h = grp("hip" + s, "body", [-0.25, 0.05, s * 0.38]);
      P("hip" + s, "box", [0.5, 0.8, 0.5], [0, -0.82, 0], s < 0 ? dark : main);
      P("hip" + s, "box", [0.72, 0.18, 0.55], [0.12, -0.98, 0], skin);
      legs.push(h);
    }
    // Arms: long, knuckles on the ground; arm one (the far side) is the cyber arm.
    for (const s of [-1, 1]) {
      const cyber = s > 0 && g & 1;
      const sh = grp("sh" + s, "tor", [0.3, 1.0, s * 0.78]);
      P("sh" + s, "box", [0.5, 1.0, 0.48], [0, -1.0, 0], cyber ? K.metal : s < 0 ? dark : main);
      const el = grp("el" + s, "sh" + s, [0, -1.0, 0]);
      P("el" + s, "box", [0.52, 0.95, 0.5], [0, -0.95, 0], cyber ? K.metal : s < 0 ? dark : main);
      P("el" + s, "box", [0.66, 0.42, 0.62], [0.03, -1.3, 0], cyber ? shade(K.metal, 0.7) : skin); // the fist
      P("el" + s, "box", [0.56, 0.07, 0.54], [0, -0.35, 0], trim, { emissive: true }); // a wrist band
      if (cyber) for (let k = 0; k < 2; k++) P("el" + s, "box", [0.06, 0.7, 0.06], [0.27, -0.85 + k * 0.05, -0.12 + k * 0.24], trim, { emissive: true });
      arms.push(sh);
      fore.push(el);
    }
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
      P("hip" + k, "box", [0.18, 1.3, 0.18], [0, -1.3, 0], dark);
      legs.push(h);
    }
    // Two claws on the arms.
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.9, 0.5, s * 0.7]);
      P("sh" + s, "box", [0.32, 0.9, 0.32], [0, -0.9, 0], claw);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.55, 0.6, 0.5], [0, -0.6, 0], claw);
      P("el" + s, "wedge", [0.7, 0.3, 0.42], [0.05, -0.95, 0], acc, { emissive: K.night, rot: [0, 0, Math.PI / 2] });
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
      P("tn" + k + "t", "box", [0.5, 0.15, 0.17], [0.22, 0, 0], acc);
      tent.push(tg, tip);
    }
    for (const s of [-1, 1]) {
      const sh = grp("sh" + s, "body", [0.15, 1.0, s * 0.92]);
      P("sh" + s, "box", [0.32, 0.9, 0.3], [0, -0.9, 0], main);
      const el = grp("el" + s, "sh" + s, [0, -0.9, 0]);
      P("el" + s, "box", [0.26, 0.8, 0.26], [0, -0.8, 0], acc);
      P("el" + s, "cyl", [0.42, 0.22, 0.42], [0, -1.0, 0], acc, { sides: 8 });
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
  let yaw = -0.35, arm = 1, lastPa = 0;
  function pose(M: Float64Array, t: number, dt: number) {
    const md = M[5]!, f = M[6]!, ph = M[13]!, pa = M[9]!, ga = M[10]!, nom = M[18]!, squash = M[19]!, zap = M[23]!;
    // Three quarters to the camera; hanging on a side, nearly in profile (facing the wall, or away).
    const want = md === CLIMB ? (f > 0 ? -0.18 : Math.PI + 0.18) : f > 0 ? -0.35 : Math.PI + 0.35;
    let dy = want - yaw;
    dy -= 6.283185307179586 * Math.floor(dy / 6.283185307179586 + 0.5);
    yaw += dy * Math.min(1, dt * 12);
    root.pos[0] = M[0]!;
    root.pos[1] = M[1]!;
    root.pos[2] = M[2]!;
    root.rot[1] = yaw;
    root.rot[2] = md === KO ? -1.35 : zap > 0 ? Math.sin(t * 60) * 0.06 : 0;
    // A shock flickers it light and dark; a hit flashes it white.
    root.tint = zap > 0 ? ((t * 16) | 0) & 1 ? "#ffffff" : K.ink : M[11]! > 0.18 ? "#ffffff" : null;
    const walking = md === 0 || md === ROOF, sw = walking ? Math.sin(ph * 3.2) : 0, moving = Math.abs(M[3]!) > 0.3 || (md === CLIMB && Math.abs(Math.sin(ph * 2.4)) > 0.01);
    const bob = walking && moving ? Math.abs(Math.cos(ph * 3.2)) * 0.1 : 0;
    body.pos[1] = (hipY + bob - squash * 0.25) * MK;
    for (let i = 0; i < legs.length; i++) {
      const s = i & 1 ? 1 : -1;
      legs[i]!.rot[2] = kind === CRAB ? Math.sin(ph * 6 + i * 2.1) * (moving ? 0.35 : 0.04) : md === CLIMB ? Math.sin(ph * 2.4 + i * Math.PI) * 0.4 + 0.7 : md === AIR ? (i ? 0.5 : -0.2) : moving ? sw * 0.6 * s : 0;
    }
    for (let k = 0; k < tent.length; k += 2) {
      const w = Math.sin(t * 4 + k + ph * 3);
      tent[k]!.rot[2] = (md === AIR ? 0.4 : md === CLIMB ? 0.6 : 0) + w * (moving ? 0.25 : 0.06);
      tent[k + 1]!.rot[2] = w * 0.35 + (md === CLIMB ? 0.5 : 0);
    }
    if (tail) (tail.rot[2] = -0.9 + Math.sin(t * 2 + ph) * 0.15), (tail.rot[1] = Math.sin(t * 1.7 + ph * 2) * 0.25);
    // Arms: swing; hanging on a wall, one reaches up to it in turn; the punch throws one (sideways,
    // up or down); the grab reaches and comes back to the mouth; a shock throws them wide.
    if (pa > lastPa + 0.5) arm ^= 1;
    lastPa = pa;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, a = arms[i]!, e = fore[i]!;
      let r = 0, er = 0;
      if (zap > 0) (r = -2.6 + Math.sin(t * 50 + i) * 0.3), (er = -0.4);
      else if (md === CLIMB) (r = i === 0 ? -2.9 + Math.sin(ph * 2.4) * 0.25 : -1.35 + Math.sin(ph * 2.4 + Math.PI) * 0.3), (er = -0.5);
      else if (md === AIR) (r = -2.2 + i * 0.4), (er = -0.3);
      else if (md === KO) (r = -0.6), (er = 0);
      else (r = moving && walking ? -sw * 0.55 * s : -0.12 + Math.sin(t * 1.6 + i) * 0.04), (er = kind === HERO ? 0.15 : -0.25);
      if (pa > 0 && i === arm && zap <= 0) {
        // The punch: straight out (sideways), up over the head, or down at the floor below.
        const k = Math.sin(Math.min(1, pa) * Math.PI), aim = M[32]! > 0 ? -2.9 : M[32]! < 0 ? -0.75 : -1.62;
        r = r + (aim - r) * k;
        er = er * (1 - k);
      }
      if (ga > 0 && i === 1 && zap <= 0) {
        const k = ga > 0.5 ? (1 - ga) * 2 : ga * 2;
        r = r + (-1.9 - r) * k;
        er = er + (-1.2 - er) * (ga < 0.5 ? 1 - k : 0);
      }
      a.rot[2] = r;
      a.rot[0] = s * 0.08;
      e.rot[2] = er;
    }
    neck.rot[2] = md === KO ? 0.4 : zap > 0 ? 0.3 : Math.sin(t * 1.3) * 0.04 - (nom > 0 ? 0.25 : 0);
    jaw.rot[2] = nom > 0 ? -Math.abs(Math.sin(nom * 18)) * 0.6 : zap > 0 || M[11]! > 0 ? -0.5 : pa > 0.3 ? -0.35 : -0.05;
  }
  return { root, pose, height: height * MK, main, acc };
}
export type Monster = ReturnType<typeof buildMonster>;

/** `#rrggbb` darker (k < 1) or lighter (k > 1). */
export function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}
