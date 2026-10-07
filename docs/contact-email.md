# Contact records and email setup

Contact uses Zod for strict server-side input validation, Neon Postgres for records and atomic quotas, and Resend for email notifications. An ORM is unnecessary for these two tables and the single reservation function. Until configured, visitors can write a message, copy a report, or open a GitHub draft; sending stays disabled. No library content is attached automatically.

## Activate Contact

1. Create a Neon Postgres database directly or through Vercel Marketplace. Vercel's former Postgres service has moved to Neon: [Vercel Postgres documentation](https://vercel.com/docs/postgres).
2. Run [`db/contact.sql`](../db/contact.sql) in the database's SQL editor. It creates support records, rate-limit buckets, and the atomic reservation function. Use the database owner connection for this initial setup.
3. Add the following **server-only** settings in Vercel or a gitignored `.env.local`. Never use `NEXT_PUBLIC_` prefixes or paste credentials into issue reports.

```dotenv
DATABASE_URL=<Neon PostgreSQL connection string, including sslmode=require>
CONTACT_RATE_LIMIT_SECRET=<random secret of at least 32 characters>
RESEND_API_KEY=<Resend email-sending API key>
CONTACT_FROM_EMAIL=<bare address on your verified sending domain>
CONTACT_TO_EMAIL=<your existing personal or support inbox>
```

Generate the rate-limit secret locally with `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`. Keep it stable across instances and deploys: replacing it creates new quota identities. Database and email credentials must stay server-side.

4. Verify the sending domain in Resend. The server fixes the sender and recipient; the visitor's address is `reply_to`. For initial testing, `onboarding@resend.dev` can only send to the email associated with your Resend account. See [domain setup](https://resend.com/docs/dashboard/domains/introduction) and [testing restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
5. Restart development or redeploy. `GET /api/contact` checks that settings are structurally valid; it does not validate credentials, migration, or inbox delivery. Send a deliberate test message, check its database row, check inbox receipt, and reply to confirm routing before announcing email support.

A dedicated runtime database role is preferable to an owner connection. After creating that role through your database console, grant it `USAGE ON SCHEMA public`, `SELECT, INSERT, UPDATE ON public.contact_messages`, `SELECT, INSERT, UPDATE, DELETE ON public.contact_rate_limits`, and `EXECUTE ON FUNCTION public.reserve_contact_message(uuid, text, text, jsonb)`. The function uses invoker privileges. Runtime access does not need permission to delete support records or alter the schema. Use an owner connection for manual record deletion.

## Stored records

Messages remain until manually deleted, as requested. The `contact_messages` table stores a UUID, submission time, validated fields in JSON, email-notification status, and a provider id when available. It omits the honeypot and hidden bug fields for other topics.

```sql
SELECT id, created_at, notification_status, provider_id,
       fields->>'email' AS reply_email, fields->>'topic' AS topic,
       fields->>'message' AS message, fields
FROM public.contact_messages
ORDER BY created_at DESC;

-- Replace the UUID after reviewing the intended record.
DELETE FROM public.contact_messages WHERE id = '<message UUID>'::uuid;
```

`pending` means the message was recorded and a final notification status was not saved. `accepted` means Resend returned an email id, not that the inbox received it. `unconfirmed` means the email request failed or timed out; it may still have arrived. There is no automatic resend. A rejected or uncertain notification still consumes quota and preserves the record. Provider response bodies and submitted fields are not written to application logs. Providers and the support inbox have their own retention policies.

There is no public message-list or deletion endpoint. Review and delete records using the database console. Manual record deletion does not reset rate limits.

## Three messages per rolling hour

Both the normalized email and client network address are limited to three recorded submissions in any rolling hour. PostgreSQL transaction advisory locks serialize both identities in a stable order; quota checks, quota reservation, and message insertion happen atomically. A denied request creates neither a message nor new rate-limit buckets. Database failure prevents email sending. The response includes `429` and `Retry-After`; the form keeps the draft and displays a retry time.

On Vercel, the route accepts only `x-vercel-forwarded-for` when `VERCEL=1`, relying on [Vercel's overwritten ingress header](https://vercel.com/docs/headers/request-headers). Arbitrary `x-forwarded-for` and `x-real-ip` values are ignored. IPv4-mapped IPv6 addresses share their IPv4 bucket; IPv6 addresses use a /64 network bucket. Network and email quota keys use a server-secret HMAC, and raw addresses are not stored in limiter rows. In local development, loopback requests share one development network bucket. Other production hosting fails closed until a trusted ingress-address adapter is deliberately added.

Inactive rate-limit buckets older than two days are removed when a notification status is saved. If no submissions occur, cleanup waits for the next status update; this is not a scheduled deletion guarantee. Support messages have no automatic expiry.

Publishing the limiter code and the number three is safe: enforcement belongs on the server, and secrets stay outside the repository. Anonymous visitors can change both their email and network, so this is not a verified-person identity limit. Add hosting/WAF burst and global-volume controls before broad public launch to protect database calls and email quotas against distributed abuse. Same-origin, honeypot, and input-size checks reduce unwanted submissions but do not authenticate clients. Shared networks can share a quota.

The same-origin check uses the existing reverse-proxy convention (`x-forwarded-host` when present). Hosting must overwrite that header. Reject bodies over 32 KiB at the proxy too; the endpoint also counts streamed bytes. Database queries are parameterized and bounded by five-second request timeouts; Resend calls time out after eight seconds.

## Verification

```sh
pnpm exec vitest run src/server/contact.test.ts src/server/contact-identity.test.ts src/server/contact-store.test.ts src/app/contact/contact-form.test.tsx
pnpm typecheck
pnpm exec eslint src/app/contact src/app/api/contact src/server/contact*.ts scripts/test-contact-postgres.mjs

# Disposable local PostgreSQL only; this script truncates its Contact tables.
TEST_CONTACT_DATABASE_URL=postgresql://user@127.0.0.1:5432/keepall_contact_test pnpm test:contact-db
```

The SQL checks run twenty concurrent submissions, test independent IP/email limits, rolling expiry, denied-request storage, transaction rollback, and deletion without quota reset. Unit tests replace external transports. Neither test suite sends real email or uses a hosted production database.
