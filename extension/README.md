# Keepall Capture

Load this directory as an unpacked extension at `chrome://extensions` with
Developer mode enabled. Pin **Keepall Capture** to the toolbar. A click saves the
current HTTP(S) page directly to the same local Keepall library in this Chrome
profile. No Keepall tab needs to remain open. The badge and an animated
top-right toast confirm the write; an error never reports success.

Alt/Option+K opens a Keepall-style drawer over the current page for an optional
title and personal note. It also loads collections and tags from your library.
Six quick choices appear for each; **Browse all** searches the complete list,
and the inputs can create new collections and tags. A successful drawer save
replaces the form with a centered checkmark and confirmation before the drawer
closes. A failed save keeps the form open and shows an error toast. Without a
collection choice, a new link goes to Unsorted. A toolbar click leaves the organization of an already
saved link alone. If the shortcut is already claimed, assign it at
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
