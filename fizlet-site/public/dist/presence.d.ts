import type { Engine, System } from "./kernel/engine.js";
/** Wire kinds. Every message is 12 bytes: kind, slot, players, mode, u32 frame (or seed), u32 value
 *  (or token). From the room: WELCOME, LEAVE, RESUME (a seat is back: resend), AWAY (a seat dropped and
 *  may come back), LOBBY (before the start: your seat, room size, seated); START goes to the room from
 *  the host (the protocol: /guides/build-your-own-room-server/). */
export declare const INPUT = 1, HASH = 2, WELCOME = 3, LEAVE = 4, RESUME = 5, AWAY = 6, START = 7, LOBBY = 8;
/** Moves 12-byte messages to the room (or the other peers) and back. */
export interface Transport {
    /** Send one message. The buffer is reused: copy it before returning. */
    send(data: Uint8Array): void;
    /** Deliver every incoming message to `fn` (messages that arrived earlier are flushed to it). */
    listen(fn: ((data: Uint8Array) => void) | null): void;
    close(): void;
}
/** Options for `presence()`: the transport, this peer's seat, the number of players, the input delay
 *  and the ring sizes. */
export interface PresenceOptions {
    transport: Transport;
    /** This peer's seat, 0..players-1 (the room says which). */
    slot: number;
    players: number;
    /** Frames of input delay (default 2: 33 ms at 60 Hz). */
    delay?: number;
    /** Input frames kept per player (default 64; at least 2 × delay + 2). */
    cap?: number;
    /** This player's input for the frame being scheduled, as bits (read latched intents here). */
    input(): number;
    /** The simulation for one frame: same inputs + same seed → same state on every peer. */
    step(e: Engine, inputs: Uint32Array, frame: number): void;
    /** A hash of the sim state (see `hash32`); compared across peers to catch a desync. */
    hash?(): number;
    /** Frames between hash checks (default 30). */
    hashEvery?: number;
}
/** Lockstep multiplayer on engine `e`: each sim frame waits for every player's input (sent `delay`
 *  frames ahead), so peers never drift; state hashes are compared to catch a desync. Read `frame`,
 *  `stalls`, `desync` and `lost`; `destroy()` stops it. */
export declare function presence(e: Engine, o: PresenceOptions): {
    system: System;
    /** Sim frames run so far (every peer passes the same frames, maybe at different times). */
    readonly frame: number;
    /** Engine steps spent waiting for someone's input. */
    readonly stalls: number;
    /** Messages refused (out of the window, bad seat, a second input or hash for one frame). */
    readonly dropped: number;
    /** First frame whose state hash differed from a peer's, or -1. */
    readonly desync: number;
    /** Bitmask of seats the room said left (their frames never arrive: the sim waits). */
    readonly lost: number;
    /** Bitmask of seats reconnecting (dropped, may come back; this one too, while `join`'s link retries). */
    readonly away: number;
    /** The confirmed input of `slot` for `frame`, or -1 if it isn't known (yet, or any more). */
    confirmed(slot: number, frame: number): number;
    destroy: () => void;
};
/** The lockstep session `presence()` returns. */
export type Presence = ReturnType<typeof presence>;
/** FNV-1a over bytes: hash a byte view of your state's typed arrays (make the view once). */
export declare function hash32(bytes: Uint8Array, h?: number): number;
/** In-memory hub: `peers` transports that broadcast to each other (like the room relay) after
 *  `latency` ± `jitter` ticks. Call `tick()` once per frame. Bounded: `cap` messages in flight. */
export declare function memory(o: {
    peers: number;
    latency?: number;
    jitter?: number;
    seed?: number;
    cap?: number;
}): {
    ends: Transport[];
    /** Advance the link clock one tick and deliver what's due (later messages may overtake). */
    tick(): void;
    readonly queued: number;
    readonly dropped: number;
};
/** Wrap an open-or-opening WebSocket as a transport. Messages before `listen` are kept (≤ 256).
 *  `send` takes presence's 12-byte messages (the room refuses any other size). `eat` (join's) sees each
 *  message first and keeps it from the listener when it returns true. */
export declare function websocket(ws: WebSocket, eat?: (d: Uint8Array) => unknown): Transport;
/** Options for `join()`. */
export interface JoinOptions {
    /** Reconnect tries after a drop, 250 ms apart and doubling (default 6: about 16 s; 0: off). Meanwhile
     *  `away` has this seat's bit (the others see AWAY); when they run out, `lost` (LEAVE). */
    retry?: number;
    /** Called on each LOBBY from the room before the start (on every join and leave): this player's
     *  `seat`, how many are `seated`, the room `size`. Seat 0 is the host: its `start(seats, mode)` asks
     *  the room to begin once `seats` are taken (0: now) with the seats it has; `mode` (0..255) reaches
     *  every peer. Other seats' starts are ignored by the room. */
    lobby?(start: (seats?: number, mode?: number) => void, seat: number, seated: number, size: number): void;
}
/** Join a room (a server speaking the `fizlet-rooms` subprotocol): resolves when the room starts with
 *  your seat, the player count, the shared seed and the host's `mode`. `protocols` go to the WebSocket
 *  handshake: the room reads its access token there (`["fizlet-rooms", "invite." + code]`), so the code stays out of the URL and the
 *  logs. A dropped link (1006, or a server restart: 1011, 1012, 1014) reconnects on its own (`o.retry`) with the seat's resume token, kept in
 *  memory only (never in a URL); the room's own closes (idle, full, seat gone, the caps) end it. */
export declare function join(url: string, signal?: AbortSignal, protocols?: string | string[], o?: JoinOptions): Promise<{
    transport: Transport;
    slot: number;
    players: number;
    seed: number;
    mode: number;
}>;
