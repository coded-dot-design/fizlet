// "Grid duel": a homage to the glowing-grid computer-world films of the 80s. Two light-cycles race
// on a 48 × 27 grid laid over a real page. Each one leaves a solid wall of light behind it, and the
// page's own elements are walls too: the scene reads their boxes into the grid, so a cycle that
// rides into the heading crashes on a real letter (and only that letter is knocked, then springs
// back). A crash breaks the cycle into pixels and unravels its wall from the nose back; the grid
// ripples out from the impact. Tap to steer VEGA (cyan): each tap turns her toward the side you
// tapped, at the next grid line; double-tap for a U-turn. Every round is sudden death (one crash
// ends it) against a rival drawn at random: KILN hunts (cuts ahead of you), MOTH hugs walls, JINX
// gambles. Ride long and the grid closes in from the edges. On load a demo round rides itself; tap
// to take the wheel.
// Bricks: the kernel (fixed step, settle: no frames once the round is over and still; the ledger:
// the canvas, the score text and every nudge go back on Recall) and fizlet/slot. Step allocates
// nothing: the grid, both walls, the flood fill and every pixel are typed arrays.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";

const COLS = 48, ROWS = 27, N = COLS * ROWS, PARTS = 600, RINGS = 6, FLOOD = 320;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
/** Phases. */
const WAIT = 0, COUNT = 1, RIDE = 2, OVER = 3;
/** Grid cells: free, VEGA's wall, the rival's wall, a page element, the closing edge. */
const FREE = 0, EL = 3, EDGE = 4;
const NAMES = ["VEGA", "KILN", "MOTH", "JINX"], MOODS = ["", "hunter", "hugger", "gambler"];
/** How often each mind turns just because (VEGA's autopilot, then the rivals'). */
const ITCH = [0.16, 0.08, 0.05, 0.22];
/** A nudge, in 0.05cqw steps (made once: the render writes one of these strings, never a new one). */
const KS = Array.from({ length: 121 }, (_, i) => `${((i - 60) * 0.05).toFixed(2)}cqw`);
const MONO = "ui-monospace, Menlo, Consolas, monospace";
/** The poster: the demo round this many seconds in (scripts/gallery-posters.mjs). */
export const posterAt = 10;

export function gridDuel(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const engine = createEngine({ root: stage, fps: 60, settle: 0.5, seed: (Math.random() * 4294967295) >>> 0 || 1 });
  const L = engine.ledger, R = engine.random;
  const wrap = slot.querySelector<HTMLElement>("[data-lc]")!, hud = slot.querySelector<HTMLElement>("[data-lc-hud]")!;
  const hudText = hud.firstChild as Text;
  const els = [...wrap.querySelectorAll<HTMLElement>("i")], ne = els.length;
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // The grid: who holds each cell, and which page element sits on it.
  const OCC = new Uint8Array(N), ELC = new Int16Array(N).fill(-1);
  // The two cycles (0 VEGA, 1 the rival): cell, heading, progress to the next cell, the cell it is
  // riding into, alive, drawn angle, cells since its last turn, its wall (cells in order), unravel.
  const HX = new Int16Array(2), HY = new Int16Array(2), D = new Uint8Array(2), F = new Float32Array(2), TG = new Int16Array(2);
  const ON = new Uint8Array(2), VA = new Float32Array(2), TC = new Uint16Array(2);
  const WALL = new Int16Array(2 * N), WL = new Uint16Array(2), UN = new Float32Array(2), UNL = new Uint16Array(2);
  // Taps waiting for VEGA's next grid line (cells), and the flood fill's queue and marks.
  const TQ = new Float32Array(4), FQ = new Int16Array(N), FV = new Uint32Array(N), gen = new Uint32Array(1);
  // The page elements: nudge (cqw), its speed, a flash; what was written last.
  const OX = new Float32Array(ne), OY = new Float32Array(ne), VX = new Float32Array(ne), VY = new Float32Array(ne), FL = new Float32Array(ne);
  const LX = new Int16Array(ne), LY = new Int16Array(ne), LH = new Uint8Array(ne);
  // Pixels (cycle shards, wall bits, sparks) and ripples.
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PM = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const RX = new Float32Array(RINGS), RY = new Float32Array(RINGS), RA = new Float32Array(RINGS), RC = new Uint8Array(RINGS);
  const n = new Uint32Array(3); // pixels, taps queued, next ring
  // Scene: [0] w, [1] h, [2] cell w, [3] cell h, [4] dpr, [5] measure, [6] phase, [7] phase time,
  // [8] ride time, [9] round, [10] VEGA's wins, [11] rivals' wins, [12] winner (0, 1, 2 draw),
  // [13] rival (1-3), [14] autopilot, [15] shake, [16] flash, [17] edge rings closed, [18] hud dirty,
  // [19] time, [20] glow, [21] demo, [22] took the wheel, [23] speed.
  const G = new Float64Array(24);
  const q = new Float64Array(3);
  G[5] = 1, G[13] = 1, G[18] = 1;
  let col = ["#19f0ff", "#ff8a1f", "#ff2e88", "#ffc21a", "#ff2e88", "#f6f3ff", "#0b1830"];
  const INK = 5, DIM = 6;
  let font = "", big = "", hudNow = "", stamp = "", sub = "", still = 0;

  const at = (ev: PointerEvent) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    (q[0] = 1), (q[1] = ev.clientX - r.left), (q[2] = ev.clientY - r.top);
    engine.wake();
  };
  slot.addEventListener("pointerdown", at, { signal: engine.signal });
  const ro = new ResizeObserver(() => ((G[5] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS && OCC[y * COLS + x] === FREE;
  function part(x: number, y: number, vx: number, vy: number, life: number, c: number) {
    const i = n[0]!;
    if (i >= PARTS) return;
    n[0] = i + 1;
    (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = PM[i] = life), (PC[i] = c);
  }
  function ring(x: number, y: number, c: number) {
    const i = n[2]! % RINGS;
    n[2] = n[2]! + 1;
    (RX[i] = x), (RY[i] = y), (RA[i] = 0), (RC[i] = c);
  }
  /** Free cells reachable from (x, y), up to FLOOD: how much room a move leaves. */
  function flood(x: number, y: number) {
    const g = ++gen[0]!;
    let h = 0, t = 0;
    FQ[t++] = y * COLS + x;
    FV[y * COLS + x] = g;
    while (h < t && t < FLOOD) {
      const c = FQ[h++]!, cx = c % COLS, cy = (c / COLS) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k]!, ny = cy + DY[k]!, j = ny * COLS + nx;
        if (!free(nx, ny) || FV[j] === g) continue;
        FV[j] = g;
        FQ[t++] = j;
      }
    }
    return t;
  }
  /** A rider's choice at a grid line: room first, then its mood (VEGA's autopilot wanders). */
  function think(c: number) {
    const d = D[c]!, mood = c ? G[13]! : 0, o = 1 - c, tx = HX[o]! + DX[D[o]!]! * 4, ty = HY[o]! + DY[D[o]!]! * 4;
    const itch = TC[c]! > 3 && R() < ITCH[mood]! ? 70 : 0;
    let best = d, bs = -1e9;
    for (let k = 0; k < 3; k++) {
      const nd = k === 0 ? d : (d + (k === 1 ? 1 : 3)) & 3, nx = HX[c]! + DX[nd]!, ny = HY[c]! + DY[nd]!;
      if (!free(nx, ny)) continue;
      const room = flood(nx, ny);
      let s = room * 4 - (room < FLOOD ? 600 : 0);
      if (k === 0) s += 30;
      else if (TC[c]! < 2) s -= 60;
      else s += itch + R() * 20;
      if (mood === 1 && ON[o]) s -= (Math.abs(nx - tx) + Math.abs(ny - ty)) * 6;
      else if (mood === 2) for (let j = 0; j < 4; j++) s += free(nx + DX[j]!, ny + DY[j]!) ? 0 : 14;
      else if (mood === 3) s += R() * 160;
      if (s > bs) (bs = s), (best = nd);
    }
    return best;
  }
  const px = (c: number) => (HX[c]! + 0.5 + DX[D[c]!]! * F[c]!) * G[2]!;
  const py = (c: number) => (HY[c]! + 0.5 + DY[D[c]!]! * F[c]!) * G[3]!;
  /** At a grid line: pick the heading (a tap, the autopilot or the rival's mind), then claim the next cell or crash. */
  function line(c: number) {
    let d = D[c]!;
    if (c === 0 && !G[14]) {
      if (n[1]) {
        const tx = TQ[0]!, ty = TQ[1]!;
        (TQ[0] = TQ[2]!), (TQ[1] = TQ[3]!), (n[1] = n[1]! - 1);
        if (d & 1) {
          const dx = tx - (HX[0]! + 0.5);
          if (Math.abs(dx) >= 0.5) d = dx > 0 ? 0 : 2;
        } else {
          const dy = ty - (HY[0]! + 0.5);
          if (Math.abs(dy) >= 0.5) d = dy > 0 ? 1 : 3;
        }
      }
    } else d = think(c);
    if (d !== D[c]) {
      TC[c] = 0;
      const s = G[2]!, x = (HX[c]! + 0.5) * s, y = (HY[c]! + 0.5) * G[3]!;
      for (let k = 0; k < 4; k++) part(x, y, (R() - 0.5) * 6 * s, (R() - 0.5) * 6 * s, 0.25, 5);
    } else TC[c] = TC[c]! + 1;
    D[c] = d;
    const nx = HX[c]! + DX[d]!, ny = HY[c]! + DY[d]!, j = ny * COLS + nx;
    if (!free(nx, ny)) {
      // Head on: both riders reach for the same cell.
      const o = 1 - c;
      if (ON[o] && TG[o] === j) crash(o, j);
      return crash(c, nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS ? j : -1);
    }
    OCC[j] = c + 1;
    TG[c] = j;
    WALL[c * N + WL[c]!] = j;
    WL[c] = WL[c]! + 1;
    // Grinding: a wall or an element right beside the new cell throws sparks off the side.
    for (let k = 1; k < 4; k += 2) {
      const sd = (d + k) & 3, sx = nx + DX[sd]!, sy = ny + DY[sd]!;
      if (sx < 0 || sy < 0 || sx >= COLS || sy >= ROWS || OCC[sy * COLS + sx] === FREE) continue;
      const w = G[2]!, ex = (HX[c]! + 0.5 + DX[sd]! * 0.5) * w, ey = (HY[c]! + 0.5 + DY[sd]! * 0.5) * G[3]!;
      for (let m = 0; m < 3; m++) part(ex, ey, (-DX[d]! * (2 + R() * 4) + DX[sd]! * R() * 3) * w, (-DY[d]! * (2 + R() * 4) + DY[sd]! * R() * 3) * w, 0.2 + R() * 0.2, 5);
    }
  }
  /** A crash: the cycle breaks into pixels, its wall unravels, the grid ripples; a page element it hit is knocked. */
  function crash(c: number, j: number) {
    if (!ON[c]) return;
    ON[c] = 0;
    UN[c] = 0;
    UNL[c] = WL[c]!;
    const s = G[2]!, d = D[c]!, x = (HX[c]! + 0.5 + DX[d]! * 0.5) * s, y = (HY[c]! + 0.5 + DY[d]! * 0.5) * G[3]!, ci = c ? G[13]! : 0;
    for (let k = 0; k < 90; k++) {
      const a = R() * 6.283, v = (1.5 + R() * 9) * s;
      part(x - DX[d]! * R() * 1.2 * s, y - DY[d]! * R() * 1.2 * s, Math.cos(a) * v - DX[d]! * 3 * s, Math.sin(a) * v - DY[d]! * 3 * s, 0.5 + R() * 1.1, k % 5 ? ci : 5);
    }
    ring(x, y, ci);
    (G[15] = 0.3), (G[16] = 0.14);
    const e = j >= 0 ? ELC[j]! : -1;
    if (e >= 0) (VX[e] = VX[e]! + DX[d]! * 60), (VY[e] = VY[e]! + DY[d]! * 60), (FL[e] = 0.7);
    if (G[6] === RIDE) {
      (G[6] = OVER), (G[7] = 0);
      // The other rider stops at its next grid line; this step's head-on crash makes it a draw.
      G[12] = c ? 0 : 1;
    } else if (G[12] === c) G[12] = 2;
  }
  /** A new round: the grid is cleared to the page's elements, the rival is drawn, 3, 2, 1. */
  function round(demo: number) {
    // The last round's standing wall goes up in light.
    for (let c = 0; c < 2; c++) for (let k = 0; k < WL[c]!; k += 2) {
      const j = WALL[c * N + k]!;
      part(((j % COLS) + 0.5) * G[2]!, (((j / COLS) | 0) + 0.5) * G[3]!, (R() - 0.5) * 2 * G[2]!, -R() * 3 * G[2]!, 0.3 + R() * 0.5, c ? G[13]! : 0);
    }
    for (let j = 0; j < N; j++) OCC[j] = ELC[j]! >= 0 ? EL : FREE;
    for (let c = 0; c < 2; c++) (WL[c] = 0), (UNL[c] = 0), (ON[c] = 1), (F[c] = 0), (TC[c] = 9);
    (HX[0] = 3), (HY[0] = 21), (D[0] = 0), (HX[1] = COLS - 4), (HY[1] = 5), (D[1] = 2);
    for (let c = 0; c < 2; c++) {
      const j = HY[c]! * COLS + HX[c]!;
      OCC[j] = c + 1;
      (WALL[c * N] = j), (WL[c] = 1), (TG[c] = j), (VA[c] = D[c]! * 1.5708);
    }
    (G[13] = 1 + ((R() * 3) | 0)), (G[6] = COUNT), (G[7] = 0), (G[8] = 0), (G[12] = -1), (G[17] = 0), (G[21] = demo), (G[14] = demo), (G[22] = 0);
    G[9] = G[9]! + (demo ? 0 : 1);
    n[1] = 0;
    G[18] = 1;
  }
  /** The edge closes in one ring: what it reaches becomes wall. */
  function close(k: number) {
    for (let y = k; y < ROWS - k; y++)
      for (let x = k; x < COLS - k; x++) {
        if (x !== k && y !== k && x !== COLS - 1 - k && y !== ROWS - 1 - k) continue;
        const j = y * COLS + x;
        if (OCC[j] === FREE) OCC[j] = EDGE;
      }
  }

  engine.add({
    read() {
      if (!G[5]) return;
      G[5] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), cw = r.width / COLS, ch = r.height / ROWS;
      (G[0] = r.width), (G[1] = r.height), (G[2] = cw), (G[3] = ch), (G[4] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      // The page's elements onto the grid: a cell is an element's when its centre is inside the box.
      ELC.fill(-1);
      for (let e = 0; e < ne; e++) {
        const b = els[e]!.getBoundingClientRect(), x0 = Math.max(0, Math.round((b.left - r.left) / cw)), x1 = Math.min(COLS, Math.round((b.right - r.left) / cw));
        const y0 = Math.max(0, Math.round((b.top - r.top) / ch)), y1 = Math.min(ROWS, Math.round((b.bottom - r.top) / ch));
        for (let y = y0; y < Math.max(y1, y0 + 1); y++) for (let x = x0; x < Math.max(x1, x0 + 1); x++) ELC[y * COLS + x] = e;
      }
      for (let j = 0; j < N; j++) if (OCC[j] === EL || (OCC[j] === FREE && ELC[j]! >= 0)) OCC[j] = ELC[j]! >= 0 ? EL : FREE;
      const cs = getComputedStyle(wrap), v = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
      col = [v("--lc-you", col[0]!), v("--lc-r1", col[1]!), v("--lc-r2", col[2]!), v("--lc-r3", col[3]!), v("--lc-edge", col[4]!), v("--lc-ink", col[5]!), v("--lc-dim", col[6]!)];
      G[20] = v("--lc-glow", "1") === "1" ? 1 : 0;
      font = `700 ${Math.max(10, cw * 1.05)}px ${MONO}`;
      big = `900 ${Math.max(22, cw * 3.6)}px ${MONO}`;
      if (!G[19] && first) round(0);
    },
    step(e, dt) {
      const s = G[2]!;
      G[19] = G[19]! + dt;
      G[7] = G[7]! + dt;
      const ph = G[6]!;
      // A tap: start a round, take the wheel from the autopilot, or queue a turn.
      if (q[0] && s > 0) {
        q[0] = 0;
        if (ph === WAIT || (ph === OVER && G[7]! > 0.6)) round(0);
        else if (ph === COUNT || ph === RIDE) {
          if (G[14]) (G[14] = 0), (G[22] = 1.1), (G[18] = 1), G[21] && ((G[21] = 0), (G[9] = G[9]! + 1));
          if (ph === RIDE && n[1]! < 2) (TQ[n[1]! * 2] = q[1]! / s), (TQ[n[1]! * 2 + 1] = q[2]! / G[3]!), (n[1] = n[1]! + 1);
        }
      }
      if (G[6] === WAIT && G[7]! > 0.5 && !G[9]) round(1);
      if (G[6] === COUNT && G[7]! >= 1.6) (G[6] = RIDE), (G[7] = 0), line(0), line(1);
      // Riding: speed climbs; after 16 s the edge closes in a ring at a time.
      if (G[6] === RIDE || G[6] === OVER) {
        if (G[6] === RIDE) {
          G[8] = G[8]! + dt;
          G[23] = Math.min(19, 9 + G[8]! * 0.3);
          const k = G[8]! > 16 ? Math.min(9, 1 + ((G[8]! - 16) / 0.8) | 0) : 0;
          while (G[17]! < k) close(G[17]!), (G[17] = G[17]! + 1);
        }
        for (let c = 0; c < 2; c++) {
          if (!ON[c] || (G[6] === OVER && F[c] === 0)) continue;
          F[c] = F[c]! + G[23]! * dt;
          while (F[c]! >= 1 && ON[c]) {
            const j = TG[c]!;
            (HX[c] = j % COLS), (HY[c] = (j / COLS) | 0), (F[c] = F[c]! - 1);
            if (G[6] === OVER) {
              F[c] = 0;
              break;
            }
            line(c);
          }
          const want = D[c]! * 1.5708;
          let dv = want - VA[c]!;
          dv -= Math.round(dv / 6.2832) * 6.2832;
          VA[c] = VA[c]! + dv * Math.min(1, dt * 22);
        }
      }
      // A broken wall unravels from the nose back, a bit of light at a time.
      let busy = G[6] !== OVER || G[7]! < 1.4 || G[22]! > 0;
      for (let c = 0; c < 2; c++) {
        if (ON[c] || !UNL[c]) continue;
        busy = true;
        UN[c] = UN[c]! + dt * 70;
        while (UNL[c]! > 0 && WL[c]! - UNL[c]! < UN[c]!) {
          UNL[c] = UNL[c]! - 1;
          const j = WALL[c * N + UNL[c]!]!;
          if (OCC[j] === c + 1) OCC[j] = FREE;
          if (R() < 0.7) part(((j % COLS) + 0.5) * s, (((j / COLS) | 0) + 0.5) * G[3]!, (R() - 0.5) * 3 * s, (R() - 0.5) * 3 * s - s, 0.4 + R() * 0.4, c ? G[13]! : 0);
        }
        if (!UNL[c]) WL[c] = 0;
      }
      // Pixels drift, slow and fade; ripples spread; nudged elements spring home.
      for (let i = 0; i < n[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --n[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PM[i] = PM[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        const k = Math.pow(0.12, dt);
        (PVX[i] = PVX[i]! * k), (PVY[i] = PVY[i]! * k);
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
      }
      for (let i = 0; i < RINGS; i++) if (RA[i]! < 1) (RA[i] = Math.min(1, RA[i]! + dt * 1.3)), (busy = true);
      for (let i = 0; i < ne; i++) {
        if (!OX[i] && !OY[i] && !VX[i] && !VY[i] && !FL[i]) continue;
        busy = true;
        (VX[i] = VX[i]! - (OX[i]! * 320 + VX[i]! * 12) * dt), (VY[i] = VY[i]! - (OY[i]! * 320 + VY[i]! * 12) * dt);
        (OX[i] = OX[i]! + VX[i]! * dt), (OY[i] = OY[i]! + VY[i]! * dt), (FL[i] = Math.max(0, FL[i]! - dt));
        if (Math.abs(OX[i]!) + Math.abs(OY[i]!) < 0.01 && Math.abs(VX[i]!) + Math.abs(VY[i]!) < 0.05) (OX[i] = OY[i] = VX[i] = VY[i] = 0);
      }
      (G[15] = Math.max(0, G[15]! - dt)), (G[16] = Math.max(0, G[16]! - dt)), (G[22] = Math.max(0, G[22]! - dt));
      // The score, once the round's last crash (a head-on draw lands in the same step) is in.
      if (G[6] === OVER && G[7]! >= 0.05 && G[7]! - dt < 0.05) {
        if (!G[21] && G[12] === 0) G[10] = G[10]! + 1;
        else if (!G[21] && G[12] === 1) G[11] = G[11]! + 1;
        G[18] = 1;
      }
      if (busy || n[0] || G[15]! > 0 || G[16]! > 0 || G[18]) e.busy();
    },
    render() {
      // The page: nudges and flashes only on the elements a crash reached; the score on a change.
      for (let i = 0; i < ne; i++) {
        const x = Math.max(-60, Math.min(60, Math.round(OX[i]! * 20))), y = Math.max(-60, Math.min(60, Math.round(OY[i]! * 20))), h = FL[i]! > 0 ? 1 : 0, el = els[i]!;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--kx", KS[x + 60]!) : L.unstyle(el, "--kx");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--ky", KS[y + 60]!) : L.unstyle(el, "--ky");
        if (h !== LH[i]) (LH[i] = h), L.attr(el, "data-hit", h ? "" : null);
      }
      if (G[18]) {
        G[18] = 0;
        const rv = NAMES[G[13]!]!;
        const t = `VEGA ${G[10]} – ${G[11]} RIVALS`;
        if (t !== hudNow) (hudNow = t), L.text(hudText, t);
        stamp = G[12] === 2 ? "DRAW" : G[12] === 0 ? "VEGA WINS" : G[12] === 1 ? `${rv} WINS` : "";
        sub = G[21] ? "demo · tap to ride" : `tap for round ${G[9]! + 1}`;
      }
      const dpr = G[4]!, w = G[0]!, h = G[1]!, cw = G[2]!, ch = G[3]!, glow = G[20]!, t = G[19]!, ph = G[6]!;
      const sh = G[15]! > 0 ? (((t * 60) | 0) & 1 ? 1 : -1) * G[15]! * cw * 0.8 : 0;
      ctx.setTransform(dpr, 0, 0, dpr, sh * dpr, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(-cw, 0, w + 2 * cw, h);
      // The closing edge, then the ripple: grid cells light up as the ring passes them.
      ctx.fillStyle = col[4]!;
      for (let j = 0; j < N; j++) {
        if (OCC[j] !== EDGE) continue;
        const x = (j % COLS) * cw, y = ((j / COLS) | 0) * ch;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(x, y, cw, ch);
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x + cw * 0.35, y + ch * 0.35, cw * 0.3, ch * 0.3);
      }
      if (glow) ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < RINGS; i++) {
        if (RA[i]! >= 1) continue;
        const rr = RA[i]! * w * 0.55, a = 1 - RA[i]!;
        ctx.fillStyle = col[RC[i]!]!;
        const x0 = Math.max(0, ((RX[i]! - rr) / cw - 1) | 0), x1 = Math.min(COLS, ((RX[i]! + rr) / cw + 1) | 0), y0 = Math.max(0, ((RY[i]! - rr) / ch - 1) | 0), y1 = Math.min(ROWS, ((RY[i]! + rr) / ch + 1) | 0);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const d = Math.abs(Math.hypot((x + 0.5) * cw - RX[i]!, (y + 0.5) * ch - RY[i]!) - rr) / cw;
            if (d > 1.6) continue;
            ctx.globalAlpha = a * (1 - d / 1.6) * 0.5;
            ctx.fillRect(x * cw + 1, y * ch + 1, cw - 1, ch - 1);
          }
      }
      // The walls: a shadow under the ribbon, a wide glow, the ribbon, a white-hot core.
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      for (let c = 0; c < 2; c++) {
        // A live rider's last cell is the one it is riding into: the ribbon ends at the rider.
        const len = ON[c] ? WL[c]! - 1 : UNL[c]!;
        if (len < 1 && !ON[c]) continue;
        const ci = c ? G[13]! : 0;
        for (let pass = 0; pass < 4; pass++) {
          if (pass === 0 && glow) continue;
          ctx.beginPath();
          const off = pass === 0 ? ch * 0.22 : 0;
          for (let k = 0; k < len; k++) {
            const j = WALL[c * N + k]!, x = ((j % COLS) + 0.5) * cw, y = (((j / COLS) | 0) + 0.5) * ch + off;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          if (ON[c]) ctx.lineTo(px(c), py(c) + off);
          ctx.globalAlpha = pass === 0 ? 0.5 : pass === 1 ? 0.13 : 1;
          ctx.strokeStyle = pass === 0 ? col[DIM]! : pass === 3 ? (glow ? "#ffffff" : col[INK]!) : col[ci]!;
          ctx.lineWidth = pass === 1 ? cw * 0.95 : pass === 3 ? Math.max(1, cw * 0.1) : cw * 0.34;
          ctx.lineJoin = pass === 1 ? "round" : "miter";
          if (pass === 3 && !glow) ctx.globalAlpha = 0.35;
          ctx.stroke();
        }
      }
      // The cycles, from above: a long capsule, two wheel wells with hot rims, a dark canopy, the
      // nose on the grid line ahead (where a crash happens).
      for (let c = 0; c < 2; c++) {
        if (!ON[c]) continue;
        const ci = c ? G[13]! : 0, a = VA[c]!, W2 = ch * 0.5, blink = ph === COUNT && ((G[7]! * 6) | 0) & 1 ? 0.5 : 1;
        ctx.save();
        ctx.translate(px(c), py(c));
        ctx.rotate(a);
        ctx.globalAlpha = blink;
        if (glow) (ctx.shadowColor = col[ci]!), (ctx.shadowBlur = cw * 0.9);
        // Body: fat wheels at both ends, a slim spine between, a canopy over the rider.
        ctx.fillStyle = col[ci]!;
        ctx.beginPath();
        ctx.roundRect(-cw * 2, -W2, cw * 0.95, W2 * 2, W2 * 0.9);
        ctx.roundRect(-cw * 0.45, -W2, cw * 0.95, W2 * 2, W2 * 0.9);
        ctx.roundRect(-cw * 1.4, -W2 * 0.62, cw * 1.4, W2 * 1.24, W2 * 0.4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = glow ? "#04030b" : "#ffffff";
        ctx.beginPath();
        ctx.roundRect(-cw * 1.86, -W2 * 0.5, cw * 0.67, W2, W2 * 0.45);
        ctx.roundRect(-cw * 0.31, -W2 * 0.5, cw * 0.67, W2, W2 * 0.45);
        ctx.roundRect(-cw * 1.18, -W2 * 0.36, cw * 0.78, W2 * 0.72, W2 * 0.36);
        ctx.fill();
        ctx.strokeStyle = glow ? "#ffffff" : col[ci]!;
        ctx.lineWidth = Math.max(1, cw * 0.08);
        ctx.beginPath();
        ctx.moveTo(-cw * 1.78, 0), ctx.lineTo(-cw * 1.27, 0), ctx.moveTo(-cw * 0.23, 0), ctx.lineTo(cw * 0.28, 0);
        ctx.stroke();
        if (glow) {
          ctx.globalAlpha = 0.12 * blink;
          ctx.fillStyle = col[ci]!;
          ctx.beginPath();
          ctx.moveTo(cw * 0.5, -W2 * 0.5), ctx.lineTo(cw * 4, -cw * 1.1), ctx.lineTo(cw * 4, cw * 1.1), ctx.lineTo(cw * 0.5, W2 * 0.5);
          ctx.fill();
        }
        ctx.restore();
      }
      // Pixels: square, flickering as they die.
      for (let i = 0; i < n[0]!; i++) {
        const k = PL[i]! / PM[i]!;
        ctx.globalAlpha = Math.min(1, k * 1.6) * ((i + ((t * 24) | 0)) & 3 ? 1 : 0.4);
        ctx.fillStyle = PC[i] === 5 ? (glow ? "#ffffff" : col[INK]!) : col[PC[i]!]!;
        const z = cw * (0.12 + 0.22 * k);
        ctx.fillRect(PX[i]! - z / 2, PY[i]! - z / 2, z, z);
      }
      ctx.globalCompositeOperation = "source-over";
      if (G[16]! > 0) {
        ctx.globalAlpha = G[16]! * 2;
        ctx.fillStyle = col[INK]!;
        ctx.fillRect(-cw, 0, w + 2 * cw, h);
      }
      // Words: names and the count-in, the demo line, the winner (chromatic: three offset passes).
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const say = (txt: string, x: number, y: number, f: string, c: number, al: number) => {
        ctx.font = f;
        const o = glow ? Math.max(1, cw * 0.12) : 0;
        if (o) {
          ctx.globalAlpha = al * 0.7;
          ctx.fillStyle = col[2]!;
          ctx.fillText(txt, x - o, y);
          ctx.fillStyle = col[0]!;
          ctx.fillText(txt, x + o, y);
        }
        ctx.globalAlpha = al;
        ctx.fillStyle = col[c]!;
        ctx.fillText(txt, x, y);
      };
      if (ph === COUNT || (ph === RIDE && G[7]! < 0.5)) {
        const k = ph === COUNT ? 3 - Math.floor(G[7]! / 0.55) : 0;
        say(k > 0 ? String(k) : "RIDE", w / 2, h * 0.835, big, INK, ph === COUNT ? 1 - (G[7]! % 0.55) : 1 - G[7]! * 2);
        say("SUDDEN DEATH", w / 2, h * 0.725, font, 4, 0.9);
        for (let c = 0; c < 2; c++) {
          const txt = c ? `${NAMES[G[13]!]} · ${MOODS[G[13]!]}` : "VEGA", half = txt.length * Math.max(10, cw * 1.05) * 0.32 + cw * 0.5;
          say(txt, Math.max(half, Math.min(w - half, px(c))), py(c) + ch * (HY[c]! < 3 ? 1.7 : -1.7), font, c ? G[13]! : 0, 1);
        }
      }
      if (G[21] && ph === RIDE && !still) say("DEMO · tap to take the wheel", w / 2, h * 0.155, font, INK, 0.75);
      ctx.textAlign = "left";
      if (G[22]! > 0) say("YOUR WHEEL", px(0) - cw * 2, py(0) - ch * 1.6, font, 0, Math.min(1, G[22]! * 2));
      ctx.textAlign = "center";
      if (ph === OVER && stamp && G[7]! > 0.15) {
        const k = Math.min(1, (G[7]! - 0.15) * 5);
        say(stamp, w / 2 + (k < 1 ? Math.sin(t * 90) * cw * 0.5 : 0), h * 0.76, big, G[12] === 1 ? G[13]! : G[12] === 0 ? 0 : INK, k);
        if (G[7]! > 0.6 && !still) say(sub, w / 2, h * 0.86, font, INK, 0.8);
      }
      ctx.globalAlpha = 1;
    },
  });
  engine.start();
  return {
    engine,
    /** For tests: the phase (0 wait, 1 count, 2 ride, 3 over), round, scores, winner, rival, autopilot, VEGA's heading and cell. */
    get state() {
      return { phase: G[6]!, round: G[9]!, you: G[10]!, rivals: G[11]!, winner: G[12]!, rival: NAMES[G[13]!]!, auto: G[14]!, dir: D[0]!, x: HX[0]!, y: HY[0]!, alive: [ON[0]!, ON[1]!], cell: G[2]!, t: G[8]!, edge: G[17]! };
    },
    /** For the poster: the same demo round every time. */
    poster() {
      R.state = 0x9e3779b9;
      still = 1;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => gridDuel(stage, slot, first);
