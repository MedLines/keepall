# Website preparation

This checklist covers the public website additions reviewed on October 7, 2026. It records local preparation, not a public launch or a verified deployment.

## Scope

- Contact is available from the website header and footer, Help, Settings, and the library logo menu. GitHub issues are the current support channel, with guidance to omit private library content and backups.
- Changelog records the current public feature baseline. It does not assign historical release dates. See `docs/changelog.md` for the release-note workflow.
- Privacy explains IndexedDB, separate browser profiles and site addresses, network requests, analytics, deletion, backup contents, and offline limits. Extension privacy links to the app-wide policy.
- Blog contains a design-reference workflow and a browser-bookmark workflow, with real app screenshots and links to the relevant Help steps.
- Share images use the existing Next.js `opengraph-image.png` and `twitter-image.png` conventions. Both contain the current app screenshot composition at 1200 × 630 pixels.
- Press kit work is parked. No press page or download is included in this slice.

## Local verification

The focused browser suite is `e2e/website-preparation.spec.ts`. Run it after a production build with `pnpm exec playwright test --config playwright.website.config.ts`. The isolated configuration owns port 3114 and checks Chromium and Firefox.

The suite substitutes an empty script only for `/_vercel/insights/script.js`, which is supplied by Vercel and returns 404 on a local Next server. It still fails on other browser errors. Analytics delivery remains a deployment check.

- [x] Independent source review of the website changes against baseline `1978c20`.
- [x] Full unit suite passed in the integration worktree before the blog merge, 155 files and 1,282 tests. The subsequent blog and share-metadata changes add static content.
- [x] `pnpm lint` completed with zero errors. The repository has 109 existing complexity warnings.
- [x] Final `pnpm build` and `pnpm typecheck` passed. Next.js generated all 35 static pages. This environment uses Node 22.14.0 and emits the repository's existing engine warning; use the package's supported Node version for deployment.
- [x] Header links stay inside their container and Contact works through Tab and Enter at 320, 390, 580, 768, 1024, and 1440 pixels.
- [x] Long public pages scroll to their footer without horizontal overflow at 320 and 1440 pixels.
- [x] Settings links and the library logo menu expose Contact, Changelog, and Privacy.
- [x] Both articles are reachable from Blog; their screenshots load and their Help anchors resolve.
- [x] Public content links return successful responses and their fragment targets exist.
- [x] Titles, descriptions, OG and Twitter metadata are present, and the referenced images return HTTP 200 with the correct dimensions and size.
- [x] Screenshots inspected at phone, tablet, and desktop widths.

The final production browser run passed all 24 checks in Chromium and Firefox. Screenshots were captured at 320, 390, 580, 768, 1024, and 1440 pixels and inspected at the five main phone, tablet, and desktop widths. The files remain in `test-results/`, outside version control. Both share-image files are 250,812 bytes; their plain URLs and Next.js file-convention URLs with hashes returned HTTP 200.

Review corrected two share-image issues. The existing file-convention images took precedence over the new public asset, and page-specific OG or Twitter objects dropped inherited image fields. The current images replace the old files, and the affected pages explicitly reuse the image metadata.

## Before announcing a launch

- [ ] Deploy the reviewed commit and record the public deployment URL and date.
- [ ] Recheck public pages and navigation on `https://www.keepall.app`, including keyboard access, phone layout, article images, and page scrolling.
- [ ] Fetch the published OG and Twitter image URLs and test an actual shared link. A local server cannot verify crawler access or social-network caches.
- [ ] Confirm `NEXT_PUBLIC_KEEPALL_ORIGIN` matches the public app origin. Browser storage belongs to the protocol, hostname, and port, so switching addresses can open a separate local library.
- [ ] Confirm Vercel Web Analytics runs on the deployed site. Its local script endpoint is provided by the hosting integration.
- [ ] Recheck the external GitHub issue page and Chrome Web Store listing. Both returned HTTP 200 during preparation on October 7, 2026.
- [ ] Set up the future support email and Resend delivery before publishing an email address. No email address or contact form is currently offered.
- Press kit work remains parked at the user's request.
