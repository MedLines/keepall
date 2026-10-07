import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { expect, test, vi } from "vitest";
import { fetchPublicArticlePage, resolveArticleAddress } from "./article-http";

const { resolveDns, httpRequest, httpsRequest } = vi.hoisted(() => ({ resolveDns: vi.fn(), httpRequest: vi.fn(), httpsRequest: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: resolveDns, default: { lookup: resolveDns } }));
vi.mock("node:http", () => ({ request: httpRequest, default: { request: httpRequest } }));
vi.mock("node:https", () => ({ request: httpsRequest, default: { request: httpsRequest } }));

test.each([
  "http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/", "http://[::1]/", "http://[0:0:0:0:0:0:0:1]/",
  "http://[::ffff:7f00:1]/", "http://[::ffff:192.168.0.1]/", "http://[fd00::1]/", "http://[2001::1]/", "http://[2001:db8::1]/", "http://192.0.2.1/", "http://[fe80::1]/", "https://user:secret@example.com/", "http://localhost./",
])("rejects private or credentialed target %s before requesting", async raw => {
  httpRequest.mockClear(); httpsRequest.mockClear();
  await expect(fetchPublicArticlePage(raw, new AbortController().signal)).rejects.toThrow();
  expect(httpRequest).not.toHaveBeenCalled();
  expect(httpsRequest).not.toHaveBeenCalled();
});

test("rejects mixed public/private DNS answers", async () => {
  const dns = vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }]);
  await expect(resolveArticleAddress("https://rebind.example", dns)).rejects.toThrow(/blocked/);
  expect(dns).toHaveBeenCalledWith("rebind.example", { all: true });
});

test("pins request lookup to the approved address, disables family autoselection and removes DNS abort listener", async () => {
  resolveDns.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  const request = Object.assign(new EventEmitter(), { end: vi.fn() });
  httpsRequest.mockImplementation((_url, options, onResponse) => {
    const lookupResult = vi.fn();
    options.lookup("example.com", { all: false }, lookupResult);
    expect(lookupResult).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(options).toMatchObject({ autoSelectFamily: false, agent: false, method: "GET" });
    const response = Object.assign(Readable.from([Buffer.from("captured page")]), { statusCode: 200, headers: { "content-type": "text/html" } });
    onResponse(response);
    return request;
  });
  const signal = new AbortController().signal;
  const removed = vi.spyOn(signal, "removeEventListener");
  const response = await fetchPublicArticlePage("https://example.com/story", signal);
  expect(await response.text()).toBe("captured page");
  expect(resolveDns).toHaveBeenCalledTimes(1);
  expect(request.end).toHaveBeenCalledTimes(1);
  expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
});

test("a stalled DNS lookup aborts with the global capture signal", async () => {
  resolveDns.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const pending = fetchPublicArticlePage("https://slow.example", controller.signal);
  controller.abort(new Error("Capture timed out"));
  await expect(pending).rejects.toThrow("Capture timed out");
});
