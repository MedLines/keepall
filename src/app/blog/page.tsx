import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import designReferenceThumbnail from "../../../public/blog/design-reference-library.webp";
import browserBookmarksThumbnail from "../../../public/blog/browser-bookmarks.webp";
import { ArrowRightIcon } from "../shell-icons";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";

export const metadata: Metadata = {
  title: { absolute: "Blog · Keepall" },
  description: "Practical workflows for collecting references, organizing browser bookmarks, and returning to what you saved in Keepall.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog · Keepall",
    description: "Practical ways to build a personal library you can use again.",
    url: "/blog",
    type: "website",
    images: [websiteOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog · Keepall",
    description: "Practical ways to build a personal library you can use again.",
    images: [websiteTwitterImage],
  },
};

export default function BlogPage() {
  return (
    <WebsitePage
      eyebrow="Blog"
      title="Put your saves to use."
      description="A few practical ways to collect things that matter to you, give them enough context, and find them when you need them."
    >
      <ul className="kb-post-list" aria-label="Workflow articles">
        <li>
          <Link href="/blog/design-reference-library" className="kb-post-link" aria-labelledby="design-reference-title">
            <div className="kb-post-thumbnail">
              <Image src={designReferenceThumbnail} alt="" sizes="(max-width: 580px) calc(100vw - 40px), (max-width: 680px) calc(100vw - 64px), 300px" loading="eager" />
            </div>
            <div className="kb-post-copy">
              <span className="kb-post-meta">Design references · 5 min read</span>
              <h2 id="design-reference-title">Build a design reference library for your next project</h2>
              <p>Keep the layout, image, or small detail that caught your attention, along with a note about why it belongs in your project.</p>
              <span className="kb-read">Read the design workflow <ArrowRightIcon /></span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/blog/browser-bookmarks" className="kb-post-link" aria-labelledby="browser-bookmarks-title">
            <div className="kb-post-thumbnail">
              <Image src={browserBookmarksThumbnail} alt="" sizes="(max-width: 580px) calc(100vw - 40px), (max-width: 680px) calc(100vw - 64px), 300px" />
            </div>
            <div className="kb-post-copy">
              <span className="kb-post-meta">Browser bookmarks · 5 min read</span>
              <h2 id="browser-bookmarks-title">Give your browser bookmarks a useful second home</h2>
              <p>Bring in an HTML export, make sense of the folders you already have, and build a simple habit for finding old saves.</p>
              <span className="kb-read">Read the bookmark workflow <ArrowRightIcon /></span>
            </div>
          </Link>
        </li>
      </ul>
      <section>
        <h2>Looking for a specific step?</h2>
        <p>The <Link href="/help">Help guides</Link> cover saving, importing, collections, search, and backups. Start there when you need to find a control or check how something works.</p>
      </section>
    </WebsitePage>
  );
}
