// "Rock drop": the Rubbleton quarry, where Stretch, a long-neck crane dino in a hard hat, works the
// boulders with Bonk Cobbleworth riding on her back. The headline is a stack of real stone blocks
// (SOLID on the floor, ROCK on top of it). Click: Stretch swings her neck over the spot and drops
// the boulder from her sling. A boulder that lands on a block cracks it (KRAK!); a second hit, or a
// long fall, knocks it out (KA-CHUNK!) and whatever stood on it topples. Boulders bounce off the
// blocks and each other and roll. Click twice fast and she hauls the BIG one: it grows in the
// sling, she strains, and when it lands the page shakes, every block hops and the ones nearby
// come down. Leave the quarry be and Bonk blows his whistle: the boulders crumble, the blocks hop
// back into the stack, cracks and all mended. Tap Stretch for a honk.
// Bricks: the kernel (fixed step; settle: it sleeps once the stack is whole; its ledger for every
// page write, so Recall gives the page back byte for byte). The look, the bodies and the words are
// shared with the rest of the series (stone-age.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { DINO, DINO_D, DIZZY, FACE, HAT, HOME, INK, LEAF_D, LOOSE, SHOUT, SKY, TAU, W, WHISTLE, WHITE, bits, bodies, bonk, dot, hitBox, ink, limb, oval, rock, taps, view, words } from "./stone-age";

export type CraneScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly loose: number; readonly cracked: number; readonly drops: number };

const { abs, cos, sin, max, min, hypot, round } = Math;
const FLOOR = 318, G = 1100, CAP = 7, R = 15, BIG = 30, LEN = 30;
const SX = 118, SY = 226, RESTX = 210, RESTY = 112, PILEX = 168, PILEY = 268, HY = 98;
// Stretch's back and Bonk's head, as round things a boulder can land on.
const DX = 82, DY = 256, DR = 40, BX = 78, BY = 208, BR = 11;
// Stretch's jobs.
const HOLD = 0, CARRY = 1, FETCH = 2;
const WORDS = ["KRAK!", "KA-CHUNK!", "KA-THOOOM!", "TWEET!", "HONK!", "BONK!", "HEAVE!", "KLOK!"];

export function crane(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): CraneScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 81 });
  const rnd = engine.random, v = view(engine, stage), g = v.g;
  const wrap = slot.querySelector<HTMLElement>(".sq1")!, els = [...wrap.querySelectorAll<HTMLElement>("i")];
  const pg = bodies(engine, wrap, els), B = pg.B, n = pg.n;
  const fx = bits(rnd), say = words(WORDS);
  // What each block stands on (other blocks; the floor needs none): up to 3, -1 for none.
  const SUP = new Int16Array(n * 3).fill(-1), HIT = new Float32Array(n);
  // Boulders: position, velocity, radius, angle, seed, on (1 live), sleep counter.
  const K = Array.from({ length: CAP }, () => ({ x: 0, y: 0, vx: 0, vy: 0, r: R, a: 0, seed: 0, on: 0, still: 0, age: 0, boom: 0 }));
  // The scene: Stretch's head (x, y, velocity), its target, the sling's boulder (verlet: now and
  // before), its radius (grows to BIG), her job and its clock, the tap queue, timers.
  const S = {
    hx: RESTX, hy: RESTY, hvx: 0, hvy: 0, tx: RESTX, ty: RESTY, bx: RESTX + 14, by: RESTY + 53, th: 0, om: 0, br: R, big: 0, loaded: 1,
    job: HOLD, t: 0, last: -9, now: 0, idle: 0, auto: first ? 0 : 0.7, autos: first ? 0 : 2, shake: 0, stop: 0, honk: 0, whistle: 0, pull: 0, dizzy: 0, drops: 0, seeds: 1, fit: 1,
  };
  const Q = new Float32Array(3);
  let qn = 0;
  const out = new Float64Array(3);

  const tap = (x: number, y: number) => {
    S.idle = 0;
    if (x < 150 && y > 150) return void ((S.honk = 0.6), say.say(4, S.hx + 10, S.hy - 30, 22, -0.1));
    // A second tap while she's still carrying the last one: the BIG one.
    if ((S.job === CARRY || qn) && S.now - S.last < 0.32 && !S.big) return void ((S.big = 1), say.say(6, S.hx, S.hy - 34, 20, 0.1));
    S.last = S.now;
    if (qn < 3) Q[qn++] = max(150, min(W - 24, x));
  };
  taps(engine, stage, first, tap);

  /** Which blocks hold each block up (measured once per layout). */
  function supports() {
    SUP.fill(-1);
    for (let i = 0; i < n; i++) {
      const a = B[i]!;
      for (let j = 0, k = 0; j < n && k < 3; j++) {
        const b = B[j]!;
        if (j !== i && abs(b.y - (a.y + a.h)) < 6 && min(a.x + a.w, b.x + b.w) - max(a.x, b.x) > 6) SUP[i * 3 + k++] = j;
      }
    }
  }

  function wakeAll() {
    for (let k = 0; k < CAP; k++) K[k]!.still = 0;
  }

  /** A home block takes a hit of speed `vn` along (nx, ny) at (x, y); true when it's knocked out. */
  function hit(i: number, x: number, y: number, nx: number, ny: number, vn: number, vx: number, big: boolean) {
    const b = B[i]!;
    // A crack needs a moment before the next hit can knock the block out (one blow, one crack).
    if (S.now - HIT[i]! < 0.3 && !big) return false;
    HIT[i] = S.now;
    if (big || vn > 640 || (b.crack && vn > 200)) {
      b.crack = 2;
      pg.loosen(i, vx * 0.45 - nx * vn * 0.25, -120 - vn * 0.2, (rnd() - 0.5) * 520);
      fx.chips(x, y, 7, 120);
      fx.puff(x, y, 5, 50);
      say.say(1, x, y - 26, 22, (rnd() - 0.5) * 0.3);
      S.stop = 0.06;
      S.shake = max(S.shake, 0.12);
      wakeAll();
      return true;
    }
    if (vn > 130) {
      b.crack = 1;
      pg.kick(i, -nx * vn * 0.25, -ny * vn * 0.25, (rnd() - 0.5) * vn * 0.4);
      fx.chips(x, y, 4, 80);
      say.say(0, x, y - 22, 18, (rnd() - 0.5) * 0.3);
      S.stop = 0.035;
    }
    return false;
  }

  /** The BIG one lands: shake, every block hops, the ones near come down. */
  function thoom(x: number) {
    S.shake = 0.5;
    S.stop = 0.08;
    say.say(2, x, 150, 34, -0.06);
    fx.puff(x, FLOOR, 12, 140, 11);
    fx.chips(x, FLOOR - 4, 10, 160);
    for (let i = 0; i < n; i++) {
      const b = B[i]!, d = abs(b.x + b.w / 2 - x);
      if (b.md !== HOME) continue;
      if (d < 70 && b.y + b.h > FLOOR - 4) pg.loosen(i, (b.x + b.w / 2 - x) * 4, -260, (rnd() - 0.5) * 600), (b.crack = 2);
      else pg.kick(i, 0, -260 * max(0.3, 1 - d / 500), (rnd() - 0.5) * 140);
    }
    wakeAll();
  }

  /** Bonk's whistle: the boulders crumble, every block comes home, bottom row first. */
  function rebuild() {
    S.whistle = 1.4;
    say.say(3, 70, 160, 22, -0.1);
    for (let k = 0; k < CAP; k++) {
      const o = K[k]!;
      if (!o.on) continue;
      o.on = 0;
      fx.chips(o.x, o.y, 6, 90);
      fx.puff(o.x, o.y + o.r * 0.5, 4, 40, o.r * 0.5);
    }
    for (let i = 0; i < n; i++) {
      const b = B[i]!;
      if (b.md === LOOSE) pg.home(i, 0.35 + (FLOOR - b.y - b.h) * 0.005 + b.x * 0.0012);
      else if (b.crack) (b.crack = 0), pg.kick(i, 0, -70, 0);
    }
  }

  /** Let the sling's boulder go: it keeps the swing's speed. */
  function drop() {
    // A free boulder, or else the oldest one, which crumbles to make room.
    let k = 0;
    for (let a = 0; a < CAP; a++) {
      if (!K[a]!.on) {
        k = a;
        break;
      }
      if (K[a]!.age < K[k]!.age) k = a;
    }
    const o = K[k]!;
    if (o.on) fx.chips(o.x, o.y, 6, 90), fx.puff(o.x, o.y, 3, 30); // the oldest crumbles to make room
    o.on = 1;
    o.x = S.bx;
    o.y = S.by;
    o.vx = S.hvx * 0.5 + cos(S.th) * S.om * (LEN + S.br) * 0.4;
    o.vy = 0;
    o.r = S.br;
    o.a = 0;
    o.still = 0;
    o.age = S.now;
    o.boom = 0;
    o.seed = S.seeds++;
    S.loaded = 0;
    S.pull = 0.35;
    S.drops++;
  }

  engine.add({
    read() {
      if (!v.fit()) return;
      pg.measure();
      supports();
    },
    step(e, dt) {
      let busy = false;
      S.now += dt;
      if (S.autos > 0) {
        busy = true;
        if ((S.auto -= dt) <= 0) {
          const r = B[5]!; // the R of ROCK: a crack, then the second one knocks it out
          tap(r.x + r.w / 2 + 2, 100);
          S.autos--;
          S.auto = 1.7;
        }
      }
      // Hit-stop: the world holds still for a beat on a big hit (the words keep going).
      if (S.stop > 0) {
        S.stop -= dt;
        say.step(dt);
        return e.busy();
      }
      // Stretch's head: a springy chase of its target; the sling swings under it.
      const big = S.big ? 1 : 0;
      if (S.job === HOLD && qn) {
        S.job = CARRY;
        S.t = 0;
        S.tx = Q[0]! - 14;
        S.ty = HY;
        Q[0] = Q[1]!;
        Q[1] = Q[2]!;
        qn--;
      }
      S.t += dt;
      if (S.job !== HOLD) busy = true;
      const ty = S.ty + big * 22;
      const ax = ((S.tx - S.hx) * 55 - S.hvx * 12) * dt;
      S.hvx += ax;
      S.hvy += ((ty - S.hy) * 55 - S.hvy * 12) * dt;
      S.hx += S.hvx * dt;
      S.hy += S.hvy * dt;
      if (abs(S.hvx) + abs(S.hvy) > 2 || abs(S.tx - S.hx) + abs(ty - S.hy) > 0.5) busy = true;
      if (S.big && S.br < BIG) (S.br = min(BIG, S.br + 90 * dt)), (busy = true);
      if (S.job === CARRY && S.t > 0.38 && abs(S.tx - S.hx) < 8 && abs(S.hvx) < 60 && (abs(S.th) < 0.1 || S.t > 1.1)) drop(), (S.job = FETCH), (S.t = 0), (S.tx = PILEX), (S.ty = PILEY);
      else if (S.job === FETCH && (S.t > 0.5 || hypot(S.hx - PILEX, S.hy - PILEY) < 10)) {
        S.loaded = 1;
        S.big = 0;
        S.br = R;
        S.th = S.om = 0;
        S.job = HOLD;
        S.tx = RESTX;
        S.ty = RESTY;
        if (!qn) fx.puff(PILEX + 14, FLOOR - 4, 3, 30, 8);
      }
      if (S.loaded) {
        // A pendulum on its vine from Stretch's mouth, swung by her head's acceleration.
        const l = LEN + S.br;
        S.om += (-(G / l) * sin(S.th) - (ax / dt / l) * cos(S.th) - 3.5 * S.om) * dt;
        S.th = max(-1.1, min(1.1, S.th + S.om * dt));
        S.bx = S.hx + 14 + sin(S.th) * l;
        S.by = S.hy + 8 + cos(S.th) * l;
        if (abs(S.om) > 0.05 || abs(S.th) > 0.01) busy = true;
      }

      // The boulders.
      for (let k = 0; k < CAP; k++) {
        const o = K[k]!;
        if (!o.on || o.still > 20) continue;
        busy = true;
        o.vy += G * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.a += (o.vx / o.r) * dt;
        let ground = 0;
        if (o.y + o.r > FLOOR) {
          o.y = FLOOR - o.r;
          if (o.vy > 0) {
            if (o.vy > 280 && o.r >= BIG && !o.boom) (o.boom = 1), thoom(o.x);
            else if (o.vy > 160) fx.puff(o.x, FLOOR, 4, 40 + o.vy * 0.05, 6);
            o.vy = o.vy > 80 ? -o.vy * 0.32 : 0;
          }
          o.vx *= 1 - min(1, 2.2 * dt);
          ground = 1;
        }
        if (o.x < o.r || o.x > W - o.r) (o.x = o.x < o.r ? o.r : W - o.r), (o.vx = -o.vx * 0.5);
        // The stack (a block knocked out is rubble on the floor; the boulders roll past it).
        for (let i = 0; i < n; i++) {
          const b = B[i]!;
          if (b.md !== HOME || !hitBox(o.x, o.y, o.r, b.x + b.dx, b.y + b.dy, b.w, b.h, out)) continue;
          const nx = out[0]!, ny = out[1]!, vn = -(o.vx * nx + o.vy * ny);
          o.x += nx * out[2]!;
          o.y += ny * out[2]!;
          if (ny < -0.5) ground = 1;
          if (vn <= 0) continue;
          // Knocked out: the boulder ploughs on through; otherwise it bounces off.
          if (o.r >= BIG && vn > 250 && !o.boom) (o.boom = 1), thoom(o.x);
          if (hit(i, o.x - nx * o.r, o.y - ny * o.r, nx, ny, vn, o.vx, o.r >= BIG)) {
            o.vx *= 0.7;
            o.vy *= 0.5;
            continue;
          }
          o.vx += nx * vn * 1.4;
          o.vy += ny * vn * 1.4;
          o.vx *= 0.92;
        }
        // Stretch's back (a bounce) and Bonk's head (BONK!).
        for (let c = 0; c < 2; c++) {
          const cx = c ? BX : DX, cy = c ? BY : DY, dx = o.x - cx, dy = o.y - cy, d = hypot(dx, dy), m = o.r + (c ? BR : DR);
          if (d >= m || d < 0.01) continue;
          const nx = dx / d, ny = dy / d, vn = -(o.vx * nx + o.vy * ny);
          o.x += nx * (m - d);
          o.y += ny * (m - d);
          if (vn <= 0) continue;
          o.vx += nx * vn * 1.5;
          o.vy += ny * vn * 1.5;
          if (c && vn > 120 && S.dizzy <= 0) (S.dizzy = 1.8), say.say(5, BX, BY - 30, 22, -0.15), fx.chips(o.x - nx * o.r, o.y - ny * o.r, 3, 60);
          else if (!c && vn > 150) (S.honk = 0.5), say.say(4, S.hx + 10, S.hy - 30, 18, 0.1);
        }
        // Each other.
        for (let j = 0; j < CAP; j++) {
          const p = K[j]!;
          if (j === k || !p.on) continue;
          const dx = o.x - p.x, dy = o.y - p.y, d = hypot(dx, dy), m = o.r + p.r;
          if (d >= m || d < 0.01) continue;
          const nx = dx / d, ny = dy / d, push = (m - d) / 2;
          o.x += nx * push;
          o.y += ny * push;
          p.x -= nx * push;
          p.y -= ny * push;
          const vn = (p.vx - o.vx) * nx + (p.vy - o.vy) * ny;
          if (ny < -0.4) ground = 1;
          if (vn <= 0) continue;
          if (vn > 260) say.say(7, (o.x + p.x) / 2, min(o.y, p.y) - 24, 16, 0.2), fx.chips(o.x - nx * o.r, o.y - ny * o.r, 3, 60);
          const im = vn * 0.65, wo = p.r * p.r / (o.r * o.r + p.r * p.r);
          o.vx += nx * im * 2 * wo;
          o.vy += ny * im * 2 * wo;
          p.vx -= nx * im * 2 * (1 - wo);
          p.vy -= ny * im * 2 * (1 - wo);
          p.still = 0;
        }
        if (o.y > FLOOR - o.r) (o.y = FLOOR - o.r), (ground = 1);
        if (ground && abs(o.vx) < 10 && abs(o.vy) < 40) (o.vx *= 0.8), o.still++;
        else o.still = 0;
        if (o.still > 20) (o.vx = o.vy = 0);
      }

      // The stack: a block with nothing left under it comes down.
      for (let i = 0; i < n; i++) {
        if (B[i]!.md !== HOME || SUP[i * 3]! < 0) continue;
        let held = 0;
        for (let k = 0; k < 3; k++) {
          const j = SUP[i * 3 + k]!;
          if (j >= 0 && B[j]!.md === HOME) held = 1;
        }
        if (!held) pg.loosen(i, (rnd() - 0.5) * 60, -30, (rnd() - 0.5) * 200), wakeAll();
      }
      if (pg.step(dt, FLOOR)) busy = true;
      if (fx.step(dt, FLOOR)) busy = true;
      if (say.step(dt)) busy = true;
      if (S.shake > 0) (S.shake -= dt), (busy = true);
      if (S.honk > 0) (S.honk -= dt), (busy = true);
      if (S.whistle > 0) (S.whistle -= dt), (busy = true);
      if (S.pull > 0) (S.pull -= dt), (busy = true);
      if (S.dizzy > 0) (S.dizzy -= dt), (busy = true);
      // Left alone, the quarry tidies up: Bonk's whistle.
      if (S.job === HOLD && !qn && !S.autos) {
        let mess = 0;
        for (let i = 0; i < n; i++) if (B[i]!.md === LOOSE && !B[i]!.wait || B[i]!.crack) mess = 1;
        for (let k = 0; k < CAP; k++) if (K[k]!.on) mess = 1;
        if (mess) {
          busy = true;
          if ((S.idle += dt) > 2.6) (S.idle = 0), rebuild();
        }
      }
      if (busy) e.busy();
    },
    render() {
      pg.render();
      const sk = S.shake > 0 ? S.shake * 14 : 0, sx = sk ? (S.now * 60) & 1 ? sk : -sk : 0, sy = sk ? ((S.now * 45) & 1 ? 1 : -1) * sk * 0.5 : 0;
      v.clear(round(sx), round(sy));
      draw();
    },
  });

  function loose() {
    let k = 0;
    for (let i = 0; i < n; i++) if (B[i]!.md !== HOME) k++;
    return k;
  }

  function draw() {
    // Stretch's body, tail, legs and the rock pile are the stage's own drawing (an SVG under this
    // canvas); here: Bonk, her neck and head, the sling.
    const strain = S.big && S.loaded ? sin(S.now * 50) * 1.2 : 0, honk = S.honk > 0 ? sin(S.honk * 30) * 3 : 0;
    rider(78 + strain, 222);
    // The neck: one fat curve from the shoulders up and over to the head.
    const hx = S.hx, hy = S.hy + honk, cx = SX + (hx - SX) * 0.15, cy = min(hy, SY) - 70 - abs(hx - SX) * 0.12;
    g.beginPath();
    g.moveTo(SX - 10, SY + 12);
    g.quadraticCurveTo(cx, cy, hx - 8, hy + 2);
    limb(g, 19, DINO);
    for (let t = 0.3; t < 0.95; t += 0.2) {
      const u = 1 - t, x = u * u * (SX - 10) + 2 * u * t * cx + t * t * (hx - 8), y = u * u * (SY + 12) + 2 * u * t * cy + t * t * (hy + 2);
      dot(g, x, y - 3, 3, DINO_D);
    }
    // The vine and the sling's boulder.
    const mx = hx + 14, my = hy + 8;
    if (S.loaded) {
      g.beginPath();
      g.moveTo(mx, my);
      g.lineTo(S.bx, S.by - S.br + 2);
      g.lineWidth = 2.4;
      g.strokeStyle = LEAF_D;
      g.stroke();
      rock(g, S.bx, S.by, S.br, (S.bx - mx) * 0.02, 0);
      g.beginPath();
      g.moveTo(S.bx - S.br * 0.7, S.by - S.br * 0.5);
      g.quadraticCurveTo(S.bx, S.by - S.br * 0.1, S.bx + S.br * 0.7, S.by - S.br * 0.5);
      g.lineWidth = 2.5;
      g.strokeStyle = LEAF_D;
      g.stroke();
      if (S.big) for (let s = 0; s < 2; s++) dot(g, hx - 6 + s * 22, hy - 16 + ((S.now * 40 + s * 7) % 12), 2, SKY);
    }
    // The head: hard hat, an eye on the job, a mouth on the vine.
    oval(g, hx + 2, hy + 1, 21, 12, DINO, 0.08);
    oval(g, hx + 13, hy + 6, 7, 3.5, DINO_D, 0.1, 1.6);
    g.beginPath();
    g.ellipse(hx - 1, hy - 8, 14, 9, 0, Math.PI, 0);
    g.closePath();
    ink(g, HAT);
    g.beginPath();
    g.roundRect(hx - 19, hy - 9, 34, 4, 2);
    ink(g, HAT, 2);
    const lx = S.loaded ? S.bx - hx : 40, ly = S.loaded ? S.by - hy : 40, ll = hypot(lx, ly) || 1;
    oval(g, hx + 3, hy - 1, 5.5, S.big && S.loaded ? 2.5 : 5.5, WHITE, 0, 1.8);
    if (!(S.big && S.loaded)) dot(g, hx + 3 + (lx / ll) * 2.5, hy - 1 + (ly / ll) * 2.5, 2.4, INK);
    dot(g, hx + 19, hy - 1, 1.4, INK);
    // Dust, chips, the boulders, words.
    for (let k = 0; k < CAP; k++) {
      const o = K[k]!;
      if (!o.on) continue;
      g.beginPath();
      g.ellipse(o.x, FLOOR - 1, o.r * max(0.2, 1 - (FLOOR - o.y) / 300), 2.5, 0, 0, TAU);
      g.fillStyle = "rgba(42,26,14,.25)";
      g.fill();
      rock(g, o.x, o.y, o.r, o.a, o.seed);
    }
    fx.draw(g);
    say.draw(g);
  }

  /** Bonk in his seat, a bone lever he yanks on a drop. */
  function rider(x: number, y: number) {
    const lx = S.pull > 0 ? 12 : 22;
    g.beginPath();
    g.moveTo(x + 14, y + 18);
    g.lineTo(x + lx, y - 4);
    limb(g, 3, WHITE);
    oval(g, x + lx, y - 4, 4, 3, WHITE, 0, 1.6);
    bonk(g, x, y + 2, S.dizzy > 0 ? DIZZY : S.whistle > 0 ? WHISTLE : S.pull > 0 ? SHOUT : FACE, -6, 16, lx - 2, -2, S.now);
  }

  engine.start();
  return {
    engine,
    tap: (x, y) => (tap(x, y), engine.wake()),
    get loose() {
      return loose();
    },
    get cracked() {
      let k = 0;
      for (let i = 0; i < n; i++) if (B[i]!.crack) k++;
      return k;
    },
    get drops() {
      return S.drops;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the second intro boulder in the air
 *  over ROCK, Stretch's neck out over the stack (scripts/gallery-posters.mjs draws it). */
export const posterAt = 2.75;

/** For `slot(fig, () => import("./dino-crane-drops-boulders").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => crane(stage, slot, first);
