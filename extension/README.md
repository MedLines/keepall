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
link or image, never an update or duplicate. Undo removes the new item and its
unreferenced image assets, but refuses if the item was edited, organized, or
pinned after saving. Automatic link previews do not prevent Undo. Actions stay
visible for eight seconds and pause while hovered or keyboard-focused. Undo is
available for up to one minute and requires the same live bridge; if it expires,
the toast explains that you can remove the item in Keepall instead.
The action's library and item IDs stay in extension session storage until the
next quick-save notification, navigation, tab closure, or browser restart.
The drawer keeps its existing centered save confirmation.
New quick saves identify the type: “Link saved to Keepall” or
“Image saved to Keepall.” An older deployed bridge can still save and open items,
but it cannot offer Undo until the updated web app is deployed.

Alt/Option+K opens a Keepall-style drawer over the current page for an optional
title and personal note. It also loads collections and tags from your library.
Six quick choices appear for each; **Browse all** searches the complete list,
and the inputs can create new collections and tags. A successful drawer save
replaces the form with a centered checkmark and confirmation before the drawer
closes. Feedback names a collection-only move, confirms other saved changes,
or says “This link was already saved” when nothing changed. A failed save keeps
the form open and shows an error toast.

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
