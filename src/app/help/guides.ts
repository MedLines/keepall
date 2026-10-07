import type { GuideVisual } from "./guide-visual";

export const CHROME_EXTENSION_URL = "https://chromewebstore.google.com/detail/keepall-capture/ehloefgfecmfjbncknaoleakbnjhkpea";

type GuideLink = { label: string; href: string };

export type GuideSection = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  note?: string;
  links?: GuideLink[];
  visual?: GuideVisual;
  images?: { src: string; width: number; height: number; alt: string; caption: string }[];
};

export type Guide = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  minutes: string;
  sections: GuideSection[];
  action?: GuideLink;
};

export const guides: Guide[] = [
  {
    slug: "getting-started", category: "The basics", title: "Start your library",
    summary: "Save your first link, note, image, or video. No account needed.", minutes: "2 min read",
    sections: [
      {
        id: "first-save", visual: { kind: "image", src: "/help/save-panel.webp", width: 960, height: 1720, alt: "Keepall’s Save to Keepall panel with its link, note, and media controls", caption: "Choose Save item to open this panel.", portrait: true }, title: "Save your first link",
        paragraphs: ["Start with a page you want to come back to, such as a recipe or an article."],
        steps: ["Copy the page's address and open your Keepall library.", "Choose Save item and paste the address. The default app shortcut is Alt + K, or Option + K on Mac. You can change it in Settings, General, App shortcuts.", "Add a title or a note if you want to remember why you saved it, then save."],
        note: "Your new link appears in Unsorted unless you choose a collection. Keepall tries to add a preview while you are online; the link is still saved if a preview is unavailable.",
      },
      {
        id: "more-than-links", title: "Keep more than links",
        paragraphs: ["Use Save item to write a standalone note, choose image files, paste an image, or add a video file from your device. You can attach a note to a link, image, or video too.", "Notes start as plain text. Turn on Markdown if you want to use formatting such as headings and lists."],
        links: [{ label: "See supported images and videos", href: "/help/images-and-videos" }],
      },
      {
        id: "find-it", visual: { kind: "video", src: "/marketing/library-demo", poster: "/marketing/app-library.webp", caption: "Switch between the library’s grid and list views." }, title: "Come back to what you saved",
        paragraphs: ["Search by title or tag, open a collection, or filter by item type. Switch between the visual grid and list to browse your saves.", "Choose Preview beside the grid/list controls to browse the current collection, tag, or search results without opening a full page. It starts at the last focused item, or the first result. To start from a specific item, right-click it or open its three-dot menu and choose Preview.", "Use Tab to focus a card or row, then arrow keys to browse in the current result order. Space opens a quick preview; arrows keep browsing while it stays open. Escape returns focus to the last previewed item, and Enter opens its full page. Shift plus an arrow extends a selection. Gallery image buttons stay separate from browsing between saved items. Choose Fit to see the whole image or Scroll to read long images at the available width. Image notes scroll separately below the media.", "Open an item to read its details. For a saved link, choose Open source to visit the original page. Use Edit to change the details or Delete to remove an item after confirming."],
        links: [{ label: "Learn about collections and tags", href: "/help/collections-and-tags" }],
      },
      {
        id: "save-from-browser", title: "Make the next save easier",
        paragraphs: ["Keepall Capture adds a save button to Chrome on your computer. You can also install Keepall itself to open your library from an app icon. Both are optional."],
        links: [{ label: "Set up the Chrome extension", href: "/help/chrome-capture" }, { label: "Install Keepall on your device", href: "/help/install-keepall" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "saved-articles", category: "Capture", title: "Save articles for offline reading",
    summary: "Keep readable website text beside your personal notes.", minutes: "2 min read",
    sections: [
      { id: "capture", title: "Save an article's text", paragraphs: ["Save the website as a link, then open its details and choose Save article. Keepall extracts the article's text and stores it with its title, source URL, capture date, and author when available. Your personal note stays separate.", "Choosing Save article sends the link's URL to Keepall's server, which requests the public page. Your personal notes, tags, and collections are not included. Capture needs a connection; opening a saved article does not request the website again."] },
      { id: "read", title: "Read and search the saved copy", paragraphs: ["When Keepall is available offline in this browser, open the link to read its saved text. Search also finds words in the article, its title, and author. Open original visits the website and normally needs a connection.", "Update saved article captures a fresh copy. Editing the link's URL clears its old article so another website's text does not stay attached. Editing your title or personal note keeps the article."] },
      { id: "limits", title: "When capture cannot read a page", paragraphs: ["Some websites require a login, block automated requests, or load their text only after running scripts. Keepall does not sign in or run the website's scripts. Capture stores readable text, so website images, videos, interactive elements, and original formatting are not included.", "If capture fails, your link, note, and any previously saved article stay available. Use Retry saving article when the connection or website improves, or open the original. Very large pages and articles exceed capture limits; you can import a .txt, .md, or .pdf copy as a document instead."] },
      { id: "backup", title: "Back up saved articles", paragraphs: ["Saved article text and metadata are included in Keepall backups, along with your link and note. Export a backup before clearing site data or moving browsers."], links: [{ label: "Open backup settings", href: "/settings#backup-heading" }] },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "chrome-capture", category: "Capture", title: "Save from Chrome",
    summary: "Add the extension, then keep pages, links, images, and useful passages without leaving the website.", minutes: "5 min read",
    sections: [
      {
        id: "install", title: "Add Keepall Capture to Chrome",
        paragraphs: ["Keepall Capture is an extension for Chrome on a computer. It saves to your Keepall library without needing a Keepall tab open."],
        steps: ["Open Keepall Capture in the Chrome Web Store using the link below. Choose Add to Chrome, review the permission message, and confirm.", "Open Chrome's Extensions menu beside the address bar and pin Keepall Capture. Its icon will stay beside the address bar.", "Open a website and click the Keepall icon. Wait for the saved confirmation, then open Keepall to find the page in Unsorted."],
        links: [{ label: "Add Keepall Capture to Chrome", href: CHROME_EXTENSION_URL }],
        note: "The right-click actions and save confirmation tools below require Keepall Capture 0.2.0 or later. If they are missing, check the version in Chrome's Manage extensions page and whether an update is available.",
      },
      {
        id: "save-page", visual: { kind: "video", src: "/marketing/capture-page-demo", poster: "/marketing/capture-page-poster.webp", caption: "Click the extension icon, then wait for the saved confirmation." }, title: "Save the page you are reading",
        paragraphs: ["Click the Keepall icon in Chrome's toolbar. The page is saved as a link, and a confirmation appears when it succeeds. New links go to Unsorted, ready to organize later.", "Saving an existing link again keeps its collection and tags. Chrome's settings pages and other protected browser pages cannot be captured."],
      },
      {
        id: "right-click", visual: { kind: "video", src: "/marketing/capture-text-demo", poster: "/marketing/capture-text-poster.webp", caption: "Select text, right-click, and choose Save to Keepall." }, title: "Save a link, an image, or selected text",
        paragraphs: ["Use the same Save to Keepall menu action for each. What you right-click decides what gets saved."],
        steps: ["For a link, right-click it and choose Save to Keepall. Keepall saves its destination without opening the linked page.", "For an image, right-click it and choose Save to Keepall. Keepall stores the image itself with a link to its source. Chrome may ask for website access.", "For text, highlight the passage first, then right-click and choose Save to Keepall. The passage becomes a note attached to its source link."],
        note: "If the source link already exists, selected text is added to its note. Repeating the same complete passage does not add it twice. An image that is also a link is saved as an image.",
      },
      {
        id: "add-details", visual: { kind: "video", src: "/marketing/capture-notes-demo", poster: "/marketing/capture-notes-poster.webp", caption: "Open the extension’s save panel with Alt + K to add a note." }, title: "Add a note before saving",
        paragraphs: ["Use the save panel when you want to add context or organize a page as you save it. Notes can be plain text or Markdown. Switch on Markdown to use headings, lists, and emphasis."],
        steps: ["Press Alt + K on Windows or Linux, or Option + K on Mac, while viewing the page.", "Change the title, add a note, and choose a collection or tags. Browse all searches the full list; you can create new collections and tags here too.", "Save and wait for the confirmation. If the page was already saved, this panel lets you update its existing details."],
        note: "Closing the panel keeps unfinished edits in that tab. Reopen it to continue, or use Discard draft to clear them. Reloading the page or closing the tab clears the draft. Notes containing local images must be edited in Keepall.",
      },
      {
        id: "after-saving", visual: { kind: "video", src: "/marketing/capture-organize-demo", poster: "/marketing/capture-organize-poster.webp", caption: "Choose Organize in the saved confirmation to pick a collection." }, title: "Open, organize, or undo a save",
        paragraphs: ["After a quick save, choose Open in Keepall in the confirmation to see the item, or Organize to choose a collection.", "Undo appears for a newly saved item. It is available briefly and cannot remove an item you have since edited, organized, or pinned. If the confirmation has gone, open the item in Keepall and use Delete."],
      },
      {
        id: "image-access", title: "When Chrome asks for image access",
        paragraphs: ["An image can be hosted on a different website from the page you are reading. Chrome may ask for access to that image's website so Keepall can download it. Allow access if you want to save it. Per-website access is the recommended choice.", "To manage this, right-click the Keepall toolbar icon, open Options, and choose Image access. You can optionally allow all websites there. Chrome's warning describes broader website access, so read the explanation before granting it. The same section links to Chrome's controls for changing access.", "Keepall downloads images when you choose to save them. Images must be PNG, JPEG, GIF, WebP, or AVIF, up to 20 MiB. A website can still prevent an image from downloading."],
        images: [
          { src: "/help/permission-one-website.png", width: 669, height: 318, alt: "Chrome asks to read and change data on pbs.twimg.com, with Allow and Deny buttons.", caption: "Recommended: allow the website hosting the image. The website address will depend on the image you save." },
          { src: "/help/permission-all-websites.png", width: 672, height: 306, alt: "Chrome asks to read and change data on all websites, with Allow and Deny buttons.", caption: "Optional: access to all websites. This broader permission is available in Options; it is not required to start using Keepall." },
        ],
        links: [{ label: "Read extension privacy details", href: "/extension-privacy" }],
      },
      {
        id: "find-saves", title: "Where your saves go",
        paragraphs: ["The extension normally saves to www.keepall.app in the same Chrome profile. A profile is the separate browser space you choose from Chrome's profile button, such as Personal or Work. Open Keepall in that same profile to see your saves.", "To check the destination, right-click the extension icon, open Options, then General. Check connection tells you whether the extension can reach that library. This does not sync it to another browser or device."],
      },
      {
        id: "troubleshooting", title: "If saving or the shortcut does not work",
        paragraphs: ["If the shortcut does nothing, open Options, choose Saving, then Change shortcut. Another extension may already use Alt + K. Assign an available shortcut in Chrome and return to the page.", "If a save fails, open Keepall while online. In Options, choose General, then Check connection. Use Restore library access if it appears, then retry the save.", "If an item seems missing, check the saved library address and Chrome profile, then look in Unsorted. If an image fails, check Image access and the file limits above."],
        links: [{ label: "Get help with a problem", href: "https://github.com/MedLines/keepall/issues" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "install-keepall", category: "Installation", title: "Open Keepall like an app",
    summary: "Add Keepall to your computer or phone and open your library from its own icon.", minutes: "2 min read",
    sections: [
      {
        id: "choose", title: "The app and extension do different things",
        paragraphs: ["Installing Keepall gives you an icon for opening your library. Keepall Capture is the separate Chrome extension for saving from other websites on a computer. You can use either, both, or just the website."],
        links: [{ label: "Looking for the Chrome extension?", href: "/help/chrome-capture#install" }],
      },
      {
        id: "computer", visual: { kind: "install", platform: "computer" }, title: "On a computer with Chrome",
        paragraphs: [],
        steps: ["Open www.keepall.app in the Chrome profile you use for your library.", "Choose the install icon in the address bar. If it is absent, open Chrome's menu, choose Cast, save, and share, then Install page as app.", "Confirm installation. Open Keepall from its new icon."],
        links: [{ label: "Chrome's computer installation guide", href: "https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop" }],
      },
      {
        id: "android", visual: { kind: "install", platform: "android" }, title: "On Android with Chrome",
        paragraphs: [],
        steps: ["Open www.keepall.app in Chrome.", "Open Chrome's menu and choose Install and create shortcut, then Install. Depending on your version, this may be called Add to Home screen or Install app.", "Follow the prompts, then open Keepall from its new icon."],
        links: [{ label: "Chrome's Android installation guide", href: "https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid" }],
      },
      {
        id: "iphone", visual: { kind: "install", platform: "iphone" }, title: "On iPhone or iPad with Safari",
        paragraphs: ["Add Keepall to your Home Screen before you start saving. The Home Screen app has its own library, separate from Safari. If you already have saves in Safari, export a backup there and import it in the Home Screen app."],
        steps: ["Open www.keepall.app in Safari.", "Open Share from the toolbar or page menu, then choose Add to Home Screen.", "Turn on Open as Web App if offered, then tap Add. Open Keepall from the Home Screen icon."],
        links: [{ label: "Apple's Home Screen guide", href: "https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios" }],
      },
      {
        id: "existing-library", visual: { kind: "transfer" }, title: "Keep your existing library",
        paragraphs: ["Installation does not sync your library. A different browser, profile, or device has its own saved data. On iPhone and iPad, the Home Screen app has separate storage from Safari; installing does not copy your existing library.", "Before switching, download a backup from the library that holds your saves. If the new app opens an empty library, import that backup there. Keep the original copy until you have checked the import."],
        links: [{ label: "Back up and move your library", href: "/help/storage-and-backups" }, { label: "See what works offline", href: "/help/offline" }],
      },
    ],
    action: { label: "Open Keepall", href: "/" },
  },
  {
    slug: "collections-and-tags", category: "Organize", title: "Find a place for everything",
    summary: "Use collections, tags, pins, and search. You can always organize after saving.", minutes: "3 min read",
    sections: [
      { id: "collections", visual: { kind: "video", src: "/marketing/collections-demo", poster: "/marketing/app-collection.webp", caption: "Choose a collection from the sidebar to see its items." }, title: "Group things in collections", paragraphs: ["A collection brings related saves together, such as Recipes or Living room ideas. Choose one when saving, move an item later, or drag library items onto a collection in the sidebar.", "Items with no collection appear in Unsorted. Leaving something there does not make it temporary."] },
      { id: "unsorted-review", title: "Review Unsorted one item at a time", paragraphs: ["Open Unsorted and choose Review Unsorted. It uses the same fixed-size preview as browsing and includes every item without a collection, even when the library has search or type filters.", "Choose or create a collection, then File and next. Add tags without leaving the item. Skip keeps the item in Unsorted, and Delete moves it to Trash before showing the next item. Items with only tags stay in Unsorted too.", "The progress count tracks positions reviewed in this session. Undo restores the previous action and returns to its place, including after the last item. Undo stays available until you close review. Tab reaches each action, and Escape returns to the library."] },
      { id: "tags", visual: { kind: "video", src: "/marketing/tags-demo", poster: "/marketing/app-tags.webp", caption: "Add a tag from an item’s menu, then filter the library by that tag." }, title: "Connect ideas with tags", paragraphs: ["Tags describe an item across collections. For example, a lamp and a paint color in different collections could both have the tag warm tones. An item can have several tags.", "Right-click an item in the library to find, add, or remove tags. You can create a new tag there too. Select a tag in the sidebar to see matching items."] },
      { id: "app-shortcuts", title: "Choose your app shortcuts", paragraphs: ["The defaults are Alt/Option + K to save an item, / to focus search, Alt/Option + G to switch grid and list, and Alt/Option + P to preview results. Assigned keys appear beside the library actions or in their tooltips.", "Open Settings, General, App shortcuts. Select a shortcut field and press your preferred Alt/Option plus letter or number, optionally with Shift, or /. Keepall rejects duplicate keys and common browser reservations. Reset to defaults restores the original assignments.", "App shortcuts pause in typing fields, text editors, and dialogs. Preferences are saved on this device and included in backups. Replace restores the backup's assignments; Merge keeps this device's current assignments. The Chrome capture extension has its own shortcut settings."], links: [{ label: "App shortcut settings", href: "/settings#keyboard-shortcuts-heading" }] },
      { id: "pins", title: "Keep frequent items close", paragraphs: ["Pin collections in the sidebar and change their order. Inside a collection, pin important items to keep them above the rest.", "To tidy several saves together, select them and use the selection controls to move them, change their tags, or delete them. Read the confirmation before deleting the selection."] },
      { id: "search", visual: { kind: "video", src: "/marketing/search-demo", poster: "/marketing/app-search.webp", caption: "Search with words you remember." }, title: "Find something you remember", paragraphs: ["Search titles, tags, saved notes, saved articles, imported text, Markdown, and selectable PDF text, image captions, previews, and source addresses. Every word must match somewhere in the item, in any order. For example, react animation finds a save with React in its title and animation in its note. Put a phrase in double quotes to keep those words together. File matches include a highlighted excerpt. Search includes image text after you open the image and choose Read text in Image tools. It does not listen to videos.", "Narrow the results by collection, tag, or item type. If something seems missing, clear those filters. Choose Best match to put title matches above mentions in notes or source addresses, or choose newest or oldest first. Pinned items stay first inside a collection. Best match is available while searching. Clearing the search shows newest first if Best match was selected. Switch between grid and list to change how you browse."] },
    ],
    action: { label: "Browse your library", href: "/" },
  },
  {
    slug: "images-and-videos", category: "Media", title: "Keep images and videos",
    summary: "Paste images, build a gallery, and keep video files from your device.", minutes: "2 min read",
    sections: [
      { id: "images", visual: { kind: "video", src: "/marketing/capture-image-demo", poster: "/marketing/capture-image-poster.webp", caption: "With the extension, right-click an image and choose Save to Keepall." }, title: "Add an image", paragraphs: ["Open Save item and choose Add files, or paste an image with Ctrl/⌘ + V. Add a title, a note, and a source link if you want to remember where an image came from.", "Keepall accepts PNG, JPEG, GIF, WebP, and AVIF images up to 20 MiB each. Unsupported or oversized files need to be converted or made smaller before saving."], links: [{ label: "Save images directly from websites", href: "/help/chrome-capture#right-click" }] },
      { id: "gallery", title: "Keep related images together", paragraphs: ["One image item can hold several pictures. Open it to browse the gallery, add more images, or replace or remove the current image. The first image is the cover. Choose Scroll to read the whole gallery vertically, or Slides to view one image at a time. Switching views keeps your place.", "Select the large image to view it full screen. You can zoom in and move through the gallery. Close the viewer to return to the item's details."] },
      { id: "palette", title: "Copy colors and filter images", paragraphs: ["Open a saved image and choose Extract palette in Image tools. Select a color value to copy its hex code, or choose Find similar images beneath a swatch to search your library. Colors are sampled locally from the current image, with up to six dominant colors.", "You can also search color:red, color:blue, or color:#FF0000. Hex searches find nearby colors; named searches match a color family. Combine a color with words, such as color:red receipt. All terms must match. Unknown color names return no matches. Only images with an extracted palette can match."] },
      { id: "image-text", title: "Make screenshot text searchable", paragraphs: ["In Image tools, choose Read text to recognize English text in the current image. Progress appears while it runs, and Cancel stops recognition. Review the result, copy it, or search its words from the library. If recognition fails, use Read text again to retry. Sharper screenshots and closer crops usually work better.", "Each gallery image keeps its own palette and text. Replacing or removing an original removes its analysis. Recognition and palette extraction run on your device without uploading images. Backups include saved palettes and recognized text alongside the originals.", "The recognition engine and English data load from Keepall's own files when you first use Read text. First use needs a connection to Keepall. Later offline recognition depends on your browser retaining every engine file and the app; a cache miss requires reconnecting. Text already extracted remains available locally and searchable. Other languages and OCR for scanned PDF pages are not supported by this image tool."] },
      { id: "videos", title: "Add a video from your device", paragraphs: ["Use Save item to choose an MP4 or WebM file up to 100 MiB. Give it a title or note, then open the saved item to play it. Playback depends on whether your browser supports the file's video format.", "Saving a link to an online video keeps its web address. It does not download the video file."] },
      { id: "media-backup", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Backup settings with Export backup and Import backup buttons", caption: "Export backup includes the image and video files stored in your library." }, title: "Keep a copy of your media", paragraphs: ["Images and local video files are part of your browser's library. A Keepall ZIP backup includes those files. Download one before clearing site data or changing devices."], links: [{ label: "Import files or a folder", href: "/help/import#images" }, { label: "Download a library backup", href: "/help/storage-and-backups#download" }] },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "import", category: "Bring your saves", title: "Bring an existing library",
    summary: "Import documents, browser bookmarks, images, or a Keepall backup.", minutes: "3 min read",
    sections: [
      {
        id: "documents", title: "Import documents",
        steps: ["Open Save item, or use its assigned app shortcut, then choose Add files.", "Choose UTF-8 .txt or .md files up to 10 MiB each, or PDFs up to 50 MiB and 1,000 pages. One text file opens as editable text. PDFs and multiple files save as separate items.", "Choose tags and a collection below your files, then Save. If some files fail, Retry failed files keeps items that already saved."],
        paragraphs: ["Text and Markdown files appear under Notes. Files are read and saved locally. Open a document to read or edit its text, add a personal note, or download the saved file. Editing changes Keepall’s copy; the file on your device stays unchanged. Markdown images and embedded HTML do not load. Large files have a shortened preview; download the file for the full text.", "Search finds text anywhere in the saved file, including beyond a shortened preview, along with its title, filename, personal note, and tags. File-content search runs locally and may take longer for larger libraries. Keepall backups include the saved files and their edits.", "PDFs appear under Documents. Open one to browse pages, zoom, select text, add a personal note, or download the original. PDF files stay unchanged when you edit their title or note. Password-protected PDFs need an unlocked copy. Scanned PDFs are viewable, but searching their page images needs OCR. PDF viewing and extraction run locally."],
      },
      {
        id: "bookmarks", title: "Import browser bookmarks",
        paragraphs: ["Start with an HTML bookmark export from your browser. A Keepall backup uses a different format."],
        steps: ["Use your browser's bookmark manager to export bookmarks as an HTML file.", "Open Save item, or use its assigned app shortcut, then choose Bulk import and Import bookmarks HTML. Select the exported file.", "Review how bookmark folders will be used for collections, then confirm the import and read the result."],
      },
      {
        id: "images", title: "Import files or a folder",
        paragraphs: ["Bulk import reads nested folders too. For multiple images, choose one image item with a gallery or separate image items. Documents, video, and mixed selections always save as separate items. HTML documents are not supported yet."],
        steps: ["Open Save item, or use its assigned app shortcut, then choose Bulk import. Choose Import files to select several files, or Import folder to bring in a folder.", "Your files appear in the drawer. For multiple images, choose One image item to add a caption, or Separate image items. Add files stays available. Choose tags and a collection below; folders start with their name as the collection. Choose Unsorted to remove it.", "Choose Save when ready. Cancel before saving leaves your library unchanged. Keepall lists any failed files; Retry failed files keeps items that already saved."],
      },
      {
        id: "backup", visual: { kind: "transfer" }, title: "Restore a Keepall backup",
        paragraphs: ["Use a .keepall.zip file or an older Keepall JSON backup. In Settings, choose Storage & backups, then Import backup. Keepall checks the whole file before showing its date, item counts, Trash, tags, collections, and media beside your current library totals.", "Merge adds missing items. Matching items may take newer saved details, and their tags combine. Replace library opens a separate confirmation showing both library totals, including Trash. Download a fresh backup first if you may want to keep your current items.", "After importing, check a few notes and media items before deleting your original copy."],
        links: [{ label: "Understand storage and backups", href: "/help/storage-and-backups" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "storage-and-backups", category: "Your data", title: "Understand storage and backups",
    summary: "Know where your library lives, keep a separate copy, and move it when you need to.", minutes: "3 min read",
    sections: [
      { id: "storage", title: "Your browser holds the library", paragraphs: ["Keepall saves your links, notes, images, videos, collections, and tags in this browser profile on this device. You do not need an account. Another browser, profile, or device has a separate library. There is no automatic cloud sync.", "Clearing Keepall's site data can erase the library. Browser storage can also be removed by the browser or device. A downloaded or folder backup gives you a separate recovery copy."] },
      {
        id: "download", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Keepall Backup settings showing Export backup and Import backup", caption: "Choose Export backup to download your library." }, title: "Download a backup",
        paragraphs: ["Make a backup after important additions and before clearing browser data, resetting a device, or changing browsers."],
        steps: ["Open Settings, choose Storage & backups, and find the Backup section.", "Choose Export backup. Keepall downloads a .keepall.zip file containing library data and saved images and videos.", "Keep that file somewhere you can find it again. For protection against losing the device, keep a copy on another device or storage service you choose."],
        links: [{ label: "Open backup settings", href: "/settings#backup-heading" }],
      },
      {
        id: "automatic", title: "Back up automatically to a folder",
        paragraphs: ["In a browser that supports folder backups, open Settings, choose a dedicated empty Keepall Backups folder, and allow read and write access. Keepall saves the first backup immediately. The browser may remember access for future visits and app updates. Other browsers can use Export backup.", "While Keepall is open, changed library data is backed up every 30 minutes. Inactive tabs or a sleeping device can delay it until you return. No file is created when nothing has changed. Background checks never request permission; use Reconnect folder if access is lost. A failed save preserves completed backups and retries after 30 minutes, or you can choose Back up now.", "Keepall keeps the latest three verified backups for this library in the chosen folder. If a previously backed-up library becomes empty, backups and cleanup pause so recovery copies remain available. Import a saved backup or add an item to resume. Turn off folder backups stops future saves and leaves completed files in place.", "To recover, use Import backup and select a saved .keepall.zip file. Clearing browser data also forgets the folder connection, so choose a folder again after restoring. Backups on this device do not protect against losing the device; keep a separate copy elsewhere when you need that protection."],
        links: [{ label: "Open backup settings", href: "/settings#backup-heading" }],
      },
      { id: "restore", visual: { kind: "transfer" }, title: "Restore or move your library", paragraphs: ["Open Keepall in the destination browser and import your backup from Settings. Review the validated file and current totals. Merge adds missing items and may update matching items from newer saved details; tags combine. Replace library requires a separate confirmation and removes the current library, including Trash.", "Keep the original copy until you have checked the restored items. Importing a backup is a one-time transfer; it does not keep two libraries in sync."], links: [{ label: "Follow the import guide", href: "/help/import#backup" }] },
      {
        id: "mobile", title: "Storage on Android and iPhone",
        paragraphs: ["Chrome on Android and Safari on modern iPhones and iPads support the local storage Keepall uses, including saved images and videos. How much fits depends on your browser and free device space. Installing the app does not give you unlimited storage.", "Keepall asks the browser to protect your library from automatic cleanup. The browser decides whether to grant that protection; installing and regularly using the app can help. Check the storage status in Settings. Without protection, your browser may remove data when space runs low. Clearing site data yourself can erase even a protected library.", "On iPhone and iPad, install Keepall on your Home Screen before building your library. Its storage is separate from Safari. To move existing saves, export a backup in Safari and import it after opening the Home Screen app.", "Download a ZIP backup after important additions, and keep a copy outside the app. Avoid private browsing for a library you want to keep."],
        links: [{ label: "Apple's web storage policy", href: "https://webkit.org/blog/14403/updates-to-storage-policy/" }, { label: "How Chrome protects local storage", href: "https://web.dev/articles/persistent-storage" }, { label: "Apple's Home Screen storage separation", href: "https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps" }],
      },
      { id: "space", visual: { kind: "image", src: "/help/storage-settings.webp", width: 1536, height: 726, alt: "Keepall Storage settings showing browser storage usage and protection status", caption: "Check your own storage status in Settings. This example’s values will differ from yours." }, title: "Check available storage", paragraphs: ["Settings shows the browser's estimated storage usage and allowance, plus whether it has granted storage protection. These estimates can change. Protection is not a substitute for a backup.", "Large images and videos use more space. If saving fails because storage is full, download a backup before removing items you no longer need."] },
      { id: "previews", title: "How link previews use the internet", paragraphs: ["While online, Keepall may send a saved page's URL to its preview service to request a title, description, or image. Your personal notes, collections, and tags are not included in that request."], links: [{ label: "Read extension privacy details", href: "/extension-privacy" }] },
    ],
    action: { label: "Open Settings", href: "/settings#storage" },
  },
  {
    slug: "offline", category: "Everyday use", title: "Use Keepall offline",
    summary: "Understand what stays available without a connection and what still needs the web.", minutes: "2 min read",
    sections: [
      { id: "prepare", title: "Open your library while online first", paragraphs: ["Keepall needs to load before your browser can keep a copy of the app for offline use. Open the library while connected, then return to it in the same browser or installed app.", "If an offline page says it cannot open the library, reconnect and open Keepall again. A first visit or a page the browser has not kept may need the internet."] },
      { id: "available", visual: { kind: "offline" }, title: "Work with locally saved content", paragraphs: ["When the cached library opens, you can browse and search your saves, read notes and saved articles, and view images, videos, and documents stored in Keepall. You can also make local changes to your library.", "Availability depends on the browser keeping both the app and its saved data. Download backups regularly."] },
      { id: "internet", title: "What still needs a connection", paragraphs: ["Opening a saved web link takes you to its original website, which normally needs the internet. Choose Save article on a link's details to keep its readable text for offline reading. Capturing or updating articles, new link previews, and images downloaded from websites need a connection.", "Extension saves depend on being able to reach Keepall's saved app files. If capture fails offline, reconnect and retry. Wait for a saved confirmation before assuming the item is in your library."] },
      { id: "updates", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Keepall Backup settings with Export backup", caption: "Export a backup while your library is available. Store it outside the app." }, title: "When an update is ready", paragraphs: ["Keepall shows an update notice when a new app version is ready. Finish and save any edits, then use the notice's reload action. This updates the app; it does not create a backup of your library."], links: [{ label: "Keep a backup of your library", href: "/help/storage-and-backups#download" }] },
    ],
    action: { label: "Open your library", href: "/" },
  },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
