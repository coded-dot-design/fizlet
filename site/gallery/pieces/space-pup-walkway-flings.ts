// Walkies: BLIP (./space-pup.ts) on the family's moving walkway out on the sun deck at dusk, under
// a page that says WALKIES. Tap anywhere and the walkway goes up a notch (the dial on its console
// shows it): he trots, then jogs, then runs flat out with his ears streaming and his tongue
// flapping. Past what four legs can do he starts sliding back along the belt, scrambling, and off
// the end he goes: flung up across the page, tumbling through the letters (they go flying), BONK
// off the wall, and down in a dizzy heap. Then the letters float home, he climbs back on and asks
// for AGAIN. Leave it alone and the walkway winds down a notch at a time and he sits.
// Bricks: the kernel (fixed step, settle: no frames once he's sitting; its seeded random; the
// ledger, so Recall gives the page back byte for byte) and fizlet/slot. The letters are the stage's
// own elements (site/gallery/stages/space-pup-walkway-flings.html), moved only by custom properties
// written in render.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { particles, DIZZY, DUST, H, HAPPY, letters, P, Pup, STAR, SWEAT, W, WORRY, WOW, bubble, capsule, clamp, drawPup, ellipse, pupAt, yell } from "./space-pup";
import { print } from "./pixel-font";

export type WalkwayScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly level: number; readonly mode: number };

const { abs, cos, max, min, PI, round, sin } = Math;
/** The deck's floor; the belt (left end, right end, top); the console's dial. */
const enum N { FL = 118, BL = 92, BR = 212, BT = 106, HOMEX = 168, DX = 226, DY = 74, STANDY = BT - 18, SITY = BT - 14, LIEY = FL - 19, LEGS = 84 }
const SC = 1.3;
/** Body centre over the belt (standing, sitting) and on the floor (lying). */
/** Belt speed per notch (art px/s); the fastest he can run. */
const SPD = [0, 26, 48, 72, 104, 150];
/** Modes: walking (or sitting) on the belt, flung, dizzy on the floor, trotting back, hopping on. */
const enum M { ON, FLUNG, HEAP, BACK, HOP }
// State slots.
const enum K { MODE, T, X, Y, VX, VY, LV, V, BELT, RUN, IDLE, Q, QX, QY, RES, DIRTY, WORD, WT, WX, WY, BUB, BT_, SPIN, PRESS, AUTO, BONKS, ROT }
const WORDS = ["WHEEE!", "BONK!", "THUD!", "CLICK"];
const BUBBLES = ["", "WALKIES!", "TROT TROT", "BRISK!", "TOO FAST!", "WHOA WHOA", "AGAIN!", "...STARS"];

export function walkway(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): WalkwayScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 63 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const wrap = slot.querySelector<HTMLElement>(".spw")!;
  const page = letters(wrap, N.FL, rnd), bits = particles(), pup = new Pup(), at = new Float32Array(2);
  pup.s = SC;
  const S = new Float64Array(28);
  S[K.X] = N.HOMEX;
  S[K.Y] = N.SITY;
  S[K.RES] = S[K.DIRTY] = 1;
  S[K.WT] = S[K.BT_] = 9;
  S[K.AUTO] = first ? 0 : 0.4; // on load it starts itself, once
  engine.busy(0.5);

  const ro = new ResizeObserver(() => ((S[K.RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (b: number) => ((S[K.BUB] = b), (S[K.BT_] = 0));
  const yellAt = (w: number, x: number, y: number) => ((S[K.WORD] = w), (S[K.WT] = 0), (S[K.WX] = x), (S[K.WY] = y));
  const tap = (x: number, y: number) => ((S[K.QX] = x), (S[K.QY] = y), (S[K.Q] = S[K.Q]! + 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Up a notch (the console clicks; he says how it's going). */
  function faster() {
    S[K.LV] = min(5, S[K.LV]! + 1);
    S[K.IDLE] = 0;
    S[K.PRESS] = 0.15;
    say(S[K.LV]!);
  }

  function pose(time: number) {
    const m = S[K.MODE]!, t = S[K.T]!, v = S[K.V]!;
    pup.x = S[K.X]!;
    pup.y = S[K.Y]!;
    pup.dir = 1;
    pup.rot = 0;
    pup.len = 1;
    pup.tilt = 0;
    pup.flap = 0;
    pup.tongue = 0;
    pup.wag = sin(time * 12) * 0.4;
    if (m === M.ON || m === M.BACK || m === M.HOP) {
      const run = m === M.ON ? min(1, v / 60) : 0.6;
      pup.dir = m === M.BACK && S[K.X]! > N.HOMEX - 40 ? -1 : 1;
      if (m === M.ON && v < 2) {
        // Sitting: hind legs folded under, nose up.
        pup.rot = -0.3;
        pup.leg.set([1.5, -0.05, 1.5, 0.05]);
        pup.len = 0.75;
        pup.face = HAPPY;
        return;
      }
      pup.gait(S[K.RUN]!, m === M.ON ? 0.4 + run * 0.6 : 0.6);
      pup.rot = m === M.ON ? -0.05 - min(0.25, max(0, v - N.LEGS) / 200) : 0;
      pup.ear = m === M.ON ? min(1, v / 110) : 0.2;
      pup.flap = sin(time * (10 + v / 5)) * min(1, v / 80);
      pup.tongue = m === M.ON ? clamp((v - 30) / 60, 0, 1) : 0.6;
      pup.face = S[K.LV]! >= 5 ? WOW : S[K.LV]! >= 4 ? WORRY : HAPPY;
      pup.y += round(abs(sin(S[K.RUN]!))) * -1;
    } else if (m === M.FLUNG) {
      pup.rot = S[K.ROT]!;
      pup.gait(time * 40, 1);
      pup.ear = 1;
      pup.flap = sin(time * 40);
      pup.face = WOW;
      pup.tongue = 1;
    } else {
      // In a heap on his back, legs in the air, seeing stars.
      pup.rot = PI - 0.25;
      pup.tilt = 1;
      pup.ear = 0.25;
      pup.leg.set([-0.3, 0.6, -0.5 + sin(t * 9) * 0.15, 0.8]);
      pup.len = 0.85;
      pup.face = DIZZY;
      pup.tongue = 0.8;
      pup.wag = 0;
    }
  }

  engine.add({
    read() {
      if (S[K.RES]) (S[K.RES] = 0), page.measure(), (S[K.DIRTY] = 1);
    },
    step(e, dt) {
      const m = S[K.MODE]!, t = (S[K.T] = S[K.T]! + dt), time = e.time;
      let busy = S[K.V]! > 0.5 || S[K.LV]! > 0 || m !== M.ON || S[K.AUTO]! > 0;
      if (S[K.AUTO]! > 0 && (S[K.AUTO] = S[K.AUTO]! - dt) <= 0) faster();
      // Taps: a notch each, while he's on the belt (the machine's off while he's away).
      while (S[K.Q]! > 0) {
        S[K.Q] = S[K.Q]! - 1;
        if (m === M.ON) faster();
        else if (m === M.HEAP && page.near(S[K.QX]!, S[K.QY]!, 1) < 0) say(7);
      }
      // The belt: towards its notch; left alone, a notch down at a time.
      if (m === M.ON && S[K.LV]! > 0 && (S[K.IDLE] = S[K.IDLE]! + dt) > 2.6) (S[K.IDLE] = 1.4), (S[K.LV] = S[K.LV]! - 1), say(S[K.LV]!);
      const want = m === M.ON ? SPD[S[K.LV]!]! : 0;
      S[K.V] = S[K.V]! + (want - S[K.V]!) * min(1, dt * (want > S[K.V]! ? 2.5 : 1.6));
      if (want === 0 && S[K.V]! < 0.5) S[K.V] = 0;
      S[K.BELT] = (S[K.BELT]! + S[K.V]! * dt) % 600;
      if (S[K.PRESS]! > 0) (S[K.PRESS] = S[K.PRESS]! - dt), (busy = true);
      if (m === M.ON) {
        // He keeps up while he can; past LEGS the belt takes him back to the end.
        const v = S[K.V]!, legs = min(v, N.LEGS), x = S[K.X]!;
        const nx = x + (v > N.LEGS ? legs - v : x < N.HOMEX - 1 ? 26 : 0) * dt;
        S[K.X] = min(N.HOMEX, nx);
        S[K.Y] = v < 2 ? N.SITY : N.STANDY;
        S[K.RUN] = S[K.RUN]! + dt * (4 + legs * 0.16);
        if (S[K.LV]! >= 4 && rnd() < dt * 6) bits.add(SWEAT, x + 12, S[K.Y]! - 22, 20 + rnd() * 30, -40 - rnd() * 30, 0.6);
        if (v > 40 && rnd() < dt * v * 0.12) bits.add(DUST, x - 16, N.BT - 1, -v * 0.6, -5 - rnd() * 8, 0.35);
        if (S[K.X]! < N.BL + 4) {
          // Off the end: flung up and back across the page, tumbling.
          to(M.FLUNG);
          S[K.VX] = -(v * 1.05 + 45);
          S[K.VY] = -(150 + v * 0.55);
          S[K.SPIN] = -9;
          S[K.ROT] = 0;
          S[K.LV] = 0;
          S[K.BONKS] = 0;
          yellAt(0, S[K.X]! - 20, S[K.Y]! - 34);
        }
      } else if (m === M.FLUNG) {
        S[K.VY] = S[K.VY]! + 330 * dt;
        let x = S[K.X]! + S[K.VX]! * dt, y = S[K.Y]! + S[K.VY]! * dt;
        S[K.ROT] = S[K.ROT]! + S[K.SPIN]! * dt;
        if (x < 16 && S[K.VX]! < 0) {
          // The wall: BONK, and back the other way.
          x = 16;
          S[K.VX] = -S[K.VX]! * 0.45;
          S[K.SPIN] = -S[K.SPIN]! * 0.7;
          yellAt(1, 30, y - 24);
          for (let k = 0; k < 5; k++) bits.add(STAR, 14, y + (rnd() - 0.5) * 16, 20 + rnd() * 40, -60 - rnd() * 40, 0.7);
        }
        if (y < 16 && S[K.VY]! < 0) (y = 16), (S[K.VY] = -S[K.VY]! * 0.3);
        if (y > N.LIEY && S[K.VY]! > 0) {
          y = N.LIEY;
          if (S[K.BONKS]! < 1 && S[K.VY]! > 120) (S[K.VY] = -S[K.VY]! * 0.35), (S[K.VX] = S[K.VX]! * 0.5), (S[K.BONKS] = 1), yellAt(2, x, y - 26);
          else to(M.HEAP), say(7), page.home(1.2);
          for (let k = 0; k < 8; k++) bits.add(DUST, x + (rnd() - 0.5) * 30, N.FL - 2, (rnd() - 0.5) * 60, -10 - rnd() * 20, 0.6);
        }
        S[K.X] = x;
        S[K.Y] = y;
        // What he tumbles through goes flying.
        pose(time);
        for (let k = 0; k < 2; k++) {
          pupAt(pup, k ? 17 : 0, k ? -13 : 0, at);
          for (let i = page.near(at[0]!, at[1]!, 13); i >= 0; i = page.near(at[0]!, at[1]!, 13))
            page.hit(i, S[K.VX]! * 0.8 + (rnd() - 0.5) * 80, S[K.VY]! * 0.5 - 60 - rnd() * 80);
        }
      } else if (m === M.HEAP) {
        S[K.Y] = N.LIEY;
        if (t > 2.4 && !page.out) to(M.BACK);
      } else if (m === M.BACK) {
        // A trot back along the deck to the belt's end, then a hop up.
        const d = N.BL + 14 - S[K.X]!;
        S[K.Y] = N.FL - 18;
        S[K.X] = S[K.X]! + clamp(d, -46 * dt, 46 * dt);
        S[K.RUN] = S[K.RUN]! + dt * 12;
        if (abs(d) < 0.5) to(M.HOP);
      } else if (m === M.HOP) {
        const u = min(1, t / 0.45);
        S[K.X] = N.BL + 14 + (N.HOMEX - N.BL - 14) * u;
        S[K.Y] = N.FL - 18 + (N.SITY - N.FL + 18) * u - sin(u * PI) * 16;
        S[K.RUN] = S[K.RUN]! + dt * 12;
        if (u >= 1) to(M.ON), say(6), (S[K.V] = 0);
      }
      busy = page.step(dt) || busy;
      busy = bits.step(dt) || busy;
      if (S[K.WT]! < 1.1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (S[K.BT_]! < 1.6) (S[K.BT_] = S[K.BT_]! + dt), (busy = true);
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render(e) {
      page.render(L);
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw(e.time);
    },
  });

  /** The walkway: legs, the belt (its treads moving), its rollers; the console with its dial. */
  function machine() {
    const b = S[K.BELT]!, lv = S[K.LV]!;
    // Legs and the console pole.
    g.fillStyle = P.rim;
    g.fillRect(N.BL + 8, N.BT + 6, 5, N.FL - N.BT - 6), g.fillRect(N.BR - 12, N.BT + 6, 5, N.FL - N.BT - 6), g.fillRect(N.DX - 3, N.DY + 6, 6, N.FL - N.DY - 6);
    g.fillStyle = P.tealD;
    g.fillRect(N.BL + 9, N.BT + 6, 3, N.FL - N.BT - 6), g.fillRect(N.BR - 11, N.BT + 6, 3, N.FL - N.BT - 6), g.fillRect(N.DX - 2, N.DY + 6, 4, N.FL - N.DY - 6);
    // The belt: rim, body, treads sliding left.
    capsule(g, N.BL, N.BT + 3.5, N.BR, N.BT + 3.5, 5, P.rim);
    capsule(g, N.BL, N.BT + 3.5, N.BR, N.BT + 3.5, 4, P.dusk);
    g.fillStyle = P.teal;
    g.fillRect(N.BL, N.BT - 1, N.BR - N.BL, 2);
    g.fillStyle = P.rim;
    for (let x = N.BL + 2 - (b % 8); x < N.BR - 1; x += 8) if (x >= N.BL) g.fillRect(x, N.BT - 1, 2, 2);
    // Rollers, spokes turning.
    for (let k = 0; k < 2; k++) {
      const rx = k ? N.BR : N.BL;
      ellipse(g, rx, N.BT + 3.5, 4, 4, 0, P.coral);
      const a = -b / 4;
      g.fillStyle = P.rim;
      g.fillRect(round(rx + cos(a) * 2.5), round(N.BT + 3.5 + sin(a) * 2.5), 1, 1), g.fillRect(round(rx - cos(a) * 2.5), round(N.BT + 3.5 - sin(a) * 2.5), 1, 1);
    }
    // The console: a dome with a dial (0–5) and the big button.
    ellipse(g, N.DX, N.DY, 11, 9, 0, P.rim);
    ellipse(g, N.DX, N.DY, 10, 8, 0, P.cream);
    for (let i = 0; i <= 5; i++) {
      const a = PI + (i / 5) * PI;
      g.fillStyle = i <= lv && lv ? (i >= 4 ? P.coral : P.teal) : P.shade;
      g.fillRect(round(N.DX + cos(a) * 7.5), round(N.DY + 1 + sin(a) * 7.5), 1, 1);
    }
    const na = PI + (S[K.V]! / 150) * PI;
    capsule(g, N.DX, N.DY + 1, N.DX + cos(na) * 5.5, N.DY + 1 + sin(na) * 5.5, 0.6, P.rim);
    const pr = S[K.PRESS]! > 0 ? 1 : 0;
    g.fillStyle = P.rim;
    g.fillRect(N.DX - 5, N.DY + 4, 10, 4);
    g.fillStyle = pr ? P.gold : P.coral;
    g.fillRect(N.DX - 4, N.DY + 4 + pr, 8, 3 - pr);
    print(g, "012345"[lv]!, N.DX - 1, N.DY - 5, lv >= 4 ? P.coralD : P.rim);
  }

  function draw(time: number) {
    g.clearRect(0, 0, W, H);
    const m = S[K.MODE]!, v = S[K.V]!;
    pose(time);
    machine();
    // Speed lines behind him when the belt is really going.
    if (m === M.ON && v > 55) {
      g.fillStyle = P.cream;
      for (let k = 0; k < 4; k++) {
        const len = round((v - 40) / 8) + ((k * 7 + round(S[K.BELT]! / 3)) % 6), y = round(pup.y - 14 + k * 6);
        g.fillRect(round(pup.x - 30 - len - ((k * 13) % 9)), y, len, 1);
      }
    }
    // His shadow.
    const fy = m === M.ON || m === M.HOP ? N.BT - 1 : N.FL - 1;
    g.fillStyle = m === M.ON || m === M.HOP ? P.rim : P.coralD;
    g.fillRect(round(pup.x) - 12, fy, 24, 1);
    bits.draw(g);
    drawPup(g, pup);
    // Stars round a dizzy head.
    if (m === M.HEAP) {
      pupAt(pup, 15, -8, at);
      g.fillStyle = P.gold;
      for (let s = 0; s < 3; s++) {
        const a = time * 5 + s * 2.09, sx = round(at[0]! + cos(a) * 10), sy = round(at[1]! - 14 + sin(a) * 3);
        g.fillRect(sx - 1, sy, 3, 1), g.fillRect(sx, sy - 1, 1, 3);
      }
    }
    if (S[K.BT_]! < 1.5 && S[K.BUB]) {
      pupAt(pup, 14, -24, at);
      bubble(g, BUBBLES[S[K.BUB]!]!, m === M.HEAP ? pup.x : at[0]!, m === M.HEAP ? pup.y - 28 : at[1]!);
    }
    if (S[K.WT]! < 1) yell(g, WORDS[S[K.WORD]!]!, S[K.WX]!, clamp(S[K.WY]!, 6, N.FL - 20) - (S[K.WT]! < 0.06 ? 2 : 0), S[K.WORD] === 0 ? 3 : 2);
  }

  engine.start();
  return {
    engine,
    tap,
    get level() {
      return S[K.LV]!;
    },
    get mode() {
      return S[K.MODE]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): out for a walk (scripts/gallery-posters.mjs). */
export const posterAt = 1.6;

/** For `slot(fig, () => import("./space-pup-walkway-flings").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => walkway(stage, slot, first);
