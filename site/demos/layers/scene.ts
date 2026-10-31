/**
 * The layers story: a Battlefield Blitz-style board turns and fans out into its stacked layers (CSS 3D
 * on real DOM layers), one layer at a time, each label arriving with its layer; one layer faults red,
 * a scan patches it, it flashes green, and the stack snaps back into the game. Built on the kernel
 * (settle + fps cap) and fzlt/sprite; mounted by fzlt/slot (see entry.ts).
 *
 * It plays on its own, LOOPS times round, while the figure is on screen, then rests on the game frame
 * and the kernel settles (off screen nothing runs either). The play key pauses and resumes it. A wheel or a vertical swipe over the figure steps
 * the story by hand (the figure holds the page's scroll, like the site's other demo frames; the
 * site's scroll-lock note says why) and pauses it; scrolling down fans the layers out. Keyboard: the
 * figure takes focus; arrows (and Home/End) step through the layers, one stop per label.
 *
 * The game is a pure function of the story time: the tanks drive fixed loops, their shots are
 * worked out once at mount and a hit's blast is a ring sized by the time since it, so a scroll
 * position always shows the same frame, whichever way the page got there.
 * Recall: every node it adds goes through the engine's ledger; destroy() gives the stage back.
 */
import { createEngine } from "../../../src/kernel/index";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import type { SlotMount, SlotScene } from "../../../src/slot";
import { FAULT, fit, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN } from "./data";

// The story in seconds of story time; it loops at END. WHEEL: wheel (or swipe) pixels per second of story.
const PLAY = 0.8, OPEN = 2.4, LIFT = 0.45, RISE = 0.7, FAULT_AT = 6.8, SCAN_AT = 7.5, SCAN_END = 8.9, OK_END = 9.6, FOLD_AT = 10, CLOSED = 11.4, END = 12.4, WHEEL = 90, LOOPS = 3;
/** Layer ids, bottom to top (data.ts LAYERS; the labels' text comes from the poster's own). */
const IDS = "grid characters movement collision rules fx input hud".split(" ");
const N = IDS.length, TANKS = 4, SHOTS = 40;
/** Layer i (1–7) lifts off the stack from here; it is in place at lift(i) + RISE. */
const lift = (i: number) => OPEN + (i - 1) * LIFT;
/** Keyboard stops: the game, the grid's label, each lifted layer's label, fault, scan, patched, the game. */
const STOPS = [0, OPEN + 0.15, 1, 2, 3, 4, 5, 6, 7, FAULT_AT + 0.3, SCAN_AT + 0.7, SCAN_END + 0.3, END].map((v, k) => (k > 1 && k < 9 ? lift(v) + RISE + 0.15 : v));
/** Patrol loops (cells: left, top, right, bottom), one per tank; even tanks are green. */
const LOOP = [[0, 3, 4, 5], [5, 9, 8, 12], [4, 3, 8, 5], [0, 9, 3, 12]];
const wall = (x: number, y: number) => MAP[(y / CELL) | 0]?.[(x / CELL) | 0] === "#";
const smooth = (a: number, b: number, t: number) => {
  const k = t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  return k * k * (3 - 2 * k);
};
/** Where tank i is at story time g: x, y, heading (written into P; no allocation). Clockwise round
 *  its loop at 38 px/s, easing into each corner's turn over the last 8 px. */
const P = new Float64Array(3);
function at(i: number, g: number) {
  const [c0, r0, c1, r1] = LOOP[i]!, w = (c1! - c0!) * CELL, h = (r1! - r0!) * CELL;
  let d = (g * 38) % (2 * (w + h)), k = 0;
  for (; d > (k & 1 ? h : w); k++) d -= k & 1 ? h : w;
  const len = k & 1 ? h : w, s = k > 1 ? len - d : d;
  P[0] = (c0! + 0.5) * CELL + (k & 1 ? (k > 1 ? 0 : w) : s);
  P[1] = (r0! + 0.5) * CELL + (k & 1 ? s : k > 1 ? h : 0);
  P[2] = (k + 1 + smooth(len - 8, len, d)) * Math.PI / 2;
}

// The tank, as data. The scene places it as SVG backgrounds (spriteURL), so the canvas half of
// fzlt/sprite stays out of the live chunk.
const TANK: SpriteDef = {
  frames: [
    "...ccc...",
    "...cbc...",
    "ttttbtttt",
    "tbbbbbbbt",
    "tbbhbhbbt",
    "tbbbbbbbt",
    "tbbhbhbbt",
    "tbbbbbbbt",
    "ttttttttt",
  ],
  colors: { t: "tread", b: "team", h: "hatch", c: "team" },
  outline: "rim",
};

export function mount(stage: HTMLElement, fig: HTMLElement = stage): SlotScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.4 });
  const W = stage.clientWidth, H = stage.clientHeight; // one read, at mount (the slot sizes the stage)
  // The tanks wear the Board UI kit's tokens (sprites take hex: read them once, here).
  const cs = getComputedStyle(stage), tok = (v: string) => cs.getPropertyValue(v).trim();
  const rim = tok("--rim");
  const pals: Record<string, string>[] = [{ tread: tok("--raised"), team: tok("--team-a"), hatch: rim, rim }, { team: tok("--team-b") }];

  // ---------- DOM: one stack, eight layers ----------
  const root = engine.ledger.add(document.createElement("div"));
  root.className = "lz";
  root.style.setProperty("--se", "1");
  root.innerHTML = `<div class="lz-s"></div>`; // styles: SCENE_CSS (css.ts), inline on the host page
  const stack = root.lastElementChild as HTMLElement;
  const el = (parent: HTMLElement, cls: string, x = 0, y = 0) => {
    const e = document.createElement("div");
    e.className = cls;
    if (x || y) e.style.transform = `translate(${x}px,${y}px)`;
    return parent.appendChild(e);
  };
  const layers: HTMLElement[] = [], tags: HTMLElement[] = [];
  const names = fig.querySelectorAll(".lyr__t");
  const bytesText = names[FAULT]?.lastElementChild?.textContent ?? "";
  for (let i = 0; i < N; i++) {
    const l = el(stack, i ? "lz-l" : "lz-l lz-g");
    l.dataset.layer = IDS[i]!;
    const t = el(l, "lz-tag");
    t.innerHTML = names[i]?.innerHTML ?? ""; // the poster's own label (name · measured bytes)
    layers.push(l), tags.push(t);
  }
  // ---------- fit: game pose and exploded pose ----------
  // One layout read, here at mount: the widest label at its on-screen size, so the stack leaves room
  // for the labels in whatever monospace font this device has.
  stage.append(root);
  let lw = 0;
  for (const t of tags) lw = Math.max(lw, t.offsetWidth);
  const { sp, se, ex, g: gp } = fit(W, H, lw + 14); // + 10px margin, 4px slack
  root.style.setProperty("--se", `${se}`);
  const [gridL, charL, moveL, colL, rulesL, fxL, inL, hudL] = layers as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
  // Collision: the fixed copy, revealed by the scan, over the broken one.
  const fixed = el(colL, "lz-x");
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r]![c], x = c * CELL, y = r * CELL;
      if (ch === "#") (el(gridL, "lz-w", x, y), el(colL, "lz-k", x, y), (el(fixed, "lz-k", x, y).style.borderStyle = "solid"));
      if (ch === "+") el(gridL, "lz-c", x, y);
    }
  const scan = el(colL, "lz-scan");
  // Rules: spawn pads in the corners.
  for (let k = 0; k < 4; k++) el(rulesL, "lz-p", (k & 1) * (COLS - 1) * CELL, (k >> 1) * (ROWS - 1) * CELL);
  // Input: the aim line (the intent the lead tank follows).
  const aim = el(inL, "lz-a");
  // The kit's own arcade fire key (Board UI), as the player's on-screen control.
  el(inL, "bui-key bui-arcade bui-fire lz-fire").textContent = "FIRE";
  // HUD.
  const hud = el(hudL, "lz-hud");
  hud.innerHTML = "<b>GREEN 0</b><span>VS</span><i>PINK 0</i>";
  const [hudA, , hudB] = hud.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

  // Characters, their hitboxes and their patrol loops (the movement layer).
  const tankEl: HTMLElement[] = [], boxEl: HTMLElement[] = [], shellEl: HTMLElement[] = [], boomEl: HTMLElement[] = [];
  for (let i = 0; i < TANKS; i++) {
    const [c0, r0, c1, r1] = LOOP[i]!;
    const t = el(charL, "lz-t");
    t.style.background = `url("${spriteURL(TANK, 0, pals, i & 1)}") 0 0/100% 100%`;
    tankEl.push(t), boxEl.push(el(colL, "lz-h")), shellEl.push(el(charL, "lz-b")), boomEl.push(el(fxL, "lz-m"));
    const loop = el(moveL, "lz-o", (c0! + 0.5) * CELL, (r0! + 0.5) * CELL);
    loop.style.width = `${(c1! - c0!) * CELL}px`;
    loop.style.height = `${(r1! - r0!) * CELL}px`;
  }
  // ---------- the shots, worked out once: each tank fires on a fixed beat at the nearest enemy ----------
  // Shot s: fired at F by tank O from (SX, SY) at (VX, VY) px/s; it ends at E: K 1 on a wall, 2 on a
  // tank (a point for O's team), 0 off the board or spent. While the collision layer is broken
  // (FAULT_AT to SCAN_END) shells pass through walls.
  const F = new Float64Array(SHOTS), E = new Float64Array(SHOTS), SX = new Float64Array(SHOTS), SY = new Float64Array(SHOTS), VX = new Float64Array(SHOTS), VY = new Float64Array(SHOTS);
  const K = new Int32Array(SHOTS), O = new Int32Array(SHOTS);
  let shots = 0;
  for (let i = 0; i < TANKS; i++)
    for (let f = 1 + i * 0.4; f < END && shots < SHOTS; f += 1.7, shots++) {
      at(i, f);
      const x = P[0]!, y = P[1]!;
      let best = 0, d2 = 1e9;
      for (let j = 1 - (i & 1); j < TANKS; j += 2) {
        at(j, f);
        const d = (P[0]! - x) ** 2 + (P[1]! - y) ** 2;
        if (d < d2) (d2 = d), (best = j);
      }
      at(best, f);
      const dd = Math.sqrt(d2) || 1, vx = ((P[0]! - x) / dd) * 170, vy = ((P[1]! - y) / dd) * 170;
      const s = shots;
      (F[s] = f), (O[s] = i), (SX[s] = x + vx / 14), (SY[s] = y + vy / 14), (VX[s] = vx), (VY[s] = vy), (E[s] = f + 1.4);
      for (let u = f; u < f + 1.4; u += 1 / 60) {
        const px = SX[s]! + vx * (u - f), py = SY[s]! + vy * (u - f);
        if (px < 0 || py < 0 || px > BW || py > BH) { E[s] = u; break; }
        if ((u < FAULT_AT || u >= SCAN_END) && wall(px, py)) { (E[s] = u), (K[s] = 1); break; }
        let hit = 0;
        for (let j = 1 - (i & 1); j < TANKS; j += 2) (at(j, u), (hit ||= +((P[0]! - px) ** 2 + (P[1]! - py) ** 2 <= 110)));
        if (hit) { (E[s] = u), (K[s] = 2); break; }
      }
    }

  // ---------- the story clock ----------
  // T: shown time, target time, playing (1/0), on screen (1/0), loops played.
  const T = new Float64Array(5);
  T[2] = 1;
  const btn = fig.querySelector<HTMLElement>(".lyr__play");
  const play = (on: boolean) => {
    T[2] = +on;
    if (on) T[4] = 0;
    if (on && T[1]! >= END) T[0] = T[1] = 0;
    if (btn) engine.ledger.attr(btn, "aria-label", on ? "Pause" : "Play");
    engine.wake();
  };
  /** Step by hand (wheel, swipe, keys): pause, move the target, keep it in the story. */
  const to = (t: number) => {
    if (T[2]) play(false);
    engine.ledger.attr(fig, "data-scrubbed", "");
    T[1] = Math.min(END, Math.max(0, t));
    engine.wake();
  };
  const stop = (dir: number) => {
    let k = dir > 0 ? 0 : STOPS.length - 1;
    while (STOPS[k] !== undefined && (dir > 0 ? STOPS[k]! <= T[1]! + 0.01 : STOPS[k]! >= T[1]! - 0.01)) k += dir;
    return STOPS[k] ?? T[1]!;
  };
  engine.add({
    step(e, dt) {
      if (T[2] && T[3]) {
        // Playing: the story runs at real time and loops (the end and the start are both the game);
        // after LOOPS it rests on the game frame, and play starts it again.
        T[0] = T[1] = T[1]! + dt >= END ? 0 : T[1]! + dt;
        if (T[1] === 0 && ++T[4]! >= LOOPS) return play(false);
        return e.busy();
      }
      const d = T[1]! - T[0]!;
      T[0] = Math.abs(d) < 0.004 ? T[1]! : T[0]! + d * Math.min(1, dt * 9);
      if (T[0] !== T[1]) e.busy();
    },
    render() {
      const t = T[0]!;
      // Camera: the board turns into the exploded view, then the layers lift off it one by one,
      // bottom to top; the fold brings them all back together and turns the board back.
      const fold = 1 - smooth(FOLD_AT + 0.3, CLOSED, t), cam = t < FOLD_AT ? smooth(PLAY, OPEN, t) : fold;
      stack.style.transform = `translate(${ex * cam}px,0) scale(${sp + (se - sp) * cam}) rotateX(${TILT * cam}deg) rotateZ(${TURN * cam}deg)`;
      const zb = -(N - 1) / 2 * gp, out = 1 - smooth(FOLD_AT, FOLD_AT + 0.3, t);
      for (let i = 0; i < N; i++) {
        const zf = (i - (N - 1) / 2) * gp;
        layers[i]!.style.transform = `translateZ(${t < FOLD_AT ? zb * cam + (zf - zb) * smooth(lift(i), lift(i) + RISE, t) : zf * fold}px)`;
        // A label shows only once its layer is in place (so labels never travel, crowd or overlap),
        // and all go before the fold starts.
        const end = i ? lift(i) + RISE : OPEN;
        tags[i]!.style.transform = `rotateZ(${-TURN * cam}deg) rotateX(${-TILT * cam}deg)`;
        tags[i]!.style.opacity = `${smooth(end - 0.1, end + 0.15, t) * out}`;
      }
      // Fault, scan, patch, green.
      const bad = t >= FAULT_AT && t < SCAN_END, ok = t >= SCAN_END && t < OK_END;
      const p = smooth(SCAN_AT, SCAN_END, t);
      // State classes (namespaced: a host page may style .o or .k): lz--o open (layer plates show),
      // lz--f fault or fix (others dim), lz--b broken, lz--k patched.
      root.className = `lz${cam > 0.02 ? " lz--o" : ""}${bad || ok ? " lz--f" : ""}${bad ? " lz--b" : ok ? " lz--k" : ""}`;
      root.dataset.p = `${Math.round((t / END) * 1000) / 1000}`;
      colL.style.setProperty("--g", `${Math.round(50 * (1 - smooth(SCAN_END, OK_END, t)))}%`);
      const h = `${t >= SCAN_AT && t < OK_END ? p * BH : t >= OK_END || t < FAULT_AT ? BH : 0}px`;
      if (fixed.style.height !== h) fixed.style.height = h;
      scan.style.display = t >= SCAN_AT && t < SCAN_END ? "" : "none";
      scan.style.transform = `translateY(${p * BH}px)`;
      const tag = tags[FAULT]!;
      const word = bad ? (t < SCAN_AT ? "FAULT" : "SCANNING") : ok ? "PATCHED" : "";
      if (tag.dataset.state !== word) {
        tag.dataset.state = word;
        tag.lastElementChild!.textContent = word ? `· ${word}` : bytesText;
      }
      // Game-mode helpers (paths, hitboxes, rules) show only when the stack is open.
      moveL.style.opacity = rulesL.style.opacity = `${cam}`;
      // Characters, hitboxes, shells (one live shell per tank at most: it fires every 1.7 s, a shell
      // lasts 1.4 s), the score.
      let a = 0, b = 0;
      for (let i = 0; i < TANKS; i++) {
        at(i, t);
        tankEl[i]!.style.transform = `translate(${P[0]! - 13.5}px,${P[1]! - 13.5}px) rotate(${P[2]}rad)`;
        boxEl[i]!.style.transform = `translate(${P[0]}px,${P[1]}px)`;
        if (!i) aim.style.transform = `translate(${P[0]}px,${P[1]}px) rotate(${P[2]! - Math.PI / 2}rad)`;
        shellEl[i]!.style.display = boomEl[i]!.style.display = "none";
      }
      // A hit's blast: a ring that grows and fades over 0.5 s of story time (a tank hit, bigger).
      for (let s = 0; s < shots; s++) {
        if (K[s]! > 1 && E[s]! <= t) O[s]! & 1 ? b++ : a++;
        const q = (t - E[s]!) * 2;
        if (K[s] && q >= 0 && q < 1) {
          const m = boomEl[O[s]!]!;
          m.style.display = "";
          m.style.opacity = `${1 - q * q}`;
          m.style.transform = `translate(${SX[s]! + VX[s]! * (E[s]! - F[s]!)}px,${SY[s]! + VY[s]! * (E[s]! - F[s]!)}px) scale(${(0.4 + q) * K[s]!})`;
        }
        if (F[s]! <= t && t < E[s]!) {
          const sh = shellEl[O[s]!]!;
          sh.style.display = "";
          sh.style.transform = `translate(${SX[s]! + VX[s]! * (t - F[s]!)}px,${SY[s]! + VY[s]! * (t - F[s]!)}px)`;
        }
      }
      // HUD: change-only text.
      const ga = `GREEN ${a}`, pb = `PINK ${b}`;
      if (hudA.textContent !== ga) hudA.textContent = ga;
      if (hudB.textContent !== pb) hudB.textContent = pb;
    },
  });
  // Frames only while the figure is on screen.
  const io = new IntersectionObserver((es) => ((T[3] = +es[es.length - 1]!.isIntersecting), engine.wake()));
  io.observe(fig);
  engine.signal.addEventListener("abort", () => io.disconnect());
  const on = { signal: engine.signal };
  addEventListener("resize", () => engine.wake(), { passive: true, signal: engine.signal });
  btn?.addEventListener("click", () => play(!T[2]), on);
  // A wheel over the figure steps the story (down fans the layers out); the page stays put.
  fig.addEventListener("wheel", (ev) => {
    if (ev.ctrlKey) return; // a trackpad pinch
    ev.preventDefault();
    const d = ev.deltaY || ev.deltaX;
    to(T[1]! + (d * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? innerHeight : 1)) / WHEEL);
  }, { passive: false, signal: engine.signal });
  // A finger (or a mouse drag) over the figure: up fans the layers out, like a scroll.
  let py = NaN;
  fig.addEventListener("pointerdown", (ev) => {
    if (btn?.contains(ev.target as Node)) return;
    py = ev.clientY;
    fig.setPointerCapture?.(ev.pointerId);
  }, on);
  fig.addEventListener("pointermove", (ev) => {
    if (py !== py) return;
    const d = py - ev.clientY;
    if (Math.abs(d) < 2) return;
    py = ev.clientY;
    to(T[1]! + d / WHEEL);
  }, on);
  const up = () => (py = NaN);
  fig.addEventListener("pointerup", up, on);
  fig.addEventListener("pointercancel", up, on);
  // Keys on the focused figure: step to the next or previous stop (a label, the fault, the patch).
  fig.addEventListener("keydown", (ev) => {
    if (ev.target !== fig) return; // the play key's own Space and Enter
    const k = ev.key, dir = /Right|Down/.test(k) ? 1 : /Left|Up/.test(k) ? -1 : 0;
    if (!dir && k !== "Home" && k !== "End") return;
    ev.preventDefault();
    to(dir ? stop(dir) : k === "End" ? END : 0);
  }, on);
  play(true);
  engine.start();
  return { destroy: () => engine.destroy() };
}

/** For fzlt/slot. */
export const mountSlot: SlotMount = (stage, slotEl) => mount(stage, slotEl);
