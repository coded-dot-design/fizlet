// Outbreak, act 2: the white hats beat Slammer (January 2003) the way it was really done. The first
// sign was a traffic spike on UDP 1434 within minutes; the fix was to filter 1434 at the network's
// edges and between segments, then patch (MS02-039, published six months before). A network map of
// real page elements: four segments of SQL hosts joined by six routers (two at the edge, to the
// internet; four inside). The flood pours in from the internet along the links; an infected host
// fires at its neighbours and down every link it has. Tap a router to filter 1434 on that link:
// packets bounce off it (segmentation). Tap a host to reboot and patch it (the worm lived only in
// memory): it takes a second, a hit while patching knocks it back, and a patched host is a shield
// packets die on. So the order is the lesson: cut the segment off, then patch it. Win when every
// segment is clean; or the clock (20x) reaches ten minutes. Tap to play again.
// Bricks: the kernel (settle, ledger), fizlet/steer's exact hypot, fizlet/slot. Step allocates nothing.
import type { SlotScene, SlotTap } from "../../../src/slot";
import { outbreak, hypot, S, T, INK, MUTED, LINE, BUG, BUG2, HEAL, GLOW, GOLD } from "./outbreak";

const PK = 160, HOSTS = 12, LINKS = 6, SEGS = 4, NET = 4, SPEED = 20, TEN_MIN = 600, INTRO = 0.7, PATCH = 1.1;
const OK = 0, HOT = 1, FIX = 2, SAFE = 3; // host states
const INTROING = 0, PLAY = 1, DONE = 2;
const TO_ROUTER = 0, TO_END = 1, TO_HOST = 2, BACK = 3; // a packet's leg
const LINE_DASH = [5, 4], NO_DASH: number[] = [];
const FACTS = " How identified: a traffic spike on UDP 1434 within minutes · Fix: filter 1434 at network edges, then patch (MS02-039, out six months earlier) · Lesson: a patch only works once it's installed. Tap to play again.";

export function edgeFilter(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const ob = outbreak(stage, slot), { engine, L, R, G, col } = ob;
  const segs = [...slot.querySelectorAll<HTMLElement>("[data-wh-seg]")].slice(0, SEGS);
  const routers = [...slot.querySelectorAll<HTMLElement>("[data-wh-r]")].slice(0, LINKS);
  const hosts = [...slot.querySelectorAll<HTMLElement>("[data-wh-h]")].slice(0, HOSTS);
  const net = slot.querySelector<HTMLElement>(".wh-net")!;
  const node = (sel: string) => { const el = slot.querySelector<HTMLElement>(sel)!; return (el.firstChild as Text | null) ?? L.add(el.appendChild(document.createTextNode(""))); };
  const clockT = node("[data-wh-clock]"), rateT = node("[data-wh-rate]"), fixedT = node("[data-wh-fixed]"), msgT = node("[data-wh-msg]");
  const nS = segs.length, nL = routers.length, nH = hosts.length;
  // Links: ends (a segment 0-3, or 4 the internet) from each router's data-wh-r ("ab"; the edge ones
  // start with the internet: "ia", "ic"). EG: the edge links.
  const LA = new Uint8Array(LINKS), LB = new Uint8Array(LINKS), LF = new Uint8Array(LINKS), LDIRTY = new Uint8Array(LINKS);
  for (let k = 0; k < nL; k++) {
    const id = routers[k]!.dataset.whR!;
    (LA[k] = "abcdi".indexOf(id[0]!)), (LB[k] = "abcdi".indexOf(id[1]!));
  }
  const EG = [0, 1, 2, 3, 4, 5].filter((k) => LA[k] === NET);
  // Geometry: router centre; each link end's point (on the segment's box nearest the router, or the internet's edge).
  const RX = new Float32Array(LINKS), RY = new Float32Array(LINKS), AX = new Float32Array(LINKS), AY = new Float32Array(LINKS), BX = new Float32Array(LINKS), BY = new Float32Array(LINKS);
  const SX0 = new Float32Array(SEGS), SY0 = new Float32Array(SEGS), SX1 = new Float32Array(SEGS), SY1 = new Float32Array(SEGS);
  // Hosts: centre, half size, segment, state, patch progress, flash, fire timer, dirty.
  const HX = new Float32Array(HOSTS), HY = new Float32Array(HOSTS), HW = new Float32Array(HOSTS), HHt = new Float32Array(HOSTS), HS = new Uint8Array(HOSTS), HST = new Uint8Array(HOSTS);
  const HP = new Float32Array(HOSTS), HF = new Float32Array(HOSTS), HFIRE = new Float32Array(HOSTS), HDIRTY = new Uint8Array(HOSTS);
  // Packets: a straight leg from (X0, Y0) to (X1, Y1), progress U at rate DU per second; leg kind, link,
  // the end it heads for (0 a, 1 b), target host, and the host it came from (-1 the internet).
  const X0 = new Float32Array(PK), Y0 = new Float32Array(PK), X1 = new Float32Array(PK), Y1 = new Float32Array(PK), U = new Float32Array(PK), DU = new Float32Array(PK);
  const LEG = new Uint8Array(PK), LK = new Uint8Array(PK), END = new Uint8Array(PK), TH = new Int8Array(PK), FROM = new Int8Array(PK), ON = new Uint8Array(PK);
  // [0] phase, [1] phase time, [2] clock (game s), [3] internet spawn debt, [4] net x1, [5] text dirty,
  // [7] bounced, [8] knocked back while patching, [9] packets on the wire, [10] knocked-back note until (s).
  const P = new Float64Array(12);
  let msg = "";

  function reset() {
    for (let k = 0; k < nL; k++) if (LF[k]) (LF[k] = 0), (LDIRTY[k] = 1);
    for (let h = 0; h < nH; h++) if (HST[h]) (HST[h] = OK), (HDIRTY[h] = 1);
    ON.fill(0);
    (P[0] = INTROING), (P[1] = 0), (P[2] = 0), (P[3] = 0), (P[5] = 1), (P[7] = 0), (P[8] = 0), (P[9] = -1), (P[10] = 0);
    msg = "";
    ob.state(null);
    engine.busy(INTRO);
  }
  /** A packet's next leg, from (x, y) to (tx, ty) at speed v. */
  function leg(i: number, x: number, y: number, tx: number, ty: number, v: number, kind: number) {
    (X0[i] = x), (Y0[i] = y), (X1[i] = tx), (Y1[i] = ty), (U[i] = 0), (LEG[i] = kind);
    DU[i] = v / (hypot(tx - x, ty - y) || 1);
  }
  /** A packet from (x, y) down link k toward end e (0 a, 1 b), first to the router; or, with h >= 0,
   * straight at host h (same segment: no router between them). */
  function send(x: number, y: number, k: number, e: number, from: number, h = -1) {
    let i = 0;
    while (i < PK && ON[i]) i++;
    if (i >= PK) return;
    (ON[i] = 1), (LK[i] = k), (END[i] = e), (FROM[i] = from), (TH[i] = h);
    leg(i, x, y, h < 0 ? RX[k]! : HX[h]!, h < 0 ? RY[k]! : HY[h]!, 280 * G[S]!, h < 0 ? TO_ROUTER : TO_HOST);
  }
  function set(h: number, st: number) {
    if (HST[h] !== st) (HST[h] = st), (HDIRTY[h] = 1), (P[5] = 1);
  }
  /** A worm packet arrives at host h. */
  function hit(i: number, h: number) {
    ON[i] = 0;
    const st = HST[h]!;
    if (st === SAFE) HF[h] = 1;
    else if (st === OK || st === FIX) {
      if (st === FIX) (P[8] = P[8]! + 1), (P[10] = G[T]! + 1.6);
      set(h, HOT);
      (HF[h] = 1), (HFIRE[h] = 0.25 + R() * 0.3);
      ob.burst(HX[h]!, HY[h]!, 7, 140, BUG, GOLD);
    }
  }
  /** Segments the internet reaches through unfiltered links (bit s set). */
  function reach() {
    let m = 0;
    for (let r = 0; r < SEGS; r++)
      for (let k = 0; k < nL; k++) {
        if (LF[k]) continue;
        if (LA[k] === NET) m |= 1 << LB[k]!;
        if (m & (1 << LA[k]!)) m |= 1 << LB[k]!;
        if (m & (1 << LB[k]!)) m |= 1 << LA[k]!;
      }
    return m;
  }

  ob.run({
    measure(r) {
      const nb = net.getBoundingClientRect();
      P[4] = nb.right - r.left;
      for (let s = 0; s < nS; s++) {
        const b = segs[s]!.getBoundingClientRect();
        (SX0[s] = b.left - r.left), (SY0[s] = b.top - r.top), (SX1[s] = b.right - r.left), (SY1[s] = b.bottom - r.top);
      }
      for (let h = 0; h < nH; h++) {
        const b = hosts[h]!.getBoundingClientRect();
        (HW[h] = b.width / 2), (HHt[h] = b.height / 2), (HX[h] = b.left - r.left + HW[h]!), (HY[h] = b.top - r.top + HHt[h]!);
        HS[h] = segs.findIndex((s) => s.contains(hosts[h]!));
      }
      for (let k = 0; k < nL; k++) {
        const b = routers[k]!.getBoundingClientRect();
        (RX[k] = b.left - r.left + b.width / 2), (RY[k] = b.top - r.top + b.height / 2);
        for (let e = 0; e < 2; e++) {
          const n = e ? LB[k]! : LA[k]!;
          const x = n === NET ? P[4]! : Math.min(SX1[n]!, Math.max(SX0[n]!, RX[k]!)), y = n === NET ? RY[k]! : Math.min(SY1[n]!, Math.max(SY0[n]!, RY[k]!));
          if (e) (BX[k] = x), (BY[k] = y);
          else (AX[k] = x), (AY[k] = y);
        }
      }
    },
    step(dt, tap, tx, ty) {
      const s = G[S]!;
      P[1] = P[1]! + dt;
      if (tap) {
        if (P[0] === DONE) reset();
        else {
          // The router (its centre ± 24 × 18 px at scale 1) or the host under the tap.
          let k = nL, h = nH;
          while (k-- > 0 && !(Math.abs(tx - RX[k]!) <= 24 * s && Math.abs(ty - RY[k]!) <= 18 * s));
          while (k < 0 && h-- > 0 && !(Math.abs(tx - HX[h]!) <= HW[h]! + 4 * s && Math.abs(ty - HY[h]!) <= HHt[h]! + 4 * s));
          if (k >= 0 && !LF[k]) {
            // Filter 1434 on this link: it bounces the flood from now on, both ways.
            (LF[k] = 1), (LDIRTY[k] = 1), (P[5] = 1);
            ob.ring(RX[k]!, RY[k]!, 30, HEAL);
            ob.burst(RX[k]!, RY[k]!, 10, 180, HEAL, GLOW);
          } else if (h >= 0 && (HST[h] === HOT || HST[h] === OK)) {
            // Reboot (the worm lived only in memory) and patch: a second, and a hit knocks it back.
            set(h, FIX);
            (HP[h] = 0), (HF[h] = 1);
            ob.ring(HX[h]!, HY[h]!, 24, GOLD);
          } else ob.ring(tx, ty, 16, MUTED);
        }
      }
      if (P[0] === INTROING && P[1]! >= INTRO) (P[0] = PLAY), (P[1] = 0), (P[5] = 1);
      const play = P[0] === PLAY;
      let flying = 0, hot = 0;
      if (play) {
        const was = Math.floor(P[2]!);
        P[2] = P[2]! + dt * SPEED;
        if (Math.floor(P[2]!) !== was) P[5] = 1;
        // The flood from the internet: down the edge links, faster as the world fills up.
        P[3] = P[3]! + Math.min(18, 5 + P[2]! / 25) * dt;
        while (P[3]! >= 1) {
          P[3] = P[3]! - 1;
          const k = EG[(R() * EG.length) | 0]!;
          send(P[4]! - 2 * s, RY[k]! + (R() - 0.5) * 30 * s, k, 1, -1);
        }
      }
      for (let h = 0; h < nH; h++) {
        if (HF[h]! > 0) HF[h] = Math.max(0, HF[h]! - dt * 3);
        const st = HST[h]!;
        if (st === FIX && (HP[h] = HP[h]! + dt / PATCH) >= 1) {
          set(h, SAFE);
          HF[h] = 1;
          ob.ring(HX[h]!, HY[h]!, 30, HEAL);
          ob.burst(HX[h]!, HY[h]!, 8, 150, HEAL, GLOW);
        }
        if (st !== HOT) continue;
        hot++;
        // An infected host fires: at a neighbour in its segment, or down one of its segment's links.
        if (play && (HFIRE[h] = HFIRE[h]! - dt) <= 0) {
          HFIRE[h] = 0.3 + R() * 0.3;
          if (R() < 0.4) {
            send(HX[h]!, HY[h]!, 0, 0, h, HS[h]! * 3 + (((h % 3) + 1 + ((R() * 2) | 0)) % 3));
          } else {
            let k = (R() * nL) | 0;
            for (let j = 0; j < nL && LA[k] !== HS[h] && LB[k] !== HS[h]; j++) k = (k + 1) % nL;
            send(HX[h]!, HY[h]!, k, LA[k] === HS[h] ? 1 : 0, h);
          }
        }
      }
      for (let i = 0; i < PK; i++) {
        if (!ON[i]) continue;
        flying++;
        U[i] = U[i]! + DU[i]! * dt;
        const k = LK[i]!, lg = LEG[i]!;
        if (U[i]! < 1) continue;
        const x = X1[i]!, y = Y1[i]!;
        if (lg === TO_ROUTER) {
          if (LF[k]) {
            // Filtered: it bounces back the way it came, and dies there.
            P[7] = P[7]! + 1;
            ob.part(x, y, (X0[i]! - x) * 0.8, -60 * s, 0.25, 2, HEAL);
            leg(i, x, y, X0[i]!, Y0[i]! + (R() - 0.5) * 40 * s, 240 * s, BACK);
          } else leg(i, x, y, END[i] ? BX[k]! : AX[k]!, END[i] ? BY[k]! : AY[k]!, 300 * s, TO_END);
        } else if (lg === TO_END) {
          const n = END[i] ? LB[k]! : LA[k]!;
          const h = n * 3 + ((R() * 3) | 0);
          if (n === NET) ON[i] = 0; // out to the internet
          else (TH[i] = h), leg(i, x, y, HX[h]!, HY[h]!, 300 * s, TO_HOST);
        } else if (lg === TO_HOST) hit(i, TH[i]!);
        else ON[i] = 0;
      }
      // The end: every segment clean (no host infected or mid-patch, every host patched or cut off from
      // the internet, nothing on its way in); or ten minutes on the clock.
      if (play) {
        // `hot` was counted before the packets moved; a host they hit this step is checked below.
        let clean = hot === 0;
        if (clean) {
          const m = reach();
          let safe = 0xf; // segments whose hosts are all patched
          for (let h = 0; h < nH; h++) if (HST[h] !== SAFE) safe &= ~(1 << HS[h]!);
          for (let h = 0; h < nH && clean; h++) if (HST[h] === FIX || HST[h] === HOT || (HST[h] !== SAFE && m & (1 << HS[h]!))) clean = false;
          // Nothing on its way to a host it could still infect.
          for (let i = 0; i < PK && clean; i++) {
            if (!ON[i]) continue;
            const lg = LEG[i]!, k = LK[i]!, n = END[i] ? LB[k]! : LA[k]!;
            if (lg === TO_HOST ? HST[TH[i]!] !== SAFE : (lg === TO_END || (lg === TO_ROUTER && !LF[k])) && n !== NET && !(safe & (1 << n))) clean = false;
          }
        }
        if (clean || P[2]! >= TEN_MIN) {
          (P[0] = DONE), (P[1] = 0), (P[5] = 1);
          ON.fill(0);
          ob.end((clean ? `Clean at ${clock(P[2]!)}, ${P[7]} packets bounced.` : "Still flooding at 10:00.") + FACTS);
        }
      }
      let lit = 0;
      for (let h = 0; h < nH; h++) if (HF[h]! > 0 || HST[h] === FIX) lit++;
      if (flying !== P[9]) (P[9] = flying), (P[5] = 1);
      return P[0] !== DONE || flying > 0 || lit > 0;
    },
    write() {
      for (let k = 0; k < nL; k++) if (LDIRTY[k]) (LDIRTY[k] = 0), L.attr(routers[k]!, "data-wh", LF[k] ? "filtered" : null);
      for (let h = 0; h < nH; h++) if (HDIRTY[h]) (HDIRTY[h] = 0), L.attr(hosts[h]!, "data-wh", HST[h] === HOT ? "hot" : HST[h] === FIX ? "fix" : HST[h] === SAFE ? "safe" : null);
      if (!P[5]) return;
      P[5] = 0;
      let fixed = 0, open = 0;
      for (let h = 0; h < nH; h++) fixed += +(HST[h] === SAFE);
      for (let k = 0; k < nL; k++) if (LA[k] === NET) open += +!LF[k];
      L.text(clockT, "T+" + clock(P[2]!));
      L.text(rateT, "" + P[9]);
      L.text(fixedT, fixed + "/" + nH);
      const next = P[0] === DONE ? "tap to play again" : G[T]! < P[10]! ? "hit mid-patch: cut its links first" : open ? "tap a router: filter 1434" : "now patch: tap the hosts";
      if (next !== msg) (msg = next), L.text(msgT, msg);
    },
    draw(ctx) {
      const s = G[S]!, t = G[T]!;
      // Links: segment ↔ router ↔ segment (or the internet). Open ones carry the flood; filtered ones go green, dashed past the filter.
      ctx.lineWidth = Math.max(1, 1.6 * s);
      for (let k = 0; k < nL; k++) {
        const f = LF[k]!;
        ctx.strokeStyle = col[f ? HEAL : LINE]!;
        ctx.globalAlpha = f ? 0.7 : 1;
        ctx.setLineDash(f ? LINE_DASH : NO_DASH);
        ctx.beginPath();
        ctx.moveTo(AX[k]!, AY[k]!);
        ctx.lineTo(RX[k]!, RY[k]!);
        ctx.lineTo(BX[k]!, BY[k]!);
        ctx.stroke();
      }
      ctx.setLineDash(NO_DASH);
      // Hosts: infected ones strobe; mid-patch ones fill a bar; hits on a shield flash.
      for (let h = 0; h < nH; h++) {
        const st = HST[h]!, x = HX[h]! - HW[h]!, y = HY[h]! - HHt[h]!;
        if (st === HOT) {
          ctx.globalAlpha = 0.22 + 0.18 * Math.sin(t * 22 + h);
          ctx.fillStyle = col[BUG2]!;
          ctx.fillRect(x, y, HW[h]! * 2, HHt[h]! * 2);
        } else if (st === FIX) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = col[GOLD]!;
          ctx.fillRect(x, y + HHt[h]! * 2 - 3 * s, HW[h]! * 2 * Math.min(1, HP[h]!), 3 * s);
        }
        if (HF[h]! > 0 && st !== HOT) {
          ctx.globalAlpha = HF[h]! * 0.45;
          ctx.fillStyle = col[HEAL]!;
          ctx.fillRect(x, y, HW[h]! * 2, HHt[h]! * 2);
        }
      }
      ctx.globalAlpha = 1;
      // Packets: 376-byte slugs with a short trail; bounced ones go green.
      const z = Math.max(2, 3.4 * s);
      for (let i = 0; i < PK; i++) {
        if (!ON[i]) continue;
        const dx = X1[i]! - X0[i]!, dy = Y1[i]! - Y0[i]!, x = X0[i]! + dx * U[i]!, y = Y0[i]! + dy * U[i]!, tl = (6 * s) / (Math.abs(dx) + Math.abs(dy) || 1);
        ctx.fillStyle = col[LEG[i] === BACK ? HEAL : BUG]!;
        ctx.fillRect(x - dx * tl - z / 4, y - dy * tl - z / 4, z / 2, z / 2);
        ctx.fillStyle = col[LEG[i] === BACK ? HEAL : FROM[i]! >= 0 ? GOLD : INK]!;
        ctx.fillRect(x - z / 2, y - z / 2, z, z);
      }
    },
  });
  reset();
  if (first) ob.tap(first.x, first.y);
  return {
    engine,
    /** For tests: phase, game clock (s), hosts infected / mid-patch / patched, links filtered, packets bounced, knocked back, flying. */
    get state() {
      let hot = 0, fix = 0, safe = 0, filtered = 0, flying = 0;
      for (let h = 0; h < nH; h++) (hot += +(HST[h] === HOT)), (fix += +(HST[h] === FIX)), (safe += +(HST[h] === SAFE));
      for (let k = 0; k < nL; k++) filtered += LF[k]!;
      for (let i = 0; i < PK; i++) flying += ON[i]!;
      return { phase: P[0]!, clock: P[2]!, hot, fix, safe, filtered, bounced: P[7]!, knocked: P[8]!, flying };
    },
    /** For tests: the centre of the k-th host that isn't patched or patching, else null. */
    thing(k: number) {
      for (let h = 0; h < nH; h++) if ((HST[h] === HOT || HST[h] === OK) && k-- === 0) return { x: HX[h]!, y: HY[h]! };
      return null;
    },
    destroy: () => engine.destroy(),
  } satisfies SlotScene & Record<string, unknown>;
}

/** Game seconds as m:ss. */
const clock = (sec: number) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => edgeFilter(stage, slot, first);
