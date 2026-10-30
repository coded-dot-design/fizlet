// #41 Laser eyes: a little original mascot on a crate, and across the room a stack of three crates
// lettered F, U, D. It powers on: ears bristle, the room goes red, charge spirals into its eyes, a
// squint. Then it fires: two beams sweep down the stack and slice it, crate by crate. A cut piece
// slides off along its glowing edge, falls, bounces and lands on whatever is under it; where the
// beams meet the wall they leave scorch marks that cool from white to red to nothing; the mascot is
// pushed back by its own beams. Click anywhere and it looks there and zaps it: what's there gets
// sliced or knocked, empty wall gets scorched. Zap too fast and the heat bar tops out: OVERHEAT,
// smoke, X eyes, a cool-down. Chop the crates to bits and a fresh F, U, D drop in.
// Bricks: the kernel (fixed step, settle: it sleeps once the pieces lie still and the marks have
// cooled), fizlet/sprite (the mascot, baked once; charge and white-hot eyes as palettes) and
// fizlet/slot (loads near the screen, never under reduced motion; destroy() gives the page back).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, bits, offscreen, print, textW } from "./pix";

export type LaserScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly pieces: number; readonly cuts: number; readonly hot: boolean };

const { abs, cos, hypot, max, min, round, sin } = Math;
const ORANGE = "#ff8a1f", RED = "#ff2b4e";

// The mascot (18 × 16): m fur, k rim, s chest, e eyes (a palette: calm, charging, white hot),
// n nose. Frames: 0 calm, 1 bristling (ears up, fur spikes).
const PAL = ["..kk..........kk..", ".kmmk........kmmk.", ".kmmmkkkkkkkkmmmk.", "kmmmmmmmmmmmmmmmmk", "kmmmmmmmmmmmmmmmmk", "kmmeeeemmmmeeeemmk", "kmmeeeemmmmeeeemmk", "kmmmmmmmmmmmmmmmmk", "kmmmmmmmnnmmmmmmmk", "kmmmmmmkmmkmmmmmmk", ".kmmmmmmmmmmmmmmk.", ".kmmssssssssssmmk.", "..kmmssssssssmmk..", "..kmmmk....kmmmk..", "..kkkkk....kkkkk.."];
const MASCOT = { frames: [["..................", ...PAL], ["k.k.k..........k.k", ".kmk..........kmk.", ...PAL.slice(1)]], colors: { m: ORANGE, k: C.rim, s: C.muted, e: "eye", n: C.attack }, ax: 9, ay: 16 };
// Eye centres in mascot pixels (left, right), and where the pupils sit.
const EYE_X = [5, 13], EYE_Y = 7, SC = 2;
const MX = 30, FLOOR = 80, CRATE_W = 20, CRATE_H = 14, STACK_X = 120;

const CAP = 48, MARKS = 64;
// Piece slots (structure of arrays below): x, y, w, h, vx, vy, source crate, source y, no-cut timer, hot edge.
// Scene slots.
const TIME = 0, MODE = 1, MT = 2, AX = 3, AY = 4, HEAT = 5, SHOOT = 6, RX = 7, RV = 8, SQ = 9, CAPT = 10, TQ = 11, QX = 12, QY = 13, RED_ = 14, CUTS = 15, DIRTY = 16, REST = 17, SWEEP = 18;
// Modes: 0 calm, 1 charging, 2 sweep (the opening volley), 3 zap (a tap), 4 overheated.
const CALM = 0, CHARGE = 1, SWEEPING = 2, ZAP = 3, HOT = 4;
const LETTERS = ["F", "U", "D"];

export function lasers(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): LaserScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 41 });
  const rnd = engine.random;
  const g = artCanvas(engine, stage);
  const art = sprites({ pal: MASCOT }, { palettes: [{ eye: C.ink }, { eye: C.attack }, { eye: C.hurt }] });
  const sparks = bits(160, [C.hurt, RED, C.ink, C.muted, C.line]);
  const charge = bits(60, [RED, C.attack, C.hurt]);
  // The crates, lettered once: pieces are cut from these pictures.
  const crate = LETTERS.map((l) => {
    const x = offscreen(CRATE_W, CRATE_H);
    x.fillStyle = C.rim;
    x.fillRect(0, 0, CRATE_W, CRATE_H);
    x.fillStyle = C.base;
    x.fillRect(1, 1, CRATE_W - 2, CRATE_H - 2);
    x.fillStyle = C.line;
    x.fillRect(1, 4, CRATE_W - 2, 1);
    x.fillRect(1, 9, CRATE_W - 2, 1);
    print(x, l, 6, 3, C.muted, 2);
    print(x, l, 6, 3, C.ink, 2);
    return x.canvas;
  });
  // The room, drawn once: a back wall of panels and a floor.
  const room = offscreen(W, H);
  room.fillStyle = "#1b1636";
  room.fillRect(0, 0, W, H);
  room.fillStyle = C.rim;
  for (let x = 0; x < W; x += 20) room.fillRect(x, 0, 1, FLOOR);
  room.fillRect(0, FLOOR, W, H - FLOOR);
  room.fillStyle = C.line;
  room.fillRect(0, FLOOR, W, 1);
  room.fillRect(MX - 12, FLOOR - 8, 24, 8);
  room.fillStyle = C.base;
  room.fillRect(MX - 11, FLOOR - 7, 22, 6);

  const PX = new Float32Array(CAP), PY = new Float32Array(CAP), PW = new Float32Array(CAP), PH = new Float32Array(CAP), VX = new Float32Array(CAP), VY = new Float32Array(CAP);
  const SRC = new Uint8Array(CAP), SY = new Float32Array(CAP), NC = new Float32Array(CAP), HOTE = new Float32Array(CAP), LIVE = new Uint8Array(CAP);
  let pn = 0;
  // Scorch marks: x, y, heat (1 white hot → 0 gone).
  const MKX = new Float32Array(MARKS), MKY = new Float32Array(MARKS), MKH = new Float32Array(MARKS);
  let mi = 0;
  const S = new Float64Array(20);
  // Where each beam ends this frame (x, y per eye), and whether it is on.
  const BE = new Float32Array(4);

  function stack(drop: number) {
    pn = 0;
    for (let i = 0; i < 3; i++) {
      PX[pn] = STACK_X;
      PY[pn] = FLOOR - CRATE_H * (3 - i) - drop * (1 + i * 0.6);
      PW[pn] = CRATE_W;
      PH[pn] = CRATE_H;
      VX[pn] = 0;
      VY[pn] = 0;
      SRC[pn] = i;
      SY[pn] = 0;
      NC[pn] = 0;
      HOTE[pn] = 0;
      LIVE[pn] = drop ? 1 : 0;
      pn++;
    }
  }
  stack(0);
  S[AX] = 140;
  S[AY] = 40;
  S[MODE] = CHARGE;
  S[CAPT] = 9;
  S[DIRTY] = 1;

  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[TQ] = 1), engine.wake());
  if (first) tap((first.x / (stage.clientWidth || 1)) * W, (first.y / (stage.clientHeight || 1)) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const to = (m: number) => ((S[MODE] = m), (S[MT] = 0));
  const eyeX = (k: number) => MX + S[RX]! + (EYE_X[k]! - 9) * SC;
  const eyeY = () => FLOOR - 8 - (16 - EYE_Y) * SC;

  /** Piece i is cut at height y (art px): a new piece takes the top part and slides off. */
  function cut(i: number, y: number, dir: number) {
    const top = y - PY[i]!;
    if (pn >= CAP || NC[i]! > 0 || top < 3 || PH[i]! - top < 3) return false;
    const j = pn++;
    PX[j] = PX[i]!;
    PY[j] = PY[i]!;
    PW[j] = PW[i]!;
    PH[j] = top;
    SRC[j] = SRC[i]!;
    SY[j] = SY[i]!;
    VX[j] = dir * (45 + rnd() * 45);
    VY[j] = -60 - rnd() * 60;
    NC[j] = NC[i] = 0.4;
    HOTE[j] = HOTE[i] = 1.2;
    LIVE[j] = LIVE[i] = 1;
    PY[i] = y;
    SY[i] = SY[i]! + top;
    PH[i] = PH[i]! - top;
    S[CUTS] = S[CUTS]! + 1;
    for (let k = 0; k < 6; k++) sparks.spawn(PX[i]! + rnd() * PW[i]!, y, (rnd() - 0.5) * 80, -30 - rnd() * 50, 0.3 + rnd() * 0.3, 1, (rnd() * 3) | 0);
    return true;
  }

  /** One beam from eye k towards the aim: it stops at the first piece in its way (and cuts it). */
  function beam(k: number, cutting: boolean) {
    const x0 = eyeX(k), y0 = eyeY(), dx = S[AX]! - x0, dy = S[AY]! - y0 + (k ? 1 : -1), len = max(1, hypot(dx, dy));
    // Past the aim, on to the wall's edge or the floor.
    const ux = dx / len, uy = dy / len;
    let x = x0, y = y0;
    for (let s = 0; s < 260; s++) {
      x += ux;
      y += uy;
      if (x < 0 || x >= W || y < 0 || y >= FLOOR) break;
      for (let i = 0; i < pn; i++) {
        if (x < PX[i]! || x > PX[i]! + PW[i]! || y < PY[i]! || y > PY[i]! + PH[i]!) continue;
        if (cutting && !cut(i, round(y), ux >= 0 ? 1 : -1) && NC[i]! <= 0) (VX[i] = VX[i]! + ux * 20), (VY[i] = min(VY[i]!, -20)), (LIVE[i] = 1), (HOTE[i] = 0.6);
        BE[k * 2] = x;
        BE[k * 2 + 1] = y;
        return;
      }
    }
    BE[k * 2] = x;
    BE[k * 2 + 1] = y;
    // Where it meets the wall (or floor), a scorch mark.
    if (((S[TIME]! * 60) | 0) % 2 === k) {
      MKX[mi] = round(x);
      MKY[mi] = round(min(y, FLOOR));
      MKH[mi] = 1;
      mi = (mi + 1) % MARKS;
    }
  }

  engine.add({
    step(e, dt) {
      const t = (S[TIME] = S[TIME]! + dt), m = S[MODE]!, mt = (S[MT] = S[MT]! + dt);
      let busy = m !== CALM;
      if (S[TQ]) {
        S[TQ] = 0;
        if (m !== HOT && m !== CHARGE && m !== SWEEPING) {
          S[AX] = S[QX]!;
          S[AY] = min(FLOOR - 1, S[QY]!);
          S[HEAT] = S[HEAT]! + 0.3;
          to(ZAP);
          S[SQ] = 0.15;
        }
      }
      if (m === CHARGE) {
        // Powering on: the ears bristle, charge spirals in, the room goes red.
        S[RED_] = min(1, mt / 1.1);
        if (((t * 30) | 0) !== (((t - dt) * 30) | 0))
          for (let k = 0; k < 2; k++) {
            const a = rnd() * 6.283, r = 16 + rnd() * 8, life = 0.35;
            charge.spawn(eyeX(k) + cos(a) * r, eyeY() + sin(a) * r, (-cos(a) * r) / life, (-sin(a) * r) / life, life, 1, (rnd() * 3) | 0);
          }
        S[AX] = 150;
        S[AY] = 24;
        if (mt > 1.25) to(SWEEPING), (S[SQ] = 0.2), (S[SWEEP] = 0);
      } else if (m === SWEEPING) {
        // The opening volley: down the stack from top to floor, then a beat to cool.
        const k = min(1, mt / 1.3);
        S[AX] = 150 - k * 6;
        S[AY] = 24 + k * 56;
        S[SHOOT] = mt < 1.3 ? 1 : 0;
        S[RED_] = 1;
        if (mt > 1.3) (S[CAPT] = 0), to(CALM), (S[REST] = 1.4);
      } else if (m === ZAP) {
        S[SHOOT] = mt < 0.22 ? 1 : 0;
        S[RED_] = 0.5;
        if (S[HEAT]! >= 1) to(HOT), (S[SHOOT] = 0), (S[CAPT] = 0);
        else if (mt > 0.3) to(CALM), (S[REST] = 0.6);
      } else if (m === HOT) {
        S[SHOOT] = 0;
        if (((t * 12) | 0) !== (((t - dt) * 12) | 0)) for (let k = 0; k < 2; k++) sparks.spawn(eyeX(k), eyeY() - 2, (rnd() - 0.5) * 6, -18 - rnd() * 10, 0.8, 2, 4);
        if (mt > 1.8) to(CALM), (S[HEAT] = 0.5);
      }
      if (S[MODE] === CALM) S[SHOOT] = 0;
      // Firing: both beams, cutting; the beams push the mascot back.
      if (S[SHOOT]) {
        beam(0, true);
        beam(1, true);
        S[RV] = S[RV]! - 60 * dt;
        if (((t * 30) | 0) % 2) for (let k = 0; k < 2; k++) sparks.spawn(BE[k * 2]!, BE[k * 2 + 1]!, (rnd() - 0.5) * 70, -20 - rnd() * 50, 0.25 + rnd() * 0.25, 1, (rnd() * 3) | 0);
        busy = true;
      }
      S[RV] = S[RV]! + (-180 * S[RX]! - 16 * S[RV]!) * dt;
      S[RX] = max(-4, S[RX]! + S[RV]! * dt);
      if (abs(S[RX]!) + abs(S[RV]!) < 0.05) S[RX] = S[RV] = 0;
      else busy = true;
      if (S[SQ]! > 0) (S[SQ] = max(0, S[SQ]! - dt * 1.2)), (busy = true);
      if (!S[SHOOT] && S[RED_]! > 0 && S[MODE] !== CHARGE) (S[RED_] = max(0, S[RED_]! - dt * 1.5)), (busy = true);
      if (S[HEAT]! > 0 && S[MODE] !== HOT) (S[HEAT] = max(0, S[HEAT]! - dt * 0.18)), (busy = true);
      if (S[REST]! > 0) (S[REST] = S[REST]! - dt), (busy = true);
      if (S[CAPT]! < 2.5) (S[CAPT] = S[CAPT]! + dt), (busy = true);
      // The pieces: fly, bounce, land on the floor or on a piece under them.
      let top = H;
      for (let i = 0; i < pn; i++) {
        if (NC[i]! > 0) NC[i] = NC[i]! - dt;
        if (HOTE[i]! > 0) (HOTE[i] = HOTE[i]! - dt), (busy = true);
        top = min(top, PY[i]!);
        // What it stands on: the floor, or the top of a piece under it (falling or not).
        let floor = FLOOR;
        for (let j = 0; j < pn; j++) if (j !== i && PX[j]! < PX[i]! + PW[i]! - 1 && PX[j]! + PW[j]! > PX[i]! + 1 && PY[j]! >= PY[i]! + PH[i]! - 2) floor = min(floor, PY[j]!);
        // A resting piece whose support was cut away falls.
        if (!LIVE[i]) {
          if (PY[i]! + PH[i]! >= floor - 0.5) continue;
          LIVE[i] = 1;
        }
        busy = true;
        VY[i] = VY[i]! + 420 * dt;
        PX[i] = PX[i]! + VX[i]! * dt;
        if (PX[i]! < 2 || PX[i]! + PW[i]! > W - 2) (VX[i] = -VX[i]! * 0.5), (PX[i] = max(2, min(W - 2 - PW[i]!, PX[i]!)));
        PY[i] = PY[i]! + VY[i]! * dt;
        if (PY[i]! + PH[i]! >= floor && VY[i]! > 0) {
          PY[i] = floor - PH[i]!;
          if (VY[i]! > 70) {
            for (let k = 0; k < 3; k++) sparks.spawn(PX[i]! + rnd() * PW[i]!, floor, (rnd() - 0.5) * 30, -10 - rnd() * 10, 0.3, 1, 4);
            (VY[i] = -VY[i]! * 0.3), (VX[i] = VX[i]! * 0.6);
          } else (VY[i] = 0), (VX[i] = abs(VX[i]!) < 4 ? 0 : VX[i]! * 0.5);
          if (!VY[i] && !VX[i]) LIVE[i] = 0;
        }
      }
      // A fresh stack once it's chopped down to a heap (and still): the heap goes up in a puff.
      if (top > FLOOR - 24 && S[CUTS]! > S[19]! && S[MODE] === CALM && S[REST]! <= 0) {
        let moving = 0;
        for (let i = 0; i < pn; i++) moving += LIVE[i]!;
        if (!moving) {
          for (let i = 0; i < pn; i++) for (let k = 0; k < 3; k++) sparks.spawn(PX[i]! + rnd() * PW[i]!, PY[i]! + rnd() * PH[i]!, (rnd() - 0.5) * 40, -20 - rnd() * 40, 0.4 + rnd() * 0.3, 2, 4);
          stack(60);
          S[19] = S[CUTS]!;
          busy = true;
        }
      }
      // Scorch marks cool.
      for (let k = 0; k < MARKS; k++) if (MKH[k]! > 0) (MKH[k] = MKH[k]! - dt * 0.4), (busy = true);
      sparks.step(dt, 200, FLOOR);
      charge.step(dt, 0, 999);
      if (sparks.live || charge.live) busy = true;
      if (busy) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    const t = S[TIME]!, m = S[MODE]!, shake = S[SHOOT] ? ((t * 60) & 1 ? 1 : -1) : 0;
    g.setTransform(1, 0, 0, 1, shake, 0);
    g.drawImage(room.canvas, 0, 0);
    // The room goes red while it powers on and fires.
    if (S[RED_]! > 0) (g.globalAlpha = S[RED_]! * 0.25), (g.fillStyle = RED), g.fillRect(-2, 0, W + 4, FLOOR), (g.globalAlpha = 1);
    // Scorch marks: white hot, then yellow, red, dark, gone.
    for (let k = 0; k < MARKS; k++) {
      const h = MKH[k]!;
      if (h <= 0) continue;
      g.fillStyle = h > 0.85 ? C.ink : h > 0.6 ? C.hurt : h > 0.3 ? RED : C.line;
      g.fillRect(MKX[k]! - 1, MKY[k]! - 1, 2, 2);
    }
    // The pieces, each cut from its crate's picture; a cut edge glows, then cools.
    for (let i = 0; i < pn; i++) {
      const x = round(PX[i]!), y = round(PY[i]!), w = round(PW[i]!), h = round(PH[i]!);
      if (h < 1) continue;
      g.drawImage(crate[SRC[i]!]!, 0, round(SY[i]!), CRATE_W, h, x, y, w, h);
      if (HOTE[i]! > 0) (g.fillStyle = HOTE[i]! > 0.8 ? C.ink : HOTE[i]! > 0.4 ? C.hurt : RED), g.fillRect(x, y, w, 1);
    }
    // The mascot: squashes as it fires, pushed back by its beams; bristles while charged.
    const pose = m === CHARGE || m === SWEEPING || m === ZAP ? 1 : 0, pal = m === SWEEPING || (m === ZAP && S[SHOOT]) ? 2 : m === CHARGE && (t * 14) & 1 ? 1 : m === CHARGE ? 2 : 0;
    const tile = art.tile("pal", pose, SC, pal), sq = S[SQ]!, w = round(tile.width * (1 + sq * 0.5)), h = round(tile.height * (1 - sq * 0.5));
    const x = round(MX + S[RX]! - w / 2), y = FLOOR - 8 - h;
    g.drawImage(tile, x, y, w, h);
    // Pupils look at the aim; X eyes when overheated.
    for (let k = 0; k < 2; k++) {
      const ex = round(eyeX(k)), ey = round(eyeY());
      if (m === HOT) {
        g.fillStyle = C.rim;
        for (let d = -2; d <= 2; d++) g.fillRect(ex + d, ey + d - 1, 1, 1), g.fillRect(ex + d, ey - d - 1, 1, 1);
        continue;
      }
      const dx = S[AX]! - ex, dy = S[AY]! - ey, d = max(1, hypot(dx, dy));
      g.fillStyle = pal === 2 ? RED : C.rim;
      g.fillRect(ex - 1 + round((dx / d) * 2), ey - 1 + round((dy / d) * 1), 2, 2);
    }
    // The beams: a red glow, a white core, a flare at each end.
    if (S[SHOOT]) {
      for (let k = 0; k < 2; k++) {
        const x0 = eyeX(k), y0 = eyeY(), x1 = BE[k * 2]!, y1 = BE[k * 2 + 1]!, n = max(1, round(hypot(x1 - x0, y1 - y0)));
        for (let s = 0; s <= n; s++) {
          const px = round(x0 + ((x1 - x0) * s) / n), py = round(y0 + ((y1 - y0) * s) / n);
          g.fillStyle = RED;
          g.fillRect(px - 1, py - 1, 3, 3);
        }
        g.fillStyle = C.ink;
        for (let s = 0; s <= n; s++) g.fillRect(round(x0 + ((x1 - x0) * s) / n), round(y0 + ((y1 - y0) * s) / n), 1, 1);
        const f = 2 + ((t * 40) & 1);
        g.fillRect(round(x1) - f, round(y1), f * 2 + 1, 1);
        g.fillRect(round(x1), round(y1) - f, 1, f * 2 + 1);
        g.fillRect(round(x0) - 2, round(y0) - 2, 5, 5);
      }
    }
    charge.draw(g);
    sparks.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // The heat bar under the crate it sits on; OVERHEAT when it tops out.
    const heat = min(1, S[HEAT]!);
    if (heat > 0 || m === HOT) {
      g.fillStyle = C.rim;
      g.fillRect(MX - 11, FLOOR + 3, 22, 4);
      g.fillStyle = m === HOT ? ((t * 8) & 1 ? RED : C.hurt) : heat > 0.7 ? RED : C.hurt;
      g.fillRect(MX - 10, FLOOR + 4, round(20 * (m === HOT ? 1 : heat)), 2);
      print(g, m === HOT ? "OVERHEAT" : "HEAT", MX + 14, FLOOR + 3, m === HOT ? RED : C.muted);
    }
    // The caption, once the volley is done: slams in, then stays.
    const ct = S[CAPT]!;
    if (ct < 2.5) {
      const s = m === HOT ? "" : "LASER EYES ON", k = ct < 0.06 ? 3 : 2;
      if (s) {
        const tw = textW(s, k);
        g.fillStyle = C.rim;
        g.fillRect(round(80 - tw / 2) - 3, 5 - (k - 2) * 2, tw + 6, 5 * k + 6);
        print(g, s, round(80 - tw / 2), 8 - (k - 2) * 2, RED, k);
      }
    }
  }

  engine.start();
  return {
    engine,
    tap,
    get pieces() {
      return pn;
    },
    get cuts() {
      return S[CUTS]!;
    },
    get hot() {
      return S[MODE] === HOT;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  both beams halfway down the stack (scripts/gallery-posters.mjs draws it). */
export const posterAt = 1.85;

/** For `slot(fig, () => import("./laser-eyes-mascot-powers-fires").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => lasers(stage, slot, first);
