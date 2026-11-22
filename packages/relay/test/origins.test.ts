// With ALLOWED_ORIGINS set, as in production, only those sites can connect from a browser. Agents send no Origin.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDevRelay } from "./dev-relay.ts";

let relay: Awaited<ReturnType<typeof startDevRelay>>;
const channel = "A".repeat(43);

before(async () => {
  relay = await startDevRelay({ ALLOWED_ORIGINS: "https://www.keepall.app" });
});

after(() => relay.stop());

/** The upgrade's status: 101 when the relay accepts it. fetch can't send an Upgrade header, so this uses node:http. */
function upgrade(origin?: string) {
  return new Promise<number>((resolve, reject) => {
    const request = http.request(`${relay.url}/v1/channels/${channel}?role=library`, {
      headers: { Upgrade: "websocket", Connection: "Upgrade", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", ...(origin ? { Origin: origin } : {}) },
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

test("refuses other sites before reaching a Durable Object", async () => {
  assert.equal(await upgrade("https://evil.example"), 403);
});

test("lets the allowed site and Origin-less agents connect", async () => {
  assert.equal(await upgrade("https://www.keepall.app"), 101);
  const agent = new WebSocket(`${relay.url.replace("http", "ws")}/v1/channels/${channel}?role=agent`);
  await new Promise((resolve, reject) => {
    agent.addEventListener("open", resolve, { once: true });
    agent.addEventListener("error", reject, { once: true });
  });
  agent.close();
});
