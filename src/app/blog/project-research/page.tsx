import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import articleImage from "../../../../public/marketing/app-article-reader-detail.webp";
import pdfImage from "../../../../public/marketing/app-pdf-reader-detail.webp";
import markdownImage from "../../../../public/marketing/app-markdown-document-detail.webp";
import searchImage from "../../../../public/marketing/app-search-files.webp";
import previewImage from "../../../../public/marketing/app-preview-document.webp";
import { BlogArticle } from "../blog-article";
import { websiteOpenGraphImage, websiteTwitterImage } from "../../website-metadata";

const title = "Keep project research and your own notes together";
const description = "Save articles, import PDFs and Markdown, and record what each source means for your project in one Keepall collection.";

const contents = [
  { href: "#articles", label: "Save the article you need to read" },
  { href: "#files", label: "Import PDFs and Markdown" },
  { href: "#notes", label: "Keep your conclusions separate" },
  { href: "#search", label: "Find a passage and compare sources" },
  { href: "#backup", label: "Back up the research" },
];

export const metadata: Metadata = {
  title: { absolute: `${title} · Keepall` }, description,
  alternates: { canonical: "/blog/project-research" },
  openGraph: { title, description, url: "/blog/project-research", type: "article", images: [websiteOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description, images: [websiteTwitterImage] },
};

export default function ProjectResearchArticle() {
  return (
    <BlogArticle readTime="5 min read" contents={contents} eyebrow="Project research" title={title} description={description}>
      <section>
        <h2>Collect the sources for one question</h2>
        <p>Planning a reading room might involve an article about lighting, a PDF with measurements, and a Markdown plan you wrote yourself. Keep them in one project collection so you can compare the source material with your decisions.</p>
        <p>Start with a note naming the question, such as &quot;Where should the desk go, and what lighting will it need?&quot; In Save item, enter a collection name, choose Create collection, then save. Choose that collection for the sources you add next.</p>
      </section>
      <section id="articles">
        <h2>Save the article you need to read</h2>
        <ol>
          <li>Choose Save item and paste the page address.</li>
          <li>Select your project collection, add a note about why this source matters, then save.</li>
          <li>Open the saved link&apos;s menu and choose Open full item.</li>
          <li>Choose Save for offline and wait for the saved article to appear.</li>
        </ol>
        <p>Article capture needs a connection. It requests the public page through Keepall&apos;s server and keeps a readable copy in your library. Some pages require a login or block capture. If it fails, the link and your note remain saved.</p>
        <figure className="kb-figure kb-figure-reader"><Image src={articleImage} sizes="(max-width: 580px) calc(100vw - 40px), 620px" alt="Keepall's saved article reader with the source, author, article text, inline photograph, and Update saved article control" /><figcaption>A saved article in Keepall&apos;s reading layout. Open original returns to the source website.</figcaption></figure>
        <p>Use <Link href="/help/saved-articles#capture">the saved-article guide</Link> for capture and its limits. A saved article preserves readable content; it does not archive the website&apos;s interactive tools or original layout.</p>
      </section>
      <section id="files">
        <h2>Import PDFs and Markdown</h2>
        <p>Choose Save item, then Add files to select a PDF, UTF-8 text file, or Markdown file. Choose your project collection and save. Use Bulk import for several files or a folder.</p>
        <p>Open a PDF&apos;s menu and choose Open full item. Use Pages to read one page at a time or Scroll to read continuously. The zoom menu lets you choose Fit width or a percentage. PDFs with selectable text can be searched; scanned page images can be viewed, but Keepall does not recognize their text.</p>
        <figure className="kb-figure kb-figure-reader"><Image src={pdfImage} sizes="(max-width: 580px) calc(100vw - 40px), 620px" alt="A locally saved PDF in Keepall with Pages, Scroll, page navigation, and Fit width controls above the reading page" /><figcaption>The PDF reader keeps page navigation and zoom above your saved file.</figcaption></figure>
        <p>Markdown is useful for a plan you revise as you read. Keepall renders headings, lists, tables, and code. Use Edit to change the saved text. Those edits affect Keepall&apos;s copy, while the original file on your device stays unchanged.</p>
        <figure className="kb-figure"><Image src={markdownImage} sizes="(max-width: 580px) calc(100vw - 40px), 760px" alt="An imported Markdown plan rendered in Keepall with headings, a list, a table, and a code block" /><figcaption>An imported Markdown plan in Keepall. Download file includes edits made to this saved copy.</figcaption></figure>
        <p>The <Link href="/help/documents#import">document guide</Link> covers file limits. Imported Markdown does not load remote images or embedded HTML.</p>
      </section>
      <section id="notes">
        <h2>Keep your conclusions separate</h2>
        <p>Use an item&apos;s Edit action to add a personal note. Describe how the source changes your plan, such as &quot;Check whether the desk lamp reaches the back edge of the table.&quot; This note stays separate from the article or document contents.</p>
        <p>Keep decisions that apply to the whole project in a standalone note in the same collection. Record the decision, the source that supports it, and any question you still need to answer. Update it after reading rather than copying every passage into it.</p>
        <p>See <Link href="/help/notes#personal-notes">personal notes on saved items</Link> and <Link href="/help/notes#write">writing a standalone note</Link>.</p>
      </section>
      <section id="search">
        <h2>Find a passage and compare sources</h2>
        <p>Open the project collection and search for words from the passage you remember. Search includes personal notes, saved articles, Markdown, and selectable PDF text. Excerpts show where a match came from. Large files can take longer to search.</p>
        <figure className="kb-figure"><Image src={searchImage} sizes="(max-width: 580px) calc(100vw - 40px), 760px" alt="Keepall search results for field notes with highlighted matches in saved Markdown, a PDF, and recognized image text" /><figcaption>Searching field notes finds saved file text as well as titles. Excerpts identify the matching content.</figcaption></figure>
        <p>Choose Preview to browse your current results with Back and Next. Notes and documents are readable in preview. For a saved article, choose Open full item to read its text.</p>
        <figure className="kb-figure"><Image src={previewImage} sizes="(max-width: 580px) calc(100vw - 40px), 760px" alt="A Markdown document in Keepall's quick preview with Back, Next, and Open full item beneath it" /><figcaption>Preview shows a document over the library so you can return to the same results.</figcaption></figure>
        <p>If something is missing, check the collection, tag, and type filters. The <Link href="/help/search#scope">search-scope guide</Link> explains how to broaden the search, and the <Link href="/help/preview#content">preview guide</Link> explains which content you can read there.</p>
      </section>
      <section id="backup">
        <h2>Back up the research</h2>
        <p>After importing sources or making important edits, open Settings, choose Storage &amp; backups, then Export backup. Keep the downloaded file outside the app. It includes saved articles, documents and their edits, and your personal notes.</p>
        <p>Your library lives in this browser profile on this device. Before moving browsers or clearing site data, follow the <Link href="/help/storage-and-backups#download">backup guide</Link>. Importing a backup on another device moves a copy; it does not keep the two libraries in sync.</p>
        <Link href="/" className="ka-button ka-button-light">Open your library</Link>
      </section>
    </BlogArticle>
  );
}
