import {
  channelSocketUrl, createResponseAssembler, createSession, helloFrame, newSessionNonce, parseRelayControl, readHello, requestMessages,
  type AgentSession, type Bytes,
} from "../../../src/domain/agent-protocol.ts";
import type { Pairing } from "./config.ts";

/** Errors name the piece that's missing, since the agent relays them to the user. */
export function offlineMessage(appOrigin: string) {
  return `Paired with Keepall, but no browser is connected to answer. Keepall answers from Chrome through the Keepall Capture extension, or from an open Keepall tab. Check that the extension is installed, enabled, and set to ${appOrigin}, or open ${appOrigin} in Chrome, then try again.`;
}
const HANDSHAKE_TIMEOUT = "A browser is connected but didn't finish the encrypted handshake in time. Reload the Keepall tab or the Keepall Capture extension, then try again.";
const ANSWER_TIMEOUT = "Your browser received the request but didn't answer in time. Try again. If it keeps happening, reload the Keepall tab or the Keepall Capture extension.";

type Pending = { tool: string; args: Record<string, unknown>; resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>; sent: boolean };

/**
 * Talks to the paired library through the relay. Connects on the first call, runs a fresh handshake whenever
 * the library (re)appears, and disconnects after a quiet minute so nothing stays open while the agent is idle.
 */
export class LibraryClient {
  private readonly pairing: Pairing;
  private readonly idleMs: number;
  private readonly timeoutMs: number;
  private readonly offlineGraceMs: number;
  private socket: WebSocket | undefined;
  private connecting: Promise<void> | undefined;
  private session: AgentSession | undefined;
  private assembler = createResponseAssembler();
  private agentNonce: Bytes | undefined;
  private readonly pending = new Map<string, Pending>();
  private inbound: Promise<void> = Promise.resolve();
  private outbound: Promise<void> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private offlineTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the relay last said about the library. Unknown until the relay's first control frame. */
  private libraryPresent: boolean | undefined;

  constructor(pairing: Pairing, options: { idleMs?: number; timeoutMs?: number; offlineGraceMs?: number } = {}) {
    this.pairing = pairing;
    this.idleMs = options.idleMs ?? 60_000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.offlineGraceMs = options.offlineGraceMs ?? 3_000;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    clearTimeout(this.idleTimer);
    await this.connect();
    // Unique across processes and reconnects, so the library can recognize a re-sent change and apply it once.
    const id = crypto.randomUUID();
    // Files take longer to send and save: a second more for every 256 KiB of request.
    const allowance = this.timeoutMs + Math.floor(JSON.stringify(args).length / (256 * 1024)) * 1000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.settle(id, new Error(this.session ? ANSWER_TIMEOUT : this.libraryPresent ? HANDSHAKE_TIMEOUT : offlineMessage(this.pairing.appOrigin))), allowance);
      this.pending.set(id, { tool, args, resolve, reject, timer, sent: false });
      // A reused connection may already know the library is gone. Fail as fast as a fresh one would.
      if (this.libraryPresent === false) this.armOffline();
      this.flush();
    });
  }

  close() {
    clearTimeout(this.idleTimer);
    this.socket?.close();
  }

  private connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    this.connecting ??= new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(channelSocketUrl(this.pairing.relayUrl, this.pairing.channelId, "agent"));
      socket.binaryType = "arraybuffer";
      socket.addEventListener("open", () => {
        this.socket = socket;
        this.connecting = undefined;
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        this.connecting = undefined;
        reject(new Error(`Couldn't reach the Keepall relay at ${this.pairing.relayUrl}. This computer may be offline, or the relay is down.`));
      }, { once: true });
      socket.addEventListener("close", () => this.closed(socket));
      socket.addEventListener("message", (event) => {
        const data = event.data as string | ArrayBuffer;
        this.inbound = this.inbound.then(() => this.receive(socket, data)).catch(() => socket.close(4001, "Bad frame"));
      });
    });
    return this.connecting;
  }

  private async receive(socket: WebSocket, data: string | ArrayBuffer) {
    if (typeof data === "string") {
      const control = parseRelayControl(data);
      if (control?.type !== "peer") return;
      this.session = undefined;
      this.libraryPresent = control.present;
      clearTimeout(this.offlineTimer);
      this.offlineTimer = undefined;
      if (control.present) {
        this.agentNonce = newSessionNonce();
        for (const request of this.pending.values()) request.sent = false;
        socket.send(helloFrame(this.agentNonce));
      } else if (this.pending.size) {
        this.armOffline();
      }
      return;
    }
    const frame = new Uint8Array(data);
    const libraryNonce = readHello(frame);
    if (libraryNonce) {
      if (!this.agentNonce) return;
      this.session = await createSession(this.pairing.pairKey, "agent", this.agentNonce, libraryNonce);
      this.assembler = createResponseAssembler();
      this.flush();
      return;
    }
    if (!this.session) return;
    const response = this.assembler.accept(await this.session.open(frame));
    if (!response) return;
    this.settle(response.id, response.ok ? null : new Error(response.error), response.ok ? response.result : undefined);
  }

  /** Gives a library a moment to (re)connect before failing everything that's waiting. */
  private armOffline() {
    if (this.offlineTimer) return;
    this.offlineTimer = setTimeout(() => {
      this.offlineTimer = undefined;
      for (const id of [...this.pending.keys()]) this.settle(id, new Error(offlineMessage(this.pairing.appOrigin)));
    }, this.offlineGraceMs);
  }

  /** Sends every unsent request in call order. Sealing and sending share one chain so counters stay in order. */
  private flush() {
    const session = this.session;
    const socket = this.socket;
    if (!session || !socket) return;
    for (const [id, request] of this.pending) {
      if (request.sent) continue;
      request.sent = true;
      let messages: ReturnType<typeof requestMessages>;
      try {
        messages = requestMessages({ id, tool: request.tool, args: request.args });
      } catch (error) {
        this.settle(id, error instanceof Error ? error : new Error("This request is too large to send."));
        continue;
      }
      // A large request goes in ordered pieces on this session; the library reassembles it.
      this.outbound = this.outbound.then(async () => {
        for (const message of messages) {
          if (this.session !== session) return;
          socket.send(await session.seal(message));
        }
      });
    }
  }

  private settle(id: string, error: Error | null, result?: unknown) {
    const request = this.pending.get(id);
    if (!request) return;
    clearTimeout(request.timer);
    this.pending.delete(id);
    if (error) request.reject(error);
    else request.resolve(result);
    if (!this.pending.size) {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => this.close(), this.idleMs);
    }
  }

  private closed(socket: WebSocket) {
    if (this.socket !== socket) return;
    this.socket = undefined;
    this.session = undefined;
    this.libraryPresent = undefined;
    clearTimeout(this.offlineTimer);
    this.offlineTimer = undefined;
    for (const id of [...this.pending.keys()]) this.settle(id, new Error("The connection to Keepall closed. Try again."));
    clearTimeout(this.idleTimer);
  }
}
