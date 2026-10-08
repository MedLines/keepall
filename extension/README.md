# Keepall Capture

Load this directory as an unpacked extension at `chrome://extensions` with
Developer mode enabled. Pin **Keepall Capture** to the toolbar. A click saves the
current HTTP(S) page directly to the same local Keepall library in this Chrome
profile. No Keepall tab needs to remain open. If one is open, its Library updates
after a confirmed save. The badge and an animated top-right toast confirm the
write; an error never reports success.

Quick-save confirmations show a separate icon-and-label action row below the
message. **Open in Keepall** opens the saved item's `/items/<id>?from=%2F` detail
page and reuses an existing library or item-detail tab when possible. **Undo** appears only for a new
link or image, never an update or duplicate. Undo moves the new item to Trash
and retains its media, but refuses if the item was edited, organized, or
pinned after saving. Automatic link previews do not prevent Undo. Actions stay
visible for eight seconds and pause while hovered, keyboard-focused, or while
Organize is open. Undo is available for up to one minute and requires the same
live bridge. It disables at the library's deadline, with an explanation that
you can remove the item in Keepall instead.
The action's library and item IDs stay in extension session storage until the
next quick-save notification in that tab, tab closure, or browser restart.
In-page URL changes keep the visible notification's actions connected to its item.
The drawer keeps its existing centered save confirmation.
New quick saves identify the type: “Link saved to Keepall” or
“Image saved to Keepall.” An older deployed bridge can still save and open items,
but it cannot offer Undo until the updated web app is deployed.

**Organize** opens a compact panel with **Collection** and **Tags** switches.
Search either list and choose **Create “name”** only when no names contain the search text.
Creating or choosing a collection moves the saved item immediately and keeps the
panel open. Switch to Tags to create, add, or remove tags in the same session. Searches ignore case and
reuse existing names. The panel keeps a fixed height while filtering, with
scrolling inside the results and space reserved for its scrollbar.
If collections and tags fail to load, **Retry** reloads them in the same panel
and returns focus to the selected search field. After a collection move, choices
refresh before another change. If that refresh fails, the item stays saved and
Retry only reloads choices; Close and Escape remain available.

Alt/Option+K opens a Keepall-style drawer over the current page for an optional
title and personal note. It also loads collections and tags from your library.
Six quick choices appear for each; **Browse all** searches the complete list,
and the inputs create names only when no existing or pending names match. Enter
chooses an existing match before creating a name. Browse all closes after selection
and keeps its height while filtering. A successful drawer save
replaces the form with a centered checkmark, confirmation, and **Open in Keepall**
button. The confirmation stays open until you open the item or choose **Close**.
Feedback names a collection-only move, confirms other saved changes,
or says “This link was already saved” when nothing changed. A failed save keeps
the form open and shows an error toast.

**Add files** selects local images, MP4/WebM, PDF, text, or Markdown files. Pasting
an image into the drawer stages it too; text paste stays native. These save as
independent library items, preserving the current page title and note draft.
Multiple images require **One image item** or **Separate image items**. Image
captions, video titles/notes, and text file contents can be edited before saving.
The current page remains the read-only source for local images. Unchanged text
keeps its original bytes; switching Plain text/Markdown changes the saved filename
extension. PDF files retain their original bytes and open in Keepall.

Notes and document contents offer **Plain text**/**Markdown** and **Edit**/**Preview**.
Preview runs locally, treats HTML as text, disables unsafe links, and never loads
remote images. It does not change the editable source. File objects stay in tab
memory across Close/reopen; thumbnails are released on close and recreated on
reopen. Discard draft or Remove all files clears staged files. Reloading the source
page clears drafts. No file bytes or notes enter extension storage.

Imports show confirmed results as they arrive. **Cancel import** waits for active
writes to settle; **Retry failed files** retries remaining files, and **Continue
import** checks an uncertain result before sending it again. Close is disabled
while a write is unresolved. Saved files remain saved after partial failure. Open
in Keepall opens one saved item; Open library shows multiple results. **Bulk import**
opens Keepall's full importer while preserving the extension draft and existing
item-detail tabs. File capture needs the matching app bridge; an older bridge shows
an update error while existing link capture remains available.

Closing the drawer with Close, Escape, or the backdrop keeps unfinished edits
for that URL and library in the current tab. Reopening restores the title, note,
Markdown choice, collection, and tags. A restored draft includes **Discard draft**
to clear it and close the drawer. A confirmed save clears it too; a failed save
keeps it. Drafts live only in the extension's isolated page memory, request no
new permissions, and disappear when the page reloads or the tab closes.

When the page is already saved, the drawer loads its title, note, Markdown
choice, collection, and tags. You can edit the title and note there. If the
link changes in Keepall while the drawer is open, its conflict check still applies
to restored drafts. Copy any unfinished text you want to keep, then discard the
draft and reopen to load the latest version. Notes containing local images show their text read-only; edit those
notes in Keepall so their image assets stay intact. Without a collection choice,
a new link goes to Unsorted. A toolbar click leaves the organization of an
already saved link alone. If the shortcut is already claimed, assign it at
`chrome://extensions/shortcuts`. Chrome does not allow injection on its internal
pages, so those pages cannot be captured.

Right-click a normal HTTP(S) link and choose **Save to Keepall** to save
its destination without opening it. New links go to Unsorted; duplicates keep
their existing organization and report that they were already saved. This
reuses the toolbar save path and needs no extra website permission. Keepall
does not use the current page's title as the destination's title. There is one
menu entry for links, images, and selected text, with no submenu. When an image is also a link, Keepall saves the image itself and retains the containing
tweet link as its source when available.

Right-click an image and choose **Save to Keepall** to store the image
itself as a local image item, with the current page as its source. New images
go to Unsorted, ready to organize later. The first
save from an image hosted on another domain may ask for access to that image
host. To avoid repeated prompts, open the extension's Options page, read
the image-saving guide, then choose **Allow access to all websites**.
Chrome will ask once for access to all websites; this
is optional. To change or remove website access, choose **Manage access in Chrome**
in Options. In Keepall Capture's Chrome details, select **On specific sites**
under Site access and remove unwanted allowed sites. Keep www.keepall.app and
the localhost library address for local tests allowed so saves reach the library.
Saved items are unaffected. Chrome remembers some earlier approvals, and an
explicit save can request access again; removal does not promise another prompt.
Text links and same-page images do not need an extra host prompt. If library
access was removed by an earlier version, Options shows **Restore library access**.
Saves fail with a clear message until it is restored. The guide shows actual
Chrome warning screenshots and explains the broader permission.
Per-website access remains the recommended default. Keepall downloads
images only when you choose the right-click action. Supported
formats are PNG, JPEG, GIF, WebP, and AVIF, up to 20 MiB. Images that cannot
be downloaded show an error toast. Saving the same image again reports that
it was already saved.

On X, an image linked to a tweet keeps that tweet's permalink as its source,
including when saved from the home timeline or a profile. Photo numbers and
tracking parameters are removed. If Chrome does not provide a tweet link,
Keepall uses the current tweet page when available, or the original page URL.
This uses Chrome's clicked-image context and requests no extra permissions.

The extension uses `https://www.keepall.app` by default. To test against a local
server, open the extension's **Options** page and enter its localhost address,
such as `http://localhost:3001`. The browser profile, origin, and IndexedDB
must match the Keepall library you intend to use. The hosted bridge route must
be deployed before the production address can accept extension captures.

Only explicit clicks or shortcut saves read a page URL/title. Pending captures
remain in extension storage for up to ten minutes so a failed handoff can retry;
they are removed after Keepall confirms the write. The library itself stays in
Keepall's IndexedDB. If Keepall cannot load, the extension reports the failure
and another click retries. Offline capture depends on the bridge page being
available from Keepall's PWA cache.

## Store release

Build and deploy the matching Keepall web app before submitting the extension for review.
Test the unpacked extension against the production origin. Run
`python3 scripts/package-extension.py` from the repository root to build a ZIP
in `/tmp` with `manifest.json` at its root. The script removes the development
`key` field from the ZIP manifest because the Store assigns its own item ID;
the source manifest keeps the key for the unpacked extension.

After the first unpublished Chrome Web Store draft upload, get its Item ID and
public key from the Package tab. Replace the source manifest key with that public
key and update the web bridge's allowed extension origin. Deploy the app and
retest before publishing. Increase the manifest version for each later Store
update, and always use the packaging script for Store uploads.


## Connection and appearance

Options shows the saved destination separately from the editable address. **Check
connection** verifies library permission and asks that library's hidden bridge
to read its collections and tags. It creates no test item. Missing access offers
**Restore library access**; an unavailable address offers **Try again**. Saving a
new address resets the status. Each localhost port and keepall.app have separate
libraries, so check the destination if an item seems missing.

**Appearance** offers System, Light, and Dark. It applies to extension Options,
the capture drawer, and its notifications, including already-open extension UI.
System follows the device's appearance; explicit Light/Dark overrides it. The
choice is stored in the extension and does not change the Keepall app's theme.

## Selected text

Highlight text on an HTTP(S) page and choose **Save to Keepall**. Keepall stores
the selected text as a plain note on the source page's link. For a selection
inside a frame, the frame URL is the source. A new link goes to Unsorted and can
be opened, organized, or undone from the toast. If that source link already
exists, Keepall appends the passage to its existing note, preserving the title,
collection, tags, formatting, and local image markers. Markdown notes receive
escaped literal text. Repeating the same complete passage does not append it
again. Selections and the resulting note are limited to 10,000 characters;
exceeding the limit reports an error without truncating or replacing the note.
When contexts overlap, images take priority, then selected text, then links.
Text comes from Chrome's explicit right-click selection; there is no page-wide
text scraping or new permission. Text is passed directly to the hidden bridge
and is not kept in pending extension storage. Retry a failed save with the same
selection. Deploy the updated web bridge before using this with production.

## Options navigation

Options uses a sticky sidebar with three groups:

- **General** — library address, connection, and appearance.
- **Saving** — keyboard shortcut, right-click links, and selected text.
- **Image access** — the image saving guide, per-website access, optional broad
  access, privacy, and Chrome's manual permission controls.

Related sections share a panel with dividers. Only the selected group is shown.
Up/Down, Home, and End move between tabs; the URL remembers the selection on
reload. Switching groups preserves unfinished address edits and brings the new
panel back into view. On narrow screens the sidebar becomes an icon rail with
accessible labels. Image screenshots stay visible alongside their instructions.
Old tab URLs still open the corresponding group.

## Browser tests

The extension browser tests use port 3100 by default. If another local project
uses that port, choose an unused one with `KEEPALL_E2E_PORT`, for example:

```sh
KEEPALL_E2E_PORT=3117 pnpm exec playwright test e2e/extension-capture.spec.ts e2e/extension-drawer-isolation.spec.ts e2e/extension-action-icons.spec.ts --project=chromium --workers=2
```

Build Keepall first with `pnpm build`. The test server and extension fixtures use
the same chosen port.

## Local file transport (app and extension development)

The file transport requires an app bridge advertising `file-transfer-v1` in its
`ready.capabilities`. An older app returns an explicit unsupported-version error.
This protocol is implemented for the Add files/image-paste UI integration; it is
not a release announcement. Reload the extension after deploying the matching app.
No additional permissions or database migration are required.

The editor receives its `editorId` from the worker. Keep original `File` objects in
the page draft until each result is confirmed. Send sequential runtime requests:

```js
const request = (operation, payload) => chrome.runtime.sendMessage({
  type: "editor-file-action", editorId, operation, payload,
});
const manifest = {
  manifestId: crypto.randomUUID(),
  itemIds: [crypto.randomUUID()],
  files: [{ name: file.name, type: file.type, size: file.size }],
  imageMode: "separate",
  organization: { collectionId: null, tagIds: [], tagNames: [] },
  metadata: { title: "Reference", noteContent: "My note", noteFormat: "plain" },
};
const begun = await request("begin", manifest);
// Check success before accessing sessionId. Keep this manifest frozen for retries.
const { sessionId } = begun;
// For each file in manifest order, base64-encode at most 256 KiB of raw bytes.
await request("chunk", { sessionId, fileIndex: 0, offset: 0, data: base64Chunk });
// Continue at the next byte offset only after the prior request succeeds.
await request("commit", { sessionId });
const result = await request("status", { sessionId });
```

`begin`, `chunk`, `commit`, `status`, and `cancel` return either
`{ success: false, error }` or a flattened status:

```js
{
  success: true,
  sessionId: "<upload UUID>",
  stage: "complete", // receiving | saving | complete | cancelled
  receivedBytes: 3,
  totalBytes: 3,
  results: [{ fileIndex: 0, fileName: "a.txt", status: "saved", itemId: "<item UUID>" }],
}
```

While saving, `processing` can be `reading`, `preparing-video`, or `saving`, with
`fileIndex` identifying the current file. Results are ordered by file index.
Failed results contain `error`; cancelled results have neither `error` nor
`itemId`. A complete transfer can contain failed files; check each result.
`commit` acknowledges promptly with stage `saving`; poll `status` for completion.
`cancel` uses `{ sessionId }`. While a write is settling it can still report
`saving`; keep polling until terminal. Already committed results remain `saved`.

Use one output item UUID per file for `separate`, or one UUID for an image-only
`gallery`. A gallery saves atomically in manifest order. Metadata applies to each
separate item, or to the gallery. Image notes become captions, and document/video
notes preserve `noteFormat`. The worker supplies the registered page URL; callers
may omit `metadata.sourceUrl`, or supply exactly that URL. File saves do not update
the captured page link.

Selected collection/tag IDs must still exist when saving. Existing IDs can be
non-UUID strings restored from a backup. `collectionName` creates/reuses a collection
only when no `collectionId` is supplied; `tagNames` are additional new tag choices.
A retry reuses an existing output ID only when its active type, original content,
filename where applicable, and gallery order match. It never reapplies metadata.
Trash or mismatching IDs fail. Overlapping writes check IDs inside the same write
transaction, so a second save cannot leave extra originals or organization rows.

Recovery rules:

- Retry an unacknowledged chunk with the same offset and bytes. Conflicting bytes,
  gaps, oversize chunks, and out-of-order files fail.
- Retry `begin` with the identical frozen manifest after a lost begin reply.
- After a lost commit reply, poll status before retransmitting bytes.
- An unknown/expired session requires a new begin and full upload using the same
  manifest/item UUIDs. Completed items are reused without duplication.
- To retry only failed/cancelled separate files, create a new manifest UUID containing
  just those files and their original item UUIDs. For a cancelled gallery, retry
  every gallery file with the original gallery item UUID and a new manifest UUID.
- Editing file content or gallery order requires new output item UUIDs.

Limits are checked before app-side buffer allocation: 50 files, 200 MiB per
transfer and across active transfer buffers, 20 MiB per image, 10 MiB per text or
Markdown document, 50 MiB per PDF, and 100 MiB per MP4/WebM. Raw chunks are at most
256 KiB; the offscreen document transfers their ArrayBuffers to the app frame.
There are at most four active transfers and 32 cached terminal results. Idle
sessions expire after ten minutes; terminal cache eviction can expire them sooner.
Polling refreshes idle expiry. Closing/reloading the bridge drops buffers and
aborts pending work. The worker retains at most 64 editor registrations for ten
minutes of inactivity in `storage.session`, containing only tab/editor IDs,
library origin, page URL, timestamp, and up to 50 short-lived saved-result action IDs. File bytes, manifests and notes are never
persisted in extension storage by this transport.

Manifest filenames are at most 255 characters, MIME strings 128, titles 500,
notes 10,000, source URLs 8,192, organization names 120, and existing organization
IDs 100. At most 100 selected tag IDs and 100 new tag names are accepted. UUIDs are
required for manifest/output/session/editor IDs. Unknown manifest fields fail.
TypeScript contracts and limits are exported by
`src/domain/extension-file-capture.ts` (`EditorFileAction`, `ExtensionFileManifest`,
`ExtensionFileReply`, `ExtensionTransferStatus`, `ExtensionFileResult`, and
`BulkImportReply`).

For Bulk import, send `request("open-bulk-import", {})`. Its reply is only
`{ success: true }` or `{ success: false, error }`. The worker focuses a root
Keepall tab, preserving its query, or creates one; existing item-detail tabs stay
open. Its only added URL data is `#keepall-bulk-import=<nonce>`. After mount or
hashchange, the app consumes that intent once, removes only that hash with
`history.replaceState`, and opens the existing Bulk import dialog. A busy capture
keeps the hash until the dialog can open. The extension draft stays available.

The worker adds an optional `actionId` to successful file status replies containing
confirmed saved items. Send `request("open-results", { actionIds: [...] })` with
those tokens; it returns `{ success: true }` or `{ success: false, error }`. Tokens
are bound to the editor tab, source URL and library, expire after ten minutes, and
survive reopening the same draft. The UI never supplies an item URL to this action.

## Local preview bundle

`pnpm build:extension` builds `src/extension/note-preview.js` into the unpacked
extension and collects third-party licenses. `pnpm check:extension` verifies the
committed output is deterministic, includes licenses, and contains no eval. The
packaging script runs both before creating the ZIP and removes the development key.
The builder uses the installed Next webpack and SWC APIs without adding a package;
check these APIs and rerun the deterministic/security tests when upgrading Next.
The bundle mounts the app’s actual note controls and safe preview. The drawer shell
and native text editing remain plain JS. `drawer-styles.js` compiles the actual app
`globals.css`; the app and extension consume shared capture class recipes. CSS and
tooltip portals stay inside the owned iframe, with the outer Shadow DOM preserving
website isolation. No remote styles or runtime compilation are used.
