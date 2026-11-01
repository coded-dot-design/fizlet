// Outbreak, act 1: Slammer (January 2003). Learn it by playing it: one 376-byte UDP packet aimed at
// SQL Server's port 1434, fired at random addresses as fast as the wire allows; the infected count
// doubled every 8.5 seconds. Packets flood every port of the firewall (real page elements: the port
// keys); only UDP 1434 lets them through into the rack, where a server that takes one starts firing
// too. Race to find and close 1434 (tap its key): closed, it bounces the flood back. Close the wrong
// port and you take your own service down (it reopens). The worm lived only in memory, so tap an
// infected server to reboot it: with 1434 still open it is hit again in seconds. Close 1434 and reboot
// the rack clean, or the clock (20x) reaches ten minutes and 75,000 servers. Tap to play again.
// Bricks: the kernel (settle, ledger), @fzlt/core/steer's exact hypot, @fzlt/core/slot. Step allocates nothing.
import type { SlotScene, SlotTap } from "../../../src/slot";
import { outbreak, hypot, W, H, S, T, SHAKE, INK, MUTED, LINE, BUG, BUG2, HEAL, GLOW, GOLD } from "./outbreak";

const PK = 180, PORTS = 16, HOSTS = 6, SPEED = 20, TEN_MIN = 600, WORLD = 75000, DOUBLE = 8.5, INTRO = 0.7;
const OPEN = 0, CLOSED = 1, DOWN = 2; // port states (DOWN: a service you closed, reopening)
const INTROING = 0, PLAY = 1, DONE = 2;

export function slammer(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const ob = outbreak(stage, slot), { engine, L, R, G, col } = ob;
  const ports = [...slot.querySelectorAll<HTMLElement>("[data-sl-port]")].slice(0, PORTS);
  const hosts = [...slot.querySelectorAll<HTMLElement>("[data-sl-host]")].slice(0, HOSTS);
  const node = (sel: string) => { const el = slot.querySelector<HTMLElement>(sel)!; return (el.firstChild as Text | null) ?? L.add(el.appendChild(document.createTextNode(""))); };
  const clockT = node("[data-sl-clock]"), worldT = node("[data-sl-world]"), msgT = node("[data-sl-msg]");
  const nP = ports.length, nH = hosts.length, NUM = new Uint16Array(nP), KEY = ports.findIndex((p) => p.dataset.slPort === "1434");
  for (let i = 0; i < nP; i++) NUM[i] = +ports[i]!.dataset.slPort!;
  // Ports and hosts: box (x0, y0, x1, y1), state, flash; dirty flags for the attribute writes.
  const PX0 = new Float32Array(PORTS), PY0 = new Float32Array(PORTS), PX1 = new Float32Array(PORTS), PY1 = new Float32Array(PORTS), PS = new Uint8Array(PORTS), PF = new Float32Array(PORTS), PD = new Float32Array(PORTS), PDIRTY = new Uint8Array(PORTS);
  const HX0 = new Float32Array(HOSTS), HY0 = new Float32Array(HOSTS), HX1 = new Float32Array(HOSTS), HY1 = new Float32Array(HOSTS), HOT = new Uint8Array(HOSTS), HF = new Float32Array(HOSTS), HFIRE = new Float32Array(HOSTS), HDIRTY = new Uint8Array(HOSTS);
  // Packets: position, velocity, life, side (0 inbound, 1 in the rack, 2 outbound).
  const X = new Float32Array(PK), Y = new Float32Array(PK), VX = new Float32Array(PK), VY = new Float32Array(PK), LIFE = new Float32Array(PK), SIDE = new Uint8Array(PK), ON = new Uint8Array(PK);
  /** Inbound: the port it is addressed to; in the rack: the server it came from. */
  const TO = new Int8Array(PK);
  // [0] phase, [1] phase time, [2] clock (game s), [3] spawn debt, [4] fw x0, [5] fw x1, [6] rack x0, [7] rack x1,
  // [8] rack y0, [9] rack y1, [10] closed 1434 at (game s, -1), [11] text dirty, [12] message (port no, 0 none, -1 reboot, -2 1434), [13] reboots.
  const P = new Float64Array(16);
  let msg = "";

  function reset() {
    for (let i = 0; i < nP; i++) if (PS[i]) (PS[i] = OPEN), (PDIRTY[i] = 1);
    for (let h = 0; h < nH; h++) if (HOT[h]) (HOT[h] = 0), (HDIRTY[h] = 1);
    ON.fill(0);
    (P[0] = INTROING), (P[1] = 0), (P[2] = 0), (P[3] = 0), (P[10] = -1), (P[11] = 1), (P[12] = 0), (P[13] = 0);
    msg = "";
    ob.state(null);
    engine.busy(INTRO);
  }
  const world = () => Math.min(WORLD, Math.round(Math.pow(2, P[2]! / DOUBLE)));
  /** A packet from (x, y) toward (tx, ty) at speed `v`. */
  function fire(x: number, y: number, tx: number, ty: number, v: number, side: number, to: number) {
    let i = 0;
    while (i < PK && ON[i]) i++;
    if (i >= PK) return;
    const dx = tx - x, dy = ty - y, d = hypot(dx, dy) || 1;
    (ON[i] = 1), (X[i] = x), (Y[i] = y), (VX[i] = (dx / d) * v), (VY[i] = (dy / d) * v), (LIFE[i] = 3), (SIDE[i] = side), (TO[i] = to);
  }
  /** The port whose key spans height y (nearest row), or -1. */
  function portAt(x: number, y: number) {
    for (let i = 0; i < nP; i++) if (x >= PX0[i]! - 2 && x <= PX1[i]! + 2 && y >= PY0[i]! - 2 && y <= PY1[i]! + 2) return i;
    return -1;
  }
  function hostAt(x: number, y: number, pad: number) {
    for (let h = 0; h < nH; h++) if (x >= HX0[h]! - pad && x <= HX1[h]! + pad && y >= HY0[h]! - pad && y <= HY1[h]! + pad) return h;
    return -1;
  }
  function infect(h: number) {
    if (HOT[h]) return;
    (HOT[h] = 1), (HDIRTY[h] = 1), (HF[h] = 1), (HFIRE[h] = 0.2);
    ob.burst((HX0[h]! + HX1[h]!) / 2, (HY0[h]! + HY1[h]!) / 2, 8, 150, BUG, GOLD);
  }

  ob.run({
    measure(r) {
      let fx0 = 1e9, fx1 = 0;
      for (let i = 0; i < nP; i++) {
        const b = ports[i]!.getBoundingClientRect();
        (PX0[i] = b.left - r.left), (PY0[i] = b.top - r.top), (PX1[i] = b.right - r.left), (PY1[i] = b.bottom - r.top);
        (fx0 = Math.min(fx0, PX0[i]!)), (fx1 = Math.max(fx1, PX1[i]!));
      }
      (P[4] = fx0), (P[5] = fx1);
      let rx0 = 1e9, rx1 = 0, ry0 = 1e9, ry1 = 0;
      for (let h = 0; h < nH; h++) {
        const b = hosts[h]!.getBoundingClientRect();
        (HX0[h] = b.left - r.left), (HY0[h] = b.top - r.top), (HX1[h] = b.right - r.left), (HY1[h] = b.bottom - r.top);
        (rx0 = Math.min(rx0, HX0[h]!)), (rx1 = Math.max(rx1, HX1[h]!)), (ry0 = Math.min(ry0, HY0[h]!)), (ry1 = Math.max(ry1, HY1[h]!));
      }
      (P[6] = rx0), (P[7] = rx1), (P[8] = ry0), (P[9] = ry1);
    },
    step(dt, tap, tx, ty) {
      const s = G[S]!, w0 = G[W]!, h0 = G[H]!;
      P[1] = P[1]! + dt;
      if (tap) {
        if (P[0] === DONE) reset();
        else {
          const pi = portAt(tx, ty), hi = pi < 0 ? hostAt(tx, ty, 6 * s) : -1;
          if (pi >= 0 && PS[pi] === OPEN) {
            // Close it: a shield slams shut. 1434 stays shut; any other port is a service of yours.
            PS[pi] = pi === KEY ? CLOSED : DOWN;
            (PD[pi] = 2.2), (PDIRTY[pi] = 1), (PF[pi] = 1);
            if (pi === KEY) (P[10] = P[2]!), (P[12] = -2), (G[SHAKE] = 0.15), ob.burst((PX0[pi]! + PX1[pi]!) / 2, (PY0[pi]! + PY1[pi]!) / 2, 14, 220, HEAL, GLOW);
            else P[12] = NUM[pi]!;
            ob.ring((PX0[pi]! + PX1[pi]!) / 2, (PY0[pi]! + PY1[pi]!) / 2, 30, pi === KEY ? HEAL : GOLD);
            P[11] = 1;
          } else if (hi >= 0 && HOT[hi]) {
            // Reboot: Slammer lived only in memory, so a restart clears it (until the next packet).
            (HOT[hi] = 0), (HDIRTY[hi] = 1), (HF[hi] = 1);
            P[13] = P[13]! + 1;
            (P[12] = -1), (P[11] = 1);
            ob.ring((HX0[hi]! + HX1[hi]!) / 2, (HY0[hi]! + HY1[hi]!) / 2, 34, HEAL);
          } else ob.ring(tx, ty, 16, MUTED);
        }
      }
      if (P[0] === INTROING && P[1]! >= INTRO) (P[0] = PLAY), (P[1] = 0);
      let flying = 0, hot = 0;
      if (P[0] === PLAY) {
        const was = Math.floor(P[2]!);
        P[2] = P[2]! + dt * SPEED;
        if (Math.floor(P[2]!) !== was) P[11] = 1;
        // The flood: more infected servers out there, more packets a second.
        const rate = Math.min(46, 3 + Math.log2(world()) * 2.6);
        P[3] = P[3]! + rate * dt;
        while (P[3]! >= 1) {
          P[3] = P[3]! - 1;
          // Every port gets hit; a quarter of the flood is addressed to 1434, the one with a listener.
          const p = R() < 0.25 ? KEY : (R() * nP) | 0;
          fire(4, 6 + R() * (h0 - 12), (PX0[p]! + PX1[p]!) / 2, PY0[p]! + (0.2 + R() * 0.6) * (PY1[p]! - PY0[p]!), 340 * s, 0, p);
        }
      }
      for (let i = 0; i < nP; i++) {
        if (PF[i]! > 0) PF[i] = Math.max(0, PF[i]! - dt * 4);
        if (PS[i] === DOWN && (PD[i] = PD[i]! - dt) <= 0) (PS[i] = OPEN), (PDIRTY[i] = 1);
      }
      for (let h = 0; h < nH; h++) {
        if (HF[h]! > 0) HF[h] = Math.max(0, HF[h]! - dt * 3);
        if (!HOT[h]) continue;
        hot++;
        // An infected server fires at random addresses: out to the internet, and into its own rack.
        if (P[0] === PLAY && (HFIRE[h] = HFIRE[h]! - dt) <= 0) {
          HFIRE[h] = 0.16 + R() * 0.12;
          const cx = (HX0[h]! + HX1[h]!) / 2, cy = (HY0[h]! + HY1[h]!) / 2;
          let o = (R() * nH) | 0;
          if (o === h) o = (o + 1) % nH;
          if (R() < 0.3) fire(cx, cy, (HX0[o]! + HX1[o]!) / 2, (HY0[o]! + HY1[o]!) / 2, 260 * s, 1, h);
          else fire(cx, cy, -w0, cy + (R() - 0.5) * h0 * 1.6, 360 * s, 2, h);
        }
      }
      for (let i = 0; i < PK; i++) {
        if (!ON[i]) continue;
        flying++;
        LIFE[i] = LIFE[i]! - dt;
        const x0 = X[i]!;
        (X[i] = x0 + VX[i]! * dt), (Y[i] = Y[i]! + VY[i]! * dt);
        if (Y[i]! < 2 || Y[i]! > h0 - 2) (VY[i] = -VY[i]!), (Y[i] = Math.min(h0 - 2, Math.max(2, Y[i]!)));
        const p = TO[i]!;
        if (SIDE[i] === 0 && p >= 0 && X[i]! >= PX0[p]! && X[i]! <= PX1[p]! && Y[i]! >= PY0[p]! && Y[i]! <= PY1[p]!) {
          // At its port: a closed key bounces it; an open one lets it in; only 1434 has a listener.
          if (PS[p] !== OPEN) {
            (X[i] = x0), (VX[i] = -Math.abs(VX[i]!) * (0.5 + R() * 0.4)), (VY[i] = VY[i]! + (R() - 0.5) * 240 * s), (TO[i] = -1);
            PF[p] = Math.max(PF[p]!, 0.5);
            ob.part(X[i]!, Y[i]!, -60 * s, (R() - 0.5) * 120 * s, 0.25, 2, p === KEY ? HEAL : GOLD);
          } else if (p !== KEY) {
            ON[i] = 0;
            PF[p] = Math.max(PF[p]!, 0.35);
            ob.part(X[i]!, Y[i]!, 40 * s, (R() - 0.5) * 80 * s, 0.2, 1.5, MUTED);
          } else {
            PF[p] = 1;
            // Through 1434, on to a server in the rack.
            const h = (R() * nH) | 0, dx = (HX0[h]! + HX1[h]!) / 2 - X[i]!, dy = (HY0[h]! + HY1[h]!) / 2 - Y[i]!, d = hypot(dx, dy) || 1;
            (SIDE[i] = 1), (TO[i] = -1), (VX[i] = (dx / d) * 360 * s), (VY[i] = (dy / d) * 360 * s);
          }
        } else if (SIDE[i] === 1) {
          const h = hostAt(X[i]!, Y[i]!, 0);
          if (h >= 0 && h !== TO[i]) {
            ON[i] = 0;
            hot += 1 - HOT[h]!; // counted for the end check below: a server hit this step is hot now
            infect(h);
          } else if ((X[i]! > w0 - 2 && VX[i]! > 0) || (X[i]! < P[6]! - 8 * s && VX[i]! < 0)) VX[i] = -VX[i]!;
        }
        if (X[i]! < -8 || X[i]! > w0 + 8 || LIFE[i]! <= 0) ON[i] = 0;
      }
      // The end: 1434 shut and the rack clean, or ten minutes on the clock.
      if (P[0] === PLAY) {
        const clean = PS[KEY] === CLOSED && hot === 0;
        if (clean || P[2]! >= TEN_MIN) {
          (P[0] = DONE), (P[1] = 0), (P[11] = 1);
          ON.fill(0);
          const t = clock(P[2]!), n = world().toLocaleString("en-US");
          ob.end(clean ? `Clean at ${t}, with ${n} servers infected out there. The patch had been out for six months. Tap to play again.` : `Ten minutes: ${n} servers. Closing UDP 1434 at the edge stopped it; the patch had been out for six months. Tap to play again.`);
        }
      }
      let lit = 0;
      for (let i = 0; i < nP; i++) if (PF[i]! > 0) lit++;
      for (let h = 0; h < nH; h++) if (HF[h]! > 0) lit++;
      return P[0] !== DONE || flying > 0 || lit > 0;
    },
    write() {
      for (let i = 0; i < nP; i++) if (PDIRTY[i]) (PDIRTY[i] = 0), L.attr(ports[i]!, "data-sl", PS[i] === CLOSED ? "closed" : PS[i] === DOWN ? "down" : null);
      for (let h = 0; h < nH; h++) if (HDIRTY[h]) (HDIRTY[h] = 0), L.attr(hosts[h]!, "data-sl", HOT[h] ? "hot" : null);
      if (!P[11]) return;
      P[11] = 0;
      L.text(clockT, "T+" + clock(P[2]!));
      L.text(worldT, world().toLocaleString("en-US"));
      const m = P[12]!;
      const next = m === -2 ? "UDP 1434 closed: now reboot the rack" : m === -1 ? (PS[KEY] === CLOSED ? "rebooted: clean" : "rebooted: hit again while 1434 is open") : m > 0 ? `port ${m} is one of your services: back open` : "tap the port it comes in on";
      if (next !== msg) (msg = next), L.text(msgT, msg);
    },
    draw(ctx) {
      const s = G[S]!, t = G[T]!;
      // Port flashes: hit keys light up; 1434 burns while the worm pours through it.
      for (let i = 0; i < nP; i++) {
        if (PF[i]! <= 0) continue;
        ctx.globalAlpha = PF[i]! * (i === KEY && PS[i] === OPEN ? 0.75 : 0.4);
        ctx.fillStyle = col[i === KEY && PS[i] === OPEN ? BUG : PS[i] ? HEAL : GOLD]!;
        ctx.fillRect(PX0[i]!, PY0[i]!, PX1[i]! - PX0[i]!, PY1[i]! - PY0[i]!);
      }
      // Servers: an infected one strobes; a rebooted one flashes green.
      for (let h = 0; h < nH; h++) {
        if (!HOT[h] && HF[h]! <= 0) continue;
        ctx.globalAlpha = HOT[h] ? 0.25 + 0.2 * Math.sin(t * 22 + h) : HF[h]! * 0.6;
        ctx.fillStyle = col[HOT[h] ? BUG2 : HEAL]!;
        ctx.fillRect(HX0[h]!, HY0[h]!, HX1[h]! - HX0[h]!, HY1[h]! - HY0[h]!);
      }
      ctx.globalAlpha = 1;
      // Packets: 376-byte slugs with a short trail.
      const z = Math.max(2, 3.6 * s);
      for (let i = 0; i < PK; i++) {
        if (!ON[i]) continue;
        const sp = Math.abs(VX[i]!) + Math.abs(VY[i]!) || 1, tl = 7 * s;
        ctx.fillStyle = col[SIDE[i] === 2 ? LINE : BUG]!;
        ctx.fillRect(X[i]! - (VX[i]! / sp) * tl - z / 4, Y[i]! - (VY[i]! / sp) * tl - z / 4, z / 2, z / 2);
        ctx.fillStyle = col[SIDE[i] ? GOLD : INK]!;
        ctx.fillRect(X[i]! - z / 2, Y[i]! - z / 2, z, z);
      }
    },
  });
  reset();
  if (first) ob.tap(first.x, first.y);
  return {
    engine,
    /** For tests: phase, game clock (s), infected out there, servers hot in the rack, 1434 closed, reboots, packets. */
    get state() {
      let hot = 0, flying = 0;
      for (let h = 0; h < nH; h++) hot += HOT[h]!;
      for (let i = 0; i < PK; i++) flying += ON[i]!;
      return { phase: P[0]!, clock: P[2]!, world: world(), hot, closed: PS[KEY] === CLOSED, reboots: P[13]!, flying };
    },
    /** For tests: the centre of infected server `k` (the k-th hot one), else null. */
    thing(k: number) {
      for (let h = 0; h < nH; h++) if (HOT[h] && k-- === 0) return { x: (HX0[h]! + HX1[h]!) / 2, y: (HY0[h]! + HY1[h]!) / 2 };
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

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => slammer(stage, slot, first);
