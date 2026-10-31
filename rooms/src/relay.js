// The room's logic, free of any platform API so the Durable Object and the Node tests share it.
// Seats players in arrival order; when every seat is taken (or the host's START says so) it sends
// each one WELCOME (its seat, the player count, a shared seed and the seat's resume token); then it
// relays INPUT and HASH messages to everyone else, stamping the sender's real seat so nobody can
// speak for another player, and only the first INPUT (or HASH) a seat sends for a frame: each seat's
// frames must rise, so a second, different input for a frame never reaches anyone (fizlet/presence
// keeps the first one too). A seat that drops (no clean close) is held: the others hear AWAY, and
// its token gets it back (WELCOME, RESUME, then the other seats' last RING inputs) until the hold
// runs out (LEAVE). Wire format: see fizlet/presence (12 bytes: kind, slot, players, mode, u32
// frame or seed, u32 value or token) and README.md.
export const INPUT = 1, HASH = 2, WELCOME = 3, LEAVE = 4, RESUME = 5, AWAY = 6, START = 7;
/** Inputs kept per seat for a resume (presence's default cap; it resends the rest itself). */
export const RING = 64;

export class Relay {
  /** @param {number} players @param {number} seed */
  constructor(players, seed) {
    this.seed = seed >>> 0;
    this.started = false;
    this.mode = 0; // the host's START byte, sent to everyone in WELCOME
    this.want = 0; // START: begin once this many seats are taken (0: when full)
    this.size(players, new Array(players).fill(null));
  }
  /** (Re)size the per-seat state: at creation, and when START begins with fewer seats. */
  size(players, seats) {
    this.players = players;
    /** @type {({ send(d: Uint8Array): void } | null)[]} */
    this.seats = seats;
    this.tokens = new Array(players).fill(0); // per-seat resume tokens, drawn at the start
    this.away = new Array(players).fill(0); // ms until a dropped seat's hold ends (0: not away)
    // The last INPUT and HASH frame relayed per seat (-1: none yet). In memory: a room woken from
    // hibernation starts them over, and presence's own first-input-wins still holds then.
    this.frames = new Float64Array(players * 2).fill(-1);
    // The last RING inputs relayed per seat, [frame, value] at frame % RING (in memory, like frames).
    this.ring = new Float64Array(players * RING * 2).fill(-1);
  }
  /** Is anyone in the room (seated, or away and held)? */
  live() {
    return this.seats.some(Boolean) || this.away.some(Boolean);
  }
  /** Put a peer back in its seat (after the object wakes from hibernation). */
  seat(peer, slot) {
    this.seats[slot] = peer;
  }
  /** A new peer: its seat, or -1 when the room is full or already playing. */
  join(peer) {
    const slot = this.started ? -1 : this.seats.indexOf(null);
    if (slot < 0) return -1;
    this.seats[slot] = peer;
    this.ready();
    return slot;
  }
  /** Start when full, or once START's count is seated: with the seats taken, in arrival order. */
  ready() {
    const taken = this.seats.filter(Boolean);
    if (this.started || !(taken.length === this.players || (this.want && taken.length >= this.want))) return;
    if (taken.length < this.players) this.size(taken.length, taken);
    this.started = true;
    crypto.getRandomValues(new Uint32Array(this.players)).forEach((t, s) => (this.tokens[s] = t || 1));
    this.seats.forEach((p, s) => p.send(msg(WELCOME, s, this.players, this.seed, this.tokens[s], this.mode)));
  }
  /** The seat a resume token holds, or -1. */
  slotOf(token) {
    return this.started && token ? this.tokens.indexOf(token >>> 0) : -1;
  }
  /** A peer back with its token's seat: WELCOME, RESUME, the others' recent inputs; RESUME to the others. */
  resume(peer, slot) {
    const P = this.players;
    this.seats[slot] = peer;
    this.away[slot] = 0;
    peer.send(msg(WELCOME, slot, P, this.seed, this.tokens[slot], this.mode));
    peer.send(msg(RESUME, slot, P, 0, 0));
    for (let q = 0; q < P; q++)
      for (let i = 0; i < RING; i++) {
        const k = (q * RING + i) * 2;
        if (q !== slot && this.ring[k] >= 0) peer.send(msg(INPUT, q, P, this.ring[k], this.ring[k + 1]));
      }
    this.seats.forEach((p, s) => s !== slot && p?.send(msg(RESUME, slot, P, 0, 0)));
  }
  /** A message from the peer in `slot`; false if not relayed (START is taken here, never relayed). */
  message(slot, data) {
    if (typeof data === "string" || data.byteLength !== 12) return false;
    const b = data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : Uint8Array.from(data);
    if (!this.started) {
      if (b[0] === START && slot === 0) (this.want = Math.max(1, b[2])), (this.mode = b[3]), this.ready();
      return false;
    }
    if (b[0] !== INPUT && b[0] !== HASH) return false;
    const k = slot * 2 + b[0] - 1, f = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
    if (f <= this.frames[k]) return false; // a repeat or an old frame: first write wins
    this.frames[k] = f;
    if (b[0] === INPUT) {
      const r = (slot * RING + (f % RING)) * 2;
      this.ring[r] = f;
      this.ring[r + 1] = (b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24)) >>> 0;
    }
    b[1] = slot;
    this.seats.forEach((p, s) => s !== slot && p?.send(b));
    return true;
  }
  /** The peer in `slot` dropped (no clean close): hold its seat until `until` ms and tell the others AWAY. */
  drop(slot, until) {
    if (!this.started || this.seats[slot] == null) return this.leave(slot);
    this.seats[slot] = null;
    this.away[slot] = until;
    this.seats.forEach((p) => p?.send(msg(AWAY, slot, this.players, 0, 0)));
  }
  /** Seats whose hold ran out by `now` leave; the next hold to end (ms), or Infinity. */
  expire(now) {
    let next = Infinity;
    this.away.forEach((t, s) => (t && t <= now ? this.leave(s) : t && (next = Math.min(next, t))));
    return next;
  }
  /** The peer in `slot` left for good: tell the others. An empty room starts over. */
  leave(slot) {
    if (this.seats[slot] == null && !this.away[slot]) return;
    this.seats[slot] = null;
    this.away[slot] = this.tokens[slot] = 0;
    this.frames[slot * 2] = this.frames[slot * 2 + 1] = -1;
    if (this.started) this.seats.forEach((p) => p?.send(msg(LEAVE, slot, this.players, 0, 0)));
    if (!this.live()) this.started = false;
  }
}

export function msg(kind, slot, players, frame, value, mode = 0) {
  const b = new Uint8Array(12), v = new DataView(b.buffer);
  b[0] = kind, b[1] = slot, b[2] = players, b[3] = mode;
  v.setUint32(4, frame >>> 0, true);
  v.setUint32(8, value >>> 0, true);
  return b;
}
