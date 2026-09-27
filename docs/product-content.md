# Keepall feature inventory and website copy

Draft, September 27, 2026. Based on the current application source and extension
0.2.0. This is a content inventory and copy proposal, not a record of deployment.

## What the pages need to explain

Use `/about` to explain what someone can keep, show the library, and introduce
the extension and app installation. Link each overview to a practical Help guide.
Help should explain the first action, the result, and what to do if it fails.

The most useful distinction belongs beside the installation links:

> Keepall is where you browse and organize your saved things. Keepall Capture is
> the Chrome extension that saves things from other websites. You can also install
> Keepall to open your library from an app icon.

Call the action **Install Keepall** or **Add to Home Screen**. Readers do not need
to understand “PWA” before they can use it. Installation is optional.

## Feature inventory

These are implemented capabilities found in the repository. The source column
provides a starting point for checking future copy when behavior changes.

### Save and view

| Feature | Plain-language explanation | Source |
| --- | --- | --- |
| Links | Keep a web address and give it a useful title. | `src/app/capture-host.tsx` |
| Notes | Write a standalone note, or add context to something you save. | `src/app/capture-host.tsx`, `src/app/note-item-page.tsx` |
| Markdown | Use Markdown for formatted notes and preview the result. Keep plain text as the starting option. | `src/app/capture-host.tsx`, `src/app/note-content.tsx` |
| Images | Choose image files or paste an image from the clipboard. Add a title, note, and source link. | `src/app/capture-host.tsx`, `src/domain/image.ts` |
| Image galleries | Keep several images together. Browse them full screen, zoom in, and add, replace, or remove an image. | `src/app/image-item-page.tsx` |
| Local videos | Add an MP4 or WebM file from your device and play it in Keepall. The current limit is 100 MiB per file. | `src/domain/video.ts`, `src/persistence/videos.ts` |
| Image formats | Save PNG, JPEG, GIF, WebP, and AVIF images, up to 20 MiB each. | `src/domain/image.ts` |
| Link previews | Keepall tries to add a saved page's title, description, and preview image while online. Some websites do not provide a usable preview. | `src/app/preview-enrich-coordinator.ts`, `src/server/preview-fetch.ts` |
| Capture shortcut | Open Save item with Alt + K, or Option + K on Mac. | `src/app/capture-host.tsx` |
| Edit and delete | Update saved details or delete an item after confirming. Deletion is permanent. | `src/app/item-edit-dialog.tsx`, `src/app/item-context-menu.tsx` |

### Organize and find

| Feature | Plain-language explanation | Source |
| --- | --- | --- |
| Unsorted | Save first and decide where an item belongs later. | `src/domain/library-view.ts` |
| Collections | Group related items and open a collection from the sidebar. | `src/app/library-navigation.tsx`, `src/persistence/collections.ts` |
| Tags | Connect related items across collections with more than one tag. | `src/persistence/tags.ts`, `src/app/item-context-menu.tsx` |
| Quick organization | Right-click a library item to find or create tags and choose a collection. | `src/app/item-context-menu.tsx` |
| Pinned collections | Keep frequently used collections in the sidebar and change their order. | `src/persistence/library-preferences.ts`, `src/app/library-navigation.tsx` |
| Pinned items | Keep selected items at the top of a collection. | `src/domain/library-view.ts` |
| Drag to organize | Drag library items to a collection. | `src/app/library-drag.ts`, `src/app/library-navigation.tsx` |
| Bulk actions | Select several items to move them, change their tags, or delete them together. | `src/app/library-bulk-bar.tsx` |
| Search | Search saved titles, tag names, and supported text fields. See the exact coverage below. | `src/domain/search.ts` |
| Filters | Narrow the library by collection, tag, or item type. | `src/domain/library-view.ts` |
| Grid and list | Browse visual cards or switch to a list. | `src/app/library-main-grid.tsx`, `src/app/library-list-row.tsx` |
| Date order | Show the newest or oldest saves first. Pinned items take precedence inside a collection. | `src/domain/library-view.ts` |
| Light and dark | Choose a light or dark appearance for the app. | `src/app/theme-control.tsx` |

The committed search version reviewed at the start matches titles and tag names for all item types; link URLs;
standalone note text; image captions and source URLs; and video filenames and
notes. Concurrent changes appeared during this review that also search link
notes and preview titles/descriptions, with matching excerpts and highlighted
results. Record these as work in progress until that change is verified and
released. Selected passages saved by the extension become link notes and would
benefit from that update. Neither version searches full web articles, text inside
images, or spoken video content.

### Save from other websites

These descriptions target extension 0.2.0. Confirm that version is publicly
available before presenting all of them as features of the Store download.

| Feature | Plain-language explanation | Source |
| --- | --- | --- |
| Save the current page | Click the Keepall toolbar icon to save the page you are reading. | `extension/worker.js` |
| Save a linked page | Right-click a link and choose Save to Keepall without opening its destination. | `extension/worker.js` |
| Save an image | Right-click an image to keep the image itself, together with its source page. | `extension/worker.js` |
| Save selected text | Highlight a passage, right-click, and choose Save to Keepall. It becomes a note attached to the source link. | `src/persistence/extension-selection.ts` |
| Add details before saving | Open the side panel with Alt + K or Option + K to change the title, add a note, and choose collections and tags. | `extension/page-ui.js`, `extension/org-picker.js` |
| Edit an existing save | Open the panel on a saved page to see and update its existing details. Notes containing local images must be edited in Keepall. | `extension/page-ui.js` |
| Temporary drafts | Close and reopen the panel to continue unfinished edits in that tab. Reloading the page or closing the tab clears the draft. | `extension/page-ui.js` |
| Open or organize after saving | Use the save confirmation to open the item or choose a collection. | `extension/page-ui.js`, `extension/toast-collections.js` |
| Undo a new save | Use Undo when it appears after saving a new item. It does not undo updates or changes made afterward. | `src/persistence/extension-capture-undo.ts` |
| Avoid repeated saves | Saving an existing link keeps its organization. Saving the same complete text passage again does not append it twice. | `src/persistence/extension-capture.ts`, `src/persistence/extension-selection.ts` |
| Image source on X | When Chrome supplies the tweet link, an image saved from X keeps that tweet as its source. Otherwise Keepall uses the available page address. | `extension/worker.js` |
| Image access controls | Allow image access per website, with optional access to all websites explained in Options. | `extension/options.html`, `extension/options.js` |
| Connection check | Check whether the extension can reach its saved library address. Restore library access when prompted. | `extension/options.js` |
| Shortcut settings | View or change the assigned capture shortcut through Options. | `extension/options.js` |
| Extension appearance | Choose System, Light, or Dark for the extension. This setting is separate from the app's theme. | `extension/options.js` |

### Installation, storage, and moving a library

| Feature | Plain-language explanation | Source |
| --- | --- | --- |
| No account | Open Keepall and start saving without registering. | `src/app/about/page.tsx`, `src/persistence/db.ts` |
| Local library | Saved items live in this browser profile on this device. Other browsers and profiles have separate libraries. | `src/persistence/db.ts`, `src/app/help/guides.ts` |
| App installation | Install Keepall through a supported browser to open it from an app icon. | `src/app/manifest.ts` |
| Offline access | Reopen a previously loaded, cached library and use locally stored content. First use and uncached pages need a connection. | `src/app/sw.ts`, `src/app/~offline/page.tsx` |
| Backup download | Download a `.keepall.zip` copy containing library data and saved media. | `src/persistence/backup-archive.ts`, `src/app/backup-panel.tsx` |
| Restore or merge | Import a Keepall backup and choose whether to merge it or replace the current library. Older Keepall JSON backups are also supported. | `src/app/backup-panel.tsx` |
| Browser bookmark import | Import an HTML bookmark export and choose how browser folders affect collections. | `src/persistence/bookmarks-html-import.ts`, `src/app/backup-panel.tsx` |
| Image folder import | Bring in a folder of supported images and optionally choose a collection. The result reports skipped files. | `src/persistence/image-folder-import.ts`, `src/app/backup-panel.tsx` |
| Storage information | See the browser's estimated storage usage and whether storage protection is granted. | `src/app/settings/storage-health.tsx` |
| App update notice | Reload when Keepall reports that an app update is ready. | `src/app/pwa-update-banner.tsx` |

## Proposed About copy

### Keep the things you want to come back to

Save links, write notes, and keep images and video files together in a personal
library. Organize them when you are ready, then find them by title, tag, or collection.

Free to use. No account needed.

Primary action: **Open your library**. Secondary action: **See how to save**.

### Save while you browse

Keepall Capture adds a save button to Chrome. Click it to keep the page you are
reading. You can also right-click a link or image, or highlight a passage and
save it with its source.

Want to add a note or choose a collection? Press Alt + K, or Option + K on Mac,
to open the save panel without leaving the page.

Actions: **Add to Chrome** and **See the extension guide**.

### Keep related things together

Put recipes, project references, or things to read in collections. Add tags to
connect items across them. Leave new saves in Unsorted when you want to organize
later, or move several items together when you have time.

### Find something you remember

Search by title or tag, browse a collection, or show only links, notes, images,
or videos. Switch between a visual grid and a list to browse the way you prefer.

### Open Keepall like an app

Add Keepall to your desktop or Home Screen and open it from its own icon. You
can keep using it in a browser tab too.

Action: **See installation steps**.

### Know where your library lives

Keepall saves your library in this browser on this device. It does not
automatically sync to another browser or phone. Download a backup from Settings
to keep a separate copy or move your library.

Action: **Learn about storage and backups**.

Editorial note: keep the existing library preview. Follow the extension overview
with a real capture demonstration and the installation overview with a clear
device choice. The full feature inventory belongs in the content reference,
not as dozens of equal-weight cards on About.

## Proposed extension guide

Retain `/help/chrome-capture` so existing links keep working. Use jump links for
setup, saving, image access, and troubleshooting.

### Save from other websites

Keepall Capture lets you save things while you browse in Chrome on a computer.
Your saves go to the Keepall library in the same Chrome profile. You do not need
to leave a Keepall tab open.

### Add Keepall Capture to Chrome

1. Open the Keepall Capture listing in the Chrome Web Store.
2. Choose **Add to Chrome**, review Chrome's permission message, and confirm.
3. Open Chrome's Extensions menu beside the address bar and pin Keepall Capture.
4. Open an ordinary website and click the Keepall icon. Wait for the saved
   confirmation, then open Keepall to find the page in Unsorted.

Open Keepall in the Chrome profile where you installed the extension. A Chrome
profile is the separate browser space you choose from the profile button near
the address bar, such as Personal or Work.

### Choose what to save

| What you want to keep | What to do | What appears in Keepall |
| --- | --- | --- |
| The page you are reading | Click the Keepall toolbar icon. | A link to that page. |
| A link on the page | Right-click the link and choose **Save to Keepall**. | A link to its destination. You do not need to open it first. |
| An image | Right-click the image and choose **Save to Keepall**. | A saved image with a source link. |
| A useful passage | Highlight the text, right-click it, and choose **Save to Keepall**. | The passage in a note attached to its source link. |

New quick saves go to Unsorted. If a source link is already saved, selected text
is added to its existing note. Its collection and tags stay as they are.
Right-clicking an image that is also a link saves the image.

### Add a note or choose a collection

1. On the page you want to save, press **Alt + K** on Windows or **Option + K**
   on Mac.
2. Change the title if needed. Add a note, such as “Try this for the kitchen.”
3. Choose a collection and tags, or create them in the panel.
4. Save and wait for the confirmation.

Closing the panel keeps unfinished edits in that tab. Reopen it to continue.
Reloading the page or closing the tab clears those edits, so save anything you
want to keep first.

### After saving

Use **Open in Keepall** in the confirmation to see the item. Choose **Organize**
to move it to a collection. If **Undo** appears, you can remove the newly saved
item from there. Undo is temporary and is unavailable after you change the item.
You can also open Keepall and delete it later.

### When Chrome asks for image access

An image may be stored on a different website from the page you are viewing.
Chrome may ask for access to that website so Keepall can download the image.
Allow access if you want to save it. Per-website access is the recommended option.

You can optionally allow all websites in the extension's **Options**, under
**Image access**. This grants broader access, so read the explanation before
choosing it. The same section links to Chrome's controls for changing access.

Keepall downloads an image when you choose to save it. Read the
[extension privacy details](https://www.keepall.app/extension-privacy) for what
the extension accesses and how link previews work.

### If something does not work

| Problem | What to try |
| --- | --- |
| The shortcut does nothing | Right-click the extension icon, open **Options**, choose **Saving**, and use **Change shortcut**. Another extension may already use that shortcut. |
| An item seems missing | Open **Options**, then **General**, and check the saved library address and connection. Open Keepall in the same Chrome profile. |
| Keepall cannot connect | Open Keepall while online, then use **Check connection** in Options. Choose **Restore library access** if it appears. Retry the save after the connection succeeds. |
| An image will not save | Check image access. The image may also be unsupported, larger than 20 MiB, or blocked from downloading by its website. |
| Saving fails on a Chrome settings page | Try an ordinary website. Chrome protects its internal pages from capture. |

## Proposed installation guide

Add `/help/install-keepall` and link it from About, Help, and Settings Help.

### Open Keepall from an app icon

Installing Keepall adds an icon so you can open your library without finding a
browser tab. You can also keep using Keepall on the web. The Chrome extension
is a separate install for saving from other websites.

### On a computer with Chrome

1. Open [Keepall](https://www.keepall.app/) in the Chrome profile you use for
   your library.
2. Look for the install icon in the address bar. If it is absent, open Chrome's
   menu, choose **Cast, save, and share**, then **Install page as app**.
3. Confirm installation and open Keepall from its new icon.

These menu steps follow [Chrome's desktop installation guide](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop).

### On Android with Chrome

1. Open [Keepall](https://www.keepall.app/) in Chrome.
2. Open Chrome's menu and choose **Install and create shortcut**, then **Install**.
3. Follow the prompts, then open Keepall from the new icon.

Menu wording can differ by Chrome version. These steps follow
[Chrome's Android guide](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid).

### On iPhone with Safari

1. Open [Keepall](https://www.keepall.app/) in Safari.
2. Open **Share**, then choose **Add to Home Screen**.
3. Turn on **Open as Web App** if offered, then tap **Add**.

Depending on the Safari layout, Share is in the page menu or toolbar. These
steps follow [Apple's Home Screen guide](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios).

### Before moving to another device

Installing Keepall on another device does not bring your existing library with
it. Download a backup from the original library and import it into the new one.
Keep the original copy until you have checked the import.

Editorial note: browser vendors verify the menu instructions above. Test Keepall's
actual install and storage behavior on each target device before publishing a
support claim, especially whether existing Safari data appears in a Home Screen
installation. Do not promise that all installed apps share browser storage.

## Help coverage and illustrations

| Guide | Reader's question | What to include |
| --- | --- | --- |
| Start your library | “How do I save my first thing?” | One example, exact Save item action, and where the result appears. |
| Save from Chrome | “How do I save without returning to Keepall?” | Installation, pinning, the four save actions, optional details, permissions, and recovery. |
| Install Keepall | “How do I put it on my phone or desktop?” | Device-specific steps, optional installation, and separate libraries. |
| Collections, tags, and search | “How will I find this later?” | Unsorted, collections versus tags with examples, pins, filters, grid/list, bulk changes, and accurate search coverage. |
| Images and videos | “What files can I keep?” | Formats, limits, paste, galleries, viewing, and local video playback. |
| Import an existing library | “Do I have to start over?” | Browser HTML export, image folders, backup merge versus replacement. |
| Storage and backups | “Where are my saves, and can I recover them?” | Browser profiles, clearing site data, backup download and restore, and moving devices. |
| Use Keepall offline | “What works without internet?” | Previously loaded library, stored media, unavailable source websites, and previews needing a connection. |

Use a real screenshot beside each unfamiliar action: pinning the Chrome icon,
the unified right-click menu, the save panel, the confirmation actions, and each
device's install prompt. Add a short caption explaining the result. Keep the
written steps usable without the pictures. Refresh older permission-guide
screenshots whose menu wording no longer matches **Save to Keepall**.

## Accuracy checks before publishing

- Confirm the extension version on the live Store listing. The repository's
  release notes last recorded 0.1.0 as published and 0.2.0 as prepared. The live
  listing could not be retrieved during this review. Its recorded URL is
  [Keepall Capture](https://chromewebstore.google.com/detail/keepall-capture/ehloefgfecmfjbncknaoleakbnjhkpea).
- Verify the deployed web app supports the extension actions described above.
- Confirm release of the concurrent search update before promoting search within
  link notes, preview descriptions, or highlighted matching excerpts.
- Describe offline access as access to saved local content after the app has
  loaded and cached. Keepall does not archive full websites for offline reading.
- State that libraries do not automatically sync across devices or browser profiles.
- Keep the preview disclosure near storage/privacy help. Saved URLs may be sent
  to the preview service. “Nothing ever leaves your device” would be inaccurate.
- Avoid promises of unlimited storage or permanent automatic protection. Explain
  backups before readers clear site data or move their library.
- Distinguish app Light/Dark from extension System/Light/Dark.
- Do not advertise a Firefox or Safari extension, AI search, full article
  extraction, PDF reading, website video downloads, or automatic cloud backup.

## Reference and review

[Shiori's download page](https://www.shiori.sh/download) makes the choice between
app and extension visible. Its [Home Screen guide](https://www.shiori.sh/docs/pwa)
places screenshots beside the actions. Those are useful presentation ideas;
the proposed copy and feature descriptions here are specific to Keepall.

Reviewed against the existing About/Help pages, capture UI, domain search and
view rules, media limits, backup/import UI, service worker, theme control,
extension README/manifest/options, and release documentation. This review
checked source and browser-vendor instructions; it did not repeat runtime tests
or verify deployment. This content task changed no application code; concurrent
search changes were observed and recorded separately above.
