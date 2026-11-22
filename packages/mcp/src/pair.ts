import {
  channelSocketUrl, createPairingLink, derivePairKey, generateAgentKeyPair, helloFrame, newChannelId, newPairingSecret, newSessionNonce,
  pairConfirmFrame, parseRelayControl, readPairAccept, verifyPairAccept,
} from "../../../src/domain/agent-protocol.ts";
import type { Pairing } from "./config.ts";

const PAIRING_TIMEOUT_MS = 10 * 60 * 1000;

export type PairingAttempt = { link: string; done: Promise<Pairing>; cancel(): void };

/**
 * Opens a fresh channel and waits for the library to accept. The link carries the agent's public key and a
 * secret in its fragment. The relay only sees the channel ID, so it can't complete or impersonate the pairing.
 */
export async function startPairing(options: { relayUrl: string; appOrigin: string; agentName: string }): Promise<PairingAttempt> {
  const keys = await generateAgentKeyPair();
  const secret = newPairingSecret();
  const channelId = newChannelId();
  const link = createPairingLink(options.appOrigin, { relayUrl: options.relayUrl, channelId, agentPublicKey: keys.publicKey, secret, agentName: options.agentName });
  const socket = new WebSocket(channelSocketUrl(options.relayUrl, channelId, "agent"));
  socket.binaryType = "arraybuffer";

  let cancel = () => {};
  const done = new Promise<Pairing>((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Pairing timed out. Ask for a new link.")), PAIRING_TIMEOUT_MS);
    function finish(error: Error | null, pairing?: Pairing) {
      clearTimeout(timer);
      if (error) {
        socket.close();
        reject(error);
      } else resolve(pairing!);
    }
    cancel = () => finish(new Error("Pairing cancelled."));
    socket.addEventListener("error", () => finish(new Error(`Could not reach the Keepall relay at ${options.relayUrl}.`)));
    socket.addEventListener("message", (event) => {
      // The library can only address this connection after hearing from it, so announce on arrival.
      if (typeof event.data === "string") {
        const control = parseRelayControl(event.data);
        if (control?.type === "peer" && control.present) socket.send(helloFrame(newSessionNonce()));
        return;
      }
      void (async () => {
        const accept = readPairAccept(new Uint8Array(event.data as ArrayBuffer));
        if (!accept) return;
        const pairKey = await derivePairKey(keys.privateKey, accept.libraryPublicKey, secret, keys.publicKey, accept.libraryPublicKey);
        // A frame that fails the proof didn't come from the browser that opened the link. Keep waiting.
        if (!await verifyPairAccept(pairKey, accept.proof)) return;
        socket.send(await pairConfirmFrame(pairKey));
        await new Promise((settle) => setTimeout(settle, 200));
        socket.close();
        finish(null, { relayUrl: options.relayUrl, appOrigin: options.appOrigin, channelId, pairKey });
      })().catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))));
    });
  });
  // Callers await `done` only after the socket opens; don't report an early failure twice.
  done.catch(() => {});
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error(`Could not reach the Keepall relay at ${options.relayUrl}.`)), { once: true });
  });
  return { link, done, cancel };
}
