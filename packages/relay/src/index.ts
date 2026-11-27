// Keepall agent relay. Forwards encrypted frames between an agent and a library and never reads them.
// One Durable Object per channel holds both sides' WebSockets with the hibernation API, so an idle
// channel costs no duration. It sets no timers and never waits on the other side.
import { DurableObject } from "cloudflare:workers";

type Env = {
  CHANNELS: DurableObjectNamespace<Channel>;
  /**
   * Comma-separated site origins allowed to connect from a browser, such as "https://www.keepall.app". Agents run
   * outside browsers and send no Origin, so they're unaffected. Unset (local development) allows every origin.
   */
  ALLOWED_ORIGINS?: string;
  /** New connections per IP address. Unset in tests that don't configure it. */
  CONNECTION_LIMIT?: RateLimit;
  /** Frames per IP address, across every channel that address has open. */
  MESSAGE_LIMIT?: RateLimit;
};
type Role = "agent" | "library";
type Attachment = { role: Role; connectionId?: string; ip: string };

const CHANNEL_PATH = /^\/v1\/channels\/([A-Za-z0-9_-]{43})$/;
const CONNECTION_ID_BYTES = 8;
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_AGENT_CONNECTIONS = 8;
const OPEN = 1;
/** Frames counted locally before the IP's budget is checked, so forwarding never waits on the limiter. */
const MESSAGE_BATCH = 20;
/** 1008: policy violation. Agents report the closed connection; libraries reconnect with backoff. */
const TOO_MANY_MESSAGES = 1008;

/** The caller's address as Cloudflare saw it. Local development has none, so everything shares one budget. */
function clientIp(request: Request) {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Keepall relay\n");
    const match = CHANNEL_PATH.exec(url.pathname);
    if (!match) return new Response("Not found\n", { status: 404 });
    const role = url.searchParams.get("role");
    if (role !== "agent" && role !== "library") return new Response("Unknown role\n", { status: 400 });
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
    // Checked before any Durable Object is touched, so other sites can't spend the relay's daily quota.
    if (origin && allowed?.length && !allowed.includes(origin)) return new Response("Origin not allowed\n", { status: 403 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket\n", { status: 426 });
    // Also before the Durable Object, so one address can't open channels faster than people do.
    if (env.CONNECTION_LIMIT && !(await env.CONNECTION_LIMIT.limit({ key: clientIp(request) })).success) {
      return new Response("Too many connections. Try again in a minute.\n", { status: 429, headers: { "Retry-After": "60" } });
    }
    return env.CHANNELS.get(env.CHANNELS.idFromName(match[1])).fetch(request);
  },
} satisfies ExportedHandler<Env>;

function peerFrame(present: boolean) {
  return JSON.stringify({ type: "peer", present });
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(text: string) {
  return Uint8Array.from({ length: text.length / 2 }, (_, index) => parseInt(text.slice(index * 2, index * 2 + 2), 16));
}

export class Channel extends DurableObject<Env> {
  /** Frames each socket sent since its last budget check. Lost when the object hibernates, which only forgives a partial batch. */
  private unchecked = new Map<WebSocket, number>();

  private open(tag: string) {
    return this.ctx.getWebSockets(tag).filter((socket) => socket.readyState === OPEN);
  }

  async fetch(request: Request) {
    const role = new URL(request.url).searchParams.get("role") as Role;
    const ip = clientIp(request);
    const [client, server] = Object.values(new WebSocketPair());

    if (role === "library") {
      // One library per channel. A newer connection (a reloaded bridge, the pairing page) replaces the old one.
      for (const old of this.open("library")) old.close(4000, "Replaced by a newer library connection");
      this.ctx.acceptWebSocket(server, ["library"]);
      server.serializeAttachment({ role, ip } satisfies Attachment);
      for (const agent of this.open("agent")) agent.send(peerFrame(true));
    } else {
      if (this.open("agent").length >= MAX_AGENT_CONNECTIONS) return new Response("Too many agent connections\n", { status: 429 });
      const connectionId = toHex(crypto.getRandomValues(new Uint8Array(CONNECTION_ID_BYTES)));
      this.ctx.acceptWebSocket(server, ["agent", `agent:${connectionId}`]);
      server.serializeAttachment({ role, connectionId, ip } satisfies Attachment);
      server.send(peerFrame(this.open("library").length > 0));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    // Peers only send binary frames. Text is reserved for the relay's own control frames.
    if (typeof message === "string") return;
    if (message.byteLength > MAX_FRAME_BYTES) {
      socket.close(1009, "Frame too large");
      return;
    }
    const { role, connectionId, ip } = socket.deserializeAttachment() as Attachment;
    // Sockets accepted before the limits shipped have no address recorded.
    this.count(socket, ip ?? "local");
    if (role === "agent") {
      const library = this.open("library")[0];
      if (!library) {
        socket.send(peerFrame(false));
        return;
      }
      const frame = new Uint8Array(CONNECTION_ID_BYTES + message.byteLength);
      frame.set(fromHex(connectionId!));
      frame.set(new Uint8Array(message), CONNECTION_ID_BYTES);
      library.send(frame);
      return;
    }
    if (message.byteLength <= CONNECTION_ID_BYTES) return;
    const target = toHex(new Uint8Array(message, 0, CONNECTION_ID_BYTES));
    this.open(`agent:${target}`)[0]?.send(message.slice(CONNECTION_ID_BYTES));
  }

  /**
   * Checks the IP's frame budget once per batch without holding up forwarding, which must stay in order.
   * Over budget closes this socket; frames already forwarded stay delivered.
   */
  private count(socket: WebSocket, ip: string) {
    const limiter = this.env.MESSAGE_LIMIT;
    if (!limiter) return;
    const sent = (this.unchecked.get(socket) ?? 0) + 1;
    if (sent < MESSAGE_BATCH) {
      this.unchecked.set(socket, sent);
      return;
    }
    this.unchecked.set(socket, 0);
    this.ctx.waitUntil(limiter.limit({ key: ip, delta: MESSAGE_BATCH }).then(({ success }) => {
      if (success || socket.readyState !== OPEN) return;
      this.unchecked.delete(socket);
      socket.close(TOO_MANY_MESSAGES, "Too many messages");
    }));
  }

  async webSocketClose(socket: WebSocket) {
    this.unchecked.delete(socket);
    this.left(socket);
    try {
      socket.close(1000, "Closed");
    } catch {
      // Already closed.
    }
  }

  async webSocketError(socket: WebSocket) {
    this.unchecked.delete(socket);
    this.left(socket);
  }

  private left(socket: WebSocket) {
    const { role, connectionId } = socket.deserializeAttachment() as Attachment;
    if (role === "agent") {
      for (const library of this.open("library")) library.send(JSON.stringify({ type: "agent-left", connectionId }));
      return;
    }
    const present = this.open("library").some((library) => library !== socket);
    for (const agent of this.open("agent")) agent.send(peerFrame(present));
  }
}
