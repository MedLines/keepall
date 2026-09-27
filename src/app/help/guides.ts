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
        steps: ["Copy the page's address and open your Keepall library.", "Choose Save item and paste the address. You can also open this panel with Alt + K, or Option + K on Mac.", "Add a title or a note if you want to remember why you saved it, then save."],
        note: "Your new link appears in Unsorted unless you choose a collection. Keepall tries to add a preview while you are online; the link is still saved if a preview is unavailable.",
      },
      {
        id: "more-than-links", title: "Keep more than links",
        paragraphs: ["Use Save item to write a standalone note, choose image files, paste an image, or add a video file from your device. You can attach a note to a link, image, or video too.", "Notes start as plain text. Turn on Markdown if you want to use formatting such as headings and lists."],
        links: [{ label: "See supported images and videos", href: "/help/images-and-videos" }],
      },
      {
        id: "find-it", visual: { kind: "video", src: "/marketing/library-demo", poster: "/marketing/app-library.webp", caption: "Switch between the library’s grid and list views." }, title: "Come back to what you saved",
        paragraphs: ["Search by title or tag, open a collection, or filter by item type. Switch between the visual grid and list to browse your saves.", "Open an item to read its details. For a saved link, choose Open source to visit the original page. Use Edit to change the details or Delete to remove an item after confirming."],
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
      { id: "tags", visual: { kind: "video", src: "/marketing/tags-demo", poster: "/marketing/app-tags.webp", caption: "Add a tag from an item’s menu, then filter the library by that tag." }, title: "Connect ideas with tags", paragraphs: ["Tags describe an item across collections. For example, a lamp and a paint color in different collections could both have the tag warm tones. An item can have several tags.", "Right-click an item in the library to find, add, or remove tags. You can create a new tag there too. Select a tag in the sidebar to see matching items."] },
      { id: "pins", title: "Keep frequent items close", paragraphs: ["Pin collections in the sidebar and change their order. Inside a collection, pin important items to keep them above the rest.", "To tidy several saves together, select them and use the selection controls to move them, change their tags, or delete them. Read the confirmation before deleting the selection."] },
      { id: "search", visual: { kind: "video", src: "/marketing/search-demo", poster: "/marketing/app-search.webp", caption: "Type a phrase to find matching saves." }, title: "Find something you remember", paragraphs: ["Start with a word from the title or a tag. Search also matches saved text fields, such as standalone note text, image captions, and source addresses. It does not read text inside images or listen to videos.", "Narrow the results by collection, tag, or item type. If something seems missing, clear those filters. Choose newest or oldest first, and switch between grid and list to change how you browse."] },
    ],
    action: { label: "Browse your library", href: "/" },
  },
  {
    slug: "images-and-videos", category: "Media", title: "Keep images and videos",
    summary: "Paste images, build a gallery, and keep video files from your device.", minutes: "2 min read",
    sections: [
      { id: "images", visual: { kind: "video", src: "/marketing/capture-image-demo", poster: "/marketing/capture-image-poster.webp", caption: "With the extension, right-click an image and choose Save to Keepall." }, title: "Add an image", paragraphs: ["Open Save item to choose image files or use Paste image. Add a title, a note, and a source link if you want to remember where an image came from.", "Keepall accepts PNG, JPEG, GIF, WebP, and AVIF images up to 20 MiB each. Unsupported or oversized files need to be converted or made smaller before saving."], links: [{ label: "Save images directly from websites", href: "/help/chrome-capture#right-click" }] },
      { id: "gallery", title: "Keep related images together", paragraphs: ["One image item can hold several pictures. Open it to browse the gallery, add more images, or replace or remove the current image. The first image is the cover. Choose Scroll to read the whole gallery vertically, or Slides to view one image at a time. Switching views keeps your place.", "Select the large image to view it full screen. You can zoom in and move through the gallery. Close the viewer to return to the item's details."] },
      { id: "videos", title: "Add a video from your device", paragraphs: ["Use Save item to choose an MP4 or WebM file up to 100 MiB. Give it a title or note, then open the saved item to play it. Playback depends on whether your browser supports the file's video format.", "Saving a link to an online video keeps its web address. It does not download the video file."] },
      { id: "media-backup", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Backup settings with Export backup and Import backup buttons", caption: "Export backup includes the image and video files stored in your library." }, title: "Keep a copy of your media", paragraphs: ["Images and local video files are part of your browser's library. A Keepall ZIP backup includes those files. Download one before clearing site data or changing devices."], links: [{ label: "Import a folder of images", href: "/help/import#images" }, { label: "Download a library backup", href: "/help/storage-and-backups#download" }] },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "import", category: "Bring your saves", title: "Bring an existing library",
    summary: "Import browser bookmarks, a folder of images, or a Keepall backup.", minutes: "3 min read",
    sections: [
      {
        id: "bookmarks", visual: { kind: "image", src: "/help/import-settings.webp", width: 1536, height: 348, alt: "Keepall Settings with Import bookmarks and Import images buttons", caption: "The Import section in Settings is where you bring in bookmarks and image folders." }, title: "Import browser bookmarks",
        paragraphs: ["Start with an HTML bookmark export from your browser. A Keepall backup uses a different format."],
        steps: ["Use your browser's bookmark manager to export bookmarks as an HTML file.", "Open Keepall Settings and choose Import bookmarks. Select the exported file.", "Review how bookmark folders will be used for collections, then confirm the import and read the result."],
      },
      {
        id: "images", title: "Import a folder of images",
        paragraphs: ["You can bring in a folder without adding each image separately."],
        steps: ["In Settings, choose Import images and select the folder on your device.", "Choose a collection, or leave it blank to keep the images in Unsorted.", "Choose Import images and wait for the result. Keepall reports files it skipped, including unsupported images and those over 20 MiB."],
      },
      {
        id: "backup", visual: { kind: "transfer" }, title: "Restore a Keepall backup",
        paragraphs: ["Use a .keepall.zip file or an older Keepall JSON backup. In Settings, choose Import backup in the Backup section, select the file, and review the choices.", "Merge adds the backup to your current library. Replace removes the current library and restores the backup instead. Download a fresh backup before replacing anything you may want to keep.", "After importing, check a few notes and media items before deleting your original copy."],
        links: [{ label: "Understand storage and backups", href: "/help/storage-and-backups" }],
      },
    ],
    action: { label: "Open Settings", href: "/settings" },
  },
  {
    slug: "storage-and-backups", category: "Your data", title: "Understand storage and backups",
    summary: "Know where your library lives, keep a separate copy, and move it when you need to.", minutes: "3 min read",
    sections: [
      { id: "storage", title: "Your browser holds the library", paragraphs: ["Keepall saves your links, notes, images, videos, collections, and tags in this browser profile on this device. You do not need an account. Another browser, profile, or device has a separate library. There is no automatic cloud sync.", "Clearing Keepall's site data can erase the library. Browser storage can also be removed by the browser or device. A downloaded backup gives you a separate recovery copy."] },
      {
        id: "download", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Keepall Backup settings showing Export backup and Import backup", caption: "Choose Export backup to download your library." }, title: "Download a backup",
        paragraphs: ["Make a backup after important additions and before clearing browser data, resetting a device, or changing browsers."],
        steps: ["Open Settings and find the Backup section.", "Choose Export backup. Keepall downloads a .keepall.zip file containing library data and saved images and videos.", "Keep that file somewhere you can find it again. For protection against losing the device, keep a copy on another device or storage service you choose."],
        links: [{ label: "Open backup settings", href: "/settings" }],
      },
      { id: "restore", visual: { kind: "transfer" }, title: "Restore or move your library", paragraphs: ["Open Keepall in the destination browser and import your backup from Settings. Choose Merge to add it to the current library, or Replace to overwrite the current library.", "Keep the original copy until you have checked the restored items. Importing a backup is a one-time transfer; it does not keep two libraries in sync."], links: [{ label: "Follow the import guide", href: "/help/import#backup" }] },
      {
        id: "mobile", title: "Storage on Android and iPhone",
        paragraphs: ["Chrome on Android and Safari on modern iPhones and iPads support the local storage Keepall uses, including saved images and videos. How much fits depends on your browser and free device space. Installing the app does not give you unlimited storage.", "Keepall asks the browser to protect your library from automatic cleanup. The browser decides whether to grant that protection; installing and regularly using the app can help. Check the storage status in Settings. Without protection, your browser may remove data when space runs low. Clearing site data yourself can erase even a protected library.", "On iPhone and iPad, install Keepall on your Home Screen before building your library. Its storage is separate from Safari. To move existing saves, export a backup in Safari and import it after opening the Home Screen app.", "Download a ZIP backup after important additions, and keep a copy outside the app. Avoid private browsing for a library you want to keep."],
        links: [{ label: "Apple's web storage policy", href: "https://webkit.org/blog/14403/updates-to-storage-policy/" }, { label: "How Chrome protects local storage", href: "https://web.dev/articles/persistent-storage" }, { label: "Apple's Home Screen storage separation", href: "https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps" }],
      },
      { id: "space", visual: { kind: "image", src: "/help/storage-settings.webp", width: 1536, height: 726, alt: "Keepall Storage settings showing browser storage usage and protection status", caption: "Check your own storage status in Settings. This example’s values will differ from yours." }, title: "Check available storage", paragraphs: ["Settings shows the browser's estimated storage usage and allowance, plus whether it has granted storage protection. These estimates can change. Protection is not a substitute for a backup.", "Large images and videos use more space. If saving fails because storage is full, download a backup before removing items you no longer need."] },
      { id: "previews", title: "How link previews use the internet", paragraphs: ["While online, Keepall may send a saved page's URL to its preview service to request a title, description, or image. Your personal notes, collections, and tags are not included in that request."], links: [{ label: "Read extension privacy details", href: "/extension-privacy" }] },
    ],
    action: { label: "Open Settings", href: "/settings" },
  },
  {
    slug: "offline", category: "Everyday use", title: "Use Keepall offline",
    summary: "Understand what stays available without a connection and what still needs the web.", minutes: "2 min read",
    sections: [
      { id: "prepare", title: "Open your library while online first", paragraphs: ["Keepall needs to load before your browser can keep a copy of the app for offline use. Open the library while connected, then return to it in the same browser or installed app.", "If an offline page says it cannot open the library, reconnect and open Keepall again. A first visit or a page the browser has not kept may need the internet."] },
      { id: "available", visual: { kind: "offline" }, title: "Work with locally saved content", paragraphs: ["When the cached library opens, you can browse and search your saves, read notes, and view images and video files stored in Keepall. You can also make local changes to your library.", "Availability depends on the browser keeping both the app and its saved data. Download backups regularly."] },
      { id: "internet", title: "What still needs a connection", paragraphs: ["Opening a saved web link takes you to its original website, which normally needs the internet. Keepall does not save full web articles for offline reading. New link previews and images downloaded from websites also need a connection.", "Extension saves depend on being able to reach Keepall's saved app files. If capture fails offline, reconnect and retry. Wait for a saved confirmation before assuming the item is in your library."] },
      { id: "updates", visual: { kind: "image", src: "/help/backup-settings.webp", width: 1536, height: 350, alt: "Keepall Backup settings with Export backup", caption: "Export a backup while your library is available. Store it outside the app." }, title: "When an update is ready", paragraphs: ["Keepall shows an update notice when a new app version is ready. Finish and save any edits, then use the notice's reload action. This updates the app; it does not create a backup of your library."], links: [{ label: "Keep a backup of your library", href: "/help/storage-and-backups#download" }] },
    ],
    action: { label: "Open your library", href: "/" },
  },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
