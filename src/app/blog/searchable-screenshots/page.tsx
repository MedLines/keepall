import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import toolsImage from "../../../../public/marketing/app-image-tools-detail.webp";
import searchImage from "../../../../public/marketing/app-search-files.webp";
import { BlogArticle } from "../blog-article";
import { websiteOpenGraphImage, websiteTwitterImage } from "../../website-metadata";

const title = "Find saved screenshots by their text and colors";
const description = "Make English screenshot text searchable, extract useful colors, and preview the images you saved in Keepall.";

const contents = [
  { href: "#text", label: "Recognize the screenshot text" },
  { href: "#find", label: "Search for words in the image" },
  { href: "#palette", label: "Extract a palette and search by color" },
  { href: "#preview", label: "Preview the results" },
  { href: "#backup", label: "Back up the images and results" },
];

export const metadata: Metadata = {
  title: { absolute: `${title} · Keepall` }, description,
  alternates: { canonical: "/blog/searchable-screenshots" },
  openGraph: { title, description, url: "/blog/searchable-screenshots", type: "article", images: [websiteOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description, images: [websiteTwitterImage] },
};

export default function ScreenshotLibraryArticle() {
  return (
    <BlogArticle readTime="4 min read" contents={contents} eyebrow="Screenshot library" title={title} description={description}>
      <section>
        <h2>Save screenshots you expect to use again</h2>
        <p>A screenshot can contain a useful instruction, receipt number, or layout detail. Later, you may remember its words or colors better than its filename. Keepall can recognize English image text and extract a color palette so you can search for those details.</p>
        <p>Start with a screenshot you need for a current task. Choose Save item, then Add files, or paste the image with Ctrl/⌘ + V. Add a source link if it came from a website, and a short note describing why you saved it. Choose a collection and save.</p>
      </section>
      <section id="text">
        <h2>Recognize the screenshot text</h2>
        <ol>
          <li>Open the saved image and its three-dot menu.</li>
          <li>Choose Read text. Progress appears while recognition runs; Cancel stops it.</li>
          <li>Review the selectable result in the Screenshot text card below the image.</li>
          <li>Use the copy control if you need the text elsewhere.</li>
        </ol>
        <p>Recognition runs on your device. The engine and English data need a connection to Keepall on first use. Later offline use depends on your browser retaining those files. Text already recognized stays in the local library.</p>
        <p>Sharper images and closer crops usually produce better results. Check important numbers and wording against the original image. If recognition fails, choose Retry reading text. Use Read text again to refresh an existing result.</p>
        <figure className="kb-figure kb-figure-reader"><Image src={toolsImage} sizes="(max-width: 580px) calc(100vw - 40px), 620px" alt="Keepall's Palette and Screenshot text cards showing extracted color swatches and recognized English text" /><figcaption>The image tools save a palette and recognized text below the image. Review the text before relying on it.</figcaption></figure>
        <p>The <Link href="/help/images-and-videos#image-text">image-text guide</Link> covers the controls and limits. This tool recognizes English image text. It does not recognize scanned PDF pages or transcribe video audio.</p>
      </section>
      <section id="find">
        <h2>Search for words in the image</h2>
        <p>Return to the library and search for a word you can see in the recognized text. The example above includes &quot;FIELD NOTES.&quot; Searching &quot;field notes&quot; finds that image alongside files containing the same words.</p>
        <figure className="kb-figure"><Image src={searchImage} sizes="(max-width: 580px) calc(100vw - 40px), 760px" alt="A Keepall search for field notes showing an Image text excerpt on the matching screenshot beside Markdown and PDF results" /><figcaption>The Image text excerpt shows a match from recognition, even though the screenshot&apos;s title is Sunday studio.</figcaption></figure>
        <p>Use the type filter to narrow results to images, or open the collection where you saved the screenshot. Search stays within the current collection, tag, and type filters. Check them if you expect a result that is missing.</p>
        <p>See <Link href="/help/search#words">searching saved words</Link> and <Link href="/help/search#scope">changing the search scope</Link>.</p>
      </section>
      <section id="palette">
        <h2>Extract a palette and search by color</h2>
        <p>Open the image&apos;s three-dot menu and choose Extract palette. Keepall samples up to six dominant colors locally. Select a swatch in the Palette card to copy its hex code.</p>
        <p>To find similar colors, right-click a swatch and choose Search library for nearby colors. You can also type a query in library search:</p>
        <ul>
          <li><code>color:red</code> finds images in a broad red color family.</li>
          <li><code>color:#B34632</code> finds nearby shades of the reddish color shown in this example&apos;s palette.</li>
          <li><code>color:red receipt</code> requires both a matching color and the word receipt somewhere in the item.</li>
        </ul>
        <p>Only images with an extracted palette can match a color query. Extract palettes from the images you want to compare first. See <Link href="/help/images-and-videos#palette">palette controls</Link> and <Link href="/help/search#colors">color search</Link>.</p>
      </section>
      <section id="preview">
        <h2>Preview the results</h2>
        <p>Choose Preview beside the grid and list controls, or choose Preview from a particular item&apos;s menu. Use Back and Next to compare the saved items in the current result order.</p>
        <p>For a long screenshot, choose Scroll to read it at the available width. Choose Fit to see the whole image. Gallery buttons browse images within one item; Back and Next move between separate saves. Escape closes preview and returns to the library.</p>
        <p>Use the <Link href="/help/preview#content">image-preview guide</Link> for the controls. Once you find the screenshot, add any words that would have made the search easier to its personal note.</p>
      </section>
      <section id="backup">
        <h2>Back up the images and results</h2>
        <p>Keepall backups include the original saved images, palettes, and recognized text. After adding or analyzing a useful batch, open Settings, choose Storage &amp; backups, then Export backup. Keep the file outside the app.</p>
        <p>Each gallery image keeps its own analysis. Replacing or removing the original removes its palette and recognized text too. Follow the <Link href="/help/storage-and-backups#download">backup guide</Link> before clearing browser data or moving your library.</p>
        <Link href="/" className="ka-button ka-button-light">Open your library</Link>
      </section>
    </BlogArticle>
  );
}
