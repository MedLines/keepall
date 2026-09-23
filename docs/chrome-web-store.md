# Keepall Capture — Chrome Web Store draft

Item ID: `ehloefgfecmfjbncknaoleakbnjhkpea`

The Store package is already uploaded as a draft. Keep it unpublished until the web bridge that accepts this ID and the privacy page are deployed, and the unpacked extension using this Store ID has passed the capture flow.

## Store listing

**Title and short summary:** Supplied by `extension/manifest.json`; no field to edit here.

**Description** (paste as plain text):

```text
Save the page you're reading to your personal Keepall library with one click. Keepall does not need to be open in a tab.

Click the Keepall Capture toolbar icon to save the current page. A small confirmation appears when the save succeeds. Press Alt+K (Option+K on Mac) to add or edit a title and note, choose plain text or Markdown, and organize the link with collections and tags before saving. If the shortcut is already in use, you can assign it at chrome://extensions/shortcuts.

Your saved library lives in this Chrome profile, in the Keepall web app's local browser storage. No Keepall account is required. Open https://www.keepall.app to browse, search, edit, and back up your library.

Keepall Capture works on ordinary HTTP and HTTPS pages. Chrome's internal pages cannot be captured. The extension accesses the current page only when you click it or use its shortcut.
```

**Category:** Tools (the dashboard shows “PRODUCTIVITY” as a heading, not a selectable category)
**Language:** English

**Store icon:** `icon-128-no-glow.png` (128 × 128 PNG, transparent background)
**Screenshots:** `01-capture-drawer.png` and `02-one-click-save.png` (each 1280 × 800 PNG). The article in these screenshots is illustrative; the extension drawer and toast are captured from the real UI.

The three upload files are in `Desktop/Keepall Store Assets` on the publisher's Windows machine. Use the new no-glow icon; the older `icon-128.png` remains there only for comparison.

**Global promo video:** Leave empty.  
**Small promo tile:** Leave empty.  
**Marquee promo tile:** Leave empty.  
**Official URL:** None unless `keepall.app` has been verified in the publisher account.  
**Homepage URL:** `https://www.keepall.app/`  
**Support URL:** `https://github.com/MedLines/keepall/issues` only after the repository is publicly reachable. It currently returns HTTP 404 to an anonymous visitor and blocks submission. Otherwise create a public support page and use that URL.
**Mature content:** Off.

## Privacy practices

**Single purpose:**

```text
Save the current browser page to the user's local Keepall library, with optional title, note, collection, and tag choices.
```

**Permission justifications:**

| Permission | Paste-ready explanation |
| --- | --- |
| `activeTab` | Read the URL and title of the current page only after the user clicks the toolbar icon or invokes the capture shortcut. |
| `scripting` | Show the capture drawer or save-result toast on the current page and notify an already open Keepall tab after a confirmed save. |
| `offscreen` | Hold an invisible Keepall bridge page so a save can reach the user's existing local Keepall database without opening a visible tab. |
| `storage` | Keep the selected Keepall address and hold a pending capture briefly for retry. Confirmed captures are removed; pending captures expire after ten minutes and are cleared at the next cleanup. |
| `alarms` | Run periodic cleanup of expired pending captures. |
| `https://www.keepall.app/*` | Load the Keepall bridge and refresh open Keepall tabs after a save. The user's library is stored under this website origin in the browser. |
| `http://localhost/*` | Allow a user running Keepall locally to point the extension to a localhost development address in Options. The default is the production Keepall address. |

**Host permission justification** (paste into the single host-permission box):

```text
https://www.keepall.app/* lets the extension load the hidden Keepall bridge page, save a selected link to the user's local Keepall library, and refresh an already open Keepall tab after a save. http://localhost/* lets a user running Keepall locally select a localhost address in Options. The extension only reads the current tab after the user clicks its icon or invokes Alt+K.
```

**Remote code:** Select **Yes**, then paste:

```text
The extension embeds https://www.keepall.app/extension-bridge in an iframe inside its offscreen document. The Keepall website's script runs only in that isolated iframe, with no access to extension APIs. It writes a user-requested capture into the Keepall website origin's local IndexedDB without opening a visible tab. The extension worker and page scripts are all packaged; they do not fetch or evaluate remote JavaScript.
```

Google's Manifest V3 policy permits remote code in an iframe isolated from extension APIs when the behavior is reviewable and follows user-data rules. Disclosing this iframe is the transparent choice for the form.

**Data usage checkboxes:** Select **Web history** for the saved page URL and title, and **Website content** for the selected page title/link and user-entered capture text. If your form also has a **User-generated content** option below the visible screenshot, select it for titles, notes, collection names, and tag names. Leave unrelated categories unchecked. The extension does not automatically read Chrome history or full webpage bodies; only pages the user chooses to save. Local-only handling still needs disclosure.

**Certifications:** Check all three statements shown in the dashboard. Current code uses data for the capture feature, does not sell it or use it for lending, and the privacy policy describes the preview-service exception.

**Privacy policy URL:** `https://www.keepall.app/extension-privacy` — enter this after the new page is deployed and publicly reachable.

## Distribution and test instructions

**Visibility:** Public if the goal is for anyone to find and install it. Unlisted is an alternative if access by direct Store link is preferred.  
**Pricing:** Free.  
**Regions:** All supported regions unless the publisher wants a narrower release.

**Review test instructions** (367 characters, within the dashboard's 500-character limit):

```text
No account is needed. Install in Chrome and open https://www.keepall.app once in the same profile. On a normal HTTPS page, click the Keepall toolbar icon; a save toast appears and the link appears in Keepall without refreshing. On another page press Alt+K (Option+K on Mac), add a note and choose a collection or tag, then save. Chrome internal pages cannot be saved.
```

The current saved reviewer instructions end mid-sentence at the 500-character limit. Replace them with the text above. In the publisher Settings page, add and verify a contact email before submitting. Google says this email is displayed publicly with the item.

Do not submit for review until the Store-ID web bridge and privacy URL are deployed, the unpacked extension using this Store ID passes this flow, and the listing disclosures match the deployed behavior. After approval, install the Store version and repeat the flow before announcing it.
