// Pip's Bubbles: Pip, the keeper of Fizlet (a pixel narwhal, an AI agent persona), makes its debut
// under a real page: the Keeper's Log. It swims in and blows fizz. Tap Pip: one tap is a small fast
// bubble, a second tap puffs it into a big slow one. Bubbles rise and bounce off the page's own
// letters, words and button; every one they hit pops (it jumps and fizzes), then settles back. Tap
// a bubble: it pops in a fizz burst, or, if it's a big one Pip can reach, Pip dashes at it tusk
// first and pokes it into a spray of small ones. Tap anywhere else: Pip dashes there, tusk first.
// Pop enough and Pip does a happy spin. Then every bubble is gone, every letter is home, and the
// scene settles to 0 fps: the page is given back.
// Bricks: the kernel (fixed step, seeded random, settle, the ledger for every page write: Recall
// gives the page back byte for byte). Pip is baked here from the avatar's pixels (pip.ts): four small
// tiles cost less than the sprite brick. letters.ts moves the real elements; pix.ts is the art grid,
// the fizz bits and the caption font.
import { createEngine } from "../../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { W, H, C, artCanvas, offscreen, bits, print, textW } from "../pix";
import { letters, TX, TY, ROT, STRETCH } from "../letters";
import { FRAMES, COLORS, TIP_X, TIP_Y, HOLE_X, HOLE_Y, BOX_W, BOX_H } from "./pip";

export type BubblesScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  tap(x: number, y: number): void;
  readonly mode: number;
  readonly x: number;
  readonly y: number;
  readonly bubbles: number;
  readonly big: number;
  readonly pops: number;
  readonly spins: number;
  /** Bubble k: x, y, radius (art px). */
  at(k: number): number[];
};

const { abs, max, min, round, sin, cos, sqrt, PI } = Math;
/** Pip's modes. */
export const IDLE = 0, ENTER = 1, DASH = 2, HOME = 3, SPIN = 4;
const HX = 50, HY = 72, CAP = 36, SMALL = 3, BIG = 8, POP_AT = 16, TOP = 2;
const WORDS = ["PUFF!", "POKE!", "WHEE!", "0 FPS"];

export function bubbles(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BubblesScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 1e9) | 0 });
  const rnd = engine.random;
  const g = artCanvas(engine, stage, true);
  // Pip's four frames, baked once into tiles (whole pixels).
  const PIPS = FRAMES.map((f) => {
    const c = offscreen(32, 24);
    for (let j = 0; j < 24; j++) for (let i = 0; i < 32; i++) if (COLORS[f[j]![i]!]) (c.fillStyle = COLORS[f[j]![i]!]!), c.fillRect(i, j, 1, 1);
    return c.canvas;
  });
  const lt = letters(engine, slot.querySelector<HTMLElement>(".pb")!, "i");
  const n = lt.n, CD = new Float32Array(n);
  const fizz = bits(220, [C.sys, C.cmd, C.ink, "#a8ff3e"]);
  // Bubbles: position, velocity, radius (now and target), age, life, hits, squash and its speed.
  const BX = new Float32Array(CAP), BY = new Float32Array(CAP), VX = new Float32Array(CAP), VY = new Float32Array(CAP);
  const R = new Float32Array(CAP), RT = new Float32Array(CAP), AGE = new Float32Array(CAP), LIFE = new Float32Array(CAP), HIT = new Uint8Array(CAP);
  const SQ = new Float32Array(CAP), SV = new Float32Array(CAP);
  // Pops in flight: a ring that flashes out (x, y, r, t).
  const PX = new Float32Array(16), PY = new Float32Array(16), PR = new Float32Array(16), PT = new Float32Array(16);
  // A bubble per radius, baked once: a soap ring (cyan, violet underneath), a shine, a dark rim for light pages.
  const TILE: (HTMLCanvasElement | undefined)[] = [];
  const tile = (r: number) => {
    let t = TILE[r];
    if (t) return t;
    const s = r * 2 + 5, c = s / 2 - 0.5, x = offscreen(s, s);
    for (let j = 0; j < s; j++)
      for (let i = 0; i < s; i++) {
        const d = sqrt((i - c) ** 2 + (j - c) ** 2), e = d - r;
        if (abs(e) < 0.55) x.fillStyle = i - j > r * 0.8 || j - c > r * 0.55 ? C.cmd : C.sys;
        else if (e >= 0.55 && e < 1.55) x.fillStyle = "rgba(7,6,15,.5)";
        else if (e < -0.45) x.fillStyle = "rgba(25,240,255,.08)";
        else continue;
        x.fillRect(i, j, 1, 1);
      }
    x.fillStyle = C.ink;
    const h = round(r * 0.5);
    x.fillRect(round(c - h), round(c - h - 1), max(1, h >> 1), 1);
    x.fillRect(round(c - h - 1), round(c - h), 1, max(1, h >> 1));
    return (TILE[r] = x.canvas);
  };

  let kn = 0, np = 0;
  let mode = first ? IDLE : ENTER, t = 0, x = first ? HX : -24, y = HY, face = 1, x0 = 0, y0 = 0, tx = 0, ty = 0;
  let sq = 0, sv = 0, spin = 0, happy = 0, pops = 0, spins = 0, shk = 0;
  let word = -1, wt = 9, wx = 0, wy = 0;
  let last = -1, lastAt = -9, now = 0, auto = first ? -1 : 0, cue = 0;
  let qx = 0, qy = 0, q = 0, dirty = 1;
  if (!first) engine.busy(4.2); // the intro's beats are scheduled: hold the engine for them

  const tap = (ax: number, ay: number) => ((qx = ax), (qy = ay), (q = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const say = (w: number, ax: number, ay: number) => ((word = w), (wt = 0), (wx = ax), (wy = ay));
  const to = (m: number) => ((mode = m), (t = 0));

  /** A new bubble from Pip's blowhole. */
  function blow() {
    if (kn >= CAP) return;
    const k = kn++;
    BX[k] = x + HOLE_X * face;
    BY[k] = y + HOLE_Y;
    VX[k] = (rnd() - 0.5) * 16 + face * 6;
    VY[k] = -95;
    R[k] = 1;
    RT[k] = SMALL;
    AGE[k] = 0;
    LIFE[k] = 2.4 + rnd();
    HIT[k] = 0;
    SQ[k] = 0.4;
    SV[k] = 0;
    sq = -0.22; // a puff of the cheeks
    last = k;
    lastAt = now;
  }
  /** The second tap: the bubble Pip just blew puffs up into a big slow one. */
  function puff(k: number) {
    RT[k] = BIG;
    VY[k] = -16;
    VX[k] = VX[k]! * 0.3;
    LIFE[k] = 5.5;
    SQ[k] = -0.35;
    sq = -0.35;
    happy = 0.4;
    say(0, BX[k]!, BY[k]! - 18);
    last = -1;
  }
  function spawn(ax: number, ay: number, vx: number, vy: number) {
    if (kn >= CAP) return;
    const k = kn++;
    BX[k] = ax;
    BY[k] = ay;
    VX[k] = vx;
    VY[k] = vy;
    R[k] = RT[k] = 2 + (rnd() * 2) | 0;
    AGE[k] = 0.3;
    LIFE[k] = 1.6 + rnd();
    HIT[k] = 0;
    SQ[k] = SV[k] = 0;
  }
  /** Bubble k pops: a ring flashes, fizz flies. */
  function pop(k: number) {
    const r = R[k]!, ax = BX[k]!, ay = BY[k]!;
    const m = np < 16 ? np++ : 15;
    (PX[m] = ax), (PY[m] = ay), (PR[m] = r), (PT[m] = 0);
    for (let i = 0, c = 6 + r * 2; i < c; i++) {
      const a = (i / c) * PI * 2 + rnd() * 0.4, s = 20 + r * 6 + rnd() * 25;
      fizz.spawn(ax + cos(a) * r, ay + sin(a) * r, cos(a) * s, sin(a) * s - 10, 0.25 + rnd() * 0.35, rnd() < 0.3 ? 2 : 1, i & 3);
    }
    if (last === k) last = -1;
    else if (last === kn - 1) last = k;
    kn--;
    (BX[k] = BX[kn]!), (BY[k] = BY[kn]!), (VX[k] = VX[kn]!), (VY[k] = VY[kn]!), (R[k] = R[kn]!), (RT[k] = RT[kn]!);
    (AGE[k] = AGE[kn]!), (LIFE[k] = LIFE[kn]!), (HIT[k] = HIT[kn]!), (SQ[k] = SQ[kn]!), (SV[k] = SV[kn]!);
  }
  /** The tusk pokes bubble k: a big one bursts into a spray of small ones, a small one just pops. */
  function poke(k: number) {
    if (RT[k]! >= 6) {
      const ax = BX[k]!, ay = BY[k]!;
      say(1, ax, ay - 16);
      shk = 0.2;
      for (let i = 0; i < 8; i++) {
        const a = -PI / 2 + (i / 7 - 0.5) * 2.6 + (rnd() - 0.5) * 0.3, s = 60 + rnd() * 50;
        spawn(ax + cos(a) * 5, ay + sin(a) * 5, cos(a) * s, sin(a) * s);
      }
    }
    pop(k);
  }
  /** Letter i is hit (by a bubble or the tusk): it jumps, turns, flashes and fizzes. */
  function hitLetter(i: number, vx: number, vy: number) {
    if (CD[i]! > 0) return;
    CD[i] = 0.35;
    lt.kick(i, TY, -90 + vy * 0.6, 0.45);
    lt.kick(i, TX, vx * 0.5);
    lt.kick(i, ROT, (rnd() - 0.5) * 220 + vx * 0.8);
    lt.kick(i, STRETCH, 45);
    for (let j = 0; j < 7; j++) fizz.spawn(lt.x[i]! + (rnd() - 0.5) * lt.w[i]!, lt.y[i]! - lt.h[i]! * 0.3 * rnd(), (rnd() - 0.5) * 30, -20 - rnd() * 40, 0.4 + rnd() * 0.4, 1, j & 3);
    if (++pops >= POP_AT && mode !== SPIN) (pops = 0), to(SPIN), (x0 = x), (y0 = y), spins++, say(2, x, y - 46);
  }
  /** Pip dashes so its tusk tip reaches (ax, ay) (as near as the water lets it). */
  function dash(ax: number, ay: number) {
    face = ax < x ? -1 : 1;
    x0 = x;
    y0 = y;
    tx = max(16, min(W - 16, ax - TIP_X * face));
    ty = max(50, min(76, ay - TIP_Y));
    sq = 0.25;
    to(DASH);
  }

  function input() {
    q = 0;
    auto = -1;
    // A bubble under the finger pops (the nearest, a little forgiving).
    let b = -1, bd = 1e9;
    for (let k = 0; k < kn; k++) {
      const d = (BX[k]! - qx) ** 2 + (BY[k]! - qy) ** 2;
      if (d < (R[k]! + 4) ** 2 && d < bd) (bd = d), (b = k);
    }
    // A big one in reach gets Pip's tusk; any other pops where it is.
    if (b >= 0) return RT[b]! >= 6 && BY[b]! > 34 && mode !== SPIN ? dash(BX[b]!, BY[b]!) : pop(b);
    if (abs(qx - x) <= BOX_W + 2 && abs(qy - y) <= BOX_H + 3 && mode !== SPIN) {
      // On Pip: a bubble; a second tap while it's fresh puffs it up.
      if (last >= 0 && now - lastAt < 0.34 && RT[last]! < 6) return puff(last);
      return blow();
    }
    if (mode !== SPIN) dash(qx, qy);
  }

  engine.add({
    read() {
      lt.read();
    },
    step(e, dt) {
      now += dt;
      t += dt;
      // The intro: a small bubble, a big one, then the tusk.
      if (auto >= 0 && mode !== ENTER) {
        auto += dt;
        if (cue === 0 && auto > 0.25) cue++, blow();
        else if (cue === 1 && auto > 1.05) cue++, blow();
        else if (cue === 2 && auto > 1.2) {
          cue++;
          if (last >= 0) puff(last);
        } else if (cue === 3 && auto > 2.6) {
          cue++;
          let b = -1;
          for (let k = 0; k < kn; k++) if (RT[k]! >= 6) b = k;
          if (b >= 0) dash(BX[b]!, BY[b]! + R[b]! - 2);
          auto = -1;
        }
      }
      if (q) input();

      // Pip.
      if (mode === ENTER) {
        const u = min(1, t / 1.1), e2 = 1 - (1 - u) ** 3;
        x = -24 + (HX + 24) * e2;
        y = HY + sin(u * PI * 2) * 3 * (1 - u);
        if (u >= 1) to(IDLE);
      } else if (mode === DASH) {
        const u = min(1, t / 0.24), e2 = 1 - (1 - u) * (1 - u);
        x = x0 + (tx - x0) * e2;
        y = y0 + (ty - y0) * e2;
        if (u < 1) fizz.spawn(x - face * 14, y + (rnd() - 0.5) * 8, -face * 25, -15, 0.35, 1, 0); // a wake
        if (t > 0.5) (x0 = x), (y0 = y), to(HOME);
      } else if (mode === HOME) {
        const u = min(1, t / 0.8), e2 = u * u * (3 - 2 * u);
        x = x0 + (HX - x0) * e2;
        y = y0 + (HY - y0) * e2 - sin(u * PI) * 4;
        if (u >= 1) (face = 1), to(IDLE);
      } else if (mode === SPIN) {
        // A happy spin: up, round once, a little shower of fizz, back down.
        const u = min(1, t / 1.1);
        spin = u < 0.85 ? (u / 0.85) ** 1.4 * PI * 2 : 0;
        y = y0 - sin(u * PI) * 16;
        happy = 0.6;
        if (rnd() < 0.5) fizz.spawn(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 14, (rnd() - 0.5) * 50, -30 - rnd() * 40, 0.6, 1 + (rnd() * 2) | 0, (rnd() * 4) | 0);
        if (u >= 1) (spin = 0), (x0 = x), (y0 = y), to(HOME), say(3, 116, 54);
      }
      // Pip's body bonks what it reaches; the tusk tip pokes bubbles and pops letters.
      const fx = x + TIP_X * face, fy = y + TIP_Y;
      if (mode === DASH || mode === SPIN) {
        for (let i = 0; i < n; i++) {
          if (abs(lt.x[i]! - x) < lt.w[i]! / 2 + BOX_W && abs(lt.y[i]! - y) < lt.h[i]! / 2 + BOX_H) hitLetter(i, face * 60, -60);
          if (abs(lt.x[i]! - fx) < lt.w[i]! / 2 + 1 && abs(lt.y[i]! - fy) < lt.h[i]! / 2 + 1) hitLetter(i, face * 80, -40);
        }
      }
      if (mode !== SPIN) for (let k = kn - 1; k >= 0; k--) if (AGE[k]! > 0.25 && (BX[k]! - fx) ** 2 + (BY[k]! - fy) ** 2 < (R[k]! + 3) ** 2) poke(k);
      let busy = mode !== IDLE;
      sv += (-260 * sq - 14 * sv) * dt;
      sq += sv * dt;
      if (abs(sq) < 0.004 && abs(sv) < 0.05) sq = sv = 0;
      else busy = true;
      if (happy > 0) (happy -= dt), (busy = true);

      // Bubbles: buoyancy, a wobble, drag; they bounce off walls, the page's elements and each other.
      for (let k = kn - 1; k >= 0; k--) {
        const big = RT[k]! >= 6, rise = big ? -18 : -70;
        AGE[k] = AGE[k]! + dt;
        R[k] = R[k]! + (RT[k]! - R[k]!) * min(1, dt * (big ? 9 : 20));
        VY[k] = VY[k]! + (rise - VY[k]!) * dt * (big ? 1.6 : 2.4);
        VX[k] = VX[k]! * (1 - dt * 1.2) + sin(AGE[k]! * (big ? 3 : 8) + k) * (big ? 6 : 22) * dt;
        BX[k] = BX[k]! + VX[k]! * dt;
        BY[k] = BY[k]! + VY[k]! * dt;
        SV[k] = SV[k]! + (-300 * SQ[k]! - 10 * SV[k]!) * dt;
        SQ[k] = SQ[k]! + SV[k]! * dt;
        const r = R[k]!;
        if (BX[k]! < r) (BX[k] = r), (VX[k] = abs(VX[k]!) * 0.7);
        if (BX[k]! > W - r) (BX[k] = W - r), (VX[k] = -abs(VX[k]!) * 0.7);
        for (let i = 0; i < n; i++) {
          // Circle against the element's box: the nearest point, pushed out along the normal.
          const hw = lt.w[i]! / 2, hh = lt.h[i]! / 2, cx = max(lt.x[i]! - hw, min(lt.x[i]! + hw, BX[k]!)), cy = max(lt.y[i]! - hh, min(lt.y[i]! + hh, BY[k]!));
          let dx = BX[k]! - cx, dy = BY[k]! - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          const d = sqrt(d2);
          if (d < 0.01) (dx = 0), (dy = 1);
          else (dx /= d), (dy /= d);
          BX[k] = BX[k]! + dx * (r - d);
          BY[k] = BY[k]! + dy * (r - d);
          // Pressed up under something, a bubble slips sideways off it, as real ones do.
          if (dy > 0.6) VX[k] = VX[k]! + (BX[k]! < lt.x[i]! ? -90 : 90) * dt;
          const vn = VX[k]! * dx + VY[k]! * dy;
          if (vn >= 0) continue;
          if (-vn > 9) hitLetter(i, VX[k]!, VY[k]!), (HIT[k] = HIT[k]! + 1);
          VX[k] = VX[k]! - 1.6 * vn * dx;
          VY[k] = VY[k]! - 1.6 * vn * dy;
          SQ[k] = SQ[k]! + min(0.35, -vn * 0.006);
        }
        for (let j = k - 1; j >= 0; j--) {
          let dx = BX[k]! - BX[j]!, dy = BY[k]! - BY[j]!;
          const rr = r + R[j]!, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 < 1e-4) continue;
          const d = sqrt(d2), o = (rr - d) / 2;
          (dx /= d), (dy /= d);
          (BX[k] = BX[k]! + dx * o), (BY[k] = BY[k]! + dy * o), (BX[j] = BX[j]! - dx * o), (BY[j] = BY[j]! - dy * o);
          const vn = (VX[k]! - VX[j]!) * dx + (VY[k]! - VY[j]!) * dy;
          if (vn >= 0) continue;
          // Mass by area: a small one rattles off a big one.
          const mk = r * r, mj = R[j]! * R[j]!, ik = (1.8 * mj) / (mk + mj), ij = (1.8 * mk) / (mk + mj);
          (VX[k] = VX[k]! - ik * vn * dx), (VY[k] = VY[k]! - ik * vn * dy), (VX[j] = VX[j]! + ij * vn * dx), (VY[j] = VY[j]! + ij * vn * dy);
          (SQ[k] = SQ[k]! + 0.12), (SQ[j] = SQ[j]! + 0.12);
        }
        if (BY[k]! - r < TOP || AGE[k]! > LIFE[k]! || HIT[k]! >= (big ? 9 : 4)) pop(k);
      }
      if (kn) busy = true;
      for (let m = np - 1; m >= 0; m--)
        if ((PT[m] = PT[m]! + dt) > 0.16) np--, (PX[m] = PX[np]!), (PY[m] = PY[np]!), (PR[m] = PR[np]!), (PT[m] = PT[np]!);
      if (np) busy = true;
      fizz.step(dt, -40, 999);
      if (fizz.live) busy = true;
      for (let i = 0; i < n; i++) if (CD[i]! > 0) CD[i] = CD[i]! - dt;
      if (lt.step(dt)) busy = true;
      if (shk > 0) (shk -= dt), (busy = true);
      if (wt < (word === 3 ? 2.2 : 0.6)) (wt += dt), (busy = true);
      if (busy) e.busy(), (dirty = 1);
    },
    render() {
      lt.render();
      if (!dirty) return;
      dirty = 0;
      draw();
    },
  });

  function draw() {
    g.clearRect(0, 0, W, H);
    const sh = shk > 0 ? (round(shk * 40) & 1 ? 1 : -1) : 0;
    fizz.draw(g, sh, 0);
    // Pip: squash and stretch about the belly, a spin when happy.
    const tl = PIPS[(happy > 0 || mode === SPIN ? 1 : 0) + (face > 0 ? 0 : 2)]!, ax = face > 0 ? 15 : 16;
    if (spin) g.save(), g.translate(round(x), round(y)), g.rotate(spin * face), g.drawImage(tl, -ax, -15), g.restore();
    else g.drawImage(tl, round(x - ax * (1 - sq)) + sh, round(y - 15 * (1 + sq)), round(32 * (1 - sq)), round(24 * (1 + sq)));
    // Bubbles, jelly-squashed after a knock; pops, a ring flashing out.
    for (let k = 0; k < kn; k++) {
      const r = max(1, round(R[k]!)), tl = tile(r), s = r * 2 + 5, q2 = max(-0.3, min(0.3, SQ[k]!)), w = s * (1 + q2), h = s * (1 - q2);
      g.drawImage(tl, round(BX[k]! - w / 2) + sh, round(BY[k]! - h / 2), round(w), round(h));
    }
    for (let m = 0; m < np; m++) {
      const u = PT[m]! / 0.16, s = (PR[m]! * 2 + 5) * (1 + u * 0.8);
      g.globalAlpha = 1 - u;
      g.drawImage(tile(max(1, round(PR[m]!))), round(PX[m]! - s / 2), round(PY[m]! - s / 2), round(s), round(s));
    }
    g.globalAlpha = 1;
    if (word >= 0 && wt < (word === 3 ? 2.2 : 0.6)) {
      // The end card fades: "0 FPS", and under it what that means.
      if (word === 3) g.globalAlpha = min(1, (2.2 - wt) * 2), shout("PAGE GIVEN BACK", wx, wy + 13, 1);
      shout(WORDS[word]!, wx, wy - (wt < 0.06 ? 1 : 0), 2);
      g.globalAlpha = 1;
    }
  }
  /** A shout in the 3 × 5 font, k px a font pixel, centred on x: a rim, a violet drop (when big), the face. */
  function shout(s: string, cx: number, ay: number, k: number) {
    const ax = round(max(2, min(W - textW(s, k) - 2, cx - textW(s, k) / 2)));
    ay = round(ay);
    for (let o = 0; o < 9; o++) if (o !== 4) print(g, s, ax + (o % 3) - 1, ay + ((o / 3) | 0) - 1, C.rim, k);
    if (k > 1) print(g, s, ax + 1, ay + 1, C.cmd, k);
    print(g, s, ax, ay, word === 1 ? "#ffc21a" : C.sys, k);
  }

  engine.start();
  return {
    engine,
    tap,
    get mode() {
      return mode;
    },
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get bubbles() {
      return kn;
    },
    get big() {
      let b = 0;
      for (let k = 0; k < kn; k++) if (RT[k]! >= 6) b++;
      return b;
    },
    get pops() {
      return pops;
    },
    get spins() {
      return spins;
    },
    at: (k: number) => [BX[k]!, BY[k]!, R[k]!],
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the intro at this second, Pip under the
 *  log, just back from poking the big bubble into a spray of small ones that fizz up under the line
 *  (scripts/gallery-posters.mjs). */
export const posterAt = 4.4;

/** For `slot(fig, () => import("./bubbles").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bubbles(stage, slot, first);
