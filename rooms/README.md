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

No real login yet (planned later). A page asks for an **invite code** and the Worker checks it:

- `GET /invite?code=XXXX` → `200 {"ok":true}` or `403`: the page's "sign in" check.
- `GET /room/<n>?players=2&invite=XXXX` (WebSocket) → the room, or `403` without a listed code.

Codes live in Workers KV (`INVITES`) as `invite:` + SHA-256 of the code (trimmed, upper-cased),
so the list never holds the codes themselves. Codes are made up by the owner and handed out.

## Spend caps (hard limits in code)

`src/limits.js` holds every cap with a default and a ceiling. `[vars]` in `wrangler.toml` can lower
a cap; nothing can lift it past its ceiling.

| Cap | Default | Ceiling | What it bounds |
|---|---|---|---|
| `MAX_ROOMS` | 16 | 256 | Rooms are `/room/0` … `/room/MAX_ROOMS-1`: at most this many Durable Objects |
| `MAX_PLAYERS` | 2 | 8 | Seats per room |
| `MSG_RATE` / `MSG_BURST` | 90 / 180 | 240 / 480 | Messages a second per socket (lockstep at 60 Hz sends ~62); over it, closed `1008` |
| message size | 12 bytes | — | Anything else (text, bigger, smaller) is closed `1009` |
| `IDLE_SECONDS` | 120 | 3600 | A room with no message for this long is closed (`1001 room idle`) |
| `MAX_ROOM_SECONDS` | 1800 | 14400 | Every room closes after this, busy or not |
| `ALLOWED_ORIGINS` | any | — | Page origins allowed to connect (set it before deploying) |

The rooms store nothing (no Durable Object storage writes); one alarm per room checks the idle and
lifetime caps.

## Run and test locally

```sh
npm install
npm test                 # caps, invite keys, relay logic (Node)
(cd .. && npm run build) && npm run test:wrangler
npm run dev              # serve on http://localhost:8787 (local workerd, local KV)
```

`test:wrangler` seeds a test invite into a local KV, starts `wrangler dev --local` with
`IDLE_SECONDS=3` and `MAX_ROOMS=4`, and checks the following:

- **The gate:** no invite, a wrong invite, room 4 and three players are all refused.
- **A match:** two fizlet engines play 600 lockstep frames through one room, byte-identical.
- **The caps:** a message flood is closed with `1008` and a 13-byte message with `1009`.
- **Idle:** a silent room lets go after about 3 s.

To play locally, add an invite to the local KV, then run `npm run dev`:

```sh
npx wrangler kv key put --binding INVITES "$(node -e 'import("./src/limits.js").then(async m=>console.log(await m.inviteKey("MY-LOCAL-CODE")))')" local --local
```

Files: `src/limits.js` (caps, invite keys), `src/relay.js` (the room logic, no platform APIs),
`src/worker.js` (Worker + Durable Object), `wrangler.toml`.

Open: real auth (later), what happens to a seat that leaves mid-game (today the others wait), an
authoritative room (ENGINE.md §5) for games that need one.
