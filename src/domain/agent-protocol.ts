// Agent access wire protocol. Shared by the browser library host and the Node `@keepall/mcp` package,
// so it uses only WebCrypto and erasable TypeScript, with no imports. See docs/agent-access-plan.md.

export const AGENT_PROTOCOL_VERSION = 1;

/** Peer-to-peer frame kinds, carried in the first byte. The relay never reads past the connection prefix. */
export const FRAME_HELLO = 1;
export const FRAME_SEALED = 2;
export const FRAME_PAIR_ACCEPT = 3;
export const FRAME_PAIR_CONFIRM = 4;

/** The relay prefixes frames to and from the library with the agent connection they belong to. */
export const CONNECTION_ID_BYTES = 8;
const KEY_BYTES = 32;
const SECRET_BYTES = 16;
const NONCE_BYTES = 16;
const PROOF_BYTES = 32;
const COUNTER_BYTES = 8;
const MAX_AGENT_NAME = 60;

export type Bytes = Uint8Array<ArrayBuffer>;
export type AgentRole = "agent" | "library";

export type PairingLink = {
  relayUrl: string;
  channelId: string;
  agentPublicKey: Bytes;
  secret: Bytes;
  agentName: string;
};

/** Text control frames the relay sends. Agents hear about the library; the library hears about agents leaving. */
export type RelayControl = { type: "peer"; present: boolean } | { type: "agent-left"; connectionId: string };

export type AgentRequest = { id: string; tool: string; args: Record<string, unknown> };
export type AgentResponse = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };
/** One piece of a response too large for a single relay frame. Pieces arrive in order on one session. */
export type AgentResponseChunk = { id: string; chunk: number; chunks: number; data: string };

/** Keeps each sealed frame well under the relay's 1 MiB limit. */
export const RESPONSE_CHUNK_CHARACTERS = 512 * 1024;
const MAX_RESPONSE_CHUNKS = 64;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function concatBytes(...parts: Uint8Array[]): Bytes {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string, expectedLength?: number): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("Invalid base64url text");
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  if (expectedLength !== undefined && bytes.byteLength !== expectedLength) throw new Error("Unexpected byte length");
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function fromHex(text: string, expectedLength: number): Bytes {
  if (text.length !== expectedLength * 2 || !/^[0-9a-f]+$/.test(text)) throw new Error("Invalid hex text");
  return Uint8Array.from({ length: expectedLength }, (_, index) => parseInt(text.slice(index * 2, index * 2 + 2), 16));
}

export function newChannelId(): string {
  return toBase64Url(randomBytes(KEY_BYTES));
}

export function isChannelId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function newPairingSecret(): Bytes {
  return randomBytes(SECRET_BYTES);
}

/** WebSocket address of one side of a channel. */
export function channelSocketUrl(relayUrl: string, channelId: string, role: AgentRole): string {
  const url = new URL(`/v1/channels/${channelId}`, relayUrl);
  url.protocol = url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";
  url.searchParams.set("role", role);
  return url.href;
}

function isRelayUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    return url.protocol === "https:" || url.protocol === "wss:" ||
      ((url.protocol === "http:" || url.protocol === "ws:") && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

/** The key and secret ride in the fragment, which browsers never send to a server. */
export function createPairingLink(appOrigin: string, link: PairingLink): string {
  const params = new URLSearchParams({
    v: String(AGENT_PROTOCOL_VERSION),
    relay: link.relayUrl,
    c: link.channelId,
    k: toBase64Url(link.agentPublicKey),
    s: toBase64Url(link.secret),
    n: link.agentName.slice(0, MAX_AGENT_NAME),
  });
  return `${new URL("/connect", appOrigin).href}#${params}`;
}

export function parsePairingFragment(hash: string): PairingLink | null {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const relayUrl = params.get("relay") ?? "";
    const channelId = params.get("c");
    if (params.get("v") !== String(AGENT_PROTOCOL_VERSION) || !isRelayUrl(relayUrl) || !isChannelId(channelId)) return null;
    const agentName = (params.get("n") ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_AGENT_NAME) || "An agent";
    return {
      relayUrl,
      channelId,
      agentPublicKey: fromBase64Url(params.get("k") ?? "", KEY_BYTES),
      secret: fromBase64Url(params.get("s") ?? "", SECRET_BYTES),
      agentName,
    };
  } catch {
    return null;
  }
}

export async function generateAgentKeyPair(): Promise<{ privateKey: CryptoKey; publicKey: Bytes }> {
  const pair = await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)) };
}

async function hkdf(ikm: Bytes, salt: Bytes, info: string, length: number): Promise<Bytes> {
  const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(info) }, base, length * 8);
  return new Uint8Array(bits);
}

async function hmac(key: Bytes, label: string): Promise<Bytes> {
  const hmacKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(label)));
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

/**
 * The long-term key for one pairing. Both public keys are bound into it, and the pairing secret
 * is mixed in, so a relay that swaps in its own public key can't produce matching proofs.
 */
export async function derivePairKey(privateKey: CryptoKey, peerPublicKey: Bytes, secret: Bytes, agentPublicKey: Bytes, libraryPublicKey: Bytes): Promise<Bytes> {
  const peer = await crypto.subtle.importKey("raw", peerPublicKey, { name: "X25519" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer }, privateKey, 256));
  return hkdf(shared, secret, `keepall-agent-pair-v1:${toBase64Url(agentPublicKey)}:${toBase64Url(libraryPublicKey)}`, KEY_BYTES);
}

export async function pairAcceptFrame(pairKey: Bytes, libraryPublicKey: Bytes): Promise<Bytes> {
  return concatBytes(Uint8Array.of(FRAME_PAIR_ACCEPT), libraryPublicKey, await hmac(pairKey, "keepall-pair-accept"));
}

export function readPairAccept(frame: Uint8Array): { libraryPublicKey: Bytes; proof: Bytes } | null {
  if (frame[0] !== FRAME_PAIR_ACCEPT || frame.byteLength !== 1 + KEY_BYTES + PROOF_BYTES) return null;
  return { libraryPublicKey: frame.slice(1, 1 + KEY_BYTES), proof: frame.slice(1 + KEY_BYTES) };
}

export async function verifyPairAccept(pairKey: Bytes, proof: Uint8Array): Promise<boolean> {
  return sameBytes(proof, await hmac(pairKey, "keepall-pair-accept"));
}

export async function pairConfirmFrame(pairKey: Bytes): Promise<Bytes> {
  return concatBytes(Uint8Array.of(FRAME_PAIR_CONFIRM), await hmac(pairKey, "keepall-pair-confirm"));
}

export async function verifyPairConfirm(pairKey: Bytes, frame: Uint8Array): Promise<boolean> {
  return frame[0] === FRAME_PAIR_CONFIRM && frame.byteLength === 1 + PROOF_BYTES &&
    sameBytes(frame.slice(1), await hmac(pairKey, "keepall-pair-confirm"));
}

export function helloFrame(nonce: Bytes): Bytes {
  return concatBytes(Uint8Array.of(FRAME_HELLO), nonce);
}

export function readHello(frame: Uint8Array): Bytes | null {
  return frame[0] === FRAME_HELLO && frame.byteLength === 1 + NONCE_BYTES ? frame.slice(1) : null;
}

export function newSessionNonce(): Bytes {
  return randomBytes(NONCE_BYTES);
}

export type AgentSession = {
  seal(message: unknown): Promise<Bytes>;
  /** Rejects forged, replayed, reordered, or truncated frames. */
  open(frame: Uint8Array): Promise<unknown>;
};

/**
 * Fresh keys for each connection. Both sides contribute a nonce, so frames from an earlier connection
 * never decrypt in a later one, and each direction's counter can start at zero without reusing an IV.
 */
export async function createSession(pairKey: Bytes, role: AgentRole, agentNonce: Bytes, libraryNonce: Bytes): Promise<AgentSession> {
  const material = await hkdf(pairKey, concatBytes(agentNonce, libraryNonce), "keepall-agent-session-v1", KEY_BYTES * 2);
  const importKey = (bytes: Bytes) => crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  const [agentToLibrary, libraryToAgent] = await Promise.all([importKey(material.slice(0, KEY_BYTES)), importKey(material.slice(KEY_BYTES))]);
  const sendKey = role === "agent" ? agentToLibrary : libraryToAgent;
  const receiveKey = role === "agent" ? libraryToAgent : agentToLibrary;
  const sendDirection = role === "agent" ? 0 : 1;
  let sent = 0;
  let received = 0;

  function iv(counter: number) {
    const bytes = new Uint8Array(12);
    new DataView(bytes.buffer).setBigUint64(4, BigInt(counter));
    return bytes;
  }

  return {
    async seal(message) {
      const counter = sent;
      sent += 1;
      const header = new Uint8Array(1 + COUNTER_BYTES);
      header[0] = FRAME_SEALED;
      new DataView(header.buffer).setBigUint64(1, BigInt(counter));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv(counter), additionalData: Uint8Array.of(FRAME_SEALED, sendDirection) },
        sendKey, encoder.encode(JSON.stringify(message)),
      );
      return concatBytes(header, new Uint8Array(ciphertext));
    },
    async open(frame) {
      if (frame[0] !== FRAME_SEALED || frame.byteLength < 1 + COUNTER_BYTES + 16) throw new Error("Not a sealed frame");
      const counter = Number(new DataView(frame.buffer, frame.byteOffset + 1, COUNTER_BYTES).getBigUint64(0));
      if (counter !== received) throw new Error("Out-of-order frame");
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv(counter), additionalData: Uint8Array.of(FRAME_SEALED, 1 - sendDirection) },
        receiveKey, frame.slice(1 + COUNTER_BYTES),
      );
      received += 1;
      return JSON.parse(decoder.decode(plaintext));
    },
  };
}

/** The library's half of pairing: a fresh key pair, the shared pair key, and the frame that proves it. */
export async function acceptPairing(link: PairingLink): Promise<{ pairKey: Bytes; acceptFrame: Bytes }> {
  const library = await generateAgentKeyPair();
  const pairKey = await derivePairKey(library.privateKey, link.agentPublicKey, link.secret, link.agentPublicKey, library.publicKey);
  return { pairKey, acceptFrame: await pairAcceptFrame(pairKey, library.publicKey) };
}

/** `requestId` is the agent's ID for this call. It stays the same when the agent re-sends after a reconnect. */
export type ToolHandler = (tool: string, args: Record<string, unknown>, requestId: string) => Promise<unknown>;

export type LibraryEndpoint = {
  /** Feed every relay message in arrival order. */
  receive(data: string | Uint8Array): Promise<void>;
};

/**
 * The library's side of a paired channel. Each agent connection gets its own session, keyed by the
 * relay's connection prefix. `send` gets complete frames, prefix included.
 */
export function createLibraryEndpoint(pairKey: Bytes, handle: ToolHandler, send: (frame: Bytes) => void): LibraryEndpoint {
  type Connection = { session: AgentSession; outbound: Promise<void> };
  const connections = new Map<string, Connection>();

  function reply(prefix: Bytes, connection: Connection, response: AgentResponse) {
    connection.outbound = connection.outbound.then(async () => {
      for (const message of responseMessages(response)) {
        if (connections.get(toHex(prefix)) !== connection) return;
        send(concatBytes(prefix, await connection.session.seal(message)));
      }
    }).catch(() => {});
  }

  return {
    async receive(data) {
      if (typeof data === "string") {
        const control = parseRelayControl(data);
        if (control?.type === "agent-left") connections.delete(control.connectionId);
        return;
      }
      const split = splitConnectionFrame(data);
      if (!split) return;
      const { prefix, frame } = split;
      const key = toHex(prefix);
      const agentNonce = readHello(frame);
      if (agentNonce) {
        const libraryNonce = newSessionNonce();
        connections.set(key, { session: await createSession(pairKey, "library", agentNonce, libraryNonce), outbound: Promise.resolve() });
        send(concatBytes(prefix, helloFrame(libraryNonce)));
        return;
      }
      const connection = connections.get(key);
      if (!connection) return;
      let request: unknown;
      try {
        request = await connection.session.open(frame);
      } catch {
        // A forged or out-of-order frame ends this connection's session. The agent re-handshakes on its next connection.
        connections.delete(key);
        return;
      }
      if (!isAgentRequest(request)) return;
      void handle(request.tool, request.args, request.id).then(
        (result) => reply(prefix, connection, { id: request.id, ok: true, result }),
        (error: unknown) => reply(prefix, connection, { id: request.id, ok: false, error: error instanceof Error ? error.message : "Keepall could not complete this request." }),
      );
    },
  };
}

/** Frames the library receives start with the relay's connection prefix. Replies must start with the same prefix. */
export function splitConnectionFrame(data: Uint8Array): { prefix: Bytes; frame: Bytes } | null {
  if (data.byteLength <= CONNECTION_ID_BYTES) return null;
  return { prefix: data.slice(0, CONNECTION_ID_BYTES), frame: data.slice(CONNECTION_ID_BYTES) };
}

/** The messages that carry one response: itself when small, otherwise ordered chunks of its JSON. */
export function responseMessages(response: AgentResponse, chunkCharacters = RESPONSE_CHUNK_CHARACTERS): Array<AgentResponse | AgentResponseChunk> {
  const body = JSON.stringify(response);
  if (body.length <= chunkCharacters) return [response];
  const chunks = Math.ceil(body.length / chunkCharacters);
  if (chunks > MAX_RESPONSE_CHUNKS) {
    return [{ id: response.id, ok: false, error: "This answer is too large to send. Ask for fewer images or items." }];
  }
  return Array.from({ length: chunks }, (_, chunk) => ({ id: response.id, chunk, chunks, data: body.slice(chunk * chunkCharacters, (chunk + 1) * chunkCharacters) }));
}

function isResponseChunk(value: unknown): value is AgentResponseChunk {
  if (!value || typeof value !== "object") return false;
  const chunk = value as Record<string, unknown>;
  return typeof chunk.id === "string" && Number.isInteger(chunk.chunk) && Number.isInteger(chunk.chunks) && typeof chunk.data === "string" &&
    (chunk.chunks as number) > 1 && (chunk.chunks as number) <= MAX_RESPONSE_CHUNKS && (chunk.chunk as number) >= 0 && (chunk.chunk as number) < (chunk.chunks as number);
}

/** Rebuilds chunked responses. `accept` returns a complete response, or null while one is still arriving. */
export function createResponseAssembler() {
  const partial = new Map<string, string[]>();
  return {
    accept(message: unknown): AgentResponse | null {
      if (isAgentResponse(message)) return message;
      if (!isResponseChunk(message)) return null;
      const parts = partial.get(message.id) ?? [];
      // Chunks of one response arrive in order on one session; anything else starts over.
      if (message.chunk !== parts.length) {
        partial.delete(message.id);
        return null;
      }
      parts.push(message.data);
      if (parts.length < message.chunks) {
        partial.set(message.id, parts);
        return null;
      }
      partial.delete(message.id);
      const response: unknown = JSON.parse(parts.join(""));
      return isAgentResponse(response) && response.id === message.id ? response : null;
    },
    forget(id: string) {
      partial.delete(id);
    },
  };
}

export function parseRelayControl(text: string): RelayControl | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (value.type === "peer" && typeof value.present === "boolean") return { type: "peer", present: value.present };
    if (value.type === "agent-left" && typeof value.connectionId === "string") return { type: "agent-left", connectionId: value.connectionId };
  } catch {
    // Not a control frame.
  }
  return null;
}

export function isAgentRequest(value: unknown): value is AgentRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return typeof request.id === "string" && request.id.length <= 100 && typeof request.tool === "string" && request.tool.length <= 100 &&
    !!request.args && typeof request.args === "object" && !Array.isArray(request.args);
}

export function isAgentResponse(value: unknown): value is AgentResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return typeof response.id === "string" && (response.ok === true || (response.ok === false && typeof response.error === "string"));
}
