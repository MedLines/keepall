import type { Metadata } from "next";
import Link from "next/link";
import { WebsitePage } from "../website-page";
import { websiteOpenGraphImage, websiteTwitterImage } from "../website-metadata";
import { changelogEntries } from "./entries";
import "./changelog.css";

const description = "New features, useful improvements, and fixes to Keepall, from offline reading and image tools to imports and backups.";

export const metadata: Metadata = {
  title: "Changelog · Keepall",
  description,
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog · Keepall",
    description,
    url: "/changelog",
    type: "website",
    images: [websiteOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [websiteTwitterImage],
    title: "Changelog · Keepall",
    description,
  },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default function ChangelogPage() {
  return (
    <WebsitePage
      title="Changelog"
      eyebrow="Keepall updates"
      description="New features, useful improvements, and fixes. Here's what's changed in your library."
    >
      <div className="kc-changelog">
        <nav className="kc-years" aria-label="Changelog months">
          <span>2026</span>
          <a href="#2026-10-07-read-find-and-review">October</a>
          <a href="#2026-09-30-organize-and-restore">September</a>
          <a href="#2026-08-28-bookmarks-and-image-folders">August</a>
        </nav>
        <ol className="kc-timeline">
          {changelogEntries.map((entry, index) => {
            const date = dateFormatter.format(new Date(`${entry.date}T00:00:00Z`));
            return (
              <li key={entry.id}>
                <section id={entry.id} className="kc-entry" aria-labelledby={`${entry.id}-title`}>
                  <div className="kc-date">
                    <a href={`#${entry.id}`} aria-label={`Link to ${date}: ${entry.title}`}>
                      <time dateTime={entry.date}>{date}</time>
                    </a>
                    {index === 0 ? <span className="kc-latest">Latest update</span> : null}
                  </div>
                  <div className="kc-content">
                    <h2 id={`${entry.id}-title`}>{entry.title}</h2>
                    <p className="kc-summary">{entry.summary}</p>
                    {entry.sections.map((section) => (
                      <div key={section.label} className="kc-changes" data-kind={section.label.toLowerCase()}>
                        <h3>{section.label}</h3>
                        <ul>
                          {section.notes.map((note) => <li key={note}>{note}</li>)}
                        </ul>
                      </div>
                    ))}
                    {entry.guides ? (
                      <nav className="kc-guides" aria-label={`Help for ${entry.title}`}>
                        {entry.guides.map((guide) => <Link key={guide.href} href={guide.href}>{guide.label}<span aria-hidden="true"> ↗</span></Link>)}
                      </nav>
                    ) : null}
                  </div>
                </section>
              </li>
            );
          })}
        </ol>
        <aside className="kc-help">
          <p>Looking for the steps?</p>
          <Link href="/help">Explore the Help guides <span aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </WebsitePage>
  );
}
