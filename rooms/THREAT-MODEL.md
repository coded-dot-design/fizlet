# fizlet-rooms: threat model

fizlet-rooms is a **demo** room server. Its invite gate keeps strangers out and its caps keep the
bill bounded. It is not a login, and it does not make a match cheat-proof. This page says what it
protects, what it doesn't, and the limits. Code: `src/` here; the client side is
[`fizlet/presence`](../src/presence.ts).

## Who and what

| Actor | Can reach | Wants |
|---|---|---|
| Anyone on the internet | the Worker URL, from any client (not only browsers) | free compute, a way in, guessing codes |
| Invited player | a seat in a room (has a code) | to play; maybe to hog rooms |
| Malicious peer | a seat in *your* room | to win unfairly, to break your match |
| Log reader | Workers Logs in the owner's Cloudflare account | whatever the logs hold |

| Asset | Why it matters |
|---|---|
| Spend | Workers, Durable Objects and KV are billed per request and duration |
| The invite list | codes are the only gate |
| Game integrity | every peer must run the same inputs on the same frames |

## What is protected, and how

| Threat | Mitigation | Where |
|---|---|---|
| Strangers join rooms | An invite code is checked against KV before any room is reached. KV holds `invite:` + SHA-256 of each code, never the code | `worker.js`, `limits.js` `inviteKey` |
| Guessing codes | Codes are 10 to 64 characters (the invite helper makes 15, 8 of them random from 31 symbols). `GATE_RATE` (default 30) invite checks + joins per IP a minute, refused with `429` before the KV read | `limits.js` `CODE_MIN`, `Window` |
| Codes in logs | Codes travel in a `POST /invite` body and a WebSocket subprotocol, not the URL. Invocation logs (which record URLs) are off; the worker logs nothing itself | `worker.js`, `wrangler.toml` |
| Runaway spend | Hard caps in code, each clamped to a ceiling no `[vars]` value can lift: rooms, seats, message rate and burst, 12-byte messages, lobby, idle and lifetime timers, join rates | `limits.js` `CAPS` |
| Join churn into one room | `JOIN_RATE` (default 10) joins per IP a minute per room, counted by the room itself, refused before a socket is accepted | `worker.js` `Room.fetch` |
| Holding a room open alone | A room not full `LOBBY_SECONDS` (default 90) after its first seat closes. Only relayed messages and seats taken count as activity: refused messages and "room full" joiners don't extend it | `limits.js` `roomClock` |
| Speaking for another seat | The relay stamps each message with the sender's real seat | `relay.js` |
| Two different inputs for one frame | First write wins, twice: the relay passes on only a seat's first `INPUT` / `HASH` per frame (frames must rise), and presence keeps the first it receives | `relay.js`, `presence.ts` |
| Fake room messages | Only `INPUT` and `HASH` are relayed; `WELCOME`, `LEAVE`, `RESUME` and `AWAY` come from the room only. `START` is taken from seat 0 before the start, and never relayed | `relay.js` |
| Taking someone else's seat on a reconnect | A resume needs the seat's token: 32 random bits per seat, drawn at the start, sent only to that seat in `WELCOME`, offered back as a subprotocol (never a URL), and behind the invite gate, `GATE_RATE` and `JOIN_RATE` (10 guesses a minute per IP per room against 2^32). A wrong or expired token is closed `4002` and never takes a fresh seat. Tokens die with the hold (`RESUME_SECONDS`) or a leave | `relay.js` `slotOf`, `worker.js` `Room.fetch` |
| One Wi-Fi blip ending a match | A drop (1006, a restart code, an error) holds the seat for `RESUME_SECONDS` (default 20) and the others hear `AWAY`; the token gets it back with `RESUME` and the inputs it missed (the room's last 64 per seat, plus every peer's resend), so lockstep continues. A half-open old socket is closed `4001` without a `LEAVE`. A clean close or a kick is still a leave | `relay.js`, `worker.js`, `presence.ts` `join` |
| A room forgetting its clock or seats in hibernation | Seats, tokens, holds and the time of the last relayed message (saved at most once a second) ride in the sockets' attachments, so a woken room keeps its idle clock and its holds. A seat that leaves or drops clears its attachment, so it is never re-seated as a ghost after a wake | `worker.js` `Room` |
| Huge request bodies | `POST /invite` is read with a stream reader that stops at 257 bytes, chunked or not (no `content-length`); a longer body is no code (`403`) and the rest is never read; with passes on (`REQUIRE_PASS`) 1,025 bytes, room for a pass and a device key; `POST /pass/revoke` 601 | `limits.js` `bodyText` |
| A play pass copied from its public issue comment | The pass locks to the first device key that joins (`dev`, default 1) and expires after 1 hour; another device is refused `403`. Closing the issue revokes it (`POST /pass/revoke`, admin key) | `pass.js` `PassBook`, `verifyPass` |
| Forged or edited passes | HMAC-SHA256 over the payload with `PASS_SECRET` (a Worker secret), checked with WebCrypto in constant time; `exp`, `dev` and the lifetime are capped per kind (play/family 30 days, 3 devices; owner a year, 5) | `pass.js` `verifyPass`, `PASS_LIMITS` |
| Passes on, secret missing | Every join is refused `503`; nothing falls back to "open" | `pass.js` `passGate` |
| Oversized or text messages | Closed with `1009`; a flood over the rate is closed with `1008` | `worker.js` |

## What is not protected (the limits)

- **Every request to the Worker is billed before its code runs.** The rate caps bound the KV reads
  and Durable Object requests a client causes, not the Worker requests themselves. A flood of
  requests is answered by Cloudflare's own DDoS protection and the owner's billing alerts
  ([DEPLOY.md](DEPLOY.md) step 0). On a custom domain, a WAF rate-limiting rule can stop it earlier.
- **`GATE_RATE` is counted per Worker isolate, not globally.** Cloudflare runs many isolates, so one
  client spread across them gets more than 30 a minute. It is free and stops a single client
  hammering; it is not a global quota. `JOIN_RATE` is exact per room (one object per room).
- **The origin allowlist stops browsers only.** Any other client can send any `Origin`. The invite is
  the gate.
- **A code is a shared secret.** Whoever holds one is in, from anywhere, until the owner deletes its
  key from KV. Hand codes out one per person so one can be revoked.
- **An invited player can still hog rooms**, one seat per room, by rejoining after each lobby
  timeout. `JOIN_RATE` slows it; revoking the code ends it.
- **A malicious peer can still**:
  - stall the match by not sending (lockstep waits, it never guesses);
  - play its own seat however it likes (its inputs are its own);
  - report a false state hash, which shows as a desync on the honest peers.

  It can't move another player, run a frame with two different inputs, or send room messages.
- **Room numbers are guessable.** Anyone with a code can take an open seat in any room.
- **The relay forgets frames when a room hibernates** (no message for a while, e.g. every tab
  paused): which frames each seat sent, and the last 64 inputs a resume replays. After it wakes,
  presence's own first-input-wins still holds, and the peers' resends on `RESUME` carry the inputs.
- **A held seat stalls the others** for up to `RESUME_SECONDS` (lockstep waits); after that they
  hear `LEAVE` and still wait (the game decides: a bot, or end the match). A room where every seat
  dropped at once and then hibernated forgets its holds (no socket carries them): those players get
  `4002` and start a new room.
- **Locally (`wrangler dev`) a refused chunked `POST /invite` may end in a `500` or a reset** from
  wrangler's dev proxy, because the worker answers before the body is sent; nothing is buffered
  (the workerd RSS step is +3 MB for 96 MiB, was +193 MB).
- **Matches are not private.** Traffic is TLS (`wss://`) to Cloudflare; the room server sees every
  input. Presence trusts the room server.
- **IP addresses** are read for counting only, kept in memory for at most a minute's window, and
  never stored or logged by the worker.
- **Codes sent in URLs before this release** may be in Workers Logs for their retention period.
  Rotate them after deploying this release ([DEPLOY.md](DEPLOY.md)).

- **A play pass is posted in a public issue comment.** Anyone can read it. The mitigation is the
  device lock plus the 1-hour expiry: the requester's device takes the one seat when it first joins;
  until then, whoever joins first with it holds it (the requester then asks again, and closing the
  issue revokes it). A pass used on no device simply expires.
- **The device key is a bearer secret.** It is made by the page and kept in its storage; anyone who
  copies both the pass and that device's key can join as that device until the pass expires.
- **Family and owner passes last longer** (30 days, a year) and are delivered privately by the owner,
  never posted. A leaked one is revoked by id (`POST /pass/revoke`).
- **`PASS_SECRET` mints passes.** Whoever holds it can make any pass; it lives only in the Worker's
  secrets and the Blitz repo's Actions secrets. Rotating it voids every pass.
- **The revoked list and device locks live in one Durable Object**, so every pass join costs one
  extra Durable Object request (after the rate caps). Its entries are deleted when their pass expires.

## The spend ceiling

At most `MAX_ROOMS × MAX_PLAYERS` sockets, each sending at most `MSG_RATE` messages a second (plus a
`MSG_BURST`). Every message is relayed to the other `MAX_PLAYERS − 1` seats. Every room closes
after `MAX_ROOM_SECONDS`. With the deployed `[vars]` (16 rooms, 4 players, 90 a second), that is at
most 5,760 messages a second received across all rooms. A resume sends the returning seat at most
`64 × (MAX_PLAYERS − 1)` replayed inputs (192 with 4 players), and resumes count against
`JOIN_RATE`. No price is quoted here: read it from the billing alerts.

## Not yet

- Real auth (accounts, Keycloak) replaces the invite gate after the demo stage.
- A seat that leaves for good mid-match: the others wait (a game can put a bot in its place).
- An authoritative room for games that need one.
