// "Pie Slice" (thanksgiving, micro): a whole pie on the table, seen from above, a dollop of cream on
// it. Drag across it (or aim with ← → and press Space) to cut a straight line through the middle; the
// knife runs across and crumbs fly off the cut and skid to a stop against the dish's rim. After the
// round's cuts (2 cuts make 4 slices, then 3 make 6, then 4 make 8) the slices pull apart and their
// sizes go up on them: all about even and the stars come out, FAIR SHARES!; lopsided and a kid's
// hand comes in and grabs the biggest one: I CALL THAT ONE. A press brings the next pie.
// Bricks: the kernel (fixed step; settle; its ledger for the canvas and the play key, so Recall gives
// the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The game is `pie()`, plain numbers,
// no DOM (tests/pie-slice.test.mjs).
import { createEngine } from "../../../src/kernel/index";
import { seeded } from "../../../src/kernel/random";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

export const IDLE = 0, AIM = 1, CUT = 2, SPLIT = 3, DONE = 4;
/** The pie's radius, the dish's, crumbs at most, the cuts each round, the knife's run (s). */
export const R = 26, RIM = 32, NC = 90, ROUNDS = [2, 3, 4], KNIFE = 0.32;
/** Stars for how even the slices are (smallest over biggest). */
export const FAIR = [0.7, 0.85, 0.95];
export const EV_START = 0, EV_CUT = 1, EV_SPLIT = 2, EV_FAIR = 3, EV_GRAB = 4;
const TAU = 6.283185307179586;
// State slots.
const MODE = 0, T = 1, ROUND = 2, N = 3, AIMA = 4, STARS = 5, TOTAL = 6, BIG = 7, RATIO = 8, PIES = 9;

/** One table. */
export function pie(seed: number) {
  const rnd = seeded(seed), S = new Float64Array(12), ev = new Uint8Array(5);
  /** The cut lines (angles in [0, π)), the slices' start angles (sorted, both ends of every cut) and sizes (fractions). */
  const CUTS = new Float64Array(4), A = new Float64Array(8), SZ = new Float64Array(8);
  /** Crumbs: x, y, vx, vy, size, alive. */
  const CX = new Float64Array(NC), CY = new Float64Array(NC), CVX = new Float64Array(NC), CVY = new Float64Array(NC), CS = new Float64Array(NC), CA = new Uint8Array(NC);
  let ci = 0;
  const cuts = () => ROUNDS[S[ROUND]!]!;
  function reset(round: number) {
    S[MODE] = AIM;
    (S[ROUND] = round), (S[N] = 0), (S[T] = 0), (S[STARS] = 0), (S[BIG] = -1), (S[RATIO] = 0);
    S[AIMA] = 0.35 + rnd() * 0.3;
    CA.fill(0);
    S[PIES] = S[PIES]! + 1;
  }
  /** Begin, or after a round's result the next pie (the round after the last starts over). */
  function next() {
    ev.fill(0);
    const m = S[MODE]!;
    if (m === IDLE) (S[TOTAL] = 0), reset(0), (ev[EV_START] = 1);
    else if (m === DONE && S[T]! > 0.9) {
      const r = (S[ROUND]! + 1) % ROUNDS.length;
      if (!r) S[TOTAL] = 0;
      reset(r);
      ev[EV_START] = 1;
    } else return false;
    return true;
  }
  /** Cut through the middle at angle a (any; a line has two ends). */
  function cut(a: number) {
    ev.fill(0);
    if (S[MODE] !== AIM) return false;
    const n = S[N]!, l = ((a % Math.PI) + Math.PI) % Math.PI;
    CUTS[n] = l;
    S[N] = n + 1;
    S[AIMA] = l;
    (S[MODE] = CUT), (S[T] = 0), (ev[EV_CUT] = 1);
    return true;
  }
  /** The slices: start angles sorted, sizes, smallest over biggest, the biggest. */
  function measure() {
    const n = S[N]!;
    for (let i = 0; i < n; i++) (A[i] = CUTS[i]!), (A[i + n] = CUTS[i]! + Math.PI);
    // Insertion sort (2n ≤ 8).
    for (let i = 1; i < 2 * n; i++) {
      const v = A[i]!;
      let j = i - 1;
      for (; j >= 0 && A[j]! > v; j--) A[j + 1] = A[j]!;
      A[j + 1] = v;
    }
    let lo = 1, hi = 0, big = 0;
    for (let i = 0; i < 2 * n; i++) {
      const s = ((i + 1 < 2 * n ? A[i + 1]! : A[0]! + TAU) - A[i]!) / TAU;
      SZ[i] = s;
      if (s < lo) lo = s;
      if (s > hi) (hi = s), (big = i);
    }
    S[RATIO] = lo / hi;
    S[BIG] = big;
    let st = 0;
    for (const f of FAIR) if (S[RATIO]! >= f - 1e-9) st++;
    S[STARS] = st;
  }
  /** Crumbs off a cut where the knife is: they fly out sideways and skid; the dish's rim stops them. */
  function crumb(x: number, y: number, nx: number, ny: number) {
    const k = ci++ % NC, s = rnd() < 0.5 ? 1 : -1, v = 14 + rnd() * 26;
    (CX[k] = x), (CY[k] = y), (CVX[k] = nx * s * v + (rnd() - 0.5) * 10), (CVY[k] = ny * s * v + (rnd() - 0.5) * 10), (CS[k] = 0.5 + rnd() * 0.9), (CA[k] = 1);
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const m = S[MODE]!;
    let busy = m === CUT || m === SPLIT || (m === DONE && S[T]! < 2.4);
    if (m === CUT) {
      // The knife runs along the newest cut, end to end; crumbs come off behind it.
      const a = CUTS[S[N]! - 1]!, u = Math.min(1, S[T]! / KNIFE), c = Math.cos(a), s = Math.sin(a), d = (u * 2 - 1) * R;
      if (u < 1 && rnd() < 0.8) crumb(c * d, s * d, -s, c);
      if (u >= 1) {
        if (S[N]! >= cuts()) measure(), (S[MODE] = SPLIT), (ev[EV_SPLIT] = 1);
        else S[MODE] = AIM;
        S[T] = 0;
      }
    } else if (m === SPLIT && S[T]! > 0.75) {
      (S[MODE] = DONE), (S[T] = 0), (S[TOTAL] = S[TOTAL]! + S[STARS]!);
      ev[S[STARS]! >= 2 ? EV_FAIR : EV_GRAB] = 1;
    }
    for (let k = 0; k < NC; k++) {
      if (!CA[k]) continue;
      const f = Math.exp(-dt * 4.5);
      CVX[k] = CVX[k]! * f;
      CVY[k] = CVY[k]! * f;
      CX[k] = CX[k]! + CVX[k]! * dt;
      CY[k] = CY[k]! + CVY[k]! * dt;
      // The rim: a crumb that reaches it bounces back in, softly.
      // (Not Math.hypot: it boxes its arguments.)
      const r = Math.sqrt(CX[k]! * CX[k]! + CY[k]! * CY[k]!);
      if (r > RIM - 1.5) {
        const nx = CX[k]! / r, ny = CY[k]! / r, vn = CVX[k]! * nx + CVY[k]! * ny;
        (CX[k] = nx * (RIM - 1.5)), (CY[k] = ny * (RIM - 1.5));
        if (vn > 0) (CVX[k] = CVX[k]! - 1.5 * vn * nx), (CVY[k] = CVY[k]! - 1.5 * vn * ny);
      }
      if (Math.abs(CVX[k]!) + Math.abs(CVY[k]!) > 0.3) busy = true;
    }
    return busy;
  }
  S[MODE] = IDLE;
  S[AIMA] = 0.5;
  return { S, ev, CUTS, A, SZ, CX, CY, CS, CA, next, cut, step, measure, cuts };
}
export type Pie = ReturnType<typeof pie>;

export type PieScene = SlotScene & { engine: ReturnType<typeof createEngine>; game: Pie; poster(): void; readonly state: { mode: number; round: number; n: number; stars: number; total: number } };

// Palettes by role: table, table grain, dish, dish rim, crust, crust dark, filling, filling dark, cream, ink, gold, kid sleeve, skin, muted.
const LIGHT = ["#e6c49a", "#d8b083", "#f6fbff", "#cfe3ee", "#e7b36a", "#c98545", "#e0792f", "#c45f1e", "#fffaf1", "#1f2433", "#f2c450", "#5b6bbf", "#e0b28e", "#8a8fa3"];
const DARK = ["#4a3428", "#3f2c22", "#dfe7f0", "#aebfcc", "#d9a35c", "#b0743a", "#d06e28", "#a8521a", "#f4ede0", "#0c0e18", "#f2c450", "#4a58a8", "#c68b62", "#8a8fa3"];
const TABLE = 0, GRAIN = 1, DISH = 2, DRIM = 3, CRUST = 4, CRUST2 = 5, FILL = 6, FILL2 = 7, CREAM = 8, INK = 9, GOLD = 10, SLEEVE = 11, SKIN = 12;
const FONTS: string[] = [], FONT = (px: number) => FONTS[px * 10] || (FONTS[px * 10] = `900 ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`);
const PCT: string[] = Array.from({ length: 101 }, (_, i) => i + "%");

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): PieScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.setAttribute("aria-label", "Pie Slice: left and right arrows aim the knife, Space or Enter cuts through the middle; make every slice the same size (M mutes)");
  play.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;cursor:crosshair;touch-action:none;-webkit-tap-highlight-color:transparent;outline-offset:-4px";
  stage.append(canvas, play);
  const snd = sound(engine, { cues: { start: "ready", cut: "hit", split: "click", fair: "win", grab: "hurt" }, volume: 0.1 });
  const game = pie((engine.random() * 2147483647) | 0), S = game.S;
  // [0] measure, [1] theme, [2] poster resolution, [3] css aspect, [4] pressed, [5] drag x0, [6] y0, [7] aiming shown.
  const V = new Float64Array(8);
  V[0] = V[1] = 1;
  let col = DARK;
  /** Stage px to the world (the pie's middle at 0, 0; 100 tall). */
  const toW = (px: number, py: number, out: Float64Array) => {
    const r = stage.getBoundingClientRect(), k = r.height / 100;
    (out[0] = (px - r.width / 2) / k), (out[1] = (py - r.height / 2) / k - OY);
  };
  const P = new Float64Array(2);
  const act = () => {
    const ev = game.ev, em = engine.events;
    if (ev[EV_START]) em.emit("start");
    if (ev[EV_CUT]) em.emit("cut");
    engine.wake();
  };
  const go = () => (S[MODE] === IDLE || S[MODE] === DONE ? (game.next(), act(), true) : false);
  if (first) go();
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (c === "KeyM") return void (e.preventDefault(), (snd.on = !snd.on));
    if (c === "ArrowLeft" || c === "ArrowRight") {
      e.preventDefault();
      if (S[MODE] !== AIM) return;
      S[AIMA] = S[AIMA]! + (c === "ArrowLeft" ? -0.05 : 0.05);
      V[7] = 1;
      return void engine.wake();
    }
    if (c === "Space" || c === "Enter") e.preventDefault(), e.repeat || go() || (game.cut(S[AIMA]!), act());
  }, sig);
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    if (go()) return;
    if (S[MODE] !== AIM) return;
    play.setPointerCapture?.(e.pointerId);
    toW(e.offsetX, e.offsetY, P);
    (V[4] = 1), (V[5] = P[0]!), (V[6] = P[1]!), (V[7] = 1);
    S[AIMA] = Math.atan2(P[1]!, P[0]!);
    engine.wake();
  }, sig);
  play.addEventListener("pointermove", (e) => {
    if (!V[4] || !e.isPrimary) return;
    toW(e.offsetX, e.offsetY, P);
    const dx = P[0]! - V[5]!, dy = P[1]! - V[6]!;
    // A drag sets the line's direction; a press alone, the line from the middle to the press.
    S[AIMA] = dx * dx + dy * dy > 16 ? Math.atan2(dy, dx) : Math.atan2(P[1]!, P[0]!);
    engine.wake();
  }, sig);
  play.addEventListener("pointerup", (e) => {
    if (!V[4] || !e.isPrimary) return;
    V[4] = 0;
    game.cut(S[AIMA]!);
    act();
  }, sig);
  for (const t of ["pointercancel", "lostpointercapture"]) play.addEventListener(t, () => (V[4] = 0), sig);

  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  let OY = 6;

  engine.add({
    read() {
      if (V[1]) (V[1] = 0), (col = document.documentElement.dataset.theme === "light" ? LIGHT : DARK);
      if (!V[0]) return;
      V[0] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[3] = r.width / Math.max(1, r.height);
    },
    step(e, dt) {
      if (game.step(dt) || V[4]) e.busy();
      const ev = game.ev, em = e.events;
      if (ev[EV_SPLIT]) em.emit("split");
      if (ev[EV_FAIR]) em.emit("fair");
      if (ev[EV_GRAB]) em.emit("grab");
    },
    render() {
      const k = canvas.height / 100, vw = (canvas.width / k) / 2, tall = V[3]! < 1.1, m = S[MODE]!, t = S[T]!;
      g.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2 + OY * k);
      g.lineJoin = g.lineCap = "round";
      // The table: boards.
      g.fillStyle = col[TABLE]!;
      g.fillRect(-vw - 1, -60, vw * 2 + 2, 120);
      g.fillStyle = col[GRAIN]!;
      for (let y = -56; y < 60; y += 12) g.fillRect(-vw - 1, y, vw * 2 + 2, 0.7);
      // A napkin with a fork on it, and a cake server, either side (wide stages).
      if (!tall) {
        g.save();
        g.translate(-RIM - 18, 4);
        g.rotate(-0.08);
        g.fillStyle = col[INK]!;
        g.fillRect(-9, -15, 19, 31);
        g.fillStyle = col[SLEEVE]!;
        g.fillRect(-10, -16, 19, 31);
        g.fillStyle = "#dfe5ee";
        g.strokeStyle = col[INK]!;
        g.lineWidth = 0.6;
        g.beginPath();
        g.roundRect(-1.4, -6, 2.8, 22, 1.4);
        for (let i = 0; i < 4; i++) g.rect(-2.6 + i * 1.5, -14, 0.9, 9);
        g.fill();
        g.stroke();
        g.rotate(0.3);
        g.translate(RIM * 2 + 34, -12);
        g.beginPath();
        g.moveTo(-5, -8), g.lineTo(5, -8), g.lineTo(3, 6), g.lineTo(-3, 6);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = "#3d3428";
        g.fillRect(-1.5, 6, 3, 15);
        g.strokeRect(-1.5, 6, 3, 15);
        g.restore();
      }
      // The dish: a shadow, the glass rim, the bottom.
      disc(2, 3, RIM + 1, col[INK]!, 0.18);
      disc(0, 0, RIM, col[DRIM]!, 1);
      ring(0, 0, RIM, 0.7);
      disc(0, 0, RIM - 4, col[DISH]!, 1);
      ring(0, 0, RIM - 4, 0.5);
      const n = S[N]!, split = m === SPLIT || m === DONE;
      if (!split) {
        wedge(0, TAU, 0, 0);
        // Knife marks and the knife.
        g.strokeStyle = col[FILL2]!;
        g.lineWidth = 0.9;
        for (let i = 0; i < n; i++) {
          const a = game.CUTS[i]!, run = m === CUT && i === n - 1 ? Math.min(1, t / KNIFE) : 1, c = Math.cos(a), s = Math.sin(a);
          g.beginPath();
          g.moveTo(-c * R, -s * R);
          g.lineTo(c * R * (run * 2 - 1), s * R * (run * 2 - 1));
          g.stroke();
          if (run < 1) knife(c * R * (run * 2 - 1), s * R * (run * 2 - 1), a);
        }
      } else {
        // Pulled apart: each slice moves out along its middle; the kid's slice leaves with the hand.
        const u = Math.min(1, m === SPLIT ? t / 0.5 : 1), e = u * u * (3 - 2 * u), big = S[BIG]!, grab = m === DONE && S[STARS]! < 2;
        for (let i = 0; i < n * 2; i++) {
          const a0 = game.A[i]!, a1 = a0 + game.SZ[i]! * TAU, mid = (a0 + a1) / 2;
          let ox = Math.cos(mid) * 3.4 * e, oy = Math.sin(mid) * 3.4 * e;
          if (grab && i === big) {
            const p = handPull(t);
            (ox += p * HX), (oy += p * HY);
          }
          wedge(a0, a1, ox, oy);
          if (u > 0.6 && !(grab && i === big && t > 0.6)) {
            const r = R * 0.62, f = Math.min(1, (u - 0.6) / 0.3);
            g.globalAlpha = f;
            label(PCT[Math.round(game.SZ[i]! * 100)]!, Math.cos(mid) * r + ox, Math.sin(mid) * r + oy, i === big && S[STARS]! < 3 ? col[GOLD]! : col[CREAM]!);
            g.globalAlpha = 1;
          }
        }
        if (grab) hand(t, big);
      }
      // Crumbs.
      g.fillStyle = col[CRUST]!;
      for (let i = 0; i < 90; i++) if (game.CA[i]) g.fillRect(game.CX[i]! - game.CS[i]! / 2, game.CY[i]! - game.CS[i]! / 2, game.CS[i]!, game.CS[i]!);
      // The aim: a dashed line through the middle while you line it up.
      if (m === AIM && (V[7] || V[4])) {
        const a = S[AIMA]!, c = Math.cos(a), s = Math.sin(a);
        g.setLineDash([2.4, 2]);
        g.lineWidth = 0.9;
        g.strokeStyle = col[INK]!;
        g.beginPath();
        g.moveTo(-c * (R + 4), -s * (R + 4));
        g.lineTo(c * (R + 4), s * (R + 4));
        g.stroke();
        g.setLineDash([]);
        knife(c * (R + 4), s * (R + 4), a);
      }
      // Stage space: the cuts left, the stars, the words.
      const sk = canvas.height / 100;
      g.setTransform(sk, 0, 0, sk, 0, 0);
      const W2 = V[3]! * 100, cx = W2 / 2, small = W2 < 120;
      if (m !== IDLE && !(small && m === DONE)) {
        chip(3, 3, small ? "CUTS" : "CUTS LEFT", "" + Math.max(0, game.cuts() - n));
        chip(3, 12.5, "STARS", "" + S[TOTAL]);
      }
      if (m === IDLE) {
        caption("PIE SLICE", cx, 13, Math.min(10, W2 / 7), col[CREAM]!);
        caption("DRAG ACROSS THE PIE TO CUT · MAKE IT FAIR", cx, 95, small ? 3.2 : 4, col[GOLD]!);
      } else if (m === AIM && !n) caption(`${game.cuts()} CUTS · ${game.cuts() * 2} EQUAL SLICES`, cx, 95, small ? 3.4 : 4.2, col[GOLD]!);
      else if (m === DONE) {
        const st = S[STARS]!, pop = Math.min(1, t / 0.2);
        if (st >= 2) {
          for (let i = 0; i < 3; i++) star(cx + (i - 1) * 10, 7 - (i === 1 ? 1.5 : 0), i < st, t - i * 0.12);
          caption(st === 3 ? "FAIR SHARES!" : "FAIR ENOUGH!", cx, 18, Math.min(8, W2 / 11) * (0.7 + pop * 0.3), col[GOLD]!);
        } else if (t > 0.55) bubble("I CALL THAT ONE!", t);
        if (t > 0.9) caption(S[ROUND]! === ROUNDS.length - 1 ? `${S[TOTAL]} OF 9 STARS · TAP TO GO AGAIN` : "TAP FOR THE NEXT PIE", cx, 95, small ? 3.2 : 4, col[CREAM]!);
      }
    },
  });
  /** The pie wedge from a0 to a1 (radians; a whole pie is 0..τ), moved by (ox, oy). */
  function wedge(a0: number, a1: number, ox: number, oy: number) {
    const whole = a1 - a0 > 6.28;
    g.save();
    g.translate(ox, oy);
    disc(1.2, 1.6, R + 0.4, col[INK]!, 0.22, a0, a1, whole);
    g.beginPath();
    if (!whole) g.moveTo(0, 0);
    g.arc(0, 0, R, a0, a1);
    g.closePath();
    g.fillStyle = col[CRUST]!;
    g.fill();
    g.save();
    g.clip();
    // The filling, a little darker at the edge, a shine, the cream.
    disc(0, 0, R - 3.6, col[FILL2]!, 1);
    disc(0, 0, R - 4.6, col[FILL]!, 1);
    disc(-8, -7, 7, col[CREAM]!, 0.16);
    // The crimped edge: a scallop of little bumps.
    g.fillStyle = col[CRUST2]!;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      g.beginPath();
      g.ellipse(Math.cos(a) * (R - 1.6), Math.sin(a) * (R - 1.6), 1.7, 0.8, a, 0, TAU);
      g.fill();
    }
    // The cream: a piped dollop off the middle, three tiers and a peak, its shadow on the filling.
    disc(6.6, -3.4, 5.6, col[FILL2]!, 0.5);
    g.strokeStyle = col[DRIM]!;
    g.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      disc(5.6 + i * 0.25, -5 - i * 0.9, 5.4 - i * 1.4, col[CREAM]!, 1);
      g.beginPath();
      g.arc(5.6 + i * 0.25, -5 - i * 0.9, 5.4 - i * 1.4, 0.3, 2.9);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    g.beginPath();
    if (!whole) g.moveTo(0, 0);
    g.arc(0, 0, R, a0, a1);
    g.closePath();
    g.stroke();
    g.restore();
  }
  function disc(x: number, y: number, r: number, c: string, a: number, a0 = 0, a1 = TAU, whole = true) {
    g.globalAlpha = a;
    g.fillStyle = c;
    g.beginPath();
    if (!whole) g.moveTo(x, y);
    g.arc(x, y, r, a0, a1);
    g.fill();
    g.globalAlpha = 1;
  }
  function ring(x: number, y: number, r: number, w: number) {
    g.strokeStyle = col[INK]!;
    g.lineWidth = w;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
  }
  /** A knife at (x, y), its blade along a: a steel blade, a dark handle. */
  function knife(x: number, y: number, a: number) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.fillStyle = "#dfe5ee";
    g.beginPath();
    g.moveTo(1.5, -2.2), g.lineTo(-11, -2.2), g.quadraticCurveTo(-14, 0, -16, 1.2), g.lineTo(1.5, 1.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#3d3428";
    g.fillRect(1.5, -2, 9, 3);
    g.strokeRect(1.5, -2, 9, 3);
    g.restore();
  }
  // The kid's hand: from the nearest edge to the big slice, a grab, and back out with it.
  let HX = 0, HY = 0;
  /** How far the slice has gone with the hand (world units, along HX, HY). */
  const handPull = (t: number) => (t < 0.55 ? 0 : (t - 0.55) ** 2 * 140);
  function hand(t: number, big: number) {
    const mid = game.A[big]! + game.SZ[big]! * Math.PI, c = Math.cos(mid), s = Math.sin(mid);
    (HX = c), (HY = s);
    // In from far out along the slice's middle, to its middle, then away with it.
    const reach = t < 0.4 ? 1 - t / 0.4 : 0, d = R * 0.55 + 3.4 + reach * 60 + handPull(t);
    const x = c * d, y = s * d, shut = t > 0.5;
    g.save();
    g.translate(x, y);
    g.rotate(mid);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    // The sleeve, back out of the frame; the cuff; the hand: a palm and four fingers (curled when it grabs).
    g.fillStyle = col[SLEEVE]!;
    g.fillRect(7, -5, 90, 10);
    g.strokeRect(7, -5, 90, 10);
    g.fillStyle = col[CREAM]!;
    g.fillRect(6, -5.4, 3, 10.8);
    g.strokeRect(6, -5.4, 3, 10.8);
    g.fillStyle = col[SKIN]!;
    g.beginPath();
    g.ellipse(2, 0, 5, 4.6, 0, 0, TAU);
    g.fill();
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const fy = -3.3 + i * 2.2, len = shut ? 3 : 5.5;
      g.beginPath();
      g.ellipse(-2.5 - len / 2 + 1, fy, len / 2 + 0.6, 0.95, 0, 0, TAU);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.ellipse(1, shut ? -4.5 : -5.6, 2.6, 1.1, shut ? -0.5 : -0.9, 0, TAU);
    g.fill();
    g.stroke();
    g.restore();
  }
  function label(s: string, x: number, y: number, c: string) {
    g.font = FONT(4.2);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 1.5;
    g.strokeStyle = col[INK]!;
    g.strokeText(s, x, y);
    g.fillStyle = c;
    g.fillText(s, x, y);
  }
  function bubble(s: string, t: number) {
    const W2 = V[3]! * 100, px = Math.min(5.5, W2 / 15), u = Math.min(1, (t - 0.55) / 0.15);
    g.font = FONT(px);
    const w = g.measureText(s).width + px * 1.6, h = px * 2.1, x = W2 / 2 - w / 2, y = 4;
    g.save();
    g.translate(W2 / 2, y + h / 2);
    g.scale(0.6 + u * 0.4, 0.6 + u * 0.4);
    g.rotate(-0.04);
    g.translate(-W2 / 2, -y - h / 2);
    g.fillStyle = col[INK]!;
    g.fillRect(x + 1, y + 1, w, h);
    g.fillStyle = "#fffaf1";
    g.fillRect(x, y, w, h);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.strokeRect(x, y, w, h);
    g.fillStyle = "#1f2433";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(s, W2 / 2, y + h / 2 + 0.3);
    g.restore();
  }
  function star(x: number, y: number, on: boolean, t: number) {
    const s = t < 0 ? 0 : t < 0.18 ? (t / 0.18) * 1.3 : t < 0.3 ? 1.3 - ((t - 0.18) / 0.12) * 0.3 : 1;
    if (!s) return;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i & 1 ? 1.9 : 4.3) * s, an = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
    }
    g.closePath();
    g.fillStyle = on ? col[GOLD]! : col[DRIM]!;
    g.fill();
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    g.stroke();
  }
  function caption(s: string, x: number, y: number, size: number, fill: string) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = FONT(Math.round(size * 10) / 10);
    g.lineWidth = size / 3;
    g.strokeStyle = col[INK]!;
    g.strokeText(s, x, y);
    g.fillStyle = fill;
    g.fillText(s, x, y);
  }
  function chip(x: number, y: number, label: string, v: string) {
    g.font = FONT(3);
    const w = 7 + g.measureText(label).width + 2 + v.length * 4.4;
    g.fillStyle = col[INK]!;
    g.fillRect(x + 0.8, y + 0.8, w, 8);
    g.fillStyle = "#fffaf1";
    g.fillRect(x, y, w, 8);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.6;
    g.strokeRect(x, y, w, 8);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = "#1f2433";
    g.fillText(label, x + 2.4, y + 4.3);
    g.font = FONT(6);
    g.lineWidth = 1.2;
    g.fillStyle = col[GOLD]!;
    g.strokeText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
    g.fillText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
  }

  engine.start();
  return {
    engine,
    accessible: true,
    game,
    get state() {
      return { mode: S[MODE]!, round: S[ROUND]!, n: S[N]!, stars: S[STARS]!, total: S[TOTAL]! };
    },
    // The poster: the last pie (four cuts), two made, the knife half way through the third.
    poster: () => {
      (V[2] = 0.6), (V[0] = 1);
      game.next();
      game.S[ROUND] = 2;
      for (const a of [0.2, 1.0]) game.cut(a), game.step(KNIFE + 0.01);
      game.cut(1.8);
    },
    destroy: () => engine.destroy(),
  };
}
/** The poster (scripts/gallery-posters.mjs): see `poster()`. */
export const posterAt = 0.17;
