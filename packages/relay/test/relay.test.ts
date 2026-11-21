// Runs the relay under `wrangler dev` and checks forwarding, routing, and presence with real WebSockets.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { startDevRelay } from "./dev-relay.ts";

let relay: Awaited<ReturnType<typeof startDevRelay>>;
let port: number;
let base: string;

before(async () => {
  relay = await startDevRelay();
  port = relay.port;
  base = relay.url;
});

after(() => relay.stop());

function channelId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

type Received = { text: string[]; binary: Uint8Array[] };

async function connect(id: string, role: "agent" | "library") {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/channels/${id}?role=${role}`);
  socket.binaryType = "arraybuffer";
  const received: Received = { text: [], binary: [] };
  const waiters: Array<() => void> = [];
  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") received.text.push(event.data);
    else received.binary.push(new Uint8Array(event.data as ArrayBuffer));
    for (const wake of waiters.splice(0)) wake();
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  async function until(check: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${JSON.stringify(received.text)}`);
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 100);
      });
    }
  }
  return { socket, received, until };
}

test("rejects unknown paths, roles, and plain HTTP", async () => {
  assert.equal((await fetch(`${base}/v1/channels/short?role=agent`)).status, 404);
  assert.equal((await fetch(`${base}/v1/channels/${channelId()}?role=other`)).status, 400);
  assert.equal((await fetch(`${base}/v1/channels/${channelId()}?role=agent`)).status, 426);
});

test("tells agents whether the library is present", async () => {
  const id = channelId();
  const agent = await connect(id, "agent");
  await agent.until(() => agent.received.text.length === 1);
  assert.deepEqual(JSON.parse(agent.received.text[0]), { type: "peer", present: false });

  const library = await connect(id, "library");
  await agent.until(() => agent.received.text.length === 2);
  assert.deepEqual(JSON.parse(agent.received.text[1]), { type: "peer", present: true });

  library.socket.close();
  await agent.until(() => agent.received.text.length === 3);
  assert.deepEqual(JSON.parse(agent.received.text[2]), { type: "peer", present: false });
  agent.socket.close();
});

test("forwards frames with a connection prefix and routes replies to the right agent", async () => {
  const id = channelId();
  const library = await connect(id, "library");
  const first = await connect(id, "agent");
  const second = await connect(id, "agent");

  first.socket.send(Uint8Array.of(2, 1, 1));
  second.socket.send(Uint8Array.of(2, 2, 2));
  await library.until(() => library.received.binary.length === 2);
  // The two agents' frames can arrive in either order.
  const fromFirst = library.received.binary.find((frame) => frame[9] === 1)!;
  const fromSecond = library.received.binary.find((frame) => frame[9] === 2)!;
  assert.deepEqual([...fromFirst.slice(8)], [2, 1, 1]);
  assert.deepEqual([...fromSecond.slice(8)], [2, 2, 2]);

  library.socket.send(new Uint8Array([...fromSecond.slice(0, 8), 9, 9]));
  await second.until(() => second.received.binary.length === 1);
  assert.deepEqual([...second.received.binary[0]], [9, 9]);
  assert.equal(first.received.binary.length, 0);

  first.socket.close();
  await library.until(() => library.received.text.length === 1);
  assert.deepEqual(JSON.parse(library.received.text[0]), { type: "agent-left", connectionId: Buffer.from(fromFirst.slice(0, 8)).toString("hex") });
  second.socket.close();
  library.socket.close();
});

test("a newer library connection replaces the older one", async () => {
  const id = channelId();
  const agent = await connect(id, "agent");
  const older = await connect(id, "library");
  const closed = new Promise((resolve) => older.socket.addEventListener("close", (event) => resolve(event.code)));
  const newer = await connect(id, "library");
  assert.equal(await closed, 4000);

  agent.socket.send(Uint8Array.of(2, 7));
  await newer.until(() => newer.received.binary.length === 1);
  assert.equal(older.received.binary.length, 0);
  // Replacing the library never reports it absent.
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(!agent.received.text.slice(1).some((text) => JSON.parse(text).present === false));
  agent.socket.close();
  newer.socket.close();
});

test("tells an agent the library is absent when it sends with nobody listening", async () => {
  const agent = await connect(channelId(), "agent");
  await agent.until(() => agent.received.text.length === 1);
  agent.socket.send(Uint8Array.of(2, 0));
  await agent.until(() => agent.received.text.length === 2);
  assert.deepEqual(JSON.parse(agent.received.text[1]), { type: "peer", present: false });
  agent.socket.close();
});
