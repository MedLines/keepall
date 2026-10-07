import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import designReferenceThumbnail from "../../../public/blog/design-reference-library.webp";
import browserBookmarksThumbnail from "../../../public/blog/browser-bookmarks.webp";
import researchThumbnail from "../../../public/marketing/app-pdf-reader-detail.webp";
import screenshotThumbnail from "../../../public/marketing/app-image-tools-detail.webp";
import { ArrowRightIcon } from "../shell-icons";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";

export const metadata: Metadata = {
  title: { absolute: "Blog · Keepall" },
  description: "Practical Keepall workflows for design references, browser bookmarks, project research, and searchable screenshots.",
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
      description="Save references, organize bookmarks, read project research, and find screenshots by their text or colors."
    >
      <ul className="kb-post-list" aria-label="Workflow articles">
        <li>
          <Link href="/blog/design-reference-library" className="kb-post-link" aria-labelledby="design-reference-title">
            <div className="kb-post-thumbnail">
              <Image src={designReferenceThumbnail} alt="" sizes="(max-width: 580px) calc(100vw - 40px), (max-width: 680px) calc(100vw - 64px), 300px" loading="eager" />
            </div>
            <div className="kb-post-copy">
              <span className="kb-post-meta">Design references · 4 min read</span>
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
              <h2 id="browser-bookmarks-title">Import browser bookmarks and find them again</h2>
              <p>Import an HTML export, organize one useful folder, and add notes that help you find old links.</p>
              <span className="kb-read">Read the bookmark workflow <ArrowRightIcon /></span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/blog/project-research" className="kb-post-link" aria-labelledby="project-research-title">
            <div className="kb-post-thumbnail kb-post-thumbnail-detail kb-post-thumbnail-research" aria-hidden="true">
              <span>Reading &amp; research</span>
              <div><Image src={researchThumbnail} alt="" sizes="(max-width: 680px) calc(100vw - 104px), 260px" /></div>
            </div>
            <div className="kb-post-copy">
              <span className="kb-post-meta">Project research · 5 min read</span>
              <h2 id="project-research-title">Keep project research and your own notes together</h2>
              <p>Read saved articles, PDFs, and Markdown in one collection, then record the decisions they help you make.</p>
              <span className="kb-read">Read the research workflow <ArrowRightIcon /></span>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/blog/searchable-screenshots" className="kb-post-link" aria-labelledby="searchable-screenshots-title">
            <div className="kb-post-thumbnail kb-post-thumbnail-detail kb-post-thumbnail-tools" aria-hidden="true">
              <span>Text &amp; color</span>
              <div><Image src={screenshotThumbnail} alt="" sizes="(max-width: 680px) calc(100vw - 104px), 260px" /></div>
            </div>
            <div className="kb-post-copy">
              <span className="kb-post-meta">Screenshot library · 4 min read</span>
              <h2 id="searchable-screenshots-title">Find saved screenshots by their text and colors</h2>
              <p>Recognize English text, extract a palette, and search for details you remember from an image.</p>
              <span className="kb-read">Read the screenshot workflow <ArrowRightIcon /></span>
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
