# Contact email setup

The Contact page is usable before email is configured. Visitors can write a message, copy a report, or open a GitHub issue draft. The Send message button stays unavailable until the server has all three settings below. Nothing is sent to Resend in that state.

## Configure the server

Set these variables in the deployment's server environment, or in a gitignored `.env.local` for development. Never prefix them with `NEXT_PUBLIC_`.

```dotenv
RESEND_API_KEY=<Resend API key with email sending permission>
CONTACT_FROM_EMAIL=<address on your verified sending domain>
CONTACT_TO_EMAIL=<support recipient mailbox>
```

Use bare email addresses, such as `contact@example.com`, without display names or multiple recipients. Verify the sender domain in Resend and use a recipient mailbox that somebody monitors. The visitor's validated address becomes `reply_to`; the sender and recipient always come from server configuration. The browser cannot choose a recipient.

No Neon database or separate support inbox is required for this flow. `CONTACT_TO_EMAIL` can be your existing personal inbox. `CONTACT_FROM_EMAIL` identifies the sending address on a domain you own; replies from your inbox go to the visitor through `reply_to`. The app does not store submissions.

After updating `.env.local`, restart the development server. For a hosted deployment, set all three server variables in the intended environment and redeploy. `GET /api/contact` returns `available: true` when the configuration is present and structurally valid; it does not check the API key, domain verification, or delivery. Confirm those by sending a deliberate test message and checking receipt and reply routing.

For an initial test without a verified domain, Resend permits `onboarding@resend.dev` as the sender only when the recipient is the email address associated with your Resend account. This is a testing setup, not a production sender. See [Resend's testing-domain restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) and [verified domain setup](https://resend.com/docs/dashboard/domains/introduction).

The server calls [Resend's Send email API](https://resend.com/docs/api-reference/emails/send-email) over HTTPS with plain text. A successful UI response means Resend accepted the message and returned an email id. It does not confirm arrival in the recipient's inbox. The app does not retry automatically. A timeout leaves delivery uncertain, so a manual retry may create a duplicate.

## Protect delivery before activation

Before adding production credentials, configure deployment or WAF rate limits on `POST /api/contact` and review Resend sending quotas. For example, apply a small per-client burst limit and a global volume limit appropriate to support traffic. Use the hosting platform's verified client address rather than trusting an arbitrary forwarded header.

The route requires a same-site Origin, accepts only bounded JSON fields, rejects an occupied honeypot, and times out the provider request after eight seconds. These checks prevent cross-site browser submissions and some spam. Direct automated clients can forge an Origin and leave the honeypot empty. They are not a substitute for rate limiting. There is no process-local limiter that would silently reset or disagree across serverless instances, and no new IP or submission database.

The same-origin check follows the app's existing reverse-proxy convention and uses `x-forwarded-host` when present. The deployment must overwrite that header rather than passing arbitrary client values through. Reject request bodies above 32 KiB at the proxy too; the route also counts streamed bytes rather than trusting Content-Length.

## Information sent

Submitting sends name, reply email, topic, message, and the bug details when applicable to the Keepall server, Resend, and the configured support inbox. No saved library content is attached automatically. The application does not persist submissions in its database or log form fields, email credentials, or provider error bodies. Email and infrastructure providers may retain messages and ordinary request metadata under their own policies.

Copy report and GitHub drafts omit the separate name and email fields. Message text can still contain personal information. GitHub issues are public; the visitor must review the report before posting. Reports too long for a GitHub URL stay available in the copyable preview.

## Verification

```sh
pnpm test src/server/contact.test.ts src/app/contact/contact-form.test.tsx
pnpm typecheck
pnpm exec eslint src/app/contact src/app/api/contact src/server/contact*.ts
```

Automated tests replace the mail transport. They do not contact Resend or send live mail. Once the mailbox and credentials are supplied, an explicitly authorized delivery check should confirm receipt and reply routing before announcing email support.
