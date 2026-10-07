import Image from "next/image";
import Link from "next/link";
import articleImage from "../../../public/marketing/app-article-reader-detail.webp";
import pdfImage from "../../../public/marketing/app-pdf-reader-detail.webp";
import markdownImage from "../../../public/marketing/app-markdown-document-detail.webp";
import imageToolsImage from "../../../public/marketing/app-image-tools-detail.webp";
import { ArrowRightIcon } from "../shell-icons";

export function ReadingFeatures() {
  return <section id="reading" className="ka-reading ka-wrap" aria-labelledby="reading-title">
    <div className="ka-section-heading">
      <div><p className="ka-pill">Make time for a good read</p><h2 id="reading-title">Saved for later.<br /><span className="ka-brand-highlight">Ready when you are.</span></h2></div>
      <p>Articles worth keeping. Files you want nearby.<br />Read them in the same personal library.</p>
    </div>
    <div className="ka-reading-lead ka-stack-surface">
      <div className="ka-feature-card">
        <div className="ka-card-copy">
          <p className="ka-eyebrow">A quieter place to read</p>
          <h3>Keep the article.<br />Come back to the words.</h3>
          <p>Open a link&apos;s full item page and choose Save for offline. Keepall keeps a readable article copy, with locally saved images when available.</p>
          <p className="ka-card-caption">Read it without a connection once Keepall is cached. Saving a link alone keeps its address.</p>
          <Link href="/help/saved-articles" className="ka-card-foot">Save an article for later <ArrowRightIcon /></Link>
        </div>
        <figure className="ka-reading-scene ka-card-scene">
          <Image src={articleImage} alt="A saved article open in Keepall's full reader, with article text and a locally saved inline image" sizes="(max-width: 800px) 90vw, 620px" />
          <figcaption>Saved article / Full item</figcaption>
        </figure>
      </div>
    </div>
    <div className="ka-document-panels">
      <article className="ka-document-panel">
        <div className="ka-document-copy"><p className="ka-eyebrow">PDFs, close at hand</p><h3>Find your page.</h3><p>Turn pages or scroll, jump to a page, and zoom in. Search selectable text inside your saved PDFs.</p><Link href="/help/documents" className="ka-text-link">Read your documents <ArrowRightIcon /></Link></div>
        <figure className="ka-document-scene"><Image src={pdfImage} alt="A local PDF open in Keepall with Pages and Scroll modes, page navigation, and zoom controls" sizes="(max-width: 800px) 90vw, 560px" /><figcaption>PDF / Page controls</figcaption></figure>
      </article>
      <article className="ka-document-panel">
        <div className="ka-document-copy"><p className="ka-eyebrow">Markdown &amp; text files</p><h3>A home for your words.</h3><p>Import MD or TXT files, read and edit their text, and add a separate personal note. Write your own notes with formatting and local images, too.</p><Link href="/help/notes" className="ka-text-link">Write and keep notes <ArrowRightIcon /></Link></div>
        <figure className="ka-document-scene"><Image src={markdownImage} alt="An imported Markdown document rendered in Keepall with headings, lists, and formatted text" sizes="(max-width: 800px) 90vw, 560px" /><figcaption>Markdown / Rendered document</figcaption></figure>
      </article>
    </div>
  </section>;
}

export function ImageToolsFeature() {
  return <section id="image-tools" className="ka-image-tools ka-wrap" aria-labelledby="image-tools-title">
    <div className="ka-section-heading">
      <div><p className="ka-pill">More ways to find an image</p><h2 id="image-tools-title">Remember the color.<br /><span className="ka-brand-highlight">Find the words.</span></h2></div>
      <p>A palette from a saved image.<br />Searchable words from a screenshot.</p>
    </div>
    <div className="ka-image-tools-card ka-stack-surface">
      <div className="ka-feature-card">
        <div className="ka-card-copy">
          <p className="ka-eyebrow">Look a little closer</p>
          <h3>Your images have<br />more to tell you.</h3>
          <p>Extract an image&apos;s palette, copy its colors, and find images by color. Try <code>color:red</code> or <code>color:#FF0000</code> after extracting their palettes.</p>
          <p>Choose Read text to recognize English words in a saved screenshot. Review or copy the result, then find it again through search.</p>
          <p className="ka-card-caption">Read text works on saved images. Scanned PDFs and videos don&apos;t have text recognition.</p>
          <div className="ka-tool-links"><Link href="/help/images-and-videos#palette" className="ka-card-foot">Explore palettes <ArrowRightIcon /></Link><Link href="/help/images-and-videos#image-text" className="ka-card-foot">Read screenshot text <ArrowRightIcon /></Link></div>
        </div>
        <figure className="ka-image-tools-scene ka-card-scene"><Image src={imageToolsImage} alt="Keepall's extracted Palette and recognized Screenshot text cards for a saved image" sizes="(max-width: 800px) 90vw, 620px" /><figcaption>Image tools / Palette &amp; Screenshot text</figcaption></figure>
      </div>
    </div>
    <p className="ka-section-note">Search saved titles, descriptions, notes, article text, file contents, and recognized image text. <Link href="/help/search">See how library search works <ArrowRightIcon /></Link></p>
  </section>;
}
