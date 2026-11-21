import { describe, expect, it } from "vitest";
import {
  channelSocketUrl, concatBytes, createLibraryEndpoint, createPairingLink, createResponseAssembler, formatSetupCode, newSetupCode, parseSetupCode,
  responseMessages, setupCodePairKey, createSession, derivePairKey, generateAgentKeyPair, helloFrame, newChannelId,
  newPairingSecret, newSessionNonce, pairAcceptFrame, pairConfirmFrame, parsePairingFragment, readHello, readPairAccept,
  verifyPairAccept, verifyPairConfirm,
} from "./agent-protocol";

async function pair() {
  const agent = await generateAgentKeyPair();
  const library = await generateAgentKeyPair();
  const secret = newPairingSecret();
  const agentKey = await derivePairKey(agent.privateKey, library.publicKey, secret, agent.publicKey, library.publicKey);
  const libraryKey = await derivePairKey(library.privateKey, agent.publicKey, secret, agent.publicKey, library.publicKey);
  return { agent, library, secret, agentKey, libraryKey };
}

describe("pairing link", () => {
  it("round-trips through the fragment", async () => {
    const { agent, secret } = await pair();
    const channelId = newChannelId();
    const link = createPairingLink("https://www.keepall.app", { relayUrl: "https://relay.example", channelId, agentPublicKey: agent.publicKey, secret, agentName: "Claude Code" });
    const url = new URL(link);
    expect(url.pathname).toBe("/connect");
    expect(url.search).toBe("");
    expect(parsePairingFragment(url.hash)).toEqual({ relayUrl: "https://relay.example", channelId, agentPublicKey: agent.publicKey, secret, agentName: "Claude Code" });
  });

  it("rejects plain-http relays outside localhost and malformed keys", async () => {
    const { agent, secret } = await pair();
    const base = { channelId: newChannelId(), agentPublicKey: agent.publicKey, secret, agentName: "x" };
    expect(parsePairingFragment(new URL(createPairingLink("http://localhost:3000", { ...base, relayUrl: "http://evil.example" })).hash)).toBeNull();
    expect(parsePairingFragment(new URL(createPairingLink("http://localhost:3000", { ...base, relayUrl: "http://localhost:8787" })).hash)).not.toBeNull();
    expect(parsePairingFragment("#v=1&relay=https%3A%2F%2Fr.example&c=short&k=a&s=b")).toBeNull();
  });

  it("builds WebSocket addresses for each side", () => {
    const id = newChannelId();
    expect(channelSocketUrl("https://relay.example", id, "agent")).toBe(`wss://relay.example/v1/channels/${id}?role=agent`);
    expect(channelSocketUrl("http://localhost:8787", id, "library")).toBe(`ws://localhost:8787/v1/channels/${id}?role=library`);
  });
});

describe("pair key", () => {
  it("matches on both sides and proves itself in both directions", async () => {
    const { library, agentKey, libraryKey } = await pair();
    expect(agentKey).toEqual(libraryKey);
    const accept = readPairAccept(await pairAcceptFrame(libraryKey, library.publicKey));
    expect(accept?.libraryPublicKey).toEqual(library.publicKey);
    expect(await verifyPairAccept(agentKey, accept!.proof)).toBe(true);
    expect(await verifyPairConfirm(libraryKey, await pairConfirmFrame(agentKey))).toBe(true);
  });

  it("fails when a relay swaps in its own public key without the pairing secret", async () => {
    const { agent, library, secret, libraryKey } = await pair();
    const relay = await generateAgentKeyPair();
    // The relay sees the agent's public key but never the fragment's secret.
    const relayKey = await derivePairKey(relay.privateKey, agent.publicKey, newPairingSecret(), agent.publicKey, relay.publicKey);
    const forged = readPairAccept(await pairAcceptFrame(relayKey, relay.publicKey))!;
    const agentView = await derivePairKey(agent.privateKey, forged.libraryPublicKey, secret, agent.publicKey, forged.libraryPublicKey);
    expect(await verifyPairAccept(agentView, forged.proof)).toBe(false);
    expect(await verifyPairConfirm(libraryKey, await pairConfirmFrame(relayKey))).toBe(false);
    expect(library.publicKey).not.toEqual(relay.publicKey);
  });
});

describe("session", () => {
  async function sessions() {
    const { agentKey, libraryKey } = await pair();
    const agentNonce = readHello(helloFrame(newSessionNonce()))!;
    const libraryNonce = newSessionNonce();
    return {
      agent: await createSession(agentKey, "agent", agentNonce, libraryNonce),
      library: await createSession(libraryKey, "library", agentNonce, libraryNonce),
    };
  }

  it("carries messages both ways in order", async () => {
    const { agent, library } = await sessions();
    expect(await library.open(await agent.seal({ id: "1", tool: "search_items", args: { query: "a" } }))).toEqual({ id: "1", tool: "search_items", args: { query: "a" } });
    expect(await library.open(await agent.seal({ n: 2 }))).toEqual({ n: 2 });
    expect(await agent.open(await library.seal({ id: "1", ok: true, result: [] }))).toEqual({ id: "1", ok: true, result: [] });
  });

  it("rejects replayed, reordered, reflected, and tampered frames", async () => {
    const { agent, library } = await sessions();
    const first = await agent.seal({ n: 1 });
    const second = await agent.seal({ n: 2 });
    await expect(library.open(second)).rejects.toThrow("Out-of-order");
    await library.open(first);
    await expect(library.open(first)).rejects.toThrow("Out-of-order");
    const tampered = second.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(library.open(tampered)).rejects.toThrow();
    // A frame the agent sealed can't be bounced back to the agent as if the library sent it.
    await expect(agent.open(await agent.seal({ n: 3 }))).rejects.toThrow();
  });

  it("never opens a frame from an earlier connection", async () => {
    const { agentKey, libraryKey } = await pair();
    const nonce = newSessionNonce();
    const old = await createSession(agentKey, "agent", nonce, newSessionNonce());
    const current = await createSession(libraryKey, "library", nonce, newSessionNonce());
    await expect(current.open(await old.seal({ n: 1 }))).rejects.toThrow();
  });
});

describe("library endpoint", () => {
  it("answers each agent connection on its own session and drops a session after a bad frame", async () => {
    const { agentKey, libraryKey } = await pair();
    const sent: Uint8Array[] = [];
    const endpoint = createLibraryEndpoint(libraryKey, async (tool, args) => {
      if (args.fail) throw new Error("nope");
      return { tool, echo: args.q };
    }, (frame) => sent.push(frame));
    const prefixA = Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1);
    const prefixB = Uint8Array.of(2, 2, 2, 2, 2, 2, 2, 2);

    async function connectAgent(prefix: Uint8Array) {
      const nonce = newSessionNonce();
      await endpoint.receive(concatBytes(prefix, helloFrame(nonce)));
      const reply = sent.pop()!;
      expect(reply.slice(0, 8)).toEqual(prefix);
      return createSession(agentKey, "agent", nonce, readHello(reply.slice(8))!);
    }

    async function ask(prefix: Uint8Array, session: Awaited<ReturnType<typeof connectAgent>>, request: unknown) {
      await endpoint.receive(concatBytes(prefix, await session.seal(request)));
      for (let attempt = 0; attempt < 50 && !sent.length; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
      const reply = sent.pop()!;
      expect(reply.slice(0, 8)).toEqual(prefix);
      return session.open(reply.slice(8));
    }

    const a = await connectAgent(prefixA);
    const b = await connectAgent(prefixB);
    expect(await ask(prefixA, a, { id: "1", tool: "search_items", args: { q: "x" } })).toEqual({ id: "1", ok: true, result: { tool: "search_items", echo: "x" } });
    expect(await ask(prefixB, b, { id: "1", tool: "search_items", args: { fail: true } })).toEqual({ id: "1", ok: false, error: "nope" });

    await endpoint.receive(concatBytes(prefixA, Uint8Array.of(2, 0, 0, 0, 0, 0, 0, 0, 9, ...new Uint8Array(16))));
    await endpoint.receive(concatBytes(prefixA, await a.seal({ id: "2", tool: "search_items", args: {} })));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);

    await endpoint.receive(`{"type":"agent-left","connectionId":"0202020202020202"}`);
    await endpoint.receive(concatBytes(prefixB, await b.seal({ id: "2", tool: "search_items", args: {} })));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
  });
});

describe("large responses", () => {
  it("split into ordered chunks and come back whole", () => {
    const response = { id: "7", ok: true as const, result: { data: "x".repeat(25) } };
    const messages = responseMessages(response, 10);
    expect(messages.length).toBeGreaterThan(1);
    const assembler = createResponseAssembler();
    const results = messages.map((message) => assembler.accept(message));
    expect(results.slice(0, -1).every((result) => result === null)).toBe(true);
    expect(results.at(-1)).toEqual(response);
    expect(responseMessages(response)).toEqual([response]);
  });

  it("drop a response whose chunks arrive out of order", () => {
    const messages = responseMessages({ id: "8", ok: true, result: "y".repeat(40) }, 10);
    const assembler = createResponseAssembler();
    // Chunk 1 goes missing: everything after it is discarded rather than stitched together wrongly.
    for (const message of [messages[0], ...messages.slice(2)]) expect(assembler.accept(message)).toBeNull();
  });

  it("replace a response too large to send with an error", () => {
    expect(responseMessages({ id: "9", ok: true, result: "z".repeat(1000) }, 10)).toEqual([
      { id: "9", ok: false, error: "This answer is too large to send. Ask for fewer images or items." },
    ]);
  });
});

describe("setup codes", () => {
  it("round-trip and give both sides the same pair key", async () => {
    const code = newSetupCode("http://localhost:8787", "http://localhost:3001/settings");
    const text = formatSetupCode(code);
    expect(text).toMatch(/^keepall_[A-Za-z0-9_-]+$/);
    const parsed = parseSetupCode(` ${text}\n`)!;
    expect(parsed).toEqual({ ...code, appOrigin: "http://localhost:3001" });
    expect(await setupCodePairKey(parsed)).toEqual(await setupCodePairKey(code));
  });

  it("rejects anything that isn't a valid code", () => {
    expect(parseSetupCode("keepall_nope")).toBeNull();
    expect(parseSetupCode("sk-something")).toBeNull();
    const bad = newSetupCode("http://evil.example", "https://www.keepall.app");
    expect(parseSetupCode(formatSetupCode(bad))).toBeNull();
  });
});
