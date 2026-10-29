// fizlet-rooms: one Durable Object per room name, WebSockets with hibernation (an idle room holds
// no running object). GET /room/<name>?players=2 with `Upgrade: websocket`. Prototype: no auth.
import { DurableObject } from "cloudflare:workers";
import { Relay } from "./relay.js";

export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/room\/([\w-]{1,64})$/);
    if (!m) return new Response("fizlet rooms: connect a WebSocket to /room/<name>?players=2\n", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected a WebSocket upgrade\n", { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.relay = null;
    // Waking from hibernation: rebuild the seats from the sockets' attachments.
    for (const ws of ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      this.relay ??= Object.assign(new Relay(a.players, a.seed), { started: a.started });
      this.relay.seat(ws, a.slot);
    }
  }
  async fetch(req) {
    const players = Math.min(8, Math.max(1, Number(new URL(req.url).searchParams.get("players")) || 2));
    if (!this.relay || !this.relay.seats.some(Boolean)) this.relay = new Relay(players, crypto.getRandomValues(new Uint32Array(1))[0]);
    const r = this.relay;
    if (r.players !== players) return new Response("this room has a different player count\n", { status: 409 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    if (r.join(server) < 0) server.close(4000, "room full");
    // Every seated socket carries the room's state, so a hibernated room wakes up whole.
    for (const ws of this.ctx.getWebSockets()) {
      const s = r.seats.indexOf(ws);
      if (s >= 0) ws.serializeAttachment({ slot: s, players: r.players, seed: r.seed, started: r.started });
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, data) {
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s >= 0) this.relay.message(s, data);
  }
  webSocketClose(ws) {
    const s = this.relay?.seats.indexOf(ws) ?? -1;
    if (s >= 0) this.relay.leave(s);
  }
  webSocketError(ws) {
    this.webSocketClose(ws);
  }
}
