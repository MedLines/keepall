# Keepall Capture — Chrome Web Store update

- Item ID: `ehloefgfecmfjbncknaoleakbnjhkpea`
- Published version checked September 26, 2026: **0.1.0**
- Prepared update: **0.2.0**

Upload this update to the **existing item**, not a new Store listing. The minor
version increases because this release adds image, link, and selected-text
capture, toast actions, drafts, and settings. The web app's package version is
independent of the extension version.

## Upload steps

1. Commit the release changes and push them to the repository.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), then **Keepall Capture**.
3. In **Package**, choose **Upload New Package** and upload `build/keepall-capture-0.2.0.zip`. Confirm the version shown is **0.2.0**.
4. In **Store listing**, replace the description with the text below. The short summary comes from the manifest.
5. In **Privacy practices**, update the single purpose and permission justifications below. Keep **Web history** and **Website content** disclosed, and review the certifications. Keep the existing remote-iframe disclosure.
6. Update the reviewer test instructions below. Save changes on each edited tab.
7. Click **Submit for review**. Choose automatic publication after approval if you want it to go live as soon as Google approves it.

Submitting an update does not change the currently published version. Google
reviews the new package before it is published. See the official
[update instructions](https://developer.chrome.com/docs/webstore/update).

The public privacy page and GitHub support URL both returned HTTP 200 on
September 26, 2026. The live privacy page includes image downloads, optional host
access, selected text, temporary Undo receipts, and the appearance setting.
The public Store listing shows a publisher contact email and the two data
categories above. Draft-only dashboard fields still need checking when uploading.

## Store listing

**Description** — paste as plain text:

```text
Save what you want to come back to: pages, links, images, and useful passages. Keepall Capture adds them to your personal Keepall library without needing to keep a Keepall tab open.

SAVE IN ONE CLICK
Click the toolbar icon to save the page you're reading. Right-click a link to save its destination without opening it. Right-click an image to save the image itself, or highlight text and right-click to save the passage as a note with its source link. New items go to Unsorted.

ADD A LITTLE CONTEXT
Press Alt+K (Option+K on Mac) to open the capture drawer. Edit the title, add a plain-text or Markdown note, and choose collections and tags. Unfinished drawer edits stay available in that tab until you reload or close it. If the shortcut is already in use, change it at chrome://extensions/shortcuts.

KEEP ORGANIZING
After a quick save, open the saved item, move it to a collection, or undo a new save from the confirmation. Already-saved links keep their existing organization. Repeated text selections do not add duplicate passages.

YOUR LIBRARY, ON YOUR DEVICE
No Keepall account is needed. Your library lives in this Chrome profile, in the Keepall web app's local browser storage. Open https://www.keepall.app to browse, search, edit, and back up your library. Each browser profile has its own library.

IMAGE PERMISSIONS, YOUR CHOICE
An image hosted on another website may need a one-time permission for that image host. Allow sites as you need them, or optionally grant access to all websites from Options. The guide explains Chrome's permission warning and how to manage access. Keepall downloads images only when you choose to save them.

Options also lets you check your library connection, manage the capture shortcut, and choose System, Light, or Dark appearance.

Works on ordinary HTTP and HTTPS pages. Chrome's internal pages cannot be captured. Link previews in the Keepall app may send the saved URL to Keepall's preview service; see the privacy policy for details.
```

- **Category:** Tools
- **Language:** English
- **Homepage URL:** `https://www.keepall.app/`
- **Support URL:** `https://github.com/MedLines/keepall/issues`
- **Privacy policy URL:** `https://www.keepall.app/extension-privacy`
- **Mature content:** Off

Keep the existing no-glow Store icon. Screenshots can be updated to show the new
drawer, toast actions, or Options. Use real UI, remove private library content,
and keep Store screenshots at 1280 × 800 or 640 × 400. The ZIP does not replace
listing screenshots; upload those separately if changing them.

## Privacy practices

**Single purpose:**

```text
Save user-selected pages, links, images, and text to the user's local Keepall library, with optional notes and organization into collections and tags.
```

**Permission justifications** — update existing fields and add the new context-menu explanation:

| Permission | Paste-ready explanation |
| --- | --- |
| `activeTab` | Read the current page URL and title after the user clicks the toolbar icon, invokes the capture shortcut, or uses Save to Keepall in the right-click menu. Temporary access also lets the extension display save feedback on that page. |
| `scripting` | Display the capture drawer, save-result toast, and collection picker on the page where the user invokes Keepall. Notify an already open Keepall tab after a confirmed save, edit, move, or Undo. |
| `offscreen` | Hold an invisible Keepall bridge page so explicit saves and library actions reach the user's local Keepall database without opening a visible tab. The connection check reads library organization through the same bridge without creating an item. |
| `storage` | Store the selected Keepall address and extension appearance. Hold pending link captures for retry for at most ten minutes, removing them after confirmation. Temporarily keep saved item and library identifiers in browser-session storage for Open, Organize, and Undo. Image bytes and selected passages are not kept in extension storage. |
| `alarms` | Run periodic cleanup of expired pending link captures. |
| `contextMenus` | Provide one Save to Keepall right-click action for images, links, and selected text. Read only the selected target and its source context when the user chooses that action. |
| `https://www.keepall.app/*` | Load the hidden Keepall bridge and notify open Keepall tabs after library changes. The library is stored in this website origin's local IndexedDB in the user's browser profile. |
| `http://localhost/*` | Support users running Keepall locally who select a localhost address in Options. The default destination is the production Keepall address. |
| Optional `*://*/*` | Download an image from its host only after the user selects Save to Keepall. Access to an image host can be requested as needed. Users may instead choose optional access to all websites in Options to avoid repeated host prompts. All-website access is not required for saving ordinary page links or selected text. |

**Host permission justification** — paste into the host-permission box:

```text
https://www.keepall.app/* lets the extension load the hidden Keepall bridge and save or organize the user's selected content in the Keepall website's local IndexedDB. It also lets the extension refresh an open library tab after a change. http://localhost/* supports users who choose a locally running Keepall address in Options. Optional *://*/* access is used to download images the user explicitly chooses through Save to Keepall. Permission can be requested for an individual image host, or users can optionally allow all websites from Options after reading the guide. The extension does not automatically collect page content or browsing history.
```

**Remote code:** Keep **Yes** for the disclosed isolated website iframe:

```text
The extension embeds https://www.keepall.app/extension-bridge in an iframe inside its offscreen document. The Keepall website's script runs only in that isolated iframe, without access to extension APIs. It writes user-requested captures and organization changes to the Keepall website origin's local IndexedDB without opening a visible tab. The extension worker and injected page scripts are packaged locally; they do not fetch or evaluate remote JavaScript.
```

**Data usage:** Keep **Web history** for user-selected URLs/titles and **Website
content** for selected images, passages, and capture text. If the dashboard offers
a separate **User-generated content** category, include it for notes, titles,
collection names, and tags. Do not select unrelated categories. These declarations
describe data handled by the extension even when stored locally; they do not mean
Keepall automatically reads Chrome history or uploads the library.

**Certifications:** Review the three existing statements about not selling data,
using it only for the single purpose, and not using it for creditworthiness or
lending. The privacy policy also explains link-preview requests and hosting.

## Reviewer test instructions

The following text fits the 500-character field:

```text
No account needed. Open https://www.keepall.app in the same Chrome profile. On a normal HTTPS page, click Keepall to save; check the library without refreshing. Alt+K opens the drawer for a note, collection, and tags. Right-click a link, image, or selected text and choose Save to Keepall; allow the image host if asked. Try Open, Organize, and Undo on a new save. Options includes connection checks, shortcut help, themes, and image permissions. Chrome internal pages are unsupported.
```

## Release verification — September 26, 2026

- Options screenshots reviewed in light/dark and a narrow window; sticky
  navigation, keyboard access, reload selection, and preserved edits pass.
- All 12 extension browser tests pass against the extracted package on localhost.
- Five integration tests pass with the live keepall.app library and bridge:
  connection/text/theme, drawer editing, Open/Organize/Undo, images, and links.
- All 32 extension persistence tests pass; typecheck and extension lint pass.
- ZIP integrity, source-file equality, root manifest, version, and Store ID checked.
  Only the public key is restored in the disposable unpacked test copy.
- Public privacy and support pages are reachable; production disclosures match.

Production tests used disposable Chromium profiles and synthetic source pages for
repeatable captures. They did not access the publisher's personal library or
signed-in Store dashboard. Native Store installation/update prompts and the
private draft fields must be checked in the dashboard/Store-installed copy.

ZIP SHA-256:

```text
204c91a1f3b9e63a4b13a9a27820b5a7f2b5d24ae47c28695ad617acd62fbe5d
```

## Rebuild and identity

```bash
python3 scripts/package-extension.py build/keepall-capture-0.2.0.zip
```

The ZIP has `manifest.json` at its root and excludes the public development key.
The Store preserves this item's ID when the ZIP is uploaded to the existing
listing. The source manifest keeps the Store's public key so the unpacked
extension has the same ID as the web bridge allows. For tests of extracted ZIP
contents, restore only that public key in a separate test copy; never alter the
upload ZIP to test it. Never commit the generated ZIP or temporary browser profiles.

If a published update needs to be reverted, use the Store's
[rollback guidance](https://developer.chrome.com/docs/webstore/rollback), then
verify captures against the production library again.
