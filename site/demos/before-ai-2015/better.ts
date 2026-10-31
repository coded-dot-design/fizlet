// Better: the same sheets and frames, plus what 2015 couldn't do cheaply.
// - Headphones: ♪ notes rise out of the earcups while the music plays (fizlet/fx, the fizz spray's
//   pool), stop on pause; the play/pause is a real <button> with a name and a pressed state.
// - Coffee: interrupt the pour or the sip and it turns back from the frame it is on; steam while full.
// - Laptop: open/close turns back from any frame; the code scrolls 3 times, then rests (0 frames).
// - All three: keyboard (real buttons), reduced motion (lands on the still frame, no particles),
//   settle to 0 rAF/s at rest, pause off screen, recall() gives the page back exactly.
import { strip, type Clip, type Seg, type Strip } from "./strip";
import { effects, emitter } from "../../../src/fx";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const go = (a: number, b: number, perFrame: number): Seg => ({ a, b, n: Math.abs(b - a), d: Math.abs(b - a) * perFrame });
const CREAM = "#F4F2DB", CORAL = "#E15E49", RED = "#ba341f";

/** A particle layer over (and above) a sprite: drawn only while something is alive. */
function layer(s: Strip, host: HTMLElement, w: number, h: number, up: number, colors: string[], words?: string[]) {
  const c = s.engine.ledger.add(document.createElement("canvas")), r = devicePixelRatio || 1;
  c.width = w * r;
  c.height = (h + up) * r;
  c.style.cssText = `position:absolute;left:0;top:${-up}px;width:${w}px;height:${h + up}px;pointer-events:none`;
  c.ariaHidden = "true";
  host.append(c);
  const ctx = c.getContext("2d")!, fx = effects({ cap: 96, colors, scorch: 0, ...(words && { words }) });
  let drawn = false;
  s.engine.add({
    step(e, dt) {
      fx.step(dt);
      if (fx.live) e.busy();
    },
    render() {
      if (!fx.live && !drawn) return;
      ctx.setTransform(r, 0, 0, r, 0, up * r);
      ctx.clearRect(0, -up, w, h + up);
      fx.draw(ctx, true);
      drawn = fx.live > 0;
    },
  });
  return fx;
}

/** Headphones in `beats` (a .fz-beats box with its play/pause <button>): plug in, then the beat
 *  loop (the 2015 frames and timings); notes ride the loop. → the strip (destroy() to recall). */
export function headphones(beats: HTMLElement) {
  const play = beats.querySelector("button")!;
  const hp = strip(beats, 300);
  const notes = layer(hp, beats, 300, 300, 140, [CREAM, CORAL, RED], ["♪", "♫"]);
  const PLAY: Clip = { segs: [{ a: 0, b: 13, n: 13, d: 1.4 }, { a: 14, b: 28, n: 14, d: 0.33 }, { a: 28, b: 14, n: 14, d: 0.67 }], loop: 1 };
  const CUPS = [118, 186]; // earcups' outer top edge, x in the 300px frame (y 128)
  let started = false, on = false, beat = 0, side = 0;
  hp.engine.add({
    step(e, dt) {
      if (!on || !hp.playing || hp.segment < 1) return;
      if ((beat -= dt) > 0) return;
      beat = 0.22 + Math.random() * 0.16;
      const x = CUPS[(side ^= 1)]! + (side ? 6 : -6), dir = side ? 1 : -1;
      notes.spawn(4, x, 128, dir * (10 + Math.random() * 30), -120 - Math.random() * 50, 18 + Math.random() * 8, 1.3 + Math.random() * 0.4, (Math.random() * 3) | 0, dir * Math.random() * 0.3, dir * 0.4, (Math.random() * 2) | 0);
      e.busy();
    },
  });
  play.addEventListener("click", () => {
    on = !on;
    hp.engine.ledger.attr(play, "aria-pressed", "" + on);
    hp.engine.ledger.attr(play, "aria-label", on ? "Pause the music" : "Play the music");
    if (still()) return on ? hp.show(17) : hp.show(0);
    if (!started) (started = true), hp.play(PLAY);
    else hp.hold(!on);
  });
  return hp;
}

/** Coffee in `cup` (a .fz-coffee box with its <button>): the pour and the sip turn back from
 *  wherever they are; steam rises while it is full. → the strip (destroy() to recall). */
export function coffee(cup: HTMLElement) {
  const cupB = cup.querySelector("button")!;
  const cf = strip(cup, 84, 11, { fps: 30 });
  const steam = layer(cf, cup, 84, 84, 70, [CREAM]);
  const { ids: { puff }, emit } = emitter(steam, { puff: { shape: "disc", drag: 0.8, gravity: 0, angle: -1.5708, spread: 0.5, speed: [16, 30], size: [2.5, 4.5], life: [1.1, 1.8] } });
  let full = false, hot = 0, waft = 0;
  cf.engine.add({
    step(e, dt) {
      if (cf.frame !== 11 || !full || hot <= 0 || still()) return;
      hot -= dt;
      if ((waft -= dt) <= 0) (waft = 0.1), emit(puff, 32 + Math.random() * 20, 36, 1);
      e.busy();
    },
  });
  const pour = () => {
    const to = full ? 11 : 0;
    cf.engine.ledger.attr(cupB, "aria-label", full ? "Drink the coffee" : "Fill the cup");
    hot = full ? 4 : 0;
    if (still()) return cf.show(to);
    if (cf.frame !== to) cf.play({ segs: [go(cf.frame, to, 0.6 / 11)] });
  };
  cupB.addEventListener("click", () => ((full = !full), pour()));
  pour(); // the 2015 intro: the cup drains on load (no .2 s wait)
  return cf;
}

/** Laptop in `comp` (a .fz-comp box with its <button>): opens to the code, types, scrolls 3 times,
 *  rests; open/close turn back from any frame. → the strip (destroy() to recall). */
export function laptop(comp: HTMLElement) {
  const lid = comp.querySelector("button")!;
  const lp = strip(comp, 210, 15, { fps: 30 });
  const TYPE: Seg = { a: 12, b: 20, n: 8, d: 0.8 }, SCROLL: Seg = { a: 20, b: 30, n: 10, d: 1.2 };
  let open = false;
  const flip = () => {
    const f = lp.frame;
    lp.engine.ledger.attr(lid, "aria-label", open ? "Close the laptop" : "Open the laptop");
    if (still()) return lp.show(open ? 29 : 0);
    if (!open) return f && lp.play({ segs: [go(Math.min(f, 15), 0, 0.8 / 15)] });
    const first = f < 13 ? [go(f, 13, 1.2 / 13), TYPE] : f < 20 ? [go(f, 20, 0.1)] : [];
    lp.play({ segs: [...first, SCROLL], loop: first.length, reps: 3, rest: 29 });
  };
  lid.addEventListener("click", () => ((open = !open), flip()));
  flip(); // the 2015 intro: the lid closes on load
  return lp;
}

/** Start the "better" column inside `root`. → the three strips (destroy() each to recall). */
export function better(root: HTMLElement) {
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  return [headphones($(".fz-beats")), coffee($(".fz-coffee")), laptop($(".fz-comp"))];
}
