/**
 * The layers story: a Battlefield Blitz-style board plays, turns and fans out into its stacked
 * layers (CSS 3D on real DOM layers), one layer faults red, a scan patches it, it flashes green,
 * and the stack folds back into the game. Built on the kernel (settle + fps cap), fizlet/grid,
 * fizlet/sprite and fizlet/fx; mounted by fizlet/slot (see entry.ts).
 *
 * Calm: 30 fps cap, and after `loops` cycles with nobody interacting it stops asking for frames and
 * the kernel settles (no requestAnimationFrame at all) on the game frame. A pointer wakes it.
 * Recall: every node it adds goes through the engine's ledger; destroy() gives the stage back.
 */
import { createEngine, type Engine } from "../../../src/kernel/index";
import { board as makeBoard, BLOCKED, COVER } from "../../../src/grid";
import { sprites } from "../../../src/sprite";
import { effects } from "../../../src/fx";
import type { SlotMount, SlotScene } from "../../../src/slot";
import { LAYERS, FAULT, label, fit, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN, GAP } from "./data";

export interface LayersOptions {
  /** Cycles to run before settling when nobody interacts (default 3). */
  loops?: number;
  /** Quiet seconds before the kernel settles (default 0.5). */
  settle?: number;
  /** Seed for the game (default 7). */
  seed?: number;
  /** Story clock speed (default 1; tests run it faster). */
  speed?: number;
}

// Timeline (seconds into a cycle).
const PLAY = 4.2, OPEN = 5.6, FAULT_AT = 6.2, SCAN_AT = 6.9, SCAN_END = 8.7, OK_END = 9.4, FOLD_AT = 10, CLOSED = 11.4, CYCLE = 13;
const N = LAYERS.length, TANKS = 4, SHELLS = 8;
const smooth = (a: number, b: number, t: number) => {
  const k = t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  return k * k * (3 - 2 * k);
};

const TANK = sprites(
  {
    tank: {
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
      outline: "#07060f",
    },
  },
  { palettes: [{ tread: "#1d1738", team: "#39ffb0", hatch: "#07060f" }, { team: "#ff5c8f" }] },
);

export function mount(stage: HTMLElement, opts: LayersOptions = {}): SlotScene & { engine: Engine } {
  const loops = opts.loops ?? 3, speed = opts.speed ?? 1;
  const engine = createEngine({ root: stage, fps: 30, settle: opts.settle ?? 0.5, seed: opts.seed ?? 7 });
  const rand = engine.random;
  const W = stage.clientWidth || 360, H = stage.clientHeight || 420; // one read, at mount

  // ---------- the board (fizlet/grid) ----------
  const bd = makeBoard(COLS, ROWS, { cell: CELL });
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = MAP[r]![c];
    if (ch === "#") bd.set(r * COLS + c, 1, 1, BLOCKED);
    if (ch === "+") bd.set(r * COLS + c, 2, 2, COVER);
  }

  // ---------- fit: game pose and exploded pose (orthographic estimate, no DOM reads) ----------
  const { sp, se, ex, ey } = fit(W, H);

  // ---------- DOM: one stack, eight layers ----------
  const root = engine.ledger.add(document.createElement("div"));
  root.className = "lz";
  root.innerHTML = `<div class="lz-s"></div>`; // styles: SCENE_CSS (css.ts), inline on the host page
  const stack = root.lastElementChild as HTMLElement;
  const el = (parent: HTMLElement, cls: string, x = 0, y = 0) => {
    const e = document.createElement(cls === "canvas" ? "canvas" : "div");
    if (cls !== "canvas") e.className = cls;
    if (x || y) e.style.transform = `translate(${x}px,${y}px)`;
    return parent.appendChild(e) as HTMLElement;
  };
  const layers: HTMLElement[] = [], tags: HTMLElement[] = [];
  for (let i = 0; i < N; i++) {
    const l = el(stack, i ? "lz-l" : "lz-l lz-g");
    l.dataset.layer = LAYERS[i]!.id;
    const t = el(l, "lz-tag");
    t.style.fontSize = `${11 / se}px`;
    t.style.borderWidth = `${2 / se}px`;
    t.innerHTML = `${LAYERS[i]!.name} <u>· ${LAYERS[i]!.bytes.toLocaleString("en-GB")} ${LAYERS[i]!.unit}</u>`;
    t.title = label(LAYERS[i]!);
    layers.push(l), tags.push(t);
  }
  const [gridL, charL, moveL, colL, rulesL, fxL, inL, hudL] = layers as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
  for (let i = 0; i < COLS * ROWS; i++) {
    const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
    if (bd.flags[i]! & BLOCKED) (el(gridL, "lz-w", x, y), el(colL, "lz-k", x, y));
    else if (bd.flags[i]! & COVER) el(gridL, "lz-c", x, y);
  }
  // Collision: the fixed copy, revealed by the scan, over the broken one.
  const fixed = el(colL, "lz-x");
  for (let i = 0; i < COLS * ROWS; i++) if (bd.flags[i]! & BLOCKED) el(fixed, "lz-k", (i % COLS) * CELL, Math.floor(i / COLS) * CELL).style.borderStyle = "solid";
  const scan = el(colL, "lz-scan");
  // Rules: spawn pads in the corners.
  for (const [c, r] of [[0, 0], [8, 12], [8, 0], [0, 12]]) el(rulesL, "lz-p", c! * CELL, r! * CELL);
  // Effects: the fx brick draws on its own canvas inside its layer.
  const cv = el(fxL, "canvas") as HTMLCanvasElement;
  cv.className = "lz-cv";
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = BW * dpr, cv.height = BH * dpr;
  const ctx = cv.getContext("2d");
  ctx?.scale(dpr, dpr);
  const fx = effects({ cap: 160, scorch: 12, words: ["HIT", "BLAM"] });
  // Input: a thumb ring with an aim line (the intent the lead tank follows).
  const ring = el(inL, "lz-r"), aim = el(inL, "lz-a");
  // HUD.
  const hud = el(hudL, "lz-hud");
  hud.innerHTML = "<b>GREEN 0</b><span>0:00</span><i>PINK 0</i>";
  const [hudA, hudT, hudB] = hud.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

  // Characters, their hitboxes and their paths.
  const TX = new Float64Array(TANKS), TY = new Float64Array(TANKS), TA = new Float64Array(TANKS), COOL = new Float64Array(TANKS), HIT = new Float64Array(TANKS);
  const PATH = Array.from({ length: TANKS }, () => new Int32Array(24)), LEN = new Int32Array(TANKS), AT = new Int32Array(TANKS);
  const tankEl: HTMLElement[] = [], boxEl: HTMLElement[] = [], dots: HTMLElement[][] = [];
  const SPAWN = [0, COLS * ROWS - 1, COLS - 1, COLS * (ROWS - 1)];
  const tmp = new Float64Array(2);
  for (let i = 0; i < TANKS; i++) {
    bd.center(SPAWN[i]!, tmp);
    TX[i] = tmp[0]!, TY[i] = tmp[1]!, COOL[i] = 1 + i * 0.4;
    const t = el(charL, "lz-t") as HTMLElement;
    t.style.backgroundImage = `url("${TANK.url("tank", 0, i & 1)}")`;
    t.style.backgroundSize = "100% 100%";
    tankEl.push(t), boxEl.push(el(colL, "lz-h"));
    const row: HTMLElement[] = [];
    for (let k = 0; k < 6; k++) row.push(el(moveL, "lz-d"));
    dots.push(row);
  }
  // Shells: a fixed pool.
  const SX = new Float64Array(SHELLS), SY = new Float64Array(SHELLS), SVX = new Float64Array(SHELLS), SVY = new Float64Array(SHELLS), SL = new Float64Array(SHELLS), SO = new Int32Array(SHELLS);
  const shellEl: HTMLElement[] = [];
  for (let i = 0; i < SHELLS; i++) shellEl.push(el(charL, "lz-b"));
  const score = new Int32Array(2);

  // ---------- the game (fixed step, no DOM) ----------
  const phase = new Float64Array(3); // time in cycle, cycles done, game clock
  function retarget(i: number) {
    const from = bd.at(TX[i]!, TY[i]!);
    for (let k = 0; k < 4; k++) {
      const to = bd.pick(rand, BLOCKED);
      const n = to < 0 ? -1 : bd.path(from, to, PATH[i]!, 200, BLOCKED);
      if (n > 0) return (LEN[i] = Math.min(n, PATH[i]!.length)), (AT[i] = 0);
    }
    LEN[i] = 0;
  }
  function fire(i: number) {
    let best = -1, bd2 = 1e9;
    const me = bd.at(TX[i]!, TY[i]!);
    for (let j = 0; j < TANKS; j++) {
      if ((j & 1) === (i & 1)) continue;
      const d2 = (TX[j]! - TX[i]!) ** 2 + (TY[j]! - TY[i]!) ** 2;
      if (d2 < bd2 && bd.los(me, bd.at(TX[j]!, TY[j]!))) (bd2 = d2), (best = j);
    }
    if (best < 0) return;
    for (let s = 0; s < SHELLS; s++) {
      if (SL[s]! > 0) continue;
      const d = Math.sqrt(bd2) || 1, vx = (TX[best]! - TX[i]!) / d, vy = (TY[best]! - TY[i]!) / d;
      SX[s] = TX[i]! + vx * 12, SY[s] = TY[i]! + vy * 12, SVX[s] = vx * 170, SVY[s] = vy * 170, SL[s] = 1.4, SO[s] = i;
      TA[i] = Math.atan2(vy, vx) + Math.PI / 2;
      COOL[i] = 1.3 + rand() * 1.2;
      return;
    }
  }
  const faulted = () => phase[0]! >= FAULT_AT && phase[0]! < SCAN_END;
  engine.add({
    step(e, dt) {
      // Done: the last cycle ended in game mode; stop asking for frames and the kernel settles.
      if (phase[1]! >= loops) return;
      e.busy();
      phase[0]! += dt * speed;
      phase[2]! += dt;
      if (phase[0]! >= CYCLE) {
        phase[0]! -= CYCLE;
        if (++phase[1]! >= loops) phase[0] = 0; // rest exactly on the game frame
      }
      for (let i = 0; i < TANKS; i++) {
        HIT[i] = Math.max(0, HIT[i]! - dt);
        if (AT[i]! >= LEN[i]!) retarget(i);
        if (LEN[i]! > 0) {
          bd.center(PATH[i]![AT[i]!]!, tmp);
          const dx = tmp[0]! - TX[i]!, dy = tmp[1]! - TY[i]!, d = Math.hypot(dx, dy), v = 38 * dt;
          if (d <= v) (TX[i] = tmp[0]!), (TY[i] = tmp[1]!), AT[i]!++;
          else {
            TX[i]! += (dx / d) * v, TY[i]! += (dy / d) * v;
            const want = Math.atan2(dy, dx) + Math.PI / 2;
            let da = want - TA[i]!;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            TA[i]! += da * Math.min(1, dt * 8);
          }
        }
        if ((COOL[i]! -= dt) <= 0) fire(i);
      }
      const ghost = faulted(); // a broken collision layer: shells pass through walls
      for (let s = 0; s < SHELLS; s++) {
        if (SL[s]! <= 0) continue;
        SL[s]! -= dt, SX[s]! += SVX[s]! * dt, SY[s]! += SVY[s]! * dt;
        if (SX[s]! < 0 || SY[s]! < 0 || SX[s]! > BW || SY[s]! > BH) { SL[s] = 0; continue; }
        if (!ghost && bd.flags[bd.at(SX[s]!, SY[s]!)]! & BLOCKED) {
          fx.blast(SX[s]!, SY[s]!, 0.35, 4);
          SL[s] = 0;
          continue;
        }
        for (let j = 0; j < TANKS; j++) {
          if ((j & 1) === (SO[s]! & 1) || (SX[s]! - TX[j]!) ** 2 + (SY[s]! - TY[j]!) ** 2 > 110) continue;
          fx.blast(TX[j]!, TY[j]!, 0.7, j & 1 ? 3 : 5);
          if (rand() < 0.5) fx.word(TX[j]!, TY[j]! - 14, 0, 0, 12);
          score[SO[s]! & 1]!++;
          HIT[j] = 0.3;
          SL[s] = 0;
          break;
        }
      }
      fx.step(dt);
    },
    render() {
      const t = phase[0]!;
      const open = t < FOLD_AT ? smooth(PLAY, OPEN, t) : 1 - smooth(FOLD_AT, CLOSED, t);
      const s = sp + (se - sp) * open;
      stack.style.transform = `translate(${ex * open}px,${ey * open}px) scale(${s}) rotateX(${TILT * open}deg) rotateZ(${TURN * open}deg)`;
      for (let i = 0; i < N; i++) {
        const l = layers[i]!;
        l.style.transform = `translateZ(${(i - (N - 1) / 2) * GAP * open}px)`;
        tags[i]!.style.transform = `rotateZ(${-TURN * open}deg) rotateX(${-TILT * open}deg)`;
        tags[i]!.style.opacity = `${smooth(0.6, 1, open)}`;
        if (i) l.style.borderColor = open > 0.02 ? (i === FAULT ? "" : "#3b3170") : "transparent";
        if (i) l.style.backgroundColor = open > 0.02 ? "rgba(17,13,34,.42)" : "";
      }
      // Fault, scan, patch, green.
      const bad = t >= FAULT_AT && t < SCAN_END, ok = t >= SCAN_END && t < OK_END;
      const p = smooth(SCAN_AT, SCAN_END, t);
      colL.style.borderColor = bad ? "#ff2b4e" : ok ? "#39ffb0" : open > 0.02 ? "#3b3170" : "transparent";
      colL.style.backgroundColor = bad ? "rgba(255,43,78,.28)" : ok ? `rgba(57,255,176,${0.5 * (1 - smooth(SCAN_END, OK_END, t))})` : colL.style.backgroundColor;
      colL.style.opacity = `${open > 0.02 || bad ? 1 : 0}`;
      const h = `${t >= SCAN_AT && t < OK_END ? p * BH : t >= OK_END || t < FAULT_AT ? BH : 0}px`;
      if (fixed.style.height !== h) fixed.style.height = h;
      scan.style.display = t >= SCAN_AT && t < SCAN_END ? "" : "none";
      scan.style.transform = `translateY(${p * BH}px)`;
      const tag = tags[FAULT]!;
      const word = bad ? (t < SCAN_AT ? "FAULT" : "SCANNING") : ok ? "PATCHED" : "";
      if (tag.dataset.state !== word) {
        tag.dataset.state = word;
        tag.style.borderColor = bad ? "#ff2b4e" : ok ? "#39ffb0" : "";
        tag.innerHTML = word ? `${LAYERS[FAULT]!.name} <u style="color:${bad ? "#ff7389" : "#39ffb0"}">· ${word}</u>` : `${LAYERS[FAULT]!.name} <u>· ${LAYERS[FAULT]!.bytes} ${LAYERS[FAULT]!.unit}</u>`;
      }
      for (let i = 1; i < N; i++) if (i !== FAULT) layers[i]!.style.opacity = bad || ok ? "0.4" : "";
      // Game-mode helpers (paths, hitboxes, rules) show only when the stack is open.
      moveL.style.opacity = rulesL.style.opacity = `${open}`;
      // Characters, hitboxes, paths.
      for (let i = 0; i < TANKS; i++) {
        tankEl[i]!.style.transform = `translate(${TX[i]! - 13.5}px,${TY[i]! - 13.5}px) rotate(${TA[i]}rad)`;
        tankEl[i]!.style.filter = HIT[i]! > 0 ? "brightness(2.2)" : "";
        boxEl[i]!.style.transform = `translate(${TX[i]}px,${TY[i]}px)`;
        for (let k = 0; k < 6; k++) {
          const c = AT[i]! + k, on = c < LEN[i]!;
          dots[i]![k]!.style.display = on ? "" : "none";
          if (on) {
            bd.center(PATH[i]![c]!, tmp);
            dots[i]![k]!.style.transform = `translate(${tmp[0]}px,${tmp[1]}px)`;
          }
        }
      }
      for (let s = 0; s < SHELLS; s++) {
        shellEl[s]!.style.display = SL[s]! > 0 ? "" : "none";
        if (SL[s]! > 0) shellEl[s]!.style.transform = `translate(${SX[s]}px,${SY[s]}px)`;
      }
      // Input: the ring sits on the lead tank's thumb spot, the line points along its aim.
      ring.style.transform = `translate(${TX[0]}px,${TY[0]! + 40}px)`;
      aim.style.transform = `translate(${TX[0]}px,${TY[0]}px) rotate(${TA[0]! - Math.PI / 2}rad)`;
      aim.style.width = "30px";
      // HUD: change-only text.
      const sec = Math.floor(phase[2]!), clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      if (hudT.textContent !== clock) hudT.textContent = clock;
      if (hudA.dataset.n !== `${score[0]}`) (hudA.dataset.n = `${score[0]}`), (hudA.textContent = `GREEN ${score[0]}`);
      if (hudB.dataset.n !== `${score[1]}`) (hudB.dataset.n = `${score[1]}`), (hudB.textContent = `PINK ${score[1]}`);
      if (ctx) {
        ctx.clearRect(0, 0, BW, BH);
        fx.drawGround(ctx);
        fx.draw(ctx);
      }
    },
  });
  // Interaction wakes it for another round of cycles.
  const again = () => {
    if (phase[1]! < loops) return;
    phase[1] = Math.max(0, loops - 1);
    engine.wake();
  };
  stage.addEventListener("pointerdown", again, { signal: engine.signal });
  stage.addEventListener("pointerenter", again, { signal: engine.signal });
  stage.append(root);
  engine.start();
  return {
    engine,
    destroy: () => engine.destroy(),
  };
}

/** For fizlet/slot: reads `data-loops` / `data-settle` from the slot figure. */
export const mountSlot: SlotMount = (stage, slotEl) => {
  const n = (k: string) => (slotEl.dataset[k] != null ? Number(slotEl.dataset[k]) : undefined);
  return mount(stage, { loops: n("loops"), settle: n("settle"), speed: n("speed") });
};
