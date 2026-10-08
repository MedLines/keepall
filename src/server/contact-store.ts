import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { ContactFields } from "@/app/contact/contact-fields";
import type { ContactIdentity } from "./contact-identity";

export type ContactStoreConfig = { databaseUrl: string; hashSecret: string };
type Reservation = { allowed: true; id: string } | { allowed: false; retryAfter: number };

export function getContactStoreConfig(): ContactStoreConfig | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const hashSecret = process.env.CONTACT_RATE_LIMIT_SECRET?.trim();
  if (!databaseUrl || !hashSecret || hashSecret.length < 32 || /[\r\n]/.test(hashSecret)) return null;
  try {
    const url = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2) return null;
    return { databaseUrl, hashSecret };
  } catch { return null; }
}

export async function reserveContactMessage(fields: ContactFields, identity: ContactIdentity, config: ContactStoreConfig): Promise<Reservation> {
  const id = randomUUID();
  const message = { name: fields.name, email: fields.email, topic: fields.topic, message: fields.message, browser: fields.browser, steps: fields.steps, expected: fields.expected, actual: fields.actual };
  if (fields.topic !== "bug") { message.browser = ""; message.steps = ""; message.expected = ""; message.actual = ""; }
  const sql = neon(config.databaseUrl);
  const [result] = await sql.query(
    "SELECT * FROM public.reserve_contact_message($1::uuid, $2::text, $3::text, $4::jsonb)",
    [id, identity.ipKey, identity.emailKey, JSON.stringify(message)],
    { fetchOptions: { signal: AbortSignal.timeout(5000) } },
  );
  if (result?.allowed === true) return { allowed: true, id };
  if (result?.allowed === false && Number.isInteger(result.retry_after) && result.retry_after >= 1 && result.retry_after <= 3600) {
    return { allowed: false, retryAfter: result.retry_after };
  }
  throw new Error("Contact reservation failed");
}

export async function recordContactDelivery(id: string, state: "accepted" | "unconfirmed", providerId: string | null, config: ContactStoreConfig) {
  const sql = neon(config.databaseUrl);
  const rows = await sql.query(
    "WITH expired AS (DELETE FROM public.contact_rate_limits WHERE updated_at < clock_timestamp() - interval '2 days') UPDATE public.contact_messages SET notification_status = $2, provider_id = $3 WHERE id = $1::uuid RETURNING id",
    [id, state, providerId],
    { fetchOptions: { signal: AbortSignal.timeout(5000) } },
  );
  if (rows.length !== 1) throw new Error("Contact status update failed");
}
