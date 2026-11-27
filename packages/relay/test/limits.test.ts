// The relay's per-address budgets, from wrangler.jsonc: 600 frames and 60 new connections a minute.
// Tests share one address, so the frame test runs first and the connection test spends what's left.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDevRelay } from "./dev-relay.ts";

let relay: Awaited<ReturnType<typeof startDevRelay>>;

before(async () => {
  relay = await startDevRelay();
});

after(() => relay.stop());

function channelId() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function connect(id: string, role: "agent" | "library") {
  const socket = new WebSocket(`ws://127.0.0.1:${relay.port}/v1/channels/${id}?role=${role}`);
  socket.binaryType = "arraybuffer";
  return new Promise<WebSocket>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

/** The upgrade's status: 101 when the relay accepts it. */
function upgrade() {
  return new Promise<number>((resolve, reject) => {
    const request = http.request(`${relay.url}/v1/channels/${channelId()}?role=agent`, {
      headers: { Upgrade: "websocket", Connection: "Upgrade", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==" },
    });
    request.on("upgrade", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode ?? 0);
    });
    request.on("response", (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on("error", reject);
    request.end();
  });
}

test("forwards a burst the size of a large file, then closes a socket that keeps flooding", async () => {
  const id = channelId();
  const library = await connect(id, "library");
  let forwarded = 0;
  library.addEventListener("message", (event) => { if (typeof event.data !== "string") forwarded += 1; });
  const agent = await connect(id, "agent");
  const closed = new Promise<number>((resolve) => agent.addEventListener("close", (event) => resolve(event.code)));

  // A 100 MB file is up to 320 frames, sent back to back.
  for (let frame = 0; frame < 320; frame += 1) agent.send(Uint8Array.of(2, 0));
  const deadline = Date.now() + 5000;
  while (forwarded < 320 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(forwarded, 320);
  assert.equal(agent.readyState, WebSocket.OPEN);

  for (let frame = 0; frame < 600 && agent.readyState === WebSocket.OPEN; frame += 1) {
    agent.send(Uint8Array.of(2, 0));
    if (frame % 50 === 0) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const timedOut = new Promise<string>((resolve) => setTimeout(() => resolve("still open"), 5000));
  assert.equal(await Promise.race([closed, timedOut]), 1008);
  library.close();
});

test("refuses new connections from an address that opens too many", async () => {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 62; attempt += 1) statuses.push(await upgrade());
  assert.ok(statuses.includes(101));
  assert.equal(statuses.at(-1), 429);
});
