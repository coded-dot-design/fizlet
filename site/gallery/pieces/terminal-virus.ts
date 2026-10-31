// "Terminal virus": a worm types itself into the terminal, crawls out onto the README beside it
// and eats its letters, real ones: each bite rewrites a character of the page's own text through
// the engine's ledger. Every four letters it forks (a new pid). Tap a worm to kill -9 it: it
// bursts, the blast knocks its neighbours tumbling, and every letter it chewed flies back home as a
// green packet and is written back exactly. Let it eat half the page and the kernel panics, then
// Recall rolls the whole page back. Clean: tap to reinfect, one more worm each wave.
// Bricks: the kernel (fixed step, settle: no frames once still; the ledger: every text write is
// recorded, so destroy() gives the page back byte for byte), fzlt/steer's exact hypot and
// fzlt/slot. Step allocates nothing (typed arrays); text is written only on the frame it changes.
import { createEngine } from "../../../src/kernel/index";
import { hypot } from "../../../src/steer";
import type { SlotScene, SlotTap } from "../../../src/slot";

const LETTERS = 420, WORMS = 16, SEG = 5, PARTS = 220, PACKETS = 96, RINGS = 10;
const BITES = 4, PANIC = 0.5, HIT = 24;
const GLYPHS = "#%&@$*!?<>/\\|{}[]~^01";
/** Worm life phases. */
const OFF = 0, LIVE = 1;
/** Story phases. */
const IDLE = 0, TYPING = 1, PLAY = 2, PANICKED = 3, DONE = 4;

export function terminalVirus(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const engine = createEngine({ root: stage, fps: 60, settle: 0.4 });
  const L = engine.ledger, R = engine.random;
  const doc = slot.querySelector<HTMLElement>("[data-tv-doc]")!, tv = slot.querySelector<HTMLElement>("[data-tv]")!;
  const logEls = [...slot.querySelectorAll<HTMLElement>("[data-tv-log] span")], stat = slot.querySelector<HTMLElement>("[data-tv-stat]")!;
  const logNodes = logEls.map((el) => (el.firstChild as Text | null) ?? L.add(el.appendChild(document.createTextNode(""))));
  const statNode = stat.firstChild as Text;
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // The README's letters: their text node, offset, original and current code, where they sit.
  const nodes: Text[] = [];
  const NODE = new Uint16Array(LETTERS), OFFS = new Uint16Array(LETTERS), ORIG = new Uint16Array(LETTERS), CUR = new Uint16Array(LETTERS);
  const LX = new Float32Array(LETTERS), LY = new Float32Array(LETTERS), LW = new Float32Array(LETTERS), LH = new Float32Array(LETTERS);
  /** 0 clean, worm slot + 1 while a worm owns its bite, 255 while a packet carries it home. */
  const OWN = new Uint8Array(LETTERS), CLAIM = new Uint8Array(LETTERS), FLASH = new Float32Array(LETTERS);
  let nL = 0;
  const walk = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode() as Text | null; t; t = walk.nextNode() as Text | null) {
    const v = t.nodeValue ?? "";
    for (let i = 0; i < v.length && nL < LETTERS; i++) {
      if (v.charCodeAt(i) <= 32) continue;
      (NODE[nL] = nodes.length), (OFFS[nL] = i), (ORIG[nL] = CUR[nL] = v.charCodeAt(i)), nL++;
    }
    nodes.push(t);
  }
  const dirty = new Uint8Array(nodes.length);
  const codes = nodes.map((t) => new Uint16Array(t.nodeValue!.length).map((_, i) => t.nodeValue!.charCodeAt(i)));

  // Worms: head, velocity, target letter, chew time, bites, stun, pid; SEG trailing segments.
  const WX = new Float32Array(WORMS), WY = new Float32Array(WORMS), VX = new Float32Array(WORMS), VY = new Float32Array(WORMS);
  const TG = new Int16Array(WORMS).fill(-1), CHEW = new Float32Array(WORMS), BIT = new Uint8Array(WORMS), STUN = new Float32Array(WORMS);
  const ST = new Uint8Array(WORMS), PID = new Uint32Array(WORMS), AGE = new Float32Array(WORMS);
  const SX = new Float32Array(WORMS * SEG), SY = new Float32Array(WORMS * SEG);
  // Particles (bits of worm, chew sparks), packets (a letter flying home), rings (blasts, misses).
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const KX = new Float32Array(PACKETS), KY = new Float32Array(PACKETS), KD = new Float32Array(PACKETS), KT = new Int16Array(PACKETS), KX0 = new Float32Array(PACKETS), KY0 = new Float32Array(PACKETS);
  const RX = new Float32Array(RINGS), RY = new Float32Array(RINGS), RA = new Float32Array(RINGS), RC = new Uint8Array(RINGS);
  const n = new Uint32Array(3); // parts, packets, rings
  // Scene: [0] w, [1] h, [2] scale, [3] measure, [4] stage left, [5] top, [6] terminal x, [7] y,
  // [8] phase, [9] phase time, [10] typed chars, [11] wave, [12] kills, [13] corrupted, [14] next pid,
  // [15] stat dirty, [16] log dirty, [17] shake, [18] dpr, [19] time, [20] panic flash.
  const G = new Float64Array(24);
  const q = new Float64Array(3); // a pending tap: [0] 1, [1] x, [2] y (CSS px in the stage)
  G[3] = 1, G[11] = 1, G[14] = 4012, G[8] = IDLE;
  // The log: the lines on screen and a queue of lines to type (strings made only on an event).
  const log: string[] = logNodes.map((t) => t.nodeValue ?? "");
  const queue: string[] = [];
  let typing = "", after = 0; // after typing: 1 spawn the wave, 2 recall
  const say = (s: string) => (log.push(s), log.shift(), (G[16] = 1));
  const type = (s: string, then = 0) => (queue.push(s), (after = then || after));
  const pct = () => Math.round((100 * G[13]!) / Math.max(1, nL));
  let col = ["#ff2e88", "#ff7389", "#39ffb0", "#19f0ff", "#ffc21a", "#07060f"];

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

  function part(x: number, y: number, vx: number, vy: number, life: number, c: number) {
    const i = n[0]!;
    if (i >= PARTS) return;
    n[0] = i + 1;
    (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = life), (PC[i] = c);
  }
  function ring(x: number, y: number, c: number) {
    const i = n[2]! < RINGS ? n[2]! : 0;
    if (i) n[2] = i + 1;
    else if (n[2]! < RINGS) n[2] = 1;
    (RX[i] = x), (RY[i] = y), (RA[i] = 0), (RC[i] = c);
  }
  function corrupt(l: number, w: number) {
    let g = GLYPHS.charCodeAt((R() * GLYPHS.length) | 0);
    if (g === ORIG[l]) g = 35;
    CUR[l] = g;
    codes[NODE[l]!]![OFFS[l]!] = g;
    dirty[NODE[l]!] = 1;
    OWN[l] = w + 1;
    G[13] = G[13]! + 1;
    G[15] = 1;
  }
  function heal(l: number) {
    CUR[l] = ORIG[l]!;
    codes[NODE[l]!]![OFFS[l]!] = ORIG[l]!;
    dirty[NODE[l]!] = 1;
    OWN[l] = 0;
    FLASH[l] = 0.6;
    G[13] = G[13]! - 1;
    G[15] = 1;
  }
  /** Send letter `l` home from (x, y) as a packet, `d` s later (healed at once if the pool is full). */
  function home(l: number, x: number, y: number, d: number) {
    const i = n[1]!;
    if (i >= PACKETS) return heal(l);
    n[1] = i + 1;
    OWN[l] = 255;
    (KX[i] = KX0[i] = x), (KY[i] = KY0[i] = y), (KD[i] = -d), (KT[i] = l);
  }
  function spawn(x: number, y: number, vx: number, vy: number) {
    for (let w = 0; w < WORMS; w++) {
      if (ST[w] !== OFF) continue;
      (ST[w] = LIVE), (WX[w] = x), (WY[w] = y), (VX[w] = vx), (VY[w] = vy), (TG[w] = -1), (CHEW[w] = 0), (BIT[w] = 0), (STUN[w] = 0), (AGE[w] = 0);
      PID[w] = G[14]!;
      G[14] = G[14]! + 1;
      for (let k = 0; k < SEG; k++) (SX[w * SEG + k] = x), (SY[w * SEG + k] = y);
      return w;
    }
    return -1;
  }
  /** The nearest clean, unclaimed letter (with a little noise so worms spread out). */
  function pick(w: number) {
    let best = -1, bd = 1e9;
    for (let l = 0; l < nL; l++) {
      if (OWN[l] || CLAIM[l] || LW[l]! <= 0) continue;
      const d = hypot(LX[l]! - WX[w]!, LY[l]! - WY[w]!) + R() * 60 * G[2]!;
      if (d < bd) (bd = d), (best = l);
    }
    if (TG[w]! >= 0) CLAIM[TG[w]!] = 0;
    TG[w] = best;
    if (best >= 0) CLAIM[best] = 1;
  }
  function kill(w: number, blast: boolean) {
    const x = WX[w]!, y = WY[w]!, s = G[2]!;
    ST[w] = OFF;
    if (TG[w]! >= 0) CLAIM[TG[w]!] = 0;
    TG[w] = -1;
    for (let k = 0; k < 18; k++) {
      const a = R() * 6.283, v = (60 + R() * 160) * s;
      part(x, y, Math.cos(a) * v, Math.sin(a) * v - 60 * s, 0.5 + R() * 0.5, k & 1);
    }
    let d = 0;
    for (let l = 0; l < nL; l++) if (OWN[l] === w + 1) home(l, x, y, (d += 0.05));
    if (!blast) return;
    ring(x, y, 0);
    G[17] = 0.18;
    G[12] = G[12]! + 1;
    G[15] = 1;
    // The blast knocks every worm near it tumbling (nearer: harder).
    for (let o = 0; o < WORMS; o++) {
      if (ST[o] !== LIVE) continue;
      const dx = WX[o]! - x, dy = WY[o]! - y, r = hypot(dx, dy), reach = 90 * s;
      if (r >= reach || r === 0) continue;
      const k = ((1 - r / reach) * 420 * s) / r;
      (VX[o] = VX[o]! + dx * k), (VY[o] = VY[o]! + dy * k), (STUN[o] = 0.7);
    }
  }
  function wave() {
    G[8] = TYPING;
    G[9] = 0;
    type("$ curl -s dom.virus | sh", 1);
  }

  engine.add({
    read() {
      if (!G[3]) return;
      G[3] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      (G[0] = r.width), (G[1] = r.height), (G[2] = r.width / 640), (G[4] = r.left), (G[5] = r.top), (G[18] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      const range = document.createRange(), box = doc.getBoundingClientRect();
      for (let l = 0; l < nL; l++) {
        range.setStart(nodes[NODE[l]!]!, OFFS[l]!);
        range.setEnd(nodes[NODE[l]!]!, OFFS[l]! + 1);
        const b = range.getBoundingClientRect();
        (LX[l] = b.left - r.left + b.width / 2), (LY[l] = b.top - r.top + b.height / 2), (LH[l] = b.height);
        LW[l] = b.bottom <= box.bottom && b.right <= box.right ? b.width : 0; // clipped letters are not food
      }
      const last = logEls[logEls.length - 1]!.getBoundingClientRect();
      (G[6] = Math.min(last.right, logEls[0]!.parentElement!.getBoundingClientRect().right) - r.left - 6), (G[7] = last.top - r.top + last.height / 2);
      const cs = getComputedStyle(tv);
      col = [cs.getPropertyValue("--tv-bug").trim() || col[0]!, cs.getPropertyValue("--tv-bug2").trim() || col[1]!, cs.getPropertyValue("--tv-heal").trim() || col[2]!, cs.getPropertyValue("--tv-glow").trim() || col[3]!, col[4]!, col[5]!];
    },
    step(e, dt) {
      const s = G[2]!, w0 = G[0]!, h0 = G[1]!;
      G[19] = G[19]! + dt;
      G[9] = G[9]! + dt;
      let busy = false;
      // A tap: kill the worm under it (generous on touch), or a miss scatters the nearest.
      if (q[0]) {
        q[0] = 0;
        const x = q[1]!, y = q[2]!;
        let hit = -1, hd = Math.max(HIT, 26 * s);
        for (let w = 0; w < WORMS; w++) {
          if (ST[w] !== LIVE) continue;
          const d = hypot(WX[w]! - x, WY[w]! - y);
          if (d < hd) (hd = d), (hit = w);
        }
        if (hit >= 0) {
          G[20] = PID[hit]!;
          kill(hit, true);
          G[16] = 2; // log "kill -9 <pid>"
        } else if (G[8] === DONE || G[8] === IDLE) {
          G[11] = G[8] === DONE ? Math.min(4, G[11]! + 1) : G[11]!;
          wave();
        } else {
          ring(x, y, 1);
          for (let w = 0; w < WORMS; w++) {
            if (ST[w] !== LIVE) continue;
            const dx = WX[w]! - x, dy = WY[w]! - y, r = hypot(dx, dy);
            if (r < 120 * s && r > 0) (VX[w] = VX[w]! + (dx / r) * 160 * s), (VY[w] = VY[w]! + (dy / r) * 160 * s);
          }
        }
      }
      // Typing: one line at a time, 40 characters a second.
      if (typing || queue.length) {
        busy = true;
        if (!typing) {
          typing = queue.shift()!;
          G[10] = 0;
          const last = log[log.length - 1]!;
          if (last !== "$ " && last !== "") say("");
        }
        G[10] = G[10]! + dt * 40;
        if (G[10]! >= typing.length) {
          (G[10] = typing.length), (G[16] = 1);
          log[log.length - 1] = typing;
          typing = "";
          if (!queue.length && after) {
            if (after === 1) {
              G[8] = PLAY;
              G[9] = 0;
              for (let k = 0; k < G[11]!; k++) spawn(G[6]!, G[7]!, (90 + k * 30) * s, (k - 1) * 50 * s);
              G[16] = 3; // log the spawn
            } else if (after === 2) {
              for (let l = 0; l < nL; l++) if (OWN[l] && OWN[l] !== 255) home(l, G[6]!, G[7]!, l * 0.004);
              G[8] = DONE;
              G[16] = 5;
            }
            after = 0;
          }
        }
      }
      // Worms: steer to their letter, chew it, fork every BITES letters, push apart, bounce.
      let live = 0;
      for (let w = 0; w < WORMS; w++) {
        if (ST[w] !== LIVE) continue;
        live++;
        AGE[w] = AGE[w]! + dt;
        if (G[8] === PANICKED) {
          (VX[w] = VX[w]! * 0.8), (VY[w] = VY[w]! * 0.8);
        } else if (STUN[w]! > 0) {
          STUN[w] = STUN[w]! - dt;
          const k = Math.pow(0.04, dt);
          (VX[w] = VX[w]! * k), (VY[w] = VY[w]! * k);
        } else if (CHEW[w]! > 0) {
          CHEW[w] = CHEW[w]! - dt;
          (VX[w] = VX[w]! * 0.7), (VY[w] = VY[w]! * 0.7);
          if (CHEW[w]! <= 0) {
            const l = TG[w]!;
            if (l >= 0 && !OWN[l]) {
              corrupt(l, w);
              for (let k = 0; k < 5; k++) part(LX[l]!, LY[l]!, (R() - 0.5) * 120 * s, (-40 - R() * 80) * s, 0.3 + R() * 0.3, 2 + (k & 1));
              if (++BIT[w]! % BITES === 0) {
                const o = spawn(WX[w]!, WY[w]!, -VX[w]! - 60 * s, -VY[w]! + 60 * s);
                if (o >= 0) (G[20] = PID[o]!), (G[16] = 4);
              }
            }
            pick(w);
          }
        } else {
          let l = TG[w]!;
          if (l < 0 || OWN[l]) pick(w), (l = TG[w]!);
          if (l >= 0) {
            const dx = LX[l]! - WX[w]!, dy = LY[l]! - WY[w]!, d = hypot(dx, dy), sp = (70 + 12 * G[11]!) * s;
            if (d < 5 * s) CHEW[w] = 0.28;
            else {
              const wig = Math.sin(AGE[w]! * 9 + w) * 0.6, ux = dx / d, uy = dy / d;
              const tx = (ux - uy * wig) * sp, ty = (uy + ux * wig) * sp, k = Math.min(1, dt * 5);
              (VX[w] = VX[w]! + (tx - VX[w]!) * k), (VY[w] = VY[w]! + (ty - VY[w]!) * k);
            }
          } else (VX[w] = VX[w]! * 0.9), (VY[w] = VY[w]! * 0.9);
        }
        // Worms collide: two heads closer than 2r push each other apart, equally.
        const r2 = 9 * s;
        for (let o = w + 1; o < WORMS; o++) {
          if (ST[o] !== LIVE) continue;
          const dx = WX[o]! - WX[w]!, dy = WY[o]! - WY[w]!, d = hypot(dx, dy);
          if (d >= r2 * 2 || d === 0) continue;
          const push = (r2 * 2 - d) / d / 2;
          (WX[w] = WX[w]! - dx * push), (WY[w] = WY[w]! - dy * push), (WX[o] = WX[o]! + dx * push), (WY[o] = WY[o]! + dy * push);
        }
        (WX[w] = WX[w]! + VX[w]! * dt), (WY[w] = WY[w]! + VY[w]! * dt);
        if (WX[w]! < 4) (WX[w] = 4), (VX[w] = Math.abs(VX[w]!));
        if (WX[w]! > w0 - 4) (WX[w] = w0 - 4), (VX[w] = -Math.abs(VX[w]!));
        if (WY[w]! < 4) (WY[w] = 4), (VY[w] = Math.abs(VY[w]!));
        if (WY[w]! > h0 - 4) (WY[w] = h0 - 4), (VY[w] = -Math.abs(VY[w]!));
        // Segments follow the head at a fixed spacing.
        let px = WX[w]!, py = WY[w]!;
        for (let k = 0; k < SEG; k++) {
          const i = w * SEG + k, dx = SX[i]! - px, dy = SY[i]! - py, d = hypot(dx, dy), gap = (4.6 - k * 0.4) * s;
          if (d > gap) (SX[i] = px + (dx / d) * gap), (SY[i] = py + (dy / d) * gap);
          (px = SX[i]!), (py = SY[i]!);
        }
      }
      // Half the page eaten: kernel panic, then Recall rolls the page back.
      if (G[8] === PLAY && G[13]! >= nL * PANIC) (G[8] = PANICKED), (G[9] = 0), (G[16] = 6);
      if (G[8] === PANICKED && G[9]! > 1.3) {
        for (let w = 0; w < WORMS; w++) if (ST[w] === LIVE) kill(w, false);
        G[8] = TYPING;
        type("$ recall --all", 2);
      }
      if (G[8] === PLAY && live === 0 && n[1] === 0 && G[9]! > 0.5) (G[8] = DONE), (G[16] = 7);
      // Particles fall and fade; packets fly home on a curve and heal their letter on arrival.
      for (let i = 0; i < n[0]!; i++) {
        PL[i] = PL[i]! - dt;
        if (PL[i]! <= 0) {
          const j = --n[0]!;
          (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PC[i] = PC[j]!);
          i--;
          continue;
        }
        PVY[i] = PVY[i]! + 420 * s * dt;
        (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
        if (PY[i]! > h0 - 2) (PY[i] = h0 - 2), (PVY[i] = -PVY[i]! * 0.4), (PVX[i] = PVX[i]! * 0.7);
      }
      for (let i = 0; i < n[1]!; i++) {
        KD[i] = KD[i]! + dt * 2.2;
        const t = KD[i]!, l = KT[i]!;
        if (t >= 1) {
          heal(l);
          const j = --n[1]!;
          (KX[i] = KX[j]!), (KY[i] = KY[j]!), (KD[i] = KD[j]!), (KT[i] = KT[j]!), (KX0[i] = KX0[j]!), (KY0[i] = KY0[j]!);
          i--;
          continue;
        }
        if (t <= 0) continue;
        const u = t * t * (3 - 2 * t), lift = Math.sin(t * 3.1416) * 40 * s;
        (KX[i] = KX0[i]! + (LX[l]! - KX0[i]!) * u), (KY[i] = KY0[i]! + (LY[l]! - KY0[i]!) * u - lift);
      }
      for (let i = 0; i < n[2]!; i++) RA[i] = RA[i]! + dt * 2.5;
      while (n[2]! > 0 && RA[n[2]! - 1]! >= 1) n[2] = n[2]! - 1;
      let fl = 0;
      for (let l = 0; l < nL; l++) if (FLASH[l]! > 0) (FLASH[l] = FLASH[l]! - dt), fl++;
      G[17] = Math.max(0, G[17]! - dt);
      if (busy || live || n[0] || n[1] || n[2] || fl || G[17]! > 0 || G[8] === PANICKED || G[8] === TYPING || G[16] || G[15]) e.busy();
    },
    render() {
      // Text: only the nodes that changed this frame; the log and the stat line only on an event.
      for (let i = 0; i < nodes.length; i++) if (dirty[i]) (dirty[i] = 0), L.text(nodes[i]!, String.fromCharCode.apply(null, codes[i] as unknown as number[]));
      const ev = G[16]!;
      if (ev) {
        G[16] = 0;
        const pid = G[20]!;
        if (ev === 2) say(`kill -9 ${pid}  ✓ rolled back`);
        else if (ev === 3) say(`[+] worm ${G[14]! - G[11]!} → README.md`);
        else if (ev === 4) say(`[+] fork ${pid}`);
        else if (ev === 5) say("page restored, byte for byte"), say("tap to reinfect");
        else if (ev === 6) say(`!! KERNEL PANIC ${pct()}% eaten`);
        else if (ev === 7) say("$ ps | grep worm"), say("(none) clean ✓ tap to reinfect");
        for (let i = 0; i < logNodes.length; i++) L.text(logNodes[i]!, log[i]!);
      }
      if (typing) {
        const k = Math.floor(G[10]!), last = log.length - 1;
        if (log[last]!.length !== k) (log[last] = typing.slice(0, k)), L.text(logNodes[last]!, log[last]!);
      }
      if (G[15]) (G[15] = 0), L.text(statNode, `kills ${G[12]} · infected ${pct()}%`);
      // The canvas: bites (tinted, flickering), healed flashes, rings, packets, worms, bits.
      const dpr = G[18]!, s = G[2]!, t = G[19]!, sh = G[17]! > 0 ? (R() - 0.5) * 6 * s : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, G[0]!, G[1]!);
      ctx.translate(sh, 0);
      for (let l = 0; l < nL; l++) {
        if (OWN[l]) {
          ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 20 + l);
          ctx.fillStyle = col[0]!;
          ctx.fillRect(LX[l]! - LW[l]! / 2, LY[l]! - LH[l]! / 2, LW[l]!, LH[l]!);
        } else if (FLASH[l]! > 0) {
          ctx.globalAlpha = FLASH[l]! * 0.7;
          ctx.fillStyle = col[2]!;
          ctx.fillRect(LX[l]! - LW[l]! / 2 - 1, LY[l]! - LH[l]! / 2, LW[l]! + 2, LH[l]!);
        }
      }
      ctx.lineWidth = 2.5 * s + 1;
      for (let i = 0; i < n[2]!; i++) {
        ctx.globalAlpha = 1 - RA[i]!;
        ctx.strokeStyle = col[RC[i] ? 3 : 0]!;
        ctx.beginPath();
        ctx.arc(RX[i]!, RY[i]!, (8 + RA[i]! * (RC[i] ? 30 : 70)) * s, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col[2]!;
      const ps = Math.max(2, 4 * s);
      for (let i = 0; i < n[1]!; i++) if (KD[i]! > 0) ctx.fillRect(KX[i]! - ps / 2, KY[i]! - ps / 2, ps, ps);
      const u = Math.max(3, 6.5 * s), panic = G[8] === PANICKED;
      for (let w = 0; w < WORMS; w++) {
        if (ST[w] !== LIVE) continue;
        for (let k = SEG - 1; k >= 0; k--) {
          const i = w * SEG + k, z = u * (1 - k * 0.12);
          ctx.fillStyle = col[k & 1 ? 0 : 1]!;
          ctx.fillRect(SX[i]! - z / 2, SY[i]! - z / 2, z, z);
        }
        // The head: a glitch split (cyan behind), two eyes; stunned: eyes as x's; chewing: jaws.
        const x = WX[w]!, y = WY[w]!, z = u * 1.5, gx = panic || STUN[w]! > 0 ? (R() - 0.5) * 4 * s : 0;
        ctx.fillStyle = col[3]!;
        ctx.fillRect(x - z / 2 - 1.5 * s + gx, y - z / 2, z, z);
        ctx.fillStyle = col[0]!;
        ctx.fillRect(x - z / 2, y - z / 2, z, z);
        ctx.fillStyle = col[5]!;
        const e = Math.max(1, z / 5);
        if (STUN[w]! > 0) ctx.fillRect(x - z / 4 - e / 2, y - e / 2, e, e), ctx.fillRect(x + z / 4 - e / 2, y - e / 2, e, e);
        else ctx.fillRect(x - z / 4 - e / 2, y - z / 4, e, e * 1.6), ctx.fillRect(x + z / 4 - e / 2, y - z / 4, e, e * 1.6);
        if (CHEW[w]! > 0 && ((t * 16) & 1)) ctx.fillRect(x - z / 3, y + z / 6, (z * 2) / 3, e);
      }
      for (let i = 0; i < n[0]!; i++) {
        ctx.globalAlpha = Math.min(1, PL[i]! * 3);
        ctx.fillStyle = col[PC[i]!]!;
        const z = PC[i]! > 1 ? ps * 0.7 : ps;
        ctx.fillRect(PX[i]! - z / 2, PY[i]! - z / 2, z, z);
      }
      if (panic) {
        ctx.globalAlpha = 0.18 * (1 - G[9]! / 1.3) * (((t * 14) & 1) + 0.3);
        ctx.fillStyle = col[0]!;
        ctx.fillRect(-sh, 0, G[0]!, G[1]!);
      }
      ctx.globalAlpha = 1;
    },
  });
  engine.start();
  if (first) (q[0] = 1), (q[1] = first.x), (q[2] = first.y);
  wave();
  return {
    engine,
    /** For tests: the worms alive, the letters eaten, kills, the phase. */
    get state() {
      let live = 0;
      for (let w = 0; w < WORMS; w++) live += ST[w]!;
      return { live, eaten: G[13]!, kills: G[12]!, phase: G[8]!, letters: nL };
    },
    /** For tests: where worm `i` (the i-th alive) is, in CSS px from the stage's top left. */
    worm(i: number) {
      for (let w = 0; w < WORMS; w++) if (ST[w] === LIVE && i-- === 0) return { x: WX[w]!, y: WY[w]! };
      return null;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => terminalVirus(stage, slot, first);
