import Image from "next/image";
import Link from "next/link";
import articleImage from "../../../public/marketing/app-article-reader-detail.webp";
import pdfImage from "../../../public/marketing/app-pdf-reader-detail.webp";
import markdownImage from "../../../public/marketing/app-markdown-document-detail.webp";
import imageToolsImage from "../../../public/marketing/app-image-tools-detail.webp";
import backupImage from "../../../public/marketing/app-backup.webp";
import { ArrowRightIcon, BackupIcon, SearchIcon } from "../shell-icons";
import { CHROME_EXTENSION_URL } from "../help/guides";
import { CaptureDemo } from "./capture-demo";

function ChromeMark() {
  return <svg className="ka-chrome-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="oklch(0.625730845 0.205841062 29.077253722)" d="M12 0a12 12 0 0 1 10.392 6H12a6 6 0 0 0-5.196 9L1.608 6A12 12 0 0 1 12 0Z" /><path fill="oklch(0.647549305 0.160277201 148.495469399)" d="M1.608 6A12 12 0 0 0 12 24l5.196-9A6 6 0 0 1 6.804 15Z" /><path fill="oklch(0.830437542 0.169810122 83.992721714)" d="M22.392 6A12 12 0 0 1 12 24l5.196-9A6 6 0 0 0 12 6Z" /><circle cx="12" cy="12" r="6" fill="oklch(1 0 0)" /><circle cx="12" cy="12" r="4.5" fill="oklch(0.630386154 0.180027381 259.956004329)" /></svg>;
}

export function FeatureBento() {
  return <section className="ka-bento-section ka-wrap" aria-labelledby="features-title">
    <div className="ka-section-heading"><h2 id="features-title">Read and find your saves.</h2></div>
    <div className="ka-bento">
      <article id="reading" className="ka-bento-card ka-bento-wide" aria-labelledby="reading-title">
        <div className="ka-bento-copy"><h3 id="reading-title">Save articles for offline reading.</h3><p>Choose Save for offline in a link&apos;s full item page to keep its readable text and available images.</p><Link href="/help/saved-articles" className="ka-text-link">Read the article guide <ArrowRightIcon /></Link></div>
        <figure className="ka-bento-media"><Image src={articleImage} alt="A full saved article in Keepall with its offline status, readable text, and inline image" sizes="(max-width: 700px) 85vw, 540px" /><figcaption>A saved article in Keepall</figcaption></figure>
      </article>
      <article className="ka-bento-card ka-bento-narrow" aria-labelledby="pdf-title">
        <div className="ka-bento-copy"><h3 id="pdf-title">Read PDFs in your library.</h3><p>Turn pages or scroll, zoom in, and search selectable text inside your saved PDFs.</p><Link href="/help/documents" className="ka-text-link">Read the document guide <ArrowRightIcon /></Link></div>
        <figure className="ka-bento-media"><Image src={pdfImage} alt="Keepall's PDF reader with Pages and Scroll modes, page navigation, zoom, and a complete page of text" sizes="(max-width: 700px) 85vw, 420px" /><figcaption>PDF pages and reading controls</figcaption></figure>
      </article>
      <article className="ka-bento-card ka-bento-narrow" aria-labelledby="notes-title">
        <div className="ka-bento-copy"><h3 id="notes-title">Write notes. Bring your files.</h3><p>Use Markdown and local images in notes, or import and edit MD and TXT files.</p><Link href="/help/notes" className="ka-text-link">Read the notes guide <ArrowRightIcon /></Link></div>
        <figure className="ka-bento-media"><Image src={markdownImage} alt="A complete Markdown document in Keepall with headings, lists, a table, and code" sizes="(max-width: 700px) 85vw, 420px" /><figcaption>An imported Markdown file</figcaption></figure>
      </article>
      <article id="image-tools" className="ka-bento-card ka-bento-wide" aria-labelledby="image-tools-title">
        <div className="ka-bento-copy"><h3 id="image-tools-title">Find images by color or text.</h3><p>Extract a palette, then search <code>color:red</code>. Use Read text to recognize English screenshot text and make it searchable.</p><div className="ka-bento-links"><Link href="/help/images-and-videos#palette" className="ka-text-link">Use palettes <ArrowRightIcon /></Link><Link href="/help/images-and-videos#image-text" className="ka-text-link">Read screenshot text <ArrowRightIcon /></Link></div></div>
        <figure className="ka-bento-media"><Image src={imageToolsImage} alt="Complete Palette and Screenshot text cards showing extracted colors and recognized English text in Keepall" sizes="(max-width: 700px) 85vw, 540px" /><figcaption>Palette and screenshot text results</figcaption></figure>
      </article>
      <article id="extension" className="ka-bento-card ka-bento-wide ka-bento-capture" aria-labelledby="capture-title">
        <div className="ka-bento-copy"><h3 id="capture-title">Save from Chrome.</h3><p>Keepall Capture saves pages, images, and selected text with their source. Press Alt+K on most websites to add a note.</p><div className="ka-bento-links"><a href={CHROME_EXTENSION_URL} className="ka-button ka-button-small"><ChromeMark />Add to Chrome <ArrowRightIcon /></a><Link href="/help/chrome-capture" className="ka-text-link">Set up Capture <ArrowRightIcon /></Link></div></div>
        <div className="ka-bento-demo"><CaptureDemo /></div>
      </article>
      <article className="ka-bento-card ka-bento-narrow ka-bento-text" aria-labelledby="browse-title">
        <div className="ka-bento-copy"><SearchIcon className="ka-bento-icon" /><h3 id="browse-title">Search and Preview.</h3><p>Search saved content, including file contents and recognized screenshot text.</p><p>Preview items, play local MP4 or WebM videos, and review Unsorted. Organize with collections, tags, and pins.</p><div className="ka-bento-links"><Link href="/help/search" className="ka-text-link">Search guide <ArrowRightIcon /></Link><Link href="/help/preview" className="ka-text-link">Preview guide <ArrowRightIcon /></Link><Link href="/help/images-and-videos#videos" className="ka-text-link">Local videos <ArrowRightIcon /></Link><Link href="/help/collections-and-tags" className="ka-text-link">Organize saves <ArrowRightIcon /></Link></div></div>
      </article>
      <article className="ka-bento-card ka-bento-narrow ka-bento-text" aria-labelledby="import-title">
        <div className="ka-bento-copy"><BackupIcon className="ka-bento-icon" /><h3 id="import-title">Import files and folders.</h3><p>Import browser bookmarks or a batch of supported files. Choose a folder to bring in its contents at once.</p><Link href="/help/import" className="ka-text-link">Import your saves <ArrowRightIcon /></Link></div>
      </article>
      <article id="your-library" className="ka-bento-card ka-bento-wide ka-bento-local" aria-labelledby="local-title">
        <div className="ka-bento-copy"><h3 id="local-title">Local storage. Portable backups.</h3><p>Your library stays in this browser on this device, with no account or automatic sync. Download a backup to protect your saves or move them to another browser.</p><p>Supported desktop browsers can save automatic backups to a folder.</p><Link href="/help/storage-and-backups" className="ka-text-link">Back up your library <ArrowRightIcon /></Link></div>
        <figure className="ka-bento-media"><Image src={backupImage} alt="Keepall backup settings with Export backup and Import backup controls" sizes="(max-width: 700px) 85vw, 380px" /><figcaption>Storage and backup settings</figcaption></figure>
      </article>
    </div>
    <p className="ka-bento-footnote">Once Keepall is cached, locally saved content works offline. Original websites and fetching new content need a connection. <Link href="/help/offline">Offline guide</Link>. Previews, article fetching, and website icons use network requests. Visits use Vercel Web Analytics. <Link href="/privacy">Privacy details</Link>.</p>
  </section>;
}
