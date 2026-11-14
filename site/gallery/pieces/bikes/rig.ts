// The Bikes series' bike and rider, drawn: a low-poly dirt bike (or e-bike) and a rider in kit, built
// from @fzlt/core/diorama parts and posed each frame from ./bike.ts (the same file in Moto Track, Big
// Air and Wheelie City). The bike: wheels that spin and ride their springs, a swingarm that follows
// the rear axle, telescoping forks, tank and shrouds, seat, fenders, number plate, the engine (a
// 2-stroke's fat expansion chamber, a 4-stroke's high silencer, an e-motor's glowing battery). The
// rider: a two-bone leg from hip to peg and arm from shoulder to grip (solved each frame), a torso
// that leans with the weight shift, a helmet with its peak; standing in the attack position, sitting
// in a turn. A trick pose (`T`) moves the body and takes the hands or feet off; after a crash the
// rider leaves the bike and tumbles where bike.ts throws them. Cosmetic: builtin maths is fine here.
import type { Diorama, DioramaObject } from "../../../../src/diorama";
import type { Bike } from "./bike";

/** The colours of one bike and rider (`#rrggbb`). */
export interface RigColors {
  /** Plastics (the team colour), a second plastic, the seat, the frame. */
  plastic: string; plastic2: string; seat: string; frame: string;
  /** Tyres, rims and hubs, bright metal, the exhaust. */
  tyre: string; rim: string; metal: string; pipe: string;
  /** The number plate and its number's ink. */
  plate: string; ink: string;
  /** Rider kit: jersey, pants, helmet, its stripe, the visor, boots, gloves. */
  jersey: string; pants: string; helmet: string; stripe: string; visor: string; boots: string; gloves: string;
  /** A glow (an e-motor's battery, the tail light). */
  glow: string;
}

/** Which engine the bike shows. */
export type RigKind = "2t" | "4t" | "e";

/** The trick pose (0 = riding), written by a game before `pose()`: [hands off 0..1, feet off 0..1
 *  (legs back), legs spread 0..1 (sideways), body out over the back 0..1, body up off the seat 0..1,
 *  twist (radians, about the bike's long axis), arms spread 0..1, tuck 0..1 (knees to the bars)]. */
export const TRICK_POSE = 8;

const PI = Math.PI;
// Bike-frame points (x forward, y up, from the centre of mass): the swingarm pivot, the steering head,
// the grips, the pegs, the seat.
const PIVOT = [-0.08, -0.3], HEAD = [0.5, 0.14], GRIP = [0.42, 0.33], PEG = [-0.06, -0.33], SEAT = [-0.22, 0.12];
const THIGH = 0.4, SHIN = 0.42, UPPER = 0.29, FORE = 0.29, TORSO = 0.46;

/** Bones and the solved joints, reused (no allocation per pose). */
const J = new Float64Array(4);
/** Two-bone solve from (ax, ay) to (bx, by), bones l1 then l2, bending to `bend` (+1: the middle joint
 *  forward/up of the line): J = [first bone's angle, second bone's angle, middle x, middle y]. */
function ik(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, bend: number) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const most = l1 + l2 - 1e-4;
  if (d > most) (dx *= most / d), (dy *= most / d), (d = most);
  if (d < 1e-4) (dx = 1e-4), (d = 1e-4);
  const base = Math.atan2(dy, dx), c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), a1 = base + bend * Math.acos(c);
  const mx = ax + Math.cos(a1) * l1, my = ay + Math.sin(a1) * l1;
  J[0] = a1; J[1] = Math.atan2(ay + dy - my, ax + dx - mx); J[2] = mx; J[3] = my;
}

/** A bike and its rider in diorama `d`, named `id`: `pose(bike)` each frame before `d.draw()`. */
export function rig(d: Diorama, id: string, C: RigColors, kind: RigKind = "2t") {
  const root = d.add({ id, shape: "group", size: [1.9, 0, 0.8], tag: { bike: id } });
  const rid = id + ":r";
  const rider = d.add({ id: rid, shape: "group", size: [0.6, 0, 0.5], on: id });
  const parts: DioramaObject[] = [];
  const part = (size: number[], pos: number[], color: string, o: { shape?: "box" | "wedge" | "cyl"; on?: string; rot?: number[]; sides?: number; top?: number; emissive?: boolean; layer?: number } = {}) => {
    const p = d.add({ shape: o.shape || "box", size, pos, rot: o.rot, on: o.on || id, color, sides: o.sides, top: o.top, emissive: o.emissive, layer: o.layer, pick: false });
    parts.push(p);
    return p;
  };
  const group = (gid: string, on: string) => d.add({ id: gid, shape: "group", size: [0.2, 0, 0.2], on, pick: false });
  // A bone: a group at the joint, turned about z; a box along its x.
  const bone = (gid: string, len: number, w: number, z: number, color: string, on = rid) => {
    const g = group(gid, on);
    g.pos[2] = z;
    part([len, w, w], [len / 2, -w / 2, 0], color, { on: gid });
    return g;
  };

  // ---- the bike ----
  const hubs: DioramaObject[] = [];
  for (let i = 0; i < 2; i++) {
    const hid = id + ":w" + i, hub = group(hid, id);
    part([0.68, 0.15, 0.68], [0, 0, -0.075], C.tyre, { shape: "cyl", sides: 14, rot: [PI / 2, 0, 0], on: hid });
    part([0.5, 0.16, 0.5], [0, 0, -0.08], C.rim, { shape: "cyl", sides: 14, rot: [PI / 2, 0, 0], on: hid, layer: 1 });
    part([0.44, 0.17, 0.44], [0, 0, -0.085], C.tyre, { shape: "cyl", sides: 12, rot: [PI / 2, 0, 0], on: hid, layer: 2 });
    // Spokes: two bars across the rim that turn with the wheel; the hub.
    part([0.44, 0.03, 0.18], [0, -0.015, 0], C.metal, { on: hid, layer: 3 });
    part([0.03, 0.44, 0.18], [0, -0.22, 0], C.metal, { on: hid, layer: 3 });
    part([0.12, 0.2, 0.12], [0, 0, -0.1], C.metal, { shape: "cyl", sides: 8, rot: [PI / 2, 0, 0], on: hid, layer: 4 });
    hubs.push(hub);
  }
  // The swingarm (from the pivot to the rear axle) and the fork (upper tubes from the head, sliders from the axle).
  const arm = group(id + ":arm", id);
  part([0.66, 0.08, 0.06], [0.33, -0.04, -0.12], C.metal, { on: id + ":arm" });
  part([0.66, 0.08, 0.06], [0.33, -0.04, 0.12], C.metal, { on: id + ":arm" });
  const fork = group(id + ":fk", id), slider = group(id + ":sl", id);
  for (const z of [-0.12, 0.12]) {
    part([0.38, 0.07, 0.07], [0.19, -0.035, z], C.metal, { on: id + ":fk" });
    part([0.36, 0.09, 0.09], [0.18, -0.045, z], C.frame, { on: id + ":sl" });
  }
  // Frame, engine, exhaust.
  part([0.62, 0.07, 0.1], [0.12, -0.02, 0], C.frame, { rot: [0, 0, -0.45] });
  part([0.42, 0.3, 0.26], [0.06, -0.42, 0], kind === "e" ? C.frame : C.metal);
  if (kind === "2t") {
    // The expansion chamber: fat under the engine on the right, tapering back to a silencer.
    part([0.22, 0.42, 0.22], [0.26, -0.36, 0.17], C.pipe, { shape: "cyl", sides: 8, top: 0.7, rot: [0, 0, PI / 2 + 0.2] });
    part([0.4, 0.1, 0.1], [-0.36, -0.05, 0.15], C.pipe, { rot: [0, 0, 0.3] });
    part([0.32, 0.12, 0.12], [-0.52, 0.02, 0.15], C.metal, { shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.3] });
  } else if (kind === "4t") {
    // A header round the front, a big silencer up high.
    part([0.08, 0.32, 0.08], [0.26, -0.44, 0.15], C.pipe, { rot: [0, 0, 0.6] });
    part([0.5, 0.08, 0.08], [-0.12, -0.32, 0.15], C.pipe, { rot: [0, 0, 0.32] });
    part([0.2, 0.42, 0.2], [-0.5, 0.0, 0.15], C.metal, { shape: "cyl", sides: 8, rot: [0, 0, PI / 2 + 0.28] });
    part([0.1, 0.12, 0.26], [0.02, -0.2, 0], C.metal);
  } else {
    // The battery (a box with a glowing strip) and the motor at the pivot.
    part([0.5, 0.26, 0.24], [0.1, -0.32, 0], C.frame);
    part([0.42, 0.04, 0.25], [0.1, -0.12, 0], C.glow, { emissive: true, layer: 6 });
    part([0.2, 0.2, 0.2], [-0.12, -0.32, 0], C.metal, { shape: "cyl", sides: 10, rot: [PI / 2, 0, 0] });
  }
  // Plastics: tank and shrouds, seat, rear fender (the tail), side panel, front fender, plate, bars.
  part([0.5, 0.22, 0.4], [0.26, -0.08, 0], C.plastic, { shape: "wedge", rot: [0, PI, 0] });
  part([0.34, 0.1, 0.42], [0.24, 0.1, 0], C.plastic2);
  part([0.78, 0.08, 0.22], [-0.2, 0.08, 0], C.seat);
  part([0.55, 0.07, 0.2], [-0.62, 0.06, 0], C.plastic, { shape: "wedge", rot: [0, 0, -0.12] });
  part([0.36, 0.2, 0.3], [-0.36, -0.14, 0], C.plastic2);
  const fender = part([0.44, 0.05, 0.17], [0.86, -0.1, 0], C.plastic, { shape: "wedge", rot: [0, PI, 0.1] });
  part([0.05, 0.26, 0.28], [0.62, 0.08, 0], C.plate, { rot: [0, 0, -0.35] });
  part([0.06, 0.06, 0.64], [GRIP[0]!, GRIP[1]! - 0.03, 0], C.frame);
  part([0.05, 0.05, 0.05], [-0.9, 0.08, 0], C.glow, { emissive: true });

  // ---- the rider (on the bike, or thrown clear after a crash) ----
  const torso = group(id + ":t", rid);
  part([TORSO, 0.2, 0.32], [TORSO / 2, -0.1, 0], C.jersey, { on: id + ":t" });
  part([0.12, 0.21, 0.33], [TORSO * 0.62, -0.105, 0], C.stripe, { on: id + ":t", layer: 5 });
  const head = group(id + ":h", rid);
  part([0.28, 0.27, 0.26], [0.02, -0.04, 0], C.helmet, { shape: "cyl", sides: 8, on: id + ":h" });
  part([0.05, 0.1, 0.19], [0.15, 0.06, 0], C.visor, { on: id + ":h", layer: 6 });
  part([0.2, 0.035, 0.2], [0.16, 0.2, 0], C.stripe, { on: id + ":h", rot: [0, 0, -0.3], layer: 6 });
  part([0.14, 0.11, 0.16], [0.17, -0.06, 0], C.helmet, { shape: "wedge", rot: [0, PI, 0], on: id + ":h" });
  const thigh: DioramaObject[] = [], shin: DioramaObject[] = [], upper: DioramaObject[] = [], fore: DioramaObject[] = [];
  for (let s = 0; s < 2; s++) {
    const z = s ? 0.15 : -0.15, k = id + (s ? "R" : "L");
    thigh.push(bone(k + "th", THIGH, 0.16, z, C.pants));
    const sh = bone(k + "sh", SHIN, 0.14, z, C.boots);
    part([0.22, 0.09, 0.15], [SHIN - 0.02, -0.08, 0], C.boots, { on: k + "sh" });
    shin.push(sh);
    upper.push(bone(k + "ua", UPPER, 0.11, z * 1.3, C.jersey));
    const fa = bone(k + "fa", FORE, 0.1, z * 1.5, C.jersey);
    part([0.09, 0.1, 0.1], [FORE, -0.05, 0], C.gloves, { on: k + "fa" });
    fore.push(fa);
  }

  /** The trick pose (see TRICK_POSE), written by the game. */
  const T = new Float64Array(TRICK_POSE);
  let thrown = false;

  /** Pose everything from bike `b` (call each frame before draw). `stand` 0..1: sitting to the attack position. */
  function pose(b: Bike, stand = 0.7) {
    root.pos.set(b.pos);
    root.rot.set(b.rot);
    const R = b.radius, rx = b.rear, fx = b.front, dy = -b.drop;
    // Wheels on their springs, spinning; the swingarm to the rear axle; the fork to the front.
    const ry = dy + b.comp[0]!, fy = dy + b.comp[1]!;
    hubs[0]!.pos[0] = rx; hubs[0]!.pos[1] = ry; hubs[0]!.rot[2] = -b.spin[0]!;
    hubs[1]!.pos[0] = fx; hubs[1]!.pos[1] = fy; hubs[1]!.rot[2] = -b.spin[1]!;
    hubs[1]!.rot[1] = b.contact[1] || b.air > 0 ? -b.steerAngle * 0.6 : 0;
    arm.pos[0] = PIVOT[0]!; arm.pos[1] = PIVOT[1]!;
    arm.rot[2] = Math.atan2(ry - PIVOT[1]!, rx - PIVOT[0]!);
    const fa = Math.atan2(fy - HEAD[1]!, fx - HEAD[0]!);
    fork.pos[0] = HEAD[0]!; fork.pos[1] = HEAD[1]!; fork.rot[2] = fa;
    slider.pos[0] = fx; slider.pos[1] = fy; slider.rot[2] = fa + PI;
    fender.pos[1] = fy + R + 0.02;
    void R;
    if (b.crashed) {
      if (!thrown) (thrown = true), d.on(rider, null);
      rider.pos.set(b.rider);
      rider.rot.set(b.riderRot);
      limbs(0.2, 0.6, 0.25, 0.9, 0, 0, 0.8, 0, true);
      return;
    }
    if (thrown) (thrown = false), d.on(rider, id);
    rider.pos[0] = rider.pos[1] = rider.pos[2] = 0;
    rider.rot[0] = T[5]!; rider.rot[1] = rider.rot[2] = 0;
    limbs(b.lean, stand, T[0]!, T[1]!, T[2]!, T[3]!, T[6]!, T[7]!, false, T[4]!);
  }
  /** The rider's body: weight (−1 forward .. 1 back), standing, hands and feet off, spread, out over the back. */
  function limbs(lean: number, stand: number, hands: number, feet: number, spread: number, back: number, arms: number, tuck: number, loose: boolean, up = 0) {
    // The hip: over the pegs standing, on the seat sitting; back with the weight, up off the seat in a trick.
    const hx = SEAT[0]! + 0.08 * stand - 0.14 * lean - 0.25 * back + 0.1 * tuck, hy = SEAT[1]! + 0.06 + 0.2 * stand + 0.22 * up + 0.12 * back - 0.06 * tuck;
    // The torso leans forward over the bars (less with the weight back; flat out over the back in a plank).
    const tilt = 0.75 - 0.35 * lean + 0.25 * stand - 0.6 * back + 0.35 * tuck, ta = PI / 2 - tilt;
    torso.pos[0] = hx; torso.pos[1] = hy; torso.rot[2] = ta;
    const sx = hx + Math.cos(ta) * (TORSO - 0.05), sy = hy + Math.sin(ta) * (TORSO - 0.05);
    head.pos[0] = hx + Math.cos(ta) * (TORSO + 0.06); head.pos[1] = hy + Math.sin(ta) * (TORSO + 0.06) - 0.02; head.rot[2] = ta - PI / 2 + 0.15;
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1;
      // Legs: hip to peg (knee forward); feet off, the foot goes back and out (a plank, a split).
      const px = PEG[0]! - feet * 0.85 + tuck * 0.35 + (loose ? 0.1 * side : 0), py = PEG[1]! + feet * 0.42 + tuck * 0.45 + (loose ? -0.2 : 0);
      ik(hx, hy, px, py, THIGH, SHIN, 1);
      const lz = side * (0.15 + spread * 0.55 + (loose ? 0.15 : 0));
      thigh[s]!.pos[0] = hx; thigh[s]!.pos[1] = hy; thigh[s]!.pos[2] = side * 0.15 + (lz - side * 0.15) * 0.5; thigh[s]!.rot[2] = J[0]!;
      shin[s]!.pos[0] = J[2]!; shin[s]!.pos[1] = J[3]!; shin[s]!.pos[2] = lz; shin[s]!.rot[2] = J[1]!;
      thigh[s]!.rot[0] = -side * spread * 0.9;
      shin[s]!.rot[0] = -side * spread * 0.9;
      // Arms: shoulder to grip (elbow out and down); hands off, they go up and out.
      const gx = GRIP[0]! - hands * (0.55 + 0.25 * arms), gy = GRIP[1]! + hands * (0.65 + 0.2 * arms) + (loose ? 0.3 : 0);
      ik(sx, sy, gx, gy, UPPER, FORE, -1);
      const az = side * (0.2 + arms * 0.45 * hands + (loose ? 0.2 : 0));
      upper[s]!.pos[0] = sx; upper[s]!.pos[1] = sy; upper[s]!.pos[2] = side * 0.19; upper[s]!.rot[2] = J[0]!;
      fore[s]!.pos[0] = J[2]!; fore[s]!.pos[1] = J[3]!; fore[s]!.pos[2] = az; fore[s]!.rot[2] = J[1]!;
      upper[s]!.rot[0] = fore[s]!.rot[0] = -side * arms * hands * 0.8;
    }
  }
  /** New colours (a theme change). */
  function recolor(next: RigColors) {
    void next;
  }
  return { root, rider, T, pose, recolor, parts };
}
export type Rig = ReturnType<typeof rig>;
