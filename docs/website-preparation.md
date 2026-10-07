# Website preparation

The work lives on `feature/website-preparation`, with separate worktrees for Contact, Changelog, privacy, blog/screenshots, and final verification. The press kit remains parked at the user's request. The latest app changes through public main commit `9e62f9e` were merged into the isolated website branch before the revision.

## Pages and behavior

- Contact has a form for help, bug reports, and suggestions, plus the existing GitHub issues link. Email delivery depends on the server-side Resend settings described in `docs/contact-email.md`. An unconfigured service must never report a message as sent.
- Contact is a plain header navigation link. Open Keepall remains the header button. Shared website buttons have balanced horizontal padding, including buttons with only text.
- Changelog has dated New, Improved, and Fixed entries reconstructed from public GitHub history. `docs/changelog.md` records the source commits, merged pull requests, date policy, and release-note maintenance workflow.
- Privacy describes local library storage, preview and article requests, website icons, hosting and analytics, browser-data loss, backups, offline limits, and contact-message handling. Help and Settings link to the same guidance.
- The blog has design-reference and bookmark-import workflows. Screenshots and application recordings are captured from the current app in disposable browser contexts with sample data. Capture scripts are kept alongside the fixture files so the assets can be refreshed.
- Sharing metadata uses the existing Next.js OG and Twitter image conventions. `scripts/generate-opengraph-image.mjs` builds both images from the latest real library capture at 1200 × 630 pixels.

## Local verification

The initial implementation passed a production build, typecheck, lint, 1,282 unit tests, and 24 Chromium/Firefox website scenarios. Those results describe the initial revision, not the subsequent corrections.

The revised production build and typecheck passed. Full lint completed with zero errors and 109 pre-existing complexity warnings. The unit/component suite passed 1,314 tests; its existing article-runtime subprocess test was blocked by the sandbox, then passed when rerun with subprocess permission. This gives 1,315 passing tests across those runs, including 27 contact-specific cases.

All 32 production browser scenarios passed in Chromium and Firefox in three minutes. They check plain Contact navigation and keyboard activation at 320, 390, 580, 768, 1024, and 1440 pixels; balanced text-button padding; the unconfigured contact form and identity-free copy/GitHub fallback; required-field validation and mocked accepted submission; Help thumbnails; page scrolling and overflow; app information links; article images and Help anchors; and rendered sharing metadata and images. No real email was sent.

The preview is running from this branch at http://localhost:3114. Fresh application captures include 19 screenshots and four walkthrough recordings in MP4 and WebM. The blog shows actual bookmark policy selection, completed import results, the imported collection, note editing, and search. Static screenshot imports use content-hashed paths to avoid stale browser image caches.

Verification logs are outside version control in `/tmp/keepall-website-revision-{build,typecheck,lint,unit,browser}.log`, with the permission-required test rerun in `/tmp/keepall-website-revision-runtime-test.log`. The focused browser screenshot artifacts are under `test-results/`.

Vercel serves `/_vercel/insights/script.js` on the deployed website. A local Next.js server does not have that endpoint. Browser tests replace only that analytics script with an empty script and still check other browser errors. Real analytics delivery remains a deployed-site check.

## Remaining external checks

- [ ] Configure Resend with a valid sender and destination inbox and add deployment-level abuse protection before enabling the form. Verify receipt and replies. The local tests use mocked email transport and send no live messages.
- [ ] Deploy the reviewed branch and verify the published pages, downloads, and contact flow on desktop and phone.
- [ ] Fetch the published OG and Twitter images and test an actual shared link, including social-network caches.
- [ ] Check analytics delivery on Vercel.
- [ ] Resume the press kit when the user supplies founder and contact details.

No deployment, remote merge, or checklist update was performed as part of the local work.
