# fizlet-rooms (prototype)

A room server for [`fizlet/presence`](../src/presence.ts): a Cloudflare Worker that routes
`/room/<name>?players=N` to one Durable Object per room. The room seats players in arrival order,
sends each one `WELCOME` (seat, player count, a shared seed) once it's full, then relays every
`INPUT` and `HASH` message to the other seats, stamping the sender's real seat. It never simulates:
the peers run the same lockstep sim. WebSockets use the hibernation API, so an idle room holds no
running object.

Its own package: it is not a dependency of `fizlet` and is not published. **Not deployed**: no
Cloudflare account is configured.

```sh
npm install
npm test                          # relay logic (Node)
(cd .. && npm run build) && npm run test:wrangler   # two fizlet clients through `wrangler dev --local`
npm run dev                       # serve on http://localhost:8787 (local workerd)
```

`test:wrangler` starts `wrangler dev --local`, joins one room with two engines over real
WebSockets, runs 600 lockstep frames (`FRAMES=3000` for more) and checks the state is
byte-identical frame by frame.

Files: `src/relay.js` (the room logic, no platform APIs), `src/worker.js` (Worker + Durable
Object), `wrangler.toml`.

Open: auth and room tokens, rate limits per seat, what happens to a seat that leaves mid-game
(today the others wait), an authoritative room (ENGINE.md §5) for games that need one.
