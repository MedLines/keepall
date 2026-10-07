import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";

// This script truncates test tables. Refuse hosted databases or other database names.
const url = new URL(process.env.TEST_CONTACT_DATABASE_URL ?? "postgresql://invalid/");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/keepall_contact_test") {
  throw new Error("Set TEST_CONTACT_DATABASE_URL to a local, disposable keepall_contact_test database.");
}
const pool = new pg.Pool({ connectionString: url.href, max: 20 });
const key = (kind, value) => `${kind}:${createHash("sha256").update(value).digest("hex")}`;
const reserve = async (ip = "network", email = "email", id = randomUUID()) => (await pool.query(
  "SELECT * FROM public.reserve_contact_message($1, $2, $3, $4)",
  [id, key("ip", ip), key("email", email), JSON.stringify({ message: "Local test only" })],
)).rows[0];
const reset = () => pool.query("TRUNCATE public.contact_messages, public.contact_rate_limits");
const count = async () => Number((await pool.query("SELECT count(*) FROM public.contact_messages")).rows[0].count);
try {
  await pool.query(await readFile(new URL("../db/contact.sql", import.meta.url), "utf8"));
  await reset();
  for (let i = 0; i < 3; i++) assert.equal((await reserve()).allowed, true);
  const denied = await reserve();
  assert.equal(denied.allowed, false);
  assert.ok(denied.retry_after > 3590 && denied.retry_after <= 3600);
  assert.equal(await count(), 3);
  assert.equal((await reserve("new-network")).allowed, false);
  assert.equal((await reserve("network", "new-email")).allowed, false);
  assert.equal(Number((await pool.query("SELECT count(*) FROM public.contact_rate_limits")).rows[0].count), 2);
  console.log("PASS three-per-hour quotas, both identities, denied requests create no records or buckets");

  for (const mode of ["both", "network", "email"]) {
    await reset();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(mode === "email" ? `ip-${i}` : "network", mode === "network" ? `email-${i}` : "email")));
    assert.equal(results.filter(result => result.allowed).length, 3);
    assert.equal(await count(), 3);
    const buckets = (await pool.query("SELECT cardinality(events) AS size FROM public.contact_rate_limits")).rows;
    assert.ok(buckets.every(bucket => bucket.size <= 3));
    console.log(`PASS 20 concurrent requests sharing ${mode}: exactly three records`);
  }

  await reset();
  for (let i = 0; i < 3; i++) await reserve();
  await pool.query("UPDATE public.contact_rate_limits SET events = ARRAY[clock_timestamp() - interval '59 minutes', clock_timestamp() - interval '49 minutes', clock_timestamp() - interval '39 minutes']");
  const rolling = await reserve();
  assert.equal(rolling.allowed, false);
  assert.ok(rolling.retry_after >= 58 && rolling.retry_after <= 60);
  await pool.query("UPDATE public.contact_rate_limits SET events[1] = clock_timestamp() - interval '61 minutes'");
  assert.equal((await reserve()).allowed, true);
  assert.equal((await reserve()).allowed, false);
  console.log("PASS rolling-hour expiry and Retry-After based on oldest active request");

  await reset();
  const id = randomUUID();
  await reserve("first", "first", id);
  await assert.rejects(reserve("second", "second", id), /duplicate key/);
  assert.equal(Number((await pool.query("SELECT count(*) FROM public.contact_rate_limits")).rows[0].count), 2);
  assert.equal(await count(), 1);
  console.log("PASS failed record insert rolls back both quota reservations");

  await reset();
  for (let i = 0; i < 3; i++) await reserve();
  await pool.query("DELETE FROM public.contact_messages");
  assert.equal((await reserve()).allowed, false);
  console.log("PASS manually deleting support records does not reset quotas");

  await reset();
  await reserve();
  await pool.query("UPDATE public.contact_messages SET created_at = clock_timestamp() - interval '1 year'");
  await pool.query("INSERT INTO public.contact_rate_limits VALUES ($1, ARRAY[clock_timestamp() - interval '3 days'], clock_timestamp() - interval '3 days')", [key("ip", "expired")]);
  await pool.query("WITH expired AS (DELETE FROM public.contact_rate_limits WHERE updated_at < clock_timestamp() - interval '2 days') UPDATE public.contact_messages SET notification_status = 'accepted', provider_id = 'local-test' RETURNING id");
  assert.equal(await count(), 1);
  assert.equal(Number((await pool.query("SELECT count(*) FROM public.contact_rate_limits")).rows[0].count), 2);
  assert.equal((await pool.query("SELECT notification_status FROM public.contact_messages")).rows[0].notification_status, "accepted");
  console.log("PASS notification update removes stale limiter state but retains old support messages");
} finally {
  await pool.end();
}
