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

**Category:** Productivity  
**Language:** English

**Store icon:** `icon-128.png` (128 × 128 PNG)  
**Screenshots:** `01-capture-drawer.png` and `02-one-click-save.png` (each 1280 × 800 PNG). The article in these screenshots is illustrative; the extension drawer and toast are captured from the real UI.

The three files are in `Desktop/Keepall Store Assets` on the publisher's Windows machine.

**Global promo video:** Leave empty.  
**Small promo tile:** Leave empty.  
**Marquee promo tile:** Leave empty.  
**Official URL:** None unless `keepall.app` has been verified in the publisher account.  
**Homepage URL:** `https://www.keepall.app/`  
**Support URL:** `https://github.com/MedLines/keepall/issues`  
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

**Remote code / external page explanation:**

```text
The extension worker and content scripts use only files packaged with the extension. An isolated iframe in the offscreen extension page loads https://www.keepall.app/extension-bridge, a normal Keepall web page with no extension API access. Its script writes the capture to that website origin's IndexedDB in the user's browser. The extension does not fetch JavaScript to evaluate in its worker or content scripts. This iframe is needed because browser storage is separated by origin and avoids opening a visible Keepall tab.
```

If the dashboard asks whether remote code is used, disclose this iframe and use the explanation above. Chrome's Manifest V3 policy expressly treats code inside an iframe isolated from extension APIs as an exception, but still requires the interaction to be understandable to reviewers.

**Data types:** Disclose the current page URL and title as web browsing activity / website content, and user-entered titles, notes, collections, and tags as user-generated content. Do not select “no user data”: local processing still counts for Chrome's disclosure. Certify the limited-use statements only after checking them against the current form. The extension does not sell data or use it for ads.

**Privacy policy URL:** `https://www.keepall.app/extension-privacy` — enter this after the new page is deployed and publicly reachable.

## Distribution and test instructions

**Visibility:** Public if the goal is for anyone to find and install it. Unlisted is an alternative if access by direct Store link is preferred.  
**Pricing:** Free.  
**Regions:** All supported regions unless the publisher wants a narrower release.

**Review test instructions** (if requested):

```text
No account or test credentials are needed. Install the extension in Chrome, then open https://www.keepall.app in the same browser profile. Visit any ordinary HTTPS page and click the Keepall Capture toolbar icon. A success toast should appear; return to Keepall to see the new link without refreshing. On another page, press Alt+K (Option+K on Mac) to open the capture drawer, add a note, select a collection or tag, and save. Chrome internal pages cannot be captured. The extension's default library address is https://www.keepall.app.
```

Do not submit for review until the Store-ID web bridge and privacy URL are deployed, the unpacked extension using this Store ID passes this flow, and the listing disclosures match the deployed behavior. After approval, install the Store version and repeat the flow before announcing it.
