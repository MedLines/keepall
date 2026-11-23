export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  sections: { label: "New" | "Improved" | "Fixed"; notes: string[] }[];
  guides?: { label: string; href: string }[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    id: "2026-11-23-agents-save-files-and-markdown",
    date: "2026-11-23",
    title: "Agents save files, and you see everything first",
    summary: "A connected agent can save images, videos, PDFs, and Markdown or text files, and every new item shows in your review before it's saved. Markdown notes can highlight text in Keepall's accent color.",
    sections: [
      { label: "New", notes: [
        "Agents can save what you can save yourself: images or a gallery of them, MP4 and WebM videos, PDFs, and Markdown or text files, from their computer or a web address. Files save the same way as Add files, with the same size limits.",
        "In a Markdown note, ==text== highlights the words in Keepall's rose accent color, in the library, previews, and Keepall Capture.",
      ] },
      { label: "Improved", notes: [
        "New notes, links, and files from an agent open in Agent review with their full content before they're saved. Save each to your library, change its collection or tags first, or choose Don't save.",
        "Notes an agent writes in Markdown are saved as Markdown, so headings, checklists, and tables show as they should.",
      ] },
      { label: "Fixed", notes: [
        "Finishing the last item in Review one at a time shows Review complete instead of closing the review.",
        "A new note's card in Agent review shows its text instead of only its title under the selection control.",
      ] },
    ],
    guides: [
      { label: "Use Keepall with AI agents", href: "/help/ai-agents" },
      { label: "Format a note with Markdown", href: "/help/notes#format" },
    ],
  },
  {
    id: "2026-11-22-connect-ai-agents",
    date: "2026-11-22",
    title: "Connect an AI agent to your library",
    summary: "Let Claude Code, Codex, OpenCode, or another agent search your library, look at your saved images, and help organize it, with end-to-end encryption and your review.",
    sections: [
      { label: "New", notes: [
        "In Settings, Agents, choose your agent and what it can do: Read only, Suggest changes, or Make changes. Keepall gives you one setup step to paste into the agent. You don't install anything else.",
        "A connected agent can search your library, read items in full, look at saved images, add tags and notes, move items between collections, rename collections, move items to Trash, and save new links and notes.",
        "With Suggest changes, nothing changes until you review it. Agent review in the sidebar shows waiting suggestions as library cards. Open one to see the item, then accept, change, or skip each suggestion, or apply or decline the rest at once.",
        "Every agent change keeps a copy of what it replaced. Recent changes in Settings shows what each agent did, and Undo puts it back, leaving alone anything you edited since. With a backup folder set, approving suggestions saves a backup first.",
      ] },
      { label: "Improved", notes: [
        "Requests and answers are encrypted between your browser and the agent's computer. Keepall's relay passes them along without being able to read them. What an agent reads is sent to its AI provider, as with anything you share with that agent.",
        "The agent can reach your library while a Keepall tab is open. Keepall Capture 0.6.0, now in Chrome Web Store review, keeps it reachable while Chrome runs and shows waiting suggestions on its toolbar icon.",
      ] },
    ],
    guides: [
      { label: "Connect an agent", href: "/settings#agents-connect-heading" },
      { label: "What agents and the relay receive", href: "/privacy#agents" },
    ],
  },
  {
    id: "2026-11-12-capture-screenshots-and-notices",
    date: "2026-11-12",
    title: "Page screenshots, Context Packs, and steadier save notices",
    summary: "Add screenshots to saved links, export your library for an AI agent, and rely on Capture notices that stay put when something goes wrong.",
    sections: [
      { label: "New", notes: [
        "After Keepall Capture saves a page, choose the camera button in the notice to add a screenshot of what is on screen to the link. Scroll and add more, up to eight. You can also right-click an empty part of a page and choose Save page with screenshot. Each link shows its screenshots in a section you can open full screen, and you can pick one as the card cover or remove it.",
        "Export for an AI agent turns the current results or your selected items into a Context Pack: a ZIP with a Markdown card for each item, a manifest, and, if you choose, the original files. You see the item count and an estimate of the text size before downloading, and you can copy a line for your project's AGENTS.md.",
      ] },
      { label: "Improved", notes: [
        "Save notices stay on screen after an error and say what went wrong, with a button to open Settings when the cause is the connection or a permission. A saving badge on the toolbar icon shows every save in progress.",
        "Press Alt+Shift+K to move keyboard focus to the save notice. Screen readers announce notices, and focus returns to the page when you dismiss one or choose Undo. Notices also appear above website pop-ups.",
        "The capture drawer no longer saves when you press Enter, can save while collections are still loading, and recovers from an interrupted save. If a link changed in Keepall while the drawer was open, it reloads the latest version and keeps what you typed.",
        "The Options page checks the connection to your library when it opens. The address field stays available for running Keepall locally during development.",
      ] },
      { label: "Fixed", notes: [
        "Typing in the notice's organizer search no longer triggers a website's own keyboard shortcuts.",
      ] },
    ],
    guides: [{ label: "Save files from Chrome", href: "/help/chrome-capture#local-files" }],
  },
  {
    id: "2026-10-19-trash-undo-and-untitled-notes",
    date: "2026-10-19",
    title: "Undo stays in the library bar",
    summary: "A deleted item can come back from the same place you were working, and untitled notes stay readable.",
    sections: [
      { label: "Improved", notes: [
        "After you move an item to Trash, Undo appears in the library top bar for a few seconds. It does not push the cards down. Hover, focus, a busy library, or a hidden tab keeps it available. If undo fails, the notice stays until you dismiss it.",
      ] },
      { label: "Fixed", notes: [
        "A note without a title no longer repeats its first line as the title and the body.",
      ] },
    ],
    guides: [{ label: "Restore items from Trash", href: "/help/collections-and-tags#trash" }],
  },
  {
    id: "2026-10-08-capture-files-and-contact",
    date: "2026-10-08",
    title: "Save files from Chrome, and ask for help",
    summary: "Keepall Capture can save local files from the page you are on. Contact is open for questions, bugs, and ideas.",
    sections: [
      { label: "New", notes: [
        "In the Capture drawer, choose Add files for images, MP4 or WebM videos, PDFs, text, and Markdown, or paste an image. Those files become their own library items. Mixed files save separately, with progress, retry, and cancel. Bulk import opens Keepall's import dialog and keeps the drawer draft.",
        "Right-click the extension icon and choose Open Keepall library to focus an open library tab or open a new one.",
        "Contact accepts help requests, bug reports, and ideas. Bug reports ask for your browser, the steps you took, and what went wrong. GitHub issues remain available if you prefer a public report.",
      ] },
    ],
    guides: [
      { label: "Save files from Chrome", href: "/help/chrome-capture#local-files" },
      { label: "Open your library from Capture", href: "/help/chrome-capture#find-saves" },
      { label: "Contact Keepall", href: "/contact" },
    ],
  },
  {
    id: "2026-10-07-read-find-and-review",
    date: "2026-10-07",
    title: "Read more. Find more. Clear your Unsorted.",
    summary: "Saved articles, image colors, screenshot text, and a focused way to organize the things you kept for later.",
    sections: [
      { label: "New", notes: [
        "Save a readable article from a link's details for offline reading. Headings, lists, links, and supported article images stay with the saved copy. Search its text and include it in your library backup.",
        "Extract a palette from each saved image. Copy a swatch's hex code or search for nearby shades with color:red or color:#FF0000. Combine color filters with words to narrow your results.",
        "Read English text from screenshots on your device. Copy the result or find the image by its words in library search. Recognition has progress, cancellation, and retry; saved results and palettes travel with your backups.",
        "Review Unsorted one item at a time. Choose a collection, add tags, file and move on, skip, or move an item to Trash. Undo returns to the previous action, including after the last item.",
        "Choose your own shortcuts for saving, search, grid/list, and Preview in Settings. Record a single key or a combination, review it, then confirm. Reset to defaults whenever you need.",
        "Hover over a video card to watch a short, muted preview before opening it. Previews stop when you leave the card or scroll, and respect reduced motion.",
      ] },
      { label: "Improved", notes: [
        "Empty libraries offer a first save, bookmark import, and backup restore. Search empty states make it easier to clear filters and look across your library.",
        "Bookmark, file, and backup imports show progress. Cancel a running import safely; completed file imports stay saved, while backup restore protects the library from a partial restore.",
        "The video viewer has shared playback controls, seeking, volume, playback speed, and fullscreen. Image palettes and screenshot text sit below their image and can be collapsed separately.",
        "Choose Auto or one, two, or three columns in list view. Compact rows keep notes, tags, and collection details close to each item, with steadier scrolling and sidebar resizing.",
      ] },
      { label: "Fixed", notes: [
        "Open a saved link's full view from its item menu, with the same item carried through from Preview.",
        "Settings sections change without flashing. Switching a PDF between Pages and Scroll keeps the viewer layout steady.",
        "Article saving works through the public app, including supported inline images. Edits and preview updates preserve each other's changes.",
      ] },
    ],
    guides: [
      { label: "Image colors and screenshot text", href: "/help/images-and-videos#palette" },
      { label: "Review Unsorted", href: "/help/collections-and-tags#unsorted-review" },
      { label: "Choose app shortcuts", href: "/help/collections-and-tags#app-shortcuts" },
      { label: "Save articles offline", href: "/help/saved-articles" },
    ],
  },
  {
    id: "2026-10-06-pdf-documents",
    date: "2026-10-06",
    title: "PDFs belong in your library, too",
    summary: "Keep documents beside your other saves and find them by the text inside.",
    sections: [
      { label: "New", notes: [
        "Import local PDFs, read them in Pages or Scroll view, zoom, select text, and download the original. Add a title, personal note, tags, and a collection without changing the PDF itself.",
        "Search selectable PDF text with highlighted excerpts. Scanned PDFs can be viewed, but their page images are not searchable. Viewing and text extraction run on your device.",
      ] },
    ],
    guides: [{ label: "Import and read documents", href: "/help/import#documents" }],
  },
  {
    id: "2026-10-05-folder-backups-and-text-files",
    date: "2026-10-05",
    title: "Automatic folder backups and editable files",
    summary: "A recovery copy that keeps up with your library, and a home for your text and Markdown files.",
    sections: [
      { label: "New", notes: [
        "Choose a backup folder in a supported browser. Keepall writes a first backup, then backs up changed library data every 30 minutes while the app is open. It keeps the latest three verified backups.",
        "Import .txt and .md files, edit Keepall's copy, add a personal note, and download the saved file. Search the full text, including content beyond a shortened preview.",
      ] },
      { label: "Improved", notes: [
        "Import multiple files together and retry failed files without duplicating successful saves. Saved documents and their edits are included in backups.",
      ] },
      { label: "Fixed", notes: [
        "A failed backup merge rolls back its changes, so an interrupted restore does not leave a partially changed library. Search results stay stable while you type.",
      ] },
    ],
    guides: [
      { label: "Set up folder backups", href: "/help/storage-and-backups#automatic" },
      { label: "Import text and Markdown", href: "/help/import#documents" },
    ],
  },
  {
    id: "2026-10-02-import-and-folder-previews",
    date: "2026-10-02",
    title: "Bring in a folder, keep control of the import",
    summary: "A clearer bulk import flow and collection previews that show what you saved.",
    sections: [
      { label: "Improved", notes: [
        "Open bookmark and image-folder imports from Save item's Bulk import action. Folder preparation shows progress before you confirm the save.",
        "Remove individual images from a pending save, or remove them all. Returning to the drawer preserves the rest of your unfinished draft.",
        "Collection folders show refreshed previews, and link icons have more consistent placement.",
      ] },
    ],
    guides: [{ label: "Bring over your saves", href: "/help/import" }],
  },
  {
    id: "2026-10-01-browse-with-the-keyboard",
    date: "2026-10-01",
    title: "Browse without opening every item",
    summary: "Keep moving through your library with quick previews and keyboard navigation.",
    sections: [
      { label: "New", notes: [
        "Focus a library item and use arrow keys to browse. Space opens Preview, arrows keep moving through the results, and Enter opens the full item. Escape returns focus to the item you were viewing.",
        "Refresh a link preview manually when its title or image needs another try.",
      ] },
      { label: "Improved", notes: [
        "Search supports quoted phrases and Best match ordering. Image viewing offers Fit and Scroll, with a background choice for different images.",
      ] },
      { label: "Fixed", notes: [
        "Automatic link previews resume after collection navigation, and item menus stay stable while you browse.",
      ] },
    ],
    guides: [{ label: "Browse and preview your library", href: "/help/getting-started#find-it" }],
  },
  {
    id: "2026-09-30-organize-and-restore",
    date: "2026-09-30",
    title: "More room to organize, more clarity before restore",
    summary: "Dedicated collection and tag views, plus a chance to inspect a backup before importing it.",
    sections: [
      { label: "New", notes: [
        "Browse collections and tags in their own library views. Use Unsorted in an item's organizer or a bulk action to remove its collection.",
        "Review a backup's contents and compare them with your library before choosing Merge or Replace. Restore selected items from Trash together.",
      ] },
      { label: "Improved", notes: [
        "Capture and editors protect unfinished drafts. Bulk actions disclose selected items hidden by your current filters, and mobile navigation opens in a focused dialog.",
      ] },
    ],
    guides: [{ label: "Organize with collections and tags", href: "/help/collections-and-tags" }],
  },
  {
    id: "2026-09-27-trash-and-search",
    date: "2026-09-27",
    title: "A second chance for deleted saves",
    summary: "Trash makes deletion recoverable, and search shows why an item matched.",
    sections: [
      { label: "New", notes: [
        "Deleted items go to Trash. Restore a save when you change your mind, or permanently delete items you no longer need. Bulk deletion uses the same recovery flow.",
      ] },
      { label: "Improved", notes: [
        "Search highlights matching words and shows excerpts from saved content, making the right result easier to recognize.",
      ] },
    ],
  },
  {
    id: "2026-09-26-capture-from-the-web",
    date: "2026-09-26",
    title: "Save the part of a page you want to keep",
    summary: "Keepall Capture adds more ways to save and organize without leaving your tab.",
    sections: [
      { label: "New", notes: [
        "Right-click a link, image, or selected passage to save it. Selected text becomes a note on its source link, and images keep their source address.",
        "Open a saved item, undo a save, or choose its collection from the extension's confirmation. Extension settings show the assigned shortcut and offer a connection check.",
      ] },
      { label: "Improved", notes: [
        "Unfinished capture-panel edits are kept in the current tab when you close and reopen the panel. Theme options let the extension match your preference.",
      ] },
    ],
    guides: [{ label: "Use Keepall Capture", href: "/help/chrome-capture" }],
  },
  {
    id: "2026-09-24-larger-media-and-galleries",
    date: "2026-09-24",
    title: "Keep larger images and local videos",
    summary: "More space for your media, with easier navigation through saved galleries.",
    sections: [
      { label: "Improved", notes: [
        "Save images up to 20 MiB each and local videos up to 100 MiB. Gallery counters, arrow navigation, and click-to-zoom make multi-image saves easier to explore.",
      ] },
      { label: "Fixed", notes: [
        "Image capture failures report what happened instead of leaving you with an incomplete save.",
      ] },
    ],
    guides: [{ label: "Save images and videos", href: "/help/images-and-videos" }],
  },
  {
    id: "2026-09-22-markdown-and-storage-health",
    date: "2026-09-22",
    title: "Give your notes a little structure",
    summary: "Markdown, full note pages, and a clearer view of browser storage.",
    sections: [
      { label: "New", notes: [
        "Choose Markdown for notes, including notes on links and images. Preview headings, lists, and emphasis, then open a full note page when you want more room to read.",
        "Settings shows browser storage usage and whether persistent storage protection has been granted.",
      ] },
      { label: "Improved", notes: [
        "Capture has a visible note field, and inline note images can be viewed and removed while editing. Backups preserve Markdown and its saved media.",
      ] },
    ],
    guides: [{ label: "Understand browser storage", href: "/help/storage-and-backups" }],
  },
  {
    id: "2026-08-28-bookmarks-and-image-folders",
    date: "2026-08-28",
    title: "Bring your existing finds with you",
    summary: "Import browser bookmarks, image folders, or another Keepall library.",
    sections: [
      { label: "New", notes: [
        "Import a browser's bookmarks HTML file and use its folders to organize the links. Import a folder of images with progress and a storage-space warning.",
        "Merge a Keepall backup into the current library, or replace the library with the backup's contents.",
      ] },
      { label: "Improved", notes: [
        "Large libraries load images as you browse and render only the visible items. Folder navigation and repeat imports handle larger collections more efficiently.",
      ] },
    ],
    guides: [{ label: "Import your library", href: "/help/import" }],
  },
  {
    id: "2026-08-26-grid-list-and-bulk-organization",
    date: "2026-08-26",
    title: "Organize a little or a lot",
    summary: "Browse visually, scan a list, or tidy several saves together.",
    sections: [
      { label: "New", notes: [
        "Switch between grid and list, filter by item type, and select several items to change their tags or collection together.",
        "Pin important items within a collection. Choose a collection and tags as you save, or leave the item in Unsorted for later.",
      ] },
    ],
  },
  {
    id: "2026-08-21-library-backups",
    date: "2026-08-21",
    title: "A backup you can take with you",
    summary: "Export your library and restore it in another browser or on another device.",
    sections: [
      { label: "New", notes: [
        "Download a Keepall backup and restore the saved library in one operation. Your library remains on your device; moving a backup gives another browser its own copy.",
        "Library search, collection, and sort are remembered in the page address, so returning to that address restores the same view.",
      ] },
    ],
    guides: [{ label: "Back up and restore", href: "/help/storage-and-backups#download" }],
  },
  {
    id: "2026-08-20-collections-tags-and-search",
    date: "2026-08-20",
    title: "Find a home for your saves",
    summary: "Collections, tags, and local search join the library.",
    sections: [
      { label: "New", notes: [
        "Group saved items in collections and connect them with tags. Search titles, note content, and link addresses on your device.",
      ] },
    ],
  },
  {
    id: "2026-08-19-quick-capture",
    date: "2026-08-19",
    title: "Quick capture for links and notes",
    summary: "The first save-and-edit workflow, with no account required.",
    sections: [
      { label: "New", notes: [
        "Open capture with Alt/Option + K to save links and notes in your browser. Edit a note, link title, or address after saving.",
      ] },
    ],
  },
];
