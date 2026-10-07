import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bookmarkImportImage from "../../../../public/help/bookmark-import.webp";
import bookmarkResultImage from "../../../../public/help/bookmark-result.webp";
import bookmarksImage from "../../../../public/marketing/app-bookmarks.webp";
import bookmarkNoteImage from "../../../../public/marketing/app-bookmark-note.webp";
import bookmarkSearchImage from "../../../../public/marketing/app-bookmark-search.webp";
import { WebsitePage } from "../../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../../website-metadata";

const title = "Give your browser bookmarks a useful second home";
const description = "Import your browser bookmarks into Keepall, organize a little at a time, and make old links easier to find with titles, notes, and search.";

export const metadata: Metadata = {
  title: { absolute: `${title} · Keepall` },
  description,
  alternates: { canonical: "/blog/browser-bookmarks" },
  openGraph: { title, description, url: "/blog/browser-bookmarks", type: "article", images: [websiteOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description, images: [websiteTwitterImage] },
};

export default function BrowserBookmarksArticle() {
  return (
    <WebsitePage eyebrow="Browser bookmarks" title={title} description={description}>
      <div className="kb-article-meta">
        <Link href="/blog">← All articles</Link>
        <span className="kb-post-meta">5 min read</span>
      </div>
      <section>
        <h2>Start with what you already saved</h2>
        <p>A bookmark folder often records a moment in your life. A move, a course, a project you finished two years ago. The links can still be useful, even when the folder names no longer explain much.</p>
        <p>Bringing them into Keepall gives you a place to add context and browse them alongside your notes and images. You can leave your browser bookmarks in place while you try it. Start by finding one group you actually want to use again.</p>
        <nav className="kb-contents" aria-label="In this article">
          <p>The workflow</p>
          <ol>
            <li><a href="#import">Export and import your bookmarks</a></li>
            <li><a href="#check">Check a familiar folder</a></li>
            <li><a href="#organize">Organize one useful group</a></li>
            <li><a href="#find">Give search something to find</a></li>
            <li><a href="#backup">Back up the library</a></li>
          </ol>
        </nav>
      </section>
      <section id="import">
        <h2>Export and import your bookmarks</h2>
        <p>Use your browser&apos;s bookmark manager to export bookmarks as an HTML file. Keep that original export until you have checked the import. If you already have important saves in Keepall, <Link href="/help/storage-and-backups#download">download a backup</Link> before adding a large batch.</p>
        <ol>
          <li>Open Keepall in the browser profile where you want to keep this library.</li>
          <li>Choose Save item, then Bulk import and Import browser bookmarks.</li>
          <li>Select the HTML export from your browser.</li>
          <li>Choose how browser folders update collections when a link already exists, then choose Import bookmarks.</li>
          <li>Read the added, merged, and skipped totals in Bulk import, then choose Done.</li>
        </ol>
        <p>The <Link href="/help/import#bookmarks">bookmark import guide</Link> covers these steps. A browser bookmark export and a Keepall backup are different files. Use the bookmark import option for the HTML export.</p>
        <figure className="kb-figure kb-figure-compact">
          <Image src={bookmarkImportImage} width={960} height={1116} sizes="(max-width: 580px) calc(100vw - 64px), 480px" alt="Import browser bookmarks dialog with Browser folder to Unsorted only, Keep Keepall collections, and Browser folders win choices" />
          <figcaption>The default files links from Unsorted using the browser folder. Already filed links keep their Keepall collection.</figcaption>
        </figure>
        <p>Browser tags are added with every option. New links use their browser folder as a collection. The choice above controls existing links.</p>
        <figure className="kb-figure kb-figure-compact">
          <Image src={bookmarkResultImage} width={960} height={848} sizes="(max-width: 580px) calc(100vw - 64px), 480px" alt="Bulk import showing Bookmarks: 5 added, 0 merged, 0 skipped after importing the sample HTML export" />
          <figcaption>This sample export added five links. Read your own result before closing the dialog.</figcaption>
        </figure>
        <p>This is a one-time import. Later changes in your browser&apos;s bookmark manager do not automatically update your Keepall library.</p>
      </section>
      <section id="check">
        <h2>Check a familiar folder</h2>
        <p>Pick a folder you know well and open its collection. Check a few titles, then use its source address to confirm the link takes you where you expect. Keep the original file while you investigate anything that looks wrong.</p>
        <p>Choose All items to see the wider library, or choose a collection in the sidebar to focus on one group. The example below is the Weeknight recipes collection created by the HTML import above. Its three links keep their exported titles and source addresses.</p>
        <figure className="kb-figure">
          <Image src={bookmarksImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Weeknight recipes collection showing the three recipe links imported from the sample browser bookmark export" />
          <figcaption>A browser folder becomes a Keepall collection. These imported links are shown without website previews.</figcaption>
        </figure>
        <p>A saved web address still points to its original website. Importing it does not preserve the whole site or guarantee the page will remain available. Keep a note of the information you need when a particular link matters.</p>
      </section>
      <section id="organize">
        <h2>Organize one useful group</h2>
        <p>Choose a current need, such as planning a trip or learning to cook a few new meals. Work through the relevant collection first. Rename vague item titles, move misplaced saves, and leave the rest for another day.</p>
        <p>Use a collection for the group you want to open together. Use a tag for an idea that crosses those groups. For example, a &quot;weeknight&quot; tag can connect recipes in different collections. Add it only where it helps you choose what to cook.</p>
        <p>Items without a collection appear in Unsorted. You can leave them there until you have a reason to file them. A small amount of organization that you use is more helpful than spending an afternoon rebuilding every old folder.</p>
        <p>See <Link href="/help/collections-and-tags#collections">moving saves into collections</Link> and <Link href="/help/collections-and-tags#tags">adding tags</Link> for the controls.</p>
      </section>
      <section id="find">
        <h2>Give search something to find</h2>
        <p>Old page titles do not always match what you remember. Add a personal note with the words you would use to look for the link. For a recipe, that might be &quot;quick lentil dinner, works with pantry ingredients.&quot; For a tutorial, write the problem it helped you solve.</p>
        <p>Try searching those words before reorganizing more items. Keepall searches titles, tags, notes, and source addresses. You can narrow the results by collection, tag, or item type. If an expected save is missing, clear those filters and try again.</p>
        <p>Open an item&apos;s three-dot menu and choose Edit to add your note, then choose Save changes. In this example, the imported lentil soup link has the note &quot;Quick pantry dinner.&quot; Searching &quot;pantry dinner&quot; finds it even though those words are absent from its title.</p>
        <figure className="kb-figure kb-figure-compact">
          <Image src={bookmarkNoteImage} width={1344} height={1408} sizes="(max-width: 580px) calc(100vw - 64px), 480px" alt="Edit link details dialog with the imported lentil soup title and a note beginning Quick pantry dinner" />
          <figcaption>Edit keeps your personal note separate from the bookmark title. Choose Save changes when ready.</figcaption>
        </figure>
        <figure className="kb-figure">
          <Image src={bookmarkSearchImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Keepall searching all items for pantry dinner and finding the imported lentil soup link through its saved personal note" />
          <figcaption>The highlighted words come from the note added to this imported bookmark.</figcaption>
        </figure>
        <p>Use the <Link href="/help/collections-and-tags#search">search guide</Link> when you need to refine a result. When a save is hard to find, add the missing context once you open it. That small edit improves the next visit.</p>
      </section>
      <section id="backup">
        <h2>Back up the library you have made</h2>
        <p>The imported links and your edits stay in this browser profile on this device. Another browser or device has a separate library. After checking the import and adding useful context, export a Keepall backup.</p>
        <p>In Settings, open Storage &amp; backups and choose Export backup. Keep the downloaded file somewhere outside the app. Your original bookmark HTML is still useful, but it does not contain the notes and organization you have added in Keepall.</p>
        <p>Follow the <Link href="/help/storage-and-backups#download">backup guide</Link> for a separate recovery copy, or the <Link href="/help/import#backup">restore guide</Link> to move that copy to another browser. Come back to one collection you use regularly and let the library improve as you use it.</p>
        <Link href="/" className="ka-button ka-button-light">Open your library</Link>
      </section>
    </WebsitePage>
  );
}
