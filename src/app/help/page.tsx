import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "../shell-icons";
import { guides } from "./guides";
import { InstallVisual } from "./guide-visual";
import libraryScreenshot from "../../../public/marketing/app-library.webp";
import capturePoster from "../../../public/marketing/capture-text-poster.webp";
import tagsScreenshot from "../../../public/marketing/app-tags.webp";
import collectionScreenshot from "../../../public/marketing/app-collection.webp";
import importScreenshot from "../../../public/help/import-settings.webp";
import backupScreenshot from "../../../public/help/backup-settings.webp";
import searchScreenshot from "../../../public/marketing/app-search.webp";

export const metadata: Metadata = {
  title: "Help · Keepall",
  description: "Visual guides to installing Keepall, saving from the web, organizing your library, and making backups.",
};

const thumbnails: Record<string, StaticImageData> = {
  "getting-started": libraryScreenshot,
  "saved-articles": libraryScreenshot,
  "chrome-capture": capturePoster,
  "install-keepall": libraryScreenshot,
  "collections-and-tags": tagsScreenshot,
  "images-and-videos": collectionScreenshot,
  import: importScreenshot,
  "storage-and-backups": backupScreenshot,
  offline: searchScreenshot,
};

export default function HelpPage() {
  return <>
    <section className="kh-intro"><p className="ka-pill">Keepall help</p><h1>A guide for every<br /><span>part of your library.</span></h1><p>See how to save, organize, and find your items.<br />Start with a walkthrough or choose a guide below.</p></section>
    <nav className="kh-start" aria-label="Quick start">
      <Link href="/help/install-keepall#computer" className="kh-start-card"><InstallVisual compact /><div className="kh-start-copy"><span className="kh-eyebrow">On your computer or phone</span><h2>Install Keepall</h2><p>Open your library from its own app icon.</p><span className="kh-card-action">See the steps <ArrowRightIcon /></span></div></Link>
      <Link href="/help/chrome-capture#install" className="kh-start-card"><div className="kh-extension-preview"><Image src={capturePoster} alt="A real Keepall Capture demo showing selected text on a website" width={1080} height={1040} sizes="(max-width: 650px) 90vw, 520px" /></div><div className="kh-start-copy"><span className="kh-eyebrow">For Chrome on your computer</span><h2>Save from any tab</h2><p>Set up the extension and make your first save.</p><span className="kh-card-action">Set up Keepall Capture <ArrowRightIcon /></span></div></Link>
    </nav>
    <section className="kh-guides" aria-labelledby="guides-title"><div className="kh-list-heading"><h2 id="guides-title">Explore the guides</h2><span>{guides.length} guides · Step-by-step instructions</span></div>
      {guides.map((guide, index) => <Link key={guide.slug} href={`/help/${guide.slug}`} className="kh-guide-row"><span className="kh-guide-number">{String(index + 1).padStart(2, "0")}</span><div className="kh-guide-copy"><span className="kh-eyebrow">{guide.category} · {guide.minutes}</span><h3>{guide.title}</h3><p>{guide.summary}</p></div><div className="kh-guide-thumbnail"><Image src={thumbnails[guide.slug] ?? libraryScreenshot} alt="" width={240} height={144} sizes="140px" /></div><ArrowRightIcon /></Link>)}
    </section>
    <aside className="kh-contact"><div><span className="ka-pill">Still need help?</span><h2>Tell us what went wrong.</h2><p>Include your browser, the steps you took, and what happened.<br />Write a message or prepare a bug report on Contact.</p></div><Link href="/contact" className="ka-button">Contact <ArrowRightIcon /></Link></aside>
  </>;
}
