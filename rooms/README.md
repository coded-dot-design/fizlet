# fizlet-rooms (demo room server)

A room server for [`fizlet/presence`](../src/presence.ts): a Cloudflare Worker that routes
`/room/<n>` to one Durable Object per numbered room. The room seats players in arrival order,
sends each one `WELCOME` (seat, player count, a shared seed) once it's full, then relays every
`INPUT` and `HASH` message to the other seats, stamping the sender's real seat. It never simulates:
the peers run the same lockstep sim. WebSockets use the hibernation API, so an idle room holds no
running object.

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
| `ALLOWED_ORIGINS` | any | — | Page origins allowed to connect (set it before deploying) |

The rooms store nothing (no Durable Object storage writes); one alarm per room checks the lobby,
idle and lifetime caps. The relay passes on only the first `INPUT` (and `HASH`) a seat sends for a
frame: each seat's frames must rise, so a second, different input for a frame reaches nobody.

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

Files: `src/limits.js` (caps, invite keys), `src/relay.js` (the room logic, no platform APIs),
`src/worker.js` (Worker + Durable Object), `wrangler.toml`.

Open: real auth (later), what happens to a seat that leaves mid-game (today the others wait), an
authoritative room (ENGINE.md §5) for games that need one.
