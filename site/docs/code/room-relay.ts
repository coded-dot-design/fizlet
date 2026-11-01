// Docs code (shown on /guides/build-your-own-room-server/): one room's logic, no platform APIs. Your
// server makes one per room, feeds it joins, messages and leaves, and closes sockets it refuses.
// ---
export const INPUT = 1, HASH = 2, WELCOME = 3, LEAVE = 4, RESUME = 5, AWAY = 6, START = 7, LOBBY = 8;
type Peer = { send(data: Uint8Array): void };

/** 12 bytes, little-endian: kind, slot, players, mode, u32 frame (or seed), u32 value (or token). */
export function msg(kind: number, slot: number, players: number, frame: number, value: number, mode = 0) {
  const b = new Uint8Array(12), v = new DataView(b.buffer);
  b[0] = kind, b[1] = slot, b[2] = players, b[3] = mode;
  v.setUint32(4, frame >>> 0, true);
  v.setUint32(8, value >>> 0, true);
  return b;
}

export class Room {
  started = false;
  want = 0; // START: begin once this many are seated (0: when full)
  mode = 0; // START: the host's byte, sent back in WELCOME
  seats: (Peer | null)[] = [];
  last = new Float64Array(0); // the last INPUT and HASH frame relayed per seat
  tokens = new Uint32Array(0); // resume tokens, drawn at the start
  constructor(public players: number, readonly seed: number) {
    this.size(players, new Array<Peer | null>(players).fill(null));
  }
  size(players: number, seats: (Peer | null)[]) {
    this.players = players;
    this.seats = seats;
    this.last = new Float64Array(players * 2).fill(-1);
    this.tokens = new Uint32Array(players);
  }
  /** A new socket: its seat, or -1 (close it 4000 "room full"). */
  join(peer: Peer) {
    const slot = this.started ? -1 : this.seats.indexOf(null);
    if (slot < 0) return -1;
    this.seats[slot] = peer;
    this.ready();
    this.lobby();
    return slot;
  }
  /** Before the start, every waiting seat hears LOBBY: its seat, the room size, how many are seated. */
  lobby() {
    const n = this.seats.filter(Boolean).length;
    if (!this.started) this.seats.forEach((p, s) => p?.send(msg(LOBBY, s, this.players, 0, 0, n)));
  }
  /** Start when full, or once START's count is seated: with the seats taken, renumbered 0..k-1. */
  ready() {
    const taken = this.seats.filter((p): p is Peer => p !== null);
    if (this.started || !(taken.length === this.players || (this.want && taken.length >= this.want))) return;
    if (taken.length < this.players) this.size(taken.length, taken);
    this.started = true;
    crypto.getRandomValues(this.tokens).forEach((t, s) => (this.tokens[s] = t || 1));
    this.seats.forEach((p, s) => p!.send(msg(WELCOME, s, this.players, this.seed, this.tokens[s]!, this.mode)));
  }
  /** A message from the socket in `slot` (already checked: binary, 12 bytes). True when relayed. */
  message(slot: number, data: Uint8Array) {
    const b = Uint8Array.from(data);
    if (!this.started) {
      if (b[0] === START && slot === 0) (this.want = Math.max(1, b[2]!)), (this.mode = b[3]!), this.ready();
      return false; // START is taken here, never relayed
    }
    if (b[0] !== INPUT && b[0] !== HASH) return false; // only these two are relayed
    const k = slot * 2 + b[0] - 1, f = (b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24)) >>> 0;
    if (f <= this.last[k]!) return false; // first write wins: each seat's frames must rise
    this.last[k] = f;
    b[1] = slot; // the sender's real seat: nobody speaks for another player
    this.seats.forEach((p, s) => s !== slot && p?.send(b));
    return true;
  }
  /** A seat left for good: a clean close, a kick, or (with resume) its hold ran out. */
  leave(slot: number) {
    if (!this.seats[slot]) return;
    this.seats[slot] = null;
    this.tokens[slot] = 0;
    this.last[slot * 2] = this.last[slot * 2 + 1] = -1;
    if (this.started) this.seats.forEach((p) => p?.send(msg(LEAVE, slot, this.players, 0, 0)));
    if (this.seats.some(Boolean)) this.lobby();
    else this.started = false; // empty: make a fresh Room for the next join
  }
}
