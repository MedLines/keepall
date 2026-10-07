# About and Help feature coverage

Audited on 2026-10-07 against website branch `afbb180` and app main `7effa37`. Their shared app base is `9e62f9e`; the later main commit changes collection-card styling, not feature behavior. Implemented on `feature/website-feature-coverage` in the isolated preview worktree. The original checkout remains unchanged. About, Help, capture assets, and Contact records were implemented in separate worktrees.

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

Preserve the hero, personal-library statement, four-tab walkthrough gallery, three-card sticky stack, installation section, and closing treatment.

- Enrich the existing library walkthrough with Preview and a local video; enrich Search with file-content and recognized screenshot-text results. Keep four tabs rather than adding a tab for every command.
- Add a reading section after the existing feature stack: a real full article reader, PDF page controls, and a Markdown document. Explain saving readable articles and bringing local files into the library. Link to saved-articles and documents.
- Add an image-tools section using the existing card surfaces and spacing: a real image with Palette and Screenshot text cards, plus a color-search example. Use the app's action name Read text and explain English screenshot recognition in ordinary language.
- Add Unsorted review to existing organization copy. Expand the import tile to supported files and folders. Mention automatic folder backups in the local-library card with the browser-support qualification and existing Help link.
- Update the offline FAQ: saving a link preserves its address; Save for offline keeps a readable article copy. Cached Keepall can read locally saved articles, notes, media and documents. Opening the original website and fetching new content still require a connection.

`src/app/about/scroll-scenes.tsx` currently assumes exactly three sticky cards through its progress math. Place the new sections outside that stack. Expanding the stack requires generalizing that math and verifying scroll and reduced-motion behavior. Gallery labels, panel arrays, posters, and MP4/WebM sources must stay aligned.

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
4. Add the two About sections and refresh existing demos using those assets.
5. Verify the actual actions described, image/video loading, anchors, metadata, keyboard use, reduced motion, and layouts at 320, 390, 768, and 1707 pixels. Build and typecheck, then run the website suite in Chromium and Firefox.

Keep About and Help implementation in separate worktrees branched from the isolated website branch, with the shared visual capture work integrated before final browser verification. Do not change app behavior to match documentation.

## Contact activation

Contact now records submissions in Neon Postgres before notifying the support inbox through Resend. It requires `DATABASE_URL`, `CONTACT_RATE_LIMIT_SECRET`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_TO_EMAIL`. Apply `db/contact.sql` first. Messages remain until manually deleted; the separate database limiter allows three submissions per rolling hour per email and trusted network identity. See [Contact setup](contact-email.md) for activation, SQL record review/deletion, failure semantics, and abuse controls. No hosted database was provisioned and no live email was sent.

## Where to review the implementation

The dev preview runs at `http://localhost:3115` from `/tmp/keepall-website-preparation`, checked out on `feature/website-feature-coverage`.

- `/about`: existing Library and Search demos now show documents, image text, and local video.
- `/about#reading`: saved article, PDF, and Markdown reader section.
- `/about#image-tools`: palette, color search, and English screenshot recognition.
- `/about#collection`: updated organization/import/privacy/backup copy; offline FAQ near the bottom.
- `/help`: grouped guide index, feature-specific thumbnails, and direct Palette, Read text, and Videos links.
- `/help/search`, `/help/documents`, `/help/preview`, `/help/notes`: new focused guides.
- `/help/images-and-videos#palette` and `#image-text`: expanded image analysis instructions and limits.
- `/help/collections-and-tags`, `/help/getting-started`, `/help/saved-articles`, `/help/offline`, `/help/storage-and-backups`: corrected actions and linked explanations.
- `/contact`: retention disclosure, three-per-hour message, safe retry/failure states, and existing matching controls. Sending remains disabled until credentials/schema are configured.
- `/privacy#contact`: record storage, manual retention, rate-limiter hashes, and cleanup explanation.

The earlier Contact navigation/button fixes, blog thumbnails, changelog entries, and public-page footer remain in this branch. Press kit remains parked.


## Verification completed

- Production build and full typecheck passed. Full lint passed with zero errors and the existing 109 warnings; the changed Contact and website files have no new lint warnings.
- All 40 website checks passed in Chromium and Firefox. The first integrated run passed 36; the four remaining checks passed after fixing test selectors that included hidden logo layers and Next's separate route-announcement alert. Expected console output from the deliberately mocked Contact 429 is allowed only in that scenario and only for the Contact endpoint.
- About's separate 16-case matrix passed at 320, 390, 768, and 1707 pixels with normal and reduced motion. Three sticky cards, four gallery tabs, keyboard focus, manual playback, image loading, and no horizontal overflow were verified.
- Help routes passed browser checks at those widths; all 50 original anchors and 79 rendered Help links resolve.
- All 72 Contact route, identity, storage, Zod-input, and form tests passed. Independent review verified server bounds and resolved the transient-503 retry issue.
- A disposable local PostgreSQL instance verified three-per-hour limits, twenty simultaneous attempts sharing each identity combination, rolling expiry, failed-insert rollback, denied requests without storage growth, manual deletion without quota reset, and retention of year-old messages during limiter cleanup. The instance was stopped afterward.
- Capture fixtures use actual PDF text extraction, real local video, real palette extraction, and genuine English OCR. New screenshots and refreshed MP4/WebM recordings load and decode.
- The original checkout remains untouched by this task. No hosted database, Resend credentials, deployment, or live delivery test was performed. Activation and inbox receipt/reply checks remain required.
