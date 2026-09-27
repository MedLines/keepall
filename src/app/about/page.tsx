import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { AndroidIcon, AppleIcon, ComputerIcon } from "@hugeicons/core-free-icons";
import { CHROME_EXTENSION_URL } from "../help/guides";
import { ArrowRightIcon, BackupIcon, CollectionIcon, HashIcon, ImageIcon, LinkIcon, LogoIcon, NoteIcon, SearchIcon, VideoIcon } from "../shell-icons";
import { CaptureDemo } from "./capture-demo";
import { LibraryPreview } from "./library-preview";
import "./landing.css";

export const metadata: Metadata = {
  title: "Keepall · Everything worth keeping",
  description: "A personal library for your links, notes, images, and videos. Save from Chrome, find your next idea, and keep your library on your device. Free, with no account needed.",
};

function CollectionScene() {
  return (
    <div className="ka-collection-art" role="img" aria-label="An example collection of an architectural photograph, a personal note, a typography reference, and a saved reading corner">
      <div className="ka-art-grid" aria-hidden="true">
        <div className="ka-art-photo"><Image src="/marketing/architecture.webp" alt="" fill sizes="(max-width: 640px) 65vw, 340px" /><span>Afternoon light <ImageIcon /></span></div>
        <div className="ka-art-note"><span><NoteIcon /> A thought for later</span><p>More things<br />that make me<br /><em>look twice.</em></p><small>Less endless scrolling.<br />More following a feeling.</small></div>
        <div className="ka-art-type"><span>THE TYPE FILES · VOL. 04</span><strong>Aa</strong><p>Good type.<br />Worth a second look.</p><small><LinkIcon /> A reference for the next project</small></div>
        <div className="ka-art-room"><Image src="/marketing/reading-corner.webp" alt="" fill sizes="(max-width: 640px) 50vw, 250px" /><span><VideoIcon /> A space to slow down</span></div>
        <span className="ka-art-tag"><HashIcon /> inspiration</span>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="ka-page">
      <a className="ka-skip" href="#main-content">Skip to content</a>
      <header className="ka-header">
        <Link href="/about" className="ka-brand" aria-label="Keepall home"><LogoIcon className="size-8" /><span>keepall</span></Link>
        <nav aria-label="Main navigation"><a href="#collection">The library</a><a href="#extension">Capture</a><Link href="/help">Help</Link></nav>
        <Link href="/" className="ka-button ka-button-small">Open Keepall <ArrowRightIcon /></Link>
      </header>

      <div id="main-content" className="ka-frame">
        <section className="ka-hero" aria-labelledby="ka-title">
          <p className="ka-eyebrow"><span className="ka-status-dot" /> A home for your curiosity</p>
          <h1 id="ka-title">Everything worth<br /><em>keeping.</em></h1>
          <p className="ka-hero-copy">The link you loved. The idea for later.<br className="ka-desktop-break" /> Your notes, images, and videos, all in one personal library.</p>
          <div className="ka-hero-actions"><Link href="/" className="ka-button">Start your library <ArrowRightIcon /></Link><a href="#extension" className="ka-text-link">Meet the extension <span aria-hidden="true">↘</span></a></div>
          <p className="ka-fine-print">Free to use. No account. Yours from the first save.</p>
        </section>

        <section className="ka-showcase" aria-label="Inside Keepall">
          <div className="ka-showcase-heading"><span><span className="ka-status-dot" /> YOUR FINDS, IN GOOD COMPANY</span><span>A look inside Keepall <span aria-hidden="true">↙</span></span></div>
          <div className="ka-showcase-window"><LibraryPreview /></div>
          <div className="ka-showcase-foot"><span>Collect a little of everything.</span><div><span><LinkIcon /> Links</span><span><NoteIcon /> Notes</span><span><ImageIcon /> Images</span><span><VideoIcon /> Videos</span></div></div>
        </section>

        <section id="collection" className="ka-section ka-collect" aria-labelledby="collection-title">
          <div className="ka-section-heading"><p className="ka-eyebrow">01 / Make it yours</p><h2 id="collection-title">Your interests don&apos;t fit<br />in one kind of bookmark.</h2><p>A recipe, a reference, a half-formed thought. Keep them together, with a little context for the next time you come back.</p></div>
          <CollectionScene />
          <div className="ka-collect-details"><div><h3>Save the thing. Keep the thought.</h3><p>Add a note to a link or image, write something of your own, or keep related pictures in a gallery.</p></div><Link href="/help/getting-started" className="ka-text-link">See what you can save <ArrowRightIcon /></Link></div>
        </section>

        <section id="extension" className="ka-section ka-capture" aria-labelledby="capture-title">
          <div className="ka-section-heading"><p className="ka-eyebrow">02 / Catch it in the moment</p><h2 id="capture-title">Found it?<br /><span className="ka-muted-heading">Keep it.</span></h2><p>Keepall Capture puts your library a click away. Save a page, right-click an image or link, or keep a passage with its source. Keepall doesn&apos;t need to be open.</p><a href={CHROME_EXTENSION_URL} className="ka-button">Add to Chrome <ArrowRightIcon /></a><Link href="/help/chrome-capture" className="ka-text-link">Setup, permissions &amp; the details <ArrowRightIcon /></Link><p className="ka-fine-print">For Chrome on a computer. Demo shows extension 0.2.0+.</p></div>
          <CaptureDemo />
          <div className="ka-shortcut-note"><span className="ka-shortcut-keys"><kbd>⌥ / Alt</kbd><kbd>K</kbd></span><p><strong>A little more to add?</strong> Open the save panel to add a note, choose a collection, or tag it before saving.</p></div>
        </section>

        <section className="ka-section ka-find" aria-labelledby="find-title">
          <div className="ka-section-heading ka-heading-split"><div><p className="ka-eyebrow">03 / Find your way back</p><h2 id="find-title">From “where was that?”<br />to right here.</h2></div><p>Keep a little order, or follow a word you remember. Your library gives you more than one way back.</p></div>
          <div className="ka-find-grid">
            <article className="ka-find-panel"><div className="ka-folder-scene" aria-hidden="true"><div><CollectionIcon /><span>Design references</span><small>24</small></div><div><CollectionIcon /><span>Places to go</span><small>12</small></div><div><CollectionIcon /><span>Weekend projects</span><small>8</small></div><span className="ka-folder-tag"><HashIcon /> someday</span></div><div className="ka-panel-copy"><h3>A place for every rabbit hole.</h3><p>Group finds in collections. Connect them with tags. Pin what matters, and leave the rest in Unsorted until you&apos;re ready.</p><Link href="/help/collections-and-tags" className="ka-text-link">Organize your way <ArrowRightIcon /></Link></div></article>
            <article className="ka-find-panel"><div className="ka-search-scene" aria-hidden="true"><div className="ka-search-input"><SearchIcon /><span>quiet spaces</span><kbd>↵</kbd></div><div className="ka-search-result"><Image src="/marketing/reading-corner.webp" alt="" width={80} height={64} /><span><strong>Quiet spaces</strong><small>Image · Interiors</small></span><ArrowRightIcon /></div><div className="ka-search-result ka-search-result-secondary"><NoteIcon /><span><strong>Ideas for a quieter room</strong><small>Note · Weekend projects</small></span></div></div><div className="ka-panel-copy"><h3>Remember a word. Find the thing.</h3><p>Search your saved titles and text, or narrow things down by tag, collection, and type. Browse in a grid or a list.</p><Link href="/help/collections-and-tags#search" className="ka-text-link">Find your saves <ArrowRightIcon /></Link></div></article>
          </div>
        </section>

        <section id="your-library" className="ka-section ka-local" aria-labelledby="local-title">
          <div className="ka-section-heading"><p className="ka-eyebrow">A personal library, in the literal sense</p><h2 id="local-title">On your device.<br /><span className="ka-muted-heading">On your terms.</span></h2><p>Your library lives in this browser. No account to create, no automatic cloud sync. Download a backup when you want a separate copy or a fresh start on another device.</p><Link href="/help/storage-and-backups" className="ka-text-link">How your data is stored <ArrowRightIcon /></Link></div>
          <div className="ka-local-details">
            <div className="ka-backup-panel">
              <div className="ka-backup-heading"><span className="ka-backup-icon"><BackupIcon /></span><span>Your library, backed up</span></div>
              <h3>Everything you saved.<br />One file to keep.</h3>
              <p>Download a copy of your links, notes, and local media. Keep it somewhere safe, or use it to move your library.</p>
              <Link href="/help/storage-and-backups#download" className="ka-text-link">How to back up your library <ArrowRightIcon /></Link>
            </div>
            <div><h3>Keep reading your own notes offline.</h3><p>Return to locally saved content once the app is cached. Opening original websites still needs a connection.</p><Link href="/help/offline" className="ka-text-link">What works offline <ArrowRightIcon /></Link></div>
            <Link href="/help/import" className="ka-text-link ka-import-link">Import bookmarks &amp; images <ArrowRightIcon /></Link>
          </div>
        </section>

        <section id="install" className="ka-section ka-install" aria-labelledby="install-title">
          <div><p className="ka-eyebrow">One less tab to look for</p><h2 id="install-title">Give your library<br />a place on your screen.</h2><p>Install Keepall for its own app icon, or keep using it in your browser. The app opens your library; the extension helps you fill it.</p></div>
          <nav aria-label="Install Keepall">
            {[
              { id: "computer", name: "Desktop", detail: "Install the app from Chrome", icon: ComputerIcon },
              { id: "android", name: "Android", detail: "Add to your Home screen from Chrome", icon: AndroidIcon },
              { id: "iphone", name: "iPhone", detail: "Safari → Add to Home Screen", icon: AppleIcon },
            ].map((platform) => (
              <Link key={platform.id} href={`/help/install-keepall#${platform.id}`}>
                <span className="ka-install-icon"><HugeiconsIcon icon={platform.icon} size={24} strokeWidth={1.5} aria-hidden="true" /></span>
                <span className="ka-install-copy"><strong>{platform.name}</strong><small>{platform.detail}</small><span className="ka-install-action">View setup guide <ArrowRightIcon /></span></span>
              </Link>
            ))}
          </nav>
          <p className="ka-install-note">Each browser and device has its own library. Use a backup to move your saves.</p>
        </section>

        <section className="ka-closing" aria-labelledby="closing-title"><LogoIcon className="ka-closing-logo" /><h2 id="closing-title">You&apos;ll want to<br />come back to <em>this.</em></h2><Link href="/" className="ka-button">Start keeping <ArrowRightIcon /></Link><p className="ka-fine-print">Start with one good find.</p></section>
      </div>
      <footer className="ka-footer"><div className="ka-footer-inner"><Link href="/about" className="ka-brand"><LogoIcon className="size-7" /><span>keepall</span></Link><span>A home for what catches your mind.</span><nav aria-label="Footer navigation"><Link href="/help">Help</Link><Link href="/extension-privacy">Extension privacy</Link><a href={CHROME_EXTENSION_URL}>Chrome extension ↗</a></nav></div><p aria-hidden="true" className="ka-footer-wordmark">keepall</p></footer>
    </main>
  );
}
