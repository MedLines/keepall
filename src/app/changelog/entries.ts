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
