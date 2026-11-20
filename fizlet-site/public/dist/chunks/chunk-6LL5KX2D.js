import {
  seeded
} from "./chunk-26IPXWAE.js";

// src/presence.ts
var INPUT = 1;
var HASH = 2;
var WELCOME = 3;
var LEAVE = 4;
var RESUME = 5;
var AWAY = 6;
var START = 7;
var LOBBY = 8;
var m12 = (k, s, a = 0, b = 0) => Uint8Array.of(k, s, a, b, 0, 0, 0, 0, 0, 0, 0, 0);
var u32 = (d, i) => (d[i] | d[i + 1] << 8 | d[i + 2] << 16 | d[i + 3] << 24) >>> 0;
function presence(e, o) {
  const P = o.players, me = o.slot, D = o.delay ?? 2, C = o.cap ?? 64, every = o.hashEvery ?? 30, t = o.transport;
  if (C < D * 2 + 2 || !(me >= 0 && me < P && P < 33) || me % 1) throw new RangeError("presence: cap < 2 \xD7 delay + 2, or slot not a seat in 0..players-1 (players \u2264 32)");
  const tag = new Int32Array(P * C).fill(-1), bits = new Uint32Array(P * C);
  const htag = new Int32Array(P * C).fill(-1), hval = new Uint32Array(P * C);
  const now = new Uint32Array(P), n = new Int32Array(6), out = new Uint8Array(12);
  n[
    3
    /* DESYNC */
  ] = -1;
  const put = (s, f, b) => (tag[s * C + f % C] = f, bits[s * C + f % C] = b);
  for (let s = 0; s < P; s++) for (let f = 0; f < D; f++) put(s, f, 0);
  const send = (k, f, v) => {
    out[0] = k, out[1] = me, out[4] = f, out[5] = f >>> 8, out[6] = f >>> 16, out[7] = f >>> 24;
    out[8] = v, out[9] = v >>> 8, out[10] = v >>> 16, out[11] = v >>> 24;
    t.send(out);
  };
  const check = (s, f, h) => {
    const i = f % C;
    for (let j = 0; j < P; j++) if (j !== s && htag[j * C + i] === f && hval[j * C + i] !== h >>> 0 && n[
      3
      /* DESYNC */
    ] < 0) n[
      3
      /* DESYNC */
    ] = f;
    htag[s * C + i] = f;
    hval[s * C + i] = h;
  };
  const receive = (d) => {
    const k = d[0], s = d[1], f = u32(d, 4) | 0, F = n[
      0
      /* FRAME */
    ], i = s * C + f % C;
    if (d.length < 12 || s >= P) return;
    if (k > 3 && k < 7) {
      n[
        5
        /* GONE */
      ] &= ~(1 << s);
      if (k > 5) n[
        5
        /* GONE */
      ] |= 1 << s;
      else if (k < 5) n[
        4
        /* LOST */
      ] |= 1 << s;
      else for (let g = F > D * 2 ? F - D : D; g < F + D; g++) if (tag[me * C + g % C] === g) send(INPUT, g, bits[me * C + g % C]);
    } else if (s === me) return;
    else if (k === INPUT && f >= F && f < F + C && tag[i] !== f) put(s, f, u32(d, 8));
    else if (k === HASH && f > F - C && f < F + C && htag[i] !== f) check(s, f, u32(d, 8));
    else n[
      2
      /* DROPPED */
    ]++;
  };
  const system = {
    step(e2) {
      const f = n[
        0
        /* FRAME */
      ];
      for (let s = 0; s < P; s++) {
        const i = s * C + f % C;
        if (tag[i] !== f) return void n[
          1
          /* STALLS */
        ]++;
        now[s] = bits[i];
      }
      const b = o.input() >>> 0;
      put(me, f + D, b);
      send(1, f + D, b);
      o.step(e2, now, f);
      n[
        0
        /* FRAME */
      ] = f + 1;
      if (o.hash && (f + 1) % every === 0) {
        const h = o.hash() >>> 0;
        check(me, f + 1, h);
        send(2, f + 1, h);
      }
    }
  };
  e.add(system);
  t.listen(receive);
  const stop = () => (e.remove(system), t.listen(null), t.close());
  e.signal.addEventListener("abort", stop, { once: true });
  return {
    system,
    /** Sim frames run so far (every peer passes the same frames, maybe at different times). */
    get frame() {
      return n[
        0
        /* FRAME */
      ];
    },
    /** Engine steps spent waiting for someone's input. */
    get stalls() {
      return n[
        1
        /* STALLS */
      ];
    },
    /** Messages refused (out of the window, bad seat, a second input or hash for one frame). */
    get dropped() {
      return n[
        2
        /* DROPPED */
      ];
    },
    /** First frame whose state hash differed from a peer's, or -1. */
    get desync() {
      return n[
        3
        /* DESYNC */
      ];
    },
    /** Bitmask of seats the room said left (their frames never arrive: the sim waits). */
    get lost() {
      return n[
        4
        /* LOST */
      ];
    },
    /** Bitmask of seats reconnecting (dropped, may come back; this one too, while `join`'s link retries). */
    get away() {
      return n[
        5
        /* GONE */
      ];
    },
    /** The confirmed input of `slot` for `frame`, or -1 if it isn't known (yet, or any more). */
    confirmed(slot, frame) {
      const i = slot * C + frame % C;
      return tag[i] === frame ? bits[i] : -1;
    },
    destroy: stop
  };
}
function hash32(bytes, h = 2166136261) {
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
}
function memory(o) {
  const cap = o.cap ?? 1024, lat = o.latency ?? 0, jit = o.jitter ?? 0, rnd = seeded(o.seed ?? 1);
  const buf = new Uint8Array(cap * 12), due = new Int32Array(cap), to = new Uint8Array(cap), n = new Int32Array(3);
  const fns = [], scratch = new Uint8Array(12);
  const ends = [];
  for (let p = 0; p < o.peers; p++) {
    fns.push(null);
    ends.push({
      send(d) {
        for (let q = 0; q < o.peers; q++) {
          if (q === p) continue;
          const k = n[1];
          if (k === cap) return void n[2]++;
          for (let b = 0; b < 12; b++) buf[k * 12 + b] = d[b];
          due[k] = n[0] + lat + (jit ? rnd() * (jit + 1) | 0 : 0);
          to[k] = q;
          n[1] = k + 1;
        }
      },
      listen: (fn) => fns[p] = fn,
      close: () => fns[p] = null
    });
  }
  return {
    ends,
    /** Advance the link clock one tick and deliver what's due (later messages may overtake). */
    tick() {
      const c = ++n[0];
      let w = 0;
      for (let k = 0; k < n[1]; k++) {
        if (due[k] <= c) {
          for (let b = 0; b < 12; b++) scratch[b] = buf[k * 12 + b];
          fns[to[k]]?.(scratch);
        } else {
          if (w !== k) buf.copyWithin(w * 12, k * 12, k * 12 + 12), due[w] = due[k], to[w] = to[k];
          w++;
        }
      }
      n[1] = w;
    },
    get queued() {
      return n[1];
    },
    get dropped() {
      return n[2];
    }
  };
}
function websocket(ws, eat) {
  let fn = null;
  const early = [];
  ws.binaryType = "arraybuffer";
  ws.addEventListener("message", (ev) => {
    if (typeof ev.data === "string") return;
    const d = new Uint8Array(ev.data);
    if (eat?.(d)) return;
    if (fn) fn(d);
    else if (early.length < 256) early.push(d);
  });
  return {
    // WebSocket.send copies the bytes before it returns, so the reused buffer goes as is: a copy
    // here allocated one array per message, from inside presence's step.
    send: (d) => void (ws.readyState === 1 && ws.send(d)),
    listen(f) {
      fn = f;
      while (f && early.length) f(early.shift());
    },
    // 1000: a leave (the room holds a seat only for a drop).
    close: () => ws.close(1e3)
  };
}
function join(url, signal, protocols, o = {}) {
  return new Promise((ok, fail) => {
    let cur, fn = null, me = -1, token = 0, tries = 0;
    const t = { send: (d) => cur.send(d), listen: (f) => cur.listen(fn = f), close: () => (tries = -1, cur.close()) };
    const bye = () => (t.close(), me < 0 ? fail(new Error("presence: room closed")) : fn?.(m12(LEAVE, me)));
    const open = (p) => {
      const ws = new WebSocket(url, p);
      cur = websocket(
        ws,
        (d) => d[0] === LOBBY ? (o.lobby?.((n = 0, m = 0) => t.send(m12(START, 0, n, m)), d[1], d[3], d[2]), 1) : d[0] === WELCOME && (tries = 0, me < 0 && (me = d[1], token = u32(d, 8), ok({ transport: t, slot: me, players: d[2], seed: u32(d, 4), mode: d[3] })), 1)
      );
      if (fn) cur.listen(fn);
      ws.onclose = (ev, c = ev.code - 1006) => {
        if (tries < 0) return;
        if (me < 0 || !token || tries >= (o.retry ?? 6) || c >>> 0 > 8 || !(353 >> c & 1)) return bye();
        tries++ || fn?.(m12(AWAY, me));
        setTimeout(() => tries < 0 || open([...[protocols ?? []].flat(), "resume." + token.toString(16)]), 125 << tries);
      };
    };
    open(protocols);
    signal?.addEventListener("abort", () => me < 0 && bye());
  });
}

export {
  INPUT,
  HASH,
  WELCOME,
  LEAVE,
  RESUME,
  AWAY,
  START,
  LOBBY,
  presence,
  hash32,
  memory,
  websocket,
  join
};
