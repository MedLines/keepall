import { channelSocketUrl, createLibraryEndpoint } from "@/domain/agent-protocol";
import { AgentToolError } from "@/domain/agent-tools";
import { AGENT_PAIRINGS_CHANNEL, listAgentPairings, touchAgentPairing, type AgentPairing } from "@/persistence/agent-pairings";
import { runAgentTool } from "@/persistence/agent-tools";

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
const TOUCH_INTERVAL_MS = 60_000;
const HOST_LOCK = "keepall-agent-host";

/**
 * Hosts paired agents from whichever context gets the lock first: the extension's hidden bridge or an open
 * Keepall tab. Only one context per browser profile holds the relay connections; when it goes away, the next
 * one waiting takes over.
 */
export function hostAgents(): () => void {
  if (typeof navigator.locks === "undefined") return startAgentHost();
  const controller = new AbortController();
  navigator.locks.request(HOST_LOCK, { signal: controller.signal }, () => new Promise<void>((release) => {
    if (controller.signal.aborted) return release();
    const stop = startAgentHost();
    controller.signal.addEventListener("abort", () => {
      stop();
      release();
    }, { once: true });
  })).catch(() => {
    // Aborted while waiting for the lock.
  });
  return () => controller.abort();
}

/**
 * Keeps one relay connection per paired agent while it runs. The connection sends nothing while
 * idle, so the relay's Durable Object can hibernate. Frames are decrypted here, inside the app's origin; the
 * extension and the relay only ever carry ciphertext.
 */
export function startAgentHost(): () => void {
  let stopped = false;
  const connections = new Map<string, { close(): void }>();
  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(AGENT_PAIRINGS_CHANNEL);

  function connect(pairing: AgentPairing) {
    let socket: WebSocket | undefined;
    let retryMs = RETRY_MIN_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTouch = 0;
    let closed = false;

    async function handle(tool: string, args: Record<string, unknown>, requestId: string) {
      if (Date.now() - lastTouch > TOUCH_INTERVAL_MS) {
        lastTouch = Date.now();
        void touchAgentPairing(pairing.id).catch(() => {});
      }
      try {
        return await runAgentTool(tool, args, { appOrigin: location.origin, pairingId: pairing.id, requestId });
      } catch (error) {
        throw error instanceof AgentToolError ? error : new Error("Keepall couldn't complete this request. Try again.");
      }
    }

    function open() {
      if (closed) return;
      const current = new WebSocket(channelSocketUrl(pairing.relayUrl, pairing.id, "library"));
      current.binaryType = "arraybuffer";
      socket = current;
      const endpoint = createLibraryEndpoint(pairing.pairKey, handle, (frame) => {
        if (current.readyState === WebSocket.OPEN) current.send(frame);
      });
      let inbound = Promise.resolve();
      current.addEventListener("open", () => { retryMs = RETRY_MIN_MS; });
      current.addEventListener("message", (event: MessageEvent<string | ArrayBuffer>) => {
        const data = typeof event.data === "string" ? event.data : new Uint8Array(event.data);
        inbound = inbound.then(() => endpoint.receive(data)).catch(() => {});
      });
      current.addEventListener("close", (event) => {
        if (socket !== current || closed) return;
        // 4000: another library connection (another tab or the pairing page) took over this channel.
        const delay = event.code === 4000 ? RETRY_MAX_MS : retryMs;
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
        retryTimer = setTimeout(open, delay);
      });
    }

    open();
    return {
      close() {
        closed = true;
        clearTimeout(retryTimer);
        socket?.close(1000, "Library host stopped");
      },
    };
  }

  async function sync() {
    const pairings = await listAgentPairings().catch(() => []);
    if (stopped) return;
    const wanted = new Set(pairings.map((pairing) => pairing.id));
    for (const [id, connection] of connections) {
      if (wanted.has(id)) continue;
      connection.close();
      connections.delete(id);
    }
    for (const pairing of pairings) {
      if (!connections.has(pairing.id)) connections.set(pairing.id, connect(pairing));
    }
  }

  channel?.addEventListener("message", () => void sync());
  void sync();
  return () => {
    stopped = true;
    channel?.close();
    for (const connection of connections.values()) connection.close();
    connections.clear();
  };
}
