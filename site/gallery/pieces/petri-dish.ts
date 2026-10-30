// "Petri dish": a virus culture under the microscope. Cells drift, bump into each other and off
// the dish wall (real circle collisions, mass by size), grow, and split in two. Tap to zap: a cell
// under the zap bursts, and its shockwave shoves its neighbours into each other; any cell caught
// mid-split is fragile and bursts too, so a well-timed zap sets off a chain. Gold mutants split
// faster and take two zaps. Let the culture reach 40 and the dish is overgrown: a UV sweep sterilises
// it. Zap every cell and it is STERILE; tap to drop in a new culture. Dark: a fluorescence scope;
// light: a brightfield one.
// Bricks: the kernel (fixed step, settle: no frames once still; the ledger: Recall takes the canvas
// back off the page) and fizlet/steer's exact hypot, plus fizlet/slot. Step allocates nothing.
import { createEngine } from "../../../src/kernel/index";
import { hypot } from "../../../src/steer";
import type { SlotScene, SlotTap } from "../../../src/slot";

const CELLS = 48, PARTS = 260, RINGS = 12, SCORCH = 8, OVER = 40, SPLIT = 0.7;
/** Story phases. */
const PLAY = 0, UV = 1, CLEAN = 2;

export function petriDish(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const engine = createEngine({ root: stage, fps: 60, settle: 0.4 });
  const L = engine.ledger, R = engine.random;
  const pd = slot.querySelector<HTMLElement>("[data-pd]")!;
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // Cells: position, velocity, radius, adult radius, growth rate, split time (0: not splitting),
  // split axis, hit points, mutant, wobble phase, alive.
  const X = new Float32Array(CELLS), Y = new Float32Array(CELLS), VX = new Float32Array(CELLS), VY = new Float32Array(CELLS);
  const RAD = new Float32Array(CELLS), ADULT = new Float32Array(CELLS), GROW = new Float32Array(CELLS), SP = new Float32Array(CELLS);
  const AX = new Float32Array(CELLS), HP = new Uint8Array(CELLS), MUT = new Uint8Array(CELLS), PH = new Float32Array(CELLS), ON = new Uint8Array(CELLS), HURT = new Float32Array(CELLS);
  // Goo particles, shock rings, scorch marks on the agar.
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PS = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const RX = new Float32Array(RINGS), RY = new Float32Array(RINGS), RA = new Float32Array(RINGS), RR = new Float32Array(RINGS), RC = new Uint8Array(RINGS);
  const SX = new Float32Array(SCORCH), SY = new Float32Array(SCORCH), SA = new Float32Array(SCORCH).fill(9);
  const n = new Uint32Array(4); // parts, rings, scorch cursor, burst queue length
  // Bursts queued for the next step (a chain spreads one step at a time): cell index.
  const QB = new Int16Array(CELLS);
  // Scene: [0] w, [1] h, [2] scale, [3] measure, [4] dish x, [5] y, [6] radius, [7] dpr, [8] phase,
  // [9] phase time, [10] wave, [11] zaps, [12] popped, [13] uv sweep, [14] time, [15] flash, [16] best chain,
  // [17] chain now, [18] chain time, [19] label dirty, [20] dark.
  const G = new Float64Array(24);
  const q = new Float64Array(3);
  G[3] = 1, G[10] = 1, G[19] = 1;
  let col = ["#07060f", "#0c0a1c", "#120f26", "#3b3170", "#39ffb0", "#19f0ff", "#ffc21a", "#ff2e88", "#aea4d6", "#aea4d6"];
  const BG = 0, FIELD = 1, AGAR = 2, RIM = 3, CELL = 4, CORE = 5, MUTC = 6, ZAP = 7, INK = 8, LABEL = 9;
  let chainText = "", label = "", stamp = "", font = "", big = "";

  const at = (ev: PointerEvent) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    (q[0] = 1), (q[1] = ev.clientX - r.left), (q[2] = ev.clientY - r.top);
    engine.wake();
  };
  slot.addEventListener("pointerdown", at, { signal: engine.signal });
  addEventListener("scroll", () => (G[3] = 1), { signal: engine.signal, passive: true, capture: true });
  const ro = new ResizeObserver(() => ((G[3] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  function part(x: number, y: number, vx: number, vy: number, life: number, size: number, c: number) {
    const i = n[0]!;
    if (i >= PARTS) return;
    n[0] = i + 1;
    (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = life), (PS[i] = size), (PC[i] = c);
  }
  function ring(x: number, y: number, r: number, c: number) {
    let i = 0;
    while (i < n[1]! && RA[i]! < 1) i++;
    if (i === n[1]!) i < RINGS ? (n[1] = i + 1) : (i = 0);
    (RX[i] = x), (RY[i] = y), (RA[i] = 0), (RR[i] = r), (RC[i] = c);
  }
  function cell(x: number, y: number, r: number, vx: number, vy: number, mut: number) {
    for (let i = 0; i < CELLS; i++) {
      if (ON[i]) continue;
      (ON[i] = 1), (X[i] = x), (Y[i] = y), (VX[i] = vx), (VY[i] = vy), (RAD[i] = r), (MUT[i] = mut), (HP[i] = mut ? 2 : 1);
      (ADULT[i] = (mut ? 15 : 13) + R() * 4), (GROW[i] = (mut ? 2.6 : 1.5) + R() * 0.8), (SP[i] = 0), (PH[i] = R() * 6.28), (HURT[i] = 0);
      return i;
    }
    return -1;
  }
  function count() {
    let k = 0;
    for (let i = 0; i < CELLS; i++) k += ON[i]!;
    return k;
  }
  /** Burst cell i: goo, a membrane shower, a shock that shoves neighbours; fragile splitters go too. */
  function burst(i: number, chain: boolean) {
    const s = G[2]!, x = X[i]!, y = Y[i]!, r = RAD[i]! * s;
    ON[i] = 0;
    G[12] = G[12]! + 1;
    G[19] = 1;
    for (let k = 0; k < 16; k++) {
      const a = R() * 6.283, v = (40 + R() * 150) * s;
      part(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a) * v, Math.sin(a) * v, 0.6 + R() * 0.8, (1.5 + R() * 2.5) * s, MUT[i] ? 2 : k & 3 ? 0 : 1);
    }
    ring(x, y, r, MUT[i] ? 2 : 0);
    const reach = r * 4.5 + 30 * s;
    for (let o = 0; o < CELLS; o++) {
      if (!ON[o]) continue;
      const dx = X[o]! - x, dy = Y[o]! - y, d = hypot(dx, dy);
      if (d >= reach || d === 0) continue;
      const k = ((1 - d / reach) * 260 * s) / d;
      (VX[o] = VX[o]! + dx * k), (VY[o] = VY[o]! + dy * k);
      // Mid-split cells are fragile: the shock bursts them next step (a chain, one link a step).
      if (SP[o]! > 0 && n[3]! < CELLS) (QB[n[3]!] = o), (n[3] = n[3]! + 1), (SP[o] = -1);
    }
    if (chain) (G[17] = G[17]! + 1), (G[18] = 0.9), (G[16] = Math.max(G[16]!, G[17]!)), (G[19] = 1);
  }
  function inoculate() {
    G[8] = PLAY;
    G[9] = 0;
    G[12] = 0;
    G[11] = 0;
    G[17] = 0;
    stamp = "";
    const k = Math.min(4, 1 + G[10]!), D = G[6]!, s = G[2]!;
    for (let j = 0; j < k; j++) {
      const a = (j / k) * 6.283 + R(), d = D * 0.35;
      cell(G[4]! + Math.cos(a) * d, G[5]! + Math.sin(a) * d, 8, Math.cos(a) * 20 * s, Math.sin(a) * 20 * s, j === k - 1 && G[10]! > 1 ? 1 : 0);
    }
    ring(G[4]!, G[5]!, D * 0.1, 1);
    G[19] = 1;
  }

  engine.add({
    read() {
      if (!G[3]) return;
      G[3] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), ow = G[0]!, ox = G[4]!, oy = G[5]!, oD = G[6]!;
      (G[0] = r.width), (G[1] = r.height), (G[7] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      (G[4] = r.width / 2), (G[5] = r.height / 2), (G[6] = Math.min(r.width * 0.46, r.height * 0.44)), (G[2] = G[6]! / 180);
      // Resized mid-game: carry the culture over to the new dish.
      if (ow > 0 && oD > 0) for (let i = 0; i < CELLS; i++) (X[i] = G[4]! + ((X[i]! - ox) / oD) * G[6]!), (Y[i] = G[5]! + ((Y[i]! - oy) / oD) * G[6]!);
      const cs = getComputedStyle(pd), v = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
      col = [v("background-color", col[0]!), v("--pd-field", col[1]!), v("--pd-agar", col[2]!), v("--pd-rim", col[3]!), v("--pd-cell", col[4]!), v("--pd-core", col[5]!), v("--pd-mut", col[6]!), v("--pd-zap", col[7]!), v("--pd-ink", col[8]!), v("--pd-label", col[8]!)];
      col[0] = cs.backgroundColor;
      G[20] = v("--pd-glow", "1") === "1" ? 1 : 0;
      const fs = Math.max(10, 13 * G[2]!);
      font = `600 ${fs}px ui-monospace, Menlo, Consolas, monospace`;
      big = `900 ${Math.max(18, 44 * G[2]!)}px ui-monospace, Menlo, Consolas, monospace`;
      if (ow === 0) inoculate();
    },
    step(e, dt) {
      const s = G[2]!, cx = G[4]!, cy = G[5]!, D = G[6]!;
      G[14] = G[14]! + dt;
      G[9] = G[9]! + dt;
      // A zap: every cell it touches takes a hit; a miss scorches the agar.
      if (q[0] && D > 0) {
        q[0] = 0;
        const x = q[1]!, y = q[2]!, zr = Math.max(16, 14 * s);
        G[15] = 0.12;
        if (G[8] === CLEAN) G[10] = G[10]! + 1, inoculate();
        else if (G[8] === PLAY) {
          G[11] = G[11]! + 1;
          G[17] = 0;
          let hit = 0;
          for (let i = 0; i < CELLS; i++) {
            if (!ON[i] || hypot(X[i]! - x, Y[i]! - y) > RAD[i]! * s + zr) continue;
            hit++;
            if (--HP[i]! <= 0) burst(i, true);
            else (HURT[i] = 0.4), (VX[i] = VX[i]! + (X[i]! - x) * 4), (VY[i] = VY[i]! + (Y[i]! - y) * 4), ring(X[i]!, Y[i]!, RAD[i]! * s, 2);
          }
          if (!hit) {
            const k = n[2]! % SCORCH;
            (SX[k] = x), (SY[k] = y), (SA[k] = 0), (n[2] = n[2]! + 1);
            ring(x, y, zr * 0.5, 1);
          }
          G[19] = 1;
        }
      }
      // The chain: queued fragile cells burst now, each a link.
      const qn = n[3]!;
      n[3] = 0;
      for (let k = 0; k < qn; k++) if (ON[QB[k]!]) burst(QB[k]!, true);
      // Cells: Brownian drift, drag, growth, the split, the dish wall.
      let alive = 0;
      for (let i = 0; i < CELLS; i++) {
        if (!ON[i]) continue;
        alive++;
        PH[i] = PH[i]! + dt * (1 + MUT[i]!);
        HURT[i] = Math.max(0, HURT[i]! - dt);
        const drag = Math.pow(0.35, dt);
        (VX[i] = VX[i]! * drag + (R() - 0.5) * 60 * s * dt), (VY[i] = VY[i]! * drag + (R() - 0.5) * 60 * s * dt);
        if (G[8] === PLAY) {
          if (SP[i]! > 0) {
            SP[i] = SP[i]! + dt;
            if (SP[i]! >= 1 + SPLIT) {
              // Two daughters, pushed apart along the axis (they collide their way out).
              const a = AX[i]!, r = RAD[i]! * 0.72, ux = Math.cos(a), uy = Math.sin(a), o = r * 0.9 * s;
              const j = count() < CELLS ? cell(X[i]! - ux * o, Y[i]! - uy * o, r, VX[i]! - ux * 40 * s, VY[i]! - uy * 40 * s, MUT[i]!) : -1;
              (X[i] = X[i]! + ux * o), (Y[i] = Y[i]! + uy * o), (VX[i] = VX[i]! + ux * 40 * s), (VY[i] = VY[i]! + uy * 40 * s);
              (RAD[i] = r), (SP[i] = 0), (HP[i] = MUT[i] ? 2 : 1);
              if (j >= 0) ring(X[i]! - ux * o, Y[i]! - uy * o, r * s * 1.6, 3);
              G[19] = 1;
            }
          } else if (SP[i] === 0) {
            RAD[i] = RAD[i]! + GROW[i]! * dt;
            if (RAD[i]! >= ADULT[i]!) (SP[i] = 1), (AX[i] = R() * 6.283);
          }
        }
        (X[i] = X[i]! + VX[i]! * dt), (Y[i] = Y[i]! + VY[i]! * dt);
        const r = RAD[i]! * s, dx = X[i]! - cx, dy = Y[i]! - cy, d = hypot(dx, dy), lim = D - r - 2 * s;
        if (d > lim && d > 0) {
          const ux = dx / d, uy = dy / d, vn = VX[i]! * ux + VY[i]! * uy;
          (X[i] = cx + ux * lim), (Y[i] = cy + uy * lim);
          if (vn > 0) (VX[i] = VX[i]! - 1.8 * vn * ux), (VY[i] = VY[i]! - 1.8 * vn * uy);
        }
      }
      // Collisions: overlapping cells separate and exchange momentum along the normal (mass ~ r²).
      for (let i = 0; i < CELLS; i++) {
        if (!ON[i]) continue;
        for (let j = i + 1; j < CELLS; j++) {
          if (!ON[j]) continue;
          const dx = X[j]! - X[i]!, dy = Y[j]! - Y[i]!, d = hypot(dx, dy), rr = (RAD[i]! + RAD[j]!) * s;
          if (d >= rr || d === 0) continue;
          const ux = dx / d, uy = dy / d, mi = RAD[i]! * RAD[i]!, mj = RAD[j]! * RAD[j]!, m = mi + mj, over = rr - d;
          (X[i] = X[i]! - ux * over * (mj / m)), (Y[i] = Y[i]! - uy * over * (mj / m)), (X[j] = X[j]! + ux * over * (mi / m)), (Y[j] = Y[j]! + uy * over * (mi / m));
          const rel = (VX[j]! - VX[i]!) * ux + (VY[j]! - VY[i]!) * uy;
          if (rel >= 0) continue;
          const imp = (-1.8 * rel) / m;
          (VX[i] = VX[i]! - ux * imp * mj), (VY[i] = VY[i]! - uy * imp * mj), (VX[j] = VX[j]! + ux * imp * mi), (VY[j] = VY[j]! + uy * imp * mi);
        }
      }
      // Overgrown: a UV sweep crosses the dish and bursts what it passes. All gone: sterile.
      if (G[8] === PLAY && alive >= OVER) (G[8] = UV), (G[9] = 0), (G[13] = 0), (stamp = "OVERGROWN"), (G[19] = 1);
      if (G[8] === UV) {
        G[13] = Math.min(1, G[9]! / 1.6);
        const line = cx - D + G[13]! * D * 2;
        for (let i = 0; i < CELLS; i++) if (ON[i] && X[i]! < line) burst(i, false);
        if (G[13]! >= 1) (G[8] = CLEAN), (G[9] = 0), (stamp = "STERILE"), (G[19] = 1);
      } else if (G[8] === PLAY && alive === 0 && n[3] === 0) (G[8] = CLEAN), (G[9] = 0), (stamp = "STERILE"), (G[19] = 1);
      // Goo slows to a stop and fades; rings grow; scorch fades.
      for (let i = 0; i < n[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --n[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PS[i] = PS[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        const k = Math.pow(0.05, dt);
        (PVX[i] = PVX[i]! * k), (PVY[i] = PVY[i]! * k);
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
      }
      let rings = 0, scorch = 0;
      for (let i = 0; i < n[1]!; i++) if (RA[i]! < 1) (RA[i] = RA[i]! + dt * 2.4), rings++;
      for (let i = 0; i < SCORCH; i++) if (SA[i]! < 1.5) (SA[i] = SA[i]! + dt * 0.5), scorch++;
      G[15] = Math.max(0, G[15]! - dt);
      G[18] = Math.max(0, G[18]! - dt);
      if (alive || n[0] || rings || scorch || G[15]! > 0 || G[18]! > 0 || G[8] !== CLEAN || G[9]! < 1.2 || G[19]) e.busy();
    },
    render() {
      const dpr = G[7]!, s = G[2]!, cx = G[4]!, cy = G[5]!, D = G[6]!, t = G[14]!, glow = G[20]!, w = G[0]!, h = G[1]!;
      if (G[19]) {
        G[19] = 0;
        chainText = `CHAIN \u00d7${G[17]}`;
        label = `cells ${count()} · zaps ${G[11]} · burst ${G[12]}${G[16]! > 1 ? ` · best chain ${G[16]}` : ""}`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = col[BG]!;
      ctx.fillRect(0, 0, w, h);
      // The field of view, the dish (agar, rim, a highlight), the reticle.
      ctx.fillStyle = col[FIELD]!;
      ctx.beginPath();
      ctx.arc(cx, cy, D + 14 * s, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = col[AGAR]!;
      ctx.beginPath();
      ctx.arc(cx, cy, D, 0, 6.2832);
      ctx.fill();
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = col[RIM]!;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - D, cy), ctx.lineTo(cx + D, cy), ctx.moveTo(cx, cy - D), ctx.lineTo(cx, cy + D);
      for (let k = -8; k <= 8; k++) ctx.moveTo(cx + (k * D) / 9, cy - 3 * s), ctx.lineTo(cx + (k * D) / 9, cy + 3 * s), ctx.moveTo(cx - 3 * s, cy + (k * D) / 9), ctx.lineTo(cx + 3 * s, cy + (k * D) / 9);
      ctx.stroke();
      // Scorch marks (missed zaps) fade on the agar.
      for (let i = 0; i < SCORCH; i++) {
        if (SA[i]! >= 1.5) continue;
        ctx.globalAlpha = 0.35 * (1 - SA[i]! / 1.5);
        ctx.fillStyle = col[ZAP]!;
        ctx.beginPath();
        ctx.arc(SX[i]!, SY[i]!, 7 * s, 0, 6.2832);
        ctx.fill();
      }
      if (glow) ctx.globalCompositeOperation = "lighter";
      // Cells: a glow (dark), a spiky membrane, a nucleus; splitting: two lobes pulling apart.
      for (let i = 0; i < CELLS; i++) {
        if (!ON[i]) continue;
        const r = RAD[i]! * s, sp = SP[i]! > 0 ? Math.min(1, (SP[i]! - 1) / SPLIT) : 0, c = col[MUT[i] ? MUTC : CELL]!;
        const ux = Math.cos(AX[i]!), uy = Math.sin(AX[i]!), lobes = sp > 0 ? 2 : 1, wob = Math.sin(PH[i]! * 3) * 0.06;
        for (let k = 0; k < lobes; k++) {
          const o = sp > 0 ? (k ? 1 : -1) * r * 0.55 * sp : 0, x = X[i]! + ux * o, y = Y[i]! + uy * o, rr = r * (sp > 0 ? 1 - 0.25 * sp : 1 + wob);
          if (glow) {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(x, y, rr * 1.6, 0, 6.2832);
            ctx.fill();
          }
          ctx.globalAlpha = HURT[i]! > 0 && (t * 20) & 1 ? 0.4 : 1;
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(1.2, 1.8 * s);
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, 6.2832);
          for (let k2 = 0; k2 < 9; k2++) {
            const a = PH[i]! * 0.4 + (k2 * 6.2832) / 9, ca = Math.cos(a), sa = Math.sin(a);
            ctx.moveTo(x + ca * rr, y + sa * rr), ctx.lineTo(x + ca * (rr + 4 * s), y + sa * (rr + 4 * s));
          }
          ctx.stroke();
          ctx.globalAlpha *= 0.85;
          ctx.fillStyle = col[MUT[i] ? MUTC : CORE]!;
          ctx.beginPath();
          ctx.arc(x + Math.cos(PH[i]!) * rr * 0.15, y + Math.sin(PH[i]!) * rr * 0.15, rr * 0.38, 0, 6.2832);
          ctx.fill();
        }
      }
      // Goo, rings (burst: zap colour; drop: cell colour; mutant hit: gold; split: soft).
      for (let i = 0; i < n[0]!; i++) {
        ctx.globalAlpha = Math.min(1, PL[i]!);
        ctx.fillStyle = col[PC[i] === 2 ? MUTC : PC[i] ? CORE : CELL]!;
        ctx.fillRect(PX[i]! - PS[i]! / 2, PY[i]! - PS[i]! / 2, PS[i]!, PS[i]!);
      }
      for (let i = 0; i < n[1]!; i++) {
        if (RA[i]! >= 1) continue;
        ctx.globalAlpha = (1 - RA[i]!) * (RC[i] === 3 ? 0.4 : 0.9);
        ctx.strokeStyle = col[RC[i] === 2 ? MUTC : RC[i] === 0 ? ZAP : CELL]!;
        ctx.lineWidth = 2 * s + 1;
        ctx.beginPath();
        ctx.arc(RX[i]!, RY[i]!, RR[i]! + RA[i]! * (RC[i] === 0 ? 50 : 22) * s, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // The UV sweep.
      if (G[8] === 1) {
        const line = cx - D + G[13]! * D * 2;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = col[ZAP]!;
        ctx.fillRect(line - 6 * s, cy - D, 12 * s, D * 2);
        ctx.globalAlpha = 0.12;
        ctx.fillRect(cx - D, cy - D, line - cx + D, D * 2);
      }
      // The zap flash, the labels: counts (top left), the scale bar, the stamp.
      if (G[15]! > 0) {
        ctx.globalAlpha = G[15]! * 4;
        ctx.fillStyle = col[ZAP]!;
        ctx.beginPath();
        ctx.arc(q[1]!, q[2]!, (6 + (0.12 - G[15]!) * 160) * s, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col[LABEL]!;
      const fs = Math.max(10, 13 * s);
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.fillText(label, 12 * s + 6, 12 * s + fs);
      if (G[18]! > 0 && G[17]! > 1) {
        ctx.fillStyle = col[MUTC]!;
        ctx.fillText(`CHAIN ×${G[17]}`, 12 * s + 6, 12 * s + fs * 2.3);
      }
      ctx.fillStyle = col[LABEL]!;
      ctx.fillRect(w - 12 * s - 6 - 40 * s, h - 14 * s - 6, 40 * s, 2);
      ctx.textAlign = "right";
      ctx.fillText("10 µm", w - 12 * s - 6, h - 20 * s - 6);
      if (stamp && (G[8] !== 2 || G[9]! > 0.2)) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.12);
        ctx.textAlign = "center";
        ctx.font = big;
        ctx.globalAlpha = G[8] === 1 ? 0.6 : 0.9;
        ctx.fillStyle = col[stamp === "STERILE" ? CELL : ZAP]!;
        ctx.fillText(stamp, 0, 14 * s);
        if (G[8] === 2) {
          ctx.font = font;
          ctx.fillStyle = col[INK]!;
          ctx.fillText("tap for a new culture", 0, 14 * s + fs * 2);
        }
        ctx.restore();
      }
    },
  });
  engine.start();
  if (first) (q[0] = 1), (q[1] = first.x), (q[2] = first.y);
  return {
    engine,
    /** For tests: cells alive, zaps, bursts, best chain, the phase (0 play, 1 UV, 2 clean). */
    get state() {
      return { cells: count(), zaps: G[11]!, burst: G[12]!, chain: G[16]!, phase: G[8]! };
    },
    /** For tests: where the i-th live cell is, in CSS px from the stage's top left. */
    worm(i: number) {
      for (let c = 0; c < CELLS; c++) if (ON[c] && i-- === 0) return { x: X[c]!, y: Y[c]! };
      return null;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => petriDish(stage, slot, first);
