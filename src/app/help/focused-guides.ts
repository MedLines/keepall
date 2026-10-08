import pdfImage from "../../../public/marketing/app-pdf-reader.webp";
import markdownImage from "../../../public/marketing/app-markdown-document.webp";
import previewImage from "../../../public/marketing/app-preview-document.webp";
import searchImage from "../../../public/marketing/app-search-files.webp";
import noteImage from "../../../public/help/note-editor.webp";
import type { Guide } from "./guides";

export const focusedGuides: Guide[] = [
  {
    slug: "search", category: "Find your saves", title: "Search your library",
    summary: "Find words in notes, saved articles, documents, and recognized screenshot text.", minutes: "3 min read",
    sections: [
      {
        id: "words",
        title: "Search words and phrases",
        paragraphs: [
          "Search includes titles, personal notes, captions, source addresses, filenames, tags, and saved articles. It also includes document contents and recognized image text.",
          "PDF search uses selectable text. Scanned page images and video audio are not searchable.",
          "Every word must match the item, but words can appear in different fields. Search ignores letter case.",
          "For example, recipe dinner can match recipe in a title and dinner in a note.",
          "Result excerpts label the matching source, such as File contents, My note, Saved article, or Image text. Matching words have highlights.",
          "Best match ranks title matches above source address matches.",
        ],
        steps: [
          "Enter words in the library search box.",
          "For an exact phrase, use double quotes, such as \"garden plan\".",
          "To rank matches, select Best match in the sort menu.",
        ],
        visual: { kind: "image", src: searchImage.src, width: searchImage.width, height: searchImage.height, alt: "Library search results with highlighted file content and recognized image text", caption: "Excerpts show where a word was found, including inside a saved file." },
      },
      {
        id: "scope",
        title: "Check the search location",
        paragraphs: [
          "Search stays within the current collection, tag, and item-type filters. Clear filters removes the query, type, and tag filters. It keeps the current collection, Unsorted, Trash, or overview.",
          "Search entire library keeps the query and removes collection, Unsorted, tag, and type limits. It is unavailable in Trash and the collection or tag overviews.",
          "All collections and All tags search names. Opening a collection or tag allows item search inside it. Trash has separate search and normal results exclude it.",
          "Pinned items stay first inside a collection. Clearing a Best match search returns the sort order to newest first.",
        ],
        steps: [
          "If results are missing, check the current collection, tag, and item type.",
          "To include other collections or tags, select Search entire library when available.",
        ],
        links: [{ label: "Organize with collections and tags", href: "/help/collections-and-tags" }, { label: "Restore an item from Trash", href: "/help/collections-and-tags#trash" }],
      },
      {
        id: "colors",
        title: "Search images by color",
        paragraphs: [
          "Color search matches only images with an extracted palette. Unknown color names return no results.",
          "color: is the only query operator. OR, exclusions, and type: syntax are unsupported. All query terms must match the item.",
        ],
        steps: [
          "If an image has no palette, select Extract palette in its menu.",
          "Enter color:red to search a color family.",
          "For similar shades of a hex color, enter color:#FF0000.",
          "To narrow the results, add words, such as color:red receipt.",
        ],
        links: [{ label: "Extract and copy a palette", href: "/help/images-and-videos#palette" }],
      },
      {
        id: "file-search",
        title: "Search file contents",
        paragraphs: [
          "Keepall reads saved documents locally during search. Large files and libraries can take longer. Search includes text beyond shortened reading previews.",
          "Scanned PDFs need a selectable text layer to match. Keepall does not recognize text in PDF page images.",
        ],
        steps: [
          "If some file text could not be searched, select Retry search.",
          "For screenshot text, select Read text on the saved image.",
          "Check the recognized text.",
          "Search words from the checked result.",
        ],
        links: [{ label: "Read and search documents", href: "/help/documents#search-and-backups" }, { label: "Recognize screenshot text", href: "/help/images-and-videos#image-text" }],
      },
    ], action: { label: "Search your library", href: "/" },
  },
  {
    slug: "documents", category: "Reading", title: "Read PDFs, Markdown and text files",
    summary: "Bring local files into your library, read them, and keep your own notes beside them.", minutes: "4 min read",
    sections: [
      {
        id: "import",
        title: "Import a document",
        paragraphs: [
          "Supported files are UTF-8 TXT and Markdown up to 10 MiB each, and PDF up to 50 MiB and 1,000 pages.",
          "Password-protected PDFs need an unlocked copy. Bulk import accepts multiple files or a folder.",
          "The Notes filter includes imported TXT and Markdown with standalone notes. The Documents filter includes all imported document types.",
          "Retry failed files keeps files that have already saved.",
        ],
        steps: [
          "Open Save item.",
          "Select Add files.",
          "Select the document.",
          "Select a collection and tags if needed.",
          "Select Save.",
          "Select Open full item in the item menu.",
        ],
        links: [{ label: "Import multiple files or a folder", href: "/help/import#images" }],
      },
      {
        id: "pdf",
        title: "Read a PDF",
        paragraphs: [
          "Pages shows one page at a time. Scroll shows the whole document. Previous page and Next page move between pages.",
          "The zoom menu offers Fit width and values from 75% to 200%. PDFs with a text layer allow text selection.",
          "Scanned pages remain viewable. Keepall does not recognize text in scanned PDF page images.",
        ],
        steps: [
          "Select Pages or Scroll.",
          "To jump to a page, enter its number in Page.",
          "Press Enter.",
          "Select a zoom setting if needed.",
        ],
        visual: { kind: "image", src: pdfImage.src, width: pdfImage.width, height: pdfImage.height, alt: "A saved PDF with Pages and Scroll controls, page navigation, and a zoom menu", caption: "Page navigation and zoom stay above the locally saved PDF." },
      },
      {
        id: "text-and-markdown",
        title: "Read and edit text files",
        paragraphs: [
          "TXT files show saved text. Markdown renders supported headings, lists, tables, and code. Imported Markdown does not load remote images or embedded HTML.",
          "Saving edits changes Keepall's copy. The original file on the device stays unchanged.",
          "Reading previews stop at 200,000 characters. Download file provides the complete saved file, including edits.",
        ],
        steps: [
          "To change saved text, select Edit.",
          "Edit the text.",
          "Save the changes.",
          "To keep a separate copy, select Download file.",
        ],
        visual: { kind: "image", src: markdownImage.src, width: markdownImage.width, height: markdownImage.height, alt: "A Markdown document rendered with headings, a table, and formatted text", caption: "Keepall renders imported Markdown using its own reading layout." },
        links: [{ label: "Write a standalone note with local images", href: "/help/notes" }],
      },
      {
        id: "personal-notes",
        title: "Add a personal note to a document",
        paragraphs: [
          "A personal note stays separate from document contents. It can use plain text or Markdown.",
          "Changing a PDF title or personal note does not change the PDF file. Download file provides a copy of the saved document.",
        ],
        steps: [
          "Select Edit on the item.",
          "Enter a personal note.",
          "Save the changes.",
        ],
        links: [{ label: "Browse document previews", href: "/help/preview#content" }],
      },
      {
        id: "search-and-backups",
        title: "Search and back up documents",
        paragraphs: [
          "Search includes titles, filenames, tags, personal notes, and saved file contents. TXT and Markdown search extends beyond the shortened reading preview.",
          "PDF search uses selectable text. Scanned pages need a text layer to match.",
          "Document reading, editing, and search run on this device. Keepall backups include document files and saved edits.",
        ],
        steps: [
          "Export a backup before clearing browser data or transferring the library.",
        ],
        links: [{ label: "Search your library", href: "/help/search" }, { label: "Back up your files", href: "/help/storage-and-backups#download" }],
      },
    ], action: { label: "Open your library", href: "/" },
  },
  {
    slug: "preview", category: "Browsing", title: "Browse without losing your place",
    summary: "Move through saves in a quick preview, then open the full item when you want more.", minutes: "3 min read",
    sections: [
      {
        id: "open",
        title: "Open quick preview",
        paragraphs: [
          "Preview browses the current collection, tag, or search results. It starts at the last focused item or the first result.",
          "Fetch preview and Refresh preview are different actions. They request online link metadata, such as a title, description, and cover.",
          "Save for offline and Update saved article save readable article text. That text appears on the full item page.",
        ],
        steps: [
          "Select Preview beside the Grid and List controls.",
          "To start with a specific item, select Preview in its item menu.",
        ],
        visual: { kind: "image", src: previewImage.src, width: previewImage.width, height: previewImage.height, alt: "A document quick preview with Back, Next, and Open full item controls over the library", caption: "Quick preview keeps the current results behind the item you are reading." },
      },
      {
        id: "keyboard",
        title: "Use preview with the keyboard",
        paragraphs: [
          "Back and Next follow the current result order. Space is the default Preview results shortcut. Arrow keys continue browsing while preview stays open.",
          "Shift with an arrow key extends a library selection. Escape closes preview and returns focus to the last previewed item.",
          "Enter opens the full item page. A link title can open the original website instead.",
          "Settings, General, App shortcuts can change Preview results. A changed assignment replaces Space.",
        ],
        steps: [
          "In the library, use Tab to focus a card or row.",
          "Use arrow keys to move between items.",
          "Press Space, or the assigned Preview results shortcut.",
          "Use Back, Next, or arrow keys to browse.",
          "To read the full item, press Enter or select Open full item.",
        ],
        links: [{ label: "Read a saved article", href: "/help/saved-articles#read" }],
      },
      {
        id: "content",
        title: "Read content in preview",
        paragraphs: [
          "Notes and documents are readable in preview. Local video files have playback controls. Image notes scroll separately below the media.",
          "For images, Fit shows the whole image. Scroll displays a long screenshot at the available width.",
          "Gallery controls move between images in one item. Back and Next move between saved items.",
          "Link preview shows the cover, description, source, and personal note. The saved article is on the full item page.",
        ],
        links: [{ label: "Read document files", href: "/help/documents" }, { label: "Play a saved video", href: "/help/images-and-videos#videos" }],
      },
      {
        id: "list",
        title: "Change the list layout",
        paragraphs: [
          "Grid and List show the same search results and collection. Auto adjusts list columns to the available width.",
        ],
        steps: [
          "Select List beside Preview.",
          "Open List columns.",
          "Select Auto, 1 column, 2 columns, or 3 columns.",
        ],
      },
    ], action: { label: "Browse your library", href: "/" },
  },
  {
    slug: "notes", category: "Writing", title: "Write notes with text and images",
    summary: "Keep a plain note or use Markdown for headings, tables, code, and locally saved images.", minutes: "3 min read",
    sections: [
      {
        id: "write",
        title: "Write a note",
        paragraphs: [
          "Standalone notes do not need a link or media file. Titles, collections, and tags are optional. Notes start as plain text.",
          "Markdown enables formatting. Preview shows the formatted note. Edit returns to writing.",
        ],
        steps: [
          "Open Save item.",
          "Enter the note.",
          "Add a title, collection, or tags if needed.",
          "For formatting, turn on Markdown.",
          "Select Preview to check the result.",
          "Select Save before closing the editor.",
          "To change the note later, select Edit in its item menu.",
        ],
        visual: { kind: "image", src: noteImage.src, width: noteImage.width, height: noteImage.height, alt: "The note editor with Markdown, Edit and Preview controls and an attached local image", caption: "The editor lets you check formatting and place images between paragraphs." },
      },
      {
        id: "format",
        title: "Format a note with Markdown",
        paragraphs: [
          "Markdown supports headings, lists, bold text, emphasis, inline code, fenced code blocks, and tables.",
          "Rendered checklists are read-only. Changes to the Markdown in Edit update the checkboxes.",
        ],
        steps: [
          "For a heading, start the line with # and a space.",
          "For a list item, start the line with - and a space.",
          "For an ordered list, start the line with a number followed by a period and a space.",
          "For bold text, use **text**.",
          "For emphasis, use *text*.",
          "For inline code, put backticks around the text.",
          "Select Preview to check the formatting.",
          "Save the changes.",
        ],
      },
      {
        id: "images",
        title: "Add an image to a note",
        paragraphs: [
          "Local image attachments are available for standalone notes. The editor lists attachments below its controls.",
          "Keepall stores attached images locally and includes them in backups. Imported Markdown does not load remote image links.",
        ],
        steps: [
          "Open the standalone note in Edit.",
          "Put the cursor where the image should appear.",
          "Select Add image at cursor.",
          "Select an image from the device.",
          "To remove an attachment, select Remove beside it.",
          "Save the changes.",
        ],
        links: [{ label: "Supported image files and limits", href: "/help/images-and-videos#images" }, { label: "Read imported Markdown files", href: "/help/documents#text-and-markdown" }],
      },
      {
        id: "personal-notes",
        title: "Add a personal note to another item",
        paragraphs: [
          "Links, images, videos, and documents can have personal notes. Plain text and Markdown are available.",
          "The note stays separate from article or document contents. Search includes the note text. Local image attachments are only available in standalone notes.",
        ],
        steps: [
          "Select Edit in the item menu.",
          "Enter why you saved the item or what you need to remember.",
          "Save the changes.",
        ],
        links: [{ label: "Search your notes", href: "/help/search" }],
      },
    ], action: { label: "Write a note", href: "/" },
  },
];
