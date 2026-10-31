/**
 * The FILET factory's live scene: the motion over the hero's own HTML (hero.mjs). The inline
 * controller owns the game (controller.js) and tells this scene what changed with `fac` events on
 * the hero; the scene plays it: the stack knocked over, bricks hopping onto the belt and riding into
 * the machine, the machine shaking, sparking and blowing, the cartridge popping out and the Z
 * dropping back into the sign. Built on the kernel, fizlet/fx (sparks, blast, on one canvas over the
 * whole hero) and fizlet/sound; mounted by fizlet/slot (entry.ts), never under reduced motion.
 *
 * Contract: the step only moves numbers in typed arrays (no allocation, no layout reads, no DOM);
 * layout is read in the event handlers and the resize observer, the DOM written in render through
 * the engine's ledger, change-only. Idle, the kernel settles (no requestAnimationFrame at all), and
 * off screen it pauses. destroy() is Recall: every style, attribute and node it touched comes back.
 */
import { createEngine } from "../../src/kernel/index";
import { effects, emitter, SPARK } from "../../src/fx";
import { sound } from "../../src/sound";
import type { SlotMount } from "../../src/slot";

// Tile motion kinds.
const IDLE = 0, MOVE = 1, NOPE = 2, SWALLOW = 3;
// The run: swallow, shake, blast (seconds); a re-roll skips the swallow.
const SWALLOW_T = 0.7, BLAST_T = 2.1, AGAIN_BLAST = 1.0, POP = 0.55;

const smooth = (p: number) => p * p * (3 - 2 * p);
const back = (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;

export interface FactoryOptions {
  /** Clock speed (default 1; tests run it faster). */
  speed?: number;
}

export function mountFactory(stage: HTMLElement, hero: HTMLElement, opts: FactoryOptions = {}) {
  const speed = opts.speed ?? 1;
  const e = createEngine({ root: stage, settle: 0.4 });
  const L = e.ledger;
  const q = <T extends Element>(s: string) => hero.querySelector<T>(s)!;
  const tiles = [...hero.querySelectorAll<HTMLElement>(".fac-b")], N = tiles.length;
  const machine = q<HTMLElement>(".fac-machine"), cart = q<HTMLElement>(".fac-cart"), zs = q<HTMLElement>(".fac-zs"), lane = q<HTMLElement>(".fac-lane i");

  // One canvas over the whole hero for the sparks and the blast; sized in render.
  const cv = L.add(document.createElement("canvas"));
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  stage.append(cv);
  const ctx = cv.getContext("2d")!;
  const flash = L.add(document.createElement("div"));
  flash.style.cssText = "position:absolute;inset:0;opacity:0;background:radial-gradient(circle at var(--fx,50%) var(--fy,50%),var(--ink),transparent 55%)";
  stage.append(flash);

  // The kit's colours, once (the canvas takes strings; fx keeps them).
  const cs = getComputedStyle(hero), tok = (v: string) => cs.getPropertyValue(v).trim() || "#fff";
  const fx = effects({ cap: 320, colors: [tok("--hurt"), tok("--k-attack"), tok("--k-sys"), tok("--k-go"), tok("--ink")], scorch: 0 });
  const em = emitter(fx, { spark: SPARK });
  const snd = sound(e, { cues: { boom: "boom", hit: "hit", power: "power", win: "win", click: "click", hurt: "hurt" } });
  snd.on = hero.dataset.mute !== "1";

  // Per tile: kind, clock, duration, delay, start offset (x, y, deg), arc, swallow target (x, y).
  const kind = new Uint8Array(N), T = new Float32Array(N), D = new Float32Array(N), W = new Float32Array(N);
  const X = new Float32Array(N), Y = new Float32Array(N), R = new Float32Array(N), A = new Float32Array(N);
  const TX = new Float32Array(N), TY = new Float32Array(N);
  // Per tile out: x, y, deg, scale, opacity; and whether render owes it a write (1) or a reset (2).
  const ox = new Float32Array(N), oy = new Float32Array(N), or = new Float32Array(N), os = new Float32Array(N), oo = new Float32Array(N);
  const owe = new Uint8Array(N);
  // Scene state: [0] run clock (-1 idle), [1] run is a re-roll, [2] blast fired, [3] belt offset,
  // [4] belt speed, [5..6] machine centre (stage px), [7] shake, [8] flash, [9] pop clock (-1 idle),
  // [10] canvas w, [11] canvas h, [12] dpr, [13] resized, [14] drew last frame, [15] light theme,
  // [16] done owed, [17..18] mouth (stage px), [19] spark clock.
  const s = new Float64Array(20);
  s[0] = -1; s[9] = -1;

  const stageXY = (el: Element, out: Float64Array, i: number) => {
    const r = el.getBoundingClientRect(), b = stage.getBoundingClientRect();
    out[i] = r.left + r.width / 2 - b.left;
    out[i + 1] = r.top + r.height / 2 - b.top;
  };
  /** Start tile i moving from screen point (fx, fy) to where it now rests. */
  const moveFrom = (i: number, fx0: number, fy0: number, delay: number, dur: number, arc: number, spin: number) => {
    const t = tiles[i]!;
    L.unstyle(t, "translate"); L.unstyle(t, "rotate"); L.unstyle(t, "transform"); L.unstyle(t, "opacity");
    const r = t.getBoundingClientRect();
    X[i] = fx0 - (r.left + r.width / 2); Y[i] = fy0 - (r.top + r.height / 2);
    R[i] = spin; A[i] = arc; T[i] = 0; W[i] = delay; D[i] = dur; kind[i] = MOVE;
  };

  const on = (ev: Event) => {
    const d = (ev as CustomEvent).detail as { t: string; tile?: HTMLElement; tiles?: HTMLElement[]; from?: number[] | number[][]; again?: boolean };
    if (d.t === "mute") snd.on = hero.dataset.mute !== "1";
    else if (d.t === "load") {
      const i = tiles.indexOf(d.tile!), f = d.from as number[];
      moveFrom(i, f[0]!, f[1]!, 0, 0.55, 70, 30 * (e.random() - 0.5));
      s[4] = 260;
      e.events.emit("click");
    } else if (d.t === "nope") {
      const i = tiles.indexOf(d.tile!);
      kind[i] = NOPE; T[i] = 0; W[i] = 0; D[i] = 0.45;
      e.events.emit("hurt");
    } else if (d.t === "scatter") {
      const list = d.tiles!, from = d.from as number[][];
      for (let k = 0; k < list.length; k++) {
        const i = tiles.indexOf(list[k]!);
        moveFrom(i, from[k]![0]!, from[k]![1]!, 0.04 * k * e.random(), 0.6 + 0.3 * e.random(), 60 + 90 * e.random(), 160 * (e.random() - 0.5));
      }
      // The kick: a puff where the stack stood.
      const b = stage.getBoundingClientRect(), f0 = from[0];
      if (f0) fx.blast(f0[0]! - b.left, f0[1]! - b.top, 0.45, 0);
      e.events.emit("hit");
    } else if (d.t === "build") {
      stageXY(machine, s, 5);
      const m = machine.getBoundingClientRect(), b = stage.getBoundingClientRect();
      s[17] = m.left - b.left; s[18] = s[6]!;
      L.style(flash, "--fx", `${s[5]}px`); L.style(flash, "--fy", `${s[6]}px`);
      s[1] = d.again ? 1 : 0; s[0] = 0; s[2] = 0; s[19] = 0;
      if (!d.again)
        for (let i = 0; i < N; i++) {
          if (tiles[i]!.dataset.at !== "belt") continue;
          const r = tiles[i]!.getBoundingClientRect();
          TX[i] = m.left + 8 - (r.left + r.width / 2); TY[i] = s[18]! + b.top - (r.top + r.height / 2);
          kind[i] = SWALLOW; T[i] = 0; W[i] = 0.08 * Number(tiles[i]!.style.getPropertyValue("--k") || 0); D[i] = SWALLOW_T;
        }
      s[4] = d.again ? 0 : 420;
      e.events.emit("power");
    }
    e.wake();
  };
  hero.addEventListener("fac", on, { signal: e.signal });
  // The controller shows the cartridge on fac-done (render dispatches it): the pop starts then.
  hero.addEventListener("fac-done", () => { s[9] = 0; e.wake(); }, { signal: e.signal });

  // Canvas size: the observer reads it (no layout read in the frame); render applies it.
  const ro = new ResizeObserver((list) => {
    const r = list[list.length - 1]!.contentRect;
    s[10] = r.width; s[11] = r.height; s[12] = Math.min(1.5, devicePixelRatio || 1); s[13] = 1;
    e.wake();
  });
  ro.observe(stage);
  e.signal.addEventListener("abort", () => ro.disconnect());

  e.add({
    read() {
      s[15] = document.documentElement.dataset.theme === "light" ? 1 : 0;
    },
    step(e, dt) {
      dt *= speed;
      let busy = 0;
      // Tiles.
      for (let i = 0; i < N; i++) {
        const k = kind[i]!;
        if (k === IDLE) continue;
        busy = 1;
        T[i]! += dt;
        const p = Math.min(1, Math.max(0, (T[i]! - W[i]!) / D[i]!));
        if (k === MOVE) {
          const q = smooth(p), u = 1 - q;
          ox[i] = X[i]! * u; oy[i] = Y[i]! * u - A[i]! * Math.sin(Math.PI * p); or[i] = R[i]! * u; os[i] = 1; oo[i] = 1;
        } else if (k === NOPE) {
          ox[i] = 0; oy[i] = 0; or[i] = 10 * Math.sin(p * 18) * (1 - p); os[i] = 1; oo[i] = 1;
        } else {
          const q = p * p;
          ox[i] = TX[i]! * q; oy[i] = TY[i]! * q; or[i] = 0; os[i] = 1 - 0.7 * q; oo[i] = 1 - q;
        }
        owe[i] = 1;
        if (p >= 1) {
          kind[i] = IDLE;
          // A swallowed brick stays shrunk and clear (it is in the machine) until it next moves.
          if (k !== SWALLOW) owe[i] = 2;
        }
      }
      // The run.
      if (s[0]! >= 0) {
        busy = 1;
        s[0]! += dt;
        const t = s[0]!, blast = s[1] ? AGAIN_BLAST : BLAST_T, start = s[1] ? 0 : SWALLOW_T * 0.7;
        const k = t < start ? 0 : t < blast ? (t - start) / (blast - start) : 0;
        s[7] = k * k * 9;
        if (t > start && t < blast) {
          s[19]! += dt;
          if (s[19]! > 0.07) {
            s[19] = 0;
            em.emit(em.ids.spark, s[5]! + (e.random() - 0.5) * 120, s[6]! - 40 + (e.random() - 0.5) * 60, 4 + (k * 8) | 0, 0, 2);
            if (e.random() < 0.3) e.events.emit("hit", 0, 0, 0, 0, 0.4);
          }
        }
        if (t >= blast && !s[2]) {
          s[2] = 1; s[8] = 1; s[16] = 1;
          fx.blast(s[5]!, s[6]!, 1.3, 0);
          fx.kick(14);
          e.events.emit("boom");
        }
        if (t > blast + 0.2) s[0] = -1;
      }
      if (s[8]! > 0) { busy = 1; s[8] = Math.max(0, s[8]! - dt * 3); }
      if (s[9]! >= 0) { busy = 1; s[9]! += dt; if (s[9]! > POP + 0.1) { s[9] = -1; e.events.emit("win"); } }
      // The belt runs while bricks ride it.
      if (s[4]! > 0) { busy = 1; s[3] = (s[3]! + s[4]! * dt) % 22; s[4] = Math.max(0, s[4]! - 300 * dt); }
      fx.step(dt);
      if (busy || fx.live > 0 || s[13]) e.busy();
    },
    render() {
      for (let i = 0; i < N; i++) {
        if (!owe[i]) continue;
        const t = tiles[i]!;
        if (owe[i] === 2) {
          L.unstyle(t, "translate"); L.unstyle(t, "rotate"); L.unstyle(t, "transform"); L.unstyle(t, "opacity");
        } else {
          L.style(t, "translate", `${ox[i]!.toFixed(1)}px ${oy[i]!.toFixed(1)}px`);
          if (or[i] !== 0 || kind[i] === NOPE) L.style(t, "rotate", `${or[i]!.toFixed(1)}deg`);
          else L.unstyle(t, "rotate");
          if (os[i] !== 1) L.style(t, "transform", `scale(${os[i]!.toFixed(3)})`);
          if (oo[i] !== 1) L.style(t, "opacity", oo[i]!.toFixed(2));
        }
        owe[i] = 0;
      }
      // Machine shake.
      const sh = s[7]!;
      if (sh > 0.05) L.style(machine, "translate", `${((e.random() - 0.5) * sh).toFixed(1)}px ${((e.random() - 0.5) * sh * 0.6).toFixed(1)}px`);
      else { L.unstyle(machine, "translate"); s[7] = 0; }
      L.style(lane, "--belt", `${s[3]!.toFixed(1)}px`);
      L.style(flash, "opacity", s[8]!.toFixed(2));
      // A re-roll: the old cartridge goes into the machine's shake; the new one pops.
      if (s[0]! >= 0 && s[1] && !s[2]) L.style(cart, "opacity", "0");
      if (s[16]) {
        s[16] = 0;
        hero.dispatchEvent(new CustomEvent("fac-done"));
      }
      if (s[9]! >= 0) {
        const p = Math.min(1, s[9]! / POP), b = back(p);
        L.style(cart, "opacity", "1");
        L.style(cart, "translate", `${(-60 * (1 - p)).toFixed(1)}px ${(-30 * Math.sin(Math.PI * p)).toFixed(1)}px`);
        L.style(cart, "scale", (0.2 + 0.8 * b).toFixed(3));
        L.style(cart, "rotate", `${(-24 * (1 - b)).toFixed(1)}deg`);
        L.style(zs, "translate", `0 ${(-36 * (1 - b)).toFixed(1)}px`);
      } else if (s[0]! < 0) {
        L.unstyle(cart, "translate"); L.unstyle(cart, "scale"); L.unstyle(cart, "rotate"); L.unstyle(cart, "opacity"); L.unstyle(zs, "translate");
      }
      // The canvas.
      if (s[13]) {
        s[13] = 0;
        cv.width = Math.round(s[10]! * s[12]!); cv.height = Math.round(s[11]! * s[12]!);
        s[14] = 1;
      }
      if (fx.live > 0 || s[14]) {
        ctx.setTransform(s[12]!, 0, 0, s[12]!, 0, 0);
        ctx.clearRect(0, 0, s[10]!, s[11]!);
        fx.draw(ctx, s[15] === 1);
        s[14] = fx.live > 0 ? 1 : 0;
      }
    },
  });
  e.start();
  hero.dispatchEvent(new CustomEvent("fac-ready"));
  return {
    engine: e,
    destroy() {
      snd.dispose();
      e.destroy();
    },
  };
}

/** fizlet/slot's mount: the stage is the slot's (inside the hero); the hero is the slot. */
export const mountSlot: SlotMount = (stage, slot) => mountFactory(stage, slot, { speed: Number(slot.dataset.speed) || 1 });
