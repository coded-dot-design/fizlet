// DOM Kaiju's monster: the customiser's parts and the rig that poses them. Every monster is our own,
// built here from original parts: three bodies (a biped brute, a hunched beast, a tentacle blob), four
// heads (horns, fins, a crest, a single eye), two tones from one palette and a pattern (stripes,
// spots, back plates). The name comes from the parts (a body word and a head word). The rig is
// @fzlt/core/diorama parts on a few pivots (hips, shoulders, neck, jaw, tail) posed each frame from the
// round's monster state (./block.ts): walk, climb, the punch, the grab and the nom, a hit, a landing,
// the knock-out. Facing: three quarters to the camera on the street and the roofs, three quarters to
// the face while it climbs. Posing allocates nothing.
import type { Diorama, DioramaObject } from "../../../../src/diorama";
import { WALK, AIR, CLIMB, ROOF, KO, MK } from "./block";

export const BODIES = [
  { id: "brute", name: "BRUTE", blurb: "two legs, big fists" },
  { id: "hunch", name: "HUNCH", blurb: "low, long arms" },
  { id: "blob", name: "BLOB", blurb: "tentacles, no knees" },
];
export const HEADS = [
  { id: "horns", name: "HORNS" },
  { id: "fins", name: "FINS" },
  { id: "crest", name: "CREST" },
  { id: "eye", name: "ONE EYE" },
];
export const PATTERNS = [
  { id: "stripes", name: "STRIPES" },
  { id: "spots", name: "SPOTS" },
  { id: "plates", name: "PLATES" },
];
/** The tones (the piece's palette): name and colour, the same by day and by night. */
export const TONES = [
  { name: "moss", c: "#3fcf8e" },
  { name: "grape", c: "#8f6bff" },
  { name: "lava", c: "#ff6a3d" },
  { name: "tide", c: "#2f8cff" },
  { name: "bolt", c: "#ffd23f" },
  { name: "rose", c: "#ff4fa8" },
];
const FIRST = ["RUMBLE", "SKULK", "GLOOP"], LAST = ["HORN", "FIN", "CREST", "GAZE"];
/** The monster's name from its parts: one word for the body, one for the head. */
export const monsterName = (body: number, head: number) => FIRST[body]! + LAST[head]!;

export interface Look { body: number; head: number; main: number; accent: number; pattern: number }
export interface RigInk { ink: string; eye: string; pupil: string; teeth: string; night: boolean }

export function buildMonster(d: Diorama, look: Look, K: RigInk) {
  const main = TONES[look.main]!.c, acc = TONES[look.accent === look.main ? (look.main + 3) % TONES.length : look.accent]!.c;
  const dark = shade(main, 0.62), belly = shade(main, 1.32);
  const root = d.add({ id: "mon", shape: "group", size: [1.6, 0, 1.2], pos: [0, 0, 0], pick: false, tag: "monster", shadow: 0 });
  // Every part is drawn at MK times the numbers below (the monster is about four floors tall).
  const k3 = (v: number[]) => [v[0]! * MK, v[1]! * MK, v[2]! * MK];
  const P = (on: string, shape: "box" | "wedge" | "cyl" | "prism", size: number[], pos: number[], color: string, o: { rot?: number[]; sides?: number; top?: number; emissive?: boolean; outline?: number[][]; id?: string; mask?: number } = {}) =>
    d.add({ id: o.id, shape, size: k3(size), pos: k3(pos), rot: o.rot, sides: o.sides, top: o.top, color, on, emissive: o.emissive, outline: o.outline && o.outline.map((q) => [q[0]! * MK, q[1]! * MK]), mask: o.mask, pick: false });
  const grp = (id: string, on: string, pos: number[], rot?: number[]) => d.add({ id, shape: "group", size: [0.2, 0, 0.2], pos: k3(pos), rot, on, pick: false });
  const b = look.body;
  // Shape numbers per body: hip height, torso, shoulder, neck height and forward, arm and leg.
  const hipY = b === 0 ? 1.05 : b === 1 ? 0.8 : 0.35;
  const body = grp("m-body", "mon", [0, hipY, 0]);
  const tors = b === 0 ? [1.25, 1.45, 1.15] : b === 1 ? [1.7, 1.05, 1.2] : [1.8, 1.7, 1.6];
  const shY = b === 0 ? 1.3 : b === 1 ? 0.95 : 1.0, shX = b === 0 ? 0.05 : b === 1 ? 0.45 : 0.15, shZ = tors[2]! / 2 + 0.12;
  const neckY = b === 0 ? 1.45 : b === 1 ? 0.8 : 1.62, neckX = b === 0 ? 0.08 : b === 1 ? 0.95 : 0.05;
  const legs: DioramaObject[] = [], arms: DioramaObject[] = [], fore: DioramaObject[] = [], tent: DioramaObject[] = [];
  // ---- the torso ----
  if (b === 0) {
    P("m-body", "box", tors, [0, 0, 0], main);
    P("m-body", "box", [0.3, 1.05, 0.86], [0.55, 0.12, 0], belly, { mask: 63 });
    P("m-body", "box", [1.1, 0.35, 1.05], [-0.05, -0.18, 0], dark);
  } else if (b === 1) {
    // Long and low, tipped forward, a hump on the back.
    const t = grp("m-tor", "m-body", [0, 0, 0], [0, 0, -0.22]);
    void t;
    P("m-tor", "box", tors, [0.2, 0, 0], main);
    P("m-tor", "box", [1.1, 0.4, 1.0], [-0.1, 0.85, 0], main, { rot: [0, 0, 0.12] });
    P("m-tor", "box", [1.35, 0.25, 0.9], [0.25, -0.12, 0], belly);
  } else {
    // A squat dome.
    P("m-body", "cyl", [tors[0]!, tors[1]!, tors[2]!], [0, 0, 0], main, { sides: 12, top: 0.62 });
    P("m-body", "cyl", [tors[0]! * 0.62, 0.18, tors[2]! * 0.62], [0, tors[1]!, 0], main, { sides: 12, top: 0.55 });
    P("m-body", "box", [0.28, 0.95, 1.0], [0.82, 0.2, 0], belly, { rot: [0, 0, 0.18] });
  }
  // ---- the pattern ----
  const pat = look.pattern;
  if (pat === 0) {
    // Stripes across the back.
    for (let k = 0; k < 3; k++) {
      if (b === 2) P("m-body", "box", [0.16, 0.12, tors[2]! * (0.95 - k * 0.1) + 0.04], [-0.55 + k * 0.05, 0.35 + k * 0.42, 0], acc, { rot: [0, 0, 0.4] });
      else P(b === 1 ? "m-tor" : "m-body", "box", [0.2, tors[1]! * 0.8, tors[2]! + 0.1], [-0.42 + k * 0.4 + (b === 1 ? 0.1 : 0), tors[1]! * 0.12, 0], acc);
    }
  } else if (pat === 1) {
    // Spots on both flanks.
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) {
      const u = ((k * 37) % 10) / 10;
      const sx = -0.45 + u * 0.8, sy = 0.2 + (((k * 53) % 10) / 10) * (tors[1]! - 0.45), r = 0.2 + (k % 2) * 0.1;
      P(b === 1 ? "m-tor" : "m-body", "cyl", [r, 0.06, r], [sx, sy, s * (tors[2]! / 2 + (b === 2 ? -0.1 : 0.01))], acc, { sides: 8, rot: [s * Math.PI / 2, 0, 0] });
    }
  } else {
    // Plates down the spine.
    for (let k = 0; k < 4; k++) {
      const h = 0.42 - k * 0.06, on = b === 1 ? "m-tor" : "m-body";
      const y = b === 0 ? tors[1]! - 0.05 - k * 0.34 : b === 1 ? tors[1]! + 0.25 : tors[1]! - 0.25 - k * 0.32;
      const x = b === 0 ? -tors[0]! / 2 - 0.02 : b === 1 ? 0.6 - k * 0.42 : -0.62 - k * 0.08;
      P(on, "prism", [0.1, h, 0.1], [x, y, 0], acc, { outline: [[-0.25, -0.08], [0.25, -0.08], [0.25, 0.08], [-0.25, 0.08]], rot: b === 1 ? [0, 0, 0] : [0, 0, Math.PI / 2] });
    }
  }
  // ---- legs (pivots at the hips) ----
  if (b === 0 || b === 1) {
    const lh = b === 0 ? 1.05 : 0.8;
    for (const s of [-1, 1]) {
      const hip = grp("m-hip" + s, "m-body", [b === 1 ? -0.45 : 0, 0.05, s * 0.36]);
      P("m-hip" + s, "box", [0.5, lh - 0.12, 0.46], [0, -lh + 0.12, 0], s < 0 ? dark : main);
      P("m-hip" + s, "box", [0.72, 0.2, 0.52], [0.12, -lh, 0], dark);
      for (let t = 0; t < 3; t++) P("m-hip" + s, "box", [0.12, 0.1, 0.1], [0.5, -lh + 0.03, -0.16 + t * 0.16], K.teeth);
      legs.push(hip);
    }
  } else {
    // Tentacles round the base: five that curl as it goes.
    for (let k = 0; k < 5; k++) {
      const a = -1.2 + k * 0.6, id = "m-tn" + k, tg = grp(id, "m-body", [Math.cos(a) * 0.55, 0.15, Math.sin(a) * 0.6], [Math.sin(a) * 0.5, -a, 0]);
      P(id, "box", [0.75, 0.22, 0.24], [0.35, -0.24, 0], k % 2 ? dark : main);
      const tip = grp(id + "t", id, [0.7, -0.24, 0]);
      P(id + "t", "box", [0.5, 0.15, 0.17], [0.22, 0, 0], acc);
      tent.push(tg, tip);
    }
  }
  // ---- arms (pivots at the shoulders; a forearm on an elbow) ----
  for (const s of [-1, 1]) {
    const sh = grp("m-sh" + s, "m-body", [shX, shY, s * shZ]);
    const ua = b === 0 ? [0.5, 0.85, 0.46] : b === 1 ? [0.46, 1.0, 0.42] : [0.32, 0.9, 0.3];
    P("m-sh" + s, b === 2 ? "box" : "box", ua, [0, -ua[1]!, 0], s < 0 ? dark : main);
    const el = grp("m-el" + s, "m-sh" + s, [0, -ua[1]!, 0]);
    const fa = b === 0 ? [0.56, 0.78, 0.52] : b === 1 ? [0.5, 0.95, 0.46] : [0.26, 0.8, 0.26];
    P("m-el" + s, "box", fa, [0, -fa[1]!, 0], b === 2 ? acc : s < 0 ? dark : main);
    if (b !== 2) {
      P("m-el" + s, "box", [0.66, 0.42, 0.62], [0.02, -fa[1]! - 0.32, 0], dark); // the fist
      for (let t = 0; t < 3; t++) P("m-el" + s, "box", [0.1, 0.12, 0.1], [0.34, -fa[1]! - 0.28, -0.18 + t * 0.18], K.teeth);
    } else P("m-el" + s, "cyl", [0.42, 0.22, 0.42], [0, -fa[1]! - 0.2, 0], acc, { sides: 8 });
    arms.push(sh);
    fore.push(el);
  }
  // ---- the tail ----
  let tail: DioramaObject | null = null;
  if (b !== 2) {
    tail = grp("m-tail", "m-body", [-tors[0]! / 2 + 0.05, 0.25, 0], [0, 0, -0.5]);
    P("m-tail", "wedge", [1.3, 0.5, 0.42], [-0.55, -0.2, 0], main, { rot: [0, Math.PI, 0] });
  }
  // ---- the head: a block and a jaw, then the head's own part ----
  const neck = grp("m-neck", "m-body", [neckX, neckY, 0]);
  const hw = b === 2 ? 0 : b === 0 ? 0.95 : 0.9;
  if (b !== 2) {
    P("m-neck", "box", [hw, 0.62, 0.88], [0.15, 0.18, 0], main);
    P("m-neck", "box", [0.5, 0.36, 0.7], [0.62, 0.3, 0], main); // snout
  }
  const jaw = grp("m-jaw", "m-neck", [b === 2 ? 0.7 : 0.28, b === 2 ? 0.3 : 0.2, 0]);
  P("m-jaw", "box", [b === 2 ? 0.55 : 0.9, 0.2, b === 2 ? 0.9 : 0.72], [b === 2 ? 0.2 : 0.3, -0.2, 0], b === 2 ? dark : dark);
  for (let t = 0; t < 4; t++) P("m-jaw", "box", [0.09, 0.12, 0.09], [b === 2 ? 0.4 : 0.66, 0, -0.27 + t * 0.18], K.teeth);
  for (let t = 0; t < 4; t++) P("m-neck", "box", [0.09, 0.11, 0.09], [b === 2 ? 1.0 : 0.82, b === 2 ? 0.2 : 0.2, -0.24 + t * 0.16], K.teeth);
  const eyeY = b === 2 ? 0.75 : 0.56, eyeX = b === 2 ? 0.75 : 0.52, single = look.head === 3;
  for (const s of single ? [0] : [-1, 1]) {
    const r = single ? 0.46 : 0.24;
    P("m-neck", "box", [0.08, r, r], [eyeX + 0.02, eyeY - r / 2 + 0.1, s * 0.24], K.eye, { emissive: true });
    P("m-neck", "box", [0.06, r * 0.45, r * 0.45], [eyeX + 0.07, eyeY - r * 0.22 + 0.1, s * 0.24 + 0.03], K.pupil, { emissive: true });
    // A brow over each eye.
    P("m-neck", "box", [0.3, 0.1, r + 0.08], [eyeX - 0.06, eyeY + r / 2 + 0.12, s * 0.24], dark, { rot: [0, 0, -0.25] });
  }
  const hd = look.head;
  if (hd === 0) {
    // Two horns, swept back.
    for (const s of [-1, 1]) {
      const hn = grp("m-hn" + s, "m-neck", [0.05, b === 2 ? 1.0 : 0.78, s * 0.34], [s * 0.35, 0, 0.55]);
      void hn;
      P("m-hn" + s, "cyl", [0.3, 0.7, 0.3], [0, 0, 0], acc, { sides: 7, top: 0 });
    }
  } else if (hd === 1) {
    // Fins on the cheeks and a dorsal fin.
    for (const s of [-1, 1]) P("m-neck", "wedge", [0.6, 0.55, 0.08], [-0.15, b === 2 ? 0.55 : 0.32, s * 0.48], acc, { rot: [s * 0.5, 0, 0] });
    P("m-neck", "wedge", [0.9, 0.7, 0.1], [-0.15, b === 2 ? 1.0 : 0.78, 0], acc);
  } else if (hd === 2) {
    // A crest: a row of blades over the top.
    for (let k = 0; k < 4; k++) P("m-neck", "box", [0.2, 0.5 - k * 0.08, 0.12], [0.45 - k * 0.27, b === 2 ? 1.0 : 0.78, 0], acc, { rot: [0, 0, 0.4] });
  } else {
    // One big eye (above), and a single antenna with a bulb.
    P("m-neck", "box", [0.08, 0.55, 0.08], [0.1, b === 2 ? 1.0 : 0.8, 0], dark, { rot: [0, 0, -0.3] });
    P("m-neck", "cyl", [0.24, 0.24, 0.24], [0.25, b === 2 ? 1.5 : 1.3, 0], acc, { sides: 8, emissive: K.night });
  }

  // ---- the pose ----
  let yaw = -0.35, arm = 1, lastPa = 0;
  function pose(M: Float64Array, t: number, dt: number) {
    const md = M[5]!, f = M[6]!, ph = M[13]!, pa = M[9]!, ga = M[10]!, nom = M[18]!, squash = M[19]!;
    const want = md === CLIMB ? (f > 0 ? 0.95 : Math.PI - 0.95) : f > 0 ? -0.35 : Math.PI + 0.35;
    let dy = want - yaw;
    dy -= 6.283185307179586 * Math.floor(dy / 6.283185307179586 + 0.5);
    yaw += dy * Math.min(1, dt * 12);
    root.pos[0] = M[0]!;
    root.pos[1] = M[1]! + (md === CLIMB ? 0.05 : 0);
    root.pos[2] = M[2]!;
    root.rot[1] = yaw;
    root.rot[0] = 0;
    root.rot[2] = md === KO ? -1.35 : 0;
    root.tint = M[11]! > 0.18 ? "#ffffff" : null;
    const walking = md === WALK || md === ROOF, sw = walking ? Math.sin(ph * 3.2) : 0, moving = Math.abs(M[3]!) > 0.3 || md === CLIMB;
    const bob = walking && moving ? Math.abs(Math.cos(ph * 3.2)) * 0.1 : 0;
    body.pos[1] = (hipY + bob - squash * 0.25 + (md === CLIMB && b === 2 ? 0.3 : 0)) * MK;
    body.rot[2] = md === CLIMB ? 0.1 : b === 1 ? 0 : moving && walking ? -0.06 : 0;
    // Legs: a stride on the street; on a face, one knee up then the other.
    for (let i = 0; i < legs.length; i++) {
      const s = i ? 1 : -1;
      legs[i]!.rot[2] = md === CLIMB ? (Math.sin(ph * 2.4 + i * Math.PI) * 0.45 + 0.55) : md === AIR ? (i ? 0.5 : -0.2) : moving ? sw * 0.6 * s : 0;
    }
    for (let k = 0; k < tent.length; k += 2) {
      const w = Math.sin(t * 4 + k + ph * 3);
      tent[k]!.rot[2] = (md === AIR ? 0.4 : md === CLIMB ? 0.6 : 0) + w * (moving ? 0.25 : 0.06);
      tent[k + 1]!.rot[2] = w * 0.35 + (md === CLIMB ? 0.5 : 0);
    }
    if (tail) tail.rot[2] = -0.5 + Math.sin(t * 2 + ph) * 0.12, (tail.rot[1] = Math.sin(t * 1.7 + ph * 2) * 0.25);
    // Arms: swing; climbing, reach up in turn; the punch throws the front arm (the far one, then the near);
    // the grab reaches and comes back to the mouth.
    // Each new punch swaps the arm that throws it.
    if (pa > lastPa + 0.5) arm ^= 1;
    lastPa = pa;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, a = arms[i]!, e = fore[i]!;
      let r = 0, er = 0;
      if (md === CLIMB) (r = -2.5 + Math.sin(ph * 2.4 + i * Math.PI) * 0.45), (er = -0.4);
      else if (md === AIR) (r = -2.2 + i * 0.4), (er = -0.3);
      else if (md === KO) (r = -0.6), (er = 0);
      else (r = moving && walking ? -sw * 0.55 * s : -0.12 + Math.sin(t * 1.6 + i) * 0.04), (er = b === 1 ? 0.1 : -0.25);
      if (pa > 0 && i === arm) {
        // The punch: up and out, straight at the window (a jab when on a face).
        const k = Math.sin(Math.min(1, pa) * Math.PI);
        r = r + (-1.62 - (md === CLIMB ? -0.9 : 0) - r) * k;
        er = er * (1 - k);
      }
      if (ga > 0 && i === 1) {
        const k = ga > 0.5 ? (1 - ga) * 2 : ga * 2;
        r = r + (-1.9 - r) * k;
        er = er + (-1.2 - er) * (ga < 0.5 ? 1 - k : 0);
      }
      a.rot[2] = r;
      a.rot[0] = md === CLIMB ? -s * 0.15 : s * 0.08;
      e.rot[2] = er;
    }
    neck.rot[2] = md === CLIMB ? 0.35 : md === KO ? 0.4 : Math.sin(t * 1.3) * 0.04 - (nom > 0 ? 0.25 : 0);
    jaw.rot[2] = nom > 0 ? -Math.abs(Math.sin(nom * 18)) * 0.6 : pa > 0.3 ? -0.35 : M[11]! > 0 ? -0.5 : -0.05;
  }
  return { root, pose, height: (b === 0 ? 3.15 : b === 1 ? 2.6 : 2.9) * MK, main, acc };
}
export type Monster = ReturnType<typeof buildMonster>;

/** `#rrggbb` darker (k < 1) or lighter (k > 1). */
export function shade(c: string, k: number) {
  const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}
void ROOF;
