import {
  channelSocketUrl, createSession, helloFrame, isAgentResponse, newSessionNonce, parseRelayControl, readHello,
  type AgentSession, type Bytes,
} from "../../../src/domain/agent-protocol.ts";
import type { Pairing } from "./config.ts";

export const OFFLINE_MESSAGE = "Keepall isn't reachable. Open Chrome with the Keepall extension, then try again.";

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
  private agentNonce: Bytes | undefined;
  private readonly pending = new Map<string, Pending>();
  private inbound: Promise<void> = Promise.resolve();
  private outbound: Promise<void> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private offlineTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 0;

  constructor(pairing: Pairing, options: { idleMs?: number; timeoutMs?: number; offlineGraceMs?: number } = {}) {
    this.pairing = pairing;
    this.idleMs = options.idleMs ?? 60_000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.offlineGraceMs = options.offlineGraceMs ?? 3_000;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    clearTimeout(this.idleTimer);
    await this.connect();
    const id = String((this.nextId += 1));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.settle(id, new Error("Keepall didn't answer in time. Check that Chrome is open, then try again.")), this.timeoutMs);
      this.pending.set(id, { tool, args, resolve, reject, timer, sent: false });
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
        reject(new Error(`Could not reach the Keepall relay at ${this.pairing.relayUrl}.`));
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
      clearTimeout(this.offlineTimer);
      if (control.present) {
        this.agentNonce = newSessionNonce();
        for (const request of this.pending.values()) request.sent = false;
        socket.send(helloFrame(this.agentNonce));
      } else {
        this.offlineTimer = setTimeout(() => {
          for (const id of [...this.pending.keys()]) this.settle(id, new Error(OFFLINE_MESSAGE));
        }, this.offlineGraceMs);
      }
      return;
    }
    const frame = new Uint8Array(data);
    const libraryNonce = readHello(frame);
    if (libraryNonce) {
      if (!this.agentNonce) return;
      this.session = await createSession(this.pairing.pairKey, "agent", this.agentNonce, libraryNonce);
      this.flush();
      return;
    }
    if (!this.session) return;
    const response = await this.session.open(frame);
    if (!isAgentResponse(response)) return;
    this.settle(response.id, response.ok ? null : new Error(response.error), response.ok ? response.result : undefined);
  }

  /** Sends every unsent request in call order. Sealing and sending share one chain so counters stay in order. */
  private flush() {
    const session = this.session;
    const socket = this.socket;
    if (!session || !socket) return;
    for (const [id, request] of this.pending) {
      if (request.sent) continue;
      request.sent = true;
      this.outbound = this.outbound.then(async () => {
        if (this.session === session) socket.send(await session.seal({ id, tool: request.tool, args: request.args }));
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
    clearTimeout(this.offlineTimer);
    for (const id of [...this.pending.keys()]) this.settle(id, new Error("The connection to Keepall closed. Try again."));
    clearTimeout(this.idleTimer);
  }
}
