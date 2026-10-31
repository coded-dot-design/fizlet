// The room's logic, free of any platform API so the Durable Object and the Node tests share it.
// Seats players in arrival order; when every seat is taken it sends each one WELCOME (its seat,
// the player count and a shared seed); then it relays INPUT and HASH messages to everyone else,
// stamping the sender's real seat so nobody can speak for another player, and only the first
// INPUT (or HASH) a seat sends for a frame: each seat's frames must rise, so a second, different
// input for a frame never reaches anyone (@fzlt/core/presence keeps the first one too). Wire format: see
// @fzlt/core/presence (12 bytes: kind, slot, players, 0, u32 frame or seed, u32 value).
export const INPUT = 1, HASH = 2, WELCOME = 3, LEAVE = 4;

export class Relay {
  /** @param {number} players @param {number} seed */
  constructor(players, seed) {
    this.players = players;
    this.seed = seed >>> 0;
    /** @type {({ send(d: Uint8Array): void } | null)[]} */
    this.seats = new Array(players).fill(null);
    this.started = false;
    // The last INPUT and HASH frame relayed per seat (-1: none yet). In memory: a room woken from
    // hibernation starts them over, and presence's own first-input-wins still holds then.
    this.frames = new Float64Array(players * 2).fill(-1);
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
    if (this.seats.every(Boolean)) {
      this.started = true;
      this.seats.forEach((p, s) => p.send(msg(WELCOME, s, this.players, this.seed, 0)));
    }
    return slot;
  }
  /** A message from the peer in `slot`; false if refused. */
  message(slot, data) {
    if (!this.started || typeof data === "string" || data.byteLength !== 12) return false;
    const b = data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : Uint8Array.from(data);
    if (b[0] !== INPUT && b[0] !== HASH) return false;
    const k = slot * 2 + b[0] - 1, f = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
    if (f <= this.frames[k]) return false; // a repeat or an old frame: first write wins
    this.frames[k] = f;
    b[1] = slot;
    this.seats.forEach((p, s) => s !== slot && p?.send(b));
    return true;
  }
  /** The peer in `slot` left: tell the others. An empty room starts over. */
  leave(slot) {
    if (this.seats[slot] == null) return;
    this.seats[slot] = null;
    this.frames[slot * 2] = this.frames[slot * 2 + 1] = -1;
    if (this.started) this.seats.forEach((p) => p?.send(msg(LEAVE, slot, this.players, 0, 0)));
    if (!this.seats.some(Boolean)) this.started = false;
  }
}

export function msg(kind, slot, players, frame, value) {
  const b = new Uint8Array(12), v = new DataView(b.buffer);
  b[0] = kind, b[1] = slot, b[2] = players;
  v.setUint32(4, frame >>> 0, true);
  v.setUint32(8, value >>> 0, true);
  return b;
}
