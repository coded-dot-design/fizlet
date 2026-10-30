/**
 * The layers story: a Battlefield Blitz-style board plays, turns and fans out into its stacked
 * layers (CSS 3D on real DOM layers), one layer faults red, a scan patches it, it flashes green,
 * and the stack folds back into the game. Built on the kernel (settle + fps cap), fizlet/sprite and
 * fizlet/fx; mounted by fizlet/slot (see entry.ts). The tanks patrol fixed loops, so the hero needs
 * no path search (the grid brick stays out of its 10 KB live budget).
 *
 * Calm: 30 fps cap, and after `loops` cycles it stops asking for frames and the kernel settles (no
 * requestAnimationFrame at all) on the game frame. Paused, it settles too.
 * Controls (poster.ts): the figure's play key and slider send a `lyr` event (0–100 scrubs the
 * explode/assemble timeline and pauses, -1 toggles play); the scene writes their state back through
 * its ledger (`--e` on the figure, aria-valuenow, the key's label).
 * Recall: every node it adds goes through the engine's ledger; destroy() gives the stage back.
 */
import { createEngine } from "../../../src/kernel/index";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import { effects } from "../../../src/fx";
import type { SlotMount, SlotScene } from "../../../src/slot";
import { FAULT, RESERVE, fit, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN } from "./data";

export interface LayersOptions {
  /** Cycles to run before settling when nobody interacts (default 3). */
  loops?: number;
  /** Quiet seconds before the kernel settles (default 0.5). */
  settle?: number;
  /** Story clock speed (default 1; tests run it faster). */
  speed?: number;
}

// Timeline (seconds into a cycle).
const PLAY = 4.2, OPEN = 5.6, FAULT_AT = 6.2, SCAN_AT = 6.9, SCAN_END = 8.7, OK_END = 9.4, FOLD_AT = 10, CLOSED = 11.4, CYCLE = 13;
/** Layer ids, bottom to top (data.ts LAYERS; the labels' text comes from the poster's own). */
const IDS = "grid characters movement collision rules fx input hud".split(" ");
const N = IDS.length, TANKS = 4, SHELLS = 8;
/** Patrol loops (cells: left, top, right, bottom), one per tank; even tanks are green. */
const LOOP = [[0, 3, 4, 5], [5, 9, 8, 12], [4, 3, 8, 5], [0, 9, 3, 12]];
const wall = (x: number, y: number) => MAP[(y / CELL) | 0]?.[(x / CELL) | 0] === "#";
const smooth = (a: number, b: number, t: number) => {
  const k = t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  return k * k * (3 - 2 * k);
};

// The tank, as data. The scene places it as SVG backgrounds (spriteURL), so the canvas half of
// fizlet/sprite stays out of the live chunk.
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

/** The cycle time that shows explode amount `v` (0–1): on the opening ramp (inverse smoothstep), or
 *  just after it opens (labels in, before the fault) for fully open. */
const timeAt = (v: number) => (v > 0.995 ? OPEN + 0.4 : PLAY + (OPEN - PLAY) * (0.5 - Math.sin(Math.asin(1 - 2 * v) / 3)));

export function mount(stage: HTMLElement, opts: LayersOptions = {}, fig: HTMLElement = stage): SlotScene {
  const loops = opts.loops ?? 3, speed = opts.speed ?? 1;
  const engine = createEngine({ root: stage, fps: 30, settle: opts.settle ?? 0.5 });
  const rand = engine.random;
  const W = stage.clientWidth, H = stage.clientHeight; // one read, at mount (the slot sizes the stage)
  // The tanks wear the Board UI kit's tokens (sprites take hex: read them once, here).
  // The figure is a .bui root on a page with board-ui.css (every colour here is a kit token).
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
  const names = fig.querySelectorAll(".lyr__t"), slider = fig.querySelector<HTMLElement>("[role=slider]"), key = fig.querySelector<HTMLElement>(".lyr__play");
  const bytesText = names[FAULT]?.lastElementChild?.textContent ?? "";
  for (let i = 0; i < N; i++) {
    const l = el(stack, i ? "lz-l" : "lz-l lz-g");
    l.dataset.layer = IDS[i]!;
    const t = el(l, "lz-tag");
    t.innerHTML = names[i]?.innerHTML ?? ""; // the poster's own label (name · measured bytes)
    layers.push(l), tags.push(t);
  }
  // ---------- fit: game pose and exploded pose ----------
  // One layout read, here at mount: the widest label at its on-screen size (--se 1 = 11px text), so
  // the stack leaves room for the labels in whatever monospace font this device has.
  stage.append(root);
  let lw = 0;
  for (const t of tags) lw = Math.max(lw, t.offsetWidth);
  // Controls keep a column on each side (landscape) or a row at the bottom (portrait).
  const land = W > H, R = RESERVE;
  const { sp, se, ex, g } = fit(land ? W - 2 * R : W, land ? H : H - R, lw + 14); // + 10px margin, 4px slack
  const oy = land ? 0 : -R / 2;
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
  // Effects: the fx brick draws on its own canvas inside its layer.
  const cv = fxL.appendChild(document.createElement("canvas"));
  cv.className = "lz-cv";
  const dpr = Math.min(2, devicePixelRatio);
  cv.width = BW * dpr, cv.height = BH * dpr;
  const ctx = cv.getContext("2d")!; // a fresh canvas always has a 2D context
  ctx.scale(dpr, dpr);
  const fx = effects({ cap: 160, scorch: 12 });
  // Input: the aim line (the intent the lead tank follows).
  const aim = el(inL, "lz-a");
  // The kit's own arcade fire key (Board UI), as the player's on-screen control.
  el(inL, "bui-key bui-arcade bui-fire lz-fire").textContent = "FIRE";
  // HUD.
  const hud = el(hudL, "lz-hud");
  hud.innerHTML = "<b>GREEN 0</b><span>VS</span><i>PINK 0</i>";
  const [hudA, , hudB] = hud.children as unknown as [HTMLElement, HTMLElement, HTMLElement];

  // Characters, their hitboxes and their patrol loops (the movement layer).
  const TX = new Float64Array(TANKS), TY = new Float64Array(TANKS), TA = new Float64Array(TANKS), COOL = new Float64Array(TANKS);
  const AT = new Int32Array(TANKS); // the loop corner each tank drives to next
  const tankEl: HTMLElement[] = [], boxEl: HTMLElement[] = [];
  // Loop corners clockwise from the top left: k & 3 = 0 TL, 1 TR, 2 BR, 3 BL (cell centres, px).
  const corner = (i: number, k: number, y: number) => {
    const q = k & 3, L = LOOP[i]!;
    return (L[y ? (q > 1 ? 3 : 1) : q === 1 || q === 2 ? 2 : 0]! + 0.5) * CELL;
  };
  for (let i = 0; i < TANKS; i++) {
    const [c0, r0, c1, r1] = LOOP[i]!;
    TX[i] = (c0! + 0.5) * CELL, TY[i] = (r0! + 0.5) * CELL, AT[i] = 1, COOL[i] = 1 + i * 0.4;
    const t = el(charL, "lz-t");
    t.style.background = `url("${spriteURL(TANK, 0, pals, i & 1)}") 0 0/100% 100%`;
    tankEl.push(t), boxEl.push(el(colL, "lz-h"));
    const loop = el(moveL, "lz-o", TX[i]!, TY[i]!);
    loop.style.width = `${(c1! - c0!) * CELL}px`;
    loop.style.height = `${(r1! - r0!) * CELL}px`;
  }
  // Shells: a fixed pool.
  const SX = new Float64Array(SHELLS), SY = new Float64Array(SHELLS), SVX = new Float64Array(SHELLS), SVY = new Float64Array(SHELLS), SL = new Float64Array(SHELLS), SO = new Int32Array(SHELLS);
  const shellEl: HTMLElement[] = [];
  for (let i = 0; i < SHELLS; i++) shellEl.push(el(charL, "lz-b"));
  const score = new Int32Array(2);

  // ---------- the game (fixed step, no DOM) ----------
  const phase = new Float64Array(2); // time in cycle, cycles done
  // Start where the controls are (the visitor may have scrubbed or paused before the chunk loaded).
  const v0 = +(slider?.getAttribute("aria-valuenow") ?? 0);
  let play = key?.getAttribute("aria-label") !== "Play";
  if (v0 > 0) phase[0] = timeAt(v0 / 100);
  function fire(i: number) {
    let best = 0, d2 = 1e9;
    for (let j = 1 - (i & 1); j < TANKS; j += 2) {
      const d = (TX[j]! - TX[i]!) ** 2 + (TY[j]! - TY[i]!) ** 2;
      if (d < d2) (d2 = d), (best = j);
    }
    for (let s = 0; s < SHELLS; s++) {
      if (SL[s]! > 0) continue;
      const d = Math.sqrt(d2) || 1, vx = (TX[best]! - TX[i]!) / d, vy = (TY[best]! - TY[i]!) / d;
      SX[s] = TX[i]! + vx * 12, SY[s] = TY[i]! + vy * 12, SVX[s] = vx * 170, SVY[s] = vy * 170, SL[s] = 1.4, SO[s] = i;
      TA[i] = Math.atan2(vy, vx) + Math.PI / 2;
      COOL[i] = 1.3 + rand() * 1.2;
      return;
    }
  }
  engine.add({
    step(e, dt) {
      // Paused, or done (the last cycle ended in game mode): no busy(), so the kernel settles.
      if (!play || phase[1]! >= loops) return;
      e.busy();
      phase[0]! += dt * speed;
      if (phase[0]! >= CYCLE) {
        phase[0]! -= CYCLE;
        if (++phase[1]! >= loops) phase[0] = 0; // rest exactly on the game frame
      }
      for (let i = 0; i < TANKS; i++) {
        const gx = corner(i, AT[i]!, 0), gy = corner(i, AT[i]!, 1);
        const dx = gx - TX[i]!, dy = gy - TY[i]!, d = Math.hypot(dx, dy), v = 38 * dt;
        if (d <= v) (TX[i] = gx), (TY[i] = gy), AT[i]!++;
        else {
          TX[i]! += (dx / d) * v, TY[i]! += (dy / d) * v;
          let da = Math.atan2(dy, dx) + Math.PI / 2 - TA[i]!;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          TA[i]! += da * Math.min(1, dt * 8);
        }
        if ((COOL[i]! -= dt) <= 0) fire(i);
      }
      const ghost = phase[0]! >= FAULT_AT && phase[0]! < SCAN_END; // a broken collision layer: shells pass through walls
      for (let s = 0; s < SHELLS; s++) {
        if (SL[s]! <= 0) continue;
        SL[s]! -= dt, SX[s]! += SVX[s]! * dt, SY[s]! += SVY[s]! * dt;
        if (SX[s]! < 0 || SY[s]! < 0 || SX[s]! > BW || SY[s]! > BH) { SL[s] = 0; continue; }
        if (!ghost && wall(SX[s]!, SY[s]!)) {
          fx.blast(SX[s]!, SY[s]!, 0.35, 4);
          SL[s] = 0;
          continue;
        }
        for (let j = 0; j < TANKS; j++) {
          if ((j & 1) === (SO[s]! & 1) || (SX[s]! - TX[j]!) ** 2 + (SY[s]! - TY[j]!) ** 2 > 110) continue;
          fx.blast(TX[j]!, TY[j]!, 0.7, j & 1 ? 3 : 5);
          score[SO[s]! & 1]!++;
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
      // Labels only while the stack is fully open: in after it opens, out before the fold starts,
      // so they never move, scale or crowd while the layers travel.
      const label = smooth(OPEN, OPEN + 0.3, t) * (1 - smooth(FOLD_AT - 0.3, FOLD_AT, t));
      stack.style.transform = `translate(${ex * open}px,${oy}px) scale(${s}) rotateX(${TILT * open}deg) rotateZ(${TURN * open}deg)`;
      for (let i = 0; i < N; i++) {
        const l = layers[i]!;
        l.style.transform = `translateZ(${(i - (N - 1) / 2) * g * open}px)`;
        tags[i]!.style.transform = `rotateZ(${-TURN * open}deg) rotateX(${-TILT * open}deg)`;
        tags[i]!.style.opacity = `${label}`;
      }
      // Fault, scan, patch, green.
      const bad = t >= FAULT_AT && t < SCAN_END, ok = t >= SCAN_END && t < OK_END;
      const p = smooth(SCAN_AT, SCAN_END, t);
      // State classes (namespaced: a host page may style .o or .k): lz--o open (layer plates show),
      // lz--f fault or fix (others dim), lz--b broken, lz--k patched.
      root.className = `lz${open > 0.02 ? " lz--o" : ""}${bad || ok ? " lz--f" : ""}${bad ? " lz--b" : ok ? " lz--k" : ""}`;
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
      moveL.style.opacity = rulesL.style.opacity = `${open}`;
      // Characters and hitboxes.
      for (let i = 0; i < TANKS; i++) {
        tankEl[i]!.style.transform = `translate(${TX[i]! - 13.5}px,${TY[i]! - 13.5}px) rotate(${TA[i]}rad)`;
        boxEl[i]!.style.transform = `translate(${TX[i]}px,${TY[i]}px)`;
      }
      for (let s = 0; s < SHELLS; s++) {
        shellEl[s]!.style.display = SL[s]! > 0 ? "" : "none";
        if (SL[s]! > 0) shellEl[s]!.style.transform = `translate(${SX[s]}px,${SY[s]}px)`;
      }
      // Input: the line points along the lead tank's aim.
      aim.style.transform = `translate(${TX[0]}px,${TY[0]}px) rotate(${TA[0]! - Math.PI / 2}rad)`;
      // HUD: change-only text.
      const a = `GREEN ${score[0]}`, b = `PINK ${score[1]}`;
      if (hudA.textContent !== a) hudA.textContent = a;
      if (hudB.textContent !== b) hudB.textContent = b;
      ctx.clearRect(0, 0, BW, BH);
      fx.drawGround(ctx);
      fx.draw(ctx);
      // The controls follow the story (through the ledger: Recall gives them back).
      const L = engine.ledger, pct = `${Math.round(open * 100)}`;
      L.style(fig, "--e", `${open}`);
      if (slider) L.attr(slider, "aria-valuenow", pct);
      if (key) L.attr(key, "aria-label", play && phase[1]! < loops ? "Pause" : "Play");
    },
  });
  // The controls: -1 toggles play (a finished run starts its cycles again), 0–100 scrubs and pauses.
  fig.addEventListener("lyr", (ev) => {
    const d = (ev as CustomEvent<number>).detail;
    if (d >= 0) (play = false), (phase[0] = timeAt(d / 100));
    else if (play && phase[1]! < loops) play = false;
    else (play = true), phase[1]! >= loops && (phase[1] = 0);
    engine.wake();
  }, { signal: engine.signal });
  engine.start();
  return { destroy: () => engine.destroy() };
}

/** For fizlet/slot: reads `data-loops` / `data-speed` from the slot figure. */
export const mountSlot: SlotMount = (stage, slotEl) => {
  const d = slotEl.dataset; // missing or 0 → the defaults (3 cycles, speed 1)
  return mount(stage, { loops: +d.loops! || 3, speed: +d.speed! || 1 }, slotEl);
};
