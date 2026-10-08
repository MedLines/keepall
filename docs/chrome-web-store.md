# Keepall Capture — Chrome Web Store 0.4.0 draft

- Item ID: `ehloefgfecmfjbncknaoleakbnjhkpea`
- Published version verified in the dashboard October 8, 2026: **0.3.0**
- Prepared update: **0.4.0**
- Prepared October 8, 2026. Dashboard and production checks must be recorded separately from local tests.

Upload to the **existing item**. This feature update adds local files and image
paste, note preview, shared app drawer controls, continued collection/tag
organization, a larger search-clear target, and an extension-icon library menu.
The web app's package version is independent of the extension version.

## Draft preparation

1. Commit and push the reviewed release changes. Deploy the matching app bridge and updated privacy page before testing the production file workflow.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), then **Keepall Capture**.
3. In **Package**, choose **Upload New Package** and upload `/tmp/keepall-extension-drawer-update.zip`. Confirm **0.4.0**.
4. In **Store listing**, use the description below. The short summary comes from the manifest.
5. In **Privacy practices**, use the single purpose and permission explanations below. Review the existing data categories and certifications against the actual dashboard fields. Retain the isolated website iframe disclosure.
6. Add the reviewer instructions below and save each edited tab. Verify the uploaded version, listing, privacy fields, and production workflow.
7. Leave **Submit for review** for the publisher. Do not submit or publish this draft.

The official [update instructions](https://developer.chrome.com/docs/webstore/update)
describe the Store update process. Uploading a package and saving draft metadata
are separate from submitting it for review.

## Store listing

**Description** — paste as plain text:

```text
Save pages, links, images, useful passages, and local files to your personal Keepall library. Keepall Capture works with the Keepall web app in this Chrome profile; you do not need to keep a library tab open to save.

SAVE FROM THE WEB
Click the toolbar icon to save the current page. Right-click a link to save its destination without opening it. Right-click an image to save the image itself. Highlight text and choose Save to Keepall to add the passage to the source link's note. Repeated selections do not add duplicate passages.

ADD CONTEXT AND FILES
Press Alt+K (Option+K on Mac) to open the capture drawer, using the same controls and appearance as the Keepall app. Edit the page title, write a plain-text or Markdown note, preview it, and choose collections and tags. Close keeps unfinished edits in that tab until you reload or close the tab; Discard draft removes them.

Use Add files for PNG, JPEG, GIF, WebP, AVIF, MP4, WebM, TXT, Markdown, or PDF files. You can also paste an image into the drawer. Save multiple images as one gallery or separate items, add an image caption or video note, and inspect or edit text-file contents. These become independent library items rather than attachments to the current page. Mixed files save separately. Progress and results show which files saved, with retry and cancellation controls. Bulk import opens the app's import dialog while preserving the extension draft.

KEEP ORGANIZING
After a quick save, open the item, organize it, or undo a new save. The organizer stays open after choosing a collection so you can add tags immediately. Search collection and tag lists, create a name when there are no matches, and clear the search with an easy-to-hit button. Already-saved links keep their organization unless you change it.

OPEN YOUR LIBRARY
Right-click the extension icon and choose Open Keepall library. It focuses an existing library tab without losing its current search or draft, or opens a new one. Visit https://www.keepall.app to browse, search, edit, and back up your library.

YOUR LIBRARY, ON YOUR DEVICE
No Keepall account is needed. Saved items and local file contents live in the Keepall website's IndexedDB in this Chrome profile. Each profile has its own library. The extension passes selected files locally to the app in your browser; it does not upload those files to cloud storage. Markdown preview runs locally and does not load remote images. Back up your library in Keepall Settings before clearing browser data.

IMAGE PERMISSIONS, YOUR CHOICE
A right-clicked image hosted on another website may need permission for that image host. Allow sites as needed, or optionally allow all websites from Options. Explicit local file selection and image paste do not need image-host permission. Options also includes a library connection check, shortcut help, and System, Light, or Dark appearance.

Page capture works on ordinary HTTP and HTTPS pages, not Chrome's internal pages. Right-click downloads of PDF or video files and standalone empty-note capture are not supported; use Add files for local documents and videos. The default library is https://www.keepall.app; Options also supports a locally running Keepall instance. Link previews in the app may send saved URLs to Keepall's preview service. See the privacy policy for network-request details.
```

- **Category:** Tools
- **Language:** English
- **Homepage URL:** `https://www.keepall.app/`
- **Support URL:** `https://github.com/MedLines/keepall/issues`
- **Privacy policy URL:** `https://www.keepall.app/extension-privacy`
- **Mature content:** Off

Use real UI without private library content for Store screenshots. The ZIP does
not replace listing screenshots; manage those separately in the dashboard.

## Privacy practices

**Single purpose:**

```text
Save user-selected pages, links, images, text passages, and local files to the user's local Keepall library, with optional notes, collections, and tags, and access to that library.
```

**Permission justifications** — existing permissions only:

| Permission | Paste-ready explanation |
| --- | --- |
| `activeTab` | Read the current page URL and title after the user clicks the toolbar icon, invokes the capture shortcut, or selects Save to Keepall. Temporary access also lets the extension display capture controls and save feedback on that page. |
| `scripting` | Display the capture drawer, local file controls, packaged note preview, save-result toast, and organizer on the page where the user invokes Keepall. Notify an open Keepall tab after confirmed library changes. |
| `offscreen` | Hold an invisible Keepall bridge page so explicit saves, local file transfers, and organization changes reach the app origin's local IndexedDB without opening a visible tab. The connection check reads organization through the same bridge without creating an item. File bytes pass through browser messages, not a server upload. |
| `storage` | Store the chosen Keepall address and appearance. Pending link retries may include the URL, title, entered note, and organization; they expire after ten minutes and are removed on confirmation or cleanup. Browser-session storage holds save-action identifiers and temporary editor records containing tab/editor IDs, source/library URLs, saved item IDs, and action tokens. File bytes, file-note contents, and directly selected passages are not written to extension storage. |
| `alarms` | Periodically remove expired pending link captures and temporary editor-session records. |
| `contextMenus` | Provide Save to Keepall for images, links, and selected text in webpage menus, and Open Keepall library in the extension icon's menu. The save action reads the chosen target and source context; the library action opens or focuses the user's library without capturing the current page. |
| `https://www.keepall.app/*` | Load the hidden Keepall bridge and notify open library tabs after changes. Saved content lives in this website origin's local IndexedDB in the user's browser profile. |
| `http://localhost/*` | Support users who choose a locally running Keepall address in Options. The default destination remains https://www.keepall.app. |
| Optional `*://*/*` | Download an image from its host only after the user chooses Save to Keepall. Request permission for individual image hosts, or let users optionally allow all websites from Options. This access is not needed for ordinary page links, selected text, explicitly chosen local files, or image paste. |

**Host permission justification:**

```text
https://www.keepall.app/* loads the hidden Keepall bridge and lets explicit captures, local file transfers, and organization changes reach that website origin's local IndexedDB. It also allows open library tabs to refresh after changes. http://localhost/* supports a locally running Keepall address chosen in Options. Optional *://*/* access downloads only images the user explicitly selects through Save to Keepall; users can allow individual hosts or optionally all websites. Local files are selected through the file picker or an explicit paste and do not need host-download access. The extension does not automatically collect page content or browsing history.
```

**Remote code:** Retain **Yes** for the disclosed isolated website iframe:

```text
The extension embeds https://www.keepall.app/extension-bridge, or the configured localhost equivalent, in an iframe inside its offscreen document. The website's script runs in that isolated iframe without extension APIs and saves user-requested content to the website origin's local IndexedDB. The extension worker, injected scripts, drawer styles, and note controls/preview are packaged locally; they do not fetch or evaluate remote JavaScript.
```

**Data usage:** Disclose **Web history** for user-selected URLs/titles and
**Website content** for selected images, passages, local file contents, and capture
text. If the actual dashboard provides a separate **User-generated content**
category, include notes, captions, edited titles, collection names, and tags.
These declarations describe handled data, including local processing; they do
not mean the extension reads Chrome history or uploads the library. Review the
actual dashboard categories rather than adding unrelated categories.

**Temporary storage details:** Drawer drafts, selected File objects, pasted image
bytes, and file-note contents remain in tab memory. The hidden bridge keeps
transfer manifests, filenames, metadata, and results in memory; it releases its
file-byte buffers when processing settles, a receiving transfer is cancelled,
or the session expires. Inactive bridge sessions expire after ten minutes and
are pruned every thirty seconds. Editor-session records in extension session
storage expire after ten minutes of inactivity and are removed during cleanup
or when the tab closes; saved-result action tokens also expire after ten minutes.
Those records contain identifiers and source/library URLs, not file bytes or
file-note contents. Pending link retries are a separate storage path and can
include entered link-note text, as disclosed above.

**Certifications:** Review the existing statements about not selling data, using
it only for the single purpose, and not using it for creditworthiness or lending.
The privacy policy retains disclosures for link previews, website icons,
user-requested article fetches, hosting logs, and aggregate page-view analytics.

## Reviewer test instructions

Paste-ready text, under 500 characters:

```text
No account needed. Open https://www.keepall.app in this Chrome profile. On an HTTPS page, click Keepall; try Organize, tags and Undo. Alt+K opens the drawer: Add files (PNG/JPEG, MP4, TXT/MD/PDF), paste an image, and preview Markdown. Save, then check the library. Right-click a link/image/selection to save; allow the image host if asked. Right-click the extension icon > Open Keepall library. Bulk import opens the app. Internal pages cannot be captured.
```

## Local release verification — October 8, 2026

The reviewed branch passed the production app build, extension bundle build and
deterministic check, type checking, and relevant lint. The shared drawer change
passed 32 Chromium extension cases; its final file-layout corrections passed six
file/parity cases. Subsequent clear-target and library-menu changes passed the
organizer browser case in both themes, all 15 capture cases, and two final menu
routing checks. Focused organizer and worker-transfer units passed 16 and six
tests respectively. These were local tests with disposable profiles, not a
physical toolbar-menu click or verification of the signed-in Store draft.

The prepared ZIP has version 0.4.0, valid archive integrity, no development key,
and byte-matching extension sources and generated assets. Its SHA-256 is:

```text
968539c9a9759696f33b822b9d8eb820703b69b5999e6296de872b0efde6ec08
```

Production deployment, the live privacy page, the uploaded package, and saved
dashboard fields need separate verification before the publisher submits.

## Rebuild and identity

```bash
python3 scripts/package-extension.py /tmp/keepall-extension-drawer-update.zip
```

The ZIP has `manifest.json` at its root and excludes the public development key.
The Store preserves the item ID when uploaded to the existing listing. The
source manifest retains the public key for unpacked bridge-compatible testing.
For tests of an extracted ZIP, restore only that public key in a separate test
copy; never alter the upload ZIP. Do not commit generated ZIPs or browser profiles.
