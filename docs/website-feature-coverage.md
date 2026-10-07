# About and Help feature coverage

Audited on 2026-10-07 against website branch `afbb180` and app main `7effa37`. Their shared app base is `9e62f9e`; the later main commit changes collection-card styling, not feature behavior. Implemented on `feature/website-feature-coverage` using isolated task worktrees. The main project checkout is now on that branch at the user's request. About, Help, capture assets, and Contact records were implemented in separate worktrees.

## Coverage at audit

Help already describes most requested capabilities. Several are buried inside broader guides, while About omits them or gives them too little explanation. Four new focused guides would make these features easier to find without duplicating all existing instructions.

| Capability | About | Help | Planned change |
| --- | --- | --- | --- |
| Search | Simple demo and organization copy | One section in collections-and-tags | Promote a Search guide; refresh the existing demo with file and screenshot-text matches. |
| PDF, Markdown, TXT | Missing | Import documents section | Add a Documents guide and a reading section on About. |
| Local video | Named, without a player demo | Images and videos guide | Show actual local video playback in the library/preview demo; add a direct Help topic link. |
| Saved articles and offline reading | Offline copy omits the saving action | Dedicated saved-articles and offline guides | Show the full article reader and explain Save for offline. |
| Palette and color search | Missing | Images and videos, palette section | Add an image-tools visual and a visible Help topic link. |
| Screenshot OCR | Missing | Images and videos, image-text section | Show Read text and recognized-text search; expose the Help topic. |
| Quick preview | Missing | Getting started | Promote a Preview guide; show browsing results and opening a full item. |
| Notes with formatting and local images | Brief Markdown FAQ | Scattered mentions | Add a Notes guide covering the actual editor. |
| Unsorted review, Trash, shortcuts | Basic organization copy | Organization guide, partly stale | Correct current controls and add missing recovery instructions. |
| Bulk file/folder import and folder backups | Import blurb mentions only bookmarks/images | Import and storage guides | Expand About's existing import/local-storage copy, with browser limits kept in Help. |

## Correct existing instructions first

- Unsorted review uses **Back**, **Next**, and **Apply changes**. Tags apply immediately. Browsing with Next does not create an Undo entry. Replace the old File and next/Skip directions. See `src/app/unsorted-review.tsx` and its tests.
- Link titles can open the original website. Teach **item menu → Open full item** to reach saved details and the article reader. Distinguish **Preview**, **Fetch preview / Refresh preview**, and **Save for offline / Update saved article**. See `src/app/item-context-menu.tsx` and `src/app/library-quick-preview.tsx`.
- Use **Move to Trash** for ordinary library menus. Explain Restore, Restore selected, Delete permanently, Empty Trash, and Undo after moving an item.
- State plainly that scanned-PDF OCR is unavailable. Image Read text recognizes English text in saved images; it does not recognize PDF page images or transcribe videos.
- Explain that images can be saved up to 20 MiB, while image analysis also has a 32-megapixel limit. See `src/domain/image.ts` and `src/app/image-analysis-client.ts`.
- Replace About's absolute “Find anything with search” claim. Add documents to its supporting copy and sharing metadata, expand the import blurb, and explain Save for offline in its offline FAQ.

## Help structure

Keep existing guide URLs and anchors working. Leave short introductions in their current guides and link to the focused guides instead of maintaining duplicate detailed instructions.

1. **Search your library** — `/help/search`. Show words across fields, quoted phrases, highlighted excerpts, Best match, collection/tag/type scope, Search entire library, Clear filters, Retry search, and separate Trash search. Explain that All collections and All tags search names rather than item contents. Include `color:red`, `color:#FF0000`, and a combined example such as `color:red receipt`. `color:` is the only implemented query operator; do not invent OR, exclusions, or `type:` syntax.
2. **Read PDFs, Markdown and text files** — `/help/documents`. Show importing and opening documents, PDF Pages/Scroll modes, page navigation and zoom, text/Markdown editing, separate personal notes, Download file, file search and backups. Explain Notes includes imported TXT/MD and Documents includes document items. TXT/MD must be UTF-8 and at most 10 MiB; PDFs at most 50 MiB and 1,000 pages. Large text previews stop at 200,000 characters, while search reads the saved file beyond that preview. Imported Markdown does not load remote images or embedded HTML. PDF search reads selectable text; scanned pages are viewable without OCR.
3. **Browse without losing your place** — `/help/preview`. Show toolbar/menu Preview, keyboard browsing, Back/Next, Space, Escape, Open full item, image Fit/Scroll, gallery controls, local video and document previews, and list column options. A link's quick preview shows its cover, description, source, and personal note. Its saved article is read in the full item page.
4. **Write notes with text and images** — `/help/notes`. Show plain text/Markdown, Edit/Preview, headings, lists, tables, code, Add image at cursor, and personal notes on other saves. Markdown checklists are displayed read-only rather than interactive tasks. Keep locally attached note images distinct from remote images in imported Markdown.

Expose direct Help links to Palette, Read text, and Videos within the existing images-and-videos guide. Cover Refresh palette, Read text again, cancellation/retry, copying results, and reviewing recognition quality. Color search only matches images whose palettes have been extracted; OCR text is searchable after recognition. MP4/WebM files are at most 100 MiB and depend on browser codec support. Online video links do not download media or produce transcripts.

Group the existing Help rows under **Start saving**, **Read and explore**, **Organize and find**, and **Keep your library safe**. Keep the current typography, row layout, screenshot treatment, and per-guide section navigation. Use feature-specific thumbnails rather than the general-library fallback.

## About structure

Preserve the hero, four-tab walkthrough gallery, installation section, and closing treatment. The latest 2026-10-08 revision restores the original three stacked cards for Capture, organization/search, and local storage/backups. Six small visual tiles cover complementary features.

- The gallery shows Library, Collections, Tags, and Search. Demos use current preview, local video, file-search, and recognized-text results.
- Compact tiles cover article/PDF reading, Markdown and text notes, palette/OCR, local video, Preview, and file/folder import. Real app snippets end at complete component or text boundaries and sit inside padded frames.
- Capture retains its manual demo. Search and Preview, import, and local storage cards link to detailed Help procedures.
- The offline FAQ distinguishes saved addresses from saved article text. Cached Keepall can read local content; original websites and new requests need the internet.

The `reading`, `image-tools`, `extension`, and `your-library` anchors remain available. Screenshot frames contain the whole image with padding. Gallery labels, panels, posters, and recordings remain aligned.

## New visual evidence

The current marketing fixture mainly seeds images and a plain note. It cannot demonstrate the missing capabilities. Extend the disposable sample-library capture workflow with:

- A mixed library containing PDF, Markdown, text, local video, an English screenshot, and a saved article.
- PDF controls and selectable text; a rendered Markdown file; a full saved article with locally saved inline images.
- Actual extracted palette and Screenshot text results; search excerpts from file and recognized image text.
- A preview recording moving between an image, document, and local video, then opening a full item.

Use real app output, sample content, and the existing capture scripts. Preserve manual playback, posters, reduced motion, readable mobile crops, and content-hashed screenshot imports. OCR first use needs a connection to obtain the engine/data; later offline recognition depends on retained engine files. Previously recognized text remains locally readable and searchable.

## Delivery order and verification

1. Correct stale action names and inaccurate limits; update existing About wording and metadata.
2. Add focused Help guides, topic entry points, and crosslinks without breaking old anchors.
3. Extend sample fixtures and capture current UI for each new feature claim.
4. Restore the three-card About stack, add six compact feature tiles, and refresh demos using current assets.
5. Verify the actual actions described, image/video loading, anchors, metadata, keyboard use, reduced motion, and layouts at 320, 390, 768, and 1707 pixels. Build and typecheck, then run the website suite in Chromium and Firefox.

Keep About and Help implementation in separate worktrees branched from the isolated website branch, with the shared visual capture work integrated before final browser verification. Do not change app behavior to match documentation.

## Contact activation

Contact now records submissions in Neon Postgres before notifying the support inbox through Resend. It requires `DATABASE_URL`, `CONTACT_RATE_LIMIT_SECRET`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_TO_EMAIL`. Apply `db/contact.sql` first. Messages remain until manually deleted; the separate database limiter allows three submissions per rolling hour per email and trusted network identity. See [Contact setup](contact-email.md) for activation, SQL record review/deletion, failure semantics, and abuse controls. No hosted database was provisioned and no live email was sent.

## Where to review the implementation

The user's dev server runs at `http://localhost:3116` from `/home/med/projects/personal/bookmark-project/keepall`, checked out on `feature/website-feature-coverage`.

- `/about`: existing Library and Search demos now show documents, image text, and local video.
- `/about#reading`: six compact feature tiles, starting with articles and PDFs.
- `/about#image-tools`: palette, color search, and English screenshot recognition.
- `/about#collection`: four-tab gallery. The three stacked cards cover Capture, organization/search, and local storage/backups; the offline FAQ is near the bottom.
- All four `/blog/*` articles: sticky left navigation on desktop and collapsible navigation above the article on phones. Article styling differs from Help.
- `/help`: grouped guide index, feature-specific thumbnails, and direct Palette, Read text, and Videos links.
- `/help/search`, `/help/documents`, `/help/preview`, `/help/notes`: new focused guides.
- `/help/images-and-videos#palette` and `#image-text`: expanded image analysis instructions and limits.
- `/help/collections-and-tags`, `/help/getting-started`, `/help/saved-articles`, `/help/offline`, `/help/storage-and-backups`: corrected actions and linked explanations.
- `/contact`: retention disclosure, three-per-hour message, safe retry/failure states, and existing matching controls. Sending remains disabled until credentials/schema are configured.
- `/privacy#contact`: record storage, manual retention, rate-limiter hashes, and cleanup explanation.

The earlier Contact navigation/button fixes, blog thumbnails, changelog entries, and public-page footer remain in this branch. Press kit remains parked.


## Earlier feature and Contact verification

- Production build and full typecheck passed. Full lint passed with zero errors and the existing 109 warnings; the changed Contact and website files have no new lint warnings.
- All 40 website checks passed in Chromium and Firefox. The first integrated run passed 36; the four remaining checks passed after fixing test selectors that included hidden logo layers and Next's separate route-announcement alert. Expected console output from the deliberately mocked Contact 429 is allowed only in that scenario and only for the Contact endpoint.
- Before the latest layout feedback, a 16-case Chromium/Firefox matrix verified the previous eight-card layout, four gallery tabs, keyboard focus, manual playback, contained images, and no overflow at 320, 390, 768, and 1707 pixels in both motion modes.
- Help routes passed browser checks at those widths; all 50 original anchors and 79 rendered Help links resolve.
- All 72 Contact route, identity, storage, Zod-input, and form tests passed. Independent review verified server bounds and resolved the transient-503 retry issue.
- A disposable local PostgreSQL instance verified three-per-hour limits, twenty simultaneous attempts sharing each identity combination, rolling expiry, failed-insert rollback, denied requests without storage growth, manual deletion without quota reset, and retention of year-old messages during limiter cleanup. The instance was stopped afterward.
- Capture fixtures use actual PDF text extraction, real local video, real palette extraction, and genuine English OCR. New screenshots and refreshed MP4/WebM recordings load and decode.
- The main project checkout was switched to the website feature branch at the user's request. No hosted database, Resend credentials, deployment, or live delivery test was performed. Activation and inbox receipt/reply checks remain required.

## Copy and layout revision, 2026-10-08

About restores the three stacked cards and adds six small feature tiles. The stack covers Capture, organization/search, and local storage/backups. The tiles cover article/PDF reading, notes and text files, image analysis, local video, Preview, and import. Existing section anchors remain available. Screenshots show their full content inside padded frames; the PDF and Markdown detail assets were recaptured with native background around the reader. Hero and gallery screenshots also fit their phone frames.

Both original Blog articles were edited for direct wording. Two additional workflows are available:

- `/blog/project-research`: saved articles, PDFs, Markdown, project notes, search, and backups.
- `/blog/searchable-screenshots`: English image text recognition, palettes, color queries, and backups.

All 13 Help guides, containing 68 sections, were reviewed and rewritten. Procedures use short commands and numbered steps. Descriptions separate controls, results, and limits. Body text is 16px with 1.6 line height and a capped measure; image captions are 13px. Existing guide URLs and section anchors are preserved.

The writing follows the sentence-length and procedure rules in [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf). A source audit checks procedural sentences at 20 words or fewer, descriptive sentences at 25 words or fewer, and paragraphs at six sentences or fewer. This is a plain-language application of the rules, not a certified dictionary-compliance review. Product control names and technical terms remain explicit.

Independent review checked the copy against app source and corrected three existing documentation errors: Clear filters also removes the tag filter; Search entire library removes type limits; a previously selected collection takes priority over a folder's name during import. The folder-backup procedure now names Choose backup folder.

Review the revised feature cards at `/about#reading`, `/about#image-tools`, `/about#extension`, and `/about#your-library`. Review the complete Help index at `/help` and all four article links at `/blog`.

### Writing and typography review

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/app/help/guides.ts:53`, `src/app/help/focused-guides.ts:14` | Multi-action paragraphs and incomplete filter explanations | Short descriptions, numbered procedures, source-checked controls | Reduces reading effort and preserves accurate actions. |
| MEDIUM | `src/app/about/feature-bento.tsx`, `src/app/about/landing.css` | Eight oversized feature cards | Original three-card stack plus six compact tiles with padded app snippets | Restores the requested layout and keeps each additional feature brief. |
| LOW | `src/app/blog/design-reference-library/page.tsx:32`, `src/app/blog/browser-bookmarks/page.tsx:30` | Repeated framing and long introductions | Direct workflow copy and two new use cases | Gives each article a concrete task. |
| LOW | `src/app/help/help.css:72` | 15px body text and 12px image captions | 16px body text, 13px captions, 1.6 body line height | Improves reading on phone and desktop layouts. |

Approve the reviewed writing and typography changes. Sentence-length checks, source-backed feature review, and separate agent browser matrices passed. Integrated build and browser results are recorded below.

### Previous integrated verification (before the compact-layout feedback)

- Final production build and typecheck passed. Full lint has zero errors and the same 109 existing warnings.
- The 46-scenario Chromium/Firefox suite passed 43 scenarios on its first run. Three bento assertions measured decorative borders as image pixels; the assertions now measure the content box. All four bento scenarios passed after rebuilding, including the added anchor visibility checks. All 46 scenarios have passed their relevant final checks.
- About review anchors now use the same 108px scroll offset as other website sections. Live checks verified all four headings below the floating header at 390px and 1707px.
- Previous live dev checks on port 3115 verified About, both new articles, Search Help, and image-text Help: HTTP 200, loaded visible images, no page errors, and no horizontal overflow at 390px.
- Independent source review approved About, all four Blog articles, and all 13 Help guides after the factual corrections above. The Help source audit passed all 68 sections, 261 steps, and 678 sentences under the checked sentence/paragraph limits.
- The earlier preview worktree is committed; the user now reviews `feature/website-feature-coverage` from the main checkout on port 3116. Contact readiness remains false until the documented Neon and Resend setup is supplied.

## Stack, sidebar, and button revision, 2026-10-08

The latest feedback is implemented on the main review branch and visible at `http://localhost:3116`.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/app/blog/blog-article.tsx`, `src/app/blog/blog.css` | Article contents interrupted the reading column | Sticky 232px left sidebar, article on the right, and a collapsed mobile contents list | Keeps section navigation available while reading; the unnumbered textured panel and editorial headings distinguish Blog from Help. |
| MEDIUM | `src/app/about/page.tsx`, `src/app/about/feature-bento.tsx` | Eight large cards replaced the familiar stack | Three stacked cards plus six compact visual tiles | Preserves the requested layout and gives each additional feature one short sentence. |
| MEDIUM | `src/app/about/details/` | Search and OCR captures ended through content | Complete search result, complete recognized-text block, and inset reader/media snippets | Keeps screenshot text away from cropped edges. |
| LOW | `src/app/marketing-controls.css` | Native buttons inherited app squircle corners while links remained round | Website buttons and button links use round corners with matching pill radii | Gives Contact and website actions consistent shapes while preserving the requested icon padding. |

Approve the reviewed layout and typography. Long-form Blog and Help text remains 16px; compact tile descriptions use 14px with 1.5 line height, short sentences, and padded frames. Wide desktop tiles measure 276px tall. Wrapped text grows naturally at narrower widths instead of being clipped.

Independent Chromium review covered all four articles at seven widths from 320–1707px, all twenty desktop contents links, four mobile contents links, keyboard focus, and twelve About viewport/motion combinations. Desktop sidebars stay at 112px below the floating header; phone contents remain in normal flow. The About stack retains its original sticky motion on suitable desktops and becomes static on phones and with reduced motion. No clipping, missing images, horizontal overflow, or page errors were found. Website button shapes passed separate Chromium and Firefox checks at 390px and 1707px, with app corner styles preserved.

### Integrated verification for this revision

- Production build, full typecheck, changed-file lint, and diff whitespace checks passed.
- All 50 production website scenarios passed in Chromium and Firefox. This includes the three-card/six-tile structure, 280px wide-desktop tile ceiling, text insets, loaded images, all four Blog sidebars, mobile contents, direct palette anchors, matching native/link button shapes, keyboard use, public links, Help procedures, metadata, and Contact draft/rate-limit states.
- A long repeated-context Blog development run intermittently reported a webpack `app/layout.js` eval error. Independent live review on the user server and the full production suite had no page errors; no unrelated app behavior was changed to address the unconfirmed development-run symptom.
- The user checkout remains on `feature/website-feature-coverage`; its dev server stays available at `http://localhost:3116`. Task worktrees and their commits remain isolated. Contact sending still requires the database schema and documented environment variables; no live credentials or delivery test were supplied.
