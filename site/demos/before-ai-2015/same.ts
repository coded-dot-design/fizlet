// Same behaviour as 2015: same sheets, same frames, same timings, same click (a class flip that
// restarts a clip). The 2015 @keyframes are the clips below, number for number (2015 values from
// css/sprites.css in this folder).
import { strip, type Clip, type Strip } from "./strip";

const once = (c: Clip["segs"]) => ({ segs: c });

// Headphones: beatsPlug 1.4s steps(13) 0 → -3900px, then beatsOn 1s steps(14) infinite
// (0% -4200px, 33% -8400px, 100% -4200px). Starts paused on frame 0 (the 2015 controller's state).
const PLAY: Clip = { segs: [{ a: 0, b: 13, n: 13, d: 1.4 }, { a: 14, b: 28, n: 14, d: 0.33 }, { a: 28, b: 14, n: 14, d: 0.67 }], loop: 1 };
// Coffee: coffeeFill .6s steps(11) forwards .2s; .drinkMe: coffeeDrink .6s steps(11) backwards .2s.
const FILL = once([{ a: 0, b: 11, n: 11, d: 0.6, w: 0.2 }]);
const DRINK = once([{ a: 11, b: 0, n: 11, d: 0.6, w: 0.2 }]);
// Laptop: comp 1.2s steps(13) .2s, compType .8s steps(8) 1.4s, compScroll 1.2s steps(10) infinite 2.2s;
// .close: compOut .8s steps(15) backwards .1s.
const OPEN: Clip = { segs: [{ a: 0, b: 13, n: 13, d: 1.2, w: 0.2 }, { a: 12, b: 20, n: 8, d: 0.8 }, { a: 20, b: 30, n: 10, d: 1.2 }], loop: 2 };
const CLOSE = once([{ a: 15, b: 0, n: 15, d: 0.8, w: 0.1 }]);

/** Start the "same behaviour" column inside `root`. `intro`: play the 2015 load intro (the cup
 *  drains, the lid closes); off when the column is started again after Recall, where every sprite
 *  already shows its first frame. → the three strips (destroy() each to recall). Each class flip is
 *  written through its strip's ledger and each listener goes with its engine, so Recall gives the
 *  column back as it was and a recalled column answers no press. */
export function same(root: HTMLElement, intro = true) {
  const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
  const beats = $(".fz-beats"), cup = $(".fz-coffee"), comp = $(".fz-comp");
  const hp = strip(beats, 300), cf = strip(cup, 84), lp = strip(comp, 210);
  /** Flip a class on a strip's element (2015's ng-class) through the ledger. → it is on now. */
  const flip = (s: Strip, el: HTMLElement, c: string) => {
    const on = !el.classList.contains(c);
    s.engine.ledger.cls(el, c, on);
    return on;
  };
  const press = (el: HTMLElement, s: Strip, f: () => void) => el.firstElementChild!.addEventListener("click", f, { signal: s.engine.signal });
  let started = false;
  if (intro) cf.play(DRINK), lp.play(CLOSE);
  press(beats, hp, () => {
    const p = flip(hp, beats, "paused");
    if (!started) (started = true), hp.play(PLAY);
    else hp.hold(p);
  });
  press(cup, cf, () => cf.play(flip(cf, cup, "drinkMe") ? DRINK : FILL));
  press(comp, lp, () => lp.play(flip(lp, comp, "close") ? CLOSE : OPEN));
  return [hp, cf, lp];
}
