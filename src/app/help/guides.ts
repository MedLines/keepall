import savePanelImage from "../../../public/help/save-panel.webp";
import libraryImage from "../../../public/marketing/app-library.webp";
import capturePagePoster from "../../../public/marketing/capture-page-poster.webp";
import captureTextPoster from "../../../public/marketing/capture-text-poster.webp";
import captureNotesPoster from "../../../public/marketing/capture-notes-poster.webp";
import captureOrganizePoster from "../../../public/marketing/capture-organize-poster.webp";
import collectionImage from "../../../public/marketing/app-collection.webp";
import collectionsOverviewImage from "../../../public/marketing/app-collections-overview.webp";
import tagsImage from "../../../public/marketing/app-tags.webp";
import tagsOverviewImage from "../../../public/marketing/app-tags-overview.webp";
import captureImagePoster from "../../../public/marketing/capture-image-poster.webp";
import backupSettingsImage from "../../../public/help/backup-settings.webp";
import bookmarkImportImage from "../../../public/help/bookmark-import.webp";
import bulkImportImage from "../../../public/help/bulk-import.webp";
import storageSettingsImage from "../../../public/help/storage-settings.webp";
import type { GuideVisual } from "./guide-visual";
import { focusedGuides } from "./focused-guides";
import articleImage from "../../../public/marketing/app-article-reader.webp";
import imageToolsImage from "../../../public/marketing/app-image-tools.webp";
import videoImage from "../../../public/marketing/app-video-detail.webp";

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
    summary: "Save your first link, note, image, video, or document. No account needed.", minutes: "2 min read",
    sections: [
      {
        id: "first-save",
        title: "Save a link",
        paragraphs: [
          "Save a page that you want to read again.",
          "The default Save item shortcut is Alt + K on Windows or Linux, or Option + K on Mac. Settings, General, App shortcuts has the shortcut controls.",
        ],
        steps: [
          "Copy the page address.",
          "Open your Keepall library.",
          "Select Save item.",
          "Paste the address.",
          "Add a note, collection, or tags if needed.",
          "Select Save.",
          "To change the title later, select Edit in the item menu.",
        ],
        visual: { kind: "image", src: savePanelImage.src, width: 960, height: 2200, alt: "Keepall's Save to Keepall panel with its link, note, and media controls", caption: "Choose Save item to open this panel.", portrait: true },
        note: "New links appear in Unsorted unless you select a collection. Keepall requests a link preview while online. A failed preview does not remove the saved link.",
      },
      {
        id: "more-than-links",
        title: "Save notes and files",
        paragraphs: [
          "Save item also accepts notes, pasted images, and files from your device. Supported documents are PDF, Markdown, and text files.",
          "Notes start as plain text. Markdown adds headings, lists, and other formatting. Each saved item can also have a separate personal note.",
        ],
        links: [{ label: "Write a formatted note", href: "/help/notes" }, { label: "Read document files", href: "/help/documents" }, { label: "See supported images and videos", href: "/help/images-and-videos" }],
      },
      {
        id: "find-it",
        title: "Find a saved item",
        paragraphs: [
          "Search finds words in saved items. Collections, tags, and item types limit the results. Grid and List give you different views of the same results.",
          "A link title can open the original website. Open full item shows saved details and articles. Move to Trash keeps an item until you delete it permanently.",
        ],
        steps: [
          "To browse an item without leaving the results, select Preview.",
          "To read saved details, select Open full item in the item menu.",
        ],
        visual: { kind: "video", src: "/marketing/library-demo", poster: libraryImage.src, caption: "Switch between the library's grid and list views." },
        links: [{ label: "Browse with quick preview", href: "/help/preview" }, { label: "Search your library", href: "/help/search" }, { label: "Learn about collections and tags", href: "/help/collections-and-tags" }],
      },
      {
        id: "save-from-browser",
        title: "Save from Chrome",
        paragraphs: [
          "Keepall Capture saves pages from Chrome on a computer. Installing Keepall adds an app icon for the library. Both are optional.",
        ],
        links: [{ label: "Set up the Chrome extension", href: "/help/chrome-capture" }, { label: "Install Keepall on your device", href: "/help/install-keepall" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "saved-articles", category: "Capture", title: "Save articles for offline reading",
    summary: "Keep readable website text beside your personal notes.", minutes: "2 min read",
    sections: [
      {
        id: "capture",
        title: "Save an article",
        paragraphs: [
          "Keepall saves headings, paragraphs, lists, quotations, code, and links. It also saves the title, source URL, and capture date.",
          "Available article details can include the author, publication date, and site name. Your personal note stays separate.",
          "Save for offline sends the URL to Keepall's server. The server requests the public page. The request excludes personal notes, tags, and collections.",
          "Capture needs an internet connection. Reading a saved article does not request the original website again.",
        ],
        steps: [
          "Save the website as a link.",
          "Select Open full item in the item menu.",
          "Select Save for offline.",
        ],
      },
      {
        id: "read",
        title: "Read and search an article",
        paragraphs: [
          "Offline reading needs the cached app and saved data in the same browser. Search finds article text, titles, and authors.",
          "Update saved article replaces the saved copy with a new capture. It also adds structure to older text-only saves.",
          "Changing a link's URL removes its old article. Changing its title or personal note keeps the article. Open original normally needs an internet connection.",
        ],
        steps: [
          "Select Open full item in the link menu.",
        ],
        visual: { kind: "image", src: articleImage.src, width: articleImage.width, height: articleImage.height, alt: "A full saved article with readable headings, text, and locally saved inline images", caption: "Open full item shows the saved article beside your personal note." },
      },
      {
        id: "limits",
        title: "Capture limits",
        paragraphs: [
          "Some websites require a login, block requests, or load text through scripts. Keepall does not sign in or run website scripts.",
          "Saved articles use Keepall's reading layout. They can include code blocks, captions, and up to 16 inline images stored on this device.",
          "A failed image download leaves a placeholder. An existing local cover remains available. Capture excludes website styling, videos, and interactive elements.",
          "A failed capture keeps the link, note, and any previous article. Very large pages can exceed capture limits.",
        ],
        steps: [
          "When the connection or website improves, select Retry saving article.",
          "If capture still fails, open the original website or import a TXT, Markdown, or PDF copy.",
        ],
      },
      {
        id: "backup",
        title: "Back up articles",
        paragraphs: [
          "Keepall backups include saved article text, metadata, and images with the link and personal note.",
        ],
        steps: [
          "Export a backup before clearing site data or changing browsers.",
        ],
        links: [{ label: "Open backup settings", href: "/settings#backup-heading" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "chrome-capture", category: "Capture", title: "Save from Chrome",
    summary: "Add the extension, then keep pages, links, images, and useful passages without leaving the website.", minutes: "5 min read",
    sections: [
      {
        id: "install",
        title: "Add Keepall Capture to Chrome",
        paragraphs: [
          "Keepall Capture works in Chrome on a computer. It saves without an open Keepall tab.",
        ],
        steps: [
          "Open the Chrome Web Store link below.",
          "Select Add to Chrome.",
          "Read the permission message.",
          "Confirm installation.",
          "Open Chrome's Extensions menu.",
          "Pin Keepall Capture.",
        ],
        note: "Right-click actions and save confirmation tools need Keepall Capture 0.2.0 or later. Chrome's Manage extensions page shows the installed version and available updates.",
        links: [{ label: "Add Keepall Capture to Chrome", href: CHROME_EXTENSION_URL }],
      },
      {
        id: "save-page",
        title: "Save a page",
        paragraphs: [
          "New links appear in Unsorted. Saving an existing link again keeps its collection and tags.",
          "Chrome's settings pages and other protected browser pages cannot be saved with the extension.",
        ],
        steps: [
          "Open the website.",
          "Select the Keepall icon in Chrome's toolbar.",
          "Wait for the saved confirmation.",
          "Open Keepall in the same Chrome profile.",
        ],
        visual: { kind: "video", src: "/marketing/capture-page-demo", poster: capturePagePoster.src, caption: "Click the extension icon, then wait for the saved confirmation." },
      },
      {
        id: "right-click",
        title: "Save a link, image, or selected text",
        paragraphs: [
          "Save to Keepall uses the content under the pointer. A link saves its destination. An image saves its file and source address.",
          "Selected text becomes a note on the source link. Chrome can request website access before an image download.",
        ],
        steps: [
          "For a link or image, right-click it.",
          "For text, select the passage before you right-click it.",
          "Select Save to Keepall.",
          "Wait for the saved confirmation.",
        ],
        visual: { kind: "video", src: "/marketing/capture-text-demo", poster: captureTextPoster.src, caption: "Select text, right-click, and choose Save to Keepall." },
        note: "For an existing source link, selected text adds to its note. An identical complete passage does not add twice. A linked image saves as an image.",
      },
      {
        id: "add-details",
        title: "Add details before saving",
        paragraphs: [
          "The save panel accepts a title, personal note, collection, and tags. Notes can use plain text or Markdown.",
          "Browse all searches the full collection or tag list. The panel can also create collections and tags. For an existing link, Save updates its details.",
          "Closing the panel keeps its draft in that tab. Discard draft removes it. Reloading the page or closing the tab also removes it.",
          "Notes with local image attachments need the editor in Keepall.",
        ],
        steps: [
          "Press Alt + K on Windows or Linux, or Option + K on Mac.",
          "Change the title or note if needed.",
          "For formatted notes, turn on Markdown.",
          "Select a collection or tags if needed.",
          "Select Save.",
          "Wait for the saved confirmation.",
        ],
        visual: { kind: "video", src: "/marketing/capture-notes-demo", poster: captureNotesPoster.src, caption: "Open the extension's save panel with Alt + K to add a note." },
      },
      {
        id: "after-saving",
        title: "Open, organize, or undo a save",
        paragraphs: [
          "The saved confirmation has Open in Keepall and Organize actions. Organize assigns a collection.",
          "Undo appears briefly for a new item. It cannot remove an item that you have since edited, organized, or pinned.",
        ],
        steps: [
          "To remove an item after the confirmation closes, select Move to Trash in Keepall.",
        ],
        visual: { kind: "video", src: "/marketing/capture-organize-demo", poster: captureOrganizePoster.src, caption: "Choose Organize in the saved confirmation to pick a collection." },
      },
      {
        id: "image-access",
        title: "Allow image downloads",
        paragraphs: [
          "An image can come from a different website than its page. Chrome can request access to that image host before Keepall downloads it.",
          "Access for one website is the recommended choice. Image access in Options also offers optional access to all websites.",
          "Chrome's permission message describes the access it grants. The Image access section links to Chrome's controls for changing access.",
          "Supported images are PNG, JPEG, GIF, WebP, and AVIF, up to 20 MiB each. A website can still block a download.",
        ],
        steps: [
          "If Chrome requests access, read the website address and permission message.",
          "To download the image, select Allow.",
          "To manage image access, right-click the Keepall toolbar icon.",
          "Select Options.",
          "Select Image access.",
        ],
        images: [
          { src: "/help/permission-one-website.png", width: 669, height: 318, alt: "Chrome asks to read and change data on pbs.twimg.com, with Allow and Deny buttons.", caption: "Recommended: allow the website hosting the image. The website address will depend on the image you save." },
          { src: "/help/permission-all-websites.png", width: 672, height: 306, alt: "Chrome asks to read and change data on all websites, with Allow and Deny buttons.", caption: "Optional: access to all websites. This broader permission is available in Options; it is not required to start using Keepall." },
        ],
        links: [{ label: "Read extension privacy details", href: "/extension-privacy" }],
      },
      {
        id: "find-saves",
        title: "Find extension saves",
        paragraphs: [
          "The extension normally saves to www.keepall.app in the same Chrome profile. Profiles such as Personal and Work have separate libraries.",
          "Check connection tests whether the extension can reach the selected library. It does not sync libraries.",
        ],
        steps: [
          "Open Keepall in the Chrome profile used for the save.",
          "To check the destination, right-click the extension icon.",
          "Select Options.",
          "Select General.",
          "Select Check connection.",
        ],
      },
      {
        id: "troubleshooting",
        title: "Fix a failed save or shortcut",
        paragraphs: [
          "Another extension can use the same shortcut. Chrome controls extension shortcuts separately from app shortcuts.",
          "A missing item can be in a different library address or Chrome profile. New links normally appear in Unsorted.",
          "Image downloads need the correct website permission and a supported file within the size limit.",
        ],
        steps: [
          "If the shortcut fails, open Options.",
          "Select Saving.",
          "Select Change shortcut.",
          "Assign an available shortcut in Chrome.",
          "If saving fails, open Keepall while online.",
          "In extension Options, select General.",
          "Select Check connection.",
          "If Restore library access appears, select it.",
          "Retry the save.",
        ],
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
        id: "choose",
        title: "Choose the app or extension",
        paragraphs: [
          "Installing Keepall adds an icon for the library. Keepall Capture is a separate Chrome extension for saving content from websites on a computer.",
          "You can use the app, the extension, both, or the website alone.",
        ],
        links: [{ label: "Looking for the Chrome extension?", href: "/help/chrome-capture#install" }],
      },
      {
        id: "computer",
        title: "Install with Chrome on a computer",
        paragraphs: [
          "If the install icon is absent, Chrome's menu has Cast, save, and share, then Install page as app.",
        ],
        steps: [
          "Open www.keepall.app in the Chrome profile used for the library.",
          "Select the install icon in the address bar, or Install page as app in the menu.",
          "Confirm installation.",
          "Open Keepall from its new icon.",
        ],
        visual: { kind: "install", platform: "computer" },
        links: [{ label: "Chrome's computer installation guide", href: "https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop" }],
      },
      {
        id: "android",
        title: "Install with Chrome on Android",
        paragraphs: [
          "Menu labels depend on the Chrome version. Alternatives include Add to Home screen and Install app.",
        ],
        steps: [
          "Open www.keepall.app in Chrome.",
          "Open Chrome's menu.",
          "Select Install and create shortcut.",
          "Select Install.",
          "Complete the installation prompts.",
          "Open Keepall from its new icon.",
        ],
        visual: { kind: "install", platform: "android" },
        links: [{ label: "Chrome's Android installation guide", href: "https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid" }],
      },
      {
        id: "iphone",
        title: "Install with Safari on iPhone or iPad",
        paragraphs: [
          "The Home Screen app has a separate library from Safari. Installation does not copy existing saves.",
          "For existing saves, a backup export from Safari can transfer the library to the Home Screen app.",
        ],
        steps: [
          "Before saving items, open www.keepall.app in Safari.",
          "Open Share from the toolbar or page menu.",
          "Select Add to Home Screen.",
          "If Open as Web App appears, turn it on.",
          "Select Add.",
          "Open Keepall from its Home Screen icon.",
        ],
        visual: { kind: "install", platform: "iphone" },
        links: [{ label: "Apple's Home Screen guide", href: "https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios" }],
      },
      {
        id: "existing-library",
        title: "Transfer an existing library",
        paragraphs: [
          "A different browser, profile, device, or site address has a separate library. The iPhone and iPad Home Screen app also has separate storage from Safari.",
          "Installation does not sync libraries. A backup import transfers a copy once.",
        ],
        steps: [
          "Before switching, export a backup from the library with your saves.",
          "If the new app has an empty library, import that backup.",
          "Check the imported items before deleting the original copy.",
        ],
        visual: { kind: "transfer" },
        links: [{ label: "Back up and move your library", href: "/help/storage-and-backups" }, { label: "See what works offline", href: "/help/offline" }],
      },
    ],
    action: { label: "Open Keepall", href: "/" },
  },
  {
    slug: "collections-and-tags", category: "Organize", title: "Organize with collections and tags",
    summary: "Group items with collections and tags. Pin items and restore saves from Trash.", minutes: "3 min read",
    sections: [
      {
        id: "collections",
        title: "Assign a collection",
        paragraphs: [
          "A collection groups related items, such as recipes or project research. Items without a collection appear in Unsorted and stay there until you organize them.",
          "You can assign a collection when saving or later. Dragging library items onto a sidebar collection also moves them.",
        ],
        steps: [
          "In Save item, enter a name in Collection.",
          "Select Create collection.",
          "Select Save.",
        ],
        visual: { kind: "video", src: "/marketing/collections-demo", poster: collectionImage.src, caption: "Choose a collection from the sidebar to see its items." },
      },
      {
        id: "overviews",
        title: "Browse collections",
        paragraphs: [
          "All collections shows folder previews. Its search finds collection names. Grid and List change how the folders appear.",
          "Selecting several collections allows deletion together. The confirmation shows what happens to their items and where those items will go.",
        ],
        steps: [
          "Select All collections in the sidebar.",
          "Open a folder to see its items.",
          "Before deleting collections, check the confirmation and destination options.",
        ],
        visual: { kind: "image", src: collectionsOverviewImage.src, width: 2880, height: 1720, alt: "Keepall Collections overview with visual folder previews", caption: "All collections shows folder previews. Open a folder to see its items." },
      },
      {
        id: "unsorted-review",
        title: "Review Unsorted",
        paragraphs: [
          "Review Unsorted includes every item without a collection. Library search and type filters do not limit this review.",
          "Apply changes saves the collection and moves to the next item. Tags apply immediately and do not remove an item from Unsorted.",
          "Back and Next browse without assigning a collection. Delete opens a Move to Trash confirmation and advances after confirmation.",
          "Undo reverses the last collection, tag, or Trash change and returns to that item. Back and Next do not add an Undo entry.",
          "Undo stays available until review closes, including after the last item. Tab moves between controls. Escape closes review.",
        ],
        steps: [
          "Open Unsorted.",
          "Select Review Unsorted.",
          "Select or create a collection.",
          "Select Apply changes.",
        ],
      },
      {
        id: "tags",
        title: "Add tags",
        paragraphs: [
          "Tags can connect items in different collections. An item can have several tags. Tags can be created while saving or organizing an item.",
        ],
        steps: [
          "Open the item menu.",
          "Select Tags.",
          "Find or create a tag.",
          "Apply or remove the tag as needed.",
          "To see matching items, select the tag in the sidebar.",
        ],
        visual: { kind: "video", src: "/marketing/tags-demo", poster: tagsImage.src, caption: "Add a tag from an item's menu, then filter the library by that tag." },
      },
      {
        id: "tag-overview",
        title: "Browse tags",
        paragraphs: [
          "All tags shows previews and item counts. Its search finds tag names. Grid and List change how the tags appear.",
          "Deleting a tag removes that tag from items. It does not delete the items.",
        ],
        steps: [
          "Select All tags in the sidebar.",
          "Select a tag to see matching items.",
        ],
        visual: { kind: "image", src: tagsOverviewImage.src, width: 2880, height: 1720, alt: "Keepall Tags overview with previews and item counts for favorites, inspiration, and someday", caption: "All tags shows each tag with a preview and item count." },
      },
      {
        id: "app-shortcuts",
        title: "Change app shortcuts",
        paragraphs: [
          "Default shortcuts are Alt + K for Save item and Alt + G for Grid or List. On Mac, use Option instead of Alt.",
          "The default Search shortcut is /. The default Preview results shortcut is Space. Assigned keys appear beside actions or in tooltips.",
          "A shortcut can use a letter, number, punctuation mark, or function key. Optional modifier keys include Ctrl, Shift, Alt, Cmd, and Windows.",
          "The / key can come from the main keyboard or number pad. Keepall rejects duplicate assignments. Browsers and operating systems can reserve some shortcuts.",
          "In the recorder, Escape cancels, Tab moves focus, and Enter confirms. Cancel also discards a change. Reset to defaults restores all original assignments.",
          "App shortcuts pause in typing fields, editors, and dialogs. Preferences stay on this device and in backups. Replace restores backup assignments. Merge keeps current assignments.",
          "The Chrome extension has separate shortcut settings.",
        ],
        steps: [
          "Open Settings.",
          "Select General.",
          "Find App shortcuts.",
          "Select Change beside the action.",
          "Press the shortcut keys together, or select Use default.",
          "Check the displayed shortcut.",
          "Select Confirm shortcut.",
        ],
        links: [{ label: "App shortcut settings", href: "/settings#keyboard-shortcuts-heading" }],
      },
      {
        id: "pins",
        title: "Pin items and collections",
        paragraphs: [
          "Pinned collections appear in the sidebar with an adjustable order. Pinned items appear first inside their collection.",
          "Selection controls can move several items, change their tags, or move them to Trash.",
        ],
        steps: [
          "Before moving selected items to Trash, check the confirmation.",
        ],
      },
      {
        id: "search",
        title: "Search saved items",
        paragraphs: [
          "Library search includes titles, notes, tags, saved articles, document contents, and recognized image text.",
          "The current collection, tag, and item type limit the search. All collections and All tags search names instead of item contents.",
        ],
        links: [{ label: "Follow the search guide", href: "/help/search" }],
      },
      {
        id: "trash",
        title: "Restore items from Trash",
        paragraphs: [
          "Move to Trash requires confirmation. It removes an item from normal library results. Undo restores it after the move.",
          "Trash has its own search. Restore selected can restore several selected items.",
          "Delete permanently removes one item after confirmation. Empty Trash removes all items in Trash after confirmation. Recovery then requires a backup that contains those items.",
        ],
        steps: [
          "Open Trash in the sidebar.",
          "Find the item.",
          "Select Restore in its menu.",
          "Before permanently deleting items, export a backup if you might need them again.",
        ],
        links: [{ label: "Download a backup", href: "/help/storage-and-backups#download" }],
      },
    ],
    action: { label: "Browse your library", href: "/" },
  },
  {
    slug: "images-and-videos", category: "Media", title: "Keep images and videos",
    summary: "Paste images, build a gallery, and keep video files from your device.", minutes: "4 min read",
    sections: [
      {
        id: "images",
        title: "Save images",
        paragraphs: [
          "Supported formats are PNG, JPEG, GIF, WebP, and AVIF. Each image can be up to 20 MiB.",
          "A title, note, and source address are optional. Unsupported formats or larger files need conversion or a smaller copy.",
        ],
        steps: [
          "Open Save item.",
          "Select Add files, or paste an image with Ctrl + V or Cmd + V.",
          "Select the image files if needed.",
          "Add details if needed.",
          "Select Save.",
        ],
        visual: { kind: "video", src: "/marketing/capture-image-demo", poster: captureImagePoster.src, caption: "With the extension, right-click an image and choose Save to Keepall." },
        links: [{ label: "Save images directly from websites", href: "/help/chrome-capture#right-click" }],
      },
      {
        id: "gallery",
        title: "Browse an image gallery",
        paragraphs: [
          "An image item can hold several images. The first image is its cover. The full item has controls to add, replace, or remove images.",
          "Scroll shows the gallery vertically. Slides shows one image at a time. Switching views keeps your position.",
          "The full-screen viewer has zoom and gallery navigation. Closing it returns to item details.",
        ],
        steps: [
          "Open the image item.",
          "Select Scroll or Slides.",
          "To open the full-screen viewer, select the large image.",
        ],
      },
      {
        id: "palette",
        title: "Extract and copy colors",
        paragraphs: [
          "Extract palette samples up to six colors on your device. The Palette card appears below its image and before personal notes.",
          "A swatch copies its hex code. A checkmark confirms the copy. Its menu can copy the code or search for similar colors.",
          "The Palette card can collapse or expand. Refresh palette repeats the analysis. Cancel stops it. Retry palette repeats a failed analysis.",
          "Analysis accepts images up to 32 megapixels. The separate saving limit is 20 MiB.",
          "Color search accepts color:red or color:#FF0000. Words can narrow the results, such as color:red receipt. Only images with an extracted palette match.",
        ],
        steps: [
          "Open the saved image menu.",
          "Select Extract palette.",
          "To copy a hex code, select a swatch.",
          "For pointer access to the swatch menu, right-click a swatch.",
          "For keyboard access, focus the swatch.",
          "Press Shift + F10.",
          "Select Search library for nearby colors.",
        ],
        visual: { kind: "image", src: imageToolsImage.src, width: imageToolsImage.width, height: imageToolsImage.height, alt: "A saved image with an extracted Palette and recognized Screenshot text cards", caption: "Palette and Screenshot text results stay beside their original image." },
        links: [{ label: "Search by color and words", href: "/help/search#colors" }],
      },
      {
        id: "image-text",
        title: "Read and search image text",
        paragraphs: [
          "Read text recognizes English text in saved images. The Screenshot text card appears below its image and before personal notes.",
          "Progress shows during recognition. Cancel stops it. Retry reading text repeats a failed attempt. Read text again replaces previous results.",
          "The copy button copies the result and shows a checkmark. The Screenshot text card can collapse or expand. Recognition can make mistakes.",
          "Each gallery image has its own palette and recognized text. Replacing or removing an image removes its analysis. Backups include these results.",
          "Recognition runs on your device without uploading images. First use downloads the engine and English data from Keepall's files, so it needs a connection.",
          "Later offline recognition needs all engine files and the cached app. Missing files need an internet connection. Existing results remain readable and searchable locally.",
          "Read text does not recognize scanned PDF pages or transcribe video. Analysis accepts images up to 32 megapixels. The saving limit is 20 MiB.",
        ],
        steps: [
          "Open the saved image menu.",
          "Select Read text.",
          "Wait for recognition to finish.",
          "Check the result against the image.",
          "To find the image later, search words from the checked result.",
        ],
      },
      {
        id: "videos",
        title: "Save a video file",
        paragraphs: [
          "Supported files are MP4 and WebM, up to 100 MiB each. Playback needs a browser that supports the file codec.",
          "A video website link saves only the address. It does not download the video or create a transcript.",
        ],
        steps: [
          "Open Save item.",
          "Select Add files.",
          "Select the video file.",
          "Add a title or note if needed.",
          "Select Save.",
          "Open the saved item to play it.",
        ],
        visual: { kind: "image", src: videoImage.src, width: videoImage.width, height: videoImage.height, alt: "A locally saved video with browser playback controls and a personal note", caption: "Local video files play inside Keepall when the browser supports their codec." },
      },
      {
        id: "media-backup",
        title: "Back up images and videos",
        paragraphs: [
          "Keepall ZIP backups include saved image and video files. The library otherwise depends on storage in the current browser.",
        ],
        steps: [
          "Export a backup before clearing site data or changing devices.",
        ],
        visual: { kind: "image", src: backupSettingsImage.src, width: 1552, height: 1064, alt: "Backup settings with Export backup and Import backup buttons", caption: "Export backup includes the image and video files stored in your library." },
        links: [{ label: "Import files or a folder", href: "/help/import#images" }, { label: "Download a library backup", href: "/help/storage-and-backups#download" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "import", category: "Bring your saves", title: "Import files and bookmarks",
    summary: "Import documents, browser bookmarks, images, or a Keepall backup.", minutes: "3 min read",
    sections: [
      {
        id: "documents",
        title: "Import documents",
        paragraphs: [
          "Add files in Save item imports PDF, UTF-8 text, and Markdown files. Bulk import accepts multiple files or a folder.",
          "The Notes filter includes imported text and Markdown. The Documents filter includes all imported document types.",
          "PDF limits are 50 MiB and 1,000 pages. TXT and Markdown limits are 10 MiB each. Scanned PDFs are viewable but have no image text recognition.",
        ],
        links: [{ label: "Read PDFs, Markdown and text files", href: "/help/documents" }],
      },
      {
        id: "bookmarks",
        title: "Import browser bookmarks",
        paragraphs: [
          "Browser bookmark exports use HTML. Keepall backups use a different format.",
          "The Browser folder → Unsorted only option changes collections for existing links without a collection. Keep Keepall collections preserves the collection of each existing link.",
          "Browser folders win assigns browser folders even to existing links that already have a collection. New links use their browser folder. Browser tags always add.",
        ],
        steps: [
          "Export bookmarks as HTML from your browser's bookmark manager.",
          "Open Save item.",
          "Select Bulk import.",
          "Select Import browser bookmarks.",
          "Select the exported HTML file.",
          "Select the collection rule.",
          "Select Import bookmarks.",
          "Check the added, merged, and skipped totals.",
          "Select Done.",
        ],
        visual: { kind: "image", src: bookmarkImportImage.src, width: 960, height: 1116, alt: "Bookmark import dialog with its three choices for updating existing collections", caption: "Choose which collection wins when a bookmark link is already in Keepall." },
      },
      {
        id: "images",
        title: "Import files or a folder",
        paragraphs: [
          "Bulk import reads nested folders. Multiple images can save as One image item or Separate image items.",
          "One image item makes a gallery and accepts a caption. Documents, videos, and mixed file types always save separately. HTML documents are unsupported.",
          "Folders use their name as the collection unless a collection is already selected. Unsorted removes that assignment. Add files can add to the open import drawer.",
          "Cancel before Save leaves the library unchanged. Retry failed files keeps items that have already saved.",
        ],
        steps: [
          "Open Save item.",
          "Select Bulk import.",
          "Select Import files or Import folder.",
          "Select the files or folder.",
          "For multiple images, select One image item or Separate image items.",
          "Select tags and a collection if needed.",
          "Select Save.",
          "If some files fail, select Retry failed files.",
        ],
        visual: { kind: "image", src: bulkImportImage.src, width: 960, height: 792, alt: "Bulk import dialog with Import files, Import folder, and Import browser bookmarks", caption: "Open Save item, then Bulk import. Backup files belong in Settings." },
      },
      {
        id: "backup",
        title: "Import a Keepall backup",
        paragraphs: [
          "Supported backups are .keepall.zip and older Keepall JSON files. Keepall checks the whole file before showing a comparison with the current library.",
          "The comparison includes the backup date, items, Trash, tags, collections, and media.",
          "Merge adds missing items. Matching items can use newer saved details. Tags combine. Replace library removes current data, including Trash, after a separate confirmation.",
          "Replace restores backed-up app shortcuts. Merge keeps current app shortcuts.",
        ],
        steps: [
          "Export a backup of the current library before replacing it.",
          "Open Settings.",
          "Select Storage & backups.",
          "Select Import backup.",
          "Select the backup file.",
          "Check the comparison.",
          "Select Merge or Replace library.",
          "If replacing, check the separate confirmation before continuing.",
          "Check imported notes and media before deleting the original copy.",
        ],
        visual: { kind: "transfer" },
        links: [{ label: "Understand storage and backups", href: "/help/storage-and-backups" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "storage-and-backups", category: "Your data", title: "Understand storage and backups",
    summary: "Check local storage, export backups, and transfer your library.", minutes: "3 min read",
    sections: [
      {
        id: "storage",
        title: "Where the library is stored",
        paragraphs: [
          "Keepall stores the library in IndexedDB, a browser database on this device. It includes links, notes, articles, files, collections, and tags.",
          "No account is needed. Each browser, profile, device, and site address has a separate library. There is no automatic cloud sync.",
          "Clearing site data can erase the library. Browser or device cleanup can also remove it. A separate backup provides a recovery copy.",
        ],
      },
      {
        id: "download",
        title: "Export a backup",
        paragraphs: [
          "A .keepall.zip backup includes library data, articles, images, videos, and documents, including items in Trash.",
          "Keepall does not encrypt backups or protect them with a password. Anyone with the file can read its contents.",
          "A copy on another device or storage service can protect against losing this device.",
        ],
        steps: [
          "After important additions, open Settings.",
          "Select Storage & backups.",
          "Find Backup.",
          "Select Export backup.",
          "Keep the downloaded file in a separate location.",
          "Before clearing browser data, resetting a device, or changing browsers, export another backup.",
        ],
        visual: { kind: "image", src: backupSettingsImage.src, width: 1552, height: 1064, alt: "Keepall Backup settings showing Export backup and Import backup", caption: "Choose Export backup to download your library." },
        links: [{ label: "Open backup settings", href: "/settings#backup-heading" }],
      },
      {
        id: "automatic",
        title: "Set up folder backups",
        paragraphs: [
          "Folder backups need a supported browser and read and write permission. Other browsers can use Export backup.",
          "Keepall saves the first backup immediately. The browser can remember folder access for later visits and app updates.",
          "While Keepall is open, changed data saves approximately every 30 minutes. Inactive tabs or device sleep can delay a backup. Unchanged data creates no file.",
          "Background checks do not request permission. Reconnect folder restores lost access. Failed saves keep completed backups and retry after 30 minutes.",
          "Back up now starts a backup manually. Keepall keeps the latest three verified backups for this library in the selected folder.",
          "If a backed-up library becomes empty, backups and cleanup pause to preserve recovery copies. Adding an item or importing a backup resumes them.",
          "Turn off folder backups stops new saves and keeps completed files. Import backup restores a saved file. Clearing site data also removes the folder connection.",
          "A folder on this device does not protect against losing the device. A separate copy elsewhere provides that protection.",
        ],
        steps: [
          "Open Settings.",
          "Select Storage & backups.",
          "Select Choose backup folder.",
          "Choose a dedicated empty folder for Keepall backups.",
          "Allow read and write access.",
          "Check that the first backup finishes.",
        ],
        links: [{ label: "Open backup settings", href: "/settings#backup-heading" }],
      },
      {
        id: "restore",
        title: "Restore or transfer the library",
        paragraphs: [
          "Merge adds missing items and can use newer details for matching items. Tags combine. Replace library removes current items, including Trash, after confirmation.",
          "A backup import transfers a copy once. It does not keep libraries in sync.",
        ],
        steps: [
          "Open Keepall in the destination browser or app.",
          "Open Settings.",
          "Select Storage & backups.",
          "Select Import backup.",
          "Select the backup file.",
          "Check the file details and current library totals.",
          "Select Merge or Replace library.",
          "Check restored items before deleting the original copy.",
        ],
        visual: { kind: "transfer" },
        links: [{ label: "Follow the import guide", href: "/help/import#backup" }],
      },
      {
        id: "mobile",
        title: "Protect storage on phones",
        paragraphs: [
          "Chrome on Android and Safari on current iPhones and iPads support local storage for Keepall. Capacity depends on the browser and free device space.",
          "Installation does not provide unlimited storage. Keepall requests protection from automatic browser cleanup. The browser decides whether to grant it.",
          "Installation and regular use can help the browser grant protection. Without protection, low space can cause data removal. Clearing site data can erase even protected libraries.",
          "On iPhone and iPad, the Home Screen app has a separate library from Safari. A backup export and import transfers existing saves.",
        ],
        steps: [
          "Check the storage protection status in Settings.",
          "On iPhone or iPad, install Keepall before building the library.",
          "Export a backup after important additions.",
          "Keep a copy outside the app.",
          "Use a normal browser window for a library you want to keep.",
        ],
        links: [{ label: "Apple's web storage policy", href: "https://webkit.org/blog/14403/updates-to-storage-policy/" }, { label: "How Chrome protects local storage", href: "https://web.dev/articles/persistent-storage" }, { label: "Apple's Home Screen storage separation", href: "https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps" }],
      },
      {
        id: "space",
        title: "Check storage space",
        paragraphs: [
          "Storage & backups shows estimated browser usage, allowance, and storage protection. These values can change. Storage protection does not replace a backup.",
          "Large images and videos use more space.",
        ],
        steps: [
          "Open Settings.",
          "Select Storage & backups.",
          "If storage is full, export a backup before removing items.",
        ],
        visual: { kind: "image", src: storageSettingsImage.src, width: 1552, height: 1066, alt: "Keepall Storage settings showing browser storage usage and protection status", caption: "Check your own storage status in Settings. This example's values will differ from yours." },
      },
      {
        id: "previews",
        title: "Internet requests for previews",
        paragraphs: [
          "For a link preview, Keepall can send the saved URL to its preview service. The service requests the website and image host.",
          "These requests exclude personal notes, collections, and tags.",
          "Without a local preview image, a link icon can load from Google's favicon service. That service receives the link hostname.",
          "The icon can also load from the website's favicon address. Article capture sends its URL to Keepall's server to request the public page and supported images.",
        ],
        links: [{ label: "Read Keepall privacy details", href: "/privacy" }, { label: "Read extension privacy details", href: "/extension-privacy" }],
      },
    ],
    action: { label: "Open Settings", href: "/settings#storage" },
  },
  {
    slug: "offline", category: "Everyday use", title: "Use Keepall offline",
    summary: "Prepare for offline reading and check which actions need the internet.", minutes: "2 min read",
    sections: [
      {
        id: "prepare",
        title: "Prepare for offline use",
        paragraphs: [
          "Offline access needs a cached copy of the app. A first visit or an uncached page needs an internet connection.",
          "The cached app must stay in the same browser or installed app.",
        ],
        steps: [
          "While online, open the library.",
          "If the library cannot open offline, reconnect to the internet.",
          "Open Keepall again.",
        ],
      },
      {
        id: "available",
        title: "What works offline",
        paragraphs: [
          "With the cached app and local data, you can browse and search saved items. Notes, saved articles, documents, images, and local videos remain available.",
          "You can also make local library changes. Availability depends on the browser keeping the app and data.",
        ],
        steps: [
          "Export backups regularly.",
        ],
        visual: { kind: "offline" },
      },
      {
        id: "internet",
        title: "What needs the internet",
        paragraphs: [
          "Original websites normally need an internet connection. Saving a URL alone does not save its article text.",
          "Article capture, article updates, new link previews, and website image downloads need an internet connection.",
          "Extension saves need access to Keepall's cached app files. A saved confirmation verifies that capture succeeded.",
        ],
        steps: [
          "While online, select Save for offline on the full link page to save article text.",
          "If an extension save fails offline, reconnect to the internet.",
          "Retry the save.",
          "Wait for the saved confirmation.",
        ],
      },
      {
        id: "updates",
        title: "Install an app update",
        paragraphs: [
          "Keepall shows a notice when a new app version is ready. Reloading updates the app. It does not back up the library.",
        ],
        steps: [
          "Finish your edits.",
          "Save your edits.",
          "Select the reload action in the update notice.",
        ],
        visual: { kind: "image", src: backupSettingsImage.src, width: 1552, height: 1064, alt: "Keepall Backup settings with Export backup", caption: "Export a backup while your library is available. Store it outside the app." },
        links: [{ label: "Keep a backup of your library", href: "/help/storage-and-backups#download" }],
      },
    ],
    action: { label: "Open your library", href: "/" },
  },
  ...focusedGuides,
];

export const guideGroups = [
  { id: "start-saving", title: "Start saving", slugs: ["getting-started", "install-keepall", "chrome-capture", "import"] },
  { id: "read-and-explore", title: "Read and explore", slugs: ["saved-articles", "documents", "preview", "notes", "images-and-videos"] },
  { id: "organize-and-find", title: "Organize and find", slugs: ["collections-and-tags", "search"] },
  { id: "keep-library-safe", title: "Keep your library safe", slugs: ["storage-and-backups", "offline"] },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
