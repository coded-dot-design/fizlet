// Arcade: the same 2015 sheets and frames, ×100 alive. Every hit scores, chains a combo and kicks
// the column (never the page); the art stays Chris Cooley's 2015 frames, the life comes from bricks.
// - Headphones: hit the cups and they squash and bounce, the bass thumps (fizlet/sound), ♪ ♫ burst
//   out (fizlet/fx) and the phone's equalizer jumps; play/pause runs the 2015 loop, notes ride it.
// - Coffee: the pour streams in and splashes, steam curls off the full cup, a sip slurps and the cup
//   wobbles; pour and sip turn back from the frame they are on.
// - Laptop: the lid slams open with a clack; then every press of the keys clicks, sprays code and
//   lights the screen, and the code scrolls on; the screen's close button slams it shut.
// - The column: score, combo and best on a HUD (fizlet/hud), a mute key, a shake on the stage only.
// - The contract: real buttons with names (keyboard works), reduced motion lands on still frames
//   with no particles, squash or shake (sound only on an explicit press, and the mute key), every
//   engine settles to 0 rAF/s when nothing moves, and destroy() gives the page back (the ledger).
import { strip, type Clip, type Seg, type Strip } from "./strip";
import { effects, emitter, type Effects } from "../../../src/fx";
import { sound, type Cue } from "../../../src/sound";
import { hud } from "../../../src/hud";
import { createEngine } from "../../../src/kernel/index";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const go = (a: number, b: number, perFrame: number): Seg => ({ a, b, n: Math.abs(b - a), d: Math.abs(b - a) * perFrame });
// Visual randomness without garbage: a private LCG (Math.random returns a fresh heap number per call).
const seed = new Uint32Array([Math.random() * 4294967296]);
const rnd = () => ((seed[0] = Math.imul(seed[0]!, 1664525) + 1013904223), seed[0]! / 4294967296);
/** Style strings for a quantized value, made once each (a frame of squash or shake writes one it has). */
const memo = (f: (q: number) => string) => {
  const m = new Map<number, string>();
  return (q: number) => m.get(q) ?? (m.set(q, f(q)), m.get(q)!);
};
const SHAKE = memo((q) => ((q >> 5) - 16) + "px " + ((q & 31) - 16) + "px");
const SQUASH = memo((q) => (1 + q * 0.0055).toFixed(3) + " " + (1 - q / 100).toFixed(2));
const WOBBLE = memo((q) => q * 0.2 + "deg");
// Colours: the 2015 palette (cream, coral, red) plus a warning yellow for combo words.
const COLORS = ["#F4F2DB", "#E15E49", "#ba341f", "#ffd400", "#11312c", "#7fe7d6"];
const CREAM = 0, CORAL = 1, YELLOW = 3, MINT = 5;
// One word table for every layer: notes, combo counts (index = the combo, 2..20), shouts, code.
const WORDS = ["♪", "♫", ...Array.from({ length: 19 }, (_, i) => "×" + (i + 2)), "BEAT!", "REFILL!", "SHIP IT!", "SLURP!", "CLACK!", "{", "}", ";", "=>", "</>", "fz()", "0", "1", "&&", "[]"];
const W_BEAT = 21, W_REFILL = 22, W_SHIP = 23, W_SLURP = 24, W_CLACK = 25, W_CODE = 26, CODES = 10;
const comboWord = (n: number) => Math.min(n, 20);

/** What an object asks of its column: score a hit (→ the combo), a sound cue, a shake. */
export interface Kit { hit(cue: Cue, pts: number): number; cue(c: Cue): void; shake(px: number): void }

/** On its own (a gallery entry): combos still count, no sound, no column to shake. */
const solo = (): Kit => {
  let n = 0, t = -1e9;
  return {
    hit() {
      const now = performance.now();
      n = now - t < 1100 ? n + 1 : 1;
      t = now;
      return n;
    },
    cue() {},
    shake() {},
  };
};

/** The column's arcade layer on `stage`: score, combo and best on the HUD in `bar`, sound with its
 *  mute key, and the stage shake. Its own engine: it sleeps when the combo and the shake are over. */
export function kit(stage: HTMLElement, bar: HTMLElement | null, mute: HTMLButtonElement | null) {
  const e = createEngine({ root: stage, settle: 0.5 });
  const st = new Float64Array(5); // 0 score, 1 combo, 2 combo time left, 3 shake (px), 4 best combo
  const snd = mute ? sound(e, { cues: {}, volume: 0.16 }) : null;
  let shaking = false;
  if (mute && snd) mute.addEventListener("click", () => {
    snd.on = !snd.on;
    e.ledger.attr(mute, "aria-pressed", "" + snd.on);
  }, { signal: e.signal });
  if (bar) {
    const h = hud(e, bar);
    h.num(".fz-score", [st, 0]);
    h.num(".fz-combo", [st, 1]);
    h.num(".fz-best", [st, 4]);
    h.flag(bar, "hot", () => st[1]! >= 5);
  }
  e.add({
    step(en, dt) {
      if (st[2]! > 0 && (st[2]! -= dt) <= 0) st[1] = 0;
      if (st[2]! > 0) en.busy();
      if (st[3]! > 0.2) (st[3]! *= Math.exp(-dt * 11)), en.busy();
      else st[3] = 0;
    },
    render(en) {
      const a = st[3]!;
      if (a) (shaking = true), en.ledger.style(stage, "translate", SHAKE(((Math.round((rnd() - 0.5) * 2 * a) + 16) << 5) | (Math.round((rnd() - 0.5) * 1.4 * a) + 16)));
      else if (shaking) (shaking = false), en.ledger.unstyle(stage, "translate");
    },
  });
  e.start();
  const k: Kit = {
    hit(cue, pts) {
      e.wake();
      st[1] = st[2]! > 0 ? st[1]! + 1 : 1;
      st[2] = 1.1;
      st[0]! += pts * st[1]!;
      st[4] = Math.max(st[4]!, st[1]!);
      k.cue(st[1]! % 10 ? cue : "win");
      return st[1]!;
    },
    cue(c) {
      e.wake();
      snd?.play(c);
    },
    shake(px) {
      if (still()) return;
      st[3] = Math.min(9, st[3]! + px);
      e.wake();
    },
  };
  return { ...k, engine: e, state: st, destroy: () => e.destroy() };
}

/** A particle layer over (and around) a sprite: drawn only while something is alive. `art` paints
 *  extra light (an equalizer, a screen glow) while its `on()` says so. */
function layer(s: Strip, host: HTMLElement, w: number, h: number, up: number, side: number, gravity = 0, art?: { on(): boolean; draw(ctx: CanvasRenderingContext2D): void }) {
  const c = s.engine.ledger.add(document.createElement("canvas")), r = devicePixelRatio || 1, W = w + 2 * side, H = h + up;
  c.width = W * r;
  c.height = H * r;
  c.style.cssText = `position:absolute;left:${-side}px;top:${-up}px;width:${W}px;height:${H}px;pointer-events:none`;
  c.ariaHidden = "true";
  host.append(c);
  const ctx = c.getContext("2d")!, fx = effects({ cap: 160, colors: COLORS, words: WORDS, scorch: 0, gravity });
  let drawn = false;
  s.engine.add({
    step(e, dt) {
      fx.step(dt);
      if (fx.live) e.busy();
    },
    render() {
      const lit = !!art && art.on();
      if (!fx.live && !lit && !drawn) return;
      ctx.setTransform(r, 0, 0, r, side * r, up * r);
      ctx.clearRect(-side, -up, W, H);
      if (lit) art!.draw(ctx);
      fx.draw(ctx, true);
      drawn = fx.live > 0 || lit;
    },
  });
  return fx;
}

/** A word that pops up and drifts (a combo count, a shout). */
const pop = (fx: Effects, x: number, y: number, w: number, size: number, c = YELLOW) => fx.spawn(4, x, y, (rnd() - 0.5) * 30, -70, size, 0.9, c, (rnd() - 0.5) * 0.3, 0, w);

/** A spring for squash and wobble: [value, velocity]. → still moving. */
const spring = (v: Float64Array, i: number, dt: number, k: number, damp: number) => {
  if (Math.abs(v[i]!) < 0.002 && Math.abs(v[i + 1]!) < 0.02) return (v[i] = v[i + 1] = 0), false;
  v[i + 1]! += (-k * v[i]! - damp * v[i + 1]!) * dt;
  v[i]! += v[i + 1]! * dt;
  return true;
};

/** Headphones in `beats` (a .fz-beats box with its .fz-cups and .fz-play buttons): hit the cups,
 *  play the 2015 loop. → the strip (destroy() to recall). */
export function headphones(beats: HTMLElement, k: Kit = solo()) {
  const play = beats.querySelector<HTMLButtonElement>(".fz-play")!, cups = beats.querySelector<HTMLButtonElement>(".fz-cups")!;
  const hp = strip(beats, 300);
  const PLAY: Clip = { segs: [{ a: 0, b: 13, n: 13, d: 1.4 }, { a: 14, b: 28, n: 14, d: 0.33 }, { a: 28, b: 14, n: 14, d: 0.67 }], loop: 1 };
  const CUPS = [118, 186]; // earcups' outer top edge, x in the 300px frame (y 128)
  const v = new Float64Array(3); // squash, its velocity, equalizer kick
  const eq = new Float32Array(6), eqTo = new Float32Array(6);
  let started = false, on = false, beat = 0, side = 0, eqT = 0, shown = 0;
  const music = () => on && hp.playing && hp.segment >= 1;
  // The equalizer on the phone's screen, under the play key (x 243..285, y 210..233).
  const fx = layer(hp, beats, 300, 300, 140, 0, 0, {
    on: () => music() || v[2]! > 0.02,
    draw(ctx) {
      for (let i = 0; i < 6; i++) {
        const bh = 2 + eq[i]! * 21;
        ctx.fillStyle = COLORS[i & 1 ? CORAL : CREAM]!;
        ctx.fillRect(244 + i * 7, 233 - bh, 5, bh);
      }
    },
  });
  const note = (i: number, up: number, spread: number) => {
    const x = CUPS[i & 1]! + (i & 1 ? 6 : -6), dir = i & 1 ? 1 : -1;
    fx.spawn(4, x, 128, dir * (10 + rnd() * spread), -up - rnd() * up * 0.5, 18 + rnd() * 10, 1.1 + rnd() * 0.5, (rnd() * 3) | 0, dir * rnd() * 0.3, dir * 0.4, (rnd() * 2) | 0);
  };
  hp.engine.add({
    step(e, dt) {
      if (music() && (beat -= dt) <= 0) (beat = 0.22 + rnd() * 0.16), note((side ^= 1), 120, 30);
      if (music() || v[2]! > 0.02) {
        if ((eqT -= dt) <= 0) {
          eqT = 0.1;
          for (let i = 0; i < 6; i++) eqTo[i] = music() ? 0.2 + rnd() * 0.6 : 0;
        }
        for (let i = 0; i < 6; i++) eq[i]! += (Math.min(1, eqTo[i]! + v[2]! * (0.6 + rnd() * 0.4)) - eq[i]!) * Math.min(1, dt * 20);
        v[2]! *= Math.exp(-dt * 3);
        e.busy();
      }
      if (spring(v, 0, dt, 340, 13)) e.busy();
    },
    render(e) {
      const q = Math.round(v[0]! * 100);
      if (q === shown) return;
      shown = q;
      if (q) e.ledger.style(beats, "scale", SQUASH(q));
      else e.ledger.unstyle(beats, "scale");
    },
  });
  const toggle = () => {
    on = !on;
    hp.engine.ledger.attr(play, "aria-pressed", "" + on);
    hp.engine.ledger.attr(play, "aria-label", on ? "Pause the music" : "Play the music");
    if (still()) return on ? hp.show(17) : hp.show(0);
    if (!started) (started = true), hp.play(PLAY);
    else hp.hold(!on);
  };
  play.addEventListener("click", () => (toggle(), k.cue(on ? "ready" : "end")));
  cups.addEventListener("click", () => {
    if (!on) toggle();
    const n = k.hit("boom", 10);
    if (still()) return;
    v[1]! += 2.4 + Math.min(n, 10) * 0.18;
    v[2] = 1;
    for (let i = 0, m = 8 + Math.min(n, 12); i < m; i++) note(i, 170, 130);
    if (n > 1) pop(fx, 150, 30, comboWord(n), 24 + Math.min(n, 10) * 1.6);
    if (n % 5 === 0) pop(fx, 150, -20, W_BEAT, 30, CORAL);
    k.shake(2 + Math.min(n, 10) * 0.6);
    hp.engine.wake();
  });
  return hp;
}

/** Coffee in `cup` (a .fz-coffee box with its <button>): pour and sip, each turning back from the
 *  frame it is on; the pour streams and splashes, steam curls off the full cup, a sip wobbles it.
 *  → the strip (destroy() to recall). */
export function coffee(cup: HTMLElement, k: Kit = solo()) {
  const b = cup.querySelector("button")!;
  const cf = strip(cup, 84, 11);
  const fx = layer(cf, cup, 84, 84, 90, 36, 520);
  const disc = (angle: number) => ({ shape: "disc" as const, drag: 0.8, gravity: 0, angle, spread: 0.3, speed: [16, 32] as [number, number], size: [2.5, 5] as [number, number], life: [1.1, 1.9] as [number, number] });
  const { ids, emit } = emitter(fx, {
    left: disc(-1.9),
    right: disc(-1.25),
    drop: { shape: "streak", drag: 0, gravity: 1, angle: 1.5708, spread: 0.12, speed: [40, 80], size: [2, 3], life: [0.36, 0.42] },
    splash: { shape: "disc", drag: 2, gravity: 1, angle: -1.5708, spread: 2.6, speed: [70, 170], size: [1.2, 2.6], life: [0.35, 0.7] },
  });
  const v = new Float64Array(2); // wobble (deg/10), its velocity
  let full = false, hot = 0, waft = 0, curl = 0, pour = 0, splashed = true, shown = 0;
  cf.engine.add({
    step(e, dt) {
      if (still()) return;
      if (full && cf.frame < 11 && pour > 0) {
        pour -= dt;
        if ((waft -= dt) <= 0) (waft = 0.025), emit(ids.drop, 41 + rnd() * 3, -40, 2, CORAL, 2);
        e.busy();
      }
      if (full && cf.frame === 11 && !splashed) {
        splashed = true;
        emit(ids.splash, 42, 40, 22, CORAL, 3);
        v[1]! += 9;
      }
      if (cf.frame === 11 && full && hot > 0) {
        hot -= dt;
        if ((waft -= dt) <= 0) (waft = 0.09), emit((curl ^= 1) ? ids.left : ids.right, 34 + rnd() * 16, 34, 1, CREAM);
        e.busy();
      }
      if (spring(v, 0, dt, 260, 7)) e.busy();
    },
    render(e) {
      const q = Math.round(v[0]! * 8);
      if (q === shown) return;
      shown = q;
      if (q) e.ledger.style(cup, "rotate", WOBBLE(q));
      else e.ledger.unstyle(cup, "rotate");
    },
  });
  const turn = () => {
    const to = full ? 11 : 0;
    cf.engine.ledger.attr(b, "aria-label", full ? "Drink the coffee" : "Fill the cup");
    hot = full ? 3 : 0;
    if (still()) return cf.show(to);
    if (cf.frame !== to) cf.play({ segs: [go(cf.frame, to, 0.6 / 11)] });
  };
  b.addEventListener("click", () => {
    full = !full;
    turn();
    const n = k.hit(full ? "power" : "end", 5);
    if (still()) return;
    if (full) (pour = 0.65), (splashed = false);
    else (v[1]! -= 7), emit(ids.splash, 42, 30, 8, CREAM, 1), pop(fx, 42, -6, W_SLURP, 15, CREAM);
    if (n > 1) pop(fx, 42, -30, comboWord(n), 18 + Math.min(n, 10));
    if (full && n > 2) pop(fx, 42, -54, W_REFILL, 15, CORAL);
    k.shake(1 + Math.min(n, 10) * 0.3);
    cf.engine.wake();
  });
  turn(); // the 2015 intro: the cup drains on load (no .2 s wait)
  return cf;
}

/** Laptop in `comp` (a .fz-comp box with its .fz-keys and .fz-lid buttons): the keys open it (a
 *  slam and a clack), then type: clicks, code sprays, the screen lights, the code scrolls on. The
 *  screen's button slams it shut. → the strip (destroy() to recall). */
export function laptop(comp: HTMLElement, k: Kit = solo()) {
  const keys = comp.querySelector<HTMLButtonElement>(".fz-keys")!, lid = comp.querySelector<HTMLButtonElement>(".fz-lid")!;
  const lp = strip(comp, 210, 15);
  const TYPE: Seg = { a: 12, b: 20, n: 8, d: 0.5 }, SCROLL: Seg = { a: 20, b: 30, n: 10, d: 1.2 }, RUSH: Seg = { a: 20, b: 30, n: 10, d: 0.45 };
  const g = new Float64Array(1); // the screen's glow
  const fx = layer(lp, comp, 210, 210, 110, 0, 0, {
    on: () => g[0]! > 0.02,
    draw(ctx) {
      ctx.globalAlpha = g[0]! * 0.5;
      ctx.fillStyle = "#e9fffb";
      ctx.fillRect(15, 38, 180, 64);
      ctx.globalAlpha = 1;
    },
  });
  lp.engine.add({
    step(e, dt) {
      if (g[0]! > 0.02) (g[0]! *= Math.exp(-dt * 4)), e.busy();
    },
  });
  let open = false;
  const label = () => {
    lp.engine.ledger.attr(keys, "aria-label", open ? "Type code" : "Open the laptop");
    lp.engine.ledger.attr(lid, "hidden", open ? null : "");
  };
  const flip = () => {
    const f = lp.frame;
    label();
    if (still()) return lp.show(open ? 29 : 0);
    if (!open) return f && lp.play({ segs: [go(Math.min(f, 15), 0, 0.3 / 15)] });
    const first = f < 13 ? [go(f, 13, 0.4 / 13), TYPE] : f < 20 ? [go(f, 20, 0.06)] : [];
    lp.play({ segs: [...first, SCROLL], loop: first.length, reps: 2, rest: 29 });
  };
  keys.addEventListener("click", () => {
    if (!open) {
      open = true;
      flip();
      const n = k.hit("hit", 5);
      if (still()) return;
      pop(fx, 105, 30, W_CLACK, 22, CREAM);
      if (n > 1) pop(fx, 105, 0, comboWord(n), 22);
      return k.shake(5);
    }
    const n = k.hit("click", 3);
    if (still()) return;
    for (let i = 0, m = 3 + Math.min(n, 9); i < m; i++)
      fx.spawn(4, 40 + rnd() * 130, 120 + rnd() * 40, (rnd() - 0.5) * 170, -140 - rnd() * 170, 12 + rnd() * 7, 0.8 + rnd() * 0.5, rnd() < 0.5 ? MINT : rnd() < 0.5 ? CREAM : CORAL, 0, (rnd() - 0.5) * 3, W_CODE + ((rnd() * CODES) | 0));
    if (n > 1) pop(fx, 105, 10, comboWord(n), 20 + Math.min(n, 10) * 1.4);
    if (n % 10 === 0) pop(fx, 105, -30, W_SHIP, 26, CORAL);
    g[0] = 1;
    if (lp.frame >= 20 && !lp.playing) lp.play({ segs: [RUSH], loop: 0, reps: 1, rest: 29 });
    k.shake(1.2);
    lp.engine.wake();
  });
  lid.addEventListener("click", () => {
    open = false;
    flip();
    keys.focus();
    const n = k.hit("hit", 5);
    if (still()) return;
    pop(fx, 105, 60, W_CLACK, 26, CREAM);
    if (n > 1) pop(fx, 105, 30, comboWord(n), 22);
    k.shake(6);
  });
  flip(); // the 2015 intro: the lid closes on load
  return lp;
}

/** Start the arcade column inside `root`. → its kit and the three strips (destroy() each to recall). */
export function arcade(root: HTMLElement) {
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const k = kit($(".bt-stage"), root.querySelector(".fz-hud"), root.querySelector(".fz-mute"));
  return { kit: k, strips: [headphones($(".fz-beats"), k), coffee($(".fz-coffee"), k), laptop($(".fz-comp"), k)] };
}
