# Deploying fizlet-rooms (owner steps)

Nothing here runs from CI. Every step is the account owner's, with a token the owner made. No
token, account id or invite code goes in any file.

## 0. Before anything is deployed

1. **Billing alerts.** In the Cloudflare dashboard, go to **Notifications** and add a
   **Usage Based Billing** notification for Workers and Durable Objects, plus a budget alert.
   - Workers + Durable Objects need the Workers Paid plan.
   - The caps in `src/limits.js` bound how much a room can do. A billing alert tells you what the
     account is doing.
2. **A deploy token.** Under **My Profile → API Tokens → Create Token → Custom token**, scoped to
   this one account:

   | Scope | Permission | Why |
   |---|---|---|
   | Account | Workers Scripts: **Edit** | deploy the Worker and its Durable Object class |
   | Account | Workers KV Storage: **Edit** | create the `INVITES` namespace and put invite hashes in it |
   | Account | Account Settings: **Read** | wrangler reads the account it deploys to |
   | Zone (only with a custom domain) | Workers Routes: **Edit** | attach the Worker to `rooms.<your domain>` |

   - Newer accounts may name the first permission "Workers Editor".
   - Not confirmed yet: whether the first Durable Object migration needs more than Workers Scripts
     Edit. Try this token first, and if the deploy is refused, read the error before widening it.
   - Give the token an expiry and IP filtering if you can.
   - Store it as an environment secret (`CLOUDFLARE_API_TOKEN`), with `CLOUDFLARE_ACCOUNT_ID` beside
     it. Never put either in a file.

## 1. The invite list

```sh
npx wrangler kv namespace create INVITES        # prints an id: put it in wrangler.toml (not a secret)
# Pick codes (10–64 characters) and turn them into keys with inviteKey() from src/limits.js:
node --input-type=module -e 'import { inviteKey } from "./src/limits.js"; console.log(JSON.stringify(await Promise.all(process.argv.slice(1).map(async (c) => ({ key: await inviteKey(c), value: "invite" })))))' CODE-ONE CODE-TWO > invites.json
npx wrangler kv bulk put --binding INVITES invites.json --remote   # [{ "key": "invite:<sha256>", "value": "<label>" }]
rm invites.json                                  # the hashes are safe; don't keep the codes next to them
```

Hand the codes out by message. To revoke one, delete its key:
`npx wrangler kv key delete --binding INVITES invite:<sha256> --remote`.

## 2. Caps and origins

In `wrangler.toml` `[vars]`:
- set `ALLOWED_ORIGINS` to the page origins that host the game, e.g. `https://battlefield.example`;
- keep or lower the caps (they can't go past the ceilings in `src/limits.js`), including the
  lobby timeout, the per-IP rates and the resume hold (`LOBBY_SECONDS`, `GATE_RATE`, `JOIN_RATE`,
  `RESUME_SECONDS`).

What the gate and the caps do and don't protect: [THREAT-MODEL.md](THREAT-MODEL.md).

## 3. Deploy

```sh
npx wrangler deploy --dry-run    # check the bundle and bindings first
npx wrangler deploy              # → https://fizlet-rooms.<account>.workers.dev
```

Smoke check (the code goes in the body, never the URL):

```sh
curl -s -X POST --data 'NOT-A-REAL-CODE' -H 'origin: <an ALLOWED_ORIGINS entry>' \
  https://fizlet-rooms.<account>.workers.dev/invite        # → {"ok":false} (403)
```

**Rotate codes that travelled in URLs.** Before invocation logs were turned off, `?code=` and
`?invite=` URLs were kept in Workers Logs. After deploying a release with
`invocation_logs = false`, add new codes as in step 1, hand them out, then delete each old key:
`npx wrangler kv key delete --binding INVITES invite:<sha256> --remote`. Pages
must send codes by `POST /invite` and the WebSocket subprotocol; the URL forms are accepted for one
more release only.

Then open `examples/two-player.html` from Blitz with
`?rooms=wss://fizlet-rooms.<account>.workers.dev` on two devices and play.

## 4. Turning it off

`npx wrangler delete` removes the Worker and its rooms. Revoking the token stops further deploys.
