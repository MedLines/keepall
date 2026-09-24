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
        <section className="help-heading"><p className="public-eyebrow">Keepall help</p><h1>A little help, right when you need it.</h1><p>Short guides for making the most of your library. Start anywhere.</p></section>
        <div className="help-guide-list">
          {guides.map((guide, index) => (
            <Link key={guide.slug} href={`/help/${guide.slug}`} className="help-guide-link">
              <span className="help-guide-index">0{index + 1}</span>
              <span className="help-guide-content"><span className="public-eyebrow">{guide.category} · {guide.minutes}</span><strong>{guide.title}</strong><span>{guide.summary}</span></span>
              <span className="help-guide-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
        <aside className="help-contact"><div><p className="public-eyebrow">Still need a hand?</p><h2>We&apos;re here to help.</h2><p>Tell us what happened and what you expected to see.</p></div><a href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer" className="public-button public-button-secondary">Contact support <span aria-hidden="true">↗</span></a></aside>
        <PublicFooter />
      </div>
    </main>
  );
}
