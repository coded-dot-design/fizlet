// "Jack in": a cyberpunk homage. WREN, a netrunner, jacks into a corp's page (NIMBUS VAULT) from her
// deck in the corner, behind rain-soaked glass. Every real element on the page is an ICE node with
// layers of ICE (the brackets around it). Tap to fire a hack packet from the deck's jack toward the
// tap: it ricochets off the nodes and the frame (real box collisions; packets bounce off each other
// too), and each node it strikes loses a layer. Strip the last layer and the node is breached: only
// its own text glitches, a chromatic split and a scramble that resolves back to the real words, and
// from then on packets fly through it. Every layer cracked sends a trace pulse racing along the
// circuit to the SECURITY node; at 100% the alarm trips and a black-ICE daemon comes out of it and
// hunts your cursor. Shoot it three times to purge it, dodge it, or be caught and flatline: every
// node re-ICEs. Hit SECURITY itself and the trace jumps, but breach it and the alarm is cut. Breach
// the whole page and the vault opens.
// Bricks: the kernel (fixed step, settle: no frames once every packet, pulse and glitch is done;
// the ledger: the canvas, the deck's words and every glitch go back on Recall) and fizlet/slot. Step
// allocates nothing (typed arrays); a node's text is written only on the frames it glitches.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";

const PK = 10, TR = 14, PU = 24, PARTS = 420, RAIN = 64, GLITCH = 1;
/** Phases. */
const INTRO = 0, PLAY = 1, FLAT = 2, ROOT = 3;
const OFF = -9;
const GLYPHS = "#$%&*+=<>?/\\|01█▓▒░";
const MSGS = ["deck idle", "jacking in…", "tap to fire", "ICE cracked", "BREACH", "!! BLACK ICE", "daemon purged", "trace lost", "FLATLINED", "ROOT · vault open", "alarm cut", "jacked in again"];
/** Glitch offsets (cqw), made once: a split for the chromatic layers, a jitter for the node. */
const GX = Array.from({ length: 13 }, (_, i) => `${((i - 6) * 0.1).toFixed(1)}cqw`);
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const DASH = [3, 4], SOLID: number[] = [];
/** The poster: the intro this many seconds in (scripts/gallery-posters.mjs). */
export const posterAt = 1.7;

export function jackIn(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const engine = createEngine({ root: stage, fps: 60, settle: 0.5, seed: (Math.random() * 4294967295) >>> 0 || 1 });
  const L = engine.ledger, R = engine.random;
  const wrap = slot.querySelector<HTMLElement>("[data-nr]")!, deck = wrap.querySelector<HTMLElement>(".nr-deck")!;
  const msgNode = wrap.querySelector("[data-nr-msg]")!.firstChild as Text, traceNode = wrap.querySelector("[data-nr-trace]")!.firstChild as Text;
  const els = [...wrap.querySelectorAll<HTMLElement>("[data-nr-node]")], ne = els.length;
  const sen = els.findIndex((e) => e.hasAttribute("data-nr-sentry"));
  // Each node's own text: its text nodes and their words, kept to write back exactly.
  const texts = els.map((el) => {
    const out: Text[] = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode() as Text | null; t; t = w.nextNode() as Text | null) out.push(t);
    return out;
  });
  const orig = texts.map((ts) => ts.map((t) => t.nodeValue ?? ""));
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // Nodes: ICE at the start and now, box (stage px), hit flash, glitch time (OFF: none), last written.
  const ICE0 = Uint8Array.from(els, (e) => +(e.dataset.nrNode ?? 1)), ICE = ICE0.slice();
  const BX = new Float32Array(ne), BY = new Float32Array(ne), BW = new Float32Array(ne), BH = new Float32Array(ne);
  const HT = new Float32Array(ne), GT = new Float32Array(ne).fill(OFF), LG = new Uint8Array(ne), LH = new Uint8Array(ne), LS = new Int8Array(ne), LJ = new Int8Array(ne);
  // Packets: where, how fast, charges left, age; a trail of where they were.
  const KX = new Float32Array(PK), KY = new Float32Array(PK), KVX = new Float32Array(PK), KVY = new Float32Array(PK), KC = new Int8Array(PK), KA = new Float32Array(PK);
  const TX = new Float32Array(PK * TR), TY = new Float32Array(PK * TR), TI = new Uint8Array(PK), TN = new Uint8Array(PK);
  // Trace pulses (node -> SECURITY along the circuit), sparks and shards, rain on the glass.
  const UE = new Int8Array(PU).fill(-1), UD = new Float32Array(PU);
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PM = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const WX = new Float32Array(RAIN), WY = new Float32Array(RAIN), WV = new Float32Array(RAIN), WL = new Float32Array(RAIN);
  const n = new Uint32Array(2); // parts, rain seeded
  const codes = new Uint16Array(64);
  // The daemon's smear: where it was, a few steps back.
  const DSX = new Float32Array(10), DSY = new Float32Array(10);
  // Scene: [0] w, [1] h, [2] 1cqw in px, [3] dpr, [4] measure, [5] phase, [6] phase time, [7] trace,
  // [8] time, [9] shake, [10] flash, [11] hud dirty, [12] message, [13] pointer x, [14] y,
  // [15] pointer on the stage, [16] daemon x, [17] y, [18] vx, [19] vy, [20] daemon hp, [21] daemon
  // time, [22] daemon on, [23] time since the pointer left, [24] alarm cut, [25] nodes breached,
  // [26] jack x, [27] y, [28] glow, [29] packets fired, [30] breaches, [31] launch flash, [32] flatlines,
  // [33] purges, [34] daemon fade.
  const G = new Float64Array(36);
  const q = new Float64Array(3);
  G[4] = 1, G[11] = 1;
  let col = ["#19f0ff", "#ff2e88", "#ff7af0", "#e8ff3a", "#9fc6ff", "#f6f3ff", "#000000", "#ff2e4d", "#07060f"];
  const ICEC = 0, SEN = 1, PKT = 2, OWN = 3, RAINC = 4, INK = 5, DAE = 6, EYE = 7, BG = 8;
  let font = "", big = "", traceNow = "", stamp = "", sub = "";
  const NON = ne - (sen >= 0 ? 1 : 0);

  let sl = 0, st = 0; // the stage's page position, read with the boxes (pointer moves use it)
  const fire = (ev: PointerEvent) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    (q[0] = 1), (q[1] = ev.clientX - r.left), (q[2] = ev.clientY - r.top);
    (G[13] = q[1]!), (G[14] = q[2]!), (G[15] = 1);
    engine.wake();
  };
  const move = (ev: PointerEvent) => ev.isPrimary && ((G[13] = ev.clientX - sl), (G[14] = ev.clientY - st), (G[15] = 1));
  slot.addEventListener("pointerdown", fire, { signal: engine.signal });
  slot.addEventListener("pointermove", move, { signal: engine.signal, passive: true });
  slot.addEventListener("pointerleave", (ev) => ev.pointerType === "mouse" && (G[15] = 0), { signal: engine.signal });
  addEventListener("scroll", () => (G[4] = 1), { signal: engine.signal, passive: true, capture: true });
  const ro = new ResizeObserver(() => ((G[4] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  function part(x: number, y: number, vx: number, vy: number, life: number, c: number) {
    const i = n[0]!;
    if (i >= PARTS) return;
    n[0] = i + 1;
    (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = PM[i] = life), (PC[i] = c);
  }
  function burst(x: number, y: number, k: number, sp: number, c: number) {
    const s = G[2]!;
    for (let j = 0; j < k; j++) {
      const a = R() * 6.283, v = (0.3 + R()) * sp * s;
      part(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.25 + R() * 0.5, c);
    }
  }
  const say = (m: number) => ((G[12] = m), (G[11] = 1));
  const center = (e: number, ax: number) => (ax ? BY[e]! + BH[e]! / 2 : BX[e]! + BW[e]! / 2);
  /** The circuit from node e up to the bus along the top, across, and down into SECURITY. */
  const bus = () => G[2]! * 1.1;
  const pathLen = (e: number) => BY[e]! - bus() + Math.abs(center(e, 0) - center(sen, 0)) + BY[sen]! - bus();
  const pp = new Float64Array(2);
  function pathAt(e: number, d: number) {
    const a = BY[e]! - bus(), x0 = center(e, 0), x1 = center(sen, 0), b = Math.abs(x1 - x0);
    if (d < a) (pp[0] = x0), (pp[1] = BY[e]! - d);
    else if (d < a + b) (pp[0] = x0 + Math.sign(x1 - x0) * (d - a)), (pp[1] = bus());
    else (pp[0] = x1), (pp[1] = bus() + d - a - b);
  }
  function launch(x: number, y: number) {
    let i = 0;
    while (i < PK && KC[i]! > 0) i++;
    if (i === PK) return;
    const s = G[2]!, jx = G[26]!, jy = G[27]!;
    let dx = x - jx, dy = y - jy, d = Math.hypot(dx, dy);
    if (d < s * 2) (dx = 0.7), (dy = -0.7), (d = 1);
    const sp = s * 92;
    (KX[i] = jx), (KY[i] = jy), (KVX[i] = (dx / d) * sp), (KVY[i] = (dy / d) * sp), (KC[i] = 7), (KA[i] = 0), (TN[i] = 0), (TI[i] = 0);
    G[29] = G[29]! + 1;
    G[31] = 0.18;
    burst(jx, jy, 8, 20, PKT);
  }
  /** A packet strikes node e: a layer of ICE cracks off (shards), a trace pulse goes; the last layer is a breach. */
  function strike(e: number, x: number, y: number) {
    ICE[e] = ICE[e]! - 1;
    HT[e] = 0.14;
    burst(x, y, 10, 30, e === sen ? SEN : ICEC);
    G[9] = Math.max(G[9]!, 0.08);
    if (e === sen) {
      if (!ICE[e]) (G[24] = 1), say(10), breach(e);
      else if (!G[24]) (G[7] = G[7]! + 20), (G[11] = 1);
      return;
    }
    if (!G[24] && sen >= 0)
      for (let u = 0; u < PU; u++)
        if (UE[u]! < 0) {
          (UE[u] = e), (UD[u] = 0);
          break;
        }
    if (ICE[e]) say(3);
    else breach(e), say(4), (G[25] = G[25]! + 1);
  }
  /** A breach: the node's own text glitches (resolved back in GLITCH s) and it bursts with light. */
  function breach(e: number) {
    GT[e] = 0;
    G[30] = G[30]! + 1;
    const x = center(e, 0), y = center(e, 1);
    for (let k = 0; k < 26; k++) part(BX[e]! + R() * BW[e]!, BY[e]! + R() * BH[e]!, (R() - 0.5) * 60 * G[2]!, (R() - 0.5) * 40 * G[2]!, 0.4 + R() * 0.5, k & 1 ? OWN : PKT);
    burst(x, y, 12, 45, OWN);
    G[10] = 0.08;
  }
  /** Every node gets its ICE back (after a flatline, or when you jack in again after a root). */
  function reice(glitch: number) {
    for (let e = 0; e < ne; e++) {
      ICE[e] = ICE0[e]!;
      if (glitch) GT[e] = -e * 0.06;
    }
    (G[25] = 0), (G[24] = 0), (G[7] = 0), (G[11] = 1);
    UE.fill(-1);
  }
  function daemonEnd(how: number) {
    G[22] = 0;
    const x = G[16]!, y = G[17]!;
    burst(x, y, how === 6 ? 48 : 24, how === 6 ? 70 : 25, how === 6 ? EYE : DAE);
    burst(x, y, 16, 40, DAE);
    if (how === 6) (G[7] = 60), (G[33] = G[33]! + 1), (G[9] = 0.25);
    else G[7] = 70;
    G[34] = 0.6;
    say(how);
  }

  engine.add({
    read() {
      if (!G[4]) return;
      G[4] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      (sl = r.left), (st = r.top);
      (G[0] = r.width), (G[1] = r.height), (G[2] = r.width / 100), (G[3] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      for (let e = 0; e < ne; e++) {
        const b = els[e]!.getBoundingClientRect();
        (BX[e] = b.left - r.left), (BY[e] = b.top - r.top), (BW[e] = b.width), (BH[e] = b.height);
      }
      const d = deck.getBoundingClientRect();
      (G[26] = d.right - r.left - G[2]! * 1.2), (G[27] = d.top - r.top);
      const cs = getComputedStyle(wrap), v = (k: string, f: string) => cs.getPropertyValue(k).trim() || f;
      col = [v("--nr-ice", col[0]!), v("--nr-sentry", col[1]!), v("--nr-pkt", col[2]!), v("--nr-own", col[3]!), v("--nr-rain", col[4]!), v("--nr-ink", col[5]!), v("--nr-daemon", col[6]!), v("--nr-eye", col[7]!), v("--nr-bg", col[8]!)];
      G[28] = v("--nr-glow", "1") === "1" ? 1 : 0;
      font = `700 ${Math.max(10, G[2]! * 1.6)}px ${MONO}`;
      big = `900 ${Math.max(22, G[2]! * 6.4)}px ${MONO}`;
      if (!n[1]) {
        n[1] = 1;
        for (let i = 0; i < RAIN; i++) (WX[i] = R() * r.width * 1.2), (WY[i] = R() * r.height), (WV[i] = 0.5 + R()), (WL[i] = 0.6 + R() * 1.4);
      }
    },
    step(e, dt) {
      const s = G[2]!, w = G[0]!, h = G[1]!;
      G[8] = G[8]! + dt;
      G[6] = G[6]! + dt;
      let busy = false;
      // A tap: fire a packet at it (the intro ends; after a flatline or a root, it jacks in again).
      if (q[0] && s > 0) {
        q[0] = 0;
        if (G[5] === FLAT || (G[5] === ROOT && G[6]! > 0.8)) {
          if (G[5] === ROOT) reice(1);
          (G[5] = PLAY), (G[6] = 0), say(11);
        } else if (G[5] !== ROOT) {
          if (G[5] === INTRO) (G[5] = PLAY), (G[6] = 0), say(2);
          launch(q[1]!, q[2]!);
        }
      }
      // The intro: the deck wakes, jacks in and fires one packet at the heading.
      if (G[5] === INTRO) {
        busy = true;
        if (G[6]! > 0.3 && G[12] === 0) say(1);
        if (G[6]! > 1.1) {
          const hd = els.findIndex((el) => el.parentElement!.classList.contains("nr-h"));
          (G[5] = PLAY), (G[6] = 0), say(2);
          launch(center(hd, 0) + BW[hd]! * 0.18, center(hd, 1));
        }
      }
      // Packets: two substeps a step (no tunnelling through a thin link), off the frame, off live
      // nodes (the face they went in through), off the daemon and off each other.
      const pr = s * 0.75;
      for (let i = 0; i < PK; i++) {
        if (KC[i]! <= 0) continue;
        busy = true;
        KA[i] = KA[i]! + dt;
        for (let sub = 0; sub < 2 && KC[i]! > 0; sub++) {
          let x = KX[i]! + KVX[i]! * dt * 0.5, y = KY[i]! + KVY[i]! * dt * 0.5;
          if (x < pr || x > w - pr) (KVX[i] = -KVX[i]!), (x = x < pr ? pr : w - pr), (KC[i] = KC[i]! - 1), burst(x, y, 3, 14, PKT);
          if (y < pr || y > h - pr) (KVY[i] = -KVY[i]!), (y = y < pr ? pr : h - pr), (KC[i] = KC[i]! - 1), burst(x, y, 3, 14, PKT);
          for (let k = 0; k < ne; k++) {
            if (!ICE[k]) continue;
            const x0 = BX[k]! - pr, y0 = BY[k]! - pr, x1 = BX[k]! + BW[k]! + pr, y1 = BY[k]! + BH[k]! + pr;
            if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
            const l = x - x0, rr = x1 - x, t = y - y0, b = y1 - y, m = Math.min(l, rr, t, b);
            if (m === l) (x = x0), (KVX[i] = -Math.abs(KVX[i]!));
            else if (m === rr) (x = x1), (KVX[i] = Math.abs(KVX[i]!));
            else if (m === t) (y = y0), (KVY[i] = -Math.abs(KVY[i]!));
            else (y = y1), (KVY[i] = Math.abs(KVY[i]!));
            KC[i] = KC[i]! - 1;
            strike(k, x, y);
            break;
          }
          if (G[22]) {
            const dx = x - G[16]!, dy = y - G[17]!, d = Math.hypot(dx, dy), rd = s * 3 + pr;
            if (d < rd && d > 0) {
              const ux = dx / d, uy = dy / d, vn = KVX[i]! * ux + KVY[i]! * uy;
              (x = G[16]! + ux * rd), (y = G[17]! + uy * rd);
              if (vn < 0) (KVX[i] = KVX[i]! - 2 * vn * ux), (KVY[i] = KVY[i]! - 2 * vn * uy);
              (G[18] = G[18]! - ux * s * 40), (G[19] = G[19]! - uy * s * 40), (G[20] = G[20]! - 1), (KC[i] = KC[i]! - 1);
              burst(x, y, 12, 40, EYE);
              if (G[20]! <= 0) daemonEnd(6);
            }
          }
          (KX[i] = x), (KY[i] = y);
        }
        for (let o = i + 1; o < PK; o++) {
          if (KC[o]! <= 0) continue;
          const dx = KX[o]! - KX[i]!, dy = KY[o]! - KY[i]!, d = Math.hypot(dx, dy);
          if (d >= pr * 2 || d === 0) continue;
          const ux = dx / d, uy = dy / d, rel = (KVX[o]! - KVX[i]!) * ux + (KVY[o]! - KVY[i]!) * uy;
          if (rel < 0) (KVX[i] = KVX[i]! + rel * ux), (KVY[i] = KVY[i]! + rel * uy), (KVX[o] = KVX[o]! - rel * ux), (KVY[o] = KVY[o]! - rel * uy), burst(KX[i]! + ux * pr, KY[i]! + uy * pr, 6, 25, OWN);
        }
        const j = i * TR + TI[i]!;
        (TX[j] = KX[i]!), (TY[j] = KY[i]!), (TI[i] = (TI[i]! + 1) % TR), (TN[i] = Math.min(TR, TN[i]! + 1));
        if (KA[i]! > 7) KC[i] = 0;
        if (KC[i]! <= 0) burst(KX[i]!, KY[i]!, 10, 22, PKT);
      }
      // Trace pulses race to SECURITY; each one that arrives raises the trace. 100%: the alarm.
      for (let u = 0; u < PU; u++) {
        if (UE[u]! < 0) continue;
        busy = true;
        UD[u] = UD[u]! + dt * s * 120;
        if (UD[u]! >= pathLen(UE[u]!)) (UE[u] = -1), G[24] ? 0 : ((G[7] = G[7]! + 7), (G[11] = 1), burst(center(sen, 0), BY[sen]!, 6, 20, SEN));
      }
      if (G[5] === PLAY && !G[22] && !G[24] && G[7]! >= 100) {
        (G[22] = 1), (G[20] = 3), (G[21] = 0), (G[23] = 0), (G[16] = center(sen, 0)), (G[17] = center(sen, 1)), (G[18] = 0), (G[19] = s * 30);
        DSX.fill(G[16]!), DSY.fill(G[17]!);
        (G[9] = 0.3), (G[10] = 0.12), (G[7] = 100);
        burst(G[16]!, G[17]!, 30, 50, EYE);
        say(5);
      }
      // The daemon hunts the pointer around the live nodes; it gives up if it loses you.
      if (G[22]) {
        busy = true;
        G[21] = G[21]! + dt;
        const rd = s * 3, sp = s * (16 + Math.min(20, G[21]! * 2.6)), dx = G[13]! - G[16]!, dy = G[14]! - G[17]!, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 3);
        (G[18] = G[18]! + ((dx / d) * sp - G[18]!) * k), (G[19] = G[19]! + ((dy / d) * sp - G[19]!) * k);
        let x = G[16]! + G[18]! * dt, y = G[17]! + G[19]! * dt;
        for (let o = 0; o < ne; o++) {
          if (!ICE[o] || o === sen) continue;
          const nx = Math.max(BX[o]!, Math.min(BX[o]! + BW[o]!, x)), ny = Math.max(BY[o]!, Math.min(BY[o]! + BH[o]!, y)), ex = x - nx, ey = y - ny, ed = Math.hypot(ex, ey);
          if (ed >= rd * 0.6 || ed === 0) continue;
          (x = nx + (ex / ed) * rd * 0.6), (y = ny + (ey / ed) * rd * 0.6);
        }
        (G[16] = Math.max(rd, Math.min(w - rd, x))), (G[17] = Math.max(rd, Math.min(h - rd, y)));
        const ds = ((G[21]! * 30) | 0) % 10;
        (DSX[ds] = G[16]!), (DSY[ds] = G[17]!);
        if (G[15] && d < rd * 0.8) {
          // Caught: flatline. Every node glitches and re-ICEs; the trace and the alarm reset.
          (G[22] = 0), (G[5] = FLAT), (G[6] = 0), (G[9] = 0.5), (G[10] = 0.2), (G[32] = G[32]! + 1);
          burst(G[16]!, G[17]!, 40, 60, EYE);
          KC.fill(0);
          reice(1);
          say(8);
        } else if (G[15] ? ((G[23] = 0), G[21]! > 14) : (G[23] = G[23]! + dt) > 2) daemonEnd(7);
      }
      // Glitches run and end; hit flashes fade; sparks fly; rain runs down the glass.
      for (let k = 0; k < ne; k++) {
        if (GT[k] !== OFF) (busy = true), (GT[k] = GT[k]! + dt), GT[k]! > GLITCH && (GT[k] = OFF);
        if (HT[k]! > 0) (HT[k] = HT[k]! - dt), (busy = true);
      }
      if (G[5] === PLAY && G[25]! >= NON && NON > 0) (G[5] = ROOT), (G[6] = 0), G[22] && ((G[22] = 0), (G[34] = 0.6)), say(9);
      if (G[5] === ROOT && G[6]! < 1.5) {
        busy = true;
        for (let k = 0; k < ne; k++) if (GT[k] === OFF && G[6]! > 0.2 + k * 0.12 && G[6]! - dt <= 0.2 + k * 0.12) GT[k] = 0;
      }
      for (let i = 0; i < n[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --n[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PM[i] = PM[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        const k = Math.pow(0.08, dt);
        (PVX[i] = PVX[i]! * k), (PVY[i] = PVY[i]! * k + s * 30 * dt);
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
      }
      for (let i = 0; i < RAIN; i++) {
        (WY[i] = WY[i]! + WV[i]! * s * 34 * dt), (WX[i] = WX[i]! - WV[i]! * s * 8 * dt);
        if (WY[i]! > h + s * 4) (WY[i] = -s * 4), (WX[i] = R() * w * 1.2);
      }
      (G[9] = Math.max(0, G[9]! - dt)), (G[10] = Math.max(0, G[10]! - dt)), (G[31] = Math.max(0, G[31]! - dt)), (G[34] = Math.max(0, G[34]! - dt));
      if ((G[5] === FLAT || G[5] === ROOT) && G[6]! < 1.2) busy = true;
      if (busy || n[0] || G[9]! > 0 || G[10]! > 0 || G[31]! > 0 || G[34]! > 0 || G[11]) e.busy();
    },
    render() {
      const t = G[8]!, f = (t * 30) | 0;
      // The page: only the nodes that are hit or glitching are written, and written back exactly.
      for (let k = 0; k < ne; k++) {
        const el = els[k]!, g = GT[k]! >= 0 ? 1 : 0, hit = HT[k]! > 0 ? 1 : 0;
        if (hit !== LH[k]) (LH[k] = hit), L.attr(el, "data-nr-hit", hit ? "" : null);
        if (g) {
          const amp = 1 - GT[k]! / GLITCH, sx = Math.round(amp * 6 * (f & 1 ? 1 : 0.5)), jx = (f * 7 + k) % 3 === 0 ? Math.round((((f * 13 + k * 5) % 7) - 3) * amp) : 0;
          if (!LG[k]) (LG[k] = 1), L.attr(el, "data-nr-glitch", "");
          if (sx !== LS[k]) (LS[k] = sx), L.style(el, "--gx", GX[sx + 6]!);
          if (jx !== LJ[k]) (LJ[k] = jx), jx ? L.style(el, "--jx", GX[jx + 6]!) : L.unstyle(el, "--jx");
          const ts = texts[k]!, os = orig[k]!;
          let idx = 0, total = 0;
          for (let j = 0; j < os.length; j++) total += os[j]!.length;
          for (let j = 0; j < ts.length; j++) {
            const o = os[j]!, len = Math.min(o.length, codes.length);
            for (let c = 0; c < len; c++, idx++) {
              const ch = o.charCodeAt(c);
              codes[c] = ch === 32 || GT[k]! > 0.12 + 0.6 * (idx / total) ? ch : GLYPHS.charCodeAt((c * 7 + f * 3 + k * 5) % GLYPHS.length);
            }
            L.text(ts[j]!, String.fromCharCode.apply(null, codes.subarray(0, len) as unknown as number[]) + o.slice(len));
          }
        } else if (LG[k]) {
          (LG[k] = 0), (LS[k] = 0), (LJ[k] = 0);
          L.attr(el, "data-nr-glitch", null);
          L.unstyle(el, "--gx");
          L.unstyle(el, "--jx");
          for (let j = 0; j < texts[k]!.length; j++) L.text(texts[k]![j]!, orig[k]![j]!);
        }
      }
      if (G[11]) {
        G[11] = 0;
        L.text(msgNode, MSGS[G[12]!]!);
        const tr = G[24] ? "trace — alarm cut" : `trace ${Math.min(100, Math.round(G[7]!))}%`;
        if (tr !== traceNow) (traceNow = tr), L.text(traceNode, tr);
        stamp = G[5] === FLAT ? "FLATLINED" : G[5] === ROOT ? "VAULT OPEN" : "";
        sub = G[5] === FLAT ? "every node re-ICEd · tap to jack in again" : "root on every node · tap to re-ICE";
      }
      const dpr = G[3]!, w = G[0]!, h = G[1]!, s = G[2]!, glow = G[28]!;
      const sh = G[9]! > 0 ? ((f & 1 ? 1 : -1) * G[9]! * s * 3) : 0;
      ctx.setTransform(dpr, 0, 0, dpr, sh * dpr, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(-s * 4, 0, w + s * 8, h);
      // Rain on the glass: thin streaks, leaning with the wind.
      ctx.strokeStyle = col[RAINC]!;
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.globalAlpha = glow ? 0.22 : 0.18;
      ctx.beginPath();
      for (let i = 0; i < RAIN; i++) ctx.moveTo(WX[i]!, WY[i]!), ctx.lineTo(WX[i]! + WL[i]! * s * 0.5, WY[i]! - WL[i]! * s * 2.2);
      ctx.stroke();
      // ICE: a bracket per layer around each live node; breached nodes wear a tag.
      ctx.lineWidth = Math.max(1, s * 0.22);
      for (let k = 0; k < ne; k++) {
        const c = k === sen ? col[SEN]! : col[ICEC]!, x = BX[k]!, y = BY[k]!, bw = BW[k]!, bh = BH[k]!;
        ctx.strokeStyle = c;
        if (!ICE[k]) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = col[OWN]!;
          ctx.font = font;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          if (k === sen) ctx.fillStyle = c;
          ctx.fillText(k === sen ? "▲ ALARM CUT" : "▲ OWNED", x, y - s * 0.4);
          ctx.fillRect(x, y + bh + s * 0.5, bw, Math.max(1, s * 0.18));
          continue;
        }
        for (let l = 0; l < ICE[k]!; l++) {
          const p = s * (0.9 + l * 0.8), cl = s * 1.4, x0 = x - p, y0 = y - p, x1 = x + bw + p, y1 = y + bh + p;
          ctx.globalAlpha = (HT[k]! > 0 && l === ICE[k]! - 1 ? 1 : 0.85 - l * 0.2) * (glow ? 1 : 0.9);
          ctx.beginPath();
          ctx.moveTo(x0, y0 + cl), ctx.lineTo(x0, y0), ctx.lineTo(x0 + cl, y0);
          ctx.moveTo(x1 - cl, y0), ctx.lineTo(x1, y0), ctx.lineTo(x1, y0 + cl);
          ctx.moveTo(x1, y1 - cl), ctx.lineTo(x1, y1), ctx.lineTo(x1 - cl, y1);
          ctx.moveTo(x0 + cl, y1), ctx.lineTo(x0, y1), ctx.lineTo(x0, y1 - cl);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.3;
        ctx.setLineDash(DASH);
        ctx.strokeRect(x - s * 0.9, y - s * 0.9, bw + s * 1.8, bh + s * 1.8);
        ctx.setLineDash(SOLID);
        if (HT[k]! > 0) {
          ctx.globalAlpha = HT[k]! * 3;
          ctx.fillStyle = c;
          ctx.fillRect(x - s * 0.9, y - s * 0.9, bw + s * 1.8, bh + s * 1.8);
        }
      }
      if (glow) ctx.globalCompositeOperation = "lighter";
      // Trace pulses: the circuit lights behind each one on its way to SECURITY.
      for (let u = 0; u < PU; u++) {
        const e = UE[u]!;
        if (e < 0) continue;
        ctx.strokeStyle = col[SEN]!;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(1, s * 0.16);
        ctx.beginPath();
        ctx.moveTo(center(e, 0), BY[e]!);
        ctx.lineTo(center(e, 0), bus()), ctx.lineTo(center(sen, 0), bus()), ctx.lineTo(center(sen, 0), BY[sen]! - s * 0.9);
        ctx.stroke();
        pathAt(e, UD[u]!);
        ctx.globalAlpha = 1;
        ctx.fillStyle = col[SEN]!;
        ctx.fillRect(pp[0]! - s * 0.5, pp[1]! - s * 0.5, s, s);
      }
      // Packets: a hot head and a trail of where they bounced.
      for (let i = 0; i < PK; i++) {
        if (KC[i]! <= 0) continue;
        ctx.strokeStyle = col[PKT]!;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = pass ? 0.9 : 0.25;
          ctx.lineWidth = pass ? Math.max(1, s * 0.3) : s * 1.1;
          ctx.beginPath();
          for (let k = 0; k < TN[i]!; k++) {
            const j = i * TR + ((TI[i]! - TN[i]! + k + TR) % TR);
            k ? ctx.lineTo(TX[j]!, TY[j]!) : ctx.moveTo(TX[j]!, TY[j]!);
          }
          ctx.lineTo(KX[i]!, KY[i]!);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow ? "#ffffff" : col[PKT]!;
        ctx.beginPath();
        ctx.arc(KX[i]!, KY[i]!, s * 0.55, 0, 6.2832);
        ctx.fill();
      }
      // Sparks and shards: short streaks along their flight.
      ctx.lineWidth = Math.max(1, s * 0.22);
      for (let i = 0; i < n[0]!; i++) {
        ctx.globalAlpha = Math.min(1, (PL[i]! / PM[i]!) * 1.5);
        ctx.strokeStyle = col[PC[i]!]!;
        ctx.beginPath();
        ctx.moveTo(PX[i]!, PY[i]!), ctx.lineTo(PX[i]! - PVX[i]! * 0.03, PY[i]! - PVY[i]! * 0.03);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // The jack on WREN's deck, and its flash on a launch.
      const jx = G[26]!, jy = G[27]!;
      ctx.globalAlpha = 1;
      ctx.fillStyle = col[PKT]!;
      ctx.fillRect(jx - s * 0.7, jy - s * 0.35, s * 1.4, s * 0.7);
      if (G[31]! > 0) {
        ctx.globalAlpha = G[31]! * 5;
        ctx.beginPath();
        ctx.arc(jx, jy, s * (1 + (0.18 - G[31]!) * 14), 0, 6.2832);
        ctx.fill();
      }
      // The daemon: a knot of black spikes with red eyes; you are the red reticle it hunts.
      if (G[22] || G[34]! > 0) {
        const x = G[16]!, y = G[17]!, rd = s * 3, a = G[22] ? 1 : G[34]! / 0.6;
        if (G[22] && G[15]) {
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12);
          ctx.strokeStyle = col[EYE]!;
          ctx.lineWidth = Math.max(1, s * 0.2);
          ctx.beginPath();
          ctx.arc(G[13]!, G[14]!, s * 1.6, 0, 6.2832);
          ctx.moveTo(G[13]! - s * 2.4, G[14]!), ctx.lineTo(G[13]! + s * 2.4, G[14]!), ctx.moveTo(G[13]!, G[14]! - s * 2.4), ctx.lineTo(G[13]!, G[14]! + s * 2.4);
          ctx.stroke();
        }
        if (G[22]) {
          ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 9);
          ctx.fillStyle = col[EYE]!;
          ctx.beginPath();
          ctx.arc(x, y, rd * 1.9, 0, 6.2832);
          ctx.fill();
        }
        // Its smear: black echoes of where it was.
        ctx.fillStyle = col[DAE]!;
        for (let k = 0; k < 10; k++) {
          ctx.globalAlpha = a * 0.13;
          ctx.beginPath();
          ctx.arc(DSX[k]!, DSY[k]!, rd * (0.5 + ((k * 3 + ((t * 30) | 0)) % 10) * 0.04), 0, 6.2832);
          ctx.fill();
        }
        ctx.globalAlpha = a;
        ctx.strokeStyle = col[EYE]!;
        ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath();
        for (let k = 0; k < 18; k++) {
          const an = (k / 18) * 6.2832 + t * 1.7, r = rd * (k & 1 ? 0.6 : 1 + 0.45 * Math.sin(t * 11 + k * 2.1));
          k ? ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r) : ctx.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col[EYE]!;
        const lx = Math.max(-1, Math.min(1, G[18]! / (s * 20))) * rd * 0.2;
        ctx.fillRect(x - rd * 0.42 + lx, y - rd * 0.18, rd * 0.3, rd * 0.16);
        ctx.fillRect(x + rd * 0.12 + lx, y - rd * 0.18, rd * 0.3, rd * 0.16);
        // Its health: three pips over it.
        for (let k = 0; k < 3 && G[22]; k++) ctx.fillRect(x - rd * 0.6 + k * rd * 0.45, y - rd * 1.55, rd * 0.32, rd * 0.12 * (k < G[20]! ? 1 : 0.3));
      }
      // The alarm: a red frame that throbs while the daemon is out; a flash on a breach or a catch.
      if (G[22]) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 8);
        ctx.strokeStyle = col[EYE]!;
        ctx.lineWidth = s * 0.8;
        ctx.strokeRect(s * 0.4, s * 0.4, w - s * 0.8, h - s * 0.8);
      }
      if (G[10]! > 0) {
        ctx.globalAlpha = G[10]! * 3;
        ctx.fillStyle = G[5] === FLAT || G[22] ? col[EYE]! : col[OWN]!;
        ctx.fillRect(-s * 4, 0, w + s * 8, h);
      }
      if (stamp && G[6]! > 0.15) {
        const k = Math.min(1, (G[6]! - 0.15) * 4), o = glow ? s * 0.35 * (1 - k * 0.6) : 0, y = h * 0.75;
        // A band across the glass so the stamp reads over anything.
        ctx.globalAlpha = 0.78 * k;
        ctx.fillStyle = col[BG]!;
        ctx.fillRect(0, y - s * 4.4, w, s * 10);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = big;
        if (o) {
          ctx.globalAlpha = k * 0.8;
          ctx.fillStyle = col[SEN]!;
          ctx.fillText(stamp, w / 2 - o, y);
          ctx.fillStyle = col[ICEC]!;
          ctx.fillText(stamp, w / 2 + o, y);
        }
        ctx.globalAlpha = k;
        ctx.fillStyle = G[5] === FLAT ? col[EYE]! : col[OWN]!;
        ctx.fillText(stamp, w / 2, y);
        if (G[6]! > 0.6) {
          ctx.font = font;
          ctx.fillStyle = col[INK]!;
          ctx.globalAlpha = 0.85;
          ctx.fillText(sub, w / 2, y + s * 4);
        }
      }
      ctx.globalAlpha = 1;
    },
  });
  engine.start();
  if (first) (q[0] = 1), (q[1] = G[13] = first.x), (q[2] = G[14] = first.y), (G[15] = 1);
  return {
    engine,
    /** For tests: the phase (0 intro, 1 play, 2 flatlined, 3 root), trace, breached nodes, ICE left, packets in flight, daemon, alarm cut, counts. */
    get state() {
      let ice = 0, live = 0;
      for (let k = 0; k < ne; k++) ice += ICE[k]!;
      for (let i = 0; i < PK; i++) live += KC[i]! > 0 ? 1 : 0;
      return { phase: G[5]!, trace: G[7]!, owned: G[25]!, ice, packets: live, daemon: G[22]!, cut: G[24]!, fired: G[29]!, breaches: G[30]!, flatlines: G[32]!, purges: G[33]!, dx: G[16]!, dy: G[17]! };
    },
    /** For the poster: the same intro every time. */
    poster() {
      R.state = 11;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => jackIn(stage, slot, first);
