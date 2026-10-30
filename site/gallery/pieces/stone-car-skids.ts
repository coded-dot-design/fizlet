// "Foot brake": rush hour on Main Street, Rubbleton. Bonk Cobbleworth drives the family's stone
// tub car: no floor, so his feet run along the road under it, and the back is full of rocks from
// the quarry. Click and he slams the brakes: his heels dig in, the car skids in a cloud of dust and
// the load keeps going, rocks flung forward in arcs into the billboard's real letters (SLOW DOWN!),
// which crack, and come down onto the road. Click again to set off. Click twice fast and he floors
// it: legs a blur, speed lines, and the stop from there is a big one. The speed bump is a page
// element too: the car hops it (at full tilt it flies), and whatever lies on the road (a letter, a
// rock) gets bumped along. Leave him parked and Bonk whistles: the letters climb back up and the
// rocks hop back into the car. Left to drive on his own, he parks after a while.
// Bricks: the kernel (fixed step; settle: it sleeps once the car is parked and the page whole; its
// ledger for every page write, so Recall gives the page back byte for byte). The look, the bodies
// and the words are shared with the rest of the series (stone-age.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { DUST, FACE, HAT, HOME, INK, LEAF, LEAF_D, LOOSE, SHOUT, SKIN, STONE, STONE_D, W, WHISTLE, WHITE, WOOD, bits, bodies, bonk, dot, hitBox, ink, limb, oval, pip, rock, taps, view, words } from "./stone-age";

export type CarScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly speed: number; readonly loose: number; readonly flung: number };

const { abs, cos, sin, max, min, round, PI } = Math;
const ROAD = 318, G = 1100, CAP = 8, RR = 7, CRUISE = 170, FAST = 330, WR = 15;
// The car: parked, driving, floored, braking.
const PARK = 0, DRIVE = 1, FLOOR = 2, BRAKE = 3;
const WORDS = ["SKREEEE!", "KRAK!", "WHOA!", "VROOOM!", "BUMP!", "WHEEE!", "TWEET!", "KLONK!", "HONK HONK!"];

export function car(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): CarScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 33 });
  const rnd = engine.random, v = view(engine, stage), g = v.g;
  const wrap = slot.querySelector<HTMLElement>(".sc3")!, els = [...wrap.querySelectorAll<HTMLElement>("i")];
  const pg = bodies(engine, wrap, els), B = pg.B, n = pg.n, bump = n - 1;
  const fx = bits(rnd), say = words(WORDS);
  const HIT = new Float32Array(n);
  // Rocks: in the car's load (0), flying or lying on the road (1), hopping home to the car (2).
  const K = Array.from({ length: CAP }, (_, i) => ({ x: 0, y: 0, vx: 0, vy: 0, a: 0, st: 0, t: 0, ax: 0, ay: 0, r: RR + (i % 3), seed: i * 7 + 3 }));
  const S = {
    mode: PARK, x: first ? 120 : -90, vx: 0, y: 0, vy: 0, pitch: 0, wheel: 0, run: 0, t: 0, now: 0, last: -9, idle: 0,
    auto: first ? 0 : 0.35, autoBrake: first ? 0 : 1, whistle: 0, flung: 0, air: 0, cross: -1,
  };
  const out = new Float64Array(3);

  const tap = (_x: number, _y: number) => {
    S.idle = 0;
    const quick = S.now - S.last < 0.3;
    S.last = S.now;
    if (S.mode === PARK) S.mode = DRIVE, (S.t = 0), say.say(8, S.x + 30, ROAD - 100, 16, -0.1);
    else if (S.mode === DRIVE && quick) (S.mode = FLOOR), (S.t = 0), say.say(3, S.x + 40, ROAD - 96, 24, -0.08);
    else if (S.mode !== BRAKE) brake();
  };
  taps(engine, stage, first, tap);

  /** Heels down: the skid, and the load keeps going. */
  function brake() {
    S.mode = BRAKE;
    S.t = 0;
    say.say(0, S.x + 10, ROAD - 92, S.vx > 250 ? 30 : 22, -0.06);
    const k = min(CAP, round(S.vx / 45));
    for (let j = 0, f = 0; j < CAP && f < k; j++) {
      const o = K[j]!;
      if (o.st) continue;
      f++;
      o.st = 1;
      o.x = S.x - 34 + (j % 4) * 7;
      o.y = ROAD - 62 - S.y - (j % 2) * 6;
      o.vx = S.vx * (1.1 + rnd() * 0.9) + 50;
      o.vy = -300 - rnd() * 180 - S.vx * 0.25;
      S.flung++;
    }
    if (S.vx > 250) say.say(2, S.x - 10, ROAD - 120, 18, 0.12);
  }

  /** A home letter takes a hit of speed `vn` from a rock. */
  function hit(i: number, x: number, y: number, nx: number, ny: number, vn: number, vx: number) {
    const b = B[i]!;
    if (S.now - HIT[i]! < 0.25) return false;
    HIT[i] = S.now;
    if (vn > 520 || (b.crack && vn > 160)) {
      b.crack = 2;
      pg.loosen(i, vx * 0.4, -160, (rnd() - 0.5) * 600);
      fx.chips(x, y, 6, 100);
      say.say(7, x, y - 22, 20, (rnd() - 0.5) * 0.3);
      return true;
    }
    if (vn > 110) {
      b.crack = 1;
      pg.kick(i, -nx * vn * 0.3, -ny * vn * 0.3, (rnd() - 0.5) * vn * 0.5);
      fx.chips(x, y, 3, 70);
      say.say(1, x, y - 20, 17, (rnd() - 0.5) * 0.3);
    }
    return false;
  }

  /** The whistle: letters climb back up, rocks hop back into the car. */
  function tidy() {
    S.whistle = 1.4;
    say.say(6, S.x, ROAD - 104, 20, -0.1);
    for (let i = 0; i < n; i++) {
      const b = B[i]!;
      if (b.md === LOOSE) pg.home(i, 0.3 + abs(b.x + b.dx - S.x) * 0.0015);
      else if (b.crack) (b.crack = 0), pg.kick(i, 0, -60, 0);
    }
    for (let j = 0; j < CAP; j++) {
      const o = K[j]!;
      if (o.st === 1) (o.st = 2), (o.t = -0.2 - j * 0.07), (o.ax = o.x), (o.ay = o.y);
    }
  }

  engine.add({
    read() {
      if (v.fit()) pg.measure();
    },
    step(e, dt) {
      let busy = false;
      S.now += dt;
      S.t += dt;
      if (S.auto > 0) {
        busy = true;
        if ((S.auto -= dt) <= 0) tap(0, 0);
      }
      // The intro: in from the left, over the bump, and a big stop under the billboard.
      if (S.autoBrake) {
        busy = true;
        if (S.mode === DRIVE && S.x > 128) (S.autoBrake = 0), brake();
      }
      // Left to drive on his own, he parks after a few laps' worth (the page gets to sleep).
      if ((S.mode === DRIVE || S.mode === FLOOR) && S.now - S.last > 7 && S.x > 60 && S.x < 200) brake();
      // The car: speed toward its goal, the feet and the wheels from the distance covered.
      const m = S.mode;
      if (m !== PARK) busy = true;
      if (m === DRIVE) S.vx = min(CRUISE, S.vx + 260 * dt);
      else if (m === FLOOR) S.vx = min(FAST, S.vx + 420 * dt);
      else if (m === BRAKE) {
        S.vx = max(0, S.vx - 380 * dt);
        if (S.vx > 20 && rnd() < 0.7) fx.add(0, S.x + 6 + rnd() * 10, ROAD - 2, -S.vx * 0.15 - rnd() * 30, -rnd() * 30, 5 + rnd() * 5, 0.5);
        if (!S.vx) (S.mode = PARK), (S.t = 0);
      }
      const target = m === BRAKE ? 5 : m === FLOOR ? -3 : m === DRIVE && S.t < 0.4 ? -2 : 0;
      S.pitch += (target - S.pitch) * min(1, 10 * dt);
      S.x += S.vx * dt;
      S.wheel += (S.vx * dt) / WR;
      if (m === DRIVE || m === FLOOR) S.run += S.vx * dt * 0.09 + dt * 8;
      if (S.x > W + 90) S.x -= W + 180; // round the block
      // Up and down: the bump, letters and rocks on the road give it a hop; at full tilt it flies.
      if (S.y > 0 || S.vy) {
        S.vy += G * dt;
        S.y = max(0, S.y - S.vy * dt);
        if (!S.y && S.vy > 0) {
          if (S.vy > 220) fx.puff(S.x, ROAD - 2, 6, 60, 9), S.air > 0.25 && say.say(4, S.x, ROAD - 90, 18);
          S.vy = 0;
          S.air = 0;
        } else S.air += dt;
        busy = true;
      }
      // What the front wheel meets: the speed bump (home), and anything lying on the road.
      if (S.vx > 30 && !S.y) {
        const fx0 = S.x + 42;
        const b = B[bump]!;
        if (b.md === HOME && fx0 > b.x && fx0 < b.x + 12 && S.cross !== bump) {
          S.cross = bump;
          S.vy = -(S.vx * (S.vx > 250 ? 1.5 : 0.8));
          pg.kick(bump, 0, -40 - S.vx * 0.2, 0);
          if (S.vx > 250) say.say(5, S.x + 20, ROAD - 110, 24, -0.1);
          else say.say(4, S.x + 30, ROAD - 86, 16, 0.1);
        }
        if (fx0 > b.x + 40) S.cross = -1;
        for (let i = 0; i < n - 1; i++) {
          const l = B[i]!;
          if (l.md !== LOOSE || !l.rest) continue;
          const cx = pg.cx(i);
          if (abs(fx0 - cx) < 10) (l.rest = 0), (l.vx = S.vx * 1.1 + 40), (l.vy = -160), (l.vr = 400), (S.vy = -S.vx * 0.35), say.say(7, cx, ROAD - 60, 16);
        }
        for (let j = 0; j < CAP; j++) {
          const o = K[j]!;
          if (o.st === 1 && abs(o.y - (ROAD - o.r)) < 2 && abs(fx0 - o.x) < o.r + 4 && o.vx < S.vx) (o.vx = S.vx * 1.3 + 30), (o.vy = -200), (S.vy = -S.vx * 0.25);
        }
      }

      // The rocks.
      for (let j = 0; j < CAP; j++) {
        const o = K[j]!;
        if (o.st === 2) {
          // Home to the car, in an arc.
          busy = true;
          if ((o.t += dt / 0.55) < 0) continue;
          const u = min(1, o.t), q = u * u * (3 - 2 * u), hx = S.x - 34 + (j % 4) * 7, hy = ROAD - 62 - (j % 2) * 6;
          o.x = o.ax + (hx - o.ax) * q;
          o.y = o.ay + (hy - o.ay) * q - sin(u * PI) * 60;
          if (u >= 1) o.st = 0;
          continue;
        }
        if (o.st !== 1) continue;
        if (o.vx || o.vy || o.y < ROAD - o.r - 0.5) busy = true;
        else continue;
        o.vy += G * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.a += (o.vx / o.r) * dt;
        if (o.y > ROAD - o.r) {
          o.y = ROAD - o.r;
          if (o.vy > 120) fx.puff(o.x, ROAD - 2, 3, 30, 6), (o.vy = -o.vy * 0.3);
          else o.vy = 0;
          o.vx *= 0.8;
          if (abs(o.vx) < 6 && !o.vy) o.vx = 0;
        }
        if (o.x > W + 20) (o.x = W + 20), (o.vx = -abs(o.vx) * 0.3);
        for (let i = 0; i < n; i++) {
          const b = B[i]!;
          if (b.md !== HOME) continue;
          if (!hitBox(o.x, o.y, o.r, b.x + b.dx, b.y + b.dy, b.w, b.h, out)) continue;
          const nx = out[0]!, ny = out[1]!, vn = -(o.vx * nx + o.vy * ny);
          o.x += nx * out[2]!;
          o.y += ny * out[2]!;
          if (vn <= 0) continue;
          if (hit(i, o.x - nx * o.r, o.y - ny * o.r, nx, ny, vn, o.vx)) (o.vx *= 0.6), (o.vy *= 0.6);
          else (o.vx += nx * vn * 1.4), (o.vy += ny * vn * 1.4);
        }
      }
      if (pg.step(dt, ROAD)) busy = true;
      if (fx.step(dt, ROAD)) busy = true;
      if (say.step(dt)) busy = true;
      if (S.whistle > 0) (S.whistle -= dt), (busy = true);
      // Parked with a mess about: the whistle.
      if (S.mode === PARK && !S.autoBrake && S.auto <= 0) {
        let mess = 0;
        for (let i = 0; i < n; i++) if ((B[i]!.md === LOOSE && !B[i]!.wait) || B[i]!.crack) mess = 1;
        for (let j = 0; j < CAP; j++) if (K[j]!.st === 1) mess = 1;
        if (mess) {
          busy = true;
          if ((S.idle += dt) > 2.4) (S.idle = 0), tidy();
        }
      }
      if (busy) e.busy();
    },
    render() {
      pg.render();
      v.clear(0, 0);
      draw();
    },
  });

  function draw() {
    pip(g, 612, 268, S.whistle > 0);
    // Speed lines when he floors it.
    if (S.vx > 200) {
      g.strokeStyle = WHITE;
      g.lineWidth = 2.5;
      for (let k = 0; k < 5; k++) {
        const y = ROAD - 20 - k * 13 - S.y, x = S.x - 80 - ((S.now * 900 + k * 97) % 160);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 30 - k * 6, y);
        g.stroke();
      }
    }
    for (let j = 0; j < CAP; j++) {
      const o = K[j]!;
      if (o.st === 1 || o.st === 2) rock(g, o.x, o.y, o.r, o.a, o.seed);
    }
    drawCar();
    fx.draw(g);
    say.draw(g);
  }

  /** The tub car: a carved stone tub on two stone wheels, a leaf canopy on bone poles, Bonk at the
   *  front with a turtle-shell wheel, his feet through the floor, the rocks in the back. */
  function drawCar() {
    const x = S.x, y = ROAD - S.y, m = S.mode;
    // Shadow, wheels.
    g.beginPath();
    g.ellipse(x, ROAD - 1, 62 - min(30, S.y * 0.3), 3, 0, 0, PI * 2);
    g.fillStyle = "rgba(42,26,14,.25)";
    g.fill();
    for (let wx = -40; wx <= 40; wx += 80) {
      oval(g, x + wx, y - WR, WR, WR, STONE_D, 0, 2.6);
      oval(g, x + wx, y - WR, 5, 5, WOOD, 0, 2);
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = S.wheel + (k * PI * 2) / 3;
        g.moveTo(x + wx + cos(a) * 7, y - WR + sin(a) * 7);
        g.lineTo(x + wx + cos(a) * 12, y - WR + sin(a) * 12);
      }
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.stroke();
    }
    // Legs: running, planted in a skid, or resting.
    const hipX = x + 22, hipY = y - 40;
    for (let s = 0; s < 2; s++) {
      let fx0: number, fy: number;
      if (m === BRAKE && S.vx > 0) (fx0 = hipX + 18 + s * 6), (fy = y - 2);
      else if (m === DRIVE || m === FLOOR) {
        const ph = S.run + s * PI;
        fx0 = hipX + cos(ph) * 15;
        fy = y - 2 - max(0, sin(ph)) * 10;
      } else (fx0 = hipX - 4 + s * 10), (fy = y - 2);
      g.beginPath();
      g.moveTo(hipX + s * 4, hipY);
      g.lineTo((hipX + fx0) / 2 + 6, (hipY + fy) / 2 - 2);
      g.lineTo(fx0, fy - 4);
      limb(g, 5, SKIN);
      oval(g, fx0 + 4, fy - 3, 7, 4, SKIN, 0, 2);
    }
    if (m === FLOOR && S.vx > 220) for (let k = 0; k < 3; k++) oval(g, hipX - 10 + k * 10, y - 6, 12, 5, DUST, 0, 1.2);
    g.save();
    g.translate(x, y - 34);
    g.rotate((S.pitch * PI) / 180);
    // The load of rocks in the back.
    for (let j = 0; j < CAP; j++) if (!K[j]!.st) rock(g, -34 + (j % 4) * 7, -28 - (j % 2) * 6, K[j]!.r, j, K[j]!.seed);
    // Bone poles and the leaf canopy.
    g.beginPath();
    g.moveTo(-46, -8);
    g.lineTo(-44, -66);
    g.moveTo(42, -8);
    g.lineTo(40, -66);
    limb(g, 3, WHITE);
    g.beginPath();
    g.moveTo(-62, -62);
    g.quadraticCurveTo(-10, -86, 62, -64);
    g.quadraticCurveTo(0, -72, -62, -62);
    ink(g, LEAF);
    g.beginPath();
    for (let k = -50; k <= 50; k += 14) g.moveTo(k, -74 + abs(k) * 0.12), g.lineTo(k + 6, -66 + abs(k) * 0.05);
    g.strokeStyle = LEAF_D;
    g.lineWidth = 1.6;
    g.stroke();
    // Bonk, the wheel, the tub over his lap.
    bonk(g, 18, -30, S.whistle > 0 ? WHISTLE : m === BRAKE || m === FLOOR ? SHOUT : FACE, 14, 14, 20, 12, S.now);
    oval(g, 36, -14, 7, 9, LEAF, 0.5, 2);
    g.beginPath();
    g.moveTo(-60, -14);
    g.quadraticCurveTo(-62, 10, -40, 12);
    g.lineTo(46, 12);
    g.quadraticCurveTo(64, 10, 60, -14);
    g.lineTo(28, -14);
    g.quadraticCurveTo(22, 2, 6, 0);
    g.lineTo(-60, -14);
    ink(g, STONE, 2.6);
    g.beginPath();
    for (let k = -48; k < 48; k += 13) g.moveTo(k, -6 + (k & 3)), g.lineTo(k + 6, -2 + (k & 3));
    g.strokeStyle = STONE_D;
    g.lineWidth = 1.8;
    g.stroke();
    dot(g, 54, -8, 3.5, HAT);
    g.restore();
  }

  engine.start();
  return {
    engine,
    tap: (x, y) => (tap(x, y), engine.wake()),
    get speed() {
      return S.vx;
    },
    get loose() {
      let k = 0;
      for (let i = 0; i < n; i++) if (B[i]!.md !== HOME) k++;
      return k;
    },
    get flung() {
      return S.flung;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the intro skid, rocks in the air. */
export const posterAt = 1.75;

/** For `slot(fig, () => import("./stone-car-skids").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => car(stage, slot, first);
