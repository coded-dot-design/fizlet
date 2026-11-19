// Belly rub: BLIP, the family's space-age pup (./space-pup.ts), on the rug of a sky apartment at
// dusk, under a page that says GOOD BOY. He rolls over and asks. Hover over his belly (or tap it)
// to scratch: his back leg kicks faster the more you scratch, he wiggles, his tongue flops out,
// hearts float up, and past a point he floats up off the rug on pure joy, his paws booping the
// letters above him. Scratch too much and it's ZOOMIES: he flips over and rockets round the page,
// knocking every letter he touches flying; they tumble to the floor. Then he skids to a stop, flops
// down panting, the letters float home, and he rolls over again for more.
// Bricks: the kernel (fixed step, settle: no frames once he's lying still; its seeded random; the
// ledger, so Recall gives the page back byte for byte) and fizlet/slot. The letters are the stage's
// own elements (site/gallery/stages/space-pup-belly-rub-zoomies.html), moved only by custom
// properties written in render.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { BLISS, particles, DUST, H, HAPPY, HEART, letters, P, Pup, SHUT, SPARK, W, WOW, bubble, clamp, drawPup, pupAt, yell } from "./space-pup";
import { print } from "./pixel-font";

export type BellyScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly joy: number; readonly mode: number };

const { abs, atan2, cos, hypot, max, min, PI, round, sin } = Math;
/** Body centre heights: lying down, on his back (his head flopped back on the rug), standing. */
const enum N { FL = 116, HOMEX = 120, LIEY = FL - 12, UPY = FL - 15, STANDY = FL - 20, REACH = 20 }
const SC = 1.5;
/** Modes: lying, rolling over, belly up, flipping up, zoomies, skidding, tired, trotting back to the rug. */
const enum M { LIE, ROLL, BELLY, FLIP, ZOOM, SKID, TIRED, WALK }
// State slots.
const enum K { MODE, T, X, Y, VX, VY, JOY, FLOAT, KICK, SCR, LAST, RUN, AIM, AX, AY, PX, PY, PIN, MOVED, QX, QY, Q, RES, DIRTY, WORD, WT, BUB, BT, WIG, ZT, BX, BY, PRX, PRY, HINT }
const WORDS = ["ZOOMIES!", "BONK!", "WHEE!", "BOING!"];
const BUBBLES = ["BELLY?", "MORE!", "HUFF HUFF", "BELLY PLS", "AGAIN?"];
// A paw's end in the rig (leg hip x, angle) is found with pupAt; scratch: within this of the belly.

export function bellyRub(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BellyScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 61 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const wrap = slot.querySelector<HTMLElement>(".spb")!;
  const page = letters(wrap, N.FL, rnd), bits = particles(), pup = new Pup(), at = new Float32Array(2);
  pup.s = SC;
  const S = new Float64Array(36);
  S[K.X] = N.HOMEX;
  S[K.Y] = N.LIEY;
  S[K.RES] = S[K.DIRTY] = 1;
  S[K.WT] = S[K.BT] = 9;
  S[K.MODE] = M.LIE;
  engine.busy(0.6); // the roll-over on load, scheduled

  const ro = new ResizeObserver(() => ((S[K.RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (b: number) => ((S[K.BUB] = b), (S[K.BT] = 0));
  const yellAt = (w: number, x: number, y: number) => ((S[K.WORD] = w), (S[K.WT] = 0), (S[K.BX] = x), (S[K.BY] = y));
  const tap = (x: number, y: number) => ((S[K.QX] = x), (S[K.QY] = y), (S[K.Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  // The pointer: where (client px, read into art px in the READ phase), and how far it moved.
  let cx = 0, cy = 0, moved = 0, over = false;
  const opts = { signal: engine.signal };
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    if (over) moved += abs(e.clientX - cx) + abs(e.clientY - cy);
    cx = e.clientX;
    cy = e.clientY;
    over = true;
    engine.wake();
  }, opts);
  stage.addEventListener("pointerleave", () => ((over = false), engine.wake()), opts);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, opts);

  /** The belly's centre (world art px), into PRX, PRY. */
  const belly = () => (pupAt(pup, 1, 2, at), (S[K.PRX] = at[0]!), (S[K.PRY] = at[1]!));

  /** A scratch: joy up, the hand busy for a beat. */
  function scratch(amount: number) {
    S[K.JOY] = min(1.05, S[K.JOY]! + amount);
    S[K.SCR] = 0.45;
    S[K.LAST] = 0;
  }

  /** Pose the pup for this moment (also run headless for the poster). */
  function pose(e: number) {
    const m = S[K.MODE]!, t = S[K.T]!, j = S[K.JOY]!, f = S[K.FLOAT]!;
    pup.x = S[K.X]!;
    pup.dir = 1;
    pup.len = 1;
    pup.tilt = 0;
    pup.flap = 0;
    pup.ear = 0;
    pup.wag = sin(e * 14) * 0.5 * min(1, j * 3);
    if (m === M.LIE || m === M.TIRED) {
      pup.rot = 0;
      pup.len = 0.5;
      pup.leg.set([-1.4, 1.4, -1.4, 1.4]);
      pup.y = N.LIEY;
      pup.face = m === M.TIRED ? SHUT : HAPPY;
      pup.tongue = m === M.TIRED ? 0.7 + sin(t * 22) * 0.3 : 0;
      pup.y += m === M.TIRED ? round(sin(t * 22)) * 0.5 : 0;
      pup.wag = m === M.TIRED ? 0 : pup.wag;
    } else if (m === M.ROLL) {
      const u = min(1, t / 0.5);
      pup.rot = PI * u * u * (3 - 2 * u);
      pup.y = S[K.Y]! + (N.UPY - S[K.Y]!) * u - sin(u * PI) * 9;
      pup.gait(t * 30, 0.8);
      pup.face = WOW;
      pup.tongue = 0;
      pup.ear = u;
    } else if (m === M.BELLY) {
      // On his back: front paws curled, hind legs up, the near one kicking while you scratch.
      const w = sin(S[K.WIG]!) * 0.1 * j;
      pup.rot = PI + w;
      pup.y = N.UPY - f;
      pup.tilt = 1 + w * 2;
      pup.ear = 0.25;
      pup.flap = sin(e * 9) * f * 0.06;
      pup.leg[0] = -0.25;
      pup.leg[1] = 0.55 + sin(e * 3) * 0.05;
      pup.leg[3] = 0.8;
      pup.leg[2] = -0.35 - abs(sin(S[K.KICK]!)) * 0.95 * min(1, S[K.SCR]! * 4 + j * 0.5);
      pup.len = 0.85;
      pup.face = S[K.SCR]! > 0 || j > 0.6 ? BLISS : HAPPY;
      pup.tongue = clamp(j * 2.2 - 0.3, 0, 1);
    } else if (m === M.WALK) {
      pup.rot = 0;
      pup.dir = S[K.X]! < N.HOMEX ? 1 : -1;
      pup.y = N.STANDY + round(abs(sin(S[K.RUN]!))) * -1;
      pup.gait(S[K.RUN]!, 0.55);
      pup.tongue = 0.5;
      pup.face = HAPPY;
      pup.wag = sin(e * 16) * 0.4;
    } else if (m === M.FLIP) {
      const u = min(1, t / 0.32);
      pup.rot = PI + PI * u;
      pup.y = S[K.Y]!;
      pup.gait(t * 40, 1);
      pup.face = WOW;
      pup.ear = 1;
    } else {
      // Zooming (or skidding): body along the flight, legs a blur, ears streaming.
      const vx = S[K.VX]!, vy = S[K.VY]!;
      pup.dir = vx < 0 ? -1 : 1;
      pup.rot = m === M.SKID ? -0.15 * pup.dir * min(1, abs(vx) / 100) : clamp(atan2(vy, abs(vx)), -0.7, 0.7) * pup.dir;
      pup.y = S[K.Y]!;
      pup.gait(S[K.RUN]!, m === M.SKID ? 0.3 : 1);
      if (m === M.SKID) pup.leg.set([-0.9, 0.9, -0.9, 0.9]);
      pup.ear = 1;
      pup.flap = sin(e * 30);
      pup.face = m === M.SKID ? WOW : BLISS;
      pup.tongue = 1;
    }
  }

  engine.add({
    read() {
      if (S[K.RES]) (S[K.RES] = 0), page.measure(), (S[K.DIRTY] = 1);
      // The pointer, in art px (one rect read a frame, only while it's over the stage).
      if (over) {
        const r = stage.getBoundingClientRect();
        S[K.PX] = ((cx - r.left) / r.width) * W;
        S[K.PY] = ((cy - r.top) / r.height) * H;
        S[K.MOVED] = S[K.MOVED]! + (moved / r.width) * W;
        moved = 0;
      }
      S[K.PIN] = over ? 1 : 0;
    },
    step(e, dt) {
      const m = S[K.MODE]!, t = (S[K.T] = S[K.T]! + dt), time = e.time;
      let busy = m !== M.BELLY || S[K.JOY]! > 0 || S[K.FLOAT]! > 0.05;
      if (m === M.LIE) {
        if (t > 0.5) to(M.ROLL);
      } else if (m === M.ROLL) {
        S[K.JOY] = 0;
        if (t > 0.5) {
          to(M.BELLY);
          S[K.JOY] = S[K.FLOAT] = 0;
          if (S[K.BT]! > 1) say(0);
        }
      } else if (m === M.BELLY) {
        belly();
        const bx = S[K.PRX]!, by = S[K.PRY]!;
        // Hovering over the belly scratches as the pointer moves.
        const on = S[K.PIN]! > 0 && hypot(S[K.PX]! - bx, S[K.PY]! - by) < N.REACH;
        if (on && S[K.MOVED]! > 0) scratch(S[K.MOVED]! * 0.0021), (S[K.SCR] = max(S[K.SCR]!, 0.15));
        if (S[K.Q]) {
          S[K.Q] = 0;
          if (hypot(S[K.QX]! - bx, S[K.QY]! - by) < N.REACH + 4 || abs(S[K.QX]! - S[K.X]!) < 30 && S[K.QY]! > S[K.Y]! - 40) (S[K.PX] = S[K.QX]!), (S[K.PY] = S[K.QY]!), scratch(0.14);
          else {
            // Somewhere else: if it's a letter, it hops; and he asks again.
            const i = page.near(S[K.QX]!, S[K.QY]!, 1);
            if (i >= 0) page.bump(i, -110);
            say(3);
          }
        }
        if (S[K.SCR]! > 0) {
          S[K.SCR] = S[K.SCR]! - dt;
          S[K.KICK] = S[K.KICK]! + (12 + 16 * S[K.JOY]!) * dt;
          S[K.WIG] = S[K.WIG]! + 12 * dt;
          if (rnd() < dt * (2 + 8 * S[K.JOY]!)) bits.add(HEART, bx + (rnd() - 0.5) * 20, by - 8, (rnd() - 0.5) * 30, -30 - rnd() * 25, 0.9);
          busy = true;
        } else if ((S[K.LAST] = S[K.LAST]! + dt) > 0.35 && S[K.JOY]! > 0) S[K.JOY] = max(0, S[K.JOY]! - 0.16 * dt);
        if (S[K.JOY]! > 0.85 && S[K.BUB] !== 1 && S[K.BT]! > 1.6) say(1);
        // Joy lifts him: past 0.4 he floats off the rug; his paws boop the letters above.
        const lift = clamp((S[K.JOY]! - 0.4) / 0.55, 0, 1) * 32;
        S[K.FLOAT] = S[K.FLOAT]! + (lift - S[K.FLOAT]!) * min(1, dt * 3);
        if (S[K.FLOAT]! < 0.05 && lift === 0) S[K.FLOAT] = 0;
        if (S[K.FLOAT]! > 6) {
          if (rnd() < dt * 14) bits.add(SPARK, S[K.X]! + (rnd() - 0.5) * 30, N.UPY - S[K.FLOAT]! + 14, (rnd() - 0.5) * 10, 20 + rnd() * 20, 0.5);
          pose(time);
          for (let k = 0; k < 4; k++) {
            const hx = (k & 1 ? 7 : -7) + (k > 1 ? 0.5 * (k & 1 ? 1 : -1) : 0), a = pup.leg[k]!;
            pupAt(pup, hx + sin(a) * 8.5 * pup.len, 3 + cos(a) * 8.5 * pup.len + 2, at);
            const i = page.near(at[0]!, at[1]!, 2);
            if (i >= 0) page.bump(i, -55 - S[K.FLOAT]!);
          }
        }
        if (S[K.JOY]! >= 1) {
          // Too much: ZOOMIES.
          S[K.Y] = N.UPY - S[K.FLOAT]!;
          S[K.FLOAT] = 0;
          to(M.FLIP);
          yellAt(0, S[K.X]!, S[K.Y]! - 50);
          S[K.VX] = S[K.X]! < N.HOMEX ? 170 : -170;
          S[K.VY] = -150;
        }
      } else if (m === M.FLIP) {
        S[K.Y] = S[K.Y]! - 60 * dt;
        if (t > 0.32) to(M.ZOOM), (S[K.ZT] = 0), (S[K.AIM] = 0);
      } else if (m === M.ZOOM) {
        // Round the page: steer at a letter (or anywhere), bounce off the edges, knock what he hits.
        if ((S[K.AIM] = S[K.AIM]! - dt) <= 0) {
          S[K.AIM] = 0.35 + rnd() * 0.3;
          const i = (rnd() * page.n) | 0;
          if (t < 3.2 && page.M[i] === 0 && rnd() < 0.8) (S[K.AX] = page.EX[i]! + page.EW[i]! / 2), (S[K.AY] = page.EY[i]! + page.EH[i]! / 2);
          else (S[K.AX] = 20 + rnd() * 200), (S[K.AY] = t < 3.2 ? 20 + rnd() * 80 : N.FL);
        }
        let vx = S[K.VX]!, vy = S[K.VY]!;
        const sp = hypot(vx, vy) || 1, want = atan2(S[K.AY]! - S[K.Y]!, S[K.AX]! - S[K.X]!), now = atan2(vy, vx);
        let d = want - now;
        d = ((d + 3 * PI) % (2 * PI)) - PI;
        const a = now + clamp(d, -6 * dt, 6 * dt), v = sp + (200 - sp) * min(1, dt * 2);
        vx = cos(a) * v;
        vy = sin(a) * v;
        let x = S[K.X]! + vx * dt, y = S[K.Y]! + vy * dt;
        if (x < 36 && vx < 0) (vx = -vx), (x = 36);
        if (x > W - 36 && vx > 0) (vx = -vx), (x = W - 36);
        if (y < 34 && vy < 0) (vy = -vy), (y = 34);
        if (y > N.FL - 13) {
          y = N.FL - 13;
          if (t > 3.2) to(M.SKID), (vy = 0);
          else if (vy > 0) vy = -vy;
        }
        S[K.X] = x;
        S[K.Y] = y;
        S[K.VX] = vx;
        S[K.VY] = vy;
        S[K.RUN] = S[K.RUN]! + dt * 34;
        if (rnd() < dt * 40) bits.add(rnd() < 0.5 ? SPARK : DUST, x - vx * 0.08 + (rnd() - 0.5) * 6, y - vy * 0.08 + (rnd() - 0.5) * 6, -vx * 0.1, -vy * 0.1, 0.45);
        // What he hits: his body and his head.
        pose(time);
        for (let k = 0; k < 2; k++) {
          if (k) pupAt(pup, 17, -13, at);
          const hx = k ? at[0]! : x, hy = k ? at[1]! : y;
          for (let i = page.near(hx, hy, k ? 12 : 15); i >= 0; i = page.near(hx, hy, k ? 12 : 15)) {
            page.hit(i, vx * 0.9 + (rnd() - 0.5) * 60, vy * 0.6 - 90 - rnd() * 60);
            if (S[K.WT]! > (S[K.WORD] ? 0.5 : 0.9) && rnd() < 0.5) yellAt(1 + ((rnd() * 3) | 0), page.EX[i]! + page.EW[i]! / 2, page.EY[i]! - 6);
          }
        }
      } else if (m === M.SKID) {
        // Down on the floor, skidding to a stop in a cloud of dust.
        S[K.VX] = S[K.VX]! * (1 - 3.2 * dt);
        S[K.X] = clamp(S[K.X]! + S[K.VX]! * dt, 40, W - 40);
        S[K.Y] = S[K.Y]! + (N.LIEY - S[K.Y]!) * min(1, dt * 10);
        S[K.RUN] = S[K.RUN]! + dt * 10;
        if (rnd() < dt * 30) bits.add(DUST, S[K.X]! + (S[K.VX]! > 0 ? -12 : 12), N.FL - 2, -S[K.VX]! * 0.2, -10 - rnd() * 15, 0.6);
        if (abs(S[K.VX]!) < 12 || t > 1.2) to(M.TIRED), say(2), page.home(0.6);
      } else if (m === M.TIRED) {
        if (t > 2.2 && !page.out) abs(S[K.X]! - N.HOMEX) > 3 ? to(M.WALK) : (to(M.ROLL), say(4));
      } else if (m === M.WALK) {
        // Back to the rug, a trot, then over he goes again.
        const d = N.HOMEX - S[K.X]!;
        S[K.X] = S[K.X]! + clamp(d, -50 * dt, 50 * dt);
        S[K.Y] = N.STANDY;
        S[K.RUN] = S[K.RUN]! + dt * 13;
        if (abs(d) < 0.5) to(M.ROLL), say(4);
      }
      busy = page.step(dt) || busy;
      busy = bits.step(dt) || busy;
      if (S[K.WT]! < 1.2) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (S[K.BT]! < 1.8) (S[K.BT] = S[K.BT]! + dt), (busy = true);
      // The hand follows the pointer over his belly: a redraw, not motion.
      const hov = S[K.MODE] === M.BELLY && S[K.PIN]! > 0 && hypot(S[K.PX]! - S[K.PRX]!, S[K.PY]! - S[K.PRY]!) < N.REACH ? 1 : 0;
      if (hov || S[K.MOVED]! > 0 || hov !== S[K.HINT]) S[K.DIRTY] = 1;
      S[K.HINT] = hov;
      S[K.MOVED] = 0;
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render(e) {
      page.render(L);
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw(e.time);
    },
  });

  function draw(time: number) {
    g.clearRect(0, 0, W, H);
    const m = S[K.MODE]!;
    pose(time);
    // The HUD on the floor: JOY, in segments, coral to gold.
    print(g, "JOY", 4, N.FL + 8, P.cream);
    for (let i = 0; i < 10; i++) (g.fillStyle = i < S[K.JOY]! * 10 - 0.01 ? (i < 6 ? P.coral : P.gold) : P.tealD), g.fillRect(18 + i * 4, N.FL + 8, 3, 5);
    // His shadow on the rug: smaller the higher he is.
    const hgt = (S[K.MODE] === M.BELLY ? N.UPY : N.LIEY) - pup.y, sw = max(4, round(26 - hgt / 2.5));
    g.fillStyle = P.coralD;
    g.fillRect(round(pup.x) - sw, N.FL - 1, sw * 2, 2);
    bits.draw(g);
    drawPup(g, pup);
    // The hand: a glove scratching (fingers wiggle) wherever the pointer is on his belly.
    if (m === M.BELLY && (S[K.HINT] || S[K.SCR]! > 0)) {
      const hx = round(S[K.PX]!), hy = round(S[K.PY]!), w = round(sin(S[K.KICK]! * 2) * 1.5);
      for (let pass = 0; pass < 2; pass++) {
        const o = pass ? 0 : 1, c = pass ? P.white : P.rim;
        g.fillStyle = c;
        for (let f = -1; f <= 1; f++) g.fillRect(hx + f * 3 - 1 - o, hy - 1 + (f & 1 ? w : -w) - o, 2 + 2 * o, 6 + 2 * o);
        g.fillRect(hx - 4 - o, hy - 6 - o, 9 + 2 * o, 6 + 2 * o);
      }
      g.fillStyle = P.rim;
      g.fillRect(hx - 2, hy - 3, 1, 3), g.fillRect(hx + 1, hy - 3, 1, 3);
    }
    // His speech, over his head.
    if (S[K.BT]! < 1.6) {
      pupAt(pup, 14, -26, at);
      bubble(g, BUBBLES[S[K.BUB]!]!, m === M.BELLY ? pup.x - 18 : at[0]!, m === M.BELLY ? pup.y - 30 : at[1]!);
    }
    if (S[K.WT]! < 1.1) {
      const k = S[K.WORD] === 0 ? 3 : 2;
      yell(g, WORDS[S[K.WORD]!]!, S[K.BX]!, clamp(S[K.BY]!, 6, N.FL - 20) - (S[K.WT]! < 0.06 ? 2 : 0), k);
    }
  }

  engine.start();
  return {
    engine,
    tap,
    get joy() {
      return S[K.JOY]!;
    },
    get mode() {
      return S[K.MODE]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): belly up, asking (scripts/gallery-posters.mjs). */
export const posterAt = 1.4;

/** For `slot(fig, () => import("./space-pup-belly-rub-zoomies").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bellyRub(stage, slot, first);
