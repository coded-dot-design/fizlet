// Outbreak, act 1: ILOVEYOU (May 2000). Learn it by playing it: the love letter opens itself and
// mails a copy to every contact in the address book; each contact who opens it mails it to everyone
// in theirs. The address book is real page elements: a contact who opens the letter turns (one data
// attribute through the ledger) and its inbox count climbs. Tap a letter in flight to delete it: it
// shreds, and the blast shreds the letters right beside it and knocks the rest off course (they
// tumble, then home in again). When the last letter lands, the card says how far it got and why it
// worked: the attachment was LOVE-LETTER-FOR-YOU.TXT.vbs, a script, and Windows hid the ".vbs".
// Tap to play it again. Bricks: the kernel (settle, ledger), @fzlt/core/steer's exact hypot, @fzlt/core/slot.
import type { SlotScene, SlotTap } from "../../../src/slot";
import { outbreak, hypot, ease, W, H, S, T, SHAKE, INK, MUTED, BUG, BUG2, GLOW, GOLD, BG } from "./outbreak";

const LET = 72, K = 12, STAGGER = 0.11, OPEN_AFTER = 0.9;
/** Story: the letter opening in the inbox, the spread, the end card. */
const OPENING = 0, SPREAD = 1, DONE = 2;

export function iloveyou(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const ob = outbreak(stage, slot), { engine, L, R, G, col } = ob;
  const tiles = [...slot.querySelectorAll<HTMLElement>("[data-ly-c]")].slice(0, K);
  const counts = tiles.map((t) => { const b = t.querySelector("b")!; return (b.firstChild as Text | null) ?? L.add(b.appendChild(document.createTextNode(""))); });
  const attach = slot.querySelector<HTMLElement>("[data-ly-att]")!, statEl = slot.querySelector<HTMLElement>("[data-ly-stat]")!;
  const stat = (statEl.firstChild as Text | null) ?? L.add(statEl.appendChild(document.createTextNode("")));
  const nC = tiles.length;
  // Contacts: centre, half size, opened, letters received, next send time, next contact to mail, pulse.
  const CX = new Float32Array(K), CY = new Float32Array(K), CW = new Float32Array(K), CH = new Float32Array(K);
  const OPEN = new Uint8Array(K), RECV = new Uint16Array(K), NEXT = new Float32Array(K + 1), TO = new Int8Array(K + 1), PULSE = new Float32Array(K), DIRTY = new Uint8Array(K);
  // Letters: position, velocity, target contact, tumble time, spin, age, alive.
  const X = new Float32Array(LET), Y = new Float32Array(LET), VX = new Float32Array(LET), VY = new Float32Array(LET);
  const TG = new Int8Array(LET), TUM = new Float32Array(LET), SPIN = new Float32Array(LET), AGE = new Float32Array(LET), ON = new Uint8Array(LET);
  // [0] phase, [1] phase time, [2] sent, [3] opened, [4] deleted, [5] stat dirty, [6] attachment x, [7] y, [8] round.
  const P = new Float64Array(10);
  const SRC = K; // sender slot K is the inbox attachment

  function reset() {
    for (let c = 0; c < nC; c++) {
      if (OPEN[c] || RECV[c]) (DIRTY[c] = 1);
      (OPEN[c] = 0), (RECV[c] = 0), (NEXT[c] = -1), (TO[c] = -1), (PULSE[c] = 0);
    }
    ON.fill(0);
    (P[0] = OPENING), (P[1] = 0), (P[2] = 0), (P[3] = 0), (P[4] = 0), (P[5] = 1);
    (NEXT[SRC] = -1), (TO[SRC] = -1);
    ob.state("opening");
    engine.busy(OPEN_AFTER); // the intro beat: the letter opens, then it mails itself
  }
  /** Start contact (or the inbox) `from` mailing every other contact, one letter every STAGGER s. */
  function mailAll(from: number) {
    (TO[from] = 0), (NEXT[from] = 0);
  }
  function launch(from: number, to: number) {
    let i = 0;
    while (i < LET && ON[i]) i++;
    if (i >= LET) return false;
    const s = G[S]!, x = from === SRC ? P[6]! : CX[from]!, y = from === SRC ? P[7]! : CY[from]!;
    const dx = CX[to]! - x, a = R() - 0.5;
    (ON[i] = 1), (X[i] = x), (Y[i] = y), (TG[i] = to), (TUM[i] = 0), (SPIN[i] = 0), (AGE[i] = 0);
    (VX[i] = (Math.sign(dx) * 60 + a * 160) * s), (VY[i] = (-150 - R() * 90) * s);
    P[2] = P[2]! + 1;
    P[5] = 1;
    return true;
  }
  function shred(i: number) {
    ON[i] = 0;
    P[4] = P[4]! + 1;
    P[5] = 1;
    ob.burst(X[i]!, Y[i]!, 12, 200, INK, BUG);
  }

  ob.run({
    measure(r) {
      for (let c = 0; c < nC; c++) {
        const b = tiles[c]!.getBoundingClientRect();
        (CX[c] = b.left - r.left + b.width / 2), (CY[c] = b.top - r.top + b.height / 2), (CW[c] = b.width / 2), (CH[c] = b.height / 2);
      }
      const a = attach.getBoundingClientRect();
      (P[6] = a.left - r.left + a.width / 2), (P[7] = a.top - r.top + a.height / 2);
    },
    step(dt, tap, tx, ty) {
      const s = G[S]!;
      P[1] = P[1]! + dt;
      let busy = P[0] !== DONE;
      if (tap) {
        if (P[0] === DONE) reset();
        else {
          // Delete the letter under the finger (generous on touch); its blast shreds the letters
          // right beside it and knocks the others tumbling.
          let hit = -1, hd = Math.max(22, 30 * s);
          for (let i = 0; i < LET; i++) {
            if (!ON[i]) continue;
            const d = hypot(X[i]! - tx, Y[i]! - ty);
            if (d < hd) (hd = d), (hit = i);
          }
          if (hit < 0) ob.ring(tx, ty, 18, MUTED);
          else {
            const x = X[hit]!, y = Y[hit]!;
            shred(hit);
            ob.ring(x, y, 60, BUG);
            G[SHAKE] = 0.12;
            for (let i = 0; i < LET; i++) {
              if (!ON[i]) continue;
              const dx = X[i]! - x, dy = Y[i]! - y, d = hypot(dx, dy), reach = 80 * s;
              if (d >= reach || d === 0) continue;
              if (d < reach * 0.42) shred(i);
              else {
                const k = ((1 - d / reach) * 520 * s) / d;
                (VX[i] = VX[i]! + dx * k), (VY[i] = VY[i]! + dy * k), (TUM[i] = 0.55), (SPIN[i] = (R() - 0.5) * 30);
              }
            }
          }
        }
      }
      // The intro: the attachment opens (its ".vbs" shows), then the inbox mails the whole book.
      if (P[0] === OPENING && P[1]! >= OPEN_AFTER) {
        (P[0] = SPREAD), (P[1] = 0);
        ob.state("spread");
        ob.burst(P[6]!, P[7]!, 10, 140, BUG, GOLD);
        ob.ring(P[6]!, P[7]!, 40, BUG);
        mailAll(SRC);
      }
      // Senders: every opened contact mails every other contact, one letter at a time.
      let sending = 0;
      for (let f = 0; f <= nC; f++) {
        const from = f === nC ? SRC : f;
        if (TO[from]! < 0) continue;
        sending++;
        NEXT[from] = NEXT[from]! - dt;
        if (NEXT[from]! > 0) continue;
        let to = TO[from]!;
        if (to === from) to++;
        if (to >= nC) {
          TO[from] = -1;
          continue;
        }
        if (launch(from, to)) (TO[from] = to + 1), (NEXT[from] = STAGGER);
      }
      // Letters: an arc that homes in on its contact; a tumbling one spins until it steadies.
      let flying = 0;
      for (let i = 0; i < LET; i++) {
        if (!ON[i]) continue;
        flying++;
        AGE[i] = AGE[i]! + dt;
        const c = TG[i]!, dx = CX[c]! - X[i]!, dy = CY[c]! - Y[i]!, d = hypot(dx, dy);
        if (TUM[i]! > 0) {
          TUM[i] = TUM[i]! - dt;
          const k = Math.pow(0.15, dt);
          (VX[i] = VX[i]! * k), (VY[i] = VY[i]! * k + 200 * s * dt);
        } else {
          const sp = (170 + Math.min(AGE[i]!, 2) * 120) * s, k = Math.min(1, dt * (2 + AGE[i]! * 3));
          (VX[i] = VX[i]! + ((dx / d) * sp - VX[i]!) * k), (VY[i] = VY[i]! + ((dy / d) * sp - VY[i]!) * k);
        }
        (X[i] = X[i]! + VX[i]! * dt), (Y[i] = Y[i]! + VY[i]! * dt);
        if (X[i]! < 4 || X[i]! > G[W]! - 4) VX[i] = -VX[i]! * 0.6, (X[i] = Math.min(G[W]! - 4, Math.max(4, X[i]!)));
        if (Y[i]! < 4 || Y[i]! > G[H]! - 4) VY[i] = -VY[i]! * 0.6, (Y[i] = Math.min(G[H]! - 4, Math.max(4, Y[i]!)));
        // It lands: the contact opens it (it came from someone they knew) and mails it on.
        if (TUM[i]! <= 0 && Math.abs(dx) < CW[c]! * 0.8 && Math.abs(dy) < CH[c]! * 0.8) {
          ON[i] = 0;
          RECV[c] = RECV[c]! + 1;
          (PULSE[c] = 1), (DIRTY[c] = 1);
          if (!OPEN[c]) {
            OPEN[c] = 1;
            P[3] = P[3]! + 1;
            ob.burst(CX[c]!, CY[c]! - CH[c]!, 9, 160, BUG, BUG2);
            ob.ring(CX[c]!, CY[c]!, 34, BUG);
            (TO[c] = 0), (NEXT[c] = 0.5 + R() * 0.4);
          }
          P[5] = 1;
        }
      }
      for (let c = 0; c < nC; c++) if (PULSE[c]! > 0) (PULSE[c] = Math.max(0, PULSE[c]! - dt * 3)), (busy = true);
      if (P[0] === SPREAD && !flying && !sending && P[1]! > 0.3) {
        P[0] = DONE;
        const k = P[3]!;
        ob.end(k >= nC ? `All ${nC} opened it. LOVE-LETTER-FOR-YOU.TXT.vbs was a script: Windows hid the .vbs. Tap to send it again.` : k === 0 ? `Nobody opened it: you deleted every letter. The real one reached tens of millions of computers. Tap again.` : `${k} of ${nC} opened it. The .vbs was hidden, so the script looked like a letter. Tap to send it again.`);
      }
      return busy || flying > 0 || sending > 0;
    },
    write() {
      for (let c = 0; c < nC; c++) {
        if (!DIRTY[c]) continue;
        DIRTY[c] = 0;
        L.attr(tiles[c]!, "data-ly", OPEN[c] ? "open" : null);
        L.text(counts[c]!, RECV[c] ? `♥${RECV[c]}` : "");
      }
      if (P[5]) (P[5] = 0), L.text(stat, `sent ${P[2]} · opened ${P[3]}/${nC} · deleted ${P[4]}`);
    },
    draw(ctx) {
      const s = G[S]!, t = G[T]!;
      // The contacts it reached: a heart beats over each, bigger as it lands.
      for (let c = 0; c < nC; c++) {
        if (!OPEN[c]) continue;
        const p = PULSE[c]!, z = (5 + p * 5 + Math.sin(t * 7 + c) * 0.8) * s;
        heart(ctx, CX[c]! + CW[c]! - 7 * s, CY[c]! - CH[c]! + 6 * s, z, col[BUG]!);
      }
      // The letters: an envelope with a heart seal, tilted with its flight.
      for (let i = 0; i < LET; i++) {
        if (!ON[i]) continue;
        const w = 15 * s, h = 10 * s, a = TUM[i]! > 0 ? SPIN[i]! * (0.55 - TUM[i]!) : Math.atan2(VY[i]!, VX[i]!) * 0.25;
        ctx.save();
        ctx.translate(X[i]!, Y[i]!);
        ctx.rotate(a);
        ctx.fillStyle = col[BUG]!;
        ctx.fillRect(-w / 2 + 1.5 * s, -h / 2 + 1.5 * s, w, h); // hard shadow
        ctx.fillStyle = col[INK]!;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = col[BG]!;
        ctx.lineWidth = Math.max(1, s);
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(0, h * 0.1);
        ctx.lineTo(w / 2, -h / 2);
        ctx.stroke();
        heart(ctx, 0, h * 0.12, 3.4 * s, col[BUG]!);
        ctx.restore();
      }
      // While it opens: the attachment glows.
      if (P[0] === OPENING) {
        ctx.globalAlpha = 0.5 * ease(P[1]! / OPEN_AFTER);
        ctx.strokeStyle = col[GLOW]!;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(P[6]!, P[7]!, (14 + P[1]! * 20) * s, 0, 6.2832);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  });
  reset();
  if (first) ob.tap(first.x, first.y);
  return {
    engine,
    /** For tests: phase, letters sent, contacts opened, letters deleted, letters in flight. */
    get state() {
      let flying = 0;
      for (let i = 0; i < LET; i++) flying += ON[i]!;
      return { phase: P[0]!, sent: P[2]!, opened: P[3]!, deleted: P[4]!, flying, contacts: nC };
    },
    /** For tests: where letter `k` (the k-th in flight) is, in CSS px from the stage's top left. */
    thing(k: number) {
      for (let i = 0; i < LET; i++) if (ON[i] && TUM[i]! <= 0 && k-- === 0) return { x: X[i]!, y: Y[i]! };
      return null;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

/** A pixel heart of width `z` centred on (x, y). */
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, c: string) {
  const u = z / 4;
  ctx.fillStyle = c;
  ctx.fillRect(x - 2 * u, y - u, u * 1.6, u);
  ctx.fillRect(x + 0.4 * u, y - u, u * 1.6, u);
  ctx.fillRect(x - 2 * u, y, 4 * u, u);
  ctx.fillRect(x - 1.2 * u, y + u, 2.4 * u, u * 0.8);
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => iloveyou(stage, slot, first);
