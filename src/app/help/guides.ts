export type Guide = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  minutes: string;
  sections: { title: string; paragraphs: string[]; steps?: string[] }[];
  action?: { label: string; href: string };
};

export const guides: Guide[] = [
  {
    slug: "getting-started",
    category: "The basics",
    title: "Start your library",
    summary: "Save your first link, note, or image and make Keepall your own.",
    minutes: "3 min read",
    sections: [
      { title: "Save something", paragraphs: ["Open your library and use Save item to capture a link, write a note, or add an image. You can also press Alt + K to open capture; on a Mac, use Option + K.", "Give a link or image a note when you want to remember why you saved it. Notes can be plain text or Markdown."] },
      { title: "Let it land", paragraphs: ["Every new item can go to a collection and carry tags. You can leave it in Unsorted and decide where it belongs later. The important part is keeping it while it is still on your mind."] },
      { title: "Come back to it", paragraphs: ["Use search or browse by collection, tag, and item type. Open a saved note to read it fully; open a link to return to its source page."] },
    ],
    action: { label: "Open your library", href: "/" },
  },
  {
    slug: "collections-and-tags",
    category: "Organize",
    title: "Find a place for everything",
    summary: "Use collections, tags, and search without having to organize every save immediately.",
    minutes: "2 min read",
    sections: [
      { title: "Collections give things a home", paragraphs: ["Choose a collection when you save, or move an item later. Items without a collection appear in Unsorted. Browse a collection from the library sidebar when you want to focus on one part of your library."] },
      { title: "Tags make connections", paragraphs: ["Use tags for themes that cross collections, such as reading, recipes, or an ongoing project. An item can have more than one tag. Select a tag from the sidebar to see related items together."] },
      { title: "Search when you do not remember where it went", paragraphs: ["Search matches the details you saved, including titles and note text. You do not need to keep a perfect filing system to find something again."] },
    ],
    action: { label: "Browse your library", href: "/" },
  },
  {
    slug: "chrome-capture",
    category: "Capture",
    title: "Save from Chrome",
    summary: "Keep the page you are on with one click, or add details before saving.",
    minutes: "3 min read",
    sections: [
      { title: "One click to save", paragraphs: ["After installing Keepall Capture in Chrome, pin it to the toolbar. On an ordinary website, click the Keepall icon to save the current page. A small confirmation appears when the save succeeds. Keepall does not need to be open in a tab."] },
      { title: "Add a little more", paragraphs: ["Press Alt + K on Windows or Option + K on Mac while you are on another website. The capture drawer lets you change the title, write a note, choose Markdown, and pick a collection or tags. Save when you are ready.", "If the shortcut does not open Keepall, another extension may be using it. You can change the shortcut at chrome://extensions/shortcuts."] },
      { title: "Where it goes", paragraphs: ["The extension saves to Keepall in the same Chrome profile. If a Keepall tab is already open, your new item appears there without a refresh. Chrome internal pages cannot be captured."] },
    ],
    action: { label: "Read extension privacy details", href: "/extension-privacy" },
  },
  {
    slug: "storage-and-backups",
    category: "Your data",
    title: "Understand storage and backups",
    summary: "Know where your library lives and how to keep a copy of it.",
    minutes: "4 min read",
    sections: [
      { title: "Your browser holds the library", paragraphs: ["Keepall saves your links, notes, images, collections, and tags in this browser profile's local storage. You do not need an account. A different browser or profile has a separate library, and the extension uses the library in its own Chrome profile."] },
      { title: "Download a backup", paragraphs: ["Open Settings and use Backup to download a Keepall backup file. Keep that file somewhere you control, especially before clearing browser data, changing browsers, or resetting a device. Browser storage can be removed when site data is cleared; a backup is your recovery copy."] },
      { title: "Restore or bring in bookmarks", paragraphs: ["Settings also lets you import a Keepall backup and bring in browser bookmarks from an HTML export. Read the choices in the import dialog before replacing or merging library data."] },
      { title: "About link previews", paragraphs: ["When you are online, Keepall may request a saved page's title, description, or image through its preview service. The saved URL is sent for that request. Your personal notes, collections, and tags are not included."] },
    ],
    action: { label: "Open Settings", href: "/settings" },
  },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
