import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "../public-site";
import { LibraryPreview } from "./library-preview";

export const metadata: Metadata = {
  title: "About Keepall · A place for what you want to keep",
  description: "Keep links, notes, and images in a calm personal library that lives in your browser.",
};

export default function AboutPage() {
  return (
    <main className="public-page">
      <div className="public-wrap">
        <PublicHeader />

        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-hero-copy">
            <p className="public-eyebrow">A quieter corner of the web</p>
            <h1 id="about-title">Keep the things you want to come back to.</h1>
          </div>
          <div className="about-hero-detail">
            <p className="about-lede">A link worth reading. A thought you don&apos;t want to lose. An image that sparks something. Keepall gives them a place to live together.</p>
            <div className="about-actions">
              <Link href="/" className="public-button public-button-primary">Open your library <span aria-hidden="true">↗</span></Link>
              <Link href="/help/getting-started" className="public-button public-button-secondary">See how it works <span aria-hidden="true">→</span></Link>
            </div>
            <p className="about-hero-footnote">Free to use. No account needed.</p>
          </div>
        </section>

        <LibraryPreview />

        <section className="about-intro" aria-labelledby="about-intro-title">
          <p className="public-eyebrow">A home for your finds</p>
          <h2 id="about-intro-title">A little more room for the things that matter to you.</h2>
          <p>Saving should be easy. Finding should feel natural. Keepall brings the links, notes, and images you collect into one calm space, ready whenever you want to pick up where you left off.</p>
        </section>

        <section className="about-features" aria-label="How Keepall works">
          <article className="about-feature"><span className="about-feature-number">01 / SAVE</span><div><h2>Catch it while it&apos;s fresh.</h2><p>Save a link, write a note, or add an image. With Keepall Capture for Chrome, one click saves the page you&apos;re on; Alt + K opens the details when you want to add more.</p></div><span className="about-feature-mark" aria-hidden="true">↗</span></article>
          <article className="about-feature"><span className="about-feature-number">02 / ORGANIZE</span><div><h2>Give it a place.</h2><p>Keep related things in collections, add tags, and jot down why a link mattered. You can start with Unsorted and organize later.</p></div><span className="about-feature-mark" aria-hidden="true">⊞</span></article>
          <article className="about-feature"><span className="about-feature-number">03 / RETURN</span><div><h2>Find your way back.</h2><p>Search your library, browse what you saved, and return to the idea when the moment is right.</p></div><span className="about-feature-mark" aria-hidden="true">⌕</span></article>
        </section>

        <section className="about-local" aria-labelledby="about-local-title"><div className="about-local-symbol" aria-hidden="true"><span /><span /><span /></div><div><p className="public-eyebrow">Made for your own space</p><h2 id="about-local-title">Your library stays in your browser.</h2><p>No account or cloud sync is needed. Keepall stores your saved things locally in this browser profile. You can download a backup from Settings whenever you want a copy to keep.</p><Link href="/help/storage-and-backups">How storage and backups work <span aria-hidden="true">→</span></Link></div></section>

        <section className="about-closing"><p className="public-eyebrow">Ready when you are</p><h2>Start keeping what you love finding.</h2><Link href="/" className="public-button public-button-primary">Open Keepall <span aria-hidden="true">↗</span></Link></section>
        <PublicFooter />
      </div>
    </main>
  );
}
