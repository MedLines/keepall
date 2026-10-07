import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import Image from "next/image";
import searchDetailImage from "../../../public/marketing/app-search-detail.webp";
import backupImage from "../../../public/marketing/app-backup.webp";
import { HugeiconsIcon } from "@hugeicons/react";
import { AndroidIcon, AppleIcon, ComputerIcon } from "@hugeicons/core-free-icons";
import { CHROME_EXTENSION_URL } from "../help/guides";
import { ArrowRightIcon, BackupIcon, LogoIcon, NoteIcon } from "../shell-icons";
import { CaptureDemo } from "./capture-demo";
import { ReadingFeatures, ImageToolsFeature } from "./reading-features";
import { LibraryPreview } from "./library-preview";
import { MarketingFooterLinks, MarketingHeader } from "../marketing-navigation";
import { FooterWordmark } from "./footer-wordmark";
import { HeroHeading } from "./hero-heading";
import { HeroSupportingCopy } from "./hero-supporting-copy";
import { FeatureGallery, FeatureStack, HeroScene, ScrollStatement } from "./scroll-scenes";
import "./landing.css";

const inter = localFont({
  src: "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "optional",
});

export const metadata: Metadata = {
  title: "Keepall · Save links, notes, media, and documents",
  description: "A personal library for your links, notes, images, videos, and documents. Save with the Chrome extension, find your favorites, and keep your library on your device. Free, with no account.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "/about",
    siteName: "Keepall",
    title: "Keepall · Save links, notes, media, and documents",
    description: "Keep links, notes, media, and documents in a personal library on your device. Free, with no account or automatic sync.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Keepall, a personal library for links, notes, images, videos, and documents, with a view of the app" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keepall · Save links, notes, media, and documents",
    description: "Keep links, notes, media, and documents in a personal library on your device. Free, with no account or automatic sync.",
    images: [{ url: "/twitter-image.png", alt: "Keepall personal library" }],
  },
};

const platforms = [
  { id: "computer", name: "On your computer", browser: "Chrome or Edge", detail: "Open Keepall, choose the install icon in the address bar, then select Install.", icon: ComputerIcon },
  { id: "android", name: "On Android", browser: "Chrome", detail: "Open the browser menu, choose Add to Home screen, then follow the install steps.", icon: AndroidIcon },
  { id: "iphone", name: "On iPhone or iPad", browser: "Safari", detail: "Open Keepall in Safari. Tap Share, then Add to Home Screen. Open the new icon before you start saving.", icon: AppleIcon },
];

function ChromeMark() {
  return <svg className="ka-chrome-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="oklch(0.625730845 0.205841062 29.077253722)" d="M12 0a12 12 0 0 1 10.392 6H12a6 6 0 0 0-5.196 9L1.608 6A12 12 0 0 1 12 0Z" /><path fill="oklch(0.647549305 0.160277201 148.495469399)" d="M1.608 6A12 12 0 0 0 12 24l5.196-9A6 6 0 0 1 6.804 15Z" /><path fill="oklch(0.830437542 0.169810122 83.992721714)" d="M22.392 6A12 12 0 0 1 12 24l5.196-9A6 6 0 0 0 12 6Z" /><circle cx="12" cy="12" r="6" fill="oklch(1 0 0)" /><circle cx="12" cy="12" r="4.5" fill="oklch(0.630386154 0.180027381 259.956004329)" /></svg>;
}

export default function AboutPage() {
  return (
    <main className={`ka-page ka-about ${inter.className}`}>
      <a className="ka-skip" href="#main-content">Skip to content</a>
      <MarketingHeader floating />
      <div id="main-content">
        <HeroScene preview={<LibraryPreview eager />}>
          <p className="ka-pill">Your personal library</p>
          <HeroHeading />
          <HeroSupportingCopy />
        </HeroScene>
        <ScrollStatement />
        <section id="collection" className="ka-features ka-wrap" aria-labelledby="collection-title">
          <div className="ka-section-heading"><div><p className="ka-pill">Inside Keepall</p><h2 id="collection-title">A home for your<br /><span className="ka-brand-highlight">many interests.</span></h2></div><p>Save first. Organize when you feel like it.<br />Find your way back when it matters.</p></div>
          <FeatureGallery panels={[<LibraryPreview key="library" />, <LibraryPreview key="collections" view="collection" />, <LibraryPreview key="tags" view="tags" />, <LibraryPreview key="search" view="search" />]} />
          <p className="ka-section-note">Browse with Preview without losing your place, or open a local video to play it in Keepall. <Link href="/help/preview">Explore Preview <ArrowRightIcon /></Link>{" "}<Link href="/help/images-and-videos#videos">Save a video <ArrowRightIcon /></Link></p>
        </section>
        <div className="ka-benefits ka-wrap">
          <div className="ka-section-heading"><div><p className="ka-pill">From finding to keeping</p><h2>Good finds deserve<br />more than an open tab.</h2></div><p>A quicker way to save, a calmer place to browse,<br />and a library you can take with you.</p></div>
          <FeatureStack>
            <section id="extension" className="ka-feature-card ka-extension" aria-labelledby="capture-title"><div className="ka-card-copy"><div className="ka-extension-brand"><ChromeMark /><p className="ka-eyebrow">Keepall Capture<br />For Google Chrome</p></div><h2 id="capture-title">Found it?<br /><span className="ka-brand-highlight">Keep it.</span></h2><p>Save pages, images, and selected text with their source. Press Alt+K on most websites to add a note in plain text or Markdown before saving.</p><a href={CHROME_EXTENSION_URL} className="ka-button ka-button-small"><ChromeMark />Add to Chrome <ArrowRightIcon /></a><p className="ka-card-caption">On a computer. Keepall can stay closed.</p><Link href="/help/chrome-capture" className="ka-card-foot">Setup, shortcuts &amp; permissions <ArrowRightIcon /></Link></div><div className="ka-card-scene ka-capture-scene"><CaptureDemo /></div></section>
            <section className="ka-feature-card ka-organize" aria-labelledby="organize-title"><div className="ka-card-copy"><p className="ka-eyebrow">A little order, on your terms</p><h2 id="organize-title">Less digging.<br />More discovering.</h2><p>Bring related things into collections, connect them with tags, and pin your favorites. Review Unsorted when you have a moment. Search saved words, including text inside documents and recognized screenshots.</p><div className="ka-feature-tags"><span>Collections</span><span>Tags</span><span>Grid &amp; list</span></div><Link href="/help/collections-and-tags" className="ka-card-foot">Find your kind of organized <ArrowRightIcon /></Link></div><div className="ka-card-scene ka-organize-scene"><Image className="ka-app-detail ka-search-detail" src={searchDetailImage} alt="Actual Keepall search results for quiet spaces, showing saved images and highlighted text" width={1468} height={1520} sizes="(max-width: 800px) 85vw, 480px" /></div></section>
            <section id="your-library" className="ka-feature-card ka-local" aria-labelledby="local-title"><div className="ka-card-copy"><p className="ka-eyebrow">Personal means yours</p><h2 id="local-title">Your interests.<br />Your device.<br />Your library.</h2><p>Your saves live in this browser, on this device. No account, no automatic cloud sync. Download a backup to keep safe or move to another device. In supported desktop browsers, choose a folder for automatic backups.</p><p className="ka-card-caption">Previews, article fetching, and website icons use network requests. Visits use Vercel Web Analytics. <Link href="/privacy">Read about privacy</Link>.</p><Link href="/help/storage-and-backups" className="ka-card-foot">How storage &amp; backups work <ArrowRightIcon /></Link></div><div className="ka-card-scene ka-local-scene"><div className="ka-backup-preview"><span className="ka-preview-caption">Settings / Storage &amp; backups</span><Image className="ka-app-detail" src={backupImage} alt="Keepall’s Backup settings with Export backup and Import backup controls" width={1152} height={1144} sizes="(max-width: 800px) 85vw, 480px" /><Link href="/help/storage-and-backups#download" className="ka-text-link">Back up your library <ArrowRightIcon /></Link></div></div></section>
          </FeatureStack>
        </div>
        <ReadingFeatures />
        <ImageToolsFeature />
        <div className="ka-extra-features ka-wrap"><Link href="/help/offline"><NoteIcon /><h3>A little less dependent on Wi-Fi.</h3><p>Read saved articles, notes, and documents, or revisit local images and videos once Keepall is cached. Original websites still need a connection.</p><span>What works offline <ArrowRightIcon /></span></Link><Link href="/help/import"><BackupIcon /><h3>Your old finds are welcome.</h3><p>Bring over browser bookmarks, images, MP4 and WebM videos, PDFs, Markdown, and text files. Import several files or a whole folder at once.</p><span>Import your saves <ArrowRightIcon /></span></Link></div>
        <section id="install" className="ka-install ka-wrap" aria-labelledby="install-title"><div className="ka-section-heading"><div><p className="ka-pill">Make yourself at home</p><h2 id="install-title">Your library.<br />One icon away.</h2></div><p>The app opens your library. The extension helps you fill it. Install either, or keep using your browser.</p></div><nav aria-label="Install Keepall" className="ka-platforms">{platforms.map((platform) => <Link key={platform.id} href={`/help/install-keepall#${platform.id}`}><HugeiconsIcon icon={platform.icon} size={28} strokeWidth={1.5} aria-hidden="true" /><h3>{platform.name}</h3><span className="ka-platform-browser">{platform.browser}</span><p>{platform.detail}</p><span className="ka-platform-action">See the setup guide <ArrowRightIcon /></span></Link>)}</nav><p className="ka-install-note">Your library stays on this device. Storage space and protection depend on your browser, so keep a backup. On iPhone, the Home Screen app has a separate library from Safari. <Link href="/help/storage-and-backups#mobile">Read about phone storage</Link>.</p></section>
        <section className="ka-faq ka-wrap" aria-labelledby="faq-title"><div><p className="ka-pill">A few useful things to know</p><h2 id="faq-title">Before you<br />settle in.</h2><Link href="/help" className="ka-text-link">Visit the help center <ArrowRightIcon /></Link></div><div className="ka-questions"><details><summary>Is Keepall free?<span aria-hidden="true">+</span></summary><p>Yes. Open your library and start saving. You don&apos;t need an account.</p></details><details><summary>Does my library sync between devices?<span aria-hidden="true">+</span></summary><p>There is no automatic sync. Each browser has its own library. Download a backup from Settings and import it on your other device to move your saves.</p></details><details><summary>Can I write formatted notes?<span aria-hidden="true">+</span></summary><p>Yes. Write plain text or Markdown with headings, lists, tables, and code. Add local images to a note, or keep a personal note alongside another save. <Link href="/help/notes">Writing notes</Link>. With the extension, press Alt+K on most websites to add a note before saving. On Mac, use Option+K.</p></details><details><summary>Can I use the extension on my phone?<span aria-hidden="true">+</span></summary><p>Keepall Capture is a Chrome extension for computers. On your phone, open Keepall in your browser or add it to your Home Screen, then save items inside the app.</p></details><details><summary>How safe are my saves on a phone?<span aria-hidden="true">+</span></summary><p>Keepall stores your library locally and asks your browser to protect it from automatic cleanup. That protection is not always granted. Without protection, low storage can trigger cleanup. Clearing site data can erase the library either way. Download a backup after important additions. On iPhone, install before you start saving, or import a backup from Safari into the Home Screen app. <Link href="/help/storage-and-backups#mobile">How phone storage works</Link>.</p></details><details><summary>Will my saved pages work offline?<span aria-hidden="true">+</span></summary><p>Saving a link keeps its address. Choose Save for offline in the full item page to keep a readable article copy. Once Keepall is cached, you can read locally saved articles, notes, and documents, and view local images and videos. Opening the original website or fetching new content still needs a connection. <Link href="/help/saved-articles">Saving articles for later</Link>.</p></details></div></section>

      </div>
      <footer className="ka-footer"><FooterWordmark><section className="ka-closing" aria-labelledby="closing-title"><div className="ka-wrap"><LogoIcon className="keepall-logo-link size-28 md:size-40" /><h2 id="closing-title">Keep a little space<br />for your next good find.</h2><Link href="/" className="ka-button">Start your library <ArrowRightIcon /></Link><p className="ka-fine-print">No account. Just your curiosity.</p></div></section><div className="ka-wrap ka-footer-top"><Link href="/about" className="ka-brand keepall-logo-link"><LogoIcon className="size-8" />keepall</Link><MarketingFooterLinks /></div></FooterWordmark></footer>
    </main>
  );
}
