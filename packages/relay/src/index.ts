// Keepall agent relay. Forwards encrypted frames between an agent and a library and never reads them.
// One Durable Object per channel holds both sides' WebSockets with the hibernation API, so an idle
// channel costs no duration. It sets no timers and never waits on the other side.
import { DurableObject } from "cloudflare:workers";

type Env = { CHANNELS: DurableObjectNamespace<Channel> };
type Role = "agent" | "library";
type Attachment = { role: Role; connectionId?: string };

const CHANNEL_PATH = /^\/v1\/channels\/([A-Za-z0-9_-]{43})$/;
const CONNECTION_ID_BYTES = 8;
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_AGENT_CONNECTIONS = 8;
const OPEN = 1;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Keepall relay\n");
    const match = CHANNEL_PATH.exec(url.pathname);
    if (!match) return new Response("Not found\n", { status: 404 });
    const role = url.searchParams.get("role");
    if (role !== "agent" && role !== "library") return new Response("Unknown role\n", { status: 400 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket\n", { status: 426 });
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
  private open(tag: string) {
    return this.ctx.getWebSockets(tag).filter((socket) => socket.readyState === OPEN);
  }

  async fetch(request: Request) {
    const role = new URL(request.url).searchParams.get("role") as Role;
    const [client, server] = Object.values(new WebSocketPair());

    if (role === "library") {
      // One library per channel. A newer connection (a reloaded bridge, the pairing page) replaces the old one.
      for (const old of this.open("library")) old.close(4000, "Replaced by a newer library connection");
      this.ctx.acceptWebSocket(server, ["library"]);
      server.serializeAttachment({ role } satisfies Attachment);
      for (const agent of this.open("agent")) agent.send(peerFrame(true));
    } else {
      if (this.open("agent").length >= MAX_AGENT_CONNECTIONS) return new Response("Too many agent connections\n", { status: 429 });
      const connectionId = toHex(crypto.getRandomValues(new Uint8Array(CONNECTION_ID_BYTES)));
      this.ctx.acceptWebSocket(server, ["agent", `agent:${connectionId}`]);
      server.serializeAttachment({ role, connectionId } satisfies Attachment);
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
    const { role, connectionId } = socket.deserializeAttachment() as Attachment;
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

  async webSocketClose(socket: WebSocket) {
    this.left(socket);
    try {
      socket.close(1000, "Closed");
    } catch {
      // Already closed.
    }
  }

  async webSocketError(socket: WebSocket) {
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
