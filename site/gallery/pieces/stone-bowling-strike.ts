// "Stone strike": league night at Rubbleton Lanes. The ten pins are the page's own words, set up in
// a triangle at the end of a plank lane (ROCK AND BOWL NIGHT / TEN PIN FUN / ALL WEEK / LONG). Opal
// Cobbleworth, the league champ, twirls on tiptoe and rolls a stone ball where you click: it hits
// the words, they scatter, spin and knock each other over, bounce off the gutter walls and pile
// into the pit. All ten is a STRIKE (stars, she jumps, the stone scoreboard counts it). Click twice
// while she twirls and she throws the twister: a faster ball that hooks into the pocket. Roll it
// wide and it drops in the gutter. Then Flap, the pinsetter pterosaur, sweeps over and the words
// slide back into place.
// Bricks: the kernel (fixed step; settle: it sleeps once the pins are set; its ledger for every
// page write, the score included, so Recall gives the page back byte for byte). The look, the
// bodies and the words are shared with the rest of the series (stone-age.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { CORAL, FACE, GLUM, HAT, HOME, INK, LOOSE, PLUM, RED, SHOUT, SKIN, STONE, STONE_D, TUNIC, W, WHITE, bits, bodies, bonk, dot, ink, limb, oval, pip, rock, taps, view, words } from "./stone-age";

export type BowlScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly down: number; readonly strikes: number; readonly rolls: number };

const { abs, cos, sin, max, min, hypot, sign, PI } = Math;
// The lane (art units): its walls, the pit at the top, where the ball leaves Opal's hand.
const LX0 = 198, LX1 = 442, PIT = 18, BX0 = 320, BY0 = 300, BR = 13, PR = 17;
// Opal's turn: waiting, twirling, the roll, the pins settling, the pinsetter.
const WAIT = 0, TWIRL = 1, ROLL = 2, SETTLE = 3, RESET = 4;
const WORDS = ["STRIKE!", "GUTTER!", "CRASH!", "CLONK!", "NICE!", "TWISTER!", "MISS!"];
const NUM = Array.from({ length: 100 }, (_, i) => String(i));

export function bowl(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BowlScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 10 });
  const rnd = engine.random, v = view(engine, stage), g = v.g, L = engine.ledger;
  const wrap = slot.querySelector<HTMLElement>(".sb2")!, els = [...wrap.querySelectorAll<HTMLElement>(".sb2-p")];
  const scoreEl = wrap.querySelector<HTMLElement>(".sb2-n")!, scoreNode = scoreEl.firstChild as Text;
  const pg = bodies(engine, wrap, els), B = pg.B, n = pg.n;
  const fx = bits(rnd), say = words(WORDS);
  const S = {
    mode: WAIT, t: 0, now: 0, ax: 320, ay: 60, twist: 0, bx: BX0, by: BY0, vx: 0, vy: 0, spin: 0, roll: 0, gut: 0, hook: 0, on: 0,
    strikes: 0, rolls: 0, cheer: 0, sad: 0, quiet: 0, fly: -1, auto: first ? 0 : 0.6, queued: 0, qx: 0, qy: 0, hit: 0, shown: 0,
  };
  const DOWN = new Uint8Array(n);

  const tap = (x: number, y: number) => {
    if (S.mode === TWIRL && S.t < 0.42 && !S.twist) return void ((S.twist = 1), say.say(5, 320, 250, 20, -0.08));
    if (S.mode !== WAIT) return void ((S.queued = 1), (S.qx = x), (S.qy = y));
    S.mode = TWIRL;
    S.t = 0;
    S.twist = 0;
    S.ax = max(LX0 - 30, min(LX1 + 30, x));
    S.ay = min(y, 220);
  };
  taps(engine, stage, first, tap);

  /** The ball leaves her hand for the aim point; a twister hooks back toward the head pin. */
  function release() {
    const dx = S.ax - BX0, dy = S.ay - BY0, d = hypot(dx, dy) || 1, sp = S.twist ? 640 : 500;
    S.on = 1;
    S.bx = BX0;
    S.by = BY0;
    S.vx = (dx / d) * sp;
    S.vy = (dy / d) * sp;
    // The twister swings out and hooks back: it meets the aim line again at the head pin's row.
    const k = sign(dx || 1) * 170, tt = (BY0 - 140) / abs(S.vy || 1);
    S.hook = S.twist ? (-2 * k) / tt : 0;
    if (S.twist) S.vx += k;
    S.gut = 0;
    S.hit = 0;
    S.mode = ROLL;
    S.t = 0;
    S.rolls++;
  }

  /** Every pin that's down goes home as Flap passes over it. */
  function reset() {
    S.mode = RESET;
    S.t = 0;
    S.fly = 0;
    for (let i = 0; i < n; i++) {
      const b = B[i]!;
      if (b.md === LOOSE) b.rest = 1; // stop sliding; it's going home
      pg.home(i, 0.25 + (W - (b.x + b.dx)) * 0.0022);
    }
  }

  function count() {
    let k = 0;
    for (let i = 0; i < n; i++) if (DOWN[i]) k++;
    return k;
  }

  /** A pin is knocked: it slides off with (vx, vy) and spins; once it's moved far, it's down. */
  function knock(i: number, vx: number, vy: number) {
    const b = B[i]!;
    if (b.md === HOME) pg.loosen(i, 0, 0, 0);
    b.rest = 0;
    b.vx += vx;
    b.vy += vy;
    b.vr += (rnd() - 0.5) * 900 + vx * 1.5;
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
        if ((S.auto -= dt) <= 0) tap(326, 60);
      }
      if (S.mode !== WAIT) busy = true;
      if (S.mode === TWIRL && S.t > (S.twist ? 0.95 : 0.6)) release();
      // The ball: rolls, hooks, finds the gutter or the pins, and drops into the pit.
      if (S.on) {
        busy = true;
        if (!S.gut) S.vx += S.hook * dt;
        S.bx += S.vx * dt;
        S.by += S.vy * dt;
        S.roll += hypot(S.vx, S.vy) * dt;
        if (!S.gut && (S.bx < LX0 + 6 || S.bx > LX1 - 6) && S.by > 90) {
          // Into the gutter: it runs along the channel to the pit.
          S.gut = 1;
          S.bx = S.bx < 320 ? LX0 - 9 : LX1 + 9;
          S.vx = 0;
          S.vy = -460;
          say.say(1, S.bx < 320 ? 120 : 520, 200, 22, S.bx < 320 ? -0.12 : 0.12);
          S.sad = 1.4;
        }
        if (!S.gut) {
          // On the pin deck the walls hold it in.
          if (S.by <= 90 && S.bx < LX0 + BR) (S.bx = LX0 + BR), (S.vx = abs(S.vx) * 0.5);
          if (S.by <= 90 && S.bx > LX1 - BR) (S.bx = LX1 - BR), (S.vx = -abs(S.vx) * 0.5);
          for (let i = 0; i < n; i++) {
            const dx = pg.cx(i) - S.bx, dy = pg.cy(i) - S.by, d = hypot(dx, dy);
            if (d >= BR + PR || d < 0.01) continue;
            const nx = dx / d, ny = dy / d, b = B[i]!, rv = (S.vx - b.vx) * nx + (S.vy - b.vy) * ny;
            b.dx += nx * (BR + PR - d);
            b.dy += ny * (BR + PR - d);
            if (rv <= 0) continue;
            // The ball is four pins heavy: it keeps most of its way.
            const kk = S.twist ? 1.7 : 1.35, keep = S.twist ? 0.2 : 0.75;
            knock(i, nx * rv * kk, ny * rv * kk);
            S.vx -= nx * rv * keep;
            S.vy = min(-160, S.vy - ny * rv * keep); // a stone ball always rolls on into the pit
            if (!S.hit) (S.hit = 1), say.say(2, S.bx, S.by - 30, 24, (rnd() - 0.5) * 0.3), fx.puff(S.bx, S.by - BR, 5, 60, 8);
          }
        }
        if (S.by < PIT - BR || S.bx < -20 || S.bx > W + 20) (S.on = 0), (S.mode = SETTLE), (S.t = 0), (S.quiet = 0);
      }
      // The pins: each other and the walls (the pit stops them dead).
      for (let i = 0; i < n; i++) {
        const a = B[i]!;
        if (a.md !== LOOSE || a.rest) continue;
        const ax = pg.cx(i), ay = pg.cy(i);
        for (let j = 0; j < n; j++) {
          const b = B[j]!;
          if (j === i || b.md === 2) continue;
          const dx = pg.cx(j) - ax, dy = pg.cy(j) - ay, d = hypot(dx, dy);
          if (d >= PR * 2 || d < 0.01) continue;
          const nx = dx / d, ny = dy / d, rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          a.dx -= nx * (PR * 2 - d) * 0.5;
          a.dy -= ny * (PR * 2 - d) * 0.5;
          b.dx += nx * (PR * 2 - d) * 0.5;
          b.dy += ny * (PR * 2 - d) * 0.5;
          if (rv <= 0) continue;
          knock(j, nx * rv * 1.05, ny * rv * 1.05);
          a.vx -= nx * rv * 0.8;
          a.vy -= ny * rv * 0.8;
          if (rv > 160 && rnd() < 0.3) say.say(3, (ax + pg.cx(j)) / 2, ay - 18, 14, (rnd() - 0.5) * 0.4);
        }
        const x = pg.cx(i), y = pg.cy(i);
        if (x < LX0 + PR) (a.dx += LX0 + PR - x), (a.vx = abs(a.vx) * 0.45);
        if (x > LX1 - PR) (a.dx -= x - LX1 + PR), (a.vx = -abs(a.vx) * 0.45);
        if (y < PIT) (a.dy += PIT - y), (a.vy = abs(a.vy) * 0.1), (a.vx *= 0.3), (a.vr *= 0.3);
        if (y > 330) (a.dy -= y - 330), (a.vy = -abs(a.vy) * 0.4);
      }
      // Loose pins slide and spin to a stop (friction, plus a little drag that ends it).
      for (let i = 0; i < n; i++) {
        const b = B[i]!;
        if (b.md !== LOOSE || b.rest) continue;
        const f = max(0, 1 - 1.6 * dt - (110 * dt) / (hypot(b.vx, b.vy) || 1));
        b.vx *= f;
        b.vy *= f;
        b.vr *= max(0, 1 - 2.4 * dt - (150 * dt) / (abs(b.vr) || 1));
        b.dx += b.vx * dt;
        b.dy += b.vy * dt;
        b.r += b.vr * dt;
        if (abs(b.vx) + abs(b.vy) < 3 && abs(b.vr) < 8) (b.vx = b.vy = b.vr = 0), (b.rest = 1);
        busy = true;
      }
      if (pg.step(dt, 0)) busy = true;
      for (let i = 0; i < n; i++) {
        const b = B[i]!, d = b.md === LOOSE && (abs(b.dx) + abs(b.dy) > 7 || abs(b.r) > 35) ? 1 : 0;
        if (d !== DOWN[i]) (DOWN[i] = d), (b.crack = d);
      }
      // Once all is still: the verdict, then the pinsetter.
      if (S.mode === SETTLE) {
        let moving = 0;
        for (let i = 0; i < n; i++) if (B[i]!.md === LOOSE && !B[i]!.rest) moving = 1;
        if (!moving && (S.quiet += dt) > 0.45 && !S.shown) {
          S.shown = 1;
          const k = count();
          if (k === n) S.strikes++, say.say(0, 320, 150, 40, -0.08), (S.cheer = 1.6), fx.add(2, 320, 90, 0, -30, 12, 1.2), fx.add(2, 270, 120, -40, -20, 9, 1), fx.add(2, 370, 120, 40, -20, 9, 1);
          else if (!k) say.say(6, 320, 150, 26);
          else say.say(4, 320, 150, 26), (S.cheer = 0.8);
        }
        if (S.shown && S.quiet > 1.7) reset();
      }
      if (S.mode === RESET) {
        S.fly = S.t / 1.6;
        let out = 0;
        for (let i = 0; i < n; i++) if (B[i]!.md !== HOME) out = 1;
        if (S.fly >= 1 && !out) (S.mode = WAIT), (S.fly = -1), (S.shown = 0);
      }
      if (S.mode === WAIT && S.queued) (S.queued = 0), tap(S.qx, S.qy);
      if (fx.step(dt, 0)) busy = true;
      if (say.step(dt)) busy = true;
      if (S.cheer > 0) (S.cheer -= dt), (busy = true);
      if (S.sad > 0) (S.sad -= dt), (busy = true);
      if (busy) e.busy();
    },
    render() {
      pg.render();
      L.text(scoreNode, NUM[min(99, S.strikes)]!);
      v.clear(0, 0);
      draw();
    },
  });

  function draw() {
    // The ball (under Opal's hand until she lets go).
    if (S.on) {
      const s = S.gut ? 0.85 : 1;
      dot(g, S.bx + 3, S.by + 4, BR * s, "rgba(42,26,14,.25)");
      ball(S.bx, S.by, BR * s, S.roll / BR);
    }
    // The family on the bench (the bench and the ball rack are the stage's SVG): they cheer a
    // strike and groan at the gutter.
    const up = S.cheer > 0, oof = S.sad > 0, hop = up ? abs(sin(S.cheer * 10)) * 6 : 0;
    bonk(g, 548, 278 - hop * 0.5, up ? SHOUT : oof ? GLUM : FACE, up ? -14 : oof ? 2 : -8, up ? -22 : -14, up ? 14 : 9, up ? -22 : 18, S.now);
    pip(g, 588, 290 - hop, up);
    opal();
    flap();
    fx.draw(g);
    say.draw(g);
  }

  function ball(x: number, y: number, r: number, a: number) {
    rock(g, x, y, r, a * 0.3, 7, STONE_D);
    for (let k = 0; k < 3; k++) dot(g, x + cos(a + k * 0.5) * r * 0.45, y + sin(a + k * 0.5) * r * 0.45, r * 0.13, INK);
  }

  /** Opal: plum beehive with a bone through it, coral spotted dress; she twirls on tiptoe. */
  function opal() {
    const m = S.mode, t = S.t, x = 320, jump = S.cheer > 0 ? abs(sin(S.cheer * 9)) * 10 : 0;
    const twirl = m === TWIRL ? t * (S.twist ? 26 : 18) : 0, sx = m === TWIRL ? cos(twirl) : 1, tip = m === TWIRL ? 4 : 0;
    const y = 352 - jump - tip;
    g.save();
    g.translate(x, y);
    g.scale((abs(sx) < 0.15 ? 0.15 * sign(sx || 1) : sx) * 1.3, 1.3);
    // Legs on tiptoe, the dress, arms, head.
    for (let lx = -6; lx <= 6; lx += 12) (g.beginPath(), g.moveTo(lx, -14), g.lineTo(lx * (m === TWIRL ? 0.4 : 1), 0), limb(g, 4, SKIN));
    g.beginPath();
    g.moveTo(-16, -12);
    for (let i = 0; i <= 6; i++) g.lineTo(-16 + i * 5.3, -12 + (i & 1) * 5);
    g.lineTo(9, -42);
    g.lineTo(-9, -42);
    g.closePath();
    ink(g, CORAL);
    for (let k = 0; k < 4; k++) dot(g, k & 1 ? 6 : -7, -36 + k * 5, 2.2, RED);
    const throwing = m === ROLL && t < 0.3, up = S.cheer > 0;
    g.beginPath();
    g.moveTo(-8, -38);
    g.lineTo(up ? -18 : -16, up ? -58 : -24);
    g.moveTo(8, -38);
    g.lineTo(up ? 18 : throwing ? 14 : 16, up ? -58 : throwing ? -56 : -26);
    limb(g, 4, SKIN);
    if (m === WAIT || m === TWIRL) ball(16, -24, BR / 1.3, 0.5);
    oval(g, 0, -50, 10, 10, SKIN);
    // The beehive and its bone.
    oval(g, 0, -70, 11, 16, PLUM);
    g.beginPath();
    g.moveTo(-15, -74);
    g.lineTo(15, -66);
    limb(g, 3, WHITE);
    oval(g, -15, -74, 3, 2.5, WHITE, 0, 1.4);
    oval(g, 15, -66, 3, 2.5, WHITE, 0, 1.4);
    const sad = S.sad > 0;
    for (let ex = -4; ex <= 4; ex += 8) sad ? (g.beginPath(), g.moveTo(ex - 2, -51), g.lineTo(ex + 2, -52), (g.lineWidth = 1.6), (g.strokeStyle = INK), g.stroke()) : dot(g, ex, -52, 1.7, INK);
    g.beginPath();
    sad ? g.arc(0, -42, 3, PI * 1.15, PI * 1.85) : g.arc(0, -47, 3.5, 0.2, PI - 0.2);
    g.lineWidth = 1.6;
    g.stroke();
    g.restore();
  }

  /** Flap the pinsetter: an orange pterosaur in a stone cap who sweeps across the pins. */
  function flap() {
    if (S.fly < 0) return;
    const u = S.fly, x = W + 60 - u * (W + 120), y = 70 + sin(u * PI * 2) * 12, w = sin(S.now * 20) * 14;
    g.save();
    g.translate(x, y);
    g.scale(1.6, 1.6);
    for (let s = -1; s <= 1; s += 2) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(14, s * 10 - w * s * 0.3, 34, s * (16 + w));
      g.lineTo(10, s * 4);
      g.closePath();
      ink(g, CORAL, 2);
    }
    oval(g, 0, 0, 13, 7, TUNIC);
    g.beginPath();
    g.moveTo(-10, -2);
    g.lineTo(-30, 2);
    g.lineTo(-10, 4);
    g.closePath();
    ink(g, HAT, 2);
    oval(g, -8, -3, 6, 6, TUNIC);
    g.beginPath();
    g.ellipse(-8, -7, 6, 4, 0, PI, 0);
    ink(g, STONE, 1.6);
    dot(g, -10, -3, 1.5, INK);
    g.restore();
  }

  engine.start();
  return {
    engine,
    tap: (x, y) => (tap(x, y), engine.wake()),
    get down() {
      return count();
    },
    get strikes() {
      return S.strikes;
    },
    get rolls() {
      return S.rolls;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the intro roll just into the pins. */
export const posterAt = 1.45;

/** For `slot(fig, () => import("./stone-bowling-strike").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bowl(stage, slot, first);
