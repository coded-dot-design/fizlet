// Outbreak, act 1: WannaCry (May 2017). Learn it by playing it: the worm hops machine to machine
// over SMB (an exploit leaked that spring) and locks every file it lands on: the name gets
// ".WNCRY" and the ransom note asks $300. Before each new lock it looks up one long nonsense domain,
// and while that name has no answer it carries on. The files and the lookup log are real page
// elements (written through the ledger). Find that domain in the log and tap it to register it: every
// copy that looks it up now gets an answer and quits. That was the kill switch (a researcher
// registered it for $10.69); it stopped new infections and decrypted nothing. Tap a clean file to
// unplug it: hops bounce off it. Tap to play again.
// Bricks: the kernel (settle, ledger), fizlet/steer's exact hypot, fizlet/slot. Step allocates nothing.
import type { SlotScene, SlotTap } from "../../../src/slot";
import { outbreak, hypot, ease, S, T, SHAKE, MUTED, LINE, BUG, BUG2, HEAL, GLOW, GOLD } from "./outbreak";

const F = 15, HOPS = 24, LOG = 4, ENC = 1.1, INTRO = 0.8, QUIET_DNS = 1.1;
const KILL = "iuqerfsodp9ifjaposdfjhgosurijfaewrwergwea.com";
const OTHER = ["time.example.net", "cdn.example.com", "mail.example.org", "update.example.com", "fonts.example.net"];
/** File states. */
const CLEAN = 0, LOCKING = 1, LOCKED = 2, CUT = 3;
const INTROING = 0, PLAY = 1, DONE = 2;
/** Grid neighbours (5 files a row) and how long running copies keep hopping once the switch is on. */
const DIRS = new Int8Array([1, -1, 5, -5]), AFTER = 2.5;

export function wannacry(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const ob = outbreak(stage, slot), { engine, L, R, G, col } = ob;
  const tiles = [...slot.querySelectorAll<HTMLElement>("[data-wc-f]")].slice(0, F);
  const lines = [...slot.querySelectorAll<HTMLElement>("[data-wc-q]")].slice(0, LOG);
  const lineT = lines.map((el) => (el.firstChild as Text | null) ?? L.add(el.appendChild(document.createTextNode(""))));
  const statEl = slot.querySelector<HTMLElement>("[data-wc-stat]")!;
  const stat = (statEl.firstChild as Text | null) ?? L.add(statEl.appendChild(document.createTextNode("")));
  const nF = tiles.length;
  // Files: box, state, lock progress, next hop, flash, dirty.
  const FX = new Float32Array(F), FY = new Float32Array(F), FW = new Float32Array(F), FH = new Float32Array(F);
  const ST = new Uint8Array(F), PROG = new Float32Array(F), NEXT = new Float32Array(F), FL = new Float32Array(F), FD = new Uint8Array(F);
  // Hops (an exploit in flight): from, to, time 0..1, bounced.
  const HF = new Int8Array(HOPS), HT = new Int8Array(HOPS), HU = new Float32Array(HOPS), HB = new Uint8Array(HOPS), HON = new Uint8Array(HOPS);
  // The log: kind per line (-1 empty, 0 the kill domain unanswered, 1 answered, 2+ other), line boxes, query beams.
  const LK = new Int8Array(LOG).fill(-1), LY0 = new Float32Array(LOG), LY1 = new Float32Array(LOG), LX0 = new Float32Array(LOG), LX1 = new Float32Array(LOG), LFL = new Float32Array(LOG);
  const BEAM = new Float32Array(F); // a lookup beam from a file to the log, fading
  // [0] phase, [1] phase time, [2] registered, [3] locked, [4] cut, [5] stat dirty, [6] log dirty, [7] next other lookup,
  // [8] stopped by the switch, [9] other cursor, [10] time since registered.
  const P = new Float64Array(12);
  const logText: string[] = ["", "", "", ""];

  function reset() {
    for (let f = 0; f < nF; f++) {
      if (ST[f]) FD[f] = 1;
      (ST[f] = CLEAN), (PROG[f] = 0), (NEXT[f] = 0), (FL[f] = 0), (BEAM[f] = 0);
    }
    HON.fill(0);
    LK.fill(-1);
    for (let i = 0; i < LOG; i++) logText[i] = "";
    (P[0] = INTROING), (P[1] = 0), (P[2] = 0), (P[3] = 0), (P[4] = 0), (P[5] = 1), (P[6] = 1), (P[7] = 0.4), (P[8] = 0), (P[10] = 0);
    ob.state(null);
    engine.busy(INTRO);
  }
  /** A new lookup at the bottom of the log; the oldest scrolls off. */
  function log(kind: number) {
    for (let i = 0; i < LOG - 1; i++) (LK[i] = LK[i + 1]!), (LFL[i] = LFL[i + 1]!);
    LK[LOG - 1] = kind;
    LFL[LOG - 1] = 1;
    P[6] = 1;
  }
  /** The worm lands on file `f`: it looks the domain up first, and quits if the name answers. */
  function land(f: number) {
    BEAM[f] = 1;
    if (P[2]) {
      log(1);
      FL[f] = 1;
      P[8] = P[8]! + 1;
      ob.ring(FX[f]!, FY[f]!, 30, HEAL);
    } else {
      log(0);
      (ST[f] = LOCKING), (PROG[f] = 0), (FD[f] = 1);
    }
    P[5] = 1;
  }
  function anyFlash() {
    for (let f = 0; f < nF; f++) if (FL[f]! > 0 || BEAM[f]! > 0) return true;
    for (let i = 0; i < LOG; i++) if (LFL[i]! > 0) return true;
    return false;
  }
  function hop(from: number) {
    // SMB scanning: mostly a neighbour on the grid, sometimes anywhere.
    let to = -1;
    for (let k = 0; k < 6 && to < 0; k++) {
      const c = R() < 0.7 ? from + DIRS[(R() * 4) | 0]! : (R() * nF) | 0;
      if (c >= 0 && c < nF && c !== from && (ST[c] === CLEAN || ST[c] === CUT)) to = c;
    }
    if (to < 0) return;
    let i = 0;
    while (i < HOPS && HON[i]) i++;
    if (i >= HOPS) return;
    (HON[i] = 1), (HF[i] = from), (HT[i] = to), (HU[i] = 0), (HB[i] = 0);
  }

  ob.run({
    measure(r) {
      for (let f = 0; f < nF; f++) {
        const b = tiles[f]!.getBoundingClientRect();
        (FX[f] = b.left - r.left + b.width / 2), (FY[f] = b.top - r.top + b.height / 2), (FW[f] = b.width / 2), (FH[f] = b.height / 2);
      }
      for (let i = 0; i < LOG; i++) {
        const b = lines[i]!.getBoundingClientRect();
        (LX0[i] = b.left - r.left), (LX1[i] = b.right - r.left), (LY0[i] = b.top - r.top), (LY1[i] = b.bottom - r.top);
      }
    },
    step(dt, tap, tx, ty) {
      const s = G[S]!;
      P[1] = P[1]! + dt;
      if (tap) {
        if (P[0] === DONE) reset();
        else {
          let line = -1, file = -1;
          for (let i = 0; i < LOG; i++) if (tx >= LX0[i]! - 4 && tx <= LX1[i]! + 4 && ty >= LY0[i]! - 3 && ty <= LY1[i]! + 3) line = i;
          for (let f = 0; f < nF; f++) if (Math.abs(tx - FX[f]!) <= FW[f]! + 2 && Math.abs(ty - FY[f]!) <= FH[f]! + 2) file = f;
          if (line >= 0 && LK[line] === 0 && !P[2]) {
            // Register the kill switch: from now on the lookup answers, and every new copy quits.
            P[2] = 1;
            for (let i = 0; i < LOG; i++) if (LK[i] === 0) (LK[i] = 1), (LFL[i] = 1);
            (P[5] = 1), (P[6] = 1), (G[SHAKE] = 0.15);
            const x = (LX0[line]! + LX1[line]!) / 2, y = (LY0[line]! + LY1[line]!) / 2;
            ob.ring(x, y, 70, HEAL);
            ob.burst(x, y, 16, 220, HEAL, GLOW);
          } else if (line >= 0 && LK[line]! >= 0) {
            LFL[line] = 0.6;
            ob.ring(tx, ty, 18, MUTED);
          } else if (file >= 0 && ST[file] === CLEAN) {
            // Unplug it: no hop gets in.
            (ST[file] = CUT), (FD[file] = 1), (FL[file] = 1);
            P[4] = P[4]! + 1;
            P[5] = 1;
            ob.ring(FX[file]!, FY[file]!, 30, GLOW);
          } else ob.ring(tx, ty, 16, MUTED);
        }
      }
      if (P[0] === INTROING && P[1]! >= INTRO) {
        (P[0] = PLAY), (P[1] = 0);
        land(0); // patient zero
      }
      let busy = P[0] !== DONE, locking = 0, flying = 0;
      if (P[0] === PLAY) {
        // Everyday lookups keep the log moving, so the odd one out has to be spotted.
        P[7] = P[7]! - dt;
        if (P[7]! <= 0) (P[7] = QUIET_DNS * (0.6 + R() * 0.8)), log(2 + (P[9] = (P[9]! + 1) % OTHER.length));
      }
      for (let f = 0; f < nF; f++) {
        if (FL[f]! > 0) FL[f] = Math.max(0, FL[f]! - dt * 2);
        if (BEAM[f]! > 0) BEAM[f] = Math.max(0, BEAM[f]! - dt * 2.5);
        if (ST[f] === LOCKING) {
          locking++;
          PROG[f] = PROG[f]! + dt / ENC;
          if (PROG[f]! >= 1) {
            (ST[f] = LOCKED), (FD[f] = 1), (FL[f] = 1), (NEXT[f] = 0.15 + R() * 0.3);
            P[3] = P[3]! + 1;
            P[5] = 1;
            ob.burst(FX[f]!, FY[f]!, 10, 160, BUG, GOLD);
          }
        } else if (ST[f] === LOCKED && P[0] === PLAY && P[10]! < AFTER) {
          // Copies already running keep scanning (they passed the check); new ones look it up and quit.
          NEXT[f] = NEXT[f]! - dt;
          if (NEXT[f]! <= 0) (NEXT[f] = 0.6 + R() * 0.5), hop(f);
        }
      }
      for (let i = 0; i < HOPS; i++) {
        if (!HON[i]) continue;
        flying++;
        HU[i] = HU[i]! + dt * (HB[i] ? -2.4 : 1.8);
        const to = HT[i]!;
        if (!HB[i] && HU[i]! >= 0.82 && ST[to] === CUT) {
          // An unplugged file: the exploit hits the cable that isn't there and falls back.
          HB[i] = 1;
          FL[to] = 1;
          ob.burst(FX[to]!, FY[to]!, 6, 120, GLOW, MUTED);
        } else if (!HB[i] && HU[i]! >= 1) {
          HON[i] = 0;
          if (ST[to] === CLEAN) land(to);
        } else if (HB[i] && HU[i]! <= 0) HON[i] = 0;
      }
      for (let i = 0; i < LOG; i++) if (LFL[i]! > 0) LFL[i] = Math.max(0, LFL[i]! - dt * 1.5);
      if (P[2]) P[10] = P[10]! + dt;
      if (P[0] === PLAY && !locking && !flying) {
        let clean = 0;
        for (let f = 0; f < nF; f++) if (ST[f] === CLEAN) clean++;
        if ((P[2] && P[10]! >= AFTER) || clean === 0) {
          (P[0] = DONE), (P[5] = 1);
          const k = P[3]!;
          ob.end(P[2] ? `Kill switch on: ${P[8]} copies looked it up and quit. ${k} files stay locked (it decrypted nothing). Tap to play again.` : `${k} of ${nF} files locked, $300 each. The long domain in the log was the kill switch. Tap to play again.`);
        }
      }
      return busy || locking > 0 || flying > 0 || G[SHAKE]! > 0 || anyFlash();
    },
    write() {
      for (let f = 0; f < nF; f++) {
        if (!FD[f]) continue;
        FD[f] = 0;
        L.attr(tiles[f]!, "data-wc", ST[f] === LOCKED ? "locked" : ST[f] === LOCKING ? "locking" : ST[f] === CUT ? "cut" : null);
      }
      if (P[6]) {
        P[6] = 0;
        for (let i = 0; i < LOG; i++) {
          const k = LK[i]!, t = k < 0 ? "" : k === 0 ? `? ${KILL}  no answer → lock` : k === 1 ? `✓ ${KILL}  answered → quit` : `✓ ${OTHER[k - 2]}`;
          if (t !== logText[i]) (logText[i] = t), L.text(lineT[i]!, t);
          L.attr(lines[i]!, "data-wc", k === 0 ? "kill" : k === 1 ? "on" : null);
        }
      }
      if (P[5]) (P[5] = 0), L.text(stat, `locked ${P[3]}/${nF} · unplugged ${P[4]} · domain ${P[2] ? "registered" : "unregistered"}`);
    },
    draw(ctx) {
      const s = G[S]!, t = G[T]!;
      // Lookup beams: a file asking the log about the domain.
      for (let f = 0; f < nF; f++) {
        if (BEAM[f]! <= 0) continue;
        ctx.globalAlpha = BEAM[f]! * 0.8;
        ctx.strokeStyle = col[P[2] ? HEAL : GOLD]!;
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.setLineDash([3 * s, 3 * s]);
        ctx.beginPath();
        ctx.moveTo(FX[f]!, FY[f]!);
        ctx.lineTo(LX0[LOG - 1]!, (LY0[LOG - 1]! + LY1[LOG - 1]!) / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Files: a lock ring fills while it encrypts; flashes on lock, unplug, kill switch.
      for (let f = 0; f < nF; f++) {
        const x = FX[f]!, y = FY[f]!;
        if (ST[f] === LOCKING) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = col[BUG]!;
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.arc(x, y, Math.min(FW[f]!, FH[f]!) * 0.7, -1.5708, -1.5708 + 6.2832 * PROG[f]!);
          ctx.stroke();
        }
        if (FL[f]! > 0) {
          ctx.globalAlpha = FL[f]! * 0.5;
          ctx.fillStyle = col[ST[f] === CUT ? GLOW : ST[f] === LOCKED ? BUG2 : HEAL]!;
          ctx.fillRect(x - FW[f]!, y - FH[f]!, FW[f]! * 2, FH[f]! * 2);
        }
      }
      // Hops: an exploit arcing file to file, a red worm head with a short trail.
      ctx.globalAlpha = 1;
      for (let i = 0; i < HOPS; i++) {
        if (!HON[i]) continue;
        const a = HF[i]!, b = HT[i]!, z = 4.5 * s;
        for (let k = 3; k >= 0; k--) {
          const u = ease(Math.max(0, HU[i]! - k * 0.05 * (HB[i] ? -1 : 1))), d = hypot(FX[b]! - FX[a]!, FY[b]! - FY[a]!);
          const x = FX[a]! + (FX[b]! - FX[a]!) * u, y = FY[a]! + (FY[b]! - FY[a]!) * u - Math.sin(u * 3.1416) * d * 0.35;
          ctx.fillStyle = col[k ? BUG2 : BUG]!;
          const zz = z * (1 - k * 0.2);
          ctx.fillRect(x - zz / 2, y - zz / 2, zz, zz);
        }
      }
      // The kill-switch line pulses while it waits to be found.
      if (!P[2] && P[0] === PLAY) {
        for (let i = 0; i < LOG; i++) {
          if (LK[i] !== 0) continue;
          ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 6);
          ctx.fillStyle = col[GOLD]!;
          ctx.fillRect(LX0[i]!, LY0[i]!, LX1[i]! - LX0[i]!, LY1[i]! - LY0[i]!);
        }
      }
      for (let i = 0; i < LOG; i++) {
        if (LFL[i]! <= 0) continue;
        ctx.globalAlpha = LFL[i]! * 0.35;
        ctx.fillStyle = col[LK[i] === 1 ? HEAL : LK[i] === 0 ? BUG : LINE]!;
        ctx.fillRect(LX0[i]!, LY0[i]!, LX1[i]! - LX0[i]!, LY1[i]! - LY0[i]!);
      }
      ctx.globalAlpha = 1;
    },
  });
  reset();
  if (first) ob.tap(first.x, first.y);
  return {
    engine,
    /** For tests: phase, files locked, unplugged, registered, copies stopped by the switch. */
    get state() {
      return { phase: P[0]!, locked: P[3]!, cut: P[4]!, registered: !!P[2], stopped: P[8]!, files: nF };
    },
    /** For tests: the centre of the log line holding the unanswered kill-switch lookup, else null. */
    thing() {
      for (let i = LOG - 1; i >= 0; i--) if (LK[i] === 0) return { x: (LX0[i]! + LX1[i]!) / 2, y: (LY0[i]! + LY1[i]!) / 2 };
      return null;
    },
    /** For tests: the centre of clean file `k` (the k-th clean one), else null. */
    clean(k: number) {
      for (let f = 0; f < nF; f++) if (ST[f] === CLEAN && k-- === 0) return { x: FX[f]!, y: FY[f]! };
      return null;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => wannacry(stage, slot, first);
