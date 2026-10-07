import type { Metadata } from "next";
import Link from "next/link";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";

export const metadata: Metadata = {
  title: "Changelog · Keepall",
  description: "Keepall's public feature baseline and release notes for changes available in the app.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog · Keepall",
    description: "Keepall's public feature baseline and release notes for changes available in the app.",
    url: "/changelog",
    type: "website",
    images: [websiteOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [websiteTwitterImage],
    title: "Changelog · Keepall",
    description: "Keepall's public feature baseline and release notes for changes available in the app.",
  },
};

export default function ChangelogPage() {
  return (
    <WebsitePage
      title="Changelog"
      eyebrow="Keepall updates"
      description="A record of what you can do with Keepall, and the changes that follow."
    >
      <section id="2026-10-07-public-baseline" aria-labelledby="public-baseline-title">
        <time className="kw-date" dateTime="2026-10-07">October 7, 2026</time>
        <h2 id="public-baseline-title">Current public baseline</h2>
        <p>
          This entry records the core features described on Keepall&apos;s public
          website on this date. It does not mark their original release date.
        </p>
        <ul>
          <li>
            Save links, notes, images, and local videos in your browser, without
            creating an account. <Link href="/help/getting-started">Start your library</Link>.
          </li>
          <li>
            Organize saves with collections and tags, search your library, and
            browse in grid or list view. <Link href="/help/collections-and-tags">Organize your saves</Link>.
          </li>
          <li>
            Use Keepall Capture in Chrome to save links, selected text, and images
            from websites. <Link href="/help/chrome-capture">Set up the extension</Link>.
          </li>
          <li>
            Import browser bookmarks and download a ZIP backup of your library,
            including saved media. Restore a backup to move a copy to another
            browser or device. <Link href="/help/import">Read the import guide</Link>.
          </li>
        </ul>
        <p>
          Your library lives in this browser profile on this device. Keep a separate
          backup before clearing browser data or changing devices. A backup transfer
          does not turn on automatic sync. <Link href="/help/storage-and-backups">Understand storage and backups</Link>.
        </p>
      </section>
      <section aria-labelledby="release-notes-title">
        <h2 id="release-notes-title">About these notes</h2>
        <p>
          Future entries will describe changes available on the public app, with
          their release dates. For instructions on using Keepall, visit
          the <Link href="/help">Help guides</Link>. To report a problem or suggest
          a change, <Link href="/contact">get in touch</Link>.
        </p>
      </section>
    </WebsitePage>
  );
}
