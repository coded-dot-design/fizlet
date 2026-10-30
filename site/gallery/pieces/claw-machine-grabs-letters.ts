// "Grab-O-Tron": a wood-grain claw machine in a late-night arcade, and the prizes in its glass are
// the page's own letters: soft toy blocks that spell TAKE ME HOME. Tap anywhere and the claw runs
// to that spot on its rail (the joystick leans with it), drops, closes on the block under it and
// hauls it up and over to the prize chute. Half the time the grip goes, comically: the prongs spring
// open, the block drops back on the pile and knocks the others about (SO CLOSE!). Get one down the
// chute and the machine spits out a strip of tickets while the counter clicks up; the block is back
// in the glass a moment later. The marquee bulbs chase while it plays and hold still when it rests.
// Bricks: the kernel (fixed step; settle: no frames once the claw is parked and every block is
// asleep; its ledger for every page write, so Recall gives the page back byte for byte) and
// fizlet/slot. Step allocates nothing (typed arrays); a block is written only while it moves.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";

const { abs, cos, max, min, sin, PI } = Math;
const TAU = PI * 2;
const PARTS = 120, POPS = 6, STRIP = 44;
// Claw modes.
const PARK = 0, MOVE = 1, DROP = 2, CLOSE = 3, LIFT = 4, CARRY = 5, RELEASE = 6, HOMEWARD = 7;
// Block states.
const FREE = 0, HELD = 1, GONE = 2;
// The fate of a grab.
const WIN = 1, SLIP = 2, CLOSE_CALL = 3;
const WORDS = ["SO CLOSE!", "RIGGED!", "WAH-WAH", "NOPE.", "WHIFF!", "WINNER!", "LUCKY!", "JACKPOT!", "THUD!"];
const W_WHIFF = 4, W_WIN = 5, W_LUCKY = 6, W_JACKPOT = 7, W_THUD = 8;
const INK = "#1a0b06";
// Scene slots.
const SW = 0, SH = 1, SC = 2, MEAS = 3, DPR = 4, TIME = 5, MODE = 6, MT = 7, KX = 8, HY = 9, OPEN = 10, OPV = 11, TX = 12, HOLD = 13;
const FATE = 14, SLIPT = 15, SWG = 16, SWV = 17, KVX = 18, TICK = 19, TQ = 20, TOUT = 21, TT = 22, SHAKE = 23, LED = 24, ACTIVE = 25;
const STICK = 26, BTN = 27, DEMO = 28, PLAYS = 29, WINS = 30, SLIPS = 31;
// Measured: glass, chute, ticket slot, marquee (CSS px from the stage's top left).
const GX0 = 0, GY0 = 1, GX1 = 2, GY1 = 3, CH1 = 4, CHT = 5, TKX = 6, TKY = 7, MX0 = 8, MY0 = 9, MX1 = 10, MY1 = 11;

export type ClawScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { mode: number; plays: number; wins: number; slips: number; tickets: number; held: number; awake: number; gone: number };
  /** For tests: block i's centre now (CSS px in the stage), or null while it is out of the glass. */
  block(i: number): { x: number; y: number } | null;
  /** For tests: the next grab's fate (1 win, 2 slip), instead of the coin toss. */
  rig(fate: number): void;
};

export function claw(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): ClawScene {
  const engine = createEngine({ root: stage, settle: 0.6, seed: 47 });
  const L = engine.ledger, R = engine.random;
  const q = <E extends HTMLElement>(sel: string) => slot.querySelector<E>(sel)!;
  const glass = q(".cm-glass"), chute = q(".cm-chute"), tk = q(".cm-tk"), mq = q(".cm-mq"), stick = q(".cm-stick"), btn = q(".cm-btn");
  const led = q(".cm-led").firstChild as Text;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const c = canvas.getContext("2d")!;

  const els = [...glass.querySelectorAll<HTMLElement>(".cm-pile i")], n = els.length;
  const BX = new Float32Array(n), BY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), HX = new Float32Array(n), HYb = new Float32Array(n);
  const BW = new Float32Array(n), BH = new Float32Array(n), TILT = new Float32Array(n), VT = new Float32Array(n), SQ = new Float32Array(n), REST = new Float32Array(n), BACK = new Float32Array(n);
  const ST = new Uint8Array(n), AW = new Uint8Array(n), SUP = new Uint8Array(n), DRAWN = new Uint8Array(n);
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PS = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const QW = new Uint8Array(POPS), QX = new Float32Array(POPS), QY = new Float32Array(POPS), QT = new Float32Array(POPS).fill(9);
  const M = new Float32Array(12), G = new Float64Array(32), np = new Uint16Array(1), tap = new Float64Array(3);
  let first_ = true;
  G[MEAS] = 1;
  G[OPEN] = 1;
  G[HOLD] = -1;

  const ro = new ResizeObserver(() => ((G[MEAS] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  stage.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    (tap[0] = 1), (tap[1] = ev.clientX - r.left), (tap[2] = ev.clientY - r.top);
    engine.wake();
  }, { signal: engine.signal });

  const s = () => G[SC]!;
  const to = (m: number) => ((G[MODE] = m), (G[MT] = 0));
  function part(x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    const i = np[0]!;
    if (i >= PARTS) return;
    np[0] = i + 1;
    (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = life), (PS[i] = size), (PC[i] = col);
  }
  function pop(w: number, x: number, y: number) {
    let o = 0;
    for (let i = 1; i < POPS; i++) if (QT[i]! > QT[o]!) o = i;
    (QW[o] = w), (QX[o] = x), (QY[o] = y), (QT[o] = 0);
  }
  const wakeAll = () => {
    for (let i = 0; i < n; i++) if (ST[i] === FREE) (AW[i] = 1), (REST[i] = 0);
  };
  /** A block hits something at speed v: squash, a twist, dust, and a thump through the cabinet. */
  function thump(i: number, v: number, x: number, y: number) {
    const k = min(1, v / (500 * s()));
    if (k < 0.15) return;
    SQ[i] = max(SQ[i]!, 0.22 * k);
    VT[i] = VT[i]! + (R() - 0.5) * 260 * k;
    G[SHAKE] = max(G[SHAKE]!, 0.12 * k);
    for (let q = 0; q < 3 + k * 6; q++) part(x + (R() - 0.5) * BW[i]!, y, (R() - 0.5) * 160 * s(), -R() * 90 * s(), 0.3 + R() * 0.25, (1.5 + R() * 2) * s(), 0);
    if (k > 0.8 && R() < 0.5) pop(W_THUD, x, y - 16 * s());
  }
  const chuteX = () => (M[GX0]! + M[CH1]!) / 2;
  const topY = () => M[GY0]! + 34 * s();
  /** Prong geometry: the head's hang point (x, y), and tip spread and depth for the open amount. */
  const ang = (o: number) => 0.12 + 0.62 * o;
  const tipY = (y: number, o: number) => y + 4 * s() + 18 * s() * cos(ang(o));

  function play(x: number) {
    if (G[MODE] !== PARK) return;
    const half = (BW[0] || 30) / 2 + 2 * s();
    G[TX] = max(M[CH1]! + half, min(M[GX1]! - half, x));
    G[PLAYS] = G[PLAYS]! + 1;
    G[ACTIVE] = 1;
    to(MOVE);
  }

  engine.add({
    read() {
      if (!G[MEAS]) return;
      G[MEAS] = 0;
      const r = stage.getBoundingClientRect(), dpr = min(2, devicePixelRatio || 1);
      const was = G[SW]!, k = was ? r.width / was : 1;
      (G[SW] = r.width), (G[SH] = r.height), (G[SC] = r.width / 640), (G[DPR] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      const box = (el: Element, o: number) => {
        const b = el.getBoundingClientRect();
        (M[o] = b.left - r.left), (M[o + 1] = b.top - r.top), (M[o + 2] = b.right - r.left), (M[o + 3] = b.bottom - r.top);
      };
      box(glass, GX0);
      const cb = chute.getBoundingClientRect(), tb = tk.getBoundingClientRect();
      (M[CH1] = cb.right - r.left), (M[CHT] = cb.top - r.top), (M[TKX] = tb.left + tb.width / 2 - r.left), (M[TKY] = tb.bottom - r.top);
      box(mq, MX0);
      // Inner glass: inside its ink border.
      const bw = glass.clientLeft;
      (M[GX0] = M[GX0]! + bw), (M[GY0] = M[GY0]! + bw), (M[GX1] = M[GX1]! - bw), (M[GY1] = M[GY1]! - bw);
      // Blocks: home (their own place in the pile, transforms aside) and, first time, where they are.
      for (let i = 0; i < n; i++) {
        const b = els[i]!.getBoundingClientRect(), hx = b.left + b.width / 2 - r.left - (BX[i]! - HX[i]!) * (first_ ? 0 : 1), hy = b.top + b.height / 2 - r.top - (BY[i]! - HYb[i]!) * (first_ ? 0 : 1);
        (BW[i] = els[i]!.offsetWidth), (BH[i] = els[i]!.offsetHeight);
        if (first_) (BX[i] = hx), (BY[i] = hy), (HX[i] = hx), (HYb[i] = hy);
        else (BX[i] = hx + (BX[i]! - HX[i]!) * k), (BY[i] = hy + (BY[i]! - HYb[i]!) * k), (HX[i] = hx), (HYb[i] = hy);
      }
      if (first_) (G[KX] = chuteX()), (G[HY] = topY());
      else (G[KX] = G[KX]! * k), (G[HY] = G[HY]! * k), (G[TX] = G[TX]! * k);
      first_ = false;
      wakeAll();
    },
    step(e, dt) {
      const sc = s(), g = 1700 * sc, floor = M[GY1]!, ch1 = M[CH1]!, cht = M[CHT]!, gx0 = M[GX0]!, gx1 = M[GX1]!;
      G[TIME] = G[TIME]! + dt;
      G[MT] = G[MT]! + dt;
      let busy = false;
      if (tap[0]) {
        tap[0] = 0;
        if (G[MODE] === PARK) play(tap[1]!);
      }
      // The demo, when no one is here: one go for the E that ends in a near miss.
      if (G[DEMO] === 1 && G[TIME]! > 0.6) {
        G[DEMO] = 2;
        G[FATE] = CLOSE_CALL;
        play(BX[3]!);
      }
      // The claw: carriage KX on the rail, head HY on its cable, swinging by SWG.
      const mode = G[MODE]!, kx0 = G[KX]!;
      const holdX = () => G[KX]! + sin(G[SWG]!) * (G[HY]! - M[GY0]!);
      if (mode !== PARK) busy = true;
      if (mode === MOVE || mode === CARRY || mode === HOMEWARD) {
        const target = mode === MOVE ? G[TX]! : chuteX(), d = target - G[KX]!, v = (mode === CARRY ? 120 : 170) * sc;
        G[KX] = abs(d) <= v * dt ? target : G[KX]! + Math.sign(d) * v * dt;
        if (G[KX] === target && abs(G[SWG]!) < 0.05) {
          if (mode === MOVE) to(DROP);
          else if (mode === CARRY) to(RELEASE);
          else to(PARK), (G[ACTIVE] = 0);
        }
      } else if (mode === DROP) {
        // Down until the open prongs straddle the top block under the head, or the floor.
        G[HY] = G[HY]! + 150 * sc * dt;
        const hx = holdX();
        let top = floor;
        for (let i = 0; i < n; i++) if (ST[i] === FREE && abs(BX[i]! - hx) < BW[i]! * 0.5 + 6 * sc) top = min(top, BY[i]! - BH[i]! / 2);
        if (G[HY]! + 9 * sc >= top || tipY(G[HY]!, 1) >= floor - 2 * sc) to(CLOSE);
      } else if (mode === CLOSE) {
        // Close; a block centred enough under the head is caught.
        const hx = holdX();
        let pick = -1, best = 1e9;
        for (let i = 0; i < n; i++) {
          if (ST[i] !== FREE) continue;
          const top = BY[i]! - BH[i]! / 2, dx = abs(BX[i]! - hx);
          if (dx < BW[i]! * 0.62 && top > G[HY]! - 4 * sc && top < G[HY]! + 22 * sc && top < best) (best = top), (pick = i);
        }
        const grip = pick >= 0 ? max(0, (BW[pick]! / 2 - 5 * sc) / (18 * sc) - 0.12) / 0.62 : 0;
        G[OPEN] = max(grip, G[OPEN]! - dt / 0.3);
        if (G[MT]! > 0.38) {
          if (pick >= 0) {
            ST[pick] = HELD;
            G[HOLD] = pick;
            wakeAll();
            if (!G[FATE]) G[FATE] = R() < 0.5 ? WIN : R() < 0.5 ? SLIP : CLOSE_CALL;
            G[SLIPT] = 0.35 + R() * 0.9;
          } else pop(W_WHIFF, hx, G[HY]! + 30 * sc);
          to(LIFT);
        }
      } else if (mode === LIFT) {
        G[HY] = max(topY(), G[HY]! - 110 * sc * dt);
        if (G[HY] === topY()) to(CARRY);
      } else if (mode === RELEASE) {
        G[OPEN] = min(1, G[OPEN]! + dt / 0.25);
        if (G[HOLD]! >= 0 && G[OPEN]! > 0.6) {
          const b = G[HOLD]!;
          (ST[b] = FREE), (AW[b] = 1), (VX[b] = 0), (VY[b] = 0), (G[HOLD] = -1);
        }
        if (G[MT]! > 0.6) to(HOMEWARD), (G[FATE] = 0);
      } else if (mode === PARK) G[OPEN] = min(1, G[OPEN]! + dt * 3);
      // The slip: on a coin toss's word (or right over the chute, for a close call), the grip goes.
      const b = G[HOLD]!;
      if (b >= 0 && (mode === LIFT || mode === CARRY) && G[FATE]! >= SLIP) {
        const go = G[FATE] === SLIP ? G[MT]! + (mode === CARRY ? 1.2 : 0) > G[SLIPT]! : mode === CARRY && G[KX]! - chuteX() < BW[b]! * 2.1;
        if (go) {
          pop(G[FATE] === CLOSE_CALL || abs(G[KX]! - chuteX()) < BW[b]! * 1.5 ? 0 : 1 + ((R() * 3) | 0), BX[b]!, BY[b]! - 26 * sc);
          (ST[b] = FREE), (AW[b] = 1), (G[HOLD] = -1);
          // A close call drops dead, just short of the chute; a slip keeps some of the swing.
          (VX[b] = G[FATE] === CLOSE_CALL ? 40 * sc : G[KVX]! + (R() - 0.5) * 60 * sc), (VY[b] = -60 * sc), (VT[b] = (R() - 0.5) * 500);
          (G[OPV] = 9), (G[SLIPS] = G[SLIPS]! + 1), (G[FATE] = 0);
          wakeAll();
        }
      }
      // Prongs that have let go spring wide and wobble back.
      if (G[OPV]) {
        G[OPEN] = G[OPEN]! + G[OPV]! * dt;
        G[OPV] = G[OPV]! - (G[OPEN]! - 1) * 160 * dt - G[OPV]! * 8 * dt;
        if (abs(G[OPV]!) < 0.05 && abs(G[OPEN]! - 1) < 0.01) (G[OPV] = 0), (G[OPEN] = 1);
      }
      // The swing: the carriage's pull on a pendulum.
      const kv = (G[KX]! - kx0) / dt, acc = (kv - G[KVX]!) / dt;
      G[KVX] = kv;
      G[SWV] = G[SWV]! + (-G[SWG]! * 40 - G[SWV]! * 3.2 - (acc / (300 * sc)) * 6) * dt;
      G[SWG] = max(-0.35, min(0.35, G[SWG]! + G[SWV]! * dt));
      if (abs(G[SWG]!) + abs(G[SWV]!) > 0.01) busy = true;
      else (G[SWG] = 0), (G[SWV] = 0);
      // Blocks: the held one rides the claw; the rest fall, stack, push and sleep.
      if (G[HOLD]! >= 0) {
        const i = G[HOLD]!, hx = holdX(), hy = G[HY]! + 8 * sc + BH[i]! / 2;
        (VX[i] = (hx - BX[i]!) / dt), (VY[i] = (hy - BY[i]!) / dt), (BX[i] = hx), (BY[i] = hy);
        TILT[i] = TILT[i]! * 0.9 + G[SWG]! * 40 * 0.1;
      }
      for (let i = 0; i < n; i++) {
        SUP[i] = 0;
        if (ST[i] === GONE) {
          // Restock: back in from the top of the glass once its turn comes.
          if ((BACK[i] = BACK[i]! - dt) <= 0) {
            (ST[i] = FREE), (AW[i] = 1), (BX[i] = ch1 + BW[i]! + R() * (gx1 - ch1 - BW[i]! * 2)), (BY[i] = M[GY0]! - BH[i]!), (VX[i] = 0), (VY[i] = 0), (VT[i] = (R() - 0.5) * 200);
          } else e.busy(BACK[i]!);
          continue;
        }
        if (ST[i] !== FREE || !AW[i]) continue;
        busy = true;
        VY[i] = VY[i]! + g * dt;
        (BX[i] = BX[i]! + VX[i]! * dt), (BY[i] = BY[i]! + VY[i]! * dt);
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < n; i++) {
          if (ST[i] === GONE) continue;
          for (let j = i + 1; j < n; j++) {
            if (ST[j] === GONE) continue;
            const mi = ST[i] === HELD || !AW[i] ? 0 : 1, mj = ST[j] === HELD || !AW[j] ? 0 : 1;
            if (!mi && !mj) continue;
            const dx = BX[j]! - BX[i]!, dy = BY[j]! - BY[i]!, px = (BW[i]! + BW[j]!) / 2 - abs(dx), py = (BH[i]! + BH[j]!) / 2 - abs(dy);
            if (px <= 0 || py <= 0) continue;
            const wi = mi / (mi + mj), wj = mj / (mi + mj);
            // The held block never lifts another along: one riding on it is shoved off sideways.
            const held = ST[i] === HELD ? i : ST[j] === HELD ? j : -1;
            if (held >= 0 && px >= py && BY[held === i ? j : i]! < BY[held]!) {
              const o = held === i ? j : i, sx = BX[o]! >= BX[held]! ? 1 : -1;
              BX[o] = BX[o]! + sx * px;
              VX[o] = sx * 140 * sc;
              VT[o] = VT[o]! + sx * 120;
              continue;
            }
            if (px < py) {
              const sx = dx < 0 ? -1 : 1;
              (BX[i] = BX[i]! - sx * px * wi), (BX[j] = BX[j]! + sx * px * wj);
              const rv = (VX[j]! - VX[i]!) * sx;
              if (rv < 0) (VX[i] = VX[i]! + sx * rv * 0.6 * wi * 2), (VX[j] = VX[j]! - sx * rv * 0.6 * wj * 2);
            } else {
              const sy = dy < 0 ? -1 : 1;
              (BY[i] = BY[i]! - sy * py * wi), (BY[j] = BY[j]! + sy * py * wj);
              const rv = (VY[j]! - VY[i]!) * sy;
              if (rv < 0) {
                // The one on top is supported; a hard landing wakes and jolts the one below.
                const up = sy > 0 ? i : j, dn = sy > 0 ? j : i;
                if (it === 0 && -rv > 140 * sc) {
                  thump(up, -rv, BX[up]!, BY[up]! + BH[up]! / 2);
                  if (!AW[dn] && ST[dn] === FREE) (AW[dn] = 1), (REST[dn] = 0), (VY[dn] = -rv * 0.15), (VX[dn] = (BX[dn]! - BX[up]!) * 4), (VT[dn] = (R() - 0.5) * 300);
                }
                (VY[i] = VY[i]! + sy * rv * 0.62 * wi * 2), (VY[j] = VY[j]! - sy * rv * 0.62 * wj * 2);
                // Friction: the top block is carried along by the one below.
                VX[up] = VX[up]! + (VX[dn]! - VX[up]!) * 0.3;
              }
              // Balanced on a corner (its centre past the edge below): it tips and slides off.
              const up = sy > 0 ? i : j, dn = sy > 0 ? j : i, off = BX[up]! - BX[dn]!;
              if (abs(off) <= BW[dn]! / 2) SUP[up] = 1;
              else if (!SUP[up]) SUP[up] = off > 0 ? 3 : 2;
            }
          }
          // The glass, the floor and the chute's wall; a block over the chute falls through.
          if (ST[i] !== FREE || !AW[i]) continue;
          const hw = BW[i]! / 2, hh = BH[i]! / 2;
          if (BX[i]! - hw < gx0) (BX[i] = gx0 + hw), (VX[i] = abs(VX[i]!) * 0.3);
          if (BX[i]! + hw > gx1) (BX[i] = gx1 - hw), (VX[i] = -abs(VX[i]!) * 0.3);
          if (BY[i]! - hh < M[GY0]! && VY[i]! < 0) (BY[i] = M[GY0]! + hh), (VY[i] = 0);
          if (BY[i]! + hh > cht) {
            if (BX[i]! >= ch1 && BX[i]! - hw < ch1) (BX[i] = ch1 + hw), (VX[i] = abs(VX[i]!) * 0.3);
            else if (BX[i]! < ch1 && BX[i]! + hw > ch1) (BX[i] = ch1 - hw), (VX[i] = -abs(VX[i]!) * 0.3);
          }
          if (BX[i]! >= ch1 && BY[i]! + hh > floor) {
            if (it === 0 && VY[i]! > 140 * sc) thump(i, VY[i]!, BX[i]!, floor);
            (BY[i] = floor - hh), (VY[i] = VY[i]! > 140 * sc ? -VY[i]! * 0.25 : 0), (VX[i] = VX[i]! * 0.8), (SUP[i] = 1);
          }
          if (BX[i]! < ch1 && BY[i]! - hh > floor) {
            // Down the chute: a win. Tickets, and the block comes back in a moment.
            (ST[i] = GONE), (BACK[i] = 1.8), (VX[i] = 0), (VY[i] = 0);
            const lucky = G[MODE] !== RELEASE && G[MODE] !== HOMEWARD, jack = R() < 0.12;
            G[WINS] = G[WINS]! + 1;
            G[TQ] = G[TQ]! + (jack ? 50 : 6 + ((R() * 14) | 0));
            pop(jack ? W_JACKPOT : lucky ? W_LUCKY : W_WIN, chuteX(), cht - 30 * sc);
            G[SHAKE] = max(G[SHAKE]!, 0.15);
            for (let q = 0; q < 14; q++) part(chuteX(), cht, (R() - 0.5) * 220 * sc, -(80 + R() * 200) * sc, 0.7 + R() * 0.4, (2 + R() * 2.5) * sc, 1 + (q % 4));
          }
        }
      }
      for (let i = 0; i < n; i++) {
        // Tilt springs back; squash relaxes; a slow, supported block falls asleep.
        if (TILT[i] || VT[i]) {
          VT[i] = VT[i]! + (-TILT[i]! * 180 - VT[i]! * 11) * dt;
          TILT[i] = TILT[i]! + VT[i]! * dt;
          if (abs(TILT[i]!) < 0.2 && abs(VT[i]!) < 2 && ST[i] !== HELD) (TILT[i] = 0), (VT[i] = 0);
          else busy = true;
        }
        if (SQ[i]! > 0) (SQ[i] = max(0, SQ[i]! - dt * 1.4)), (busy = true);
        if (ST[i] !== FREE || !AW[i]) continue;
        if (SUP[i]! > 1) {
          // Only a corner under it, its centre past the edge: it tips and slides off.
          const d = SUP[i] === 3 ? 1 : -1;
          (VX[i] = VX[i]! + d * 30 * sc), (VT[i] = VT[i]! + d * 30), (REST[i] = 0);
          continue;
        }
        if (SUP[i] && abs(VX[i]!) + abs(VY[i]!) < 30 * sc) {
          VX[i] = VX[i]! * 0.7;
          if ((REST[i] = REST[i]! + dt) > 0.25) (AW[i] = 0), (VX[i] = 0), (VY[i] = 0);
        } else REST[i] = 0;
      }
      // Tickets: one out of the slot every few frames while any are owed.
      if (G[TQ]! > 0) {
        busy = true;
        if ((G[TT] = G[TT]! - dt) <= 0) (G[TT] = 0.07), (G[TQ] = G[TQ]! - 1), (G[TICK] = G[TICK]! + 1), (G[TOUT] = min(STRIP, G[TOUT]! + 1)), (G[LED] = 1);
      }
      for (let i = 0; i < np[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --np[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PS[i] = PS[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        PVY[i] = PVY[i]! + 700 * sc * dt;
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
      }
      for (let k = 0; k < POPS; k++) if (QT[k]! < 1) (QT[k] = QT[k]! + dt * 0.9), (busy = true);
      if (G[SHAKE]! > 0) (G[SHAKE] = G[SHAKE]! - dt), (busy = true);
      // The panel: the stick leans with the carriage, the button is down while the claw drops.
      const lean = max(-20, min(20, (G[KVX]! / (170 * sc)) * 20)) | 0, press = G[MODE] === DROP || G[MODE] === CLOSE ? 1 : 0;
      if (lean !== G[STICK] || press !== G[BTN]) (G[STICK] = lean), (G[BTN] = press), (G[LED] = G[LED]! | 2);
      if (busy || np[0] || G[LED]) e.busy();
    },
    render() {
      const sc = s(), dpr = G[DPR]!, t = G[TIME]!;
      const sh = G[SHAKE]! > 0 ? G[SHAKE]! * 16 * sc : 0, jx = sh ? (R() - 0.5) * sh : 0;
      // The page: blocks where the physics has them (a twist, a squash); the stick, the button, the LED.
      for (let i = 0; i < n; i++) {
        const el = els[i]!, ox = BX[i]! - HX[i]!, oy = BY[i]! - HYb[i]!, still = ST[i] !== GONE && abs(ox) < 0.25 && abs(oy) < 0.25 && !TILT[i] && !SQ[i];
        if (still) {
          if (DRAWN[i]) L.unstyle(el, "transform"), L.unstyle(el, "visibility"), (DRAWN[i] = 0);
          continue;
        }
        DRAWN[i] = 1;
        const q = SQ[i]!;
        L.style(el, "transform", `translate(${(ox * 2 | 0) / 2}px,${(oy * 2 | 0) / 2 + q * BH[i]! * 0.5}px) rotate(${TILT[i]!.toFixed(1)}deg) scale(${(1 + q).toFixed(2)},${(1 - q).toFixed(2)})`);
        L.style(el, "visibility", ST[i] === GONE ? "hidden" : "");
      }
      if (G[LED]! & 2) {
        if (G[STICK]) L.style(stick, "transform", `rotate(${G[STICK]}deg)`);
        else L.unstyle(stick, "transform");
        if (G[BTN]) L.style(btn, "transform", `translateY(${(4 * sc).toFixed(1)}px)`);
        else L.unstyle(btn, "transform");
      }
      if (G[LED]! & 1) L.text(led, `TICKETS ${String(G[TICK]! % 10000).padStart(4, "0")}`);
      G[LED] = 0;
      c.setTransform(dpr, 0, 0, dpr, jx * dpr, 0);
      c.clearRect(-20, -20, G[SW]! + 40, G[SH]! + 40);
      // Marquee bulbs: a chase while it plays; all on, steady, at rest.
      const mx0 = M[MX0]!, my0 = M[MY0]!, mx1 = M[MX1]!, my1 = M[MY1]!, br = 3.2 * sc, per = (mx1 - mx0) * 2 + (my1 - my0) * 2, step = 15 * sc;
      for (let d = step / 2, k = 0; d < per; d += step, k++) {
        let x: number, y: number;
        const w = mx1 - mx0, h = my1 - my0;
        if (d < w) (x = mx0 + d), (y = my0);
        else if (d < w + h) (x = mx1), (y = my0 + d - w);
        else if (d < w * 2 + h) (x = mx1 - (d - w - h)), (y = my1);
        else (x = mx0), (y = my1 - (d - w * 2 - h));
        const lit = !G[ACTIVE] || ((k + ((t * 14) | 0)) % 3 === 0);
        if (lit) {
          c.fillStyle = "rgba(255,240,170,.35)";
          c.beginPath();
          c.arc(x, y, br * 2, 0, TAU);
          c.fill();
        }
        c.fillStyle = lit ? "#fff7cf" : "#9a5a12";
        c.strokeStyle = INK;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, br, 0, TAU);
        c.fill();
        c.stroke();
      }
      // Tickets: down from the slot, then folding along the floor.
      tickets(sc);
      // Inside the glass: the rail, the carriage, the cable, the claw.
      c.save();
      c.beginPath();
      c.rect(M[GX0]!, M[GY0]!, M[GX1]! - M[GX0]!, M[GY1]! - M[GY0]!);
      c.clip();
      const ry = M[GY0]! + 7 * sc, kx = G[KX]!, hy = G[HY]!, sw = G[SWG]!;
      c.fillStyle = "#8d86a8";
      c.strokeStyle = INK;
      c.lineWidth = 1.5 * sc;
      c.fillRect(M[GX0]!, ry - 2.5 * sc, M[GX1]! - M[GX0]!, 5 * sc);
      c.strokeRect(M[GX0]! - 2, ry - 2.5 * sc, M[GX1]! - M[GX0]! + 4, 5 * sc);
      c.fillStyle = "#c9c3dc";
      c.fillRect(kx - 9 * sc, ry - 6 * sc, 18 * sc, 10 * sc);
      c.strokeRect(kx - 9 * sc, ry - 6 * sc, 18 * sc, 10 * sc);
      c.translate(kx, ry);
      c.rotate(-sw);
      const len = hy - ry;
      c.strokeStyle = "#d9d4ea";
      c.lineWidth = 1.6 * sc;
      c.beginPath();
      c.moveTo(0, 4 * sc);
      c.lineTo(0, len);
      c.stroke();
      c.translate(0, len);
      // Prongs: three, the middle one seen end-on.
      const a = ang(G[OPEN]!), pl = 18 * sc;
      c.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? "#e8e4f4" : INK;
        c.lineWidth = (pass ? 2.6 : 5) * sc;
        for (let side = -1; side <= 1; side += 2) {
          const x0 = side * 5 * sc, y0 = 4 * sc, x1 = x0 + side * sin(a) * pl, y1 = y0 + cos(a) * pl;
          c.beginPath();
          c.moveTo(x0, y0);
          c.lineTo(x1, y1);
          c.lineTo(x1 - side * 5 * sc, y1 + 4 * sc);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(0, 4 * sc);
        c.lineTo(0, 4 * sc + cos(a) * pl * 0.8);
        c.stroke();
      }
      c.fillStyle = "#ff2e88";
      c.strokeStyle = INK;
      c.lineWidth = 1.5 * sc;
      c.beginPath();
      c.arc(0, 0, 9 * sc, PI, 0);
      c.lineTo(9 * sc, 4 * sc);
      c.lineTo(-9 * sc, 4 * sc);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#ffd0e6";
      c.fillRect(-5 * sc, -6 * sc, 3 * sc, 3 * sc);
      c.restore();
      // Dust and confetti.
      for (let i = 0; i < np[0]!; i++) {
        c.globalAlpha = min(1, PL[i]! * 3);
        c.fillStyle = PC[i] ? ["#ff5fa8", "#3ff0ff", "#b6ff3b", "#ffd23f"][PC[i]! - 1]! : "#d8cfee";
        c.fillRect(PX[i]! - PS[i]! / 2, PY[i]! - PS[i]! / 2, PS[i]!, PS[i]!);
      }
      c.globalAlpha = 1;
      // Popups.
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      for (let k = 0; k < POPS; k++) {
        const u = QT[k]!;
        if (u >= 1) continue;
        const z = u < 0.1 ? 0.6 + u * 4 : 1, w = QW[k]!, y = QY[k]! - u * 26 * sc;
        c.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1;
        c.font = `900 ${(19 * sc * z) | 0}px system-ui,sans-serif`;
        c.lineWidth = 5 * sc * z;
        c.strokeStyle = INK;
        c.strokeText(WORDS[w]!, QX[k]!, y);
        c.fillStyle = w >= W_WIN && w <= W_JACKPOT ? "#b6ff3b" : w === W_THUD ? "#ffffff" : "#ff5fa8";
        c.fillText(WORDS[w]!, QX[k]!, y);
      }
      c.globalAlpha = 1;
    },
  });

  function tickets(sc: number) {
    const out = G[TOUT]!;
    if (!out) return;
    const x0 = M[TKX]!, y0 = M[TKY]!, floor = G[SH]! - 2 * sc, tl = 9 * sc, tw = 8 * sc;
    let x = x0, y = y0;
    for (let k = 0; k < out; k++) {
      // Each ticket hangs from the last; past the floor they fold over, flat, to the left.
      const down = y + tl < floor, nx = down ? x + (k & 1 ? 1.5 : -1.5) * sc : x - tl * 0.85, ny = down ? y + tl : floor - (k & 1 ? 2 : 0) * sc;
      c.save();
      c.translate((x + nx) / 2, (y + ny) / 2);
      c.rotate(Math.atan2(ny - y, nx - x) - PI / 2);
      c.fillStyle = k & 1 ? "#ffd23f" : "#ffb02e";
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.fillRect(-tw / 2, -tl / 2, tw, tl);
      c.strokeRect(-tw / 2, -tl / 2, tw, tl);
      c.fillStyle = "#c2410c";
      c.fillRect(-tw / 4, -tl / 6, tw / 2, tl / 3);
      c.restore();
      (x = nx), (y = ny);
    }
  }

  G[DEMO] = first ? 2 : 1;
  engine.busy(0.7);
  engine.start();
  if (first) (tap[0] = 1), (tap[1] = first.x), (tap[2] = first.y);
  return {
    engine,
    get state() {
      let awake = 0, gone = 0;
      for (let i = 0; i < n; i++) (awake += ST[i] === FREE ? AW[i]! : 0), (gone += ST[i] === GONE ? 1 : 0);
      return { mode: G[MODE]!, plays: G[PLAYS]!, wins: G[WINS]!, slips: G[SLIPS]!, tickets: G[TICK]!, held: G[HOLD]!, awake, gone };
    },
    block(i: number) {
      return ST[i] === GONE ? null : { x: BX[i]!, y: BY[i]! };
    },
    rig(fate: number) {
      G[FATE] = fate;
    },
    destroy: () => engine.destroy(),
  };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => claw(stage, slot, first);
/** The poster: the claw coming down on the E (the blocks are the page itself, at home). */
export const posterAt = 2.2;
