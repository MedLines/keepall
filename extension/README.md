# Keepall Capture

Load this directory as an unpacked extension at `chrome://extensions` with
Developer mode enabled. Pin **Keepall Capture** to the toolbar. A click saves the
current HTTP(S) page directly to the same local Keepall library in this Chrome
profile. No Keepall tab needs to remain open. If one is open, its Library updates
after a confirmed save. The badge and an animated top-right toast confirm the
write; an error never reports success.

Alt/Option+K opens a Keepall-style drawer over the current page for an optional
title and personal note. It also loads collections and tags from your library.
Six quick choices appear for each; **Browse all** searches the complete list,
and the inputs can create new collections and tags. A successful drawer save
replaces the form with a centered checkmark and confirmation before the drawer
closes. Feedback names a collection-only move, confirms other saved changes,
or says “This link was already saved” when nothing changed. A failed save keeps
the form open and shows an error toast.

When the page is already saved, the drawer loads its title, note, Markdown
choice, collection, and tags. You can edit the title and note there. If the
link changes in Keepall while the drawer is open, reopen the drawer before
saving. Notes containing local images show their text read-only; edit those
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
menu entry for both links and images, with no submenu. When an image is also a link, Keepall saves the image itself and retains the containing
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
