import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "../public-site";
import { guides } from "./guides";

export const metadata: Metadata = {
  title: "Help · Keepall",
  description: "Simple guides to saving, organizing, and backing up your Keepall library.",
};

export default function HelpPage() {
  return (
    <main className="public-page help-page">
      <div className="public-wrap">
        <PublicHeader />
        <section className="help-heading"><p className="public-eyebrow">Keepall help</p><h1>Make yourself at home.</h1><p>Save your first item, set up the extension, or bring your library to a new device. Choose what you want to do.</p></section>
        <nav className="help-start-links" aria-label="Quick start">
          <Link href="/help/chrome-capture#install"><span className="public-eyebrow">Save from other websites</span><strong>Set up the Chrome extension <span aria-hidden="true">→</span></strong></Link>
          <Link href="/help/install-keepall"><span className="public-eyebrow">Open from an app icon</span><strong>Install Keepall on your device <span aria-hidden="true">→</span></strong></Link>
        </nav>
        <div className="help-guide-list">
          {guides.map((guide, index) => (
            <Link key={guide.slug} href={`/help/${guide.slug}`} className="help-guide-link">
              <span className="help-guide-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="help-guide-content"><span className="public-eyebrow">{guide.category} · {guide.minutes}</span><strong>{guide.title}</strong><span>{guide.summary}</span></span>
              <span className="help-guide-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
        <aside className="help-contact"><div><p className="public-eyebrow">Still need a hand?</p><h2>Tell us what went wrong.</h2><p>Report a problem on GitHub. Include your browser and what you expected to happen. A GitHub account is needed to post.</p></div><a href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer" className="public-button public-button-secondary">Report a problem <span aria-hidden="true">↗</span></a></aside>
        <PublicFooter />
      </div>
    </main>
  );
}
