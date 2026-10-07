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
const description = "Save design references with their source and a useful note, then find examples for the decisions in your next project.";

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
        <span className="kb-post-meta">4 min read</span>
      </div>
      <section>
        <h2>Start with the decision you need to make</h2>
        <p>A reference should help you make a decision. Save a page for its readable typography, a screenshot for its navigation, or a photograph for the colors you want to try. Write down the detail that matters.</p>
        <p>Before collecting, save a note describing the project, such as &quot;A portfolio with readable, well-spaced case studies.&quot; Use that brief to decide which references belong.</p>
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
        <p>In Save item, enter &quot;Portfolio redesign&quot; under Collection, choose Create collection, then save the reference. Choose this collection for later saves or move existing items into it. Choose All collections in the sidebar to browse folder previews.</p>
        <figure className="kb-figure">
          <Image src={collectionsOverviewImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Keepall Collections overview with folder previews for Design Inspiration, Quiet spaces, and Weekend projects" />
          <figcaption>All collections opens the folder overview. Choose a folder to see its saved items.</figcaption>
        </figure>
        <p>For general research, a broader collection can work. The example below groups layouts, typography, and photographs under &quot;Design Inspiration.&quot; Use a project collection when you need to review a specific set.</p>
        <figure className="kb-figure">
          <Image src={collectionImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="Keepall's Design Inspiration collection showing saved layout references, typography, and room photographs in a grid" />
          <figcaption>Design Inspiration selected in Keepall. The grid shows references saved in this collection.</figcaption>
        </figure>
        <p>Leave references in Unsorted until you know where they belong. See <Link href="/help/collections-and-tags#collections">how collections work</Link>.</p>
      </section>
      <section id="context">
        <h2>Save the source and the reason</h2>
        <p>Save a link to revisit a website. Save an image for a specific composition or detail. Choose Save item to paste a link or an image, or choose Add files for image files. Include a source link so you can return to the original.</p>
        <figure className="kb-figure kb-figure-drawer">
          <Image src={saveItemImage} width={960} height={2200} sizes="(max-width: 480px) calc(100vw - 64px), 400px" alt="Save to Keepall drawer with a CSS grid link, a personal note, Design Inspiration selected as its collection, and the favorites tag" />
          <figcaption>Save a link with a personal note, collection, and tag.</figcaption>
        </figure>
        <p>Add a note describing what you noticed. Use a title you would search for. To change it later, open the item&apos;s menu, choose Edit, then save your changes.</p>
        <blockquote className="kb-example">
          <p>&quot;The narrow text column makes the long case study easy to read. Try this spacing for the portfolio&apos;s project pages.&quot;</p>
        </blockquote>
        <p>A short note such as &quot;generous spacing for case study&quot; can be enough. The <Link href="/help/getting-started#first-save">first-save guide</Link> covers links, and the <Link href="/help/images-and-videos#images">image guide</Link> explains saving images and their source.</p>
      </section>
      <section id="tags">
        <h2>Use tags for details that repeat</h2>
        <p>Use a collection for the project and tags for details that apply across projects, such as &quot;typography&quot; or &quot;navigation.&quot; A reference can have several tags.</p>
        <p>Choose tags you expect to browse. If every reference has &quot;inspiration,&quot; a more specific tag may help you find the detail you need.</p>
        <p>In an item&apos;s three-dot menu, choose Tags to add or remove a tag. You can also choose tags in Save item before saving. Select a tag in the sidebar to return to those references.</p>
        <figure className="kb-figure">
          <Image src={tagsImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="The favorites tag selected in Keepall with one matching design reference" />
          <figcaption>The favorites tag filters the library to one marked reference.</figcaption>
        </figure>
        <p>The <Link href="/help/collections-and-tags#tags">tags guide</Link> shows how to add them and filter your library.</p>
      </section>
      <section id="return">
        <h2>Return with a question</h2>
        <p>Open the project collection with a question, such as how to lay out the first case-study page. Use Grid view to compare images or List view to read titles and notes.</p>
        <p>Search for words you remember from your notes. Below, &quot;quiet spaces&quot; finds image notes and a standalone note in different collections.</p>
        <figure className="kb-figure">
          <Image src={searchImage} width={2880} height={1720} sizes="(max-width: 824px) calc(100vw - 64px), 760px" alt="A Keepall search for quiet spaces showing four results with matching words highlighted in image notes and a standalone note" />
          <figcaption>Searching quiet spaces finds notes in different collections. The highlighted words show why each result matches.</figcaption>
        </figure>
        <p>Choose a detail to try and record why it fits your brief. Test it in your project before collecting more examples.</p>
        <p>Use the type filter beside search to narrow the result, or choose a collection or tag in the sidebar. Open the sort control and choose Best match while searching to put title matches first. See <Link href="/help/search#words">search and filters</Link> for the details.</p>
      </section>
      <section id="backup">
        <h2>Keep a copy of the work</h2>
        <p>Your references and notes live in this browser profile on this device. After a useful research session, open Settings, choose Storage &amp; backups, then choose Export backup. Keep the downloaded file outside the app. It includes your library data and saved image files.</p>
        <p>Follow the <Link href="/help/storage-and-backups#download">backup guide</Link> before clearing browser data or moving to another browser.</p>
        <Link href="/" className="ka-button ka-button-light">Open your library</Link>
      </section>
    </WebsitePage>
  );
}
