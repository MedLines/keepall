import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import collectionsOverviewImage from "../../../../public/marketing/app-collections-overview.webp";
import collectionImage from "../../../../public/marketing/app-collection.webp";
import saveItemImage from "../../../../public/marketing/app-save-item.webp";
import tagsImage from "../../../../public/marketing/app-tags.webp";
import searchImage from "../../../../public/marketing/app-design-search.webp";
import { WebsitePage } from "../../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../../website-metadata";

const title = "Build a design reference library for your next project";
const description = "A practical workflow for saving design references, keeping their source and context, and finding the right example when you start making.";

export const metadata: Metadata = {
  title: { absolute: `${title} · Keepall` },
  description,
  alternates: { canonical: "/blog/design-reference-library" },
  openGraph: { title, description, url: "/blog/design-reference-library", type: "article", images: [websiteOpenGraphImage] },
  twitter: { card: "summary_large_image", title, description, images: [websiteTwitterImage] },
};

export default function DesignReferenceArticle() {
  return (
    <WebsitePage eyebrow="Design references" title={title} description={description}>
      <div className="kb-article-meta">
        <Link href="/blog">← All articles</Link>
        <span className="kb-post-meta">5 min read</span>
      </div>
      <section>
        <h2>Start with the decision you need to make</h2>
        <p>A reference is easier to use when you know why you saved it. A page with beautiful typography might help with your portfolio&apos;s reading layout. A room photograph might have the light or colors you want for an illustration. Those are different reasons, even if both images look good in a grid.</p>
        <p>Before collecting, write one sentence about the project. Something like &quot;A portfolio that gives long case studies room to breathe.&quot; Save it as a note in Keepall. That sentence gives you something to check each reference against when the collection starts to grow.</p>
        <nav className="kb-contents" aria-label="In this article">
          <p>The workflow</p>
          <ol>
            <li><a href="#collection">Give the project a collection</a></li>
            <li><a href="#context">Save the source and the reason</a></li>
            <li><a href="#tags">Use tags for recurring details</a></li>
            <li><a href="#return">Return with a question</a></li>
            <li><a href="#backup">Keep a copy of the work</a></li>
          </ol>
        </nav>
      </section>
      <section id="collection">
        <h2>Give the project a collection</h2>
        <p>In Save item, enter a name under Collection, such as &quot;Portfolio redesign,&quot; then choose Create collection and save the reference. Choose that collection for later saves, or move existing saves into it. A collection holds the things you want to consider together. Choose All collections in the sidebar to browse the folder previews.</p>
        <figure className="kb-figure">
          <Image src={collectionsOverviewImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Keepall Collections overview with folder previews for Design Inspiration, Quiet spaces, and Weekend projects" />
          <figcaption>All collections opens the folder overview. Choose a folder to see its saved items.</figcaption>
        </figure>
        <p>You can start with a broader collection if you are still exploring. The captured library below uses &quot;Design Inspiration&quot; for layouts, type, and photographs. Once a project has a clear brief, a specific collection makes the next review shorter.</p>
        <figure className="kb-figure">
          <Image src={collectionImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Keepall's Design Inspiration collection showing saved layout references, typography, and room photographs in a grid" />
          <figcaption>A real Keepall library with Design Inspiration selected. Its grid brings the saved visual references together.</figcaption>
        </figure>
        <p>If a reference arrives before you know where it belongs, leave it in Unsorted and come back to it. Saving does not need to become a filing exercise every time. See <Link href="/help/collections-and-tags#collections">how collections work</Link>.</p>
      </section>
      <section id="context">
        <h2>Save the source and the reason</h2>
        <p>Save a link when you want to revisit a whole website. Save an image when the useful part is a particular composition, screenshot, or detail. In Keepall, choose Save item to paste a link, choose Add files for images or documents, or paste an image. Add its source link when you have one so you can return to the original.</p>
        <figure className="kb-figure kb-figure-drawer">
          <Image src={saveItemImage} width={960} height={2200} sizes="(max-width: 480px) calc(100vw - 64px), 400px" alt="Save to Keepall drawer with a CSS grid link, a personal note, Design Inspiration selected as its collection, and the favorites tag" />
          <figcaption>Add context while saving. This draft keeps the link, your note, a collection, and a tag together.</figcaption>
        </figure>
        <p>Add a short note about what you noticed when saving. To change the title later, open the item&apos;s menu, choose Edit, and save your changes. Use a title you would search for. &quot;Nice website&quot; is hard to act on. A sentence about the actual detail gives future you something to work with.</p>
        <blockquote className="kb-example">
          <p>&quot;The narrow text column makes the long case study easy to read. Try this spacing for the portfolio&apos;s project pages.&quot;</p>
        </blockquote>
        <p>You do not need to analyze every save immediately. A rough note such as &quot;generous spacing for case study&quot; is enough to preserve the thought. The <Link href="/help/getting-started#first-save">first-save guide</Link> covers links, and the <Link href="/help/images-and-videos#images">image guide</Link> explains saving images and their source.</p>
      </section>
      <section id="tags">
        <h2>Use tags for details that repeat</h2>
        <p>Keep the collection tied to the project. Use tags for a detail you might want across projects, such as &quot;typography&quot; or &quot;navigation.&quot; A reference can have several tags, so a single page can help with both.</p>
        <p>Start with the words you already use when describing your work. Add a new tag when you have a reason to browse it. If &quot;inspiration&quot; applies to everything in the collection, it may be less useful than a note explaining the particular idea.</p>
        <p>In an item&apos;s three-dot menu, choose Tags to add or remove a tag. You can also choose tags in Save item before saving. Select a tag in the sidebar to return to those references.</p>
        <figure className="kb-figure">
          <Image src={tagsImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="The favorites tag selected in Keepall with one matching design reference" />
          <figcaption>The favorites tag filters the library to one marked reference.</figcaption>
        </figure>
        <p>The <Link href="/help/collections-and-tags#tags">tags guide</Link> shows how to add them and filter your library.</p>
      </section>
      <section id="return">
        <h2>Return with a question</h2>
        <p>When you start designing, open the project collection with a specific question. How should the case study open? What makes the navigation easy to scan? Browse the grid for visual comparisons, or choose List view beside Grid view when the titles and notes matter more.</p>
        <p>If you remember a phrase rather than a collection, search for it. In the capture below, &quot;quiet spaces&quot; finds the same words in notes attached to images and in a standalone note. The results cross collection boundaries. A few descriptive words at save time can be enough to bring an idea back.</p>
        <figure className="kb-figure">
          <Image src={searchImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="A Keepall search for quiet spaces showing four results with matching words highlighted in image notes and a standalone note" />
          <figcaption>Searching quiet spaces finds notes in different collections. The highlighted words show why each result matches.</figcaption>
        </figure>
        <p>Write down which detail you want to try in your own project. This is a good moment to stop collecting and test an idea. The reference has done its job when it helps you make a decision.</p>
        <p>Use the type filter beside search to narrow the result, or choose a collection or tag in the sidebar. Open the sort control and choose Best match while searching to put title matches first. See <Link href="/help/search#words">search and filters</Link> for the details.</p>
      </section>
      <section id="backup">
        <h2>Keep a copy of the work</h2>
        <p>Your references and notes live in this browser profile on this device. After a useful research session, open Settings, choose Storage &amp; backups, then choose Export backup. Keep the downloaded file outside the app. It includes your library data and saved image files.</p>
        <p>Before clearing browser data or moving to another browser, follow the <Link href="/help/storage-and-backups#download">backup guide</Link>. A project collection is worth keeping after the project ends, especially when its notes record what you learned.</p>
        <Link href="/" className="ka-button ka-button-light">Open your library</Link>
      </section>
    </WebsitePage>
  );
}
