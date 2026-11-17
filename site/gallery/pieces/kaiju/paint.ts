// CitySmash's little drawings over the diorama (scene-side, canvas 2D, nothing allocated per call): the
// people at the windows (an office worker with a tie, a lady with a bag, a kid in a cap, a chef; a face that
// screams when a monster is near, arms that wave or go up), the snipers and the soldiers (a helmet, a
// uniform, a rifle, an aim), and the damage on a facade: crisp cracks branching out over the wall panels, and
// holes as big jagged dark bites that eat across the window frames, with broken edges, an inner shadow, the
// floor slab and its rebar showing, merging with the holes beside them into gashes. Comic, never gory.
// Every shape is seeded by its window, so it stays put frame to frame.

const TAU = 6.283185307179586;
/** A fixed pseudo-random 0..1 from two numbers (a window, a part). */
export const hr = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export interface Ink { ink: string; paper: string; skin: string; hole: string; slab: string; rebar: string; glow: string; uniform: string; helmet: string; metal: string; tie: string; shirts: string[]; hair: string[] }

/** A person at a window, standing in it: variant 0 an office worker (shirt, tie), 1 a lady with a bag,
 *  2 a kid in a cap, 3 a chef (white hat). `panic`: both arms up and a scream; else a wave. */
export function person(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: number, i: number, P: Ink, t: number, panic: boolean) {
  const k = v === 2 ? 0.8 : 1, R = r * k, lw = Math.max(1, r * 0.11), jx = panic ? Math.sin(t * 5) * r * 0.08 : 0, cx = x + jx, top = y + (v === 2 ? r * 0.2 : 0);
  const shirt = v === 3 ? P.paper : P.shirts[(i * 5 + v) % P.shirts.length]!, hair = P.hair[(i * 3) % P.hair.length]!;
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.ink;
  ctx.lineCap = "round";
  // Arms (behind the body): a wave, or both up in a panic.
  const wv = Math.sin(t * (panic ? 2 : 1)) * R * 0.25;
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.42, top + R * 0.42);
  ctx.lineTo(cx - R * 0.78 + wv, top - (panic ? R * 0.55 : R * 0.2));
  if (panic) ctx.moveTo(cx + R * 0.42, top + R * 0.42), ctx.lineTo(cx + R * 0.78 - wv, top - R * 0.55);
  ctx.stroke();
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.arc(cx - R * 0.78 + wv, top - (panic ? R * 0.6 : R * 0.25), R * 0.12, 0, TAU);
  if (panic) ctx.arc(cx + R * 0.78 - wv, top - R * 0.6, R * 0.12, 0, TAU);
  ctx.fill();
  // The body: a shirt.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(cx - R * 0.5, top + R * 0.32, R, R * 0.7, R * 0.22);
  ctx.fill();
  ctx.stroke();
  if (v === 0) {
    // A tie.
    ctx.fillStyle = P.tie;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.08, top + R * 0.36);
    ctx.lineTo(cx + R * 0.08, top + R * 0.36);
    ctx.lineTo(cx + R * 0.05, top + R * 0.8);
    ctx.lineTo(cx, top + R * 0.9);
    ctx.lineTo(cx - R * 0.05, top + R * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (v === 1) {
    // A bag on the arm that is down.
    ctx.fillStyle = P.tie;
    ctx.beginPath();
    ctx.roundRect(cx + R * 0.45, top + R * 0.55, R * 0.36, R * 0.3, R * 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + R * 0.63, top + R * 0.55, R * 0.12, Math.PI, TAU);
    ctx.stroke();
  } else if (v === 2) {
    ctx.strokeStyle = P.paper;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.45, top + R * 0.62);
    ctx.lineTo(cx + R * 0.45, top + R * 0.62);
    ctx.stroke();
    ctx.strokeStyle = P.ink;
  }
  // The head, the hair or the hat.
  const hy = top - R * 0.05, hr2 = R * 0.38;
  if (v === 1) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(cx, hy + R * 0.08, hr2 * 1.18, hr2 * 1.15, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.arc(cx, hy, hr2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = v === 3 ? P.paper : v === 2 ? P.shirts[(i + 2) % P.shirts.length]! : hair;
  ctx.beginPath();
  if (v === 3) {
    ctx.roundRect(cx - hr2 * 0.8, hy - hr2 * 2.0, hr2 * 1.6, hr2 * 1.3, hr2 * 0.5);
    ctx.fill();
    ctx.stroke();
  } else if (v === 2) {
    ctx.arc(cx, hy - hr2 * 0.2, hr2 * 1.02, Math.PI, TAU);
    ctx.rect(cx, hy - hr2 * 0.32, hr2 * 1.3, hr2 * 0.22);
    ctx.fill();
  } else {
    ctx.arc(cx, hy - hr2 * 0.15, hr2 * 1.02, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
  // The face: eyes, and a smile or a scream.
  ctx.fillStyle = P.ink;
  const e = Math.max(1, R * 0.08);
  ctx.beginPath();
  ctx.arc(cx - hr2 * 0.38, hy + hr2 * 0.05, e, 0, TAU);
  ctx.arc(cx + hr2 * 0.38, hy + hr2 * 0.05, e, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  if (panic) {
    ctx.ellipse(cx, hy + hr2 * 0.55, hr2 * 0.24, hr2 * 0.3 + Math.abs(Math.sin(t * 3)) * hr2 * 0.08, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(1, R * 0.07);
    ctx.arc(cx, hy + hr2 * 0.3, hr2 * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** A rifle from (x, y) along (dx, dy) of length l: the stock, the barrel. */
function rifle(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, l: number, P: Ink, lw: number) {
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = lw * 2.4;
  ctx.beginPath();
  ctx.moveTo(x - dx * l * 0.25, y - dy * l * 0.25);
  ctx.lineTo(x + dx * l * 0.35, y + dy * l * 0.35);
  ctx.stroke();
  ctx.lineWidth = lw * 1.2;
  ctx.beginPath();
  ctx.moveTo(x + dx * l * 0.3, y + dy * l * 0.3);
  ctx.lineTo(x + dx * l, y + dy * l);
  ctx.stroke();
}

/** A soldier, standing on the street (feet at y + r): helmet, uniform, a rifle shouldered on the march or
 *  levelled at the target (`aim`), a little recoil as it fires (`kick`). `dir` is the way it faces. */
export function soldier(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: number, aim: number, step: number, kick: number, P: Ink) {
  const lw = Math.max(1, r * 0.12), st = aim ? 0 : Math.sin(step);
  ctx.lineCap = "round";
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = lw * 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.3);
  ctx.lineTo(x - r * 0.25 + st * r * 0.25, y + r);
  ctx.moveTo(x, y + r * 0.3);
  ctx.lineTo(x + r * 0.25 - st * r * 0.25, y + r);
  ctx.stroke();
  ctx.lineWidth = lw;
  ctx.fillStyle = P.uniform;
  ctx.beginPath();
  ctx.roundRect(x - r * 0.33, y - r * 0.45, r * 0.66, r * 0.85, r * 0.15);
  ctx.fill();
  ctx.stroke();
  // A belt.
  ctx.fillStyle = P.ink;
  ctx.fillRect(x - r * 0.33, y + r * 0.12, r * 0.66, lw * 1.4);
  if (aim) rifle(ctx, x + dir * r * 0.1 - dir * kick * r * 0.15, y - r * 0.35, dir, -0.04, r * 1.25, P, lw);
  else rifle(ctx, x - dir * r * 0.15, y - r * 0.05, dir * 0.45, -0.9, r * 1.0, P, lw);
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.68, r * 0.27, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.fillRect(x + dir * r * 0.08 - lw * 0.5, y - r * 0.7, lw, lw);
  ctx.fillStyle = P.helmet;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.74, r * 0.34, Math.PI, TAU);
  ctx.lineTo(x + r * 0.42, y - r * 0.74);
  ctx.lineTo(x - r * 0.42, y - r * 0.74);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** A sniper at a window: helmet, uniform, rifle out of the window towards `dir`. */
export function sniper(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: number, P: Ink, t: number) {
  const lw = Math.max(1, r * 0.11);
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.ink;
  ctx.fillStyle = P.uniform;
  ctx.beginPath();
  ctx.roundRect(x - r * 0.5, y + r * 0.32, r, r * 0.7, r * 0.22);
  ctx.fill();
  ctx.stroke();
  rifle(ctx, x, y + r * 0.3, dir, -0.08 + Math.sin(t) * 0.04, r * 1.2, P, lw);
  ctx.fillStyle = P.skin;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r * 0.38, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.fillRect(x + dir * r * 0.12 - lw * 0.5, y - r * 0.05, lw * 1.2, lw * 1.2);
  ctx.fillStyle = P.helmet;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.12, r * 0.44, Math.PI, TAU);
  ctx.lineTo(x + r * 0.55, y - r * 0.12);
  ctx.lineTo(x - r * 0.55, y - r * 0.12);
  ctx.fill();
  ctx.stroke();
}

/** Cracks out from (cx, cy) over the wall: `n` crisp branches of length `len` (px), each forking once or twice. */
export function cracks(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, n: number, seed: number, P: Ink, lw: number) {
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    let a = (k / n) * TAU + hr(seed, k) * 1.2, x = cx, y = cy, l = len * (0.6 + hr(seed, k + 9) * 0.6);
    // Three kinked segments, a fork off the second.
    for (let j = 0; j < 3; j++) {
      const sl = l * (0.45 - j * 0.1);
      a += (hr(seed, k * 7 + j) - 0.5) * 0.9;
      const nx = x + Math.cos(a) * sl, ny = y + Math.sin(a) * sl * 0.9;
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      if (j === 1) {
        const b = a + (hr(seed, k + j * 13) > 0.5 ? 0.8 : -0.8);
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.cos(b) * sl * 0.6, ny + Math.sin(b) * sl * 0.55);
      }
      (x = nx), (y = ny);
    }
  }
  ctx.stroke();
}

/** The bite's outline: 14 points, the radius jittered (seeded), stretched per side. */
function outline(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, rxL: number, rxR: number, ryU: number, ryD: number, seed: number) {
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU, c = Math.cos(a), s = Math.sin(a), j = k & 1 ? 0.72 + hr(seed, k) * 0.18 : 0.95 + hr(seed, k) * 0.3;
    const px = cx + c * R * j * (c < 0 ? rxL : rxR), py = cy + s * R * j * (s < 0 ? ryU : ryD);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
/** A jagged bite out of the facade at (cx, cy), radius R (px), with a seeded outline; `rx`, `ry` stretch it
 *  (towards neighbours that are holes too: a gash). The dark inside, an inner shadow under the top edge, the
 *  floor slab across it with rebar sticking out, the broken rim in the wall's own colour. */
export function bite(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, rxL: number, rxR: number, ryU: number, ryD: number, seed: number, rim: string, P: Ink, lw: number, slabY: number) {
  outline(ctx, cx, cy, R, rxL, rxR, ryU, ryD, seed);
  // The broken rim (a ragged band of bare wall round the hole).
  ctx.lineWidth = Math.max(2, R * 0.22);
  ctx.strokeStyle = rim;
  ctx.lineJoin = "miter";
  ctx.stroke();
  ctx.fillStyle = P.hole;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // The inner shadow under the top edge, the glow of the room deep inside.
  ctx.fillStyle = P.glow;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(cx - R * rxL, cy + R * 0.2, R * (rxL + rxR), R * ryD);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.ink;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(cx - R * 2 * rxL, cy - R * ryU * 1.2, R * 2 * (rxL + rxR), R * 0.45);
  ctx.globalAlpha = 1;
  // The floor slab across the bite, its broken ends, rebar sticking out.
  const sh = Math.max(2, R * 0.2);
  ctx.fillStyle = P.slab;
  ctx.fillRect(cx - R * 2 * rxL, slabY - sh / 2, R * 2 * (rxL + rxR), sh);
  ctx.strokeStyle = P.rebar;
  ctx.lineWidth = Math.max(1, lw * 0.8);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const x = cx + (hr(seed, k + 40) - 0.5) * R * 1.4, d = hr(seed, k + 50) > 0.5 ? 1 : -1;
    ctx.moveTo(x, slabY);
    ctx.lineTo(x + d * R * 0.12, slabY - R * (0.25 + hr(seed, k + 60) * 0.3));
  }
  ctx.stroke();
  ctx.restore();
  // The jagged edge, inked.
  outline(ctx, cx, cy, R, rxL, rxR, ryU, ryD, seed);
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.ink;
  ctx.stroke();
}
