import { beforeEach, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/contact/route";

vi.mock("server-only", () => ({}));

const input = { name: "Ada", email: "ada@example.com", topic: "bug", message: "Cannot export my backup", browser: "Firefox on Linux", steps: "Open Settings", expected: "A downloaded file", actual: "An error", website: "" };
const transport = vi.fn();

function request(body: unknown = input, origin = "https://keepall.app") {
  return new Request("https://keepall.app/api/contact", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal("fetch", transport);
  transport.mockReset();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("CONTACT_FROM_EMAIL", "contact@example.com");
  vi.stubEnv("CONTACT_TO_EMAIL", "support@example.com");
});

test("missing configuration reports unavailable and never calls mail transport", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  expect(await (await GET()).json()).toEqual({ available: false });
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(transport).not.toHaveBeenCalled();
});

test("availability reads configuration at request time", async () => {
  expect(await (await GET()).json()).toEqual({ available: true });
  vi.stubEnv("CONTACT_TO_EMAIL", "");
  expect(await (await GET()).json()).toEqual({ available: false });
});

test("invalid recipient configuration cannot enable email", async () => {
  vi.stubEnv("CONTACT_TO_EMAIL", "support@example.com,other@example.com");
  expect(await (await GET()).json()).toEqual({ available: false });
  expect((await POST(request())).status).toBe(503);
  expect(transport).not.toHaveBeenCalled();
});

test("valid submission uses fixed recipient, reply-to and plain text", async () => {
  transport.mockResolvedValue(Response.json({ id: "resend-id" }));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ accepted: true });
  const [url, options] = transport.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(options.headers.Authorization).toBe("Bearer test-key");
  const mail = JSON.parse(options.body);
  expect(mail).toMatchObject({ from: "contact@example.com", to: ["support@example.com"], reply_to: "ada@example.com", subject: "Keepall contact: Bug report" });
  expect(mail).not.toHaveProperty("html");
  for (const value of [input.name, input.email, input.message, input.browser, input.steps, input.expected, input.actual]) expect(mail.text).toContain(value);
});

test.each([
  { ...input, email: "ada@example.com\r\nBcc: victim@example.com" },
  { ...input, name: 23 },
  { ...input, message: " " },
  { ...input, topic: "invalid" },
  { ...input, message: "a".repeat(5001) },
  { ...input, to: "victim@example.com" },
  { ...input, website: "spam.example" },
])("rejects invalid and spam input without mail transport", async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(transport).not.toHaveBeenCalled();
});

test.each(["https://elsewhere.example", "null", "", "https://keepall.app.attacker.example"])('rejects origin "%s"', async origin => {
  expect((await POST(request(input, origin))).status).toBe(403);
  expect(transport).not.toHaveBeenCalled();
});

test("bounds streamed request body without relying on content length", async () => {
  const response = await POST(request({ ...input, message: "a".repeat(40000) }));
  expect(response.status).toBe(413);
  expect(transport).not.toHaveBeenCalled();
});

test("malformed JSON is rejected without transport", async () => {
  const malformed = new Request("https://keepall.app/api/contact", { method: "POST", headers: { origin: "https://keepall.app", "content-type": "application/json" }, body: "{" });
  expect((await POST(malformed)).status).toBe(400);
  expect(transport).not.toHaveBeenCalled();
});

test("non-JSON content is rejected without transport", async () => {
  const form = request();
  form.headers.set("content-type", "text/plain");
  expect((await POST(form)).status).toBe(415);
  expect(transport).not.toHaveBeenCalled();
});

test("hidden bug details are excluded when the visitor changes topic", async () => {
  transport.mockResolvedValue(Response.json({ id: "resend-id" }));
  expect((await POST(request({ ...input, topic: "help" }))).status).toBe(200);
  expect(JSON.parse(transport.mock.calls[0][1].body).text).not.toContain(input.browser);
});

test("does not expose provider errors or claim success after rejection", async () => {
  transport.mockResolvedValue(Response.json({ message: "private provider detail test-key" }, { status: 429 }));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("test-key");
});

test("provider success without an email id is not accepted", async () => {
  transport.mockResolvedValue(Response.json({}));
  expect((await POST(request())).status).toBe(502);
});

test("transport timeout uses an abort signal and returns a safe failure", async () => {
  transport.mockImplementation((_url, options) => {
    expect(options.signal).toBeInstanceOf(AbortSignal);
    throw new DOMException("Aborted", "TimeoutError");
  });
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty("accepted");
});
