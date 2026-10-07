import { beforeEach, expect, test, vi } from "vitest";
import { getContactStoreConfig, reserveContactMessage, recordContactDelivery } from "./contact-store";

vi.mock("server-only", () => ({}));
const query = vi.hoisted(() => vi.fn());
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query }) }));
const config = { databaseUrl: "postgresql://user:password@db.example/test", hashSecret: "a".repeat(64) };
const fields = { name: "Ada", email: "ada@example.com", topic: "help" as const, message: "Help with export", browser: "hidden browser", steps: "hidden steps", expected: "hidden", actual: "hidden", website: "" };
const identity = { ipKey: `ip:${"a".repeat(64)}`, emailKey: `email:${"b".repeat(64)}` };
beforeEach(() => { query.mockReset(); vi.unstubAllEnvs(); });

test.each(["", "https://db.example", "postgresql://db.example/test", "postgresql://user:pass@db.example/"])("invalid database configuration cannot enable contact: %s", value => {
  vi.stubEnv("DATABASE_URL", value);
  vi.stubEnv("CONTACT_RATE_LIMIT_SECRET", config.hashSecret);
  expect(getContactStoreConfig()).toBeNull();
});
test("requires a private secret and accepts a valid database URL", () => {
  vi.stubEnv("DATABASE_URL", config.databaseUrl);
  vi.stubEnv("CONTACT_RATE_LIMIT_SECRET", "too-short");
  expect(getContactStoreConfig()).toBeNull();
  vi.stubEnv("CONTACT_RATE_LIMIT_SECRET", config.hashSecret);
  expect(getContactStoreConfig()).toEqual(config);
});
test("reserves parameterized fields without the honeypot or hidden bug details", async () => {
  query.mockResolvedValue([{ allowed: true, retry_after: 0 }]);
  const reservation = await reserveContactMessage(fields, identity, config);
  expect(reservation.allowed).toBe(true);
  const [sql, params, options] = query.mock.calls[0];
  expect(sql).toContain("reserve_contact_message($1::uuid, $2::text, $3::text, $4::jsonb)");
  expect(sql).not.toContain(fields.email);
  expect(params.slice(1, 3)).toEqual([identity.ipKey, identity.emailKey]);
  expect(JSON.parse(params[3])).toEqual({ ...fields, website: undefined, browser: "", steps: "", expected: "", actual: "" });
  expect(JSON.parse(params[3])).not.toHaveProperty("website");
  expect(options.fetchOptions.signal).toBeInstanceOf(AbortSignal);
});
test.each([{ result: [] }, { result: [{ allowed: false, retry_after: 0 }] }, { result: [{ allowed: false, retry_after: 3601 }] }])("invalid quota responses fail closed", async ({ result }) => {
  query.mockResolvedValue(result);
  await expect(reserveContactMessage(fields, identity, config)).rejects.toThrow("Contact reservation failed");
});
test("allowed retry response is propagated", async () => {
  query.mockResolvedValue([{ allowed: false, retry_after: 60 }]);
  expect(await reserveContactMessage(fields, identity, config)).toEqual({ allowed: false, retryAfter: 60 });
});
test("status update records provider acceptance and removes only inactive limiter state", async () => {
  query.mockResolvedValue([{ id: "record-id" }]);
  await recordContactDelivery("record-id", "accepted", "provider-id", config);
  expect(query.mock.calls[0][0]).toContain("DELETE FROM public.contact_rate_limits");
  expect(query.mock.calls[0][0]).not.toContain("DELETE FROM public.contact_messages");
  expect(query.mock.calls[0][1]).toEqual(["record-id", "accepted", "provider-id"]);
});
