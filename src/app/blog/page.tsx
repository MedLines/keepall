import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { WebsitePage } from "../website-page";

export const metadata: Metadata = {
  title: { absolute: "Blog · Keepall" },
  description: "Practical workflows for collecting references, organizing browser bookmarks, and returning to what you saved in Keepall.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog · Keepall",
    description: "Practical ways to build a personal library you can use again.",
    url: "/blog",
    type: "website",
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
          <span className="kb-post-meta">Design references · 5 min read</span>
          <h2><Link href="/blog/design-reference-library">Build a design reference library for your next project</Link></h2>
          <p>Keep the layout, image, or small detail that caught your attention, along with a note about why it belongs in your project.</p>
          <Link href="/blog/design-reference-library" className="kb-read">Read the design workflow <ArrowRightIcon /></Link>
        </li>
        <li>
          <span className="kb-post-meta">Browser bookmarks · 5 min read</span>
          <h2><Link href="/blog/browser-bookmarks">Give your browser bookmarks a useful second home</Link></h2>
          <p>Bring in an HTML export, make sense of the folders you already have, and build a simple habit for finding old saves.</p>
          <Link href="/blog/browser-bookmarks" className="kb-read">Read the bookmark workflow <ArrowRightIcon /></Link>
        </li>
      </ul>
      <section>
        <h2>Looking for a specific step?</h2>
        <p>The <Link href="/help">Help guides</Link> cover saving, importing, collections, search, and backups. Start there when you need to find a control or check how something works.</p>
      </section>
    </WebsitePage>
  );
}
