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
