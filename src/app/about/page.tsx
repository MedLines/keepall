import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { AndroidIcon, AppleIcon, ComputerIcon } from "@hugeicons/core-free-icons";
import { ArrowRightIcon, LogoIcon } from "../shell-icons";
import { LibraryPreview } from "./library-preview";
import { FeatureBento } from "./feature-bento";
import { MarketingFooterLinks, MarketingHeader } from "../marketing-navigation";
import { FooterWordmark } from "./footer-wordmark";
import { HeroHeading } from "./hero-heading";
import { HeroSupportingCopy } from "./hero-supporting-copy";
import { FeatureGallery, HeroScene } from "./scroll-scenes";
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
        <section id="collection" className="ka-features ka-wrap" aria-labelledby="collection-title">
          <div className="ka-section-heading"><h2 id="collection-title">See Keepall in use.</h2></div>
          <FeatureGallery panels={[<LibraryPreview key="library" />, <LibraryPreview key="collections" view="collection" />, <LibraryPreview key="tags" view="tags" />, <LibraryPreview key="search" view="search" />]} />
        </section>
        <FeatureBento />
        <section id="install" className="ka-install ka-wrap" aria-labelledby="install-title"><div className="ka-section-heading"><h2 id="install-title">Install Keepall.</h2><p>Open it from your desktop or Home Screen, or keep using your browser.</p></div><nav aria-label="Install Keepall" className="ka-platforms">{platforms.map((platform) => <Link key={platform.id} href={`/help/install-keepall#${platform.id}`}><HugeiconsIcon icon={platform.icon} size={28} strokeWidth={1.5} aria-hidden="true" /><h3>{platform.name}</h3><span className="ka-platform-browser">{platform.browser}</span><p>{platform.detail}</p><span className="ka-platform-action">See the setup guide <ArrowRightIcon /></span></Link>)}</nav><p className="ka-install-note">Your library stays on this device. Storage space and protection depend on your browser, so keep a backup. On iPhone, the Home Screen app has a separate library from Safari. <Link href="/help/storage-and-backups#mobile">Read about phone storage</Link>.</p></section>
        <section className="ka-faq ka-wrap" aria-labelledby="faq-title"><div><h2 id="faq-title">Common questions.</h2><Link href="/help" className="ka-text-link">Visit the help center <ArrowRightIcon /></Link></div><div className="ka-questions"><details><summary>Is Keepall free?<span aria-hidden="true">+</span></summary><p>Yes. Open your library and start saving. You don&apos;t need an account.</p></details><details><summary>Does my library sync between devices?<span aria-hidden="true">+</span></summary><p>There is no automatic sync. Each browser has its own library. Download a backup from Settings and import it on your other device to move your saves.</p></details><details><summary>Can I write formatted notes?<span aria-hidden="true">+</span></summary><p>Yes. Use Markdown for headings, lists, tables, and code, and attach local images. You can also add a personal note to another save. <Link href="/help/notes">Read the notes guide</Link>.</p></details><details><summary>Can I use the extension on my phone?<span aria-hidden="true">+</span></summary><p>Keepall Capture is a Chrome extension for computers. On your phone, open Keepall in your browser or add it to your Home Screen, then save items inside the app.</p></details><details><summary>How safe are my saves on a phone?<span aria-hidden="true">+</span></summary><p>Browser cleanup or clearing site data can erase a local library. Keepall asks for storage protection, but your browser may not grant it. Download a backup after important additions. On iPhone, the Home Screen app and Safari have separate libraries. <Link href="/help/storage-and-backups#mobile">How phone storage works</Link>.</p></details><details><summary>Will my saved pages work offline?<span aria-hidden="true">+</span></summary><p>Choose Save for offline to keep a readable article copy. Once Keepall is cached, saved articles, notes, documents, and local media work offline. Saving a link alone keeps its address. Original websites and fetching new content need a connection. <Link href="/help/saved-articles">Saving articles for later</Link>.</p></details></div></section>

      </div>
      <footer className="ka-footer"><FooterWordmark><section className="ka-closing" aria-labelledby="closing-title"><div className="ka-wrap"><LogoIcon className="keepall-logo-link size-28 md:size-40" /><h2 id="closing-title">Keep a little space<br />for your next good find.</h2><Link href="/" className="ka-button">Start your library <ArrowRightIcon /></Link></div></section><div className="ka-wrap ka-footer-top"><Link href="/about" className="ka-brand keepall-logo-link"><LogoIcon className="size-8" />keepall</Link><MarketingFooterLinks /></div></FooterWordmark></footer>
    </main>
  );
}
