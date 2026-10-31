# fizlet-rooms (demo room server)

A room server for [`fizlet/presence`](../src/presence.ts): a Cloudflare Worker that routes
`/room/<n>` to one Durable Object per numbered room. The room seats players in arrival order,
sends each one `WELCOME` (seat, player count, a shared seed, a resume token) once it's full (or the
host says start), then relays every `INPUT` and `HASH` message to the other seats, stamping the
sender's real seat. It never simulates: the peers run the same lockstep sim. WebSockets use the
hibernation API, so an idle room holds no running object. A player whose link drops gets its seat
back with its token ([Resume](#resume)).

Its own package: it is not a dependency of `fizlet` and is not published. Deploying is an owner
step: [DEPLOY.md](DEPLOY.md).

## The demo gate

No real login yet (planned later). A page asks for an **invite code** and the Worker checks it.
The code never goes in a URL (URLs land in request logs):

- `POST /invite` with the code as a plain-text body → `200 {"ok":true,"players":4}` or `403`: the
  page's "sign in" check. `players` is `MAX_PLAYERS`, so a page offers only room sizes that can
  join. A text body keeps it a simple request (no CORS preflight):
  `fetch(rooms + "/invite", { method: "POST", body: code })`.
- `GET /room/<n>?players=2` (WebSocket) with the subprotocols `["fizlet-rooms", "invite." + code]`
  → the room (the `101` answers `fizlet-rooms`), or `403` without a listed code. With fizlet/presence:
  `join(url, signal, ["fizlet-rooms", "invite." + code])`.
- **Deprecated, accepted for one release:** `GET /invite?code=XXXX` and `/room/<n>?invite=XXXX`, for
  pages that still send the code in the URL. Invocation logs are off (`wrangler.toml`), so these
  URLs aren't kept in Workers Logs either.

Codes are 10 to 64 characters. They live in Workers KV (`INVITES`) as `invite:` + SHA-256 of the
code (trimmed, upper-cased), so the list never holds the codes themselves. Codes are made up by the
owner and handed out. What the gate does and doesn't protect: [THREAT-MODEL.md](THREAT-MODEL.md).

## Play passes (optional, off by default)

A second gate for handing out play time: a **pass** is a signed, expiring token tied to the devices
that first use it. Code: `src/pass.js`. With `REQUIRE_PASS` unset or `"false"` (the default) nothing
changes: passes are ignored and the invite code is the gate.

- **Format:** `base64url(payload).base64url(HMAC-SHA256(payload, PASS_SECRET))`, payload
  `{v:1, id, exp, kind?, dev?, gh?, issue?, name?}` (`exp` in Unix seconds, `id` 96 random bits).
  The Worker only checks passes (WebCrypto); they are minted elsewhere with the same secret: the
  Battlefield Blitz `play-pass` workflow (a 1-hour pass for an approved GitHub request) and the
  owner's mint CLI (`scripts/play-pass.mjs` in that repo).
- **Kinds and ceilings:** `play` and `family` live at most 30 days on at most 3 devices; `owner` a
  year on at most 5. `dev` (default 1) is how many devices may use it.
- **Join** (`REQUIRE_PASS="true"`): subprotocols `["fizlet-rooms", "pass." + pass, "device." + key]`,
  where the key is 16 to 64 base64url characters the page makes once per device. The first `dev`
  device keys to join hold the pass (kept in the `Passes` Durable Object until it expires); any other
  device gets `403 pass in use on another device`. The pass replaces the invite; the rate caps stay.
  A pass is checked when a socket joins: a match running when it expires plays on, the next join is
  refused.
- **Sign-in check:** `POST /invite` with the body `pass + "\n" + device key` → `200 {ok, players,
  pass:true}` or `403 {ok:false, pass:true, why}`, without taking a device seat. An empty POST
  answers `pass:true` too, so a page knows to show its PASS field.
- **Admin** (only when `ROOMS_ADMIN_KEY` is set, `authorization: Bearer <key>`):
  `POST /pass/revoke` with the pass or its id (refused until it would have expired) and
  `POST /pass/list` (ids, device counts, expiries; never device keys).
- **Switching on** (owner): `wrangler secret put PASS_SECRET` (the same value as the Blitz repo's
  Actions secret), `wrangler secret put ROOMS_ADMIN_KEY`, deploy (migration `v2` adds `Passes`), then
  set `REQUIRE_PASS = "true"` and deploy again. With `REQUIRE_PASS` on and no `PASS_SECRET`, every
  join is refused (`503`), never let through.

## Spend caps (hard limits in code)

`src/limits.js` holds every cap with a default and a ceiling. `[vars]` in `wrangler.toml` can lower
a cap; nothing can lift it past its ceiling.

| Cap | Default | Ceiling | What it bounds |
|---|---|---|---|
| `MAX_ROOMS` | 16 | 256 | Rooms are `/room/0` … `/room/MAX_ROOMS-1`: at most this many Durable Objects |
| `MAX_PLAYERS` | 2 | 8 | Seats per room |
| `MSG_RATE` / `MSG_BURST` | 90 / 180 | 240 / 480 | Messages a second per socket (lockstep at 60 Hz sends ~62); over it, closed `1008` |
| message size | 12 bytes | — | Anything else (text, bigger, smaller) is closed `1009` |
| `IDLE_SECONDS` | 120 | 3600 | A room with no relayed message for this long is closed (`1001 room idle`); refused messages and "room full" joiners don't count |
| `LOBBY_SECONDS` | 90 | 600 | A room not full this long after its first seat is closed (`1001 room not filled`) |
| `MAX_ROOM_SECONDS` | 1800 | 14400 | Every room closes after this, busy or not |
| `GATE_RATE` | 30 | 300 | Invite checks + joins per IP a minute, counted in each Worker isolate, before the KV read; over it, `429` |
| `JOIN_RATE` | 10 | 120 | Joins per IP a minute into one room, counted by the room before a socket is accepted; over it, `429` |
| `RESUME_SECONDS` | 20 | 120 | A seat that drops is held this long for its resume token (`0`: no resume, a drop is a leave) |
| `ALLOWED_ORIGINS` | any | — | Page origins allowed to connect (set it before deploying) |

The rooms store nothing (no Durable Object storage writes; with passes on, only `Passes` stores the device locks): what a room must remember across
hibernation (seats, tokens, held seats, the time of the last relayed message) rides in its sockets'
attachments. One alarm per room checks the lobby, idle and lifetime caps and the end of each hold. The relay passes on only the first `INPUT` (and `HASH`) a seat sends for a
frame: each seat's frames must rise, so a second, different input for a frame reaches nobody.

## Wire format

Every message is 12 bytes: `kind, slot, players, mode, u32 frame (or seed), u32 value (or token)`,
little-endian. The room stamps `slot` with the sender's real seat; clients send only `INPUT`,
`HASH` and (the host, before the start) `START`.

| Kind | # | From | Bytes |
|---|---|---|---|
| `INPUT` | 1 | a seat, relayed | `slot`, u32 frame, u32 input bits |
| `HASH` | 2 | a seat, relayed | `slot`, u32 frame, u32 state hash |
| `WELCOME` | 3 | room | `slot` (your seat), `players`, `mode` (the host's START byte, else 0), u32 seed, u32 resume token |
| `LEAVE` | 4 | room | `slot` left for good (a clean close, a kick, or its hold ran out) |
| `RESUME` | 5 | room | `slot` is back: every peer resends its own inputs for its frames F-D..F+D-1 |
| `AWAY` | 6 | room | `slot` dropped and is held for `RESUME_SECONDS`: show "reconnecting" |
| `START` | 7 | host (seat 0) | `players` byte = start once this many are seated (`0`: now), `mode` byte = any 0..255 the game picks (e.g. its mode or team layout) |

**START (begin before the room is full).** Open the room with the most seats the mode can take
(`?players=4`). Seat 0 is the host (the first to join). Its `START` begins the match once `n` seats
are taken (`n = 0`: now), with the seats taken: they are numbered `0..k-1` in arrival order and
`WELCOME` says `players = k` and the host's `mode`. The game fills the other places with bots, which
every peer simulates the same way from the seed, and seats teams from `slot` and `mode` (for
example 2v2: seats 0 and 2 against 1 and 3). A `START` from any other seat, or after the start, is
ignored. With fizlet/presence: `join(url, signal, protocols, { lobby: (start) => button.onclick = () => start(0, mode) })`.
Joiners after the start are refused (`4000 room full`); a room opened for a different count is `409`.

## Resume

A drop is a close without a clean code (1006, or a server restart 1011/1012/1014) or a socket error.
The room holds the seat for `RESUME_SECONDS` (default 20) and tells the others `AWAY`. A clean
close (1000, 1001, no code, 3000-4999) or a kick (1008/1009) is a leave: `LEAVE` at once.

To come back, the client opens the same room with the subprotocol `resume.<token in hex>` next to
its invite (`["fizlet-rooms", "invite." + code, "resume." + token.toString(16)]`): never in the URL.
The room answers `WELCOME` (same seat, same token), `RESUME` for that seat, then the other seats'
last 64 relayed inputs; the others hear `RESUME`. Every peer then resends its own recent inputs, so
inputs lost while the link was down arrive (first write wins drops the repeats; after a wake, the
room's own copy is gone and these resends carry it). If the old socket still sits in the seat
(half-open), it is closed `4001 resumed` and nobody hears `LEAVE`. A wrong or expired token is
closed `4002 seat gone`: a resume never takes a fresh seat. Tokens are 32 random bits per seat,
drawn at the start, kept in memory on the client (fizlet/presence's `join` does all of this, with 6
tries over about 16 s; `away` / `lost` on the presence show it).

## Run and test locally

```sh
npm install
npm test                 # caps, invite keys, relay logic, the Worker and Room on fakes (Node; CI runs it)
(cd .. && npm run build) && npm run test:wrangler
npm run dev              # serve on http://localhost:8787 (local workerd, local KV)
```

`test:wrangler` seeds a test invite into a local KV, starts `wrangler dev --local` with
`IDLE_SECONDS=3`, `LOBBY_SECONDS=3` and `MAX_ROOMS=5`, and checks the following:

- **The gate:** no invite, a wrong invite, room 5 and three players are all refused.
- **A match:** two fizlet engines play 600 lockstep frames through one room, byte-identical.
- **The caps:** a message flood is closed with `1008` and a 13-byte message with `1009`.
- **Idle:** a silent room lets go after about 3 s; a lone player, whatever it sends, after about 3 s.
- **The invite out of the URL:** `POST /invite`, and the subprotocol invite opens a room with
  `fizlet-rooms` answered.

To play locally, add an invite to the local KV, then run `npm run dev`:

```sh
npx wrangler kv key put --binding INVITES "$(node -e 'import("./src/limits.js").then(async m=>console.log(await m.inviteKey("MY-LOCAL-CODE")))')" local --local
```

Files: `src/limits.js` (caps, invite keys), `src/relay.js` (the room logic, no platform APIs), `src/pass.js` (play passes),
`src/worker.js` (Worker + Durable Object), `wrangler.toml`.

Open: real auth (later), a seat that leaves for good mid-game (the others wait; a game can replace
it with a bot on `LEAVE`), an authoritative room (ENGINE.md §5) for games that need one.
